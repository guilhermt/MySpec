# Task 5 · Home, board e criação de task

Material de entrada da quinta task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 5 de `design/implementation.md` (§2, linhas 91–101), com os princípios da §1 (9–22) e os riscos da §3 (185–197). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** A task parte da `main` em `1894f3e` (tasks 1, 2 e 3 mergeadas, com as correções). As linhas de código citadas são as desse commit; as de `design/` são as da `main` depois deste material. A task depende só da task 2 (lugares, painel auxiliar, cabeçalho de lugar) e corre em paralelo com a task 4, que começa agora: onde as duas se tocam e a ordem de merge estão na §6. A task não cria migration (a da task 4 é a `0020`).

Toda decisão de design está tomada neste documento, em `design/screens/board.md`, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; as decisões de produto que a task abria estão em `decisions.md` (2026-09-28, "Board: o que a entrada da task 5 decidiu") e na §9.

**Nenhum comportamento de hoje se perde.** Cada controle das telas que saem tem um lugar novo, dito na §4.2 e provado pelo pronto 7: do cabeçalho do board, **Refresh**, **Open on GitHub**, **New discussion** e a falha da leitura; da barra de filtros, a busca, **Repository**, **Status**, **Assignee**, **Assigned to me** e **Clear filters**; da seleção, a caixa de cada linha, **Discuss selected** e **Clear selection**; da linha, o repositório e os avatares; do detalhe, **Close card**, **Open on GitHub**, **Start task**, **Discuss**, **Clone and continue**, **Change path**, **Add to board**, o botão da task ativa, `Archived: <nome>` e o irmão que seleciona o card; da Home, **New task**; do diálogo de criação, o seletor de repositório com **Clone**, **Context from the card**, `Additional context`, **Mode**, **Review mode** e **Models**. As mudanças de comportamento são as de `changes.md` B1–B13.

**Vocabulário.** "Lista" é a lista de cards da visão do board (o `tree`); "linha" é a linha de um card nela; "seção" é o grupo de um status; "painel" é o painel do card na visão do board (o painel da lista de `components.md`), e "painel `Card`" é o da tela da task (task 3); "leitura" é a última leitura guardada do board (`Board.cards`); "card fora da leitura" é o card aberto que a leitura nova não traz; "aviso de tecla" é o componente de `components.md:110`; "diálogo livre" e "diálogo de card" são o diálogo de criação aberto sem e com um card.

## 1. Objetivo e critério de pronto

A Home vira o lugar de retomar e começar (**Continue**, **Start**, **Boards**, os atalhos); a visão do board agrupa os cards pelas seções de status, com a linha mínima em grade de colunas e o card num painel ao lado da lista; a seleção de cards vira um modo; o diálogo de criação fica com poucos campos, o contexto e os modelos a um clique. Do Go, a task pede a discussão que escreveu cada card (P22) e uma frase a mais no erro de uma criação desfeita (P22b).

**Pronto quando** (`implementation.md:101`), cada item provado como diz:

1. **As cenas.** As fixtures de `test/board-scenes.ts` reproduzem `lab/11-screen-board/src/data.js` (o board `Platform Roadmap` com 120 cards em 10 status, 46 linhas visíveis com as finais recolhidas, os épicos `API hardening` e `Usage-based billing`, as tasks `t1`, `t3`, `t7`, `t8`, a discussão ativa `Usage-based pricing tiers` com #455 e #461 de entrada, a discussão arquivada `Usage alerts` como autora de #474 (`writtenBy` arquivada: a linha de #474 continua sem `In discussion`, o painel mostra `From the discussion Usage alerts` e a linha do contexto a cita), as dependências de #471 e #474, os corpos de #471 e #474; os boards `Internal Tools` sem issues e `Mobile App` com 31 cards abertos fora dos status finais e a leitura falha), com o relógio fixo às 14:10 de 2026-09-24 e as horas coerentes em cada cena: `Platform Roadmap` lido às 14:08, salvo na cena `failed`, em que a leitura guardada é das 12:10 e a falha das 14:06 (`Read 2h ago` e a faixa `· 4m ago`); `Mobile App` lido às 11:30 e falho às 13:52 (`◇ Read failed 18m ago`); `Internal Tools` lido em 2026-09-23 às 12:00 (`Read 1d ago`). Três testes pintados (Chromium, claro e escuro) montam as treze cenas de `board.md` §5 e `?home=none`: `features/home/Home.scenes.painted.test.tsx` (`home`, `home-disc`, `home=none`), `features/board/BoardView.scenes.painted.test.tsx` (`board`, `card`, `reading`, `failed`, `empty`, `filtered`, `stale-card`, `no-clone`, `select`) e `features/task-create/NewTaskDialog.scenes.painted.test.tsx` (`create`, `create-card`), cada cena a 2180 px de área principal (o monitor inteiro) e a 978 px (a metade), e `card` também a 950 px (a janela de 1250) e a 812 px (a de 1100). Em cada uma, o teste confere: toda linha, cabeçalho de seção, barra, faixa, painel, diálogo, **Continue** e linha da Home em pixel inteiro; o título de cada linha com ao menos um terço dela; a coluna das teclas dentro da sua largura; todo texto cortado com tooltip; no máximo uma primária. Grava as capturas, anexadas ao pull request lado a lado com o mock (`python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090, que é a do coordenador; `11-screen-board/a.html?scene=…`).
2. **As larguras** (`card` a 950 e a 812 px): as linhas de #474 e #412 têm duas linhas, com `Usage-based billing` e `◇ #461` sob a primeira e `API hardening` e `● Question · Step 3/7` sob a segunda, inteiras; a 812 px o painel fica ao lado e o contêiner da lista tem 452 px; a 790 px o painel cobre a lista. A 1041 px de contêiner a linha é uma só, e a 1040 px, duas.
3. **O teclado** (`features/board/BoardView.keys.test.tsx`, jsdom): `↑` `↓` `Home` `End` pelas linhas e cabeçalhos visíveis; `←` `→` e `Enter` nas seções; `Enter` abre e fecha o card; `S` e `D` em cada ação de card e os avisos de tecla com os textos da §4.2; `Space` que entra no modo e alterna; `N`; `/` e `↓` da busca; a ordem de `Esc`; a uma parada de Tab da lista; `Ctrl+Enter` nos dois diálogos; `←` `→` no controle segmentado; `Enter` na Home abre **Continue** no lugar da situação.
4. **A memória.** Filtros e seções recolhidas lembrados por board entre execuções, com o filtro órfão e o que foi guardado na forma de hoje (`useBoardViewMemory.test.ts`).
5. **Uma leitura nunca apaga a lista**: um teste por linha da tabela de `board.md` §3.8 e da §4.2 (Leitura e falhas), e o card fora da leitura que fica aberto com a faixa.
6. **As funções puras** testadas em tabela (§4.4, Onde moram): as linhas, o nome acessível da linha, a coluna da task, o progresso do épico, `In discussion`, os avisos de tecla, os chips e a frase do filtro sem resultado, o modelo do painel por ação, a linha do contexto com os plurais, o resumo dos modelos, a razão do **Create**, o item de **Continue**, as linhas da Home, as opções do campo **Board**.
7. **Onde foram as ações.** `features/board/where-actions-went.test.tsx` tem uma linha por controle da lista do terceiro parágrafo e por estado em que ele aparece hoje; nenhuma fica sem lugar. Em cada caso do painel (§4.2, As ações do card), no modo de seleção e no diálogo, a tela tem no máximo uma primária.
8. **O Go** (P22, P22b): testes de `discussion.Service.CardWriters` (a publicação mais recente vence, uma discussão arquivada conta, uma apagada não, uma publicação em curso conta) e de que `DocumentOfCard` continua escolhendo a mesma discussão; `convert_test.go` com `writtenBy`; `task generate`, `lib/wails.ts` e `test/wails-mock.ts`; o teste de `CreateTask` em que `StartTask` falha e a mensagem termina em ` The task was undone.`, e em que o apagamento também falha e ela não termina.
9. **A Home no lugar do primeiro board** (B1): sem item ativo, a Home mostra `Nothing in progress`; nenhum caminho leva mais da Home ao primeiro board (`lib/locations.test.ts`, `store/app-store.test.ts`).
10. **A medição da lista** (§6): o script rodado pelo implementador no app, na máquina alvo, com o resultado registrado em `implementation.md` (task 12); não é teste da suíte.
11. **Os tokens.** `--col-keys` 120 px, `--col-dep` 72 px e `--size-dialog-wide` 576 px em `design/system/tokens.css`, pela pull request desta task (step 3), com a prova pintada nova da coluna das chaves de `Details` (`features/task/DetailsPanel.painted.test.tsx`, §6).
12. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
13. **Documentação** da §7 escrita no step de cada área; `features.md` §Visão do board, §Start task, §Leitura dos cards, §Falhas, §Criação de uma task, §A partir de um card, §Criar uma discussão, §Tela de boas-vindas e barra lateral e §Atalhos reescritos.
14. **Revisão do `design-critic`** na branch contra este material, `board.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).

`changes.md`: B1–B13. `backend.md`: P22, P22b, P23; F7–F13.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 5 (91–101), task 12 (175–183), riscos (185–197) | O escopo, o app sempre usável (15), os testes que migram (22), a virtualização que pode ir para a 12 |
| 2 | `design/decisions.md`: a task 5 em paralelo com a 4 (5–7); Board, o que a entrada da task 5 decidiu (9–11); Board por status (41–43); Papéis do azul (57–59) | O que o usuário aprovou e o que o coordenador decidiu por delegação |
| 3 | `design/screens/board.md` inteiro, com o bloco "Onde o mock difere deste documento" (7–17) | A Home (28–83), a visão (84–252), a criação (253–340), as cenas (341–360), os estados (361–373), os atalhos (374–397), a acessibilidade (398–404) |
| 4 | `design/structure.md` §1 Home (24–30), §4 Board (338), §5 (343–381), §6 (383–398), §7 (400–423) | A regra geral dos lugares, das listas e das larguras |
| 5 | `design/principles.md` 2 (13–33), 7 (67–73), 8 (75–87), 9 (89–95), 10 (97–103) | A primária única, o movimento, a tecla escrita, o pixel inteiro |
| 6 | `design/system/components.md`: estados comuns (18–28), Ícones (78–87), Tooltip (99–108), Aviso de tecla (110–118), Botão (161–174), Chip (176–187), Input e busca (200–211), Select, menu e listbox (213–225), Menu do item (227–236), Caixa de seleção (238–246), Controle segmentado (258–271), Linha de modelo (282–291), Cabeçalho do lugar (302–311), Idade da leitura (313–319), Painel auxiliar (379–392), Estado vazio de página (402–409), Esqueleto (420–426), Faixa de aviso (428–437), Linha afundada (439–446), Linha de lista (698–710), Cabeçalho de seção (712–721), Barra de filtros (723–734), Barra da seleção (736–743), Bloco do item (745–750), Aviso de dependência (752–757), Lista de relações (759–764), Continue e linha de início (766–774), Diálogo (776–788), Tamanhos de layout | Anatomia, estados, teclado e acessibilidade de cada peça |
| 7 | `design/system/tokens.css`: medidas (53–57), tamanhos (70–75), listas e diálogos (95–111), movimento (118–123) | `--list-measure`, `--panel-card-width`, `--size-dialog-wide`, `--col-*` |
| 8 | `design/changes.md` B1–B13 (57–69); `design/backend.md` P22, P22b, P23 (77–79), F7–F13 (114–120) | O que muda de comportamento e os dados |
| 9 | `design/research/board.md` §1 (5–171), §2 (173–235), §3 (237–273), §4 (275–312) | O produto de hoje campo a campo e o volume real |
| 10 | Mocks, com `python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090: `11-screen-board/a.html` (`?scene=` com as treze cenas, `?home=none`, `?audit`) e as fontes `src/shell.js` (o estado das cenas 27–42, as colunas `COLS` 103–125, `rowLabel` 126–135, `cardRow` 137–147, as ações 149–164, as notas e o bloco 165–176, os campos e as relações 177–196, o cabeçalho e o `⋯` 205–225, o menu **Filter** 226–234, a barra 235–257, a visão 258–269, a Home 270–294, o diálogo 296–348, o diálogo de discussão 349–369, o teclado 493–539), `src/a.js` (a lista e o painel), `src/data.js` (os dados), `src/board.css` (as medidas); `11-screen-board/components.html` | A referência visual. Onde o mock e este material divergem, vale o material (§4.3 #20, `implementation.md:18`) |
| 11 | `docs/product/features.md` (na base) §Leitura dos cards (46–61), §Falhas (63–72), §Visão do board (74–88), §Start task (90–104), §Criar uma discussão (112–128), §Contexto da task (211–213), §Tela de boas-vindas e barra lateral (264–296), §Criação de uma task (304–315), §A partir de um card (317–332), §Modelos e esforço (683–690), §Atalhos (759–791) | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 12 | `docs/guidelines/README.md`, `frontend.md`, `testing.md`; `docs/architecture/design-system.md` §Componentes; `docs/architecture/overview.md` §O estado que o frontend vê, §Store, §Features | Como um step acontece |
| 13 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go** (P22, P22b): a discussão que escreveu cada card, no `BoardCard`; DTO, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`; a frase ` The task was undone.` no erro de uma criação desfeita (`internal/bindings/task_service.go:173–178`).
2. **`features/home`** inteiro: **Continue**, **Start**, **Boards** com as linhas do que bloqueia, os atalhos, `Nothing in progress`; o fim do primeiro board no lugar da Home (B1).
3. **O campo Board** do diálogo de discussão, aberto da Home e do menu **+ New** fora de um lugar com board (B2), com o resto do diálogo como está.
4. **`features/board`** inteiro: o cabeçalho, a faixa da falha, a barra de filtros, as seções, a linha, o modo de seleção, o painel do card com as ações por caso, o card fora da leitura, os avisos de tecla, os vazios, o teclado, a memória por board; **Add to board** no diálogo do sistema.
5. **`features/task-create`** inteiro: o diálogo largo, o card no topo ou o seletor de repositório, **Name**, o contexto, as dependências, **Mode** e **Review mode**, **Models**, o rodapé.
6. **O painel `Card` da task** (B13): as relações que são cards do board abrem o card na visão do board.
7. **`components/system/`**: linha de lista, cabeçalho de seção, barra de filtros, barra da seleção, painel da lista, bloco do item, aviso de dependência, aviso de tecla, **Continue** e linha de início (com a linha de board), o sinal da caixa de seleção, a variante de card do board da lista de relações, o item desabilitado com ação do menu, os ícones de listas.
8. **A medição da lista** e a decisão registrada (§6).
9. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| O diálogo de discussão inteiro: o bloco do board fixo, **Title**, **What to discuss**, os cards, o contexto, o aviso de clone, **Model** (`discussion.md` §2) | 9 | O de hoje, `features/discussion/NewDiscussionDialog.tsx` na casca do shadcn, retematizado; ganha só o campo **Board** no alto, já no `Select` do system, quando pedido (§4.2). É a única peça nova dentro de um diálogo antigo, dito aqui para o crítico |
| Settings › Boards, o diálogo de board e a linha de repositório dele (`RepositoryLinkRow`) | 10 | Os de hoje. **Edit the board in Settings…** leva à página de hoje. **Add to board** passa ao `Dialog` do system com o corpo de hoje (`RepositoryLinkRow`), que a task 10 refaz com a do diálogo de board |
| O seletor de modo e de modelo dos steps em `Details`, `ModelPicker` e `ReviewModePicker` fora do diálogo de criação | 10 e 12 | Os de hoje: continuam usados por `StepList`, `Defaults`, `StartReviewDialog` e o diálogo de discussão |
| `components/FilterMenu.tsx` e `MultiFilterMenu` | 6 | Continuam em Reviews |
| A remoção de `react-resizable-panels` e de `components/ui/resizable` | 12 | Sem usuário depois do step 7 (a visão do board era o único), removidos na 12 |
| A virtualização da lista | 12, se a medição pedir | Sem virtualização (§6) |
| A tela de boas-vindas (nada cadastrado) | 10 | A de hoje |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| A lista agrupada pelas seções de status do board, na ordem dele, as finais recolhidas; o card num painel ao lado da lista | `decisions.md:41–43`; `board.md` §3.4, §3.5 |
| A linha mostra só o que decide a escolha: número, título, épico, dependência não satisfeita, a task ou a discussão; o repositório, os responsáveis e o status saem da linha | `board.md` §1, §3.4; `changes.md` B6 |
| O cabeçalho sem **Start task**; **New discussion** `N` sem cards; a seleção só num modo | `board.md` §3.2, §3.6; `changes.md` B3, B5 |
| **Start task** `S` é a única primária da visão; cada caso do card tem a sua forma | `board.md` §3.6; `principles.md` 2 |
| Uma leitura nunca apaga a lista; a falha é faixa neutra, nunca situação | `board.md` §3.8; `structure.md` §7 |
| A Home mínima: **Continue**, **Start**, **Boards**, atalhos; não repete o que a árvore diz | `board.md` §1, §2; `changes.md` B1 |
| O diálogo com poucos campos, o contexto e os modelos a um clique, **Mode** e **Review mode** no mesmo controle | `board.md` §4; `changes.md` B11 |
| O painel `Card` da task abre o card do board | `task.md:291`; `changes.md` B13 |

### 4.2 Decisões de design, detalhadas

#### A Home

**O lugar** (`board.md` §2.1). O cabeçalho do lugar com `←`, `→` quando há destino, e o título `Home`. O corpo é uma área que rola; dentro, a coluna de `--measure-read` centrada com `round(down, …, 1px)`, `--space-6` dos lados, `--space-16` + `--space-8` no topo, `--space-12` no pé e `--space-8` entre as seções. Cada seção tem o título em `--text-caps` 700 `--ink-3` com `--tracking-caps` (`Continue`, `Start`, `Boards`), `--space-2` acima do conteúdo.

**Continue** (`components.md` Continue). O item é o primeiro item ativo que ainda existe entre o lugar na tela e os lugares atrás dele (a pilha `back`, do mais recente ao mais antigo); sem nenhum, `readLastItem()`; sem ele, o item ativo criado por último (`createdAt` de tasks, reviews e discussões). O botão:

- linha 1: o glifo de tipo do item (task, One-Shot, review, discussão) em `--brand-ink`, o nome em `--text-body` 600, cortado com tooltip, e a tecla `Enter` à direita, ocupando as duas linhas;
- linha 2, em `--text-meta`: o glifo e o texto da linha 2 da árvore na forma longa (`ItemRow.line2.long` de `features/sidebar/sidebar-tree.ts`, `● Question · Reviewer · Step 3/7`), o que fica na borda direita da linha da árvore (o chip de tempo, o relógio do turno em `--ink-3`, a palavra `GitHub` ou `idle`), e `· ` mais o breadcrumb do item em `--ink-3` (`Platform Roadmap / API hardening`, `No board`, `Reviews`), cortado com tooltip;
- nome acessível: `Continue: ` mais o nome da linha da árvore (`ItemRow.label`) e `. ` mais o breadcrumb;
- `Enter` e o clique abrem o item como `Ctrl+J`: com situação, `openSituation(itemId, place)` da mais grave, com o foco no que ela pede; sem situação, a ida comum ao item.

O foco começa em **Continue** quando o app abre na Home; sem **Continue**, na primeira linha de **Start**. Uma ida à Home por `←`, `Alt+←` ou `→` segue a regra de sempre (o botão ou o título). O item de **Continue** é derivado a cada estado: um item que sai dá lugar ao anterior, e sem nenhum a seção vira `Nothing in progress` (o estado vazio de página, título em `--text-ui` 600) com `No task, review or discussion is active. Start one from a card, a pull request or a board.`

**Start**, três linhas de início (o ícone em `--ink-3`, o rótulo em 500, o subtítulo em `--text-meta` `--ink-3` cortado com tooltip, a tecla à direita); o nome acessível é o rótulo, e o subtítulo a descrição (`aria-describedby`):

| Linha | Ícone | Subtítulo | Tecla | Faz | Desabilitada |
|---|---|---|---|---|---|
| **New task** | `plus` | `From scratch. A card starts its task on its board.` | `Ctrl N` | O diálogo livre | Nunca |
| **Review a pull request** | `review` | `N pending in M repositories` (`1 pending in 1 repository`), das pendentes que passam pelos filtros de Reviews (`reviewCenter.pendingCount` e os repositórios distintos das linhas com `pending` e sem `filtered`); `Nothing pending`; nunca lido, `Not read yet`; durante a primeira leitura, `reading…` com o brilho | — | Vai a Reviews | Nunca |
| **New discussion** | `discussion` | `About the demand of one board` | — | O diálogo de discussão, com o campo **Board** quando há mais de um board | Sem board: tracejada, com `Add a board to discuss its cards.`; com boards, mas nenhum lido: tracejada, com `The board hasn't been read yet.` (o mesmo no **New discussion** do **+ New**) |

**Boards**, uma linha de board por board, na ordem de `app.boards` (alfabética), e a linha **No board** por último, só com repositórios sem board:

- a linha: o ícone `board`, o título em 500, e em `--text-meta` `--ink-3` `46 open cards · api, billing, docs, gateway, web` (os cards com `state` aberto fora dos status finais, o que ainda se escolhe e o mesmo número das linhas visíveis com as finais recolhidas; num board sem campo de status, todos os abertos; `1 open card`; `No open cards`; os nomes curtos dos repositórios do board em ordem alfabética; nunca lido, `Not read yet · api, …`); à direita, em `--text-meta` `--ink-3`, `read 2m ago` (`age` de `lib/when.ts` sobre `readAt`), ou `◇ Read failed 18m ago` em `--ink-2` (sobre `failure.failedAt`), ou, num board nunca lido, `reading…`; durante qualquer leitura, esse texto brilha. O clique abre a visão do board. Nome: `Platform Roadmap, 46 open cards, read 2m ago`;
- sob ela, recuadas até o texto, as linhas do que bloqueia, em `--text-meta` `--ink-2`, cada uma com a ação fantasma `xs` à direita, nesta ordem: a falha (a mensagem de `features.md` §Falhas, sem `◇`, com **Try again**, que relê o board; lendo, **Try again** dá lugar a `Reading…` com o spinner, `role="status"`); por repositório do board, em ordem alfabética, sem clone (`◇ acme/billing isn't cloned. Its cards can't start a task yet.` com **Clone**; clonando, `Cloning acme/billing…` com o spinner no lugar de **Clone**; falhou, a mensagem do `gh` em `--state-error` e **Try again**), e clone inexistente (`◇ The clone at ~/code/infra is missing.` com **Change path…**; a recusa em `--state-error` sob a linha);
- **No board**: o ícone `repository`, `No board` em 500 e os nomes curtos, sem idade nem clique (`role="group"`, `Repositories without a board`), com as mesmas linhas de clone.

**Atalhos**: uma linha em `--text-meta` `--ink-3`, com `--space-5` entre os itens, cada um com a tecla (`Kbd`) e o texto: `Ctrl J` Next that needs you, `Ctrl N` New task, `Alt ←` Back, `Ctrl ,` Settings. Não são botões. Nome: `Shortcuts`.

**A árvore com a Home** é a da task 2 (`No active items.`, `No review in progress.`); nada muda nela.

#### O campo Board do diálogo de discussão (B2)

- **Quando aparece**: com mais de um board, ao abrir o diálogo pela Home, e pelo **New discussion** do menu **+ New** num lugar sem board (Home, Reviews, History, Settings, uma task de repositório sem board, um arquivado). Num lugar com board (a visão do board, uma task de um repositório com board, uma discussão), o board é fixo, como hoje (`features/sidebar/new-discussion-board.ts:11–24`). Com um board só, nunca.
- **Forma**: o primeiro campo, **Board**, o `Select` do system (`size="md"`, `variant="field"`), uma opção por board na ordem de `app.boards`, com o título e, como `sub`, `api, billing, docs · read 2m ago`, `◇ read failed 18m ago · uses the last reading` e, no board da última discussão criada (a de `createdAt` maior entre `discussions` e `discussionHistory`), `· last used` no fim. Um board nunca lido é uma opção desabilitada, com `not read yet` como razão (`SelectOption.disabled`, que o step 4 acrescenta ao `Select`). Sem última discussão, o primeiro board lido. A ajuda sob o campo: `The discussion reads the clones of the board's repositories and publishes its cards there.`
- **Com ele**, o bloco do board fixo de hoje não aparece; trocar o board mantém **Title** e **What to discuss** e refaz o que depende do board (o aviso dos repositórios sem clone, o contexto). O foco começa no campo **Board**.

#### A visão do board: o lugar e o cabeçalho

**Layout** (`board.md` §3.1). A área principal: o cabeçalho; embaixo, o corpo com a área que rola da lista (o contêiner das container queries da linha) e o painel, quando aberto. Dentro da área que rola, a coluna de `--list-measure` centrada com `round(down, …, 1px)`, `--space-6` dos lados e `--space-12` no pé; de cima para baixo, a faixa da falha, a barra de filtros ou a da seleção, e a lista.

**O cabeçalho** (`board.md` §3.2), da esquerda para a direita:

| Peça | Forma | Estados |
|---|---|---|
| `←`, `→`, título | Os do cabeçalho do lugar; sem breadcrumb | — |
| Idade da leitura | `Read 2m ago`, `Read just now`, `Read 3h ago`, `Read 2d ago` (`age` sobre `readAt`), `--text-micro` `--ink-4`, tooltip `Last read at 14:08` hoje, `Last read yesterday at 17:40` ontem e `Last read Sep 21 at 17:40` antes (a mesma forma na faixa do card fora da leitura), refeita a cada minuto | Lendo: `Reading…` com o spinner, `--ink-3`, `role="status"`. Nunca lido e sem leitura: nada. A última falhou: a idade da lista na tela |
| **Refresh** | Fantasma de ícone `refresh`, tooltip `Read the board again` | Lendo: tracejado, com `A reading is running.` |
| Divisor e **New discussion** `N` | Secundário `sm`, ícone `discussion`, tooltip `New discussion on Platform Roadmap, without cards · N` | Nunca lido: tracejado, com `The board hasn't been read yet.` |
| `⋯` | Fantasma de ícone, tooltip `Select cards, open on GitHub, edit the board` | — |

O `⋯`: **Select cards to discuss** `Space` (ícone `select`; tracejado `· the board hasn't been read yet` num board nunca lido, `· no card to select` quando nenhuma linha está visível, num board sem cards ou com o filtro sem resultado, e `· already selecting` no modo de seleção), **Open on GitHub** (seta externa, abre `board.url`), separador, **Edit the board in Settings…** (ícone `settings`), que abre Settings na página **Boards** (a de hoje; a task 10 decide o que ela mostra).

#### A faixa da falha e os estados da leitura

| Estado | Cabeçalho | Área da lista | Árvore |
|---|---|---|---|
| Lida | `Read 2m ago` | A barra e a lista | — |
| Lendo sobre a última | `Reading…`; **Refresh** tracejado | A barra e a lista guardada | `reading…` (task 2) |
| A última falhou, com leitura guardada | `Read 2h ago` | No alto, a faixa de aviso: `◇ Couldn't read the board · 4m ago` (`age` sobre `failedAt`), a mensagem de `features.md` §Falhas em `--ink-2` e **Try again** secundário `sm`; tentando, **Try again** dá lugar a `Reading…` com o spinner (`role="status"`); a faixa é `role="alert"` quando chega. Embaixo, `--space-4`, a barra e a lista | `◇ Read failed` (task 2) |
| Nunca lida, lendo | `Reading…` | O esqueleto de quatro linhas de `--size-control` com brilho, `role="status"` `Reading the board…`; sem barra | `reading…` |
| Nunca lida, falhou | Nada | O estado vazio de página: `Couldn't read the board`, a mensagem, **Try again** secundário; sem barra | `◇ Read failed` |
| Lida, sem cards | `Read 2m ago` | `This board has no issues.` / `Cards appear after a reading finds open issues, or issues closed in the last 14 days. A discussion publishes new cards here.` e **New discussion** secundário; sem barra | — |
| Filtro sem resultado | — | A barra, e embaixo `No cards match the filters.`, a frase do pedido e **Clear filters** secundário | — |
| Board que saiu | — | A página do lugar que saiu, da task 2 (`This board was removed.`) | — |

Quando dois estados valem, lendo vence: um board nunca lido que falhou e é lido de novo (o **Try again** do vazio) mostra o esqueleto, como hoje (`BoardView.tsx:130`). A faixa da falha e um vazio convivem, a faixa no alto: um board lido sem cards cuja última leitura falhou mostra a faixa e, embaixo, `This board has no issues.`

A frase do filtro sem resultado: `Nothing on the board ` e as partes pedidas, na ordem busca, repositório, status, responsável, separadas por `, `; a primeira com o verbo e as seguintes sem ele: a busca `has "refund" in the title or the number`; o repositório `is in acme/api` / `in acme/api`; o status `is in Ready` / `in Ready`, ou `has no status` / `with no status`; o responsável `is assigned to tchen` / `assigned to tchen`; **Assigned to me** `is assigned to you` / `assigned to you`, e com os dois, `assigned to tchen and to you`, ou só `assigned to you` quando o responsável é o do `gh`; ponto final. Exemplo da cena: `Nothing on the board has "refund" in the title or the number, assigned to tchen.`

#### A busca e os filtros (B4)

A barra (`components.md` Barra de filtros), `role="search"` `Filter the cards`, fixa no alto da área que rola (`position: sticky`, `--space-4` acima e `--space-3` abaixo, o esmaecido de `--space-3` por baixo), com `--space-2` entre as peças e quebra de linha quando não cabe:

- **a busca**: o `SearchInput` do system, `--space-16` × 4 (× 3 abaixo de 620 px de contêiner), placeholder `Search cards`, tecla `/`, `×` com texto. Casa com o título sem maiúsculas nem acentos e com o número com ou sem `#` (a regra de hoje, `board-view.ts:83–92`). `Esc` volta o foco à lista e mantém o texto; `↓` vai à lista;
- **Assigned to me**: o chip que alterna (`aria-pressed`, tooltip `Only the cards assigned to gmartins`); sem `viewer`, tracejado com `gh didn't say who you are`;
- **os filtros ativos**: um chip escolhido por filtro, com o `×`, na ordem repositório, responsável, status, com as formas e o órfão de `components.md` (Barra de filtros);
- **Filter**: o chip com o ícone `filter` e o chevron, que abre o menu de três grupos (`menuitemcheckbox`, um marcado por grupo, fecha a cada escolha); tooltip `Repository, assignee, status`;
- **Clear filters**: fantasma `sm`, só com a busca, **Assigned to me** ou um filtro ativo; limpa os cinco.

Os filtros e as seções recolhidas são lembrados por board no `localStorage` (`boardViewKey`), como hoje; o que se guarda passa a levar, junto do id, o nome que o chip mostra (o `dono/nome` do repositório, o nome do status), para o chip órfão ainda nomear o que filtra; um valor guardado na forma de hoje (só os ids) é lido e ganha o nome da leitura, ou fica órfão com o id cru. A barra não aparece num board nunca lido nem num board sem cards.

#### As seções e a linha (B6)

**As seções** (`board.md` §3.4). Uma por opção de status, na ordem do board, mesmo vazia; `No status` quando a leitura tem card sem status, com a contagem filtrada (some só quando a leitura não tem nenhum, nunca pelo filtro); `Cards` num board sem campo de status (a regra de hoje, `board-view.ts:125–152`). Dentro, as abertas antes das fechadas. As finais começam recolhidas, e o que o usuário recolhe ou expande é lembrado. O cabeçalho (`components.md` Cabeçalho de seção): `--size-node`, chevron `--icon-xs` `--ink-4` (girado com a seção recolhida), o nome em `--text-meta` 600, a contagem já filtrada em `--text-micro` `--ink-4` tabular. Tooltip só na final, `A final status: folded when the board opens`, e em `No status`, `Cards without a status on the board`. Uma seção sem card, vazia de verdade ou pelo filtro, tem a contagem 0, sem chevron, sem hover nem ação, e continua no percurso. Espaço: `--space-4` entre uma seção e a seguinte, `--space-1` entre o cabeçalho e a primeira linha, `--space-0-5` entre as linhas. Nome: `Backlog, 27 cards`, `Done, 70 cards, final status`, `Ready, 0 cards`.

**A linha** (`components.md` Linha de lista), `role="treeitem"` de nível 2, na grade `--icon | --col-num | título | --col-epic | --col-dep | --col-task | --col-keys`, `--space-2` entre as colunas e `--space-2` dos lados, `--size-control` de altura, raio `--radius-sm`, `--text-ui`:

| Coluna | Conteúdo |
|---|---|
| Início | Vazia; no card de um épico (um card que é o `epic` de ao menos um card da leitura), o ícone `epic` `--icon-sm` `--ink-4` (`--brand-ink` na aberta); no modo de seleção, o sinal da caixa de seleção |
| Número | `#474`, `--text-meta` `--ink-4` tabular; `--ink-3` na aberta |
| Título | `--ink-1`, cortado com tooltip; 500 no card de um épico; `--ink-4` numa issue fechada de seção não final, que sobe a `--ink-3` na linha aberta (`--ink-4` sobre `--brand-tint-plane` com hover ou pressionado cai abaixo de 4,5:1 no escuro, `tokens.css:159–162`; `--ink-3` dá 4,57 no pior caso) |
| Épico | O título do épico em `--text-meta` `--ink-3`, cortado com tooltip; no card de um épico, `Epic · 2 of 8 finished` (F8: os filhos são os cards da leitura com esse `epic`, mais os irmãos fora do board que eles listam, sem repetir; acabado é o card com `final`, ou a issue fechada fora do board) |
| Dependência | Só com dependência não satisfeita: o glifo `◇` (`StateGlyph blocked`), `--space-1-5` e `#461` em `--text-meta` `--ink-3`, e ` +1` com mais; tooltip `Depends on #461 Metering events from the gateway · open, Backlog. A warning: it never blocks.` (uma linha por dependência que falta) |
| Task | Com task ativa: o glifo do tom da linha da árvore (`taskRow`) e a forma curta da linha 2 (`line2.short`), com `+N` (`more`); em `--text-meta`, `--ink-1` 500 com espera ou erro, `--ink-2` no resto; tooltip `412-rate-limit-per-api-key: Question · Reviewer · Step 3/7` e, com o chip, `, waiting for you for 18 minutes`. Sem task e com o card numa discussão ativa (F7, ou `writtenBy` ativa): o ícone `discussion` e `In discussion` em `--ink-3`, tooltip `In the discussion Usage-based pricing tiers` (com duas, `In the discussions A and B`). Carregando (o card cujo **Clone and continue** roda): o spinner e `Cloning acme/billing…`. Erro: `Clone failed` em `--state-error`, com o trilho na linha, no card que pediu o clone, enquanto o `cloneError` do repositório existir (a mesma fonte da falha no painel) |
| Teclas | Visíveis só na linha com o foco visível, em `--text-micro` `--ink-3`, a tecla `Kbd sm`, alinhadas à direita, `--space-2` entre as duas: `S start` quando `S` age (`start`, `clone`, `add_to_board`) e `D discuss` quando o card pode entrar numa discussão; no modo de seleção, só `Space select` ou `Space unselect`, num card que pode ser marcado |

Estados: hover `--veil-hover`; foco, o anel por fora; pressionada `--veil-press`; aberta `--brand-tint-plane` com o anel colado `--brand-ring`; desabilitada (no modo de seleção, o card que não pode entrar numa discussão) tracejada, com o título em `--ink-4`; um card novo de uma leitura (a chave que não estava na lista na tela, quando a lista na tela não estava vazia) pisca duas vezes no véu `--veil-press`, por `--duration-slow`, nada com movimento reduzido.

**A largura** (`components.md` Linha de lista, Largura; `board.md` §3.4): acima de 1040 px de contêiner, uma linha; até 1040, duas, com a segunda da coluna do título à das teclas, sem quebrar, a dependência e a task inteiras e o épico cortado primeiro; quando sobram menos de `--space-12` ao épico, ele sai da segunda linha (o nome acessível e o painel o têm). Os números, com as colunas decididas na §4.3 #1: a 1041 px de contêiner o título tem 337 px (um terço é 331); na lista mais estreita ao lado do painel (janela de 1100, contêiner de 452), 180 px de título e 308 px de segunda linha. A lista fica em duas linhas até cerca de 2050 px de janela com o painel aberto e na metade do monitor.

**O nome acessível**, a frase inteira, separada por `. `: `#474 Usage alerts at 80% of the plan`, `acme/api`, o status (`No status`), `Closed` na fechada, `epic Usage-based billing` ou `epic, 2 of 8 cards finished`, `depends on #461, not satisfied` (uma por dependência que falta), `task 412-rate-limit-per-api-key: Question · Reviewer · Step 3/7, waiting for you for 18 minutes`, `in the discussion Usage-based pricing tiers`, e no modo de seleção `selected`, `not selected` ou `can't be selected`. No modo, as linhas perdem `aria-selected` (o painel está fechado) e levam `aria-checked`: uma árvore usa um dos dois por vez.

#### O painel do card (B7, B8)

**Abrir e fechar** (`board.md` §3.5): `Enter` ou o clique numa linha abrem; outro card troca o conteúdo e volta a rolagem do painel ao topo; `Enter` na linha aberta, `Esc` e o `×` fecham, e o foco volta à linha quando estava no painel; sem a linha (o card fora da leitura, ou escondido pelo filtro), à parada da lista. O teclado fica na lista. O painel nunca abre sozinho, salvo pelo pedido do painel `Card` da task (abaixo).

**Forma**: o painel da lista de `components.md` (Painel auxiliar), `aside` `Card #474`, largura `round(down, var(--panel-card-width), 1px)`, ao lado da lista a partir de 800 px de área principal (container query sobre `main`, como `.aux-panel` em `styles/globals.css`) e cobrindo-a abaixo; entra e sai como o painel auxiliar. A faixa de `--size-head` com o fio embaixo: `#474 · acme/api` em `--text-meta` `--ink-3` (o número em mono), **Open on GitHub** (fantasma de ícone, seta externa, nome `Open #474 on GitHub`, tooltip `Open on GitHub`) e `×` (`Close · Esc`). O corpo rola, `--space-4` dos lados, `--space-3` no alto, `--space-6` no pé, `--space-4` entre os blocos:

1. **O título** em `--text-title` 600 e, embaixo, em `--text-meta` `--ink-3`, o status em 500 `--ink-2` (`No status` sem ele), `· Closed` numa issue fechada e `· <épico>` (`Ready · Usage-based billing`).
2. **As ações**, numa linha com `--space-2` e quebra, e a razão embaixo em `--text-meta` `--ink-2` (em `--state-error` no erro), ligada por `aria-describedby` aos botões tracejados: a tabela seguinte.
3. **As dependências não satisfeitas**, um aviso de dependência cada, contornado por `--line-2`: `◇ Depends on #461` em 600 `--ink-1` e o título, e embaixo `acme/gateway · Open · Backlog · no pull request. A warning only: it never blocks.` As PRs: `no pull request`, `pull request #88 · Open` (o repositório antes do número quando é outro), ou `2 pull requests, none merged`; sem status no board, o status sai.
4. **A task e a discussão**: a task ativa no bloco do item (glifo `task` ou `oneShot` em `--brand-ink`, o nome em 500, embaixo o glifo e `ItemRow.line2.long` com o chip, e **Open** secundário `sm`, `Open the task`); sem ativa, `Archived task: <nome>` (link, abre no History); e a discussão, um link por discussão, `In the discussion <título>` (ativa, entrada ou autora; abre a discussão) ou `From the discussion <título>` (a autora arquivada; abre no History), com o ícone `discussion`.
5. **Os campos**: `dl` em grade `max-content | 1fr`, `--space-1` × `--space-4`, `--text-meta`, a chave em `--ink-3`: os campos na ordem que o GitHub devolve e `Assignees` (os logins por vírgula) por último; nada sem campo nem responsável.
6. **O corpo**, depois de um fio `--line-1`: o `Markdown` de `features/chat` com a classe do registro de leitura (`--text-read`/`--leading-read`, títulos em `--text-body` 600), selecionável; vazio, `No description.` em `--text-meta` `--ink-3`.
7. **As relações** (`components.md` Lista de relações): **Epic** (o épico, com `2 of 8 finished` à direita), **Cards of the epic · 6** (os irmãos; o status no board, ou `Open`/`Closed` fora dele), **Cards · 8** no card de um épico (os filhos, pela regra do progresso), **Dependencies** (todas; à direita o estado e o status, `Open · Backlog`, e numa aberta satisfeita pela PR, `merged #88`; `◇ Not satisfied` na que falta), **Pull requests** (`#1291` com `Open`, `Merged` ou `Closed`, o repositório antes quando é outro). Um card da leitura abre no painel (o link sem a seta), expande a seção dele e leva o foco à linha dele quando ela está visível; escondida pelo filtro, o foco fica no link; o resto abre no GitHub.

**As ações do card** (`board.md` §3.6):

| `action` | Ações | Razão ao lado |
|---|---|---|
| `start` | **Start task** `S` (primária) · **Discuss** `D` | — |
| `clone`, parado | **Clone and continue** `S` (primária, ícone `clone`, tooltip `Clone, then open New task · S`) · **Discuss** `D` | `acme/billing isn't cloned yet. A task needs a clone.` |
| `clone`, clonando | `Cloning acme/billing…` (primária carregando, `aria-busy`) · **Discuss** `D` | `The dialog opens when the clone ends. You can leave the board meanwhile.` |
| `clone`, falhou (`cloneError` do repositório) | **Try the clone again** `S` (primária) · **Discuss** `D` | A mensagem do `gh` em `--state-error` |
| `clone_missing` | **Start task** (primária tracejada) · **Change path…** (secundária) · **Discuss** `D` | `The clone at ~/code/api is missing.`; a recusa do **Change path…** em `--state-error` embaixo |
| `add_to_board` | **Start task** `S` (primária), que abre `Add acme/status-page to the board` · **Discuss** tracejado | `acme/status-page isn't managed by this board. Start task adds it first.` |
| `other_board` | **Start task** (primária tracejada) e **Discuss** tracejado | `acme/ios belongs to the board Mobile App.` |
| `has_task` | **Discuss** `D` (secundário); a task fica no bloco dela | — |
| `closed` | **Discuss** `D` (secundário) | `The issue is closed.` |
| Qualquer, fora da leitura | **Start task** (primária tracejada) e **Discuss** tracejado | A faixa do card fora da leitura |

**Discuss** fica tracejado também quando o card não pode entrar numa discussão (o repositório não é do board), e sempre se descreve por `acme/ios isn't a repository of this board.`, qualquer que seja o caso. **Add to board** confirmado não abre o diálogo de criação: o card passa a `start` ou a `clone`, e o foco vai à primária do painel, que agora é **Start task** ou **Clone and continue** (`decisions.md:9–11`); o mesmo depois de um **Change path…** que dá certo, quando o card passa a `start`. O diálogo **Add to board** passa ao `Dialog` do system, largo, com o título `Add acme/status-page to the board`, o subtítulo `The board manages the repository from now on.`, o corpo de hoje, `Checking the repository…` enquanto lê, a recusa em vermelho no rodapé, **Cancel** e **Add to board** (primária, `Adding…`).

**O card fora da leitura** (F9, `board.md` §3.9): a visão guarda o último `BoardCard` aberto; quando a leitura nova não o traz, o painel fica com ele, a faixa de aviso contornada no alto do corpo (`◇ This card isn't in the last reading of the board.` e `It left the board, or its issue closed more than 14 days ago. The reading of 14:08 doesn't have it, so a task or a discussion can't start from it.`, com a hora de `readAt` na forma do tooltip da idade: `of 14:08`, `of yesterday at 17:40`, `of Sep 21 at 17:40`), `role="status"`, e as ações tracejadas com `aria-describedby` nela; a linha sai da lista; o card sai da seleção em silêncio; `Esc` ou o `×` fecham, sem um segundo **Close**.

**Do painel `Card` da task** (B13): uma relação que é card da leitura do board da task (o épico, um irmão ou uma dependência com `onBoard`; o épico pela chave entre os cards da leitura) é o link sem a seta, e o clique vai à visão do board com esse card no painel, a seção dele expandida e o foco na linha dele; com a linha escondida pelo filtro, os filtros ficam, o painel abre, e o foco vai à primeira ação habilitada do painel, senão ao `×`. O resto continua externo. É o único caso em que o painel abre sem um clique na lista.

#### New discussion, as teclas e os avisos (B3, B10)

**New discussion** `N` (o cabeçalho, ou `N` em qualquer ponto da visão fora de um campo, também no modo de seleção) abre o diálogo com o board fixo e sem cards. **Discuss** `D` e a barra da seleção abrem com os cards.

As teclas de uma letra valem só fora de um campo de texto, sem modificador, na lista e no painel:

| Tecla | Onde | Age | Não age: o aviso de tecla |
|---|---|---|---|
| `S` | Linha em foco; o painel, para o card dele; fora do modo de seleção | `start`: o diálogo de card. `clone`: abre o card no painel com o foco em **Clone and continue** (ou no botão carregando). `add_to_board`: o diálogo **Add to board** | `has_task`: `No task from #412` · `#412 already has a task: 412-rate-limit-per-api-key.`; `closed`: `No task from #409` · `The issue is closed.`; `other_board`: `No task from #104` · `acme/ios belongs to the board Mobile App.`; `clone_missing`: `No task from #488` · `The clone at ~/code/api is missing.`; o card fora da leitura, no painel: `No task from #466` · `The card isn't in the last reading of the board.`; num cabeçalho de seção e no modo de seleção, nada, sem aviso (a tecla não está escrita ali) |
| `D` | Linha em foco; o painel | A seleção, com ela; sem ela, o card, se pode entrar numa discussão | `#104 can't go into a discussion` · `acme/ios isn't a repository of this board.`; o card fora da leitura, no painel: `#466 can't go into a discussion` · `The card isn't in the last reading of the board.`; no modo de seleção sem nenhum marcado, `No card is selected` · `Select a card with Space.` |
| `Space` | Linha em foco | Entra no modo e marca, ou alterna | `#104 can't go into a discussion` · `acme/ios isn't a repository of this board.`; sem linha visível não há onde apertar, e o modo não começa |
| `N` | A visão, fora de um campo | **New discussion** sem cards | Num board nunca lido, `No discussion yet` · `The board hasn't been read yet.` |

O aviso de tecla segue `components.md:110–118`: preso à linha em foco, à linha das ações do painel (que existe em todos os casos, também em `has_task` e `closed`) ou, para `N`, a **New discussion**; 4 segundos; `role="status"`. Quando uma leitura termina um clone de **Clone and continue**, o diálogo de card abre sozinho, mesmo fora da visão, como hoje (`board/usePendingStart.ts`).

#### O modo de seleção (B5)

- **Entra** por **Select cards to discuss** no `⋯` (o foco vai à parada da lista) ou por `Space` numa linha (que já a marca). Entrar fecha o painel.
- **A barra da seleção** (`components.md` Barra da seleção), no lugar da barra de filtros, `role="toolbar"` `Selected cards`: `3 selected` em 600 (`role="status"`), os números na ordem em que foram marcados em `--text-meta` `--ink-3` cortados com tooltip, e, com algum filtro ou busca ativos, `· filtered` em `--ink-3` com as partes da frase do filtro no tooltip (a lista continua filtrada), **Discuss 3 cards** `D` (primária `sm`; `Discuss 1 card`; sem nenhum, `Discuss cards` tracejado com `Select a card with Space`) e **Cancel** `Esc` (fantasma `sm`, tooltip `Leave the select mode · Esc`); `--surface-0` com o anel `--line-2`, raio `--radius-md`, `--space-3` à esquerda.
- **As linhas**: o sinal da caixa na coluna de início; o clique, `Space` e `Enter` alternam; o card não abre; a linha que não pode ser marcada é a desabilitada. A lista ganha `aria-multiselectable`, e cada linha que pode ser marcada, `aria-checked`.
- **Sai** por **Cancel**, `Esc` ou ao sair da visão; a seleção some junto. **Discuss N cards** abre o diálogo com os marcados; cancelado o diálogo, o modo e a seleção ficam; criada a discussão, ela abre. A busca e os filtros esperam o fim do modo, e `/` não age nele.

#### O teclado e o foco da visão

| Tecla | Onde | Ação |
|---|---|---|
| `↑` `↓` | Lista | A linha ou o cabeçalho visível anterior ou seguinte (as seções recolhidas pulam os cards delas), a entrada ganha o foco e entra na vista (`block: nearest`) |
| `Home` `End` | Lista | O primeiro e o último visíveis |
| `←` | Cabeçalho aberto; linha | Recolhe a seção; numa linha, recolhe a seção dela e foca o cabeçalho |
| `→` | Cabeçalho recolhido | Expande; num cabeçalho aberto e numa linha, nada, como a árvore da lateral |
| `Enter` | Linha; cabeçalho | Abre ou fecha o card (no modo de seleção, alterna); recolhe ou expande |
| `/` | A visão, fora de um campo e fora do modo de seleção | Foca a busca |
| `Esc` | A visão | Fecha o menu ou o `listbox`, depois o aviso de tecla, depois o painel, depois sai do modo de seleção; na busca, volta à lista. O `Esc` da visão marca o evento (`preventDefault`), e o de `app/useGlobalShortcuts.ts:96–122` não age |

A lista é uma parada de Tab: a última linha com o foco, senão a do card aberto, senão a primeira linha visível. Quando a linha com o foco sai da lista (o card saiu da leitura, mudou para uma seção recolhida, ou o filtro o escondeu), o foco vai à linha visível seguinte, senão à anterior, senão ao cabeçalho da seção dela. A ordem de Tab: o cabeçalho (`←`, `→`, **Refresh**, **New discussion**, `⋯`), a faixa da falha, a barra, a lista, o painel. `Ctrl+N` abre o diálogo livre de qualquer ponto da visão.

#### O diálogo de criação (B11, B12)

**A forma** (`board.md` §4.1): o `Dialog` do system, largo (`--size-dialog-wide`, 576 px), `New task` com o `×`, o corpo com `--space-4` entre os campos, o rodapé afundado. O foco começa em **Name**, com o cursor no fim. `Enter` em **Name** confirma, como hoje; `Ctrl+Enter` confirma de qualquer campo; `Esc` fecha o `listbox` aberto, depois o diálogo. Os atalhos globais ficam inertes, como hoje.

**Os campos**, de cima para baixo (`board.md` §4.2):

| Campo | Diálogo livre | Diálogo de card |
|---|---|---|
| Topo | **Repository**: o `Select` do system com um item por repositório em ordem alfabética (`dono/nome`) e o visto no escolhido. Desabilitados com a razão como `sub` (`SelectOption.disabled`): `Not cloned` com a ação **Clone** (o item desabilitado com ação de `components.md:218`: fica no percurso das setas com `aria-disabled`, não é escolhível, `Enter` nele clona, o nome é `acme/billing, not cloned. Enter clones it.`, e o menu fica aberto enquanto o item passa a `Cloning…` e depois a utilizável, sem ser escolhido sozinho); `Cloning…`; `The clone at ~/code/infra is missing.` O erro de um clone em `--state-error` no item e sob o seletor. Padrão: o primeiro utilizável entre o do filtro da lateral, o da task aberta, o último usado nesta execução e o primeiro da lista (`lib/repositories.ts` `defaultRepositoryId`); sem nenhum, o placeholder `Choose a repository` | O card num bloco afundado (a linha afundada, variante card de entrada, `components.md:444`): `#474` em `--text-meta` `--ink-3`, o título em 500, e embaixo `acme/api · Ready · Usage-based billing` em `--text-meta` `--ink-3` (sem status ou sem épico, a parte sai). Sem seletor |
| **Name** | Vazio | O `suggestedName` do card |
| | O input em mono `--text-meta`, `spellcheck` desligado; a ajuda `Lowercase letters, digits and hyphens. It names the branch and the worktree.` em `--text-micro` `--ink-3`; o erro no lugar dela, validado enquanto se digita, com `aria-invalid` e `aria-describedby`: `Use lowercase letters, digits and single hyphens.` e o link `Use "rate-limit-v2"`; `Use at most 64 characters.` e o link com a sugestão cortada; `A task named rate-limit-per-api-key already exists in acme/api.` (tasks ativas e arquivadas do repositório escolhido). Vazio não é erro: só a ajuda | |
| **Context** | A área de texto de quatro linhas, a ajuda `What you want to build, in your own words. High level or detailed.` | A linha afundada do contexto (abaixo), com **Show**/**Hide** e **Add to it** |
| As dependências | — | Um aviso de dependência por dependência não satisfeita, afundado (sem contorno), com `A warning only: the task can start.` no fim; neutro, nunca âmbar (B12) |
| **Mode** e **Review mode** | Lado a lado, duas colunas iguais com `--space-4`: o controle segmentado `sm` (`Structured` / `One-Shot`; `Agent` com o robô / `Manual` com a pessoa), o escolhido em `--brand-tint` com o anel, e embaixo a linha do escolhido em `--text-meta` `--ink-3`: `A PRD, a tech spec and a plan of steps, each step its own commit. Fixed once the task exists.` / `One planning conversation writes a single document, implemented in one commit. Fixed once the task exists.`; `An agent reviews each step, and the task runs to the pull request on its own.` / `You review each step in VS Code before its commit.` Padrões: `Structured` e o modo de review de **Defaults** | Igual |
| **Models** | O resumo de modelos e a lista (abaixo) | Igual |

**A linha do contexto** (P23, `board.md` §4.3): `From the card: ` e as partes que o contexto montado tem, na ordem `#474`, `the epic <título>`, `<n> card(s) of the epic` (os irmãos), `<n> dependency`/`dependencies` (todas), `the discussion <título>` (`writtenBy`, ativa ou arquivada), separadas por `, ` e com ` and ` antes da última, sem vírgula antes dele; depois ` · 5,690 characters` (os caracteres do texto de `CardContext`, contados por ponto de código, com o separador de milhar em inglês; `1 character`). Enquanto o texto não chegou, a linha fica sem a contagem. **Show** (fantasma `xs`, `aria-expanded`, `aria-controls`) abre sob a linha o texto em Markdown, somente leitura, numa caixa contornada por `--line-1`, raio `--radius-md`, `--space-3` × `--space-4`, em `--text-body`, com altura máxima de nove linhas (`--leading-body` × 9) e rolagem, focável (`tabindex="0"`, `The context from the card`); **Hide** fecha. **Add to it** (fantasma `xs`, ícone `plus`) some depois do clique e abre sob a linha o campo `Additional context` (rótulo visível, complemento `optional`), três linhas, placeholder `Anything the card doesn't say. It goes at the end of the context.`, com o foco nele; ele não fecha mais. Com a leitura do card acima de 5 minutos, a releitura (a de hoje, `CardContextPreview.tsx:31–44`): a linha diz `Refreshing the card…` com o brilho, e **Show** fica tracejado com `The card is being read again.`; se falha, a linha diz `◇ Couldn't refresh the card: <motivo>. The task will use the last reading.` em `--ink-2`, e o resumo volta na linha seguinte. O card que sai da leitura com o diálogo aberto: o corpo inteiro dá lugar à linha afundada `◇ This card isn't in the last reading of the board.`, e o rodapé fica só com **Cancel**.

**Os modelos** (`board.md` §4.5): **Models** é uma linha de `--size-control` que abre e fecha no lugar (o `Collapsible` do system, chevron `--icon-xs`), `Models` em 500 e, à direita em `--ink-3`, o resumo das etapas do modo escolhido: `Defaults`; ou a primeira ajustada, `One-Shot planning: Fable 5.1 · xhigh · the rest from Defaults`, com `+N` antes do ` · the rest from Defaults` quando há mais (`PRD: Fable 5.1 · xhigh +1 · the rest from Defaults`), e sem ` · the rest from Defaults` quando todas as etapas do modo estão ajustadas. Aberta, a lista do diálogo de criação de `components.md` (Linha de modelo por etapa): um grupo contornado por `--line-1`, uma linha por etapa do modo separada por fios (Structured: `PRD`, `Tech spec`, `Plan`, `Implementation`, `Step review`, `PR`, `PR review`; One-Shot: `One-Shot planning`, `Implementation`, `Step review`, `PR`, `PR review`), cada uma com o `ModelChip` `sm` da task 3 à direita; a escolha própria (diferente de **Defaults**) em `--ink-1` 500 com `--line-3` e o tooltip `Defaults: Opus 5.5 (1M) · high`, a que segue em quieta com `From Defaults`; indisponível, lendo o catálogo e sem catálogo como o chip. O ajuste de uma etapa comum aos dois modos sobrevive à troca de modo.

**O rodapé** (`board.md` §4.6): à esquerda, a razão quando **Create** está tracejado, na primeira que vale: `Choose a repository to create the task.`, `Name the task to create it.`, `Fix the name to create the task.`, `Say what you want to build.` (só no livre); **Cancel** fantasma; **Create** `Ctrl ↵`, a única primária. Confirmando: **Create** vira `Creating…` com o spinner (`aria-busy`), **Cancel** fica tracejado, a razão diz `Starting the first session…`, e os campos ficam somente leitura. Um erro da confirmação aparece no lugar da razão, em `--state-error`, o diálogo fica aberto, os campos voltam, e **Create** volta a agir: `A task named <nome> already exists in <dono/nome>.`, `Card #<N> already has an active task: <nome>.`, `This card isn't in the last reading of the board.`, `<dono/nome> isn't managed by this board.`, `The clone at <caminho> is missing.`, ou o erro da sessão que não começou, que o Go devolve já terminado em ` The task was undone.` (P22b: o binding acrescenta a frase quando `StartTask` falha e a task foi apagada, `internal/bindings/task_service.go:173–178`); o rodapé mostra a mensagem como vem, sem **Try again**: **Create** é o repetir. Criada a task, o diálogo fecha e a task abre.

#### Acessibilidade (`board.md` §8)

A lista é `tree` `Cards of Platform Roadmap, by status`; os cabeçalhos `treeitem` de nível 1 com `aria-expanded` (menos o vazio), os cards de nível 2 com `aria-selected` no aberto, e no modo de seleção com `aria-checked` no lugar dele. O painel é `aside` `Card #474`. A idade durante uma leitura, o esqueleto, o aviso de tecla e a contagem da seleção são `role="status"`; a faixa da falha é `role="alert"` ao chegar. Todo botão tracejado tem a razão por `aria-describedby`. Os testes acham cada peça por `getByRole` com o nome inteiro desta seção.

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | As colunas não cabiam o que o mock escreve, medido em Fira no Chromium: `S start` e `D discuss`, com as teclas `Kbd sm` e `--space-2` entre os dois, medem 117 px (a coluna tem 112); o glifo (`StateGlyph blocked`, 8 px), `--space-1-5` e `#1291 +1` medem 60 (a coluna tem 56; `#12345 +9` mede 69) | `--col-keys` passa a `calc(var(--space-16) + var(--space-12) + var(--space-2))` (120 px) e `--col-dep` a `calc(var(--space-16) + var(--space-2))` (72 px); o título ainda tem um terço a 1041 px (337 de 993). A task muda `design/system/tokens.css` no step 3 (§6, §8) | `components.md` (Tamanhos de layout), com o valor decidido |
| 2 | Um nome de 64 caracteres em Fira Code de 13 px mede 512 px e não cabe no diálogo de 544: o campo fica com 544 − 2 × 20 (o corpo) − 2 × 10 (a folga) − 2 (a borda) = 482 | `--size-dialog-wide` passa a `calc(var(--size-dialog) + var(--space-16) + var(--space-8))` (576 px, o campo com 514); a task muda o token no step 3 | `components.md`; `structure.md:397`; `board.md` §4.1, com o valor decidido |
| 3 | A segunda linha "inteira" (`board.md`) e o épico cortado em 176 px (mock) | Sem quebrar; a dependência e a task inteiras; o épico corta primeiro, a task só quando as duas não cabem; 52 px de altura | `components.md` (Linha de lista); `board.md` §3.4 |
| 4 | O painel da lista "enquanto a lista mantém 440 px", sem o limite | Exatamente a partir de 800 px de área principal, uma container query | `components.md` (Painel auxiliar); `structure.md:394`; `board.md` §3.5 |
| 5 | A coluna da task: `◌ Step 2/5 · Reviewer pass 2` no documento, sem regra de forma | A forma curta da linha 2 da árvore com `+N`; a longa no tooltip, no nome, no bloco e em **Continue** | `board.md` §3.4; `components.md` (Linha de lista) |
| 6 | O aviso de uma tecla que não age, sem forma (o mock usa um toast, que o sistema reserva ao item que saiu) | O aviso de tecla: a superfície do tooltip presa à linha, `role="status"`, 4 s | `components.md:110–118`; `board.md` §3.6 |
| 7 | `D` e `N` sem aviso, e o `S` com o título da task em vez do nome | Os textos da tabela das teclas; o nome da task, como o Go (`Card #N already has an active task: <nome>.`) | `board.md` §3.6 |
| 8 | O modo de seleção com o painel aberto teria duas primárias (**Start task** e **Discuss N cards**) | Entrar no modo fecha o painel; `Enter` e o clique alternam; `/` não age | `board.md` §3.6 |
| 9 | O `Open` do bloco do item primário quando o item espera (`components.md`) contra **Start task** única primária (`board.md`) | No board, **Open** é secundário; a regra de `components.md` vale onde nenhuma outra primária está na tela | `components.md` (Bloco do item) |
| 10 | A ação do vazio repetia a do cabeçalho e da barra, contra "não repita a ação à vista" | A ação do vazio é a saída dele e pode repetir; nenhuma ação que não resolve o vazio | `components.md` (Estado vazio de página) |
| 11 | **Continue** com um item que saiu (o espécime o desenha desabilitado) | O item é o ativo mais recente que ainda existe, pela pilha de lugares; sem desabilitado nem carregando | `board.md` §2.2; `components.md` (Continue); `decisions.md:9–11` |
| 12 | `In discussion` só para os cards de entrada (F7), e o card escrito por uma discussão arquivada | Também o card escrito por uma discussão ativa; o painel leva à autora arquivada com `From the discussion` | `decisions.md:9–11`; `components.md` (Bloco do item) |
| 13 | O campo **Board** só da Home; o **+ New** escolhia o board sozinho fora de um lugar com board | O mesmo campo pelo **+ New** num lugar sem board; `last used` entre ativas e arquivadas; o board nunca lido desabilitado | `board.md` §2.3; `decisions.md:9–11` |
| 14 | A leitura na linha de board da Home: `read 2m ago` com brilho (§2.2) e `reading…` (§6) | O texto da direita brilha durante qualquer leitura; `reading…` só num board nunca lido | `board.md` §2.2, §6 |
| 15 | Os filtros: um valor por grupo ou vários; o menu que fecha ou fica; o órfão de status | Um por grupo, `menuitemcheckbox`, fecha a cada escolha; órfão também o status; o chip guarda o nome | `components.md` (Barra de filtros) |
| 16 | A frase do filtro sem resultado, com uma fórmula só pelo exemplo | A fórmula da §4.2, com o responsável e **Assigned to me** sem duplicar | §4.2 |
| 17 | A razão do **Create** sem repositório utilizável | `Choose a repository to create the task.`, a primeira da ordem | §4.2 |
| 18 | O resumo dos modelos com todas as etapas ajustadas (`the rest from Defaults` mentiria) | Sem o complemento quando nada segue **Defaults** | §4.2 |
| 19 | `Additional context` com rótulo só para o leitor de tela (mock) | Rótulo visível com `optional`: o placeholder não é rótulo | §4.2; `components.md` (Input) |
| 20 | Divergências do mock | Vale o material em tudo o que ele diz (`implementation.md:18`). As conhecidas: **Review mode** (não `Review of each step`); o subtítulo de **New task**; `◇ #461 +1`; a barra da seleção neutra; a linha do contexto com a discussão; a faixa da falha sem `The list is the reading of 12:10`; o card fora da leitura sem **Close**; o aviso de tecla no lugar do toast; `Read 1d ago` pelo `age` de hoje, com `Internal Tools` lido às 12:00 da véspera (o mock diz `Read yesterday`); a linha do contexto de #474 com `the discussion Usage alerts` (a autora arquivada das fixtures); `46 open cards` pela contagem fora dos status finais; a coluna da task na forma curta; o segmento escolhido em `--brand-tint`; a lista dos modelos contornada; `Additional context` com rótulo; as larguras dos itens 1 a 3; `Use "…"` com aspas retas, como hoje | `implementation.md:18` |
| 21 | Estados sem caso no produto: **Continue** desabilitado e abrindo; a barra da seleção abrindo | Saem de `components.md`: a ida a um lugar é imediata | `components.md` (Continue, Barra da seleção) |
| 22 | Os ícones que a visão pede sem significado registrado (e o `refresh` que colidia com o `retry` da task 4) | `refresh` (duas setas em ciclo), `filter`, `clone`, `select`, `settings`, `plus`, `repository`, `epic` | `components.md:78–87` |
| 23 | **Add to board** e depois: continuar sozinho ou não | Como hoje: não abre o diálogo; o foco vai à primária nova do painel | `decisions.md:9–11` |
| 24 | A virtualização "se passar de algumas centenas de linhas", sem critério | Não entra; a medição da §6 decide, com números | `board.md` §6; `structure.md:423` |
| 25 | A crítica da entrada (`research/critique-task-05-input.md` L1–L12 e os ajustes) | A contagem da Home fora das finais; as horas das fixtures por cena; `--panel-card-width` arredondado no uso; a prova da coluna de `Details` num arquivo novo; P22b no lugar do **Try again**; o foco quando a linha some; `S` e `D` no modo e no card fora da leitura; `· filtered` na barra da seleção; o item desabilitado com ação no teclado; o título fechado da linha aberta em `--ink-3`; a autora arquivada de #474 nas cenas; a precedência dos estados da leitura; os tracejados primários; `No status` estável; `Enter` em **Name**; o relógio `yesterday at`; **New discussion** tracejado sem board lido; `Clone failed` pelo `cloneError`; `aria-checked` no lugar de `aria-selected` no modo; o épico que sai da segunda linha abaixo de `--space-12` | §4.2, §4.4, §6; `board.md`; `components.md`; `changes.md` B7, B10, B11; `backend.md` P22b |

### 4.4 O que o tech spec toma

- **P22.** `discussion.Service.CardWriters() map[string]Writer` (a chave do card, `task.IssueKey`; `Writer` com o id, o título e se está arquivada), com a mesma seleção de `DocumentOfCard` (`internal/discussion/service.go:637–661`: a publicação mais recente vence; empate, a discussão mais nova; ativas e arquivadas), extraída numa função que as duas usam, calculada em memória sob o lock, sem ler arquivo. `bindings.WritingDiscussion` (`id`, `title`, `archived`) e `BoardCard.writtenBy *WritingDiscussion` (`dto.go:861–884`, `null` sem autora). `FromBoards` (`convert.go:830`) recebe o mapa como recebe `cardTasks`, e `app/state.go:71–74` o passa. Dois desencontros ficam aceitos por escrito: uma discussão cujo documento não se lê, e uma que publicou sem ter escrito o documento (`board.Context` só põe a seção `Discussion` com o documento não vazio, `internal/board/context.go:28–30`); nos dois, a linha do contexto cita a discussão e o texto não a tem. São raros, e a contagem de caracteres mostra o tamanho real.
- **P23.** A recomendação é derivar no frontend: as partes do `BoardCard` (`epic`, `siblings.length`, `dependencies.length`, `writtenBy`), que são exatamente as seções que `board.Context` monta (`internal/board/context.go:26–35`, `cardSections` 97–113), e a contagem do texto que `CardContext` já devolve ao abrir o diálogo. Nenhum Go. O tech spec pode preferir expor as partes no Go se achar outra fonte de divergência.
- **P22b.** Em `CreateTask` (`internal/bindings/task_service.go:173–178`), quando `StartTask` falha e o apagamento da task dá certo, a mensagem devolvida ganha ` The task was undone.` no fim; quando o apagamento também falha, não. Uma linha de Go no step 9, com o teste.
- **O pedido de abrir um card no board** (B13) é uma ação do store (`openBoardCard(boardId, key)`) que vai ao lugar do board e deixa um pedido transitório, consumido pela visão ao montar, fora da pilha e do `localStorage`, como `pendingFocus`; o `Location` do board não muda.
- **O campo Board** é um campo a mais em `NewDiscussionRef` (`store/app-store.ts:120–123`), que diz se o diálogo pergunta o board; `features/sidebar/new-discussion-board.ts` passa a dizer também se o lugar tem board.
- **B1**: `resolveHome` (`lib/locations.ts:219–226`) deixa de trocar a Home pelo primeiro board; os usos em `store/app-store.ts:527, 551, 574, 649` e os testes (`lib/locations.test.ts:212`, `store/app-store.test.ts:1985, 2395`) mudam no step 5.
- **Onde moram as funções puras**: `features/board/board-view.ts` (as linhas planas com os cabeçalhos, o modelo da linha, o nome acessível, o progresso do épico, `In discussion`, os avisos de tecla, os chips e a frase do filtro, a memória guardada com os nomes), `features/board/card-panel.ts` (o modelo do painel: a faixa, o status, as ações por caso com as razões, os avisos de dependência, o bloco, os campos, as relações com o card do board), `features/home/home.ts` (o item de **Continue**, os subtítulos, as linhas de board e as linhas do que bloqueia), `features/task-create/create-task.ts` (a linha do contexto, a razão do **Create**), `lib/models.ts` (`adjustmentSummary` com o complemento), `features/discussion/new-discussion.ts` (as opções do campo **Board** e `last used`). As linhas da lista saem de uma função que devolve a lista plana (cabeçalhos e cards), a forma que uma virtualização pediria, se a medição a pedir.
- **O painel da lista** é um componente próprio em `components/system/` com a regra `@container main (min-width: 800px)` em `styles/globals.css`, ao lado da de `.aux-panel` (1120 px), com a largura arredondada no uso (`round(down, var(--panel-card-width), 1px)`), como `--panel-width`. `--panel-card-width` fica em `UNROUNDED_WIDTHS` (`styles/globals.test.tsx:62`), cujo comentário passa a dizer "arredondadas no uso"; nenhum token além dos três da §4.3.
- **O sinal da caixa de seleção** é extraído de `components/system/Checkbox.tsx:53–67`, que passa a usá-lo.
- **O registro de leitura do corpo** é uma classe no contêiner do `Markdown` (`features/chat/Markdown.tsx:26, 43–46` aceita `className`), sem mudar `Markdown.tsx`, que a task 4 edita (§6).

## 5. Inventário atual

### 5.1 `features/home`, `features/board`, `features/task-create`

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `home/Home.tsx` (1–41) | `No tasks yet` ou `No task open` (15) e **New task** do shadcn | Reescrito: a Home (§4.2) |
| `board/BoardView.tsx` (1–221) | Relê ao abrir (41–44); `<section>` vazio sem board (46–48); o esqueleto de 8 linhas (25); os estados (130–196); `ResizablePanelGroup` 60/40 (164); `SelectionBar` (212) | Reescrito: o lugar, a faixa, a barra, a lista, o painel, o modo de seleção |
| `board/BoardHeader.tsx` (1–79) | `checked <idade>` (32), spinner, **New discussion** outline (49), **Refresh** (54), **Open on GitHub** (61), a falha em vermelho numa linha (70) | Sai: o cabeçalho do lugar com a idade, **Refresh**, **New discussion** `N` e `⋯`; a falha vira a faixa |
| `board/BoardFilterBar.tsx` (1–93) | Busca de 14rem, três `FilterMenu`, o `Toggle` **Assigned to me**, **Clear filters** | Sai: a barra de filtros do system |
| `board/board-view.ts` (1–208) | Filtros (4–24), memória (32–74), busca (76–92), `filterCards` (95–107), `sections` (130–152), `defaultCollapsed`, `visibleCards`, `assigneesOf`, `unsatisfied`, `actionHint` (185–200), `isCheckable` (206–208) | Fica e cresce (§4.4) |
| `board/useBoardViewMemory.ts` (1–66) | A memória por board no `localStorage` | Fica; guarda os nomes do filtro e lê a forma de hoje |
| `board/CardList.tsx` (1–231) | O `tree` só com os cards no percurso; `S`, `D`, `Space` (130–159) | Reescrito: a lista com os cabeçalhos no percurso, `Home`/`End`, os avisos, o modo |
| `board/CardRow.tsx` (1–111) | Caixa em toda linha, `Waits for you` em âmbar para qualquer situação (83), `Not cloned` (88), o repositório (91), três avatares (11) | Reescrito: a linha (§4.2) |
| `board/CardDetail.tsx` (1–210) | Título, meta, campos, corpo, épico, `Siblings`, dependências em âmbar, PRs, a task, e as ações no fim (207) | Sai: o painel do card, na ordem de `board.md` §3.5 |
| `board/StartTaskAction.tsx` (1–153) | As ações por `action` (61–129), **Change path** sem reticências | Sai: as ações do card (§4.2) |
| `board/useStartCard.ts` (1–84), `usePendingStart.ts` (1–26) | **Start task** e o clone que espera | Ficam; `useStartCard` perde o passo intermediário de `clone` (o painel já mostra **Clone and continue**) e guarda a falha do card que pediu |
| `board/SelectionBar.tsx` (1–29) | `N cards selected`, **Discuss selected**, **Clear selection** | Sai: a barra da seleção do system |
| `board/AddToBoardDialog.tsx` (1–117) | Diálogo do shadcn | Passa ao `Dialog` do system, com o corpo de hoje |
| `task-create/NewTaskDialog.tsx` (1–398) | `sm:max-w-lg` (105), ajuda sem a worktree (54, 248), `Initial context` de 8 linhas e `Additional context` sempre (273), dependências em âmbar (294), `ToggleGroup` (321), `ReviewModePicker` (344), `ModelPicker` por etapa, o erro solto (386) | Reescrito: o diálogo (§4.2) |
| `task-create/CardContextPreview.tsx` (1–99), `CardSummary.tsx` (1–23), `RepositoryPicker.tsx` (1–106) | **Context from the card** recolhível com a falha em âmbar (94); o card com `Badge`; o seletor do shadcn com **Clone** ao lado | Saem: a linha do contexto, o bloco do card, o `Select` do system; a releitura e o clone passam ao novo |

Testes: 7 arquivos em `features/board` (`board-view`, `BoardView`, `CardDetail`, `CardList`, `StartTaskAction`, `usePendingStart`, `useStartCard`), 4 em `features/task-create`, 1 em `features/home`; cada um sai com o componente que testa, e os novos nascem no mesmo step.

### 5.2 Outros lugares que a task toca

| Arquivo | Hoje | Destino |
|---|---|---|
| `lib/locations.ts:219–226` `resolveHome` | A Home sem task é o primeiro board | Sem a troca (B1) |
| `store/app-store.ts` | `NewDiscussionRef` (120–123), `newTaskCard` e `pendingStart` (185–188), `openNewDiscussion` (820), `navigate`/`travel`/`reachable`/`placeIn` com `resolveHome` (527, 551, 574, 649), `readLastItem` (431–434) | O campo **Board**, `openBoardCard` e o pedido transitório, sem `resolveHome` na Home |
| `features/discussion/NewDiscussionDialog.tsx` (1–312) | O board fixo; o formulário com a chave do board e dos cards (75–76) | Ganha o campo **Board**; o texto sobrevive à troca do board |
| `features/sidebar/NewMenu.tsx:31`, `new-discussion-board.ts:11–42` | O board do lugar, da última discussão ativa ou o primeiro | Pergunta o board fora de um lugar com board; `last used` com as arquivadas |
| `features/task/CardPanel.tsx` (1–62), `card-panel.ts` (1–189) | Toda relação é link externo (58) | O card do board abre na visão (B13) |
| `components/system/RelationList.tsx` (1–80) | Só link externo | A variante de card do board |
| `components/system/Checkbox.tsx` (1–80) | A linha que marca | O sinal extraído |
| `components/system/Menu.tsx` `MenuRadioItem` (128–170), `Select.tsx` `SelectOption` (19–24) | Sem opção desabilitada com razão nem item desabilitado com ação; hoje o **Clone** é um item à parte (`RepositoryPicker.tsx:82–92`) | `SelectOption.disabled` com o `sub` como razão, e o item desabilitado com ação (§4.2), no step 4 |
| `components/system/icons.ts` (1–62) | Sem os ícones de listas | Os ícones da §4.3 #22 |
| `components/system/SearchInput.tsx:41` | `role="search"` no próprio campo | Dentro da barra de filtros, que já é `role="search"`, o campo não repete o papel |
| `styles/globals.css` (`.aux-panel`, 309–330), `globals.test.tsx:62` | A regra de 1120 px; `--panel-card-width` em `UNROUNDED_WIDTHS` | A regra do painel da lista a 800 px, arredondado no uso; o token fica na lista, e o comentário diz "arredondadas no uso" |
| `features/task/DetailsPanel.tsx:437` | Usa `--col-keys` como teto da coluna das chaves dos fatos (`minmax(0, var(--col-keys))`) | Não é editado: a coluna passa de 112 a 120 px quando o step 3 muda o token, e a chave mais longa (`Review mode`, 78 px) não corta; a prova é o arquivo novo `DetailsPanel.painted.test.tsx` (§6) |
| `internal/bindings/task_service.go:173–178` | Apaga a task quando a sessão não começa e devolve só o erro | A frase ` The task was undone.` (P22b) |
| `app/AppShell.tsx` (31–32, 58) | `BoardView`, `usePendingStart` | Ficam |

### 5.3 Os componentes do system

| Peça (`components.md`) | Hoje | Nesta task |
|---|---|---|
| Linha de lista (variante card), Cabeçalho de seção, Barra de filtros, Barra da seleção, Painel da lista, Bloco do item, Aviso de dependência, Aviso de tecla, **Continue**, Linha de início e linha de board | Não existem | Nascem, com testes de componente e pintados nos dois modos |
| `Checkbox`, `RelationList`, `Menu`, `Select`, `SearchInput`, ícones | Existem | As variantes da §5.2 (o `Select` com a opção desabilitada e o item com ação no step 4) |
| `PlaceHeader`, `SegmentedControl`, `Chip`, `Dialog` (largo), `NoticeStrip`, `SunkenLine`, `EmptyState`, `Skeleton`, `Shimmer`, `Spinner`, `StateGlyph`, `TimeChip`, `Kbd`, `Tooltip`, `Link`, `IconButton`, `Collapsible`, `ScrollArea`, `Textarea`, `Input`, `Field`; `features/models/ModelChip.tsx` | Existem (tasks 1 a 3) | Usados como estão |

### 5.4 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| O board: `readAt`, `reading`, `failure` com `reason`, `message` e `failedAt`, `viewer`, `statuses` com `final`, `repositoryIds`, `hasStatus` | `dto.go:777–814` | — (F10: `failedAt` e `readAt` passam a aparecer) |
| O card: a issue, `body`, status, `final`, responsáveis, campos, PRs, `epic`, `siblings` e `dependencies` com `onBoard`, `satisfied` e as PRs, `readAt`, `suggestedName`, `repositoryId`, `activeTaskId`, `archivedTaskId`, `action`, `otherBoard` | `dto.go:816–884` | `writtenBy` (P22), `convert.go:907–948` e `internal/discussion/service.go:637–686` |
| `In discussion` de um card de entrada | `DiscussionSummary.cards[].key` (`dto.go:1187`) | Só frontend (F7) |
| O progresso de um épico | Os `epic` da leitura e os `siblings` fora dela | Só frontend (F8) |
| As partes do contexto e o tamanho | O `BoardCard` e o texto de `CardContext` (`bindings/board_service.go:139–151`) | Só frontend, recomendado (P23, §4.4) |
| O card aberto que saiu da leitura | — | Só frontend (F9) |
| Os cards abertos, as PRs pendentes por repositório | `Board.cards[].state`; `ReviewCenter.pullRequests[].pending`, `filtered`, `pendingCount` | Só frontend (F11) |
| O board da última discussão | `DiscussionSummary.createdAt`, `ArchivedDiscussion.createdAt` | Só frontend (F12) |
| Por que `S` não age | `action`, `otherBoard`, `activeTaskId` e o nome da task | Só frontend (F13) |
| O item de **Continue** | A pilha (`NAV_STACK_KEY`) e o último item (`LAST_ITEM_KEY`, `lib/ui-storage.ts:38`), da task 2 | Só frontend |
| Que a criação foi desfeita | — | P22b, `task_service.go:173–178` |

## 6. Riscos, a task 4 e o primeiro step

| Risco | Tratamento |
|---|---|
| **A lista sem virtualização** | O volume real é 120 cards e 46 linhas visíveis (`research/board.md:281–284`); a leitura traz até 2.000 issues. A lista monta só as seções expandidas, e as linhas saem de uma função pura que devolve a lista plana, a forma de uma virtualização. No step 11, o implementador roda no app, na máquina alvo (WebKitGTK), um script com um board de 2.000 cards em 10 status, todas as seções expandidas: a primeira pintura da visão abaixo de 300 ms, uma tecla na busca abaixo de 50 ms até a lista nova e `↓` abaixo de 16 ms. Passando, `implementation.md` (task 12) registra que o board não é virtualizado; falhando, a virtualização vai para a task 12 com a medida. Não é teste da suíte: um limiar de tempo no Chromium do CI seria instável e não mede o WebKitGTK |
| **A transição dentro da branch** | No step 6, o cabeçalho, a faixa, os estados e a barra de filtros novos ficam sobre a lista de hoje; do step 7 ao 8, o painel novo mostra o conteúdo de `CardDetail`; do 9 ao 10, o diálogo novo tem **Mode**, **Review mode** e **Models** de hoje. Aceitável dentro da branch; nenhum merge parcial |
| **A memória guardada** | O formato novo do filtro lê o de hoje (pronto 4); um valor ilegível cai no padrão, como hoje (`lib/ui-storage.ts` `readStored`) |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria |
| **Os tokens que a task muda** | `design/system/tokens.css` é importado pelo app (`styles/globals.css:4`), então os três valores da §4.3 #1 e #2 entram pela pull request desta task, no step 3, com os testes, e nunca por um commit de documentação (`implementation.md:20`). Hoje eles leem 112, 56 e 544 px. Além das peças novas, o que já os lê: `features/task/DetailsPanel.tsx:437`, cuja coluna das chaves dos fatos passa de 112 a 120 px, e o `Dialog` largo, sem usuário em feature ainda. Nenhum teste afirma 112, 56 ou 544: `styles/globals.test.tsx` confere a forma dos tokens, e `Dialog.painted.test.tsx:46` resolve o token. O step 3 acrescenta só um arquivo novo, `features/task/DetailsPanel.painted.test.tsx`: a coluna das chaves de `Details` mede `var(--col-keys)` (120 px), em pixel inteiro, e nenhuma chave (`Repository`, `Review mode`, `Worktree`…) corta. `DetailsPanel.test.tsx` (jsdom, não mede) e `TaskView.widths.painted.test.tsx` não mudam |

**Onde as tasks 4 e 5 se tocam.** A task 4 mexe em `features/chat/`, `store/transcript.ts`, `features/task/` e na sessão do Go. Em `features/task/`, a 5 edita só `CardPanel.tsx` e `card-panel.ts` (e os testes deles), que a 4 não toca, e cria `DetailsPanel.painted.test.tsx`, um arquivo novo; ela não edita `DetailsPanel.tsx`, `details.ts` nem `DetailsPanel.test.tsx`, que a 4 edita. Os arquivos das duas:

| Arquivo | Task 4 | Task 5 | O conflito |
|---|---|---|---|
| `internal/bindings/dto.go`, `convert.go`, `convert_test.go` | As entradas do transcript, `PullRequest` | `BoardCard.writtenBy`, `FromBoards` | Regiões diferentes; textual |
| `frontend/bindings/**` | Gerado | Gerado | Refeito por `task generate` depois do rebase, nunca à mão |
| `lib/wails.ts`, `test/wails-mock.ts` | Os tipos e as fixtures das entradas, `GetActionOutput` | `WritingDiscussion`, `makeBoardCard` | Textual; as fixtures de cena ficam em `test/task-scenes.ts` e `test/board-scenes.ts` |
| `store/app-store.ts` | `pendingFocus` com `request`, `openSituation` | `NewDiscussionRef`, `openBoardCard`, sem `resolveHome` | Regiões diferentes; o pedido transitório do board segue a forma que a 4 der a `pendingFocus`, se ela já estiver na `main` |
| `store/app-store.test.ts` | O pedido de foco | Os testes da Home sem o primeiro board (`:1985`, `:2395`) e `openBoardCard` | Textual |
| `features/task/DetailsPanel.painted.test.tsx` | — | Novo (a coluna das chaves com o token) | Nenhum: a 4 não o cria |
| `design/implementation.md`, task 12 | O resultado da medição da conversa | O resultado da medição do board | Um parágrafo por task; textual |
| `components/system/icons.ts` | `start`, `product`, `commit`, `pullRequest`, `checks`, `compact`, `retry`, `problem`, `ban`, `subagent`, `hold` | `refresh`, `filter`, `clone`, `select`, `settings`, `plus`, `repository`, `epic` | Acréscimos no mesmo objeto; `retry` (seta única) e `refresh` (duas setas) são ícones diferentes (`components.md:83`) |
| `design/system/tokens.css` | `--size-composer-max` | `--col-keys`, `--col-dep`, `--size-dialog-wide` (step 3) | Linhas diferentes do mesmo bloco; textual |
| `styles/globals.css` | O fio da pergunta em texto, o corte do código | A regra do painel da lista, o registro de leitura do card | Blocos diferentes |
| `features/chat/Markdown.tsx` | `cutCode` | Não edita (usa `className`) | — |
| `app/useGlobalShortcuts.ts` | A ordem do `Esc` na conversa | Não edita (a visão marca o seu `Esc`) | — |
| `docs/product/features.md` §Atalhos, `docs/architecture/design-system.md` §Componentes, `docs/architecture/overview.md` §O estado, §Store | Os trechos da conversa | Os trechos do board e da Home | Parágrafos diferentes |

**A ordem de merge**: a task 4 primeiro, porque começou antes e mexe mais no store. A 5, pronta, faz rebase sobre a `main` com a 4, resolve os conflitos textuais da tabela, roda `task generate` (os `frontend/bindings/**` nunca se resolvem à mão) e `task check`, e só então o `design-critic` revisa a branch. Se a 5 ficar pronta antes, ela entra primeiro, e a 4 faz o mesmo rebase antes da revisão dela; nenhuma das duas espera a outra para começar.

**Como o primeiro step é feito.** É P22, só no Go e na fronteira: `CardWriters` e a seleção extraída de `DocumentOfCard`, com os testes de tabela de `internal/discussion` (a mais recente vence, empate pela mais nova, a arquivada conta, a apagada some, a em curso conta, e `DocumentOfCard` escolhe a mesma); `WritingDiscussion`, `BoardCard.writtenBy`, `FromBoards` e `app/state.go`; `convert_test.go`; `task generate`, `lib/wails.ts` e `makeBoardCard` com `writtenBy: null`. Nada na tela muda: a interface de hoje ignora o campo.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/overview.md` §O estado que o frontend vê, §A discussão | `BoardCard.writtenBy` e de onde vem | 1 |
| `docs/architecture/design-system.md` §Componentes | As famílias de listas, painel da lista, Home e aviso de tecla; os ícones; a regra de 800 px | 3, 4 |
| `docs/architecture/overview.md` §Store, §Features; `lib/locations.ts` descrito sem a Home resolvida | A Home sem o primeiro board, o campo **Board**, `openBoardCard` | 5, 8 |
| `docs/product/features.md` §Tela de boas-vindas e barra lateral (264–296), §Criar uma discussão (112–128) | A Home; o campo **Board** e o **+ New** fora de um lugar com board | 5 |
| §Visão do board (74–88), §Falhas (63–72), §Atalhos (759–791) | O cabeçalho, a faixa, a barra de filtros (6); as seções, a linha, o modo de seleção, as teclas e os avisos (7) | 6, 7 |
| §Visão do board (o painel), §Start task (90–104), §Leitura dos cards (46–61), §A partir de um card (317–332, o painel `Card`) | O painel na ordem nova, as ações por caso, o card fora da leitura, as relações que abrem o board | 8 |
| §Criação de uma task (304–315), §A partir de um card (317–332) | O diálogo: os campos, a linha do contexto, `Additional context` a um clique, **Mode** e **Review mode**, **Models**, os erros e a criação desfeita | 9, 10 |
| `design/implementation.md` (task 12) | O resultado da medição | 11 |

## 8. Plano de steps sugerido

Onze steps, dentro de G (9 a 14, `implementation.md:7`), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma nova que um step seguinte troque, salvo as três transições da §6, dentro da branch.

1. **P22.** A autora de cada card no Go, o DTO, os mocks (§6). Nada na tela.
2. **As funções puras.** `board-view.ts`, `card-panel.ts`, `home/home.ts`, `task-create/create-task.ts`, `adjustmentSummary`, as opções do campo **Board**, testadas em tabela contra a §4.2. Nada na tela.
3. **O system I, os tokens e as listas.** Os três tokens da §4.3 #1 e #2 em `design/system/tokens.css`, com o arquivo novo `DetailsPanel.painted.test.tsx` (§6); a linha de lista, o cabeçalho de seção, a barra de filtros com o chip órfão e o menu, a barra da seleção, o sinal da caixa, o aviso de tecla, os ícones, o `role` do `SearchInput`; testes de componente e pintados nos dois modos. Nada na tela muda além da coluna das chaves de `Details`.
4. **O system II, o painel e a Home.** O painel da lista com a regra de 800 px e o arredondamento no uso, o bloco do item, o aviso de dependência, a variante de card da lista de relações, a opção desabilitada com razão do `Select` e o item desabilitado com ação, **Continue**, a linha de início e a de board. Nada na tela.
5. **A Home (B1, B2).** `Home.tsx`, `resolveHome` sem o board, o foco inicial, o campo **Board** no diálogo de discussão e no **+ New**, **New discussion** tracejado sem board lido. Sai o `Home` de hoje e os testes do primeiro board.
6. **A visão do board I: o cabeçalho, a faixa e os filtros (B3, B4, B9).** O cabeçalho com a idade, **Refresh**, **New discussion** `N` e o `⋯`, a faixa e os estados da leitura com a precedência, a barra de filtros com a memória nova e a frase do filtro sem resultado, sobre a lista de hoje. Saem `BoardHeader` e `BoardFilterBar`.
7. **A visão do board II: a lista (B5, B6, B10 na linha).** As seções, a linha nas duas larguras, o modo de seleção com `· filtered`, o teclado, o foco que perde a linha, os avisos de tecla da lista, o piscar do card novo; o painel novo com o conteúdo de `CardDetail`. Saem `CardList`, `CardRow`, `SelectionBar` e o `ResizablePanelGroup`.
8. **O painel do card (B7, B8, B10 no painel, B13).** O conteúdo na ordem nova, as ações por caso, o card fora da leitura, **Add to board** no `Dialog` do system, o foco depois de **Add to board** e de **Change path…**, as relações que abrem o card, `openBoardCard` e o painel `Card` da task. Saem `CardDetail` e `StartTaskAction`.
9. **O diálogo de criação I (B11, B12, P22b).** A frase ` The task was undone.` no Go, com o teste; o `Dialog` largo, o bloco do card e o seletor de repositório com **Clone** no item, **Name** com `Enter`, o contexto livre e a linha do contexto com **Show**, **Add to it**, a releitura e o card que sai, os avisos de dependência, o rodapé com as razões, `Creating…` e os erros. Saem `CardSummary`, `CardContextPreview` e `RepositoryPicker`.
10. **O diálogo de criação II (B11).** **Mode** e **Review mode** no controle segmentado com as linhas, o resumo de modelos e a lista com o `ModelChip`. O diálogo deixa de usar `ToggleGroup`, `ReviewModePicker` e `ModelPicker`.
11. **As cenas e a medição.** `test/board-scenes.ts`, os três testes pintados das cenas com as capturas, `where-actions-went.test.tsx`, o script de medição no app e o registro em `implementation.md`, a conferência de `docs/` contra o que a task fez.

Depois do step 11 e do rebase da §6, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md` B1–B13, com B3 e B5 confirmadas pelo usuário (`decisions.md:25–27`, `implementation.md` §4) e B13 no escopo que ele confirmou (`implementation.md:94`, `task.md:291`). O que sobrou de produto foi decidido pelo coordenador, por delegação, em `decisions.md:9–11` (o `In discussion` do card escrito por uma discussão ativa e o link para a autora arquivada; o campo **Board** também pelo **+ New**; o item de **Continue** pela pilha de lugares; **Add to board** sem continuar sozinho; a task 5 em paralelo com a 4). Nenhuma delas muda um fluxo inteiro, destrói dados ou contradiz o que o usuário aprovou. O PRD não pergunta nada ao usuário.
