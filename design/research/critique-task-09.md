# Crítica da task 9 · A discussão (PR #82)

Leitura da branch `56-redesign-9-the-discussion` em `4fe861e` (15 commits, 203 arquivos, CI verde), na worktree de revisão. A régua, nesta ordem:

- `design/tasks/09-discussion.md` (o material; `09:N` é a linha N dele), com os quatro pontos de §6 que a task 8 deixou (`09:560–564`);
- `screens/discussion.md`, e `screens/task.md` no que o material cita;
- `structure.md`, `principles.md`, `system/components.md` e `system/tokens.css`;
- `changes.md` (D1–D22, S10), `backend.md` (P3, P10, P22c, P23–P25, F16–F18) e `decisions.md`;
- o mock `lab/13-screen-discussion/b.html` e as fontes que o material aponta.

Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa. A PR não muda nada em `design/`: `git diff main...HEAD -- design/` é vazio, e o material não foi editado pela implementação.

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** a tela está lá, e a regra é uma só.
  - A linha do gesto vem do Go, pela função da cadeia (`internal/discussionflow/state.go:237–242`), e o frontend só escreve os nomes (`features/discussion/drafts-card.ts:430–487`).
  - A rodada e a revisão estão em `reconcile`, e os marcos são gravados uma vez, com a deduplicação no `session` (`internal/session/service.go:944–1008`).
  - O cartão, o dobrado, o aberto, a trava de 900 ms, o avanço e o desfazer estão lá. Também a barra em todas as situações e pausada, o `⋯` com as razões, `Details`, `Documents`, os quatro diálogos, a página que saiu e a árvore com a rodada.
  - O que saiu (`DraftsPanel`, `EpicGroup`, `DraftCard`, `DependencyList`, `DraftDiff`, `DiscussionBar`, `DiscussionContextPreview`, `ConversationComposer`) não deixou referência.
  - No app real, a chegada abriu o primeiro por decidir com a linha do gesto. `D` avançou com volta ao começo e com a trava. `Esc` fechou na ordem, e a rodada 1 dobrou com a pílula em `Round 2` ("No app real").
- **Mutações:** rodei 354: 153 no Go, 186 no jsdom e 15 no pintado.
  - No Go, morrem 124. Das 29 que sobrevivem, sete são equivalentes. As outras mostram casos de tabela que faltam, nenhum de um pronto inteiro (item 9 de "Podem esperar").
  - No jsdom, morrem 179 de 186. Das sete que sobrevivem, quatro são equivalentes. Faltam três casos de teclado: `Alt+↓` com um diálogo aberto, `Ctrl+A` e `Shift+Alt+↓`.
  - No pintado, a prova do texto cortado quase nunca morde (bloqueio 4).
- **O que falta fazer:** são cinco bloqueios.
  - Faltam as capturas do pronto 1, e as cenas mostram o rascunho atual fora de vista.
  - Falta a prova do pronto 9.
  - Um dos quatro pontos que a task 8 deixou não foi feito.
  - Três textos cortados não têm tooltip, um deles pedido pelo material.
  - O rodapé dos diálogos muda de forma enquanto se digita, e a primária vai para o lugar de **Cancel**.

O bloqueio 2 precisa do usuário. Os outros não pedem decisão.

**Sobre as capturas.** Não existe `captures/56-…` no `origin` (há só as das tasks 3 a 7). O corpo da PR não tem tabela de capturas nem a checklist da máquina alvo. Trato isso como nas tasks 3 a 7: é um bloqueio, porque `09:19` pede as capturas anexadas à PR, lado a lado com o mock. Para olhar, gerei as 116 numa cópia e fotografei o mock (veja "Capturas").

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`. `task check` rodou na worktree de revisão; as outras, em cópias no scratchpad. Todas verdes:

| Suíte | Resultado |
|---|---|
| `task check` (tidy, lint, typecheck, `test`, vuln, bindings) | verde em 113 s; `git status` limpo depois |
| `task test:go` (dentro do check) | 3.145 testes, 1 pulado (`dnd`, dependente da máquina) |
| `task test:web` (`--changed`, dentro do check) | 7.469 testes em 347 arquivos |
| `vitest --project unit`, inteiro, numa cópia | 6.077 testes em 305 arquivos, 80 s |
| `vitest --project painted`, inteiro, numa cópia com a API na porta 63491 | 1.627 testes em 71 arquivos, 69 s |
| `go test -race -count=5` em `internal/discussion`, `discussionflow`, `attention` e `session`, numa cópia | 1.365 execuções de topo, nenhuma falha, nenhuma corrida; não houve teste instável como o da task 8 |
| `task bindings:check` | sem diff |

O CI da PR tem **Changes**, **Go** e **Frontend** verdes, e **Build** pulado. A PR está `MERGEABLE` e `CLEAN`, com a cabeça em `4fe861e`. O check passa na ponta, mas não foi conferido commit a commit (pronto 10).

### Mutações

Cada mutação rodou numa cópia desligada do git, só com os testes que ela alcança. O Go rodou com `-count=1`. O jsdom rodou com `vitest --project unit` sobre `features/discussion`, `features/chat`, `components/system`, `lib`, `store`, `features/sidebar`, `features/navigation` e `app`. O pintado rodou nos dois testes de cenas. "Falha (n)" é o número de testes que falharam. A tabela traz as que importam; as outras morrem.

| Pronto | Mutação | Onde | Resultado |
|---|---|---|---|
| 4 | A primeira leitura ganha `max(R,1)` | `internal/discussion/reconcile.go:32` | falha (14) |
| 4 | A rodada seguinte é `R+1` | `reconcile.go:34` | falha (6) |
| 4 | O descartado de uma rodada fechada fica | `reconcile.go:49` | falha (2) |
| 4 | O id reusado igual fica na rodada dele | `reconcile.go:72` | falha (1) |
| 4 | `R` pelo último rascunho, não pelo maior | `reconcile.go:159` | **sobrevive** |
| 4 | A rodada fechada sem o filtro `Round == R` | `reconcile.go:168` | **sobrevive** |
| 4 | A rodada fechada com `Started()` no lugar de `Done()` | `reconcile.go:168` | **sobrevive** |
| 4 | Revisado num id reusado que vai para a rodada nova | `reconcile.go:79` | **sobrevive** |
| 4 | "Mudou" sem `title`, `body`, `epic`, `dependencies`, `cards`, `card` | `reconcile.go:180–188` | falha (1 a 6) cada |
| 4 | "Mudou" sem `repository`, `module`, `kind` | `reconcile.go:182`, `:183`, `:187` | **sobrevivem** |
| 4 | `ApprovalCleared` nos três casos de `normalize` | `reconcile.go:84`, `:406`, `:408` | falha (2 a 3) cada |
| 4 | `Decide` não zera `ApprovalCleared` | `internal/discussion/service.go:470` | falha (1) |
| 4 | `carryOver` perde `ApprovalCleared`, perde `RevisedReading` | `reconcile.go:231`, `:232` | **sobrevivem** |
| 4 | `Recorded.First` sem exigir rascunhos; `Round` 0 sem nenhum | `reconcile.go:100`, `:150` | **sobrevivem** |
| 4 | `Before` sem `Outcome`, sem `Reference` | `reconcile.go:121`, `:126` | **sobrevivem** |
| 4 | Os avisos de `normalize` pelo id | `reconcile.go:363`, `:368` | falha (1) cada |
| 4 | O aviso do ciclo de dependências pelo id | `internal/discussionflow/publish.go:546` | **sobrevive** |
| 4 | `GroupIntoEpic`: título vazio, bytes no lugar de runas, `>=` 256, as quatro recusas de `ErrNotGroupable`, a rodada, o repositório, a `board.Refusal` | `service.go:479–544`, `internal/bindings/discussion_service.go:245` | falha (1 a 3) cada |
| 4 | O corpo vazio só no épico do usuário | `service.go:305` | falha (1) |
| 4 | `Reason` sem maiúscula, sem ponto, com o prefixo | `internal/discussion/artifact.go:57`, `:63` | falha (1 a 2) cada |
| 4 | `drafts_written` nunca, sem número, rodada 1 | `internal/discussionflow/evaluate.go:134`, `:136` | falha (1 a 2) cada |
| 4 | `drafts_revised` em qualquer mudança, sem `Before` | `evaluate.go:138` | **sobrevive** |
| 4 | `drafts_unreadable` sem a rodada | `evaluate.go:124` | **sobrevive** |
| 4 | `drafts_published` com a rodada 1 fixa | `publish.go:583` | **sobrevive** |
| 4 | A deduplicação do documento pelo carimbo, da publicação por rodada e do ilegível pela razão | `internal/session/service.go:962`, `:984`, `:996` | falha (1 a 2) cada |
| 4 | `discussion_started` sem `Model`, `Effort`, `Board` ou `Epics` | `session/service.go:410–411` | falha (1 a 2) cada |
| 4 | `ApprovePublishes` e `DiscardPublishes` sem subtrair o que já vai, `ApproveHold` pela cadeia de agora | `state.go:240–242` | falha (1) cada |
| 4 | ` The discussion was undone.` sempre, nunca | `internal/discussionflow/start.go:65`, `:67` | falha (2) cada |
| 4 | A linha do prompt que pede manter o id | `internal/prompts/prompts.go:183` | falha (2) |
| 4 | `revised` sem `RevisedReading > 0` | `internal/bindings/convert.go:2085` | **sobrevive** |
| 4 | As três frases dos sentinels novos | `internal/bindings/task_service.go:952–954` | falha (1) cada |
| 4 | Os padrões da `0024` (1, 0, 0) trocados | `internal/store/migrations/0024_discussion_rounds.sql:4`, `:8`, `:12` | falha (1) cada |
| 2 | A trava de 900 ms a 0 e a 100; só nas teclas; só no rascunho decidido | `drafts-card.ts:18`, `components/system/DecisionCard.tsx:155`, `:59` | falha (3 a 4) cada |
| 2 | `event.repeat` decide | `DecisionCard.tsx:95` | falha (1) |
| 2 | Um gesto que publica avança; o desfazer avança | `drafts-card.ts:525`, `:521` | falha (4), falha (5) |
| 2 | `↑` no primeiro e `↓` no último não saem do cartão | `DecisionCard.tsx:110` | falha (2) |
| 2 | `Alt+↓` com um diálogo aberto | `features/discussion/DiscussionView.tsx:102` | **sobrevive** |
| 2 | `Ctrl+A` e `Ctrl+D` decidem | `DecisionCard.tsx:96` | **sobrevive** |
| 2 | `Shift+Alt+↓` anda | `DiscussionView.tsx:105` | **sobrevive** |
| 2 | `Ctrl+Enter` confirma o apagar; não confirma arquivar, agrupar, começar | `DeleteDiscussionDialog.tsx:61`, `ArchiveDiscussionDialog.tsx:58`, `GroupEpicDialog.tsx:101`, `NewDiscussionDialog.tsx:189` | falha (1 a 5) cada |
| 3 | Os estados e as linhas do gesto de cada caso; os nomes (`this card`, `the epic`, `the epic <título>`); a vírgula de Oxford | `drafts-card.ts:134–512`, `lib/situations.ts:58` | 37 mutações, todas falham |
| 3 | A barra: o lugar, `N of M` da rodada, a variante, `Stopped at`, pausada, os textos do ilegível, o **Retry** da sessão | `features/discussion/discussion-request.ts:69–269` | 16 mutações, todas falham |
| 3 | A pílula, o `⋯` e `Details` | `features/discussion/discussion-header.ts:23–321` | 12 mutações, todas falham |
| 3 | Os marcos da discussão e a dobra | `features/chat/discussion-markers.ts:102–441` | 23 mutações, todas falham |
| 3 | O diálogo novo: a linha do contexto, as razões, a contagem por ponto de código | `features/discussion/new-discussion.ts:30–119` | 12 mutações, todas falham |
| 5 | `✓ Created` sem a hora, a saída pelo GitHub, `Publishing…`, `N so far`, `Publication stopped`, `Publish failed`, a razão tracejada | `drafts-card.ts:134–500`, `discussion-markers.ts:405`, `:419`, `discussion-request.ts:168` | falha (2 a 6) cada |
| 6 | O marco `Round N`, `revised once`, a página com `nothing published` e a hora | `discussion-markers.ts:438–441`, `features/navigation/gone-rounds.ts:31–33` | falha (1 a 7) cada |
| 7 | Os focos da chegada de cada situação, o anúncio, a piscada, a rodada no anúncio | `discussion-request.ts:117–188`, `DiscussionRequest.tsx:38`, `:77`, `lib/situations.ts:257` | falha (2 a 12) cada |
| 8 | Sem **Retry**, sem **Existing issue…**, sem `On GitHub`, sem **Changes** depois de publicar, sem `Linked on GitHub`, **Retry** habilitado na corrida, **Approve** primária | `Draft.tsx`, `DraftEditor.tsx:67`, `CardDraft.tsx`, `drafts-card.ts` | 15 mutações, todas falham (`where-actions-went.test.tsx` pega cada uma) |
| — | A árvore conta todas as rodadas, sem `· Round N`, publicando sem a rodada | `features/sidebar/sidebar-tree.ts:471`, `:329`, `:652` | falha (1 a 3) cada |
| 1 | Um dobrado, um aberto, um marco com altura fracionária | `FoldedDraft.tsx:124`, `Draft.tsx:210`, `chat/entries/MarkerLine.tsx:456` | falha (62 a 100) |
| 1 | O cartão, a barra, o compositor 1 px fora da coluna | `DecisionCard.tsx:143`, `RequestBar.tsx:144`, `chat/Composer.tsx:292` | falha (88 a 100) |
| 1 | **Approve** primária; **Archive…** secundário | `Draft.tsx:340`, `discussion-request.ts:79` | falha (54), falha (18) |
| 1 | O título do dobrado sem tooltip | `FoldedDraft.tsx:138` | **sobrevive** (nenhum título é cortado nas cenas) |
| 1 | A linha 2 do dobrado sem tooltip; a linha da lista do marco sem tooltip | `FoldedDraft.tsx:158`, `MarkerLine.tsx:145` | falha (6, só em `many`), falha (2, só em `many` a 812) |

**Os equivalentes:**
- No Go, sete:
  - `R ≥ 0`, porque sem rascunhos a rodada dá 1 de todo jeito;
  - o outro lado da condição de `reconcile.go:79`;
  - a fonte do épico em `service.go:305`, porque só épicos são `SourceUser`;
  - `Reason` de um erro sem o prefixo;
  - o carimbo A→B→A;
  - a falha num rascunho sem decisão, que `Decide` impede;
  - o `Sync` que carimba de novo.
- No jsdom, quatro. `refocus` (`features/discussion/DraftsCard.tsx:117`) e o centro do avanço (`DecisionCard.tsx:72`) são cobertos pelo `Slot` (`DraftsCard.tsx:56–63`). Os itens `disabled` na corrida são cobertos por `decisionOf`. A ordem de `Esc` em `DraftEditor.tsx:220` também é coberta, porque o `DependencyPicker` para a propagação.

As que importam estão no item 9 de "Podem esperar". A mais visível, se regredir, é a de `reconcile.go:79`: um id reusado pelo agente com outro conteúdo ganharia `Revised` no primeiro rascunho da rodada nova. Outra é `convert.go:2085`: sem o `> 0`, todo rascunho arquivado diria `revised`, porque `FromArchivedDiscussions` passa `draftsRevision` 0 (`convert.go:1924`).

### A `0024` sobre dados anteriores

- **O teste** `TestTheRoundsMigrationPutsEveryDraftInTheFirstRound` (`internal/store/migrate_test.go:1187`):
  - abre um banco na versão 23, com uma discussão ativa e uma arquivada e quatro rascunhos;
  - confere `1|0|0` nas três colunas.
  - As três mutações dos padrões morrem. Ele não prova que o resto da linha fica, nem a leitura pelo Go.
- **Uma cópia de banco**, além do teste:
  - um banco aberto pelo `store.Open` de uma cópia sem a `0024`, em `user_version` 23;
  - sete rascunhos gravados com `sqlite3`: aprovado e publicado, aberto com o título editado, épico com dependência, descartado, falho e começado, um `updated` arquivado e um épico do usuário descartado e arquivado;
  - reaberto pelo `store.Open` da branch: chegou a 24.
- **O resultado:**
  - toda linha com `round=1`, `revised_reading=0`, `approval_cleared=0`, `NOT NULL`;
  - toda coluna anterior idêntica byte a byte ao dump de antes;
  - `discussion_dependencies` e `discussions` iguais;
  - `integrity_check` ok e `foreign_key_check` vazio;
  - `Discussions.Drafts` lê as sete linhas com as decisões, os resultados e os títulos intactos.

### Capturas

- **No `origin` e na PR:** não existe `captures/56-…`. O corpo da PR não tem tabela de capturas (bloqueio 1).
- **Numa cópia:** `MYSPEC_CAPTURES=1` nos dois testes de cenas gravou 116 capturas: 58 claras e 58 escuras; 56 a 2180, 56 a 978 e 4 a 812. Os nomes seguem `discussion-<cena>[-<flag>]-<largura>-<tema>.png`.
- **O mock:** servi o lab de uma cópia na porta 8137, encerrada pelo PID. Fotografei `b.html?scene=…&theme=…&freeze`, com janelas de 2560, 1280 e 1100, que dão áreas de 2180, 978 e 812. São 67 imagens lado a lado (o mock à esquerda), fora do repositório.
- **O que as cenas cobrem:** as doze da tela e as flags de `09:19` (`DiscussionView.scenes.painted.test.tsx:89–124`), mais a página que saiu, arquivada e apagada. As do diálogo são `start` e `start?home`. Medem o pixel inteiro, as bordas da coluna, o texto cortado e a primária única.
- **O relógio:** bate com `09:19`. As barras dizem `Waiting for reply · Discussing 2m`, `Decide drafts · round 1 6m`, `Ready to archive 1m`, `!1m`, `1m` e `4m`.
- **As fixtures divergem do material em três pontos:**
  - o contexto tem 1.768 caracteres, contra os `5,690 characters` de `09:107` e `:148`;
  - a linha da task `t1` (`Question · Reviewer · Step 3/7`) não aparece em nenhuma captura, porque a lateral não é desenhada;
  - as capturas da página que saiu mostram aberto o tooltip do foco (`Next: Rate limit per API key Ctrl+J`).
- **O que diverge do mock**, fora o que `09:425` já lista e o que o material decide diferente:
  - **O rascunho atual fica fora de vista na chegada** (bloqueio 1).
  - **A pílula `↓` de ir ao fim cobre conteúdo.** Em `epic` a 2180, ela esconde `Approved · the epic needs two approved cards` na linha da decisão. Em `drafts`, `publish` e `publish?after`, cobre **Approve**/**Discard**/**Edit**; em `drafts?edit`, o dobrado 4.
  - **Os títulos do corpo** (`## Context`, `## Problem`) saem maiores que o título do rascunho (item 3 de "Podem esperar").
  - **O rodapé de `many?group` quebra em duas linhas** (bloqueio 5).
  - **`drafts?edit`:**
    - **Edit** `E` fica visível ao lado de **Done**;
    - falta o complemento `Markdown` depois de **Body** (`09:239`);
    - os chips de dependência são neutros, e o mock os tinge.
  - **A barra:** **Next to decide** sem o ícone `↓`, e **Show** sem o `↑`.
  - **`start`:**
    - os cards dizem o repositório curto (`billing`), e `09:106` pede `acme/billing`;
    - o aviso do clone se parte em duas colunas, com `acme/billing isn't cloned.` em negrito, onde `09:108` é uma frase só.

## Bloqueiam o merge

1. **As capturas não estão na PR, e as cenas mostram o rascunho atual fora de vista** (pronto 1).
   - **O que falta.** `09:19` pede as capturas gravadas e anexadas à pull request, lado a lado com o mock. Não há `captures/56-…`, e o corpo não tem as tabelas.
   - **A chegada esconde o rascunho atual.** Nas capturas de `drafts`, `publish`, `publish?after`, `epic` e `partial-fail`, a 2180 e a 978, o cabeçalho do rascunho aberto (o número, o tipo e o título) fica acima da área visível. Em `many`, a 2180, 978 e 812, o rascunho 3 sai inteiro da tela: no alto só aparece a linha de **Approve**/**Discard** dele. No mock, o atual aparece com o título, centrado.
     - **A causa provável:** `focusDraft` (`lib/focus.ts:157`) e o `Slot` (`features/discussion/DraftsCard.tsx:63`) rolam com `block: "center"`. Isso corta o topo de um rascunho mais alto que a área da conversa, e um corpo com títulos `##` passa facilmente dos 500 px.
     - **No app real:** com um épico de corpo curto, a chegada acertou (`03-a-open.png`).
     - "O que se vê primeiro é o que importa" não vale nessas cenas. A captura vai mostrar ao usuário exatamente isso.
   - **Mudar:**
     - rolar o atual pelo topo quando ele não cabe (`block: "start"`, ou `nearest` com o cabeçalho visível), na chegada, em **Show**, em `Alt+↓` e no avanço;
     - acrescentar à prova pintada que o cabeçalho do rascunho atual está dentro da área visível em toda cena com um aberto;
     - tirar o tooltip aberto das capturas da página que saiu;
     - rodar `task captures` e `task captures:push`, e pôr no corpo as tabelas a 2180 e 978 (e 812 em `many` e `done?panel=Details`), nos dois temas, com a coluna do mock.
   - Não pede decisão.

2. **A prova numa discussão real (pronto 9) não foi feita nem registrada.**
   - `09:27` e `09:386–388` pedem um ponto de parada depois do step 10, operado pelo usuário: o binário da branch sobre `/tmp/myspec-proof-9`, só com o board `Pessoal`, sem escrita no GitHub. O roteiro:
     - os marcos de uma sessão de verdade;
     - **Ask for changes** com `Drafts revised` e `Revised`;
     - tudo descartado pelo teclado até `Ready to archive · nothing published`;
     - a rodada 2 que dobra a 1, e **Archive…** com a página que saiu.
     - O implementador registra na PR as capturas que o usuário entregar.
   - **Na PR:** os commits não falam da prova, e o corpo não tem a checklist `## Verification on the target machine`.
   - **O que daqui não deu para ver:** a sessão de verdade pede as credenciais do `claude`. É a única fonte dos marcos gravados pelo Go numa conversa real, de `Drafts revised` com o id mantido (`prompts.go:183`) e de uma rodada nova pedida ao agente. As cenas e os testes cobrem a forma, mas não o que o agente escreve.
   - **Pede o usuário.**
   - **Mudar:**
     - pôr no corpo a checklist `## Verification on the target machine` com o roteiro de `09:388`: preparar, cada passo com o texto que confere, as capturas e a limpeza;
     - o usuário roda o roteiro;
     - o implementador registra o resultado na PR.

3. **A árvore perde `publishing` durante uma corrida com uma situação de pé** (o primeiro dos quatro pontos de `09:561`).
   - **O que o material pede:** "a linha da árvore diz `publishing` pelo spinner também durante uma corrida com uma situação de pé (`Publish failed`, `Decide drafts · 2/4`)".
   - **O que o código faz:** `discussionStanding` (`features/sidebar/sidebar-tree.ts:650–655`) dá `Round 1 · publishing` com o tom `app`. Mas `buildRow` (`sidebar-tree.ts:730–746`) troca o tom, a linha 2 e o relógio pelos da situação sempre que há uma.
     - Com `publishing: true` e a situação `drafts`, a linha dá `tone: "wait"`, `Decide drafts · Round 1 · 1 of 2` e o chip, sem spinner e sem `publishing`.
     - É o que a crítica da task 8 apontou (item 4) e o material trouxe para cá.
   - **Os testes:** o único caso de publicação na árvore (`features/sidebar/sidebar-tree.test.ts:858`) não tem situação.
   - **A documentação:** `docs/product/features.md:277` descreve o comportamento do código (`Round 1 · publishing` só "sem situação"). A documentação bate com o código, mas não com `09:561`.
   - **Os outros três pontos estão feitos:**
     - a opacidade só no épico, com os cards aprovados em tinta cheia (`components/system/Draft.tsx:218`, `:224`; no app, `50-e-open.png`);
     - `Discarded` em texto (`drafts-card.ts:174`);
     - `standsAlone` fora do Go e `orderTargets` em `internal/discussionflow/publish.go:123`. O `epicOf` está em `internal/discussionflow/chain.go:128`, não em `internal/discussion/chain.go` como `09:564` diz.
   - **Mudar:** em `buildRow`, com `discussion.publishing`, manter o spinner e o relógio da corrida, e levar a situação para a linha 3; acrescentar o caso em `sidebar-tree.test.ts` (corrida mais `drafts`, corrida mais `publish_failed`); e reescrever `features.md:277`.
   - Não pede decisão. O material já decidiu.

4. **Três textos cortados sem tooltip, e a prova do pronto 1 quase nunca morde.**
   - **O que o material pede:** `09:19` pede todo texto cortado com tooltip, nomeando "o título e a linha 2 do dobrado, o valor dos seletores de **Edit**, a lista de um marco". `09:240` repete para **Repository**, **Module** e **Epic**: "o `Select` do system com o valor cortado com tooltip".
   - **Os três cortes sem tooltip:**
     - **O valor do `Select`:** `components/system/Select.tsx:115` corta (`truncate`) sem tooltip. Forçado o corte numa cópia, 8 testes pintados falham. O mock corta o **Epic** (`Pricing tiers with mete…`) na coluna dele.
     - **O estado de uma linha da lista do marco**, nova nesta task: `features/chat/entries/MarkerLine.tsx:150` (`max-w-1/2 … truncate`) corta, por exemplo, a razão de uma falha, sem tooltip.
     - **O complemento do marco:** `MarkerLine.tsx:308` (`Publication stopped · round 1 · 3 published · Overage on the monthly invoice failed`) corta sem tooltip. A peça é da task 4, mas os complementos longos são desta.
   - **A prova:** a de `DiscussionView.scenes.painted.test.tsx:289–299` só acha corte em três lugares: a linha 2 do dobrado 8 em `many`, um título no diálogo de `many?group` e uma linha da lista a 812. Nenhum título de dobrado e nenhum valor de seletor é cortado em cena alguma. Tirar o tooltip do título do dobrado (`FoldedDraft.tsx:138`) não quebra nada.
   - **Mudar:**
     - o tooltip no valor do `Select`, na linha da lista e no complemento;
     - uma fixture que corte o título de um dobrado e o valor do **Epic** em `drafts?edit` (um título longo, ou a cena também a 812), para a prova morder.
   - Não pede decisão.

5. **O rodapé dos diálogos muda de forma enquanto se digita, e a primária vai para o lugar de *Cancel*.**
   - **Onde:** `DialogFooter` (`components/system/Dialog.tsx:193–216`) é `flex-wrap`. Com a razão à esquerda, a primária não cabe e desce para uma segunda linha, sob **Cancel**:
     - em **Group drafts into an epic** (480 px), com `Name the epic to group the drafts.` (`11-a-group-dialog.png`; a captura `many?group`);
     - em **New discussion** (576 px), com `Write what to discuss or select at least one card.` (`60-new-dialog.png`).
   - **O que acontece:** quando a razão some, o rodapé volta a uma linha, e **Group 2 drafts** passa a ocupar o lugar onde estava **Cancel** (`12-a-group-titled.png`). No app real, o clique mirado em **Cancel** agrupou os rascunhos (`13`, `14`). As teclas que vinham depois foram para o épico novo, que recebeu o foco, e o `a` o aprovou. Desfiz em `16-a-undo.png`.
   - **Contra a régua:** `components.md` (Diálogo) põe "a razão ao lado quando a primária está desabilitada". O mock mantém uma linha. `principles.md` 2 pede a primária estável.
   - **Mudar:** os botões nunca quebram nem mudam de lugar. A razão encolhe (`min-w-0`, cortada com tooltip, ou em duas linhas dentro do espaço dela), e os botões ficam `shrink-0` à direita. A prova pintada mede a posição de **Cancel** e da primária com e sem a razão.
   - **O alcance:** é o `Dialog` do system, então a correção alcança também os diálogos das tasks 5 a 8. Os desta task são os que quebram, porque têm as razões mais longas.
   - Não pede decisão.

## Podem esperar

Em ordem de gravidade.

1. **O épico descartado a 60% esmaece também a saída da situação.**
   - `Draft.tsx:218` e `:224` põem `opacity-60` no número e na coluna inteira: o título, os campos, o corpo, o estado `Discarded`, `click again to undo`, **Approve**, **Discard** e **Edit**.
   - A situação `Epic discarded` leva a esse épico ("approve the epic again"), e o **Approve** dele parece desabilitado.
   - Medido sobre `--surface-2` (claro / escuro):
     - `--ink-1` dá 4,74 / 5,66;
     - `--ink-2` (o `Discarded`) dá 3,43 / 4,40 e falha 4,5:1;
     - `--ink-3` (os campos e `click again to undo`) dá 2,82 / 3,48 e falha;
     - `--state-error` dá 3,05 / 3,01.
   - A régua se contradiz. `09:562` diz que "a opacidade do descartado cabe ao cartão do épico descartado". `components.md` (Rascunho) diz "descartado (título em `--ink-2`, texto legível, sem risco)". `09:187` só pede o título em `--ink-2`.
   - **Pede decisão do coordenador:** a opacidade fica só no título e no corpo, ou sai, e a linha da decisão fica em tinta cheia. **Opinião:** sai, e o descartado vive pelo título em `--ink-2` e pelo `Discarded`, como os cards.

2. **A pastilha `Ask for changes` aparece onde a tabela diz que não há pastilha.**
   - `09:287–296` é "a primeira linha que vale": pausada, sessão parada, pergunta, permissão e agente trabalhando não têm pastilha.
   - `discussionStarters` (`features/discussion/discussion-request.ts:346–369`) só olha o artefato ilegível, os rascunhos abertos e o status. Com `sessionStatus: "paused"`, a caixa diz `Sending resumes the discussion…` e mostra `Ask for changes`. O mesmo acontece com `working`.
   - Os testes (`discussion-request.test.ts:647–655`) só cobrem "antes dos rascunhos" e "pronta para arquivar".
   - **Mudar:** devolver `[]` nas linhas de cima da tabela, com um caso por linha.

3. **Os títulos do corpo pesam mais que o título do rascunho.**
   - O corpo em `Markdown` (`features/discussion/CardDraft.tsx:384`) desenha `## Context` e `## Problem` no tamanho dos títulos da conversa, maiores que o título do rascunho (`--text-ui` 600).
   - No mock, são `--text-ui` em negrito.
   - `09:191` diz "no registro de leitura", que não fixa o tamanho dos títulos. O mock é a referência visual, e a hierarquia (o título primeiro) pede o menor.
   - Também faz o rascunho ficar alto, o que agrava o bloqueio 1.
   - **Opinião:** títulos do corpo em `--text-ui` 600 dentro de um rascunho.

4. **O que fica sob a barra.**
   - `E` abre **Edit** sem rolar: no app, **Depends on** ficou sob a barra até rolar à mão (`21-a-edit.png`).
   - O `DependencyPicker` abre para baixo e fica sob a barra e a pílula `↓` (`23`, `24`).
   - A pílula `↓` cobre o estado do rascunho atual nas cenas (veja "Capturas").
   - **Mudar:**
     - rolar a edição para dentro da área ao abrir;
     - abrir o `listbox` para cima quando não cabe embaixo;
     - não desenhar a pílula `↓` sobre o cartão quando o atual está em vista, ou dar à área um respiro igual à altura dela.

5. **Um aprovado da corrida mostra a razão, não o estado.**
   - `09:231` e o pronto 5 dizem "a decisão dos outros" e "um aprovado que está na corrida mostra o estado, não a razão".
   - `decisionOf` (`drafts-card.ts:498–505`) dá a razão a todos durante a corrida. `Draft.tsx:173` só a esconde no que está publicando (o spinner).
   - Por isso, o aprovado que espera a vez dele na corrida diz `A publication is running · the decision waits for it`, e não `Approved · publishing next`.
   - **Mudar:** em `Draft.tsx:173`, esconder a razão também num aprovado, com um caso em `DiscussionView.publish.test.tsx`.

6. **"O primeiro que falhou" no marco pela ordem dos rascunhos, não pela do cartão.**
   - `publishedLineOf` (`features/chat/discussion-markers.ts:393`, `:401`) toma `failed[0]` na ordem de `discussion.drafts`.
   - A barra e **Show** (`discussion-request.ts:116`) usam `cardEntries`, onde os épicos vêm antes dos soltos.
   - Com um solto e um card de épico falhando juntos, a barra diz `Stopped at <card>`, e o marco diz `<solto> and 1 more failed`. `09:154` e `09:429` (#34) pedem a ordem do cartão nos dois.
   - **Mudar:** ordenar por `cardEntries` no marco, com um caso de duas falhas.

7. **As áreas de texto têm duas linhas.**
   - **Body** de **Edit** (`DraftEditor.tsx:247–251`, `rows={6}`) e **What to discuss** (`NewDiscussionDialog.tsx:237–241`, `rows={3}`) aparecem com cerca de duas linhas (`22`, `60`).
   - `09:239` pede seis linhas crescendo, e `09:105`, três crescendo até nove.
   - A causa é a da task 7 (item 6): `field-sizing-content` ignora `rows`. **Mudar:** `min-h` em linhas de `--leading-body`.

8. **A linha publicada da lista do marco repete a referência.**
   - `MarkerLine.tsx:150–168` escreve o estado (`Created web#470`) e, ao lado, o link `↗ web#470` (`41-b-round1-open.png`).
   - `09:154` pede `Created billing#479` como o próprio link, como no estado do rascunho (`Draft.tsx:109–121`).

9. **As mutações que sobrevivem** (veja "Mutações"). Um caso cada:
   - **No Go:**
     - a rodada pelo maior: `GroupIntoEpic` sobre uma rodada nova cujo descartado ficou no fim;
     - um começado e não feito segura a rodada aberta;
     - o id reusado com outro conteúdo, com `RevisedReading == 0`;
     - `repository`, `module` e `kind` sozinhos em `Changes`;
     - um aprovado revisado duas vezes mantém `ApprovalCleared`;
     - `First == false` e `Round == 0` num artefato `status: none`;
     - `Outcome` e `Reference` na linha `Before` do publicado;
     - o aviso do ciclo pelo título (`publish.go:546`);
     - a rodada nos marcos `drafts_unreadable` e `drafts_published` (rodada 2);
     - nenhum `drafts_revised` quando o agente reescreve o que o usuário editou;
     - o arquivado com `RevisedReading` 0 lido com `revised == false`.
   - **No jsdom:**
     - `Alt+↓` com o diálogo de arquivar aberto não muda o atual (`aria-expanded`);
     - `Ctrl+A` e `Ctrl+D` num rascunho não chamam `decideDraft`;
     - `Shift+Alt+↓` não anda.

10. **A documentação.** Está no presente e bate com o código nos textos citados (das cerca de 240 strings entre crases acrescentadas a `features.md`, todas as da discussão existem no código ou são o modelo que o código monta), menos:
    - **`features.md:287`:** `7 published in 3 rounds` vale "depois de mais de uma rodada", mas o código conta só as rodadas que publicaram (`discussion-request.ts:183–186`). Escrever "publicados em mais de uma rodada".
    - **`docs/architecture/storage.md:46`:** a última frase do parágrafo novo está truncada ("uma leitura que só traz para rascunhos que o usuário vê iguais o que o artefato diz agora não avança a revisão").
    - **Duas formas de história:**
      - `features.md:166`, "de uma discussão anterior a elas": melhor "uma rodada cujos rascunhos não têm marco";
      - `docs/architecture/overview.md:62`, "é apagada de novo".
    - **`features.md:225`:** "só **Approve** fica…" lê como "só sobra **Approve**". Escrever "só **Approve** fica tracejado".
    - **`features.md:176` e `overview.md:172`:** dizem que o cartão vem "logo depois do marco mais recente da rodada". O código o ancora depois do último `Drafts written` ou `Drafts revised` (`discussion-markers.ts`, `cardAfter`), como `09:167`.
    - **Omissões:**
      - o **Retry** e **Delete discussion…** desabilitados na corrida (`features.md:252`, `:284`);
      - o tooltip `Linked on GitHub`;
      - os estados dobrados `Revised · approval cleared`, `Can't publish · choose a repository` e `Couldn't write to GitHub · open it to Retry` (`:182`);
      - `the epic has no cards.` (`:219`);
      - o `· 2 of 3 decided` de `Details` (`:285`);
      - o **Open <board>** que sai sem o board.

11. **A régua.**
    - **`09:564`:** o `epicOf` da cadeia está em `internal/discussionflow/chain.go:128`, não em `internal/discussion/chain.go`.
    - **`09:75`:** diz que `ContextGauge` continua para a task e o History, mas na `main` ele só era usado pelo cabeçalho da discussão. A PR o apagou (`features/task/ContextGauge.tsx`), o que é certo, e a frase do material fica errada.
    - **`09:454` contra `09:253`:** `09:454` diz que "as frases de hoje ficam com os sentinels de hoje", mas `09:253` pede `A publication is running.`. A PR trocou a frase de `ErrPublishing` (`Wait for the publication to finish.`) por `A publication is running.` (`internal/bindings/task_service.go:955`), e isso vale em todo lugar que mostra essa recusa.

12. **Os valores soltos onde há token.**
    - Os arquivos da feature usam passos numéricos do Tailwind onde há `--space-*`: `GroupEpicDialog.tsx:119` (`gap-1`) e `NewDiscussionDialog.tsx:212`, `:246`, `:255` e `:279` (`gap-2`, `gap-1`, `pr-1 pl-3`).
    - O `DependencyPicker` (`components/system/DependencyPicker.tsx`) segue o padrão do `Listbox` do system (`px-2`, `gap-0.5`, `p-1`), que já era assim.
    - Os valores batem com a escala, e nenhuma cor nem duração está solta.

13. **Miúdos.**
    - Num rascunho que falhou e foi aprovado, `· click again to undo` fica entre a razão em vermelho e **Retry** (`Draft.tsx:192`; `43-c-open.png`).
    - O chip de espera da barra e o da árvore discordam por um minuto (`5m` contra `6m`). Os dois `useNow` contam o minuto desde montagens diferentes.
    - A cena `?talk` nunca testa **Send** com texto como a primária de `09:368–371`.
    - O registro do `design-critic` do step 8 sozinho (`09:554`, `:593`) não existe. Esta leitura cobre a branch inteira.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | As cenas, as flags, as larguras e o relógio batem com `09:19`. As provas do pixel inteiro, das bordas e da primária morrem em todas as mutações. Falham: as capturas na PR, a chegada que esconde o atual (bloqueio 1), e o texto cortado (bloqueio 4) |
| 2 | Ok, com ressalva | `DiscussionView.keys.test.tsx`: 25 mutações morrem. Sobrevivem `Alt+↓` com um diálogo, `Ctrl+A` e `Shift+Alt+↓` (item 9) |
| 3 | Ok | Os cinco testes de tabela: 100 mutações, todas morrem. A pastilha fora da tabela (item 2) fica num caso que eles não têm |
| 4 | Ok, com ressalva | 124 de 153 mutações morrem. Os sete equivalentes estão explicados. Os casos que faltam estão no item 9. A `0024` foi provada também sobre um banco real da versão 23 |
| 5 | Ok, com ressalva | `DiscussionView.publish.test.tsx`: todas as mutações morrem. O aprovado da corrida mostra a razão (item 5) |
| 6 | Ok | `DiscussionView.rounds.test.tsx`, `gone-rounds.test.ts`: todas morrem. No app, a rodada 1 dobrou em `Round 1 · 2 drafts · 1 created`, com a pílula em `Round 2` |
| 7 | Ok | Os focos de cada situação, o anúncio com a rodada e a piscada: todas morrem |
| 8 | Ok | `where-actions-went.test.tsx` pega cada controle removido ou renomeado e cada mudança de primária |
| 9 | **Falha** | Não feito nem registrado (bloqueio 2) |
| 10 | Ok na ponta | `task check` verde em `4fe861e`; não conferido step a step |
| 11 | Ok, com ressalvas | `features.md` §Discussão reescrito, e `storage.md`, `sessions.md`, `overview.md`, `design-system.md`, `testing.md` e `troubleshooting.md` tocados. As ressalvas estão no item 10, e `features.md:277` segue o código e não `09:561` (bloqueio 3) |
| 12 | Esta crítica | O registro do step 8 sozinho não existe (item 13) |
| 13 | Ok | `gh pr checks 82` verde; `MERGEABLE` e `CLEAN` |

## O que saiu

- **De `features/discussion`:** `DraftsPanel`, `EpicGroup`, `DraftCard`, `DependencyList`, `DraftDiff`, `DiscussionBar` e `DiscussionContextPreview`, com os testes.
- **Fora dela:**
  - `features/chat/ConversationComposer.tsx`, que só a discussão usava;
  - `features/task/ContextGauge.tsx`, que só o cabeçalho da discussão usava (item 11);
  - `lib/body-diff.ts`, que vive como `bodyDiff` em `drafts-card.ts:555`.
- **`DiscussionHeader`** foi reescrito com o mesmo nome, e o teste pintado dele também. `09:591` dizia que ele saía, mas o conteúdo é o cabeçalho novo, e o nome não importa.
- **`discussion-status.ts`** fica com o que o History e as funções novas usam: `epicGroups`, `looseDrafts`, `kindLabel`, `outcomeLabel`, `holdLabel`, `standingDetail` e os rótulos. `epicWayOut` e `epicDiscardedDetail` são usados só dentro dele.

Nada importa o que saiu, e o `typecheck`, o lint e os bindings passam. `docs/` não menciona nenhuma das peças que saíram.

**Comportamento fora de `changes.md`.** Todos são menores e consequência do material:
- arquivar e apagar deixam o `×` tracejado e `Esc` inerte enquanto a chamada corre (`closeDisabled`, `components/system/Dialog.tsx:64`), além de **Cancel**;
- `N published in M rounds` conta só as rodadas que publicaram;
- o `⋯` diz `· it can't be archived now` quando `ArchiveHint` vem vazio (`discussion-header.ts:123`);
- o `Menu` do system ganha o item de ação habilitado que fecha (`closes`), e o `Composer` deixa o `who` do contexto vencer a voz da etapa;
- a recusa do repositório fora do board vem antes da do título vazio (`discussion_service.go:240–249`);
- a frase de `ErrPublishing` muda em todo lugar (item 11).

## Tokens e contraste

**`tokens.css` não muda**, e nenhuma cor nem duração está solta no diff. Os passos numéricos de espaço estão no item 12.

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css` (claro / escuro):
- o título do rascunho, `--ink-1` sobre `--surface-2`: 18,12 / 13,23;
- os campos, a linha 2, o número e o estado, `--ink-3` sobre `--surface-2`: 7,29 / 7,09; em hover, sobre `--veil-hover`: 6,53 / 5,91;
- os avisos e o título descartado, `--ink-2` sobre `--surface-2`: 10,88 / 9,65;
- os links de `Depends on`, `--brand-ink` sobre `--surface-2`: 6,43 / 8,15;
- a razão da falha, `--state-error` sobre `--surface-2`: 6,11 / 5,94;
- a linha do gesto, `--ink-2` sobre `--surface-0`: 9,74 / 11,60;
- o diff: a retirada (`--ink-3` sobre `--surface-0`) 6,53 / 8,52; a acrescentada (`--ink-1` sobre `--veil-hover`) 14,56 / 13,78;
- os marcos, `--ink-3` sobre `--surface-1`: 7,19 / 8,05; `Publication stopped`, `--state-error`: 6,02 / 6,74;
- a barra:
  - tingida, o rótulo em `--ink-1`: 16,37 / 12,68; o meio em `--ink-3`: 6,59 / 6,79;
  - de erro, o rótulo em `--state-error` sobre o véu: 5,42 / 5,77; o meio: 6,48 / 6,89;
  - `Ready to archive`, `--state-close` sobre `--surface-0`: 5,08 / 10,00;
- os diálogos, `--ink-3` sobre `--surface-3`: 7,29 / 6,66; a recusa no rodapé, `--state-error` sobre `--surface-0`: 5,47 / 7,14;
- o placeholder do `DependencyPicker`, `--ink-4` sobre `--surface-input`: 6,14 / 6,78;
- a decisão pressionada, `--ink-1` sobre `--brand-tint`: 15,29 / 10,01;
- **dentro do épico descartado (`opacity-60`), falham** (item 1):
  - `--ink-2`: 3,43 / 4,40;
  - `--ink-3`: 2,82 / 3,48;
  - `--state-error`: 3,05 / 3,01.

**Não texto:** o anel do atual (`--brand-ring` sobre `--surface-2`) tem 4,36 / 3,97, e o ícone da linha do gesto (`--ink-3` sobre `--surface-0`), 6,53 / 8,52. O anel `--line-2` do aberto tem 1,53 / 1,39, mas é decorativo: o atual se distingue pelo anel da marca.

**Estado sem cor como único portador:**
- o estado é sempre texto (`Not decided`, `Discarded`, `Approved · …`, `✓ Created …`, `◆` e a razão);
- a pílula com situação não tem palavra, mas o nome acessível e o tooltip a dizem, e a barra a escreve;
- a falha tem o losango, o texto e o trilho;
- o épico descartado diz `Discarded`.

## No app real

**Como rodou:**
- `task build` numa cópia em `4fe861e`;
- `bin/myspec` sob `env -i`, com `HOME` e os `XDG_*` no scratchpad, sem `DISPLAY` nem `WAYLAND_DISPLAY`;
- `dbus-run-session --config-file` com um barramento próprio, sem ativação, e `GTK_A11Y=none`;
- `XDG_RUNTIME_DIR` em `/tmp/c82rt`;
- `GDK_BACKEND=broadway` (`gtk4-broadwayd :22`, porta 8102), dirigido por um Chromium headless do Playwright.

**Sem `gh` nem `claude` no `PATH`, e sem `GH_TOKEN`**, de propósito: nenhuma publicação podia escrever, e nada foi escrito no GitHub. O app, o barramento, o broadwayd e o driver foram encerrados pelo PID, e `/tmp/c82rt` foi apagado. O MySpec do usuário não foi tocado.

**Os dados:** o banco nasceu na versão 24. Gravei com `sqlite3`:
- dois boards, com leitura, campo **Area** e quatro cards;
- quatro repositórios, três com clone de verdade e `acme/api` sem;
- seis discussões, com sessão, marcos no transcript e `discussion.md`:
  - **a)** rodada 1 sem decisão: um épico com dois cards, um solto que depende de outro rascunho, uma atualização de `billing#461` e um solto;
  - **b)** rodada 1 publicada e descartada, e rodada 2 por decidir;
  - **c)** um aprovado com `publish_error` e um dependente;
  - **d)** tudo descartado;
  - **e)** o épico descartado com dois cards aprovados;
  - **f)** uma arquivada com duas rodadas.

Nenhuma ia na corrida.

**O que o app mostrou** (capturas em `scratchpad/app/shots/`, fora do repositório):
- **A árvore:** `Decide drafts · 0/6`, `Publish failed` com `Ctrl J`, `Ready to archive` com o anel e `Epic discarded`. A forma longa (`Decide drafts · Round 1 · 1 of 7`, `· Round 2 · 0 of 2`, `Publish failed · Round 1`) aparece nos tooltips da lateral recolhida (`01`, `54`–`58`).
- **A chegada em a):**
  - a pílula `Round 1` com o disco âmbar;
  - o épico aberto com `Approve publishes nothing yet: the epic waits for 2 more cards of the epic to be decided.`;
  - os dobrados com `Revised`, `Now:` e `Depends on`;
  - a barra `Decide drafts · round 1 · 0 of 6 decided` com **Next to decide** `Alt ↓`;
  - o compositor com `Ask for changes` (`03`).
- **O teclado:**
  - `D` num solto descartou e levou ao próximo por decidir, com volta ao começo, e o segundo `D` dentro de 900 ms ficou inerte, o que o banco confirma (`19`);
  - `E` abriu **Edit**, com `Finish editing to decide` (`21`, `22`);
  - o `DependencyPicker` mostrou os dois grupos e `Depend on acme/api#99` (`23`–`25`);
  - `Esc` fechou o `listbox`, depois a edição, e levou o foco ao compositor (`26`–`28`);
  - `Alt+↓` do compositor abriu a atualização, com `Update billing#461↗`, `Now: … · Module now: Billing · Epic now: none`, o aviso da releitura que falhou e **Body**/**Changes** (`38`, `39`).
- **O `⋯`:** o tooltip, os itens, e `Group drafts into an epic… · needs two loose drafts not published` depois do agrupamento (`09`, `10`, `32`). Em c), `Archive… · a publication failed: Retry it, or discard the draft`.
- **Os painéis:** `Details`, com `Board`, `Cards`, `Read`, `Not cloned` com **Clone**, `Model`, `Started`, `Rounds` e `Documents`; e `Documents`, que abre no documento (`29`–`31`, `87`).
- **Os diálogos:**
  - arquivar com `Published: nothing · Not published: …`, e apagar (`33`, `34`);
  - agrupar, com o rodapé que muda de forma (bloqueio 5; `11`–`16`);
  - nova discussão, de dentro do board (a linha afundada do board, `From the board and your text · 382 characters` com **Show**, a faixa de `acme/api` com **Clone**, `From Defaults`, `114 of 120`, `Use at most 120 characters.` e as razões na ordem) e da Home (o campo **Board** com `last used`, e Tab de **Board** a **Title**) (`60`–`73`).
- **b):** a pílula `Round 2` e o marco `Round 1 · 2 drafts · 1 created`, que abre a lista (`40`–`42`).
- **c):**
  - o rascunho com o trilho, a razão e **Retry**;
  - o marco `Publication stopped · round 1 · Search index failed`;
  - a barra `Publish failed · round 1 · Stopped at Search index` com **Show**.
  - **Retry** não foi clicado (`43`–`46`).
- **d):** `Ready to archive · round 1 · nothing published · or ask the agent for more cards below` com **Archive…**, e o placeholder `Ask for more cards, or reply to the agent…`. Arquivei de verdade com `Ctrl+Enter`, e a página que saiu disse `Old reports cleanup was archived`, `The conversation ended at 21:30. …` e `Round 1 · nothing published`, com as três ações (`47`–`49`).
- **e):** os cards aprovados em tinta cheia, com `⧗ The epic is discarded · this card won't publish` em `--ink-1` 500, e o épico com `Discarded · click again to undo`, todo a 60% (item 1; `50`, `82`).
- **O tema escuro:** desta vez o botão do rodapé trocou o tema no Broadway. Fotografei History, a), b), c), e), os menus, o diálogo de agrupar e `Details` no escuro (`78`–`87`), sem divergência própria do escuro.
- **O log:**
  - um `ERROR`, da releitura do card de uma atualização sem `gh`, que a tela mostra como `◇ Couldn't refresh the card: …`;
  - `WARN` só do ambiente: os pull requests sem `gh`, o catálogo de modelos sem `claude` e o portal do tema.

**O que o app não mostrou:**
- **A sessão de verdade:** o agente trabalhando, `Discussing · working`, a revisão pedida ao agente, a rodada nova, o erro de sessão com **Retry**, a pergunta e a permissão, a piscada de uma barra nascida com a tela aberta e a falha do **Start**. Pedem as credenciais do `claude`, e são o bloqueio 2.
- **Uma publicação:** `Publishing…`, `Round 1 · publishing`, as linhas de cadeia (`Approve publishes the epic, … and this card`, `Discard publishes …`) e o **Retry**. Pedem o `gh` com escrita, e a publicação foi provada pela task 8. Cobrem as cenas `publish`, `publish?after` e `partial-fail` e `DiscussionView.publish.test.tsx`.
- **Pause** e **Resume**, que não foram exercitados.
- **O breadcrumb inteiro:** a janela tinha 1.600 px, abaixo do limite de 1.660.
- **`drafts_unreadable`** e o brilho da releitura, que não foram semeados.

## Segunda leitura (cae63be)

Só as correções (`4fe861e..cae63be`, 19 commits e o merge da `main` com o #81), na worktree de revisão. As mutações rodaram numa cópia no scratchpad, e o pintado na porta 63527.

**Veredito: Corrigir antes do merge.** Os quatro bloqueios estão fechados no código, e todas as mutações pedidas morrem. Sobram duas coisas, pequenas, e uma delas é nova:

1. **O `listbox` das dependências abre sem o foco na busca.** É uma regressão do item 4. `PlacedPicker` (`features/discussion/DraftEditor.tsx:76`) desenha o recipiente `invisible` até medir. O `useEffect` do `DependencyPicker` (`components/system/DependencyPicker.tsx:84–86`) chama `focus()` antes de a classe sair, e o foco fica em **Add a dependency**.
   - **A prova:** na cena `drafts?edit` pintada, `document.activeElement` é o `BUTTON` `Add a dependency`, e não o `combobox`, a 2180, 978 e 812 e nos dois temas. Sem a linha 76, os seis casos passam.
   - O jsdom (`DraftEditor.test.tsx:260`) não vê isso, porque não tem CSS.
   - **O efeito:** quem digita depois de abrir não filtra nada, e ↑↓ e `Enter` não andam na lista. Isso contraria `09:240` (a busca "com o foco").
   - **Mudar:** medir sem `visibility: hidden`, por exemplo com `opacity-0` ou fora da tela, ou focar a busca depois de posicionar. Acrescentar à cena `?edit` o caso do foco na busca.
2. **As capturas de `many` (2180, 978 e 812) e de `drafts?edit` a 812 mostram o atual fora de vista.** O código está certo. O problema é a ordem do teste.
   - Em `DiscussionView.scenes.painted.test.tsx`, `withoutTooltip(cut)` (`:382`) passa o ponteiro pelos textos cortados abaixo, e o Playwright rola até eles. A captura (`:393`) vem depois.
   - Uma captura que tirei antes do `hover` mostra o cabeçalho do 3 no alto, em `many` 812 e em `drafts?edit` 812. A do `origin` mostra só a borda de baixo dele, e a de `drafts?edit` mostra a edição rolada até **Add a dependency**.
   - São exatamente as capturas que `09:19` põe diante do usuário (bloqueio 1).
   - **Mudar:** capturar antes de `withoutTooltip`, ou devolver o `scrollTop` depois dele. Depois, `task captures` e `task captures:push`.

Depois disso, o veredito é **Mergear depois do roteiro do usuário** (bloqueio 2).

| Bloqueio / item | Situação | Evidência |
|---|---|---|
| B1 Rolar pelo topo | Fechado | `lib/reveal.ts:7–18`, usado em `DecisionCard.tsx:74`, `DraftsCard.tsx:65`, `focus.ts:93`, `:163` e `DraftEditor.tsx:151`. `scroll-mt-(--fade)` em `Draft.tsx:211`. A prova do cabeçalho em `scenes.painted.test.tsx:339–367`. As mutações "sempre ao centro" morrem no pintado (32 falhas) e no jsdom (`reveal.test.ts`, 2 falhas) |
| B1 Capturas e tabelas | Feito, com o resto acima | `captures/56-…` em `d9ddb29`, e as 118 URLs do corpo existem no branch (`gh api …/git/trees`). Estão as tabelas a 2180, 978 e 812, com a coluna do mock. A página que saiu não tem tooltip (`:390–392`; `discussion-done-archived-978`). Ressalva miúda: o corpo diz que 978 é "a 1250 px window", mas a área de 1250 é 950 (`structure.md:390`) |
| B2 Prova real | Preparada | A checklist `## Verification on the target machine` do corpo cobre `09:388` passo a passo, mais o `Session error`. Espera o usuário |
| B3 Árvore com a corrida | Fechado | `sidebar-tree.ts:745–760` e `TreeRow.tsx:236–257`. Sem a corrida, `sidebar-tree.test.ts` e `TreeRow.test.tsx` dão 3 falhas |
| B4 Tooltips de corte | Fechado | `CutText` (`components/system/CutText.tsx`) em `Select.tsx:116`, `MarkerLine.tsx:176` e `:325`, e no rodapé (`Dialog.tsx:215`). `drafts?edit` a 812 corta o **Epic** e um título dobrado. Morrem: o `Select` sem tooltip (2), o título do dobrado sem tooltip (2), o complemento (2) e o estado da lista (2, em `MarkerLine.painted.test.tsx`; nas cenas, ele sobrevive, porque nenhum estado é cortado) |
| B5 Rodapé | Fechado | `Dialog.tsx:198–224` e `components.md:793`. `flex-wrap` morre (6, no `Dialog` e em `NewDiscussionDialog`). A tecla tracejada sem padding (`Button.tsx:132`) morre (10). Na captura `many?group` 978, o rodapé fica numa linha. Num `start` pintado com os campos limpos, **Start discussion** fica tracejado com a mesma largura e **Cancel** no lugar |
| 1 Épico sem opacidade | Feito | `Draft.tsx:217–221`. Com `opacity-60` de volta, 2 falhas. Na captura `epic-off`, o título em `--ink-2` e o corpo em tinta cheia |
| 2 Pastilha | Feito | `discussion-request.ts:345–369`; a mutação dá 8 falhas |
| 3 Títulos do corpo | Feito | `globals.css:513` e `CardDraft.tsx:158`; a mutação dá 2 falhas |
| 4 Sob a barra | Parcial | A edição rola (`DraftEditor.tsx:145–153`). O `listbox` sobe ou desce (`:52–83`; "sempre embaixo" dá 6 falhas) e, por z-index, fica acima da pílula (`--z-float` contra uma pílula sem z): está acima, não sob ela. `endRoom` (`ConversationColumn.tsx:51`; tirado, 102 falhas). Fica aberto: a pílula ainda cobre a linha do gesto e a decisão do atual no meio da conversa (`discussion-drafts-2180`, `-978`, `epic-off`) |
| 5 Aprovado da corrida | Feito | `Draft.tsx:174–176`; a mutação dá 1 falha |
| 6 Ordem do marco | Feito | `discussion-markers.ts:394–396`; a mutação dá 1 falha |
| 7 Áreas de texto | Feito | `DraftEditor.tsx:307` e `NewDiscussionDialog.tsx:242`, com as alturas provadas no pintado. As três linhas aparecem no `start` limpo |
| 8 Link na lista | Feito | `MarkerLine.tsx:139–161`. Na lista aberta de `done`, `Created billing#478↗` aparece como link (captura minha) |
| 9 Mutações | Feito | No Go, 18 de 20 morrem, com um teste novo cada. Os dois que sobram são equivalentes: o lado `after.Round != round` de `reconcile.go:79` (o outro lado morre) e `roundSettled` sem `Round == R`, porque uma rodada fechada já está resolvida. No jsdom morrem `Alt+↓` com diálogo, `Ctrl`/`Meta`+`A`/`D` e `Shift+Alt+↓` |
| 10 Docs | Feito | `storage.md:46` está inteiro, e "de novo", `anterior a elas`, "logo depois do marco mais recente" e `in 3 rounds` estão corrigidos. As omissões entraram (`features.md:182`, `:242`, `:284`, `:285`). Tudo no presente |
| 11–13 | Feito | `09:75`, `:564` e `:562` estão reescritos. **Send** com texto é provado nas cenas (`:396–407`). `· click again to undo` vem depois do **Retry** (`Draft.tsx:383`; a mutação dá 2 falhas). `gap-(--space-*)` nos diálogos |

**Também conferido:**
- `-race -count=3` em `discussion`, `discussionflow` e `attention`: verde.
- `task check` na ponta: verde em 86 s, com 3.156 testes Go e 7.513 web, e `git status` limpo.
- `gh pr checks 82`: **Changes**, **Go** e **Frontend** verdes, e **Build** pulado. A PR está `MERGEABLE`/`CLEAN` em `cae63be`. O **Frontend** roda `pnpm test`, com o pintado de todas as telas.
- Nas capturas das tasks 5 a 8, que o branch traz: o rodapé de `create` e de `review-publish` numa linha, a razão à esquerda e o primário tracejado no lugar; o `Select` e o cartão de apontamentos sem mudança visível.
- O merge em `components.md`: a linha Tecla junta a decisão da `main` (tecla em caixa, para a task 12, `12-consistency.md:278`) com o padding do tracejado, sem contradição.

**O que ficou aberto, e pode esperar:**
- A pílula `↓` sobre a parte de baixo do atual (item 4).
- **Edit** `E` ao lado de **Done**, e `Body` sem o complemento `Markdown` (`09:239`), na edição.
- O título da linha da lista do marco (`MarkerLine.tsx:173`) e o `Cut` do dobrado (`FoldedDraft.tsx:57–62`) mostram tooltip mesmo inteiros. O `CutText` só mostra quando corta. **Opinião:** um comportamento só.

**Novo, pode esperar:**
- A razão cortada do rodapé só se lê inteira pelo ponteiro.
  - No `Group drafts into an epic`, ela já chega cortada (`Name the epic to group the …`, `many?group` 978).
  - O primário tracejado aponta para ela por `aria-describedby`, o que basta ao leitor de tela. Quem usa só o teclado, porém, não vê o resto: o `CutText` não abre pelo foco.
  - **Mudar:** o primário tracejado, em foco, mostra a razão no tooltip quando ela está cortada.
- Com o atual pelo topo, num rascunho alto a decisão fica abaixo da dobra na chegada. Em `epic-off`, o **Approve** que a situação pede está sob a pílula, a 978 e a 2180. É a troca que a decisão aceitou: o teclado (`A`) continua valendo.
