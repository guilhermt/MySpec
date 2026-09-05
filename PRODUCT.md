# Definição do Produto

## O que é

Uma aplicação que automatiza, centraliza e controla o workflow de desenvolvimento descrito em [WORKFLOW.md](./WORKFLOW.md). O workflow continua o mesmo: PRD, tech spec, plano de tasks e implementação task a task, sempre com o Claude Code como inteligência por trás e com o usuário no loop em cada decisão. O produto acrescenta a camada em volta disso: inicia cada sessão no momento certo e no lugar certo, guarda os artefatos, sabe em que ponto cada feature está, mostra o que depende do usuário e permite várias features em andamento ao mesmo tempo, em um único lugar.

O produto não substitui o Claude Code nem as skills. Tudo o que ele conduz já existe e funciona hoje. A razão de existir do produto é a experiência: automação do que é mecânico, centralização do que hoje está espalhado, controle sobre o que está em andamento e uma interface extremamente refinada para tudo isso.

## O problema que resolve

Hoje o workflow exige que o usuário:

- abra uma sessão nova do Claude Code para cada etapa e para cada task, digitando o comando da skill ou o caminho do arquivo da task à mão;
- lembre o nome de cada feature e o repita em cada invocação;
- descubra em qual task parou, olhando o status no topo de cada arquivo;
- mantenha um terminal por sessão quando quer trabalhar em mais de uma feature ao mesmo tempo, e gerencie esses terminais;
- guarde os artefatos de planejamento dentro dos repositórios ou, em features que tocam mais de um repositório, numa pasta acima deles;
- controle sozinho, de fora de qualquer ferramenta, o estado do review, a aprovação, o commit, a abertura da PR e a limpeza das worktrees ao final.

O produto elimina esse trabalho e dá ao usuário uma visão única e precisa do que está acontecendo em cada feature.

## Princípios

- **O agente decide, o produto executa o mecânico.** Tudo que envolve julgamento fica com o Claude Code: entender, especificar, dividir, implementar, commitar, escrever e revisar PR. Tudo que é determinístico fica com o produto: derivar estado, criar e apagar worktrees, abrir a sessão certa no diretório certo, saber qual é a próxima task, medir progresso, disparar a etapa seguinte. Um agente nunca é usado para fazer o que um comando faz.
- **O produto é o dono do estado.** Os artefatos e o progresso de cada feature vivem no produto, não nos repositórios. Os repositórios recebem apenas código e commits.
- **O estado é derivado, nunca declarado.** O produto sabe em que etapa uma feature está porque sabe quais artefatos existem, qual task tem commit, quais arquivos estão em stage, qual PR está aberta. O usuário nunca precisa informar onde parou.
- **Auto-avanço.** Toda transição acontece sozinha. Quando uma etapa termina, a seguinte começa. O usuário entra na conversa quando ela precisa dele.
- **"Depende de mim" é um estado de primeira classe.** Tudo que aguarda o usuário é visível de longe, sem precisar abrir a feature.
- **O workflow é o mesmo.** As etapas, as regras de cada uma, o Q&A de uma pergunta por vez, o review arquivo a arquivo no VS Code, a aprovação explícita: nada disso muda. O produto conduz o workflow, não o redefine.
- **Experiência extremamente refinada.** UI e UX são o produto. O design é polido, bonito e moderno, e cada detalhe de interação é tratado com o mesmo cuidado, do estado de um botão à forma como o progresso de um review é mostrado.

## Conceitos

- **Área de trabalho**: a pasta em que o produto é aberto. Contém os repositórios e é o contexto de tudo o que o produto mostra.
- **Repositório**: cada repositório git encontrado abaixo da área de trabalho.
- **Feature**: a unidade de trabalho. Nasce na raiz da área de trabalho, quando vai tocar mais de um repositório, ou dentro de um repositório, quando é só nele. Atravessa etapas até ser arquivada.
- **Etapa**: cada fase do ciclo de vida da feature. PRD, tech spec, plano de tasks, implementação, PR, review de PR e encerramento.
- **Sessão**: uma conversa com o Claude Code, iniciada pelo produto, para conduzir uma etapa ou uma task. Cada sessão nasce com o prompt da etapa e o contexto da feature.
- **Artefato**: o resultado de uma etapa. PRD, tech spec e arquivos de task. Guardados pelo produto.
- **Task**: uma unidade de mudança de código dentro da feature. Cada task pertence a um único repositório e vira exatamente um commit.
- **Worktree**: a cópia de trabalho de um repositório dedicada a uma feature, criada e apagada pelo produto, com o nome da feature.
- **Prompt**: o texto que o produto entrega ao Claude Code ao iniciar uma sessão. Um por tipo de sessão, visível e editável pelo usuário.
- **Depende de mim**: o estado de qualquer feature, etapa ou sessão que está parada aguardando uma ação do usuário.
- **Histórico**: a lista de features finalizadas e arquivadas, com seus artefatos finais.

## Área de trabalho

O produto é aberto a partir de uma pasta, da mesma forma que o VS Code abre uma pasta. Essa pasta passa a ser a área de trabalho.

Ao abrir, o produto escaneia a pasta e identifica os repositórios git abaixo dela. A área de trabalho é apresentada como uma árvore com dois níveis: a raiz e os repositórios.

Cada feature aparece no nó em que foi criada:

- features criadas na raiz aparecem na raiz. São as features que tocam mais de um repositório;
- features criadas dentro de um repositório aparecem atreladas àquele repositório. São as features que tocam só ele.

Para cada nó, o produto mostra as features em andamento ali, com o estado de cada uma. As features arquivadas não aparecem na área de trabalho; ficam acessíveis pelo histórico.

## Ciclo de vida de uma feature

### Visão geral

1. **Criação**: o usuário informa nome, local, contexto inicial e, se quiser, ajusta modelo e esforço por etapa.
2. **PRD**: sessão de Q&A sobre o quê e o porquê. Termina quando o PRD é escrito.
3. **Tech spec**: sessão de Q&A técnico, com exploração do código. Termina quando o tech spec é escrito.
4. **Plano de tasks**: sessão que propõe e negocia a divisão do trabalho. Termina quando os arquivos de task são escritos.
5. **Implementação**: uma sessão por task, em sequência, cada uma na worktree do repositório da task. Cada task passa por implementação, review, aprovação e commit.
6. **PR**: uma sessão por repositório tocado. O agente prepara o rascunho, o usuário aprova, o agente abre a PR.
7. **Review de PR**: uma sessão por PR. O agente revisa, o usuário decide o que aplicar, o agente aplica e sobe, até a revisão fechar limpa.
8. **Encerramento**: por repositório, depois da PR mergeada, acionado pelo usuário. O produto apaga a worktree e atualiza a branch local.
9. **Arquivamento**: quando o último repositório é encerrado, a feature sai da área de trabalho e vai para o histórico.

Toda transição entre etapas é automática. A única exceção é o encerramento, que depende de a PR ter sido mergeada fora do produto e por isso é acionado pelo usuário.

### Criação

O usuário cria uma feature a partir da raiz da área de trabalho ou a partir de um repositório específico. Na criação ele informa:

- o **nome** da feature, que identifica a feature no produto e dá nome às worktrees e branches;
- o **local**, raiz ou repositório, definido pelo ponto de onde a criação foi iniciada;
- o **contexto inicial**: a descrição do que quer fazer, o mesmo texto que hoje ele envia como segunda mensagem na sessão de PRD. Pode ser alto nível ou detalhado;
- **modelo e esforço por etapa**, partindo dos padrões configurados no produto. O usuário pode ajustar qualquer etapa para essa feature específica.

Ao confirmar, o produto inicia a sessão de PRD já com o contexto inicial. A primeira coisa que o usuário vê é a primeira pergunta do agente.

### Etapa PRD

A sessão roda no diretório da feature: a raiz da área de trabalho, para features de raiz, ou o repositório, para features de repositório. O agente segue o prompt de PRD, que reproduz as regras da skill `gm-prd`: foco total no quê e no porquê, uma pergunta por vez, sem preâmbulo, até não restar nenhuma lacuna. Ao final ele lista os pontos-chave entendidos e pede confirmação, e só então escreve o PRD.

O PRD é gravado no armazenamento do produto, atrelado à feature. Assim que ele existe, o produto considera a etapa concluída e inicia a sessão de tech spec. O PRD fica visível no produto a qualquer momento.

### Etapa Tech spec

A sessão roda no mesmo diretório da etapa anterior. O agente lê o PRD do armazenamento do produto e explora o código: todos os repositórios abaixo da área de trabalho, em features de raiz, ou só o repositório da feature, em features de repositório. Segue o prompt de tech spec, que reproduz as regras da skill `gm-tech-spec`: Q&A técnico, uma pergunta por vez, apresentando alternativas com trade-offs para o usuário decidir, até toda decisão técnica estar tomada.

O tech spec é gravado no armazenamento do produto. Assim que ele existe, o produto inicia a sessão de plano de tasks.

### Etapa Plano de tasks

A sessão roda no mesmo diretório. O agente lê o PRD e o tech spec e explora o estado atual do código. Segue o prompt de plano de tasks, que reproduz as regras da skill `gm-plan-tasks`: propõe a divisão, negocia com o usuário até os dois concordarem, e escreve um arquivo por task, numerado em ordem.

Regras de divisão que o prompt impõe:

- o código compila depois de cada task;
- cada task pertence a **um único repositório** e vira exatamente um commit;
- cada task depende apenas de tasks anteriores, nunca de futuras;
- cada task cabe em uma única sessão focada.

Cada arquivo de task carrega o **repositório** em que será implementada. Esse campo é o que permite ao produto saber quais repositórios a feature toca e em qual worktree abrir cada sessão de implementação.

Os arquivos de task são gravados no armazenamento do produto. Assim que existem, o produto inicia a primeira task.

### Worktrees

O produto cria uma worktree por repositório tocado pela feature. A lista de repositórios vem do campo de repositório das tasks, por isso as worktrees só passam a existir depois do plano de tasks.

Cada worktree tem o nome da feature e é criada pelo produto, por comando, antes de iniciar a primeira sessão de implementação naquele repositório. A worktree é gerenciada inteiramente pelo produto: ele a cria, sabe onde ela está, abre as sessões dentro dela, lê o estado do git dela para medir progresso, e a apaga no encerramento.

Com uma worktree por repositório por feature, duas features em implementação no mesmo repositório não se misturam. O review de cada uma vê apenas as mudanças dela.

### Etapa Implementação

As tasks de uma feature são executadas **em sequência**, na ordem numérica. O produto sempre sabe qual é a próxima: a primeira task sem commit.

#### Pré-condição: worktree limpa

Antes de iniciar qualquer task, o produto verifica que a worktree do repositório da task está limpa, sem nenhuma alteração não commitada. Se encontrar alterações, tipicamente trabalho deixado pela metade por uma sessão interrompida, ele **não inicia a task**. Ele para, alerta o usuário, e oferece duas saídas: o usuário limpa a worktree por conta própria, ou autoriza o produto a limpá-la. Só depois disso a task começa.

#### Sessão de implementação

O produto abre a sessão dentro da worktree do repositório da task, com o prompt de implementação, que é o conteúdo do arquivo da task: o contexto apontando para o PRD e o tech spec no armazenamento do produto, o escopo da task e o checklist de conclusão. As tasks anteriores já estão commitadas na worktree.

O agente implementa seguindo o tech spec estritamente. Só faz perguntas em casos especiais, e cada pergunta coloca a task em "depende de mim". Ao terminar, percorre o checklist e apresenta o resumo do que implementou. A task entra em **aguardando review**.

#### Review

O review continua sendo feito pelo usuário no VS Code, arquivo por arquivo, dando stage em cada arquivo revisado e fazendo alterações manuais quando necessário. O produto oferece um atalho para abrir a worktree no VS Code.

Durante o review, o produto lê o estado do git da worktree e mostra o **progresso do review**: quantos arquivos alterados existem e quantos já estão em stage, como percentual. Esse número acompanha o usuário em tempo real, na task e na visão geral.

#### Ajustes

Se o usuário quer mudanças, ele as pede na conversa da sessão. O agente aplica, roda o checklist de novo e apresenta o resumo atualizado. A task volta para aguardando review, e o ciclo se repete até o usuário aprovar.

#### Aprovação e commit

A aprovação é uma ação no produto. Ela só fica disponível quando **todos os arquivos alterados estão em stage**. Enquanto o progresso do review não chega a 100%, aprovar não é possível.

Ao aprovar, o produto abre uma sessão de commit na worktree, com o prompt de commit. O agente commita as alterações com uma mensagem simples e legível que descreve o que foi feito. Assim que o commit existe, o produto marca a task como concluída. O status da task é do produto; ninguém edita arquivo de task para marcar conclusão.

#### Próxima task

Com a task concluída, o produto inicia automaticamente a próxima, repetindo a verificação de worktree limpa e abrindo a sessão na worktree do repositório dela. Quando a última task é commitada, a feature entra na etapa de PR.

### Etapa PR

A etapa de PR é por repositório: uma sessão para cada worktree da feature. Ela começa automaticamente com o commit da última task.

Em cada sessão, o agente segue o prompt de PR e prepara um **rascunho**: o título e a descrição que pretende usar. O rascunho é apresentado ao usuário no produto, e a PR entra em "depende de mim".

Quando o usuário dá o OK, o agente abre a PR conforme o prompt e o rascunho aprovado. A branch base é **dev por padrão**. O padrão é editável, e quando o repositório não tem branch dev o agente pergunta qual usar.

Aberta a PR, a feature entra, para aquele repositório, na etapa de review de PR.

### Etapa Review de PR

A etapa começa automaticamente para cada PR aberta, com uma sessão própria e o prompt de review de PR.

O agente revisa a PR. Quando encontra alterações que considera necessárias, apresenta ao usuário, e o usuário decide ali mesmo, na conversa, o que quer que seja implementado e o que não quer. O que o usuário aprova, o mesmo agente implementa. Em seguida usa o prompt de commit para commitar e subir as alterações para a PR, e revisa de novo.

O ciclo se repete até que o agente, ao revisar, não encontre mais nada: a revisão final fecha em 100%. Nesse ponto a PR está pronta, e o repositório aguarda o merge, que acontece fora do produto.

### Encerramento

O encerramento é **por repositório** e é a única transição acionada pelo usuário, porque depende de a PR ter sido mergeada fora do produto.

Quando a PR de um repositório é mergeada, o usuário aciona o encerramento daquele repositório. O produto então:

1. apaga a worktree daquele repositório;
2. atualiza a branch dev local do repositório, se ela estiver atrás da remota e o pull for possível.

Os demais repositórios da feature seguem no estado em que estão, cada um com sua PR e seu próprio encerramento.

### Arquivamento

Quando o último repositório da feature é encerrado, o produto arquiva a feature. Ela sai da área de trabalho e passa a existir apenas no histórico, com seus artefatos finais. Arquivar é exclusivo de features finalizadas; não é uma forma de guardar trabalho em andamento.

## Sessões

### Conversa própria

Toda sessão é uma conversa entre o usuário e o Claude Code, e essa conversa acontece **dentro do produto**, com interface própria, no mesmo padrão de refinamento do restante. O Claude Code roda por baixo, invisível. O usuário nunca abre um terminal nem gerencia janelas: ele entra na conversa de uma feature a partir do produto, responde, e sai.

As sessões desse workflow são estreitas: uma pergunta por vez, um resumo para review, um rascunho para aprovar. A interface é desenhada para esses momentos, e não para reproduzir um terminal.

### Renderização

Tudo que o agente escreve é renderizado como Markdown, com suporte a diagramas mermaid. Quando o agente responde uma pergunta com um diagrama, o usuário vê o diagrama, não o código dele. O mesmo visualizador é usado nas conversas, nos artefatos e na área de prompts.

### Permissões

As sessões rodam no modo auto do Claude Code, o mesmo que o usuário usa hoje. As escaladas de permissão que o modo auto não resolve sozinho aparecem no produto como "depende de mim", no mesmo lugar e com o mesmo tratamento das perguntas do agente. Não existe uma camada nova de aprovação de ferramentas.

### Modelo e esforço

Cada tipo de sessão tem um **modelo e um esforço padrão**, configurados no produto. Na criação da feature o usuário vê esses padrões e pode ajustar qualquer etapa para aquela feature. Os comandos que hoje ele digita no terminal para isso deixam de existir no fluxo: viram configuração.

### Pausar e descartar

Qualquer etapa em andamento pode ser **pausada**. A sessão para, e mais tarde o usuário retoma a mesma conversa de onde parou, sem perder o Q&A já feito. Pausar é a forma de interromper o trabalho para continuar depois, amanhã ou quando for.

Qualquer etapa em andamento também pode ser **descartada**. A sessão é encerrada e a etapa recomeça do zero na próxima vez que for iniciada.

### Auto-avanço

O produto detecta o fim de uma etapa pelo aparecimento do artefato dela no armazenamento, ou pelo commit, ou pela PR aberta, e inicia a etapa seguinte sozinho. O usuário segue direto de uma etapa para a outra, como faz hoje, sem precisar iniciar nada. Os artefatos ficam disponíveis para leitura a qualquer momento.

## Prompts

### Área de prompts

O produto tem uma área dedicada onde o usuário vê e edita o prompt de cada tipo de sessão, renderizado como Markdown. É o equivalente a editar as skills hoje, só que dentro do produto. O usuário itera nos prompts com a mesma liberdade que tem com as skills.

### Prompts existentes

- **PRD**: reproduz a skill `gm-prd`.
- **Tech spec**: reproduz a skill `gm-tech-spec`.
- **Plano de tasks**: reproduz a skill `gm-plan-tasks`, com o campo de repositório em cada task.
- **Implementação**: o template do arquivo de task, que é o prompt integral da sessão de implementação.
- **Commit**: commita as alterações aprovadas com uma mensagem simples e legível. Na etapa de review de PR, também sobe o commit para a PR.
- **PR**: prepara o rascunho de título e descrição, apresenta ao usuário e, após o OK, abre a PR na branch base configurada, dev por padrão, perguntando quando ela não existe.
- **Review de PR**: revisa a PR, apresenta as alterações que considera necessárias, implementa as que o usuário aprovar e repete até a revisão fechar limpa.

### Diferenças em relação às skills

Os prompts de PRD, tech spec e plano de tasks são o texto das skills com os ajustes que o produto exige:

- os caminhos de PRD, tech spec e tasks apontam para o armazenamento do produto, não para uma pasta `planning/` no repositório;
- cada task carrega o repositório em que será implementada;
- o template da task não tem mais a linha de status nem os passos de commit e atualização de status. O status é do produto, e o commit é feito pela sessão de commit depois da aprovação.

As skills em `~/.claude/skills` continuam existindo e utilizáveis fora do produto. O produto não depende delas.

## Artefatos e histórico

Todos os artefatos ficam no armazenamento do produto, fora dos repositórios. Os repositórios não recebem pasta de planejamento, arquivos de task nem marcação de status. O usuário lê os artefatos pelo produto, com renderização de Markdown e mermaid.

O histórico é a lista de features finalizadas e arquivadas, cada uma com seus artefatos finais: PRD, tech spec e tasks. O histórico não guarda versões intermediárias dos artefatos nem as conversas das sessões.

## Controle e visibilidade

### Visão principal

A visão principal é a área de trabalho: a árvore de raiz e repositórios, com as features em andamento em cada nó. Para cada feature o usuário vê, sem abrir nada:

- em qual etapa ela está;
- se está em implementação, qual task está em andamento e quantas faltam;
- o estado da task atual, incluindo o progresso do review quando está em review;
- se ela depende dele agora, e para quê;
- se está pausada.

O usuário escolhe onde entrar. O produto mostra tudo e sinaliza o que espera por ele, mas não impõe uma ordem nem empurra o usuário de uma sessão para outra.

### Estados de uma feature

- Em PRD, em tech spec, em plano de tasks.
- Em implementação, com a task N de M.
- Em PR e em review de PR, por repositório.
- Aguardando encerramento, por repositório, quando o review de PR fechou limpo.
- Pausada, em qualquer etapa.
- Arquivada, visível só no histórico.

### Estados de uma task

- Não iniciada.
- Bloqueada por worktree suja, aguardando o usuário limpar ou autorizar.
- Implementando.
- Aguardando review, com o resumo apresentado.
- Em review, com o percentual de arquivos em stage.
- Pronta para aprovar, com 100% em stage.
- Commitando.
- Concluída.

### Depende de mim

Uma feature depende do usuário quando qualquer uma destas situações acontece:

- o agente fez uma pergunta em qualquer etapa;
- o agente apresentou o resumo de uma task e aguarda review;
- uma task está com 100% em stage e aguarda aprovação;
- o agente apresentou o rascunho de uma PR e aguarda o OK;
- o review de PR encontrou alterações e aguarda a decisão do usuário;
- uma escalada de permissão do modo auto precisa de resposta;
- uma task não pôde iniciar porque a worktree está suja;
- o review de PR fechou limpo e o repositório aguarda o encerramento.

Esse estado é visível de longe, na visão principal, sem abrir a feature.

### Progresso

O produto mede e mostra progresso em todos os níveis em que ele é derivável: etapas concluídas na feature, tasks concluídas na implementação, arquivos em stage no review de uma task, repositórios encerrados no fechamento. O progresso do review, calculado sobre o git da worktree, é o exemplo do nível de detalhe esperado em toda a interface.

### Notificações

Quando algo passa a depender do usuário e ele não está olhando para o produto, o produto envia uma notificação do sistema. A notificação identifica a feature e o que ela precisa.

## Paralelismo

O produto foi feito para várias features em andamento ao mesmo tempo, na mesma área de trabalho:

- **Entre features**, tudo é paralelo. Cada feature tem sua sessão ativa, e o usuário alterna entre elas pelo produto. Features no mesmo repositório não se misturam, porque cada uma tem sua própria worktree.
- **Dentro de uma feature**, as tasks são sempre em sequência, uma de cada vez, na ordem do plano.

Não há terminais para gerenciar. O produto é o único lugar onde tudo isso acontece.

## Controles sobre features e etapas

- **Pausar etapa**: interrompe a sessão em andamento, preservando a conversa para retomar depois. É a forma de parar o trabalho de uma feature e continuar em outro momento. A feature permanece na área de trabalho.
- **Descartar etapa**: encerra a sessão em andamento e recomeça a etapa do zero quando for iniciada de novo.
- **Apagar feature**: para o que estiver rodando, apaga as worktrees que existirem e remove a feature em definitivo. É a ação para quando o usuário decidiu não continuar aquele trabalho.
- **Encerrar repositório**: depois da PR mergeada, apaga a worktree e atualiza a branch local.
- **Arquivar**: acontece automaticamente quando o último repositório da feature é encerrado. Só features finalizadas são arquivadas.

## Experiência

A interface e a experiência de uso são o produto. Requisitos:

- **Design extremamente polido, bonito e moderno.** Cada tela, componente e estado é desenhado com cuidado. Nada é genérico ou improvisado.
- **Refinamento em cada interação.** O nível de detalhe do progresso do review, calculado sobre os arquivos em stage e atualizado em tempo real, é a régua para todo o resto: cada informação que pode ser derivada e é útil para o usuário é mostrada, no lugar certo, no momento certo.
- **Clareza imediata.** Ao abrir o produto, o usuário sabe em segundos o que está em andamento, em que ponto, e o que espera por ele.
- **Conversas de primeira classe.** O chat de cada sessão é uma interface própria, desenhada para os momentos do workflow, com Markdown e mermaid renderizados.
- **Zero atrito nas transições.** O usuário nunca digita comando, nome de feature ou caminho de arquivo. Nunca abre terminal. Nunca procura onde parou.
- **Controle sempre à mão.** Pausar, descartar, aprovar, dar OK, encerrar e apagar são ações claras e acessíveis no contexto em que fazem sentido.
