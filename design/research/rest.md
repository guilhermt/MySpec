# O resto: Settings, History, boas-vindas, migração, diálogos, avisos e notificações

Levantamento da quinta rodada da fase 4 (`design/README.md`, Fases, 4.5). Fatos do produto como ele é, com a fonte de cada um; o que já foi decidido nas quatro telas e vale para cá; o volume real do banco; lacunas e perguntas. Não propõe design.

Fontes e como são citadas: `features §X` = `docs/product/features.md`; `structure §N`, `brief §N`, `task.md`, `board.md`, `review.md` = os documentos de `design/`; `discussion.md` = `design/screens/discussion.md`, com o mock em `lab/13-screen-discussion`; caminhos de código relativos a `frontend/src/` ou à raiz quando começam por `internal/`. Os textos da interface estão como o código os escreve.

---

## 1. Settings

### 1.1 O lugar

| Fato | Fonte |
|---|---|
| Abre pelo ícone do rodapé (tooltip `Settings Ctrl ,`) e por `Ctrl+,`, que também fecha. Não há `Esc` | `features §Configurações e aparência`; `settings/SettingsButton.tsx`; `app/useGlobalShortcuts.ts` |
| É um lugar da área principal, com navegação própria à esquerda (`w-56`): `Settings`, **Defaults**, **Boards**, **Repositories**, o título `Prompts` e os nove prompts um por linha. 12 itens clicáveis | `settings/SettingsView.tsx` |
| Abre na última página vista na sessão (o estado não volta a `defaults` ao reabrir; volta só ao reiniciar o app ou ao cair na boas-vindas) | `store/app-store.ts` (`openSettings` não mexe em `settingsSection`) |
| Fechar leva a Home, não ao lugar anterior. Decidido: volta ao lugar anterior | `store/app-store.ts` `closeSettings`; `structure §1` |
| Sair de um prompt com edição não salva (outra página, fechar, abrir item, notificação) pede `Discard your changes?` | `store/app-store.ts` `leave`; `settings/DiscardChangesDialog.tsx` |
| Nenhuma página tem botão **Save** geral: Defaults salva a cada escolha; Boards e Repositories agem por diálogo ou por linha; o prompt tem **Save** próprio | código das páginas |
| Não há página de aparência. O tema é o botão do rodapé da lateral (System, Light, Dark, em ciclo), aplicado na hora | `features §Configurações e aparência`; `theme/ThemeToggle.tsx`; `components.md` Seletor de tema |
| Decidido: navegação à esquerda com `Repositories` levando o aviso do clone | `structure §4` |

### 1.2 Defaults (modo de review e modelos)

Título `Defaults`, largura máxima 43rem (`settings/Defaults.tsx`).

| Campo | Controle hoje | Texto | Ao mudar |
|---|---|---|---|
| **Review mode** | Seletor `ReviewModePicker`, rotulado `New tasks`, `Manual` ou `Agent` (robô) | `Who reviews the steps of a new task. A change applies to the tasks created after it.` | Salva na hora (`setReviewModeDefault`); falha vai ao aviso genérico (§5.1) |
| **Models**, uma linha por tipo de sessão, nesta ordem: `PRD`, `Tech spec`, `Plan`, `One-Shot planning`, `Implementation`, `Step review`, `PR`, `PR review`, `Discussion` | `ModelPicker` (menu com `Model` e `Effort` em rádio) | `The model and effort each stage of a new task starts with. The models and their effort levels come from the installed Claude Code, read when the app opens. A change applies to the tasks created after it.` e, ao pé, `A commit runs in the session of its step or of its pull request review, with the model and effort of that session.` | Salva na hora (`setModelDefault`) |

Estados do catálogo (`lib/models.ts`, `models/ModelPicker.tsx`, `features §Modelos e esforço`):

| Estado | O que aparece |
|---|---|
| Catálogo lido | Os modelos na ordem do CLI; um modelo sem esforço mostra só o nome (`Haiku 4.5`) e não tem o grupo `Effort` |
| Escolha que o catálogo não tem | `unavailable` com ícone de aviso, âmbar; no menu, o item desabilitado `<modelo> · unavailable`. O produto nunca troca a escolha |
| Nenhuma leitura deu certo | Aviso no topo da lista e no próprio menu: `Claude Code was not found. Install it or point MYSPEC_CLAUDE_PATH at the executable.`, `The installed Claude Code doesn't list its models. Update it and reopen the app.` ou `Reading the models of Claude Code failed. Reopen the app to try again.` |
| Lendo | `failure` vazio e sem modelos: nada é dito (o board decidiu `Reading models…`, `board.md` §4.5) |

Não há volta ao padrão de fábrica dos modelos. O de fábrica é Fable 5.1 · high no planejamento e na discussão, Opus 5.5 (1M) · high na implementação, no step review e no PR review, Opus 5.5 (1M) · medium no PR (`internal/models/models.go`).

O de review de PR é também o ponto de partida do início de um review, e o de discussão, da criação de uma discussão (`features §Modelos e esforço`).

### 1.3 Boards

Título `Boards`, **Add board** (primário) à direita, texto `The GitHub projects your tasks start from, each with the repositories it manages.` Vazio: `No boards yet.` (`boards/BoardsPage.tsx`).

Linha do board, em ordem alfabética de título (`boards/BoardRow.tsx`, `boards/boards-page.ts`, `features §Página Boards`):

| Parte | Texto |
|---|---|
| Título | `Faturamento IA` |
| Dono, tipo, repositórios | `ICSF-Faturamento · Organization · 11 repositories` |
| Link | A URL inteira do board, que abre o GitHub |
| Status | `Final: <finais> · New cards: <status>`; `none` quando vazio; some num board sem campo `Status` |
| Leitura | `Updated 3 min ago` (relido a cada minuto), `Not read yet`, ou a mensagem da falha em vermelho com ícone (`features §Falhas`) |
| Ações | **Edit** (contornado), **Remove** (fantasma) |

Divergência: a falha aqui é vermelha; `board.md` §3.8 decidiu que a falha de leitura "nunca é situação, nunca notifica e nunca é vermelha".

### 1.4 Repositories

Título `Repositories`, **Add repository** (primário), texto `The repositories your tasks belong to, each tied to its local clone.` Não há estado vazio: a lista é um `ul` com borda mesmo sem itens (`repositories/RepositoriesPage.tsx`).

**Clone folder** (`repositories/CloneFolderField.tsx`): `Clone folder`, o caminho em mono ou `Not chosen`, **Choose…**, que abre o seletor nativo `Choose the clone folder` (`internal/bindings/repository_service.go`). Sem valor padrão; um **Clone** sem pasta abre o seletor na hora, e cancelar cancela o clone (`features §Repositório sem clone`).

Linha do repositório, em ordem alfabética de `dono/nome` (`repositories/RepositoryRow.tsx`, `lib/repositories.ts`):

| Parte | Texto e estado |
|---|---|
| Nome e board | `ICSF-Faturamento/medflow` e a etiqueta `Board: Faturamento IA` |
| Clonando | `Cloning…` com spinner (`role="status"`) |
| Caminho | Mono, ou `Not cloned` |
| Contagens | `0 active tasks · 6 archived tasks · 11 reviews` (reviews só quando há) |
| **Review instructions** | Recolhível, título com `None` ou `Set`. Aberto: área de texto de 6 linhas, `Added to every pull request review of this repository, including the reviews of task pull requests.`, **Cancel** e **Save** (desabilitado sem mudança). Vale a partir da próxima passada (`features §Página Repositories`) |
| Clone inexistente | `The clone at <caminho> is missing.`, âmbar com ícone |
| Falha do clone | A mensagem do `gh`, vermelha |
| Recusa de uma ação da linha | Vermelha, sob a linha |
| Ações | **Clone** (só sem clone; desabilitado clonando), **Change path** (sempre), **Remove** (desabilitado com o motivo no tooltip: `<dono/nome> has N active tasks and M archived tasks. Delete them before removing the repository.`, ou o mesmo com reviews) |

### 1.5 Prompts

Uma página por prompt, na ordem do workflow (`settings/prompts.ts`, `settings/PromptPane.tsx`, `features §Prompts`):

| Prompt | Descrição na página | Placeholders do padrão | Tamanho do padrão |
|---|---|---|---|
| PRD | `Opens the PRD session of a task.` | task_name, artifacts_dir, prd_path, initial_context | 87 linhas |
| Tech spec | `Opens the tech spec session.` | + repository, tech_spec_path | 88 |
| Plan | `Opens the plan session. Holds the template of the step files, which are the prompts of the implementation.` | + steps_dir | 108 |
| One-Shot planning | `Opens the planning session of a One-Shot task. Holds the structure of the One-Shot document, which is the prompt of its implementation.` | one_shot_path, initial_context… | 115 |
| Step review | `Opens the review session of a step in Agent mode.` | step_path, review_path, branch… | 72 |
| Commit | `Sent after a step is approved, by you or by the agent review, and after you approve the changes of a PR review.` | what_to_commit, push | 33 |
| PR | `Opens the pull request session of the task.` | draft_path, base_branch… | 57 |
| PR review | `Opens the review session of the pull request.` | pr_number, pr_url, review_path… | 49 |
| Discussion | `Opens the conversation of a discussion, which writes the document and the drafts of cards.` | document_path, drafts_path… | 51 |

Tamanhos de `internal/prompts/defaults/*.md` (1,4 a 7,5 mil caracteres).

| Estado | O que aparece |
|---|---|
| Lendo | Esqueleto de três linhas |
| Leitura falhou | Aviso local `Something went wrong` dispensável |
| Leitura | O texto renderizado como Markdown (os placeholders aparecem crus, `{{prd_path}}`), etiqueta `Modified` quando editado, **Restore default** (só editado) e **Edit** |
| Editando | Área de texto mono que ocupa a página, com a coluna `Placeholders` à direita (`The ones the default of this prompt uses. Move or remove any of them.`, cada um com o que vira e, para três, o que o produto faz sem ele: `Without it, the initial context is added at the end.`); **Cancel** e **Save** (`Saving…`); `Ctrl+S` salva |
| Salvar um texto igual ao padrão | Apaga a edição: o prompt volta a seguir o padrão (`internal/prompts/prompts.go` `Save`) |

O que a página não mostra: as seções que o produto acrescenta em tempo de sessão (`One-Shot task`, `## Card`, `Board`, `Drafts format`, `Pull request without a task`, `Findings format`, `Publishing`/`Applying`, `GitHub checks and conflicts`, `GitHub status`, `Review instructions`, `Instructions for this pass`, a última resposta do implementador) (`features §Prompts`; `internal/prompts/prompts.go` `Render`).

---

## 2. Diálogos

Nenhum destes tem desenho na fase 4. Os textos são os do código, que batem com `features.md` salvo onde dito.

### 2.1 Add board e Edit board, em etapas

`boards/BoardDialog.tsx`, `boards/board-dialog.ts`, `boards/RepositoryLinkRow.tsx`, `features §Cadastrar um board`, `§Editar e remover um board`. Largura `40rem`. Cada abertura relê o board.

| Etapa | Add board | Edit board |
|---|---|---|
| 1. URL | `Paste the URL of a GitHub project.`, campo com o placeholder `https://github.com/orgs/owner/projects/1`, **Cancel**, **Continue** (desabilitado sem texto). `Enter` lê. Lendo: `Reading the board…` e o campo desabilitado | Não existe: abre lendo, `Reading the board…`, só com **Cancel** |
| Recusas da leitura | `This isn't the URL of a GitHub project.`; `<título> is already registered.`; as seis falhas de `features §Falhas`. Vermelhas sob o campo; o usuário corrige e lê de novo | A falha, só com **Cancel** (sem **Try again**) |
| 2. Status (pulada num board sem campo `Status`) | `<título> · <dono> · Mark the statuses that end the work on a card.`; lista das opções na ordem do board, cada uma com a caixa `Final` (rola a partir de 24rem); `Status for new cards` em rádio, `None` e as opções. **Cancel**, **Continue** | Igual; os finais vêm como guardados, opções novas desmarcadas, e o status de cards novos volta a `None` se a opção sumiu |
| Pré-marcação | Finais: `Done`, `Concluído`, `Closed`, `Completed`, `Fechado`, `Finalizado`. Cards novos: a primeira entre `A Fazer`, `To do`, `Todo`, `Ready` (sem diferenciar maiúsculas nem acentos) | — |
| 3. Repositórios | `<título> · <dono> · Check the repositories this board manages.`; uma linha por repositório das issues, marcado, com `N cards` e como fica ligado (tabela abaixo); campo `owner/name` com **Add**; **Cancel** e **Add board** | Os do board marcados, os outros das issues desmarcados; **Save** |
| Recusas do **Add** | `Type the repository as owner/name.`; `<dono/nome> doesn't exist or this account can't read it.` | Igual |
| Confirmar | Cadastra o board e os repositórios marcados e começa a primeira leitura; o diálogo fecha. Da boas-vindas, a tela dá lugar ao app | Salva. Um repositório desmarcado vai a **No board** (com clone, tasks ou reviews) ou sai do produto (sem nada), **sem aviso no diálogo** |
| Erro ao salvar | A mensagem vermelha no rodapé; o diálogo fica | Igual |

Como cada repositório fica ligado (`board-dialog.ts` `linkText`):

| Caso | Texto | Controle |
|---|---|---|
| Já cadastrado | `Registered · <caminho>` ou `Registered · Not cloned` | Caixa |
| Clone achado pela varredura da home | `Clone found · <caminho>`; com mais de um, `Clone found` e um menu com os caminhos | Caixa e, com vários, o menu do clone |
| Sem clone | `Registered without a clone` | Caixa |
| De outro board | `<dono/nome> belongs to the board <título>.` | Caixa desabilitada, linha a 70% |

Não há **Back** entre as etapas: da etapa 3 não se volta à 2, nem da 2 à URL. O título do diálogo é `Add board` ou `Edit board` em todas as etapas; não há indicação de etapa (1 de 3).

### 2.2 Remove board

`boards/RemoveBoardDialog.tsx`, `features §Editar e remover um board`. Confirmação: `Remove <título>?`; o corpo pede a prévia ao backend e diz `N repositories move to No board and M leave MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.` (enquanto lê, `The board leaves MySpec.`). **Cancel** e **Remove board** (destrutivo). Um erro fica no diálogo. Hoje, remover `Faturamento IA` diria 9 e 2 (§7).

### 2.3 Add to board

`board/AddToBoardDialog.tsx`, `features §Start task`. Aberto por **Start task** num card de repositório sem board (`board.md` §3.6 decidiu a entrada, não o diálogo). `Add <dono/nome> to the board`, `The board manages the repository from now on.`, `Checking the repository…`, a mesma linha do §2.1 (com o menu do clone), **Cancel**, **Add to board**. Confirmado, o card segue pelas regras de **Start task**.

### 2.4 Add repository, com a varredura

`repositories/AddRepositoryDialog.tsx`, `repositories/add-repository.ts`, `features §Página Repositories`. Aberto da página Repositories e da boas-vindas. Cada abertura varre de novo.

| Momento | O que aparece |
|---|---|
| Abertura | `Add repository` · `Pick the clones to register. The scan looks through your home folder, up to 6 folders deep.` |
| Varrendo | `Scanning your home folder…` (`role="status"`) |
| Falha da varredura | A mensagem vermelha |
| Nada achado | `No GitHub clones were found in your home folder, up to 6 folders deep.` |
| Lista | Filtro `Filter by name or path`; uma linha por clone, em ordem alfabética: caixa, `dono/nome`, `Registered` nos já cadastrados (desabilitados, 70%), caminho em mono. Rola a partir de 24rem. Filtro sem resultado: `No repositories match.` |
| Rodapé | **Browse…** à esquerda, **Cancel**, **Add repository** ou **Add N repositories** (desabilitado sem marca) |
| Confirmar | Cadastra um por vez, na ordem da lista. Todos passaram: fecha. Algum recusado: a razão sob a linha, que fica marcada; os que passaram viram `Registered`; o diálogo fica |
| **Browse…** | Seletor nativo `Add repository`, na home. Cancelar deixa o diálogo; uma pasta aceita fecha o diálogo; a recusa aparece no rodapé |
| Recusas | `<caminho> is not the root of a git repository.`, `<caminho> has no origin remote.`, `The origin remote of <caminho> is not on GitHub: <url>.`, `<dono/nome> is already registered at <caminho>.` |

Um repositório cadastrado sem clone aparece disponível, e confirmá-lo liga o clone ao cadastro (`features §Página Repositories`).

### 2.5 Change path, Clone e a pasta de clones

Não são diálogos do produto: **Change path** abre direto o seletor nativo `Change the path of <dono/nome>`, na pasta-mãe do caminho atual (`internal/bindings/repository_service.go`). Cancelar não faz nada. Recusas: as do §2.4 e `<caminho> is a clone of <outro>, not of <dono/nome>.`, que aparecem na linha que pediu (Settings, card do board, faixa da task). **Clone** roda em segundo plano (`Cloning…`); recusa `<caminho> already exists and is not a clone of <dono/nome>.`; falha com a mensagem do `gh` onde foi pedido (`features §Repositório sem clone`). Onde **Change path** e **Clone** aparecem fora de Settings já está decidido (`board.md` §2.2, §3.6; `task.md` §7 `step_blocked`; `review.md` §2.5).

### 2.6 Remove repository

`repositories/RemoveRepositoryDialog.tsx`. `Remove <dono/nome>?` · `The repository leaves MySpec. Nothing is deleted on disk: the clone stays where it is.` · **Cancel**, **Remove** (destrutivo). Fecha antes de remover; uma falha vai ao aviso genérico. Não diz que o repositório sai também do board (`features §Página Repositories` diz que sai).

### 2.7 Delete task, com a prévia

`task/DeleteTaskDialog.tsx`, `task/OrphanPRs.tsx`, `features §Apagar uma task`. `task.md` §10 decidiu a entrada (**Delete task…** no `⋯`, e na barra `pr_closed`), não o diálogo.

| Parte | Task ativa | Task arquivada |
|---|---|---|
| Título | `Delete "<nome>"?` | Igual |
| Texto | `This removes the documents, the steps and every record of the task. It can't be undone.` | `This removes the archived task and its documents from the history. It can't be undone.` |
| Prévia | Pedida ao git ao abrir (`previewDelete`), esqueleto enquanto lê | Nenhuma |
| Sessão rodando | `The conversation in progress will be interrupted.` | — |
| Worktree | `The worktree will be removed`, etiqueta `N uncommitted` quando suja, o caminho, e o erro do git quando não pôde ler | — |
| Branch | `The branch <nome> will be deleted`, etiqueta `not merged`, e o erro do git | — |
| PR | `This pull request stays open on GitHub:` `#N ↗` `Closing it on GitHub is up to you.` (diz "stays open" mesmo numa PR mergeada) | — |
| Prévia que falhou | Aviso local dispensável; apagar continua possível | — |
| Botões | **Cancel**, **Delete** (destrutivo). Fecha e apaga em segundo plano | Igual |
| Depois | O que o git não removeu vai ao aviso `Some files stayed on disk` (§5.2) | — |

### 2.8 Discard step

`task/DiscardStepDialog.tsx`, `features §Descartar step`. `Discard step N and start over?`. Texto sem revisor: `This ends the session and deletes the conversation of the step. The step starts again from scratch right away.`; com revisor ou relatórios: `This ends the sessions and deletes the conversations of the step and of its reviewer, with the reports of the agent review. The step starts again from scratch right away.` Caixa **Also clean the worktree**, marcada a cada abertura, com `Discards every uncommitted change in the worktree. Without this, the step starts blocked until the worktree is clean.` **Cancel**, **Discard** (destrutivo). Não mostra quantos arquivos não commitados a worktree tem (a prévia do §2.7 sabe).

### 2.9 Voltar a uma etapa, descartar e recomeçar, Continue

`task/StageActionDialog.tsx`, `task/stage-actions.ts`, `task/StageTrack.tsx`, `features §Voltar e descartar`. Decidido: **Back to <etapa>…** e **Discard and restart the <etapa>…** no `⋯`; **Continue** na barra do pedido `ready_to_continue` (`task.md` §7, §10).

| Ação | Quando existe | Título | Texto (o que se perde, montado por etapa) | Botão |
|---|---|---|---|---|
| Back (Structured) | PRD e Tech spec, com a task depois deles; não há **Back to plan** | `Back to the PRD?`, `Back to the Tech spec?` | `This deletes <lista>. The <etapa> stays, and the next stage starts again from scratch when you continue.` | **Back** |
| Discard (Structured) | A etapa de planejamento atual; o Plan também na implementação | `Discard the Plan and start over?` | `This deletes <lista>. A new <etapa> session starts right away.` | **Discard** |
| Back (One-Shot) | Na implementação ou na PR | `Back to planning?` | `This deletes <lista>. The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.` | **Back** |
| Discard (One-Shot) | Em qualquer etapa | `Discard the planning and start over?` | `This deletes <lista>. A new planning session starts right away.` | **Discard** |

A lista vem, em ordem, de: `the PRD conversation and document`, `the tech spec conversation and document`, `the plan conversation and the step files`, `the step conversations, the worktree and the branch, with any uncommitted work in them` (One-Shot: `the planning conversation and the One-Shot document`, `the implementation conversations and review reports, and its worktree and branch, with any uncommitted work in them`). Com a PR aberta, o bloco `This pull request stays open on GitHub` entra no diálogo. A lista não cita o que a etapa de PR criou, que `features §Voltar e descartar` diz que também se apaga.

**Continue** hoje: `Continue to tech spec`, `Continue to plan`, `Continue to implementation`; desabilitado com `Wait for the agent to finish and the document to be written.`; sem confirmação.

### 2.10 Pausar

Não tem diálogo nem confirmação: **Pause**/**Resume** age na hora (`task/TaskHeader.tsx`, `reviews/ReviewHeader.tsx`, `discussion/DiscussionHeader.tsx`). Hoje fica desabilitado com erro de sessão. Decidido: só no cabeçalho, pílula neutra `paused`, compositor `Sending resumes the task…`, nenhuma barra do pedido (`structure §3`, `task.md` §4 e §12). "Desde quando" pede backend (`structure §8`).

### 2.11 Prompts: descartar edição e restaurar

| Diálogo | Texto | Botões |
|---|---|---|
| Descartar edição | `Discard your changes?` · `The edits to the <nome> prompt haven't been saved.` | **Keep editing**, **Discard** (destrutivo) |
| Restaurar | `Restore the default <nome> prompt?` · `Your edits are replaced by the default of this version of the app, and the prompt follows the default of new versions again.` | **Cancel**, **Restore** |

### 2.12 Já decididos em outras telas

Criação de task (`board.md` §4), nova discussão (`board.md` §2.3, `discussion.md`), início de review, **Review again** e publicação (`review.md` §3, §11, §12), apagar review (`review.md` §4), arquivar, apagar e agrupar em épico da discussão (`discussion.md` §11). Não entram nesta rodada.

---

## 3. History

### 3.1 A lista

`history/HistoryPanel.tsx`, `history/history-list.ts`, `features §Histórico`.

| Fato | Detalhe |
|---|---|
| Entrada | **History** no rodapé, com a contagem de tasks, reviews e discussões arquivados |
| Cabeçalho | Ícone, `History`, `Finished tasks, reviews and discussions of every repository, with their documents.` |
| Busca | Foco automático, `Search by name, title or #number`. Task: pelo nome. Review: pelo título e por `#N`. Discussão: pelo título |
| Filtro | O **mesmo** filtro de repositório da lateral (`RepositoryFilter`): mudar aqui muda a árvore, e vice-versa, e fica guardado entre execuções. Discussão passa quando um card de entrada ou publicado é do repositório |
| Ordem | Uma lista só, misturada, da mais recente para a mais antiga pela data de arquivamento. Sem agrupamento, sem paginação, sem virtualização |
| Linha de task | Nome, etiqueta do repositório curto (tooltip `dono/nome`), `#N ↗` da PR (abre o GitHub), `One-Shot` ou `N steps`, `Sep 12, 2026 → Sep 24, 2026` |
| Linha de review | `Review`, `#N <título>`, repositório curto, autor, `Merged` ou `Closed`, datas |
| Linha de discussão | `Discussion`, título, board, `N cards published`, datas |
| Vazios | `Nothing archived yet` · `A task comes here once it's closed, a review once its pull request is merged or closed, a discussion once it's archived.`; `Nothing archived in <repo>` · `Choose another repository, or all of them.`; `Nothing matches “<q>”` · `Try another name, or clear the search.` |
| Decidido | Lista mista com busca e filtro; a linha recém-arquivada fica destacada quando se chega por um item que saiu (`structure §4`). "Muitos itens" do History é decidido na fase 4 (`structure §7`) |

### 3.2 O que abre, por tipo

Todos têm **← History**, uma faixa com as datas e a lixeira (apagar). Nada roda.

| Tipo | Cabeçalho | Corpo | Fonte |
|---|---|---|---|
| Task Structured | Nome, repositório, card (`#N`, status, `Issue closed`), `Archived` | Abas **PRD**, **Tech spec**, **Steps (N)** (abre no PRD). Steps: lista numerada, cada step com os relatórios do revisor (`Review 1 · changes`), que abrem com **← Steps**. Faixa: datas, `N steps`, `#N ↗` | `history/ArchivedTaskView.tsx` |
| Task One-Shot | Igual, com `One-Shot` | O documento One-Shot, com os relatórios do step acima dele e **← One-Shot** | `task/OneShotView.tsx` |
| Review | `#N`, título, repositório, card, `Merged`/`Closed`, **Open on GitHub** | Um bloco por passada registrada, `Review N · clean/changes · published`; publicada: o veredito, a data, o link e cada apontamento publicado com `arquivo:linha · Inline comment / In the review body`; depois o relatório renderizado. Sem passada: `No report was written.` | `reviews/ArchivedReviewView.tsx` |
| Discussão | `Discussion`, título, board | Uma página só, rolando: **Document** (ou `No document was written.`), **Drafts** (cada um `New card`/`Update`/`Epic`, título, `Created`/`Updated`/`Not published`, `dono/nome#N ↗`; épico em grupo com os cards recuados) e **Conversation**, a conversa inteira somente leitura, sem compositor | `discussion/ArchivedDiscussionView.tsx` |

O que a task arquivada **não** mostra, embora `features §Histórico` diga que mostra "a pull request e o resultado do encerramento": o rascunho da PR, os relatórios do review da PR e o resultado do encerramento. `ArchivedTask` só traz `pr` (número, URL, estado) (`internal/bindings/dto.go` `ArchivedTask`). O resultado está guardado (`pr_runs.close_result`, JSON de `CloseResult`) e não é exposto. As conversas de task e de review não são guardadas no arquivamento; a da discussão é (`features §Histórico`).

### 3.3 O resultado do encerramento

Três partes, cada uma feita, pulada com a razão, ou falhou com o detalhe (`task/pr-status.ts` `closeStepLabel`; `features §Encerramento e arquivamento`):

| Parte | Feita | Pulada | Falhou |
|---|---|---|---|
| Worktree | `Worktree removed` | `Worktree was already gone` | `Worktree couldn't be removed: <detalhe>` |
| Branch | `Branch <nome> deleted` | `Branch <nome> kept: git doesn't see it merged into <base>` ou `Branch <nome> was already gone` | `Branch <nome> couldn't be deleted: <detalhe>` |
| Base | `<base> updated by N commits` | `<base> was already up to date`; `<base> not updated: another branch is checked out` / `the branch doesn't exist locally` / `the repository has uncommitted changes` / `it tracks no remote branch` / `it has commits the remote doesn't` | `<base> not updated: <detalhe>` |

E `Closed on <data e hora>`. Hoje aparece só no painel da PR, e a task é arquivada logo depois, então o usuário o vê de relance ou nunca (`task/PRPane.tsx`). Decidido: a página do item que saiu traz o resultado (`structure §1`; `task.md` §12).

---

## 4. Início, boas-vindas e migração

| Tela | Quando | O que mostra hoje | Decidido |
|---|---|---|---|
| Início | Antes do primeiro estado (`app === null`) | Janela vazia, sem marca nem indicador. Se `GetState` falha, fica assim para sempre | `Starting MySpec…` com os passos nomeados e o tempo de um passo lento; a lateral em esqueleto (`structure §7`) |
| **MySpec couldn't be updated** | Ao abrir um banco de uma versão com áreas de trabalho que não pode ser migrado. Toma a janela inteira, sem lateral e sem atalhos | Marca, título, `This version keeps every task in a registered repository, one repository per task. Some of your tasks can't be carried over, so nothing was changed: your tasks, documents and worktrees are as they were, and the previous version still opens them.` Os casos por tipo, cada um com título, o que fazer e a lista (repositório ou caminho, detalhe, tasks com `área · caminho`). Rodapé `Once they're resolved, open this version again and the update runs again.` Sem ação | Na janela inteira, sem a lateral (`structure §7`) |
| Casos da migração | — | `Tasks at the root of a workspace` · `Close or delete these tasks in the previous version of MySpec.`; `Repositories without an origin on GitHub` · `Add a GitHub origin to the repository, or delete its tasks, in the previous version of MySpec.` (com o motivo da recusa do clone); `Tasks with the same name in the same repository` · `Delete one of the tasks in the previous version of MySpec.` | `migration/migration-text.ts`; `features §Dados de uma versão com áreas de trabalho` |
| Boas-vindas | Sempre que nenhum board e nenhum repositório estão cadastrados: na primeira execução e também depois de remover o último | Marca, `MySpec`, `Register a board or a repository to start creating tasks.`, **Add board** (primário) e **Add repository** (contornado), que abrem os diálogos do §2.1 e §2.4. Sem lateral, sem tema, sem atalhos (`Ctrl+N`, `Ctrl+J`, `Ctrl+,` inertes) | Welcome com **Add board** e **Add repository**; a lateral só com o topo e o rodapé (`structure §7`) |
| Depois do primeiro cadastro | O estado troca a tela sozinho | Sem task, a Home atual mostra a visão do primeiro board | A Home com `Nothing in progress` e as ações de início (`board.md` §10, Tela de boas-vindas); a primeira leitura mostra `reading…` na árvore e na Home (`structure §7`) |

A migração é de uma versão antiga: o banco do usuário já está migrado (sem tasks fora de repositório, §7). O código (`internal/upgrade/upgrade.go`) continua e a tela é uma feature preservada (`brief §9`).

---

## 5. Avisos, notificações, som e flash

### 5.1 O aviso genérico (`Something went wrong`)

| Fato | Fonte |
|---|---|
| Faixa fixa no topo da janela, centrada, até 43rem, **sobre** o conteúdo, com ícone de aviso, `Something went wrong`, a mensagem e **Dismiss** (×). Fica até ser dispensada. `role="status"` | `app/App.tsx`, `notice/Notice.tsx` |
| Uma por vez: a próxima falha substitui a anterior | `store/app-store.ts` `setError` |
| Vem de toda ação que passa por `run()`: enviar mensagem, pausar, retomar, **Retry**, aprovar, continuar, voltar e descartar etapa, descartar step, apagar task e review, trocar modelo, modo de review, filtro, tema, pasta de clones, remover repositório, ler a prévia de remover board, ler o contexto de um card, entre outras | `store/actions.ts` |
| Não vem: as ações que mostram a recusa onde o usuário está (varredura e cadastro de repositório, **Change path**, **Clone**, board, criação de task, início de discussão) | `store/actions.ts`, comentários |
| O mesmo componente aparece local, dispensável, no prompt, nos arquivados e na prévia de apagar | `settings/PromptPane.tsx`, `history/*`, `task/DeleteTaskDialog.tsx` |
| Decidido: faixa no topo **da área principal**, véu de erro com o trilho, rótulo vermelho em 700, detalhe, **Dismiss**, `role="alert"` | `components.md` Toast e aviso; `structure §7` |

### 5.2 `Some files stayed on disk`

Na mesma faixa do topo, até ser dispensado: `Some files stayed on disk` · `The task is gone, but git couldn't remove everything:`, o caminho, a branch e o erro do git em mono (`notice/LeftoversNotice.tsx`). Vem de apagar uma task **e** de apagar um review (`store/actions.ts` `deleteReview`), e nos dois casos diz "The task is gone". Decidido: no apagamento com o item aberto, a página do item que saiu diz o que ficou no disco e o que fazer (`structure §1`).

### 5.3 O aviso de arquivamento

Toast embaixo, no centro da janela: ícone, `“<nome>” was archived.`, **Open in history**, ×; some sozinho em 10 s (`notice/ArchivedNotice.tsx`). Só para tasks: um review encerrado pelo merge e uma discussão arquivada não geram aviso (`store/app-store.ts` `newlyArchived` olha só `history`). Aparece com o item aberto ou não. Decidido: toast só para um item que saiu **sem** estar aberto, embaixo à esquerda da área principal (`components.md` Toast e aviso; `structure §1`).

### 5.4 Notificações do sistema

`internal/app/notifications.go`, `internal/attention/text.go`, `internal/attention/service.go`, `internal/platform/notify/notify.go`, `features §Depende de mim`.

| Fato | Detalhe |
|---|---|
| Quando | Só com a janela fora de foco, uma vez por situação, ao começar. Continuações da mesma espera não notificam |
| Canal | D-Bus, `org.freedesktop.Notifications`, direto, sem o Wails. App `MySpec`, `desktop-entry` `org.wails.myspec`, expiração a do servidor |
| Título | O nome da task (`40-conflito-ou-check-que-falha-depois-do-review-tira-a-pr-do`), `dono/nome#N` do review, o título da discussão |
| Clique | Uma ação padrão `Open`. Traz a janela e abre o lugar da situação (a aba do revisor inclusive). Situação já encerrada: abre o item se ele existe; senão a janela fica onde estava. Com um prompt não salvo, pede antes `Discard your changes?` |
| Retirada | Quando a situação acaba, a notificação sai da tela. Ao fechar o app, as que ele mostra saem (`service.go` `Close`) |
| Sem servidor | Nada falha: a situação aparece no app, a razão vai ao log |

Corpo por situação:

| Situação | Corpo |
|---|---|
| Pergunta, permissão, resposta, erro de sessão (planejamento, step, PR, review, discussão) | `The agent has a question in <lugar>.`, `Permission requested in <lugar>.`, `The agent is waiting for your reply in <lugar>.`, `The session stopped with an error in <lugar>.` (`<lugar>`: `PRD`, `tech spec`, `plan`, `One-Shot planning`, `step 3`, `the pull request`, `the review`, `the discussion`) |
| Revisor do step | `The reviewer of step N asks for a permission.`, `… has a question.`, `… stopped without writing its report.`, `The review of step N stopped with an error.` |
| `plan_invalid` | `The plan is still invalid after automatic corrections.` |
| `ready_to_continue` | `The <etapa> is revised and ready to continue.` / `The One-Shot document is revised and ready to continue.` |
| `step_blocked` | `Step N can't start: <razão>.` (`the worktree has uncommitted changes`, `couldn't fetch origin`, `no base branch`, `the worktree folder already exists`, `the branch already exists`, `the clone of the repository is missing`, `git failed`) |
| `worktree_unreadable` | `Step N: the worktree can't be read.` |
| `step_review` | `Step N is ready for review.`; `Step N: the last approval didn't produce a commit.`; `Step N: the agent review didn't come clean after three rounds.` |
| `step_empty` | `Step N finished without changes.` |
| `pr_blocked` | `The pull request is blocked: <razão>.` |
| `pr_closed` | `The pull request was closed without a merge.` |
| `draft` | `The pull request draft is ready for your OK.` |
| `findings` | `The review of the pull request found changes for you to decide.` |
| `changes_review` | `The changes from the review of the pull request are ready for review.` / `The last approval of the pull request didn't produce a commit.` |
| `pr_trouble` (task e review) | `A check failed after the review: <check>.` / `Checks failed after the review: <a>, <b>.` e `The pull request has a conflict with <base>.` |
| `merge` | `The pull request is ready to merge.` / `… ready to close.` |
| Review: relatório | `The review has findings for you to decide.`, `The review is ready to publish.`, `The approved findings are ready to apply.`, `The reviewer stopped without a report the app can read.` |
| Review: outros | `The review couldn't be published.`, `The next pass of the review couldn't start.`, `The pull request has new commits since your review.` |
| Discussão | `There are drafts to decide in the discussion.`, `The agent wrote drafts the app can't read in the discussion.`, `The drafts couldn't be published.` |
| Decididas, ainda sem texto | Discussão: `Epic can't publish`, `Epic discarded`, `Ready to archive` (esta notifica) (`discussion.md`, barra e "Situações novas") |

`journeys.md` §2.1 diz "—" para o corpo de `new_commits`, `pr_trouble` e `pass_blocked`; hoje os três têm corpo.

### 5.5 O som

O carrilhão do MySpec (`chime.wav`, embutido e copiado para `~/.local/share/myspec/sounds/`), tocado pelo servidor de notificação quando ele toca sons, ou pelo app. Uma notificação a menos de 2 s da última que tocou chega muda. Não perturbe é consultado no shell do Omarchy, no KDE Plasma, no dunst e no swaync; em outro, não se sabe. Clique, dispensa e retirada não tocam. Sem configuração: volume e não perturbe são os do sistema (`features §Depende de mim`; `internal/platform/chime`, `internal/platform/dnd`, `notify.go` `burstWindow`).

### 5.6 O flash

Situação que nasce com a janela em foco: a linha da árvore, a linha sob **Reviews** e a aba `Implementer`/`Reviewer` piscam 1.600 ms na cor do tom (âmbar, ou vermelho no erro), em silêncio (`lib/situations.ts` `FLASH_MS`, `styles/globals.css` `.attention-flash`, `sidebar/SidebarTree.tsx`, `task/StepTabs.tsx`). Decidido: pisca onde é visível (a linha, o bloco da faixa recolhida ou o resumo do nó recolhido, a aba da outra conversa, a barra do pedido); o cartão ou a barra que nasce com a tela aberta pisca duas vezes no véu da gravidade; sem piscada com `prefers-reduced-motion`; anúncio `aria-live` uma vez por situação (`structure §2`, `task.md` §6).

---

## 6. O item que some do estado

| Caso | Hoje | Decidido |
|---|---|---|
| Task encerrada com a tela aberta | A área vai a Home, e o toast `“<nome>” was archived.` aparece (`store/app-store.ts` `applyState`; `home/Home.tsx`) | Página `This task was closed and archived.` com o resultado e **Open in History** (`task.md` §12; `structure §1`) |
| Task apagada com a tela aberta | A área vai a Home; o que ficou no disco vai à faixa do topo | `This task was deleted.` com o que ficou no disco e o que fazer (`task.md` §12; `structure §1`) |
| Review encerrado pelo merge ou fechado, aberto | A área vira o review arquivado, dentro do History, sem aviso (`reviewPlace`) | Página do review que saiu (`review.md` §15) |
| Discussão arquivada, aberta | A área vira a discussão arquivada, dentro do History (`discussionPlace`) | Página da discussão que saiu, arquivada (`discussion.md` §11) |
| Review ou discussão apagados, abertos | A área vai a Home | Página do item apagado (`review.md` §15; `discussion.md`) |
| Board removido com a visão aberta | A área vai a Home (`openBoardId` limpo) | `This board was removed.`, com a volta ao lugar anterior (`board.md` §3.8) |
| Arquivado aberto que some (apagado de outro lugar) | Área vazia (`ArchivedTaskView` etc. devolvem uma `section` vazia) | Nada decidido |
| Item que sai sem estar aberto | Só o toast, e só para task | Só um aviso momentâneo, para qualquer item (`structure §1`) |
| Card fora da última leitura | — | Decidido em `board.md` §3.9 |

Todas as páginas decididas oferecem **Open in History** (menos no apagado), a volta e **Next that needs you** `Ctrl J` com o foco (`structure §1`, `review.md` §15, `discussion.md`).

---

## 7. Volume real

Do banco `~/.local/share/myspec/myspec.db` (cópia lida em 2026-09-24) e da pasta de dados.

| O quê | Valor |
|---|---|
| Boards | 2: `Faturamento IA` (organização, 10 status, 3 finais, 121 cards, 11 repositórios) e `Pessoal` (usuário, 4 status, 1 final, 9 cards, 1 repositório). Última leitura sem falha nos dois |
| Status de cards novos | `None` nos dois, embora `A Fazer` e `Ready` existam e fossem pré-selecionados hoje: os dois boards são anteriores à escolha |
| Repositórios | 12, todos com board; nenhum em **No board**. 10 com clone, 2 `Not cloned` (`flow-internacao-cid`, `flow-internacao-clinica-dspy`), 0 com clone inexistente |
| Repositórios que não se removem | 6 de 12, por tasks ou reviews |
| Instruções de review | 0 de 12 |
| Pasta de clones | Não escolhida |
| Clones na home (aproximado pela varredura de `find` a 6 níveis) | 14, dos quais 10 cadastrados: o diálogo de cadastro mostraria 4 disponíveis e 10 `Registered` |
| Defaults | Modo de review `Agent` (fábrica: `Manual`); 6 de 9 modelos mudados do padrão de fábrica (Opus 5.5 (1M) xhigh no PRD, tech spec e One-Shot; medium no plan e na implementação; Fable 5.1 high no PR review) |
| Catálogo | 4 modelos; Haiku 4.5 sem esforço; os outros com `low`, `medium`, `high`, `xhigh`, `max` |
| Prompts editados | 0 de 9 (pasta `prompts/` vazia) |
| Tema | Fixado em `dark` |
| Ativos agora | 0 tasks, 4 reviews, 0 discussões |
| History | 44 itens em 12 dias (12 a 24 de setembro): 22 tasks (14 Structured, 8 One-Shot), 12 reviews (todos `Merged`, de 1 a 3 passadas), 10 discussões (de 1 a 4 rascunhos). 38 dos 44 nos últimos 8 dias |
| Nomes no History | Task: até 61 caracteres (média 27); título de review: até 98; título de discussão: até 35 |
| Encerramentos | 22 de 22 com worktree e branch removidas; a base atualizada em 14, pulada em 8 (`another branch is checked out` 4, `already up to date` 4); nenhuma falha |

---

## 8. O que está decidido e vale reaproveitar

| Peça | Onde foi decidida | Serve aqui para |
|---|---|---|
| **Diálogo de criação largo**: `--size-dialog-wide`, a 8% do topo em pixel inteiro, cresce para baixo, rodapé afundado com a razão ao lado do primário, **Cancel** fantasma e o primário `Ctrl ↵`; foco no primeiro campo, preso; erros da confirmação no rodapé, o diálogo fica aberto | `board.md` §4.1, §4.6; `review.md` §3 | Add board em etapas, Add repository |
| **Diálogo mínimo**: título com ×, um parágrafo do que acontece, uma linha apagada com a consequência secundária, **Cancel** e o primário ou o destrutivo; o que é opcional atrás de um clique (**Add instructions**) | `review.md` §12; `discussion.md` §11 | Remove board, Remove repository, Discard step, Back/Discard, Restore prompt, Discard changes |
| **Diálogo de confirmação** do sistema: foco começa em **Cancel**; confirmando com o verbo no gerúndio e **Cancel** desabilitado; falha no rodapé com **Try again**; "diga exatamente o que será perdido e o que fica" | `components.md` Diálogo | Todas as confirmações destrutivas |
| **Nota afundada** no alto de um diálogo (o que a ação descarta) | `review.md` §11, §12, §20 | Edit board (repositório desmarcado), Delete task (PR aberta) |
| **Popover Review mode** (duas opções em `radiogroup` com ícone, nome e o que faz: `An agent reviews each step with the implementer; clean steps are committed.` / `You review each step in VS Code, stage the files and approve.`) e **Popover Models** (uma linha por etapa, chip de modelo que abre um `listbox`, estados editável, salvando, indisponível `◇`) | `task.md` §10 | Defaults |
| **Chip de modelo e `listbox`**, com `◇ unavailable`, `Reading models…` e a falha do catálogo | `task.md` §10; `board.md` §4.5 | Defaults |
| **Controle segmentado** (`radiogroup`, `←` `→`) | `board.md` §4.2 | Modo de review em Defaults; tipo de item no History |
| **Linha de lista** com colunas de largura fixa, segunda linha abaixo de 1040 px, teclas visíveis no foco; **cabeçalho de seção** recolhível; **barra de filtros** (busca com `/`, **Filter** com grupos, chips com ×, **Clear filters**); **esqueleto de lista**; **estado vazio de página** | `board.md` §3.3, §3.4; `review.md` §2.3, §2.4 | History; linhas de Boards e Repositories |
| **Faixa de falha de leitura**, afundada, `◇`, quando falhou, **Try again**, nunca vermelha; **idade da leitura** (`Read 2m ago`) | `board.md` §3.8; `review.md` §2.7, §13 | Linha do board em Settings |
| **Linhas de bloqueio** da Home: `◇ <repo> isn't cloned. …` com **Clone**, `◇ The clone at … is missing.` com **Change path…**, falha com **Try again** | `board.md` §2.2 | Repositories em Settings (mesmos textos e ações) |
| **Painel do card** e **painel da PR** (`--panel-card-width`, ao lado da lista enquanto ela tem 440 px) | `board.md` §3.5; `review.md` §2.5 | Um arquivado aberto ao lado da lista do History, se o designer quiser |
| **Marco em linha** que abre o conteúdo no lugar, com **Open in …** ao pé; **faixa da conversa anterior** (`… It takes no more messages.`) | `task.md` §6, §10 | Conversa somente leitura da discussão arquivada; documentos do arquivado |
| **Página do item que saiu**: ícone neutro, título em `--text-title`, o que aconteceu, o resultado num bloco afundado uma linha por parte, **Next that needs you** primário com foco, **Open in History**, a volta | `review.md` §15; `discussion.md` §11; `structure §1` | Task encerrada (resultado do encerramento), task apagada (o que ficou no disco), board removido |
| **Toast** só para item que saiu sem estar aberto; **aviso do app** no topo da área principal com o trilho | `components.md` Toast e aviso | §5.1 a §5.3 |
| **Botão desabilitado** tracejado com a razão ao lado (`aria-describedby`) | `structure §3`; `components.md` | Remove repository, Continue, Add board sem URL |
| **`⋯` do board** com **Edit the board in Settings…** | `board.md` §3.2 | Entrada do Edit board a partir do board |
| **Barra do pedido** `ready_to_continue` com **Continue**; `step_empty` e `pr_closed` repetindo **Discard step N…** e **Delete task…** | `task.md` §7 | Os diálogos de Back/Discard/Delete partem daí e do `⋯` |

---

## 9. Divergências entre o código e o que está escrito

| Onde | Fato | Fonte |
|---|---|---|
| Task arquivada | Não mostra o resultado do encerramento nem os relatórios do review da PR, que `features §Histórico` promete | `ArchivedTaskView.tsx`; `dto.go` `ArchivedTask` |
| Fechar Settings | Vai a Home | `closeSettings` × `structure §1` |
| Falha de leitura na página Boards | Vermelha | `BoardRow.tsx` × `board.md` §3.8 |
| `Some files stayed on disk` | Diz `The task is gone` também ao apagar um review | `LeftoversNotice.tsx`; `actions.ts` `deleteReview` |
| Aviso de arquivamento | Só para tasks | `app-store.ts` `newlyArchived` |
| Bloco da PR no Delete e no Back/Discard | Diz `stays open on GitHub` com a PR mergeada | `OrphanPRs.tsx` |
| Remove repository | Não diz que o repositório sai do board | `RemoveRepositoryDialog.tsx` × `features §Página Repositories` |
| Edit board | Desmarcar um repositório não diz que ele vai a **No board** ou sai do produto | `BoardDialog.tsx` × `features §Editar e remover um board` |
| Back/Discard | A lista do que se perde não cita o que a etapa de PR criou | `stage-actions.ts` × `features §Voltar e descartar` |
| Repositories | Sem estado vazio | `RepositoriesPage.tsx` |
| Início do app | Janela vazia; `GetState` que falha a deixa vazia para sempre | `App.tsx`, `bootstrap.ts` |

---

## 10. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| `CloseResult` no `ArchivedTask` | O resultado do encerramento no History e na página da task que saiu | Pequeno: está em `pr_runs.close_result` (`structure §8` já lista) |
| Os relatórios do review da PR no `ArchivedTask` | O review da PR de uma task arquivada | Pequeno, se os arquivos ficam na pasta de artefatos (não verificado) |
| O que o apagamento deixou, ligado ao item | A página do item apagado | Pequeno (`structure §8`); hoje só `Leftover` avulso |
| A consequência de desmarcar um repositório no Edit board (vai a No board ou sai) | A nota do Edit board | Pequeno: a mesma regra de `previewRemoveBoard`, por repositório |
| Um aviso de arquivamento para review e discussão | O toast do item que saiu sem estar aberto | Só frontend: `reviewHistory` e `discussionHistory` já chegam |
| O progresso do início do app | `Starting MySpec…` com passos | Pequeno (`structure §8`) |
| Desde quando está pausado | A barra e a pílula | Pequeno (`structure §8`) |
| Os corpos das situações novas da discussão (`Epic can't publish`, `Epic discarded`, `Ready to archive`) | Notificação | Pequeno, junto das situações (`discussion.md`) |

---

## 11. Perguntas para o usuário

Só as que mudam uma decisão de design e que os docs, o código e o banco não respondem.

1. **Para que você abre o History?** Reler um documento de uma task recente (o PRD, o tech spec), achar a PR ou o card de algo que já foi, ver o que uma discussão publicou, ou apagar? O History cresce cerca de 4 itens por dia (44 em 12 dias) e a entrevista diz que é raro. A resposta decide se a lista se organiza por tempo (hoje, esta semana, antes), por tipo ou por repositório, e o que um arquivado mostra primeiro ao abrir.
2. **Você usa o filtro por repositório?** Hoje o History usa o mesmo filtro da árvore: mudar um muda o outro. No banco, o filtro está em `All repositories` desde 17 de setembro, e todos os 12 repositórios estão em dois boards, que a árvore já separa. A resposta decide se o History ganha um filtro próprio, junto da busca, ou continua preso ao da árvore.
