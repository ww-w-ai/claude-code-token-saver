# Guia de custos de cache — Por que a maior parte do seu gasto e cache

E normal que a maior parte dos custos das suas ferramentas de programacao com IA venha de operacoes de cache (escritas + leituras). Este documento explica por que e como gerenciar isso.

## O segredo: cada mensagem reenvia toda a conversa

Os LLMs sao **sem estado**. Diferente dos humanos, os modelos de IA nao "lembram" de conversas anteriores — eles recebem o historico completo da conversa como entrada em cada solicitacao.

Parece um chat, mas as chamadas reais da API funcionam assim:

```
[ Solicitacao 1 ]
→ Prompt do sistema + "Corrija este bug"
← Resposta da IA

[ Solicitacao 2 ]
→ Prompt do sistema + "Corrija este bug" + Resposta da IA + "Adicione testes tambem"
← Resposta da IA

[ Solicitacao 3 ]
→ Prompt do sistema + "Corrija este bug" + Resposta da IA + "Adicione testes tambem" + Resposta da IA + "Faca o commit"
← Resposta da IA
```

Cada solicitacao inclui **todo** o conteudo anterior. Por exemplo, a 50a solicitacao contem toda a conversa e todas as respostas da IA das 49 solicitacoes anteriores. E por isso que os tokens de entrada crescem rapidamente a medida que a conversa se alonga.

Alem disso, as ferramentas de programacao com IA enviam o prompt do sistema (instrucoes integradas, arquivos de configuracao, plugins, definicoes de ferramentas MCP, etc.) com cada solicitacao — entao ate uma mensagem de uma linha gera dezenas de milhares de tokens de entrada.

## O que e caching?

O **prompt caching** reduz o custo dessa transmissao repetida. Ele armazena as porcoes inalteradas da sua entrada no servidor para que solicitacoes subsequentes possam reutiliza-las com um preco reduzido.

- **Cache Write**: O custo de armazenar o conteudo da conversa no servidor. Ocorre na primeira solicitacao ou apos a expiracao do cache.
- **Cache Read**: O custo de reutilizar conversa ja armazenada. Cobrado com um **desconto de 90%** em comparacao com a entrada padrao.

As ferramentas de programacao com IA inevitavelmente produzem conversas longas e contextos grandes, de ate 1 milhao de tokens por solicitacao. Mesmo que sua nova pergunta seja curta, toda a conversa anterior e cobrada junto, entao os custos se acumulam rapidamente a medida que a conversa cresce.

Para reduzir essa carga, os principais provedores de IA aplicam um desconto de 90% nas leituras de cache, reduzindo significativamente o custo de retransmitir conteudo ja processado.

## Por que o cache domina o custo total?

| Categoria | Tokens por chamada | Nota |
|---|---|---|
| Entrada do usuario (tokens novos) | Dezenas a centenas | O que o usuario realmente digita |
| Saida da IA | Centenas a milhares | Resposta da IA |
| **Leitura de cache** | **100K–centenas de K** | Toda a conversa acumulada cobrada em cada chamada |

O volume de leituras de cache por chamada e **milhares de vezes** maior que a entrada. Mesmo com um desconto de 90%, as leituras de cache ainda dominam em termos absolutos de custo.

E essas chamadas nao vem apenas das mensagens do usuario:

| Origem | Frequencia | Leitura de cache por chamada |
|---|---|---|
| Mensagens do usuario | Quando o usuario envia uma mensagem | Toda a conversa acumulada |
| **Decisoes proprias da IA** | **Multiplas chamadas por mensagem do usuario** | Toda a conversa acumulada |

De forma invisivel, a IA realiza multiplas decisoes em sequencia para uma unica mensagem do usuario — decidir qual ferramenta usar, interpretar o resultado da ferramenta, decidir a proxima acao. Cada uma dessas decisoes e uma chamada LLM completa que inclui todo o contexto. A execucao da ferramenta em si (leitura de arquivos, buscas) roda localmente, mas a tomada de decisao antes e depois de cada uso de ferramenta gera custos de leitura de cache.

### Por que o custo de escrita de cache tambem e maior do que o esperado?

Para a Anthropic, os custos de escrita de cache sao 1,25x a entrada (nivel de 5 minutos) ou 2x a entrada (nivel de 1 hora). Com esses multiplicadores, parece que a escrita de cache nao deveria exceder 2x o custo de entrada+saida — mas na pratica, a escrita de cache ocupa uma proporcao muito maior.

Duas razoes:

| Causa | Explicacao |
|---|---|
| **Prompt do sistema** | Dezenas de milhares de tokens antes do usuario digitar qualquer coisa (com plugins/MCP). Tudo isso esta sujeito a custos de escrita de cache |
| **Recriacao apos expiracao** | Apos o TTL expirar (5 min / 1 hora), toda a conversa acumulada precisa ser colocada novamente em cache. Quanto mais longa a conversa, maior o custo de recriacao |

Em outras palavras, a escrita de cache nao ocorre apenas para "novos tokens que o usuario digitou". No inicio da sessao, todo o prompt do sistema e colocado em cache; apos a expiracao, toda a conversa acumulada se torna alvo de escrita de cache. Se o cache de uma conversa de 100K tokens expirar, uma unica mensagem gera uma escrita de cache de 100K tokens de uma so vez.

**E exatamente por isso que o plugin super-token-saver exibe um aviso de expiracao de cache apos 1 hora de inatividade.** Quando o aviso aparecer, verifique o tamanho do seu contexto atual:

- **Contexto pequeno**: O custo de recriacao do cache e gerenciavel. Simplesmente continue trabalhando — o custo e baixo.
- **Contexto grande**: O custo de cache sera significativo. Recomendamos `/clear` seguido de `/s-continue last` para retomar em uma nova sessao. A habilidade continue restaura automaticamente o contexto da sua conversa anterior, entao seu fluxo de trabalho nao e interrompido.

## Estrategias para reduzir os custos de cache

O plugin super-token-saver foi projetado para automatizar ou simplificar todas essas estrategias.

### 1. Manter o contexto pequeno — `/clear` + `/s-continue` ⭐

**Esta e a forma mais importante de reduzir custos.** Custos altos de cache significam que voce esta recebendo o desconto de 90% — isso e normal. Mas se o contexto cresce desnecessariamente e permanece assim, o custo absoluto por chamada aumenta mesmo com o desconto. **Manter o tamanho do contexto sob controle e a estrategia de gerenciamento de custos mais eficaz.**

Quando o assunto muda ou a conversa fica longa, execute `/clear` para reiniciar, e depois `/s-continue last` para restaurar o contexto anterior. `/s-continue` restaura conversas anteriores sem nenhuma chamada LLM, entao o custo e zero.

`/compact` reduz o contexto resumindo a conversa, mas o processo de resumo em si gera custos de chamadas LLM e descarta detalhes da conversa. Nao recomendado.

### 2. Prevenir a expiracao do cache — Token Guardian (Automatico)

O cache da sessao principal da Anthropic usa um **nivel de 1 hora**. Apos a expiracao, a primeira solicitacao precisa recriar toda a conversa como escrita de cache, o que e caro.

super-token-saver detecta estados de inatividade de 1 hora e **exibe automaticamente um aviso**. Quando o aviso aparecer, usar o metodo 1 acima (`/clear` + `/s-continue`) para continuar em uma nova sessao e a abordagem mais economica.

### 3. Delegar trabalho pesado para SubTasks

Tarefas pesadas como geracao de codigo ou edicoes de multiplos arquivos podem ser delegadas para SubTasks em vez de serem executadas diretamente na sessao principal. Os SubTasks usam o nivel de cache de 5 minutos, tornando as **escritas de cache 37,5% mais baratas**, e rodam em um contexto isolado menor, reduzindo o volume de leitura de cache por chamada.

super-token-saver guia automaticamente esse padrao de separacao de trabalho no inicio da sessao.

### 4. Monitoramento de custos em tempo real — `/setup-statusline`

Instale `/setup-statusline` para exibir o status de custo/tokens em tempo real na parte inferior da sua CLI: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Voce pode detectar custos anormalmente altos por chamada ou um contexto crescente imediatamente, permitindo agir antes que os custos disparem.

### 5. Analise de padroes de custo — `/usage-view`

Use `/usage-view` para revisar seu historico completo de uso como um painel interativo. Visualize tendencias de custo diarias/por hora, composicao de tokens por sessao e eficiencia do cache. Identifique de relance quais tarefas causaram picos de custo e quais padroes sao ineficientes.

### 6. Otimizacao do prompt do sistema

Quanto mais plugins, servidores MCP e habilidades carregados no prompt do sistema, maior o custo inicial de escrita de cache. Remova tudo que voce nao estiver usando.

`/setup-git-lite` do super-token-saver reduz as instrucoes Git padrao do Claude Code (~2.200 tokens) para um nucleo de 280 tokens — uma reducao de aproximadamente 88% no prompt do sistema relacionado a Git por sessao.

### 7. Selecao de ferramentas — O impacto no contexto varia por ferramenta

Uma vez que um arquivo e lido, seu conteudo permanece no contexto e se acumula nas leituras de cache de todas as chamadas subsequentes. Ler um unico arquivo completo adiciona milhares a dezenas de milhares de tokens ao contexto, e essa quantidade e cobrada em cada chamada subsequente.

Tarefas de programacao frequentemente envolvem multiplos arquivos simultaneamente — ler apenas 3-4 arquivos completos pode fazer o contexto crescer dramaticamente. Escolher a ferramenta certa faz uma diferenca significativa no crescimento do contexto.

| Ferramenta | Proposito | Impacto no contexto | Quando usar |
|---|---|---|---|
| **Grep** | Buscar codigo por padrao | **Minimo** — retorna apenas linhas correspondentes | Buscar nomes de funcoes, variaveis, strings especificos |
| **Glob** | Buscar arquivos por padrao de nome | **Minimo** — retorna apenas caminhos de arquivos | Buscar localizacoes de arquivos como `*.ts`, `src/**/*.test.js` |
| **LSP** | Definicoes de simbolos, referencias, tipos | **Minimo** — retorna apenas definicoes/assinaturas | Ir para definicao, encontrar referencias, verificar tipos |
| **Read** (offset/limit) | Ler parte especifica de um arquivo | **Moderado** — retorna apenas o intervalo especificado | Quando voce precisa de um intervalo especifico de linhas |
| **Read** (completo) | Ler arquivo inteiro | **Grande** — arquivo inteiro adicionado ao contexto | Apenas quando voce precisa entender a estrutura completa do arquivo |

"Leia este arquivo inteiro" usa dezenas a centenas de vezes mais contexto do que "Encontre esta funcao".

O mesmo principio se aplica para editar e comparar:

| Ferramenta | Proposito | Impacto no contexto |
|---|---|---|
| **Edit** | Modificar arquivo existente | **Minimo** — apenas o diff e adicionado ao contexto |
| **Write** | Criar novo arquivo / reescrita completa | **Grande** — arquivo inteiro adicionado ao contexto |
| **git diff / diff** | Comparar arquivos/pastas | **Minimo** — apenas diferencas retornadas |
| Ler ambos os arquivos separadamente | Comparar arquivos/pastas | **Grande** — ambos os arquivos completos adicionados ao contexto |

super-token-saver injeta automaticamente este guia de selecao de ferramentas na IA no inicio da sessao, incentivando o uso de ferramentas leves primeiro.

## Apendice: Comparacao de cache entre provedores de IA

### Custos de cache

| Provedor | Custo de escrita de cache | Desconto na leitura de cache | Custo de armazenamento de cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Nivel 5 min: 1,25x entrada<br/>Nivel 1 hora: 2x entrada | 90% de desconto | Nenhum |
| **OpenAI**<br/>(Codex) | Sem sobretaxa (igual a entrada) | 90% de desconto | Nenhum |
| **Google Gemini**<br/>(Gemini CLI) | Sem sobretaxa (igual a entrada) | 90% de desconto | Nenhum |

> **Nota**: As taxas de desconto na leitura de cache variam por modelo. Esses numeros refletem os modelos mais recentes de cada provedor.

### Tempo de vida do cache (TTL)

| Provedor | TTL | Garantia |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minutos ou 1 hora | **Explicitamente definido** |
| **OpenAI**<br/>(Codex) | Geralmente removido apos 5-10 min de inatividade; pode persistir ate 1 hora em periodos de baixa demanda | **Nao garantido** — a documentacao oficial usa "geralmente", "ate" |
| **Google Gemini**<br/>(Gemini CLI) | Nao divulgado | **Nao garantido** — caching explicito com TTL garantido esta disponivel via API (pago) |

> **Nota**: Com base em nossos experimentos com Claude Code, sessoes principais geralmente usam o nivel de 1 hora, enquanto SubTasks usam o nivel de 5 minutos.

### Opcoes adicionais de controle de cache via chamadas diretas a API

A comparacao acima e da perspectiva dos usuarios de ferramentas de programacao com IA (Claude Code, Codex, Gemini CLI). Desenvolvedores que chamam as APIs diretamente tem um controle de cache mais detalhado.

**Anthropic**

- `cache_control`: Define pontos de corte para delimitar explicitamente as fronteiras do cache. Determinado automaticamente se nao especificado.
- O nivel de TTL (5 min / 1 hora) pode ser selecionado por solicitacao.

**OpenAI**

- `prompt_cache_key`: Direciona solicitacoes com a mesma chave para o mesmo servidor, melhorando as taxas de acerto do cache. O Codex define internamente isso como `conversation_id` automaticamente.
- `prompt_cache_retention: "24h"`: Retencao estendida do cache. Estende o padrao de 5-10 min para ate 24 horas (sem custo adicional, nao garantido). O Codex nao usa esta opcao.

**Google Gemini**

- Caching explicito (`CachedContent`): Define TTL de 1 minuto a 48 horas para garantir acertos de cache. Taxa de armazenamento se aplica (\$4.50/MTok/hora para Pro). Atualizacoes do conteudo em cache exigem a criacao manual de um novo CachedContent. O Gemini CLI nao usa esse recurso.

> **Nota**: Essas opcoes nao sao expostas nas ferramentas de programacao com IA e nao podem ser controladas diretamente pelos usuarios. Os usuarios de ferramentas de programacao com IA devem consultar a secao "Estrategias para reduzir os custos de cache" no texto principal.

### Fontes

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
