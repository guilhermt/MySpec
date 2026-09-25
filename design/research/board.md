# Board, Home e criação de task

Levantamento da segunda tela da fase 4. Não repete `screens.md` §2.2 e §2.3 nem `journeys.md` §1.2: detalha campo a campo o que eles resumem, acrescenta os DTOs, o volume real e o que `structure.md` decidiu. Fontes: `features §X` = seção de `docs/product/features.md`; arquivos de `frontend/src/` citados pelo caminho a partir de `features/`, `lib/` ou `store/`; Go a partir de `internal/`.

## 1. A visão do board hoje

### 1.1 Como se chega

| Entrada | Efeito | Fonte |
|---|---|---|
| Título do nó do board na barra lateral | `openBoard(id)`; a área principal mostra `BoardView` | `sidebar/SidebarTree.tsx`, `app/AppShell.tsx` |
| Home sem nenhuma task ativa e com board | Renderiza o `BoardView` do primeiro board, por título | `home/Home.tsx`; `features §Tela de boas-vindas` |
| Abrir a visão | Sempre relê o board (`refreshBoard` no mount); a leitura guardada aparece enquanto isso | `board/BoardView.tsx`; `features §Leitura dos cards` |

Não há leitura periódica. Um board também é relido depois do cadastro e depois de uma publicação de discussão (`features §Leitura dos cards`, `§Aprovar e publicar`).

### 1.2 Regiões, de cima para baixo

| Região | Conteúdo exato | Condições | Fonte |
|---|---|---|---|
| Cabeçalho | Título (`h1`, truncado); ícone **Open on GitHub**; `Updated <relativo>` (`just now`, `4 min ago`, `2 h ago`, `3 days ago`, atualizado a cada minuto); spinner `Reading the board` (`role="status"`); **New discussion** (outline, ícone); **Refresh** (ícone) | `Updated` só com `readAt`; **New discussion** desabilitado sem leitura; **Refresh** desabilitado durante a leitura | `board/BoardHeader.tsx`, `lib/boards.ts` `relativeTime` |
| Falha no cabeçalho | Linha `role="alert"` com o ícone de aviso e `failure.message` | Só quando há leitura guardada e a última falhou | `BoardHeader.tsx` |
| Filtros | Busca (`Search`, 14rem); **Repository**; **Status** (com `No status`); **Assignee**; toggle **Assigned to me**; **Clear filters** (ghost) | **Status** só com campo de status; **Assigned to me** desabilitado sem `viewer`; **Clear filters** só com algum filtro ativo | `board/BoardFilterBar.tsx`, `components/FilterMenu.tsx` |
| Seleção | `N cards selected`, **Discuss selected**, **Clear selection** (`role="toolbar"`) | Só com ao menos um card marcado | `board/SelectionBar.tsx` |
| Lista | Seções por status, `role="tree"` | Ocupa 60% num painel redimensionável | `board/CardList.tsx`, `BoardView.tsx` |
| Detalhe | Painel à direita, `aside` | Só com card selecionado; 40%, mínimo 25% | `board/CardDetail.tsx` |

### 1.3 Seções

| Regra | Fonte |
|---|---|
| Uma seção por opção do campo `Status`, na ordem do board, **mesmo vazia** (a lista não pula quando o filtro muda) | `board-view.ts` `sections` |
| `No status` só quando há cards sem status; board sem campo de status: seção única `Cards` | idem |
| Cabeçalho da seção: chevron, nome, contagem já filtrada | `CardList.tsx` |
| Dentro da seção: abertas antes das fechadas, cada grupo na ordem do board | `board-view.ts` `openFirst` |
| Seções de status final começam recolhidas; o que o usuário recolhe ou expande é lembrado por board, em `localStorage`, junto dos filtros. O card selecionado não é lembrado | `board/useBoardViewMemory.ts`, `lib/ui-storage.ts` |
| Issue fechada numa seção não final: opacidade 60% e `Closed` no nome acessível | `CardRow.tsx` |

### 1.4 A linha do card, campo a campo

Uma linha de `h-9` (36 px), da esquerda para a direita (`board/CardRow.tsx`).

| Elemento | Dado | Regra |
|---|---|---|
| Caixa de seleção | `isCheckable`: `repositoryId` de um repositório do board | Desabilitada fora disso; `Select #N`; o clique não abre o detalhe |
| Número | `number` | `#N`, tabular, esmaecido |
| Título | `title` | Truncado; recebe a largura que sobra |
| Épico | `epic.title` | Texto pequeno, até 12rem, truncado; só nos filhos. O próprio card do épico aparece como uma linha comum, sem marca |
| (espaço flexível) | | |
| Task do card | `activeTaskId` → `TaskSummary` | `StatusDot` + `taskStatusLabel` + `Waits for you` em âmbar quando `situations` não é vazio, **seja qual for a gravidade** (um erro também diz `Waits for you`) |
| `Not cloned` | `action === "clone"` e sem task | Texto pequeno |
| Repositório | `repository` | Nome curto, `dono/nome` no `title` |
| Responsáveis | `assignees` | Até 3 avatares de 20 px (o login em texto sem avatar); um quarto some sem `+N` |

Não aparecem na linha: status (a seção diz), campos (`Módulo`, estimativa, datas), PRs vinculadas, dependências (nem as não satisfeitas), irmãos, task arquivada, `In discussion`, clone inexistente, repositório de outro board.

### 1.5 O painel de detalhe, campo a campo

Ordem real do código (`board/CardDetail.tsx`), que difere da ordem de `features §Visão do board` (lá as ações vêm logo depois do cabeçalho; no código vêm por último).

| # | Bloco | Conteúdo | Condição |
|---|---|---|---|
| 1 | Título | `h2` com o título; **Close card** (X) | Sempre |
| 2 | Meta | `#N`, `dono/nome`, badge `Open`/`Closed`, badge do status, ícone **Open on GitHub** | Status só se existe |
| 3 | Campos | Lista `nome → valor`, na ordem que o GitHub devolve | Com campos |
| 4 | `Assignees` | Logins separados por vírgula | Com responsáveis |
| 5 | Corpo | Markdown (Streamdown, mermaid, código), selecionável; `No description.` quando vazio | Sempre |
| 6 | `Epic` | `#N título`, link externo | Com épico. O corpo do épico (`epicBody`) chega e não é mostrado |
| 7 | `Siblings` | `#N título · <status ou Open/Closed>`; irmão no board é botão que seleciona o card; fora do board, link externo | Com irmãos |
| 8 | `Dependencies` | `#N título` (link), `Not satisfied` em âmbar com ícone; linha `Open/Closed · status`; cada PR `dono/nome#N · Open/Merged/Closed` (link) | Com dependências |
| 9 | `Pull requests` | `dono/nome#N · estado`, link | Com PRs vinculadas |
| 10 | `Task` | Botão com o nome da task ativa (abre a task), ou `Archived: <nome>` (abre no histórico) | Com task ativa ou arquivada |
| 11 | Ações | `StartTaskAction` (1.6) | Sempre |

O painel mantém a seleção quando uma leitura nova ainda traz o card (`features §Visão do board`).

### 1.6 Ações: `Start task`, `Discuss` e seleção

`BoardCard.action` é calculado no Go, a primeira regra que vale ganha (`bindings/convert.go` `cardAction`):

| `action` | Quando | Linha | Detalhe | `S` |
|---|---|---|---|---|
| `has_task` | Card com task ativa | Estado da task | Só **Discuss**; a task no bloco `Task` | Nada |
| `closed` | Issue fechada | Esmaecida se a seção não é final | Só **Discuss** | Nada |
| `add_to_board` | Repositório não cadastrado ou sem board | — | **Start task** + **Discuss** (desabilitado, porque o card não é marcável) + `<dono/nome> isn't managed by this board.`; **Start task** abre `Add <dono/nome> to the board` (`Checking the repository…`, linha do repositório, **Cancel**, **Add to board**) | Abre o mesmo diálogo |
| `other_board` | Repositório de outro board | — | **Start task** desabilitado + **Discuss** + `<dono/nome> belongs to the board <título>.` | Nada |
| `clone` | Repositório do board sem clone | `Not cloned` | **Start task** → troca por `<dono/nome> isn't cloned yet.` + **Clone and continue**; durante: `Cloning <dono/nome>…`; falha: mensagem do `gh` em vermelho | Faz o mesmo que o botão |
| `clone_missing` | Clone cadastrado sumiu | — | **Start task** desabilitado + **Discuss** + `The clone at <caminho> is missing.` + **Change path** | Nada |
| `start` | O resto | — | **Start task** (`Kbd S`) + **Discuss** (`Kbd D`) | Abre o diálogo de criação |

- **Clone and continue**: sem pasta de clones, o seletor nativo abre e cancelar cancela; o clone roda em segundo plano, e um hook global (`board/usePendingStart.ts`, montado em `AppShell`) abre o diálogo de criação quando o clone termina, **mesmo que o usuário tenha saído da visão**. Uma falha só solta o card; o erro fica no detalhe (`board/useStartCard.ts`).
- **Discuss** e `D` abrem o diálogo de discussão com o card; **New discussion** no cabeçalho e **Discuss selected** abrem com os marcados. Só cards marcáveis entram.
- A seleção é estado local da visão: some ao sair dela; um card que sai da leitura sai da seleção em silêncio (`BoardView.tsx`).

### 1.7 Teclado

| Tecla | Onde vale | Efeito | Fonte |
|---|---|---|---|
| `↑` `↓` | Lista | Cards visíveis, pulando seções recolhidas; de um cabeçalho de seção vai ao card vizinho | `CardList.tsx` |
| `←` `→` | Lista | Recolhe (e foca o cabeçalho) ou expande a seção do card | idem |
| `Enter` | Lista | Abre o detalhe | idem |
| `Space` | Linha focada (não o checkbox) | Marca ou desmarca, se marcável | idem |
| `S` | Lista | `start`, `clone`, `add_to_board` | idem |
| `D` | Lista | Discussão com a seleção, ou com o card focado se marcável | idem |
| `/` | Visão, fora de campo de texto | Foca a busca | `BoardView.tsx` |
| `Esc` | Visão | Fecha o detalhe | idem |

A lista tem um só ponto de Tab: o último card focado, senão o selecionado, senão o primeiro. Os botões do detalhe mostram `Kbd` S e D; o do cabeçalho não mostra o D.

### 1.8 Leitura, falhas e estados

| Estado | O que aparece | Fonte |
|---|---|---|
| Board ausente do estado | `<main>` vazio, sem mensagem | `BoardView.tsx` |
| Nunca lido, lendo | 8 linhas de esqueleto de 28 px | idem |
| Nunca lido, falhou | Mensagem da falha (`role="alert"`) + **Try again** no lugar da lista | idem |
| Lido, relendo | Lista guardada + spinner no cabeçalho | `BoardHeader.tsx` |
| Lido, última leitura falhou | Lista guardada + linha de falha no cabeçalho; na barra lateral, ícone com a razão no tooltip | `BoardHeader.tsx`, `SidebarTree.tsx` |
| Sem issues | `This board has no issues.` | `BoardView.tsx` |
| Filtros sem resultado | `No cards match the filters.` + **Clear filters** | idem |
| Nenhum card selecionado | Sem painel; a lista ocupa a largura | idem |

Mensagens de falha (`features §Falhas`): `GitHub CLI was not found: gh isn't on the PATH.`, `gh is not authenticated. Run gh auth login.`, `gh can't read projects. Run gh auth refresh -s read:project.`, `The board doesn't exist or this account can't read it.`, `GitHub's rate limit was reached. It resets at <hora>.`, `Couldn't read from GitHub: <o que o gh disse>`. Uma falha nunca é situação nem notifica. `BoardFailure` traz `reason` (`gh_missing`, `gh_unauthenticated`, `missing_scope`, `not_found`, `rate_limited`, `failed`) e `failedAt`, que a visão não mostra.

### 1.9 Card fora da última leitura

| Onde | Comportamento | Fonte |
|---|---|---|
| Card selecionado na visão | O detalhe fecha em silêncio | `BoardView.tsx` |
| Card marcado | Sai da seleção em silêncio | idem |
| Diálogo de criação aberto para ele | Troca o formulário por `This card isn't in the last reading of the board.` e só **Cancel** | `task-create/NewTaskDialog.tsx` |
| Confirmar a criação | O Go recusa com a mesma frase (`board.ErrCardNotFound`) | `bindings/task_service.go` |
| Card de task ativa fora da leitura | Lido diretamente na mesma leitura, para a task continuar atualizada | `features §Leitura dos cards` |

### 1.10 Os dados que chegam

Tudo vem no `State` (`boards[]`), pelo evento `state:changed`; chamadas pontuais em `BoardService` (`internal/bindings/board_service.go`): `RefreshBoard`, `RefreshCard`, `CardContext`, `CheckBoardRepository`, `AddRepositoryToBoard`; e `RepositoryService` para `CloneRepository` e `ChangeRepositoryPath`.

| DTO (`internal/bindings/dto.go`) | Campos | Usado na visão |
|---|---|---|
| `Board` | `id, owner, ownerType, number, title, url, hasStatus, statuses[] (id, name, final), repositoryIds[], readAt, reading, failure (reason, message, failedAt), viewer, cards[], newCardStatus` | Todos menos `owner`, `ownerType`, `number`, `newCardStatus`, `failure.reason`, `failure.failedAt` |
| `BoardCard` | `CardIssue` + `body, statusId, status, final, assignees[] (login, avatarUrl), fields[] (name, value), pullRequests[], epic, epicBody, siblings[], dependencies[], readAt, suggestedName, repositoryId, activeTaskId, archivedTaskId, action, otherBoard` | Todos menos `final` (a visão usa o `final` da seção) e `epicBody` (só vai para o contexto) |
| `CardIssue` | `key, repository, number, title, url, state` | Todos |
| `CardRelated` (irmão) | `CardIssue` + `status, onBoard` | Todos |
| `CardDependency` | `CardRelated` + `pullRequests[], satisfied` | Todos |
| `CardPullRequest` | `repository, number, url, state` (open, merged, closed) | Todos |

Dados de fora do board que a visão usa: `TaskSummary` da task ativa (estado e situações, `useTask`), `ArchivedTask` (nome), `Repository` (`cloning`, `cloneError`, `path`, `boardId`).

### 1.11 O que a leitura não traz e o que o backend sabe e não expõe

| Dado | Situação | Fonte |
|---|---|---|
| Labels, milestone, tipo da issue, datas de criação e atualização da issue, comentários, autor | Não são lidos: a query GraphQL não pede | `internal/board/github.go` (`fragments`) |
| Cor das opções de status e de seleção única | Não é lida | idem (`structureQuery`) |
| Sub-issues do épico além de 50, PRs vinculadas além de 10, dependências nativas além de 20, campos além de 30 | Cortados pela query | idem |
| Discussão ativa que tem o card como entrada (`In discussion`) | Não está no `BoardCard`; é derivável no frontend de `discussions[].cards[]` (a chave `dono/nome#N`) | `DiscussionSummary.cards`, `DiscussionCard.key` |
| Card criado ou atualizado por uma discussão | O Go sabe (`discussion.Service.DocumentOfCard`, usado no contexto da task) e não expõe no card | `internal/discussion/service.go`, `bindings/board_service.go` |
| Corpo do épico | Chega (`epicBody`) e não é mostrado | `CardDetail.tsx` |
| Quando a falha aconteceu | Chega (`failedAt`) e não é mostrado | `BoardHeader.tsx` |
| Quando cada card foi lido | Chega (`readAt`), usado só para decidir a releitura no diálogo | `task-create/CardContextPreview.tsx` |

### 1.12 Divergências entre doc, código e `structure.md`

| Ponto | `features.md` | Código | `structure.md` §4 |
|---|---|---|---|
| **Start task** no cabeçalho do board, com `S` | Não existe | Não existe; `S` age no card focado | Existe, sem dizer o que faz sem card focado |
| `In discussion` no card | Não existe | Não existe, nem no DTO | Existe |
| Clone inexistente na linha | — | Só no detalhe | "o repositório sem clone com **Clone**" na linha |
| Ordem do detalhe | Ações logo depois do cabeçalho | Ações no fim do painel | — |
| `Waits for you` | "quando ela espera pelo usuário" | Qualquer situação, erro incluído, sempre âmbar | "se ela `Waits for you`" |

## 2. O diálogo de criação de task

### 2.1 Entradas

| Entrada | Abre | Fonte |
|---|---|---|
| Botão `+` da barra lateral, `Ctrl+N` (de qualquer lugar, inerte com um diálogo de criação aberto), botão **New task** da Home | Diálogo livre | `sidebar/Sidebar.tsx`, `app/useGlobalShortcuts.ts`, `home/Home.tsx` |
| **Start task** ou `S` num card `start` | Diálogo de card | `board/useStartCard.ts` |
| Fim de um **Clone and continue** | Diálogo de card, sozinho | `board/usePendingStart.ts` |
| **Add to board** confirmado | O card passa a `clone` ou `start`; o diálogo **não** abre sozinho, o usuário aciona **Start task** de novo | `board/AddToBoardDialog.tsx` |

O formulário é montado a cada abertura: abre sempre vazio (`NewTaskDialog.tsx`). Título `New task` nos dois casos; largura `sm:max-w-lg` (32 rem).

### 2.2 Campos

| Campo | Livre | De card | Default | Validação e texto | Fonte |
|---|---|---|---|---|---|
| Topo | **Repository**: menu com `dono/nome` | `CardSummary`: `#N` título, `dono/nome`, badge do status. Sem épico, sem link | Livre: o primeiro **utilizável** entre filtro, repositório da task aberta, último usado nesta execução, primeiro da lista; nenhum → `Choose a repository` | Itens desabilitados com `Not cloned`, `Cloning…` ou `The clone at <caminho> is missing.`; item **Clone** ao lado dos sem clone; erro do clone em vermelho no item e sob o menu | `task-create/RepositoryPicker.tsx`, `CardSummary.tsx`, `lib/repositories.ts` `defaultRepositoryId` |
| **Name** | Vazio | `suggestedName`: `<número>-<slug>`, até 64 | Foco inicial; fonte mono; ajuda `Lowercase letters, digits and hyphens.` | `Use lowercase letters, digits and single hyphens.`, `Use at most 64 characters.` com o link `Use "<sugestão>"`; `A task named <nome> already exists in <dono/nome>.` (tasks ativas e arquivadas do repositório). Vazio só desabilita **Create** | `lib/task-name.ts`, `internal/board/name.go` |
| **Context from the card** | — | Recolhido por padrão, somente leitura, Markdown, até 40% da altura | — | `Refreshing the card…` se a leitura do card tem mais de 5 min; `Couldn't refresh the card: <motivo>. The task will use the last reading.` em âmbar | `task-create/CardContextPreview.tsx`, `lib/boards.ts` `STALE_CARD_MS` |
| Contexto | **Initial context**, 8 linhas, obrigatório, ajuda `What you want to build, in your own words. High level or detailed.` | **Additional context**, 3 linhas, opcional, sem ajuda | Vazio | Livre sem texto: **Create** desabilitado; `Ctrl+Enter` confirma | `NewTaskDialog.tsx` |
| **Unsatisfied dependencies** | — | Caixa com ícone âmbar; cada dependência: `#N título` e `dono/nome · Open/Closed · status · PR dono/nome#N Merged…` | — | Nunca bloqueia | idem |
| **Mode** | Toggle `Structured` / `One-Shot` | Igual | `Structured` sempre | Linha: `A PRD, a tech spec and a plan of steps, each step its own commit.` ou `One planning conversation writes a single document, implemented in one commit.` Não diz no diálogo que o modo nunca muda | `lib/task-modes.ts` |
| **Review mode** | Menu (`ReviewModePicker`, ícone de robô ou pessoa) | Igual | Padrão de **Defaults** | Linha: `You review each step in VS Code before its commit.` ou `An agent reviews each step, and the task runs to the pull request on its own.` | `review-mode/ReviewModePicker.tsx`, `lib/review-modes.ts` |
| **Models** | Recolhível; resumo `Defaults` ou `PRD: Fable 5.1 · xhigh +1` | Igual | Padrões de **Defaults** | Um `ModelPicker` por etapa do modo; escolha fora do catálogo marcada como indisponível | `lib/models.ts`, `models/ModelPicker.tsx` |
| Rodapé | **Cancel** (ghost), **Create** / `Creating…` | Igual | — | **Create** exige repositório, nome sem problema, contexto (só no livre) e nada em curso | `NewTaskDialog.tsx` |

Modo e modo de review usam controles diferentes (toggle e menu) para uma escolha do mesmo tipo.

### 2.3 O contexto montado do card

Markdown com rótulos em inglês, nesta ordem (`internal/board/context.go`; `features §A partir de um card`): o card (título, `dono/nome#N`, link, status, campos, responsáveis, corpo completo); o épico (título, referência, link, corpo completo); os irmãos, um por linha (referência, título, status); as dependências (referência, título, estado, status, PRs com estado); `Discussion`, com o documento da discussão mais recente que criou ou atualizou o card; `Additional context`, com o texto do usuário. Vira a primeira mensagem do PRD ou do planejamento One-Shot.

O frontend pede o texto a `CardContext` ao abrir e de novo depois da releitura, dê ela certo ou não. A releitura (`RefreshCard`) relê card, épico, irmãos e dependências, uma vez por abertura.

### 2.4 Modelos por etapa

| Modo | Etapas listadas, com o rótulo | Fonte |
|---|---|---|
| Structured | `PRD`, `Tech spec`, `Plan`, `Implementation`, `Step review`, `PR`, `PR review` | `lib/models.ts` `STRUCTURED_MODEL_STAGES`, `modelStageLabel` |
| One-Shot | `One-Shot planning`, `Implementation`, `Step review`, `PR`, `PR review` | `ONE_SHOT_MODEL_STAGES` |

As escolhas guardam todas as etapas: um ajuste numa etapa comum aos dois modos sobrevive à troca de modo; o resumo conta só as do modo escolhido. `Step review` aparece mesmo com `Manual` (`features §Modelos e esforço`). Rótulo de escolha: `Opus 5.5 (1M) · high`, ou só o nome para modelo sem esforço.

### 2.5 O que acontece ao confirmar

1. Frontend: `createTask({name, repositoryId, initialContext, mode, models, reviewMode, card})` (`store/actions.ts`); com card, `initialContext` é só o texto do usuário e `repositoryId` é ignorado pelo Go.
2. Go, `TaskService.CreateTask` (`internal/bindings/task_service.go`): resolve modelos, modo de review e modo; com card, busca o card na leitura guardada, exige que o repositório seja do board, monta o contexto com o documento da discussão e copia o card para a task (`task_cards`); verifica o clone; cria a task (nome único no repositório); abre a primeira sessão (`flow.StartTask`). Se a sessão não começa, apaga a task e devolve o erro.
3. Frontend: lembra o repositório, fecha o diálogo e abre a task. O usuário vê a conversa esperando a primeira pergunta (J2, `brief.md` §4).

### 2.6 Erros

Todos aparecem como texto vermelho acima do rodapé, sem `role="alert"`, e o diálogo continua aberto (`NewTaskDialog.tsx`).

| Caso | Mensagem | Fonte |
|---|---|---|
| Nome já usado (corrida com outra criação) | `A task named <nome> already exists in <dono/nome>.` | `task_service.go` |
| Card ganhou task enquanto o diálogo estava aberto | `Card #<N> already has an active task: <nome>.` | idem, `task.CardTakenError` |
| Card fora da leitura | `This card isn't in the last reading of the board.` | idem |
| Repositório saiu do board | A recusa do board (`<dono/nome> isn't managed by this board.`) | `board.Refusal` |
| Clone sumiu | `The clone at <caminho> is missing.` | `repository.Refusal` |
| Contexto vazio, nome inválido, repositório desconhecido | `Describe what you want to build.`, `Use lowercase letters, digits and single hyphens.`, `Choose a registered repository.` | `userMessages` |
| Sessão não começou (`claude` ausente, sem login…) | O erro da sessão, e a task é desfeita | `flow.StartTask` |

## 3. Home

### 3.1 Hoje

| Estado | O que aparece | Fonte |
|---|---|---|
| Sem tasks ativas, com board | A visão do primeiro board, por título (relida ao abrir) | `home/Home.tsx` |
| Sem tasks, sem board | Ícone, `No tasks yet`, `Create the first task in one of your repositories.`, **New task** `Ctrl N` | idem |
| Com tasks, nada aberto | `No task open`, `Pick a task from the list, or create a new one.`, **New task** `Ctrl N` | idem |

"Sem tasks" ignora reviews e discussões ativos: com só um review ativo, a Home mostra o board.

### 3.2 O que `structure.md` decidiu

| Elemento | Regra | Fonte |
|---|---|---|
| Lugar | Home é o lugar sem nada aberto; não lista o que espera pelo usuário (isso é da árvore) | `structure.md` §1 |
| **Continue** | O último item aberto, o que ele pede e onde está, com a posição (`Question · Reviewer · Step 3/7`); recebe o foco, `Enter` abre | §1 |
| Ações de início | Nova task, review de PR, nova discussão | §1 |
| Boards e repositórios | Com o estado da leitura, a falha e o clone | §1, §7 |
| Atalhos | A lista dos globais | §1 |
| Estados | `Nothing in progress` com as ações de início (nenhum item ativo); **Continue** (nada aberto); na primeira leitura, diz o que está sendo lido; mostra a falha de leitura, o clone inexistente e o repositório sem clone | §7 |

O mock `lab/03-structure-final/a.html` (`startView`) dá os textos de partida: `Nothing open` / `Pick an item on the left, or start something. What needs you is marked in the tree.`; `Nothing in progress` / `No task, review or discussion is active. Start one from a card, a pull request or a few cards of a board.`; `Reading GitHub: 2 boards and the pull requests of 5 repositories. What's on the left is from this machine and already current.`; as ações `New task` (`From a card or from scratch`, `Ctrl N`), `Review a pull request` (`4 pending in 3 repositories`, leva a Reviews), `New discussion` (`From cards of a board`, leva a um board); a linha do board `23 open cards · read 2m ago · api, web`, `Read failed 18m ago`, `The clone at <caminho> is missing` com **Change path**; os atalhos `Ctrl J`, `Alt ←`, `Ctrl ,`, `↑↓←→`.

### 3.3 Dados da Home

| Dado | Disponível | Fonte |
|---|---|---|
| Último item aberto | Estado do frontend, persistido entre execuções (decidido, ainda não implementado) | `structure.md` §1, §8 |
| O que ele pede e a posição | Deriváveis de `situations[]` e do resumo do item | `journeys.md` §4 |
| PRs pendentes, repositórios | `reviewCenter.pendingCount`; a contagem por repositório é derivável de `pullRequests[]` | `ReviewCenter` |
| Cards abertos por board, última leitura, falha, leitura em curso | `Board.cards[].state`, `readAt`, `failure`, `reading` | `Board` |
| Clone de cada repositório | `Repository.cloned`, `missing`, `cloning` | `Repository` |
| Que leituras estão em curso no início do app | `Board.reading`, `ReviewCenter.reading` | `State` |

Nada da Home pede backend novo. **New discussion** precisa de um board: a Home não diz qual quando há mais de um.

## 4. Volume real

Do banco em `~/.local/share/myspec/myspec.db` (`docs/architecture/storage.md`), copiado e lido em 2026-09-24: tabela `board_readings`, última leitura de cada board.

| Métrica | Faturamento IA | Pessoal |
|---|---|---|
| Cards na leitura | 120 (402 KB de JSON) | 9 |
| Abertos / fechados | 49 / 71 | 1 / 8 |
| Status | 10: `Backlog` 27, `A Fazer` 9, `Em andamento` 6, `Revisao de codigo` 2, `Ajustes` 0, `Aprovado` 1, `Disponivel em Dev`* 1, `Pronto para release`* 3, `Concluído`* 70, `Pausado` 1 (* final) | 4: `Backlog` 1, `Ready` 0, `In progress` 0, `Done`* 8 |
| Linhas visíveis com as finais recolhidas | 46 | 1 |
| Abertas em status final / fechadas em não final | 3 / 0 | 0 / 0 |
| Título (chars): mediana, p90, máx | 48, 73, 102 | 28, 74, 77 |
| Corpo (chars): mediana, p90, máx; vazios | 1.430, 3.234, 5.049; 18 | 1.262, 2.381, 3.100; 0 |
| Corpo (linhas): mediana, p90, máx | 20, 49, 86 | 12, 24, 29 |
| Corpos com títulos / checklists / código / imagens / tabelas | 49 / 10 / 9 / 5 / 1 | 5 / 0 / 0 / 1 / 0 |
| Repositórios nos cards | 8 (`medflow` 54, `faturamento-core` 30…); 10 cadastrados no board, 2 sem clone | 1 |
| Campos | `Módulo` 109 (8 opções), `Data de inicio` 76, `Estimativa` 74 (`<30min`, `1hr - 3hrs`, `3hrs - 6hrs`, `~ 1 dia`), `Data de fim` 33; até 4 por card | nenhum |
| Responsáveis | 0: 30, 1: 86, 2: 3, 3: 1; 5 pessoas | 0: 3, 1: 6 |
| Épicos | 10 épicos, todos são cards do board (2 abertos); 32 cards com épico (8, 7, 5, 3, 3, 2, 1, 1, 1, 1); título do épico de 25 a 102 chars | 1 épico com 2 cards |
| Irmãos | Até 7 por card; 5 fora do board | Até 1 |
| Dependências | 19 cards, 26 ao todo, máx. 3; 1 não satisfeita | 1 |
| PRs vinculadas | 0: 51, 1: 67, 2: 2 (65 merged, 4 open, 2 closed) | 0: 2, 1: 7 |

Uso da criação (tabela `tasks`, 23 tasks, 1 ativa):

| Métrica | Valor |
|---|---|
| De card / livres | 15 / 8 |
| Structured / One-Shot | 15 / 8 |
| Review mode `Agent` / `Manual` | 21 / 2 |
| Tasks de card com `Additional context` | 1 de 15 |
| Tasks de card com a seção `Discussion` | 8 de 15 |
| Contexto inicial livre (chars) | 35 a 636 |
| Contexto montado de card (chars) | 248 a 8.891; mediana 5.691 |
| Nome da task (chars) | 6 a 61; as de card, 43 a 61 (o sufixo cortado) |
| Discussões / cards de entrada nelas | 11 / 1 |

Leitura: o board de trabalho real tem cerca de 50 cards abertos em 7 status não finais e 70 concluídos; um corpo típico tem uma tela de Markdown com títulos; 1 card em 4 tem épico; dependência e PR aberta são raras. A seleção múltipla para discussão quase não foi usada (1 card em 11 discussões). Não dá para dizer, pelo banco, se o usuário ajusta modelos na criação: os 23 conjuntos de modelos diferem entre si, mas os padrões também mudaram com o tempo.

## 5. Referências do gênero

| Produto | Como mostra o board e o card | O que vale para o MySpec |
|---|---|---|
| GitHub Projects | Três layouts (table, board, roadmap) sobre os mesmos itens; agrupar, fatiar (`slice by`) e ordenar por campo; soma de campo numérico por grupo; o item abre num painel lateral com corpo, campos e sub-issues; a cor da opção vem do board | É a fonte dos dados e o vocabulário do usuário (status, campos, sub-issues, "blocked by"). A cor por opção é decoração escolhida pelo usuário (`references.md`, GitHub, Evitar) |
| Linear | Lista densa de uma linha como padrão, board como alternativa; agrupar e subagrupar por propriedade; `Display options` escolhem quais propriedades aparecem na linha; descrição nunca aparece no card; `Space` espia o item sem abrir ([docs](https://linear.app/docs/display-options), [board](https://linear.app/docs/board-layout)) | Linha de uma linha com propriedades escolhidas, e um "espiar" por teclado que não troca de lugar |
| Height (encerrado em 24/09/2025) | Lista e board sobre a mesma tarefa, com subtarefas aninhadas na lista; painel lateral com a tarefa e a conversa dela; triagem automática por IA ([anúncio](https://alternativeto.net/news/2025/3/height-project-management-tool-to-shut-down-by-september-2025/)) | Hierarquia pai-filho vista na lista, não só no detalhe; o card ao lado da conversa |

## 6. Lacunas e perguntas

### Para o usuário (mudam uma decisão de design)

1. **Épico no board.** Hoje o board agrupa só por status, como o GitHub, e o épico aparece como um texto em cada filho, com o card do épico solto na lista como qualquer outro. A árvore da barra lateral agrupa por épico. Na hora de escolher o próximo card, você pensa por épico (o que falta deste épico) ou por status (o que está pronto para começar)? Decide o agrupamento da lista e se o épico vira grupo.
2. **O que se lê na linha.** No board real, 109 de 120 cards têm `Módulo`, 74 têm `Estimativa` e 76 têm datas, e nenhum desses campos aparece na linha, só no detalhe. Para escolher um card, o que você precisa ver sem abrir: módulo, estimativa, responsável, PR vinculada, dependência não satisfeita? Decide a anatomia da linha.
3. **Seleção múltipla.** Das 11 discussões guardadas, só uma começou com um card; nenhuma com vários. Você seleciona vários cards para discutir? Decide se a caixa de seleção fica em toda linha ou só aparece sob demanda.

### Para o designer (lacunas do que já foi decidido, sem pergunta ao usuário)

- `structure.md` §4 põe **Start task** (`S`) no cabeçalho do board, mas não diz o que ele faz sem card focado ou selecionado; hoje `S` só age no card focado.
- `structure.md` §4 põe `In discussion` no card: não existe no DTO; é derivável de `discussions[].cards[]` para cards de entrada, e o card criado ou atualizado por uma discussão exigiria expor o que `DocumentOfCard` já sabe.
- `structure.md` §3 diz "painéis fechados por padrão, nunca abertos sozinhos"; o detalhe do card no board é um painel que abre por seleção, e a regra não diz se vale para ele.
- `structure.md` §7 deixa o board com até 2.000 issues para a fase 4; o volume real é 120 cards, 46 visíveis com as finais recolhidas.
- A Home de `structure.md` oferece **New discussion**, que precisa de um board; com dois boards, a escolha não está decidida.
- **Add to board** confirmado não reabre o diálogo de criação; o usuário aciona **Start task** de novo.
- Board ausente do estado (removido com a visão aberta) mostra área vazia, como a task (`structure.md` §1 trata só de item).
