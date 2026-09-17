# Funcionalidades

Este documento descreve o produto como ele é. Começa pelos boards e pelos repositórios de onde as tasks vêm, segue a ordem do ciclo de vida de uma task e termina com o que atravessa todo o produto: sessões, atenção, modelos, prompts e configurações.

## Boards

O produto conhece os boards do GitHub Projects (v2) que o usuário cadastra, de organização ou de usuário, cada um com os repositórios que administra. Ele lê os cards de cada board e cria tasks a partir deles. Funciona com qualquer board: lê os status e os campos de cada um em vez de assumir uma estrutura.

Tudo o que o produto lê do GitHub passa pelo `gh` já autenticado na máquina, com a conta dele; o produto não tem conta nem token próprios. A única escrita no GitHub que vem de um board é a referência ao card na descrição da pull request.

Um repositório pertence a no máximo um board, e é o board do repositório que define onde as tasks dele aparecem na barra lateral.

### Página Boards

As configurações têm a página **Boards**. Ela lista os boards cadastrados, em ordem alfabética de título, cada um com o título, o dono e o tipo (`Organization` ou `User`), a quantidade de repositórios administrados, o link para o GitHub, a última leitura (`Updated 3 min ago`, `Not read yet` ou a falha da última leitura) e as ações **Edit** e **Remove**. Acima da lista fica **Add board**.

### Cadastrar um board

**Add board** abre um diálogo em etapas. Na primeira, o usuário cola a URL do board: `https://github.com/orgs/<org>/projects/<n>` ou `https://github.com/users/<usuário>/projects/<n>`, com ou sem sufixos como `/views/<n>` e parâmetros de query. O produto lê o board e recusa, com a razão:

- uma URL que não é de um GitHub Projects v2, com `This isn't the URL of a GitHub project.`; um Project clássico é recusado assim;
- um board já cadastrado, com `<título> is already registered.`;
- um board que não pode ser lido, com a falha da leitura (ver [Falhas](#falhas)).

Lido o board, o diálogo mostra o título e o dono e segue para as escolhas:

- **Status finais.** O produto identifica o campo de status do board, o campo de seleção única chamado `Status`, e lista as opções na ordem do board, cada uma com a marcação `Final`. Vêm pré-marcadas as opções cujo nome é, sem diferenciar maiúsculas nem acentos, `Done`, `Concluído`, `Closed`, `Completed`, `Fechado` ou `Finalizado`. Um board sem campo de status pula esta etapa.
- **Repositórios administrados.** O produto sugere os repositórios que aparecem nas issues do board, com a contagem de cards de cada um, todos marcados. O usuário desmarca os que o board não administra e pode acrescentar outros digitando `dono/nome`. Um texto fora dessa forma é recusado com `Type the repository as owner/name.`, e um repositório que não existe ou que a conta não lê, com `<dono/nome> doesn't exist or this account can't read it.`

Cada repositório diz como ficará ligado ao produto:

- `Registered · <caminho>`, ou `Registered · Not cloned`: já cadastrado, usa o cadastro existente;
- `Clone found · <caminho>`: não cadastrado, com um clone encontrado pela mesma varredura da pasta home de **Add repository**; será cadastrado nesse clone. Com mais de um clone encontrado, o usuário escolhe qual;
- `Registered without a clone`: não cadastrado e sem clone encontrado; será cadastrado sem clone;
- `<dono/nome> belongs to the board <título>.`: administrado por outro board; aparece desabilitado.

**Add board** confirma: o board é cadastrado, os repositórios marcados são cadastrados ou ligados a ele, e a primeira leitura dos cards começa.

### Editar e remover um board

**Edit** relê a estrutura do board no GitHub e reabre as mesmas escolhas, confirmadas com **Save**. Os status finais vêm como o board os guarda: opções que deixaram de existir somem e opções novas aparecem desmarcadas. Os repositórios do board vêm marcados, e os outros repositórios das issues aparecem desmarcados. Acrescentar um repositório segue as regras do cadastro. Um repositório desmarcado sai do board: vai para o grupo sem board quando tem clone ou tasks, e sai do produto quando não tem nenhum dos dois. As tasks dele não mudam.

**Remove** pede confirmação e diz o que acontece: `N repositories move to No board and M leave MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.` Os repositórios do board com clone ou com tasks, ativas ou arquivadas, passam ao grupo sem board; os sem clone e sem tasks saem do produto. As tasks criadas de cards do board continuam guardando o card e funcionando, e passam ao grupo **No board** da barra lateral. Nada é alterado no GitHub nem no disco.

### Leitura dos cards

Um board é lido ao abrir a visão dele, pelo botão de atualizar da visão e logo depois do cadastro. Não há leitura periódica. A última leitura bem-sucedida de cada board fica guardada e sobrevive a reinícios do app, então a visão e a barra lateral nunca esperam o GitHub. Uma leitura em curso não apaga nada: a visão mostra a leitura guardada, o indicador de leitura e depois a leitura nova. Uma leitura que falha mantém a guardada à vista, com a falha.

A leitura traz os itens do board que são issues abertas ou fechadas nos últimos 14 dias; issues fechadas há mais tempo não aparecem, e o histórico do board fica no GitHub. Rascunhos do Projects e pull requests adicionadas ao board são ignorados. Uma leitura traz no máximo 2.000 issues. De cada card:

- título, número, repositório, estado da issue (aberta ou fechada), corpo, link e responsáveis;
- o status no board e os demais campos preenchidos, dos tipos texto, número, data, seleção única e iteração;
- as pull requests vinculadas à issue, com o estado de cada uma (`Open`, `Merged` ou `Closed`);
- o **épico**: a issue pai nativa, quando existe. Sem ela, o produto procura no corpo uma linha de épico da convenção e resolve a referência;
- os **cards irmãos**: as outras sub-issues do épico e, para um épico da convenção, também os cards do board que apontam para o mesmo épico. Cada irmão tem o status no board ou, fora do board, o estado da issue;
- as **dependências**: as issues de que o card depende pela relação nativa (bloqueado por) e pelas linhas de dependência da convenção, unidas sem repetição, com o estado, o status no board quando está nele e as pull requests vinculadas.

A convenção no corpo é só lida, nunca escrita. Uma linha de épico começa com `Épico`, `Epico` ou `Epic`, e uma de dependência com `Depende de` ou `Depends on`, em qualquer capitalização, com ou sem marcador de lista (`-`, `*`, `+`), com ou sem negrito e com ou sem os dois-pontos depois do rótulo. Uma referência pode ser a URL da issue (`https://github.com/<dono>/<nome>/issues/<N>`), `dono/nome#N`, `nome#N`, resolvido no dono do board, ou `#N`, resolvido no repositório do card. Uma linha pode ter várias referências separadas por vírgula ou ponto e vírgula, com pontuação em volta; uma parte que não é referência é ignorada. O épico nativo prevalece sobre o da convenção, e só a primeira referência da primeira linha de épico que tem uma referência conta.

Cada leitura atualiza o que as tasks ativas do board guardam dos seus cards: título, status, estado da issue e épico. O card de uma task ativa que ficou fora da leitura, por ter sido fechado há mais de 14 dias ou tirado do board, é lido diretamente na mesma leitura.

### Falhas

Uma falha de leitura aparece onde a leitura foi pedida: no diálogo do board, na visão do board, no nó do board na barra lateral e na página **Boards**. Ela nunca espera pelo usuário nem gera notificação, e as tasks do board continuam funcionando. As mensagens:

- `GitHub CLI was not found: gh isn't on the PATH.`
- `gh is not authenticated. Run gh auth login.`
- `gh can't read projects. Run gh auth refresh -s read:project.`
- `The board doesn't exist or this account can't read it.`
- `GitHub's rate limit was reached. It resets at <hora>.`
- `Couldn't read from GitHub: <o que o gh disse>`

### Visão do board

A visão do board abre pelo nó do board na barra lateral e ocupa a área principal, no lugar da task. Abri-la relê o board.

- **Cabeçalho:** o título, o link para o GitHub, `Updated <há quanto tempo>`, o indicador de leitura em curso, o botão de atualizar e a falha da última leitura, quando houver.
- **Barra de filtros:** a busca, que casa com o título, sem diferenciar maiúsculas nem acentos, e com o número, com ou sem `#`; os filtros **Repository**, entre os administrados, **Status**, com `No status`, e **Assignee**; e **Assigned to me**, que filtra pelo usuário autenticado no `gh`. Os filtros combinam entre si, e **Clear filters** limpa todos. Os filtros de cada board são lembrados entre execuções.
- **Lista de cards** agrupada por status: uma seção por opção do campo de status, na ordem do board, mesmo vazia, e a seção `No status` quando há cards sem status. Um board sem campo de status tem uma seção única, `Cards`. Cada seção mostra o nome e a contagem já filtrada e é recolhível. As seções dos status finais começam recolhidas, e o que o usuário recolhe ou expande é lembrado por board. Dentro de cada seção, as issues abertas vêm antes das fechadas, cada grupo na ordem do board, e uma issue fechada numa seção de status não final aparece esmaecida.
- **Linha do card:** número, título, título do épico, a task do card, com a etapa e `Waits for you` quando ela espera pelo usuário, `Not cloned` para um card sem task de um repositório sem clone, o nome curto do repositório, com `dono/nome` no tooltip, e os avatares dos responsáveis.
- **Painel de detalhe**, à direita, com o card selecionado: título, número, repositório, estado da issue, status e link; a ação **Start task**; a task do card, a ativa, que abre ao clicar, ou, sem ela, a mais recente arquivada, que abre no histórico; os campos preenchidos e os responsáveis; o corpo renderizado como Markdown; o épico; os irmãos com o status, e um irmão que está no board seleciona o card dele ao ser clicado; as dependências com o estado, o status e as pull requests, com `Not satisfied` nas não satisfeitas; e as pull requests vinculadas. O painel mantém a seleção ao atualizar a leitura enquanto o card continua nela.
- **Estados:** um board nunca lido mostra o esqueleto da lista durante a leitura e, se ela falha, a falha com **Try again**. Um board sem cards diz `This board has no issues.`, e filtros que não deixam nenhum card dizem `No cards match the filters.`, com **Clear filters**.

Uma dependência está satisfeita quando a issue dela está fechada ou quando uma pull request vinculada a ela foi mergeada. Uma dependência não satisfeita é só um aviso e nunca bloqueia nada.

A visão é navegável pelo teclado: as setas para cima e para baixo percorrem os cards visíveis, pulando as seções recolhidas; as setas para a esquerda e para a direita recolhem e expandem a seção do card sob o foco; `Enter` abre o detalhe; `Esc` o fecha; `/` foca a busca; `S` aciona **Start task** no card sob o foco.

### Start task

A ação do card depende da situação dele:

| Situação do card | Ação |
|---|---|
| Issue aberta, sem task ativa, repositório do board, com clone | **Start task** abre o diálogo de criação a partir do card |
| Igual, repositório sem clone | **Start task** diz `<dono/nome> isn't cloned yet.` e oferece **Clone and continue**; terminado o clone, o diálogo de criação abre sozinho |
| Igual, clone inexistente | **Start task** desabilitado, com `The clone at <caminho> is missing.` e **Change path** |
| Repositório sem board, ou ainda não cadastrado | **Start task** diz `<dono/nome> isn't managed by this board.` e abre **Add <dono/nome> to the board**, que liga o repositório como no cadastro do board; confirmado com **Add to board**, o card segue pelas linhas acima |
| Repositório de outro board | **Start task** desabilitado, com `<dono/nome> belongs to the board <título>.` |
| Card com task ativa | Sem **Start task**; o painel mostra a task |
| Issue fechada | Sem **Start task** |

Um card tem no máximo uma task ativa, e **Start task** volta quando ela é arquivada ou apagada. Um card que está em mais de um board aparece em cada um, mas só o board do repositório dele oferece **Start task**.

## Repositórios

O produto conhece os repositórios que o usuário cadastra. Um repositório cadastrado é um repositório do GitHub, identificado por `dono/nome`, ligado ao caminho local de um clone ou ainda sem clone. Um repositório cadastrado a partir de um clone tem a identidade lida do remote `origin`; um repositório cadastrado por um board, sem clone, tem a identidade lida do GitHub. Cada repositório pertence a um board ou a nenhum.

Onde o espaço é curto, como na lista de tasks, o produto mostra o nome curto, a parte `nome`, com `dono/nome` no tooltip; onde há espaço, como na página de cadastro e no cabeçalho da task, mostra `dono/nome`.

Só uma instância do app roda por vez. Abrir uma segunda traz para a frente a janela que já existe; um argumento na linha de comando é ignorado.

### Página Repositories

As configurações têm a página **Repositories**. Ela tem o campo **Clone folder** e lista os repositórios cadastrados, em ordem alfabética de `dono/nome`, cada um com o `dono/nome`, `Board: <título>` quando pertence a um board, o caminho local ou `Not cloned`, a contagem de tasks ativas e arquivadas, o aviso de clone inexistente quando é o caso, e as ações **Clone**, para um repositório sem clone, **Change path** e **Remove**. Acima da lista fica **Add repository**.

**Add repository** abre um diálogo do próprio produto, que varre a pasta home até 6 pastas de profundidade, pulando pastas ocultas e `node_modules` e sem nunca descer para dentro de um repositório, de uma worktree ou de um submódulo. O diálogo lista os clones de repositórios do GitHub encontrados, por `dono/nome` e caminho, em ordem alfabética, com um filtro por nome ou caminho. Um clone sem `origin` ou com `origin` fora do GitHub não aparece. Os clones de repositórios já cadastrados com clone aparecem desabilitados, com `Registered`. O clone de um repositório cadastrado sem clone aparece disponível, e confirmá-lo liga o clone ao cadastro existente. Cada abertura do diálogo varre de novo.

O usuário marca um ou mais clones e confirma com **Add repository**, ou **Add N repositories** com vários marcados. Cada um é cadastrado por vez, na ordem da lista. Com todos cadastrados, o diálogo fecha. Uma recusa aparece sob a linha do clone recusado, que continua marcado, e o diálogo fica aberto, com os que passaram marcados como `Registered`.

**Browse…**, no mesmo diálogo, abre o seletor de pastas nativo, para um clone fora do alcance da varredura. Cancelar o seletor deixa o diálogo aberto; uma recusa aparece no próprio diálogo.

Em qualquer dos caminhos, o produto verifica que a pasta é a raiz de um repositório git, lê o remote `origin` e confere que `dono/nome` ainda não está cadastrado. O remote precisa ser do `github.com`, em SSH (`git@github.com:dono/nome.git`) ou HTTPS (`https://github.com/dono/nome.git`), com ou sem o sufixo `.git`, porque é o GitHub que dá valor a tudo o que vem depois. Uma pasta recusada não é cadastrada, com uma destas razões:

- `<caminho> is not the root of a git repository.`
- `<caminho> has no origin remote.`
- `The origin remote of <caminho> is not on GitHub: <url>.`
- `<dono/nome> is already registered at <caminho cadastrado>.`

**Change path** abre o seletor de pastas nativo e aplica as mesmas verificações, com uma a mais: o `dono/nome` lido da pasta nova tem de ser o do repositório. Uma pasta de outro repositório é recusada com `<caminho> is a clone of <outro dono/nome>, not of <dono/nome>.` Serve para quando o clone foi movido ou refeito em outro lugar. Trocar o caminho não mexe nas worktrees já criadas nem nas tasks: uma task cujo primeiro step ainda não criou a worktree passa a criá-la a partir do clone novo, e um step bloqueado por clone inexistente é destravado por **Tentar de novo**.

**Remove** só é possível com o repositório sem nenhuma task, ativa ou arquivada. Com tasks, a ação fica desabilitada e o produto diz o que impede: `<dono/nome> has N active tasks and M archived tasks. Delete them before removing the repository.` Um repositório sem tasks é removido após confirmação, e nada é apagado no disco: nem o clone nem as worktrees, que não existem sem tasks. Um repositório removido que pertencia a um board sai também do board.

### Repositório sem clone

Um repositório sem clone é cadastrado por um board: pela sugestão dos cards, por `dono/nome` ou por **Add to board** a partir de um card. Ele não é um clone inexistente, que é o de um caminho cadastrado que não está mais lá. Um repositório sem clone não recebe tasks: no diálogo de criação ele aparece desabilitado, com `Not cloned` e a ação **Clone**.

**Change path** liga a ele um clone existente, com as mesmas verificações de sempre. **Clone** clona o repositório com o `gh` em `<pasta de clones>/<nome>`, onde `<nome>` é a parte `nome` de `dono/nome`. A pasta de clones é o campo **Clone folder** da página **Repositories**, escolhido pelo seletor de pastas nativo por **Choose…**, sem valor padrão. Quando um clone é pedido sem a pasta escolhida, o seletor abre naquele momento, a escolha é guardada e o clone segue; cancelar o seletor cancela o clone.

Se a pasta de destino já existe e é um clone do mesmo repositório, ela é ligada ao cadastro sem clonar de novo. Se é qualquer outra coisa, o clone é recusado com `<caminho> already exists and is not a clone of <dono/nome>.` O clone roda em segundo plano, com `Cloning…` onde foi pedido, e o resto do produto continua utilizável. Uma falha mostra a mensagem do `gh` no repositório e no card que pediram o clone, não deixa nada na pasta de destino, e o repositório continua sem clone. Terminado o clone, o repositório passa a ter o clone, e um **Start task** que esperava por ele continua sozinho.

### Clone inexistente

Quando o caminho cadastrado não existe, não é um diretório ou não é mais um repositório git, o repositório aparece na página **Repositories** e na barra lateral com o aviso `The clone at <caminho> is missing.` e a ação de trocar o caminho. As tasks dele continuam visíveis e navegáveis, com suas conversas, artefatos e histórico. Fica bloqueado tudo o que precisa do clone, sempre com essa razão:

- criar uma task nesse repositório: ele aparece no diálogo, desabilitado, com o aviso;
- criar a worktree da task, no primeiro step: o step fica bloqueado como um step de worktree suja, com o aviso e **Tentar de novo**;
- o encerramento: **Close task** fica desabilitado, porque remover a worktree e a branch e atualizar a branch base dependem do clone.

Uma worktree já criada continua sendo usada normalmente: as sessões rodam nela, não no clone. O produto verifica o caminho ao iniciar e a cada ação que precisa dele; não observa o disco continuamente.

### Tela de boas-vindas e barra lateral

Enquanto nenhum board e nenhum repositório estão cadastrados, o produto mostra a tela de boas-vindas no lugar da task, com o nome do produto, a linha `Register a board or a repository to start creating tasks.` e dois botões: **Add board**, que abre o mesmo diálogo da página **Boards**, e **Add repository**, que abre o mesmo diálogo da página **Repositories**. Ao cadastrar o primeiro board ou o primeiro repositório, a tela dá lugar à visão principal. Sem nenhuma task, a área da task mostra a visão do primeiro board, na ordem por título; sem board, mostra um estado vazio com o atalho para criar a primeira task.

A barra lateral tem, de cima para baixo:

- a seção **Waiting for you**, fixa no topo, com todas as tasks que esperam pelo usuário, exceto a aberta. Ela nunca é filtrada por repositório;
- o **filtro por repositório**, um seletor com **All repositories** e um item por repositório cadastrado, em ordem alfabética, e o botão de nova task. A escolha do filtro é lembrada entre execuções do app, e um repositório removido volta o filtro para todos;
- o aviso de clone inexistente de cada repositório que o filtro mostra, com **Change path**;
- a **árvore de tasks** ativas, agrupada por board;
- o rodapé com **History**, o tema e as configurações.

A árvore tem um nó por board, em ordem alfabética de título, e depois o grupo **No board**:

- o **nó do board** mostra o título e abre a visão do board. Quando a última leitura falhou, ele mostra um ícone de falha, com o motivo no tooltip. Um board sem tasks aparece como nó vazio;
- dentro do board vem primeiro um **nó por épico** que tem ao menos uma task ativa, com o título do épico, na ordem de criação da primeira task dele, com as tasks dos seus cards dentro. O nó do épico só expande e recolhe. Depois dos épicos vêm as tasks do board sem épico: as de cards sem épico e as tasks sem card dos repositórios do board;
- o grupo **No board** tem as tasks dos repositórios sem board, inclusive as de cards de um board removido, e aparece só quando tem tasks.

Dentro de cada nó as tasks seguem a ordem de criação. Cada task mostra o nome, o nome curto do repositório abaixo, precedido de `#<número>` numa task criada de um card, a etapa em que está, o step em andamento e o que falta, o progresso do review, ou **Agent review** e **Addressing review** quando um agente revisa o step, e o que espera pelo usuário. Os agrupamentos usam o que as tasks guardam dos seus cards, então a árvore não depende de nenhuma leitura do GitHub.

Cada nó expande e recolhe pela seta ao lado do título, e o que o usuário recolhe é lembrado entre execuções. O board e o épico da task aberta se expandem ao abri-la. A árvore é navegável pelo teclado entre as tasks visíveis, pulando os nós recolhidos, com a task sob o foco sendo a que abre. Com o filtro num repositório, a árvore mostra só o nó do board desse repositório, ou o grupo **No board**, com as tasks do repositório. Um filtro num repositório sem board e sem tasks diz `No tasks in <nome curto>.`

### Dados de uma versão com áreas de trabalho

Ao abrir um banco que ainda guarda áreas de trabalho, o produto leva as tasks para repositórios cadastrados antes de mostrar qualquer coisa. Cada task de repositório é ligada ao repositório do seu clone, identificado pelo remote `origin`, e um repositório é cadastrado por identidade, no caminho do clone em que ele trabalhou por último. Os artefatos vão para a pasta nova da task. As tasks arquivadas criadas na raiz de uma área de trabalho são descartadas, porque não pertencem a nenhum repositório.

A migração é tudo ou nada, e três coisas a impedem: uma task ativa na raiz de uma área de trabalho, um clone que não pode ser identificado no GitHub, e duas tasks com o mesmo nome no mesmo repositório. Quando alguma acontece, nada é mudado, e o produto mostra no lugar de tudo a tela **MySpec couldn't be updated**, que lista os casos agrupados por tipo, com as tasks de cada um e o que fazer a respeito na versão anterior. As tasks, os documentos e as worktrees ficam como estavam, e a versão anterior continua abrindo tudo. Resolvidos os casos, abrir esta versão de novo tenta outra vez.

## Criação de uma task

O botão de nova task e `Ctrl+N` abrem o diálogo de criação de qualquer lugar do produto. Na criação o usuário informa:

- o **repositório**, obrigatório, entre os cadastrados. O seletor vem pré-selecionado com, nesta ordem, o primeiro que existir: o repositório do filtro, quando o filtro não é **All repositories**; o repositório da task aberta; o último repositório usado numa criação; o primeiro da lista. Um repositório com clone inexistente aparece desabilitado, com o aviso, e um repositório sem clone aparece desabilitado, com `Not cloned`, ou `Cloning…` enquanto clona, e a ação **Clone** ao lado;
- o **nome**, em minúsculas, dígitos e hífens simples, com até 64 caracteres, único no repositório escolhido, tasks arquivadas incluídas, porque ele nomeia a branch e a worktree. Um nome já usado é recusado com `A task named <nome> already exists in <dono/nome>.`; o mesmo nome em outro repositório é permitido;
- o **contexto inicial**: o que quer fazer, em alto nível ou em detalhe. É a primeira mensagem da primeira sessão de planejamento, a de PRD ou a de planejamento One-Shot;
- o **modo**, `Structured` ou `One-Shot`, que parte sempre de `Structured`, com uma linha que diz o que o modo escolhido faz: `A PRD, a tech spec and a plan of steps, each step its own commit.` ou `One planning conversation writes a single document, implemented in one commit.` O modo nunca muda depois da criação;
- o **modo de review**, `Manual` ou `Agent`, partindo do padrão configurado, com uma linha que diz o que o modo escolhido faz: `You review each step in VS Code before its commit.` ou `An agent reviews each step, and the task runs to the pull request on its own.` Ele vale para todos os steps que o plano escrever, ou para o step único de uma task One-Shot;
- o **modelo e o esforço de cada etapa** do modo escolhido, partindo dos padrões configurados. O usuário pode ajustar qualquer etapa para essa task. A lista acompanha o modo, e o ajuste de uma etapa que os dois modos têm, como a implementação, se mantém ao trocar de modo; o resumo ao lado de **Models** considera só as etapas do modo escolhido.

Ao confirmar, a primeira sessão de planejamento do modo abre no clone do repositório e começa com o contexto inicial, e a primeira coisa que o usuário vê é a primeira pergunta do agente. Se a sessão não conseguir começar, a task é desfeita. O cabeçalho de uma task One-Shot mostra o rótulo `One-Shot` ao lado do nome.

### A partir de um card

**Start task** num card abre o mesmo diálogo, com estas diferenças:

- o topo mostra o card: número, título, repositório e status. O repositório é o do card, sem seletor;
- o **nome** vem sugerido como `<número>-<slug do título>`, e é editável. O slug é o título em minúsculas, sem acentos, com cada sequência de caracteres fora de `a-z0-9` virando um hífen, sem hífens nas pontas, cortado numa fronteira de palavra para o nome inteiro caber em 64 caracteres. Um nome sugerido que já existe no repositório é recusado como qualquer outro, e o usuário o edita;
- **Context from the card**, recolhível e somente leitura, mostra o contexto que o produto monta, e o campo `Additional context`, opcional, recebe o que o usuário quiser acrescentar;
- **Unsatisfied dependencies**, quando o card tem dependências não satisfeitas, lista cada uma com o repositório, o estado, o status e as pull requests com o estado. O aviso nunca bloqueia a criação.

O contexto montado é, em Markdown e com rótulos em inglês, nesta ordem: o card, com título, `dono/nome#número`, link, status, campos preenchidos, responsáveis e o corpo completo; o épico, quando existe, com título, referência, link e corpo completo; os cards irmãos, um por linha, com referência, título e status; as dependências, uma por linha, com referência, título, estado, status e pull requests com o estado; e, sob `Additional context`, o texto do usuário, quando existe. Ele é o contexto inicial da task: a primeira mensagem do PRD ou do planejamento One-Shot.

O contexto usa a leitura guardada do board. Quando a leitura do card tem mais de 5 minutos, o diálogo relê o card, o épico, os irmãos e as dependências ao abrir, com `Refreshing the card…`. Se a releitura falha, o diálogo avisa `Couldn't refresh the card: <motivo>. The task will use the last reading.` e a criação segue com o que estava guardado. Um card que saiu da última leitura enquanto o diálogo abria mostra `This card isn't in the last reading of the board.`

Criar a task de um card que ganhou uma task ativa enquanto o diálogo estava aberto é recusado com `Card #<número> already has an active task: <nome>.`

A task guarda o card: o board, o repositório, o número, o título, o corpo, o link, o status e o estado da issue, e o épico. Cada leitura do board atualiza esses dados nas tasks ativas; uma task arquivada guarda o card como estava ao arquivar. O cabeçalho da task e o da task arquivada no histórico mostram o card: `#<número>`, que abre a issue e tem o título no tooltip, o status da última leitura e `Issue closed` quando a issue foi fechada.

## Etapas de planejamento

O modo define as etapas de planejamento. Uma task Structured passa por PRD, tech spec e plano; uma task One-Shot, por uma única etapa, o planejamento One-Shot. Cada etapa tem uma conversa própria, aberta no clone do repositório da task. A etapa termina quando o documento dela aparece no diretório de artefatos e a conversa está ociosa: o agente parou e nada está na fila. O produto então inicia a etapa seguinte sozinho.

- **PRD.** O agente segue o prompt de PRD: Q&A sobre o quê e o porquê, uma pergunta por vez, até não restar lacuna. Ao final lista o que entendeu, pede confirmação e escreve `PRD.md`.
- **Tech spec.** O agente lê o PRD, explora o código do repositório da task e conduz o Q&A técnico, apresentando alternativas com trade-offs para o usuário decidir. Escreve `tech-spec.md`.
- **Plano.** O agente lê os dois documentos, negocia a divisão do trabalho e escreve um arquivo por step em `steps/`. Cada arquivo tem o nome `<número>-<descrição-curta>.md` e traz um título `# Step N: Título`. Os números começam em 1, sem lacunas nem repetições.

O plano é validado antes de a task avançar. Quando os arquivos não formam um plano válido, o produto diz ao agente o que está errado e pede a correção, até três vezes. Depois disso para de corrigir e mostra os problemas acima do compositor, para o usuário resolver na conversa ou descartar o plano.

O PRD, o tech spec e cada step ficam visíveis no painel de artefatos da task, renderizados como Markdown com diagramas mermaid.

### Planejamento One-Shot

O planejamento de uma task One-Shot é uma conversa aberta no clone do repositório da task, com o prompt de planejamento One-Shot, que junta num só Q&A o quê e o como. O agente lê o contexto inicial, explora o código e a documentação do repositório e resolve as lacunas uma pergunta por vez: comportamento esperado, casos de borda, limites do escopo, abordagem, contratos e padrões a seguir. Quando há mais de um caminho válido, apresenta as alternativas com trade-offs para o usuário decidir. Sem lacunas restantes, lista os pontos principais do que vai mudar e como, pede confirmação e escreve `one-shot.md` no diretório de artefatos.

O documento é o prompt inteiro da implementação: um agente novo o recebe sem conversa, sem histórico e sem outro documento. Por isso ele tem o nível de detalhe de um tech spec, com diretrizes, decisões e o plano de mudanças, sem o código pronto. Segue nove seções, nesta ordem: o título `# <nome da mudança> — One-Shot`, com a instrução de seguir o documento estritamente, **Problem**, **Scope**, **Technical decisions**, **Change plan**, **Coding standards**, **Completion checklist** e as instruções fixas **Questions** e **Workflow**, as mesmas de um arquivo de step. O produto não valida o conteúdo: a existência do documento basta, como para o PRD e o tech spec.

A etapa termina como as outras, com o documento escrito e a conversa ociosa, e o produto inicia a implementação sozinho. O documento aparece no painel de artefatos, na aba **One-Shot**, renderizado como os outros.

### Voltar e descartar

A trilha de etapas no topo da task mostra onde ela está e o que pode fazer. Numa task Structured ela é `PRD › Tech spec › Plan › Implementation › PR › PR review › Closing`; numa task One-Shot, `Planning › Implementation › PR › PR review › Closing`. Nas duas, a etapa de PR ocupa os três últimos chips.

- **Voltar a uma etapa** reabre uma etapa anterior e apaga tudo que veio depois: conversas, documentos, arquivos de step, relatórios de review, worktrees e branches, com o que houver de não commitado nelas, e o que a etapa de PR criou. A task fica na etapa reaberta, em modo de revisita, até o usuário pressionar **Continuar**, para que o documento possa ser retrabalhado sem o produto avançar no meio.
- **Descartar e recomeçar** apaga a etapa atual também e inicia uma sessão nova para ela na hora.

Numa task One-Shot, as duas ações ficam no chip **Planning**. **Back to planning** existe com a task na implementação ou na etapa de PR, mantém o documento e a conversa de planejamento e deixa o chip em `Planning · revisiting` até **Continue to implementation**, que habilita com o documento escrito e a conversa ociosa; a implementação então começa do zero numa worktree nova. **Discard and restart** existe em qualquer etapa e apaga também a conversa e o documento de planejamento. Os chips da implementação e da PR não têm ações nos dois modos: um step se descarta com **Descartar step**.

Cada ação diz, antes de confirmar, exatamente o que será perdido.

## Implementação

Com o plano válido, a task entra na implementação e o produto inicia o primeiro step sozinho. Os steps rodam em sequência, na ordem numérica, um de cada vez.

Numa task One-Shot, a implementação é um step único, o próprio documento One-Shot, no repositório da task. Tudo o que esta seção diz de um step vale para ele, com as diferenças que ela aponta: ele usa o modelo e o esforço da implementação e o modo de review da task, sem escolha própria, e a task não tem lista de steps.

### Worktrees

A task tem uma worktree, criada no primeiro step, em `~/.local/share/myspec/worktrees/<dono>/<nome>/<task>/`, numa branch com o nome da task. Todos os steps rodam nela. A base é resolvida na criação: o produto roda `git fetch origin` e ramifica de `origin/dev`, ou de `origin/main` quando não há `dev`. O fetch só acontece na criação.

O produto é dono das worktrees que criou, e só delas: nunca reutiliza nem apaga um caminho ou uma branch que não criou. Uma worktree registrada em outro caminho continua sendo usada e removida onde está. Uma worktree e sua branch são removidas quando a task é apagada, quando a task volta a uma etapa de planejamento ou descarta uma, o planejamento One-Shot incluído, e no encerramento da task.

O primeiro step de uma task cujo clone não existe mais fica bloqueado com o aviso do clone, porque a worktree nasce do clone.

### Pré-condição: worktree limpa

Antes de iniciar um step o produto verifica que a worktree está limpa: nada modificado, em stage, apagado ou não rastreado, ignorados à parte. Uma worktree suja bloqueia o step, com o que foi encontrado e duas saídas: limpar por conta própria e **Tentar de novo**, ou deixar o produto descartar tudo com **Limpar e iniciar**. Um step é bloqueado do mesmo modo quando o fetch falha, quando nenhuma branch base existe, quando o caminho ou a branch já existem, ou quando o clone do repositório não está mais lá. A mensagem do git é mostrada como o git a escreveu.

### Sessão do step

A sessão de um step abre dentro da worktree, com o arquivo do step como primeira mensagem. O arquivo aponta para o PRD e o tech spec no diretório de artefatos, delimita o escopo e traz o checklist de conclusão. Os steps anteriores já estão commitados na branch. Numa task One-Shot, a primeira mensagem é o documento One-Shot, que basta sozinho.

O agente implementa seguindo o tech spec, ou o documento One-Shot. Só pergunta quando algo genuinamente o bloqueia, e sempre pela ferramenta de perguntas estruturadas, que o produto mostra como um cartão com opções. Ao terminar, apresenta o resumo do que fez. No modo `Manual`, o step passa a **aguardando review** assim que o agente encerra um turno sem nada pendente, e pedir uma mudança na conversa o devolve a **implementando**. No modo `Agent`, o turno encerrado leva o step ao revisor, como diz [Review pelo agente](#review-pelo-agente).

### Modo de review

Cada step é revisado no modo `Manual` ou no modo `Agent`, este mostrado sempre com um ícone de robô. No `Manual`, o usuário revisa o step no editor, dá stage arquivo a arquivo e aprova. No `Agent`, um agente revisor revisa o step com o implementador, e o step é commitado quando o relatório do revisor vem limpo, sem ninguém dar stage.

O modo é escolhido em quatro lugares:

- **Settings**: a página **Defaults** guarda o padrão, `Manual` de fábrica. Uma mudança vale para as tasks criadas depois dela.
- **Criação da task**: o diálogo parte do padrão, e a escolha vira o modo da task.
- **Cabeçalho da task**: o botão ao lado de **Models**, com o ícone do modo da task, um robô ou uma pessoa, abre um painel que troca o modo da task. A troca vale para os steps não iniciados sem escolha própria e, antes do plano, para os steps que o plano escrever; numa task One-Shot, para o step único enquanto ele não começou. Quando nenhum step resta para começar, o seletor fica desabilitado.
- **Lista de steps**: cada step não iniciado tem um seletor de modo ao lado do modelo, e escolher um modo dá ao step um modo próprio. Um step com modo próprio aparece em destaque; um que segue a task aparece discreto. Uma task One-Shot não tem lista de steps, e o step único segue o modo da task.

O modo de um step congela quando a sessão do step começa. Dali em diante ele só muda de `Agent` para `Manual`, pelas saídas do review pelo agente, e nunca volta. Na lista de steps, um step iniciado ou concluído mostra, sem edição, o modo com que é revisado; um step que passou ao usuário mostra `Manual`, com um tooltip que diz por quê.

### Review

No modo `Manual`, o review é feito no editor, arquivo por arquivo. **Abrir no VS Code** abre a worktree, e cada arquivo da lista de mudanças abre diretamente ao ser clicado. O usuário dá stage em cada arquivo revisado e faz alterações manuais quando quer.

Enquanto o step aguarda review o produto observa a worktree, inclusive o diretório do git, para que o stage feito no editor apareça na hora, e lê o `git status` a cada rajada de eventos. Todo arquivo alterado que o git reporta conta, arquivos novos um a um, ignorados nunca. Um arquivo está revisado quando nada dele resta fora do índice; um arquivo parcialmente em stage ainda está pendente. A faixa de review sob a barra do step mostra a barra de progresso, a contagem e a lista de arquivos. O mesmo progresso aparece como percentual na lista de tasks. O produto nunca dá stage em nada: o stage é o review, e o review é o portão.

### Aprovação e commit

**Aprovar** existe no modo `Manual` e só habilita com 100% em stage; abaixo disso diz o que falta. Também exige a sessão ociosa, sem turno rodando, nada na fila e nenhuma permissão ou pergunta em aberto, e retoma uma sessão pausada por conta própria.

Aprovar envia o prompt de commit como mensagem do produto na própria conversa do step, para o agente que escreveu o código commitar exatamente o que está em stage, em um commit, com assunto no imperativo e a convenção do repositório. O step fica **concluído** quando um commit aparece na branch além daquele em que começou, venha do turno de commit ou da mão do usuário. Se o turno termina sem commit, o step volta a **pronto para aprovar** e diz isso. Um step em que o agente não mudou nada não pode ser aprovado.

O produto então encerra os processos do step e do seu revisor e inicia o próximo.

### Review pelo agente

No modo `Agent`, quando o implementador encerra um turno sem nada pendente e a worktree tem mudanças, o produto pede uma passada ao revisor, e o step passa a **Agent review**. Um turno que termina sem nenhuma mudança não vai ao revisor: o step fica sem mudanças, esperando pelo usuário, como no modo `Manual`.

O revisor é uma conversa própria do step, aberta na worktree com o prompt de review de step. A primeira passada abre a conversa com o prompt, que aponta para o arquivo do step, o PRD, o tech spec e o arquivo do relatório, seguido da última resposta do implementador. As passadas seguintes acontecem na mesma conversa, numa mensagem do produto com a resposta do implementador e o arquivo do novo relatório. A cada passada o revisor lê na worktree tudo o que o step mudou, arquivos novos incluídos, e confere o escopo, os objetivos e o checklist do step, a aderência ao tech spec e ao PRD, a correção e a qualidade. Ele roda ele mesmo as verificações que o repositório documenta, como lint, typecheck e testes, sem confiar no que o implementador disse. Numa task One-Shot, o documento One-Shot faz o papel do arquivo do step, do PRD e do tech spec: o escopo e o checklist vêm dele, e a aderência ao plano é a aderência às decisões técnicas e ao plano de mudanças que ele traz. Gosto pessoal nunca é apontamento. O revisor nunca edita arquivos, nunca dá stage, nunca commita e nunca faz push.

Cada passada escreve um relatório numerado, com o status `clean`, quando não há nada a mudar, ou `changes`, quando há qualquer apontamento. O relatório diz o que foi revisado, as verificações rodadas com o resultado, os apontamentos numerados, as divergências do plano que o revisor aceitou, as contestações do implementador com o julgamento de cada uma e as decisões que o usuário tomou. Uma divergência do plano válida é aceita e registrada com a razão; uma inválida vira apontamento. Um apontamento contestado é julgado na passada seguinte, retirado ou mantido. Quando não tem confiança para decidir, o revisor pergunta ao usuário pela ferramenta de perguntas estruturadas e segue a resposta.

O produto age sobre cada relatório:

- **Com mudanças**: entrega o relatório na conversa do implementador, pedindo que trate cada apontamento, corrigindo ou dizendo por que discorda, e que não commite. O step passa a **Addressing review**, e quando o implementador encerra o turno o revisor passa de novo.
- **Limpo**: envia o prompt de commit na conversa do implementador, para ele commitar tudo o que mudou na worktree, arquivos novos incluídos e ignorados de fora, num único commit. O step passa a **Committing** e fica **concluído** quando o commit aparece na branch; o próximo step começa sozinho.
- **Com mudanças depois de três rodadas**: uma rodada é um relatório com mudanças entregue ao implementador, e o teto é de três, fixo. A passada que confere o terceiro ajuste é a última: se ainda tem mudanças, o relatório não vai ao implementador e o step passa ao usuário. Um step tem, portanto, no máximo quatro passadas. Uma pergunta do revisor, uma passada sem relatório e uma mensagem do usuário não contam como rodada.

Uma passada que termina sem relatório, ou com um relatório cujo status o produto não consegue ler, deixa o step esperando pelo usuário na conversa do revisor. O produto só pede o commit de um step no modo `Agent` depois de um relatório limpo; um commit feito à mão na branch conclui o step, como no modo `Manual`.

**Review myself** aparece na barra do step no lugar de **Aprovar** enquanto o agente revisa o step, antes do commit, e tira o review do agente sem confirmação. Uma passada em curso é interrompida na hora, sem relatório; um implementador no meio de um turno termina o turno. Toda saída do loop que não termina num commit leva o step para o modo `Manual`, em **aguardando review**, com a worktree como está e os relatórios à vista: **Review myself**, as três rodadas sem relatório limpo, que a barra anuncia com `The agent review didn't come clean after three rounds.`, e o turno de commit que termina sem commit, que ela anuncia com `The last approval didn't produce a commit.`. Dali em diante é o fluxo do modo `Manual`. A conversa do revisor continua visível e aceita mensagens, mas o produto não pede mais passadas nem age sobre relatórios novos.

A barra do step lê `Implementing` antes da primeira passada, `Agent review · pass N` durante uma passada, `Addressing review · round N of 3` enquanto o implementador trata um relatório e `Committing` durante o commit. O estado da conversa em que o step espera, pausada, com erro, pedindo permissão ou perguntando, prevalece sobre o texto. A faixa de review não aparece: ninguém dá stage. **Abrir no VS Code** e **Descartar step** continuam na barra, e o usuário pode mudar arquivos na worktree ou escrever a qualquer das conversas durante o loop; o que ele muda entra na próxima passada e no commit.

A partir da primeira passada, a conversa do step tem as abas **Implementer** e **Reviewer**, cada uma com o ponto de estado da sua sessão e a cor da situação que espera pelo usuário. O produto nunca troca de aba sozinho; abrir uma situação do revisor abre a aba dele. O relatório entregue e o prompt de commit aparecem na conversa do implementador como mensagens do produto, e cada relatório tratado aparece como marcador na conversa do revisor, com o número e o status. No painel de artefatos, os relatórios aparecem sob o seu step, na lista de steps, como `Review 1 · changes`, `Review 2 · clean`, e abrem renderizados. Numa task One-Shot, eles aparecem acima do documento, na aba **One-Shot**, e **← One-Shot** volta ao documento.

O loop não anda enquanto qualquer das conversas trabalha, pergunta, está pausada ou com erro: é ali que o step espera. Um erro de sessão tem **Tentar de novo**, e o loop segue quando a sessão volta. Uma task pausada não inicia passadas nem entrega relatórios. Fechar e reabrir o app retoma o loop de onde parou, com o modo de cada step, a rodada, os relatórios e as duas conversas.

### Descartar step

**Descartar step** encerra as sessões do step e do revisor, apaga as duas conversas e os relatórios de review do step e o começa de novo, limpando a worktree a menos que o usuário peça o contrário. O step recomeça com o modo escolhido antes de ele começar e com as rodadas zeradas.

## Pull request

Com o último step commitado a task entra na etapa de PR. Ela é uma só, como a task: uma conversa que escreve o rascunho e abre a pull request, uma conversa que a revisa, e uma barra com o estado e os controles. Uma task abre exatamente uma pull request.

### Rascunho e abertura

A sessão de PR abre na worktree com o prompt de PR. O agente lê os commits e o diff da branch contra a base, o PRD e o tech spec, ou o documento One-Shot numa task One-Shot, e escreve um rascunho de título e descrição num arquivo de artefato. O rascunho aparece no produto, editável, e a task passa a **rascunho pronto**, esperando o OK. O usuário pode alterar o título e o corpo antes de aprovar, ou descartar o rascunho para o agente escrever outro.

Numa task criada de um card, o prompt de PR recebe o card, com título, referência, link e corpo, e pede ao agente que escreva a descrição para quem lê o card e que comece o corpo do rascunho com `Closes <dono/nome>#<número>`. Ao abrir a pull request, se a descrição aprovada não fecha o card, o produto acrescenta `Closes <dono/nome>#<número>` ao fim dela. Conta como fechamento uma palavra de fechamento do GitHub (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves` ou `resolved`, sem diferenciar maiúsculas) seguida de `#<número>` ou `<dono/nome>#<número>`. Assim toda pull request de uma task criada de um card fica vinculada ao card, e o board a mostra nele. Uma task sem card abre a pull request sem nada disso.

Com o OK, o agente sobe a branch e abre a pull request com `gh pr create` contra a branch base, usando o rascunho como ele está naquele momento. A base é a mesma da worktree: `dev`, ou `main` quando não há `dev`. Quando o `gh` não está instalado, não está autenticado ou falha, a etapa fica **bloqueada** com a razão, e **Tentar de novo** repete a partir de onde parou.

O produto lê a pull request com o `gh`: número, link, estado e base aparecem na barra da pull request, e uma leitura pode ser forçada a qualquer momento. Pull requests aguardando merge são consultadas automaticamente a cada minuto.

### Review de pull request

Aberta a pull request, a sessão de review começa sozinha com o prompt de review de PR. O agente revisa o diff contra o PRD e o tech spec, procurando erros, desvios da especificação e problemas de qualidade. Numa task One-Shot, o critério é o documento One-Shot: o problema e o escopo fazem o papel do PRD, e as decisões técnicas e o plano de mudanças, o do tech spec. Ao fim, o agente escreve um relatório numerado num arquivo de artefato, com o status `clean` ou `changes`.

Se o relatório está limpo, a task fica **pronta**, aguardando o merge. Se há apontamentos, o produto os mostra e a task passa a **aguardando decisão**: o usuário decide na conversa, item a item, o que quer aplicado. O agente aplica só o que foi aprovado. As mudanças então passam pelo mesmo review do produto que um step no modo `Manual`: stage arquivo a arquivo no editor, progresso em tempo real, **Aprovar** em 100%, e o commit feito pelo agente com o prompt de commit, que nesta etapa também sobe o commit para a pull request. Depois do commit o agente revisa de novo, e o ciclo se repete até um relatório limpo. **Revisar de novo** pede uma passada extra a qualquer momento, e os relatórios de todas as passadas ficam visíveis.

Uma pull request fechada sem merge é sinalizada como tal, e a task não pode ser encerrada.

## Encerramento e arquivamento

O encerramento é da task e é a única transição que o usuário aciona, porque depende de a pull request ter sido mergeada fora do produto. **Close task** habilita quando o `gh` reporta a pull request como mergeada, ou quando a última leitura falhou e o produto não consegue confirmar o merge. Com o clone inexistente a ação fica desabilitada, com o aviso.

Ao encerrar, o produto:

1. remove a worktree da task;
2. apaga a branch da task. Quando o GitHub confirmou o merge, apaga sem perguntar ao git, porque um squash merge nunca aparece como ancestral; quando o merge não pôde ser confirmado, só apaga se o git considerar a branch mergeada;
3. atualiza a branch base local, se ela estiver em checkout no clone, limpa, com upstream e atrás da remota sem divergir.

Cada parte reporta o que fez, o que pulou e por quê, e o que falhou. Terminado o encerramento, a task é arquivada: sai da lista de tasks e passa a existir só no histórico, com um aviso momentâneo de que saiu, e o resultado do encerramento fica guardado com ela.

## Histórico

O botão **History** no rodapé da barra lateral abre a lista das tasks arquivadas, da mais recente à mais antiga, com busca por nome e o mesmo filtro por repositório da barra lateral. Cada linha mostra o nome curto do repositório da task. Uma task arquivada mostra os seus artefatos finais renderizados, com PRD, tech spec, steps com os relatórios de review de cada step, a pull request e o resultado do encerramento. Uma task One-Shot aparece na lista com o rótulo `One-Shot` no lugar da contagem de steps, e mostra o documento One-Shot com os relatórios de review do step no lugar de PRD, tech spec e steps. As conversas não são guardadas no histórico.

## Apagar uma task

Uma task pode ser apagada em qualquer etapa. Antes de confirmar, o produto mostra o que será destruído: a worktree e a branch, quando existem, a pull request que fica aberta no GitHub, e o que já não está lá. Apagar para o que estiver rodando, remove a worktree e a branch, apaga os artefatos e remove a task em definitivo. O que o git não conseguiu remover é listado num aviso, para o usuário resolver à mão.

## Sessões e conversas

Toda sessão é uma conversa dentro do produto, com interface própria. O Claude Code roda por baixo, invisível. A conversa mostra as mensagens do usuário e do agente, as ações que o agente executa agrupadas, os cartões de permissão e de pergunta, marcadores dos eventos da task (documento escrito, etapa iniciada, review iniciado ou escrito, contexto compactado, resposta interrompida) e os erros. Tudo que o agente escreve é renderizado como Markdown, com diagramas mermaid e realce de código, em streaming.

Cada etapa e cada step têm a sua conversa, e a etapa de PR tem a da pull request e a do review dela. Um step no modo `Agent` tem também a do revisor, a partir da primeira passada, e as duas ficam nas abas **Implementer** e **Reviewer**. Voltar a uma etapa retoma a conversa dela de onde ficou.

- **Enviar**: mensagens enviadas com o agente ocupado entram numa fila, visível na conversa, e podem ser removidas antes de sair.
- **Interromper** encerra a resposta em andamento e mantém a sessão viva.
- **Pausar** para o processo e preserva a conversa; **Retomar** continua de onde parou. Na implementação, **Pause** no cabeçalho age na conversa em que o step espera: a do revisor durante uma passada, a do implementador no resto do tempo. Uma sessão ociosa por dez minutos é parada sozinha e retomada de forma transparente na próxima mensagem.
- **Tentar de novo** reinicia uma sessão que falhou ao iniciar, cujo processo morreu, ou que não encontrou o `claude` ou um login.
- **Permissões**: as sessões rodam no modo auto do Claude Code. As escaladas que o modo auto não resolve sozinho aparecem como um cartão na conversa, com a ferramenta e a entrada exata, e aceitam permitir uma vez, permitir pela sessão ou negar com uma mensagem.
- **Perguntas**: as perguntas estruturadas do agente aparecem como um cartão com as opções, e a resposta volta pelo mesmo canal.
- **Contexto**: um medidor mostra quanto da janela de contexto a sessão já usou.

## Depende de mim

Uma task espera pelo usuário quando qualquer destas situações acontece: um erro de sessão, um step bloqueado, uma worktree ilegível, a etapa de PR bloqueada, um plano inválido, uma pull request fechada sem merge, uma escalada de permissão, uma pergunta do agente, uma passada do revisor de um step que terminou sem relatório, uma resposta aquém do que o produto esperava, uma etapa revisitada pronta para continuar, um step aguardando review ou pronto para aprovar, um step sem mudanças, um step que passou ao usuário porque o review pelo agente não veio limpo em três rodadas, um rascunho aguardando OK, apontamentos de review aguardando decisão, mudanças aplicadas aguardando review, uma pull request pronta para merge, uma task pronta para encerrar. Uma task pausada não espera por ninguém. O revisor de um step é um lugar próprio: um erro, uma escalada de permissão ou uma pergunta dele espera pelo usuário na aba **Reviewer**, e pode esperar ao mesmo tempo que uma situação do implementador. Uma task com todos os steps no modo `Agent` só espera pelo usuário, entre o primeiro step e o rascunho da pull request, quando há erro, bloqueio, permissão, pergunta, passada sem relatório ou um step que passou ao usuário; um step commitado pelo review do agente não notifica.

Cada situação diz onde está e o que pede. As situações aparecem:

- na seção **Waiting for you**, fixa no topo da barra lateral, com todas as tasks que esperam, exceto a que está aberta. `Ctrl+J` abre a primeira;
- na lista de tasks, na linha de cada task;
- na própria task, na trilha de etapas, na barra do step, nas abas **Implementer** e **Reviewer** e na barra da pull request.

Uma situação que começa enquanto o usuário olha para o produto pisca brevemente onde surgiu, em silêncio. Uma situação que começa com a janela fora de foco gera uma notificação do sistema, que identifica a task e o que ela pede; clicar nela traz a janela e abre o lugar certo. Cada situação notifica uma vez, ao começar. Continuações da mesma espera, como o stage chegar a 100% ou a pull request passar de pronta a mergeada, não notificam.

A notificação toca, ao aparecer, o som do MySpec: um carrilhão curto e suave, o mesmo em todo sistema, no volume e na saída de áudio do sistema. Situações que começam juntas são ouvidas uma vez só: uma notificação a menos de dois segundos da última que tocou chega em silêncio, e cada situação continua com a sua notificação. Com o sistema em não perturbe o som não toca, onde o sistema torna esse estado conhecido. Clicar, dispensar ou retirar uma notificação não faz som. Uma notificação que não aparece não toca, e um som que não pode tocar deixa a notificação aparecer muda; nenhum dos dois vira erro na interface.

Não há níveis, silenciamento nem configuração de som: o volume e o não perturbe são os do sistema.

## Modelos e esforço

O produto oferece três modelos, Fable 5.1, Opus 5 e Sonnet 5, e cinco níveis de esforço, de low a max. Cada combinação é válida.

- **Padrões**: nas configurações, um modelo e um esforço por tipo de sessão: PRD, tech spec, plano, planejamento One-Shot, implementação, review de step, PR e review de PR. O commit não tem escolha própria, porque roda na sessão do step ou do review.
- **Por task**: na criação, a task copia os padrões e o usuário ajusta o que quiser. Uma task Structured tem as etapas de PRD, tech spec, plano, implementação, review de step, PR e review de PR; uma One-Shot, as de planejamento One-Shot, implementação, review de step, PR e review de PR. Depois, o popover **Models** no cabeçalho da task lista as etapas do modo dela e troca a escolha das que ainda não começaram. O review de step segue editável até o último step ser commitado, e a troca vale para os revisores que ainda não começaram; ele aparece mesmo numa task no modo `Manual`, porque um step pode passar a `Agent` antes de começar.
- **Por step**: na lista de steps, cada step ainda não iniciado pode ter modelo e esforço próprios. A escolha congela quando a sessão do step começa. O revisor não tem escolha por step: ele começa com o review de step que a task tem na primeira passada. Uma task One-Shot não tem escolha por step: o step único usa a da implementação.
- **Por sessão**: dentro de uma conversa, o seletor troca o modelo e o esforço daquela sessão a partir da mensagem seguinte. A resposta em andamento termina com a escolha anterior.

## Prompts

As configurações listam os oito prompts, PRD, tech spec, plano, planejamento One-Shot, review de step, commit, PR e review de PR, cada um renderizado e editável. Um prompt editado é salvo como arquivo no diretório de dados e sobrevive a atualizações do app; um prompt nunca editado acompanha o padrão de cada versão. **Restaurar** volta ao padrão. O prompt é lido quando uma sessão começa, então uma sessão já em andamento mantém o prompt com que começou. O prompt de um step é o próprio arquivo do step, escrito pelo plano, ou o documento de uma task One-Shot, escrito pelo planejamento, e por isso não aparece aqui.

Os prompts de review de step, commit, PR e review de PR são um texto por tipo, que serve aos dois modos. Numa task One-Shot, onde os de review de step, PR e review de PR citam o PRD, o tech spec ou o arquivo do step, eles citam o documento One-Shot, e o produto acrescenta a cada um uma seção `One-Shot task`, que diz o papel do documento no lugar dos outros. Ela fecha os prompts de PR e de review de PR, seguida só da seção `## Card` no de PR de uma task criada de um card; no de review de step, vem antes da última resposta do implementador, que continua sendo o fim do prompt. Um prompt editado recebe o mesmo tratamento, então uma edição vale para os dois modos.

O prompt de review de step sempre termina com a última resposta do implementador, que o produto acrescenta. O prompt de commit diz o que commitar conforme quem revisou: exatamente o que está em stage, no modo `Manual` e no review de pull request, ou tudo o que mudou na worktree, depois de um relatório limpo do revisor. Essa instrução nunca se perde: num prompt editado que removeu o placeholder, ela é acrescentada ao fim. As mensagens que entregam um relatório ao implementador e que pedem uma nova passada ao revisor são textos fixos do produto e não aparecem aqui.

Os prompts padrão de PRD e de planejamento One-Shot dizem ao agente que o contexto inicial pode já responder boa parte do que ele precisa, como um card do board com o épico, os irmãos e as dependências, ou uma descrição detalhada. O agente o trata como a fonte principal do quê e do porquê, não pergunta o que ele já responde, usa o épico e os irmãos para entender onde o trabalho termina sem invadir o escopo de outro card, e pergunta só pelas lacunas reais. Com um contexto completo, a conversa pode ser pouco mais que confirmar o entendimento. A instrução é a mesma com ou sem card. O prompt de PR de uma task criada de um card termina com uma seção `## Card`, acrescentada pelo produto, com o card e a instrução da referência de fechamento; um prompt editado recebe o mesmo tratamento.

Sair do editor com uma edição não salva pede confirmação.

## Configurações e aparência

As configurações abrem pelo ícone no rodapé da barra lateral ou por `Ctrl+,`, e pertencem ao app. Elas contêm a página **Defaults**, com o modo de review e os modelos e esforços com que uma task nova começa, a página **Boards**, a página **Repositories**, e os prompts.

O tema segue o sistema por padrão e pode ser fixado em claro ou escuro pelo botão da barra lateral. Uma troca do tema do sistema com o app aberto é aplicada na hora.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+N` | Criar uma task |
| `Ctrl+J` | Abrir a primeira task que espera pelo usuário |
| `Ctrl+,` | Abrir ou fechar as configurações |

`Cmd` vale no lugar de `Ctrl`. Os atalhos funcionam com o foco em qualquer lugar da janela, inclusive na caixa de mensagem.

Na visão do board:

| Atalho | Ação |
|---|---|
| `↑` `↓` | Percorrer os cards visíveis |
| `←` `→` | Recolher e expandir a seção do card sob o foco |
| `Enter` | Abrir o detalhe do card sob o foco |
| `Esc` | Fechar o detalhe |
| `/` | Focar a busca |
| `S` | **Start task** no card sob o foco |

As setas, `Enter` e `S` valem com o foco na lista de cards; `/` e `Esc`, em qualquer lugar da visão, `/` fora de um campo de texto.
