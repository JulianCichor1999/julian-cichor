# Sprawdzenie asystenta — 28.10.2026

- 17 testów API: zaliczone. Testy używają atrap Google, Groq i Turnstile.
- `npm run build`: poprawne, publiczne pliki wyłącznie w `dist/`.
- `wrangler pages functions build` (4.154.0): kompilacja poprawna.
- Edge przez Playwright: szerokości 360, 390, 768 i 1440 px; bez poziomego
  przepełnienia, bez błędów JavaScript, kontrolki widgetu co najmniej 44×44 px.
- Sprawdzone: otwieranie i Escape z przywróceniem fokusu, wybór pytania,
  wysyłanie, tekstowe renderowanie odpowiedzi (również ciągu HTML), błąd
  z zachowaniem pytania, limit 6 wymian historii oraz nowa rozmowa.
- Sztuczny mikrofon przeglądarki: rozpoczęcie i zatrzymanie nagrania,
  transkrypcja w polu edycji, brak automatycznego pytania do Gemini.
- Lokalny runtime Pages: `/api/config` bez sekretów wyłącza asystenta;
  kod `server/assistant.mjs` nie jest udostępniany jako plik statyczny.
- Obejrzano render desktop, tablet, mobile oraz rozwiniętą informację o danych.

Profil wizualny LIGHT, ocena komponentu 82,6/100. Brak blokad anti-slop
w dodanym widżecie. Zachowana typografia, kolory i promienie strony.
Wyróżniki: pytania o współpracę z Julianem, stały kontakt do niego,
możliwość korekty polskiej transkrypcji. Pominięto dekoracyjny awatar,
animacje i dodatkowy ekran powitalny, aby zostawić miejsce na rozmowę.

Przed uruchomieniem produkcyjnym pozostają: ustawienia budowania w Pages,
prawdziwe sekrety i Turnstile oraz próba odpowiedzi z Gemini, transkrypcji
z Groq i mikrofonu na fizycznym telefonie. Testy z atrapami nie dowodzą
jakości odpowiedzi modelu, dostępu kluczy do usług ani poprawnej weryfikacji
przez rzeczywisty Turnstile.
