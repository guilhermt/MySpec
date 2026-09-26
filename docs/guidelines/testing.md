# Testes

Os testes são o que permite mudar o produto com confiança, e os limiares de cobertura fazem o CI falhar quando uma mudança chega sem eles. Uma feature está pronta quando os testes dela passam com `task test`, junto com todos os outros.

## Como rodar

| Comando | O que roda |
|---|---|
| `task test` | Tudo: Go e frontend, com cobertura |
| `task test:go` | gotestsum com `-race -shuffle=on -count=1`, cobertura e o limiar de `.testcoverage.yml` |
| `task test:web` | Vitest: a suíte do jsdom com cobertura e os limiares de `vitest.config.ts`, depois a de estilo computado no Chromium |
| `go test -run 'TestNome' ./internal/pacote/` | Um teste Go |
| `pnpm vitest run <arquivo>` (em `frontend/`) | Um arquivo de testes do frontend |
| `pnpm test:watch` (em `frontend/`) | Vitest interativo, na suíte do jsdom |
| `pnpm test:painted` (em `frontend/`) | Só a suíte de estilo computado |

Os testes Go rodam com o detector de corrida e em ordem embaralhada. Um teste que passa só numa ordem ou só sem `-race` está errado.

## Limiares

Go: 60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes. Frontend: 80% de linhas, funções e statements e 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`, medidos só na suíte do jsdom. O CI comenta a cobertura e a diferença em relação a `main` em cada pull request.

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

### Estilo computado

O jsdom roda sem CSS, então um teste nele não vê a cascata: uma classe presente na lista pode perder para uma do primitivo de `components/ui/` ou para uma variante `dark:`. O que um componente pinta é provado por uma segunda suíte, os arquivos `*.painted.test.tsx`, que o Vitest roda no modo navegador, no Chromium do Playwright, com o CSS real (`styles/fonts.css` e `styles/globals.css`). O projeto `painted` de `vitest.config.ts` a define, e `src/test/painted-setup.ts` carrega o CSS, zera as transições (o teste lê o estado em que o controle assenta) e limpa o tema entre os testes. Os tipos dela são checados à parte, por `tsconfig.painted.json`, porque os matchers do modo navegador estreitariam os do jest-dom da suíte do jsdom.

- Vai para ela o teste de uma cor, de uma borda, de uma sombra, de um anel de foco ou de uma medida: todo estado de cor dos componentes de `components/system/`. O teste de comportamento e de acessibilidade continua no jsdom, e o do jsdom não consulta as classes de cor que esta suíte cobre.
- Cada arquivo roda os seus testes nos dois temas, `describe.each(THEMES)`, e `setTheme` põe o `data-theme` no `documentElement`, como o app.
- O estado vem de verdade: hover e foco pelo `userEvent` de `vitest/browser`, desabilitado, erro e carregando pelas props.
- O esperado é o token resolvido no mesmo tema: `token("--surface-input")` e `resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow")` passam o valor por um elemento de sonda no documento, que o devolve na mesma notação do `getComputedStyle`. `paintOf(elemento, esperado)` lê do elemento as mesmas entradas do esperado, e a comparação é `expect(paintOf(el, want)).toEqual(want)`; a sombra é lida sem as camadas vazias que o Tailwind compõe.
- A cobertura vem só do jsdom; a suíte de estilo computado prova a cascata, não linhas.

### Setup e dublês

`src/test/setup.ts` substitui o que não existe sob jsdom: o runtime do Wails, o Streamdown (reduzido ao texto), `ResizeObserver`, as animações do Base UI, e o `:focus-visible`, que no jsdom guarda estado de um teste para o outro e passa a seguir a regra do navegador (visível depois de uma tecla, não depois do ponteiro nem de um foco programático). Ele também substitui a fronteira com o Go: `lib/wails` é reexportado com o `api` e os `onX` de `src/test/wails-mock.ts` no lugar dos reais, e os helpers puros ficam reais.

- `renderWithStore(elemento, { state, ui })` de `src/test/render.tsx` renderiza com o store preenchido e devolve um `user` do user-event. `resetAppStore` faz o mesmo sem renderizar, para testar o store e as ações.
- `makeState`, `makeRepository`, `makeTask`, `makeStep`, `makePullRequest`, `makeSituation`, `makeTranscript`... de `wails-mock.ts` fabricam DTOs completos com valores plausíveis, aceitando `Partial` para o que o teste quer diferente. Um DTO novo ganha a sua fábrica.
- `api.x` é um `vi.fn` por função; o teste verifica a chamada com `expect(api.approveStep).toHaveBeenCalledWith(...)`. O mock é zerado depois de cada teste.
- Eventos do Go são simulados chamando as ações do store (`applyState`, `applyTranscriptEvent`), não disparando o runtime.

## O que um teste novo cobre

Uma mudança traz testes para o comportamento que ela adiciona e para o que ela muda, em cada camada que toca: a regra no pacote de domínio, a orquestração em `flow`, a conversão em `bindings`, a apresentação no `.ts` e a interação no componente. A cobertura é consequência disso, não o objetivo: um teste que existe só para cobrir linhas não diz nada quando quebra.
