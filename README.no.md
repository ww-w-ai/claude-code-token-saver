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
