# Modo One-Shot

## O problema

O fluxo do produto, PRD, tech spec, plano de steps, implementação step a step, pull request, review e encerramento, é o modo certo para a maioria das tasks, e continua sendo o padrão. Mas ele é pesado para tasks que não pedem tanta estrutura: uma mudança pequena e bem delimitada, que o usuário resolveria numa única conversa bem direcionada, hoje passa por três etapas de planejamento, um plano de steps e uma sessão por step. Para essas tasks o fluxo é burocracia, não segurança.

A ideia é um segundo modo de conduzir uma task, o One-Shot, que remove essa fricção sem abrir mão dos princípios do fluxo estruturado: o agente resolve todas as lacunas antes de escrever código, uma pergunta por vez; o usuário toma as decisões; tudo fica documentado num artefato guardado pelo produto; e a implementação apenas segue o que foi planejado. Muda a quantidade de etapas e de sessões, não o jeito de trabalhar.

## Decisões

- **Duas sessões, não uma.** Uma sessão de planejamento que escreve um único documento, e uma sessão de implementação que o executa. Uma sessão só faria o plano nunca existir como artefato antes do código, e o produto perderia o portão entre decidir e fazer e a capacidade de derivar o estado pelos artefatos.
- **Um único artefato de planejamento.** O documento faz o papel dos três de hoje e é a primeira mensagem da sessão de implementação, como o arquivo de um step é hoje. Precisa bastar sozinho: quem implementa não decide nada.
- **A implementação é um step único.** A task inteira é um commit e uma pull request, com o mesmo review por stage, a mesma aprovação e o mesmo commit pelo agente que um step tem hoje.
- **A etapa de PR não muda.** Rascunho, abertura, review de pull request e encerramento são exatamente os de hoje, porque já existem e são baratos.
- **O modo é escolhido na criação da task e é fixo.** Structured é o padrão; One-Shot é a alternativa. Uma task não troca de modo depois de criada.
- **Uma task One-Shot nasce sempre num repositório, nunca na raiz.** Ela é um commit e uma pull request, e isso só faz sentido dentro de um repositório só. O que toca dois repositórios é o fluxo estruturado.
- **Um prompt novo.** O planejamento One-Shot tem prompt próprio, ao lado dos seis que existem, editável e restaurável como eles. Implementação, commit, PR e review de PR usam os prompts que já existem.
- **Um tipo de sessão novo nos modelos.** O planejamento One-Shot tem padrão próprio de modelo e esforço nas configurações e pode ser ajustado por task, como as outras etapas. Implementação, PR e review de PR usam os padrões que já têm.
- **Perceber que a task cresceu é responsabilidade do usuário.** O agente não avisa quando o trabalho não cabe num commit razoável, e não existe troca de modo no meio: o usuário interrompe, apaga a task e a recria no fluxo estruturado, com o contexto que já entendeu.

## O modelo

- **Modo**: a forma de conduzir uma task, escolhida na criação e fixa. Structured, o de hoje, ou One-Shot.
- **Planejamento One-Shot**: a única etapa de planejamento de uma task One-Shot. Uma conversa que faz o Q&A do quê e do como juntos e escreve o documento.
- **Documento One-Shot**: o artefato do planejamento. Diz o problema, o que a entrega inclui e o que fica de fora, as decisões técnicas tomadas com o usuário, o plano de mudanças, quais partes do código mudam e em que ordem, e o checklist de conclusão.
- **Implementação**: uma etapa com um step único, o próprio documento, na worktree do repositório.
- As etapas de PR, as situações, o histórico e os controles de sessão são os que já existem.

## Criação

Na criação da task, ao lado do nome, do contexto inicial e dos modelos por etapa, o usuário escolhe o modo. Com One-Shot, a task só pode ser criada num repositório, e as etapas oferecidas para modelo e esforço são o planejamento One-Shot, a implementação, a PR e o review de PR. Ao confirmar, a sessão de planejamento começa com o contexto inicial, e a primeira coisa que o usuário vê é a primeira pergunta do agente.

## Planejamento

A sessão abre no diretório do repositório, com o prompt de planejamento One-Shot. O agente entende o problema, explora o código, resolve as lacunas uma pergunta por vez, apresenta as alternativas técnicas com trade-offs para o usuário decidir e, ao final, lista o que entendeu, pede confirmação e escreve o documento. A etapa termina como as de hoje: documento no diretório de artefatos e conversa ociosa. O produto então inicia a implementação sozinho, criando a worktree e a branch da task.

O documento aparece renderizado no painel de artefatos, como os outros.

## Implementação

A implementação é um step único, com o documento como primeira mensagem da sessão, aberta na worktree. Tudo o que vale para um step vale aqui: a pré-condição de worktree limpa, o bloqueio com as saídas de hoje, o agente que só pergunta quando está genuinamente bloqueado, o step que passa a aguardar review quando o agente encerra o turno, o review arquivo a arquivo por stage no editor, o progresso em tempo real, **Aprovar** a 100% com a sessão ociosa, o commit pelo agente com o prompt de commit, e o step concluído quando o commit aparece na branch. **Descartar step** reinicia a implementação, como hoje.

Com o commit feito, a task entra na etapa de PR.

## Trilha, voltar e descartar

A trilha de uma task One-Shot tem três etapas: planejamento, implementação e PR. **Voltar ao planejamento** apaga a implementação, conversa, worktree e branch, com o que houver de não commitado, e deixa a task em modo de revisita até o usuário pressionar **Continuar**. **Descartar e recomeçar** vale nas duas etapas. Cada ação diz, antes de confirmar, o que será perdido, como hoje.

## O que atravessa o produto

- **Depende de mim**: as situações são as mesmas de um step e de uma pull request, com a mesma visibilidade na barra lateral, na árvore e na task, e a mesma notificação.
- **Histórico**: a task arquivada mostra o documento One-Shot no lugar de PRD, tech spec e steps, e, para o repositório, a pull request e o resultado do encerramento.
- **Prompts**: as configurações passam a listar sete prompts, com o de planejamento One-Shot.
- **Modelos e esforço**: as configurações passam a ter um padrão para o planejamento One-Shot, e o popover **Models** da task e o seletor por sessão funcionam como hoje.

## Fora do escopo por enquanto

- **Aviso do agente de que a task cresceu.** A proposta que ficou, se um dia valer a pena: o prompt de planejamento pede ao agente para avisar quando o trabalho não cabe num commit razoável, e o usuário decide na conversa entre seguir ou reduzir o escopo. Hoje a decisão é do usuário sem ajuda do agente.
- **Trocar uma task de modo no meio.** O caminho é apagar e recriar no outro modo.
- **One-Shot na raiz da área de trabalho, tocando mais de um repositório.**
- **Uma sessão só para planejar e implementar.**

## Em aberto

- O conteúdo exato do prompt de planejamento One-Shot e a estrutura de seções do documento. As seções decididas são problema, o que entra e o que não entra, decisões técnicas, plano de mudanças e checklist de conclusão; a forma e a ordem ficam para o PRD.
- O nome do arquivo do documento no diretório de artefatos.

## Ordem sugerida

Uma única frente. A ideia reaproveita quase tudo que existe, a criação de sessão com prompt, a etapa que termina pelo artefato, o step com review por stage e a etapa de PR, e o trabalho está em introduzir o modo na criação da task, o prompt e o padrão de modelo novos, e a trilha de três etapas.
