# Crítica da entrada da task 9 (releitura)

Segunda leitura de `design/tasks/09-discussion.md` (596 linhas, 11 steps) e das edições da discussão em `design/`, na worktree `design-inputs`. A leitura confronta a primeira crítica (L1–L12, a ressalva da prova e o pronto 5, substituída por esta) com o código da `main` em `2797eaa` e da task 4 em `c55a417`. `design/system/tokens.css` continua idêntico ao da `main`. Citações `09:N` são linhas do material.

**Veredito: Pronto para o card.**

## L1 e L2, relidas

| # | Situação |
|---|---|
| L1 O plano | Fechada. O step 6 tem o `⋯` sem o item de agrupar, com **Delete discussion…** desabilitado durante uma corrida (09:585). O step 7 só leva os marcos, a dobra (inclusive a derivada), o `MarkerContext` e a conversa arquivada, e o painel mínimo da task 8 continua (09:586). O step 8 traz juntos o cartão, a decisão com o avanço e a trava, **Retry**, o teclado, **Edit** com o `DependencyPicker`, **Existing issue…**, o diálogo de agrupar e o item do `⋯`; os cinco componentes antigos saem nesse mesmo step, que é revisado sozinho pelo crítico (09:587). A linha de risco da §6 diz o mesmo (09:554). Nenhum step fica sem **Edit**, sem agrupar ou com duas versões da mesma ação. O step 7 mostra `Drafts written` sem o cartão logo depois, porque o painel antigo continua acima da conversa. É uma transição da branch, sem ação perdida. |
| L2 A aprovação limpa pela leitura | Fechada. "Mudou" é a diferença campo a campo entre o guardado e o reconciliado, depois de `normalize` e da retirada de aprovação da task 8, com `cards` num épico (09:439). Nos três casos da task 8 que não substituem o rascunho, ele ganha `RevisedReading`, `Revised` e, se era aprovado, `ApprovalCleared`, e entra no `Drafts revised` com o campo e `· your approval was cleared` (09:152, 406). O pronto 4 os cobre (09:22). O marco já não pode dizer `not changed · approved` de quem perdeu a aprovação. |

## O resto, numa passada

- **L3.** As recusas de `Start` usam as frases de hoje, as mesmas da task 5 (09:111). `GroupIntoEpic` recusa com sentinels próprios, cada um com a sua frase (09:454), e as frases de hoje ficam com os sentinels de hoje. ` The discussion was undone.` entra no step 3 como P22c, com o teste dos dois casos (09:450, 582; `backend.md:81`).
- **L4.** A rodada de uma discussão anterior à task dobra num `Round N` derivado, antes do `Drafts written` da rodada seguinte, e o `Context` perde a parte do épico (09:157, 161).
- **L5.** **Delete discussion…** e o **Retry** do rascunho ficam desabilitados com a razão durante uma corrida (09:585, 587).
- **L6.** A 9 corre em paralelo com a 10, e quem entrar depois renumera a migration e faz o rebase. `implementation.md` diz o mesmo nas linhas 13, 147 e 159.
- **L7.** `components.md` não diz mais `Couldn't write to GitHub:` antes da razão, e `discussion.md` §16 deixou de ter a regra antiga da rodada. As mudanças que faltavam entraram em `changes.md` como D20, D21 e D22.
- **L8 a L12.** Fechadas. `Linked` fica no tooltip do link.
- **A ressalva da prova.** Virou D21: o prompt passa a pedir que o agente mantenha o id de um rascunho que muda, no step 1, com uma linha em `changes.md`.
- **O pronto 5.** Está com o rascunho que tem o foco, `web#2302`.

## Fora do escopo desta leitura

A linha 5 de `tasks/10-settings.md` ainda diz que a task corre "em paralelo com as tasks 6 a 9". Isso bate com a `implementation.md`, e o arquivo é da task 10.
