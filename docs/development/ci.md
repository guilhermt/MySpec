# Verificações e integração contínua

As verificações rodam em três lugares, cada um no seu momento ([guidelines](../guidelines/README.md), passo 5).

| Onde | Quando | O que roda | Tempo |
|---|---|---|---|
| `task check` | Ao verificar um step e antes de cada push numa PR aberta | tidy, lint Go e web (Biome, as regras do design, o `knip`), typecheck, os testes Go (os que não mudaram vêm do cache), os testes do frontend que a branch alcança, `govulncheck` e a checagem dos bindings, com `nice` | uns 25 s numa branch sem mudança; uns 1 min 30 s com uma mudança em `src/test/setup.ts`, que leva à suíte inteira do frontend |
| `task check:full` | Uma vez, antes de abrir a PR | O mesmo, com `test:full` no lugar de `test`: todos os testes Go com race, embaralhamento e `-count=1`, e a suíte do frontend inteira, os dois com cobertura e os limiares, um depois do outro | uns 3 min 30 s |
| CI (`.github/workflows/ci.yml`) | Em cada pull request: na abertura e em cada push | tidy, lint web, typecheck, lint Go e testes Go sem race, sem a raiz, `internal/app` e `internal/bindings` | ~3 min |
| Release (`.github/workflows/release.yml`) | Em cada push de tag `v*`, que `task release` faz | as conferências da tag, `task package` no Ubuntu 24.04 e a publicação da release ([release.md](./release.md)) | poucos minutos |

## CI

Um workflow, um job, `Check`. Os passos, na ordem: `pnpm install --frozen-lockfile`, `task tidy:check`, `task lint:web`, `task typecheck`, `task lint:go:ci` e `task test:go:ci`. Dispara só em `pull_request`, e um push novo cancela a execução em andamento da mesma PR. Nada roda em push na `main` nem por agenda. O repositório só usa `main`; não há branch `dev`.

O CI é mínimo porque o repositório é privado, no plano free do GitHub Actions: o runner tem 2 vCPUs e 8 GB e cada job é cobrado em minutos inteiros. O job não instala GTK, WebKit nem navegador. Os três pacotes que importam o Wails (a raiz, `internal/app` e `internal/bindings`) precisam dos headers do GTK e do WebKit para compilar, então o lint e os testes Go do CI deixam esses três de fora, por `task lint:go:ci` e `task test:go:ci`. Os demais compilam sem nenhuma biblioteca de sistema.

A toolchain vem de `mise.toml` pelo `jdx/mise-action`, só com as ferramentas que o job usa, o que mantém o CI e a máquina nas mesmas versões. O store do pnpm, os módulos e o build do Go e o cache do golangci-lint ficam em cache, com a chave no lockfile e no `go.sum`.

## Onde fica cada garantia

O que o CI não roda e onde roda:

- a suíte do frontend: `task check`, só o que a branch alcança, e `task check:full`, inteira e com cobertura;
- o detector de corrida, o embaralhamento e a cobertura: `task check:full`;
- `govulncheck` e a checagem dos bindings: `task check` e `task check:full`;
- o lint e os testes da raiz, de `internal/app` e de `internal/bindings`: `task check` e `task check:full`.

O build do binário roda no workflow de release, a cada tag, e à mão com `task build`, `task install` e `task package`.

## Limiares

`.testcoverage.yml` para o Go (60% por arquivo, 70% por pacote, 80% no total, excluindo `internal/app`, `main.go` e os pacotes de fakes) e `frontend/vitest.config.ts` para o frontend (80% de linhas, funções e statements, 70% de branches, excluindo `components/ui`, `test/` e `main.tsx`), medidos por `task check:full`.

## Dependabot

`.github/dependabot.yml` observa os módulos Go, os pacotes npm do frontend e as próprias actions, semanalmente, com atualizações minor e patch agrupadas numa pull request por ecossistema. Uma PR do Dependabot passa só pelo CI; nenhuma verificação local é exigida dela.

## Notas

- As actions são pinadas na major atual (`checkout@v7`, `mise-action@v4`, `cache@v6`).
- Nada roda na `main` depois do merge.
