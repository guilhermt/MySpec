# Documentação do MySpec

A documentação é escrita em português; a interface, o código, os identificadores e os commits são em inglês.

## Produto

- [overview.md](./product/overview.md): o que o MySpec é, os princípios e os conceitos, e o vocabulário usado em todo o projeto.
- [features.md](./product/features.md): o produto como ele é, na ordem do ciclo de vida de uma task: repositórios cadastrados, criação e os dois modos, Structured e One-Shot, etapas de planejamento de cada modo, implementação com worktrees e review, pull request e review de pull request, encerramento, histórico, sessões, atenção e notificações, modelos, prompts, configurações e atalhos.

## Arquitetura

- [stack.md](./architecture/stack.md): a stack e a razão de cada escolha.
- [overview.md](./architecture/overview.md): a organização do código, as camadas do Go, a fronteira com o frontend, os eventos e o fluxo de estado.
- [design-system.md](./architecture/design-system.md): os tokens, o tema, a ponte com o shadcn, as fontes, as regras do WebKitGTK e os componentes de components/system/.
- [sessions.md](./architecture/sessions.md): o processo do Claude Code por trás de cada sessão: flags, protocolo, ciclo de vida, prompts e correções.
- [storage.md](./architecture/storage.md): o diretório de dados, o banco e as migrations, os artefatos, as worktrees e o log.

## Design

- [README.md](./design/README.md): a identidade visual do MySpec e como usar esta pasta antes de criar ou mudar uma tela.
- [principles.md](./design/principles.md): os dez princípios que toda tela segue.
- [structure.md](./design/structure.md): a navegação, a barra lateral, o item aberto, os outros lugares, os atalhos, as larguras e os estados de toda tela.
- [components.md](./design/components.md): o catálogo dos componentes, com anatomia, estados, tokens, teclado e acessibilidade.

## Guidelines

- [README.md](./guidelines/README.md): como trabalhar neste repositório: o que ler, como uma mudança acontece, o que nunca fazer, commits e pull requests.
- [go.md](./guidelines/go.md): as convenções do código Go.
- [frontend.md](./guidelines/frontend.md): as convenções do frontend.
- [testing.md](./guidelines/testing.md): como os testes são escritos e rodados nas duas linguagens, os fakes e os limiares.

## Roadmap

- [README.md](./roadmap/README.md): as ideias de evolução do produto, uma pasta por ideia. A única parte da documentação que descreve o que o produto ainda não é.

## Desenvolvimento

- [setup.md](./development/setup.md): pré-requisitos, setup, comandos, instalação, VS Code e variáveis de ambiente.
- [ci.md](./development/ci.md): o que roda onde (`task check`, `task check:full` e o CI), quando e quanto leva, onde fica cada garantia e o Dependabot.
- [troubleshooting.md](./development/troubleshooting.md): o log, o que cada linha significa e os problemas conhecidos.
- [target-machine.md](./development/target-machine.md): o que vale na máquina alvo: o WebKitGTK, as fontes, a rolagem das listas em janela, o início, as notificações e os comportamentos do Wails que exigiram contorno.
