# Integração contínua

`.github/workflows/ci.yml` roda a cada pull request para `main` e a cada push em `main`. O repositório só usa `main`; não há branch `dev`. Uma execução nova no mesmo ref cancela a anterior.

O runner de um repositório privado tem 2 vCPUs e 8 GB, e cada job é cobrado em minutos inteiros, arredondados para cima. Por isso o workflow roda só o que uma mudança alcança, e os três jobs rodam lado a lado.

## Jobs

| Job | O que roda | Quando |
|---|---|---|
| `Changes` | `dorny/paths-filter`, que diz quais áreas a pull request toca | Pull request |
| `Frontend` | `pnpm install --frozen-lockfile`, `task lint:web`, `pnpm typecheck`, `pnpm test:coverage`, a instalação do Chromium do Playwright e `pnpm test:painted` | Pull request que toca o frontend |
| `Go` | `task tidy:check`, `task lint:go`, `task vuln`, `task test:go` | Pull request que toca o Go; todo push em `main` |
| `Build` | `task bindings:check` e `task build` | Pull request que toca o frontend, o Go ou `build/` |

As áreas são estas: o frontend é `frontend/**` e `biome.json`; o Go é `*.go`, `go.mod`, `go.sum`, `internal/**`, `.golangci.yml` e `.testcoverage.yml`; `Taskfile.yml`, `mise.toml`, o workflow e `.github/scripts/` contam para os dois. Uma pull request só de documentação ou de `design/` roda só `Changes`. O filtro fica num job, e não em `on.paths`, para que cada job sempre reporte um status: um job pulado pelo `if` conta como aprovado, e um workflow que não roda deixa o check pendente.

Em `main` roda só o `Go`, que produz a base de comparação da cobertura; o frontend e o build de um merge já foram provados na pull request.

Juntos, numa pull request que toca tudo, cobrem o mesmo terreno que `task check`, então um `task check` verde na máquina é o melhor preditor de um pipeline verde.

A toolchain vem de `mise.toml` pelo `jdx/mise-action`, o que mantém o CI e a máquina nas mesmas versões. Os jobs `Go` e `Build` instalam `libgtk-4-dev` e `libwebkitgtk-6.0-dev`, que o cgo precisa e a imagem do runner não traz; o `Frontend` instala o Chromium do Playwright com as bibliotecas de sistema dele, para a suíte de estilo computado, com o `~/.cache/ms-playwright` em cache pela versão do `playwright`. O store do pnpm e o cache de módulos e de build do Go são preservados entre execuções. O cache do Go é gravado só em `main`, com o commit na chave, porque uma chave de cache nunca é reescrita: toda execução parte dos módulos e do cache de build do último `main`, e as pull requests só o leem.

## Cobertura nas pull requests

Os dois jobs de teste comentam a cobertura na pull request:

- `vitest-coverage-report-action` posta o resumo do frontend.
- `go-coverage-report` compara o `coverage/go.out` da execução com o artefato da última execução bem-sucedida em `main` e posta a diferença. O artefato é enviado em toda execução do `Go`, e o `Go` roda em todo push em `main`, o que dá às pull requests seguintes uma base de comparação.

Nenhuma das duas actions aceita texto extra, então `.github/scripts/coverage_comment.py` acrescenta a cada comentário uma linha com o resumo da execução dos testes, lendo o JSON do Vitest e o JUnit do gotestsum, e a substitui em vez de empilhar numa segunda execução.

Os limiares que fazem os testes falharem estão em `.testcoverage.yml` para o Go (60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes) e em `frontend/vitest.config.ts` para o frontend (80% de linhas, funções e statements, 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`), medidos só na suíte do jsdom.

O job `Build` envia o binário como `myspec-linux-amd64`, guardado por sete dias.

## Dependabot

`.github/dependabot.yml` observa os módulos Go, os pacotes npm do frontend e as próprias actions, semanalmente, com atualizações minor e patch agrupadas numa pull request por ecossistema.

## Notas

- As actions são pinadas na major atual (`checkout@v7`, `mise-action@v4`, `cache@v6`, `upload-artifact@v7`).
- `go-coverage-report` é pinado em `v1.3.1`, porque o repositório dele não publica uma tag de major móvel e `@v1` não resolve.
- `go-coverage-report` recebe `root-package` explícito, porque o padrão seria `github.com/<owner>/<repo>` com o nome do repositório no GitHub, e o módulo é `github.com/guilhermt/myspec`.
