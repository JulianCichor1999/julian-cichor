# Julian Cichor

Strona Juliana Cichora z asystentem AI pomagającym wybrać obszar współpracy.

## Zawartość

- `index.html` — główna strona wizytówki
- `assets/` — zdjęcia oraz arkusz stylów użyte na stronie
- `assets/assistant.js`, `assets/assistant.css` — widget rozmowy i dyktowanie
- `functions/api/[[path]].js` — API w Cloudflare Pages Functions
- `server/` — obsługa Gemini, Groq i sprawdzona baza wiedzy
- `tests/` — testy API bez kluczy i bez płatnych wywołań

## Uruchomienie

Samą stronę można otworzyć jako `index.html`. Asystent wymaga serwera HTTPS
z Pages Functions i konfiguracji opisanej poniżej. Kod nie zawiera kluczy.

```powershell
npm test
npm run build
npx wrangler pages dev dist
```

Lokalne klucze można umieścić w ignorowanym pliku `.dev.vars` obok
`wrangler.toml`. Nie umieszczaj tego pliku w katalogu publicznym `dist/`.

## Wdrożenie na istniejącym Cloudflare Pages

1. W projekcie **julian-cichor** ustaw komendę budowania `npm run build`
   i katalog wynikowy `dist`. Framework: None. Zachowaj obecną domenę
   i połączenie z repozytorium. Nie wymaga zmian DNS ani konfiguracji OVH.
2. W Cloudflare Turnstile utwórz widget typu Managed dla `juliancichor.pl`
   i `www.juliancichor.pl`. Jeśli testujesz na podglądzie Pages, dodaj też
   konkretną domenę podglądu. Nie używaj kluczy testowych w produkcji.
3. W Pages → Settings → Variables and Secrets dodaj:

   | Nazwa | Rodzaj | Wartość |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | Secret / Encrypt | klucz z Google AI Studio |
   | `GROQ_API_KEY` | Secret / Encrypt | klucz z Groq |
   | `TURNSTILE_SECRET_KEY` | Secret / Encrypt | tajny klucz Turnstile |
   | `TURNSTILE_SITE_KEY` | Text | publiczny klucz widgetu Turnstile |
   | `GEMINI_MODEL` | Text, opcjonalne | domyślnie `gemini-3.8-flash` |

   Ustaw sekrety osobno dla Production i Preview, jeśli chcesz korzystać
   z API w podglądzie. Klucz modelu musi mieć dostęp do wybranego modelu.
   Bez klucza Groq można używać rozmowy tekstowej.
4. Wdróż ponownie po ustawieniu sekretów. Functions są kompilowane
   z katalogu `functions/` w repozytorium; nie kopiuj ich ręcznie do `dist`.
   Wgrywanie folderu przez przeciągnięcie do panelu nie zastępuje tego procesu.
5. Sprawdź na telefonie i komputerze pytanie o ofertę, pytanie o nieznaną
   cenę, dyktowanie, odmowę dostępu do mikrofonu i kontakt e-mail.

Brak kluczy lub konfiguracji Turnstile blokuje płatne API i pokazuje kontakt.
`/api/config` zwraca jedynie stan asystenta i publiczny site key.
Budowanie kopiuje wyłącznie pliki publiczne do `dist`; kod serwera i lokalne
sekrety nie są publikowane jako pliki statyczne. Przed scaleniem zmiany
ustaw powyższą komendę budowania w Cloudflare.

## Zachowanie i utrzymanie

Asystent korzysta z Gemini do odpowiedzi, a z `whisper-large-v3-turbo` w Groq
do transkrypcji po polsku. Nagranie trwa do 60 sekund i ma limit 5 MB.
Tekst po rozpoznaniu pozostaje do edycji i wymaga osobnego wysłania.
Mikrofon wymaga HTTPS (lub localhost) i zgody użytkownika.

Baza `server/knowledge.mjs` jest opracowana z obecnej strony. Aktualizuj ją
wraz z ofertą; nie synchronizuje się automatycznie. Instrukcje zabraniają
wymyślania cen, terminów i realizacji, ale odpowiedzi modelu wymagają
sprawdzenia podczas próby z prawdziwym Gemini. Bot nie rezerwuje terminów
i nie wysyła wiadomości; kontakt prowadzi do programu pocztowego klienta.

Ostatnie 6 wymian jest wysyłanych z nowym pytaniem. Historia jest wyłącznie
w pamięci otwartej karty, do odświeżenia lub wyczyszczenia. Nasz kod nie
zapisuje ani nie loguje wiadomości i audio. Google, Groq i Cloudflare
przetwarzają dane zgodnie ze swoimi zasadami; brak bazy nie oznacza braku
przetwarzania przez dostawców. Informacja dla klienta jest dostępna w widżecie.

Turnstile jest sprawdzany na serwerze osobno dla każdej operacji, wraz
z domeną i akcją. Limitujemy też długość wiadomości, historię i pliki.
Turnstile i sprawdzenie Origin nie stanowią limitu wydatków ani pełnego
limitu zapytań. Ustaw limity zużycia w panelach Google i Groq; w razie
potrzeby dodaj regułę ograniczania ruchu na `/api/*` w Cloudflare.

Testy automatyczne korzystają z atrap odpowiedzi dostawców. Nie potwierdzają
jakości odpowiedzi prawdziwego modelu ani działania mikrofonu na urządzeniu.

Dokumentacja integracji: [Pages Functions](https://developers.cloudflare.com/pages/functions/),
[sekrety w Pages](https://developers.cloudflare.com/pages/functions/bindings/#secrets),
[Gemini generateContent](https://ai.google.dev/api/generate-content),
[Groq Speech to Text](https://console.groq.com/docs/speech-to-text),
[weryfikacja Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Kontakt

[julian.cichor@aol.com](mailto:julian.cichor@aol.com)
