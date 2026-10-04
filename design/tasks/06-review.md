# Task 6 · Centro de review e tela de um review

Material de entrada da sexta task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 6 de `design/implementation.md` (§2, linhas 103–113), com os princípios da §1 (9–22) e os riscos da §3 (185–197). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** A task parte da `main` depois do merge da task 4 (PR #71) e da task 5 (card #52), e não corre em paralelo com nenhuma das duas (§6). As linhas de código citadas são as da branch da task 4 em `3fb42e1`, lidas na worktree `myspec-review-71`; o que a task 5 cria é citado pelo material dela (`tasks/05-board.md` §4.4 e §5), porque ainda não está no código. O primeiro passo do tech spec é conferir cada linha citada na `main` em que a task começa. A migration da task é a `0021` (a da task 4 é a `0020`; a 5 não cria nenhuma).

Toda decisão de design está tomada neste documento, em `design/screens/review.md`, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; o que a task abria de produto foi decidido pelo coordenador, por delegação, em `decisions.md` (2026-09-29, "Review: o que a entrada da task 6 decidiu") e está na §9.

**Nenhum comportamento de hoje se perde.** Cada controle das telas que saem tem um lugar novo, dito na §4.2 e provado pelo pronto 7: do cabeçalho de Reviews, a idade da leitura, o indicador de leitura e **Refresh**; das falhas, a linha por repositório; da barra de filtros, **Board**, **Repository**, **Author**, **Label**, **Pending only** e **Clear filters**; da linha, o ponto `Pending`, o número, o título, `Draft`, `Task`, o estado do review, o repositório, o autor, as labels, o card, `New commits`, `Reviewed`, **Open on GitHub** e o botão da ação com a razão; do diálogo de início, o resumo, o clone com **Clone and continue**, **Instructions**, o modelo e o modo; do cabeçalho do review, o modo, o estado, o medidor, **Pause**/**Resume**, o card, **Reports** e **Delete review**; da barra do review, o link da PR, o estado, os seis avisos (`stalePass`, `checkError`, `publishError`, `passBlocked`, `unreadableReport`, `commitFailed`), **Publish review**, **Apply**, **Approve**, **Review again** e **Open in VS Code**; do painel de apontamentos, o rótulo do relatório, `N of M decided`, o resumo editável e `Nothing to change.`; do cartão de apontamento, a localização que abre o editor, o texto editável, **Approve**/**Discard** e onde foi publicado; da publicação, o veredito, a contagem e o aviso de commits com **Review again instead**; de **Review again**, as instruções e o aviso do descarte; do painel **Reports**, `Context`, os relatórios e o veredito publicado com o link; e a faixa de stage do Apply (`ReviewStrip`). As mudanças de comportamento são as de `changes.md` R1–R18.

**Vocabulário.** "Lista" é a lista de PRs do lugar Reviews (o `tree`); "linha" é a linha de uma PR nela; "seção" é um dos quatro grupos; "painel da PR" é o painel da lista em Reviews (o de `components.md`, Painel auxiliar, variante da lista); "leitura" é a última leitura das PRs abertas (`ReviewCenter`); "review" é o item de uma PR em review no MySpec; "passada" é cada relatório pedido ao agente; "cartão" é o cartão de apontamentos na conversa; "barra" é a barra do pedido do review; "leitura de cada minuto" é a do review ativo (`reviewflow.Poll`); "aviso de tecla" é o componente de `components.md:110`.

## 1. Objetivo e critério de pronto

Reviews vira a lista por seções, com a linha mínima e a PR num painel ao lado, e o review vira a tela da task sem stepper: a pílula da passada, a conversa com os marcos do review, os apontamentos como cartão na conversa decididos com `A` e `D`, a barra do pedido como único lugar da ação, e a publicação num diálogo com o veredito sugerido e nunca marcado. Do Go, a task pede o título de cada apontamento (P19), os checks pelo nome antes e durante cada passada (P14) e na lista (P15), a descrição (P16), o seu último review (P17), os commits novos (P18), quando uma leitura falhou (P20, P21), quem fez o merge (P12), os marcos do review (P10), a publicação sem o resumo (P47) e a contagem de pendentes sem os reviews ativos (P48).

**Pronto quando** (`implementation.md:113`), cada item provado como diz:

1. **As cenas.** As fixtures de `test/review-scenes.ts` reproduzem `lab/12-screen-review/src/review.js` (as nove PRs, 34–58; os três apontamentos de `web#2291` com título, localização e texto, 60–69; o resumo, 70), no padrão de `test/task-scenes.ts` (`SCENES`, `sceneOf`, `fixSceneClock`), com a árvore das cenas da task (a task `t1` em `Question · Reviewer · Step 3/7` há 18 minutos) e os dois reviews, `web#2291` e `ios#312` (publicado, `changes requested`). O relógio é fixo em 2026-09-24 e coerente em cada cena: `list`, `list-empty`, `list-failed` e `start` às 18:00, com a lista lida às 17:58 (`Read 2m ago`) e `acme/ios` falhando desde as 17:56 e de novo na leitura das 17:58 (`· 4m ago`: a hora é a da primeira falha da sequência); `checks` às 13:10, com o review iniciado às 13:08 e a última leitura às 13:09:20 (`checked just now`, `e2e / chromium` rodando há 5m 40s); `pass` às 13:15:10, com o turno desde as 13:13:00 (`Working · 2m 10s`); `findings` às 13:53, com o relatório das 13:19 (`34m`), um de três decididos e o foco no apontamento 2; `publish` e `clean` às 14:00 (`41m`), com o diálogo aberto; `again` às 15:14, publicado às 13:41, três commits de `rsouza` às 15:02 (`12m`); `merged` às 16:21, com o merge de `rsouza` às 16:20. As flags: `?own` em `start` (a PR `web#2288`) e em `findings`, `publish` e `clean` (o review de `web#2291` como PR sua); `?stale` (dois commits depois da passada); `?apply` (o modo Apply); `?checkerr` (a leitura de cada minuto falha desde as 13:50 e de novo a cada minuto, com `GitHub's rate limit was reached. It resets at 14:32.`, sem o prefixo `pulls: `). Dois testes pintados (Chromium, claro e escuro): `features/reviews/ReviewsView.scenes.painted.test.tsx` (`list`, `list-empty`, `list-failed`, `start`, `start?own`) e `features/reviews/ReviewView.scenes.painted.test.tsx` (`checks`, `pass`, `findings`, `publish`, `clean`, `again`, `merged`, e `publish?own`, `clean?own`, `publish?stale`, `findings?apply`, `publish?apply`, `findings?checkerr`), cada cena a 2180 px de área principal e a 978 px, e `list` com `api#1302` no painel e `findings` também a 812 px. Em cada uma, o teste confere: toda linha, cabeçalho de seção, barra de filtros, faixa, painel, diálogo, cartão, apontamento, barra do pedido e página em pixel inteiro; o título de cada linha com ao menos um terço dela; a coluna das teclas dentro da sua largura; todo texto cortado com tooltip; no máximo uma primária na camada de cima (§4.2, A primária). Grava as capturas, anexadas à pull request lado a lado com o mock (`python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090, que é a do coordenador; `12-screen-review/a.html?scene=…`).
2. **As larguras.** A 1041 px de contêiner a linha da PR é uma só, com 425 px de título; a 1040 px, duas. A 812 px, com `api#1302` no painel, o painel fica ao lado, o contêiner da lista tem 452 px, o título 156 px e a segunda linha 284 px, onde o autor e o estado de toda linha da cena cabem inteiros; uma linha de teste com `dependabot` e `Published · changes requested` (287 px) corta o estado, com tooltip, porque `Published` não tem forma curta (`structure.md:150`); a 790 px o painel cobre a lista. A 978 px de área principal, a pílula do review perde a palavra e o topo segue os limites da task (`screens/task.md` §3).
3. **O teclado** (jsdom): `features/reviews/ReviewsView.keys.test.tsx` (`↑` `↓` `Home` `End` pelas linhas e cabeçalhos visíveis, `←` `→` e `Enter` nas seções, `Enter` abre e fecha a PR, `R` em cada `action` e os avisos de tecla, `O`, a ordem de `Esc`, a lista como uma parada de Tab, `Ctrl+Enter` e `Esc` no diálogo de início) e `features/reviews/ReviewView.keys.test.tsx` (`A` e `D` que decidem e avançam, desfazem sem avançar e ignoram a repetição; `E`, `Esc` e **Done**; `O` e `Ctrl+E` no apontamento; `Alt+↓` e `Alt+↑` de qualquer lugar da tela, o compositor incluído; `Ctrl+Enter` na barra e no cartão abre a publicação quando a primária é **Publish review…** habilitada (`ready_to_publish`, `publish_failed`), e não age em `awaiting_decision`, no compositor nem no modo Apply; no diálogo, o foco em **Cancel**, `1`–`3`, `↑` `↓`, `Ctrl+Enter` só com um veredito escolhido; o foco inicial do **Review again…** com e sem a nota).
4. **As regras da publicação** em tabela (`features/reviews/publish.test.ts`): o veredito sugerido, as três regras do GitHub, a linha do que vai para o GitHub em todos os casos da §4.2, o começo do resumo, o rótulo de **Publish**.
5. **O título (P19).** `internal/prreview/report_test.go` em tabela: `### 1 · Título`, `### 1. Título`, `### 1 - Título`, `### 1: Título`, `### 1 **Título**`, `### 1` sem título, o título com código inline, e que nenhum deles torna o relatório ilegível; `inherit` mantém a decisão e o texto com o título mudado; `same` vê a troca do título; um apontamento guardado antes da migration lê título vazio; `Reason` dá o texto do produto de cada recusa do parser; o `findingsFormatNote` pede o título (`internal/prompts/prompts_test.go`).
6. **O Go** (P10, P12, P14–P18, P20, P21, P47, P48): testes de `reviewflow` para os checks ao vivo e os guardados por passada com `checks_read_at` e o marco `checks_read`, `recorded_at` e `sent_at`, a hora da primeira falha da sequência e a mensagem sem o prefixo, `RefreshPR` durante uma leitura em curso, a releitura que difere só nos títulos (sem subir a revisão nem gravar marco), os commits desde a passada e o marco `new_commits`, `checkErrorAt` e `checkedAt`, `RefreshPR` do review, `mergedBy`, `mergedAt` e `closedAt` no fim, os marcos de decisão, de publicação e de envio ao agente, a publicação sem o resumo (e `summary_published`); de `pulls` para os campos novos da leitura (checks com duração, mergeabilidade, corpo, o seu review com o estado, a data e os commits depois dele, `failedAt` da primeira falha), com a query validada contra o schema do GitHub; de `bindings` para os DTOs, `pendingCount` sem as PRs com review ativo e o filtro guardado com `pendingOnly`; `task generate`, `lib/wails.ts` e `test/wails-mock.ts`.
7. **Onde foram as ações.** `features/reviews/where-actions-went.test.tsx` tem uma linha por controle do terceiro parágrafo e por estado em que ele aparece hoje; nenhum fica sem lugar. Em cada situação da barra (§4.2), no painel da PR em cada caso, no diálogo de início, no de publicação e no de **Review again…**, a tela tem no máximo uma primária.
8. **A chegada** (R18): por `Ctrl+J` e pela notificação, o foco vai ao que cada situação da tabela da §4.2 pede (`features/reviews/ReviewView.test.tsx`), e a barra que nasce com a tela aberta pisca e é anunciada.
9. **A árvore e a contagem.** A linha do review esperando os checks diz `Pass 1 · checks 4/6` com `GitHub` à direita (`checking GitHub` antes da primeira leitura), e o nó **Reviews** diz `4 pending`, a contagem da seção `Pending` (`features/sidebar/sidebar-tree.test.ts`).
10. **O Apply.** `findings?apply` e `publish?apply` nas cenas; a barra `Review changes` com o cartão de arquivos da task no fim da conversa do review, sem `ReviewStrip`; `Ready to merge` com **Open PR** (`features/reviews/review-request.test.ts`). Nenhuma cena está em `in_review`, e o mock não desenha essa forma (é a da PR da task): a barra `Review changes` e o cartão `Changed files` no review são provados em `features/reviews/ReviewView.test.tsx` (jsdom), pelos nomes.
11. **Um review real**, na máquina alvo, de ponta a ponta, registrado na pull request: iniciar com os checks rodando, a espera com os checks pelo nome, uma passada cujos apontamentos têm título, decidir pelo teclado, publicar com e sem o resumo (e `Request changes` e `Comment` só com inline e sem o resumo, o caso do corpo mínimo de P47), um commit novo na PR, **Review again…**, e o merge com a tela aberta. É o que prova o prompt novo (P19) com um agente de verdade.
12. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
13. **Documentação** da §7 escrita no step de cada área; `features.md` §Centro de review inteiro, §O review como item, §A página do item que saiu, §Depende de mim e §Atalhos reescritos.
14. **Revisão do `design-critic`** na branch contra este material, `review.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).

`changes.md`: R1–R18, R20, S10 no review. `backend.md`: P10 e P12 no review, P14–P21, P47, P48; F14, F15.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 6 (103–113), task 7 (115–125), riscos (185–197) | O escopo, o app sempre usável (15), os testes que migram (22), o que a task 7 vai reusar |
| 2 | `design/decisions.md`: Review, o que a entrada da task 6 decidiu (13–15); Review, cartões na conversa (49–51); Tela da task mínima (57–63); Papéis do azul (69–71) | O que o usuário aprovou e o que o coordenador decidiu por delegação |
| 3 | `design/screens/review.md` inteiro: a régua (9–16), a lista (18–114), o início (116–131), o cabeçalho e a pílula (133–175), a conversa (177–191), a espera (193–201), a passada e o passe limpo (203–209), os apontamentos (211–236), a barra (238–256), a publicação (258–277), **Review again** (279–283), `Couldn't check GitHub` (285–287), o Apply (289–295), o fim (297–306), os estados (308–319), os atalhos (321–341), os dados (385–400), a lista para a task 7 (402–433) | A tela inteira |
| 4 | `design/screens/task.md` §3 (34–58), §6 (129–172), §7 (174–217), §8 (219–243), §9 (245–254), §13 (354–374); `design/screens/board.md` §3.4 a §3.8 (121–245) | O que o review herda da task e o padrão da lista e do painel |
| 5 | `design/structure.md` §1 (7–38), §3 (200–335), §4 Reviews (339), §5 (343–381), §6 (383–398), §7 (400–423) | A chegada, a barra, os painéis, as teclas, as larguras |
| 6 | `design/principles.md` 2 (13–33), 5 (51–57), 7 (67–73), 8 (75–87), 9 (89–95), 10 (97–103) | A primária única, os glifos, um pedido num lugar, o movimento, a tecla escrita, o pixel inteiro |
| 7 | `design/system/components.md`: estados comuns (18–28), Aviso de tecla (110), Etiqueta (120), Link (141), Troca de lugar (151), Botão (161), Chip (176), Select e menu (213), Menu do item (227), Caixa de seleção (238), Rádio (248), Controle segmentado (258), Cabeçalho do lugar (302), Idade da leitura (313), Painel auxiliar (379), Página do item que saiu (394), Estado vazio de página (402), Esqueleto (420), Faixa de aviso (428), Linha afundada (439), Stepper e pílula (461), Barra do pedido (487), Compositor (502), Marco em linha (547), Cartão de pedido (623), Cartão neutro (635), Arquivo mudado (644), Checks do GitHub (651), Apontamento (661), Linha de lista (698), Cabeçalho de seção (712), Barra de filtros (723), Bloco do item (745), Diálogo (776), Diálogo de publicação (790), Tamanhos de layout (869) | Anatomia, estados, teclado e acessibilidade de cada peça |
| 8 | `design/system/tokens.css`: textos (37–46), espaços (60–61), medidas (55–57), listas e diálogos (97–107) | `--list-measure`, `--panel-card-width`, `--size-dialog-wide`, `--col-ref`, `--col-author`, `--col-state`, `--col-keys` |
| 9 | `design/changes.md` R1–R18 (71–92), S7, S8, S10 (17–20); `design/backend.md` P10 (41), P12 (43), P13–P21 (63–71), P47, P48 (72–73), F2, F14, F15 (112, 123–124) | O que muda de comportamento e os dados |
| 10 | `design/research/review.md` §0 a §3 (9–311); `design/research/interview.md`, as respostas sobre o review (31–39) | O produto de hoje, o volume real e o que o usuário respondeu |
| 11 | Mocks, com `python3 -m http.server <porta> -d design/lab` numa porta livre acima de 8090: `12-screen-review/a.html` (`?scene=` com as onze cenas, as flags `?own`, `?stale`, `?apply`, `?checkerr`, `?open=`, `?panel=`, `?menu`, `?audit`), as fontes `src/review.js` (as PRs 34, os apontamentos 60, o estado 73, o veredito 98–112, o menu **Filter** 191, a barra 201, o estado da linha 213, a linha 229, a lista 239, os checks 252, o painel 270, a lista inteira 292, o diálogo de início 307, a pílula 327, o cabeçalho 342, o `⋯` 351, a conversa 372–407, a barra 408, o compositor 413, os painéis 418, `Couldn't check GitHub` 438, a nota 440, o Apply 442, **Review again** 449, a página 459, a localização 474, a decisão 480), `src/vaparts.js` (o apontamento 2, a barra 8), `src/vbparts.js` (o diálogo 12), `src/review.css`; `12-screen-review/components.html` e `README.md` | A referência visual. Onde o mock e este material divergem, vale o material (§4.3 #31) |
| 12 | `docs/product/features.md` (na base) §A página do item que saiu (498–516), §Centro de review inteiro (517–634), §Sessões e conversas (653–684), §Depende de mim (685–710), §Atalhos (787 em diante) | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 13 | `docs/guidelines/README.md`, `frontend.md`, `go.md`, `testing.md`; `docs/architecture/overview.md` §O centro de review, §O estado que o frontend vê; `sessions.md` (a mensagem do app e os marcos); `storage.md` §Reviews de pull request, §Artefatos de um review | Como um step acontece |
| 14 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go** (P10, P12, P14–P21, P47, P48): a migration `0021`; o título no parser e no prompt; a leitura das PRs com os checks, a mergeabilidade, o corpo e o seu review; a leitura de cada minuto do review com os checks ao vivo, `checkedAt`, `checkErrorAt`, os commits e o merge; os checks guardados por passada; os marcos do review; `RefreshPR` do review; a publicação sem o resumo; a contagem de pendentes; `pendingOnly` fora; o link da linha em `Files changed` (F14); DTO, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`.
2. **`features/reviews`**, a lista inteira: o cabeçalho com a idade, as faixas por repositório, a barra de filtros com **Filter** e os chips, as quatro seções, a linha, o painel da PR com a ação por caso, os vazios, o teclado e os avisos de tecla, a memória das seções.
3. **O diálogo de início**, com a espera dos checks, **Add instructions** e o modo atrás de um clique.
4. **A tela do review**: o cabeçalho com a pílula, o medidor, **Pause**, os painéis **Details** e **Reports** e o `⋯`; a faixa `Couldn't check GitHub`; a conversa com os marcos do review, a espera dos checks, o cartão de arquivos do Apply e o cartão de apontamentos; a barra do pedido em todas as situações do review; o compositor do review; a chegada e o foco; o diálogo de publicação; o de **Review again…**; o de **Delete review…** no `Dialog` do system; a página do review que saiu com o texto e as passadas.
5. **A árvore**: a linha do review com `Pass 1 · checks 4/6`, e o nó **Reviews** com a contagem da seção `Pending`.
6. **`components/system/`**: **Finding** e **DecisionCard**, genéricos (sem binding do review, para a task 7 usá-los na PR da task), e a variante de PR da linha de lista, se a da task 5 não a tiver.
7. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| Os apontamentos estruturados na PR da task (T16, M1) | 7 | A barra `Decide findings · PR review` sem ação e a resposta pelo compositor, como a task 4 deixou. O **Finding** e o **DecisionCard** nascem aqui genéricos; a task 7 os liga à task |
| O review arquivado no History (`ArchivedReviewView`) | 11 | O de hoje. Continua importando `Published` de `ReportsPanel.tsx` e `DeleteReviewDialog.tsx`: os dois mudam por dentro e mantêm a exportação |
| Os textos das notificações do review (P37) | 11 | Os de hoje (`internal/attention/text.go`, 168–252) |
| As instruções fixas de review por repositório | 10 | Settings › Repositories de hoje; o diálogo de início não as mostra (nenhum repositório as usa, `research/review.md` §4) |
| O seletor de modelo do diálogo de início | 10 e 12 | O `ModelPicker` de hoje, no `Dialog` do system, como a task 5 deixou o de discussão |
| `ToneDot`, `ContextGauge`, `CardLink`, `PauseButton`, `useEditedText` | 9, 11, 12 | Continuam, usados pela discussão, pelo History e pela task. O review deixa de usar `ToneDot`, `ContextGauge` e `CardLink` |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| A lista em `Pending`, `In review`, `Reviewed`, `Yours and your tasks`, as duas últimas recolhidas; a linha mínima; a PR num painel; `R` inicia direto | `decisions.md:49–51`; `review.md` §2; R1–R4 |
| Os apontamentos como cartão neutro na conversa, com a barra do pedido como barra de decisão; `A` e `D` decidem e avançam | `decisions.md:49–51`; `review.md` §9, §10; R7–R10 |
| O passe limpo sem cartão, direto a `Ready to publish` | `review.md` §8; R11 (confirmada, `decisions.md:37–39`) |
| A publicação num diálogo mínimo, o veredito sugerido com `Suggested` e nunca marcado, o resumo opcional | `review.md` §11; R12 (confirmada), R13 |
| O review é a tela da task sem stepper: a pílula, a conversa, a barra, o compositor; o resto em `Details`, `Reports` e `⋯` | `review.md` §1, §4; R15 |
| Todo review é publicado; sem trecho do diff; o GitHub é a primeira ação da localização | `research/interview.md:31–39`; R9 |
| `Couldn't check GitHub` é faixa, nunca situação; o fim mostra a página do item que saiu | `review.md` §13, §15; R16, R17 |

### 4.2 Decisões de design, detalhadas

#### Reviews: o lugar, o cabeçalho e a leitura

**O lugar** (`review.md` §2.1). O cabeçalho do lugar (`LocationHeader`) com `←`, `→` quando há destino, o título `Reviews` e, à direita, a idade da leitura (o componente da task 5: `Read 2m ago` em `--text-micro` `--ink-4`, tooltip `Last read at 17:58`, `Last read yesterday at 17:40`, `Last read Sep 21 at 17:40`; lendo, `Reading…` com o spinner, `role="status"`) e **Refresh** (fantasma de ícone `refresh`, tooltip `Read the pull requests again`; tracejado com `A reading is running.` durante uma leitura). Abrir o lugar relê. O corpo é a área que rola da lista (o contêiner das container queries), com a coluna de `--list-measure` centrada em `round(down, …, 1px)`, `--space-6` dos lados e `--space-12` no pé, e o painel da PR, quando aberto. Dentro da coluna, de cima para baixo: as faixas, a barra de filtros, a lista.

**Os estados da leitura** (`review.md` §2.6, §2.7):

| Estado | Cabeçalho | Área da lista | Árvore |
|---|---|---|---|
| Lida | `Read 2m ago` | A barra e a lista | `4 pending` |
| Lendo sobre a última | `Reading…`; **Refresh** tracejado | A barra e a lista guardada | `reading…` |
| Repositórios que falharam | A idade | Uma faixa de aviso por repositório, em ordem alfabética: `◇ Couldn't read acme/ios · 4m ago` (`age` sobre `failedAt`, a primeira falha da sequência, que fica enquanto o repositório falha e some na primeira leitura boa), a mensagem de `features.md` §Leitura das pull requests em `--ink-2`, sem o prefixo `pulls: ` e **Try again** secundário `sm`, que relê a lista inteira; lendo, **Try again** dá lugar a `Reading…` em todas as faixas; `role="alert"` quando chega. Embaixo, `--space-4`, a barra e a lista, com as PRs desse repositório da última leitura | `◇ Read failed` com a razão no tooltip (task 2) |
| Nunca lida, lendo | `Reading…` | O esqueleto de quatro linhas de `--size-control`, `role="status"` `Reading the pull requests…`; sem barra | `reading…` |
| Sem repositórios | — | O estado vazio de página só com o título, o texto do produto: `Register a repository to see its pull requests.` É raro: sem nada cadastrado, o app mostra as boas-vindas | — |
| Nenhuma PR aberta | A idade | `No open pull requests.` / `The list shows the open pull requests of your 12 repositories, from any author. MySpec reads them every 5 minutes and when you open Reviews.` (`1 repository`) e **Read now** secundário, que relê, tracejado com `A reading is running.` enquanto uma leitura roda (lendo vence); sem barra | `No review in progress.` sob **Reviews** quando não há review ativo |
| Filtro sem resultado | — | A barra, e embaixo `No pull requests match the filters.` / `9 are open; the filters hide all of them.` (`1 is open; the filters hide it.`) e **Clear filters** secundário | — |

Lendo vence quando dois estados valem; as faixas e um vazio convivem, as faixas no alto (a regra do board, `tasks/05-board.md` §4.2).

#### As seções e a linha (R1, R2)

**As seções.** Uma PR vai para a primeira que vale: `In review` (tem review ativo, `reviewId`); `Yours and your tasks` (é sua, `own`, ou de uma task, `taskId`); `Pending` (`pending`); `Reviewed` (o resto). Ordem na lista: `Pending`, `In review`, `Reviewed`, `Yours and your tasks`; dentro de cada uma, a atualizada mais recentemente primeiro (`updatedAt`). As duas últimas começam recolhidas, e o que o usuário recolhe ou expande é lembrado entre execuções, uma chave só para o lugar (`reviewsSectionsKey` em `lib/ui-storage.ts`), lida com `readStored`. Uma seção vazia, de verdade ou pelo filtro, fica, com a contagem 0, sem chevron, sem hover nem ação, e continua no percurso. O cabeçalho é o da task 5 (`components.md` Cabeçalho de seção), com o tooltip `Never reviewed by you, or with commits after your last review`, `Pull requests with a review in MySpec`, `Reviewed by you, with nothing new since`, `Yours and the pull requests of your tasks: never pending`. Nome: `Pending, 4 pull requests`, `Reviewed, 1 pull request`. O nó **Reviews** conta as linhas de `Pending` (P48, R1).

**A linha** (`components.md` Linha de lista, variante PR), `role="treeitem"` de nível 2, na grade `--col-ref | título | --col-author | --col-state | --col-keys`, `--space-2` entre as colunas e dos lados, `--size-control`, `--text-ui`:

| Coluna | Conteúdo |
|---|---|
| Referência | `web#2291` (o nome curto do repositório, `#` e o número) em `--text-meta` `--ink-4` tabular; `--ink-3` na aberta; cortado com tooltip `acme/marketing-site#1234` (a mais longa medida, 123 px, passa de 96) |
| Título | `--ink-1`, cortado com tooltip; depois dele, `--space-2`, até duas etiquetas (`components.md` Etiqueta): `Draft` e a primeira label que não repete o autor, com `+N` quando há mais (tooltip com todas); as etiquetas não cortam e cedem antes do título: quando ele ficaria abaixo de um terço da linha, viram um só `+N` (N são todas, `Draft` incluída, com todas no tooltip), e, quando nem ele cabe ao lado do terço, saem da linha e ficam no nome acessível dela; o painel aberto as mostra |
| Autor | O login em `--text-meta` `--ink-3`, `you` na sua; cortado com tooltip |
| Estado | Ver a tabela seguinte, em `--text-meta` |
| Teclas | Só na linha com o foco visível: `R review`, `R open`, `R open task` (a tecla `Kbd sm`, o texto em `--text-micro` `--ink-3`); nenhuma numa PR de fork ou de clone inexistente, porque `R` não age ali |

| Caso | Estado |
|---|---|
| Review ativo esperando você | O glifo do tom da linha da árvore e a linha 2 dela na forma longa (`● Decide findings · pass 1 · 1 of 3`), `--ink-1` 500; a forma curta (`Decide findings · 1/3`) quando a longa não cabe; tooltip `Review: Decide findings · pass 1 · 1 of 3 · waiting for you for 34 minutes` |
| Review ativo sem situação | O glifo e a linha 2 (`○ Published · changes requested`, `◌ Pass 1 · checks 4/6`), `--ink-2` |
| Pendente, nunca revisada | `Never reviewed`, `--ink-2` 400 |
| Pendente, commits depois do seu review | `3 new commits` (`1 new commit`), `--ink-2` 400, tooltip `3 commits after your last review`; `New commits` quando o commit do seu review não está entre os 100 últimos (P17) |
| Revisada | `Reviewed`, `--ink-3`, tooltip com o seu review (`You approved it today at 10:02`) |
| De uma task | O glifo `task` e `Task · <nome da task>`, `--ink-2`, tooltip `Its review happens in the task` |
| Sua | `Yours`, `--ink-3` |
| De um fork | `From a fork · can't be reviewed yet`, `--ink-3`; a linha fica tracejada, continua no percurso e abre o painel |
| Clonando (**Clone and continue** da linha) | O spinner e `Cloning acme/docs…` |
| O clone falhou | `Clone failed` em `--state-error`, com o trilho, enquanto a falha do clone do repositório existir (a mesma fonte do painel) |

As medidas (Fira, Chromium, `--text-meta`): `Published · changes requested` 183 px, `New commits · 3 since pass 1` 170, `Decide findings · pass 1 · 1 of 3` 175, `From a fork · can't be reviewed yet` 200; a coluna tem 208, e o glifo com `--space-1-5` toma 14. `R open task` mede 74 de 120.

**A largura** (`review.md` §2.3): acima de 1040 px de contêiner, uma linha (a 1041, 425 px de título: 993 − 16 − 520 das colunas − 32 dos vãos); até 1040, duas: a grade fica com a referência, o título e as teclas, e o autor e o estado descem para a segunda linha, da coluna do título à das teclas, com `--space-4` entre os dois, sem quebrar; o estado passa à forma curta quando a longa não cabe e só então corta; o autor corta por último. Na lista de 452 px (janela de 1100 com o painel), 156 px de título e 284 de segunda linha.

**Estados** (`components.md` Linha de lista): hover, foco com as teclas, pressionada, aberta (`--brand-tint-plane` com o anel colado), tracejada (fork), carregando e erro (o clone), nova numa leitura (pisca duas vezes no véu neutro). O nome acessível, separado por `. `: `api#1302 Idempotency keys for payment retries`, `by lnakamura`, `draft`, as labels (`label dependabot`), e o estado (`pending: never reviewed`, `pending: 3 new commits after your review`, `reviewed: you approved it today at 10:02`, `review: Decide findings · pass 1 · 1 of 3, waiting for you for 34 minutes`, `the pull request of the task Rate limit per API key`, `your pull request`, `from a fork, can't be reviewed yet`).

#### Os filtros (R3)

A barra de filtros da task 5 (`components.md` Barra de filtros, variante Reviews), `role="search"` `Filter the pull requests`, fixa no alto da área que rola, só com o que Reviews usa: os filtros ativos como chips com `×`, **Filter** e **Clear filters** (fantasma `sm`, só com algum filtro ativo). Os chips, na ordem **Board**, **Repository**, **Author**, **Label**: `Board: Mobile App`, `Board: No board`, `acme/web`, `Author −dependabot`, `Author +rsouza`, `Label −dependabot`, um chip por valor de autor e de label, cada `×` com `Remove the filter Author −dependabot`. Um board ou repositório que saiu é órfão (`◇`, tooltip `Mobile App isn't a board anymore.`, `acme/old isn't registered anymore.`), e continua filtrando até o `×`.

O menu **Filter** (tooltip `Board, repository, author, label`): **Board** (os boards em ordem de `app.boards`, e `No board`) e **Repository** (os repositórios em `dono/nome`, ordem alfabética) são `menuitemcheckbox`, um marcado por grupo, e fecham o menu a cada escolha; **Author** (os autores da leitura, em ordem alfabética, o do `gh` com `· you`) e **Label** (as labels da leitura) usam o item de três estados do `Menu` (`FilterCycle`/`MenuCycleItem`, `components/system/Menu.tsx:172–189`), com a legenda `Author · click to hide, again to keep only`, o nome `dependabot: hidden. Click to cycle.`, e o menu aberto enquanto se alterna. Os filtros continuam guardados no Go (`review_filters`) e valem para a lista e para a contagem do nó; não escondem os reviews ativos da árvore. **Pending only** sai: o `pendingOnly` guardado é lido e ignorado (P48).

#### O painel da PR (R4)

**Abrir e fechar** (`review.md` §2.5): `Enter` ou o clique na linha abrem; outra PR troca o conteúdo e volta a rolagem ao topo; `Enter` na linha aberta, `Esc` e o `×` fecham, e o foco volta à linha quando estava no painel (sem a linha, à parada da lista). O teclado fica na lista. Uma PR que sai da leitura com o painel aberto fecha o painel, e o foco vai à linha seguinte (a regra do board). É o painel da lista da task 5, `aside` `Pull request api#1302`, com a largura e a regra de 800 px dela.

**A faixa**: `api#1302 · acme/api` em `--text-meta` `--ink-3`, **Open on GitHub** (fantasma de ícone, seta externa, nome `Open api#1302 on GitHub`, tooltip `Open on GitHub · O`) e `×` (`Close · Esc`). **O corpo**, de cima para baixo, com `--space-4` entre os blocos:

1. O título em `--text-title` 600 e, embaixo, em `--text-meta` `--ink-3`: o autor em 500 `--ink-2`, o estado da tabela da linha só numa PR sem review, `· Draft`, e `· updated 2 hours ago` (a forma longa da idade, tooltip com a hora).
2. **A ação**, numa linha, com a razão embaixo em `--text-meta` `--ink-2` (`--state-error` no erro), ligada por `aria-describedby`:

| Caso | Ação | Razão |
|---|---|---|
| Pendente ou revisada | **Start review** `R`, primária | Com checks não terminados: `The first pass waits for the checks: 2 not finished.` |
| Sua (não de task) | **Start review** `R`, primária | `Your own pull request: the review can publish a comment, or apply its findings.` |
| Com review ativo | O bloco do item (task 5): o glifo `review`, `Review of web#2291`, a linha 2 da árvore na forma longa com o chip, e **Open review** `R`, primária quando o review espera por você, secundária sem isso | — |
| De uma task | O bloco da task, com **Open task**, primária quando a task espera por você | `The review of this pull request happens in its task.` |
| De um fork | **Start review** primária tracejada | `Pull requests from forks can't be reviewed yet.` |
| Clone inexistente | **Start review** primária tracejada, **Change path…** secundária (novo: hoje só o botão desabilitado, `changes.md` R4) | `The clone at ~/code/web is missing.`; a recusa do **Change path…** em vermelho embaixo; depois de um que dá certo, o foco vai a **Start review** |
| Sem clone | **Clone and continue** `R`, primária (ícone `clone`, tooltip `Clone, then open the start dialog · R`) | `acme/docs isn't cloned yet. A review needs a clone.` |
| Sem clone, clonando | `Cloning acme/docs…` (primária carregando, `aria-busy`) | `The dialog opens when the clone ends.` |
| Sem clone, falhou | **Try the clone again** `R`, primária | A mensagem do `gh` em `--state-error` |

3. **Os checks** (`ChecksList` da task 3, a variante com o resumo): `3 of 5 passed · 2 not finished`, `1 failed · 3 of 4 passed`, `All 6 passed`, e `· merges clean into dev` ou `· conflict with dev` quando a leitura sabe; `No checks` sem nenhum; a idade é a da leitura da lista (`read 2m ago`); numa PR de um repositório cuja leitura falhou, a idade dá lugar a `◇ acme/ios couldn't be read · 4m ago` (sobre `failedAt`), porque os checks são da leitura anterior. Uma linha por check, com o glifo, o nome em mono, o estado e a duração (P15).
4. **Os fatos**, em `dl` como o painel do card: `Branch` (`idempotency-keys → dev`, mono), `Card` (`#452` como link, o título e o status no board; um card da leitura do board abre o painel dele na visão do board pelo `openBoardCard` da task 5, e o resto abre no GitHub), `Labels` (por vírgula), `Your review` numa PR revisada (`You approved it today at 10:02`, `You requested changes on Sep 22 at 09:30`, `You commented yesterday at 17:40`, `Your review was dismissed on Sep 22 at 09:30`). Nada sem valor.
5. **A descrição**, depois de um fio `--line-1`: o `Markdown` no registro de leitura, como o corpo do card (P16); vazia, `No description.` em `--text-meta` `--ink-3`.

#### As teclas da lista

As teclas de uma letra valem só fora de um campo, sem modificador, na lista e no painel:

| Tecla | Onde | Age | Não age: o aviso de tecla |
|---|---|---|---|
| `R` | Linha em foco; o painel, para a PR dele | `review`: o diálogo de início. `clone`: abre a PR no painel com o foco em **Clone and continue** (ou no botão carregando, ou em **Try the clone again**). `open_review`: abre o review. `open_task`: abre a task | `fork`: `No review of web#2296` · `Pull requests from forks can't be reviewed yet.`; `clone_missing`: `No review of api#1302` · `The clone at ~/code/api is missing.`; num cabeçalho, nada |
| `O` | Linha em foco; o painel | Abre a PR no GitHub | Num cabeçalho, nada |

`↑` `↓` `Home` `End` `←` `→` `Enter` são os do board (`tasks/05-board.md` §4.2, O teclado e o foco da visão), e a regra do foco que perde a linha também. `Esc` fecha o menu, depois o aviso de tecla, depois o painel; o da visão marca o evento (`preventDefault`) para o global não agir. A ordem de Tab: o cabeçalho (`←`, `→`, **Refresh**), as faixas, a barra de filtros, a lista (uma parada), o painel. Um card novo não existe aqui: uma PR nova numa leitura pisca, como o card.

#### Iniciar um review (R6)

O `Dialog` do system, largo (`--size-dialog-wide`, 576 px depois da task 5), `Review api#1302` com o `×`. O corpo, com `--space-4` entre as partes:

- **A PR**, a linha afundada de card de entrada (`components.md` Linha afundada): `api#1302` em `--text-meta` `--ink-3`, o título em 500, e embaixo `lnakamura · idempotency-keys → dev · card #452` (sem card, a parte sai).
- **A espera dos checks**, com algum não terminado ou a mergeabilidade não calculada: uma linha afundada com o glifo do GitHub, `The first pass starts when the checks finish: 3 of 5 passed. You can leave meanwhile.` (com a mergeabilidade só: `The first pass starts when GitHub says whether it merges clean. You can leave meanwhile.`).
- **Model**: o chip do seletor de modelo e esforço, com o padrão de review de PR de **Defaults**, e `From Defaults. It can change in the conversation.` ao lado.
- **Atrás de um clique**, numa linha de botões fantasma `xs`: **Add instructions** (ícone `plus`), que some e abre **Instructions** (`optional`), três linhas, placeholder `What to look at in this pass.`, ajuda `They go to the agent with the pull request, and show as your first message.`, com o foco nele; numa PR sua, **Mode · Publish** (com o chevron), que some e abre o controle segmentado `sm` **Publish** / **Apply**, com a linha do escolhido: `Publish posts the approved findings as a review on GitHub. Fixed once the review starts.` e `Apply has the agent fix the approved findings and push them to the pull request. Fixed once the review starts.`, com o foco no escolhido.
- **O rodapé**: a razão à esquerda; **Cancel** fantasma; **Start review** `Ctrl ↵`, a única primária. O foco começa em **Start review**. `Ctrl+Enter` confirma de qualquer ponto, também da área de texto; `Esc` fecha o `listbox` aberto e depois o diálogo; os atalhos globais ficam inertes.

**Estados.** Confirmando: `Starting…` com o spinner (`aria-busy`), **Cancel** tracejado, `Creating the worktree…` no rodapé, os campos somente leitura. A PR que sai da leitura com o diálogo aberto: **Start review** tracejado, com `api#1298 isn't in the last reading. It was merged or closed.` Um erro fica no rodapé em vermelho e o diálogo aberto, com **Start review** de volta, que é o repetir: a razão do git (`git worktree add failed: … Nothing was created.`) e as recusas do Go (`start.go` `startable`, 148–165), no texto do produto: `The pull request isn't open anymore.`, `Pull requests from forks can't be reviewed yet.`, `This pull request belongs to a task of MySpec. Its review happens in the task.`, `This pull request already has a review in MySpec.`, `Only your own pull request can be fixed in MySpec.`, `This pull request is no longer on GitHub.` (`GoneMessage`), e as falhas do `gh` com as mensagens de `pulls.Failure` (`features.md` §Leitura das pull requests) Criado o review, o diálogo fecha, o review abre, e a linha passa a `In review`.

Um repositório sem clone não chega ao diálogo: o painel oferece **Clone and continue**, e o diálogo abre sozinho quando o clone termina (`usePendingReview.ts`, como hoje).

#### A tela do review: o cabeçalho, a pílula, o `⋯`, os painéis e a faixa (R15, R16)

**O layout** é o da task (`TaskView.tsx:109–202`): o cabeçalho, a faixa de aviso quando há, a conversa na coluna de `--measure-conversation`, a barra do pedido, o compositor, e o painel à direita pela regra do painel do item.

**O cabeçalho** (`review.md` §4): `←`, `→` só com destino, o breadcrumb `Reviews /`, o título da PR em `--text-body` 600, a pílula, e à direita o medidor de contexto (o `ContextMeter` da task, só com a sessão), **Pause** ou **Resume** (o da task, `TaskHeader.tsx:161–189`, com `item: "the review"`, só com a sessão aberta), o grupo de painéis **Details** (ícone `details`) e **Reports** (ícone `file`), e o `⋯`. O topo cede pelos limites da task (`screens/task.md` §3): 1660 o breadcrumb, 1440 os painéis só com o ícone, 1360 **Pause** só com o ícone, 1300 o medidor só com a porcentagem, 1040 a palavra da pílula.

**A pílula** é a `Pill` do system sozinha, dentro de um `Stepper` de uma etapa, com `aria-current="step"`. O nome é `Pass N`: a passada em curso (esperando os checks, rodando, esperando o relatório) ou, sem nenhuma em curso, a última com relatório (a última de `passes[]`, como `reviewPass` em `sidebar-tree.ts:249–251`).

| Momento | Pílula sem barra | Glifo |
|---|---|---|
| Esperando os checks, antes da primeira leitura | `Pass 1` · `checking GitHub` com o brilho | círculo tracejado |
| Esperando os checks | `Pass 1` · `checks 4/6` | círculo tracejado |
| Passada rodando | `Pass 1` · `working` | spinner |
| Aplicando, commitando (Apply) | `Pass 1` · `applying`, `committing` | spinner |
| Publicado, em repouso | `Pass 1` · `published` | círculo fino (o glifo `idle`, que a `Pill` ganha no step 6) |
| Pausado | a pílula neutra · `paused` | duas barras |
| Qualquer situação | `Pass 1` e o glifo da gravidade, sem palavra (a barra a diz) | disco âmbar, losango vermelho, anel verde em `Ready to merge` |

Nome acessível e tooltip, iguais: `Progress · Pass 1 · waiting for the checks, 4 of 6 passed`, `Progress · Pass 1 · Reviewer working`, `Progress · Pass 1 · waiting for you: decide findings`, `Progress · Pass 1 · error: publish failed`, `Progress · Pass 1 · published, changes requested`, `Progress · Pass 1 · paused since 14:52`. Carregando (a primeira leitura do review): o nome com brilho. É uma parada de Tab, sem ação.

**O `⋯`** (o `TaskMenu` da task com os itens do review, agrupados):

- `Pull request web#2291`: **Open PR** (tooltip `Open web#2291 on GitHub`), **Refresh PR** (tooltip `Read the pull request now · checked just now`, só `Read the pull request now` antes da primeira leitura desde que o app abriu, porque `checkedAt` vive na memória; `Reading…` enquanto lê), **Open in VS Code** `Ctrl E` (desabilitado com `· the worktree doesn't exist yet`);
- `Review`: **Review again…** (desabilitado pelas razões de `canReviewAgain`, `convert.go:1560–1576`: `· a pass waits for the checks`, `· a pass is running`, `· the report of pass 1 isn't in yet` em `awaiting_reply`, `· the reviewer is working` com um turno fora de passada, `· the agent is applying the findings`, `· the changes are being committed`);
- depois de um separador, **Delete review…** em vermelho, que abre o `Dialog` do system mínimo e destrutivo: `Delete the review of web#2291?`, `The worktree, the conversation and the reports go away. What was published on GitHub stays.`, **Cancel** (com o foco) e **Delete review** perigoso (`Deleting…`). Apagado, a área dá lugar à página `web#2291 was deleted` (task 2).

`Ctrl+E` em qualquer ponto do review fora de um apontamento abre a worktree, como o item do `⋯`; num apontamento, a linha dele. **Pause** recusado com a sessão em erro diz `Nothing is running to pause: the reviewer's session stopped with an error. Retry it.`

**`Details`** (`review.md` §4), um grupo por seção, na forma de `Details` da task (`PanelSection`, `PanelRow`):

- **Pull request**: `Pull request` (`acme/web#2291`, link externo), `Author`, `Branch` (mono), `Card` (como no painel da PR), `Labels`;
- **Checks read before pass N**, um grupo por passada com os checks guardados, a mais recente primeiro, com a hora da leitura no título (`Checks read before pass 2 · 15:10`, de `checksReadAt`; sem ela, o título sem hora) e o `ChecksList` com o resumo; uma passada sem checks guardados (anterior à task) não tem grupo;
- **Passes**, uma linha por passada: `Pass 1 · changes · 3 findings` (`· clean`, `· no report yet`, `· unreadable`), e à direita `published`, `sent to the agent` ou a hora do relatório (`recordedAt`; sem ela, nada); a linha abre o relatório no painel **Reports**, que toma o lugar de `Details`;
- **Review**: `Mode` (`Publish · fixed`), `Model` (o da sessão, `Opus 5.5 (1M) · high`), `Worktree` (o caminho em mono), `Started` (`Today 13:08`).

**`Reports`**: a lista `Context` e um relatório por passada (`Review 1 · changes · published`), e o escolhido no lugar da lista, com **← Reports** e o Markdown no registro de leitura; um publicado tem acima `Published · Request changes · Sep 24 at 13:41` e **Open on GitHub**. É o `ReportsPanel` de hoje com os componentes do system; a exportação `Published` continua (o History a usa).

**A faixa `Couldn't check GitHub`** (`review.md` §13, R16): a faixa de aviso sob o cabeçalho, na medida da conversa, `◇ Couldn't check GitHub · 3m ago` (`age` sobre `checkErrorAt`), a razão e `New commits, checks and the merge show after the next reading.` em `--ink-2`, e **Try again** secundário `sm`, que chama `RefreshPR` do review (`Reading…` enquanto lê). `role="alert"` quando chega. A hora é a da primeira falha da sequência, e a razão é a mensagem do produto, sem o prefixo `pulls: ` (hoje `poll.go:84` guarda `err.Error()`). Some na primeira leitura boa. Com a barra `Pass blocked` pela mesma falha, a faixa não aparece, para a razão não ser dita duas vezes; volta se a falha continuar depois de **Review again…**. A conversa passa por baixo com o esmaecido.

#### A conversa do review

É a conversa da task 4 (`Conversation`, com `stage=REVIEW_STAGE` e `session=review`), com a voz `Reviewer`. Os marcos do review (P10), cada um uma linha do marco em linha:

| Marco | Texto | Abre |
|---|---|---|
| Início (`review_started`) | `Review started · Opus 5.5 (1M) · high · Publish` | — |
| Checks lidos (`checks_read`) | O texto da task (`markers.ts:330–342`): `Checks read before pass 1 · 6 of 6 passed`, com os nomes dos que falharam e o conflito; o merge limpo fica no resumo do `ChecksList` que ele abre | Os checks guardados da passada, pelo nome |
| Relatório (`pr_review_written`) | `Review 1 written · changes · 3 findings`, `Review 1 written · clean`; uma reescrita, `Review 1 revised · changes · 4 findings` | O relatório no lugar, com **Open in Reports** ao pé; só o marco mais recente da passada abre, os anteriores ficam sem conteúdo |
| Decisões (`findings_decided`) | `You decided · 2 approved, 1 discarded`; numa passada publicada ou enviada antes de o marco existir, a mesma linha derivada das decisões, logo depois do marco do relatório (como `mergedLineOf` deriva o merge em `markers.ts`) | Os apontamentos da passada como eram, desabilitados, cada um com onde foi |
| Publicação (`review_published`) | `Published pass 1 · Request changes · 2 inline comments · the summary in the body`, com **GitHub** (link externo para o review publicado) | — |
| Envio ao agente, Apply | Sem marco próprio: a mensagem do produto `MySpec → Reviewer · apply 2 approved findings` (`markers.ts:274–275`), logo depois de `You decided`, já diz o envio, e a hora fica no apontamento desabilitado (`sentAt`). O mesmo na PR da task (`tasks/07-task-findings.md` §4.2) | O texto enviado |
| Mudanças aprovadas e commit, Apply | `You approved the changes · 3 files staged`, `Committed c19f02e · pushed to #2288` (os da task) | — |
| Commits novos (`new_commits`) | Um marco por head novo que a leitura vê, com os commits entre o head anterior e o novo: `3 new commits · by rsouza` (`by rsouza and tchen`); sem o head anterior entre os 50 lidos (um rebase, um force-push), `New commits · by rsouza` | A lista, uma linha por commit: o hash curto em mono e o assunto; com mais de 20, as 20 últimas e `and 12 more` |

A mensagem de cada passada seguinte, do Apply e do commit são mensagens do produto (`MySpec → Reviewer · pass 2`), como a task 4 já as desenha (`markers.ts:256–275`). As instruções da primeira passada são a primeira mensagem do usuário.

**A espera dos checks** (`review.md` §6): no fim da conversa, o `ChecksList` ao vivo com o cabeçalho `◌ Waiting for checks · 4 of 6 passed`, `checked just now` e **Refresh** (fantasma `xs`, `RefreshPR`), uma linha por check, e ao pé o que falta: `The first pass starts when e2e / chromium and preview-deploy finish. MySpec reads web#2291 every minute; you can leave meanwhile.` Até três nomes, depois `and 2 more`; com a mergeabilidade não calculada, `… and GitHub says whether it merges clean.`; da segunda passada em diante, `Pass 2 starts when…`. Antes da primeira passada não há compositor nem barra (a sessão ainda não recebeu o prompt); da segunda em diante, o compositor fica, como na task.

**A passada** (`review.md` §7): o grupo vivo, `Working · 2m 10s` e **Stop** no compositor, a pílula `working`, a linha 3 da árvore com a ação.

**O Apply em revisão**: o cartão de arquivos da task (`ChangedFilesCard`) como cartão fixo no fim da conversa, como na PR da task (`PRPane.tsx:22–30`), no lugar de `ReviewStrip`, que sai.

**O compositor** (o da task 4, com o contexto do review em `composer.ts`), o placeholder na primeira linha que vale:

| Momento | Placeholder |
|---|---|
| Pausado | `Sending resumes the review…` |
| Sessão parada num erro; turno que falhou | `Sending restarts the reviewer's session…`; `Reply to the reviewer to go on…` |
| Pergunta, permissão, agente trabalhando | Os da task (`composer.ts:101–133`), com `reviewer` |
| Passada com apontamentos, não publicada | `Ask the reviewer to add, change or drop a finding…` |
| Mudanças do Apply em revisão | `Ask the reviewer for a change…` |
| O resto | `Reply to the reviewer…` |

#### A barra do pedido do review

É a barra da task (`RequestBar` com o modelo da task 4), no lugar de `ReviewBar`. O lugar de toda barra do review é a passada (`pass 1`), salvo `Ready to merge`, que diz a PR, como na task; o chip de tempo é o da situação.

| Situação (`status`) | A barra diz | No meio | Ações | Variante | Foco na chegada |
|---|---|---|---|---|---|
| `question` | `● Question · pass 1 18m` | `2 questions` quando há mais de uma | **Show** | quieta | A primeira opção sem escolha |
| `permission` | `● Permission · pass 1 4m` | — | **Show** | quieta | **Allow** |
| `session_error`, sessão parada | `◆ Session error · pass 1 !5m` | — | **Retry reviewer**, primária | erro | **Retry reviewer** |
| `session_error`, turno que falhou | `◆ Session error · pass 1 !5m` | — | nenhuma | erro | O compositor |
| `awaiting_reply` (`reply`) | `● Waiting for the report · pass 1 3m` (a mesma palavra na árvore e no anúncio: `situationLabel` lê o tipo do lugar, e `sessionRequestOf` recebe o rótulo) | A razão (`unreadableReport`, o texto de `prreview.Reason`: `The report can't be read: finding 2 does not open with its location.`), cortada com tooltip | nenhuma: o pedido vai pelo compositor | tingida | O compositor |
| `awaiting_decision` | `● Decide findings · pass 1 34m` | `1 of 3 decided`, e `· 2 commits arrived after this pass` com `stalePass` | **Next to decide** `Alt ↓` secundário; `Decide 2 more` e **Publish review…** primária tracejada (Apply: **Apply approved**) | decisão | O primeiro apontamento por decidir |
| `ready_to_publish` | `● Ready to publish · pass 1 41m` | `2 approved · 1 discarded`, ou `A clean pass`; com `stalePass`, `· 2 commits arrived after this pass` | **Publish review…** `Ctrl ↵`, primária (publicar acontece no diálogo, que não fecha enquanto publica) | decisão | **Publish review…** |
| `publish_failed` | `◆ Publish failed · pass 1 !1m` | A razão (`publishError`) | **Publish review…** `Ctrl ↵`, primária | erro | **Publish review…** |
| `ready_to_apply` | `● Ready to apply · pass 1 41m` | `2 approved findings go to the agent` | **Apply approved**, primária; aplicando, `Sending…` | decisão | **Apply approved** |
| `in_review`, `ready_to_approve` | `● Review changes · pass 1`, depois `● Approve changes · pass 1` | `3 of 5 files staged`, e `· the last approval didn't produce a commit` com `commitFailed` | **Open in VS Code** `Ctrl E`, **Approve** (tracejada com `Stage 2 more files`; primária em 100%) | tingida | **Approve**, ou a primeira habilitada |
| `ready_to_merge` | `● Ready to merge · web#2288` | `Nothing approved in pass 1` ou `A clean pass` | **Open PR**, secundária | tingida | **Open PR** |
| `new_commits` | `● New commits · 3 since pass 1 12m`, contados desde o `PublishedCommit`; sem ele entre os 50 lidos, `● New commits since pass 1` | `Checks 6 of 6 passed · merges clean` (a leitura mais recente) | **Review again…**, primária | tingida | **Review again…** |
| `trouble` (`pr_trouble`) | `◆ Checks failed · pass 1`, `◆ Conflict with base · pass 1`, `◆ Checks failed · conflict · pass 1` (o rótulo de `troubleLabel`, `pull-requests.ts:147`, como na task) | Os checks que falharam pelo nome e `conflict with dev` | **Review again…**, primária, tooltip `Review again reads GitHub and turns this into findings of a new pass.` | erro | **Review again…** |
| `pass_blocked` | `◆ Pass blocked · pass 2 !6m` | A razão (`passBlocked`) | **Review again…**, primária | erro | **Review again…** |
| Pausado | A mesma barra do estado, quieta, com as duas barras no lugar do glifo e sem chip; as situações da sessão não aparecem | | As mesmas | quieta | — |

Sem situação (esperando os checks, rodando, publicado, aplicando, commitando), não há barra. A barra é `role="region"` `Request`, o texto de estado `role="status"`, e a barra que nasce com a tela aberta pisca duas vezes no véu da gravidade e é anunciada: `web#2291: waiting for you: decide findings in pass 1`. `situationLabel` (`lib/situations.ts:74`, `98–102`) passa aos mesmos rótulos (`Ready to publish`, `Ready to apply`, `Decide findings`, e `Waiting for the report` no lugar do review), para a árvore, o anúncio e a barra dizerem a mesma palavra.

**A chegada** (R18): `Ctrl+J` e a notificação levam o foco ao que a coluna "Foco na chegada" diz, pelo mesmo caminho da task (`pendingFocus: "request"`, `ArrivalFocus` em `TaskView.tsx:82–99`, `focusRequest` em `lib/focus.ts:58`), com um alvo novo: o apontamento por decidir. Quando a ação com o foco resolve a situação e some, o foco vai ao compositor, à última entrada sem ele, ao título sem conversa.

#### Os apontamentos: o cartão e o Finding (R7–R11)

**O cartão** (`DecisionCard`, `components.md` Cartão neutro): na conversa, logo depois do marco mais recente do relatório da passada não publicada com apontamentos; `--surface-2` com `--shadow-xs`, raio `--radius-lg`, o cabeçalho `Findings` e `3` em `--ink-3`; dentro, um **Finding** por apontamento, na ordem do relatório, separados por `--space-2`. É uma parada de Tab (`role="group"` `Findings of pass 1`), com roving tabindex entre os apontamentos: o atual é o último com o foco, senão o primeiro por decidir, senão o primeiro. Uma passada publicada ou enviada ao agente não tem cartão: o marco `You decided` abre os apontamentos desabilitados. Uma passada que um **Review again** deixou para trás sem publicar também não. Uma passada limpa não tem cartão (R11).

**O Finding** (`components.md` Apontamento), a grade `número | corpo`:

| Parte | Forma |
|---|---|
| Número | `1`, mono `--text-micro` `--ink-3`, alinhado à direita na coluna de `--key-size` |
| Título | `--text-ui` 600 `--ink-1`; `--ink-2` no descartado. Sem título, a localização sobe para o lugar dele |
| Localização | Ancorado: `web/src/settings/GeneralForm.tsx:84` em mono `--text-meta`, link com a seta externa para a linha em `Files changed` (F14), tooltip `Open on GitHub, in Files changed, at line 84 · O`; ao lado, o botão fantasma `xs` de ícone `openInEditor` (`<>`), nome `Open line 84 of GeneralForm.tsx in VS Code`, tooltip `Open in VS Code at this line · Ctrl+E`, que chama `OpenFindingInEditor`. Geral: `General · not on a line of the diff`, `--ink-3`, sem link |
| Texto | O `Markdown` do agente em `--text-body`, com o código inline em mono sobre `--surface-0`; no descartado, legível, em `--ink-2` |
| Decisão | **Approve** `A` (ícone visto) e **Discard** `D`, secundários `sm` que alternam (`aria-pressed`, `--brand-tint` no ativo); ao lado, `Approved · click again to undo` ou `Discarded · click again to undo` em `--text-meta` `--ink-3`. **Edit** `E`, fantasma `xs`, à direita |
| Edição | No lugar do texto: a área de texto de cinco linhas com o Markdown cru, rótulo oculto `Text of finding 2`, `Saved as you type. It goes to GitHub as you leave it.` (Apply: `It goes to the agent as you leave it.`) e **Done** fantasma `xs`. Vazia: `Write the finding, or discard it.` em erro, `aria-invalid`, e o último texto salvo fica. `Esc` e **Done** fecham, e o foco volta ao apontamento |

**Estados**: padrão (anel `--line-1`), hover (`--line-3`), atual com o foco (`--brand-ring` e o anel de foco por fora), aprovado, descartado, editando, salvando (`Saving…` com o spinner ao lado da decisão), erro (anel `--state-error`, `Couldn't save the decision · Try again` ou `Couldn't save the text · Try again`, com **Try again** que repete), desabilitado (sem decisão nem **Edit**, com `Inline comment · published 13:41`, `In the review body · published 13:41`, `Not published`, `Sent to the agent · 13:41` (de `sentAt`; sem ela, `Sent to the agent`), `Not sent`). O nome: `Finding 2 of 3: Settings asks about unsaved changes as soon as it opens. web/src/settings/useSettingsForm.ts, line 31. Not decided.`

**O teclado** (`components.md` Apontamento, R10): `A` e `D` decidem o apontamento em foco e levam o foco ao próximo por decidir depois dele, com volta ao começo, que rola ao centro (`block: "center"`); a tecla que desfaz a decisão ativa não avança; sem nada por decidir, o foco fica; a repetição da tecla segurada (`event.repeat`) é ignorada. `↑` `↓` andam entre os apontamentos dentro do cartão. `E` edita, `O` abre o GitHub na linha, `Ctrl+E` o VS Code. `Alt+↓` e `Alt+↑` vão ao próximo e ao anterior por decidir de qualquer ponto da tela, o compositor incluído (fora de um diálogo). **Next to decide** faz o mesmo que `Alt+↓`. `Ctrl+Enter` no cartão abre a publicação só quando a barra tem **Publish review…** habilitado. Num apontamento desabilitado, só `O` e `Ctrl+E`.

**A reescrita**: pedido pelo compositor, o agente reescreve; o produto grava `Review 1 revised · …`, e o cartão passa para depois dele, com a decisão e o texto dos apontamentos que não mudaram (`prreview` `inherit`, pela localização e o texto original). Uma edição aberta num apontamento que não mudou continua aberta; num que mudou, fecha com o texto novo.

#### A publicação (R12, R13)

**Publish review…** abre o `Dialog` do system mínimo (`--size-dialog`), `Publish the review of web#2291`, com o `×`. De cima para baixo:

- **A nota**, com `stalePass`: a linha afundada `◇ 2 commits arrived after this pass. Findings on lines that left the diff go in the review body.` (`Commits arrived…` quando o número não é conhecido) com **Review again instead**, fantasma `xs`, que fecha este diálogo e abre o de **Review again…**.
- **Verdict**, rótulo visível, o `OptionGroup` do system (`components.md` Grupo de opções), as opções na forma de opção de pergunta: `1 Request changes` · *The author addresses the findings before the merge.*, `2 Approve` · *It can be merged as it is.*, `3 Comment` · *Feedback without a verdict.* Nenhum marcado. O sugerido leva a etiqueta `Suggested` (a variante `suggested` de `Badge`) com o tooltip `Suggested by your decisions: 2 findings approved` (`nothing approved`, `a clean pass`). A regra: algum aprovado sugere `Request changes`; nenhum, ou um passe limpo, `Approve`. Numa PR sua não há sugestão. As regras do GitHub: numa PR sua, só `Comment` fica habilitado e marcado, com `Your own pull request: GitHub takes only Comment.`; sem resumo e sem apontamento aprovado, só `Approve` fica habilitado e marcado, com `Without a summary and an approved finding, GitHub takes only Approve.`; nos dois, nenhum, as três tracejadas, com `Your own pull request takes only Comment, and a comment needs the summary or an approved finding.` As desabilitadas ficam tracejadas, com a razão por `aria-describedby`. "Sem resumo" é a caixa desmarcada ou um resumo vazio.
- **O que vai para o GitHub**, a linha afundada que muda com as decisões e com a caixa: a parte inline (`2 inline comments`, `1 inline comment`, os ancorados aprovados); a parte do corpo (`the summary`, `1 finding`, `2 findings and the summary` e `in the body`, com os gerais aprovados; sem nada, `nothing in the body` quando há inline); sem nada aprovado, `No finding approved · the summary and the verdict` ou `· the verdict only`; num passe limpo, `A clean pass · the summary and the verdict` ou `· the verdict only`; e, com descartados, `· 1 finding discarded, not published`. Exemplo da cena: `2 inline comments · the summary in the body · 1 finding discarded, not published`.
- **Include the summary**, a caixa de seleção de linha que marca, marcada ao abrir: embaixo, o começo do resumo em `--text-meta` `--ink-2` (até 150 caracteres, cortado numa palavra, com `…`, o Markdown como texto) e **Edit** fantasma `xs`, que abre a área de texto de cinco linhas, salva enquanto se digita (`SetReviewSummary`), com o foco nela. Desmarcada: `The review carries the verdict and the comments only.` (`the verdict only` num passe limpo, ou sem apontamento aprovado). Desmarcar não apaga o resumo (P47). Com a caixa marcada e o resumo vazio, o começo dá lugar a `The summary is empty.` em `--ink-3`, com **Edit**, e a linha do que vai o trata como sem resumo.
- **O corpo mínimo** (P47, decidido): a API do GitHub diz que `Request changes` e `Comment` exigem `body`. O step 3 o prova numa PR real. Exigindo, uma passada publicada com `Request changes` ou `Comment`, sem o resumo e sem apontamento no corpo, envia o corpo `Review with 2 inline comments.` (`Review with 1 inline comment.`), e a linha do que vai diz `2 inline comments · "Review with 2 inline comments." in the body`; com `Approve`, nada vai no corpo. A regra dos vereditos não muda. Não exigindo, nada é gerado.
- **O rodapé**: a razão à esquerda (`Choose a verdict`, ou `Nothing GitHub takes yet`); **Cancel** fantasma; **Publish** primária tracejada até um veredito estar escolhido, depois **Publish · Request changes** `Ctrl ↵`. O foco começa em **Cancel**. `1`–`3` escolhem um veredito habilitado; `↑` `↓` percorrem os habilitados, com volta; `Space` e `Enter` numa opção a escolhem, sem publicar; `Ctrl+Enter` publica só com um escolhido; `Esc` fecha a edição do resumo e depois o diálogo.

**Estados**: nada escolhido, escolhido, um só possível, editando o resumo, publicando (`Publishing…` com o spinner no **Publish**, **Cancel** e `×` tracejados, `Esc` inerte), falha (`Couldn't publish to GitHub: <o que o gh disse>` e as outras razões do produto em vermelho no rodapé, o diálogo aberto, **Publish** de volta). Publicado, o diálogo fecha, o cartão dá lugar aos marcos `You decided` e `Published pass 1 · …`, a pílula diz `published`, e a PR aparece em `In review` com `○ Published · changes requested`. Fechado o diálogo com a falha, a barra é `Publish failed`. Reaberto na mesma passada depois de uma falha, o diálogo traz o veredito e a caixa do resumo da tentativa que falhou (na memória do review, não no Go); uma passada nova começa sem nada escolhido.

#### Review again

**Review again…** (da barra ou do `⋯`) abre o `Dialog` do system mínimo, `Review web#2291 again`, com: a nota afundada `The decisions and edits of review 1 will be discarded.` quando a passada mais recente não foi publicada e tem alguma decisão ou edição; o que a passada faz, em `--ink-2`, pelo caso (publicada com commits novos: `Pass 2 reads the 3 new commits and the checks, and says which of the 2 published findings they fix.`, e `…and writes a new report.` sem apontamento publicado; num check que falhou ou num conflito: `Pass 2 reads the checks and the conflict again, and turns what failed into findings.`; bloqueada: `Pass 2 reads the pull request again, and starts when the checks finish.`; no resto: `Pass 2 reads the pull request and the checks again, and writes a new report.`); **Add instructions** atrás de um clique (a mesma área de texto do início); o rodapé com **Cancel** e **Review again** `Ctrl ↵`, primária (`Asking…`). O foco começa em **Cancel** com a nota, e em **Review again** sem ela. Uma recusa do Go fica no rodapé em vermelho, com o diálogo aberto.

#### O modo Apply (`review.md` §14)

A decisão é a mesma, com **Apply approved** no lugar de **Publish review…** e sem diálogo: **Apply approved** envia na hora, grava `You decided` e a mensagem do produto, e o review passa a `applying` (pílula `applying`, sem barra), depois a `Review changes` com o cartão de arquivos, **Approve**, `committing`, e a passada nova esperando os checks. Com tudo descartado ou uma passada limpa, `Ready to merge`. `Ctrl+Enter` não age no Apply.

#### O fim: a página do review que saiu (R17)

É a página do item que saiu da task 2 (`GoneView.tsx:45–118`, `GonePage`), com o que falta para o review: o título (`web#2291 was merged, and its review ended`; `web#2291 was closed without a merge`), o texto (`rsouza merged it into dev at 16:20. MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.`; fechada: `It was closed at 16:20. MySpec stopped …`), e o resultado num bloco afundado, uma linha por passada, a hora à direita: `Pass 1 · Request changes · 2 inline comments · 13:41`, `Pass 2 · Approve · a clean pass · 15:48`. O que foi, na ordem: `N inline comments` (com `, N in the body` quando há), `N findings in the body`, `the summary`, `the verdict only`, `a clean pass`; `Pass 2 · not published`; no Apply, `Pass 1 · 2 findings sent to the agent · 13:41`, `Pass 2 · nothing approved`. Uma hora que o dado não tem (uma passada anterior a `sent_at`) não aparece: `Pass 1 · 2 findings sent to the agent`. As ações e o foco são os da task 2 (**Next that needs you** `Ctrl J`, **Open in History**, **Back to Reviews**). Os dados vêm do `ArchivedReview` com `mergedBy`, `mergedAt`, `closedAt` e as passadas (P12, P47).

#### A árvore

A linha do review é a da task 2 (`sidebar-tree.ts:563–598` `reviewStanding`), com uma mudança: esperando os checks, `Pass 1 · checks 4/6` (forma curta `checks 4/6`), com `GitHub` à direita, contados dos checks ao vivo do review (P14), e `Pass 1 · checking GitHub` com o brilho antes da primeira leitura. As situações ficam como a task 2 as escreve (`situationText`, 330–450).

#### A primária em cada cena

Conta a camada de cima: com um diálogo aberto, só o diálogo.

| Cena | A primária |
|---|---|
| `list` com `api#1302` no painel | **Start review** do painel |
| `list` sem painel, `list-empty`, `list-failed` sem painel | Nenhuma (**Read now** e **Try again** são secundários) |
| `start` | **Start review** do diálogo |
| `checks`, `pass` | Nenhuma (**Stop** é secundário; **Send** com texto, em `pass`, é a primária, pela regra da task) |
| `findings` | **Publish review…** tracejada na barra (Apply: **Apply approved**) |
| `publish`, `clean` | **Publish** do diálogo |
| `again` | **Review again…** na barra |
| `merged` | **Next that needs you** |
| Pergunta ou permissão no review | **Answer** ou **Allow** no cartão; **Show** é secundário |
| `ready_to_merge` | Nenhuma na barra; **Send** com texto |

Os botões do Finding são secundários; **Next to decide** também.

#### Acessibilidade

A lista é `tree` `Open pull requests, by what they wait for`; os cabeçalhos `treeitem` de nível 1 com `aria-expanded` (menos os vazios), as linhas de nível 2 com `aria-selected` na aberta. O painel é `aside` `Pull request api#1302`. O cartão é `group` `Findings of pass 1`, cada Finding `group` com o nome da tabela acima; a decisão `aria-pressed`; a localização é link com a seta e o nome inteiro. A barra é `region` `Request`. O diálogo de publicação é `dialog` com `aria-labelledby`; os vereditos `radiogroup` `Verdict`. A idade durante uma leitura, o esqueleto, o aviso de tecla e o texto da barra são `role="status"`; as faixas, `role="alert"` ao chegar. Os testes acham cada peça por `getByRole` com o nome desta seção.

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | O lugar da barra: `pass 1` em `review.md` §10 e "a conversa, sem a passada" em `components.md` | No review, o lugar é a passada, em toda barra salvo `Ready to merge`, que diz a PR, como na task | `components.md` (Barra do pedido); `review.md` §10 |
| 2 | A barra só tinha seis momentos; faltavam pergunta, permissão, erro, relatório ilegível, as mudanças do Apply, `Ready to merge` e o pausado | A tabela da §4.2, com o foco na chegada | `review.md` §10, §12, §14 |
| 3 | **Review again** sem reticências em `pr_trouble` e com elas em `new_commits` | No review, **Review again…** abre sempre o diálogo; o texto pelo caso | `review.md` §12; `structure.md` §3; `decisions.md:13–15` |
| 4 | `Publish failed` com **Publish review** sem dizer se abre o diálogo | **Publish review…**, que abre o diálogo | `review.md` §10; `structure.md` §3 |
| 5 | A linha do que vai ao GitHub dizia `nothing in the body` com o resumo indo no corpo | A fórmula da §4.2, que diz o resumo | `review.md` §11; `components.md` (Linha afundada) |
| 6 | O resumo opcional sem dizer se desmarcar o apaga, nem como o Go publica sem ele | A caixa é do diálogo; o Go publica sem o resumo e guarda se ele foi (P47); o resumo vazio conta como sem resumo | `review.md` §11; `backend.md` P47 |
| 7 | A linha "carregando enquanto o review começa" e "erro `Couldn't start`" sem caso no produto (o início é no diálogo) | A linha carrega e falha pelo clone, como o card do board | `review.md` §2.3; `components.md` (Linha de lista) |
| 8 | O estado de uma PR revisada, as labels e `Draft` juntos, `3 new commits` sem o número no Go | `Reviewed` com o seu review no tooltip; até duas etiquetas com `+N`; a contagem vem de P17, e `New commits` quando não se sabe | `review.md` §2.3; `backend.md` P17 |
| 9 | `R` num repositório sem clone, num fork e num clone inexistente | O painel com o foco em **Clone and continue**; os avisos de tecla | `review.md` §2.5, §17 |
| 10 | A contagem do nó contava de novo a PR pendente com review ativo | A contagem da seção `Pending` | `changes.md` R1; `backend.md` P48; `decisions.md:13–15` |
| 11 | Os checks de uma PR sem review, o corpo e o seu review: a fonte e o custo | A leitura da lista, com o custo contado (de cerca de 30 para cerca de 75 pontos por lote de 15 repositórios, a cada 5 minutos), os campos só em `listRepository` e os `commits` com alias | `backend.md` P15–P17 |
| 12 | A faixa de falha: a frase da leitura anterior (mock) e **Try again** por repositório | Sem a frase, como a do board; **Try again** relê a lista inteira, que é uma leitura só | `review.md` §2.7 |
| 13 | O diálogo de início com **Try again** ao lado de **Start review**, e `was merged at 18:02` sem o dado | **Start review** é o repetir; `isn't in the last reading. It was merged or closed.`; as recusas no texto do produto | `review.md` §3 |
| 14 | A pílula em metade dos momentos | A tabela da §4.2 e o que `Pass N` conta | `review.md` §4 |
| 15 | O que falta dos checks: no texto acima (`components.md`) ou ao pé (`review.md` §6); e o compositor numa passada seguinte | Ao pé, no fim da conversa; sem compositor só antes da passada 1 | `components.md` (Checks do GitHub); `review.md` §6 |
| 16 | O cartão de uma passada publicada e o de uma passada deixada por um **Review again** | O primeiro dobra no marco `You decided`, que abre os apontamentos desabilitados; o segundo sai | `review.md` §9; `decisions.md:13–15` |
| 17 | O relatório reescrito: "o antigo vira o marco `Review 1 revised`" | Um marco por leitura do relatório; o cartão vai para depois do mais recente; só ele abre | `review.md` §9; `backend.md` P10 |
| 18 | O apontamento sem título (os relatórios de antes, ou um agente que não o escreve) | A localização no lugar do título; o parser não recusa | `components.md` (Apontamento); `backend.md` P19 |
| 19 | O texto vazio de um apontamento (o Go recusa, `ErrEmptyText`) | O erro no campo, e o último salvo fica | `components.md` (Apontamento) |
| 20 | `A`/`D` sem regra para desfazer, para o último por decidir e para a tecla segurada | Avança só quando decide; o foco fica sem nada por decidir; a repetição é ignorada | `components.md` (Apontamento) |
| 21 | `Ctrl+Enter` no Apply e `O` fora de um apontamento no review | Não agem | `review.md` §17 |
| 22 | O foco na chegada ao review (hoje o título, `app-store.ts:1064–1087`) contra `structure.md` §1 | O que a situação pede, como na task | `changes.md` R18; `decisions.md:13–15` |
| 23 | Os marcos do review sem texto nem fonte | A tabela da §4.2 | `backend.md` P10 |
| 24 | **Try again** de `Couldn't check GitHub` e **Refresh PR** sem binding no review (`RefreshPR` é só da task) | `RefreshPR` do review; `checkedAt` e `checkErrorAt` na memória do review | `backend.md` P20 |
| 25 | A página do review que saiu: `Pass 2 · Approve · the 2 findings fixed` (dado que não existe) e o fechado sem texto | A fórmula da §4.2; `It was closed at 16:20.` | `review.md` §15 |
| 26 | O card no painel da PR abria o GitHub, e o painel `Card` da task abre o board (B13) | O mesmo caminho do B13 | `changes.md` R4; `decisions.md:13–15` |
| 27 | O aviso `New commits since this pass` só no diálogo deixaria de estar à vista durante a decisão (hoje está na barra do review) | No meio da barra de decisão, `· 2 commits arrived after this pass` | `review.md` §10 |
| 28 | "No máximo uma primária" com um diálogo aberto sobre o painel | Conta a camada de cima | §4.2, A primária |
| 29 | `situationLabel` com `Publish review`/`Apply findings`, e a barra com `Ready to publish`/`Ready to apply` | Os rótulos da barra em todo lugar | §4.2 |
| 30 | A crítica da entrada (`research/critique-task-06-input.md` L1–L15 e os ajustes) | As horas guardadas (`recorded_at`, `checks_read_at`, `sent_at`) e nenhuma hora que o dado não tem; a primeira falha da sequência e a mensagem sem `pulls: `; o corpo mínimo de P47; `GonePage` com texto e bloco, `Pill` com `idle`, a idade da leitura no system; a query com alias e o custo de 75; `Ctrl+Enter` só com **Publish review…** habilitado; o step 10 sem **Next to decide**; as razões de **Review again…** do Go; `Waiting for the report` e `Conflict with base` em todo lugar; `You decided` derivado nas passadas antigas e os títulos relidos sem revisão; os commits por head e sem o commit anterior; a faixa escondida com `Pass blocked`; a idade dos checks de um repositório que falhou; `Review changes` provado em jsdom; o diálogo reaberto com a tentativa; o texto do **Pause** recusado; **Refresh PR** sem leitura; `The summary is empty.`; as recusas que faltavam; `trim(summary)`; **Change path…**, **Refresh PR**, `Details` e as instruções do **Review again** em `changes.md` | §4.2, §4.4, §6, §8; `review.md`; `components.md`; `structure.md`; `backend.md` P13, P14, P15, P20, P21, P47; `changes.md` R4, R13, R15; `decisions.md:13–15` |
| 31 | Divergências do mock | Vale o material (`implementation.md:18`). As conhecidas: o apontamento descartado "folds to its title" no espécime (o texto fica); a faixa de falha com `Its pull requests stay as the last reading had them.` e, no espécime, `from the reading of 12:10`; a linha em `Starting the review…` e `Couldn't start`; `api#1298 was merged at 18:02.` e **Try again** no diálogo de início; `nothing in the body` com o resumo; `Pass 2 · Approve · the 2 findings fixed`; `rsouza closed it at 16:20.`; **Publish review** sem reticências na decisão; o foco do **Review again** em **Review again** com a nota; as seções "desabilitada" e "carregando" do espécime (a seção não tem esses estados: o filtro dá a contagem 0, e a primeira leitura é o esqueleto); o diálogo largo e a coluna das teclas com 544 e 112 px (os valores de antes da task 5) | `implementation.md:18` |

### 4.4 O que o tech spec toma

- **A migration `0021`**: `review_findings.title` (texto, vazio por padrão); `review_passes.checks` e `review_passes.mergeable` (o JSON de `store/checks.go:11–32` e o valor de `gh.Mergeable`, como `pr_runs` na `0019`); `review_passes.summary_published` (preenchida para as passadas já publicadas com `trim(summary) <> ''`, porque `PublishedBody` apara o resumo, `body.go:20`); `review_passes.recorded_at` (gravada em `recordFirst`, `service.go:384–402`), `checks_read_at` (em `sendPass`, com os checks) e `sent_at` (em `Apply`), porque `Pass.CreatedAt` é a hora do pedido (`AskPass`, `service.go:307–329`) e não serve a nenhuma tela; `reviews.merged_by`, `reviews.merged_at`, `reviews.closed_at`. Uma migration só, no step 1. Numa passada anterior à task, as horas novas ficam vazias, e a tela mostra a linha sem hora: nunca uma hora que o dado não tem.
- **P19.** `findingHeading` (`prreview/report.go:31–33`) passa a capturar o resto da linha: `^###\s+(\d+)\b\s*(?:[·.:\-–—]\s*)?(.*)$`, o título aparado e sem `**` em volta; vazio é permitido. `ParsedFinding.Title`, `Finding.Title`, `same` (`service.go:750–762`) compara o título, `inherit` (781–799) mantém decisão e texto pela localização e o original, com o título novo. Depois da migration, uma releitura (`rereadPass`, `evaluate.go:80–114`) de uma passada não publicada pode achar títulos que o banco tem vazios, porque os agentes já escreviam texto depois do número: uma releitura que difere só nos títulos grava os títulos sem subir a revisão e sem marco. `findingsFormatNote` (`prompts.go:227–229`) passa a pedir `### 1 · <a short title of what is wrong, one line, no Markdown>`. O prompt é o da seção acrescentada (`reviewSections`, 637–657, só com `External`), então um `pr_review.md` editado pelo usuário não muda, e a PR da task não é tocada (task 7). `storage.md` §Artefatos de um review ganha o título.
- **P14.** A leitura de cada minuto guarda na memória do review (`reviewLock`, `reviewflow.go:162–187`) os checks e a mergeabilidade da última leitura e `checkedAt`; `detailRepository` (`pulls/github.go:68–73`) pede `startedAt` e `completedAt` dos `CheckRun`; `sendPass` (`again.go:264–297`) guarda os checks da leitura que liberou a passada em `review_passes` e grava `checks_read` pela interface `Sessions` (`reviewflow.go:27–37`), que ganha `MarkChecksRead` e os marcos novos. `ReviewSummary` ganha `checks []PRCheck`, `mergeable`, `checkedAt`; `ReviewPass`, `checks`, `mergeable`, `recordedAt`, `checksReadAt` e `sentAt` (no lugar de `createdAt`).
- **P15–P17.** O `prFragment` (`pulls/github.go:46–56`) é das duas queries, a da lista e a de cada minuto, e `detailRepository` (68–73) já tem `commits(last: 1)`: campos de mesmo nome com argumentos diferentes na mesma seleção invalidam a query inteira. Então os campos que só a lista usa vão em `listRepository` (60–63), não no fragmento, e cada `commits(...)` leva um alias: `head: commits(last: 1)` com o `statusCheckRollup` (as horas dos `CheckRun`), `since: commits(last: 100) { nodes { commit { oid } } }` para contar os commits depois do seu review; mais `mergeable`, `body`, e no `reviews(last:1…)` o `state` e o `submittedAt`. `PullRequestRow` ganha `checks`, `mergeable`, `body`, `yourReview {state, at}`, `newCommitCount` (−1 quando o commit não está entre os 100). O custo, cerca de 75 pontos por lote de 15 repositórios (15 × (1 + 100 labels + 100 reviews + 100 commits do head + 100 contexts + 100 commits recentes) / 100), é conferido no `rateLimit { cost }` de uma leitura real, e a query validada contra o schema do GitHub num teste.
- **P18.** `detailRepository` ganha `recent: commits(last: 50)` (com alias, ao lado do `commits(last: 1)` que já tem) com o `oid`, o `messageHeadline` e o `author { user { login } name }`. Depois da última passada publicada, o fluxo grava um marco `new_commits` por head novo que a leitura vê, com os commits entre o head anterior e o novo; a barra conta desde o `PublishedCommit`. Sem o commit de referência entre os 50 (um rebase, um force-push), o marco diz `New commits · by …` com as 20 últimas, e a barra `New commits since pass 1`. `stalePass` ganha a contagem (`staleCommits`) pela mesma lista, vazia quando não se sabe (`Commits arrived after this pass.`). A worktree não é tocada.
- **P20.** `setCheckError` (`poll.go:213–222`) guarda a hora da primeira falha da sequência (ela fica enquanto a leitura falha, com a mesma razão ou outra, e some na primeira leitura boa), e `poll` (84) passa a guardar a mensagem do produto (`failure.Message()`, como `blockPass` em 79–81), sem o prefixo `pulls: ` de `err.Error()`; `ReviewSummary` ganha `checkErrorAt`. `ReviewService.RefreshPR(id)` relê o review pedido fora do minuto, pelo caminho de `poll`; durante uma leitura em curso, que a trava `polling` (`poll.go:37–46`) faria voltar sem ler, ele espera essa leitura terminar e, se ela não trouxe o review pedido, lê só esse.
- **P21.** `pulls.Failure` (`failure.go:24–28`) ganha a hora da primeira falha da sequência: `save` (`service.go:182–208`) a mantém quando o repositório já estava falhando, e a apaga na primeira leitura boa (gravá-la a cada `save` a faria sempre igual a `readAt`). `PullsFailure` ganha `failedAt`.
- **P12.** `detailRepository` pede `mergedBy { login } mergedAt closedAt`; `end` (`poll.go:147–161`) os guarda com o arquivamento; `ArchivedReview` os expõe.
- **P10.** `MarkerType` ganha `pr_review_revised`, `findings_decided`, `review_published`, `new_commits` (o envio do Apply é a mensagem do produto, sem tipo próprio); `MarkerEntry`, `Model`, `Effort`, `Mode` (no `review_started`), `Approved`, `Discarded`, `Verdict`, `Inline`, `Body`, `Summary`, `URL` e a lista dos commits (hash, assunto, autor). `MarkPRReview` ganha a contagem de apontamentos. Onde cada um é gravado: `Start` (o início), `recordAsked` e `rereadPass` (`evaluate.go:54–114`), `sendPass`, `Publish` (`publish.go:22–59`, depois de `MarkPublished`), `Apply` (`apply.go:17–59`), `Approve` e `evaluateCommit` (`changes_approved` e `committed`, como a task), o `settle` do minuto. No frontend, `markers.ts` (`markerOf`, 385–464) ganha o contexto do review (`ctx.review`) para abrir os checks e o relatório, no lugar de `ctx.task?.pr`.
- **P47.** `PublishReview(id, verdict, withSummary)`: `reviewInput` (`publish.go:87–134`) usa o resumo só com `withSummary`, e a regra do review vazio (124–126) conta o resumo que vai; `MarkPublished` grava `summary_published`. A API do GitHub diz que `body` é exigido com `REQUEST_CHANGES` e `COMMENT`, e a trava de hoje supõe que os inline bastam, caminho que quase nunca rodou. O step 3 publica, numa PR real de teste, `Request changes` e `Comment` só com inline e sem corpo. Se o GitHub exigir o corpo, a regra é a decidida na §4.2 (O corpo mínimo): `reviewInput` põe `Review with N inline comments.` (`Review with 1 inline comment.`) no corpo nesse caso, e a linha do que vai o diz; a regra dos vereditos não muda.
- **P48.** `FromReviewCenter` (`convert.go:1233–1285`) conta `PendingCount` sem as linhas com `ReviewID`; `pulls.Filters` perde `PendingOnly` (`filters.go:16–47`), e o JSON guardado com ele é lido sem erro.
- **F14.** O link da linha montado no Go (`ReviewFinding.lineUrl`, com `crypto/sha256` do caminho), porque no frontend o hash é assíncrono (`crypto.subtle`); vazio num geral.
- **A razão do relatório ilegível** (R20). `prreview.Reason(err) string` devolve o texto do produto de um `ErrUnreadable`: a mensagem sem o caminho do arquivo nem o prefixo do pacote, com maiúscula e ponto (`The report can't be read: finding 2 does not open with its location.`), e o de hoje para um erro que não é de formato. `reviewflow` guarda essa razão em `setUnreadable` (`evaluate.go:125–150`) no lugar de `err.Error()`, e é ela que `ReviewSummary.unreadableReport` leva à barra `Waiting for the report`. A task 7 a move para `prreport`, com a PR da task.
- **O modelo da barra.** `TaskRequestModel` e `TaskRequestButton` (`features/task/request.ts:76–113`) passam a um tipo compartilhado (`RequestModel`, ao lado de `RequestBar`), e `sessionRequestOf` (823–897) passa a receber o estado da sessão e o nome do lugar, não a `TaskSummary`, para o review usá-lo. O review ganha `features/reviews/review-request.ts` (`reviewRequestOf(review, now)`), com o alvo novo de foco `finding` em `RequestFocus` (`lib/focus.ts:6`).
- **A chegada.** `openSituation` (`app-store.ts:1064–1087`) passa a pedir `pendingFocus: "request"` também num review; `ArrivalFocus` sai de `TaskView.tsx` para um lugar que as duas telas usam.
- **Os checks.** `lib/pull-requests.ts` (`checkCounts` 33, `liveChecksHeader` 45, `checksSummary` 64, `checkRows` 115) passa a ler uma forma comum `{checks, mergeable, checkedAt}`, que a PR da task, a linha de Reviews e o review dão; `LiveChecks.tsx` recebe essa forma.
- **Os cartões fixos.** O review passa ao `Conversation` o `fixed` (o cartão de arquivos, os checks ao vivo) e o cartão de apontamentos, pelo mesmo caminho do `PRPane` (`PRPane.tsx:22–30`); o cartão de apontamentos se ancora depois do marco do relatório, e o tech spec escolhe entre uma entrada derivada no `buildConversation` (`conversation.ts:400`) e o `fixed`.
- **Os componentes compartilhados.** `PanelSection` e `PanelRow` (`features/task/`) passam a `components/system/`, porque o `Details` do review os usa; `ChangedFilesCard` continua em `features/task/` e abre os arquivos por `openFileInEditor(review.id, path)`, que já atende o review (é o que `ReviewStrip` faz hoje).
- **Onde moram as funções puras**: `features/reviews/review-list.ts` (as seções, o modelo e o nome da linha, as teclas, os avisos de tecla, os chips, os vazios), `pr-panel.ts` (a ação por caso, o resumo dos checks, os fatos, `Your review`), `review-header.ts` (a pílula, o `⋯`, `Details`), `review-request.ts` (a barra, o foco na chegada, o placeholder), `lib/findings.ts` (o próximo e o anterior por decidir, o avanço, o título ou a localização, o estado de cada Finding; em `lib/`, porque a PR da task os usa na task 7), `publish.ts` (a sugestão, as regras do GitHub, a linha do que vai, o começo do resumo, o rótulo de **Publish**), `review-again.ts` (o texto e o foco), e em `features/navigation/` o resultado das passadas da página. `review-status.ts` fica com `outcomeLabel` (o History o usa) e o que ainda servir; o resto sai com os componentes.
- **`components/FilterMenu.tsx`** sai com o último usuário (`ReviewsFilterBar`), depois de a task 5 tirar o do board; `MultiFilterMenu` sai com ele.

## 5. Inventário atual

### 5.1 `features/reviews`

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `ReviewsView.tsx` (1–77) | O lugar: relê ao abrir (27–29), seis linhas de esqueleto (35–43), `emptyText` e **Clear filters** (44–58), a `ul` de linhas (60–66) | Reescrito: o lugar, as faixas, a barra, as seções, o painel |
| `ReviewsHeader.tsx` (1–45) | `checked <idade>` (24), o spinner `Reading pull requests` (28–32), **Refresh** (34–42) | Sai: o cabeçalho do lugar com a idade da task 5 |
| `ReadFailures.tsx` (1–30) | `<dono/nome>: <mensagem>` em `role="alert"` | Sai: a faixa por repositório |
| `ReviewsFilterBar.tsx` (1–104), `MultiFilterMenu.tsx` (1–77) | Dois `FilterMenu`, dois menus de três estados, **Pending only**, **Clear filters**, a escolha otimista (28–48) | Saem: a barra de filtros da task 5 com o menu **Filter**; a escolha otimista vai para a nova |
| `reviews-view.ts` (1–148) | `NO_BOARD`, `EMPTY_REVIEW_FILTERS`, `visibleRows`, `emptyText`, `cycleFilter`, `filterSummary`, `isFiltering`, `sameFilters` | Vira `review-list.ts` (§4.4) |
| `PullRequestRow.tsx` (1–140) | Duas linhas, o ponto `Pending`, `Draft`, `Task`, o estado, o repositório, o autor, três labels, o card, `New commits`/`Reviewed`, **Open on GitHub** e o botão da ação (120–137) | Sai: a linha da §4.2 |
| `StartReviewDialog.tsx` (1–255) | `Start review`, o resumo, o clone com **Clone and continue** (170–190), **Instructions**, `ModelPicker`, o modo, **Start review** | Reescrito: o diálogo da §4.2; o clone vai ao painel |
| `usePendingReview.ts` (1–33) | Reabre o diálogo depois do clone | Fica |
| `ReviewView.tsx` (1–61) | `ReviewHeader`, `ReviewBar`, `ReviewStrip` no Apply (52–54), `FindingsPanel`, a conversa, o compositor, `Reports` | Reescrito: a tela da §4.2 |
| `ReviewHeader.tsx` (1–87) | O modo e o estado em `Badge` com `ToneDot` (50–54), `ContextGauge`, `PauseButton`, `CardLink`, **Reports**, **Delete review** | Reescrito: o cabeçalho com a pílula, `Details`, `Reports` e o `⋯` |
| `ReviewBar.tsx` (1–145) | O link `#N`, o estado, os seis avisos (59–91), **Publish review**, **Apply**, **Approve**, **Review again**, **Open in VS Code** | Sai: a barra do pedido, a faixa, o `⋯` e a nota do diálogo |
| `FindingsPanel.tsx` (1–101), `FindingCard.tsx` (1–91), `useFindingText.ts` (1–37) | O painel acima da conversa, o resumo editável, o cartão com o texto em `Textarea` e o `ToggleGroup` | Saem: o cartão, o **Finding** e a edição; a gravação do texto continua em `useEditedText` |
| `PublishDialog.tsx` (1–125) | `Approve` marcado por ser o primeiro, a contagem, o aviso de commits | Reescrito: o diálogo da §4.2 |
| `ReviewAgainDialog.tsx` (1–100) | **Instructions** sempre à vista, o aviso do descarte, `Asking…` | Reescrito: o diálogo da §4.2 |
| `ReportsPanel.tsx` (1–135), `useReviewArtifact.ts` (1–48) | A lista e o relatório, `Published` (24–40) | Ficam, com os componentes do system; `Published` continua exportado |
| `DeleteReviewDialog.tsx` (1–53) | `AlertDialog` do shadcn | Passa ao `Dialog` do system; o History continua a usá-lo |
| `ArchivedReviewView.tsx` (1–149) | O review arquivado | Fica (task 11) |
| `review-status.ts` (1–211) | Os rótulos dos 16 estados, `showsChanges`, `reviewStatusTone`, `reportLabel`, `publishCounts`, `actionLabel`, `actionHint`, `outcomeLabel` (o History usa) | Encolhe ao que o review, a árvore e o History ainda usam |

Testes: 23 arquivos em `features/reviews` (184 casos); cada um sai com o componente que testa, e os novos nascem no mesmo step.

### 5.2 Outros lugares que a task toca

| Arquivo | Hoje | Destino |
|---|---|---|
| `features/task/ReviewStrip.tsx` e o teste | Só o review o usa (`ReviewView.tsx:52–54`) | Sai: o cartão de arquivos. `where-actions-went.test.tsx` da task não o importa e não muda |
| `features/task/request.ts` (76–113, 823–897), `TaskRequest.tsx`, `TaskView.tsx` (82–99), `LiveChecks.tsx`, `PanelSection.tsx`, `PanelRow.tsx` | Da tela da task | Generalizados (§4.4), sem mudar o que a task mostra |
| `features/chat/markers.ts` (256–275, 330–342, 385–464), `composer.ts` (101–133), `ConversationComposer.tsx` | Sem marco do review além do início; `Sending resumes the task…`; o compositor sem barra | Os marcos da §4.2, o contexto do review e os placeholders |
| `features/navigation/GoneView.tsx` (45–118), `lib/locations.ts` (281–310) | O título e as ações do review que saiu | O texto e as passadas |
| `features/sidebar/sidebar-tree.ts` (563–598) | `Pass N · waiting for checks` | `Pass N · checks a/b` |
| `lib/situations.ts` (98–102) | `Publish review`, `Apply findings` | `Ready to publish`, `Ready to apply` |
| `lib/pull-requests.ts` (33–151) | Os checks da PR da task | A forma comum (§4.4) |
| `lib/focus.ts` (6, 58) | `RequestFocus` sem apontamento | O alvo `finding` |
| `store/app-store.ts` (1064–1087), `store/actions.ts` (646–746) | A chegada no título; `publishReview(id, verdict)` | `pendingFocus: "request"`; `publishReview(id, verdict, withSummary)`, `refreshReviewPR(id)` |
| `lib/wails.ts`, `test/wails-mock.ts` (203–231, 830–982) | Os tipos e as fixtures do review | Os campos novos; `test/review-scenes.ts` novo |
| `components/FilterMenu.tsx` e o teste | Só `ReviewsFilterBar` depois da task 5 | Sai |
| `internal/prreview/report.go`, `review.go`, `service.go` | O título descartado (31–33, 167–184) | P19 |
| `internal/prompts/prompts.go` (227–229) | O formato sem título | P19 |
| `internal/reviewflow/` (`reviewflow.go`, `poll.go`, `checks.go`, `again.go`, `publish.go`, `apply.go`, `evaluate.go`) | §4.4 | P10, P12, P14, P18, P20, P47 |
| `internal/pulls/` (`github.go`, `pulls.go`, `failure.go`, `filters.go`, `service.go`) | §4.4 | P15–P17, P21, P48 |
| `internal/session/transcript.go` (208–237, 280–310), `service.go` (886–960) | Os marcos da task | Os do review |
| `internal/bindings/dto.go` (1066–1301), `convert.go` (1233–1684), `review_service.go` | §5.4 | Os campos, `RefreshPR`, `PublishReview` com o resumo |
| `internal/store/reviews.go`, `internal/store/migrations/0021_*.sql` | — | As colunas novas |

### 5.3 Os componentes do system

| Peça (`components.md`) | Hoje | Nesta task |
|---|---|---|
| **Finding**, **DecisionCard** | Não existem | Nascem genéricos, com testes de componente e pintados nos dois modos |
| Linha de lista (variante PR), Cabeçalho de seção, Barra de filtros, Painel da lista, Bloco do item, Aviso de tecla, Idade da leitura | Da task 5 (a idade da leitura entra em `components/system/` pela task 5, `implementation.md` task 5, porque o cabeçalho do board é o primeiro a usá-la) | Usados; a variante PR da linha, se a task 5 não a fizer; se a idade ficar em `features/board`, o step 6 a move para `components/system/`, e o board passa a importá-la de lá |
| `GonePage` (`GonePage.tsx:17–22`: só `icon`, `title`, `actions`), `Pill` (`Pill.tsx:6`: `StepperGlyph` sem ocioso) | Existem (task 2, task 3) | No step 6, `GonePage` ganha `description` e `children` (o bloco das passadas), e `Pill` ganha o glifo `idle` (o círculo fino de `published`), cada um com o teste de componente e o pintado |
| `RequestBar` (formas `quiet`, `tinted`, `decision`, `error`, `closing`), `Stepper`, `ChecksList`, `NoticeStrip`, `PlaceEmpty`, `SunkenLine`, `Dialog`, `Radio`, `Checkbox`, `SegmentedControl`, `AuxPanel`, `Menu` (com `FilterCycle`), `Badge` (`suggested`), `Link`, `Kbd`, `Tooltip`, `Skeleton`, `Spinner`, `StateGlyph`, `TimeChip`, `ContextMeter`, `icons.ts` (sem `GonePage` e `Pill`, na linha acima) | Existem (tasks 1 a 4) | Usados como estão |

### 5.4 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| A linha: referência, título, autor, labels, draft, own, card, `reviewed`, `newCommits`, `pending`, `filtered`, `taskId`, `reviewId`, `action`, `updatedAt` | `PullRequestRow` (`dto.go:1119–1147`) | `checks`, `mergeable`, `body`, `yourReview`, `newCommitCount` (P15–P17) |
| A falha de um repositório | `PullsFailure` (`dto.go:1084–1088`): o repositório e a mensagem | `failedAt` (P21) |
| A contagem de pendentes | `ReviewCenter.pendingCount` | Sem as PRs com review ativo (P48) |
| O review: a PR, o modo, o estado, o card, a worktree, as passadas, `stalePass`, `checkError`, `trouble`, `publishError`, `passBlocked`, `unreadableReport`, `commitFailed`, o stage do Apply, os vereditos, `can*`, a sessão, as situações | `ReviewSummary` (`dto.go:1189–1270`) | `checks`, `mergeable`, `checkedAt`, `checkErrorAt`, `staleCommits` (P14, P18, P20) |
| A passada | `ReviewPass` (`dto.go:1165–1185`); `Pass.CreatedAt` é a hora do pedido e não é exposta | `checks`, `mergeable`, `recordedAt`, `checksReadAt`, `sentAt`, `summaryPublished` (P14, P47) |
| O apontamento | `ReviewFinding` (`dto.go:1150–1161`) | `title`, `lineUrl` (P19, F14) |
| O review arquivado | `ArchivedReview` (`dto.go:1274–1290`) | `mergedBy`, `mergedAt`, `closedAt` (P12) |
| Os marcos | `MarkerEntry` (`dto.go:719–762`) | Os tipos e os campos de P10 |
| O veredito sugerido, as regras do GitHub, a linha do que vai | As decisões, `own`, o resumo | Só frontend (F15) |
| O item de cada seção, a contagem por seção | A linha | Só frontend |

## 6. As tasks 4, 5 e 6, os riscos e o primeiro step

**A ordem.** A task 4 (PR #71) e a task 5 (card #52) entram antes, em qualquer ordem entre si (`decisions.md:17–19`), e a 6 começa da `main` com as duas. Se a 5 atrasar, a 6 espera: a linha de lista, o cabeçalho de seção, a barra de filtros, o painel da lista, o bloco do item e o aviso de tecla não são construídos duas vezes. A task 7 vem depois e reusa o **Finding**, o **DecisionCard**, o parser com título, `prreview.Reason` e `lib/findings.ts`.

**O que a 6 usa e muda das duas**, arquivo por arquivo:

| Arquivo | Task 4 | Task 5 | Task 6 |
|---|---|---|---|
| `components/system/RequestBar.tsx`, `Pill.tsx`, `Stepper.tsx`, `ChecksList.tsx` | Usa e estende | — | Usa; o modelo da barra passa a um tipo compartilhado |
| `features/task/request.ts`, `TaskRequest.tsx`, `TaskView.tsx`, `request-focus.ts`, `lib/focus.ts` | Cria o modelo, a chegada e o foco | — | Generaliza `sessionRequestOf` e `ArrivalFocus`, sem mudar a task; o alvo `finding` |
| `features/task/ChangedFilesCard.tsx`, `LiveChecks.tsx`, `PRPane.tsx`, `place.ts` | Cria | — | Usa no review; `LiveChecks` lê a forma comum |
| `features/task/ReviewStrip.tsx` | Tira da task | — | Apaga |
| `features/chat/markers.ts`, `composer.ts`, `Conversation.tsx`, `ConversationComposer.tsx`, `conversation.ts` | Cria os marcos, o compositor, os cartões fixos | Não edita (usa `Markdown` por `className`) | Os marcos do review, o contexto do review, os placeholders |
| `internal/session/transcript.go`, `service.go`; `internal/bindings/dto.go` (`MarkerEntry`, `PRCheck`) | Cria os marcos e `PRCheck` | `BoardCard.writtenBy` | Os marcos e os campos do review |
| Linha de lista, Cabeçalho de seção, Barra de filtros, Painel da lista, Bloco do item, Aviso de tecla, Idade da leitura em `components/system/` | — | Cria | Usa; acrescenta a variante PR se faltar |
| `store/app-store.ts` | `pendingFocus` com `request`, `openSituation` | `openBoardCard`, o campo **Board** | `openSituation` do review com `request` |
| `styles/globals.css` | O fio da pergunta, o corte do código | A regra do painel da lista (800 px) | Nada novo, salvo o que o **Finding** pedir |
| Idade da leitura em `components/system/` | — | Cria (no cabeçalho do board) | Usa no cabeçalho de Reviews; move-a se a 5 a deixar em `features/board` |
| `lib/ui-storage.ts` | — | As chaves da memória do board | A chave das seções de Reviews; sem conflito, porque as tasks são sequenciais |
| `features/reviews/ReviewHeader.painted.test.tsx` | — | — | Sai com o `ReviewHeader` de hoje |
| `design/system/tokens.css` | `--size-composer-max` | `--col-keys` 120, `--col-dep` 72, `--size-dialog-wide` 576 | Nenhum token: `--col-ref`, `--col-author` e `--col-state` já existem e cabem (§4.2) |
| `components/FilterMenu.tsx` | — | Tira o do board | Apaga |
| `docs/product/features.md` | §Sessões e conversas, §Review de pull request | §Visão do board, a Home | §Centro de review, §A página do item que saiu, §Depende de mim, §Atalhos |

| Risco | Tratamento |
|---|---|
| **O prompt novo (P19)** | O título é pedido numa seção que o usuário não edita e é opcional no parser: um agente que não o escreve não torna o relatório ilegível. O pronto 11 prova com um review real antes do merge |
| **O custo da leitura da lista** | Os checks, o corpo e o seu review entram na query de 5 em 5 minutos; a conta na §4.3 #11 e a conferência no `rateLimit { cost }` de uma leitura real. A conta é de cerca de 75 pontos por lote (§4.4, P15–P17). Se passar de 150, os checks e o corpo passam a ser lidos só para a PR aberta no painel, com o brilho enquanto lê, e a mudança ganha uma linha em `decisions.md` |
| **A transição dentro da branch** | O cabeçalho novo (step 10) e a barra nova (step 11) convivem com o `FindingsPanel` antigo até o step 13, e do step 11 ao 12 a barra abre o `PublishDialog` antigo. Do step 11 ao 13, a barra de decisão tem o progresso e **Publish review…** tracejado, sem **Next to decide**, e a chegada em `awaiting_decision` vai à barra: **Next to decide**, `Alt+↓`/`Alt+↑` e o alvo `finding` nascem no step 13, com o **Finding** no lugar. Do step 2 ao 8, o interruptor **Pending only** filtra no frontend, com o estado na memória do lugar. Aceitável dentro da branch; nenhum merge parcial |
| **Dados guardados antes da task** | Os apontamentos sem título, as passadas sem checks, os marcos sem contagem, as passadas publicadas sem `summary_published` (a migration preenche) e o filtro com `pendingOnly` são lidos como a §4.3 diz. Uma passada publicada antes da task, sem o marco `findings_decided`, ganha a linha `You decided · …` derivada das decisões; uma releitura que acha títulos que o banco não tem não sobe a revisão. Nenhum quebra a tela |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria |
| **A task 7 reusa o Finding** | O **Finding** e o **DecisionCard** recebem os dados e as ações por props, sem importar o store do review; o pintado prova os dois modos sem o review |

**Como o primeiro step é feito.** É P19 com a migration, só no Go e na fronteira: a `0021` com todas as colunas da task, o parser com o título e os testes de tabela, `same` e `inherit`, o `findingsFormatNote`, `ReviewFinding.title` e `lineUrl`, `convert_test.go`, `task generate`, `lib/wails.ts` e `makeReviewFinding` com o título. Nada na tela muda: a interface de hoje ignora os campos.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/storage.md` §Reviews de pull request, §Artefatos de um review, §Banco | As colunas da `0021`; o título no formato do relatório | 1, 3 |
| `docs/architecture/sessions.md` (a mensagem do app e os marcos) | O prompt com o título; os marcos do review | 1, 4 |
| `docs/architecture/overview.md` §O centro de review, §O estado que o frontend vê | Os campos da leitura, do review e do arquivado; `RefreshPR` | 2, 3 |
| `docs/architecture/design-system.md` §Componentes | **Finding**, **DecisionCard**, o modelo compartilhado da barra | 6 |
| `docs/product/features.md` §Visão Reviews, §Pendente de review, §Filtros, §Leitura das pull requests | As seções, a linha, o painel, os filtros, a faixa, a contagem | 7, 8, 9 |
| §Iniciar um review | O diálogo | 9 |
| §O review como item, §Depende de mim, §A página do item que saiu, §Atalhos | O cabeçalho, a pílula, o `⋯`, os painéis, a faixa, a barra, a chegada, a página, as teclas | 10, 11 |
| §Publicar, §Commits novos e novas passadas | O diálogo, o resumo opcional, **Review again…** | 12 |
| §O relatório e a decisão, §Corrigir a própria pull request, §Sessões e conversas | O cartão, o **Finding**, o teclado, o Apply, os marcos | 13 |

## 8. Plano de steps sugerido

Catorze steps, no teto de G (`implementation.md:7`; a lista inteira num step só seria o maior do plano, e ela se divide em duas sem meio-caminho), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma nova que um step seguinte troque, salvo as transições da §6, dentro da branch.

1. **O título (P19) e a migration.** A `0021` com todas as colunas da task (os títulos, os checks e as horas de cada passada, `summary_published`, o merge), o parser, a releitura que difere só nos títulos, o prompt, `ReviewFinding.title` e `lineUrl` (F14), os mocks (§6). Nada na tela.
2. **A leitura das PRs (P15–P17, P21, P48).** A query da lista com os campos em `listRepository` e os aliases, validada contra o schema, `PullRequestRow` e `PullsFailure` com os campos novos, `failedAt` da primeira falha, `pendingCount`, `PendingOnly` fora do Go e do DTO: no mesmo commit, `ReviewsFilterBar` passa a guardar o estado do interruptor no frontend e a filtrar ali, até o step 8. Nada mais na tela.
3. **O fluxo do review (P12, P14, P18, P20, P47).** Os checks ao vivo e por passada, `recorded_at`, `checks_read_at`, `sent_at`, `checkedAt`, `checkErrorAt` da primeira falha e a mensagem sem prefixo, os commits por head, o merge, `RefreshPR` com a leitura em curso, a publicação sem o resumo (a interface de hoje manda o resumo sempre), os DTOs; e a prova numa PR real de teste de `Request changes` e `Comment` só com inline e sem corpo, com o corpo mínimo se o GitHub o exigir (§4.4, P47), registrada na pull request.
4. **Os marcos do review (P10).** Os tipos e os campos no Go, a gravação em cada ponto, e os textos em `markers.ts` com o contexto do review, com a linha `You decided` derivada nas passadas antigas: a conversa de hoje já os mostra.
5. **As funções puras.** Os arquivos da §4.4, testados em tabela contra a §4.2. Nada na tela.
6. **O system.** **Finding** e **DecisionCard**, `GonePage` com `description` e `children`, `Pill` com `idle`, a idade da leitura em `components/system/` se a task 5 a deixou no board, o tipo compartilhado da barra, `sessionRequestOf` e `ArrivalFocus` generalizados, a forma comum dos checks, `PanelSection` e `PanelRow` no system, a variante PR da linha se faltar; testes de componente e pintados nos dois modos. A task não muda.
7. **A lista I (R3, R5).** O cabeçalho com a idade, as faixas, os estados da leitura e a barra de filtros com **Filter** e os chips, sobre a lista de hoje. Saem `ReviewsHeader`, `ReadFailures`, `ReviewsFilterBar`, `MultiFilterMenu`, `FilterMenu`; **Pending only** fica como um chip que alterna na barra nova, com o estado do step 2, até o step 8 trocá-lo pelas seções.
8. **A lista II (R1, R2).** As seções com a memória, a linha nas duas larguras, os vazios, o teclado e os avisos de `R`, a contagem do nó. Sai `PullRequestRow`. A linha abre, por ora, o diálogo de hoje.
9. **O painel da PR e o início (R4, R6).** O painel com a ação por caso, **Change path…**, os checks com a idade (ou a falha do repositório), os fatos, o card pelo board e a descrição; **Clone and continue** no painel; o diálogo novo com as recusas. Sai `StartReviewDialog` de hoje.
10. **A tela do review I (R15, R16, R17).** O cabeçalho com a pílula, o medidor, **Pause** (com o texto da recusa), `Details`, `Reports` e o `⋯` (com **Review again…** e as razões do Go, **Refresh PR**, **Open in VS Code** e **Delete review…**); a faixa `Couldn't check GitHub`, escondida com `Pass blocked`; a árvore com `checks a/b`; a página do review que saiu com o texto e as passadas. Sai `ReviewHeader` de hoje, com o teste pintado dele; a `ReviewBar` perde **Review again**, **Open in VS Code**, o link e os avisos que ganharam lugar.
11. **A tela do review II (R14, R18, S8 no review).** A barra do pedido em todas as situações, com a de decisão ainda sem **Next to decide** (§6), a chegada (em `awaiting_decision`, à barra), a piscada e o anúncio, `Ctrl+Enter` com **Publish review…** habilitado; a espera dos checks no fim da conversa e o compositor do review; o cartão de arquivos no Apply, provado em jsdom. Saem `ReviewBar` e `ReviewStrip`. **Publish review…** abre, por ora, o `PublishDialog` de hoje.
12. **A publicação e Review again (R12, R13).** O diálogo de publicação com o veredito sugerido, as regras, a linha do que vai (com o corpo mínimo, se o step 3 o pediu), o resumo opcional e `The summary is empty.`, e a tentativa que falhou lembrada; o de **Review again…**. O resumo sai do `FindingsPanel`, que fica só com os apontamentos até o step 13.
13. **Os apontamentos (R7–R11, S10).** O cartão na conversa, o **Finding**, o teclado inteiro, **Next to decide**, `Alt+↓`/`Alt+↑` e o alvo `finding` da chegada, a reescrita, o marco `You decided` que abre os desabilitados, o Apply na decisão. Saem `FindingsPanel`, `FindingCard`, `useFindingText`.
14. **As cenas e o fim.** `test/review-scenes.ts`, os dois testes pintados com as capturas, `where-actions-went.test.tsx`, a conferência de `docs/` contra o que a task fez, e o review real do pronto 11.

Depois do step 14, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md` R1–R18, com R11 e R12 confirmadas pelo usuário (`decisions.md:37–39`, `implementation.md` §4) e o resto decidido com a tela (`decisions.md:49–51`). O que sobrou de produto foi decidido pelo coordenador, por delegação, em `decisions.md:13–15`: a contagem do nó sem os reviews ativos, o card do painel pelo board, a chegada que foca o que a situação pede, **Review again…** sempre com diálogo, **Publish failed** pelo diálogo, a publicação sem o resumo que não o apaga, a passada publicada dobrada no marco, o título opcional e o lugar da barra. Nenhuma delas muda um fluxo inteiro, apaga dado ou desdiz o que o usuário aprovou. O PRD não pergunta nada ao usuário.
