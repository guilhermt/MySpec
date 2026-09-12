# Funcionalidades

Este documento descreve o produto como ele é. Segue a ordem do ciclo de vida de uma task e termina com o que atravessa todo o produto: sessões, atenção, modelos, prompts e configurações.

## Área de trabalho

O produto abre uma pasta, como o VS Code faz: por argumento na linha de comando (`myspec <pasta>`, com caminhos relativos resolvidos contra o diretório atual), pelo botão da tela de boas-vindas, pelo seletor de pastas nativo (`Ctrl+O`) ou pela lista de áreas de trabalho recentes. A última área aberta é lembrada e reaberta na próxima execução. Uma pasta que não existe, não é um diretório ou não pode ser lida produz um aviso sobre a área de trabalho atual, sem trocá-la.

Só uma instância do app roda por vez. Abrir uma segunda, com ou sem pasta, entrega o argumento à instância que já existe, que troca a área de trabalho e traz a janela para a frente.

Ao abrir, o produto escaneia a pasta e encontra os repositórios git abaixo dela. A pasta `.myspec`, onde ficam as worktrees, é ignorada, para que uma worktree nunca seja tomada por um repositório. A barra lateral mostra a árvore com dois níveis: a raiz e os repositórios. Cada task aparece no nó em que foi criada, com a etapa em que está, o step em andamento e o que falta, o progresso do review e o que espera pelo usuário. A árvore é navegável pelo teclado.

## Criação de uma task

Uma task é criada a partir da raiz ou de um repositório (`Ctrl+N` cria no nó selecionado). Na criação o usuário informa:

- o **nome**, em minúsculas, dígitos e hífens simples, com até 64 caracteres, único na área de trabalho. Ele nomeia as worktrees e as branches;
- o **contexto inicial**: o que quer fazer, em alto nível ou em detalhe. É a primeira mensagem da sessão de PRD;
- o **modelo e o esforço de cada etapa**, partindo dos padrões configurados. O usuário pode ajustar qualquer etapa para essa task.

Ao confirmar, a sessão de PRD começa com o contexto inicial, e a primeira coisa que o usuário vê é a primeira pergunta do agente. Se a sessão não conseguir começar, a task é desfeita.

## Etapas de planejamento

A task passa por PRD, tech spec e plano. Cada etapa tem uma conversa própria, aberta no diretório da task: o repositório, para tasks de repositório, ou a raiz da área de trabalho, para tasks de raiz. A etapa termina quando o documento dela aparece no diretório de artefatos e a conversa está ociosa: o agente parou e nada está na fila. O produto então inicia a etapa seguinte sozinho.

- **PRD.** O agente segue o prompt de PRD: Q&A sobre o quê e o porquê, uma pergunta por vez, até não restar lacuna. Ao final lista o que entendeu, pede confirmação e escreve `PRD.md`.
- **Tech spec.** O agente lê o PRD, explora o código dos repositórios da task e conduz o Q&A técnico, apresentando alternativas com trade-offs para o usuário decidir. Escreve `tech-spec.md`.
- **Plano.** O agente lê os dois documentos, negocia a divisão do trabalho e escreve um arquivo por step em `steps/`. Cada arquivo tem o nome `<número>-<descrição-curta>.md`, começa com um cabeçalho `---` que carrega `repository: <caminho>` com um repositório da task e traz um título `# Step N: Título`. Os números começam em 1, sem lacunas nem repetições.

O plano é validado antes de a task avançar. Quando os arquivos não formam um plano válido, o produto diz ao agente o que está errado e pede a correção, até três vezes. Depois disso para de corrigir e mostra os problemas acima do compositor, para o usuário resolver na conversa ou descartar o plano.

O PRD, o tech spec e cada step ficam visíveis no painel de artefatos da task, renderizados como Markdown com diagramas mermaid.

### Voltar e descartar

A trilha de etapas no topo da task mostra onde ela está e o que pode fazer:

- **Voltar a uma etapa** reabre uma etapa anterior e apaga tudo que veio depois: conversas, documentos, arquivos de step, worktrees e branches, com o que houver de não commitado nelas. A task fica na etapa reaberta, em modo de revisita, até o usuário pressionar **Continuar**, para que o documento possa ser retrabalhado sem o produto avançar no meio.
- **Descartar e recomeçar** apaga a etapa atual também e inicia uma sessão nova para ela na hora.

Cada ação diz, antes de confirmar, exatamente o que será perdido.

## Implementação

Com o plano válido, a task entra na implementação e o produto inicia o primeiro step sozinho. Os steps rodam em sequência, na ordem numérica, um de cada vez.

### Worktrees

Cada step roda numa worktree do seu repositório, criada em `<área de trabalho>/.myspec/worktrees/<repositório>/<task>/` (`_root` quando o repositório é a própria área de trabalho), numa branch com o nome da task. A base é resolvida na criação: o produto roda `git fetch origin` e ramifica de `origin/dev`, ou de `origin/main` quando não há `dev`. O fetch só acontece na criação.

O produto é dono das worktrees que criou, e só delas: nunca reutiliza nem apaga um caminho ou uma branch que não criou. Uma worktree e sua branch são removidas quando a task é apagada, quando o plano é descartado, quando a task volta ao tech spec e no encerramento do repositório.

### Pré-condição: worktree limpa

Antes de iniciar um step o produto verifica que a worktree está limpa: nada modificado, em stage, apagado ou não rastreado, ignorados à parte. Uma worktree suja bloqueia o step, com o que foi encontrado e duas saídas: limpar por conta própria e **Tentar de novo**, ou deixar o produto descartar tudo com **Limpar e iniciar**. Um step é bloqueado do mesmo modo quando o fetch falha, quando nenhuma branch base existe, quando o caminho ou a branch já existem, ou quando o arquivo do step não nomeia um repositório da task. A mensagem do git é mostrada como o git a escreveu.

### Sessão do step

A sessão de um step abre dentro da worktree, com o arquivo do step como primeira mensagem. O arquivo aponta para o PRD e o tech spec no diretório de artefatos, delimita o escopo e traz o checklist de conclusão. Os steps anteriores já estão commitados na branch.

O agente implementa seguindo o tech spec. Só pergunta quando algo genuinamente o bloqueia, e sempre pela ferramenta de perguntas estruturadas, que o produto mostra como um cartão com opções. Ao terminar, apresenta o resumo do que fez. O step passa a **aguardando review** assim que o agente encerra um turno sem nada pendente. Pedir uma mudança na conversa devolve o step a **implementando**.

### Review

O review é feito no editor, arquivo por arquivo. **Abrir no VS Code** abre a worktree, e cada arquivo da lista de mudanças abre diretamente ao ser clicado. O usuário dá stage em cada arquivo revisado e faz alterações manuais quando quer.

Enquanto o step aguarda review o produto observa a worktree, inclusive o diretório do git, para que o stage feito no editor apareça na hora, e lê o `git status` a cada rajada de eventos. Todo arquivo alterado que o git reporta conta, arquivos novos um a um, ignorados nunca. Um arquivo está revisado quando nada dele resta fora do índice; um arquivo parcialmente em stage ainda está pendente. A faixa de review sob a barra do step mostra a barra de progresso, a contagem e a lista de arquivos. O mesmo progresso aparece como percentual na lista de tasks e na árvore. O produto nunca dá stage em nada: o stage é o review, e o review é o portão.

### Aprovação e commit

**Aprovar** só habilita com 100% em stage; abaixo disso diz o que falta. Também exige a sessão ociosa, sem turno rodando, nada na fila e nenhuma permissão ou pergunta em aberto, e retoma uma sessão pausada por conta própria.

Aprovar envia o prompt de commit como mensagem do produto na própria conversa do step, para o agente que escreveu o código commitar exatamente o que está em stage, em um commit, com assunto no imperativo e a convenção do repositório. O step fica **concluído** quando um commit aparece na branch além daquele em que começou, venha do turno de commit ou da mão do usuário. Se o turno termina sem commit, o step volta a **pronto para aprovar** e diz isso. Um step em que o agente não mudou nada não pode ser aprovado.

O produto então encerra o processo do step e inicia o próximo, criando a worktree quando o step muda de repositório. **Descartar step** encerra a sessão, apaga a conversa do step e o começa de novo, limpando a worktree a menos que o usuário peça o contrário.

## Pull request

Com o último step commitado a task entra na etapa de PR, que é por repositório: cada repositório tocado ganha uma aba, com a sua conversa, o seu estado e os seus controles. Um repositório cuja branch não tem commit próprio é marcado como pulado e não gera pull request.

### Rascunho e abertura

A sessão de PR abre na worktree com o prompt de PR. O agente lê os commits e o diff da branch contra a base, o PRD e o tech spec, e escreve um rascunho de título e descrição num arquivo de artefato. O rascunho aparece no produto, editável, e o repositório passa a **rascunho pronto**, esperando o OK. O usuário pode alterar o título e o corpo antes de aprovar, ou descartar o rascunho para o agente escrever outro.

Com o OK, o agente sobe a branch e abre a pull request com `gh pr create` contra a branch base, usando o rascunho como ele está naquele momento. A base é a mesma da worktree: `dev`, ou `main` quando não há `dev`. Quando o `gh` não está instalado, não está autenticado ou falha, o repositório fica **bloqueado** com a razão, e **Tentar de novo** repete a partir de onde parou.

O produto lê a pull request com o `gh`: número, link, estado e base aparecem no repositório, e uma leitura pode ser forçada a qualquer momento. Pull requests aguardando merge são consultadas automaticamente a cada minuto.

### Review de pull request

Aberta a pull request, a sessão de review começa sozinha com o prompt de review de PR. O agente revisa o diff contra o PRD e o tech spec, procurando erros, desvios da especificação e problemas de qualidade, e escreve um relatório numerado num arquivo de artefato, com o status `clean` ou `changes`.

Se o relatório está limpo, o repositório fica **pronto**, aguardando o merge. Se há apontamentos, o produto os mostra e o repositório passa a **aguardando decisão**: o usuário decide na conversa, item a item, o que quer aplicado. O agente aplica só o que foi aprovado. As mudanças então passam pelo mesmo review do produto que um step: stage arquivo a arquivo no editor, progresso em tempo real, **Aprovar** em 100%, e o commit feito pelo agente com o prompt de commit, que nesta etapa também sobe o commit para a pull request. Depois do commit o agente revisa de novo, e o ciclo se repete até um relatório limpo. **Revisar de novo** pede uma passada extra a qualquer momento, e os relatórios de todas as passadas ficam visíveis.

Uma pull request fechada sem merge é sinalizada como tal, e o repositório não pode ser encerrado.

## Encerramento e arquivamento

O encerramento é por repositório e é a única transição que o usuário aciona, porque depende de a pull request ter sido mergeada fora do produto. **Encerrar** habilita quando o `gh` reporta a pull request como mergeada, quando o repositório foi pulado, ou quando a última leitura falhou e o produto não consegue confirmar o merge.

Ao encerrar, o produto:

1. remove a worktree do repositório;
2. apaga a branch da task. Quando o GitHub confirmou o merge, apaga sem perguntar ao git, porque um squash merge nunca aparece como ancestral; quando o merge não pôde ser confirmado, só apaga se o git considerar a branch mergeada;
3. atualiza a branch base local, se ela estiver em checkout no repositório, limpa, com upstream e atrás da remota sem divergir.

Cada parte reporta o que fez, o que pulou e por quê, e o que falhou. O resultado fica registrado no repositório. Os demais repositórios da task seguem no estado em que estão.

Quando o último repositório é encerrado, a task é arquivada: sai da área de trabalho e passa a existir só no histórico, com um aviso momentâneo de que saiu.

## Histórico

O botão **History** no rodapé da barra lateral abre a lista das tasks arquivadas da área de trabalho, da mais recente à mais antiga, com busca por nome. Cada task arquivada mostra os seus artefatos finais renderizados, com PRD, tech spec, steps e, por repositório, a pull request e o resultado do encerramento. As conversas não são guardadas no histórico.

## Apagar uma task

Uma task pode ser apagada em qualquer etapa. Antes de confirmar, o produto mostra o que será destruído: as worktrees e as branches que existem, e o que já não está lá. Apagar para o que estiver rodando, remove as worktrees e as branches, apaga os artefatos e remove a task em definitivo. O que o git não conseguiu remover é listado num aviso, para o usuário resolver à mão.

## Sessões e conversas

Toda sessão é uma conversa dentro do produto, com interface própria. O Claude Code roda por baixo, invisível. A conversa mostra as mensagens do usuário e do agente, as ações que o agente executa agrupadas, os cartões de permissão e de pergunta, marcadores dos eventos da task (documento escrito, etapa iniciada, contexto compactado, resposta interrompida) e os erros. Tudo que o agente escreve é renderizado como Markdown, com diagramas mermaid e realce de código, em streaming.

Cada etapa, step e repositório tem a sua conversa. Voltar a uma etapa retoma a conversa dela de onde ficou.

- **Enviar**: mensagens enviadas com o agente ocupado entram numa fila, visível na conversa, e podem ser removidas antes de sair.
- **Interromper** encerra a resposta em andamento e mantém a sessão viva.
- **Pausar** para o processo e preserva a conversa; **Retomar** continua de onde parou. Uma sessão ociosa por dez minutos é parada sozinha e retomada de forma transparente na próxima mensagem.
- **Tentar de novo** reinicia uma sessão que falhou ao iniciar, cujo processo morreu, ou que não encontrou o `claude` ou um login.
- **Permissões**: as sessões rodam no modo auto do Claude Code. As escaladas que o modo auto não resolve sozinho aparecem como um cartão na conversa, com a ferramenta e a entrada exata, e aceitam permitir uma vez, permitir pela sessão ou negar com uma mensagem.
- **Perguntas**: as perguntas estruturadas do agente aparecem como um cartão com as opções, e a resposta volta pelo mesmo canal.
- **Contexto**: um medidor mostra quanto da janela de contexto a sessão já usou.

## Depende de mim

Uma task espera pelo usuário quando qualquer destas situações acontece: um erro de sessão, um step bloqueado, uma worktree ilegível, a etapa de PR bloqueada, um plano inválido, uma pull request fechada sem merge, uma escalada de permissão, uma pergunta do agente, uma resposta aquém do que o produto esperava, uma etapa revisitada pronta para continuar, um step aguardando review ou pronto para aprovar, um step sem mudanças, um rascunho aguardando OK, apontamentos de review aguardando decisão, mudanças aplicadas aguardando review, uma pull request pronta para merge, um repositório pronto para encerrar. Uma task pausada não espera por ninguém.

Cada situação diz onde está e o que pede. As situações aparecem:

- na seção **Waiting for you**, fixa no topo da barra lateral, com todas as tasks que esperam, exceto a que está aberta. `Ctrl+J` abre a primeira;
- na árvore e na lista de tasks, no nó de cada task;
- na própria task, na trilha de etapas, na barra do step e na aba do repositório.

Uma situação que começa enquanto o usuário olha para o produto pisca brevemente onde surgiu. Uma situação que começa com a janela fora de foco gera uma notificação do sistema, que identifica a task e o que ela pede; clicar nela traz a janela e abre o lugar certo. Cada situação notifica uma vez, ao começar. Continuações da mesma espera, como o stage chegar a 100% ou a pull request passar de pronta a mergeada, não notificam. Não há níveis nem silenciamento.

## Modelos e esforço

O produto oferece três modelos, Fable 5.1, Opus 5 e Sonnet 5, e cinco níveis de esforço, de low a max. Cada combinação é válida.

- **Padrões**: nas configurações, um modelo e um esforço por tipo de sessão: PRD, tech spec, plano, implementação, PR e review de PR. O commit não tem escolha própria, porque roda na sessão do step ou do review.
- **Por task**: na criação, a task copia os padrões e o usuário ajusta o que quiser. Depois, o popover **Models** no cabeçalho da task troca a escolha das etapas que ainda não começaram.
- **Por step**: na lista de steps, cada step ainda não iniciado pode ter modelo e esforço próprios. A escolha congela quando a sessão do step começa.
- **Por sessão**: dentro de uma conversa, o seletor troca o modelo e o esforço daquela sessão a partir da mensagem seguinte. A resposta em andamento termina com a escolha anterior.

## Prompts

As configurações listam os seis prompts, PRD, tech spec, plano, commit, PR e review de PR, cada um renderizado e editável. Um prompt editado é salvo como arquivo no diretório de dados e sobrevive a atualizações do app; um prompt nunca editado acompanha o padrão de cada versão. **Restaurar** volta ao padrão. O prompt é lido quando uma sessão começa, então uma sessão já em andamento mantém o prompt com que começou. O prompt de um step é o próprio arquivo do step, escrito pelo plano, e por isso não aparece aqui.

Sair do editor com uma edição não salva pede confirmação.

## Configurações e aparência

As configurações abrem pelo ícone no rodapé da barra lateral ou por `Ctrl+,`, e pertencem ao app, não à área de trabalho. Elas contêm os padrões de modelo e esforço e os prompts.

O tema segue o sistema por padrão e pode ser fixado em claro ou escuro pelo botão da barra lateral. Uma troca do tema do sistema com o app aberto é aplicada na hora.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+O` | Abrir uma pasta como área de trabalho |
| `Ctrl+N` | Criar uma task no nó selecionado |
| `Ctrl+J` | Abrir a primeira task que espera pelo usuário |
| `Ctrl+,` | Abrir ou fechar as configurações |

`Cmd` vale no lugar de `Ctrl`. Os atalhos funcionam com o foco em qualquer lugar da janela, inclusive na caixa de mensagem.
