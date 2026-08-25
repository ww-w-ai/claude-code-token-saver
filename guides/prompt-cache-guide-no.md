# Cache-kostnadsguide — hvorfor det meste av kostnadene dine gar til cache

Det er normalt at storstedelen av kostnadene for AI-kodingsverktoy kommer fra cache-operasjoner (skriving + lesing). Dette dokumentet forklarer hvorfor, og hvordan du handterer det.

## Hemmeligheten: hver melding sender hele samtalen pa nytt

LLM-er er **tilstandslose**. I motsetning til mennesker "husker" ikke AI-modeller tidligere samtaler — de mottar hele samtalehistorikken som input ved hver foresporsel.

Det ser ut som en chat, men de faktiske API-kallene fungerer slik:

```
[ Foresporsel 1 ]
→ Systemprompt + "Fiks denne buggen"
← AI-svar

[ Foresporsel 2 ]
→ Systemprompt + "Fiks denne buggen" + AI-svar + "Legg til tester ogsa"
← AI-svar

[ Foresporsel 3 ]
→ Systemprompt + "Fiks denne buggen" + AI-svar + "Legg til tester ogsa" + AI-svar + "Commit det"
← AI-svar
```

Hver foresporsel inkluderer **alt** tidligere innhold. For eksempel inneholder den 50. foresporselen hele samtalen og alle AI-svar fra de foregaende 49 foresporslene. Derfor vokser antallet inputtokens raskt ettersom samtalen blir lengre.

I tillegg sender AI-kodingsverktoy systemprompten (innebygde instruksjoner, konfigurasjonsfiler, plugins, MCP-verktoydefinisjoner osv.) med hver foresporsel — sa selv en enlinjers melding resulterer i titusenvis av inputtokens.

## Hva er caching?

**Prompt caching** reduserer kostnadene ved gjentatt overføring. Uendrede deler av inputen din lagres pa serveren slik at pafolgende foresporsler kan gjenbruke dem til rabattert pris.

- **Cache Write**: kostnaden for a lagre samtaleinnhold pa serveren. Oppstar ved forste foresporsel eller etter at cachen har utlopt.
- **Cache Read**: kostnaden for a gjenbruke allerede lagret innhold. Belastes med **90 % rabatt** sammenlignet med standard input.

AI-kodingsverktoy genererer uunngaelig lange samtaler og store kontekster — opptil 1 million tokens per foresporsel. Selv om det nye sporsmalet ditt er kort, faktureres hele den tidligere samtalen sammen med det, sa kostnadene akkumuleres raskt nar samtalen vokser.

For a redusere denne byrden gir ledende AI-leverandorer 90 % rabatt pa cache reads, noe som betydelig senker kostnadene ved a overføre allerede bearbeidet innhold pa nytt.

## Hvorfor dominerer cache totalkostnaden?

| Kategori | Tokens per kall | Merknad |
|---|---|---|
| Brukerinput (nye tokens) | Titalls til hundretalls | Det brukeren faktisk skriver |
| AI-output | Hundretalls til tusentalls | AI-ens svar |
| **Cache read** | **100K–hundretusener** | Hele den akkumulerte samtalen faktureres ved hvert kall |

Volumet av cache reads per kall er **tusenvis av ganger** storre enn inputen. Selv med 90 % rabatt dominerer cache reads i absolutte kroner.

Og disse kallene kommer ikke bare fra brukermeldinger:

| Kaller | Frekvens | Cache Read per kall |
|---|---|---|
| Brukermeldinger | Nar brukeren sender en melding | Hele den akkumulerte samtalen |
| **AI-ens egne beslutninger** | **Flere kall per brukermelding** | Hele den akkumulerte samtalen |

Usynlig for brukeren tar AI-en flere beslutninger i rekkefølge for en enkelt melding — valg av verktoy, tolkning av resultatet, beslutning om neste handling. Hver av disse beslutningene er et fullstendig LLM-kall som inkluderer hele konteksten. Selve verktoykjoringen (fillesing, sok) skjer lokalt, men beslutningsprosessen for og etter hver verktoybruk medører cache read-kostnader.

### Hvorfor er Cache Write-kostnaden ogsa høyere enn forventet?

Hos Anthropic koster cache write 1,25x inputprisen (5-minutters-tier) eller 2x (1-times-tier). Med disse multiplene ser det ut som cache write ikke burde overstige 2x input-/outputkostnaden — men i praksis tar cache write en mye storre andel.

To arsaker:

| Arsak | Forklaring |
|---|---|
| **Systemprompt** | Titusenvis av tokens for brukeren skriver noe som helst (med plugins/MCP). Alt dette belastes med cache write-kostnader |
| **Gjenskaping etter utlop** | Etter at TTL (5 min / 1 time) utloper, ma hele den akkumulerte samtalen caches pa nytt. Jo lengre samtale, desto høyere gjenskapingskostnad |

Med andre ord oppstar cache write ikke bare for «nye tokens fra brukeren». Ved sesjonsstart caches hele systemprompten; etter utlop blir hele den akkumulerte samtalen et cache write-mal. Hvis cachen for en 100K-tokens-samtale utloper, utloser en enkelt melding en cache write pa 100K tokens pa en gang.

**Det er nettopp derfor super-token-saver-pluginen viser en cache-utlopsadvarsel etter 1 times inaktivitet.** Nar advarselen vises, sjekk din navarende kontekststorrelse:

- **Liten kontekst**: cache-gjenskapingskostnaden er handterbar. Bare fortsett a jobbe — kostnaden er lav.
- **Stor kontekst**: cachekostnaden blir betydelig. Vi anbefaler `/clear` etterfulgt av `/s-continue last` for a fortsette i en ny sesjon. Continue-ferdigheten gjenoppretter automatisk konteksten fra forrige samtale, sa arbeidsflyten din avbrytes ikke.

## Strategier for a redusere cachekostnader

super-token-saver-pluginen er designet for a automatisere eller forenkle alle disse strategiene.

### 1. Hold konteksten liten — `/clear` + `/s-continue` ⭐

**Dette er den aller viktigste maten a redusere kostnader pa.** Høye cachekostnader betyr at du far 90 %-rabatten — det er normalt. Men hvis konteksten vokser unødvendig og forblir stor, oker den absolutte kostnaden per kall selv med rabatten. **A holde kontekststorrelsen under kontroll er den mest effektive kostnadsstrategien.**

Nar temaet endres eller samtalen blir lang, kjor `/clear` for a tilbakestille, deretter `/s-continue last` for a gjenopprette konteksten. `/s-continue` gjenoppretter tidligere samtaler uten noen LLM-kall, sa kostnaden er null.

`/compact` reduserer konteksten ved a oppsummere samtalen, men selve oppsummeringsprosessen medører LLM-kall-kostnader og mister samtaledetaljer. Anbefales ikke.

### 2. Forhindre cache-utlop — Token Guardian (automatisk)

Anthropics hovedsesjon bruker **1-times-tier** for cache. Etter utlop ma forste foresporsel gjenskape hele samtalen som cache write, noe som er dyrt.

super-token-saver oppdager 1 times inaktivitet og **viser automatisk en advarsel**. Nar advarselen vises, er det mest okonomiske a bruke metode 1 ovenfor (`/clear` + `/s-continue`) for a fortsette i en ny sesjon.

### 3. Deleger tungt arbeid til SubTasks

Tunge oppgaver som kodegenerering eller redigering av flere filer kan delegeres til SubTasks i stedet for a kjore dem direkte i hovedsesjonen. SubTasks bruker 5-minutters cache-tier, noe som gjor **cache writes 37,5 % billigere**, og kjorer i en isolert mindre kontekst som reduserer cache read-volumet per kall.

super-token-saver veileder automatisk mot dette arbeidsfordelingsmonsteret ved sesjonsstart.

### 4. Sanntids kostnadsovervaking — `/setup-statusline`

Installer `/setup-statusline` for a vise sanntidskostnad/tokenstatus nederst i CLI-et: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Du kan umiddelbart oppdage unormalt høye kostnader per kall eller voksende kontekst og handle for kostnadene eskalerer.

### 5. Kostnadsmønsteranalyse — `/usage-view`

Bruk `/usage-view` for a se hele brukshistorikken din som et dashboard. Visualiser daglige/timebaserte kostnadstrender, tokensammensetning per sesjon og cache-effektivitet. Se med et blikk hvilke oppgaver som forarsaker kostnadstopper og hvilke monstre som er ineffektive.

### 6. Systemprompt-optimalisering

Jo flere plugins, MCP-servere og ferdigheter som lastes i systemprompten, desto høyere blir den initielle cache write-kostnaden. Fjern alt du ikke bruker.

`/setup-git-lite` fra super-token-saver reduserer Claude Codes standard Git-instruksjoner (~2 200 tokens) til en kjerne pa 280 tokens — en reduksjon pa omtrent 88 % i Git-relatert systemprompt per sesjon.

### 7. Verktoyvalg — kontekstpavirkning varierer per verktoy

Nar en fil er lest, forblir innholdet i konteksten og akkumuleres i cache reads ved alle pafolgende kall. A lese en enkelt fil i sin helhet legger til tusenvis til titusenvis av tokens i konteksten, og det belopet faktureres ved hvert pafolgende kall.

Kodingsoppgaver involverer ofte flere filer samtidig — a lese bare 3-4 filer i sin helhet kan fa konteksten til a vokse dramatisk. A velge riktig verktoy gjor en betydelig forskjell for kontekstveksten.

| Verktoy | Formal | Kontekstpavirkning | Nar det bor brukes |
|---|---|---|---|
| **Grep** | Sok i kode etter monster | **Minimal** — returnerer bare matchende linjer | Finne spesifikke funksjonsnavn, variabler, strenger |
| **Glob** | Sok filer etter navnemonster | **Minimal** — returnerer bare filstier | Finne filer: `*.ts`, `src/**/*.test.js` |
| **LSP** | Symboldefinisjoner, referanser, typer | **Minimal** — returnerer bare definisjoner/signaturer | Ga til definisjon, finn referanser, sjekk typer |
| **Read** (offset/limit) | Les en spesifikk del av en fil | **Moderat** — returnerer bare angitt omrade | Nar du trenger et spesifikt linjeomrade |
| **Read** (hel) | Les hele filen | **Stor** — hele filen legges til i konteksten | Bare nar du ma forsta hele filstrukturen |

«Les hele denne filen» bruker titalls til hundretalls ganger mer kontekst enn «Finn denne funksjonen».

Samme prinsipp gjelder for redigering og sammenligning:

| Verktoy | Formal | Kontekstpavirkning |
|---|---|---|
| **Edit** | Endre eksisterende fil | **Minimal** — bare diffen legges til i konteksten |
| **Write** | Opprette ny fil / fullstendig omskriving | **Stor** — hele filen legges til i konteksten |
| **git diff / diff** | Sammenligne filer/mapper | **Minimal** — bare forskjeller returneres |
| Lese begge filer separat | Sammenligne filer/mapper | **Stor** — begge fullstendige filer legges til i konteksten |

super-token-saver injiserer automatisk denne verktoyguiden til AI-en ved sesjonsstart og oppfordrer til a bruke lette verktoy forst.

## Vedlegg: cachejammenforing mellom AI-leverandorer

### Cachekostnader

| Leverandor | Cache Write-kostnad | Cache Read-rabatt | Cachelagringskostnad |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5-min-tier: 1,25x input<br/>1-times-tier: 2x input | 90 % rabatt | Ingen |
| **OpenAI**<br/>(Codex) | Ingen tilleggskostnad (lik input) | 90 % rabatt | Ingen |
| **Google Gemini**<br/>(Gemini CLI) | Ingen tilleggskostnad (lik input) | 90 % rabatt | Ingen |

> **Merk**: cache read-rabattsatser varierer per modell. Disse tallene gjenspeiler hver leverandors nyeste flaggskipmodeller.

### Cache Time-to-Live (TTL)

| Leverandor | TTL | Garanti |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minutter eller 1 time | **Eksplisitt definert** |
| **OpenAI**<br/>(Codex) | Vanligvis fjernet etter 5-10 min inaktivitet; kan vedvare opptil 1 time i lavtrafikkperioder | **Ikke garantert** — offisiell dokumentasjon bruker "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Ikke opplyst | **Ikke garantert** — eksplisitt caching med garantert TTL er tilgjengelig via API (betalt) |

> **Merk**: basert pa vare eksperimenter med Claude Code bruker hovedsesjoner vanligvis 1-times-tier, mens SubTasks bruker 5-minutters-tier.

### Ytterligere cache-kontrollalternativer via direkte API-kall

Sammenligningen ovenfor er fra perspektivet til brukere av AI-kodingsverktoy (Claude Code, Codex, Gemini CLI). Utviklere som kaller API-ene direkte har mer finkornet cache-kontroll.

**Anthropic**

- `cache_control`: sett brytepunkter for a eksplisitt definere cachegrenser. Bestemmes automatisk hvis ikke angitt.
- TTL-tier (5 min / 1 time) kan velges per foresporsel.

**OpenAI**

- `prompt_cache_key`: ruter foresporsler med samme nokkel til samme server, noe som forbedrer cache hit rate. Codex setter dette internt til `conversation_id` automatisk.
- `prompt_cache_retention: "24h"`: utvidet cache-bevaring. Forlenger standard 5-10 min til opptil 24 timer (ingen ekstra kostnad, ikke garantert). Codex bruker ikke dette alternativet.

**Google Gemini**

- Eksplisitt caching (`CachedContent`): sett TTL fra 1 min til 48 timer for a garantere cache hits. Lagringsavgift palopne (\$4,50/MTok/time for Pro). Oppdatering av cacheinnhold krever manuell opprettelse av nytt CachedContent. Gemini CLI bruker ikke denne funksjonen.

> **Merk**: disse alternativene er ikke tilgjengelige i AI-kodingsverktoy og kan ikke kontrolleres direkte av brukere. Brukere av AI-kodingsverktoy bor se avsnittet «Strategier for a redusere cachekostnader» i hovedteksten.

### Kilder

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
