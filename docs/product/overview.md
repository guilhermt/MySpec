# Visão geral do produto

MySpec é uma aplicação que conduz um workflow de desenvolvimento feito com o Claude Code: PRD, tech spec, plano de steps, implementação step a step, pull request, review de pull request e encerramento. O Claude Code é a inteligência de cada sessão; o produto é a camada em volta dele, que inicia cada sessão no momento e no lugar certos, guarda os artefatos, sabe em que ponto cada task está, mostra o que espera pelo usuário e permite várias tasks em andamento ao mesmo tempo, numa única janela.

O produto não substitui o Claude Code. Ele elimina o trabalho mecânico em volta dele: abrir sessões à mão, lembrar nomes, descobrir onde parou, manter um terminal por sessão, controlar review, aprovação, commit e limpeza de worktrees de fora de qualquer ferramenta.

## Princípios

- **O agente decide, o produto executa o mecânico.** Entender, especificar, dividir, implementar, commitar, descrever e revisar são do Claude Code. Derivar estado, criar e apagar worktrees, abrir a sessão certa no diretório certo, saber qual é o próximo step, medir progresso e disparar a etapa seguinte são do produto. Um agente nunca é usado para fazer o que um comando faz.
- **O produto é o dono do estado.** Artefatos e progresso vivem no produto, fora dos repositórios. Os repositórios recebem apenas código e commits.
- **O estado é derivado, nunca declarado.** O produto sabe em que etapa uma task está porque sabe quais artefatos existem, qual step tem commit, quais arquivos estão em stage e qual pull request está aberta. O usuário nunca informa onde parou.
- **Auto-avanço.** Quando uma etapa termina, a seguinte começa. A única transição acionada pelo usuário é o encerramento de um repositório, porque depende de um merge feito fora do produto.
- **"Depende de mim" é um estado de primeira classe.** Tudo que aguarda o usuário é visível de longe, sem abrir a task, e anunciado por notificação quando a janela não está em foco.
- **O workflow é o mesmo.** Uma pergunta por vez, cada step revisado antes do commit, pelo usuário arquivo a arquivo no editor ou por um agente revisor. O produto conduz o workflow, não o redefine.
- **A experiência é o produto.** Cada tela, estado e interação é tratado com o mesmo cuidado.

## Conceitos

- **Área de trabalho (workspace)**: a pasta em que o produto é aberto. Contém os repositórios e é o contexto de tudo o que o produto mostra.
- **Repositório**: cada repositório git encontrado abaixo da área de trabalho. A própria área de trabalho pode ser um repositório.
- **Task**: a unidade de trabalho, de qualquer natureza: feature, bug fix, refatoração. Nasce na raiz da área de trabalho, quando toca mais de um repositório, ou dentro de um repositório, quando toca só ele.
- **Etapa (stage)**: cada fase do ciclo de vida da task: PRD, tech spec, plano, implementação e PR. A etapa de PR contém, por repositório, a abertura da pull request, o review dela e o encerramento.
- **Sessão**: uma conversa com o Claude Code iniciada pelo produto para conduzir uma etapa, um step, o review de um step ou a pull request de um repositório. Cada uma nasce com o prompt do seu tipo e o contexto da task.
- **Artefato**: o resultado de uma etapa. PRD, tech spec, arquivos de step, relatórios de review de step, rascunhos de pull request e relatórios de review de pull request. Guardados pelo produto.
- **Step**: uma unidade de mudança de código dentro da task. Pertence a um único repositório e vira exatamente um commit.
- **Modo de review**: quem revisa um step antes do commit. No modo `Manual`, o usuário, que dá stage arquivo a arquivo no editor e aprova; no modo `Agent`, um agente revisor, que revisa o step com o implementador e o deixa ser commitado quando o relatório vem limpo.
- **Worktree**: a cópia de trabalho de um repositório dedicada a uma task, criada e apagada pelo produto.
- **Prompt**: o texto que o produto entrega ao Claude Code ao iniciar uma sessão ou ao pedir um commit. Um por tipo, visível e editável nas configurações.
- **Situação**: qualquer coisa que espera pelo usuário: uma pergunta do agente, um step aguardando review, um rascunho aguardando OK, uma escalada de permissão, um bloqueio.
- **Histórico**: as tasks arquivadas, com seus artefatos finais.

O detalhe de cada etapa e de cada controle está em [features.md](./features.md).
