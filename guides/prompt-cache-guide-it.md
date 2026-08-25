# Guida ai costi della cache — Perche la maggior parte della spesa e cache

E normale che la maggior parte dei costi dei tuoi strumenti di programmazione IA provenga dalle operazioni di cache (scritture + letture). Questo documento spiega perche e come gestirlo.

## Il segreto: ogni messaggio reinvia l'intera conversazione

Gli LLM sono **senza stato**. A differenza degli esseri umani, i modelli di IA non "ricordano" le conversazioni precedenti — ricevono l'intero storico della conversazione come input ad ogni singola richiesta.

Sembra una chat, ma le chiamate API effettive funzionano cosi:

```
[ Richiesta 1 ]
→ Prompt di sistema + "Correggi questo bug"
← Risposta dell'IA

[ Richiesta 2 ]
→ Prompt di sistema + "Correggi questo bug" + Risposta dell'IA + "Aggiungi anche i test"
← Risposta dell'IA

[ Richiesta 3 ]
→ Prompt di sistema + "Correggi questo bug" + Risposta dell'IA + "Aggiungi anche i test" + Risposta dell'IA + "Fai il commit"
← Risposta dell'IA
```

Ogni richiesta include **tutto** il contenuto precedente. Per esempio, la 50a richiesta contiene l'intera conversazione e tutte le risposte dell'IA delle 49 richieste precedenti. Ecco perche i token di input crescono rapidamente man mano che la conversazione si allunga.

Inoltre, gli strumenti di programmazione IA inviano il prompt di sistema (istruzioni integrate, file di configurazione, plugin, definizioni degli strumenti MCP, ecc.) con ogni richiesta — quindi anche un messaggio di una sola riga genera decine di migliaia di token di input.

## Cos'e il caching?

Il **prompt caching** riduce il costo di questa trasmissione ripetuta. Memorizza le porzioni invariate del tuo input sul server in modo che le richieste successive possano riutilizzarle a un prezzo scontato.

- **Cache Write**: Il costo di memorizzare il contenuto della conversazione sul server. Si verifica alla prima richiesta o dopo la scadenza della cache.
- **Cache Read**: Il costo di riutilizzare la conversazione gia memorizzata. Addebitato con uno **sconto del 90%** rispetto all'input standard.

Gli strumenti di programmazione IA producono inevitabilmente conversazioni lunghe e contesti ampi, fino a 1 milione di token per richiesta. Anche se la tua nuova domanda e breve, l'intera conversazione precedente viene addebitata insieme ad essa, quindi i costi si accumulano rapidamente man mano che la conversazione cresce.

Per ridurre questo peso, i principali fornitori di IA applicano uno sconto del 90% sulle letture di cache, riducendo significativamente il costo di ritrasmettere contenuto gia elaborato.

## Perche la cache domina il costo totale?

| Categoria | Token per chiamata | Nota |
|---|---|---|
| Input dell'utente (nuovi token) | Decine a centinaia | Cio che l'utente digita effettivamente |
| Output dell'IA | Centinaia a migliaia | Risposta dell'IA |
| **Lettura cache** | **100K–centinaia di K** | L'intera conversazione accumulata addebitata ad ogni chiamata |

Il volume delle letture di cache per chiamata e **migliaia di volte** piu grande dell'input. Anche con uno sconto del 90%, le letture di cache dominano comunque in termini assoluti di costo.

E queste chiamate non provengono solo dai messaggi dell'utente:

| Origine | Frequenza | Lettura cache per chiamata |
|---|---|---|
| Messaggi dell'utente | Quando l'utente invia un messaggio | L'intera conversazione accumulata |
| **Decisioni autonome dell'IA** | **Chiamate multiple per messaggio dell'utente** | L'intera conversazione accumulata |

In modo invisibile, l'IA esegue molteplici decisioni in sequenza per un singolo messaggio dell'utente — decidere quale strumento usare, interpretare il risultato dello strumento, decidere l'azione successiva. Ognuna di queste decisioni e una chiamata LLM completa che include l'intero contesto. L'esecuzione dello strumento in se (lettura di file, ricerche) avviene localmente, ma il processo decisionale prima e dopo ogni uso dello strumento comporta costi di lettura cache.

### Perche anche il costo di scrittura cache e maggiore del previsto?

Per Anthropic, i costi di scrittura cache sono 1,25x l'input (livello 5 minuti) o 2x l'input (livello 1 ora). Con questi moltiplicatori, sembra che la scrittura cache non dovrebbe superare 2x il costo input+output — ma in pratica, la scrittura cache occupa una quota molto maggiore.

Due motivi:

| Causa | Spiegazione |
|---|---|
| **Prompt di sistema** | Decine di migliaia di token prima che l'utente digiti qualcosa (con plugin/MCP). Tutto cio e soggetto ai costi di scrittura cache |
| **Ricreazione dopo scadenza** | Dopo la scadenza del TTL (5 min / 1 ora), l'intera conversazione accumulata deve essere rimessa in cache. Piu lunga e la conversazione, maggiore e il costo di ricreazione |

In altre parole, la scrittura cache non avviene solo per i "nuovi token digitati dall'utente". All'avvio della sessione, l'intero prompt di sistema viene messo in cache; dopo la scadenza, l'intera conversazione accumulata diventa obiettivo di scrittura cache. Se la cache di una conversazione da 100K token scade, un singolo messaggio genera una scrittura cache di 100K token tutto in una volta.

**E esattamente per questo che il plugin super-token-saver mostra un avviso di scadenza cache dopo 1 ora di inattivita.** Quando appare l'avviso, controlla la dimensione del tuo contesto attuale:

- **Contesto piccolo**: Il costo di ricreazione della cache e gestibile. Continua semplicemente a lavorare — il costo e basso.
- **Contesto grande**: Il costo della cache sara significativo. Raccomandiamo `/clear` seguito da `/s-continue last` per riprendere in una nuova sessione. La funzione continue ripristina automaticamente il contesto della tua conversazione precedente, quindi il tuo flusso di lavoro non viene interrotto.

## Strategie per ridurre i costi della cache

Il plugin super-token-saver e progettato per automatizzare o semplificare tutte queste strategie.

### 1. Mantenere il contesto piccolo — `/clear` + `/s-continue` ⭐

**Questo e il modo piu importante per ridurre i costi.** Costi di cache elevati significano che stai ricevendo lo sconto del 90% — e normale. Ma se il contesto cresce inutilmente e rimane cosi, il costo assoluto per chiamata aumenta anche con lo sconto. **Mantenere la dimensione del contesto sotto controllo e la strategia di gestione dei costi piu efficace.**

Quando l'argomento cambia o la conversazione si allunga, esegui `/clear` per reimpostare, poi `/s-continue last` per ripristinare il contesto precedente. `/s-continue` ripristina le conversazioni precedenti senza alcuna chiamata LLM, quindi il costo e zero.

`/compact` riduce il contesto riassumendo la conversazione, ma il processo di riassunto stesso comporta costi di chiamate LLM e scarta i dettagli della conversazione. Non raccomandato.

### 2. Prevenire la scadenza della cache — Token Guardian (Automatico)

La cache della sessione principale di Anthropic usa un **livello di 1 ora**. Dopo la scadenza, la prima richiesta deve ricreare l'intera conversazione come scrittura cache, il che e costoso.

super-token-saver rileva stati di inattivita di 1 ora e **mostra automaticamente un avviso**. Quando appare l'avviso, usare il metodo 1 sopra (`/clear` + `/s-continue`) per continuare in una nuova sessione e l'approccio piu economico.

### 3. Delegare il lavoro pesante ai SubTasks

Le attivita pesanti come la generazione di codice o le modifiche multi-file possono essere delegate ai SubTasks invece di eseguirle direttamente nella sessione principale. I SubTasks usano il livello cache di 5 minuti, rendendo le **scritture cache il 37,5% piu economiche**, e girano in un contesto isolato piu piccolo, riducendo il volume di lettura cache per chiamata.

super-token-saver guida automaticamente questo schema di separazione del lavoro all'avvio della sessione.

### 4. Monitoraggio dei costi in tempo reale — `/setup-statusline`

Installa `/setup-statusline` per visualizzare lo stato dei costi/token in tempo reale nella parte inferiore della tua CLI: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Puoi individuare costi anomalmente alti per chiamata o un contesto in crescita immediatamente, permettendoti di agire prima che i costi schizzino.

### 5. Analisi dei pattern di costo — `/usage-view`

Usa `/usage-view` per consultare il tuo storico d'uso completo come dashboard. Visualizza le tendenze dei costi giornaliere/orarie, la composizione dei token per sessione e l'efficienza della cache. Identifica a colpo d'occhio quali attivita hanno causato picchi di costo e quali pattern sono inefficienti.

### 6. Ottimizzazione del prompt di sistema

Piu plugin, server MCP e competenze vengono caricati nel prompt di sistema, maggiore sara il costo iniziale di scrittura cache. Rimuovi tutto cio che non usi.

`/setup-git-lite` di super-token-saver riduce le istruzioni Git predefinite di Claude Code (~2.200 token) a un nucleo di 280 token — una riduzione di circa l'88% del prompt di sistema relativo a Git per sessione.

### 7. Selezione degli strumenti — L'impatto sul contesto varia per strumento

Una volta che un file viene letto, il suo contenuto rimane nel contesto e si accumula nelle letture cache di tutte le chiamate successive. Leggere un singolo file per intero aggiunge migliaia a decine di migliaia di token al contesto, e tale importo viene addebitato ad ogni chiamata successiva.

Le attivita di programmazione spesso coinvolgono piu file contemporaneamente — leggere solo 3-4 file per intero puo far crescere il contesto drasticamente. Scegliere lo strumento giusto fa una differenza significativa nella crescita del contesto.

| Strumento | Scopo | Impatto sul contesto | Quando usare |
|---|---|---|---|
| **Grep** | Cercare codice per pattern | **Minimo** — restituisce solo le righe corrispondenti | Cercare nomi di funzioni, variabili, stringhe specifiche |
| **Glob** | Cercare file per pattern di nome | **Minimo** — restituisce solo i percorsi dei file | Cercare posizioni di file come `*.ts`, `src/**/*.test.js` |
| **LSP** | Definizioni di simboli, riferimenti, tipi | **Minimo** — restituisce solo definizioni/firme | Vai alla definizione, trova riferimenti, verifica tipi |
| **Read** (offset/limit) | Leggere una parte specifica di un file | **Moderato** — restituisce solo l'intervallo specificato | Quando hai bisogno di un intervallo specifico di righe |
| **Read** (completo) | Leggere il file intero | **Grande** — file intero aggiunto al contesto | Solo quando devi comprendere l'intera struttura del file |

"Leggi questo file intero" usa da decine a centinaia di volte piu contesto di "Trova questa funzione".

Lo stesso principio si applica per la modifica e il confronto:

| Strumento | Scopo | Impatto sul contesto |
|---|---|---|
| **Edit** | Modificare file esistente | **Minimo** — solo il diff viene aggiunto al contesto |
| **Write** | Creare nuovo file / riscrittura completa | **Grande** — file intero aggiunto al contesto |
| **git diff / diff** | Confrontare file/cartelle | **Minimo** — vengono restituite solo le differenze |
| Leggere entrambi i file separatamente | Confrontare file/cartelle | **Grande** — entrambi i file completi aggiunti al contesto |

super-token-saver inietta automaticamente questa guida alla selezione degli strumenti nell'IA all'avvio della sessione, incoraggiando l'uso prioritario di strumenti leggeri.

## Appendice: Confronto cache tra fornitori di IA

### Costi della cache

| Fornitore | Costo scrittura cache | Sconto lettura cache | Costo di archiviazione cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Livello 5 min: 1,25x input<br/>Livello 1 ora: 2x input | Sconto del 90% | Nessuno |
| **OpenAI**<br/>(Codex) | Nessun sovrapprezzo (uguale all'input) | Sconto del 90% | Nessuno |
| **Google Gemini**<br/>(Gemini CLI) | Nessun sovrapprezzo (uguale all'input) | Sconto del 90% | Nessuno |

> **Nota**: I tassi di sconto sulla lettura cache variano per modello. Queste cifre riflettono gli ultimi modelli di punta di ogni fornitore.

### Tempo di vita della cache (TTL)

| Fornitore | TTL | Garanzia |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minuti o 1 ora | **Esplicitamente definito** |
| **OpenAI**<br/>(Codex) | Generalmente rimosso dopo 5-10 min di inattivita; puo persistere fino a 1 ora nei periodi di basso carico | **Non garantito** — la documentazione ufficiale usa "generalmente", "fino a" |
| **Google Gemini**<br/>(Gemini CLI) | Non divulgato | **Non garantito** — il caching esplicito con TTL garantito e disponibile via API (a pagamento) |

> **Nota**: In base ai nostri esperimenti con Claude Code, le sessioni principali usano tipicamente il livello di 1 ora, mentre i SubTasks usano il livello di 5 minuti.

### Opzioni aggiuntive di controllo cache tramite chiamate API dirette

Il confronto sopra e dal punto di vista degli utenti di strumenti di programmazione IA (Claude Code, Codex, Gemini CLI). Gli sviluppatori che chiamano direttamente le API hanno un controllo cache piu granulare.

**Anthropic**

- `cache_control`: Imposta punti di interruzione per definire esplicitamente i confini della cache. Determinato automaticamente se non specificato.
- Il livello TTL (5 min / 1 ora) puo essere selezionato per richiesta.

**OpenAI**

- `prompt_cache_key`: Indirizza le richieste con la stessa chiave allo stesso server, migliorando il tasso di successo della cache. Codex imposta internamente questo come `conversation_id` automaticamente.
- `prompt_cache_retention: "24h"`: Ritenzione estesa della cache. Estende il valore predefinito di 5-10 min fino a 24 ore (senza costi aggiuntivi, non garantito). Codex non usa questa opzione.

**Google Gemini**

- Caching esplicito (`CachedContent`): Imposta TTL da 1 minuto a 48 ore per garantire hit della cache. Si applica una tariffa di archiviazione (\$4.50/MTok/ora per Pro). Gli aggiornamenti del contenuto in cache richiedono la creazione manuale di un nuovo CachedContent. Gemini CLI non usa questa funzionalita.

> **Nota**: Queste opzioni non sono esposte negli strumenti di programmazione IA e non possono essere controllate direttamente dagli utenti. Gli utenti di strumenti di programmazione IA dovrebbero consultare la sezione "Strategie per ridurre i costi della cache" nel testo principale.

### Fonti

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
