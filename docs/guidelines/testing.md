# Testes

Os testes são o que permite mudar o produto com confiança. Uma feature está pronta quando os testes dela passam com `task test`, junto com todos os outros. A cobertura e os limiares são medidos à parte, por `task test:full`, sob demanda e toda semana no CI.

## Como rodar

| Comando | O que roda |
|---|---|
| `task test` | `test:go` e `test:web`, em segundos |
| `task test:go` | Os testes Go; um pacote que não mudou vem do cache de testes do Go. O CI acrescenta `-race` com `task test:go -- -race` |
| `task test:web` | Os testes das duas suítes do frontend que alcançam um arquivo mudado desde que a branch saiu de `main`; uma mudança na configuração do Vitest roda todos |
| `task test:full` | `test:go:full` e `test:web:full`, só quando pedido |
| `task test:go:full` | gotestsum com `-race -shuffle=on -count=1`, cobertura e o limiar de `.testcoverage.yml` |
| `task test:web:full` | Vitest: a suíte do jsdom com cobertura e os limiares de `vitest.config.ts`, depois a de estilo computado no Chromium |
| `go test -run 'TestNome' ./internal/pacote/` | Um teste Go |
| `pnpm vitest run <arquivo>` (em `frontend/`) | Um arquivo de testes do frontend |
| `pnpm test:watch` (em `frontend/`) | Vitest interativo, na suíte do jsdom |
| `pnpm test:painted` (em `frontend/`) | Só a suíte de estilo computado |

Um teste que passa só numa ordem ou só sem `-race` está errado. Na máquina, `task test:go` deixa o detector de corrida de fora, porque ele deixa a suíte três a quatro vezes mais lenta; o CI roda com ele. O embaralhamento e o `-count=1` ficam só em `task test:go:full`, porque fazem cada pacote rodar de novo mesmo sem mudança.

Cada ferramenta usa no máximo `JOBS` núcleos, 4 por padrão ou os que a máquina tiver se forem menos, e `MYSPEC_JOBS` muda o valor: `-p` do `go test`, `--maxWorkers` do Vitest e `--concurrency` do golangci-lint. Sem o limite, cada ferramenta toma todos os núcleos, e vários agentes rodando as verificações ao mesmo tempo disputam a máquina.

## Limiares

Go: 60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes. Frontend: 80% de linhas, funções e statements e 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`, medidos só na suíte do jsdom. Medidos por `task test:full`.

## Testes em Go

### Forma

- Pacote externo: `package task_test`, testando pela API pública.
- `t.Parallel()` em todo teste. A exceção é o teste que confirma que nada acontece, que precisa de tempo passando sem concorrência.
- O nome é uma frase que diz o comportamento: `TestAFinishedPlanStartsTheFirstStepInItsWorktree`, `TestClosingATaskIsRefusedUntilTheMergeIsConfirmed`. Um teste testa um comportamento.
- Tabelas quando há casos paralelos da mesma regra, com `t.Run` e um nome por caso.
- `cmp.Diff` do `go-cmp` para comparar estruturas: `if diff := cmp.Diff(want, got); diff != "" { t.Errorf("... (-want +got):\n%s", diff) }`. `t.Fatalf` quando o resto do teste não faz sentido sem aquilo; `t.Errorf` para acumular.
- Espera ativa em vez de `time.Sleep`: um helper `waitX` que consulta o estado em intervalo curto com um timeout, chamando `t.Helper()`. Um `sleep` só no teste que prova a ausência de um evento.
- `t.Context()` para os contextos, `t.TempDir()` para o disco.

### Fixtures e helpers

Cada pacote tem um `helpers_test.go` com o que os testes dele compartilham: um `fixture` montado por `newFixture(t)`, dublês em memória das dependências (`memRepo`, `memTasks`), gravadores de chamadas e os `waitX`. O dublê implementa a interface que o pacote de produção declara, então a fixture diz exatamente o que o pacote precisa. Um `logCapture` captura o `slog` em JSON quando o teste verifica uma linha de log.

### Fakes de processos

Os pacotes que rodam binários testam contra o binário real ou contra um fake que é o próprio binário de teste reexecutado, declarado num `TestMain` de uma linha:

- `internal/claude/claudetest`: um CLI do Claude Code falso que fala stream-json. O teste escreve um roteiro do que o fake responde; `internal/claude/testdata/*.jsonl` são streams reais gravados.
- `internal/git/gittest`: constrói repositórios de verdade em diretórios temporários com o `git` real. O git não é dublado.
- `internal/gh/ghtest`: um `gh` falso que responde o que o teste escreveu, porque falar com o GitHub não é opção. É o binário reexecutado, não um script, porque escrever um executável enquanto outros testes fazem fork falha com "text file busy".
- `internal/platform/chime` e `internal/platform/dnd`: um player de áudio e um `omarchy-shell` falsos, o binário de teste reexecutado, declarados no `TestMain` do próprio pacote porque só ele os usa. O comportamento do fake (tocar, falhar, travar; responder `on`, `off`, falhar, travar) vem no argumento ou numa variável de ambiente.

`store.OpenMemory` abre um SQLite em memória com as migrations aplicadas, para os testes do `store` e de quem o usa.

## Testes no frontend

### Forma

- Vitest com Testing Library, `user-event` e jsdom, no pool `vmForks`: cada worker monta o jsdom uma vez e dá a cada arquivo um contexto de VM novo sobre ele, isolado como antes, em vez de montar o jsdom de novo para cada arquivo. `describe` com o nome do componente ou módulo, `it` com uma frase: `it("places the step in the plan, with its title and repository")`.
- Um arquivo de testes ao lado do que testa: `StepPane.test.tsx` ao lado de `StepPane.tsx`, `status.test.ts` ao lado de `status.ts`.
- A lógica de apresentação em `.ts` é testada como função pura, sem renderizar. Os componentes são testados pelo que o usuário vê e faz: `getByRole`, `getByText`, `user.click`, `user.type`. Consultar classes só para o que não tem outra forma de ser observado, como o tom de um ponto de status ou a centralização alinhada ao pixel, que o jsdom não calcula.
- Um comportamento por `it`. Sem snapshots.

### Estilo computado

O jsdom roda sem CSS, então um teste nele não vê a cascata: uma classe presente na lista pode perder para uma do primitivo de `components/ui/` ou para uma variante `dark:`. O que um componente pinta é provado por uma segunda suíte, os arquivos `*.painted.test.tsx`, que o Vitest roda no modo navegador, no Chromium do Playwright, com o CSS real (`styles/fonts.css` e `styles/globals.css`). O projeto `painted` de `vitest.config.ts` a define, e `src/test/painted-setup.ts` carrega o CSS, zera as transições (o teste lê o estado em que o controle assenta) e limpa o tema entre os testes. Os tipos dela são checados à parte, por `tsconfig.painted.json`, porque os matchers do modo navegador estreitariam os do jest-dom da suíte do jsdom.

- Vai para ela o teste de uma cor, de uma borda, de uma sombra, de um anel de foco ou de uma medida: todo estado de cor dos componentes de `components/system/`. O teste de comportamento e de acessibilidade continua no jsdom, e o do jsdom não consulta as classes de cor que esta suíte cobre.
- Cada arquivo roda os seus testes nos dois temas, `describe.each(THEMES)`, e `setTheme` põe o `data-theme` no `documentElement`, como o app.
- O estado vem de verdade: hover e foco pelo `userEvent` de `vitest/browser`, desabilitado, erro e carregando pelas props.
- O esperado é o token resolvido no mesmo tema: `token("--surface-input")` e `resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow")` passam o valor por um elemento de sonda no documento, que o devolve na mesma notação do `getComputedStyle`. `paintOf(elemento, esperado)` lê do elemento as mesmas entradas do esperado, e a comparação é `expect(paintOf(el, want)).toEqual(want)`; a sombra é lida sem as camadas vazias que o Tailwind compõe.
- O que cede pela largura da área principal é medido dentro de um invólucro com o estilo `mainArea(largura)`, que faz o papel do container `main` das container queries. `NARROW_MAIN` é a área principal mais estreita, 812 px. `placeHeaderOneLine(faixa)` diz se um cabeçalho de lugar cabe numa linha, e `placeHeaderFits(faixa)`, se cabe com só o título cortado; `overlaps(placeHeaderPieces(faixa))` diz se alguma peça dele cobre outra, e `stepperText(stepper)` lê o que um stepper mostra, sem o que só o leitor de tela ouve (`✓ ✓ ✓ Implementation 3/7 ○ PR ○ PR review ○ Closing`).
- Uma forma que o estilo computado não dá, como as barras de um degradê, é medida em pixel: `inkRuns(elemento)` tira uma captura do elemento e devolve a largura, em pixels CSS, de cada trecho da linha do meio que difere do fundo, lido no primeiro pixel. O elemento vai sobre um fundo liso, e o teste nunca mede texto, cuja largura muda com a fonte da máquina.
- Um teste que monta uma tela inteira, como `TaskView`, declara no topo o mesmo `vi.mock("@/lib/wails", …)` de `src/test/setup.ts`, com o `wails-mock` importado dentro da fábrica, para nenhuma chamada chegar ao runtime do Wails. As cenas e as tasks das larguras da tela da task vêm de `src/test/task-scenes.ts` (`sceneTask`, `taskInLoop`, `taskInPRReview`), com as conversas já lidas, os modelos, a worktree, as conversas da task e o card do board coerentes com cada momento, e cada situação com a espera que o chip do mock diz (`2m`, `18m`, `2h`); `fixSceneClock()` fixa o relógio em `SCENE_NOW`, o momento das cenas, para as idades e as durações serem as do mock em qualquer dia. Além das nove do mock, as cenas `findings-*` cobrem o review da PR da task com apontamentos estruturados (decidir, aplicar, tudo descartado, edição, reescrita, enviado, passada em texto e relatório ilegível), com os cinco apontamentos de `SCENE_FINDINGS`. As sete cenas da conversa vêm de `src/test/conversation-scenes.ts` (`conversationScene`, com `voice: "impl"` para a aba do implementador), a mesma task com as conversas do mock da conversa, montadas pelas fábricas de `wails-mock.ts` com as horas locais do mock, e os documentos que as linhas abrem em `CONVERSATION_ARTIFACTS`; `fixConversationClock(cena)` fixa o relógio na hora da cena. As catorze cenas do board, da Home e do diálogo de criação vêm de `src/test/board-scenes.ts` (`boardScene`, com `fixBoardSceneClock()`), e as onze do centro de review e da tela de um review, de `src/test/review-scenes.ts` (`reviewScene`, com as variações `own`, `stale`, `apply` e `checkerr`, e `fixReviewSceneClock(cena)`, que fixa o relógio na hora da cena); os dados de cada cena reproduzem os do mock, e `after` faz o que a cena tem aberto, um painel ou um diálogo.
- A conversa é provada em `TaskView.conversation.painted.test.tsx`: cada cena, nas quatro larguras e em duas ímpares (1567 e 2181, em que a margem da coluna a dividir é ímpar), com tudo o que abre aberto (os `[data-feed-toggle]` fechados clicados até não sobrar nenhum), tem a coluna onde `conversationEdges` de `test/painted.ts` a põe (`min(960, área − 48)`, com números fixos e não o token, centrada com a margem arredondada para baixo, em pixel inteiro), e nas bordas dela cada entrada, a barra, o compositor (`[data-slot="composer"]`), as abas e cada bloco de uma entrada: o texto, o código cortado ou não, a tabela, o diagrama, o grupo aberto (`[data-slot="group-block"]`) e o corpo de um marco (`[data-slot="marker-body"]`). Um bloco dentro do grupo aberto ou do corpo de um marco fica nas bordas do que eles guardam, e a saída de um comando termina onde o grupo termina. A mesma prova confere nenhuma hora à vista sem hover e sem foco, e a hora no nome acessível de toda entrada, menos as que o material nomeia sem ela (a mensagem na fila, o grupo que roda e o cartão pendente). `TaskView.scenes.painted.test.tsx` faz o mesmo com os cartões fixos e o lugar sem conversa, a 950, 1567 e 2180 px: os arquivos mudados, o step bloqueado, o vazio com os checks ao vivo, a linha do merge, e os dois momentos da pull request que o mock não desenha, de `fixedCardScene` (o rascunho e os checks ao vivo depois de uma passada).
- `BoardView.scenes.painted.test.tsx`, `ReviewsView.scenes.painted.test.tsx` e `ReviewView.scenes.painted.test.tsx` desenham cada cena do board, da lista de reviews e da tela de um review a 2180 e a 978 px de área principal, e as de painel aberto também nas larguras estreitas, e conferem em cada uma que toda caixa está em pixel inteiro nas quatro bordas (`offWholePixels`, que deixa de fora o texto `sr-only`, sem caixa desenhada), que o título de uma linha fica inteiro ou com ao menos um terço dela, que as etiquetas não cortam, que as teclas ficam na coluna delas, que o que corta diz o texto inteiro no tooltip e que a camada de cima tem no máximo uma primária.
- `where-actions-went.test.tsx`, em `features/task/`, `features/board/` e `features/reviews/`, prova que cada controle de uma tela redesenhada tem um lugar na tela nova: uma linha por controle e por estado em que ele aparecia, com o lugar novo e o nome acessível inteiro, e, em cada situação da barra, do painel e dos diálogos, no máximo uma primária na camada de cima.
- O que a pull request mostra em imagem é gravado por `capture(nome, elemento)`, só com `MYSPEC_CAPTURES=1`, em `frontend/captures/`, que o git ignora: `widths-<task>-<largura>-<tema>`, `scene-<cena>-<tema>` (a 1566 px) e `scene-<cena>-<largura>-<tema>` (a 950 e a 2180 px, as janelas de 1250 e de 2560 px), `bar-<cena>-<tema>` (a barra e o compositor de cada cena da tela da task), `conversation-<cena>-<largura>-<tema>`, e, nas cenas do board, da lista de reviews e da tela de um review, `board-<cena>-<largura>-<tema>`, `reviews-<cena>-<largura>-<tema>` e `review-<cena>-<largura>-<tema>`. `task captures` as grava e `task captures:push` as publica ([setup.md](../development/setup.md)).
- A cobertura vem só do jsdom; a suíte de estilo computado prova a cascata, não linhas.

### Setup e dublês

`src/test/setup.ts` substitui o que não existe sob jsdom: o runtime do Wails, o Streamdown (reduzido ao texto), `ResizeObserver`, as animações do Base UI, e o `:focus-visible`, cuja heurística no jsdom guarda estado de um teste para o outro: o calço responde com a regra do navegador, visível depois de uma tecla e não depois do ponteiro nem de um foco programático, e é o que deixa o teste do tooltip provar que um foco invisível não o abre. Ele também substitui a fronteira com o Go: `lib/wails` é reexportado com o `api` e os `onX` de `src/test/wails-mock.ts` no lugar dos reais, e os helpers puros ficam reais.

- `renderWithStore(elemento, { state, ui })` de `src/test/render.tsx` renderiza com o store preenchido e devolve um `user` do user-event. `resetAppStore` faz o mesmo sem renderizar, para testar o store e as ações.
- `makeState`, `makeRepository`, `makeTask`, `makeStep`, `makePullRequest`, `makeSituation`, `makeTranscript`... de `wails-mock.ts` fabricam DTOs completos com valores plausíveis, aceitando `Partial` para o que o teste quer diferente. Um DTO novo ganha a sua fábrica.
- `api.x` é um `vi.fn` por função; o teste verifica a chamada com `expect(api.approveStep).toHaveBeenCalledWith(...)`. O mock é zerado depois de cada teste.
- Eventos do Go são simulados chamando as ações do store (`applyState`, `applyTranscriptEvent`), não disparando o runtime.

## O que um teste novo cobre

Uma mudança traz testes para o comportamento que ela adiciona e para o que ela muda, em cada camada que toca: a regra no pacote de domínio, a orquestração em `flow`, a conversão em `bindings`, a apresentação no `.ts` e a interação no componente. A cobertura é consequência disso, não o objetivo: um teste que existe só para cobrir linhas não diz nada quando quebra.
