# Crítica do material de entrada da task 3 · Tela da task I (segunda leitura)

Segunda revisão de `design/tasks/03-task-header.md`, depois da correção commitada em `main` (`9566b85`), que levou as decisões a `screens/task.md`, `structure.md`, `components.md`, `changes.md`, `implementation.md`, `principles.md` e `screens/rest.md`. A régua é a mesma: `implementation.md:18`, toda decisão de design vem tomada. Conferido contra o código de `main` e contra a branch `shell-fixes` (PR #68, `7392046`), de que o material agora parte. `03:N` é a linha do material corrigido.

## Veredito

**Corrigir antes.** Faltam três edições de uma linha cada, R1 a R3. As decisões estão escritas abaixo, e nenhuma pede rodada de design nem nova leitura. Das 27 lacunas da primeira leitura, as 27 estão resolvidas. O que resta ao usuário é uma pergunta de produto legítima, **Follow the task** (§9 do material), que o PRD faz.

## 1. A primeira leitura, item a item

| Item | Situação | Onde está resolvido |
|---|---|---|
| 0 Base e `shell-fixes` | Resolvido | `03:5`: parte de `main` depois da PR #68. Conferido na branch: `FLASH_MS` é `2 × DURATION_SLOW_MS` (`lib/situations.ts`), o tooltip do grupo de painéis é o nome com a descrição (`AuxPanel.tsx:28`), e `features/sidebar/sessions.ts` existe |
| G1 Ações sem lugar | Resolvido | **Close task** e `Couldn't confirm the merge` em `pr_trouble` (`03:244`); **Discard draft** no `⋯` antes da abertura (`03:177`) e repetido na barra `draft` (`03:239`); **Open PR** do `DraftCard` em `awaiting_reply` e **Approve draft** na barra `reply` da task 4 (`03:80`, `implementation.md:82`) |
| G2 A barra de `merge` | Resolvido | `03:241–247`, pela forma e pelo `pr.status`; a árvore em `structure.md:117` e `03:253` |
| G3 Primárias repetidas | Resolvido | `03:251`; o pronto 11 confere que nenhuma primária se repete (`03:29`) |
| G4 Mudanças sem `changes.md` | Resolvido | **Review again** por `canReviewAgain`, também durante uma passada (`03:181`, `changes.md:28`); descartar uma etapa anterior continua no `⋯` (`03:186–187`); a task pausada mantém a barra (`03:249`, decisão 23); o step atual com os relatórios (`03:208`, `task.md:258`). **Follow the task** em T5, marcado para o usuário |
| M1 Tooltip do grupo | Resolvido | Na PR #68 (`AuxPanel.tsx:28`); `03:168` |
| M2 A pílula ociosa | Resolvido | `03:130, 136, 143` |
| M3 O `K` do PR review | Resolvido | `03:158` |
| M4 A conversa anterior | Resolvido | `03:217, 221–223`: o lugar da One-Shot, o agora pelo lugar, o carregando e o foco |
| M5 O `Card` | Resolvido | `03:230`; a task 5 em `implementation.md:94` |
| M6 O medidor pausado | Resolvido | `03:166` |
| M7 A idade | Resolvido | `03:269`; os dois leitores de `relativeTime` no step 4 |
| M8 Os estados dos checks | Resolvido | `03:257–263` |
| B1 a B8 | Resolvidos | Os popovers (`03:194`), `Saving…` (`components.md:268`), `--size-popover` (`components.md:869`), o estado da pílula por linha (`03:132–156`), `Resume` sem hora (`03:164`), `Details` e `Artifacts` nas bordas (`03:210–213, 228`), a folga das ferramentas abaixo de 900 px (`03:124`), o nome da atual (`task.md:44`, `structure.md:223`, `principles.md:101`), as divergências do mock (decisão 22) |
| Plano | Resolvido | 13 steps; o step 7 dividido; os popovers sem ligação no step 6; as linhas de conversa só no step 12; `storage.md` no step de cada coluna |
| Pronto 3, 4 e 11 | Resolvidos | Os testes pintados de larguras e de cenas (`03:21–22`); o pronto 11 sem a contradição |
| Coerência de `design/` | Resolvida | `changes.md:28` sem reticências, `components.md:448` e `structure.md:229` com "situação", `components.md:531` com **Open in Details**, `implementation.md:94` sem criar a lista de relações |

## 2. O que resta

**R1. O **Continue** na task pausada nunca aparece.** A decisão 23 (`03:9, 249`; `structure.md:285`) promete que a task pausada mantém na barra "aprovar, continuar, abrir a PR, encerrar", com a barra derivada de `task.canContinue`. Só que `canContinue` exige a sessão em repouso (`internal/bindings/convert.go:235`, `summary.Idle`), e em repouso quer dizer sem pausa (`internal/session/state.go:145–147`). Então a barra `ready_to_continue` pausada nunca nasce, e o teste de risco de `03:391` ("cada situação e o estado pausado que a daria") não tem o caso. Hoje também não se continua pausado: **Continue to …** fica desabilitado com `Wait for the agent to finish…` (`StageTrack.tsx:140–149`). *Decisão:* a task pausada mantém na barra aprovar, abrir a PR e encerrar; continuar espera o **Resume**, como hoje. Tirar "continuar" de `03:9, 249` e de `structure.md:285`.

**R2. Um item desabilitado sem razão.** **Review again** fica desabilitado quando `canReviewAgain` é falso (`03:181`), e a lista de razões cobre `waiting_checks`, `committing`, `pr_closed` e `closing`. Com a PR aberta, `canReviewAgain` também é falso em `blocked`, quando uma leitura do GitHub falha depois da abertura (`features.md:472`), e o item ficaria desabilitado sem razão, contra `components.md:223`. *Decisão:* `· the pull request stage is blocked` em `blocked`, na tabela de `03:181` e em `task.md:291`.

**R3. Uma nota velha e um texto de `rest.md` fora da decisão.** `03:307` ainda diz que `screens/rest.md:501` contradiz a decisão 23 e que o material não pode editá-lo, e `rest.md` já foi editado. Mas o texto de `rest.md:500` diz que a barra da task pausada "existe só quando uma situação espera pelo usuário", e uma sessão pausada não tem situação (`internal/attention/derive.go:47–50`). *Decisão:* `rest.md:500` passa a "a barra do pedido existe só quando o estado do step, da PR ou da etapa pede uma ação, quieta e sem chip", como em `task.md:193`, e a nota de `03:307` sai.

## 3. A pergunta ao usuário

**Follow the task** (`03:440–444`; `changes.md` T5; `backend.md` P44) é uma mudança de comportamento: hoje o modo de review próprio de um step não se desfaz. É de produto, está marcada em `changes.md`, e o material dá a recomendação e o que acontece sem ela, que é o `listbox` só com `Agent` e `Manual` e P44 fora da task. Está no lugar certo para o PRD perguntar e não impede o card.

## 4. Contraste

Nenhum par de cor mudou desde a primeira leitura. A tabela de contraste daquela leitura continua valendo, e todos os pares passam nos dois temas.
