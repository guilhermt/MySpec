# Testes

Os testes são o que permite mudar o produto com confiança. Uma feature está pronta quando os testes dela passam com `task check`, junto com todos os outros. A cobertura e os limiares são medidos por `task check:full`, que roda uma vez antes de abrir a pull request.

## Quando rodar

Três níveis, cada um no seu momento:

1. **Enquanto mexe em arquivos:** rode só os testes ligados aos arquivos alterados, `go test -run 'TestNome' ./internal/pacote/` para Go e `pnpm vitest run <arquivo>` a partir de `frontend/` para o frontend. Nunca a suíte inteira, nem com `go test ./...` nem com `pnpm test`.
2. **Ao verificar um step:** rode `task fmt` e depois `task check`, a verificação curta: tidy, lint, typecheck, os testes Go e web que a mudança alcança, vulnerabilidades e bindings, em uns 25 s. Ele passa por inteiro antes de um step estar pronto e antes de cada push numa PR já aberta.
3. **Antes de abrir a PR:** com todos os steps prontos, rode `task check:full` uma vez: todos os testes, com race, embaralhamento e cobertura com os limiares, em uns 3 min 30 s. A PR só abre com ele verde. Se falhar, corrija, rode `task check` e rode `task check:full` de novo antes de abrir.

O `task check:full` roda só nesse momento: nunca a cada step, nunca a cada push numa PR aberta, nunca em outro momento sem pedido explícito. `task test:full` e a cobertura avulsa só rodam quando pedidos. O CI roda só em pull request, uma verificação mínima ([ci.md](../development/ci.md)).

## Como rodar

| Comando | O que roda |
|---|---|
| `task test` | `test:go` e `test:web`, em segundos |
| `task test:go` | Os testes Go; um pacote que não mudou vem do cache de testes do Go |
| `task test:web` | Os testes do frontend que alcançam um arquivo mudado desde que a branch saiu de `main`; uma mudança na configuração do Vitest roda todos |
| `task test:full` | `test:go:full` e depois `test:web:full`, em sequência, para a execução nunca passar de `JOBS` núcleos; só quando pedido, e dentro do `task check:full` |
| `task test:go:full` | gotestsum com `-race -shuffle=on -count=1`, cobertura e o limiar de `.testcoverage.yml` |
| `task test:web:full` | Vitest com cobertura e os limiares de `vitest.config.ts` |
| `task test:go:ci` | Os testes Go sem race, de todo pacote menos a raiz, `internal/app` e `internal/bindings`, que importam o Wails; é o que o CI roda |
| `go test -run 'TestNome' ./internal/pacote/` | Um teste Go |
| `pnpm vitest run <arquivo>` (em `frontend/`) | Um arquivo de testes do frontend |
| `pnpm test:watch` (em `frontend/`) | Vitest interativo |

Um teste que passa só numa ordem ou só sem `-race` está errado. Na máquina, `task test:go` deixa o detector de corrida de fora, porque ele deixa a suíte três a quatro vezes mais lenta; o `task check:full` roda com ele. O embaralhamento e o `-count=1` ficam só em `task test:go:full`, porque fazem cada pacote rodar de novo mesmo sem mudança.

Cada ferramenta usa no máximo `JOBS` núcleos, 4 por padrão ou os que a máquina tiver se forem menos, e `MYSPEC_JOBS` muda o valor: `-p` do `go test`, `--maxWorkers` do Vitest e `--concurrency` do golangci-lint. Sem o limite, cada ferramenta toma todos os núcleos, e vários agentes rodando as verificações ao mesmo tempo disputam a máquina.

## Limiares

Go: 60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes. Frontend: 80% de linhas, funções e statements e 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`, medidos na suíte do frontend. Medidos por `task test:full`, dentro do `task check:full`.

## Testes em Go

### Forma

- Pacote externo: `package task_test`, testando pela API pública.
- `t.Parallel()` em todo teste. A exceção é o teste que confirma que nada acontece, que precisa de tempo passando sem concorrência.
- O nome é uma frase que diz o comportamento: `TestAFinishedPlanStartsTheFirstStepInItsWorktree`, `TestClosingATaskIsRefusedUntilTheMergeIsConfirmed`. Um teste testa um comportamento.
- Tabelas quando há casos paralelos da mesma regra, com `t.Run` e um nome por caso.
- `cmp.Diff` do `go-cmp` para comparar estruturas: `if diff := cmp.Diff(want, got); diff != "" { t.Errorf("... (-want +got):\n%s", diff) }`. `t.Fatalf` quando o resto do teste não faz sentido sem aquilo; `t.Errorf` para acumular.
- Espera ativa em vez de `time.Sleep`: um helper `waitX` que consulta o estado em intervalo curto com um timeout, chamando `t.Helper()`. Um `sleep` só no teste que prova a ausência de um evento. O ponto de sincronização de um teste é o último efeito que o código sob teste escreve (um marcador na conversa, uma mensagem gravada), nunca um estado que ele grava antes dele.
- A espera por um evento que uma tentativa real publica, como a startup do app, que abre o banco e roda as migrations, lê o canal sem prazo próprio: o tempo dela segue a carga da máquina e o `-race`, e o `-timeout` do `go test` é o que pega o evento que nunca chega.
- `t.Context()` para os contextos, `t.TempDir()` para o disco.

### Fixtures e helpers

Cada pacote tem um `helpers_test.go` com o que os testes dele compartilham: um `fixture` montado por `newFixture(t)`, dublês em memória das dependências (`memRepo`, `memTasks`), gravadores de chamadas e os `waitX`. O dublê implementa a interface que o pacote de produção declara, então a fixture diz exatamente o que o pacote precisa. Um `logCapture` captura o `slog` em JSON quando o teste verifica uma linha de log.

### Fakes de processos

Os pacotes que rodam binários testam contra o binário real ou contra um fake que é o próprio binário de teste reexecutado, declarado num `TestMain` de uma linha:

- `internal/claude/claudetest`: um CLI do Claude Code falso que fala stream-json. O teste escreve um roteiro do que o fake responde; `internal/claude/testdata/*.jsonl` são streams reais gravados.
- `internal/git/gittest`: constrói repositórios de verdade em diretórios temporários com o `git` real. O git não é dublado.
- `internal/gh/ghtest`: um `gh` falso que responde o que o teste escreveu, porque falar com o GitHub não é opção. É o binário reexecutado, não um script, porque escrever um executável enquanto outros testes fazem fork falha com "text file busy".
- `internal/platform/chime` e `internal/platform/dnd`: um player de áudio e um `omarchy-shell` falsos, o binário de teste reexecutado, declarados no `TestMain` do próprio pacote porque só ele os usa. O comportamento do fake (tocar, falhar, travar; responder `on`, `off`, falhar, travar) vem no argumento ou numa variável de ambiente.
- `internal/store`: a sonda do diretório de dados com um limite de tamanho de arquivo zero, o binário de teste reexecutado pelo `TestMain` do pacote, que baixa o limite só para ele. A escrita da sonda falha com `EFBIG`, no lugar do disco cheio, que um teste não consegue fazer.

`store.OpenMemory` abre um SQLite em memória com as migrations aplicadas, para os testes do `store` e de quem o usa.

## Testes no frontend

### Forma

- Vitest com Testing Library, `user-event` e jsdom, no pool `vmForks`: cada worker monta o jsdom uma vez e dá a cada arquivo um contexto de VM novo sobre ele, isolado como antes, em vez de montar o jsdom de novo para cada arquivo. `describe` com o nome do componente ou módulo, `it` com uma frase: `it("places the step in the plan, with its title and repository")`.
- Um arquivo de testes ao lado do que testa: `StepPane.test.tsx` ao lado de `StepPane.tsx`, `status.test.ts` ao lado de `status.ts`.
- A lógica de apresentação em `.ts` é testada como função pura, sem renderizar. Os componentes são testados pelo que o usuário vê e faz: `getByRole`, `getByText`, `user.click`, `user.type`. Consultar classes só para o que não tem outra forma de ser observado, como o tom de um ponto de status ou a centralização alinhada ao pixel, que o jsdom não calcula.
- Um texto longo entra por `user.paste`, depois de um `user.click` no campo; `user.type` fica para o que a tecla prova. Digitar centenas de caracteres um a um estoura o tempo sob carga. O que depende de um estado que React atualiza espera por `await waitFor` ou `findBy`, nunca logo depois do gesto.
- Um comportamento por `it`. Sem snapshots.
- `SettingsView.keys.test.tsx`, em `features/settings/`, prova o teclado de Settings, do início e das boas-vindas: um `it` por linha da tabela de teclas (`Ctrl+,`, `Esc`, as setas da navegação, `Enter`, `Ctrl+Enter`, `Ctrl+S`) e os focos iniciais e de destino de cada página e diálogo, desenhados pelas cenas de `src/test/settings-scenes.ts`.
- `where-actions-went.test.tsx`, em `features/task/`, `features/history/`, `features/board/`, `features/reviews/`, `features/discussion/` e `features/settings/`, prova que cada controle de uma tela redesenhada tem um lugar na tela nova: uma linha por controle e por estado em que ele aparecia, com o lugar novo e o nome acessível inteiro, e, em cada situação da barra, do painel, do cartão e dos diálogos, no máximo uma primária na camada de cima. O de Settings também confere que uma página de Settings não tem primária e que a edição de um prompt tem só **Save**, com `Ctrl S`.

### Regras do design

`styles/design-rules.test.ts` lê como texto todo `.ts`, `.tsx` e `.css` de `src/`, fora de `components/ui/`, `test/` e dos testes, e falha com uma cor literal ou da paleta do Tailwind, uma classe de cor do shadcn fora da ponte, um alias `--status-*`, um tamanho de texto do Tailwind e uma classe de movimento do Tailwind. Roda em todo `task check`, pelo `lint:web`. Uma regra nova entra com um caso em `each rule bites` que a viola e o equivalente do system que ela deixa passar.

### O que o jsdom não vê

O jsdom roda sem CSS: nenhum teste do frontend vê a cascata, o layout nem o pixel. A cor fica fechada na fonte pelas regras do design, e um teste no jsdom só consulta uma classe para o que não tem outra forma de ser observado. O que só o motor mostra se confere no app instalado ([target-machine.md](../development/target-machine.md)).

### Setup e dublês

`src/test/setup.ts` substitui o que não existe sob jsdom: o runtime do Wails, o Streamdown (reduzido ao texto), `ResizeObserver`, as animações do Base UI, e o `:focus-visible`, cuja heurística no jsdom guarda estado de um teste para o outro: o calço responde com a regra do navegador, visível depois de uma tecla e não depois do ponteiro nem de um foco programático, e é o que deixa o teste do tooltip provar que um foco invisível não o abre. Ele também substitui a fronteira com o Go: `lib/wails` é reexportado com o `api` e os `onX` de `src/test/wails-mock.ts` no lugar dos reais, e os helpers puros ficam reais.

- `renderWithStore(elemento, { state, ui })` de `src/test/render.tsx` renderiza com o store preenchido e devolve um `user` do user-event. `resetAppStore` faz o mesmo sem renderizar, para testar o store e as ações.
- `makeState`, `makeRepository`, `makeTask`, `makeStep`, `makePullRequest`, `makeSituation`, `makeTranscript`... de `wails-mock.ts` fabricam DTOs completos com valores plausíveis, aceitando `Partial` para o que o teste quer diferente. Um DTO novo ganha a sua fábrica.
- `largeBoardState` de `src/test/large-board.ts` (um board de 2.000 cards em dez status) dá o tamanho em que o board é janela: o teste das teclas do board o desenha.
- `api.x` é um `vi.fn` por função; o teste verifica a chamada com `expect(api.approveStep).toHaveBeenCalledWith(...)`. O mock é zerado depois de cada teste.
- Eventos do Go são simulados chamando as ações do store (`applyState`, `applyTranscriptEvent`), não disparando o runtime.
- Um item de menu que abre um diálogo entrega o foco a ele, e o menu não o toma de volta. O jsdom não toca a animação de saída do menu, então a devolução do foco viria antes de o diálogo abrir e nada a veria; `withMenuExitAnimation` de `src/test/menu-exit.ts` dá ao menu uma saída de 50 ms, e `menuGone` espera ele sair e o quadro seguinte, para o teste provar o foco no diálogo depois da devolução, como no app.

## O que um teste novo cobre

Uma mudança traz testes para o comportamento que ela adiciona e para o que ela muda, em cada camada que toca: a regra no pacote de domínio, a orquestração em `flow`, a conversão em `bindings`, a apresentação no `.ts` e a interação no componente. A cobertura é consequência disso, não o objetivo: um teste que existe só para cobrir linhas não diz nada quando quebra.
