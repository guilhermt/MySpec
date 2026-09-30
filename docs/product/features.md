# Funcionalidades

Este documento descreve o produto como ele é. Começa pelos boards, pelas discussões que produzem os cards deles e pelos repositórios de onde as tasks vêm, segue a ordem do ciclo de vida de uma task, passa pelo centro de review, onde o usuário revisa as pull requests de qualquer autor, e termina com o que atravessa todo o produto: sessões, atenção, modelos, prompts e configurações.

## Boards

O produto conhece os boards do GitHub Projects (v2) que o usuário cadastra, de organização ou de usuário, cada um com os repositórios que administra. Ele lê os cards de cada board e cria tasks a partir deles. Funciona com qualquer board: lê os status e os campos de cada um em vez de assumir uma estrutura.

Tudo o que o produto lê do GitHub passa pelo `gh` já autenticado na máquina, com a conta dele; o produto não tem conta nem token próprios. As escritas no GitHub que vêm de um board são a referência ao card na descrição da pull request e os cards que uma [discussão](#discussão) publica, depois de o usuário aprovar cada rascunho; as outras são a pull request de uma task e o review que o usuário publica pelo [centro de review](#centro-de-review).

Um repositório pertence a no máximo um board, e é o board do repositório que define onde as tasks dele aparecem na barra lateral.

### Página Boards

As configurações têm a página **Boards**. Ela lista os boards cadastrados, em ordem alfabética de título, cada um com o título, o dono e o tipo (`Organization` ou `User`), a quantidade de repositórios administrados, o link para o GitHub, os status do board na linha `Final: <finais> · New cards: <status de cards novos>`, a última leitura (`checked 3m ago`, `Not read yet` ou a falha da última leitura) e as ações **Edit** e **Remove**. Acima da lista fica **Add board**.

### Cadastrar um board

**Add board** abre um diálogo em etapas. Na primeira, o usuário cola a URL do board: `https://github.com/orgs/<org>/projects/<n>` ou `https://github.com/users/<usuário>/projects/<n>`, com ou sem sufixos como `/views/<n>` e parâmetros de query. O produto lê o board e recusa, com a razão:

- uma URL que não é de um GitHub Projects v2, com `This isn't the URL of a GitHub project.`; um Project clássico é recusado assim;
- um board já cadastrado, com `<título> is already registered.`;
- um board que não pode ser lido, com a falha da leitura (ver [Falhas](#falhas)).

Lido o board, o diálogo mostra o título e o dono e segue para as escolhas:

- **Status finais.** O produto identifica o campo de status do board, o campo de seleção única chamado `Status`, e lista as opções na ordem do board, cada uma com a marcação `Final`. Vêm pré-marcadas as opções cujo nome é, sem diferenciar maiúsculas nem acentos, `Done`, `Concluído`, `Closed`, `Completed`, `Fechado` ou `Finalizado`. Um board sem campo de status pula esta etapa.
- **Status for new cards.** Uma opção do campo de status, ou `None`, é o status com que um card criado por uma discussão entra no board. Vem pré-selecionada a primeira opção cujo nome é, sem diferenciar maiúsculas nem acentos, `A Fazer`, `To do`, `Todo` ou `Ready`. Um board sem campo de status não tem a escolha.
- **Repositórios administrados.** O produto sugere os repositórios que aparecem nas issues do board, com a contagem de cards de cada um, todos marcados. O usuário desmarca os que o board não administra e pode acrescentar outros digitando `dono/nome`. Um texto fora dessa forma é recusado com `Type the repository as owner/name.`, e um repositório que não existe ou que a conta não lê, com `<dono/nome> doesn't exist or this account can't read it.`

Cada repositório diz como ficará ligado ao produto:

- `Registered · <caminho>`, ou `Registered · Not cloned`: já cadastrado, usa o cadastro existente;
- `Clone found · <caminho>`: não cadastrado, com um clone encontrado pela mesma varredura da pasta home de **Add repository**; será cadastrado nesse clone. Com mais de um clone encontrado, o usuário escolhe qual;
- `Registered without a clone`: não cadastrado e sem clone encontrado; será cadastrado sem clone;
- `<dono/nome> belongs to the board <título>.`: administrado por outro board; aparece desabilitado.

**Add board** confirma: o board é cadastrado, os repositórios marcados são cadastrados ou ligados a ele, e a primeira leitura dos cards começa.

### Editar e remover um board

**Edit** relê a estrutura do board no GitHub e reabre as mesmas escolhas, confirmadas com **Save**. Os status finais vêm como o board os guarda: opções que deixaram de existir somem e opções novas aparecem desmarcadas. O status de cards novos vem como está e volta a `None` quando a opção deixou de existir. Os repositórios do board vêm marcados, e os outros repositórios das issues aparecem desmarcados. Acrescentar um repositório segue as regras do cadastro. Um repositório desmarcado sai do board: vai para o grupo sem board quando tem clone, tasks ou reviews de pull request, e sai do produto quando não tem nada disso. As tasks dele não mudam.

**Remove** pede confirmação e diz o que acontece: `N repositories move to No board and M leave MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.` Os repositórios do board com clone, com tasks ou com reviews de pull request, ativos ou arquivados, passam ao grupo sem board; os que não têm nada disso saem do produto. As tasks criadas de cards do board continuam guardando o card e funcionando, e passam ao grupo **No board** da barra lateral. Nada é alterado no GitHub nem no disco.

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

Cada leitura atualiza o que as tasks ativas do board guardam dos seus cards: título, endereço, corpo, status, estado da issue e épico. O card de uma task ativa que ficou fora da leitura, por ter sido fechado há mais de 14 dias ou tirado do board, é lido diretamente na mesma leitura. Um card que uma leitura nova deixa de ter, e que estava aberto no painel da visão, continua nele, marcado como fora da leitura.

### Falhas

Uma falha de leitura aparece onde a leitura foi pedida: no diálogo do board, na visão do board, na Home (sob a linha do board, com **Try again**), no nó do board na barra lateral e na página **Boards**. Ela nunca espera pelo usuário nem gera notificação, e as tasks do board continuam funcionando. As mensagens:

- `GitHub CLI was not found: gh isn't on the PATH.`
- `gh is not authenticated. Run gh auth login.`
- `gh can't read projects. Run gh auth refresh -s read:project.`
- `The board doesn't exist or this account can't read it.`
- `GitHub's rate limit was reached. It resets at <hora>.`
- `Couldn't read from GitHub: <o que o gh disse>`

### Visão do board

A visão do board abre pelo nó do board na barra lateral e ocupa a área principal, no lugar da task. Abri-la relê o board.

- **Cabeçalho:** o [cabeçalho do lugar](#cabeçalho-do-lugar), com o título do board, e à direita a idade da leitura na tela (`Read 2m ago`, com a hora exata no tooltip, ou `Reading…` com o spinner enquanto uma leitura roda), **Refresh** (`Read the board again`, tracejado enquanto lê), **New discussion**, que abre uma discussão do board sem cards e fica tracejada num board nunca lido, e o `⋯`, com **Select cards to discuss**, **Open on GitHub** e **Edit the board in Settings…**, que abre as configurações na página dos boards. **Select cards to discuss** fica tracejado, com a razão, num board nunca lido, sem card que possa ser selecionado ou com o modo de seleção já ligado.
- **Faixa da falha:** quando a última leitura falha e há uma leitura guardada, uma faixa afundada e sem vermelho fica no alto da lista, sobre os cards da leitura guardada: `Couldn't read the board · <há quanto tempo>`, a mensagem da falha e **Try again**, que vira `Reading…` com o spinner enquanto a nova leitura roda. A idade do cabeçalho continua sendo a da leitura guardada.
- **Barra de filtros**, que só aparece num board lido e com cards: a busca (`Search cards`), que casa com o título, sem diferenciar maiúsculas nem acentos, e com o número, com ou sem `#`; **Assigned to me**, que filtra pelo usuário autenticado no `gh` e fica tracejado, com a razão, quando o `gh` não diz quem ele é; um chip por filtro escolhido, com o `×` que o remove; e o menu **Filter**, com os grupos **Repository**, entre os administrados, **Assignee**, com `· you` no usuário autenticado, e **Status**, com `No status`, este só num board com campo de status. Cada escolha fecha o menu. Os filtros combinam entre si, e **Clear filters**, que só aparece com algum filtro ativo, limpa todos. Um chip cujo filtro deixou de existir no board leva `◇` e diz o porquê no tooltip. Os filtros de cada board são lembrados entre execuções, com o nome do repositório e do status, para o chip dizer o que filtra mesmo sem a leitura.
- **Modo de seleção:** **Select cards to discuss** no `⋯`, ou `Space` numa linha, entra no modo, que fecha o painel e troca a barra de filtros pela barra da seleção: `N selected`, os números dos cards na ordem em que foram marcados, `· filtered` (com as partes dos filtros no tooltip) quando algum filtro está ativo, **Discuss N cards** e **Cancel**. No modo, cada linha mostra a caixa: o clique, `Enter` e `Space` a alternam, e o card não abre. Um card de repositório que o board não administra não pode ser selecionado. **Cancel**, `Esc` ou sair da visão saem do modo e descartam a seleção; uma discussão cancelada deixa o modo e a seleção como estão. Um card que sai da leitura sai da seleção.
- **Lista de cards** agrupada por status, uma árvore de dois níveis: uma seção por opção do campo de status, na ordem do board, mesmo vazia, e a seção `No status` quando a leitura tem cards sem status conhecido, com a contagem já filtrada, mesmo 0. Um board sem campo de status tem uma seção única, `Cards`. O cabeçalho de uma seção mostra o nome e a contagem, é recolhível e, numa seção vazia, não tem seta nem ação. As seções dos status finais começam recolhidas, e o que o usuário recolhe ou expande é lembrado por board. Dentro de cada seção, as issues abertas vêm antes das fechadas, cada grupo na ordem do board, e uma issue fechada numa seção de status não final aparece esmaecida. A lista fica numa coluna centrada, e as linhas dos cards que uma leitura nova traz piscam duas vezes.
- **Linha do card:** o ícone de épico (ou a caixa, no modo de seleção), o número, o título, o título do épico do card (ou `Epic · 2 of 8 finished`, num épico), a primeira dependência que falta, com `+N` quando são mais, e a coluna da task. A coluna da task diz, na ordem: `Cloning <dono/nome>…` ou `Clone failed`, enquanto o card pediu o clone; a task ativa, com a etapa e o estado da linha dela na barra lateral, em destaque quando espera pelo usuário; `In discussion`, quando o card é entrada de uma discussão ativa ou foi escrito por uma. A linha mostra `S start` e `D discuss` com o foco nela, só as teclas que agem. Numa lista de até 1040 px de largura, a coluna do épico, a da dependência e a da task passam para uma segunda linha sob o título. O nome acessível da linha reúne o número, o título, o repositório, o status, `Closed` numa issue fechada, o épico, as dependências que faltam, a task e a discussão, e diz, no modo de seleção, se o card está selecionado, não está ou não pode ser selecionado.
- **Painel do card**, ao lado da lista a partir de 800 px de área principal e sobre ela abaixo disso, com a linha do card aberto marcada. O alto tem o número e o repositório, o caminho ao GitHub e o `×`. O corpo, em ordem:
  1. para um card fora da última leitura, a faixa `This card isn't in the last reading of the board.`, com a razão (`It left the board, or its issue closed more than 14 days ago. The reading of <quando> doesn't have it, so a task or a discussion can't start from it.`), a que as ações tracejadas apontam;
  2. o título e, embaixo, o status, `· Closed` numa issue fechada e o título do épico;
  3. as ações do caso, com no máximo uma primária, e a razão embaixo (veja [Start task](#start-task));
  4. um aviso `Depends on #461` para cada dependência que falta, com o repositório, o estado, o status e as pull requests dela. É só um aviso, e nunca bloqueia;
  5. a task do card: a ativa, num bloco com o nome, o que ela está fazendo e o relógio, e **Open**; ou, sem ela, o link `Archived task: <nome>` da mais recente arquivada, que abre no histórico;
  6. as discussões: `In the discussion <título>` para cada discussão ativa de que o card é entrada, e `From the discussion <título>` para a arquivada que o escreveu, cada uma um link que a abre;
  7. os campos preenchidos e, por último, os responsáveis;
  8. o corpo renderizado como Markdown, ou `No description.`;
  9. as relações, cada grupo só quando tem itens: **Epic**, com `2 of 8 finished` quando ele está na leitura; **Cards of the epic · N** ou, num épico, **Cards · N**, com o status no board ou `Open`/`Closed` fora dele; **Dependencies**, com o estado, o status, `merged #88` na que uma pull request satisfez e `◇ Not satisfied` na que falta; e **Pull requests**. Uma relação que é card da leitura abre o card no painel, expande a seção dele e leva o foco à linha, quando ela está visível (escondida por um filtro, o foco fica no link); as outras abrem no GitHub.

  Um clique ou `Enter` na linha abre o card, e outro fecha. Ao atualizar a leitura, o painel mantém o card aberto, com os dados novos enquanto ele continua nela. Um card que a leitura nova não tem sai da lista e da seleção, mas fica no painel, com a faixa e as ações tracejadas, até o painel fechar.
- **Estados:** um board nunca lido mostra o esqueleto de quatro barras (`Reading the board…`) durante a leitura e, se ela falha, no lugar da lista, `Couldn't read the board`, a mensagem e **Try again**. Um board lido sem cards diz `This board has no issues.`, com o texto de quando os cards aparecem e **New discussion**, sem a barra de filtros. Filtros que não deixam nenhum card dizem `No cards match the filters.`, o que eles pedem (`Nothing on the board has "refund" in the title or the number, assigned to you.`) e **Clear filters**, com a barra de filtros à vista. Uma leitura em curso nunca apaga a lista guardada.

Uma dependência está satisfeita quando a issue dela está fechada ou quando uma pull request vinculada a ela foi mergeada. Uma dependência não satisfeita é só um aviso e nunca bloqueia nada.

A visão é navegável pelo teclado, com uma parada de `Tab` só na lista, a última linha com o foco (senão a do card aberto, a primeira linha de card ou o primeiro cabeçalho). As setas para cima e para baixo, `Home` e `End` percorrem os cabeçalhos e as linhas visíveis, pulando as seções recolhidas; `←` recolhe a seção do cabeçalho, ou a seção de uma linha, levando o foco ao cabeçalho, e `→` expande; `Enter` recolhe ou expande a seção de um cabeçalho e abre ou fecha o card de uma linha. Quando a linha com o foco sai da leitura, o foco vai à linha seguinte, senão à anterior, senão ao cabeçalho da seção. As letras valem sem modificador e fora de um campo de texto, com o foco na lista ou no painel:

- `S` inicia uma task do card (o da linha com o foco, ou o do painel com o foco nele): abre o diálogo de criação; num card de repositório sem clone, abre o painel e leva o foco a **Clone and continue**; num de repositório sem board, abre o painel e **Add to board**. Quando não pode agir, mostra um aviso preso à linha, `No task from #474 · <razão>`: a razão é a task que o card já tem, a issue fechada, o board de outro repositório, o clone inexistente ou o card fora da última leitura. `S` não age num cabeçalho nem no modo de seleção.
- `D` abre uma discussão do card, ou, no modo de seleção, da seleção; o aviso é `#104 can't go into a discussion · <dono/nome> isn't a repository of this board.`, ou `No card is selected · Select a card with Space.` no modo, sem nenhum marcado.
- `Space` numa linha entra no modo de seleção com o card marcado, ou alterna o card no modo, com o mesmo aviso de `D` para o card que não pode ser selecionado.
- `N` abre uma discussão do board sem cards, de qualquer ponto da visão fora de um campo, também no modo; num board nunca lido, o aviso `No discussion yet · The board hasn't been read yet.` aponta para **New discussion**.
- `/` foca a busca, fora do modo de seleção; `↓` e `Esc` na busca levam o foco à lista.

O aviso de uma tecla fica sobre a linha por quatro segundos sem tirar o foco dela; a tecla seguinte, um clique ou uma rolagem o fecham. O `Esc` da visão fecha, um por vez, o aviso, o painel (com o foco no painel, ele volta à linha do card; numa linha da lista, fica nela) e o modo de seleção.

### Start task

A ação do card depende da situação dele:

| Situação do card | Ação |
|---|---|
| Issue aberta, sem task ativa, repositório do board, com clone | **Start task** abre o diálogo de criação a partir do card |
| Igual, repositório sem clone | O painel diz `<dono/nome> isn't cloned yet. A task needs a clone.` e oferece **Clone and continue**, sem passo intermediário; enquanto o clone roda, a primária vira `Cloning <dono/nome>…` (ocupada) e a razão diz `The dialog opens when the clone ends. You can leave the board meanwhile.` no card que pediu o clone e só `The clone is running.` nos outros; terminado o clone, o diálogo de criação abre sozinho. Um clone que falha troca a primária por **Try the clone again**, com a mensagem do `gh` em vermelho |
| Igual, clone inexistente | **Start task** tracejado, com `The clone at <caminho> is missing.` e **Change path…**; se o caminho é recusado, a recusa aparece sob a razão, e se dá certo o foco vai a **Start task**, agora habilitado |
| Repositório sem board, ou ainda não cadastrado | O painel diz `<dono/nome> isn't managed by this board. Start task adds it first.`, e **Start task** abre **Add <dono/nome> to the board**, que liga o repositório como no cadastro do board; confirmado com **Add to board** (`Ctrl+Enter`), o foco vai à primária nova e o card segue pelas linhas acima |
| Repositório de outro board | **Start task** tracejado, com `<dono/nome> belongs to the board <título>.` |
| Card com task ativa | Sem **Start task**; o painel mostra a task |
| Issue fechada | Sem **Start task**; o painel diz `The issue is closed.` |

**Discuss**, o outro botão do painel, abre uma discussão do card e fica tracejado, com `<dono/nome> isn't a repository of this board.`, num card de repositório que o board não administra. Num card fora da última leitura, as duas ações ficam tracejadas e a faixa é a razão.

Um card tem no máximo uma task ativa, e **Start task** volta quando ela é arquivada ou apagada. Um card que está em mais de um board aparece em cada um, mas só o board do repositório dele oferece **Start task**.

## Discussão

Uma discussão é uma conversa com o agente para entender uma demanda de um board, que deixa um documento com o entendimento a que se chegou e produz cards no board: cards novos, a atualização de cards que já existem, soltos ou reunidos num épico. Ela é um item do produto, ao lado da task e do review de pull request, mas sem etapas: tem uma conversa só e não tem worktree.

O agente lê o código dos repositórios do board que têm clone e nunca os altera. Toda escrita no GitHub é do produto, depois de o usuário aprovar cada rascunho, e só acrescenta: nunca remove uma dependência, nunca tira um card de um épico, nunca fecha uma issue e nunca muda o status de um card que já existe.

### Criar uma discussão

Uma discussão pertence a um board e nasce da visão dele, de dois lugares: **New discussion**, no cabeçalho, e **Discuss**, no painel de um card, que abre o diálogo com aquele card. **New discussion** também está no menu **New** da barra lateral e na Home, que abrem o diálogo sem cards para o board do lugar na tela, ou perguntando o board (ver [Tela de boas-vindas e barra lateral](#tela-de-boas-vindas-e-barra-lateral)). O diálogo abre com cards por **Discuss N cards**, na barra da seleção, e por `D`, com a seleção ou com o card sob o foco; **New discussion** abre sempre sem cards.

O diálogo de criação tem:

- o **board**: fixo, com o título, o dono e o número, quando a discussão nasce de um lugar com board; o campo **Board**, o primeiro do diálogo, quando nasce da Home ou do menu **New** num lugar sem board e há mais de um. O campo começa no board da última discussão criada, ativa ou arquivada, se ele foi lido, e senão no primeiro board lido; cada opção diz os repositórios do board e a idade da leitura (`read 2m ago`, ou `◇ read failed 18m ago · uses the last reading`), com `last used` no último; um board nunca lido fica desabilitado com `not read yet`. O foco começa no campo, e trocar de board mantém o título e **What to discuss**;
- o **título**, obrigatório, livre, com até 120 caracteres; um título mais longo é recusado com `Use at most 120 characters.`, e o contador aparece a partir de 100 caracteres. Com um único card selecionado, ele vem sugerido com o título do card; com vários ou nenhum, vem vazio. O título não precisa ser único;
- **What to discuss**, opcional, com o que o usuário quer discutir;
- os **cards** selecionados, cada um com número, título e repositório, removíveis ali;
- **Context**, recolhível e somente leitura, com o contexto inicial que o produto monta;
- o **modelo e o esforço**, partindo do padrão de discussão das configurações;
- **Repositories without a clone**, quando o board tem algum, cada um com **Clone**, ou com **Change path** e o aviso quando o clone registrado não existe, e a linha `The conversation reads the code of the cloned repositories.` Clonar não é obrigatório, e um clone em andamento continua depois de o diálogo confirmar.

**Start discussion** confirma. Ele exige um texto ou ao menos um card: sem os dois, o botão fica desabilitado, com `Write what to discuss or select at least one card.` Ao confirmar, o produto monta o contexto inicial, cria a discussão e abre a conversa com o prompt de discussão. Se a conversa não conseguir começar, a discussão é desfeita, como uma task.

O **contexto inicial** é a primeira mensagem da conversa, em Markdown com rótulos em inglês: o título da discussão; o board, com o título, o link e os repositórios administrados, cada um com o caminho do clone ou `Not cloned`; `What to discuss`, com o texto do usuário, quando existe; e cada card selecionado, com título, `dono/nome#número`, link, estado da issue, status, campos preenchidos, responsáveis e corpo completo, seguido do épico, dos cards irmãos e das dependências. Os cards usam a leitura guardada do board; quando ela tem mais de 5 minutos, o diálogo relê os cards ao abrir, com `Refreshing the cards…`, e uma releitura que falha avisa `Couldn't refresh the cards: <motivo>. The discussion will use the last reading.` e segue com o que estava guardado.

### A conversa

A discussão tem uma conversa só, com a interface de qualquer sessão do produto: mensagens, ações do agente, cartões de permissão e de pergunta, marcadores de evento, fila de envio, interromper, pausar e retomar, medidor de contexto e seletor de modelo e esforço. Ela reabre com o app e acaba quando a discussão é arquivada ou apagada.

A conversa roda na pasta de artefatos da discussão e recebe cada clone dos repositórios do board como diretório adicional de leitura. Não há worktree: o agente lê os clones como estão e nunca edita, commita nem faz push neles.

O agente conduz a conversa para entender a demanda, olhando o código quando precisa, e pergunta só as lacunas reais. Enquanto não escreveu os rascunhos, um turno que termina sem pergunta estruturada espera pelo usuário, como a etapa de PRD. Quando o entendimento está fechado, ele escreve o documento e os rascunhos.

### O documento

O documento é um artefato da discussão, escrito pelo agente, com o entendimento: contexto, problema, restrições, o que entra e o que fica de fora. Ele não propõe a solução técnica.

O painel de documentos, à direita, tem **Context**, com o contexto inicial, e **Document**, com o documento, renderizados como Markdown. O painel abre no documento assim que ele existe e mostra sempre a versão atual: o agente pode reescrevê-lo a qualquer momento, a pedido do usuário na conversa.

### Rascunhos de cards

Junto com o documento o agente escreve os rascunhos, num artefato próprio que o produto lê ao fim de cada turno. O painel **Drafts**, acima da conversa, recolhível, abre sozinho quando uma leitura nova chega e mostra `N of M decided`. Um artefato que o produto não consegue ler é tratado como uma passada sem rascunhos: a discussão espera pelo usuário, com a razão na barra, e o agente pode reescrevê-lo na conversa.

Cada rascunho é **um card novo**, **a atualização de um card existente**, de qualquer card da leitura guardada do board, ou **um épico**. Um rascunho tem título, corpo em Markdown, o repositório, entre os administrados pelo board, o módulo, quando o board tem o campo, as dependências, zero ou mais, cada uma outro rascunho da discussão ou um card existente, e o épico, opcional. Numa atualização o repositório é o do card e não muda.

Cada rascunho tem o seu cartão, editável: título e corpo como texto, repositório, módulo e épico como seletores, dependências como uma lista com acréscimo e remoção. O cartão de uma **atualização** mostra o card como está no GitHub, com o link, e o que o rascunho muda nele: `Current: <valor>` ao lado do título, do módulo e do épico que ficam diferentes, e a aba **Changes** do corpo, com o diff linha a linha, ao lado de **Edit**; as duas abas continuam depois da publicação, somente leitura. O que o card tem agora vem da leitura guardada e, quando ela tem mais de 5 minutos, de uma releitura do card, com `Refreshing the card…`; uma releitura que falha avisa `Couldn't refresh the card: <motivo>. The draft shows the last reading.` Um card fora da última leitura aparece com `This card isn't in the last reading of the board.`

Edições e decisões são guardadas enquanto o usuário as faz e sobrevivem ao fechamento do app. A conversa fica aberta durante a decisão: um rascunho que o usuário quer incluir, mudar ou retirar pode ser pedido ao agente, que reescreve o artefato. O produto mostra a versão nova mantendo o texto e a decisão de cada rascunho que o agente não mudou; um rascunho publicado é somente leitura e o agente não o altera. Um rascunho que sai do artefato leva consigo o épico e as dependências que apontavam para ele, com o aviso no cartão de quem apontava.

Uma discussão pode render um único card, misturar novos e atualizações, ou terminar só com o documento, sem rascunho nenhum.

### Épico

Um **rascunho de épico** agrupa dois ou mais rascunhos de card e tem título, corpo e o repositório da issue pai, escolhido entre os do board. O agente pode propor o épico; o usuário pode criar um com **Group into an epic** sobre rascunhos selecionados no painel, e mover rascunhos para dentro e para fora dele pelo seletor **Epic** de cada cartão. O painel mostra o épico como um grupo, com os rascunhos dentro e as ações do próprio épico.

Um rascunho de card também pode apontar para um **épico existente**, por `dono/nome#número`, em **Existing issue…** do seletor. Nesse caso o card é publicado sozinho e vira sub-issue daquele épico, o que permite acrescentar cards a um épico que já existe.

### Aprovar e publicar

Cada rascunho tem **Approve** e **Discard**; clicar na decisão ativa a desfaz, enquanto o rascunho não foi publicado. Um rascunho descartado fica no painel, esmaecido, e nunca é publicado.

**Um rascunho solto**, sem épico ou com épico existente, publica ao ser aprovado:

- um **card novo**: o produto cria a issue no repositório do rascunho, com título e corpo, a adiciona ao board, define o status de cards novos do board e o módulo, registra as dependências e, com épico existente, a torna sub-issue dele;
- uma **atualização**: o produto atualiza título e corpo da issue, o módulo no board, o épico pela relação nativa e as dependências novas. O status do card não muda.

Um rascunho que **depende de outro rascunho ainda não publicado** pode ser aprovado e fica aguardando: o cartão diz `Waits for <título do rascunho>` e o produto o publica assim que a dependência sair. Um rascunho que depende de um rascunho descartado tem essa dependência removida, com o aviso no cartão, e segue.

**Um épico** publica como unidade. **Publish epic** habilita quando o épico foi aprovado e cada rascunho dele foi aprovado ou descartado, com ao menos dois aprovados; enquanto isso o grupo diz o que falta: `An epic needs at least two cards.`, `Approve or discard every card of the epic.`, `Approve the epic.` ou `Waits for <título do rascunho>`. O produto então cria a issue pai no repositório escolhido, cria cada card aprovado como sub-issue dela, coloca a issue pai e os cards no board, com o status de cards novos e o módulo de cada um, e registra as dependências. Uma atualização dentro de um épico novo atualiza o card e o torna sub-issue da issue pai. A ordem de criação segue as dependências: um card é criado depois dos cards de que depende.

Épico e dependências são registrados pelos recursos nativos do GitHub, issue pai com sub-issues e a relação de bloqueio; o produto nunca escreve a convenção no corpo dos cards. Uma dependência que o GitHub recusa é deixada de lado, com o aviso no cartão, e o card é publicado de todo modo. Um módulo que deixou de ser opção do board também é um aviso, não uma falha.

Enquanto a corrida escreve um rascunho, o cartão dele diz `Publishing…`; os rascunhos que a corrida não carrega continuam dizendo o que esperam. Um rascunho publicado mostra no cartão `Created` ou `Updated`, a referência `dono/nome#número` com o link e a data. Depois de uma publicação, o produto relê o board, para que a visão e as tasks vejam os cards novos.

Uma publicação que **falha** não perde nada: o rascunho continua aprovado e a discussão espera pelo usuário. A razão e **Retry** ficam no cartão em que a corrida parou, o do épico inclusive, no topo do grupo. A razão aparece mesmo quando a issue já foi criada e um passo seguinte falhou: ela fica ao lado de `Created` ou `Updated`. **Retry** repete a corrida pulando o que já foi feito, e o **Retry** do cartão em que a corrida de um épico parou repete a corrida inteira do épico, que continua de onde parou, sem criar nada duas vezes. As razões:

| Situação | Mensagem |
|---|---|
| `gh` fora do PATH | `GitHub CLI was not found: gh isn't on the PATH.` |
| `gh` sem autenticação | `gh is not authenticated. Run gh auth login.` |
| Sem escopo para escrever no repositório | `gh can't write to this repository. Run gh auth refresh -s repo.` |
| Sem escopo para escrever no board | `gh can't write to projects. Run gh auth refresh -s project.` |
| Board inexistente ou sem escrita | `The board doesn't exist or this account can't write to it.` |
| Issue inexistente ou ilegível | `The issue <dono/nome#número> doesn't exist or this account can't read it.` |
| Repositório inexistente ou sem escrita | `The repository <dono/nome> doesn't exist or this account can't write to it.` |
| Limite de taxa | `GitHub's rate limit was reached. It resets at <hora>.` |
| Passo que o GitHub aceitou e o app não conseguiu gravar | `Couldn't record the publication: <o que o banco disse>` |
| Qualquer outra | `Couldn't write to GitHub: <o que o gh disse>` |

No passo que o app não conseguiu gravar, **Retry** grava o que o GitHub já aceitou e continua de onde parou, sem criar a issue de novo.

Um rascunho também não publica quando o board nunca foi lido, com `The board hasn't been read yet.`, quando o card de uma atualização não é do board, com `The card this update rewrites is not one of the board.`, e quando o repositório do rascunho saiu do board, com `<dono/nome> is no longer managed by the board.`

### Módulo

O campo de módulo é o campo de seleção única do board chamado `Módulo` ou `Module`, sem diferenciar maiúsculas nem acentos, identificado pelo nome como o campo `Status`. Num board com esse campo, o prompt de discussão recebe as opções dele, o agente escolhe uma por rascunho, e o seletor do cartão, na linha `Module` seja qual for o nome do campo no board, oferece as opções e `No module`. Num board sem esse campo, os rascunhos não têm módulo e o cartão não o mostra. O módulo é o único campo além do status que o produto preenche; estimativa, responsável e datas ficam para o GitHub.

### A discussão como item

- **Barra lateral:** cada discussão ativa é uma linha sob o nó do board, depois das tasks dele, em ordem de criação, com o glifo de discussão, o título, `#<card> #<card>` no meta e, na segunda linha, como nas linhas das tasks, a situação mais grave (`Question · Discussing`, `Decide drafts · 2 of 5`, `Publish failed`) ou, sem situação, `Discussing` ou `Publishing`. Uma discussão publicada diz `Ready to archive`, sem relógio, e não entra no `Ctrl+J` nem no resumo de um nó recolhido. Ela não aparece sob os nós de épico, e o filtro por repositório não a esconde. Uma discussão de um board removido vai para o grupo **No board**.
- **Tela da discussão:** o [cabeçalho do lugar](#cabeçalho-do-lugar), com o board no breadcrumb e o título, e à direita o estado, o medidor de contexto, **Pause** ou **Resume**, o botão do painel de documentos, **Archive** e **Delete discussion**; a barra da discussão com o estado e os avisos; o painel de rascunhos e a conversa; o painel de documentos.
- **Estados:** `Discussing`, `Waiting for the drafts`, `Decide drafts`, `Publishing`, `Publish failed` e `Drafts published`. O estado da conversa, pausada, com erro, pedindo permissão ou perguntando, prevalece, como na task.
- **Espera pelo usuário:** a discussão espera pelo usuário quando o agente pergunta ou pede permissão, quando a sessão falha, quando um turno termina sem resposta ao usuário antes de os rascunhos existirem, quando o artefato de rascunhos não pode ser lido, quando há rascunhos a decidir e quando uma publicação falha. Ela notifica como uma task, uma vez por situação, com o som do produto. Uma discussão pausada ou arquivada não espera por ninguém.
- **Archive:** o usuário arquiva a discussão a qualquer momento, depois da confirmação `The conversation ends. The document, the drafts and what was published stay in the history.` Rascunhos aprovados aguardando publicação impedem o arquivamento, com `Approved drafts are waiting to be published.`, e uma publicação que falhou, com `A publication failed.` Rascunhos sem decisão são arquivados como `Not published`. Arquivar encerra a sessão, e o lugar da discussão dá vez à [página do item que saiu](#a-página-do-item-que-saiu).
- **Delete discussion:** apaga a discussão, ativa ou arquivada, depois da confirmação `The conversation, the document and the drafts go away. What was published on GitHub stays.`

### Contexto da task

Uma task criada de um card que foi criado ou atualizado por uma discussão recebe, no contexto montado pelo produto, uma seção `Discussion`, depois das dependências e antes de `Additional context`, com o documento da discussão mais recente que criou ou atualizou aquele card. A ligação sobrevive ao arquivamento da discussão e some quando ela é apagada. O épico criado por uma discussão aparece na barra lateral como nó sob o board, como os lidos do GitHub, assim que uma task de um dos seus cards existe.

## Repositórios

O produto conhece os repositórios que o usuário cadastra. Um repositório cadastrado é um repositório do GitHub, identificado por `dono/nome`, ligado ao caminho local de um clone ou ainda sem clone. Um repositório cadastrado a partir de um clone tem a identidade lida do remote `origin`; um repositório cadastrado por um board, sem clone, tem a identidade lida do GitHub. Cada repositório pertence a um board ou a nenhum.

Onde o espaço é curto, como na lista de tasks, o produto mostra o nome curto, a parte `nome`, com `dono/nome` no tooltip; onde há espaço, como na página de cadastro, mostra `dono/nome`.

Só uma instância do app roda por vez. Abrir uma segunda traz para a frente a janela que já existe; um argumento na linha de comando é ignorado.

### Página Repositories

As configurações têm a página **Repositories**. Ela tem o campo **Clone folder** e lista os repositórios cadastrados, em ordem alfabética de `dono/nome`, cada um com o `dono/nome`, `Board: <título>` quando pertence a um board, o caminho local ou `Not cloned`, a contagem de tasks ativas e arquivadas, seguida da de reviews de pull request quando há algum (`2 active · 5 archived · 1 review`), o aviso de clone inexistente quando é o caso, as instruções de review e as ações **Clone**, para um repositório sem clone, **Change path** e **Remove**. Acima da lista fica **Add repository**.

**Review instructions**, recolhível, guarda as instruções fixas de review do repositório: um texto livre, editado ali e salvo com **Save**, que entra em todo review de pull request do repositório, os do [centro de review](#centro-de-review) e o da pull request de cada task. O título da seção diz `Set` ou `None`. As instruções são lidas quando uma passada de review começa, então uma mudança vale a partir da passada seguinte.

**Add repository** abre um diálogo do próprio produto, que varre a pasta home até 6 pastas de profundidade, pulando pastas ocultas e `node_modules` e sem nunca descer para dentro de um repositório, de uma worktree ou de um submódulo. O diálogo lista os clones de repositórios do GitHub encontrados, por `dono/nome` e caminho, em ordem alfabética, com um filtro por nome ou caminho. Um clone sem `origin` ou com `origin` fora do GitHub não aparece. Os clones de repositórios já cadastrados com clone aparecem desabilitados, com `Registered`. O clone de um repositório cadastrado sem clone aparece disponível, e confirmá-lo liga o clone ao cadastro existente. Cada abertura do diálogo varre de novo.

O usuário marca um ou mais clones e confirma com **Add repository**, ou **Add N repositories** com vários marcados. Cada um é cadastrado por vez, na ordem da lista. Com todos cadastrados, o diálogo fecha. Uma recusa aparece sob a linha do clone recusado, que continua marcado, e o diálogo fica aberto, com os que passaram marcados como `Registered`.

**Browse…**, no mesmo diálogo, abre o seletor de pastas nativo, para um clone fora do alcance da varredura. Cancelar o seletor deixa o diálogo aberto; uma recusa aparece no próprio diálogo.

Em qualquer dos caminhos, o produto verifica que a pasta é a raiz de um repositório git, lê o remote `origin` e confere que `dono/nome` ainda não está cadastrado. O remote precisa ser do `github.com`, em SSH (`git@github.com:dono/nome.git`) ou HTTPS (`https://github.com/dono/nome.git`), com ou sem o sufixo `.git`, porque é o GitHub que dá valor a tudo o que vem depois. Uma pasta recusada não é cadastrada, com uma destas razões:

- `<caminho> is not the root of a git repository.`
- `<caminho> has no origin remote.`
- `The origin remote of <caminho> is not on GitHub: <url>.`
- `<dono/nome> is already registered at <caminho cadastrado>.`

**Change path** abre o seletor de pastas nativo e aplica as mesmas verificações, com uma a mais: o `dono/nome` lido da pasta nova tem de ser o do repositório. Uma pasta de outro repositório é recusada com `<caminho> is a clone of <outro dono/nome>, not of <dono/nome>.` Serve para quando o clone foi movido ou refeito em outro lugar. Trocar o caminho não mexe nas worktrees já criadas nem nas tasks: uma task cujo primeiro step ainda não criou a worktree passa a criá-la a partir do clone novo, e um step bloqueado por clone inexistente é destravado por **Try again**.

**Remove** só é possível com o repositório sem nenhuma task e nenhum review de pull request, ativos ou arquivados. Com algum deles, a ação fica desabilitada e o produto diz o que impede, as tasks primeiro: `<dono/nome> has N active tasks and M archived tasks. Delete them before removing the repository.`, ou `<dono/nome> has N active reviews and M archived reviews. Delete them before removing the repository.` Um repositório sem nenhum dos dois é removido após confirmação, e nada é apagado no disco: nem o clone nem as worktrees, que não existem sem tasks nem reviews. Um repositório removido que pertencia a um board sai também do board.

### Repositório sem clone

Um repositório sem clone é cadastrado por um board: pela sugestão dos cards, por `dono/nome` ou por **Add to board** a partir de um card. Ele não é um clone inexistente, que é o de um caminho cadastrado que não está mais lá. Um repositório sem clone não recebe tasks: no diálogo de criação ele aparece desabilitado, com `Not cloned` e a ação **Clone**.

**Change path** liga a ele um clone existente, com as mesmas verificações de sempre. **Clone** clona o repositório com o `gh` em `<pasta de clones>/<nome>`, onde `<nome>` é a parte `nome` de `dono/nome`. A pasta de clones é o campo **Clone folder** da página **Repositories**, escolhido pelo seletor de pastas nativo por **Choose…**, sem valor padrão. Quando um clone é pedido sem a pasta escolhida, o seletor abre naquele momento, a escolha é guardada e o clone segue; cancelar o seletor cancela o clone.

Se a pasta de destino já existe e é um clone do mesmo repositório, ela é ligada ao cadastro sem clonar de novo. Se é qualquer outra coisa, o clone é recusado com `<caminho> already exists and is not a clone of <dono/nome>.` O clone roda em segundo plano, com `Cloning…` onde foi pedido, e o resto do produto continua utilizável. Uma falha mostra a mensagem do `gh` no repositório e no card que pediram o clone, não deixa nada na pasta de destino, e o repositório continua sem clone. Terminado o clone, o repositório passa a ter o clone, e um **Start task** que esperava por ele continua sozinho.

### Clone inexistente

Quando o caminho cadastrado não existe, não é um diretório ou não é mais um repositório git, o repositório aparece na página **Repositories** com o aviso `The clone at <caminho> is missing.` e a ação de trocar o caminho, e na árvore da barra lateral como o aviso `<nome> · clone missing`, que troca o caminho. As tasks dele continuam visíveis e navegáveis, com suas conversas, artefatos e histórico. Fica bloqueado tudo o que precisa do clone, sempre com essa razão:

- criar uma task nesse repositório: ele aparece no diálogo, desabilitado, com o aviso;
- criar a worktree da task, no primeiro step: o step fica bloqueado como um step de worktree suja, com o aviso, e a barra do pedido tem **Change path…** e **Try again**;
- o encerramento: **Close task** fica desabilitado, porque remover a worktree e a branch e atualizar a branch base dependem do clone.

Uma worktree já criada continua sendo usada normalmente: as sessões rodam nela, não no clone. O produto verifica o caminho ao iniciar e a cada ação que precisa dele; não observa o disco continuamente.

### Tela de boas-vindas e barra lateral

Enquanto nenhum board e nenhum repositório estão cadastrados, o produto mostra a tela de boas-vindas no lugar da task, com o nome do produto, a linha `Register a board or a repository to start creating tasks.` e dois botões: **Add board**, que abre o mesmo diálogo da página **Boards**, e **Add repository**, que abre o mesmo diálogo da página **Repositories**. Ao cadastrar o primeiro board ou o primeiro repositório, a tela dá lugar à visão principal.

Com o app configurado, a **Home** é o lugar de partida, com boards ou sem eles. Ela tem, de cima para baixo:

- **Continue**, o botão que volta ao item em que o usuário estava: a task, o review ou a discussão do lugar na tela, ou o mais recente que ainda existe entre os lugares atrás dele; senão, o último item aberto; senão, o item ativo criado por último. Ele mostra o nome, o que o item faz, o relógio e onde ele mora (`Platform Roadmap / API hardening`, `No board`, `Reviews`), com `Enter` na borda. `Enter` e o clique abrem o item onde está a situação mais grave dele, ou o item, sem situação. Sem nenhum item ativo, a seção diz `Nothing in progress`;
- **Start**, com **New task** (`Ctrl N`), que diz `From scratch. A card starts its task on its board.`, **Review a pull request**, que diz `N pending in M repositories`, `Nothing pending`, `Not read yet` ou `reading…`, e **New discussion**, que diz `About the demand of one board` e abre o diálogo com o board do lugar (a Home não tem), o único board, ou perguntando o board; sem board ou sem nenhum board lido, fica tracejada, com a razão no lugar dessa linha (`Add a board to discuss its cards.`, `The board hasn't been read yet.`);
- **Boards**, uma linha por board com o título, os cards abertos e os repositórios (`46 open cards · api, billing`, `Not read yet · api`) e, à direita, a leitura (`read 2m ago`, `◇ Read failed 18m ago`, `reading…`). O clique abre o board. Sob a linha vêm os bloqueios, cada um com a sua ação: a falha da leitura com **Try again**, o repositório sem clone com **Clone** (ou `Cloning…`, e a mensagem do `gh` com **Try again** quando o clone falhou) e o clone inexistente com **Change path…**, cuja recusa aparece sob a linha. Os repositórios sem board formam a linha **No board**, com os mesmos bloqueios de clone;
- os atalhos: `Ctrl J` Next that needs you, `Ctrl N` New task, `Alt ←` Back, `Ctrl ,` Settings.

O foco começa em **Continue** e, sem ele, na primeira linha de **Start**.

A barra lateral tem, de cima para baixo:

- o topo, com a marca e o nome do produto, **New** e `«`, que recolhe a barra na faixa. **New** abre um menu com **New task** (`Ctrl N`), que diz `From scratch. A card starts its task on its board.`, **Review a pull request**, que vai à visão Reviews, e **New discussion**, que diz `About the demand of one board` e abre o diálogo de criação para o board do lugar na tela: a visão do board aberta, o board do repositório da task aberta ou o board da discussão aberta; fora deles, o único board, quando há um só, ou o diálogo com o campo **Board**, que começa no da última discussão criada. Sem nenhum board, **New discussion** fica desabilitado com `Add a board to discuss its cards.`, e sem nenhum board lido, com `The board hasn't been read yet.`;
- o **filtro por repositório**, um seletor com **All repositories** e um item por repositório cadastrado, em ordem alfabética, com `· clone missing` no repositório cujo clone sumiu e `· not cloned` no que não tem clone. A escolha do filtro é lembrada entre execuções do app, e um repositório removido volta o filtro para todos;
- a **árvore** `Active items`, com os reviews, as tasks e as discussões ativas, agrupada por board. Quando há linhas abaixo da parte visível, ou uma cortada pelo fim dela, o fim da árvore esmaece sob `↓ N more below`, que as conta e rola até o fim com um clique;
- o rodapé com **History**, o tema e **Settings**. **History** mostra quantos itens estão arquivados, com a conta por tipo no tooltip (`44 archived: 22 tasks, 12 reviews, 10 discussions`), e fica pressionado com o History ou um arquivado na tela. O tema é um botão de ícone fixo, `Theme: System`, `Theme: Light` ou `Theme: Dark`, que passa ao seguinte a cada clique. **Settings** fica pressionado com as configurações na tela, e o clique nele as fecha de volta ao lugar anterior.

`«` recolhe a barra lateral numa **faixa** de 60 px, e `»` a expande; o estado é lembrado entre execuções. No alto da faixa ficam `»` e o `+` de **New**, com o mesmo menu. Cada item vira um bloco, na ordem da árvore, também os que estão num nó recolhido: o glifo do tipo com o glifo do estado no canto, `+N` quando há outras situações, e embaixo o chip de espera, o relógio do turno do agente ou a palavra do estado (`working`, `checks`, `paused`, `idle`); um item em erro tem o trilho à esquerda, e o aberto fica destacado. Um fio separa os grupos da árvore e leva `◇` quando um board ou Reviews falhou na leitura ou um repositório do grupo está sem clone, e, em Reviews, o número de pull requests pendentes. O nome acessível de cada bloco é o da linha dele, e o tooltip diz o nome do item e o que ele pede. A faixa é navegável pelo teclado como a árvore, com uma parada de Tab só: as setas para cima e para baixo, `Home` e `End` percorrem os blocos, e `Enter` abre o item. O rodapé fica em coluna, com os três como botões de ícone, e a conta de **History** vai para o nome acessível e o tooltip.

A árvore começa pelo nó **Reviews** e segue com um nó por board, em ordem alfabética de título, e depois o grupo **No board**, cada um uma seção separada da seguinte por um espaço:

- o **nó Reviews** mostra o título, com a seta `↗` sob o ponteiro, e abre a visão do [centro de review](#centro-de-review); fica destacado com a visão aberta. À direita ele diz `N pending` com pull requests pendentes, `reading…` enquanto as pull requests são lidas e `◇ Read failed` quando a leitura falhou, com os repositórios no tooltip. Dentro dele vêm os reviews ativos, em ordem de criação, ou `No review in progress.`;
- o **nó do board** mostra o título, com a seta `↗` sob o ponteiro, e abre a visão do board; o nó do board aberto fica destacado como o lugar na tela. À direita ele diz `reading…` enquanto o board é lido e `◇ Read failed` quando a última leitura falhou, com o motivo no tooltip. Um board sem itens ativos mostra `No active items.`. O primeiro item dentro do board é o **aviso de clone inexistente** de cada repositório dele que o filtro mostra, `<nome> · clone missing` com `Change path ↵`, o caminho no tooltip; o clique ou `Enter` trocam o caminho, e uma recusa aparece sob o aviso. O aviso de um repositório sem board fica no grupo **No board**;
- dentro do board vem primeiro um **nó por épico** que tem ao menos uma task ativa, com o título do épico, na ordem de criação da primeira task dele, com as tasks dos seus cards dentro, recuadas depois de uma guia que desce sob a seta do épico. O nó do épico só expande e recolhe. Depois dos épicos vêm as tasks do board sem épico: as de cards sem épico e as tasks sem card dos repositórios do board. Por último vêm as **discussões** ativas do board, que não aparecem sob os nós de épico;
- o grupo **No board** tem os avisos de clone inexistente e as tasks dos repositórios sem board, inclusive as de cards de um board removido, e as discussões de um board removido, e aparece só quando tem alguma.

Dentro de cada nó as tasks seguem a ordem de criação. Os agrupamentos usam o que as tasks guardam dos seus cards, então a árvore não depende de nenhuma leitura do GitHub.

Cada item é uma **linha** de até três linhas:

- a primeira tem o glifo do tipo (task, task One-Shot, review, discussão) e o nome, em negrito quando o item espera pelo usuário. À direita, sob o ponteiro, com o foco ou na linha aberta, vem o meta, `<repositório>#<card>` numa task (com ` · One-Shot`), `<repositório>#<número>` num review e `#<card> #<card>` numa discussão, só quando cabe ao lado do nome inteiro; o que não cabe vai para o tooltip do nome;
- a segunda diz o estado mais grave do item, com o glifo do estado: a situação que espera pelo usuário, com o lugar dela (`Question · Implementer · Step 3/7`) e o tempo de espera num chip, ou, sem situação, o que acontece (a etapa ou o step com o agente trabalhando e o relógio do turno, o app preparando ou commitando, `GitHub` esperando os checks, `Paused · <posição>`, `idle`). Numa pull request que espera os checks, a linha diz `PR review · checks a/b`, em que `a` são os checks que passaram, `skipped` e `neutral` incluídos, e `b` todos; antes de o GitHub responder pela primeira vez, ou enquanto a leitura não lista nenhum check, ela diz `PR review · checking GitHub`, com o brilho de uma leitura sem resultado. Outras situações do item somam `+N`, com a lista no tooltip. Uma discussão publicada diz `Ready to archive`. O texto tem uma forma longa e uma curta, e a curta entra quando a longa não cabe ou com a barra lateral abaixo de 330 px;
- a terceira aparece só com um agente trabalhando: o que ele faz agora, verbo primeiro, em mono, com o verbo mais forte que o alvo (`Running go test …/ratelimit`, `Thinking…`), e o medidor do contexto que a conversa usou. A forma curta guarda o comando e o último segmento do caminho que o identifica, pulando o `...` de um padrão de pacote do Go.

Um item em erro tem um trilho à esquerda; o item aberto fica destacado na cor da marca e rola para a vista. O nome acessível de uma linha diz o tipo, o nome, cada situação com o tempo, a posição, o que o agente faz e o meta, numa frase só.

Cada nó expande e recolhe pela seta ao lado do título, e o que o usuário recolhe é lembrado entre execuções. Recolhido, o nó resume as suas linhas por estado, do mais grave (`1 error`, `2 waiting`, `to close`, `working`, `checks`, `paused`), e o nome acessível dele diz o resumo inteiro. Aberto, o nome acessível diz o que ele mostra à direita: `Reviews, 4 pending`, `Platform Roadmap, reading`, `Platform Roadmap, read failed: <motivo>`. Os nós do item aberto se expandem ao abri-lo, e uma task escondida pelo filtro volta o filtro para **All repositories**.

A árvore é navegável pelo teclado, com uma parada de Tab só: na linha aberta ou, sem item aberto, no nó **Reviews**. As setas para cima e para baixo percorrem as linhas visíveis, e `Home` e `End` vão às pontas, sem abrir nada. A seta para a direita expande um nó recolhido e, num nó aberto, vai ao primeiro item dele; a seta para a esquerda recolhe um nó aberto e, num item ou num nó recolhido, vai ao nó de cima. `Enter` abre o item, o board ou a visão Reviews, alterna um épico ou **No board**, e troca o caminho num aviso de clone. Com o filtro num repositório, a árvore mostra só o nó do board desse repositório, ou o grupo **No board**, com as tasks do repositório. Uma discussão pertence a um board, não a um repositório, então o filtro nunca a esconde do nó que ele mostra. Um filtro num repositório sem board e sem tasks diz `No tasks in <nome curto>.` sob a árvore. Os reviews não passam pelo filtro.

### Dados de uma versão com áreas de trabalho

Ao abrir um banco que ainda guarda áreas de trabalho, o produto leva as tasks para repositórios cadastrados antes de mostrar qualquer coisa. Cada task de repositório é ligada ao repositório do seu clone, identificado pelo remote `origin`, e um repositório é cadastrado por identidade, no caminho do clone em que ele trabalhou por último. Os artefatos vão para a pasta nova da task. As tasks arquivadas criadas na raiz de uma área de trabalho são descartadas, porque não pertencem a nenhum repositório.

A migração é tudo ou nada, e três coisas a impedem: uma task ativa na raiz de uma área de trabalho, um clone que não pode ser identificado no GitHub, e duas tasks com o mesmo nome no mesmo repositório. Quando alguma acontece, nada é mudado, e o produto mostra no lugar de tudo a tela **MySpec couldn't be updated**, que lista os casos agrupados por tipo, com as tasks de cada um e o que fazer a respeito na versão anterior. As tasks, os documentos e as worktrees ficam como estavam, e a versão anterior continua abrindo tudo. Resolvidos os casos, abrir esta versão de novo tenta outra vez.

## Criação de uma task

**New task**, no menu **New** da barra lateral, e `Ctrl+N` abrem o diálogo de criação de qualquer lugar do produto. Na criação o usuário informa:

- o **repositório**, obrigatório, entre os cadastrados. O seletor vem pré-selecionado com, nesta ordem, o primeiro que existir: o repositório do filtro, quando o filtro não é **All repositories**; o repositório da task aberta; o último repositório usado numa criação; o primeiro da lista. Um repositório com clone inexistente aparece desabilitado, com o aviso, e um repositório sem clone aparece desabilitado, com `Not cloned`, ou `Cloning…` enquanto clona. O item de um repositório sem clone tem a ação **Clone**, por clique ou `Enter`, que não escolhe o item nem fecha a lista. O erro de um clone que não começa e o de um clone que falhou aparecem em vermelho no item, e só o de um clone que não começa aparece também sob o seletor;
- o **nome**, em minúsculas, dígitos e hífens simples, com até 64 caracteres, único no repositório escolhido, tasks arquivadas incluídas, porque ele nomeia a branch e a worktree. O campo é o primeiro a receber o foco, e `Enter` nele cria a task. Um nome com caracteres inválidos ou longo demais é recusado com a mensagem sob o campo e o link `Use "<sugestão>"`, quando há uma. Um nome já usado é recusado com `A task named <nome> already exists in <dono/nome>.`; o mesmo nome em outro repositório é permitido;
- o **contexto**, obrigatório numa task sem card: o que quer fazer, em alto nível ou em detalhe. É a primeira mensagem da primeira sessão de planejamento, a de PRD ou a de planejamento One-Shot;
- o **modo** (**Mode**), `Structured` ou `One-Shot`, num controle segmentado que parte sempre de `Structured` e anda com `←` e `→`, com uma linha que diz o que o modo escolhido faz: `A PRD, a tech spec and a plan of steps, each step its own commit. Fixed once the task exists.` ou `One planning conversation writes a single document, implemented in one commit. Fixed once the task exists.` O modo nunca muda depois da criação;
- o **modo de review** (**Review mode**), `Manual` ou `Agent`, ao lado do modo, no mesmo tipo de controle, com o ícone da pessoa ou do robô em cada opção, partindo do padrão configurado, com uma linha que diz o que o modo escolhido faz: `You review each step in VS Code before its commit.` ou `An agent reviews each step, and the task runs to the pull request on its own.` Ele vale para todos os steps que o plano escrever, ou para o step único de uma task One-Shot;
- o **modelo e o esforço de cada etapa** do modo escolhido, numa linha **Models** que abre e fecha no lugar, com o resumo à direita (`Defaults`, ou a primeira etapa ajustada, `+N` e `the rest from Defaults`), partindo dos padrões configurados. Cada etapa tem um chip de modelo e esforço; uma escolha própria fica em destaque, com `Defaults: …` no tooltip. O usuário pode ajustar qualquer etapa para essa task. A lista acompanha o modo, e o ajuste de uma etapa que os dois modos têm, como a implementação, se mantém ao trocar de modo; o resumo ao lado de **Models** considera só as etapas do modo escolhido.

`Ctrl+Enter`, de qualquer campo, cria a task. Enquanto falta algo, **Create** fica desabilitado e o rodapé diz o quê: `Choose a repository to create the task.`, `Name the task to create it.`, `Fix the name to create the task.` ou `Say what you want to build.`

Ao confirmar, **Create** vira `Creating…`, o rodapé diz `Starting the first session…` e os campos ficam somente leitura. A primeira sessão de planejamento do modo abre no clone do repositório e começa com o contexto inicial, e a primeira coisa que o usuário vê é a primeira pergunta do agente. Se a criação falha, o diálogo continua aberto com o erro em vermelho no rodapé, os campos voltam e **Create** volta a agir. Se a sessão não consegue começar, a task é desfeita e, quando a exclusão dá certo, o erro termina em `The task was undone.` Uma task One-Shot se distingue pelo glifo e pelo meta ` · One-Shot` da linha na barra lateral.

### A partir de um card

**Start task** num card abre o mesmo diálogo, com estas diferenças:

- o topo mostra o card num bloco afundado: número, título e, embaixo, o repositório, o status e o épico. O repositório é o do card, sem seletor;
- o **nome** vem sugerido como `<número>-<slug do título>`, e é editável. O slug é o título em minúsculas, sem acentos, com cada sequência de caracteres fora de `a-z0-9` virando um hífen, sem hífens nas pontas, cortado numa fronteira de palavra para o nome inteiro caber em 64 caracteres. Um nome sugerido que já existe no repositório é recusado como qualquer outro, e o usuário o edita;
- no lugar do contexto, uma linha afundada diz o que o produto montou, com o que o card tem: `From the card: #474, the epic Usage-based billing, 6 cards of the epic, 1 dependency and the discussion Usage-based pricing tiers · 5,690 characters`. **Show** abre o texto montado, somente leitura e em Markdown, numa caixa que rola; **Hide** o fecha. Até o texto chegar, **Show** fica tracejado com `The context isn't read yet.`, e sem contagem de caracteres; se a leitura do contexto falha, o aviso do app diz o motivo e **Show** fica tracejado com `Couldn't read the context.`. **Add to it** abre o campo `Additional context`, opcional, que recebe o que o usuário quiser acrescentar ao fim do contexto;
- um aviso por dependência não satisfeita, com o repositório, o estado, o status e as pull requests, e a frase `A warning only: the task can start.` O aviso nunca bloqueia a criação.

O contexto montado é, em Markdown e com rótulos em inglês, nesta ordem: o card, com título, `dono/nome#número`, link, status, campos preenchidos, responsáveis e o corpo completo; o épico, quando existe, com título, referência, link e corpo completo; os cards irmãos, um por linha, com referência, título e status; as dependências, uma por linha, com referência, título, estado, status e pull requests com o estado; sob `Discussion`, o documento da discussão que criou ou atualizou o card, quando ele saiu de uma; e, sob `Additional context`, o texto do usuário, quando existe. Ele é o contexto inicial da task: a primeira mensagem do PRD ou do planejamento One-Shot.

O contexto usa a leitura guardada do board. Quando a leitura do card tem mais de 5 minutos, o diálogo relê o card, o épico, os irmãos e as dependências ao abrir, com `Refreshing the card…`, e **Show** fica desabilitado até a releitura acabar. Se a releitura falha, a linha diz `◇ Couldn't refresh the card: <motivo>. The task will use the last reading.` e a criação segue com o que estava guardado. Um card que saiu da última leitura enquanto o diálogo abria mostra `◇ This card isn't in the last reading of the board.`, e o rodapé fica só com **Cancel**.

Criar a task de um card que ganhou uma task ativa enquanto o diálogo estava aberto é recusado com `Card #<número> already has an active task: <nome>.`

A task guarda o card: o board, o repositório, o número, o título, o corpo, o link, o status e o estado da issue, e o épico. Cada leitura do board atualiza esses dados nas tasks ativas; uma task arquivada guarda o card como estava ao arquivar. O card fica no painel **Card**, aberto pelo botão **Card** do cabeçalho, que só uma task criada de um card tem, com o tooltip `The card <dono/nome>#<número> on the board`. O painel mostra o card da última leitura do board: a referência `<dono/nome>#<número>`, o status no board e **Open on GitHub**, o título, o corpo em Markdown e, cada grupo só quando tem itens, **Epic**, **Cards of the epic · N** (os irmãos, com o status), **Dependencies** (com o estado e `◇ Not satisfied` na que não está satisfeita) e **Pull requests** (`#N` com o estado, e o repositório quando é outro). Uma relação que é card da última leitura do board abre o board com o card no painel dele; as outras abrem no GitHub. Quando a última leitura não tem o card, uma faixa no alto do painel diz por quê, `This card isn't in the last reading of the board.`, `The board hasn't been read yet.` ou `The board of this card was removed.`, e o painel mostra só o que a task guarda: a referência, o status, o título e o épico. O cabeçalho da task arquivada no histórico tem o link do card, um botão de ícone `Open card #<número> on GitHub · <status>`, com o status de quando a task foi arquivada, que abre a issue.

## Etapas de planejamento

O modo define as etapas de planejamento. Uma task Structured passa por PRD, tech spec e plano; uma task One-Shot, por uma única etapa, o planejamento One-Shot. Cada etapa tem uma conversa própria, aberta no clone do repositório da task. A etapa termina quando o documento dela aparece no diretório de artefatos e a conversa está ociosa: o agente parou e nada está na fila. O produto então inicia a etapa seguinte sozinho.

- **PRD.** O agente segue o prompt de PRD: Q&A sobre o quê e o porquê, uma pergunta por vez, até não restar lacuna. Ao final lista o que entendeu, pede confirmação e escreve `PRD.md`.
- **Tech spec.** O agente lê o PRD, explora o código do repositório da task e conduz o Q&A técnico, apresentando alternativas com trade-offs para o usuário decidir. Escreve `tech-spec.md`.
- **Plano.** O agente lê os dois documentos, negocia a divisão do trabalho e escreve um arquivo por step em `steps/`. Cada arquivo tem o nome `<número>-<descrição-curta>.md` e traz um título `# Step N: Título`. Os números começam em 1, sem lacunas nem repetições.

O plano é validado antes de a task avançar. Quando os arquivos não formam um plano válido, o produto diz ao agente o que está errado e pede a correção, até três vezes; cada pedido aparece na conversa como a mensagem do produto `The plan isn't valid yet · 3 problems · correction 1 of 3`. Depois disso para de corrigir, e a conversa do plano ganha o marco `The plan is still invalid · 3 problems`, que abre a lista dos problemas, cada um com o arquivo em mono e a mensagem; ele entra de novo só quando a lista muda. A barra do pedido diz `Plan still invalid`, com a contagem e **Show problems**, que abre o marco e leva o foco a ele. O usuário resolve na conversa ou descarta o plano.

O PRD, o tech spec e cada arquivo de step ficam no painel **Artifacts** da task, renderizados como Markdown com diagramas mermaid, e a lista dos steps, com o estado e os relatórios de cada um, fica no painel **Details**. Antes do plano, **Details** diz `Steps come from the plan.` Os dois painéis ficam fechados até o usuário abri-los pelos botões do cabeçalho (ver [Cabeçalho do lugar](#cabeçalho-do-lugar)).

### Planejamento One-Shot

O planejamento de uma task One-Shot é uma conversa aberta no clone do repositório da task, com o prompt de planejamento One-Shot, que junta num só Q&A o quê e o como. O agente lê o contexto inicial, explora o código e a documentação do repositório e resolve as lacunas uma pergunta por vez: comportamento esperado, casos de borda, limites do escopo, abordagem, contratos e padrões a seguir. Quando há mais de um caminho válido, apresenta as alternativas com trade-offs para o usuário decidir. Sem lacunas restantes, lista os pontos principais do que vai mudar e como, pede confirmação e escreve `one-shot.md` no diretório de artefatos.

O documento é o prompt inteiro da implementação: um agente novo o recebe sem conversa, sem histórico e sem outro documento. Por isso ele tem o nível de detalhe de um tech spec, com diretrizes, decisões e o plano de mudanças, sem o código pronto. Segue nove seções, nesta ordem: o título `# <nome da mudança> — One-Shot`, com a instrução de seguir o documento estritamente, **Problem**, **Scope**, **Technical decisions**, **Change plan**, **Coding standards**, **Completion checklist** e as instruções fixas **Questions** e **Workflow**, as mesmas de um arquivo de step. O produto não valida o conteúdo: a existência do documento basta, como para o PRD e o tech spec.

A etapa termina como as outras, com o documento escrito e a conversa ociosa, e o produto inicia a implementação sozinho. O documento aparece no painel **Artifacts**, como `One-Shot document`, renderizado como os outros. Uma task One-Shot não tem lista de steps: a partir da implementação, o painel **Details** tem a linha **Implementation** no lugar dela, e antes não tem nenhuma das duas.

### Voltar e descartar

As ações sobre as etapas ficam no menu `⋯` do cabeçalho da task. O grupo da etapa de planejamento atual tem **Discard and restart the PRD…**, **…the tech spec…** ou **…the plan…**; numa One-Shot, **Discard and restart planning…**. O grupo **Task** tem as ações sobre as etapas já passadas: **Back to PRD…** e **Discard and restart the PRD…** numa task Structured depois do PRD, **Back to Tech spec…** e **Discard and restart the tech spec…** depois do tech spec, **Discard and restart the plan…** na implementação.

- **Voltar a uma etapa** reabre uma etapa anterior e apaga tudo que veio depois: conversas, documentos, arquivos de step, relatórios de review, worktrees e branches, com o que houver de não commitado nelas, e o que a etapa de PR criou. A task fica na etapa reaberta, em modo de revisita, para que o documento possa ser retrabalhado sem o produto avançar no meio. Com o documento escrito e a conversa ociosa, a barra do pedido acima do compositor diz `Ready to continue` com o nome da etapa, e o botão **Continue** a encerra.
- **Descartar e recomeçar** apaga a etapa atual também e inicia uma sessão nova para ela na hora.

Numa task One-Shot, **Back to planning…** existe com a task na implementação ou na etapa de PR, mantém o documento e a conversa de planejamento e deixa a task revisitando o planejamento até **Continue**; a implementação então começa do zero numa worktree nova. **Discard and restart planning…** existe em qualquer etapa e apaga também a conversa e o documento de planejamento. A implementação e a PR não são descartadas como etapas nos dois modos: um step se descarta com **Discard step N…**.

Cada ação diz, antes de confirmar, exatamente o que será perdido.

## Implementação

Com o plano válido, a task entra na implementação e o produto inicia o primeiro step sozinho. Os steps rodam em sequência, na ordem numérica, um de cada vez.

Numa task One-Shot, a implementação é um step único, o próprio documento One-Shot, no repositório da task. Tudo o que esta seção diz de um step vale para ele, com as diferenças que ela aponta: ele usa o modelo e o esforço da implementação e o modo de review da task, sem escolha própria, e a task não tem lista de steps.

### Worktrees

A task tem uma worktree, criada no primeiro step, em `~/.local/share/myspec/worktrees/<dono>/<nome>/<task>/`, numa branch com o nome da task. Todos os steps rodam nela. A base é resolvida na criação: o produto roda `git fetch origin` e ramifica de `origin/dev`, ou de `origin/main` quando não há `dev`. O fetch só acontece na criação.

O produto é dono das worktrees que criou, e só delas: nunca reutiliza nem apaga um caminho ou uma branch que não criou. Uma worktree registrada em outro caminho continua sendo usada e removida onde está. Uma worktree e sua branch são removidas quando a task é apagada, quando a task volta a uma etapa de planejamento ou descarta uma, o planejamento One-Shot incluído, e no encerramento da task.

O primeiro step de uma task cujo clone não existe mais fica bloqueado com o aviso do clone, porque a worktree nasce do clone.

Enquanto o step não tem conversa, a coluna diz o que o produto faz: `Starting step 5…` (numa One-Shot, `Starting the implementation…`), a fase da preparação, `Fetching origin…`, `Creating the worktree…`, `Checking the worktree…` ou `Preparing the worktree…`, e `Starting the next step…` entre um commit e o próximo step. Com todos os steps commitados, antes da etapa de PR, ela diz `Every step is committed` e `7 steps in acme/api. The pull request stage starts next.` (numa One-Shot, `The implementation is committed`); um plano sem steps, `No steps were found` e `The plan has no step files.` Nenhum desses momentos tem compositor.

### Pré-condição: worktree limpa

Antes de iniciar um step o produto verifica que a worktree está limpa: nada modificado, em stage, apagado ou não rastreado, ignorados à parte. Uma worktree suja bloqueia o step, com o que foi encontrado e duas saídas: limpar por conta própria e **Try again**, ou deixar o produto descartar tudo com **Clean and start…**. Um step é bloqueado do mesmo modo quando o fetch falha, quando nenhuma branch base existe, quando o caminho ou a branch já existem, ou quando o clone do repositório não está mais lá. A mensagem do git é mostrada como o git a escreveu: a coluna do step bloqueado tem a linha `Step 5 is next` com o título do step (numa One-Shot, `Implementation is next` com o nome da task) e, abaixo dela, o bloco de erro com o que fazer e as linhas do git, sem botão e sem compositor.

As saídas ficam na barra do pedido, que diz `Step 5 blocked` (numa task One-Shot, `Implementation blocked`) e a razão curta: `worktree not clean`, `fetch failed`, `no base branch`, `path exists`, `branch exists`, `git failed` ou `clone missing`. **Try again** é a principal e diz `Checking…` enquanto verifica; **Clean and start…** aparece só com a worktree suja, e **Change path…**, que abre o seletor de pastas do clone, só com o clone inexistente. **Clean and start…** pergunta antes, num diálogo que abre com o foco em **Cancel**: `Clean the worktree and start step 5?`, `These changes are thrown away:` e as linhas que o git listou, até 12 e `and N more`, e `Nothing else in the repository changes.` **Clean and start** diz `Cleaning…` enquanto corre; quando falha, a razão fica no rodapé do diálogo e o botão passa a **Try again**.

### Sessão do step

A sessão de um step abre dentro da worktree, com o arquivo do step como primeira mensagem. O arquivo aponta para o PRD e o tech spec no diretório de artefatos, delimita o escopo e traz o checklist de conclusão. Os steps anteriores já estão commitados na branch. Numa task One-Shot, a primeira mensagem é o documento One-Shot, que basta sozinho.

O agente implementa seguindo o tech spec, ou o documento One-Shot. Só pergunta quando algo genuinamente o bloqueia, e sempre pela ferramenta de perguntas estruturadas, que o produto mostra como um cartão com opções. Ao terminar, apresenta o resumo do que fez. No modo `Manual`, o step passa a **aguardando review** assim que o agente encerra um turno sem nada pendente, e pedir uma mudança na conversa o devolve a **implementando**. No modo `Agent`, o turno encerrado leva o step ao revisor, como diz [Review pelo agente](#review-pelo-agente).

### Modo de review

Cada step é revisado no modo `Manual` ou no modo `Agent`, este mostrado sempre com um ícone de robô. No `Manual`, o usuário revisa o step no editor, dá stage arquivo a arquivo e aprova. No `Agent`, um agente revisor revisa o step com o implementador, e o step é commitado quando o relatório do revisor vem limpo, sem ninguém dar stage.

O modo é escolhido em quatro lugares:

- **Settings**: a página **Defaults** guarda o padrão, `Manual` de fábrica. Uma mudança vale para as tasks criadas depois dela.
- **Criação da task**: o diálogo parte do padrão, e a escolha vira o modo da task.
- **Tela da task**: **Review mode**, no menu `⋯`, com o modo da task ao lado, e o chip **Review mode** do grupo Task do painel **Details** abrem o mesmo popover, ancorado no `⋯` ou no chip, que troca o modo da task. A troca vale para os steps não iniciados sem escolha própria e, antes do plano, para os steps que o plano escrever; numa task One-Shot, para o step único enquanto ele não começou. Quando nenhum step resta para começar, o seletor fica desabilitado.
- **Lista de steps**: no painel **Details**, cada step não iniciado tem um seletor de modo ao lado do de modelo, e escolher um modo dá ao step um modo próprio. Um step com modo próprio aparece em destaque, com `Its own mode · the task reviews with Agent` no tooltip, e o menu dele termina em **Follow the task · Agent**, com o modo da task, que o faz seguir a task de novo; um que segue a task aparece discreto, com `Follows the task`. Uma task One-Shot não tem lista de steps, e o step único segue o modo da task.

O modo de um step congela quando a sessão do step começa. Dali em diante ele só muda de `Agent` para `Manual`, pelas saídas do review pelo agente, e nunca volta. Em **Details**, o step atual mostra, sem edição, o modo com que é revisado, `now · Agent` ou `now · Manual`; um step que passou ao usuário mostra `now · Manual`, com um tooltip que diz por quê.

### Review

No modo `Manual`, o review é feito no editor, arquivo por arquivo. **Open in VS Code**, no menu `⋯` da task, na barra do pedido ou por `Ctrl+E`, abre a worktree, e cada arquivo da lista de mudanças abre diretamente ao ser clicado. O usuário dá stage em cada arquivo revisado e faz alterações manuais quando quer.

Enquanto o step aguarda review o produto observa a worktree, inclusive o diretório do git, para que o stage feito no editor apareça na hora, e lê o `git status` a cada rajada de eventos. Todo arquivo alterado que o git reporta conta, arquivos novos um a um, ignorados nunca. Um arquivo está revisado quando nada dele resta fora do índice; um arquivo parcialmente em stage ainda está pendente. O cartão `Changed files · 7`, no fim da conversa do step, lista os arquivos: a letra do git (`A`, `M`, `D`, `R`, `U`), o caminho e `staged`, `partly staged` ou `not staged`. Cada arquivo abre no VS Code, com `Open <caminho> in VS Code` no tooltip; um arquivo apagado não abre e diz `The file was deleted, so there is nothing to open`. O cartão mostra até 12 arquivos, e `Show N more files` mostra o resto, com o foco no primeiro arquivo que aparece. Antes da primeira leitura ele tem três linhas de esqueleto, e quando a worktree não pode ser lida diz `Couldn't read the worktree` com a mensagem do git. O cartão é uma entrada da conversa para o teclado: `↑` e `↓` andam pelos arquivos e seguem para a entrada anterior ou a seguinte nas pontas, e `Enter` abre o arquivo. O progresso fica na barra do pedido e aparece como percentual na lista de tasks. O produto nunca dá stage em nada: o stage é o review, e o review é o portão.

### Aprovação e commit

Com o step esperando review, a barra do pedido acima do compositor diz `Review step N`, ou `Approve step N` com tudo em stage, com o progresso ao lado (`5 of 7 files staged · 71%`), e traz **Open in VS Code** e **Approve**. A barra aparece também com a task pausada, sem a cor e sem o tempo de espera. **Approve** existe no modo `Manual` e só habilita com 100% em stage; abaixo disso diz o que falta (`Stage 2 more files`), e com a worktree ilegível diz `The worktree couldn't be read`. Também exige a sessão ociosa, sem turno rodando, nada na fila e nenhuma permissão ou pergunta em aberto, e retoma uma sessão pausada por conta própria.

Aprovar envia o prompt de commit como mensagem do produto na própria conversa do step, para o agente que escreveu o código commitar exatamente o que está em stage, em um commit, com assunto no imperativo e a convenção do repositório. O step fica **concluído** quando um commit aparece na branch além daquele em que começou, venha do turno de commit ou da mão do usuário. Se o turno termina sem commit, o step volta a **pronto para aprovar** e a barra diz `the last approval didn't produce a commit`. Um step em que o agente não mudou nada não pode ser aprovado: a barra diz `Step N has no changes` e oferece **Discard step N…**.

O cartão de arquivos fica no fim da conversa do step enquanto ele espera review, está pronto para aprovar, tem a worktree ilegível ou está sendo commitado.

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

**Review myself** aparece no grupo do step do menu `⋯` enquanto o agente revisa o step, antes do commit, e tira o review do agente sem confirmação. Uma passada em curso é interrompida na hora, sem relatório; um implementador no meio de um turno termina o turno. Toda saída do loop que não termina num commit leva o step para o modo `Manual`, em **aguardando review**, com a worktree como está e os relatórios à vista: **Review myself**, as três rodadas sem relatório limpo e o turno de commit que termina sem commit, que a barra do pedido anuncia ao lado do progresso. Dali em diante é o fluxo do modo `Manual`. A conversa do revisor continua visível e aceita mensagens, mas o produto não pede mais passadas nem age sobre relatórios novos.

O cartão de arquivos não aparece durante o loop: ninguém dá stage. **Open in VS Code** e **Discard step N…** continuam no menu `⋯`, e o usuário pode mudar arquivos na worktree ou escrever a qualquer das conversas durante o loop; o que ele muda entra na próxima passada e no commit.

Da primeira passada ao commit, a conversa do step tem as abas **Implementer** e **Reviewer**, sob o cabeçalho, na coluna da conversa; o cartão de arquivos, quando o step passa ao usuário, fica no fim da conversa das duas abas. Cada aba tem o glifo da sua sessão e o nome: o da situação que espera pelo usuário ou, sem ela, o que a sessão faz (trabalhando, pausada, em erro, ociosa). A aba de fora diz `· waits` quando a conversa dela espera pelo usuário e `· error` quando ela falhou; o nome acessível e o tooltip dizem o estado inteiro, `Reviewer: waits for you: question, for 4 minutes`. No instante entre o fim do turno do implementador e o início da sessão do revisor, a aba **Reviewer** fica desabilitada, com `Reviewer · starts with pass 1`. Na primeira vez que o step abre, a aba escolhida é a da situação mais antiga das duas conversas; sem situação, a do revisor durante uma passada e a do implementador no resto. Dali em diante, o produto nunca troca de aba sozinho: só o clique, as setas, `Ctrl+J` e a notificação, que abrem a aba da situação. Uma situação nova na aba de fora a faz piscar duas vezes na cor da sua gravidade, como na barra lateral, e nada pisca com o movimento reduzido do sistema. As abas são uma parada de Tab, e `←` e `→` trocam de conversa. O relatório entregue e o prompt de commit aparecem na conversa do implementador como mensagens do produto, e cada relatório tratado aparece como marcador na conversa do revisor, com o número e o status. No painel **Details**, os relatórios aparecem sob o seu step, também sob o step atual, como `Review 1 · changes`, `Review 2 · clean`; numa task One-Shot, sob a linha **Implementation**. Cada um abre no lugar da lista, renderizado, com o título (`Step 3 · Review 1 · changes`), e **← Details** volta à lista.

O loop não anda enquanto qualquer das conversas trabalha, pergunta, está pausada ou com erro: é ali que o step espera. Uma sessão parada num erro tem, na barra do pedido, **Retry implementer** ou **Retry reviewer**, que reinicia aquela sessão, e o loop segue quando ela volta; um revisor que volta sem o relatório da passada espera por uma resposta no compositor. Um turno que falhou com o processo vivo não tem **Retry**: a resposta vai pelo compositor. Uma task pausada não inicia passadas nem entrega relatórios. Fechar e reabrir o app retoma o loop de onde parou, com o modo de cada step, a rodada, os relatórios e as duas conversas.

### Descartar step

**Discard step N…**, no grupo do step do menu `⋯` (numa One-Shot, **Discard the implementation…**), encerra as sessões do step e do revisor, apaga as duas conversas e os relatórios de review do step e o começa de novo, limpando a worktree a menos que o usuário peça o contrário. O step recomeça com o modo escolhido antes de ele começar e com as rodadas zeradas.

## Pull request

Com o último step commitado a task entra na etapa de PR. Ela é uma só, como a task: uma conversa que escreve o rascunho e abre a pull request, uma conversa que a revisa. O que a pull request pede ao usuário aparece na barra do pedido, entre a conversa, ou o lugar da etapa sem conversa, e o campo de mensagem; o que se pode fazer a ela a qualquer momento fica no grupo `Pull request` do `⋯` do cabeçalho, que passa a `Pull request #N` quando ela existe no GitHub; e **Pause** ou **Resume** da sessão da etapa fica no cabeçalho, como nas outras etapas. Uma task abre exatamente uma pull request.

### Rascunho e abertura

A sessão de PR abre na worktree com o prompt de PR. O agente lê os commits e o diff da branch contra a base, o PRD e o tech spec, ou o documento One-Shot numa task One-Shot, e escreve um rascunho de título e descrição num arquivo de artefato. O rascunho aparece no fim da conversa da PR, no cartão `Pull request draft`, com a base à direita (`into dev`), **Title** e **Description**, a descrição em mono, redimensionável até 18 linhas; o cartão é uma entrada da conversa, e as teclas num campo ficam com o campo. A task passa a **rascunho pronto**, esperando o OK. O usuário pode alterar o título e o corpo antes de aprovar, ou descartar o rascunho para o agente escrever outro; a edição sobrevive a tudo menos a uma versão nova do agente, que a substitui. Enquanto o agente escreve e enquanto a pull request abre, o cartão não aparece. A barra do pedido diz `Draft to approve`, com **Approve draft**, que abre a pull request com o título e o corpo como estão no editor, e **Discard draft**; **Approve draft** fica desabilitado com a razão enquanto o agente trabalha ou falta o título ou a descrição. **Discard draft** também fica no `⋯`.

Numa task criada de um card, o prompt de PR recebe o card, com título, referência, link e corpo, e pede ao agente que escreva a descrição para quem lê o card e que comece o corpo do rascunho com `Closes <dono/nome>#<número>`. Ao abrir a pull request, se a descrição aprovada não fecha o card, o produto acrescenta `Closes <dono/nome>#<número>` ao fim dela. Conta como fechamento uma palavra de fechamento do GitHub (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves` ou `resolved`, sem diferenciar maiúsculas) seguida de `#<número>` ou `<dono/nome>#<número>`. Assim toda pull request de uma task criada de um card fica vinculada ao card, e o board a mostra nele. Uma task sem card abre a pull request sem nada disso.

Com o OK, o agente sobe a branch e abre a pull request com `gh pr create` contra a branch base, usando o rascunho como ele está naquele momento. A base é a mesma da worktree: `dev`, ou `main` quando não há `dev`. Enquanto ela abre, a conversa da PR termina com `Opening the pull request…`. Antes de a sessão começar, a etapa diz `Preparing the pull request…`. Quando o `gh` não está instalado, não está autenticado ou falha, a etapa fica **bloqueada**: a coluna diz `The pull request stage stopped`, com o bloco de erro que diz o que fazer e o que o `gh` ou o git escreveu, e **Try again**, na barra do pedido, repete a partir de onde parou. Quando a abertura falha depois de o agente responder, o rascunho continua no fim da conversa, e a barra do pedido, `Waiting for reply · PR`, tem **Approve draft**, para tentar de novo sem escrever ao agente.

O produto lê a pull request com o `gh`: o número dá nome ao grupo `Pull request #N` do `⋯`, com **Open PR**, que abre a pull request no GitHub, **Refresh PR**, que força uma leitura e diz no tooltip há quanto tempo foi a última (desabilitado durante o encerramento), **Review again** e **Open in VS Code**. Pull requests aguardando merge, ou cuja passada de review espera os checks, são consultadas automaticamente a cada minuto, com os checks do head e se a branch merge limpa na base.

### Review de pull request

Aberta a pull request, o produto lê no GitHub os checks do head e se a branch merge limpa na base, e a sessão de review começa sozinha com o prompt de review de PR, que recebe o que ele leu. O agente revisa o diff contra o PRD e o tech spec, procurando erros, desvios da especificação e problemas de qualidade. Numa task One-Shot, o critério é o documento One-Shot: o problema e o escopo fazem o papel do PRD, e as decisões técnicas e o plano de mudanças, o do tech spec. Ao fim, o agente escreve um relatório numerado num arquivo de artefato, com o status `clean` ou `changes`.

Se o relatório está limpo, a task fica **pronta**, aguardando o merge. Se há apontamentos, o produto os mostra e a task passa a **aguardando decisão**: o usuário decide na conversa, item a item, o que quer aplicado. A barra do pedido diz `Decide findings · PR review`, sem ação, e a resposta vai pelo compositor. O agente aplica só o que foi aprovado. As mudanças então passam pelo mesmo review do produto que um step no modo `Manual`: stage arquivo a arquivo no editor, com o cartão de arquivos no fim da conversa do review, progresso em tempo real, **Approve** em 100%, e o commit feito pelo agente com o prompt de commit, que nesta etapa também sobe o commit para a pull request. Depois do commit o agente revisa de novo, e o ciclo se repete até um relatório limpo. **Review again**, no `⋯`, pede uma passada extra a qualquer momento, e os relatórios de todas as passadas ficam visíveis.

As instruções fixas de review do repositório, quando existem, entram no prompt de cada passada, lidas quando ela começa.

Toda passada começa por essa leitura do GitHub: a primeira, a que segue cada commit e a de **Review again**. Enquanto algum check está pendente, ou o GitHub ainda não calculou se há conflito, a passada não começa: a task fica em `Waiting for checks`, que a pílula do stepper mostra com a contagem dos checks (`checks 3/5`) e a barra lateral como `PR review · checks a/b`. Antes da primeira passada, a etapa diz `The review starts when the checks finish.` e `MySpec reads #1284 every minute. The first pass begins once e2e / chromium and preview-deploy are done.`, com os checks que faltam pelo nome, e abaixo os checks ao vivo: `Waiting for checks · 4 of 6 passed` (`checking GitHub` antes da primeira leitura, `No checks` sem checks), há quanto tempo foram lidos (`checked just now`, com a hora no tooltip) e uma linha por check com o estado e a duração. Da segunda passada em diante, a conversa do review fica à vista e os checks ao vivo ficam no fim dela, com o compositor. O produto relê a pull request a cada minuto, ou quando o usuário força uma leitura. Logo depois de um push do produto, uma leitura sem nenhum check é relida uma vez antes de valer como "sem checks", porque o GitHub leva alguns segundos para registrar os checks de um head novo. A espera sobrevive ao fechamento do app e continua com uma leitura ao reabrir.

Um check que falhou e um conflito com a base são apontamentos do relatório, como qualquer outro: o agente investiga a causa da falha com o `gh`, e o resumo diz o que o produto leu. Um conflito aprovado é resolvido fazendo merge da base na branch, nunca rebase; os arquivos resolvidos passam pelo review do produto como qualquer mudança, e o commit da rodada é o merge commit.

A task pronta sai desse estado quando a leitura de cada minuto mostra um check com falha que não estava falhando na leitura que liberou a última passada, ou um conflito com a base que não existia nela. Um check pendente e um conflito que o GitHub ainda não calculou não mudam nada. A barra do pedido mostra a razão com os nomes, `Failed: <checks>`, `Conflict with <base>` ou os dois, unidos por ` · `, com **Review again**, cujo tooltip diz `Review again reads GitHub and turns this into findings of a new pass.`, e, quando o merge não pôde ser confirmado, `Couldn't confirm the merge`, com a razão da leitura no tooltip, e **Close task**; a barra lateral mostra `Checks failed`, `Conflict with base` ou `Checks failed · conflict`, e o stepper volta a **PR review**, com o glifo da situação na pílula. **Review again** e **Refresh PR** também ficam no `⋯`. A situação notifica ao começar; um problema a mais só atualiza a razão, e quando os problemas somem a situação some sem notificar, com a task de volta a pronta. **Review again** lê o GitHub de novo, transforma o que encontra em apontamentos, e a leitura que libera essa passada passa a ser a nova referência. Uma leitura que falha não abre nem fecha a situação e oferece o encerramento com o aviso, como na task pronta. A situação sobrevive ao fechamento do app e é confirmada na primeira leitura depois de reabrir.

Uma leitura que falha deixa a etapa **bloqueada** com o que o `gh` disse, e **Try again**, na barra do pedido, repete a partir de onde parou. Uma pull request mergeada ou fechada durante a espera encerra o review: a task passa a aguardar o encerramento, ou é sinalizada como fechada sem merge.

Enquanto o agente aplica mudanças aprovadas, a barra do pedido diz `Review changes`, ou `Approve changes` com tudo em stage, com **Open in VS Code** e **Approve**, como num step. Uma pull request aguardando merge mostra `Ready to merge` na barra, com **Open PR**.

Com o review para trás, pronta, com problema, mergeada ou fechada, a etapa mostra a conversa do review, somente leitura e sem compositor, terminada pela linha do merge, `Merged #1284 into dev · by lnakamura`, ou do fechamento, `Closed #1284 without a merge`; no painel **Details**, ela é a conversa `now`. Uma pull request mergeada ou fechada antes da primeira passada não tem essa conversa: a etapa diz `The pull request was merged before the first review pass.` ou `The pull request was closed without a merge before the first review pass.`, com a mesma linha.

Uma pull request fechada sem merge é sinalizada como tal, e a task não pode ser encerrada: a barra diz `PR closed unmerged`, com **Delete task…**.

## Encerramento e arquivamento

O encerramento é da task e é a única transição que o usuário aciona, porque depende de a pull request ter sido mergeada fora do produto. **Close task** habilita quando o `gh` reporta a pull request como mergeada, ou quando a última leitura falhou e o produto não consegue confirmar o merge. A ação fica na barra do pedido, que diz `Ready to close · #N merged` com o merge confirmado e `Ready to close · #N` sem ele, com o que o encerramento faz, precedido de `Couldn't confirm the merge` quando a leitura falhou, com a razão no tooltip; **Close task** mostra `Closing…` enquanto corre. Com o clone inexistente a ação fica desabilitada, com o aviso. Na barra lateral, a linha da task diz `Ready to close · PR #N merged` só com o merge confirmado, e `Ready to close · PR #N` sem ele.

Ao encerrar, o produto:

1. remove a worktree da task;
2. apaga a branch da task. Quando o GitHub confirmou o merge, apaga sem perguntar ao git, porque um squash merge nunca aparece como ancestral; quando o merge não pôde ser confirmado, só apaga se o git considerar a branch mergeada;
3. atualiza a branch base local, se ela estiver em checkout no clone, limpa, com upstream e atrás da remota sem divergir.

Enquanto encerra, a etapa diz `Closing the task…`. Cada parte registra o que fez, o que pulou e por quê, e o que falhou. Terminado o encerramento, a task é arquivada: sai da lista de tasks e passa a existir só no histórico, e o resultado do encerramento fica guardado com ela.

### A página do item que saiu

Quando o item aberto sai do app, arquivado, apagado, com a pull request mergeada ou fechada, ou o board removido, o lugar dele dá vez à página do item que saiu: o cabeçalho com `←` e o nome do item, um ícone, o título e as ações.

| Caso | Título | Ações |
|---|---|---|
| Task encerrada | `<nome> was closed and archived` | **Next that needs you**, **Open in History**, **Back to <board>** |
| Task apagada | `<nome> was deleted` | **Next that needs you**, **Back to <board>** |
| Review mergeado | `<repo>#<N> was merged, and its review ended` | **Next that needs you**, **Open in History**, **Back to Reviews** |
| Review fechado | `<repo>#<N> was closed without a merge` | as mesmas |
| Review apagado | `<repo>#<N> was deleted` | **Next that needs you**, **Back to Reviews** |
| Discussão arquivada | `<título> was archived` | **Next that needs you**, **Open in History**, **Open <board>** |
| Discussão apagada | `<título> was deleted` | **Next that needs you**, **Open <board>** |
| Board removido | `This board was removed.` | **Back to <lugar anterior>** |

Sem board, ou com ele removido, a volta da task e da discussão é **Back to Home**; o board removido sem lugar anterior também. **Next that needs you** abre o próximo item que espera pelo usuário, o mesmo do `Ctrl+J`, com `Next: <nome>` no tooltip; sem nenhum, fica desabilitado com `Nothing else needs you now.` A primeira ação habilitada é a principal e recebe o foco. **Open in History** abre o item arquivado. A página não entra no histórico de lugares: sair dela a descarta, e voltar não a reencontra. Quando o item sai sem o usuário ter pedido, a região ao vivo anuncia o título da página; quando foi ele quem apagou, arquivou ou encerrou, não.

Uma task arquivada que não estava aberta aparece num toast no canto inferior esquerdo da área principal: `“<nome>” was archived`, com **Open in History** e o `×`. Ele sai sozinho depois de 10 segundos, contados só enquanto não tem o ponteiro nem o foco, ou depois de **Open in History** ou do `×`, descendo e esmaecendo; cabem três de uma vez, e o quarto tira o mais antigo, que sai do mesmo jeito.

## Centro de review

O centro de review mostra num lugar só as pull requests abertas de todos os repositórios cadastrados, de qualquer autor, tenham nascido de uma task do produto ou não, e conduz o review de qualquer uma delas dentro do produto. O agente revisa a pull request com o card, a descrição e as instruções do usuário e escreve um relatório numerado; o usuário decide apontamento a apontamento; o produto publica o review no GitHub, com cada apontamento aprovado como comentário na linha do diff. Numa pull request do próprio usuário, o review pode, em vez de publicar, aplicar as correções.

O review de uma pull request é um item do produto como uma task, sem etapas: tem conversa, relatórios, situações que esperam pelo usuário, lugar na barra lateral e no histórico.

### Visão Reviews

O nó **Reviews** da barra lateral e **Review a pull request**, no menu **New**, abrem a visão, que ocupa a área principal. Ela lista as pull requests abertas de todos os repositórios cadastrados, com ou sem board, com ou sem clone, as pendentes primeiro e, em cada grupo, as atualizadas mais recentemente primeiro.

- **Cabeçalho:** o [cabeçalho do lugar](#cabeçalho-do-lugar), com o título `Reviews`, e à direita `checked <há quanto tempo>`, o indicador `Reading pull requests` durante uma leitura e o botão **Refresh**.
- **Falhas:** um aviso por repositório que o produto não conseguiu ler, com a razão e o que fazer (ver [Leitura das pull requests](#leitura-das-pull-requests)). As pull requests dos outros repositórios continuam aparecendo.
- **Barra de filtros:** ver [Filtros](#filtros).
- **Linha da pull request:** o título e o número, o repositório, o autor, as labels, `Draft` num draft, `Task` numa pull request de uma task do produto, o estado do review no produto quando existe um, `Reviewed` quando o usuário já a revisou e `New commits` quando há commits depois do último review dele, e o card vinculado, `#<número> · <status no board>`, que abre o card no GitHub. Uma pendente é destacada, com um ponto rotulado `Pending`. O ícone **Open on GitHub** abre a pull request.
- **Ação da linha:** **Review** inicia o review; **Open review** abre o review ativo da pull request; **Open task** abre a task dona da pull request, cujo review acontece na task. Numa pull request cuja branch vem de um fork, a ação fica desabilitada, com `Pull requests from forks can't be reviewed yet.`, e num repositório de clone inexistente, com o aviso do clone.
- **Estados:** um esqueleto da lista durante a primeira leitura; `Register a repository to see its pull requests.` sem repositórios; `No open pull requests.` sem pull requests abertas; `No pull requests match the filters.`, com **Clear filters**, quando os filtros escondem todas.

#### Pendente de review

Toda pull request aberta espera o review do usuário, pedido no GitHub ou não; o pedido de review do GitHub não é usado. Uma pull request está **pendente** quando o usuário ainda não a revisou ou quando há commits novos desde o último review dele. "Revisada" vem do GitHub: conta qualquer review enviado pela conta do `gh`, publicado pelo produto ou direto no site, e "commits novos" são os que vieram depois do último deles. As pull requests do próprio usuário e as das tasks do produto aparecem na lista, mas nunca são pendentes; o que a pull request de uma task espera do usuário aparece na task.

O nó **Reviews** mostra a contagem das pendentes que passam pelos filtros. Uma pull request pendente sem review iniciado não notifica e não espera pelo usuário.

### Filtros

A barra de filtros tem **Board**, com os boards e `No board`, **Repository**, **Author** e **Label**, o interruptor **Pending only** e **Clear filters**. Board e repositório escolhem um valor. Autor e label servem sobretudo para tirar da vista, como as pull requests do dependabot: cada valor do menu passa, a cada clique, de sem filtro a excluído, de excluído a incluído e de volta a sem filtro, e o menu mostra o resumo, como `Any`, `−dependabot` ou `+alice −bot`. Uma pull request passa pelo autor quando nenhum autor está incluído ou o dela está, e o dela não está excluído; passa pela label quando nenhuma label está incluída ou ela tem uma das incluídas, e não tem nenhuma excluída. As comparações não diferenciam maiúsculas.

Os filtros são lembrados entre execuções do app e valem para a lista e para a contagem do nó **Reviews**. Eles não escondem os reviews já iniciados, que aparecem sob **Reviews** na barra lateral mesmo com a pull request filtrada.

### Leitura das pull requests

As pull requests abertas são lidas ao abrir o app, ao abrir a visão, por **Refresh**, depois de publicar um review e a cada cinco minutos enquanto o app está aberto. A leitura fica só em memória e a visão mostra a última enquanto a próxima acontece. As pull requests com review ativo são lidas a cada minuto, junto das pull requests das tasks, com os checks do head e se a branch merge limpa na base, para que um commit novo, um check que falha, um conflito com a base, o merge e o fechamento sejam percebidos sem o usuário abrir a visão.

Toda leitura passa pelo `gh` autenticado na máquina. A falha de um repositório aparece na visão, com uma destas mensagens, e não esconde os outros nem afeta as tasks:

- `GitHub CLI was not found: gh isn't on the PATH.`
- `gh is not authenticated. Run gh auth login.`
- `gh can't read this repository. Run gh auth refresh -s repo.`
- `The repository doesn't exist or this account can't read its pull requests.`
- `GitHub's rate limit was reached. It resets at <hora>.`
- `Couldn't read from GitHub: <o que o gh disse>`

O card de uma pull request é o card cujas pull requests vinculadas, na leitura guardada dos boards, incluem ela. Uma pull request sem card é uma situação normal.

### Iniciar um review

**Review** abre o diálogo de início, com o resumo da pull request e:

- **Instructions**, opcional: o que o usuário quer que o agente olhe nesta passada;
- o **modelo** e o **esforço**, partindo do padrão de review de PR das configurações. A escolha vale para o review inteiro e pode ser trocada na conversa, como em qualquer sessão;
- o **modo**, **Publish** ou **Apply**, só numa pull request do próprio usuário, partindo de **Publish**: `Publish posts the approved findings as a review on GitHub.` ou `Apply has the agent fix the approved findings and push them to the pull request.` Para outro autor o modo é sempre publicar. O modo não muda depois.

Num repositório sem clone, o diálogo diz que ele não está clonado e oferece **Clone and continue**; terminado o clone, o diálogo abre de novo sozinho, ou, se o usuário estiver iniciando o review de outra pull request, assim que esse diálogo fechar. **Start review** confirma. O produto relê a pull request e recusa, com a razão, uma que não está mais aberta, que vem de um fork, que é de uma task ativa do produto ou que já tem um review ativo: uma pull request tem no máximo um review ativo.

Ao confirmar, o produto cria a worktree do review em `~/.local/share/myspec/worktrees/<dono>/<nome>/pr_<número>/`, em detached HEAD no head da pull request, sem branch local, escreve o documento de contexto e abre a conversa de review com o prompt de review de PR. Se a worktree não pode ser criada, o produto diz a razão do git e o review não é criado; qualquer outra falha do início, antes de a conversa abrir, também desfaz o review, com a worktree e a pasta de artefatos. O documento de contexto, `Context` no painel de relatórios, tem o título, a referência, o link, o autor, as branches e a descrição da pull request e, quando ela tem card, o card com o épico. Ele é escrito no início do review e reescrito antes de cada passada seguinte, com a pull request relida do GitHub e o card relido do board.

A mesma leitura da pull request diz os checks do head e se a branch merge limpa na base, e toda passada começa por ela. Enquanto algum check está pendente, ou o GitHub ainda não calculou se há conflito, a passada não começa: o review fica em `Waiting for checks`, com a conversa já criada com o modelo escolhido, e o produto relê a pull request a cada minuto, junto da leitura dos reviews ativos. Assentados os checks, a passada começa com o que o produto leu. A espera sobrevive ao fechamento do app e continua na primeira leitura depois de reabrir.

O agente revisa o diff contra a base e lê o código na worktree, com o documento de contexto no lugar do PRD e do tech spec, as instruções fixas do repositório e as instruções da passada. Sem card, ele revisa com a descrição, as instruções e as convenções que o repositório documenta; uma pull request sem card nunca é recusada. Ele roda as verificações que o repositório documenta, como no review da pull request de uma task. No modo publicar, nunca edita arquivos, nunca commita e nunca faz push. As instruções da primeira passada aparecem na conversa como a primeira mensagem do usuário, e as de uma passada seguinte, dentro da mensagem do produto que a pede.

### O relatório e a decisão

Cada passada escreve um relatório numerado, com o status `clean` ou `changes`, um resumo e, com `changes`, os apontamentos. Cada apontamento é **ancorado**, num arquivo e numa linha da versão nova que fazem parte do diff, ou **geral**, sem linha no diff: um teste que faltou, uma migration que não foi escrita, um problema num arquivo que a pull request não toca ou numa linha que ela removeu. O produto lê o relatório quando o turno do agente termina. Um relatório que ele não consegue ler é uma passada sem relatório: o review espera pelo usuário, com a razão, e o agente pode reescrevê-lo na conversa.

Um check que falhou e um conflito com a base são apontamentos como os outros, e o relatório é `changes` sempre que há um deles. O agente investiga a causa de cada check que falhou com o `gh` e escreve um apontamento com o check, o link e a causa, ancorado na linha que a causou quando ela está no diff, ou geral quando não está ou quando a causa não pôde ser determinada. O conflito é um apontamento geral, com os arquivos em conflito quando o agente consegue determiná-los sem tocar a worktree. O resumo diz o que o produto leu: que os checks passaram, que a pull request não tem checks ou quais falharam, e se a branch merge limpa.

O painel de apontamentos, acima da conversa, mostra a passada mais recente, com o título do relatório e `N of M decided`, e é recolhível; ele abre sozinho a cada passada ainda não publicada. Dentro dele ficam o resumo editável e um cartão por apontamento, com o número, a localização, o texto editável e **Approve** e **Discard**; clicar na decisão ativa a desfaz. A localização de um apontamento ancorado abre o arquivo no editor, naquela linha, na worktree do review; a de um geral diz `General`. Um relatório limpo mostra só o resumo e `Nothing to change.` Decisões e edições são guardadas enquanto o usuário as faz e sobrevivem ao fechamento do app.

A conversa fica aberta durante a decisão. Um apontamento que o usuário quer incluir, mudar ou retirar é pedido ao agente na conversa; o agente reescreve o relatório da passada e o produto mostra a versão nova, mantendo o texto e a decisão de cada apontamento que não mudou e o resumo editado, quando o original não mudou.

O painel **Reports**, à direita, aberto pelo botão do cabeçalho, lista `Context` e os relatórios de todas as passadas, como `Review 1 · changes · published` e `Review 2 · clean`, renderizados como Markdown. Um relatório publicado mostra acima dele o veredito, a data e o link do review no GitHub.

### Publicar

**Publish review** habilita com todos os apontamentos decididos, ou com um relatório limpo, e abre o diálogo de publicação: o **Verdict**, entre **Approve**, **Request changes** e **Comment**, e o que vai no review, como `3 inline comments · 1 in the body`. Numa pull request do próprio usuário o único veredito é **Comment**, porque o GitHub não aceita outro. Quando chegaram commits depois da passada, o diálogo avisa que os apontamentos em linhas que saíram do diff vão para o corpo e oferece **Review again instead**.

O produto publica um review no GitHub, pela conta do `gh`, no head atual da pull request:

- cada apontamento ancorado aprovado cuja linha está no diff vira um comentário naquela linha, com o texto como o usuário o deixou;
- o corpo traz o resumo e, sob **Other findings**, a lista dos apontamentos gerais aprovados, seguidos dos ancorados cuja linha deixou de fazer parte do diff, cada um com `arquivo:linha`;
- o veredito escolhido.

Um relatório sem apontamento aprovado publica só o resumo e o veredito. Sem resumo e sem apontamento, só o veredito de aprovar é publicado; os outros pedem um resumo. O produto nunca publica sem o comando do usuário e nunca publica um apontamento que ele não aprovou. Os apontamentos de check e de conflito são publicados como os outros.

Uma publicação que falha não perde nada: decisões e edições ficam, o review espera pelo usuário com a razão, e **Publish review** tenta de novo. A razão diz o que fazer quando o `gh` falhou, como as falhas da lista de pull requests, e diz quando a pull request fechou ou não está mais no GitHub; uma falha do `gh` sem razão conhecida aparece como `Couldn't publish to GitHub: <o que o gh disse>`. Publicado, a passada fica somente leitura, com onde cada apontamento foi, `Inline comment`, `In the review body` ou `Not published`, a pull request aparece como revisada na lista e o review fica parado, sem esperar por ninguém, até um commit novo, um check que falha, um conflito com a base, **Review again** ou o fim da pull request.

### Commits novos e novas passadas

Um commit novo na pull request depois do último review publicado é uma situação que espera pelo usuário: aparece no review, na lista, na linha dele na barra lateral, e notifica. Commits que chegam antes de a passada em curso ser publicada não notificam: o review avisa `New commits since this pass`, e o diálogo de publicação também. Quando o git não disse em que commit a passada foi feita, o aviso não aparece, porque nada diz que a pull request andou.

Um review `Published`, ou `Ready to merge` no modo aplicar, que ganha um check com falha ou um conflito com a base que a leitura que liberou a última passada não tinha, sai desse estado e espera pelo usuário, com a razão na barra do review, com os checks pelo nome, na linha sob **Reviews** e na lista de pull requests. Um check pendente e um conflito ainda não calculado não mudam nada. A situação notifica uma vez, ao começar, e um problema a mais só atualiza a razão. No modo publicar, `New commits` prevalece. Quando os problemas somem, o review volta ao estado de antes, sem notificar. **Review again** sai da situação: a nova passada lê o GitHub, transforma o que encontra em apontamentos e passa a ser a nova referência. A situação sobrevive ao fechamento do app e é confirmada na primeira leitura depois de reabrir.

**Review again** pede uma nova passada na mesma conversa, a qualquer momento em que nenhuma passada está em curso ou esperando os checks, com instruções opcionais. Quando a passada mais recente não foi publicada e tem decisões ou edições, o diálogo avisa que elas serão descartadas. O produto relê a pull request, atualiza a worktree para o head atual, reescreve o documento de contexto e, com os checks assentados, envia ao agente o arquivo do novo relatório, o commit que a passada anterior cobriu, para ele ler o que mudou desde então, os apontamentos já publicados, para ele dizer quais foram resolvidos, o que o produto leu dos checks e do conflito, e as instruções. Com algum check pendente, a passada espera por eles como a primeira. Só o que é novo ou continua valendo vira apontamento. Uma releitura que falha recusa a passada com a razão, como as falhas da lista de pull requests, porque nenhuma passada começa sem saber o estado dos checks; quando ela diz que a pull request foi mergeada ou fechada, a passada é recusada antes de a worktree mudar.

Uma passada que espera os checks e não pode começar, porque a leitura de cada minuto falhou ou porque a worktree não pôde ser atualizada, deixa o review em `Pass blocked`, com a razão na barra do review, e a espera para até o usuário agir: **Review again** lê a pull request de novo e pede a mesma passada. Uma pull request mergeada ou fechada durante a espera encerra o review como em qualquer outro momento. No modo publicar a worktree nunca tem mudanças do produto, e qualquer mudança nela é descartada antes da atualização. No modo aplicar, **Review again** também serve enquanto as correções do agente esperam o review do usuário, para quando o agente não mudou nada ou o usuário desistiu das mudanças: uma worktree que ainda tem mudanças recusa a atualização com a razão do git, e nada se perde. Durante o commit, não.

### Corrigir a própria pull request

Numa pull request do próprio usuário que não é de uma task do produto, o modo **Apply** leva o review pelo ciclo do review da pull request de uma task:

1. o agente revisa e escreve o relatório, e o usuário decide apontamento a apontamento, como no modo publicar;
2. **Apply** envia ao agente os apontamentos aprovados, com o texto como o usuário o deixou, e ele corrige na worktree só isso, sem commitar;
3. as mudanças passam pelo review do produto: stage arquivo a arquivo no editor, progresso em tempo real, **Approve** em 100%;
4. o agente commita com o prompt de commit e sobe o commit para a branch da pull request;
5. o produto pede uma nova passada sozinho, que espera os checks do commit que subiu, e o ciclo se repete.

Logo depois do push, uma leitura sem nenhum check é relida uma vez antes de valer como "sem checks", porque o GitHub leva alguns segundos para registrar os checks de um head novo. Um conflito com a base aprovado é resolvido pelo agente fazendo merge da base na branch, nunca rebase: os arquivos resolvidos passam pelo review do produto como qualquer mudança, e o commit do passo 4 é o merge commit.

Um relatório limpo, ou uma passada em que nada foi aprovado, deixa o review pronto para merge, que o usuário faz no GitHub. Um turno de commit que termina sem commit volta a mudança ao review, com `The last approval didn't produce a commit.` O commit é o head da worktree diferente daquele em que a passada foi feita ou, quando o git não o disse, daquele lido no **Approve**. Nada é publicado como review no GitHub nesse modo, e o produto nunca dá stage.

### O review como item

- **Barra lateral:** cada review ativo é uma linha sob o nó **Reviews** da árvore, em ordem de criação, com o título, `<nome curto>#<número>` no meta e o estado mais grave na segunda linha, como as linhas das tasks. Os reviews não passam pelo filtro de repositório da barra lateral.
- **Tela do review:** o [cabeçalho do lugar](#cabeçalho-do-lugar), com `Reviews` no breadcrumb e o título da pull request, e à direita o modo, o estado, o medidor de contexto, **Pause** ou **Resume**, o link do card vinculado (`Open card #<número> on GitHub · <status no board>`), o botão do painel de relatórios e **Delete review**; a barra do review com o link da pull request, o estado, os avisos e as ações **Publish review**, ou **Apply** e **Approve** no modo aplicar, **Review again** e **Open in VS Code**, que abre a worktree; o painel de apontamentos e a conversa; o painel de relatórios.
- **Estados:** `Reviewing`, `Waiting for checks`, `Pass blocked`, `Waiting for the report`, `Decide findings`, `Ready to publish`, `Publish failed`, `Published`, `New commits` e o que deu errado com a pull request depois da passada (`Checks failed: <checks>`, `Conflict with <base>` ou os dois); no modo aplicar, `Ready to apply`, `Applying`, `In review`, `Ready to approve`, `Committing`, `Ready to merge` e o mesmo estado de checks e conflito. O estado da conversa, pausada, com erro, pedindo permissão ou perguntando, prevalece sobre eles, como na task, e o agente trabalhando numa conversa durante a espera pelos checks mostra `Reviewing`. Em `Pass blocked`, a barra do review mostra a razão, e num check que falhou depois da passada, os checks pelo nome.
- **Fim:** o review termina quando a pull request é mergeada ou fechada. A leitura de cada minuto percebe, e o produto encerra a sessão, remove a worktree e leva o review ao histórico, sem ação do usuário e sem notificar. Com o review aberto, o lugar dele dá vez à [página do item que saiu](#a-página-do-item-que-saiu). Uma leitura que falha deixa o aviso `Couldn't check GitHub` na barra do review.
- **Apagar:** **Delete review** apaga o review a qualquer momento, ativo ou arquivado, depois da confirmação `The worktree, the conversation and the reports go away. What was published on GitHub stays.` A pull request volta a ser uma pull request comum na lista e pode ter um review novo. Uma worktree que o git não conseguiu remover é listada num aviso, como ao apagar uma task.

## Histórico

O botão **History** no rodapé da barra lateral abre a lista das tasks arquivadas, da mais recente à mais antiga, com busca por nome e o mesmo filtro por repositório da barra lateral. A contagem do botão soma tasks, reviews e discussões. Cada linha mostra o nome curto do repositório da task. A lista inclui os reviews de pull request e as discussões arquivadas, misturados às tasks pela data de arquivamento; ver [Histórico de um review](#histórico-de-um-review) e [Histórico de uma discussão](#histórico-de-uma-discussão). Uma task arquivada mostra os seus artefatos finais renderizados, com PRD, tech spec, steps com os relatórios de review de cada step, a pull request e o resultado do encerramento. Uma task One-Shot aparece na lista com o rótulo `One-Shot` no lugar da contagem de steps, e mostra o documento One-Shot com os relatórios de review do step no lugar de PRD, tech spec e steps. O cabeçalho de uma task arquivada tem a etiqueta `Archived`, o link do card de origem e o apagar, e `History`, no breadcrumb, volta à lista. As conversas de uma task e de um review de pull request não são guardadas no histórico; a de uma discussão é, porque é parte do entendimento.

### Histórico de um review

Um review arquivado aparece na lista com o rótulo `Review`, `#<número>` e o título da pull request, o repositório, o autor, o desfecho, `Merged` ou `Closed`, e as datas. A busca casa com o título e com o número, com ou sem `#`, e o filtro por repositório vale para ele. Aberto, ele tem no cabeçalho o desfecho, o link do card vinculado, o link da pull request e o apagar, e mostra o autor, as datas e, para cada passada, o relatório renderizado e, quando publicada, o veredito e cada apontamento publicado com onde foi. `History`, no breadcrumb, volta à lista.

### Histórico de uma discussão

Uma discussão arquivada aparece na lista com o rótulo `Discussion`, o título, o board, a contagem de cards publicados e as datas. A busca casa com o título, e o filtro por repositório mostra as discussões cujos cards de entrada ou publicados pertencem ao repositório. Aberta, ela mostra o documento renderizado, ou `No document was written.`, os rascunhos com o que cada um virou, `Created`, `Updated` ou `Not published`, com a referência e o link, os épicos com os cards dentro, e a conversa inteira, somente leitura. O cabeçalho tem a etiqueta `Archived` e o apagar; `History`, no breadcrumb, volta à lista.

## Apagar uma task

Uma task pode ser apagada em qualquer etapa. Antes de confirmar, o produto mostra o que será destruído: a worktree e a branch, quando existem, a pull request que fica aberta no GitHub, e o que já não está lá. Apagar para o que estiver rodando, remove a worktree e a branch, apaga os artefatos e remove a task em definitivo. O que o git não conseguiu remover é listado num aviso, para o usuário resolver à mão.

Um review de pull request se apaga pelo seu próprio **Delete review**; ver [O review como item](#o-review-como-item). Uma discussão, pelo **Delete discussion**; ver [A discussão como item](#a-discussão-como-item).

## Sessões e conversas

Toda sessão é uma conversa dentro do produto, com interface própria. O Claude Code roda por baixo, invisível. A conversa é uma coluna centrada, da largura de leitura, que rola entre o cabeçalho e a barra do pedido, esmaecida nas bordas; a barra e o compositor ficam na mesma coluna. Ela mostra, de cima para baixo, a linha de início, as falas do agente, as mensagens do usuário, as mensagens do produto, as ações que o agente executa agrupadas, os cartões de permissão e de pergunta, os marcos dos eventos da sessão e os erros; depois delas, as mensagens na fila e a atividade. Cada entrada mostra a hora com o hover e o foco, e o nome acessível dela sempre a tem (`Implementer, 14:19`, `You, 14:28`).

Uma fala leva a palavra de quem fala, `Implementer`, `Reviewer`, `PRD agent`, `Tech spec agent`, `Plan agent`, `Planning agent`, `PR agent` ou `Discussion agent`, onde a voz muda: no início e depois de uma mensagem do usuário, de uma mensagem do produto, de uma linha de início e de uma dobra de trecho. Enquanto o agente escreve, a palavra aparece com o spinner. Tudo que o agente escreve é renderizado como Markdown, com diagramas mermaid e realce de código, em streaming. Na conversa, um bloco de código de mais de 24 linhas mostra as 20 primeiras e, ao pé, **Show all 46 lines** e `26 more`, e aberto **Show less**; o **Copy** do cabeçalho copia o bloco inteiro, não só as linhas à vista, e diz por dois segundos `Copied`, com o visto, ou `Can't copy · select the text`; o corte vale também durante o streaming, para o bloco não encolher quando a fala termina. Fora da conversa, o código aparece inteiro. Uma fala que o usuário interrompeu termina com `Interrupted by you` (numa conversa antiga, `Interrupted`); uma cortada por uma queda termina onde parou, e o bloco de erro vem depois. O bloco de erro explica o que houve, como `Claude Code stopped unexpectedly.` ou `The agent couldn't finish the turn.`, com o detalhe em mono, sem botão: tentar de novo é da barra do pedido.

As ações seguidas de um turno formam um grupo, dobrado por padrão numa linha: `14 actions`, o resumo por tipo (`Read 8 · Searched 4 · git 2`, até cinco tipos, do mais frequente ao menos), `· 1 failed` quando um comando falhou e nenhum seguinte com o mesmo comando passou, `· 1 failed, then passed`, `· 1 stopped`, `· 1 waits for your permission`, `retried on its own · 2 attempts` quando a API foi tentada de novo no meio dele, e a duração, do início do primeiro comando ao fim do último. Enquanto uma ação roda, a linha diz o que roda no lugar do resumo, com o spinner, e a duração conta a cada segundo. Aberto, o grupo lista um comando por linha; acima de oito, os seis últimos e **Show N earlier actions**, que leva o foco à primeira linha que mostra. Um comando é rotulado pela descrição que o agente escreveu, com o comando apagado depois dela; sem descrição, o comando ocupa o lugar do rótulo. À direita, a duração (`8.2s`, `12s`, `1m 52s`), `exit 1 · 8.2s` numa falha, o tempo correndo, `stopped` ou `waits for your permission`, e o comando que espera a permissão aponta `the command in the card below`. O que um comando imprimiu, a falha de qualquer ferramenta e o relatório de um subagente ficam numa dobra sob a linha, aberta por padrão numa falha, com o trilho de erro: até 16 linhas, a saída inteira; acima disso, as 12 últimas, `24 more lines above` e **Show all 36 lines**, que lê a saída inteira (`Reading the output…`; na falha, `Couldn't read the output · Try again`) e aberta diz **Show less**. **Show all** e **Show less** são o mesmo botão, que fica com o foco; enquanto a saída é lida, o foco fica na linha acima dela e volta a **Show less**, ou a **Try again** numa falha. Um comando que falha com a conversa na tela abre a sua saída uma vez, a menos que o usuário já a tenha aberto ou dobrado. Uma saída de mais de 64 KiB guarda só o fim e diz `Only the last 64 KiB was kept`. Um subagente é uma ação do grupo, `Delegated · <o que ele recebeu>`, com o resumo das ações dele e a duração; aberto, mostra as ações dele recuadas, pela mesma regra dos seis, e no fim o relatório. A fala de um subagente não aparece.

Os eventos da sessão são marcos de uma linha, com o ícone, o acontecimento e o número que importa, sem a hora no texto: `Written PRD.md`, `Written the plan · 7 step files`, `Review 1 written · changes · 2 findings`, `Committed c19f02e · Add the limiter · pushed to #1284`, `Opened #1284 · into dev`, `Checks read before pass 1 · 4 of 5 passed · e2e failed`, `Context compacted · at 81%`, `Paused by you`, `You approved the draft`, `You approved the changes · 3 files staged`, `Interrupted by you`. `Retried on its own · the API was overloaded · 2 attempts` marca um retry automático que deu certo e é o único que não mostra a hora, nem com o hover. A conversa começa com a linha de início, um marco só com o que a sessão recebeu: `PRD started · with the card acme/api#412` (ou `with your description`), `Tech spec started · from PRD.md`, `Plan started · from PRD.md and tech-spec.md`, `Started with · steps/03-token-bucket.md`, `PR started · writes the draft from the branch`, `PR review started · pass 1 · #1284 into dev`; uma etapa recomeçada diz `PRD restarted`, `Restarted with …`. O que o produto diz ao agente é a mensagem do produto, `MySpec → Implementer` com o que ela é: `Review 1 · 2 findings · round 1 of 3`, `pass 2 · the implementer is done with your last report`, `Commit · the staged files`, `Commit · every change of the step`, `Commit and push · the staged files`, `Open the pull request · the approved draft`, `pass 2 · review the pull request again`, `apply 3 approved findings`; numa conversa antiga, `a message · 1,341 characters`. A primeira mensagem ao revisor de um step é `MySpec → Reviewer · pass 1 · the step, the PRD, the tech spec and the implementer's answer`.

Um marco com conteúdo abre no lugar, num bloco afundado, e é uma parada do percurso da conversa; o que não abre é só lido. A linha de início abre o contexto inicial ou o prompt que a sessão recebeu (uma sessão antiga, que não o guardou, não abre), a mensagem do produto abre o que foi enviado, o marco do plano inválido abre os problemas, e o de um documento, de um relatório, do arquivo do step ou do rascunho aprovado o lê ao abrir, com o brilho na linha enquanto lê e `Couldn't read PRD.md · Try again` numa falha; **Try again** deixa o foco na linha do marco enquanto o documento é lido de novo. Ao pé do documento, **Open in Artifacts** ou, num relatório, **Open in Details** abre o painel já no documento, com **← Artifacts** ou **← Details** de volta à lista. O código longo de um marco aberto é cortado como o de uma fala.

Uma conversa longa se divide em trechos, cada um começado por uma mensagem do produto que abre uma rodada: um relatório ao implementador, uma passada nova do revisor ou do review da pull request, os apontamentos aprovados, uma correção do plano. Um trecho que não é o último e tem ao menos 12 entradas, um grupo de ações contando como uma, dobra numa linha: `5 speeches · 71 actions` e onde ele começou, `from the start · steps/06-throttle-metrics.md` ou `from Review 1 · 3 findings · round 1 of 3`, com o intervalo de horas no hover e no foco, e o nome acessível `Earlier: 5 speeches and 71 actions, from the start, 16:12 to 16:48`, que diz onde o trecho começou sem o complemento da linha de início. Dobrado, o trecho não monta as entradas; aberto, mostra-as como eram, na mesma coluna. Os trechos dobram só quando a conversa abre: um que deixa de ser o último com a conversa na tela fica aberto, para nada fechar sob o usuário.

A atividade, no fim, aparece no silêncio de um turno: `Starting session…` antes do processo subir, `Thinking…`, e num retry automático da API `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8s`, com a contagem a cada segundo e `retrying now` no zero. O leitor de tela ouve a tentativa e a razão quando mudam, sem a contagem.

A conversa nunca rola para cima sozinha. Enquanto o usuário está no fim, ela acompanha o que chega e o texto que cresce; ela abre no fim, e recarregar a sessão mantém o que está na tela. Quando o usuário está mais acima, um botão flutuante com uma seta para baixo leva de volta ao fim: ele mostra `New messages` e quantas entradas nasceram desde que o usuário saiu do fim (uma que cresce conta uma vez) e, com a sessão trabalhando, `Implementer writing` ou `Implementer working`; sem nada novo e sem trabalho, é só a seta, `Go to the end`. Ele some quando o usuário chega ao fim.

Cada etapa e cada step têm a sua conversa, e a etapa de PR tem a da pull request e a do review dela. Um step no modo `Agent` tem também a do revisor, a partir da primeira passada, e as duas ficam nas abas **Implementer** e **Reviewer**. Voltar a uma etapa retoma a conversa dela de onde ficou.

As conversas que a task já teve ficam no painel **Details**, com a hora em que começaram: as do planejamento no grupo Planning, as do implementador e do revisor sob cada step commitado, e as da pull request no grupo Pull request. A conversa na tela aparece com `now` e não abre. Um clique numa outra a lê, com `Opening the conversation…` na linha, e ela toma o lugar da conversa da task quando chega, somente leitura e aberta no começo; uma leitura que falha diz `Couldn't open it · Try again` na linha, sem o aviso do app. No lugar do compositor fica a faixa `Step 2 · Implementer · an earlier conversation. It takes no more messages.`, com **Back to step 3**, que nomeia o lugar da task (`the implementation`, `the tech spec`, `the PR review`, `the pull request`...). Ela nunca aceita mensagem: não tem compositor, os cartões de pergunta e de permissão são os blocos chapados do que foi perguntado e decidido, sem os controles, um erro não tem **Retry** e nada fica na fila. A barra do pedido, as abas, o review do step e o medidor saem enquanto ela está aberta; o stepper, a barra lateral, o `⋯` e os painéis ficam. Ao abrir, o foco vai à conversa anterior; ao sair, volta à linha que a abriu quando o painel está aberto ao lado dela, e à conversa da task quando não está. Saem dela **Back to …**, `Esc`, um novo clique na linha, a ida a outro lugar e a chegada a uma situação da mesma task, por `Ctrl+J` ou pela notificação. Com o painel cobrindo a conversa, abaixo de 1120 px de área principal, abrir uma conversa anterior fecha o painel, para a volta ficar à vista; como coluna, ele fica aberto. A conversa anterior não entra no histórico de lugares, e uma sessão descartada some da lista e fecha a conversa que estava aberta. A conversa de uma etapa ou de um step encerrado é lida do banco, também depois de reiniciar o app. Um review de pull request tem uma conversa só, de todas as passadas, que reabre com o app e acaba quando o review acaba ou é apagado. Uma discussão também tem uma conversa só, que reabre com o app, fica guardada no histórico e acaba quando a discussão é arquivada ou apagada.

- **O compositor**: a caixa na coluna da conversa, com o nome `Reply to the implementer` (ou a voz da conversa), que cresce até cerca de dez linhas e depois rola. O placeholder diz a quem se responde e como, na primeira situação que vale: `Sending resumes the task…` com a task pausada, `Sending restarts the reviewer's session…` com a sessão parada num erro, `Reply to the implementer to go on…` depois de um turno que falhou, `Answer with 1–3, or reply to the reviewer…` com uma pergunta pendente, `Answer with 1–3 above, or queue a message for the implementer…` com uma permissão, `Queue a message for the implementer…` com o turno rodando, `Answer a or b, or reply to the PRD agent…` com as pastilhas, `Tell the PR agent which findings to apply…` com os apontamentos da pull request, `Ask the implementer for a change…` no step em review pelo usuário ou sem mudanças, e `Reply to the implementer…` no resto. No rodapé, à esquerda, o seletor do modelo da conversa (`Model of this conversation · from your next message`), que vale da próxima mensagem em diante; à direita, **Send** `↵`, tracejado enquanto a caixa está vazia, com `Write a message` no tooltip, e primário só com texto e nenhuma outra primária na tela (a da barra do pedido ou a de um cartão pendente). `Enter` envia e `Shift+Enter` quebra a linha. Enquanto o envio corre, **Send** diz `Sending…` e o texto fica; numa falha, o texto fica e o rodapé diz `Not sent · <razão>`, com **Send again**. Com a task pausada, o envio a retoma antes; se ela não retoma, a mensagem não sai e a razão aparece do mesmo jeito, no rodapé. Com o turno rodando, o rodapé diz `Working · 3m 40s`, com **Stop** (`Stop the answer · Esc`, `Stopping…`), e com texto um **Send** secundário antes dele (`Queues until the turn ends`). Quando a última fala do agente termina com opções rotuladas `a)`–`h)` ou numeradas `1.`–`8.`, de duas a seis, e a conversa espera a resposta, elas viram pastilhas no alto da caixa, um grupo `Quick replies` de chips com a letra em mono e o começo da opção; o clique envia a letra ou o número e deixa o rascunho como está. Sem sessão, não há compositor.
- **Enviar**: mensagens enviadas com o agente ocupado entram numa fila, visível na conversa com `Queued · sends when the turn ends` (com a sessão num erro, `sends after the retry`; pausada, `sends when the task resumes`), e podem ser removidas com **Remove** antes de sair.
- **Interromper** encerra a resposta em andamento e mantém a sessão viva: **Stop** no compositor, ou `Esc` nele com a caixa vazia; com texto, o `Esc` não interrompe.
- **Pausar** para o processo e preserva a conversa; **Retomar** continua de onde parou. **Pause**, no cabeçalho, age na hora, sem diálogo; no cabeçalho da task ele diz `Pausing…` até a chamada voltar, e **Resume** diz `Resuming…`. Na task, ele age na conversa em que a task espera: a da etapa de planejamento; na implementação, a do revisor durante uma passada e a do implementador no resto do tempo; na etapa de PR, a da pull request ou a do review dela. O tooltip diz o que ele faz, `Pause the task · the session that works stops`, e o de **Resume** diz desde quando, `Resume the task · paused since 14:52`, quando a hora da pausa é conhecida. Com a sessão parada num erro, nada roda para pausar: **Pause** fica desabilitado e diz por quê, `Nothing is running to pause: the reviewer's session stopped with an error. Retry it, or discard the step.` Pausada, a task não espera por ninguém: a pílula do stepper fica neutra com `paused`, o medidor mostra `—`, e a barra do pedido continua com o que o estado do step pede, sem a cor e sem o tempo de espera, e a ação dela retoma a sessão; continuar uma etapa revisitada espera o **Resume**. O compositor fica: enviar uma mensagem retoma a sessão e a manda; **Resume** fica só no cabeçalho. Uma sessão ociosa por dez minutos é parada sozinha e retomada de forma transparente na próxima mensagem.
- **Retry** reinicia uma sessão que falhou ao iniciar, cujo processo morreu, ou que não encontrou o `claude` ou um login. Na task, ele fica na barra do pedido e nomeia quem volta: `Retry implementer`, `Retry reviewer`, `Retry PRD agent`, `Retry tech spec agent`, `Retry plan agent`, `Retry planning agent`, `Retry PR agent`. Um turno que falhou com o processo vivo não tem **Retry**, porque não há o que reiniciar: a resposta vai pelo compositor.
- **Permissões**: as sessões rodam no modo auto do Claude Code. As escaladas que o modo auto não resolve sozinho aparecem como um cartão na conversa, com o anel de espera, o único bloco contornado com o de pergunta: a ferramenta como etiqueta, a descrição, o comando uma vez em mono (o caminho numa ferramenta de arquivo, a entrada inteira nas outras), a razão e `Outside the working directory: <caminho>` quando cabe. **Allow** `1` é a principal; **Allow for this session** `2` aparece só quando o CLI oferece uma regra; **Deny…**, com a última tecla, abre no cartão o texto opcional `Tell the agent what to do instead (optional)`, com **Deny**, perigoso, e **Cancel**, que fecha o texto e devolve o foco a **Deny…**. O foco começa em **Allow**, ou em **Deny…** quando o CLI sugere negar. Enquanto envia, o botão pressionado diz `Allowing…`, `Allowing for this session…` ou `Denying…` e os outros ficam desabilitados; uma falha diz `Not sent · <razão>` no pé do cartão. Respondido, o cartão vira um bloco chapado com `Allowed`, `Allowed for this session` ou `Denied · <mensagem>`, a hora da resposta no tooltip; cancelado pela pausa ou pela queda, diz `Cancelled before an answer`.
- **Perguntas**: as perguntas estruturadas do agente aparecem como um cartão, nomeado `Question, answer with 1 to 3`: para cada pergunta, o cabeçalho, a pergunta e as opções numeradas (rádios, ou caixas de seleção quando ela aceita várias), com `Other…` por último, que leva o foco ao compositor. **Answer** `↵`, a principal, fica tracejada com o que falta (`Choose an option`, `Answer 2 more questions`); enviando, o cartão diz `Sending “<resposta>”…`, e uma falha diz `Not sent · <razão>` e devolve **Answer**. As teclas `1`–`9` escolhem na pergunta com o foco, ou na primeira sem escolha; as setas andam nas opções com volta ao início; `Enter` envia com tudo escolhido. O texto escrito no compositor com uma pergunta pendente a responde: ele vira o `Other` da primeira pergunta ainda sem escolha (numa de escolha múltipla, mais uma escolha) e aparece no cartão como `Other: <texto>`. Se ainda falta alguma pergunta, o texto sai da caixa e o foco volta ao cartão, na primeira pergunta sem escolha; com tudo escolhido, o `Enter` do compositor envia o cartão, que mostra o envio como se ele mesmo enviasse, e o texto fica na caixa até a resposta sair. Uma falha diz `Not sent · <razão>` no rodapé do compositor, com **Send again**: o texto continua na caixa e sai do cartão. Enviada, a resposta continua no cartão até a conversa a desenhar, e nem o cartão nem o compositor a enviam de novo. Respondida, a pergunta vira um bloco chapado, uma linha por pergunta com a resposta, e o tooltip `Answered at 09:19`; cancelada, `Cancelled before an answer`. Uma pergunta em texto no fim da fala do agente, com a conversa esperando a resposta, ganha um fio de espera à esquerda do último bloco.
- **Piscada**: um cartão de pergunta ou de permissão que nasce com a tela aberta pisca duas vezes, como a barra do pedido, e nada pisca com o movimento reduzido do sistema. A parada de Tab da conversa começa no cartão pendente.
- **Contexto**: um medidor mostra quanto da janela de contexto a sessão já usou.

## Depende de mim

Uma task, um review de pull request ou uma discussão espera pelo usuário. Uma task espera quando qualquer destas situações acontece: um erro de sessão, um step bloqueado, uma worktree ilegível, a etapa de PR bloqueada, um plano inválido, uma pull request fechada sem merge, uma escalada de permissão, uma pergunta do agente, uma passada do revisor de um step que terminou sem relatório, uma resposta aquém do que o produto esperava, uma etapa revisitada pronta para continuar, um step aguardando review ou pronto para aprovar, um step sem mudanças, um step que passou ao usuário porque o review pelo agente não veio limpo em três rodadas, um rascunho aguardando OK, apontamentos de review aguardando decisão, mudanças aplicadas aguardando review, uma pull request pronta que ganhou um check com falha ou um conflito com a base depois do review, uma pull request pronta para merge, uma task pronta para encerrar. Uma task pausada, ou cuja passada de review espera os checks, não espera por ninguém. O revisor de um step é um lugar próprio: um erro, uma escalada de permissão ou uma pergunta dele espera pelo usuário na aba **Reviewer**, e pode esperar ao mesmo tempo que uma situação do implementador. Uma task com todos os steps no modo `Agent` só espera pelo usuário, entre o primeiro step e o rascunho da pull request, quando há erro, bloqueio, permissão, pergunta, passada sem relatório ou um step que passou ao usuário; um step commitado pelo review do agente não notifica.

Um review de pull request espera pelo usuário quando o agente pergunta ou pede permissão, quando a sessão falha, quando a passada termina sem um relatório que o produto consegue ler, quando o relatório tem apontamentos a decidir, quando está pronto para publicar, quando a publicação falha, quando a próxima passada não pôde começar, com `Pass blocked`, quando a pull request tem commits novos desde o último review publicado e quando a pull request publicada, ou pronta para merge no modo aplicar, ganha um check com falha ou um conflito com a base depois da última passada. No modo aplicar, também quando os apontamentos aprovados estão prontos para aplicar, quando as mudanças aguardam review ou estão prontas para aprovar e quando a pull request está pronta para merge. Um review pausado, publicado, arquivado ou esperando os checks não espera por ninguém.

Uma discussão espera pelo usuário quando o agente pergunta ou pede permissão, quando a sessão falha, quando um turno termina sem resposta ao usuário antes de os rascunhos existirem, quando o artefato de rascunhos não pode ser lido, quando há rascunhos a decidir e quando uma publicação falha. Uma discussão pausada ou arquivada não espera por ninguém.

Cada situação diz onde está e o que pede. As situações aparecem:

- na árvore da barra lateral, na linha de cada task e de cada discussão, e sob o nó **Reviews**, na linha de cada review, ou no bloco de cada item na faixa recolhida. A linha do item que `Ctrl+J` abre leva a tecla `Ctrl J` no lugar do meta, e o nome acessível dela, como o do bloco na faixa, termina em `Ctrl+J opens this next.`;
- por `Ctrl+J`, que abre o item cuja situação mais grave é a mais grave de todas e, entre iguais, o que espera há mais tempo, deixando de fora o item aberto. O filtro por repositório não muda o destino. Sem nenhum destino, `Ctrl+J` fica onde está e o leitor de tela ouve `Nothing else needs you now.`;
- na própria task, na barra do pedido, e nas abas **Implementer** e **Reviewer**, no próprio review, na barra dele, e na própria discussão, na barra dela.

A barra do pedido da task fala da conversa na tela: `Question` e `Permission`, quietas, com **Show**, que leva ao cartão; `Waiting for reply`, com **Approve draft** quando o rascunho da pull request está à mão; `Session error`, com **Retry …**; `Step 5 blocked`, `Can't read worktree` e `PR blocked`, com a razão curta; `Plan still invalid`, com a contagem e **Show problems**; `Decide findings · PR review`. O lugar é a conversa: `PRD`, `Tech spec`, `Plan`, `Planning`, `Implementer`, `Reviewer`, `PR`, `PR review`. Num step com as duas abas, quando a conversa na tela não espera e a outra espera, a barra diz isso, `The reviewer waits · Question` (ou `Permission`, `Reply`), ou `Session error · Reviewer` com o trilho de erro, com **Go to reviewer** (ou **Go to implementer**), que troca a aba e grava a escolha. Com as duas esperando, a barra é a da conversa na tela.

A barra de uma situação que nasce com a tela aberta pisca como a linha da árvore, e o leitor de tela ouve o rótulo e o lugar com que ela nasceu (`Approve step 4`, se o step já nasce pronto); a situação que já estava ali quando a tela abriu não é anunciada de novo.

Chegar a uma task por `Ctrl+J` ou pela notificação leva o foco ao que a situação pede, depois que a conversa (lida ou com a falha da leitura) e a barra estão na tela: a primeira pergunta sem escolha do cartão de pergunta, **Allow** (ou **Deny…**) do cartão de permissão, a principal da barra (ou a primeira ação habilitada), o compositor quando a resposta vai por ele, ou a própria barra quando nenhuma ação pode ser pressionada; sem nada disso na tela, o título. No review e na discussão, o foco da chegada vai ao título. Quando o que tinha o foco some porque resolveu a situação (**Retry**, **Try again**, **Approve**, **Continue**, **Approve draft**...), o foco vai ao compositor; sem compositor, à entrada atual da conversa; sem conversa, ao título. Ele nunca fica perdido na página.

Uma situação que começa enquanto o usuário olha para o produto pisca brevemente onde surgiu, em silêncio: na árvore, a linha do item pisca duas vezes no véu da gravidade (o de erro, ou o de espera, que cobre também o encerramento), ou o resumo do nó que a esconde, quando ele está recolhido, e na faixa recolhida, o bloco do item; a linha aberta não pisca. Sem movimento no sistema, nada pisca. Ao mesmo tempo, o leitor de tela ouve a situação nova, com o nome do item, o que ela pede e onde está (`add-login: waiting for reply in PRD`); a piscada e o anúncio não tiram o foco de onde ele está. Uma situação que começa com a janela fora de foco gera uma notificação do sistema, que identifica a task, a pull request do review ou a discussão, e o que ela pede; clicar nela traz a janela e abre o lugar certo. Cada situação notifica uma vez, ao começar. Continuações da mesma espera, como o stage chegar a 100%, a pull request passar de pronta a mergeada, a razão de checks e conflito mudar ou a pull request voltar a ficar pronta depois de um check ou de um conflito, não notificam.

A notificação toca, ao aparecer, o som do MySpec: um carrilhão curto e suave, o mesmo em todo sistema, no volume e na saída de áudio do sistema. Situações que começam juntas são ouvidas uma vez só: uma notificação a menos de dois segundos da última que tocou chega em silêncio, e cada situação continua com a sua notificação. Com o sistema em não perturbe o som não toca, onde o sistema torna esse estado conhecido. Clicar, dispensar ou retirar uma notificação não faz som. Uma notificação que não aparece não toca, e um som que não pode tocar deixa a notificação aparecer muda; nenhum dos dois vira erro na interface.

Não há níveis, silenciamento nem configuração de som: o volume e o não perturbe são os do sistema.

## Modelos e esforço

Os modelos e os níveis de esforço que o produto oferece são os do Claude Code instalado na máquina, lidos uma vez quando o app abre e guardados da última leitura bem-sucedida daquela máquina. Cada modelo tem os seus próprios níveis de esforço, e um modelo pode não aceitar nenhum: para ele o seletor de esforço não aparece, o rótulo da escolha mostra só o nome do modelo e a sessão roda sem esforço. Uma escolha salva que o catálogo não tem mais nunca é trocada pelo produto: ela fica como está, marcada como indisponível em toda parte em que aparece, e uma sessão ainda pode começar com ela, com o CLI decidindo. Quando nenhuma leitura deu certo na máquina, os seletores não oferecem nada e dizem por quê, nas configurações e no próprio menu de cada um: o Claude Code não foi encontrado, a versão instalada não lista os seus modelos, ou a leitura falhou. Os padrões de fábrica de cada etapa são nomes de modelo fixos no produto, atualizados a cada versão do app.

- **Padrões**: nas configurações, um modelo e um esforço por tipo de sessão: PRD, tech spec, plano, planejamento One-Shot, implementação, review de step, PR, review de PR e discussão. O de review de PR é também o ponto de partida do diálogo de início de um review do centro de review, e o de discussão, do diálogo de criação de uma discussão. O commit não tem escolha própria, porque roda na sessão do step ou do review.
- **Por task**: na criação, a task copia os padrões e o usuário ajusta o que quiser. Uma task Structured tem as etapas de PRD, tech spec, plano, implementação, review de step, PR e review de PR; uma One-Shot, as de planejamento One-Shot, implementação, review de step, PR e review de PR. Depois, o popover **Models**, aberto pelo menu `⋯` do cabeçalho da task ou pelo chip `Per stage` do grupo Task do painel **Details**, lista as etapas do modo dela e troca a escolha das que ainda não começaram. O review de step segue editável até o último step ser commitado, e a troca vale para os revisores que ainda não começaram; ele aparece mesmo numa task no modo `Manual`, porque um step pode passar a `Agent` antes de começar.
- **Por step**: na lista de steps do painel **Details**, cada step ainda não iniciado pode ter modelo e esforço próprios, pelo seletor ao lado do de modo. Uma escolha própria aparece em destaque, com `Its own model · Implementation uses Sonnet · high` no tooltip; um step que segue a implementação aparece discreto, com `Follows Implementation`, e não há como voltar a segui-la pelo seletor. A escolha congela quando a sessão do step começa. O revisor não tem escolha por step: ele começa com o review de step que a task tem na primeira passada. Uma task One-Shot não tem escolha por step: o step único usa a da implementação.
- **Por sessão**: dentro de uma conversa, o seletor troca o modelo e o esforço daquela sessão a partir da mensagem seguinte. A resposta em andamento termina com a escolha anterior.

## Prompts

As configurações listam os nove prompts, PRD, tech spec, plano, planejamento One-Shot, review de step, commit, PR, review de PR e discussão, cada um renderizado e editável. Um prompt editado é salvo como arquivo no diretório de dados e sobrevive a atualizações do app; um prompt nunca editado acompanha o padrão de cada versão. **Restaurar** volta ao padrão. O prompt é lido quando uma sessão começa, então uma sessão já em andamento mantém o prompt com que começou. O prompt de um step é o próprio arquivo do step, escrito pelo plano, ou o documento de uma task One-Shot, escrito pelo planejamento, e por isso não aparece aqui.

Os prompts de review de step, commit, PR e review de PR são um texto por tipo, que serve aos dois modos. Numa task One-Shot, onde os de review de step, PR e review de PR citam o PRD, o tech spec ou o arquivo do step, eles citam o documento One-Shot, e o produto acrescenta a cada um uma seção `One-Shot task`, que diz o papel do documento no lugar dos outros. Ela fecha os prompts de PR e de review de PR, seguida só da seção `## Card` no de PR de uma task criada de um card; no de review de step, vem antes da última resposta do implementador, que continua sendo o fim do prompt. Um prompt editado recebe o mesmo tratamento, então uma edição vale para os dois modos.

O prompt de review de PR serve também ao review do centro de review, de uma pull request sem task. Nele, o PRD e o tech spec são o documento de contexto do review, e o produto acrescenta ao fim, depois da seção `One-Shot task` quando ela existe, as seções de que cada caso precisa: `Pull request without a task`, que diz o papel do documento de contexto e que a worktree está em detached HEAD; `Findings format`, o formato de relatório que o produto lê, com os apontamentos ancorados em `arquivo:linha` ou gerais; `Publishing` no modo publicar, que proíbe editar, commitar e fazer push, ou `Applying` no modo aplicar, que diz ao agente para implementar só o que o produto enviar como aprovado. Em qualquer review de pull request, o de uma task incluído, vêm então `GitHub checks and conflicts`, que diz como tratar um check que falhou e um conflito com a base, e `GitHub status`, com o que o produto leu dos checks e do conflito antes da passada, e por último `Review instructions`, com as instruções fixas do repositório, e `Instructions for this pass`, com as da passada, quando existem. Um prompt editado recebe o mesmo tratamento.

O prompt de review de step sempre termina com a última resposta do implementador, que o produto acrescenta. O prompt de commit diz o que commitar conforme quem revisou: exatamente o que está em stage, no modo `Manual` e no review de pull request, ou tudo o que mudou na worktree, depois de um relatório limpo do revisor. Essa instrução nunca se perde: num prompt editado que removeu o placeholder, ela é acrescentada ao fim. O texto padrão do prompt de commit também reconhece um merge em andamento, como o da base que resolve um conflito, e o conclui com a mensagem que o git preparou. As mensagens que entregam um relatório ao implementador e que pedem uma nova passada ao revisor são textos fixos do produto e não aparecem aqui.

O prompt de discussão conduz a conversa de entendimento: ele diz ao agente que ele lê os clones dos repositórios do board e nunca os altera, carrega o estilo dos cards do board, contexto, problema, o que a entrega inclui e o que fica de fora, sem propor a solução, e diz onde escrever o documento e os rascunhos. O produto acrescenta ao fim as seções de que a discussão precisa: `Board`, com o board, os repositórios administrados, o campo de módulo com as opções, quando existe, e o status de cards novos; e `Drafts format`, com o formato exato do artefato de rascunhos que o produto lê. Um prompt editado recebe o mesmo tratamento.

Os prompts padrão de PRD e de planejamento One-Shot dizem ao agente que o contexto inicial pode já responder boa parte do que ele precisa, como um card do board com o épico, os irmãos e as dependências, ou uma descrição detalhada. O agente o trata como a fonte principal do quê e do porquê, não pergunta o que ele já responde, usa o épico e os irmãos para entender onde o trabalho termina sem invadir o escopo de outro card, e pergunta só pelas lacunas reais. Com um contexto completo, a conversa pode ser pouco mais que confirmar o entendimento. A instrução é a mesma com ou sem card. O prompt de PR de uma task criada de um card termina com uma seção `## Card`, acrescentada pelo produto, com o card e a instrução da referência de fechamento; um prompt editado recebe o mesmo tratamento.

Sair do editor com uma edição não salva pede confirmação.

## Configurações e aparência

As configurações abrem por **Settings**, no rodapé da barra lateral, ou por `Ctrl+,`, e pertencem ao app. Elas contêm a página **Defaults**, com o modo de review e os modelos e esforços com que uma task nova começa, a página **Boards**, a página **Repositories**, e os prompts. O cabeçalho do lugar das configurações tem **Close** (`Esc`), que volta ao lugar de onde elas foram abertas.

O tema segue o sistema por padrão e pode ser fixado em claro ou escuro pelo botão de tema do rodapé da barra lateral, o único lugar dele: cada clique passa ao seguinte, System, Light, Dark e System de novo, e o novo tema é aplicado na hora. Uma troca do tema do sistema com o app aberto também é aplicada na hora.

## Cabeçalho do lugar

Todo lugar da área principal abre com o cabeçalho do lugar, uma faixa só, sem quebra de linha: a task, o review, a discussão, o board, Reviews, o History, os três arquivados, as configurações e o início.

- `←` volta ao lugar anterior, com o destino no tooltip (`Back to Platform Roadmap · Alt+←`); sem anterior, fica desabilitado com `Nothing to go back to`. `→` só aparece quando há para onde avançar (`Forward to <lugar> · Alt+→`);
- o **breadcrumb** diz onde o item mora: o board e o épico de uma task, ou `No board`; o board de uma discussão, ou `No board`; `Reviews` de um review; `History` de um item arquivado. O board, `Reviews` e `History` abrem o lugar deles; o épico e `No board` são texto. Com a área principal abaixo de 1660 px, os níveis se recolhem num `…`, cujo menu os lista;
- o **título**, o nome da task, o título da pull request, o da discussão ou o do board, ou o nome do lugar (`Reviews`, `History`, `Settings`, `Home`), corta quando falta espaço, com o nome inteiro no tooltip. O tipo e a referência do item (`#N`, o repositório, o autor, `One-Shot`) ficam na linha da barra lateral;
- na task, depois do título, o **stepper**: as etapas do modo da task em ordem, as feitas com o visto, as futuras com o círculo e a atual numa pílula, com o nome, a posição (`3/7`, `pass 2`), o qualificador (`round 1`, `Manual`, `revisiting`), o glifo e a palavra do estado (`working`, `checks 3/5`, `paused`);
- à direita, o que o lugar tem. Na task: o medidor de contexto, **Pause** ou **Resume**, os botões dos painéis **Details**, **Artifacts** e, numa task criada de um card, **Card**, e o `⋯`. No review e na discussão: o estado, o medidor, **Pause** ou **Resume**, os controles do item e o apagar.

O stepper diz a situação da task uma vez: com uma situação, a pílula mostra só o glifo da mais grave, e o que ela pede fica no nome acessível e na barra do pedido; sem situação, a pílula diz o que roda. Pausada, a pílula fica neutra, com `paused`. O stepper não tem ação: é uma parada de Tab, com o progresso inteiro no nome acessível (`Progress · Implementation 3/7 · pass 2 · waiting for you: question in Reviewer`) e a lista das etapas no tooltip, com `Paused since 14:52` numa segunda linha quando a task está pausada; o hover numa etapa dobrada diz `PRD · done` ou `PR · to come`. Entre a criação de uma task e o primeiro estado que a traz, o cabeçalho aparece com o título vazio e as etapas de uma task Structured brilhando, sem pílula nem nada à direita.

O medidor da task mede a conversa na tela, a da aba escolhida num step com as duas, com `Context used by the reviewer: 44%` no tooltip. Antes da primeira leitura mostra `…`, com a sessão pausada mostra `—`, e sem conversa na tela (o step bloqueado ou preparando, a pull request esperando os checks sem conversa, ou encerrada) ou com uma conversa anterior aberta não aparece.

O cabeçalho cede pela largura da área principal, em limites fixos, nunca pelo comprimento do texto:

| Área principal abaixo de | O que muda |
|---|---|
| 1660 px | O breadcrumb dobra em `…` |
| 1440 px | Os botões dos painéis ficam só com o ícone |
| 1360 px | **Pause** e **Resume** ficam só com o ícone |
| 1300 px | O medidor fica só com a porcentagem; os traços entre as etapas saem |
| 1200 px | As etapas feitas ficam só com o visto |
| 1040 px | A pílula perde o qualificador e a palavra, e fica com o glifo; numa task One-Shot, o qualificador que toma o lugar da posição fica |
| 900 px | As etapas futuras ficam só com o círculo, e as peças da direita se aproximam |

O que sai continua no tooltip e no nome acessível. O nome da etapa atual nunca sai, e o estado do review e da discussão mantém o texto. Com tudo cedido, a 1100 px de janela, o que falta de espaço sai do título, que fica com ao menos 200 px.

Os painéis de um item, **Details**, **Artifacts** e **Card** na task, **Reports** no review e **Documents** na discussão, abrem pelo botão do cabeçalho, um de cada vez, e começam fechados. O tooltip de cada botão diz o que o painel mostra: `Steps, earlier conversations, reports and the facts of the task` e `PRD, tech spec, step files and the pull request draft`, e numa task One-Shot `Earlier conversations, reports and the facts of the task` e `The One-Shot document and the pull request draft`; o de **Card**, `The card acme/api#412 on the board` (ver [A partir de um card](#a-partir-de-um-card)). Com a área principal a partir de 1120 px o painel fica ao lado da conversa; abaixo, cobre-a. O painel entra deslizando da direita e sai do mesmo jeito, mais rápido. `×` ou `Esc` fecha e devolve o foco ao botão; ir a outro lugar fecha o painel, e voltar não o reabre.

Na task, **Details** tem, em grupos:

- **Steps**, numa task Structured, com `Steps · 2 of 7 committed` ou `Steps · 7 committed`: um step commitado com o visto, o SHA e a hora do commit, e o assunto e a data inteira no tooltip; o atual com o glifo da pílula e `now · Agent` ou `now · Manual`; um não iniciado com os seletores de modo e de modelo. Sob um step commitado ficam as conversas `Implementer` e `Reviewer`, com a hora em que começaram, e os relatórios de review; sob o atual, só os relatórios, porque as conversas dele são as abas. Numa task One-Shot, a partir da implementação, a linha **Implementation**, sem número, toma o lugar dos steps.
- **Planning**: uma linha por conversa de planejamento que existe (`PRD`, `Tech spec`, `Plan`, ou `Planning` numa task One-Shot), com a hora em que começou.
- **Pull request**, na etapa de PR: as conversas `Draft and opening` (`· #1284` com a pull request aberta) e `PR review`, com os relatórios do review da pull request sob esta, e, com ela aberta, o número, que abre no GitHub, e a base (`#1284 · into dev`, com `· merged` ou `· closed`), os checks pelo nome, com o estado e a duração, que conta os segundos de um check rodando enquanto a lista está à vista, e a idade da última leitura (`Checked` `2m ago`, com a hora no tooltip).
- **Task**: o repositório com o caminho do clone, ou `◇ clone missing` com o caminho no tooltip; o card e o épico, que abrem no GitHub, quando existem; o modo; o chip **Review mode** e o chip `Per stage`, que abrem os popovers Review mode e Models; a branch, a base e a worktree, quando a worktree existe; e o início (`Today 09:14`).

**Artifacts** tem só os documentos escritos: **Documents** (`PRD` e `Tech spec`, ou `One-Shot document`), **Step files · N** numa task Structured e **Pull request** (`Draft · <título>`, com `approved` depois da abertura). Sem nenhum, ele diz `No artifacts yet` e `The PRD appears here once the agent writes it.`, ou, numa task One-Shot, `The One-Shot document appears here once the agent writes it.`

Um relatório de **Details** ou um documento de **Artifacts** abre no lugar da lista, em Markdown, com **← Details** ou **← Artifacts** e o título, e a volta devolve o foco à linha que o abriu. Enquanto ele é lido, três barras brilham no lugar; uma leitura que falha diz `Couldn't read <arquivo>` com a razão e **Try again**. O painel nunca troca de documento sozinho, nem quando a etapa muda.

Quando uma ação falha, o **aviso do app** aparece no alto da área principal, sobre o cabeçalho do lugar, com o trilho de erro: o rótulo diz a ação que falhou e o item dela (`Couldn't pause Rate limit per API key`, `Couldn't refresh the board Platform Roadmap`), e o detalhe diz a mensagem do erro e, quando a ação tem uma saída conhecida, o que fazer: `Try again.`, `Check that gh is signed in.` numa ação que fala com o GitHub, ou `Change the path of the clone in Settings.` ao refazer, limpar e começar ou descartar um step, ou ao encerrar a task, quando o clone dela sumiu. O aviso fica até **Dismiss**, e a falha seguinte toma o lugar dele. Logo abaixo dele fica o aviso do que uma remoção deixou no disco. Na tela de boas-vindas, os dois ficam no topo da coluna dela.

O foco segue a ida: `Alt+←`, `Alt+→`, um nível do breadcrumb, `Ctrl+J` e o clique numa notificação levam o foco ao título do lugar, e numa task, `Ctrl+J` e a notificação, ao que a situação pede (ver [Depende de mim](#depende-de-mim)); o clique em `←` ou `→` deixa o foco no botão, e em `←` quando não resta nada à frente; o clique numa linha da árvore deixa o foco na linha.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+N` | Criar uma task |
| `Ctrl+J` | Abrir o próximo item que espera pelo usuário, o mais grave e, entre iguais, o que espera há mais tempo: task, review ou discussão |
| `Ctrl+,` | Abrir as configurações; com elas abertas, fechá-las de volta ao lugar anterior |
| `Ctrl+E` | Na tela de uma task, abrir a worktree dela no VS Code; sem worktree, nada |
| `Alt+←` | Voltar ao lugar anterior |
| `Alt+→` | Avançar ao lugar seguinte |
| `←` `→` | Com o foco nas abas **Implementer** e **Reviewer**, trocar de conversa |
| `Esc` | Fechar o painel aberto; sem painel, voltar de uma conversa anterior à conversa da task; sem ela, cancelar a edição de um prompt; fora dela, fechar as configurações de volta ao lugar anterior; com o foco na conversa e nada disso, ir ao compositor |

`Cmd` vale no lugar de `Ctrl`. Os atalhos funcionam com o foco em qualquer lugar da janela, inclusive na caixa de mensagem. Com um diálogo modal aberto, nenhum deles faz nada: o que o usuário faz ali não fica para trás nem é coberto por outro diálogo. O clique numa notificação com um diálogo modal aberto só traz a janela para a frente.

O app guarda o histórico dos lugares por onde o usuário passou, até 50 atrás do atual. Voltar e avançar pulam os lugares que não existem mais, e ir a um lugar novo descarta os que estavam à frente. Trocar de página nas configurações não conta como um lugar novo. O histórico sobrevive a reinícios: o app abre na Home, com os lugares da última execução atrás dela. Fechar as configurações volta ao lugar anterior, ou à Home quando não há nenhum.

O `Esc` do lugar vale quando nada mais perto do usuário o usa: uma lista, um popover, o `⋯` ou um diálogo aberto o recebe primeiro, e a caixa de mensagem, a busca do board e o rascunho de uma discussão tratam o seu. Na task, a ordem é a lista, o popover, o `⋯`, o painel e a conversa anterior, um `Esc` para cada.

Na conversa, que é uma parada só de `Tab`: ao chegar, o foco vai ao cartão pendente, senão à última entrada, e `Tab` passa pelos controles da entrada atual (**Copy**, os links, **Show all**, os botões de um cartão) antes de sair da conversa; os controles das outras entradas ficam fora do `Tab` até a entrada delas ser a atual. Numa entrada que abre, o grupo, o comando com saída, o subagente, o marco com conteúdo e a dobra de trecho, a parada é a própria linha que abre, que diz se está aberta ou dobrada.

| Atalho | Ação |
|---|---|
| `↑` `↓` | Ir à entrada anterior ou à seguinte |
| `Page Up` `Page Down` | Andar dez entradas |
| `Home` `End` | Ir à primeira ou à última entrada |
| `→` `←` | Abrir ou dobrar a entrada sob o foco; `←` numa entrada de dentro, fechada, vai à que a contém |
| `Enter` `Space` | Abrir ou dobrar a entrada sob o foco |
| `Esc` | Ir ao compositor, quando nada mais o usa |

No compositor, `Enter` envia, `Shift+Enter` quebra a linha e `Esc` interrompe o turno rodando só com a caixa vazia.

Na visão do board:

| Atalho | Ação |
|---|---|
| `↑` `↓` `Home` `End` | Percorrer os cabeçalhos e os cards visíveis |
| `←` `→` | Recolher e expandir a seção sob o foco |
| `Enter` | Abrir ou fechar o card da linha sob o foco, ou recolher e expandir a seção de um cabeçalho |
| `Esc` | Fechar o aviso de tecla, o painel do card e o modo de seleção, nessa ordem |
| `/` | Focar a busca |
| `S` | **Start task** no card sob o foco |
| `Space` | Entrar no modo de seleção com o card sob o foco, ou alternar o card nele |
| `D` | Abrir uma discussão do card sob o foco, ou da seleção no modo de seleção |
| `N` | Abrir uma discussão do board, sem cards |

As setas, `Enter` e `Space` valem com o foco na lista de cards; `S` e `D`, com o foco na lista ou no painel; `N`, `/` e `Esc`, em qualquer lugar da visão fora de um campo de texto.
