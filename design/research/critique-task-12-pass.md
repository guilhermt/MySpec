# Passe de consistência da fase 5 · o relatório da task 12

O passe do `design-critic` sobre o app inteiro, rodado pelo coordenador antes de a task 12 ir para `Ready`, com `design/tasks/12-consistency.md` §4.2 (O passe do crítico) como instrução. É o PRD da task 12 (`12:7`; `12:N` é a linha N do material). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** A `main` em `76418239`, com as tasks 1 a 11 mergeadas.

**Como foi feito.**

- **As duas fontes.** As suítes pintadas das tasks 3 a 11 com `MYSPEC_CAPTURES=1`, nas capturas de `frontend/captures/`: as cenas de cada mock com as fixtures, no Chromium com o CSS real, nas larguras que cada suíte prova (2180, 978, 950 e 812 px de área principal, e 790 na lista de Reviews). E o app real: `bin/myspec` de `task build` sobre `76418239`, pelo backend Broadway do GTK, dirigido pelo Chromium headless do Playwright, com `HOME`, `XDG_*` e banco temporários e os itens semeados por `sqlite3`, como `12:109` pede.
- **As cinco janelas.** 1100, 1250, 1450, 2000 e 2560 px de largura e 1080 de altura, que dão 812, 950, 1134, 1640 e 2180 px de área principal. A lateral medida no app bate com o `clamp`: 288, 300, 316, 360 e 380 px; recolhida, 60 px.
- **Os dois temas.** O seletor do rodapé troca o tema no Broadway (System → Light → Dark). O escuro foi visto nas cinco janelas no system, na task, na discussão e em Settings e History; em Home, board e Reviews, só a 1100 e a 1450 (O que não foi visto).
- **Três críticos**, cada um com uma sessão do app e duas áreas:
  - o system, o shell e a árvore, e Settings, History e diálogos: o banco semeado com 4 tasks ativas, 74 tasks, 4 reviews e 2 discussões arquivadas, sem `claude` nem `gh`; um nome de 60 caracteres gravado numa task para provar o corte, uma task apagada para ver a página do item que saiu, 80 arquivados no History;
  - a task e a discussão: `gtk4-broadwayd :31` na porta 8111, sem `claude`; cinco tasks (uma em implementação com o step 3 commitado e as conversas do implementador e do revisor com fala, grupos, comandos com saída, subagente, compactação, retry, permissão e pergunta respondidas e erro; uma na PR com quatro apontamentos; uma com o step 5 bloqueado por worktree suja; uma pausada no PRD; uma com step `Manual`) e três discussões (`Usage-based pricing tiers`, `Webhook delivery guarantees`, `Old reports cleanup`); os mocks `10-screen-task-minimal/b.html`, `16-conversation-wide/a.html` e `13-screen-discussion/b.html` fotografados para comparar;
  - Home, board e criação, e Reviews e o review: o `gh` só para leitura, o board `Pessoal` (`guilhermt/projects/2`), `guilhermt/MySpec` clonado pelo **Clone** da Home, as PRs abertas reais (#64, #65, #84, #86) e dois reviews semeados (`MySpec#87` com três apontamentos, dois ancorados e um geral; `MySpec#85` com uma passada limpa); uma task bloqueada no card #59 e uma pausada no #38; três repositórios cadastrados que não existem no GitHub (`aaa-tools` com o clone inexistente, `zeta` sem clone, `solo` sem board), que dão as faixas de falha.
- **O contraste** foi calculado dos OKLCH de `design/system/tokens.css`, com as misturas em sRGB e a fórmula da WCAG 2.1, nos dois temas, e conferido a olho nas capturas; não foi medido em pixel.
- Nada foi escrito no GitHub (a publicação e **Start review** foram abertos e cancelados; as decisões ficaram no banco temporário), e o diretório de dados do usuário não foi tocado.

**A contagem.** 75 itens:

| Área | Bloqueia | Deve | Pode esperar | Total |
|---|---|---|---|---|
| O system, o shell e a árvore (`S`) | 1 | 13 | 14 | 28 |
| A task (`T`) | 1 | 4 | 13 | 18 |
| Home, board e criação (`B`) | 0 | 7 | 5 | 12 |
| Reviews e o review (`R`) | 1 | 1 | 3 | 5 |
| A discussão (`D`) | 0 | 1 | 3 | 4 |
| Settings, History e diálogos (`H`) | 0 | 3 | 5 | 8 |
| **Total** | **3** | **29** | **43** | **75** |

Além deles, 22 lacunas (`L1` a `L22`): 21 decididas pelo coordenador e uma, o banco de uma versão mais nova, para o usuário. Quatro lacunas pedem código sem ter item próprio (L2, L13, L14, L18).

**Como ler.**

- Cada item tem um id único (`S1`…, `T1`…, `B1`…, `R1`…, `D1`…, `H1`…), a gravidade (**Bloqueia**, **Deve**, **Pode esperar**, como nas críticas das tasks), onde está, a regra que não cumpre e o que foi visto. Em cada área, os itens vêm em ordem de gravidade.
- Um problema que os críticos acharam em mais de uma área é uma entrada só, na área do system, com as ocorrências por área. A gravidade é a maior que uma leitura deu, e a entrada diz quando as leituras diferem. Cada área termina com as entradas do system que a tocam.
- Um item que vem de uma pauta diz a origem. Quando a leitura não deu gravidade, fica a da origem, **Pode esperar**.
- Pela regra de `12:128`, todo item é trabalho da task, com qualquer gravidade. O step que fecha um item, ou uma lacuna que pede código, escreve o commit ao lado do id.

## O system, o shell e a árvore

Visto no app real nas cinco janelas e nos dois temas, e nas capturas `gone-*`, `dialogs-*`, `welcome-*`, `start-*` e `migration-*`.

**Por largura:**

- **1100** (lateral 288, área 812): a linha 2 da árvore na forma curta (`Session error · Step 4/7`), o meta só no tooltip do nome; a faixa recolhida com os quatro blocos, os separadores com `◇` e o rodapé em coluna.
- **1250** (300, 950) e **1450** (316, 1134): iguais a 1100 na árvore (abaixo de 330 px de lateral); o breadcrumb do cabeçalho dobrado em `…`.
- **2000** (360, 1640): a forma longa (`Session error · Reviewer · Step 4/7`, `Decide findings · PR review · pass 1`); o breadcrumb ainda dobrado (abaixo de 1660).
- **2560** (380, 2180): o breadcrumb inteiro (`History /`, `Platform Roadmap /`); nada mais muda.

### Problemas

**S1 · Bloqueia. O anel de foco some no WebKitGTK depois de um clique e no `focus()` por script.** · **Fechado no step 7** A leitura do system o deu como **Deve**; as do board e de Reviews, como **Bloqueia**, porque o viram também só com o teclado.

- Onde: as linhas usam só `focus-visible:focus-ring`, e o WebKitGTK não dá `:focus-visible` a um foco movido por tecla depois de um clique nem ao `focus()` de script que segue uma tecla. `components/system/ListRow.tsx:104` (`focus-visible:focus-ring`) e `:118` (`group-focus-visible/row:visible`, as teclas da linha), `features/sidebar/TreeRow.tsx:89`, `features/sidebar/TreeNodeRow.tsx:161`; o foco inicial dos diálogos (`components/system/Dialog.tsx`, em **Cancel** no de confirmação).
- Ocorrências:
  - **Árvore:** clique em `billing-export` e `↓`. O foco vai a `rate-limit-per-api-key` (o meta `api#410` aparece), sem anel, a 2000 px no escuro.
  - **Diálogo de confirmação:** `⋯` aberto pelo clique, **Discard step 4…** escolhido por `↑` e `Enter`. O foco está em **Cancel** (`Tab` vai a **Discard step**, `Shift+Tab` volta com o anel), mas a abertura não mostra anel, a 1250 px no escuro. Vale para todo diálogo de confirmação.
  - **Board:** `/` e depois `↓`, `Home`, `↓` `↓`, ou um clique e depois `End`, não desenham anel em nenhuma linha nem cabeçalho, e as teclas `S start` / `D discuss` não aparecem (1100, claro e escuro). O anel só surge quando uma segunda tecla age sobre o elemento já focado (`Enter` no cabeçalho `Ready`).
  - **Reviews:** na lista de PRs, o clique e as setas não mostram anel. Depois de `Alt+↓`, o apontamento atual fica só com o anel `--brand-ring`, sem o anel de foco por fora que `screens/review.md` §9 pede ("com o foco, o atual (anel `--brand-ring`, e o anel de foco por fora)"). O foco inicial em **Start review** (diálogo de início) e em **Cancel** (diálogo de publicação) não se vê até a primeira tecla, que no diálogo de publicação foi `1`.
  - **Diálogos da task:** o anel em **Cancel** de um diálogo aberto pelo teclado (`critique-task-11.md`, item 11), visto no Broadway como acima.
- Regra: `principles.md` 9 ("O foco tem uma forma que a seleção não tem"); `components.md` Estados comuns (Focus), Diálogo (Teclado) e Linha de lista (Estados: "foco (anel por fora e as teclas)"); `screens/review.md` §9. É a pauta `critique-task-06.md:169` e o item 11 de `critique-task-11.md`, agora vistos no motor, com o teclado e não só depois de um clique. O conserto mora no system; o usuário confere no monitor (`12:31`, pronto 9).

**S2 · Deve. A tecla sem caixa fora da primária.** · **Fechado no step 7** Pauta de polimento 4.

- Onde: `components/system/Button.tsx:126–133` tira a caixa fora do sólido (`!keyOnSolid && "border-0 bg-transparent shadow-none"`).
- Ocorrências:
  - **Settings e o compositor:** **Close** `Esc` de Settings, **Save** `Ctrl S` tracejado do editor de prompt e **Send** `↵` com a tecla solta, nas cinco janelas.
  - **Board:** `N` de **New discussion** (cabeçalho, nas cinco larguras), `D` de **Discuss** (painel) e `Esc` de **Cancel** (barra da seleção) soltos, ao lado de `S` e `D` em caixa nas primárias.
  - **Reviews:** `Alt ↓` solto em **Next to decide** e `A`/`D`/`E` soltos nos apontamentos, ao lado de `Ctrl ↵` em caixa na primária e de `R` em caixa em **Start review**.
- Regra: `components.md` Etiqueta e tecla ("a mesma forma num grupo"); `12:341` (§4.3 #7): toda tecla em caixa, contorno `--line-2` no secundário e no fantasma, `--brand-key-ring` na primária, `--line-1` e `--ink-4` no desabilitado.

**S3 · Deve. A barra de rolagem fora do `ScrollArea` é a do GTK.** · **Fechado no step 7** Pauta de polimento 7.

- Onde: nenhum `::-webkit-scrollbar` em `styles/globals.css`. As áreas do `ScrollArea` (History, Settings, a lateral, a lista do board) mostram a barra fina no app; o textarea do prompt e o corpo de um diálogo rolam nativos.
- Regra: `components.md` Barra de rolagem; `12:342` (§4.3 #8): uma regra global com a mesma anatomia, sem trilho, para toda área que rola.

**S4 · Deve. O bloco de código tem duas cópias e o cabeçalho sem caminho.** · **Fechado no step 7**

- Onde: `features/chat/Markdown.tsx:16` (`code: { copy: true }`) deixa a cópia do Streamdown nos blocos curtos, e `:108–186` (`CutCode`, com `COPY_LABELS` em `:117`) desenha uma cópia própria (`Copy`/`Copied`, `:129–176`) no bloco cortado. Nenhuma é o `CopyButton` nem tem o nome `Copy the code`. O cabeçalho mostra só a linguagem (`mermaid`, `go`), sem o ícone `<>`, o caminho e o intervalo do mock.
- Visto na conversa da task.
- Regra: `components.md` Bloco de código e Marca e cópia; `decisions.md` 2026-10-02 (um **Copy** só); `12:168` (§4.2, O que sai); a pauta `critique-task-04.md:119–123` (9), o cabeçalho do código.

**S5 · Deve. O `ModelPicker` antigo nos diálogos de início de review e de nova discussão.** · **Fechado no step 2**

- Ocorrências:
  - **Início de review:** `features/reviews/StartReviewDialog.tsx:10`, `:198`. `Opus 5.5 (1M) · high` aparece com `⚠ unavailable` em âmbar e peso 500 e com o chevron duplo `⇕`; na mesma sessão, o diálogo de criação de task (`ModelChip`) mostrou `Opus 5.5 (1M) · high` sem marca nenhuma. O mesmo modelo é dito de dois jeitos.
  - **Nova discussão:** `features/discussion/NewDiscussionDialog.tsx:343` desenha o seletor antigo (`Opus 5.5 (1M) · high ⇕`), nas capturas `discussion-start-978` e `discussion-start-home-978`.
- Regra: `components.md` Chip ("Indisponível: `◇`, `· unavailable` em `--ink-3` 400"); `principles.md` 1 (âmbar é espera); `screens/discussion.md` §2 item 7; `12:92` (§4.1: o `ModelPicker` sai, e os dois diálogos usam o chip de modelo e esforço). É do step 2 (§8 do material).

**S6 · Deve. Os títulos de um Markdown aberto sob um título próprio saem maiores que o título do lugar.** · **Fechado no step 8** A leitura da discussão o deu como **Pode esperar**; as da task, do board e de Reviews, como **Deve**.

- Causa: a regra `.card-body :is(h1…h6)` (`styles/globals.css:447–451`) está dentro de `@layer components` e perde para as classes utilitárias que o Streamdown põe nos títulos; os lugares sem classe ficam no tamanho do Streamdown. `.ui-headings` (`globals.css:566`, fora da camada) já resolve o rascunho (`features/discussion/CardDraft.tsx:158`), o prompt e os arquivados.
- Ocorrências:
  - **Task:** `features/task/PanelDocument.tsx:101` usa `Markdown` sem `ui-headings`. No app, o PRD aberto em `Artifacts` (360 px) mostra `# PRD` em ~30 px e `## Problem` em ~24 px sob `← Artifacts  PRD` em 13 px, repetindo o título; os relatórios em `Details` também.
  - **Board:** no painel do card (app a 1100, card #42; captura `board-card-978`), `Contexto`, `Problema`, `Out of scope` e `Acceptance` saem em ~24 px, contra o título em `--text-title`; `features/board/BoardCardPanel.tsx:199` não tem efeito. Contra `screens/board.md` §3.5 item 7.
  - **Reviews:** `features/reviews/PullRequestPanel.tsx:146` usa `card-body`, com a mesma causa. As PRs do dependabot não tinham título para mostrar; a causa está provada no painel do card. Contra `screens/review.md` §2.5 item 6 ("no registro de leitura") e a consistência com o painel do card, que é o mesmo componente (§2.5).
  - **Discussão:** `features/discussion/DocumentsPanel.tsx:105` e `features/chat/entries/MarkerLine.tsx:476` desenham `discussion.md` e o contexto sem `ui-headings`, ao contrário do corpo do rascunho.
- Regra: `principles.md` 4 e 3. É a quarta vez do mesmo desvio (item 3 das críticas 9 e 10, item 9 da 11). Lacuna L8.

**S7 · Deve. A tag de código no lugar da etiqueta.** · **Fechado no step 8**

- Onde: `features/history/ArchivedTask.tsx:235–236` (`Archived`, `One-Shot`), `ArchivedReview.tsx:134` (`Merged`, `Closed`), `ArchivedDiscussion.tsx:215` (`Archived`) e `:55` (`Epic`, `New card`, `Update` em What it published). Também `components/system/DeletionPreview.tsx:88` (`3 uncommitted files`, `not merged · 9 commits`, um `Tag` com borda) no **Delete task**.
- Visto: o `Tag` (`components/system/Tag.tsx:9`) é mono e cheio de `--surface-0`. No app e nas capturas `history-archived-*`, `Archived` e `New card` saem em Fira Code sobre fundo afundado.
- O mesmo tipo de rascunho sai como `Badge` na discussão (`components/system/FoldedDraft.tsx:136`) e como `Tag` no arquivado: o mesmo significado em duas formas.
- Regra: `components.md` Etiqueta, tag, placeholder e tecla. A etiqueta é contornada por `--line-2`, em sans (`Draft`, o tipo do rascunho `New card`, `Epic`, `Update gateway#461`); a tag é "a ferramenta de uma permissão (`Bash`)". `screens/rest.md` §4 e §10 dizem "a etiqueta". O mock usa `.dtag`: contornada, sans e `--ink-3`, e `--ink-1` com `--line-3` na prévia (`lab/14-screen-rest/src/rest.css:130`, `:213`). É `critique-task-11.md` (16), reaberto: a forma é a do `Tag`, o problema é a escolha do componente.

**S8 · Deve. O ícone de ir e o de abrir fora do app são o mesmo desenho.** · **Fechado no step 8**

- Onde: `components/system/type-icons.tsx:69` (`GoIcon`, `M5.5 10.5l5-5M6.5 5.5h4v4`) e `components/system/icons.ts:65` (`external: ArrowUpRight`): a mesma seta diagonal. `go` é a seta do nó de board e de Reviews; `external` é o link que sai para o GitHub.
- Ocorrência em Settings: `features/settings/PromptsPage.tsx:107` (`ICONS.go`). No app, a 2560 px no escuro, as nove linhas de Prompts terminam em `↗`, a mesma forma de `acme/projects/3 ↗` em Boards, que sai para o GitHub. A linha abre uma página do app e se lê como um link externo. `components.md` Linha de Settings diz "e o chevron; abre o prompt", e o mock usa o chevron (`lab/14-screen-rest/src/settings.js:189`, `I("right", "i chev")`).
- Regra: `components.md` Ícones ("Não use dois ícones para a mesma coisa nem o mesmo ícone para duas"; "Seta externa: abre fora do app") e Linha de Settings. O desenho de `go` vem dos mocks (`lab/05-visual-b-variations/a.html:652`). Lacuna L1.

**S9 · Deve. A mesma leitura de board tem três idades ao mesmo tempo.** · **Fechado no step 8** É da Home, apontado na área do system pela consistência com o nó da árvore e com o `ReadingAge`.

- Com o board nunca lido e nenhuma leitura rodando: a Home diz `reading…` (`features/home/home.ts:225`, o caso que sobra de `readingOf`), Settings › Boards diz `Not read yet` (`components/system/ReadingAge.tsx:61`) e o nó `Platform Roadmap` da árvore não diz nada (`features/sidebar/TreeNodeRow.tsx:86–92`, certo, porque nada lê). Visto nas cinco janelas, nos dois temas, durante toda a sessão.
- Regra: `components.md` Idade da leitura (nunca lida é `Not read yet`); "uma idade por significado"; `structure.md` §7 (Primeira leitura do GitHub).

**S10 · Deve. As regiões ao vivo: o alerta presente ao montar e o status que nasce com o texto.** As leituras do board e de Reviews o deram como **Deve**; as da task e da discussão, como **Pode esperar**.

- O alerta de uma falha que já está na tela ao montar:
  - `features/board/BoardReadingStates.tsx:48` (a faixa da falha de leitura do board);
  - `features/reviews/ReviewsReadingStates.tsx:46` e `features/reviews/CheckStrip.tsx:47`;
  - `features/discussion/NewDiscussionDialog.tsx:302` (`role="alert"` de uma falha que já pode estar lá ao abrir).
- O `role="status"` que nasce junto com o texto que anuncia:
  - `components/system/KeyNotice.tsx:100`: o `Popup` nasce com o aviso, usado por `S`, `D` e `Space`; e fica em `--z-overlay` (`:96`), abaixo do tooltip (`--z-tooltip`);
  - `components/system/StartRow.tsx:150` (`Cloning…` na linha de bloqueio da Home; o papel só existe enquanto clona; a pauta o dava em `:143`) e `:125` (`Busy`);
  - `features/reviews/CheckStrip.tsx:51` (`Reading…`);
  - `QuestionCard.tsx:276` (`Sending “…”…`), `LiveChecks.tsx:34` (`Reading…`) e `features/chat/entries/Activity.tsx:88`;
  - `NewDiscussionDialog.tsx:294` (`Refreshing the cards…`), `features/discussion/UnclonedRepository.tsx:36`, `:78` (`Cloning…`) e `:106` (a falha do clone).
- Regra: `components.md:448` (Faixa de aviso: "`role="alert"` para uma falha que chega"); `12:350` (§4.3 #16); `12:270` (§4.2, Os nomes acessíveis: "nenhum `role="status"` nasce junto com o texto"). As pautas `critique-task-05.md:188` (10), `critique-task-06.md:173` (4), `critique-task-05.md:230–233` (21) e `:394`. `screens/board.md` §8 diz o contrário (lacuna L16). V11 os pega no step da varredura.

**S11 · Deve. A faixa da falha de leitura cola no cabeçalho, sem folga em cima.** · **Fechado no step 8**

- Ocorrências:
  - **Board:** na captura `board-failed-978`, a faixa começa no fio do cabeçalho (y 48), e a barra de filtros fica 32 px abaixo dela. `features/board/BoardReadingStates.tsx:50` só dá `mb-(--space-4)`.
  - **Reviews:** nas cinco larguras e na captura `reviews-list-failed-978`, a primeira faixa começa no fio do cabeçalho, porque `features/reviews/ReviewsReadingStates.tsx:48` só dá `mb-(--space-4)`.
- Regra: o mock decidido, em que `.readfail` tem `margin-top: var(--space-4)` (`lab/11-screen-board/src/board.css:43`); `screens/board.md` §3.8; `screens/review.md` §2.7 ("a faixa afundada no alto da lista"), que herda a faixa do board.

**S12 · Deve. O tooltip do bloco da faixa recolhida quebra o nome do item.** · **Fechado no step 7**

- Onde: `components/system/Tooltip.tsx:53` desenha o conteúdo e o `sub` lado a lado (`flex items-center gap-2`, `:64`), e os dois encolhem dentro de `--size-tooltip-max`. `features/sidebar/SidebarRail.tsx:129` passa o nome e a linha 2 longa.
- Visto: `fix-typo-in-` / `footer` numa coluna e `Session error · Reviewer · Step` / `1/1` na outra, a 1100 e a 2560, no escuro. Um nome de 40 caracteres vira quatro linhas.
- Regra: `components.md` Faixa recolhida ("o tooltip tem o nome do item e o que ele pede") e Tooltip (anatomia). O nome inteiro é o que o tooltip existe para dizer.

**S13 · Deve. `↓ N more below` cai sobre o texto da última linha.** · **Fechado no step 7**

- Onde: `features/sidebar/MoreBelow.tsx:61`. O esmaecido vai do transparente ao fundo da lateral só em 70% dos 28 px, e o rótulo fica na parte de baixo, sobre a linha 2 ainda visível.
- Visto: numa janela de 1100 × 460, no escuro, `↓ 2 more below` encosta em `Step 1/1` e no chip `!3h` meio apagados da linha de baixo, e as duas leituras se misturam.
- Regra: `components.md` Indicador de rolagem da árvore (o esmaecido sobre as últimas linhas); `principles.md` 10.

**S14 · Deve. O item desabilitado com ação, focado no escuro, fica abaixo de 4,5:1.** · **Fechado no step 7** Pauta `critique-task-05.md:183` (9).

- Onde: `components/system/Menu.tsx:271` (`focus:text-ink-4`). Medido: `--ink-4` sobre `--veil-hover` em `--surface-3` dá **4,44:1** no escuro (5,50 no claro).
- Regra: `principles.md` 5 (4,5:1); a pauta pede `--ink-3` com o foco.

**S15 · Pode esperar. Valores de espaço soltos no system.** · **Fechado no step 7**

- Onde: 149 classes numéricas do Tailwind onde há `--space-*` em `components/system/`, as mais densas em `Menu.tsx` (7 linhas), `DependencyPicker.tsx` (7), `RequestBar.tsx` (6), `Radio.tsx` (6), `Listbox.tsx` (5) e `Dialog.tsx` (5). No shell: `Toast.tsx:72`, `:86`, `:96` (`gap-2.5 py-2.5 pr-2 pl-3`, `gap-0.5`, `-ml-2.5`); `Tooltip.tsx:53` e `KeyNotice.tsx:102` (`px-2 py-1`); `Button.tsx:150` (`gap-2` da razão).
- Regra: `tokens.css` (cabeçalho: "no color, size or duration outside this file"). Os valores batem com a escala, e nenhuma cor nem duração está solta.

**S16 · Pode esperar. A linha 2 da linha aberta da árvore, pressionada, cai abaixo de 4,5:1 no claro.** · **Fechado no step 7**

- Calculado dos tokens: `--ink-3` sobre `--veil-press` em `--brand-veil` dá **4,44:1** no claro e 4,86 no escuro. A linha 2 é `--ink-3` (`features/sidebar/TreeRow.tsx`), e o pressionado dura o clique.
- Regra: `tokens.css:160–161` ("1 to 3 pass 4.5:1 on every surface and veil of the system"); `principles.md` 5. A exceção que o comentário já lista é só a do `--ink-4`.

**S17 · Pode esperar. O chip de espera da árvore e o da barra discordam por um minuto.** · **Fechado no step 8**

- Ocorrências:
  - **Task:** `!8m` na linha da árvore e `!7m` na barra da mesma task (1100), `!14m`/`!13m` no escuro.
  - **Review:** no review de #87, a árvore disse `10m` e a barra `9m`, depois `11m` contra `10m`; no #85 (2560), `14m` contra `15m`.
  - **Discussão:** no escuro a 1450, `10m` na linha da árvore e `9m` na barra de `Ready to archive`; o mesmo em `Publish failed`.
- Causa: cada `useNow` conta o minuto desde a própria montagem (`features/attention/useNow.ts:7–19`), e `features/reviews/useReviewRequest.ts:15` tem o seu próprio `useNow(MINUTE)`, fora de fase com o relógio da árvore.
- Regra: "uma idade por significado" (`12:113`); `components.md` Chip de tempo. Miúdo da crítica 9. Lacuna L19.

**S18 · Pode esperar. Os ícones do `⋯` da task e da discussão diferem.** · **Fechado no step 8**

- O da task tem ícone só em **Open in VS Code** e **Open PR** (`features/task/task-menu.ts:98`, `:151`), sem lixeira em **Delete task…**; o da discussão tem ícone em todo item (`features/discussion/discussion-header.ts:141–169`).
- Regra: "um componente com a mesma forma em todo lugar" (`12:113`); `components.md` Menu do item. Lacuna L10.

**S19 · Pode esperar. O toast sobe acima do compositor, mas não da barra do pedido.** · **Fechado no step 8**

- Onde: `components/system/toast-lift.ts:9–24` mede só o elemento que o chama (`:16–18`), e só `features/chat/Composer.tsx:121` chama. Sem compositor (step bloqueado, PR bloqueada), `--toast-lift` não existe, e os toasts cobrem a barra.
- Origem: `critique-task-11.md`, O que as correções abriram.

**S20 · Pode esperar. A página do review que saiu tem duas formas de data.** · **Fechado no step 8**

- Onde: `features/navigation/gone-passes.ts:47` e `:82` usam `clockTime` (`Yesterday 09:00`) nas linhas das passadas, e `:16` usa `atMoment` (`on Sep 23 at 16:20`) no texto de cima da mesma página. `features/navigation/gone-rounds.ts:11` também usa `clockTime`.
- Regra: "uma hora por significado"; `screens/review.md` §15. Origem: `critique-task-11.md`, O que as correções abriram.

**S21 · Pode esperar. A razão cortada do rodapé de um diálogo não se lê pelo teclado.** · **Fechado no step 7**

- Onde: `components/system/Dialog.tsx:216` (`:213–220`) usa `CutText`, que não recebe foco e abre só com o ponteiro (`components/system/CutText.tsx:35–37`, `:40`, `hover={cut}`); o primário tracejado em foco não mostra a razão.
- Ocorrências: **Group drafts into an epic** (`discussion-many-group-978`: `Name the epic to group the …` corta); o rodapé do diálogo de criação de task; o rodapé do diálogo de publicação (`Choose a verdict`, `Nothing GitHub takes yet`).
- Origem: `critique-task-09.md`, novo.

**S22 · Pode esperar. O tooltip com o texto inteiro abre mesmo quando nada corta.** · **Fechado no step 7**

- Ocorrências: `components/system/FoldedDraft.tsx:56–62` (o título do dobrado, `:59`); `features/chat/entries/MarkerLine.tsx:173–174` (o título da linha da lista do marco); `components/system/ListRow.tsx:121–135` (`Cell`, que sempre envolve o texto em `Tooltip`: hover em `Redesign · the experience of MySpec`, card #49, a 1100, mostrou o tooltip sem corte); `features/discussion/GroupEpicDialog.tsx:137` (o título de cada rascunho); `features/discussion/NewDiscussionDialog.tsx:214` (a linha do board). O `CutText` só abre quando corta (`CutText.tsx:40`; a leitura do board cita `:625`).
- Regra: `components.md` Tooltip ("o texto inteiro do que corta"); `principles.md` 10; "um componente com a mesma forma em todo lugar". Origem: `critique-task-09.md`, segunda leitura e O que ficou aberto ("um comportamento só").

**S23 · Pode esperar. `◇` como caractere solto.** · **Fechado no step 7** Pauta `critique-task-05.md:206` (16).

- No system: `components/system/DependencyNotice.tsx:27`, `RelationList.tsx:87`, `FilterBar.tsx:61` e `Menu.tsx:144` (`UNAVAILABLE`, que o `Chip` e o `Select` escrevem). Na página do item que saiu: `features/navigation/GoneView.tsx:97`. Fora destas áreas: `DetailsPanel.tsx:512`, `home.ts:183`, `:194`, `:216`, `NewTaskDialog.tsx:104`, `CardContextLine.tsx:123`, `NewDiscussionDialog.tsx:303`, `pr-panel.ts:183`, `new-discussion.ts:198`.
- O que fazer: o `StateGlyph blocked`.

**S24 · Pode esperar. O laço e o teto do `Presence` sem prova.** · **Fechado no step 7** Pauta `critique-task-02-fixes.md:40` (M1).

- `components/system/Presence.painted.test.tsx:62` prova só o laço dentro da subárvore. Nenhum caso cobre um laço no próprio elemento (`Presence.tsx:13–16`) nem uma saída que não avisa o fim (o teto, `:28–31`).

**S25 · Pode esperar. O trilho de erro do bloco da faixa recolhida sem prova.** · **Fechado no step 7** Pauta `critique-task-02-fixes.md:42` (M2).

- `features/sidebar/SidebarRail.tsx:147` (`error-rail-bar`); nenhum teste da faixa o confere (só `TreeRow.test.tsx:347` e `ListRow.test.tsx:277`, para as linhas). No app, o trilho aparece nos dois blocos de erro.

**S26 · Pode esperar. A saída do toast empurrado repete o `Presence` à mão.** · **Fechado no step 7** Pauta `critique-task-02-fixes.md:46` (M4); opinião da crítica de origem.

- `features/notice/ShellToasts.tsx:21–36` guarda `pushedOut`, `shown` e `dismissed` à mão; só `whenExitEnds` vem de `Presence` (`components/system/Toast.tsx:6`). O que fazer, pela pauta: a saída do toast pelo `Presence`.

**S27 · Pode esperar. Quatro toasts por 120 ms.** · **Fechado no step 7** Pauta `critique-task-02-fixes.md:48` (M5).

- `ShellToasts.tsx:38–41` mostra o que sai junto com os três. Vale, sem defeito de código; a leitura recomendava fechar com uma decisão.
- **Decisão do coordenador:** a quarta notificação que chega com três toasts à vista não espera; o mais antigo sai no mesmo instante, com a transição de saída de `--duration-fast`, e isso faz parte do "sai" de `components.md` (Aviso do app e toast). **Registrar em:** `components.md` Aviso do app e toast, pela task, no step do system. O step confere que a saída usa `--duration-fast` e escreve o commit aqui.

**S28 · Pode esperar. O comentário de `REVIEW_MODES` meio verdadeiro.** · **Fechado no step 2** Pauta `critique-task-05.md:392`.

- `lib/review-modes.ts:3` ainda diz "in the order the pickers list them", e o `ReviewModePicker` continua no código. O comentário passa a dizer a ordem que vale quando o `ReviewModePicker` sai (`12:164`).

## A task

Conferido nas capturas `scene-*`, `bar-*`, `conversation-*` e `widths-*`, nos dois temas, e no app real nas cinco janelas e nos dois temas, com as cinco tasks semeadas. Os mocks `10-screen-task-minimal/b.html` e `16-conversation-wide/a.html` foram fotografados a 1250 px para comparar. O contraste foi calculado dos tokens e conferido a olho nas capturas do app.

**Larguras** (o que muda no cabeçalho e na tela, no app e nas capturas):

- **1100 (812):** o breadcrumb em `…`; as etapas feitas só com o visto; a pílula sem qualificador nem palavra (`Implementation 4/7 ◆`); as futuras só com o círculo; o medidor só com `…`/a porcentagem; **Pause** e os painéis só com o ícone; o painel cobre a conversa, a barra e o compositor. Nada sai do lugar; o título corta com reticências.
- **1250 (950):** as futuras voltam com o nome (`○ PR ○ PR review ○ Closing`); o resto como a 812.
- **1450 (1134):** a pílula ganha o qualificador (`4/7 · Manual`); o painel vira coluna (360 px). Os títulos dos steps não iniciados em `Details` cortam sem tooltip (T5).
- **2000 (1640):** os nomes das feitas, os traços, o trilho do medidor, `Pause` e os nomes dos painéis; o breadcrumb continua em `…`.
- **2560 (2180):** o breadcrumb inteiro (`Platform Roadmap /`). O stepper termina em ~1.414 px da janela e as ferramentas começam em ~2.080 px: um eixo só, com ~670 px de vão.
- **Meio pixel:** as bordas da barra do pedido, do compositor e do bloco de erro, ampliadas a 600% a 1100 e a 2560, estão nítidas nos dois temas.

### Problemas

**T1 · Bloqueia. O prompt de início de um step aparece como mensagem do usuário na fila, vazia, com Remove.** · **Fechado no step 9**

- Onde: `features/chat/Conversation.tsx:446–458` desenha toda entrada pendente com `QueuedMessage`, inclusive o prompt do produto (`prompt: true`, texto vazio), que fica pendente enquanto a sessão abre e para sempre quando ela não abre. `RemovePending` (`internal/session/service.go:548–570`) apaga a entrada sem distinguir o prompt.
- Visto: no app (`rate-limit-per-api-key`, step 4, `claude` ausente), a conversa mostra `Queued · sends after the retry` sem texto e **Remove** (`QueuedMessage.tsx:63–64`). O **Retry implementer** seguinte abriria a sessão sem a instrução do step.
- Regra: `screens/task.md` §6 (a fila é da mensagem do usuário; o início já é o marco `Started with steps/04-…md`); `components.md` Entradas da conversa (Mensagem na fila). Lacuna L21.

**T2 · Deve. A PR bloqueada esconde a conversa do review e os apontamentos.** · **Fechado no step 9**

- Onde: `features/task/place.ts:152–162` troca o lugar inteiro por `The pull request stage stopped` e o bloco de erro sempre que o status é `blocked`, mesmo com a conversa do review existindo.
- Visto: no app, a task na passada 1 com quatro apontamentos por decidir virou só o título e o bloco ao abrir sem `gh` (log: `pull request blocked`, `gh_missing`).
- Regra: `screens/task.md` §12, Erro ("Uma leitura que falha nunca esconde o que estava na tela"), e §6, Erro (o bloco sem título; o step bloqueado já segue: marco `Step 5 is next` e o bloco, sem título). Lacuna L5.

**T3 · Deve. O mermaid e a tabela da fala fogem do bloco decidido.** · **Fechado no step 9**

- Onde: `features/chat/Markdown.tsx:17` liga o `panZoom` do Streamdown.
- Visto: o diagrama sai encolhido a ~6 px de texto, dentro de uma segunda caixa clara, com os botões de zoom por cima (`conversation-planning-950-light`). No mock (`16-conversation-wide/a.html?scene=planning`), o diagrama tem o tamanho natural, num só bloco afundado com `<> mermaid` e tela cheia. A tabela também sai como caixa dentro de caixa.
- O componente do Streamdown traz ainda `bg-red-50`/`text-red-700` no erro do diagrama, `Loading diagram...` com um spinner próprio e `duration-150` no zoom, fora dos tokens e do spinner único.
- Regra: `components.md` Bloco de código (afundado, fio interno, um bloco); `principles.md` 8 (um spinner); o mock decidido. É a pauta `critique-task-04.md:119–123` (9), o `panZoom`, pior que nota. Lacuna L9.

**T4 · Deve. O placeholder da permissão diz `1–3` quando o cartão tem duas respostas.** · **Fechado no step 9**

- Onde: `features/chat/composer.ts:143` fixa `Answer with 1–3 above, or queue a message…`. Em `conversation-ask-impl-950-light`, o cartão tem só **Allow** `1` e **Deny…** `2` (sem regra de sessão, `PermissionCard.tsx:261` já conta 2). O texto manda uma tecla que não age.
- Regra: `components.md` Cartão de pedido (`1` a `3` só com a regra); `principles.md` 9. Lacuna L7.

**T5 · Deve. Textos cortados sem tooltip nos painéis.** · **Fechado no step 9**

- Em `Details`, a 1450 px, os steps não iniciados viram `5 · Token …` ao lado dos seletores: `components/system/PanelRow.tsx:73` corta com `truncate`, sem `CutText` (`DetailsPanel.tsx:280–286`).
- Os nomes dos checks em `Details` e no vazio do PR review cortam do mesmo jeito (`components/system/ChecksList.tsx:139–148`, `truncate` sem tooltip), o que a pauta T3 5 dava como "com o nome inteiro no tooltip".
- Regra: `principles.md` 10.

**T6 · Pode esperar. O nome acessível da pílula repete o encerramento.** · **Fechado no step 9**

- Onde: `features/task/stepper.ts:231–235` monta `tom: fragmento` para todo grupo, e para `merge` na forma `close` dá `Progress · Closing · ready to close: ready to close in PR`. `lib/situations.ts:290–299` (`situationPillState`, usado pela discussão e pelo review) já trata o encerramento sem repetir; o stepper tem uma cópia própria.
- Regra: `screens/task.md` §4 (Foco); pauta `critique-task-03.md:58` (3).

**T7 · Pode esperar. A razão da PR bloqueada mostra crases.** · **Fechado no step 9**

- Onde: `features/task/pr-status.ts:186` e `:188` escrevem ``make sure `gh` is on the PATH`` e ``Run `gh auth login` ``, e o bloco de erro desenha o texto cru: no app, `` `gh` `` com as crases.
- Regra: `components.md` Bloco de erro (a explicação em texto).

**T8 · Pode esperar. A primeira passada do revisor usa outra forma da mensagem do produto.** · **Fechado no step 9**

- Onde: `features/chat/markers.ts:265–271` desenha `MySpec → Reviewer` com o ícone `start` (bandeira) e peso 500 (`MarkerLine.tsx:336`), enquanto toda outra mensagem do produto usa a marca e peso 400 (`MarkerLine.tsx:33`). Visto em `scene-ask-950-light`.
- Regra: `components.md` Ícones ("um ícone por significado") e Marco em linha (Mensagem do produto).

**T9 · Pode esperar. A opção do cartão de pergunta não tem pressionado nem desabilitado à vista.** · **Fechado no step 9**

- Onde: `OPTION_CLASS` (`components/system/OptionGroup.tsx:6`) não tem `active:` em `--veil-press`, e `QuestionCard.tsx:342–348`, enviando, só põe `aria-disabled` com `cursor-not-allowed`, sem o tracejado nem a tinta apagada que `OptionGroup.tsx:80`, `:86` usam.
- Regra: `components.md` Cartão de pedido (Estados da opção); pauta `critique-task-04.md:101` (2), que pede manter o `radio` ou o `checkbox` com `aria-checked`.

**T10 · Pode esperar. A hora da resposta fora do nome da pergunta e da permissão respondidas.** · **Fechado no step 9**

- Onde: `QuestionCard.tsx:117` e `PermissionCard.tsx:135` nomeiam o `article` com a hora da pergunta; a da resposta fica só no tooltip, que abre pelo ponteiro sobre o texto.
- Regra: `screens/task.md` §6 ("Está sempre no nome acessível"); pauta `critique-task-04.md:102` (3).

**T11 · Pode esperar. A volta ao fim não tem hover.** · **Fechado no step 9**

- Onde: `features/chat/entries/BackToEnd.tsx:32`, `hover:bg-surface-3` sobre `bg-surface-3`.
- Regra: `components.md` Volta ao fim (Estados); pauta `critique-task-04.md:119–123` (9).

**T12 · Pode esperar. O cursor do streaming é um bloco em tinta cheia.** · **Fechado no step 9**

- Onde: `Markdown.tsx:95` pede `caret: "block"` ao Streamdown, que desenha `▋` na cor do texto (`--ink-1`).
- Regra: `components.md` Entradas da conversa (Streaming: "um cursor parado, em `--ink-3`"); pauta `critique-task-04.md:119–123` (9).

**T13 · Pode esperar. `step_review` e `step_empty` marcam a aba do implementador.** · **Fechado no step 9**

- Onde: `agent-tabs.ts:102` dá ao implementador a situação de `stepSituation` (`lib/situations.ts:319–326`), que acha a de lugar `step`. Com a aba do revisor escolhida depois de **Review myself**, a de fora diz `Implementer · waits`, apontando uma conversa que não espera nada.
- Regra: `screens/task.md` §7 ("são do step, não de uma conversa"); pauta `critique-task-03.md:64–70` (6). Lacuna L6.

**T14 · Pode esperar. O medidor brilha sem leitura a caminho.** · **Fechado no step 9**

- Com a sessão que não abriu (`claude` ausente), o medidor fica com o trilho em brilho e `…` indefinidamente (`components/system/ContextMeter.tsx:17`, `:38–40`; app, 2000 e 2560 px).
- Regra: `principles.md` 8 (o brilho diz que uma leitura ainda não tem resultado).

**T15 · Pode esperar. Valores soltos.** · **Fechado no step 9**

- `PermissionCard.tsx:81` (`max-h-48`), `Markdown.tsx:164` (`h-8`), `features/task/StepDocument.tsx:9` (`max-w-[58.5rem]`, `gap-2`).
- Regra: `docs/architecture/design-system.md` (Utilitários); pauta `critique-task-04.md:115–118` (8).

**T16 · Pode esperar. `clone_missing` manda a Settings.** · **Fechado no step 9**

- `features/task/step-status.ts:229` diz `Change the path of the repository in Settings › Repositories` enquanto a barra oferece **Change path…**.
- Regra: pauta `critique-task-04.md:125` (11): o texto diz o que a barra faz.

**T17 · Pode esperar. O lugar que muda com a tela aberta não é anunciado.** · **Fechado no step 9**

- Nenhum `announce` em `features/task` (`TaskView.tsx`, `place.ts`).
- Regra: pauta `critique-task-04.md:132` (nota 3): o anúncio pela região do app (`store.announce`).

**T18 · Pode esperar. Provas que faltam.** · **Fechado no step 9**

- Page Up e Page Down com o `feed` de três entradas (`useFeed.test.tsx:192–195`); o `feed` de mais de dez entradas nasce com a janela da conversa (`12:231`).
- `where-actions-went.test.tsx` sem **Retry reviewer** (só `Retry implementer`, `:391`, e `Retry PRD agent`, `:406`) e sem **Deny** com `defaultToNo`.
- Nenhum teste de `Close` esperando `spawnPRWork` (`internal/flow`: só `TestCloseWaitsForThePreparationItCancels`, `step_test.go:292`).
- As cenas não cortam texto (`TaskView.scenes.painted.test.tsx:411`, sem `longName`; só `TaskView.widths` a 812 e `TaskHeader.painted` usam `LONGEST_NAME`).
- Os `sed`/`cat` de `STEP_3_READS` sem saída (`test/conversation-scenes.ts:233`, `:397–415`).
- Pautas `critique-task-04.md:103–111` (4), `:114` (7), `:124` (10) e `critique-task-07.md:369` (4).

**Do system, nesta área:** S4 (o bloco de código), S6 (os documentos em `Artifacts` e os relatórios em `Details`), S10 (`QuestionCard`, `LiveChecks`, `Activity`), S17 (a idade da árvore e da barra), S18 (o `⋯`), S19 (o toast sobre a barra).

## Home, board e criação

Fontes: as capturas `home-*`, `board-*` e `create-*` (978 e 2180; `board-card` também a 812 e 950) e o app real nas cinco janelas (claro nas cinco; escuro a 1100 e a 1450), com o board `Pessoal` lido pelo `gh` e os repositórios semeados.

**Larguras:**

- **1100** (área de 812): com o painel, a lista tem 452 px; a barra de filtros quebra em duas linhas (a busca e **Assigned to me** em cima, **Filter** embaixo). O épico e a task descem para a segunda linha. O diálogo de criação abre a 8% em pixel inteiro. O `listbox` de **Repository** passa da largura do diálogo e da janela (B4).
- **1250** (950): a lista sem painel tem 902 px e continua na segunda linha; com o painel (520), a barra de filtros cabe numa linha.
- **1450** (1134): a lista sem painel tem 1086 px e passa a uma linha, com as colunas do épico e da task; com o painel (610), volta à segunda linha.
- **2000** e **2560**: a lista fica centrada em `--list-measure`, e o painel fica em 40rem ao lado. Nada mais muda.

### Problemas

**B1 · Deve. A linha focada pelo teclado fica sob a barra de filtros fixa.** · **Fechado no step 3**

- A 1100×600, depois de `End` e de dezenove `↑`, a linha em foco (#52) passou para baixo da barra, e o mesmo acontece com `Home`. `features/board/useListTree.ts:126–131` chama `scrollIntoView({ block: "nearest" })` sem `scroll-margin` para a barra (`components/system/FilterBar.tsx:35`, `sticky`).
- Regra: `principles.md` 9; `screens/board.md` §7 (as setas percorrem as linhas visíveis). É o item 1 de `critique-task-11.md` ("vale também para o board"), que a task 11 resolveu só no History (`BELOW_THE_BAR`).

**B2 · Deve. O que bloqueia na Home sai agrupado por tipo, não por repositório.** · **Fechado no step 10**

- No app, `guilhermt/zeta isn't cloned` vem antes de `The clone at …/aaa-tools is missing`. `features/home/home.ts:170–197` ordena os sem clone e depois os inexistentes (`return [...notCloned, ...missing]`, `:197`).
- Regra: `screens/board.md` §2.2 ("uma linha por repositório do board, em ordem alfabética … e não agrupadas por caso"); `12:98` (§4.1); pauta `critique-task-05.md:204` (15).

**B3 · Deve. O caminho do clone inexistente não abrevia o home.** · **Fechado no step 10**

- `lib/repositories.ts:31` (`cloneMissingText`), `features/board/card-panel.ts:149`, `features/board/board-view.ts:597` e `features/task-create/create-task.ts:100` escrevem `repository.path` cru; Settings usa `displayPath` (`features/repositories/repositories-page.ts:75`).
- A captura `home-978` mostra `The clone at /home/dev/code/infra is missing.`, e o mesmo clone aparece em Settings como `~/code/infra`. No app, o caminho longo quebra em três linhas na Home (`components/system/StartRow.tsx:151–153`, sem corte).
- Regra: `screens/board.md` §2.2 e §3.6 (`~/code/infra`, `~/code/api`); um caminho, uma forma. Lacuna L17.

**B4 · Deve. O `listbox` de Repository do diálogo de criação sai da largura do campo e da janela.** · **Fechado no step 10**

- A 1100, um item desabilitado com um caminho longo esticou o menu de x 5 a x 1095. `components/system/Menu.tsx:40` usa `w-max max-w-(--available-width)`, e a razão do item não corta.
- Os itens com ação (`Not cloned` com **Clone**) perdem a coluna do visto e ficam 24 px à esquerda dos outros, porque `components/system/Select.tsx:196–203` desenha um `MenuActionItem` sem o indicador do `MenuRadioItem`.
- Regra: `components.md` Select, menu e listbox (Anatomia: itens alinhados; Item desabilitado com ação). Lacuna L15.

**B5 · Deve. O nome acessível da linha do card não diz `Cloning acme/billing…` nem `Clone failed`.** · **Fechado no step 10**

- `features/board/board-view.ts:530–549` monta o rótulo só com a task e a discussão (`task?.kind === "task"`), e `cloning` e `clone-failed` ficam de fora.
- Regra: `components.md` Linha de lista (Acessibilidade: "o nome acessível é a frase inteira"); pauta `critique-task-05.md:231` (21).

**B6 · Deve. A razão do chip de filtro órfão está só no tooltip.** · **Fechado no step 10**

- `components/system/FilterBar.tsx:58–65`: o chip tem `◇` e o `removeLabel`, e a razão fica fora do nome.
- Regra: `components.md` Tooltip ("nunca é o único portador de uma informação: o nome acessível já a tem"); pauta `critique-task-05.md:233` (21).

**B7 · Deve. A barra da seleção não tem o esmaecido da barra de filtros.** · **Fechado no step 10**

- `features/board/BoardView.tsx:449` envolve a `SelectionBar` num `sticky` sem o `::after` que `FilterBar.tsx:35` tem.
- Regra: `screens/board.md` §3.1 ("com um esmaecido de `--space-3` por baixo"); a consistência entre as duas barras do mesmo lugar; pauta `critique-task-05.md:219` (18).

**B8 · Pode esperar. A linha 2 de Continue não corta.** · **Fechado no step 10**

- Em `components/system/Continue.tsx:61`, `row.line2.long` é `shrink-0 whitespace-nowrap`, e só o breadcrumb corta. Com uma situação longa e uma janela de 1100, a linha transborda do botão em vez de cortar com tooltip. No app, a linha coube nas cinco larguras.
- Regra: `principles.md` 10 ("Um texto que corta tem tooltip"); pauta `critique-task-05.md:200` (13).

**B9 · Pode esperar. `Shortcuts:` continua em `sr-only` dentro de um `<p>`.** · **Fechado no step 10**

- `features/home/Home.tsx:194–195`, sem `role="group"`.
- Regra: pauta `critique-task-05.md:213` (17).

**B10 · Pode esperar. Miúdos do painel e da visão.** Pautas `critique-task-05.md:215–221` (18) e `:393`. · **Fechado no step 10**

- O link `Archived task: <nome>` cobre a frase inteira (`features/board/BoardCardPanel.tsx:160`).
- `The clone is running.` (`features/board/card-panel.ts:128`) não está em `screens/board.md` §3.6.
- `_app` sem uso (`features/board/board-view.ts:144`).
- `closePanel` acha o painel pela classe (`features/board/BoardView.tsx:199`, `.closest(".list-panel")`).

**B11 · Pode esperar. Provas e fixtures que faltam.** Pautas `critique-task-05.md:155` (1), `:160` (2), `:223–226` (19), `critique-task-06.md:344` e o FE16 de `critique-task-10.md`. · **Fechado no step 10**

- Nenhuma fixture tem um nome de 64 caracteres nem `◇ #N +1`: `test/board-scenes.ts:249` e `:263` têm uma dependência cada, e `features/task-create/NewTaskDialog.scenes.painted.test.tsx:54–59` mede a largura sem um nome que a preencha.
- `slice(0, 8)` ainda corta a prova do texto cortado (`features/board/BoardView.scenes.painted.test.tsx:128`).
- O fio entre as linhas de **Models** (`features/task-create/NewTaskDialog.tsx:389`) não tem prova.
- `S` e `D` no painel de um card fora da leitura não têm teste na visão (`BoardView.tsx:368–380`; só `board-view.test.ts:1003` prova o texto).
- A fiação `FromBoards` com `CardTasks` e `CardWriters` (`internal/app/state.go:78–79`) não tem teste Go.
- O aviso de dependência sem contorno no diálogo (`NewTaskDialog.tsx:339`) segue §9, porque o diálogo não é afundado; falta só a prova.
- A prova do tamanho `meta` da idade na linha de board da Home (`StartRow.tsx:225–233`; FE16 de `critique-task-10.md`).

**B12 · Pode esperar. Passos numéricos onde existe `--space-*`.** · **Fechado no step 10**

- `features/task-create/NewTaskDialog.tsx:281` (`gap-1`), `:375` e `:378` (`gap-2`) e `:391` (`gap-4 px-3`); no system, `components/system/NoticeStrip.tsx:32` (`gap-2 py-1.5 pr-1.5 pl-4`).
- Regra: `docs/architecture/design-system.md` (Utilitários); o item 13 de `critique-task-10.md`, o mesmo critério.

**Contraste** (calculado de `tokens.css`, claro / escuro): `--ink-4` sobre `--surface-1` dá 6,05 / 6,45; sobre o hover, 5,42 / 5,49; sobre o pressionado, 5,03 / 4,92; sobre `--surface-0`, 5,49 / 6,83. `--ink-3` sobre `--brand-tint-plane` (a linha aberta) dá 6,07 / 6,18. `--state-error` sobre `--surface-1` dá 6,02 / 6,74. O chip de espera dá 7,39 / 9,12. `--brand-ink` sobre `--brand-tint` dá 5,43 / 6,17. Todos passam de 4,5:1. A cor nunca é o único portador: a task da linha tem glifo e rótulo, o bloqueio tem `◇` e texto, e a falha de clone tem texto e trilho.

**Do system, nesta área:** S1 (o anel com as setas, Bloqueia), S2 (`N`, `D` e `Esc` soltos), S6 (o corpo do card), S9 (a idade da leitura na Home), S10 (a faixa, `Cloning…`, `Busy`, o `KeyNotice`), S11 (a faixa colada), S21 (o rodapé do diálogo de criação), S22 (a célula do épico), S23 (`home.ts`, `NewTaskDialog.tsx`, `CardContextLine.tsx`).

## Reviews e o review

Fontes: as capturas `reviews-*` e `review-*` (978 e 2180; `reviews-list` também a 790 e a 812; `review-findings` a 812) e o app real nas cinco janelas, no claro, e no escuro a 1100 e a 1450, com as PRs reais e os dois reviews semeados. Os dois reviews têm worktree destacada nos branches do dependabot.

**Larguras:**

- **1100** (área de 812): com o painel da PR, a lista tem 452 px. As etiquetas saem da linha, e o autor e o estado ficam na segunda linha. As três faixas de falha se quebram palavra por palavra (R1). No review, o título corta, e a pílula, o medidor e as ferramentas ficam como ícones.
- **1250** (950): sem painel, a lista de 902 px continua em duas linhas por PR. As faixas cabem numa ou duas linhas.
- **1450** (1134): sem painel, uma linha por PR. Com o painel (610), voltam as duas linhas, e as faixas ficam em duas linhas legíveis. O review mostra **Pause**, **Details** e **Reports** como ícones.
- **2000** e **2560**: a lista fica centrada, com as colunas do autor e do estado. O review mostra os rótulos das ferramentas (`Pause`, `Details`, `Reports`) e a coluna da conversa na medida.

### Problemas

**R1 · Bloqueia. A faixa de falha por repositório quebra numa lista estreita.** · **Fechado no step 11**

- Visto a 1100, com o painel da PR aberto (lista de 452 px): cada uma das três faixas `Couldn't read guilhermt/… · 8m ago` ficou com uns 200 px de altura e a razão numa coluna de uma palavra por linha; na última, a razão passa por baixo de **Try again** (`accou…` cortado pelo botão); a lista começa 700 px abaixo do cabeçalho.
- Causa: `components/system/NoticeStrip.tsx:38–39`. O título é `whitespace-nowrap`, e a razão é `min-w-0 flex-1`, então encolhe até a largura de uma palavra em vez de descer para a linha de baixo, apesar do `flex-wrap` (`:32`). A faixa do board (`features/board/BoardReadingStates.tsx:45`) e `Couldn't check GitHub` (`features/reviews/CheckStrip.tsx:44`) usam o mesmo componente.
- Regra: `components.md` Faixa de aviso; `principles.md` 10 ("de 1100 a 2600, contínuo"); `screens/review.md` §2.7. Lacuna L20.

**R2 · Deve. Publish review… tracejado perde a tecla e muda de largura.** · **Fechado no step 11**

- `features/reviews/review-request.ts:107–110` só põe `shortcut: "Ctrl ↵"` sem `disabledReason`. No app (1100), o botão passou de `Publish review…` tracejado para `Publish review… Ctrl ↵`, 40 px mais largo, ao decidir o último apontamento. O diálogo de criação, pelo contrário, mantém `Create Ctrl ↵` tracejado.
- Regra: `components.md` Botão ("Um botão não muda de largura com o estado: tracejado, o primário … mantém a tecla com o mesmo padding") e Etiqueta e tecla.

**R3 · Pode esperar. No menu Filter, Board e Repository têm a coluna do visto, e Author e Label não.** · **Fechado no step 11**

- `components/system/Menu.tsx:296–315` (`MenuCheckboxItem`, com o indicador `size-(--icon)`) contra `:336–346` (`MenuCycleItem`, sem ele).
- Regra: `components.md` Select, menu e listbox; pauta `critique-task-06.md:212` (11): um recuo só.

**R4 · Pode esperar. A consulta do GitHub não tem um teste contra o schema público.** · **Fechado no step 11**

- `internal/pulls/github_test.go:264`; nenhum teste de `internal/pulls` cita um schema.
- Regra: pauta `critique-task-06.md:155` (1): um teste contra o schema público do GitHub, sem rede.

**R5 · Pode esperar. `gap-1` onde existe `--space-1`.** · **Fechado no step 11**

- `features/reviews/StartReviewDialog.tsx:193`.
- Regra: `docs/architecture/design-system.md` (Utilitários).

**Conforme, conferido no app:**

- **As seções** `Pending` e `In review` abertas, `Reviewed 0` e `Yours and your tasks 0` sem chevron.
- **A etiqueta** `dependencies` com `+1`, e o autor `dependabot` que não se repete como label.
- **O painel da PR:** **Start review** `R`, os checks pelo nome com a idade, `Branch` em mono e `Labels`.
- **O diálogo de início:** `From Defaults. It can change in the conversation.`, **Add instructions** atrás de um clique, e só **Start review** como primário.
- **O cartão de apontamentos:** a localização como link, com o `<>` ao lado; `General · not on a line of the diff`; `Approved · click again to undo`; `A` decidindo e levando ao próximo.
- **A barra:** `Decide 3 more`; **Approve the rest**; `Ready to publish · pass 1 · 3 approved · 0 discarded`; `A clean pass` no #85.
- **O diálogo de publicação:** nenhum veredito marcado; `Suggested` em `Request changes` (no limpo, em `Approve`); `2 inline comments · 1 finding and the summary in the body`; `A clean pass · the summary and the verdict`; `Choose a verdict`, e depois de `1`, `Publish · Request changes Ctrl ↵`.

**Contraste** (de `tokens.css`, claro / escuro):

| Texto | Fundo | Claro | Escuro |
|---|---|---|---|
| `--state-wait` | o véu da barra | 5,60 | 8,86 |
| `--ink-3` | o véu da barra | 6,59 | 6,79 |
| `--brand-ink` | `--brand-tint` (a decisão pressionada, `Suggested`) | 5,43 | 6,17 |
| `--ink-4` (a referência `MySpec#84`) | `--surface-1` | 6,05 | 6,45 |
| `--ink-4` | o hover | 5,42 | 5,49 |
| `--ink-2` (a razão da faixa) | `--surface-0` | 9,74 | 11,60 |

Todos passam de 4,5:1. O estado da PR tem glifo e texto, e o âmbar nunca vem sozinho.

**Do system, nesta área:** S1 (as setas, `Alt+↓` e o foco inicial dos diálogos, Bloqueia), S2 (`Alt ↓`, `A`/`D`/`E` soltos), S5 (o `ModelPicker` do diálogo de início), S6 (a descrição da PR), S10 (as faixas e `Reading…`), S11 (a faixa colada), S17 (a idade da árvore e da barra), S20 (a página do review que saiu), S21 (o rodapé do diálogo de publicação). Também L18, que pede código sem item próprio (o título de um apontamento com código).

## A discussão

Conferido nas capturas `discussion-*` (as treze cenas e as flags, 2180, 978 e 812, nos dois temas) e no app real nas cinco janelas e nos dois temas, com as três discussões semeadas: `Usage-based pricing tiers` (rodada 1, um épico com dois cards, uma atualização, um descartado; `Decide drafts · 2/5`), `Webhook delivery guarantees` (um publicado, um com `publish_error`, um dependente; `Publish failed`) e `Old reports cleanup` (tudo descartado; `Ready to archive · nothing published`). A referência é o mock `13-screen-discussion/b.html` com o `README.md` dele. Os pares de contraste da tela passam nos dois temas: o menor texto, `--state-close` sobre `--surface-0`, dá 5,08:1 no claro; o anel do atual, `--brand-ring` sobre `--surface-2`, 4,36 / 3,97 (um anel, contra 3:1).

**Larguras:**

- **1100 (812):** o breadcrumb em `…`, a pílula `Round 1 ●`, o medidor só com a porcentagem e as ferramentas só com o ícone, com o espaço menor; na edição, **Repository**, **Module** e **Epic** em três colunas, com o **Epic** cortado (`Pricing tiers with metere…`); `Details` e `Documents` cobrem a conversa, a barra e o compositor.
- **1250 (950/978):** o mesmo topo; o rascunho atual chega pelo topo e a decisão dele fica abaixo da dobra, sob a pílula `↓` (D1).
- **1450 (1134):** `Details` vira coluna; nada mais muda.
- **2000 (1640):** `Pause`, `Details` e `Documents` com o nome; o breadcrumb continua em `…`.
- **2560 (2180):** o breadcrumb inteiro. A coluna de 960 px centrada; as bordas nítidas ampliadas a 600%.

### Problemas

**D1 · Deve. A ação que a barra aponta fica abaixo da dobra, sob o esmaecido e a pílula `↓`.**

- Com o atual rolado pelo topo (`lib/reveal.ts`), num rascunho alto a linha da decisão chega fora de vista:
  - em `discussion-partial-fail-978`, o **Retry** (a saída de `Publish failed`, e com o foco) aparece sob o esmaecido e sob a pílula `↓`;
  - em `discussion-epic-off-978`, o **Approve** que `Epic discarded` pede ("approve the epic again") também;
  - em `discussion-drafts-978`/`-812`, a pílula cobre a linha do que o gesto publica.
- `ConversationColumn.tsx:51` (`endRoom`) dá respiro só no fim da coluna, não sob o atual.
- Regra: `screens/discussion.md` §8 (**Show** leva ao rascunho onde fica **Retry**); `principles.md` 9 (o foco à vista) e 7. A crítica 9 aceitou a troca para o caso do teclado; o **Show** de uma situação que pede um botão é outro caso. Lacuna L11.

**D2 · Pode esperar. A edição mantém Edit `E` vivo e o rótulo Body sem `Markdown`.**

- `features/discussion/drafts-card.ts:498–505` só desabilita a decisão durante a edição (`Finish editing to decide`); `editReason` fica `null`, e **Edit** `E` continua ao lado de **Done** (`components/system/Draft.tsx:386–400`). `DraftEditor.tsx:298` não tem o complemento `Markdown` de `09:239`.
- Origem: crítica 9, segunda leitura, aberto.

**D3 · Pode esperar. Valores soltos onde há token.**

- `features/discussion/UnclonedRepository.tsx:37` (`gap-2 py-1.5 pl-4`) e `DraftEditor.tsx:316` (`py-1`). O item 12 da crítica 9 trocou os dos diálogos, não estes.
- Regra: `docs/architecture/design-system.md` (Utilitários).

**D4 · Pode esperar. O repositório dos cards do diálogo sai curto.**

- `NewDiscussionDialog.tsx:264` usa `shortName` (`billing`, `gateway`); `09:106` diz "o repositório curto (`acme/billing`)", com um exemplo que não é curto. A régua se contradiz. Lacuna L12.

**Do system, nesta área:** S5 (o `ModelPicker` do diálogo de nova discussão), S6 (`Documents` e o corpo do marco do documento), S10 (`Refreshing the cards…`, o alerta do diálogo, `UnclonedRepository`), S17 (a idade da árvore e da barra), S18 (o `⋯`), S21 (o rodapé de **Group drafts into an epic**), S22 (`MarkerLine`, `FoldedDraft`, `GroupEpicDialog`, `NewDiscussionDialog`).

## Settings, History e diálogos

Visto no app real (a mesma sessão da área do system), nas cinco janelas e nos dois temas: as quatro páginas de Settings, o prompt aberto e a edição, History com 80 arquivados e o teclado da lista, a task arquivada, o menu `⋯` de uma task, **Delete task** com a prévia lida do git e sem ela, **Discard step** e a página da task apagada. E nas capturas `settings-*` (2180, 978, 812), `history-*`, `dialogs-*`, `start-*`, `welcome-*` e `migration-*`, nos dois temas.

**Por largura:**

- **1100** (área 812): a navegação de Settings em linha acima da página; Review mode com as opções uma sobre a outra; no editor de prompt, a coluna **Placeholders** abaixo do editor; em Repositories, as contagens na linha 3; History com o onde e o resultado na segunda linha.
- **1250** (950): a navegação à esquerda; History em colunas (a lista passa de 860 px).
- **1450** (1134) e **2000** (1640): o cabeçalho do arquivado com o breadcrumb dobrado (`← … / idempotency-keys… Archived`; lacuna L2).
- **2560** (2180): o breadcrumb inteiro (`History /`); o par navegação e página de Settings centrado (centro em 1469,5 px; o da área é 1470).
- **Os diálogos** não mudam com a largura: ficam a `8vh` do topo, centrados na janela (lacuna L3).

### Problemas

**H1 · Deve. O History passou das metas, e a condição da janela dele está cumprida.** · **Fechado no step 4**

- Onde: `docs/development/target-machine.md:78–79`. Com 400 itens, a primeira pintura tem mediana quente de 404 a 501 ms, contra a meta de 300; `↓` tem mediana de 134 a 145 ms, contra 16. A linha 81 diz que "a virtualização da lista é decisão da task 12". No app, com 80 itens, a lista andou sem atraso visível; a medida é do Chromium, não do WebKitGTK.
- Regra: o material da task 12 na base do passe (§3, Fora: a virtualização do History "entra aqui só se a medida da 11 passar das metas da task 5; então o History ganha uma janela como a do board, com a medida dela"); com a condição cumprida, o material a põe no step 4 (§8). `structure.md` §7 ainda diz que o History "carrega os últimos 90 dias", sem janela.

**H2 · Deve. A falha ao ler um documento do arquivado é pintada de erro, com outra ação.**

- Onde: `features/history/ArchivedDocument.tsx:41–50` e `ArchivedDiscussion.tsx:248–257` passam `bg-state-error-veil` à `NoticeStrip`, com **Try again** secundário `xs`. A mesma falha de leitura no prompt (`features/settings/PromptPage.tsx:171–178`) é a faixa afundada, com **Try again** fantasma `sm`.
- Regra: `components.md` Faixa de aviso ("Afundada…"; "Não pinte de vermelho o que não é erro de uma ação sua"). Ler um arquivo não é uma ação do usuário que falhou.

**H3 · Deve. O History ainda importa o primitivo e a cor do shadcn.** · **Fechado no step 2** São telas da task 11, já redesenhadas; V1 e V4 os pegam nos steps 2 e 1.

- `features/history/ArchivedFindings.tsx:3` e `ArchivedDiscussion.tsx:11` importam `@/components/ui/collapsible`, e o system tem `components/system/Collapsible.tsx`.
- `bg-background` em `ArchivedTask.tsx:196`, `:230`, `ArchivedReview.tsx:98`, `:129` e `ArchivedDiscussion.tsx:154`, `:210`.
- Regra: `implementation.md:19`; `12:136`, `:139` (V1, V4).

**H4 · Pode esperar. Os fatos do arquivado escrevem o dia de hoje por extenso.**

- Onde: `features/history/archived.ts:46` (`archivedDate` = `dateAt`). No app, a task arquivada às 06:42 de hoje diz `merged into dev by lnakamura · Oct 4 at 06:20`. A linha dela no History diz `06:42` sob `Today`, o bloco `CLOSING` diz `06:42`, e o toast e a página que saiu dizem ` at 15:02`, sem o dia (`atMoment`).
- Regra: "uma hora por significado" (`12:113`). `screens/rest.md` §4 só dá o exemplo de outro dia (`Sep 24 at 14:51`). Lacuna L4.

**H5 · Pode esperar. Valores de espaço soltos em Settings e no início.**

- `features/repositories/ScanCloneRow.tsx:41`, `:48`, `:51`, `:61` e `:70` (`px-3 py-1.5`, `py-1`, `gap-2`, `pb-1`), que a correção da task 10 deixou de fora (ela tratou `BoardRepositoryRow`); `AddRepositoryDialog.tsx:191`, `:196`, `:220`, `:227` e `:230` (`gap-2`, `gap-3`); `features/startup/StartSidebar.tsx:20` (`h-4`, onde o Esqueleto pede barras de `--space-4`).
- Regra: `tokens.css` (cabeçalho); `components.md` Esqueleto.

**H6 · Pode esperar. Uma frase em inglês na documentação.** · **Fechado no step 4**

- `docs/development/target-machine.md:83` começa com "To measure on the target machine:". A documentação é em português (`CLAUDE.md`, Convenções).

**H7 · Pode esperar. A pauta de estabilidade: os testes intermitentes.**

- `features/boards/BoardDialog.test.tsx:249` (`aria-describedby` logo depois de digitar; `12:496`); os testes de digitação longa que estouram o tempo sob carga (`critique-task-10.md`, deixado pelo coordenador); os testes Go intermitentes `internal/reviewflow/apply_test.go:679` e `internal/bindings/task_service_test.go:1372` (`critique-task-11.md`, 16), sem mudança nos dois arquivos. As suítes não foram rodadas no passe.

**H8 · Pode esperar. `isMissingFile` frágil.** Opinião da crítica de origem.

- `lib/errors.ts:34`, lido por `features/history/ArchivedDiscussion.tsx:171`; o teste continua com a mensagem escrita à mão (`critique-task-11.md`, segunda leitura).

**Do system, nesta área:** S1 (o anel em **Cancel**), S7 (a tag nos arquivados e na prévia de **Delete task**), S8 (a seta das linhas de Prompts), S19 (o toast), S20 (as passadas da página que saiu). Também L2, que pede código sem item próprio (o breadcrumb do arquivado).

## Lacunas

O que `design/` não decidia ou contradizia, com a decisão que o coordenador tomou em 2026-10-04. Cada decisão é registrada no documento da coluna **Registrar em**, com uma entrada em `decisions.md`, antes de `Ready`; as que mudam comportamento (L5, L11, L13, L21) entram também em `changes.md`. As que pedem código sem item próprio (L2, L13, L14, L18) são trabalho do step da área, que escreve o commit aqui como num item.

- **L1 · A seta `go` e a seta externa** (S8; leitura do system). `design/` fixa os dois significados, mas o desenho de `go` vem dos mocks igual ao externo. **Decisão:** a seta `go` é um chevron para a direita; a seta diagonal fica só para links que saem do app. **Registrar em:** `components.md` Ícones. **Implementa:** S8.
- **L2 · O breadcrumb dobrado fora do item** · **Fechado no step 8** (leitura do system; visto também em Settings e History). `components/system/PlaceHeader.tsx:57` e `:78` dobram os níveis abaixo de 1660 px de área principal em todo lugar, também no arquivado, que não tem stepper: a 1134 px, `← … / idempotency-keys… Archived` com a faixa vazia no meio. `components.md` (Cabeçalho do lugar, Largura) fala dos limites do item, e `screens/rest.md` §4 diz "com `← History`". **Decisão:** o breadcrumb do arquivado só dobra quando o título não cabe. **Registrar em:** `structure.md`. **Implementa:** código em `PlaceHeader.tsx`, sem item próprio.
- **L3 · O diálogo centrado na janela ou na área principal** (leitura do system). No app ele centra na janela inteira (**Delete task** a 2000: de 760 a 1240 px, o centro da janela, não o da área, 1180); `components.md` (Diálogo) fixa só os `8vh` do topo, e as cenas da task 11 já pintam assim (`centeredInWindow`). **Decisão:** os diálogos centram sobre a janela inteira, como o `--scrim` a cobre. **Registrar em:** `components.md` Diálogo. **Implementa:** nada; o app já é assim.
- **L4 · A hora de hoje nos fatos de um arquivado** (H4). `screens/rest.md` §4 não diz se um fato de hoje leva o dia. **Decisão:** os fatos do arquivado usam `clockOrDateAt` (`15:02` hoje, `Sep 24 at 15:02` em outro dia), como a linha do History e o toast. **Registrar em:** `screens/rest.md` §4. **Implementa:** H4.
- **L5 · A PR bloqueada depois de o review começar** (T2). `screens/task.md` §11–§12 só têm `pr_blocked` como barra e o vazio do PR review antes da primeira passada. **Decisão:** a PR bloqueada depois de o review começar mantém a conversa, com o cartão de decisão desabilitado e a barra de erro; antes da primeira passada, o vazio com título continua. **Registrar em:** `screens/task.md` (§11, §12). **Implementa:** T2.
- **L6 · A situação do step nas abas** (T13). `screens/task.md` §5 e §7 dizem que `step_review` e `step_empty` são do step e que a barra aparece nas duas abas, mas não o que cada aba mostra. **Decisão:** nenhuma aba marca a situação do step; a pílula e a barra bastam. **Registrar em:** `screens/task.md` (§5, §7). **Implementa:** T13.
- **L7 · O placeholder da permissão com duas respostas** (T4). `screens/task.md` fixa `Answer with 1–3 above…`. **Decisão:** o número segue o cartão: `1–2` quando não há a regra de sessão, como o nome do cartão já faz. **Registrar em:** `screens/task.md` §7. **Implementa:** T4.
- **L8 · Os títulos de um Markdown aberto sob um título próprio** (S6). `components.md` decide só os do Rascunho (`--text-ui` 600). **Decisão:** os títulos de um Markdown aberto sob um título próprio ficam em `--text-ui` 600 em todo painel (`Artifacts`, `Details`, `Documents`, o painel do card e o da PR), no corpo de um marco aberto, no prompt e no arquivado; a fala do agente mantém os seus. A classe `.ui-headings` vale para todos, fora de camada, para vencer o Streamdown; a regra de `.card-body` em `@layer components` deixa de ser a dos títulos. **Registrar em:** `components.md`, uma seção Markdown; `screens/board.md` §3.5 item 7 (`board.md:181`) já diz `--text-ui` e peso 600, e `screens/review.md` §2.5 item 6 segue o painel do card. **Implementa:** S6.
- **L9 · A anatomia do mermaid** (T3). `components.md` Bloco de código não fala de diagrama; só o mock o desenha. **Decisão:** o mermaid no tamanho natural dentro do bloco afundado (`<> mermaid` e **Full screen** no cabeçalho), com zoom só na tela cheia. **Registrar em:** `components.md` Bloco de código. **Implementa:** T3. O erro do diagrama, que a leitura recomendava como bloco de código com a razão em `--state-error`, não ganhou decisão própria: vale o que a régua já pede, e o `bg-red-50`, o spinner próprio e o `duration-150` do componente do Streamdown saem por `principles.md` 8 e pelos tokens (T3).
- **L10 · Os ícones nos itens do `⋯`** (S18). `components.md` Menu do item não decide. **Decisão:** os itens do `⋯` só com texto; ícone apenas no `<>` (o editor) e na seta externa, igual nos três menus (task, review, discussão). **Registrar em:** `components.md` Menu do item. **Implementa:** S18.
- **L11 · Onde a chegada põe o atual quando o pedido é um botão dele** (D1). `screens/discussion.md` §5.5 e a crítica 9 fixam o atual pelo topo; nada diz o que acontece quando a barra leva a um controle no pé de um rascunho alto (**Retry**, **Approve** do épico descartado), nem se a pílula `↓` pode cobrir o atual. **Decisão:** a chegada numa discussão (**Show** e `Ctrl+J`) rola até o controle que a barra pede ficar inteiro à vista, e a pílula `↓` não se desenha sobre o rascunho atual. **Registrar em:** `screens/discussion.md` (§5.5, §8). **Implementa:** D1.
- **L12 · O repositório no card do diálogo de nova discussão** (D4). `tasks/09-discussion.md:106` diz "curto" e dá `acme/billing`. **Decisão:** `dono/nome` só quando dois repositórios do board têm o mesmo nome curto, como a Home e o History fazem; senão, o curto. **Registrar em:** `screens/discussion.md` §2, corrigindo `09:106`. **Implementa:** D4.
- **L13 · O repositório padrão do diálogo livre de criação** · **Fechado no step 10** (leitura do board). `screens/board.md` §4.2 diz "o primeiro utilizável entre o repositório do filtro da lateral, o da task aberta, o último usado e o primeiro da lista". `lib/repositories.ts:84` lê "o primeiro da lista" ao pé da letra: com `guilhermt/aaa-tools` (clone inexistente) primeiro na ordem alfabética, o campo abriu vazio, `Choose a repository`, com `guilhermt/MySpec` utilizável logo abaixo. **Decisão:** o padrão é o primeiro utilizável da lista. **Registrar em:** `screens/board.md` §4 (4.2). **Implementa:** código em `lib/repositories.ts`, sem item próprio.
- **L14 · A barra de filtros numa lista de 452 px** · **Fechado no step 10** (leitura do board). A 1100 com o painel, a barra quebra em duas linhas fixas, e a regra só encolhe a busca abaixo de 620 px (`screens/board.md` §3.3). A leitura recomendava encolher a busca até caber, ou as duas linhas decididas. **Decisão:** a barra fica numa linha: os chips dobram em `Filter · N`, e a busca mantém a largura mínima. **Registrar em:** `screens/board.md` §3.3. **Implementa:** código na barra de filtros, sem item próprio.
- **L15 · A largura do menu de um `Select` e a razão longa de um item** (B4). `components.md` não fixa a largura máxima do menu nem o corte do subtítulo. **Decisão:** o menu de um `Select` tem largura máxima `--size-menu-max` (um token novo, 320 px, `calc(var(--space-16) * 5)`), ou a do gatilho se for maior, e o subtítulo de um item corta com tooltip. **Registrar em:** `components.md` Select, menu e listbox (o Seletor); `tokens.css`. O token é mudança do produto: entra em `design/system/tokens.css` pela pull request da task, no step que o usa (`implementation.md:20`), e `components.md` registra o valor antes. A coluna do visto nos itens com ação, que a leitura também recomendava, já é regra (Anatomia: itens alinhados) e é parte de B4. **Implementa:** B4.
- **L16 · A régua se contradiz sobre o `role` da faixa** (S10; leitura do board). `screens/board.md` §8 diz "A faixa da falha é `role="alert"`", contra `components.md:448` e `12:350` (§4.3 #16). **Decisão:** a faixa da falha é `role="alert"` só na chegada; `screens/board.md` §8 passa a dizer o que §4.3 #16 e `components.md:448` dizem. **Registrar em:** `screens/board.md` §8. **Implementa:** S10.
- **L17 · O texto longo de uma linha de bloqueio da Home** (B3; leitura do board). Um caminho longo quebra em três linhas, e `screens/board.md` §2.2 não diz se a linha quebra ou corta. **Decisão:** um caminho longo numa linha de bloqueio da Home corta com tooltip, nunca quebra. **Registrar em:** `screens/board.md` §2 (2.2). **Implementa:** B3.
- **L18 · O título de um apontamento com código** · **Fechado no step 11** (leitura de Reviews). Os títulos do relatório trazem crases, que aparecem cruas no app (``The lockfile pins two versions of `vite` ``) e entram assim no nome acessível; `components/system/Finding.tsx:201` desenha o título como texto puro, e `screens/review.md` §9 só fixa `--text-ui` 600. **Decisão:** um título de apontamento com código em linha desenha o código como código (mono sobre `--surface-0`, como o texto do apontamento), e o nome acessível fica sem as crases. **Registrar em:** `components.md` Apontamento. **Implementa:** código em `Finding.tsx`, sem item próprio.
- **L19 · Um relógio só para o tempo de uma situação** (S17; leitura de Reviews). A régua pede uma idade por significado, mas não diz que a árvore, a barra e **Continue** dividem o mesmo tique. **Decisão:** um relógio só para os chips de espera, um `useNow` compartilhado no store, para a barra e a árvore nunca discordarem. **Registrar em:** `structure.md` §7. **Implementa:** S17.
- **L20 · A faixa de falha numa lista estreita** (R1). `components.md` Faixa de aviso não diz como a faixa cede. **Decisão:** numa lista estreita, a faixa de aviso por repositório quebra a razão sob o título em linhas inteiras e põe **Try again** à direita numa linha própria; nunca uma palavra por linha. **Registrar em:** `components.md` Faixa de aviso. **Implementa:** R1.
- **L21 · O prompt do produto pendente** (T1; decisão do coordenador sobre o bloqueio da task). **Decisão:** o prompt do produto ao começar um step nunca aparece como mensagem do usuário com **Remove**: enquanto pendente, é o marco em linha `Step 3 started` sem ação, e o Go não aceita apagá-lo (`RemovePending`). **Registrar em:** `screens/task.md` §6. **Implementa:** T1.
- **L22 · O banco de uma versão mais nova** (leitura de Settings; `critique-task-10.md`, opinião, deixada ao usuário). Não decidida: é de produto. Fica em Para o usuário confirmar.

## Pautas

Cada item da pauta de polimento (`lab/08-visual-final/critique.md` §7; `12:272–284`) e da pauta das críticas (`12:286–327`, e os "Podem esperar" das críticas 9 a 11), na área do item que o implementa, com o estado que o passe deu e a evidência. Um item que vale aponta para o id.

### O system, o shell e a árvore

| Origem | Estado | Evidência | Item |
|---|---|---|---|
| Polimento 2, a árvore marca a espera três vezes por linha (155) | Fecha pela decisão | `decisions.md` 2026-10-02; `12:340` (§4.3 #6). O passe não o reabriu | — |
| Polimento 3, a barra quieta com três marcas âmbar (156) | Feito na task 2 | `components/system/RequestBar.tsx:107` (`12:278`); o passe não o reabriu | — |
| Polimento 4, a tecla em caixa em todo botão (157) | Vale (**Deve**) | `Button.tsx:126–133`; teclas soltas em Settings, no compositor, no board e em Reviews | S2 · **Fechado no step 7** |
| Polimento 6, a transição entre lugares (159) | Feito | `components.md` Troca de lugar (`12:281`); o passe não o reabriu | — |
| Polimento 7, a barra de rolagem global (160) | Vale (**Deve**) | Nenhum `::-webkit-scrollbar` em `globals.css`; o textarea do prompt e o corpo de um diálogo rolam nativos. A lista do board usa a barra fina do system em todas as larguras | S3 · **Fechado no step 7** |
| Polimento 9, o `…` do breadcrumb (162) | Feito na task 2 | `PlaceHeader.tsx:48–95` (`12:284`); o passe não o reabriu | — |
| O **Copy** em todo bloco de código (`12:168`) | Vale (**Deve**) | `Markdown.tsx:16`, `:108–186` (`COPY_LABELS`, `:117`) | S4 · **Fechado no step 7** |
| `critique-task-04.md:119–123` (9), o cabeçalho do código sem caminho | Vale | O cabeçalho só com a linguagem | S4 · **Fechado no step 7** |
| `ModelPicker` nos dois diálogos (`12:92`; `09:73`, `:109`) | Vale | `StartReviewDialog.tsx:10`, `:198`; `NewDiscussionDialog.tsx:343` | S5 · **Fechado no step 2** |
| `critique-task-01.md:150` (12), o ícone fora de `icons.ts` em `Select.tsx:1` | Não vale mais | É o `ChevronDown`, que não é significado e que a regra do system permite (`components/system/Icon.test.tsx:57–75`, a V2) | — |
| `critique-task-02-fixes.md:40` (M1), o laço e o teto do `Presence` | Vale | `Presence.painted.test.tsx:62` | S24 · **Fechado no step 7** |
| `critique-task-02-fixes.md:42` (M2), o trilho de erro da faixa | Vale | `SidebarRail.tsx:147`; sem teste da faixa | S25 · **Fechado no step 7** |
| `critique-task-02-fixes.md:46` (M4), a saída do toast empurrado | Vale (opinião da crítica) | `ShellToasts.tsx:21–36` | S26 · **Fechado no step 7** |
| `critique-task-02-fixes.md:48` (M5), quatro toasts por 120 ms | Vale, sem defeito; decidido | `ShellToasts.tsx:38–41`; o mais antigo sai no mesmo instante, em `--duration-fast` (registro em `components.md` Aviso do app e toast) | S27 · **Fechado no step 7** |
| `critique-task-05.md:183` (9), o item desabilitado com ação focado no escuro | Vale (**Deve**) | `Menu.tsx:271`, 4,44:1 no escuro | S14 · **Fechado no step 7** |
| `critique-task-05.md:188` (10); `critique-task-06.md:173` (4), as faixas sempre `role="alert"` | Vale | `BoardReadingStates.tsx:48`, `ReviewsReadingStates.tsx:46`, `CheckStrip.tsx:47` | S10 |
| `critique-task-05.md:206` (16), `◇` como caractere solto | Vale | 15 lugares, do system e de fora | S23 · **Fechado no step 7** |
| `critique-task-05.md:230–233` (21), a região do `KeyNotice` | Vale | `KeyNotice.tsx:100`, `:96` | S10 |
| `critique-task-05.md:392`, o comentário de `REVIEW_MODES` | Vale | `lib/review-modes.ts:3` | S28 · **Fechado no step 2** |
| `critique-task-05.md:394`, o `role="status"` de `Cloning` | Vale | `StartRow.tsx:150` (a pauta dizia `:143`) e `:125` | S10 |
| `critique-task-06.md:169` (3), o anel de foco no WebKitGTK | Vale (**Bloqueia**) | Visto no Broadway na árvore, nos diálogos, no board e em Reviews, também só com o teclado | S1 · **Fechado no step 7** |
| `critique-task-09.md`, segunda leitura: o `Cut` do dobrado com tooltip mesmo inteiro | Vale | `FoldedDraft.tsx:56–62`; `MarkerLine.tsx:173` | S22 · **Fechado no step 7** |
| `critique-task-09.md`, O que ficou aberto: o tooltip, "um comportamento só" | Vale | `ListRow.tsx:121–135` (`Cell`); `GroupEpicDialog.tsx:137`; `NewDiscussionDialog.tsx:214` | S22 · **Fechado no step 7** |
| `critique-task-09.md`, novo: a razão cortada do rodapé não abre pelo foco | Vale | `Dialog.tsx:216`; nos diálogos de criação, de publicação e de agrupar | S21 · **Fechado no step 7** |
| `critique-task-09.md` (13), miúdo: a idade da barra e da árvore | Vale | Na task, no review e na discussão | S17 · **Fechado no step 8** |
| `critique-task-11.md` (11), o anel em **Cancel** de um diálogo aberto pelo teclado | Vale (**Deve**) | Visto no Broadway | S1 · **Fechado no step 7** |
| `critique-task-11.md` (16), o `Tag` em mono nas etiquetas | Vale, reaberto | A forma é a do `Tag`; o problema é a escolha do componente | S7 · **Fechado no step 8** |
| `critique-task-11.md`, O que as correções abriram: o toast sobre a barra do pedido | Vale | `toast-lift.ts:9–24`; só `Composer.tsx:121` chama | S19 · **Fechado no step 8** |
| `critique-task-11.md`, O que as correções abriram: as passadas da página do review com `clockTime` | Vale | `gone-passes.ts:47`, `:82`; `gone-rounds.ts:11` | S20 · **Fechado no step 8** |
| `critique-task-11.md`, segunda leitura: a fixture `stayed` com `--force` diante de uma permissão | Feito | `GoneView.scenes.painted.test.tsx:146` (`registered: false`); a captura `gone-gone-deleted` mostra `rm -rf` e o aviso dele | — |

### A task

| Origem | Estado | Evidência | Item |
|---|---|---|---|
| Polimento 1, três eixos de alinhamento no topo a 2500 px (149–154) | Não vale mais | Um eixo só; o stepper até ~1.414 px e as ferramentas desde ~2.080 px (app, 2560, claro e escuro) | — |
| Polimento 5, `Enter to send · Shift+Enter…` (158) | Feito na task 4 | `12:280`; o passe não o reabriu | — |
| Polimento 8, os botões de painel e **Pause** com o mesmo peso (161) | Feito nas tasks 2 e 3 | `12:283`; o passe não o reabriu | — |
| `critique-task-03.md:58` (3), o nome da pílula repete o lugar | Feito para os bloqueios; sobra o encerramento | `lib/situations.ts:262–284` (`PLACE_IN_LABEL`) | T6 · **Fechado no step 9** |
| `critique-task-03.md:64–70` (5), os checks cortados em `Details` | Vale, sem tooltip | `ChecksList.tsx:139–148` | T5 · **Fechado no step 9** |
| `critique-task-03.md:64–70` (6), o status congelado de `request.ts` | Feito | `request.ts:434–442` (`statusOf(label, place)`), congelado por `useBornStatus` (`TaskRequest.tsx:100`) | — |
| `critique-task-03.md:64–70` (6), o nome de **Resume** | Não vale mais | `components/PauseButton.tsx:44`, `:58`: o nome é `Resume`, o resto na descrição | — |
| `critique-task-03.md:64–70` (6), `step_review` na aba do implementador | Vale | `agent-tabs.ts:102` | T13 · **Fechado no step 9** |
| `critique-task-03.md:64–70` (6), a escolha própria no popover Models | Não vale mais | `ModelsPopover.tsx:108` (`own={false}`); a própria é do step, em `Details` (`task.md` §10) | — |
| `critique-task-04.md:101` (2), a opção sem pressionado nem desabilitado | Vale | `OptionGroup.tsx:6`; `QuestionCard.tsx:342–348` | T9 · **Fechado no step 9** |
| `critique-task-04.md:102` (3), a hora da resposta no nome | Vale | `QuestionCard.tsx:117`, `PermissionCard.tsx:135` | T10 · **Fechado no step 9** |
| `critique-task-04.md:103–111` (4), as provas | Vale em parte | **Go to reviewer** tem prova (`TaskRequest.test.tsx:404`) e **Retry reviewer** está em `TaskRequest.test.tsx:429`; o resto falta | T18 · **Fechado no step 9** |
| `critique-task-04.md:112` (5), `error_status` | Fecha como nota | `12:299` | — |
| `critique-task-04.md:113` (6), `GetActionOutput` | Fecha como nota | `12:300` | — |
| `critique-task-04.md:114` (7), o teste de `Close` com `spawnPRWork` | Vale | Só `TestCloseWaitsForThePreparationItCancels` | T18 · **Fechado no step 9** |
| `critique-task-04.md:115–118` (8), os valores soltos | Vale | `max-h-48`, `h-8`, `max-w-[58.5rem]` | T15 · **Fechado no step 9** |
| `critique-task-04.md:119–123` (9), o `panZoom` do mermaid | Vale, e pior que nota | `Markdown.tsx:17` | T3 · **Fechado no step 9** |
| `critique-task-04.md:119–123` (9), o cursor do streaming | Vale | `Markdown.tsx:95` | T12 · **Fechado no step 9** |
| `critique-task-04.md:119–123` (9), `BackToEnd` sem hover | Vale | `BackToEnd.tsx:32` | T11 · **Fechado no step 9** |
| `critique-task-04.md:124` (10), as fixtures da conversa | Vale | `test/conversation-scenes.ts:233`, `:397–415` | T18 · **Fechado no step 9** |
| `critique-task-04.md:125` (11), o `blockHint` de `clone_missing` | Vale | `step-status.ts:229` | T16 · **Fechado no step 9** |
| `critique-task-04.md:132` (nota 3), o lugar vazio não anunciado | Vale | Nenhum `announce` em `features/task` | T17 · **Fechado no step 9** |
| `critique-task-07.md:369` (4), a prova do corte não morde | Vale | `TaskView.scenes.painted.test.tsx:411`, sem `longName` | T18 · **Fechado no step 9** |
| `critique-task-10.md`, o `Textarea` com `rows` (`PermissionCard` 2) | Feito | `components/system/Textarea.tsx` respeita `rows`; sem mudança visível | — |

### Home, board e criação

| Origem | Estado | Evidência | Item |
|---|---|---|---|
| `critique-task-05.md:155` (1), `--col-dep` e `--size-dialog-wide` sem conteúdo real | Vale | `test/board-scenes.ts:249`, `:263` | B11 · **Fechado no step 10** |
| `critique-task-05.md:160` (2), `S` e `D` fora da leitura sem teste na visão | Vale | `BoardView.tsx:368–380` | B11 · **Fechado no step 10** |
| `critique-task-05.md:200` (13), a linha 2 de **Continue** | Vale em parte | O breadcrumb corta com tooltip; a situação não corta | B8 · **Fechado no step 10** |
| `critique-task-05.md:202` (14), a falha na linha de board da Home sem tooltip | Feito; falta a prova | `StartRow.tsx:225–233` usa `ReadingAge` com `failure`. A prova do tamanho `meta` falta (FE16 de `critique-task-10.md`) | B11 · **Fechado no step 10** |
| `critique-task-05.md:204` (15), a Home ordena por tipo | Vale | Visto no app | B2 · **Fechado no step 10** |
| `critique-task-05.md:213` (17), `Shortcuts:` em `sr-only` | Vale | `Home.tsx:194–195` | B9 · **Fechado no step 10** |
| `critique-task-05.md:215–221` (18), a barra da seleção sem o esmaecido | Vale | `BoardView.tsx:449` | B7 · **Fechado no step 10** |
| `critique-task-05.md:215–221` (18), `The clone is running.`, o link `Archived task:`, `_app` | Vale | `card-panel.ts:128`, `BoardCardPanel.tsx:160`, `board-view.ts:144` | B10 · **Fechado no step 10** |
| `critique-task-05.md:215–221` (18), `no card to select` | Não vale mais | É o texto de `screens/board.md` §3.7 (`BoardView.tsx:410`) | — |
| `critique-task-05.md:223–226` (19), as provas curtas | Vale | `slice(0, 8)`; o aviso de dependência segue §9 e falta a prova; `state.go:78–79` sem teste Go | B11 · **Fechado no step 10** |
| `critique-task-05.md:230–233` (21), o nome da linha sem `Clone failed` e `Cloning…` | Vale | `board-view.ts:530–549` | B5 · **Fechado no step 10** |
| `critique-task-05.md:230–233` (21), a razão do chip órfão só no tooltip | Vale | `FilterBar.tsx:58–65` | B6 · **Fechado no step 10** |
| `critique-task-05.md:393`, `closePanel` pela classe | Vale | `BoardView.tsx:199` | B10 · **Fechado no step 10** |
| `critique-task-06.md:344`, o fio entre as linhas de **Models** sem prova | Vale | `NewTaskDialog.tsx:389` | B11 · **Fechado no step 10** |
| `critique-task-10.md`, item 10, a idade da Home | Feito; a prova FE16 vale | Como `:202` acima | B11 · **Fechado no step 10** |
| `critique-task-10.md`, miúdos, o `Textarea` com `rows` nos campos da task 5 | Feito | **Context** abre com quatro linhas no app (`NewTaskDialog.tsx:321`) | — |
| `critique-task-11.md`, item 1, "vale também para o board" | Vale | Visto no app | B1 · **Fechado no step 3** |
| `critique-task-11.md`, segunda leitura, o `↓` da busca do board | Feito | `components/system/SearchInput.tsx:76–77` previne a ação padrão | — |

### Reviews e o review

| Origem | Estado | Evidência | Item |
|---|---|---|---|
| `critique-task-06.md:155` (1), o schema do GitHub | Vale | `internal/pulls/github_test.go:264` | R4 · **Fechado no step 11** |
| `critique-task-06.md:212` (11), o recuo do visto no **Filter** | Vale | `Menu.tsx:296–315` contra `:336–346` | R3 · **Fechado no step 11** |
| `critique-task-06.md:343` (Novo), `Ctrl E` no **Open in VS Code** da barra | Feito na régua | O coordenador escreveu `Ctrl E` em `tasks/06-review.md:223` e em `screens/task.md:207`, a linha do `step_review`; o botão já a tem desde a task 6. Não é código | — |
| `critique-task-10.md`, miúdos, o `Textarea` com `rows` em `StartReviewDialog`, `ReviewAgainDialog` e `PublishDialog` | Feito | `components/system/Textarea.tsx` respeita `rows`. No app, **Add instructions** e **Edit** do resumo não foram abertos | — |

As faixas sempre `role="alert"` (`critique-task-06.md:173`), o anel de foco (`critique-task-06.md:169`), a razão do rodapé (`critique-task-09.md`), a tecla em caixa (polimento 4) e as passadas com `clockTime` (`critique-task-11.md`) estão na área do system: S10, S1, S21, S2 e S20.

### A discussão

| Origem | Estado | Evidência | Item |
|---|---|---|---|
| `critique-task-09.md` (1), o épico descartado a 60% | Feito | Sem `opacity` no `Draft.tsx`; `discussion-epic-off-*` com o título em `--ink-2` e o corpo em tinta cheia | — |
| `critique-task-09.md` (2), a pastilha onde não há | Feito | `discussion-request.ts:345–369` | — |
| `critique-task-09.md` (3), os títulos do corpo | Feito no rascunho | `CardDraft.tsx:158` (`ui-headings`); não no `Documents` nem no corpo do marco | S6 · **Fechado no step 8** |
| `critique-task-09.md` (4), o que fica sob a barra | Vale em parte | A edição rola e o `listbox` sobe; a pílula `↓` cobre o atual | D1 |
| `critique-task-09.md` (5, 6, 8, 9, 10, 11) | Feito | Segunda leitura da crítica 9; o 8 conferido no app (`✓ Created api#479 · 13:58`) | — |
| `critique-task-09.md` (7), as áreas de texto | Feito | `DraftEditor.tsx:307`, `NewDiscussionDialog.tsx:241–242`; três linhas em `discussion-start-*` | — |
| `critique-task-09.md` (12), os valores soltos | Vale em parte | Os diálogos com `--space-*`; sobram `UnclonedRepository.tsx:37` e `DraftEditor.tsx:316` | D3 |
| `critique-task-09.md` (13), os miúdos | Feito, menos a idade | `· click again to undo` depois de **Retry** no app | S17 · **Fechado no step 8** |
| `critique-task-09.md`, segunda leitura: a pílula `↓` sobre o atual | Vale | `discussion-drafts-978`/`-812` | D1 |
| `critique-task-09.md`, segunda leitura: **Edit** ao lado de **Done**, **Body** sem `Markdown` | Vale | `drafts-card.ts:498–505`; `DraftEditor.tsx:298` | D2 |
| `critique-task-09.md`, segunda leitura: o tooltip sempre na lista e no dobrado | Vale | `MarkerLine.tsx:174`, `FoldedDraft.tsx:59` | S22 · **Fechado no step 7** |
| `critique-task-09.md`, novo: a razão cortada do rodapé pelo teclado | Vale | **Group drafts into an epic** | S21 · **Fechado no step 7** |
| `critique-task-09.md`, novo: a decisão abaixo da dobra | Vale | `discussion-partial-fail-978`, `discussion-epic-off-978` | D1 |
| `critique-task-10.md`, o `Textarea` com `rows` (`DraftEditor` 6) | Feito | Sem mudança visível em `discussion-drafts-edit-*` | — |

### Settings, History e diálogos

| Origem | Estado | Evidência | Item |
|---|---|---|---|
| `critique-task-10.md`, deixada pelo coordenador: o tema escuro na falha de permissão | Vale, fecha como nota | `features/theme/theme.ts` lê o tema guardado pelo `localStorage` do WebKit, que fica no diretório de dados; sem permissão nele, a tela de falha sai clara. É um caso de borda de `10:296` | — |
| `critique-task-10.md`, deixada pelo coordenador: os testes de digitação longa estourando o tempo sob carga | Vale | Pauta de estabilidade, com `BoardDialog.test.tsx:249` (`12:496`). As suítes não foram rodadas | H7 |
| `critique-task-10.md`, deixada pelo coordenador: `user_version` à frente | Vale | `internal/store/migrate.go:18` | L22 |
| `critique-task-10.md`, deixada pelo coordenador: o cursor no começo da edição | Não vale mais | A mutação era equivalente (segunda leitura da 10) | — |
| `critique-task-10.md`, deixada pelo coordenador: a sonda com `EFBIG` | Vale, fecha como nota | Sem mudança desde a 10; `ENOSPC` é o caso real | — |
| `critique-task-10.md`, segunda leitura: o alvo do rádio da tabela | Feito | `components/system/Radio.tsx:115`: o `label` é a grade da célula, com o anel nela, como diz o comentário de `:112` | — |
| `critique-task-10.md`, segunda leitura: `Select` `xs` e `MenuMessage` `notice` sem régua | Feito | `components.md:220` (Select compacto), `:222` (`notice`); `docs/architecture/design-system.md:156` | — |
| `critique-task-10.md`, segunda leitura: o banco fora dos `closers` (A11) | Feito no código | `internal/app/attempt.go:88–92`; o passe não achou teste que o prove | — |
| `critique-task-11.md` (15), commits acima de 1,5 mil linhas | Registrado, sem ação | `12:496` | — |
| `critique-task-11.md` (16), os testes Go intermitentes | Vale | `reviewflow/apply_test.go:679`, `bindings/task_service_test.go:1372`, sem mudança. Não rodados | H7 |
| `critique-task-11.md`, segunda leitura: o `↓` da busca põe o primeiro dia atrás da barra | Feito | `SearchInput.tsx:75–78` previne a ação padrão; `BELOW_THE_BAR` em `HistoryView.tsx:50–51`. No app, a lista andou pelo teclado com o anel à vista | — |
| `critique-task-11.md`, segunda leitura: a janela dos reviews no estado sem prova | Feito | `internal/app/state_test.go:78–84` semeia `review-first` e `review-before` | — |
| `critique-task-11.md`, segunda leitura: `HistoryView.measure` sob carga | Feito; as metas absolutas falham | O teto relativo de 30 vezes contra 40 itens (`target-machine.md:72`) | H1 · **Fechado no step 4** |
| `critique-task-11.md`, segunda leitura: `isMissingFile` frágil | Vale (opinião) | `lib/errors.ts:34` | H8 |
| `critique-task-11.md`, segunda leitura: `UNSTARTED` sem `preparing` | Feito | `features/task/stage-actions.ts:67` | — |
| Estabilidade: `features/boards/BoardDialog.test.tsx:249` (`12:496`) | Vale | `aria-describedby` logo depois de digitar | H7 |

## O que não foi visto

**O system, o shell e a árvore.**

- **O aviso do app e os toasts no app real:** pedem uma ação que falhe sem lugar (uma pausa que não para) e um item que saia sem estar aberto, o que pede `claude` ou `gh`. Vistos nas capturas `gone-notice` e `gone-notice-toast-three` (978, os dois temas).
- **A página da task encerrada e a do review no app:** pedem um encerramento. Vista a da task apagada (2000, escuro) e as capturas `gone-gone*`.
- **O meio pixel:** conferido só nas ampliações da faixa recolhida (1100), da árvore (1100) e do indicador de rolagem; nenhuma borda borrada. As outras peças do shell não foram ampliadas.
- **A barra de rolagem do GTK:** nenhuma área nativa com conteúdo maior que ela foi aberta no app (o corpo de um diálogo longo, um `listbox`), então a barra que o GTK pintaria não foi vista; S3 vem do código.
- **O movimento reduzido:** o Broadway não emula `prefers-reduced-motion`.
- **Os nomes acessíveis:** o Broadway desenha num canvas e não expõe o DOM; vistos só no código citado.

**A task.**

- **A sessão viva:** o agente trabalhando, o streaming, o grupo vivo, `Working · 3m 40s` e **Stop**, a fila de verdade, o retry com contagem, a piscada e o anúncio de uma barra ou de um cartão que nasce, os cartões pendentes de pergunta e permissão e as teclas `1`–`9`. Sem `claude`, toda sessão aberta pelo app vira `Session error`, e o app assenta o pendente como cancelado (`settle`, `internal/session/service.go`). Vistos só nas capturas.
- **Os apontamentos da PR no app:** sem `gh`, a PR ficou bloqueada e o lugar trocou a conversa pelo vazio (T2). O cartão de decisão, a barra de decisão, `A`/`D`/`E`/`O` e `Alt+↓` foram vistos só nas capturas `scene-findings-*` e `bar-findings-*`.
- **O teclado e o foco no motor:** o percurso do `feed`, as abas com ←→ e o anel depois de um clique não foram dirigidos no Broadway (só pixels; o foco do cartão de rascunhos aparece nas capturas).
- **Os popovers Review mode e Models, a conversa anterior aberta de `Details`, `Card` e os checks:** não abertos no app; a task semeada não tinha PR lida nem conversa anterior com `Back to step N`.
- **O GTK com o Hyprland e o movimento reduzido:** fora do Broadway; são da checklist do usuário (`12:31`, pronto 9).

**Home, board e criação.**

- **Clone and continue, clonando e a falha do clone, no card e na linha:** pediriam clonar um repositório que existe e não está clonado. Os três repositórios extras não existem no GitHub, e o clone de `MySpec` já tinha sido feito pela Home. As capturas `board-no-clone` cobrem a forma.
- **Board nunca lido (o esqueleto), board vazio, filtro sem resultado, card fora da leitura:** o board real não tem esses estados. Ficam as capturas `board-reading`, `board-empty`, `board-filtered` e `board-stale-card`.
- **Confirmar o diálogo de criação** (`Creating…`, os erros de confirmação e a task aberta): criaria uma task de verdade. Vistos só o nome inválido, o padrão vazio, os modelos e o `listbox`.
- **New discussion da Home e `D` com a seleção:** o diálogo é da área da discussão.
- **O escuro a 1250, 2000 e 2560:** visto só a 1100 e a 1450. O contraste vale pelos tokens nos dois temas.
- **O meio pixel em capturas ampliadas:** não medido no Broadway. A varredura de `12:234` cobre.
- **A janela virtualizada do board:** ainda não existe na `main`.

**Reviews e o review.**

- **Publicar e a falha da publicação** (`Publishing…`, `Couldn't publish to GitHub`, a barra `Publish failed` e os marcos `You decided` e `Published pass 1`): escreveriam no GitHub. Ficam as capturas `review-publish*` e `review-pass`.
- **Iniciar um review de verdade** (`Starting…`, `Creating the worktree…`, a recusa do git) e **Review again:** iniciariam uma sessão e uma worktree. Fica a captura `review-again`.
- **O modo Apply, a PR própria (`?own`) e a regra `Your own pull request: GitHub takes only Comment.`:** nenhuma PR aberta é do usuário. Ficam as capturas `review-publish-own`, `reviews-start-own` e `review-findings-apply`.
- **A espera dos checks, `Couldn't check GitHub`, commits novos, `pr_trouble` e o encerramento pelo merge com a tela aberta:** os checks das PRs reais já tinham passado, e nenhuma PR fechou durante a sessão. Ficam as capturas `review-checks`, `review-findings-checkerr`, `review-merged` e `review-clean`.
- **O clone da PR num repositório sem clone e o fork:** não havia nenhum dos dois.
- **A primeira leitura das PRs logo depois do clone:** a Home disse `Nothing pending` até Reviews ser aberto e reler (`features/home/home.ts:112–113`). Não ficou claro se a primeira leitura rodou antes de o repositório entrar, e por isso não entrou como item.
- **O escuro a 1250, 2000 e 2560, e o meio pixel em captura ampliada:** como na área do board.

**A discussão.**

- **A sessão de verdade:** `Discussing · working`, a pergunta em cartão e a permissão, **Ask for changes** com `Drafts revised` e `Revised`, a rodada nova que dobra a anterior, o erro de sessão com **Retry** e a piscada da barra nascida: sem `claude`. As formas estão em `discussion-talk*`, `-rewrite`, `-done` e `-unreadable`.
- **Uma publicação:** `Publishing…`, a pílula `publishing`, a cadeia correndo e o **Retry** clicado: sem `gh` e sem escrita no GitHub, de propósito.
- **O diálogo de nova discussão no app:** com o board nunca lido (sem `gh`), **New discussion** fica tracejado com `The board hasn't been read yet.`; o diálogo foi visto só nas capturas.
- **Arquivar, apagar e agrupar no app:** não confirmados; vistos nas capturas `-done-archive`, `-drafts-delete`, `-many-group` e na página que saiu (`-done-archived`, `-drafts-deleted`).
- **O teclado (`A`, `D`, `E`, `Alt+↓`, a trava de 900 ms) no motor:** não dirigido nesta passada; a crítica 9 o conferiu no Broadway, e nada no código da área mudou desde então.
- **Os marcos `Drafts written` e `Discussion started` com os números e o modelo:** o banco semeado não tinha `count` nem `model` nos marcos, e o app mostrou `0 drafts` e o marco sem modelo; é artefato da semeadura, não do produto.

**Settings, History e diálogos.**

- **O início, as boas-vindas e a migração no app:** pedem um diretório sem permissão, um `HOME` sem cadastro e um banco legado. Vistos nas capturas `start-*`, `welcome-*` e `migration-*` (978, 2180, 1250, 2560, os dois temas), que mostram o que `screens/rest.md` §5–§7 pede. No app, a crítica 10 já os viu.
- **Defaults com o catálogo lido** (`factory`, o menu do chip, `6 of 9 changed`): pede o `claude`. No app, só a faixa `◇ Claude Code was not found` e os chips com as escolhas salvas.
- **O diálogo de board, Add repository e os de remover no app:** pedem o `gh` para ler o board. Vistos nas capturas `settings-boards-*` e `settings-repos-*`.
- **Back to… e Discard and restart… no app:** o menu e **Discard step** foram abertos, esses dois não. Vistos nas capturas `dialogs-back-to-stage*`.
- **O review e a discussão arquivados no app:** só a task arquivada foi aberta. Vistos nas capturas `history-archived-*`.
- **As notificações do sistema:** pedem o servidor de notificação e uma situação nova com `claude`. Só o texto no Go foi lido.
- **O contraste em pixel:** calculado dos tokens nos dois temas, com as misturas em sRGB. Os pares destas telas passam de 4,5:1: `--ink-4` sobre `--surface-1` dá 6,05 no claro e 6,45 no escuro, e sobre `--brand-tint-plane`, 5,11 e 4,95; `--state-error` sobre `--state-error-veil`, 5,42 e 5,77; `--tooltip-ink-2` sobre `--tooltip-surface`, 8,32 e 6,73. As exceções estão na área do system (S14, S16). `--ink-4` sobre o véu pressionado da lateral dá 4,36 no claro, e `tokens.css` já o exclui.

## Para o usuário confirmar

**O banco de uma versão mais nova** (L22). `internal/store/migrate.go:18` pula as migrações quando o `user_version` do banco está à frente do app, e o app abre sem aviso: uma versão antiga do MySpec passa a ler e escrever num banco de uma versão mais nova. `structure.md` §7 só tem a migração recusada. Veio de `critique-task-10.md` (opinião), e o coordenador o deixou ao usuário porque muda um fluxo.

**Recomendação:** abrir na tela da migração recusada (`screens/rest.md` §7), com o caso "this data is from a newer MySpec". Se o usuário aprovar, entra em `changes.md`, em `screens/rest.md` §7 e no step da área Settings, History e diálogos; se não, fica como está, e a resposta é escrita aqui.
