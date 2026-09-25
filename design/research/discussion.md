# A discussão e os rascunhos

Levantamento para a quarta tela da fase 4, a discussão com os rascunhos de cards (`design/README.md`, Fases). Levantado em 2026-09-24. Não propõe design. Complementa, sem repetir: `brief.md` §3 e §4 J7; `structure.md` §3 (barra do pedido, coluna de decisão, painéis); `screens/task.md` (conversa, barra do pedido, compositor, cartão de decisão); a decisão do review em `decisions.md` (2026-09-24) e `lab/12-screen-review/README.md` (`screens/review.md` ainda não existe); `screens/board.md` §2.3 e §3.6 (início da discussão); `research/screens.md` §2.7; `research/journeys.md` §1.8; `research/conversation.md` §3 e §4; `research/board.md` §4.

Fontes: `features §X` = seção de `docs/product/features.md`; código com caminho relativo à raiz (`features/…` = `frontend/src/features/…`); `banco` = `~/.local/share/myspec/myspec.db` e `~/.local/share/myspec/discussions/`, lidos em 2026-09-24 às 22h.

## 0. O que mais pesa para o design

| Achado | Fonte |
|---|---|
| **Aprovar um rascunho solto publica na hora**, sem confirmação. A decisão só se desfaz enquanto nada foi escrito no GitHub, e a corrida começa na mesma avaliação: na prática, **Approve** num card solto é irreversível. Só o épico tem um segundo gesto (**Publish epic**). | `internal/discussionflow/decide.go:10-17` (`Decide` → `Check`); `publish.go:32-57`; `features §Aprovar e publicar` |
| **28 rascunhos, 28 aprovados, 0 descartados.** O que o usuário muda, muda pela conversa: 5 das 11 discussões tiveram os rascunhos reescritos pelo agente a pedido (`titulo curto`, `junte em um unico card`, uma dependência errada); só 5 campos foram editados à mão no cartão, todos títulos encurtados, mais um corpo. | banco, `discussion_drafts`, `transcript_entries` |
| **Uma discussão pode render várias rodadas de rascunhos.** A discussão ativa tem 10 rascunhos publicados em 5 pares, de 15:11 a 16:02, com o usuário pedindo cada par novo na conversa depois de publicar o anterior (`Eu posso continuar aqui nesse contexto para criar outros?`). O produto suporta: um rascunho publicado nunca muda, e os novos voltam a `Decide drafts`. | banco, discussão `ce6cb96e`; `internal/discussion/reconcile.go:15-37` |
| **A conversa não registra nada do que acontece fora dela.** O único marcador de uma discussão é `Discussion started`: nem o documento escrito, nem os rascunhos lidos, nem as decisões, nem a publicação entram na conversa. O agente não sabe o que foi publicado; o prompt diz que o usuário lhe dirá. | banco (1 marcador por discussão); `internal/prompts/defaults/discussion.md`, After writing |
| **Depois da publicação, a discussão fica parada sem dizer o que vem.** Estado `Drafts published`, sem situação; o arquivamento é manual. Na primeira discussão o usuário perguntou ao agente `published. what now:` e `at this point, should not the UI show me the cards created?`. Nas outras, arquivou 1 a 2 minutos depois da última publicação. | `internal/attention/derive_discussion.go` (published não espera); banco |
| **O cartão tem cinco a sete campos editáveis sempre abertos** (repositório, módulo, épico, título, corpo, dependências, decisão), e o corpo tem mediana de 2,35 mil caracteres. O painel de rascunhos fica acima da conversa, com até 50% da altura. | `features/discussion/DraftCard.tsx`; `DraftsPanel.tsx:88`; banco |

## 1. A tela de ponta a ponta

### 1.1 Iniciar

| De onde | Gesto | O que vem no diálogo | Fonte |
|---|---|---|---|
| Visão do board, sem card | **New discussion** no cabeçalho, `N` (decidido) | Board fixo, sem cards | `screens/board.md` §3.6 |
| Card aberto no painel | **Discuss**, `D` na linha com o foco | O card; título sugerido com o título dele | `screens/board.md` §3.6; `new-discussion.ts` `suggestedTitle` |
| Seleção de cards | Modo de seleção (`Space`, **Select cards to discuss**), **Discuss N cards** `D` | Os cards marcados; título vazio | `screens/board.md` §3.6 |
| Home | **New discussion** · `About the demand of one board` | Com mais de um board, o campo **Board** primeiro, com o da última discussão como `last used`; com um só, fixo | `screens/board.md` §2.3 (decidido, ainda não implementado: hoje o diálogo exige `boardId`, `NewDiscussionDialog.tsx:45`) |

**O diálogo** (`NewDiscussionDialog.tsx`; `features §Criar uma discussão`), de cima para baixo:

| Campo | Regra | Texto |
|---|---|---|
| Board | Bloco com título e `owner · #N` | — |
| **Title** | Obrigatório, até 120, contador a partir de 100 | `Use at most 120 characters.` |
| **What to discuss** | Opcional; `Ctrl+Enter` confirma dali | — |
| **Cards** | Cada um `#N título · repo`, removível | — |
| **Context** | Recolhível, somente leitura, Markdown, refeito 300 ms depois de digitar | `Refreshing the cards…`; `Couldn't refresh the cards: <motivo>. The discussion will use the last reading.` |
| **Model** | Padrão de discussão | — |
| **Repositories without a clone** | Cada um com **Clone** / `Cloning…` / **Change path** | `The conversation reads the code of the cloned repositories.` |
| **Start discussion** | Precisa de título e de texto ou card | `Write what to discuss or select at least one card.`; `Starting…` |

Ao confirmar: o produto monta `context.md`, cria a discussão e abre a sessão; se a sessão não começa, a discussão é desfeita e o erro fica no diálogo (`features §Criar uma discussão`; `internal/discussionflow/start.go`). A discussão abre na área principal (`openDiscussion`).

### 1.2 A conversa até o entendimento fechar

- Sessão `discussion`, uma só, na pasta de artefatos, com cada clone do board como diretório de leitura; o agente nunca edita, commita ou faz push (`features §A conversa`; `docs/architecture/sessions.md`).
- O prompt manda: começar direto pela primeira pergunta; perguntar uma lacuna por vez; nunca propor solução técnica; ao fim, dizer em poucas linhas o que entendeu e **quais cards pretende escrever, e pedir confirmação antes de escrever** (`internal/prompts/defaults/discussion.md`, Phase 1).
- Perguntas: em texto no fim da fala, ou em cartão (`AskUserQuestion`), opcional. Antes de existirem rascunhos, um turno que termina sem cartão espera o usuário (`reply`, `Waiting for reply`) (`derive_discussion.go`, `StatusDiscussing`).
- **Depois** que um artefato legível foi lido (`draftsRead`), um turno sem pergunta **não** gera situação (`derive_discussion.go`: `state.Discussion.DraftsRead` corta o `reply`).

### 1.3 O documento

Ver seção 3.

### 1.4 Os rascunhos, cartão a cartão

O agente escreve `drafts.md` num formato fixo (`internal/prompts/prompts.go:183`, `draftsFormatNote`): `status: drafts|none`, blocos `## Draft: <id>` com `Kind`, `Repository`/`Card`, `Module`, `Epic`, `Depends on`, `### Title`, `### Body`. O id é um slug do agente (`medflow-remover-turno`), estável entre reescritas. O produto lê ao fim de cada turno, com a sessão ociosa, e valida contra a última leitura do board (`evaluate.go` `readDrafts`; `internal/discussion/validate.go`). Um arquivo ilegível vira `Waiting for the drafts` com a razão na barra (`unreadableDrafts`).

**Campos por tipo** (`DraftCard.tsx`; `features §Rascunhos de cards`):

| Campo | Card novo (`New card`) | Atualização (`Update`) | Épico (`Epic`) |
|---|---|---|---|
| Selo do tipo | `New card` | `Update` e o link `owner/name#N ↗` do card | `Epic` |
| **Repository** | Seletor entre os do board | Texto fixo (o do card) | Seletor |
| **Module** | Seletor com `No module`, só se o board tem o campo | Idem, com `Current: <valor>` quando difere | — |
| **Epic** | Seletor: `No epic`, os épicos da discussão, **Existing issue…** (campo `owner/name#N`) | Idem, com `Current:` | — |
| **Title** | Campo | Campo, com `Current: <título>` quando difere | Campo |
| **Body** | Área de texto (4 linhas, cresce até 18 rem) | Abas **Edit** e **Changes** (diff linha a linha, `+`/`-`, verde e vermelho) | Área de texto |
| **Dependencies** | Lista (`Linked`, `Dropped: discarded`, `Couldn't record: <gh>`), `×` para remover, campo `Draft id or owner/name#N` e **Add** | Idem, mais as que o card já tem no GitHub, esmaecidas, `On GitHub` | — |
| Avisos | `<repo> is no longer managed by the board.`; os `warnings` | Mais `This card isn't in the last reading of the board.`, `Refreshing the card…`, `Couldn't refresh the card: <motivo>. The draft shows the last reading.` (releitura quando a leitura tem mais de 5 min) | — |
| Decisão | **Approve** / **Discard** (toggle; clicar de novo desfaz) | Idem | Idem |
| Depois de publicado | Somente leitura; `Created owner/name#N` com link; `Published <data>` | `Updated …`; **Edit**/**Changes** seguem, somente leitura | `Created …` no rodapé do grupo |

Os textos são salvos enquanto se digita e sobrevivem ao fechamento; título e corpo nunca ficam vazios (`useDraftText.ts`, `ErrEmptyText`). O id do rascunho não aparece em lugar nenhum do cartão, embora o campo de dependência peça `Draft id` (`DraftCard.tsx`, `DependencyList.tsx`).

### 1.5 Épico e agrupamento

- O agente propõe épicos (`Kind: epic`, com dois ou mais cards). O usuário cria um com **Group into an epic** sobre dois ou mais soltos marcados por caixa (só não publicados), e move cards pelo seletor **Epic** (`DraftsPanel.tsx`; `features §Épico`).
- O épico do usuário nasce vazio: id `user-epic-<n>`, sem título e sem corpo, com o repositório comum dos cards, no fim da lista (`internal/discussion/service.go:419-460`). Até ter título, o produto o nomeia pelo id (`state.go` `titleOf`).
- No painel, o épico é um grupo com borda: o cartão do épico, os cards recuados, e o rodapé com **Publish epic** e a razão quando desabilitado: `An epic needs at least two cards.`, `Approve or discard every card of the epic.`, `Approve the epic.`, `Waits for <título>` (`EpicGroup.tsx`; `state.go:28-33`). Um card de épico descartado diz `The epic is discarded.`
- Um card com **Existing issue…** é solto: publica sozinho e vira sub-issue daquele épico.

### 1.6 Decisão e publicação

| O quê | Quando publica | Ordem | Fonte |
|---|---|---|---|
| Card solto aprovado | Na hora, se nada de que depende está pendente | Uma corrida por vez; cada rascunho depois do épico dele e das dependências, empate pela posição; ciclo quebrado pela posição | `publish.go:36-57`, `:199-247` |
| Card solto que depende de rascunho não publicado | Assim que a dependência sai; o cartão diz `Waits for <título>` em âmbar | idem | `state.go` `waits` |
| Dependência de rascunho descartado | Removida, com aviso `The dependency on <x> was discarded and dropped.` | — | `publish.go:612` |
| Épico | **Publish epic**: issue pai, depois cada card aprovado como sub-issue, status de cards novos, módulo, dependências | idem | `decide.go` `PublishEpic` |

**Estado por cartão**, no canto superior direito (`DraftCard.tsx:163-199`):

| Estado | Texto |
|---|---|
| Na corrida | spinner e `Publishing…` |
| Esperando dependência | `Waits for <título>` (âmbar) |
| Card de épico descartado | `The epic is discarded.` |
| Publicado | `Created`/`Updated` + `owner/name#N` com link |
| Falhou | a razão em vermelho e **Retry**; ao lado de `Created` quando a issue existe e um passo seguinte falhou |

- Durante uma corrida (até 3 min), **toda** edição e decisão da discussão é recusada (`ErrPublishing`, `wait for the publication to finish`) (`decide.go:82-101`; `publish.go:19`).
- **Retry** de um card de épico repete a corrida inteira do épico, sem criar nada duas vezes (`decide.go:160-193`). As razões de falha são as dez de `features §Aprovar e publicar`, mais três que bloqueiam antes de escrever (`The board hasn't been read yet.`, `The card this update rewrites is not one of the board.`, `<repo> is no longer managed by the board.`).
- Avisos que não falham: módulo fora das opções (`The module <x> is no longer an option of the board.`), dependência recusada pelo GitHub (`publish.go:546`, `:658`).
- Depois de uma corrida, o produto relê o board (`features §Aprovar e publicar`).

### 1.7 Reescrita pelo agente

Quando o usuário pede na conversa, o agente reescreve `drafts.md`; o produto reconcilia (`reconcile.go:15-37`):

| Rascunho | O que acontece |
|---|---|
| Mesmo id, igual | Mantém edições e decisão |
| Mesmo id, mudou | **Substituído: perde edições e decisão**, `revision` sobe |
| Id novo | Entra sem decisão |
| Some do arquivo | Sai, menos o publicado e o épico do usuário; quem apontava ganha `The epic <x> is no longer among the drafts.` / `The dependency <x> is no longer among the drafts.` |
| Publicado (ou com publicação iniciada) | Nunca muda |

Cada leitura nova sobe `draftsRevision`, e o painel de rascunhos reabre sozinho (`DraftsPanel.tsx:37-41`).

### 1.8 Arquivamento e apagamento

| Ação | Onde hoje | Impede | Confirmação | Fonte |
|---|---|---|---|---|
| **Archive** | Ícone no cabeçalho, desabilitado com a razão no tooltip | `Approved drafts are waiting to be published.`; `A publication failed.` | `Archive "<título>"?` · `The conversation ends. The document, the drafts and what was published stay in the history.` | `ArchiveDiscussionDialog.tsx`; `state.go` `canArchive` |
| **Delete discussion** | Ícone no cabeçalho, sempre | Nada | `Delete "<título>"?` · `The conversation, the document and the drafts go away. What was published on GitHub stays.` | `DeleteDiscussionDialog.tsx` |

Rascunhos sem decisão arquivam como `Not published`. Arquivar com a tela aberta deixa a área principal vazia (`DiscussionView.tsx:55`, `discussion === null`). No histórico: documento, rascunhos com `Created`/`Updated`/`Not published` e link, épicos com os cards, e a conversa inteira somente leitura (`ArchivedDiscussionView.tsx`; `features §Histórico de uma discussão`).

### 1.9 Estados e situações

Estado derivado em `internal/discussionflow/state.go:147-172`; situação em `internal/attention/derive_discussion.go`. A conversa vem primeiro: trabalhando, pausada, com erro, pergunta ou permissão prevalecem.

| `status` | Rótulo | Quando | Situação | Notificação |
|---|---|---|---|---|
| `discussing` | `Discussing` | Agente trabalhando; ou sem artefato legível; ou todos descartados | `reply` só antes do primeiro artefato, com o turno ocioso | `The agent is waiting for your reply in the discussion.` |
| `awaiting_drafts` | `Waiting for the drafts` | Artefato ilegível | `reply` | `The agent wrote drafts the app can't read in the discussion.` |
| `deciding` | `Decide drafts` | Algum rascunho sem decisão, **ou aprovado e ainda não publicado** | `drafts` | `There are drafts to decide in the discussion.` |
| `publishing` | `Publishing` | Corrida em curso | nenhuma | — |
| `publish_failed` | `Publish failed` | Algum rascunho com erro | `publish_failed` | `The drafts couldn't be published.` |
| `published` | `Drafts published` | Todos publicados ou descartados, ao menos um publicado | nenhuma | — |

Consequência: com tudo decidido e um épico só esperando **Publish epic** (ou um card esperando outro), a situação continua `Decide drafts` e o progresso diz `M of M decided` (`discussion-status.ts` `decidedCount` conta o aprovado como decidido).

### 1.10 O que a conversa mostra

| Entrada | Na discussão | Fonte |
|---|---|---|
| `Discussion started` | Único marcador | banco; `conversation.md` §1.4 |
| Contexto inicial | Primeira mensagem do usuário, Markdown cru (461 a 6.046 caracteres no banco) | `conversation.md` §1.2 |
| Falas do agente | Mediana 472 caracteres, p90 1,3 mil; a fala final resume o entendimento e os cards pretendidos | `conversation.md` §4; prompt |
| Ações | Leitura dos clones; 3 a 47 por discussão; subagentes em algumas | banco |
| Pergunta estruturada | Em 4 de 11 discussões (9 cartões, 6 numa só) | banco |
| Permissão, erro | Nenhuma no banco | banco |
| Mensagem do produto | Nunca: a discussão não envia nada ao agente | `conversation.md` §3 |
| Documento escrito, rascunhos lidos, decisões, publicações | **Não aparecem** | banco; `Marker.tsx` |
| Retry de sessão | Nunca no bloco de erro de uma discussão (`findTask` só acha tasks) | `conversation.md` §1.2 |

### 1.11 Onde o usuário decide, e por qual canal

| Decisão | Canal hoje |
|---|---|
| Responder o agente, confirmar o entendimento | Compositor (texto) ou cartão de pergunta |
| Pedir rascunho novo, mudado ou retirado; encurtar títulos; juntar cards; corrigir dependência | Compositor → o agente reescreve o artefato |
| Editar campos | Cartão, no painel de rascunhos |
| Aprovar/descartar | Cartão (toggle) |
| Agrupar em épico | Caixas + **Group into an epic** no topo do painel |
| Publicar épico | **Publish epic** no rodapé do grupo |
| Tentar de novo | **Retry** no cartão em que a corrida parou |
| Arquivar, apagar, pausar | Cabeçalho |

### 1.12 A tela hoje

`DiscussionView.tsx`: cabeçalho (`MessagesSquare`, `Discussion`, título, board, estado, medidor, **Pause**/**Resume**, **Documents**, **Archive**, **Delete discussion**) › `DiscussionBar` (estado, razão do artefato ilegível, `Publishing…`) › à esquerda, `DraftsPanel` recolhível acima da conversa e do compositor (60%, mínimo 40%); à direita, `DocumentsPanel` redimensionável (40%, recolhível) que **começa aberto** (`defaultSize="40%"`), contra `structure.md` §3 (painéis fechados, nunca abertos sozinhos). Na árvore: sob o nó do board, depois das tasks, `Discussion`, título e `discussionRowLabel` (situação ou estado) (`SidebarTree.tsx:83-110`).

### 1.13 DTOs e chamadas

`internal/bindings/dto.go:1124-1310`; chamadas em `frontend/src/lib/wails.ts:1277-1304`.

| DTO | Campos |
|---|---|
| `DiscussionSummary` | `id, boardId, board, title, text, status` (6), `cards[]`, `drafts[]`, `draftsRead, draftsRevision, unreadableDrafts`, `hasDocument, documentRevision`, `moduleField, moduleOptions[]`, `repositories[]` (`id, fullName, cloned, missing`), `canArchive, archiveHint`, bloco de sessão (`sessionStage, sessionStatus, sessionModel, sessionEffort, turnRunning, processRunning, retryAttempt, contextPercent, pendingCount, lastError`), `situations[]`, `createdAt` |
| `Draft` | `id, position, kind, source, repository, repositoryId, card` (`DiscussionCard`), `title, body, module, epic` (`DraftRef`), `dependencies[]` (`DraftDependency`: ref + `linked, dropped, detail`), `current` (`DraftCurrent`: `title, body, module, status, epic, dependencies[], readAt`), `decision, revision, warnings[]`, `outcome, number, url, published, publishedAt, publishing, publishError`, `waits, canPublish, hint` |
| `DraftRef` | `draft` (id) ou `key, reference`, `title, url` |
| `ArchivedDiscussion` | `id, boardId, board, title, cards[], drafts[], publishedCount, repositoryIds[], createdAt, archivedAt` |
| Chamadas | `StartDiscussion`, `DiscussionContext`, `SetDraftText`, `SetDraftRepository`, `SetDraftModule`, `SetDraftEpic`, `AddDraftDependency`, `RemoveDraftDependency`, `DecideDraft`, `GroupIntoEpic`, `PublishEpic`, `RetryPublish`, `ArchiveDiscussion`, `DeleteDiscussion`, `ReadDiscussionArtifact(id, "context.md"|"discussion.md")`, `RefreshCard` |

Não chegam: a hora de cada decisão e de cada leitura de rascunhos; a hora em que o documento foi escrito (só `documentRevision`); `DraftCurrent.status` chega e não é mostrado; `text` chega e não é mostrado na tela ativa.

### 1.14 O que já está decidido e a discussão reaproveita

| Peça | Decidido em | Nota para a discussão |
|---|---|---|
| Shell, breadcrumb `board › item`, `←` `→` | `structure.md` §1; `screens/task.md` §3 | Discussão fica sob o board, fora dos épicos |
| Linha da árvore: `Discussing`, `Decide drafts · 3/6` | `structure.md` §2 | O progresso deriva de `drafts` |
| Conversa, marcos de uma linha, grupo de ações | `screens/task.md` §6 | Os marcos de decisão (`You decided…`) pedem tipo novo de marcador (§15) |
| Barra do pedido e variantes | `screens/task.md` §7; `structure.md` §3 | Linhas `drafts` (**Next to decide**) e `publish_failed` (**Show** leva ao cartão); **Publish epic** e **Retry** ficam no cartão, como exceções |
| Cartão de decisão na conversa, `A`/`D` que avançam, `Alt+↓` | `decisions.md` 2026-09-24 (review A); `screens/task.md` §9 | O rascunho é mais pesado que um apontamento: 5 a 7 campos e corpo de 2,35 mil caracteres |
| Publicação em diálogo mínimo | `decisions.md` 2026-09-24 (review B) | Hoje a discussão não tem passo de publicação para cards soltos |
| Edição atrás de **Edit** / `E` | `lab/12-screen-review/README.md` (apontamento) | — |
| Painéis fechados; `Documents` com `Context` e o documento | `structure.md` §3 | Hoje o painel começa aberto |
| Página do item que saiu | `structure.md` §1 | Discussão arquivada com a tela aberta |
| Coluna de decisão | `structure.md` §3 | "Onde os cartões moram" ainda é da fase 4 |

## 2. Volume real

Banco: 11 discussões de 21 a 24 de setembro, 10 arquivadas e 1 ativa; 2 boards (`Pessoal`, `Faturamento IA`).

| Medida | Valor |
|---|---|
| Discussões com card de entrada | 1 de 11 (1 card); 10 começaram só com texto |
| `What to discuss` (caracteres) | 62 a 5.001; mediana 607 |
| Rascunhos por discussão | 1, 1, 1, 1, 1, 1, 1, 3, 3, 4, 10; mediana 1 |
| Tipos | 23 `new`, 1 `update`, 3 `epic`; 0 épicos do usuário |
| Épicos | 3, com 3, 2 e 2 cards; todos propostos pelo agente |
| Repositórios por discussão | 1 a 3 (a de 4 rascunhos cobre 3 repositórios) |
| Dependências | 4, todas entre cards do mesmo épico, todas `Linked`; nenhuma para card existente; nenhuma descartada ou recusada |
| Módulo | Preenchido nos 20 cards de `Faturamento IA`; vazio nos 4 de `Pessoal` |
| Decisões | 28 aprovados, 0 descartados, 0 sem decisão |
| Publicados | 28 de 28 (`Created` 27, `Updated` 1); nenhum erro nem aviso guardado |
| Editados à mão | 4 títulos (todos encurtados, em 2 discussões) e 1 corpo; nenhum repositório, módulo, épico ou dependência |
| Reescritos pelo agente a pedido | 5 discussões com `draftsRevision` 2 (títulos mais curtos em 3, juntar dois cards em 1, dependência errada em 1); a ativa chegou a 5, uma por rodada nova |
| Título do card (caracteres) | 23 a 93; mediana 68 (épicos 41 a 73) |
| Corpo do card (caracteres) | 1.340 a 3.599; mediana 2.350 (épicos 1.262 a 1.878). Seções `Contexto`, `Problema`, `O que a entrega inclui`, `O que fica de fora` |
| Mensagens do usuário depois da primeira | 1 a 13; mediana 5; a maioria curta (`ok`, `sim`, `3`) |
| Da criação à primeira publicação | 3 a 204 min; mediana 23 |
| Da última publicação ao arquivamento | 0 a 2 min em 9 de 10; 87 min em 1 |
| Rodadas numa discussão | 1 em 10; 5 na ativa (pares publicados a 15:11, 15:21, 15:44, 15:47, 16:02) |

## 3. O documento da discussão

| Pergunta | Fato | Fonte |
|---|---|---|
| O que é | O entendimento, em Markdown, com `## Context`, `## Problem`, `## Constraints`, `## In scope`, `## Out of scope`. Não propõe solução | prompt, Phase 2; `features §O documento` |
| Quando é escrito | Junto com os rascunhos, depois da confirmação do usuário; reescrito a pedido, a qualquer momento | prompt |
| Como o produto sabe | Pela data e pelo tamanho do arquivo, a cada avaliação (`documentStamp`), que sobe `documentRevision` | `evaluate.go:40-66` |
| Como aparece hoje | Aba **Document** do painel `Documents`, que troca sozinha de `Context` para `Document` quando ele existe; nenhum marcador na conversa | `DocumentsPanel.tsx:26-33` |
| Tamanho | 1.717 a 6.008 caracteres; mediana 3,6 mil. Todos os 11 têm as cinco seções; a ativa acrescenta uma seção por variável | banco (`discussion.md`) |
| Onde é usado depois | Seção `Discussion` do contexto de uma task criada de um card que a discussão criou ou atualizou (8 de 15 tasks de card); histórico | `features §Contexto da task`; `research/board.md` §4 |
| Sobreposição | Em 6 das 11 discussões há um único card, cujo corpo repete o documento com outra ordem de seções (Contexto, Problema, entrega, fora) | banco |

## 4. Referências: de conversa a itens publicados

| Produto | Como mostra | O que vale para o MySpec | Fonte |
|---|---|---|---|
| GitHub Copilot (criar issues) | Rascunhos de issue dentro do chat; árvore pai e sub-issues com expandir e recolher; ajuste por prompt de acompanhamento ("add or remove sub-issues"); **Review and create** cria todas de uma vez; o menu **Parent:** mostra a hierarquia | É o mesmo destino (GitHub, sub-issues). Rascunhos na conversa, refinados conversando, e **um** gesto de criação para o lote | [changelog de sub-issues](https://github.blog/changelog/2025-08-27-create-sub-issues-with-copilot-in-public-preview/); [docs](https://docs.github.com/en/copilot/how-tos/copilot-on-github/copilot-for-github-tasks/use-copilot-to-create-or-update-issues) |
| Jira / Confluence (Rovo) | A IA varre a página e lista itens sugeridos com resumo e descrição; editar, acrescentar, remover cada um; **Create All** (até 10) | Lista revisável com criação em lote; o documento como origem dos itens | [Atlassian Community](https://community.atlassian.com/forums/Confluence-articles/Turn-Confluence-pages-into-trackable-work-in-Jira-with-the-help/ba-p/2894261) |
| Linear | Triage Intelligence sugere time, projeto, responsável, labels e duplicados sobre a issue já criada; o usuário aceita cada sugestão; issues de uma conversa do Slack com o contexto dela | Sugestão como propriedade aceitável, não como formulário aberto; a origem (conversa) fica ligada ao item | [linear.app/ai](https://linear.app/ai); [changelog](https://linear.app/changelog/2025-08-14-product-intelligence-technology-preview) |
| Notion AI (Meeting Notes) | Resumo e lista de ações ao fim da reunião; converter ação em tarefa numa base, com dono e data, ligada à nota | O documento e os itens como duas saídas da mesma conversa, com rastreio de volta | [Notion Help](https://www.notion.com/help/ai-meeting-notes); [agente](https://www.notion.com/custom-agent-templates/meetings-to-tasks) |
| GitHub issue forms | Formulário YAML com campos tipados e obrigatórios, renderizado no corpo com um título por campo | Campos fixos e poucos; o resto do texto em Markdown | [docs](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) |

Em comum: nenhum publica ao aprovar um item isolado; todos revisam a lista e criam num gesto só. O MySpec publica card a card.

## 5. Lacunas

### Para o designer, sem pergunta ao usuário

- O campo de dependência pede `Draft id`, e o id nunca aparece na tela (`DependencyList.tsx`). Com 4 dependências, todas escritas pelo agente, não houve uso manual.
- `Decide drafts` e `M of M decided` enquanto um épico só espera **Publish epic** (seção 1.9).
- Nada na conversa marca o documento escrito, os rascunhos lidos, as decisões e as publicações. Tipos novos de marcador, como os de `screens/task.md` §15, são backend pequeno.
- O painel `Documents` começa aberto (seção 1.12), contra `structure.md` §3.
- Depois de `Drafts published` a tela não diz o que vem (arquivar, pedir mais cards); a discussão não espera ninguém.
- O épico do usuário nasce sem título e sem corpo, nomeado pelo id até ser preenchido.
- Uma edição ou decisão durante a corrida é recusada com erro; a tela não se trava antes.
- A discussão arquivada com a tela aberta deixa a área vazia (`structure.md` §1 já pede a página do item que saiu).
- O bloco de erro de sessão nunca tem **Retry** na discussão (`conversation.md` §1.2); a barra do pedido de `task.md` §7 resolve.
- Dois componentes de rascunho: o cartão ativo e a linha do arquivado (`brief.md` §10).
- `In discussion` no card do board e o card criado por uma discussão: dados em `research/board.md` §6.

### Perguntas para o usuário

1. **Aprovar um card solto publica na hora.** Você prefere que continue assim, ou decidir todos e publicar num gesto, como no review (`decisions.md`: publicação em diálogo) e nas referências? Decide se a discussão ganha um passo de publicação (barra com **Publish N cards**, diálogo) ou se **Approve** continua sendo o gesto final, e muda uma feature (`features §Aprovar e publicar`).
2. **O que você lê antes de aprovar um rascunho:** o corpo inteiro (mediana de 2,35 mil caracteres), só o título e o começo, ou nada porque já leu o resumo do agente na conversa? Com 28 de 28 aprovados e as mudanças pedidas pela conversa, decide se o cartão mostra o corpo aberto e editável ou fechado, com edição atrás de **Edit**.
3. **O documento da discussão: você o lê na hora?** Nas discussões de um card só, ele repete o corpo do card. Decide se o documento é um marco na conversa que abre no lugar, um painel, ou só o que vai para o histórico e para o contexto da task.
4. **Continuar na mesma discussão para uma rodada nova de cards** (como na discussão `idade 6 meses`, 5 rodadas) é o jeito que você quer trabalhar, ou foi uma exceção? Decide se os rascunhos publicados recolhem numa linha por rodada e a tela separa as rodadas, ou se uma discussão é tratada como um lote só.
