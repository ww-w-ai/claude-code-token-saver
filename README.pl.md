# cc-token-saver

> **Claude Code ciągle Cię odcina? To się skończyło.**
>
> Wydawaj mniej, koduj dłużej i sprawdzaj dokładnie, na co idą Twoje tokeny — zero konfiguracji.

Jak? Automatyczne zarządzanie kontekstem, śledzenie kosztów w czasie rzeczywistym i sterowanie sesją z uwzględnieniem cache — wszystko w jednym pluginie.

---

## 😤 Problem: $200/mies. i wciąż nie możesz pracować

Claude Code Max Plan ($200/mies.). Powinno wystarczyć. Nie wystarcza.

**5-godzinne okno rate limit.** Jesteś w pełnym flow i nagle stop. Żadnego timera. Żadnego ETA. Po prostu czekaj.

**Wygasanie cache.** Wracasz z lunchu. Minęła ponad godzina. Wysyłasz jeden prompt i 900K tokenów jest ponownie wysłanych po pełnej cenie. Koszt? $9 za jednym razem.

**Niewidoczne koszty.** Nie ma sposobu, żeby zobaczyć, ile wydajesz w czasie rzeczywistym. Dowiadujesz się dopiero, gdy uderzy rate limit.

**Wszystko ręcznie.** Rozmiar kontekstu, wygasanie cache, delegowanie SubTask, czyszczenie sesji. Nikt nie jest w stanie tego śledzić i jednocześnie pisać kod.

cc-token-saver załatwia to wszystko automatycznie. **Zainstaluj raz. Gotowe.**

---

## 🚀 Instalacja

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Działa automatycznie po instalacji. Zero konfiguracji. Wymaga [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Aby włączyć monitoring na żywo:

```
/setup-statusline install
```

---

## 🛡️ Funkcja 1: Token Guardian

**Wykrywa wygaśnięcie cache i automatycznie blokuje kosztowne ponowne wysyłki.**

Cache promptów Claude Code ma TTL 1 godziny. Odejdziesz na dłużej niż godzinę — cache wygasa. Następna wiadomość ponownie wysyła cały context po pełnej cenie. Przy 900K token to $9 za jednym razem.

Token Guardian śledzi, kiedy otrzymano ostatnią odpowiedź. Jeśli minęło więcej niż 3 590 sekund (TTL minus 10-sekundowy bufor), blokuje prompt i wyświetla ostrzeżenie.

```
🚨 Pamięć podręczna wygasła (68m 23s bezczynności)

Pamięć podręczna wygasła. Kontynuowanie wyśle ponownie cały kontekst.
Koszt może znacząco wzrosnąć.

👉 /context — Sprawdź bieżące użycie kontekstu przed podjęciem decyzji
👉 /clear → /continue — Zresetuj, potem przywróć poprzedni kontekst (zalecane, najniższy koszt)
👉 Wyślij ponownie — Kontynuuj jak jest (pełny koszt ponownego cache zostanie naliczony)
```

Wystarczy ponownie wysłać ten sam prompt po ostrzeżeniu — przejdzie. Ostrzeżenie pojawia się tylko raz na okres bezczynności, więc nigdy nie irytuje. Komunikaty ostrzeżeń wyświetlają się w 23 językach na podstawie locale systemu.

**Rezultat:** Kosztowne ponowne cachowanie jest automatycznie blokowane. Zero wysiłku.

---

## 🧠 Funkcja 2: Smart Session Architecture

**Zainstaluj, a zoptymalizowane kosztowo wzorce pracy uruchomią się automatycznie.**

Większość użytkowników robi wszystko w Main session. Odczyt plików, generowanie kodu, uruchamianie testów. Wszystko piętrzy się w kontekście i jest ponownie wysyłane z każdą wiadomością. Sesja puchnie. Koszty rosną lawinowo.

Session Architect automatycznie wstrzykuje strategię delegowania przy starcie sesji.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rola             | Projektowanie, decyzje, przegląd  | Implementacja, generowanie kodu, multi-file |
| Warstwa cache    | 1 godzina (ephemeral_1h)          | 5 min                                 |
| Koszt zapisu cache | ＄10/MTok                        | ＄6.25/MTok                            |
| Rozmiar context  | ~94K śr.                          | ~33K śr.                              |

SubTask mają **37,5% tańszy zapis cache** niż Main. Kontekst jest też znacznie mniejszy. Delegowanie ciężkiej pracy do SubTask drastycznie obniża koszty.

**Rezultat:** Claude automatycznie pracuje w kosztowo efektywnym wzorcu. Nie musisz o tym myśleć.

---

## 🪶 Tryb Zwięzły

**Ta sama treść. Mniej wypełnienia. Domyślnie włączone.**

Ten sam hook SessionStart wstrzykuje także regułę stylu odpowiedzi, która działa w **każdej sesji i każdym modelu** — bez flag, bez konfiguracji. Trzy rzeczy się zmieniają:

- **Preambuła wycięta** — żadnego "Pozwól mi sprawdzić…", "Teraz zrobię…", powtarzania twojego pytania, ani podsumowywania tego, co diff już pokazuje
- **Odpowiedni format dla treści** — punkty dla list, proza dla rozumowania (kompromisy, przyczynowość, uzasadnienia). Żadne nie jest wymuszane
- **Bardziej zwarty wyraz** — ta sama myśl, mniej słów. Jaśniejsza proza to krótsza proza

Twarda granica: nigdy nie usuwaj treści, nie pomijaj weryfikacji, nie ściskaj niuansu w jedno zdanie. Esencja pozostaje pełna; kurczy się tylko opakowanie.

Zainstaluj raz, działa wszędzie.

---


## 🔄 Funkcja 3: /continue — Przywracanie context

**Zastępuje `/compact`. Zero wywołań LLM. Zero kosztów tokenów.**

`/compact` wysyła cały kontekst (~1M tokenów) do LLM w celu kompresji do 3,3% streszczenia. Jeśli cache wygasł, samo to wywołuje pełne ponowne cachowanie. Utrata informacji jest nieunikniona.

`/continue` działa zupełnie inaczej. Przetwarza transkrypt poprzedniej session i ładuje go bezpośrednio. Bez wywołania LLM. Bez kosztów. Oryginalna rozmowa jest przywracana bez zmian.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Jak działa              | Wysyła cały context do LLM w celu streszczenia | Przetwarza transkrypt, wczytuje bezpośrednio |
| Wywołania LLM           | Wymagane (zwykle 100K+ token)    | 0                                |
| Koszt token             | Wysoki                            | 0                                |
| Utrata informacji       | Tak (3,3% streszczenie)           | Brak (oryginał zachowany)        |
| Szybkość przetwarzania  | Dziesiątki sekund                 | < 1 sek (nawet pliki 60MB+)     |
| Gdy cache wygasł        | Dodatkowy koszt pełnego ponownego cachowania | Brak wpływu              |
| Przywracanie wielu session | Niemożliwe                     | Obsługiwane                      |

Użycie: `/clear`, potem `/continue`. Zobaczysz listę poprzednich session. Wybierz jedną do przywrócenia. Szybkie odzyskiwanie: `/continue last`.

**Rezultat:** Wznów poprzednią pracę za zero kosztów. Bez utraty informacji.

---

## 📊 Funkcja 4: Live Status Line

**Monitoring token/kosztów w czasie rzeczywistym. Poniżej 50ms narzutu.**

Uruchom `/setup-statusline install` raz, a na dole Claude Code pojawi się stały pasek statusu.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Wskaźnik         | Co pokazuje                         | 🟢 Normalny | 🟡 Ostrzeżenie | 🔴 Krytyczny |
| ---------------- | ----------------------------------- | ----------- | -------------- | ------------ |
| RUN (delta)      | Koszt ostatniego wywołania API      | < ＄0.30    | >= ＄0.30       | >= ＄1.00     |
| RUN (skumulowany) | Skumulowany koszt dla tego folderu | —           | —              | —            |
| 5H               | Użycie 5-godzinnego okna + odliczanie do resetu | < 70% | >= 70%    | >= 90%       |
| CTX              | Użycie okna context                 | < 35%       | >= 35%         | >= 70%       |

Gdy którykolwiek wskaźnik osiągnie poziom ostrzeżenia lub krytyczny, automatycznie pojawi się podpowiedź `→ /usage-view current`.

Aby usunąć: `/setup-statusline uninstall` (poprzednia konfiguracja zostanie automatycznie przywrócona).

**Rezultat:** Sprawdź stan kosztów jednym rzutem oka. Działaj, zanim będzie za późno.

---

## 📈 Panel użycia (/usage-view)

**Wreszcie odpowiedź na pytanie: „Dlaczego mnie odcięło?"**

Do tej pory uderzenie w rate limit po prostu wkurzało. Żadnego sposobu, żeby poznać przyczynę. Która sesja spaliła najwięcej tokenów? Kiedy koszty skoczyły? Jakie wzorce kryją się w Twoim użyciu? Wszystko niewidoczne.

`/usage-view` pokazuje wszystko. W przeglądarce otwiera się interaktywny panel HTML, pozwalający analizować wzorce użycia i śledzić źródło skoków kosztów. Żadnych zewnętrznych zależności. Działa samodzielnie. Można udostępnić jako plik.

Co zawiera:

- Trendy kosztów dziennych / godzinowych / wg dnia tygodnia — zobacz, kiedy spalasz najwięcej token
- Podział token (input, output, cache write, cache read) — zobacz, co napędza koszty
- Analiza kosztów per session — wskaż, które zadania były drogie
- Oś czasu 5-godzinnego okna (subskrybenci Max Plan) — śledź wyzwalacze rate limit
- Analiza wglądów oparta na AI — interpretuje dane i sugeruje ulepszenia
- 23 obsługiwane języki (RTL w zestawie; wykresy/tabele pozostają LTR)

```
/usage-view                  # Cały czas, wszystkie projekty
/usage-view current          # Tylko bieżące 5-godzinne okno
/usage-view last 7 days      # Ostatnie 7 dni
/usage-view locale pl        # Polski
```

---

## 🔬 Badanie rate limit (/report-limit)

**Projekt społecznościowy mający na celu odtworzenie formuły rate limit.**

Anthropic nie publikuje dokładnej formuły dla 5-godzinnego okna. Ustalmy to razem.

Gdy trafisz na rate limit, uruchom `/report-limit`. Twoje bieżące dane użycia zostaną automatycznie przesłane jako GitHub Discussion. Im więcej danych zbierzemy, tym wyraźniejsza staje się formuła.

---

## ✂️ Funkcja 5: /setup-git-lite — Przytnij wbudowane instrukcje Git CC

**Ukryte 2 200 tokenów na sesję, za które płacisz, nie wiedząc o tym.**

### Odkrycie

12 kwietnia 2026 r. [zgłoszenie na GitHubie](https://github.com/anthropics/claude-code/issues/47107) ujawniło, że wbudowane ustawienie `includeGitInstructions` w Claude Code po cichu spala tokeny w każdej sesji. Niezależna reprodukcja za pomocą [tego gista (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) potwierdziła liczby: **+6 031 tokenów w zapisach cache** na sesję po każdym commicie git, **+1 690 tokenów w odczytach cache** przy każdym wywołaniu API.

### Analiza źródła CC — gdzie trafiają tokeny

Prześledziliśmy tokeny do dwóch niezależnych punktów wstrzyknięcia w źródle Claude Code (v2.1.88):

**1. Migawka `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` zbiera gałąź + główną gałąź + user.name + pełny status (do 2000 znaków) + **ostatnie 5 commitów**
- Łączone i dołączane do system prompt przez `appendSystemContext` (`utils/api.ts:437`)
- Każdy nowy commit, każdy nowy zmodyfikowany plik, każde przełączenie gałęzi zmienia tekst → unieważnienie prefix cache

**2. Instrukcje workflow commit/PR (~1 700 tok) — opis narzędzia Bash**
- `tools/BashTool/prompt.ts:53` dołącza ponad 60 linii protokołu bezpieczeństwa, krok po kroku procedurę commitowania, przykłady HEREDOC i szablony tworzenia PR do opisu narzędzia `Bash`
- Buforowane razem z system prompt, ale przesyłane jako parametr `tools[]`

### Dlaczego to jest kosztowne

Struktura cache (`utils/api.ts:321` `splitSysPromptPrefix`) ma trzy ścieżki w zależności od tego, czy masz aktywne narzędzia MCP:

- **Path A** (aktywne MCP — większość użytkowników): `gitStatus` znajduje się wewnątrz bloku `cacheScope: 'org'`. Każda zmiana → cały blok jest ponownie buforowany przy następnym starcie sesji → chybienie `cache_create` na 6K tok.
- **Path B** (brak MCP): `gitStatus` trafia do dynamicznego bloku `cacheScope: null`, co oznacza, że jest przesyłany jako świeże `input_tokens` przy każdym wywołaniu API — brak chybień cache, ale też brak oszczędności cache.
- **Path C** (dostawca 3P / eksperymentalne bety wyłączone): tak samo jak Path A.

W typowych sesjach interaktywnych instrukcje commit/PR (1,7K tok) narastają **przy każdym wywołaniu API** przez `cache_read`. Przez sesję ze 100 wywołaniami przy cenniku Opus 4.7 to z grubsza **~$0,08 na sesję** tylko za instrukcje, które trening Claude i tak w większości obejmuje.

### Jak cc-token-saver to obsługuje

`/setup-git-lite` wyłącza natywną ścieżkę i wstrzykuje **starannie dobrany zamiennik o 280 tokenach** przez hook SessionStart. Zachowaliśmy dokładnie to, co nadpisuje domyślne zachowanie Claude (zasady bezpieczeństwa), i usunęliśmy wszystko, co Claude już wie z treningu (krok po kroku workflow, szablony PR, wzorce użycia gh).

**Zachowane — 11 krytycznych reguł nadpisujących** (te, które zamieniają domyślną pomocność Claude w ostrożność):
- Nigdy nie commituj/pushuj/amend/PR/tag/merge bez wyraźnej prośby użytkownika
- Nigdy nie pomijaj hooków, nie wykonuj force-push do main/master, nie uruchamiaj destrukcyjnych operacji, nie modyfikuj git config
- Nigdy nie commituj plików pasujących do `.env`, `credentials`, `*.pem`, `secret.*`
- Unikaj `git add -A` / `git add .`
- HEREDOC dla wieloliniowych komunikatów commit + trailer `Co-Authored-By: Claude`
- Nigdy nie używaj interaktywnych flag (-i), brak pustych commitów
- Jeśli pre-commit hook nie powiedzie się → utwórz NOWY commit (nie `--amend`)

**Usunięte** — krok po kroku workflow commitowania (3 kroki), krok po kroku workflow PR (3 kroki), szablon tytułu/treści PR, odwołania do poleceń `gh`, ostrzeżenie o fladze `-uall`, ostrzeżenie o `--no-edit` z rebase, ograniczenie `NEVER use TodoWrite or Agent tools during commit`. To jest gadatliwość workflow, którą Claude poprawnie składa z samego treningu.

**Dodane** — zwięzła linia stanu git: gałąź + skrócone SHA HEAD + treść + bieżący status (do 20 zmodyfikowanych plików, w przeciwnym razie liczba). Brak listy ostatnich commitów (Claude może uruchomić `git log` na żądanie).

### Oczekiwane oszczędności (cennik Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Element | Oryginał | Z setup-git-lite | Zaoszczędzono |
| ------- | -------- | ---------------- | ------------- |
| Ładowanie system prompt (na nową sesję) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Powtarzające się wywołania w tej samej sesji | ~1 700 tok cache_read/wywołanie | ~280 tok cache_read/wywołanie | ~1 420 tok/wywołanie |
| 100 wywołań na sesję (Opus 4.7) | — | — | **~$0,11 zaoszczędzone** |
| 20 sesji/dzień × 22 dni robocze | — | — | **~$48 zaoszczędzone/mies.** |

### Użycie

```bash
/setup-git-lite status     # Diagnostyka tylko do odczytu — bieżący stan + co by się zmieniło
/setup-git-lite install    # Wyłącz natywne CC + włącz nasz minimalny hook
/setup-git-lite revert     # Przywróć domyślne (agresywne; patrz niżej)
/setup-git-lite dismiss-banner    # Wycisz okazjonalną wskazówkę z rekomendacją
/setup-git-lite undismiss-banner  # Ponownie włącz wskazówkę
/setup-git-lite help       # Pełne użycie
```

### Semantyka instalacji

`install` modyfikuje **dwa** miejsca dla niezawodności:

1. `~/.claude/settings.json` — dodaje `"includeGitInstructions": false`
2. Profil powłoki (`~/.zshrc`, `~/.bashrc` itp.) — dołącza blok znacznikowy eksportujący `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Każde z nich osobno wystarczy do wyłączenia natywnego CC; ustawiamy oba, żeby nadpisanie przez zmienną środowiskową nie przywróciło przypadkowo natywnego zachowania. Zmiana powłoki obowiązuje tylko w nowych powłokach.

### Semantyka przywracania — agresywna

`revert` **usuwa WSZYSTKIE eksporty `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` z Twojego profilu powłoki**, w tym te, które mogłeś dodać ręcznie przed instalacją tego skilla. Jest to celowe — uruchomiłeś `revert`, więc przywracamy czyste domyślne. Zawsze najpierw tworzymy kopię zapasową profilu powłoki z sygnaturą czasową.

Jeśli potrzebujesz tej zmiennej środowiskowej z niezwiązanych powodów, zanotuj ją przed uruchomieniem `revert` i dodaj ponownie po nim.

### Przed odinstalowaniem cc-token-saver

**Najpierw uruchom `/setup-git-lite revert`**, inaczej zostanie Ci `includeGitInstructions: false` w settings.json, ale bez zastępczego hooka (Claude nie otrzymuje żadnych wskazówek git). Claude Code nie ma obecnie hooka cyklu życia do odinstalowywania pluginów, więc nie możemy tego zautomatyzować.

### Kompromisy

Co tracisz (i dlaczego zazwyczaj jest to w porządku):
- Claude nie otrzymuje już wstępnie obliczonego `git status` / `git log -n 5` przy starcie sesji. Jeśli zapytasz „co się zmieniło?" w nowej sesji, Claude uruchomi te polecenia samodzielnie (jedno dodatkowe wywołanie narzędzia, ~300 tok).
- Claude nie widzi już kanonicznej 3-krokowej procedury commitowania CC. W naszych testach na setkach przepływów commitowania wiedza na poziomie treningu radzi sobie z krytycznymi przypadkami (formatowanie HEREDOC, brak `--amend`, brak force-push), ponieważ zachowujemy te jako jawne reguły.
- Szablon treści PR (`## Summary` + `## Test plan`) nie jest wstrzykiwany. Jeśli zależy Ci dokładnie na tym formacie, umieść go w CLAUDE.md swojego projektu.

### Baner rekomendacji

Gdy natywne instrukcje git CC są nadal aktywne na Twoim komputerze, cc-token-saver pokazuje jednoparagrafową wskazówkę przy starcie sesji **~20% czasu** (plus w wynikach `/usage-view` i `/report-limit`). Wycisz na stałe za pomocą `/setup-git-lite dismiss-banner`.

---

## 💡 Jak naprawdę działa cache

Claude Code wysyła całą historię konwersacji do modelu przy każdym wywołaniu API. „Wywołanie API" nie oznacza „jednej wiadomości, którą wpisałeś". Pojedynczy prompt wywołuje wewnętrzne narzędzia — Grep, Read, Edit, Write — a każde z nich to osobne wywołanie API. Jeden prompt może łatwo wygenerować 10+ wywołań API.

Cache promptów redukuje ten koszt o 90%. Ale cache ma swój czas życia.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 godzina (ephemeral_1h)             | 5 min                                  |
| Zapis cache         | ＄10/MTok                             | ＄6.25/MTok                             |
| Odczyt cache        | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Gdy cache wygaśnie  | Cały context wysłany ponownie po pełnej cenie | Niski wpływ (context jest mały)  |

Nawet z aktywnym cache koszty się kumulują. Oto ekstremalny scenariusz pokazujący różnicę.

### Scenariusz: Cały dzień kodowania (3h rano → 2h lunch/spotkanie → 3h po południu)

Warunki: cennik Opus 4, 1 prompt na minutę, ~5 wywołań API na prompt (~300 wywołań/godzinę).

#### ❌ Bez cc-token-saver

Większość pracy odbywa się w Main session. Context rośnie szybko.

| Faza        | Sytuacja                          | Rozmiar context              | Koszt                                  |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Rano 3h     | Kodowanie (głównie w Main)        | 100K → 600K (śr. 350K)      | 900 wywołań × 350K × ＄0.50/M = ＄157.50 |
| Lunch/spot. | Przerwa na 2 godziny             | —                            | —                                      |
| Powrót      | Cache wygasł → pełne ponowne wysłanie | 600K pełna cena          | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Powrót      | /compact (streszczenie)           | 600K → wysłane do LLM       | 600K × ＄0.50/M + wyjście streszczenia = ~＄1.50 |
| Po poł. 3h  | Kodowanie kontynuowane (context rośnie) | 100K → 600K (śr. 350K) | 900 wywołań × 350K × ＄0.50/M = ＄157.50 |
|             | Razem                             |                              | ~＄326                                  |

> Przy takim poziomie użycia prawdopodobnie trafisz na rate limit 5-godzinnego okna. **Koszt jest zły, ale prawdziwy problem to całkowite zatrzymanie pracy. To jest dokładnie ten moment, kiedy Claude Code gaśnie.**

#### ✅ Z cc-token-saver

Ciężka praca jest delegowana do SubTask. Main obsługuje tylko projektowanie/decyzje.

| Faza        | Sytuacja                                     | Rozmiar context               | Koszt                              |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Rano 3h     | Kodowanie (Main: projektowanie, SubTask: implementacja) | Main 100K → 300K (śr. 200K) | 900 wywołań × 200K × ＄0.50/M = ＄90 |
| Lunch/spot. | Przerwa na 2 godziny                         | —                             | —                                  |
| Powrót      | ⚡ Token Guardian blokuje → /clear + /continue | —                           | ＄0 (zero wywołań LLM)             |
| Po poł. 3h  | Kodowanie kontynuowane                       | Main 100K → 300K (śr. 200K)  | 900 wywołań × 200K × ＄0.50/M = ＄90 |
|             | Razem                                        |                               | ~＄180                              |

#### 💰 Rezultat

> **＄326 → ＄180. ＄146 oszczędności dziennie (45%).**
>
> Nie chodzi tylko o koszty. Mniej token w tym samym czasie oznacza, że **nie trafiasz na rate limit i możesz dalej pracować.** To jest prawdziwa różnica.

### Gdzie wkracza cc-token-saver

```
[Start session]
    │
    ├─ Session Architect → Automatyczne wstrzyknięcie wzorca delegowania SubTask
    │                       Utrzymuje context Main poniżej 250K
    │
[Praca]
    │
    ├─ Status Line → Monitoring kosztów/context/rate limit w czasie rzeczywistym
    │                  Natychmiastowy alert przy wejściu w strefę ostrzegawczą
    │
[1+ godzina bezczynności]
    │
    ├─ Token Guardian → Wykrywa wygaśnięcie cache, blokuje przed ponownym wysłaniem
    │
[Restart session]
    │
    └─ /continue → Przywraca poprzedni context za zero kosztów (zero wywołań LLM)
```

---

## 🔧 Instalacja ze źródeł i personalizacja

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver jest w pełni otwarty. Cały kod źródłowy to zwykły JavaScript + skrypty Bash zgodne ze standardową strukturą pluginu. Modyfikuj, co chcesz.

- **hooks/** — Zmień próg wygaśnięcia cache, dostosuj komunikaty ostrzeżeń, modyfikuj reguły architektury session
- **scripts/** — Logika analizy, kreator raportów, formatowanie paska statusu
- **skills/** — Jak działają /continue i /usage-view, szablony promptów
- **locales/** — Dodaj/edytuj tłumaczenia, dodaj nowe języki
- **skills/usage-view/** — Zmiany UI/UX panelu

Zrób to po swojemu. Sforkuj, eksperymentuj i wyślij PR, jeśli znajdziesz coś lepszego.

---

## 🌐 Obsługiwane języki

23 obsługiwane języki. Wybrane przez skrzyżowanie 20 krajów z największym użyciem Claude Code z 20 językami o największej liczbie użytkowników na świecie. Język wyświetlania jest automatycznie wykrywany z locale systemu. Można też ustawić ręcznie: `/usage-view locale pl`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Obecne tłumaczenia zostały wygenerowane przez AI. Poprawki od rodzimych użytkowników języka są mile widziane — edytuj plik JSON dla swojego języka w `locales/` i wyślij PR.

---

## 💡 Wskazówki

### Zrozum cache, a zobaczysz, na co idą pieniądze

- **1 prompt ≠ 1 wywołanie API.** Za każdym razem, gdy Claude wywołuje Grep, Read lub Edit, cały context jest ponownie wysyłany. Pojedynczy prompt łatwo generuje 10+ wywołań API. Pisz jasne prompty, aby zmniejszyć zbędne wywołania narzędzi i obniżyć koszty.
- **Timer cache resetuje się od ostatniego wywołania API, nie od Twojego ostatniego promptu.** Pracuj dalej, a cache nigdy nie wygaśnie. Niebezpieczeństwo to odejście od komputera. Token Guardian blokuje automatycznie raz, więc po powrocie możesz wybrać: zresetować context lub kontynuować.
- **Rozmiar context = mnożnik kosztów.** To samo wywołanie API przy 200K vs 800K kosztuje 4x więcej. Gdy wskaźnik [CTX] na pasku statusu przekroczy 35% (🟡), to sygnał, żeby więcej delegować do SubTask.

### Nawyki, które obniżają koszty

- **Trzymaj CLAUDE.md odchudzony.** Ładuje się do system prompt przy każdym wywołaniu API. Każda linijka kosztuje pieniądze.
- **Deleguj ciężką pracę do SubTask.** Generowanie kodu, edycja wielu plików, uruchamianie testów nie powinny być w Main. SubTask mają mniejszy context i tańszą warstwę cache.
- **Przerwa dłuższa niż godzina?** `/clear` → wróć → `/continue`. Context przywrócony za $0.
- **[5H] powyżej 70% (🟡)?** Zwolnij. Przejdź na lekkie zadania przeglądu lub zwiększ delegowanie do SubTask, aby zmniejszyć liczbę wywołań API w Main.
- **Używaj `/btw` do pytań pobocznych.** Nie wchodzi do historii konwersacji, więc Twój context pozostaje szczupły.

---

## Licencja

Apache-2.0
