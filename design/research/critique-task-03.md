# Crítica da task 3 · Tela da task I (PR #69)

Revisão da branch `50-redesign-3-task-screen-i-header-stepper-tabs-panels-and-menu` em `a84c005` (14 commits sobre `be10ea9`), antes do merge, contra `design/tasks/03-task-header.md` (o material), `design/screens/task.md` §2–§5, §7, §10, §12 e §13, `structure.md`, `principles.md`, `system/components.md`, `system/tokens.css`, `changes.md`, `backend.md` e os mocks `lab/10-screen-task-minimal/b.html` e `components.html`. O PRD e o tech spec da task, em `~/.local/share/myspec/tasks/guilhermt/MySpec/50-…`, confirmam **Follow the task** (`PRD.md:5, 158, 253`).

Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa. `03:N` é a linha do material.

## Veredito

**Corrigir antes do merge.** O trabalho é sólido. Estão certos o backend (P4, P12, P13, P42 a P45), a pílula e a cedência, o `⋯`, os popovers, `Details`, a conversa anterior, as abas, **Pause** e a documentação. Todas as suítes passam, e as provas pintadas pegam as 14 mutações que tentei. Seis divergências impedem o merge:

- duas regras do material não cumpridas: as capturas no pull request (pronto 3 e 4) e a coluna da barra;
- dois defeitos visuais que os testes não pegam: o glifo de pausa no tamanho `sm` e o `⋯` preso a 14rem;
- código morto;
- a grade de fatos de `Details`.

Cada uma se corrige em poucas linhas.

## Como foi conferido

- **Suítes**, pelos comandos do `Taskfile.yml`, todas verdes; os bindings estão em dia e o CI da PR está verde:

  | Suíte | Resultado |
  |---|---|
  | `task test:go` | 2.511 testes; o único pulado é de `internal/platform/dnd` e não é desta task |
  | `task typecheck` | verde |
  | `task lint:web` | verde |
  | `pnpm test:coverage` | 3.158 testes em 232 arquivos, 97,7% de linhas |
  | `pnpm test:painted` | 538 testes em 38 arquivos |
  | `task bindings:check` | limpo |
  | `gh pr checks 69` | Build, Frontend e Go verdes |
- **Página de teste.** Montei o `TaskView` numa cópia no scratchpad, com as fixtures de `test/task-scenes.ts`:
  - as nove cenas a 950 e 2180 px de área principal, as janelas de 1250 e 2560, nos dois temas;
  - os três painéis, `Details` nas cenas `checks`, `close` e `manual`;
  - o `⋯`, o popover Review mode, o popover Models com o `listbox` aberto;
  - a task pausada, com e sem barra, o carregando e a conversa anterior.

  Capturei o mock 10-b nas mesmas cenas, larguras e temas, com `?panel=`, `?menu` e `?pop=`, servido na porta 8117, que já encerrei.
- **Contraste.** Medi no Chromium todo texto à vista das cenas, dos painéis, do menu e dos popovers, nos dois temas, convertendo a cor computada para sRGB e compondo o fundo real. Só um par fica abaixo de 4,5:1: o separador `/` do breadcrumb (`--line-deco`, 3,46 claro, 3,69 escuro), que é `aria-hidden` e decorativo por decisão do system. Também calculei pelos tokens os pares não textuais novos, todos acima de 3:1:
  - o sublinhado da aba (5,57 claro, 7,18 escuro);
  - o círculo futuro (3,45 e 3,69);
  - o disco âmbar na pílula (3,64 e 7,24);
  - o losango na pílula (5,08 e 5,17);
  - o anel verde na pílula (4,72 e 7,25);
  - o foco sobre a pílula (4,71 e 5,51).
- **Mutação.** Rodei 14 mutações contra `TaskView.widths`, `TaskView.scenes`, `Stepper`, `Pill`, `Tabs` e `TaskHeader` pintados, e as 14 foram pegas:
  - os limites de 900, 1040, 1200 e 1300;
  - os espaços que mudam com a largura;
  - o título que não encolhe;
  - o fundo e o nome da pílula pausada;
  - o divisor;
  - o sublinhado e a altura da aba;
  - o medidor.
- **Backend, documentação e textos.** Conferi o backend e a documentação campo a campo, e os textos da barra, do `⋯`, de `Details` e das abas contra as tabelas da §4.2.

## Bloqueia o merge

1. **As capturas não estão no pull request.** O pronto 3 (`03:21`) pede as capturas das larguras anexadas à PR e uma conferência a 1250 px de janela na máquina alvo. O pronto 4 (`03:22`) pede as capturas das nove cenas ao lado do mock. O corpo da PR não tem imagem, e não há branch `captures/*` no remoto.
   - Rodar `task captures` e `task captures:push`, e pôr o Markdown no corpo da PR, ao lado das capturas de `b.html?scene=…`.
   - Antes, acertar as fixtures de `test/task-scenes.ts`, ou as capturas mostram um produto que não existe:
     - o relógio não é fixo: o chip da barra diz `23d` (`manual`, `close`), `e2e` roda há `17h 58m` e `Checked` diz `1d ago`;
     - `models` é o de uma task no PRD (`test/wails-mock.ts:557`), então na cena `run` o popover Models deixa editável o `Tech spec`, que já rodou;
     - `worktreePath` vazio põe `Open in VS Code · the worktree doesn't exist yet` no `⋯` de um step que trabalha;
     - `conversations: []` tira de `Details` o grupo Planning e as linhas de conversa;
     - o card fora do board põe `Card` na faixa `This card isn't in the last reading of the board.`

2. **A barra e a faixa da conversa anterior saem da coluna numa área estreita.**
   - `features/task/TaskRequest.tsx:108` envolve a barra em `px-(--space-3)`, e `features/task/EarlierConversationFoot.tsx:33` envolve a faixa em `p-(--space-3)`.
   - As abas usam `px-(--space-6)` (`features/task/TaskView.tsx:46`).
   - `task.md:28` e `03:79` mandam a coluna ocupar a área menos `--space-6` de cada lado, para as abas, a barra e o compositor.
   - A 950 e a 996 px de área, a janela de 1250, a barra passa 12 px além das abas de cada lado. A captura `manual` a 950 mostra a barra de 12 a 938 px e as abas de 24 a 926 px.
   - Mudar os dois invólucros para `px-(--space-6)`, com o espaço vertical à parte.

3. **O glifo de pausa no tamanho `sm` desenha uma barra e meia.**
   - `components/system/StateGlyph.tsx:30` calcula o degradê com `var(--glyph)` (10 px), e o tamanho `sm` corta a caixa em `--glyph-sm` (8 px). A segunda barra fica com 1 px, contra os 3 px da primeira.
   - O defeito se vê na pílula pausada e na aba pausada: ampliei a captura da task pausada a 1250.
   - É o estado "pausada" do pronto 1 e de `task.md:97` ("duas barras"). O glifo nasceu na task 1, mas esta é a primeira task a usá-lo em `sm`.
   - Escrever as paradas contra `100%` (`calc(100% - var(--glyph-bar))`) e acrescentar ao `Pill.painted.test.tsx` a largura das duas barras.

4. **O `⋯` fica preso em 14rem e quebra os itens em duas e três linhas.**
   - O primitivo gerado fixa `w-(--anchor-width)` (`components/ui/dropdown-menu.tsx:41`), e `MenuContent` (`components/system/Menu.tsx:37`) só acrescenta `min-w-(--size-menu-min)`. O menu fica com a largura mínima, 224 px.
   - Na cena `run` a 1250 quebram:
     - a legenda `STEP 3 · COUNT THE REQUESTS IN A TOKEN BUCKET`, em duas linhas;
     - `Open in VS Code · the worktree doesn't exist yet`, em três;
     - `Discard and restart the tech spec…`, em duas.
   - `components.md` (Select, menu e listbox) dá ao item a altura de `--size-control`, e o mock (`b.html?menu`) mostra cada item numa linha.
   - Dar a `MenuContent` a largura do conteúdo (`w-max`), com um teto, e provar num teste pintado que nenhum item do `⋯` da task passa de uma linha.

5. **Ficou código morto.** O material pede a saída "sem código morto" (`03:72`, §3 item 13). Quatro funções perderam o único leitor nesta PR e só os testes as leem; `git grep` em `be10ea9` mostra que cada uma tinha leitor.
   - `features/task/pr-status.ts:113` `canApprovePR` e `:118` `approvePRHint`, leitores de `PRBar`.
   - `features/task/step-status.ts:175` `conversationDisplay`, de `StepTabs`.
   - `features/task/step-status.ts:237` `stepBarDisplay`, de `StepBar`. Com ela sai `stepStateLabel` (`:74`), cujo único uso é `:238`.
   - `lib/situations.ts:274` `stepOrReviewerSituation`, de `StepBar`.
   - Apagar as funções com os testes delas.

6. **Na grade de fatos de `Details`, o valor de várias linhas desalinha a chave.**
   - `FACTS` (`features/task/DetailsPanel.tsx:437`) centra a chave na vertical (`items-center`).
   - Na cena `checks`, a chave `Checks` fica no meio da lista de cinco checks. O resumo `3 of 5 passed · 2 not finished` fica logo sob `#1284 · into dev` e se lê como parte de `Pull request`.
   - A chave vai ao alto do valor (`items-start`, ou a linha de base da primeira linha), como no mock (`b.html:1091–1093`).
   - O mesmo arquivo põe um valor solto, `7rem`, onde a coluna da chave precisa de um token: `--col-keys` tem o mesmo valor, ou um token novo em `tokens.css`.

## Pode esperar a task 4

7. **Duas primárias na tela.** O `Composer` desenha **Send** sempre como primário (`features/chat/Composer.tsx:111, 116`).
   - Com a barra em `ready_to_continue`, `draft`, `merge` na forma close ou `pr_trouble`, a tela tem duas primárias.
   - Pausada, `PausedNotice` põe um **Resume** primário (`Composer.tsx:42`) ao lado do **Resume** do topo.
   - `task.md:236` e o compositor são da task 4. Até lá o pronto 11 vale para as notas de `PRPane` e o `DraftCard`, não para a tela inteira. Registrar no card da task 4.
8. **Sobra `checking GitHub…`** (item 12 do pedido).
   - Continuam com reticências o comentário de `components/system/Shimmer.tsx:9` (`like checking GitHub….`, com pontuação dobrada) e o texto de `Shimmer.test.tsx:8–9`.
   - O `Checking GitHub…` de `features/task/PRPane.tsx:259` é o app preparando, com spinner, e sai com o vazio da PR na task 4.
   - Os dois primeiros são uma linha cada e podem entrar já.
9. **A barra ainda não é a da conversa inteira.** `ask`, `error`, `blocked` e `findings` ficam sem barra, como o material manda (`03:81`). Os nomes acessíveis ficam redundantes pela fórmula de `announcement` (`features/task/stepper.ts:227–231`):
   - `Progress · Implementation 5/7 · error: step 5 blocked in Step 5`;
   - `Progress · Closing · ready to close: ready to close in PR`;
   - o lugar `PR` onde a barra do mock diz `PR review` (`findings`).

   É o que a §4.2 prescreve. Por opinião, a task 4, que liga essas barras, devia tirar o lugar quando o rótulo já o diz.

## Notas, sem bloquear

10. **O status congelado nem sempre é o rótulo de nascimento.** `features/task/request.ts:189` e `:344` fixam `Review step N` e `Review changes` como texto de `role="status"`. Uma situação que já nasce na forma `approve`, como o fallback `commit_failed` com tudo em stage, anuncia `Review step 4` enquanto o rótulo diz `Approve step 4`. `structure.md:175` quer o rótulo com que ela nasceu.
11. **Uma linha de `where-actions-went.test.tsx:115–125` monta um estado que o backend não produz.** Ela usa `review_failed` com `step_review`, mas `internal/attention/derive.go:149–150` dá `worktree_unreadable`. A fixture certa é `awaiting_review` com `review.error`.
12. **O nome acessível de Resume.** `components/PauseButton.tsx:52, 62–66` põe `Resume the task · paused since 14:52` na descrição (`aria-describedby`), e o nome fica `Resume`. Isso segue a §4.2 (`03:164`, "tooltip e descrição"), mas o pronto 12 (`03:30`) diz "nome acessível". O material diverge de si mesmo; decide o coordenador.
13. **`step_review` e `step_empty` na aba do implementador.** `features/task/agent-tabs.ts:108` e `store/step-tab.ts:215` os tratam como situação da aba do implementador, e numa passada com revisor a aba de fora diz `Implementer · waits`. `task.md:192` os dá ao step, não a uma conversa. A leitura é defensável, porque a barra aparece nas duas abas; registrar.
14. **O popover Models não mostra escolha própria nem grupo contornado.**
   - `features/task/ModelsPopover.tsx:129` passa `own={false}` em toda linha, e `TaskStageModel` não tem o campo (`internal/bindings/dto.go:734–740`).
   - As linhas não estão num grupo contornado.
   - `components.md` (Linha de modelo) pede as duas coisas; o material não. Fica para quando o dado existir.
15. **Documentação.** Nas linhas que a PR reescreveu, `docs/product/features.md:361` diz **Descartar step**, e o botão é **Discard step N…**; `:454` diz **Tentar de novo**, e o botão é **Try again**. Alinhar ao nome real.
16. **Valor solto.** `components/system/Link.tsx:23` usa `gap-0.5`, onde existe `--space-0-5`.
17. **Opinião, fora da régua:**
    - o `⋯` escreve `Review mode › Agent` (`features/task/TaskMenu.tsx:156`), e o mock põe o chevron no fim (`Review mode  Agent  ›`);
    - `ChecksList` sublinha os nomes dos checks como links, e o mock os mostra em mono, sem sublinhado;
    - a pílula pausada, neutra, mantém o divisor azul (`components/system/Pill.tsx:72`), como o mock.

## Os pedidos, um a um

| # | Pedido | Situação |
|---|---|---|
| 1 | Itens de pronto | 1, 2, 5 a 16 provados:<br>• `stepper.test.ts`, `Stepper.test.tsx`, `Pill.test.tsx`;<br>• `task-menu.test.ts`, `TaskMenu.test.tsx`, os testes dos popovers;<br>• `AgentTabs.test.tsx`, `DetailsPanel.test.tsx`, `EarlierConversationFoot.test.tsx`;<br>• `ArtifactsPanel.test.tsx`, `CardPanel.test.tsx`, `TaskRequest.test.tsx`, `where-actions-went.test.tsx`;<br>• `PauseButton.test.tsx`, os testes Go, `useGlobalShortcuts.test.tsx` e a documentação.<br>3 e 4 sem as capturas na PR (bloqueio 1). 17 é esta crítica |
| 2 | A pílula e a barra | Os textos da §4.2 conferem (`request.ts:163–365`, `stepper.ts`).<br>Com situação, a pílula mostra só o glifo; a palavra fica no nome acessível.<br>**Close task**, **Discard draft** e **Open PR** têm lugar em todo estado que `canClose` e `canDiscardDraft` permitem.<br>Primária única: nota 7 |
| 3 | O `⋯` | Grupos, ordem, desabilitados com a razão (as cinco de **Review again**, `blocked` incluída), diálogos testados.<br>**Review again** durante uma passada.<br>O PRD e o tech spec descartáveis de etapas posteriores, como `StageTrack`.<br>Largura: bloqueio 4 |
| 4 | `Details`, popovers, seletor, **Follow the task** | Campo a campo conforme; **Follow the task** confirmado pelo PRD e ligado a P44.<br>Foco e `Esc` conferidos na página de teste: o foco vai à opção escolhida e ao primeiro chip; `Esc` fecha o `listbox`, depois o popover, e o foco volta ao `⋯`.<br>Grade: bloqueio 6 |
| 5 | Abas e conversa anterior | Conformes: `tablist` de uma parada, `· waits` e `· error`, `Reviewer · starts with pass 1`, gravação em efeito, `.situation-flash`.<br>A faixa, **Back to step 3**, o foco na região e o sumiço da barra, das abas e do medidor verificados.<br>P42 a P45 com teste Go |
| 6 | Cedência | Os sete limites de `task.md` §3 como `@max-[N]/main`; provados por mutação.<br>A 950 e 996: `✓ ✓ ✓ [Implementation 3/7 ◌] ○ PR ○ PR review ○ Closing` |
| 7 | Task pausada | Pílula neutra com `paused`, medidor `—`, **Resume** no topo.<br>A barra `Review step 4` quieta, com as duas barras e sem chip; `ready_to_continue` ausente.<br>Glifo: bloqueio 3 |
| 8 | P4, P12, P13 | Da migration `0019_task_screen.sql` ao DTO:<br>• `pausedAt` nos cinco blocos;<br>• `%cI`;<br>• `pr_runs.checks` e `mergeable`, com uma resposta real do `gh` gravada.<br>Bindings e `wails-mock.ts` em dia |
| 9 | O que sai | `StageTrack`, `StepBar`, `PRBar`, `StatusBadge`, `StepTabs`, `TaskModels`, `TaskReviewMode`, `ArtifactPanel` e `attention-flash` saíram.<br>`ReviewStrip`, `CardLink` e `ContextGauge` ficam com os leitores certos.<br>Restos: bloqueio 5 |
| 10 | Documentação | No presente, sem histórico, conforme o código: `features.md`, `design-system.md`, `sessions.md`, `storage.md`, `overview.md`, `frontend.md`, `testing.md` e `setup.md`.<br>Dois nomes antigos: nota 15 |
| 11 | Tokens, contraste, nomes, teclado | Contraste medido, todo par passa.<br>Nomes acessíveis e teclado conferidos.<br>Valores soltos: bloqueio 6 (`7rem`) e nota 16 |
| 12 | `checking GitHub…` | Nota 8 |
