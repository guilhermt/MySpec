# Organização do código

Um repositório só, no layout do Wails v3: o módulo Go na raiz, o frontend em `frontend/`. Este documento diz onde cada coisa está e como as partes se falam. As convenções de escrita estão em [guidelines](../guidelines/README.md).

```
main.go                  ponto de entrada; embute frontend/dist e o ícone
internal/                todo o código Go
  app/                   compõe o app Wails a partir dos services; sabe de Wails
  bindings/              services expostos ao frontend, DTOs e eventos; sabe de Wails
  flow/                  conduz uma task pelas etapas
  reviewflow/            conduz os reviews de pull request do centro de review
  discussionflow/        conduz as discussões: a sessão, os rascunhos e a publicação no GitHub
  session/               a conversa de cada sessão e o processo por trás dela
  claude/                o CLI do Claude Code como subprocesso e o seu protocolo
  task/                  tasks, modos, artefatos, plano, steps e pull requests
  worktree/              as worktrees que o app cria
  review/                observação das worktrees em review
  prreview/              os reviews de pull request: registro, relatórios, apontamentos, decisões e o que foi publicado
  discussion/            as discussões: registro, cards de entrada, rascunhos, edições, decisões e o que foi publicado
  pulls/                 a leitura das pull requests abertas dos repositórios cadastrados, os filtros e a regra de pendente
  attention/             as situações que esperam pelo usuário
  prompts/               prompts padrão embutidos e os editados
  models/                modelos, esforços e padrões
  reviewmode/            quem revisa os steps e o padrão do app
  repository/            os repositórios cadastrados: identidade no GitHub, clone, board, filtro, a varredura da home e a clonagem
  board/                 os boards cadastrados, a leitura dos cards pelo gh e o contexto de uma task criada de um card
  upgrade/               leva as tasks de um banco com áreas de trabalho para os repositórios
  frontmatter/           lê o cabeçalho --- dos documentos que os agentes escrevem
  git/, gh/              rodam os binários; nada sabem de tasks
  editor/                abre o VS Code
  theme/                 preferência de tema
  store/                 SQLite e migrations
  platform/              logging, notify (D-Bus), chime, dnd, xdg
frontend/
  src/app/               App, shell, bootstrap e atalhos globais
  src/store/             o store Zustand, as ações e o transcript
  src/lib/               a fronteira com o Go (wails.ts) e helpers puros
  src/features/          um diretório por área da interface
  src/components/        componentes compartilhados entre features que não são do shadcn
  src/components/ui/     componentes shadcn; gerados, nunca editados à mão
  src/styles/            Tailwind, tokens e fontes
  src/test/              setup do Vitest, render com store e mock do Go
  bindings/              gerados por `task generate`; nunca editados à mão
build/                   config do Wails, ícones e entrada .desktop
.github/                 CI e Dependabot
```

## Backend em Go

### Camadas

Só dois pacotes conhecem o Wails: `internal/app`, que compõe tudo e abre a janela, e `internal/bindings`, que expõe os services e define os DTOs e os eventos. Todo o resto é Go puro, testável sem Wails.

Os pacotes de domínio se organizam em camadas, de baixo para cima:

1. **Plataforma e binários**: `platform/*`, `git`, `gh`, `editor`, `frontmatter`. Cada um sabe fazer uma coisa e nada sobre o produto.
2. **Estado**: `store`, com um repositório por tabela, e `models`, `reviewmode`, `theme`, `prompts`.
3. **Domínio**: `task`, `prreview`, `discussion`, `pulls`, `session`, `worktree`, `review`, `repository`, `board`, `attention`. Cada um é dono de um conceito, guarda o seu estado pelo `store` e reporta o que mudou por callbacks. Nenhum deles decide o que fazer com a mudança.
4. **Orquestração**: `flow`, `reviewflow` e `discussionflow`. `flow` ouve as mudanças de tasks e sessões, decide o que a etapa atual precisa e age: inicia a etapa seguinte, corrige um plano, inicia um step, conduz o review pelo agente, cria uma worktree, aprova, abre a etapa de PR, encerra a task. `reviewflow` faz o mesmo para os reviews de pull request: inicia, pede passadas, registra relatórios, publica, aplica, percebe commits novos, encerra e apaga. `discussionflow` faz o mesmo para as discussões: inicia a conversa, lê os rascunhos ao fim de cada turno, publica no GitHub o que foi aprovado, retoma uma publicação pela metade, arquiva e apaga.
5. **Exposição**: `bindings` converte o domínio em DTOs e recebe as chamadas do frontend; `app` liga tudo e publica o estado.

Dois pares merecem nota. `git` roda o binário e não sabe o que é uma task; `worktree` carrega a política do produto: onde as worktrees ficam, como nascem, quando estão limpas, como vão embora. `gh` espelha `git`: roda consultas GraphQL, classificando as falhas (sem `gh`, sem autenticação, sem o escopo de projects, limite de taxa), clona repositórios, lê o diff de uma pull request, publica um review e escreve issues e cards de board — cria e atualiza uma issue, acrescenta um item ao board, define um campo de seleção única, registra uma sub-issue e uma relação de bloqueio, e resolve os node ids de que essas escritas precisam —, com o JSON no stdin de `gh api`, sem saber o que é um board, um review ou uma discussão; quem abre pull requests é o agente.

`board` é dono dos boards cadastrados e da leitura guardada de cada um. Uma leitura faz uma consulta da estrutura do board, as consultas paginadas dos itens, primeiro as issues abertas e depois as fechadas nos últimos 14 dias, e poucas consultas em lote, com aliases, para os épicos com as sub-issues, as dependências fora da leitura e os cards de tasks ativas que ficaram fora dela; nunca uma chamada por card. A montagem em Go junta a convenção do corpo às relações nativas. `board` também sugere o nome de uma task e monta o contexto de uma task criada de um card, e reporta por `OnChange` e `OnRead` sem decidir nada sobre tasks: é `app` que entrega os cards de cada leitura a `task.Service.UpdateCards`. Toda escrita que muda o board de um repositório acontece na transação do board no `store`, seguida de `repository.Service.Sync`. `repository` clona em segundo plano, com o estado do clone em memória, e guarda a pasta de clones e as instruções fixas de review de cada repositório.

### Itens

Uma task, um review de pull request e uma discussão são **itens**: coisas que têm conversa e situações, e, nos dois primeiros, worktree. A tabela-pai `items` dá a eles um id comum, e `sessions`, `worktrees` e `situations` pertencem a um item, não a uma task; ver [storage.md](./storage.md#itens). Os ids são UUIDs, únicos entre os três tipos, e no código Go e no frontend o id de um item viaja nos campos `TaskID`/`taskId` de `session.Key`, `worktree.Worktree`, `attention.Found` e dos DTOs de situação. `session`, `worktree`, `review` e `attention` não olham para o que o id nomeia; quem sabe o que um id nomeia é `flow`, `reviewflow` ou `discussionflow`. Por isso `app` chama `flow.Check`, `reviewflow.Check` e `discussionflow.Check` com o mesmo id, e cada um ignora o que não é seu.

Um review não tem etapas: tem uma sessão só, na stage `review`, e uma worktree em detached HEAD no head da pull request, sem branch local, em `worktrees/<dono>/<nome>/pr_<número>/`. `_` não cabe no nome de uma task, então o caminho nunca colide com o de uma task. Uma discussão também não tem etapas, e não tem worktree: tem uma sessão só, na stage `discussion`, que roda na pasta de artefatos dela.

### O centro de review

`pulls` lê do GitHub as pull requests abertas dos repositórios cadastrados, com uma consulta GraphQL por lote de 15 repositórios, com aliases, e traz de cada uma o último review enviado pela conta do `gh`, de onde vêm "revisada" e "commits novos". Um erro GraphQL de um alias vira a falha daquele repositório, e os outros do lote valem. A leitura fica só em memória, uma por vez, com as pedidas durante outra coalescidas numa só depois, como a de um board. `app` pede uma leitura ao iniciar e a cada cinco minutos, e o frontend, ao abrir a visão. `pulls` também lê pull requests específicas, abertas ou não, guarda os filtros da visão na setting `review_filters` e decide o que é pendente. Ele não sabe o que é um review.

`prreview` é dono dos reviews como itens: o registro, a pasta de artefatos, o parser do relatório, as decisões, as edições e o que foi publicado, com um cache em memória como o de `task`. O relatório é um arquivo do agente e nunca é reescrito pelo produto; as decisões, os textos editados, o veredito e o lugar em que cada apontamento foi publicado ficam no banco. `RecordReport` reconcilia um relatório reescrito na conversa com o que está guardado: cada apontamento novo herda o texto e a decisão do antigo com o mesmo arquivo, linha e texto original, e uma passada publicada nunca é tocada. `prreview` também lê um unified diff para saber quais linhas do lado novo estão nele e monta o corpo do review publicado.

`reviewflow` tem o desenho de `flow`: um lock por review, `Check` que coalesce avaliações numa goroutine e um estado derivado, `reviewflow.State`, cujo status é uma função pura das colunas do review, da passada mais recente, da sessão e, no modo aplicar, da leitura do watcher. A avaliação lê o relatório da passada pedida quando a sessão fica ociosa; não há watcher de arquivos para reviews, porque o relatório só importa quando o turno termina. `Poll`, chamado a cada minuto junto de `flow.PollPRs`, lê as pull requests dos reviews ativos numa chamada só, grava o head e o estado delas e encerra os reviews cuja pull request foi mergeada ou fechada. Publicar lê o diff atual, rebaixa ao corpo os apontamentos cuja linha saiu do diff e publica pelo `gh`. No modo aplicar, `reviewflow` usa o watcher de `review` e o prompt de commit como `flow` faz na etapa de PR, com o push para `HEAD:refs/heads/<branch da pull request>`, porque a worktree não tem branch local.

`board` responde qual card tem uma pull request vinculada, pela leitura guardada, monta o contexto do card para o documento de contexto do review e o contexto inicial de uma discussão, e guarda o status com que os cards novos de uma discussão entram no board. `repository` recusa remover um repositório com reviews, e `board` conta tasks e reviews juntos para decidir se um repositório que sai de um board fica no produto.

### A discussão

`discussion` é dono das discussões como itens: o registro, os cards de entrada, a pasta de artefatos, o parser e a validação do artefato de rascunhos, os rascunhos com as edições, as decisões e o que foi publicado, com um cache em memória como o de `task`. O artefato é um arquivo do agente e nunca é reescrito pelo produto; tudo o que é do usuário e do produto fica no banco. `RecordDrafts` reconcilia uma reescrita com o que está guardado: um rascunho que mantém o id mantém o texto editado e a decisão, um que o agente mudou tem a revisão avançada, um que saiu leva consigo o épico e as dependências que apontavam para ele, com um aviso em quem apontava, e um rascunho publicado nunca é tocado. `discussion` também responde qual discussão criou ou atualizou um card, por `DocumentOfCard`, de onde sai a seção `Discussion` do contexto de uma task.

`discussionflow` tem o desenho de `reviewflow`: um lock por discussão, `Check` que coalesce avaliações numa goroutine e um estado derivado, `discussionflow.State`, cujo status é uma função pura das colunas da discussão, dos rascunhos e da sessão. A avaliação percebe o documento pela data e pelo tamanho do arquivo, lê o artefato de rascunhos quando a sessão fica ociosa — um artefato ilegível deixa a razão à vista, para que a discussão não espere por rascunhos que não vêm — e enfileira o que está pronto para ir ao GitHub.

A publicação roda numa goroutine da discussão, uma por vez, então nenhuma avaliação espera pelo GitHub. Uma corrida ordena os alvos pelas dependências, resolve os node ids de que precisa em consultas em lote e, para cada alvo, faz os passos na ordem: criar ou atualizar a issue, acrescentá-la ao board, definir o status e o módulo, ligar a issue pai e registrar as dependências. Cada passo é gravado ao concluir, e uma falha para a corrida no rascunho em que aconteceu, com a razão no banco: **Retry** repete a corrida pulando o que está gravado, e nada é criado duas vezes. Uma dependência que o GitHub recusa e um módulo que deixou de ser opção viram avisos no rascunho, não falhas. Ao fim de uma corrida que escreveu algo, `discussionflow` pede uma leitura nova do board.

### Composição e injeção

`app.Run` monta os services na ordem das dependências, cada um recebendo as suas por uma struct `Deps` e um `*slog.Logger`. Não há variável global: quem precisa de algo recebe no construtor. Os callbacks `OnChange` de cada service convergem para `app.publish`, que monta um snapshot e emite `state:changed`.

### O estado que o frontend vê

`bindings.State` é tudo que a interface renderiza, produzido no Go e nunca derivado no frontend. `app.snapshot` lê os boards cadastrados, com a leitura guardada de cada um, os repositórios cadastrados, com o estado do clone e as instruções de review, as tasks, com o card de cada uma, os resumos das sessões, os artefatos, os steps e a pull request de cada task, o estado de cada review ativo, os reviews arquivados e a última leitura das pull requests, deriva as situações das tasks e dos reviews a partir das mesmas leituras, para que todas as superfícies concordem, e converte tudo em DTOs. Cada mudança em qualquer service publica um snapshot inteiro; o frontend substitui o que tem. A leitura inteira de cada board viaja no `State`, porque a janela de leitura a mantém pequena, e o que cada card permite (**Start task**, clonar, acrescentar ao board) é decidido no Go. Do mesmo modo, `State.ReviewCenter` traz as pull requests lidas já com o card, a task ou o review de cada uma, se é pendente, se passa pelos filtros e a ação da linha, e a contagem do nó **Reviews**; `State.Reviews` traz os reviews ativos, com o status, as passadas, os apontamentos, as situações e as ações que cada um permite; `State.ReviewHistory`, os arquivados; `State.Discussions` traz as discussões ativas, com o status, os rascunhos com o que cada um permite, os avisos e as situações, e `State.DiscussionHistory`, as arquivadas com os rascunhos e o que cada um virou.

Os enums dos DTOs viajam como `string`, com um comentário listando os valores, para que os bindings gerados não emitam enums TypeScript; o frontend estreita com funções `asX` em `lib/wails.ts`.

### Eventos

Quatro eventos tipados, registrados em `bindings.RegisterEvents` antes de `application.New`:

| Evento | Carrega | Quando |
|---|---|---|
| `state:changed` | `State` inteiro | Qualquer mudança em qualquer service |
| `transcript:changed` | um `TranscriptEvent`: entrada nova, texto em streaming, remoção ou reset | A cada mudança numa conversa |
| `situation:started` | a situação e se a janela estava em foco | Uma situação nova começa; dirige o piscar |
| `situation:open` | item e lugar | Um clique numa notificação pede a abertura |

### Notificações e som

`attention.Service` decide quando uma situação notifica e chama `notify.Notifier`, que fala com o serviço `org.freedesktop.Notifications` numa goroutine própria, na ordem dos pedidos, sem nunca segurar quem chamou. É também o notifier que decide o som: uma notificação faz som quando nenhuma outra fez nos últimos dois segundos, e só se o envio deu certo. Antes dela o notifier lê as capacidades do servidor. Um servidor que anuncia `sound` recebe o caminho do carrilhão na hint `sound-file` e aplica o próprio não perturbe. Para os outros a notificação vai com `suppress-sound`, e o notifier toca o carrilhão por `chime.Player`.

`chime` é dono do som: o WAV embutido no binário, a cópia em `sounds/chime.wav` que `Install` escreve ao iniciar, e o `Player`, que toca um carrilhão por vez numa goroutine própria. O player pergunta a `dnd.Detector`, em até meio segundo, se o desktop está em não perturbe, e depois roda o primeiro player de áudio que funcionar, com cinco segundos de limite. `dnd` pergunta ao shell do Omarchy, ao KDE Plasma, ao dunst e ao swaync; o que não responde não diz nada, e o carrilhão toca. Ao fechar, o app fecha o notifier e depois o player, que mata um som ainda tocando.

### Fluxo de uma sessão

`session.Service` é dono da conversa de cada chave `{item, stage}`, onde a stage é `prd`, `tech_spec`, `plan`, `one_shot`, `step:<n>`, `step_review:<n>`, `pr` ou `pr_review` numa task, `review` num review de pull request e `discussion` numa discussão. Ele inicia o processo por `claude`, consome o stream de eventos, monta o transcript, persiste as entradas no `store`, deriva o estado (trabalhando, esperando, precisa de permissão, precisa de resposta, pausada, erro) e avisa `flow` e `app` a cada mudança. O detalhe está em [sessions.md](./sessions.md).

### Fluxo de uma etapa

`task.Service` observa o diretório de artefatos de cada task com fsnotify e reporta quando um documento aparece. `flow.Service.Check` recebe esse aviso, e o de cada mudança de sessão, e enfileira uma avaliação por task, coalescendo rajadas. A avaliação lê a task e decide: uma etapa cujo documento existe e cuja sessão está ociosa avança; um plano inválido recebe uma correção; um step concluído dá lugar ao próximo; o último step commitado abre a etapa de PR. Na implementação e na PR a avaliação desce ao step que roda e à pull request da task. Num step no modo `Agent`, a avaliação do step conduz o loop entre o implementador e o revisor: pede uma passada, entrega um relatório com mudanças, pede o commit de um relatório limpo ou passa o step ao usuário, como descreve [sessions.md](./sessions.md#o-loop-do-review-de-step).

A ordem das etapas é do modo da task, `task.Mode`, gravado na criação: `prd, tech_spec, plan, implementation, pr` numa task Structured e `one_shot, implementation, pr` numa One-Shot. Avançar, voltar, descartar, apagar os artefatos a partir de uma etapa e listar as escolhas de modelo passam pelos métodos de `Mode`, então cada regra de "antes", "depois" e "a partir de" vale para os dois modos sem ramos próprios. Uma etapa com sessão tem o mesmo nome em `task`, `prompts`, `models` e na chave da sessão, e é por esse nome que `flow` acha o prompt e a escolha de modelo dela.

A implementação de uma task One-Shot não tem caminho próprio em `flow`. A inspeção da task sintetiza, a partir de `one-shot.md`, um plano de um step, o número 1, e `flow` o conduz como qualquer step: worktree, bloqueios, review manual ou pelo agente, commit, descarte, retomada e abertura da etapa de PR. O único ponto em que ele difere é `Task.StepPath`, que aponta o documento como o prompt do step.

### Banco e migrations

`store.Open` abre o SQLite com uma conexão só, WAL e foreign keys, e aplica as migrations embutidas em `store/migrations/NNNN_nome.sql`, uma transação por arquivo, guardando a versão em `PRAGMA user_version`. A migration 0012 roda, na sua transação, o `store.Upgrade` que o app injeta, que leva as tasks de um banco com áreas de trabalho para os repositórios cadastrados; ver [storage.md](./storage.md). Os testes usam `store.OpenMemory`, que não passa nenhum.

## Frontend

### Fronteira com o Go

`lib/wails.ts` é o único arquivo que importa os bindings gerados e o runtime do Wails. Ele reexporta os tipos dos DTOs, define as uniões de strings e as funções `asX` que estreitam os enums, expõe o objeto `api` com uma função por método dos services e as funções `onX` que assinam os eventos. Tudo que está fora de `lib/wails.ts` fala com o Go por essas funções, e os testes substituem só elas.

### Store

`store/app-store.ts` é o store Zustand: o `State` recebido do Go, os transcripts por chave de sessão, os rascunhos, em `textDrafts`, inclusive os dos apontamentos e dos resumos de um review e os dos títulos e corpos dos rascunhos de uma discussão, e o estado de interface que só o frontend conhece (task aberta, board aberto, visão Reviews, review aberto, review arquivado aberto, discussão aberta, discussão arquivada aberta, diálogo de criação aberto e o card de onde ele parte, o **Start task** e o review que esperam um clone, nós recolhidos da barra lateral, último repositório usado, aba da conversa do step, histórico e configurações abertos, edição de prompt, navegação pendente). Ele exporta hooks seletores (`useTask`, `useOpenBoardId`, `useTranscript`, `useOpenTask`...) para que cada componente assine só a fatia que usa, e `NO_ITEM_PLACE` reúne as telas de review e de discussão que qualquer outra navegação deixa para trás, para que só uma esteja aberta por vez. O store importa só de `lib/`.

`store/actions.ts` é o que os componentes chamam para agir: cada ação chama `api`, e um erro vira a mensagem do aviso de erro. Nenhuma ação toca o `State`: o estado novo sempre chega por `state:changed`. Os componentes nunca chamam `api` diretamente.

`app/bootstrap.ts` assina os quatro eventos antes de pedir o estado inicial, para que um evento emitido no intervalo seja aplicado e não perdido.

### Features

Cada diretório de `features/` cobre uma área: `sidebar` para a barra lateral e a árvore de tasks, `home` para a área principal sem task aberta, `welcome` para a tela sem boards nem repositórios cadastrados, `board` para a visão de um board, `boards` para a página de boards, `reviews` para o centro de review, com a visão Reviews, o diálogo de início, a tela de um review e o review arquivado, `discussion` para a discussão, com o diálogo de criação, a tela, o painel de rascunhos, o painel de documentos e a discussão arquivada, `migration` para a tela de migração recusada, `repositories` para a página de repositórios, `task` e `task-create` para a task, `chat` para as conversas, `attention` para a seção de espera, `history`, `settings`, `models`, `review-mode` para o seletor de modo de review, `notice` e `theme`. A lógica de apresentação que não depende de React fica em arquivos `.ts` ao lado dos componentes (`status.ts`, `step-status.ts`, `pr-status.ts`, `stage-actions.ts`, `review-status.ts`, `discussion-status.ts`), testável sem renderizar. Um componente usado por mais de uma feature e que não é do shadcn, como o `FilterMenu` das visões de board e de reviews, fica em `src/components/`, ao lado de `ui/`; é lá que está `useEditedText`, o hook que segura um texto do Go enquanto o usuário o edita, compartilhado entre os apontamentos de um review e os rascunhos de uma discussão.

`lib/` guarda o que o store e as features compartilham: boards, repositórios, pull requests, situações de tasks, de reviews e de discussões, etapas, modelos, modos de review, nomes de task, front matter, o diff do corpo de um rascunho. `lib/ui-storage.ts` guarda no `localStorage` a memória de interface que sobrevive a reinícios e não é estado do produto: os filtros e as seções recolhidas de cada visão de board e os nós recolhidos da barra lateral.

### Estilo

`styles/globals.css` importa o Tailwind, o tw-animate-css e o CSS do shadcn, define as variáveis de cor em oklch para os temas claro e escuro e, fora de qualquer camada, arredonda para o pixel a centralização dos dialogs do shadcn, que o WebKitGTK borraria quando ela cai em meio pixel. `styles/tokens.css` define fontes, tamanhos, durações, curvas e as cores de status de sessão. Os componentes usam classes do Tailwind e os tokens; uma cor nunca é o único portador de um estado, todo ponto colorido tem um rótulo.

## Build

`main.go` embute `frontend/dist`. Como esse diretório é saída de build e `//go:embed` recusa um diretório vazio, as tarefas Go criam um placeholder quando não há build, para que lint, testes e vulnerabilidades rodem num clone limpo. A tag de build `production` diferencia o binário instalado do de desenvolvimento: só o de desenvolvimento escreve o log também no stderr.
