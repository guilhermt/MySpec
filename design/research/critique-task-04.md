# Crítica da task 4 · Tela da task II (PR #71), segunda leitura

Reconferência da branch `51-redesign-4-task-screen-ii-the-conversation-the-ask-bar-and` em `c55a417`, depois dos commits `e56655d` e `c55a417`, que tratam os dez bloqueios da primeira leitura (`3fb42e1`). A régua é a mesma: `design/tasks/04-task-conversation.md` (o material), `screens/task.md` §6–§9 e §11–§13, `system/components.md`, `system/tokens.css`, `changes.md`, `backend.md` e os mocks `lab/16-conversation-wide/a.html` e `lab/10-screen-task-minimal/b.html`. Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa; `04:N` é a linha N do material.

## Veredito

**Mergear.**

- Os dez bloqueios estão corrigidos.
- Cada mutação que sobrevivia na primeira leitura agora derruba os testes.
- As correções não criaram regressão: nem nos outros usos do `Chip`, nem no anúncio do lugar vazio, nem nas bordas.
- O que resta é da seção "Pode esperar" da primeira leitura: provas que faltam, detalhes visuais e pontos de backend. Nenhum deles tira comportamento nem contradiz uma decisão do usuário.

## Como foi conferido

- **Suítes**, pelos comandos do `Taskfile.yml`, na worktree de revisão em `c55a417`, todas verdes. O CI da PR também está verde; o job Build fica pulado pelo filtro de caminhos, porque a PR não toca `build/**`.

  | Suíte | Resultado |
  |---|---|
  | `gotestsum ./...` | 2.661 testes, 1 pulado |
  | `pnpm typecheck` | verde |
  | `biome ci` | verde |
  | `vitest --project unit` | 3.822 testes |
  | `pnpm test:painted` | 761 testes |

- **Mutação**, numa cópia no scratchpad, rodando só os testes do que cada uma toca:

  | Mutação | Onde | Teste | Resultado |
  |---|---|---|---|
  | `--measure-conversation: 58.5rem` | `design/system/tokens.css:55` | `TaskView.conversation.painted`, `TaskView.scenes.painted` | 96 de 230 falham |
  | O Markdown da fala com `max-w-[40rem]` | `features/chat/Markdown.tsx:65` | `conversation.painted` | 108 de 114 |
  | Sem `round(down,…,1px)` | `features/chat/ConversationColumn.tsx:11` | os dois pintados | 48 de 230 |
  | O bloco aberto do grupo com `mx-(--space-2)` | `features/chat/entries/Group.tsx:137` | `conversation.painted` | 108 de 114 |
  | O compositor com `max-w-[58.5rem]` | `features/chat/Composer.tsx:261` | `conversation.painted` | 72 de 114 |
  | `mr-(--space-8)` no cartão de arquivos | `features/task/ChangedFilesCard.tsx` | `scenes.painted` | 6 de 116 |
  | `mr-(--space-8)` no rascunho da PR | `features/task/DraftCard.tsx` | `scenes.painted` | 6 de 116 |
  | `mr-(--space-8)` nos checks ao vivo | `features/task/LiveChecks.tsx:47` | `scenes.painted` | 6 de 116 |
  | `mr-(--space-8)` no `PlaceEmpty` | `components/system/PlaceEmpty.tsx:21` | `scenes.painted` | 6 de 116 |
  | `otherPrimary: true`, o **Send** nunca primário | `features/task/useTaskComposer.ts:28` | `where-actions-went` | 6 de 92 |
  | O rascunho de volta com `data-feed-keys="own"` | `features/task/DraftCard.tsx:49` | `PRPane`, `DraftCard` | 2 de 31 |
  | O `PlaceEmpty` de volta com `role="status"` | `components/system/PlaceEmpty.tsx:20` | `PRPane`, `StepPane`, `PlaceEmpty` | 2 de 49 |
  | A contagem do retry dentro do anúncio | `features/chat/entries/Activity.tsx:95` | `Activity` | 1 de 10 |
  | `Write a message` de volta ao lado de **Send** | `features/chat/Composer.tsx:236` | `Composer` | 1 de 28 |

  Uma primeira versão da mutação do compositor, com `mr-(--space-4)`, passou; não era um estreitamento real, porque a caixa tem `w-full` e a margem só a empurra para fora. A versão com `max-w` é a que vale.
- **Capturas**:
  - A branch `captures/51-redesign-4-task-screen-ii-the-conversation-the-ask-bar-and` (`0b614e3`, gravada dois minutos depois de `c55a417`) tem 170 imagens.
  - O corpo da PR traz duas tabelas, as cenas da conversa e as nove da task, a 950 e 2180 px nos dois temas.
  - Li contra os mocks:
    - `scene-manual-950-light`: `Changed files · 7`, com `partly staged` e `not staged`;
    - `scene-close-950-dark`: `Merged #1284 into dev · by lnakamura`, sem compositor;
    - `conversation-planning-950-light`: as pastilhas em pílula;
    - `conversation-running-950-dark`: `Working · 3m 40s` e o grupo aberto com o subagente.
  - Nenhuma mostra `Write a message` ao lado de **Send**.

## Os dez bloqueios da primeira leitura

| # | Bloqueio | Situação | Evidência |
|---|---|---|---|
| 1 | As capturas | Corrigido | A branch de capturas e as duas tabelas no corpo. A coluna do mock traz o endereço, não a imagem (nota 1) |
| 2 | A prova das bordas | Corrigido | `TaskView.conversation.painted.test.tsx` mede a coluna por `conversationEdges` (`test/painted.ts:241–265`), com as larguras ímpares 1567 e 2181. Mede também os blocos de cada entrada (`.markdown`, `[data-code-cut]`, código, tabela, mermaid, bloco do grupo, corpo do marco) contra a coluna ou o miolo do quadro, e a saída de cada comando contra o miolo do grupo.<br>O compositor é achado por `data-slot="composer"`.<br>`TaskView.scenes.painted.test.tsx` mede o cartão de arquivos, o bloco do step bloqueado, o `PlaceEmpty` com os checks, a linha do merge, o rascunho e os checks depois de uma passada, a 950, 1567 e 2180 px.<br>Todas as mutações da tabela falham |
| 3 | As cenas incoerentes | Corrigido | `test/task-scenes.ts`: `manual` com sete arquivos, `close` com `prState: "merged"` e `mergedBy`, e `error` com `process_exit`. Também `plan` com as pastilhas, `run` com `turnStartedAt`, e as esperas da §11 (`2m`, `18m`, `5m`, `9m`, `6m`, `12m`, `2h`).<br>Provado em `TaskView.scenes.test.tsx` e visto nas capturas |
| 4 | As regiões vivas | Corrigido | `PlaceEmpty.tsx:20` sem `role="status"`, como pede `components.md`. `Activity.tsx:83–96` tira a contagem do anúncio com `aria-hidden`, e a região fala só quando a tentativa ou a razão mudam. `features.md` diz isso |
| 5 | As setas no rascunho | Corrigido | `DraftCard.tsx` sem `data-feed-keys`. `PRPane.test.tsx` anda com `↑` e `↓` pelo cartão e confere que `↑` num campo fica no campo |
| 6 | As pastilhas | Corrigido | `Composer.tsx:266–286`: um `Chip kind="action"` na altura `--size-control-xs`, com a tecla em mono `--text-micro` `--ink-3`, dentro de um `fieldset` com o nome `Quick replies`. É a anatomia de `b.html:1173–1175, 2485` |
| 7 | O rodapé do código cortado | Corrigido | `Markdown.tsx:122–150`: o quadro `[data-code-cut]` em `--surface-0` envolve o código e o rodapé, sob um fio. `globals.css:509–515` tira o quadro do bloco interno.<br>`Markdown.painted.test.tsx` mede o rodapé dentro do bloco, na largura dele |
| 8 | `Write a message` | Corrigido | `Composer.tsx:244–254`: o motivo vai no tooltip e numa descrição `sr-only`, ligada por `reasonId` |
| 9 | O **Send** primário | Corrigido | `where-actions-went.test.tsx`, "Send, the primary where the bar has none": `reply` sem rascunho, `plan_invalid`, `findings`, `worktree_unreadable`, `step_empty` e o `session_error` de um turno que falhou. Em cada uma, **Send** com texto é a única primária |
| 10 | O registro do pronto 6 | Corrigido | O corpo da PR, "Labels of the commands in real sessions": o `Bash` de 79 worktrees reais passou por `session.For`, e toda chamada com `description` saiu com ela. A conferência no app fica para o usuário (nota 2) |

Entraram também:
- o item 12 da primeira leitura: `situationLabel` diz `Decide findings`, em `lib/situations.ts:89`;
- o item 17: `TestAnOutputKeepsItsLast64KiB`, em `internal/session/output_test.go`, com o limite escrito;
- parte do item 20: os valores soltos de `Composer.tsx` e de `CleanAndStartDialog.tsx:66`.

## Regressões procuradas

- **`Chip kind="action"`.**
  - Em `Chip.tsx`, o tipo novo só aumenta a união de `kind`. O ramo `kind === "toggle"` continua indo ao `ui/toggle`, e todo o resto, `menu` e agora `action`, ao `ui/button`, como antes; o chevron continua só em `menu`.
  - Os outros quatro leitores seguem com o `kind` que tinham: `models/ModelChip.tsx:81`, `task/DetailsPanel.tsx:566, 580` e `review-mode/StepModeChip.tsx:49`.
  - O desabilitado de `action` usa `aria-disabled` e bloqueia o clique no `handleClick`, como os outros.
  - `design-system.md` descreve os três tipos. Nenhuma regressão.
- **`PlaceEmpty` sem `role="status"`.** O estado vazio deixa de ser anunciado quando o lugar muda com a tela aberta.
  - Os momentos em que o app trabalha são a atividade, que continua `role="status"` também na forma fixa (`Activity.tsx:88`): `Starting step 5…`, `Preparing the pull request…`, `Closing the task…`. O que pede algo é a barra, com o anúncio dela.
  - Em silêncio ficam só os lugares sem trabalho e sem pedido: `The review starts when the checks finish.`, `Every step is committed`, `No steps were found`, a PR mergeada antes da passada 1. Isso segue `components.md`, que não pede anúncio.
  - Opinião minha: na espera dos checks, a mudança do lugar podia ser dita uma vez só, pelo título, sem os checks. Não bloqueia (nota 3).
- **`conversationEdges` com números fixos** (`test/painted.ts:244, 247`: 960 e 24, e não os tokens).
  - Uma mudança de propósito em `--measure-conversation` ou em `--space-6` derruba a prova. O comentário do arquivo diz que é de propósito, e `docs/guidelines/testing.md` também.
  - Aceito. Os 960 px são uma decisão do usuário (`decisions.md`, 2026-09-25), não um detalhe de implementação, e a prova existe para pegar um token que derive; derivar dela o valor esperado a tornaria cega a isso, que era o bloqueio 2.
  - O custo: mudar a medida pede mudar duas linhas do teste junto com a decisão, e a falha diz onde.
  - O limite: os números valem com a fonte raiz de 16 px, que é a das provas pintadas.

## Pode esperar

Da primeira leitura, sem mudança nesta:

1. **O review e a discussão.**
   - `pr_review_written` no review diz `Review 1 written`, sem `changes` e sem **Open in Reports** (`features/chat/markers.ts:330–339`). O ramo `reports` de `MarkerLine.tsx:37` continua sem quem o alcance.
   - `Discussion started` sai sem complemento (`markers.ts:232`).
   - O material (`04:75`) os punha nesta task; cabem na task 6 e na task 9.
2. **A opção do cartão de pergunta sem pressionado nem desabilitado** (`features/chat/entries/QuestionCard.tsx:31`).
3. **A hora da resposta fora do nome acessível** da pergunta e da permissão respondidas (`QuestionCard.tsx:122`, `PermissionCard.tsx:135`; `backend.md` P40).
4. **Provas que faltam**:
   - `Page Up`/`Page Down` andando dez (`features/chat/useFeed.ts:19`, com o feed de teste de três entradas);
   - `1`–`9` na entrada de um cartão de várias perguntas;
   - o percurso das setas com as entradas reais;
   - as pastilhas só com `reply` no jsdom;
   - `useFocusRescue` na tela (`features/task/TaskView.tsx:141`) e o foco no compositor depois de **Retry reviewer**;
   - a chegada a uma permissão num teste de tela;
   - o tooltip de **Go to …**;
   - os estados de `where-actions-went` que faltam: **Retry** do revisor, da PR e do review da PR; **Resume** pausado fora do step; **Deny** com `defaultToNo`.
5. **A razão do retry ignora `error_status`** (`internal/claude/protocol.go:63–68`, `internal/session/events.go:409–425`).
6. **`GetActionOutput` só no `TaskService`** (`internal/bindings/task_service.go:265–276`), contra "no serviço de cada item" (`04:378`).
7. **Não há teste de `Close` esperando `spawnPRWork`** (`internal/flow/pr.go:294–313`).
8. **Valores soltos**:
   - `features/chat/entries/PermissionCard.tsx:81` (`max-h-48`);
   - `features/task/DraftCard.tsx:67` (`+1rem`);
   - `features/chat/Markdown.tsx:134` (`h-8`, preso à altura do cabeçalho do Streamdown).
9. **Detalhes visuais**:
   - o mermaid encolhido pelo `panZoom` (`Markdown.tsx:17`), de antes da task;
   - o cursor do streaming numa linha nova, em `--ink-1`;
   - o cabeçalho do código cortado sem caminho nem intervalo;
   - `BackToEnd` anulando o hover (`features/chat/entries/BackToEnd.tsx:32`).
10. **As fixtures da conversa.** Os `sed`/`cat` de `STEP_3_READS` sem saída. O grupo vivo que começa antes de `turnStartedAt`, e por isso diz `4m 0s` contra `Working · 3m 40s` (visível em `conversation-running-950-dark`). O arquivo do step com outro nome que o do mock.
11. **`blockHint` de `clone_missing` manda a Settings** (`features/task/step-status.ts:229`), enquanto a barra oferece **Change path…**. É opinião.
12. **A virtualização vai para a task 12** com a medida da PR. As duas pistas continuam: `buildConversation` a cada evento `text` e `useFeed` refazendo a parada de Tab a cada mutação.

## Notas

1. **As tabelas de capturas não mostram o mock em imagem.** A coluna "Mock" do corpo da PR traz o endereço (`a.html?scene=planning&open=all`), não a captura. O pronto 1 pede "lado a lado com o mock" (`04:19`); é a mesma nota 4 da crítica da task 3. A comparação lado a lado desta leitura está no scratchpad do crítico.
2. **O pronto 6 foi conferido pelos logs do CLI**, pela mesma função Go que preenche a ação, e não no app. O corpo da PR diz como o usuário confirma no app.
3. **O lugar vazio que muda com a tela aberta não é dito ao leitor de tela** (regressão procurada acima). É opinião e fica para a passada de acessibilidade da task 12.
4. **Seguem da primeira leitura**, para o coordenador:
   - a contradição do material sobre a hora no nome dos cartões pendentes e da fila;
   - o texto do compositor que troca uma escolha explícita;
   - `Esc` com um painel aberto e o turno rodando;
   - o anúncio duplo de uma situação nova, de antes desta task.

**Mergear.**
