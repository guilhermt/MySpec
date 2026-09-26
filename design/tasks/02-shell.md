# Task 2 · Fundação II: shell, árvore, navegação com histórico, painéis e barra do pedido

Material de entrada da segunda task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 2 de `design/implementation.md` (§2, linhas 55–65), com os princípios da §1 (linhas 9–22) e os riscos da §3 (linhas 185–197). Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa.

**Base.** A task depende da task 1b (`design/tasks/01b-foundation-fixes.md`) mergeada e parte do `main` depois dela. A 1b muda os wrappers que o shell usa: `Tooltip` (abre só no foco visível de teclado), `Button` (`loadingLabel` obrigatório com `loading`), `Chip` (tamanhos `md` e `sm`, sem `xs`), `Menu` (grupos com nome), `Select`, `Checkbox` e `Listbox` (o visto por `ICONS.done`), `TimeChip` (o tempo por extenso no texto oculto, o curto `aria-hidden`), `Link` (`href` obrigatório), `Dialog` (foco inicial) e `Icon`. As linhas de `components/system/` são lidas nessa base; as do resto do código, na `main` em `a45e08b`, que a 1b não toca.

Toda decisão de design está tomada neste documento, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; não há pergunta de design para ele.

**Vocabulário.** "Lugar" é o que a área principal mostra (a Home, um board, uma task…); no código é `Location`, porque `Place` já é o DTO de onde está uma situação (`internal/bindings/dto.go:324–330`, reexportado em `lib/wails.ts`, usado em `app-store.ts:319–335` e `lib/situations.ts:121`). "Lugar da situação" é esse `Place`.

## 1. Objetivo e critério de pronto

A lateral vira a árvore de `structure.md` §2: Reviews, os boards, os épicos e No board, com a linha de três linhas, os glifos de tipo e de estado, os dois relógios, o `Ctrl J` na linha, os nós recolhidos com resumo e a faixa de 60 px; a seção **Waiting for you** sai. A área principal passa a mostrar um lugar por vez, com uma pilha de histórico lembrada entre execuções, `←`/`→`, breadcrumb, painéis auxiliares pela regra coluna-ou-cobertura e a página do item que saiu, com as telas atuais dentro. O backend passa a expor a ação em curso e o início do turno de cada sessão (P1), e o shell ganha a barra do pedido, o aviso do app com o rótulo da ação e a região de toasts, que é a única região ao vivo do app.

**Pronto quando** (`implementation.md:65`), cada item provado como diz:

1. **Árvore.** Um teste de componente por linha das duas tabelas de `structure.md` §2 (A linha 2 com situação, A linha sem situação) e por estado da linha (aberta, com a marca `Ctrl J`, erro com trilho, aviso de clone), achando o item por `getByRole("treeitem", { name })` com o nome acessível inteiro.
2. **Lógica pura.** `features/sidebar/sidebar-tree.ts` testado sem renderizar, em tabela: a gravidade, a ordem do `Ctrl+J` (também com o filtro por repositório), as formas longa e curta da linha 2 contra as tabelas de `structure.md` §2, a linha 3 e o resumo dos nós.
3. **P1.** Testes em `internal/session` (o turno começa, uma ação começa e termina, duas ações no turno, turno sem ação, interrupção), o teste de `convert.go` com `turnStartedAt`, `actionLabel` e `actionTarget` nos cinco blocos de sessão, e um teste da linha 3 de um item fechado com a ação vinda do DTO.
4. **Navegação.** Testes de store da pilha (empilhar, substituir, limpar a frente, pular o que sumiu, persistir e reabrir); `←` e `→` com o destino no tooltip; `Alt+←`, `Alt+→`, `Ctrl+J`, `Ctrl+,` e `Ctrl+N` inertes com qualquer diálogo modal aberto, e a notificação clicada com um modal aberto só trazendo a janela; Settings fechando para o lugar anterior por `Esc`, **Close**, `Ctrl+,` e `←`; o foco depois de cada tipo de ida (§4.2).
5. **Painéis.** O componente testado com dois painéis (um de cada vez), `Esc` devolvendo o foco ao botão, e o painel de artefatos que não abre sozinho; `styles/globals.test.tsx` prova a largura arredondada e o limite de 1120 px.
6. **Barra do pedido.** As cinco formas (quieta, tingida, de decisão, erro, encerramento) e as duas da outra conversa (espera, falhou) renderizadas, com a região `Request` e o `role="status"`.
7. **Página do item que saiu.** Os sete casos da §4.2 com o título, as ações e o foco; o toast só para a task que saiu sem estar aberta, parado enquanto tem o ponteiro ou o foco.
8. **X16 e F19.** Nenhuma chamada de `run()` sem rótulo, provado pelo tipo; o aviso testado com o rótulo e o detalhe, e nas boas-vindas.
9. **Situação nova.** A piscada de duas vezes `--duration-slow` na linha, no bloco da faixa e no resumo do nó, e nenhuma com `prefers-reduced-motion` (teste de CSS); o anúncio de uma situação nova e do `Ctrl+J` sem destino, numa única região ao vivo, sem regiões aninhadas.
10. **Faixa recolhida.** Percorrida pelo teclado, com o nome de cada bloco igual ao da linha.
11. **Larguras.** Capturas a 1100, 1250, 1435, 1920 e 2560 px, lateral aberta e recolhida, claro e escuro, na task, num review, no board e em Settings: nenhuma rolagem horizontal, nenhum texto cortado sem tooltip, nenhuma sobreposição, nenhuma caixa em meio pixel, conferida nas capturas ampliadas, como a task 12 prevê (`implementation.md:190`); e os testes de arredondamento de `styles/globals.test.tsx` (pronto 5).
12. `task check` verde em todo step.
13. **Documentação** da §7 escrita, no step de cada área.
14. **Revisão do `design-critic`** na branch contra este material, `structure.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).

`changes.md`: S1, S2, S3, S4, S5, S6, S7 (a forma genérica), S8 (o componente), S9 (o mecanismo), X16. `backend.md`: P1, P2; F1, F2, F19.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 2 (55–65), riscos (190, 194, 196) | O escopo, a regra do app sempre usável (15), a revisão do crítico (21), os testes que migram com a tela (22), o meio pixel (190), o refactor da navegação (194), a pilha que começa vazia (196) |
| 2 | `design/decisions.md`: modelo do shell (69–71), meta da linha (49–51), desvios absorvidos (53–55), tempo e contexto de longe (77–79), largura contínua (81–83), papéis do azul (45–47) | O que o usuário aprovou e não se reabre |
| 3 | `design/structure.md` §1 (7–38), §2 (40–199), §3 barra do pedido (246–292) e painéis (303–331), §5 (343–382), §6 (383–399), §7 (400–424) | O modelo de lugares, a árvore inteira, com as duas tabelas da linha 2 (96–157), a barra, os painéis, os atalhos, as larguras e os estados |
| 4 | `design/principles.md` 1, 2, 4, 5, 8, 9, 10 | Cor é sinal; o azul na linha aberta e no `Ctrl J`; negrito no nome que espera; glifo, cor e rótulo; 280 ms duas vezes; foco por fora, seleção por dentro; pixel inteiro |
| 5 | `design/system/components.md`: estados comuns (18–27), Glifo (54–66), Ícones (77–87), Barra de rolagem (88–97), Tooltip (98–108), Tecla (109–119), Troca de lugar (140–147), Chip de tempo (178–188), Select (202–215, o gatilho da lateral), o grupo **Shell** (288–437, sem a Idade da leitura, 301–308, que é da task 5), Barra do pedido (466–480), Atividade (521), Medidor (591–600), Resultado do encerramento (780) | A anatomia, os estados, os tokens, o teclado e a acessibilidade de cada peça. Onde diverge de `structure.md`, vale `components.md` (`implementation.md:5`) |
| 6 | `design/system/tokens.css`: medidas (53–57), árvore (85–87), layout (89–93), movimento (117–122), camadas (124–125) | `--sidebar-width` já arredondada (91); `--panel-width` sem `round()` (93), que esta task arredonda |
| 7 | `design/changes.md` S1–S9 (11–19), X16 (127) | O que muda de comportamento e a seção de `features.md` de cada linha |
| 8 | `design/backend.md` P1 (27), P2 (28), F1 (98), F2 (99), F19 (116) | Os dados, e a §5.3 deste material, que diz o que já existe |
| 9 | `design/screens/task.md` §3 (34–56, a cedência do cabeçalho), §7 (168–208); `screens/rest.md` §8 (418–436), §9 (437–456), §13 (610–632); `screens/review.md:291`; `screens/board.md` §2 (32) e a linha 240 | O que o documento de tela detalha sobre o shell |
| 10 | Mocks, servidos com `python3 -m http.server 8090 -d design/lab`: `08-visual-final/index.html` (a árvore: `ariaFor`, `itemRow`, `nodeRow`, `sidebar`, 983–1050; o gatilho do filtro, 472; a piscada, 438–439 e 533–547) e `specimen.html` (a linha em todos os estados, 1576; o nó, 1585–1590); `10-screen-task-minimal/b.html` (os itens da árvore, 1505–1530 e 2140–2185; a árvore, 1529–1595; o indicador, 1798–1804); `12-screen-review/components.html` (a página do item que saiu); `14-screen-rest/components.html` (o aviso do app e o toast); `03-structure-final/a.html` só no comportamento: `go`/`back`/`fwd` (1100–1108), `nodeSummary` (1152–1161), `widths` (1282–1289), `goneView` (1326) | A referência visual. O 03 é wireframe: a forma vem do 08, do 10-b e de `components.md`; a faixa recolhida não tem mock e vale `components.md` (Faixa recolhida da lateral) |
| 11 | `docs/guidelines/README.md`, `frontend.md`, `testing.md`; `docs/architecture/design-system.md` §Componentes | Como um step acontece, onde mora um componente, o teste por nome acessível e a suíte de estilo computado da 1b |
| 12 | O código da §5 deste documento | O inventário do que muda |

## 3. Escopo

**Dentro**, cada item verificável:

1. **P1 no backend.** Cada bloco de sessão dos DTOs ganha o início do turno em curso e a ação em curso (rótulo e alvo), preenchidos em `session.Summary`; o estado sai também quando uma ação começa e termina (§4.4).
2. **P2 e F2 no frontend.** Uma função pura lista as sessões de um item com o papel (`Implementer`, `Reviewer`, a etapa, a PR, o review, a discussão), o status e se trabalha, lida dos blocos que já existem (§5.3).
3. **O lugar no store.** `Location` e a pilha no lugar de `openTaskId`, `openReviewId`, `openDiscussionId`, `openArchivedId`, `openArchivedReviewId`, `openArchivedDiscussionId`, `openBoardId`, `reviewsOpen`, `historyOpen`, `settingsOpen`; os seletores atuais derivados do lugar; a pilha, o lugar de volta e o último item ativo persistidos (F1).
4. **Navegação.** `←`/`→` no cabeçalho, `Alt+←`/`Alt+→`, o breadcrumb que dobra, Settings que fecha para o lugar anterior, o foco de cada ida.
5. **`features/sidebar` inteiro.** Topo com a marca, **+ New ▾** e `«`; o filtro com o gatilho da lateral; a árvore com Reviews dentro dela, os boards, os épicos, No board, o aviso de clone como `treeitem`, a linha de três linhas, o meta em hover, foco e linha aberta, a marca `Ctrl J`; o teclado; os nós recolhidos com o resumo; o indicador `↓ N more below`; o rodapé; a faixa recolhida.
6. **S1.** `features/attention/WaitingSection.tsx` e o teste saem.
7. **Situação nova.** `Ctrl+J` pela gravidade e pela idade, sobre o filtro; a chegada por `situation:open` como uma ida; a piscada de 280 ms duas vezes no véu da gravidade; a região ao vivo.
8. **`components/system/`, família Shell**: cabeçalho de lugar, painel auxiliar e grupo de painéis, barra do pedido, página do item que saiu, aviso do app, toast e a região `.toasts`, e os ícones de tipo; a variante do gatilho da lateral no `Select`.
9. **O cabeçalho de lugar em todos os lugares**, com o que resta do cabeçalho antigo à direita (§4.3, decisão 1).
10. **Os três painéis de item que existem** (`Artifacts` da task, `Reports` do review, `Documents` da discussão) saem do `react-resizable-panels` para o painel auxiliar, com o conteúdo atual; o painel de artefatos deixa de abrir sozinho (S9).
11. **A página do item que saiu** nos sete casos da §4.2, na forma genérica.
12. **O aviso do app** no lugar de `ErrorNotice`, com o rótulo da ação e o que fazer (X16, F19), também nas boas-vindas.
13. **O toast de arquivamento de task** na região `.toasts`, só para a task que saiu sem estar aberta.
14. **Documentação** da §7.

**Fora**, e o que continua com a forma antiga dentro do shell novo:

- O conteúdo de todo lugar: a Home (task 5), a visão do board com o painel do card, que continua em `react-resizable-panels` (task 5), Reviews (6), History e os arquivados (11), Settings (10), a tela da task abaixo do cabeçalho (3 e 4), a tela do review e a da discussão (6 e 9). Cada uma entra no lugar novo como está, retematizada.
- A **Idade da leitura** (task 5).
- A barra do pedido **ligada às situações** e o foco nela (task 4): aqui ela é o componente, testado isolado. `StepBar`, `PRBar`, `ReviewBar`, `DiscussionBar`, `ReviewStrip` continuam.
- O conteúdo da página do item que saiu por tipo (o texto, o resultado do encerramento, as passadas, as rodadas, o que ficou no disco): tasks 6, 9 e 11 (P27, P29). O destaque da linha no History ao chegar dela (task 11).
- Os textos das notificações (task 11), o toast de review e de discussão (F20, task 11), `LeftoversNotice` (sai na task 11; até lá, no lugar do aviso do app).
- O campo **Board** do diálogo de discussão aberto de fora de um board (B2, task 5).
- `Starting MySpec…` e a lateral em esqueleto no início (X17), as boas-vindas com **New** e **History** tracejados (task 10).
- A contagem dos checks (P13, task 3), a rodada da discussão (P25, task 9), `Ready to archive` e as situações do épico (P26, task 8), o progresso de decisão dos apontamentos da PR da task (M1, task 7): até lá a linha usa as formas provisórias da §4.2.
- Remover `attention-flash-ring`, os keyframes antigos e `react-resizable-panels` do `package.json` (task 12): `StepTabs` continua com a piscada antiga até a task 3.
- `AgentTabs`, o stepper, o `⋯`, `Ctrl+E` (task 3).

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| Um lugar por vez; abrir um item é ir a um lugar; não há camadas nem modais de lugar | `structure.md:9–19`; `decisions.md:71` |
| Toda ida entra na pilha; ir a um lugar novo limpa o que estava à frente; pilha e último item aberto lembrados entre execuções | `structure.md:21`; F1 |
| Settings e History são lugares; fechar Settings volta ao anterior, nunca à Home | `structure.md:23` |
| A árvore nunca reordena sozinha; ordem de criação; Reviews primeiro, boards em ordem alfabética, No board por último e só com algo | `structure.md:53` |
| A linha: as três linhas, a linha 2 com situação e sem situação, o texto longo e o curto, a gravidade de cada estado, quem trabalha e o nome acessível | `structure.md:59–157` |
| Gravidade: erro > espera > encerramento; sem situação: agente (e o app) > GitHub > pausado > ocioso. A cor de atenção vem só das situações | `structure.md:159–164` |
| `Ctrl+J` e a marca: o mais grave, depois a espera mais antiga, fora o aberto; ignoram o filtro, e abrir um item escondido volta o filtro a **All repositories** | `structure.md:164` |
| Os dois relógios; um spinner só, no início da linha 2 | `structure.md:91`; `decisions.md:55` |
| Meta só em hover, foco e linha aberta, só quando cabe ao lado do nome inteiro | `decisions.md:51`; `components.md` Linha da árvore |
| A forma curta entra quando a longa não cabe; a do caminho e a do comando; abaixo de 330 px de lateral, o meta sai e o medidor fica só com a porcentagem | `structure.md:390`; `components.md` Linha da árvore |
| Nó: a seta de ir em hover e foco; o chevron recolhe, o título abre; o resumo recolhido; Reviews com `◇ Read failed` | `components.md` Nó da árvore |
| A faixa recolhida, inteira: topo, blocos, separadores, rodapé, estados, teclado | `components.md` Faixa recolhida da lateral |
| O filtro com o gatilho da lateral; a árvore `Active items` na lateral `Work` | `components.md` Select (Gatilho da lateral), Linha da árvore |
| O foco depois de cada ida | `components.md` Troca de lugar |
| Painéis: fechados por padrão, um por vez, `Esc`; coluna a partir de 1120 px de área principal; o ícone de documento; a entrada e a saída; não modal | `structure.md:303–331`; `components.md` Painel auxiliar |
| Barra do pedido: as formas, a outra conversa que espera e a que falhou, `role="region"` `Request` com o `role="status"` | `components.md` Barra do pedido |
| Página do item que saiu: anatomia, ações, o tooltip `Next: <nome> · Ctrl+J`, o foco | `components.md` Página do item que saiu; `rest.md:437–456` |
| Aviso do app e toast: a forma, o detalhe `<mensagem>. <o que fazer>`, a região `.toasts` como a única região ao vivo dos toasts e dos anúncios, sem tirar o papel próprio dos outros componentes, o toast parado com ponteiro ou foco | `components.md` Aviso do app e toast |
| Piscada: 280 ms, duas vezes, no véu da gravidade; nenhuma com `prefers-reduced-motion`; continuações não piscam | `principles.md` 8; `structure.md:166–176` |
| O seletor de tema com ícone fixo, o estado no nome e no tooltip | `components.md` Seletor de tema |
| Troca de lugar imediata; a linha do lugar trazida à vista na mesma troca | `components.md` Troca de lugar |

### 4.2 Decisões de design, detalhadas

**A linha.** O conteúdo de cada estado está nas duas tabelas de `structure.md` §2 (96–157), e a anatomia em `components.md` (Linha da árvore). O que esta task acrescenta:

- **Formas provisórias**, até a task que traz o dado:

  | Dado ausente | Até | A linha diz |
  |---|---|---|
  | A contagem dos checks (P13) | task 3 | `PR review · waiting for checks` / `PR review · checks`; no review, `Pass K · waiting for checks` / `Pass K · checks` |
  | O progresso dos apontamentos da PR da task (M1) | task 7 | `Decide findings · PR review · pass K` / `Decide findings · PR review` |
  | As situações do épico e `Ready to archive` (P26) | task 8 | A discussão `published` mostra o glifo de encerramento sem chip e `Ready to archive`, sem borda direita; fica fora do `Ctrl+J`, do resumo dos nós e da piscada, porque não é situação. Não há linha de épico |
  | A rodada (P25) | task 9 | A posição da discussão é `Discussing` e, com rascunhos, o estado: `Decide drafts · a of b` / `Decide drafts · a/b`, `Publishing`, `Publish failed`; as situações de conversa dizem `· Discussing` |

- **O relógio do agente** usa o formato do chip (`now`, `5m`, `2h`) e o tooltip em minutos por extenso (`Agent working on this turn for 3 minutes`, com `spokenWait`, `lib/situations.ts:352`). Tudo lê `useNow` a cada 60 s.
- **O nome acessível** segue `structure.md:93`, na ordem do mock (`08/index.html:983–991`): `<tipo> <nome>. <tom>: <texto da situação>, for <tempo>; … . <posição>. <Quem> working for <tempo>: <verbo> <alvo>. context <N>% used. <meta>.` e, na linha da marca, `Ctrl+J opens this next.` O texto de cada situação é o que a linha mostra, na forma longa (`structure.md` §2, A linha 2 com situação). O tipo é `task`, `One-Shot task`, `pull request review`, `discussion`; o tom é `error`, `waiting for you`, `ready to close`, `agent working`, `working` (o app), `waiting on GitHub`, `paused`, `idle`.
- **Aviso de clone** (`structure.md:56`; mock `noticeRow`): `treeitem` no topo do nó do repositório, com `◇` (`StateGlyph blocked`), `<repo> · clone missing`, `Change path ↵` à direita, nome `<owner/name>: the clone at <path> is missing. Enter to change the path.`; `Enter` e o clique chamam `changeRepositoryPath`, e a recusa aparece sob o item, como hoje.
- **Os nós.** Board: `reading…` com brilho durante `board.reading`, ou `◇ Read failed` com `board.failure.message` no tooltip; vazio, `No active items.` Reviews: `N pending` (`reviewCenter.pendingCount`), `reading…` durante `reviewCenter.reading`, `◇ Read failed` com os repositórios de `reviewCenter.failures` no tooltip, e `No review in progress.` sem review ativo. Épico e No board só alternam. O nó do lugar aberto tem `aria-current="page"` e o véu da linha aberta.

**O teclado da árvore** (`structure.md:57`). Uma parada de Tab, na linha aberta ou na primeira. ↑↓ movem **o foco** pelo que está visível, nós e avisos incluídos, sem abrir nada; `Home`/`End` vão às pontas; → expande um nó recolhido ou entra no primeiro filho; ← recolhe ou sobe ao pai; `Enter` abre (o item, a visão do board, Reviews); num épico e em No board, alterna; no aviso, **Change path**. O foco numa linha mostra o tooltip do nome. É uma mudança de comportamento que `changes.md` não lista, decidida por `structure.md:57`: hoje a seta abre o item (`useTaskListKeyboard.ts`), e `features.md:285` é reescrito.

**O topo e o filtro.** A marca e `MySpec`; **+ New ▾** abre um menu com **New task** `Ctrl N`, **Review a pull request** (vai ao lugar Reviews) e **New discussion**; `«`. O filtro: **All repositories** e os repositórios em ordem alfabética, com `· clone missing` (`repository.missing`) e `· not cloned` (`!repository.cloned`). O que ele esconde não muda (`sidebar-tree.ts:84–87`): com um repositório escolhido, a árvore mostra Reviews, o nó do board do repositório (com as discussões dele) ou No board, e só as tasks e os avisos desse repositório; sem tasks, `No tasks in <nome curto>.`

**O rodapé.** **History** com a contagem de arquivados (tasks, reviews e discussões; tooltip `44 archived: 22 tasks, 12 reviews, 10 discussions`; sem contagem quando zero); o tema em ciclo System → Light → Dark, `aria-label` e tooltip `Theme: System · click to change`, aplicado na hora por `setTheme`; **Settings** com o tooltip `Settings · Ctrl+,`. **History** fica pressionado com History ou um arquivado aberto, **Settings** com Settings.

**O lugar e a pilha** (`structure.md:9–23`; `03/a.html:1100–1108`).

- Lugares: Home, board (id), Reviews, History, Settings (página), task (id), review (id), discussão (id), task arquivada (id), review arquivado (id), discussão arquivada (id), e a página do item que saiu (tipo, id, destino).
- Toda ida empilha o lugar anterior e limpa a frente. Ir ao lugar em que já se está não empilha. Trocar de página dentro de Settings não empilha. A página do item que saiu **substitui** o lugar do item.
- `←`/`→` pulam o que não existe mais, e a página do item que saiu não é revisitada: sair dela a tira da pilha.
- Uma navegação fecha o painel aberto, e voltar não o reabre.
- A aba do step (`openStepTab`) não é lugar: continua como hoje, e a chegada a uma situação do revisor escolhe a aba dele (`app-store.ts:318–335`).
- O app abre na Home, com a pilha lembrada atrás dela. **A Home sem nenhuma task ativa e com ao menos um board é o lugar do primeiro board**, como hoje (`features/home/Home.tsx`): o lugar se resolve para `board` sem empilhar, e nunca há um cabeçalho `Home` sobre o do board. O último item ativo aberto é guardado para o **Continue** da task 5. A primeira execução depois desta task começa com a pilha vazia (`implementation.md:196`).
- A navegação que sai de uma edição de prompt não salva continua pedindo `Discard your changes?` (`app-store.ts:476–484`), `←`/`→` incluídos.
- Os atalhos globais (`Alt+←`, `Alt+→`, `Ctrl+J`, `Ctrl+,`, `Ctrl+N`) ficam inertes com **qualquer** diálogo modal aberto. A notificação clicada com um modal aberto traz a janela à frente e não navega, como o `Ctrl+J`.

**`←`, `→` e o breadcrumb** (`components.md` Cabeçalho do lugar; `task.md:34–56`). `←` fantasma de ícone, tooltip `Back to <título do destino> · Alt+←`; sem destino, desabilitado com a razão `Nothing to go back to`. `→` só existe com destino, tooltip `Forward to <título> · Alt+→`. O breadcrumb em 13 px `--ink-3`, `/` em `--line-deco` com `aria-hidden`, `nav` com `aria-label="Breadcrumb"`: task e discussão, `<board> / <épico> /` ou `No board /`; review, `Reviews /`; arquivados, `History /`; board, Reviews, History, Settings e Home, nenhum. O board, Reviews e History são links para o lugar; o épico é texto, porque não é lugar (o mock o desenha como link, `10-b.html:2304`; vale este material). Abaixo de 1660 px de área principal, os níveis dobram num botão `…`, `aria-label="Show the hidden levels: <níveis>"`, com os níveis num menu. `Alt+←`/`Alt+→` valem com o foco num campo de texto também.

**O foco depois de uma ida** (`components.md` Troca de lugar): `Enter` e o clique na árvore deixam o foco na linha; `Alt+←`/`Alt+→` e os níveis do breadcrumb levam ao título do lugar (`h1` com `tabindex="-1"`); o clique em `←`/`→` deixa no botão; `Ctrl+J` e a notificação levam ao título até a task 4, que os leva ao cartão ou à barra; a página do item que saiu recebe o foco em **Next that needs you** (ou **Open in History**).

**Settings.** Abre por **Settings**, `Ctrl+,` e os links que já o abrem; fecha por `Esc` (quando nada mais está aberto, na ordem de `structure.md` §5), **Close** `Esc` no cabeçalho, `Ctrl+,` e `←`, sempre para o lugar anterior; sem anterior, para a Home.

**`Ctrl+J` e a chegada por notificação** (`structure.md:31–37, 164`). O mesmo caminho: a ida ao lugar da situação mais grave e mais antiga do item (a aba `Reviewer` numa situação do revisor), empilhada; se o filtro esconde o item, o filtro volta a **All repositories**; os nós que o escondem se abrem e a linha rola à vista (`block: "nearest"`). A janela à frente é do Go (`internal/app/notifications.go:175–187`). Sem nada esperando, `Ctrl+J` não navega e a região ao vivo diz `Nothing else needs you now.` Uma notificação de um item que sumiu não navega, como hoje.

**A piscada** (`principles.md` 8; `08/index.html:438–439, 533–547`). Ao `situation:started` com a janela em foco, duas vezes `--duration-slow` com `--ease-standard`, do véu para transparente: `--state-error-veil` no erro, `--state-wait-veil` na espera e no encerramento (não há véu de encerramento em `tokens.css`; é o padrão do mock, `08/index.html:533`). Pisca a linha, o bloco da faixa e o resumo do nó recolhido que a esconde; a linha do item aberto não pisca. Com `prefers-reduced-motion`, nada pisca e nenhum véu fica parado (a regra antiga que fixa a cor, `styles/globals.css:335–342`, não vale para a nova).

**A região ao vivo.** A região `.toasts`, embaixo à esquerda da área principal, é a única região ao vivo dos toasts e dos anúncios; os componentes com papel próprio (a faixa de aviso, o esqueleto, a barra do pedido…) o mantêm, fora dela (`components.md` Aviso do app e toast). Anuncia, num texto visualmente oculto: cada `situation:started`, uma vez, como `<nome do item>: <rótulo inteiro de situationLabel, com a primeira letra minúscula> in <lugar>` (`Rate limit per API key: question in Reviewer`, `Retry failed billing webhooks: waiting for reply in PRD`), como a notificação diz, e sem ` in <lugar>` quando o item não tem lugar (review, discussão); o `Ctrl+J` sem destino; e o título da página do item que saiu quando ela aparece sem ação do usuário. Continuações não chegam como `situation:started` (`internal/attention/service.go:214–260`). A task 4 tira do anúncio a situação do lugar na tela, que a barra anuncia.

**O painel auxiliar.** A anatomia, a regra em 1120 px, a animação e o foco estão em `components.md` (Painel auxiliar). Nesta task: `Artifacts`, `Reports` e `Documents`, com o conteúdo de hoje, os tooltips `PRD, tech spec, steps and reports`, `Reports of every pass`, `The document and the context`; somem os tamanhos de `useDefaultLayout` e o arraste. A medida da conversa (960 px) é maior que os 760 da regra: com o painel em coluna, a conversa ocupa a área que sobra menos `--space-6` de cada lado (`task.md:28`).

**A barra do pedido.** A forma está em `components.md` (Barra do pedido). Nenhuma tela a usa nesta task; o teste renderiza as sete formas com os textos de `task.md` §7.

**A página do item que saiu** (`rest.md:437–456`; `components.md` Página do item que saiu). No lugar do item, na medida `--measure-read`: ícone neutro, título em `--text-title`, e as ações; o texto e o resultado afundado ficam para as tasks 6, 9 e 11. O cabeçalho tem `←` e o nome do item.

| Caso | Como se sabe (F2) | Ícone | Título | Ações |
|---|---|---|---|---|
| Task encerrada | some de `tasks` e está em `history` | `archive` | `<nome> was closed and archived` | **Next that needs you**, **Open in History**, **Back to <board>** (sem board, **Back to Home**) |
| Task apagada | some de `tasks` e não está em `history` | `trash` | `<nome> was deleted` | **Next that needs you**, **Back to <board>** (ou **Back to Home**) |
| Review mergeado | some de `reviews`, e em `reviewHistory` como `merged` | `merge` | `<repo>#<N> was merged, and its review ended` | **Next that needs you**, **Open in History**, **Back to Reviews** |
| Review fechado | idem, `closed` | `merge` | `<repo>#<N> was closed without a merge` (`review.md:291`) | as mesmas |
| Discussão arquivada | some de `discussions` e está em `discussionHistory` | `archive` | `<título> was archived` | **Next that needs you**, **Open in History**, **Open <board>** (board removido, **Back to Home**) |
| Discussão apagada | some e não está no histórico | `trash` | `<título> was deleted` | **Next that needs you**, **Open <board>** (ou **Back to Home**) |
| Board removido com a visão aberta | some de `boards` | `board` | `This board was removed.` | **Back to <título do lugar anterior>** (`board.md:240`) |

**Open in History** abre o arquivado, como o toast de hoje (`ArchivedNotice.tsx`), até a task 11. Onde `task.md:330` e `components.md` dizem `This task was deleted.`, vale `rest.md` §9, o documento da página.

**O aviso do app** (X16). Substitui `ErrorNotice` (`features/notice/Notice.tsx:47–53`) no topo da área principal, sobre o cabeçalho; nas boas-vindas, no topo da coluna delas, com a mesma forma, até a task 10. O rótulo é a ação que falhou, com o item (`Couldn't pause Rate limit per API key`, `Couldn't refresh the board Platform Roadmap`); o detalhe é `<mensagem do erro>. <o que fazer>` quando a ação tem saída conhecida (`Try again.`, `Check that gh is signed in.`, `Change the path of the clone in Settings.`), e só a mensagem quando não tem; **Dismiss**. Nesta task, as 62 chamadas de `run()` vão ao aviso; levar cada falha ao lugar próprio dela é das tasks de tela. `LeftoversNotice` ocupa o mesmo lugar, na forma que tem, até a task 11.

**O toast.** Nesta task, só o arquivamento de uma task que não estava aberta: o ícone `archive`, `"<nome>" was archived`, **Open in History** sob o texto, `×`; 10 s contados sem ponteiro nem foco; até três. A task aberta que é arquivada não gera toast: a página diz o mesmo.

### 4.3 Decididas neste material, onde `design/` não decide

| # | Lacuna | Decisão | Razão |
|---|---|---|---|
| 1 | Como o cabeçalho de lugar convive com os cabeçalhos antigos até as tasks 3, 5, 6, 9, 10 e 11 | Todo lugar renderiza o cabeçalho de lugar: `←`, `→`, o breadcrumb e o título. Do cabeçalho antigo **saem** o ícone de tipo ou de pasta, as referências (`#N`, o badge do repositório, o do card, o autor) e o badge `One-Shot`, que estão na linha da árvore e no meta (`structure.md:22`; `components.md` Cabeçalho do lugar, "Não faça"); o `Discussion` e o board da discussão, que estão no breadcrumb; o **← History** dos arquivados, que o breadcrumb faz. **Ficam à direita**, na ordem: o estado antigo (`StatusBadge`, o modo e o estado do review, o estado da discussão, a etiqueta `Archived`), no lugar em que o stepper e a pílula vão entrar; o medidor; **Pause**/**Resume**; `Review: <modo> ▾` e **Models ▾** da task; o link do card no GitHub, na task e no review que têm card: um botão fantasma de ícone com a seta externa (`ICONS.external`), `aria-label` e tooltip `Open card #<N> on GitHub · <status no board>`, que faz o que `TaskCardBadge` e `PullCardBadge` fazem hoje (abrir o card), até o painel `Card` (task 3) e o painel da PR (task 6); o grupo de painéis, no lugar do botão de painel antigo; o apagar. Settings, History e Home ganham só o título; o `h1` de dentro da página sai. **Cedência:** a tabela de `task.md:40–48` vale para essas peças (o breadcrumb dobra abaixo de 1660 px, o grupo fica só com ícone abaixo de 1440, **Pause** abaixo de 1360, o medidor só com a porcentagem abaixo de 1300), e abaixo de 1040 px `Review: <modo> ▾` e **Models ▾** ficam só com o ícone e o nome no tooltip; o estado antigo mantém o texto. Nada quebra linha: com tudo cedido, a 812 px de área principal (1100 de janela), o título corta com o nome inteiro no tooltip. O step 10 confere a 1100 px com o maior título do app | Uma faixa só por lugar, sem ícone nem referência repetidos no topo; cada task de tela troca só o lado direito (`implementation.md:15`) |
| 2 | Quais painéis usam o componente nesta task | `Artifacts`, `Reports` e `Documents`, com o conteúdo de hoje | O pronto pede painéis um por vez com `Esc`; S9 é o mecanismo |
| 3 | O que a linha diz sem P13, M1, P25 e P26 | As formas provisórias da §4.2 | Os dados vêm nas tasks 3, 7, 8 e 9 |
| 4 | Onde o app abre | Na Home, com a pilha lembrada atrás; a Home sem task e com board é o lugar do board | É onde o app abre hoje; a Home é o lugar de retomar (`board.md:32`) |
| 5 | O que `←`/`→` fazem com um lugar que sumiu | Pulam | Voltar a um lugar vazio seria a área vazia que S7 proíbe |
| 6 | **New discussion** no **+ New** antes do campo **Board** (B2, task 5) | Abre o diálogo para o board do lugar (a visão do board, ou o board do item aberto); senão o da última discussão; senão o primeiro por título. Sem board, desabilitado com `Add a board to discuss its cards.` | O diálogo de hoje exige um board (`NewDiscussionRef`, `app-store.ts:81–85`) |
| 7 | O recolhido da lateral entre execuções | Lembrado, como os nós (`app-store.ts:135–136`) | A mesma memória de `lib/ui-storage.ts` |
| 8 | Onde moram a linha, o nó, a faixa, o seletor de tema e o rodapé | Em `features/sidebar/`, feitos só de `components/system/`; cabeçalho de lugar, painel, grupo, barra, página, aviso, toast e região em `components/system/` | Uma feature só usa a árvore (`frontend.md` §Componentes) |
| 9 | Os ícones que o shell acrescenta ao registro | Os de tipo, SVG próprios em `components/system/`, copiados dos símbolos do mock (`08/index.html:880–883`; a marca, 908): `task`, `oneShot`, `review`, `discussion`; o registro de `Icon` passa a aceitar um componente SVG próprio além do `LucideIcon` (`components/system/icons.ts:14–24`). Do lucide: `board` (`Kanban`), `file` (`FileText`, documento), `archive` (`Archive`, arquivamento), `merge` (`GitMerge`), `trash` (`Trash2`); e `go`, a seta de ir do nó, como SVG próprio copiado do mock (`08/index.html:887`), distinta da seta externa, que é `external` | O lucide não tem a marca do One-Shot; um ícone por significado (`components.md` Ícones) |

### 4.4 O que o tech spec toma

- **A forma de `Location` no store.** Uma união discriminada (`{ kind: "task", id }`…) com `go(location)`, `back: Location[]` e `forward: Location[]`. Os campos antigos deixam de ser estado e viram seletores derivados (`useOpenTaskId`, `useOpenBoardId`, `useOpenReviewId`, `useReviewsOpen`, `useOpenDiscussionId`, `useHistoryUi`, `useSettingsUi`, `useOnScreenSituationId`), e as ações antigas (`openTask`, `openBoard`, `openReview`…) viram atalhos de `go`, para as features antigas não mudarem de assinatura. A recomendação é tirar os campos, não espelhá-los: são poucos leitores diretos (§5.2), e um espelho seria uma segunda verdade. `settingsSection` fica no lugar Settings; `historyQuery` e `leftover` continuam campos de interface, fora do lugar. `app-store.test.ts` prova, antes da troca, a equivalência de cada seletor numa tabela de lugares.
- **`applyState` sobre o lugar.** Hoje há regras por tipo: `reviewPlace` e `discussionPlace` levam ao arquivado (`app-store.ts:415–471`), a task some e o lugar zera (`556–564`), o board some e volta à Home (`528–531`). No step 3 elas continuam com esses destinos, expressos como lugares; no step 13 passam a uma regra só, a página do item que saiu, para os quatro tipos de uma vez.
- **A persistência.** Chaves novas em `lib/ui-storage.ts` (a pilha, o último item ativo, o recolhido da lateral), validadas na leitura como `SIDEBAR_COLLAPSED_KEY` (`ui-storage.ts:32`), com um teto de tamanho para a pilha.
- **P1 no Go.** `session.Summary` (`internal/session/state.go:123–141`) ganha `TurnStartedAt` e a ação em curso. O início é o `CreatedAt` da entrada que abriu o turno (`run.turn.id`, `run.go:47–55`; `newEntry`, `run.go:97–106`); a ação é a última entrada `Action` com `Status: running` do turno (`turn.actions`), com o `Label` e o `Target` que `labels.go` já calcula. Hoje o começo e o fim de uma ação não marcam o estado (`events.go:178–184, 210–220`, sem `n.state`), e cada `OnState` publica o estado inteiro e chama os três `Check` (`internal/app/app.go:197–204`; `publish`, `internal/app/state.go:182–191`, sem coalescer). O tech spec escolhe entre marcar o estado a cada ação e coalescer `publish` numa janela curta, ou um evento leve só da atividade das sessões. A recomendação é coalescer: um só caminho de estado, protegido de rajadas.
- **Os DTOs de P1.** A recomendação é acrescentar `turnStartedAt`, `actionLabel` e `actionTarget` aos cinco blocos de sessão (§5.3), em vez de uma lista nova de sessões: segue o padrão, e P2 já sai deles.
- **F19.** `run` (`store/actions.ts:30–36`) passa a exigir, pelo tipo, o rótulo da ação e, opcional, o que fazer; o tech spec fixa os textos das 62 chamadas no padrão da §4.2.
- **A piscada.** `flashing` continua um conjunto por id de situação (`app-store.ts:155`), limpo depois de 2 × 280 ms no lugar de `FLASH_MS = 1600` (`lib/situations.ts:16`; `app/bootstrap.ts:27–34`).
- **As formas longa e curta** são medidas como o meta: a longa quando cabe na largura da coluna, a curta senão; o tech spec escolhe entre medir com `ResizeObserver` por linha ou por container query sobre a largura da lateral com uma estimativa, desde que a regra seja "a longa não cabe".

## 5. Inventário atual

### 5.1 `features/sidebar`, `features/attention`, `features/notice` e o que o shell envolve

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `sidebar/Sidebar.tsx` (36–58) | Coluna: `WaitingSection`, `ReviewsNode`, filtro com o `+` de nova task, `MissingClones`, a árvore num `ScrollArea`, rodapé com `HistoryButton`, `SettingsButton`, `ThemeToggle` | Reescrito |
| `sidebar/SidebarTree.tsx` | `role="tree"` `aria-label="Tasks"` (361); linhas `h-12` com `StatusDot`, nome, `taskStatusLabel` e `#card repo` (41–76); discussão com o rótulo `Discussion` (84–118); nós com chevron (130–160); falha do board com `TriangleAlert` (279–290); o item aberto é `openTaskId ?? openDiscussionId` (320) | Reescrito |
| `sidebar/sidebar-tree.ts` | `sidebarTree` agrupa por board e épico, com o filtro (74–136); `visibleRows` (139); `nodesOfItem` (156) | Ganha reviews, avisos, gravidade, ordem do `Ctrl+J`, linha 2 e 3, nome acessível, resumo |
| `sidebar/task-list.ts` | `taskRows` (19), `emptyTasksText` (37) | Absorvido por `sidebar-tree.ts` |
| `sidebar/useTaskListKeyboard.ts` | Seleção segue o foco: ↑↓, `Home`, `End`, `Enter`, `Space` **abrem** o item (26–58) | Sai |
| `sidebar/ReviewsNode.tsx` | `nav` separado acima do filtro, reviews em botões (não `treeitem`), `max-h-60` com rolagem própria (95–146) | Vira o nó Reviews da árvore |
| `sidebar/MissingClones.tsx` | Faixas `role="status"` acima da árvore, com **Change path** (11–47) | Vira o `treeitem` do aviso |
| `sidebar/RepositoryFilter.tsx` | `DropdownMenu` do `ui`, variantes `sidebar` e `field`; `field` em `history/HistoryPanel.tsx:8` | A da lateral passa ao `Select` com o gatilho da lateral; a `field` fica até a task 11 |
| `attention/WaitingSection.tsx` | **Waiting for you** (73–158); o aberto é `openTaskId ?? openReviewId` (79), sem a discussão, ao contrário do `Ctrl+J` (`useGlobalShortcuts.ts:52`) | **Sai (S1)** |
| `attention/usePresence.ts` | Mantém as entradas que saem, para animar; só `WaitingSection` usa | Sai, ou serve à saída dos toasts |
| `attention/useNow.ts` | O relógio; também em `board/BoardHeader.tsx`, `boards/BoardRow.tsx`, `reviews/ReviewsHeader.tsx` | Fica |
| `attention/useViewedSituation.ts` | Avisa o Go da situação na tela, por `useOnScreenSituationId` | Fica, lendo o lugar |
| `notice/Notice.tsx` | `Banner` e `ErrorNotice` com `Something went wrong` (47–53) | `ErrorNotice` sai para o aviso; `Banner` fica para `LeftoversNotice` até a task 11 |
| `notice/ArchivedNotice.tsx` | Barra flutuante embaixo, centrada, `“name” was archived.` e **Open in history**, 10 s (7, 39, 48) | Vira o toast |
| `notice/LeftoversNotice.tsx` | `Some files stayed on disk` | Fica até a task 11, no lugar do aviso |
| `history/HistoryButton.tsx`, `settings/SettingsButton.tsx`, `theme/ThemeToggle.tsx` | Os três do rodapé; o tema é um `toggle-group` de três botões | O rodapé novo; `ThemeToggle` vira o ciclo |
| `home/Home.tsx` | Sem task e com board, renderiza o `BoardView` do primeiro board; senão um vazio com **New task** | O lugar Home se resolve para o board nesse caso (§4.2); o resto fica até a task 5 |
| `task/TaskHeader.tsx` (44–100), `reviews/ReviewHeader.tsx` (43–100), `discussion/DiscussionHeader.tsx` (55–), `history/ArchivedTaskView.tsx` (115–), `reviews/ArchivedReviewView.tsx` (102–), `discussion/ArchivedDiscussionView.tsx` (122–), `board/BoardHeader.tsx` (22–), `reviews/ReviewsHeader.tsx` (20–), `settings/SettingsView.tsx:41`, `history/HistoryPanel.tsx:152–155` | Os cabeçalhos e títulos de cada lugar | Entram no cabeçalho de lugar pela decisão 1 |
| `task/TaskView.tsx`, `reviews/ReviewView.tsx`, `discussion/DiscussionView.tsx` | Painel lateral em `react-resizable-panels` com `useDefaultLayout` (57, 30, 28); o de artefatos abre sozinho no primeiro artefato (`TaskView.tsx:104–111`, `myspec.artifacts.seen:<id>`, 27–44) | Painel auxiliar; a abertura sozinha sai |
| `app/AppShell.tsx` | `MainArea` escolhe a tela por uma cascata de campos (22–67); grade `[var(--sidebar-width)_minmax(0,1fr)]` (75) | Escolhe pelo lugar; a coluna alterna com `--sidebar-collapsed` |
| `app/App.tsx` | Erro e sobras num overlay fixo no topo (49–56), também sobre as boas-vindas; `ArchivedNotice` fora do shell (62) | Aviso e toasts na área principal; nas boas-vindas, no topo da coluna |
| `app/useGlobalShortcuts.ts` | `Ctrl+N`, `Ctrl+J` pelo primeiro de `waitingEntries` (41–57), `Ctrl+,` alternando (59–74), inertes só nos diálogos de criação | `Alt+←`/`Alt+→`; `Ctrl+J` pela função de `sidebar-tree.ts`; inertes com qualquer diálogo |
| `app/bootstrap.ts` | `situation:started` pisca 1600 ms com a janela em foco (27–34); `situation:open` chama `openPlace` (36–38) | 2 × 280 ms, o anúncio, `situation:open` como ida |
| `lib/situations.ts` | `situationLabel` (37), `placeLabel` (121), `namesPlace` e `situationDetail` (140–177), `compareSituations` (201), `waitingEntries` (220–254), `compactWait`/`spokenWait` (346–358), `FLASH_MS` (16) | Ficam; `sidebar-tree.ts` usa a ordem e os tempos, e o rótulo da árvore é o de `structure.md` §2, não o de `situationLabel`, que segue na barra e nas notificações |
| `styles/globals.css` | `attention-flash` e `attention-flash-ring` de 1600 ms, com a cor parada no movimento reduzido (280–343) | A piscada nova ao lado; as antigas ficam para `StepTabs` até a task 12 |

### 5.2 O estado de navegação no store e quem o lê

Leitores fora de `store/app-store.ts` e dos testes:

| Campo (`app-store.ts`) | Lido por | Vira |
|---|---|---|
| `openTaskId` (96) | `AppShell.tsx:23`, `useGlobalShortcuts.ts:52`, `task-create/NewTaskDialog.tsx:141`, `WaitingSection.tsx:75`, `SidebarTree.tsx:311`, e `lib/repositories.ts:102` por parâmetro | lugar `task` |
| `openReviewId` (115) | `AppShell.tsx:24`, `useGlobalShortcuts.ts:52`, `WaitingSection.tsx:76`, `ReviewsNode.tsx:81` | lugar `review` |
| `openDiscussionId` (123) | `AppShell.tsx:25`, `useGlobalShortcuts.ts:52`, `SidebarTree.tsx:312` | lugar `discussion` |
| `openArchivedId` (145), `openArchivedReviewId` (117), `openArchivedDiscussionId` (125) | `AppShell.tsx:26–28`; `HistoryPanel.tsx` por `useHistoryUi` | lugares arquivados |
| `openBoardId` (111) | `AppShell.tsx:32`, `SidebarTree.tsx:243` | lugar `board` |
| `reviewsOpen` (113) | `AppShell.tsx:31`, `ReviewsNode.tsx:80` | lugar `reviews` |
| `historyOpen` (143) | `AppShell.tsx:30`, `HistoryButton.tsx:16`, `HistoryPanel.tsx` | lugar `history` ou arquivado |
| `settingsOpen` (157), `settingsSection` (158) | `AppShell.tsx:29`, `useGlobalShortcuts.ts:68`, `SettingsButton.tsx:10`, `SettingsView.tsx:17, 35`, `DiscardChangesDialog.tsx`, `PromptPane.tsx` | lugar `settings` com a página |
| `historyQuery` (146), `leftover` (150) | `HistoryPanel.tsx`; `App.tsx`, `LeftoversNotice.tsx` | Ficam campos de interface; `initialTaskUi` (358–413) deixa de zerá-los junto com a navegação, salvo nas boas-vindas |
| `flashing` (155) | `SidebarTree.tsx`, `ReviewsNode.tsx:33`, `task/StepTabs.tsx` | Fica |
| `archivedNotice` (148) | `ArchivedNotice.tsx` | Fila de toasts |
| `error` (95) | `App.tsx`, `actions.ts:34` | Aviso com rótulo |
| Seletor `useOnScreenSituationId` (1082) | `attention/useViewedSituation.ts` | Deriva do lugar |

- **Ações de navegação** (`app-store.ts:569–909`) e quem as chama: `openTask` (`NewTaskDialog.tsx:139`, `CardDetail.tsx:55`, `PullRequestRow.tsx:30`, `SidebarTree.tsx:42`, `useTaskListKeyboard.ts:16`), `openBoard` (`SidebarTree.tsx:242`), `openReviews` (`ReviewsNode.tsx:82`), `openReview` (`ReviewsNode.tsx:32`, `StartReviewDialog.tsx:92`, `PullRequestRow.tsx:29`), `openDiscussion` (`SidebarTree.tsx:85`, `useTaskListKeyboard.ts:17`, `NewDiscussionDialog.tsx:93`), `openHistory` (`HistoryButton.tsx:17`), `openArchived` (`ArchivedNotice.tsx:16`, `HistoryPanel.tsx:51`, `CardDetail.tsx:56`), `openArchivedReview` e `openArchivedDiscussion` (`HistoryPanel.tsx:96, 118`), `closeArchived`, `closeArchivedReview`, `closeArchivedDiscussion` (as três telas arquivadas), `openSettings`/`closeSettings` (`SettingsButton.tsx`, `useGlobalShortcuts.ts`), `openPlace` (`bootstrap.ts`, `useGlobalShortcuts.ts`, `WaitingSection.tsx:77`), que vira `openSituation`.
- **Sem leitor fora do store:** `closeTask` (581), `closeReview` (635), `closeDiscussion` (680–688), `closeHistory` (823) e `useOpenTask` (1023), que `overview.md:146` e `frontend.md:14` citam como exemplo.
- **`NO_ITEM_PLACE`** (349–355) e `initialTaskUi` (358–413) existem para zerar as telas umas das outras; com o lugar, deixam de ser necessários.
- **Testes.** `test/render.tsx` aceita os dez campos em `ui` (13–41, 55–82) e passa a aceitar `location`; 20 arquivos de teste os usam: `app/bootstrap.test.ts`, `app/App.test.tsx`, `store/app-store.test.ts`, e os de `ArchivedNotice`, `NewTaskDialog`, `ArchivedTaskView`, `HistoryButton`, `useViewedSituation`, `HistoryPanel`, `WaitingSection`, `SettingsButton`, `SettingsView`, `ReviewsNode`, `SidebarTree`, `CardDetail`, `ArchivedReviewView`, `PullRequestRow`, `StartReviewDialog`, `ArchivedDiscussionView`, `NewDiscussionDialog`. São 189 arquivos de teste no frontend.
- **Outra memória no `localStorage`** fora de `ui-storage.ts`: `myspec.artifacts.seen:<id>` (sai com S9), os tamanhos de `useDefaultLayout` (saem com os painéis), `myspec.review.expanded` (`ReviewStrip.tsx:10`, task 3) e `myspec.theme` (`theme/theme.ts:4`). O filtro e o tema são estado do Go (`State.repositoryFilter`, `State.theme`).

### 5.3 Os DTOs do resumo de item: o que existe e o que falta

O bloco de sessão (`sessionStatus`, `sessionModel`, `sessionEffort`, `turnRunning`, `processRunning`, `retryAttempt`, `contextPercent`, `pendingCount`, `lastError`) aparece cinco vezes, sempre convertido de um `session.Summary` (`internal/session/state.go:123–141`, montado em `run.summary`, `run.go:109–141`):

| DTO (`internal/bindings/dto.go`) | Sessão | Convertido em (`convert.go`) | Origem no Go |
|---|---|---|---|
| `TaskSummary` (377–423, bloco 396–407) | A da etapa; na implementação, o implementador do step atual; vazio na etapa de PR, com `waiting` por padrão (199–201) | 199–229, pela chave de `taskSessionKey` (246–260) | `session.Service.Summaries` |
| `Step.reviewer` → `StepReviewer` (197–210) | O revisor do step, `nil` sem conversa | `fromStepReviewer` (515–530) | `flow.StepState.Reviewer` (`internal/flow/step.go:77–80`) |
| `TaskSummary.pr` → `PullRequest` (259–307, bloco 294–306) | A da PR | `fromPullRequest` (263–306) | `flow.PullRequest.Session` (`internal/flow/pr.go:79`) |
| `ReviewSummary` (1026–1090, bloco 1075–1086) | A do review | 1381 | `session` pelo id do review |
| `DiscussionSummary` (1218–1266, bloco 1251–1262) | A da discussão | 1604 | `session` pelo id da discussão |

- **P2 já está exposto.** As duas conversas do step atual têm o status cada uma (`TaskSummary.sessionStatus` e `steps[atual].reviewer.sessionStatus`), lidas hoje em `task/step-status.ts:158–172` (`loopSession`). Falta só a função que as lista por papel; nenhuma mudança em Go.
- **A conversa que trabalha** é derivável: `sessionStatus === "working"` de cada bloco.
- **Falta de verdade (P1):** o início do turno e a ação em curso; nada disso é persistido, e o transcript não muda.
- **O que a linha lê e já chega:** as situações, da mais grave para a menos (`dto.go:333–357`; ordem em `internal/attention/service.go:454–460`); `Step.status`, `phase`, `block.reason` (`dto.go:119–125, 146–186`), `reviewPass`, `reviewRound`; `PullRequest.status`, `block.reason` (212–218), `prNumber`, `checkedAt`, `reports`; `ReviewSummary.status`, `passes[].findings`, `passes[].verdict`; `DiscussionSummary.status`, `drafts[]`; `planProblems`; `Board.reading`, `Board.failure` (729–760); `ReviewCenter.reading`, `failures`, `pendingCount`; `Repository.missing`, `cloned`. Não chegam: P13, P25, P26, M1 (as formas provisórias da §4.2).

## 6. Riscos e o primeiro step

| Risco | Tratamento |
|---|---|
| **O refactor da navegação** (`implementation.md:194`). Dez campos, catorze ações, 20 arquivos de teste; `applyState` com três regras por tipo | O step 3 só troca o estado pelo lugar, sem mudança visível, com os destinos de hoje: os seletores derivados, as ações antigas sobre `go`, `test/render.tsx` com `location`, e a tabela de equivalência em `app-store.test.ts`. A pilha vem no step 4; a página do item que saiu troca os destinos no step 13, de uma vez |
| **A lateral e o painel em `clamp` com pixel inteiro** (`implementation.md:190`) | `--sidebar-width` já é `round(down, …, 1px)` (`tokens.css:91`); o painel usa `round(down, var(--panel-width), 1px)` e a regra é uma container query em 1120 px (`components.md` Painel auxiliar). `styles/globals.test.tsx` prova o arredondamento da lateral, do painel e da coluna ao lado dele; o step do painel compara capturas a 1180, 1250, 1435, 1450 e 2560 px |
| **A árvore com o nome acessível inteiro** | A frase nasce em `sidebar-tree.ts`, pura e testada; a linha é memoizada pelo resumo do item e pelo minuto. A frase muda a cada minuto na linha com foco: o step 7 passa pelo Orca na máquina alvo e confere que a troca não é reanunciada; se for, o minuto sai do nome da linha com foco até ela perder o foco |
| **P1 multiplica as publicações do estado** | O step 1 mede numa sessão real os `state:changed` por minuto antes e depois, e o tech spec escolhe entre coalescer e o evento leve |
| **Steps grandes na árvore e no cabeçalho** | A árvore em dois steps (6: linha e nó; 7: teclado, Reviews e avisos, remoções) e o cabeçalho em dois (10: o componente e os três itens; 11: os outros lugares) |

**Como o primeiro step é feito.** É o de P1, em Go, isolado: `session.Summary` com o início do turno e a ação em curso, testado com os fakes do `claudetest` (uma ação que começa e termina, duas ações no mesmo turno, um turno sem ação, a interrupção). A medição das publicações por minuto fica registrada no commit. Nenhum DTO muda ainda.

## 7. Documentação que a task atualiza

Cada linha é escrita no step da área (§8), e o último step confere o todo.

| Arquivo | O que muda |
|---|---|
| `docs/product/features.md` §Tela de boas-vindas e barra lateral (264–285) | A lateral de cima para baixo, a árvore com Reviews dentro, a linha de três linhas, os glifos, os dois relógios, o meta em hover, os nós recolhidos, a faixa recolhida, o teclado (a seta move o foco, `Enter` abre). A parte das boas-vindas fica (task 10) |
| `features.md` §Depende de mim (629–647) | Sem **Waiting for you**; a árvore, a marca `Ctrl J`, `Ctrl+J` sobre o filtro, a piscada no véu, o anúncio |
| `features.md` §Encerramento e arquivamento (465–475) | A página do item que saiu com a task aberta, o toast com ela fechada |
| `features.md` §O review como item (587–593) | A linha sob o nó **Reviews** com a posição e os dois relógios; o fim com a tela aberta mostra a página do item que saiu, não o arquivado |
| `features.md` §A discussão como item (202–209) | A linha com o ícone de tipo no lugar do rótulo `Discussion`; o cabeçalho sem o rótulo e o board, que estão no breadcrumb; arquivada ou apagada com a tela aberta, a página do item que saiu |
| `features.md` §Atalhos (680–703) | `Alt+←`/`Alt+→`, `Ctrl+J` pela gravidade, pela idade e sobre o filtro, `Ctrl+,` que fecha para o lugar anterior, `Esc` no painel e em Settings, as teclas da árvore, os atalhos inertes com um diálogo aberto |
| `features.md` §Etapas de planejamento (333) e §Configurações e aparência (678) | O painel de artefatos fechado até o usuário abrir; o tema em ciclo no rodapé |
| `docs/architecture/design-system.md` §Componentes | A família Shell: cabeçalho de lugar, painel e grupo com a regra em 1120 px, barra do pedido, página do item que saiu, aviso do app, toast e a região ao vivo, ícones de tipo e o registro de SVG próprio no `Icon`, o gatilho da lateral do `Select`; e as peças da árvore, que moram em `features/sidebar` |
| `docs/architecture/overview.md` | §Store (146): `Location` e a pilha no lugar da lista de campos, sem `NO_ITEM_PLACE`. §Features (154): `attention` sem a seção de espera. `lib/ui-storage.ts` (156) com o que passa a lembrar. §O estado que o frontend vê (97) e §Eventos (103–112): a ação em curso e o início do turno no resumo das sessões, e a publicação coalescida, se for a escolha |
| `docs/guidelines/frontend.md` | §Store e ações (11–16): a navegação é um `Location`, e o seletor de exemplo deixa de ser `useOpenTask`. §Acessibilidade (31): a árvore, não mais "a lista de tasks"; uma região ao vivo só. §Componentes (18–26): onde mora uma peça de uma feature só |
| `docs/architecture/sessions.md` | Só se o tech spec guardar algo novo no transcript por P1; a recomendação não guarda |

## 8. Plano de steps sugerido

Catorze steps, o teto de G, do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma provisória visível que um step seguinte da mesma task troque.

1. **P1 no domínio.** `session.Summary` com o início do turno e a ação em curso; a mudança de uma ação marca o estado; a publicação coalescida ou o evento leve. Testes em `internal/session` e, se `publish` mudar, em `internal/app`.
2. **P1 nos DTOs e P2.** Os três campos nos cinco blocos, `convert.go` e o teste dele, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`; a função de P2 que lista as sessões de um item por papel.
3. **`Location` no store.** A união, `go`, os seletores derivados, as ações antigas sobre `go`, `applyState` com os destinos de hoje (review e discussão ao arquivado, task e board à Home), a Home sem task resolvida para o board, `AppShell` pelo lugar, `test/render.tsx` com `location`, a tabela de equivalência. Nada muda na tela.
4. **A pilha.** `back`/`forward`, a persistência (F1), a abertura na Home, `Alt+←`/`Alt+→`, `Ctrl+,` e `Esc` que fecham Settings para o anterior, o pulo do que sumiu, os atalhos inertes com qualquer diálogo. Testes de store e de atalho.
5. **`sidebar-tree.ts`.** A árvore com Reviews e os avisos, a gravidade, a ordem do `Ctrl+J` sobre o filtro, as formas longa e curta da linha 2 pelas tabelas de `structure.md` §2 e as provisórias, a linha 3, o nome acessível, o resumo. Funções puras e testes em tabela.
6. **A árvore I: linha e nó.** A linha, o nó com a seta de ir e o resumo, os ícones de tipo com o registro de SVG no `Icon`, a marca `Ctrl J` e o atalho `Ctrl+J` pela função nova (com o filtro), a piscada nova de 2 × 280 ms nas linhas, a rolagem até a linha aberta. Sai `WaitingSection` (S1), com o teste.
7. **A árvore II: teclado, Reviews e avisos.** O teclado da árvore, Reviews e os avisos de clone dentro dela, o nome `Active items` e a lateral `Work`, a passagem pelo Orca. Saem `ReviewsNode`, `MissingClones`, `useTaskListKeyboard`, `task-list.ts` e os testes deles.
8. **O resto da lateral.** O topo com **+ New ▾** e `«`, o filtro com o gatilho da lateral, o indicador `↓ N more below`, o rodapé, a faixa recolhida inteira com o teclado e a memória.
9. **A região ao vivo e a chegada.** A região `.toasts` como a única região ao vivo, com o anúncio de `situation:started` e do `Ctrl+J` sem destino; `situation:open` como ida (e, com um modal aberto, só a janela à frente), com o filtro e a revelação da linha; o foco na linha da árvore e na página do item que saiu. O foco no título do lugar entra no step 10, com o título.
10. **O cabeçalho de lugar I.** O componente com `←`, `→`, o breadcrumb que dobra e o título (`h1` com `tabindex="-1"`), o foco nele depois de `Alt+←`/`Alt+→`, do breadcrumb, do `Ctrl+J` e da notificação, e a adoção na task, no review e na discussão pela decisão 1, com a cedência conferida a 1100 px.
11. **O cabeçalho de lugar II.** A adoção no board, em Reviews, em History, nos três arquivados, em Settings (com **Close** `Esc`) e na Home.
12. **O painel auxiliar e o grupo.** O componente, a regra em 1120 px com o arredondamento, a animação, `Esc` e o foco; `Artifacts`, `Reports` e `Documents` saem do `react-resizable-panels`, e o painel de artefatos não abre mais sozinho (S9). Capturas nas larguras do risco.
13. **A página do item que saiu e os toasts.** A página nos sete casos da §4.2 e `applyState` numa regra só, no mesmo step: o review e a discussão deixam de ir ao arquivado, e a task e o board deixam de ir à Home; o toast de arquivamento de task na região, só quando ela não estava aberta; sai `ArchivedNotice`.
14. **A barra do pedido e o aviso do app.** A barra nas sete formas, testada isolada; o aviso no lugar de `ErrorNotice`, também nas boas-vindas, com `run` exigindo o rótulo nas 62 chamadas (F19); a conferência final de `docs/` contra o que a task fez.

Depois do step 14, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.
