# Przewodnik po cache — dlaczego cache to główny składnik kosztów

W przypadku większości narzędzi do kodowania z AI lwia część kosztów pochodzi z operacji na cache (zapis + odczyt). Ten dokument wyjaśnia dlaczego tak jest i jak tym zarządzać.

## Sekret: każda wiadomość ponownie wysyła całą rozmowę

Duże modele językowe są **bezstanowe**. W przeciwieństwie do ludzi, modele AI nie „pamiętają" poprzedniej rozmowy — otrzymują pełną historię dialogu przy każdym zapytaniu.

Wygląda to jak czat, ale na poziomie API działa to tak:

```
[ Zapytanie 1 ]
→ Prompt systemowy + "Napraw tego buga"
← Odpowiedź AI

[ Zapytanie 2 ]
→ Prompt systemowy + "Napraw tego buga" + Odpowiedź AI + "Dodaj jeszcze testy"
← Odpowiedź AI

[ Zapytanie 3 ]
→ Prompt systemowy + "Napraw tego buga" + Odpowiedź AI + "Dodaj jeszcze testy" + Odpowiedź AI + "Zrób commit"
← Odpowiedź AI
```

Każde zapytanie zawiera **całą** poprzednią treść. Na przykład 50. zapytanie zawiera pełną rozmowę i wszystkie odpowiedzi AI z poprzednich 49 zapytań. Dlatego liczba tokenów wejściowych rośnie gwałtownie wraz z wydłużaniem się rozmowy.

Ponadto narzędzia do kodowania z AI wysyłają prompt systemowy (wbudowane instrukcje, pliki konfiguracyjne, pluginy, definicje narzędzi MCP itp.) z każdym zapytaniem — więc nawet jednoliniowa wiadomość generuje dziesiątki tysięcy tokenów wejściowych.

## Czym jest cache?

**Prompt caching** obniża koszt powtarzanej transmisji. Niezmienione części zapytania są przechowywane na serwerze, aby kolejne zapytania mogły z nich korzystać ze zniżką.

- **Cache Write**: koszt zapisania treści rozmowy na serwerze. Występuje przy pierwszym zapytaniu lub po wygaśnięciu cache.
- **Cache Read**: koszt ponownego wykorzystania już zapisanej treści. Naliczany ze **zniżką 90%** w porównaniu ze standardowym wejściem.

Narzędzia do kodowania z AI nieuchronnie generują długie rozmowy i duże konteksty — do 1 miliona tokenów na zapytanie. Nawet jeśli Twoje nowe pytanie jest krótkie, cała poprzednia rozmowa jest rozliczana razem z nim, więc koszty szybko narastają.

Aby zmniejszyć to obciążenie, wiodący dostawcy AI oferują zniżkę 90% na cache read, znacząco obniżając koszt retransmisji już przetworzonej treści.

## Dlaczego cache dominuje w całkowitym koszcie?

| Kategoria | Tokeny na wywołanie | Uwaga |
|---|---|---|
| Dane wejściowe użytkownika (nowe tokeny) | Dziesiątki-setki | To, co użytkownik faktycznie wpisuje |
| Wyjście AI | Setki-tysiące | Odpowiedź AI |
| **Cache read** | **100K–setki tysięcy** | Cała skumulowana rozmowa rozliczana przy każdym wywołaniu |

Wolumen cache read na wywołanie jest **tysiące razy** większy niż dane wejściowe. Nawet ze zniżką 90% cache read dominuje w wartościach bezwzględnych.

A te wywołania nie dotyczą tylko wiadomości od użytkownika:

| Inicjator | Częstotliwość | Cache Read na wywołanie |
|---|---|---|
| Wiadomości użytkownika | Przy wysyłaniu wiadomości | Cała skumulowana rozmowa |
| **Własne decyzje AI** | **Wiele wywołań na jedną wiadomość** | Cała skumulowana rozmowa |

Niewidocznie dla użytkownika AI wykonuje wiele decyzji sekwencyjnie dla jednej wiadomości — wybór narzędzia, interpretacja wyniku, decyzja o kolejnym kroku. Każda taka decyzja to pełne wywołanie LLM zawierające cały kontekst. Samo wykonanie narzędzi (odczyt plików, wyszukiwanie) odbywa się lokalnie, ale podejmowanie decyzji przed i po każdym użyciu narzędzia generuje koszty cache read.

### Dlaczego koszt Cache Write też jest wyższy niż oczekiwano?

W Anthropic koszt cache write wynosi 1,25x ceny wejścia (poziom 5-minutowy) lub 2x (poziom godzinny). Przy tych mnożnikach wydaje się, że cache write nie powinien przekraczać 2x kosztu wejścia/wyjścia — ale w praktyce cache write stanowi znacznie większy udział.

Dwa powody:

| Przyczyna | Wyjaśnienie |
|---|---|
| **Prompt systemowy** | Dziesiątki tysięcy tokenów zanim użytkownik cokolwiek napisze (z pluginami/MCP). Wszystko to podlega kosztom cache write |
| **Ponowne tworzenie po wygaśnięciu** | Po wygaśnięciu TTL (5 min / 1 godz.) cała skumulowana rozmowa musi zostać ponownie zcache'owana. Im dłuższa rozmowa, tym wyższy koszt ponownego tworzenia |

Innymi słowy, cache write nie dotyczy wyłącznie „nowych tokenów użytkownika". Przy starcie sesji cały prompt systemowy jest cache'owany; po wygaśnięciu cała skumulowana rozmowa staje się obiektem cache write. Jeśli cache 100K-tokenowej rozmowy wygaśnie, jedna wiadomość wygeneruje cache write na 100K tokenów jednorazowo.

**Właśnie dlatego plugin super-token-saver wyświetla ostrzeżenie o wygaśnięciu cache po 1 godzinie bezczynności.** Gdy pojawi się ostrzeżenie, sprawdź aktualny rozmiar kontekstu:

- **Mały kontekst**: koszt ponownego tworzenia cache jest niewielki. Kontynuuj pracę — koszty będą niskie.
- **Duży kontekst**: koszt cache będzie znaczący. Zalecamy `/clear`, a następnie `/s-continue last`, aby kontynuować w nowej sesji. Umiejętność continue automatycznie przywróci kontekst poprzedniej rozmowy, więc przepływ pracy nie zostanie przerwany.

## Strategie redukcji kosztów cache

Plugin super-token-saver został zaprojektowany do automatyzacji lub uproszczenia wszystkich tych strategii.

### 1. Utrzymuj mały kontekst — `/clear` + `/s-continue` ⭐

**To najważniejszy sposób na redukcję kosztów.** Wysokie koszty cache oznaczają, że otrzymujesz zniżkę 90% — to normalne. Ale jeśli kontekst niepotrzebnie rośnie i taki pozostaje, bezwzględny koszt na wywołanie wzrasta nawet ze zniżką. **Kontrolowanie rozmiaru kontekstu to najskuteczniejsza strategia zarządzania kosztami.**

Gdy temat się zmienia lub rozmowa jest długa, użyj `/clear` do resetu, potem `/s-continue last` do przywrócenia kontekstu. `/s-continue` przywraca poprzednie rozmowy bez wywołań LLM, więc koszt wynosi zero.

`/compact` zmniejsza kontekst przez streszczenie rozmowy, ale sam proces streszczania wymaga wywołań LLM i traci szczegóły rozmowy. Niezalecane.

### 2. Zapobieganie wygaśnięciu cache — Token Guardian (automatyczne)

Główna sesja Anthropic używa **godzinnego poziomu** cache. Po wygaśnięciu pierwsze zapytanie musi odtworzyć całą rozmowę jako cache write, co jest kosztowne.

super-token-saver wykrywa godzinną bezczynność i **automatycznie wyświetla ostrzeżenie**. Gdy pojawi się ostrzeżenie, najekonomiczniejszym podejściem jest użycie metody 1 powyżej (`/clear` + `/s-continue`), aby kontynuować w nowej sesji.

### 3. Deleguj ciężkie zadania do SubTasks

Zasobochłonne zadania jak generowanie kodu czy edycja wielu plików można delegować do SubTasks zamiast wykonywać je w głównej sesji. SubTasks używają 5-minutowego poziomu cache, co sprawia, że **cache write jest o 37,5% tańszy**, i działają w izolowanym mniejszym kontekście, zmniejszając wolumen cache read na wywołanie.

super-token-saver automatycznie kieruje do tego wzorca separacji pracy przy starcie sesji.

### 4. Monitoring kosztów w czasie rzeczywistym — `/setup-statusline`

Zainstaluj `/setup-statusline`, aby wyświetlać koszt/tokeny w czasie rzeczywistym na dole CLI: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Od razu zauważysz nietypowo wysoki koszt wywołania lub rosnący kontekst i zareagujesz, zanim koszty gwałtownie wzrosną.

### 5. Analiza wzorców kosztów — `/usage-view`

Użyj `/usage-view`, aby przejrzeć pełną historię użycia na dashboardzie. Wizualizuj dzienne/godzinowe trendy kosztów, skład tokenów na sesję i efektywność cache. Od razu widać, które zadania wywołały skoki kosztów i które wzorce są nieefektywne.

### 6. Optymalizacja promptu systemowego

Im więcej pluginów, serwerów MCP i umiejętności załadowanych do promptu systemowego, tym wyższy początkowy koszt cache write. Usuń wszystko, czego nie używasz.

`/setup-git-lite` z super-token-saver redukuje domyślne instrukcje Git Claude Code (~2 200 tokenów) do podstawowych 280 tokenów — redukcja o około 88% w zakresie instrukcji Git w prompcie systemowym na sesję.

### 7. Wybór narzędzi — wpływ na kontekst różni się w zależności od narzędzia

Po odczytaniu pliku jego zawartość pozostaje w kontekście i kumuluje się w cache read przy wszystkich kolejnych wywołaniach. Odczytanie pojedynczego pliku w całości dodaje tysiące-dziesiątki tysięcy tokenów do kontekstu, a ta kwota jest naliczana przy każdym kolejnym wywołaniu.

Zadania programistyczne często dotyczą wielu plików jednocześnie — odczytanie zaledwie 3-4 plików w całości może spowodować dramatyczny wzrost kontekstu. Wybór odpowiedniego narzędzia ma znaczący wpływ na wzrost kontekstu.

| Narzędzie | Przeznaczenie | Wpływ na kontekst | Kiedy używać |
|---|---|---|---|
| **Grep** | Wyszukiwanie kodu według wzorca | **Minimalne** — zwraca tylko pasujące linie | Szukanie konkretnych nazw funkcji, zmiennych, ciągów |
| **Glob** | Wyszukiwanie plików według wzorca nazwy | **Minimalne** — zwraca tylko ścieżki plików | Szukanie plików: `*.ts`, `src/**/*.test.js` |
| **LSP** | Definicje symboli, referencje, typy | **Minimalne** — zwraca tylko definicje/sygnatury | Przejdź do definicji, znajdź referencje, sprawdź typy |
| **Read** (offset/limit) | Odczyt konkretnej części pliku | **Umiarkowane** — zwraca tylko wskazany zakres | Gdy potrzebujesz konkretnego zakresu linii |
| **Read** (pełny) | Odczyt całego pliku | **Duże** — cały plik dodawany do kontekstu | Tylko gdy musisz zrozumieć pełną strukturę pliku |

„Przeczytaj cały plik" zużywa dziesiątki-setki razy więcej kontekstu niż „Znajdź tę funkcję".

Ta sama zasada dotyczy edycji i porównywania:

| Narzędzie | Przeznaczenie | Wpływ na kontekst |
|---|---|---|
| **Edit** | Modyfikacja istniejącego pliku | **Minimalne** — do kontekstu dodawany jest tylko diff |
| **Write** | Tworzenie nowego pliku / pełne nadpisanie | **Duże** — cały plik dodawany do kontekstu |
| **git diff / diff** | Porównywanie plików/folderów | **Minimalne** — zwracane są tylko różnice |
| Odczyt obu plików osobno | Porównywanie plików/folderów | **Duże** — oba pełne pliki dodawane do kontekstu |

super-token-saver automatycznie wstrzykuje ten przewodnik po wyborze narzędzi do AI przy starcie sesji, zachęcając do korzystania najpierw z lekkich narzędzi.

## Załącznik: porównanie cache u dostawców AI

### Koszty cache

| Dostawca | Koszt Cache Write | Zniżka na Cache Read | Koszt przechowywania cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Poziom 5 min: 1,25x wejścia<br/>Poziom godzinny: 2x wejścia | Zniżka 90% | Brak |
| **OpenAI**<br/>(Codex) | Bez dopłaty (równy wejściu) | Zniżka 90% | Brak |
| **Google Gemini**<br/>(Gemini CLI) | Bez dopłaty (równy wejściu) | Zniżka 90% | Brak |

> **Uwaga**: zniżki na cache read różnią się w zależności od modelu. Podane wartości dotyczą najnowszych flagowych modeli każdego dostawcy.

### Czas życia cache (TTL)

| Dostawca | TTL | Gwarancja |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minut lub 1 godzina | **Jawnie zdefiniowane** |
| **OpenAI**<br/>(Codex) | Zwykle usuwany po 5-10 min bezczynności; może przetrwać do 1 godziny poza szczytem | **Brak gwarancji** — dokumentacja używa „generally", „up to" |
| **Google Gemini**<br/>(Gemini CLI) | Nieujawnione | **Brak gwarancji** — jawne cache'owanie z gwarantowanym TTL dostępne przez API (płatne) |

> **Uwaga**: na podstawie naszych eksperymentów z Claude Code, główne sesje zazwyczaj używają poziomu godzinnego, a SubTasks — 5-minutowego.

### Dodatkowe opcje kontroli cache przez bezpośrednie wywołania API

Powyższe porównanie dotyczy użytkowników narzędzi do kodowania z AI (Claude Code, Codex, Gemini CLI). Programiści wywołujący API bezpośrednio mają bardziej szczegółową kontrolę nad cache.

**Anthropic**

- `cache_control`: ustawianie punktów kontrolnych do jawnego definiowania granic cache. Określane automatycznie, jeśli nie podano.
- Poziom TTL (5 min / 1 godz.) można wybrać per zapytanie.

**OpenAI**

- `prompt_cache_key`: kieruje zapytania z tym samym kluczem na ten sam serwer, zwiększając współczynnik trafień cache. Codex automatycznie ustawia go na `conversation_id`.
- `prompt_cache_retention: "24h"`: wydłużone przechowywanie cache. Wydłuża domyślne 5-10 min do 24 godzin (bez dodatkowych opłat, bez gwarancji). Codex nie używa tej opcji.

**Google Gemini**

- Jawne cache'owanie (`CachedContent`): ustawienie TTL od 1 min do 48 godzin, gwarantujące trafienia cache. Pobierana jest opłata za przechowywanie (\$4,50/MTok/godz. dla Pro). Aktualizacja zawartości cache wymaga ręcznego utworzenia nowego CachedContent. Gemini CLI nie korzysta z tej funkcji.

> **Uwaga**: te opcje nie są dostępne w narzędziach do kodowania z AI i nie mogą być bezpośrednio kontrolowane przez użytkowników. Użytkownicy narzędzi do kodowania z AI powinni zapoznać się z sekcją „Strategie redukcji kosztów cache" w tekście głównym.

### Źródła

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
