# Crítica do material de entrada da task 3 · Tela da task I

Revisão de `design/tasks/03-task-header.md` (não commitado) e das edições da árvore de trabalho em `design/screens/task.md`, `structure.md`, `principles.md`, `system/components.md`, `implementation.md` e `backend.md` (`git diff` sobre `64fd7cd`). A régua é `implementation.md:18`: toda decisão de design vem tomada, e o PRD só pergunta ao usuário o que é de produto. Conferido contra o código de `main` em `d04cb42` e contra a branch `shell-fixes` (`9035a5b`). `03:N` é a linha do material; os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

## Veredito

**Corrigir antes.** O material é o mais completo da frente até aqui: a tabela da pílula, as fórmulas do nome acessível, o `⋯` item a item, `Details` campo a campo, a conversa anterior e os dados P42–P45 fecham quase tudo o que um PRD perguntaria. Mas, lido contra o código, ele perde ações que as barras que saem têm hoje (G1), escreve a barra de `merge` numa chave que o backend não usa (G2), deixa as notas de `PRPane` repetindo a ação e a primária da barra, contra o próprio pronto 11 (G3), e muda quatro comportamentos de produto sem linha em `changes.md` (G4). Os quatro se corrigem no material e em `changes.md`, sem rodada de design. As lacunas de M1 a M8 são decisões curtas que o tech spec teria de tomar; as de B1 a B8 podem ir junto ou ficar para ele.

## 0. A dependência da branch `shell-fixes`

O material não depende do comportamento de nenhuma correção da task 2 que está em `shell-fixes` (as divergências 1 a 5 de `critique-task-02.md`). Depende do arquivo: o step 9 renomeia `.tree-flash` para `.situation-flash` exatamente nas linhas que `shell-fixes` reescreve (`features/sidebar/TreeRow.tsx:106`, `SidebarRail.tsx:140`, `TreeNodeRow.tsx:192`), e o step 2 edita `sidebar-tree.ts`, que `shell-fixes` também muda (`cutPath`, `nodeStatus`). Pela regra de `implementation.md:13`, a task 2 só termina com `shell-fixes` mergeada. **Decisão:** a task 3 parte de `main` depois do merge de `shell-fixes`, e `03:3` troca `d04cb42` pelo commit desse merge.

`critique-task-02.md` deixou para "junto da task 3" as divergências 6 a 17. O material resolve a 7 (`checking GitHub`, step 2) e a 8 (a lixeira vai ao `⋯`), contradiz a 9 (M1 abaixo) e cala as outras. **Decisão:** a 6 (`FLASH_MS` de 1.600 ms para 2 × `--duration-slow`, `lib/situations.ts:16`, `app/bootstrap.ts:44`) entra no step 9, quando `StepTabs` sai; a 10 (a saída animada do painel) no step 10, que acrescenta painéis; a 15 (o épico desabilitado sem razão no breadcrumb, `components/system/PlaceHeader.tsx:84`) no step 7, que mexe em `PlaceHeader`; a 16 (`lib/sessions.ts:1` importando de `features/task/step-status`) e a 11 (o código morto de `lib/situations.ts:121, 140, 173`) no step 4, que cria as funções puras que leem os dois módulos. As 12, 13, 14 e 17 não tocam a tela da task e ficam para a task 12.

## 1. Lacunas, da mais grave para a menos

### Graves

**G1. Três ações das barras que saem ficam sem lugar.** O pronto 11 (`03:25`) promete que "nenhuma ação das barras que saem fica sem lugar", e a tabela da §4.2 perde estas:

- **Close task com a PR em `trouble`.** `canClose` é verdadeiro em `PRTrouble` quando a leitura falhou (`internal/flow/pr.go:145–154`), e `PRBar.tsx:64, 209–218` oferece **Close task** nesse estado, como `features.md:470` descreve ("oferece o encerramento com o aviso, como na task pronta"). A barra `pr_trouble` (`03:222`) só tem **Review again**, e o `Couldn't confirm the merge` de `PRBar.tsx:178–183`, que vale também em `trouble`, some.
- **Discard draft enquanto o rascunho é escrito e depois de uma abertura que falhou.** `canDiscardDraft` vale em `drafting`, `draft_ready` e `awaiting_reply` sem PR (`features/task/pr-status.ts:136–149`), e `PRBar.tsx:257–263` o oferece no `⋯`. O material só o põe na barra `draft` (`03:218`), que existe só em `draft_ready`, e decide o grupo `Pull request` antes da abertura só com **Open in VS Code** (`03:249`, decisão 7).
- **Open PR com o rascunho à mão em `awaiting_reply`** (`draftAtHand`, `pr-status.ts:100–106`). Na task 3 ele sobrevive no `DraftCard` (`PRPane.tsx:320–327`), mas `implementation.md:82` tira o **Open PR** do `DraftCard` na task 4, e a situação ali é `reply`, sem ação na barra. Não é da task 3, mas o material é o lugar de registrar para a task 4.

*Decisão:* `pr_trouble` com `canClose` ganha no meio `· Couldn't confirm the merge` e **Close task** secundário depois de **Review again**; o grupo `Pull request` do `⋯` antes da abertura tem **Discard draft** (sem reticências, como hoje, sem diálogo) quando `canDiscardDraft`, e a barra `draft` o repete pela exceção de `structure.md:284`; a §3 (Fora) registra que a task 4 mantém um **Approve draft** para `awaiting_reply` com `draftAtHand`. A tabela do pronto 11 ganha as três linhas.

**G2. A barra de `merge` está escrita numa chave que o backend não usa.** A tabela (`03:220–221`) separa "antes do merge" (com `checkError`, `Couldn't confirm the merge` e **Close task** secundário com `canClose`) de "mergeada" (`Ready to close · #1284 merged`). Mas o backend passa a situação à forma `close` sempre que `canClose` é verdadeiro, também sem o merge confirmado (`internal/attention/derive.go:235–247`), e `situationLabel` lê a forma (`lib/situations.ts:80–81`). Então a linha "antes do merge com `canClose`" nunca acontece como está escrita, e uma PR `done` com a leitura falha cairia em `Ready to close · #1284 merged`, que afirma um merge que ninguém confirmou. *Decisão:* a barra lê a forma e o `pr.status`:

| Forma · status | Forma da barra | Rótulo · lugar | Meio | Ações |
|---|---|---|---|---|
| `merge` · `done` | tingida | `Ready to merge` · `#1284` · chip | com `checkError` e o clone ausente, a razão de `closeHint` | **Open PR** (secundário) |
| `close` · `done` | encerramento | `Ready to close` · `#1284` · chip | `Couldn't confirm the merge · Removes the worktree and the branch, then updates dev` | **Open PR** (secundário), **Close task** (primário) |
| `close` · `merged` | encerramento | `Ready to close` · `#1284 merged` · chip | `Removes the worktree and the branch, then updates dev` | **Close task** (primário; tracejado com `closeHint`; `Closing…`) |

`structure.md:113` (a linha da árvore `Ready to close · PR #P merged`) tem o mesmo erro e muda junto.

**G3. As notas de `PRPane` repetem a ação da barra, e a tela fica com duas primárias.** O material mantém as notas "como estão" até a task 4 (`03:74`), mas elas têm botões: `Troubled` tem **Review again** (`PRPane.tsx:139`), `Merged` tem **Close task** primário (`:167`), `AwaitingMerge` tem **Review again** e **Refresh PR** (`:104–110`), e o `DraftCard` tem **Open PR** primário (`DraftCard.tsx:79`). Com a barra da task 3, `merged` mostra dois **Close task** primários e `draft_ready` dois primários (**Approve draft** e **Open PR**), contra "uma primária por tela" (`components.md:158`) e contra o pronto 11 ("a ação que resolve cada uma fica só na barra"). *Decisão:* no step 8, as notas perdem os botões e ficam com o texto até a task 4 (**Review again** e **Refresh PR** estão no `⋯`, **Close task** na barra); o `DraftCard` mostra **Open PR** só em `awaiting_reply` com `draftAtHand`, onde não há barra `draft`, e em `draft_ready` a ação fica só na barra.

**G4. Quatro mudanças de comportamento sem linha em `changes.md`.** `changes.md:5` diz que é a lista que o usuário confirma; o material decide estas sem ela:

- **Review again deixa de reiniciar uma passada em curso.** Hoje ele vale "a qualquer momento" (`features.md:461`): `canReviewAgain` inclui `reviewing` (`pr-status.ts:152–169`) e o backend aceita `PRReviewing` descartando a sessão (`internal/flow/pr.go:1293–1300`). O material o desabilita com `· a pass is running` (`03:169`; `task.md:287`). E a regra "PR aberta, desabilitado só em `waiting_checks`, `reviewing` e `closing`" o habilita onde o backend recusa (`pr_closed`, `closed`). *Decisão de forma:* a habilitação é `canReviewAgain`, e cada falso tem a razão (`· a pass waits for the checks`, `· the task is closing`, `· the pull request was closed`). *Pergunta de produto*, a única que sobra: desabilitar durante a passada é uma mudança; ou ela entra em `changes.md` T3 para o usuário confirmar, ou o item continua habilitado em `reviewing`, como hoje. A recomendação é a segunda: não há razão de design para tirar a capacidade.
- **Descartar uma etapa de planejamento anterior passa a exigir voltar a ela.** Hoje o chip do PRD oferece **Discard and restart** numa task no plano (`StageTrack.tsx:65–70`), e o do tech spec também. `03:180` registra a mudança em `features.md`, não em `changes.md`. *Decisão:* uma frase em T1 ("só a etapa atual se descarta; uma anterior, voltando a ela").
- **Uma task pausada não tem como aprovar, continuar nem abrir a PR sem retomar.** Uma sessão pausada não tem situação (`internal/attention/derive.go:47–50`), então sem barra (`structure.md:285`) somem **Approve** do step e das mudanças, **Continue** e **Approve draft**; hoje `StepBar.tsx:151–160`, `StageTrack.tsx:178–182` e `PRBar.tsx:192–197` os mostram com a sessão pausada. *Decisão:* uma linha em X15 ("pausada, a task não pede nada: aprovar, continuar e abrir a PR esperam o **Resume**") e o mesmo no material; o `DraftCard` de G3 segue a regra.
- **O step atual perde os relatórios.** `task.md:256` e `03:194` dão ao step atual só o glifo e `now · Agent`; hoje `StepList.tsx:226–231` lista os relatórios de todo step, e T5 diz "os relatórios de cada step". Durante a rodada 1, o relatório que o implementador trata só fica na mensagem do produto da conversa. *Decisão:* o step atual lista os seus relatórios sob ele, como o commitado, sem as linhas de conversa (as duas estão nas abas); `task.md:256` muda junto.

### Médias

**M1. O tooltip do grupo de painéis não diz o nome.** `03:158` dá a cada botão uma descrição como tooltip (`Steps, earlier conversations, reports and the facts of the task`), a mesma forma que `critique-task-02.md` (divergência 9) apontou contra `components.md:375` ("abaixo de 1440 px, só o ícone, com o nome no tooltip e no nome acessível"). *Decisão:* o tooltip é `<Nome> · <descrição>` (`Details · Steps, earlier conversations, reports and the facts of the task`), e o de **Artifacts** hoje (`TaskHeader.tsx:65`) muda junto.

**M2. A pílula diz `working` com a sessão ociosa.** As linhas do step e do PR review (`03:131–137, 141`) dão spinner e `working` pelo `status` do step, sem olhar a sessão; só o planejamento condiciona a `sessionStatus` (`03:128`). Uma sessão parada sozinha depois de 10 minutos (`task.md:341`) deixa a pílula dizendo `working`. *Decisão:* nas linhas em que o agente trabalha (`implementing`, `agent_review`, `addressing_review`, `Manual` sem situação, PR review `reviewing`, PR `drafting`), spinner e `working` só com a sessão do laço `working` ou sem processo ainda (`starting`); fora disso, a pílula sem glifo e sem divisor, e o estado do nome acessível `idle`. As linhas do app (`preparing`, `committing`, `opening`, `closing`) ficam como estão.

**M3. O `pass K` da PR não está definido em metade dos momentos.** A tabela diz `relatórios + 1` em `reviewing`, `relatórios` em `committing` e só `pass K` em "ocioso" e "com situação". `awaiting_decision`, `in_review`, `ready_to_approve`, `trouble` e `awaiting_reply` com PR não dizem qual K. *Decisão:* K é o número de relatórios quando a passada já escreveu o seu (`awaiting_decision`, `in_review`, `ready_to_approve`, `committing`, `done`, `trouble`), e relatórios + 1 da partida da passada até o relatório dela (`reviewing`, `awaiting_reply` com `prNumber > 0`). `waiting_checks` fica sem posição, como `03:139–140`.

**M4. A conversa anterior tem textos e foco em aberto.**
- O lugar (`03:205`) não tem `Implementation · Reviewer`, a conversa do revisor de uma One-Shot.
- O "agora" de **Back to …** é "pela conversa do lugar atual", e há lugares sem conversa: o step bloqueado ou preparando, a PR preparando, esperando os checks antes da passada, `done`, `merged` e `closing` (`internal/flow/pr.go:158–170` dá sessão vazia a `done`), e a implementação de uma One-Shot não está na lista. *Decisão:* o agora sai do lugar, não da conversa: `step N` num step; `the implementation` numa One-Shot; `the PRD`, `the tech spec`, `the plan`, `planning` no planejamento; na etapa de PR, `the PR review` com a conversa do review na tela e `the pull request` no resto.
- Carregando, `03:203` põe `Opening the conversation…` na linha, mas não diz o que a coluna mostra. *Decisão:* a conversa atual fica até a anterior chegar, e só então a coluna troca.
- O foco não está decidido. Com o painel cobrindo, abrir fecha o painel e a linha que tinha o foco some. *Decisão:* ao abrir, o foco vai à região da conversa anterior (`tabindex="-1"`, o nome de `03:205`); ao sair, volta à linha que a abriu quando o painel está aberto, e à região da conversa atual quando não está.

**M5. O `Card` pede um dado que não existe e contradiz o system nos irmãos.** `Pull requests` com "número, título, estado" (`03:209`), mas `CardPullRequest` não tem título (`internal/bindings/dto.go:796–801`). E `components.md:740` diz que um card do board abre com um clique, enquanto o material faz de todo irmão um link externo; a decisão 22 registra só o status em texto. *Decisão:* a linha de PR é `#N · <estado>` (com o repositório quando é outro); os irmãos e as dependências são links externos até a task 5, que dá o painel do card no board aos que têm `onBoard` (`dto.go:804–809`), e isso entra na decisão 22 e no escopo da task 5.

**M6. O medidor com a task pausada contradiz a regra dele.** O medidor mede a conversa na tela (`03:156`), e `03:154` diz que ele fica `—` "com a task pausada", que é a sessão do laço (`loopSession`, `step-status.ts:158–172`). Com a aba do implementador na tela e o revisor pausado, os dois leem sessões diferentes. *Decisão:* `—` quando a sessão na tela está pausada.

**M7. A idade tem dois formatos no app.** `03:233` decide `just now`, `2m ago`, `3h ago`, sem segundos, mas `task.md:287` e `components.md:634` escrevem `checked 40s ago`; e `lib/boards.ts:44` (`relativeTime`) diz `4 min ago`, `2 h ago`, lida pelos cabeçalhos do board e de Reviews: a mesma idade teria duas formas no app. *Decisão:* abaixo de um minuto, `just now`, e `task.md:287` e `components.md:634` passam a `checked just now`; `lib/when.ts` substitui `relativeTime` e os dois leitores (`features/board/BoardHeader.tsx:32`, `features/reviews/ReviewsHeader.tsx:24`) no step 4, para o app ter uma idade só.

**M8. A lista dos checks não diz os estados que o GitHub devolve.** `03:229` tem cinco estados. `gh.Check` só guarda `Pending` e a conclusão (`internal/gh/checks.go:10–15, 60–82`), que pode ser `neutral`, `cancelled`, `timed_out`, `action_required`, `stale` ou `startup_failure`; e um `StatusContext` `PENDING` ou `EXPECTED` não diz se roda ou está na fila. *Decisão:* `neutral` aparece como `skipped` (o visto em `--ink-4`, a palavra `neutral`); toda conclusão que `Check.Failed` conta como falha aparece como `failed`, com a conclusão do GitHub no tooltip; `QUEUED`, `WAITING`, `REQUESTED`, `PENDING` de um CheckRun e `EXPECTED` de um StatusContext são `queued`; `IN_PROGRESS` e `PENDING` de um StatusContext são `running`.

### Baixas

**B1. Os popovers abertos do `⋯`.** O mock ancora o popover no botão `⋯` (`b.html:2345`, `from: "more-btn"`), e o material diz só que "o foco volta ao gatilho", que é um item que já sumiu. *Decisão:* aberto do `⋯`, o popover se ancora no `⋯` e devolve o foco a ele; ao abrir, o foco vai à opção escolhida (`radiogroup`) ou ao primeiro chip editável (Models).

**B2. Três textos dos popovers divergem do system.** Salvando é `Saving…` na nota (`03:182`) e `· saving…` em `components.md:268`; o erro do popover Models (`components.md:277`, a razão e **Try again** sob a linha, `role="alert"`) não está no material nem no pronto 6; a largura `calc(var(--space-16) * 5.5)` é um valor montado sem token. *Decisão:* vale o material em `Saving…`, e `components.md:268` muda; o erro de Models entra como `components.md` o diz; a largura vira `--size-popover: 22rem` em `tokens.css`.

**B3. O estado do nome acessível não diz qual momento dá qual texto.** `03:152` lista os estados sem a linha da tabela a que cada um pertence: a PR `preparing` não tem estado, e `checking GitHub` serve a dois momentos. *Decisão:* uma coluna "estado" na tabela da pílula (`preparing` → `checking GitHub`, como `prStatusLabel` diz). E `<Quem>` numa passada do PR review é `PR agent` (`lib/sessions.ts:73–75`), enquanto `task.md:330` escreve `Reply to the PR reviewer…`: o nome da conversa do review da PR é um só nos dois documentos.

**B4. `Resume` sem hora.** Uma sessão pausada antes desta versão tem `paused = 1` e `paused_at` nulo. *Decisão:* tooltip e nome `Resume the task`, sem `· paused since`, e a segunda linha do tooltip do stepper sai.

**B5. `Details` e `Artifacts` em casos de borda.** O campo `Pull request` não diz a PR mergeada ou fechada (*decisão:* `#1284 · into dev · merged`); `Base` mostra o `origin/` que `baseBranch` guarda (*decisão:* sem o prefixo, como `prBaseName`, `pr-status.ts:89–91`); uma One-Shot antes da implementação não tem o grupo `Implementation` (dizer); uma One-Shot não tem `Step files` em `Artifacts` (dizer); uma implementação sem nenhum step (`StepPane.tsx:56–64`) dá à pílula `Implementation` sem posição.

**B6. O mínimo do título fica para o tech spec.** `03:350` manda o tech spec "cortar o espaço entre as peças" se o título ficar abaixo de 200 px a 812 px. É design. *Decisão:* abaixo de 900 px, o espaço entre as ferramentas da direita vai de `--space-2` a `--space-1`.

**B7. A cedência diz duas coisas sobre o nome da atual.** `task.md:44`, `structure.md:223` e `principles.md:103` dizem que os nomes da atual e das futuras cedem por último, e a tabela (`task.md:46–54`) nunca tira o nome da atual. *Decisão:* "por último os nomes das futuras; o nome da etapa atual nunca sai".

**B8. Divergências do mock que faltam na decisão 22.** `Artifacts` sem as linhas `not yet` do mock (`b.html:2408–2409`), e a altura `--space-1` de folga sobre as abas (`b.html:1384`), que o material não diz nem descarta.

## 2. As 22 decisões da §4.3

| # | Situação | Nota |
|---|---|---|
| 1 | Coerente, com as perdas de G1 | Registrada em `implementation.md:70, 74, 82` |
| 2 | Coerente | `ReviewStrip` sobe acima das abas hoje (`StepPane.tsx:81–84`); "sob as abas" é a ordem nova, dita |
| 3 | Coerente | Registrada em `task.md:99`; `components.md:448` e `structure.md:229` ainda dizem "com a barra" |
| 4 | Coerente | `components.md:531` (Marco em linha) ainda não tem **Open in Details** |
| 5 | Coerente | |
| 6 | **Contradiz o produto** | A falta de reticências é forma; a habilitação muda comportamento (G4). `changes.md:28` (T3) ainda escreve **Review again…** |
| 7 | **Perde uma ação** | **Discard draft** (G1) |
| 8 | Coerente, incompleta | M2, M3 e G2 |
| 9 | Coerente | B3 |
| 10 | Coerente | Casa com `withStepTab` (`store/app-store.ts:357–366`) e com o recuo de `openStepTabOf` (`:1105–1113`) |
| 11 | Coerente, com M6 | |
| 12 | Coerente, com M7 | |
| 13 | Coerente | P44 é só do modo |
| 14 | **Contradiz o system e o dado** | M5 |
| 15 | Coerente, incompleta | M4 |
| 16 | Coerente | `passingConclusions` em `internal/gh/checks.go:45`; M8 |
| 17 | Coerente | O escopo da task 6 em `implementation.md:106` não a registra; uma frase lá |
| 18 | Coerente | |
| 19 | Coerente | |
| 20 | **Contradiz o backend** | G2 |
| 21 | Coerente | Falta `FLASH_MS` (seção 0) |
| 22 | Coerente, incompleta | M5 e B8 |

As que mudam comportamento sem `changes.md`: 6 (Review again em `reviewing`), a de `03:180` (descartar uma etapa anterior), e duas que o material nem lista como decisão: a task pausada sem ação (G4) e o step atual sem relatórios (G4).

## 3. Inventário, DTOs e dados, por amostragem

Conferem com o código: as linhas dos DTOs (`Step` 147–187, `PullRequest` 267–326, `Situation` 349–370, `TaskSummary` 393–447, `BoardCard` 831–854, `TaskCard` 857–867), `session/service.go:928–943`, `flow/service.go:137`, `flow/step.go:638–641`, `bindings/task_service.go:245–263`, `git/commands.go:308–319`, `task/service.go:744–755`, `canReviewMyself` e `loopSession` em `step-status.ts`, `PanelId` e `openStepTabOf` em `app-store.ts`, as regras `attention-flash` de `globals.css` e os leitores de `ContextGauge`, `PauseButton`, `ModelPicker` e `ReviewModePicker`.

Não conferem:

- **`PRBar.tsx` na §5.1** (`03:292`) omite **Close task** em `trouble`, `Couldn't confirm the merge` em `trouble` e **Discard draft** em `drafting`, que são a origem de G1.
- **A tabela `worktrees`** está em `store/migrations/0015_items.sql:69–82`, com `base` desde `0013`; `03:339` cita `0004` e `0006`, que não têm `base`.
- **`flow/pr.go:489–497`** é `prDetails`; a chamada de `SetPRDetails` está em `:467`.

**P42 a P45 estão dimensionados certo**, pequenos: as sessões fechadas ficam no banco com as entradas (`sessions`, `transcript_entries`), `sessions.created_at` existe, `worktrees` tem `path`, `branch` e `base`, e `SetStepReviewMode` tem a guarda a copiar. Duas coisas que o material deve dizer: `session.Service.Discard` apaga a linha da sessão (`session/service.go:498–513`), e **Review again** descarta a do PR review a cada vez (`flow/pr.go:1299`), então a conversa `PR review` de `Details` é sempre a da última passada; e P43 vindo das linhas de `sessions` mostra também a sessão fechada da etapa atual quando ela não tem conversa na tela (a PR em `done`), que é o caso de M4. P13 também é pequeno, mas o estado de fila pede o `status` do CheckRun, que `CheckNode` já lê e `checkOf` descarta (`gh/checks.go:73–82`).

## 4. O plano de 12 steps

O backend vem antes do frontend que o lê (steps 1 a 3), e cada step deixa o app usável. Os problemas:

1. **O step 7 é grande demais para um commit revisável**: o topo novo, a cedência, o medidor, **Pause** com os estados, o `⋯` com três grupos e os diálogos, `Ctrl+E`, três barras, a saída de quatro componentes, a tabela das cenas, os testes de CSS, as capturas e sete seções de `features.md`. *Decisão:* dividir em 7a (o `⋯` e as barras de `step_review`, `step_empty` e `ready_to_continue`; saem `StageTrack` e `StepBar`) e 7b (o topo com o stepper, a cedência, o medidor e **Pause**; saem `StatusBadge`, os botões de Review mode e Models e a lixeira). São 13 steps, dentro de G (9 a 14; `03:380` chama 12 de "o teto de G", e o teto é 14).
2. **O step 10 deixa as linhas de conversa sem ação até o step 11**, uma forma provisória que `03:380` proíbe. *Decisão:* o step 10 não desenha as linhas de conversa (o grupo `Planning` nasce no 11).
3. **O step 6 liga os popovers aos botões velhos do topo** para tirá-los no step seguinte, a mesma forma provisória. *Decisão:* o step 6 entrega os popovers e os chips testados, sem ligação, e o step 7 os liga pelo `⋯`.
4. **`storage.md` no step 3 documenta colunas dos steps 1 e 2.** Cada step documenta o que cria (`03:380`): `sessions.paused_at` e `steps.committed_at` no 1, `pr_runs.checks` no 2.
5. **G3 cai no step 8**, que é onde as notas de `PRPane` passam a conviver com a barra.

## 5. Os 17 itens de pronto

Verificáveis como estão: 1, 2, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17. Não:

- **3 e 4 pedem "capturas do app"** a larguras exatas de janela, e o app só roda no Wails; é o mesmo problema de `critique-task-02-input.md` (R8), e a task 2 terminou sem as capturas que o pronto dela pedia (`critique-task-02.md`, item 11). *Decisão:* as capturas saem de um teste pintado (`*.painted.test.tsx`, Chromium) que monta `TaskView` com as fixturas a cada largura de área principal (812, 950, 996, 1134, 1566 e 2180 px, as áreas das janelas de 1100, 1250, 1300, 1450, 1920 e 2560 px com a lateral em `clamp`), claro e escuro, e grava as imagens anexadas ao pull request; a conferência na máquina alvo fica para uma largura só.
- **11** promete a ação só na barra, e o material mantém as notas de `PRPane` com os botões (G3). Verificável depois de G3.

## 6. Coerência das edições em `design/`

As edições de `task.md`, `structure.md`, `components.md`, `principles.md`, `implementation.md` e `backend.md` concordam entre si no essencial: a cedência com `width < N`, o qualificador, a coluna de 960 px, a conversa anterior, **Review again** sem diálogo na task, os ícones novos, P42–P45 no lugar de F4 (a contagem de `backend.md`, 45, 3 e 20, confere). Ficaram para trás:

- `changes.md:28` (T3) ainda diz **Review again…**.
- `components.md:448` e `structure.md:229` dizem "com a barra do pedido" onde `task.md:99` passou a dizer "com uma situação".
- `components.md:531` (Marco em linha) não tem **Open in Details**, que `task.md:149` acrescentou.
- `implementation.md:94` ainda cria a lista de relações na task 5, e o material a cria na task 3.
- `principles.md:103`, `structure.md:223` e `task.md:44` contra a tabela (B7).
- `structure.md:113` com `Ready to close · PR #P merged` na forma `close` sem merge (G2).

## Contraste medido

Os pares novos do topo, das abas, do `⋯`, dos popovers e dos painéis, convertidos de OKLCH para sRGB, com os véus compostos em srgb sobre a superfície de baixo. Todos passam; os mais apertados:

| Par | Claro | Escuro | Exigido |
|---|---|---|---|
| Círculo da etapa futura `--line-deco` sobre `--surface-1` | 3,45 | 3,69 | 3 |
| Anel de foco `--focus` sobre a pílula (`--brand-tint-plane`) | 4,71 | 5,51 | 3 |
| Nome da pílula `--brand-ink` sobre `--brand-tint-plane` | 5,35 | 7,10 | 4,5 |
| Razão do item desabilitado `--ink-3` sobre o hover do menu | 6,53 | 5,53 | 4,5 |
| Descrição da opção escolhida `--ink-3` sobre `--brand-tint` | 6,15 | 5,36 | 4,5 |
| Item **Delete task…** em hover, `--state-error` sobre `--state-error-veil` | 5,42 | 5,77 | 4,5 |
| Etapa futura `--ink-4` sobre `--surface-1` | 6,05 | 6,45 | 4,5 |
| `· waits` `--state-wait` sobre `--surface-1` | 6,11 | 10,49 | 4,5 |
| `now` `--brand-ink` sobre `--surface-0` (painel) | 5,76 | 9,80 | 4,5 |
