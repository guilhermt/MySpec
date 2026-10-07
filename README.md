# MySpec

Aplicação desktop que conduz um workflow de desenvolvimento com o Claude Code: a discussão de uma demanda de um board, que produz os cards dele, e então PRD, tech spec, plano de steps, implementação step a step, pull request, review de pull request e encerramento. O Claude Code é a inteligência de cada sessão; o MySpec inicia cada sessão no momento e no lugar certos, guarda os artefatos, sabe em que ponto cada task está, mostra o que espera pelo usuário e permite várias tasks em andamento ao mesmo tempo, numa única janela.

Wails v3 com Go no backend, React com TypeScript na interface, Linux.

## Instalar

Os sistemas suportados são Arch, com ou sem Omarchy, e Pop!_OS 24.04, em `amd64`. O app precisa de duas bibliotecas de sistema, GTK 4 e WebKitGTK 6.0:

```sh
sudo pacman -S gtk4 webkitgtk-6.0                 # Arch
sudo apt install libgtk-4-1 libwebkitgtk-6.0-4    # Ubuntu e Pop!_OS
```

Então, um único comando instala o MySpec:

```sh
curl -fsSL https://raw.githubusercontent.com/guilhermt/MySpec/main/install.sh | sh
```

O mesmo comando atualiza para a última release, sem tocar nos dados do app, e não usa `sudo`. Se faltar uma biblioteca, ele diz qual e como instalá-la.

O app também precisa do Claude Code (`claude`) instalado e logado, do `gh` instalado e logado e do `git` com acesso aos repositórios. O script lista os que não encontrou.

## Começar

Para desenvolver, com `gtk4`, `webkitgtk-6.0`, [mise](https://mise.jdx.dev), `git`, `gh` e o `claude` logado na máquina:

```sh
mise install
task setup
task dev        # roda em desenvolvimento
task install    # ou instala para o usuário atual
```

`task check` roda tudo que o CI roda. Antes de abrir uma pull request, `task check:full` roda uma vez ([ci.md](./docs/development/ci.md)). Os pré-requisitos completos, os comandos e as variáveis de ambiente estão em [docs/development/setup.md](./docs/development/setup.md).

## Documentação

O índice está em [docs/README.md](./docs/README.md).

- [O que o produto faz](./docs/product/features.md) e os [princípios e conceitos](./docs/product/overview.md) por trás dele.
- [Stack](./docs/architecture/stack.md), [organização do código](./docs/architecture/overview.md), [sessões com o Claude Code](./docs/architecture/sessions.md) e [armazenamento](./docs/architecture/storage.md).
- [Guidelines](./docs/guidelines/README.md) para trabalhar no código, com as convenções de [Go](./docs/guidelines/go.md), do [frontend](./docs/guidelines/frontend.md) e dos [testes](./docs/guidelines/testing.md).
- [Ambiente](./docs/development/setup.md), [CI](./docs/development/ci.md), [releases](./docs/development/release.md), [diagnóstico](./docs/development/troubleshooting.md) e as [notas da máquina alvo](./docs/development/target-machine.md).
