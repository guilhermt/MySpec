# Crítica da task 6 · Centro de review e tela de um review (PR #75)

Primeira leitura da branch `53-redesign-6-review-center-and-the-review-screen` em `d00846e` (16 commits, 288 arquivos, CI verde), na worktree de revisão. A régua é `design/tasks/06-review.md` (o material; `06:N` é a linha N dele), `screens/review.md`, `structure.md`, `principles.md`, `system/components.md`, `system/tokens.css`, `changes.md` R1–R18, `backend.md` P10, P12, P14–P21, P47, P48, F14, F15, `decisions.md` e os mocks `lab/12-screen-review/a.html` (a lista e as cenas do review) e o diálogo de publicação. Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** a task entrega quase tudo o que o material pede, e o que ela entrega funciona. Estão lá a lista por seções com o painel e o diálogo de início, a tela do review com a pílula, `Details`, `Reports` e o `⋯`, e a faixa `Couldn't check GitHub`. Também os marcos, o cartão de apontamentos com `A`/`D`, a barra em todas as situações, a chegada, a publicação com o veredito sugerido e nunca marcado, **Review again…**, a página do review que saiu e todo o Go (P10–P21, P47, P48). Das 34 mutações que rodei, 32 morrem; as duas que sobrevivem são da prova do meio pixel.
- **Provas:** a prova do terço do título mede a coluna, não o título. Por isso ela não viu o defeito que o app real mostra.
- **O que falta fazer:**
  - a PR não tem as capturas do pronto 1;
  - o review real do pronto 11 não foi feito, e nem a prova do corpo mínimo do step 3 nem o custo da leitura foram registrados.
- **Defeitos à vista:**
  - a 812 px, com o painel aberto, uma PR com labels fica com o título em `Bump …` e o `+1` cortado;
  - as teclas não estão escritas nos botões: **Start review** `R`, **Approve** `A`, **Discard** `D`, **Next to decide** `Alt ↓` e **Publish review…** `Ctrl ↵`.

São quatro bloqueios. O 2 precisa do usuário, porque escreve no GitHub numa PR de teste. Os outros três não pedem decisão.

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`, na worktree de revisão, todas verdes:

| Suíte | Resultado |
|---|---|
| `task test:go` (`gotestsum ./...`) | 2.780 testes, 1 pulado |
| `go mod tidy -diff`, `golangci-lint`, `govulncheck` | limpos (0 issues, nenhuma vulnerabilidade) |
| `biome ci .` | 691 arquivos, limpo |
| `pnpm typecheck` | verde |
| `vitest --project unit` | 5.111 testes em 287 arquivos |
| `pnpm test:painted` | 1.147 testes em 64 arquivos |
| `task bindings:check` | sem diff; `git status` limpo depois |

O CI da PR (run `36866840797`) tem **Changes**, **Go** e **Frontend** verdes, e **Build** pulado. A PR está `MERGEABLE` e `CLEAN`. O diff não toca `.github/`, `Taskfile.yml`, `mise.toml`, `build/`, `lefthook.yml`, `biome.json`, `go.mod`, `go.sum`, `package.json`, o lock nem os configs do vite e do vitest.

### Mutações

Cada mutação rodou numa cópia da worktree no scratchpad, desligada do git dela, só com os testes que ela alcança. Os pintados rodaram com a porta do modo browser trocada (63415) para não disputar a 63315.

| Mutação | Onde | Teste | Resultado |
|---|---|---|---|
| A contagem do nó com as PRs que têm review (P48) | `internal/bindings/convert.go:1292` | `./internal/bindings` | falha |
| `failedAt` regravado a cada leitura (P21) | `internal/pulls/service.go:202` | `./internal/pulls` | falha |
| A razão do minuto com o prefixo `pulls: ` (P20) | `internal/reviewflow/poll.go:146` | `./internal/reviewflow` | falha |
| O título com os `**` (P19) | `internal/prreview/report.go:215` | `./internal/prreview` | falha |
| `same` sem o título (P19) | `internal/prreview/service.go:851` | `prreview`, `reviewflow` | falha |
| A releitura só de títulos sobe a revisão | `internal/prreview/service.go:397` | idem | falha |
| O prompt sem o título | `internal/prompts/prompts.go:229` | `./internal/prompts` | falha |
| O resumo sempre publicado (P47) | `internal/reviewflow/publish.go:141` | `./internal/reviewflow` | falha |
| Sem o corpo mínimo (P47) | `internal/reviewflow/publish.go:167` | idem | falha |
| `RefreshPR` volta depois de uma leitura que não trouxe o review | `internal/reviewflow/poll.go:107` | idem | falha |
| Sem o marco `checks_read` (P10, P14) | `internal/reviewflow/again.go:299` | idem | falha (pânico no teste) |
| Sem o marco `new_commits` (P18) | `internal/reviewflow/poll.go:232` | idem | falha |
| A tecla segurada decide de novo | `components/system/DecisionCard.tsx:53` | unit | 1 falha |
| Desfazer avança | `DecisionCard.tsx:64` | unit | 3 falham |
| `Ctrl+Enter` publica com **Publish review…** tracejado | `features/reviews/ReviewView.tsx:130` | unit | 1 falha |
| `Ctrl+Enter` publica do compositor | `ReviewView.tsx:122` | unit | 1 falha |
| `Alt+↓` não age no compositor | `ReviewView.tsx:106` | unit | 1 falha |
| A sugestão invertida | `features/reviews/publish.ts:68` | `publish.test.ts` | 3 falham |
| A PR sua com sugestão | `publish.ts:61` | idem | 1 falha |
| A chegada no título do review (R18) | `store/app-store.ts:1165` | `ReviewView.test`, `app-store.test` | 3 falham |
| A árvore com `waiting for checks` | `features/sidebar/sidebar-tree.ts:580` | `sidebar-tree.test` | 2 falham |
| `R` age numa PR de fork | `features/reviews/review-list.ts:307` | unit | 4 falham |
| A barra nascida sem anúncio | `features/reviews/ReviewRequest.tsx:62` | unit | 2 falham |
| A barra nascida sem piscar | `ReviewRequest.tsx:115` | unit | 2 falham |
| **Open PR** primária em `Ready to merge` | `features/reviews/review-request.ts:98` | unit | 1 falha |
| **Review again…** secundária | `review-request.ts:126` | unit | 4 falham |
| O foco do diálogo de publicação fora de **Cancel** | `features/reviews/PublishDialog.tsx:215` | unit | 2 falham |
| A palavra da pílula até 900 px | `components/system/Pill.tsx:42` | `ReviewView.scenes.painted` | 4 de 54 falham |
| **Approve** primário | `components/system/Finding.tsx:233` | idem | 18 de 54 falham |
| O cartão com meia unidade de padding lateral | `DecisionCard.tsx:101` | idem | 30 de 54 falham |
| O texto cortado sem tooltip | `components/system/ListRow.tsx:128` | `ReviewsView.scenes.painted` | 6 de 34 falham |
| `--col-keys` em 56 px | `design/system/tokens.css:104` | idem | 24 de 34 falham |
| O vão do cartão em 7,5 px (meio pixel vertical) | `DecisionCard.tsx:101` | `ReviewView.scenes.painted` | **sobrevive** (54 de 54) |
| O padding lateral do apontamento em 11,5 px | `Finding.tsx:181` | idem | **sobrevive** (54 de 54) |

As duas que sobrevivem vêm do mesmo motivo: `offWholePixels` (`test/painted.ts:312`) confere só as bordas esquerda e direita das caixas listadas. O item 7 de "Podem esperar" trata disso.

### Capturas

A PR não tem nenhuma:
- o corpo não tem imagens nem tabelas;
- não existe `captures/53-redesign-6-review-center-and-the-review-screen` no `origin`, só as das tasks 3, 4 e 5.

Para olhar, gerei as 78 capturas numa cópia (`MYSPEC_CAPTURES=1`, só `features/reviews`) e fotografei o mock em 48 quadros (`a.html?scene=…`, a 2560, 1250 e 1100, nos dois temas). Comparei os pares `list` 2180 claro e 812 escuro, `start?own` 978, `findings` 2180, `publish` 2180 escuro, `checks` 978, `findings?checkerr` 978, `again`, `merged`, `publish?apply` e `list-failed` 978 escuro. Elas batem com o mock na estrutura, nos textos e nas cores, com estas diferenças:

- **Sem a tecla escrita** em **Start review**, **Approve**, **Discard**, **Next to decide** e **Publish review…** (bloqueio 4). No mock as cinco têm a tecla.
- **`findings` sem o foco no apontamento 2.** `06:19` pede o foco ali, e o mock desenha o anel `--brand-ring`. A cena não põe o foco em lugar nenhum (`test/review-scenes.ts:1157–1168`), então nenhuma captura mostra o apontamento atual.
- **`merged` diz `Migrate settings page to react-hook-form was merged, and its review ended`.** O app diz `web#2291 was merged…`, porque `gone()` recebe `reviewName(review)` (`store/app-store.ts:758`), e `06:344` pede o mesmo. A cena passa o título da PR como nome (`test/review-scenes.ts:1148`).
- **`checks` diz `checked just now`.** `06:19` e `review.md:197` pedem `checked 40s ago`, e o dado da cena está certo (13:09:20 às 13:10). É `age` que arredonda abaixo de um minuto (`lib/when.ts:86`); veja o item 5 de "Podem esperar".
- **`1 of 3` na linha do review.** O mock e `06:128` dizem `1/3`, e o código segue `structure.md:118`; veja o item 6 de "Podem esperar".

Veja o bloqueio 1.

## Bloqueiam o merge

1. **As capturas não estão na PR** (pronto 1).
   - `06:19` pede as capturas anexadas ao pull request, lado a lado com o mock.
   - **Mudar:**
     - corrigir duas cenas antes de capturar: `findings` com o foco no apontamento 2 (`test/review-scenes.ts:1157`), e `merged` com o nome `web#2291` (`:1148`);
     - rodar `task captures` e `task captures:push`;
     - pôr no corpo as tabelas no formato da #73: as onze cenas e as flags da lista de `06:19`, a 2180 e a 978, `list` também a 812 e a 790, `findings` também a 812, nos dois temas.
   - Não pede decisão do usuário.

2. **O review real do pronto 11 não foi feito, e a prova do step 3 não foi registrada.**
   - `06:29` pede, na máquina alvo e registrado na PR:
     - iniciar com os checks rodando, a espera pelo nome e uma passada com títulos;
     - decidir pelo teclado e publicar com e sem o resumo (`Request changes` e `Comment` só com inline, o corpo mínimo de P47);
     - um commit novo, **Review again…** e o merge com a tela aberta.
   - `06:422` pede que o step 3 publique numa PR de teste e registre se o GitHub exige o corpo. O código põe o corpo mínimo sempre (`internal/reviewflow/publish.go:147–150`), o que a documentação da API do GitHub sustenta, mas nada disso está na PR.
   - O custo da leitura (`06:535`) também não foi registrado. No app real, nesta crítica, ele deu `cost: 5` para um lote de um repositório com 5 PRs, em uns 1,1 s. Isso bate com a conta de 75 por lote de 15.
   - **Pede o usuário:** o pronto 11 publica de verdade numa PR de teste e roda o agente com as credenciais dele, e daqui nenhuma das duas coisas pode ser feita (veja "No app real").
   - **Mudar:**
     - fazer o roteiro de `06:29` numa PR de teste;
     - registrar na PR o resultado dos dois corpos e o `cost` medido.

3. **Uma PR com labels perde o título na lista estreita, e a prova do terço não vê.**
   - **No app:** a 812 px de área, com o painel aberto, as quatro PRs de dependabot ficam `Bump …` (uns 52 px de uma linha de ~404). `dependencies` fica inteira e o `+1` vira um traço de 4 px.
   - **A régua:**
     - o título com ao menos um terço da linha (`06:19`);
     - as etiquetas não cortam (`06:121`);
     - 156 px de título a 812 (`06:20`, `06:141`).
   - **A causa:**
     - o título e as etiquetas dividem a coluna do título (`components/system/ListRow.tsx:439`, com `overflow-hidden`);
     - o mínimo do título é um terço da coluna, não da linha (`ListRow.tsx:443`, `min-w-[calc(100%/3)]`);
     - a coluna (156 px) é menor que um terço da linha (~135 px) mais as etiquetas.
   - **A prova:** `ReviewsView.scenes.painted.test.tsx:179–183` mede `row.children[1]`, que é a coluna do título com as etiquetas, não o título. Ela passaria com o título em zero. E nenhuma PR da cena tem label que fique à vista: a de `api#1298` repete o autor e sai.
   - **Mudar:**
     - fazer as etiquetas cederem antes do título: abaixo do terço da linha, só `+N` com todas no tooltip. A régua não diz a forma; é o coordenador quem decide, sem perguntar ao usuário;
     - medir o próprio título contra a largura da linha;
     - pôr na cena uma PR com duas labels, que apareça a 812.

4. **As teclas não estão escritas nos botões.**
   - **A régua:** "O atalho vai no botão (**Allow** `1`, **Next to decide** `Alt ↓`)" (`principles.md` §9). O material escreve a tecla em cada um:
     - **Start review** `R` e **Clone and continue** `R` (`06:162`, `06:168`);
     - **Approve** `A` e **Discard** `D` (`06:312`, e `components.md`, Apontamento);
     - **Next to decide** `Alt ↓` (`06:285`, e `components.md`, Barra do pedido);
     - **Publish review…** `Ctrl ↵` (`06:286–287`).

     O mock desenha todas.
   - **Onde:**
     - `features/reviews/PullRequestActions.tsx:79`, `:117` e `:125` põem o `R` só no tooltip. O `CardActions` do board passa `shortcut="S"` ao `Button`, que desenha a tecla;
     - `components/system/Finding.tsx:233–246` não dá `shortcut` a **Approve** nem a **Discard**;
     - `features/task/request-buttons.tsx:41–52` leva a tecla de todo botão da barra para o tooltip. O helper é da task 4, mas o review o usa nas três teclas que o material escreve.
   - **A documentação:** `docs/product/features.md:577–578` registra "com a tecla `R` no tooltip", o que contradiz a régua.
   - **Mudar:** passar `shortcut` ao `Button` nesses lugares e acertar `features.md`. Mudar `request-buttons.tsx` muda também a barra da task, e é o que o §9 já pede lá.
   - Não pede decisão do usuário.

## Podem esperar

Em ordem de gravidade.

1. **A query não é validada contra o schema do GitHub** (pronto 6, `06:24`).
   - `internal/pulls/github_test.go:264` confere só que a query contém os campos.
   - O risco que o material aponta é real: campos de mesmo nome com argumentos diferentes invalidam a query inteira (`06:416`).
   - **Nesta crítica**, as duas queries valeram contra o GitHub:
     - a da lista, no app real;
     - a de cada minuto, gerada por `detailQuery(2)` e rodada só para leitura por `gh api graphql` nas PRs #62 (aberta) e #74 (mergeada). Voltou sem erros, com `mergedBy`, `mergedAt`, os checks e `recent`.
   - Falta o teste que pegue a próxima mudança na query.

2. **"Lendo vence" falha numa leitura sobre uma lista vazia.**
   - `features/reviews/review-list.ts:604–610` só manda ao esqueleto quando `readAt === ""`.
   - **No app:** logo depois de cadastrar o primeiro repositório, a área diz `No open pull requests.` / `…of your 1 repository…` com **Read now** habilitado, enquanto o cabeçalho diz `Reading…`. O mesmo vale para qualquer releitura de uma lista sem PRs.
   - **A régua:** `06:110`.
   - **Mudar:** com `reading`, **Read now** tracejado ou o esqueleto.

3. **O anel de foco some no WebKitGTK depois de um clique** (do system).
   - **Passo:** abrir o painel por clique e fechá-lo com `Enter`. Depois disso, `↓` leva o foco à linha seguinte sem anel e sem `R review`, embora o foco esteja lá (`Enter` abre a PR).
   - **Causa:** o anel depende de `:focus-visible` (`ListRow.tsx:101, 115`). O board da task 5 usa a mesma linha.

4. **As faixas são sempre `role="alert"`:**
   - `features/reviews/ReviewsReadingStates.tsx:46`;
   - `features/reviews/CheckStrip.tsx:47`.

   `06:104` e `06:238` pedem o alerta só quando a faixa chega; montar a tela anuncia de novo. É o item 10 da crítica da task 5, repetido.

5. **`checked just now` no lugar de `checked 40s ago`.**
   - **A régua:** `06:19`, `06:223` e `review.md:168, 197` escrevem segundos.
   - **O código:** `age` diz `just now` abaixo de um minuto (`lib/when.ts:86`).
   - Numa leitura de minuto em minuto, a idade passa quase sempre por `just now`. **Opinião:** os segundos dizem mais. Ou o código passa a escrevê-los, ou o material registra `just now`.

6. **A régua se contradiz em dois pontos:**
   - **A fração:** `06:128`, `review.md:52` e o mock escrevem `Decide findings · pass 1 · 1/3`, e `structure.md:118` escreve `a of b`, que é o que o código segue (`sidebar-tree.ts:432`).
   - **A forma curta:** `06:20` pede que `Published · changes requested` passe "à forma curta", mas `structure.md:150` não dá forma curta a `Published`. O teste (`ReviewsView.scenes.painted.test.tsx:247`) registra isso e prova o corte com tooltip.

   **Mudar:** acertar `06` e `review.md`.

7. **A prova do pixel inteiro é só horizontal.**
   - Ela confere `left` e `right` (`test/painted.ts:312`), só das caixas listadas.
   - Um vão vertical de 7,5 px no cartão passa, e um padding interno de 11,5 px no apontamento também (as duas mutações que sobrevivem).
   - **Opinião:** `principles.md` §10 diz "tudo o que o layout posiciona", e o anel de 1 px do apontamento em meia linha borra no WebKitGTK. Conferir também `top` e `bottom`.

8. **A razão `Decide 2 more` vem depois de **Publish review…**.**
   - `components/system/Button.tsx:140–148` põe a razão depois do botão.
   - `06:285` e o mock põem antes; nas capturas fica `Publish review… Decide 2 more`.
   - O `Button` é do system.

9. **`Cancel` secundário em todo diálogo do review.**
   - `DialogCancel` (`components/system/Dialog.tsx:203`) desenha com borda e fundo.
   - `06:195`, `06:330` e o mock pedem fantasma.
   - É do system e vale também para os diálogos da task 5.

10. **`OptionGroup` é um componente novo do system sem entrada em `design/system/components.md`.**
    - Só `docs/architecture/design-system.md:127, 221` o descreve.
    - `components.md` (Diálogo de publicação) e `06:326` ainda dizem `RadioGroup`.

11. **Sobras e detalhes:**
    - `features/reviews/useFindingText.ts` continua, embora `06:451` diga que sai. É um invólucro fino de `useEditedText`;
    - `ReviewsView.tsx:7` importa `FLASH_MS` e `LIST_COLUMN` de `features/board/BoardView`, uma feature importando de outra. **Opinião:** os dois pertencem ao system, ou a `lib/`;
    - **opinião:** no menu **Filter**, os itens de **Board** e **Repository** têm o recuo do visto, e os de **Author** e **Label** não.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | **Cobertura:** as cenas cobrem as onze e as flags de `06:19`, nas larguras e nos dois temas. As fixtures batem com `review.js`: as nove PRs, os três apontamentos com título, as horas e as flags. **Provas:** pixel inteiro horizontal (30 falham na mutação), uma primária (18), a palavra da pílula (4), os textos cortados com tooltip (6), a coluna das teclas (24). **Falham:** as capturas na PR (bloqueio 1) e o terço do título, que mede a coluna (bloqueio 3); duas cenas desenham o que não devem |
| 2 | **Falha** | A borda 1041/1040 com 425 px, os 452/156/284 a 812, o painel sobre a lista a 790 e a pílula sem palavra a 978 estão provados. O título de uma PR com labels a 812 não (bloqueio 3) |
| 3 | Ok | `ReviewsView.keys.test.tsx` e `ReviewView.keys.test.tsx` cobrem a lista do pronto. As mutações de `A`/`D` (repetição, desfazer), `Ctrl+Enter` (tracejado, compositor), `Alt+↓` no compositor, `R` no fork e o foco do diálogo são pegas |
| 4 | Ok | `publish.test.ts`, em tabela, com o corpo mínimo na linha do que vai; as mutações da sugestão e da PR sua são pegas |
| 5 | Ok | `internal/prreview/report_test.go` em tabela, com as formas do título, `same`, a releitura e o prompt; quatro mutações pegas |
| 6 | Ok, com ressalva | Os testes de `reviewflow`, `pulls` e `bindings` pegam todas as mutações do Go. A query não é validada contra o schema por um teste (item 1 de "Podem esperar"); validei as duas contra o GitHub nesta crítica |
| 7 | Ok | `where-actions-went.test.tsx` tem uma linha por controle do terceiro parágrafo, de **Pending only** a `Nothing to change.` e aos seis avisos, e a primária única em cada situação; as mutações de variante são pegas |
| 8 | Ok | A chegada pela situação, o anúncio e a piscada; três mutações pegas |
| 9 | Ok | `Pass 1 · checks 4/6` e `4 pending` sem os reviews ativos; mutações pegas no frontend e no Go |
| 10 | Ok | `findings?apply` e `publish?apply` nas cenas; `Review changes` e `Changed files · 2` provados em jsdom (`ReviewView.test.tsx:549–555`); `ReviewStrip` saiu |
| 11 | **Falha** | Não feito (bloqueio 2) |
| 12 | Ok | Cada teste removido tem o substituto no mesmo commit (`83ffd36`, `f7aeff0`, `bb83a2b`, `e453942`) |
| 13 | Ok, com ressalva | As seções de `features.md`, `overview.md`, `sessions.md`, `storage.md`, `design-system.md` e `troubleshooting.md` estão reescritas, no presente; `features.md:577–578` registra o desvio do bloqueio 4 |
| 14 | Esta crítica | — |

## O que saiu

- Saíram, com os testes: `FilterMenu.tsx`, `MultiFilterMenu`, `ReadFailures`, `PullRequestRow`, `reviews-view.ts`, `ReviewBar`, `FindingsPanel`, `FindingCard` e `ReviewStrip`. Nada os importa mais.
- `ReviewsHeader`, `ReviewsFilterBar`, `StartReviewDialog`, `ReviewHeader`, `PublishDialog`, `ReviewAgainDialog` e `DeleteReviewDialog` foram reescritos no mesmo arquivo. `DeleteReviewDialog` e `Published`, de `ReportsPanel`, continuam exportados para o History.
- O review não usa mais `ToneDot`, `ContextGauge` nem `CardLink`. Fica só o `CardLink` de `ArchivedReviewView`, que é da task 11.
- `useFindingText` ficou (item 11 de "Podem esperar").
- `Radio`, `Listbox` e `Placeholder` do system não têm uso, mas já não tinham em `main`.

## Tokens e contraste

**Nenhuma cor, duração ou tamanho solto** no diff onde há token. `tokens.css` não muda, como `06:528` pede. O `FLASH_MS = 2 * 280` é o mesmo da task 5, agora exportado e reusado.

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css`, com os véus compostos em sRGB sobre a superfície (claro / escuro). Todos passam 4,5:1:
- `ink-3` sobre `surface-2` (o número, o local geral, `Findings 3`, `Approved · click again to undo`, o desabilitado): 7,29 / 7,09; com o hover do botão, 6,53 / 5,91;
- `ink-2` sobre `surface-2` (o descartado): 10,88 / 9,65;
- `brand-ink` sobre `surface-2` (a localização): 6,43 / 8,15;
- `brand-ink` sobre `brand-tint` (**Approve** pressionado, `Suggested`): 5,43 / 6,17;
- `ink-1` sobre `surface-0` (o código inline): 16,22 / 15,90;
- `state-error` sobre `surface-2` (`Couldn't save…`): 6,11 / 5,94;
- a barra de decisão: `state-wait` sobre `state-wait-veil` 5,60 / 8,86; `ink-2` 9,83 / 9,25; `ink-3` (`Decide 2 more`) 6,59 / 6,79; o chip `34m` 7,39 / 9,12;
- `ink-2` sobre `surface-0` (a razão da faixa): 9,74 / 11,60;
- `ink-3` e `ink-2` sobre `surface-3` (o diálogo): 7,29 / 6,66 e 10,88 / 9,08;
- `brand-on` sobre `brand`: 5,66 / 7,79.

**Não texto:**
- o anel do apontamento atual (`brand-ring` sobre `surface-2`): 4,36 / 3,97;
- o anel em hover (`line-3`): 3,50 / 3,25;
- o foco: 5,57 / 7,18;
- o anel padrão (`line-1`): 1,30 / 1,12. É decorativo, porque o apontamento se separa pelo vão e pelo número.

**Estado sem cor como único portador:**
- a decisão é `aria-pressed`, tem o fundo, o anel e a frase `Approved · click again to undo`;
- o veredito escolhido é `aria-checked`, com o anel e a tecla em `brand`;
- a falha leva o losango e o texto.

## No app real

**Como rodou:**
- `task build` numa cópia em `d00846e`;
- `bin/myspec` com `dbus-run-session`, `GDK_BACKEND=broadway` (`gtk4-broadwayd`), dirigido por um Chromium headless, com `GH_TOKEN` de `gh auth token`;
- `XDG_DATA_HOME`, `XDG_STATE_HOME` e `XDG_CONFIG_HOME` temporários, e um HOME falso com um clone novo de `guilhermt/MySpec`, para o **Add repository** não listar os clones do usuário;
- `WAYLAND_DISPLAY` e `DISPLAY` retirados, porque com eles o portal se ligava à tela do usuário;
- o repositório foi cadastrado pelo diálogo.

Nada foi escrito no GitHub. O app, o dbus e o broadwayd foram encerrados pelo PID, e os temporários, apagados.

**O que o app mostrou:**
- **A árvore:** `Reviews 4 pending` e `No review in progress.`.
- **O cabeçalho:** `Reading…` com **Refresh** tracejado; depois `Read just now`, `Read 1m ago`.
- **As seções:** `Pending 4`, `In review 0` e `Reviewed 0` sem chevron, e `Yours and your tasks 1` recolhida. Expandida, ela mostra `MySpec#75 … you · Yours`.
- **A linha:** `MySpec#63 Bump … [dependencies] [+1] dependabot Never reviewed`. A 2180 e a ~1050 ela fica numa linha só; a 812, em duas. Com o foco, a linha mostra `R review`.
- **O menu Filter:**
  - os quatro grupos, com `guilhermt · you` e a legenda `click to hide, again to keep only`;
  - dependabot oculto dá o chip `Author −dependabot ×` e **Clear filters**, o menu fica aberto, a contagem vai a `Pending 0`, e o nó perde a contagem.
- **O painel de #63:**
  - `dependabot · Never reviewed · updated 4 days ago` e **Start review** primária, sem o `R` (bloqueio 4);
  - `All 3 passed · merges clean into main` com `read just now`, os três checks com a duração, `Branch`, `Labels` e a descrição em Markdown;
  - com a janela de 1100 ele fica ao lado da lista, e com 1080 a cobre.
- **O diálogo de início:** `Review MySpec#63`, a linha afundada, **Model**, **+ Add instructions**, **Cancel** e **Start review** `Ctrl ↵`; `Esc` fecha.
- **O log:** `pull requests read` com `repositories: 1`, `pull_requests: 5`, `duration_ms: 1108` e `cost: 5`; de novo cinco minutos depois, com 1077 ms. Nenhum WARN nem ERROR.
- **Os defeitos que só o app mostrou:** o título a 812 (bloqueio 3), "Lendo vence" (item 2 de "Podem esperar") e o anel de foco (item 3).

**O que o app não mostrou: a tela do review inteira.**
- Isso inclui a pílula, a espera dos checks, a barra, o cartão com títulos reais, `A`/`D`/`Alt+↓`, o diálogo de publicação, o `⋯`, `Details`, `Reports` e **Delete review**.
- **Por quê:** iniciar um review roda o agente com as credenciais do `claude` do usuário. Ligá-las ao HOME falso foi negado pela permissão, e não houve tentativa de contornar.
- **O que cobre essa parte:** as 54 capturas pintadas do review e o pronto 11 (bloqueio 2).
- **Também ficaram sem ver:**
  - a faixa de falha (nenhuma leitura falhou);
  - os avisos de `R` em fork e em clone inexistente;
  - **Clone and continue**;
  - o meio pixel, que fica com as provas pintadas.

## Segunda leitura (4223c35)

Só as correções, `d00846e..4223c35` (13 commits), na worktree de revisão. `task check` verde na ponta (Go 2.780 testes, 1 pulado; vitest 334 arquivos, 6.153 testes; lint, typecheck, vuln e bindings limpos; `git status` sem nada além desta crítica). `gh pr checks 75`: **Changes**, **Go** e **Frontend** verdes, **Build** pulado; `MERGEABLE`, `CLEAN`, cabeça `4223c35`. As mutações rodaram numa cópia no scratchpad, com o pintado na porta 63415, e a cópia foi apagada.

### Veredito

**Mergear depois do roteiro do usuário.** Os bloqueios 1, 3 e 4 estão fechados como o "Mudar" pedia, e o 2 está pronto para o usuário na checklist `## Verification on the target machine`. Antes do merge, junto com o registro do roteiro, falta uma linha de documentação: `docs/product/features.md:698` ainda diz `checked 40s ago`, e o código diz `just now` (veja "Novo").

| Bloqueio | Situação | Evidência |
|---|---|---|
| 1. Capturas | Fechado | `captures/53-…` no `origin` (commit 12:27, depois de `4223c35`). O corpo tem as tabelas no formato da #73: as doze cenas a 2180 e a 978, as seis flags, `list` a 812 e a 790, `findings` a 812, nos dois temas. São 78 URLs, e as 78 existem na árvore da branch (`gh api …/git/trees`). As duas cenas foram corrigidas: o foco no apontamento 2 (`test/review-scenes.ts:1167`) e `web#2291` em `merged` (`:1150`). As duas são provadas em `ReviewView.scenes.painted.test.tsx:155–164`, com o foco, o `--brand-ring` e o texto |
| 2. Roteiro na máquina alvo | Com o usuário | A checklist no corpo cobre o que `06:29` e `06:422` pedem: checks rodando e a espera pelo nome, passada com títulos, `A`/`D`/`Alt+↓`/`Ctrl+Enter`, publicar com e sem o resumo, o campo para dizer se o GitHub exige o corpo, commit novo e **Review again…**, merge com a tela aberta, e o campo para o `cost` |
| 3. Título contra as etiquetas | Fechado | `ListRow.tsx:418–449` (`useTagsForm`) mede o terço contra a linha (`box.parentElement`), com a ressalva do texto inteiro quando ele é mais curto. A ordem é inteiras, depois um só `+N`, depois nenhuma. `review-list.ts:251–258` monta o `+N` com `Draft` e todas as labels no tooltip, e o nome acessível continua dizendo `draft` e `label …`. A prova olha o próprio título contra a linha (`ReviewsView.scenes.painted.test.tsx:193`, `leastTitle`), e `:301` prova `api#1298` com `dependabot` e `dependencies`: `dependencies +1` a 2180, `+2` a 978, nenhuma a 812, título inteiro a 2180 e com o terço, cortado, a 978 e a 812. **Mutações:** o terço pela coluna (`row = box`) morre, 12 falham; nunca dobrar, 12; dobrar sem nunca sair, 6; `least = 0`, 12; o `ListRow.tsx` de `d00846e` contra as provas novas, 16. **Capturas:** a 812 claro, `api#1298 Bump golang.org/x/ne…` sem etiquetas, com os títulos ocupando a coluna inteira (156 px, acima do terço de ~135); a 978, `Bump golang.org/x/net from 0.29.0 t… [+2]` e `Empty state for the audit log [Draft]` inteiro |
| 4. Teclas escritas | Fechado | **Start review** `R` e **Try the clone again** `R` (`PullRequestActions.tsx:79`, `:115`); **Clone and continue** `R` no botão e no tooltip `· R`, como `06:168` pede (`:121–126`); **Approve** `A`, **Discard** `D` e **Edit** `E` (`Finding.tsx:236`, `:244`, `:272`); a barra escreve a tecla de todo botão (`request-buttons.tsx:36`): **Next to decide** `Alt ↓`, **Publish review…** `Ctrl ↵` só quando habilitada (`06:285–287`), e **Open in VS Code** `Ctrl E` na barra da task e na do review. **Mutações:** tirar a tecla de **Approve**, de **Edit**, de **Start review**, de **Try the clone again** e da barra; as cinco morrem. A barra da task bate com `principles.md` §9 ("o atalho vai no botão"). O material da task 4 não fala da tecla nesse botão, e `features.md:447` e `:702` passam a dizê-la. A forma `Ctrl E` no botão e `Ctrl+E` no menu e no tooltip segue a convenção de `components.md:171`. Nas capturas: `findings` 978 com `Approve A`, `Discard D`, `Edit E` e `Next to decide Alt ↓`; `publish` 978 com `Publish review… Ctrl ↵`; `scene-manual` 950 com `Open in VS Code Ctrl E`, `Stage 2 more files` e **Approve** tracejado |

### Itens de "Podem esperar" fechados

- **2 (lendo vence numa lista vazia):** **Read now** fica tracejado com `A reading is running.` (`ReviewsReadingStates.tsx:82`). A mutação morre.
- **5 (`checked just now`):** o material passou a registrar `just now` (`06:19`, `06:223`, `06:254`, `review.md:168`, `:197`). Sobrou `features.md:698` (veja "Novo").
- **6 (a régua):** a forma longa ficou `1 of 3` e a curta `1/3` em `06:128`, `06:139`, `06:143` e `review.md:52`, coerentes com `structure.md:118`. `06:20` agora corta `Published · changes requested` com tooltip, citando `structure.md:150`.
- **7 (pixel inteiro):** `offWholePixels` confere as quatro bordas (`test/painted.ts:320`), e `parts` inclui os filhos do apontamento (`ReviewView.scenes.painted.test.tsx:116`). As duas mutações que sobreviviam morrem: o vão de 7,5 px no cartão e o padding lateral de 11,5 px no apontamento, com 30 falhas cada. A vertical de 11,5 px no apontamento também morre.
- **7, no New task:** o `divide-y` trocado por sombra interna (`NewTaskDialog.tsx:388`) não muda o desenho. Cada `li` tem altura fixa (`h-(--size-control)`), então a lista tem a mesma altura. O fio fica no mesmo lugar, o pixel de cima da linha de baixo, e o chip desce meio pixel para o inteiro. Voltar ao `divide-y` faz falhar 4 testes de `NewTaskDialog.scenes.painted`. **Correção da premissa:** o fio é `--line-1`, não `--line-2`. Era `divide-line-1` antes, e `components.md:298` pede `--line-1`.
- **8 (a razão antes):** a razão vem antes do botão em `Button.tsx:140–150`, provado por `Button.painted.test.tsx:102`; a mutação morre. Isso bate com os mocks (`lab/09-screen-task/src/content.js:225`, `lab/08-visual-final/specimen.html:1287`). O painel do card da task 5 não muda: `CardActions.tsx:75` passa `reasonId`, e a razão continua sob as ações, como `cd-why` no mock. Nas capturas: `findings` 978 com `Decide 2 more` antes de **Publish review…** tracejado, e `scene-manual` 950 com `Stage 2 more files` antes de **Approve**.
- **9 (`Cancel` fantasma):** em `Dialog.tsx:209`, provado por `Dialog.painted.test.tsx:72`; a mutação morre. Vale para todos os diálogos. A primária continua uma por diálogo: `visiblePrimaries` está verde nas cenas, e nas capturas `start` e `publish` têm uma primária cada, com **Cancel** fantasma.
- **10 (`OptionGroup`):** a entrada **Grupo de opções** está em `components.md`, com anatomia, estados, tokens, teclado e acessibilidade; `components.md:806` e `06:326` dizem `OptionGroup`.
- **O teste intermitente de `DeleteReviewDialog`:** agora usa `waitFor` sobre o foco (`DeleteReviewDialog.test.tsx:31`). O teste diz o mesmo, sem ficar mais fraco.

### O que sobrou aberto

Não foram tratados, e nenhum bloqueia:
- **Item 1:** a query sem validação contra o schema.
- **Item 3:** o anel de foco no WebKitGTK depois de um clique.
- **Item 4:** as faixas sempre `role="alert"`.
- **Item 11:** `useFindingText`, `ReviewsView.tsx:7` importando de `features/board` e o recuo do menu **Filter**.

### Novo

- **`docs/product/features.md:698` contradiz o código.** Diz "o tooltip diz `checked 40s ago` quando o app já leu", e `age` (`lib/when.ts:86`) escreve `just now` abaixo de um minuto, então `40s ago` nunca aparece. É a mesma correção do item 5, que ficou faltando aqui; uma linha.
- **`06:289` e `screens/task.md:207` não escrevem a tecla no **Open in VS Code** da barra.** O código e `features.md:447`, `:702` escrevem `Ctrl E`. Não é contradição, porque os dois só não a mencionam, mas o mock da task 4 também desenha o botão sem a tecla. **Opinião:** o código está certo pelo §9; acertar as duas linhas da régua quando alguém passar por elas.
- **O fio entre as linhas de **Models** não tem prova.** Tirar a sombra inteira deixa os 8 testes de `NewTaskDialog.scenes.painted` verdes. Não é regressão, porque o `divide-y` também não tinha prova. Fica para quem mexer no diálogo.
- Nenhuma forma de histórico no que mudou em `docs/` e `design/`. `06` e `review.md` estão coerentes entre si e com `structure.md` nos pontos do item 6.
