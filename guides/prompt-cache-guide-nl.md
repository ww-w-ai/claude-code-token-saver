# Cache-kostengids — waarom het grootste deel van je kosten naar cache gaat

Het is normaal dat het grootste deel van de kosten van AI-codeertools voortkomt uit cache-operaties (schrijven + lezen). Dit document legt uit waarom dat zo is en hoe je dit kunt beheersen.

## Het geheim: elk bericht stuurt het volledige gesprek opnieuw

LLM's zijn **stateless**. In tegenstelling tot mensen 'onthouden' AI-modellen het vorige gesprek niet — ze ontvangen de volledige gespreksgeschiedenis als input bij elk verzoek.

Het lijkt op een chat, maar de daadwerkelijke API-aanroepen werken zo:

```
[ Verzoek 1 ]
→ Systeemprompt + "Fix deze bug"
← AI-antwoord

[ Verzoek 2 ]
→ Systeemprompt + "Fix deze bug" + AI-antwoord + "Voeg ook tests toe"
← AI-antwoord

[ Verzoek 3 ]
→ Systeemprompt + "Fix deze bug" + AI-antwoord + "Voeg ook tests toe" + AI-antwoord + "Commit het"
← AI-antwoord
```

Elk verzoek bevat **alle** voorgaande content. Het 50e verzoek bevat bijvoorbeeld het volledige gesprek en alle AI-antwoorden van de vorige 49 verzoeken. Daarom groeit het aantal inputtokens snel naarmate het gesprek langer wordt.

Bovendien sturen AI-codeertools de systeemprompt (ingebouwde instructies, configuratiebestanden, plugins, MCP-tooldefinities, enz.) mee bij elk verzoek — waardoor zelfs een eenregelig bericht tienduizenden inputtokens oplevert.

## Wat is caching?

**Prompt caching** verlaagt de kosten van herhaalde transmissie. Ongewijzigde delen van je input worden op de server opgeslagen, zodat volgende verzoeken ze met korting kunnen hergebruiken.

- **Cache Write**: de kosten van het opslaan van gespreksinhoud op de server. Treedt op bij het eerste verzoek of na het verlopen van de cache.
- **Cache Read**: de kosten van het hergebruiken van al opgeslagen inhoud. Wordt aangerekend met **90% korting** ten opzichte van standaardinvoer.

AI-codeertools produceren onvermijdelijk lange gesprekken en grote contexten — tot 1 miljoen tokens per verzoek. Zelfs als je nieuwe vraag kort is, wordt het volledige vorige gesprek mee in rekening gebracht, waardoor de kosten snel oplopen naarmate het gesprek groeit.

Om deze last te verlichten bieden grote AI-aanbieders 90% korting op cache reads, wat de kosten van het opnieuw verzenden van al verwerkte inhoud aanzienlijk verlaagt.

## Waarom domineert cache de totale kosten?

| Categorie | Tokens per aanroep | Opmerking |
|---|---|---|
| Gebruikersinvoer (nieuwe tokens) | Tientallen tot honderden | Wat de gebruiker daadwerkelijk typt |
| AI-uitvoer | Honderden tot duizenden | Het antwoord van de AI |
| **Cache read** | **100K–honderdduizenden** | Het volledige opgebouwde gesprek wordt bij elke aanroep in rekening gebracht |

Het volume aan cache reads per aanroep is **duizenden keren** groter dan de invoer. Zelfs met 90% korting domineert cache read in absolute bedragen.

En deze aanroepen komen niet alleen van gebruikersberichten:

| Aanroeper | Frequentie | Cache Read per aanroep |
|---|---|---|
| Gebruikersberichten | Bij het versturen van een bericht | Volledig opgebouwd gesprek |
| **Eigen beslissingen van de AI** | **Meerdere aanroepen per gebruikersbericht** | Volledig opgebouwd gesprek |

Onzichtbaar voor de gebruiker neemt de AI meerdere beslissingen achter elkaar voor een enkel bericht — welk tool gebruiken, het resultaat interpreteren, de volgende actie bepalen. Elk van deze beslissingen is een volledige LLM-aanroep die de gehele context bevat. Het uitvoeren van tools zelf (bestanden lezen, zoeken) gebeurt lokaal, maar de besluitvorming voor en na elk toolgebruik brengt cache read-kosten met zich mee.

### Waarom is de Cache Write-kost ook hoger dan verwacht?

Bij Anthropic kost cache write 1,25x de invoerprijs (5-minuten-tier) of 2x (1-uur-tier). Met die vermenigvuldigers lijkt het alsof cache write niet meer dan 2x de invoer-/uitvoerkosten zou moeten bedragen — maar in de praktijk neemt cache write een veel groter aandeel in.

Twee redenen:

| Oorzaak | Uitleg |
|---|---|
| **Systeemprompt** | Tienduizenden tokens voordat de gebruiker iets typt (met plugins/MCP). Dit alles valt onder cache write-kosten |
| **Hercreatie na verlopen** | Na het verlopen van de TTL (5 min / 1 uur) moet het volledige opgebouwde gesprek opnieuw gecachet worden. Hoe langer het gesprek, hoe hoger de hercreatie-kosten |

Met andere woorden: cache write treedt niet alleen op voor "nieuwe tokens van de gebruiker." Bij de start van een sessie wordt de volledige systeemprompt gecachet; na verlopen wordt het volledige opgebouwde gesprek een cache write-target. Als de cache van een 100K-tokengesprek verloopt, veroorzaakt een enkel bericht een cache write van 100K tokens in een keer.

**Dit is precies waarom de super-token-saver plugin een cache-verloopwaarschuwing toont na 1 uur inactiviteit.** Controleer bij het verschijnen van de waarschuwing je huidige contextgrootte:

- **Kleine context**: de hercreatie-kosten zijn beheersbaar. Werk gewoon door — de kosten zijn laag.
- **Grote context**: de cachekosten zijn aanzienlijk. We raden `/clear` aan gevolgd door `/s-continue last` om verder te gaan in een nieuwe sessie. De continue-skill herstelt automatisch de context van je vorige gesprek, zodat je workflow niet wordt onderbroken.

## Strategieen om cachekosten te verlagen

De super-token-saver plugin is ontworpen om al deze strategieen te automatiseren of vereenvoudigen.

### 1. Houd de context klein — `/clear` + `/s-continue` ⭐

**Dit is de belangrijkste manier om kosten te verlagen.** Hoge cachekosten betekenen dat je de 90%-korting ontvangt — dat is normaal. Maar als de context onnodig groot groeit en zo blijft, stijgen de absolute kosten per aanroep zelfs met de korting. **De contextgrootte beheersen is de meest effectieve kostenbeheerstrategie.**

Wanneer het onderwerp verandert of het gesprek lang wordt, voer `/clear` uit om te resetten en dan `/s-continue last` om de vorige context te herstellen. `/s-continue` herstelt vorige gesprekken zonder LLM-aanroepen, dus de kosten zijn nul.

`/compact` verkleint de context door het gesprek samen te vatten, maar het samenvattingsproces zelf kost LLM-aanroepen en verliest gespreksdetails. Niet aanbevolen.

### 2. Voorkom cache-verlopen — Token Guardian (automatisch)

De hoofdsessie van Anthropic gebruikt de **1-uur-tier** voor cache. Na verlopen moet het eerste verzoek het volledige gesprek opnieuw aanmaken als cache write, wat duur is.

super-token-saver detecteert 1 uur inactiviteit en **toont automatisch een waarschuwing**. Bij het verschijnen van de waarschuwing is het gebruik van methode 1 hierboven (`/clear` + `/s-continue`) om verder te gaan in een nieuwe sessie de meest zuinige aanpak.

### 3. Delegeer zwaar werk naar SubTasks

Zware taken zoals codegeneratie of het bewerken van meerdere bestanden kunnen gedelegeerd worden naar SubTasks in plaats van ze direct in de hoofdsessie uit te voeren. SubTasks gebruiken de 5-minuten cache-tier, waardoor **cache writes 37,5% goedkoper** zijn, en draaien in een geisoleerde kleinere context, wat het cache read-volume per aanroep vermindert.

super-token-saver stuurt automatisch aan op dit werkseparatiepatroon bij het starten van een sessie.

### 4. Realtime kostenmonitoring — `/setup-statusline`

Installeer `/setup-statusline` om realtime kosten-/tokenstatus onderaan je CLI weer te geven: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Je kunt abnormaal hoge kosten per aanroep of een groeiende context direct opmerken en actie ondernemen voordat de kosten exploderen.

### 5. Kostenpatroonanalyse — `/usage-view`

Gebruik `/usage-view` om je volledige gebruiksgeschiedenis als dashboard te bekijken. Visualiseer dagelijkse/uurlijkse kostentrends, tokensamenstelling per sessie en cache-efficientie. Zie in een oogopslag welke taken kostenpieken veroorzaakten en welke patronen inefficient zijn.

### 6. Systeemprompt-optimalisatie

Hoe meer plugins, MCP-servers en skills in de systeemprompt worden geladen, hoe hoger de initiele cache write-kosten. Verwijder alles wat je niet gebruikt.

`/setup-git-lite` van super-token-saver reduceert de standaard Git-instructies van Claude Code (~2.200 tokens) tot een kern van 280 tokens — een reductie van ongeveer 88% in Git-gerelateerde systeemprompt per sessie.

### 7. Toolselectie — impact op context verschilt per tool

Wanneer een bestand eenmaal is gelezen, blijft de inhoud in de context en accumuleert in cache reads bij alle volgende aanroepen. Het volledig lezen van een enkel bestand voegt duizenden tot tienduizenden tokens toe aan de context, en dat bedrag wordt bij elke volgende aanroep in rekening gebracht.

Codeertaken omvatten vaak meerdere bestanden tegelijk — het volledig lezen van slechts 3-4 bestanden kan de context dramatisch doen groeien. De juiste tool kiezen maakt een groot verschil in contextgroei.

| Tool | Doel | Impact op context | Wanneer gebruiken |
|---|---|---|---|
| **Grep** | Code zoeken op patroon | **Minimaal** — retourneert alleen overeenkomende regels | Zoeken naar specifieke functienamen, variabelen, strings |
| **Glob** | Bestanden zoeken op naampatroon | **Minimaal** — retourneert alleen bestandspaden | Bestanden vinden: `*.ts`, `src/**/*.test.js` |
| **LSP** | Symbooldefinities, referenties, typen | **Minimaal** — retourneert alleen definities/signaturen | Ga naar definitie, vind referenties, controleer typen |
| **Read** (offset/limit) | Specifiek deel van een bestand lezen | **Matig** — retourneert alleen het opgegeven bereik | Wanneer je een specifiek regelbereik nodig hebt |
| **Read** (volledig) | Volledig bestand lezen | **Groot** — volledig bestand toegevoegd aan context | Alleen als je de volledige bestandsstructuur moet begrijpen |

"Lees dit hele bestand" gebruikt tientallen tot honderden keren meer context dan "Vind deze functie."

Hetzelfde principe geldt voor bewerken en vergelijken:

| Tool | Doel | Impact op context |
|---|---|---|
| **Edit** | Bestaand bestand wijzigen | **Minimaal** — alleen de diff wordt aan de context toegevoegd |
| **Write** | Nieuw bestand aanmaken / volledig herschrijven | **Groot** — volledig bestand toegevoegd aan context |
| **git diff / diff** | Bestanden/mappen vergelijken | **Minimaal** — alleen verschillen geretourneerd |
| Beide bestanden apart lezen | Bestanden/mappen vergelijken | **Groot** — beide volledige bestanden aan context toegevoegd |

super-token-saver injecteert deze toolselectiegids automatisch in de AI bij het starten van een sessie, om het gebruik van lichtgewicht tools te stimuleren.

## Bijlage: cachevergelijking tussen AI-aanbieders

### Cachekosten

| Aanbieder | Cache Write-kosten | Cache Read-korting | Cacheopslagkosten |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5-min-tier: 1,25x invoer<br/>1-uur-tier: 2x invoer | 90% korting | Geen |
| **OpenAI**<br/>(Codex) | Geen toeslag (gelijk aan invoer) | 90% korting | Geen |
| **Google Gemini**<br/>(Gemini CLI) | Geen toeslag (gelijk aan invoer) | 90% korting | Geen |

> **Opmerking**: cache read-kortingspercentages varieren per model. Deze cijfers weerspiegelen de nieuwste vlaggenschipmodellen van elke aanbieder.

### Cache Time-to-Live (TTL)

| Aanbieder | TTL | Garantie |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minuten of 1 uur | **Expliciet gedefinieerd** |
| **OpenAI**<br/>(Codex) | Meestal verwijderd na 5-10 min inactiviteit; kan tot 1 uur blijven bestaan in daluren | **Niet gegarandeerd** — officiele docs gebruiken "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Niet bekendgemaakt | **Niet gegarandeerd** — expliciete caching met gegarandeerde TTL is beschikbaar via API (betaald) |

> **Opmerking**: op basis van onze experimenten met Claude Code gebruiken hoofdsessies doorgaans de 1-uur-tier, terwijl SubTasks de 5-minuten-tier gebruiken.

### Aanvullende cache-controle-opties via directe API-aanroepen

De bovenstaande vergelijking is vanuit het perspectief van gebruikers van AI-codeertools (Claude Code, Codex, Gemini CLI). Ontwikkelaars die de API's direct aanroepen hebben fijnmazigere cache-controle.

**Anthropic**

- `cache_control`: stel breakpoints in om cachegrenzen expliciet te definieren. Wordt automatisch bepaald als het niet is opgegeven.
- De TTL-tier (5 min / 1 uur) kan per verzoek worden geselecteerd.

**OpenAI**

- `prompt_cache_key`: routeert verzoeken met dezelfde sleutel naar dezelfde server, wat de cache hit rate verbetert. Codex stelt dit intern automatisch in op `conversation_id`.
- `prompt_cache_retention: "24h"`: verlengde cache-retentie. Verlengt de standaard 5-10 min tot maximaal 24 uur (geen extra kosten, niet gegarandeerd). Codex gebruikt deze optie niet.

**Google Gemini**

- Expliciete caching (`CachedContent`): stel TTL in van 1 min tot 48 uur om cache hits te garanderen. Er geldt een opslagvergoeding (\$4,50/MTok/uur voor Pro). Het bijwerken van cache-inhoud vereist het handmatig aanmaken van een nieuw CachedContent. Gemini CLI gebruikt deze functie niet.

> **Opmerking**: deze opties zijn niet beschikbaar in AI-codeertools en kunnen niet direct door gebruikers worden beheerd. Gebruikers van AI-codeertools dienen de sectie "Strategieen om cachekosten te verlagen" in de hoofdtekst te raadplegen.

### Bronnen

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
