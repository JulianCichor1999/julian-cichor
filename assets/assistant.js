(() => {
  "use strict";
  if (document.querySelector(".jc-assistant")) return;
  const root = document.createElement("div");
  root.className = "jc-assistant";
  // Stały szablon. Odpowiedzi AI i tekst klienta dodajemy wyłącznie przez textContent.
  root.innerHTML = `
    <section class="jc-panel" id="jc-panel" aria-labelledby="jc-title" hidden>
      <div class="jc-top">
        <div><h2 class="jc-title" id="jc-title">Asystent Juliana</h2><p class="jc-subtitle">AI · pomoc w wyborze współpracy</p></div>
        <button class="jc-icon jc-close" type="button" aria-label="Zamknij asystenta">✕</button>
      </div>
      <div class="jc-log" role="log" aria-label="Rozmowa z asystentem" aria-live="polite" aria-relevant="additions"></div>
      <p class="jc-status" role="status" aria-live="polite"></p>
      <div class="jc-verification"></div>
      <form class="jc-form">
        <label for="jc-question">Twoje pytanie</label>
        <textarea id="jc-question" rows="2" maxlength="2000" placeholder="W czym szukasz wsparcia?" aria-describedby="jc-help"></textarea>
        <div class="jc-controls">
          <button class="jc-icon jc-mic" type="button" aria-pressed="false" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
            <span>Dyktuj</span>
          </button>
          <button class="jc-send" type="submit" disabled>Wyślij</button>
        </div>
      </form>
      <div class="jc-footer">
        <div class="jc-footer-row"><a href="mailto:julian.cichor@aol.com">Napisz do Juliana</a><button type="button" class="jc-clear">Nowa rozmowa</button></div>
        <details><summary>Jak działa rozmowa?</summary><div class="jc-privacy-copy" id="jc-help"><p>Odpowiada AI na podstawie informacji o Julianie. Może się pomylić. Zakres i wycenę potwierdza Julian.</p><p>Wiadomości i ostatnie 6 wymian trafiają przez Cloudflare do OpenRouter i dostawcy modelu Recursive. Nagranie (do 60 s) po zatrzymaniu trafia do Groq. Rozpoznany tekst możesz poprawić i samodzielnie wysłać. Nie podawaj danych poufnych.</p><p>Ta aplikacja nie zapisuje rozmów ani nagrań w bazie lub pamięci przeglądarki. Historia znika po odświeżeniu lub kliknięciu „Nowa rozmowa”. Cloudflare Turnstile weryfikuje ruch przed wysłaniem.</p></div></details>
      </div>
    </section>
    <button class="jc-launch" type="button" aria-controls="jc-panel" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 2V11.5a9 9 0 0 1 18 0Z"/><path d="M8 10h8M8 14h5"/></svg>
      <span>Zapytaj asystenta</span>
    </button>`;
  document.body.append(root);
  const $ = (selector) => root.querySelector(selector);
  const panel = $(".jc-panel"),
    launch = $(".jc-launch"),
    input = $("textarea");
  const log = $(".jc-log"),
    status = $(".jc-status"),
    send = $(".jc-send");
  const mic = $(".jc-mic"),
    clear = $(".jc-clear");
  let config,
    loadingConfig,
    busy = false,
    history = [],
    recorder,
    stream,
    timer;
  let discardRecording = false,
    tokenWidget,
    turnstileLoading,
    cancelToken;

  function controls() {
    send.disabled = busy || !config?.enabled;
    input.disabled = busy;
    clear.disabled = busy;
    mic.disabled = busy && recorder?.state !== "recording";
    root.querySelectorAll(".jc-starters button").forEach((button) => {
      button.disabled = busy;
    });
  }
  function setBusy(value) {
    busy = value;
    controls();
  }
  function say(text) {
    status.textContent = text;
  }
  function message(role, text) {
    const bubble = document.createElement("div");
    bubble.className = "jc-message";
    bubble.dataset.role = role;
    const label = document.createElement("strong");
    label.textContent = role === "user" ? "Ty" : "Asystent AI";
    bubble.append(label, document.createTextNode(text));
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }
  function welcome() {
    log.replaceChildren();
    message(
      "assistant",
      "Cześć! Pomogę Ci sprawdzić, w czym Julian może Cię wesprzeć. Opowiedz, co chcesz usprawnić albo czego potrzebujesz.",
    );
    const starters = document.createElement("div");
    starters.className = "jc-starters";
    for (const text of [
      "Co mogę zautomatyzować w firmie?",
      "Potrzebuję wsparcia w marketingu",
      "Chcę asystenta AI na stronę",
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", () => {
        input.value = text;
        input.focus();
      });
      starters.append(button);
    }
    log.append(starters);
  }
  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      signal: AbortSignal.timeout(105000),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Asystent jest chwilowo niedostępny. Napisz do Juliana lub spróbuj później.",
      );
    }
    if (!response.ok)
      throw new Error(
        data.error || "Nie udało się połączyć. Spróbuj ponownie.",
      );
    return data;
  }
  async function loadConfig() {
    if (config || loadingConfig) return loadingConfig;
    say("Łączenie z asystentem…");
    loadingConfig = request("/api/config")
      .then((data) => {
        config = data;
        mic.hidden = !(
          data.voice &&
          window.MediaRecorder &&
          navigator.mediaDevices?.getUserMedia &&
          window.isSecureContext
        );
        say(
          data.enabled
            ? ""
            : "Asystent jest w przygotowaniu. Możesz już napisać bezpośrednio do Juliana.",
        );
        controls();
      })
      .catch((error) => say(error.message))
      .finally(() => {
        loadingConfig = null;
      });
    return loadingConfig;
  }
  function close() {
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    cancelToken?.();
    if (recorder?.state === "recording") {
      discardRecording = true;
      recorder.stop();
    }
    launch.focus();
  }
  launch.addEventListener("click", () => {
    if (!panel.hidden) return close();
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    input.focus();
    loadConfig();
  });
  $(".jc-close").addEventListener("click", close);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.stopPropagation();
      close();
    }
  });
  clear.addEventListener("click", () => {
    history = [];
    input.value = "";
    welcome();
    say("Rozmowa została wyczyszczona.");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $(".jc-form").requestSubmit();
    }
  });

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (turnstileLoading) return turnstileLoading;
    turnstileLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              "Weryfikacja nie odpowiada. Sprawdź połączenie i spróbuj ponownie.",
            ),
          ),
        20000,
      );
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(
          new Error("Nie udało się załadować weryfikacji. Spróbuj ponownie."),
        );
      };
      document.head.append(script);
    }).catch((error) => {
      turnstileLoading = null;
      throw error;
    });
    return turnstileLoading;
  }
  async function getToken(action) {
    say("Weryfikacja połączenia…");
    await loadTurnstile();
    if (panel.hidden)
      throw new Error("Wysyłanie zostało przerwane po zamknięciu asystenta.");
    if (tokenWidget !== undefined) window.turnstile.remove(tokenWidget);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, token) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        cancelToken = null;
        error ? reject(error) : resolve(token);
      };
      const timeout = setTimeout(
        () =>
          finish(new Error("Weryfikacja trwa zbyt długo. Spróbuj ponownie.")),
        60000,
      );
      cancelToken = () =>
        finish(new Error("Weryfikacja została przerwana. Spróbuj ponownie."));
      try {
        tokenWidget = window.turnstile.render($(".jc-verification"), {
          sitekey: config.siteKey,
          action,
          execution: "execute",
          appearance: "interaction-only",
          language: "pl",
          size: "flexible",
          callback: (token) => finish(null, token),
          "error-callback": () => {
            finish(
              new Error("Weryfikacja nie powiodła się. Spróbuj ponownie."),
            );
            return true;
          },
          "expired-callback": () =>
            finish(new Error("Weryfikacja wygasła. Spróbuj ponownie.")),
        });
        window.turnstile.execute(tokenWidget);
      } catch {
        finish(new Error("Nie można uruchomić weryfikacji. Spróbuj ponownie."));
      }
    });
  }

  $(".jc-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !config?.enabled) return;
    const question = input.value.trim();
    if (!question) {
      input.focus();
      return say("Wpisz pytanie lub skorzystaj z dyktowania.");
    }
    if (question.length > 2000) return say("Skróć pytanie do 2000 znaków.");
    setBusy(true);
    const pending = message("user", question);
    try {
      const token = await getToken("chat");
      say("Asystent przygotowuje odpowiedź…");
      const messages = [
        ...history.slice(-12),
        { role: "user", content: question },
      ];
      const data = await request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, token }),
      });
      history = [...messages, { role: "assistant", content: data.answer }];
      message("assistant", data.answer);
      $(".jc-starters")?.remove();
      input.value = "";
      say("");
    } catch (error) {
      pending.remove();
      say(error.name === "TimeoutError" ? "Odpowiedź trwa zbyt długo. Spróbuj ponownie lub napisz do Juliana." : `Nie wysłano pytania. ${error.message}`);
    } finally {
      setBusy(false);
      if (!panel.hidden) input.focus();
    }
  });

  async function startRecording() {
    if (busy) return;
    setBusy(true);
    say("Zezwól na mikrofon, aby podyktować pytanie.");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (panel.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        setBusy(false);
        say("");
        return;
      }
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      let size = 0,
        seconds = 0;
      discardRecording = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          size += event.data.size;
        }
        if (size > 5 * 1024 * 1024 && recorder.state === "recording") {
          discardRecording = true;
          recorder.stop();
          say("Nagranie jest za duże. Spróbuj krótszej wypowiedzi.");
        }
      };
      recorder.onerror = () => {
        discardRecording = true;
        say("Mikrofon przestał działać. Wpisz pytanie.");
        stopTracks();
        setBusy(false);
      };
      recorder.onstop = async () => {
        const type = recorder.mimeType;
        stopTracks();
        mic.setAttribute("aria-pressed", "false");
        mic.querySelector("span").textContent = "Dyktuj";
        if (discardRecording) {
          setBusy(false);
          if (panel.hidden) say("Nagrywanie anulowane.");
          return;
        }
        try {
          const token = await getToken("transcribe");
          say("Rozpoznawanie mowy…");
          const form = new FormData();
          form.set("audio", new Blob(chunks, { type }), "pytanie");
          form.set("token", token);
          const data = await request("/api/transcribe", {
            method: "POST",
            body: form,
          });
          input.value = data.text;
          say("Sprawdź rozpoznany tekst i kliknij „Wyślij”.");
        } catch (error) {
          say(error.message);
        } finally {
          setBusy(false);
          if (!panel.hidden) input.focus();
        }
      };
      recorder.start(1000);
      mic.setAttribute("aria-pressed", "true");
      mic.querySelector("span").textContent = "Zatrzymaj";
      controls();
      say("Nagrywanie 0/60 s. Po zatrzymaniu audio trafi do Groq.");
      timer = setInterval(() => {
        seconds += 1;
        say(`Nagrywanie ${seconds}/60 s. Po zatrzymaniu audio trafi do Groq.`);
        if (seconds >= 60 && recorder.state === "recording") recorder.stop();
      }, 1000);
    } catch {
      stopTracks();
      setBusy(false);
      say(
        "Nie można uruchomić mikrofonu. Sprawdź uprawnienia lub wpisz pytanie.",
      );
    }
  }
  function stopTracks() {
    clearInterval(timer);
    stream?.getTracks().forEach((track) => track.stop());
  }
  mic.addEventListener("click", () => {
    if (recorder?.state === "recording") recorder.stop();
    else if (input.value.trim())
      say("Wyślij lub usuń wpisany tekst, zanim podyktujesz nowe pytanie.");
    else startRecording();
  });
  window.addEventListener("pagehide", () => {
    discardRecording = true;
    stopTracks();
    cancelToken?.();
  });
  welcome();
})();
