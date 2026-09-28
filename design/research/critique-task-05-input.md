# Crítica do material de entrada da task 5 · Home, board e criação de task

Revisão de `design/tasks/05-board.md` (466 linhas) e das edições não commitadas em `design/` (`backend.md`, `changes.md`, `decisions.md`, `implementation.md`, `screens/board.md`, `structure.md`, `system/components.md`). A régua é `implementation.md:18`, e o código é o da `main` em `1894f3e`. `05:N` é a linha do material. `design/system/tokens.css` está idêntico ao de `1894f3e` (`git diff 1894f3e -- design/system/tokens.css` vazio).

Como foi olhado: o material inteiro; `board.md` inteiro; os trechos citados de `structure.md`, `principles.md`, `components.md`, `changes.md`, `backend.md`, `decisions.md` e `implementation.md`; `lab/11-screen-board/src/shell.js`, `a.js`, `a.css`, `board.css`, `data.js` e a `critique.md` da rodada; o código de `features/home`, `features/board`, `features/task-create`, `features/discussion/NewDiscussionDialog.tsx`, `features/sidebar/new-discussion-board.ts` e `NewMenu.tsx`, `features/task/CardPanel.tsx`, `card-panel.ts` e `DetailsPanel.tsx`, `components/system/` (Dialog, Select, Menu, Checkbox, SearchInput, RelationList, Kbd, StateGlyph, icons), `store/app-store.ts`, `lib/locations.ts`, `lib/when.ts`, `app/useGlobalShortcuts.ts`, `styles/globals.css` e `globals.test.tsx`, `internal/bindings/dto.go`, `convert.go`, `task_service.go` e `board_service.go`, `internal/discussion/service.go`, `internal/board/context.go`, `internal/app/state.go`. As medidas foram feitas em Chromium (Playwright do repositório) numa página fora do repositório, com as fontes de `@fontsource` e os tokens de `design/system/tokens.css`. O contraste foi calculado dos tokens em OKLCH, não estimado.

## Veredito

**Corrigir antes.** O material é sólido: o inventário confere, as larguras e as colunas batem com a conta, P22 está bem dimensionado e nenhuma decisão por delegação precisava do usuário. Mas sobram oito lacunas que um tech spec teria de perguntar ou que fazem um pronto falhar (L1 a L8), e uma dúzia de ajustes pequenos. Tudo cabe numa passada de edição, sem nova rodada; uma segunda leitura curta basta.

## 1. Lacunas, em ordem de gravidade

**L1. A contagem de `open cards` da Home contradiz o próprio exemplo e o mock.** `05:120` define a contagem como "os cards com `state` aberto, em qualquer status", e dá o exemplo `46 open cards` e o nome `Platform Roadmap, 46 open cards, read 2m ago`. Com os dados de `data.js`, que o pronto 1 manda reproduzir, essa regra dá **49** (46 abertos fora das finais e 3 abertos em `In dev` e `Ready for release`: #453, #451, #452). O mock escreve 46 (`src/shell.js:287`). *Decisão proposta:* a linha conta os cards abertos fora dos status finais (o que ainda se escolhe, e o mesmo número das linhas visíveis com as finais recolhidas); `05:120` e `board.md:56` passam a dizer isso.

**L2. As horas das fixtures são incoerentes na cena `failed`.** O pronto 1 (`05:19`) fixa "leitura às 14:08" e "falha da cena `failed` às 14:06". Uma falha às 14:06 seguida de uma leitura boa às 14:08 não existe: a leitura boa limpa a falha, e o cabeçalho diria `Read 2m ago` com a faixa `· 4m ago`. O mock usa a leitura de 12:10 nessa cena (`src/shell.js:208`, `Read 2h ago`), que é o que `05:156` também cita. *Decisão:* na cena `failed`, `readAt` às 12:10 e `failedAt` às 14:06; nas outras, 14:08. Junto: `Mobile App` precisa de `readAt` anterior a 13:52 e de 31 cards abertos nas fixtures (`src/shell.js:285`), que o pronto 1 não lista; e `Internal Tools` lido "ontem às 17:40" dá `20h ago` pelo `age` (`lib/when.ts:79–95`), não o `Read 1d ago` que `05:321` (#20) promete. Fixe a hora de `Internal Tools` em 2026-09-23 às 12:00 (`1d ago`) ou troque o texto do #20.

**L3. `--panel-card-width` não pode sair de `UNROUNDED_WIDTHS` sem uma quarta mudança de token.** `05:335` manda tirá-lo da lista (`styles/globals.test.tsx:62`). O teste "rounds every layout width that depends on the window" (`globals.test.tsx`, logo abaixo) reprova todo token `--panel-*` com `%` e sem `round(`, e o token é `clamp(22.5rem, 42%, 40rem)` (`tokens.css:98`). O arredondamento que o material decide é no uso (`round(down, var(--panel-card-width), 1px)`, `05:203`), como `--panel-width`, que continua na lista depois da task 2. *Decisão:* `--panel-card-width` fica em `UNROUNDED_WIDTHS`, e o comentário da constante passa a dizer "arredondadas no uso". Nenhum token além dos três da §4.3.

**L4. A §6 diz que a task 5 não toca `features/task/` salvo `CardPanel.tsx` e `card-panel.ts` (`05:414`), e o step 3 contradiz.** O step 3 atualiza `features/task/DetailsPanel.test.tsx` e cria a prova pintada em `DetailsPanel.painted.test.tsx` "ou a de larguras da tela da task" (`05:412`, `05:452`); a task 4 edita `DetailsPanel.tsx` e `details.ts` (`04:425`) e, com eles, o teste. `DetailsPanel.test.tsx` é jsdom e não mede nada, então não há o que mudar nele. A tabela da §6 também omite dois arquivos que as duas tasks editam: `store/app-store.test.ts` (a 4 no pedido de foco; a 5 em `:1985`, `:2395` e `openBoardCard`) e `design/implementation.md`, task 12, onde as duas registram a medição (`04:31`, `05:28`). *Decisão:* a prova da coluna das chaves fica só num arquivo novo, `features/task/DetailsPanel.painted.test.tsx`, sem tocar `DetailsPanel.test.tsx` nem `TaskView.widths.painted.test.tsx`; a §6 ganha as três linhas (o teste pintado novo, sem conflito; `app-store.test.ts`, textual; `implementation.md` task 12, um parágrafo por task) e reescreve `05:414`.

**L5. `The task was undone.` e **Try again** pedem um dado que o Go não dá.** `05:290` e `board.md:337` mostram o erro da sessão que não começou "seguido de `The task was undone.` e **Try again**". Hoje `CreateTask` apaga a task e devolve só a mensagem do erro (`internal/bindings/task_service.go:173–178`), igual a qualquer outra falha: o frontend não sabe se a task foi desfeita. O material diz que o único dado do Go é P22 (`05:15`). E **Try again** repete **Create**, que já volta a agir (`05:290`): são dois botões para o mesmo gesto. *Decisão:* o binding acrescenta ` The task was undone.` à mensagem quando `StartTask` falha (uma linha em Go, que entra no step 8 e em `backend.md` como P22b, custo nenhum); o rodapé mostra a mensagem como vem e não tem **Try again**: **Create** é o repetir. `board.md:337` perde o **Try again**.

**L6. O foco não tem regra quando o que o tinha some.** Quatro casos sem destino:
- a linha com o foco sai da lista numa leitura (o card saiu da leitura, ou mudou para uma seção recolhida, ou o filtro o esconde): `05:268` diz qual é a parada de Tab, não para onde vai o foco que estava nela;
- `Esc` ou `×` no card fora da leitura com o foco no painel: `05:201` devolve o foco "à linha", que já saiu (`05:230`);
- B13 com a linha escondida por um filtro ou numa seção recolhida por outro motivo: `05:232` põe "o foco na linha dele" sem dizer o que acontece quando ela não está visível (a relação dentro do painel diz "quando ela está visível", `05:211`, e não diz o outro caso);
- o **Change path…** que dá certo: o card passa a `start`, e o foco fica num botão que sumiu.

*Decisão:* numa lista, o foco que perde a linha vai à linha visível seguinte, senão à anterior, senão ao cabeçalho da seção dela; o painel que fecha sem linha devolve o foco à parada da lista; no B13 com a linha escondida, os filtros ficam, o painel abre e o foco vai à primeira ação habilitada do painel (senão ao `×`); depois de **Change path…**, o foco vai à primária nova do painel, como depois de **Add to board** (`05:228`).

**L7. Teclas sem regra no modo de seleção e no card fora da leitura.**
- `S` no modo de seleção: a coluna das teclas mostra só `Space` (`05:191`), o card não abre (`05:253`), mas a tabela de `S` (`05:242`) não exclui o modo, e o mock abre o diálogo de criação (`src/shell.js:535`). *Decisão:* `S` não age no modo, sem aviso, porque a tecla não está escrita ali.
- `S` e `D` no painel do card fora da leitura: a tabela de `S` (`05:242`) e a de `D` (`05:243`) não têm o caso. *Decisão:* `No task from #466` · `The card isn't in the last reading of the board.` e `#466 can't go into a discussion` · o mesmo texto.
- O aviso de `S` preso "ao botão da ação no painel" (`05:247`) não tem botão em `has_task` nem em `closed`. *Decisão:* preso à linha das ações do painel.

**L8. O modo de seleção esconde os filtros ativos.** A barra da seleção toma o lugar da barra de filtros (`05:252`), e a lista continua filtrada (o mock filtra, `src/shell.js:259`), sem nenhum sinal na tela de que há um filtro. E dois becos: **Select cards to discuss** num board lido sem cards, ou com o filtro sem resultado, entra num modo sem linhas; nesse caso o vazio mostra **Clear filters** (`05:160`), que `05:254` diz que espera o fim do modo. *Decisão:* com algum filtro ativo, a barra da seleção diz, depois dos números, `· filtered` em `--ink-3` com as partes da frase do filtro no tooltip; **Select cards to discuss** fica tracejado com `· no card to select` quando nenhuma linha está visível, e `Space` não entra no modo nesse caso (não há linha).

**L9. O item desabilitado com ação do seletor não tem teclado nem papel.** `05:278` põe **Clone** "no próprio item" desabilitado, como `components.md:218`. O `Select` do system é um menu de `menuitemradio` (`components/system/Select.tsx`, `Menu.tsx:128–170`), e um botão dentro de um `menuitemradio` não é alcançável por teclado nem válido em ARIA. Hoje o **Clone** é um item de menu à parte (`RepositoryPicker.tsx:82–92`). O `Select` também não tem opção desabilitada com razão, que o campo **Board** pede para o board nunca lido (`05:131`); a §5.3 o dá "como está" (`05:387`). *Decisão:* o item desabilitado com ação fica no percurso das setas com `aria-disabled` e não é escolhível; `Enter` nele aciona a ação; o nome acessível é `acme/billing, not cloned. Enter clones it.`; o menu fica aberto e o item passa a `Cloning…` e depois a utilizável, sem ser escolhido sozinho. `SelectOption` ganha `disabled` com `sub` como razão, e a §5.3 move `Select` para as variantes do step 4.

**L10. Um texto em `--ink-4` perde o contraste na linha aberta.** O título de uma issue fechada fica em `--ink-4` (`05:187`) e não sobe na linha aberta, como o número sobe (`05:186`). Medido nos tokens: `--ink-4` sobre `--brand-tint-plane` com o hover dá 4,59 no claro e **4,10** no escuro; com o pressionado, **4,27** e **3,66**. O comentário de `tokens.css:159–162` exclui `--ink-4` da linha aberta. *Decisão:* na linha aberta, o título da fechada sobe a `--ink-3` (5,07 e 4,57 no pior caso, o pressionado).

**L11. `writtenBy` nas fixtures não está decidido, e a escolha óbvia quebra o pronto 2.** `board.md:285` e `components.md:444` dão o exemplo da linha do contexto de #474 "and the discussion Usage-based pricing tiers", mas `data.js` não dá autora a #474 (a discussão `d1` tem #455 e #461 como entrada). Se as fixtures derem a #474 a autoria de `d1`, ativa, a linha de #474 ganha `In discussion` (`05:190`), e o pronto 2 (`05:20`, `Usage-based billing` e `◇ #461` sob #474) falha. *Decisão:* #474 sem autora nas cenas, e o exemplo com a discussão provado só na função pura (pronto 6); ou uma discussão arquivada `Usage alerts` como autora de #474 (a linha continua sem `In discussion`, e o painel mostra `From the discussion Usage alerts`). Recomendo a segunda: ela põe P22 numa cena.

**L12. A precedência dos estados da leitura não está dita.** A tabela de `05:152–161` não diz o que vence quando dois valem: nunca lida, falhou e lendo de novo (o **Try again** do vazio: esqueleto ou `Reading…` no lugar do botão?); lida sem cards com a última falha (faixa e vazio juntos?). *Decisão:* lendo vence (o esqueleto no nunca lido, como hoje em `BoardView.tsx:130`); faixa e vazio convivem, a faixa no alto.

## 2. Ajustes pequenos

- **Variante dos tracejados.** `05:223` e `05:226` dizem **Start task** "tracejado" em `other_board` e fora da leitura, sem dizer se é a primária tracejada, como em `clone_missing` (`05:221`). *Decisão:* primária tracejada nos três, como o mock em `other_board` (`src/shell.js:162`). O **Try again** do vazio "nunca lida, falhou" (`05:158`) não tem variante: secundária, como na faixa.
- **A razão do **Discuss** tracejado num card fechado de repositório de outro board** seria `The issue is closed.` (`05:228`: "a razão é a do caso"), que não explica o **Discuss**. *Decisão:* o **Discuss** tracejado sempre descreve-se por `<dono/nome> isn't a repository of this board.`
- **`No status` some com o filtro.** `05:179` diz "só com cards sem status"; hoje é contado sobre os cards filtrados (`board-view.ts:130–152`), e a seção some quando o filtro a esvazia, o que faz a lista pular, contra `components.md` (Cabeçalho de seção, "Não esconda uma seção vazia"). *Decisão:* `No status` aparece quando a leitura tem card sem status, com a contagem filtrada.
- **`Enter` em **Name**.** Hoje o formulário confirma com `Enter` no campo (`NewTaskDialog.tsx:212–215`); o material só fala de `Ctrl+Enter` (`05:272`). *Decisão:* `Enter` em **Name** confirma, como hoje.
- **`→` num cabeçalho aberto** (`05:263`) não diz nada. *Decisão:* nada, como a árvore da lateral.
- **O relógio nos textos.** `Last read at 14:08` e `The reading of 14:08` (`05:143`, `05:230`) usam `clockTime`, que dá `Yesterday 17:40` e `Sep 21, 17:40` numa leitura antiga (`lib/when.ts:36–53`): `Last read at Yesterday 17:40`. *Decisão:* `Last read yesterday at 17:40`, `Last read Sep 21 at 17:40`; o mesmo na faixa.
- **Todos os boards nunca lidos.** O campo **Board** fica sem opção utilizável, sem padrão (`05:131`), e com um board só, nunca lido, a Home abre um diálogo que o Go recusa (`The board hasn't been read yet.`). *Decisão:* **New discussion** da Home e do **+ New** tracejado com `The board hasn't been read yet.` quando nenhum board foi lido.
- **`Clone failed` na linha e a falha no painel vêm de fontes diferentes**: a linha, da falha guardada na visão (`05:190`); o painel, de `cloneError` do repositório (`05:220`), que sobrevive à saída da visão. Voltando ao board, o painel diz a falha e a linha não. *Opinião:* os dois leem `cloneError`, e a linha marca o card que pediu enquanto a falha existir.
- **`aria-selected` e `aria-checked` na mesma árvore.** No modo, `05:253` dá `aria-checked`; fora dele, `aria-selected` marca o aberto (`05:294`). A APG pede um dos dois por árvore. *Decisão:* no modo, as linhas perdem `aria-selected` (o painel está fechado).
- **`implementation.md:5` não põe `design/tasks/` na precedência**, e `05:321` (#20) cita essa linha para dizer que vale o material. *Decisão:* citar `implementation.md:18`, ou acrescentar os materiais de task à ordem de `:5`.
- **O épico na segunda linha pode encolher a quase nada.** Na lista de 452 px, a segunda linha tem 308 px; a dependência (até 69 px medidos) e a task curta (até cerca de 200 px) deixam ao épico 7 px no pior caso, só as reticências. *Opinião:* abaixo de `--space-12`, o épico sai da segunda linha (o nome acessível e o painel o têm).
- **A contagem de 14 prontos.** O pedido fala em 13; o material tem 14 (`05:17–32`), e o 14 é o crítico da branch. Está certo como está.

## 3. As 24 decisões e as de produto por delegação

Coerentes com `design/`, com o mock (onde o material o corrige, e o #20 diz) e com o código, com quatro ressalvas já nas lacunas: #1 (a medida, abaixo), #13 (L9 e o board nunca lido), #23 (`05:228`, confere com `AddToBoardDialog.tsx:68–80` e `useStartCard.ts`: hoje o diálogo de criação não abre depois de **Add to board**) e #8 (L8).

Conferido no código: #7 usa o nome da task como o Go (`task_service.go:863`); #11 tem a pilha e `readLastItem` (`store/app-store.ts:419–434`), e o `createdAt` existe em tasks, reviews e discussões (`dto.go:469`, `:1152`, `:1337`); #12 segue `DocumentOfCard`, que já conta ativas e arquivadas (`service.go:637–662`); #13 tem `discussionHistory` com `createdAt` (`dto.go:109`, `:1353`); #15 mantém um valor por grupo, como `FilterMenu` hoje; #22 não colide: `refresh` é o `RefreshCw` de hoje (`BoardHeader.tsx`), e o `retry` da task 4 é outro desenho.

Nenhuma precisava do usuário: nenhuma muda um fluxo inteiro, apaga dado ou desdiz o aprovado. A mais perto da linha é a #13, que troca a escolha automática do **+ New** (lugar, última discussão ativa, primeiro board; `new-discussion-board.ts:11–24`) por um campo, e está coberta por B2 ("fora de um board"). Uma decisão ficou sem registro: a edição de `implementation.md:13`, que deixa a task 5 correr em paralelo com a 4, muda um princípio confirmado pelo usuário em 2026-09-25 e não tem entrada em `decisions.md`. Se foi pedido do usuário, registre; se foi do coordenador, registre como delegação.

Mudanças de comportamento fora de `changes.md`: B10 cobre só o `S` (`changes.md:66`), e o material acrescenta os avisos de `D`, `Space` e `N` (`05:243–245`); **Clone and continue** direto no painel, sem o **Start task** que hoje o oferece (`features.md` §Start task; `StartTaskAction.tsx:78–97`); **Cancel** tracejado durante `Creating…` (`05:290`; hoje fica ativo); `Ctrl+Enter` de qualquer campo (hoje só do contexto, `NewTaskDialog.tsx:217–222`). *Decisão:* B10 passa a "uma tecla de uma letra que não age diz por quê (`S`, `D`, `Space`, `N`)"; B7 ganha "**Clone and continue** direto, sem o passo de **Start task**"; B11 ganha "**Cancel** espera a confirmação terminar". O `Ctrl+Enter` pode ficar sem linha, porque só estende um atalho.

## 4. Os três tokens

Medido em Chromium com Fira Sans e Fira Code de `@fontsource`, nos tokens de `tokens.css`, com a anatomia do `Kbd` do system (`px-1`, borda de 1 px e 2 px embaixo, mono de 12 px, `Kbd.tsx:13`):

| Medida | Resultado | Material |
|---|---|---|
| `S start` + `--space-2` + `D discuss`, `Kbd sm` | **117 px** | 117; `--col-keys` 120 cabe |
| `Space unselect` / `Space select` | 97 / 83 px | cabem em 120 |
| `◇` (`StateGlyph blocked`, 8 px) + `--space-1-5` + `#1291 +1` | **60 px** (64 com a margem do mock, `src/board.css:111`) | `05:302` diz 63; `components.md:883` diz **47**, que é só o texto |
| `#1291 +12`, `#12345 +9` | 66, 69 px | cabem em 72 |
| 64 caracteres em Fira Code de 13 px | **512 px** | 512; o campo de 576 tem 514 |

As três medidas conferem no que importa, e a conta da linha também: a 1041 px de contêiner o título tem 337 px (993 − 16 de folga − 640 das colunas e dos vãos), um terço é 331; na lista de 452 px, 180 px de título e 308 de segunda linha. A 1040 px o limite é `max-width: 1040px`, como o mock (`a.css:5`). Corrija `components.md:883` para "60 px" e `05:302` para o mesmo número.

O que mais muda com eles:
- `--col-keys` é lido hoje por `features/task/DetailsPanel.tsx:437` como teto da coluna das chaves (`minmax(0, var(--col-keys))`): a coluna sobe de 112 a 120 px e o valor perde 8 px, com `wrap-anywhere`; a chave mais longa, `Review mode`, mede 78 px e não corta em nenhum dos dois. Nenhum teste afirma 112.
- `--size-dialog-wide` é lido só pelo `Dialog` do system (`Dialog.tsx:35`), sem usuário em feature, e o teste pintado resolve o token (`Dialog.painted.test.tsx:46`). Nenhum teste afirma 544.
- Nas tasks seguintes: o diálogo de início de review (task 6, `review.md:118`), o de discussão (task 9, `discussion.md:33`) e o de board (task 10, `rest.md:122`) ficam 32 px mais largos, e a linha da PR (task 6) ganha 8 px de teclas. Os mocks de `lab/12`, `lab/13` e `lab/14` pintam os valores antigos. Vale uma linha nos materiais dessas tasks; não é problema desta.

## 5. A §6 e a ordem de merge

A ordem está certa (a 4 primeiro; a que terminar antes entra antes; rebase, `task generate`, `task check`, e só então o crítico). O `Esc` da visão funciona sem editar `useGlobalShortcuts.ts`, porque o handler global escuta na bolha e respeita `defaultPrevented` (`useGlobalShortcuts.ts:96–129`). `Markdown.tsx` já aceita `className` (`:26`, `:43–46`). Faltam as linhas de L4. O resto da tabela confere arquivo por arquivo.

## 6. P22 e P23

**P22 está bem dimensionado.** `DocumentOfCard` já faz a seleção (`service.go:637–662`: a mais recente vence, empate pela mais nova, ativas e arquivadas; a publicação em curso conta porque `wrote` olha `Outcome`, `:684`, e `At` só fecha no fim, `discussion.go:184`). Extraí-la numa função e expor o mapa sob o lock, sem ler arquivo, é pequeno; `FromBoards` já recebe `cardTasks` do mesmo jeito (`convert.go:830–836`, `state.go:71–74`).

**P23 no frontend está certo**, com um segundo desencontro além do que `05:329` aceita: `board.Context` só põe a seção `Discussion` quando o documento não está vazio (`context.go:28–30`), e uma discussão pode publicar sem ter escrito o documento. A linha citaria a discussão e o texto não. Para as ativas, `DiscussionSummary.hasDocument` já diz (`dto.go`, `DiscussionSummary`); para as arquivadas, nada. *Decisão:* `WritingDiscussion` ganha `hasDocument`, que o serviço já sabe sem ler arquivo pelas ativas e grava ao arquivar; ou o material aceita os dois desencontros por escrito. Recomendo aceitar: é raro, e a contagem de caracteres mostra o tamanho real.

## 7. O inventário, por amostragem

Confere: as linhas e os tamanhos dos 18 arquivos de `features/home`, `features/board` e `features/task-create` (`wc -l` bate com cada um); os 7, 4 e 1 arquivos de teste; `board-view.ts` (a busca em 83–92, `sections` em 130–152); `NewDiscussionRef` (`app-store.ts:119–123`), `newTaskCard` e `pendingStart` (185–188), `openNewDiscussion` (820), `readLastItem` (431–434), os usos de `resolveHome` (527, 551, 574, 649) e os testes (`locations.test.ts:212`, `app-store.test.ts:1985`, `:2395`); `SearchInput.tsx:41`; `Checkbox.tsx:53–67`; `new-discussion-board.ts:11–24`; `CardContextPreview.tsx:31–44`; `board_service.go:139–151`; `context.go:26–35` e `cardSections`; `react-resizable-panels` só em `BoardView.tsx`; `FilterMenu` também em `features/reviews/ReviewsFilterBar.tsx`. As linhas de `decisions.md` (5–7, 37–39, 53–55) e de `implementation.md` (5, 7, 15, 18, 20, 21, 22, 94, 101) conferem.

## 8. O plano de 10 steps

Deixa `task check` verde e o app usável em cada step, e nenhuma ação fica sem lugar: cada step que remove um controle (6: cabeçalho, filtros, seleção; 7: ações; 8: seletor, contexto) traz o substituto no mesmo commit, e as duas transições da §6 ficam dentro da branch. Três ajustes:
- o step 3 não deve tocar `DetailsPanel.test.tsx` (L4);
- o step 4 precisa da opção desabilitada com razão do `Select` (L9), que o campo **Board** do step 5 usa;
- o step 8 leva a linha de Go de L5.

*Opinião:* o step 6 é o maior do plano (cabeçalho, faixa, estados, barra com a memória nova, seções, linha nas duas larguras, modo de seleção, teclado, avisos, `N`, piscada, casca do painel). Ele pode virar dois sem meio-caminho: 6a troca o cabeçalho, a faixa, os estados e a barra de filtros sobre a lista de hoje; 6b troca a lista, a linha, o modo e o teclado. O plano fica em 11, dentro de G.

## 9. Os prontos e as larguras das cenas

Os 14 são verificáveis, com L1, L2 e L11 corrigidos (senão o 1, o 2 e o 6 falham contra o mock). As larguras das cenas fazem sentido contra `structure.md` §6: 2180 é a área de 2560 com a lateral no teto de 380; 978, a de 1280 (a metade), com 302; 950, a de 1250, com 300; 812, a de 1100, com 288. A regra de 800 px põe o painel ao lado em todas (a 812, a lista tem 452) e a lista com o painel em duas linhas até cerca de 2044 px de janela, o "cerca de 2050" de `05:195`. Falta só a ponta larga: a 2600 px a área é 2220, e a lista já está no teto de 1120 px a partir de 1168 de contêiner, então nada muda de 2180 para 2220. O pronto 1 manda servir o mock na porta 8090, que é a do coordenador: o implementador deve usar uma porta livre acima dela.

## 10. As edições em `design/`

Coerentes entre si, salvo:
- `components.md:883` (47 px) contra `05:302` (63 px) e a medida (60 px) (§4);
- `board.md` não acompanhou quatro decisões que `components.md` e o material já têm: o chip órfão também de status (`board.md:119`), as PRs como `#1291` com o repositório só quando é outro (`board.md:185`), o `From the discussion` da autora arquivada (`board.md:177`) e o `D` no card fechado (`board.md:201`, "Só **Discuss**");
- `structure.md:25` ainda diz "o último item ativo aberto", e `board.md:48` já dá a regra da pilha; basta "o item ativo mais recente que ainda existe (`screens/board.md` §2.2)";
- `implementation.md:13` sem entrada em `decisions.md` (§3).
