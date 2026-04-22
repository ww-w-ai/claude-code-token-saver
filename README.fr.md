# cc-token-saver

> **Claude Code vous coupe sans arrêt ? C'est terminé.**
>
> Dépensez moins, codez plus longtemps, et voyez exactement où vont vos tokens — sans aucune configuration.

Comment ? Gestion automatique du context, suivi des coûts en temps réel, et contrôle de session tenant compte du cache — le tout dans un seul plugin.

---

## 😤 Le problème : 200 $/mois et vous ne pouvez toujours pas travailler

Claude Code Max Plan (200 $/mois). Ça devrait suffire. Ce n'est pas le cas.

**Rate limit avec fenêtre glissante de 5 heures.** Vous êtes en plein flow de développement et tout s'arrête. Pas de timer. Pas d'estimation. Juste attendre.

**Expiration du cache.** Vous revenez de déjeuner. Plus d'une heure s'est écoulée. Vous envoyez un seul prompt et 900K tokens sont renvoyés au prix fort. Coût ? 9 $ en un seul coup.

**Coûts invisibles.** Impossible de voir combien vous dépensez en temps réel. Vous ne le découvrez qu'après avoir atteint le rate limit.

**Tout est manuel.** Taille du context, timing d'expiration du cache, délégation aux SubTask, nettoyage de session. Personne ne peut gérer tout ça en codant.

cc-token-saver gère tout automatiquement. **Installez une fois. C'est fait.**

---

## 🚀 Installation

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Fonctionne automatiquement après installation. Zéro configuration. Nécessite [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Pour le monitoring en temps réel :

```
/setup-statusline install
```

---

## 🛡️ Fonctionnalité 1 : Token Guardian

**Détecte l'expiration du cache et bloque automatiquement les renvois coûteux.**

Le TTL du cache de prompt de Claude Code est de 1 heure. Quittez votre poste plus d'une heure et le cache expire. Votre prochain message renvoie l'intégralité du context au prix fort. À 900K tokens, c'est 9 $ d'un coup.

Token Guardian suit la date de la dernière réponse reçue. Si plus de 3 590 secondes se sont écoulées (TTL moins 10 secondes de marge), il bloque le prompt et affiche un avertissement.

```
🚨 Cache expiré (68m 23s d'inactivité)

Le cache a expiré. Continuer renverra tout le contexte.
Le coût peut augmenter considérablement.

👉 /context — Vérifier l'utilisation actuelle du contexte avant de décider
👉 /clear → /continue — Réinitialiser puis restaurer le contexte précédent (recommandé, coût minimal)
👉 Renvoyer — Continuer tel quel (coût total de re-cache engendré)
```

Renvoyez le même prompt après l'avertissement et il passe. L'avertissement ne se déclenche qu'une seule fois par période d'inactivité, sans jamais insister. Les messages d'avertissement s'affichent en 23 langues selon la locale de votre OS.

**Résultat :** Les coûts de re-cache élevés sont évités automatiquement. Aucun effort requis.

---

## 🧠 Fonctionnalité 2 : Smart Session Architecture

**Installez-le et des schémas de travail optimisés en coût s'activent automatiquement.**

La plupart des utilisateurs font tout dans la session Main. Lecture de fichiers, génération de code, exécution de tests. Chaque résultat s'accumule dans le context et est renvoyé à chaque message. La session gonfle. Les coûts explosent.

Session Architect injecte automatiquement une stratégie de délégation au démarrage de la session.

|                  | Session Main                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rôle             | Design, décisions, revue          | Implémentation, génération de code, multi-fichiers |
| Tier de cache    | 1 heure (ephemeral_1h)            | 5 min                                 |
| Coût d'écriture cache | ＄10/MTok                          | ＄6.25/MTok                            |
| Taille du context | ~94K en moyenne                   | ~33K en moyenne                       |

Les SubTask ont des **écritures cache 37,5 % moins chères** que Main. Le context est aussi beaucoup plus petit. Déléguer le travail lourd aux SubTask réduit drastiquement les coûts.

**Résultat :** Claude travaille automatiquement selon un schéma économique. Vous n'avez pas à y penser.

---

## 🔄 Fonctionnalité 3 : /continue — Restauration du context

**Remplace `/compact`. Zéro appel LLM. Zéro coût en tokens.**

`/compact` envoie l'intégralité de votre context (~1M tokens) au LLM pour produire un résumé de 3,3 %. Si le cache a expiré, cela seul déclenche un re-cache complet. La perte d'information est inévitable.

`/continue` adopte une approche totalement différente. Il prétraite la transcription de la session précédente et la lit directement. Aucun appel LLM. Aucun coût. La conversation originale est restaurée telle quelle.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Fonctionnement          | Envoie tout le context au LLM pour résumé | Prétraite la transcription, lecture directe |
| Appels LLM              | Nécessaire (100K+ tokens en général) | 0                                |
| Coût en tokens          | Élevé                             | 0                                |
| Perte d'information     | Oui (résumé à 3,3 %)             | Aucune (original préservé)       |
| Vitesse de traitement   | Dizaines de secondes              | < 1 sec (même pour des fichiers de 60 Mo+) |
| Quand le cache a expiré | Coût de re-cache complet en plus  | Aucun impact                     |
| Restauration multi-session | Impossible                     | Supportée                        |

Utilisation : `/clear` puis `/continue`. Une liste des sessions précédentes s'affiche. Choisissez celle à restaurer. Pour une reprise rapide : `/continue last`.

**Résultat :** Reprenez votre travail précédent à coût zéro. Aucune perte d'information.

---

## 📊 Fonctionnalité 4 : Live Status Line

**Monitoring tokens/coûts en temps réel. Moins de 50 ms de surcharge.**

Lancez `/setup-statusline install` une seule fois et une barre d'état persistante apparaît en bas de Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indicateur       | Ce qu'il affiche                    | 🟢 Normal | 🟡 Attention | 🔴 Critique |
| ---------------- | ----------------------------------- | --------- | ------------ | ----------- |
| RUN (delta)      | Coût du dernier appel API           | < ＄0.30   | >= ＄0.30     | >= ＄1.00    |
| RUN (cumulatif)  | Coût cumulé pour ce dossier         | —         | —            | —           |
| 5H               | Utilisation fenêtre 5h + compte à rebours | < 70%     | >= 70%       | >= 90%      |
| CTX              | Utilisation de la fenêtre de context | < 35%     | >= 35%       | >= 70%      |

Quand un indicateur atteint le seuil d'attention ou critique, une suggestion `→ /usage-view current` apparaît automatiquement.

Pour désinstaller : `/setup-statusline uninstall` (configuration précédente restaurée automatiquement).

**Résultat :** Visualisez l'état de vos coûts en un coup d'oeil. Agissez avant qu'il ne soit trop tard.

---

## 📈 Tableau de bord d'utilisation (/usage-view)

**Enfin une réponse à : "Pourquoi j'ai été limité ?"**

Jusqu'à présent, atteindre le rate limit ne faisait que vous énerver. Impossible d'en connaître la cause. Quelle session a consommé le plus de tokens ? Quand les coûts ont-ils grimpé ? Quels schémas se dégagent de votre utilisation ? Tout était invisible.

`/usage-view` montre tout. Un tableau de bord HTML interactif s'ouvre dans votre navigateur, vous permettant d'analyser les tendances d'utilisation et de remonter à la source des pics de coûts. Aucune dépendance externe. Fonctionne en autonome. Partageable sous forme de fichier.

Contenu :

- Tendances de coûts par jour / heure / jour de la semaine — repérez quand vous consommez le plus de tokens
- Répartition des tokens (input, output, cache write, cache read) — identifiez ce qui génère les coûts
- Analyse des coûts par session — identifiez les tâches les plus coûteuses
- Chronologie de la fenêtre de 5 heures (abonnés Max Plan) — retracez les déclencheurs de rate limit
- Analyse enrichie par IA — interprète les données et propose des améliorations
- 23 langues supportées (RTL inclus ; les graphiques/tableaux restent en LTR)

```
/usage-view                  # Tout l'historique, tous les projets
/usage-view current          # Fenêtre de 5 heures en cours uniquement
/usage-view last 7 days      # 7 derniers jours
/usage-view locale fr        # Français
```

---

## 🔬 Recherche sur le rate limit (/report-limit)

**Un projet communautaire pour percer le secret de la formule du rate limit.**

Anthropic ne publie pas la formule exacte de la fenêtre de 5 heures. Trouvons-la ensemble.

Quand vous atteignez un rate limit, lancez `/report-limit`. Vos données d'utilisation à cet instant sont automatiquement soumises sous forme de GitHub Discussion. Plus nous collectons de données, plus la formule devient claire.

---

## ✂️ Fonctionnalité 5 : /setup-git-lite — Réduire les instructions Git intégrées de CC

**Les 2 200 tokens cachés que vous payez sans le savoir à chaque session.**

### La découverte

Le 2026-04-12, une [issue GitHub](https://github.com/anthropics/claude-code/issues/47107) a révélé que le paramètre `includeGitInstructions` intégré à Claude Code brûle silencieusement des tokens à chaque session. Une reproduction indépendante via [ce gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) a confirmé les chiffres : **+6 031 tokens en cache_create** par session après chaque commit git, **+1 690 tokens en cache_read** à chaque appel API.

### Analyse du code source de CC — où vont les tokens

Nous avons retracé les tokens jusqu'à deux points d'injection indépendants dans le code source de Claude Code (v2.1.88) :

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` collecte la branche + branche principale + user.name + statut complet (jusqu'à 2 000 caractères) + **les 5 derniers commits**
- Assemblé et ajouté au system prompt via `appendSystemContext` (`utils/api.ts:437`)
- Chaque nouveau commit, chaque nouveau fichier modifié, chaque changement de branche modifie le texte → invalidation du préfixe de cache

**2. Instructions de workflow commit/PR (~1 700 tok) — description de l'outil Bash**
- `tools/BashTool/prompt.ts:53` ajoute plus de 60 lignes de protocole de sécurité, procédure de commit étape par étape, exemples HEREDOC et templates de création de PR à la description de l'outil `Bash`
- Mis en cache avec le system prompt, mais transmis en tant que paramètre `tools[]`

### Pourquoi c'est coûteux

La structure du cache (`utils/api.ts:321` `splitSysPromptPrefix`) comporte trois chemins selon que vous avez des outils MCP actifs :

- **Path A** (MCP actif — la plupart des utilisateurs) : `gitStatus` se trouve dans un bloc `cacheScope: 'org'`. Toute modification → tout le bloc est remis en cache au prochain démarrage de session → 6K tok de `cache_create` manqué.
- **Path B** (sans MCP) : `gitStatus` va dans un bloc dynamique `cacheScope: null`, ce qui signifie qu'il est renvoyé en `input_tokens` frais à chaque appel API — pas de défaut de cache, mais pas d'économies de cache non plus.
- **Path C** (fournisseur tiers / betas expérimentaux désactivés) : identique à Path A.

Dans les sessions interactives typiques, les instructions commit/PR (1,7K tok) s'accumulent **à chaque appel API** via `cache_read`. Sur une session de 100 appels au tarif Opus 4.7, cela représente environ **0,08 $ par session** uniquement pour des instructions que l'entraînement de Claude couvre déjà en grande partie.

### Comment cc-token-saver gère ça

`/setup-git-lite` désactive le chemin natif et injecte un **remplacement optimisé de 280 tokens** via un hook SessionStart. Nous avons conservé exactement ce qui modifie le comportement par défaut de Claude (règles de sécurité), et supprimé tout ce que Claude sait déjà de son entraînement (workflows étape par étape, templates de PR, patterns d'utilisation de gh).

**Conservé — 11 règles critiques de remplacement** (celles qui inversent l'instinct d'aide de Claude en prudence) :
- Ne jamais faire de commit/push/amend/PR/tag/merge sans demande explicite de l'utilisateur
- Ne jamais ignorer les hooks, faire de force-push vers main/master, exécuter des opérations destructives, modifier la config git
- Ne jamais committer des fichiers correspondant à `.env`, `credentials`, `*.pem`, `secret.*`
- Éviter `git add -A` / `git add .`
- HEREDOC pour les messages de commit multi-lignes + trailer `Co-Authored-By: Claude`
- Ne jamais utiliser les flags interactifs (-i), pas de commits vides
- Si un hook pre-commit échoue → créer un NOUVEAU commit (pas `--amend`)

**Supprimé** — workflow de commit étape par étape (3 étapes), workflow de PR étape par étape (3 étapes), template titre/corps de PR, références aux commandes `gh`, avertissement sur le flag `-uall`, avertissement sur `--no-edit` avec rebase, contrainte `NEVER use TodoWrite or Agent tools during commit`. Ce sont des verbosités de workflow que Claude compose correctement depuis son entraînement seul.

**Ajouté** — ligne d'état git compacte : branche + HEAD short-sha + sujet + statut actuel (jusqu'à 20 fichiers modifiés, sinon un décompte). Pas de liste des commits récents (Claude peut exécuter `git log` à la demande).

### Économies attendues (tarifs Opus 4.7, 25 $/MTok sortie, 5 $/MTok entrée, 0,50 $/MTok lecture cache)

| Élément | Original | Avec setup-git-lite | Économisé |
| ------- | -------- | ------------------- | --------- |
| Chargement system prompt (par nouvelle session) | ~2 200 tok cache_create | ~280 tok cache_create | ~1 920 tok |
| Appels répétés dans la même session | ~1 700 tok cache_read/appel | ~280 tok cache_read/appel | ~1 420 tok/appel |
| Session de 100 appels (Opus 4.7) | — | — | **~0,11 $ économisés** |
| 20 sessions/jour × 22 jours ouvrés | — | — | **~48 $ économisés/mois** |

### Utilisation

```bash
/setup-git-lite status     # Diagnostic en lecture seule — état actuel + ce qui changerait
/setup-git-lite install    # Désactiver CC natif + activer notre hook minimal
/setup-git-lite revert     # Restaurer les paramètres par défaut (agressif ; voir ci-dessous)
/setup-git-lite dismiss-banner    # Masquer le conseil de recommandation occasionnel
/setup-git-lite undismiss-banner  # Réactiver le conseil
/setup-git-lite help       # Utilisation complète
```

### Sémantique d'installation

`install` modifie **deux** endroits par robustesse :

1. `~/.claude/settings.json` — ajoute `"includeGitInstructions": false`
2. Profil shell (`~/.zshrc`, `~/.bashrc`, etc.) — ajoute un bloc marqueur exportant `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

L'un ou l'autre suffit à désactiver CC natif ; nous configurons les deux pour qu'une substitution d'environnement ne réactive pas accidentellement le comportement natif. La modification shell ne prend effet que dans les nouveaux shells.

### Sémantique de restauration — agressive

`revert` **supprime TOUS les exports `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` de votre profil shell**, y compris ceux que vous avez peut-être ajoutés manuellement avant d'installer cette skill. C'est intentionnel — vous avez lancé `revert`, donc nous restaurons le comportement par défaut propre. Nous créons toujours une sauvegarde horodatée du profil shell au préalable.

Si vous avez besoin de la variable d'environnement pour d'autres raisons, notez-la avant de lancer `revert` et rajoutez-la après.

### Avant de désinstaller cc-token-saver

**Lancez `/setup-git-lite revert` d'abord**, sinon vous vous retrouverez avec `includeGitInstructions: false` dans votre settings.json mais sans hook de remplacement (Claude ne reçoit aucune instruction git du tout). Claude Code ne dispose actuellement d'aucun hook de cycle de vie de désinstallation de plugin, nous ne pouvons donc pas automatiser cela.

### Compromis

Ce que vous perdez (et pourquoi c'est généralement acceptable) :
- Claude ne reçoit plus un `git status` / `git log -n 5` précalculé au démarrage de session. Si vous demandez "qu'est-ce qui a changé ?" dans une nouvelle session, Claude exécutera ces commandes lui-même (un appel d'outil supplémentaire, ~300 tok).
- Claude ne voit plus la procédure de commit canonique en 3 étapes de CC. D'après nos tests sur des centaines de flux de commit, les connaissances issues de l'entraînement gèrent les cas critiques (formatage HEREDOC, pas de `--amend`, pas de force-push) car nous les conservons en tant que règles explicites.
- Le template de corps de PR (`## Summary` + `## Test plan`) n'est pas injecté. Si ce format exact vous importe, placez-le dans le CLAUDE.md de votre projet.

### Bandeau de recommandation

Quand les instructions git natives de CC sont toujours actives sur votre machine, cc-token-saver affiche un conseil d'un paragraphe au démarrage de session **environ 20 % du temps** (ainsi que dans les sorties de `/usage-view` et `/report-limit`). Masquez-le définitivement avec `/setup-git-lite dismiss-banner`.

---

## 💡 Comment le cache fonctionne réellement

Claude Code envoie l'intégralité de l'historique de conversation au modèle à chaque appel API. "Appel API" ne signifie pas "un message que vous avez tapé." Un seul prompt déclenche des appels d'outils internes — Grep, Read, Edit, Write — et chacun est un appel API distinct. Un seul prompt peut facilement générer plus de 10 appels API.

Le cache de prompt réduit ce coût de 90 %. Mais le cache a une durée de vie.

|                     | Session Main                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| TTL du cache        | 1 heure (ephemeral_1h)                | 5 min                                  |
| Écriture cache      | ＄10/MTok                              | ＄6.25/MTok                             |
| Lecture cache        | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Quand le cache expire | Context entier renvoyé au prix fort | Impact faible (context petit)          |

Même avec le cache actif, les coûts s'accumulent. Voici un scénario extrême pour illustrer la différence.

### Scénario : Journée complète de code (3h matin → 2h déjeuner/réunion → 3h après-midi)

Conditions : tarifs Opus 4, 1 prompt par minute, ~5 appels API par prompt (~300 appels/heure).

#### ❌ Sans cc-token-saver

L'essentiel du travail se fait dans la session Main. Le context grossit vite.

| Phase       | Situation                         | Taille du context            | Coût                                   |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Matin 3h    | Développement (surtout en Main)   | 100K → 600K (moy. 350K)     | 900 appels × 350K × ＄0.50/M = ＄157.50 |
| Déjeuner/réunion | Absence de 2 heures           | —                            | —                                      |
| Retour      | Cache expiré → renvoi complet     | 600K au prix fort            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Retour      | /compact (résumé)                 | 600K → envoyé au LLM        | 600K × ＄0.50/M + sortie résumé = ~＄1.50 |
| Après-midi 3h | Le développement continue (context regrossit) | 100K → 600K (moy. 350K) | 900 appels × 350K × ＄0.50/M = ＄157.50 |
|             | Total                             |                              | ~＄326                                  |

> À ce niveau d'utilisation, vous atteindrez probablement le rate limit de la fenêtre de 5 heures. **Le coût est un problème, mais le vrai problème c'est que votre travail s'arrête complètement. C'est exactement le moment où votre Claude Code s'éteint.**

#### ✅ Avec cc-token-saver

Le travail lourd est délégué aux SubTask. Main ne gère que le design et les décisions.

| Phase       | Situation                                    | Taille du context             | Coût                               |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Matin 3h    | Développement (Main : design, SubTask : implémentation) | Main 100K → 300K (moy. 200K) | 900 appels × 200K × ＄0.50/M = ＄90 |
| Déjeuner/réunion | Absence de 2 heures                    | —                             | —                                  |
| Retour      | ⚡ Token Guardian bloque → /clear + /continue | —                             | ＄0 (aucun appel LLM)              |
| Après-midi 3h | Le développement continue                  | Main 100K → 300K (moy. 200K) | 900 appels × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                               | ~＄180                              |

#### 💰 Résultat

> **＄326 → ＄180. ＄146 économisés par jour (45 %).**
>
> Ce n'est pas qu'une question de coût. Moins de tokens dans le même temps signifie que **vous n'atteignez pas le rate limit et pouvez continuer à travailler.** C'est ça la vraie différence.

### Où cc-token-saver intervient

```
[Démarrage de session]
    │
    ├─ Session Architect → Injecte automatiquement le schéma de délégation SubTask
    │                       Maintient le context Main sous 250K
    │
[En cours de travail]
    │
    ├─ Status Line → Monitoring temps réel coûts/context/rate limit
    │                  Alerte instantanée en zone d'attention
    │
[1+ heure d'inactivité]
    │
    ├─ Token Guardian → Détecte l'expiration du cache, bloque avant le renvoi
    │
[Redémarrage de session]
    │
    └─ /continue → Restaure le context précédent à coût zéro (aucun appel LLM)
```

---

## 🔧 Installation depuis les sources et personnalisation

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver est entièrement open source. Le code est du JavaScript et des scripts Bash standards suivant la structure de plugin classique. Modifiez ce que vous voulez.

- **hooks/** — Modifier le seuil d'expiration du cache, personnaliser les messages d'avertissement, ajuster les règles d'architecture de session
- **scripts/** — Logique d'analyse, générateur de rapports, formatage de la barre d'état
- **skills/** — Fonctionnement de /continue et /usage-view, templates de prompt
- **locales/** — Ajouter/modifier des traductions, ajouter de nouvelles langues
- **skills/usage-view/** — Modifications UI/UX du tableau de bord

Faites-en le vôtre. Forkez, expérimentez, et envoyez une PR si vous trouvez mieux.

---

## 🌐 Langues supportées

23 langues supportées. Sélectionnées en croisant les 20 premiers pays par utilisation de Claude Code avec les 20 premières langues par nombre de locuteurs dans le monde. La langue d'affichage est détectée automatiquement depuis la locale de votre OS. Vous pouvez également la spécifier manuellement : `/usage-view locale fr`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Les traductions actuelles sont générées par IA. Les contributions de locuteurs natifs sont les bienvenues — modifiez le fichier JSON de votre langue dans `locales/` et soumettez une PR.

---

## 💡 Conseils

### Comprendre le cache, c'est comprendre où part l'argent

- **1 prompt ≠ 1 appel API.** Chaque fois que Claude appelle Grep, Read ou Edit, l'intégralité du context est renvoyée. Un seul prompt déclenche facilement plus de 10 appels API. Rédigez des prompts clairs pour réduire les appels d'outils inutiles et baisser les coûts.
- **Le cache se calcule depuis le dernier appel API, pas le dernier prompt.** Tant que vous travaillez, le cache n'expire jamais. Le danger, c'est de s'absenter. Token Guardian bloque une seule fois, et au retour vous choisissez : réinitialiser le context ou continuer tel quel.
- **Taille du context = multiplicateur de coût.** Le même appel API à 200K vs 800K coûte 4 fois plus. Quand le [CTX] de la barre d'état dépasse 35 % (🟡), c'est le signal pour déléguer davantage aux SubTask.

### Habitudes qui réduisent les coûts

- **Gardez CLAUDE.md léger.** Il est chargé dans le system prompt à chaque appel API. Chaque ligne coûte de l'argent.
- **Déléguez le travail lourd aux SubTask.** Génération de code, modifications multi-fichiers, exécution de tests n'ont pas leur place dans Main. Les SubTask ont un context plus petit et un tier de cache moins cher.
- **Absent 1+ heure ?** `/clear` → revenez → `/continue`. Context restauré pour $0.
- **[5H] au-dessus de 70 % (🟡) ?** Ralentissez. Passez à des tâches de revue légères ou augmentez la délégation aux SubTask pour réduire le nombre d'appels API de Main.
- **Utilisez `/btw` pour les questions annexes.** Elles n'entrent pas dans l'historique de conversation, votre context reste léger.

---

## License

Apache-2.0
