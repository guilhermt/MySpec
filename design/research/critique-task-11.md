# Crítica da task 11 · History, arquivados, diálogos da task, avisos e notificações (PR #92)

Leitura da branch `58-redesign-11-history-archived-items-task-dialogs-notices` em `ecc3a62` (14 commits, 183 arquivos fora de `frontend/bindings`, CI verde), na worktree de revisão. A régua, nesta ordem:

- `design/tasks/11-history-dialogs.md` (o material; `11:N` é a linha N dele);
- `screens/rest.md` §3, §4, §8–§11;
- `structure.md`, `principles.md`, `system/components.md` e `system/tokens.css`;
- `changes.md` (X10–X16, X20, S7), `backend.md` (P27–P30, P33, P37) e `decisions.md`;
- o mock `lab/14-screen-rest/index.html` e as fontes que o material aponta.

Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa. A PR não muda nada em `design/`.

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** o History por dia, os três arquivados, os diálogos que esperam o fim, as páginas que saíram, os toasts dos três tipos e os 61 textos estão lá, e quase tudo segue o material ao pé da letra.
  - Os 61 corpos e todas as variantes de `11:389–468` batem com `internal/attention/text.go` palavra por palavra. O título do review leva o título da PR.
  - No app real, a prévia de **Delete task** leu do git `3 uncommitted files` e `not merged · 9 commits`. A busca alcançou os antigos com `10 of 80`, e o toast levou à linha recém-arquivada.
  - Nada do que saiu deixou referência.
- **Mutações:** rodei 581.
  - No Go, 206: morrem 187. Das 19 que sobrevivem, três são equivalentes. A janela de 90 dias no estado não tem prova nenhuma (bloqueio 6).
  - No frontend, 375: morrem 332. Das 43 que sobrevivem, quatro são equivalentes. A guarda do foco do `⋯` (§4.3 #33) não tem prova, e a prova de corte nunca morde (bloqueio 6).
- **O que falta fazer:** são seis bloqueios.
  - As capturas de 12b não foram publicadas, o corpo da PR não tem as tabelas nem a checklist da máquina alvo, e as fixtures mostram o que o produto não diz.
  - **Back to…** e **Discard and restart…** a partir da etapa de PR escondem a implementação inteira do que se perde.
  - A linha recém-arquivada fura toda busca enquanto se fica no History.
  - O comando do que ficou no disco não funciona quando o git já esqueceu a worktree.
  - O cabeçalho do arquivado põe o glifo e a etiqueta à direita.
  - Faltam provas que o material pede: a janela no estado, uma linha por texto em `text_test.go` e o foco do `⋯`.

O bloqueio 4 pede decisão do coordenador. Os outros não pedem decisão.

**Sobre as capturas.** A branch `captures/58-…` existe no `origin`, com 88 capturas, todas `history-*`. O push é de 03:40Z, antes de `9bafeb6` e `ecc3a62`. Faltam as 112 de `dialogs-*` e `gone-*`. As 88 publicadas são idênticas pixel a pixel às que a ponta gera. O corpo da PR não tem tabela nenhuma (bloqueio 1).

**Sobre a máquina alvo.** O pronto 10 (`11:28`) é do usuário, e o corpo da PR não tem a checklist `## Verification on the target machine` (bloqueio 1).

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`. `task check` rodou na worktree de revisão; as outras, em cópias no scratchpad. Todas verdes:

| Suíte | Resultado |
|---|---|
| `task check` (tidy, lint, typecheck, `test`, vuln, bindings) | verde em 113 s; `git status` limpo depois |
| `task test:go` (dentro do check) | 3.438 testes, 1 pulado (`dnd`, dependente da máquina) |
| `task test:web` (`--changed`, dentro do check) | 8.906 testes em 397 arquivos |
| `vitest --project unit`, inteiro, numa cópia | 7.113 testes em 343 arquivos, 125 s |
| `vitest --project painted`, inteiro, numa cópia | 2.300 testes em 104 arquivos, 162 s |
| `go test -race -count=5` em `attention`, `task`, `store`, `app`, `flow`, `worktree`, `reviewflow` | 4.155 execuções de topo, nenhuma corrida |
| idem em `bindings`, pulado `TestRegisterEventsRegistersEveryEvent` | 1.225 execuções, verde |
| `task bindings:check` | sem diff |

- **A falha da race em `bindings`:** é a mesma da task 10. `internal/bindings/events_test.go:14` entra em pânico na segunda repetição porque o registro de eventos do Wails é global. Na `main` (`148a295`) acontece igual.
- **O CI e a PR:** **Changes**, **Go** e **Frontend** verdes, **Build** pulado. A PR está `MERGEABLE` e `CLEAN`, com a cabeça em `ecc3a62`.
- **O pronto 8, commit a commit.** Os 14 commits foram extraídos com `git archive`.
  - `go build`, `go vet`, `pnpm typecheck`, `biome ci` e `vitest --project unit` passam em todos.
  - `go test ./internal/...` teve duas falhas intermitentes, em commits que só mudam o frontend, com a máquina em carga 16. Uma foi em `internal/reviewflow/apply_test.go:679`, em `8d29c99`; a outra em `internal/bindings/task_service_test.go:1372`, em `9bafeb6`. Os dois testes passam 30 e 40 vezes isolados, e nenhum é desta PR (item 16 de "Podem esperar").
  - Todo teste apagado teve substituto no mesmo commit. `StepList` e `StatusDot` saíram no step 8, como `11:712` prevê.
  - **O tamanho** (`implementation.md:7`, até ~1,5 mil linhas): cinco commits passam do limite. São `50726a9` (2.564), `8d29c99` (2.005), `bd89d45` (1.701), `1c4fee2` (1.666) e `ecc3a62` (1.595); veja o item 15 de "Podem esperar".

### Mutações

Cada mutação rodou numa cópia desligada do git, só com os testes que ela alcança. O Go rodou com `-count=1`. O pintado precisou de `api: { port, strictPort: true }` no projeto `painted` da cópia. "Falha (n)" é o número de testes que falharam. A tabela traz as que importam; as outras morrem.

| Pronto | Mutação | Onde | Resultado |
|---|---|---|---|
| 3 P37 | Os 17 corpos que mudam, no texto e na derivação (o artigo do lugar, a sessão `pr_review`, as contagens, o número da PR, a razão, os commits `-1`, o texto da task no review, os rascunhos que falharam) | `internal/attention/text.go:38–316`, `derive.go:94–258`, `derive_review.go:48–85`, `derive_discussion.go:46–54` | falha (2 a 10) cada |
| 3 P37 | Amostra dos 34 "igual" e dos 10 "feito", e cada variante de `11:457–468` | `text.go:61–466` | falha (4 a 16) cada |
| 3 P37 | `reasonOf`: cada prefixo não tirado, a frase inteira, sem minúscula, sem as exceções, o erro cru sem `~`, sem o `.`, a razão vazia | `text.go:336–396` | falha (2 a 15) cada |
| 3 P37 | O prefixo não marca o erro como cru; um erro cru terminado em `.` tratado como frase; `firstSentence` sem exigir o espaço | `text.go:370`, `:374`, `:385` | **sobrevivem** (3) |
| 3 P37 | Os arquivos do step com `Review.Err` (diria `0 files changed.`) | `derive.go:163` | **sobrevive** |
| 3 P37 | `reviewStates` volta a `stored.Reference`, sem o título | `internal/app/state.go:178` | **sobrevive** (`reviewTitle` só é testado isolado) |
| 3 P27/P28 | `close`, `base`, `mergedBy`, `mergedAt`, o SHA; `hasPrDraft`, `prReports` | `internal/bindings/convert.go:448–521` | falha (2 a 3) cada |
| 3 P27/P28 | `ArchivedPR` com número 0; `structured` sem `pass.Recorded` | `convert.go:449`, `:512` | **sobrevivem** |
| 3 P29 | Cada parte, as combinações, o DTO, o do review | `internal/worktree/close.go:239–260`, `internal/flow/step.go:1030`, `convert.go:555–573`, `internal/reviewflow/delete.go:44` | falha (1 a 5) cada |
| 3 P29 | O erro da branch juntado ao da worktree | `close.go:250` | **sobrevive** |
| 3 P30 | O desconhecido como 0, a mergeada como -1, a falha como 0, base e branch trocadas | `internal/flow/close.go:223–238`, `internal/worktree/service.go:363` | falha (1 a 3) cada |
| 3 P30 | A contagem lida quando `Merged` falhou; `FromDeletePreview` sem `Ahead` | `flow/close.go:231`, `convert.go:540` | **sobrevivem** |
| 3 P33 | A janela de 89 dias; sem `Truncate` | `internal/bindings/history.go:15`, `:24` | falha (1) cada |
| 3 P33 | `since` sem filtro; a fronteira exclusiva; o snapshot com o History inteiro | `internal/app/state.go:144`, `:73` | **sobrevivem** (3) |
| 3 P33 | O resumo, a ordem, a busca, o filtro, `Matched`, o cursor, a página, `GetArchived`, `archivedTaskName`, `Bind` | `history.go:18–159`, `history_service.go:47`, `convert.go:2402–2434`, `internal/task/service.go:435`, `services.go:81` | falha (1 a 8) cada |
| 3 P33 | O mais antigo sem as discussões; `more` com `>=`; `repositoryStates` sem `ArchivedDiscussions` | `convert.go:2417`, `history.go:143`, `state.go:109` | **sobrevivem** |
| 4 | `history-list`, `history-rows`, `archived`, `close-result`, `deletion`, `stage-actions`, `gone-task`, `toasts`: 266 regras | `features/history/*.ts`, `features/task/*.ts`, `features/navigation/gone-task.ts`, `features/notice/toasts.ts` | morrem 257 |
| 4 | O dia em UTC, não no fuso local | `features/history/history-list.ts:146` | **sobrevive** (nenhuma fixture perto da meia-noite) |
| 4 | O vizinho: o anterior antes do seguinte | `history-list.ts:244` | **sobrevive** (`11:237`) |
| 4 | O review fechado decidindo `Archived` por `mergedAt` | `archived.ts:258` | **sobrevive** (`11:208`) |
| 4 | Sem o detalhe do git na branch e na base que falharam; o toast sem a branch que falhou | `close-result.ts:70`, `:102`, `:147` | **sobrevivem** (3) |
| 4 | `the PRD conversation and document` virando `the PRD`; `1 review report` sem o singular | `stage-actions.ts:132`, `:72` | **sobrevivem** |
| 5 | Sem o aviso do `--force`, o aviso sempre, só o primeiro comando, a legenda | `features/navigation/GoneView.tsx:94–109` | falha cada |
| 5 | As linhas fora de ordem; `Worktree removed` e `Branch … deleted` vazios; sem o erro do git; o cabeçalho do `CopyBlock` em caixa alta | `gone-task.ts:50–65`, `GoneView.tsx:106` | **sobrevivem**: o teste não confere as linhas feitas nem a ordem, e não tem a worktree removida com a branch que ficou |
| 6 | 27 renomeações | vários | falha cada |
| 6 | 16 renomeações não pegas: **Show all repositories** do vazio, `Archived` da task, o esqueleto, o erro de leitura, `read only`, o arquivo do step, o link do card do review, o caminho na prévia, `PR #N is merged`, Discard só com o implementador, três itens do que se perde, `Open #N` da nota, o caminho do que ficou | `HistoryView.tsx:256`, `ArchivedTask.tsx:198`, `:232`, `ArchivedDocument.tsx:42`, `ArchivedDiscussion.tsx:186`, `archived.ts:124`, `:250`, `deletion.ts:38`, `:90`, `:173`, `stage-actions.ts:103`, `:132`, `:134`, `StageActionDialog.tsx:116`, `gone-task.ts:55` | **sobrevivem** em `where-actions-went.test.tsx` |
| 2 | `/`, `↓` da busca, o fim que pede os antigos, a recém-arquivada no centro, a parada de Tab, `Ctrl+Enter` e `Esc` inerte nos quatro diálogos, os focos depois de cada desfecho | `HistoryView.tsx`, `features/board/useListTree.ts`, os diálogos | falha cada (27) |
| 2 | Sem `handsFocus` no `⋯` da task, do arquivado e do review | `features/task/TaskMenu.tsx:79`, `features/history/ArchivedMenu.tsx:43`, `features/reviews/ReviewMenu.tsx:62` | **sobrevivem** (bloqueio 6) |
| 2 | O `×` habilitado durante o apagamento | `features/task/DeleteTaskDialog.tsx:53` | **sobrevive** |
| — | `placeIn` sem o cache, no review; apagar um arquivado fora da janela não volta ao History | `store/app-store.ts:911`, `store/actions.ts:1104` | **sobrevivem** |
| 1 | Pixel fracionário (linha, dia, encerramento, prévia, toast, bloco do que ficou), o diálogo fora de `round(8vh, 1px)`, seis primárias a mais, **Cancel** que anda com a falha, `where` desalinhado a 812, o limiar de 860 | vários | falha cada (17) |
| 1 | O nome, o onde e o título de What it published sem tooltip | `components/system/ListRow.tsx:625`, `:632`, `ArchivedDiscussion.tsx:53` | **sobrevivem**: nada corta nas cenas |
| 1 | `where` cortado na lista estreita; a hora à esquerda | `ListRow.tsx:632`, `:657` | **sobrevivem** |

**Os equivalentes:**
- No Go, três: o literal 3 no corpo 12 (`MaxCorrections` é 3, e a situação só nasce no máximo); a exceção `gh` de `reasonOf`; e o ramo `len(failed) == 0` de `text.go:269`, que nada alcança.
- No frontend, quatro: `changes · 0 findings` (`archived.ts:142`); os steps `not_started` contados (`stage-actions.ts:67`); e os dois `moreRef.focus()`, que o jsdom não distingue.

**A prova de corte nunca morde.** Uma sonda nos quatro `*.scenes.painted.test.tsx` deu `cutTexts` vazio nos 200 casos: nada corta, nem a 812. Além disso, `features/history/HistoryView.scenes.painted.test.tsx:164` confere só os oito primeiros cortes (`slice(0, 8)`), contra "todo texto cortado com tooltip" de `11:19`.

**Textos.** Os 61 corpos e as variantes batem com `11:389–468`. Três desvios menores estão no item 12 de "Podem esperar".

### Capturas

- **No `origin` e na PR:** a branch tem as 88 `history-*`: 48 do History (8 variações × 3 larguras × 2 temas) e 40 dos arquivados (10 × 2 × 2). Faltam as 112 de `dialogs-*` e `gone-*`. Pelo `gh api contents`, `history-history-812-light` existe e `dialogs-delete-task-2180-light` dá 404. O corpo não tem tabela nenhuma (bloqueio 1).
- **Numa cópia:** `MYSPEC_CAPTURES=1` nos quatro testes gravou 200 capturas, com `TZ=UTC`: 88 `history-*`, 72 `dialogs-*` e 40 `gone-*`. Todas as cenas e todos os `?v=` de `11:19` existem, inclusive os decididos só no material, nas larguras pedidas (812 só no History).
- **O mock:** servi o lab de uma cópia na porta 8141, encerrada pelo PID, e fotografei cada cena nas janelas de 2560, 1280 e 1100. As 200 montagens ficaram lado a lado, com o mock à esquerda, fora do repositório.
- **Nenhuma captura tem tooltip ou hover herdado.** A página que saiu tira o foco de **Next that needs you** antes de capturar (`GoneView.scenes.painted.test.tsx:283–284`).
- **O que bate:** a lista a 2180, 978 e 812, com onde e o resultado em segunda linha alinhados a 812; a contagem `44 archived · Sep 12 – today`; os vazios; a recém-arquivada; os fatos e o encerramento; What it published; a prévia com as contagens; o rodapé dos diálogos; o cabeçalho de frase do `CopyBlock` (§4.3 #35); os toasts com o detalhe; a pausa como regressão.
- **O que diverge**, fora o que `11:547` já aceita:
  - o cabeçalho do arquivado, com o glifo e a etiqueta à direita (bloqueio 5);
  - **Back to the PRD?** a partir da PR sem a implementação (bloqueio 2);
  - as fixtures que mostram o que o produto não diz, e as cenas de antigos que não mostram o assunto (bloqueio 1);
  - os diálogos fora do lugar que teriam no app, porque a cena monta a área a partir de x = 0 de uma janela de 1280. A 978, o diálogo fica encostado à direita da área (item 14);
  - o `←` tracejado em todas as cenas de History, arquivados e página que saiu, porque a cena não tem pilha. O mock mostra o `←` ativo (item 14);
  - os títulos do Markdown do PRD e do One-Shot em cerca de 24 px (item 9);
  - o review arquivado denso: cada apontamento aberto como cartão, com `published Yesterday 13:41` (item 6);
  - a página que saiu: **Next that needs you** sem `Ctrl J` no botão, o bloco que encolhe ao conteúdo, a linha do `--force` e o `CopyBlock` dentro do bloco afundado (item 8);
  - `gone-gone-review` diz `rsouza merged it into dev at Yesterday 16:20` (item 8);
  - `gone-notice*` mostra `Working · 0.0s` no compositor, com o relógio do turno solto (item 14);
  - os dias saem `Tuesday, Sep 22`: o app está certo para 2026, e o mock usa os dias de 2025.

## Bloqueiam o merge

1. **As capturas e a checklist não estão na PR, e as cenas mostram o que o produto não mostra** (prontos 1 e 10).
   - **O que falta:**
     - as capturas de `dialogs-*` e `gone-*` em `captures/58-…`;
     - as tabelas no corpo, lado a lado com o mock, a 2180, 978 e 812 (History) nos dois temas;
     - a checklist `## Verification on the target machine` de `11:28`: a notificação de uma task e a de um review com o título `acme/web#2291 · <título da PR>`, o toast de um review mergeado no GitHub e a prévia de apagar uma task real, cada um com o preparo, o texto que confere e a caixa das capturas do usuário.
   - **As fixtures:**
     - `features/navigation/GoneView.scenes.painted.test.tsx:97`: o erro do git é `…use --force to delete it`. É o erro que §4.3 #13 (`11:533`) diz que o produto não recebe e manda trocar. O review apagado reusa o caminho `…/idempotency-keys` da task;
     - `test/history-scenes.ts:377`: `mergedAt` é a hora do arquivamento. Por isso o fato e a página encerrada dizem `merged … at 15:02` onde `11:164` e `11:336` dizem `14:51`;
     - a página da task apagada (`gone-gone-deleted`) usa `Idempotency keys for payment intents` com `PR #1279 stays open on GitHub`, a PR que a mesma cena diz mergeada. `11:343` usa `Rate limit per API key` e `PR #1284`;
     - `test/task-scenes.ts:279–299`: `inPR` tem a branch `rate-limit`, contra `rate-limit-per-api-key` da prévia e de `11:258`, e não tem `prState: "open"` nem rascunho. Por isso `dialogs-back-to-stage-pr` não pinta a nota `PR #1284 stays open on GitHub` nem `the pull request draft`, que `11:317` e `11:322` pedem;
     - o step 3 de `discard-step` não tem relatórios, então nenhuma cena pinta `with the 2 reports of the agent review` (`11:273`);
     - `test/history-scenes.ts:820–825`: `scrollToEnd` rola até o sentinela antes de existir a linha do pé. Por isso `history-history-older-loading` e `older-failed` não mostram `Loading older items…` nem `Couldn't load older items…`: a linha fica abaixo dos 800 px da captura.
   - **Mudar:**
     - corrigir as fixtures, e o `scrollToEnd` depois da linha do pé;
     - rodar `task captures` e `task captures:push` na ponta e pôr no corpo as tabelas com a coluna do mock;
     - escrever a checklist no corpo.
   - Não pede decisão.

2. **Back to… e Discard and restart…, a partir da etapa de PR, escondem a implementação.**
   - **Onde:** `features/task/stage-actions.ts:65–69`. `startedSteps` filtra `step.number <= task.currentStep`, e o Go dá `currentStep` 0 quando todos os steps estão feitos (`internal/bindings/convert.go:771–781`). Na etapa de PR, `implementationItem` não acha step nenhum e o item some.
   - **O efeito:**
     - na captura `dialogs-back-to-stage-pr`, `Back to the PRD?` lista o tech spec, o plano, a PR e a worktree, sem `the conversations of steps 1 to 7 and their 9 review reports` que o mock mostra;
     - no app real (`081`, `100`), `billing-export` com dois steps feitos e `throwaway-delete` com um perdem a linha.
   - **O avesso:** antes da PR, um step `blocked` que nunca teve conversa entra em `steps 1 to 4` (app `075`).
   - **A régua:** `11:307–320` e X14, o diálogo que diz exatamente o que se perde. É a etapa em que mais se perde, e o diálogo omite a maior parte. Os testes de `stage-actions.test.ts` não têm a task na PR com `currentStep` 0.
   - **Mudar:** os steps que começaram são os que têm conversa ou execução (ou todos os feitos quando a task passou da implementação), não os de número até `currentStep`. Um caso de tabela com a task na PR, e a fixture `inPR` com os relatórios.
   - Não pede decisão.

3. **A linha recém-arquivada fura toda busca enquanto se fica no History.**
   - **Onde:** `features/history/history-list.ts:108`. `entry.id === fresh || (inFilter(…) && matchesQuery(…))` deixa a linha de fora da busca e do filtro enquanto o lugar tem `fresh`.
   - **O efeito**, no app real (`138`, `141`, `142`):
     - depois de **Open in History**, qualquer busca (`#398`, `old-tas`, `zzz`) mostra a linha;
     - o cabeçalho do dia conta a linha (`Today 2` ao lado de `1 of 80`);
     - com `zzz`, o vazio `Nothing matches “zzz”` nunca aparece, e a tela fica só com a linha e `0 of 80`.
   - **A régua:** `11:131` e §4.3 #4. A chegada limpa a busca, e a exceção é só do filtro: "o filtro fica, e a linha aparece assim mesmo". Uma busca digitada depois é do usuário e vale para todas as linhas.
   - **Mudar:** a recém-arquivada passa só por fora do filtro, nunca da busca; o dia não a conta quando ela está fora do filtro. Um teste com a busca depois da chegada.
   - Não pede decisão.

4. **O comando do que ficou no disco não funciona quando o git já esqueceu a worktree.**
   - **O caso** (app real, `104`): o `git worktree remove` falhou por permissão. O git e o `prune` de `internal/worktree/close.go:247` já tinham tirado a worktree do registro, e a branch foi apagada.
   - **O comando** da página, `git worktree remove --force <caminho>`, dá `fatal: '<caminho>' is not a working tree` (exit 128); conferido à mão no clone de teste. A pasta fica no disco, e a página dá um comando que não a remove.
   - **A régua:** §4.3 #13 (`11:533`) manteve o comando contando que "com uma permissão, o erro do git diz o que fazer". O caso mais comum depois do prazo é justamente o que deixa a pasta fora do registro.
   - **Mudar:** o Go diz, no `Leftover`, se a pasta continua registrada como worktree, e a página dá `git worktree remove --force <caminho>` quando continua e outro comando quando não (`rm -rf <caminho>`, com o mesmo aviso do `--force`), com casos em `gone-task.test.ts`.
   - **Pede decisão do coordenador:** é o comando que §4.3 #13 decidiu. **Opinião:** o par de comandos acima.

5. **O cabeçalho do arquivado põe o glifo e a etiqueta à direita.**
   - **Onde:** `features/history/ArchivedTask.tsx:230–243`, `ArchivedReview.tsx:132–140` e `ArchivedDiscussion.tsx:200–214`. Os três passam o glifo e o `Tag` como filhos de `LocationHeader`, que os põe no lado direito (`features/navigation/LocationHeader.tsx:9–10`, `:84`).
   - **O efeito:** à esquerda fica só o título. À direita, juntos, ficam o glifo, `Archived` (ou `Merged`, `One-Shot`), o link e o `⋯` (captura `history-archived-task-978-light`).
   - **A régua:** `11:149` e `components.md:321` (variante Arquivado): "o glifo do tipo, o título, a etiqueta, e à direita o link do GitHub ou do board e `⋯`". O mock faz assim. O tipo e o estado do item lidos junto do nome são a hierarquia do cabeçalho.
   - **Mudar:** `LocationHeader` com um lugar antes e depois do título (ou a variante Arquivado no `PlaceHeader`), e uma prova pintada da ordem.
   - Não pede decisão.

6. **Faltam provas que o material pede** (prontos 2, 3 e 1).
   - **A janela no estado** (`11:21`, "a janela de 90 dias"): `history.go` prova a constante. Mas `since` e o snapshot (`internal/app/state.go:73`, `:144`) não têm teste: o estado com o History inteiro, sem filtro ou com a fronteira trocada passa em toda a suíte.
   - **`text_test.go`, "uma linha por texto dos 61"** (`11:21`): não têm linha própria o 4, o 6, o 35, o 36, o 49, o 50 e o 51.
     - O 6 (`The session stopped with an error in step 3.`) não aparece com o texto exato em teste nenhum.
     - O título do review com o título da PR está provado só em `reviewTitle`, isolado; `reviewStates` voltando a `stored.Reference` passa (`state.go:178`).
   - **O foco do `⋯`** (§4.3 #33, `11:553`, "um teste jsdom prova que o menu não devolve o foco"): tirar `handsFocus` do `⋯` da task, do arquivado e do review passa em toda a suíte (`TaskMenu.tsx:79`, `ArchivedMenu.tsx:43`, `ReviewMenu.tsx:62`). É a correção que a task 10 teve de fazer depois da crítica (`critique-task-10.md`, bloqueio 4).
   - **O corte:** nenhuma cena corta texto, e a conferência do History para nos oito primeiros (`HistoryView.scenes.painted.test.tsx:164`). `11:19` pede "todo texto cortado com tooltip"; hoje a prova não prova nada.
   - **Mudar:**
     - um teste de `snapshot` (ou de `since` com a ordem), com um item no limite;
     - as sete linhas em `text_test.go` e um teste do título montado em `reviewStates`;
     - o teste do `⋯`: abrir pelo menu, com `expect.poll` depois de cada `Tab`, ou um teste que finja a devolução do foco do `Menu`;
     - uma cena com nomes longos (o History a 812, o título do arquivado, What it published), sem `slice`.
   - Não pede decisão.

## Podem esperar

Em ordem de gravidade.

1. **O foco das setas some sob a barra fixa do History.** No app real (`005–010`, `026–031`), `↓` e `Home` movem o foco certo, mas a lista rola e põe a entrada focada sob a `FilterBar`, sem anel à vista. Causa provável: `scrollIntoView({ block: "nearest" })` em `features/board/useListTree.ts:126–131`, sem `scroll-margin` para a barra. Pelo Tab, o anel aparece. **Mudar:** `scroll-margin-top` da altura da barra nas entradas da lista; vale também para o board.

2. **A página da task apagada com o que ficou repete a falha da prévia.** Em `dialogs-delete-task failed`, a worktree aparece duas vezes: `The worktree is removed` com o caminho e `◇ Couldn't read the worktree` (`features/task/deletion.ts:30–48`). `11:256–257` são duas linhas da tabela para dois casos ("Existe" e "O `git status` falhou"), e o mock troca uma pela outra. Nenhuma cena mostra a leitura inteira que falhou (`Couldn't read the worktree and the branch`).

3. **Os cards de entrada da discussão arquivada não são links.** `features/history/archived.ts:331–337` escreve `from api#447 and api#449` como texto (app `051`); `11:153` pede as referências como links externos.

4. **O nome do relatório do review arquivado é inventado.** `features/history/ArchivedReview.tsx:34` escreve `reviews/pass-${n}.md`, e o arquivo é `review-<n>.md` (`internal/bindings/dto.go:1393`; app `032`). O erro vem de `11:210`. **Mudar:** mostrar `pass.file`, e o coordenador corrige `11:210`.

5. **As rodadas da discussão arquivada.** `archived.ts:316–320` conta só as rodadas com rascunho publicado; a página que saiu (`features/navigation/gone-rounds.ts:24`) conta todas. Uma discussão com três rodadas e a última sem publicação diz `2 rounds` nos fatos e mostra três rodadas na página. `11:220` diz as rodadas de P25, que são as da discussão.

6. **O review arquivado é mais denso que o material.** Cada apontamento abre como cartão, com o corpo, e diz `published Yesterday 13:41` ou `Jun 30, 13:41` (`features/reviews/review-conversation.ts` via `outFindingViews`, `archived.ts:295–297`). A passada logo acima diz `published Sep 23 at 13:41`. `11:153` dá uma regra de data só; `11:210` pede os apontamentos fechados, "abrindo o texto que foi".

7. **Faltam peças pequenas de `11:149`:**
   - **Open on GitHub** do review não tem o tooltip `Open web#2291 on GitHub` (`ArchivedReview.tsx:135`);
   - dois `api` ainda se confundem: `globex/api` sem board sai `api` ao lado de `acme/api` (app `004`), porque `features/history/history-rows.ts:14–18` só escreve `dono/nome` quando o item tem board.

8. **A página que saiu diverge do mock em quatro pontos:**
   - **Next that needs you** não mostra `Ctrl J` no botão, só no tooltip (`components/system/GonePage.tsx:55–75`, da task 2), contra `11:341`;
   - o bloco do encerramento encolhe ao conteúdo, cerca de 385 px contra os 624 da medida (app `108`);
   - a linha do `--force` e o `CopyBlock` ficam dentro do bloco afundado `Git couldn't remove everything` (`GoneView.tsx:86–112`). O mock os põe fora, com o `CopyBlock` na superfície dele;
   - `gone-passes.ts:16–28` (task 6) monta `merged it into dev at Yesterday 16:20`, porque `clockTime` já devolve `Yesterday 16:20`.

9. **Os títulos do Markdown dos documentos do arquivado pesam mais que o título do lugar.** Em `history-archived-task` e `oneshot`, `Context` e `What to fix` saem em cerca de 24 px; o mock usa `--text-ui` 600. É o item 3 da task 10 de novo: `.ui-headings` está no rascunho da PR (`ArchivedTask.tsx:63`), não no PRD, no tech spec nem no One-Shot (`ArchivedDocument.tsx:65`).

10. **O P33 não é o que `11:621` dizia, e a janela é em UTC.**
    - O History inteiro fica em memória nos services de domínio. A janela, o resumo e as páginas são cortados em memória, e cada página de `HistoryService` converte o History inteiro (`internal/app/state.go:127–140`, `internal/bindings/history_service.go:55–57`).
    - `docs/architecture/storage.md:30` registra isso, e o custo medido é baixo: 3,5 ms e 2 MB por página com 2.000 tasks. Mas o destino de `11:621` (`internal/store/tasks.go`, `reviews.go`, `discussions.go`) e a "consulta com data de corte" de `backend.md` P33 não aconteceram.
    - `WindowStart` (`internal/bindings/history.go:24`) começa à meia-noite UTC de 90 dias atrás, entre 90 e 91 dias, e não no fuso local.
    - **Opinião:** a forma em memória serve; o coordenador registra a troca em `backend.md` P33.

11. **Os diálogos de **Discard step** e **Delete task** em pontos finos:**
    - desmarcar **Also clean the worktree** muda a descrição de tamanho e desce o rodapé 18 px (app);
    - o `×` habilitado durante o apagamento não tem prova (`DeleteTaskDialog.tsx:53`);
    - um diálogo aberto pelo teclado abre em **Cancel**, mas sem anel visível no WebKit.

12. **Os textos, três desvios menores:**
    - `internal/attention/text.go:377`: o erro cru tira todo `.`, `!` e `?` do fim antes de pôr o `.`; `11:470` diz que ele "entra inteiro";
    - `text.go:269–271`: o texto velho `The drafts couldn't be published.` continua num ramo que nada alcança;
    - `archived.ts:385`: `Not published` para um rascunho aprovado e não publicado sem erro, um quarto texto fora dos três de `11:223`.

13. **As mutações que sobrevivem** (veja "Mutações"), fora as do bloqueio 6. Um caso cada:
    - **No Go:** `reasonOf` com um erro cru terminado em `.` e um prefixo que não marca o cru; `firstSentence` com `api.github.com.`; `Review.Err` na contagem dos arquivos; a contagem `ahead` com `Merged` falhando; `FromDeletePreview` com `Ahead`; o erro da branch separado do da worktree; `ArchivedPR` com número; `structured` sem `Recorded`; o mais antigo do resumo sendo uma discussão; 50 itens exatos sobrando; `repositoryStates` com `ArchivedDiscussions`.
    - **No frontend:**
      - o dia no fuso local perto da meia-noite;
      - o vizinho seguinte antes do anterior;
      - o `Archived` do review fechado;
      - o detalhe do git na branch e na base que falharam;
      - os dois textos de `stage-actions.ts`;
      - a página da task apagada com as linhas feitas, a ordem e a worktree removida com a branch que ficou (pronto 5, `11:23`: "cada combinação de P29");
      - `placeIn` com o cache no review;
      - o arquivado fora da janela que volta ao History depois de apagado.
    - **`where-actions-went.test.tsx`** não pega 16 renomeações. Faltam, de `11:9`: **← Steps**, a prévia de **Delete task** linha a linha, **Back to…** (só **Discard and restart…** tem linha), a PR que fica aberta e o link do card do review.

14. **As cenas fora do lugar do app.**
    - Os diálogos são centrados numa janela sem lateral (`dialogs-*` e `history-archived-*-delete`); a 978, o diálogo encosta na direita da área.
    - O `←` sai tracejado em todas as cenas, porque não há pilha.
    - `gone-notice*` mostra `Working · 0.0s`, com o relógio do turno solto, e o aviso fala do reviewer quando quem trabalha é o implementer.

    Não mentem sobre o produto, mas a captura não é o que o usuário vê. **Mudar:** a lateral nas cenas de diálogo, a pilha com um lugar atrás, e o relógio do turno fixo.

15. **Cinco commits passam do tamanho** de `implementation.md:7`: `50726a9` (2.564 linhas, o step 5, que `11:708` estimava em ~850 mais 572 apagadas), `8d29c99` (2.005), `bd89d45` (1.701), `1c4fee2` (1.666) e `ecc3a62` (1.595). `11:700` manda dividir antes do commit. Já estão feitos; fica registrado para a task 12.

16. **Miúdos.**
    - O toast cobre o começo do compositor quando a task aberta tem a conversa no fim (app `124`).
    - `findArchived` engole a falha do Go e volta ao History sem dizer nada (`store/actions.ts:1207–1218`).
    - Na discussão arquivada, um documento que não se lê vira `No document was written.` (`ArchivedDiscussion.tsx:164–167`): uma falha de leitura diz que o documento não existe.
    - As etiquetas `3 uncommitted files` e `not merged · 9 commits` saem em mono, porque o `Tag` é mono; o mock não usa mono.
    - Os dois testes Go intermitentes de "Suítes" (`reviewflow/apply_test.go:679`, `bindings/task_service_test.go:1372`) esperam sem sincronizar com o gravador; não são desta PR.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | As cenas, as variações, as larguras, os temas e o relógio batem com `11:19`, e as provas de pixel, de 8vh, de primária e de `footerPlaces` morrem. Falham: as capturas de 12b e as tabelas no corpo, as fixtures e as cenas de antigos (bloqueio 1), e a prova de corte, que nunca morde (bloqueio 6) |
| 2 | Parcial | `HistoryView.keys.test.tsx` e os testes dos diálogos: 27 mutações de teclado e foco morrem. O foco do `⋯` (§4.3 #33) não tem prova (bloqueio 6), e o anel some sob a barra fixa (item 1) |
| 3 | **Falha** | P27–P30 e o resumo, a página e a busca de P33 provados em tabela, e os 61 textos certos. Falta a janela no estado, uma linha por texto para sete deles e o título montado em `reviewStates` (bloqueio 6) |
| 4 | Ok, com ressalva | 266 regras, 257 morrem; sobrevivem o fuso, o vizinho, o `Archived` do review fechado, os detalhes do git e dois textos (item 13). A lista do que se perde está errada na PR (bloqueio 2) |
| 5 | Parcial | O `--force`, o **Copy** e o comando provados. Não estão provadas as linhas feitas, a ordem nem a worktree removida com a branch que ficou (item 13). O comando não funciona num caso real (bloqueio 4) |
| 6 | Ok, com ressalva | `where-actions-went.test.tsx` com 42 linhas pega 27 renomeações e deixa passar 16, e faltam linhas de `11:9` (item 13) |
| 7 | Ok | Nenhum token novo; `design/system/tokens.css` intocado. Nenhuma cor, tamanho ou duração solta nos arquivos novos |
| 8 | Ok | `task check` verde na ponta; cada commit compila, passa o lint, o typecheck e o jsdom. Duas falhas Go intermitentes alheias. Nenhum teste removido sem substituto. Cinco commits acima do tamanho (item 15) |
| 9 | Ok | `features.md` reescrito nas seções que `11:27` lista; `overview.md`, `storage.md`, `design-system.md`, `target-machine.md`, `testing.md` e `setup.md` tocados, no presente, sem histórico. A medida dos 400 itens está no teste pintado e o pedido de medir no WebKitGTK está em `target-machine.md:83` |
| 10 | **Falha** | O corpo da PR não tem a checklist `## Verification on the target machine` (bloqueio 1) |
| 11 | Esta crítica | — |

## O que saiu

- **Os arquivos:**
  - `features/history/HistoryPanel.tsx`, `ArchivedTaskView.tsx` (com os testes) e `history-format.ts`;
  - `features/reviews/ArchivedReviewView.tsx` e `features/discussion/ArchivedDiscussionView.tsx` (com os testes);
  - `features/task/OneShotView.tsx`, `StepList.tsx`, `StatusDot.tsx` e `OrphanPRs.tsx` (com os testes);
  - `components/CardLink.tsx`, `features/sidebar/RepositoryFilter.tsx`, `features/notice/LeftoversNotice.tsx` e `Notice.tsx` (com os testes).
- **O que mais saiu:** `SessionRunning` não aparece mais em `internal/` nem em `frontend/src`; o `Leftover` único do store deu lugar a `leftovers` pelo id; o `join` dos erros de `internal/worktree/close.go`.
- **Fica, como o material pede:** `DeleteReviewDialog` e `DeleteDiscussionDialog` com a variante do arquivado; `gone-passes.ts` e `gone-rounds.ts`; `discussion-status.ts`.

Nada importa o que saiu, e `docs/` e `design/` (fora de `tasks/` e `research/`) não citam nenhuma das peças.

**Comportamento fora de `changes.md`.** São todos menores:
- **Delete review** do review ativo espera o fim e mostra a falha no rodapé. É o que `11:377` decide, dentro de X13.
- A busca do History casa `#N` com a PR e o card de uma task (§4.3 #3, registrada em `decisions.md`).
- A recém-arquivada fica fora da busca além do filtro (bloqueio 3), o que nenhum documento decide.
- `WindowStart` em UTC (item 10).

## Tokens e contraste

**`tokens.css` não muda.** Os arquivos novos usam os tokens de `11:25` (`--list-measure`, `--col-where`, `--col-result`, `--col-time`, `--measure`, `--size-dialog`, `--size-toast`, `--epic-indent`, `--notice-detail-min`). Os passos numéricos do `Toast` (`gap-2.5`, `py-2.5`) são da task 2.

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css` resolvidos no Chromium, com os véus compostos (claro / escuro). Todo texto passa 4,5:1:
- a linha e o dia, sobre `--surface-1`: `--ink-1` 17,83 / 14,96; `--ink-2` 10,73 / 10,95; `--ink-3` 7,15 / 8,01; `--ink-4` (a hora, a contagem da barra) 6,06 / 6,47;
- o hover, sobre `--veil-hover`: `--ink-1` 16,05 / 12,73; `--ink-3` 6,44 / 6,82; `--ink-4` 5,46 / 5,50;
- a recém-arquivada, sobre `--brand-tint-plane`: `--ink-1` 15,11 / 11,55; `--ink-2` 9,09 / 8,46; `--ink-3` 6,06 / 6,19; `--brand-ink` (o glifo) 5,37 / 7,13;
- o chip pressionado, `--brand-ink` sobre `--brand-tint`: 5,42 / 6,18;
- sobre `--surface-0` (o encerramento, a prévia, a nota, o que ficou no disco): `--ink-1` 16,21 / 15,88; `--ink-2` 9,75 / 11,63; `--ink-3` 6,51 / 8,51; `--ink-4` 5,51 / 6,87;
- os diálogos e o toast, sobre `--surface-3`: `--ink-1` 18,10 / 12,41; `--ink-2` 10,89 / 9,09; `--ink-3` (o detalhe do toast, a linha apagada) 7,26 / 6,65; `--ink-4` 6,15 / 5,37;
- `--state-error`: sobre `--surface-0` 5,46 / 7,14; sobre `--surface-1` (o pé dos antigos) 6,01 / 6,73; sobre `--surface-3` (o rodapé do diálogo) 6,10 / 5,58;
- o aviso do app, sobre `--state-error-veil`: `--ink-1` 16,12 / 12,85; `--ink-2` 9,69 / 9,41; `--state-error` 5,43 / 5,78;
- o botão perigoso, `--state-error-on` sobre `--state-error`: 6,10 / 7,34;
- a primária, `--brand-on` sobre `--brand`: 5,65 / 7,77;
- os links, `--brand-ink`: sobre `--surface-1` 6,34 / 9,23; sobre `--surface-0` 5,76 / 9,80; sobre `--surface-3` 6,43 / 7,66.

**Não texto:**
- o anel `--brand-ring` da recém-arquivada: sobre `--surface-1` 4,30 / 4,50; sobre o tint-plane 3,64 / 3,47. Passa 3:1;
- a borda `--line-3` do `Tag`: sobre `--surface-0` 3,15 / 3,92; sobre `--surface-1` 3,46 / 3,69. Passa;
- a borda `--line-2` do bloco de **Also clean the worktree** sobre `--surface-3`: 1,53 / 1,31. Falha 3:1, mas o bloco é agrupamento; o estado é a caixa marcada e o rótulo;
- o contorno `--line-1` de What it published (1,28 / 1,27) e os fios entre linhas (1,17 / 1,34): decorativos.

**Estado sem cor como único portador:**
- ` · dev not updated` e `Closed` se distinguem pelo peso 500 e pelo texto;
- as linhas do encerramento e do que ficou no disco têm o visto, o traço ou o glifo de erro, além do texto;
- a recém-arquivada tem `aria-selected` e `, just archived` no nome;
- a prévia diz cada coisa em texto, com a etiqueta;
- o pé dos antigos que falhou diz `Couldn't load older items` com `role="alert"`;
- o `◇` da linha do `--force` é `aria-hidden`, e a frase carrega o sentido.

**O foco:** o anel é o do system em toda peça nova. O anel encoberto pela barra fixa está no item 1.

## No app real

**Como rodou:**
- `task build` numa cópia em `ecc3a62`;
- `bin/myspec` sob `env -i`, com os `XDG_*` no scratchpad e `XDG_RUNTIME_DIR` próprio em `/tmp`, apagado no fim;
- `dbus-run-session` com config própria;
- `GDK_BACKEND=broadway` (`gtk4-broadwayd :33`, porta 8113), dirigido por um Chromium headless do Playwright, a 1920×1080 e a 1100×800, nos dois temas.

**O banco** foi semeado por `sqlite3` depois da primeira abertura:
- tasks, reviews e discussões arquivadas de hoje a 408 dias, de outro ano inclusive, com `close_result` variados, PRs com base e merge, SHAs, `pr_passes`, rascunho e relatórios nos artefatos, um review em Apply e uma discussão com rascunhos criados, atualizados e descartados;
- tasks ativas com worktrees git reais, arquivos não commitados e commits à frente da base.

Sem `claude`, sem `gh` e sem `GH_TOKEN`; nada foi escrito no GitHub. A única confirmação destrutiva foi numa task de teste semeada (`throwaway-delete`), mais três encerramentos de tasks de teste para a página e o toast. O app, o barramento, o broadwayd e o driver foram encerrados pelo PID. O MySpec do usuário não foi tocado.

**O que o app mostrou** (capturas em `scratchpad/app/shots/`, fora do repositório):
- **O History:**
  - os dias (`Today`, `Yesterday`, o de outro ano);
  - a contagem do History inteiro (76, depois de 77 a 80, a cada encerramento);
  - o chip `Only acme/web` com `36 of 80`;
  - a busca por `#card` e por `#PR`, e `Searching older items…` seguido de `10 of 80`;
  - os antigos entrando ao rolar até o fim;
  - as duas linhas a 1100, o vazio e o tema escuro;
  - o teclado da busca à linha, e `Enter` abrindo o arquivado (`032`).
  
  Problemas: a recém-arquivada que fura a busca (bloqueio 3), o foco sob a barra (item 1) e os dois `api` (item 7).
- **Os arquivados:** os fatos, o encerramento, as abas, o SHA e o rascunho da PR na task; cada passada no review, também em Apply; What it published e a conversa somente leitura na discussão. Problemas: o nome do relatório (item 4), os cards como texto (item 3) e as duas formas de data (item 6).
- **Delete… dos arquivados:** os textos da tabela de `11:231–235`, o foco em **Cancel**, o Tab preso e `Esc` de volta ao `⋯`. Cancelado em todos.
- **Delete task:** a prévia lida do git, com `3 uncommitted files`, `not merged · 9 commits` e `PR #1284 stays open on GitHub`. `Deleting…` vem com **Cancel** e `×` tracejados, e a página da task apagada aparece com o diálogo indo junto.
- **Discard step, Back to… e Discard and restart…** antes da PR: os textos, e a caixa que volta marcada a cada abertura. A partir da PR, sem a implementação (bloqueio 2).
- **As páginas que saíram:** a da task encerrada, com o bloco `Closing`, e a da apagada, com o bloco do que ficou, o aviso do `--force` e o comando que falha (bloqueio 4).
- **O toast:** `Closed at 07:25 · dev not updated: another branch is checked out`, e **Open in History** levou à linha destacada (`131`).
- **O log:** só o ambiente e o provocado.

**O que o app não mostrou:**
- **A linha da sessão interrompida:** sem `claude`, nenhum turno roda. As cenas e `deletion.test.ts` cobrem a forma.
- **Os estados lendo e falhou da prévia e o brilho dos antigos:** a leitura local é rápida demais. As cenas `loading`, `failed`, `reading` e `older-loading` cobrem a forma, com a ressalva do bloqueio 1.
- **`Couldn't load older items` e as falhas no rodapé dos diálogos:** não provoquei falha. As cenas `older-failed` e `error` e os testes de `footerPlaces` cobrem.
- **O review apagado com o que ficou, e os toasts de review e de discussão:** pedem `gh`.
- **As notificações reais:** pedem o servidor de notificação; é o pronto 10, do usuário.

## Segunda leitura (abe3c1a)

Leitura das correções `ecc3a62..abe3c1a` (31 commits, 94 arquivos fora de `frontend/bindings`), sem rodar o app. As mutações rodaram em cópias no scratchpad, com a máquina em carga 20 a 50.

### Veredito

**Corrigir antes do merge.** Os seis bloqueios estão fechados, e o comportamento que eles pediam está no código. Sobram três coisas pequenas, nenhuma pede decisão:

1. **As cenas do item apagado pintam o comando que o bloqueio 4 trocou.**
   - **Onde:** `features/navigation/GoneView.scenes.painted.test.tsx:119–124`. A fixture `stayed` junta `Permission denied` a `registered: true`.
   - **O efeito:** `gone-gone-deleted` e `gone-gone-review-deleted` mostram `git worktree remove --force` diante de uma permissão. Pela regra de `11:533` e de `rest.md:473`, esse é o caso de `rm -rf`, e é o que `internal/worktree/close_test.go:347` prova no Go. Nenhuma captura mostra `rm -rf` nem o aviso dele.
   - **Mudar:** pôr `registered: false` nessa fixture (ou um erro de prazo com `true`), criar uma cena com `rm -rf` e publicar as capturas de novo.
2. **`↓` da busca põe o primeiro dia atrás da barra.** É a causa do `HistoryView.reach` instável (veja "Testes instáveis"). O item 1 da primeira leitura continua aberto nesse caminho, e o teste esconde isso.
3. **A janela dos reviews no estado não tem prova.** `since(archivedReviews, …)` em `internal/app/state.go:87`, trocado pelo History inteiro, passa. `TestTheStateCarriesTheHistoryFromTheStartOfTheWindow…` semeia só tasks e discussões. **Mudar:** pôr no teste um review no limite da janela e outro antes dela.

`HistoryView.measure` também falha sob carga, mas é uma prova de tempo absoluto, sem defeito do produto; a correção está em "Testes instáveis".

### Bloqueios e itens

| | Situação | Evidência |
|---|---|---|
| B1 capturas, corpo, checklist, fixtures | **Fechado, com uma fixture nova errada** | `captures/58-…` em `7ccbd18`, gravada 3 min depois de `abe3c1a`: 200 capturas (88 `history-*`, 72 `dialogs-*`, 40 `gone-*`). O corpo tem as tabelas com a coluna do mock nas larguras e nos dois temas, e as 200 URLs existem (nenhum 404). A checklist `## Verification on the target machine` cobre `11:28`. As fixtures de `inPR`, `stepReports`, `mergedAt` e `scrollToEnd` estão corrigidas: `older-loading` mostra `Loading older items…`. A fixture nova de `stayed` contradiz o bloqueio 4 (ponto 1 do veredito) |
| B2 o que se perde a partir da PR | Fechado | `features/task/stage-actions.ts:65–79`: os steps que rodaram ou têm conversa. A volta a `step.number <= currentStep` morre em 3 testes, e `blocked` fora de `UNSTARTED` morre. A captura `dialogs-back-to-stage-pr` diz `the conversations of steps 1 to 7 and their 9 review reports` e `PR #1284 stays open on GitHub.` |
| B3 a recém-arquivada e a busca | Fechado | `history-list.ts:108` e `historyDays` com `uncounted` (`:196`), com `HistoryView.tsx:90–93`. As três mutações morrem ("leaves it to a search typed after the arrival") |
| B4 o comando do que ficou | Fechado | `Registered` (`internal/worktree/close.go:268–284`) lê `git worktree list --porcelain -z` (`internal/git/commands.go:103–119`) depois do prune. A informação passa por `reviewflow/delete.go:47` e `convert.go:558`, `:575`, e `gone-task.ts:79–109` escolhe entre `rm -rf` e `--force`. Das 13 mutações, morrem 11; as duas que sobrevivem são equivalentes (`Clean(wt.Path)`, a ordem diante do prune). Está registrado em `rest.md:473`, `11:533`, `features.md` e `overview.md`. A fixture das cenas está errada (ponto 1 do veredito) |
| B5 o cabeçalho do arquivado | Fechado | O `lead` em `PlaceHeader.tsx:156` e `ArchivedTags` em `progress`, nos três arquivados. O `lead` depois do título e o glifo de volta como filho morrem em 40 casos de `Archived.scenes`. A captura `history-archived-task` mostra o glifo, o título e as etiquetas, nessa ordem |
| B6 as provas | **Fechado, menos a janela dos reviews** | Morrem `since` sem filtro e a fronteira exclusiva (`state.go:145`), o snapshot inteiro de tasks e discussões (`:74`, `:94`), `reviewStatesOf` com `Reference` (`:188`), as sete linhas de `text_test.go` e os três `handsFocus` (com `test/menu-exit.ts`). `long-names.painted.test.tsx` corta e confere o tooltip (três mutações morrem), e `slice(0, 8)` saiu. **Sobrevive** o snapshot dos reviews (`state.go:87`) |
| 1 foco sob a barra | **Parcial** | `BELOW_THE_BAR` (`HistoryView.tsx:51`) vale para as teclas da lista: `Home` e `↑` passam nos testes. O `↓` da busca, não (ponto 2 do veredito) |
| 2 worktree repetida | Fechado | `deletion.ts:30–52`; a captura `dialogs-delete-task-failed` tem uma linha |
| 3 cards como links | Fechado | `links` em `archived.ts` e `ArchivedFacts.tsx` |
| 4 nome do relatório | Fechado | `pass.file` em `ArchivedReview.tsx:38`, e `11:210` corrigido |
| 5 rodadas | Fechado | `roundsSentence` conta todas as rodadas, como `gone-rounds.ts:24` |
| 6 review denso | Fechado | `ArchivedFindings.tsx`: linhas fechadas que abrem o texto, sem hora (as duas mutações morrem). A captura mostra uma forma só de data |
| 7 tooltip e os dois `api` | Fechado | Tooltip em `ArchivedReview.tsx:138`; `sharedNames` em `history-rows.ts:12–36` |
| 8 página que saiu | Fechado | `Ctrl J` no botão (`GonePage.tsx:62`), blocos na medida de 624 px, aviso e comando fora do bloco (`GoneView.tsx:86–111`), `atMoment` em `gone-passes.ts:16–23` |
| 9 títulos do Markdown | Fechado | `.ui-headings` em `ArchivedDocument.tsx:65` |
| 10 P33 e UTC | Fechado | Registrado em `backend.md` P33 e em `storage.md:30`. `WindowStart` à meia-noite local; a troca por UTC morre em três fusos |
| 11 Discard e Delete | Fechado no que se prova | O rodapé parado em `DiscardStepDialog.tsx:90–105` (a mutação morre no pintado) e o `×` inerte (morre). O anel em **Cancel** no WebKit fica para a checklist |
| 12 os três textos | Fechado | `reasonPart` (`text.go:351–360`) e o cru inteiro (`:382`), com as mutações mortas. O ramo morto saiu, e `Not published · failed` está registrado em `11:220` |
| 13 mutações vivas | Fechado | No Go morrem as 16 antigas, menos a janela dos reviews. No frontend morrem todas menos duas: o `where` estreito (`ListRow.tsx:634`), aceitável com tooltip, e a caixa alta só no pintado, que morre no unit. Morrem 15 das 16 renomeações; `the pull request draft` morre em `stage-actions.test.ts` |
| 14 cenas no lugar do app | Fechado | `centeredInWindow`, `windowForMain`, `back` nas cenas, `Working · 3m 40s` com o implementer |
| 15 tamanho dos commits | Para a task 12 | — |
| 16 miúdos | **Parcial** | Fechados: o toast acima do compositor (`toast-lift.ts`, `Composer.tsx:121`), `findArchived` com o aviso (`actions.ts:1208`) e a faixa com **Try again** (`ArchivedDiscussion.tsx:171`, `:247`). Abertos: o `Tag` em mono, que é a definição do system (`Tag.tsx:9`) e fica, e os dois Go intermitentes de antes da PR |

### Testes instáveis

**`HistoryView.reach`, "keeps the first day below the bar…": é um defeito do produto.**
- **O resultado:** 10 execuções, com a suíte `unit` inteira rodando em laço ao lado (carga 27 a 50). Foram 6 verdes, 2 falhas desse teste (tema escuro) e 2 que não importaram o arquivo, porque eu disputei o `.vite` da cópia.
- **A causa:** uma sonda com o mesmo roteiro registrou o `scrollTop` a cada evento:
  - o `scrollIntoView` do `onArrowDown` (`HistoryView.tsx:301–306`) põe 0;
  - logo depois, o Chromium aplica a ação padrão do `↓`, que ninguém previne (`components/system/SearchInput.tsx:75`), e rola a lista 40 px em cerca de 150 ms: 10, 17, 25 … 40;
  - no fim, o dia está em 64 e a barra termina em 104.

  A sonda esperou 1,5 s e falhou nas 15 execuções.
- **Por que o teste costuma passar:** `vi.waitFor` (`HistoryView.reach.painted.test.tsx:81`) aceita a primeira leitura verdadeira, feita antes da animação andar. Só a carga atrasa essa leitura.
- **O pedido dos antigos:** a hipótese não se confirma; `olderLists` ficou `{}` em toda a sonda.
- **A prova da causa:** com `event.preventDefault()` no `↓` de `SearchInput.tsx:75`, a sonda passou 15 de 15, e o `reach`, 6 de 6.
- **Mudar:**
  - prevenir a ação padrão quando `onArrowDown` existe. Isso conserta também o `↓` da busca do board (`BoardFilterBar.tsx:123`), que tem o mesmo caminho;
  - no teste, esperar a rolagem parar (`scrollend`, ou a posição estável por alguns quadros) antes de afirmar, no lugar de `vi.waitFor`.

**`HistoryView.measure`: é uma prova de tempo absoluto, sem defeito.**
- **O resultado:** com a mesma carga, falhou em 9 de 10. A mediana da primeira pintura ficou entre 1.808 e 4.730 ms (teto de 3.000), e a do `↓` entre 571 e 1.752 ms (teto de 500). Sozinha, passou 4 de 4.
- **Mudar:** tirar a medida da corrida paralela, num projeto `measure` rodado sozinho depois do `painted`. A alternativa é um teto relativo: 400 itens contra 40 na mesma execução, o que pega "a lista deixou de ser lista" sem depender da carga.

### Suítes e CI na ponta

| | Resultado |
|---|---|
| `task check` | Verde em 115 s: 3.469 testes Go (1 pulado, `dnd`), 9.244 web em 423 arquivos, sem vulnerabilidades, bindings sem diff. `git status` limpo depois |
| `go test -race -count=3` em `app`, `attention`, `task`, `worktree` | Com a máquina parada, verde em 17 s e sem corrida. Com carga 47 a 50, dois testes de `internal/app/attempt_test.go` (`:104`, `:295`) estouram o prazo de 5 s do `waitFor`. Em `ecc3a62` acontece igual, e com `-parallel 2` passam |
| `gh pr checks 92` | Changes, Go e Frontend verdes, Build pulado; `MERGEABLE`, `CLEAN`, a cabeça em `abe3c1a` |

### O que as correções abriram

Nada grave. Fora os três pontos do veredito:
- **`GonePage` com `--space-6` e sem `items-start`:** vale para todas as páginas que saíram, inclusive a do board removido, que não tem bloco. Bate com `.left` do mock (`lab/14-screen-rest/index.html:1808`, 672 − 48 = 624 px). Nada quebrou.
- **`lead`:** só os três arquivados o usam. Os outros cabeçalhos não mudam (`PlaceHeader.tsx:156` desenha o `lead` só quando ele existe).
- **`useToastLift`:**
  - só o `Composer` o chama. Sem compositor, `--toast-lift` não existe e o `.toasts` cai no `0px`;
  - há um compositor por vez, e a troca de aba remonta com `key`;
  - **Miúdo:** o toast sobe acima do compositor, mas não da barra do pedido (`TaskRequest`), que fica logo acima dele. Com três toasts e um pedido aberto, eles cobrem o começo da barra. **Opinião:** medir a partir do pé fixo inteiro.
- **`isMissingFile` (`lib/errors.ts:34`) é frágil.**
  - Depende de o texto `no such file or directory` atravessar `failure` cru. Isso vale hoje porque `discussion.Service.ReadArtifact` (`internal/discussion/service.go:683`) não traduz `os.ErrNotExist`, ao contrário do da task (`internal/task/service.go:1097`, que embrulha `ErrNotFound`).
  - O teste usa uma mensagem escrita à mão, sem contrato com o Go.
  - **Opinião:** o Go devolve `""` para um `discussion.md` ausente (o frontend já trata vazio como "não escrito"), ou um sentinela com mensagem fixa em `userMessages`. Pode esperar.
- **`gone-passes.ts:47` e `:82`:** as passadas da página do review ainda usam `clockTime`. A mesma página diz `merged it into dev on Sep 23 at 16:20` e `Yesterday 09:00` nas linhas (captura `gone-gone-review`). São duas formas de data na mesma página, a mesma classe do item 8. Pode esperar.
- **`Textarea`, `CutText` e `Select` das tasks anteriores:** nenhum dos três está no diff.
- **Os merges em `features.md`, `testing.md`, `design-system.md`, `overview.md` e `storage.md`:** estão no presente, sem frase repetida nem contraditória. Em `testing.md:79–80`, `centeredInWindow` e `windowForMain` aparecem duas vezes, mas cada vez em sua cena.
- **`11-history-dialogs.md`:** as linhas alteradas (`:210`, `:220`, `:533`) batem com o código.
- **Sem prova, sem gravidade:** `UNSTARTED` sem `preparing` (`stage-actions.ts:67`) sobrevive.
- **Sem captura:** não há captura com nomes longos; o corte é provado só em `long-names.painted.test.tsx`.
