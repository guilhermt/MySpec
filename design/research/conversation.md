# A conversa com o agente

Levantamento para a primeira tela da fase 4, a task com a conversa (`design/README.md`, Fases). Levantado em 2026-09-24. Complementa, sem repetir, `brief.md` §6 (o que a conversa é e o que precisa fazer bem), `structure.md` §3 (a conversa, a barra do pedido, o compositor) e `screens.md` §2.4 e §2.10 (componentes e estados da tela da task). Não propõe design.

Fontes: `features §X` = `docs/product/features.md`; `sessions.md` = `docs/architecture/sessions.md`; caminhos de código relativos à raiz do repositório, com a linha. Os números da seção 4 vêm de transcripts reais, descritos lá.

## 0. O que mais pesa para o design

| Achado | Fonte |
|---|---|
| **Bash é 86% a 94% das ações** em step, revisor, PR e reviews. O modo auto do Claude Code injeta um lembrete que manda ler com `cat`/`sed -n`, buscar com `grep` e editar com `sed` e heredoc pelo Bash. O Edit aparece 23 vezes em 4.329 ações de implementador; um quarto dos Bash do implementador escreve arquivo. | seção 4; lembrete `While auto mode is active` nos transcripts |
| **O rótulo de uma ação de Bash é a primeira linha do comando** (`python3 - <<'PY'`, `cd /home/… && …`), cortada em 120 caracteres. O `description` que o agente escreve em 72% dos Bash (`Patch classification CTE`, `Run web tests with coverage`) chega do CLI e é descartado. | `internal/session/labels.go:73-74`, `:13`; seção 2 |
| **As ações de um subagente entram na conversa como se fossem do agente principal**, no mesmo grupo: numa discussão, 1 `Agent` do principal virou 44 ações guardadas, com `SubagentHandback` entre elas. O backend lê `parent_tool_use_id` e nunca o usa. | `internal/claude/protocol.go:119,134`; banco, sessão `30146e97…` |
| **Mensagens do produto são longas e em texto cru**: o relatório entregue ao implementador tem mediana de 5,6 mil caracteres, o prompt de cada passada seguinte do review da PR 2,6 mil, o de commit 1,3 mil. `AppMessage` e `UserMessage` não renderizam Markdown. | seção 4; `AppMessage.tsx:12`, `UserMessage.tsx:10` |
| **A instrução com que a sessão começou não aparece** em tech spec, plano, step, PR e review de PR da task: a entrada do prompt vai vazia e é escondida. Um step começa em `Step N started` e segue direto para as ações. | `internal/session/service.go:405-416`; `Conversation.tsx:38` |
| **O produto guarda de cada ação só rótulo, alvo e status.** A saída, o diff, a duração e a entrada inteira chegam do CLI a cada ação e são descartados. | `internal/session/transcript.go:73-79`; `events.go:252-267` |
| **No planejamento, o usuário responde curto**: `ok` (33 vezes), `sim`, `pode`, `prossiga`, `1`, `a`. A pergunta do agente vem quase sempre como texto no fim da fala ("Posso escrever o PRD?"), não como cartão. | seção 4 |

## 1. As entradas do transcript

### 1.1 Envelope e transporte

| Item | Fato | Fonte |
|---|---|---|
| Entrada | `id`, `seq` (ordem), `turnId` (id da mensagem do usuário que abriu o turno), `kind`, `createdAt` e exatamente um payload | `internal/session/transcript.go:27-41` |
| Tipos | `user`, `assistant`, `action`, `permission`, `question`, `marker`, `error`. Atividade e fila não são tipos de entrada | `transcript.go:15-23` |
| Eventos | `entry` (cria ou troca por id), `text` (texto inteiro atual de uma resposta em streaming), `remove`, `reset` (recarregar) | `internal/session/state.go:157-170`; `frontend/src/store/transcript.ts:60-101` |
| Ritmo do streaming | Texto acumulado e emitido a cada 40 ms | `internal/session/service.go:166` |
| Chave | Uma conversa por `{item, stage}`; o frontend carrega com `GetTranscript(itemId, stage)` | `sessions.md`, Um processo por sessão; `frontend/src/lib/wails.ts:1186` |
| `createdAt` | Só o marcador mostra (hora `HH:MM`) | `Marker.tsx:79-84` |
| Retenção | Conversas de task e de review de PR somem no arquivamento; a de discussão fica, somente leitura | `features §Histórico` |

### 1.2 Cada tipo

| Entrada | Campos que chegam do Go | O que o frontend mostra hoje | Chega e não é mostrado | O CLI emite e o backend descarta |
|---|---|---|---|---|
| **Mensagem do usuário** | `text`, `pending`, `prompt`, `app` | Balão à direita, texto cru com quebras (`UserMessage.tsx:10`) | `createdAt` | `timestamp` de cada evento `user` |
| **Primeira mensagem (prompt)** | `prompt: true`; `text` = contexto inicial (PRD, planejamento One-Shot, discussão), instruções da passada (review de PR do centro), resposta do implementador (revisor, com `app: true`) ou vazio (tech spec, plano, step, PR, review da PR da task) | Com texto: balão ou `AppMessage`. Vazio: nada (`Conversation.tsx:38`). O contexto inicial, em Markdown com o card inteiro, aparece cru | Que o prompt existe, qual tipo e qual arquivo (step, One-Shot) a sessão recebeu | O prompt renderizado, que só o CLI recebe (`service.go:405-416`) |
| **Mensagem do produto** | `text`, `app: true` | Bloco largo `MySpec · sent to the agent` com o texto cru (`AppMessage.tsx:25-26`) | Que tipo de mensagem é (commit, relatório, passada, correção, abertura da PR, aplicar) | — |
| **Fila** | `pending: true`, na lista `pending` | Balão esmaecido, `Queued`, botão `Remove queued message` (`PendingMessage.tsx`) | — | `queue-operation` e `queued_turn_count` do `result` |
| **Resposta do agente** | `messageId`, `blockIndex`, `text`, `complete`, `interrupted`; uma entrada por bloco de texto | Markdown (Streamdown) com cursor em bloco durante o streaming, realce Shiki, mermaid com tela cheia e zoom, cópia de código; `Interrupted` com ícone (`AssistantMessage.tsx`, `Markdown.tsx:229-233`) | `createdAt`; que blocos seguidos são uma só mensagem | Blocos `thinking` e seus deltas (`events.go:147,187,222`); `system/thinking_tokens` (estimativa de tokens de raciocínio); `model` da mensagem |
| **Ação** | `toolUseId`, `tool`, `label`, `target`, `status` (`running`, `done`, `error`, `interrupted`) | Dentro do grupo: ícone de status, rótulo, alvo em mono com o texto inteiro no tooltip (`ActionGroup.tsx:67-81`) | `tool` (o nome cru), `createdAt` (início) | A entrada completa (`command`, `description`, `old_string`/`new_string`, `content`, `prompt` do subagente); o `tool_result` inteiro e o `tool_use_result` estruturado (ver 1.3); o fim da ação; `parent_tool_use_id` |
| **Grupo de ações** | Não existe no Go: o frontend junta ações seguidas do mesmo `turnId` (`group.ts:37`) | Uma linha recolhida: `N actions` com ícone resumo (erro, interrompido, ok); com uma ação rodando, o rótulo e o alvo dela com spinner (`ActionGroup.tsx:52-63`) | — | — |
| **Pergunta estruturada** | `requestId`, `toolUseId`, `questions[]` (`question`, `header`, `options[]` com `label` e `description`, `multiSelect`), `answers` (texto da pergunta → rótulos), `status` (`pending`, `allowed` = respondida, `cancelled`) | Cartão `A question for you`, uma pergunta por bloco com o `header` como selo, opções como rádio ou caixa, `Other…` com campo livre, **Answer** habilitado com tudo respondido. Respondido: só `header: resposta` por linha (`QuestionCard.tsx:95-99`); a pergunta some | — | `preview` das opções (4 em 300) e `annotations` da pergunta (1 em 123): `QuestionOption` guarda só `label` e `description` (`transcript.go:112-115`) |
| **Escalada de permissão** | `requestId`, `toolUseId`, `tool`, `displayName`, `description`, `input` (JSON), `suggestions`, `blockedPath`, `decisionReason` (sem ANSI), `suppressAlwaysAllow`, `defaultToNo`, `status`, `denyMessage`, `answeredAt` | Cartão `Permission needed` com o nome; o comando de um Bash em bloco, o caminho de Write/Edit/Read, ou o JSON inteiro; a razão; `Outside the working directory:`; **Allow**, **Allow for this session** (só com sugestões), **Deny** com mensagem opcional; respondido, o texto da resposta (`PermissionCard.tsx`) | `answeredAt`; o conteúdo das `suggestions` (só decide se o botão aparece) | `title`, `requires_user_interaction` do pedido (`protocol.go:192,199`) |
| **Marcador** | `type` e, por tipo, `preTokens`, `stage`, `step`, `pass`, `clean`, `restarted` | Linha com ícone, texto e hora (tabela 1.4) | `preTokens` do `compacted` | `trigger` da compactação (manual ou automática) |
| **Erro** | `kind` (`process_exit`, `start_failed`, `not_found`, `not_logged_in`, `turn_error`), `message`, `retryable` | Bloco `role="alert"` com o título do tipo e a mensagem; **Retry** se `retryable` e `useTask(itemId).sessionStatus === "error"` (`ErrorCard.tsx:26`) | — | `api_error_status`, `errors` do `result` |
| **Atividade** | Não é entrada: o resumo da sessão traz `turnRunning`, `processRunning`, `retryAttempt`, `contextPercent`, `pendingCount`, `status` (`state.go:123-141`) | Com turno rodando e a última entrada em silêncio (texto completo ou ação que não roda): `Retrying (attempt N)…`, `Starting session…` sem processo, ou `Thinking…` (`ActivityIndicator.tsx:8-14,41`) | `pendingCount` (a fila já está na conversa) | `system/status` (`requesting`, ignorado em `events.go:92`); `retry_delay_ms`, `max_retries` e `error` do `api_retry` (`protocol.go:61-67`); `rate_limit_event` (uso das janelas de 5 h e 7 dias) |

Dois comportamentos que a tabela não mostra:

- **Retry no bloco de erro depende da task.** `findTask` só procura tasks (`frontend/src/store/app-store.ts:250`): num review ou numa discussão o bloco nunca tem **Retry**, e na aba `Reviewer` o botão segue o status da sessão do implementador, não a do revisor. A estrutura já tira a ação do bloco (`structure.md` §3, A conversa).
- **Uma ferramenta que o mapa não conhece aparece com o nome cru como rótulo e sem alvo**: `SubagentHandback`, `ToolSearch`, `TaskOutput`, `Monitor`, `ListAgents` (`labels.go:43-52`).

### 1.3 O que o CLI manda em cada ação e o produto descarta

Visto nos streams gravados em `internal/claude/testdata/*.jsonl` e nos transcripts da seção 4. O backend só lê `tool_use_id` e `is_error` do resultado (`events.go:252-267`).

| Ferramenta | `tool_use_result` estruturado | Tamanho real |
|---|---|---|
| Bash | `stdout`, `stderr`, `interrupted`, `isImage`, `noOutputExpected` | Saída: mediana 24 linhas, p90 251, máx. 1.202 |
| Edit | `filePath`, `oldString`, `newString`, `originalFile`, `replaceAll`, `structuredPatch` (hunks com `oldStart`, `newStart`, linhas `+`/`-`), `userModified` | Raro (seção 2) |
| Read | `type`, `file` com `filePath`, `numLines`, `startLine`, `totalLines` | — |
| AskUserQuestion | `questions` e `answers` | — |
| Qualquer uma | O `tool_result` em texto, que o agente lê | Mediana 1,3 mil a 4,1 mil caracteres por tipo de sessão, p90 10 mil a 20 mil, máx. 385 mil |

E por turno, no `result`: `duration_ms`, `duration_api_ms`, `num_turns`, `permission_denials`, `subagent_stats`, `usage`, `total_cost_usd`. O produto usa só `is_error`, `result` (numa falha), `terminal_reason` e a janela de contexto (`events.go:331-356`). No `system/init`: `tools`, `agents`, `skills`, `mcp_servers`, `slash_commands`, versão; o produto só registra em log (`events.go:78-91`).

Custo de expor a saída: o resultado passa pelo processo a cada ação e hoje só o status é gravado (`transcript_entries.payload`). Guardar a saída é mudar o payload de `ActionEntry` e o banco; o volume é o da coluna acima, até 16 MiB por linha (`sessions.md`, Protocolo). Mostrar o `description` do Bash e a duração é barato: a entrada completa já chega em `handleAssistant` (`events.go:219`) e o fim da ação em `handleUser`.

### 1.4 Marcadores

| `type` | Texto hoje | Ícone | Onde nasce |
|---|---|---|---|
| `stage_started` | `<Etapa> started` / `restarted` | `Play` / `RotateCcw` | Início de cada etapa de planejamento, PR e review da PR (`internal/session/service.go:383`) |
| `step_started` | `Step N started` / `restarted` | idem | Início da sessão do step |
| `step_review_started` | `Review of step N started` | `Bot` | Primeira passada do revisor |
| `step_review_written` | `Review N written · clean` / `changes` | `FileCheck` | Relatório tratado, na conversa do revisor |
| `pr_review_written` | `Review pass N written`, **sem o veredito** (`Marker.tsx:65-66`) | `FileCheck` | Relatório da PR da task e do centro de review |
| `review_started` | `Review started` | `Bot` | Início de um review do centro |
| `discussion_started` | `Discussion started` | `MessagesSquare` | Início de uma discussão |
| `prd_written` … `one_shot_updated` (8) | `PRD written`, `Tech spec updated`, `Plan written`, `One-Shot document written`… | `FileCheck`, `FileText`, `ListChecks` | Documento da etapa escrito ou reescrito |
| `compacted` | `Context compacted` | `Archive` | `system/compact_boundary` (`events.go:97-101`) |
| `interrupted` | `Interrupted` | `Ban` | Interrupção sem texto em curso; com texto, a resposta ganha `Interrupted` |

Nenhum marcador é clicável: o documento escrito não abre dali, o relatório não abre dali (`Marker.tsx:92-105`).

## 2. As ferramentas

Rótulo e alvo vêm de `internal/session/labels.go:22-91`. Uso real: soma de 434 sessões (seção 4).

| Ferramenta | Rótulo | Alvo | Uso real | Resultado que valeria ver | Observação |
|---|---|---|---|---|---|
| Bash | `Running` | 1ª linha do comando, 120 caracteres | 10.182 (86–94% por tipo) | Saída, código de saída, duração; o `description` como rótulo | 15% dos comandos têm várias linhas; comando mediano 143 caracteres, p90 1.301. No implementador: 29% leitura (`cat`, `sed -n`), 26% escrita (heredoc, `sed -i`, `python3 -`), 20% busca, 9% build e teste, 7% git |
| Read | `Reading` | Caminho relativo à sessão, ou com `~` | 563 | Faixa lida (`startLine`, `numLines`) | — |
| Write | `Writing` | Caminho | 399 | O arquivo criado | É como o agente escreve PRD, tech spec, steps e relatórios |
| Edit, MultiEdit, NotebookEdit | `Editing` | Caminho | 77 | O diff (`structuredPatch`) | Diff por Edit cobre pouco do que muda: a maior parte das edições é Bash |
| Grep | `Searching` | Padrão | 0 | Lista de arquivos | O modo auto troca por `grep` no Bash |
| Glob | `Finding files` | Padrão | 0 | Lista | idem |
| Agent, Task | `Delegating` | `description` | 73 (56 num review de PR) | O relatório final do subagente; `subagent_type` | As ações internas do subagente entram soltas no grupo (seção 0) |
| AskUserQuestion | — | — | 111 | — | Não vira ação: vira a entrada `question` (`events.go:175,207,279`) |
| TodoWrite, TaskCreate/Update/List/Get | `Planning` | vazio | 0 | A lista de tarefas | O conteúdo da lista é descartado |
| WebFetch | `Fetching` | URL | 10 | — | — |
| WebSearch | `Searching the web` | Consulta | 3 | — | — |
| Skill | `Using skill` | Nome | 1 | — | — |
| `mcp__<server>__<tool>` | `Calling` | `<server> · <tool>` | 3 | — | — |
| Outras (`ToolSearch`, `TaskOutput`, `Monitor`, `ListAgents`, `SubagentHandback`) | O nome cru | vazio | 27 | — | — |

Agrupamento: ações seguidas do mesmo turno formam um grupo; qualquer texto, pergunta, permissão, marcador ou mensagem quebra o grupo; blocos de raciocínio não quebram (`group.ts`; `events.go:187`).

## 3. O que muda por tipo de sessão

Chaves e diretórios em `sessions.md`, Um processo por sessão. "Visível" é o que a conversa mostra no topo.

| Sessão | Abre com (visível) | O produto envia no meio | Fecha quando | Onde o usuário decide, e por qual canal |
|---|---|---|---|---|
| **PRD** (`prd`) | `PRD started`; o contexto inicial como balão | — | `PRD.md` escrito e sessão ociosa: `PRD written`, a etapa seguinte abre noutra conversa (`features §Etapas de planejamento`) | Texto no compositor, uma pergunta por vez; cartão quando o agente usa `AskUserQuestion` (opcional nesses prompts: `prd.md:19`); **Continue** na revisita, fora da conversa |
| **Tech spec** (`tech_spec`) | `Tech spec started` | — | `tech-spec.md` escrito e ociosa | Texto e cartão; alternativas com trade-offs em texto (`tech_spec.md:23`) |
| **Plano** (`plan`) | `Plan started` | Até 3 correções `The step files in … do not form a valid plan yet` (`internal/flow/correction.go:21-37`) | Plano válido e ocioso; depois de 3, os problemas ficam acima do compositor | Texto; **Discard and restart** na trilha |
| **Planejamento One-Shot** (`one_shot`) | `Planning started`; o contexto inicial | — | `one-shot.md` escrito e ocioso | Texto e cartão |
| **Implementador** (`step:<n>`) | `Step N started`; o arquivo do step fica escondido | `Agent`: o relatório com mudanças inteiro (`The agent review of this step found changes…`, `internal/flow/step_review.go:71-74`); o prompt de commit (`# Commit…`). `Manual`: o prompt de commit depois de **Approve** | Commit na branch: o produto fecha a sessão e a do revisor e abre o próximo step (`features §Aprovação e commit`) | Cartão de pergunta, exigido pelo prompt (`sessions.md`, Protocolo); fora da conversa: **Approve**, **Review myself**, **Discard step**, stage no VS Code |
| **Revisor** (`step_review:<n>`) | `Review of step N started`; a última resposta do implementador como mensagem do produto | A cada passada seguinte, `The implementer is done with your last report…` com a resposta dele (`step_review.go:79-83`); `Review N written · clean/changes` a cada relatório | Step commitado; depois de **Review myself** a conversa segue viva, mas o produto não age mais | Cartão de pergunta (raro: 3 em 123 sessões); texto livre |
| **PR** (`pr`) | `PR started` | `The user approved the draft at … Open the pull request now…` (`internal/flow/pr.go:1200-1203`) | PR aberta: a conversa visível passa a ser a do review (`pr.go:158-171`) | Rascunho editável com **Approve draft** e **Discard draft**, fora da conversa; cartão para a base |
| **Review da PR da task** (`pr_review`) | `PR review started` (prompt escondido) | O prompt inteiro de review a cada passada seguinte, como mensagem do produto (`pr.go:1235-1250`); o prompt de commit com push | Task encerrada e arquivada: a conversa é apagada | **Apontamentos em texto na conversa, item a item** (`pr_review.md:42`); stage no VS Code e **Approve** fora; **Review again**, **Close task** fora |
| **Review do centro** (`review`) | `Review started`; as instruções da passada, se houver | A mensagem da passada seguinte (`internal/reviewflow/again.go:390`); os aprovados no modo `Apply` (`apply.go:60`); o prompt de commit | Merge ou fechamento da PR: apagada, sem aviso | Cartões de apontamento com **Approve**/**Discard** no painel; **Publish review** ou **Apply** fora; texto para pedir mudança no relatório |
| **Discussão** (`discussion`) | `Discussion started`; o contexto inicial (board e cards inteiros) | — | Arquivada (guardada, somente leitura) ou apagada | Texto e cartão (`discussion.md:41`); turno sem pergunta antes dos rascunhos espera o usuário (`reply`); cartões de rascunho no painel |

Onde uma sessão pede e onde responde, resumido:

| Canal | Sessões |
|---|---|
| Cartão de pergunta (`AskUserQuestion`) | Exigido em implementador, revisor, PR e review de PR; opcional no planejamento e na discussão |
| Texto no compositor como resposta esperada | Planejamento (uma pergunta por vez), discussão, apontamentos da PR da task |
| Botão fora da conversa | Aprovar step, tomar o review, aprovar o rascunho, aprovar mudanças do review, publicar, aplicar, encerrar, continuar etapa revisitada |
| Cartão fora da conversa | Apontamentos do centro de review, rascunhos da discussão |

## 4. Volume e forma

**Fonte.** O Claude Code grava cada sessão em `~/.claude/projects/<cwd>/<session-id>.jsonl`, e o MySpec escolhe o id. Foram lidos 434 transcripts identificados pelo cabeçalho do prompt de abertura (`# PRD Creator`, `# Step Review`, `# Step N:`…), de 16 a 24 de setembro, de dois repositórios reais; implementadores só das pastas de worktree do MySpec. Complementa com as 13 conversas guardadas em `~/.local/share/myspec/myspec.db` (11 discussões, 2 reviews; tasks arquivadas não guardam conversa). Os números abaixo são do CLI e contam cada bloco; o MySpec mostra o mesmo, menos o raciocínio. Scripts em `/tmp/convstudy/`, fora do repositório.

| Sessão | n | Ações: med · p90 · máx | Falas do agente: med · p90 | Caracteres por fala: med · p90 · máx | Mensagens do usuário/produto depois da 1ª: med · p90 | Duração de relógio (min): med · p90 |
|---|---|---|---|---|---|---|
| PRD | 32 | 7 · 16 · 36 | 4,5 · 8 | 274 · 1.718 · 4.064 | 3 · 5 | 9 · 111 |
| Tech spec | 25 | 37 · 88 · 101 | 6 · 15 | 161 · 1.921 · 4.762 | 1 · 5 | 39 · 151 |
| Plano | 24 | 7,5 · 20 · 23 | 2 · 5 | 493 · 2.555 · 3.122 | 1 · 2 | 8 · 31 |
| Planejamento One-Shot | 12 | 14,5 · 24 · 27 | 4,5 · 8 | 598 · 1.402 · 2.875 | 3 · 5 | 7 · 103 |
| Implementador | 112 | 33,5 · 69 · 114 | 9 · 16 | 64 · 1.668 · 4.320 | 2 · 3 | 12 · 26 |
| Revisor | 123 | 24 · 58 · 88 | 3 · 6 | 84 · 200 · 1.422 | 1 · 2 | 5 · 14 |
| PR | 29 | 7 · 13 · 25 | 3 · 7 | 66 · 193 · 1.336 | 2 · 5 | 7 · 545 |
| Review da PR da task | 48 | 15,5 · 58 · 83 | 4 · 20 | 127 · 1.147 · 4.205 | 1,5 · 9 | 5 · 86 |
| Review do centro | 17 | 24 · 42 · 62 | 7 · 17 | 134 · 519 · 3.722 | 2 · 6 | 8 · 331 |
| Discussão | 12 | 10 · 17 · 29 | 7 · 8 | 472 · 1.275 · 1.808 | 5,5 · 7 | 19 · 89 |

A duração de relógio inclui as esperas pelo usuário; o p90 alto de PR e reviews é a espera pelo merge ou pelos checks.

**Como isso vira a conversa no MySpec** (grupos = sequências de ações entre duas falas):

| Sessão | Grupos: med · p90 | Maior grupo: med · p90 · máx | Blocos visíveis (falas, grupos, perguntas, mensagens): med · p90 | Entradas brutas: med · p90 |
|---|---|---|---|---|
| Tech spec | 5 · 11 | 16 · 33 · 52 | 15 · 38 | 50 · 102 |
| Implementador | 8 · 16 | 8 · 18 · 38 | 20 · 35 | 44 · 89 |
| Revisor | 3 · 5 | 10 · 45 · 61 | 7 · 13 | 30 · 64 |
| Review da PR da task | 4 · 17 | 6 · 16 · 44 | 9 · 41 | 26 · 79 |
| Discussão | 4 · 5 | 5,5 · 8 · 24 | 16,5 · 20 | 23 · 42 |
| PRD, plano, PR | 2 a 3 · 3 a 4 | 3 a 5 · 5 a 11 | 6 a 11 · 10 a 18 | 10 a 14 · 26 a 31 |

**A forma de um step típico no modo `Agent`**, do implementador: `Step N started`; 8 grupos de ações intercalados com 9 falas curtas (mediana de 64 caracteres, "Now let me check X."); uma fala final de resumo (p90 de 1,7 mil caracteres); em 43% dos steps, um relatório do revisor entregue como mensagem do produto (mediana de 5,6 mil caracteres, máx. 9,6 mil) seguido de mais grupos e da resposta item a item; por fim, o prompt de commit (1,3 mil caracteres) e um grupo curto com o `git commit`. Do revisor: 1,45 passada por step revisado, cada uma um grupo grande de leitura silenciosa (até 61 ações) e uma fala curta.

**Onde fica longa:** tech spec (p90 de 102 entradas, grupos de até 52 ações de exploração), implementador com rodadas de review (p90 de 89 entradas) e review da PR com várias passadas (p90 de 79, com um prompt de 2,6 mil caracteres por passada).

| Medida | Valor |
|---|---|
| Mensagens do produto por tipo | Relatório ao implementador med. 5.603 (máx. 9.558); prompt de passada seguinte do review da PR 2.605 (máx. 5.650); passada seguinte do centro 4.538 (máx. 11.791); commit 1.324 a 1.475; passada ao revisor 1.087 (máx. 4.416); abrir a PR 269 caracteres |
| Mensagens do usuário | Mediana de 2 a 8 caracteres no planejamento, 18 a 38 no resto; a mais comum é `ok` |
| Perguntas estruturadas | 111 chamadas: 92% com uma pergunta, 6 com duas, 3 com três; opções: 72 com duas, 48 com três, 3 com quatro; `multiSelect` uma vez; pergunta med. 143 caracteres (máx. 1.626); `header` med. 9 (máx. 16); descrição da opção med. 132 (máx. 490); 15% respondidas por `Other…` |
| Permissões | Nenhuma entrada `permission` nas 13 conversas do banco: o modo auto resolve quase tudo |
| Duração de uma ação | Mediana 1,1 s, p90 7,5 s, p99 74 s (builds e testes), máx. 10 min |
| Ações com erro | 1,6% no implementador |
| Subagentes | Só em review de PR (5 de 48 sessões), PRD, tech spec, review do centro e discussão; nunca em step |

## 5. Como as referências mostram a mesma coisa

`research/references.md` §2 já cobre Claude Code desktop (três modos de densidade), Warp (blocos com metadados), Zed (resumo de edições, `Context Compacted` expansível), Cursor, Codex, Devin e Conductor. Aqui só o que é da conversa.

| Produto | Ações e saída | Diff | Pergunta e permissão | Vale para o MySpec | Fonte |
|---|---|---|---|---|---|
| Claude Code, terminal | Uma linha por ferramenta com o alvo; a saída do Bash truncada em poucas linhas com contagem do resto; `Ctrl+O` abre a transcrição completa; subagente como um item com o total de ações; `Ctrl+T` mostra a lista de tarefas | Diff do Edit inline, colorido | Pergunta com opções numeradas e resposta livre; permissão com três respostas numeradas | É o que o agente do MySpec vê; o MySpec mostra menos do que ele (sem saída, sem diff, sem subagente agrupado, sem lista de tarefas) | https://code.claude.com/docs/en/interactive-mode |
| Codex app | Resumos agregados de edições e comandos; usuários pedem os caminhos editados e os comandos visíveis sem clique, com a saída e o diff recolhidos | Diff grande empurra a conversa para cima no terminal; pedido de resumo compacto com expansão | — | A tensão exata do grupo recolhido: o nome do que mudou à vista, o conteúdo sob demanda | https://github.com/openai/codex/issues/19891 ; https://github.com/openai/codex/issues/41604 |
| Cursor | Cartão do agente com arquivos tocados e prévia do diff | Painel de review ao lado do chat | Fila e interrupção na próxima ferramenta | Arquivos tocados como resumo de um trecho | `references.md` §2, Cursor |
| Devin | Linha do tempo em que clicar num passo mostra o shell, as edições e o navegador daquele passo | Por passo | — | Marco clicável que abre o que aconteceu | `references.md` §2, Orquestradores |
| Conductor | Chat igual ao do Claude Code no centro; à direita, mudanças ao vivo em diff e um terminal | Diff viewer com comentários por linha que voltam ao chat para o agente corrigir | — | O diff vive ao lado da conversa, não dentro dela; comentário no diff vira mensagem | https://docs.conductor.build/core/diff-viewer ; https://www.conductor.build/blog/diff-tools |

## 6. Lacunas

Fatos que os docs e o código não respondem e que não viram pergunta porque a resposta não muda uma decisão desta tela:

- O `system/status` só traz `requesting` nos streams gravados; se o CLI manda um estado de compactação em curso, o produto hoje mostraria `Thinking…` durante ela.
- Não há registro de quanto uma escalada de permissão acontece fora das 13 conversas do banco; os transcripts do CLI não guardam o `control_request`.
- A proporção de Bash depende do lembrete do modo auto, que muda entre versões do Claude Code (o texto já variou nos transcripts); o produto não o controla.

## 7. Perguntas para o usuário

1. **Quando você abre um grupo de ações hoje, o que procura?** Conferir o comando, ver um erro, saber que arquivos mudaram, ou nada disso (você não abre). Decide se a conversa investe em mostrar a saída e as mudanças de cada ação, o que pede guardar o resultado no backend, ou se basta um rótulo melhor (o `description` do Bash) e o grupo continua só uma lista.
2. **As mensagens longas do produto (o relatório de 5 mil caracteres entregue ao implementador, o prompt de 2,6 mil de cada passada do review da PR, o de commit) você quer ler inteiras na conversa, ou basta saber que foram enviadas, com o relatório a um clique?** Decide se a mensagem do produto é um bloco de leitura ou um marco recolhido.
