# Cache-Kostenleitfaden — Warum der Grossteil Ihrer Kosten aus dem Cache stammt

Es ist normal, dass der Grossteil der Kosten Ihrer KI-Programmiertools aus Cache-Operationen (Schreiben + Lesen) stammt. Dieses Dokument erklaert warum und wie Sie damit umgehen koennen.

## Das Geheimnis: Jede Nachricht sendet die gesamte Konversation erneut

LLMs sind **zustandslos**. Anders als Menschen "erinnern" sich KI-Modelle nicht an vorherige Konversationen — sie erhalten den vollstaendigen Konversationsverlauf als Eingabe bei jeder einzelnen Anfrage.

Es sieht aus wie ein Chat, aber die tatsaechlichen API-Aufrufe funktionieren so:

```
[ Anfrage 1 ]
→ System-Prompt + "Behebe diesen Bug"
← KI-Antwort

[ Anfrage 2 ]
→ System-Prompt + "Behebe diesen Bug" + KI-Antwort + "Fuege auch Tests hinzu"
← KI-Antwort

[ Anfrage 3 ]
→ System-Prompt + "Behebe diesen Bug" + KI-Antwort + "Fuege auch Tests hinzu" + KI-Antwort + "Committe es"
← KI-Antwort
```

Jede Anfrage enthaelt **allen** vorherigen Inhalt. Beispielsweise enthaelt die 50. Anfrage die gesamte Konversation und alle KI-Antworten der vorherigen 49 Anfragen. Deshalb wachsen die Eingabe-Tokens schnell, je laenger die Konversation wird.

Zusaetzlich senden KI-Programmiertools den System-Prompt (eingebaute Anweisungen, Konfigurationsdateien, Plugins, MCP-Tool-Definitionen usw.) mit jeder Anfrage — selbst eine einzeilige Nachricht erzeugt also Zehntausende von Eingabe-Tokens.

## Was ist Caching?

**Prompt Caching** reduziert die Kosten dieser wiederholten Uebertragung. Es speichert unveraenderte Teile Ihrer Eingabe auf dem Server, damit nachfolgende Anfragen sie zu einem reduzierten Preis wiederverwenden koennen.

- **Cache Write**: Die Kosten fuer das Speichern von Konversationsinhalten auf dem Server. Tritt bei der ersten Anfrage oder nach Ablauf des Caches auf.
- **Cache Read**: Die Kosten fuer die Wiederverwendung bereits gespeicherter Konversation. Wird mit einem **90% Rabatt** gegenueber der Standard-Eingabe berechnet.

KI-Programmiertools erzeugen unvermeidlich lange Konversationen und grosse Kontexte, bis zu 1 Million Tokens pro Anfrage. Selbst wenn Ihre neue Frage kurz ist, wird die gesamte vorherige Konversation mitberechnet, sodass die Kosten schnell steigen, je laenger die Konversation wird.

Um diese Belastung zu reduzieren, gewaehren grosse KI-Anbieter einen 90%-Rabatt auf Cache-Lesevorgaenge, was die Kosten fuer die erneute Uebertragung bereits verarbeiteter Inhalte erheblich senkt.

## Warum dominiert der Cache die Gesamtkosten?

| Kategorie | Tokens pro Aufruf | Anmerkung |
|---|---|---|
| Benutzereingabe (neue Tokens) | Dutzende bis Hunderte | Was der Benutzer tatsaechlich tippt |
| KI-Ausgabe | Hunderte bis Tausende | Antwort der KI |
| **Cache-Lesen** | **100K–Hunderttausende** | Gesamte akkumulierte Konversation wird bei jedem Aufruf berechnet |

Das Volumen der Cache-Lesevorgaenge pro Aufruf ist **tausendmal** groesser als die Eingabe. Selbst mit 90% Rabatt dominieren Cache-Lesevorgaenge immer noch in absoluten Kosten.

Und diese Aufrufe stammen nicht nur von Benutzernachrichten:

| Quelle | Haeufigkeit | Cache-Lesen pro Aufruf |
|---|---|---|
| Benutzernachrichten | Wenn der Benutzer eine Nachricht sendet | Gesamte akkumulierte Konversation |
| **Eigene Entscheidungen der KI** | **Mehrere Aufrufe pro Benutzernachricht** | Gesamte akkumulierte Konversation |

Unsichtbar fuehrt die KI fuer eine einzige Benutzernachricht mehrere Entscheidungen in Folge durch — welches Tool verwendet werden soll, das Ergebnis des Tools interpretieren, die naechste Aktion entscheiden. Jede dieser Entscheidungen ist ein vollstaendiger LLM-Aufruf, der den gesamten Kontext umfasst. Die Tool-Ausfuehrung selbst (Dateien lesen, Suchen) laeuft lokal, aber die Entscheidungsfindung vor und nach jeder Tool-Nutzung verursacht Cache-Lesekosten.

### Warum sind auch die Cache-Schreibkosten hoeher als erwartet?

Bei Anthropic betragen die Cache-Schreibkosten 1,25x der Eingabe (5-Minuten-Stufe) oder 2x der Eingabe (1-Stunden-Stufe). Bei diesen Multiplikatoren scheint es, als sollte das Cache-Schreiben nicht mehr als 2x die Eingabe+Ausgabe-Kosten betragen — in der Praxis nimmt das Cache-Schreiben jedoch einen viel groesseren Anteil ein.

Zwei Gruende:

| Ursache | Erklaerung |
|---|---|
| **System-Prompt** | Zehntausende Tokens, bevor der Benutzer irgendetwas tippt (mit Plugins/MCP). All dies unterliegt den Cache-Schreibkosten |
| **Neuerstellung nach Ablauf** | Nach Ablauf des TTL (5 Min / 1 Stunde) muss die gesamte akkumulierte Konversation erneut gecacht werden. Je laenger die Konversation, desto hoeher die Neuerstellungskosten |

Mit anderen Worten: Cache-Schreiben findet nicht nur fuer "neue Tokens, die der Benutzer getippt hat" statt. Beim Sessionstart wird der gesamte System-Prompt gecacht; nach Ablauf wird die gesamte akkumulierte Konversation zum Cache-Schreibziel. Wenn der Cache einer 100K-Token-Konversation ablaeuft, loest eine einzige Nachricht ein Cache-Schreiben von 100K Tokens auf einmal aus.

**Genau deshalb zeigt das super-token-saver-Plugin nach 1 Stunde Inaktivitaet eine Cache-Ablaufwarnung an.** Wenn die Warnung erscheint, pruefen Sie Ihre aktuelle Kontextgroesse:

- **Kleiner Kontext**: Die Cache-Neuerstellungskosten sind handhabbar. Arbeiten Sie einfach weiter — die Kosten sind gering.
- **Grosser Kontext**: Die Cache-Kosten werden erheblich sein. Wir empfehlen `/clear` gefolgt von `/s-continue last`, um in einer neuen Sitzung fortzufahren. Die continue-Faehigkeit stellt automatisch den Kontext Ihrer vorherigen Konversation wieder her, sodass Ihr Arbeitsablauf nicht unterbrochen wird.

## Strategien zur Reduzierung der Cache-Kosten

Das super-token-saver-Plugin ist darauf ausgelegt, alle diese Strategien zu automatisieren oder zu vereinfachen.

### 1. Kontext klein halten — `/clear` + `/s-continue` ⭐

**Dies ist der wichtigste Weg, um Kosten zu reduzieren.** Hohe Cache-Kosten bedeuten, dass Sie den 90%-Rabatt erhalten — das ist normal. Aber wenn der Kontext unnoetig waechst und so bleibt, steigen die absoluten Kosten pro Aufruf selbst mit dem Rabatt. **Die Kontextgroesse unter Kontrolle zu halten ist die effektivste Strategie zur Kostenkontrolle.**

Wenn sich das Thema aendert oder die Konversation lang wird, fuehren Sie `/clear` aus, um zurueckzusetzen, und dann `/s-continue last`, um den vorherigen Kontext wiederherzustellen. `/s-continue` stellt vorherige Konversationen ohne LLM-Aufrufe wieder her, sodass die Kosten null betragen.

`/compact` reduziert den Kontext durch Zusammenfassung der Konversation, aber der Zusammenfassungsprozess selbst verursacht LLM-Aufrufkosten und verliert Konversationsdetails. Nicht empfohlen.

### 2. Cache-Ablauf verhindern — Token Guardian (Automatisch)

Der Haupt-Session-Cache von Anthropic verwendet eine **1-Stunden-Stufe**. Nach Ablauf muss die erste Anfrage die gesamte Konversation als Cache-Schreibvorgang neu erstellen, was teuer ist.

super-token-saver erkennt 1-stuendige Inaktivitaet und **zeigt automatisch eine Warnung an**. Wenn die Warnung erscheint, ist die Verwendung von Methode 1 oben (`/clear` + `/s-continue`), um in einer neuen Sitzung fortzufahren, der wirtschaftlichste Ansatz.

### 3. Schwere Arbeit an SubTasks delegieren

Schwere Aufgaben wie Code-Generierung oder Multi-Datei-Bearbeitungen koennen an SubTasks delegiert werden, anstatt sie direkt in der Hauptsitzung auszufuehren. SubTasks verwenden die 5-Minuten-Cache-Stufe, wodurch **Cache-Schreibvorgaenge 37,5% guenstiger** sind, und laufen in einem isolierten kleineren Kontext, was das Cache-Lesevolumen pro Aufruf reduziert.

super-token-saver leitet dieses Arbeitstrennungsmuster automatisch beim Sitzungsstart an.

### 4. Echtzeit-Kostenueberwachung — `/setup-statusline`

Installieren Sie `/setup-statusline`, um den Echtzeit-Kosten-/Token-Status am unteren Rand Ihrer CLI anzuzeigen: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Sie koennen ungewoehnlich hohe Kosten pro Aufruf oder einen wachsenden Kontext sofort erkennen und handeln, bevor die Kosten in die Hoehe schiessen.

### 5. Kostenmuster-Analyse — `/usage-view`

Verwenden Sie `/usage-view`, um Ihren vollstaendigen Nutzungsverlauf als Dashboard zu ueberpruefen. Visualisieren Sie taegliche/stuendliche Kostentrends, Token-Zusammensetzung pro Sitzung und Cache-Effizienz. Erkennen Sie auf einen Blick, welche Aufgaben Kostenspitzen verursacht haben und welche Muster ineffizient sind.

### 6. System-Prompt-Optimierung

Je mehr Plugins, MCP-Server und Faehigkeiten in den System-Prompt geladen werden, desto hoeher die anfaenglichen Cache-Schreibkosten. Entfernen Sie alles, was Sie nicht verwenden.

`/setup-git-lite` von super-token-saver reduziert die Standard-Git-Anweisungen von Claude Code (~2.200 Tokens) auf einen Kern von 280 Tokens — eine Reduzierung des Git-bezogenen System-Prompts pro Sitzung um etwa 88%.

### 7. Tool-Auswahl — Der Kontext-Einfluss variiert je nach Tool

Sobald eine Datei gelesen wurde, bleibt ihr Inhalt im Kontext und akkumuliert sich in den Cache-Lesevorgaengen aller nachfolgenden Aufrufe. Das vollstaendige Lesen einer einzigen Datei fuegt dem Kontext Tausende bis Zehntausende Tokens hinzu, und dieser Betrag wird bei jedem nachfolgenden Aufruf berechnet.

Programmieraufgaben umfassen oft mehrere Dateien gleichzeitig — allein das vollstaendige Lesen von 3-4 Dateien kann den Kontext dramatisch vergroessern. Die Wahl des richtigen Tools macht einen erheblichen Unterschied beim Kontextwachstum.

| Tool | Zweck | Kontext-Auswirkung | Wann verwenden |
|---|---|---|---|
| **Grep** | Code nach Muster durchsuchen | **Minimal** — gibt nur uebereinstimmende Zeilen zurueck | Bestimmte Funktionsnamen, Variablen, Zeichenketten suchen |
| **Glob** | Dateien nach Namensmuster suchen | **Minimal** — gibt nur Dateipfade zurueck | Dateistandorte wie `*.ts`, `src/**/*.test.js` finden |
| **LSP** | Symboldefinitionen, Referenzen, Typen | **Minimal** — gibt nur Definitionen/Signaturen zurueck | Zur Definition springen, Referenzen finden, Typen pruefen |
| **Read** (offset/limit) | Bestimmten Teil einer Datei lesen | **Moderat** — gibt nur den angegebenen Bereich zurueck | Wenn Sie einen bestimmten Zeilenbereich benoetigen |
| **Read** (vollstaendig) | Gesamte Datei lesen | **Gross** — gesamte Datei dem Kontext hinzugefuegt | Nur wenn Sie die vollstaendige Dateistruktur verstehen muessen |

"Lies diese gesamte Datei" verbraucht zehn- bis hundertmal mehr Kontext als "Finde diese Funktion".

Das gleiche Prinzip gilt fuer Bearbeiten und Vergleichen:

| Tool | Zweck | Kontext-Auswirkung |
|---|---|---|
| **Edit** | Bestehende Datei aendern | **Minimal** — nur der Diff wird dem Kontext hinzugefuegt |
| **Write** | Neue Datei erstellen / vollstaendiges Neuschreiben | **Gross** — gesamte Datei dem Kontext hinzugefuegt |
| **git diff / diff** | Dateien/Ordner vergleichen | **Minimal** — nur Unterschiede werden zurueckgegeben |
| Beide Dateien separat lesen | Dateien/Ordner vergleichen | **Gross** — beide vollstaendigen Dateien dem Kontext hinzugefuegt |

super-token-saver injiziert diese Tool-Auswahlhilfe automatisch beim Sitzungsstart in die KI und foerdert die vorrangige Nutzung leichtgewichtiger Tools.

## Anhang: Cache-Vergleich zwischen KI-Anbietern

### Cache-Kosten

| Anbieter | Cache-Schreibkosten | Cache-Lese-Rabatt | Cache-Speicherkosten |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5-Min-Stufe: 1,25x Eingabe<br/>1-Stunden-Stufe: 2x Eingabe | 90% Rabatt | Keine |
| **OpenAI**<br/>(Codex) | Kein Aufpreis (gleich wie Eingabe) | 90% Rabatt | Keine |
| **Google Gemini**<br/>(Gemini CLI) | Kein Aufpreis (gleich wie Eingabe) | 90% Rabatt | Keine |

> **Hinweis**: Die Rabattsaetze fuer Cache-Lesevorgaenge variieren je nach Modell. Diese Zahlen spiegeln die neuesten Flaggschiff-Modelle jedes Anbieters wider.

### Cache-Lebensdauer (TTL)

| Anbieter | TTL | Garantie |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 Minuten oder 1 Stunde | **Explizit definiert** |
| **OpenAI**<br/>(Codex) | Typischerweise nach 5-10 Min Inaktivitaet entfernt; kann in Nebenzeiten bis zu 1 Stunde bestehen bleiben | **Nicht garantiert** — offizielle Dokumentation verwendet "in der Regel", "bis zu" |
| **Google Gemini**<br/>(Gemini CLI) | Nicht offengelegt | **Nicht garantiert** — explizites Caching mit garantiertem TTL ist ueber die API verfuegbar (kostenpflichtig) |

> **Hinweis**: Basierend auf unseren Experimenten mit Claude Code verwenden Hauptsitzungen typischerweise die 1-Stunden-Stufe, waehrend SubTasks die 5-Minuten-Stufe verwenden.

### Zusaetzliche Cache-Steuerungsoptionen ueber direkte API-Aufrufe

Der obige Vergleich ist aus der Perspektive von Nutzern von KI-Programmiertools (Claude Code, Codex, Gemini CLI). Entwickler, die die APIs direkt aufrufen, haben eine feinkoernigere Cache-Steuerung.

**Anthropic**

- `cache_control`: Setzt Haltepunkte, um Cache-Grenzen explizit zu definieren. Wird automatisch bestimmt, wenn nicht angegeben.
- Die TTL-Stufe (5 Min / 1 Stunde) kann pro Anfrage ausgewaehlt werden.

**OpenAI**

- `prompt_cache_key`: Leitet Anfragen mit demselben Schluessel an denselben Server, was die Cache-Trefferrate verbessert. Codex setzt dies intern automatisch auf `conversation_id`.
- `prompt_cache_retention: "24h"`: Erweiterte Cache-Aufbewahrung. Verlaengert den Standard von 5-10 Min auf bis zu 24 Stunden (ohne zusaetzliche Kosten, nicht garantiert). Codex verwendet diese Option nicht.

**Google Gemini**

- Explizites Caching (`CachedContent`): Setzt TTL von 1 Minute bis 48 Stunden, um Cache-Treffer zu garantieren. Es fallen Speichergebuehren an (\$4.50/MTok/Stunde fuer Pro). Aktualisierungen des Cache-Inhalts erfordern die manuelle Erstellung eines neuen CachedContent. Gemini CLI verwendet diese Funktion nicht.

> **Hinweis**: Diese Optionen sind in KI-Programmiertools nicht verfuegbar und koennen von Benutzern nicht direkt gesteuert werden. Benutzer von KI-Programmiertools sollten den Abschnitt "Strategien zur Reduzierung der Cache-Kosten" im Haupttext konsultieren.

### Quellen

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
