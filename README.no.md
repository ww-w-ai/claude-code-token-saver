# cc-token-saver

> **Claude Code kutter deg av hele tiden? Ikke lenger.**
>
> Bruk mindre, kod lenger, og se nøyaktig hvor tokenene dine går — uten konfigurasjon.

Hvordan? Automatisk context-styring, sanntids kostnadssporing og cache-bevisst session-kontroll — alt i én plugin.

---

## 😤 Problemet: $200/mnd og du får likevel ikke gjort jobben

Claude Code Max Plan ($200/mnd). Burde holde. Det gjør det ikke.

**5-timers rullerende vindu med rate limit.** Du er midt i flyten og det bare stopper. Ingen tidtaker. Ingen estimert ventetid. Bare vent.

**Cache-utløp.** Du kommer tilbake fra lunsj. Det har gått over en time. Du sender ett prompt og 900K token sendes på nytt til full pris. Kostnad? $9 på et blunk.

**Usynlige kostnader.** Det finnes ingen måte å se hva du bruker i sanntid. Du finner det først ut etter at rate limit slår inn.

**Alt manuelt.** Context-størrelse, cache-tidspunkt, SubTask-delegering, session-opprydding. Ingen kan holde styr på alt dette mens de faktisk koder.

cc-token-saver håndterer alt automatisk. **Installer én gang. Ferdig.**

---

## 🚀 Installasjon

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Fungerer automatisk etter installasjon. Ingen konfigurasjon. Krever [Claude Code](https://claude.ai/claude-code) v2.1.71+.

For sanntidsovervåking:

```
/setup-statusline install
```

---

## 🛡️ Funksjon 1: Token Guardian

**Oppdager cache-utløp og blokkerer automatisk kostbare gjensendinger.**

Claude Code sin prompt-cache TTL er 1 time. Går det mer enn en time uten aktivitet, utløper cachen. Neste melding sender hele konteksten på nytt til full pris. Ved 900K token blir det $9 på et blunk.

Token Guardian sporer når siste svar ble mottatt. Har det gått mer enn 3 590 sekunder (TTL minus 10 sekunders buffer), blokkeres promptet og en advarsel vises.

```
🚨 Cache utløpt (68m 23s inaktiv)

Prompt-cachen har utløpt. Å fortsette sender hele konteksten på nytt.
Kostnaden kan øke betydelig.

👉 /context — Sjekk nåværende kontekstbruk før du bestemmer deg
👉 /clear → /continue — Tilbakestill, deretter gjenopprett tidligere kontekst (anbefalt, lavest kostnad)
👉 Send på nytt — Fortsett som det er (full re-cache-kostnad påløper)
```

Bare send det samme promptet på nytt etter advarselen — det går gjennom. Advarselen utløses bare én gang per inaktiv periode, så den maser aldri. Advarsler vises på 23 språk basert på OS-språket ditt.

**Resultat:** Kostbare re-cache-utgifter forhindres automatisk. Ingen innsats krevd.

---

## 🧠 Funksjon 2: Smart Session Architecture

**Installer det, og kostnadsoptimaliserte arbeidsmønstre slår inn automatisk.**

De fleste brukere gjør alt i Main-sessionen. Fillesing, kodegenerering, testkjøring. Alt output hoper seg opp i context og sendes på nytt med hver melding. Sessionen blåser seg opp. Kostnadene øker.

Session Architect injiserer automatisk en delegeringsstrategi ved session-start.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rolle            | Design, beslutninger, gjennomgang | Implementering, kodegen, flerfil      |
| Cache-nivå       | 1 time (ephemeral_1h)             | 5 min                                 |
| Cache write-kostnad | ＄10/MTok                          | ＄6.25/MTok                            |
| Context-størrelse | ~94K gj.snitt                     | ~33K gj.snitt                         |

SubTask har **37,5 % billigere cache writes** enn Main. Context er også mye mindre. Å delegere tungt arbeid til SubTask kutter kostnadene dramatisk.

**Resultat:** Claude jobber automatisk i et kostnadseffektivt mønster. Du trenger ikke tenke på det.

---

## 🔄 Funksjon 3: /continue — Context-gjenoppretting

**Erstatter `/compact`. Null LLM-kall. Null token-kostnad.**

`/compact` sender hele konteksten din (~1M token) til LLM-en for å komprimere den til et 3,3 %-sammendrag. Hvis cachen har utløpt, utløser det alene en full re-cache. Informasjonstap er uunngåelig.

`/continue` tar en helt annen tilnærming. Den forbehandler transkripsjonen fra forrige session og laster den direkte. Ingen LLM-kall. Ingen kostnad. Den opprinnelige samtalen gjenopprettes som den var.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Hvordan det fungerer    | Sender full context til LLM for oppsummering | Forbehandler transkripsjon, leser direkte |
| LLM-kall                | Krevd (vanligvis 100K+ token)     | 0                                |
| Token-kostnad           | Høy                               | 0                                |
| Informasjonstap         | Ja (3,3 %-sammendrag)             | Ingen (originalen bevart)        |
| Behandlingstid          | Titalls sekunder                  | < 1 sek (selv 60MB+ filer)      |
| Når cache er utløpt     | Full re-cache-kostnad i tillegg   | Ingen påvirkning                 |
| Flersession-gjenoppretting | Ikke mulig                     | Støttet                          |

Bruk: `/clear` og deretter `/continue`. Du får en liste over tidligere sesjoner. Velg en for å gjenopprette. For rask gjenoppretting: `/continue last`.

**Resultat:** Gjenoppta tidligere arbeid uten kostnad. Ingen informasjonstap.

---

## 📊 Funksjon 4: Live Status Line

**Sanntids token/kostnadsovervåking. Under 50ms overhead.**

Kjør `/setup-statusline install` én gang, og en permanent statuslinje vises nederst i Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indikator        | Hva den viser                       | 🟢 Normal | 🟡 Advarsel | 🔴 Kritisk |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Kostnad for siste API-kall          | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (kumulativ)  | Samlet kostnad for denne mappen     | —         | —          | —           |
| 5H               | 5-timers vindusbruk + nedtelling til tilbakestilling | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context-vindusbruk                  | < 35%     | >= 35%     | >= 70%      |

Når en indikator når advarsel eller kritisk nivå, vises et `→ /usage-view current`-hint automatisk.

For å fjerne: `/setup-statusline uninstall` (tidligere konfigurasjon gjenopprettes automatisk).

**Resultat:** Se kostnadsstatus med et blikk. Handle før det er for sent.

---

## 📈 Bruksdashboard (/usage-view)

**Endelig svar på: "Hvorfor ble jeg rate-limitert?"**

Fram til nå gjorde rate limit deg bare frustrert. Ingen måte å finne årsaken. Hvilken session brukte flest token? Når økte kostnadene? Hvilke mønstre finnes i bruken din? Alt usynlig.

`/usage-view` viser alt. Et interaktivt HTML-dashboard åpnes i nettleseren din, der du kan analysere bruksmønstre og spore rotårsaken til kostnadstopper. Ingen eksterne avhengigheter. Fungerer frittstående. Kan deles som fil.

Hva som er inkludert:

- Daglige / timesbaserte / ukedagstrender — se når du bruker flest token
- Token-fordeling (input, output, cache write, cache read) — se hva som driver kostnadene
- Kostnadsanalyse per session — finn ut hvilke oppgaver som var dyre
- 5-timers vindus-tidslinje (Max Plan-abonnenter) — spor rate limit-utløsere
- AI-drevet innsiktsanalyse — tolker data og foreslår forbedringer
- 23 språk støttet (RTL inkludert; diagrammer/tabeller forblir LTR)

```
/usage-view                  # All tid, alle prosjekter
/usage-view current          # Kun gjeldende 5-timers vindu
/usage-view last 7 days      # Siste 7 dager
/usage-view locale no        # Norsk
```

---

## 🔬 Rate Limit-forskning (/report-limit)

**Fellesskapsdrevet prosjekt for å reversere rate limit-formelen.**

Anthropic publiserer ikke den eksakte formelen for 5-timers vinduet. La oss finne ut av det sammen.

Når du treffer en rate limit, kjør `/report-limit`. Bruksdataene dine sendes automatisk som en GitHub Discussion. Jo mer data vi samler, desto tydeligere blir formelen.

---

## ✂️ Funksjon 5: /setup-git-lite — Trim CC's innebygde git-instruksjoner

**De skjulte 2 200 tokenene per session du ikke visste du betalte for.**

### Oppdagelsen

Den 12. april 2026 avslørte et [GitHub-problem](https://github.com/anthropics/claude-code/issues/47107) at Claude Code sin innebygde `includeGitInstructions`-innstilling stille brenner token ved hver session. Uavhengig reproduksjon via [denne gisten (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) bekreftet tallene: **+6 031 token i cache writes** per session etter hvert git commit, **+1 690 token i cache reads** ved hvert API-kall.

### CC-kildeanalyse — hvor tokenene går

Vi sporet tokenene til to uavhengige injeksjonspunkter i Claude Code-kildekoden (v2.1.88):

**1. `gitStatus`-øyeblikksbilde (~500 tok) — system-prompt**
- `context.ts:36-111` `getGitStatus()` samler branch + hoved-branch + user.name + full status (opptil 2 000 tegn) + **siste 5 commits**
- Slås sammen og legges til system-prompten via `appendSystemContext` (`utils/api.ts:437`)
- Hver ny commit, hver ny endret fil, hvert branch-bytte endrer teksten → prefix-cache-ugyldiggjøring

**2. Commit/PR-arbeidsflyt-instruksjoner (~1 700 tok) — Bash-verktøybeskrivelse**
- `tools/BashTool/prompt.ts:53` legger til 60+ linjer med sikkerhetsprotokoll, trinn-for-trinn-commit-prosedyre, HEREDOC-eksempler og PR-opprettingsmaler til `Bash`-verktøyets beskrivelse
- Caches sammen med system-prompten, men sendes som `tools[]`-parameter

### Hvorfor det er dyrt

Cache-strukturen (`utils/api.ts:321` `splitSysPromptPrefix`) har tre stier basert på om du har aktive MCP-verktøy:

- **Path A** (MCP aktivt — de fleste brukere): `gitStatus` ligger i en `cacheScope: 'org'`-blokk. Enhver endring → hele blokken re-caches ved neste session-start → 6K tok `cache_create`-miss.
- **Path B** (ingen MCP): `gitStatus` går til en `cacheScope: null` dynamisk blokk, som betyr at den sendes på nytt som ferske `input_tokens` ved hvert API-kall — ingen cache-miss, men heller ingen cache-besparelser.
- **Path C** (3P-leverandør / eksperimentelle betas deaktivert): samme som Path A.

I typiske interaktive sesjoner akkumuleres commit/PR-instruksjonene (1,7K tok) **ved hvert API-kall** via `cache_read`. Over en 100-kalls-session med Opus 4.7-priser utgjør det omtrent **$0,08 per session** bare for instruksjoner Claude allerede stort sett dekker gjennom trening.

### Hvordan cc-token-saver håndterer det

`/setup-git-lite` deaktiverer den innebygde stien og injiserer en **kuratert 280-token erstatning** via en SessionStart-hook. Vi beholdt nøyaktig det som overstyrer Claudes standardoppførsel (sikkerhetsregler), og droppet alt Claude allerede kjenner fra trening (trinn-for-trinn-arbeidsflyter, PR-maler, gh-bruksmønstre).

**Beholdt — 11 kritiske overstyring-regler** (de som snur Claudes standardhjelpsomhet til forsiktighet):
- Aldri commit/push/amend/PR/tag/merge uten eksplisitt brukerforespørsel
- Aldri hopp over hooks, force-push til main/master, kjør destruktive operasjoner, endre git config
- Aldri commit filer som matcher `.env`, `credentials`, `*.pem`, `secret.*`
- Unngå `git add -A` / `git add .`
- HEREDOC for flerlinje commit-meldinger + `Co-Authored-By: Claude`-trailer
- Aldri bruk interaktive flagg (-i), ingen tomme commits
- Hvis pre-commit-hook feiler → opprett en NY commit (ikke `--amend`)

**Droppet** — trinn-for-trinn commit-arbeidsflyt (3 trinn), trinn-for-trinn PR-arbeidsflyt (3 trinn), PR-tittel/kropp-mal, `gh`-kommandreferanser, `-uall`-flaggadvarsel, `--no-edit` med rebase-advarsel, `NEVER use TodoWrite or Agent tools during commit`-begrensning. Dette er arbeidsflyt-verbositet som Claude komponerer korrekt fra trening alene.

**Lagt til** — kompakt git-statuslinje: branch + HEAD kort-sha + emne + gjeldende status (opptil 20 endrede filer, ellers et antall). Ingen liste over nylige commits (Claude kan kjøre `git log` ved behov).

### Forventede besparelser (Opus 4.7-priser, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Element | Original | Med setup-git-lite | Spart |
| ------- | -------- | ------------------- | ----- |
| System-prompt-lasting (per ny session) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Gjentatte kall i samme session | ~1 700 tok cache_read/kall | ~280 tok cache_read/kall | ~1 420 tok/kall |
| 100-kalls-session (Opus 4.7) | — | — | **~$0,11 spart** |
| 20 sesjoner/dag × 22 arbeidsdager | — | — | **~$48 spart/mnd** |

### Bruk

```bash
/setup-git-lite status     # Skrivebeskyttet diagnose — gjeldende tilstand + hva som ville endres
/setup-git-lite install    # Deaktiver CC innebygd + aktiver vår minimale hook
/setup-git-lite revert     # Gjenopprett standard (aggressiv; se nedenfor)
/setup-git-lite dismiss-banner    # Stilne det innimellom-anbefalingstipset
/setup-git-lite undismiss-banner  # Re-aktiver tipset
/setup-git-lite help       # Full bruk
```

### Installasjonssemantikk

`install` modifiserer **to** steder for robusthet:

1. `~/.claude/settings.json` — legger til `"includeGitInstructions": false`
2. Shell-profil (`~/.zshrc`, `~/.bashrc`, osv.) — legger til en markeringsblokk som eksporterer `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Enten én alene er nok til å deaktivere CC innebygd; vi setter begge slik at en miljøvariabel-overstyring ikke ved et uhell re-aktiverer den innebygde oppførselen. Shell-endringen trer i kraft i nye shells kun.

### Tilbakestillingssemantikk — aggressiv

`revert` **fjerner ALLE `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`-eksporter fra shell-profilen din**, inkludert alle du kanskje har lagt til manuelt før du installerte dette skillset. Dette er tilsiktet — du kjørte `revert`, så vi gjenoppretter den rene standarden. Vi oppretter alltid en tidsstemplet sikkerhetskopi av shell-profilen først.

Hvis du trenger miljøvariabelen av andre årsaker, noter den ned før du kjører `revert` og legg den til igjen etterpå.

### Før avinstallering av cc-token-saver

**Kjør `/setup-git-lite revert` først**, ellers sitter du igjen med `includeGitInstructions: false` i settings.json men uten erstatnings-hook (Claude får ingen git-veiledning i det hele tatt). Claude Code har foreløpig ingen plugin-avinstaller-livssyklus-hook, så vi kan ikke automatisere dette.

### Avveininger

Hva du mister (og hvorfor det vanligvis er greit):
- Claude mottar ikke lenger et ferdigberegnet `git status` / `git log -n 5` ved session-start. Hvis du spør «hva er endret?» i en ny session, kjører Claude disse kommandoene selv (ett ekstra verktøy-kall, ~300 tok).
- Claude ser ikke lenger CC sin kanoniske 3-trinns commit-prosedyre. I vår testing over hundrevis av commit-flyter håndterer treningsnivå-kunnskap de kritiske tilfellene (HEREDOC-formatering, ingen `--amend`, ingen force-push) fordi vi beholder disse som eksplisitte regler.
- PR-kropp-mal (`## Summary` + `## Test plan`) injiseres ikke. Hvis du bryr deg om nøyaktig det formatet, legg det i prosjektets CLAUDE.md.

### Anbefaling-banner

Når CC innebygde git-instruksjoner fremdeles er aktive på maskinen din, viser cc-token-saver et ett-avsnitt tips ved session-start **~20 % av tiden** (pluss i `/usage-view`- og `/report-limit`-output). Avvis permanent med `/setup-git-lite dismiss-banner`.

---

## 💡 Slik fungerer cache egentlig

Claude Code sender hele samtalehistorikken til modellen ved hvert API-kall. "API-kall" betyr ikke "en melding du skrev." Et enkelt prompt utløser interne verktøy-kall — Grep, Read, Edit, Write — og hvert av dem er et eget API-kall. Ett prompt kan lett føre til 10+ API-kall.

Prompt-cache reduserer denne kostnaden med 90 %. Men cache har en levetid.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 time (ephemeral_1h)                 | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Når cache utløper   | Full context sendes på nytt til full pris | Lav påvirkning (context er liten)    |

Selv med aktiv cache akkumuleres kostnadene. Her er et ekstremt scenario som viser forskjellen.

### Scenario: Hel dag med koding (3t morgen → 2t lunsj/møte → 3t ettermiddag)

Betingelser: Opus 4-priser, 1 prompt per minutt, ~5 API-kall per prompt (~300 kall/time).

#### ❌ Uten cc-token-saver

Mesteparten av arbeidet skjer i Main-sessionen. Context vokser raskt.

| Fase        | Situasjon                         | Context-størrelse            | Kostnad                                |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Morgen 3t   | Koding (hovedsakelig i Main)      | 100K → 600K (gj.snitt 350K) | 900 kall × 350K × ＄0.50/M = ＄157.50  |
| Lunsj/møte  | Borte i 2 timer                   | —                            | —                                      |
| Tilbake     | Cache utløpt → full gjensending   | 600K full pris               | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Tilbake     | /compact (oppsummering)           | 600K → sendt til LLM         | 600K × ＄0.50/M + oppsummeringsoutput = ~＄1.50 |
| Ettermiddag 3t | Koding fortsetter (context vokser igjen) | 100K → 600K (gj.snitt 350K) | 900 kall × 350K × ＄0.50/M = ＄157.50  |
|             | Totalt                            |                              | ~＄326                                  |

> Ved dette bruksnivået treffer du sannsynligvis rate limit for 5-timers vinduet. **Kostnad er ille, men det virkelige problemet er at arbeidet ditt stopper helt. Dette er øyeblikket Claude Code går i svart.**

#### ✅ Med cc-token-saver

Tungt arbeid delegeres til SubTask. Main håndterer kun design/beslutninger.

| Fase        | Situasjon                                    | Context-størrelse             | Kostnad                            |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Morgen 3t   | Koding (Main: design, SubTask: implementering) | Main 100K → 300K (gj.snitt 200K) | 900 kall × 200K × ＄0.50/M = ＄90 |
| Lunsj/møte  | Borte i 2 timer                              | —                             | —                                  |
| Tilbake     | ⚡ Token Guardian blokkerer → /clear + /continue | —                          | ＄0 (ingen LLM-kall)               |
| Ettermiddag 3t | Koding fortsetter                           | Main 100K → 300K (gj.snitt 200K) | 900 kall × 200K × ＄0.50/M = ＄90 |
|             | Totalt                                       |                               | ~＄180                              |

#### 💰 Resultat

> **＄326 → ＄180. ＄146 spart per dag (45 %).**
>
> Det handler ikke bare om kostnad. Færre token på samme tid betyr at **du ikke treffer rate limit og kan fortsette å jobbe.** Det er den egentlige forskjellen.

### Hvor cc-token-saver griper inn

```
[Session Start]
    │
    ├─ Session Architect → Injiserer SubTask-delegeringsmønster automatisk
    │                       Holder Main-context under 250K
    │
[Jobber]
    │
    ├─ Status Line → Sanntidsovervåking av kostnad/context/rate limit
    │                  Umiddelbar varsling når du når advarselssonen
    │
[1+ time inaktiv]
    │
    ├─ Token Guardian → Oppdager cache-utløp, blokkerer før gjensending
    │
[Session-omstart]
    │
    └─ /continue → Gjenoppretter tidligere context uten kostnad (ingen LLM-kall)
```

---

## 🔧 Kildeinstallasjon og tilpasning

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver er helt åpen. Hele kildekoden er ren JavaScript + Bash-skript som følger standard plugin-struktur. Endre hva du vil.

- **hooks/** — Endre cache-utløpsterskel, tilpass advarselsmeldinger, endre session architecture-regler
- **scripts/** — Analyselogikk, rapportbygger, statuslinjeformatering
- **skills/** — Hvordan /continue og /usage-view fungerer, prompt-maler
- **locales/** — Legg til/rediger oversettelser, legg til nye språk
- **skills/usage-view/** — Endringer i dashboard-UI/UX-design

Gjør det til ditt eget. Fork det, eksperimenter, og send en PR hvis du finner noe bedre.

---

## 🌐 Støttede språk

23 språk støttet. Valgt ved kryssreferanse mellom de 20 landene med høyest Claude Code-bruk og de 20 største språkene etter globalt antall brukere. Visningsspråket oppdages automatisk fra OS-språket ditt. Du kan også angi manuelt: `/usage-view locale no`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Engelsk    | 🇰🇷 Koreansk  | 🇯🇵 Japansk  | 🇨🇳 Kinesisk  |
| 🇪🇸 Spansk    | 🇫🇷 Fransk    | 🇩🇪 Tysk     | 🇧🇷 Portugisisk |
| 🇮🇹 Italiensk | 🇷🇺 Russisk   | 🇸🇦 Arabisk  | 🇮🇳 Hindi      |
| 🇧🇩 Bengali   | 🇮🇩 Indonesisk | 🇲🇾 Malayisk | 🇹🇭 Thai       |
| 🇻🇳 Vietnamesisk | 🇹🇷 Tyrkisk | 🇵🇱 Polsk    | 🇳🇱 Nederlandsk |
| 🇮🇱 Hebraisk  | 🇸🇪 Svensk    | 🇳🇴 Norsk    |                 |

Gjeldende oversettelser er AI-generert. Bidrag fra morsmålsbrukere er velkomne — rediger JSON-filen for ditt språk i `locales/` og send en PR.

---

## 💡 Tips

### Forstå cache, og du ser hvor pengene går

- **1 prompt ≠ 1 API-kall.** Hver gang Claude kaller Grep, Read eller Edit, sendes hele konteksten på nytt. Et enkelt prompt utløser lett 10+ API-kall. Skriv tydelige prompt for å redusere unødvendige verktøy-kall og kutte kostnader.
- **Cache-tidtakeren tilbakestilles fra siste API-kall, ikke ditt siste prompt.** Fortsett å jobbe, og cachen utløper aldri. Faren er å gå fra maskinen. Token Guardian blokkerer automatisk én gang, så når du kommer tilbake kan du velge: tilbakestill context eller fortsett som det er.
- **Context-størrelse = kostnadsmultiplikator.** Samme API-kall ved 200K vs 800K koster 4 ganger mer. Når statuslinjen [CTX] passerer 35 % (🟡), er det signalet om å delegere mer til SubTask.

### Vaner som kutter kostnader

- **Hold CLAUDE.md slank.** Den lastes inn i system-promptet ved hvert API-kall. Hver linje koster penger.
- **Deleger tungt arbeid til SubTask.** Kodegenerering, flerfilredigeringer og testkjøringer hører ikke hjemme i Main. SubTask har mindre context og et billigere cache-nivå.
- **Borte i 1+ timer?** `/clear` → kom tilbake → `/continue`. Context gjenopprettet til $0.
- **[5H] over 70 % (🟡)?** Ro ned. Bytt til lette gjennomgangsoppgaver eller øk SubTask-delegering for å redusere antall API-kall i Main.
- **Bruk `/btw` for sidespørsmål.** Det legges ikke inn i samtalehistorikken, så context-en forblir slank.

---

## Lisens

Apache-2.0
