# Estrutura

Fase 2. A arquitetura de informação e o modelo de navegação do MySpec. O designer e o crítico leem este documento antes de qualquer rodada de tela, junto do `brief.md`. Ele não fixa visual: cor, tipografia, ícones e espaçamento são da fase 3. A referência visual é o wireframe `lab/03-structure-final/a.html`.

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

  Não há camadas nem modais de lugar. Os diálogos (criação de task, início de review, criação de discussão, cadastros) continuam diálogos.
- **Item aberto.** Abrir um item é ir a um lugar. A linha dele na árvore fica selecionada (`aria-current="page"`) e, se estava fora da vista, a árvore rola até ela e abre os nós que a escondiam.
- **Histórico.** Toda ida a um lugar entra numa pilha. `←` e `→` no cabeçalho, ou `Alt+←` e `Alt+→`, percorrem a pilha. O `←` diz para onde volta, no tooltip. Ir a um lugar novo limpa o que estava à frente.
- **Breadcrumb.** No cabeçalho, depois de `←` e `→`: `board › épico › item`, `Reviews › review`, ou `No board › item`. Cada nível clicável abre o seu lugar. Com o nome vêm o glifo de tipo, `repo#card` (ou `repo#PR · autor`) e a etiqueta `One-Shot`. Abaixo de 900 px de área principal, o breadcrumb fica só com o item.
- **Settings e History** são lugares como os outros. Settings abre pelo rodapé ou por `Ctrl+,`. Fechar Settings (`Esc`, **Close**, `Ctrl+,` de novo) volta ao lugar anterior, nunca a Home.
- **Home** é o lugar sem nada aberto. Tem:
  - **Continue**, com o último item aberto e o que ele pede ou onde está. Recebe o foco, então `Enter` o abre;
  - as três ações de início: nova task, review de PR, nova discussão;
  - os boards e os repositórios, com o estado da leitura, a falha e o clone;
  - os atalhos.

  Home não lista o que espera pelo usuário: isso é da árvore.
- **Um item que sai do estado enquanto está aberto** (encerrado, review terminado pelo merge, apagado) dá lugar a uma página que diz o que aconteceu e o resultado. O resultado do encerramento vem com o que foi feito. No apagamento, vem o que ficou no disco e o que fazer. A página oferece **Open in History** (menos no apagado), a volta ao lugar anterior e **Next that needs you**. Nunca uma área vazia. Um item que sai sem estar aberto gera só um aviso momentâneo.

## 2. Barra lateral

De cima para baixo:

- o nome do produto, **+ New ▾** (nova task, review de PR, nova discussão) e `«` para recolher;
- o filtro por repositório;
- a árvore;
- o rodapé.

A largura é contínua: `clamp(288px, 8vw + 200px, 380px)`.

### A árvore

- **Ordem.** Primeiro **Reviews**, com `N pending` e os reviews ativos. Depois um nó por board, em ordem alfabética: os épicos primeiro, com as tasks dentro, depois as tasks sem épico, depois as discussões do board. Por último **No board**, só quando tem algo: as tasks livres, as de repositórios sem board, as discussões de um board removido e os avisos de clone. Dentro de cada nó, a ordem é a de criação. A árvore nunca reordena sozinha. Quem diz o que é mais urgente é a gravidade e a marca `Ctrl J`.
- **Nó de board.** O título abre a visão do board. À direita, o nó mostra `reading…` durante uma leitura, ou `◇ Read failed` com a razão no tooltip. Um board sem itens mostra `No active items.`
- **Aviso de clone inexistente.** É um item da árvore (`treeitem`) sob o nó do repositório, com `◇ <repo> · clone missing`. `Enter` muda o caminho. O `◇` marca o que bloqueia trabalho sem ser uma situação. Nunca se confunde com o erro de um item.
- **Papel e teclado.** A árvore é `role="tree"`, com um só ponto de Tab (roving tabindex). ↑↓ percorrem o que está visível. `Home` e `End` vão às pontas. → expande um nó ou entra nele. ← recolhe o nó ou sobe ao pai. `Enter` abre.

### A linha de um item

Duas linhas, e uma terceira só enquanto o agente trabalha.

| Linha | Conteúdo |
|---|---|
| 1 | Glifo de tipo e nome, com a largura inteira da linha para o nome. À direita, com a lateral larga: `repo#card`, `repo#PR` ou `#cards`, e `One-Shot`. Na linha que `Ctrl+J` abriria, a marca `Ctrl J` toma esse lugar em qualquer largura |
| 2 | Glifo de gravidade ou de estado; o que o item pede ou onde está, **sempre com a posição**; `+N` quando há mais de uma situação; na borda direita, o tempo |
| 3 | Só com o agente rodando: a ação em curso, em fonte monoespaçada, com o verbo primeiro, e o medidor de contexto com a porcentagem |

**Por tipo de item**, a posição é:

- task: a etapa; na implementação, `Step N/M` e o estado do step (`Reviewer pass 2`); na PR, `PR review · checks 3/5`, `PR #1279 merged`;
- review de PR: a passada e o progresso de decisão (`pass 1 · 5/9`);
- discussão: o estado (`Discussing`, `Decide drafts · 3/6`).

A task One-Shot tem uma marca própria no glifo de tipo, em qualquer largura.

**Por estado**:

| Estado | Glifo | Linha 2 | Borda direita | Linha 3 |
|---|---|---|---|---|
| Erro | Losango | Situação e posição (`Session error · Plan`) | Chip quadrado cheio, com `!` | — |
| Esperando o usuário | Disco cheio | Situação e posição (`Question · Step 3/7`), `+N` | Chip redondo cheio | — |
| Pronto para encerrar | Anel | Situação e posição (`Ready to close · #1279`) | Chip redondo contornado | — |
| Agente trabalhando | Spinner | Posição (`Step 2/5 · Reviewer pass 2`) | Spinner pequeno e o tempo do turno, em texto | Ação e contexto |
| Esperando o GitHub | Círculo tracejado | `PR review · checks 3/5` | `GitHub` | — |
| Pausado | Duas barras | `Paused · <etapa>` | — | — |
| Ocioso | Círculo fino | O estado (`Published · changes requested`) | `idle` | — |

- **Os dois relógios.** O chip é o relógio do usuário: há quanto tempo o item espera por ele, da situação mais grave e, entre as de mesma gravidade, da mais antiga. O texto depois do spinner é o relógio do agente: há quanto tempo ele está no turno atual. Formas diferentes, e o nome acessível diz `waiting for you` ou `agent working`.
- **Destaque.** Uma linha que espera pelo usuário tem o nome em negrito.
- **O que se lê em voz.** O nome acessível da linha é a frase inteira: tipo (`One-Shot task`), nome, cada situação com lugar e tempo, a posição, e, com o agente rodando, quem trabalha, a ação e o contexto.
- **Linha selecionada.** Meta e ação sobem de `--ink-4` para `--ink-3`, pelo contraste sobre o fundo selecionado.

### Gravidade e ordem

- Erro > esperando > encerramento. Depois, sem situação: agente > GitHub > pausado > ocioso.
- A cor de atenção vem só das situações. Uma sessão com erro sem situação aparece como erro na aba e na conversa dela, nunca no cinza do ocioso.
- **Portadores do erro**, nenhum deles só cor: o losango, o chip quadrado com `!` e um trilho na borda esquerda da linha. O trilho marca o erro em todo lugar: linha, faixa recolhida, barra do pedido, bloco de erro da conversa, aviso do app.
- **`Ctrl+J`** abre o primeiro item que espera, fora o aberto: o mais grave, depois a espera mais antiga. Abre no lugar da situação (a aba certa) e deixa o foco na barra do pedido.

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

É um seletor com **All repositories** e um item por repositório, em ordem alfabética, com `· clone missing` ou `· not cloned` quando for o caso. O filtro restringe as tasks. Reviews e discussões ficam, como no produto. Um repositório sem tasks mostra `No tasks in <repo>.` A escolha é lembrada entre execuções.

### O rodapé

**History**, com a contagem de tasks, reviews e discussões arquivados; o tema (System, Light, Dark); e **Settings**.

## 3. Área principal com um item aberto

De cima para baixo:

- o cabeçalho;
- a trilha (só na task);
- a barra do item e as abas;
- o corpo: a conversa, com a barra do pedido e o compositor embaixo; a coluna de decisão, quando há; um painel, quando aberto.

### Cabeçalho

`←` `→`, o breadcrumb e, à direita:

- o medidor de contexto;
- **Pause** ou **Resume**;
- numa task, **Review: Agent ▾** e **Models ▾**;
- os botões dos painéis: **Details**, mais **Artifacts** e **Card** numa task, **Reports** num review, **Documents** numa discussão;
- `⋯`.

O `⋯` tem as ações raras e destrutivas: **Back to <etapa>…**, **Discard and restart…**, **Discard step N…**, **Delete task…**, **Delete review…**, **Archive…**, **Delete discussion…**. Cada uma diz antes o que será perdido. Abaixo de 1020 px de área principal, **Review mode** e **Models** saem do cabeçalho para o `⋯`, pelo nome e com o mesmo popover. Eles também estão em `Details`.

### Trilha de etapas

Só na task: `PRD › Tech spec › Plan › Implementation › PR › PR review › Closing`, ou `Planning › Implementation › PR › PR review › Closing` numa One-Shot.

- O chip atual traz o glifo de estado e o complemento (`Step 3 of 7`, `session error`, `waiting for checks`).
- Os chips de planejamento concluídos são botões com **Back to <etapa>…**.
- O chip atual de planejamento tem **Discard and restart**.
- Os chips da implementação e da PR não têm ação.

### Barra do item e abas

A barra depende do item e da etapa: a barra do step, a da PR, a do planejamento, a do review ou a da discussão. Ela carrega **estado e ferramentas**, nunca a ação que resolve uma situação.

- **Barra do step:** `Step N of M`, o título e o estado do loop, com os textos de `features.md` (`Agent review · pass 2`, `Addressing review · round 2 of 3`, `Committing`, `Blocked`). As ferramentas são **Review myself**, **Open in VS Code** e **Discard step**. No `Manual`, a faixa de review (progresso de stage e arquivos) fica logo abaixo.
- **Abas `Implementer` e `Reviewer`**, a partir da primeira passada. Cada uma tem o glifo da sua sessão, o que pede e o chip do seu tempo, ou o tempo do turno. O produto nunca troca de aba sozinho.
- **Barra da PR:** o número, o estado (`Waiting for checks · 3 of 5 passed`, `Merged`), `checked 40s ago`, **Refresh PR**, **Open PR** e **Open in VS Code**.
- **Barra do review:** `repo#PR`, o autor, o modo, o estado, **Review again**, **Open PR** e **Open in VS Code**.
- **Barra da discussão:** o board, os cards de entrada e o estado.
- **Faixas de aviso** sob a barra, quando algo bloqueia sem ser a situação do item: o clone inexistente, com **Change path**.

### A conversa

- É uma coluna de leitura centrada, com medida própria (800 px). A largura que sobra fica dos lados.
- Reúne mensagens do usuário, mensagens do produto (`MySpec · sent to the agent`), respostas do agente, grupos de ações recolhíveis, a atividade (`Working · 3m 20s · Running …`), marcadores de evento, cartões de pergunta e de permissão, blocos de erro e a fila de envio, removível.
- Abre no fim e nunca rola para cima sozinha.
- Um bloco de erro diz a razão e o detalhe (a saída do git, o código de saída), e marca o erro pelo trilho. Não tem botão: a ação fica na barra do pedido.
- Um cartão de pergunta ou de permissão guarda a resposta: as opções, os botões de permitir e negar. As teclas 1 a 9 respondem com o foco nele.

### A barra do pedido

Fica acima do compositor, na medida da conversa. É o lugar em que **todo** item diz o que pede. Existe só enquanto o item pede algo.

- **À esquerda:** o glifo, o rótulo da situação, o lugar e o chip do tempo.
- **No meio:** a razão curta, ou o progresso (`5 of 9 decided`).
- **À direita:** a ação que resolve. É o único lugar dessa ação na tela.

| O item pede | Ação na barra |
|---|---|
| Pergunta, permissão | `↑ Show`. A resposta fica no cartão |
| Erro de sessão | **Retry** |
| Step bloqueado | **Try again**, **Clean and start** (e **Change path** com o clone ausente) |
| PR bloqueada, passada bloqueada, publicação que falhou | **Try again**, **Review again**, **Publish review** ou **Retry**, conforme o caso |
| Plano inválido, turno sem resposta | O que o agente espera. A resposta vai pelo compositor |
| Etapa revisitada | **Continue** |
| Step a revisar ou aprovar (`Manual`), mudanças aplicadas | O progresso de stage, **Approve** com o que falta |
| Rascunho da PR | **Approve draft**, **Discard draft** |
| Apontamentos, rascunhos a decidir | O progresso, **Next to decide** (`Alt+↓`), mostrar ou esconder a coluna, **Publish review** ou **Apply** com o que falta |
| Commits novos, checks falhando, conflito | Os checks pelo nome, **Review again** |
| Pronta para merge, pronta para encerrar | **Open PR**, **Close task** |

Com mais de uma situação no item, a barra fala da conversa em tela. A outra está na aba dela. Se só a outra conversa espera, a barra diz isso e leva até lá. Um botão desabilitado tem borda tracejada, a razão ao lado e `aria-describedby`.

### A coluna de decisão

À direita da conversa, enquanto há o que decidir: os apontamentos de um review, os rascunhos de uma discussão, o rascunho da PR.

- No topo: o título do relatório e o resumo editável.
- Os cartões: cada um com o número, a localização (que abre o editor), o texto editável e o par **Approve**/**Discard**. A decisão ativa fica pressionada, e clicar nela a desfaz. Um cartão decidido mantém o texto legível.
- Um rascunho publicado mostra o que virou, com o link, e não tem decisão.
- Os épicos são grupos, com o que falta para publicar.

A barra do pedido mostra e esconde a coluna. Ela abre sozinha a cada passada ou leitura nova ainda não decidida. Onde os cartões moram (coluna ou conversa) é decidido na fase 4. Esta seção descreve a coluna enquanto essa decisão não é tomada.

### Painéis auxiliares

`Details`, `Artifacts` (task), `Card` (task), `Reports` (review) e `Documents` (discussão). Todos seguem as mesmas regras:

- fechados por padrão e nunca abertos sozinhos;
- um de cada vez, pelo botão do cabeçalho;
- `Esc` fecha.

O que cada um mostra:

- **`Details`** mostra os fatos do item:
  - task: repositório (com o clone), card, épico, modo (fixo), **Review mode** e **Models** editáveis, branch e base, worktree, datas, e, com a PR, o número, a base e os checks pelo nome, com estado e duração;
  - review: a PR, o autor, a branch, o card, os labels, o modo, os checks lidos antes da passada, as passadas;
  - discussão: o board, os cards de entrada, os repositórios lidos, o documento, os rascunhos.

  Nunca repete a trilha nem a barra do step.
- **`Artifacts`**: PRD, tech spec, a lista de steps (com modelo e modo de cada step não iniciado, e os relatórios sob cada step) e o rascunho da PR.
- **`Card`**: o card do board, com o épico, as dependências e os irmãos.
- **`Reports`**: `Context` e os relatórios de todas as passadas.
- **`Documents`**: `Context` e o documento da discussão.

**Regra de largura.** O painel vira coluna quando a coluna de leitura ainda cabe inteira ao lado dele e da coluna de decisão:

```
área principal − coluna de decisão − painel ≥ 760 px
```

As larguras usadas são estas:

- painel: `clamp(360px, 28% da área principal, 480px)`;
- coluna de decisão: `clamp(300px, 24%, 420px)`, ou 280 px abaixo de 900 px de área principal.

Quando a regra não vale, o painel cobre a conversa, com sombra, e `Esc` fecha. Sem coluna de decisão, isso muda por volta de 1450 px de janela. Com ela, por volta de 1950 px.

## 4. Outros lugares

- **Board**: o cabeçalho tem o estado da leitura, **Refresh**, **New discussion** (`D`) e **Start task** (`S`). Abaixo, os filtros, as seções por status e os cards. Um card mostra a task dele e se ela `Waits for you`, `In discussion`, o repositório sem clone com **Clone**, e a falha de leitura como aviso no topo.
- **Reviews**: os reviews em andamento, as pendentes, as do próprio usuário, os filtros e as falhas de leitura por repositório.
- **History**: a lista mista de tasks, reviews e discussões, com busca e o filtro por repositório. A linha recém-arquivada fica destacada quando se chega por um item que saiu.
- **Settings**: navegação à esquerda (`Defaults`, `Boards`, `Repositories` com o aviso do clone, os nove prompts) e a página à direita.

## 5. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `Ctrl+N` | Qualquer lugar | Nova task |
| `Ctrl+J` | Qualquer lugar | Abre o próximo item que espera, no lugar da situação, com o foco na barra do pedido |
| `Ctrl+,` | Qualquer lugar | Abre ou fecha Settings |
| `Alt+←`, `Alt+→` | Qualquer lugar | Volta e avança no histórico |
| ↑↓ ←→ `Home` `End` `Enter` | Árvore | Percorre, recolhe e expande, abre |
| `Alt+↓`, `Alt+↑` | Item com coluna de decisão | Próximo e anterior por decidir |
| 1–9 | Cartão de pergunta ou de permissão | Responde |
| `Esc` | Qualquer lugar | Fecha o popover, depois o painel, depois Settings |
| `↑↓ ←→ Enter Esc / S Space D` | Board | Os do produto |

`Cmd` vale no lugar de `Ctrl`. Os atalhos globais ficam inertes com os diálogos de criação abertos.

**Ordem de Tab:** topo da lateral, filtro, árvore (uma parada), rodapé, cabeçalho, barras, conversa, barra do pedido, compositor, coluna de decisão, painel.

## 6. Larguras

O design funciona de 1100 a 2600 px, sem pontos fixos de janela. Cada regra depende da largura do próprio contêiner.

| Onde | Regra |
|---|---|
| Lateral | `clamp(288px, 8vw + 200px, 380px)`: 288 px a 1100, 300 a 1250, 380 a partir de cerca de 2250. Recolhida, 60 px |
| Linha da árvore | Lateral abaixo de 330 px: o meta sai e os rótulos passam à forma curta. A posição nunca sai. Abaixo de 370 px, a ação passa à forma curta: o verbo primeiro e o caminho encurtado pelo meio, com o último segmento |
| Cabeçalho | Área principal abaixo de 1020 px: **Review mode** e **Models** vão para o `⋯`, e os rótulos longos dos botões encurtam (`VS Code`). Abaixo de 900 px: o breadcrumb fica só com o item |
| Conversa | Medida de 800 px, centrada |
| Painéis | A regra da seção 3 |
| Barras | Quebram em duas linhas antes de esconder uma ação |

## 7. Estados de toda tela

| Estado | Onde aparece |
|---|---|
| Início do app | A lateral em esqueleto e, na área principal, `Starting MySpec…` com os passos nomeados enquanto rodam. Um passo lento mostra o tempo. Nunca uma janela em branco |
| Migração recusada | **MySpec couldn't be updated**, na janela inteira, sem a lateral, com os casos por tipo e o que fazer |
| Nada cadastrado | Welcome, com **Add board** e **Add repository**. A lateral só tem o topo e o rodapé |
| Nenhum item ativo | Home com `Nothing in progress` e as ações de início |
| Nada aberto | Home com **Continue** |
| Primeira leitura do GitHub | A árvore local completa. `reading…` nos nós de board e em Reviews. `PR review · checking GitHub` na linha que depende dela. Home diz o que está sendo lido |
| Falha de leitura de board | `◇ Read failed` no nó (razão no tooltip), aviso no topo da visão do board com **Try again**, e na Home. Nunca uma situação |
| Clone inexistente | O item `◇` na árvore, a faixa na task afetada, a Home, o filtro e Settings › Repositories |
| Repositório sem clone | Onde uma task seria criada: o card do board com **Clone**, a Home, o filtro |
| Item esperando o usuário | A linha, a aba, a trilha e a barra do pedido |
| Erro de um item | O mesmo, com os três portadores do erro e o bloco de erro na conversa |
| Agente trabalhando | As linhas 2 e 3 da árvore, a atividade na conversa, **Stop** e a fila no compositor |
| Esperando o GitHub | A linha, a barra da PR e o bloco na conversa com os checks pelo nome. Antes da primeira passada, o compositor diz que a conversa começa quando os checks terminam |
| Pausado, ocioso | Glifos e rótulos diferentes. A barra do planejamento diz desde quando está pausado. O compositor diz que enviar retoma |
| Item que saiu enquanto aberto | A página da seção 1 (arquivado, review encerrado, apagado) |
| Aviso do app | `Something went wrong` e arquivos que ficaram no disco: uma faixa no topo da área principal, com o trilho de erro, até ser dispensada |
| Vazios | `No active items.` num board, `No review in progress.`, `No tasks in <repo>.`, `No artifacts yet…`, e os textos de board, Reviews e History do produto |
| Muitos itens | A árvore rola. O item aberto é trazido à vista. Os nós recolhem com resumo |

## 8. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| Ação em curso (rótulo e alvo), `turnStartedAt` e a conversa que trabalha, no resumo do item | Linhas 2 e 3 de um item não aberto | Pequeno. Já decidido |
| Checks da PR durante `Waiting for checks`, com nome, estado e duração | `Details`, a barra da PR, a conversa | Pequeno. O backend já os lê a cada minuto |
| Checks e conflito lidos antes de cada passada de review | `Details` do review | Pequeno |
| `sessionStatus` de cada sessão do item, não só da exibida | A aba da outra conversa com erro sem situação | Pequeno |
| Resultado do apagamento: o que foi removido e o que ficou no disco | A página do item apagado | Pequeno |
| Resultado do encerramento no `ArchivedTask` | A página do item arquivado, History | Pequeno, se ainda não chega |
| Progresso do início do app, passo a passo | A tela de início | Pequeno. A alternativa é mostrar só `Starting MySpec…` |
| Desde quando uma sessão está pausada | A barra do planejamento e do step | Pequeno. A alternativa é não mostrar |

O frontend deriva sozinho, com o que já chega:

- a posição curta de cada linha;
- a gravidade e a ordem do `Ctrl+J`;
- as contagens dos nós;
- a marca One-Shot;
- `checkedAt`;
- a fase de leitura do GitHub;
- o progresso de decisão;
- o tempo de espera (`startedAt`);
- se um item que sumiu foi arquivado ou apagado;
- o histórico de navegação e o último item aberto, que o frontend persiste entre execuções.

Fica fora: custo em tokens e dólares, e duração de task, etapa e step (`decisions.md`).
