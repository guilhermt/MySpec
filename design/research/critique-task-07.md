# Crítica da task 7 · Apontamentos estruturados na PR da task (PR #77)

Primeira leitura da branch `54-redesign-7-structured-findings-on-the-task-s-pull-request` em `ae4104a` (11 commits, 125 arquivos, CI verde), na worktree de revisão. A régua é:

- `design/tasks/07-task-findings.md` (o material; `07:N` é a linha N dele);
- `screens/task.md` §7–§9 e §11, e `screens/review.md` §9, §10, §14 e §20;
- `structure.md`, `principles.md`, `system/components.md` e `system/tokens.css`;
- `changes.md` T16, T27 e R19, e `backend.md` M1, P10 e P19;
- `decisions.md`;
- o mock `lab/10-screen-task-minimal/b.html` (`?scene=findings` e `?scene=close`).

Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** a task entrega o que o material pede, e o que ela entrega funciona. Estão lá:
  - `prreport` extraído, com `ApplyMessage` e a seção dos descartados nas duas telas;
  - a `0022`, o domínio em `task` e o fluxo das passadas estruturadas, com o `done` derivado e `awaitingMerge`;
  - a situação `findings` nas formas `decide` e `apply`, com os textos de notificação e da árvore;
  - o cartão ancorado na conversa da PR, com `A`/`D`, **Edit**, `O` e `Ctrl+E`;
  - **Next to decide**, **Approve the rest** nas duas telas e **Apply approved**;
  - `No file changed`, `Nothing approved in pass 1`, os marcos `revised` e `You decided`;
  - a passada em texto conduzida como hoje, e a documentação.
- **Mutações:** rodei 85; 78 morrem. Das sete que sobrevivem, quatro não mudam nada que a régua peça (uma é equivalente, uma é fraca e foi refeita, e duas não têm efeito visível). Três mostram provas que faltam:
  - o `trouble` que a leitura do GitHub grava num `done` derivado;
  - a limpeza do cache das passadas em `ClearPRRun`;
  - a mensagem de `ErrNothingApproved`.
- **O que falta fazer**, como na task 6:
  - a PR não tem as capturas do pronto 1 (nem a branch `captures/54-…`, nem as tabelas no corpo), e a cena `findings-sent` desenha o `You decided` fechado;
  - o ciclo real do pronto 9 não foi feito nem registrado.
- **Nenhum defeito de tela bloqueia.** O defeito de comportamento mais sério é a pausa durante a aplicação. Uma passada enviada e pausada no meio do trabalho do agente aparece como `Review changes`, e é possível aprovar o trabalho pela metade (item 1 de "Podem esperar").

São dois bloqueios. O 2 precisa do usuário, porque roda o agente com as credenciais dele e escreve no GitHub numa PR de verdade. O 1 não pede decisão.

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`, na worktree de revisão, todas verdes:

| Suíte | Resultado |
|---|---|
| `task test:go` (`gotestsum ./...`) | 2.962 testes, 1 pulado. A primeira rodada teve uma falha de `internal/claude` (`text file busy` ao executar o binário falso, uma corrida do sistema e não da task); com `-count=1`, o pacote e a suíte inteira passaram |
| `task tidy:check`, `task lint:go`, `task vuln` | limpos (0 issues, nenhuma vulnerabilidade) |
| `task lint:web` (`biome ci .`) | 695 arquivos, limpo |
| `task typecheck` | verde |
| `vitest --project unit` | 5.282 testes em 289 arquivos |
| `pnpm test:painted` | 1.347 testes em 64 arquivos |
| `task bindings:check` | sem diff; `git status` limpo depois |

O CI da PR (run `36952642673`) tem **Changes**, **Go** e **Frontend** verdes, e **Build** pulado. A PR está `MERGEABLE` e `CLEAN`, com a cabeça em `ae4104a`. O diff não toca:
- `.github/`, `Taskfile.yml`, `mise.toml`, `build/` nem `lefthook.yml`;
- `biome.json`, `go.mod`, `go.sum`, `package.json` nem o lock;
- os configs do vite e do vitest, nem `design/system/tokens.css`.

`task check` não foi conferido commit a commit, só na ponta (pronto 10).

### Mutações

Cada mutação rodou numa cópia da worktree no scratchpad, desligada do git dela, só com os testes que ela alcança. Os pintados rodaram com a porta do modo browser trocada (63415). "Falha (n)" é o número de testes que falharam.

| Pronto | Mutação | Onde | Resultado |
|---|---|---|---|
| 4 | Tudo descartado com mudanças não vai a `changes_review` | `internal/flow/pr_findings.go:74` | falha (3) |
| 4 | Enviada sem mudanças volta a `awaiting_decision` | `pr_findings.go:69` | falha (3) |
| 4 | `awaitingMerge` sem a passada descartada | `pr_findings.go:51` | falha (5) |
| 4 | O `done` derivado sem a leitura do merge (`PRDone` fixo) | `pr_findings.go:77` | falha (4) |
| 4 | Sem o marco `pr_review_revised` | `pr_findings.go:121` | falha (1) |
| 4 | O marco do relatório sem a contagem | `pr_findings.go:163` | falha (2) |
| 4 | A razão ilegível vazia | `pr_findings.go:178` | falha (4) |
| 4 | Decidir depois do merge | `pr_findings.go:230` | falha (2) |
| 4 | Decidir no `trouble` recusado | `pr_findings.go:230` | falha (2) |
| 4 | Decidir uma passada que não é a corrente | `pr_findings.go:215` | falha (1) |
| 4 | **Apply approved** sem tudo decidido | `pr_findings.go:297` | falha (2) |
| 4 | **Apply approved** sem nenhum aprovado | `pr_findings.go:300` | falha (2) |
| 4 | **Apply approved** com a sessão ocupada | `pr_findings.go:309` | falha (2) |
| 4 | O envio que falha não apaga `sent_at` | `pr_findings.go:323` | falha (1) |
| 4 | `ApprovePR` aceita antes do envio | `internal/flow/pr.go:1359` | falha (3) |
| 4 | O merge com tudo descartado não encerra o review | `pr.go:730` | falha (3) |
| 4 | `PollPRs` só com `PRDone` | `pr.go:1565` | falha (1) |
| 4 | `checkPR` só com `PRDone` | `pr.go:434` | **sobrevive** |
| 4 | `CloseTask` só com `PRDone` | `internal/flow/close.go:27` | falha (3) |
| 4 | Reabrir sem a leitura do GitHub numa passada descartada | `pr.go:1106` | falha (1) |
| 4 | A pausa não mostra a passada gravada | `pr.go:266` | falha (4) |
| 4 | `startReview` sem a linha em `pr_passes` | `pr.go:847` | falha (14) |
| 4, 6 | `askPass` sem a linha (a passada seguinte em texto) | `pr.go:920` | falha (3) |
| 4 | `askPass` que ignora a falha da linha | `pr.go:920` | sobrevive (fraca, refeita na linha de cima) |
| 4 | Sem `UnaskPRPass` na falha do início, e na do envio | `pr.go:855`, `:930` | falha (1), falha (1) |
| 4 | `tearDownPR` sem limpar a razão | `pr.go:1176` | falha (1) |
| 4 | `askPass` sem limpar a razão | `pr.go:925` | sobrevive (sem efeito visível) |
| 4 | Releitura ilegível devolve `ok = false` | `pr_findings.go:110` | sobrevive (veja item 9) |
| 4 | `AskPRPass` substitui uma linha gravada | `internal/task/pr_passes.go:77` | falha (2) |
| 4 | **Approve the rest** sobrescreve os decididos | `task/pr_passes.go:179` | falha (2) |
| 4 | Releitura de uma passada enviada | `task/pr_passes.go:123` | falha (2) |
| 4 | Texto sem aparar | `task/pr_passes.go:160` | falha (3) |
| 4 | `AllDiscarded` ignora o envio | `task/pr_passes.go:59` | falha (2) |
| 4 | `ClearPRRun` deixa as passadas no cache | `internal/task/service.go:985` | **sobrevive** |
| 4 | `DeletePRRun` não apaga `pr_passes` | `internal/store/prs.go:93` | falha (1) |
| 4 | `You decided` repetido no retry | `internal/session/service.go:925` | falha (1) |
| 4 | Notificação sem `1 change` | `internal/attention/text.go:150` | falha (2) |
| 4 | Forma sempre `decide` | `attention/derive.go:229` | falha (2) |
| 4 | `Ready to merge` sem o texto de tudo descartado | `attention/derive.go:259` | falha (2) |
| 4 | `reviewflow.ApproveRest` com uma passada rodando | `internal/reviewflow/decide.go:25` | falha (1) |
| 4 | `prreview.ApproveRest` sobrescreve os decididos | `internal/prreview/service.go:523` | falha (2) |
| 4 | O DTO sem `structured`, e com `currentPass` 0 | `internal/bindings/convert.go:545`, `:313` | falha (1), falha (1) |
| 4 | Sem a mensagem de `ErrNothingApproved` | `bindings/task_service.go:913` | **sobrevive** |
| 5 | `ApplyMessage` sem os descartados | `internal/prreport/apply.go:46` | falha (4) |
| 5 | `Inherit` sem a decisão | `prreport/finding.go:93` | falha (9) |
| 5 | `Same` sem o título | `prreport/finding.go:107` | falha (3) |
| 5 | O prompt da task sem `## Findings format` e `## Applying` | `internal/prompts/prompts.go:644` | falha (6) |
| 8 | A chegada em `decide` vai ao compositor | `features/task/pr-findings.ts:211` | 4 falham |
| 8 | A chegada em `apply` vai ao apontamento | `pr-findings.ts:195` | 4 falham |
| 3, 6 | A passada corrente sem `structured` | `pr-findings.ts:60` | 2 falham |
| 3 | `1/4 decided` | `pr-findings.ts:203` | 5 falham |
| 3 | `go` sempre | `pr-findings.ts:189` | 2 falham |
| 3 | `· the worktree has changes` sem mudanças | `pr-findings.ts:147` | 1 falha |
| 3 | Sem `No file changed` | `features/task/request.ts:436` | 1 falha |
| 3 | `Nothing approved` sem a passada | `request.ts:357` | 1 falha |
| 3 | A curta da árvore sem `1/4` | `features/sidebar/sidebar-tree.ts:395` | 1 falha |
| 3 | `Ready to apply` vira `Decide findings` | `lib/situations.ts:97` | 1 falha |
| 8 | O anúncio de `apply` vira o de `decide` | `lib/situations.ts:258` | 1 falha |
| 3, 6 | A passada em texto com o placeholder dos estruturados | `pr-findings.ts:243` | 1 falha |
| 3 | Tudo descartado sem o placeholder de pedir ao agente | `pr-findings.ts:244` | 1 falha |
| 3 | `askForChange` fora da PR | `pr-findings.ts:245` | 1 falha |
| 3 | `findings` sem `!structured` | `pr-findings.ts:241` | sobrevive (equivalente: `reviseFindings` vem antes em `composer.ts:131`) |
| 3, 6 | A pausa sempre em texto | `request.ts:615` | 3 falham |
| 3 | `Waiting for reply` sem a razão | `request.ts:655` | 1 falha |
| 3 | O cartão desabilitado sai depois do merge | `pr-findings.ts:94` | 3 falham |
| 3 | `Not applied` no lugar de `Not sent` | `pr-findings.ts:218` | 3 falham |
| 2 | `Alt+↓` não age no compositor | `features/task/TaskView.tsx:153` | 1 falha |
| 2 | `Home`/`End`/páginas presos no cartão | `features/chat/useFeed.ts:19` | 1 falha |
| 2 | A tecla segurada decide | `components/system/DecisionCard.tsx:53` | 1 falha |
| 2 | Desfazer avança | `components/FindingsCard.tsx:197` | 1 falha |
| 2 | `Ctrl+E` no apontamento não abre a linha | `components/system/Finding.tsx:122` | 2 falham |
| 2 | **Next to decide** sem ação | `features/task/TaskRequest.tsx:143` | 1 falha |
| 8 | Sem o foco em **Apply approved** depois de **Approve the rest** | `features/task/useFocusAfterApproveRest.ts:34` | 4 falham |
| 7 | O `⋯` sem o tooltip de **Review again** | `features/task/task-menu.ts:167` | 1 falha |
| 3 | Todo marco do relatório abre o relatório | `features/chat/markers.ts:378` | 1 falha |
| 3 | `Details` lista a passada sem arquivo | `features/task/details.ts:230` | 2 falham |
| 3 | `done` com tudo descartado vira conversa somente leitura | `features/task/place.ts:178` | 3 falham |
| T27 | O review sem **Approve the rest** | `features/reviews/review-request.ts:185` | 10 falham |
| T27 | O tooltip de **Approve the rest** sem a contagem | `request.ts:206` | 8 falham |
| 1 | **Next to decide** primário | `pr-findings.ts:37` | 6 de 300 falham |
| 1 | O cartão com 7,5 px de padding | `DecisionCard.tsx:101` | 30 de 300 falham |
| 1 | O cartão um pixel para dentro da coluna | `features/task/usePRConversationAnchors.tsx:46` | 60 de 300 falham |
| 1 | O cabeçalho do cartão cortado sem tooltip | `DecisionCard.tsx:103` | 10 de 300 falham |

As três que importam:
- **`checkPR` só com `PRDone`.** Com ela, um `done` derivado é lido sem `detailsOnly` (`internal/flow/pr.go:439`), e `recordTrouble` nunca roda. Os testes do `trouble` derivado gravam `run.Trouble` direto na fixture (`internal/flow/pr_findings_test.go:248`, `:486`). Nenhum passa pela leitura do GitHub que o grava, que é o que `07:158` e o pronto 4 pedem. Veja o item 2 de "Podem esperar".
- **`ClearPRRun` deixa as passadas no cache.** O teste do `store` vê o banco, e o do `flow` usa um `memTasks` falso (`internal/flow/helpers_test.go:132`). Ninguém olha o cache real depois do **Back to**.
- **A mensagem de `ErrNothingApproved`.** Nenhum teste de `userMessages` a confere.

Fora da tabela, uma sonda no jsdom confirmou a outra metade das setas do pronto 2: do último apontamento, `↓` sai para a entrada seguinte, e dali `↑` volta ao último. O comportamento está certo, mas o teste (`TaskView.findings.keys.test.tsx:199`) só prova a ponta de cima.

### Capturas

A PR não tem nenhuma:
- o corpo tem só quatro tópicos de texto, sem imagens, tabelas nem a checklist da máquina alvo;
- não existe `captures/54-…` no `origin`, só as das tasks 3 a 6.

Para olhar, gerei as 126 capturas de `TaskView.scenes.painted` numa cópia (`MYSPEC_CAPTURES=1`). Fotografei o mock em `?scene=findings` e `?scene=close`, nos dois temas e com as janelas de 1946 (área de 1566), 2560 e 1330, servido na porta 8131 e encerrado pelo PID.

Comparei:
- `findings` a 1566 claro com o mock;
- `close` a 1566 claro com o mock;
- `findings-apply` 950 claro, `findings-discarded` 1566 claro e `findings-revised` 950 escuro;
- `findings-edit` 950 escuro, `findings-sent` 1566 escuro e `findings-text` 1566 claro;
- `findings-unreadable` 950 claro e `bar-findings` claro.

Batem com o mock e com `07:291–299` em:
- **a estrutura, os textos e as horas:** `12m`, `1 of 4 decided`, `Decide 3 more` antes de **Apply approved** tracejado e `3 approved findings go to the agent`;
- **os casos de borda:** `Nothing approved in pass 1` com **Open PR**, a razão em `Waiting for reply · PR review 3m`, `PR review pass 2` na pílula da ilegível e a sequência de `close` com a mensagem `apply`;
- **as divergências que `07:334` já aceita:** o resumo editável, os títulos, **Approve the rest** e `Ready to apply`.

Ficam estas diferenças:
- **`findings-sent` com o `You decided` fechado.** `07:296` pede o marco aberto, com os desabilitados (`Sent to the agent · 17:36`, `Not sent`). `prepare` (`TaskView.scenes.painted.test.tsx:227`) só mexe em `findings` e `findings-edit`. Por isso nenhuma captura mostra o apontamento desabilitado da task, e o pixel inteiro dele não é medido. Veja o bloqueio 1.
- **`findings-edit` com a área em duas linhas.** `components.md:680` e `07:225` pedem cinco. `rows={5}` (`components/system/Finding.tsx:209`) perde para o `field-sizing-content` de `components/ui/textarea.tsx:9`, e a altura segue o texto. É do system e vale também para o review (item 6 de "Podem esperar").
- **O placeholder diz `Ask the PR agent to add, change or drop a finding…`.** `07:245` e `task.md:236` escrevem `reviewer`. O código usa a voz da conversa, que na PR da task já é `PR agent` em `main` (`features.md:765`, `Tell the PR agent which findings to apply…`). A régua é que está imprecisa (item 10 de "Podem esperar").

Veja o bloqueio 1.

## Bloqueiam o merge

1. **As capturas não estão na PR** (pronto 1).
   - `07:19` pede as capturas anexadas à pull request, lado a lado com o mock.
   - **Mudar:**
     - antes de capturar, abrir o `You decided` em `findings-sent` (`prepare`, `TaskView.scenes.painted.test.tsx:227`), para a cena mostrar os desabilitados como `07:296` pede, e medir o pixel inteiro deles;
     - rodar `task captures` e `task captures:push`;
     - pôr no corpo as tabelas no formato da #75:
       - as dez cenas dos apontamentos e `close` a 1566 (a do mock), a 950 e a 2180, nos dois temas;
       - `findings` e `close` lado a lado com o mock;
       - a barra e o compositor de cada uma.
   - Não pede decisão do usuário.

2. **O ciclo real do pronto 9 não foi feito nem registrado.**
   - `07:27` pede, na máquina alvo, numa task de verdade, com `XDG_DATA_HOME` numa cópia do diretório de dados e registrado na PR:
     - uma passada estruturada com títulos;
     - a decisão pelo teclado com uma edição e um descarte, **Approve the rest** e **Apply approved**;
     - o `changes_review` com **Approve**, o commit que sobe e a passada seguinte estruturada e limpa, sem repetir o descartado;
     - o `Ready to merge`.
   - É a única prova do prompt novo e da seção dos descartados com um agente de verdade (`07:479–480`).
   - **Pede o usuário:** roda o agente com as credenciais dele e escreve no GitHub numa PR real. Daqui nenhuma das duas coisas pode ser feita (veja "No app real").
   - **Mudar:**
     - pôr no corpo uma checklist `## Verification on the target machine` com o roteiro de `07:27`, como a da #75;
     - o usuário roda o roteiro e registra o resultado, com o texto da mensagem de **Apply approved** e o relatório da passada seguinte.

## Podem esperar

Em ordem de gravidade.

1. **Pausar durante a aplicação mostra o trabalho pela metade como pronto para review.**
   - O último commit faz a passada gravada e pausada ser derivada por `structuredStatus` (`internal/flow/pr.go:266`). Isso vale também para a enviada.
   - `Pause` para o processo no meio do turno (`internal/session/service.go:630`). Uma pausa enquanto o agente aplica os aprovados deixa a passada `Sent` e em repouso, e ela vira:
     - `in_review` com `No file changed`, se o agente ainda não escreveu nada;
     - `in_review` ou `ready_to_approve` com as mudanças parciais, que a barra quieta oferece para **Approve** (`ApprovePR` retoma a sessão e pede o commit).
   - O teste fixa isso (`internal/flow/pr_findings_test.go:317`).
   - Na passada em texto e antes deste commit, a pausa dava `PRReviewing`. `07:144` só dá barra à enviada "em repouso", e para o step `features.md:477` diz que nada anda com a conversa pausada.
   - **Mudar:** derivar pela passada só a pausa de uma passada não enviada (`facts.paused && facts.pass.Recorded && !facts.pass.Sent()`). Ou o coordenador decide e registra em `07` que a pausa mostra as mudanças parciais. Não precisa do usuário.

2. **O `trouble` de um `done` derivado não tem prova pela leitura** (pronto 4).
   - A mutação de `checkPR` (`internal/flow/pr.go:434`) sobrevive, porque os testes gravam `run.Trouble` direto.
   - **Mudar:** um caso em `pr_findings_test.go` em que `checkPR` lê uma PR aberta com um check falhado sobre uma passada toda descartada e grava o `trouble`. Também a leitura que falha e oferece o encerramento.

3. **`where-actions-went.test.tsx` não tem uma linha por controle e por estado** (pronto 7).
   - `07:25` pede uma linha por controle do terceiro parágrafo (`07:9`) e por estado em que ele aparece. As linhas novas (`where-actions-went.test.tsx:880–1009`) põem **Approve**, **Discard**, **Edit**, o link e o VS Code só em `findings to decide`. Faltam:
     - o cartão em `apply`, em `Ready to merge` com tudo descartado e na reescrita, onde ele continua decidível;
     - o pedido de acrescentar, mudar ou retirar pelo compositor;
     - o relatório em `Details` e **Done**;
     - a resposta pelo compositor na passada em texto.
   - O comportamento está provado em outros testes, mas a tabela não fecha.

4. **A prova do texto cortado e a da primária só rodam a 1566.**
   - `07:19` pede as duas em cada largura. `gives every cut text a tooltip` e `draws one primary at most` chamam `scene(name)` sem largura (`TaskView.scenes.painted.test.tsx:378`, `:386`). A 950 e a 2180, onde a barra e os títulos mais cortam, nada confere.
   - `cutTexts(area).slice(0, 8)` confere só os oito primeiros.

5. **`ClearPRRun` sem teste do cache** (`internal/task/service.go:985`). A mutação sobrevive. Um caso em `task/pr_passes_test.go`: `ClearPRRun` e depois `PRPasses` vazio.

6. **A área de edição não tem cinco linhas** (`components.md:680`, `07:225`). `field-sizing-content` (`components/ui/textarea.tsx:9`) ignora `rows={5}` (`components/system/Finding.tsx:209`). É do system e vem da task 6, mas a cena `findings-edit` é a primeira captura que mostra.

7. **`ErrNothingApproved` sem teste da mensagem** (`internal/bindings/task_service.go:913`). A mutação sobrevive.

8. **`Approve the rest` com zero por decidir.**
   - As duas barras admitem a forma `decide` com tudo decidido: os dois lados tratam `left === 0` no tracejado (`features/task/pr-findings.ts:209`, `features/reviews/review-request.ts:176`).
   - Nesse caso o botão aparece com `Approve the 0 findings not decided yet`. `07:204` diz que ele existe só com algo por decidir.
   - É raro, porque a forma vem do Go e chega com as decisões, mas a fixture do teste de `Ctrl+Enter` (`TaskView.findings.keys.test.tsx:495`) desenha exatamente isso.
   - **Mudar:** omitir o botão com `left === 0` nos dois lugares.

9. **Uma releitura ilegível segue a avaliação** (`internal/flow/pr_findings.go:110`).
   - Devolver `ok = false` ali não quebra nenhum teste.
   - Pelo código, `true` é o certo: com tudo descartado e mudanças, ela mantém o `Track` da worktree (`pr.go:762`).
   - Fica sem prova.

10. **A régua escreve `reviewer` onde a voz é `PR agent`.**
    - `07:245`, `task.md:236`, `:263`, `:352` e `components.md:520` escrevem `Ask the reviewer to add, change or drop a finding…` e `Queue a message for the reviewer…`.
    - Na PR da task, `c.who` é `PR agent` desde a task 4, e `features.md:511`, `:765` dizem `PR agent`.
    - **Mudar:** acertar a régua.

11. **Opinião: o descarte não chega ao agente quando tudo foi descartado e houve mudanças.**
    - Nesse caminho as mudanças vão ao `changes_review` e ao commit sem **Apply approved**. A mensagem com `## Discarded findings` (R19) nunca é enviada, e a passada seguinte pode apontar de novo o que o usuário descartou.
    - `07:158` não grava nada nesse caminho, de propósito. Se o risco de `07:480` vale também aqui, a seção dos descartados poderia ir no `pr_pass` seguinte.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | **As cenas:** as fixtures batem com `07:279–299`, com os títulos, os lugares, os textos e as horas (17:28, 17:34, 17:36, 16:50, 17:02, 17:18, 17:20, 17:30, 17:31). As dez cenas desenham nos dois temas. **As provas:** o pixel inteiro do cartão e de cada apontamento a 950, 1567 e 2180 (30 e 60 falham nas mutações), uma primária (6) e o texto cortado com tooltip (10). **Falham:** as capturas na PR, o `You decided` fechado em `findings-sent` (bloqueio 1), e o corte e a primária só a 1566 (item 4) |
| 2 | Ok, com ressalva | `TaskView.findings.keys.test.tsx` cobre a lista, com o caso de 29. Morrem as mutações de `Alt+↓` no compositor, das teclas de percurso, da repetição, do desfazer, do `Ctrl+E` e de **Next to decide**. A volta por baixo ao último apontamento funciona, mas não tem teste |
| 3 | Ok | `pr-findings.test.ts`, `request.test.ts` e `sidebar-tree.test.ts` em tabela; as mutações do modelo morrem, menos uma equivalente |
| 4 | Ok, com ressalva | `pr_findings_test.go` cobre a tabela de `07:134–146`, as recusas, `ApprovePR`, `AskPRPass`, o envio, o marco que não se repete, o merge, o fechamento, `PollPRs`, `CloseTask` e o **Back to**. 43 mutações de Go morrem. Faltam o `trouble` gravado pela leitura (item 2) e o cache de `ClearPRRun` (item 5) |
| 5 | Ok | `prreport` com `report_test.go`, `finding_test.go` e `apply_test.go`; `prreview` e `reviewflow` mudam só o pacote e a mensagem do Apply; três mutações morrem |
| 6 | Ok | A passada em texto continua sem ação e com a resposta pelo compositor, e a seguinte é estruturada. Morrem as mutações de `askPass` sem a linha, da corrente sem `structured`, da pausa em texto e do placeholder |
| 7 | Ok, com ressalva | As linhas novas existem, com a primária única por estado, mas não cobrem cada controle em cada estado (item 3) |
| 8 | Ok | `TaskView.test.tsx` cobre as quatro chegadas e a barra que pisca e é anunciada; morrem as mutações do foco e do anúncio. A chegada é provada pelo `pendingFocus`, o mesmo de `Ctrl+J` e da notificação |
| 9 | **Falha** | Não feito (bloqueio 2) |
| 10 | Ok na ponta | `task check` verde em `ae4104a`; não conferido step a step. O único teste removido (`TestFindingsTheUserDismissesCloseThePullRequestToo`) virou `TestAPassThatFindsNothingAfterAPassWithFindingsClosesThePullRequest` no mesmo commit (`cbc0d8f`) |
| 11 | Ok | `features.md` §Review de pull request reescrito, e §O relatório e a decisão, §Corrigir a própria pull request, §Sessões e conversas, §Depende de mim, §Prompts e §Atalhos atualizados. `sessions.md` tem o prompt, a ordem das seções e a mensagem de **Apply approved**. `overview.md`, `storage.md`, `design-system.md`, `testing.md`, `setup.md` e `troubleshooting.md` têm as oito mensagens de log novas, e todas existem no código. Tudo no presente, sem histórico |
| 12 | Esta crítica | — |
| 13 | Ok | `gh pr checks 77` verde |

## O que saiu

- **`features/reviews/decide-keys.ts`:** `focusFindingToDecide` passou a `lib/focus.ts`, sobre a lista de apontamentos, e serve às duas telas.
- **`findingsRequestOf`** (`features/task/request.ts`): no lugar dela, `findingsBar` em `features/task/pr-findings.ts`.
- **`features/reviews/FindingsCard.tsx`:** foi para `components/FindingsCard.tsx`, sem o review dentro, com as funções de decidir, salvar e abrir passadas por quem monta. `docs/architecture/design-system.md:225` registra.
- **O corpo de `findingViews`** foi para `lib/findings.ts` (`findingViewsOf`), usado pelo review, pelo cartão da task e pelo marco `You decided`.
- **`internal/prreview/report.go`** foi para `internal/prreport/report.go`, e `prreview.Decision`, `Finding` e `ErrEmptyText` vêm de `prreport`.

Nada importa mais o que saiu, e o `typecheck` e o lint passam.

**Comportamento fora de `changes.md`**, todos ditos no material ou consequência direta dele:
- **No review:** o texto vazio passa a dizer `Write the finding, or discard it.` (`07:388`);
- **A barra das mudanças da PR** ganha o lugar `PR review` em todo `changes_review` (`07:208` só mostra o caso de `No file changed`);
- **O stepper** mostra a passada que roda pelo `currentPass`;
- **A seção da tela da task** tem `aria-label` com o nome da task, como a do review (`TaskView.tsx:171`);
- **A barra quieta da pausa** (item 1 de "Podem esperar").

## Tokens e contraste

**Nenhuma cor, duração ou tamanho solto** no diff onde há token, e `tokens.css` não muda.

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css` (claro / escuro). `brand-tint` é composto em sRGB sobre `surface-2` com `--mix-tint`. Todos passam 4,5:1:
- `ink-3` sobre `surface-2`, em:
  - o número, `General · not on a line of the diff` e `Findings 4`;
  - `Approved · click again to undo`, `Not sent` e `Sent to the agent · 17:36`;
  - 7,29 / 7,09;
- `ink-2` sobre `surface-2` (o descartado): 10,88 / 9,65;
- `ink-1` sobre `surface-2` (o título e o texto): 18,12 / 13,23;
- `brand-ink` sobre `surface-2` (a localização): 6,43 / 8,15;
- `brand-ink` sobre `brand-tint` (**Approve** ou **Discard** pressionado): 5,43 / 6,17;
- `state-error` sobre `surface-2` (`Couldn't save…`): 6,11 / 5,94;
- a barra:
  - `state-wait` sobre `state-wait-veil` (`Decide findings`, `Ready to apply` e `Ready to merge`): 5,60 / 8,86;
  - `ink-2` (`PR review · pass 1`, `1 of 4 decided`, `Nothing approved in pass 1`): 9,83 / 9,25;
  - `ink-3` (`Decide 3 more` e a tecla `Alt ↓`): 6,59 / 6,79;
  - o chip `12m`: 7,39 / 9,12;
- `brand-on` sobre `brand` (**Apply approved**): 5,66 / 7,79;
- `ink-3` sobre `surface-1` (o complemento dos marcos, `changes · 4 findings`, `3 approved · 1 discarded`): 7,19 / 8,05.

**Não texto:**
- o anel do apontamento atual (`brand-ring` sobre `surface-2`): 4,36 / 3,97;
- o anel em hover (`line-3`): 3,50 / 3,25;
- o glifo de `Ready to merge` (`state-close` sobre `state-wait-veil`): 5,12 / 7,97.

**Estado sem cor como único portador:**
- a decisão é `aria-pressed`, tem o fundo e a frase;
- o desabilitado diz para onde foi (`Sent to the agent · 17:36`, `Not sent`);
- a barra diz a forma em texto (`Decide findings`, `Ready to apply`);
- a razão ilegível vai em texto no meio da barra, com o motivo no tooltip.

## No app real

**Como rodou:**
- `task build` numa cópia em `ae4104a`;
- `bin/myspec` com `XDG_DATA_HOME`, `XDG_STATE_HOME` e `XDG_CONFIG_HOME` temporários, com um HOME falso e sem `WAYLAND_DISPLAY` nem `DISPLAY`;
- `GDK_BACKEND=broadway` (`gtk4-broadwayd :21`), dirigido por um Chromium headless.

Para subir, foram precisos dois ajustes:
- um barramento próprio, com `dbus-run-session --config-file` sem ativação de serviços e com `GTK_A11Y=none`;
- um `XDG_RUNTIME_DIR` de caminho curto em `/tmp`, porque o proxy de D-Bus do WebKit não cabe no limite de 108 bytes do socket com o caminho do scratchpad, e o app aborta com `Address already in use`.

Nada foi escrito no GitHub. O app, o barramento e o broadwayd foram encerrados pelo PID, e o diretório em `/tmp` foi apagado.

**O que o app mostrou:**
- as 22 migrations aplicadas num banco novo, `0022_pr_findings.sql` incluída, e `database opened` com `schema_version: 22`;
- a Home vazia, com `Register a board or a repository to start creating tasks.`, **Add board** e **Add repository**;
- nenhum `ERROR` no log. Os `WARN` são do ambiente: `gh is not authenticated` (sem `GH_TOKEN`) e `system theme unavailable` (sem portal).

**O que o app não mostrou: tudo o que é da task.**
- Isso inclui a passada estruturada, o cartão, a barra nas formas, **Approve the rest**, **Apply approved**, a mensagem com os descartados, `No file changed`, o `done` derivado e a pausa.
- **Por quê:** chegar a uma passada de review da PR de uma task roda o agente com as credenciais do `claude` do usuário.
- **Também não foi feito:** aplicar a `0022` numa cópia do banco do usuário, para ver as passadas em curso ficarem em texto. A cópia do banco foi negada pela permissão, e não houve outra tentativa.
- **O que cobre essa parte:** as capturas pintadas, as mutações acima e o pronto 9 (bloqueio 2), que roda numa cópia do diretório de dados por definição.

## Segunda leitura (0c7d269)

Só as correções `ae4104a..0c7d269` (11 commits, 18 arquivos), na worktree de revisão. As mutações rodaram numa cópia no scratchpad, com o browser do vitest na porta 63417.

**Veredito: Mergear depois do roteiro do usuário.** O bloqueio 1 fechou. O bloqueio 2 está na PR como a checklist `## Verification on the target machine`, ainda em branco, e só o usuário pode rodá-la.

| Bloqueio ou item | Situação | Evidência |
|---|---|---|
| Bloqueio 1, as capturas | Fechado | `prepare` abre o `You decided` em `findings-sent` (`TaskView.scenes.painted.test.tsx:232–237`). A prova do pixel inteiro mede os desabilitados a 950, 1567 e 2180 (`:385–402`). Sem o clique, 6 testes falham. `captures/54-…` está no `origin` (`7357464`). O corpo tem as três tabelas (1566, 950 e 2180, nos dois temas, com a coluna do mock em `findings` e `close`, no formato da #75) e a tabela da barra. As 72 URLs do corpo existem na árvore da branch (`gh api …/git/trees`, nenhuma faltando). Baixei e olhei oito capturas: `findings-sent` 1566 claro e escuro com o marco aberto e `Sent to the agent · 17:36` / `Not sent`; `findings-edit` 950 escuro e 1566 claro com a área de cinco linhas; `close` 1566 sem hover sobrando; `findings` 950 claro e 2180 escuro; `bar-findings` claro |
| Bloqueio 2, o ciclo real | Aberto, com o usuário | A checklist do corpo cobre o roteiro de `07:27`, com o texto do **Apply approved** e o relatório seguinte |
| 1, a pausa durante a aplicação | Feito | `internal/flow/pr.go:268` tem `&& !facts.pass.Sent()`. Os dois casos novos (`pr_findings_test.go:317`, `:323`) esperam `PRReviewing`, e sem a condição falham. Os casos da pausa não enviada (`:303`, `:311`) e da passada em texto pausada (`:337`) continuam e passam. `07:144` e `:148`, `overview.md:142` e `features.md:789` dizem o mesmo |
| 2, o `trouble` pela leitura | Feito | A mutação de `checkPR` (`awaiting := hasRun && run.Status == task.PRDone`, `pr.go:436`) agora morre em `TestAReadingOfAPassWithEveryFindingDiscardedRecordsWhatWentWrongOnThePullRequest` e `TestAReadingThatFailsOnAPassWithEveryFindingDiscardedStillOffersTheClosing` (`pr_findings_test.go:1018`, `:1035`) |
| 3, `where-actions-went` | Feito | O cartão em `apply`, com tudo descartado e na reescrita, com **Approve**, **Discard**, **Edit**, **Done**, o link e o VS Code (`CARD_STATES` e `cardRows`, `where-actions-went.test.tsx:203–222`). O pedido pelo compositor nos três estados, a resposta da passada em texto, e o relatório em `Details` (`:975–1033`). Com o `⋯` e a barra, que já estavam, o terceiro parágrafo de `07:9` fecha |
| 4, o corte e a primária nas três larguras | Feito, mas a prova do corte não morde | As duas provas rodam em `SCENE_WIDTHS` (950, 1566, 2180), sem o `slice(0, 8)` (`TaskView.scenes.painted.test.tsx:406–425`). Uma sonda mostra que `cutTexts(area)` vem vazio nas 48 combinações de cena, largura e tema: nenhuma fixture corta texto. A prova está certa e passa a valer quando algo cortar, mas hoje não confere nada |
| 5, `ClearPRRun` | Já estava provado; a primeira leitura errou | Tirar `delete(s.prPasses, id)` (`internal/task/service.go:985`) quebra `TestClearPRRunForgetsThePRPasses` (`pr_passes_test.go:529`), que já existia em `ae4104a` |
| 6, a área de cinco linhas | Feito | `min-h-[calc(var(--leading-body)*5+…)]` em `components/system/Finding.tsx:211`, só com tokens. Sem ela, `opens the editor of a finding five lines high` falha (1,73 linha) nos dois temas. Vale também para o review, que usa o mesmo componente |
| 7, `ErrNothingApproved` | Feito | Sem a linha em `bindings/task_service.go:913`, `TestApplyingFindingsWithNoneApprovedSaysSo` falha |
| 8, **Approve the rest** com zero | Feito nos dois lugares | `pr-findings.ts:210` e `review-request.ts:186`. Voltar cada um falha num teste (`pr-findings.test.ts:225`, `review-request.test.ts:451`). A fixture do `Ctrl+Enter` passou a desenhar as formas `decide` e `apply` reais (`TaskView.findings.keys.test.tsx:495`) |
| 9, a releitura ilegível | Feito | Com `ok = false` em `pr_findings.go:110`, falha `TestAnUnreadableRewriteOfAPassWithEveryFindingDiscardedKeepsItsChangesWatched` (`pr_findings_test.go:929`) |
| 10, `PR agent` na régua | Feito, com um resto | `07:230`, `:245`, `task.md:213`, `:236–237`, `:262–263`, `:352` e `components.md:520` dizem `PR agent`. Resta `07:517`, que ainda diz `Ask the reviewer for a change…` para o `changes_review` da PR. O código diz `Ask the ${c.who} for a change…` (`features/chat/composer.ts:138`), e `features.md:517` diz `PR agent` |
| 11, o descarte sem **Apply approved** | Fora, por decisão | — |
| Harness, o ponteiro no canto | Sem efeito nas provas | `pointerInTheCorner` (`test/painted.ts:405–419`) só roda dentro de `capture`, que sai antes quando `captureDir` é vazio. As onze chamadas de `capture` vêm depois de `withoutTooltip` ou das medidas, e nenhuma captura quer mostrar um hover. `testing.md:78` registra |
| Pronto 10 e 13 | Verdes | `task check` passou inteiro em `0c7d269`: 2.967 testes Go com 1 pulado, 6.490 web, sem vulnerabilidades e bindings sem diff. `TaskView.scenes.painted` e `ReviewView.scenes.painted` também passaram na cópia (420 testes). `gh pr checks 77`: **Changes**, **Go** e **Frontend** passaram, e **Build** foi pulado. A PR está `MERGEABLE` e `CLEAN` |

**O que segue aberto:**
- o bloqueio 2 (o roteiro do usuário);
- `07:517` com `reviewer`;
- a prova do corte, que não morde com as fixtures de hoje.

**O que é novo**, pequeno e sem efeito à vista:
- `internal/flow/pr.go:764` ainda observa a worktree de uma passada enviada e pausada (`structured && pausedAtRest(sum)`). Com isso, o comentário de `:760–762` ("A paused structured pass keeps showing them") não vale mais para ela, que agora fica `reviewing` e não mostra as mudanças.
- O comportamento está certo: ao retomar, a avaliação segue normalmente. Mas a regra da observação não acompanhou a do status.

**Docs:** `overview.md:142`, `features.md:789`, `testing.md:78`, `07` e `task.md` estão no presente, sem histórico, e batem com o código.
