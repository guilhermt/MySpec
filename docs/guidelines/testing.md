# Testes

Os testes são o que permite mudar o produto com confiança, e os limiares de cobertura fazem o CI falhar quando uma mudança chega sem eles. Uma feature está pronta quando os testes dela passam com `task test`, junto com todos os outros.

## Como rodar

| Comando | O que roda |
|---|---|
| `task test` | Tudo: Go e frontend, com cobertura |
| `task test:go` | gotestsum com `-race -shuffle=on -count=1`, cobertura e o limiar de `.testcoverage.yml` |
| `task test:web` | Vitest com cobertura e os limiares de `vitest.config.ts` |
| `go test -run 'TestNome' ./internal/pacote/` | Um teste Go |
| `pnpm vitest run <arquivo>` (em `frontend/`) | Um arquivo de testes do frontend |
| `pnpm test:watch` (em `frontend/`) | Vitest interativo |

Os testes Go rodam com o detector de corrida e em ordem embaralhada. Um teste que passa só numa ordem ou só sem `-race` está errado.

## Limiares

Go: 60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes. Frontend: 80% de linhas, funções e statements e 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`. O CI comenta a cobertura e a diferença em relação a `main` em cada pull request.

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

- Vitest com Testing Library, `user-event` e jsdom. `describe` com o nome do componente ou módulo, `it` com uma frase: `it("places the step in the plan, with its title and repository")`.
- Um arquivo de testes ao lado do que testa: `StepBar.test.tsx` ao lado de `StepBar.tsx`, `status.test.ts` ao lado de `status.ts`.
- A lógica de apresentação em `.ts` é testada como função pura, sem renderizar. Os componentes são testados pelo que o usuário vê e faz: `getByRole`, `getByText`, `user.click`, `user.type`. Consultar classes só para o que não tem outra forma de ser observado, como o tom de um ponto de status ou a centralização alinhada ao pixel, que o jsdom não calcula.
- Um comportamento por `it`. Sem snapshots.

### Setup e dublês

`src/test/setup.ts` substitui o que não existe sob jsdom: o runtime do Wails, o Streamdown (reduzido ao texto), `ResizeObserver`, as animações do Base UI. Ele também substitui a fronteira com o Go: `lib/wails` é reexportado com o `api` e os `onX` de `src/test/wails-mock.ts` no lugar dos reais, e os helpers puros ficam reais.

- `renderWithStore(elemento, { state, ui })` de `src/test/render.tsx` renderiza com o store preenchido e devolve um `user` do user-event. `resetAppStore` faz o mesmo sem renderizar, para testar o store e as ações.
- `makeState`, `makeRepository`, `makeTask`, `makeStep`, `makePullRequest`, `makeSituation`, `makeTranscript`... de `wails-mock.ts` fabricam DTOs completos com valores plausíveis, aceitando `Partial` para o que o teste quer diferente. Um DTO novo ganha a sua fábrica.
- `api.x` é um `vi.fn` por função; o teste verifica a chamada com `expect(api.approveStep).toHaveBeenCalledWith(...)`. O mock é zerado depois de cada teste.
- Eventos do Go são simulados chamando as ações do store (`applyState`, `applyTranscriptEvent`), não disparando o runtime.

## O que um teste novo cobre

Uma mudança traz testes para o comportamento que ela adiciona e para o que ela muda, em cada camada que toca: a regra no pacote de domínio, a orquestração em `flow`, a conversão em `bindings`, a apresentação no `.ts` e a interação no componente. A cobertura é consequência disso, não o objetivo: um teste que existe só para cobrir linhas não diz nada quando quebra.
