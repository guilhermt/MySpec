# Redesenho do MySpec

Esta pasta é a fonte de verdade da frente de redesenho: repensar a experiência do MySpec como um todo, com o mesmo cuidado que um time de design profissional dedicaria a um produto de gerenciamento de agentes e workflows de IA. Não é uma repaginada dos componentes atuais: a estrutura, a navegação e a hierarquia da informação são decididas antes de qualquer pixel, a partir de um entendimento profundo de todas as features e do jeito que o usuário trabalha no app todo dia.

A frente atravessa muitas sessões e semanas. Nenhuma sessão tem memória da anterior, então tudo o que é levantado, proposto, decidido ou descartado vive aqui, em arquivo. Uma decisão tomada em conversa e não registrada não existe.

## Como a frente funciona

O usuário é o diretor de design: ele decide olhando, não lendo. Um coordenador conduz a frente com a skill `design-front`, dispara subagentes com os papéis abaixo, filtra o que eles produzem e chama o usuário só para decisões que são dele, cada uma com mocks abertos no navegador e uma recomendação. Uma decisão por chamada, sempre que possível.

Os papéis, definidos em `.claude/agents/`:

- **design-researcher**: entende o produto a fundo a partir de `docs/`, do código do frontend e do backend, e produz levantamentos: telas, estados, jornadas, dados disponíveis, dados que faltam, perguntas que só o usuário responde.
- **designer**: propõe. Sempre em variações, nunca uma só. Estrutura, wireframes, direção visual e telas, como mocks em `lab/`.
- **design-critic**: revisa cada proposta contra o brief, os princípios e o design system, e aponta inconsistência, hierarquia fraca, estado esquecido, exceção sem razão. Não propõe; julga.

A implementação de cada tela decidida é uma task do próprio MySpec, com spec e steps, conduzida como qualquer outra. O implementador não decide design: reproduz o mock com os componentes do system e aponta o que o mock não cobre.

## Fases

1. **Brief.** Entendimento do produto e do uso. O researcher levanta o que os docs e o código dizem; o usuário responde, numa entrevista curta, o que só ele sabe: como é o dia dele no app, o que dói, o que olha primeiro, o que ignora. Resultado: `brief.md`, com quem usa, as jornadas, o modelo mental, o que precisa estar visível de longe e o que pode esperar um clique.
2. **Estrutura.** Arquitetura de informação e modelo de navegação, em wireframes sem cor. Resultado: `structure.md` e os mocks de estrutura em `lab/`.
3. **Fundação visual.** Princípios de design e linguagem visual (cor, tipografia, espaçamento, elevação, movimento, densidade), provados numa tela real até o usuário aprovar. Resultado: `principles.md` e `system/`, o design system: tokens, componentes e regras de uso.
4. **Telas por jornada.** Cada jornada é desenhada como mocks no `lab/`, criticada, decidida e implementada como task no MySpec. Mudanças de backend, como um dado que a tela pede e não existe, entram na task da tela. A ordem das telas:
   1. A task com a conversa: o topo do item, o progresso entre etapas, os agentes implementador e revisor, e a conversa em si (entradas, ações, perguntas, permissões, marcos, documentos), em todas as etapas (planejamento, implementação `Agent` e `Manual`, PR, encerramento).
   2. Home, a visão do board e a criação de task.
   3. O centro de review e a tela de um review.
   4. A discussão e os rascunhos.
   5. Settings, History, boas-vindas, migração, diálogos, avisos e notificações.
   A implementação começa por uma task de fundação, os tokens, os componentes base e o shell com a árvore e a navegação, que pode correr em paralelo com o desenho da primeira tela, porque a estrutura e o design system já estão aprovados.
5. **Consistência.** Depois que tudo está implementado, um passe do crítico sobre o app inteiro contra o system.

Uma fase só começa quando a anterior está decidida e registrada. Uma decisão pode ser revista, mas a revisão é registrada em `decisions.md` com a razão.

## Arquivos

- `README.md`: este documento, com o estado da frente no fim.
- `decisions.md`: o registro de decisões, uma por entrada, com a data, a escolha, as alternativas descartadas e a razão.
- `brief.md`, `structure.md`, `principles.md`: os resultados das fases 1 a 3.
- `screens/`: o documento de cada tela decidida na fase 4 (`task.md`, ...), que a implementação segue, com o mock de referência apontado em cada um.
- `system/`: o design system: `tokens.css`, a fonte única dos tokens nos dois modos, e `components.md`, a anatomia, as variantes, os estados e a acessibilidade de cada componente base. Toda tela e toda implementação usam exatamente esses tokens e essas regras.
- `lab/`: os mocks, páginas HTML autocontidas abertas no navegador. Ver `lab/README.md`.
- `research/`: os levantamentos do researcher, insumo das outras fases.
- `changes.md`: as mudanças de comportamento do produto que as telas implicam, por tela, que os PRDs das tasks implementam.
- `backend.md`: os dados que o backend precisa expor ou guardar, com o custo de cada um.
- `implementation.md`: o plano de implementação, a sequência de tasks do MySpec com escopo, dependências, tamanho e critério de pronto.

## Estado da frente

Fase 4, telas por jornada. Brief (`brief.md`), estrutura (`structure.md`) e fundação visual (`principles.md`, `system/`) estão aprovados; a referência visual é `lab/08-visual-final`. A tela da task está decidida (`screens/task.md`, mock `lab/10-screen-task-minimal/b.html`): stepper compacto, abas mínimas, conversa do lugar atual, tudo o mais em painéis e no menu. Home, board e criação de task estão decididos (`screens/board.md`, mock `lab/11-screen-board/a.html`). O centro de review está decidido (`screens/review.md`, mock `lab/12-screen-review/a.html` com a publicação em diálogo). A discussão está decidida (`screens/discussion.md`, mock `lab/13-screen-discussion/b.html`). Settings, History, boas-vindas, migração, diálogos e avisos estão decididos (`screens/rest.md`, mock `lab/14-screen-rest/index.html`). Todas as telas da fase 4 estão decididas. A consolidação está feita: `system/components.md` e `structure.md` atualizados com o que as telas trouxeram, `changes.md` com as mudanças de comportamento do produto, `backend.md` com os dados que o backend precisa expor, e `implementation.md` com a sequência de doze tasks do MySpec. A conversa teve rodada própria (`lab/15-conversation` e `lab/16-conversation-wide`) e está decidida em `screens/task.md` §6 a §8. O usuário confirmou `implementation.md` §4; a implementação começa pela task 1 (fundação), com `tasks/01-foundation.md` como entrada. As tasks 1 a 6 estão mergeadas na `main`; a task 7 (findings da PR da task) está em pull request, e os cards das tasks 8 a 10 têm o material pronto em `tasks/`. O passe de consistência da fase 5 é a task 12. A pauta de polimento vinda da fase 3 está na seção 7 de `lab/08-visual-final/critique.md`.
