# Crítica da task 3 · Tela da task I (PR #69), segunda leitura

Reconferência da branch `50-redesign-3-task-screen-i-header-stepper-tabs-panels-and-menu` em `980949a`, depois dos commits `f11f22b` e `980949a`, que tratam os seis bloqueios da primeira leitura (`a84c005`). A régua é a mesma: `design/tasks/03-task-header.md`, `screens/task.md`, `system/components.md` e os mocks de `lab/10-screen-task-minimal/`. Os caminhos de código são relativos a `frontend/src/`.

## Veredito

**Corrigir antes do merge.** Os seis bloqueios estão corrigidos, e cada prova pintada nova falha contra o código anterior. Só que a correção do `⋯` criou uma regressão numa tela já decidida: o menu do filtro de repositórios da lateral ficou mais estreito que o gatilho. A correção é de uma linha.

## Como foi conferido

- **Suítes**, todas verdes pelos comandos do `Taskfile.yml`, e o CI da PR também:

  | Suíte | Resultado |
  |---|---|
  | `task test:go` | 2.511 testes; o único pulado é de `internal/platform/dnd` |
  | `task typecheck` | verde |
  | `task lint:web` | verde |
  | `pnpm test:coverage` | 3.137 testes |
  | `pnpm test:painted` | 546 testes |
- **Mutação.** Voltei cada correção ao código de `a84c005` numa cópia no scratchpad e rodei `TaskView.scenes.painted` e `Pill.painted`. As quatro provas novas falharam, duas cada (claro e escuro):

  | Correção desfeita | Onde |
  |---|---|
  | O recuo da barra | `TaskRequest.tsx:108` |
  | O recuo da faixa da conversa anterior | `EarlierConversationFoot.tsx:33` |
  | As paradas do glifo de pausa | `StateGlyph.tsx:30` |
  | O `w-max` do menu | `Menu.tsx:37` |
- **Regressão.** Medi no Chromium os menus que usam `MenuContent`, antes e depois de `w-max`: o `Select` da lateral, o `+ New` a 400 px de janela junto da borda direita, e o breadcrumb, `ModelChip` e `StepModeChip` pelo código. `Listbox` não usa `MenuContent` e não muda. O recuo novo da barra está em `TaskRequest.tsx` e em `EarlierConversationFoot.tsx`, que só a tela da task usa; o `RequestBar` do system não mudou, e as outras telas não são tocadas.
- **`Details`**, pela captura das cenas `checks` e `run` a 1250 px de janela, no tema escuro.
- **Capturas**, pela branch `captures/50-redesign-3-task-screen-i-header-stepper-tabs-panels-and-menu` (`15ca754`, 46 imagens) e pelo corpo da PR (`gh pr view 69 --json body`).

## Os seis bloqueios da primeira leitura

| # | Bloqueio | Situação | Evidência |
|---|---|---|---|
| 1 | Capturas e relógio das cenas | Corrigido | O corpo da PR tem a tabela das nove cenas e das catorze larguras, nos dois temas, a partir da branch de capturas.<br>`fixSceneClock` fixa o relógio em `SCENE_NOW` (`test/task-scenes.ts`): o chip diz `4m`, `Checked` diz `3m ago`, os checks duram `2m 0s`.<br>As fixtures agora têm os modelos de cada momento, a worktree, as conversas, o card na última leitura do board e `checkedAt` |
| 2 | A barra e a faixa na coluna | Corrigido | `px-(--space-6)` nos dois invólucros.<br>`TaskView.scenes.painted.test.tsx` mede 24 px de cada lado a 950 px de área |
| 3 | O glifo de pausa `sm` | Corrigido | As paradas contra `100%`.<br>`Pill.painted.test.tsx` lê as duas barras numa captura (`inkRuns`) e espera `[3, 3]` |
| 4 | O `⋯` sem quebrar itens | Corrigido | `w-max max-w-(--available-width)`.<br>A prova confere que cada item tem `--size-control` de altura e cada legenda uma linha.<br>Ver a regressão abaixo |
| 5 | Código morto | Corrigido | `canApprovePR`, `approvePRHint`, `conversationDisplay`, `stepBarDisplay`, `stepStateLabel` e `stepOrReviewerSituation` saíram com os testes.<br>`git grep` não acha nenhum |
| 6 | A grade de fatos de `Details` | Corrigido | `items-baseline` e `var(--col-keys)` (`DetailsPanel.tsx:437`).<br>Na captura, `Checks` fica na altura do resumo `3 of 5 passed · 2 not finished`, e cada chave na linha de base do seu valor.<br>Sem prova pintada, como o pedido previa |

Entraram também as notas 8 (as reticências de `Shimmer.tsx:9` e `Shimmer.test.tsx`), 15 (`features.md:361` e `:454` com **Discard step N…** e **Try again**) e 16 (`Link.tsx:23` com `--space-0-5`).

## Bloqueia o merge

1. **O menu do filtro de repositórios ficou mais estreito que o gatilho.**
   - O primitivo gerado dava ao menu a largura do gatilho (`w-(--anchor-width)`, `components/ui/dropdown-menu.tsx:41`). `w-max`, em `components/system/Menu.tsx:37`, a substitui pela largura do conteúdo, com o mínimo de `--size-menu-min`.
   - No `Select` da lateral (`features/sidebar/SidebarFilter.tsx`, o único leitor de `Select`), com a lateral de 300 px, o gatilho tem 284 px. O menu passou de 284 px para 224 px e fica pendurado sob a metade esquerda do campo.
   - É a tela da task 2, já decidida; o mock (`lab/08-visual-final/index.html:1040`) usa um `select` nativo, cujo menu tem a largura do campo.
   - O mínimo precisa ser o maior entre `--size-menu-min` e a largura do gatilho: `min-w-[max(var(--size-menu-min),var(--anchor-width))]`, em `MenuContent`.
   - Provar num teste pintado de `Select` que o menu tem ao menos a largura do gatilho.
   - O `+ New`, o breadcrumb e os chips ganham com a mudança: a 400 px de janela, junto da borda, o `+ New` cabe na tela e nenhum item quebra. Antes, um item quebrava em duas linhas.

## Pode esperar a task 4

2. **Duas primárias na tela.** **Send** fica sempre primário em `features/chat/Composer.tsx:111, 116`, e a task pausada põe um **Resume** primário em `Composer.tsx:42`. Com a barra, a tela tem duas primárias. O compositor é da task 4; registrar no card dela.
3. **Os nomes acessíveis redundantes das situações sem barra** (`features/task/stepper.ts:227–231`), como `error: step 5 blocked in Step 5`. Seguem a §4.2; por opinião, a task 4 tira o lugar quando o rótulo já o diz.

## Notas

4. **As capturas não estão lado a lado com o mock.** O pronto 4 (`03:22`) pede as capturas ao lado do mock. A tabela do corpo tem as colunas claro e escuro e aponta `b.html?scene=<name>` numa frase, sem a imagem do mock. A conferência a 1250 px de janela na máquina alvo (pronto 3) é do usuário.
5. **Os nomes dos checks cortam em `Details` a 1250 px de janela** (`e2e / rate…`, `components/system/ChecksList.tsx:93`). O corte segue a regra do system, com o nome inteiro no tooltip; registrar para quando a coluna do estado ganhar folga.
6. **Continuam da primeira leitura, sem mudança:**
   - o status congelado de `request.ts:189, 344`;
   - a fixture de `where-actions-went.test.tsx:115–125`;
   - o nome acessível de **Resume** (`PauseButton.tsx:52`), uma divergência do material consigo mesmo;
   - `step_review` na aba do implementador (`agent-tabs.ts:108`);
   - a escolha própria no popover Models (`ModelsPopover.tsx:129`).

**Corrigir antes do merge.**
