# cc-token-saver

> **Claude Code continua a bloccarti? Non più.**
>
> Spendi meno, lavora più a lungo e scopri esattamente dove vanno i tuoi token — senza configurazione.

Come? Gestione automatica del context, monitoraggio dei costi in tempo reale e controllo delle session basato sulla cache — tutto in un unico plugin.

---

## 😤 Il problema: $200/mese e non riesci a lavorare

Claude Code Max Plan ($200/mese). Dovrebbe bastare. Non basta.

**Rate limit su finestra rolling di 5 ore.** Sei nel pieno del flusso di lavoro e si ferma. Nessun timer. Nessun ETA. Solo attesa.

**Cache expiry.** Torni dalla pausa pranzo. È passata più di un'ora. Invii un prompt e 900K token vengono reinviati a prezzo pieno. Costo? $9 in un colpo solo.

**Costi invisibili.** Non c'è modo di vedere quanto stai spendendo in tempo reale. Lo scopri solo dopo aver raggiunto il rate limit.

**Tutto manuale.** Dimensione del context, tempistiche della cache expiry, delegazione ai SubTask, pulizia delle session. Nessuno riesce a gestire tutto questo mentre scrive codice.

cc-token-saver gestisce tutto automaticamente. **Installa una volta. Fatto.**

---

## 🚀 Installazione

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Funziona automaticamente dopo l'installazione. Zero configurazione. Richiede [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Per il monitoraggio live:

```
/setup-statusline install
```

---

## 🛡️ Funzionalità 1: Token Guardian

**Rileva la cache expiry e blocca automaticamente i reinvii costosi.**

Il TTL della prompt cache di Claude Code è di 1 ora. Se ti allontani per più di un'ora, la cache scade. Il messaggio successivo reinvia l'intero context a prezzo pieno. Con 900K token, sono $9 in un colpo solo.

Token Guardian traccia quando è stata ricevuta l'ultima risposta. Se sono passati più di 3.590 secondi (TTL meno 10 secondi di buffer), blocca il prompt e mostra un avviso.

```
🚨 Cache scaduta (68m 23s inattivo)

La cache è scaduta. Continuare reinvierà tutto il contesto.
Il costo potrebbe aumentare notevolmente.

👉 /context — Controlla l'utilizzo attuale del contesto prima di decidere
👉 /clear → /continue — Reimposta e ripristina il contesto precedente (consigliato, costo minimo)
👉 Reinvia — Continua così com'è (costo totale di re-cache sostenuto)
```

Basta reinviare lo stesso prompt dopo l'avviso e viene eseguito. L'avviso si attiva solo una volta per periodo di inattività, quindi non è mai invadente. I messaggi di avviso vengono visualizzati in 23 lingue in base alla lingua del sistema operativo.

**Risultato:** I costi di re-cache vengono prevenuti automaticamente. Nessuno sforzo richiesto.

---

## 🧠 Funzionalità 2: Smart Session Architecture

**Installalo e i pattern di lavoro ottimizzati per i costi si attivano automaticamente.**

La maggior parte degli utenti fa tutto nella session principale. Lettura file, generazione codice, esecuzione test. Ogni output si accumula nel context e viene reinviato con ogni messaggio. La session si gonfia. I costi esplodono.

Session Architect inietta automaticamente una strategia di delegazione all'avvio della session.

|                  | Session principale                | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Ruolo            | Design, decisioni, review         | Implementazione, code gen, multi-file |
| Cache tier       | 1 ora (ephemeral_1h)              | 5 min                                 |
| Costo cache write | ＄10/MTok                          | ＄6.25/MTok                            |
| Dimensione context | ~94K media                       | ~33K media                            |

I SubTask hanno **cache write più economiche del 37,5%** rispetto alla session principale. Anche il context è molto più piccolo. Delegare il lavoro pesante ai SubTask riduce drasticamente i costi.

**Risultato:** Claude lavora automaticamente con un pattern efficiente in termini di costi. Non devi pensarci.

---

## 🪶 Modalità Concisa

**Stesso contenuto. Meno padding. Attivo di default.**

Lo stesso hook SessionStart inietta anche una regola di stile di risposta che si applica a **ogni sessione e ogni modello** — nessun flag, nessuna configurazione. Tre cose cambiano:

- **Preambolo eliminato** — niente "Fammi controllare…", "Ora farò…", ripetere la tua domanda, o riassumere ciò che il diff già mostra
- **Formato adatto al contenuto** — bullet per gli elenchi, prosa per il ragionamento (trade-off, causalità, motivazioni). Nessuno dei due è forzato
- **Espressione più stringata** — stesso concetto, meno parole. Una prosa più chiara è una prosa più breve

Limite rigido: mai rimuovere contenuto, saltare la verifica, o comprimere le sfumature in una singola frase. La sostanza rimane intatta; solo l'involucro si riduce.

Installa una volta, vale ovunque.

---


## 🔄 Funzionalità 3: /continue — Ripristino del context

**Sostituisce `/compact`. Zero chiamate LLM. Zero costi in token.**

`/compact` invia l'intero context (~1M token) all'LLM per comprimerlo in un riassunto del 3,3%. Se la cache è scaduta, questo da solo attiva un re-cache completo. La perdita di informazioni è inevitabile.

`/continue` adotta un approccio completamente diverso. Preelabora il transcript della session precedente e lo carica direttamente. Nessuna chiamata LLM. Nessun costo. La conversazione originale viene ripristinata così com'è.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Come funziona           | Invia il context completo all'LLM per il riassunto | Preelabora il transcript, lo legge direttamente |
| Chiamate LLM            | Necessarie (tipicamente 100K+ token) | 0                                |
| Costo in token          | Alto                              | 0                                |
| Perdita di informazioni | Sì (riassunto del 3,3%)           | Nessuna (originale preservato)   |
| Velocità di elaborazione | Decine di secondi                 | < 1 sec (anche file da 60MB+)   |
| Con cache scaduta       | Costo di re-cache aggiuntivo      | Nessun impatto                   |
| Ripristino multi-session | Non possibile                     | Supportato                       |

Utilizzo: `/clear` poi `/continue`. Vedrai un elenco delle session precedenti. Scegli quella da ripristinare. Per un recupero rapido: `/continue last`.

**Risultato:** Riprendi il lavoro precedente a costo zero. Nessuna perdita di informazioni.

---

## 📊 Funzionalità 4: Live Status Line

**Monitoraggio token/costi in tempo reale. Meno di 50ms di overhead.**

Esegui `/setup-statusline install` una sola volta e una barra di stato persistente appare nella parte inferiore di Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indicatore       | Cosa mostra                         | 🟢 Normale | 🟡 Attenzione | 🔴 Critico |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Costo dell'ultima chiamata API      | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulativo) | Costo cumulativo per questa cartella | —         | —          | —           |
| 5H               | Utilizzo finestra 5 ore + conto alla rovescia per il reset | < 70%     | >= 70%     | >= 90%      |
| CTX              | Utilizzo della context window       | < 35%     | >= 35%     | >= 70%      |

Quando un indicatore raggiunge il livello attenzione o critico, appare automaticamente un suggerimento `→ /usage-view current`.

Per rimuovere: `/setup-statusline uninstall` (la configurazione precedente viene ripristinata automaticamente).

**Risultato:** Vedi lo stato dei costi a colpo d'occhio. Intervieni prima che sia troppo tardi.

---

## 📈 Dashboard di utilizzo (/usage-view)

**Finalmente una risposta a: "Perché ho raggiunto il rate limit?"**

Fino ad ora, raggiungere il rate limit ti faceva solo arrabbiare. Nessun modo di conoscere la causa. Quale session ha bruciato più token? Quando sono aumentati i costi? Quali pattern esistono nel tuo utilizzo? Tutto invisibile.

`/usage-view` mostra tutto. Una dashboard HTML interattiva si apre nel browser, permettendoti di analizzare i pattern di utilizzo e risalire alla causa dei picchi di costo. Nessuna dipendenza esterna. Funziona in modo autonomo. Condivisibile come file.

Cosa include:

- Trend di costo giornaliero / orario / per giorno della settimana — individua quando bruci più token
- Dettaglio token (input, output, cache write, cache read) — scopri cosa genera i costi
- Analisi costi per session — identifica quali attività sono state costose
- Timeline della finestra di 5 ore (abbonati Max Plan) — traccia i trigger del rate limit
- Analisi con insight basati sull'AI — interpreta i dati e suggerisce miglioramenti
- 23 lingue supportate (RTL incluso; grafici/tabelle rimangono LTR)

```
/usage-view                  # Tutti i periodi, tutti i progetti
/usage-view current          # Solo la finestra di 5 ore corrente
/usage-view last 7 days      # Ultimi 7 giorni
/usage-view locale it        # Italiano
```

---

## 🔬 Ricerca sui rate limit (/report-limit)

**Progetto collaborativo per decodificare la formula del rate limit.**

Anthropic non pubblica la formula esatta della finestra di 5 ore. Scopriamola insieme, con i dati alla mano.

Quando raggiungi un rate limit, esegui `/report-limit`. I tuoi dati di utilizzo vengono automaticamente inviati come GitHub Discussion. Più dati raccogliamo, più chiara diventa la formula.

---

## ✂️ Funzionalità 5: /setup-git-lite — Elimina le istruzioni Git integrate di CC

**I 2.200 token nascosti per session che non sapevi di stare pagando.**

### La scoperta

Il 12 aprile 2026, una [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) ha rivelato che l'impostazione integrata `includeGitInstructions` di Claude Code brucia silenziosamente token ad ogni session. Una riproduzione indipendente tramite [questo gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) ha confermato i numeri: **+6.031 token in cache write** per session dopo ogni git commit, **+1.690 token in cache read** ad ogni chiamata API.

### Analisi del sorgente CC — dove vanno i token

Abbiamo tracciato i token fino a due punti di iniezione indipendenti nel sorgente di Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` raccoglie branch + main branch + user.name + status completo (fino a 2000 caratteri) + **ultimi 5 commit**
- Unito e aggiunto al system prompt tramite `appendSystemContext` (`utils/api.ts:437`)
- Ogni nuovo commit, ogni nuovo file modificato, ogni cambio di branch modifica il testo → invalidazione del prefix cache

**2. Istruzioni per workflow commit/PR (~1.700 tok) — descrizione del tool Bash**
- `tools/BashTool/prompt.ts:53` aggiunge 60+ righe di protocollo di sicurezza, procedura di commit passo-passo, esempi HEREDOC e template per la creazione di PR alla descrizione del tool `Bash`
- Messo in cache insieme al system prompt, ma inviato come parametro `tools[]`

### Perché è costoso

La struttura della cache (`utils/api.ts:321` `splitSysPromptPrefix`) ha tre percorsi in base alla presenza di tool MCP attivi:

- **Path A** (MCP attivo — la maggior parte degli utenti): `gitStatus` si trova in un blocco `cacheScope: 'org'`. Qualsiasi modifica → intero blocco rimesso in cache all'avvio della session successiva → 6K tok `cache_create` miss.
- **Path B** (senza MCP): `gitStatus` va in un blocco dinamico `cacheScope: null`, quindi viene reinviato come `input_tokens` freschi ad ogni chiamata API — nessuna cache miss, ma nemmeno risparmio dalla cache.
- **Path C** (provider 3P / beta sperimentali disabilitate): come Path A.

In session interattive tipiche, le istruzioni commit/PR (1,7K tok) si accumulano **ad ogni chiamata API** tramite `cache_read`. Su una session di 100 chiamate a prezzi Opus 4.7, sono circa **$0,08 per session** solo per istruzioni che il training di Claude già copre per lo più.

### Come cc-token-saver gestisce la situazione

`/setup-git-lite` disabilita il percorso nativo e inietta un **sostituto curato di 280 token** tramite un hook SessionStart. Abbiamo mantenuto esattamente le cose che modificano il comportamento predefinito di Claude (regole di sicurezza), eliminando tutto ciò che Claude già conosce dal training (workflow passo-passo, template PR, pattern di utilizzo di gh).

**Mantenuto — 11 regole critiche di override** (quelle che trasformano l'utilità predefinita di Claude in cautela):
- Mai fare commit/push/amend/PR/tag/merge senza richiesta esplicita dell'utente
- Mai saltare hook, fare force-push su main/master, eseguire operazioni distruttive, modificare la configurazione git
- Mai fare commit di file che corrispondono a `.env`, `credentials`, `*.pem`, `secret.*`
- Evitare `git add -A` / `git add .`
- HEREDOC per commit message su più righe + trailer `Co-Authored-By: Claude`
- Mai usare flag interattivi (-i), nessun commit vuoto
- Se un pre-commit hook fallisce → creare un NUOVO commit (non `--amend`)

**Eliminato** — workflow commit passo-passo (3 passaggi), workflow PR passo-passo (3 passaggi), template titolo/corpo PR, riferimenti al comando `gh`, avviso flag `-uall`, avviso `--no-edit` con rebase, vincolo `NEVER use TodoWrite or Agent tools during commit`. Si tratta di verbosità del workflow che Claude compone correttamente dal training da solo.

**Aggiunto** — riga compatta con lo stato git: branch + HEAD short-sha + subject + stato corrente (fino a 20 file modificati, altrimenti un conteggio). Nessuna lista dei commit recenti (Claude può eseguire `git log` su richiesta).

### Risparmi previsti (prezzi Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Voce | Originale | Con setup-git-lite | Risparmio |
| ---- | --------- | ------------------ | --------- |
| Caricamento system prompt (per nuova session) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Chiamate ripetute nella stessa session | ~1.700 tok cache_read/chiamata | ~280 tok cache_read/chiamata | ~1.420 tok/chiamata |
| Session da 100 chiamate (Opus 4.7) | — | — | **~$0,11 risparmiati** |
| 20 session/giorno × 22 giorni lavorativi | — | — | **~$48 risparmiati/mese** |

### Utilizzo

```bash
/setup-git-lite status     # Diagnostica in sola lettura — stato attuale + cosa cambierebbe
/setup-git-lite install    # Disabilita CC nativo + abilita il nostro hook minimale
/setup-git-lite revert     # Ripristina il default (aggressivo; vedi sotto)
/setup-git-lite dismiss-banner    # Silenzia il suggerimento occasionale
/setup-git-lite undismiss-banner  # Riabilita il suggerimento
/setup-git-lite help       # Utilizzo completo
```

### Semantica di install

`install` modifica **due** posti per robustezza:

1. `~/.claude/settings.json` — aggiunge `"includeGitInstructions": false`
2. Shell profile (`~/.zshrc`, `~/.bashrc`, ecc.) — aggiunge un blocco marcatore che esporta `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Uno solo dei due è sufficiente per disabilitare il nativo CC; li impostiamo entrambi così un override di ambiente non riabilita accidentalmente il comportamento nativo. La modifica alla shell ha effetto solo nelle nuove shell.

### Semantica di revert — aggressiva

`revert` **rimuove TUTTI gli export di `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` dal tuo shell profile**, inclusi quelli che potresti aver aggiunto manualmente prima di installare questa skill. Questo è intenzionale — hai eseguito `revert`, quindi ripristiniamo il default pulito. Creiamo sempre un backup con timestamp dello shell profile prima.

Se hai bisogno della variabile d'ambiente per altri motivi, annotala prima di eseguire `revert` e aggiungila di nuovo dopo.

### Prima di disinstallare cc-token-saver

**Esegui prima `/setup-git-lite revert`**, altrimenti rimarrai con `includeGitInstructions: false` nel tuo settings.json ma senza hook sostitutivo (Claude non riceve alcuna guida git). Claude Code attualmente non ha un hook di lifecycle per la disinstallazione dei plugin, quindi non possiamo automatizzare questo passaggio.

### Compromessi

Cosa si perde (e perché di solito va bene):
- Claude non riceve più un `git status` / `git log -n 5` precalcolato all'avvio della session. Se chiedi "cosa è cambiato?" in una nuova session, Claude eseguirà quei comandi da solo (una tool call in più, ~300 tok).
- Claude non vede più la procedura di commit canonica in 3 passaggi di CC. Nei nostri test su centinaia di flussi di commit, la conoscenza a livello di training gestisce i casi critici (formattazione HEREDOC, nessun `--amend`, nessun force-push) perché manteniamo quelle come regole esplicite.
- Il template del corpo PR (`## Summary` + `## Test plan`) non viene iniettato. Se tieni esattamente a quel formato, inseriscilo nel CLAUDE.md del tuo progetto.

### Banner di raccomandazione

Quando le istruzioni git native di CC sono ancora attive sulla tua macchina, cc-token-saver mostra un suggerimento di un paragrafo all'avvio della session **circa il 20% delle volte** (più in `/usage-view` e negli output di `/report-limit`). Dismissi definitivamente con `/setup-git-lite dismiss-banner`.

---

## 💡 Come funziona davvero la cache

Claude Code invia l'intera cronologia della conversazione al modello a ogni chiamata API. "Chiamata API" non significa "un messaggio che hai digitato". Un singolo prompt attiva chiamate interne di tool — Grep, Read, Edit, Write — e ciascuna è una chiamata API separata. Un prompt può facilmente causare 10+ chiamate API.

La prompt cache riduce questo costo del 90%. Ma la cache ha una durata limitata.

|                     | Session principale                    | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 ora (ephemeral_1h)                  | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Quando la cache scade | Context completo reinviato a prezzo pieno | Impatto ridotto (context piccolo)      |

Anche con la cache attiva, i costi si accumulano. Ecco uno scenario estremo per mostrare la differenza.

### Scenario: giornata intera di coding (3h mattina → 2h pranzo/riunione → 3h pomeriggio)

Condizioni: prezzi Opus 4, 1 prompt al minuto, ~5 chiamate API per prompt (~300 chiamate/ora).

#### ❌ Senza cc-token-saver

La maggior parte del lavoro avviene nella session principale. Il context cresce velocemente.

| Fase        | Situazione                        | Dimensione context             | Costo                                  |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Mattina 3h  | Coding (principalmente nella session principale) | 100K → 600K (media 350K)  | 900 chiamate × 350K × ＄0.50/M = ＄157.50 |
| Pranzo/riun.| Assente per 2 ore                 | —                          | —                                      |
| Ritorno     | Cache scaduta → reinvio completo  | 600K a prezzo pieno        | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Ritorno     | /compact (riassunto)              | 600K → inviato all'LLM    | 600K × ＄0.50/M + output riassunto = ~＄1.50 |
| Pomeriggio 3h | Coding continua (context ricresce) | 100K → 600K (media 350K) | 900 chiamate × 350K × ＄0.50/M = ＄157.50 |
|             | Totale                            |                            | ~＄326                                  |

> A questo livello di utilizzo, probabilmente raggiungerai il rate limit della finestra di 5 ore. **Il costo è un problema, ma il vero problema è che il lavoro si ferma completamente. Questo è il momento esatto in cui Claude Code si spegne.**

#### ✅ Con cc-token-saver

Il lavoro pesante viene delegato ai SubTask. La session principale gestisce solo design e decisioni.

| Fase        | Situazione                                   | Dimensione context              | Costo                              |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Mattina 3h  | Coding (Principale: design, SubTask: implementazione) | Principale 100K → 300K (media 200K) | 900 chiamate × 200K × ＄0.50/M = ＄90 |
| Pranzo/riun.| Assente per 2 ore                            | —                           | —                                  |
| Ritorno     | ⚡ Token Guardian blocca → /clear + /continue | —                           | ＄0 (nessuna chiamata LLM)          |
| Pomeriggio 3h | Coding continua                              | Principale 100K → 300K (media 200K) | 900 chiamate × 200K × ＄0.50/M = ＄90 |
|             | Totale                                       |                             | ~＄180                              |

#### 💰 Risultato

> **＄326 → ＄180. ＄146 risparmiati al giorno (45%).**
>
> Non è solo una questione di costi. Meno token nello stesso tempo significa **non raggiungere il rate limit e poter continuare a lavorare.** Questa è la vera differenza.

### Dove interviene cc-token-saver

```
[Avvio session]
    │
    ├─ Session Architect → Inietta automaticamente il pattern di delegazione ai SubTask
    │                       Mantiene il context principale sotto i 250K
    │
[In lavorazione]
    │
    ├─ Status Line → Monitoraggio in tempo reale di costi/context/rate limit
    │                  Avviso immediato all'ingresso nella zona di attenzione
    │
[1+ ora di inattività]
    │
    ├─ Token Guardian → Rileva cache expiry, blocca prima del reinvio
    │
[Riavvio session]
    │
    └─ /continue → Ripristina il context precedente a costo zero (nessuna chiamata LLM)
```

---

## 🔧 Installazione da sorgente e personalizzazione

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver è completamente open source. L'intero codice è scritto in JavaScript + Bash script seguendo la struttura standard dei plugin. Modifica quello che vuoi.

- **hooks/** — Cambia la soglia di cache expiry, personalizza i messaggi di avviso, modifica le regole della session architecture
- **scripts/** — Logica di analisi, generatore di report, formattazione della status line
- **skills/** — Come funzionano /continue e /usage-view, template dei prompt
- **locales/** — Aggiungi/modifica traduzioni, aggiungi nuove lingue
- **skills/usage-view/** — Modifiche al design UI/UX della dashboard

Fallo tuo. Forkalo, sperimenta e apri una PR se trovi qualcosa di meglio.

---

## 🌐 Lingue supportate

23 lingue supportate. Selezionate incrociando i 20 paesi con più utenti Claude Code con le 20 lingue più parlate al mondo. La lingua viene rilevata automaticamente dalla lingua del sistema operativo. Puoi anche specificarla manualmente: `/usage-view locale it`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Inglese    | 🇰🇷 Coreano    | 🇯🇵 Giapponese | 🇨🇳 Cinese     |
| 🇪🇸 Spagnolo   | 🇫🇷 Francese   | 🇩🇪 Tedesco    | 🇧🇷 Portoghese |
| 🇮🇹 Italiano   | 🇷🇺 Russo      | 🇸🇦 Arabo      | 🇮🇳 Hindi      |
| 🇧🇩 Bengalese  | 🇮🇩 Indonesiano | 🇲🇾 Malese     | 🇹🇭 Tailandese |
| 🇻🇳 Vietnamita | 🇹🇷 Turco      | 🇵🇱 Polacco    | 🇳🇱 Olandese   |
| 🇮🇱 Ebraico    | 🇸🇪 Svedese    | 🇳🇴 Norvegese  |                 |

Le traduzioni attuali sono generate dall'AI. I contributi di madrelingua sono benvenuti — modifica il file JSON della tua lingua in `locales/` e invia una PR.

---

## 💡 Consigli

### Capire la cache significa capire dove vanno i soldi

- **1 prompt ≠ 1 chiamata API.** Ogni volta che Claude chiama Grep, Read o Edit, l'intero context viene reinviato. Un singolo prompt attiva facilmente 10+ chiamate API. Scrivi prompt chiari per ridurre le chiamate di tool inutili e tagliare i costi.
- **Il timer della cache si resetta dall'ultima chiamata API, non dall'ultimo prompt.** Continua a lavorare e la cache non scade mai. Il pericolo è allontanarsi. Token Guardian blocca automaticamente una volta, così al ritorno puoi scegliere: resettare il context o continuare così com'è.
- **Dimensione del context = moltiplicatore di costo.** La stessa chiamata API a 200K rispetto a 800K costa 4 volte di più. Quando la status line [CTX] supera il 35% (🟡), è il segnale per delegare di più ai SubTask.

### Abitudini che riducono i costi

- **Mantieni CLAUDE.md snello.** Viene caricato nel system prompt a ogni chiamata API. Ogni riga costa.
- **Delega il lavoro pesante ai SubTask.** Generazione codice, modifiche multi-file, esecuzione test non appartengono alla session principale. I SubTask hanno context più piccolo e un cache tier più economico.
- **Assente per 1+ ora?** `/clear` → ritorna → `/continue`. Context ripristinato a $0.
- **[5H] sopra il 70% (🟡)?** Rallenta. Passa a task di review leggeri o aumenta la delegazione ai SubTask per ridurre il numero di chiamate API della session principale.
- **Usa `/btw` per domande collaterali.** Non entra nella cronologia della conversazione, così il context rimane snello.

---

## License

Apache-2.0
