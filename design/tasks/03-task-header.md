# Task 3 · Tela da task I: cabeçalho, stepper, abas, painéis e menu

Material de entrada da terceira task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 3 de `design/implementation.md` (§2, linhas 67–77), com os princípios da §1 (linhas 9–22) e os riscos da §3 (linhas 185–197). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** A task parte da `main` depois do merge da PR #68 (branch `shell-fixes`), que corrige as 17 divergências de `design/research/critique-task-02.md`; nenhuma sobra da task 2 entra aqui. As linhas citadas são as dessa base. As duas se tocam nestes arquivos, e as linhas deles são as da PR #68: `features/task/TaskHeader.tsx` (a lixeira já é `IconButton`), `components/system/AuxPanel.tsx` (o tooltip do grupo de painéis já é o nome com a descrição, `:28`), `components/system/PlaceHeader.tsx` (o nível que não é lugar já é texto no menu), `features/sidebar/sidebar-tree.ts` (`PR review · checking GitHub` antes da primeira leitura já existe, `:532–545`), `features/sidebar/sessions.ts` (antes `lib/sessions.ts`), `lib/situations.ts` (`FLASH_MS` já é `2 × --duration-slow`, `:22`; `announcement`, `:228–234`), `store/app-store.ts`, `styles/globals.css`, e as linhas com a classe `.tree-flash` em `features/sidebar/TreeRow.tsx:110`, `SidebarRail.tsx:142` e `TreeNodeRow.tsx:201`. Os outros arquivos têm as linhas de `d04cb42`.

Toda decisão de design está tomada neste documento, em `design/screens/task.md`, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; o único ponto de produto em aberto está na §9, com a recomendação.

**Nenhum comportamento de hoje se perde.** Onde o desenho novo não tinha lugar para uma ação ou uma informação que o app oferece hoje, o desenho se acomoda: **Review again** vale a qualquer momento em que o produto aceita uma passada; descartar uma etapa de planejamento anterior continua a um item do `⋯`; o step atual mostra os seus relatórios em `Details`; a task pausada continua mostrando o que pode ser aprovado, aberto ou encerrado, e continuar uma etapa revisitada espera o **Resume**, como hoje; **Close task**, **Discard draft** e **Open PR** têm lugar em todo estado em que o backend os permite. As mudanças de comportamento são as de `changes.md`.

**Vocabulário.** "Barra" é a barra do pedido (`components/system/RequestBar.tsx`). "Situação" é o DTO `Situation` (`internal/bindings/dto.go:349–370`). "Conversa na tela" é a da aba escolhida num step com as duas, ou a do lugar da task. "Conversa anterior" é uma conversa que não é a do lugar atual, lida de `Details`; no store é `earlierConversation`, porque `back` e `forward` já são a pilha de lugares e `history` é o lugar History. "Qualificador" é o que vem depois da posição na pílula (`· pass 2`, `· round 1`, `· Manual`, `· committing`, `· preparing`, `· revisiting`).

## 1. Objetivo e critério de pronto

O topo da task vira uma faixa só: `←`, `→`, o breadcrumb, o título, o **stepper** com a pílula da etapa atual, o medidor de contexto, **Pause** ou **Resume**, o grupo de painéis **Details**, **Artifacts** e **Card**, e o `⋯`. A trilha de chips, a barra do step, a barra da PR, o badge de estado, os botões `Review: <modo>` e **Models**, o link do card e a lixeira saem do topo. Implementador e revisor viram duas abas mínimas acima da conversa. `Details` passa a guardar os steps com os seletores e os relatórios, as conversas anteriores (abertas no lugar da atual, somente leitura), a PR com os checks pelo nome e os fatos da task; `Artifacts` fica só com os documentos; `Card` mostra o card. As ações que resolviam uma situação e moravam nas barras que saem passam à barra do pedido. A conversa, o compositor e as outras situações ficam com a forma de hoje até a task 4.

**Pronto quando** (`implementation.md:77`), cada item provado como diz:

1. **Stepper.** `features/task/stepper.ts` testado em tabela, sem renderizar: uma linha por momento da tabela da pílula (§4.2), com o nome, a posição, o qualificador, o glifo, a palavra, o estado do nome acessível e o tooltip exatos, nos dois modos de task, pausada e com a sessão parada sozinha. `components/system/Stepper.test.tsx` e `Pill.test.tsx` cobrem os estados de `components.md` (Stepper e pílula): hover num ponto dobrado, foco (uma parada de Tab, `aria-current="step"`), sem ação no clique, pausada, carregando, erro.
2. **A situação dita uma vez.** Com uma situação na task, a pílula mostra só o glifo e a posição, e a palavra está no nome acessível (teste por `getByRole("list", { name })`); sem situação, a palavra está à vista.
3. **Largura.** Testes do CSS provam cada limite da tabela da §4.2 como container query `width < N` em `main`. Um teste pintado (`TaskView.widths.painted.test.tsx`, Chromium) monta `TaskView` com as fixtures de uma task em implementação com o laço e de uma no PR review, a 812, 950, 996, 1134, 1566 e 2180 px de área principal (as áreas das janelas de 1100, 1250, 1300, 1450, 1920 e 2560 px com a lateral em `clamp`), claro e escuro; ele confere que nada quebra linha, nada se sobrepõe, o título corta por último com o nome no tooltip e tem ao menos 200 px, e que a 950 e a 996 px o stepper mostra `✓ ✓ ✓ [Implementation 3/7 ◌] ○ PR ○ PR review ○ Closing` (`task.md:58`); e grava as capturas, anexadas ao pull request. Na máquina alvo, uma conferência a 1250 px de janela.
4. **As nove cenas.** Um teste renderiza o topo de cada cena de `lab/10-screen-task-minimal/b.html` (`?scene=plan … close`, `b.html:2150–2185`) a partir de fixtures de `test/wails-mock.ts` e confere o stepper, as abas, a pílula e a barra quando a task 3 a mostra; um teste pintado das mesmas nove, claro e escuro, a 1566 px de área principal, grava as capturas que vão ao pull request lado a lado com o mock.
5. **`⋯`.** `features/task/task-menu.ts` testado em tabela: os grupos e os itens de cada etapa e estado da §4.2, com o desabilitado e a razão; cada item destrutivo abre o diálogo que diz o que se perde (`Discard step N…`, `Back to …`, `Discard and restart …`, `Delete task…`), provado por teste de componente. `stage-actions.ts` fica só com os textos dos diálogos, que a task 11 reescreve.
6. **Popovers.** Review mode e Models abrem do `⋯` e de `Details`, com os estados de `components.md` (padrão, hover, foco, escolhida, desabilitado com a razão, salvando, erro ao salvar, iniciada, indisponível, catálogo nunca lido); ao abrir, o foco vai à opção escolhida ou ao primeiro chip editável; `Esc` fecha o `listbox`, depois o popover, e o foco volta ao gatilho (o `⋯` quando aberto dele); as notas seguem as fórmulas da §4.2.
7. **Abas.** `tablist` com uma parada de Tab, `←`/`→` trocam e abrem a conversa, `aria-selected` e `aria-controls`; a aba de fora diz `· waits` ou `· error` só quando espera ou falhou; a aba escolhida na primeira vez segue a regra da §4.2 e o produto nunca a troca sozinho depois; a aba da situação nova pisca 2 × `--duration-slow` no véu, nada com `prefers-reduced-motion`.
8. **Details.** Um teste por grupo (Steps ou Implementation, Planning, Pull request, Task) com cada campo da §4.2, nos dois modos de task, antes do plano (`Steps come from the plan.`) e numa One-Shot antes da implementação; os relatórios do step atual; os seletores de modo e de modelo de um step não iniciado; **Follow the task**; um relatório aberto no lugar com `← Details`.
9. **Conversa anterior.** Aberta de `Details`, ela toma o lugar da conversa atual com a faixa no lugar do compositor; ela nunca aceita mensagem (sem compositor, sem cartão respondível, sem **Retry**, sem **Remove**, provado por teste); a barra, as abas, a faixa de review e o medidor somem enquanto ela está aberta; `Esc` e **Back to …** voltam, com o foco onde a §4.2 diz; com o painel cobrindo a conversa, abrir uma fecha o painel. Uma conversa de uma etapa ou de um step já encerrado abre, também depois de reiniciar o app (teste Go de `GetTranscript` de uma sessão fechada).
10. **Artifacts e Card.** `Artifacts` lista só os documentos escritos, abre cada um renderizado, e diz `No artifacts yet` sem nenhum; `Card` mostra o card da última leitura e, fora dela, a faixa que diz por quê; a task sem card não tem o botão **Card**.
11. **A barra na task 3.** As oito situações da §4.2 renderizam a barra com o rótulo, o lugar, o chip, o progresso e as ações exatas, também com a task pausada, testadas por `getByRole("region", { name: "Request" })`; nenhuma primária se repete na tela (as notas de `PRPane` e o `DraftCard` sem os botões da §4.2). Uma tabela no teste diz, para cada botão de `StepBar`, `PRBar` e `StageTrack` e cada estado em que ele aparece hoje, onde ele está agora; nenhuma linha fica sem lugar.
12. **Pause.** Sem diálogo; `Pausing…` com o spinner enquanto a chamada corre; desabilitado com a razão numa sessão com erro; **Resume** com `paused since <hora>` no tooltip e no nome acessível quando a hora é conhecida; age na conversa em que a task espera, também a da PR.
13. **Backend.** Testes Go de P4 (a hora da pausa gravada, limpa ao retomar e sobrevivendo ao reinício), P12 (a hora do commit do step, lida do git), P13 (os checks pelo nome com o estado e as horas, gravados a cada leitura) e de P42 a P45 (a conversa fechada legível, a lista de conversas da task, **Follow the task**, a worktree da task); `convert_test.go` com os campos novos.
14. **Atalhos.** `Ctrl+E` abre a worktree no VS Code na task que a tem, inerte com um diálogo modal e sem worktree; `Esc` segue a ordem `listbox`, popover, `⋯`, painel, conversa anterior (teste de atalho).
15. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
16. **Documentação** da §7 escrita no step de cada área.
17. **Revisão do `design-critic`** na branch contra este material, `screens/task.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).

`changes.md`: T1, T2 (as ferramentas do step no `⋯`; o cartão de arquivos é da task 4), T3, T4, T5, T6, T7, T17, X15 (a pausa sem diálogo; o marco `Paused by you` é da task 4). `backend.md`: P4, P12 (a hora do commit do step; quem fez o merge fica para as tasks 4 e 6), P13 (na task), P42, P43, P44, P45; F3, F5 (F5 só na posição da pílula; o marco `Started with` é da task 4).

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), tasks 3 a 6 (67–113), riscos (185–197) | O escopo, o app sempre usável (15), a revisão do crítico (21), os testes que migram com a tela (22); a fronteira com as tasks 4, 5 e 6 |
| 2 | `design/decisions.md`: Conversa em 960 px (5–7), Stepper e abas mínimas (33–35), A tela da task é mínima (37–39), Papéis do azul (45–47), Desvios absorvidos (53–55) | O que o usuário aprovou e não se reabre |
| 3 | `design/screens/task.md` §1–§5 (12–127), §7 (174–218, só as oito situações da §4.2), §10 (251–318), §11 (320–334), §12 (336–347), §13 (349–369), §14 (371–408), §15 (410–435) | O topo, a regra de largura com os números (44–58), a tabela da pílula (77–97) e os outros momentos (99), as abas, a barra pausada (193), os painéis, o `⋯`, os popovers, as cenas, os estados, os atalhos |
| 4 | `design/structure.md` §2 a linha 2 de `merge` (117); §3 cabeçalho (212–229), abas (231–233), conversas anteriores (244), barra (246–291, as exceções e a pausa em 283–285), painéis (303–330); §5 (343–381); §7 Pausado (417) | A regra geral que `task.md` detalha |
| 5 | `design/principles.md` 1, 2, 5, 8, 9, 10 (a cedência e a coluna, 101) | Cor é sinal; o azul na etapa atual e no painel aberto; glifo, cor e rótulo; 280 ms duas vezes; foco por fora; pixel inteiro |
| 6 | `design/system/components.md`: estados comuns (18–28), Ícones (78–87), Tooltip (99–108), Botão (151–164), Chip (166–177), Select, menu e listbox (203–215), Menu do item (217–226), Popover Review mode (262–269), Linha de modelo e popover Models (271–280), Seletor do step (282–287), Cabeçalho do lugar (291–300), Painel auxiliar (368–381), Faixa de aviso (408–417), Stepper e pílula (441–453), Abas de agente (455–465), Barra do pedido (467–480), Conversa anterior (503–508), Marco em linha (527–537), Medidor (592–600), Checks do GitHub (630–638), Lista de relações (736–740), Diálogo (752–764), Tamanhos de layout (845–869) | A anatomia, os estados, os tokens, o teclado e a acessibilidade de cada peça |
| 7 | `design/system/tokens.css`: medidas (55–57), tamanhos (71–75), medidor (82), painel (93), camadas (125) | `--size-head`, `--size-control-sm`, `--size-chip-sm`, `--size-tab`, `--size-ask`, `--measure-conversation`, `--panel-width`; a task acrescenta `--size-popover` |
| 8 | `design/changes.md` T1–T7 (26–32), T17 (42), X15 (126); `backend.md` P4 (30), P12 (43), P42–P45 (49–56), P13 (61), F3 e F5 (109–110); `screens/rest.md` §10 (457–504, a pausa em 496–504) | O que muda de comportamento e os dados |
| 9 | Mocks, com `python3 -m http.server 8090 -d design/lab`: `10-screen-task-minimal/b.html` — as cenas (`SCENES`, 2150–2185; `NOW`, 2234–2244; `TURN`, 2246–2250), o topo (`toolsM`/`headerM`, 2306–2316), o `⋯` (2323–2348), os popovers (2357–2376), os painéis (`PANEL_M`, 2385–2416), a faixa da conversa anterior (2466–2469), as abas (2496–2501), o stepper (2588–2600), o CSS do stepper e das abas (1361–1399), a cedência (1402–1417), os painéis (1090–1094, 1286–1302), os popovers (1327–1351), o menu (782–794, 1226–1229), a faixa (1273–1276), os checks (2112–2119); `components.html` — Stepper (2412–2425), abas (2429–2437), menu (2455–2458), linha de conversa em Details (2461–2466), faixa (2469–2471), popover Review mode (2476–2484), Models (2487–2489), seletor do step (2491–2496) | A referência visual. Onde o mock e este material divergem, vale o material (§4.3, 22) |
| 10 | `docs/product/features.md` §Voltar e descartar (354–363), §Modo de review (389–400), §Review (402–406), §Aprovação e commit (408–414), §Review pelo agente (416–438), §Descartar step (440–442), §Pull request (444–456), §Review de pull request (458–474), §Encerramento (476–486), §Sessões e conversas (643–657), §Modelos e esforço (679–686), §Cabeçalho do lugar (710–725), §Atalhos (727–742) | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 11 | `docs/guidelines/README.md`, `frontend.md`, `testing.md`; `docs/architecture/design-system.md` §Componentes | Como um step acontece, onde mora um componente, o teste por nome acessível e a suíte de estilo |
| 12 | O código da §5 | O inventário do que muda |

## 3. Escopo

**Dentro**, cada item verificável:

1. **P4, P12, P13, P42 a P45** no Go, nos DTOs, em `lib/wails.ts` e em `test/wails-mock.ts`.
2. **`components/system/`**: `Stepper` e `Pill`, `Popover` (o wrapper que faltava, com `--size-popover: 22rem` acrescentado a `design/system/tokens.css`), `Tabs` (a forma mínima da aba, que as abas da task arquivada usam na task 11), `ChecksList` (Checks do GitHub, a variante de painel), `RelationList` (Lista de relações, que a task 5 reusa), e os ícones novos no registro.
3. **O topo da task** (`features/task/TaskHeader.tsx` reescrito): o stepper com a cedência, `ContextMeter` no lugar de `ContextGauge`, **Pause**/**Resume** com os estados de `rest.md` §10, o grupo de painéis, o `⋯`. `LocationHeader` e `PlaceHeader` ganham o espaço do progresso depois do título.
4. **O `⋯`** (`features/task/TaskMenu.tsx`, `task-menu.ts`) com os diálogos de hoje e os popovers.
5. **Os popovers** Review mode e Models (`features/task/ReviewModePopover.tsx`, `ModelsPopover.tsx`), o chip de modelo e esforço (`features/models/ModelChip.tsx`) e o seletor de modo do step (`features/review-mode/StepModeChip.tsx`).
6. **As abas** (`features/task/AgentTabs.tsx`, `agent-tabs.ts`), com a piscada da árvore.
7. **Os painéis** `Details` (`DetailsPanel.tsx`, `details.ts`), `Artifacts` (`ArtifactsPanel.tsx`, no lugar de `ArtifactPanel.tsx`) e `Card` (`CardPanel.tsx`).
8. **A conversa anterior**: o lugar dela no store, a leitura de uma sessão fechada, a faixa (`features/task/EarlierConversationFoot.tsx`), `Conversation` somente leitura.
9. **A barra do pedido** para as oito situações da §4.2, também com a task pausada (`features/task/request.ts`, `TaskRequest.tsx`); as notas de `PRPane` sem botões e o **Open PR** de `DraftCard` só onde não há barra.
10. **A árvore**: a contagem dos checks (P13) na linha da task e `Ready to close` pela forma e pelo merge confirmado.
11. **`Ctrl+E`** e o `Esc` da conversa anterior.
12. **`lib/when.ts`**, as horas, as idades e as durações do app, no lugar de `relativeTime` (`lib/boards.ts:44`) e dos seus dois leitores (`features/board/BoardHeader.tsx:32`, `features/reviews/ReviewsHeader.tsx:24`).
13. **Saem** `StageTrack`, `StepBar`, `PRBar`, `StatusBadge`, `StepTabs`, `TaskModels`, `TaskReviewMode` e `ArtifactPanel`, com os testes; `CardLink` sai do topo da task (fica no review e nos arquivados); as regras `attention-flash` de `styles/globals.css` (287–296, 361–370 e a de movimento reduzido em 424–429), cujo último leitor é `StepTabs`.
14. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| A conversa (`features/chat`), o compositor, os cartões de pergunta e permissão, o bloco de erro com **Retry**, `StepBlocked`, `PRBlocked`, `PlanProblemsNotice`, `ImplementationDone`, `ClosedSummary` | 4 | Como estão, sob o topo novo, na coluna de 58.5rem de hoje (`Conversation.tsx:100`, `Composer.tsx:90`); o topo, as abas e a barra usam a coluna de `--measure-conversation`, 1,5rem mais larga, até a task 4 unificar |
| As notas de `PRPane` (`AwaitingMerge`, `Troubled`, `Merged`, `PRClosedUnmerged`) e o `DraftCard` | 4 | Com o texto e o link da PR, sem os botões que a barra e o `⋯` têm (§4.2, A barra na task 3); o `DraftCard` continua editável e mostra **Open PR** só com o rascunho à mão numa resposta que o agente espera (`awaiting_reply` com `draftAtHand`), onde não há barra `draft`. A task 4 dá a esse caso **Approve draft** na barra `reply` (`implementation.md:82`) |
| A barra das outras nove situações (`question`, `permission`, `reply`, `session_error`, `step_blocked`, `worktree_unreadable`, `pr_blocked`, `plan_invalid`, `findings`), **Show**, **Go to reviewer**, a barra que aponta a outra conversa, o foco na barra, a piscada e o anúncio da barra | 4 | Sem barra: cada uma continua dita e resolvida onde é hoje. A pílula já as trata pela regra da situação (§4.2) |
| `ReviewStrip` (a faixa de review com a lista de arquivos e o progresso de stage) | 4 | Continua na task, sob as abas; a barra repete o progresso em arquivos. `ReviewView` também a usa até a task 6 |
| Os marcos `Paused by you`, `Started with …`, `Committed …`, o vazio do PR review com os checks pelo nome (T15) | 4 | Nenhum; a hora da pausa aparece no tooltip de **Resume** e do stepper, a do commit em `Details` |
| O cartão de apontamentos da PR da task (T16, M1) | 7 | `findings` sem barra, decidido na conversa como hoje |
| Os diálogos de **Delete task**, **Discard step**, **Back to** e **Discard and restart** com a prévia nova (X13, X14) | 11 | Os de hoje (`DeleteTaskDialog`, `DiscardStepDialog`, `StageActionDialog`), sobre `components/ui/alert-dialog`; só o gatilho muda |
| A contagem dos checks na linha de um review (`Pass K · checks a/b`) | 6 (`implementation.md:106`) | `Pass K · waiting for checks` / `Pass K · checks`, como está |
| O progresso do épico no `Card` (`Epic · 2 of 8 finished`, F8); abrir no board um card relacionado que está nele | 5 (`implementation.md:94`) | O grupo diz `Epic`, sem o progresso; toda relação é link externo |
| `Details` do review e da discussão; o `⋯` deles; `ContextGauge` e o `PauseButton` de hoje no cabeçalho deles | 6, 9 | Como estão |
| `ModelPicker` e `ReviewModePicker` na criação de task, em Settings, no compositor e nos diálogos de review e discussão | 5, 10, 4, 6, 9 | Como estão; só a tela da task usa `ModelChip` e `StepModeChip` |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| A tela tem o progresso, a conversa do lugar atual e o compositor com a barra; o resto fica fechado nos painéis e no `⋯` | `task.md:12–20`; `decisions.md:39` |
| O cabeçalho: `←`, `→` com destino, breadcrumb, título em `--text-body` 600 sem glifo de tipo nem referência, stepper, e à direita medidor, **Pause**/**Resume**, grupo de painéis, `⋯` | `task.md:34–42`; `components.md:291–300` |
| A cedência em limites fixos da área principal, nunca pelo comprimento do texto; o nome da etapa atual nunca sai; o título cede por último; na metade do monitor o stepper nomeia a atual e as futuras | `task.md:44–58`; `decisions.md:35` |
| O stepper: lista ordenada sem trilha nem tempos; feita, futura e atual; a pílula com o nome, a posição, o divisor, o glifo e a palavra; sem ação; `aria-current="step"` | `task.md:60–109`; `components.md:441–453` |
| A situação é dita uma vez: com uma situação na task, a pílula mostra só o glifo e a posição | `task.md:75`; `structure.md:227–229` |
| As abas: só num step `Agent`, da primeira passada ao commit; texto com o glifo; a de fora com `waits` ou `error`; nunca trocam sozinhas; `tablist` | `task.md:111–127`; `components.md:455–465` |
| Painéis fechados por padrão, um de cada vez, `Esc` fecha; coluna a partir de 1120 px de área principal; o tooltip do botão com o nome e a descrição | `task.md:253`; `components.md:368–381`; a PR #68 (`AuxPanel.tsx:28`) |
| O conteúdo de `Details`, `Artifacts` e `Card`; a conversa anterior somente leitura com a faixa, sem barra, `Esc` volta, fecha o painel que cobre | `task.md:255–286`; `components.md:503–508` |
| O `⋯` agrupado por assunto, destrutivo por último em vermelho, cada destrutivo com o diálogo | `task.md:288–301`; `components.md:217–226` |
| Os popovers Review mode e Models, os mesmos do `⋯` e de `Details` | `task.md:303–318`; `components.md:262–280` |
| **Pause** sem diálogo, `Pausing…`, desabilitado com a razão num erro de sessão, a pílula neutra com `paused`, o medidor em `—` | `rest.md:496–504`; `task.md:97, 345` |
| A task pausada não espera por ninguém, e a barra continua com o que o estado pede, quieta, sem chip | `task.md:193, 345`; `structure.md:285`; `components.md:472` |
| `Ctrl+E` abre a worktree; `←` `→` nas abas; `Esc` sai de uma conversa anterior | `task.md:363–367`; `structure.md:351, 364, 370` |
| Os atalhos globais ficam inertes com qualquer diálogo modal | `features.md:738`; `tasks/02-shell.md:144` |

### 4.2 Decisões de design, detalhadas

**O topo.** A faixa é `PlaceHeader` (`components/system/PlaceHeader.tsx`), que ganha um espaço `progress` entre o título e a direita. O título tem `flex: 0 1 auto` e corta com o nome inteiro no tooltip; o stepper e a direita não encolhem. Espaços: `--space-2` entre as peças; o stepper com `--space-2` de margem à esquerda, que vira 0 abaixo de 1040 px.

| Área principal (`main`) abaixo de | O que muda | Onde |
|---|---|---|
| 1660 px | O breadcrumb dobra em `…` | Já é assim (`PlaceHeader.tsx`) |
| 1440 px | Os três botões de painel ficam só com o ícone, o nome no tooltip e no nome acessível | Já é assim (`AuxPanel.tsx:28, 38`) |
| 1360 px | **Pause**/**Resume** só com o ícone | Já é assim (`components/PauseButton.tsx:26`) |
| 1300 px | O medidor só com a porcentagem; os traços entre as etapas saem; o espaço entre as etapas vai de `--space-1-5` a `--space-2-5` | Novo |
| 1200 px | As etapas feitas ficam só com o visto; o nome vai ao tooltip e fica no nome acessível; espaço `--space-2` | Novo |
| 1040 px | A pílula perde o qualificador e a palavra (o glifo fica; os dois continuam no nome acessível); o preenchimento da pílula vai de `--space-3` a `--space-2-5`; o espaço de cada etapa, de `--space-1-5` a `--space-1` | Novo |
| 900 px | As etapas futuras ficam só com o círculo; o espaço entre as ferramentas da direita vai de `--space-2` a `--space-1` | Novo |

"Abaixo de N" é `@container main (width < N)` (`@max-[Npx]/main` no Tailwind), a forma de `PlaceHeader` e `PanelGroup`; o mock escreve `max-width`, que inclui o limite, e vale este material. O nome da etapa atual nunca sai. A 812 px de área principal (1100 de janela), com tudo cedido, o título tem ao menos 200 px na task de nome mais longo das fixtures (pronto 3).

**O stepper.** As etapas: Structured `PRD`, `Tech spec`, `Plan`, `Implementation`, `PR`, `PR review`, `Closing`; One-Shot `Planning`, `Implementation`, `PR`, `PR review`, `Closing`. A etapa atual é a de `stageState` (`lib/stages.ts:56–80`): na etapa de PR, `PR` até a PR existir, `PR review` enquanto ela existe e não foi revisada, `Closing` com `done`, `merged`, `pr_closed`, `closing`. Forma: `task.md:64–73` e o CSS do mock (`b.html:1361–1381`): etapa com `--space-1-5` entre o sinal e o nome, traço de `--space-3` × `--border` em `--line-2`, visto de `--icon-xs` em `--ink-3`, círculo `--glyph-sm` em `--line-deco` com o nome em `--ink-4`; a pílula de `--size-control-sm`, `--brand-tint-plane`, anel `--brand-marker-ring` por dentro, raio `--radius-pill`, `--space-2` entre as partes, o nome em `--brand-ink` 600, a posição em `--ink-2` tabular, o divisor de `--border` × `--space-3` em `--brand-marker-ring`, o glifo `--glyph-sm`, a palavra em 500 (400 com o spinner e o GitHub). Texto em `--text-meta`.

A pílula, por momento. "Com situação" é a task com ao menos uma situação: o glifo é o da mais grave (`task.situations[0]`: losango no grupo `error`, disco no `waiting`, anel no `closing`), sem palavra. "Trabalhando" é a sessão do lugar (a da etapa; no step, `loopSession`, `features/task/step-status.ts:158–172`; na PR, a de `pr.sessionStage`) com `sessionStatus` `working`, também começando (sem processo ainda); fora disso, a linha do agente vale como ociosa. Nas outras linhas não há situação.

| Momento (dado) | Nome | Posição | Qualificador | Glifo | Palavra | Estado do nome acessível |
|---|---|---|---|---|---|---|
| Planejamento, trabalhando | a etapa | — | — | spinner | `working` | `<Etapa> agent working` |
| Planejamento revisitado (`task.revisiting`) | a etapa | — | `revisiting` | o da linha que vale | idem | idem |
| Planejamento ocioso, ou o agente parado sozinho | a etapa | — | — | nenhum, sem divisor | — | `idle` |
| Step `not_started` ou `preparing` | `Implementation` | `N/M` | `preparing` | spinner | `working` | `preparing the worktree` |
| Step `implementing` (`Agent`, antes da primeira passada), trabalhando | `Implementation` | `N/M` | — | spinner | `working` | `Implementer working` |
| Step `agent_review`, trabalhando | `Implementation` | `N/M` | `pass K` (`reviewPass`) | spinner | `working` | `Reviewer working` |
| Step `addressing_review`, trabalhando | `Implementation` | `N/M` | `round R` (`reviewRound`) | spinner | `working` | `Implementer working` |
| Step no modo `Manual` (`reviewMode` `manual`, também depois de um fallback), fora de `committing` | `Implementation` | `N/M` | `Manual` | spinner e `working` trabalhando; senão nenhum | idem | `Implementer working` ou `idle` |
| Step `committing` | `Implementation` | `N/M` | `committing` | spinner | `working` | `committing` |
| Qualquer das linhas do step acima sem trabalho nem situação | `Implementation` | `N/M` | o da linha | nenhum, sem divisor | — | `idle` |
| Todos os steps commitados, antes da PR (`currentStep` 0 com steps) | `Implementation` | `M/M` | — | spinner | `working` | `starting the pull request` |
| Implementação sem nenhum step | `Implementation` | — | — | nenhum | — | `idle` |
| PR `preparing` | `PR` | — | — | spinner | `working` | `checking GitHub` |
| PR `drafting`, trabalhando | `PR` | — | — | spinner | `working` | `PR agent working` |
| PR `opening` | `PR` | — | — | spinner | `working` | `opening the pull request` |
| PR review `waiting_checks`, com leitura e ao menos um check | `PR review` | — | — | círculo tracejado | `checks a/b` | `waiting for the checks, a of b passed` |
| PR review `waiting_checks`, antes da primeira leitura ou sem checks | `PR review` | — | — | círculo tracejado | `checking GitHub`, com o brilho | `checking GitHub` |
| PR review `reviewing`, trabalhando | `PR review` | `pass K` | — | spinner | `working` | `PR agent working` |
| PR review `committing` | `PR review` | `pass K` | `committing` | spinner | `working` | `committing` |
| PR review sem trabalho nem situação | `PR review` | `pass K` | — | nenhum | — | `idle` |
| Closing `closing` | `Closing` | — | — | spinner | `working` | `closing the task` |
| Com situação, em qualquer etapa | como na linha do momento | idem | idem | o da situação | nenhuma | `<tom>: <o que pede> in <lugar>` |
| Pausada (a sessão que **Pause** pausa está pausada) | como na linha do momento | idem | idem | duas barras; a pílula neutra (`--surface-0`, anel `--line-2`, nome `--ink-2`) | `paused` | `paused since 14:52`, ou `paused` sem a hora |

`checks a/b`: `a` são os que passaram, `skipped` e `neutral` incluídos, e `b` todos. O `K` do PR review conta os relatórios da PR (`pr.reports`) quando a passada já escreveu o seu (`awaiting_decision`, `in_review`, `ready_to_approve`, `committing`, `done`, `trouble`) e os relatórios mais um da partida da passada até o relatório dela (`reviewing`, e `awaiting_reply` com `prNumber > 0`); `waiting_checks` fica sem posição. Numa task One-Shot, a implementação não tem `N/M`: o qualificador toma o lugar da posição e não sai abaixo de 1040 px (`Implementation pass 2`, `Implementation Manual`). O `N` é `currentStep` e o `M` é `steps.length`.

**As nove cenas** (`task.md:320–334`): `plan` `[PRD ●]` e as seis futuras; `run` `✓ ✓ ✓ [Implementation 3/7 · round 1 ◌ working]`; `ask` `[Implementation 3/7 · pass 2 ●]`; `error` `[Implementation 3/7 · pass 2 ◆]`; `manual` `[Implementation 4/7 · Manual ●]`; `blocked` `[Implementation 5/7 ◆]`; `checks` `✓ ✓ ✓ ✓ ✓ [PR review ◌ checks 3/5]`, sem medidor; `findings` `[PR review pass 1 ●]`; `close` `[Closing ○]`.

**O nome acessível** do stepper é `Progress · <nome>[ <posição>][ · <qualificador>] · <estado>`, com o estado da última coluna da tabela. Com situação: `<tom>: <rótulo inteiro com a primeira letra minúscula> in <lugar>`, o fragmento de `announcement` (`lib/situations.ts:228–234`) sem o nome do item (`waiting for you: question in Reviewer`), com `, and N more` quando há outras; o tom é `error`, `waiting for you` ou `ready to close`. `<Quem>` são os papéis de `features/sidebar/sessions.ts:52–78` (`Implementer`, `Reviewer`, `PRD agent`, `Tech spec agent`, `Plan agent`, `Planning agent`, `PR agent`, este também na conversa do review da PR). As etapas dobradas têm o nome e ` · done` ou ` · to come` num texto oculto. O **tooltip** do stepper é a lista, `✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · pass 2  ○ PR  ○ PR review  ○ Closing`, e, pausada com a hora conhecida, uma segunda linha `Paused since 14:52`. O hover num ponto dobrado mostra `PRD · done` ou `PR · to come`. **Carregando**: os nomes com o brilho, sem pílula aberta. É o instante entre criar a task e o primeiro snapshot que a traz (`TaskView.tsx:54–56, 64–66`, hoje uma área vazia): o cabeçalho aparece com o título vazio e o stepper carregando com as etapas da Structured, o modo de partida da criação (`features.md:311`); o snapshot troca pelo stepper do modo da task. Nada mais do topo aparece nesse instante.

**Pause e Resume** (`rest.md:496–504`). Existem enquanto a conversa em que a task espera existe: a da etapa de planejamento; no step, a do revisor em `agent_review` e a do implementador no resto, só com sessão (`loopSession`); na PR, a de `pr.sessionStage`. **Pause** fantasma com o ícone `pause`, tooltip `Pause the task · the session that works stops`; clicado, `Pausing…` com o spinner até a chamada voltar. Com a sessão em erro, tracejado, com a razão no tooltip e na descrição: `Nothing is running to pause: the <quem>'s session stopped with an error. Retry it` e, num step, `, or discard the step.`, numa etapa de planejamento, `, or discard and restart the <etapa>.`, na PR, `.` (`<quem>` em minúsculas: `implementer`, `reviewer`, `PRD agent`…). **Resume** com o ícone `resume`, tooltip e descrição `Resume the task · paused since 14:52`; sem a hora (uma pausa de antes desta versão, `paused_at` nulo), `Resume the task`. `Resuming…` enquanto corre.

**O medidor** (`ContextMeter`) mede a conversa na tela: a da aba escolhida, a da etapa, a da PR. Não aparece sem sessão na tela (step bloqueado ou preparando, PR esperando os checks sem conversa, a PR em `done` ou `merged`) nem com uma conversa anterior aberta. `contextPercent` 0 é "ainda sem leitura" (`…` com o brilho); a sessão na tela pausada, `—`. Tooltip `Context used by the <quem>: 44%`.

**O grupo de painéis**, na ordem, com o tooltip do nome e a descrição embaixo, a forma de `AuxPanel.tsx:28`: **Details** (ícone `details`, `Steps, earlier conversations, reports and the facts of the task`; numa One-Shot, `Earlier conversations, reports and the facts of the task`), **Artifacts** (`file`, `PRD, tech spec, step files and the pull request draft`; One-Shot, `The One-Shot document and the pull request draft`), **Card** (`card`, `The card <repo>#<N> on the board`), este só com `task.card`. `PanelId` (`store/app-store.ts:71–72`) ganha `details` e `card`.

**O `⋯`** (fantasma de ícone `more`, `aria-label` e tooltip `More actions`), com `Menu`, `MenuGroupLabel` e `MenuItem` de `components/system/Menu.tsx`. Os grupos, nesta ordem, cada um só quando tem itens:

| Grupo (legenda) | Item | Quando | Desabilitado | Abre |
|---|---|---|---|---|
| `Step N · <título>`; One-Shot, `Implementation` | **Review myself** | `canReviewMyself(step)` (`step-status.ts:122–128`) | — | nada: tira o review do agente na hora |
| | **Open in VS Code** `Ctrl+E`, ícone `openInEditor` | com um step atual | `· the worktree doesn't exist yet` | o VS Code |
| | **Discard step N…**; One-Shot, **Discard the implementation…** | `hasStepSession(step)` | — | `DiscardStepDialog` |
| `Pull request`, antes da abertura | **Discard draft** | `canDiscardDraft(pr)` (`pr-status.ts:136–149`: `drafting`, `draft_ready`, `awaiting_reply` sem PR) | — | nada: o agente escreve outro, como hoje |
| | **Open in VS Code** `Ctrl+E` | com a worktree | — | o VS Code |
| `Pull request #1284`, com a PR aberta | **Open PR**, ícone `external` | sempre | — | o GitHub |
| | **Refresh PR**, tooltip `Read the pull request now · checked 2m ago` | sempre | `· the task is closing` em `closing` | nada |
| | **Review again** | sempre | `canReviewAgain(pr)` (`pr-status.ts:152–169`) falso, com a razão: `· a pass waits for the checks` em `waiting_checks`, `· the changes are being committed` em `committing`, `· the pull request was closed` em `pr_closed`, `· the pull request stage is blocked` em `blocked`, `· the task is closing` em `closing` | nada: pede a passada, também durante uma, como hoje |
| | **Open in VS Code** `Ctrl+E` | com a worktree, fora de `closing` | — | o VS Code |
| `PRD`, `Tech spec`, `Plan` ou `Planning` | **Discard and restart the PRD…**, **…the tech spec…**, **…the plan…**; One-Shot, **Discard and restart planning…** | a etapa atual é de planejamento (também revisitada) | — | `StageActionDialog` (`discard`) |
| `Task` | **Review mode ›** com `Agent` ou `Manual` ao lado | sempre | — | o popover Review mode |
| | **Models ›** com `per stage` | sempre | — | o popover Models |
| | **Back to PRD…**, **Discard and restart the PRD…** | Structured depois do PRD | — | `StageActionDialog` (`back` e `discard`, `prd`) |
| | **Back to Tech spec…**, **Discard and restart the tech spec…** | Structured depois do tech spec | — | idem (`tech_spec`) |
| | **Discard and restart the plan…** | Structured na implementação | — | idem (`discard`, `plan`) |
| | **Back to planning…**, **Discard and restart planning…** | One-Shot na implementação ou na PR | — | idem (`one_shot`) |
| depois de um separador | **Delete task…**, em vermelho | sempre | — | `DeleteTaskDialog` |

Os itens do grupo `Task` são os que os chips da trilha oferecem hoje (`StageTrack.tsx:59–80`), um a um. `Ctrl+E` e **Open in VS Code** abrem a worktree da task (`openInEditor`); `Ctrl+E` vale com o foco em qualquer lugar da tela da task, a caixa de mensagem incluída, e fica inerte sem worktree e com um diálogo modal.

**Os popovers.** `Popover` de `--size-popover`, ancorado no gatilho: aberto do `⋯`, no botão `⋯`; aberto de `Details`, no chip. Ao abrir, o foco vai à opção escolhida (Review mode) ou ao primeiro chip editável (Models); `Esc` fecha o `listbox` e depois o popover, e devolve o foco ao `⋯` ou ao chip.

**O popover Review mode** (`components.md:262–269`; `b.html:2357–2363`, `1327–1340`): título `Review mode`, `radiogroup` `Review mode of the task` com `Agent` (robô, *An agent reviews each step with the implementer; clean steps are committed.*) e `Manual` (pessoa, *You review each step in VS Code, stage the files and approve.*), a escolhida em `--brand-tint` com o visto. A nota, em `--text-micro` `--ink-3`: antes do plano, `Applies to the steps the plan writes.`; com steps, F os não iniciados sem modo próprio e O os não iniciados com modo próprio, `Applies to the steps not started that follow the task: 5, 6, 7.` e, com O, ` Step 4 has its own mode.` ou ` Steps 4 and 6 have their own mode.`; numa One-Shot, `Applies to the implementation, before it starts.` Desabilitado (`reviewModeEditable` falso): as opções tracejadas e a nota com a razão, `No step is left to start, so the mode can't change.`, ou, com O e sem F, `Every step not started has its own mode.`, ou, numa One-Shot, `The implementation has started, so the mode can't change.` Salvando: o spinner no lugar do visto e `Saving…` na nota. Erro: `Couldn't save the mode · Try again` na nota, em `--state-error`, com **Try again** como link de ação.

**O popover Models** (`components.md:271–280`; `b.html:2364–2370`): título `Models`, uma linha por etapa de `task.models`, na ordem, com o nome (`PRD`, `Tech spec`, `Plan`, `Implementation`, `Step review`, `PR`, `PR review`; numa One-Shot, `Planning` no lugar de `One-Shot planning`) e, editável, o `ModelChip` `sm` que abre o `listbox` de modelo e esforço; iniciada, `Opus · medium · started` em `--ink-2`, com o tooltip `The stage has started; its session keeps this model` (com a sessão rodando, `Change it in the conversation, from the composer`). Uma escolha que não se salvou: a razão e **Try again** sob a linha, `role="alert"`, como `components.md:277`. A nota: `A stage takes its model when it starts. Each step not started can have its own, in Details.`; numa One-Shot, só a primeira frase. O `listbox` é o de hoje (`ModelPicker.tsx:88–130`, grupos `Model` e `Effort`) na forma do menu do system; o indisponível com `◇` e a razão; o catálogo nunca lido, a mensagem de `catalogFailureMessage` no lugar dos itens.

**`ModelChip`** é o `Chip` com o seletor de modelo e esforço (`components.md:166–177`): `sm` no popover e em `Details`, `Opus · high` ou só o nome sem esforço; própria em `--ink-1` 500, seguindo em `--ink-3`; `Saving…` com o spinner; lendo o catálogo, a escolha com o brilho; indisponível `◇` com `Not in the models of the installed Claude Code` no tooltip.

**As abas** (`components.md:455–465`; `b.html:1384–1399, 2496–2501`). Existem com `step.reviewer` ou com o step em `agent_review` sem revisor aberto (o instante entre o fim do turno do implementador e a sessão do revisor), até o commit; somem com a conversa anterior aberta. Ficam sob o cabeçalho, com `--space-1` de folga acima, alinhadas à esquerda na coluna de `--measure-conversation` centrada em pixel inteiro (a área menos `--space-6` de cada lado quando mais estreita), altura `--size-tab`, `--space-5` entre elas, fio `--line-1` embaixo. Cada aba: o glifo da sessão e o nome, em `--text-meta`. O glifo: a situação da conversa (disco, losango); sem ela, pelo `sessionStatus`: spinner em `working`, duas barras em `paused`, losango em `error`, círculo fino no resto; `starting` com o spinner quando a sessão trabalha sem processo (`processRunning` falso). A de fora diz `· waits` (`--state-wait`, 500) com uma situação de espera e `· error` (`--state-error`) com uma de erro ou a sessão em erro. Desabilitada: `Reviewer · starts with pass 1` em `--ink-4`, tracejada, no instante acima. O nome acessível e o tooltip: `<Nome>: <estado>` (`task.md:119`). **Qual abre**: a escolha guardada do step (`openStepTab`); sem ela, a da situação mais antiga das duas; sem situação, a do revisor em `agent_review` e a do implementador no resto. A primeira abertura grava a escolha, e dali em diante só o usuário, `Ctrl+J` e a notificação a trocam (`store/app-store.ts:357–366`). A **piscada** de uma situação nova da aba de fora é a da árvore, 2 × `--duration-slow` no véu da gravidade; a classe `.tree-flash` (`styles/globals.css:349–358`, 372–379, 424–429) passa a `.situation-flash` para servir às duas.

**Details** (`task.md:255–272`; `b.html:2385–2406`, `1090–1094`, `1286–1302`). Grupos com a legenda em caixa alta de `--text-caps`, `--space-4` entre eles; linhas de `--size-control-sm`, `--text-meta`; o meta à direita em `--text-micro` `--ink-3` tabular.

- **Steps** (Structured), com `Steps · 2 of 7 committed`, e `Steps · 7 committed` com todos. Antes do plano, `Steps come from the plan.` em `--ink-3`. Uma linha por step, na ordem:
  - **commitado**: o visto, `N · <título>` e, à direita, o SHA de 7 em mono e a hora do commit (`c19f02e · 13:48`; sem a hora, só o SHA), com o assunto do commit e a data inteira no tooltip. Abaixo, recuadas de `--icon-sm` + `--space-2`, em `--ink-2` e `--size-control-xs`: `Implementer` e, quando existiu, `Reviewer` (ícone `conversation`, com a hora de início à direita), e os relatórios `Review 1 · changes`, `Review 2 · clean` (ícone `file`);
  - **atual**: o glifo do step (o da pílula), `N · <título>` em 600 e, à direita, `now · Agent` ou `now · Manual` em `--brand-ink` 500; com um fallback, a razão de `fallbackReason` no tooltip; abaixo, os relatórios do step, sem as linhas de conversa, que são as abas;
  - **não iniciado**: `N · <título>` em `--ink-3` e, à direita, `StepModeChip` e `ModelChip`, `sm`. O de modo: robô e `Agent` ou pessoa e `Manual`; próprio em `--ink-1` 500 com o tooltip `Its own mode · the task reviews with Agent`, seguindo em `--ink-3` com `Follows the task`; o `listbox` tem `Agent`, `Manual` e, com modo próprio, depois de um separador, **Follow the task · Agent**. O de modelo: próprio com `Its own model · Implementation uses Sonnet · high`, seguindo com `Follows Implementation`; sem **Follow**, como hoje.
- **Implementation** (One-Shot, a partir da implementação), no lugar de Steps: uma linha `Implementation` com as mesmas formas de commitado e atual, sem número, e as conversas e os relatórios abaixo. Antes da implementação, a One-Shot não tem esse grupo.
- **Planning**: uma linha por conversa de planejamento que existe (`PRD`, `Tech spec`, `Plan`; `Planning`), com a hora de início; a conversa na tela diz `now` em `--brand-ink`, não é botão.
- **Pull request**, a partir da etapa de PR: as conversas `Draft and opening` (`· #1284` quando aberta) e `PR review`, com a hora, a da tela com `now`, e sob `PR review` os relatórios de todas as passadas (`Review 1 · changes`); a conversa `PR review` é a da última passada, porque **Review again** descarta a anterior (`internal/flow/pr.go:1299`). Depois, em chave e valor (`b.html:1091–1093`, a chave em `--ink-3`, `7rem`): `Pull request` `#1284 · into dev` (o número é link externo; `· merged` ou `· closed` quando é o estado); `Checks` com `ChecksList`; `Checked` `2m ago` com a hora exata no tooltip. Sem PR aberta, só as conversas.
- **Task**, em chave e valor: `Repository` `acme/api · ~/code/api` (o caminho em mono; com o clone ausente, `◇ clone missing` com o caminho no tooltip); `Card` `acme/api#412 · In progress` (link externo) só com card; `Epic` o título (link externo) só com épico; `Mode` `Structured` ou `One-Shot`; `Review mode` o `Chip` `sm` com o ícone, o modo e o chevron, que abre o popover; `Models` o `Chip` `sm` `Per stage`, com o nome acessível `Models per stage`, que abre o popover; `Branch`, `Base` (sem o `origin/`, como `prBaseName`, `pr-status.ts:89–91`) e `Worktree` em mono, só com a worktree criada; `Started` `Today 09:14`.

Um **relatório** abre no lugar da lista, dentro de `Details`: uma linha de cabeçalho com **← Details** (fantasma `sm`) e o título (`Step 3 · Review 1 · changes`, `PR review · Review 2 · clean`), e o relatório em Markdown no registro de leitura. Lendo: três barras de esqueleto; falha: `Couldn't read <arquivo> · Try again` em `--state-error-veil`. O marco de um relatório na conversa (task 4) leva **Open in Details** (`task.md:149`; `components.md:531`).

Uma **linha de conversa** é um botão com o ícone `conversation`; sendo lida, `aria-pressed="true"`, `--brand-tint-plane` com anel `--brand-marker-ring` e tinta `--brand-ink`; um segundo clique volta à conversa atual. Carregando, `Opening the conversation…` com o spinner na linha, e a conversa atual fica na coluna até a anterior chegar; falha, `Couldn't open it · Try again` na linha, com o losango, em vez do aviso do app.

**A conversa anterior** (`task.md:274–282`; `b.html:2466–2469`, `1273–1276`). Toma a coluna: a conversa (`Conversation` somente leitura, com a sessão como ociosa) aberta no começo, e no lugar do compositor a faixa de `--size-ask`, `--surface-0`, raio `--radius-md`, `--text-meta` `--ink-3`: o ícone `history`, `<Lugar>` em `--ink-1` 600, ` · an earlier conversation. It takes no more messages.` e **Back to <agora>** (secundário `sm`, tooltip `Back to where the task is · Esc`).

- O lugar: `PRD`, `Tech spec`, `Plan`, `Planning`, `Step 2 · Implementer`, `Step 2 · Reviewer`, `Implementation · Implementer` e `Implementation · Reviewer` (One-Shot), `Draft and opening`, `PR review`.
- O agora sai do lugar da task, não da conversa: `step N` num step; `the implementation` numa One-Shot; `the PRD`, `the tech spec`, `the plan`, `planning` no planejamento; na etapa de PR, `the PR review` com a conversa do review na tela e `the pull request` no resto (preparando, esperando os checks antes da passada, `done`, `merged`, `closing`).
- O foco: ao abrir, vai à região da conversa anterior (`tabindex="-1"`, com o nome `<Lugar>, an earlier conversation`); ao sair, volta à linha que a abriu com o painel aberto, e à região da conversa atual sem ele.
- A barra, as abas, `ReviewStrip` e o medidor somem; o stepper, a árvore, o `⋯` e os painéis ficam.
- Saem dela `Esc` (depois do `listbox`, do popover, do `⋯` e do painel), **Back to …**, um novo clique na linha, qualquer ida a outro lugar, e a chegada a uma situação da mesma task (`Ctrl+J`, a notificação).
- Com o painel cobrindo a conversa (menos de 1120 px), abrir uma fecha o painel; como coluna, ele fica aberto. Não entra na pilha de lugares.

**Artifacts** (`task.md:284`; `b.html:2407–2412`). Só os documentos escritos, sem as linhas `not yet` do mock: **Documents** (`PRD`, `Tech spec`; numa One-Shot, `One-Shot document`), **Step files · 7** (`N · <título>`; uma One-Shot não tem o grupo), **Pull request** (`Draft · <título do rascunho>`, com `approved` à direita depois da abertura). Cada linha, com o ícone `file`, abre o documento no lugar, com **← Artifacts** e o título, em Markdown no registro de leitura (o arquivo de step por `StepDocument`). Sem nenhum documento: `No artifacts yet` e `The PRD appears here once the agent writes it.` (One-Shot, `The One-Shot document appears here once the agent writes it.`). Lendo e falha como o relatório. O painel não troca de documento sozinho quando a etapa muda.

**Card** (`task.md:286`; `structure.md:320`), com o `aside` `Card #412`. A primeira linha: `acme/api#412` em mono, o status do board em `--ink-3` e **Open on GitHub** (link externo); o título do card em `--text-ui` 600; o corpo em Markdown no registro de leitura; e `RelationList` com `Epic` (o épico), `Cards of the epic · N` (os irmãos: número, título, status), `Dependencies` (número, título, estado, com `◇ Not satisfied`) e `Pull requests` (`#N · <estado>`, com o repositório quando é outro; `CardPullRequest` não tem título, `dto.go:796–801`), cada grupo só quando tem itens. Toda relação é um link externo; a task 5 faz as que estão no board (`onBoard`, `dto.go:804–809`) abrirem o painel do card no board (`implementation.md:94`). Os dados vêm do `BoardCard` da última leitura (`boards[].cards[]` por `task.card.key`). Fora dela, a faixa de aviso no alto, `◇ This card isn't in the last reading of the board.`, e só o que a task guarda (a referência, o status, o título, o épico); board nunca lido, `◇ The board hasn't been read yet.`; board removido, `◇ The board of this card was removed.`

**A barra na task 3.** As situações cuja ação morava numa barra que sai ganham a barra do pedido (`RequestBar`), com os textos de `task.md` §7; as outras ficam para a task 4 (§3, Fora). A barra fica entre a conversa (ou a nota de `PRPane`) e o compositor, na coluna de `--measure-conversation`; sem compositor, no pé da coluna. `step_review` e `step_empty` são do step: aparecem nas duas abas.

| Situação · estado | Forma | Rótulo · lugar · chip | Meio | Ações |
|---|---|---|---|---|
| `step_review` | tingida | `Review step 4` (forma `approve`: `Approve step 4`) · chip | `5 of 7 files staged · 71%`; com `commitFailed`, `· the last approval didn't produce a commit`; com o fallback `rounds_exhausted` ou `commit_failed`, `· <fallbackReason com a primeira letra minúscula>` | **Open in VS Code** (secundário, tooltip `Ctrl+E`), **Approve** (primário; tracejado com `Stage N more files` abaixo de 100%, `The worktree couldn't be read` com o erro de leitura; `Approving…`) |
| `step_empty` | tingida | `Step 4 has no changes` · chip | — | **Discard step 4…** (secundário, `DiscardStepDialog`) |
| `ready_to_continue` | tingida | `Ready to continue` · `Tech spec` · chip | — | **Continue** (primário, `Continuing…`) |
| `draft` | tingida | `Draft to approve` · chip | — | **Approve draft** (primário: abre a PR com o rascunho editado; tracejado com `Write a title and a description` ou `Wait for the agent to finish`; `Approving…`), **Discard draft** (secundário, repetido do `⋯`) |
| `changes_review` | tingida | `Review changes` (`Approve changes`) · chip | `3 of 5 files staged · 60%`, e a nota de `commitFailed` | **Open in VS Code**, **Approve** como no step |
| `merge`, forma `merge` · `done` | tingida | `Ready to merge` · `#1284` · chip | com o clone ausente, a razão de `closeHint` | **Open PR** (secundário) |
| `merge`, forma `close` · `done` (a leitura falhou e o encerramento é oferecido) | encerramento | `Ready to close` · `#1284` · chip | `Couldn't confirm the merge · Removes the worktree and the branch, then updates dev` | **Open PR** (secundário), **Close task** (primário; `Closing…`) |
| `merge`, forma `close` · `merged` | encerramento | `Ready to close` · `#1284 merged` · chip | `Removes the worktree and the branch, then updates dev` | **Close task** (primário; tracejado com `closeHint`; `Closing…`) |
| `pr_trouble` | erro | `Checks failed`, `Conflict with base` ou `Checks failed · conflict` · chip | `Failed: <checks>` e `Conflict with <base>`, unidos por ` · `; com `canClose`, `· Couldn't confirm the merge` | **Review again** (primário, `Asking…`); com `canClose`, **Close task** (secundário) |
| `pr_closed` | erro | `PR closed unmerged` · `#1284` · chip | — | **Delete task…** (secundário, `DeleteTaskDialog`) |

A barra lê a forma da situação e o `pr.status`: o backend dá a forma `close` a `done` quando `canClose` é verdadeiro (`internal/attention/derive.go:235–247`), e só `merged` diz `merged`. O `<base>` vem de `prBaseName`. O texto de estado (`role="status"`) é o rótulo e o lugar com que a situação nasceu, e não muda com a forma, para as continuações não serem anunciadas (`structure.md:175`).

**A task pausada** (`task.md:193`; `structure.md:285`). Uma sessão pausada não tem situação (`internal/attention/derive.go:47–50`): a task não espera por ninguém, não notifica, sai do `Ctrl+J`. A barra continua com o que o estado do step ou da PR pede, derivado por `request.ts` do estado e não das situações (`step.status`, `pr.status`), com o mesmo rótulo, meio e ações da tabela, na forma quieta, com as duas barras no lugar do glifo, o rótulo em `--ink-1` 700 e sem chip; a ação retoma a sessão, como hoje (`features.md:410`). Pergunta, permissão e erro da sessão pausada não aparecem. `ready_to_continue` também não: `canContinue` exige a sessão em repouso, e em repouso é sem pausa (`internal/bindings/convert.go:235`; `internal/session/state.go:145–147`), então continuar espera o **Resume**, como hoje (`StageTrack.tsx:140–149`). O `DraftCard` segue a mesma regra do **Open PR**.

**As notas de `PRPane` e o `DraftCard`** (no step 9): `Troubled` (`PRPane.tsx:139–146`), `AwaitingMerge` (`:104–111`), `Merged` (`:167–170`) e `PRClosedUnmerged` (`:187–190`) perdem os botões e ficam com o texto e o link da PR; **Review again** e **Refresh PR** estão no `⋯`, **Close task** na barra. O `DraftCard` mostra **Open PR** (`DraftCard.tsx:76–81`) só em `awaiting_reply` com `draftAtHand`; em `draft_ready`, a ação é a da barra.

**A árvore.** Na linha de uma task esperando os checks (`features/sidebar/sidebar-tree.ts:532–545`), depois da primeira leitura a linha 2 passa de `PR review · waiting for checks` / `PR review · checks` a `PR review · checks a/b`; antes dela continua `PR review · checking GitHub`. A contagem é a da pílula. A linha de `merge` na forma `close` (`sidebar-tree.ts:408–411`) diz `Ready to close · PR #P merged` só com `pr.status` `merged`, e `Ready to close · PR #P` com o merge sem confirmação (`structure.md:117`).

**`ChecksList`**, a variante de painel de Checks do GitHub (`components.md:630–638`; `b.html:2112–2119`): o resumo `3 of 5 passed · 2 not finished` (com falha, `· 1 failed`; com o merge lido, `· merges clean` ou `· conflict with dev`), e uma linha por check: o glifo, o nome em mono, o estado e a duração à direita (`1m 52s`; rodando, desde o início, atualizada a cada segundo enquanto a lista está à vista; na fila, `—`). Os estados do GitHub:

| GitHub | Estado | Glifo |
|---|---|---|
| CheckRun `COMPLETED` com `success` ou `skipped`; StatusContext `SUCCESS` | `passed` (`skipped`: `skipped`) | visto; `skipped` em `--ink-4` |
| CheckRun `COMPLETED` com `neutral` | `neutral` | visto em `--ink-4` |
| Toda conclusão que `Check.Failed` conta (`failure`, `cancelled`, `timed_out`, `action_required`, `stale`, `startup_failure`…; StatusContext `FAILURE`, `ERROR`) | `failed`, a conclusão do GitHub no tooltip, em `--state-error` | losango |
| CheckRun `IN_PROGRESS`; StatusContext `PENDING` | `running`, em 500 | spinner |
| CheckRun `QUEUED`, `WAITING`, `REQUESTED`, `PENDING`; StatusContext `EXPECTED` | `queued` | círculo |

Sem nenhuma leitura, `Not read yet`; sem checks, `No checks`.

**Ícones** acrescentados ao registro (`components/system/icons.ts`), um por significado: `details` (lucide `Info`), `card` (SVG próprio copiado do símbolo `i-card` do mock, `b.html:2214`), `conversation` (lucide `MessageSquare`), `history` (lucide `History`, a faixa da conversa anterior), `more` (lucide `Ellipsis`), `pause` (`Pause`), `resume` (`Play`).

**Horas, idades e durações** (`lib/when.ts`, puro, com `useNow`). Uma hora de hoje é `09:14` (24 h); de ontem, `Yesterday 16:02`; do ano, `Sep 22, 09:14`; de outro ano, `Sep 22, 2025, 09:14`; num campo `Started`, a de hoje é `Today 09:14`; o tooltip tem a data inteira. As linhas de conversa usam a forma curta (`09:14` hoje, `Sep 22` antes). Uma idade é `just now` abaixo de um minuto, `2m ago`, `3h ago`, `2d ago`: é a idade do app inteiro, e o cabeçalho do board e o de Reviews passam a ela (`checked just now`, `task.md:160`; `components.md:634`). Uma duração é `42s`, `4m 12s`, `1h 3m`.

**`Esc`** fecha, nesta ordem, o `listbox`, o popover, o `⋯`, o painel e a conversa anterior (`task.md:365`), depois o que `app/useGlobalShortcuts.ts:79–105` já trata.

### 4.3 Decididas neste material, onde `design/` não decidia

Registradas nos documentos a que pertencem; o coordenador aceitou a 1 e a 2.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | Onde ficam **Approve**, **Continue**, **Approve draft**, **Discard draft** e **Close task** quando as barras velhas saem | A task 3 liga a barra às oito situações cuja ação morava numa barra que sai; a task 4 liga as outras nove | `implementation.md:70, 74, 82` |
| 2 | O review `Manual` sem a lista de arquivos até a task 4 | `ReviewStrip` fica na task, sob as abas (hoje fica acima, `StepPane.tsx:81–84`), até a task 4 | `implementation.md:70, 82` |
| 3 | A pílula com uma situação que a barra ainda não diz | A regra é a da situação, não a da barra | `task.md:75, 99`; `structure.md:229`; `components.md:448` |
| 4 | Onde um relatório abre | No lugar da lista, dentro de `Details`; o marco leva **Open in Details** | `task.md:149, 255–272`; `components.md:531` |
| 5 | Os relatórios do review da PR da task | Sob a conversa `PR review` em `Details` | `task.md` §10 |
| 6 | **Review again** no `⋯` da task | Sem reticências e sem diálogo, habilitado por `canReviewAgain`, como hoje | `task.md:291`; `structure.md:225, 284`; `changes.md:28` |
| 7 | O `⋯` antes de a PR abrir | **Discard draft** e **Open in VS Code**; a barra `draft` repete **Discard draft** | `task.md:291`; `structure.md:284` |
| 8 | A pílula no trabalho do app, parada sozinha, antes da primeira leitura dos checks, numa One-Shot, sem steps, o `K` do PR review, o que sai abaixo de 1040 px | A tabela da §4.2 | `task.md:53, 99` |
| 9 | O nome acessível e o tooltip do stepper e das abas | As fórmulas da §4.2 | `task.md:103, 119`; `components.md` (Stepper e pílula, Abas de agente) |
| 10 | A aba escolhida sem escolha guardada; a aba do revisor antes da sessão dele | A regra da §4.2 | `task.md:117, 123` |
| 11 | O medidor com duas conversas no step, e pausado | O da conversa na tela; `—` com ela pausada | §4.2 |
| 12 | Os campos de `Details`, os formatos de hora e de idade, o rótulo do botão de Models | A §4.2; uma idade só no app | `task.md:160, 291`; `components.md:634` |
| 13 | **Follow the task** no modelo do step | Só no modo, como no mock | `task.md:259` |
| 14 | O conteúdo e os estados de `Card` e de `Artifacts` | A §4.2; as relações como links externos até a task 5 | `task.md:284–286`; `implementation.md:94` |
| 15 | A conversa anterior: onde abre, a volta, o carregando, o foco, o que a fecha | A §4.2 | `task.md:274–282` |
| 16 | A contagem, os estados e as durações dos checks | A §4.2, com a tabela dos estados do GitHub | `components.md:630–638` |
| 17 | A contagem dos checks na linha de um review | Fica para a task 6 | `implementation.md:106` |
| 18 | O rótulo do descarte numa One-Shot | **Discard the implementation…**; o diálogo de hoje diz `Discard step 1 and start over?` até a task 11 | §4.2 |
| 19 | As notas da barra do step (`commitFailed`, as três rodadas) | No meio da barra, depois do progresso | `task.md` §7 |
| 20 | A barra de `merge` e de `pr_trouble` com o merge sem confirmação | A tabela da §4.2, pela forma e pelo `pr.status` | `task.md:211–215`; `structure.md:117` |
| 21 | A piscada antiga | As regras `attention-flash` saem nesta task, com o último leitor | `implementation.md:70` |
| 22 | Divergências do mock | Vale o material: o limite `<` e não `max-width`; `--size-tab` nas abas (o mock usa `--size-control`), com a folga `--space-1` acima como o mock; os irmãos no `Card` com o status em texto, não com o glifo da task (`b.html:2414`); `Artifacts` sem as linhas `not yet` (`b.html:2408–2409`); **Review again** sem reticências | `implementation.md:5` |
| 23 | A task pausada perdia **Approve**, **Approve draft** e **Close task**, que hoje aparecem com a sessão pausada | A barra continua, quieta, derivada do estado; **Continue** espera o **Resume**, como hoje | `task.md:193, 345`; `structure.md:285, 417`; `components.md:472` |
| 24 | O cedido do nome da etapa atual | O nome da etapa atual nunca sai | `task.md:44`; `structure.md:223`; `components.md:297`; `principles.md:101` |
| 25 | O mínimo do título a 812 px | Abaixo de 900 px, o espaço entre as ferramentas da direita vai de `--space-2` a `--space-1` | `task.md:54` |
| 26 | A largura dos popovers | `--size-popover: 22rem`, acrescentado a `tokens.css` no step 5 | `components.md:266, 869` |
| 27 | O nome da conversa do review da PR | `PR agent`, como `features/sidebar/sessions.ts:73–75` | `task.md:334` |

### 4.4 O que o tech spec toma

- **P4.** Uma coluna `sessions.paused_at` (migration nova), gravada em `session.Service.Pause` e limpa em `Resume` (`internal/session/service.go:582–621`), levada a `Record` (`state.go:23–40`), a `Summary` (`state.go:123–`) e a `pausedAt` nos cinco blocos de sessão dos DTOs, como P1 fez. A recomendação é os cinco blocos, porque o review e a discussão usam **Pause** nas tasks 6 e 9.
- **P12.** `git.Commit` lê `%cI` (`internal/git/commands.go:308–319`); uma coluna `steps.committed_at`, gravada em `SetStepCommitted` (`internal/task/service.go:744–755`); `StepState.CommittedAt` e `Step.committedAt`. Um step commitado antes desta versão fica sem hora (`""`). A alternativa, a hora em que o app percebeu o commit, é descartada: o commit à mão chega atrasado.
- **P13.** `checkOf` passa a guardar o `status` do CheckRun, que `CheckNode` já lê e descarta (`internal/gh/checks.go:67–85`), e `CheckNode` ganha `startedAt` e `completedAt`; os checks de cada leitura vão com `SetPRDetails` (`flow/pr.go:467`, `flow/pr_checks.go:84`; `prDetails`, `flow/pr.go:489–497`) para uma coluna `pr_runs.checks` (JSON), e `PullRequest` ganha `checks` (nome, estado, conclusão, início, fim, URL) e `mergeable`. A recomendação é gravar: `Details` não pode ficar vazio depois de reiniciar. O tech spec confere com o `ghtest` que o `gh pr view --json statusCheckRollup` traz as horas; sem elas, a duração é `—`.
- **P42 a P45** (`backend.md:53–56`), com a forma que o tech spec escolher; as recomendações estão na §5.3.
- **O lugar da conversa anterior no store.** `earlierConversation: { taskId, stage } | null`, zerado por toda navegação como `panel` (`store/app-store.ts:504, 549`), fora da pilha e fora de `ui-storage`. `TranscriptState.status` ganha `error` com a mensagem, e `loadTranscript` de uma conversa anterior o grava em vez de chamar o aviso do app.
- **`Conversation` somente leitura.** Uma prop `readOnly` que tira o compositor, a resposta dos cartões, **Retry** e **Remove**; a sessão passada como ociosa.
- **A escolha da aba na primeira abertura** grava `openStepTab` num efeito de `AgentTabs`, não durante a renderização.
- **Onde moram as funções puras**: `features/task/stepper.ts`, `agent-tabs.ts`, `task-menu.ts`, `request.ts` (também a barra da task pausada), `details.ts`; `lib/when.ts`; a contagem, o resumo e os estados dos checks em `lib/pull-requests.ts`. `stage-actions.ts` fica com os textos dos diálogos.
- **`ModelChip`** é novo em `features/models/` e só a tela da task o usa; `ModelPicker` fica com os seus leitores até as tasks deles. A alternativa, reescrever `ModelPicker` por dentro para todos, é do tech spec se o custo for o mesmo.

## 5. Inventário atual

### 5.1 `features/task`

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `TaskView.tsx` (24–108) | Cabeçalho, `StageTrack`, painel de artefatos, e por etapa `StepBar`+`StepPane`, `PRBar`+`PRPane` ou a conversa com `PlanProblemsNotice` e o compositor | Reescrito: cabeçalho, abas, `ReviewStrip`, a conversa (ou a anterior), a barra, o compositor ou a faixa, os três painéis |
| `TaskHeader.tsx` (26–87) | `StatusBadge`, `ContextGauge`, `PauseButton`, `TaskReviewModeButton`, `TaskModelsButton`, `CardLink`, grupo com `Artifacts`, lixeira (`IconButton`) com `DeleteTaskDialog` | Reescrito (§4.2) |
| `StageTrack.tsx` (59–199) | A trilha de chips com **Back to**/**Discard and restart** nos chips (`menuItems`, 59–80; o PRD e o tech spec também descartáveis de etapas posteriores, 65–70) e **Continue to …** (133–149) | Sai: o stepper, o `⋯` (os mesmos itens) e a barra `ready_to_continue` |
| `StepBar.tsx` (67–192) | `Step N of M`, título, estado, as notas (138–147), **Approve** (151–160), **Review myself** (161–172), **Open in VS Code** (174–181), **Discard step** (182–187), também com a sessão pausada | Sai: a pílula, a barra `step_review`/`step_empty` (também pausada) e o `⋯` |
| `PRBar.tsx` (86–274) | `#N` com o estado, o estado da PR, `Couldn't confirm the merge` em `done` e `trouble` (178–183), **Open PR** do rascunho (192–197), **Approve**, **Close task** em `done`, `trouble`, `merged` com `canClose` (64, 209–218), **Open in VS Code**, **Pause**/**Resume** da PR (230–242), `⋯` com **Review again**, **Discard draft** (também em `drafting`), **Refresh PR** (244–271) | Sai: a pílula, a barra (com `Couldn't confirm the merge` e **Close task** em `merge` e `pr_trouble`), o `⋯` (com **Discard draft** antes da abertura), **Pause** no topo |
| `PRPane.tsx` (81–194, 283–348) | As notas com **Review again**, **Refresh PR** e **Close task** | Fica até a task 4, sem os botões (§4.2) |
| `DraftCard.tsx` (21–87) | O rascunho editável com **Open PR** (76–81) | Fica até a task 4; **Open PR** só em `awaiting_reply` com `draftAtHand` |
| `StatusBadge.tsx` | O estado da task no topo, `role="status"` | Sai |
| `StepTabs.tsx` (19–96) | Abas com `ToneDot` e o rótulo da situação, piscada `attention-flash` (83) | Sai: `AgentTabs` |
| `ReviewStrip.tsx` (90–172) | Progresso de stage, lista de arquivos, `myspec.review.expanded` | Fica até a task 4 (§3) |
| `ArtifactPanel.tsx` (156–316) | Abas PRD/Tech spec/Steps/PR, `StepList` com os seletores e os relatórios, arquivos da PR | Sai: `ArtifactsPanel` (documentos) e `DetailsPanel` (steps, relatórios) |
| `StepList.tsx` (180–237), `ProblemList` (23) | A lista de steps, com os relatórios de todo step (226–231); os problemas do plano | Fica para `ArchivedTaskView` e `PlanProblemsNotice` até as tasks 11 e 4 |
| `OneShotView.tsx` | O documento One-Shot com os relatórios | Fica para `ArchivedTaskView`; `ArtifactsPanel` não o usa |
| `TaskModels.tsx` (48–81), `TaskReviewMode.tsx` (23–62) | Os botões e popovers do topo | Saem: `ModelsPopover` e `ReviewModePopover` |
| `ContextGauge.tsx` | Anel com âmbar a 70% e vermelho a 90% | Fica no review e na discussão (tasks 6 e 9); a task usa `ContextMeter` |
| `stage-actions.ts` (1–100), `StageActionDialog.tsx` (35–72) | Os textos e o diálogo de voltar e descartar | Ficam; `task-menu.ts` monta os itens |
| `DeleteTaskDialog.tsx`, `DiscardStepDialog.tsx` | Os diálogos | Ficam até a task 11; o gatilho passa ao `⋯` e à barra |
| `StepPane.tsx` (50–95), `StepBlocked`, `PRBlocked`, `PlanProblemsNotice`, `ImplementationDone`, `OrphanPRs` | A área da conversa por etapa | Ficam até a task 4; `StepPane` perde `StepTabs` e `ReviewStrip`, que sobem a `TaskView` |
| `step-status.ts`, `pr-status.ts`, `status.ts`, `StatusDot.tsx` | Rótulos, tons e regras | Ficam; os leitores de fora (`board`, `reviews`, `discussion`) continuam |
| `useArtifact.ts`, `StepDocument.tsx` | Leitura de artefato | Ficam; `ArtifactsPanel` e `DetailsPanel` os usam |

### 5.2 Outros arquivos

| Arquivo | Hoje | Muda |
|---|---|---|
| `components/system/PlaceHeader.tsx` | Título (`<h1>`, 154) e a direita com `ml-auto` | O espaço `progress` depois do título; o título `flex: 0 1 auto` |
| `components/system/AuxPanel.tsx` | `PanelGroup` (tooltip do nome e da descrição, 28), `PanelLayout` com a saída animada, `AuxPanel` | O cabeçalho de volta dentro do painel (`← Details`) é do conteúdo, não do componente |
| `components/system/icons.ts` | Registro | Os ícones da §4.2 |
| `components/PauseButton.tsx` (16–32) | **Pause**/**Resume** com a cedência | `loading`, `disabledReason`, `pausedSince`; review e discussão continuam passando o que passam |
| `components/CardLink.tsx` | Link do card | Sai do topo da task; fica em `ReviewHeader`, `ArchivedTaskView`, `ArchivedReviewView` |
| `store/app-store.ts` | `PanelId` (71–72), `StepTab` (82), `panel` (147), `openStepTab` (162), `withStepTab` (357–366), `openStepTabOf` (1105–1113), `onScreenSituation` (1122–) | `PanelId` com `details` e `card`; `earlierConversation`; `onScreenSituation` nula com a conversa anterior aberta |
| `store/actions.ts` | `setStepReviewMode` (287), `loadTranscript` (345) | `followTaskReviewMode`; `loadTranscript` com o erro no lugar |
| `store/transcript.ts` (4–13) | `status` `loading`/`ready` | `error` |
| `app/useGlobalShortcuts.ts` (19–105) | `Ctrl+N/J/,`, `Alt+←/→`, `Esc` | `Ctrl+E`; o `Esc` da conversa anterior |
| `features/sidebar/sidebar-tree.ts` (408–411, 532–545) | `Ready to close · PR #P merged` na forma `close`; `PR review · waiting for checks` depois da primeira leitura | `Ready to close · PR #P` sem o merge confirmado; `PR review · checks a/b` |
| `features/sidebar/TreeRow.tsx:110`, `SidebarRail.tsx:142`, `TreeNodeRow.tsx:201` | A classe `tree-flash` | `situation-flash` |
| `features/chat/Conversation.tsx` | A conversa | `readOnly` |
| `lib/boards.ts:44`, `features/board/BoardHeader.tsx:32`, `features/reviews/ReviewsHeader.tsx:24` | `relativeTime` (`4 min ago`) | `lib/when.ts` (`4m ago`) |
| `styles/globals.css` (287–296, 349–358, 361–379, 424–429) | `attention-flash`, `.tree-flash` | Sai `attention-flash`; `.tree-flash` vira `.situation-flash` |
| `design/system/tokens.css` | Os tokens | `--size-popover: 22rem` |

Leitores do que muda: `ReviewStrip` também em `reviews/ReviewView.tsx`; `ContextGauge` e `PauseButton` em `reviews/ReviewHeader.tsx:57` e `discussion/DiscussionHeader.tsx`; `ModelPicker` em `chat/Composer.tsx`, `task-create/NewTaskDialog.tsx`, `settings/Defaults.tsx`, `reviews/StartReviewDialog.tsx`, `discussion/NewDiscussionDialog.tsx`; `ReviewModePicker` em `NewTaskDialog.tsx` e `Defaults.tsx`; `StepList` e `OneShotView` em `history/ArchivedTaskView.tsx`. São 27 arquivos de teste em `features/task`; saem os de `StageTrack`, `StepBar`, `PRBar`, `StatusBadge`, `StepTabs`, `TaskModels`, `ArtifactPanel` e os dois de `TaskHeader`, e nascem os dos componentes novos no mesmo step.

### 5.3 DTOs: o que existe e o que falta

| Dado | Existe | Falta, e onde nasce no Go |
|---|---|---|
| A etapa, o modo, a revisita, `canContinue`, os steps com `status`, `reviewPass`, `reviewRound`, `reviewMode`, `reviewFallback`, `commitFailed`, `reports`, `reviewer`, `worktreePath`, `commitSha`, `commitSubject`, `model`, `adjusted`, `modelEditable`, `reviewModeAdjusted`, `reviewModeEditable` | `TaskSummary` e `Step` (`dto.go:147–187, 393–447`) | — (F3 é derivado) |
| A PR: `status`, `prNumber`, `prUrl`, `prState`, `prBase`, `baseBranch`, `branch`, `worktreePath`, `checkedAt`, `checkError`, `trouble`, `canClose`, `draft`, `reports`, `review`, `sessionStage` | `PullRequest` (`dto.go:267–326`) | — |
| O card da task e o do board | `TaskCard` (`dto.go:857–867`), `BoardCard` (831–854), `CardPullRequest` sem título (796–801) | — |
| **P4** desde quando pausada | — | `sessions.paused_at` → `Record` → `Summary` → `pausedAt` nos cinco blocos |
| **P12** a hora do commit do step | — | `git log --format=%cI` → `steps.committed_at` → `StepState.CommittedAt` → `Step.committedAt` |
| **P13** os checks pelo nome | só `trouble.failedChecks` | `gh.CheckNode` com as horas e o `status` guardado → `pr_runs.checks` → `flow.PullRequest` → `PullRequest.checks`, `mergeable` |
| **P42** a conversa de uma sessão fechada | `GetTranscript` (`bindings/task_service.go:245–263`) devolve vazio: `session.Service.Transcript` (`session/service.go:928–943`) só lê as sessões abertas, e uma etapa ou um step encerrado fecha a dele (`flow/service.go:137`, `flow/step.go:638–641`) | `Transcript` lê do banco a sessão fechada (`SessionsRepo.Get` e `EntriesRepo.List`, `store/entries.go:16`), somente leitura, sem abri-la. `session.Service.Discard` apaga a linha (`session/service.go:498–513`), então uma conversa descartada some de `Details` |
| **P43** as conversas da task, com o início | — | `conversations: [{ stage, startedAt }]` no `TaskSummary`, dos registros de sessão da task (`sessions.created_at`); a lista traz também a sessão fechada da etapa atual quando ela não está na tela (a PR em `done`), que `Details` abre como anterior. O tech spec escolhe entre ler do banco a cada snapshot e manter o índice na memória, com a recomendação da memória |
| **P44** desfazer o modo próprio de um step | `SetStepReviewMode` só grava (`flow/step_review.go:346–366`, `task/service.go:622–635`) | `ClearStepReviewMode`, que apaga a entrada do step, com a mesma guarda de "não iniciado" |
| **P45** branch, base e worktree da task na implementação | só na PR (`PullRequest.branch`, `baseBranch`) e o caminho no step | `branch`, `baseBranch`, `worktreePath` no `TaskSummary`, da tabela de worktrees do item (`store/migrations/0015_items.sql:69–82`, com `base` desde `0013_task_repository.sql:40–50`), `""` antes de a worktree existir |

## 6. Riscos e o primeiro step

| Risco | Tratamento |
|---|---|
| **O topo é grande** (stepper, `⋯`, popovers, barra, saída de quatro componentes) | As funções puras no step 4, os componentes no 5 e os popovers no 6; o topo em três steps (7: o `⋯` e as barras do step e da etapa; 8: o stepper, a cedência, o medidor e **Pause**; 9: a PR) |
| **Coluna de 960 px sobre a conversa de 936 px** até a task 4 | As abas e a barra usam a medida nova; a conversa e o compositor ficam com a velha. A diferença é de 12 px de cada lado; as capturas a registram, e a task 4 unifica |
| **A barra da task pausada deriva do estado, não das situações** | `request.ts` testa as duas fontes na mesma tabela: cada situação e o estado pausado que a daria, menos `ready_to_continue`, que pausada não existe; uma diferença entre elas é um teste que falha |
| **A conversa fechada relida do banco** enquanto um **Back to** a reabre ou a apaga | `Transcript` de uma sessão fechada é uma leitura sem estado; se a sessão some, a linha de `Details` some com o snapshot seguinte e a conversa anterior fecha, voltando à atual |
| **P13 depende do que o `gh` devolve** | O primeiro teste do step 2 é o parser com as respostas reais do `gh` gravadas no `ghtest`; sem as horas, a duração é `—` e nada mais muda |
| **Duas escolhas de modelo convivendo** (`ModelChip` na task, `ModelPicker` no resto) | Áreas diferentes; a task 12 confere que nenhum leitor de `ModelPicker` sobrou |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria; a tabela de cenas (pronto 4) nasce no step 8 e cresce nos seguintes |

**Como o primeiro step é feito.** É P4 e P12, só em Go: a migration com `sessions.paused_at` e `steps.committed_at`, a pausa que grava e limpa a hora (testes em `internal/session` com os fakes: pausar, retomar, reiniciar com a sessão pausada), o `git log` com `%cI` testado num repositório temporário, `SetStepCommitted` com a hora, e os DTOs com `convert_test.go`, `task generate`, `lib/wails.ts` e `test/wails-mock.ts`; `storage.md` com as duas colunas. Nada na tela muda.

## 7. Documentação que a task atualiza

Cada linha é escrita no step da área (§8), e o último step confere o todo.

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/storage.md` §Banco | `sessions.paused_at`, `steps.committed_at`; `pr_runs.checks` | 1; 2 |
| `docs/architecture/sessions.md` §Ciclo de vida do processo | A conversa de uma sessão fechada é lida do banco, somente leitura; a hora da pausa | 3 |
| `docs/architecture/design-system.md` §Componentes | `Stepper`, `Pill`, `Popover`, `Tabs`, `ChecksList`, `RelationList` e os ícones, na tabela e na suíte de estilo | 5 |
| `docs/product/features.md` §Voltar e descartar (354–363) | O stepper sem ações; **Back to …** e **Discard and restart …** no `⋯`, os mesmos de hoje; **Continue** na barra | 7 |
| §Review (402–406), §Aprovação e commit (408–414), §Review pelo agente (416–438), §Descartar step (440–442) | A faixa de review sob as abas; **Approve** e o progresso na barra do pedido, também com a task pausada; **Review myself**, **Open in VS Code** e **Discard step** no `⋯` | 7 |
| §Atalhos (727–742) | `Ctrl+E`; `←` `→` nas abas; `Esc` na conversa anterior e a ordem | 7, 10, 12 |
| §Cabeçalho do lugar (710–725), §Sessões e conversas (643–657) | A direita da task: stepper, medidor, **Pause**, **Details**/**Artifacts**/**Card**, `⋯`, a cedência inteira; **Pause** sem diálogo, `Pausing…`, desabilitado com a razão, a hora no tooltip; a barra com a task pausada | 8 |
| §Pull request (444–456), §Rascunho e abertura, §Review de pull request (458–474), §Encerramento (476–486), §Depende de mim (671) | Sem a barra da PR: a pílula, a barra do pedido, o `⋯` da PR (com **Discard draft** antes da abertura e **Review again** a qualquer momento), os checks pelo nome na árvore; "na trilha de etapas, na barra do step… e na barra da pull request" passa a "no stepper, nas abas e na barra do pedido" | 9 |
| §Review pelo agente (436) | As abas com `waits` e `error` | 10 |
| §Modo de review (389–400), §Modelos e esforço (679–686), §Planejamento One-Shot (346–352), §Etapas de planejamento (344) | Os popovers pelo `⋯` e por `Details`; a lista de steps em `Details`, com os relatórios e **Follow the task**; `Artifacts` só com os documentos, `One-Shot document` | 11 |
| §Sessões e conversas (649) | As conversas anteriores em `Details`, somente leitura | 12 |
| §A partir de um card (332) | O card no painel **Card**, não no topo | 13 |
| `docs/architecture/overview.md` §O estado que o frontend vê, §Store | Os campos novos do resumo da task; `earlierConversation`, `PanelId` | 3, 12 |
| `docs/guidelines/frontend.md` §Componentes | As peças da tela da task em `features/task`, a pílula e o stepper em `components/system` | 13 |

## 8. Plano de steps sugerido

Treze steps, dentro de G (9 a 14), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma nova que um step seguinte troque: o que ainda não mudou fica com a forma de hoje.

1. **P4 e P12.** As colunas, a pausa com a hora, o commit com a hora, os DTOs e os mocks. Testes Go; nada na tela.
2. **P13.** Os checks pelo nome no `gh` (o `status` guardado, as horas), no `flow`, na coluna e no DTO; a linha da árvore com `PR review · checks a/b`, com os testes de `sidebar-tree.ts`.
3. **P42 a P45.** A conversa fechada legível, a lista de conversas, `ClearStepReviewMode`, a worktree da task; DTOs, `actions.ts` (`followTaskReviewMode`), `TranscriptState` com `error`.
4. **As funções puras.** `stepper.ts`, `agent-tabs.ts`, `task-menu.ts`, `request.ts` (com a task pausada), `details.ts`, `lib/when.ts` com os dois leitores de `relativeTime` passados a ele, e os checks em `lib/pull-requests.ts`, testados em tabela contra a §4.2.
5. **Os componentes do system.** `Stepper`, `Pill`, `Popover` com `--size-popover`, `Tabs`, `ChecksList`, `RelationList`, os ícones; testes de componente e de estilo computado nos dois temas.
6. **Os popovers e os chips.** `ReviewModePopover`, `ModelsPopover`, `ModelChip`, `StepModeChip`, com os testes, sem ligação na tela.
7. **O `⋯` e a barra do step e da etapa.** `TaskMenu` com os grupos do step, do planejamento e da task, os diálogos de hoje e os popovers ancorados nele; `Ctrl+E`; a barra de `step_review`, `step_empty` e `ready_to_continue`, as duas primeiras também com a task pausada. Saem `StageTrack` e `StepBar`.
8. **O topo.** `TaskHeader` com o stepper e a cedência, `ContextMeter`, **Pause** com os estados. Saem `StatusBadge`, os botões `Review: <modo>` e **Models**, a lixeira e `TaskModels`/`TaskReviewMode`. A tabela das cenas e os testes pintados das larguras e das cenas, com as capturas.
9. **A PR.** O grupo `Pull request` do `⋯`, a barra de `draft`, `changes_review`, `merge` e `pr_trouble` pela forma e pelo estado, e de `pr_closed`; **Pause** da sessão da PR no topo; as notas de `PRPane` sem os botões e o **Open PR** de `DraftCard` só em `awaiting_reply` com `draftAtHand`; a linha `Ready to close` da árvore pelo merge confirmado. Sai `PRBar`.
10. **As abas.** `AgentTabs` com a regra da aba, o teclado, a palavra, o tooltip e a piscada; `.tree-flash` vira `.situation-flash`; `ReviewStrip` sobe a `TaskView` sob as abas. Saem `StepTabs` e as regras `attention-flash`.
11. **`Details` e `Artifacts`.** `DetailsPanel` com Steps (ou Implementation), Pull request e Task: os seletores do step, os relatórios (também do step atual) abertos no lugar, `ChecksList`, os botões de Review mode e Models; sem as linhas de conversa. `ArtifactsPanel` só com os documentos; o grupo de painéis com os dois. Sai `ArtifactPanel`.
12. **A conversa anterior.** As linhas de conversa em Steps, Implementation e Pull request, o grupo Planning, `earlierConversation`, `Conversation` somente leitura, a faixa, o carregando, o foco, o `Esc`, o painel que cobre.
13. **`Card`.** `CardPanel` com `RelationList` e os estados; o botão **Card** no grupo; `CardLink` sai do topo da task. As capturas finais das nove cenas e das larguras; a conferência de `docs/` contra o que a task fez.

Depois do step 13, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.

## 9. Para o usuário confirmar

| Mudança | Onde | Recomendação |
|---|---|---|
| Um step com modo de review próprio volta a seguir o da task por **Follow the task**, no seletor do step em `Details`. Hoje o modo próprio não se desfaz: escolher o mesmo modo da task ainda o deixa próprio | `changes.md` T5 (marcada "a confirmar pelo usuário"); `backend.md` P44 | Confirmar: está no mock aprovado (`b.html:2375`), custa uma função no Go e desfaz um estado que hoje não tem saída. Sem ela, o `listbox` do modo fica só com `Agent` e `Manual`, e P44 sai da task |
