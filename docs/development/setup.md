# Ambiente de desenvolvimento

## Pré-requisitos

Cinco coisas são instaladas à mão; tudo o mais vem delas.

1. **Pacotes do sistema.** As dependências de build do Wails no Linux e a toolchain C que o cgo precisa:

   ```sh
   sudo pacman -S --needed gtk4 webkitgtk-6.0 base-devel pkgconf
   ```

   Em Debian e Ubuntu os equivalentes são `libgtk-4-dev`, `libwebkitgtk-6.0-dev`, `build-essential` e `pkg-config`, que é o que o CI instala.

2. **[mise](https://mise.jdx.dev).** Com `mise activate` no shell, entrar na pasta do projeto ativa as versões pinadas em `mise.toml`: Go, Node, pnpm, Task, golangci-lint, gotestsum, lefthook, Biome, govulncheck e go-test-coverage. O CI instala o mesmo arquivo, então máquina e pipeline rodam as mesmas versões.

3. **Claude Code.** O `claude` no `PATH` ou em `~/.local/bin`, logado uma vez com `claude` num terminal. `MYSPEC_CLAUDE_PATH` fixa outro caminho.

4. **git, gh e VS Code.** `git` no `PATH`, capaz de alcançar o `origin` dos repositórios sem pedir senha: o app roda com `GIT_TERMINAL_PROMPT=0`, e um fetch que peça senha falha em vez de pendurar. `gh` autenticado, para a etapa de PR. `code` no `PATH` é o que **Abrir no VS Code** roda; sem ele o app avisa e o resto funciona.

5. **Um player de áudio.** `pw-play` (PipeWire), `paplay` (PulseAudio) ou `aplay` (alsa-utils) no `PATH`, para o som das notificações. Um desktop com PipeWire ou PulseAudio já traz um deles. Sem nenhum, as notificações aparecem mudas e o log diz por quê.

## Setup

```sh
mise install   # instala o Task e o resto da toolchain pinada
task setup
```

A suíte de estilo computado do frontend roda no Chromium do Playwright, que o `pnpm install` não baixa. Uma vez por máquina, e de novo quando o `playwright` do `package.json` muda de versão:

```sh
cd frontend && pnpm exec playwright install --only-shell chromium
```

`mise install` vem primeiro porque o próprio `task` é uma das ferramentas pinadas. `task setup` roda `mise install` de novo, instala o CLI `wails3` declarado no `go.mod` com `go install tool`, baixa os módulos Go, instala as dependências do frontend com pnpm e instala os hooks do git. Rodar duas vezes é inofensivo; é o comando que mantém um clone atualizado.

O hook, definido em `lefthook.yml`, é de pre-commit e só formata: Biome nos arquivos do frontend em stage e `golangci-lint fmt` nos arquivos Go em stage, colocando de volta em stage o que corrigiu. Lint, typecheck e testes ficam para `task check` e para o CI, para que um commit nunca seja travado por uma verificação lenta.

## Comandos

| Comando | O que faz |
|---|---|
| `task setup` | Prepara um clone: ferramentas, dependências, hooks |
| `task dev` | Roda o app em modo de desenvolvimento, com HMR do Vite |
| `task build` | Build de produção em `bin/myspec` |
| `task run` | Roda `bin/myspec` |
| `task generate` | Regenera `frontend/bindings` a partir dos services Go |
| `task fmt` | Formata Go e frontend |
| `task lint` | `lint:go` (golangci-lint) e `lint:web` (Biome) |
| `task typecheck` | `tsc --noEmit` no frontend |
| `task test` | `test:go` (gotestsum, race, shuffle, limiar de cobertura) e `test:web` (a suíte do Vitest no jsdom, com cobertura, e a de estilo computado no Chromium) |
| `task vuln` | `govulncheck ./...` |
| `task tidy:check` | Falha quando `go.mod` e `go.sum` não estão tidy |
| `task bindings:check` | Falha quando `frontend/bindings` está desatualizado |
| `task check` | Tudo que o CI roda, em ordem |
| `task install` | Instala o app para o usuário atual |
| `task uninstall` | Remove o que `install` colocou; nunca toca os dados do app |

`main.go` embute `frontend/dist`, que é saída de build e não existe num clone limpo, e `//go:embed` recusa um diretório vazio. As tarefas Go colocam um placeholder lá quando não encontram nada, então `task check` funciona antes do primeiro `task build`, e um build real o substitui.

O som das notificações, `internal/platform/chime/chime.wav`, é versionado e gerado por `go generate ./internal/platform/chime/`, que roda `gen.go`. Só precisa rodar de novo quando o gerador muda.

Um teste só, em Go: `go test -run 'TestNome' ./internal/pacote/`. No frontend: `pnpm vitest run src/features/task/StepBar.test.tsx`, a partir de `frontend/`, ou `pnpm test:watch` para o modo interativo da suíte do jsdom. `pnpm test:painted` roda só a suíte de estilo computado, e `pnpm vitest run src/components/system/Input.painted.test.tsx`, um arquivo dela.

## Instalação

`task install` faz o build e escreve, sob `$HOME`:

- `.local/bin/myspec`
- `.local/share/applications/org.wails.myspec.desktop`
- `.local/share/icons/hicolor/scalable/apps/org.wails.myspec.svg`
- `.local/share/icons/hicolor/512x512/apps/org.wails.myspec.png`

`task uninstall` remove exatamente esses quatro arquivos. O diretório de dados nunca é tocado.

## VS Code

Abrir a pasta normalmente; não há arquivo de workspace. `.vscode/settings.json` faz do Biome o formatador padrão dos tipos de arquivo que ele cuida, para não competir com um Prettier instalado para outros projetos, e aponta o Go para o gopls com o mesmo gofumpt e agrupamento de imports que `task fmt:go` aplica. `.vscode/extensions.json` recomenda as extensões de que essas configurações dependem (Biome, Go, TOML, YAML) e marca Prettier e ESLint como indesejadas aqui.

## Variáveis de ambiente

| Variável | Efeito |
|---|---|
| `MYSPEC_CLAUDE_PATH` | Caminho do binário `claude` |
| `MYSPEC_LOG_LEVEL` | `debug`, `info` (padrão), `warn` ou `error` |
| `WAILS_VITE_PORT` | Porta do Vite em `task dev` (padrão 9245) |
