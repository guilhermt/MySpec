# Crítica da task 12 · Consistência e remoção do design antigo (PR #95)

Leitura da branch `59-redesign-12-consistency-pass-and-removal-of-the-old-design` em `3fb9362` (17 commits, CI verde, com os jobs `Changes`, `Frontend`, `Painted (1/3)`, `Painted (2/3)`, `Painted (3/3)`, `Go` e `Build`), na worktree de revisão. O diff tem 86 mil linhas. Dessas, 75 mil são `internal/pulls/testdata/schema.docs.graphql`, o schema do GitHub que o teste de R4 lê; o resto são uns 10,6 mil. A régua, nesta ordem:

- `design/tasks/12-consistency.md` (o material; `12:N` é a linha N dele);
- `design/research/critique-task-12-pass.md` (o relatório do passe, o PRD: 75 itens, 22 lacunas e as pautas);
- `principles.md`, `system/components.md`, `system/tokens.css`, `structure.md` e `screens/*.md`;
- `implementation.md` §12 e `decisions.md`.

Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa. Esta crítica faz o papel da `Revisão da branch` que `12:23` pede ao relatório.

## Veredito

**Corrigir antes do merge.**

- **O trabalho:** dos 75 itens do relatório, 72 estão feitos e 3 parciais (S6, T12 e H2); nenhum ficou sem fazer.
  - Saiu o design antigo: `--status-*`, `react-resizable-panels`, `ModelPicker`, `ReviewModePicker`, `useFindingText`, `CutCode` e oito primitivos sem uso de `components/ui`. `knip` dá 0.
  - As verificações V1 a V8 moram onde o material diz, rodam no `lint:web` e mordem: cada uma foi violada numa cópia, e o `lint:web` falhou.
  - No app real, os três itens que bloqueavam estão resolvidos na forma que o passe viu:
    - o anel de foco depois do clique e do script (S1);
    - o prompt de início do step fora da fila (T1);
    - a faixa de Reviews numa lista de 452 px (R1).
- **Mutações:** rodei 107, 63 no resto da task e 44 na virtualização. Morrem 80. Das 27 que sobrevivem, quatro são equivalentes.
- **O que falta fazer:** são oito bloqueios.
  - **A janela perde a rolagem no WebKitGTK.** No app, o `End` do board e do History foca uma linha fora da vista, e a conversa longa não chega ao fim. A causa foi reproduzida no motor: um commit da janela leva o `scrollTop` a 0. Os testes pintados, no Chromium, não pegam.
  - A mensagem da passada que o produto manda ao revisor ainda entra na fila como mensagem do usuário, com **Remove**. É a outra metade de T1.
  - Doze das 21 lacunas decididas não estão em `design/`, e `decisions.md` não tem entrada de nenhuma. A régua passa a contradizer o código em vários pontos.
  - A PR tomou quatro decisões sem registro:
    - a meta de 16 ms passou a passar abaixo de 33,3 ms;
    - a varredura saiu do `task check`;
    - a matriz da varredura ficou enxuta;
    - as telas de referência caíram de 26 para 13.
  - L22 está implementado sem registro da resposta do usuário.
  - O corpo da PR não tem as medidas, as capturas nem a checklist da máquina alvo.
  - Três itens fechados estão parciais, e o Page Up do `feed` anda dez unidades, não dez entradas.
  - Faltam as provas de 23 mutações que sobrevivem.

O bloqueio 4 (as decisões da PR) pede decisão do coordenador, e o 5 (L22), confirmação do usuário. Os outros não pedem decisão.

**Sobre as capturas.** Não há `captures/59-…` no `origin` (`git ls-remote`), e o corpo da PR não tem tabela nenhuma. É o pronto 5 (`12:27`), como nas tasks 10 e 11 (bloqueio 6).

**Sobre a máquina alvo.** O pronto 9 (`12:31`) é do usuário, e o corpo não tem a checklist `## Verification on the target machine`. `docs/development/target-machine.md` (A varredura e o movimento reduzido) já manda o leitor para ela (bloqueio 6).

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`. `task check` rodou na worktree de revisão; as outras rodaram em cópias no scratchpad, com o projeto `painted` numa porta própria (`api.port` 63411 a 63421). A máquina ficou em carga 14 a 21 durante boa parte das rodadas.

| Suíte | Resultado |
|---|---|
| `task check`, 1ª | falha: 1 de 9.650. Foi o teste do tooltip em `app/motion.painted.test.tsx:369` (`expected '0s' to be '0.12s'`) |
| `task check`, 2ª | falha: 1 de 9.650. Foi `features/history/HistoryView.reach.painted.test.tsx:132` (`whollyBelow(bar, viewport)`, escuro) |
| `task check`, 3ª | verde em 134 s: as regras do design (17 testes), `knip` e 9.650 testes. `git status` limpo depois |
| `vitest --project unit`, inteiro | 7.260 testes em 352 arquivos, 161 s, verde |
| `vitest --project painted`, inteiro, com a varredura | 3.628 testes em 117 arquivos, 447 s. Duas falhas: o mesmo tooltip e `StartSteps.painted` (timeout de 15 s). Numa 2ª rodada, `KeyNotice.painted` e `Markdown.painted` não carregaram (`Failed to fetch dynamically imported module`, a infraestrutura sob carga) |
| Os instáveis isolados | `motion.painted` passou 8 vezes e `HistoryView.reach` passou 5 |
| `go test -race -count=3` em `app`, `flow`, `pulls`, `reviewflow`, `session` e `store` | verde. `internal/app` falhou com carga 19 em `attempt_test.go:104` e `:323` (`settleTimeout` de 5 s, `startup_test.go:19`), testes anteriores à PR, e passou com a carga baixa |
| idem em `bindings`, pulado `TestRegisterEventsRegistersEveryEvent` | verde em 257 s. O pânico desse teste na repetição é o registro global de eventos do Wails, como nas tasks 10 e 11 |
| As provas da virtualização (`useWindowedRows`, `BoardView.window`, `Conversation.window`, `HistoryView`, `useFeed`, `conversation.test`, `Conversation.renders`) | 230 testes no jsdom e 197 pintados, verdes |

**O CI.** Ganhou o job `Painted`, numa matriz de três (`--shard=n/3`), e o `Frontend` passou a rodar só `--project unit`. Está escrito em `docs/development/ci.md:13` e `:19`, no presente e com a razão (a suíte pintada com a varredura passa do tempo de um runner). Confere com `.github/workflows/ci.yml:90–128`.

**O pronto 10, commit a commit.** Cada um dos 17 commits foi extraído para uma cópia própria.
- **Passam em todos:** `go build`, `go vet`, `pnpm typecheck`, `biome ci .`, `vitest related --project unit` sobre os arquivos do commit e `design-rules.test.ts`.
- **O `knip`:** dá 0 desde `190a38f7`, que o acrescenta.
- **Testes apagados:** só em `190a38f7` (`ModelPicker`, `ReviewModePicker` e `useFindingText`), com os substitutos no mesmo commit: `ModelChip.test.tsx`, `StartReviewDialog.test.tsx:90`, `:104` e `useEditedText.test.ts`.
- **O tamanho:** 13 steps de área e 4 commits depois dos steps, dentro dos 14 de `12:19`. Um commit passa do teto de 1,5 mil linhas (sem o schema, o lockfile e os bindings): `b02ade41`, com 3.084 (item 2 de "Podem esperar").

### As verificações que fecham a porta (`12:130–150`)

| V | Onde mora | Roda no `lint:web` | O caso que morde | O comando da prova | A mordida, numa cópia |
|---|---|---|---|---|---|
| V1 | `biome.json:61–74`, `noRestrictedImports` (`@/components/ui/*`), com `overrides` para `components/system/**` e `styles/globals.test.tsx` (`:82–87`) | sim (`biome ci .`) | é o Biome | vazio | `@/components/ui/button` em `Home.tsx`: falha |
| V2 | idem, `paths` com `lucide-react` | sim | é o Biome | vazio | `lucide-react` em `Home.tsx`: falha |
| V3 | `styles/design-rules.test.ts` | sim (`lint:design`, `Taskfile.yml:85–90`) | `:137–138`, `:156` | acha só o próprio caso do teste (`design-rules.test.ts:137`): o comando do material não exclui testes | `oklch(` em `home.ts`: falha |
| V4 | idem. Os nomes vêm do `@theme inline` de `globals.css`, menos os tokens de `tokens.css` (`bridgeNames`, `:28–41`), sem lista à mão | sim | `:139–145`, `:170` | vazio | `text-muted-foreground`: falha |
| V5 | idem | sim | `:146` | acha o próprio caso (`:146`) e a descrição da regra em `docs/guidelines/testing.md:68` | `var(--status-working)`: falha |
| V6 | idem | sim | `:147–148` | vazio | `text-sm` num `.tsx` e `@apply text-sm` em `globals.css`: falham |
| V7 | idem | sim | `:149–150` | vazio | `animate-spin` e `duration-150`: falham |
| V8 | `knip` 6.39.0, `frontend/knip.json`, `--include files,dependencies` | sim (`lint:knip`, `:92–97`) | não tem | `knip` dá 0 | um arquivo órfão e a dependência `is-number` sem uso: falham |
| V9 | `test/widths.ts` (`proveScene`) e cinco `*.widths.painted.test.tsx` | **não**: `test:web` exclui a varredura com `MYSPEC_SKIP_SWEEP=1` | `test/widths.painted.test.tsx:14–110` | `pnpm test:painted`: verde | `mt-[0.5px]` e `min-w-[3000px]` em `ListRow`: falham |
| V10 | `app/motion.painted.test.tsx` | não é `lint:web`. Roda no `test:web` quando alcançado | o próprio teste | verde | o spinner com movimento reduzido e `transition-duration: 100ms`: falham |
| V11 | `test/widths.ts:59–66`, `:180–187` (`computeAccessibleName`, alerta e status) | **não**, como V9 | `widths.painted.test.tsx` | verde | `IconButton` sem `aria-label`: falha (`names`) |

- **O escopo de V3 a V7** (`scope()`, `design-rules.test.ts:113–122`) é `src` inteiro com `globals.css`, fora `components/ui/`, `test/` e os testes. Bate com `12:132`.
- **`knip.json` contra `12:358`.** Ele não ignora `components/ui/**`; `bindings/**` fica fora pelo `project`. Por isso o `knip` mandou apagar oito primitivos sem uso (`badge`, `checkbox`, `radio-group`, `resizable`, `scroll-area`, `separator`, `toggle-group` e `tooltip`). Diverge da letra de `12:358`, mas cumpre `12:77` ("só saem os arquivos sem uso").
- **O tempo do `task check`.** `docs/development/setup.md:60` registra "uns 9 s numa branch sem mudança, 1 s das regras e 1 s do `knip`". `12:358` e `12:456` pedem o antes e o depois.
- **V9 a V11 estão fora do `task check`**, contra `12:150` (bloqueio 4).
- **A checagem do alerta que nasce com a tela** lê os alertas logo depois do render (`test/widths.ts:63–67`, `:87`). Um alerta montado por um efeito escapa (item 9).

### O que saiu (`12:152–170`)

- **Vazio em `frontend/src`, `docs/` e `design/system`:**
  - `react-resizable-panels`, `ModelPicker`, `ReviewModePicker`, `ContextGauge` e `useFindingText`;
  - `CutCode`, `COPY_LABELS` e `copy: true` (agora `code: { copy: false }`, `features/chat/Markdown.tsx:22`);
  - `StatusDot`, `CardLink`, `OrphanPRs`, `LeftoversNotice`, `notice/Notice`, `HistoryPanel`, `history-format` e `OneShotView`.
- **`--status-*`:** sobram só o caso de mordida do teste e a regra descrita em `testing.md:68`.
- **`FLASH_MS`:** está só em `lib/situations.ts:23`.
- **`LIST_COLUMN`:** está em `components/system/ListPanel.tsx:17`; nenhuma feature importa `features/board/BoardView`, fora `AppShell`, os testes e `dev/`.
- **Ficam, porque têm leitor:**
  - `Listbox`, em `PermissionCard.tsx`;
  - `Radio`, em `boards/StatusTable.tsx`;
  - `Placeholder`, em `PromptPage.tsx` e `PromptEditor.tsx`.
  `12:170` manda tirar só o que ficar sem uso.
- **O `Tag`:** fica só na ferramenta de uma permissão, no comando de `MachineChecks` e nas etiquetas da linha da PR. O arquivado e a prévia de **Delete task** usam `Badge` (S7).
- **`design/system/components.md:32–50` (Primitivos)** ainda cita `tooltip`, `toggle-group`, `separator`, `scroll-area`, `checkbox` e `radio-group` como bases. A PR os apagou, e `docs/architecture/design-system.md:105–136` já diz a base real (bloqueio 3).

### A virtualização

O código segue `12:172–204`:
- **A janela:** `@tanstack/react-virtual` 3.14.13 pinado e registrado em `docs/architecture/stack.md:14`, `:45`. Sem `transform`. Os espaçadores somam o `gap`, e `rangeExtractor` tem as fixadas.
- **A rolagem:** a correção acima da vista com `keepEnd` (`components/system/useWindowedRows.ts:181–199`) e `[overflow-anchor:none]` no viewport (`features/chat/ConversationColumn.tsx:41`). `scrollToIndex` usa `behavior: "auto"`.
- **O teclado:** `useListTree` anda por índice, com o foco depois da montagem. `PullRequestTree` fica sem janela.
- **O custo por quadro:** `memo` em `CardRow`, `HistoryRow` e `DaySectionHeader`; o modelo é feito só das linhas montadas.
- **A acessibilidade:** `aria-level`, `aria-setsize` e `aria-posinset` entre irmãos (`features/board/CardTree.tsx:88–109`, `features/history/HistoryView.tsx:119–126`).
- **A conversa:**
  - a cauda sempre montada, `aria-busy` e a numeração do `feed` sobre a conversa inteira;
  - a conversa anterior abre no começo;
  - `buildConversation` se refaz a partir do trecho que mudou, com `toBe` por prefixo (`conversation.test.ts:543–587`), e `Conversation.renders.test.tsx` prova uma `RowView` só.
- **As medições** ficam fora do build de produção (o bundle conferido), e o build de medida está em `setup.md:73–79`.

Fora da régua:
- **A conversa fixa toda unidade com nó `before` ou `after`**, não só a do cartão de decisão "enquanto ele tem algo a decidir" (`12:201`). Fixa mais que o pedido, o que é aceitável, mas não tem prova (M15).
- **Page Up e Page Down andam dez unidades, não dez entradas** (`features/chat/useFeed.ts:392–403`). Um grupo aberto conta como uma. Contraria `docs/product/features.md:1103` e `screens/task.md:168` (bloqueio 7).
- **No WebKitGTK, a janela perde a rolagem** (bloqueio 1).

**As metas** (`12:206–224`), em `docs/development/target-machine.md`, foram medidas no WebKitGTK 2.52.6 pelo Broadway e no Chromium 153, nas duas builds, uma vez fria e cinco quentes:
- **O board e a conversa:** dentro das metas pela régua original. A tabela do board mostra uma rodada só; a rodada com `↓` de máximo de 31 ms saiu do texto em `a7d41579`.
- **O History:** o `↓` dá máximo quente de 16 a 18 ms em produção e de 16 a 22 ms em desenvolvimento (`target-machine.md:81`, `:86`). Passa só pela regra nova dos 33,3 ms (bloqueio 4).
- **A linha de base de produção do board antes da janela**, que `12:208` pede, não está registrada.
- **A medida não pega o defeito do bloqueio 1:** ela conta quadros, e o que se perde é a rolagem.

### Mutações

Cada mutação rodou numa cópia desligada do git, só com os testes que ela alcança. O Go rodou com `-count=1`. "Falha (n)" é o número de testes que falharam. A tabela traz as que importam; as outras morrem.

| Item | Mutação | Onde | Resultado |
|---|---|---|---|
| T1 | `RemovePending` aceita o prompt; a conversa desenha o prompt pendente | `internal/session/service.go:565`; `features/chat/Conversation.tsx:725` | falha (1) cada |
| L22 | `migrate` não recusa o banco à frente; `attempt` sem `NewerError` | `internal/store/migrate.go`; `internal/app/attempt.go` | falha (1) cada |
| R4 | `viewer { notAField login }` | `internal/pulls/github.go:42` | falha (2) |
| S1 | `focus-visible` sem `[data-input=keyboard]`; a modalidade nunca vira teclado | `styles/globals.css:17`; `lib/input-modality.ts:8` | falha (2), falha (1) |
| S2 | o `Kbd` sem borda; o `Button` tirando a caixa fora do sólido | `components/system/Kbd.tsx:14`; `Button.tsx:128` | falha (2) cada |
| S3, S4 | o polegar transparente; `Copy the code` vira `Copy`; a cópia do Streamdown religada | `globals.css:688`; `features/chat/CodeFrame.tsx:47`; `Markdown.tsx:22` | falha (1 a 5) cada |
| S6 | a regra `.ui-headings` renomeada | `globals.css` | falha (6) |
| S6 | `PanelDocument` e `BoardCardPanel` sem `ui-headings` | `features/task/PanelDocument.tsx:102`; `features/board/BoardCardPanel.tsx:201` | **sobrevivem** (2) |
| S8, S10, S17, S21, S23 | `go: ArrowUpRight`; `useArrivedLater` devolvendo `present`; um relógio por inscrição; `holdsBack` falso; `◇` solto | `icons.ts:83`; `useArrivedLater.ts:13`; `store/clock.ts`; `Dialog.tsx:216`; `Menu.tsx:223` | falha (1 a 14) cada |
| S12, S13, S14, S16 | o tooltip com o `sub` lado a lado; o esmaecido em `to-100%`; `focus:text-ink-4`; `active:bg-veil-press` de volta na linha aberta | `Tooltip.tsx:71`; `features/sidebar/MoreBelow.tsx:61`; `Menu.tsx:296`; `features/sidebar/TreeRow.tsx:94` | **sobrevivem** (4) |
| S19 | `RequestBar` sem `useToastLift` | `components/system/RequestBar.tsx:133` | **sobrevive**: `toast-lift.test` prova o hook, nada prova que a barra o chama |
| S27 | a saída do toast em `--duration-base` | `globals.css:466` | morre por travamento: `motion.painted` não termina em 120 s (item 1) |
| T2, T4, T10, T11, T13 | sem a conversa na PR bloqueada; `1–3` fixo; a hora fora do nome; o hover em `--surface-3`; `stepSituation` no implementador | `place.ts`; `composer.ts:162`; `QuestionCard.tsx`; `BackToEnd.tsx:32`; `agent-tabs.ts` | falha (1 a 2) cada |
| T3 | `table: true` (a tabela em caixa dupla) | `Markdown.tsx:21` | **sobrevive** |
| T7 | as crases em `gh_missing` | `features/task/pr-status.ts` | **sobrevive** (o texto de `gh auth login` é conferido; o de `gh_missing`, não) |
| T9 | sem `active:bg-veil-press` na opção | `components/system/OptionGroup.tsx:6` | **sobrevive** (o desabilitado enviando morre) |
| B2 a B7, L13 | por tipo; sem `displayPath`; `--available-width`; sem `Clone failed`; o chip sem `aria-label`; a seleção sem `STICKY_FADE`; o primeiro da lista | `home.ts`; `lib/repositories.ts`; `Select.tsx:74`; `board-view.ts`; `FilterBar.tsx`; `BoardView.tsx:447` | falha (1 a 2) cada |
| L14 | `flex-wrap` sempre | `FilterBar.tsx:48` | sobrevive, **equivalente** nas fixtures |
| R1, R2, L18 | o título `nowrap` e a razão `flex-1`; a tecla só sem razão; o título sem `inlineCode` | `NoticeStrip.tsx`; `review-request.ts`; `Finding.tsx` | falha (1 a 2) cada |
| R3 | `MenuCycleItem` sem a coluna do visto | `Menu.tsx` | **sobrevive** |
| D1, D2, D4 | `reveal` sem rolar até o controle; `editReason` nulo; `Body` sem `Markdown`; sempre o nome curto | `lib/reveal.ts`; `drafts-card.ts`; `DraftEditor.tsx`; `NewDiscussionDialog.tsx` | falha (1 a 4) cada |
| H2 | `bg-state-error-veil` de volta | `features/history/ArchivedDocument.tsx:41` | **sobrevive** |
| H4, H8, L2 | a data três dias à frente; a mensagem do `ENOENT`; `folded={null}` sempre | `history/archived.ts`; `lib/errors.ts`; `PlaceHeader.tsx:273` | falha (1 a 2) cada |
| V9, V10, V11 | meio pixel; rolagem lateral; spinner e transição com movimento reduzido; botão sem nome | `ListRow.tsx:120`; `globals.css:219`, `:553`; `IconButton.tsx:54` | falha (1 a 4) cada |
| V9 | `Cell` sem `CutText` | `ListRow.tsx:146` | falha (3 a 6) nas cenas do board |
| Janela | `translateY` no lugar dos espaçadores; os espaçadores do meio e do fim sem o `gap`; `scrollToIndex` suave; sem a correção acima da vista; o `overscan` enorme | `useWindowedRows.ts` | falha cada |
| Janela | sem fixar o card aberto, a parada de Tab da conversa, o cartão pendente, o marco pedido, a recém-arquivada | `CardTree.tsx`, `Conversation.tsx`, `HistoryView.tsx` | falha cada |
| Janela | `posinset` e `setsize` errados; `useFeed` reagindo ao texto; `RowView` sem `memo`; `buildConversation` sem reaproveitar; o History sem janela; o teclado pelo DOM; Page Up andando 1 | vários | falha cada |
| Janela | o espaçador de cima fracionário; a medida sem arredondar | `useWindowedRows.ts:231`, `:175` | **sobrevivem** (2) |
| Janela | o board sem fixar a parada de Tab; o History sem fixá-la | `CardTree.tsx:192`; `HistoryView.tsx:188` | **sobrevivem** (2) |
| Janela | a conversa sem fixar a última unidade; sem fixar `before`/`after`; a conversa anterior abrindo no fim | `Conversation.tsx` (as fixadas); `startAtEnd` | **sobrevivem** (3) |
| Janela | o `posinset` do cabeçalho contado entre todas as linhas | `CardTree.tsx:101` | **sobrevive** (só o primeiro é conferido) |
| Janela | `CardRow` sem `memo`; o modelo do board feito para todas as linhas | `components/system/ListRow.tsx:221`; `CardTree.tsx` | **sobrevivem** (2) |
| Janela | o `overscan` do board em 0; não abrir no fim; não seguir o fim | `CardTree.tsx:39`; `startAtEnd`; `useAutoScroll.ts:71–76` | sobrevivem, **equivalentes** (3): ajuste, e o `ResizeObserver` de `useAutoScroll` já leva ao fim no Chromium |

## Bloqueiam o merge

1. **No WebKitGTK, a janela perde a rolagem no commit que troca as linhas** (prontos 4 e 9; `12:178`, `:182–184`, `:202`).
   - **O que o app mostra**, pelo Broadway, a 1100 e a 1450, no escuro:
     - **o board:** com 2.000 cards, o painel aberto e a lista de 452 px, recém-montado, `End` foca o #1999, mas ele fica cinco linhas abaixo da vista, mesmo depois de 3,8 s. Com as linhas já medidas, `End` funciona;
     - **o History:** com 78 itens, a 1450, `End` foca o último carregado, e a vista para em `Aug 5`;
     - **a conversa:** com 300 e com 1.500 entradas, a da etapa atual abre no começo (com 60, abre no fim). O `↓` de volta ao fim só leva o foco ao compositor. `End` no `feed` não anda. Arrastar a barra até embaixo deixa a coluna em branco, e a roda seguinte volta ao topo.
   - **A causa, reproduzida no MiniBrowser do WebKitGTK 2.52.6** com o build de medida do board a 1134 px:
     - `End` chama `scrollTo({ top: 63932 })` (`components/system/useWindowedRows.ts:266–268`), e o evento de rolagem chega com 63932;
     - o commit troca as linhas (+35/−35), e logo depois `scrollTop` é 0. Nenhum código mexe na rolagem: `scrollTo`, o setter de `scrollTop` e `scrollIntoView` foram instrumentados;
     - em duas de três rodadas o `scrollTop` fica em 0, com a linha focada 64.352 px abaixo da vista.
     - Com `min-height: 63000px` na lista, a rolagem para em 62652, o máximo do conteúdo encolhido, e não em 0. No meio do commit, o WebKit faz o layout com os espaçadores e as linhas antigos já fora e os novos ainda não inseridos, e prende a rolagem nesse conteúdo menor.
     - As chaves dos espaçadores mudam com a janela (`useWindowedRows.ts:219–253`: `spacer:${first.index}`, `spacer:${item.index}`, `spacer:end`), então eles saem e voltam junto com as linhas.
     - Vale para o `tree` do board, o do History e o `feed` da conversa. Na conversa isolada, no MiniBrowser, não reproduziu. As linhas do app são mais ricas, e a ligação com o mesmo mecanismo é provável, mas não está provada.
   - **Por que a suíte não pega:**
     - o Chromium não prende a rolagem;
     - `BoardView.window.painted.test.tsx:70–84` confere só `belowBar >= 0`, nunca que a linha focada fica acima do fundo da área que rola;
     - a fixture é de 1134 px sem painel, em que a estimativa (32 px) é a altura real. O caso de 812 px com o painel, de estimativa 52 (`CardTree.tsx:160–167`), não é provado;
     - nenhuma cena de `TaskView` passa de 60 unidades (`WINDOW_MIN_UNITS`): a janela da conversa nunca é provada dentro da tela da task.
   - **Mudar:**
     - a lista segura a altura total durante o commit, por exemplo com `min-height` igual a `getTotalSize()` em pixel inteiro (opinião), ou com espaçadores de chave estável;
     - conferir no MiniBrowser pelo Broadway, como `target-machine.md` (Como medir) descreve, o board a 812 com o painel, o History e uma conversa de 1.500 entradas da tela da task, e registrar o resultado lá;
     - nas provas: o `End` com a linha focada inteira dentro da área que rola, o board a 812 com o painel, e uma cena de `TaskView` acima de 60 unidades que abre no fim e volta pelo `↓`.
   - Não pede decisão.

2. **A mensagem da passada que o produto manda ao revisor entra na fila como do usuário, com Remove** (T1, L21; `screens/task.md` §6).
   - **No app:** na task `rate-limit-per-api-key`, aba Reviewer, a entrada pendente `user` com `app: true`, `appKind: "pass"` e `prompt: false` sai como `Queued · sends after the retry`, com **Remove** e o texto cru da instrução, com o caminho do relatório.
   - **Onde:** só o prompt é filtrado. A conversa testa `!entry.user.prompt` (`features/chat/Conversation.tsx:722–725`), e `RemovePending` só recusa `u.Prompt` (`internal/session/service.go:565`).
   - **A régua:** a fila é da mensagem do usuário (`components.md` Entradas da conversa, Mensagem na fila). A instrução da passada é a Mensagem do produto (`MySpec → Reviewer pass 2`). Remover tira da sessão a instrução da passada, o mesmo dano que fez de T1 um bloqueio.
   - **Mudar:**
     - toda entrada do produto pendente (`app` ou `prompt`) sai da fila e fica como o marco da mensagem do produto, sem ação;
     - `RemovePending` recusa as duas;
     - um caso em `Conversation.test.tsx` e um em `service_test.go`.
   - Não pede decisão: é a regra de L21 levada à outra entrada do produto.

3. **Doze lacunas decididas não estão em `design/`, e a régua contradiz o código** (`critique-task-12-pass.md:589`; pronto 11).
   - **O que o relatório pede:** "Cada decisão é registrada no documento da coluna Registrar em, com uma entrada em `decisions.md`, antes de `Ready`". As que mudam comportamento (L5, L11, L13, L21) entram também em `changes.md`.
   - **O que existe:** a PR registrou L4, L11, L12, L14, L15, L16, L17, L18, L20 e L22. Não há registro de:
     - **L1** (a seta `go` é chevron, `components.md` Ícones `:83`);
     - **L2** (`structure.md`);
     - **L3** (`components.md` Diálogo);
     - **L5** (`screens/task.md` §11–12);
     - **L6** (`task.md` §5, §7);
     - **L7** (`task.md` §7);
     - **L8** (a seção Markdown em `components.md`);
     - **L9** (`components.md` Bloco de código, `:616–627`: o mermaid e **Full screen**);
     - **L10** (`components.md` Menu do item, `:230–237`);
     - **L13** (`screens/board.md` §4.2);
     - **L19** (`structure.md` §7);
     - **L21** (`task.md` §6);
     - a decisão de S27, a quarta notificação que tira a mais antiga "no mesmo instante" (`components.md` Aviso do app e toast).
   - **`decisions.md` não tem entrada de 2026-10-04**, a data das decisões; a última é de 2026-10-03. **`changes.md`** só ganhou X21; faltam L5, L11, L13 e L21.
   - **Onde a régua contradiz o código:**
     - `screens/task.md:233`, `:239` e `:347` dizem `Answer with 1–3…`, e o código segue o cartão (L7, `features/chat/composer.ts`);
     - `screens/task.md:143` descreve a fila com **Remove** sem a exceção do prompt (L21);
     - `screens/board.md:275` diz "o primeiro da lista" (L13);
     - `components.md` Diálogo (`:792–804`) diz "todos ficam a `8vh` do topo", e a PR criou a variante `size="full"` (`components/system/Dialog.tsx:29`, `:48`) para a tela cheia do mermaid, a `--space-8` das bordas, sem registro;
     - `components.md:32–50` cita primitivos que saíram;
     - `components.md:449` (Faixa estreita, L20) pede "no máximo duas linhas", que `components/system/NoticeStrip.tsx:44` não garante: a prova (`NoticeStrip.painted.test.tsx:26`) usa uma razão fixa a 452 px. O texto também difere da decisão de L20, que fala da razão sob o título;
     - `structure.md:424` diz "as duas listas são virtualizadas" e que o History "carrega os últimos 90 dias", sem a janela, e `screens/rest.md:318`, `:643`, `:685` e `:734` também não a têm. `12:483` dá isso ao coordenador.
   - **Mudar:**
     - registrar cada lacuna no documento da coluna e em `decisions.md`, e L5, L11, L13 e L21 em `changes.md`;
     - corrigir as contradições acima;
     - acrescentar a variante `full` do diálogo, ou trocar a tela cheia pelo que `components.md` já tem.
   - Não pede decisão: as decisões estão tomadas no relatório. É trabalho do coordenador, e pode ir na branch.

4. **A PR tomou quatro decisões que o material fixava, sem registro** (prontos 4 e 5; `12:150`, `:224`, `:236`, `:244–260`).
   - **A meta de 16 ms.** `a7d41579` reescreveu `docs/development/target-machine.md:103`: as metas de 16 ms "passam abaixo de dois quadros, 33,3 ms". `12:224` diz "Uma meta perdida não é aceita: o step volta ao custo por quadro… até ela passar", e `decisions.md` (a entrada da §4.3 #11) fixa a tabela.
     - O argumento físico procede: do evento ao quadro seguinte, a medida nunca fica abaixo de cerca de 16,7 ms.
     - Mas, com a régua nova, o `↓` do History passa com 18 e 22 ms, e uma rodada do board com 31 ms saiu do registro no mesmo commit.
   - **A varredura fora do `task check`.** `Taskfile.yml:111–119` põe `MYSPEC_SKIP_SWEEP=1` em `test:web`, contra `12:150` ("V9 a V11 rodam no `task check` quando um arquivo que alcançam muda"). Está documentado em `setup.md:53`, `:104`, `testing.md:106` e `ci.md`.
   - **A matriz enxuta.** `windowsIn` (`test/widths.ts:36–41`) desenha o escuro só a 1100 e a 2560; as janelas do meio rodam só no claro. `12:236` e o pronto 5 pedem as cinco janelas nos dois temas.
   - **As telas de referência.** O código tem 13 (`board`, `card`, `home`, `list`, `findings`, `drafts`, `start`, `run`, `checks`, `settings-defaults`, `newer`, `migration`, `history`). A tabela de `12:246–260` tem 26. Faltam:
     - `home=none`, `select` e `create-card`;
     - `ask`, `findings` da task e `long`;
     - `publish` e `delete-task`;
     - `settings-boards` com `add-3`, `settings-repos` e `settings-prompts` com `edit`;
     - `starting`/`slow`, `welcome`/`no-login`, `archived-task`, `gone`/`deleted` e `notice`/`toast`.
   - **Mudar:**
     - o coordenador decide cada um e registra em `decisions.md` e no material. A meta de "pintar no quadro seguinte" pede outra forma de medir, que conte quadros perdidos e não o tempo até o quadro;
     - se a matriz e a tela de referência continuarem enxutas, `testing.md` deixa de ser o único lugar onde isso está escrito;
     - se voltarem ao material, as 26 telas entram e a matriz volta inteira.
   - **Pede decisão do coordenador.** **Opinião:** aceitar a varredura fora do `task check` e a matriz enxuta (o tema muda cores, e o contraste é provado à parte), registrar a meta como "nenhum quadro perdido" e completar as 26 telas de referência, que são as capturas da PR.

5. **L22 está implementado sem registro da resposta do usuário** (`12:498–500`; o relatório, `:612`, `:814–818`).
   - **O que existe:**
     - `ae011ab1` implementa a recomendação: `store.NewerError` antes de qualquer escrita (`internal/store/migrate.go:56–58`) e a página **This data is from a newer MySpec**;
     - no app, com `user_version=99`, ela abre com `Data version 99 · this version reads up to 25`, e o sha256 do banco não muda, sem `-wal` nem `-shm`;
     - o registro está em `changes.md` X21, `screens/rest.md:436–444`, `docs/architecture/storage.md:68` e `docs/product/features.md:443`.
   - **O que falta:** o relatório continua com "Se o usuário aprovar… se não, fica como está, e a resposta é escrita aqui" (`:818`), sem a resposta. `decisions.md`, as mensagens dos commits e o corpo da PR também não a dizem. `design/README.md:50` ainda fala da "pergunta de produto ao usuário".
   - **Mudar:** escrever a resposta do usuário no relatório e em `decisions.md`. Se ele recusou, o commit sai da branch.
   - **Pede confirmação do usuário**, se a aprovação não foi dada em conversa.

6. **O corpo da PR não tem as medidas, as capturas, a checklist nem o que ficou** (prontos 1, 4, 5 e 9).
   - **As medidas:** `12:26` e `12:224` pedem as metas do board, da conversa e do History, com o motor e as duas builds, no corpo. Elas estão só em `target-machine.md`.
   - **As capturas:** não há `captures/59-…` no `origin`, e o corpo não tem tabela.
   - **A checklist:** falta `## Verification on the target machine` de `12:31`. Ela deve ter:
     - a barra de rolagem global num diálogo longo, no compositor e na lista de um `Select`;
     - o anel depois de um clique e depois de uma tecla;
     - o meio pixel ampliado a 2560 e a 1280 px;
     - o movimento reduzido com `gsettings`;
     - a conversa longa de uma task real, lida acima enquanto o agente escreve, e a volta ao fim;
     - o board pelo teclado de ponta a ponta;
     - a página do banco mais novo.
     `target-machine.md` já manda o leitor a ela.
   - **O que ficou:** os itens parciais (bloqueio 7) e as provas que faltam (bloqueio 8) não estão registrados como pendentes.
   - **O relatório não está fechado:**
     - S10 diz "Fechado no step 14" sem commit (é `b02ade41`, com retoques em `af28179c`);
     - na área da discussão, as Pautas (`:723`, `:726`, `:728`, `:729`, `:732`) põem o commit na coluna Origem, não na coluna Item.
   - **Mudar:**
     - as tabelas de medida no corpo;
     - `task captures` e `task captures:push` na ponta, com as tabelas das telas de referência, nas cinco janelas e nos dois temas;
     - a checklist;
     - o commit de S10 e as colunas da discussão no relatório.
   - Não pede decisão.

7. **Três itens fechados estão parciais, e o Page Up do `feed` diverge da régua** (pronto 1; `12:128`, "todo item é trabalho da task").
   - **S6 / L8:** `ui-headings` falta em dois lugares que L8 nomeia:
     - `features/task/StepDocument.tsx:10`, o arquivo do step no painel, que `PanelDocument.tsx:99` usa;
     - `features/chat/entries/MarkerLine.tsx:385`, o corpo Markdown de um marco aberto (`MySpec → Reviewer` abre o prompt).
     A prova (`Markdown.painted.test.tsx`) cobre só `card-body ui-headings`, e tirar a classe de `PanelDocument` ou de `BoardCardPanel` passa.
   - **H2:** só o arquivado mudou. A mesma falha de leitura de um documento continua em vermelho (`bg-state-error-veil`) em:
     - `features/task/PanelDocument.tsx:88`;
     - `features/discussion/DocumentsPanel.tsx:96`;
     - `features/reviews/ReportsPanel.tsx:166`;
     - `features/chat/entries/MarkerLine.tsx:409` e `:455`.
     Contraria `screens/rest.md:330`, escrito nesta PR ("ler um arquivo não é uma ação do usuário que falhou… sem o vermelho"), e `components.md` Faixa de aviso. O mesmo erro tem agora duas formas.
   - **L18:** o arquivado ainda mostra as crases. `features/history/ArchivedFindings.tsx:22` (o `aria-label`) e `:30` (o `CutText`) usam `finding.title` cru, sem `inlineCode` nem o título sem crases (`lib/findings.ts:85`).
   - **T12:** o cursor está em `--ink-3`, mas continua numa linha própria. `.streaming-caret` é `display: block` (`styles/globals.css:660–664`) e vem depois do último bloco (`features/chat/Markdown.tsx:159–172`). A pauta de origem (`critique-task-04.md:121`) era justamente "o cursor do streaming numa linha nova", e `components.md` Entradas da conversa diz "um cursor parado".
   - **Page Up e Page Down:** andam dez unidades (`features/chat/useFeed.ts:392–403`), não as dez entradas de `docs/product/features.md:1103` e `screens/task.md:168`; um grupo aberto conta como uma.
   - **Mudar:**
     - `ui-headings` nos dois lugares, com uma prova pintada por painel;
     - a faixa afundada com **Try again** fantasma nos cinco lugares de H2, com uma prova;
     - `inlineCode` e o título sem crases no arquivado;
     - o cursor em linha, no fim do último parágrafo;
     - Page Up e Page Down andando dez entradas (com a unidade do grupo aberto contando as suas), ou o coordenador decide que é por unidade e a régua passa a dizer.
   - Não pede decisão, salvo a escolha do Page Up.

8. **Faltam provas** (pronto 4, "o comportamento da janela provado"; pronto 1). Sobrevivem 23 mutações que não são equivalentes.
   - **Na janela:**
     - o espaçador de cima fracionário e a medida sem arredondar (`useWindowedRows.ts:231`, `:175`). `useWindowedRows.test.tsx` nunca rola, e o pixel inteiro é o que `12:178` pede;
     - a parada de Tab sem fixar no board (`CardTree.tsx:192`) e no History (`HistoryView.tsx:188`);
     - a conversa sem fixar a última unidade e as `before`/`after`, e a conversa anterior abrindo no fim;
     - o `posinset` dos cabeçalhos (`CardTree.tsx:101`);
     - `CardRow` sem `memo` e o modelo feito para todas as linhas (`12:186`).
   - **Nos itens:**
     - S6 (os painéis);
     - S12 (o tooltip em coluna);
     - S13 (o esmaecido);
     - S14 (`--ink-3` focado);
     - S16 (a linha aberta pressionada);
     - S19 (a barra que chama `useToastLift`);
     - T3 (a tabela num bloco só);
     - T7 (`gh_missing`);
     - T9 (a opção pressionada);
     - R3 (a coluna do visto em `MenuCycleItem`);
     - H2.
   - **No S1:** só `ListRow.painted.test.tsx:135` prova o anel depois do script. Não há prova para:
     - `TreeRow` e `TreeNodeRow`;
     - as teclas da linha (`group-focus-visible/row:visible`, `ListRow.tsx:134`), que dependem de a variante nova valer para `group-*`;
     - o foco inicial de um diálogo aberto pela tecla.
   - **Mudar:** um caso por linha acima, conferido pela mutação.
   - Não pede decisão.

## Podem esperar

1. **Os testes instáveis novos.**
   - O teste do tooltip em `app/motion.painted.test.tsx:369–386`, desta PR, falhou em duas de três rodadas com carga. A mutação de S27 trava o arquivo inteiro em vez de falhar.
   - `HistoryView.reach.painted.test.tsx:132`, da task 11, agora roda sobre a janela e falhou uma vez no `task check`.
   - `StartSteps.painted` estourou o tempo uma vez.

   É uma PR curta, mas vai contra o que H7 buscou nesta mesma task.
2. **`b02ade41` tem 3.084 linhas**, o dobro do teto de `implementation.md` §1. É o step 13, a varredura; fica registrado, como os cinco da task 11.
3. **`docs/development/target-machine.md`:**
   - "Como medir" diz que o `XDG_RUNTIME_DIR` "é o do usuário", contra o caminho curto em `/tmp` de `12:109`;
   - a seção "A varredura e o movimento reduzido" não registra a varredura e o meio pixel conferidos no WebKitGTK (`12:472`). O meio pixel foi conferido no app desta crítica (abaixo).
4. **`features/board/BoardView.tsx:231` e `:253`** ainda acham o painel por `document.querySelector(".list-panel")`. `closePanel` já usa o `ref` (B10).
5. **O anel do cabeçalho `Inbox` perde a borda de cima** sob a barra de filtros fixa depois de `Home` no board, no app. É o resto de B1.
6. **O caminho do clone inexistente quebra em três linhas no diálogo de nova discussão** (`features/discussion/UnclonedRepository.tsx`). L17 corta só a linha da Home; a mesma regra serve aqui (`components.md` Faixa de aviso, Sob uma linha).
7. **D1 tem duas provas condicionais.** `DiscussionView.scenes.painted.test.tsx` só confere o controle dentro de `if (control !== null)` e a pílula `↓` dentro de `if (pill !== null …)`. A mutação de `reveal` morre, mas a da pílula não foi feita.
8. **Miúdos de token e forma:**
   - a barra de rolagem usa `calc(var(--space-2) + var(--space-0-5))` e `--space-0-5` (`globals.css:677`, `:686`), onde `components.md:93` diz `--space-2-5` e `--border-2`; os valores são iguais;
   - `components/system/ListRow.tsx:424` tem uma etiqueta local em `--ink-3`, e a Etiqueta é `--ink-2`;
   - duas faixas seguidas em Reviews ficam a 32 px uma da outra (`ReviewsReadingStates.tsx:58`, `mt` e `mb` de `--space-4` em cada);
   - L2 vale para todo cabeçalho sem stepper (`PlaceHeader.tsx`, `useCrumbsFold`), não só para o arquivado. **Opinião:** é o comportamento certo, e o registro de L2 (bloqueio 3) pode dizer isso.
9. **A checagem do alerta que nasce com a tela é síncrona** (`test/widths.ts:63–67`, `:87`). Um `role="alert"` montado por um efeito escapa.
10. **Os comandos de V3 e V5 de `12:138` e `:140`** acham os casos de mordida do próprio teste. O material pode excluir `*.test.*` como faz nos outros; não é defeito do código.
11. **`gqlparser`**, a dependência Go nova do teste de R4, está em `overview.md:77` e não em `docs/architecture/stack.md`.
12. **O polegar da barra de rolagem** em `--line-2` dá 1,51 / 1,58 sobre `--surface-1`. **Opinião:** é a anatomia decidida (`components.md` Barra de rolagem), e o polegar sob o ponteiro, em `--line-3`, passa 3:1.
13. **`internal/app`, `attempt_test.go:104` e `:323`,** estouram o `settleTimeout` de 5 s com `-race` sob carga. São anteriores à PR e ficam para a pauta de estabilidade.

## Os itens do relatório

**A contagem:** 72 feitos e 3 parciais (S6, T12 e H2); nenhum sem fazer. As lacunas: 21 decididas, das quais 9 registradas na régua pela PR e 12 sem registro (bloqueio 3); todas implementadas, salvo L8 e L18, parciais. L22 está implementado sem a resposta registrada (bloqueio 5).

### O system, o shell e a árvore

| id | Grav. | Situação | Commit | Evidência em `3fb9362` |
|---|---|---|---|---|
| S1 | Bloqueia | feito; prova parcial (bloqueio 8) | `524e30fb` | `styles/globals.css:15–17` (a variante pela modalidade), `lib/input-modality.ts`, `ListRow.tsx:120`, `TreeRow.tsx:93`, `TreeNodeRow.tsx:160`, `Finding.tsx:183–184`. No app: o anel depois de clique e tecla na árvore, no board (com `S start`/`D discuss`) e em Reviews; em **Cancel** de **Delete task** aberto pelo teclado; em **Start review** |
| S2 | Deve | feito | `524e30fb` | `Button.tsx:122–131`, `Kbd.tsx:13–24`. No app: `Close Esc`, `Save Ctrl S`, `Send ↵`, `N`, `A`/`D`/`E`, `Alt ↓`, `Ctrl ↵` em caixa |
| S3 | Deve | feito | `524e30fb` | `globals.css:676–692`; `globals.test.tsx:95–106` |
| S4 | Deve | feito | `524e30fb` | `Markdown.tsx:22`, `CodeFrame.tsx:38–48`. No app: `<> go` e uma cópia só |
| S5 | Deve | feito | `190a38f7` | `StartReviewDialog.tsx:199–207`, `NewDiscussionDialog.tsx:354–364`. No app: o `ModelChip` com `From Defaults…` nos dois |
| S6 | Deve | **parcial** (bloqueio 7) | `4a88fada` | `ui-headings` em `BoardCardPanel.tsx:201`, `PullRequestPanel.tsx:146`, `DocumentsPanel.tsx:106`, `PanelDocument.tsx:102`, `MarkerLine.tsx:473`, `ReportsPanel.tsx:172`, `CardPanel.tsx:68` e nos arquivados; `globals.css:441`, `:561`. Faltam `StepDocument.tsx:10` e `MarkerLine.tsx:385` |
| S7 | Deve | feito | `4a88fada` | `Badge` em `ArchivedTask.tsx:235–236`, `ArchivedReview.tsx:134`, `ArchivedDiscussion.tsx:58`, `:218`, `DeletionPreview.tsx:103`. No app: sans e contornadas |
| S8 | Deve | feito | `4a88fada` | `icons.ts:83` (`go: ChevronRight`), `PromptsPage.tsx:107`. No app: os chevrons em Prompts |
| S9 | Deve | feito | `4a88fada` | `home.ts:232`; `home.test.ts:328`. No app: `Not read yet` |
| S10 | Deve | feito; o relatório sem commit (bloqueio 6) | `b02ade41`, `af28179c` | `components/system/LiveRegion.tsx`, `useArrivedLater.ts`; cada arquivo da lista, de `BoardReadingStates.tsx:48` a `UnclonedRepository.tsx:114`; `KeyNotice.tsx:101` em `--z-tooltip` |
| S11 | Deve | feito; sem prova | `4a88fada` | `BoardReadingStates.tsx:57`, `ReviewsReadingStates.tsx:58`. No app: a folga de cima |
| S12 | Deve | feito; sem prova | `524e30fb` | `Tooltip.tsx` (o `sub` em coluna) |
| S13 | Deve | feito; sem prova | `524e30fb` | `MoreBelow.tsx:61` (`to-50%`) |
| S14 | Deve | feito; sem prova | `524e30fb` | `Menu.tsx:296` (`focus:text-ink-3`) |
| S15 | Pode esperar | feito | `524e30fb` | nenhuma classe numérica de espaço em `components/system`, `features`, `app` e `lib` |
| S16 | Pode esperar | feito; sem prova | `524e30fb` | `TreeRow.tsx` (`group-active/row:text-ink-2`) |
| S17 | Pode esperar | feito | `4a88fada` | `store/clock.ts`; `useReviewRequest` sem `useNow` próprio; `useNow.test.ts:61` |
| S18 | Pode esperar | feito | `4a88fada` | `task-menu.ts:98`, `:151`, `review-header.ts:260`, `:276`. No app: o `⋯` só com texto |
| S19 | Pode esperar | feito; sem prova da barra | `4a88fada` | `RequestBar.tsx:133`, `:186` |
| S20 | Pode esperar | feito | `4a88fada` | `gone-passes.ts:16`, `:47`, `:82`, `gone-rounds.ts:11` |
| S21 | Pode esperar | feito | `524e30fb` | `Dialog.tsx:216`; `Dialog.painted.test.tsx:193` |
| S22 | Pode esperar | feito | `524e30fb` | `CutText` em `MarkerLine.tsx:173`, `FoldedDraft.tsx:131`, `GroupEpicDialog.tsx:137`, `NewDiscussionDialog.tsx:224`, `:267`, `ListRow.tsx:136` |
| S23 | Pode esperar | feito | `524e30fb` | `◇` só em comentários fora dos testes |
| S24, S25 | Pode esperar | feito | `524e30fb` | `Presence.painted.test.tsx:63`, `:74`, `:95`; `SidebarRail.test.tsx` |
| S26 | Pode esperar | feito | `524e30fb` | `ShellToasts.tsx:43`; `ShellToasts.test.tsx:114` |
| S27 | Pode esperar | feito; o registro falta (bloqueio 3) | `524e30fb` | `Presence.painted.test.tsx:160` |
| S28 | Pode esperar | feito | `190a38f7` | `lib/review-modes.ts:3` |

### A task

| id | Grav. | Situação | Commit | Evidência |
|---|---|---|---|---|
| T1 | Bloqueia | feito para o prompt de início; a mensagem da passada continua (bloqueio 2) | `3ad462c6` | `Conversation.tsx:720–725`; `ErrProductPrompt` em `internal/session/service.go:160`, `:565`; `TestRemovePendingRefusesTheProductPrompt`. No app: `Tech spec started from PRD.md`, sem ação |
| T2 | Deve | feito | `3ad462c6` | `place.ts` (`hasReviewConversation`), `pr-findings.ts` (desabilitado com `blocked`). O app não bloqueou a PR, porque tinha o `gh` |
| T3 | Deve | feito; a tabela sem prova | `3ad462c6` | `MermaidBlock.tsx`, `globals.css:635–660`. No app: o mermaid no tamanho natural, com **Full screen** |
| T4 | Deve | feito; a régua contradiz (bloqueio 3) | `3ad462c6` | `composer.ts` (`permissionKeys`) |
| T5 | Deve | feito | `3ad462c6` | `PanelRow.tsx`, `ChecksList.tsx` com `CutText` |
| T6, T8, T10, T11, T13, T14, T16, T17 | Pode esperar | feito | `3ad462c6` | `stepper.ts` (`situationPillState`); `markers.ts:266`, `MarkerLine.tsx:333`; `, answered at …` no nome; `BackToEnd.tsx` (`hover:bg-surface-2`); `agent-tabs.ts` (`implementerSituation`); `ContextMeter.tsx` (`reading`); `step-status.ts:229`; `TaskView.tsx` (`usePlaceAnnouncement`) |
| T7 | Pode esperar | feito; a prova cobre um dos dois textos | `3ad462c6` | `pr-status.ts:186`, `:188` |
| T9 | Pode esperar | feito; o pressionado sem prova | `3ad462c6` | `OptionGroup.tsx:6`, `QuestionCard.tsx` |
| T12 | Pode esperar | **parcial** (bloqueio 7) | `3ad462c6` | `globals.css:659–667`, `Markdown.tsx:159–172` |
| T15 | Pode esperar | feito | `3ad462c6` | `PermissionCard` com `max-h-[calc(var(--space-16)*3)]`, `CodeFrame.tsx:39`, `StepDocument.tsx:9` |
| T18 | Pode esperar | feito | `3ad462c6` | `TestCloseWaitsForSpawnPRWork` (`internal/flow/step_test.go`); `where-actions-went.test.tsx:435`, `:935–949`; `useFeed.test.tsx:334`; `TaskView.scenes.painted.test.tsx:186`; `test/conversation-scenes.ts` |

### Home, board e criação

| id | Grav. | Situação | Commit | Evidência |
|---|---|---|---|---|
| B1 | Deve | feito no Chromium; no WebKitGTK, o `End` perde a rolagem (bloqueio 1) | `ad8bf3b3` | `BoardView.window.painted.test.tsx:52–99` |
| B2 | Deve | feito | `112dfb0a` | `home.ts:173–201`. No app: `aaa-tools` antes de `zeta` |
| B3 | Deve | feito | `112dfb0a` | `lib/repositories.ts:63`, `board-view.ts:598`, `card-panel.ts:148`, `StartRow.tsx:170–180`. No app: a linha da Home corta |
| B4 | Deve | feito | `112dfb0a` | `Select.tsx:72–74`, `Menu.tsx:178`, `:298`; `Select.painted.test.tsx:183` |
| B5, B6, B7 | Deve | feito | `112dfb0a` | `board-view.ts:473`, `:549`; `FilterBar.tsx:72–86`; `BoardView.tsx:447` |
| B8, B9, B12 | Pode esperar | feito | `112dfb0a` | `Continue.tsx:61`; `Home.tsx:195–198`; nenhum passo numérico em `NewTaskDialog.tsx` e `NoticeStrip.tsx` |
| B10 | Pode esperar | feito; sobra o padrão (item 4) | `112dfb0a` | `BoardCardPanel.tsx:162–163`, `card-panel.ts:123–128`, `BoardView.tsx:196` |
| B11 | Pode esperar | feito, as sete provas | `112dfb0a` | `test/board-scenes.ts:266` (64 caracteres); `#461 +1`; sem `slice(0, 8)`; `NewTaskDialog.scenes.painted.test.tsx:83`; `BoardView.keys.test.tsx`; `TestTheStateCarriesTheTaskAndTheDiscussionThatWroteACardOfABoard`; `StartRow.painted.test.tsx:92–118`, que já existia antes da PR |

### Reviews e o review

| id | Grav. | Situação | Commit | Evidência |
|---|---|---|---|---|
| R1 | Bloqueia | feito; "no máximo duas linhas" não garantido (bloqueio 3) | `3dca6b02`, `af28179c` | `NoticeStrip.tsx:31–49`; `NoticeStrip.painted.test.tsx:26–46`. No app, a 1100 com o painel: as cinco faixas em linhas inteiras, com **Try again** numa linha própria |
| R2 | Deve | feito | `3dca6b02` | `review-request.ts:110–111` |
| R3 | Pode esperar | feito; sem prova | `3dca6b02` | `Menu.tsx` (`MenuCycleItem`) |
| R4 | Pode esperar | feito | `3dca6b02` | `internal/pulls/schema_test.go` com `gqlparser` e as regras padrão, sobre `viewer`, `list` e `detail` |
| R5 | Pode esperar | feito | `3dca6b02` | sem `gap-1` em `StartReviewDialog.tsx` |

### A discussão

| id | Grav. | Situação | Commit | Evidência |
|---|---|---|---|---|
| D1 | Deve | feito; prova condicional (item 7) | `8c5b8b77` | `lib/reveal.ts`, `ConversationColumn.tsx`, `lib/focus.ts`; `screens/discussion.md:174` |
| D2, D3, D4 | Pode esperar | feito | `8c5b8b77` | `drafts-card.ts`, `DraftEditor.tsx`; sem passo numérico; `NewDiscussionDialog.tsx` (`sharedNames`), `09-discussion.md:106` |

### Settings, History e diálogos

| id | Grav. | Situação | Commit | Evidência |
|---|---|---|---|---|
| H1 | Deve | feito; a meta pela regra nova (bloqueio 4); `design/` sem a janela (bloqueio 3) | `807cae11` | `HistoryView.tsx` com `useWindowedRows`; `target-machine.md`, A lista do History |
| H2 | Deve | **parcial** (bloqueio 7) | `ae011ab1` | `ArchivedDocument.tsx:41–47`, `ArchivedDiscussion.tsx:225`; `ErrArtifactMissing` (`internal/bindings/discussion_service.go:20`, `:295`) |
| H3 | Deve | feito | `190a38f7` | nenhum `ui/collapsible` nem `bg-background` em `features/history` |
| H4, H5, H6, H8 | Pode esperar | feito | `ae011ab1`, `807cae11` | `archived.ts:46–47` (`clockOrDateAt`); nenhum passo numérico; "To measure" fora de `docs/`; `lib/errors.ts` (`ARTIFACT_MISSING`) |
| H7 | Pode esperar | feito | `ae011ab1` | as causas tratadas: `waitCorrected` e `committedMarked` no Go, `waitFor` e o foco antes de digitar em `BoardDialog.test.tsx`, `user.paste` nos testes longos. Sem aumentar tempo. Os instáveis novos estão no item 1 |

### As lacunas

| L | Registrada | Implementada |
|---|---|---|
| L1, L2, L3, L5, L6, L7, L9, L10, L13, L19, L21 | **não** (bloqueio 3) | sim (L2 para todo cabeçalho sem stepper, item 8; L3 já era assim) |
| L8 | **não** (bloqueio 3) | parcial (S6) |
| L4 | `screens/rest.md:330` | sim (H4) |
| L11 | `screens/discussion.md:174`; falta em `changes.md` | sim (D1) |
| L12 | `discussion.md:38`; `09-discussion.md:106` | sim (D4) |
| L14 | `screens/board.md` §3.3 | sim |
| L15 | `components.md:220`, `:224`; `tokens.css:75` | sim (B4) |
| L16 | `board.md` §8 | sim (S10) |
| L17 | `board.md` §2.2 | sim (B3) |
| L18 | `components.md` Apontamento (`:681`) | parcial: o arquivado (bloqueio 7) |
| L20 | `components.md:449`, com texto diferente da decisão | sim, no app |
| L22 | `rest.md:436–444`, `changes.md` X21, `storage.md:68`, `features.md:443`; **sem a resposta do usuário** | sim (bloqueio 5) |

Nenhuma lacuna tem entrada em `decisions.md`.

### As pautas

- Toda linha com id tem commit.
- As linhas sem id conferem com o código: `ModelsPopover.tsx:102` (`own={false}`), `request.ts:442` com `useBornStatus` (`TaskRequest.tsx:100`), `Textarea.tsx:27`, `:36` (`rows`), `SearchInput.tsx:77` (`preventDefault`), `stage-actions.ts:67` (`preparing`), `no card to select` em `board.md` §3.7, `Ctrl E` na régua e a janela dos reviews em `state_test.go`.
- O formato tem os desvios do bloqueio 6: S10 sem commit e as colunas da discussão trocadas.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | 72 de 75 itens feitos e 3 parciais (bloqueio 7); 12 lacunas sem registro (bloqueio 3); o relatório sem o commit de S10. Esta crítica faz a `Revisão da branch` |
| 2 | Ok, com ressalva | As onze existem. V1 a V8 rodam no `lint:web` e mordem numa cópia; os comandos dão vazio, salvo os casos do próprio teste em V3 e V5 (item 10). V9 a V11 estão fora do `task check` (bloqueio 4) |
| 3 | Ok | Os comandos de `12:152–170` dão vazio, e `knip` dá 0 |
| 4 | **Falha** | As metas estão em `target-machine.md`, nos dois motores e nas duas builds, mas o `↓` do History passa só pela regra dos 33,3 ms (bloqueio 4) e as medidas não estão no corpo (bloqueio 6). A janela perde a rolagem no WebKitGTK (bloqueio 1), e sobrevivem nove mutações da janela (bloqueio 8) |
| 5 | **Falha** | A varredura passa e morde, mas o escuro só a 1100 e a 2560 e 13 de 26 telas de referência (bloqueio 4). Sem capturas na PR (bloqueio 6) |
| 6 | Ok | `motion.painted.test.tsx` cobre `12:266`, e a mutação do spinner e a da transição morrem. No app, com `gtk-enable-animations=0`, o spinner para como anel de três quartos (dois quadros a 170 ms idênticos) |
| 7 | Ok, com ressalva | `computeAccessibleName` em toda cena; o botão sem nome falha. O alerta montado por um efeito escapa (item 9) |
| 8 | Ok, com ressalva | As pautas com commit ou decisão, salvo o formato (bloqueio 6) |
| 9 | **Falha** | Sem a checklist no corpo (bloqueio 6) |
| 10 | Ok | `task check` verde na ponta, na 3ª rodada (item 1). Cada commit compila, passa o lint, o typecheck e o jsdom do que toca. Nenhum teste removido sem substituto |
| 11 | **Falha** | `docs/` está no presente e cobre `12:462–474`: `frontend.md`, `design-system.md`, `stack.md`, `testing.md`, `setup.md`, `ci.md`, `overview.md`, `sessions.md`, `storage.md` e `features.md`. Mas `design/` contradiz o código (bloqueio 3), e `features.md:1103` contradiz o Page Up (bloqueio 7) |
| 12 | Depois do merge | `design/README.md:50` ainda diz "pronta para iniciar" e "13 steps". O fim da fase 5 é do coordenador, depois do merge (`12:34`) |

## Tokens e contraste

**`tokens.css`** só ganha `--size-menu-max: calc(var(--space-16) * 5)`, que dá 320 px (L15). `globals.css` importa `tokens.css` direto, sem espelho.

**Valores soltos:** nenhuma cor, duração ou passo numérico solto nos arquivos novos ou muito alterados. São `MermaidBlock`, `CodeFrame`, `MigrationRefused`, `UnclonedRepository`, `PlaceHeader`, `StartRow`, `Menu`, `FilterBar`, `ListSectionHeader`, `KeyNotice`, `Toast`, `ShellToasts`, `globals.css`, `HistoryView`, `CardTree`, `Conversation`, `StretchFold`, `NoticeStrip`, `Select`, `useWindowedRows` e `inline-code`. Sobram:
- os limiares de container query (`@max-[620px]`, `[1660px]`, `[900px]`), que vêm dos documentos de tela, porque o Tailwind não aceita variável em query;
- valores arbitrários feitos só de tokens (`w-[calc(var(--space-16)*4)]`).

**Medido no Chromium 1.63 do Playwright**, sobre os OKLCH de `tokens.css`, com os véus compostos num canvas em sRGB (claro / escuro):

| Texto ou traço | Fundo | Claro | Escuro | Passa |
|---|---|---|---|---|
| A tecla do secundário, `--ink-3` | `--surface-2` | 7,26 | 7,09 | sim |
| A tecla do primário, `--brand-on` | `--brand` | 5,65 | 7,77 | sim |
| A tecla desabilitada, `--ink-4` | `--surface-2` | 6,15 | 5,72 | sim |
| O contorno da tecla, `--line-2` / `--brand-key-ring` / `--line-1` | a superfície do botão | 1,30 a 2,36 | 1,05 a 2,53 | decorativo: a tecla é o texto |
| O item desabilitado focado, `--ink-3` (S14) | `--veil-hover` em `--surface-3` | 6,54 | 5,54 | sim (antes 5,54 / 4,47) |
| A linha 2 da linha aberta pressionada, `--ink-2` (S16) | `--veil-press` em `--brand-veil` | 6,61 | 6,67 | sim (`--ink-3` dava 4,41 no claro) |
| O código no título do apontamento, `--ink-1` (L18) | `--surface-0` | 16,21 | 15,88 | sim |
| `↓ N more below`, `--ink-3` (S13) | `--surface-sidebar` | 6,18 | 8,62 | sim |
| O anel de foco `--focus` (S1) | `--surface-1` / `--surface-3` | 5,56 / 5,65 | 7,16 / 5,94 | sim (3:1) |
| idem | `--brand-tint-plane` / `--brand-veil` / a lateral | 4,71 / 4,10 / 4,81 | 5,53 / 5,85 / 7,71 | sim |
| O polegar da barra, `--line-2` (S3) | `--surface-1` / `--surface-3` | 1,51 / 1,53 | 1,58 / 1,31 | abaixo de 3:1; a anatomia decidida (item 12) |
| O polegar sob o ponteiro, `--line-3` | `--surface-1` | 3,46 | 3,69 | sim |
| O marco `Step N started`, `--ink-2` / `--ink-3` (T1) | `--surface-1` | 10,73 / 7,15 | 10,95 / 8,01 | sim |
| A faixa afundada do documento, `--ink-1` / `--ink-2` (H2) | `--surface-0` | 16,21 / 9,75 | 15,88 / 11,63 | sim |
| O placeholder do compositor, `--ink-4` | `--surface-input` | 6,15 | 6,81 | sim |
| `Not read yet`, `--ink-4` (S9) | `--surface-1` / `--surface-3` / o hover | 6,06 / 6,15 / 5,45 | 6,47 / 5,37 / 5,53 | sim |
| `--ink-4` pressionado na lateral | `--veil-press` | 4,36 | 5,51 | a exceção que `tokens.css` já lista |

**Estado sem cor como único portador:**
- a faixa de falha tem `◇` e texto;
- o chip órfão diz a razão no nome (B6);
- a linha do card diz `Clone failed` e `Cloning…` no nome (B5);
- o item desabilitado tem a razão no nome;
- o marco do prompt do produto é texto.

## No app real

**Como rodou:**
- `task build` numa cópia em `3fb9362`;
- `bin/myspec` sob `env -i`, com `HOME` e `XDG_*` no scratchpad e `XDG_RUNTIME_DIR` curto em `/tmp`;
- `dbus-run-session` próprio e `GTK_A11Y=none`;
- `gtk4-broadwayd :61` (porta 8141), dirigido pelo Chromium headless do Playwright, nas cinco janelas e nos dois temas.

**O banco** é o do passe, com, por cima, gravados por sqlite3:
- o board real `Pessoal` com `guilhermt/MySpec` clonado, só para leitura;
- `aaa-tools` (clone inexistente) e `zeta` (sem clone);
- uma leitura de 2.000 cards;
- três conversas de 1.500, 300 e 60 entradas, com fala, grupos, comando com saída, código, mermaid, tabela, pergunta e permissão.

Para a causa do bloqueio 1, o MiniBrowser do WebKitGTK 2.52.6 rodou pelo Broadway (`:63`, porta 8143), com o build de medida servido na 9256. Tudo foi encerrado pelo PID, e os temporários, apagados. Nada foi escrito no GitHub, e o diretório de dados do usuário não foi tocado. As capturas estão no scratchpad, fora do repositório.

**O que o app mostrou:**
- **Os três que bloqueavam:**
  - S1, o anel depois do clique, do script e da tecla;
  - T1, o prompt de início como marco sem ação;
  - R1, as faixas em linhas inteiras a 452 px.
  Todos como o relatório pede.
- **Os "deve" por área:**
  - **system:** S2, S4, S5, S6 no prompt e no PRD do arquivado, S7, S8, S9, S11, L2, L3 e L10;
  - **task:** T3, o mermaid no tamanho natural num bloco só;
  - **Home e board:** B2, L14 (a barra numa linha a 1100 com o painel) e L17;
  - **o banco mais novo:** L22, com o banco intacto.
- **O movimento reduzido:** com `gtk-enable-animations=0` em `$XDG_CONFIG_HOME/gtk-4.0/settings.ini`, o WebKitGTK passa `prefers-reduced-motion`, e o spinner de `Reading…` para em três quartos.
- **A largura:** Home, board com e sem painel, task, Reviews com painel, review, discussão, Settings e History, nas cinco janelas e nos dois temas. Nada sobreposto, sem rolagem horizontal.
- **O meio pixel:** as bordas da barra do pedido e da linha do board, ampliadas a 600% a 1100 e a 2560, estão nítidas.
- **As telas das tasks 2 a 11:** nada quebrado à vista.
- **Os defeitos:** a rolagem da janela (bloqueio 1), a mensagem da passada na fila (bloqueio 2), o anel do `Inbox` sob a barra (item 5) e o caminho do diálogo de nova discussão (item 6).

**O que o app não mostrou:**
- **T2:** com o `gh`, a PR não bloqueou.
- **O cartão de apontamentos e o anel por fora do `--brand-ring` com `Alt+↓`:** a task semeada não tinha passada. As provas do jsdom cobrem.
- **H2:** não provoquei uma falha de leitura de documento. O código mostra os quatro lugares do bloqueio 7.
- **H4 com um arquivado de hoje:** os de outro dia dizem `Oct 4 at 06:20`, como L4 pede.
- **S3, S12, S13 e S14:** não abri um diálogo que role, e não houve tempo para os três outros.
- **B4 e D1:** não abri o diálogo de criação, e não havia um rascunho alto.
- **O brilho chapado:** só o spinner foi provado.
- **O History com 400 itens:** havia 78.
- **O GTK com o Hyprland:** é da checklist do usuário.

## Segunda leitura (6ae210e8)

Só as correções feitas depois da primeira leitura: o diff `3fb9362..6ae210e8`, com 21 commits, três deles merges. A ponta confere com `origin` depois do `git fetch`.

### Veredito

**Corrigir antes do merge.** Dos oito bloqueios, seis estão fechados como o "Mudar" pedia, e o 5 está escrito como pendente do usuário. Sobram duas correções curtas:
- **Uma regressão nova na rolagem da conversa** (N1): a folga que a correção pôs em `useAutoScroll` às vezes devolve ao fim a primeira volta da roda para cima.
- **O corpo da PR sem as capturas escuras do meio** (bloqueio 6): o texto ainda descreve a matriz enxuta nas telas de referência.

O resto pode ir numa PR curta de acabamento.

### Os bloqueios

| # | Situação | Evidência |
|---|---|---|
| 1 | **Fechado no motor, com uma regressão nova (N1)** | `useWindowedRows.ts:280–304` (o `min-height` em pixel inteiro), `:247` e `:265` (as chaves), `:82–89` (`roomOf`) e `:134` (`overflowAnchor`). No MiniBrowser do WebKitGTK 2.52.6, com o React de produção e as cenas montadas como nos testes pintados, passam os quatro casos (tabela abaixo). Com a conversa a 1134, `End` no `feed` foca a 362/362 inteira na área e `↓` volta ao fim. Mutações: tirar o efeito do `min-height` falha 10 testes, entre eles todos os "as in WebKitGTK", e prova que `layoutInCommits` (`test/painted.ts`) reproduz o defeito no Chromium. Morrem também a medida sem as margens, o `overflowAnchor` e o arredondamento. Sobrevivem as chaves de volta ao índice e a folga de `useAutoScroll` |
| 2 | Fechado | `Conversation.tsx:723–747` desenha a entrada `app` pendente como o marco; `service.go:566` recusa `Prompt` e `App`. As duas mutações morrem (`Conversation.test.tsx:261`, `service_test.go:671`) |
| 3 | Fechado | `decisions.md` tem 22 entradas de 2026-10-04 (L1 a L21 e S27, `:23–109`) e 4 de 2026-10-05 (`:5–21`). Cada lacuna está no documento da coluna e no presente. `changes.md` tem T28, T29, B14 e D23. As contradições da primeira leitura estão corrigidas, nada está em forma de histórico, e `implementation.md` §12 está certo |
| 4 | Fechado | As quatro decisões estão em `decisions.md:5–21`, em `12-consistency.md` §4.2 e em `target-machine.md`. As metas de quadro, contadas por `dev/frames.ts`, passam no WebKitGTK com mediana 0 e máximo 1 |
| 5 | Fechado como pendente | `design/README.md:50`, `critique-task-12-pass.md:612` e `:820`, e a pergunta na checklist da PR. L22 ainda não entra em `decisions.md`, o que está certo antes da resposta |
| 6 | **Parcial** | As tabelas de Measures conferem número a número com `target-machine.md`, e "What does not pass" confere com "O que passa". As 211 URLs existem na branch `captures/59-…` (`gh api`), e a checklist cobre `12:31`. Mas Captures diz "dark at 1100 and 2560" para as telas de referência, contra a decisão de 2026-10-05 e o pronto 5: as 87 capturas escuras de 1250, 1450 e 2000 existem na branch e aparecem como "—" nas tabelas |
| 7 | Fechado | `StepDocument.tsx:10` e `MarkerLine.tsx:409`, `:450` e `:489` com `ui-headings`. A faixa afundada nos cinco lugares de H2. `ArchivedFindings.tsx:23`, `:32`. O cursor na linha do texto (`globals.css`, `.streaming-caret`). Page Up e Page Down andam dez entradas (`useFeed.ts`, `pageStop`), como dizem `features.md:1103` e `task.md:170`. Cada mutação morre |
| 8 | **Quase todo** | Das 22 sobreviventes da primeira leitura, morrem 16 (abaixo). As quatro mutações de S1 também morrem |

**O bloqueio 1 no MiniBrowser.** A ferramenta foi um harness numa cópia no scratchpad: as cenas de `measure-board`, `measure-history` e `conversationScene("long")` com 362 unidades em `TaskView`, montadas no build de medida. O motor rodou pelo Broadway em `:95`, a porta 8175, e a entrada foi real, de teclado, roda e arrasto da barra, dirigida pelo Playwright.

| Cena | `End` | A barra arrastada ao fundo | A roda |
|---|---|---|---|
| Board, 2.000 cards, 1134 px | foca `#1999` (20/20), inteiro (920–952 na área 48–1000), e fica lá por 3,8 s | para no fim, com 29 linhas | sobe 101 px |
| Board, 812 px, com o painel (452 px de lista) | foca `#1999`, inteiro (900–952) | para no fim enquanto a altura cai de 103.824 para 95.004 com as medidas | — |
| History, 400 itens, 1134 e 812 px | foca `Discussion number 399`, inteiro | para no fim | sobe 101 px |
| Conversa de 1.500 entradas, `TaskView`, 1134 px | abre no fim; `End` foca a 362/362, inteira; lida do topo, `↓` volta ao fim | para no fim enquanto a altura sobe de 24.156 para 31.754 | ver N1 |

### O que sobrou aberto

**Corrigir antes do merge:**
- **N1. A primeira roda para cima volta ao fim** (`features/chat/useAutoScroll.ts:73–82`).
  - **A causa:** a condição nova trata como "do próprio hook" qualquer `scrollTop >= followed.current - BOTTOM_SLACK`. Mas `followed` não se renova quando o leitor volta ao fim pela própria rolagem, e fica no fim antigo, mais baixo que o atual.
  - **O que acontece:** depois de arrastar a barra até o fim, numa conversa que cresceu ao medir, o primeiro evento da roda passa da folga. O hook chama `toBottom`, e a roda é desfeita: o traço é `[33250, 33249, 33161, 33250]`.
  - **A frequência:** em duas de três rodadas com o código da PR. Com a condição antiga (`followed.current === element.scrollTop`), nenhuma em três, e a conversa abre e para no fim do mesmo jeito.
  - **A prova:** a mutação da folga sobrevive (A8): nada prova o caso que a folga cobre, nem o que ela quebra.
  - **Mudar:** a folga só vale contra um `followed` atual. Por exemplo, `followed` volta a `null` quando o leitor deixa o fim (opinião). Mais um caso pintado que role para cima depois de chegar ao fim pela barra.
- **O corpo da PR** (bloqueio 6): as 87 capturas escuras do meio entram nas tabelas, e o texto de Captures segue a decisão de 2026-10-05.

**Podem esperar (PR curta de acabamento):**
1. **Mutações que sobrevivem:**
   - **Das 22 da primeira leitura, sobrevivem 6:**
     - H2 no arquivado (`ArchivedDocument.tsx:41`);
     - `CardRow` sem `memo` (`ListRow.tsx:221`);
     - o modelo do board feito para todas as linhas (`CardTree.tsx:237–253`);
     - a conversa sem fixar a última unidade (`Conversation.tsx:546`);
     - sem fixar as `before`/`after` (`:551–552`);
     - a conversa anterior abrindo no fim (`:574`).
     As três da conversa e o `memo` continuam sem prova, como o corpo diz.
   - **Sobreviventes novas:**
     - as chaves dos espaçadores de volta ao índice (`useWindowedRows.ts:247`, `:265`);
     - o vermelho de volta em `ArchivedDiscussion.tsx:251`;
     - `OtherConversationBar` sem `useToastLift` (`RequestBar.tsx:186`).
     O `Math.ceil` (`:299`) é equivalente.
   - **Por que não bloqueiam:** o comportamento visível de cada uma está provado por outro teste. Mas "What stayed out" deve listar H2 no arquivado, o modelo do board e as chaves.
2. **Duas capturas de 1100 estão cortadas:** `ref-create-card-1100-*` e `ref-settings-boards-add-3-1100-*` gravam só a área principal (`BoardView.widths.painted.test.tsx:54`, `Settings.widths.painted.test.tsx:207`). O diálogo centra na janela (L3), e aparece cortado à esquerda. Não é defeito do app, mas engana quem revisa.
3. **26 contra 29 telas de referência:** `12-consistency.md:248–264` e `decisions.md:19` dizem 26. O código e `testing.md:107` têm 29, com `board`, `task-checks` e `newer` a mais e sem explicação. A linha `notice`/`toast` virou só `toast` (`Settings.widths.painted.test.tsx:388`).
4. **`decisions.md:15`** dá a regra de quadro "com o React de produção" e manda para "Como medir". `target-machine.md` diz "nas duas builds", em "As listas virtualizadas".
5. **`target-machine.md` (A rolagem da janela no WebKitGTK):**
   - a tabela do MiniBrowser cita o board a 812 com o painel e a tela da task, mas as ferramentas de `src/dev` só montam `?measure=` e `stretches`. "Como medir" não diz como reproduzir essas cenas;
   - o `XDG_RUNTIME_DIR` "do usuário" continua lá (item 3 da primeira leitura).
6. **Os "Podem esperar" da primeira leitura** seguem abertos, salvo os resolvidos acima: `BoardView.tsx:231` com `querySelector`, `gqlparser` fora de `stack.md`, as provas condicionais de D1 e os instáveis.
7. **`Markdown.painted.test.tsx:78–80`** confere a borda da tabela dentro de um `if`. O resto da prova de T3 é incondicional e mata a mutação.

### Item 6: o que não abriu nada novo

- **`vitest.config.ts` com `commands`:** não muda o efeito em `task test:web`. Mudar o config já leva o `--changed` à suíte inteira (`forceRerunTriggers` padrão, `**/{vitest,vite}.config.*`), e esta branch já o mudava desde a varredura.
  - **Miúdo:** `test/browser-commands.ts` só é importado pelo config, e nenhum grafo de teste o alcança. Uma branch que mude só ele não roda teste no `task check`; o CI `Painted` roda.
- **`overflow-anchor: none`:** fica só no viewport das três listas em janela (`useWindowedRows.ts:134`). A conversa já tinha a classe (`ConversationColumn.tsx:41`). No WebKitGTK 2.52.6 o valor é inerte: `CSS.supports("overflow-anchor", "none")` é falso, e `CSSScrollAnchoring` está desligado.
- **O `::after` do cursor:** usa `content: "▋" / ""`. O WebKitGTK aceita a sintaxe (`CSS.supports` verdadeiro; o `content` computado é `"▋" / ""`), e o texto alternativo vazio tira o cursor do nome e da leitura. A linha própria, depois de um bloco de código, mantém `aria-hidden`.
- **`data-dialog-size`:** vai em todo tamanho, mas só `full` tem regra (`globals.css:586–589`). Os outros seguem a `8vh`.
- **As telas das tasks 2 a 11:** o `task check` rodou toda a suíte pintada sem a varredura, verde. A varredura inteira (os cinco `*.widths.painted.test.tsx` e `test/widths.painted.test.tsx`), numa cópia com porta própria, deu 1.300 testes verdes em 215 s.

### Suítes e CI

- **`task check` na ponta:** verde em 140 s. Tidy, lint, typecheck, Go (3.484 testes, um pulado), web com `--changed` sobre 474 arquivos e 9.724 testes, vuln e bindings. `git status` limpo depois.
- **`go test -race -count=3 ./internal/session/`:** verde em 34 s.
- **`gh pr checks 95`** (run 37369923558, em `6ae210e8`):
  - passam `Changes`, `Build` e `Painted (3/3)`;
  - `Go`, `Frontend`, `Painted (1/3)` e `Painted (2/3)` foram cancelados sem runner e sem nenhum passo, com 15 min de fila. É o incidente do GitHub, não o código.
