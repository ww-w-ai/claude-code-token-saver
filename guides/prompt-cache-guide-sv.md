# Cache-kostnadsguide — varfor storsta delen av dina kostnader gar till cache

Det ar normalt att storsta delen av kostnaderna for AI-kodningsverktyg kommer fran cache-operationer (skrivning + lasning). Det har dokumentet forklarar varfor och hur du hanterar det.

## Hemligheten: varje meddelande skickar hela konversationen pa nytt

LLM:er ar **tillstandslosa**. Till skillnad fran manniskor "minns" inte AI-modeller tidigare konversationer — de tar emot hela konversationshistoriken som input vid varje forfragan.

Det ser ut som en chatt, men de faktiska API-anropen fungerar sa har:

```
[ Forfragan 1 ]
→ Systemprompt + "Fixa den har buggen"
← AI-svar

[ Forfragan 2 ]
→ Systemprompt + "Fixa den har buggen" + AI-svar + "Lagg till tester ocksa"
← AI-svar

[ Forfragan 3 ]
→ Systemprompt + "Fixa den har buggen" + AI-svar + "Lagg till tester ocksa" + AI-svar + "Committa det"
← AI-svar
```

Varje forfragan inkluderar **allt** tidigare innehall. Till exempel innehaller den 50:e forfragan hela konversationen och alla AI-svar fran de foregaende 49 forfragningarna. Det ar darfor antalet inputtokens vaxer snabbt nar konversationen blir langre.

Dessutom skickar AI-kodningsverktyg systemprompten (inbyggda instruktioner, konfigurationsfiler, plugins, MCP-tooldefinitioner etc.) med varje forfragan — sa aven ett enradigt meddelande resulterar i tiotusentals inputtokens.

## Vad ar caching?

**Prompt caching** minskar kostnaden for upprepad transmission. Oforandrade delar av din input lagras pa servern sa att efterfoljande forfragningar kan ateranvanda dem till rabatterat pris.

- **Cache Write**: kostnaden for att lagra konversationsinnehall pa servern. Uppstar vid forsta forfragan eller efter att cachen har gatt ut.
- **Cache Read**: kostnaden for att ateranvanda redan lagrat innehall. Debiteras med **90 % rabatt** jamfort med standardinput.

AI-kodningsverktyg genererar oundvikligen langa konversationer och stora kontexter — upp till 1 miljon tokens per forfragan. Aven om din nya fraga ar kort debiteras hela den tidigare konversationen tillsammans med den, sa kostnaderna ackumuleras snabbt nar konversationen vaxer.

For att minska denna bordan ger ledande AI-leverantorer 90 % rabatt pa cache reads, vilket avsevert sanker kostnaden for att ateroverfora redan bearbetat innehall.

## Varfor dominerar cache den totala kostnaden?

| Kategori | Tokens per anrop | Kommentar |
|---|---|---|
| Anvandarinput (nya tokens) | Tiotal till hundratal | Vad anvandaren faktiskt skriver |
| AI-utdata | Hundratal till tusental | AI:s svar |
| **Cache read** | **100K–hundratusentals** | Hela den ackumulerade konversationen debiteras vid varje anrop |

Volymen cache reads per anrop ar **tusentals ganger** storre an inputen. Aven med 90 % rabatt dominerar cache reads i absoluta kronor.

Och dessa anrop kommer inte bara fran anvandarmeddelanden:

| Anropare | Frekvens | Cache Read per anrop |
|---|---|---|
| Anvandarmeddelanden | Nar anvandaren skickar ett meddelande | Hela den ackumulerade konversationen |
| **AI:s egna beslut** | **Flera anrop per anvandarmeddelande** | Hela den ackumulerade konversationen |

Osynligt for anvandaren fattar AI:n flera beslut i foljd for ett enda meddelande — val av verktyg, tolkning av resultat, beslut om nasta atgard. Vart och ett av dessa beslut ar ett fullstandigt LLM-anrop som inkluderar hela kontexten. Sjalva verktygskörningen (fillasning, sökning) sker lokalt, men beslutsfattandet fore och efter varje verktygskörning medfor cache read-kostnader.

### Varfor ar Cache Write-kostnaden ocksa hogre an forväntat?

Hos Anthropic kostar cache write 1,25x inputpriset (5-minuters-tier) eller 2x (1-timmes-tier). Med dessa multiplikatorer verkar det som att cache write inte borde overstiga 2x input-/outputkostnaden — men i praktiken tar cache write en mycket storre andel.

Tva orsaker:

| Orsak | Forklaring |
|---|---|
| **Systemprompt** | Tiotusentals tokens innan anvandaren skriver nagonting (med plugins/MCP). Allt detta belaggs med cache write-kostnader |
| **Aterskapande efter utgång** | Efter att TTL (5 min / 1 timme) har gatt ut maste hela den ackumulerade konversationen cachas om. Ju langre konversation, desto hogre aterskapandekostnad |

Med andra ord uppstar cache write inte bara for "nya tokens fran anvandaren." Vid sessionsstart cachas hela systemprompten; efter utgång blir hela den ackumulerade konversationen ett cache write-mal. Om cachen for en 100K-tokens-konversation gar ut utloser ett enda meddelande en cache write pa 100K tokens pa en gang.

**Det ar precis darfor super-token-saver-pluginen visar en cache-utgångsvarning efter 1 timmes inaktivitet.** Nar varningen visas, kontrollera din nuvarande kontextstorlek:

- **Liten kontext**: cache-aterskapandekostnaden ar hanterbar. Fortsatt arbeta — kostnaden ar lag.
- **Stor kontext**: cachekostnaden blir betydande. Vi rekommenderar `/clear` foljt av `/s-continue last` for att fortsatta i en ny session. Continue-farndigheten aterstaller automatiskt din tidigare konversationskontext, sa ditt arbetsflode avbryts inte.

## Strategier for att minska cachekostnader

super-token-saver-pluginen ar utformad for att automatisera eller forenkla alla dessa strategier.

### 1. Hall kontexten liten — `/clear` + `/s-continue` ⭐

**Det har ar det enskilt viktigaste sattet att minska kostnader.** Hoga cachekostnader innebar att du far 90 %-rabatten — det ar normalt. Men om kontexten vaxer i onodan och forblir stor okar den absoluta kostnaden per anrop aven med rabatten. **Att halla kontextstorleken under kontroll ar den enskilt mest effektiva kostnadsstrategin.**

Nar amnet andras eller konversationen blir lang, kor `/clear` for att aterstalla, sedan `/s-continue last` for att aterstalla kontexten. `/s-continue` aterstaller tidigare konversationer utan nagra LLM-anrop, sa kostnaden ar noll.

`/compact` minskar kontexten genom att sammanfatta konversationen, men sjalva sammanfattningen medfor LLM-anropskostnader och forlorar konversationsdetaljer. Rekommenderas inte.

### 2. Forhindra cache-utgång — Token Guardian (automatiskt)

Anthropics huvudsession använder **1-timmes-tier** for cache. Efter utgång maste forsta forfragan aterskapa hela konversationen som cache write, vilket ar dyrt.

super-token-saver upptacker 1 timmes inaktivitet och **visar automatiskt en varning**. Nar varningen visas ar det mest ekonomiska tillvagagangssattet att anvanda metod 1 ovan (`/clear` + `/s-continue`) for att fortsatta i en ny session.

### 3. Delegera tungt arbete till SubTasks

Tunga uppgifter som kodgenerering eller redigering av flera filer kan delegeras till SubTasks istallet for att koras direkt i huvudsessionen. SubTasks använder 5-minuters cache-tier, vilket gor **cache writes 37,5 % billigare**, och kor i en isolerad mindre kontext som minskar cache read-volymen per anrop.

super-token-saver varleder automatiskt till detta arbetsfordelningsmonster vid sessionsstart.

### 4. Realtidskostnadsovervakning — `/setup-statusline`

Installera `/setup-statusline` for att visa realtidskostnad/tokenstatus langst ner i CLI:t: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Du kan omedelbart upptacka onormalt hoga kostnader per anrop eller vaxande kontext och agera innan kostnaderna skenar.

### 5. Kostnadsmonsteranalys — `/usage-view`

Anvand `/usage-view` for att granska hela din anvandningshistorik som en dashboard. Visualisera dagliga/timvisa kostnadstrender, tokensammansattning per session och cache-effektivitet. Se i ett ogonkast vilka uppgifter som orsakade kostnadstoppar och vilka monster som ar ineffektiva.

### 6. Systemprompt-optimering

Ju fler plugins, MCP-servrar och fardigheter som laddas i systemprompten, desto hogre blir den initiala cache write-kostnaden. Ta bort allt du inte använder.

`/setup-git-lite` fran super-token-saver minskar Claude Codes standardmaossiga Git-instruktioner (~2 200 tokens) till en karna pa 280 tokens — en minskning pa cirka 88 % av Git-relaterad systemprompt per session.

### 7. Verktygsval — kontextpaverkan varierar per verktyg

Nar en fil har lasts stannar dess innehall i kontexten och ackumuleras i cache reads vid alla efterfoljande anrop. Att lasa en enda fil i sin helhet lagger till tusentals till tiotusentals tokens i kontexten, och det beloppet debiteras vid varje efterfoljande anrop.

Kodningsuppgifter involverar ofta flera filer samtidigt — att lasa bara 3-4 filer i sin helhet kan fa kontexten att vaxa dramatiskt. Att valja ratt verktyg gor en betydande skillnad for kontexttillvaxten.

| Verktyg | Syfte | Kontextpaverkan | Nar det ska anvandas |
|---|---|---|---|
| **Grep** | Sok kod efter monster | **Minimal** — returnerar bara matchande rader | Hitta specifika funktionsnamn, variabler, strangar |
| **Glob** | Sok filer efter namnmonster | **Minimal** — returnerar bara sokvagar | Hitta filer: `*.ts`, `src/**/*.test.js` |
| **LSP** | Symboldefinitioner, referenser, typer | **Minimal** — returnerar bara definitioner/signaturer | Ga till definition, hitta referenser, kontrollera typer |
| **Read** (offset/limit) | Las en specifik del av en fil | **Mattlig** — returnerar bara angivet intervall | Nar du behover ett specifikt radintervall |
| **Read** (hel) | Las hela filen | **Stor** — hela filen laggs till i kontexten | Bara nar du behover forsta hela filstrukturen |

"Las hela den har filen" använder tiotals till hundratals ganger mer kontext an "Hitta den har funktionen."

Samma princip galler for redigering och jamforelse:

| Verktyg | Syfte | Kontextpaverkan |
|---|---|---|
| **Edit** | Andm befintlig fil | **Minimal** — bara diffen laggs till i kontexten |
| **Write** | Skapa ny fil / fullstandig omskrivning | **Stor** — hela filen laggs till i kontexten |
| **git diff / diff** | Jamfor filer/mappar | **Minimal** — bara skillnader returneras |
| Las bada filer separat | Jamfor filer/mappar | **Stor** — bada fullstandiga filer laggs till i kontexten |

super-token-saver injicerar automatiskt denna verktygsguide till AI:n vid sessionsstart och uppmanar till att anvanda lättviktiga verktyg forst.

## Bilaga: cachejamforelse mellan AI-leverantorer

### Cachekostnader

| Leverantor | Cache Write-kostnad | Cache Read-rabatt | Cachelagringskostnad |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5-min-tier: 1,25x input<br/>1-timmes-tier: 2x input | 90 % rabatt | Ingen |
| **OpenAI**<br/>(Codex) | Ingen tillaggskostnad (samma som input) | 90 % rabatt | Ingen |
| **Google Gemini**<br/>(Gemini CLI) | Ingen tillaggskostnad (samma som input) | 90 % rabatt | Ingen |

> **Notera**: cache read-rabattsatser varierar per modell. Dessa siffror avspeglar varje leverantors senaste flaggskeppsmodeller.

### Cache Time-to-Live (TTL)

| Leverantor | TTL | Garanti |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minuter eller 1 timme | **Explicit definierat** |
| **OpenAI**<br/>(Codex) | Vanligtvis bortforsad efter 5-10 min inaktivitet; kan bestå upp till 1 timme under lagtrafik | **Inte garanterat** — officiell dokumentation använder "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Ej avslojat | **Inte garanterat** — explicit caching med garanterad TTL ar tillganglig via API (betald) |

> **Notera**: baserat pa vara experiment med Claude Code använder huvudsessioner vanligtvis 1-timmes-tier, medan SubTasks använder 5-minuters-tier.

### Ytterligare cache-kontrollalternativ via direkta API-anrop

Jamforelsen ovan ar fran perspektivet av användare av AI-kodningsverktyg (Claude Code, Codex, Gemini CLI). Utvecklare som anropar API:erna direkt har finare cache-kontroll.

**Anthropic**

- `cache_control`: satt brytpunkter for att explicit definiera cachegranser. Bestams automatiskt om det inte anges.
- TTL-tier (5 min / 1 timme) kan valjas per forfragan.

**OpenAI**

- `prompt_cache_key`: dirigerar forfragningar med samma nyckel till samma server, vilket forbattrar cache hit rate. Codex setter detta internt till `conversation_id` automatiskt.
- `prompt_cache_retention: "24h"`: forlangd cache-behallning. Forlanger standard 5-10 min till upp till 24 timmar (ingen extra kostnad, inte garanterat). Codex använder inte detta alternativ.

**Google Gemini**

- Explicit caching (`CachedContent`): satt TTL fran 1 min till 48 timmar for att garantera cache hits. Lagringsavgift tillfaller (\$4,50/MTok/timme for Pro). Uppdatering av cacheinnehall kraver manuellt skapande av nytt CachedContent. Gemini CLI använder inte denna funktion.

> **Notera**: dessa alternativ ar inte tillgangliga i AI-kodningsverktyg och kan inte direkt kontrolleras av användare. Användare av AI-kodningsverktyg bor hamvisa till avsnittet "Strategier for att minska cachekostnader" i huvudtexten.

### Kallor

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
