# Integração contínua

`.github/workflows/ci.yml` roda a cada push em `main` e a cada pull request para `main`. O repositório só usa `main`; não há branch `dev`. Uma execução nova no mesmo ref cancela a anterior.

## Jobs

| Job | O que roda |
|---|---|
| `Frontend` | `pnpm install --frozen-lockfile`, `task lint:web`, `pnpm typecheck`, `pnpm test:coverage`, a instalação do Chromium do Playwright e `pnpm test:painted` |
| `Go` | `task tidy:check`, `task lint:go`, `task vuln`, `task test:go` |
| `Build` | `task bindings:check` e `task build`, depois de os outros dois passarem |

Juntos cobrem o mesmo terreno que `task check`, então um `task check` verde na máquina é o melhor preditor de um pipeline verde.

A toolchain vem de `mise.toml` pelo `jdx/mise-action`, o que mantém o CI e a máquina nas mesmas versões. Os jobs `Go` e `Build` instalam `libgtk-4-dev` e `libwebkitgtk-6.0-dev`, que o cgo precisa e a imagem do runner não traz; o `Frontend` instala o Chromium do Playwright com as bibliotecas de sistema dele, para a suíte de estilo computado, com o `~/.cache/ms-playwright` em cache pela versão do `playwright`. O store do pnpm, o cache de módulos e o cache de build do Go são preservados entre execuções.

## Cobertura nas pull requests

Os dois jobs de teste comentam a cobertura na pull request:

- `vitest-coverage-report-action` posta o resumo do frontend.
- `go-coverage-report` compara o `coverage/go.out` da execução com o artefato da última execução bem-sucedida em `main` e posta a diferença. O artefato é enviado em toda execução, `main` incluída, o que dá às pull requests seguintes uma base de comparação.

Nenhuma das duas actions aceita texto extra, então `.github/scripts/coverage_comment.py` acrescenta a cada comentário uma linha com o resumo da execução dos testes, lendo o JSON do Vitest e o JUnit do gotestsum, e a substitui em vez de empilhar numa segunda execução.

Os limiares que fazem os testes falharem estão em `.testcoverage.yml` para o Go (60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes) e em `frontend/vitest.config.ts` para o frontend (80% de linhas, funções e statements, 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`), medidos só na suíte do jsdom.

O job `Build` envia o binário como `myspec-linux-amd64`, guardado por sete dias.

## Dependabot

`.github/dependabot.yml` observa os módulos Go, os pacotes npm do frontend e as próprias actions, semanalmente, com atualizações minor e patch agrupadas numa pull request por ecossistema.

## Notas

- As actions são pinadas na major atual (`checkout@v7`, `mise-action@v4`, `cache@v6`, `upload-artifact@v7`).
- `go-coverage-report` é pinado em `v1.3.1`, porque o repositório dele não publica uma tag de major móvel e `@v1` não resolve.
- `go-coverage-report` recebe `root-package` explícito, porque o padrão seria `github.com/<owner>/<repo>` com o nome do repositório no GitHub, e o módulo é `github.com/guilhermt/myspec`.
