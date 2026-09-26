# Task 2 · Fundação II: shell, árvore, navegação com histórico, painéis e barra do pedido

Material de entrada da segunda task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 2 de `design/implementation.md` (§2, linhas 54–64), com os princípios da §1 (linhas 9–21) e os riscos da §3 (linhas 184–195). Parte de `main` em `9aa29b6`, com a task 1 mergeada: tokens de uma fonte só, Fira, `data-theme` e os wrappers de `components/system/`. Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa.

Toda decisão de design está tomada neste documento (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; a §4.3 lista o que este material decidiu onde os documentos de `design/` calavam, para o coordenador vetar antes do PRD se discordar.

## 1. Objetivo e critério de pronto

A lateral vira a árvore de `structure.md` §2: Reviews, os boards, os épicos e No board, com a linha de três linhas, os glifos de tipo e de estado, os dois relógios, o `Ctrl J` na linha, os nós recolhidos com resumo e a faixa de 60 px; a seção **Waiting for you** sai. A área principal passa a mostrar um **lugar** por vez, com uma pilha de histórico lembrada entre execuções, `←`/`→`, breadcrumb, painéis auxiliares pela regra coluna-ou-cobertura e a página do item que saiu, com as telas atuais dentro. O backend passa a expor a ação em curso e o início do turno de cada sessão (P1), e o shell ganha a barra do pedido, o aviso do app e a região de toasts como componentes do system.

**Pronto quando** (`implementation.md:64`):

- a árvore mostra Reviews, os boards, os épicos, No board e todos os estados da linha (erro, espera, encerramento, trabalhando, publicando, GitHub, pausado, ocioso, aviso de clone), cada linha com o nome acessível inteiro, provado por `getByRole("treeitem", { name })`;
- `features/sidebar/sidebar-tree.ts` tem a gravidade, a ordem do `Ctrl+J`, a posição curta e longa e o resumo dos nós como funções puras, testadas sem renderizar;
- `←`/`→` e `Alt+←`/`Alt+→` percorrem a pilha, com o destino no tooltip; a pilha sobrevive a um reinício; Settings fecha para onde estava;
- os painéis começam fechados, abrem um por vez, `Esc` fecha, e viram coluna ou cobertura pela regra, em pixel inteiro;
- a barra do pedido renderiza as quatro formas e a de "a outra conversa espera", com `role="region"` e o texto em `role="status"` (ligada às situações só na task 4);
- um item que sai com a tela aberta mostra a página do item que saiu; um que sai fechado gera um toast;
- nada quebra de 1100 a 2600 px, com a lateral em `clamp` e recolhida em 60 px, nos dois modos;
- `task check` verde em todo step;
- `features.md` §Depende de mim, §Tela de boas-vindas e barra lateral, §Atalhos e §Encerramento e arquivamento reescritos, e a família Shell em `design-system.md` (§7).

`changes.md`: S1, S2, S3, S4, S5, S6, S7 (a forma genérica), S8 (o componente), S9 (o mecanismo), X16. `backend.md`: P1, P2; F1, F2, F19.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–21), task 2 (54–64), riscos (189, 193, 195) | O escopo, o pronto, a regra do app sempre usável (15), os testes que migram com a tela (21), o meio pixel (189), o refactor da navegação (193), a pilha que começa vazia (195) |
| 2 | `design/decisions.md`: modelo do shell (69–71), meta da linha (49–51), desvios absorvidos (53–55), tempo e contexto de longe (77–79), largura contínua (81–83), papéis do azul (45–47) | O que o usuário aprovou e não se reabre |
| 3 | `design/structure.md` §1 (7–38), §2 (40–134), §3 barra do pedido (182–227) e painéis (239–266), §5 (279–317), §6 (319–334), §7 (336–359) | O modelo de lugares, a árvore inteira, a barra, os painéis, os atalhos, as larguras e os estados. §3 cabeçalho (148–161) só no que é do cabeçalho de lugar |
| 4 | `design/principles.md` 1, 2, 4, 5, 8, 9, 10 | Cor é sinal; o azul na linha aberta e no `Ctrl J`; negrito no nome que espera; glifo, cor e rótulo; 280 ms duas vezes; foco por fora, seleção por dentro; pixel inteiro |
| 5 | `design/system/components.md`: estados comuns (18–27), Glifo (54–64), Ícones (76–85), Tooltip (96–105), Tecla (107–116), Troca de lugar (138–144), Chip de tempo (176–185), grupo **Shell** inteiro (285–430, sem a Idade da leitura, 298–304, que é da task 5), Barra do pedido (460–473), Medidor (584–592), Resultado do encerramento (773–778) | A anatomia, os estados, os tokens, o teclado e a acessibilidade de cada peça. Onde diverge de `structure.md`, vale `components.md` (`implementation.md:5`) |
| 6 | `design/system/tokens.css`: medidas (53–57), árvore (85–87), layout (89–93), movimento (117–122), camadas (124–125) | `--sidebar-width` já arredondada (91); `--panel-width` sem `round()` (93), que esta task arredonda |
| 7 | `design/changes.md` S1–S9 (11–19), X16 (127) | O que muda de comportamento e a seção de `features.md` que cada linha reescreve |
| 8 | `design/backend.md` P1 (27), P2 (28), F1 (98), F2 (99), F19 (116) | Os dados, e a §5.3 deste material, que diz o que já existe |
| 9 | `design/screens/task.md` §3 (34–56, a tabela de largura do cabeçalho), §7 (168–208, a barra); `screens/rest.md` §8 (418–435), §9 (437–455), §13 (610–632); `screens/board.md` §2 (32, o cabeçalho da Home) e a linha 240 (board removido) | O que o documento de tela detalha sobre o shell |
| 10 | Mocks, servidos com `python3 -m http.server 8090 -d design/lab`: `08-visual-final/index.html` (a árvore: `ariaFor`, `itemRow`, `nodeRow`, `sidebar`, 983–1050; a piscada, 438–439 e 533–547) e `specimen.html` (a linha em todos os estados, 1576; o nó recolhido, 1585); `10-screen-task-minimal/b.html` (a árvore, 1529–1595, e o indicador, 1798–1804); `03-structure-final/a.html` só na navegação (`go`/`back`/`fwd`, 1100–1108), na faixa recolhida (`stripHtml`, 1213–1228), no resumo do nó (`nodeSummary`, 1152–1161), nos painéis (`widths`, 1282–1289) e na página do item que saiu (`goneView`, 1326) | A referência visual. O 03 é wireframe: a forma vem do 08 e do 10-b; o 03 só dá o comportamento |
| 11 | `docs/guidelines/README.md`, `frontend.md`, `testing.md`; `docs/architecture/design-system.md` §Componentes (91–118) | Como um step acontece, onde mora um componente, o teste por nome acessível |
| 12 | O código da §5 deste documento | O inventário do que muda |

## 3. Escopo

**Dentro**, cada item verificável:

1. **P1 no backend.** Cada bloco de sessão dos DTOs ganha o início do turno em curso e a ação em curso (rótulo e alvo), preenchidos em `session.Summary`; `state:changed` sai também quando uma ação começa e termina (§4.4).
2. **P2 e F2 no frontend.** Uma função pura lista as sessões de um item com o papel (`Implementer`, `Reviewer`, a etapa, a PR, o review, a discussão), o status e se trabalha, lida dos blocos que já existem (§5.3).
3. **O lugar no store.** Um modelo `place` e a pilha do histórico no lugar de `openTaskId`, `openReviewId`, `openDiscussionId`, `openArchivedId`, `openArchivedReviewId`, `openArchivedDiscussionId`, `openBoardId`, `reviewsOpen`, `historyOpen`, `settingsOpen`; os seletores atuais derivados do lugar; a pilha, o lugar e o último item ativo persistidos (F1).
4. **Navegação.** `←`/`→` no cabeçalho, `Alt+←`/`Alt+→`, o breadcrumb que dobra, Settings que fecha para o lugar anterior (`Esc`, **Close**, `Ctrl+,`, `←`).
5. **`features/sidebar` inteiro.** Topo com a marca, **+ New ▾** e `«`; o filtro no `Select` do system, com `· clone missing` e `· not cloned`; a árvore com Reviews dentro dela, os boards, os épicos, No board, o aviso de clone como `treeitem`, a linha de três linhas, o meta em hover, foco e linha aberta, `Ctrl J` na linha; o teclado de `structure.md` §2; os nós recolhidos com o resumo por gravidade; o indicador `↓ N more below`; o rodapé com **History** e a contagem, o tema em ciclo e **Settings**; a faixa recolhida de 60 px.
6. **S1.** `features/attention/WaitingSection.tsx` e o teste saem.
7. **Situação nova.** `Ctrl+J` pela gravidade e pela idade; a chegada por `situation:open` como uma ida; a piscada de 280 ms duas vezes no véu da gravidade; a região `aria-live` do app.
8. **`components/system/`, família Shell**: cabeçalho de lugar, painel auxiliar e grupo de painéis, barra do pedido, página do item que saiu, aviso do app, toast e região de toasts (que é a região `aria-live`), e os ícones de tipo.
9. **O cabeçalho de lugar em todos os lugares**, com o conteúdo antigo de cada cabeçalho no lado direito (§4.3, decisão 1).
10. **Os três painéis de item que existem** (`Artifacts` da task, `Reports` do review, `Documents` da discussão) saem do `react-resizable-panels` para o painel auxiliar, com o conteúdo atual; o painel de artefatos deixa de abrir sozinho (S9).
11. **A página do item que saiu** para task, review, discussão e board, na forma genérica.
12. **O aviso do app** no lugar de `ErrorNotice`, com o rótulo da ação que falhou (X16, F19).
13. **O toast de arquivamento de task** na região nova, só para a task que saiu sem estar aberta.
14. **Documentação** da §7.

**Fora**, e o que continua com a forma antiga dentro do shell novo:

- O conteúdo de todo lugar: a Home (task 5), a visão do board com o painel do card, que continua em `react-resizable-panels` (task 5), Reviews (6), History e os arquivados (11), Settings (10), a tela da task abaixo do cabeçalho (3 e 4), a tela do review e a da discussão (6 e 9). Cada uma entra no lugar novo como está, retematizada.
- A **Idade da leitura** (`components.md:298–304`, task 5).
- A barra do pedido **ligada às situações** e o foco nela (task 4); aqui ela é o componente, testado nas quatro formas. `StepBar`, `PRBar`, `ReviewBar`, `DiscussionBar`, `ReviewStrip` continuam.
- O foco no que o item pede ao chegar por `Ctrl+J` (a primeira opção do cartão, a barra): task 4. Aqui o foco vai ao título do lugar.
- O conteúdo da página do item que saiu por tipo (o resultado do encerramento, as passadas, as rodadas, o que ficou no disco): tasks 6, 9 e 11 (P27, P29).
- Os textos das notificações (task 11), o toast de review e de discussão (F20, task 11), o destaque da linha recém-arquivada no History (task 11), `LeftoversNotice` (sai na task 11; até lá, no lugar do aviso do app, §4.2).
- O campo **Board** do diálogo de discussão aberto de fora de um board (B2, task 5).
- `Starting MySpec…` e a lateral em esqueleto no início (X17, task 10); boas-vindas com **New** e **History** tracejados (task 10).
- Remover `attention-flash-ring`, os keyframes antigos e `react-resizable-panels` do `package.json` (task 12): `StepTabs` continua com a piscada antiga até a task 3.
- `AgentTabs`, o stepper, o `⋯`, `Ctrl+E` (task 3).

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| Um lugar por vez; abrir um item é ir a um lugar; não há camadas nem modais de lugar | `structure.md:9–19`; `decisions.md:71` |
| Toda ida entra na pilha; ir a um lugar novo limpa o que estava à frente; pilha e último item aberto lembrados entre execuções | `structure.md:21`; `backend.md:98` (F1) |
| Settings e History são lugares; fechar Settings volta ao anterior, nunca à Home | `structure.md:23` |
| A árvore nunca reordena sozinha; ordem de criação dentro de cada nó; Reviews primeiro, boards em ordem alfabética, No board por último e só com algo | `structure.md:53` |
| Gravidade: erro > espera > encerramento; sem situação: agente > GitHub > pausado > ocioso. A cor de atenção vem só das situações | `structure.md:97–98` |
| `Ctrl+J`: o primeiro item que espera, fora o aberto, o mais grave e depois a espera mais antiga; a marca `Ctrl J` na linha que ele abriria, em qualquer largura | `structure.md:65, 100` |
| Os dois relógios: o chip (do usuário, da situação mais grave e, entre iguais, da mais antiga) e o texto do turno (do agente); um spinner só, no início da linha 2 | `structure.md:90`; `decisions.md:55` |
| Meta (`repo#card`, `repo#PR`, `#cards`, `One-Shot`) só em hover, foco e linha aberta, só quando cabe ao lado do nome inteiro; senão no tooltip do nome; sempre no nome acessível | `decisions.md:51`; `components.md:313` |
| Nome que espera em 600; linha aberta com `--brand-veil`, anel `--brand-ring` colado, glifo de tipo em `--brand-ink`, meta e ação sobem a `--ink-3` | `principles.md` 4; `components.md:312` |
| Erro com três portadores: losango, chip quadrado com `!`, trilho à esquerda | `structure.md:99` |
| Nó recolhido com resumo por gravidade, o mais grave nomeado, nome acessível com todos, lembrado entre execuções | `structure.md:115` |
| Faixa de 60 px, um bloco por item | `structure.md:117–126`; `components.md:339–345` |
| Lateral `round(down, clamp(18rem, 8vw + 12.5rem, 23.75rem), 1px)`; abaixo de 330 px o meta sai e os rótulos passam à forma curta; abaixo de 370 px a ação passa à forma curta | `tokens.css:91`; `structure.md:325–326` |
| Piscada: 280 ms, duas vezes, no véu da gravidade; nenhuma com `prefers-reduced-motion`; continuações não piscam | `principles.md` 8; `structure.md:105–111` |
| Região `aria-live="polite"` anuncia cada situação nova uma vez; mudanças de gravidade não são anunciadas linha a linha | `structure.md:111` |
| Painéis fechados por padrão, nunca abertos sozinhos, um de cada vez, `Esc` fecha; coluna quando `área principal − painel ≥ 760 px`, senão cobre com `--surface-3` e `--shadow-overlay` | `structure.md:243–266`; `components.md:362–374` |
| Barra do pedido: quieta, tingida (e de decisão), erro, encerramento, e "a outra conversa espera"; `role="region"` com nome, estado em `role="status"`; quebra em duas linhas antes de esconder uma ação | `structure.md:190, 227`; `components.md:460–473` |
| Página do item que saiu: ícone neutro, título, o que aconteceu, o resultado afundado, **Next that needs you** `Ctrl J` primária com o foco (tracejada com `Nothing else needs you now.` quando nada espera, e então **Open in History** é a primária), **Open in History** (menos no apagado), a volta | `structure.md:38`; `components.md:376–382`; `rest.md:437–455` |
| Aviso do app: faixa no topo da área principal, sobre o cabeçalho, `--state-error-veil` com trilho, rótulo vermelho em 700 com a ação que falhou, detalhe, **Dismiss**; uma por vez; `role="alert"` | `components.md:425`; `rest.md:418–426`; X16 |
| Toast: `--surface-3`, `--shadow-float`, até `--size-toast`, 10 s, até três empilhados, embaixo à esquerda da área principal (`--z-toast`), `role="status"` | `components.md:426–429` |
| Troca de lugar imediata, sem deslizar; a linha do lugar trazida à vista na mesma troca | `components.md:138–144` |
| Os atalhos globais ficam inertes com os diálogos de criação abertos; `Cmd` vale por `Ctrl` | `structure.md:315` |

### 4.2 Decisões de design, detalhadas

**A linha de um item** (`structure.md:59–93`; `components.md:306–318`; mock `08-visual-final/index.html:993–1016`). Grade de três colunas: glifo de 16 px, texto, borda direita.

| Linha | Conteúdo |
|---|---|
| 1 | Ícone de tipo (task, One-Shot, review, discussão) e o nome, que ocupa as colunas 2 e 3. À direita, a marca `Ctrl J` (tecla com `--brand-tint` e `--brand-ring`) na linha que o atalho abriria, sempre; senão o meta, só em hover, foco ou aberta e só se couber |
| 2 | Glifo de estado; o texto (situação e posição, ou só a posição); `+N` com as outras situações no tooltip (`Permission · Implementer · 4m`); na borda direita o chip de espera, ou o relógio do agente em `--ink-3`, ou a palavra (`GitHub`, `idle`) |
| 3 | Só com o agente trabalhando: a ação em curso em mono, verbo primeiro, e o medidor com a porcentagem. Sem ação em curso, a atividade da conversa: `Starting session…`, `Thinking…` ou `Retrying · attempt N` |

| Estado | Glifo (`StateGlyph`) | Linha 2 | Borda direita | Linha 3 |
|---|---|---|---|---|
| Erro | `error` | `Session error · Plan` | `TimeChip` erro | — |
| Esperando | `wait` | `Question · Reviewer · Step 3/7` (curta `Question · Step 3/7`), `+N` | `TimeChip` espera | — |
| Encerramento | `close` | `Ready to close · PR #1279 merged` (curta `Ready to close · #1279`), `Ready to archive` | `TimeChip` encerramento | — |
| Trabalhando | `work` (o único spinner) | a posição: `Step 2/5 · Reviewer pass 2` (curta `Step 2/5 · pass 2`) | o relógio do turno | ação e medidor |
| Publicando (discussão) | `work` | `Round 1 · publishing` | — | — |
| GitHub | `github` | `PR review · waiting for checks` (curta `PR review · checks`); `PR review · checking GitHub` antes da primeira leitura | `GitHub` | — |
| Pausado | `paused` | `Paused · <etapa>` | — | — |
| Ocioso | `idle` | o estado (`Published · changes requested`) | `idle` | — |

- **O texto com situação**: longa `<rótulo> · <lugar> · <posição>`, curta `<rótulo> · <posição>`. O rótulo é o de `lib/situations.ts:37` (`situationLabel`). O lugar: a etapa (`PRD`, `Tech spec`, `Plan`, `Planning`), `Implementer`, `Reviewer`, `PR`; o review e a discussão não têm lugar, o rótulo já diz. Um rótulo que já nomeia o step passa a `Step N/M` (`Step 2/4 blocked · worktree not clean`, curta `Step 2/4 blocked`). O progresso de decisão entra na posição: `Decide findings · pass 1 · 5 of 9` (curta `Decide findings · 5/9`), `Decide drafts · 3 of 6 decided` (curta `Decide drafts · 3/6`).
- **A posição**, por tipo: task, o nome da etapa como o stepper a nomeia (`PRD`, `Tech spec`, `Plan`, `Planning`, `PR`, `PR review`, `Closing`) e, na implementação, `Step N/M`, com o laço (`Reviewer pass 2`, curta `pass 2`; `round 1 of 3`, curta `round 1`); review, `Pass N`; discussão, `Discussing`, `Round N`, `Ready to archive`. A posição nunca sai, também na forma curta.
- **Checks sem P13.** A contagem `checks 3/5` depende de P13, que é da task 3; até lá a linha diz `waiting for checks` / `checks`, e a task 3 troca pelo número.
- **O relógio do agente** usa o formato do chip (`now`, `5m`, `2h`) e o tooltip por extenso (`Agent working on this turn for 3 minutes 20 seconds`). Tudo lê `useNow` a cada 60 s (`features/attention/useNow.ts`).
- **One-Shot** tem ícone próprio em qualquer largura.
- **O nome acessível** (`structure.md:92`; mock `ariaFor`, `08/index.html:983–991`) é uma frase: `<tipo> <nome>. <tom>: <rótulo> · <lugar>, for <tempo>; … . <posição>. <Quem> working for <tempo>: <verbo> <alvo>. context <N>% used. <meta>`, com o tipo `task`, `One-Shot task`, `pull request review`, `discussion` e o tom `error`, `waiting for you`, `ready to close`, `agent working`, `waiting on GitHub`, `paused`, `idle`. O chip de tempo esconde o próprio texto (`aria-hidden`), porque a frase já o diz.
- **Aviso de clone** (`structure.md:56`; mock `noticeRow`): `treeitem` no topo do nó do repositório (o board dele, ou No board), com `◇` (`StateGlyph blocked`), `<repo> · clone missing`, a dica `Change path ↵` à direita, nome acessível `<owner/name>: the clone at <path> is missing. Enter to change the path.`; `Enter` e o clique chamam `changeRepositoryPath`. A recusa aparece como hoje, sob o item.

**Os nós** (`components.md:320–330`). Board: 14 px, 500, `--ink-2`, abre a visão do board, e à direita `reading…` com brilho durante `board.reading` ou `◇ Read failed` com `board.failure.message` no tooltip; vazio, `No active items.` Reviews: abre o lugar Reviews, `N pending` à direita (`reviewCenter.pendingCount`), `reading…` durante `reviewCenter.reading`, e `No review in progress.` sem review ativo. Épico: 13 px, 500, `--ink-3`, com a guia; só expande e recolhe. No board: só com algo. O nó do lugar aberto (visão do board, Reviews) tem `aria-current="page"` e o véu da linha aberta.

**O resumo do nó recolhido** (`structure.md:115`; `specimen.html:1585`; `03/a.html:1152–1161`): um glifo e uma contagem por estado, do mais grave ao menos (erro, espera, encerramento, trabalhando, GitHub, pausado; o ocioso não conta), só o primeiro com a palavra (`error`/`errors`, `waiting`, `to close`, `working`, `checks`, `paused`). Nome acessível com todos: `1 error, 2 waiting, 1 ready to close, 1 on GitHub`. Um nó de board recolhido conta também os épicos dentro dele.

**O teclado da árvore** (`structure.md:57`). Uma parada de Tab (roving tabindex), na linha aberta ou na primeira. ↑↓ movem **o foco** pelo que está visível, nós, itens e avisos incluídos, sem abrir nada; `Home`/`End` vão às pontas; → expande um nó recolhido ou entra no primeiro filho; ← recolhe um nó aberto ou sobe ao pai; `Enter` abre: o item, a visão do board, Reviews; num épico e em No board, alterna; no aviso de clone, **Change path**. O foco numa linha mostra o tooltip do nome na hora (`components.md:101`). Muda o que `features.md:285` diz hoje: "a task sob o foco sendo a que abre" deixa de valer; isso entra na reescrita de §Tela de boas-vindas e barra lateral.

**O indicador** `↓ N more below` (`components.md:332–337`; `10-b.html:1798–1804`): conta os itens abaixo da vista, não é parada de Tab, o clique rola ao fim.

**A faixa recolhida** (`components.md:339–345`; `03/a.html:1213–1228`). `«` no topo recolhe, `»` expande; a escolha é lembrada entre execuções. Um bloco por item, na ordem da árvore: ícone de tipo com o glifo de estado no canto; embaixo o chip, ou o relógio do turno, ou a palavra (`checks`, `paused`, `idle`); `+N`; o trilho no erro. Entre os grupos, um separador com o `◇` da falha de leitura ou do clone e, em Reviews, a contagem de pendentes. O nome acessível de cada bloco é o da linha; o tooltip, o nome. A faixa é `role="tree"` com o mesmo teclado. O rodapé fica em coluna.

**O topo e o filtro.** A marca e `MySpec`; **+ New ▾** (`components.md` §Botão, variante New) abre um menu com **New task** `Ctrl N`, **Review a pull request** (vai ao lugar Reviews) e **New discussion**; `«`. O filtro é o `Select` do system com **All repositories** e os repositórios em ordem alfabética, com `· clone missing` (`repository.missing`) e `· not cloned` (`!repository.cloned`). O que ele esconde não muda: com um repositório escolhido, a árvore mostra Reviews, o nó do board do repositório (com as discussões dele) ou No board, e só as tasks e os avisos desse repositório (`sidebar-tree.ts:84–87`); sem tasks, `No tasks in <nome curto>.`

**O rodapé** (`components.md:355–360`). **History** com a contagem de arquivados (tasks, reviews e discussões; tooltip `44 archived: 22 tasks, 12 reviews, 10 discussions`; sem contagem quando zero); o seletor de tema, fantasma de ícone, em ciclo System → Light → Dark, `aria-label` e tooltip `Theme: System · click to change`, aplicado na hora por `setTheme`; **Settings** com o tooltip `Settings · Ctrl+,`. **History** fica pressionado com History ou um arquivado aberto, **Settings** com Settings, com `--brand-tint-plane`, `--brand-marker-ring` e `aria-current="page"`.

**O modelo de lugar e a pilha** (`structure.md:9–23`; `03/a.html:1100–1108`).

- Lugares: Home, board (id), Reviews, History, Settings (página), task (id), review (id), discussão (id), task arquivada (id), review arquivado (id), discussão arquivada (id), e a página do item que saiu (tipo, id, destino).
- Toda ida empilha o lugar anterior e limpa a frente. Ir ao lugar em que já se está não empilha. Trocar de página dentro de Settings não empilha. A página do item que saiu **substitui** o lugar do item na pilha.
- `←`/`→` pulam as entradas cujo item ou board não existe mais, e a página do item que saiu não é revisitada: sair dela a tira da pilha.
- Uma navegação fecha o painel aberto, e voltar não o reabre.
- A aba do step (`openStepTab`) não é lugar: continua no store como hoje, e a chegada a uma situação do revisor escolhe a aba dele (`app-store.ts:318–335`).
- O app abre na Home, com a pilha lembrada atrás dela: `←` leva ao último lugar da execução anterior. O último item ativo aberto é guardado para o **Continue** da task 5. A primeira execução depois desta task começa com a pilha vazia (`implementation.md:195`).
- A navegação que sai de uma edição de prompt não salva continua pedindo `Discard your changes?` (`app-store.ts:476–484`), `←`/`→` incluídos.

**`←`, `→` e o breadcrumb** (`components.md:287–296`; `task.md:34–56`). `←` fantasma de ícone, tooltip `Back to <título do destino> · Alt+←`; sem destino, desabilitado com a razão `Nothing to go back to`. `→` só existe com destino, tooltip `Forward to <título> · Alt+→`. O breadcrumb, em 13 px `--ink-3` com `/` em `--line-deco` e `aria-hidden`, `nav` com `aria-label="Breadcrumb"`: task e discussão, `<board> / <épico> /` ou `No board /`; review, `Reviews /`; arquivados, `History /`; board, Reviews, History, Settings e Home, nenhum. O board e Reviews são links para o lugar; o épico é texto, porque não é lugar. Abaixo de 1660 px de área principal (container query), os níveis dobram num botão `…` com os níveis num menu, `aria-label="Show the hidden levels: <níveis>"`. O título em `--text-body` e 600. `Alt+←`/`Alt+→` valem em qualquer lugar, com o foco num campo de texto também, menos com os diálogos de criação abertos.

**Settings.** Abre por **Settings**, `Ctrl+,` e os links que já o abrem; fecha por `Esc` (quando nada mais está aberto, na ordem de `structure.md:287`), **Close** `Esc` no cabeçalho, `Ctrl+,` e `←`, sempre para o lugar anterior; sem anterior, para a Home.

**`Ctrl+J` e a chegada por notificação** (`structure.md:31–37`). Os dois vão pelo mesmo caminho: a ida ao lugar da situação mais grave e mais antiga do item (a aba `Reviewer` numa situação do revisor), empilhada; os nós que escondem a linha se abrem e a linha rola à vista (`block: "nearest"`); o foco vai ao título do lugar (a task 4 o leva ao cartão ou à barra). A janela à frente já é do Go (`internal/app/notifications.go:175–187`). Sem nada esperando, `Ctrl+J` não navega e a região `aria-live` diz `Nothing else needs you now.` Uma notificação de uma situação cujo item sumiu não navega, como hoje.

**A piscada** (`principles.md` 8; `08/index.html:438–439, 533–547`). Ao `situation:started` com a janela em foco, o que é visível pisca duas vezes, 280 ms (`--duration-slow`, `--ease-standard`), do véu para transparente: `--state-error-veil` no erro, `--state-wait-veil` na espera e no encerramento. Pisca: a linha na árvore, o bloco na faixa recolhida, o resumo do nó recolhido que a esconde. A linha do item aberto não pisca. Com `prefers-reduced-motion`, nada pisca e nenhum véu fica parado (a regra antiga que deixa a cor fixa, `styles/globals.css:335–342`, não vale para a nova).

**A região `aria-live`.** Uma só, `aria-live="polite"`, dentro da região dos toasts (`components.md:427`). Anuncia cada `situation:started` uma vez: `<nome do item>: <rótulo> in <lugar>` (`Rate limit per API key: question in Reviewer`), com as palavras da linha, sem o tempo; continuações não chegam como `situation:started` (`internal/attention/service.go:214–260`). Anuncia também o `Ctrl+J` sem destino. A task 4 tira do anúncio a situação do lugar na tela, que a barra do pedido anuncia.

**O painel auxiliar e o grupo** (`components.md:362–374`).

- Coluna à direita da área principal, `--surface-0`, largura `round(down, clamp(22.5rem, 28%, 30rem), 1px)` da área principal. Cabeçalho de `--size-head` com o título em `--text-ui` 600 e o `×` (`Close · Esc`); corpo que rola, em `--text-meta`. `aside` com nome (`Artifacts`, `Reports`, `Documents`).
- Coluna quando `área principal − painel ≥ 760 px`; senão cobre a conversa com `--surface-3` e `--shadow-overlay`. A conta dá um limite só: **coluna com a área principal a partir de 1120 px** (a 1120 o painel tem 360 e sobram 760; acima de 1286 px o painel cresce a 28% e a sobra passa sempre de 760). Com a lateral aberta isso cai em cerca de 1435 px de janela; recolhida, 1180. É uma container query, em pixel inteiro.
- Entra em `--duration-base` com `--ease-enter`. Não é modal: o foco fica no botão que o abriu; `Esc` fecha e devolve o foco a ele.
- O grupo: os botões dos painéis do lugar no cabeçalho, um que alterna, o aberto pressionado (`--brand-tint-plane`, `aria-pressed`); abaixo de 1440 px de área principal, só o ícone, com o nome no tooltip e no nome acessível. Um de cada vez.
- A medida da conversa (`--measure-conversation`, 960 px) é maior que os 760 da regra: com o painel em coluna, a conversa ocupa a área que sobra menos `--space-6` de cada lado (`task.md:28`). A regra fica em 760, como `components.md:368` diz.

**A barra do pedido** (`components.md:460–473`; `task.md:168–208`). À esquerda o glifo, o rótulo em 700, o lugar e o chip; no meio o progresso; à direita as ações, que seguem o `Button` (carregando, desabilitado tracejado com a razão). Na medida da conversa, `--size-ask` de altura mínima, quebra em duas linhas antes de esconder uma ação. Formas: quieta (`--surface-0`, **Show**), tingida (`--state-wait-veil`; a de decisão com o progresso, **Next to decide** `Alt ↓` e a primária tracejada com o que falta), erro (`--state-error-veil` com trilho), encerramento (fundo quieto, rótulo em `--state-close`), e a outra conversa espera (quieta, `● The reviewer waits · Question 18m` e **Go to reviewer**). `role="region"` com `aria-label="Request"`; o texto de estado em `role="status"`. Ao nascer com a tela aberta, pisca como a linha. Nenhuma tela a usa nesta task.

**A página do item que saiu** (`rest.md:437–455`; `components.md:376–382`). No lugar do item, na medida `--measure-read`: ícone neutro, título em `--text-title`, o texto, o resultado afundado e as ações. O cabeçalho tem `←` e o nome do item; a árvore já não o mostra.

| Caso | Como se sabe (F2) | Título | Ações |
|---|---|---|---|
| Task encerrada | some de `tasks` e está em `history` | `<nome> was closed and archived` | **Next that needs you**, **Open in History**, **Back to <board>** (ou **Back to No board**, que leva à Home) |
| Task apagada | some de `tasks` e não está em `history` | `<nome> was deleted` | **Next that needs you**, **Back to <board>** |
| Review encerrado | some de `reviews` e está em `reviewHistory` | `<repo>#<N> was merged, and its review ended` (ou `was closed`) | **Next that needs you**, **Open in History**, **Back to Reviews** |
| Discussão arquivada | some de `discussions` e está em `discussionHistory` | `<título> was archived` | **Next that needs you**, **Open in History**, **Open <board>** |
| Discussão apagada | some e não está no histórico | `<título> was deleted` | **Next that needs you**, **Open <board>** |
| Board removido | some de `boards` com a visão aberta | `This board was removed.` | a volta ao lugar anterior (`board.md:240`) |

O texto e o bloco do resultado ficam vazios nesta task: são as partes que as tasks 6, 9 e 11 preenchem. O foco começa em **Next that needs you**, ou em **Open in History** quando nada espera. Onde `task.md:330` e `components.md:380` dizem `This task was deleted.`, vale `rest.md` §9, o documento da página.

**O aviso do app** (X16). Substitui `ErrorNotice` (`features/notice/Notice.tsx:47–53`) no topo da área principal, sobre o cabeçalho. O rótulo é a ação que falhou, com o item: `Couldn't pause Rate limit per API key`, `Couldn't refresh the board Platform Roadmap`; o detalhe é a mensagem do erro, como hoje; **Dismiss**. A próxima falha substitui a anterior. `LeftoversNotice` passa a ocupar o mesmo lugar, na forma que tem, até a task 11.

**O toast.** A região `.toasts`, embaixo à esquerda da área principal. Nesta task, só o arquivamento de uma task que não estava aberta: ícone de arquivo, `"<nome>" was archived`, **Open in History** sob o texto, `×`; 10 s; até três. A task aberta que é arquivada não gera toast: a página diz o mesmo.

### 4.3 Decididas aqui, onde `design/` não decide

| # | Lacuna | Decisão | Razão |
|---|---|---|---|
| 1 | Como o cabeçalho de lugar convive com os cabeçalhos antigos até as tasks 3, 5, 6, 9, 10 e 11 | Todo lugar renderiza o cabeçalho de lugar. O título antigo vira o título dele; o resto do cabeçalho antigo (etiquetas, **Pause**, os botões, o apagar) vai inteiro, na ordem, para o lado direito. Settings, History e Home ganham o cabeçalho com o título; o `h1` de dentro da página sai. Os arquivados trocam o **← History** pelo breadcrumb `History /` | Uma faixa só por lugar, sem duas versões do topo; cada task de tela troca só o lado direito (`implementation.md:15`) |
| 2 | Quais painéis usam o componente novo nesta task | `Artifacts` da task, `Reports` do review e `Documents` da discussão, com o conteúdo de hoje; somem os tamanhos lembrados por `useDefaultLayout` (`myspec.task-panels:*`, `myspec.review-panels:*`) e o arraste | O pronto pede painéis um por vez com `Esc`, o que só se prova com o app usando o componente; S9 é o mecanismo |
| 3 | O que diz a linha que espera os checks sem P13 | `PR review · waiting for checks` / `checks`, e `Pass N · waiting for checks` / `checks` | P13 é da task 3 |
| 4 | A linha 3 com o agente trabalhando e nenhuma ação em curso | A palavra da atividade da conversa: `Starting session…`, `Thinking…`, `Retrying · attempt N` | É o que a conversa diz no mesmo momento (`components.md:515`) |
| 5 | Onde o app abre | Na Home, com a pilha lembrada atrás | A Home é o lugar de retomar (`board.md:32`); é onde o app abre hoje |
| 6 | O que `←`/`→` fazem com um lugar que sumiu | Pulam | Voltar a um lugar vazio seria a área vazia que S7 proíbe |
| 7 | O nível do épico no breadcrumb | Texto, não link | O épico não é lugar (`structure.md:10–17`); `components.md:294` diz que os níveis são links, o que vale para os níveis que são lugares |
| 8 | O véu da piscada do encerramento | `--state-wait-veil` | Não há véu de encerramento em `tokens.css`; é o padrão do mock (`08/index.html:533`) |
| 9 | **New discussion** no menu **+ New** antes do campo **Board** (B2, task 5) | Abre o diálogo para o board do lugar (a visão do board, ou o board do item aberto); senão o da última discussão; senão o primeiro por título. Sem board, desabilitado com `Add a board to discuss its cards.` | O diálogo de hoje exige um board (`NewDiscussionRef`, `app-store.ts:81–85`) |
| 10 | O recolhido da lateral entre execuções | Lembrado, como os nós | A mesma memória de interface de `lib/ui-storage.ts` |
| 11 | Onde moram a linha, o nó, a faixa, o seletor de tema e o rodapé | Em `features/sidebar/`, feitos só de `components/system/`. Cabeçalho de lugar, painel, grupo, barra do pedido, página que saiu, aviso, toast e região ficam em `components/system/` | Uma feature só usa a árvore (`frontend.md` §Componentes); o resto tem várias |
| 12 | Os ícones de tipo | Componentes SVG próprios em `components/system/`, copiados dos símbolos do mock (`08/index.html:880–883`, e a marca em 908), registrados no `Icon` como `task`, `oneShot`, `review`, `discussion` | O lucide não tem a marca do One-Shot; `components.md:81` pede um ícone por significado |

### 4.4 O que o tech spec toma

- **A forma do lugar no store.** Uma união discriminada (`{ kind: "task", id }`…) e `back: Place[]`, `forward: Place[]`. Os campos antigos deixam de ser estado e viram seletores derivados (`useOpenTaskId`, `useOpenBoardId`, `useOpenReviewId`, `useReviewsOpen`, `useOpenDiscussionId`, `useHistoryUi`, `useSettingsUi`), e as ações antigas (`openTask`, `openBoard`, `openReview`…) viram atalhos de `go(place)`, para as features antigas não mudarem de assinatura. A recomendação é tirar os campos, não espelhá-los: são poucos leitores diretos (§5.2), e um espelho seria uma segunda verdade. `settingsSection` fica no lugar Settings. `app-store.test.ts` prova, antes da troca, a equivalência de cada seletor numa tabela de lugares.
- **`applyState` sobre o lugar.** Hoje há regras por tipo: `reviewPlace` e `discussionPlace` levam ao arquivado (`app-store.ts:415–471`), a task some e o lugar zera (`556–564`), o board some e volta à Home (`528–531`). Passam a uma regra só: o item ou o board do lugar sumiu, o lugar vira a página do item que saiu.
- **A persistência.** Chaves novas em `lib/ui-storage.ts` (a pilha, o lugar de volta, o último item ativo, o recolhido da lateral), validadas na leitura como `SIDEBAR_COLLAPSED_KEY` (`ui-storage.ts:32`), com um teto de tamanho para a pilha.
- **P1 no Go.** `session.Summary` (`internal/session/state.go:123–141`) ganha `TurnStartedAt` e a ação em curso. O início é o `CreatedAt` da entrada que abriu o turno (`run.turn.id`, `run.go:47–55`; `newEntry`, `run.go:97–106`); a ação é a última entrada `Action` com `Status: running` do turno (`turn.actions`), com o `Label` e o `Target` que `labels.go` já calcula. Hoje o começo e o fim de uma ação não marcam o estado (`events.go:182, 215, 252`, sem `n.state`), e cada `OnState` publica o estado inteiro e chama os três `Check` (`internal/app/app.go:197–204`; `publish`, `internal/app/state.go:182–191`, sem coalescer). O tech spec decide entre marcar o estado a cada ação e coalescer `publish` (uma janela curta), ou um evento leve só da atividade das sessões. A recomendação é coalescer, porque mantém um só caminho de estado e protege o app de rajadas de ações.
- **Os DTOs de P1.** A recomendação é acrescentar `turnStartedAt`, `actionLabel` e `actionTarget` aos cinco blocos de sessão que já existem (TaskSummary, StepReviewer, PullRequest, ReviewSummary, DiscussionSummary; §5.3), em vez de uma lista nova de sessões: segue o padrão, e P2 já sai deles.
- **F19.** `run` (`store/actions.ts:30–36`) passa a receber o rótulo da ação; são 62 chamadas. O tech spec fixa o texto de cada uma no padrão `Couldn't <verbo> <item>`.
- **Onde a piscada vive.** Hoje `flashing` é um conjunto por id de situação, limpo depois de `FLASH_MS = 1600` (`lib/situations.ts:16`; `app/bootstrap.ts:27–34`). Passa a 2 × 280 ms.

## 5. Inventário atual

### 5.1 `features/sidebar`, `features/attention` e `features/notice`

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `sidebar/Sidebar.tsx` (36–58) | Coluna: `WaitingSection`, `ReviewsNode`, filtro com o `+` de nova task, `MissingClones`, a árvore num `ScrollArea`, rodapé com `HistoryButton`, `SettingsButton`, `ThemeToggle` | Reescrito: topo, filtro, árvore (com Reviews e os avisos dentro), indicador, rodapé; faixa recolhida |
| `sidebar/SidebarTree.tsx` | `role="tree"` com `aria-label="Tasks"` (361); linhas de duas linhas `h-12` com `StatusDot`, nome, `taskStatusLabel` e `#card repo` (41–76); discussão com o rótulo `Discussion` (84–118); nós com chevron (130–160); falha do board com `TriangleAlert` em `--status-attention` (279–290); o item aberto é `openTaskId ?? openDiscussionId` (320) | Reescrito |
| `sidebar/sidebar-tree.ts` | `sidebarTree` agrupa por board e épico, com o filtro (74–136); `visibleRows` (139); `nodesOfItem` (156) | Ganha reviews, avisos de clone, gravidade, ordem do `Ctrl+J`, posição curta e longa, nome acessível, resumo do nó; os testes crescem |
| `sidebar/task-list.ts` | `taskRows` (19), `emptyTasksText` (37) | Absorvido por `sidebar-tree.ts` |
| `sidebar/useTaskListKeyboard.ts` | Seleção segue o foco: ↑↓, `Home`, `End`, `Enter`, `Space` **abrem** o item (26–58) | Sai: o teclado novo não abre com as setas |
| `sidebar/ReviewsNode.tsx` | `nav` separado acima do filtro, com os reviews em botões (não `treeitem`), `max-h-60` com rolagem própria (95–146) | Vira o nó Reviews da árvore |
| `sidebar/MissingClones.tsx` | Faixas `role="status"` acima da árvore, com **Change path** (11–47) | Vira o `treeitem` do aviso |
| `sidebar/RepositoryFilter.tsx` | `DropdownMenu` do `ui`, variantes `sidebar` e `field`; `field` é usada por `history/HistoryPanel.tsx:8` | A variante da lateral passa ao `Select` do system; a `field` fica até a task 11 |
| `attention/WaitingSection.tsx` | A seção **Waiting for you** (73–158); o item aberto é `openTaskId ?? openReviewId` (79), sem a discussão, ao contrário do `Ctrl+J` (`useGlobalShortcuts.ts:52`) | **Sai (S1)**, com o teste |
| `attention/usePresence.ts` | Mantém as entradas que saem por um tempo, para animar; só `WaitingSection` usa | Sai com ela, ou serve à saída dos toasts |
| `attention/useNow.ts` | O relógio; também em `board/BoardHeader.tsx`, `boards/BoardRow.tsx`, `reviews/ReviewsHeader.tsx` | Fica |
| `attention/useViewedSituation.ts` | Avisa o Go da situação na tela (`useOnScreenSituationId`) | Fica, lendo o lugar |
| `notice/Notice.tsx` | `Banner` e `ErrorNotice` com `Something went wrong` (47–53) | `ErrorNotice` sai para o aviso do app; `Banner` fica para `LeftoversNotice` até a task 11 |
| `notice/ArchivedNotice.tsx` | Barra flutuante embaixo, centrada, `“name” was archived.` e **Open in history**, 10 s (7, 39, 48) | Vira o toast na região nova |
| `notice/LeftoversNotice.tsx` | `Some files stayed on disk` | Fica até a task 11, no lugar do aviso |
| `history/HistoryButton.tsx`, `settings/SettingsButton.tsx`, `theme/ThemeToggle.tsx` | Os três do rodapé; o tema é um `toggle-group` de três botões | Viram o rodapé novo; `ThemeToggle` vira o seletor em ciclo |
| `app/AppShell.tsx` | `MainArea` escolhe a tela por uma cascata de campos (22–67); grade `[var(--sidebar-width)_minmax(0,1fr)]` (75) | Escolhe pelo lugar; a coluna da lateral alterna entre `--sidebar-width` e `--sidebar-collapsed` |
| `app/App.tsx` | Erro e sobras num overlay fixo no topo, centrado (49–56); `ArchivedNotice` fora do shell (62) | Aviso e toasts dentro da área principal |
| `app/useGlobalShortcuts.ts` | `Ctrl+N`, `Ctrl+J` pelo primeiro de `waitingEntries` (41–57), `Ctrl+,` alternando (59–74) | Ganha `Alt+←`/`Alt+→`; `Ctrl+J` pela função de `sidebar-tree.ts`; `Ctrl+,` fecha para o anterior |
| `app/bootstrap.ts` | `situation:started` pisca 1600 ms com a janela em foco (27–34); `situation:open` chama `openPlace` (36–38) | 2 × 280 ms, o anúncio, e `situation:open` como ida |
| `lib/situations.ts` | `situationLabel` (37), `placeLabel` (121), `compareSituations` (201), `waitingEntries` (220–254), `compactWait`/`spokenWait` (346–358), `FLASH_MS` (16) | Ficam, e `sidebar-tree.ts` os usa; `waitingEntries` perde o único leitor de lista |
| `styles/globals.css` | `attention-flash` e `attention-flash-ring` de 1600 ms, com a cor parada no movimento reduzido (280–343) | A piscada nova ao lado; as antigas ficam para `StepTabs` até a task 12 |

### 5.2 O estado de navegação no store e quem o lê

Leitores fora de `store/app-store.ts` e dos testes:

| Campo (`app-store.ts`) | Lido por | Vira |
|---|---|---|
| `openTaskId` (96) | `AppShell.tsx:23`, `useGlobalShortcuts.ts:52`, `task-create/NewTaskDialog.tsx:141`, `WaitingSection.tsx:75`, `SidebarTree.tsx:311`, e `lib/repositories.ts:102` por parâmetro | lugar `task` |
| `openReviewId` (115) | `AppShell.tsx:24`, `useGlobalShortcuts.ts:52`, `WaitingSection.tsx:76`, `ReviewsNode.tsx:81` (`useOpenReviewId`) | lugar `review` |
| `openDiscussionId` (123) | `AppShell.tsx:25`, `useGlobalShortcuts.ts:52`, `SidebarTree.tsx:312` (`useOpenDiscussionId`) | lugar `discussion` |
| `openArchivedId` (145), `openArchivedReviewId` (117), `openArchivedDiscussionId` (125) | `AppShell.tsx:26–28`; `history/HistoryPanel.tsx` por `useHistoryUi` | lugares arquivados |
| `openBoardId` (111) | `AppShell.tsx:32`, `SidebarTree.tsx:243` (`useOpenBoardId`) | lugar `board` |
| `reviewsOpen` (113) | `AppShell.tsx:31`, `ReviewsNode.tsx:80` | lugar `reviews` |
| `historyOpen` (143) | `AppShell.tsx:30`, `HistoryButton.tsx:16`, `HistoryPanel.tsx` (`useHistoryUi`) | lugar `history` ou arquivado |
| `settingsOpen` (157), `settingsSection` (158) | `AppShell.tsx:29`, `useGlobalShortcuts.ts:68`, `SettingsButton.tsx:10`, `SettingsView.tsx:17, 35`, `DiscardChangesDialog.tsx`, `PromptPane.tsx` (`useSettingsUi`) | lugar `settings` com a página |
| `flashing` (155) | `SidebarTree.tsx`, `ReviewsNode.tsx:33`, `task/StepTabs.tsx` (`useFlashing`) | fica |
| `archivedNotice` (148) | `ArchivedNotice.tsx` | fila de toasts |
| `error` (95) | `App.tsx` (`useError`), `actions.ts:34` | aviso com rótulo |

- **Ações de navegação** (`app-store.ts:569–909`) e quem as chama: `openTask` (`NewTaskDialog.tsx:139`, `CardDetail.tsx:55`, `PullRequestRow.tsx:30`, `SidebarTree.tsx:42`, `useTaskListKeyboard.ts:16`), `openBoard` (`SidebarTree.tsx:242`), `openReviews` (`ReviewsNode.tsx:82`), `openReview` (`ReviewsNode.tsx:32`, `StartReviewDialog.tsx:92`, `PullRequestRow.tsx:29`), `openDiscussion` (`SidebarTree.tsx:85`, `useTaskListKeyboard.ts:17`, `NewDiscussionDialog.tsx:93`), `openHistory` (`HistoryButton.tsx:17`), `openArchived` (`ArchivedNotice.tsx:16`, `HistoryPanel.tsx:51`, `CardDetail.tsx:56`), `openArchivedReview` e `openArchivedDiscussion` (`HistoryPanel.tsx:96, 118`), `closeArchived`, `closeArchivedReview`, `closeArchivedDiscussion` (as três telas arquivadas), `openSettings`/`closeSettings` (`SettingsButton.tsx`, `useGlobalShortcuts.ts`), `openPlace` (`bootstrap.ts`, `useGlobalShortcuts.ts`, `WaitingSection.tsx:77`).
- **Sem leitor fora do store:** `closeTask` (581), `closeReview` (635), `closeDiscussion` (680–688), `closeHistory` (823) e o seletor `useOpenTask` (1023), que `overview.md:146` e `frontend.md:14` citam como exemplo.
- **`NO_ITEM_PLACE`** (349–355) e `initialTaskUi` (358–413) existem para zerar as telas umas das outras; com o lugar, deixam de ser necessários.
- **Testes.** `test/render.tsx` aceita os dez campos em `ui` (13–41, 55–82); 20 arquivos de teste os usam: `app/bootstrap.test.ts`, `app/App.test.tsx`, `store/app-store.test.ts`, e os de `ArchivedNotice`, `NewTaskDialog`, `ArchivedTaskView`, `HistoryButton`, `useViewedSituation`, `HistoryPanel`, `WaitingSection`, `SettingsButton`, `SettingsView`, `ReviewsNode`, `SidebarTree`, `CardDetail`, `ArchivedReviewView`, `PullRequestRow`, `StartReviewDialog`, `ArchivedDiscussionView`, `NewDiscussionDialog`. São 189 arquivos de teste no frontend hoje.
- **Outra memória no `localStorage`** fora de `ui-storage.ts`: `myspec.artifacts.seen:<id>` (`task/TaskView.tsx:27–44`, sai com S9), os tamanhos de `useDefaultLayout` (`TaskView.tsx:57`, `ReviewView.tsx:30`, `DiscussionView.tsx:28`, saem com os painéis), `myspec.review.expanded` (`ReviewStrip.tsx:10`, task 3) e `myspec.theme` (`theme/theme.ts:4`). O filtro por repositório e o tema são estado do Go (`State.repositoryFilter`, `State.theme`; `setRepositoryFilter`, `setTheme`).

### 5.3 Os DTOs do resumo de item: o que existe e o que falta

O "bloco de sessão" (`sessionStatus`, `sessionModel`, `sessionEffort`, `turnRunning`, `processRunning`, `retryAttempt`, `contextPercent`, `pendingCount`, `lastError`) aparece cinco vezes, sempre convertido de um `session.Summary` (`internal/session/state.go:123–141`, montado em `run.summary`, `run.go:109–141`):

| DTO (`internal/bindings/dto.go`) | Sessão | Convertido em (`convert.go`) | Origem no Go |
|---|---|---|---|
| `TaskSummary` (376–423, bloco 396–407) | A da etapa; na implementação, o implementador do step atual; vazio na etapa de PR, com `waiting` por padrão (199–201) | 199–229, pela chave de `taskSessionKey` (246–260) | `session.Service.Summaries` |
| `Step.reviewer` → `StepReviewer` (195–210) | O revisor do step, `nil` sem conversa | `fromStepReviewer` (515–530) | `flow.StepState.Reviewer` (`internal/flow/step.go:77–80`) |
| `TaskSummary.pr` → `PullRequest` (258–307, bloco 294–306) | A da PR (rascunho, review da PR) | `fromPullRequest` (263–306) | `flow.PullRequest.Session` (`internal/flow/pr.go:79`) |
| `ReviewSummary` (1026–1090, bloco 1075–1086) | A do review | 1381 | `session` pelo id do review |
| `DiscussionSummary` (1218–1266, bloco 1251–1262) | A da discussão | 1604 | `session` pelo id da discussão |

- **P2 já está exposto.** As duas conversas do step atual têm o status cada uma (`TaskSummary.sessionStatus` e `steps[atual].reviewer.sessionStatus`), e o frontend já as lê em `task/step-status.ts:158–172` (`loopSession`). O que falta é só a função que as lista por papel para a árvore e a aba; nenhuma mudança em Go.
- **"A conversa que trabalha" (P1) já é derivável**: `turnRunning` de cada bloco.
- **Falta de verdade (P1):** o início do turno e a ação em curso. `session.Summary` não tem nenhum dos dois. O início é o `CreatedAt` da entrada `user` do turno (`run.turn.id`); a ação é a entrada `Action` em `running` do turno, com `Label` e `Target` (`internal/session/transcript.go:76–77`; `labels.go:43–56`). Nada disso é persistido: o transcript não muda, e `docs/architecture/sessions.md` só muda se o tech spec decidir guardar algo.
- **As situações** chegam em cada resumo, da mais grave para a menos (`dto.go:333–357`; ordem em `internal/attention/service.go:454–460` e `situation.go:57–80`: grupo `error`, `waiting`, `closing`, depois `startedAt`). O `Ctrl+J` entre itens aplica a mesma ordem (`lib/situations.ts:201–254`).
- **O resto que a árvore lê** já chega: `Board.reading`, `Board.failure` (`dto.go:729–760`), `ReviewCenter.reading` e `pendingCount`, `Repository.missing` e `cloned`, `Step.status`, `reviewPass`, `reviewRound`, `PullRequest.status`, `prNumber`, `checkedAt`, `ReviewSummary.status` e `passes[].findings`, `DiscussionSummary.status` e `drafts[]`. Não chega: os checks pelo nome (P13, task 3).

## 6. Riscos e o primeiro step

| Risco | Tratamento |
|---|---|
| **O refactor da navegação** (`implementation.md:193`). Dez campos, catorze ações, 20 arquivos de teste; `applyState` tem três regras por tipo para o item que some | O primeiro step de frontend (step 3) só troca o estado pelo lugar, sem nenhuma mudança visível: os seletores derivados, as ações antigas como atalhos de `go`, `test/render.tsx` com a opção `place`, e uma tabela em `app-store.test.ts` que prova cada seletor antigo em cada lugar antes de qualquer tela ler o lugar. A pilha, a persistência e `←`/`→` vêm no step seguinte, sobre o modelo já provado |
| **A lateral e o painel em `clamp` com pixel inteiro** (`implementation.md:189`) | `--sidebar-width` já é `round(down, …, 1px)` (`tokens.css:91`). `--panel-width` não é (93): o painel usa `round(down, var(--panel-width), 1px)` e a regra coluna-ou-cobertura vira uma container query única em 1120 px (§4.2). `styles/globals.test.tsx` passa a provar o arredondamento da lateral, do painel e da coluna da conversa ao lado dele. O step do painel compara capturas a 1180, 1250, 1435, 1450 e 2560 px, com a lateral aberta e recolhida |
| **A árvore com o nome acessível inteiro** | A frase nasce em `sidebar-tree.ts` como função pura (tipo, nome, situações, posição, trabalho, contexto, meta), testada sem renderizar; os componentes a usam como `aria-label` e os testes buscam por ela. O relógio por minuto re-renderiza a árvore: a linha é memoizada pelo resumo do item e pelo minuto, e o chip e o relógio escondem o texto visível do leitor. Com `aria-owns` nos grupos e o roving tabindex, o step da árvore passa pelo Orca na máquina alvo |
| **P1 multiplica as publicações do estado** | Cada começo e fim de ação passa a mudar o resumo. O step de P1 mede numa sessão real quantos `state:changed` saem por minuto antes e depois, e o tech spec escolhe entre coalescer `publish` e o evento leve (§4.4) |
| **Regressão do teclado da árvore** | A seleção deixa de seguir o foco. O teste de teclado cobre cada tecla de `structure.md:57`, e `features.md` diz o comportamento novo |

**Como o primeiro step é feito.** É o de P1, em Go, isolado: `session.Summary` com o início do turno e a ação em curso, testado com os fakes do `claudetest` (uma ação que começa e termina, duas ações no mesmo turno, um turno sem ação, a interrupção). A medição das publicações por minuto fica registrada no commit. Nenhum DTO muda ainda.

## 7. Documentação que a task atualiza

| Arquivo | O que muda |
|---|---|
| `docs/product/features.md` §Tela de boas-vindas e barra lateral (264–285) | A lateral de cima para baixo (topo com **+ New**, filtro, árvore, rodapé), a árvore com Reviews dentro, a linha de três linhas, os glifos, os dois relógios, o meta em hover, os nós recolhidos com resumo, a faixa recolhida, o teclado (a seta move o foco, `Enter` abre). A parte das boas-vindas fica como está (task 10) |
| `features.md` §Depende de mim (629–647) | A lista de onde as situações aparecem perde **Waiting for you**; a árvore, a marca `Ctrl J`, a piscada no véu, o anúncio |
| `features.md` §Encerramento e arquivamento (465–475) | "com um aviso momentâneo de que saiu" vira a página do item que saiu com a task aberta, e o toast com ela fechada |
| `features.md` §Atalhos (680–703) | `Alt+←`/`Alt+→`, `Ctrl+J` pela gravidade e pela idade, `Ctrl+,` que fecha para o lugar anterior, `Esc` no painel e em Settings, as teclas da árvore |
| `features.md` §Etapas de planejamento (333) e §Configurações e aparência (678) | O painel de artefatos fechado até o usuário abrir; o tema em ciclo no rodapé |
| `docs/architecture/design-system.md` §Componentes (91–118) | A família Shell: cabeçalho de lugar, painel auxiliar e grupo com a regra em 1120 px, barra do pedido, página do item que saiu, aviso do app, toast e região `aria-live`, ícones de tipo; e as peças da árvore, que moram em `features/sidebar` |
| `docs/architecture/overview.md` | §Store (146): o lugar e a pilha no lugar da lista de campos, e `NO_ITEM_PLACE` sai. §Features (154): `attention` sem a seção de espera. `lib/ui-storage.ts` (156) com o que passa a lembrar. §O estado que o frontend vê (97) e §Eventos (103–112): a ação em curso e o início do turno no resumo das sessões, e a publicação coalescida, se for a escolha |
| `docs/guidelines/frontend.md` | §Store e ações (11–16): a navegação é um lugar, e o seletor de exemplo deixa de ser `useOpenTask`. §Acessibilidade (31): a árvore, não mais "a lista de tasks". §Componentes (18–26): onde mora uma peça de uma feature só |
| `docs/architecture/sessions.md` | Só se o tech spec guardar algo novo no transcript por P1; o que esta task recomenda não guarda |

## 8. Plano de steps sugerido

Catorze steps, o teto de G, do domínio para fora. Cada um é um commit com `task check` verde, e os testes do que ele cria ou apaga vão no mesmo commit.

1. **P1 no domínio.** `session.Summary` com o início do turno e a ação em curso; a mudança de uma ação marca o estado; a publicação coalescida ou o evento leve, conforme o tech spec. Testes em `internal/session` e, se `publish` mudar, em `internal/app`.
2. **P1 nos DTOs.** Os três campos nos cinco blocos (§5.3), `convert.go` e o teste dele, `task generate`, `lib/wails.ts` e `test/wails-mock.ts`. No frontend, a função de P2 que lista as sessões de um item por papel, testada.
3. **O lugar no store.** A união `Place`, os seletores derivados, as ações antigas sobre `go`, `applyState` numa regra só (o que some vira a página), `AppShell` pelo lugar, `test/render.tsx` com `place`, e a tabela de equivalência. Nada muda na tela, salvo a área vazia que vira a página, ainda como um texto simples.
4. **A pilha.** `back`/`forward`, a persistência (F1: pilha, último item ativo), a abertura na Home, `Alt+←`/`Alt+→`, `Ctrl+,` e `Esc` que fecham Settings para o anterior, o pulo do que sumiu. Testes de store.
5. **`sidebar-tree.ts`.** A árvore com Reviews e os avisos, a gravidade, a ordem do `Ctrl+J`, o texto longo e curto da linha 2, a linha 3, o nome acessível, o resumo do nó. Só funções puras e testes.
6. **A árvore.** A linha, o nó, o aviso de clone, o teclado, a marca `Ctrl J`, o meta em hover, a rolagem até a linha aberta; os ícones de tipo em `components/system/`. Saem `WaitingSection` (S1), `ReviewsNode`, `MissingClones`, `useTaskListKeyboard`, `task-list.ts` e os testes deles.
7. **O resto da lateral.** O topo com **+ New ▾** e `«`, o filtro no `Select`, o indicador `↓ N more below`, o rodapé com **History**, o tema em ciclo e **Settings**.
8. **A faixa recolhida.** Os blocos, os separadores, o teclado, a memória entre execuções, a grade do `AppShell`.
9. **Situação nova.** `Ctrl+J` e `situation:open` pela mesma ida, a piscada de 2 × 280 ms na linha, no bloco e no resumo, a região `aria-live` com o anúncio e o `Nothing else needs you now.`
10. **O cabeçalho de lugar.** O componente com `←`, `→`, o breadcrumb que dobra e o título, e a adoção em todos os lugares com o conteúdo antigo à direita (§4.3, decisão 1), Settings com **Close** `Esc`.
11. **O painel auxiliar e o grupo.** O componente, a regra em 1120 px com o arredondamento, `Esc`, um por vez; `Artifacts`, `Reports` e `Documents` saem do `react-resizable-panels`, e o painel de artefatos não abre mais sozinho (S9). Capturas nas larguras do risco.
12. **A página do item que saiu e os toasts.** A página nos seis casos (§4.2), o foco em **Next that needs you**; a região `.toasts` com o toast de arquivamento de task só quando ela não estava aberta; `ArchivedNotice` sai.
13. **A barra do pedido e o aviso do app.** A barra nas quatro formas e na da outra conversa, testada isolada; o aviso no lugar de `ErrorNotice`, com `run` recebendo o rótulo nas 62 chamadas (F19).
14. **Documentação.** A §7 inteira, e a verificação de que `features.md` não contradiz nada do que a task fez.

Se o plano passar de catorze, a documentação de cada área entra no step da área em vez de um step próprio; nenhum item de escopo é cortado.
