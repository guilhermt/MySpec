# Estrutura

Aprovado em 2026-09-25. A arquitetura de informação e o modelo de navegação do MySpec: os lugares, a barra lateral, o item aberto, os atalhos, as larguras e os estados de toda tela. O designer e o crítico leem este documento antes de qualquer rodada, junto do `brief.md`. O visual está em `principles.md` e `system/`.

Este documento tem a regra geral. O detalhe de cada lugar está no documento dele em `screens/`: `task.md` (a task), `board.md` (Home, o board e a criação de task), `review.md` (Reviews e o review de uma PR), `discussion.md` (a discussão) e `rest.md` (Settings, History, início, boas-vindas, diálogos, avisos e notificações). Onde um documento de tela detalha uma regra daqui, vale o detalhe dele.

## 1. Modelo de navegação

- **Duas colunas.** A barra lateral é o painel de comando. A área principal mostra um lugar por vez.
- **Lugares**, sempre na área principal:
  - Home;
  - a visão de um board;
  - Reviews, o centro de review;
  - History;
  - Settings;
  - um item aberto: task, review de PR ou discussão;
  - um item arquivado.

  Não há camadas nem modais de lugar. Os diálogos (criação de task, início de review, criação de discussão, publicação, cadastros, confirmações) continuam diálogos.
- **Item aberto.** Abrir um item é ir a um lugar. A linha dele na árvore fica selecionada (`aria-current="page"`) e, se estava fora da vista, a árvore rola até ela e abre os nós que a escondiam. A visão de um board e Reviews marcam o nó delas do mesmo jeito.
- **Histórico.** Toda ida a um lugar entra numa pilha. `←` e `→` no cabeçalho, ou `Alt+←` e `Alt+→`, percorrem a pilha. O `←` diz para onde volta, no tooltip, e o `→` só aparece quando há para onde avançar. Ir a um lugar novo limpa o que estava à frente. A pilha e o último item aberto são estado do frontend, lembrados entre execuções.
- **Breadcrumb.** No cabeçalho, depois de `←` e `→`: `board / épico /`, `Reviews /`, ou `No board /`, seguido do título do lugar. Cada nível abre o seu lugar. Numa área principal estreita, os níveis dobram num `…` com um menu. O glifo de tipo e a referência do item (`repo#card`, `repo#PR`) não ficam no cabeçalho: estão na árvore e em `Details`.
- **Settings e History** são lugares como os outros. Settings abre pelo rodapé ou por `Ctrl+,`, também nas boas-vindas, e abre em **Defaults**, ou na página do link que o trouxe (**Edit the board in Settings…** abre Boards; o aviso de clone abre Repositories). Fechar Settings (`Esc`, **Close**, `Ctrl+,` de novo, `←`) volta ao lugar anterior, nunca a Home.
- **Home** é o lugar sem nada aberto (`screens/board.md` §2). De cima para baixo:
  - **Continue**, com o último item ativo aberto, o que ele pede com a posição (`Question · Reviewer · Step 3/7`), o tempo e onde ele vive. **Continue** recebe o foco, então `Enter` o abre no lugar da situação. Sem item ativo, a seção dá lugar a `Nothing in progress`;
  - **Start**, as três ações de início: **New task** (o diálogo livre), **Review a pull request** (vai a Reviews, com as pendentes) e **New discussion** (o diálogo de discussão, com a escolha do board quando há mais de um);
  - **Boards**, um por linha, com os cards abertos, os repositórios e a idade da leitura, e sob cada um o que bloqueia sem ser situação (leitura falha, repositório sem clone, clone inexistente), com a ação; os repositórios sem board numa última linha, **No board**;
  - a linha dos atalhos.

  Home não lista o que espera pelo usuário: isso é da árvore.
- **Chegar a uma situação.** A notificação do sistema e o `Ctrl+J` levam ao mesmo lugar, do mesmo jeito:
  - a janela vem à frente;
  - o item abre no lugar da situação (a aba `Reviewer` para uma situação do revisor);
  - a linha é trazida à vista na árvore;
  - o foco vai para o que o item pede. Numa pergunta ou permissão, é a primeira opção do cartão, e as teclas 1 a 9 respondem direto. Com apontamentos ou rascunhos a decidir, é o próximo por decidir. Em todo o resto, é a primeira ação da barra do pedido.

  Chegar pela notificação entra na pilha do histórico como qualquer ida.
- **Um item que sai do estado enquanto está aberto** (task encerrada ou apagada, review terminado pelo merge ou pelo fechamento, discussão arquivada ou apagada) dá lugar à página do item que saiu: o que aconteceu e o resultado (o do encerramento, as passadas publicadas, as rodadas publicadas; no apagado, o que ficou no disco e o comando para remover). A página oferece **Next that needs you** (primária, com o foco; desabilitada com a razão quando nada espera, e então **Open in History** é a primária), **Open in History** (menos no apagado) e a volta ao lugar de origem. Nunca uma área vazia. Um item que sai sem estar aberto gera só um toast.

## 2. Barra lateral

De cima para baixo:

- o nome do produto, **+ New ▾** (nova task, review de PR, nova discussão) e `«` para recolher;
- o filtro por repositório;
- a árvore;
- o rodapé.

A largura é contínua: `clamp(288px, 8vw + 200px, 380px)`.

### A árvore

- **Ordem.** Primeiro **Reviews**, com `N pending` e os reviews ativos. Depois um nó por board, em ordem alfabética: os épicos primeiro, com as tasks dentro, depois as tasks sem épico, depois as discussões do board. Por último **No board**, só quando tem algo: as tasks livres, as de repositórios sem board, as discussões de um board removido e os avisos de clone desses repositórios. Dentro de cada nó, a ordem é a de criação. A árvore nunca reordena sozinha. Quem diz o que é mais urgente é a gravidade e a marca `Ctrl J`.
- **Nó de board.** O título abre a visão do board. À direita, o nó mostra `reading…` durante uma leitura, ou `◇ Read failed` com a razão no tooltip. Um board sem itens mostra `No active items.`
- **Nó Reviews.** Abre o lugar Reviews. A contagem é a das pendentes que passam pelos filtros de Reviews. Sem review ativo, mostra `No review in progress.`
- **Aviso de clone inexistente.** É um item da árvore (`treeitem`), no topo do nó em que ficam as tasks do repositório: o nó do board dele, ou **No board** para um repositório sem board. A árvore não tem nó de repositório. O item mostra `◇ <repo> · clone missing`, e `Enter` muda o caminho. O `◇` marca o que bloqueia trabalho sem ser uma situação. Nunca se confunde com o erro de um item.
- **Papel e teclado.** A árvore é `role="tree"`, com um só ponto de Tab (roving tabindex). ↑↓ percorrem o que está visível. `Home` e `End` vão às pontas. → expande um nó ou entra nele. ← recolhe o nó ou sobe ao pai. `Enter` abre.

### A linha de um item

Duas linhas, e uma terceira só enquanto o agente trabalha.

| Linha | Conteúdo |
|---|---|
| 1 | Glifo de tipo e nome, com a largura inteira da linha para o nome. `repo#card`, `repo#PR` ou `#cards`, e `One-Shot`, aparecem à direita em hover, no foco e na linha aberta, e só quando cabem ao lado do nome inteiro; quando não cabem, ficam no tooltip do nome. O nome nunca perde largura para eles, e eles estão sempre no nome acessível. Na linha que `Ctrl+J` abriria, a marca `Ctrl J` fica à direita em qualquer largura |
| 2 | Glifo de gravidade ou de estado; o que o item pede ou onde está, **sempre com a posição**; `+N` quando há mais de uma situação; na borda direita, o tempo |
| 3 | Só com o agente rodando: a ação em curso, em fonte monoespaçada, com o verbo primeiro, e o medidor de contexto com a porcentagem. Sem ação em curso, a palavra da atividade da conversa: `Starting session…`, `Thinking…`, `Retrying · attempt N` |

**Por tipo de item**, a posição é:

- task: a etapa como o stepper a nomeia (`PRD`, `Tech spec`, `Plan`, `Planning`, `PR`, `PR review`, `Closing`); na implementação, `Step N/M`, com o laço quando há (`Reviewer · pass 2`, `Addressing review · round 1`);
- review de PR: a passada (`Pass 1`), com o progresso de decisão ou a espera (`Pass 1 · checks 4/6`);
- discussão: `Discussing` até os primeiros rascunhos, depois a rodada (`Round 1`).

A task One-Shot tem uma marca própria no glifo de tipo, em qualquer largura.

**Por estado**:

| Estado | Glifo | Linha 2 | Borda direita | Linha 3 |
|---|---|---|---|---|
| Erro | Losango | Situação e posição (`Session error · Plan`) | Chip quadrado cheio, com `!` | — |
| Esperando o usuário | Disco cheio | Situação e posição (`Question · Step 3/7`), `+N` | Chip redondo, cheio de uma tinta âmbar, com contorno | — |
| Pronto para encerrar | Anel | Situação e posição (`Ready to close · #1279`, `Ready to archive`) | Chip redondo contornado | — |
| Agente trabalhando | Spinner, o único da linha | Posição (`Step 2/5 · Reviewer · pass 2`) | O tempo do turno, em texto | Ação e contexto |
| O app trabalhando (preparar, commitar, abrir a PR, encerrar, publicar) | Spinner | O que o app faz (`Step 3/7 · committing`) | — | — |
| Publicando (discussão) | Spinner | `Round 1 · publishing` | — | — |
| Esperando o GitHub | Círculo tracejado | `PR review · checks 3/5` | `GitHub` | — |
| Pausado | Duas barras | `Paused · <etapa>` | — | — |
| Ocioso | Círculo fino | O estado (`Published · changes requested`) | `idle` | — |

- **Os dois relógios.** O chip é o relógio do usuário: há quanto tempo o item espera por ele, da situação mais grave e, entre as de mesma gravidade, da mais antiga. O texto na borda direita da linha em que o agente trabalha é o relógio do agente: há quanto tempo ele está no turno atual. O spinner fica só no início da segunda linha. Formas diferentes, e o nome acessível diz `waiting for you` ou `agent working`.
- **Destaque.** Uma linha que espera pelo usuário tem o nome em negrito.
- **O que se lê em voz.** O nome acessível da linha é a frase inteira: tipo (`One-Shot task`), nome, cada situação com lugar e tempo, a posição, e, com o agente rodando, quem trabalha, a ação e o contexto; o meta; e, na linha que `Ctrl+J` abriria, `Ctrl+J opens this next.` Quem trabalha é `Implementer` ou `Reviewer` num step, `<Etapa> agent` numa etapa (`PRD agent`, `Plan agent`, `PR agent`), `Reviewer` num review e `Discussion agent` numa discussão.
- **Linha selecionada.** Meta e ação sobem de `--ink-4` para `--ink-3`, pelo contraste sobre o fundo selecionado.

#### A linha 2 com situação

A linha 2 fala da situação mais grave e, entre iguais, da mais antiga. A forma longa junta as partes com ` · `, e nenhuma parte repete outra. A curta tira a conversa (`Implementer`, `Reviewer`), a razão, o `% staged` e o progresso por extenso; o progresso de decisão fica, curto (`3/6`). A curta entra quando a longa não cabe. `+N` vem depois das duas.

Nas fórmulas: `N/M` é o step e o total, `<etapa>` é `PRD`, `Tech spec`, `Plan` ou `Planning`, `<conversa>` é `Implementer` ou `Reviewer`, `#P` é o número da PR, `pass K` é a passada, `a of b` o progresso de decisão e `Round R` a rodada da discussão.

| `kind` | Longa | Curta |
|---|---|---|
| `session_error`, `permission`, `question`, `reply` | `<Rótulo> · <lugar>`. Rótulo: `Session error`, `Permission`, `Question`, `Reply`. Lugar: `<etapa>`; num step, `<conversa> · Step N/M`; na PR, `PR` antes da abertura e `PR review · pass K` depois; num review, `pass K`; numa discussão, `Discussing` ou `Round R` | Sem a conversa: `Question · Step 3/7`, `Reply · PRD`, `Session error · PR review · pass 1` |
| `step_blocked` | `Step N/M blocked · <razão>` | `Step N/M blocked` |
| `worktree_unreadable` | `Can't read worktree · Step N/M` | igual |
| `plan_invalid` | `Plan still invalid · <n> problems` | `Plan still invalid` |
| `ready_to_continue` | `Ready to continue · <etapa>` | igual |
| `step_review` | `Review · Step N/M`; com stage, `Review · Step N/M · P% staged`; pronto, `Approve · Step N/M` | `Review · Step N/M`, `Approve · Step N/M` |
| `step_empty` | `No changes · Step N/M` | igual |
| `pr_blocked` | `PR blocked · <razão>` | `PR blocked` |
| `draft` | `Draft to approve · PR` | `Draft · PR` |
| `findings` (PR da task) | `Decide findings · PR review · pass K · a of b` | `Decide findings · a/b` |
| `changes_review` | `Review changes · <lugar>`; com stage, `· P% staged`; pronto, `Approve changes · <lugar>`. Lugar: `PR review` na task, `pass K` no review | Sem o `% staged` |
| `pr_trouble` | `Checks failed`, `Conflict with base` ou `Checks failed · conflict`, seguido de `PR #P` na task e de `pass K` no review | Na task, `#P` no lugar de `PR #P` |
| `pr_closed` | `PR closed unmerged · #P` | igual |
| `merge` | `Ready to merge · PR #P`; com o encerramento oferecido, `Ready to close · PR #P merged` com o merge confirmado e `Ready to close · PR #P` com a leitura falha; no review, `Ready to merge · pass K` | `Ready to merge · #P`, `Ready to close · #P` |
| `review_report` | `Decide findings · pass K · a of b`; `Ready to publish · pass K`; `Ready to apply · pass K` | `Decide findings · a/b`; as outras iguais |
| `new_commits` | `New commits · pass K` | igual |
| `pass_blocked` | `Pass blocked · pass K`, a passada que o app pediu | igual |
| `publish_failed` | `Publish failed · pass K` no review, `Publish failed · Round R` na discussão | igual |
| `drafts` | `Decide drafts · Round R · a of b` | `Decide drafts · a/b` |
| Épico que não publica, épico descartado | `Epic can't publish · Round R`, `Epic discarded · Round R` | sem a rodada |
| Pronta para arquivar | `Ready to archive · <n> published` | `Ready to archive` |

A razão de um step bloqueado vem do bloqueio do step: `worktree not clean`, `fetch failed`, `no base branch`, `path exists`, `branch exists`, `git failed`, `clone missing`. A da PR, do bloqueio da PR: `gh not installed`, `gh not signed in`, `gh failed`, `git failed`, `no worktree`. O rótulo da árvore é a palavra curta da situação; a barra do pedido, as notificações e o anúncio da região ao vivo usam o rótulo inteiro (`Waiting for reply`). Decidir apontamentos tem um nome só, `Decide findings`, na PR da task e no review. O nome acessível da linha usa o texto que a linha mostra, na forma longa.

#### A linha sem situação

Um item sem situação mostra o que roda ou onde está. A gravidade ordena esses estados depois das situações, como na seção seguinte.

| Item e estado | Glifo | Linha 2 (longa / curta) | Borda direita | Gravidade |
|---|---|---|---|---|
| Task numa etapa de planejamento, sessão trabalhando | Spinner | `<etapa>` | O relógio do turno | Agente |
| Step que o app prepara (`not_started`, `preparing`) | Spinner | `Step N/M · preparing the worktree` / `Step N/M · preparing` | — | Agente |
| Step implementando, sessão trabalhando | Spinner | `Step N/M` | O relógio | Agente |
| Step na passada do revisor, revisor trabalhando | Spinner | `Step N/M · Reviewer · pass K` / `Step N/M · pass K` | O relógio | Agente |
| Step tratando o relatório, implementador trabalhando | Spinner | `Step N/M · Addressing review · round R` / `Step N/M · round R` | O relógio | Agente |
| Step que o app commita (`committing`) | Spinner | `Step N/M · committing` | — | Agente |
| PR que o app prepara ou abre (`preparing`, `opening`) | Spinner | `PR · preparing`, `PR · opening` | — | Agente |
| PR com o rascunho sendo escrito, sessão trabalhando | Spinner | `PR · drafting` | O relógio | Agente |
| PR com a passada do review, sessão trabalhando | Spinner | `PR review · pass K` | O relógio | Agente |
| PR com as mudanças sendo commitadas | Spinner | `PR review · committing` | — | Agente |
| PR esperando os checks (`waiting_checks`) | Círculo tracejado | `PR review · checks a/b`; antes da primeira leitura, `PR review · checking GitHub`, com o brilho | `GitHub` | GitHub |
| Task que o app encerra (`closing`) | Spinner | `Closing` | — | Agente |
| Review, passada rodando | Spinner | `Pass K` | O relógio | Agente |
| Review esperando os checks | Círculo tracejado | `Pass K · checks a/b` | `GitHub` | GitHub |
| Review aplicando os aprovados (`applying`) | Spinner | `Pass K · applying` | O relógio | Agente |
| Review que o app commita | Spinner | `Pass K · committing` | — | Agente |
| Review publicado | Círculo fino | `Published · approved`, `Published · changes requested`, `Published · commented` | `idle` | Ocioso |
| Discussão, sessão trabalhando | Spinner | `Discussing` ou `Round R` | O relógio | Agente |
| Discussão publicando | Spinner | `Round R · publishing` / `publishing` | — | Agente |
| Qualquer um dos acima com a sessão pausada | Duas barras | `Paused · <posição>` | — | Pausado |
| Sessão ociosa, sem turno | Círculo fino | A posição | `idle` | Ocioso |
| Sessão com erro sem situação | Círculo fino | `Session stopped · <posição>` | `idle` | Ocioso |

O spinner do app é o mesmo do agente (`principles.md` §8), sem relógio e sem linha 3, e o nome acessível diz `working`, não `agent working`. Com duas conversas do mesmo item trabalhando, a linha fala da que está no turno mais antigo. O erro de uma sessão sem situação fica no cinza da árvore, porque a cor de atenção vem só das situações; a aba e a conversa dela o mostram como erro.

### Gravidade e ordem

- Erro > esperando > encerramento. Depois, sem situação: agente > GitHub > pausado > ocioso.
- A cor de atenção vem só das situações. Uma sessão com erro sem situação aparece como erro na aba e na conversa dela, nunca no cinza do ocioso.
- **Portadores do erro**, nenhum deles só cor: o losango, o chip quadrado com `!` e um trilho na borda esquerda da linha. O trilho marca o erro em todo lugar: linha, faixa recolhida, barra do pedido, bloco de erro da conversa, aviso do app.
- **`Ctrl+J`** abre o primeiro item que espera, fora o aberto: o mais grave, depois a espera mais antiga. O resto é como em "Chegar a uma situação", na seção 1. O `Ctrl+J` e a marca ignoram o filtro por repositório; abrir um item que o filtro esconde, por `Ctrl+J`, pela notificação ou por qualquer outro caminho, volta o filtro a **All repositories**, porque a linha do lugar aberto está sempre à vista.

### Situação nova

- **Janela fora de foco:** a notificação do sistema, com o som, uma vez por situação, com um texto por situação (`screens/rest.md`). O clique leva como na seção 1.
- **Janela em foco:** a situação pisca brevemente e em silêncio onde é visível. Pode piscar:
  - a linha na árvore (ou o bloco na faixa recolhida, ou o resumo do nó recolhido que a contém);
  - a aba, quando a situação é da outra conversa do item aberto;
  - a barra do pedido ou o cartão, quando nascem no item aberto.

  Com `prefers-reduced-motion`, não há piscada. O chip `now` e o anúncio bastam.
- **Anúncio.** Uma região `aria-live="polite"` do app anuncia cada situação nova uma vez, ao começar: o item, o que pede e onde (`Rate limit per API key: question in Reviewer`). A barra do pedido tem um texto de estado (`role="status"`) que anuncia quando ela aparece ou muda sozinha no item aberto. Não é anunciada quando aparece porque o usuário abriu o item, porque aí o foco já está nela. As mudanças de gravidade da árvore não são anunciadas linha a linha. Continuações da mesma espera (o stage chegar a 100%, a razão dos checks mudar) não piscam nem são anunciadas, como não notificam.

### Nós recolhidos

Um nó recolhido mostra à direita um glifo e uma contagem por estado, do mais grave ao menos grave. O mais grave vem nomeado (`◆1 error ●2 ◎1 ◌1`). O nome acessível lista todos. Recolher nunca esconde que algo depende do usuário. O recolhido é lembrado entre execuções.

### A faixa recolhida

`«` recolhe a lateral numa faixa de 60 px, e `»` a expande. Cada item vira um bloco, na ordem da árvore:

- o glifo de tipo, com o de estado no canto;
- embaixo, o chip de espera (com as formas da linha) ou o tempo do turno. Na falta dos dois, a palavra do estado (`checks`, `paused`, `idle`);
- `+N` quando há mais de uma situação;
- o trilho no erro.

Entre os grupos, um separador leva o `◇` da falha de leitura ou do clone, e, em Reviews, a contagem de PRs pendentes. O nome acessível de cada bloco é o da linha inteira. O rodapé fica em coluna.

### O filtro

É um seletor com **All repositories** e um item por repositório, em ordem alfabética, com `· clone missing` ou `· not cloned` quando for o caso. O filtro restringe as tasks e os avisos de clone da árvore, e a lista do History, onde aparece como um chip removível. Reviews e discussões ficam na árvore. Um repositório sem tasks mostra `No tasks in <repo>.` A escolha é lembrada entre execuções.

### O rodapé

**History**, com a contagem de tasks, reviews e discussões arquivados; o tema (System, Light, Dark, em ciclo), que só existe aqui; e **Settings**. **History** e **Settings** ficam pressionados enquanto o lugar deles, ou um arquivado, está aberto.

## 3. Área principal com um item aberto

Task, review de PR e discussão têm a mesma forma, e a tela da task é a referência (`screens/task.md` §2). De cima para baixo:

- **o cabeçalho**, uma faixa com um fio embaixo;
- **as abas `Implementer` e `Reviewer`**, só num step `Agent`, da primeira passada do revisor até o commit;
- **a conversa do lugar atual**, que rola;
- **a barra do pedido**, enquanto o item pede algo;
- **o compositor**, enquanto a conversa na tela existe.

Todo o resto fica fechado, nos painéis ou no menu `⋯`. Um painel aberto fica à direita.

### Cabeçalho

`←`, `→` (só com destino), o breadcrumb, o título do item, o progresso, e à direita:

- o medidor de contexto, só com uma sessão na tela;
- **Pause** ou **Resume**, só aqui;
- o grupo dos painéis do item;
- `⋯`.

**O progresso.** Na task, o **stepper**: as etapas nomeadas, a feita com o visto, a atual como pílula com a posição (`Implementation 3/7 · pass 2`) e o glifo do estado, a futura com o círculo, sem trilha inteira nem tempos (`screens/task.md` §4). No review e na discussão, a **pílula** sozinha: `Pass 1`, `Discussing`, `Round N` (`review.md` §4, `discussion.md` §3). O progresso não tem ação.

**Largura.** O topo cede pela largura da área principal, em limites fixos: primeiro o que fica em volta do progresso (o breadcrumb dobra, os painéis ficam só com o ícone, **Pause** só com o ícone, o medidor só com a porcentagem), depois as etapas feitas, depois o laço e a palavra da pílula, por último os nomes das futuras; o nome da etapa atual nunca sai. O título cede depois de tudo. Os limites estão em `screens/task.md` §3. Na metade do monitor, o stepper ainda nomeia a atual e as futuras.

**O `⋯`** tem as ferramentas do item e as ações raras e destrutivas, agrupadas por assunto, com o destrutivo por último, em vermelho: na task, as do step (**Review myself**, **Open in VS Code**, **Discard step N…**), as da PR (**Open PR**, **Refresh PR**, **Review again**, que na task pede a passada sem diálogo), as do planejamento e da task (**Review mode ›**, **Models ›**, **Back to <etapa>…**, **Discard and restart the <etapa>…**, **Delete task…**); no review, **Open PR**, **Refresh PR**, **Open in VS Code**, **Review again…** e **Delete review…**; na discussão, **Open <board>**, **Group drafts into an epic…**, **Archive…** e **Delete discussion…**. Cada destrutiva diz antes o que será perdido. Um item desabilitado diz por quê ao lado. O conteúdo exato está no documento de cada tela.

### A situação é dita uma vez

Enquanto o item tem uma situação, o topo e o cartão não a repetem: a pílula mostra só o glifo e a posição, e a palavra fica no nome acessível. O glifo, o rótulo, o tempo e a ação da situação ficam na barra do pedido. Sem situação, a pílula diz o que roda: `working`, `checks 3/5`, `publishing`, `paused`.

### Abas `Implementer` e `Reviewer`

Duas abas de texto sobre um fio, cada uma com o glifo da sua sessão. A escolhida é sublinhada. A de fora diz a palavra só quando espera ou falhou (`Implementer · waits`, `Reviewer · error`), com o que pede e o tempo no tooltip e no nome acessível. A aba não tem chip de tempo. Abre a conversa de quem tem a vez; com as duas esperando, a do pedido mais antigo. O produto nunca troca de aba sozinho (`screens/task.md` §5).

### A conversa

- É uma coluna centrada de `--measure-conversation` (960 px), e tudo o que está nela, a barra do pedido, o compositor e as abas têm as mesmas bordas. Numa área principal mais estreita, a coluna ocupa a área menos `--space-6` de cada lado. A largura que sobra fica dos lados.
- Reúne as falas do agente, as mensagens do usuário e as da fila, os grupos de ações dobrados (rotulados pela descrição que o agente escreveu, com o subagente aninhado), a atividade, os marcos, os cartões e os blocos de erro.
- **Marcos.** Os eventos do workflow e as mensagens do produto são marcos de uma linha, que abrem o conteúdo no lugar: etapa ou step iniciado com a instrução, documento escrito, relatório escrito, mensagem do produto ao agente, commit, PR aberta, merge, checks lidos, decisões do usuário, publicação, rodadas. Uma rodada ou um cartão substituído dobra num marco.
- **Cartões.** O que o usuário responde ou decide mora na conversa, num cartão: a pergunta e a permissão (com anel âmbar e barra quieta); os arquivos de um step `Manual`, os apontamentos de um review e os rascunhos de uma discussão (cartões neutros, com a barra do pedido tingida como barra de decisão); o rascunho da PR, editável. Não há coluna de decisão.
- Abre no fim e nunca rola para cima sozinha. Enquanto o usuário está no fim, ela acompanha o que chega. Fora do fim, um botão flutuante logo acima da barra do pedido volta ao fim; ele diz `New messages` quando algo chegou e leva a ação em curso, e some no fim.
- Um bloco de erro diz a razão e o detalhe (a saída do git, o código de saída), e marca o erro pelo trilho. Não tem botão: a ação fica na barra do pedido.
- **Sem conversa ainda** (a PR antes da primeira passada, o step bloqueado antes de abrir), o lugar mostra o vazio que diz o que espera (`The review starts when the checks finish.`, com os checks pelo nome) ou o bloco de erro.
- **Conversas anteriores.** Voltar a uma conversa de outra etapa ou de outro step não acontece na tela: as conversas e os relatórios anteriores ficam em `Details`. Aberta de lá, a conversa anterior toma o lugar da atual, somente leitura, com uma faixa no lugar do compositor e a volta ao lugar atual; `Esc` volta.

### A barra do pedido

Fica acima do compositor, na medida da conversa. É o lugar em que **todo** item diz o que pede. Existe só enquanto o item pede algo.

- **À esquerda:** o glifo, o rótulo da situação, o lugar e o chip do tempo.
- **No meio:** o progresso (`1 of 4 decided`, `5 of 7 files staged · 71%`), nunca a razão que o bloco de erro já diz.
- **À direita:** a ação que resolve.

Tem quatro formas: **quieta**, quando um cartão na conversa tem o conteúdo e a resposta (só **Show**, que leva ao cartão); **tingida**, quando o pedido não tem cartão com ação própria (a barra tem a ação, e na decisão de apontamentos e rascunhos, **Next to decide** `Alt ↓` e a primária tracejada com o que falta); **erro**, com o trilho; e **encerramento** (`Ready to close`, `Ready to archive`).

| Situação (`kind`) | A barra diz | Ação |
|---|---|---|
| `question`, `permission` | O tipo e o lugar | **Show**. A resposta fica no cartão |
| `reply` | `Waiting for reply` e o lugar | Nenhuma: a resposta vai pelo compositor, com a resposta rápida |
| `session_error` | O erro e o lugar | **Retry** da sessão que caiu (`Retry reviewer`) |
| `step_blocked` | A razão (`worktree not clean`, clone ausente…) | **Try again**, **Clean and start…**; **Change path** com o clone ausente |
| `worktree_unreadable` | `Can't read worktree` e a razão | Nenhuma: resolve sozinho |
| `pr_blocked` | A razão do `gh` ou do git | **Try again** |
| `plan_invalid` | `Plan still invalid` e o número de problemas | Nenhuma: a correção vai pelo compositor, ou **Discard and restart the plan…** no `⋯` |
| `ready_to_continue` | Que a etapa revisitada está pronta | **Continue** |
| `step_review`, `changes_review` | O progresso de stage | **Open in VS Code**, **Approve** com o que falta |
| `step_empty` | `Step N has no changes` | **Discard step N…**; ou pedir uma mudança pelo compositor |
| `draft` | Que o rascunho da PR espera o OK | **Approve draft**, **Discard draft** |
| `findings` (PR da task e review) | `Decide findings · <lugar> · pass N` e o progresso | **Next to decide**; **Apply approved** ou **Publish review…** com o que falta |
| `review_report` pronto | `Ready to publish` ou `Ready to apply` | **Publish review…** ou **Apply approved** |
| `new_commits`, `pass_blocked` | A razão, os checks pelo nome e o conflito | **Review again…** |
| `pr_trouble` | `Checks failed`, `Conflict with base`, os checks pelo nome | **Review again** |
| `publish_failed` | A razão | No review, **Publish review**. Na discussão, **Show** leva ao rascunho em que a publicação parou |
| `drafts` | `Decide drafts · round N` e o progresso | **Next to decide** |
| Épico que não publica, épico descartado (discussão) | O que falta (`approve one more, or discard the epic`) | **Show**, que leva ao épico |
| Rascunhos ilegíveis (discussão) | `Waiting for the drafts` | Nenhuma: vai pelo compositor, com **Ask to fix the drafts** |
| `pr_closed` | `PR closed unmerged` | **Delete task…** |
| `merge` | `Ready to merge`, depois `Ready to close` e o que o encerramento faz | **Open PR**, depois **Close task** |
| Pronta para arquivar (discussão) | `Ready to archive` e o que foi publicado | **Archive…** |

**Único lugar da ação e as exceções.** A ação que resolve uma situação fica na barra do pedido e em nenhum outro lugar da tela. As exceções são três, cada uma por uma razão:

- **Ação de uma parte de um cartão.** Ela fica na parte, porque age só sobre ela: **Retry** de uma publicação que falhou, no rascunho em que ela parou; a decisão de cada apontamento e de cada rascunho. A barra do pedido leva até a parte (**Show**, **Next to decide**) e não repete a ação.
- **Ferramenta do item disponível a qualquer momento que também resolve uma situação.** **Discard step N…**, **Discard draft**, **Delete task…**, **Review again** (na task; **Review again…** no review) e **Archive…** ficam no `⋯`, porque existem fora de qualquer situação. Quando uma delas é a saída de uma situação (`step_empty`, `draft`, `pr_closed`, `new_commits`, pronta para arquivar), a barra do pedido a repete, porque é para lá que o olho do usuário vai.
- **Pausar e retomar.** **Pause** e **Resume** ficam só no cabeçalho. Um item pausado não espera por ninguém: não tem situação, não notifica e fica fora do `Ctrl+J`. A barra do pedido continua com o que o estado do item pede e com a ação (aprovar, continuar, abrir a PR, encerrar), na forma quieta, com as duas barras no lugar do glifo e sem o chip de tempo, porque a espera não conta; a ação retoma a sessão, como hoje. A pílula diz `paused`, o marco `Paused by you` diz desde quando, e o compositor diz que enviar retoma.

**Mais de uma situação.** A barra fala da conversa em tela. A outra está na aba dela. Se só a outra conversa espera, a barra diz isso e leva até lá (**Go to reviewer**).

**Botões desabilitados.** Um botão desabilitado, na barra ou em qualquer lugar, tem borda tracejada, também o fantasma, que em repouso não tem borda. A razão fica ao lado, e `aria-describedby` aponta para ela.

**Papel.** A barra é `role="region"` com nome acessível. O texto de estado dela é `role="status"` (seção 2, Situação nova).

### O compositor

Embaixo da conversa, na mesma medida. Existe sempre que a conversa na tela existe; sem sessão ainda, sai. Tem:

- **A caixa de texto.** O placeholder diz a quem se responde e como (`Answer with 1–3, or reply to the reviewer…`, `Queue a message for the implementer…`, `Sending resumes the task…`).
- **As pastilhas**, quando há: a resposta rápida a uma pergunta em texto com opções, e os começos de mensagem (**Ask for changes**, **Ask to fix the drafts**).
- **O seletor de modelo e esforço da sessão** (`Opus · high ▾`), que vale a partir da próxima mensagem. A resposta em andamento termina com a escolha anterior. Um modelo sem esforço mostra só o nome. Uma escolha que o catálogo não tem mais aparece marcada como indisponível.
- **Send**, ou, com o agente trabalhando, o relógio do turno e **Stop**, que interrompe a resposta e mantém a sessão. Uma mensagem enviada com o agente ocupado entra na fila, que aparece na conversa, no fim, com **Remove**.
- **Estados.** Com a sessão pausada, o compositor diz que enviar retoma. Numa conversa em que o produto não age mais (o revisor depois de **Review myself**), ele continua aceitando mensagens.

### Painéis auxiliares

`Details`, `Artifacts` e `Card` na task; `Details` e `Reports` no review; `Details` e `Documents` na discussão. Todos seguem as mesmas regras:

- fechados por padrão e nunca abertos sozinhos;
- um de cada vez, pelo grupo do cabeçalho;
- `Esc` fecha.

O que cada um mostra:

- **`Details`** mostra os fatos do item e o que ficou para trás:
  - task: os steps (commitados com o SHA, as conversas e os relatórios de cada um; o atual; os não iniciados com os seletores de modo e de modelo), as conversas do planejamento, a PR (a conversa do rascunho, o número, a base, os checks pelo nome, a última leitura), e os fatos da task (repositório com o clone, card, épico, modo, **Review mode** e **Models**, branch, base, worktree, início);
  - review: a PR, os checks lidos antes de cada passada, as passadas com o estado, e o modo, o modelo e a worktree;
  - discussão: o board, os cards de entrada, os repositórios lidos, as rodadas e os documentos.

  Nunca repete o stepper nem a barra do pedido.
- **`Artifacts`**: o PRD e o tech spec (ou o documento One-Shot), os arquivos de step e o rascunho da PR, cada um renderizado.
- **`Card`**: o card do board, com o épico, as dependências e os irmãos.
- **`Reports`**: `Context` e os relatórios de todas as passadas, com o veredito e o link do que foi publicado.
- **`Documents`**: `Context` e o documento da discussão.

**Regra de largura.** O painel vira coluna quando a coluna de leitura ainda cabe inteira ao lado dele:

```
área principal − painel ≥ 760 px
```

O painel usa `clamp(360px, 28% da área principal, 480px)`, arredondado para baixo ao pixel. Quando a regra não vale, o painel cobre a conversa, com sombra, e `Esc` fecha. Isso muda por volta de 1450 px de janela.

### Faixas de aviso

Sob o cabeçalho, na medida da conversa, quando algo bloqueia sem ser a situação do item: o clone inexistente, com **Change path…**; `Couldn't check GitHub` num review, com **Try again**. Afundada, com `◇`, nunca vermelha, nunca uma situação. A conversa passa por baixo com o esmaecido.

## 4. Outros lugares

- **Board** (`screens/board.md` §3): o cabeçalho tem a idade da leitura, **Refresh**, **New discussion** `N` e `⋯` (**Select cards to discuss**, **Open on GitHub**, **Edit the board in Settings…**). Não tem **Start task**: uma task começa de um card. Abaixo, a busca e os filtros (o chip **Assigned to me**, os filtros ativos como chips, o menu **Filter**), e a lista agrupada pelas seções de status do board, na ordem dele, com as finais recolhidas. A linha do card mostra só o que decide a escolha: o número, o título, o épico, a dependência não satisfeita e a task (com a situação real) ou a discussão do card; as teclas `S` e `D` aparecem na linha em foco. O card abre num painel ao lado da lista, que é o único lugar de **Start task** e **Discuss** fora das teclas; o repositório sem clone aparece lá (**Clone and continue**) e na Home. A seleção de cards para uma discussão é um modo, pelo `⋯` ou por `Space`. A falha de leitura é uma faixa no alto da lista, com **Try again**, sobre a leitura guardada.
- **Reviews** (`review.md` §2): a lista das PRs abertas, agrupada em `Pending`, `In review`, `Reviewed` e `Yours and your tasks`, as duas últimas recolhidas. A linha mostra a referência, o título, o autor e o estado que importa; `R` inicia o review, abre o que existe ou a task dona. A PR abre num painel com a ação, os checks pelo nome, os fatos e a descrição. Os filtros ficam no menu **Filter** (Board, Repository, Author, Label). A falha de leitura de um repositório é uma faixa no alto da lista.
- **History** (`rest.md` §3 e §4): uma lista só, por data de arquivamento, com os dias como seção, a busca no alto (onde o foco começa) e a contagem, e o filtro da lateral aplicado como chip removível. A linha tem o tipo, o nome, onde (card, PR ou board), o resultado e a hora. A linha recém-arquivada fica destacada quando se chega pela página do item que saiu. O arquivado é um lugar, com `← History`, o tipo, o título, a etiqueta e **Delete…** no `⋯`: a task com os fatos, o resultado do encerramento e as abas dos documentos (a aba **Pull request** com o rascunho e os relatórios do review), o review com cada passada, a discussão com o que publicou primeiro. Nada roda num arquivado, e apagá-lo volta ao History.
- **Settings** (`rest.md`): a navegação à esquerda com quatro páginas, **Defaults** (o modo de review e os modelos por etapa), **Boards**, **Repositories** (o que precisa de clone primeiro, depois os repositórios por board) e **Prompts** (a lista dos nove, com `Default` ou `Edited`, e cada prompt aberto na mesma página, com a edição). Cada página tem o título, uma frase do que ela serve e, quando há, a ação dela, secundária: Settings não pede nada, então não tem primária. Tudo em Defaults salva na hora. Não há página de aparência: o tema fica no rodapé da lateral. Abaixo de cerca de 820 px de área principal, a navegação vira uma linha acima da página.

## 5. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `Ctrl+N` | Qualquer lugar | Nova task (o diálogo livre) |
| `Ctrl+J` | Qualquer lugar | Abre o próximo item que espera, no lugar da situação, com o foco no que ele pede (seção 1) |
| `Ctrl+,` | Qualquer lugar, as boas-vindas incluídas | Abre ou fecha Settings |
| `Alt+←`, `Alt+→` | Qualquer lugar | Volta e avança no histórico |
| `Esc` | Qualquer lugar | Fecha o `listbox`, o menu, o popover, o diálogo, a edição, o painel, sai de uma conversa anterior e fecha Settings, nesta ordem |
| ↑↓ ←→ `Home` `End` `Enter` | Árvore | Percorre, recolhe e expande, abre |
| `Enter` | Home | Abre **Continue** |
| ↑↓ `Home` `End` | Lista (board, Reviews, History) | Percorrem as linhas e os cabeçalhos visíveis |
| ←→ | Lista do board e de Reviews | Recolhem e expandem a seção |
| `Enter` | Lista do board e de Reviews | Abre ou fecha o painel; num cabeçalho, recolhe ou expande |
| `/` | Board, History | Foca a busca; `↓` volta à lista |
| `S` | Linha do card | **Start task** ou **Clone and continue**; onde não age, diz por quê |
| `D` | Lista do board | Discussão com a seleção, ou com o card do foco |
| `N` | Visão do board, fora de um campo | **New discussion**, sem cards |
| `Space` | Linha do card | Entra no modo de seleção e marca, ou alterna |
| `R` | Linha da PR | **Start review**, **Open review** ou **Open task** |
| `O` | Linha da PR, apontamento | Abre a PR no GitHub; no apontamento, em `Files changed`, na linha |
| ←→ | Abas `Implementer` e `Reviewer` | Trocam de aba |
| 1–9 | Cartão de pergunta ou de permissão | Responde |
| `A`, `D` | Apontamento ou rascunho em foco | Aprova, descarta. No apontamento, e no rascunho quando o gesto não publica, leva ao próximo por decidir. No rascunho, ignorado por 900 ms depois de avançar e na repetição da tecla |
| `E` | Apontamento ou rascunho em foco | Edita |
| `Enter`, ↑↓ | Lista dos rascunhos | Abrem o rascunho dobrado, vão ao anterior e ao próximo |
| `Alt+↓`, `Alt+↑` | Item com apontamentos ou rascunhos a decidir | Próximo e anterior por decidir |
| `Ctrl+E` | Item com worktree; apontamento em foco | **Open in VS Code**; no apontamento, na linha |
| `Ctrl+Enter` | Diálogos; barra de decisão | Confirma o diálogo; na barra ou no cartão, abre a publicação |
| 1–3 | Diálogo de publicação | Escolhem o veredito |
| `Enter`, `Shift+Enter` | Compositor | Envia, quebra a linha |
| `Ctrl+S` | Editor de prompt | Salva |
| `Enter` | Passo da URL do board; início que falhou | Lê o board; **Try again** |
| ↑↓ | Navegação de Settings | Troca de página |
| ←→ | Controle segmentado | Troca a escolha |

`Cmd` vale no lugar de `Ctrl`. Os atalhos globais ficam inertes com os diálogos de criação abertos. As teclas de uma letra valem só fora de um campo de texto.

**Ordem de Tab:** topo da lateral, filtro, árvore (uma parada), rodapé, cabeçalho (navegação, breadcrumb, progresso, ferramentas), abas, faixa de aviso, conversa (cada cartão é uma parada), barra do pedido, compositor, painel. Nas listas: cabeçalho, barra de filtros, a lista (uma parada), o painel.

## 6. Larguras

O design funciona de 1100 a 2600 px, sem pontos fixos de janela. Cada regra depende da largura do próprio contêiner.

| Onde | Regra |
|---|---|
| Lateral | `clamp(288px, 8vw + 200px, 380px)`: 288 px a 1100, 300 a 1250, 380 a partir de cerca de 2250. Recolhida, 60 px |
| Linha da árvore | Lateral abaixo de 330 px: o meta sai, os rótulos passam à forma curta e o medidor fica só com a porcentagem. A posição nunca sai. A ação passa à forma curta sempre que a longa não cabe: o verbo primeiro; de um caminho, `…/` e o último segmento; de um comando, o executável, o subcomando e o último segmento do primeiro caminho, sem as flags (`Running go test …/ratelimit`) |
| Cabeçalho do item | Cede em ordem, pelos limites de `screens/task.md` §3 (1660, 1440, 1360, 1300, 1200, 1040 e 900 px de área principal) |
| Conversa | `--measure-conversation` (960 px), centrada em pixel inteiro; numa área mais estreita, a área menos `--space-6` de cada lado |
| Painéis do item | A regra da seção 3 |
| Lista do board e de Reviews | 70rem centrada. Abaixo de 1040 px de lista, o que não é número, título e teclas desce para uma segunda linha; o título tem sempre um terço da linha. O painel da lista (`clamp(360px, 42%, 640px)`) fica ao lado enquanto a lista mantém 440 px |
| Lista do History | As colunas até 860 px de lista; abaixo, onde e o resultado descem para a segunda linha |
| Settings | A navegação à esquerda; abaixo de cerca de 820 px de área principal, uma linha acima da página |
| Diálogos | O mínimo em 480 px, o largo em 544 px, os dois a `8vh` do topo, crescendo para baixo |
| Barras | Quebram em duas linhas antes de esconder uma ação |

## 7. Estados de toda tela

| Estado | Onde aparece |
|---|---|
| Início do app | A lateral em esqueleto e, na área principal, `Starting MySpec…` com os passos que bloqueiam a primeira tela, nomeados enquanto rodam. Um passo lento mostra o tempo e a razão. Uma falha mostra o erro copiável, o que fazer e **Try again**, com a lateral parada. Nunca uma janela em branco |
| Migração recusada | **MySpec couldn't be updated**, na janela inteira, sem a lateral, com os casos por tipo, o que fazer e **Copy the list** |
| Nada cadastrado | Boas-vindas, com **Add board** (com o foco) e **Add repository**, e o bloco `This machine` só quando falta algo na máquina (Claude Code, o `gh`, o login do `gh`), com o comando copiável. A lateral só tem o topo e o rodapé: **New** e **History** tracejados com a razão, o tema e **Settings** funcionando |
| Nenhum item ativo | Home com `Nothing in progress` e as ações de início |
| Nada aberto | Home com **Continue** |
| Primeira leitura do GitHub | A árvore local completa. `reading…` nos nós de board e em Reviews. `PR review · checking GitHub` na linha que depende dela. A Home e as listas dizem o que está sendo lido; uma lista nunca lida mostra o esqueleto |
| Falha de leitura | `◇ Read failed` no nó (razão no tooltip), a faixa no alto da lista com **Try again** sobre a leitura guardada, a linha na Home. Num review, `Couldn't check GitHub` sob o cabeçalho. Nunca uma situação, nunca vermelha |
| Clone inexistente | O item `◇` na árvore, a faixa na task afetada, a Home, o filtro e Settings › Repositories |
| Repositório sem clone | Onde uma task seria criada: o painel do card com **Clone and continue**, a Home, o filtro, Settings › Repositories |
| Item esperando o usuário | A linha, a aba, a pílula e a barra do pedido. Ao nascer, a notificação ou a piscada, e o anúncio |
| Erro de um item | O mesmo, com os três portadores do erro e o bloco de erro na conversa |
| Agente trabalhando | As linhas 2 e 3 da árvore, a pílula com `working`, o grupo vivo na conversa, o relógio do turno, **Stop** e a fila no compositor |
| Esperando o GitHub | A linha, a pílula com `checks N/M` e o bloco na conversa com os checks pelo nome. Antes da primeira passada, o vazio diz que a conversa começa quando os checks terminam, sem compositor |
| Pausado, ocioso | Glifos e rótulos diferentes. A pílula neutra diz `paused`, a barra do pedido fica quieta com o que o estado pede, sem chip de tempo, o marco `Paused by you` diz desde quando, e o compositor diz que enviar retoma. Ocioso: a próxima mensagem retoma sem aviso |
| Item que saiu enquanto aberto | A página da seção 1 |
| Item que saiu sem estar aberto | Um toast para a task, o review ou a discussão, com o resultado curto e **Open in History** |
| Aviso do app | Uma ação sem lugar próprio que falhou: uma faixa no topo da área principal, com o trilho de erro, o rótulo com a ação (`Couldn't pause Rate limit per API key`) e o que fazer, até ser dispensada. Uma por vez |
| Vazios | `No active items.` num board, `No review in progress.`, `No tasks in <repo>.`, `No artifacts yet`, e o estado vazio de cada lista, com o que faria algo aparecer e a ação |
| Muitos itens na árvore | A árvore rola. O item aberto é trazido à vista. Os nós recolhem com resumo |
| Muitos itens fora da árvore | A conversa longa fica legível pelos grupos dobrados e pelos marcos, e é virtualizada acima de algumas centenas de entradas. O board, com até 2.000 issues, rola com as seções finais recolhidas e é virtualizado se passar de algumas centenas de linhas visíveis. O History carrega os últimos 90 dias e busca os mais antigos quando a busca pede ou a rolagem chega ao fim |

## 8. Dados

Os dados que a experiência pede e o backend ainda não expõe estão em `backend.md`, deduplicados entre as telas e agrupados por custo. Fica fora: custo em tokens e dólares, e duração de task, etapa e step (`decisions.md`).
