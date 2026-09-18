# Centro de comando: a quebra em tasks

A ideia descrita no [README](./README.md) é grande demais para uma task. Este documento a quebra em quatro tasks, uma por frente, cada uma uma pull request neste repositório, conduzida pelo fluxo do produto: PRD, tech spec, plano e steps. A definição de cada task é o contexto inicial com que ela é criada, e foi escrita para isso: diz o que entra, o que fica de fora, o que já está decidido e o que o PRD ainda decide. O README é a visão; a definição a refina, e o que ela decide o PRD não rediscute.

## Critérios da quebra

- **Uma task é um comportamento completo.** Cada task entrega uma frente inteira do ponto de vista do usuário, e não uma camada técnica nem um pedaço sem valor sozinho. Uma task é grande: um PRD e um tech spec completos e um plano de muitos steps, cada um revisado e commitado.
- **O produto funciona inteiro depois de cada task.** Nada fica meio migrado.
- **O que é destrutivo vem antes e sozinho.** A primeira task remove conceitos, a task de raiz e a área de trabalho, e migra os dados existentes. As três seguintes são aditivas.
- **A ordem é a do README.** Boards e repositórios, depois do card à task junto com os boards, depois o centro de review, depois a discussão. A ordem entre as duas últimas pode ser trocada.

## Visão geral

| # | Task | Depende de | Estado |
|---|---|---|---|
| 1 | [`registered-repositories`](#1-registered-repositories): repositórios no lugar da área de trabalho, tasks de um repositório só | nada | entregue |
| 2 | [`boards`](#2-boards): boards do GitHub Projects e a task a partir de um card | 1 | entregue |
| 3 | [`review-center`](#3-review-center): o centro de review das pull requests | 2 | entregue |
| 4 | [`discussion`](#4-discussion): a discussão que produz cards e épicos | 2 | a fazer |

As tasks entregues estão descritas como o produto é em `docs/product/features.md` e `docs/architecture/`; a definição delas fica aqui como o contexto com que foram criadas. As tasks 3 e 4 são independentes entre si. O nome de cada task é o nome com que ela é criada no produto.

## O que atravessa todas as tasks

- **GitHub pelo `gh`.** Tudo o que o produto lê e escreve no GitHub, boards, issues, sub-issues, pull requests e reviews, passa pelo `gh` já autenticado na máquina, com a conta que ele tem, como a etapa de PR faz hoje. É a resposta ao ponto em aberto sobre autenticação: o produto não tem conta nem token próprios. Quando o `gh` não está instalado, não está autenticado ou não tem o escopo que uma leitura precisa, como o de projects para os boards, o produto diz isso onde a leitura falhou e o que fazer. O tech spec da task 2 fixa o mecanismo, e as seguintes o reutilizam.
- **Itens com conversa que não são tasks.** O review de uma pull request e a discussão são itens de primeira classe: têm conversa, artefatos, situações que esperam pelo usuário e lugar no histórico, como uma task, mas sem etapas. A primeira task que introduz um deles, a 3 nesta ordem, estabelece como o produto trata um item assim; a outra reutiliza.
- **Documentação.** Cada task atualiza `docs/product/features.md` e `docs/architecture/` para o produto como ele fica. Quando a última task entrar, a pasta desta ideia é removida do roadmap, como o [README do roadmap](../README.md) pede.

---

## 1. `registered-repositories`

### Repositórios no lugar da área de trabalho

O produto deixa de abrir uma pasta. Ele conhece repositórios cadastrados, cada um com o remote e o caminho local do clone, e a visão principal mostra as tasks de todos eles. Toda task pertence a exatamente um repositório e abre exatamente uma pull request: a task de raiz e a task cujo plano espalha steps por mais de um repositório deixam de existir. É a mudança de conceito mais profunda da ideia, feita sozinha e antes dos boards, para que o board, ao chegar, só agrupe repositórios e tasks que já têm a forma certa.

**O que entra**

- **Cadastro de repositórios.** O usuário adiciona um repositório escolhendo a pasta do clone no seletor nativo; o produto lê o remote e passa a identificar o repositório por ele, no formato `dono/nome`. Uma pasta que não é um repositório git ou não tem remote no GitHub é recusada com a razão. Um repositório pode ser removido quando não tem task, ativa ou arquivada; com tasks, o produto diz o que impede. O cadastro vive numa página **Repositories** das configurações, e a tela de boas-vindas, que aparece enquanto nenhum repositório está cadastrado, leva a ela.
- **Visão principal.** A barra lateral passa a ser **Waiting for you** no topo e a lista de todas as tasks, cada uma com o seu repositório, com filtro por repositório. Não há nós de navegação por pasta nem por repositório. `Ctrl+N` abre o diálogo de criação de qualquer lugar.
- **Task de um repositório só.** O diálogo de criação ganha o repositório como campo obrigatório. O plano não escolhe repositório: todos os steps são do repositório da task, e um step que nomeia outro torna o plano inválido, com a correção pedida como para os outros problemas de plano. A task tem uma worktree só, criada no primeiro step e usada por todos. A etapa de PR tem uma conversa, um rascunho e uma pull request, sem abas por repositório e sem repositório pulado; o encerramento é o da task, e ao encerrar a task é arquivada. O histórico mostra a pull request e o encerramento da task. A observação de que uma task One-Shot nasce sempre num repositório deixa de existir, porque vale para todas. Os prompts e o texto da interface que falam de "repositórios da task" passam a falar de um repositório.
- **Nome da task** único por repositório, porque ele nomeia a branch e a worktree.
- **Worktrees** num diretório do produto, dentro do diretório de dados, com um nível por repositório e um por task. A pasta `.myspec` ao lado dos repositórios deixa de existir. Uma worktree já registrada em outro caminho continua sendo usada e removida de onde está.
- **Artefatos** numa pasta por task, sem a pasta por área de trabalho.
- **Histórico** único, com todas as tasks arquivadas de todos os repositórios.
- **Sai do produto**: abrir uma pasta, o argumento de linha de comando com a pasta, `Ctrl+O`, as áreas de trabalho recentes, o scan de repositórios e a árvore. A instância única continua: abrir o app de novo traz a janela para a frente.

**O que fica de fora**

- Boards, cards e a leitura de qualquer coisa do GitHub. Clonar um repositório: aqui um repositório é cadastrado a partir do clone que já existe; o clone pelo produto vem com os boards.

**Decisões**

- Nenhuma task de repositório se perde: as tasks e as tasks arquivadas de cada área de trabalho passam a pertencer aos seus repositórios, que o produto cadastra sozinho na atualização a partir do caminho que cada task já guarda. Tasks na raiz ou com steps em mais de um repositório não são migradas: o produto é usado por uma pessoa, que encerra ou apaga essas tasks antes de atualizar. O tech spec decide o mecanismo; o PRD confirma o comportamento.
- O produto exige que o repositório tenha um remote no GitHub, porque é o GitHub que dá valor a tudo o que vem depois.
- O tech spec decide se o cabeçalho de repositório do arquivo de step continua existindo; o prompt de plano deixa de pedir ao agente que distribua steps entre repositórios.

---

## 2. `boards`

### Boards do GitHub Projects e a task a partir de um card

O produto cadastra boards do GitHub Projects, com os repositórios que cada um administra, lê os cards de cada board e cria tasks a partir deles, com o repositório do card e o contexto que o board já tem: o card, o épico e os cards irmãos. A pull request da task nasce vinculada ao card. É a primeira leitura do GitHub além da pull request de uma task, e a ponte entre o board e o ciclo que o produto já conduz.

**O que entra**

- **Cadastro de um board** pela URL do GitHub Projects, de organização ou de usuário. O produto lê o título do board, as colunas de status e os campos dele.
- **Repositórios do board.** O produto sugere os repositórios que aparecem nos cards do board; o usuário confirma quais o board administra e pode acrescentar outros por `dono/nome`. Cada repositório de um board é um repositório cadastrado, ligado a um clone local ou ainda sem clone.
- **Repositório sem clone.** Aparece no produto como os outros. O produto oferece cloná-lo quando algo precisa dele, numa pasta escolhida uma vez nas configurações, em que cada clone ganha a pasta com o nome do repositório.
- **Repositório sem board.** Continua possível, para o trabalho que não passa por board nenhum, como este repositório. Na interface esses repositórios ficam agrupados como sem board.
- **Leitura dos cards.** Para cada board, as issues que estão nele: título, número, repositório, status, os campos do board (responsável, estimativa, módulo, pull request vinculada e datas), o épico ao qual pertence, pela issue pai, e as dependências. A leitura acontece ao abrir a visão do board e por um botão de atualizar.
- **Visão do board.** Uma tela por board com os cards agrupados por status, com filtro por repositório, status e responsável. Cada card abre no GitHub e mostra a task que nasceu dele, quando existe, abrindo-a.
- **Start task** num card abre o diálogo de criação com o nome sugerido a partir do título do card, o repositório fixo no do card, e o modo, o modo de review e os modelos como sempre. Se o repositório não tem clone, o produto oferece cloná-lo antes. Um card tem no máximo uma task ativa; **Start task** some enquanto ela existe e volta quando ela é arquivada ou apagada.
- **Contexto inicial** montado pelo produto: o card, com título, número, corpo e módulo; o épico, com título e corpo, quando existe; e os cards irmãos, com título, número e status. O usuário pode acrescentar texto. Esse contexto é a primeira mensagem do PRD, ou do planejamento One-Shot, como o contexto inicial de hoje.
- **A task lembra o seu card.** O cabeçalho da task mostra o card, com número, título, status no board e link. Task sem card continua sendo criada como hoje, por `Ctrl+N`.
- **Dependência não mergeada** é um aviso no diálogo, com cada dependência e o estado dela, card e pull request, e nunca um bloqueio.
- **Pull request vinculada ao card.** O rascunho da pull request nasce com a referência que fecha o card, e o prompt de PR recebe o card para escrever a descrição. É assim que o board mostra a pull request no card.
- **Barra lateral.** Um nó por board, com os épicos como nós que agrupam as tasks dos seus cards e as tasks sem épico direto sob o board, mais o grupo dos repositórios sem board, no lugar da lista única da task 1. Um épico sem task não aparece. O filtro por repositório continua. As discussões entram nesse nó com a task 4.
- **Falta de acesso.** Um board que o `gh` não consegue ler, por escopo, permissão ou rede, diz isso na visão do board e na barra lateral, com o que fazer, e as tasks dos seus repositórios continuam funcionando.

**O que fica de fora**

- Escrever qualquer coisa no GitHub além da referência ao card na pull request. Mover o status de um card, preencher qualquer campo do board. O documento da discussão no contexto da task, que vem com a task 4.

**Decisões**

- **Épico** é lido pelo recurso nativo de issue pai e sub-issues. A convenção antiga no corpo dos cards, "Épico: repo#N" e "Depende de: repo#N", também é lida, para que os cards que já existem no board apareçam com épico e dependências; o produto nunca a escreve. É a resposta ao ponto em aberto do README, e o PRD confirma.
- **Dependência** é lida pela relação nativa entre issues quando ela existe para a organização, e pela convenção no corpo nos demais casos. O tech spec verifica o que o GitHub oferece.
- Os campos nativos de progresso de sub-issues não são usados, como no board.
- O PRD continua sendo uma etapa numa task criada de um card. Com o contexto do card ele tende a ser curto; o prompt de PRD deve saber aproveitar o contexto que já veio em vez de perguntar o que o card responde.

---

## 3. `review-center`

### O centro de review das pull requests

Uma visão com todas as pull requests abertas nos repositórios cadastrados, de qualquer autor, tenham nascido de uma task do produto ou não, e o review de qualquer uma delas no produto: o agente revisa o diff com o card e as instruções do usuário, escreve um relatório numerado, o usuário decide item a item, e o produto publica o review no GitHub com cada apontamento aprovado como comentário na linha do diff. Um commit novo reabre o ciclo. O review é um item de primeira classe do produto, com conversa, relatórios e lugar na barra lateral, no **Waiting for you** e no histórico.

**O que entra**

- **Visão Reviews.** Um nó **Reviews** na barra lateral, entre **Waiting for you** e os boards, abre a lista de pull requests abertas de todos os repositórios cadastrados, com board ou sem. Cada pull request mostra título, número, repositório, autor, labels, o card vinculado e o status dele no board, se o usuário já a revisou e se há commits novos desde o último review do usuário. Uma pull request de uma task do produto é sinalizada e abre a task. Cada pull request abre no GitHub, e um repositório que o produto não consegue ler aparece com a falha e a razão.
- **Filtros** por board, repositório, autor e label, lembrados entre sessões do app, para que uma exclusão como a das pull requests de dependabot seja feita uma vez.
- **Leitura** ao abrir a visão, por um botão de atualizar e periodicamente enquanto o app está aberto; as pull requests com review no produto são lidas com a mesma cadência das pull requests das tasks.
- **Iniciar o review** de uma pull request da lista. O produto cria uma worktree na branch da pull request, no diretório de worktrees do produto, e abre a conversa de review com o prompt de review de pull request: o card no lugar do PRD e do tech spec quando existe, o diff sempre, e as instruções. Uma pull request de um fork não pode ser revisada por enquanto, e o produto diz isso.
- **Instruções.** Um campo opcional ao iniciar o review e ao pedir uma nova passada, para o contexto de uma pull request sem card ou para pedir atenção a um ponto. E instruções fixas por repositório, editadas na página **Repositories** das configurações, que entram em todo review daquele repositório, inclusive no review das pull requests das tasks do produto.
- **O relatório.** Numerado, com cada apontamento ancorado a um arquivo e a uma linha do diff, e um resumo. O produto mostra os apontamentos e o usuário aprova ou descarta cada um, podendo editar o texto, como edita o rascunho de uma pull request. A conversa fica aberta para discutir um apontamento antes de decidir.
- **Publicar.** Com as decisões tomadas, o usuário escolhe o veredito, aprovação, pedido de mudanças ou só comentários, e o produto publica um review no GitHub com cada apontamento aprovado como comentário inline e o resumo no corpo. Um relatório sem apontamento aprovado publica só o resumo e o veredito. A pull request passa a aparecer como revisada na lista.
- **Corrigir a própria pull request.** Numa pull request cujo autor é o usuário, aberta fora do produto, o review oferece ao iniciar uma escolha entre publicar e aplicar. Ao aplicar, o agente corrige na worktree só o que foi aprovado; as mudanças passam pelo review do produto, stage arquivo a arquivo no editor, progresso em tempo real e **Aprovar** em 100%; o commit é feito pelo agente com o prompt de commit e sobe para a pull request; e o agente revisa de novo, até um relatório limpo. É o ciclo do review da pull request de uma task, para uma pull request sem task. Uma pull request de outro autor não tem a escolha, e a de uma task do produto continua sendo revisada na task.
- **Commits novos.** Um commit novo desde o último review publicado é uma situação que espera pelo usuário: aparece no review, na lista, em **Waiting for you**, e gera a notificação do sistema com o som do produto. **Revisar de novo**, a qualquer momento, com ou sem commit novo, pede uma nova passada na mesma conversa, com o diff atual e o que mudou desde o último review, e um novo relatório numerado; os relatórios de todas as passadas ficam visíveis.
- **O review como item.** Aparece sob **Reviews** na barra lateral, com o estado da conversa; espera pelo usuário quando o relatório está pronto para decisão, quando há commits novos, quando o agente pergunta, pede permissão ou a sessão falha; termina quando a pull request é mergeada ou fechada, e vai para o histórico com os relatórios. A worktree é removida quando o review termina. Um review pode ser apagado a qualquer momento, com a worktree.

**O que fica de fora**

- Responder threads da pull request: a conversa com o autor continua no GitHub. Mover o status do card ao publicar o review. Pull requests de forks.

**Decisões**

- O prompt de review de pull request continua sendo um texto só, que serve à pull request de uma task e à de fora, com as seções que o produto acrescenta, como faz com a task One-Shot. O tech spec decide como o card, o diff e as instruções chegam ao prompt.
- O modo, publicar ou aplicar, é escolhido uma vez por review e não muda depois.
- O plano deve deixar o modo de corrigir a própria pull request para os últimos steps, para que a task possa entregar sem ele se crescer demais; nesse caso ele vira uma task própria.

---

## 4. `discussion`

### A discussão que produz cards e épicos

A discussão é um item de primeira classe do produto, como a task, mas sem etapas: uma conversa para entender uma demanda, que deixa um documento com o entendimento e produz cards no board, novos ou a atualização de cards que já existem, soltos ou reunidos num épico. É a frente que cobre o trabalho antes da task.

**O que entra**

- **Criar uma discussão** a partir de um board, com um texto do usuário, um ou mais cards existentes selecionados na visão do board, ou os dois. A discussão abre uma conversa com o prompt de discussão, o nono prompt do produto, editável como os outros nas configurações. O prompt carrega o estilo dos cards do board, contexto, problema, o que a entrega inclui e o que fica de fora, sem propor a solução, e é o prompt em que o usuário mais vai mexer. Os cards de entrada chegam à conversa com título, corpo, campos, épico e dependências.
- **Acesso aos repositórios.** A conversa lê o código dos repositórios do board que têm clone, porque entender o problema exige olhar o código mesmo quando a solução não é discutida. Ao criar a discussão o produto lista os repositórios do board sem clone e oferece cloná-los.
- **O documento.** A discussão termina com um documento, guardado como os outros artefatos e visível no painel, com o entendimento a que se chegou: contexto, problema, restrições, o que entra e o que não entra.
- **Rascunhos de cards.** Junto com o documento, o agente escreve rascunhos, cada um com título, corpo, repositório, módulo e dependências, entre os rascunhos ou de cards que já existem. Um rascunho é um card novo ou a atualização de um card existente, com título, corpo, módulo, dependências e épico; para uma atualização o produto mostra a diferença em relação ao card como está no GitHub. Os rascunhos aparecem editáveis no produto, como o rascunho de uma pull request, e o usuário aprova um a um. Uma discussão pode render um único card, ou misturar novos e atualizações.
- **Épico.** Com dois ou mais rascunhos, o usuário pode agrupá-los num épico, que ganha um rascunho próprio, com título, corpo e o repositório em que a issue pai vive, editável e aprovado como os outros. Uma discussão pode também acrescentar cards a um épico que já existe no board.
- **Publicar.** Ao aprovar um rascunho novo o produto cria a issue no repositório, a coloca no board com o módulo preenchido e registra as dependências; ao aprovar uma atualização, atualiza a issue. Ao aprovar um épico, cria a issue pai, cria os cards como sub-issues dela, coloca tudo no board e registra as dependências entre os cards, cuja ordem é dada por elas. Estimativa, responsável, datas e os demais campos ficam para o GitHub.
- **Contexto da task.** Uma task criada de um card que nasceu ou foi refinado numa discussão recebe também o documento da discussão no contexto inicial, junto do card, do épico e dos irmãos que a task 2 já monta. O épico criado aparece como nó sob o board, como os lidos do GitHub.
- **A discussão como item.** Aparece sob o board na barra lateral, junto das tasks; espera pelo usuário quando há rascunhos aguardando OK, pergunta, permissão ou falha; é arquivada pelo usuário quando termina, com a conversa, o documento e os cards que gerou, e o histórico a mostra assim.

**O que fica de fora**

- Mover o status de um card, responder threads, preencher os demais campos do board: tudo continua fora do escopo da ideia.

**Decisões**

- Um card criado pela discussão entra no board com o status `A Fazer`, porque já foi entendido e escrito; o status inicial é parte de criar o card, não de movê-lo. Um card refinado não muda de status: quem o move de Backlog para A Fazer é o usuário, no GitHub. O PRD confirma.
- A discussão guarda a conversa no histórico, ao contrário da task, porque a conversa é parte do entendimento a que se chegou.
- Num épico multi-repositório, a issue pai vive num repositório do board escolhido pelo usuário no rascunho. O PRD decide o padrão sugerido.
