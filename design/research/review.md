# O centro de review e a tela de um review

Levantamento para a terceira tela da fase 4: o centro de review (a lista de pull requests) e a tela de um review de PR de terceiros (`design/README.md`, Fases, 4.3). Levantado em 2026-09-24. Não propõe design.

Complementa, sem repetir: `brief.md` §3 e §4 J6; `structure.md` §2 (linha da árvore), §3 (barra do pedido, coluna de decisão, painéis) e §4 (Reviews); `screens/task.md` (a conversa, a barra do pedido, o compositor e o cartão de apontamentos já decididos para a PR da task, §9); `research/screens.md` §2.5 e §2.6; `research/journeys.md` §1.7, §2.1 e §4.5; `research/conversation.md` §3 e §4 (a sessão `review`).

Fontes: `features §X` = seção de `docs/product/features.md`; caminhos de código relativos à raiz; `banco` = `~/.local/share/myspec/myspec.db`, lido em 2026-09-24 às 19h, somente leitura.

## 0. O que mais pesa para o design

| Achado | Fonte |
|---|---|
| **Volume baixo.** 13 reviews em 7 dias (18 a 24/09), 17 passadas; hoje há 8 PRs abertas nos 12 repositórios cadastrados, só uma com label (`dependabot`) e uma em draft. | banco; `gh pr list` nos 12 repositórios |
| **Metade das passadas com apontamentos tem 1 ou 2.** 8 de 17 passadas são limpas; nas 9 com `changes`, mediana 2 apontamentos, máximo 15. | banco, §3 |
| **O review também é consulta, não só publicação.** 5 de 13 reviews terminaram (merge) sem publicar a última passada; as instruções mais comuns são `can we merge safely?` (dependabot, três reviews iniciados em 45 s). Um review não publicado continua esperando o usuário (`Decide findings` ou `Ready to publish`) até o merge. | banco; `internal/reviewflow/state.go` `publishStatus` |
| **O usuário quase não edita o texto.** 1 de 36 apontamentos editado (um parágrafo cortado). O resumo é editado em 6 de 17 passadas, e 4 dessas o **apagam inteiro** para aprovar só com o veredito. | banco (`original` × `text`, `summary_original` × `summary`) |
| **Aprovar é a decisão dominante.** 22 aprovados, 9 descartados, 5 nunca decididos. Das passadas publicadas, só 2 apontamentos descartados em 24. | banco |
| **Um apontamento não tem título nem gravidade.** O formato é `### N`, `Location: path:line` ou `general`, e o texto em Markdown (mediana 650 caracteres, até 1,5 mil, com código inline em quase todos). O título que o agente puser depois do número é descartado. | `internal/prompts/prompts.go` `findingsFormatNote`; `internal/prreview/report.go` `parseFinding` |
| **Apply nunca foi usado.** Os 13 reviews são `publish`; o único de PR própria (`medflow#447`) foi `publish` e nunca publicado. | banco |
| **Instruções fixas por repositório: nenhuma definida** em 12 repositórios; o usuário escreve instruções por passada em 12 de 17. | banco `repositories.review_instructions`, `review_passes.instructions` |

## 1. A lista de PRs (visão Reviews)

### 1.1 Anatomia hoje

`features/reviews/ReviewsView.tsx`, de cima para baixo: `ReviewsHeader` › `ReadFailures` › `ReviewsFilterBar` › lista (`PullRequestRow`).

| Região | Conteúdo | Arquivo |
|---|---|---|
| Cabeçalho | `Reviews`; `Updated <relativo>` (relógio de 1 min); spinner `Reading pull requests`; **Refresh** (ícone, desabilitado durante a leitura) | `ReviewsHeader.tsx` |
| Falhas | Uma linha `role="alert"` por repositório: `<dono/nome>: <mensagem>` | `ReadFailures.tsx` |
| Filtros | **Board** (boards + `No board`), **Repository**, **Author** e **Label** (tri-estado, menu fica aberto), **Pending only**, **Clear filters** (só filtrando) | `ReviewsFilterBar.tsx`, `MultiFilterMenu.tsx`, `reviews-view.ts` |
| Lista | `ul` rolável, sem virtualização nem agrupamento; ordem do Go: pendentes primeiro, depois `updatedAt` desc | `ReviewsView.tsx`; `dto.go` `ReviewCenter` |

### 1.2 A linha, campo a campo (`PullRequestRow.tsx`)

| Linha 1 | Linha 2 | Direita |
|---|---|---|
| Ponto `Pending` (tom de atenção, com `sr-only`) só na pendente; `#N`; título (trunca); `Draft`; `Task`; o estado do review ativo (ponto + `reviewStatusLabel`) | Nome curto do repo (tooltip `dono/nome`); autor; até 3 labels (sem cor) e `+N`; card `#N · <status>` (link para a issue); `New commits` (atenção) ou `Reviewed` | Ícone **Open on GitHub**; o botão da ação |

A linha pendente tem fundo tingido de atenção (`bg-[var(--status-attention)]/5`).

**Ação** (`PullRequestRow.action`, `review-status.ts` `actionLabel`/`actionHint`):

| `action` | Botão | Estado |
|---|---|---|
| `review` | **Review** | abre o diálogo de início |
| `clone` | **Review** | abre o diálogo, que oferece **Clone and continue** |
| `clone_missing` | **Review** | desabilitado; tooltip com o aviso do clone |
| `fork` | **Review** | desabilitado; `Pull requests from forks can't be reviewed yet.` |
| `open_review` | **Open review** | abre o review ativo |
| `open_task` | **Open task** | abre a task dona da PR |

### 1.3 Estados de uma PR na lista

| Estado | Como se sabe | Como aparece |
|---|---|---|
| Nunca revisada | `reviewed = false` e não é própria nem de task | Pendente: ponto, fundo, conta no nó |
| Commits novos | `reviewed` e o head difere do commit do último review da conta do `gh` (`pulls.PullRequest.NewCommits`) | Pendente; `New commits` em atenção |
| Revisada | `reviewed` sem commits novos | `Reviewed` |
| Review ativo | `reviewId` | Estado do review na linha 1; ação **Open review** |
| Própria | `own` (autor = conta do `gh`) | Nunca pendente; **nenhum rótulo diz que é sua**; o diálogo oferece o modo Apply |
| De uma task | `taskId` | `Task`; nunca pendente; **Open task** |
| Draft | `draft` | `Draft`; **conta como pendente** (a regra não exclui draft: `internal/pulls/filters.go` `Pending`) |
| Checks | — | **A lista não lê nem mostra checks**; só o review ativo os lê (seção 2) |

"Revisada" conta qualquer review enviado pela conta do `gh`, pelo produto ou no site; o pedido de review do GitHub não é lido (`features §Pendente de review`; query `prFragment` em `internal/pulls/github.go`).

### 1.4 Leitura periódica e falhas

| Leitura | Quando | Fonte |
|---|---|---|
| PRs abertas de todos os repos | Ao abrir o app, ao abrir a visão (`useEffect` em `ReviewsView`), **Refresh**, depois de publicar, e a cada 5 min (5 ticks de 1 min) | `internal/app/poll.go` `pullsRefreshTicks`; `reviewflow/publish.go` |
| PRs com review ativo | A cada minuto, com checks do head e mergeabilidade | `app/poll.go` `reviewFlow.Poll()` |
| Limites | 100 PRs abertas por repo, 20 labels por PR, 15 repositórios por query GraphQL | `pulls/github.go` |

A leitura fica em memória; a visão mostra a anterior enquanto a próxima corre. Uma falha por repositório mantém a lista anterior dele (`RepositoryReading.Failure`). As seis mensagens estão em `features §Leitura das pull requests`.

| Estado da visão | Texto |
|---|---|
| Primeira leitura | 6 linhas de esqueleto |
| Sem repositórios | `Register a repository to see its pull requests.` |
| Sem PRs | `No open pull requests.` |
| Filtros sem resultado | `No pull requests match the filters.` + **Clear filters** |

### 1.5 DTOs (`internal/bindings/dto.go`)

| DTO | Campos | Chega e não é mostrado |
|---|---|---|
| `ReviewCenter` | `pullRequests[]`, `failures[]`, `readAt`, `reading`, `filters`, `pendingCount` (pendentes que passam pelos filtros), `authors[]`, `labels[]` | — |
| `PullRequestRow` | `key`, `repositoryId`, `repository`, `boardId`, `number`, `title`, `url`, `author`, `labels[]{name,color}`, `draft`, `own`, `card`, `reviewed`, `newCommits`, `pending`, `filtered`, `taskId`, `reviewId`, `action`, `updatedAt` | `updatedAt`, a cor da label, `own` |
| `PullCard` | `boardId`, `number`, `title`, `url`, `status` | `title` (só no tooltip do cabeçalho do review) |
| `ReviewFilters` | `boardId` (`__none__` = sem board), `repositoryId`, `authorsInclude/Exclude`, `labelsInclude/Exclude`, `pendingOnly` | — |

**O backend não lê** (e custaria um campo na query GraphQL): data de criação, tamanho (`additions`, `deletions`, `changedFiles`), número de commits, estado dos checks, pedido de review, comentários. Amostra real de hoje: 3 a 8 checks por PR (nomes com emoji: `🧪 E2E`, `✨ Lint`), E2E em torno de 5 min; PRs de +134 a +1.595 linhas.

### 1.6 O nó Reviews na árvore (`features/sidebar/ReviewsNode.tsx`)

`Reviews` com a contagem de pendentes filtradas (`N`, nome acessível `N pending`); dentro, os reviews ativos em ordem de criação, cada um com ponto, `<repo>#<N>`, o rótulo à direita (a situação, ou o estado) e o título na segunda linha. Máximo de 5 linhas antes de rolar. Não passam por nenhum filtro. `structure.md` §2 já fixa a posição `pass 1 · 5/9` para a linha nova.

## 2. A tela de um review, de ponta a ponta

### 2.1 Anatomia hoje (`features/reviews/ReviewView.tsx`)

`ReviewHeader` › `ReviewBar` › painéis redimensionáveis: à esquerda (60%, mínimo 40%) a faixa de stage do Apply (`ReviewStrip`), o `FindingsPanel`, a conversa e o compositor; à direita (40%, recolhível) `ReportsPanel`. Sem review no estado, a tela fica **vazia sem mensagem**.

| Região | Conteúdo |
|---|---|
| Cabeçalho | Ícone PR, `#N`, título, repo (badge), autor, card (`PullCardBadge`: `#N` com o título no tooltip, e o status), modo (`Publish`/`Apply`), estado (ponto + rótulo), medidor de contexto, **Pause**/**Resume** (só com sessão), **Reports**, **Delete review** |
| Barra | `#N` ↗ (abre a PR), estado (`role="status"`), avisos (tabela 2.4), **Publish review** ou **Apply** + **Approve**, **Review again**, **Open in VS Code** (desabilitado, `The worktree doesn't exist yet`) |
| `FindingsPanel` | Recolhível, altura máx. 50dvh, largura de leitura 58,5rem; só a **última passada registrada** (seção 2.6) |
| `ReportsPanel` | Lista `Context`, `Review N · clean/changes[ · published]`; aberto, o Markdown do arquivo, com `Published · <veredito> · <data>` e **Open on GitHub** |

### 2.2 Iniciar (`StartReviewDialog.tsx`; `internal/reviewflow/start.go`)

| Elemento | Detalhe |
|---|---|
| Resumo | `#N título` e `repo · autor · #card` |
| **Instructions** | Opcional, `What to look at in this pass. Optional.`; `Ctrl+Enter` inicia |
| **Model** | `ModelPicker`, parte do padrão `pr_review` das configurações; vale para o review inteiro, trocável na conversa |
| **Mode** | Só se `row.own`: `Publish`/`Apply`, parte de `Publish`, com a linha do que faz. Fixo depois |
| Sem clone | `<repo> isn't cloned yet. The review needs a clone to work in.` e **Clone and continue**; o diálogo reabre sozinho ao fim do clone (`usePendingReview.ts`) |
| PR fora da leitura | `This pull request isn't in the last reading.` |
| Recusas ao confirmar | PR não está mais aberta, fork, PR de task ativa, review ativo existente (`start.go` `startable`); qualquer falha antes da conversa desfaz o review |
| O diálogo **não mostra** | Se o repositório tem instruções fixas de review |

Ao confirmar: worktree em detached HEAD no head da PR, `context.md` (título, link, autor, branches, descrição ou `noDescription`, e o card com épico), conversa aberta com o prompt de review de PR.

### 2.3 Estados do review (`internal/reviewflow/state.go`; `review-status.ts`)

A conversa trabalhando prevalece: `Reviewing`, ou `Applying`/`Committing` no Apply.

| `status` | Rótulo | Modo | Tom hoje | Situação (`derive_review.go`) |
|---|---|---|---|---|
| `reviewing` | `Reviewing` | ambos | working | — |
| `waiting_checks` | `Waiting for checks` | ambos | working | — |
| `pass_blocked` | `Pass blocked` | ambos | idle | `pass_blocked` (error) |
| `awaiting_reply` | `Waiting for the report` | ambos | idle | `reply` |
| `awaiting_decision` | `Decide findings` | ambos | idle | `review_report` · `decide` |
| `ready_to_publish` | `Ready to publish` | publish | idle | `review_report` · `publish` |
| `publish_failed` | `Publish failed` | publish | idle | `publish_failed` (error) |
| `published` | `Published` | publish | done | — |
| `new_commits` | `New commits` | publish | idle | `new_commits` |
| `trouble` | `Checks failed: a, b · conflict with dev` | ambos | idle | `pr_trouble` |
| `ready_to_apply` | `Ready to apply` | apply | idle | `review_report` · `apply` |
| `applying` | `Applying` | apply | working | — |
| `in_review` | `In review` | apply | idle | `changes_review` · `review`/`staged` |
| `ready_to_approve` | `Ready to approve` | apply | idle | `changes_review` · `approve` |
| `committing` | `Committing` | apply | working | — |
| `ready_to_merge` | `Ready to merge` | apply | idle | `merge` (closing) |

Acima deles, as situações da sessão: `session_error`, `permission`, `question`. Um review tem **no máximo uma situação** (lugar único `review`). Pausado, publicado, esperando checks e arquivado não esperam ninguém (`features §Depende de mim`).

### 2.4 Avisos da barra hoje (`ReviewBar.tsx`)

| Campo do DTO | Texto |
|---|---|
| `stalePass` | `New commits since this pass` |
| `checkError` | `Couldn't check GitHub` (razão no `title`) |
| `publishError` | a razão (vermelho) |
| `passBlocked` | a razão (vermelho) |
| `unreadableReport` | a razão (atenção) |
| `commitFailed` | `The last approval didn't produce a commit.` |

Vários podem aparecer juntos, numa linha só, sem quebra.

### 2.5 Espera dos checks e a passada

| Fase | O que acontece | O que a tela mostra hoje |
|---|---|---|
| Espera | Relê a PR a cada minuto; um check pendente ou mergeabilidade não calculada seguram a passada; sobrevive ao fechamento do app | `Waiting for checks`. **Nenhum check pelo nome, nem há quanto tempo**: o DTO não os traz (`ReviewSummary` não tem checks; `PRCheckedAt` não é exposto) |
| Passada | O agente lê diff e worktree, roda as verificações do repo, investiga checks falhos com `gh`, escreve `review-N.md` | A conversa (seção 2.9) |
| Fim do turno | O produto lê o relatório; ilegível vira `awaiting_reply` com a razão | Marcador `Review pass N written` (sem `clean`/`changes`) |
| Reescrita | Pedido na conversa: o agente reescreve no lugar; o produto mantém texto e decisão dos que não mudaram (`revision` sobe) | Os cartões trocam; o que foi digitado na revisão antiga cai (`useFindingText.ts`) |

Números reais: da criação da passada à publicação, mediana 10 min (5 a 36 min), incluindo checks, agente e decisão (banco, 11 passadas publicadas).

### 2.6 O relatório e o painel de apontamentos

**Relatório** (`prreview/report.go`): front matter com `status: clean|changes` e `pass`; um resumo em Markdown; com `changes`, `## Findings` e blocos `### N` / `Location: path:line` ou `general` / texto. `clean` com apontamento, ou `changes` sem nenhum, é ilegível.

**Painel** (`FindingsPanel.tsx`):

| Parte | Detalhe |
|---|---|
| Gatilho | Chevron, `Review N · changes[ · published]`, `N of M decided` (só com apontamentos) |
| Aberto por padrão | Numa passada não publicada; recolhido numa publicada; reabre a cada passada nova |
| Resumo | `Textarea` editável (não obrigatório: pode ficar vazio); publicado, texto puro |
| Limpo | Só o resumo e `Nothing to change.` |

**Cartão** (`FindingCard.tsx`), um por apontamento:

| Elemento | Detalhe |
|---|---|
| Número | `N.` |
| Localização | Ancorado: `path:line` em mono, botão que abre o VS Code na linha, na worktree do review (`OpenFindingInEditor`). Geral: `General`, texto |
| Texto | `Textarea` com o Markdown cru (não renderizado), salvo com debounce e no blur; **obrigatório** (`ErrEmptyText`) |
| Decisão | `ToggleGroup` **Approve** / **Discard**; clicar na ativa desfaz |
| Publicado | Texto puro (Markdown não renderizado), sem decisão, com `Inline comment`, `In the review body` ou `Not published` |
| Teclado | Nenhum atalho hoje (`A`/`D`/`Alt+↓` existem só em `screens/task.md` §13) |

Decisões e edições são guardadas a cada gesto e sobrevivem ao app (`review_findings.decision`, `.text`; `review_passes.summary`). O painel mostra só a última passada: as decisões e onde foi cada apontamento das passadas anteriores **não aparecem no review ativo**, só no histórico (`ArchivedReviewView.tsx`); o `ReportsPanel` mostra o arquivo do agente, não o texto editado.

### 2.7 Publicar (`PublishDialog.tsx`; `reviewflow/publish.go`; `prreview/body.go`)

| Elemento | Detalhe |
|---|---|
| Habilita | `ready_to_publish`, ou `publish_failed` com tudo decidido (`convert.go` `canPublish`) |
| **Verdict** | Radio `Approve`, `Request changes`, `Comment`; **pré-seleciona o primeiro, `Approve`**, mesmo com apontamentos aprovados. PR própria: só `Comment` |
| Contagem | `3 inline comments · 1 in the body`, ou `The summary and the verdict only`. Conta todo ancorado como inline: a linha que saiu do diff só se descobre ao publicar |
| Commits novos | `The pull request has new commits since this pass. Findings on lines that left the diff go in the review body.` + **Review again instead** |
| Botões | **Cancel**, **Publish** (`Publishing…`) |

O que vai para o GitHub, no head atual:

| Parte | Conteúdo |
|---|---|
| Comentário inline | Cada ancorado aprovado cuja linha está no lado novo do diff, com o texto como o usuário deixou, lado `RIGHT` |
| Corpo | O resumo; depois `**Other findings**` numerado: gerais aprovados, depois ancorados que saíram do diff com `` `path:line` — `` |
| Veredito | O escolhido |
| Vazio | Sem resumo e sem apontamento só publica `Approve`; os outros vereditos são recusados |

Depois: passada somente leitura, PR como `Reviewed` na lista, review `Published`, sem esperar ninguém. Falha: nada se perde, `Publish failed` com a razão, **Publish review** de novo. **Nenhum marcador entra na conversa** ao publicar nem ao decidir.

### 2.8 Review again, commits novos e checks depois da publicação

| Evento | Estado | Canal | Notifica |
|---|---|---|---|
| Commit depois da publicação | `new_commits` | barra, linha na árvore e na lista (`New commits`) | Sim |
| Commit antes de publicar | fica no estado; `New commits since this pass` | barra, diálogo de publicação | Não |
| Check falho ou conflito novo depois de `Published`/`Ready to merge` | `trouble` | barra com os checks pelo nome, árvore, lista | Sim, uma vez |
| Leitura de cada minuto falha | `Couldn't check GitHub` | barra | Não |
| Passada não começa (leitura ou worktree) | `pass_blocked` | barra com a razão | Sim |

**Review again** (`ReviewAgainDialog.tsx`): **Instructions** opcional; aviso `The decisions and edits of review N will be discarded.` quando a última passada não publicada tem decisão ou edição; **Review again** (`Asking…`). Habilita quando nada está em curso nem esperando checks (`canReviewAgain`). O produto relê a PR, atualiza a worktree, reescreve `context.md` e manda ao agente a mensagem da passada (`again.go` `passMessage`): arquivo do relatório, commit coberto antes, `## Findings already published`, `## GitHub status`, instruções fixas e da passada. Essa mensagem aparece na conversa como mensagem do produto (mediana 4,5 mil caracteres, máx. 11,8 mil; `conversation.md` §4).

### 2.9 O ciclo Apply (`reviewflow/apply.go`; `features §Corrigir a própria pull request`)

Decidir como no Publish › **Apply** (manda os aprovados como `## Approved findings`) › `applying` › `in_review` com a faixa de stage (`ReviewStrip`, a mesma da task) › `ready_to_approve` em 100% › **Approve** › `committing` (commit e push na branch da PR) › nova passada sozinha, esperando os checks › limpo ou nada aprovado: `ready_to_merge`. É o ciclo de `changes_review` da PR da task, que `screens/task.md` já desenha (cartão `Changed files`, barra `Review changes`).

### 2.10 Encerramento

| Caso | O que acontece |
|---|---|
| PR mergeada ou fechada | A leitura de cada minuto percebe; o produto encerra a sessão, remove a worktree e arquiva, **sem notificar**; a conversa é apagada |
| Tela aberta nesse momento | A área principal fica vazia (`ReviewView` com `review === null`); `structure.md` §1 já pede a página "saiu enquanto aberto" |
| **Delete review** | Confirmação `Delete the review of <repo>#N?` / `The worktree, the conversation and the reports go away. What was published on GitHub stays.` |
| Histórico | `Review`, `#N`, título, repo, autor, `Merged`/`Closed`, datas; aberto, cada passada com relatório, veredito e onde foi cada apontamento |

Tempo de vida real: 8 min a 2,8 dias; mediana 32 min (11 arquivados; banco).

### 2.11 O que a conversa mostra e o que fica fora

| Na conversa | Fora dela |
|---|---|
| `Review started` | O estado e os avisos (barra) |
| As instruções da 1ª passada como mensagem do usuário (vazias: nada; o prompt fica escondido) | Os checks e a mergeabilidade lidos antes da passada (não expostos) |
| Grupos de ações (mediana 24, p90 42), 7 falas curtas; a última diz em uma linha o que achou | O relatório (painel de apontamentos e `Reports`) |
| `Review pass N written` | As decisões, a publicação, o veredito, o link do review |
| A mensagem de cada passada seguinte, do Apply e do commit (produto) | `context.md` (`Reports`) |
| Pergunta, permissão, erro | Os commits novos e o `trouble` |

Números de `conversation.md` §4 (17 transcripts do CLI). No banco, os dois reviews ativos têm 10 e 23 ações, 2 e 5 falas.

### 2.12 Onde o usuário decide, e por qual canal

| Decisão | Canal | Onde hoje |
|---|---|---|
| Iniciar, com instruções, modelo e modo | Diálogo | Linha da lista |
| Aprovar ou descartar um apontamento | Botão no cartão | Painel acima da conversa |
| Editar o texto ou o resumo | Campo no cartão | Painel |
| Incluir, mudar, retirar um apontamento | Texto no compositor | Conversa |
| Ver o código do apontamento | Clique na localização (VS Code) | Cartão |
| Publicar e o veredito | Botão + diálogo | Barra |
| Nova passada | Botão + diálogo | Barra; diálogo de publicação |
| Apply, aprovar mudanças | Botão; stage no VS Code | Barra; faixa de stage |
| Responder pergunta, permissão | Cartão | Conversa |
| Pausar, apagar | Botão | Cabeçalho |

### 2.13 DTOs da tela (`dto.go`)

| DTO | Campos | O backend sabe e não expõe |
|---|---|---|
| `ReviewSummary` | identidade da PR (`number`, `title`, `author`, `url`, `headBranch`, `baseBranch`, `own`), `mode`, `status`, `card`, `worktreePath`, `passes[]`, `stalePass`, `checkError`, `trouble{failedChecks[],conflict}`, `publishError`, `passBlocked`, `unreadableReport`, `commitFailed`, `review` (stage no Apply), `verdicts[]`, `canPublish/Apply/Approve/ReviewAgain`, bloco de sessão (`sessionStatus`, `turnRunning`, `contextPercent`, `pendingCount`, `retryAttempt`, `lastError`…), `situations[]`, `createdAt` | Os checks lidos (nome, estado, link) durante a espera e antes de cada passada; `PRCheckedAt`; `HeadCommit`, `PassCommit`, `PublishedCommit`; `TroubleBaseline`; a descrição da PR (só dentro de `context.md`) |
| `ReviewPass` | `pass`, `file`, `recorded`, `clean`, `instructions`, `summary`, `findings[]`, `revision`, `published`, `publishedAt`, `publishedUrl`, `verdict`, `edited` | `CreatedAt`, `Commit`, `Applied`, `SummaryOriginal` |
| `ReviewFinding` | `number`, `path`, `line`, `text`, `decision`, `placement` | `Original` (o texto do agente, para desfazer uma edição) |

## 3. Volume real (banco, 18 a 24/09)

| Medida | Valor |
|---|---|
| Reviews | 13 (11 arquivados, todos `Merged`; 2 ativos); 4 repositórios; autores: 5 `dependabot`, 4 `gabriel-panz`, 3 `ju4nv1e1r4`, 1 próprio |
| Com card | 4 de 13 |
| Modo | 13 `publish`, 0 `apply` |
| Passadas por review | 1 em 9, 2 em 3, 3 em 1 (17 no total) |
| Passadas limpas | 8 de 17 |
| Apontamentos por passada com `changes` | 1, 1, 1, 2, 2, 4, 4, 6, 15 (mediana 2) |
| Apontamentos | 36; 30 ancorados, 6 gerais |
| Texto do apontamento | mediana 650 caracteres, p90 1,3 mil, máx. 1,5 mil; 23 de 36 numa linha só, 13 em 3 a 12 linhas, 1 com bloco de código; quase todos com código inline |
| Resumo | mediana 1,2 mil caracteres (209 a 2,4 mil) |
| Decisões | 22 aprovados (61%), 9 descartados (25%), 5 nunca decididos (14%, todos em reviews não publicados) |
| Edições | 1 de 36 textos (corte do último parágrafo); resumo em 6 de 17 passadas: 2 cortes, 4 apagados inteiros, todos com `Approve` |
| Publicadas | 11 de 17 passadas: 7 `Approve`, 4 `Request changes`, 0 `Comment` |
| Onde foi | 20 inline, 2 no corpo (os dois gerais), 0 rebaixados por sair do diff |
| Reescritas pelo agente | 8 de 17 passadas reescritas ao menos uma vez (11 reescritas) |
| Instruções da passada | 12 de 17; 1ª passada: 20 a 501 caracteres (`can we merge safely?` ×3, pedidos de comparação com outro repositório); passadas seguintes: 4 de 5 só dizem "reavalie" (`novos commits na branch. reavalie`) |
| Idioma | Apontamentos e resumos seguem o das instruções: português nos mais antigos, inglês nos recentes |
| Paralelismo | 3 reviews de dependabot iniciados em 45 s, com as mesmas instruções |
| Terminaram sem publicar a última passada | 5 de 13 (1 limpa, 1 própria com descartes, 1 com todos descartados, 2 com indecisos) |

Para comparar, o review da PR das tasks, que `screens/task.md` §9 passa a decidir no mesmo cartão (relatórios em `~/.local/share/myspec/tasks/**/pr/review-*.md`, contagem aproximada pelos títulos numerados): 22 tasks; 12 limpas na 1ª passada; nas outras, 1 a 29 apontamentos na 1ª passada (mediana 3), até 6 passadas. Esses relatórios agrupam por categoria (`Correctness`, `Adherence to the PRD and the spec`, `Quality`, `Tests`) e dão um título em negrito a cada apontamento; os do centro não têm nenhum dos dois.

## 4. Instruções de review por repositório

| Aspecto | Fato | Fonte |
|---|---|---|
| Onde se editam | Settings › Repositories, seção recolhível **Review instructions** `Set`/`None`, `Textarea` e **Save** | `features/repositories/RepositoryRow.tsx` |
| Onde entram | No prompt da 1ª passada (`## Review instructions`, antes de `## Instructions for this pass`) e na mensagem de cada passada seguinte; também no review da PR de cada task | `reviewflow/start.go` `info`; `again.go` `passMessage`; `flow/pr.go:1084` |
| Quando valem | Lidas no início de cada passada | `features §Página Repositories` |
| Visíveis no review | Não: nem no diálogo de início, nem na tela, nem em `context.md` | `StartReviewDialog.tsx`; `start.go` `contextDoc` |
| Uso real | Nenhum dos 12 repositórios tem instruções | banco |

## 5. Como as referências mostram um review com apontamentos

| Produto | Lista | Apontamento | Decisão e envio | Vale para o MySpec |
|---|---|---|---|---|
| **GitHub** | Filtros `review-requested:@me`; sem seções | Comentário inline no `Files changed`, com `suggestion` aplicável | Comentários ficam "pendentes" até **Finish your review**: um popover com o corpo e três vereditos, o botão com a contagem | O diálogo de publicação do MySpec é esse popover; a contagem no botão vale como `3 inline · 1 in the body` |
| **Graphite** | Inbox em seções (`Needs your review`, `Waiting for review`, `Approved`) e seções próprias por filtro | Comentários do agente no diff, aceitar, mudar ou ignorar | Chat com o agente na página da PR | Seções no lugar de um interruptor `Pending only`; a conversa com o agente ao lado dos apontamentos |
| **CodeRabbit** | — | Inline com rótulo de tipo (`Potential issue`, `Refactor suggestion`), sugestão aplicável e `Prompt for AI Agents` recolhido | Um comentário-resumo `Actionable comments posted: N`, com os fora do diff e os `Nitpick` no corpo, recolhidos | O mesmo corte do MySpec (inline × corpo); tipo e título tornam a lista varrível |
| **Cursor Bugbot** | — | Título, gravidade e explicação; **Fix in Cursor** / **Fix in Web** | Roda de novo a cada push e lê os comentários anteriores para não repetir | Título + gravidade como unidade de leitura; "o que foi resolvido" a cada passada, como o resumo do **Review again** |

Fontes: [GitHub, reviewing proposed changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request); [Graphite, review pull requests](https://graphite.com/docs/review-pull-requests); [CodeRabbit, configuration](https://docs.coderabbit.ai/reference/configuration); [Cursor Bugbot](https://cursor.com/docs/bugbot).

## 6. Lacunas e perguntas

**Lacunas de fato** (não viram pergunta; custo entre parênteses):

- A lista não lê checks, tamanho, idade nem pedido de review (backend pequeno: campos na query GraphQL).
- Os checks pelo nome durante `Waiting for checks` e os lidos antes de cada passada não chegam (backend pequeno; já é pedido em `structure.md` §8).
- Um apontamento não tem título nem gravidade (formato do relatório e prompt; muda feature).
- O texto do apontamento é Markdown e é mostrado cru, na edição e depois de publicado (só frontend).
- As decisões e o destino dos apontamentos das passadas anteriores só aparecem no histórico (só frontend: `passes[]` já traz tudo).
- O veredito pré-selecionado é `Approve` mesmo com apontamentos aprovados (só frontend).
- Nenhum marcador na conversa para decisão, publicação ou commits novos (backend pequeno: tipos de marcador, como `screens/task.md` §15).
- A tela fica vazia quando o review é arquivado com ela aberta (já coberto por `structure.md` §1).
- O texto original de um apontamento editado não chega, então editar não tem volta (backend pequeno).

**Perguntas para o usuário**

1. **Review de consulta.** Em 5 de 13 reviews você não publicou a última passada (dependabot com `can we merge safely?`, a sua própria PR, uma com todos descartados). Hoje esse review continua esperando por você (`Decide findings` ou `Ready to publish`, âmbar na árvore) até o merge. Quando você revisa só para saber, quer poder dizer "li, não vou publicar" e o review parar de esperar? Decide se a tela e a barra do pedido têm uma saída sem publicar e um estado de repouso para ela; é uma mudança de feature.
2. **Onde você olha o código ao decidir um apontamento.** Você clica na localização para abrir o VS Code, olha o `Files changed` do GitHub, ou decide pelo texto? Decide se o cartão do apontamento traz um trecho do diff em volta da linha (backend pequeno: o diff já é lido para publicar) ou só a localização como link.
3. **O que te faz escolher uma PR na lista.** Com cerca de 8 PRs abertas, você escolhe só pelo que já aparece (pendente, autor, card), ou olharia tamanho, estado dos checks e idade? Decide se a linha ganha esses dados (backend pequeno) ou fica como está.
