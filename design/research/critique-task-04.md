# Crítica da task 4 · Tela da task II (PR #71)

Revisão da branch `51-redesign-4-task-screen-ii-the-conversation-the-ask-bar-and` em `3fb42e1` (18 commits, 265 arquivos), antes do merge, numa worktree de revisão. A régua: `design/tasks/04-task-conversation.md` (o material, com os 17 itens de pronto), `screens/task.md` §6–§9 e §11–§13, `structure.md`, `principles.md` 2, `system/components.md`, `system/tokens.css`, `changes.md`, `backend.md`, `decisions.md` (2026-09-28) e os mocks `lab/16-conversation-wide/a.html`, `components.html` e `lab/10-screen-task-minimal/b.html`. Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa; `04:N` é a linha N do material.

## Veredito

**Corrigir antes do merge.**

A task está quase inteira e bem feita:
- O backend passa limpo, com as mutações pegas.
- As dezessete situações da barra batem com a tabela do material.
- O compositor, T25 e T26 estão certos.
- Os três pontos da crítica da task 3 foram resolvidos.
- Todo par de cor novo passa AA nos dois temas.

Falta o que o material exige como prova, e há quatro defeitos de tela:
- **Prova:** as capturas não existem, a prova das bordas não mede o que promete, as cenas da task gravam telas incoerentes, e a segunda metade do pronto 9 e a checagem do pronto 6 estão sem registro.
- **Defeitos:**
  - duas regiões ao vivo que falam a cada segundo;
  - as setas presas no cartão do rascunho;
  - as pastilhas fora do system;
  - dois desvios visíveis em toda tela: o rodapé do código fora do bloco e `Write a message` escrito ao lado de **Send**.

## Como foi conferido

- **Suítes**, pelos comandos do `Taskfile.yml`, na worktree de revisão:

  | Suíte | Resultado |
  |---|---|
  | `gotestsum ./...` (`task test:go` sem a cobertura) | 2.660 testes, 1 pulado; o pacote raiz precisa de `frontend/dist`, que `embed:stub` cria |
  | `pnpm typecheck` | verde |
  | `task lint:web` | verde |
  | `vitest --project unit` | 3.800 testes |
  | `pnpm test:painted` | 651 testes |
  | Bindings | `wails3 generate bindings` numa cópia não muda nada em `frontend/bindings` |

- **Mutação**, sempre em cópias no scratchpad:
  - 7 no Go; só a do limite de 64 KiB sobrevive.
  - 15 nas provas pintadas; 6 sobrevivem, com a tabela no bloqueio 2.
  - 13 na barra, na primária e no foco; 3 sobrevivem.
  - 12 no compositor, nos cartões e no teclado; 3 sobrevivem.
- **Capturas.** Montei as sete cenas da conversa (mais `ask` e `error` na voz do implementador) e as nove da task, com as fixtures da PR:
  - a 1250 e 2560 px de janela, claro e escuro, em repouso e com tudo aberto;
  - comparadas lado a lado com `a.html` e `b.html` servidos na porta 8117 (encerrada pelo PID).
- **Contraste.** Medi os pares novos convertendo o oklch de `tokens.css` para sRGB. Tabela na seção de acessibilidade.
- **Corpo da PR** (`gh pr view 71`). Não há comentários e não há branch de capturas.

## Bloqueia o merge

1. **As capturas não existem** (pronto 1, `04:19`; pronto 3, `04:21`).
   - Não há `captures/51-…` (`git ls-remote` só acha a `captures/50-…` da task 3), o corpo da PR não tem imagem e a PR não tem comentário.
   - É o mesmo bloqueio nº 1 da primeira leitura da task 3.
   - O que fazer:
     - rodar `task captures` e `task captures:push` (`Taskfile.yml:97–137`);
     - pôr no corpo a tabela das cenas, cada captura ao lado do mock (`a.html?scene=…&open=all`, `b.html?scene=…`).

2. **A prova das bordas não mede o que o pronto 1 promete** (`features/task/TaskView.conversation.painted.test.tsx:96–117, 173–178`).
   - Ela mede cada `article`, a barra, o compositor e o `tablist` contra `[data-slot="conversation"]`, e só isso.
   - **Os blocos dentro de uma entrada não são medidos.** O Markdown da fala com `max-w-[40rem]` (`features/chat/Markdown.tsx:65`) e o bloco aberto do grupo recuado (`features/chat/entries/Group.tsx:135`) passam. O primeiro é exatamente o "texto mais estreito que os blocos" que o usuário rejeitou (`decisions.md`, 2026-09-25).
   - **A largura e o centro da coluna não são medidos.** Com `--measure-conversation: 58.5rem` em `design/system/tokens.css:55`, as 651 provas pintadas passam.
   - **O pixel inteiro não é provado.** 812, 950, 1566 e 2180 são pares, e `round(down,…,1px)` nunca age: sem ele (`features/chat/ConversationColumn.tsx:11`), a suíte passa. A 1567 e 2181 px, a mesma mutação falha em 36 de 42, e o código atual passa. O código está certo; a prova é que não o cobre.
   - **O compositor é achado pela classe** `max-w-(--measure-conversation)` (linhas 106–111). Com `max-w-[58.5rem]` em `features/chat/Composer.tsx:244`, ele some da medição sem erro.
   - **Os cartões fixos e o lugar vazio nunca são medidos.** As sete cenas não têm `ChangedFilesCard`, `DraftCard`, `LiveChecks` nem `PlaceEmpty`. Um `mr-(--space-8)` em `features/task/ChangedFilesCard.tsx:200` ou em `components/system/PlaceEmpty.tsx:20` passa.
   - O que mudar:
     - medir cada filho de bloco das entradas: o bloco do grupo, o código, a tabela, o mermaid, o corpo do marco, a saída;
     - conferir `largura = min(960, área − 48)` e o centro em pixel inteiro, com uma largura ímpar;
     - achar o compositor por `data-slot`;
     - medir o cartão de arquivos, o rascunho, os checks ao vivo e o `PlaceEmpty` numa cena própria ou nas da task.

3. **As cenas da task gravam telas que contradizem a própria cena** (pronto 3, `test/task-scenes.ts`). A lição "dados coerentes com a cena" da crítica da task 3 não chegou a este arquivo.
   - **`manual`** (`:382`): `review.files` é `[]` com `staged: 5, total: 7`. A captura mostra `Changed files · 0` e o corpo vazio sob `5 of 7 files staged · 71%`. A §11 pede `Changed files · 7`.
   - **`close`** (`:439–448`): `status: "merged"`, mas `prState` fica `""` (`test/wails-mock.ts:723`) e falta `mergedBy`. `mergedLineOf` (`features/chat/markers.ts:466–482`) devolve `null`, e a linha `Merged #1284 into dev · by lnakamura` que a §11 pede não aparece.
   - **`error`** (`:485`): `makeEntry("error")` é um `turn_error` (`The agent couldn't finish the turn.`), com a barra **Retry reviewer** e `Sending restarts…`. Pela §4.2 essa combinação não existe; o mock mostra `Claude Code stopped unexpectedly.`
   - **`plan`** (`:461`): as opções vêm num parágrafo só (`a) plans table b) config`), então nenhuma pastilha nasce; a §11 pede `a`, `b`.
   - **`run`**: sem `turnStartedAt`, o compositor diz `Working` sem `· 3m 40s`.
   - **Todas as cenas**: o chip diz `4m`, contra `2m`, `18m`, `5m`, `6m`, `12m`, `2h` da §11. O `WAITS` só existe em `test/conversation-scenes.ts`.

4. **Duas regiões ao vivo falam a cada segundo** (WCAG 4.1.3).
   - **`PlaceEmpty` com os checks.** `components/system/PlaceEmpty.tsx:19` põe `role="status"` no bloco inteiro, e `features/task/PRPane.tsx:58` põe `LiveChecks` dentro dele. `LiveChecks.tsx:22` redesenha a cada segundo: a duração de cada check rodando e `checked …`. Na PR em `waiting_checks` antes da passada 1, que dura minutos, o leitor de tela lê as durações sem parar.
     - `components.md` (Estado vazio de um lugar, Acessibilidade) não pede o papel: pede o título em parágrafo e "o bloco mantém o papel dele".
     - Tirar o `role="status"` do invólucro e ajustar `PlaceEmpty.test.tsx:7–23`, que o fixa.
   - **A atividade do retry.** `features/chat/entries/Activity.tsx:89` é `role="status"`, e o texto `next try in 8s` muda a cada segundo (`:72`). O material pede a região e a contagem, então a contagem sai do anúncio: `aria-hidden` no trecho que conta, com a região dizendo o resto.

5. **As setas ficam presas no cartão do rascunho da PR** (pronto 10; `04:252`, "cada cartão fixo é uma entrada do percurso das setas").
   - `features/task/DraftCard.tsx:48–49` marca o próprio `article` com `data-feed-keys="own"`, e `features/chat/useFeed.ts:238` devolve toda seta nesse item sem tratá-la. Com o foco no cartão, `↑↓←→` não fazem nada.
   - O cartão fica no fim da conversa, é a última entrada e por isso é onde o Tab chega em `draft_ready`.
   - Os campos não precisam da marca: o alvo da tecla dentro deles já não é um item do feed.
   - Tirar o atributo, ou tratar as setas com `stepFeed`, como `ChangedFilesCard.tsx:172–185`. `DraftCard.test.tsx:45–50` só confere o atributo; falta um teste que ande.

6. **As pastilhas de resposta rápida não são as do system** (`features/chat/Composer.tsx:248–257`).
   - Cada pastilha é um **Button** secundário `xs`: `--radius-sm`, `--shadow-button`, `--text-micro`.
   - `components.md` (Compositor, Pastilhas) pede o contorno `--line-2`, `--text-meta` e `--radius-pill`. O mock (`b.html:1173–1175`, `:409`) é a pílula, com a tecla em mono `--ink-3` e o texto em 500 `--ink-2`.
   - Falta o invólucro `role="group"` com o nome (`Quick replies`, `b.html:2485`).
   - A cena `planning`, a única que as mostra, deixa a diferença à vista lado a lado com o mock.

7. **O rodapé do código cortado fica fora do bloco** (`features/chat/Markdown.tsx:142`).
   - O `div` de **Show all 46 lines** e `26 more` é irmão do bloco, então fica sobre o fundo da página.
   - `components.md` (Bloco de código) e o mock o põem dentro do bloco afundado, num rodapé de fio.
   - Aparece na cena `running`, nas duas larguras e nos dois temas. A mesma linha usa `gap-2` cru.

8. **`Write a message` fica escrito ao lado de Send** em todo compositor em repouso.
   - `features/chat/Composer.tsx:231` passa a razão como `disabledReason`, que `components/system/Button.tsx:137–146` desenha ao lado.
   - O material diz "com a caixa vazia, tracejado, com `Write a message` no tooltip" (`04:294`), e nenhum mock o escreve.
   - Nenhum teste cobre o texto.

9. **A segunda metade do pronto 9 não tem prova** (`04:27`).
   - `features/task/where-actions-went.test.tsx:1001–1020` só confere "no máximo uma primária".
   - A mutação que deixa **Send** nunca primário (`features/task/useTaskComposer.ts:47` com `otherPrimary: true`) passa na suíte jsdom inteira.
   - Faltam duas coisas na lista `SITUATIONS` (`:928–1000`): o `session_error` de um turno que falhou, e um `reply` sem rascunho (o que está lá tem **Approve draft** como primária).
   - Afirmar `data-variant="primary"` em **Send** com texto em `reply`, `plan_invalid`, `findings`, `worktree_unreadable`, `step_empty` e no `session_error` de turno.

10. **O pronto 6 não está registrado.** O material pede que "toda ação de Bash com `description`" numa sessão real seja "rotulada por ela", conferido "numa task de verdade e registrado no pull request" (`04:24`). O corpo da PR não diz nada disso.

## Pode esperar

Em ordem de gravidade.

11. **O relatório do review e a discussão ficaram sem o que o material dá a eles.** O material (`04:75`) põe o marco do relatório com **Open in Reports** nesta task.
    - `prReviewLine` (`features/chat/markers.ts:330–339`) só acha o relatório pela task. No review (`ctx.task` nulo), `pr_review_written` diz `Review 1 written`, sem `changes` e sem abrir.
    - `FOOTS.reports` (`features/chat/entries/MarkerLine.tsx:37`) é um ramo que nada alcança.
    - `Discussion started` sai sem `with 2 cards` / `with your description` (`markers.ts:232`; tabela Linhas de início).
12. **`situationLabel` ainda diz `Findings to decide`** (`lib/situations.ts:89`), contra o nome único `Decide findings` (§4.3 #14). Aparece pelo `summaryLabel` (`features/task/status.ts:71`) na linha do card do board.
13. **A opção do cartão de pergunta não tem pressionado nem desabilitado** (`features/chat/entries/QuestionCard.tsx:31`). Enquanto o cartão envia, as opções parecem vivas. O mock (`16-conversation-wide/src/base.css:385–388`) tem o pressionado em `--surface-2-press` e o desabilitado tracejado, em `--ink-4`.
14. **A hora da resposta não está no nome acessível** da pergunta e da permissão respondidas (`QuestionCard.tsx:122`, `PermissionCard.tsx:135`). Ela só vai no tooltip de um `span` sem foco (`QuestionCard.tsx:136–138`, `PermissionCard.tsx:161–163`), que o teclado não alcança. `backend.md` P40 pede o nome.
15. **Provas que faltam, com a mutação que sobreviveu:**
    - `Page Up`/`Page Down` andando dez: `PAGE = 3` em `features/chat/useFeed.ts:19` passa, e o feed de `useFeed.test.tsx:9–41` tem três entradas.
    - `1`–`9` com o foco na entrada de um cartão de várias perguntas (`QuestionCard.tsx:216–219`).
    - O percurso das setas com as entradas reais: só existe sobre o feed sintético. Uma sonda com o `TaskView` real e as cenas `running`, `long`, `review`, `planning` e `ask` anda certo; falta o teste.
    - As pastilhas só com `reply`: tirar o filtro em `features/task/useTaskComposer.ts:78` passa no jsdom.
    - A ligação de `useFocusRescue` na tela (`features/task/TaskView.tsx:141`) e o foco no compositor depois de **Retry reviewer** (pronto 11, `TaskRequest.test.tsx:411–448`).
    - A chegada a uma permissão, com **Allow** ou **Deny…** com `defaultToNo`, num teste da tela (`TaskView.test.tsx:661–800`).
    - O tooltip de **Go to …** (`TaskRequest.tsx:127`).
    - `where-actions-went` só com parte dos estados de hoje: **Retry** do erro só no step e no PRD (`:271–300`), sem o revisor, a PR e o review dela; **Resume** e o modelo pausados só no step (`:806–821`); **Deny** sem `defaultToNo`.
    - `New messages 2` da cena `long` não é pintado; o `BackToEnd` só tem jsdom.
16. **A razão do retry ignora `error_status`.**
    - `internal/claude/protocol.go:63–68` lê só `error`, e `internal/session/events.go:409–425` classifica pelo texto.
    - A gravação real traz `"error_status":529` num campo próprio (`internal/claude/testdata/api-retry.jsonl:3–4`), e os casos de `internal/session/retry_test.go:21–35` são textos inventados.
    - Um 5xx cujo `error` não diga o número cai em `the API refused the request`.
    - Ler o status primeiro (529, 429, 5xx) e ajustar `docs/architecture/sessions.md:76`.
17. **O limite de 64 KiB não está preso por teste.** `internal/session/output_test.go:25, 78` derivam de `OutputLimit`, e 128 KiB passa.
18. **`GetActionOutput` existe só no `TaskService`** (`internal/bindings/task_service.go:265–276`), contra "no serviço de cada item" (`04:378`).
    - Funciona para o review e a discussão, porque um `session.Service` serve todos os itens.
    - Registrar a escolha no material, ou pôr o método nos três serviços.
19. **Não há teste de `Close` esperando `spawnPRWork`** (`internal/flow/pr.go:294–313`). O código está certo, sem corrida; só a preparação tem teste (`internal/flow/step_test.go:292`).
20. **Valores soltos onde existe token** (`docs/guidelines/frontend.md:40`):
    - `features/chat/Composer.tsx:62, 249, 267, 269, 270, 288`: `gap-1.5`, `px-3`, `pt-2`, `py-2`, `gap-2`, `px-2`, `pb-2`;
    - `features/chat/Markdown.tsx:130` (`h-8`, preso à altura interna do Streamdown) e `:142`;
    - `features/task/CleanAndStartDialog.tsx:66` (`px-3 py-2`);
    - `features/chat/entries/PermissionCard.tsx:81` (`max-h-48`);
    - `features/task/DraftCard.tsx:67` (`+1rem`).
21. **Detalhes vistos nas capturas.**
    - O mermaid encolhe a um terço, com texto de uns 6 px, pelo `panZoom` de `features/chat/Markdown.tsx:17`; no escuro, os nós ficam brancos. Já era assim na base, mas a cena decidida o mostra na largura da coluna.
    - O cursor do streaming fica sozinho numa linha nova, em `--ink-1` (`caret: "block"`, `Markdown.tsx:70`). `components.md` pede o cursor parado no fim, em `--ink-3`.
    - O cabeçalho do bloco de código cortado não tem o caminho nem o intervalo de linhas que `components.md` pede "quando existem".
    - `BackToEnd` anula o próprio hover com `hover:bg-surface-3` (`features/chat/entries/BackToEnd.tsx:32`); `components.md` (Volta ao fim) lista o hover.
22. **As fixtures das sete cenas da conversa têm três furos** (`test/conversation-scenes.ts`).
    - Os `sed`/`cat` de `STEP_3_READS` não têm saída, e o mock mostra a cauda de cada um.
    - O grupo vivo começa às 14:19:00, antes do `turnStartedAt` (14:19:20, `:1163`). Ele diz `4m 0s` contra `Working · 3m 40s`.
    - O arquivo do step é `steps/3-count-the-requests-in-a-token-bucket.md` contra `steps/03-token-bucket.md`.
23. **`blockHint` de `clone_missing` manda a Settings** (`features/task/step-status.ts:229`), enquanto a barra oferece **Change path…**. É opinião: alinhar o texto à ação.
24. **A virtualização foi para a task 12 pela regra.** A atualização de streaming mede 30 a 45 ms (`design/implementation.md`, task 12), e o material manda a virtualização para lá quando a medida falha. Duas pistas para a task 12:
    - `buildConversation` sobre todas as entradas a cada evento `text` (`features/chat/Conversation.tsx:235`);
    - `useFeed` refazendo a parada de Tab a cada mutação da conversa (`features/chat/useFeed.ts:254–264`).

## Notas

- **Os três pontos da crítica da task 3 estão resolvidos.**
  - **Send e Resume:** não há mais **Resume** em `features/chat`. `components/PauseButton.tsx:46` é fantasma, no cabeçalho, e a pausada está no teste da primária.
  - **Os nomes do stepper:** `lib/situations.ts:238–256` (`PLACE_IN_LABEL`, `decide findings in PR review`), com testes em `situations.test.ts:292–295`.
  - **O anúncio:** diz o rótulo de nascimento (`request.ts:245–251`, `TaskRequest.tsx:82–93`), com testes em `request.test.ts:149–166` e `TaskRequest.test.tsx:214–250`.
- **O material se contradiz sobre a hora no nome** dos cartões pendentes e da mensagem na fila. O pronto 2 quer a hora em todo `article` (`04:20`); a §4.2 dá `Question, answer with 1 to 3` e `You, queued, …` sem ela. O teste segue a §4.2 (`UNTIMED`, `TaskView.conversation.painted.test.tsx:49`). O coordenador decide qual vale.
- **Decisões que o material não cobre**, para o coordenador:
  - Com todas as perguntas já escolhidas, o texto do compositor troca a escolha feita na primeira de escolha única (`features/chat/composer.ts:245–278`, de propósito em `composer.test.ts:358`), e isso descarta em silêncio uma escolha explícita.
  - `Esc` no compositor vazio, com o turno rodando e um painel aberto, interrompe o agente (`Composer.tsx:213–216`) antes de fechar o painel (`screens/task.md` §13).
- **Anotado, de antes desta task:**
  - Uma situação que nasce com a task aberta é anunciada duas vezes: pelo `announce` global (`app/bootstrap.ts:45–48`) e pelo `role="status"` da barra.
  - `RequestBar.tsx:51` e `EarlierConversationFoot.tsx:22` repetem a string de `COLUMN_CLASS` em vez de importá-la.
- **Cai sozinho na task 6:**
  - A faixa de aviso do clone não existe na tela da task, então não há o que esconder sob a barra do bloqueio.
  - O ramo `subject: "step"` de `features/task/ReviewStrip.tsx:81, 115` ficou sem leitor e sai com a task 6.
- **Menções a dados antigos nos docs.** `docs/architecture/sessions.md:46, 49` e `storage.md:24` falam de dados gravados sem os campos novos. Descrevem dados que existem hoje, não uma mudança, e cabem na regra do `CLAUDE.md`. O resto de `features.md`, `sessions.md`, `storage.md`, `overview.md` e `design-system.md` está no presente e bate com o código.

## O que confere

### Os prontos

| # | Situação | Evidência |
|---|---|---|
| 1 | Parcial | O teste existe e pega a fala, a barra e as abas estreitadas. Faltam as capturas (bloqueio 1) e a medição dos blocos, da largura, do pixel e dos cartões (bloqueio 2) |
| 2 | Cumprido | Regex fora de `pre`/`code`, sem hover. A hora aparece com hover na fala, no marco e no grupo. A hora está no nome, com a contradição das notas. Mutações pegas: a hora visível no marco, 74 de 78; o nome sem a hora, 74 de 78 |
| 3 | Parcial | `request.test.ts` cobre as 17 situações e a outra conversa. As nove cenas pintadas passam, mas três são incoerentes (bloqueio 3) |
| 4 | Cumprido | `TaskView.test.tsx:669–800`, `TaskRequest.test.tsx:214, 220, 252`, `globals.css:446–451` (movimento reduzido). Falta a chegada à permissão na tela (item 15) |
| 5 | Cumprido | `useAutoScroll.ts:111` conta as linhas nascidas pela chave; `useAutoScroll.test.ts`, `BackToEnd.test.tsx` |
| 6 | Parcial | `actions.test.ts` rotula em tabela. A checagem numa sessão real não foi registrada (bloqueio 10) |
| 7 | Cumprido | `TestOutputOfEachKindOfResult`, `TestTailOfAnOutput`, `TestOutputOfTheRecordedResults` sobre `internal/claude/testdata`; `CommandOutput.test.tsx`, `CommandRow.test.tsx`. O 64 KiB está solto (item 17) |
| 8 | Cumprido | `conversation.test.ts`, `actions.test.ts`, `markers.test.ts`, `composer.test.ts`, com casos de transcript antigo |
| 9 | Parcial | Uma linha por controle em `where-actions-went.test.tsx:138–830` e no máximo uma primária. Falta **Send** primário (bloqueio 9) e parte dos estados (item 15) |
| 10 | Parcial | `useFeed.test.tsx:84–253`, `useGlobalShortcuts.test.tsx`, `QuestionCard.test.tsx`, `PermissionCard.test.tsx`. O rascunho prende as setas (bloqueio 5), e há provas que faltam (item 15) |
| 11 | Parcial | `TaskRequest.test.tsx:411` chama `retry(taskId, "step_review:N")` e passa a `reply`. O foco no compositor está só no modelo |
| 12 | Cumprido | Testes Go de P5–P11, P12, P38–P41, P46 e M3; `convert_test.go:908, 1075, 1113`; bindings em dia; `lib/wails.ts` e `test/wails-mock.ts` com os campos |
| 13 | Cumprido | `frontend/src/dev/measure-conversation.tsx`, medido no WebKitGTK 2.52.6 da máquina alvo e registrado em `implementation.md` (task 12) |
| 14 | Cumprido, com a ressalva | `CleanAndStartDialog.test.tsx:24–80`, `StepPane.test.tsx:184–266`, `PRPane.test.tsx:82–218, 246, 295, 315`, `ChangedFilesCard.test.tsx`, `DraftCard.test.tsx`, `Composer.test.tsx:186, 203` (T25), `:231, 259, 282, 305` (T26). O foco depois de uma ação só tem o teste do hook |
| 15 | Cumprido | CI verde; as suítes locais verdes |
| 16 | Cumprido | `features.md` §Sessões e conversas, §Etapas de planejamento, §Pré-condição, §Review, §Review pelo agente, §Rascunho e abertura, §Review de pull request, §Encerramento, §Depende de mim, §Atalhos; `sessions.md` "O que o transcript guarda"; `storage.md`; `design-system.md` |
| 17 | Esta revisão | — |

### O mapa das entradas

Cada tipo do transcript tem o componente e os estados da §4.2:
- **Fala**, em `features/chat/entries/Speech.tsx`:
  - a palavra só onde a voz muda (`conversation.ts:271–274`);
  - no streaming, o spinner e a palavra;
  - `Interrupted by you` com `ban`, nada numa queda e `Interrupted` no antigo;
  - a fala do subagente não é desenhada (`conversation.ts:101`).
- **Mensagem e fila**: `YourMessage.tsx` e `QueuedMessage.tsx`, com as três cabeças da fila e **Remove** `Removing…`.
- **Grupo**, em `Group.tsx` e `conversation.ts:168–196`:
  - dobrado, com o resumo por tipo em até cinco, as notas `failed`, `failed, then passed`, `stopped` e `waits for your permission`, e `retried on its own` dobrado no grupo;
  - vivo, com a descrição em curso e a duração a cada segundo;
  - aberto, com oito ou os seis últimos e **Show N earlier actions** (`ActionRows.tsx:10–11`).
- **Comando**, em `CommandRow.tsx` e `actions.ts`:
  - com a descrição, ela vem antes e o comando apagado depois; sem ela, o comando em mono;
  - à direita, `exit 1 · 8.2s`, `failed`, `stopped`, `stopped with the session` ou `waits for your permission`;
  - a falha abre uma vez.
- **Saída**: `CommandOutput.tsx`, com a cauda, `N more lines above`, **Show all**, `Reading the output…`, `Couldn't read the output · Try again`, **Show less** e `Only the last 64 KiB was kept`.
- **Subagente**: `SubagentRow.tsx`, com `Delegated · …`, o resumo próprio, os comandos recuados sob o fio e o relatório.
- **Marcos, linhas de início e mensagens do produto**: `markers.ts` e `MarkerLine.tsx`, com todos os tipos da tabela, os derivados `Merged …` e `Closed …`, o brilho e o erro da leitura, e **Open in Artifacts** e **Open in Details**. A exceção é o item 11.
- **Dobra de trecho**: `conversation.ts:334–499` e `StretchFold.tsx`, com os `appKind` de rodada, 12 entradas e a dobra só na montagem.
- **Código cortado**: `code-cut.ts` (24, 20, e também no streaming).
- **Bloco de erro**: `ErrorBlock.tsx`, com as cinco explicações, sem título, hora nem botão.
- **Atividade e volta ao fim**: `Activity.tsx` e `BackToEnd.tsx`.

### A barra, o compositor e o lugar sem conversa

- **As 17 situações** batem com a tabela da §4.2:
  - forma, rótulo, lugar sem a passada, meio, ações com gerúndio e razão, e o foco na chegada (`features/task/request.ts:777–1046`, `request.test.ts:792–1416`);
  - os sete **Retry <quem>**, e o turno que falhou sem ação;
  - as razões curtas de `step_blocked` e `pr_blocked`;
  - os tooltips que as notas levavam (`request.ts:343, 359, 381, 391`).
- **A regra da primária** é pega por mutação em nove situações.
- **O compositor**:
  - os placeholders na ordem e no texto da tabela (`features/chat/composer.ts:101–134`);
  - o reconhecimento das pastilhas (`:58–64, 195–238`);
  - `ModelChip` com a nota;
  - `Sending…`, `Not sent`, **Send again**, `Working · 3m 40s`, **Stop** `Stopping…`, e `Esc` só com a caixa vazia;
  - T25 (`Composer.tsx:141–152`) e T26 (`:158–198`);
  - sem sessão, sem compositor (`features/task/place.ts:197`).
- **O lugar sem conversa**:
  - os textos da tabela (`features/task/place.ts:57–191`);
  - a ordem entradas, linha derivada, cartão fixo, fila, atividade (`Conversation.tsx:344–365`);
  - o cartão de arquivos nos estados listados (`place.ts:211–240`);
  - o rascunho sem **Open PR**;
  - `ReviewStrip` só em `reviews/ReviewView.tsx:53`.
- **O código morto saiu**: `AppMessage`, `AssistantMessage`, `ErrorCard`, `Marker`, `PendingMessage`, `UserMessage`, `ActionGroup`, `ActivityIndicator`, `ScrollToBottomButton`, `group.ts`, `PlanProblemsNotice`, `StepBlocked`, `PRBlocked`, `ImplementationDone` e `ClosedSummary`. Só `where-actions-went.test.tsx` os nomeia, como história.

### O backend

- Conferido do domínio ao DTO e aprovado. Os pontos principais:
  - migration `0020` como a §4.4;
  - cada chamador de `SendFromApp` com o tipo e os números;
  - `countFindings` só na seção Findings;
  - `pr_opened` uma vez por número;
  - `plan_invalid` só com a lista mudada;
  - `processExited` com `crash` e sem marco;
  - `mergedBy` e `mergedAt` do `gh`;
  - `partial` pelo X e Y.
- As seis formas de `internal/claude/testdata` parecem gravações reais do CLI.
- As ressalvas são os itens 16 a 19.

### Acessibilidade e tokens

Contraste medido nos pares novos, em oklch convertido para sRGB:

| Par | Claro | Escuro |
|---|---|---|
| `--ink-4` sobre `--surface-1` (hora, resumo, comando, duração) | 6,05 | 6,45 |
| `--ink-4` sobre `--surface-0` (comando no grupo aberto) | 5,49 | 6,83 |
| `--ink-4` sobre `--surface-0` com o véu pressionado | 4,58 | 5,33 |
| `--ink-3` sobre `--surface-0` (cabeça da fila) | 6,53 | 8,52 |
| `--ink-2` sobre `--surface-1` (saída) | 10,73 | 10,96 |
| `--state-error` sobre `--surface-1` e `--surface-0` | 6,02 / 5,47 | 6,74 / 7,14 |
| `--state-error` sobre `--state-error-veil` (`Couldn't read PRD.md`) | 5,42 | 5,77 |
| `--ink-4` sobre `--surface-user` (hora da sua mensagem) | 5,30 | 5,52 |
| `--state-wait-ring` sobre `--surface-1` (fio da pergunta em texto, 3:1) | 4,31 | 9,43 |

- Todos passam AA. O mais justo é `--ink-4` e `--state-error` sobre `--surface-0` com o véu pressionado no claro, a 4,56–4,58.
- O `feed` e os `article`s têm nome, a linha que abre é um `button` com `aria-expanded`, e **Show all** do código também tem `aria-expanded`.
- Os ícones novos estão no registro (`components/system/icons.ts`). `product` e `hold` reusam `mark` e `waiting`, como o comentário e `design-system.md` dizem.
- Fora os valores soltos do item 20, as classes usam os tokens.

**Corrigir antes do merge.**
