# Task 7 · Apontamentos estruturados na PR da task

Material de entrada da sétima task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 7 de `design/implementation.md` (§2, linhas 115–125), com os princípios da §1 (9–22) e os riscos da §3 (185–197). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** A task parte da `main` depois do merge das tasks 4 (PR #71), 5 (card #52) e 6 (`tasks/06-review.md`), e não corre em paralelo com nenhuma delas (§6). As linhas de código citadas são as da branch da task 4 em `c55a417` (`origin/51-redesign-4-task-screen-ii-the-conversation-the-ask-bar-and`); o que a task 6 cria é citado pelo material dela (`tasks/06-review.md` §4.2, §4.4 e §8), porque ainda não está no código. O primeiro passo do tech spec é conferir cada linha citada na `main` em que a task começa. A migration da task é a `0022` (a da task 4 é a `0020`, a da 6 é a `0021`; a 5 não cria nenhuma).

Toda decisão de design está tomada neste documento, em `design/screens/task.md` §7, §8 e §9, em `design/screens/review.md` §9, §10 e §14, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD não pergunta nada ao usuário: o que a task abria de produto foi decidido pelo coordenador, por delegação, em `decisions.md` (2026-09-29, "PR da task: o que a entrada da task 7 decidiu"), e está na §4.3. A crítica desta entrada (`research/critique-task-07-input.md`, L1–L19) está aplicada.

**Nenhum comportamento de hoje se perde.** Hoje a decisão dos apontamentos da PR da task é em texto: o relatório numerado, a barra `Decide findings · PR review` sem ação, a resposta pelo compositor (`Tell the PR agent which findings to apply…`), o agente que aplica o que entendeu e as mudanças no `changes_review` (`features.md` §Review de pull request). Depois da task, cada controle tem lugar: a decisão por apontamento no cartão (**Approve** `A`, **Discard** `D`) e de uma vez na barra (**Approve the rest**), o texto editável em **Edit**, a localização que abre o GitHub e o VS Code na linha, o envio em **Apply approved**, o pedido de acrescentar, mudar ou retirar um apontamento pelo compositor, **Review again** e **Refresh PR** no `⋯`, o relatório no marco e em `Details`, e o `changes_review`, o commit e a passada seguinte como hoje. Uma passada em texto (anterior à task) continua decidida em texto até acabar (§4.2, Compatibilidade). As mudanças de comportamento são as de `changes.md` T16, T27 e R19.

**Vocabulário.** "Passada" é cada relatório pedido ao revisor da PR da task; "passada estruturada" é a que o produto pediu com o formato de apontamentos, e tem uma linha em `pr_passes`; "passada corrente" é a estruturada de número mais alto; "passada em texto" é a pedida antes da task; "cartão" é o cartão de apontamentos na conversa (**DecisionCard**); "apontamento" é o **Finding**; "barra" é a barra do pedido da task; "o parser" é o do relatório do centro de review, com título (P19, task 6).

## 1. Objetivo e critério de pronto

O review da PR da task passa a usar o relatório e a decisão do centro de review no modo Apply: o revisor escreve os apontamentos no formato `### N · título` com a localização; o produto os guarda com a decisão e o texto editado de cada um; o usuário decide no cartão da conversa, com `A` e `D` que avançam, ou aprova de uma vez os que faltam, e a barra de decisão diz o progresso; **Apply approved** envia os aprovados ao revisor, que os implementa, e diz quais foram descartados; as mudanças passam pelo `changes_review` de hoje, o commit sobe, e a passada seguinte é outra vez estruturada. Uma passada com tudo descartado deixa a PR pronta para merge, como no modo Apply. Do Go, a task pede M1 (o formato, a decisão guardada, o envio), P19 no lado da task e os marcos da decisão (P10 no lado da task).

**Pronto quando** (`implementation.md:125`), cada item provado como diz:

1. **As cenas.** As fixtures de `test/task-scenes.ts` reproduzem os apontamentos da cena `findings` de `lab/10-screen-task-minimal/b.html` (`FINDINGS`, 1985–1990), com os títulos e as horas da §4.2 (As fixtures), e o teste pintado `features/task/TaskView.scenes.painted.test.tsx` (Chromium, claro e escuro) ganha as cenas da §4.2 (As cenas): `findings` e `close` comparáveis ao mock, e `findings-apply`, `findings-discarded`, `findings-edit`, `findings-revised`, `findings-sent`, `findings-text` e `findings-unreadable` sem mock. Cada cena a 1566 px de área principal (a do mock), a 950 e a 2180. Em cada uma, o teste confere: o cartão, cada apontamento, a barra e o compositor em pixel inteiro, com as mesmas bordas da coluna da conversa; todo texto cortado com tooltip; no máximo uma primária (§4.2, A primária). Grava as capturas, anexadas à pull request lado a lado com o mock (`python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090, que é a do coordenador; `10-screen-task-minimal/b.html?scene=findings` e `?scene=close`).
2. **O teclado** (jsdom), em `features/task/TaskView.findings.keys.test.tsx`: `A` e `D` decidem e avançam ao próximo por decidir, com volta ao começo; a tecla que desfaz não avança; a repetição (`event.repeat`) é ignorada; sem nada por decidir, o foco fica; `↑` `↓` andam entre os apontamentos, `↓` vindo de fora cai no primeiro e `↑` no último, e nas pontas do cartão as setas, `Home`, `End`, `Page Up` e `Page Down` continuam o percurso da conversa; `E`, `Esc` e **Done**; `O` e `Ctrl+E` num apontamento; `Ctrl+E` fora dele abre a worktree; `Alt+↓` e `Alt+↑` de qualquer lugar da tela, o compositor incluído; **Next to decide** igual a `Alt+↓`; **Approve the rest** sem tecla; `Ctrl+Enter` não age na barra nem no cartão; num apontamento desabilitado, só `O` e `Ctrl+E`. Um caso com 29 apontamentos prova o avanço e o roving numa lista longa.
3. **As regras da barra e do cartão** em tabela, sem renderizar: `features/task/pr-findings.test.ts` (a passada que tem cartão, pela passada corrente; a forma da barra, o progresso, os rótulos, a razão do tracejado, o meio com a worktree mudada e com a reescrita ilegível, o foco na chegada, o rótulo de onde foi cada apontamento desabilitado, o placeholder); `features/task/request.test.ts` (a barra `Review changes` com `No file changed` e **Approve** tracejado com `No change to approve`; a barra `Ready to merge` com `Nothing approved in pass 1`); `features/sidebar/sidebar-tree.test.ts` (as linhas da árvore da §4.2).
4. **O fluxo em Go**, em tabela: `internal/flow/pr_findings_test.go` cobre o status de cada combinação da tabela da §4.2 (passada em texto e estruturada; pedida, gravada, ilegível, reescrita, decidida em parte, tudo decidido com e sem aprovado, com e sem mudanças na worktree, enviada, pausada); a recusa de decidir, editar, aprovar o resto e aplicar fora do estado; `ApprovePR` recusado numa passada corrente não enviada que ainda tem aprovado ou algo por decidir; `AskPRPass` que substitui uma linha não gravada e recusa sobre uma gravada; o texto enviado em **Apply approved**, com os aprovados e os descartados; o marco de cada momento e o marco que não se repete num retry com as mesmas contagens; a leitura com tudo descartado (`PRMerged`, `PRClosedUnmerged` e `PRTrouble` a partir do `done` derivado, o `done` gravado e a sessão fechada no merge ou no fechamento, a decisão permitida no `trouble` derivado); a passada seguinte estruturada; a limpeza no **Back to**. `internal/attention/derive_test.go` cobre as formas, a situação ausente durante a reescrita, e o texto da notificação de cada forma. `internal/reviewflow/` cobre **Approve the rest** no review.
5. **O parser compartilhado.** `internal/prreport/report_test.go` recebe os testes de `internal/prreview/report_test.go` (os formatos do título da task 6 incluídos) e ganha os de `Fresh`, `Inherit`, `Same`, `ApplyMessage` e `Reason`. `prreview` e `reviewflow` passam nos testes de hoje com os casos mudados só no pacote do parser e no texto da mensagem do Apply (`reviewflow/apply_test.go:85–90`, `332–333`, `503–504`), que passa ao formato do relatório com a seção dos descartados (R19).
6. **A compatibilidade**: uma task cuja passada é em texto continua com a barra sem ação e a resposta pelo compositor, e a passada seguinte (a do commit ou a de **Review again**) é estruturada (`flow` e `pr-findings.test.ts`).
7. **Onde foram as ações.** `features/task/where-actions-went.test.tsx` ganha uma linha por controle do terceiro parágrafo e por estado em que ele aparece, `No file changed` incluído; nenhum fica sem lugar, e cada estado tem no máximo uma primária.
8. **A chegada**: por `Ctrl+J` e pela notificação, o foco vai ao primeiro apontamento por decidir em `decide`, a **Apply approved** numa situação que já nasce `apply` (a decisão terminada durante uma reescrita), a **Open PR** em `Ready to merge` com tudo descartado e ao compositor na passada em texto; a barra que nasce com a tela aberta pisca e é anunciada (`features/task/TaskView.test.tsx`).
9. **O ciclo real**, na máquina alvo, numa task de verdade, com o app rodando com `XDG_DATA_HOME` numa cópia do diretório de dados (`internal/platform/xdg/xdg.go:20`), para a `0022` não chegar ao banco do usuário antes do merge; registrado na pull request: uma passada estruturada com apontamentos que têm título, a decisão pelo teclado com uma edição e um descarte, **Approve the rest**, **Apply approved**, o `changes_review` com **Approve**, o commit que sobe, a passada seguinte estruturada e limpa, sem repetir o descartado, e o `Ready to merge`. É o que prova o prompt novo e a seção dos descartados com um agente de verdade.
10. `task check` verde em todo step; nenhum teste removido sem o do código que o substitui no mesmo step.
11. **Documentação** da §7, com `features.md` §Review de pull request reescrito e `sessions.md` com o prompt novo e a mensagem de **Apply approved**.
12. **Revisão do `design-critic`** na branch contra este material, `task.md`, `review.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).
13. **O CI verde** na pull request (`gh pr checks`) antes de ela ser dada como pronta.

`changes.md`: T16, T27, R19. `backend.md`: **M1**, P19 no lado da task, P10 no lado da task (os marcos da decisão). P11 entrou na task 4 (`tasks/04-task-conversation.md:159`).

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 6 (103–113), task 7 (115–125), riscos (185–197, a linha da compatibilidade) | O escopo, o app sempre usável, os testes que migram |
| 2 | `design/decisions.md`: PR da task, o que a entrada da task 7 decidiu (5–11); Review, o que a entrada da task 6 decidiu (13–15); Plano confirmado, com T16 entre as sensíveis (37–39); Review, cartões na conversa (49–51) | O que o usuário aprovou e o que foi decidido por delegação |
| 3 | `design/screens/task.md` §6 (129–172), §7 (174–222), §8 (224–249), §9 (251–268), §11 (339–353, a cena `findings`), §13 (368–389) | A conversa, a barra, o compositor e os apontamentos da PR da task |
| 4 | `design/screens/review.md` §5 (177–191), §9 (211–236), §10 (238–256), §14 (289–295), §17 (321–341), §20 (402–433) | O cartão, a barra de decisão, o modo Apply, que a task espelha |
| 5 | `design/structure.md` §1 (7–38, a chegada), a tabela da linha da árvore (100–124), a barra do pedido (246–293), §5 (344–382) | Os rótulos da árvore, as formas da barra, as teclas |
| 6 | `design/principles.md` 2 (13–33), 7 (67–73), 9 (89–95) | A primária única, um pedido num lugar, a tecla escrita |
| 7 | `design/system/components.md`: estados comuns (18–28), Botão (161), Barra do pedido (487), Compositor (502), Marco em linha (547), Cartão neutro (635), Apontamento (661) | Anatomia, estados, teclado e acessibilidade |
| 8 | `design/changes.md` T16, T27, R19, S8, S10; `design/backend.md` M1, P10, P11, P19 | O que muda e os dados |
| 9 | `design/tasks/06-review.md` §4.2 (Os apontamentos, A barra, O modo Apply), §4.4 (P19, P10, a razão do relatório ilegível, o modelo da barra, a chegada, os cartões fixos, as funções puras), §8 (steps 1, 6 e 13) | O que a task 6 constrói e a 7 reaproveita |
| 10 | `design/screens/rest.md` §11 (506–598; as linhas `Findings`, `Findings · ready to apply` e `Ready to merge · nothing approved` da task) | Os textos da notificação |
| 11 | Mocks: `10-screen-task-minimal/b.html` (`?scene=findings` e `?scene=close`; `FINDINGS` 1985–1990, a conversa do PR review 2120–2135, a cena 2177–2180) e `12-screen-review/components.html` (o apontamento e o cartão, com título) | A referência visual. Onde o mock e este material divergem, vale o material (§4.3 #22) |
| 12 | `docs/product/features.md` (na base) §Review de pull request (464–485), §O relatório e a decisão (577–588), §Corrigir a própria pull request (613–626), §Sessões e conversas (653–684), §Depende de mim (685–710), §Prompts (720–735), §Atalhos (787 em diante) | O comportamento de hoje |
| 13 | `docs/architecture/sessions.md` §Prompts (80–94), §O review de uma pull request sem task (96–113); `storage.md` §Banco, §Artefatos; `overview.md` §Pacotes, §O fluxo de uma task | O prompt, as seções acrescentadas, as tabelas |
| 14 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go** (M1, P19, P10 na task): o pacote `internal/prreport`, extraído de `prreview`, com o parser, a reconciliação de uma reescrita, a mensagem do envio e a razão de um relatório ilegível; a migration `0022` com `pr_passes` e `pr_findings`; o domínio em `task`; o fluxo das passadas estruturadas em `flow`; **Approve the rest** em `flow` e em `reviewflow`; a situação `findings` com as formas e os textos em `attention`; o prompt do review de PR da task com o formato e a nota de aplicar; DTO, `TaskService`, `ReviewService.ApproveRestOfFindings`, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`.
2. **A conversa da PR da task**: o cartão depois do marco do relatório, o **Finding** com título, localização (GitHub e VS Code), texto renderizado, decisão e **Edit**; os marcos `Review N written · changes · N findings`, `Review N revised` e `You decided`; o placeholder do compositor.
3. **A barra** nas formas `decide` e `apply`, na de `Ready to merge` com tudo descartado e na da passada em texto, com **Next to decide**, **Approve the rest** e **Apply approved**; `No file changed` no `changes_review`; o foco na chegada; as teclas.
4. **Approve the rest no review**: a mesma ação na barra de decisão do centro de review (é um componente só).
5. **A árvore e as notificações**: a linha da task com o progresso e as formas; os textos de `rest.md` §11.
6. **Documentação** da §7.

**Fora**, e como fica:

| O que | Até | Como fica nesta task |
|---|---|---|
| Os textos das outras notificações (P37) | 11 | Os de hoje; só os de `Findings`, `Findings · ready to apply` e `Ready to merge · nothing approved` da task mudam ou nascem aqui (`implementation.md:118`) |
| A aba **Pull request** da task arquivada, com os relatórios (P28) | 11 | O History de hoje; `pr_passes` fica guardada com a task arquivada, para a task 11 ler |
| **Discard the rest** | — | Não entra: os dados só mostram aprovar tudo (§5.4), e descartar todos é o caminho para `Ready to merge`, que um gesto em massa tornaria fácil demais |
| O review de step (`step_review`) | — | Continua em texto: o relatório do revisor do step vai ao implementador, sem decisão do usuário (`features.md` §Review pelo agente) |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| Os apontamentos da PR da task são decididos num cartão, como no centro de review, com **Apply approved** na barra quando tudo está decidido; o prompt muda | `changes.md` T16, confirmada pelo usuário (`decisions.md`, 2026-09-25, Plano confirmado; `implementation.md` §4) |
| O apontamento é o mesmo componente do centro de review, com as oito mudanças de `review.md` §20 sobre `task.md` §9 | `review.md` §20; `decisions.md`, Review: cartões na conversa |
| A decisão é a do modo Apply do centro de review: sem diálogo, **Apply approved** envia na hora, tudo descartado deixa a PR pronta para merge sozinha, e o ciclo segue pelo `changes_review` | `review.md` §14; `task.md` §9; `features.md` §Corrigir a própria pull request |
| Uma passada em texto continua em texto até a próxima passada | `implementation.md:118`, §3 (Compatibilidade de dados em curso) |
| O parser do relatório, com título opcional; a localização toma o lugar do título quando ele falta | `tasks/06-review.md` §4.4 (P19); `decisions.md`, Review: o que a entrada da task 6 decidiu |
| A razão de um relatório ilegível no texto do produto, sem o prefixo do pacote, e o envio do Apply sem marco próprio (a mensagem do produto o diz) | `tasks/06-review.md` §4.2, §4.4 (a task 6 já os faz no review) |
| As funções puras dos apontamentos em `lib/findings.ts` | `tasks/06-review.md` §4.4 (a task 6 já as cria ali) |

### 4.2 Decisões de design, detalhadas

#### O formato do relatório e o prompt

**Um formato só.** O relatório de uma passada estruturada da PR da task tem o formato do centro de review, sem diferença: o cabeçalho `---` com `repository`, `pass` e `status`; o resumo; `## Findings`; um bloco por apontamento, `### N · <título>` (o título opcional), `Location: <arquivo>:<linha>` ou `Location: general`, e o texto. O parser é um só (§4.4, `prreport`).

**O prompt.** O texto padrão de `internal/prompts/defaults/pr_review.md` não muda, e um prompt editado pelo usuário continua valendo. O que muda é o que `prompts.Render` acrescenta (`reviewSections`, `prompts.go:637–657`). As seções `## Findings format` e `## Applying` passam a entrar em todo prompt de review de PR, o da task incluído, e não só no do centro de review. `## Findings format` é o `findingsFormatNote` da task 6, que já pede o título. `## Applying` é o `applyNote` (`prompts.go:237`), que substitui a decisão item a item na conversa e diz ao agente para implementar só o que o produto enviar como aprovado. Ordem das seções num prompt da task: `## One-Shot task` (quando é One-Shot), `## Findings format`, `## Applying`, `## GitHub checks and conflicts`, `## GitHub status`, `## Review instructions` (quando há). No do centro de review, a ordem de hoje fica (`## Pull request without a task` antes de `## Findings format`; `## Publishing` ou `## Applying` pelo modo). A regra que escolhe a nota passa a ser `vars.Publish ? publishNote : applyNote`, e a task nunca liga `Publish`.

**Quando o prompt novo vai.** Só às passadas estruturadas, que são todas as pedidas depois da task: a primeira (`startReview`, `pr.go:784–806`) e cada seguinte (`askPass`, `pr.go:841–870`, que renderiza o prompt inteiro de novo). Um `reopenPRSession` (`pr.go:1055–1080`) não renderiza prompt e não muda nada.

**A mensagem de Apply approved** (a mensagem do produto `apply`, com o `appCount` dos aprovados) é um texto fixo, o mesmo do centro de review no modo aplicar, que passa ao formato do relatório, com o título e a seção dos descartados (§4.4, `prreport.ApplyMessage`; `changes.md` R19):

```
The user decided on the findings of pass 1. Implement only the ones below, and only that: no drive-by changes, no refactoring nobody asked for. Do not commit, do not run `git add` and do not push: the user reviews the changes in the app. When you are done, say in a few lines what you changed.

## Approved findings

### 1 · A new bucket lets 21 requests through
Location: internal/ratelimit/bucket.go:31

<o texto como o usuário o deixou>

### 2 · …

## Discarded findings

The user decided not to act on these. Do not report them again in a later pass unless the code they point at changes.

- 3 · Enterprise rows fall back to the Free burst · general
```

Os aprovados na ordem do relatório, com os números do relatório; sem título, `### 1`. Os descartados em lista, com o número, o título (sem ele, nada) e a localização (`arquivo:linha` ou `general`); sem descartado, a seção sai. Na conversa, é o marco de mensagem do produto `MySpec → Reviewer · apply 3 approved findings` (`markers.ts:274–275`), que abre o texto.

#### Compatibilidade: a passada em texto

Uma passada é **estruturada** quando tem uma linha em `pr_passes`. A linha é criada no momento em que o produto envia o prompt dela: em `startReview`, antes de `sessions.Start`, e em `askPass`, antes de `SendFromApp`. Se o envio falha, a linha sai (como `UnaskPass` no centro de review). `AskPRPass` sobre uma linha que já existe, não gravada, da mesma passada (um **Review again** depois de um relatório ilegível, o app fechado entre a linha e o envio, um `askPass` depois de reabrir), substitui a linha, com `asked_at` novo; sobre uma gravada, recusa. Toda passada sem linha é **em texto**: as pedidas antes da task e a que estava em curso durante a atualização.

- Uma passada em texto é conduzida até o fim como hoje: o relatório lido só pelo status (`task.ReadPRArtifacts`), `awaiting_decision` enquanto a worktree não tem mudanças, a barra `● Decide findings · PR review · pass 1` tingida sem ação, a resposta pelo compositor com `Tell the PR agent which findings to apply…` (`composer.ts:127–128`), o foco da chegada no compositor, o agente que aplica o que entendeu, e o `changes_review` de hoje. Sem cartão; o marco `Review 1 written · changes`, sem a contagem.
- A primeira passada pedida depois da atualização, a que segue o commit das mudanças ou a de **Review again**, é estruturada. Uma passada que esperava os checks durante a atualização ainda não recebeu o prompt, então já é estruturada.
- A notificação de uma passada em texto é a de hoje, `The review of the pull request found changes for you to decide.` (`text.go:142`), porque não há contagem.
- Nada é convertido: um relatório em texto nunca é relido pelo parser. Uma passada estruturada nunca volta a ser em texto.

#### Os estados da PR durante o review

`flow.PullRequest.Status` continua o mesmo enum (`pr.go:25–48`); o que muda é como `reviewingStatus` (`pr.go:239–260`) o deriva numa passada estruturada, sempre pela passada corrente. O `pr_runs.status` fica `reviewing` em todas as linhas abaixo, salvo a primeira gravação limpa, que passa a `done` como hoje (`finishReview`).

| Passada corrente | Sessão | Worktree | Status | Situação e forma |
|---|---|---|---|---|
| Pedida, sem relatório gravado | Trabalhando | — | `reviewing` | nenhuma |
| Pedida, sem relatório gravado | Em repouso | — | `awaiting_reply`, com a razão quando há um arquivo que o parser recusa | `reply` |
| Gravada, `clean` | — | — | `done` (a avaliação chama `finishReview`, como hoje) | `merge` |
| Gravada, `changes`, não enviada | Trabalhando (a reescrita que o usuário pediu) | — | `reviewing` | nenhuma: sem barra; o cartão fica |
| Gravada, `changes`, não enviada, algum sem decisão | Em repouso | Com ou sem mudanças | `awaiting_decision` | `findings` · `decide` |
| Gravada, tudo decidido, algum aprovado, não enviada | Em repouso | Com ou sem mudanças | `awaiting_decision` | `findings` · `apply` |
| Gravada, tudo decidido, nenhum aprovado, não enviada | Em repouso | Sem mudanças | `done`, derivado: a sessão fica aberta e o cartão fica | `merge` · `merge`, com `Nothing approved in pass 1` |
| Gravada, tudo decidido, nenhum aprovado, não enviada | Em repouso | Com mudanças | `in_review`, `ready_to_approve` | `changes_review` |
| Enviada | Trabalhando ou pausada | — | `reviewing` | nenhuma |
| Enviada | Em repouso | Sem mudanças, ou sem leitura | `in_review` | `changes_review` · `review`, com `No file changed` |
| Enviada | Em repouso | Com mudanças | `in_review`, `ready_to_approve` (como hoje) | `changes_review` |

O `committing`, o `waiting_checks` da passada seguinte, o `trouble`, o `merged` e o `pr_closed` ficam como hoje; com tudo descartado, o `done` derivado leva a eles como o `done` gravado (§4.2, O que `flow` faz, item 5). A sessão pausada tira a situação (a regra da task). Numa passada gravada e não enviada, a barra quieta fica com a forma que o estado pede; pausada depois do envio, no meio da aplicação dos aprovados, a passada fica `reviewing`, como a passada em texto pausada, porque o trabalho do agente está pela metade e não vai ao `changes_review` antes de ele retomar e terminar.

**As mudanças na worktree antes do envio.** O usuário pode pedir ao revisor, pelo compositor, que mude um arquivo antes de decidir (`fix #2 now`). Essas mudanças vão para o review junto com as do envio: com algo aprovado, elas esperam **Apply approved** e entram no `changes_review` que o segue; com tudo descartado, elas mesmas são o `changes_review` (a linha da tabela), e o commit segue como qualquer outro. Enquanto a decisão não acaba, o meio da barra `decide` e `apply` diz `· the worktree has changes`, com o tooltip `They go to review with the changes of the approved findings.` `ApprovePR` (`pr.go:1269–1322`) recusa (`ErrStepNotReady`) uma passada corrente não enviada que ainda tem algo aprovado ou por decidir, porque ela ainda não está em `in_review`.

#### O que `flow` faz com uma passada estruturada

1. **Gravar o relatório.** Com a sessão em repouso e a passada corrente pedida e não gravada, `flow` lê o arquivo com `prreport.ReadReport(t.ReviewPath(pass), pass)`. Ausente, espera. Ilegível (`prreport.ErrUnreadable`), guarda a razão na memória da task (como `setUnreadable` em `reviewflow/evaluate.go:125–150`) e não grava: o status é `awaiting_reply` com a razão. Legível, grava a passada com os apontamentos (`task.RecordPRReport`), `SetPRReviewed` com o head e o número, limpa a razão e grava o marco `pr_review_written` com a contagem (`MarkPRReview` com os apontamentos, como a task 6 o deixa).
2. **Reler o relatório.** Com a sessão em repouso e a passada corrente gravada, não enviada e com `changes`, `flow` relê o arquivo a cada avaliação (como `rereadPass`, `reviewflow/evaluate.go:80–114`). Igual ao gravado (`prreport.Same`: o resumo original, e cada apontamento com o número, o título, o caminho, a linha e o texto original), nada muda. Diferente, reconcilia (`prreport.Inherit`: a decisão e o texto do usuário ficam com o apontamento que diz o mesmo no mesmo lugar, pelo caminho, a linha e o texto original, com o título novo), sobe a revisão e grava o marco `pr_review_revised` com a contagem (o tipo da task 6). Reescrito para `clean`, a passada fica limpa e a avaliação chama `finishReview`, como hoje com um relatório limpo. Uma reescrita ilegível não muda nada do que foi gravado, e a razão vai ao meio da barra que a passada tiver (`decide`, `apply` ou `Ready to merge`, §4.2, A barra).
3. **Decidir, editar, aprovar o resto.** `flow.DecidePRFinding(id, pass, number, decision)`, `flow.SetPRFindingText(id, pass, number, text)` e `flow.ApproveRestOfPRFindings(id, pass)`, com o lock da task. Recusam (`ErrNotDeciding`) quando a passada não é a corrente, não foi gravada ou já foi enviada, quando a PR não está aberta, ou quando a task não está na etapa de PR num dos status da tabela em que a passada corrente está gravada e não enviada (`reviewing` da reescrita, `awaiting_decision`, o `done` e o `trouble` derivados, `in_review` e `ready_to_approve` das mudanças com tudo descartado). O texto é aparado, e vazio é recusado (`prreport.ErrEmptyText`). **Approve the rest** aprova, numa escrita só, todo apontamento da passada ainda sem decisão, e não toca nos decididos. Decidir com a sessão trabalhando (o revisor reescrevendo o relatório a pedido do usuário) é permitido: a reescrita herda a decisão.
4. **Apply approved.** `flow.ApplyPRFindings(id)`, com o lock. Pede a passada corrente gravada, não enviada, tudo decidido e algum aprovado; senão, `ErrNotDecided` ("decida todos") ou `ErrNothingApproved`. Primeiro a sessão fica pronta (`readySession`, `pr.go:1326–1344`, que retoma uma sessão pausada) e em repouso; senão, `ErrStepBusy`, e nada é gravado. Depois grava `sent_at` na passada e o marco `findings_decided` (`Approved`, `Discarded`), e envia a mensagem `apply` (`AppApply`, `Count` = aprovados). Se o envio falha, apaga `sent_at` e deixa o marco. O retry não grava outro marco quando o último `findings_decided` da passada tem as mesmas contagens. Com contagens diferentes, grava o novo, e o anterior passa a abrir sem conteúdo, como um marco de relatório reescrito. O status passa a `reviewing` e segue pela tabela acima; o watcher (`s.review.Track`) já acompanha a worktree em toda passada com `changes` (`pr.go:710–716`).
5. **Tudo descartado.** Nenhum gesto: com a passada corrente gravada, toda decidida, nenhum aprovado e a worktree sem mudanças, o status é o `done` derivado, como o `ready_to_merge` derivado do modo Apply (`reviewflow/state.go`, `applyStatus`). A sessão continua aberta, o cartão fica na conversa, e desfazer um descarte volta a `awaiting_decision`. Para a leitura do GitHub, esse `done` vale como o gravado: `PollPRs` (`pr.go:1464`), `checkPR` (`awaiting`, `pr.go:398–400`), o `trouble` que a leitura grava, `canClose` e o encerramento tratam a passada corrente toda descartada como o `done` de hoje. Três regras fecham o caminho: (a) `reviewingStatus` aplica ao `done` derivado a mesma leitura do ramo `task.PRDone` de `prStatus` (`pr.go:213–224`), então a PR mergeada dá `PRMerged`, a fechada dá `PRClosedUnmerged`, e com `run.Trouble` dá `PRTrouble`; (b) quando a leitura acha a PR mergeada ou fechada, `flow` grava `done` e fecha a sessão do review, como `finishReview` (`pr.go:827–837`), e dali tudo segue o caminho de hoje, **Close task** incluído; (c) no `trouble` derivado (tudo descartado e um check que falhou ou um conflito depois da passada), o cartão fica e decidir é permitido, como no `done` derivado. Nenhum marco `You decided` é gravado, porque nada foi enviado. O cartão mostra as decisões e, depois do merge, fica no lugar, desabilitado, com `Not sent` em cada apontamento.
6. **O commit e a passada seguinte**: como hoje. `ApprovePR` pede o commit com push; `evaluatePRCommit` (736–763) vê o commit; `askPass` pede a passada seguinte depois dos checks, agora com a linha em `pr_passes` e o prompt com o formato.
7. **Review again** (`pr.go:1346–1382`): como hoje, descarta a conversa do review e pede uma passada nova, estruturada. As decisões de uma passada não enviada ficam guardadas com ela e não vão a lugar nenhum; a conversa que as mostrava sai, como hoje sai a conversa inteira. Com alguma decisão ou edição numa passada corrente não enviada, o item do `⋯` ganha o tooltip `Starts pass 2. The decisions of review 1 aren't applied.`, como a nota do review (`review.md` §12).
8. **Back to, Discard and restart, apagar a task**: `tearDownPR` (`pr.go:1093–1116`) apaga as linhas da task em `pr_passes` (e `pr_findings` em cascata) junto com `ClearPRRun`, na mesma transação. Apagar a task apaga pela chave estrangeira. Arquivar guarda.

Um agente que insiste num formato errado deixa a passada em `awaiting_reply` com a razão; a saída é pedir a correção pelo compositor ou **Review again**.

#### A situação `findings` e as notificações

`attention.prSituation` (`derive.go:191–250`), no `PRAwaitingDecision` com a passada corrente estruturada, dá à situação `findings` a forma pelo estado da passada, `decide` ou `apply`; na passada em texto, sem forma. Durante a reescrita (`reviewing`), não há situação, como em todo `reviewing` (o `default` de `prSituation`), então a situação pode começar já em `apply` quando a decisão terminou enquanto o revisor trabalhava. Trocar de forma é seguir a mesma situação (`situation.go:88–91`): a hora de início fica, e nada notifica de novo. Com tudo descartado, a situação é a `merge` do `done` derivado.

Os textos, pela forma com que a situação começa (`rest.md` §11), e o fragmento do anúncio da barra que nasce:

| Começa em | Notificação | Anúncio |
|---|---|---|
| `decide` | `The review of the pull request found 4 changes for you to decide.` (`found 1 change`) | `decide findings in PR review` |
| `apply` | `The approved findings of the pull request review are ready to apply.` | `ready to apply in PR review` |
| `merge` com tudo descartado | `PR #1284 is ready to merge: every finding of the review was discarded.` | `ready to merge #1284` (o de hoje) |
| Passada em texto | `The review of the pull request found changes for you to decide.` (o de hoje) | `decide findings in PR review` |

O clique abre o PR review com o foco que a §4.2 (A barra) dá à forma. Os outros textos de notificação ficam como hoje até a task 11, e o `Ready to merge` comum continua `The pull request is ready to merge.` (`text.go`).

#### A árvore

A linha da task (`sidebar-tree.ts:379–383`, `structure.md`, tabela da linha), com a contagem lida da passada corrente de `task.pr.reports`:

| Forma | Longa | Curta |
|---|---|---|
| `decide` | `Decide findings · PR review · pass 1 · 1 of 4` | `Decide findings · 1/4` |
| `apply` | `Ready to apply · PR review · pass 1` | `Ready to apply · PR review` |
| `merge` com tudo descartado | `Ready to merge · PR #1284` (a de hoje) | `Ready to merge · #1284` |
| Passada em texto | `Decide findings · PR review · pass 1` | `Decide findings · PR review` |

`situationLabel` (`lib/situations.ts:88–89`) passa a `Decide findings` e `Ready to apply` pela forma; o fragmento do anúncio (`situations.ts:248–249`) segue a tabela acima.

#### A barra de decisão

A barra do pedido da task (`RequestBar`, com o modelo compartilhado da task 6), forma `decision` nas formas `decide` e `apply`, `tinted` na passada em texto e no `Ready to merge`. O lugar é `PR review · pass 1` nas barras dos apontamentos (`decide`, `apply`, passada em texto): é a passada que se decide (`review.md` §20, item 7). As outras barras da PR da task continuam com o lugar `PR review`, e a de merge com `#1284` (`task.md` §7). O chip de tempo é o da situação.

| Forma | A barra diz | No meio | Ações | Foco na chegada |
|---|---|---|---|---|
| `decide` | `● Decide findings · PR review · pass 1 12m` | `1 of 4 decided`; e, quando valem, `· the worktree has changes` e `· the rewritten report can't be read` (a razão no tooltip) | **Next to decide** `Alt ↓`, secundário `sm` (tooltip `The next finding to decide · Alt+↓`); **Approve the rest**, secundário `sm` (tooltip `Approve the 3 findings not decided yet`; aprovando, `Approving…`); `Decide 3 more` e **Apply approved** primária tracejada, com `aria-describedby` | O primeiro apontamento por decidir |
| `apply` | `● Ready to apply · PR review · pass 1 12m` | `3 approved findings go to the agent` (`1 approved finding goes to the agent`), com os mesmos acréscimos | **Apply approved**, primária; enviando, `Sending…` (`aria-busy`) | **Apply approved** |
| `merge` com tudo descartado | `● Ready to merge · #1284 2m` | `Nothing approved in pass 1`, e `· the rewritten report can't be read` quando vale | **Open PR**, secundária, como hoje | **Open PR** |
| Passada em texto | `● Decide findings · PR review · pass 1 12m` | — | nenhuma: a resposta vai pelo compositor | O compositor |

**Approve the rest** existe só na forma `decide`, que é quando algum apontamento está por decidir. Não tem tecla: ao lado de `A` e `D`, uma tecla que aprova todos seria fácil demais de apertar por engano. O marco `You decided` abre a lista de cada apontamento com a decisão, e é essa a confirmação do que foi aprovado assim. Terminado o gesto, a barra passa a `apply`, e o foco vai a **Apply approved**. É a mesma ação na barra de decisão do centro de review (§3, item 4; `review.md` §10), onde o foco vai à primária que a barra passa a ter: **Publish review…** no modo Publish, **Apply approved** no Apply.

Pausada, a mesma barra na forma quieta, com as duas barras no lugar do glifo e sem chip, com as mesmas ações; **Apply approved** retoma a sessão. Uma falha de **Apply approved** ou de **Approve the rest** é o aviso do app, como a de **Approve** hoje (`store/actions.ts:580–584`): `Couldn't apply the approved findings of Rate limit per API key` e `Couldn't approve the rest of the findings of Rate limit per API key`, com a mensagem do binding (§4.4) e **Try again**; a barra continua. Uma falha de decidir ou de salvar o texto fica no apontamento (`Couldn't save the decision · Try again`), sem aviso do app, como no review. Uma pergunta ou uma permissão do revisor durante a decisão toma a barra (`question`, `permission`, a regra da task), e o cartão fica.

O `changes_review` depois de **Apply approved** é o de hoje (`task.md` §7), com um caso novo: a passada enviada e a worktree sem mudanças mostram `● Review changes · PR review` · `No file changed` · **Open in VS Code** e **Approve** primária tracejada com `No change to approve`. A saída é pedir pelo compositor ou **Review again** no `⋯`.

#### O cartão e o Finding na conversa da task

**Onde.** Na conversa do PR review da task, logo depois do marco mais recente do relatório da passada corrente (`Review 1 written · changes · 4 findings`, ou `Review 1 revised · …` depois de uma reescrita), pelo mesmo caminho que a task 6 escolher para o review (a entrada derivada em `buildConversation` ou o `fixed`, `tasks/06-review.md` §4.4, Os cartões fixos). Há cartão só para a passada corrente (`currentPass`, §4.4), gravada, com `changes` e não enviada, com a PR aberta, nos status em que ela é decidida: `reviewing` (a reescrita dela), `awaiting_decision`, o `done` e o `trouble` derivados e o `changes_review` das mudanças com tudo descartado. Uma passada seguinte já pedida é a corrente, então o cartão da anterior sai. Não há cartão numa passada limpa, numa enviada, numa em texto, nem na espera dos checks de um **Review again**. Depois do merge ou do fechamento, o cartão de uma passada toda descartada fica no lugar, desabilitado (a conversa somente leitura, `closedReview`, `PRPane.tsx:60–80`).

**O cartão** é o **DecisionCard** da task 6 (`components.md`, Cartão neutro): `Findings` e `4` em `--ink-3` no cabeçalho, sem o progresso (a barra o diz) e sem o resumo (ele fica no relatório, que o marco abre); `role="group"` `Findings of pass 1`; uma parada de Tab com roving tabindex, o atual sendo o último com o foco, senão o primeiro por decidir, senão o primeiro.

**O Finding** é o da task 6 (`components.md`, Apontamento), sem nenhuma variante própria da task:

| Parte | Na task |
|---|---|
| Número | `1`, mono `--text-micro` `--ink-3` |
| Título | `--text-ui` 600; `--ink-2` no descartado; sem título, a localização no lugar dele |
| Localização | Ancorado: `internal/ratelimit/bucket.go:31`, link com a seta externa para a linha em `Files changed` da PR da task (`lineUrl`, F14), tooltip `Open on GitHub, in Files changed, at line 31 · O`; ao lado, o fantasma `xs` `<>`, `Open line 31 of bucket.go in VS Code`, tooltip `Open in VS Code at this line · Ctrl+E`, que chama `OpenPRFindingInEditor`. Geral: `General · not on a line of the diff`, `--ink-3`, sem link |
| Texto | O Markdown do agente renderizado; no descartado, legível, `--ink-2` |
| Decisão | **Approve** `A` e **Discard** `D`, secundários `sm`, `aria-pressed`, com `Approved · click again to undo` ou `Discarded · click again to undo` |
| Edição | **Edit** `E`; a área de cinco linhas com o Markdown cru, rótulo oculto `Text of finding 2`, `Saved as you type. It goes to the agent as you leave it.` (o texto do modo Apply) e **Done**; vazia, `Write the finding, or discard it.` e o último salvo fica |
| Desabilitado | No marco `You decided`: sem decisão nem **Edit**, com `Sent to the agent · 17:36` (de `sentAt`) no aprovado e `Not sent` no descartado. No cartão de uma passada toda descartada, depois do merge: `Not sent` em cada um |

Estados, nome acessível e erro são os da task 6: `Finding 2 of 4: Retry-After rounds down to 0 s. internal/http/middleware/ratelimit.go, line 58. Not decided.`; `Saving…`; `Couldn't save the decision · Try again`, `Couldn't save the text · Try again`.

**A reescrita.** Enquanto o revisor reescreve, não há barra; o cartão fica, com `A`, `D` e **Edit**, e o compositor diz `Queue a message for the PR agent…`. Gravada a reescrita, o marco `Review 1 revised · changes · 4 findings` entra na conversa, e o cartão passa a logo depois dele, com a decisão e o texto dos apontamentos que não mudaram. Só o marco mais recente da passada abre o relatório; os anteriores ficam sem conteúdo. Uma edição aberta num apontamento que não mudou continua aberta; num que mudou, fecha com o texto novo.

#### Os marcos

| Marco | Texto | Abre |
|---|---|---|
| `pr_review_written` | `Review 1 written · changes · 4 findings` (`· 1 finding`), `Review 1 written · clean`; na passada em texto, `Review 1 written · changes` | O relatório, **Open in Details** (como hoje, `markers.ts:330–339`) |
| `pr_review_revised` | `Review 1 revised · changes · 4 findings`, `Review 1 revised · clean` | O relatório, só o mais recente |
| `findings_decided` | `You decided · 3 approved, 1 discarded`; `You decided · 4 approved` | Os apontamentos da passada como eram, desabilitados, cada um com `Sent to the agent · 17:36` ou `Not sent` |
| Mensagem `apply` | `MySpec → Reviewer · apply 3 approved findings` (a de hoje) | O texto enviado |

Não há marco `findings_sent`, na task nem no review: a mensagem do produto logo depois de `You decided` já diz o envio, e a hora fica no apontamento desabilitado (`tasks/06-review.md` §4.2, emendado). A sequência da cena `close` é: `You decided`, a mensagem `apply`, o grupo de ações, `You approved the changes · 3 files staged`, o commit, `Review 2 written · clean`, o merge (o mock, `b.html:2128–2135`, não desenha a mensagem `apply`: §4.3 #22).

#### O compositor

O placeholder na primeira linha que vale (`composer.ts:101–133`; o contexto `findings` passa a dizer qual passada é): com o revisor trabalhando, `Queue a message for the PR agent…` (o de hoje); com uma passada estruturada em `decide`, em `apply` ou em `Ready to merge` com tudo descartado, `Ask the PR agent to add, change or drop a finding…` (`task.md` §8); na passada em texto, `Tell the PR agent which findings to apply…` (o de hoje); no `changes_review` da PR, `Ask the PR agent for a change…`, que passa a valer também ali (hoje `askForChange` só vale em `step_review` e `step_empty`, `useTaskComposer.ts:31–32`, e a PR mostra `Reply to the PR agent…`; `changes.md` T16). A primária da barra desenhada, habilitada ou tracejada, deixa **Send** secundário (`useTaskComposer.ts:28`, `otherPrimary`).

#### As teclas

As teclas de uma letra valem fora de um campo, sem modificador:

| Tecla | Onde | Age | Não age |
|---|---|---|---|
| `A`, `D` | Apontamento em foco no cartão | Decidem e levam o foco ao próximo por decidir depois dele, com volta ao começo, rolando ao centro; a que desfaz não avança; sem nada por decidir, o foco fica; `event.repeat` ignorado | Num apontamento desabilitado, nada |
| `E` | Apontamento em foco | Edita; `Esc` e **Done** fecham e devolvem o foco ao apontamento | Desabilitado, nada |
| `O` | Apontamento em foco | Abre a PR no GitHub, em `Files changed`, na linha | Num geral e fora de um apontamento, nada |
| `Ctrl+E` | Apontamento em foco; a task | No apontamento, o VS Code na linha; fora dele, a worktree (T17) | Num geral, a worktree |
| `Alt+↓`, `Alt+↑` | Qualquer lugar da tela da task com o cartão, o compositor incluído, fora de um diálogo | O próximo e o anterior por decidir, com volta | Sem nada por decidir, nada |
| `↑`, `↓` | Conversa e cartão | Dentro do cartão, andam entre os apontamentos. Vindo da entrada anterior, `↓` cai no primeiro; vindo da seguinte, `↑` cai no último. No primeiro, `↑` vai à entrada antes do cartão; no último, `↓` à entrada depois | — |
| `Home`, `End`, `Page Up`, `Page Down` | Dentro do cartão | Continuam o percurso da conversa (`task.md` §13), saindo do cartão | — |
| `Ctrl+Enter` | Barra, cartão | Não age: **Apply approved** é só um botão, como no modo Apply (`review.md` §17) | — |

**Approve the rest** não tem tecla. A ordem de Tab é a da task: cabeçalho, conversa (uma parada, o cartão incluído com o apontamento atual), barra, compositor, painel.

#### A primária em cada cena

| Cena | A primária |
|---|---|
| `findings`, `findings-edit`, `findings-revised` | **Apply approved** tracejada na barra |
| `findings-apply` | **Apply approved** |
| `findings-discarded` | Nenhuma na barra (**Open PR** é secundária); **Send** com texto |
| `findings-sent` (o revisor aplicando) | Nenhuma; **Send** com texto, pela regra da task |
| `findings-text`, `findings-unreadable` | Nenhuma na barra; **Send** com texto |
| `close` | **Close task** |

**Next to decide**, **Approve the rest**, **Approve**, **Discard**, **Edit** e **Done** são secundários ou fantasmas.

#### As fixtures e as cenas

As fixtures de `test/task-scenes.ts` (`SCENE_NOW` 17:40, `task-scenes.ts:87`) para a PR `#1284`, com os apontamentos do mock (`b.html:1985–1990`) e os títulos que o mock não tem:

| # | Título | Localização | Texto |
|---|---|---|---|
| 1 | `A new bucket lets 21 requests through` | `internal/ratelimit/bucket.go:31` | O texto do mock, em Markdown: `**e2e / rate-limit-burst failed.**` em negrito e `last` em código |
| 2 | `Retry-After rounds down to 0 s` | `internal/http/middleware/ratelimit.go:58` | O texto do mock |
| 3 | `Enterprise rows fall back to the Free burst` | geral | O texto do mock |
| 4 | `The docs give Pro 600 requests per minute` | `docs/rate-limits.md:12` | O texto do mock |
| 5 (só na reescrita) | `The burst test sleeps a whole second` | `e2e/ratelimit_test.go:44` | ``The test waits `time.Sleep(time.Second)` for the refill. With the clock `bucket.go` already takes, it can move the clock and run in milliseconds.`` |

| Cena | Estado | Mock |
|---|---|---|
| `findings` | Passada 1, relatório às 17:28 (a situação há 12m), o 1 aprovado, os outros por decidir, o foco no 2; `decide` | `b.html?scene=findings` |
| `findings-apply` | Como `findings`, com o 1, o 2 e o 4 aprovados e o 3 descartado; `apply`, a situação desde 17:28 (12m) | Sem mock: a forma do review em `12-screen-review` (`ready_to_apply`) |
| `findings-discarded` | Os quatro descartados, a worktree sem mudanças; o `done` derivado, `merge` desde 17:38 (2m), o cartão na conversa | Sem mock |
| `findings-edit` | Como `findings`, o 2 em edição | Sem mock |
| `findings-revised` | `Review 1 written · changes · 4 findings` às 17:28 e `Review 1 revised · changes · 5 findings` às 17:34, o cartão depois do segundo, o 1 aprovado herdado, o 5 novo por decidir; `decide`, a situação desde 17:28 (12m) | Sem mock |
| `findings-sent` | Relatório às 17:28; `You decided · 3 approved, 1 discarded` às 17:36, aberto com os desabilitados (`Sent to the agent · 17:36`, `Not sent`), a mensagem `apply` às 17:36, o revisor trabalhando desde 17:36 (`Working · 4m`) | Sem mock |
| `findings-text` | Passada 1 em texto: o marco sem contagem, a barra tingida sem ação, o placeholder de hoje | Sem mock |
| `findings-unreadable` | A passada 1 gravada às 16:50, decidida (1, 2 e 4 aprovados, 3 descartado) e enviada às 17:02 (`You decided`, a mensagem `apply`), `You approved the changes · 3 files staged` às 17:18, o commit `4b7e0aa` às 17:20 com push, `Checks read before pass 2` às 17:30, a passada 2 pedida às 17:31 (a mensagem `pr_pass`), o relatório das 17:37 recusado pelo parser; `● Waiting for reply · PR review 3m` com `The report can't be read: finding 2 does not open with its location.` no meio | Sem mock |
| `close` | A de hoje, com a sequência da §4.2 (Os marcos) na conversa somente leitura | `b.html?scene=close` |

A pílula em todas as cenas de decisão é a de hoje: `PR review pass 1` com o disco âmbar (`TaskView.scenes.painted.test.tsx:70`); na `findings-discarded`, a de `Ready to merge`, como a de hoje com a PR esperando o merge.

#### Acessibilidade

O cartão é `group` `Findings of pass 1`; cada Finding `group` com o nome da tabela acima; a decisão `aria-pressed`; a localização é link com a seta e o nome inteiro. A barra é `region` `Request` com o texto de estado em `role="status"`; o anúncio da barra que nasce: `Rate limit per API key: waiting for you: decide findings in PR review`. A primária tracejada tem `aria-describedby` para `Decide 3 more`. **Approve the rest** carregando tem `aria-busy`. Os testes acham cada peça por `getByRole` com esses nomes.

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | Tudo decidido sem nenhum aprovado: `task.md` §9 só previa **Apply approved**, que não teria o que enviar | Como o modo Apply: o `done` derivado, `Ready to merge` sozinho, sem gesto, com a sessão aberta e o cartão na conversa, reversível até o merge. A PR da task ganha uma saída do laço que não é um relatório limpo, pela palavra do usuário | `task.md` §7, §9; `changes.md` T16; `decisions.md` |
| 2 | Tudo decidido com algum aprovado: a barra da task só tinha `Decide findings` com **Apply approved** habilitado | A forma `apply`, `Ready to apply · PR review · pass 1`, como `ready_to_apply` no review | `task.md` §7; `structure.md` |
| 3 | O lugar da barra: `components.md` dizia "sem a passada", `review.md` §20 e `implementation.md` dizem `PR review · pass N` | `PR review · pass N` nas barras dos apontamentos; `PR review` nas outras barras da PR da task | `components.md` (Barra do pedido); `task.md` §7 |
| 4 | A passada enviada que o agente deixa sem mudanças: hoje voltaria a `awaiting_decision`, sem saída | `Review changes` com `No file changed` e **Approve** tracejada `No change to approve`, como o `in_review` do centro de review | `task.md` §7 |
| 5 | A regra exata da compatibilidade | A linha em `pr_passes`, criada no envio do prompt, define a passada estruturada; `AskPRPass` substitui uma linha não gravada; sem linha, em texto até o fim | §4.2; `backend.md` M1 |
| 6 | O frontend não sabia qual é a passada corrente (crítica, L1) | `PullRequest.currentPass`, `PRReport.recorded` e o `clean` da linha; o cartão só da passada corrente | §4.4 |
| 7 | O agente não sabia dos descartados (L2) | A seção `## Discarded findings` na mensagem de **Apply approved**, nas duas telas | §4.2; `changes.md` R19; `sessions.md` |
| 8 | A situação durante a reescrita (L3) | Sem situação nem barra enquanto o revisor trabalha; a situação começa na forma que a passada tem, com o texto de cada forma | §4.2; `rest.md` §11 |
| 9 | As mudanças na worktree antes do envio (L5) | Vão ao review junto com as do envio; com tudo descartado, elas são o `changes_review`; `ApprovePR` recusa antes do envio | §4.2 |
| 10 | O `You decided` de um envio que falha (L6) | O marco depois de a sessão estar pronta; o retry não o repete com as mesmas contagens | §4.2 |
| 11 | O relatório estruturado ilegível | `awaiting_reply` com a razão no meio da barra, como no review; uma reescrita ilegível mantém o gravado e a razão vai ao meio da barra que a passada tiver | `task.md` §7 |
| 12 | Decidir enquanto o revisor reescreve | Permitido, como no review; recusado depois do envio e com uma passada seguinte pedida | §4.2 |
| 13 | `↑` `↓`, `Home`, `End`, `Page Up`, `Page Down` e a entrada no cartão | A tabela das teclas, nas duas telas | `components.md` (Apontamento) |
| 14 | `Ctrl+Enter` na barra de decisão da task | Não age, como no modo Apply | `structure.md` §5; `task.md` §13 |
| 15 | **Review again** com decisões não enviadas: o review tem a nota no diálogo, a task não tem diálogo | Sem diálogo, como hoje na task; o tooltip do item do `⋯` diz que as decisões não são aplicadas | §4.2 |
| 16 | O placeholder do `changes_review` da PR era `Reply to the PR agent…` | `Ask the PR agent for a change…`, como nas mudanças do Apply no review | `task.md` §8; `changes.md` T16 |
| 17 | O texto padrão de `pr_review.md` pede a decisão item a item na conversa | O padrão não muda; as seções acrescentadas o substituem, como no centro de review | §4.2 |
| 18 | O texto de **Edit** na task | `It goes to the agent as you leave it.`, o do modo Apply | `components.md` (Apontamento) |
| 19 | O resumo da passada: editável em `task.md` §9, fora do cartão em `review.md` §20 | Fora do cartão e não editável na task; a tabela guarda só o original, para `Same` | `task.md` §9 |
| 20 | Aprovar de uma vez: toda resposta real aprovou tudo (§5.4) | **Approve the rest** na forma `decide`, nas duas telas, sem tecla, com `You decided` como a confirmação do que foi aprovado; sem **Discard the rest** | `changes.md` T27; `components.md`; `review.md` §10; `decisions.md` |
| 21 | Os títulos e as horas das fixtures (o mock não tem) | As tabelas da §4.2 | §4.2 |
| 22 | Divergências do mock | Vale o material (`implementation.md:18`). As conhecidas: o cartão do mock com `Summary · editable` e sem títulos; a árvore com `Findings · PR review · 1 of 4` (vale `Decide findings · PR review · pass 1 · 1 of 4`); a barra do mock sem `Ready to apply` e sem **Approve the rest**; a conversa da cena `close` sem a mensagem `apply` depois de `You decided` | `implementation.md:18` |

### 4.4 O que o tech spec toma

- **`internal/prreport`**, um pacote novo, dono do relatório de uma passada de review de pull request: o formato que o agente escreve, o parser e como as decisões atravessam uma reescrita. Ele recebe:
  - de `prreview/report.go` (com o título de P19 da task 6): `Report`, `ParsedFinding`, `ParseReport`, `ReadReport` e `ErrUnreadable` (`"prreport: the report can't be read"`);
  - de `prreview/review.go` e `service.go`: o `Decision` com `ParseDecision` e `ErrUnknownDecision`; um `Finding` base (`Number`, `Title`, `Path`, `Line`, `Original`, `Text`, `Decision`, com `Anchored`) com `Fresh`, `Inherit` e `Same` (`service.go:750–799`); e `ErrEmptyText`;
  - de `reviewflow/apply.go:62–74`: `ApplyMessage(pass, findings)`, no formato da §4.2, com a seção dos descartados;
  - de `prreview.Reason` (task 6): `Reason(err) string`.

  `prreview` passa a usar o `Finding` base, embutindo-o em `prreview.Finding` (que fica com `Placement`) ou convertendo entre os dois; o tech spec escolhe. Embutir reescreve cerca de 67 literais em `prreview`, `reviewflow`, `store` e `bindings`. `prreview.Decision` vira um alias. A regra da task 6, de uma releitura que difere só nos títulos, fica em `prreview`. `flow` importa `prreport`, nunca `prreview`.
- **A migration `0022_pr_findings.sql`**:
  ```sql
  -- The passes of the review of the pull request of a task that the app asked
  -- for with the structured format, one row each; a pass without a row was asked
  -- before the format and is decided in the conversation.
  CREATE TABLE pr_passes (
      task_id          TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
      pass             INTEGER NOT NULL,
      asked_at         TEXT NOT NULL,
      recorded         INTEGER NOT NULL DEFAULT 0, -- 1 once a readable report was recorded
      clean            INTEGER NOT NULL DEFAULT 0,
      summary_original TEXT NOT NULL DEFAULT '',   -- as the report has it
      revision         INTEGER NOT NULL DEFAULT 0, -- bumped every time the report is read again and differs
      recorded_at      TEXT NOT NULL DEFAULT '',   -- the first readable report, RFC 3339
      sent_at          TEXT NOT NULL DEFAULT '',   -- Apply approved, RFC 3339; '' before
      PRIMARY KEY (task_id, pass)
  ) STRICT;
  CREATE TABLE pr_findings (
      task_id  TEXT NOT NULL,
      pass     INTEGER NOT NULL,
      number   INTEGER NOT NULL,          -- as the report numbers it
      title    TEXT NOT NULL DEFAULT '',  -- '' when the report gives none
      path     TEXT NOT NULL DEFAULT '',  -- '' for a general finding
      line     INTEGER NOT NULL DEFAULT 0,
      original TEXT NOT NULL,             -- as the report has it
      text     TEXT NOT NULL,             -- as the user left it
      decision TEXT NOT NULL DEFAULT '',  -- '' | 'approved' | 'discarded'
      PRIMARY KEY (task_id, pass, number),
      FOREIGN KEY (task_id, pass) REFERENCES pr_passes (task_id, pass) ON DELETE CASCADE
  ) STRICT;
  ```
  Nenhum dado é migrado: toda passada existente fica em texto.
- **O domínio em `task`**: `task.PRPass` (`Pass`, `AskedAt`, `Recorded`, `Clean`, `SummaryOriginal`, `Revision`, `RecordedAt`, `SentAt`, `Findings []prreport.Finding`, com `Decided()`, `Approved()`, `Discarded()`, `Sent()`), no cache do `task.Service` ao lado de `prRuns` (`service.go:87`), carregado no `Sync`; os métodos `AskPRPass` (que substitui uma linha não gravada), `UnaskPRPass`, `RecordPRReport` (primeira gravação ou reconciliação, devolvendo se mudou), `DecidePRFinding`, `ApproveRestOfPRFindings`, `SetPRFindingText`, `MarkPRPassSent`, `UnmarkPRPassSent` e `PRPasses(id)`; `ClearPRRun` (`service.go:960`) apaga as passadas na mesma transação. `store`: os métodos em `TasksRepo`, num arquivo novo `store/pr_passes.go`, com o `WritePass` transacional (passada e apontamentos), como `WritePass` de reviews.
- **`flow`**: `flow.PullRequest` ganha `Passes []task.PRPass` e `Unreadable string`; `prFacts` ganha a passada corrente e se a worktree tem mudanças; `reviewingStatus` segue a tabela da §4.2 (a passada em texto pelo caminho de hoje), com o `done` derivado; uma função `awaitingMerge(run, passada)` que `PollPRs`, `checkPR`, `canClose` e o encerramento usam no lugar de `run.Status == task.PRDone`; `reviewingStatus` com a leitura do ramo `PRDone` no `done` derivado, e a gravação de `done` com a sessão fechada quando a leitura acha a PR mergeada ou fechada (§4.2, O que `flow` faz, item 5); `evaluateReview` grava e relê pela §4.2; `ApprovePR` recusa antes do envio; os erros novos `ErrNotDeciding`, `ErrNotDecided` e `ErrNothingApproved`; os métodos `DecidePRFinding`, `SetPRFindingText`, `ApproveRestOfPRFindings` e `ApplyPRFindings`; `startReview` e `askPass` chamam `AskPRPass` antes do envio e `UnaskPRPass` na falha; `tearDownPR` limpa. Os comentários de `PRDone` (`pr.go:42`) e de `reviewingStatus` passam a dizer que um review também termina numa passada toda descartada.
- **`reviewflow`**: `ApproveRest(id, pass)`, pelo mesmo `deciding` (`reviewflow/decide.go`), e `prreview.Service.ApproveRest`; `apply.go` passa a `prreport.ApplyMessage` com os descartados.
- **`prompts`**: `reviewSections` (`prompts.go:637–657`) acrescenta `## Findings format` e (`Publish` ? `## Publishing` : `## Applying`) a todo prompt de review de PR; `## Pull request without a task` fica só com `External`. `prompts_test.go` cobre o prompt da task com as duas seções na ordem da §4.2.
- **`session`**: nada novo. `MarkPRReview` com a contagem e os tipos `pr_review_revised` e `findings_decided` vêm da task 6; `AppApply` existe (`transcript.go:77`).
- **`attention`**: `prSituation` com a forma `decide` ou `apply` e o `merge` do `done` derivado; `findingsBody(form, count)` com `-1` para a passada em texto; `mergeBody` com a variante de tudo descartado (§4.2).
- **Bindings**:
  - `PullRequest` (`dto.go:280`) ganha `currentPass` (a linha de número mais alto em `pr_passes`; 0 sem linha, na passada em texto) e `unreadableReport` (`prreport.Reason`).
  - `PRReport` (`dto.go:250–254`) passa a ter uma entrada por passada com arquivo ou com linha; uma linha sem arquivo vem com `file` vazio. Ganha `structured`, `recorded`, `findings []ReviewFinding` (never nil; o DTO da task 6 com `title` e `lineUrl`, `placement` sempre vazio), `revision`, `recordedAt` e `sentAt`, e leva o `clean` da linha quando há uma.
  - `lineUrl` sai da mesma função da task 6, sobre `run.PR.URL`.
  - `TaskService` ganha `DecidePRFinding(taskID, pass, number, decision)`, `SetPRFindingText(taskID, pass, number, text)`, `ApproveRestOfPRFindings(taskID, pass)`, `ApplyPRFindings(taskID)` e `OpenPRFindingInEditor(taskID, pass, number)` (como `ReviewService.OpenFindingInEditor`, `review_service.go:251–267`); `ReviewService` ganha `ApproveRestOfFindings(id, pass)`.
  - `userMessages` (`task_service.go:751`): `ErrNotDeciding` → `These findings can't change now: they went to the agent, or a new pass started.`; `ErrNotDecided` → `Decide every finding first.`; `ErrNothingApproved` → `No finding is approved.`; `prreport.ErrEmptyText` → `Write the finding, or discard it.`.
  - `convert_test.go` cobre a passada pedida sem arquivo e a ilegível. Depois, `task generate`.
- **Frontend**:
  - Os tipos e as fixtures: `lib/wails.ts` e `test/wails-mock.ts` (`makePRReport` com os apontamentos).
  - As funções puras: `lib/findings.ts`, da task 6, usada como está. `features/task/pr-findings.ts` é novo: a passada com cartão por `currentPass`, a forma, o progresso, os rótulos, o meio, o foco, o rótulo do desabilitado, o placeholder.
  - A barra: `request.ts` (`findingsRequestOf`, `request.ts:992–1001`) nas formas da §4.2, e `No file changed` no `changes_review`; `TaskRequest.tsx` com as ações; o `RequestBar` de decisão com **Approve the rest** nas duas telas (`features/reviews/review-request.ts` da task 6 também).
  - As ações em `store/actions.ts`: `decidePRFinding` e `savePRFindingText`, cuja falha volta ao apontamento; `approveRestOfPRFindings`, `approveRestOfFindings` (o review), `applyPRFindings` e `openPRFindingInEditor`, cuja falha é o aviso do app.
  - O lugar: `prPlaceOf` (`place.ts:178–187`) dá `conversation`, com o compositor, ao `done` e ao `trouble` derivados (a passada corrente gravada, não enviada e toda descartada, com `status` `done` ou `trouble`), no lugar da conversa somente leitura (`closedReview`) que hoje todo `done` recebe.
  - A conversa: `markers.ts` (`prReviewLine`, 330–339) com a contagem e o contexto da task para `pr_review_revised` e `findings_decided`; o cartão ancorado na conversa do `PRPane.tsx` (84–97); `useTaskComposer.ts:31–32` com o contexto que distingue a passada estruturada da em texto e com `askForChange` no `changes_review` da PR.
  - A árvore, os rótulos e a chegada: `lib/situations.ts` e `sidebar-tree.ts` com as formas; o alvo de foco `finding` da task 6 (`lib/focus.ts`) na chegada da task.

## 5. Inventário atual

### 5.1 O backend

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `internal/flow/pr.go` (1490 linhas) | `reviewingStatus` (239–260) deriva `awaiting_decision` de um relatório com `changes` e a worktree sem mudanças; `evaluateReview` (669–731) grava o relatório novo só pelo status do arquivo (`newReport`, 889–895; `recordReport`, 810–822, com `MarkPRReview` sem contagem); `startReview` (784–806) e `askPass` (841–870) renderizam o prompt; `ApprovePR` (1269–1322); `ReviewAgain` (1346–1382); `tearDownPR` (1093–1116); `PollPRs` (1464) e `checkPR` (389) só com `PRDone`; o `passAsked` na memória (930–950) | As passadas estruturadas (§4.2, §4.4); a passada em texto pelo caminho de hoje |
| `internal/flow/pr_checks.go` (214), `pr_test.go`, `pr_cycle_test.go` | A espera dos checks; os testes do ciclo | Ficam; `pr_findings_test.go` novo |
| `internal/task/pr_artifacts.go` (187) | `ReviewReport` (52–60) com `Findings: -1` para a PR; `readReport` (134–152) lê só o status | Fica: é o que lê a passada em texto e o arquivo de cada passada |
| `internal/task/service.go` | O cache de `prRuns` (87), `SetPRReviewed` (937), `ClearPRRun` (960) | As passadas estruturadas no cache |
| `internal/store/prs.go`, `migrations/` (até `0020`; `0021` da task 6) | `pr_runs` | `pr_passes.go` e `0022` |
| `internal/prreview/report.go` (257), `review.go` (278), `service.go` (824) | O parser (P19 e `Reason` na task 6), `Finding`, `Decision`, `same`, `fresh`, `inherit` | Para `prreport`; `ApproveRest` novo |
| `internal/reviewflow/apply.go` (247), `evaluate.go` (150), `decide.go` | `applyMessage` (62–74), sem título e sem os descartados; `rereadPass`, `reportUnreadable`; `deciding` | `prreport.ApplyMessage`; `ApproveRest` |
| `internal/prompts/prompts.go` (668), `defaults/pr_review.md` | `findingsFormatNote` (229), `applyNote` (237), `reviewSections` (637–657) só com `External` | As duas seções em todo review de PR |
| `internal/attention/derive.go` (251), `text.go` (292), `situation.go` | `prSituation` (191–250) com `findings` sem forma; `findingsBody` (142) sem contagem; `FormDecide`, `FormApply` (94–96) | As formas e os textos |
| `internal/session/service.go` (1422), `transcript.go` | `MarkPRReview` (890) sem contagem; `AppApply` (77) | Os da task 6, usados na task |
| `internal/bindings/dto.go` (1499), `convert.go` (2123), `task_service.go` (887), `review_service.go` | `PRReport` (250–254), `PullRequest` (280–363), a conversão (`fromReports`, 513–519), `userMessages` (751) | §4.4 |

### 5.2 O frontend

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `features/task/request.ts` (1046) | `findingsRequestOf` (992–1001): tingida, sem ação, foco no compositor; `sessionRequestOf` (823) | As formas da §4.2 e `No file changed` |
| `features/task/TaskRequest.tsx` (234), `useTaskRequest.ts`, `request-focus.ts` (40) | A barra e o foco da chegada | As ações e o alvo `finding` |
| `features/task/PRPane.tsx` (101), `place.ts` (`prFixedCardOf` 232–241, `FILES_PR` 220) | A conversa do PR review com o cartão fixo | O cartão de apontamentos ancorado |
| `features/task/useTaskComposer.ts` (`otherPrimary` 28; o contexto 30–33), `features/chat/composer.ts` (44–45, 127–131) | `findings: boolean`, `Tell the … which findings to apply…`; `askForChange` só no step | O contexto distingue as duas passadas; `askForChange` no `changes_review` da PR |
| `features/chat/markers.ts` (483; `prReviewLine` 330–339; `markerOf` 385) | `Review 1 written · changes`, sem contagem | A contagem, `revised`, `You decided` com os desabilitados |
| `features/sidebar/sidebar-tree.ts` (379–383), `lib/situations.ts` (88–89, 248–249) | `Decide findings · PR review · pass N`, sem contagem | As formas e a contagem |
| `features/task/pr-status.ts` (26, 69, 124), `status.ts` (34), `stepper.ts` (65) | `awaiting_decision` como `Waiting for your decision` | Ficam |
| `test/task-scenes.ts` (`findings` 463–472, 537–540; `close` 486) | `awaiting_decision` com `reports: [{pass: 1, file: "1.md", clean: false}]` e uma conversa de duas falas | As fixtures e as cenas da §4.2 |
| `features/task/TaskView.scenes.painted.test.tsx` (315), `where-actions-went.test.tsx` (1057), `TaskView.test.tsx` | As nove cenas, as ações | As cenas novas, as linhas novas |
| `components/system/` | Da task 6: **Finding**, **DecisionCard**, `RequestBar` com `decision` (`RequestBar.tsx:9`) | Usados sem variante nova; **Approve the rest** na barra de decisão |
| `lib/findings.ts`, `features/reviews/review-request.ts` (task 6) | As regras do próximo por decidir; a barra do review | Usadas; **Approve the rest** na barra do review |

### 5.3 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| O relatório da passada: número, arquivo, `clean` | `PRReport`, dos arquivos | Uma entrada por linha também; `structured`, `recorded`, `findings`, `revision`, `recordedAt`, `sentAt` (M1) |
| A passada corrente | — | `PullRequest.currentPass` (M1) |
| O apontamento: número, título, caminho, linha, texto, decisão, link | `ReviewFinding` (task 6) | Nada: o mesmo DTO |
| A razão do relatório ilegível | `prreview.Reason`, no review (task 6) | `PullRequest.unreadableReport` |
| A contagem da notificação | — | Da passada corrente (M1) |
| Os marcos: relatório com contagem, reescrita, decisões | Os tipos da task 6 | Gravados na conversa da task (P10) |
| O progresso `1 of 4`, a forma, o foco, o placeholder | As decisões | Só frontend |

### 5.4 Medido nos dados reais

Do diretório de dados (`~/.local/share/myspec`), em 2026-09-29: 34 PRs de task revisadas, com 1 passada (14), 2 (10), 3 (6), 4 (1), 5 (2) e 6 (1). São 72 relatórios, 31 com `changes`. Nos relatórios com mudanças, a mediana é de 3 apontamentos, e 7 dos 31 têm de 15 a 29. O agente já escreve um título: a maioria usa `1. **Título**`, com a localização em sublistas (`**Onde:**`, às vezes com mais de um arquivo), e 22 usam `### N.`. Nenhum usa `Location:`, então nenhum relatório de hoje seria legível pelo parser. É o que confirma que a passada em texto não pode ser relida.

As respostas do usuário às decisões em texto, nas duas conversas de PR review guardadas, foram `fix all needed`, `do fixes`, `fix`, `fix` e `do the fixes with fast agents like sonnet 5.5`: aprovar tudo, sempre. Daí **Approve the rest**.

Nos 13 relatórios `changes` do centro de review (`~/.local/share/myspec/reviews`), escritos com o mesmo `pr_review.md` e as mesmas seções acrescentadas, todo apontamento segue `### N` e `Location:`. Nenhuma task está hoje em `awaiting_decision` (duas em `done`), e o prompt padrão não foi editado (`~/.local/share/myspec/prompts` está vazio).

## 6. As tasks 4, 6 e 7, os riscos e o primeiro step

**A ordem.** As tasks 4 e 5 e depois a 6 entram antes; a 7 começa da `main` com as três e não corre em paralelo com nenhuma (`implementation.md` §1). Se a 6 atrasar, a 7 espera: o **Finding**, o **DecisionCard**, o parser com título, `Reason`, `lib/findings.ts`, os marcos do review e o modelo compartilhado da barra não são construídos duas vezes. A task 6 já sai com a razão no texto do produto, sem o marco `findings_sent` e com as funções puras em `lib/findings.ts` (`tasks/06-review.md`, emendado antes de ela começar).

**O que a 7 usa e muda das anteriores**, arquivo por arquivo:

| Arquivo | Task 4 | Task 6 | Task 7 |
|---|---|---|---|
| `internal/prreview/report.go`, `review.go`, `service.go` | — | P19: o título no parser, `same`, `inherit`; `Reason` | Extrai para `prreport`; `ApproveRest` |
| `internal/reviewflow/apply.go`, `evaluate.go`, `decide.go` | — | O envio sem marco próprio; a razão no texto do produto | `prreport.ApplyMessage` com os descartados; `ApproveRest` |
| `internal/prompts/prompts.go` | — | `findingsFormatNote` com o título | As seções em todo review de PR |
| `internal/session/` | Os marcos da task, `AppApply`, `MarkChecksRead` | `MarkPRReview` com contagem, `pr_review_revised`, `findings_decided` | Usa |
| `internal/store/migrations/` | `0020` | `0021` | `0022` |
| `internal/flow/pr.go` | O ciclo de hoje, os marcos da PR | — | As passadas estruturadas |
| `internal/bindings/dto.go`, `convert.go` | `PullRequest` com checks e merge | `ReviewFinding.title`, `lineUrl` | `PRReport`, `currentPass`, `unreadableReport`, os métodos da task, `ApproveRestOfFindings` |
| `components/system/` | `RequestBar` (`decision`) | **Finding**, **DecisionCard** | **Approve the rest** na barra de decisão |
| `features/task/request.ts`, `TaskRequest.tsx`, `lib/focus.ts` | O modelo, a chegada | O tipo compartilhado, `sessionRequestOf` genérico, o alvo `finding` | As formas de `findings` |
| `features/reviews/review-request.ts` | — | Cria | **Approve the rest** |
| `features/chat/markers.ts`, `conversation.ts`, `Conversation.tsx` | Os marcos, os cartões fixos | Os marcos do review, o cartão ancorado | O contexto da task nos marcos do review |
| `lib/findings.ts` | — | Cria | Usa |
| `features/sidebar/sidebar-tree.ts`, `lib/situations.ts` | — | Os rótulos do review | As formas de `findings` |
| `test/task-scenes.ts`, `TaskView.scenes.painted.test.tsx` | As nove cenas | — | As cenas da §4.2 |
| `docs/product/features.md` | §Review de pull request (a barra em texto) | §Centro de review | §Review de pull request, §O relatório e a decisão, §Corrigir a própria pull request, §Sessões e conversas, §Depende de mim, §Prompts, §Atalhos |

| Risco | Tratamento |
|---|---|
| **O agente não seguir o formato** | Os 13 relatórios do centro de review já escritos com esse formato o seguem (§5.4); o relatório ilegível vira `Waiting for reply` com a razão, e a saída é o compositor ou **Review again**; uma passada estruturada nunca volta ao texto; o pronto 9 prova com uma task real |
| **O descartado que volta** | A seção `## Discarded findings` na mensagem de **Apply approved**; o pronto 9 pede o descarte seguido de uma passada limpa |
| **A passada em curso durante a atualização** | A linha em `pr_passes` só nasce no envio do prompt; a passada em texto nunca passa pelo parser (§5.4 mostra que nenhum relatório de hoje seria legível) |
| **O refactor do parser** | `prreport` é extraído no step 1, com os casos de `prreview` e `reviewflow` mudando só no pacote e no texto da mensagem do Apply (pronto 5) |
| **O `done` derivado** | `awaitingMerge` num lugar só; os testes de tabela do pronto 4 cobrem a leitura do merge, o `trouble` e o encerramento com tudo descartado |
| **Listas longas** | Um quarto dos relatórios tem de 15 a 29 apontamentos; **Approve the rest**, `A`/`D` que avançam e rolam ao centro, `Alt+↓`; o caso de 29 no pronto 2 |
| **Decidir enquanto o revisor reescreve** | `Inherit` pela localização e o texto original, como no review; a decisão num apontamento que mudou se perde, e o cartão mostra o novo por decidir |
| **O banco do usuário** | O ciclo real roda numa cópia do diretório de dados (pronto 9) |
| **Os testes com limiar** | Cada step escreve os testes do que cria e apaga os do que remove |

**Como o primeiro step é feito.** É a extração de `prreport`, só no Go: o pacote novo com o parser, `Decision`, o `Finding` base, `Fresh`, `Inherit`, `Same`, `Reason` e `ApplyMessage`; `prreview` e `reviewflow` passam a usá-lo; os testes do parser mudam de pacote. O step muda um comportamento do centro de review, e o diz: a mensagem de **Apply approved** passa ao formato do relatório, com o título e a seção dos descartados (R19), e os casos de `reviewflow/apply_test.go` que a conferem (85–90, 332–333, 503–504) são reescritos no mesmo commit, com `sessions.md` §O review de uma pull request sem task e `features.md` §Corrigir a própria pull request.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/overview.md` §Pacotes | `prreport` | 1 |
| `docs/architecture/sessions.md` §O review de uma pull request sem task | A mensagem do Apply no formato do relatório, com os descartados | 1 |
| `docs/product/features.md` §Corrigir a própria pull request | A mensagem aos aprovados diz também os descartados | 1 |
| `docs/architecture/storage.md` §Banco | `pr_passes` e `pr_findings` | 2 |
| `docs/product/features.md` §O relatório e a decisão | **Approve the rest** | 6 |
| `docs/architecture/overview.md` §O fluxo de uma task | O ciclo das passadas estruturadas, o `done` derivado | 7 |
| `docs/architecture/sessions.md` §Prompts | As seções `Findings format` e `Applying` em todo review de PR, na ordem da §4.2 | 7 |
| `docs/product/features.md` §Review de pull request | O relatório no formato do centro de review; o cartão, o **Finding**, `A`/`D`, **Edit**, a localização; **Approve the rest**; `Decide findings`, `Ready to apply` e `Ready to merge` com tudo descartado; **Apply approved** com os descartados; os marcos; `No file changed`; as mudanças antes do envio; a passada anterior à versão decidida em texto; o review que termina num relatório limpo ou numa passada toda descartada | 7 |
| §Sessões e conversas | Os marcos `Review N revised` e `You decided` na conversa da PR da task | 7 |
| §Depende de mim | As formas da situação na barra e na árvore; os textos das notificações | 7 |
| §Prompts | As seções acrescentadas também no prompt da task | 7 |
| §Atalhos | `A`, `D`, `E`, `O`, `Ctrl+E` num apontamento e `Alt+↓`/`Alt+↑` também na task | 7 |
| `docs/development/troubleshooting.md` | As mensagens de log novas (`pr review report recorded`, `pr review report rewritten`, `pr review report is unreadable`, `pr review findings applying`) | 7 |

## 8. Plano de steps sugerido

Oito steps (M), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria. O app fica usável em todos: até o step 7, nenhuma passada da task é estruturada, porque a linha em `pr_passes` e o prompt novo nascem juntos no step 7, com o cartão que as decide pronto no 6. O único comportamento que muda antes é o do centro de review, nos steps 1 e 6, e o step o diz.

1. **`prreport`.** A extração da §6 (Como o primeiro step é feito), com a mensagem do Apply nova no review.
2. **A migration e o domínio.** A `0022`, `store/pr_passes.go`, `task.PRPass` no cache com os métodos (`AskPRPass` que substitui a linha não gravada), `ClearPRRun` com as passadas; testes de `store` e `task`. Nada usa ainda.
3. **O fluxo.** `flow` grava, relê, decide, edita, aprova o resto e aplica as passadas estruturadas; o status pela tabela da §4.2, o `done` derivado e `awaitingMerge`; `ApprovePR` que recusa antes do envio; `tearDownPR`; `reviewflow.ApproveRest`; `attention` com as formas e os textos; os testes de tabela do pronto 4, com as passadas criadas pelo teste. `startReview` e `askPass` ainda não criam a linha: nada muda no app.
4. **A fronteira.** Os DTOs (`currentPass`, `recorded`, a entrada por linha, `unreadableReport`), os métodos de `TaskService` e `ReviewService.ApproveRestOfFindings`, `userMessages`, `lineUrl`, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`, `convert_test.go`. Nada na tela.
5. **O modelo do frontend e os marcos.** `features/task/pr-findings.ts` com os testes em tabela, `findingsRequestOf` nas formas da §4.2 com as ações e as falhas, `No file changed`, `lib/situations.ts`, `sidebar-tree.ts`, `markers.ts` com a contagem, `revised` e `You decided` com os desabilitados, o placeholder (com `Ask the reviewer for a change…` no `changes_review` da PR, que já vale para as passadas em texto: a linha de T16 em `features.md` §Review de pull request entra aqui). As formas só aparecem com uma passada estruturada, que ainda não existe.
6. **O cartão e Approve the rest.** O **DecisionCard** e o **Finding** na conversa da PR da task, as teclas, `Alt+↓`/`Alt+↑`, a chegada no apontamento, invisíveis sem uma passada estruturada; **Approve the rest** na barra de decisão das duas telas, que no review já aparece (`features.md` §O relatório e a decisão).
7. **A virada.** `startReview` e `askPass` criam a linha, e o prompt ganha as seções (`reviewSections`); `features.md` §Review de pull request, §Sessões e conversas, §Depende de mim, §Prompts e §Atalhos, `sessions.md` §Prompts, `overview.md` §O fluxo de uma task, `troubleshooting.md`.
8. **As cenas e o fim.** As fixtures e as cenas da §4.2 com as capturas, `where-actions-went.test.tsx`, o caso de 29 apontamentos, a conferência de `docs/` contra o que a task fez, e o ciclo real do pronto 9, numa cópia do diretório de dados.

Depois do step 8, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch, e a pull request só é dada como pronta com o CI verde.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md`:

- T16, confirmada pelo usuário (`decisions.md`, 2026-09-25, Plano confirmado);
- T27 e R19, decididas pelo coordenador por delegação em `decisions.md` (2026-09-29, "PR da task: o que a entrada da task 7 decidiu").

T27 é **Approve the rest**, pela evidência de que toda decisão real em texto aprovou tudo. R19 é a seção dos descartados na mensagem de **Apply approved**.

O resto também foi decidido por delegação, na mesma entrada:

- tudo descartado leva a `Ready to merge` sozinho, como no modo Apply;
- `Ready to apply` quando tudo está decidido;
- a compatibilidade pela linha em `pr_passes`;
- as mudanças antes do envio vão ao review;
- `Review changes` com `No file changed`;
- o relatório ilegível com a razão;
- decidir durante uma reescrita;
- o placeholder do `changes_review` da PR;
- o prompt padrão sem mudança.

Uma delas acrescenta ao laço da PR da task uma saída pela palavra do usuário, a passada toda descartada, que segue o precedente aprovado do modo Apply. Nenhuma apaga dado ou desdiz o aprovado.
