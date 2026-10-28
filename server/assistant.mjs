import { systemInstruction } from "./knowledge.mjs";

const MAX_AUDIO = 5 * 1024 * 1024;
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const configured = (env) =>
  Boolean(
    env.OPENROUTER_API_KEY && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY,
  );

async function limitedBody(request, maximum) {
  if (Number(request.headers.get("content-length")) > maximum)
    fail(413, "Wiadomość lub nagranie jest za duże.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "Brakuje treści wiadomości.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      fail(413, "Wiadomość lub nagranie jest za duże.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function verify(request, env, token, action, fetcher) {
  if (typeof token !== "string" || !token || token.length > 2048)
    fail(403, "Potwierdź weryfikację i spróbuj ponownie.");
  const result = await fetcher(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || undefined,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!result.ok)
    fail(503, "Weryfikacja jest chwilowo niedostępna. Spróbuj za moment.");
  const data = await result.json();
  if (
    !data.success ||
    data.hostname !== new URL(request.url).hostname ||
    data.action !== action
  ) {
    fail(403, "Weryfikacja wygasła. Spróbuj ponownie.");
  }
}

function messagesFrom(body) {
  const messages = body?.messages;
  if (
    !Array.isArray(messages) ||
    messages.length < 1 ||
    messages.length > 13 ||
    messages.length % 2 !== 1
  ) {
    fail(400, "Nieprawidłowa historia rozmowy. Rozpocznij nową rozmowę.");
  }
  return messages.map((message, i) => {
    const role = i % 2 ? "assistant" : "user";
    if (
      message?.role !== role ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > (role === "user" ? 2000 : 6000)
    ) {
      fail(
        400,
        "Pytanie może mieć maksymalnie 2000 znaków. Sprawdź treść rozmowy.",
      );
    }
    return {
      role,
      content: message.content.trim(),
    };
  });
}

async function chat(request, env, fetcher) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Wymagany format JSON.");
  let body;
  try {
    body = JSON.parse(
      new TextDecoder().decode(await limitedBody(request, 256 * 1024)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, "Nieprawidłowa wiadomość.");
  }
  const contents = messagesFrom(body);
  await verify(request, env, body.token, "chat", fetcher);
  const response = await fetcher(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "recursive/flint-v1.0:free",
        messages: [{ role: "system", content: systemInstruction }, ...contents],
        max_tokens: 1600,
        reasoning: { enabled: false },
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(90000),
    },
  );
  if (!response.ok) {
    if (response.status === 429)
      fail(429, "Asystent ma teraz dużo pytań. Spróbuj za chwilę.");
    fail(
      502,
      "Nie udało się uzyskać odpowiedzi. Spróbuj ponownie lub napisz do Juliana.",
    );
  }
  const data = await response.json();
  const candidate = data.choices?.[0];
  const answer = typeof candidate?.message?.content === "string"
    ? candidate.message.content.trim()
    : "";
  if (!answer || !["stop", "length"].includes(candidate.finish_reason)) {
    fail(
      502,
      "Nie udało się przygotować odpowiedzi. Zadaj pytanie inaczej lub napisz do Juliana.",
    );
  }
  // Nie przedstawiaj urwanej odpowiedzi jako kompletnej.
  if (candidate.finish_reason === "length" || answer.length > 5900) {
    const bounded = answer.slice(0, 5800);
    const endings = [...bounded.matchAll(/[.!?](?=\s|$)/gu)];
    const last = endings.at(-1);
    if (!last) {
      fail(502, "Nie udało się dokończyć odpowiedzi. Spróbuj krótszego pytania lub napisz do Juliana.");
    }
    return json({ answer: bounded.slice(0, last.index + 1) + "\n\nOdpowiedź została skrócona. Możesz dopytać o szczegóły." });
  }
  return json({ answer });
}

async function transcribe(request, env, fetcher) {
  if (!env.GROQ_API_KEY)
    fail(503, "Dyktowanie jest niedostępne. Wpisz pytanie.");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    fail(415, "Wymagane nagranie audio.");
  const bytes = await limitedBody(request, MAX_AUDIO + 65536);
  let form;
  try {
    form = await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") },
    }).formData();
  } catch {
    fail(400, "Nieprawidłowe nagranie.");
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || !audio.size)
    fail(400, "Nagranie jest puste. Spróbuj jeszcze raz.");
  if (audio.size > MAX_AUDIO) fail(413, "Nagranie może mieć maksymalnie 5 MB.");
  const mime = audio.type.split(";")[0].trim();
  if (!AUDIO_TYPES.has(mime))
    fail(415, "Ten format nagrania nie jest obsługiwany. Wpisz pytanie.");
  await verify(request, env, form.get("token"), "transcribe", fetcher);
  const upload = new FormData();
  const extension =
    { "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/x-wav": "wav" }[mime] ||
    mime.split("/")[1];
  upload.set("file", audio, `pytanie.${extension}`);
  upload.set("model", "whisper-large-v3-turbo");
  upload.set("language", "pl");
  upload.set("response_format", "json");
  const response = await fetcher(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: upload,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    fail(
      response.status === 429 ? 429 : 502,
      "Nie udało się rozpoznać mowy. Spróbuj ponownie lub wpisz pytanie.",
    );
  const data = await response.json();
  if (typeof data.text !== "string" || !data.text.trim())
    fail(422, "Nie rozpoznano słów. Spróbuj jeszcze raz lub wpisz pytanie.");
  if (data.text.length > 2000)
    fail(422, "Wypowiedź jest zbyt długa. Nagraj krótsze pytanie.");
  return json({ text: data.text.trim() });
}

// fetcher pozwala testować granice systemu bez wysyłania danych i bez kluczy API.
export async function handle(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  if (path === "/api/config" && request.method === "GET") {
    return json({
      enabled: configured(env),
      voice: configured(env) && Boolean(env.GROQ_API_KEY),
      siteKey: env.TURNSTILE_SITE_KEY || null,
    });
  }
  if (!["/api/chat", "/api/transcribe"].includes(path))
    return json({ error: "Nie znaleziono." }, 404);
  if (request.method !== "POST")
    return json({ error: "Ta operacja wymaga POST." }, 405, { Allow: "POST" });
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    return json({ error: "Niedozwolone źródło żądania." }, 403);
  if (!configured(env))
    return json(
      {
        error:
          "Asystent jest w przygotowaniu. Napisz do Juliana: julian.cichor@aol.com.",
      },
      503,
    );
  try {
    return path === "/api/chat"
      ? await chat(request, env, fetcher)
      : await transcribe(request, env, fetcher);
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    // Nie logujemy rozmów, nagrań, kluczy ani odpowiedzi dostawców.
    return json(
      {
        error:
          "Połączenie z asystentem jest chwilowo niedostępne. Spróbuj ponownie lub napisz do Juliana.",
      },
      502,
    );
  }
}
