# cc-token-saver

> **O Claude Code fica te cortando? Nunca mais.**
>
> Gaste menos, programe por mais tempo e veja exatamente para onde vão seus tokens — zero configuração.

Como? Gerenciamento automático de context, rastreamento de custos em tempo real e controle de session com reconhecimento de cache — tudo em um único plugin.

---

## 😤 O Problema: $200/mês e Você Ainda Não Consegue Trabalhar

Claude Code Max Plan ($200/mês). Deveria ser suficiente. Não é.

**Rate limit de janela rolante de 5 horas.** Você está no meio de um fluxo de programação e simplesmente para. Sem timer. Sem previsão. Só esperar.

**Cache expiry.** Você volta do almoço. Passou mais de uma hora. Você envia um prompt e 900K tokens são reenviados pelo preço cheio. Custo? $9 de uma só vez.

**Custos invisíveis.** Não há como ver quanto você está gastando em tempo real. Você só descobre depois que o rate limit bate.

**Tudo manual.** Tamanho do context, timing de cache expiry, delegação de SubTask, limpeza de session. Ninguém consegue acompanhar tudo isso enquanto programa de verdade.

O cc-token-saver cuida de tudo automaticamente. **Instale uma vez. Pronto.**

---

## 🚀 Instalação

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Funciona automaticamente após a instalação. Zero configuração. Requer [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Para monitoramento ao vivo:

```
/setup-statusline install
```

---

## 🛡️ Feature 1: Token Guardian

**Detecta cache expiry e bloqueia automaticamente reenvios caros.**

O TTL do cache de prompt do Claude Code é de 1 hora. Fique ausente por mais de uma hora e o cache expira. Sua próxima mensagem reenvia todo o context pelo preço cheio. Com 900K tokens, são $9 de uma só vez.

O Token Guardian rastreia quando a última resposta foi recebida. Se mais de 3.590 segundos passaram (TTL menos buffer de 10 segundos), ele bloqueia o prompt e exibe um aviso.

```
🚨 Cache expirado (68m 23s inativo)

O cache expirou. Continuar reenviará todo o contexto.
O custo pode aumentar significativamente.

👉 /context — Verificar o uso atual do contexto antes de decidir
👉 /clear → /continue — Reiniciar e restaurar contexto anterior (recomendado, menor custo)
👉 Reenviar — Continuar como está (custo total de re-cache incorrido)
```

Basta reenviar o mesmo prompt após o aviso — ele passa. O aviso só dispara uma vez por período de inatividade, então nunca incomoda. As mensagens de aviso são exibidas em 23 idiomas com base no locale do seu sistema operacional.

**Resultado:** Custos caros de re-cache são evitados automaticamente. Nenhum esforço necessário.

---

## 🧠 Feature 2: Smart Session Architecture

**Instale e padrões de trabalho otimizados para custo entram em ação automaticamente.**

A maioria dos usuários faz tudo na session Main. Leitura de arquivos, geração de código, execução de testes. Cada saída se acumula no context e é reenviada a cada mensagem. A session incha. Os custos disparam.

O Session Architect injeta automaticamente uma estratégia de delegação no início da session.

|                  | Session Main                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Função           | Design, decisões, revisão         | Implementação, geração de código, multi-arquivo |
| Cache tier       | 1 hora (ephemeral_1h)             | 5 min                                 |
| Custo cache write | ＄10/MTok                          | ＄6.25/MTok                            |
| Tamanho context  | ~94K média                        | ~33K média                            |

SubTasks têm **cache writes 37,5% mais baratos** que a Main. O context também é muito menor. Delegar trabalho pesado para SubTasks reduz custos drasticamente.

**Resultado:** O Claude trabalha automaticamente em um padrão eficiente em custo. Você não precisa pensar nisso.

---

## 🪶 Modo Conciso

**Mesmo conteúdo. Menos preenchimento. Ativo por padrão.**

O mesmo hook SessionStart também injeta uma regra de estilo de resposta que roda em **cada sessão e cada modelo** — sem flags, sem configuração. Três coisas mudam:

- **Preâmbulo fora** — sem "Deixa eu verificar…", "Agora eu vou…", repetir sua pergunta, ou resumir o que o diff já mostra
- **Formato adequado ao conteúdo** — bullets para listas, prosa para raciocínio (tradeoffs, causalidade, justificativas). Nenhum é forçado
- **Expressão mais enxuta** — mesmo ponto, menos palavras. Prosa mais clara é prosa mais curta

Limite rígido: nunca cortar conteúdo, pular verificação, ou esmagar nuance em uma única frase. A substância permanece íntegra; só a embalagem encolhe.

Instale uma vez, vale em todo lugar.

---


## 🔄 Feature 3: /continue — Restauração de Context

**Substitui o `/compact`. Zero chamadas LLM. Zero custo de token.**

O `/compact` envia todo o seu context (~1M tokens) para o LLM comprimir em um resumo de 3,3%. Se o cache expirou, só isso já dispara um re-cache completo. Perda de informação é inevitável.

O `/continue` adota uma abordagem completamente diferente. Ele pré-processa o transcript da session anterior e carrega diretamente. Sem chamada LLM. Sem custo. A conversa original é restaurada integralmente.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Como funciona           | Envia context completo ao LLM para resumo | Pré-processa transcript, lê diretamente |
| Chamadas LLM            | Necessária (tipicamente 100K+ tokens) | 0                                |
| Custo de token          | Alto                              | 0                                |
| Perda de informação     | Sim (resumo de 3,3%)              | Nenhuma (original preservado)    |
| Velocidade              | Dezenas de segundos               | < 1 seg (mesmo arquivos 60MB+)   |
| Quando cache expira     | Custo de re-cache somado          | Sem impacto                      |
| Restauração multi-session | Não é possível                   | Suportado                        |

Uso: `/clear` e depois `/continue`. Você verá uma lista de sessions anteriores. Escolha uma para restaurar. Para recuperação rápida: `/continue last`.

**Resultado:** Retome trabalho anterior com custo zero. Sem perda de informação.

---

## 📊 Feature 4: Live Status Line

**Monitoramento de token/custo em tempo real. Menos de 50ms de overhead.**

Execute `/setup-statusline install` uma vez e uma barra de status persistente aparece na parte inferior do Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indicador        | O que mostra                        | 🟢 Normal | 🟡 Atenção | 🔴 Crítico  |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Custo da última chamada API         | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (acumulado)  | Custo acumulado para esta pasta     | —         | —          | —           |
| 5H               | Uso da janela de 5h + contagem regressiva | < 70%     | >= 70%     | >= 90%      |
| CTX              | Uso da context window               | < 35%     | >= 35%     | >= 70%      |

Quando qualquer indicador atinge atenção ou crítico, uma dica `→ /usage-view current` aparece automaticamente.

Para remover: `/setup-statusline uninstall` (configuração anterior restaurada automaticamente).

**Resultado:** Veja o estado dos custos de relance. Aja antes que seja tarde.

---

## 📈 Usage Dashboard (/usage-view)

**Finalmente responda: "Por que fui limitado pelo rate limit?"**

Até agora, bater no rate limit só te deixava irritado. Sem como saber a causa. Qual session queimou mais tokens? Quando os custos dispararam? Que padrões existem no seu uso? Tudo invisível.

O `/usage-view` mostra tudo. Um dashboard HTML interativo abre no seu navegador, permitindo analisar padrões de uso e rastrear a causa raiz de picos de custo. Sem dependências externas. Funciona de forma autônoma. Compartilhável como arquivo.

O que está incluso:

- Tendências de custo diário / por hora / por dia da semana — identifique quando você mais consome tokens
- Detalhamento de token (input, output, cache write, cache read) — veja o que está gerando custos
- Análise de custo por session — identifique quais tarefas foram caras
- Timeline da janela de 5 horas (assinantes Max Plan) — rastreie gatilhos de rate limit
- Análise de insights com IA — interpreta dados e sugere melhorias
- 23 idiomas suportados (RTL incluso; gráficos/tabelas permanecem LTR)

```
/usage-view                  # Todo o histórico, todos os projetos
/usage-view current          # Apenas a janela de 5 horas atual
/usage-view last 7 days      # Últimos 7 dias
/usage-view locale pt        # Português
```

---

## 🔬 Pesquisa de Rate Limit (/report-limit)

**Projeto colaborativo para engenharia reversa da fórmula de rate limit.**

A Anthropic não publica a fórmula exata da janela de 5 horas. Vamos descobrir juntos.

Quando você bater no rate limit, execute `/report-limit`. Seus dados de uso atuais são enviados automaticamente como uma GitHub Discussion. Quanto mais dados coletarmos, mais clara a fórmula fica.

---

## ✂️ Feature 5: /setup-git-lite — Reduza as Instruções Git Nativas do CC

**Os 2.200 tokens ocultos por session que você não sabia que estava pagando.**

### A descoberta

Em 2026-04-12, uma [issue no GitHub](https://github.com/anthropics/claude-code/issues/47107) revelou que a configuração nativa `includeGitInstructions` do Claude Code queima tokens silenciosamente a cada session. A reprodução independente via [este gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) confirmou os números: **+6.031 tokens em cache writes** por session após cada commit git, **+1.690 tokens em cache reads** em cada chamada API.

### Análise do código-fonte do CC — para onde vão os tokens

Rastreamos os tokens até dois pontos de injeção independentes no código-fonte do Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` coleta branch + branch principal + user.name + status completo (até 2000 chars) + **5 commits recentes**
- Concatenado e anexado ao system prompt via `appendSystemContext` (`utils/api.ts:437`)
- Cada novo commit, cada novo arquivo modificado, cada troca de branch altera o texto → invalidação do prefix cache

**2. Instruções de workflow de commit/PR (~1.700 tok) — descrição da ferramenta Bash**
- `tools/BashTool/prompt.ts:53` anexa 60+ linhas de protocolo de segurança, procedimento passo a passo de commit, exemplos com HEREDOC e templates de criação de PR à descrição da ferramenta `Bash`
- Armazenado em cache junto com o system prompt, mas enviado como parâmetro `tools[]`

### Por que é caro

A estrutura de cache (`utils/api.ts:321` `splitSysPromptPrefix`) possui três caminhos com base na presença de ferramentas MCP ativas:

- **Path A** (MCP ativo — maioria dos usuários): `gitStatus` fica dentro de um bloco `cacheScope: 'org'`. Qualquer alteração → bloco inteiro reenviado no início da próxima session → 6K tok de cache_create miss.
- **Path B** (sem MCP): `gitStatus` vai para um bloco dinâmico `cacheScope: null`, o que significa que é reenviado como `input_tokens` frescos em cada chamada API — sem cache miss, mas também sem economia de cache.
- **Path C** (provedor de terceiros / betas experimentais desativados): igual ao Path A.

Em sessions interativas típicas, as instruções de commit/PR (1,7K tok) se acumulam **em cada chamada API** via cache_read. Em uma session de 100 chamadas com preços do Opus 4.7, isso representa aproximadamente **$0,08 por session** só para instruções que o treinamento do Claude já cobre em grande parte.

### Como o cc-token-saver lida com isso

`/setup-git-lite` desativa o caminho nativo e injeta uma **substituição curada de 280 tokens** via hook SessionStart. Mantivemos exatamente o que sobrescreve o comportamento padrão do Claude (regras de segurança), e descartamos tudo que o Claude já sabe pelo treinamento (fluxos de trabalho passo a passo, templates de PR, padrões de uso do gh).

**Mantidas — 11 regras críticas de override** (as que convertem a prestatividade padrão do Claude em cautela):
- Nunca fazer commit/push/amend/PR/tag/merge sem solicitação explícita do usuário
- Nunca pular hooks, fazer force-push para main/master, executar operações destrutivas, modificar git config
- Nunca fazer commit de arquivos correspondentes a `.env`, `credentials`, `*.pem`, `secret.*`
- Evitar `git add -A` / `git add .`
- HEREDOC para mensagens de commit multilinha + trailer `Co-Authored-By: Claude`
- Nunca usar flags interativas (-i), sem commits vazios
- Se o hook de pre-commit falhar → criar um NOVO commit (não `--amend`)

**Descartadas** — fluxo de trabalho de commit passo a passo (3 etapas), fluxo de trabalho de PR passo a passo (3 etapas), template de título/corpo de PR, referências ao comando `gh`, aviso sobre flag `-uall`, aviso sobre `--no-edit` com rebase, restrição `NEVER use TodoWrite or Agent tools during commit`. São verbosidades de fluxo de trabalho que o Claude compõe corretamente só com o treinamento.

**Adicionadas** — linha compacta de estado git: branch + HEAD short-sha + subject + status atual (até 20 arquivos modificados, ou um contador). Sem lista de commits recentes (o Claude pode executar `git log` sob demanda).

### Economia esperada (preços Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Item | Original | Com setup-git-lite | Economia |
| ---- | -------- | ------------------- | -------- |
| Carregamento do system prompt (por nova session) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Chamadas repetidas na mesma session | ~1.700 tok cache_read/chamada | ~280 tok cache_read/chamada | ~1.420 tok/chamada |
| Session de 100 chamadas (Opus 4.7) | — | — | **~$0,11 economizados** |
| 20 sessions/dia × 22 dias úteis | — | — | **~$48 economizados/mês** |

### Uso

```bash
/setup-git-lite status     # Diagnóstico somente leitura — estado atual + o que mudaria
/setup-git-lite install    # Desativa o nativo do CC + ativa nosso hook mínimo
/setup-git-lite revert     # Restaura o padrão (agressivo; veja abaixo)
/setup-git-lite dismiss-banner    # Silencia a dica de recomendação ocasional
/setup-git-lite undismiss-banner  # Reativa a dica
/setup-git-lite help       # Uso completo
```

### Semântica do install

`install` modifica **dois** lugares para maior robustez:

1. `~/.claude/settings.json` — adiciona `"includeGitInstructions": false`
2. Perfil de shell (`~/.zshrc`, `~/.bashrc`, etc.) — acrescenta um bloco marcador exportando `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Qualquer um dos dois sozinho já é suficiente para desativar o nativo do CC; definimos ambos para que uma substituição de variável de ambiente não reative acidentalmente o comportamento nativo. A mudança no shell só tem efeito em novos shells.

### Semântica do revert — agressivo

`revert` **remove TODAS as exportações de `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` do seu perfil de shell**, incluindo as que você possa ter adicionado manualmente antes de instalar esta skill. Isso é intencional — você executou `revert`, então restauramos o padrão limpo. Sempre criamos um backup com timestamp do perfil de shell antes.

Se você precisar da variável de ambiente por outros motivos, anote antes de executar `revert` e adicione novamente depois.

### Antes de desinstalar o cc-token-saver

**Execute `/setup-git-lite revert` primeiro**, ou você ficará com `includeGitInstructions: false` no seu settings.json mas sem o hook de substituição (o Claude não receberá nenhuma orientação git). O Claude Code atualmente não possui hook de ciclo de vida para desinstalação de plugin, então não conseguimos automatizar isso.

### Compensações

O que você perde (e por que geralmente não é problema):
- O Claude não recebe mais um `git status` / `git log -n 5` pré-computado no início da session. Se você perguntar "o que mudou?" em uma nova session, o Claude executará esses comandos por conta própria (uma chamada de ferramenta extra, ~300 tok).
- O Claude não vê mais o procedimento canônico de commit em 3 etapas do CC. Em nossos testes em centenas de fluxos de commit, o conhecimento em nível de treinamento lida com os casos críticos (formatação HEREDOC, sem `--amend`, sem force-push) porque mantemos essas regras explícitas.
- O template de corpo de PR (`## Summary` + `## Test plan`) não é injetado. Se você se importa com exatamente esse formato, coloque no CLAUDE.md do seu projeto.

### Banner de recomendação

Quando as instruções git nativas do CC ainda estão ativas na sua máquina, o cc-token-saver exibe uma dica de um parágrafo no início da session **~20% das vezes** (além de nas saídas de `/usage-view` e `/report-limit`). Desative permanentemente com `/setup-git-lite dismiss-banner`.

---

## 💡 Como o Cache Realmente Funciona

O Claude Code envia todo o histórico de conversa para o modelo em cada chamada API. "Chamada API" não significa "uma mensagem que você digitou." Um único prompt dispara chamadas internas de ferramentas — Grep, Read, Edit, Write — e cada uma é uma chamada API separada. Um prompt pode facilmente causar mais de 10 chamadas API.

O cache de prompt reduz esse custo em 90%. Mas o cache tem vida útil.

|                     | Session Main                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 hora (ephemeral_1h)                 | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Quando cache expira | Context completo reenviado pelo preço cheio | Impacto baixo (context é pequeno)     |

Mesmo com o cache ativo, os custos se acumulam. Aqui está um cenário extremo para mostrar a diferença.

### Cenário: Dia inteiro programando (3h manhã → 2h almoço/reunião → 3h tarde)

Condições: Preços Opus 4, 1 prompt por minuto, ~5 chamadas API por prompt (~300 chamadas/hora).

#### ❌ Sem cc-token-saver

A maior parte do trabalho acontece na session Main. O context cresce rápido.

| Fase        | Situação                          | Tamanho context              | Custo                                  |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Manhã 3h    | Programando (maioria na Main)     | 100K → 600K (média 350K)    | 900 chamadas × 350K × ＄0.50/M = ＄157.50 |
| Almoço/reu. | Ausente por 2 horas               | —                            | —                                      |
| Retorno     | Cache expirado → reenvio completo | 600K preço cheio             | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Retorno     | /compact (resumir)                | 600K → enviado ao LLM       | 600K × ＄0.50/M + saída resumo = ~＄1.50  |
| Tarde 3h    | Programação continua (context cresce) | 100K → 600K (média 350K)  | 900 chamadas × 350K × ＄0.50/M = ＄157.50 |
|             | Total                             |                              | ~＄326                                  |

> Nesse nível de uso, você provavelmente vai bater no rate limit da janela de 5 horas. **O custo é ruim, mas o verdadeiro problema é o seu trabalho parar completamente. Este é o exato momento em que o Claude Code apaga.**

#### ✅ Com cc-token-saver

Trabalho pesado é delegado para SubTasks. A Main lida apenas com design/decisões.

| Fase        | Situação                                     | Tamanho context               | Custo                              |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Manhã 3h    | Programando (Main: design, SubTask: implementação) | Main 100K → 300K (média 200K) | 900 chamadas × 200K × ＄0.50/M = ＄90 |
| Almoço/reu. | Ausente por 2 horas                          | —                             | —                                  |
| Retorno     | ⚡ Token Guardian bloqueia → /clear + /continue | —                           | ＄0 (zero chamadas LLM)             |
| Tarde 3h    | Programação continua                         | Main 100K → 300K (média 200K) | 900 chamadas × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                               | ~＄180                              |

#### 💰 Resultado

> **＄326 → ＄180. ＄146 economizados por dia (45%).**
>
> Não é só questão de custo. Menos tokens no mesmo intervalo significa que **você não bate no rate limit e pode continuar trabalhando.** Essa é a diferença real.

### Onde o cc-token-saver entra em ação

```
[Início da Session]
    │
    ├─ Session Architect → Injeta automaticamente padrão de delegação SubTask
    │                       Mantém context da Main abaixo de 250K
    │
[Trabalhando]
    │
    ├─ Status Line → Monitoramento em tempo real de custo/context/rate limit
    │                  Alerta instantâneo ao entrar na zona de atenção
    │
[1+ hora inativo]
    │
    ├─ Token Guardian → Detecta cache expiry, bloqueia antes do reenvio
    │
[Reinício de session]
    │
    └─ /continue → Restaura context anterior com custo zero (sem chamadas LLM)
```

---

## 🔧 Instalação via Código-Fonte e Personalização

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

O cc-token-saver é totalmente aberto. Todo o código-fonte é JavaScript puro + scripts Bash seguindo a estrutura padrão de plugin. Modifique o que quiser.

- **hooks/** — Altere o limite de cache expiry, personalize mensagens de aviso, modifique regras de session architecture
- **scripts/** — Lógica de análise, gerador de relatórios, formatação da status line
- **skills/** — Como /continue e /usage-view funcionam, templates de prompt
- **locales/** — Adicione/edite traduções, adicione novos idiomas
- **skills/usage-view/** — Alterações de UI/UX do dashboard

Faça do seu jeito. Faça um fork, experimente e envie um PR se encontrar algo melhor.

---

## 🌐 Idiomas Suportados

23 idiomas suportados. Selecionados cruzando os 20 países com maior uso do Claude Code com os 20 idiomas com maior número de falantes no mundo. O idioma de exibição é detectado automaticamente pelo locale do seu sistema operacional. Você também pode especificar manualmente: `/usage-view locale pt`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

As traduções atuais são geradas por IA. Contribuições de falantes nativos são bem-vindas — edite o arquivo JSON do seu idioma em `locales/` e envie um PR.

---

## 💡 Dicas

### Entenda o cache e você vai ver para onde o dinheiro vai

- **1 prompt ≠ 1 chamada API.** Toda vez que o Claude chama Grep, Read ou Edit, todo o context é reenviado. Um único prompt facilmente dispara mais de 10 chamadas API. Escreva prompts claros para reduzir chamadas de ferramentas desnecessárias e cortar custos.
- **O timer do cache reseta a partir da última chamada API, não do seu último prompt.** Continue trabalhando e o cache nunca expira. O perigo é se ausentar. O Token Guardian bloqueia automaticamente uma vez, então quando você voltar pode escolher: resetar o context ou continuar como está.
- **Tamanho do context = multiplicador de custo.** A mesma chamada API com 200K vs 800K custa 4x mais. Quando o [CTX] da status line passar de 35% (🟡), é o sinal para delegar mais para SubTasks.

### Hábitos que reduzem custos

- **Mantenha o CLAUDE.md enxuto.** Ele é carregado no system prompt em cada chamada API. Cada linha custa dinheiro.
- **Delegue trabalho pesado para SubTasks.** Geração de código, edições multi-arquivo, execução de testes não pertencem à Main. SubTasks têm context menor e um cache tier mais barato.
- **Ficou ausente por 1+ hora?** `/clear` → volte → `/continue`. Context restaurado a $0.
- **[5H] acima de 70% (🟡)?** Diminua o ritmo. Mude para tarefas leves de revisão ou aumente a delegação de SubTask para reduzir a contagem de chamadas API da Main.
- **Use `/btw` para perguntas paralelas.** Não entra no histórico da conversa, então seu context permanece enxuto.

---

## License

Apache-2.0
