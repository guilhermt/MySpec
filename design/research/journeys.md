# Jornadas, situações e dados

O produto visto pelo uso e pelos dados: quem age em cada passo, o que espera pelo usuário, como várias tasks convivem, e o que o frontend recebe ou deixa de receber do Go. O inventário de telas e componentes está em `screens.md`, e este arquivo não o repete.

Legenda de ator: **U** usuário, **A** agente (Claude Code), **P** produto. "Espera U" é o produto ou o agente parado esperando o usuário; "U espera" é o usuário esperando o agente ou o GitHub.

Fontes principais: `docs/product/features.md` (citado como `features §Seção`), `docs/product/overview.md`, `internal/bindings/dto.go`, `internal/attention/`, `frontend/src/lib/situations.ts`.

---

## 1. Jornadas

### 1.1 Cadastrar repositórios e boards (primeira execução)

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | Sem nada cadastrado, a tela de boas-vindas oferece **Add board** e **Add repository** | P | Espera U | Que o ponto de partida é um board ou um repo (`features §Tela de boas-vindas`) |
| 2a | **Add repository**: P varre a home (6 níveis) e lista clones do GitHub; U marca e confirma | P → U | U espera a varredura | Quais clones são do GitHub, quais já estão `Registered`; recusas por linha (`features §Página Repositories`) |
| 2b | **Add board**: U cola a URL; P lê o board; U escolhe status finais, status de cards novos e repositórios administrados (com `Clone found`, `Registered`, `Registered without a clone`, outro board) | U → P → U | U espera a leitura do GitHub | Como cada repo vai ficar ligado; que repos sem clone não recebem tasks (`features §Cadastrar um board`) |
| 3 | P faz a primeira leitura dos cards; a visão principal substitui a boas-vindas (sem task: visão do primeiro board) | P | U espera a leitura | Última leitura, falha de `gh` e o que rodar (`features §Falhas`) |
| 4 | Manutenção: **Clone**, **Change path**, **Clone folder**, **Review instructions** por repo, **Edit/Remove** board | U | nenhuma | Contagem de tasks/reviews que impede remover; clone inexistente bloqueia criar, primeiro step e encerramento (`features §Clone inexistente`) |

Nada aqui gera situação: falhas de leitura de board aparecem só onde a leitura foi pedida e nunca notificam (`features §Falhas`).

### 1.2 Criar uma task

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1a | Sem card: `Ctrl+N` ou botão de nova task, de qualquer lugar | U | — | Repo pré-selecionado (filtro → task aberta → último usado → primeiro) (`features §Criação de uma task`) |
| 1b | De card: na visão do board, **Start task** (ou `S`) no card; a ação depende do card (`start`, `clone`, `clone_missing`, `add_to_board`, `other_board`, `has_task`, `closed`; `BoardCard.Action`) | U | Clone roda em segundo plano, com `Cloning…`, e o diálogo abre sozinho no fim | Se o card já tem task, dependências não satisfeitas (aviso, nunca bloqueia), épico e irmãos |
| 2 | U preenche nome (sugerido `<n>-<slug>` de card), contexto inicial (ou `Additional context`), modo `Structured`/`One-Shot`, modo de review `Manual`/`Agent`, modelo e esforço por etapa | U | P relê o card se a leitura tem > 5 min (`Refreshing the card…`) | O que cada modo faz (linha explicativa); que o modo nunca muda; o contexto montado (recolhível) |
| 3 | Confirma; P abre a primeira sessão de planejamento no clone | P | U espera a primeira pergunta | Se a sessão não começa, a task é desfeita |

### 1.3 Conduzir uma task Structured

Trilha: `PRD › Tech spec › Plan › Implementation › PR › PR review › Closing` (`features §Voltar e descartar`).

| # | Etapa / passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | **PRD**: Q&A, uma pergunta por vez (cartão de pergunta estruturada ou texto); A confirma entendimento e escreve `PRD.md` | A ↔ U | Espera U a cada pergunta (`question`, `reply`); U espera cada turno | A pergunta, as opções; o documento no painel de artefatos (`features §Etapas de planejamento`) |
| 2 | Fim da etapa: documento escrito + sessão ociosa → P inicia a seguinte sozinho (auto-avanço) | P | — | Marcadores `prd_written`, `stage_started` na conversa (`MarkerEntry`) |
| 3 | **Tech spec**: A explora o código, apresenta alternativas com trade-offs; U decide; `tech-spec.md` | A ↔ U | Espera U em cada decisão | Trade-offs; o PRD ao lado |
| 4 | **Plan**: A negocia a divisão e escreve `steps/<n>-*.md`; P valida; até 3 correções automáticas; depois `plan_invalid` com problemas acima do compositor | A ↔ U, P | Espera U se inválido | Os problemas (`PlanProblem`), quantas correções (`Corrections`) |
| 5 | **Implementation**, por step (ver 1.5): P cria a worktree no 1º step (fetch, base `dev`/`main`), verifica que está limpa, abre a sessão do step com o arquivo do step | P → A | U espera a implementação; espera U em pergunta/permissão/bloqueio | Step N de M, fase (`Fetching origin…`, `Creating the worktree…`), bloqueios com a saída do git e **Limpar e iniciar** (`features §Pré-condição`) |
| 6 | Review do step (Manual ou Agent) e commit; P encerra os processos e inicia o próximo step | U ou A, P | ver 1.5 | Progresso do stage, rodada do revisor |
| 7 | **PR** (ver 1.6): rascunho → OK → abertura → review → pronta → merge fora do produto → **Close task** | A, U, P | Várias | Ver 1.6 |
| 8 | **Closing**: P remove worktree, apaga branch, atualiza base; task vai ao histórico com aviso momentâneo | U aciona, P executa | — | Resultado de cada parte: feito, pulado (por quê), falhou (`CloseResult`) |

Ações transversais: **Voltar a uma etapa** (apaga tudo que veio depois, entra em revisita até **Continuar**, `ready_to_continue`), **Descartar e recomeçar**, **Descartar step**, **Pause/Resume**, trocar modelo por etapa (**Models**), trocar modo de review (`features §Modo de review`), **Delete** (com prévia do que será destruído, `DeletePreview`).

### 1.4 Conduzir uma task One-Shot

Trilha: `Planning › Implementation › PR › PR review › Closing`.

| # | Passo | Ator | Espera | Diferença para Structured |
|---|---|---|---|---|
| 1 | **Planning**: Q&A único de quê + como; A escreve `one-shot.md` (9 seções) | A ↔ U | Espera U a cada pergunta | Uma etapa em vez de três; sem validação de conteúdo (`features §Planejamento One-Shot`) |
| 2 | **Implementation**: step único = o documento, no modo de review da task, com o modelo da implementação | A, U/A | como 1.5 | Sem lista de steps; relatórios do revisor na aba **One-Shot** |
| 3 | PR, PR review, Closing | igual | igual | Prompts citam o documento One-Shot |
| — | **Back to planning** (mantém documento, `Planning · revisiting` até **Continue to implementation**) e **Discard and restart** no chip **Planning** | U | — | Implementação recomeça numa worktree nova |

### 1.5 Revisar um step

**Manual** (`features §Review`, `§Aprovação e commit`)

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | A termina o turno sem pendência → step `awaiting_review`; situação `step_review` forma `review` | A → P | Espera U | Que o step está pronto; resumo do agente na conversa |
| 2 | U abre **Abrir no VS Code** ou clica um arquivo da lista; dá stage arquivo a arquivo | U | — | Lista de arquivos com tipo e stage; progresso ao vivo (`Review.Files/Staged/Total/Percent`); forma muda para `staged` com `%` (sem notificar) |
| 3 | U pode pedir mudança na conversa → volta a `implementing` | U → A | U espera | — |
| 4 | 100% em stage + sessão ociosa → **Aprovar** habilita; forma `approve` | U | Espera U | O que falta para habilitar |
| 5 | P envia o prompt de commit na conversa do step; A commita | P → A | U espera | `committing`; se sem commit, volta com `The last approval didn't produce a commit.` (`CommitFailed`) |
| 6 | Commit na branch → `done` (`CommitSHA`, `CommitSubject`); próximo step começa | P | — | — |

Casos à parte: step sem mudanças (`step_empty`, não pode ser aprovado); worktree ilegível (`worktree_unreadable`).

**Agent** (`features §Review pelo agente`)

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | Implementador termina turno com mudanças → P pede passada ao revisor; `Agent review · pass N` | P → A(rev) | Ninguém espera U | Abas **Implementer**/**Reviewer** com ponto de estado |
| 2 | Revisor lê, roda checks do repo, escreve relatório `clean`/`changes` | A(rev) | — | Relatórios `Review N · changes/clean` sob o step |
| 3a | `changes` → P entrega ao implementador; `Addressing review · round N of 3` | P → A | — | Rodada atual |
| 3b | `clean` → P pede commit; `Committing` → `done`; próximo step, sem notificar | P → A | — | — |
| 4 | Após 3 rodadas sem limpo, ou commit que não aconteceu, ou **Review myself** → step passa a `Manual` (`ReviewFallback`: `rounds_exhausted`, `commit_failed`, `taken_over`) e segue o fluxo Manual | P/U | Espera U | A razão (tooltip `Manual` na lista de steps; texto na barra) |
| — | Revisor pergunta, pede permissão, falha, ou termina sem relatório (`ReportMissing`) → situação em `step_review:<n>` | A(rev) | Espera U na aba **Reviewer** | Qual aba; o produto nunca troca de aba sozinho |

Uma task toda `Agent` só espera U entre o primeiro step e o rascunho da PR em erro, bloqueio, permissão, pergunta, passada sem relatório ou fallback (`features §Depende de mim`).

### 1.6 Conduzir a pull request da task e o review dela

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | Último step commitado → etapa PR; A lê commits/diff/PRD/spec e escreve rascunho (`drafting`) | P → A | U espera | — |
| 2 | Rascunho pronto (`draft_ready`, situação `draft`); U edita título/corpo ou descarta | U | Espera U | O rascunho; `Closes owner/name#N` numa task de card |
| 3 | OK → A faz push e `gh pr create` (`opening`); falha de `gh` → `blocked` (`pr_blocked`) com **Tentar de novo** | A, P | U espera | Razão do bloqueio (`PRBlock`) |
| 4 | P lê checks e mergeabilidade; enquanto pendente: `waiting_checks` (`PR review · waiting for checks`); relê a cada minuto | P | U espera o GitHub (não é situação) | Que está esperando checks; não diz quais nem há quanto tempo |
| 5 | Review de PR: A escreve relatório `clean`/`changes`; checks com falha e conflito viram apontamentos | A | U espera | Relatórios de cada passada |
| 6a | `clean` → `done` ("pronta"), situação `merge` forma `merge` | P | Espera U (fazer merge fora) | Link da PR, estado |
| 6b | `changes` → `awaiting_decision` (`findings`); U decide item a item **na conversa** | U ↔ A | Espera U | Os apontamentos, no relatório |
| 7 | A aplica o aprovado; review do produto como step Manual (`in_review`/`ready_to_approve`, `changes_review`); **Aprovar**; commit + push | U, A | Espera U | Progresso de stage |
| 8 | Nova passada automática (volta ao 4) até limpo; **Revisar de novo** a qualquer momento | P/U | — | — |
| 9 | Pronta que ganha check com falha ou conflito → `trouble` (`pr_trouble`: `checks`/`conflict`/`checks_conflict`), com nomes dos checks; some sozinha quando o problema some | P | Espera U | `Checks failed: <checks>`, `Conflict with <base>` (`PRTrouble`) |
| 10 | Merge no GitHub → `merged`; `merge` muda para forma `close` (sem notificar); **Close task** | P, U | Espera U | `CanClose`; `CloneMissing` desabilita |
| — | PR fechada sem merge → `pr_closed`; task não pode ser encerrada | P | Espera U | — |

### 1.7 Revisar a pull request de outra pessoa (centro de review)

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | Nó **Reviews** (contagem de pendentes filtradas) → visão Reviews; P lê PRs ao abrir app, ao abrir a visão, a cada 5 min, por **Refresh** | P | — | Pendentes (nunca revisadas ou com commits novos), autor, labels, card, `Draft`, `Task`, `Reviewed`, `New commits` (`PullRequestRow`) |
| 2 | Filtros Board/Repository/Author/Label (tri-estado)/Pending only | U | — | Uma pendente sem review iniciado **não** notifica nem entra em Waiting for you (`features §Pendente de review`) |
| 3 | **Review** → diálogo: instruções, modelo/esforço, modo Publish/Apply (só PR própria); clone se preciso | U | — | Recusas: fork, PR de task, review ativo existente |
| 4 | P cria worktree detached, contexto, abre conversa; `waiting_checks` até checks assentarem | P | U espera | — |
| 5 | A escreve relatório com apontamentos ancorados (arquivo:linha) ou gerais; `awaiting_decision` → `review_report` forma `decide` | A | Espera U | Painel de apontamentos `N of M decided`; clicar a localização abre o editor |
| 6 | U aprova/descarta/edita cada apontamento; pode pedir ao agente mudar o relatório | U ↔ A | Espera U | `StalePass` (`New commits since this pass`) |
| 7 | Todos decididos → forma `publish`; **Publish review** → veredito (Approve/Request changes/Comment) | U | Espera U | O que vai inline e no corpo (`3 inline comments · 1 in the body`) |
| 8 | P publica; falha → `publish_failed`; sucesso → `published`, sem esperar ninguém | P | — | Onde cada apontamento foi (`Placement`) |
| 9 | Commit novo → `new_commits` (notifica); check/conflito novo → `pr_trouble`; **Review again** | P, U | Espera U | — |
| 10 | Merge/fechamento → review vai ao histórico sozinho, sem notificar | P | — | — |
| Apply | Passos 5-6, depois `ready_to_apply` (`review_report` forma `apply`) → **Apply** → A corrige → `in_review`/`ready_to_approve` (`changes_review`) → **Approve** → commit+push → nova passada → `ready_to_merge` (`merge`) | U, A, P | Como 1.6 | `features §Corrigir a própria pull request` |

### 1.8 Conduzir uma discussão e publicar cards

| # | Passo | Ator | Espera | O que U precisa saber |
|---|---|---|---|---|
| 1 | Na visão do board: **New discussion**, **Discuss** no card, ou selecionar cards + `D` | U | — | — |
| 2 | Diálogo: título, What to discuss, cards, contexto (recolhível), modelo, repos sem clone | U | Releitura de cards > 5 min | Precisa de texto ou ≥ 1 card |
| 3 | Conversa na pasta de artefatos, lendo os clones; `Discussing`; turno sem pergunta antes dos rascunhos → `reply` | A ↔ U | Espera U | — |
| 4 | A escreve documento e rascunhos; `Decide drafts` (`drafts`); painel **Drafts** abre sozinho com `N of M decided` | A → U | Espera U | Cada rascunho: novo/atualização (com diff contra o card)/épico, repo, módulo, dependências |
| 5 | U edita, **Approve**/**Discard**, **Group into an epic**; rascunho solto aprovado publica na hora; dependente espera (`Waits for <título>`) | U, P | — | `Publishing…`, `Created/Updated owner/name#N` |
| 6 | **Publish epic** quando habilitado (hints) | U → P | — | `CanPublish`, `Hint` |
| 7 | Falha → `publish_failed` com **Retry** no cartão | P | Espera U | Razão por cartão |
| 8 | **Archive** (bloqueado com aprovados pendentes ou falha) ou **Delete discussion** | U | — | O que fica no histórico |

### 1.9 Configurar prompts, modelos e padrões

| # | Passo | Ator | O que U precisa saber |
|---|---|---|---|
| 1 | `Ctrl+,` ou ícone → **Defaults**: modo de review padrão e modelo+esforço por tipo de sessão (9) | U | Catálogo vem do Claude Code instalado; escolha indisponível fica marcada; falha do catálogo explica (`ModelCatalog.Failure`) (`features §Modelos e esforço`) |
| 2 | **Prompts**: nove prompts renderizados e editáveis; **Restaurar**; placeholders listados | U | Edição vale a partir da próxima sessão; `Modified` (`features §Prompts`) |
| 3 | Por task: popover **Models** (só etapas não iniciadas; `Editable`, `Live`); por step na lista; por sessão no seletor da conversa | U | O que ainda pode mudar |

---

## 2. Situações

Fonte: `internal/attention/situation.go` (catálogo, grupos, formas), `internal/attention/derive*.go`, `internal/attention/text.go` (textos de notificação), `frontend/src/lib/situations.ts` (rótulos), `features §Depende de mim`.

Grupos, do mais urgente: `error` (vermelho), `waiting` (atenção), `closing` (atenção) (`situationTone`). Ordenação: grupo, depois `startedAt` (`compareSituations`). Um lugar (place) guarda no máximo uma situação (`0008_situations.sql`); lugares: `stage:<stage>`, `step:<n>`, `step_review:<n>`, `pr`, `review`, `discussion`.

### 2.1 Catálogo

| Kind | Grupo | Item | Nasce quando | Resolve quando | Rótulo na lista | Notificação (corpo) |
|---|---|---|---|---|---|---|
| `session_error` | error | task, review, discussão | sessão falha ao iniciar, processo morre, sem `claude`/login | **Tentar de novo** | `Session error` | `The session stopped with an error in <lugar>.` |
| `step_blocked` | error | task | worktree suja, fetch falhou, sem base, caminho/branch existem, clone ausente | **Tentar de novo** / **Limpar e iniciar** / **Change path** | `Step N blocked` | `Step N can't start: <razão>.` |
| `worktree_unreadable` | error | task | `git status` falha no review | worktree volta a ser lida | `Can't read worktree` | `Step N: the worktree can't be read.` |
| `pr_blocked` | error | task | `gh` ausente/sem auth/falha, git falha, sem worktree | **Tentar de novo** | `PR blocked` | `The pull request is blocked: <razão>.` |
| `plan_invalid` | error | task | plano inválido após 3 correções | U corrige na conversa ou descarta | `Plan still invalid` | `The plan is still invalid after automatic corrections.` |
| `pr_closed` | error | task | PR fechada sem merge | só apagando a task | `PR closed unmerged` | `The pull request was closed without a merge.` |
| `publish_failed` | error | review, discussão | publicação no GitHub falha | **Publish review** / **Retry** | `Publish failed` | `The drafts couldn't be published.` (discussão) |
| `pass_blocked` | error | review | leitura de checks falha ou worktree não atualiza | **Review again** | `Pass blocked` | — |
| `permission` | waiting | todos (inclui revisor de step) | escalada que o modo auto não resolve | U permite/nega | `Permission` | `Permission requested in <lugar>.` / `The reviewer of step N asks for a permission.` |
| `question` | waiting | todos | pergunta estruturada | U responde | `Question` | `The agent has a question in <lugar>.` |
| `reply` | waiting | todos | turno termina sem pergunta estruturada no planejamento/discussão; passada sem relatório legível (revisor de step, review, rascunhos ilegíveis) | U escreve / agente reescreve | `Waiting for reply` | `The agent is waiting for your reply in <lugar>.`; revisor: `...stopped without writing its report.`; review: `The reviewer stopped without a report the app can read.` |
| `ready_to_continue` | waiting | task | etapa revisitada com documento e sessão ociosa | **Continuar** | `Ready to continue` | `The <etapa> is revised and ready to continue.` |
| `step_review` (formas `review`→`staged`→`approve`) | waiting | task | step Manual aguardando review; fallback do Agent | commit | `Review step N` / `Step N · 42% staged` / `Approve step N` | `Step N is ready for review.` ou variantes de fallback |
| `step_empty` | waiting | task | turno sem mudanças | U pede mudança ou descarta | `Step N has no changes` | `Step N finished without changes.` |
| `draft` | waiting | task | rascunho de PR escrito | OK ou descarte | `Draft to approve` | `The pull request draft is ready for your OK.` |
| `findings` | waiting | task | review de PR com `changes` | U decide na conversa | `Findings to decide` | `The review of the pull request found changes for you to decide.` |
| `changes_review` (`review`/`staged`/`approve`) | waiting | task, review Apply | mudanças aplicadas aguardam review | commit | `Review changes` / `Changes · N% staged` / `Approve changes` | `The changes from the review of the pull request are ready for review.` |
| `review_report` (`decide`→`publish`, ou `apply`) | waiting | review | relatório com apontamentos | publicar / aplicar | `Decide findings` / `Publish review` / `Apply findings` | `The review has findings for you to decide.` / `...ready to publish.` / `...ready to apply.` |
| `new_commits` | waiting | review | commit novo após review publicado | **Review again** | `New commits` | — |
| `pr_trouble` (`checks`/`conflict`/`checks_conflict`) | waiting | task, review | check falha ou conflito surge após a passada | problema some (sem notificar) ou **Review again** | `Checks failed` / `Conflict with base` / `Checks failed · conflict` | — |
| `drafts` | waiting | discussão | rascunhos a decidir | todos decididos/publicados | `Decide drafts` | `There are drafts to decide in the discussion.` / ilegíveis: `The agent wrote drafts the app can't read...` |
| `merge` (`merge`→`close`) | closing | task, review Apply | PR pronta (review limpo) | merge → **Close task** / fim do review | `Ready to merge` / `Ready to close` | `The pull request is ready to merge.` / `...ready to close.` |

Não geram situação: task/review pausados, espera de checks (`waiting_checks`), review publicado sem novidade, falha de leitura de board, PR pendente no centro de review sem review iniciado, clone em andamento (`features §Depende de mim`, `§Pendente de review`, `§Falhas`).

Observação de código: o comentário de `Situation.Kind` em `dto.go` não lista `pr_trouble`, mas o kind existe em `situation.go` e em `situations.ts`.

### 2.2 Como cada situação é anunciada hoje

| Canal | Comportamento | Fonte |
|---|---|---|
| **Waiting for you** (topo da sidebar) | Uma linha por situação de todas as tasks, reviews e discussões, exceto o item aberto; nome do item, `situationDetail` (rótulo + lugar), espera compacta (`now`, `5m`, `2h`, `3d`) e tooltip `waiting <5 minutes>`; ordem por urgência; nunca filtrada por repositório | `WaitingSection.tsx`, `waitingEntries`, `compactWait`, `spokenWait` |
| `Ctrl+J` | Abre o primeiro item que espera | `features §Atalhos` |
| Linha na árvore | Task: etapa, step atual (`Step N of M · <estado>`), progresso de review, **Agent review**/**Addressing review**, e `summaryLabel` (`<rótulo> +N`); review sob **Reviews**; discussão sob o board | `features §Tela de boas-vindas e barra lateral`, `task/status.ts`, `summaryLabel` |
| Visão do board | `Waits for you` na linha do card com task que espera | `features §Visão do board` |
| Dentro do item | Trilha de etapas, barra do step, abas **Implementer**/**Reviewer** com cor da situação, barra da PR, barra do review, barra da discussão | `features §Depende de mim` |
| Flash | Situação nova com janela em foco: a linha, o contador ou a aba pisca 1.600 ms, em silêncio | `FLASH_MS`, `bootstrap.ts` (`flashSituation`) |
| Notificação do sistema | Só com a janela fora de foco (`SituationStarted.Focused`), uma vez por situação, ao começar; título = nome do item; clique traz a janela e abre o lugar (`situation:open`); é retirada quando a situação acaba | `internal/app/notifications.go`, `attention/service.go` (`endLocked`) |
| Som | Carrilhão do app junto da notificação; silencioso se < 2 s da anterior ou em não perturbe; sem configuração | `features §Depende de mim`, `platform/chime`, `platform/dnd` |
| Não notificam | Mudança de forma (stage chegando a 100%, pronta → mergeada), mudança da razão de `pr_trouble`, volta a pronta | `features §Depende de mim` |

Não existe: contador global de situações na janela ou no ícone do app, níveis de urgência configuráveis, silenciar por item, lista de situações resolvidas (fim de uma situação só vai ao log: `attention/service.go` `situation ended`).

---

## 3. Paralelismo

| Aspecto | Como é | Fonte |
|---|---|---|
| Quantas tasks | Sem limite; cada task tem sessão, worktree e branch próprias; todas rodam ao mesmo tempo, numa janela | `overview.md` (Visão geral), `features §Worktrees` |
| Dentro de uma task | Steps em sequência, um de cada vez; no máximo implementador + revisor de um step vivos; etapa de PR tem conversa de PR e de review | `features §Implementação`, `§Sessões e conversas` |
| Uma task por card | Card tem no máximo uma task ativa; PR tem no máximo um review ativo | `features §Start task`, `§Iniciar um review` |
| Processos ociosos | Sessão ociosa por 10 min é parada e retomada transparente na próxima mensagem | `features §Sessões e conversas`, `session/run.go` (`armIdleLocked`) |
| Polling | PRs de tasks e reviews ativos a cada minuto; lista de PRs a cada 5 min; boards só sob demanda | `app/poll.go` (`prPollInterval`), `features §Leitura das pull requests` |

**O que se vê de todas de uma vez (sem abrir)**

| Onde | Por task | Por review | Por discussão |
|---|---|---|---|
| Waiting for you | cada situação, com espera | idem | idem |
| Árvore da sidebar | nome, repo curto, `#card`, etapa, `Step N of M · <estado>`, `% staged` ou `Agent review`/`Addressing review`, ponto de estado da sessão (working/idle/paused/error), rótulo da situação `+N` | `repo#N`, título, ponto, situação ou estado | `Discussion`, título, ponto, situação ou estado |
| Visão do board | etapa da task do card, `Waits for you` | — | — |
| Visão Reviews | `Task` na linha da PR | estado do review na linha | — |

**O que só se vê abrindo**: a conversa e o que o agente está fazendo agora (ações, texto em streaming, `Thinking…`/`Retrying`), a lista de steps com modelos e modos, os artefatos, o medidor de contexto, a fila de mensagens, os arquivos do review, os relatórios, o rascunho da PR, o link e o estado da PR, a razão de bloqueios (`StepBlock.Detail`, `PRBlock.Detail`), os checks que falharam pelo nome (a sidebar só diz `Checks failed`).

Não existe hoje uma visão agregada de todas as tasks (painel ou tabela), nem ordenação da árvore por atividade ou urgência: a árvore segue a ordem de criação dentro de cada nó (`features §Tela de boas-vindas e barra lateral`).

---

## 4. Modelo de dados que chega ao frontend

Transporte: o evento `state:changed` carrega o `State` inteiro a cada mudança; `transcript:changed` carrega um `TranscriptEvent` por mudança de conversa; `situation:started` e `situation:open` para atenção (`dto.go`). Chamadas pontuais (não no `State`): `GetTranscript`, `ReadArtifact`, `DeletePreview`, `BoardPreview`, candidatos de repositório, prompts, contexto de card/discussão.

### 4.1 `State`

| Campo | Permite mostrar |
|---|---|
| `migration` | Tela de migração recusada (casos, tasks) |
| `repositories[]` | Página Repositories, filtro, avisos de clone (ver 4.2) |
| `repositoryFilter` | Filtro atual da árvore e do histórico |
| `theme`, `systemDark` | Tema |
| `modelDefaults[]`, `modelCatalog`, `reviewModeDefault` | Defaults, seletores, falha do catálogo |
| `tasks[]` | Tudo das tasks ativas (4.3) |
| `history[]` | Tasks arquivadas (4.7) |
| `boards[]` | Boards com a última leitura e todos os cards (4.6) |
| `reviewCenter` | Visão Reviews (4.5) |
| `reviews[]`, `reviewHistory[]` | Reviews ativos e arquivados (4.5) |
| `discussions[]`, `discussionHistory[]` | Discussões (4.6) |
| `cloneFolder` | Pasta de clones |

### 4.2 `Repository`

`id, owner, name, fullName, path` (identidade e caminho) · `missing`, `cloned`, `cloning`, `cloneError` (estado do clone) · `boardId` (agrupamento) · `activeTasks, archivedTasks, activeReviews, archivedReviews` (contagens, bloqueio do Remove) · `reviewInstructions` (`Set`/`None`).

### 4.3 `TaskSummary` e filhos

| Campo | Permite mostrar |
|---|---|
| `id, name, repositoryId, repository` | Identidade, repo curto/longo |
| `card` (`TaskCard`: board, número, título, URL, status, state, épico) | `#N`, status do board, `Issue closed`, agrupamento por épico |
| `mode` | `One-Shot` e trilha |
| `stage`, `revisiting`, `canContinue` | Trilha de etapas, revisita |
| `reviewMode`, `reviewModeEditable` | Botão de modo |
| `sessionStatus` (working/waiting/needs_permission/needs_answer/paused/error), `turnRunning`, `processRunning`, `retryAttempt`, `lastError` | Ponto de estado, indicador de atividade, erro (da sessão que a tela mostra) |
| `sessionModel`, `sessionEffort`, `contextPercent`, `pendingCount` | Seletor, medidor de contexto, fila |
| `corrections`, `planProblems[]` | Correções automáticas do plano e problemas |
| `hasPrd, hasTechSpec, hasOneShot`, `artifactVersion` | Abas de artefatos e recarga |
| `steps[]` (`Step`) | Ver abaixo |
| `currentStep` | `Step N of M` |
| `pr` (`PullRequest`) | Ver abaixo |
| `situations[]` | Tudo da seção 2 |
| `models[]` (`TaskStageModel`: stage, model, effort, `editable`, `live`) | Popover **Models** |
| `createdAt`, `updatedAt` | Chegam, mas `updatedAt` não é usado em nenhuma tela (grep em `frontend/src`) e `createdAt` só no histórico |

`Step`: `number, file, title` · `status` (13 valores) e `phase` (fetching/creating/checking) · `block` (`reason`, `detail` do git, `files`) · `worktreePath` · `review` (`files[]` com path/kind/staged, `staged, total, percent, error`) · `commitSha, commitSubject, commitFailed` · `model, effort, adjusted, modelEditable` · `reviewMode, reviewModeAdjusted, reviewModeEditable, reviewFallback` · `reviewPass, reviewRound, reportMissing` · `reports[]` (pass, file, clean) · `reviewer` (`StepReviewer`: mesmo bloco de sessão da task).

`PullRequest`: `status` (18 valores) · `block` · `worktreePath, branch, baseBranch` · `draft` (título, corpo, arquivo) · `reports[]` · `review`, `commitFailed` · `prNumber, prUrl, prState, prBase` · `checkedAt` (chega; não é usado no frontend) · `checkError` · `trouble` (`failedChecks[]` por nome, `conflict`) · `canClose, cloneMissing, close` (`CloseResult` com as três partes, `closedAt`, `baseCommits`) · bloco de sessão.

### 4.4 Conversa (`Transcript`, `Entry`)

`Entry`: `id, seq, turnId, kind, createdAt` e um payload: `user` (texto, pendente, prompt, do app), `assistant` (texto em streaming, completo, interrompido), `action` (ferramenta, rótulo, alvo, status running/done/error/interrupted), `permission` (ferramenta, entrada JSON, sugestões, caminho bloqueado, razão, status, `answeredAt`), `question` (perguntas, opções, respostas), `marker` (17 tipos: documento escrito/atualizado, etapa/step/review iniciado, compactado com `preTokens`, interrompido), `error` (kind, mensagem, `retryable`). `createdAt` é usado nos marcadores e na conversa (`Marker.tsx`, `Conversation.tsx`).

### 4.5 Reviews

`ReviewCenter`: `pullRequests[]`, `failures[]` por repo, `readAt, reading`, `filters`, `pendingCount`, `authors[], labels[]`.
`PullRequestRow`: `key, repositoryId, repository, boardId, number, title, url, author, labels[] (com cor), draft, own, card (PullCard com status), reviewed, newCommits, pending, filtered, taskId, reviewId, action, updatedAt`.
`ReviewSummary`: identidade da PR (`number, title, author, url, headBranch, baseBranch, own`), `mode`, `status` (16 valores), `card`, `worktreePath`, `passes[]`, `stalePass`, `checkError`, `trouble`, `publishError`, `passBlocked`, `unreadableReport`, `commitFailed`, `review`, `verdicts[]`, `canPublish/canApply/canApprove/canReviewAgain`, bloco de sessão, `situations[]`, `createdAt`.
`ReviewPass`: `pass, file, recorded, clean, instructions, summary, findings[]` (`number, path, line, text, decision, placement`), `revision, published, publishedAt, publishedUrl, verdict, edited`.

### 4.6 Boards e discussões

`Board`: identidade, `ownerType`, `hasStatus, statuses[]` (com `final`), `repositoryIds[]`, `readAt, reading, failure` (reason, message, `failedAt`), `viewer`, `cards[]`, `newCardStatus`.
`BoardCard`: issue (título, número, repo, URL, state), `body, statusId, status, final, assignees[] (com avatar), fields[], pullRequests[], epic, epicBody, siblings[], dependencies[] (com satisfied e PRs), readAt, suggestedName, repositoryId, activeTaskId, archivedTaskId, action, otherBoard`.
`DiscussionSummary`: `boardId, board, title, text, status` (6 valores), `cards[]`, `drafts[]`, `draftsRead, draftsRevision, unreadableDrafts`, `hasDocument, documentRevision`, `moduleField, moduleOptions[]`, `repositories[]`, `canArchive, archiveHint`, bloco de sessão, `situations[]`, `createdAt`.
`Draft`: `kind` (new/update/epic), `source` (agent/user), repo, `card`, `title, body, module, epic, dependencies[]` (linked, dropped, detail), `current` (card como está), `decision, revision, warnings[], outcome, number, url, published, publishedAt, publishing, publishError, waits, canPublish, hint`.

### 4.7 Histórico

`ArchivedTask`: identidade, `card`, `mode`, artefatos, `steps[]` com relatórios, `pr` (número, URL, estado), `createdAt, archivedAt`. Não traz o `CloseResult` no DTO, embora `features §Histórico` diga que o resultado do encerramento aparece (vem por `ReadArtifact` ou outra chamada; não verificado). `ArchivedReview`: PR, `mode`, `outcome` (merged/closed), `card`, `passes[]`, datas. `ArchivedDiscussion`: `cards[], drafts[], publishedCount, repositoryIds[]`, datas.

### 4.8 O que o backend sabe e o frontend não recebe ou não mostra

| Dado | Situação hoje | Onde está | Custo para expor |
|---|---|---|---|
| Há quanto tempo uma situação espera | **Exposto e mostrado** (`Situation.startedAt`, persistido) | `situations_of_item.started_at` | — |
| Quando a task começou / última atividade | Exposto (`createdAt`, `updatedAt`), **não mostrado** na task ativa | `tasks` | Só frontend |
| Quando o turno atual começou / há quanto tempo o agente trabalha | **Derivável** no frontend: `createdAt` da entrada `user` do `turnId` corrente; só com a conversa carregada (a task aberta) | `transcript_entries_of_item.created_at` | Frontend para a task aberta; para a sidebar, backend (campo `turnStartedAt` no bloco de sessão) |
| Quando a sessão/etapa começou | Não exposto | `sessions_of_item.created_at`, marcador `stage_started` na conversa | Pequeno (backend) ou derivável pela conversa |
| Quando cada step começou e terminou | Não exposto; início em `steps.created_at`, fim = data do commit no git | `steps` (`created_at`, `updated_at`, `start_commit`), git | Pequeno (backend) |
| Duração de cada etapa, tempo total da task, tempo esperando o usuário vs. o agente | Não existe; o fim de uma situação só vai ao log | `attention/service.go` (`situation ended` via slog) | Trabalho de backend: persistir situações encerradas ou uma trilha de eventos |
| Custo em dólares e tokens por turno | **Lido e descartado**: `ResultEvent.TotalCostUSD`, `NumTurns`, `Usage` chegam do CLI; só `ContextTokens` e `ContextWindow` são guardados | `claude/protocol.go`, `sessions_of_item.context_tokens` | Backend: guardar por sessão (e agregar por task), DTO novo |
| Uso do contexto | Exposto (`contextPercent`) e mostrado no cabeçalho | `sessions_of_item` | — |
| Tentativas de retry da API | Exposto (`retryAttempt`), mostrado só no indicador da conversa | `session/run.go` | Frontend para sidebar |
| Atividade da sessão agora (qual ferramenta, qual arquivo) | Só na conversa (`ActionEntry` com `label`, `target`, `status: running`); o `State` tem apenas `turnRunning` | transcript | Derivável para a task aberta; para a sidebar, backend (última ação em curso no summary) |
| Progresso dentro de uma etapa de planejamento (quantas perguntas, quanto falta) | Não existe; o agente não declara progresso | — | Não derivável sem mudar prompts |
| Progresso da implementação | Exposto: `currentStep`, `steps[].status`, `Review.percent` | — | — |
| Progresso do loop Agent | Exposto: `reviewPass`, `reviewRound` (teto fixo 3) | — | — |
| Diff do step (linhas +/−, arquivos) | Só a lista de arquivos com tipo e stage; sem contagem de linhas nem diff | git | Backend (`git diff --numstat`) |
| Commits da branch / da PR | Só `commitSha`/`commitSubject` por step feito | git | Pequeno |
| Checks da PR (todos, com status, link, pendentes) | **Lidos por completo** (`gh.Check`: nome, URL, pending, conclusão) a cada minuto; o DTO só leva `failedChecks[]` (nomes) após o review; nada durante `waiting_checks` | `gh/checks.go`, `pr_runs.trouble` | Backend: levar a lista de checks e o mergeable ao DTO |
| Mergeabilidade (conflito) | Exposto só como `trouble.conflict` após o review | `gh.PRChecks.Mergeable` | Idem |
| Última leitura da PR | `checkedAt` exposto, **não mostrado** | `pr_runs.pr_checked_at` | Só frontend |
| Quando uma passada de review de PR começou | Não exposto; `publishedAt` sim | `review_passes.created_at` | Pequeno |
| Histórico de eventos da task (linha do tempo) | Não existe como dado; parcialmente reconstruível pelos marcadores de cada conversa (`stage_started`, `step_started`, `*_written`, `compacted`) com `createdAt` | transcript por sessão | Derivável por sessão; agregado por task exige backend |
| Conversas de tasks e reviews arquivados | Apagadas no arquivamento (só a da discussão fica) | `features §Histórico` | Decisão de produto |
| Log técnico (durations de git/gh) | Só no slog | `git/git.go`, `gh/gh.go` | Não se destina à interface |

---

## 5. Lacunas e perguntas para o usuário

Só perguntas cuja resposta muda uma decisão de estrutura ou de hierarquia e que docs e código não respondem.

1. **Volume em paralelo.** Quantas tasks ativas você costuma ter ao mesmo tempo (2-3, 5-10, mais)? E quantos reviews de PR e discussões junto delas? Decide se a sidebar em árvore basta ou se é preciso uma visão agregada (painel/tabela) de tudo em andamento.
2. **Foco da janela.** Enquanto o agente trabalha, você fica olhando o MySpec, ou vai para outra coisa (editor, navegador) e volta pela notificação? Decide o peso de um "o que está acontecendo agora" visível vs. confiar em notificação.
3. **O que você confere primeiro ao voltar.** Ao abrir o app ou voltar a ele: a lista do que espera por você, o estado de uma task específica, ou o que o agente fez enquanto você estava fora? Decide o que ocupa a área principal quando nenhum item está aberto (hoje: a visão do primeiro board).
4. **Por onde começa o dia.** Você entra pelo board (escolher o próximo card), pelas reviews pendentes, ou pelas tasks em andamento? Decide a hierarquia entre board, Reviews e tasks na navegação.
5. **Modo de review mais usado.** No dia a dia os steps são mais `Manual` ou `Agent`? Com `Agent`, a task corre sozinha até a PR e o que importa é acompanhar; com `Manual`, a tela de review de arquivos é o centro. Decide qual estado da tela de task é o principal.
6. **Tempo e custo.** Você quer ver há quanto tempo uma task/etapa está rodando, quanto tempo esperou por você, ou quanto custou em tokens/dólares? O backend já recebe o custo por turno do CLI e o descarta (seção 4.8). Decide se entram na estrutura e se justificam trabalho de backend.
7. **Acompanhar o agente sem abrir.** Ver de fora "o que o agente está fazendo agora" (ex.: `Editing internal/flow/pr.go`) numa task que não está aberta tem valor para você, ou basta saber que está trabalhando e quando precisa de você?
8. **Checks da PR.** Durante `Waiting for checks`, você quer ver quais checks estão pendentes e há quanto tempo, ou basta ser avisado quando algo exige ação? Decide se a lista de checks (já lida pelo backend) entra nas telas.
9. **Várias situações no mesmo item.** Quando uma task tem duas situações (ex.: implementador e revisor), você resolve pela ordem de urgência ou prefere ver o item inteiro? Decide se "Waiting for you" lista por situação (hoje) ou por item.
10. **Largura e tela.** Em que tamanho de janela/monitor você usa o app (tela cheia num monitor largo, lado a lado com o editor)? Decide quantos painéis cabem de uma vez (sidebar + conversa + artefatos + drafts/findings).
