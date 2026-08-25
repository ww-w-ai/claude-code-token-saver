# Guide des couts de cache — Pourquoi la majeure partie de vos depenses vient du cache

Il est normal que la majorite des couts de vos outils de programmation IA provienne des operations de cache (ecritures + lectures). Ce document explique pourquoi et comment gerer cette situation.

## Le secret : chaque message renvoie toute la conversation

Les LLM sont **sans etat**. Contrairement aux humains, les modeles d'IA ne "se souviennent" pas des conversations precedentes — ils recoivent l'integralite de l'historique de conversation en entree a chaque requete.

Cela ressemble a un chat, mais les appels API reels fonctionnent ainsi :

```
[ Requete 1 ]
→ Prompt systeme + "Corrige ce bug"
← Reponse de l'IA

[ Requete 2 ]
→ Prompt systeme + "Corrige ce bug" + Reponse de l'IA + "Ajoute aussi des tests"
← Reponse de l'IA

[ Requete 3 ]
→ Prompt systeme + "Corrige ce bug" + Reponse de l'IA + "Ajoute aussi des tests" + Reponse de l'IA + "Fais le commit"
← Reponse de l'IA
```

Chaque requete inclut **tout** le contenu precedent. Par exemple, la 50e requete contient l'integralite de la conversation et toutes les reponses de l'IA des 49 requetes precedentes. C'est pourquoi les tokens d'entree augmentent rapidement a mesure que la conversation s'allonge.

De plus, les outils de programmation IA envoient le prompt systeme (instructions integrees, fichiers de configuration, plugins, definitions d'outils MCP, etc.) a chaque requete — donc meme un message d'une seule ligne genere des dizaines de milliers de tokens d'entree.

## Qu'est-ce que le caching ?

Le **prompt caching** reduit le cout de cette transmission repetee. Il stocke les portions inchangees de votre entree sur le serveur afin que les requetes suivantes puissent les reutiliser a un tarif reduit.

- **Cache Write** : Le cout du stockage du contenu de la conversation sur le serveur. Se produit lors de la premiere requete ou apres l'expiration du cache.
- **Cache Read** : Le cout de la reutilisation d'une conversation deja stockee. Facture avec une **reduction de 90%** par rapport a l'entree standard.

Les outils de programmation IA produisent inevitablement de longues conversations et de grands contextes, pouvant atteindre 1 million de tokens par requete. Meme si votre nouvelle question est courte, toute la conversation precedente est facturee en meme temps, donc les couts s'accumulent rapidement a mesure que la conversation s'allonge.

Pour reduire cette charge, les principaux fournisseurs d'IA appliquent une reduction de 90% sur les lectures de cache, ce qui diminue considerablement le cout de retransmission du contenu deja traite.

## Pourquoi le cache domine-t-il le cout total ?

| Categorie | Tokens par appel | Note |
|---|---|---|
| Entree utilisateur (nouveaux tokens) | Dizaines a centaines | Ce que l'utilisateur tape reellement |
| Sortie de l'IA | Centaines a milliers | Reponse de l'IA |
| **Lecture de cache** | **100K–centaines de K** | Toute la conversation accumulee facturee a chaque appel |

Le volume de lectures de cache par appel est **des milliers de fois** plus grand que l'entree. Meme avec une reduction de 90%, les lectures de cache dominent toujours en termes de cout absolu.

Et ces appels ne proviennent pas uniquement des messages de l'utilisateur :

| Origine | Frequence | Lecture de cache par appel |
|---|---|---|
| Messages de l'utilisateur | Quand l'utilisateur envoie un message | Toute la conversation accumulee |
| **Decisions propres de l'IA** | **Appels multiples par message utilisateur** | Toute la conversation accumulee |

De maniere invisible, l'IA effectue plusieurs decisions en sequence pour un seul message utilisateur — choisir quel outil utiliser, interpreter le resultat de l'outil, decider de l'action suivante. Chacune de ces decisions est un appel LLM complet qui inclut tout le contexte. L'execution de l'outil en elle-meme (lectures de fichiers, recherches) s'effectue localement, mais la prise de decision avant et apres chaque utilisation d'outil entraine des couts de lecture de cache.

### Pourquoi le cout d'ecriture de cache est-il aussi plus eleve que prevu ?

Pour Anthropic, les couts d'ecriture de cache sont de 1.25x l'entree (niveau 5 minutes) ou 2x l'entree (niveau 1 heure). Avec ces multiplicateurs, il semble que l'ecriture de cache ne devrait pas depasser 2x le cout entree+sortie — mais en pratique, l'ecriture de cache occupe une part bien plus importante.

Deux raisons :

| Cause | Explication |
|---|---|
| **Prompt systeme** | Des dizaines de milliers de tokens avant que l'utilisateur ne tape quoi que ce soit (avec plugins/MCP). Tout cela est soumis aux couts d'ecriture de cache |
| **Recreation apres expiration** | Apres l'expiration du TTL (5 min / 1 heure), toute la conversation accumulee doit etre remise en cache. Plus la conversation est longue, plus le cout de recreation est eleve |

Autrement dit, l'ecriture de cache ne concerne pas uniquement les "nouveaux tokens tapes par l'utilisateur". Au demarrage de la session, l'integralite du prompt systeme est mise en cache ; apres expiration, toute la conversation accumulee devient un objectif d'ecriture de cache. Si le cache d'une conversation de 100K tokens expire, un seul message declenche une ecriture de cache de 100K tokens d'un coup.

**C'est exactement pourquoi le plugin super-token-saver affiche un avertissement d'expiration de cache apres 1 heure d'inactivite.** Lorsque l'avertissement apparait, verifiez la taille de votre contexte actuel :

- **Petit contexte** : Le cout de recreation du cache est gerable. Continuez simplement a travailler — le cout est faible.
- **Grand contexte** : Le cout du cache sera significatif. Nous recommandons `/clear` suivi de `/s-continue last` pour reprendre dans une nouvelle session. La competence continue restaure automatiquement le contexte de votre conversation precedente, donc votre flux de travail n'est pas interrompu.

## Strategies pour reduire les couts de cache

Le plugin super-token-saver est concu pour automatiser ou simplifier toutes ces strategies.

### 1. Garder le contexte petit — `/clear` + `/s-continue` ⭐

**C'est le moyen le plus important pour reduire les couts.** Des couts de cache eleves signifient que vous beneficiez de la reduction de 90% — c'est normal. Mais si le contexte croit inutilement et reste ainsi, le cout absolu par appel augmente meme avec la reduction. **Garder la taille du contexte sous controle est la strategie de gestion des couts la plus efficace.**

Quand le sujet change ou que la conversation s'allonge, executez `/clear` pour reinitialiser, puis `/s-continue last` pour restaurer le contexte precedent. `/s-continue` restaure les conversations precedentes sans aucun appel LLM, donc le cout est zero.

`/compact` reduit le contexte en resumant la conversation, mais le processus de resume lui-meme entraine des couts d'appels LLM et perd des details de la conversation. Non recommande.

### 2. Prevenir l'expiration du cache — Token Guardian (Automatique)

Le cache de session principal d'Anthropic utilise un **niveau de 1 heure**. Apres expiration, la premiere requete doit recreer toute la conversation en ecriture de cache, ce qui est couteux.

super-token-saver detecte les etats d'inactivite de 1 heure et **affiche automatiquement un avertissement**. Lorsque l'avertissement apparait, utiliser la methode 1 ci-dessus (`/clear` + `/s-continue`) pour continuer dans une nouvelle session est l'approche la plus economique.

### 3. Deleguer les taches lourdes aux SubTasks

Les taches lourdes comme la generation de code ou les modifications multi-fichiers peuvent etre deleguees a des SubTasks au lieu d'etre executees directement dans la session principale. Les SubTasks utilisent le niveau de cache de 5 minutes, rendant les **ecritures de cache 37.5% moins cheres**, et s'executent dans un contexte isole plus petit, reduisant le volume de lecture de cache par appel.

super-token-saver guide automatiquement ce modele de separation du travail au demarrage de la session.

### 4. Suivi des couts en temps reel — `/setup-statusline`

Installez `/setup-statusline` pour afficher l'etat des couts/tokens en temps reel en bas de votre CLI : `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Vous pouvez reperer immediatement des couts anormalement eleves par appel ou un contexte qui grossit, vous permettant d'agir avant que les couts ne s'envolent.

### 5. Analyse des tendances de couts — `/usage-view`

Utilisez `/usage-view` pour consulter votre historique d'utilisation complet sous forme de tableau de bord. Visualisez les tendances de couts quotidiennes/horaires, la composition des tokens par session et l'efficacite du cache. Identifiez d'un coup d'oeil quelles taches ont provoque des pics de couts et quels schemas sont inefficaces.

### 6. Optimisation du prompt systeme

Plus il y a de plugins, de serveurs MCP et de competences charges dans le prompt systeme, plus le cout initial d'ecriture de cache est eleve. Supprimez tout ce que vous n'utilisez pas.

`/setup-git-lite` de super-token-saver reduit les instructions Git par defaut de Claude Code (~2 200 tokens) a un noyau de 280 tokens — une reduction d'environ 88% du prompt systeme lie a Git par session.

### 7. Choix des outils — L'impact sur le contexte varie selon l'outil

Une fois qu'un fichier est lu, son contenu reste dans le contexte et s'accumule dans les lectures de cache de tous les appels suivants. Lire un seul fichier en entier ajoute des milliers a des dizaines de milliers de tokens au contexte, et ce montant est facture a chaque appel suivant.

Les taches de programmation impliquent souvent plusieurs fichiers simultanement — lire seulement 3-4 fichiers en entier peut faire croitre le contexte de maniere spectaculaire. Choisir le bon outil fait une difference significative dans la croissance du contexte.

| Outil | Fonction | Impact sur le contexte | Quand utiliser |
|---|---|---|---|
| **Grep** | Chercher du code par motif | **Minimal** — ne retourne que les lignes correspondantes | Rechercher des noms de fonctions, variables, chaines specifiques |
| **Glob** | Chercher des fichiers par motif de nom | **Minimal** — ne retourne que les chemins de fichiers | Rechercher des emplacements de fichiers comme `*.ts`, `src/**/*.test.js` |
| **LSP** | Definitions de symboles, references, types | **Minimal** — ne retourne que les definitions/signatures | Aller a la definition, trouver les references, verifier les types |
| **Read** (offset/limit) | Lire une partie specifique d'un fichier | **Modere** — ne retourne que la plage specifiee | Quand vous avez besoin d'une plage de lignes specifique |
| **Read** (complet) | Lire le fichier entier | **Important** — fichier entier ajoute au contexte | Uniquement quand vous devez comprendre la structure complete du fichier |

"Lis ce fichier en entier" utilise des dizaines a des centaines de fois plus de contexte que "Trouve cette fonction".

Le meme principe s'applique a l'edition et a la comparaison :

| Outil | Fonction | Impact sur le contexte |
|---|---|---|
| **Edit** | Modifier un fichier existant | **Minimal** — seul le diff est ajoute au contexte |
| **Write** | Creer un nouveau fichier / reecriture complete | **Important** — fichier entier ajoute au contexte |
| **git diff / diff** | Comparer des fichiers/dossiers | **Minimal** — seules les differences sont retournees |
| Lire les deux fichiers separement | Comparer des fichiers/dossiers | **Important** — les deux fichiers complets ajoutes au contexte |

super-token-saver injecte automatiquement ce guide de selection d'outils a l'IA au demarrage de la session, encourageant l'utilisation d'outils legers en priorite.

## Annexe : Comparaison du cache entre fournisseurs d'IA

### Couts de cache

| Fournisseur | Cout d'ecriture de cache | Reduction sur lecture de cache | Cout de stockage de cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Niveau 5 min : 1.25x entree<br/>Niveau 1 heure : 2x entree | 90% de reduction | Aucun |
| **OpenAI**<br/>(Codex) | Sans surcharge (identique a l'entree) | 90% de reduction | Aucun |
| **Google Gemini**<br/>(Gemini CLI) | Sans surcharge (identique a l'entree) | 90% de reduction | Aucun |

> **Note** : Les taux de reduction sur la lecture de cache varient selon le modele. Ces chiffres refletent les derniers modeles phares de chaque fournisseur.

### Duree de vie du cache (TTL)

| Fournisseur | TTL | Garantie |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minutes ou 1 heure | **Explicitement defini** |
| **OpenAI**<br/>(Codex) | Generalement supprime apres 5-10 min d'inactivite ; peut persister jusqu'a 1 heure en periode creuse | **Non garanti** — la documentation officielle utilise "generalement", "jusqu'a" |
| **Google Gemini**<br/>(Gemini CLI) | Non divulgue | **Non garanti** — le caching explicite avec TTL garanti est disponible via API (payant) |

> **Note** : D'apres nos experiences avec Claude Code, les sessions principales utilisent generalement le niveau de 1 heure, tandis que les SubTasks utilisent le niveau de 5 minutes.

### Options supplementaires de controle du cache via appels directs a l'API

La comparaison ci-dessus est du point de vue des utilisateurs d'outils de programmation IA (Claude Code, Codex, Gemini CLI). Les developpeurs qui appellent directement les APIs disposent d'un controle de cache plus fin.

**Anthropic**

- `cache_control` : Definit des points de coupure pour delimiter explicitement les frontieres du cache. Determine automatiquement si non specifie.
- Le niveau de TTL (5 min / 1 heure) peut etre selectionne par requete.

**OpenAI**

- `prompt_cache_key` : Dirige les requetes avec la meme cle vers le meme serveur, ameliorant le taux de succes du cache. Codex definit cela en interne comme `conversation_id` automatiquement.
- `prompt_cache_retention: "24h"` : Retention etendue du cache. Etend la valeur par defaut de 5-10 min jusqu'a 24 heures (sans cout supplementaire, non garanti). Codex n'utilise pas cette option.

**Google Gemini**

- Caching explicite (`CachedContent`) : Definit un TTL de 1 minute a 48 heures pour garantir les succes de cache. Des frais de stockage s'appliquent (\$4.50/MTok/heure pour Pro). Les mises a jour du contenu en cache necessitent la creation manuelle d'un nouveau CachedContent. Gemini CLI n'utilise pas cette fonctionnalite.

> **Note** : Ces options ne sont pas exposees dans les outils de programmation IA et ne peuvent pas etre controlees directement par les utilisateurs. Les utilisateurs d'outils de programmation IA doivent consulter la section "Strategies pour reduire les couts de cache" dans le texte principal.

### Sources

- Anthropic : [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI : [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google : [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
