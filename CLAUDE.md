# MySpec

MySpec é uma aplicação desktop que conduz um workflow de desenvolvimento com o Claude Code: PRD, tech spec, plano de steps, implementação step a step, pull request, review de pull request e encerramento. O produto é a camada de orquestração e experiência; a inteligência de cada sessão é o Claude Code. Wails v3 com Go no backend, React com TypeScript na interface.

## Leia antes de planejar ou implementar

- [docs/guidelines/README.md](./docs/guidelines/README.md): como trabalhar neste repositório. O que ler, como uma mudança acontece, o que nunca fazer, commits. Com as convenções de [Go](./docs/guidelines/go.md), do [frontend](./docs/guidelines/frontend.md) e dos [testes](./docs/guidelines/testing.md).
- [docs/product/features.md](./docs/product/features.md): o que o produto faz, como ele é hoje.
- [docs/architecture/overview.md](./docs/architecture/overview.md): onde cada coisa está no código e como as partes se falam. Com [stack.md](./docs/architecture/stack.md), [sessions.md](./docs/architecture/sessions.md) e [storage.md](./docs/architecture/storage.md).

O índice completo está em [docs/README.md](./docs/README.md).

## Vocabulário

- **Task**: a unidade de trabalho que o produto conduz, de qualquer natureza: feature, bug fix, refatoração.
- **Step**: cada item ordenado dentro de uma task. Um step pertence a um único repositório e vira exatamente um commit.

## Convenções

- Interface do produto em inglês. Código, identificadores e commits em inglês. Documentação em português.
- `task check` passa por inteiro antes de uma mudança estar pronta: tidy, lint, typecheck, testes Go e web, vulnerabilidades e bindings.
- `frontend/src/components/ui` e `frontend/bindings` são gerados e nunca editados à mão. Mudou um service ou um DTO: `task generate`.

## Documentação

Todo trabalho no repositório atualiza a documentação em `docs/` quando o que ela descreve muda: uma feature nova ou um comportamento diferente entra em `docs/product/features.md`, uma decisão de arquitetura ou um pacote novo entra em `docs/architecture/`, uma convenção nova entra em `docs/guidelines/`, um comando ou uma variável nova entra em `docs/development/`. A documentação está sempre atualizada; uma mudança não está pronta enquanto a documentação a contradiz.

A documentação descreve o estado atual do projeto, de forma simples e clara. Ela nunca descreve a alteração: não diz o que mudou, o que era antes nem por que deixou de ser. Ao mudar algo, reescreva o trecho para que ele reflita o projeto como ele é agora, como se sempre tivesse sido assim. A razão de uma escolha é bem-vinda, no presente; o histórico não.
