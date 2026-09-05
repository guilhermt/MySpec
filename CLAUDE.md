# MySpec

MySpec é uma aplicação desktop que automatiza, centraliza e controla um workflow de desenvolvimento conduzido pelo Claude Code: PRD, tech spec, plano de tasks, implementação task a task, PR e encerramento. O produto é a camada de orquestração e experiência; a inteligência de cada sessão é o Claude Code.

## Documentos de referência

Leia estes documentos antes de qualquer planejamento ou implementação. Eles são a fonte de verdade do projeto.

- [WORKFLOW.md](./WORKFLOW.md): o workflow de desenvolvimento que o produto automatiza, descrito em detalhes, incluindo as skills `gm-prd`, `gm-tech-spec` e `gm-plan-tasks` e o ciclo de review e aprovação.
- [PRODUCT.md](./PRODUCT.md): a definição do produto. O que ele faz, como faz, que problema resolve, princípios, conceitos, ciclo de vida completo de uma feature, controles e requisitos de experiência.
- [STACK.md](./STACK.md): a stack técnica escolhida, com as razões de cada escolha e as alternativas descartadas.

## Planejamento

O planejamento de cada feature deste projeto fica em `planning/{feature-name}/`, com `PRD.md`, `tech-spec.md` e `tasks/`, produzidos pelas skills descritas em WORKFLOW.md.
