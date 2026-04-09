# cc-token-saver

> **Claude Code unterbricht dich ständig? Nicht mehr.**
>
> Weniger ausgeben, länger coden und genau sehen, wohin deine Token gehen — ohne Konfiguration.

Wie? Automatisches Context-Management, Echtzeit-Kostenüberwachung und cache-bewusste Session-Steuerung — alles in einem Plugin.

---

## 😤 Das Problem: $200/Monat und du kommst trotzdem nicht zum Arbeiten

Claude Code Max Plan ($200/Monat). Sollte reichen. Tut es nicht.

**5-Stunden-Rollfenster als Rate Limit.** Du bist mitten im Coding-Flow und es stoppt einfach. Kein Timer. Keine geschätzte Wartezeit. Einfach warten.

**Cache-Ablauf.** Du kommst vom Mittagessen zurück. Über eine Stunde vergangen. Du schickst einen Prompt und 900K Token werden zum vollen Preis erneut gesendet. Kosten? $9 auf einen Schlag.

**Unsichtbare Kosten.** Es gibt keine Möglichkeit, die Ausgaben in Echtzeit zu sehen. Du erfährst es erst, wenn das Rate Limit zuschlägt.

**Alles manuell.** Context-Größe, Cache-Ablaufzeitpunkt, SubTask-Delegation, Session-Bereinigung. Das kann niemand im Blick behalten und gleichzeitig coden.

cc-token-saver übernimmt das alles automatisch. **Einmal installieren. Fertig.**

---

## 🚀 Installation

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Funktioniert automatisch nach der Installation. Keine Konfiguration nötig. Erfordert [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Für Live-Monitoring:

```
/setup-statusline install
```

---

## 🛡️ Feature 1: Token Guardian

**Erkennt Cache-Ablauf und blockiert automatisch teure Neuübertragungen.**

Die Prompt-Cache-TTL von Claude Code beträgt 1 Stunde. Verlasse den Rechner für mehr als eine Stunde und der Cache läuft ab. Deine nächste Nachricht sendet den gesamten Context zum vollen Preis erneut. Bei 900K Token sind das $9 auf einen Schlag.

Token Guardian verfolgt, wann die letzte Antwort eingegangen ist. Wenn mehr als 3.590 Sekunden vergangen sind (TTL minus 10 Sekunden Puffer), blockiert er den Prompt und zeigt eine Warnung an.

```
🚨 Cache abgelaufen (68m 23s inaktiv)

Der Cache ist abgelaufen. Fortfahren sendet den gesamten Kontext erneut.
Die Kosten können erheblich steigen.

👉 /context — Aktuelle Kontextnutzung prüfen, bevor Sie entscheiden
👉 /clear → /continue — Zurücksetzen, dann vorherigen Kontext wiederherstellen (empfohlen, günstigste Option)
👉 Erneut senden — Fortfahren wie gehabt (volle Re-Cache-Kosten anfallend)
```

Sende denselben Prompt nach der Warnung erneut und er wird ausgeführt. Die Warnung erscheint nur einmal pro Inaktivitätsphase, nervt also nie. Warnmeldungen werden in 23 Sprachen angezeigt, basierend auf deinem OS-Locale.

**Ergebnis:** Teure Re-Cache-Kosten werden automatisch verhindert. Kein Aufwand nötig.

---

## 🧠 Feature 2: Smart Session Architecture

**Installieren — und kostenoptimierte Arbeitsweisen setzen automatisch ein.**

Die meisten Nutzer machen alles in der Main Session. Dateien lesen, Code generieren, Tests ausführen. Jede Ausgabe häuft sich im Context an und wird mit jeder Nachricht erneut gesendet. Die Session bläht sich auf. Die Kosten explodieren.

Session Architect fügt beim Session-Start automatisch eine Delegationsstrategie ein.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rolle            | Design, Entscheidungen, Review    | Implementierung, Code-Generierung, Multi-File |
| Cache-Stufe      | 1 Stunde (ephemeral_1h)           | 5 Min                                 |
| Cache-Write-Kosten | ＄10/MTok                        | ＄6,25/MTok                            |
| Context-Größe    | ~94K Durchschnitt                 | ~33K Durchschnitt                     |

SubTasks haben **37,5 % günstigere Cache-Writes** als Main. Der Context ist außerdem viel kleiner. Schwere Arbeit an SubTasks zu delegieren senkt die Kosten drastisch.

**Ergebnis:** Claude arbeitet automatisch in einem kosteneffizienten Muster. Du musst nicht darüber nachdenken.

---

## 🔄 Feature 3: /continue — Context-Wiederherstellung

**Ersetzt `/compact`. Null LLM-Aufrufe. Null Token-Kosten.**

`/compact` sendet deinen gesamten Context (~1M Token) an das LLM, um eine 3,3 %-Zusammenfassung zu erstellen. Wenn der Cache abgelaufen ist, löst allein das einen vollständigen Re-Cache aus. Informationsverlust ist unvermeidlich.

`/continue` geht einen völlig anderen Weg. Es verarbeitet das vorherige Session-Transkript vor und liest es direkt ein. Kein LLM-Aufruf. Keine Kosten. Die ursprüngliche Konversation wird originalgetreu wiederhergestellt.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Funktionsweise          | Sendet gesamten Context an LLM zur Zusammenfassung | Verarbeitet Transkript vor, liest direkt ein |
| LLM-Aufrufe             | Erforderlich (typischerweise 100K+ Token) | 0                          |
| Token-Kosten            | Hoch                              | 0                                |
| Informationsverlust     | Ja (3,3 % Zusammenfassung)        | Keiner (Original bleibt erhalten) |
| Verarbeitungsgeschwindigkeit | Dutzende Sekunden             | < 1 Sek (selbst bei 60 MB+ Dateien) |
| Bei abgelaufenem Cache  | Zusätzliche Re-Cache-Kosten       | Kein Einfluss                    |
| Multi-Session-Wiederherstellung | Nicht möglich               | Unterstützt                      |

Nutzung: `/clear` dann `/continue`. Du siehst eine Liste vorheriger Sessions. Wähle aus, welche du wiederherstellen möchtest. Für schnelle Wiederherstellung: `/continue last`.

**Ergebnis:** Vorherige Arbeit ohne Kosten fortsetzen. Kein Informationsverlust.

---

## 📊 Feature 4: Live Status Line

**Token-/Kostenüberwachung in Echtzeit. Unter 50 ms Overhead.**

Führe `/setup-statusline install` einmal aus und eine permanente Statusleiste erscheint am unteren Rand von Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indikator        | Was er anzeigt                      | 🟢 Normal | 🟡 Warnung | 🔴 Kritisch |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (Delta)      | Kosten des letzten API-Aufrufs      | < ＄0.30   | >= ＄0.30   | >= ＄1,00    |
| RUN (Kumuliert)  | Gesamtkosten für diesen Ordner      | —         | —          | —           |
| 5H               | 5-Stunden-Fenster-Nutzung + Reset-Countdown | < 70 % | >= 70 %   | >= 90 %     |
| CTX              | Context-Window-Auslastung           | < 35 %    | >= 35 %    | >= 70 %     |

Wenn ein Indikator die Warn- oder kritische Schwelle erreicht, erscheint automatisch ein `→ /usage-view current` Hinweis.

Zum Entfernen: `/setup-statusline uninstall` (vorherige Konfiguration wird automatisch wiederhergestellt).

**Ergebnis:** Deinen Kostenstatus auf einen Blick sehen. Handeln, bevor es zu spät ist.

---

## 📈 Usage Dashboard (/usage-view)

**Endlich die Antwort auf: "Warum wurde ich rate-limited?"**

Bisher hat das Rate Limit nur geärgert. Keine Möglichkeit, die Ursache zu erkennen. Welche Session hat die meisten Token verbraucht? Wann sind die Kosten explodiert? Welche Muster gibt es in deiner Nutzung? Alles unsichtbar.

`/usage-view` zeigt alles. Ein interaktives HTML-Dashboard öffnet sich im Browser und lässt dich Nutzungsmuster analysieren und die Ursache von Kostenspitzen zurückverfolgen. Keine externen Abhängigkeiten. Funktioniert eigenständig. Als Datei teilbar.

Was enthalten ist:

- Tages- / Stunden- / Wochentag-Kostentrends — erkennen, wann du die meisten Token verbrauchst
- Token-Aufschlüsselung (Input, Output, Cache Write, Cache Read) — sehen, was die Kosten treibt
- Kosten pro Session — feststellen, welche Aufgaben teuer waren
- 5-Stunden-Fenster-Timeline (Max-Plan-Abonnenten) — Rate-Limit-Auslöser nachverfolgen
- KI-gestützte Analyse — interpretiert Daten und schlägt Verbesserungen vor
- 23 Sprachen unterstützt (RTL inklusive; Charts/Tabellen bleiben LTR)

```
/usage-view                  # Gesamter Zeitraum, alle Projekte
/usage-view current          # Nur das aktuelle 5-Stunden-Fenster
/usage-view last 7 days      # Letzte 7 Tage
/usage-view locale de        # Deutsch
```

---

## 🔬 Rate-Limit-Forschung (/report-limit)

**Community-Projekt zur Entschlüsselung der Rate-Limit-Formel.**

Anthropic veröffentlicht die genaue Formel für das 5-Stunden-Fenster nicht. Lasst sie uns gemeinsam herausfinden.

Wenn du ein Rate Limit erreichst, führe `/report-limit` aus. Deine Nutzungsdaten zu diesem Zeitpunkt werden automatisch als GitHub Discussion eingereicht. Je mehr Daten wir sammeln, desto klarer wird die Formel.

---

## 💡 Wie Cache tatsächlich funktioniert

Claude Code sendet bei jedem API-Aufruf den gesamten Konversationsverlauf an das Modell. "API-Aufruf" bedeutet nicht "eine Nachricht, die du getippt hast." Ein einzelner Prompt löst interne Tool-Aufrufe aus — Grep, Read, Edit, Write — und jeder davon ist ein separater API-Aufruf. Ein Prompt kann leicht 10+ API-Aufrufe verursachen.

Der Prompt-Cache reduziert diese Kosten um 90 %. Aber der Cache hat eine Lebensdauer.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 Stunde (ephemeral_1h)              | 5 Min                                  |
| Cache Write         | ＄10/MTok                             | ＄6,25/MTok                             |
| Cache Read          | ＄0,50/MTok                           | ＄0,50/MTok                             |
| Bei Cache-Ablauf    | Gesamter Context wird zum vollen Preis erneut gesendet | Geringe Auswirkung (Context ist klein) |

Selbst bei aktivem Cache summieren sich die Kosten. Hier ein Extremszenario, das den Unterschied verdeutlicht.

### Szenario: Ganztägiges Coden (3 Std. morgens → 2 Std. Mittagspause/Meeting → 3 Std. nachmittags)

Bedingungen: Opus 4 Preise, 1 Prompt pro Minute, ~5 API-Aufrufe pro Prompt (~300 Aufrufe/Stunde).

#### ❌ Ohne cc-token-saver

Die meiste Arbeit passiert in der Main Session. Der Context wächst schnell.

| Phase       | Situation                         | Context-Größe              | Kosten                                 |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Morgens 3 Std. | Coding (hauptsächlich in Main) | 100K → 600K (Durchschnitt 350K) | 900 Aufrufe × 350K × ＄0,50/M = ＄157,50 |
| Mittag/Mtg  | 2 Stunden abwesend                | —                            | —                                      |
| Rückkehr    | Cache abgelaufen → vollständige Neuübertragung | 600K voller Preis  | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Rückkehr    | /compact (Zusammenfassung)        | 600K → an LLM gesendet      | 600K × ＄0,50/M + Summary-Output = ~＄1,50 |
| Nachmittags 3 Std. | Coding geht weiter (Context wächst erneut) | 100K → 600K (Durchschnitt 350K) | 900 Aufrufe × 350K × ＄0,50/M = ＄157,50 |
|             | Gesamt                            |                              | ~＄326                                  |

> Bei dieser Nutzungsintensität wirst du wahrscheinlich das 5-Stunden-Fenster-Rate-Limit erreichen. **Die Kosten sind schlimm, aber das eigentliche Problem ist, dass deine Arbeit komplett zum Stillstand kommt. Genau in diesem Moment geht dein Claude Code offline.**

#### ✅ Mit cc-token-saver

Schwere Arbeit wird an SubTasks delegiert. Main übernimmt nur Design/Entscheidungen.

| Phase       | Situation                                    | Context-Größe               | Kosten                             |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Morgens 3 Std. | Coding (Main: Design, SubTask: Implementierung) | Main 100K → 300K (Durchschnitt 200K) | 900 Aufrufe × 200K × ＄0,50/M = ＄90 |
| Mittag/Mtg  | 2 Stunden abwesend                           | —                             | —                                  |
| Rückkehr    | ⚡ Token Guardian blockiert → /clear + /continue | —                          | ＄0 (keine LLM-Aufrufe)            |
| Nachmittags 3 Std. | Coding geht weiter                    | Main 100K → 300K (Durchschnitt 200K) | 900 Aufrufe × 200K × ＄0,50/M = ＄90 |
|             | Gesamt                                       |                               | ~＄180                              |

#### 💰 Ergebnis

> **＄326 → ＄180. ＄146 gespart pro Tag (45 %).**
>
> Es geht nicht nur um Kosten. Weniger Token in derselben Zeit bedeutet: **Du erreichst das Rate Limit nicht und kannst weiterarbeiten.** Das ist der eigentliche Unterschied.

### Wo cc-token-saver eingreift

```
[Session-Start]
    │
    ├─ Session Architect → Fügt SubTask-Delegationsmuster automatisch ein
    │                       Hält Main-Context unter 250K
    │
[Arbeiten]
    │
    ├─ Status Line → Echtzeit-Kosten-/Context-/Rate-Limit-Monitoring
    │                  Sofortige Warnung beim Eintritt in die Warnzone
    │
[1+ Stunde inaktiv]
    │
    ├─ Token Guardian → Erkennt Cache-Ablauf, blockiert vor dem erneuten Senden
    │
[Session-Neustart]
    │
    └─ /continue → Stellt vorherigen Context ohne Kosten wieder her (keine LLM-Aufrufe)
```

---

## 🔧 Source-Installation & Anpassung

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver ist vollständig offen. Der gesamte Quellcode besteht aus einfachem JavaScript + Bash-Skripten in der Standard-Plugin-Struktur. Ändere, was du willst.

- **hooks/** — Cache-Ablauf-Schwellenwert ändern, Warnmeldungen anpassen, Session-Architecture-Regeln modifizieren
- **scripts/** — Analyse-Logik, Report-Builder, Status-Line-Formatierung
- **skills/** — Funktionsweise von /continue und /usage-view, Prompt-Templates
- **locales/** — Übersetzungen hinzufügen/bearbeiten, neue Sprachen ergänzen
- **skills/usage-view/** — Dashboard-UI/UX-Änderungen

Mach es zu deinem. Forke es, experimentiere und sende einen PR, wenn du etwas Besseres findest.

---

## 🌐 Unterstützte Sprachen

23 Sprachen unterstützt. Ausgewählt durch Abgleich der Top-20-Länder nach Claude-Code-Nutzung mit den Top-20-Sprachen nach weltweiter Sprecherzahl. Die Anzeigesprache wird automatisch aus deinem OS-Locale erkannt. Du kannst sie auch manuell festlegen: `/usage-view locale de`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Englisch   | 🇰🇷 Koreanisch | 🇯🇵 Japanisch | 🇨🇳 Chinesisch |
| 🇪🇸 Spanisch   | 🇫🇷 Französisch | 🇩🇪 Deutsch  | 🇧🇷 Portugiesisch |
| 🇮🇹 Italienisch | 🇷🇺 Russisch  | 🇸🇦 Arabisch  | 🇮🇳 Hindi      |
| 🇧🇩 Bengalisch | 🇮🇩 Indonesisch | 🇲🇾 Malaiisch | 🇹🇭 Thai       |
| 🇻🇳 Vietnamesisch | 🇹🇷 Türkisch  | 🇵🇱 Polnisch | 🇳🇱 Niederländisch |
| 🇮🇱 Hebräisch  | 🇸🇪 Schwedisch | 🇳🇴 Norwegisch |                |

Aktuelle Übersetzungen sind KI-generiert. Beiträge von Muttersprachlern sind willkommen — bearbeite die JSON-Datei für deine Sprache in `locales/` und reiche einen PR ein.

---

## 💡 Tipps

### Cache verstehen heißt verstehen, wo das Geld hingeht

- **1 Prompt ≠ 1 API-Aufruf.** Jedes Mal, wenn Claude Grep, Read oder Edit aufruft, wird der gesamte Context erneut gesendet. Ein einzelner Prompt löst leicht 10+ API-Aufrufe aus. Schreibe klare Prompts, um unnötige Tool-Aufrufe zu reduzieren und Kosten zu senken.
- **Cache läuft ab dem letzten API-Aufruf, nicht ab dem letzten Prompt.** Solange du weiterarbeitest, läuft der Cache nie ab. Die Gefahr liegt im Weggehen. Token Guardian blockiert einmal automatisch, sodass du bei der Rückkehr wählen kannst: Context zurücksetzen oder fortfahren.
- **Context-Größe = Kostenmultiplikator.** Derselbe API-Aufruf kostet bei 200K vs. 800K das 4-Fache. Wenn die Status Line [CTX] 35 % überschreitet (🟡), ist das dein Signal, mehr an SubTasks zu delegieren.

### Gewohnheiten, die Kosten senken

- **Halte CLAUDE.md schlank.** Sie wird bei jedem API-Aufruf in den System-Prompt geladen. Jede Zeile kostet Geld.
- **Delegiere schwere Arbeit an SubTasks.** Code-Generierung, Multi-File-Edits, Testläufe gehören nicht in Main. SubTasks haben kleineren Context und eine günstigere Cache-Stufe.
- **1+ Stunde weg?** `/clear` → zurückkommen → `/continue`. Context wird für $0 wiederhergestellt.
- **[5H] über 70 % (🟡)?** Langsamer machen. Wechsle zu leichten Review-Aufgaben oder erhöhe die SubTask-Delegation, um die API-Aufrufzahl von Main zu reduzieren.
- **Nutze `/btw` für Nebenfragen.** Es gelangt nicht in den Konversationsverlauf, sodass dein Context schlank bleibt.

---

## License

Apache-2.0
