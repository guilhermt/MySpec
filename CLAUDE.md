# MySpec

MySpec é uma aplicação desktop que automatiza, centraliza e controla um workflow de desenvolvimento conduzido pelo Claude Code: PRD, tech spec, plano de steps, implementação step a step, PR e encerramento. O produto é a camada de orquestração e experiência; a inteligência de cada sessão é o Claude Code.

## Documentos de referência

Leia estes documentos antes de qualquer planejamento ou implementação. Eles são a fonte de verdade do projeto.

- [WORKFLOW.md](./WORKFLOW.md): o workflow de desenvolvimento que o produto automatiza, descrito em detalhes, incluindo as skills `gm-prd`, `gm-tech-spec` e `gm-plan-tasks` e o ciclo de review e aprovação.
- [PRODUCT.md](./PRODUCT.md): a definição do produto. O que ele faz, como faz, que problema resolve, princípios, conceitos, ciclo de vida completo de uma task, controles e requisitos de experiência.
- [STACK.md](./STACK.md): a stack técnica escolhida, com as razões de cada escolha e as alternativas descartadas.

## Vocabulário

- **Task**: a unidade de trabalho que o produto conduz, de qualquer natureza: feature, bug fix, refatoração.
- **Step**: cada item ordenado dentro de uma task. Um step pertence a um único repositório e vira exatamente um commit.

As skills atuais, descritas em WORKFLOW.md, usam outros nomes para as mesmas coisas: chamam a task de "feature" e os steps de "tasks". PRODUCT.md e STACK.md usam o vocabulário do produto.

## Planejamento

O planejamento de cada task deste projeto fica em `planning/{task-name}/`, com `PRD.md`, `tech-spec.md` e `tasks/`, produzidos pelas skills descritas em WORKFLOW.md. A pasta `tasks/` contém os steps, no nome que as skills usam.
