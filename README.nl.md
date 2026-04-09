# cc-token-saver

> **Claude Code kapt je steeds af? Dat is voorbij.**
>
> Besteed minder, code langer en zie precies waar je tokens naartoe gaan — zonder configuratie.

Hoe? Automatisch context management, realtime kostenmonitoring en cache-bewuste session control — alles in een plugin.

---

## 😤 Het probleem: $200/maand en je kunt nog steeds niet doorwerken

Claude Code Max Plan ($200/maand). Zou genoeg moeten zijn. Is het niet.

**Rolling rate limit van 5 uur.** Je zit midden in een flow en het stopt gewoon. Geen timer. Geen geschatte wachttijd. Gewoon wachten.

**Cache expiry.** Je komt terug van de lunch. Er is meer dan een uur verstreken. Je stuurt een prompt en 900K tokens worden opnieuw verzonden tegen de volle prijs. Kosten? $9 in een keer.

**Onzichtbare kosten.** Er is geen manier om realtime te zien hoeveel je uitgeeft. Je komt er pas achter als de rate limit toeslaat.

**Alles handmatig.** Context grootte, cache expiry timing, SubTask delegatie, session opschoning. Niemand kan dit allemaal bijhouden terwijl je gewoon aan het coderen bent.

cc-token-saver regelt het allemaal automatisch. **Eenmalig installeren. Klaar.**

---

## 🚀 Installatie

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Werkt automatisch na installatie. Geen configuratie nodig. Vereist [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Voor live monitoring:

```
/setup-statusline install
```

---

## 🛡️ Feature 1: Token Guardian

**Detecteert cache expiry en blokkeert automatisch dure herverzendiningen.**

De prompt cache TTL van Claude Code is 1 uur. Stap je langer dan een uur weg, dan verloopt de cache. Je volgende bericht verstuurt de volledige context opnieuw tegen de volle prijs. Bij 900K tokens is dat $9 in een keer.

Token Guardian houdt bij wanneer het laatste antwoord is ontvangen. Als er meer dan 3.590 seconden zijn verstreken (TTL minus 10 seconden buffer), wordt de prompt geblokkeerd en verschijnt er een waarschuwing.

```
🚨 Cache verlopen (68m 23s inactief)

De cache is verlopen. Doorgaan verstuurt de volledige context opnieuw.
De kosten kunnen aanzienlijk stijgen.

👉 /context — Controleer het huidige contextgebruik voordat u beslist
👉 /clear → /continue — Resetten en daarna vorige context herstellen (aanbevolen, laagste kosten)
👉 Opnieuw verzenden — Doorgaan zoals het is (volledige re-cache kosten gemaakt)
```

Stuur dezelfde prompt gewoon opnieuw na de waarschuwing — hij gaat door. De waarschuwing verschijnt slechts eenmaal per inactieve periode, dus het zeurt nooit. Waarschuwingsberichten worden weergegeven in 23 talen op basis van je OS locale.

**Resultaat:** Dure re-cache kosten worden automatisch voorkomen. Geen moeite vereist.

---

## 🧠 Feature 2: Smart Session Architecture

**Installeer het en kostengeoptimaliseerde werkpatronen starten automatisch.**

De meeste gebruikers doen alles in de Main session. Bestanden lezen, code genereren, tests draaien. Alle output stapelt zich op in de context en wordt bij elk bericht opnieuw verstuurd. De session raakt opgeblazen. De kosten lopen snel op.

Session Architect injecteert automatisch een delegatiestrategie bij het starten van een session.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rol              | Ontwerp, beslissingen, review     | Implementatie, code generatie, multi-file |
| Cache tier       | 1 uur (ephemeral_1h)              | 5 min                                 |
| Cache write kosten | ＄10/MTok                         | ＄6.25/MTok                            |
| Context grootte  | ~94K gemiddeld                    | ~33K gemiddeld                        |

SubTasks hebben **37,5% goedkopere cache writes** dan Main. De context is ook veel kleiner. Door zwaar werk naar SubTasks te delegeren, dalen de kosten drastisch.

**Resultaat:** Claude werkt automatisch in een kostenefficient patroon. Je hoeft er niet over na te denken.

---

## 🔄 Feature 3: /continue — Context Herstel

**Vervangt `/compact`. Nul LLM calls. Nul token kosten.**

`/compact` stuurt je volledige context (~1M tokens) naar de LLM om het samen te vatten tot een 3,3% samenvatting. Als de cache is verlopen, triggert dat alleen al een volledige re-cache. Informatieverlies is onvermijdelijk.

`/continue` werkt compleet anders. Het preprocesst het transcript van de vorige session en laadt het direct in. Geen LLM call. Geen kosten. Het oorspronkelijke gesprek wordt hersteld zoals het was.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Hoe het werkt           | Stuurt volledige context naar LLM voor samenvatting | Preprocesst transcript, leest direct in |
| LLM calls               | Vereist (doorgaans 100K+ tokens)  | 0                                |
| Token kosten            | Hoog                              | 0                                |
| Informatieverlies       | Ja (3,3% samenvatting)            | Geen (origineel behouden)        |
| Verwerkingssnelheid     | Tientallen seconden               | < 1 sec (zelfs 60MB+ bestanden)  |
| Bij verlopen cache      | Volledige re-cache kosten bovenop | Geen impact                      |
| Multi-session herstel   | Niet mogelijk                     | Ondersteund                      |

Gebruik: `/clear` en dan `/continue`. Je ziet een lijst van eerdere sessions. Kies er een om te herstellen. Voor snel herstel: `/continue last`.

**Resultaat:** Hervat eerder werk zonder kosten. Geen informatieverlies.

---

## 📊 Feature 4: Live Status Line

**Realtime token/kosten monitoring. Minder dan 50ms overhead.**

Voer eenmalig `/setup-statusline install` uit en er verschijnt een permanente statusbalk onderaan Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indicator        | Wat het toont                       | 🟢 Normaal | 🟡 Waarschuwing | 🔴 Kritiek |
| ---------------- | ----------------------------------- | ---------- | --------------- | ---------- |
| RUN (delta)      | Kosten van de laatste API call      | < ＄0.30    | >= ＄0.30        | >= ＄1,00   |
| RUN (cumulatief) | Cumulatieve kosten voor deze map    | —          | —               | —          |
| 5H               | 5-uurs window gebruik + reset countdown | < 70%  | >= 70%          | >= 90%     |
| CTX              | Context window gebruik              | < 35%      | >= 35%          | >= 70%     |

Wanneer een indicator waarschuwing of kritiek bereikt, verschijnt automatisch een `→ /usage-view current` hint.

Om te verwijderen: `/setup-statusline uninstall` (eerdere configuratie wordt automatisch hersteld).

**Resultaat:** Zie je kostenstatus in een oogopslag. Grijp in voordat het te laat is.

---

## 📈 Gebruiksdashboard (/usage-view)

**Eindelijk antwoord op: "Waarom werd ik geratelimiteerd?"**

Tot nu toe maakte het raken van de rate limit je alleen maar boos. Geen manier om de oorzaak te achterhalen. Welke session verbrandde de meeste tokens? Wanneer stegen de kosten? Welke patronen zitten er in je gebruik? Allemaal onzichtbaar.

`/usage-view` toont alles. Een interactief HTML dashboard opent in je browser, waarmee je gebruikspatronen kunt analyseren en de oorzaak van kostenpieken kunt traceren. Geen externe afhankelijkheden. Werkt standalone. Deelbaar als bestand.

Wat erin zit:

- Dagelijkse / uurlijkse / weekdagtrends — ontdek wanneer je de meeste tokens verbruikt
- Token breakdown (input, output, cache write, cache read) — zie wat de kosten drijft
- Kosten per session — bepaal welke taken duur waren
- 5-uurs window tijdlijn (Max Plan abonnees) — traceer rate limit triggers
- AI-gestuurde inzichtanalyse — interpreteert data en stelt verbeteringen voor
- 23 talen ondersteund (RTL inbegrepen; grafieken/tabellen blijven LTR)

```
/usage-view                  # Alle tijd, alle projecten
/usage-view current          # Alleen het huidige 5-uurs window
/usage-view last 7 days      # Laatste 7 dagen
/usage-view locale nl        # Nederlands
```

---

## 🔬 Rate Limit Onderzoek (/report-limit)

**Community-gedreven project om de rate limit formule te reverse-engineeren.**

Anthropic publiceert niet de exacte formule voor het 5-uurs window. Laten we het samen uitzoeken.

Wanneer je een rate limit raakt, voer je `/report-limit` uit. Je huidige gebruiksdata wordt automatisch ingediend als een GitHub Discussion. Hoe meer data we verzamelen, hoe duidelijker de formule wordt.

---

## 💡 Hoe Cache echt werkt

Claude Code stuurt de volledige gespreksgeschiedenis naar het model bij elke API call. "API call" betekent niet "een bericht dat je hebt getypt." Een enkele prompt triggert interne tool calls — Grep, Read, Edit, Write — en elk daarvan is een aparte API call. Een prompt kan makkelijk 10+ API calls veroorzaken.

Prompt cache verlaagt deze kosten met 90%. Maar cache heeft een levensduur.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 uur (ephemeral_1h)                  | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0,50/MTok                            | ＄0,50/MTok                             |
| Bij verlopen cache  | Volledige context opnieuw verzonden tegen volle prijs | Lage impact (context is klein)  |

Zelfs met een actieve cache lopen de kosten op. Hier is een extreem scenario om het verschil te laten zien.

### Scenario: Hele dag coderen (3u ochtend → 2u lunch/vergadering → 3u middag)

Voorwaarden: Opus 4 prijzen, 1 prompt per minuut, ~5 API calls per prompt (~300 calls/uur).

#### ❌ Zonder cc-token-saver

Het meeste werk gebeurt in de Main session. Context groeit snel.

| Fase        | Situatie                          | Context grootte              | Kosten                                 |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Ochtend 3u  | Coderen (voornamelijk in Main)    | 100K → 600K (gem. 350K)     | 900 calls × 350K × ＄0,50/M = ＄157,50  |
| Lunch/verg. | Afwezig voor 2 uur               | —                            | —                                      |
| Terugkomst  | Cache verlopen → volledige herverzending | 600K volle prijs       | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Terugkomst  | /compact (samenvatten)            | 600K → naar LLM gestuurd    | 600K × ＄0,50/M + samenvatting output = ~＄1,50 |
| Middag 3u   | Coderen gaat door (context groeit weer) | 100K → 600K (gem. 350K) | 900 calls × 350K × ＄0,50/M = ＄157,50  |
|             | Totaal                            |                              | ~＄326                                  |

> Bij dit gebruiksniveau raak je waarschijnlijk de 5-uurs window rate limit. **De kosten zijn al erg, maar het echte probleem is dat je werk volledig stopt. Dit is het exacte moment waarop Claude Code donker gaat.**

#### ✅ Met cc-token-saver

Zwaar werk wordt gedelegeerd aan SubTasks. Main behandelt alleen ontwerp/beslissingen.

| Fase        | Situatie                                     | Context grootte               | Kosten                             |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Ochtend 3u  | Coderen (Main: ontwerp, SubTask: implementatie) | Main 100K → 300K (gem. 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
| Lunch/verg. | Afwezig voor 2 uur                           | —                             | —                                  |
| Terugkomst  | ⚡ Token Guardian blokkeert → /clear + /continue | —                          | ＄0 (geen LLM calls)               |
| Middag 3u   | Coderen gaat door                            | Main 100K → 300K (gem. 200K) | 900 calls × 200K × ＄0,50/M = ＄90 |
|             | Totaal                                       |                               | ~＄180                              |

#### 💰 Resultaat

> **＄326 → ＄180. ＄146 bespaard per dag (45%).**
>
> Het gaat niet alleen om kosten. Minder tokens in dezelfde tijd betekent dat **je de rate limit niet raakt en kunt doorwerken.** Dat is het echte verschil.

### Waar cc-token-saver ingrijpt

```
[Session Start]
    │
    ├─ Session Architect → Injecteert automatisch SubTask delegatiepatroon
    │                       Houdt Main context onder 250K
    │
[Aan het werk]
    │
    ├─ Status Line → Realtime kosten/context/rate limit monitoring
    │                  Directe melding bij het bereiken van de waarschuwingszone
    │
[1+ uur inactief]
    │
    ├─ Token Guardian → Detecteert cache expiry, blokkeert voor herverzending
    │
[Session herstart]
    │
    └─ /continue → Herstelt vorige context zonder kosten (geen LLM calls)
```

---

## 🔧 Broninstallatie & Aanpassingen

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver is volledig open. De volledige broncode is gewoon JavaScript + Bash scripts volgens de standaard plugin structuur. Pas aan wat je wilt.

- **hooks/** — Wijzig de cache expiry drempel, pas waarschuwingsberichten aan, wijzig session architecture regels
- **scripts/** — Analyselogica, report builder, status line opmaak
- **skills/** — Hoe /continue en /usage-view werken, prompt templates
- **locales/** — Vertalingen toevoegen/bewerken, nieuwe talen toevoegen
- **skills/usage-view/** — Dashboard UI/UX aanpassingen

Maak het je eigen. Fork het, experimenteer en stuur een PR als je iets beters vindt.

---

## 🌐 Ondersteunde talen

23 talen ondersteund. Geselecteerd door de top 20 landen qua Claude Code gebruik te combineren met de top 20 talen qua wereldwijd aantal sprekers. De weergavetaal wordt automatisch gedetecteerd op basis van je OS locale. Je kunt het ook handmatig instellen: `/usage-view locale nl`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Engels     | 🇰🇷 Koreaans   | 🇯🇵 Japans    | 🇨🇳 Chinees    |
| 🇪🇸 Spaans     | 🇫🇷 Frans      | 🇩🇪 Duits     | 🇧🇷 Portugees  |
| 🇮🇹 Italiaans  | 🇷🇺 Russisch   | 🇸🇦 Arabisch  | 🇮🇳 Hindi      |
| 🇧🇩 Bengaals   | 🇮🇩 Indonesisch | 🇲🇾 Maleis   | 🇹🇭 Thai       |
| 🇻🇳 Vietnamees | 🇹🇷 Turks      | 🇵🇱 Pools     | 🇳🇱 Nederlands |
| 🇮🇱 Hebreeuws  | 🇸🇪 Zweeds     | 🇳🇴 Noors     |                 |

Huidige vertalingen zijn AI-gegenereerd. Bijdragen van moedertaalsprekers zijn welkom — bewerk het JSON-bestand voor jouw taal in `locales/` en dien een PR in.

---

## 💡 Tips

### Begrijp cache en je ziet waar het geld naartoe gaat

- **1 prompt ≠ 1 API call.** Elke keer dat Claude Grep, Read of Edit aanroept, wordt de volledige context opnieuw verzonden. Een enkele prompt triggert makkelijk 10+ API calls. Schrijf duidelijke prompts om onnodige tool calls te verminderen en kosten te drukken.
- **De cache timer reset vanaf de laatste API call, niet je laatste prompt.** Blijf werken en de cache verloopt nooit. Het gevaar zit in het weglopen. Token Guardian blokkeert eenmalig automatisch, zodat je bij terugkomst kunt kiezen: context resetten of doorgaan.
- **Context grootte = kostenvermenigvuldiger.** Dezelfde API call bij 200K vs 800K kost 4x meer. Wanneer de status line [CTX] 35% (🟡) overschrijdt, is dat je signaal om meer naar SubTasks te delegeren.

### Gewoontes die kosten verlagen

- **Houd CLAUDE.md lean.** Het wordt bij elke API call in de system prompt geladen. Elke regel kost geld.
- **Delegeer zwaar werk aan SubTasks.** Code generatie, multi-file bewerkingen en testruns horen niet in Main. SubTasks hebben een kleinere context en een goedkopere cache tier.
- **Langer dan 1 uur weg?** `/clear` → kom terug → `/continue`. Context hersteld voor $0.
- **[5H] boven 70% (🟡)?** Rustiger aan. Schakel over naar lichte reviewtaken of verhoog SubTask delegatie om het aantal API calls in Main te verminderen.
- **Gebruik `/btw` voor zijvragen.** Het komt niet in de gespreksgeschiedenis, waardoor je context lean blijft.

---

## License

Apache-2.0
