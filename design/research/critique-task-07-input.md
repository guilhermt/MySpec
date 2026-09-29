# Crítica da entrada da task 7 (releitura)

Segunda leitura de `design/tasks/07-task-findings.md` (544 linhas, 8 steps) e das edições não commitadas em `design/`, contra a primeira crítica (L1–L19, substituída por esta) e o código da task 4 em `c55a417`. `design/system/tokens.css` continua idêntico ao da `main`. Citações `07:N` são linhas do material.

**Veredito: Corrigir antes. Depois das duas edições abaixo, fica pronto para o card, sem nova leitura.** Das 19 lacunas, 18 estão fechadas, e L4 fechou por outra decisão. O que resta nasce dessa decisão, o `done` derivado, e é localizado: a decisão existe, falta escrever onde o código de hoje a contradiz.

## As 19, item a item

| # | Situação |
|---|---|
| L1 A passada corrente no frontend | Fechada: `PullRequest.currentPass`, `PRReport.recorded`, uma entrada por linha, o `clean` da linha (07:384–385); a regra do cartão por `currentPass` (07:212) |
| L2 Os descartados | Fechada: `## Discarded findings` em `ApplyMessage` nas duas telas (07:98–119), `changes.md` R19, pronto 9 sem repetir o descartado |
| L3 A situação durante a reescrita | Fechada: sem situação nem barra com o revisor trabalhando (07:139, 167); os textos por forma (07:171–176), com as duas linhas novas em `rest.md` §11 |
| L4 Finish review contra o modo Apply | Fechada por outra decisão: tudo descartado leva a `Ready to merge` sozinho, pelo `done` derivado, como o Apply (07:142, 158). A decisão está registrada em `decisions.md` e em T16, e a saída nova do laço está dita |
| L5 A worktree antes do envio | Fechada: as mudanças vão ao review, e `ApprovePR` recusa antes do envio (07:150) |
| L6 O `You decided` de um envio que falha | Fechada (07:157) |
| L7 O step 1 com comportamento | Fechada: o step 1 declara R19, e o pronto 5 cita os casos de `apply_test.go` (07:23, 488) |
| L8 As fronteiras com a task 6 | Fechada: `tasks/06-review.md` emendado (`prreview.Reason` com R20, sem `findings_sent`, `lib/findings.ts`) |
| L9 O placeholder de `changes_review` | Fechada: `Ask the reviewer for a change…` registrado em T16 e em `task.md` §8 |
| L10 A reescrita ilegível só em `decide` | Fechada (07:155, 199–201) |
| L11 `AskPRPass` idempotente | Fechada (07:123, 377) |
| L12 As fixtures | Fechada: o 5º apontamento, as horas coerentes com `SCENE_NOW`, o histórico de `findings-unreadable`, a divergência do mock em #22 |
| L13 O tooltip de **Review again** | Fechada (07:160) |
| L14 As setas na entrada do cartão | Fechada (07:258–259; `components.md`) |
| L15 A prova de `No file changed` | Fechada (07:21, 25) |
| L16 A prova do formato | Fechada: os 13 relatórios do centro de review, e a passada estruturada que nunca volta ao texto (07:128, 163, 450, 478) |
| L17 A documentação cedo demais | Fechada: vai ao step 7 |
| L18 O banco do usuário | Fechada: `XDG_DATA_HOME` numa cópia (07:27) |
| L19 Os três textos | Fechada: `implementation.md` com oito, a variante **De decisão** reescrita, `useTaskComposer.ts:28` |

## O que resta

**R1. O `done` derivado passa por três lugares que o material não cita.** Com tudo descartado, `pr_runs.status` continua `reviewing` (07:132), e o `done` é derivado em `reviewingStatus` (07:142). O material lista onde esse `done` deve valer como o gravado (`PollPRs`, `checkPR`, `canClose`, o encerramento, com `awaitingMerge`: 07:158, 378). Faltam três lugares, e o código de hoje os leva para o lado errado:

- **O estado depois da leitura.** A leitura grava o merge, o fechamento ou o `trouble` na corrida, mas quem transforma isso em `PRMerged`, `PRClosedUnmerged` e `PRTrouble` é o ramo `case task.PRDone` de `prStatus` (`pr.go:213–224`). Pelo ramo `task.PRReviewing`, o `done` derivado continuaria `done` depois do merge, e **Close task** nunca habilitaria.
- **A sessão aberta no merge.** Hoje, quando a PR é mergeada, a sessão do review já foi fechada por `finishReview`. No `done` derivado ela continua aberta, e o material não diz quem a fecha.
- **O lugar no frontend.** `prPlaceOf` (`place.ts:178–187`) dá a todo `done` a conversa somente leitura, sem compositor (`closedReview`). Isso contradiz "a conversa continua aberta com o cartão" (`task.md` §9), o placeholder do compositor com tudo descartado (07:245) e **Send** como primária na cena `findings-discarded` (07:270).

Há também uma lacuna de estado: no `pr_trouble` que nasce do `done` derivado, o cartão some. O `trouble` não está na lista de 07:212 nem nas recusas de 07:156, o que desdiz "reversível até o merge" (07:313; `decisions.md`).

*Decisão proposta, em 07:158 e em §4.4 `flow`/Frontend:*
- `reviewingStatus` aplica ao `done` derivado a mesma leitura do ramo `PRDone` (`pr.go:213–224`): mergeada dá `PRMerged`, fechada dá `PRClosedUnmerged`, e com `run.Trouble` dá `PRTrouble`.
- Quando a leitura acha a PR mergeada ou fechada, `flow` grava `done` e fecha a sessão do review, como `finishReview`, e a partir daí tudo segue o caminho de hoje.
- No frontend, `prPlaceOf` dá `conversation`, com o compositor, ao `done` e ao `trouble` derivados: a passada corrente gravada, não enviada e toda descartada, com `status` `done` ou `trouble`.
- No `trouble` derivado, o cartão fica, e decidir é permitido. Isso entra na lista de 07:212 e nas recusas de 07:156.

Os testes de tabela do pronto 4 ganham o merge, o fechamento e o `trouble` a partir do `done` derivado.

**R2. O foco depois de Approve the rest no review.** Na task, terminado o gesto, o foco vai a **Apply approved** (07:204). No review, o material diz só que é "a mesma ação" (§3, item 4), e no modo Publish a primária seguinte é **Publish review…**. *Decisão proposta, uma linha em 07:204 e em `review.md` §10:* no review, o foco vai à primária que a barra passa a ter, **Publish review…** ou **Apply approved**.

## As decisões novas por delegação

- **O `done` derivado.** É coerente com o precedente aprovado do modo Apply (`reviewflow/state.go`, `applyStatus`; `features.md` §Corrigir a própria pull request), e a entrada de `decisions.md` agora diz que o laço ganha uma saída. É a decisão mais pesada da task, mas segue o fluxo que o usuário já aprovou; só precisa de R1 para ser implementável sem adivinhar.
- **Approve the rest nas duas telas, sem tecla e sem Discard the rest.** É fundamentado pelos dados de §5.4 e registrado em T27. No modo Publish, aprovar sem ler vira comentário na PR de outra pessoa, mas o diálogo de publicação, que mostra o que vai, fica no caminho; isso é aceitável.

## O que fazer

Escrever R1 e R2 no material, e R2 também em `review.md` §10. Depois disso, a entrada está **pronta para o card**, sem nova leitura.
