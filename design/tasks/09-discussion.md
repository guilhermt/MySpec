# Task 9 · A discussão

Material de entrada da nona task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 9 de `design/implementation.md` (§2, task 9), com os princípios da §1 e os riscos da §3. Os caminhos de código Go são relativos à raiz; os do frontend, a `frontend/src/`.

**Base.** A task parte da `main` depois do merge das tasks 4 a 8 e não corre em paralelo com nenhuma delas; corre em paralelo com a task 10, que começa depois do merge das tasks 4 e 5 (§6). As linhas de frontend citadas são as da branch da task 4 em `c55a417` (`origin/51-redesign-4-task-screen-ii-the-conversation-the-ask-bar-and`), a única que toca `features/discussion` (o compositor de `DiscussionView.tsx` e `ArchivedDiscussionView.tsx`); as de Go são as mesmas em `c55a417` e na `main` em `2797eaa` para `internal/discussion`, `internal/discussionflow` e `internal/attention`. O que as tasks 5, 6 e 8 criam é citado pelo material delas (`tasks/05-board.md`, `tasks/06-review.md`, `tasks/08-chained-publication.md`), porque ainda não está no código: o campo **Board** do diálogo (5), o `DecisionCard`, o `RequestModel` compartilhado, a `Pill` com `idle`, o `GonePage` com texto e bloco, `PanelSection`/`PanelRow` no system e o marco com o modelo (6), e a cadeia, o `hold`, os status novos e as situações (8). O primeiro passo do tech spec é conferir cada linha citada na `main` em que a task começa. A migration da task é a `0024` (a 4 é a `0020`, a 6 a `0021`, a 7 a `0022`, a 8 a `0023`); entre a 9 e a 10, quem entra depois renumera a sua no rebase.

Toda decisão de design está tomada neste documento, em `design/screens/discussion.md`, em `design/structure.md` e em `design/system/components.md` (`implementation.md` §1, "Os mocks e `design/` são a fonte de verdade"). O PRD não pergunta nada ao usuário: D3 e D4 foram confirmadas por ele (`decisions.md`, 2026-09-25), a tela foi decidida em 2026-09-24, e o que a task abria de produto foi decidido pelo coordenador, por delegação, em `decisions.md` (2026-09-29, "Discussão: o que a entrada da task 9 decidiu"), e está na §4.3.

**Nenhum comportamento de hoje se perde.** Cada controle das telas que saem tem um lugar novo, dito na §4.2 e provado pelo pronto 8: do cabeçalho, o estado, o medidor, **Pause**/**Resume**, **Documents**, **Archive** com a razão no tooltip e **Delete discussion**; da barra da discussão, o estado ao vivo, a razão do artefato ilegível e `Publishing…`; do painel **Drafts**, `N of M decided`, **Group into an epic** com as caixas e a reabertura numa leitura nova; do grupo do épico, `Discarded` e o link do resultado; do cartão de rascunho, o tipo, o link do card de uma atualização, o resultado com o link e a data, a razão da falha com **Retry**, `Publishing…`, o que o segura, **Repository**, **Module** e **Epic** com **Existing issue…**, `Current:` de uma atualização (título, módulo, épico), **Title** e **Body** salvos enquanto se digita e nunca vazios, **Edit**/**Changes** de uma atualização (também depois de publicada), as dependências com `Linked` (o tooltip `Linked on GitHub` do link), `Dropped: discarded` e `Couldn't record: …` (os avisos), `On GitHub`, `×` e o acréscimo por id ou `dono/nome#N`, `This card isn't in the last reading of the board.`, `Refreshing the card…`, a releitura que falhou, os avisos, a decisão em alternância que se desfaz; do painel de documentos, **Context** e **Document**, o esqueleto e o erro de leitura; dos diálogos, arquivar e apagar; do diálogo de nova discussão, o board, **Title** com o contador e `Use at most 120 characters.`, **What to discuss** com `Ctrl+Enter`, os cards com `×`, **Context** somente leitura com a releitura dos cards, **Model**, **Repositories without a clone** com **Clone**, `Cloning…`, **Change path**, o aviso do clone inexistente e o erro do clone, **Start discussion** com a razão, `Starting…` e o erro. As mudanças de comportamento são as de `changes.md` D1, D2, D4, D6–D12, D14, D17–D22 e S10 na discussão.

**Vocabulário.** "Rodada" é o conjunto dos rascunhos com o mesmo `round` (P25); "a rodada atual" é a de maior número. "O cartão" é o cartão neutro dos rascunhos da rodada atual na conversa; "o aberto" é o rascunho que mostra o corpo; "o dobrado" é o de duas linhas; "o atual" é o que a navegação do cartão tem (o aberto, quando há um). "Decidido" é aprovado, descartado ou no GitHub. "No GitHub" é `Published.Done()`; "começado" é `Published.Started()`. "A cadeia", "o `hold`", "vai na corrida" e "não vai publicar" são os de `tasks/08-chained-publication.md` §4.2. "A linha do gesto" é a linha afundada do que **Approve** e **Discard** publicam. "A barra" é a barra do pedido da discussão.

## 1. Objetivo e critério de pronto

A discussão vira a tela do review: o cabeçalho com a pílula `Discussing` ou `Round N` e o `⋯`, a conversa com os marcos da discussão, os rascunhos da rodada como um cartão na conversa (uma lista dobrada, com o atual aberto e o corpo inteiro), a linha antes do gesto que diz o que ele publica, a barra do pedido como único lugar da ação, o compositor com as pastilhas, `Details` e `Documents` fechados, e as rodadas passadas dobradas num marco. Do Go, a task pede a rodada de cada rascunho (P25), a versão de antes de uma revisão (P24), os marcos da discussão (P10), o que **Approve** e **Discard** publicariam agora pela função da cadeia (F16) e o título do épico no agrupamento; o **Retry** da sessão (P3) é só frontend.

**Pronto quando** (`implementation.md` task 9), cada item provado como diz:

1. **As cenas.** As fixtures de `test/discussion-scenes.ts` reproduzem `lab/13-screen-discussion/src/disc.js` (os rascunhos `ROUND1` 49–56, `MANY` 57–64, `ROUND3` 65; o estado das cenas `init` em `pub.js` 52–75; a conversa 299–361) no padrão de `test/task-scenes.ts` (`SCENES`, `sceneOf`, `fixSceneClock`), com a árvore das cenas da task (a task `t1` em `Question · Reviewer · Step 3/7` há 18 minutos). O relógio é fixo em 2026-09-24 e coerente: a discussão `Usage-based pricing tiers` do board `Platform Roadmap` começa às 14:02 com #455 e #461; `talk` às 14:11 (`Waiting for reply · Discussing 2m`); `unreadable` às 14:28 (o documento e o artefato das 14:27); `drafts` às 14:33 (os rascunhos das 14:27, `Decide drafts · round 1 6m`); `rewrite` às 14:38 (a atualização de #461 publicada às 14:29, a revisão às 14:32); `publish` às 15:10, e `?after` com o épico criado às 15:10 e o 2 em `Publishing…`; `published` às 15:13 (a cadeia de 15:10 a 15:12, `Ready to archive 1m`); `partial-fail` às 15:12 (a falha no 3 às 15:11, `!1m`); `epic` e `epic-off` às 14:40 (`1m`); `many` às 14:33; `done` às 15:53 (rodadas 1 e 2 dobradas, a 3 publicada às 15:49, `Ready to archive 4m`); `archive-blocked` como `epic`. As flags: `?home` em `start`; `?error` em `talk`; `?after` em `publish`; `?edit` em `drafts` (o 3 em edição); `?archive` em `published` e `done`; `?group` em `many`; `?delete` em `drafts`; `?panel=Details` e `?panel=Documents` em `drafts` e `done`; `?menu` em `drafts`. Dois testes pintados (Chromium, claro e escuro): `features/discussion/DiscussionView.scenes.painted.test.tsx` (as doze cenas da tela e as flags) e `features/discussion/NewDiscussionDialog.scenes.painted.test.tsx` (`start`, `start?home`), cada cena a 2180 px e a 978 px de área principal, e `many` e `done?panel=Details` também a 812 px. Em cada uma, o teste confere: todo rascunho, dobrado ou aberto, marco, cartão, barra, compositor, painel, diálogo e página em pixel inteiro; as bordas do cartão, da barra e do compositor iguais às da coluna; todo texto cortado com tooltip (o título e a linha 2 do dobrado, o valor dos seletores de **Edit**, a lista de um marco); no máximo uma primária na camada de cima (§4.2, A primária). Grava as capturas, anexadas à pull request lado a lado com o mock (`python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090; `13-screen-discussion/b.html?scene=…`).
2. **O teclado** (jsdom), em `features/discussion/DiscussionView.keys.test.tsx`: `A` e `D` num rascunho que não publica decidem e abrem o próximo por decidir, onde `A` e `D` ficam inertes por 900 ms; `A` num rascunho cuja linha do gesto publica mantém o foco nele; a repetição da tecla (`event.repeat`) e um segundo clique em 900 ms são ignorados; a tecla da decisão ativa desfaz e não avança; `E`, `Esc` e **Done**; `Enter`, `↑` e `↓` nos dobrados abrem; `↑` no primeiro e `↓` no último continuam o percurso da conversa; `Alt+↓` e `Alt+↑` de qualquer ponto fora de um diálogo, o compositor incluído; no `listbox` de dependências, a busca, as setas, `Enter` e `Esc`; `Ctrl+Enter` no diálogo de nova discussão, de arquivar e de agrupar, e em nenhum outro lugar da tela; a ordem de `Esc` (§4.2, O teclado).
3. **As regras em tabela**, sem renderizar: `features/discussion/drafts-card.test.ts` (a ordem, o número, o atual, a linha 2 do dobrado, o estado de cada caso da §4.2, a linha do gesto de cada caso, os nomes acessíveis, o avanço e a trava), `discussion-request.test.ts` (a barra em cada status, com a variante, o meio, a ação e o foco da chegada, pausada incluída; o placeholder e as pastilhas), `discussion-header.test.ts` (a pílula de cada momento, o `⋯` com as razões, as linhas de `Details`), `features/chat/markers.test.ts` (os marcos da discussão e a rodada que dobra) e `new-discussion.test.ts` (a linha do contexto com os plurais, as razões do rodapé).
4. **O Go** (P10, P24, P25, F16): `internal/discussion` com a rodada na leitura (a primeira, a revisão, a que abre a rodada seguinte, o rascunho descartado de uma rodada fechada que fica, o id reusado que muda de rodada), `Recorded` com o antes da revisão, os avisos pelo título, `GroupIntoEpic` com o título e o repositório e as recusas próprias (`ErrEpicUntitled`, `ErrEpicTitleTooLong`, `ErrNotGroupable`, a `board.Refusal` do repositório), o corpo vazio do épico do usuário, e `ApprovalCleared` e `Revised` nos três casos em que a leitura tira a aprovação sem substituir o rascunho (o épico ou uma dependência que `normalize` tirou de um mantido, o épico mantido cujos cards mudaram), com o campo no `Before`; `internal/discussionflow` com os marcos gravados uma vez (o documento pelo carimbo, o artefato ilegível pela razão, a publicação por rodada, também depois de reiniciar) e o que o gesto publica em cada caso da tabela da cadeia da task 8; `internal/session` com os tipos e os campos; `discussion.Reason` com o texto de cada recusa do leitor; `prompts_test.go` com a linha que pede manter o id de um rascunho que muda; `discussionflow.Start` com ` The discussion was undone.` no fim do erro quando o apagamento dá certo, e sem ela quando ele falha; `bindings` com os campos novos, `GroupIntoEpic` e as frases dos sentinels novos; `task generate`, `lib/wails.ts` e `test/wails-mock.ts`; `internal/store/migrate_test.go` com a `0024`.
5. **A publicação na tela** (jsdom, pelo `test/wails-mock.ts`): aprovar o último card de um épico com a condição fechada mantém o foco e mostra `Publishing…` e, com o estado seguinte, `✓ Created web#2302 · 15:12` e `To take it back, close web#2302 on GitHub.` no rascunho 4, que tem o foco; o marco `Published · round 1 · 2 so far` passa a `4 created, 1 updated`; uma falha vira `Publication stopped` e a barra `Publish failed` com **Show**; com uma corrida em curso, a decisão dos outros fica tracejada com `A publication is running · the decision waits for it`.
6. **A rodada** (jsdom): uma leitura que traz a rodada 2 dobra a 1 num marco `Round 1 · 5 drafts, revised once · 4 created, 1 updated`, que abre a lista com os links; a pílula diz `Round 2`; o cartão novo vem depois de `Drafts written · round 2 · 1 draft`; numa discussão anterior à task, sem marco da rodada 1, o `Round 1` derivado entra logo antes do `Drafts written · round 2`.
7. **A chegada** (jsdom): por `Ctrl+J` e pela notificação, o foco vai ao que cada situação da §4.2 pede (a primeira opção, **Allow**, o compositor, **Retry**, o primeiro rascunho por decidir aberto, o épico aberto, o **Retry** do rascunho que falhou, **Archive…**), e a barra que nasce com a tela aberta pisca e é anunciada.
8. **Onde foram as ações.** `features/discussion/where-actions-went.test.tsx` tem uma linha por controle do terceiro parágrafo e por estado em que ele aparece hoje; nenhum fica sem lugar. Em cada situação da barra, no cartão em cada estado e em cada diálogo, a tela tem no máximo uma primária.
9. **A prova numa discussão real**, um ponto de parada operado pelo usuário depois do step 10 (§4.2, A prova), sem escrita no GitHub: os marcos gravados pelo Go numa sessão de verdade, a revisão com `Drafts revised`, tudo descartado com `Ready to archive · nothing published`, a rodada 2 que dobra a 1, o erro de sessão com **Retry** se acontecer, e o arquivamento com a página que saiu.
10. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
11. **Documentação** da §7; `features.md` §Discussão inteiro reescrito, e §Depende de mim, §A página do item que saiu, §Histórico de uma discussão (o que muda nele) e §Atalhos.
12. **Revisão do `design-critic`** na branch contra este material, `discussion.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md` §1).
13. **O CI verde** na pull request (`gh pr checks`) antes de ela ser dada como pronta.

`changes.md`: D1, D2, D4, D6, D7, D8, D9, D10, D11, D12, D14, D17, D18, D19, D20, D21, D22, S10 na discussão. `backend.md`: P3 (discussão), P10 (discussão), P22c, P23 (discussão), P24, P25; F16, F17, F18.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1, task 9, task 11 (o que fica para ela), riscos | O escopo, o app sempre usável, os testes que migram |
| 2 | `design/decisions.md`: Discussão, o que a entrada da task 9 decidiu (a primeira entrada); o que a entrada da task 8 decidiu; Conversa, largura única (2026-09-25); Discussão, um rascunho por vez (2026-09-24); Review, cartões na conversa | O que o usuário aprovou e o que o coordenador decidiu por delegação |
| 3 | `design/screens/discussion.md` inteiro: a régua (15–22), o início (24–43), o cabeçalho (45–77), a conversa e os marcos (79–97), os rascunhos (99–191), a publicação (193–219), a rodada (221–234), a barra (236–270), o compositor (272–283), os painéis (285–294), arquivar e apagar (296–325), agrupar (327–334), os estados (336–348), os atalhos (350–366), os dados (407–420) | A tela inteira |
| 4 | `design/screens/review.md` §4 (133–175), §9 (211–236), §10 (238–256); `design/screens/task.md` §3, §6, §7, §8; `design/screens/board.md` §2.3 (66–78), §3.6 (189–217), §4.3 (283–290) | O que a discussão herda do review e da task; o início pelo board e pela Home |
| 5 | `design/structure.md` §1 (7–38), §2 (a linha 2, 96–124; a linha sem situação, 128–157), §3 (200–335), §5 (344–382), §6, §7 | A chegada, a árvore, a barra, os painéis, as teclas, as larguras |
| 6 | `design/principles.md` 2, 5, 7, 8, 9, 10 | A primária única, os glifos, um pedido num lugar, o movimento, a tecla escrita, o pixel inteiro |
| 7 | `design/system/components.md`: estados comuns, Aviso de tecla (110), Etiqueta (120), Link (141), Botão (161), Chip (176), Input e textarea (200), Select, menu e listbox (213), Menu do item (227), Caixa de seleção (238), Controle segmentado (258), Painel auxiliar (379), Página do item que saiu (394), Faixa de aviso (428), Linha afundada (439), Stepper e pílula (461), Barra do pedido (487), Compositor (502), Marco em linha (547), Cartão neutro (635), Rascunho (673), Rascunho dobrado (688), Diálogo (776) | Anatomia, estados, teclado e acessibilidade de cada peça |
| 8 | `design/system/tokens.css`: textos, espaços, `--key-size`, `--size-dialog`, `--size-dialog-wide`, `--measure-conversation`, `--veil-hover`, `--brand-tint-plane` | Nenhum token novo |
| 9 | `design/changes.md` D1–D22, S10; `design/backend.md` M2, P3, P10, P22c, P23–P26, F16–F18 | O que muda e os dados |
| 10 | `design/tasks/08-chained-publication.md` §4.2 (a regra, o `hold`, os status, arquivar, a falha, só a decisão publica, as situações, o painel mínimo), §4.4 (`chain.go`); `design/tasks/06-review.md` §4.2 (o cabeçalho, o cartão, a barra) e §4.4 (os componentes compartilhados) | O que as duas deixam e esta usa |
| 11 | `design/research/discussion.md` §0, §1, §2; `design/research/interview.md`, as respostas sobre a discussão | O produto de hoje, o volume real e o que o usuário respondeu |
| 12 | Mocks, com `python3 -m http.server <porta> -d design/lab`: `13-screen-discussion/b.html` (`?scene=` com as treze cenas e as flags de `README.md`) e as fontes `src/disc.js` (a pílula 167, o cabeçalho 177, o `⋯` 187, a edição 238, o rascunho 257, o cartão 276, a lista da rodada 287, a conversa 299–361, o compositor 362, os painéis 379, os diálogos 398–452, a página 470, a trava 524, o teclado 576), `src/pub.js` (as horas 14, a espera 18, a cadeia 31, as cenas 52, a situação 76, o estado 87, a linha do gesto 102, a decisão 113, o marco da rodada 131, as rodadas dobradas 151, a barra 165, as razões de **Archive** 182), `src/focus.js`; `13-screen-discussion/components.html` | A referência visual. Onde o mock e este material divergem, vale o material (§4.3 #30) |
| 13 | `docs/product/features.md` (na base) §Discussão inteiro, §Histórico de uma discussão, §Sessões e conversas, §Depende de mim, §A página do item que saiu, §Atalhos | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 14 | `docs/guidelines/README.md`, `frontend.md`, `go.md`, `testing.md`; `docs/architecture/overview.md` §A discussão; `sessions.md` (os marcos); `storage.md` (`discussion_drafts`) | Como um step acontece |
| 15 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go** (P10, P24, P25, F16): a migration `0024`; a rodada, a revisão e os avisos pelo título em `internal/discussion`; o título e o repositório no agrupamento; os marcos em `internal/session` e onde `discussionflow` os grava; `discussion.Reason`; as recusas próprias do agrupamento; a frase ` The discussion was undone.` de uma criação desfeita (P22c); a linha do prompt que pede manter o id de um rascunho que muda (`prompts.go`, `draftsFormatNote`); o que o gesto publica em `discussionflow/state.go`, pela cadeia da task 8; DTO, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`.
2. **O diálogo de nova discussão** no `Dialog` do system, com o campo **Board** da task 5 no alto.
3. **A tela da discussão**: o cabeçalho com a pílula, o medidor, **Pause**, `Details`, `Documents` e o `⋯`; a conversa com os marcos e a rodada que dobra; o cartão dos rascunhos com o dobrado, o aberto, a linha do gesto, a decisão, **Edit**, **Retry** e o teclado; a barra do pedido em todos os estados, com a chegada, a piscada e o anúncio; o compositor com os placeholders e as pastilhas; os diálogos de arquivar, apagar e agrupar; a página da discussão que saiu.
4. **A árvore e a pílula** com a rodada: `Round R` na posição e no lugar de cada situação.
5. **`components/system/`**: **Draft** e **FoldedDraft** (o rascunho aberto e o dobrado), a linha do gesto como variante da linha afundada, o diff neutro, a escolha de dependências (`DependencyPicker`, o `listbox` com busca), as pastilhas de começo de mensagem no `Composer`, e o `DecisionCard` da task 6 com o avanço e a trava do rascunho.
6. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| A discussão arquivada no History (`ArchivedDiscussionView`) | 11 | A de hoje. Continua importando de `discussion-status.ts` (`epicGroups`, `kindLabel`, `looseDrafts`, `outcomeLabel`) e `DeleteDiscussionDialog.tsx`: os dois mudam por dentro e mantêm a exportação. A conversa dela passa `discussion` ao contexto dos marcos (§4.4), para as rodadas dobrarem também ali |
| Os textos das notificações da discussão (`Decide drafts` com a contagem, `Publish failed` com o nome; P37, X20) | 11 | Os de hoje e os três da task 8 (`internal/attention/text.go`) |
| O toast de uma discussão arquivada sem a tela aberta (X12, F20) | 11 | Nenhum, como hoje |
| O seletor de modelo do diálogo | 12 | O `ModelPicker` de hoje dentro do `Dialog` do system, como a task 5 deixou o da criação |
| Qualquer mudança em `internal/gh` | — | Nenhuma |
| `ToneDot`, `ContextGauge`, `PauseButton`, `useEditedText`, `CardLink` | 11, 12 | Continuam (task, History). A discussão deixa de usar `ToneDot` e `ContextGauge` |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| Os rascunhos de uma rodada como lista dobrada num cartão neutro na conversa, o atual aberto com o corpo inteiro renderizado; o painel **Drafts** sai | `decisions.md` 2026-09-24 (Discussão); `discussion.md` §5; D1 |
| Aprovar publica na hora, sem confirmação; o que depende espera; a regra da cadeia é a da task 8, e a linha antes do gesto diz o que ele publica; o desfazer é pelo GitHub | D3, D4 (confirmadas, `decisions.md` 2026-09-25); `discussion.md` §5.4, §6 |
| Um gesto que publica mantém o foco; um que não publica avança; `A` segurado é ignorado; 900 ms depois de avançar | `discussion.md` §5.5; D4 |
| Os campos atrás de **Edit**; dependências pelo título, nunca pelo id | `discussion.md` §5.6; D2 |
| Pedir mudanças é pela conversa; a revisão é o marco `Drafts revised` e a etiqueta `Revised`; uma rodada nova dobra a anterior num marco | `discussion.md` §4, §7; D7 |
| O cabeçalho é o do review, com a pílula `Discussing` ou `Round N`; **Archive…** e **Delete discussion…** no `⋯`; **Archive…** também na barra de encerramento | `discussion.md` §3, §11; D12 |
| A barra do pedido de `discussion.md` §8, com os textos e as variantes da task 8; **Retry** da sessão | `discussion.md` §8; D11, D13 |
| O documento é um marco de uma linha; `Documents` fechado e sem trocar sozinho | `discussion.md` §4, §10; D9 |
| A página do item que saiu | `discussion.md` §11; D14; `structure.md` §1 |

### 4.2 Decisões de design, detalhadas

#### O início: do board e da Home

**Os caminhos** (`board.md` §2.3, §3.6; `tasks/05-board.md` §4.2): **New discussion** `N` no cabeçalho do board, sem cards; **Discuss** `D` no painel do card ou na linha, com o card; **Discuss N cards** `D` no modo de seleção; **New discussion** da Home e do menu **+ New**, com o campo **Board** quando o lugar não tem board e há mais de um. A task 5 deixa o campo **Board** pronto no diálogo de hoje (`features/discussion/NewDiscussionDialog.tsx`, com o `Select` do system); esta task troca o resto do diálogo e mantém o campo como a 5 o fez.

**O diálogo** é o `Dialog` do system, largo (`--size-dialog-wide`, 576 px), a `8vh` do topo, crescendo para baixo, título `New discussion` com o `×` (`Close · Esc`). O corpo, com `--space-4` entre as partes, de cima para baixo:

| # | Parte | Forma |
|---|---|---|
| 1 | **O board** | Da Home e do **+ New** fora de um board, com mais de um board: o campo **Board** da task 5 (o foco começa nele). Do board, ou com um board só: a linha afundada de card de entrada (`components.md` Linha afundada) com o ícone `board`, o título em 500 e `acme · project 7 · api, billing, docs, gateway, web` em `--ink-3` (o dono, `project <número>` e os nomes curtos dos repositórios do board em ordem alfabética, cortado com tooltip) |
| 2 | **Title** | Rótulo visível, obrigatório, `Input` de uma linha. Sugerido com o título do card quando há um card só (`suggestedTitle`, `new-discussion.ts:22`). Contado por ponto de código, como o Go (`service.go:199`) e a linha do contexto. A partir de 100, a ajuda `104 of 120` em `--ink-3`, tabular; acima de 120, `Use at most 120 characters.` em erro, `aria-invalid`, e o campo continua aceitando o texto (hoje `maxLength` corta: sai, para o erro dizer o que fazer) |
| 3 | **What to discuss** | Textarea de três linhas que cresce até nove; o complemento do rótulo em `--ink-3` diz `optional with cards` com algum card, e `or pick cards on the board` sem nenhum. `Ctrl+Enter` confirma dali, como de todo o diálogo |
| 4 | **Cards** `2` | Só com cards. Rótulo `Cards` com o número em `--ink-3`; uma linha por card, na lista contornada por `--line-1`, com `--size-control`: `#455` em mono `--text-meta` `--ink-3`, o título cortado com tooltip, o repositório curto em `--ink-3` (`acme/billing`) e `×` (fantasma de ícone `xs`, `Remove #455 from the discussion`). Tirar o último card não fecha nada: o complemento de **What to discuss** passa a `or pick cards on the board` |
| 5 | **A linha do contexto** | A linha afundada "Contexto montado" (`components.md`), sempre. Com cards: `From the cards: #455, #461, the epic Usage-based billing, 4 cards of the epic and 1 dependency · 5,690 characters` (`From the card: #474, …` com um). As partes, na ordem: os números dos cards; os épicos distintos dos cards (`the epic <título>`, `2 epics`); os irmãos distintos, fora os cards escolhidos (`4 cards of the epic`, `1 card of the epic`, `6 cards of the epics`); as dependências distintas, fora os cards escolhidos (`1 dependency`, `2 dependencies`); separadas por `, ` e com ` and ` antes da última, sem vírgula antes dele. Sem cards: `From the board and your text · 1,240 characters`. Os caracteres são os do texto de `DiscussionContext` (`store/actions.ts:763`), contados por ponto de código, com o separador de milhar em inglês; enquanto o texto não chegou, a linha fica sem a contagem. **Show** (fantasma `xs`, `aria-expanded`) abre sob a linha o texto em Markdown, somente leitura, numa caixa contornada por `--line-1` com altura de até nove linhas de `--leading-body` e rolagem, focável (`The context of the discussion`); **Hide** fecha. A releitura dos cards de mais de 5 minutos (a de hoje, `DiscussionContextPreview.tsx:43–67`): a linha diz `Refreshing the cards…` com o brilho e **Show** fica tracejado com `The cards are being read again.`; uma falha diz `◇ Couldn't refresh the cards: <motivo>. The discussion will use the last reading.` em `--ink-2`, e a linha com as partes volta embaixo |
| 6 | **Os repositórios sem clone** | Uma faixa de aviso (`components.md` Faixa de aviso, variante sob uma linha, sem fundo vermelho) por repositório do board sem clone ou com o clone inexistente, na ordem do board: sem clone, `◇ acme/billing isn't cloned. The conversation reads the code of the cloned repositories only.` com **Clone** (fantasma `xs`, ícone `clone`); clonando, `Cloning acme/billing…` com o spinner (`role="status"`); o clone que falhou, a mensagem do `gh` em `--state-error` e **Try the clone again**; o clone inexistente, `◇ The clone of acme/api at ~/code/api is missing. The conversation reads the code of the cloned repositories only.` com **Change path…**, e a recusa do **Change path…** em `--state-error` embaixo. Clonar não é obrigatório, e um clone em andamento continua depois de o diálogo confirmar |
| 7 | **Model** | Rótulo `Model` e o `ModelPicker` de hoje, até a task 12, com `From Defaults` em `--ink-3` ao lado enquanto a escolha é a do padrão de discussão |

**O rodapé**: a razão à esquerda, ligada a **Start discussion** por `aria-describedby`; **Cancel** fantasma; **Start discussion** `Ctrl ↵`, a única primária. As razões, na ordem: `Write what to discuss or select at least one card.`; `Name the discussion to start it.`; `Use at most 120 characters.`; `Choose a board.` (o campo da task 5 sem board lido). Iniciando: **Start discussion** diz `Starting…` com o spinner (`aria-busy`), **Cancel** e o `×` tracejados, `Esc` inerte, os campos somente leitura, e o rodapé diz `Starting the conversation…`. Uma falha fica no rodapé em vermelho com o diálogo aberto, e **Start discussion** volta, que é o repetir: as recusas de `Start` (`discussionflow/start.go`) com as frases de hoje, as mesmas da criação de task (`tasks/05-board.md`): `The board hasn't been read yet.`, `This card isn't in the last reading of the board.`, `acme/ios isn't managed by this board.` (`board/refusal.go:42`); e a sessão que não começou com ` The discussion was undone.` no fim quando o apagamento deu certo (`Claude Code isn't logged in. The discussion was undone.`), o dado novo P22c, como o P22b da criação de task. O board que sai com o diálogo aberto: o corpo dá lugar a `This board is no longer in the app.`, **Start discussion** fica tracejado com a mesma frase, e resta **Cancel**. Criada, o diálogo fecha e a discussão abre na área principal, com o foco no título (o `h1` com `tabindex="-1"`, como a página que saiu).

**Teclado e foco**: abre no primeiro campo (o **Board**, senão **Title**); `Ctrl+Enter` confirma de qualquer ponto, também das áreas de texto; `Esc` fecha o `listbox` aberto e depois o diálogo; `Ctrl+N`, `Ctrl+J` e `Ctrl+,` ficam inertes.

#### O cabeçalho, a pílula e o `⋯` (D12)

**O layout** é o do review (`tasks/06-review.md` §4.2, A tela do review): o cabeçalho, a conversa na coluna de `--measure-conversation`, a barra, o compositor, e o painel à direita pela regra do painel do item. Não há faixa de aviso própria da discussão.

**O cabeçalho**: `←` (tooltip com o destino), `→` só com destino, o breadcrumb `Platform Roadmap /` (abre a visão do board; numa discussão de um board removido, `No board /`), o título em `--text-body` 600 cortado com tooltip, a pílula, e à direita o medidor de contexto (o `ContextMeter`, só com a sessão), **Pause** ou **Resume** (o da task, com `item: "the discussion"`, só com a sessão), o grupo de painéis **Details** (ícone `details`, tooltip `The board, the cards, the repositories read, the rounds`) e **Documents** (ícone `file`, `The context and the document of the discussion`), e o `⋯` (tooltip `Group drafts into an epic, archive, delete`). O topo cede pelos limites da task: 1660 o breadcrumb, 1440 os painéis só com o ícone, 1360 **Pause** só com o ícone, 1300 o medidor só com a porcentagem, 1040 a palavra da pílula. **Pause**: tooltip `Pause the discussion · the session stops`; **Resume**, `Resume the discussion · paused since 14:52`; com a sessão parada num erro, **Pause** tracejado com `Nothing is running to pause: the session stopped with an error. Retry it.`

**A pílula** é a `Pill` do system sozinha, dentro de um `Stepper` de uma etapa, com `aria-current="step"`: o nome `Discussing` (sem posição) antes dos primeiros rascunhos legíveis, e `Round` com a posição `N` (a rodada atual, P25) depois.

| Momento | Pílula sem barra | Glifo |
|---|---|---|
| Agente trabalhando | `Discussing` · `working`, `Round 2` · `working` | spinner |
| Uma corrida em curso, sem situação (a situação que espera fica de pé durante a corrida, task 8) | `Round 1` · `publishing` | spinner |
| Sem situação, parada (antes dos rascunhos, ou ociosa sem pedido) | `Discussing`, `Round 1` | nenhum |
| Pausada | a pílula neutra · `paused` | duas barras |
| Qualquer situação | O nome e o glifo da gravidade, sem palavra (a barra a diz) | disco âmbar; losango vermelho no erro de sessão e em `Publish failed`; anel verde em `Ready to archive` |

Nome acessível e tooltip iguais: `Progress · Round 1 · waiting for you: decide drafts`, `Progress · Discussing · Discussion agent working`, `Progress · Round 1 · publishing`, `Progress · Round 1 · error: publish failed`, `Progress · Round 3 · ready to archive`, `Progress · Round 1 · paused since 14:52`. Carregando (a primeira leitura da discussão): o nome com brilho. É uma parada de Tab, sem ação.

**O `⋯`** (o `TaskMenu` da task com os itens da discussão), com a legenda `Discussion`:
- **Open Platform Roadmap** (ícone `board`), que abre a visão do board; sem o board, o item sai;
- **Group drafts into an epic…** (ícone `epic`), habilitado com dois ou mais rascunhos de card da rodada atual soltos (`Loose()`), não começados e não descartados; sem eles, desabilitado com `· needs two loose drafts not published`; com uma corrida em curso, `· a publication is running`;
- **Archive…** (ícone `archive`), desabilitado com a razão de `ArchiveHint` da task 8 depois de `·`, em minúscula e sem ponto (`· a publication failed: Retry it, or discard the draft`, `· a publication is running`, `· the epic can't publish: approve one more card, or discard the epic` e as outras variantes, `· approved drafts wait to be published`);
- depois de um separador, **Delete discussion…** em vermelho; com uma corrida em curso, desabilitado com `· a publication is running`, porque o Go recusa (`delete.go:64`).

`Ctrl+E` não existe na discussão (não há worktree).

#### A conversa e os marcos (D7, D9, D10; P10)

É a conversa da task 4 (`Conversation`, com `stage=DISCUSSION_STAGE`), com a voz `Discussion agent` na faixa de quem fala e `agent` nas frases do compositor. Pergunta em cartão, pergunta em texto com a resposta rápida, permissão, bloco de erro, fila e grupos de ações seguem a task. Os marcos da discussão, cada um uma linha do marco em linha (`components.md` Marco em linha), com a hora só em hover e foco:

| Marco | Texto | Quando entra | Abre |
|---|---|---|---|
| Início (`discussion_started`) | `Discussion started · Opus 5.5 (1M) · high · Platform Roadmap` (o modelo e o esforço gravados no início, o título do board); numa discussão anterior à task, sem o modelo e o esforço | Ao criar | — |
| Contexto (a mensagem que abre a sessão, `UserEntry.Prompt`) | `Context · #455, #461 and their epic · 5,690 characters`: os números dos cards de entrada, ` and its epic` com um card e um épico, ` and their epic` com mais cards e um épico, ` and their 2 epics`; com mais de três cards, `#455, #461, #470 and 2 more cards, with their epic`; sem cards, `Context · the board and your text`; numa discussão anterior à task, sem os épicos gravados, a parte do épico sai; e os caracteres do texto | Ao criar, logo depois do início | O contexto montado em Markdown, com **Open in Documents** ao pé |
| O que o usuário escreveu | A mensagem do usuário, `You` e o texto de **What to discuss**, derivada do `text` da discussão, com a hora do contexto; sem texto, nada | Logo depois do contexto | — |
| Documento (`discussion_document`) | `Written discussion.md · the understanding`; uma reescrita, `Updated discussion.md · the understanding` | Quando a avaliação vê o documento pela primeira vez ou com outro carimbo (data e tamanho) | O documento no registro de leitura, com **Open in Documents** e o tamanho (`3,612 characters`) ao pé. Só o marco mais recente abre; os anteriores ficam sem conteúdo |
| Rascunhos escritos (`drafts_written`) | `Drafts written · round 1 · 5 drafts` | A primeira leitura legível de uma rodada | — (o cartão vem logo depois) |
| Rascunhos revisados (`drafts_revised`) | `Drafts revised · round 1 · 3 changed`; as partes `N changed`, `N added`, `N dropped`, as que houver, por `, ` | Uma leitura que muda a rodada atual | A lista de antes da revisão, uma linha por rascunho da rodada como estava, com o ícone de lápis quando mudou: o título de antes e o que mudou, que é a diferença campo a campo entre o guardado e o reconciliado (`title`, `body`, `repository`, `module`, `epic`, `dependencies`, `cards` num épico, `kind`, `card`, por `, `; `dropped by the agent`), também quando a leitura não substituiu o rascunho e só tirou o épico ou uma dependência dele, ou mudou os cards de um épico, e depois `· your approval was cleared` no que era aprovado e perdeu a aprovação, `· approved` ou `· discarded` no que não mudou, `· Created billing#479` no publicado; `not changed · approved` quando nada mudou; e no fim os acrescentados, `added · <título>` |
| Rascunhos ilegíveis (`drafts_unreadable`) | `drafts.md can't be read · Draft invoice-overage: it has no ### Title.` (a razão de `discussion.Reason`, §4.4) | Quando a leitura falha e o último marco de rascunhos da conversa, de qualquer tipo, não é um ilegível com a mesma razão | — |
| Publicação da rodada (`drafts_published`) | `Published · round 1 · 2 so far` enquanto algum rascunho da rodada não está no GitHub nem descartado; `Published · round 1 · 4 created, 1 updated` quando todos estão (`· 1 created`, `· nothing published` não existe: sem publicação não há marco); com uma falha de pé, `Publication stopped · round 1 · 3 published · Overage on the monthly invoice failed` (sem nada publicado, a parte `3 published` sai; com mais de uma falha, `… and 1 more failed`), com o losango e o trilho de erro. A hora, em hover, é o intervalo da primeira à última publicação da rodada (`14:29 – 15:12`) | Na primeira publicação ou falha da rodada; o texto e a lista vêm dos rascunhos da rodada, então o marco se atualiza sozinho | A lista da rodada na ordem do cartão, uma linha por rascunho: o glifo, `Epic · `/`Update gateway#461 · ` e o título, e à direita `Created billing#479` (link externo), `Publishing…`, `Next` (o aprovado no instante antes da corrida), o `hold` da task 8 na forma curta (`Waits for the epic`, `Waits for <título>`, `Waits for 2 more cards of the epic`, `The epic needs two approved cards`, `The epic is discarded · not published`), `Can't publish · the repository left the board`, `Discarded · not published`, `Not decided`, ou a razão da falha em vermelho |
| Rodada dobrada | `Round 1 · 5 drafts, revised once · 4 created, 1 updated` (`revised twice`, `revised 3 times`; sem revisão, a parte sai; `nothing published` quando nada foi) | Quando a rodada seguinte existe | A lista da rodada com os links, os descartados como `Discarded · not published` |

**A rodada dobra** quando a discussão tem uma rodada maior: o marco de publicação dela vira o marco `Round N` no mesmo lugar, e o `Drafts written`, os `Drafts revised` e o cartão dela saem da conversa; sem marco de publicação (tudo descartado), o `Drafts written` dela vira o `Round N`; sem nenhum dos dois (uma rodada de uma discussão anterior à task), o `Round N` derivado entra logo antes do `Drafts written` da rodada seguinte. A dobra é derivada no frontend dos rascunhos da rodada (P25), que ficam guardados (§4.4), e dos marcos; o Go não grava marco de dobra. `drafts.md can't be read` fica onde está.

**Sem hora no texto.** O intervalo `14:29 – 15:12` de `discussion.md` §4 vai para o lugar da hora do marco, em hover e foco, pela decisão da conversa (`decisions.md` 2026-09-25): nenhuma hora no texto de um marco.

**Uma discussão anterior à task**: sem marcos além do início; o contexto e a mensagem do usuário aparecem pelas regras acima (derivados), sem a parte do épico no `Context`; os rascunhos que ela tem são da rodada 1 (a `0024`); o cartão da rodada atual vai para o fim da conversa enquanto ela não tem `Drafts written`; e uma rodada sem marco dobra pela regra acima, antes do `Drafts written` da seguinte.

**Estado vazio.** Antes da primeira fala do agente, a atividade `Starting session…`. Lendo a conversa (a primeira vez), `Loading the conversation…` e o esqueleto de três entradas.

#### O cartão dos rascunhos (D1, S10)

O cartão neutro (`components.md` Cartão neutro, o `DecisionCard` da task 6): na conversa, logo depois do marco mais recente da rodada atual (`Drafts written` ou `Drafts revised`), `--surface-2` com `--shadow-xs`, raio `--radius-lg`; o cabeçalho `Round 1 · drafts` e o número de rascunhos em `--ink-3`. É uma parada de Tab (`role="group"` `Drafts of round 1`), com roving tabindex entre os rascunhos. Só a rodada atual tem cartão.

**A ordem**: os grupos de épico pela posição do épico, cada um com o rascunho do épico e embaixo os seus cards, recuados sob uma guia de `--line-2` (`--list-indent`), e depois os soltos pela posição. O número (`1`, `2`…) é o da ordem na tela, em mono `--text-micro` `--ink-3`, na coluna de `--key-size`, alinhado à direita.

**O atual**: ao abrir a tela, o primeiro por decidir; depois, o que a navegação ou a decisão levou; `Show` e a chegada o escolhem. Um rascunho aberto por clique vira o atual. Sem nada por decidir, nenhum abre sozinho: todos ficam dobrados até um clique. Só o atual fica aberto (e o que está em edição, que é o atual).

**O dobrado** (`components.md` Rascunho dobrado), duas linhas de `--text-ui`, com hover `--veil-hover`, foco com o anel por fora, pressionado `--veil-press`, o atual com `--brand-ring`:

| Linha | Conteúdo |
|---|---|
| 1 | A etiqueta do tipo (`New card`, `Epic`, `Update`), `Revised` com o lápis quando é o caso, o título em 500 cortado com tooltip (`--ink-3` no descartado), e à direita o estado curto (a tabela do estado); `Not decided` em `--ink-3` sem decisão |
| 2 | Em `--text-meta` `--ink-3`, por ` · `: o repositório (`acme/billing`), o módulo, `3 cards` num épico, `Now: <título no GitHub>` numa atualização cujo título muda, o épico existente (`In billing#478 Pricing tiers…`), `Depends on <títulos>` e `1 warning` (`2 warnings`); uma linha só, cortada com tooltip |

Clique, `Enter`, `↑` e `↓` o abrem. `A`, `D` e `E` não agem nele. Nome acessível: `Draft 3 of 5: New card. Overage on the monthly invoice. acme/billing, Billing. Approved, waits for the epic.`

**O aberto** (`components.md` Rascunho), `--surface-2` com anel `--line-2` e `--brand-ring` no atual, a grade `número | corpo`:

| Parte | Forma |
|---|---|
| Tipo | A etiqueta neutra (`New card`, `Epic`) ou `Update` e a referência do card como link externo (`gateway#461`, tooltip `Open gateway#461 on GitHub`); `Revised` com o lápis, tooltip `The agent revised this draft. The earlier version is in the marker Drafts revised.` |
| Título | `--text-ui` 600, o do épico em `--text-body` 600; descartado, `--ink-2`. Um rascunho sem título (um épico agrupado antes da task) diz `Untitled epic` em `--ink-3`, nunca o id |
| Campos | Uma linha em `--text-meta` `--ink-3` por ` · `: o repositório, o módulo, `3 cards` num épico, `In <épico existente>` e, numa atualização, o que ela muda no card além do corpo: `Now: <título atual>`, `Module now: <valor>` (`none`), `Epic now: <referência e título>` (`none`), cada um só quando difere (o `Current:` de hoje, `DraftCard.tsx:80–83`) |
| Dependências | Uma linha: `Depends on` e os títulos por `, `, cada um um link em `--brand-ink`: um rascunho da rodada atual abre aquele rascunho no cartão (vira o atual, rola ao centro); um rascunho de uma rodada fechada e um card do GitHub abrem a issue (seta externa); uma dependência registrada no GitHub tem o tooltip `Linked on GitHub`. Só as dependências que não saíram: a que saiu (`Dropped`) fica no aviso. Numa atualização, depois delas, `· On GitHub: #455, #470` em `--ink-3` com as dependências que o card já tem e o rascunho não diz. Nunca o id |
| Avisos | Um por linha, `◇` e o texto em `--ink-2`: `acme/status-page is no longer managed by the board.` (o repositório fora do board, derivado de `repositoryId` vazio), e os `warnings` do Go (`The dependency on <título> is no longer among the drafts.`, `The epic <título> is no longer among the drafts.`, `The dependency on <título> was discarded and dropped.`, `Couldn't record the dependency on <título>: <o que o gh disse>`, `The module <x> is no longer an option of the board.`); numa atualização, `This card isn't in the last reading of the board.`, `Refreshing the card…` com o brilho (`role="status"`) e `Couldn't refresh the card: <motivo>. The draft shows the last reading.` (a releitura de hoje, `DraftCard.tsx:142–162`) |
| Corpo | Depois de um fio `--line-1`: o corpo inteiro em `Markdown` no registro de leitura, com os títulos do corpo (`## Context`) em `--text-ui` 600, menores que o título do rascunho, que se lê primeiro. Numa atualização, o controle segmentado `sm` **Body** / **Changes** `+4 −1` acima do corpo (`--brand-tint` no escolhido, `components.md` Controle segmentado), e **Changes** mostra o diff neutro (`DraftDiff` refeito: a acrescentada sobre `--veil-hover` em `--ink-1` com `+`, a retirada riscada em `--ink-3` com `−`, `Added:`/`Removed:` ocultos). Os dois continuam depois da publicação |
| A linha do gesto | A linha afundada com o ícone da cadeia (quando o gesto publica mais de um rascunho, ou **Discard** publica algo) ou da ampulheta, só num rascunho sem decisão e não começado, e só fora de uma corrida e da edição. Os textos na seção seguinte. É a descrição acessível de **Approve** |
| A decisão | **Approve** `A` (ícone visto) e **Discard** `D`, secundários `sm` que alternam (`aria-pressed`, `--brand-tint` no ativo); ao lado, o estado (a tabela seguinte) e, com uma decisão, `click again to undo` em `--ink-3`; **Edit** `E`, fantasma `xs`, à direita (tooltip `Edit the title, the body and the fields · E`). Sai inteira num rascunho começado, que só tem o estado e a saída pelo GitHub |

**O estado** (`discussion.md` §5.3), no aberto ao lado da decisão e no dobrado à direita:

| Caso | Aberto | Dobrado |
|---|---|---|
| Sem decisão | — (a linha do gesto diz o que acontece) | `Not decided` |
| Revisado com a aprovação limpa (`approvalCleared`) | `Revised · your approval was cleared` | `Revised · approval cleared` |
| Aprovado esperando | `⧗ Approved · waits for the epic` e as outras formas de `holdLabel` (task 8) | igual, cortado com tooltip |
| Épico sem dois cards, card de épico descartado | `holdLabel` em `--ink-1` 500 | igual |
| Aprovado que vai na corrida, no instante antes dela | `Approved · publishing next` | igual |
| Publicando | o spinner e `Publishing…` (`role="status"`) | igual |
| No GitHub | `✓ Created billing#479 · 15:10` (a referência curta como link externo; a hora de `publishedAt`, `Sep 23` quando não é de hoje; `Updated gateway#461` numa atualização) e, embaixo, `To take it back, close billing#479 on GitHub.` (`edit gateway#461` numa atualização) em `--ink-3` | `✓ Created billing#479 · 15:10` |
| Falhou | `◆` e a razão da task 8 (`publishError`, uma das dez de `features.md`, sem prefixo) em `--state-error`, e **Retry** primária `sm` ao lado (tooltip `Goes on from this draft; nothing is created twice`; `Retrying…`; com uma corrida em curso, tracejado com `A publication is running`, porque o Go recusa: `Retry`, `decide.go:160`, passa por `edit`, 82–99), com o trilho de erro no rascunho; começado antes da falha, o `✓ Created …` fica acima | `◆ Couldn't write to GitHub · open it to Retry`, com o trilho |
| Descartado | `Discarded` | `Discarded` |
| Bloqueado pelo repositório | — (a linha do gesto diz) | `◇ Can't publish · choose a repository` (numa atualização, `◇ Can't publish · the repository left the board`) |

#### A linha do gesto (D4; F16)

Vem do Go (`approvePublishes`, `discardPublishes` e `approveHold`, §4.4), na ordem da corrida. Os nomes: o próprio rascunho é `this card` (um card ou uma atualização) ou `the epic` (um épico); o épico do próprio rascunho é `the epic`; outro épico é `the epic <título>`; o resto, pelo título; juntos por `, ` e ` and ` antes do último.

| Caso | A linha |
|---|---|
| **Approve** publica | `Approve publishes this card to GitHub now.`; numa cadeia, `Approve publishes the epic, Tier limits and overage prices, Overage on the monthly invoice and this card to GitHub now.` |
| E **Discard** também publica | Acrescenta ` Discard publishes the epic, Tier limits and overage prices and Overage on the monthly invoice now.` (o último card por decidir de um épico com dois aprovados) |
| **Approve** não publica nada ainda | `Approve publishes nothing yet: ` e, pelo `approveHold`: `epic` → `this card waits for the epic.`; `draft` → `this card waits for <título>.`; `cards` → `the epic waits for 2 more cards of the epic to be decided.` (`this card waits for …` num card do épico); `epic_short` → `the epic needs two approved cards · 1 of 3.` (`· the epic has no cards.` sem cards) |
| O épico está descartado | `Approve publishes nothing: the epic is discarded, so this card won't publish.` |
| O repositório saiu do board | `Can't publish: choose a repository of the board in Edit.`; numa atualização, `Can't publish: acme/gateway is no longer managed by the board.`; **Approve** tracejado, com a linha como razão |
| Sem título | Sem a linha; **Approve** tracejado com `Name the draft to approve it.` |

A linha fica em `--text-meta` `--ink-2` sobre `--surface-0`, raio `--radius-sm`, com o ícone de `--icon-sm` em `--ink-3`; os nomes de **Approve** e **Discard** em 600.

#### A decisão, a tecla repetida e o desfazer (D4, D6)

- **Um gesto que publica** (a linha diz que **Approve**, ou **Discard**, publica algo agora) mantém o foco no próprio rascunho: ele passa a `Approved · publishing next`, depois a `Publishing…` e a `✓ Created …`, e a decisão sai.
- **Um gesto que não publica nada** leva o foco ao próximo por decidir depois dele, com volta ao começo, que abre no lugar e rola ao centro (`block: "center"`), ou pelo topo quando é mais alto que a conversa, com o tipo e o título à vista; sem nenhum, o foco fica.
- **A trava**: depois de qualquer decisão, `A`, `D` e o clique em **Approve** e **Discard** de qualquer rascunho ficam inertes por 900 ms; a repetição da tecla segurada (`event.repeat`) nunca decide. Um duplo clique é uma decisão só.
- **Desfazer**: a tecla ou o clique na decisão ativa a desfaz, enquanto o rascunho não começou e fora de uma corrida; não avança.
- **Desabilitada com a razão** (os dois botões tracejados, a razão no lugar do estado, por `aria-describedby`): com uma corrida em curso, `A publication is running · the decision waits for it` (um aprovado que está na corrida mostra o estado, não a razão); em edição, `Finish editing to decide`; sem título e bloqueado, só **Approve**, com as razões da linha do gesto. O **Retry** de um rascunho que falhou e **Delete discussion…** também ficam desabilitados durante a corrida, com `A publication is running`. O Go continua recusando com `ErrPublishing` no instante da corrida; a recusa vai ao aviso do app, como hoje.
- **A saída depois de publicar** é o GitHub: `To take it back, close billing#479 on GitHub.`

#### Editar (D2, D15)

**Edit** ou `E` abre, no lugar do título, dos campos e do corpo, com o foco em **Title**:

- **Title**: `Input`, salvo enquanto se digita (`useDraftText`), nunca vazio: vazio, `Write a title.` em erro e o último salvo fica (`ErrEmptyText`);
- **Body** `Markdown`: textarea em mono de seis linhas que cresce até `--size-composer-max`, salvo enquanto se digita; vazio, `Write the body.` em erro e o último salvo fica, salvo num épico do usuário, que aceita o corpo vazio (D19);
- **Repository**, **Module** e **Epic**, lado a lado, cada um o `Select` do system com o valor cortado com tooltip: **Repository** com os repositórios do board (num rascunho bloqueado, o valor atual com `· not on the board`, fora da lista; numa atualização, texto fixo `acme/gateway · the card's repository`); **Module** só num board com o campo, com `No module` e as opções, nunca num épico; **Epic** só num card, com `No epic`, os épicos da rodada atual pelo título e, depois de um separador, **Existing issue…**, que abre embaixo o campo `owner/name#N` (`Enter` grava, `Esc` fecha; a recusa em vermelho sob ele);
- **Depends on**, só num card: as dependências como chips com `×` (`Remove the dependency on <título>`; uma já registrada no GitHub não tem `×`, e o chip diz `on GitHub` no tooltip), e **Add a dependency** (fantasma `xs`, ícone `plus`), que abre o `DependencyPicker`: um `listbox` com a busca no alto (`#474 or a title`, com o foco), o grupo `Drafts of this discussion` (os cards da rodada atual, fora o próprio, pelo título, com o repositório em `--ink-3`), o grupo `Cards of the board` (os cards da última leitura do board, `#474 Usage alerts at 80% of the plan`, filtrados pela busca, até 20, `No card matches.`), e, quando a busca é um `dono/nome#N` que nenhum item tem, o item `Depend on acme/api#99`. O escolhido tem o visto (`aria-selected`), e escolhê-lo de novo o tira (salvo o registrado no GitHub). Uma recusa (`ErrInvalidRef`: ele mesmo, repetido) fica em vermelho sob o campo;
- embaixo, `Saved as you type. The agent's next revision of this draft replaces your edits.` e **Done** (fantasma `xs`); num aprovado, antes dela, `Changing the repository, the epic or a dependency clears the approval.` em `--ink-3`.

`Esc` e **Done** fecham e devolvem o foco ao rascunho. Com uma corrida em curso, **Edit** fica tracejado com `A publication is running` e uma edição aberta fica somente leitura. Um rascunho começado não tem **Edit**. Uma revisão do agente que muda o rascunho em edição fecha a edição com o texto novo; uma que não o muda deixa a edição aberta.

#### Agrupar em épico (D8)

**Group drafts into an epic…** abre o `Dialog` do system mínimo, `Group drafts into an epic` com o `×`:
- **Title of the epic**, obrigatório, placeholder `What the cards deliver together`, com o foco; acima de 256 caracteres por ponto de código, `Use at most 256 characters in the title of the epic.`;
- **Drafts** `two or more, loose and not published`: uma linha que marca por rascunho elegível (o `Checkbox` do system, variante linha), com o título e o repositório em `--ink-3`, os dois primeiros marcados;
- **Repository of the epic**: o `Select` com os repositórios do board, vindo no repositório mais comum entre os marcados (empate, o primeiro por `dono/nome`), e que segue a marcação até o usuário escolher um.

O rodapé: a razão (`Name the epic to group the drafts.`; `Pick two drafts or more.`), **Cancel** e **Group 2 drafts** (primária, `Ctrl ↵`; `Grouping…`). Uma recusa do Go no rodapé em vermelho, com as frases dos sentinels próprios (`Name the epic to group the drafts.`, `Use at most 256 characters in the title of the epic.`, `One of the drafts can't go into an epic anymore.`, e a da `board.Refusal` do repositório, `acme/ios isn't managed by this board.`); com uma corrida em curso, `A publication is running.` Agrupado, o diálogo fecha, o épico novo entra no cartão como grupo, vira o atual (aberto, sem decisão) e recebe o foco. Mover um card para dentro ou para fora de um épico continua pelo **Epic** de **Edit**.

#### Pedir mudanças e a rodada nova (D7; P24, P25)

**Pedir mudanças** é pelo compositor, com a pastilha **Ask for changes** (seção do compositor). A revisão do agente é reconciliada como hoje (o que não mudou mantém decisão e edições; o que mudou perde as duas; o publicado nunca muda) e é dita uma vez: o marco `Drafts revised`, a etiqueta `Revised` nos que mudaram na última revisão, e `Revised · your approval was cleared` no que era aprovado.

**A rodada** (P25): uma leitura que muda os rascunhos abre a rodada seguinte quando todo rascunho da rodada atual está no GitHub ou descartado; senão, é uma revisão da rodada atual. A rodada fechada fica como está: os publicados e os descartados dela não mudam nem saem numa leitura (salvo o id reusado pelo agente, §4.4). Os rascunhos novos ou mudados da leitura ganham a rodada nova, a pílula diz `Round 2`, a rodada anterior dobra, e vêm o marco `Drafts written · round 2 · 1 draft` e o cartão.

#### A barra do pedido (D11, D13; S8)

É a barra da task (`RequestBar` com o `RequestModel` compartilhado da task 6), no lugar de `DiscussionBar`. O lugar é `Discussing` antes dos rascunhos e `round N` depois, e o chip de tempo é o da situação. A barra fala da situação da discussão (`discussionSituation`), com a forma do status quando a situação não diz tudo (a pausa, a corrida).

| Situação (`kind`) | A barra diz | No meio | Ações | Variante | Foco na chegada |
|---|---|---|---|---|---|
| `question` | `● Question · round 1 18m` | `2 questions` quando há mais de uma | **Show** | quieta | A primeira opção sem escolha |
| `permission` | `● Permission · round 1 4m` | — | **Show** | quieta | **Allow** |
| `session_error`, sessão parada | `◆ Session error · Discussing !3m` | — | **Retry** (primária, tooltip `Opens the session again where it stopped`; `Retrying…`), que chama `retry(id, DISCUSSION_STAGE)` (P3) | erro | **Retry** |
| `session_error`, turno que falhou | `◆ Session error · round 1 !3m` | — | nenhuma: vai pelo compositor | erro | O compositor |
| `reply`, antes dos rascunhos | `● Waiting for reply · Discussing 2m` | — | nenhuma: vai pelo compositor, com a resposta rápida | tingida | O compositor |
| `reply`, artefato ilegível (`awaiting_drafts`) | `● Waiting for the drafts · round 1 1m` (`Discussing` antes de uma leitura boa) | `ask the agent to fix drafts.md below` | nenhuma: vai pelo compositor, com **Ask to fix the drafts** | tingida | O compositor |
| `drafts` | `● Decide drafts · round 1 6m` | `2 of 5 decided` (da rodada atual) | **Next to decide** `Alt ↓` (secundário, tooltip `The next draft to decide · Alt+↓`) | de decisão | O primeiro rascunho por decidir, aberto |
| `epic_cant_publish` | `● Epic can't publish · round 1 1m` | `standingDetail` da task 8 (`1 of 3 cards approved · approve one more, or discard the epic` e as variantes) | **Show** (tooltip `Go to the epic`) | tingida | O épico, aberto |
| `epic_discarded` | `● Epic discarded · round 1 1m` | `2 approved cards of it won't publish · approve the epic again, or discard them` (`1 approved card … discard it`) | **Show** | tingida | O épico, aberto |
| `publish_failed` | `◆ Publish failed · round 1 !1m` | `Stopped at Overage on the monthly invoice` (o primeiro que falhou pela ordem do cartão) | **Show** (tooltip `Go to the draft where the publication stopped; Retry is there`) | erro | O **Retry** do rascunho, aberto |
| `ready_to_archive` | `○ Ready to archive · round 1 1m` | `5 published · or ask the agent for more cards below`; com rodadas, `7 published in 3 rounds · …`; nada, `nothing published · …` | **Archive…** (primária) | encerramento | **Archive…** |
| Sem situação (trabalhando, publicando, parada) | Nenhuma barra | | | | |
| Pausada | A barra do status sem as situações da sessão: `Decide drafts`, `Epic can't publish`, `Epic discarded`, `Publish failed` ou `Ready to archive`, quieta, com as duas barras no lugar do glifo, sem chip; as mesmas ações | | | quieta | — |

**Show** abre o rascunho (vira o atual), rola ao centro e leva o foco a ele, ou ao **Retry** dele. **Next to decide** e `Alt+↓` fazem o mesmo com o próximo por decidir depois do atual, com volta. Quando a ação com o foco resolve a situação e some, o foco vai ao compositor. A barra é `role="region"` `Request`, o texto de estado `role="status"`, e a barra que nasce com a tela aberta pisca duas vezes no véu da gravidade e é anunciada (`Usage-based pricing tiers: waiting for you: decide drafts in round 1`). `situationLabel` e as linhas da árvore da task 8 ganham a rodada (a seção da árvore, abaixo).

#### O compositor (`discussion.md` §9)

O da task 4 (`Composer`), com o contexto da discussão em `composer.ts` (`who: "agent"`), o placeholder na primeira linha que vale:

| Momento | Placeholder | Pastilha |
|---|---|---|
| Pausada | `Sending resumes the discussion…` | — |
| Sessão parada num erro; turno que falhou | `Sending restarts the session…`; `Reply to the agent to go on…` | — |
| Pergunta, permissão, `Other…`, agente trabalhando | Os da task, com `agent` (`Answer with 1–3, or reply to the agent…`, `Queue a message for the agent…`) | — |
| Pergunta em texto com opções | `Answer a or b, or reply to the agent…` | A resposta rápida |
| Artefato ilegível | `Ask the agent to fix drafts.md…` | **Ask to fix the drafts** |
| A rodada atual com algum rascunho fora do GitHub e não descartado | `Ask for changes: add, change or drop a draft…` | **Ask for changes** |
| Pronta para arquivar | `Ask for more cards, or reply to the agent…` | — |
| O resto | `Reply to the agent…` | — |

**As pastilhas de começo de mensagem** (`components.md` Compositor): a pastilha contornada com o ícone de lápis, tooltip que diz o que acontece (`Starts the message: the agent revises the drafts and keeps your decisions on the ones it doesn't change`; `Starts the message: the agent rewrites drafts.md in the format MySpec reads`). Um clique põe no começo da caixa `Change the drafts: ` ou `drafts.md can't be read: <razão> Rewrite it in the format MySpec reads. ` (a razão de `unreadableDrafts`), a menos que a caixa já comece por ele, e leva o foco ao fim do texto. **Send** segue a regra da primária: primário com texto só quando a barra e os cartões não desenham uma primária (em `drafts`, a barra não tem primária, então **Send** com texto é a primária).

#### `Details` e `Documents` (D9; S9)

Fechados por padrão, nunca abertos sozinhos, um de cada vez, `Esc` fecha (`AuxPanel`).

**`Details`**, com `PanelSection` e `PanelRow` (a task 6 os leva ao system):
- **Discussion**: `Board` (o título como link que abre a visão do board, e `acme · project 7`); `Cards` (uma linha por card de entrada, `#455` e o título, link que abre o painel do card na visão do board quando o card está na leitura, e a issue no GitHub quando não está, como B13); `Read` (os repositórios com clone, por `, `); `Not cloned` (um por linha, com **Clone**, ou **Change path…** no inexistente, e `Cloning…`); `Model` (`Opus 5.5 (1M) · high`, o da sessão); `Started` (`Today 14:02`). Nada sem valor;
- **Rounds**: uma linha por rodada, a mais recente embaixo: `Round 1 · 5 drafts · 4 created, 1 updated` e à direita a hora da última publicação (`15:12`); a rodada atual por decidir, `Round 2 · 3 drafts · 1 created · 2 of 3 decided`; sem publicação, `Round 1 · 2 drafts · nothing published`; antes dos rascunhos, `No drafts yet` em `--ink-3`. As linhas não agem;
- **Documents**: `Context` e `Document · discussion.md`, que abrem o painel **Documents** naquele documento; antes do documento, `Document · written with the drafts`, desabilitado.

**`Documents`**: a lista (`Context`, `Document`), a escolhida em `--brand-tint-plane` (`aria-pressed`), e embaixo o documento escolhido em `Markdown` no registro de leitura. Abre em `Context` até o documento existir e depois em `Document`, só ao abrir; aberto, não troca sozinho, e mostra a versão atual do escolhido (`useDiscussionArtifact` com `documentRevision`). **Open in Documents** de um marco abre o painel no documento dele. Lendo: o esqueleto de três linhas; falhou: `Couldn't read the document` com a razão e **Try again**, `role="alert"`.

#### Arquivar, apagar e a página que saiu (D12, D14)

**Archive…** está no `⋯` e na barra de encerramento, e abre o `Dialog` mínimo, `alertdialog`, com o foco em **Cancel**:
- título `Archive “Usage-based pricing tiers”?`;
- `The conversation ends. The document, the drafts and what was published stay in History.`;
- a linha afundada `Published: 5 issues in round 1: 4 created, 1 updated` (`7 issues in 3 rounds: 6 created, 1 updated`; `Published: nothing`), e, quando há, ` · Not published: <títulos>` (os aprovados que não vão publicar e os sem decisão);
- `A task started from one of these cards gets the document in its context, also after the archive.` em `--ink-3`;
- rodapé: **Cancel** e **Archive** `Ctrl ↵` (primária; `Archiving…` com **Cancel** tracejado). Uma recusa (`ErrCannotArchive`, `ErrPublishing`) fica no rodapé em vermelho.

**Delete discussion…** abre o `Dialog` mínimo destrutivo, foco em **Cancel**: `Delete “Usage-based pricing tiers”?`; `The conversation, the document and the drafts go away, and the discussion doesn't go to History. What was published on GitHub stays: 5 issues.` (sem publicação, a última frase sai); `A task started from one of its cards loses the document in its context.` em `--ink-3`; **Cancel** e **Delete discussion** perigoso (`Deleting…`); uma recusa (`ErrPublishing`, uma corrida que começou com o diálogo aberto) fica no rodapé em vermelho, como no de arquivar. O History continua usando o mesmo componente para uma arquivada, que diz `The conversation, the document and the drafts go away.` sem a parte de History.

**A página da discussão que saiu** (`GonePage` com o texto e o bloco da task 6): arquivada, `Usage-based pricing tiers was archived`, o texto `The conversation ended at 15:15. The document, the drafts and what was published are in History; a task started from one of these cards gets the document in its context.` e o bloco com uma linha por rodada (`Round 1 · 4 created, 1 updated` e a hora da última publicação à direita; `Round 2 · nothing published`), lido de `ArchivedDiscussion.drafts` pela rodada; apagada, `Usage-based pricing tiers was deleted` e `The conversation, the document and the drafts are gone. What was published on GitHub stays.`, sem bloco. As ações e o foco são os da task 2 (**Next that needs you** `Ctrl J`, **Open in History** menos no apagado, **Open Platform Roadmap**).

#### A árvore

A linha da discussão é a da task 2 com as linhas da task 8, e a rodada: a posição é `Discussing` antes dos rascunhos e `Round R` depois (`position` e `conversationPlace` em `sidebar-tree.ts:260–269`, 295–325); `Decide drafts · Round 1 · 2 of 5` / `Decide drafts · 2/5`, contados na rodada atual como na barra (hoje contam todos, `sidebar-tree.ts:444–448`); `Epic can't publish · Round 1` / `Epic can't publish`; `Epic discarded · Round 1`; `Publish failed · Round 1`; `Question · Round 1`; `Ready to archive · 5 published`; publicando, `Round 1 · publishing` / `publishing`; o agente trabalhando, `Discussing` ou `Round 1` com o relógio; pausada, `Paused · Round 1`.

#### Os estados de toda tela (`discussion.md` §13)

| Estado | Nesta tela |
|---|---|
| **Vazio** | `Starting session…` antes da primeira fala; sem rascunhos, `Discussing` e sem cartão; `Details` diz `No drafts yet` |
| **Carregando** | A pílula com brilho, `Loading the conversation…` e o esqueleto; `Refreshing the cards…` no diálogo, `Refreshing the card…` numa atualização, `Publishing…` no rascunho, `publishing` na pílula e o spinner na árvore sem a linha 3; o esqueleto de `Documents` |
| **Erro** | Sessão: o bloco de erro e a barra com **Retry**. Publicação: o trilho e **Retry** no rascunho, `Publication stopped`, `Publish failed`. Artefato ilegível: o marco e `Waiting for the drafts`. Documento ilegível: o erro no painel. Uma ação sem lugar próprio que falha (decidir, editar, agrupar numa corrida): o aviso do app com o rótulo (`Couldn't decide Overage on the monthly invoice`, F19). Os erros dos diálogos no rodapé |
| **Aguardando o usuário** | A barra, o disco âmbar na pílula e na árvore; a barra que nasce pisca e é anunciada |
| **Agente trabalhando** | O grupo vivo, **Stop** e `Working · 1m 20s` no compositor, a linha 3 da árvore |
| **Pausado e ocioso** | Pausada: **Resume**, a pílula neutra com `paused`, o marco `Paused by you`, a barra quieta do status, `Sending resumes the discussion…`; o cartão continua decidindo e publicando, porque a publicação não depende da conversa (task 8). Ociosa: a próxima mensagem retoma |
| **Muitos itens** | 10 rascunhos numa rodada: dez dobrados de duas linhas e o aberto; uma conversa longa pelos grupos dobrados, pelas dobras de trecho e pelas rodadas dobradas |
| **Item que sumiu** | A página que saiu; sem a tela aberta, a discussão sai da árvore |
| **Todos descartados** | `Ready to archive` com `nothing published` |
| **O rascunho que saiu** | Uma revisão que tira o rascunho atual abre o próximo por decidir; o foco que estava nele vai ao cartão |

#### O teclado

| Tecla | Onde | Age |
|---|---|---|
| `A`, `D` | O rascunho aberto com o foco (nele ou num controle dele que não é campo) | Aprova, descarta; o avanço, a trava e o desfazer da seção da decisão |
| `E` | O rascunho aberto com o foco | Abre **Edit** |
| `Enter` | Um dobrado | Abre, e ele vira o atual |
| `↑` `↓` | Um rascunho do cartão | O anterior e o próximo, abertos; do primeiro e do último, continuam o percurso da conversa, para a entrada antes ou depois do cartão; vindo de fora, `↓` cai no primeiro e `↑` no último |
| `Home`, `End`, `Page Up`, `Page Down` | O cartão | Continuam o percurso da conversa |
| `Alt+↓`, `Alt+↑` | Qualquer ponto da tela fora de um diálogo, o compositor incluído, com algo por decidir | O próximo e o anterior por decidir, abertos, com o foco |
| `Ctrl+Enter` | Os diálogos de nova discussão, de arquivar e de agrupar | Confirma |
| `Esc` | Qualquer lugar | Fecha o `listbox` (as dependências, os seletores), o campo de **Existing issue…**, o menu, o diálogo, a edição, o painel, nesta ordem; com o foco na conversa, devolve o foco ao compositor |
| `1`–`9` | Pergunta ou permissão | Como na task |
| `N`, `D` | A visão do board | **New discussion**, **Discuss** (`board.md` §7) |
| `Alt+←`, `Alt+→`, `Ctrl+J` | Qualquer lugar | Como em `structure.md` §5 |

A ordem de Tab: o cabeçalho (`←`, `→`, o breadcrumb, a pílula, o medidor, **Pause**, os painéis, o `⋯`), a conversa (uma parada; o cartão é a entrada atual quando o foco chega nele, com o rascunho atual e os controles dele), a barra, o compositor, o painel.

#### A primária em cada cena

Conta a camada de cima: com um diálogo aberto, só o diálogo.

| Cena | A primária |
|---|---|
| `start`, `start?home` | **Start discussion** |
| `talk` | Nenhuma na barra; **Send** com texto |
| `talk?error` | **Retry** na barra |
| `unreadable` | Nenhuma; **Send** com texto |
| `drafts`, `rewrite`, `publish`, `many` | Nenhuma (**Next to decide**, **Approve** e **Discard** são secundários); **Send** com texto |
| `drafts?edit` | Nenhuma |
| `publish?after` | Nenhuma: nada espera o usuário, sem barra |
| `published`, `done` | **Archive…** na barra |
| `published?archive`, `done?archive` | **Archive** do diálogo |
| `partial-fail` | **Retry** no rascunho (a exceção de `structure.md` §3); a barra tem **Show** secundário |
| `epic`, `epic-off`, `archive-blocked` | Nenhuma (**Show** é secundário) |
| `many?group` | **Group 2 drafts** (tracejado até o título) |
| `?delete` | Nenhuma: **Delete discussion** é perigoso |
| A página que saiu | **Next that needs you**, ou **Open in History** sem nada esperando |

#### Acessibilidade

O cartão é `group` `Drafts of round 1`; o grupo do épico é `group` `Epic Pricing tiers with metered overage and its 3 cards`; cada rascunho é `group` com o nome da tabela do dobrado (aberto ou dobrado), com `aria-expanded`; a decisão `aria-pressed`; a linha do gesto é a `aria-describedby` de **Approve**; o estado enquanto publica e a releitura são `role="status"`. O controle **Body**/**Changes** é `radiogroup` `What to read`; o diff é `group` `Changes to the body`. O `DependencyPicker` é `listbox` `Depend on`, com a busca `combobox`. A barra é `region` `Request`. Os diálogos são `dialog` (nova discussão, agrupar) e `alertdialog` (arquivar, apagar), com `aria-labelledby`. Os testes acham cada peça por `getByRole` com esses nomes.

#### A prova

**Um ponto de parada operado pelo usuário, depois do step 10**, pela mesma razão da task 8 (`tasks/08-chained-publication.md` §4.2, A prova no GitHub: instância única pelo D-Bus e as tasks do usuário num diretório copiado): o MySpec instalado fechado, a task 9 pausada, o binário da branch (`task build`) sobre `XDG_DATA_HOME` e `XDG_STATE_HOME` vazios em `/tmp/myspec-proof-9`, só com o board `Pessoal` e os clones que existem. **Nenhuma escrita no GitHub**: tudo é descartado. O roteiro: **New discussion** sem cards, com uma demanda qualquer; responder até os rascunhos; conferir `Discussion started` com o modelo, `Context`, a mensagem do usuário, `Written discussion.md` e `Drafts written · round 1`; pedir uma mudança pelo **Ask for changes** e conferir `Drafts revised` e `Revised` (o prompt passa a pedir que o agente mantenha o id do rascunho que muda; se mesmo assim ele der um id novo, o marco diz `1 added, 1 dropped`, e a etiqueta fica provada pelas cenas); descartar todos pelo teclado (`D`, o avanço e a trava) e conferir `Ready to archive · nothing published`; pedir mais um card e conferir a rodada 1 dobrada, `Drafts written · round 2` e `Round 2`; descartar; **Archive…** e a página que saiu. O usuário entrega capturas de cada passo, e o implementador as registra na pull request. Limpar: fechar o app, `rm -rf /tmp/myspec-proof-9`, reabrir o instalado e **Resume** na task. A publicação em si foi provada pela task 8; aqui a tela a prova pelas cenas (pronto 5).

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | Quando uma leitura abre a rodada seguinte (P25 dizia "depois de uma publicação") | Quando todo rascunho da rodada atual está no GitHub ou descartado; senão é revisão da rodada atual | `backend.md` P25; `discussion.md` §7; `decisions.md` |
| 2 | Os descartados de uma rodada fechada saíam na leitura seguinte (`reconcile.go:28–32`), e a rodada dobrada perderia a lista | A rodada fechada não muda: os publicados e os descartados dela ficam; só um id reusado pelo agente muda de rodada | `backend.md` P25; `changes.md` D7; `decisions.md` |
| 3 | O marco `Round N` "na hora da última publicação" pedia reordenar a conversa, e um marco de dobra gravado | A dobra é derivada: o marco de publicação da rodada (ou o `Drafts written`, sem publicação) vira o `Round N` no lugar dele, e os outros marcos e o cartão da rodada saem | `discussion.md` §4 |
| 4 | O intervalo `14:29 – 15:12` e a hora no texto dos marcos contra "nenhuma hora no texto de um marco" (`decisions.md` 2026-09-25) | O intervalo vai para a hora do marco, em hover; o texto não leva hora | `discussion.md` §4 |
| 5 | `line 41:` no marco do artefato ilegível, que o leitor não sabe (`artifact.go` não conta linhas) | A razão do produto, sem a linha: `drafts.md can't be read · Draft invoice-overage: it has no ### Title.`; `discussion.Reason` como o `prreview.Reason` (R20) | `discussion.md` §4; `changes.md` D17 |
| 6 | O contexto como marco e **What to discuss** como mensagem, sem dizer de onde vêm | O contexto é a mensagem que abre a sessão, desenhada como marco; a mensagem do usuário é derivada do `text`; o Go grava no início o modelo, o esforço e os épicos | `backend.md` P10, P23; `discussion.md` §4 |
| 7 | O documento reescrito e o marco repetido a cada reinício | `Updated discussion.md` numa reescrita; o marco é gravado pelo carimbo do arquivo, que o transcript guarda, então um reinício não o repete | `backend.md` P10; `discussion.md` §4 |
| 8 | `Drafts revised · 3 changed` com rascunhos acrescentados e retirados | As partes `changed`, `added`, `dropped`; a lista de antes com o que mudou em cada campo | `backend.md` P24; `discussion.md` §4 |
| 9 | O `Current:` do módulo e do épico de uma atualização, sem lugar no desenho | Na linha dos campos: `Module now:` e `Epic now:`, como `Now:` do título | `discussion.md` §5.2 |
| 10 | As dependências `On GitHub` de uma atualização e o estado de cada dependência | `· On GitHub: #455` na linha; `Depends on` lista só as que não saíram, e a registrada no GitHub tem o tooltip `Linked on GitHub`; a que saiu, ou não pôde ser registrada, fica nos avisos, que o Go escreve | `discussion.md` §5.2; `changes.md` D22 |
| 11 | Os avisos do Go nomeiam rascunhos pelo id (`reconcile.go:12–13`, `publish.go:610–618`), e a leitura tira a aprovação sem substituir o rascunho em três casos da task 8 | Pelo título, com o título que o rascunho tinha; um card do GitHub por `dono/nome#N`. "Mudou" é a diferença campo a campo, com `cards` no épico: o mantido a que `normalize` tirou o épico ou uma dependência, e o épico mantido cujos cards mudaram, ganham `Revised`, `ApprovalCleared` se eram aprovados, e a linha no `Drafts revised` | `changes.md` D17; `backend.md` P24 |
| 12 | A dependência de uma issue fora do board, que hoje se escreve à mão | O item `Depend on acme/api#99` do `listbox` quando a busca é um `dono/nome#N` | `discussion.md` §5.6 |
| 13 | **Existing issue…** sumia do **Edit** | Fica no **Epic**, com o campo `owner/name#N` | `discussion.md` §5.6 |
| 14 | O corpo vazio do épico do usuário, que `SetDraftText` recusa (`service.go:295–304`) | O épico do usuário aceita o corpo vazio; o título continua obrigatório | `changes.md` D19; `discussion.md` §5.6 |
| 15 | A trava de 900 ms só para teclas, e o duplo clique "segue as mesmas regras" | A trava vale para as teclas e os cliques de decisão de todos os rascunhos, depois de qualquer decisão | `discussion.md` §5.5; `components.md` Rascunho |
| 16 | Os nomes da linha do gesto com dois épicos e com o próprio épico | `this card`, `the epic` (o próprio e o do rascunho), `the epic <título>` (outro); as frases de `approveHold` | `discussion.md` §5.4 |
| 17 | A linha do gesto de um card de épico descartado e de uma atualização de repositório fora do board | As frases da §4.2 | `discussion.md` §5.4 |
| 18 | O estado da falha repetia `Couldn't write to GitHub:` antes das razões, que já são frases | A razão sozinha, com o losango; no dobrado, `Couldn't write to GitHub · open it to Retry` | `discussion.md` §5.3 |
| 19 | O aprovado que vai na corrida, no instante antes dela | `Approved · publishing next` | `discussion.md` §5.3 |
| 20 | A discussão pausada "sem barra" (`discussion.md` §13) contra a barra quieta da task e do review (`structure.md` §3) | A barra quieta do status, sem as situações da sessão; o cartão continua decidindo | `discussion.md` §8, §13; `changes.md` D18; `decisions.md` |
| 21 | O lugar da barra, `Discussing` e `round 1`, e a palavra da árvore | `Discussing` antes dos rascunhos e `round N` depois na barra; `Round R` na árvore e na pílula, como `pass K` e `Pass K` no review | `discussion.md` §8 |
| 22 | A chegada de cada situação da discussão | A tabela da barra; o artefato ilegível leva ao compositor, não ao marco | `rest.md` §11; `discussion.md` §8 |
| 23 | O texto das pastilhas de começo de mensagem | `Change the drafts: ` e `drafts.md can't be read: <razão> Rewrite it in the format MySpec reads. ` | `components.md` Compositor |
| 24 | **Retry** da sessão (P3), que a tela da task acha só nas tasks | O Go já aceita a chave da discussão (`session.Service.Retry`); é só frontend | `backend.md` P3 |
| 25 | A página da discussão apagada com "o que foi publicado", que o estado já não tem | Sem bloco: o texto diz que o publicado fica no GitHub; o diálogo de apagar já disse quantos | `discussion.md` §11 |
| 26 | O diálogo de nova discussão: a linha do contexto sem cards, o clone inexistente, a ordem das razões, a falha, o board que sai, `Esc` iniciando | As formas da §4.2; `maxLength` sai para o erro dizer o que fazer, e o título conta por ponto de código; as recusas de `Start` com as frases de hoje; ` The discussion was undone.` como dado novo (P22c) | `discussion.md` §2; `changes.md` D22; `backend.md` P22c |
| 27 | O repositório do épico no diálogo de agrupar | O mais comum entre os marcados, como `commonRepository` (`service.go:483–500`) | `discussion.md` §12 |
| 28 | `Details` › Rounds e Documents sem forma | As linhas da §4.2; as linhas de rodada não agem | `discussion.md` §10 |
| 29 | A crítica das entradas das tasks 7 e 8 como régua (horas que o dado não tem, fontes únicas, provas) | Nenhuma hora que o dado não tem (o intervalo vem de `publishedAt`; a hora de uma rodada sem publicação não aparece); os textos das notificações continuam em `rest.md` §11; a prova sem escrita no GitHub | §4.2 |
| 30 | Divergências do mock | Vale o material (`implementation.md` §1). As conhecidas: `line 41:` no marco; o intervalo no texto do marco; o segmento **Body**/**Changes** na superfície elevada; **Edit** habilitado durante a corrida; `Couldn't write to GitHub:` antes da razão; `Not published · the run stopped before it`, que a task 8 tirou; `Round 1 · 5 drafts` sem a pastilha **Ask for changes** na cena `done`; `S.revised` com `new` para um rascunho que mudou; o **Retry** da sessão com o texto `Retry` sem `Retrying…`; a trava só no teclado | `implementation.md` §1 |
| 31 | As recusas do agrupamento usavam sentinels que já têm outras frases (`ErrEmptyTitle`, `ErrTitleTooLong`, `ErrInvalidRef`, `task_service.go:820–831`) | Sentinels próprios, como o `ErrUntitled` da task 8: `ErrEpicUntitled`, `ErrEpicTitleTooLong`, `ErrNotGroupable` (um card de outra rodada, de outro épico-rascunho, descartado ou começado); o repositório fora do board pela `board.Refusal` `RefusalNotManaged` | §4.4 |
| 32 | Uma discussão anterior à task perderia a rodada 1 na dobra | O `Round N` derivado antes do `Drafts written` da rodada seguinte | `discussion.md` §4 |
| 33 | **Delete discussion…** e o **Retry** do rascunho agiam durante uma corrida que o Go recusa (`delete.go:64`; `decide.go:82–99`, 160) | Desabilitados com `A publication is running`; a recusa que ainda chega vai ao rodapé do diálogo | `discussion.md` §3, §5.3, §11 |
| 34 | A ordem de "o primeiro que falhou" (a posição, o cartão, a corrida) | A ordem do cartão na barra, em **Show** e na lista do marco | `discussion.md` §4, §8 |
| 35 | A lista do marco de publicação só tinha a forma curta de dois `hold` | As formas da §4.2, e `Next` no instante antes da corrida | `discussion.md` §4 |
| 36 | O agente pode dar um id novo a um rascunho que muda, e aí a revisão vira `added` e `dropped` | `draftsFormatNote` (`prompts.go:183`), que um prompt editado também recebe, passa a pedir `When you change a draft, keep its id; a new id is a new draft.` | `changes.md` D21; `backend.md` P24; `docs/architecture/sessions.md` no step 1 |
| 37 | A ordem com a task 10 | A 9 corre em paralelo com a 10, e as duas começam depois da 4; a 10, também depois da 5; quem entra depois renumera a migration e faz o rebase de `store/actions.ts` e `store/app-store.ts` | `implementation.md` §1, tasks 9 e 10 |

### 4.4 O que o tech spec toma

- **A migration `0024_discussion_rounds.sql`**, uma só, no step 1: `discussion_drafts.round INTEGER NOT NULL DEFAULT 1` (todo rascunho que existe é da rodada 1), `discussion_drafts.revised_reading INTEGER NOT NULL DEFAULT 0` (o `DraftsRevision` da leitura que o substituiu por último; 0 nunca) e `discussion_drafts.approval_cleared INTEGER NOT NULL DEFAULT 0`. `draftColumns` (`store/discussions.go:30`), `scanDraft` (420) e a escrita (301) ganham as três.
- **`internal/discussion`**:
  - `Draft` ganha `Round int`, `RevisedReading int` e `ApprovalCleared bool`. `Decide` zera `ApprovalCleared`.
  - `reconcile` (`reconcile.go:21–39`) recebe a rodada: `R` é a maior dos guardados (0 sem nenhum); a rodada está fechada quando `R ≥ 1` e todo guardado de `R` está no GitHub ou descartado. Um guardado de uma rodada fechada não é tocado nem sai, salvo quando o artefato traz o mesmo id mudado: aí ele é substituído como hoje e vai para a rodada nova (um id que o agente reusa). Os rascunhos novos ou substituídos ganham `R + 1` com a rodada fechada, e `max(R, 1)` sem ela; "mudou" é a diferença campo a campo entre o guardado e o reconciliado (depois de `normalize` e da retirada de aprovação da task 8), com o campo `cards` num épico; um rascunho que mudou e já estava guardado ganha `RevisedReading` com o `DraftsRevision` da leitura, e `ApprovalCleared` quando era aprovado e perdeu a aprovação, seja substituído, seja um mantido a que `normalize` tirou o épico ou uma dependência, seja um épico mantido cujos cards mudaram. `normalize` (166–195) escreve os avisos pelo título (`The epic <título> is no longer among the drafts.`, `The dependency on <título> is no longer among the drafts.`), com os títulos dos guardados.
  - `RecordDrafts` (`service.go:258–291`) passa a devolver `Recorded{Changed bool; Round int; First bool; Before []BeforeDraft; Added, Dropped, Replaced int}`: `First` é a primeira leitura legível da rodada (sem guardados dela); `Before` é a rodada atual como estava antes da leitura (id, título, tipo, decisão, resultado com a referência, e o que mudou por campo: `title`, `body`, `repository`, `module`, `epic`, `dependencies`, `cards`, `kind`, `card`, ou `dropped`), só numa revisão.
  - `GroupIntoEpic(ctx, id, draftIDs, title, owner, name)`: recusa um título vazio com `ErrEpicUntitled` e acima de 256 pontos de código com `ErrEpicTitleTooLong` (novos, como o `ErrUntitled` da task 8), um card de outra rodada, de outro épico-rascunho, descartado ou começado com `ErrNotGroupable` (novo; o teste da task 8 que espera `ErrInvalidRef` no agrupamento muda no mesmo step), e um repositório fora do board com a `board.Refusal` `RefusalNotManaged`; o épico nasce com o título, o corpo vazio e a rodada atual.
  - `SetDraftText` aceita o corpo vazio num rascunho `SourceUser`.
  - `Reason(err) string` (novo, `artifact.go`): o texto do produto de um `ErrUnreadable`, sem o caminho nem o prefixo do pacote, com maiúscula e ponto (`Draft invoice-overage: it has no ### Title.`), e o de hoje para um erro que não é de formato.
- **`internal/discussionflow`**:
  - `readDrafts` (`evaluate.go:78–103`) usa `Recorded` para gravar o marco: `First` → `drafts_written` (a rodada e o número de rascunhos dela); uma revisão que mudou algo → `drafts_revised` (a rodada, as contagens e `Before`). `draftsUnreadable` (105–116) guarda `discussion.Reason(err)` em `l.unreadable` (hoje `err.Error()`) e grava `drafts_unreadable` com a razão e a rodada; o `session` só acrescenta quando o último marco de rascunhos da conversa, de qualquer tipo, não é um ilegível com a mesma razão.
  - `stampDocument` (44–62) grava `discussion_document` com o carimbo, depois de soltar o `mu`; o `session` só acrescenta quando o carimbo difere do último marco do documento, com `First` quando não há marco anterior.
  - A publicação (`publish.go`, na corrida da task 8) grava `drafts_published` com a rodada na primeira publicação ou falha de um rascunho da rodada; o `session` só acrescenta quando a conversa não tem o marco daquela rodada.
  - `Sessions` (`discussionflow.go:25–32`) ganha `MarkDiscussion(ctx, k, *session.MarkerEntry)`, que o `session` atende com as regras de deduplicação acima por tipo.
  - `state.go`: `DraftState` ganha `ApprovePublishes []string`, `DiscardPublishes []string` (os ids, na ordem da corrida) e `ApproveHold Hold`, só num rascunho sem decisão, não começado, sem falha e fora de uma corrida: `chainOf(comADecisão(drafts, id, d)).due()` menos o `due()` de agora, e o `hold(id)` com a aprovação (`tasks/08-chained-publication.md` §4.4, o desenho que deixa a task 9 simular um gesto). `State` ganha `Round int` (a maior rodada; 0 sem rascunhos).
  - `start.go`: quando a sessão não começa (`start.go:58–65`), o erro devolvido ganha ` The discussion was undone.` no fim só quando o apagamento deu certo (P22c), com o teste dos dois casos. O marco `discussion_started` recebe `Model`, `Effort`, `Board` e `Epics` (os épicos distintos dos cards de entrada) por `session.TaskInfo`, gravados em `session.Start` (`session/service.go:396–402`).
  - `publish.go:610–618`: o aviso de uma dependência que não pôde ser registrada nomeia o rascunho pelo título (`titleOf`).
- **`internal/prompts`**: `draftsFormatNote` (`prompts.go:183`) acrescenta, à frase do id estável, `When you change a draft, keep its id; a new id is a new draft.`; `prompts_test.go` e `sessions.md`.
- **`internal/session`** (`transcript.go:207–312`): `MarkerType` ganha `discussion_document`, `drafts_written`, `drafts_revised`, `drafts_unreadable`, `drafts_published`; `MarkerEntry` ganha `Model`, `Effort` (a task 6 já os traz no `review_started`), `Board`, `Epics`, `Round`, `First`, `Stamp`, `Count`, `Changed`, `Added`, `Dropped`, `Before []DraftBefore`, `Reason`. `sessions.md` diz os marcos novos.
- **Bindings**: `Draft` (`dto.go:1346–1394`) ganha `round`, `revised` (`RevisedReading > 0 && RevisedReading == DraftsRevision`), `approvalCleared`, `approvePublishes`, `discardPublishes` e `approveHold` (o `DraftHold` da task 8); `DiscussionSummary` (1398) ganha `round`; `ArchivedDiscussion` (1466) já tem `archivedAt`, e os rascunhos dele trazem `round`; `MarkerEntry` (719) os campos novos; `DiscussionService.GroupIntoEpic(id, draftIds, title, repositoryId)`; `userMessages` (`task_service.go:751`, 820–831) ganha os sentinels novos com as frases deles (`ErrEpicUntitled` → `Name the epic to group the drafts.`, `ErrEpicTitleTooLong` → `Use at most 256 characters in the title of the epic.`, `ErrNotGroupable` → `One of the drafts can't go into an epic anymore.`), e as frases de hoje ficam com os sentinels de hoje; `fromDraft` (`convert.go:1911`) e o teste. Depois, `task generate`.
- **Frontend, onde moram as funções puras**: `features/discussion/drafts-card.ts` (a ordem e o número, o atual, os textos do dobrado e do aberto, o estado, a linha do gesto, os nomes acessíveis, o avanço e a trava), `discussion-request.ts` (`discussionRequestOf(discussion, now)` com o `RequestModel` da task 6, o foco da chegada com o alvo novo `draft` em `lib/focus.ts`, o placeholder, as pastilhas), `discussion-header.ts` (a pílula, o `⋯` com as razões, `Details`), `new-discussion.ts` (a linha do contexto, as razões do rodapé), e em `features/chat/markers.ts` os marcos da discussão e a dobra (`MarkerContext` ganha `discussion: { round, drafts, text } | null`, que a tela ativa e a arquivada passam). `discussion-status.ts` fica com o que a task 8 deixou e o History usa (`epicGroups`, `looseDrafts`, `kindLabel`, `outcomeLabel`, `holdLabel`, `standingDetail`, `epicWayOut`, os rótulos); `waitsLabel` já saiu na 8.
- **O cartão na conversa**: um cartão ancorado depois de uma entrada, pelo mecanismo que a task 6 escolher para o cartão dos apontamentos (`tasks/06-review.md` §4.4, Os cartões fixos); se ela escolheu o `fixed` no fim, esta task acrescenta a `Conversation` a âncora `anchored={{ afterEntryId, node }}` (`null` é o fim), que as duas telas passam a usar. A dobra da rodada esconde entradas pelo `markerOf` que devolve `null`.
- **O `DecisionCard`** da task 6 recebe a política do avanço (`onDecided(id, decision) => "stay" | "advance"`) e a trava (`lockMs`), com o padrão de hoje (avança, sem trava) para o review e a PR da task; **Draft** e **FoldedDraft** recebem os dados e as ações por props, sem importar o store.
- **O `Composer`** ganha `starters: { label, tooltip, text }[]`.
- **Os tipos de marco no frontend**: `markerOf` tem um `switch` exaustivo sobre `MarkerType` (`markers.ts:385–464`), e um tipo desconhecido fica escondido (386–389). O step 3, que põe os tipos novos em `lib/wails.ts`, acrescenta os casos a `markerOf` devolvendo `null`; o step 7 os desenha.
- **A ação da decisão** (`store/actions.ts:819–823`): `decideDraft` devolve a promessa e deixa o aviso do app com o rótulo `Couldn't decide <título>`; o avanço usa a linha do gesto do estado que a tela tinha no gesto, não a resposta.

## 5. Inventário atual

### 5.1 `features/discussion` (em `c55a417`)

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `DiscussionView.tsx` (1–60) | A tela: cabeçalho, `DiscussionBar`, `DraftsPanel`, a conversa, o `ConversationComposer`, `DocumentsPanel`; vazia quando a discussão sai (33–35) | Reescrita: a tela da §4.2; a página que saiu no lugar da seção vazia |
| `DiscussionHeader.tsx` (1–112) | O estado em `Badge` com `ToneDot`, `ContextGauge`, `PauseButton`, **Documents**, **Archive** com a razão no tooltip, **Delete discussion** | Sai: o cabeçalho com a pílula, `Details`, `Documents` e o `⋯` |
| `DiscussionBar.tsx` (1–43 em `c55a417`; a task 8 acrescenta o meio e o tom) | O estado ao vivo, a razão do artefato, `Publishing…` | Sai: a barra do pedido, a pílula e o marco |
| `DraftsPanel.tsx` (1–127) | O painel com `N of M decided`, as caixas e **Group into an epic**, a reabertura numa leitura nova | Sai: o cartão na conversa, o meio da barra e o diálogo de agrupar |
| `EpicGroup.tsx` (1–86) | O grupo com borda, o cartão do épico, os cards recuados, `Discarded` e o link | Sai: o grupo do épico no cartão |
| `DraftCard.tsx` (1–465) | Todos os campos sempre abertos, o estado no canto, a releitura da atualização (142–162), `Current:` (80–83), o toggle da decisão (446–461) | Sai: **Draft**, **FoldedDraft** e a edição; a releitura passa ao **Draft** |
| `DependencyList.tsx` (1–135) | A lista com `Linked`, `Dropped`, `Couldn't record`, `On GitHub`, `×` e o campo por id | Sai: `Depends on` do aberto e o `DependencyPicker` |
| `DraftDiff.tsx` (1–39) | O diff em verde e vermelho | Refeito neutro |
| `discussion-status.ts` (1–174 em `c55a417`, antes da task 8, que acrescenta `holdLabel`, `standingDetail` e `epicWayOut` e tira `waitsLabel`) | Rótulos, tons, grupos, `refKey`, `refValue`, `dependencyLabel`, `repositoryOf`, `holdLabel`, `standingDetail` | Fica com o que o History e as funções novas usam |
| `useDraftText.ts` (1–53) | O título e o corpo salvos enquanto se digita, nunca vazios | Fica; o corpo aceita vazio no épico do usuário |
| `NewDiscussionDialog.tsx` (1–312 em `c55a417`, antes do campo **Board** da task 5) | O diálogo do shadcn | Reescrito no `Dialog` do system |
| `new-discussion.ts` (1–56) | `suggestedTitle`, `titleProblem`, `canStart`, `unclonedRepositories`, os textos | Ganha a linha do contexto e as razões |
| `DiscussionContextPreview.tsx` (1–131) | **Context** recolhível, a releitura dos cards | Vira a linha do contexto com **Show** |
| `DocumentsPanel.tsx` (1–91) | As abas **Context**/**Document**, que trocam sozinhas (30–35), o esqueleto, o `Banner` de erro | Reescrito: a lista, sem troca sozinha, o erro com **Try again** |
| `useDiscussionArtifact.ts` (1–48) | A leitura de um artefato | Fica |
| `ArchiveDiscussionDialog.tsx` (1–52) | `AlertDialog` que fecha na hora | Reescrito no `Dialog` do system, com o que foi publicado, `Archiving…` e o erro |
| `DeleteDiscussionDialog.tsx` (1–51) | `AlertDialog` | Passa ao `Dialog` do system; o History continua a usá-lo |
| `ArchivedDiscussionView.tsx` (1–178) | A discussão arquivada | Fica (task 11); passa `discussion` ao contexto dos marcos |

Testes: 19 arquivos em `features/discussion` (136 casos); cada um sai com o componente que testa, e os novos nascem no mesmo step.

### 5.2 Outros lugares que a task toca

| Arquivo | Hoje | Destino |
|---|---|---|
| `features/chat/markers.ts` (140–155, 231–232, 460) | `Discussion started` abre o contexto | Os marcos da §4.2 e a dobra |
| `features/chat/composer.ts` (25–49, 101–144), `Composer.tsx` (44–59), `ConversationComposer.tsx` (1–30) | Os placeholders da task; sem pastilha de começo | O contexto da discussão, as pastilhas; `ConversationComposer` deixa a discussão |
| `features/chat/Conversation.tsx` (189–260) | `fixed` no fim | A âncora (§4.4) |
| `features/sidebar/sidebar-tree.ts` (260–269, 295–325, 444–448, 600–609) | `Discussing` em todo lugar | A rodada |
| `lib/situations.ts` (101–106, 301–307) | Os rótulos | `Round` nos anúncios |
| `lib/focus.ts` (6) | Sem alvo de rascunho | O alvo `draft` |
| `lib/locations.ts` (281–310), `features/navigation/GoneView.tsx` (45–118) | O título da discussão que saiu | O texto e as rodadas |
| `store/actions.ts` (756–861), `store/app-store.ts` (896, 1064) | As ações de hoje, `groupIntoEpic(id, ids)` | `groupIntoEpic(id, ids, title, repositoryId)`; a chegada da discussão com `pendingFocus: "request"` |
| `lib/wails.ts`, `test/wails-mock.ts` | Os tipos de hoje | Os campos novos; `test/discussion-scenes.ts` novo |
| `internal/discussion/` (`discussion.go`, `service.go`, `reconcile.go`, `artifact.go`) | §4.4 | P24, P25, D19, `Reason` |
| `internal/discussionflow/` (`evaluate.go`, `state.go`, `start.go`, `publish.go`, `discussionflow.go`) | §4.4 | P10, F16 |
| `internal/session/transcript.go`, `service.go` | Os marcos da task e do review | Os da discussão |
| `internal/store/discussions.go`, `internal/store/migrations/0024_*.sql` | — | As colunas |
| `internal/bindings/dto.go`, `convert.go`, `discussion_service.go`, `task_service.go` | §4.4 | Os campos, `GroupIntoEpic` |

### 5.3 Os componentes do system

| Peça | Hoje | Nesta task |
|---|---|---|
| **Draft**, **FoldedDraft**, **DependencyPicker**, a linha do gesto (`SunkenLine` com o ícone), o diff neutro | Não existem | Nascem, com testes de componente e pintados nos dois modos |
| `DecisionCard` (task 6) | Avança sempre | A política do avanço e a trava |
| `Composer` (task 4) | Resposta rápida | As pastilhas de começo |
| `RequestBar`, `RequestModel`, `Stepper`, `Pill` (com `idle`), `GonePage` (com texto e bloco), `PanelSection`, `PanelRow`, `AuxPanel`, `Dialog`, `Checkbox`, `SegmentedControl`, `Select`, `Listbox`, `Menu`, `SunkenLine`, `NoticeStrip`, `Skeleton`, `Spinner`, `StateGlyph`, `TimeChip`, `ContextMeter`, `Tooltip`, `Kbd`, `icons.ts` | Existem (tasks 1 a 6) | Usados como estão |

### 5.4 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| O rascunho, a decisão, o resultado, a falha, `publishing`, o `hold` | `Draft` (`dto.go:1346`, com a task 8) | `round`, `revised`, `approvalCleared`, `approvePublishes`, `discardPublishes`, `approveHold` |
| A rodada atual | — | `DiscussionSummary.round` (P25) |
| O antes de uma revisão | — | No marco `drafts_revised` (P24) |
| Os marcos | Só `discussion_started` | P10 |
| O contexto: os cards, o texto | `DiscussionSummary.cards`, `text`; a mensagem que abre a sessão | Os épicos no marco de início; a linha do diálogo, só frontend (P23) |
| A contagem `+4 −1` e os títulos das dependências | O corpo e o `current`; `DraftRef.title` | Só frontend (F17, F18) |
| **Retry** da sessão | `TaskService.Retry(id, stage)` aceita a chave da discussão | Só frontend (P3) |

## 6. As tasks 4, 6, 8 e 9, a ordem, os riscos e o primeiro step

**A ordem.** A 9 começa da `main` com as tasks 4 a 8 mergeadas e não corre em paralelo com nenhuma delas. Se a 8 atrasar, a 9 espera: a linha do gesto só existe pela função da cadeia. A 9 corre em paralelo com a 10 (Settings), que começa depois do merge das tasks 4 e 5 e não toca `features/discussion`: a que entrar depois renumera a sua migration e faz o rebase de `store/actions.ts` e `store/app-store.ts`, que as duas tocam, com `task generate` e `task check` antes da revisão do crítico.

| Arquivo | Task 4 | Task 6 | Task 8 | Task 9 |
|---|---|---|---|---|
| `features/chat/markers.ts`, `composer.ts`, `Conversation.tsx`, `Composer.tsx` | Cria | Os marcos e o compositor do review; o cartão ancorado ou fixo | — | Os da discussão, a âncora, as pastilhas |
| `components/system/RequestBar.tsx`, o `RequestModel`, `Pill`, `GonePage`, `PanelSection`, `PanelRow`, `DecisionCard` | A barra | O modelo compartilhado, `idle`, o texto e o bloco, os painéis, o cartão | — | Usa; o avanço do cartão |
| `lib/focus.ts`, `store/app-store.ts` (`openSituation`) | A chegada da task | O alvo `finding`, a chegada do review | — | O alvo `draft`, a chegada da discussão |
| `features/discussion/*` | O compositor de `DiscussionView` | — | O painel mínimo (`DraftCard`, `EpicGroup`, `DiscussionBar`, `DiscussionHeader`, `discussion-status.ts`) | Saem ou são reescritos |
| `internal/discussion`, `internal/discussionflow` | — | — | A cadeia, o `hold`, os status | A rodada, os marcos, F16, o agrupamento |
| `internal/session/transcript.go` | Os marcos da task | Os do review (`Model`, `Effort`) | — | Os da discussão |
| `internal/store/migrations/` | `0020` | `0021` | `0023` (a 7, `0022`) | `0024` |
| `internal/bindings/dto.go`, `convert.go` | A conversa | O review | `Draft.hold` | Os campos da tela |
| `lib/situations.ts`, `sidebar-tree.ts` | O fragmento de `findings` | Os rótulos do review | Os três tipos | A rodada |
| `design/system/tokens.css` | `--size-composer-max` | — | — | Nenhum token |
| `docs/product/features.md` | §Sessões e conversas | §Centro de review | §Aprovar e publicar, §Épico, §A discussão como item | §Discussão inteiro |

| Risco | Tratamento |
|---|---|
| **Uma decisão que publica sem querer** | A linha do gesto antes, o foco que fica, a trava de 900 ms em teclas e cliques, a repetição ignorada; provados no pronto 2 e no 5 |
| **A regra duas vezes** | A linha do gesto vem do Go, pela função da cadeia; o frontend só escreve os nomes |
| **A rodada errada** | A regra de §4.3 #1 em testes de tabela de `reconcile` (pronto 4): a primeira leitura, a revisão com publicação parcial, a rodada fechada, o id reusado, tudo descartado |
| **Um marco repetido a cada reinício** | O documento pelo carimbo, o artefato ilegível pela razão, a publicação pela rodada, deduplicados no `session` com os marcos da conversa; testado com um `Sync` |
| **Dados guardados antes da task** | Os rascunhos na rodada 1 pela `0024`; sem marcos de rascunho, o cartão no fim; a rodada 1 dobra pelo `Round 1` derivado antes do `Drafts written` da rodada 2 (pronto 6); o contexto e a mensagem derivados, sem a parte do épico; o início sem o modelo; os avisos com id ficam como estão. A medição de 2026-09-29 (`tasks/08-chained-publication.md` §5.4) não achou discussão ativa, mas as tasks 4 a 8 levam dias, e a regra vale para as que existirem |
| **A transição dentro da branch** | Do step 6 ao 7, o cabeçalho novo (sem o item de agrupar no `⋯`) convive com o painel mínimo da task 8, com o botão **Group into an epic**, e com a `DiscussionBar` até o step 9. No step 8, o cartão, **Edit**, o diálogo de agrupar e o item do `⋯` entram juntos, e os cinco componentes antigos saem: o step 8 tem o tamanho de um G e é revisado sozinho pelo `design-critic`, como o step 4 da task 8. Nenhum merge parcial |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria |
| **O `DecisionCard` compartilhado** | O avanço de hoje é o padrão; o review e a PR da task não mudam, e os testes deles continuam |

**Como o primeiro step é feito.** É P25 e P24 com a migration, só no Go: a `0024`, `Round`, `RevisedReading` e `ApprovalCleared` no `Draft` e no store, a rodada em `reconcile` com os testes de tabela, `Recorded` com o antes, os avisos pelo título, `GroupIntoEpic` com o título, o repositório e os sentinels próprios (a interface de hoje passa a mandar o título `Epic` e o repositório comum até o step 8), o corpo vazio do épico do usuário, `discussion.Reason` e a linha do prompt que pede manter o id. Nada na tela muda.

**O que a task 8 deixa para a 9.** Quatro pontos da crítica da task 8 (`design/research/critique-task-08.md`) ficam para esta task, que reescreve as peças onde eles vivem:
- a linha da árvore diz `publishing` pelo spinner também durante uma corrida com uma situação de pé (`Publish failed`, `Decide drafts · 2/4`): o status é o que a pílula e o spinner dizem, e a situação é o que a linha 3 diz;
- o descartado não tem opacidade: o épico descartado vive pelo título em `--ink-2` e pelo `Discarded`, como os cards, com a decisão em tinta cheia para ser desfeita, e os cards aprovados que ele deixa de pé ficam em tinta cheia, porque são o que a situação `Epic discarded` pede para decidir;
- o cartão descartado diz `Discarded` em texto (§4.2, o canto de estado), nos cards e no épico;
- `standsAlone` não existe mais no Go da cadeia: `epicOf` (`internal/discussion/chain.go`) faz o papel dele, e `orderTargets` fica.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/storage.md` (`discussion_drafts`) | As colunas da `0024`; a rodada que não muda | 1 |
| `docs/architecture/sessions.md` (o prompt da discussão) | O id mantido de um rascunho que muda, no formato dos rascunhos | 1 |
| `docs/architecture/sessions.md` (os marcos) | Os marcos da discussão e a deduplicação | 2 |
| `docs/architecture/overview.md` §A discussão | A rodada, os marcos, o que o gesto publica no DTO | 2, 3 |
| `docs/architecture/design-system.md` §Componentes | **Draft**, **FoldedDraft**, **DependencyPicker**, a linha do gesto, o diff neutro, as pastilhas de começo, o avanço do `DecisionCard` | 5 |
| `docs/product/features.md` §A discussão como item, §A página do item que saiu | O cabeçalho, a pílula, o `⋯`, os painéis, a página | 6 |
| §A conversa, §O documento | Os marcos e a rodada dobrada | 7 |
| §Rascunhos de cards, §Épico, §Aprovar e publicar | O cartão, a linha do gesto, o teclado, a edição, o agrupamento | 8 |
| §A discussão como item, §Depende de mim, §Atalhos | A barra, a chegada, o compositor, a árvore com a rodada | 9 |
| §Criar uma discussão | O diálogo | 10 |
| §Histórico de uma discussão | A conversa arquivada com as rodadas dobradas | 7 |

## 8. Plano de steps sugerido

Onze steps, do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma nova que um step seguinte troque, salvo as transições da §6, dentro da branch.

1. **A rodada e a revisão (P24, P25, D17, D19, D20, D21).** A `0024`, os campos do `Draft`, a rodada e o antes em `reconcile` e `RecordDrafts` com a diferença campo a campo, os avisos pelo título, `GroupIntoEpic` com o título, o repositório e os sentinels próprios, o corpo vazio do épico do usuário, `discussion.Reason`, a linha do prompt; `storage.md`, `sessions.md` (o prompt). Nada na tela.
2. **Os marcos (P10).** Os tipos e os campos em `session`, `MarkDiscussion` com a deduplicação, a gravação em `start`, `stampDocument`, `readDrafts`, `draftsUnreadable` e na corrida; os testes com um `Sync`; `sessions.md`. A conversa de hoje não mostra os tipos novos (`markerOf` esconde um tipo desconhecido) até o step 7.
3. **O que o gesto publica (F16) e a fronteira (P22c).** `DraftState` e `State.Round`, os DTOs, `GroupIntoEpic` nos bindings e as frases dos sentinels novos, ` The discussion was undone.` em `Start`, `task generate`, `lib/wails.ts` com os tipos de marco e os casos de `markerOf` que devolvem `null`, `test/wails-mock.ts`, `convert_test.go` com a tabela da cadeia; `overview.md`. Nada na tela.
4. **As funções puras.** `drafts-card.ts`, `discussion-request.ts`, `discussion-header.ts`, `new-discussion.ts`, os marcos e a dobra em `markers.ts`, testados em tabela contra a §4.2. Nada na tela.
5. **O system.** **Draft**, **FoldedDraft**, **DependencyPicker**, a linha do gesto, o diff neutro, as pastilhas do `Composer`, a política do `DecisionCard`, a âncora da `Conversation`; testes de componente e pintados nos dois modos. Nenhuma tela muda.
6. **A tela I (D9, D12, D14).** O cabeçalho com a pílula, o medidor, **Pause**, `Details`, `Documents` e o `⋯` (sem o item de agrupar, que entra no step 8; **Delete discussion…** desabilitado durante uma corrida); os diálogos de arquivar e apagar; a página que saiu; a árvore com a rodada. Saem `DiscussionHeader` e o teste pintado dele; o `DocumentsPanel` de hoje é reescrito.
7. **Os marcos e a dobra (D7, D10).** Os marcos da discussão na conversa, a dobra da rodada (também a derivada de uma discussão anterior à task), o `MarkerContext` com a discussão, e a conversa arquivada com a dobra. O painel mínimo da task 8 continua.
8. **O cartão, editar e agrupar (D1, D2, D4, D6, D8, D19, D22, S10).** O cartão com o dobrado e o aberto, a linha do gesto, a decisão com o avanço e a trava, **Retry** (desabilitado durante uma corrida), o teclado, `Alt+↓`/`Alt+↑`; **Edit** no lugar com o `DependencyPicker`, **Existing issue…** e a nota da aprovação; o diálogo de agrupar e o item do `⋯`. Saem `DraftsPanel`, `EpicGroup`, `DraftCard`, `DependencyList` e `DraftDiff` de hoje, com os testes. É do tamanho de um G, e o `design-critic` o revisa sozinho antes do step 9.
9. **A barra, o compositor e a chegada (D11, D13; S8, S9 na discussão).** A barra em todas as situações e pausada, **Retry** da sessão, **Show**, **Next to decide**, **Archive…**, a chegada com o alvo `draft`, a piscada e o anúncio; os placeholders e as pastilhas. Sai `DiscussionBar`, e a discussão deixa o `ConversationComposer`.
10. **O diálogo de nova discussão (P23 na discussão).** O `Dialog` do system com o **Board** da task 5, a linha do contexto com **Show**, os repositórios sem clone, as razões, a falha. Sai `DiscussionContextPreview`. Depois do commit, o ponto de parada da prova (§4.2, A prova).
11. **As cenas e o fim.** `test/discussion-scenes.ts`, os dois testes pintados com as capturas, `where-actions-went.test.tsx`, o registro da prova na pull request, a conferência de `docs/` contra o que a task fez.

Depois do step 11, e antes do merge, o `design-critic` revisa a branch (`implementation.md` §1); as divergências são corrigidas em commits da própria branch, e a pull request só é dada como pronta com o CI verde.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md`: D3 e D4 confirmadas pelo usuário (`decisions.md`, 2026-09-25); D1, D2, D6–D12 e D14 decididas com a tela (`decisions.md`, 2026-09-24); D17 a D22 decididas pelo coordenador, por delegação, em `decisions.md` (2026-09-29, "Discussão: o que a entrada da task 9 decidiu"), com o resto da §4.3: a regra da rodada e a rodada fechada que não muda, a dobra derivada no lugar do marco de publicação, o intervalo fora do texto do marco, a barra quieta da discussão pausada, a página apagada sem o bloco, o id mantido de um rascunho que muda, as ações desabilitadas durante uma corrida. Nenhuma delas muda um fluxo inteiro, apaga dado que não se refaça com um gesto ou desdiz o que o usuário aprovou. No step 10, o usuário opera a prova (§4.2): pausa a task, fecha o MySpec, conduz uma discussão descartando tudo e limpa os diretórios depois.
