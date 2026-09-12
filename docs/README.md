# Documentação do MySpec

A documentação é escrita em português; a interface, o código, os identificadores e os commits são em inglês.

## Produto

- [overview.md](./product/overview.md): o que o MySpec é, os princípios e os conceitos, e o vocabulário usado em todo o projeto.
- [features.md](./product/features.md): o produto como ele é, na ordem do ciclo de vida de uma task: área de trabalho, criação, etapas de planejamento, implementação com worktrees e review, pull request e review de pull request, encerramento, histórico, sessões, atenção e notificações, modelos, prompts, configurações e atalhos.

## Arquitetura

- [stack.md](./architecture/stack.md): a stack e a razão de cada escolha.
- [overview.md](./architecture/overview.md): a organização do código, as camadas do Go, a fronteira com o frontend, os eventos e o fluxo de estado.
- [sessions.md](./architecture/sessions.md): o processo do Claude Code por trás de cada sessão: flags, protocolo, ciclo de vida, prompts e correções.
- [storage.md](./architecture/storage.md): o diretório de dados, o banco e as migrations, os artefatos, as worktrees e o log.

## Guidelines

- [README.md](./guidelines/README.md): como trabalhar neste repositório: o que ler, como uma mudança acontece, o que nunca fazer, commits e pull requests.
- [go.md](./guidelines/go.md): as convenções do código Go.
- [frontend.md](./guidelines/frontend.md): as convenções do frontend.
- [testing.md](./guidelines/testing.md): como os testes são escritos e rodados nas duas linguagens, os fakes e os limiares.

## Desenvolvimento

- [setup.md](./development/setup.md): pré-requisitos, setup, comandos, instalação, VS Code e variáveis de ambiente.
- [ci.md](./development/ci.md): o pipeline, a cobertura nas pull requests e o Dependabot.
- [troubleshooting.md](./development/troubleshooting.md): o log, o que cada linha significa e os problemas conhecidos.
- [target-machine.md](./development/target-machine.md): as verificações feitas na máquina alvo e os comportamentos do Wails que exigiram contorno.
