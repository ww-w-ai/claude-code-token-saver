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

## ✂️ Feature 5: /setup-git-lite — Verwijder CC's ingebouwde Git-instructies

**De verborgen 2.200 tokens per sessie die je zonder het te weten betaalt.**

### De ontdekking

Op 2026-04-12 onthulde een [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) dat de ingebouwde `includeGitInstructions`-instelling van Claude Code bij elke sessie stilletjes tokens verbrandt. Onafhankelijke reproductie via [deze gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bevestigde de cijfers: **+6.031 tokens in cache writes** per sessie na elke git commit, **+1.690 tokens in cache reads** bij elke API call.

### CC broncode-analyse — waar de tokens naartoe gaan

We hebben de tokens herleid naar twee onafhankelijke injectiepunten in de Claude Code broncode (v2.1.88):

**1. `gitStatus` snapshot (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` verzamelt branch + main branch + user.name + volledige status (tot 2000 tekens) + **recente 5 commits**
- Samengevoegd en toegevoegd aan de system prompt via `appendSystemContext` (`utils/api.ts:437`)
- Elke nieuwe commit, elk nieuw gewijzigd bestand, elke branch-wissel verandert de tekst → prefix cache invalidatie

**2. Commit/PR workflow-instructies (~1.700 tok) — Bash tool-omschrijving**
- `tools/BashTool/prompt.ts:53` voegt 60+ regels veiligheidsprotocol, stapsgewijze commitprocedure, HEREDOC-voorbeelden en PR-aanmaaktemplates toe aan de omschrijving van de `Bash`-tool
- Samen met de system prompt gecached, maar meegestuurd als `tools[]`-parameter

### Waarom het duur is

De cachestructuur (`utils/api.ts:321` `splitSysPromptPrefix`) heeft drie paden afhankelijk van of je actieve MCP-tools hebt:

- **Path A** (MCP actief — de meeste gebruikers): `gitStatus` zit in een `cacheScope: 'org'`-blok. Elke wijziging → heel blok opnieuw gecached bij volgende sessiestart → 6K tok `cache_create` miss.
- **Path B** (geen MCP): `gitStatus` gaat naar een `cacheScope: null` dynamisch blok, wat betekent dat het bij elke API call opnieuw wordt verstuurd als verse `input_tokens` — geen cache miss, maar ook geen cachebesparing.
- **Path C** (externe provider / experimentele bèta's uitgeschakeld): zelfde als Path A.

In typische interactieve sessies accumuleren de commit/PR-instructies (1,7K tok) **bij elke API call** via `cache_read`. Over een sessie van 100 calls bij Opus 4.7-prijzen is dat ruwweg **$0,08 per sessie** puur voor instructies die Claude's training al grotendeels dekt.

### Hoe cc-token-saver dit aanpakt

`/setup-git-lite` schakelt het native pad uit en injecteert een **gecureerde vervanging van 280 tokens** via een SessionStart hook. We hebben precies de dingen bewaard die Claudes standaardgedrag overschrijven (veiligheidsregels), en alles weggelaten wat Claude al van training kent (stapsgewijze workflows, PR-templates, gh-gebruikspatronen).

**Bewaard — 11 cruciale overschrijfregels** (de regels die Claudes standaard behulpzaamheid omzetten in voorzichtigheid):
- Nooit committen/pushen/amenden/PR/taggen/mergen zonder expliciete gebruikersaanvraag
- Nooit hooks overslaan, force-pushen naar main/master, destructieve bewerkingen uitvoeren, git config wijzigen
- Nooit bestanden committen die overeenkomen met `.env`, `credentials`, `*.pem`, `secret.*`
- Vermijd `git add -A` / `git add .`
- HEREDOC voor meervoudige commit-berichten + `Co-Authored-By: Claude`-trailer
- Nooit interactieve vlaggen gebruiken (-i), geen lege commits
- Als een pre-commit hook faalt → maak een NIEUWE commit (niet `--amend`)

**Weggelaten** — stapsgewijze commitworkflow (3 stappen), stapsgewijze PR-workflow (3 stappen), PR-titel/body-template, `gh`-commandoverwijzingen, `-uall`-vlagwaarschuwing, `--no-edit` met rebase-waarschuwing, `NEVER use TodoWrite or Agent tools during commit`-beperking. Dit is workflow-uitgebreidheid die Claude vanuit training alleen al correct samenstelt.

**Toegevoegd** — compacte git-statusregel: branch + HEAD short-sha + onderwerp + huidige status (tot 20 gewijzigde bestanden, anders een telling). Geen lijst van recente commits (Claude kan `git log` op aanvraag uitvoeren).

### Verwachte besparingen (Opus 4.7-prijzen, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Item | Origineel | Met setup-git-lite | Bespaard |
| ---- | --------- | ------------------ | -------- |
| System prompt laden (per nieuwe sessie) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Herhaalde calls in dezelfde sessie | ~1.700 tok cache_read/call | ~280 tok cache_read/call | ~1.420 tok/call |
| Sessie van 100 calls (Opus 4.7) | — | — | **~$0,11 bespaard** |
| 20 sessies/dag × 22 werkdagen | — | — | **~$48 bespaard/maand** |

### Gebruik

```bash
/setup-git-lite status     # Alleen-lezen diagnose — huidige staat + wat er zou veranderen
/setup-git-lite install    # CC native uitschakelen + onze minimale hook inschakelen
/setup-git-lite revert     # Standaard herstellen (agressief; zie hieronder)
/setup-git-lite dismiss    # De occasionele aanbevelingstip stilleggen
/setup-git-lite undismiss  # De tip opnieuw inschakelen
/setup-git-lite help       # Volledig gebruik
```

### Install-semantiek

`install` wijzigt **twee** plaatsen voor robuustheid:

1. `~/.claude/settings.json` — voegt `"includeGitInstructions": false` toe
2. Shell-profiel (`~/.zshrc`, `~/.bashrc`, enz.) — voegt een markerblok toe dat `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1` exporteert

Elk afzonderlijk is voldoende om CC native uit te schakelen; we stellen beide in zodat een omgevingsoverschrijving het native gedrag niet per ongeluk opnieuw inschakelt. De shell-wijziging wordt pas van kracht in nieuwe shells.

### Revert-semantiek — agressief

`revert` **verwijdert ALLE `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-exports uit je shell-profiel**, inclusief eventuele die je handmatig had toegevoegd vóór installatie van deze skill. Dit is opzettelijk — je hebt `revert` uitgevoerd, dus herstellen we de schone standaard. We maken altijd eerst een tijdgestempelde back-up van het shell-profiel.

Als je de omgevingsvariabele om andere redenen nodig hebt, noteer die dan vóór `revert` en voeg hem daarna opnieuw toe.

### Vóór het verwijderen van cc-token-saver

**Voer eerst `/setup-git-lite revert` uit**, anders blijf je achter met `includeGitInstructions: false` in je settings.json maar zonder vervangingshook (Claude krijgt helemaal geen git-begeleiding). Claude Code heeft momenteel geen plugin-uninstall lifecycle hook, dus we kunnen dit niet automatiseren.

### Afwegingen

Wat je verliest (en waarom dat meestal prima is):
- Claude ontvangt niet langer een voorberekende `git status` / `git log -n 5` bij sessiestart. Als je in een nieuwe sessie vraagt "wat is er gewijzigd?", voert Claude die commando's zelf uit (één extra tool call, ~300 tok).
- Claude ziet niet langer CC's canonieke 3-staps commitprocedure. In onze tests over honderden commit-flows handelt trainingsniveau kennis de kritieke gevallen af (HEREDOC-opmaak, geen `--amend`, geen force-push) omdat we die als expliciete regels bewaren.
- PR-body-template (`## Summary` + `## Test plan`) wordt niet geïnjecteerd. Als je precies dat formaat wilt, zet het dan in de CLAUDE.md van je project.

### Aanbevelingsbanner

Wanneer CC native git-instructies nog actief zijn op je machine, toont cc-token-saver een alinealange tip bij sessiestart **~20% van de tijd** (plus in `/usage-view`- en `/report-limit`-uitvoer). Permanent stilleggen met `/setup-git-lite dismiss`.

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
