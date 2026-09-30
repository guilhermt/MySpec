# Integração contínua

Dois workflows. `.github/workflows/ci.yml` é a verificação de todo dia: roda a cada pull request para `main` e a cada push em `main`, e uma execução nova no mesmo ref cancela a anterior. `.github/workflows/full.yml` é a verificação completa, com cobertura: roda toda segunda-feira e sob demanda, pelo **Run workflow** da aba Actions. O repositório só usa `main`; não há branch `dev`.

Os jobs rodam num runner self-hosted, pelo rótulo `laptop` (`runs-on: laptop`). O `ci.yml` roda só o que uma mudança alcança, sem cobertura, e os jobs rodam lado a lado.

## Verificação de todo dia

| Job | O que roda | Quando |
|---|---|---|
| `Changes` | `dorny/paths-filter`, que diz quais áreas a pull request toca | Pull request |
| `Frontend` | `pnpm install --frozen-lockfile`, `task lint:web`, `pnpm typecheck`, a instalação do Chromium do Playwright e `pnpm test`, as duas suítes inteiras, sem cobertura | Pull request que toca o frontend |
| `Go` | `task tidy:check`, `task lint:go`, `task vuln`, `task bindings:check` e `task test:go -- -race` | Pull request que toca o Go; todo push em `main` |
| `Build` | `task build`, que envia o binário como `myspec-linux-amd64`, guardado por sete dias | Pull request que toca `build/`, as dependências do Go ou do frontend, ou `vite.config.ts` |

O frontend é `frontend/**` e `biome.json`; o Go é `*.go`, `go.mod`, `go.sum`, `internal/**` e `.golangci.yml`; `Taskfile.yml`, `mise.toml` e o workflow contam para todas as áreas. Uma pull request só de documentação ou de `design/` roda só `Changes`. O filtro fica num job, e não em `on.paths`, para que cada job sempre reporte um status: um job pulado pelo `if` conta como aprovado, e um workflow que não roda deixa o check pendente.

O frontend roda as suítes inteiras, e não só o que a mudança alcança como `task check` faz na máquina, porque o `--changed` do Vitest não segue imports dinâmicos nem o CSS. O Go roda com o detector de corrida e sai barato mesmo assim: o push em `main` grava o cache do Go com os resultados dos testes, e numa pull request um pacote que ela não alcança vem desse cache.

A toolchain vem de `mise.toml` pelo `jdx/mise-action`, o que mantém o CI e a máquina nas mesmas versões. O cgo precisa das bibliotecas do GTK 4 e do WebKitGTK 6, e o Chromium do Playwright, das bibliotecas de sistema dele. O runner `laptop` já as tem, e instalá-las pediria `sudo`, que um job não tem ali; por isso os passos que as instalam (`apt-get` de `libgtk-4-dev` e `libwebkitgtk-6.0-dev` nos jobs `Go` e `Build`, e o `--with-deps` do Playwright no `Frontend`) só rodam num runner hospedado pelo GitHub (`runner.environment == 'github-hosted'`). O `wails3` vem por `go install tool`, e o `Frontend` baixa o Chromium do Playwright, com o `~/.cache/ms-playwright` em cache pela versão do `playwright`. O store do pnpm e o cache de módulos e de build do Go são preservados entre execuções. O do Go é gravado só em `main`, com o commit na chave, porque uma chave de cache nunca é reescrita: toda execução parte do cache do último `main`.

## Verificação completa

Um job só roda `task check:full`, com o detector de corrida, o embaralhamento, a cobertura e os limiares, e as duas suítes do frontend inteiras, e depois `task build`. É onde a cobertura é medida: os limiares estão em `.testcoverage.yml` para o Go (60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes) e em `frontend/vitest.config.ts` para o frontend (80% de linhas, funções e statements, 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`), medidos só na suíte do jsdom.

## Dependabot

`.github/dependabot.yml` observa os módulos Go, os pacotes npm do frontend e as próprias actions, semanalmente, com atualizações minor e patch agrupadas numa pull request por ecossistema.

## Notas

- As actions são pinadas na major atual (`checkout@v7`, `mise-action@v4`, `cache@v6`, `upload-artifact@v7`, `paths-filter@v4`).
