# Centro de comando

## O problema

Hoje o produto cobre o ciclo de uma task: PRD, tech spec, plano, implementação, pull request, review e encerramento. Isso substitui o workflow que antes era feito à mão, mas é só uma parte do trabalho de um tech lead. O resto acontece fora do produto: entender uma demanda e escrever o card dela no GitHub Projects, quebrar um trabalho grande em épico e cards, decidir a ordem e as dependências, e revisar as pull requests de todo o time, não só as das próprias tasks.

A ideia é o produto passar a cobrir esse trabalho de ponta a ponta, virando o lugar único de onde tudo é conduzido: da discussão de uma demanda até o review da pull request que a entrega, para qualquer repositório e qualquer autor. Três frentes: antes da task, com discussões que produzem cards e épicos; a ponte, em que um card vira uma task; e depois da task, com um centro de review de todas as pull requests.

## O board de referência

O board que orienta a ideia é o [Faturamento](https://github.com/orgs/ICSF-Faturamento/projects/18), um GitHub Projects de organização que administra cerca de dez repositórios. O que ele estabelece, e que o produto assume como dado:

- **Status** em colunas: Backlog, A Fazer, Em andamento, Revisão de código, Ajustes, Aprovado, Disponível em dev, Pronto para release, Concluído e Pausado. Revisão de código, Ajustes e Aprovado acompanham o estado da pull request. Disponível em dev e os seguintes dependem de deploy e validação, que o produto não vê.
- **Campos** de cada card: responsável, data de início, estimativa, pull request vinculada, data de fim e módulo. Os campos nativos de issue pai e progresso de sub-issues existem no board e não são usados.
- **Convenções**: relação 1:1 entre card e pull request; a pull request sempre vinculada ao card; épico e dependência escritos hoje no corpo da issue, como "Épico: repo#N" e "Depende de: repo#N".
- **Estilo dos cards**: cada card descreve o contexto, o problema, o que a entrega inclui e o que fica de fora, sem propor a solução. A solução é de quem implementa.
- **Entradas cruas**: o backlog tem cards de uma linha, que precisam ser entendidos e reescritos antes de ir para A Fazer. Refinar um card existente é tão comum quanto escrever um novo.

## Decisões

- **O board é a fonte de verdade do time, não o produto.** O produto lê o GitHub Projects e escreve apenas o que o time vê lá: issues, sub-issues e reviews de pull request. Conversas, artefatos e o progresso de cada task continuam privados no produto, como hoje.
- **Não existe mais workspace.** O produto cadastra boards e, em cada board, os repositórios que ele administra. A visão principal mostra tudo de todos os boards; board e repositório são filtros, não contextos. Se um agrupamento por pasta ainda fizer sentido, ele é no máximo um filtro, nunca uma feature central. As worktrees passam a viver num diretório do produto.
- **Card é task, e uma task toca um único repositório.** Cada card vira exatamente uma task, e cada task abre exatamente uma pull request. Isso é o 1:1 entre card e pull request que o board já pede. Trabalho que toca mais de um repositório é sempre um épico com um card por repositório. A task de raiz, que hoje atravessa repositórios com um PRD e steps em vários repositórios, deixa de existir.
- **Épico é contexto e agrupamento, não uma task.** Um épico reúne cards, dá a eles contexto compartilhado e uma ordem. Ele nunca é implementado; os cards são. Um épico pode ser multi-repositório, com um card por repositório, ou de um único repositório, quando o trabalho é grande e vira uma sequência de cards no mesmo lugar. Trabalho multi-repositório sempre precisa de um épico para centralizá-lo, a menos que sejam tasks independentes ligadas só por dependência.
- **Épico é uma issue com sub-issues**, o recurso nativo do GitHub, e não a convenção no corpo da issue usada hoje.
- **Dependência é uma relação entre cards**, com ou sem épico. Uma sequência de cards não precisa de um épico pai.
- **Task sem card continua existindo.** Nem todo trabalho merece um card no board: algo pessoal, um experimento, este próprio repositório. Criar uma task diretamente, como hoje, segue possível.
- **Não automatizar o trivial.** O que leva um clique no GitHub fica no GitHub: estimativa, responsável, datas, status do card. O esforço vai para o que é trabalho de verdade: entender, escrever, revisar.

## O modelo

- **Board**: um GitHub Projects cadastrado no produto, com os repositórios que ele administra.
- **Repositório**: um repositório de um board, com o remote e o caminho local do clone. É um atributo de task e de pull request, e um filtro. Um repositório do board sem clone local ainda aparece no produto, e o produto oferece cloná-lo quando algo precisa dele.
- **Discussão**: uma conversa para entender uma demanda e produzir cards. Não tem etapas e não implementa nada.
- **Épico**: uma issue pai com sub-issues, cada uma um card. Contexto compartilhado e ordem dos cards.
- **Card**: uma issue de um repositório. É a entrada de uma task.
- **Task**: como hoje, mas sempre de um único repositório e opcionalmente ligada a um card e a um épico.
- **Review**: o review de uma pull request de um repositório de um board, de qualquer autor, com ou sem task no produto.

## Discussão e cards

A discussão é um item de primeira classe, como a task, mas sem etapas. É uma conversa com o Claude Code, com prompt próprio, aberta com acesso aos repositórios do board, porque entender o problema exige olhar o código mesmo quando a solução não é discutida.

- **Entrada**: um texto do usuário, um ou mais cards existentes que precisam de refinamento, ou os dois.
- **Objetivo**: entender o contexto, definir o problema, as restrições e o que a entrega inclui e não inclui. A solução fica para quem implementa. O estilo dos cards, contexto, problema, entrega e o que não entra, vive no prompt de discussão, editável como os outros prompts, e é o prompt em que o usuário mais vai mexer.
- **Saída**: rascunhos de cards, editáveis, aprovados um a um pelo usuário. Cada rascunho traz título, corpo, repositório, módulo, épico e dependências. Um rascunho pode ser um card novo ou a atualização de um card existente. Estimativa, responsável, datas e os demais campos do board são preenchidos no GitHub.
- **Épico**: quando a discussão produz vários cards, o usuário decide se eles formam um épico. O produto cria a issue pai, as sub-issues e registra as dependências entre os cards. Uma discussão pode também render um único card.
- **Documento**: além dos cards, a discussão deixa um documento próprio, guardado no produto como os outros artefatos, com o entendimento a que se chegou. É ele que dá contexto ao épico e às tasks que nascerem dos cards.
- **Fim**: a discussão fica arquivada com a conversa, o documento e os cards que gerou.

O produto cria as issues com o mesmo padrão do rascunho de pull request de hoje: o agente escreve, o usuário edita e dá o OK, o produto publica.

## Do card à task

Uma task pode ser criada a partir de um card. O produto sugere o nome a partir do título do card, fixa o repositório do card e monta a primeira mensagem do PRD com o card, o épico ao qual ele pertence, os cards irmãos e o documento da discussão que o gerou, quando existem.

O PRD continua sendo uma etapa, porque às vezes é preciso aprofundar; com esse contexto ele tende a ser curto, muitas vezes uma confirmação. Tech spec, plano, implementação, pull request e review seguem como são hoje. A pull request da task fica vinculada ao card.

Uma dependência ainda não mergeada é um aviso na criação da task, não um bloqueio.

## Centro de review

Uma visão com todas as pull requests abertas nos repositórios dos boards, de qualquer autor, inclusive as do próprio usuário, tenham nascido de uma task do produto ou não. Uma pull request de uma task aparece na task e no centro de review; o produto sinaliza o vínculo e a duplicação é aceita, porque uma pull request do usuário pode ter sido aberta por outro fluxo.

Cada pull request mostra o autor, o repositório, o card vinculado, o status no board e se há commits novos desde o último review do usuário. Filtros por board, repositório, autor e label deixam de fora o que não interessa, como as pull requests de dependabot. Uma pull request sem card nunca é ignorada pelo produto; ela é revisada com o diff e as instruções do usuário.

Revisar uma pull request:

- cria uma worktree na branch dela e abre a sessão de review com o prompt de review de pull request, com o card no lugar do PRD e do tech spec quando existe, e com o diff sempre;
- aceita **instruções** do usuário: um campo dinâmico, opcional, ao iniciar o review e ao pedir uma nova passada, para dar o contexto de uma pull request sem card ou para pedir atenção a um ponto específico, como um padrão do repositório. Além dele, cada repositório pode ter instruções fixas de review, guardadas no produto, que entram em todo review daquele repositório, para que o mesmo aviso não seja redigitado a cada pull request;
- produz um relatório numerado, como hoje, que o usuário decide item a item.

O que acontece com o relatório depende da pull request. Numa pull request de uma task do produto, o agente aplica o que o usuário aprovou, e o ciclo de stage, aprovação, commit e nova passada é o de hoje. Numa pull request de outro autor, o agente não corrige nada: o produto publica um review no GitHub, com cada apontamento aprovado como comentário inline na linha do diff e um resumo no corpo do review, com aprovação ou pedido de mudanças. Numa pull request do próprio usuário aberta fora do produto, ele escolhe entre os dois modos.

Um commit novo numa pull request já revisada reabre o ciclo e é uma situação que espera pelo usuário, com a mesma visibilidade e notificação das outras. A conversa com o autor nas threads da pull request continua no GitHub.

## Barra lateral

Sem workspace, a barra lateral passa a ser: **Waiting for you** no topo, como hoje; **Reviews**, com as pull requests que esperam pelo usuário; e um nó por board, com os épicos, as tasks e as discussões daquele board. As discussões ficam junto das tasks porque são poucas e curtas. O repositório deixa de ser um nó de navegação e vira um atributo com filtro.

## Fora do escopo por enquanto

- **Mover o status do card no board.** O produto lê o status; quem move é o usuário. A proposta que ficou para depois, se um dia valer a pena: mover só o que o produto sabe com certeza. Task em implementação, Em andamento; pull request aberta, Revisão de código; review pede mudanças, Ajustes; review aprovado, Aprovado; mergeada, nada, porque Disponível em dev depende de deploy. O mesmo nas pull requests dos outros quando o usuário publica o review.
- Responder threads da pull request pelo produto.
- Preencher estimativa, responsável, datas e os demais campos do board.
- Bloquear uma task por dependência não mergeada; é só um aviso.

## Em aberto

- Os cards existentes usam a convenção de épico e dependência no corpo. O produto passa a criar épicos como sub-issues; se ele deve ler a convenção antiga nos cards que já existem é uma decisão para o PRD da frente de boards.
- Como o produto se autentica no GitHub e com qual conta, dado que hoje ele depende do `gh` já autenticado.

## Ordem sugerida

1. **Boards e repositórios no lugar do workspace.** É a base que as outras frentes usam, e a mudança de conceito mais profunda.
2. **Do card à task.** Barato e de valor imediato: conecta o que já existe ao board.
3. **Centro de review.** A segunda frente de maior valor, e a mais independente das outras.
4. **Discussão e cards.** Reaproveita o padrão de rascunho e a criação de sessão que já existem.

As duas últimas frentes têm o mesmo peso para o usuário; a ordem entre elas é só uma sugestão.
