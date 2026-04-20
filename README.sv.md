# cc-token-saver

> **Claude Code stryper dig hela tiden? Inte längre.**
>
> Spendera mindre, koda längre och se exakt vart dina tokens tar vägen — utan konfiguration.

Hur? Automatisk context-hantering, kostnadsövervakning i realtid och cache-medveten session-styrning — allt i ett plugin.

---

## 😤 Problemet: $200/mån och du kan fortfarande inte jobba klart

Claude Code Max Plan ($200/mån). Borde räcka. Det gör det inte.

**5 timmars rullande rate limit.** Du är mitt i ett kodflöde och det bara stannar. Ingen timer. Ingen beräknad väntetid. Bara vänta.

**Cache expiry.** Du kommer tillbaka från lunch. Det har gått över en timme. Du skickar en prompt och 900K tokens skickas om till fullt pris. Kostnad? $9 i en enda smäll.

**Osynliga kostnader.** Det finns inget sätt att se hur mycket du spenderar i realtid. Du märker det först när du träffar rate limit.

**Allt manuellt.** Context-storlek, cache expiry-timing, SubTask-delegering, session-rensning. Ingen kan hålla koll på allt detta och samtidigt koda.

cc-token-saver hanterar allt automatiskt. **Installera en gång. Klart.**

---

## 🚀 Installation

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Fungerar automatiskt efter installation. Ingen konfiguration. Kräver [Claude Code](https://claude.ai/claude-code) v2.1.71+.

För live-övervakning:

```
/setup-statusline install
```

---

## 🛡️ Funktion 1: Token Guardian

**Upptäcker cache expiry och blockerar automatiskt dyra omsändningar.**

Claude Codes prompt cache TTL är 1 timme. Gå iväg i mer än en timme och cachen går ut. Ditt nästa meddelande skickar om hela kontexten till fullt pris. Vid 900K tokens blir det $9 i en enda smäll.

Token Guardian spårar när det senaste svaret togs emot. Om mer än 3 590 sekunder har passerat (TTL minus 10 sekunders buffert) blockeras prompten och en varning visas.

```
🚨 Cache har gått ut (68m 23s inaktiv)

Prompt-cachen har gått ut. Att fortsätta skickar om hela kontexten.
Kostnaden kan öka avsevärt.

👉 /context — Kontrollera aktuell kontextanvändning innan du bestämmer dig
👉 /clear → /continue — Återställ, sedan återställ tidigare kontext (rekommenderat, lägst kostnad)
👉 Skicka igen — Fortsätt som det är (full re-cache-kostnad uppstår)
```

Skicka bara samma prompt igen efter varningen — den går igenom. Varningen utlöses bara en gång per inaktiv period, så den tjatar aldrig. Varningsmeddelanden visas på 23 språk baserat på ditt OS-locale.

**Resultat:** Dyra re-cache-kostnader förhindras automatiskt. Ingen insats krävs.

---

## 🧠 Funktion 2: Smart Session Architecture

**Installera det och kostnadsoptimerade arbetsmönster aktiveras automatiskt.**

De flesta användare gör allt i Main session. Filläsning, kodgenerering, testkörningar. All utdata hamnar i kontexten och skickas om med varje meddelande. Sessionen sväller. Kostnaderna skenar iväg.

Session Architect injicerar automatiskt en delegeringsstrategi vid session-start.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Roll             | Design, beslut, granskning       | Implementation, kodgenerering, multi-fil |
| Cache tier       | 1 timme (ephemeral_1h)            | 5 min                                 |
| Cache write-kostnad | ＄10/MTok                       | ＄6.25/MTok                            |
| Context-storlek  | ~94K i snitt                      | ~33K i snitt                          |

SubTasks har **37,5% billigare cache writes** än Main. Kontexten är också mycket mindre. Att delegera tungt arbete till SubTasks sänker kostnaderna dramatiskt.

**Resultat:** Claude arbetar automatiskt i ett kostnadseffektivt mönster. Du behöver inte tänka på det.

---

## 🔄 Funktion 3: /continue — Context Restoration

**Ersätter `/compact`. Noll LLM-anrop. Noll token-kostnad.**

`/compact` skickar hela din kontext (~1M tokens) till LLM:en för att komprimera den till en sammanfattning på 3,3%. Om cachen har gått ut utlöser det ensamt en full re-cache. Informationsförlust är oundviklig.

`/continue` tar ett helt annat grepp. Det förbehandlar föregående sessions transkript och läser in det direkt. Inget LLM-anrop. Ingen kostnad. Originalkonversationen återställs som den var.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Hur det fungerar        | Skickar full kontext till LLM för sammanfattning | Förbehandlar transkript, läser direkt |
| LLM-anrop              | Krävs (vanligtvis 100K+ tokens)   | 0                                |
| Token-kostnad           | Hög                               | 0                                |
| Informationsförlust     | Ja (3,3% sammanfattning)          | Ingen (originalet bevaras)       |
| Bearbetningshastighet   | Tiotals sekunder                   | < 1 sek (även 60MB+ filer)      |
| När cachen gått ut      | Full re-cache-kostnad ovanpå       | Ingen påverkan                   |
| Multi-session-återställning | Inte möjligt                  | Stöds                            |

Användning: `/clear` sedan `/continue`. Du ser en lista över tidigare sessioner. Välj en att återställa. För snabb återhämtning: `/continue last`.

**Resultat:** Återuppta tidigare arbete till nollkostnad. Ingen informationsförlust.

---

## 📊 Funktion 4: Live Status Line

**Token- och kostnadsövervakning i realtid. Under 50ms overhead.**

Kör `/setup-statusline install` en gång så visas ett permanent statusfält längst ner i Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indikator        | Vad den visar                       | 🟢 Normal | 🟡 Varning | 🔴 Kritisk  |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Kostnad för senaste API-anropet     | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (kumulativ)  | Ackumulerad kostnad för denna mapp  | —         | —          | —           |
| 5H               | 5-timmarsfönstrets användning + nedräkning | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context window-användning           | < 35%     | >= 35%     | >= 70%      |

När någon indikator når varning eller kritisk visas automatiskt ett `→ /usage-view current`-tips.

För att ta bort: `/setup-statusline uninstall` (tidigare konfiguration återställs automatiskt).

**Resultat:** Se din kostnadsstatus med en blick. Agera innan det är för sent.

---

## 📈 Användningspanel (/usage-view)

**Äntligen svar på: "Varför blev jag rate limited?"**

Hittills har rate limit bara gjort dig frustrerad. Inget sätt att ta reda på orsaken. Vilken session brände flest tokens? När sköt kostnaderna i höjden? Vilka mönster finns i din användning? Allt osynligt.

`/usage-view` visar allt. En interaktiv HTML-panel öppnas i din webbläsare där du kan analysera användningsmönster och spåra rotorsaken till kostnadstoppar. Inga externa beroenden. Fungerar fristående. Kan delas som fil.

Vad som ingår:

- Dagliga / timvisa / veckodags-kostnadstrender — upptäck när du bränner flest tokens
- Token-uppdelning (input, output, cache write, cache read) — se vad som driver kostnaderna
- Kostnadsanalys per session — identifiera vilka uppgifter som var dyra
- 5-timmarsfönstrets tidslinje (Max Plan-prenumeranter) — spåra rate limit-utlösare
- AI-driven insiktsanalys — tolkar data och föreslår förbättringar
- 23 språk stöds (RTL inkluderat; diagram/tabeller förblir LTR)

```
/usage-view                  # All tid, alla projekt
/usage-view current          # Enbart nuvarande 5-timmarsfönster
/usage-view last 7 days      # Senaste 7 dagarna
/usage-view locale sv        # Svenska
```

---

## 🔬 Rate Limit-forskning (/report-limit)

**Community-drivet projekt för att reverse-engineera rate limit-formeln.**

Anthropic publicerar inte den exakta formeln för 5-timmarsfönstret. Låt oss lista ut det tillsammans.

När du träffar en rate limit, kör `/report-limit`. Din aktuella användningsdata skickas automatiskt som en GitHub Discussion. Ju mer data vi samlar in, desto tydligare blir formeln.

---

## ✂️ Funktion 5: /setup-git-lite — Trimma CC:s inbyggda Git-instruktioner

**De dolda 2 200 tokens per session du inte visste att du betalade för.**

### Upptäckten

Den 2026-04-12 avslöjade ett [GitHub-ärende](https://github.com/anthropics/claude-code/issues/47107) att Claude Codes inbyggda `includeGitInstructions`-inställning tyst bränner tokens varje session. Oberoende reproduktion via [denna gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bekräftade siffrorna: **+6 031 tokens i cache writes** per session efter varje git-commit, **+1 690 tokens i cache reads** vid varje API-anrop.

### CC-källkodsanalys — var tokens tar vägen

Vi spårade tokens till två oberoende injektionspunkter i Claude Code-källkoden (v2.1.88):

**1. `gitStatus`-snapshot (~500 tok) — systemprompten**
- `context.ts:36-111` `getGitStatus()` samlar gren + huvudgren + user.name + fullständig status (upp till 2 000 tecken) + **senaste 5 commits**
- Sammanfogas och läggs till systemprompten via `appendSystemContext` (`utils/api.ts:437`)
- Varje ny commit, varje ny modifierad fil, varje grenväxling ändrar texten → prefix-cache-invalidering

**2. Commit/PR-arbetsflödesinstruktioner (~1 700 tok) — Bash-verktygets beskrivning**
- `tools/BashTool/prompt.ts:53` lägger till 60+ rader säkerhetsprotokoll, steg-för-steg commit-procedur, HEREDOC-exempel och PR-mallar i `Bash`-verktygets beskrivning
- Cachas tillsammans med systemprompten, men skickas som `tools[]`-parameter

### Varför det är dyrt

Cache-strukturen (`utils/api.ts:321` `splitSysPromptPrefix`) har tre vägar beroende på om du har aktiva MCP-verktyg:

- **Path A** (MCP aktiv — de flesta användare): `gitStatus` finns i ett `cacheScope: 'org'`-block. Varje ändring → hela blocket cachas om vid nästa sessionstart → 6K tok `cache_create`-miss.
- **Path B** (ingen MCP): `gitStatus` går till ett `cacheScope: null` dynamiskt block, vilket innebär att det skickas som färska `input_tokens` vid varje API-anrop — ingen cache-miss, men inga cache-besparingar heller.
- **Path C** (tredjepartsleverantör / experimentella betas inaktiverade): samma som Path A.

I typiska interaktiva sessioner ackumuleras commit/PR-instruktionerna (1,7K tok) **vid varje API-anrop** via `cache_read`. Över en session med 100 anrop till Opus 4.7-prissättning är det ungefär **$0,08 per session** enbart för instruktioner som Claude:s träning redan till stor del täcker.

### Hur cc-token-saver hanterar det

`/setup-git-lite` inaktiverar den ursprungliga vägen och injicerar en **kurerad ersättning på 280 tokens** via en SessionStart-hook. Vi behöll exakt det som åsidosätter Claude:s standardbeteende (säkerhetsregler), och tog bort allt som Claude redan känner till från träning (steg-för-steg-arbetsflöden, PR-mallar, gh-användningsmönster).

**Behållet — 11 kritiska åsidosättningsregler** (de som vänder Claude:s standardhängsynthet till försiktighet):
- Committa/pusha/ändra/PR/tagga/mergea aldrig utan explicit användarförfrågan
- Hoppa aldrig över hooks, force-pusha till main/master, kör destruktiva operationer eller modifiera git config
- Committa aldrig filer som matchar `.env`, `credentials`, `*.pem`, `secret.*`
- Undvik `git add -A` / `git add .`
- HEREDOC för flerradiga commit-meddelanden + `Co-Authored-By: Claude`-trailer
- Använd aldrig interaktiva flaggor (-i), inga tomma commits
- Om pre-commit-hook misslyckas → skapa en NY commit (inte `--amend`)

**Borttaget** — steg-för-steg commit-arbetsflöde (3 steg), steg-för-steg PR-arbetsflöde (3 steg), PR-titel/brödtext-mall, `gh`-kommandoreferenser, `-uall`-flaggvarning, `--no-edit` med rebase-varning, `NEVER use TodoWrite or Agent tools during commit`-begränsning. Detta är arbetsflödets verbositet som Claude sammansätter korrekt från träning ensamt.

**Tillagt** — kompakt git-statusrad: gren + HEAD short-sha + ämne + aktuell status (upp till 20 modifierade filer, annars ett antal). Ingen lista med senaste commits (Claude kan köra `git log` vid behov).

### Förväntade besparingar (Opus 4.7-prissättning, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Post | Original | Med setup-git-lite | Sparat |
| ---- | -------- | ------------------- | ------ |
| Systempromptnladdning (per ny session) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Upprepade anrop i samma session | ~1 700 tok cache_read/anrop | ~280 tok cache_read/anrop | ~1 420 tok/anrop |
| 100-anropssession (Opus 4.7) | — | — | **~$0,11 sparat** |
| 20 sessioner/dag × 22 arbetsdagar | — | — | **~$48 sparat/månad** |

### Användning

```bash
/setup-git-lite status     # Skrivskyddad diagnostik — aktuellt tillstånd + vad som skulle ändras
/setup-git-lite install    # Inaktivera CC:s ursprungliga + aktivera vår minimala hook
/setup-git-lite revert     # Återställ standard (aggressiv; se nedan)
/setup-git-lite dismiss    # Tysta det tillfälliga rekommendationstipset
/setup-git-lite undismiss  # Återaktivera tipset
/setup-git-lite help       # Fullständig användning
```

### Install-semantik

`install` modifierar **två** platser för robusthet:

1. `~/.claude/settings.json` — lägger till `"includeGitInstructions": false`
2. Skalprofi (`~/.zshrc`, `~/.bashrc` osv.) — lägger till ett markeringsblock som exporterar `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Endera räcker för att inaktivera CC:s ursprungliga beteende; vi ställer in båda så att en miljövariabeåsidosättning inte av misstag återaktiverar det ursprungliga beteendet. Skaländringen träder i kraft i nya skal.

### Revert-semantik — aggressiv

`revert` **tar bort ALLA `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-exporter från din skalprofil**, inklusive sådana du kanske har lagt till manuellt innan du installerade den här skickligheten. Detta är avsiktligt — du körde `revert`, så vi återställer det rena standardvärdet. Vi skapar alltid en tidsstämplad säkerhetskopia av skalprofilen först.

Om du behöver miljövariabeln av orelaterade skäl, notera den innan du kör `revert` och lägg till den igen efteråt.

### Innan du avinstallerar cc-token-saver

**Kör `/setup-git-lite revert` först**, annars lämnas du med `includeGitInstructions: false` i din settings.json men utan ersättningshook (Claude får ingen git-vägledning alls). Claude Code har för närvarande ingen plugin-avinstallationslivscykelhook, så vi kan inte automatisera detta.

### Avvägningar

Vad du förlorar (och varför det oftast är okej):
- Claude får inte längre ett förberäknat `git status` / `git log -n 5` vid sessionstart. Om du frågar "vad har ändrats?" i en ny session kör Claude dessa kommandon själv (ett extra verktygsanrop, ~300 tok).
- Claude ser inte längre CC:s kanoniska 3-stegs commit-procedur. I våra tester över hundratals commit-flöden hanterar träningsnivåkunskapen de kritiska fallen (HEREDOC-formatering, ingen `--amend`, ingen force-push) eftersom vi behåller dessa som explicita regler.
- PR-brödtext-mallen (`## Summary` + `## Test plan`) injiceras inte. Om du bryr dig om exakt det formatet, lägg in det i ditt projekts CLAUDE.md.

### Rekommendationsbanner

När CC:s ursprungliga git-instruktioner fortfarande är aktiva på din dator visar cc-token-saver ett enstegs-tips vid sessionstart **~20% av gångerna** (plus i `/usage-view`- och `/report-limit`-utdata). Stäng av permanent med `/setup-git-lite dismiss`.

---

## 💡 Hur Cache faktiskt fungerar

Claude Code skickar hela konversationshistoriken till modellen vid varje API-anrop. "API-anrop" betyder inte "ett meddelande du skrev." En enda prompt utlöser interna tool calls — Grep, Read, Edit, Write — och var och en är ett separat API-anrop. En prompt kan lätt orsaka 10+ API-anrop.

Prompt cache reducerar denna kostnad med 90%. Men cache har en livslängd.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 timme (ephemeral_1h)                | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| När cachen går ut   | Full kontext skickas om till fullt pris | Låg påverkan (kontexten är liten)      |

Även med aktiv cache ackumuleras kostnader. Här är ett extremt scenario för att visa skillnaden.

### Scenario: Heldagskodning (3h förmiddag → 2h lunch/möte → 3h eftermiddag)

Förutsättningar: Opus 4-prissättning, 1 prompt per minut, ~5 API-anrop per prompt (~300 anrop/timme).

#### ❌ Utan cc-token-saver

Det mesta arbetet sker i Main session. Kontexten växer snabbt.

| Fas         | Situation                         | Context-storlek              | Kostnad                                |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Förmiddag 3h | Kodning (mestadels i Main)       | 100K → 600K (snitt 350K)    | 900 anrop × 350K × ＄0.50/M = ＄157.50  |
| Lunch/möte  | Borta i 2 timmar                  | —                            | —                                      |
| Tillbaka    | Cache utgången → full omsändning  | 600K fullt pris              | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Tillbaka    | /compact (sammanfatta)            | 600K → skickas till LLM      | 600K × ＄0.50/M + sammanfattningsutdata = ~＄1.50 |
| Eftermiddag 3h | Kodning fortsätter (kontexten växer igen) | 100K → 600K (snitt 350K) | 900 anrop × 350K × ＄0.50/M = ＄157.50  |
|             | Totalt                            |                              | ~＄326                                  |

> Vid denna användningsnivå träffar du troligtvis 5-timmarsfönstrets rate limit. **Kostnaden är illa nog, men det verkliga problemet är att ditt arbete stannar helt. Det är exakt det ögonblick Claude Code slocknar.**

#### ✅ Med cc-token-saver

Tungt arbete delegeras till SubTasks. Main hanterar enbart design/beslut.

| Fas         | Situation                                    | Context-storlek               | Kostnad                            |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Förmiddag 3h | Kodning (Main: design, SubTask: implementation) | Main 100K → 300K (snitt 200K) | 900 anrop × 200K × ＄0.50/M = ＄90 |
| Lunch/möte  | Borta i 2 timmar                             | —                             | —                                  |
| Tillbaka    | ⚡ Token Guardian blockerar → /clear + /continue | —                          | ＄0 (inga LLM-anrop)               |
| Eftermiddag 3h | Kodning fortsätter                          | Main 100K → 300K (snitt 200K) | 900 anrop × 200K × ＄0.50/M = ＄90 |
|             | Totalt                                       |                               | ~＄180                              |

#### 💰 Resultat

> **＄326 → ＄180. ＄146 sparat per dag (45%).**
>
> Det handlar inte bara om kostnad. Färre tokens på samma tid innebär att **du inte träffar rate limit och kan fortsätta jobba.** Det är den verkliga skillnaden.

### Var cc-token-saver griper in

```
[Session Start]
    │
    ├─ Session Architect → Injicerar SubTask-delegeringsmönster automatiskt
    │                       Håller Main-kontexten under 250K
    │
[Arbetar]
    │
    ├─ Status Line → Kostnads-/context-/rate limit-övervakning i realtid
    │                  Omedelbar varning vid ingång i varningszon
    │
[1+ timmes inaktivitet]
    │
    ├─ Token Guardian → Upptäcker cache expiry, blockerar före omsändning
    │
[Session-omstart]
    │
    └─ /continue → Återställer tidigare kontext till nollkostnad (inga LLM-anrop)
```

---

## 🔧 Källinstallation & anpassning

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver är helt öppet. All källkod är vanlig JavaScript + Bash-skript som följer standardpluginstrukturen. Ändra vad du vill.

- **hooks/** — Ändra cache expiry-tröskelvärde, anpassa varningsmeddelanden, modifiera session architecture-regler
- **scripts/** — Analyslogik, rapportbyggare, status line-formatering
- **skills/** — Hur /continue och /usage-view fungerar, prompt-mallar
- **locales/** — Lägg till/redigera översättningar, lägg till nya språk
- **skills/usage-view/** — Ändringar av dashboard-UI/UX-design

Gör det till ditt. Forka, experimentera och skicka en PR om du hittar något bättre.

---

## 🌐 Språk som stöds

23 språk stöds. Urvalet baseras på en korsreferens mellan de 20 länder med mest Claude Code-användning och de 20 största språken efter antal talare globalt. Visningsspråket detekteras automatiskt från ditt OS-locale. Du kan även ange det manuellt: `/usage-view locale sv`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Engelska   | 🇰🇷 Koreanska  | 🇯🇵 Japanska  | 🇨🇳 Kinesiska  |
| 🇪🇸 Spanska    | 🇫🇷 Franska    | 🇩🇪 Tyska     | 🇧🇷 Portugisiska |
| 🇮🇹 Italienska | 🇷🇺 Ryska      | 🇸🇦 Arabiska  | 🇮🇳 Hindi      |
| 🇧🇩 Bengaliska | 🇮🇩 Indonesiska | 🇲🇾 Malajiska | 🇹🇭 Thailändska |
| 🇻🇳 Vietnamesiska | 🇹🇷 Turkiska | 🇵🇱 Polska    | 🇳🇱 Nederländska |
| 🇮🇱 Hebreiska  | 🇸🇪 Svenska    | 🇳🇴 Norska    |                 |

Nuvarande översättningar är AI-genererade. Bidrag från modersmålstalare är välkomna — redigera JSON-filen för ditt språk i `locales/` och skicka en PR.

---

## 💡 Tips

### Förstå cache så ser du vart pengarna går

- **1 prompt ≠ 1 API-anrop.** Varje gång Claude anropar Grep, Read eller Edit skickas hela kontexten om. En enda prompt utlöser lätt 10+ API-anrop. Skriv tydliga promptar för att minska onödiga tool calls och sänka kostnaderna.
- **Cache-timern nollställs från det senaste API-anropet, inte din senaste prompt.** Fortsätt jobba och cachen går aldrig ut. Faran är att gå iväg. Token Guardian blockerar automatiskt en gång, så när du kommer tillbaka kan du välja: nollställ kontexten eller fortsätt som det är.
- **Context-storlek = kostnadsmultiplikator.** Samma API-anrop vid 200K jämfört med 800K kostar 4x mer. När status line [CTX] passerar 35% (🟡) är det dags att delegera mer till SubTasks.

### Vanor som sänker kostnaderna

- **Håll CLAUDE.md slimmad.** Den laddas in i systemprompten vid varje API-anrop. Varje rad kostar pengar.
- **Delegera tungt arbete till SubTasks.** Kodgenerering, multi-filredigeringar och testkörningar hör inte hemma i Main. SubTasks har mindre kontext och en billigare cache tier.
- **Borta i 1+ timmar?** `/clear` → kom tillbaka → `/continue`. Kontexten återställs till $0.
- **[5H] över 70% (🟡)?** Sakta ner. Byt till lättare granskningsuppgifter eller öka SubTask-delegeringen för att minska Mains antal API-anrop.
- **Använd `/btw` för sidofrågor.** Det hamnar inte i konversationshistoriken, så din kontext hålls slimmad.

---

## License

Apache-2.0
