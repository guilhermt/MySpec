# Crítica do material de entrada da task 4 · Tela da task II (segunda leitura)

Segunda revisão de `design/tasks/04-task-conversation.md` (508 linhas), depois das correções não commitadas em `design/`: `backend.md`, `changes.md`, `decisions.md`, `implementation.md`, `principles.md`, `screens/task.md`, `structure.md` e `system/components.md`. A régua é `implementation.md:18`, e o código é o da PR #69 (`a84c005`). `04:N` é a linha do material corrigido.

## Veredito

**Pronto para o card depois de duas edições de uma linha em `structure.md` (R1 e R2), sem nova leitura.**

- Das 30 lacunas da primeira leitura, as 30 estão resolvidas.
- Das 14 incoerências entre os documentos, 13 estão resolvidas; a que resta é R1.
- Os ajustes do plano, do pronto e do inventário estão feitos.
- A §9 ficou vazia com razão: M3 e T26 estão em `decisions.md` (2026-09-28), por delegação do usuário, e T24 decorre da regra dos diálogos destrutivos.

## 1. A primeira leitura, item a item

| Item | Situação | Onde está resolvido |
|---|---|---|
| L1 O **Retry** de um turno que falhou | Resolvido | `04:274–275` separam `lastError` de `turn_error`: o segundo fica sem ação, com o foco e o placeholder no compositor (`04:305`) |
| L2 A passada depois do **Retry** | Resolvido | Pronto 11 (`04:29`) e `04:274`: a situação passa a `reply`, como o fluxo faz (`step_review.go:108, 152–157`) |
| L3 A primária | Resolvido | `04:296`, `principles.md` 2; pronto 9 (`04:27`). O **Resume** do cabeçalho é fantasma, como na PR #69 (`components/PauseButton.tsx:46`) |
| L4 A cauda de 13 a 16 linhas | Resolvido | `04:209`, `04:378`; `components.md:576` e `task.md:145` passam a `24 more lines above` · `Show all 36 lines` |
| L5 As ferramentas e o subagente | Resolvido | `04:209`, `04:212`, `04:378`; `backend.md` M3; `changes.md` T9 |
| L6 A alternativa barata de M3 | Resolvido | Descartada em `decisions.md` (2026-09-28). O número a favor dela está corrigido: 42% das saídas passam de 40 linhas (`04:454`) |
| L7 O foco depois de uma ação | Resolvido | `04:288`, `structure.md:35`, pronto 14 |
| L8 Várias perguntas (T26) | Resolvido | `04:220`, `04:306` |
| L9 O cartão de arquivos em `review_failed` | Resolvido | `04:254` com o erro inteiro; `04:277` sem o meio |
| L10 e L11 A permissão cancelada, enviando e com falha | Resolvidos | `04:222` |
| L12 O trecho que deixa de ser o último | Resolvido | `04:214` |
| L13 A PR que sai antes da passada 1 | Resolvido | `04:247` |
| L14 As teclas com várias perguntas e os campos do rascunho | Resolvidos | `04:263–264` |
| L15 `checking GitHub` e `Shimmer` | Resolvidos | `04:241`, `04:428`; step 6 |
| L16 O nome do stepper | Resolvido | `04:292`, `04:430` |
| L17 a L29 | Resolvidos | `04:294` (o **Send** vazio), `04:225`, `04:212`, `04:181`, `04:235–239`, `04:254`, `04:238`, `04:286`, `04:290`, `04:227`, `04:284`, `04:373` (#31) e `04:199–201` |
| L30 O `Esc` no compositor (era opinião) | Adotado | `04:265`, `04:294`; `changes.md` T22 |
| Mudanças sem `changes.md` | Resolvidas | T9 (a fala do subagente), T12 (o `Not sent` no compositor), T22 (o `Esc`) |
| As 14 incoerências | 13 resolvidas | `task.md:433` e `task.md:351`, `structure.md:269`, `:35` e `:381`, `components.md:496`, `:576`, `:579`, `:644` e `:164`, `backend.md` P6, P10 e P38, `implementation.md:31`, `:84`, `:88` e `:191`, e o `--fade`. Resta R1 |
| O plano | Resolvido | 14 steps no teto de G. As situações novas ficam fora de `taskRequestOf` até o step 7 (`04:382`, `04:494–495`). O corte para a task 4b bate com `implementation.md:191`. A medição virou um script (`04:335`) |
| O pronto | Resolvido | Relógio fixo e dados coerentes (1 e 3), a busca fora de `pre` e `code` (2), a lista completa (9), o 11 reescrito, o 13 como script, e o 14 novo para o que as cenas não tocam |
| O inventário | Resolvido | 15 arquivos de teste (`04:411`), `discussion/ArchivedDiscussionView.tsx` (`04:434`), `StreamEvent` com as linhas certas de `AssistantEvent` e `UserEvent` (`04:377`), `Starting step 5…` e `Preparing the worktree…` (`04:235–236`), "destes cinco lugares" (`04:102`) |

## 2. O que resta: duas edições de uma linha

**R1. `structure.md:208` ainda diz que o compositor existe "enquanto a conversa na tela existe".** A mesma seção já foi corrigida em `:295`, assim como `task.md:221` e `components.md:496`. *Edição:* "o compositor, enquanto a conversa na tela tem uma sessão aberta".

**R2. `structure.md:35` deixa `findings` fora da lista do compositor.** A lista das situações cujo foco vai ao compositor é "(`reply`, um plano inválido, um turno que falhou)". Falta `findings` em texto, que `04:280` manda ao compositor até a task 7. *Edição:* acrescentar "os apontamentos da PR da task em texto, até a task 7" à lista.
