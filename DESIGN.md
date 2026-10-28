# Asystent strony Juliana

Tryb Implement, profil LIGHT: nowy widget w istniejącym portfolio.
Odbiorcy: potencjalni klienci i partnerzy. Charakter: rzeczowy, spokojny,
przystępny. Mała gęstość informacji. Główna akcja: zadać pytanie o współpracę.
Cel: zaufanie i łatwy kontakt z Julianem.

Zachowujemy minimalizm strony: --paper, --surface, --ink, --muted, --blue,
--line oraz --font z assets/style.css. Systemowy font pozwala czytać rozmowę
tak samo wygodnie jak treść portfolio. Bez nowego stylu lub dodatkowych fontów.
Układ: przycisk w prawym dolnym rogu, nad nim panel rozmowy; na telefonie
panel zajmuje dostępną wysokość, z miejscem na klawiaturę ekranową.

Istniejący system ma promienie 4/8/12px i przyciski 999px. Widget stosuje
12px dla panelu i wiadomości, 8px dla pola, 999px dla głównego przycisku.
Odstępy bazują na 4/8/12/16/20/24/32px. Nowe tokeny komponentu: rozmiary
panelu, bezpieczny obszar ekranu i cień sygnalizujący warstwę nad stroną.
Brak ciemnego motywu w istniejącej stronie — widget pozostaje jasny.

Stany: powitanie, pytanie, oczekiwanie, błąd z zachowaniem pytania, brak
konfiguracji z kontaktem, weryfikacja, nagrywanie, transkrypcja, wyczyszczenie.
Nagranie jest wysyłane do Groq po zatrzymaniu. Transkrypcja trafia do pola
edycji. Dopiero świadome wysłanie przekazuje pytanie do Gemini.
Brak automatycznego odtwarzania i otwierania. Bez trwałego zapisu rozmów.
Klawiatura: Escape zamyka, fokus wraca do przycisku, Shift+Enter daje nową linię.
Panel jest regionem niemodalnym — strona pozostaje dostępna klawiaturą.
