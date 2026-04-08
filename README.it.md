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
| RUN (delta)      | Costo dell'ultima chiamata API      | < ＄0.50   | >= ＄0.50   | >= ＄1.00    |
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
