# Workflow de desenvolvimento com Claude Code

Este documento descreve, em detalhes, o workflow usado para planejar e implementar features com o Claude Code. O fluxo tem quatro etapas executadas em sequência. Cada etapa acontece em uma sessão nova do Claude Code, aberta no diretório do projeto, sem histórico da etapa anterior. As três primeiras etapas são conduzidas por skills próprias: `gm-prd`, `gm-tech-spec` e `gm-plan-tasks`. A quarta etapa usa o arquivo de cada task como prompt.

## Visão geral

| Etapa | Primeiro prompt da sessão | Artefato produzido |
|---|---|---|
| 1. PRD | `/gm-prd {feature-name}` | `planning/{feature-name}/PRD.md` |
| 2. Tech spec | `/gm-tech-spec {feature-name}` | `planning/{feature-name}/tech-spec.md` |
| 3. Plano de tasks | `/gm-plan-tasks {feature-name}` | `planning/{feature-name}/tasks/N-descricao-curta.md` (um arquivo por task) |
| 4. Implementação | `@planning/{feature-name}/tasks/N-descricao-curta.md` | Código commitado e task marcada como concluída |

A etapa 4 se repete uma vez por task, sempre em uma sessão nova, até a última task ser commitada.

## Estrutura de arquivos

Todos os artefatos ficam dentro do repositório do projeto, na pasta `planning/`:

```
planning/
└── {feature-name}/
    ├── PRD.md
    ├── tech-spec.md
    └── tasks/
        ├── 1-descricao-curta.md
        ├── 2-descricao-curta.md
        └── ...
```

O `{feature-name}` é o argumento passado às três skills e é o mesmo nas três invocações. Dentro do texto das skills ele aparece como `$ARGUMENTS`.

## As skills

As três skills ficam em `~/.claude/skills/<nome>/SKILL.md`, no nível do usuário, e por isso estão disponíveis em qualquer projeto. Todas têm as mesmas configurações no frontmatter:

- `disable-model-invocation: true`: a skill só roda quando o usuário digita o comando. O agente nunca a aciona por conta própria.
- `argument-hint: [feature-name]`: o comando recebe um único argumento, o nome da feature.

Descrição de cada uma, conforme o frontmatter:

- **gm-prd**: "Create a Product Requirements Document (PRD) for a new feature through deep conversational Q&A. Use this skill when planning a new feature, refactoring, or any implementation that needs clear requirements before coding. Triggers when users want to define what to build, create requirements, or start the planning process for a feature."
- **gm-tech-spec**: "Create a Technical Specification from an existing PRD by analyzing the codebase and conducting a technical Q&A. Use this skill after the PRD is written and you need to plan the technical implementation — covering architecture decisions, file changes, patterns to follow, and coding standards. Triggers when users want to create a tech spec, plan the technical side of a feature, or define how something should be implemented."
- **gm-plan-tasks**: "Break down a technical specification into ordered, independent implementation tasks. Use this skill after the PRD and tech spec are written and you need to divide the work into discrete tasks for an implementation agent. Each task file becomes the complete prompt for the agent — self-contained and optimized for autonomous execution."

## Etapa 1: PRD (`/gm-prd`)

### Início da sessão

1. Abrir o Claude Code no diretório do projeto.
2. Primeiro prompt: `/gm-prd {feature-name}`.
3. O agente apenas confirma que está pronto e pede que o usuário descreva a feature. Ele não explora o codebase antes de receber esse contexto.
4. Segundo prompt: o usuário passa o contexto inicial da feature ou do que quer fazer. Pode ser alto nível ou já conter detalhes.

### Papel do agente

O agente atua como um analista de produto sênior. O processo tem duas fases: entendimento profundo e, só depois, escrita do PRD.

### Fase 1: entendimento profundo

O único objetivo dessa fase é entender completamente o que o usuário quer construir. O agente não pensa em tecnologia, arquitetura ou implementação; isso fica para o processo seguinte. O foco é inteiramente no **o quê** e no **por quê**.

A partir do contexto inicial, o agente identifica cada lacuna no seu entendimento e a preenche por conversa. Regras da conversa:

- Uma pergunta por vez.
- Perguntas diretas e concisas, sem preâmbulo nem enchimento. Apenas a pergunta.
- Cada pergunta mira uma lacuna específica. Os temas cobertos são: personas, casos de uso, casos de borda, regras de negócio, restrições, comportamentos esperados, critérios de sucesso, limites de escopo (o que fica explicitamente de fora) e premissas que precisam ser validadas.
- Depois de cada resposta, o agente internaliza e passa para a próxima lacuna. Ele não resume a resposta de volta para o usuário, a não ser que uma clarificação seja genuinamente necessária.
- Se algo for ambíguo ou tiver mais de uma interpretação possível, o agente pede esclarecimento na hora, em vez de assumir.
- A conversa continua até o agente ter zero perguntas restantes. Não há pressa nessa fase.
- Depois de receber o contexto inicial, o agente pode explorar o codebase sempre que isso ajudar o entendimento.

### Transição para a fase 2

Quando o agente genuinamente não tem mais perguntas e entende o quadro completo, ele diz isso claramente ao usuário: acredita ter entendimento completo e está pronto para escrever o PRD. Em seguida lista os pontos-chave que entendeu, para que o usuário possa apontar o que faltou, e pede confirmação para prosseguir.

Se o usuário acrescentar pontos, o agente os incorpora. A fase 2 só começa quando ambos concordam que o entendimento está completo.

### Fase 2: escrita do PRD

O agente cria a pasta `planning/{feature-name}/`, se ainda não existir, e escreve o arquivo `planning/{feature-name}/PRD.md`.

O PRD é escrito como um documento profissional de requisitos de produto. Ele é um documento de referência que será usado adiante pelo planejador técnico, e por isso deve ser claro, completo e sem ambiguidade sobre o que precisa ser construído.

Estrutura usada:

```markdown
# [Feature Name] — Product Requirements Document

## Overview
A concise summary of what this feature is and why it's being built.

## Context & Motivation
The background, pain points, or business drivers behind this feature. Why now? What problem does it solve?

## Goals & Success Criteria
What does success look like? Include measurable outcomes where possible.

## User Personas
Who uses this feature? What are their needs and expectations?

## Functional Requirements
The core behaviors and capabilities, organized logically. Be specific and unambiguous. Use sub-sections for distinct areas of functionality.

## User Flows
Step-by-step descriptions of how users interact with the feature for key scenarios.

## Business Rules & Constraints
Rules that govern behavior, validation logic, edge cases, and any hard constraints.

## Non-Functional Requirements
Performance expectations, security considerations, accessibility needs, etc. — if relevant.

## Scope Boundaries
What is explicitly out of scope for this implementation.

## Open Questions
Any unresolved points that were identified during the conversation (if any remain).
```

A estrutura é adaptada à feature: seções que não se aplicam são omitidas e seções novas são adicionadas se a feature exigir. O objetivo é completude e clareza, não aderência rígida ao template.

### Encerramento

Depois de escrever o arquivo, o agente avisa que o PRD está pronto e onde foi salvo. A sessão termina aqui.

## Etapa 2: Tech spec (`/gm-tech-spec`)

### Início da sessão

1. Abrir uma conversa nova, zerada, no mesmo projeto.
2. Primeiro prompt: `/gm-tech-spec {feature-name}`.

Não há segundo prompt de contexto. O agente parte do PRD.

### Papel do agente

O agente atua como um arquiteto técnico sênior. O documento produzido será o único guia do agente de implementação, então toda decisão precisa ser tomada aqui, sem deixar espaço para interpretação ou improviso.

### Setup

Antes de qualquer pergunta, o agente:

1. Lê `planning/{feature-name}/PRD.md` e o entende por completo.
2. Explora o codebase a fundo:
   - estrutura do projeto, convenções e padrões;
   - código existente relacionado à feature ou que será afetado por ela;
   - documentação sobre padrões de código, decisões de arquitetura e convenções (CLAUDE.md, README, guias de contribuição);
   - stack tecnológica, dependências e frameworks em uso.

Com isso ele constrói o entendimento do **o quê** (a partir do PRD) e de **como o projeto funciona hoje** (a partir do código).

### Fase 1: Q&A técnico

Conversa técnica focada, com o objetivo de resolver toda decisão e ambiguidade técnica antes de escrever qualquer coisa. Regras:

- Uma pergunta por vez. Direta, só a pergunta, sem enchimento.
- Temas: abordagem arquitetural, modelos de dados, design de API, gerenciamento de estado, pontos de integração, estratégia de tratamento de erros, necessidade de migrations, convenções de nomenclatura, quais padrões existentes seguir e trade-offs técnicos.
- Quando há mais de uma abordagem válida, o agente apresenta as opções de forma concisa, com os trade-offs, e pede que o usuário decida. Ele não toma essas decisões em silêncio.
- O agente cruza cada decisão com os padrões existentes no codebase. Se o projeto faz algo de uma determinada forma, essa forma é o padrão, mas ele confirma com o usuário em caso de dúvida.
- A conversa continua até toda decisão técnica estar tomada. O agente de implementação não deve precisar fazer nenhum julgamento.

### Transição para a fase 2

Quando não restam perguntas técnicas e o usuário confirma, o agente passa a escrever o tech spec.

### Fase 2: escrita do tech spec

O agente cria o arquivo `planning/{feature-name}/tech-spec.md`.

O tech spec é detalhado o suficiente para que o agente de implementação o execute sem fazer perguntas nem tomar decisões. Ele cobre **todo** arquivo que precisa mudar, **todo** padrão a seguir e **toda** decisão técnica.

Estrutura usada:

```markdown
# [Feature Name] — Technical Specification

## References
- PRD: [PRD.md](./PRD.md)

## Technical Overview
A concise summary of the technical approach and key architectural decisions.

## Implementation Details

### [Area 1 — e.g., Database Changes]
Detailed description of what needs to happen. Include:
- Specific files to create, modify, or delete
- Exact data structures, schemas, or types
- Naming conventions to follow
- Code patterns to match (reference existing code as examples)

### [Area 2 — e.g., API Layer]
(Same level of detail)

### [Area N]
(As many sections as needed)

## File Change Summary
A clear list of every file that will be created, modified, or deleted, with a brief note on what changes in each.

## Technical Decisions
Key decisions made during planning, with brief rationale. This helps the implementation agent understand the "why" behind the approach.

## Coding Standards
- Write clean, readable, and simple code
- Prefer simplicity over complexity
- Follow existing project patterns and conventions
- No over-engineering — implement exactly what's needed, nothing more
- Use consistent naming with the rest of the codebase
- Keep functions focused and small
- [Add any project-specific standards identified during codebase analysis]
```

A estrutura é adaptada conforme necessário. O critério que rege o nível de detalhe: se o agente de implementação precisaria tomar uma decisão ou fazer uma suposição, o spec ainda não está específico o bastante, e o agente acrescenta detalhe até toda escolha estar pré-definida.

### Encerramento

Depois de escrever o arquivo, o agente avisa que o tech spec está pronto e onde foi salvo. A sessão termina aqui.

## Etapa 3: Plano de tasks (`/gm-plan-tasks`)

### Início da sessão

1. Abrir uma conversa nova, zerada, no mesmo projeto.
2. Primeiro prompt: `/gm-plan-tasks {feature-name}`.

### Papel do agente

O agente atua como um engenheiro sênior quebrando a implementação planejada em tasks discretas e ordenadas. Cada task será executada por um agente de implementação independente, em uma janela de contexto nova.

### Setup

O agente lê `planning/{feature-name}/PRD.md` e `planning/{feature-name}/tech-spec.md`, entende os dois por completo e então explora o codebase para conhecer o estado atual dos arquivos que serão afetados.

### Fase 1: planejamento do breakdown

O agente discute a divisão do trabalho com o usuário, fazendo perguntas uma por vez para resolver qualquer ambiguidade sobre como dividir. Os princípios de divisão são:

- **O código deve compilar depois de cada task.** Toda task deixa o codebase em estado válido: sem erros de tipo, sem imports faltando, sem variáveis não usadas, sem build quebrado. Essa é a restrição principal.
- **Tasks não são features.** Uma task não precisa entregar uma capacidade completa para o usuário final. Ela é uma unidade de mudança de código que compila limpa e pode ser commitada sozinha.
- **Ordem natural de dependência.** Tipicamente banco/schema primeiro, depois backend/API, depois frontend, adaptando ao projeto. Cada task depende apenas de tasks anteriores, nunca de tasks futuras.
- **Tamanho adequado.** Granular demais gera overhead desnecessário. Grande demais fica difícil de implementar de uma vez. Uma task é algo que um agente implementa em uma única sessão focada.

O agente sugere o breakdown, o usuário e o agente combinam os ajustes, e quando ambos concordam o agente passa a escrever os arquivos.

### Fase 2: escrita dos arquivos de task

O agente cria a pasta `planning/{feature-name}/tasks/`, se ainda não existir, e escreve um arquivo por task, numerado em ordem: `1-descricao-curta.md`, `2-descricao-curta.md`, etc. A parte descritiva do nome usa minúsculas e hífens.

**Cada arquivo de task é o prompt inteiro** que o agente de implementação vai receber. Não há contexto ao redor, instruções adicionais nem histórico de conversa. O agente recebe apenas o conteúdo do arquivo.

**Os arquivos de task definem apenas escopo.** Eles dizem ao agente *qual parte* da implementação atacar, não *como* implementar nem *qual* é a lógica de negócio. Todos os detalhes de implementação, regras de negócio, padrões de código e decisões técnicas vivem no PRD e no tech spec; o arquivo de task apenas aponta para eles.

**Os arquivos de task não repetem nem parafraseiam o PRD ou o tech spec.** Se uma regra de negócio, estrutura de dados, contrato de API ou padrão já está descrito nesses documentos, a task referencia, não duplica.

Estrutura obrigatória de cada arquivo:

```markdown
❌ Status: Not Started

# Task [N]: [Task Title]

## Context

You are implementing part of a larger feature. Read these files for full context on what to build and how to build it:
- **PRD**: `planning/[feature-name]/PRD.md` — the full product requirements
- **Technical Specification**: `planning/[feature-name]/tech-spec.md` — all technical decisions, patterns, and coding standards

Follow the technical specification strictly. All implementation decisions, patterns, data structures, and coding standards are defined there. Do not deviate from it.

This is task [N] of [total]. Previous tasks (1 through [N-1]) are already implemented — their changes are in the codebase.

## Scope

A clear definition of what this task covers — which sections of the tech spec to implement, which files to create or modify. This is purely about boundaries: what is in scope for this task and what is not.

Reference specific sections of the tech spec where relevant (e.g., "Implement the database changes described in section X of the tech spec").

## Completion Checklist

- [ ] All changes in scope are implemented following the tech spec
- [ ] Code compiles with no errors
- [ ] No unused imports or variables

## Workflow

After implementing the changes:

1. Run through the completion checklist above and verify every item passes.
2. Present a summary of what you implemented to the user and wait for their review.
3. If the user requests changes: apply them, re-run the full completion checklist, and present the updated summary for review again.
4. Repeat step 3 until the user approves.
5. Once the user confirms the task is complete, commit all changes with a simple, readable commit message that describes what was done.
6. After committing, update the status at the top of this task file from `❌ Status: Not Started` to `✅ Status: Complete`.
```

Os arquivos são mantidos enxutos: apontam para os documentos certos, delimitam o trabalho e estabelecem o fluxo de review, nada além disso.

### Verificações de qualidade

Antes de apresentar os arquivos ao usuário, o agente verifica:

1. As tasks cobrem todo o escopo do tech spec, sem nada de fora.
2. Cada task deixa o código em estado compilável.
3. Nenhuma task depende de uma task futura.
4. Cada arquivo é autocontido e funciona como prompt isolado.
5. Nenhum arquivo duplica conteúdo do PRD ou do tech spec, apenas referencia.
6. Os caminhos de arquivo referenciados em cada task estão corretos.

### Encerramento

Depois de escrever todos os arquivos, o agente os lista para o usuário com um resumo breve do que cada task cobre. A sessão termina aqui.

## Etapa 4: Implementação de cada task

Essa etapa se repete para cada task, na ordem numérica, sempre em uma sessão nova.

### Início da sessão

1. Abrir uma conversa nova, zerada, no mesmo projeto.
2. Primeiro prompt: a referência ao arquivo da task, e nada mais. Exemplo: `@planning/new-endpoint/tasks/1-db-schema.md`.

Não há skill nessa etapa. O conteúdo do arquivo da task é o prompt completo do agente.

### Implementação

O agente lê o PRD e o tech spec indicados na seção Context da task e implementa o escopo definido na seção Scope, seguindo o tech spec estritamente. As tasks anteriores já estão implementadas e commitadas no codebase.

O agente só faz perguntas em casos especiais, quando realmente precisa. Fora isso, implementa de forma autônoma.

Ao terminar, seguindo a seção Workflow da task, ele:

1. Percorre o checklist de conclusão e verifica que todos os itens passam.
2. Apresenta ao usuário um resumo do que implementou, sinaliza que está pronto e aguarda o review.

### Review do usuário

O review é feito fora da conversa com o agente:

1. O usuário abre o VS Code.
2. Vai na aba do Git.
3. Revisa as mudanças arquivo por arquivo.
4. A cada arquivo revisado, dá stage nele.
5. Quando necessário, faz alterações manuais no código durante o review.

### Ajustes

Se o usuário pedir mudanças ao agente, o agente as aplica, roda o checklist completo de novo e apresenta o resumo atualizado para novo review. Isso se repete até o usuário aprovar.

### Aprovação e commit

Quando termina o review, o usuário apenas diz ao agente que a task está aprovada. O agente então:

1. Commita todas as mudanças com uma mensagem simples e legível que descreve o que foi feito.
2. Atualiza o status no topo do arquivo da task de `❌ Status: Not Started` para `✅ Status: Complete`.

### Próxima task

O usuário abre outra conversa zerada e repete o processo com o arquivo da task seguinte. Isso continua até a última task ser commitada, o que encerra a implementação da feature.
