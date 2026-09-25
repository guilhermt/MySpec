# Inventário da interface atual

Levantamento da interface como ela é: estrutura, visões, estados, indicadores e primitivos. Fonte de comportamento: `docs/product/features.md` (citado como `features.md §Seção`). Fonte do que está na tela: `frontend/src/` (caminhos abaixo são relativos a essa pasta). Não há proposta nem julgamento de design aqui.

## 1. Arquitetura de informação

### 1.1 Camadas de topo (`app/App.tsx`)

| Condição | O que ocupa a janela | Arquivo |
|---|---|---|
| Estado ainda não carregado (`app === null`) | Tela vazia com `bg-background`, sem indicador | `app/App.tsx` |
| Migração recusada | **MySpec couldn't be updated**, no lugar de tudo | `features/migration/MigrationRefused.tsx`, `migration-text.ts` |
| Nenhum board e nenhum repositório | Tela de boas-vindas | `features/welcome/WelcomeScreen.tsx` |
| Caso contrário | `AppShell` + aviso momentâneo de arquivamento | `app/AppShell.tsx`, `features/notice/ArchivedNotice.tsx` |
| Sempre, sobre tudo | Faixa fixa no topo, centrada (máx. 43rem), com `ErrorNotice` ("Something went wrong") e `LeftoversNotice` ("Some files stayed on disk") | `app/App.tsx`, `features/notice/Notice.tsx`, `LeftoversNotice.tsx` |

### 1.2 Shell (`app/AppShell.tsx`)

Grade de duas colunas: barra lateral de largura fixa `--sidebar-width: 21.5rem` (`styles/tokens.css`) e área principal `minmax(0,1fr)`. A barra lateral não é redimensionável nem recolhível (não há controle para isso no código). Os três diálogos globais vivem no shell: `NewTaskDialog`, `StartReviewDialog`, `NewDiscussionDialog`.

**Barra lateral** (`features/sidebar/Sidebar.tsx`), de cima para baixo:

| Região | Conteúdo | Arquivo |
|---|---|---|
| Waiting for you | Some quando vazia (anima a altura). Título + contagem; até 5 linhas de 48px antes de rolar; cada linha: ponto de tom, nome do item, tempo de espera compacto (`now`, `5m`, `2h`, `3d`, relido a cada 60s), e abaixo `situationDetail` (rótulo + lugar) | `features/attention/WaitingSection.tsx`, `lib/situations.ts` |
| Nó Reviews | Chevron + botão **Reviews** (abre a visão) + contagem de pendentes; dentro, os reviews ativos (até 5 antes de rolar): ponto, `nome#N`, estado à direita, título abaixo | `features/sidebar/ReviewsNode.tsx` |
| Barra de filtro (h-11) | `RepositoryFilter` (All repositories / um por repositório, com marca de clone ausente) + botão `+` (New task, tooltip `Ctrl N`) | `features/sidebar/RepositoryFilter.tsx`, `Sidebar.tsx` |
| Clones ausentes | Aviso por repositório com **Change path** | `features/sidebar/MissingClones.tsx` |
| Árvore (rola) | Nó por board (título abre a visão do board; ícone `TriangleAlert` em âmbar com a falha no tooltip), nós de épico (só recolhem), linhas de task, linhas de discussão, grupo **No board** | `features/sidebar/SidebarTree.tsx`, `sidebar-tree.ts`, `task-list.ts` |
| Rodapé (h-11) | **History** com contagem (badge), Settings (ícone, tooltip `Ctrl ,`), `ThemeToggle` (System/Light/Dark) | `features/history/HistoryButton.tsx`, `features/settings/SettingsButton.tsx`, `features/theme/ThemeToggle.tsx` |

Linha de task (48px): ponto de tom, nome, rótulo de status à direita (`taskStatusLabel`), e abaixo `#<card> <nome curto>` (`SidebarTree.tsx`). Linha de discussão: ponto, título, rótulo à direita, `Discussion` abaixo. Linha selecionada: `bg-accent`.

**Área principal**: uma visão por vez, escolhida por prioridade em `MainArea` (`app/AppShell.tsx`): task aberta › review › discussão › task arquivada › review arquivado › discussão arquivada › settings › history › Reviews › board › Home. Não há pilha de navegação nem "voltar" global: cada `open*` do store zera os outros (`store/app-store.ts`, `openTask`, `openBoard`, `openReviews`, `openHistory`, `openSettings`). Fechar Settings leva a Home, não ao item anterior (`closeSettings` só zera `settingsOpen`).

### 1.3 Visões

| Visão | Entra por | Componente raiz |
|---|---|---|
| Welcome | Sem board e sem repositório | `features/welcome/WelcomeScreen.tsx` |
| Migration refused | Banco antigo com casos que impedem migrar | `features/migration/MigrationRefused.tsx` |
| Home | Nada aberto | `features/home/Home.tsx` (sem tasks e com board: renderiza o primeiro `BoardView`) |
| Board | Nó do board | `features/board/BoardView.tsx` |
| Task | Linha da task, Waiting for you, notificação, `Ctrl+J`, painel do card | `features/task/TaskView.tsx` |
| Reviews (centro de review) | Botão **Reviews** | `features/reviews/ReviewsView.tsx` |
| Review | Linha sob Reviews, **Open review**, Waiting for you | `features/reviews/ReviewView.tsx` |
| Discussion | Linha na árvore, Waiting for you | `features/discussion/DiscussionView.tsx` |
| History | Botão **History** | `features/history/HistoryPanel.tsx` |
| Task / review / discussão arquivados | Linha do History; painel do card (task arquivada) | `features/history/ArchivedTaskView.tsx`, `features/reviews/ArchivedReviewView.tsx`, `features/discussion/ArchivedDiscussionView.tsx` |
| Settings (Defaults, Boards, Repositories, 9 prompts) | Ícone do rodapé, `Ctrl+,` | `features/settings/SettingsView.tsx` |

### 1.4 Diálogos

| Diálogo | Aberto de | Arquivo |
|---|---|---|
| New task (livre ou de card) | `+`, `Ctrl+N`, Home, **Start task** / `S` | `features/task-create/NewTaskDialog.tsx`, `RepositoryPicker.tsx`, `CardSummary.tsx`, `CardContextPreview.tsx` |
| Start review | **Review** na linha da PR | `features/reviews/StartReviewDialog.tsx` |
| New discussion | **New discussion**, **Discuss**, `D` | `features/discussion/NewDiscussionDialog.tsx`, `DiscussionContextPreview.tsx` |
| Add board / Edit board (em etapas) | Welcome, página Boards | `features/boards/BoardDialog.tsx`, `RepositoryLinkRow.tsx` |
| Add repository | Welcome, página Repositories | `features/repositories/AddRepositoryDialog.tsx` |
| Add to board | **Start task** em card de repo fora do board | `features/board/AddToBoardDialog.tsx` |
| Publish review, Review again | Barra do review | `features/reviews/PublishDialog.tsx`, `ReviewAgainDialog.tsx` |
| Confirmações (alert-dialog) | Delete task / review / discussion, Archive discussion, Discard step, Back/Discard de etapa, Remove board / repository, Discard prompt changes, Restore prompt | `task/DeleteTaskDialog.tsx`, `reviews/DeleteReviewDialog.tsx`, `discussion/DeleteDiscussionDialog.tsx`, `discussion/ArchiveDiscussionDialog.tsx`, `task/DiscardStepDialog.tsx`, `task/StageActionDialog.tsx`, `boards/RemoveBoardDialog.tsx`, `repositories/RemoveRepositoryDialog.tsx`, `settings/DiscardChangesDialog.tsx`, `settings/PromptPane.tsx` |
| Popovers | **Models** e modo de review no cabeçalho da task | `task/TaskModels.tsx`, `task/TaskReviewMode.tsx` |

### 1.5 Navegação

| Meio | Efeito | Fonte |
|---|---|---|
| `Ctrl/Cmd+N` | Abre New task | `app/useGlobalShortcuts.ts` |
| `Ctrl/Cmd+J` | Abre o primeiro item de `waitingEntries` (mais urgente), no lugar da situação (aba do step incluída) | `useGlobalShortcuts.ts`, `store/app-store.ts` `openPlace` |
| `Ctrl/Cmd+,` | Abre/fecha Settings | `useGlobalShortcuts.ts` |
| Bloqueio | Os três não agem em Welcome/Migration nem com New task, Start review ou New discussion abertos | `useGlobalShortcuts.ts` |
| Árvore da sidebar | Setas percorrem tasks e discussões visíveis, pulando nós recolhidos | `features/sidebar/useTaskListKeyboard.ts` |
| Waiting for you | Setas, Home, End entre linhas | `WaitingSection.tsx` |
| Board | `↑↓`, `←→`, `Enter`, `Esc`, `/`, `S`, `Space`, `D` | `features/board/CardList.tsx`, `BoardView.tsx`; `features.md §Atalhos` |
| Notificação do sistema | Clique traz a janela e abre o lugar da situação | `features.md §Depende de mim`; `internal/app/notifications.go` |
| Flash | Situação nova com a janela em foco: a linha/aba/contador pisca 1600ms, na cor do tom | `styles/globals.css` `.attention-flash`; `lib/situations.ts` `FLASH_MS` |
| Links cruzados | Painel do card abre a task (ou a arquivada); linha da PR abre review ou task; irmão no board seleciona o card; cabeçalho da task abre a issue | `board/CardDetail.tsx`, `reviews/PullRequestRow.tsx`, `task/TaskCardBadge.tsx` |

## 2. Visões: conteúdo, composição e estados

### 2.1 Welcome e Migration

| | Welcome | Migration refused |
|---|---|---|
| Mostra | Logo `AppMark`, `MySpec` (2.125rem), `Register a board or a repository to start creating tasks.`, **Add board** (primário) e **Add repository** (outline) | Casos agrupados por tipo (`Tasks at the root of a workspace`, `Repositories without an origin on GitHub`, `Tasks with the same name in the same repository`), com as tasks e o que fazer na versão anterior |
| Estados | Um só; ao cadastrar, a tela troca pelo shell | Um só; sem ação no app |
| Arquivos | `welcome/WelcomeScreen.tsx` | `migration/MigrationRefused.tsx`, `migration-text.ts` |

### 2.2 Home (`home/Home.tsx`)

| Estado | Aparência |
|---|---|
| Sem tasks, com board | Renderiza a visão do primeiro board |
| Sem tasks, sem board | Ícone `ListTodo`, `No tasks yet`, `Create the first task in one of your repositories.`, botão **New task** com `Ctrl N` |
| Com tasks, nada aberto | `No task open`, `Pick a task from the list, or create a new one.`, mesmo botão |

Home não mostra resumo, fila nem atividade: só o estado vazio.

### 2.3 Board (`features/board/`)

| Região | Conteúdo | Arquivo |
|---|---|---|
| Cabeçalho | Título, link GitHub, `Updated <relativo>`, spinner `Reading the board`, **Refresh**, **New discussion**, falha | `BoardHeader.tsx` |
| Filtros | Busca, **Repository**, **Status** (com `No status`), **Assignee**, toggle **Assigned to me**, **Clear filters** | `BoardFilterBar.tsx`, `components/FilterMenu.tsx` |
| Seleção | `N cards selected`, **Discuss selected**, **Clear selection** | `SelectionBar.tsx` |
| Lista | Seções por status, recolhíveis, contagem; final recolhido | `CardList.tsx`, `board-view.ts` |
| Linha | Checkbox, número, título, épico, task do card com etapa e `Waits for you` (âmbar), `Not cloned`, nome curto, avatares; fechada esmaecida | `CardRow.tsx` |
| Detalhe (painel redimensionável 60/40) | Título, número, repo, estado, status, link; **Start task** / **Discuss** com `Kbd` S e D; task (ativa ou `Archived: <nome>`); campos; responsáveis; corpo Markdown (`No description.`); Epic; Siblings; Dependencies com `Not satisfied`; Pull requests | `CardDetail.tsx`, `StartTaskAction.tsx` |

| Estado | Aparência | Fonte |
|---|---|---|
| Board não encontrado no estado | `<main>` vazio | `BoardView.tsx` l.47 |
| Nunca lido, lendo | Esqueleto de linhas `h-7` | `BoardView.tsx` l.147 |
| Nunca lido, falhou | Mensagem da falha + **Try again** | `BoardView.tsx` l.130 |
| Lido, relendo | Lista guardada + spinner no cabeçalho | `BoardHeader.tsx` |
| Leitura falhou com leitura guardada | Lista guardada + falha no cabeçalho (`TriangleAlert`) | `BoardHeader.tsx` |
| Sem issues | `This board has no issues.` | `BoardView.tsx` |
| Filtros sem resultado | `No cards match the filters.` + **Clear filters** | `BoardView.tsx` |
| Sem card selecionado | Painel de detalhe não aparece | `BoardView.tsx` l.182 |
| Clonando para Start task | `Cloning <repo>…` com spinner | `StartTaskAction.tsx` |
| Muitos cards | Até 2.000 issues por leitura (`features.md §Leitura dos cards`); lista rola, sem paginação nem virtualização no código | `CardList.tsx` |

### 2.4 Task (`features/task/TaskView.tsx`)

Estrutura vertical: `TaskHeader` (h-11) › `StageTrack` (h-9) › grupo redimensionável com a coluna da conversa (60%, mín. 40%) e o painel de artefatos (40%, mín. 25%, recolhível a 0). O painel começa recolhido sem artefatos e abre sozinho uma vez no primeiro artefato (lembrado em `localStorage`).

| Região | Conteúdo | Arquivo |
|---|---|---|
| Cabeçalho | `FolderGit2`, nome, badge `One-Shot`, badge `dono/nome`, badge do card (`#N`, status, `Issue closed`), `StatusBadge` (ponto + rótulo), espaço, `ContextGauge`, **Pause/Resume**, botão de modo de review (robô/pessoa), **Models** (`Sparkles`), artefatos (`PanelRight`), lixeira | `TaskHeader.tsx`, `TaskCardBadge.tsx`, `ContextGauge.tsx`, `TaskModels.tsx`, `TaskReviewMode.tsx` |
| Trilha de etapas | Chips `PRD › Tech spec › Plan › Implementation › PR › PR review › Closing` (ou `Planning › …`): feito em verde com `Check`, atual com `bg-accent`, futuro em cinza, revisitado com `RotateCcw`; chips de planejamento abrem menu **Back to…** / **Discard and restart**; **Continue** à direita na revisita | `StageTrack.tsx`, `stage-actions.ts`, `StageActionDialog.tsx` |
| Coluna, planejamento | `Conversation` + `PlanProblemsNotice` + `Composer` | `chat/*`, `PlanProblemsNotice.tsx` |
| Coluna, implementação | `StepBar` (h-10: `Step N of M`, título, ponto + estado, avisos, **Approve** / **Review myself**, **Open in VS Code**, **Discard step**) › `ReviewStrip` (progresso de stage, contagem, lista de arquivos Pending/Staged) › `StepTabs` (**Implementer** / **Reviewer**, cada aba com ponto) › conversa + composer | `StepBar.tsx`, `ReviewStrip.tsx`, `StepTabs.tsx`, `StepPane.tsx` |
| Coluna, PR | `PRBar` (h-10: `#N` + estado + link ou `Pull request`, ponto + estado, `Couldn't confirm the merge`, **Open PR**, **Approve**, **Close task**, **Open in VS Code**, **Pause**, menu `…` com Review again, Discard draft, Refresh PR) › `PRPane` (rascunho editável, conversa do PR ou do review, problemas de checks/conflito, resultado do encerramento) | `PRBar.tsx`, `PRPane.tsx`, `DraftCard.tsx`, `PRBlocked.tsx`, `OrphanPRs.tsx` |
| Artefatos | Toggle group: One-Shot, ou PRD / Tech spec / `Steps (N)`; e PR. Lista de steps com modelo, modo e relatórios `Review N · clean/changes`; relatórios da PR | `ArtifactPanel.tsx`, `StepList.tsx`, `OneShotView.tsx`, `StepDocument.tsx` |

| Estado | Aparência | Fonte |
|---|---|---|
| Task ausente do estado | `<section>` vazia | `TaskView.tsx` |
| Conversa carregando | 3 barras de esqueleto | `chat/Conversation.tsx` |
| Sessão iniciando / pensando / retentando | `Starting session…`, `Thinking…`, `Retrying (attempt N)…` | `chat/ActivityIndicator.tsx` |
| Sessão rodando | Ponto `working` pulsando (primário); composer com **Stop the response** (`Square`); mensagens entram na fila (`Queued`) | `StatusDot.tsx`, `chat/Composer.tsx`, `entries/PendingMessage.tsx` |
| Pausada | `Paused. Resume to keep talking.` no composer; ponto cinza | `Composer.tsx` |
| Permissão / pergunta | Cartões na conversa (`Permission needed`, opções, `Other…`) | `entries/PermissionCard.tsx`, `entries/QuestionCard.tsx` |
| Erro de sessão | `ErrorCard` com **Retry** (`Claude Code not found`, `isn't logged in`, `Couldn't start`, `stopped unexpectedly`, `couldn't finish`) | `entries/ErrorCard.tsx` |
| Plano inválido | `The step files aren't a valid plan` + lista, acima do composer | `PlanProblemsNotice.tsx`, `StepList.tsx` |
| Step preparando / não iniciado / concluído | Spinner central com a fase, `Starting…`, `Starting the next step…` | `StepPane.tsx` |
| Step bloqueado | Tela própria com a razão do git, **Try again** / **Clean and start** | `StepBlocked.tsx` |
| Todos os steps commitados | `Every step is committed` | `ImplementationDone.tsx` |
| Sem steps | `No steps were found.` (itálico) | `StepPane.tsx` |
| Approve desabilitado | Tooltip com o que falta (`Stage every changed file…`, `The agent didn't change anything`) | `StepBar.tsx` |
| PR esperando checks | `Waiting for the checks of the pull request…` com spinner | `PRPane.tsx` |
| PR bloqueada | Tela com razão e **Try again** | `PRBlocked.tsx` |
| Artefatos vazios | `No artifacts yet` / `Nothing written yet.`; One-Shot: `The One-Shot document will appear here…`; carregando: esqueleto | `ArtifactPanel.tsx` |
| Muitos steps | Lista rola no painel; `Step N of M` na barra | `StepList.tsx`, `StepBar.tsx` |

### 2.5 Reviews, o centro de review (`features/reviews/ReviewsView.tsx`)

| Região | Conteúdo | Arquivo |
|---|---|---|
| Cabeçalho | `Reviews`, `Updated <relativo>`, spinner `Reading pull requests`, **Refresh** | `ReviewsHeader.tsx` |
| Falhas | Um aviso por repositório não lido | `ReadFailures.tsx` |
| Filtros | **Board**, **Repository** (`FilterMenu`), **Author**, **Label** (`MultiFilterMenu`, tri-estado `+`/`−`), toggle **Pending only**, **Clear filters** | `ReviewsFilterBar.tsx`, `MultiFilterMenu.tsx` |
| Linha | Ponto `Pending`, título, `#N`, repo, autor, labels (limitadas), `Draft`, `Task`, estado do review, `Reviewed`, `New commits`, card `#N · status`, ícone GitHub, ação **Review** / **Open review** / **Open task** (ou desabilitada com motivo) | `PullRequestRow.tsx`, `PullCardBadge.tsx`, `review-status.ts` |

| Estado | Aparência |
|---|---|
| Primeira leitura | Esqueleto de linhas `h-11` |
| Sem repositórios | `Register a repository to see its pull requests.` |
| Sem PRs | `No open pull requests.` |
| Filtros sem resultado | `No pull requests match the filters.` + **Clear filters** |
| Muitas PRs | `ul` rolável, sem paginação |

### 2.6 Review (`features/reviews/ReviewView.tsx`)

`ReviewHeader` (número, título, repo, autor, card, modo Publish/Apply, `ContextGauge`, Pause/Resume, **Reports**, Delete) › `ReviewBar` (link da PR, ponto + estado, avisos, **Publish review** ou **Apply**/**Approve**, **Review again**, **Open in VS Code**) › painéis: coluna com `FindingsPanel` (recolhível: resumo editável, `N of M decided`, `FindingCard` com Approve/Discard, `Nothing to change.`), conversa e composer; `ReportsPanel` à direita (Context + relatórios, `Published · <veredito> · <data>`). Estados: os 15+ de `review-status.ts` (lista em `features.md §O review como item`), com `ReviewStrip` no modo Apply.

### 2.7 Discussion (`features/discussion/DiscussionView.tsx`)

`DiscussionHeader` (badge `Discussion`, título, board, estado, gauge, Pause/Resume, **Documents**, Archive, Delete) › `DiscussionBar` (estado, avisos, `Publishing…`) › coluna com `DraftsPanel` (recolhível, `N of M decided`, seleção, **Group into an epic**, `EpicGroup`, `DraftCard` editável com Edit/Changes, `DependencyList`), conversa e composer › `DocumentsPanel` (toggle Context / Document). Estados: `Discussing`, `Waiting for the drafts`, `Decide drafts`, `Publishing`, `Publish failed`, `Drafts published` (`discussion-status.ts`).

### 2.8 History e arquivados (`features/history/`)

| Região | Conteúdo |
|---|---|
| Lista | `History`, busca (`Search by name, title or #number`), filtro de repositório da sidebar; linhas misturadas por data: task (repo, `One-Shot` ou contagem de steps), review (`Review`, `#N`, título, repo, autor, `Merged`/`Closed`), discussão (`Discussion`, título, board, cards publicados) |
| Vazios | `Nothing archived yet` + explicação; `Nothing archived in <repo>`; `Nothing matches “<q>”` |
| Arquivados | Task: badge `Archived`, artefatos (mesmo toggle da task), PR, encerramento, Delete. Review: relatórios, veredito, `No report was written.`. Discussão: Document / Drafts / Conversation, `No document was written.`. Todos com **← History** |

### 2.9 Settings (`features/settings/SettingsView.tsx`)

Navegação lateral própria (w-56): `Settings`, **Defaults** (`SlidersHorizontal`), **Boards** (`SquareKanban`), **Repositories** (`FolderGit2`), grupo `Prompts` com os 9 prompts. Conteúdo:

| Página | Conteúdo e estados | Arquivo |
|---|---|---|
| Defaults | Modo de review e modelo/esforço por tipo de sessão (`New tasks`); catálogo indisponível com aviso `TriangleAlert` | `Defaults.tsx`, `models/ModelPicker.tsx`, `review-mode/ReviewModePicker.tsx` |
| Boards | **Add board**, linhas (título, dono, tipo, repos, `Final: … · New cards: …`, leitura, Edit, Remove); vazio `No boards yet.` | `boards/BoardsPage.tsx`, `BoardRow.tsx` |
| Repositories | **Clone folder** (`Not chosen`), **Add repository**, linhas (repo, `Board:`, caminho ou `Not cloned`, contagens, clone ausente, **Review instructions** `Set`/`None` recolhível, Clone/`Cloning…`, Change path, Remove) | `repositories/RepositoriesPage.tsx`, `RepositoryRow.tsx`, `CloneFolderField.tsx` |
| Prompt | Markdown renderizado ou editor, badge `Modified`, `Placeholders`, **Save**/`Saving…`, **Restore**; carregando: esqueleto | `PromptPane.tsx`, `prompts.ts` |

Não há estado vazio para Repositories no arquivo de página (o texto de lista vazia não aparece no grep de `RepositoriesPage.tsx`).

### 2.10 Conversa, compartilhada por task, review e discussão (`features/chat/`)

Entradas: `UserMessage`, `AppMessage` (`MySpec · sent to the agent`), `AssistantMessage` (Markdown em streaming, `Interrupted`), `ActionGroup` (ações agrupadas, recolhíveis, ícone running/ok/erro), `PermissionCard`, `QuestionCard`, `Marker` (ícones `FileText`, `FileCheck`, `ListChecks`, `Play`, `RotateCcw`, `Ban`, `Bot`, `Archive`, `MessagesSquare`), `ErrorCard`, `PendingMessage`. `ScrollToBottomButton` com `New messages`. `Composer`: textarea `Reply to the agent…`, seletor de modelo da sessão, **Send** / **Stop the response**.

## 3. Indicadores de status

### 3.1 Tons (`features/task/StatusDot.tsx`, `styles/tokens.css`)

| Tom | Cor | Onde vem |
|---|---|---|
| `working` | `--status-working` = `--primary` (índigo), `animate-pulse` | Sessão trabalhando; PR/review/discussão em estados ativos |
| `attention` | `--status-attention` (âmbar oklch 0.72 0.16 70) | Qualquer situação de grupo `waiting` ou `closing` |
| `error` | `--destructive` | Situação de grupo `error` |
| `paused` | `--status-paused` = `--muted-foreground` | Sessão pausada |
| `done` | `--status-success` (verde) | Implementado, PR fechada, review publicado, rascunhos publicados |
| `idle` | `--muted-foreground` | Todo o resto, inclusive erro/permissão/pergunta da sessão sem situação |

Regra: a cor de atenção vem só das situações (`status.ts`, `review-status.ts`, `discussion-status.ts`, `pr-status.ts`: "never calls for the user"). Duas cores de `attention` e `paused` são iguais a tokens neutros; `paused` e `idle` são visualmente o mesmo cinza. O token comenta "Colour is never the only carrier: every dot has a label" (`tokens.css`).

### 3.2 Onde cada sinal aparece

| Sinal | Sidebar | Cabeçalho / barra | Outros |
|---|---|---|---|
| Atenção (situação) | Waiting for you (ponto + detalhe + espera); linha da task/review/discussão (ponto + `summaryLabel`, `+N` quando há várias) | `StatusBadge` no cabeçalho; ponto na `StepBar`, `PRBar`, `ReviewBar`, `DiscussionBar`; ponto nas abas Implementer/Reviewer | `Waits for you` na linha do card; flash; notificação + som |
| Progresso | `Step N of M · <estado>`, `Review 40%`, `N% staged` no rótulo | `Step N of M` na StepBar; barra do `ReviewStrip`; `N of M decided` nos painéis; `ContextGauge` (anel, cinza <70%, âmbar ≥70%, vermelho >90%) | Chips da trilha (feito/atual/futuro) |
| Sessão ativa | Ponto pulsando | Ponto pulsando, spinner `LoaderCircle` em fases preparatórias | `ActivityIndicator` na conversa |
| Leitura remota | Ícone de falha no nó do board | Spinner + `Updated <relativo>` nos cabeçalhos de Board e Reviews | `ReadFailures` |
| Contagens | Badge em Waiting for you, Reviews (pendentes), History | — | — |

Vocabulário de rótulos: `lib/situations.ts` (`situationLabel`: `Session error`, `Step 3 blocked`, `Review step 3`, `Step 3 · 40% staged`, `Approve step 3`, `Draft to approve`, `Findings to decide`, `Ready to merge`, `Ready to close`, `New commits`, `Decide drafts`, `Pass blocked`, `Checks failed · conflict`…), `status.ts` (`prPhrase`), `step-status.ts`, `review-status.ts`, `discussion-status.ts`.

### 3.3 Vocabulário visual

| Item | Valor | Fonte |
|---|---|---|
| Base | shadcn padrão (neutros oklch acromáticos), primário índigo `oklch(0.457 0.24 277)`, raio `0.625rem`; tokens `chart-*` e `sidebar-primary` definidos e sem uso nas features (2 ocorrências no total) | `styles/globals.css` |
| Tipos | Inter Variable (sans), JetBrains Mono Variable (mono); tamanho raiz 1rem, `leading 1.45`; tamanhos fora da escala: `text-[11px]` (contadores), `text-[0.8125rem]`, `text-[1.5rem]` ×5, `text-[2.125rem]` ×2 | `styles/tokens.css`, `fonts.css`, grep |
| Movimento | `--duration-fast 120ms`, `--duration-base 150ms`, `--ease-standard`; flash 1600ms; `prefers-reduced-motion` zera animações | `tokens.css`, `globals.css` |
| Alturas recorrentes | Linhas 48px (h-12), barras h-9/h-10/h-11 | Sidebar, barras |
| Temas | Claro/escuro por classe `.dark`, com variantes próprias de `attention` e `success` | `tokens.css`, `features/theme/` |
| Uso de cor de status direto em classes | 32 ocorrências de `var(--status-*)`, 57 de `destructive` | grep em `features/` |

### 3.4 Ícones (lucide-react, contagem de arquivos que importam)

`TriangleAlert` 16 (aviso e falha, sempre âmbar ou destrutivo), `LoaderCircle` 13 (+`Loader2` 1, duplicado), `ChevronRight` 12 (recolher), `ExternalLink` 11, `RotateCcw` 8 (retry, discard, restart), `ChevronsUpDown` 8 (seletores), `X` 7, `Trash2` 7, `Archive` 7, `Play` 6, `Plus` 5, `Check` 5, `Pause` 4, `RefreshCw` 3, `PanelRight` 3, `MessagesSquare` 3, `GitPullRequestArrow` 3, `FolderGit2` 3, `Code` 3 (VS Code), `Bot` 3 (modo Agent), `Ban` 3; uma vez: `Wrench`, `UserRound`, `UserRoundCheck`, `Sun`, `Moon`, `Monitor`, `Square`, `Sparkles`, `SlidersHorizontal`, `Settings`, `Pencil`, `MoreHorizontal`, `Minus`, `ListTodo`, `ListChecks`, `GitPullRequest`, `FolderPlus`, `FileText`, `FileCheck`, `CircleCheck`, `ArrowUp`, `ArrowDown`, `SquareKanban` (2). Nenhum item da sidebar tem ícone de tipo (task, review, discussão distinguem-se por texto).

## 4. Primitivos

### 4.1 `components/ui/` (arquivos de `features/`, `app/`, `components/` que importam, sem testes)

| Primitivo | Arquivos | Variantes em uso |
|---|---|---|
| button | 72 | variant: ghost 39, outline 32, destructive 2, link 2, secondary 1; size: sm 92, icon-sm 23, xs 15, icon-xs 5, icon 1 |
| badge | 22 | outline 24, secondary 18, default 1 |
| tooltip | 19 | Também usado para explicar ações desabilitadas |
| textarea | 12 | |
| skeleton | 12 | Linhas de texto (3 larguras) e linhas de lista |
| input | 10 | |
| dropdown-menu | 10 | Seletores e menu `…` da PR |
| alert-dialog | 10 | Toda confirmação destrutiva |
| toggle-group | 8 | Abas de artefatos, Approve/Discard, modo, tema |
| dialog | 8 | |
| label | 7 | |
| collapsible | 7 | Contextos, Findings, Drafts, Review instructions, ActionGroup |
| checkbox | 6 | |
| resizable | 4 | Task, Review, Discussion, Board |
| kbd | 4 | |
| toggle | 3 | Filtros booleanos |
| scroll-area | 3 | Sidebar, Waiting for you, Reviews |
| radio-group | 2 | BoardDialog, PublishDialog |
| popover | 2 | Models, modo de review |
| separator | 0 | Gerado e sem uso |

Não existem primitivos de tabs (abas feitas com `toggle-group` ou `role="tablist"` manual em `StepTabs.tsx`), card, progress (barra do `ReviewStrip` e anel do gauge são próprios), avatar, sheet, command, sonner/toast (avisos são `Banner` próprio).

### 4.2 Wrappers e componentes próprios reutilizados

| Componente | Papel | Usos |
|---|---|---|
| `ToneDot` / `StatusDot` / `StatusBadge` | Ponto de tom; com rótulo | `task/StatusDot.tsx`, `StatusBadge.tsx`; ToneDot em 16 pontos |
| `Banner`, `ErrorNotice` | Aviso dispensável no topo | `notice/Notice.tsx` (2) |
| `FilterMenu` | Filtro de valor único | `components/FilterMenu.tsx` (5) |
| `MultiFilterMenu` | Filtro tri-estado | `reviews/MultiFilterMenu.tsx` (2) |
| `ModelPicker`, `ModelValue`, `UnavailableMark` | Modelo e esforço | `models/ModelPicker.tsx` (7) |
| `ReviewModePicker` | Manual/Agent | `review-mode/ReviewModePicker.tsx` |
| `RepositoryPicker`, `RepositoryFilter` | Escolha de repositório | `task-create/`, `sidebar/` |
| `Markdown`, `ExternalLink` | Streamdown + mermaid + código | `chat/Markdown.tsx` (13) |
| `Conversation`, `Composer` + entradas | Conversa de qualquer sessão | `chat/` (task, review, discussão) |
| `ContextGauge` | Anel de contexto | `task/ContextGauge.tsx` (3) |
| `ReviewStrip` | Progresso de stage e arquivos | `task/ReviewStrip.tsx` (3: step, PR, review Apply) |
| `DraftCard` (task) e `DraftCard` (discussion) | Dois componentes distintos com o mesmo nome | `task/DraftCard.tsx`, `discussion/DraftCard.tsx` |
| `TreeNode`, `Group`, linhas | Árvore, internos a `SidebarTree.tsx` e duplicados em estilo em `ReviewsNode.tsx` (`HEADER_BUTTON_CLASS` repetida) | `sidebar/` |
| `useEditedText` | Texto editável com rascunho | `components/useEditedText.ts` |
| `usePresence`, `useNow` | Entrada/saída animada, relógio | `attention/` |

## 5. Pontos onde um estado não é tratado ou diverge do doc

| Onde | Fato | Fonte |
|---|---|---|
| Waiting for you | Exclui só a task ou o review aberto: `openItemId = openTaskId ?? openReviewId`. Uma discussão aberta continua listada, contra `features.md §Barra lateral` ("exceto o que está aberto"). `Ctrl+J` considera a discussão. | `attention/WaitingSection.tsx`, `app/useGlobalShortcuts.ts` |
| Carregamento inicial do app | Tela vazia, sem marca nem indicador | `app/App.tsx` |
| Item aberto ausente do estado (task, board) | Área principal vazia, sem mensagem | `TaskView.tsx`, `BoardView.tsx` |
| Home com tasks | Só "No task open"; não resume nada | `home/Home.tsx` |
| Voltar | Sem histórico de navegação; fechar Settings vai a Home | `store/app-store.ts` |
| Sidebar | Largura fixa; sem recolher; tasks, reviews e discussões sem ícone de tipo; ordem por criação, sem ordenar por urgência na árvore | `Sidebar.tsx`, `tokens.css`, `features.md §Tela de boas-vindas e barra lateral` |
| Listas longas | Board (até 2.000), Reviews, History e árvore sem virtualização nem paginação | `CardList.tsx`, `ReviewsView.tsx`, `HistoryPanel.tsx` |
| Erro da sessão sem situação | Tom `idle`, igual a ocioso | `status.ts`, `step-status.ts` |

## 6. Lacunas e perguntas para o usuário

1. **O que você olha primeiro ao abrir o app?** Hoje Home é vazia e a triagem vive só em Waiting for you, na sidebar. A resposta decide se a área principal ganha uma visão de triagem ou se a sidebar continua sendo o painel de comando.
2. **Quantos itens ativos você tem ao mesmo tempo, num dia cheio** (tasks, reviews, discussões, boards)? A sidebar mostra 5 linhas em Waiting e 5 em Reviews antes de rolar, com linhas de 48px. A resposta decide densidade e se a árvore precisa de agrupamento por estado em vez de board.
3. **Você trabalha com mais de uma task visível ao mesmo tempo** (acompanhar uma sessão enquanto responde outra)? O shell mostra uma visão por vez, sem abas nem divisão. Decide se o modelo é de uma tela ou de várias.
4. **O painel de artefatos e o painel de detalhe do card: você os mantém abertos ou recolhidos?** Decide se documentos são coluna fixa, sobreposição ou aba.
5. **Com que frequência você entra em Settings e no History?** Hoje ambos ocupam a área principal e apagam o contexto do item aberto. Decide se viram sobreposição/modal ou continuam lugares.
6. **O board é o seu ponto de partida de trabalho ou só o lugar de onde nascem tasks?** Hoje é Home quando não há tasks e some depois. Decide o peso do board na navegação principal.
7. **Você usa o teclado para navegar entre itens** (`Ctrl+J`, setas na árvore, atalhos do board) **ou o mouse?** Decide se a estrutura prioriza uma paleta de comandos e foco, ou alvos visuais.
8. **A janela costuma ficar em que tamanho** (tela cheia, meia tela ao lado do VS Code)? A coluna da conversa tem mínimo de 40% e a sidebar 21.5rem fixos. Decide breakpoints e o que recolhe primeiro.
