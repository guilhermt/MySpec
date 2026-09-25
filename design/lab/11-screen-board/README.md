# 11 · Home, o board e a criação de task

Fase 4, segunda tela. Levantamento em `design/research/board.md`. A régua é a mesma da tela da task (`decisions.md`, 2026-09-24, "A tela da task é mínima"): cada elemento justifica por que existe, ou sai.

**O que a rodada resolve.** Como o usuário escolhe o próximo card e começa uma task ou uma discussão a partir dele, e o que a Home é sem item aberto. O volume é o real: o board de trabalho tem 120 cards em 10 status, 46 visíveis com os finais recolhidos, corpos de 20 linhas de Markdown e 10 épicos que também são cards. De 23 tasks, 21 usam `Agent`, só uma de card usou `Additional context`, e as discussões quase sempre começam sem card.

**A pergunta das variações.** O modelo do board: agrupar por status, como o GitHub Projects, ou por épico, como a árvore da lateral. As duas variações são iguais em todo o resto: a linha, os filtros, a seleção, os estados, a Home e o diálogo.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **A · Por status**, nas doze cenas |
| `b.html` | **B · Por épico**, nas mesmas doze cenas |
| `components.html` | Os componentes novos ou mudados, em todos os estados, claro e escuro lado a lado |
| `critique.md` | A crítica da rodada. As correções que ela pediu antes da chamada estão em "Depois da crítica" |
| `src/` | As fontes. `data.js` é o board falso no tamanho do real. `shell.js` e `board.css` são o que as duas variações têm em comum. `a.*` e `b.*` são o modelo de cada uma, e `components.*` o espécime. `build.py` gera as páginas |

As páginas são geradas por `python3 design/lab/11-screen-board/src/build.py`. O script lê sem mudança, da rodada 10, os componentes da 08 e o shell (`base.css`, `core.css`, `core.js`: a árvore, os botões, os menus, o diálogo, os tooltips e a auditoria). Cada página traz `design/system/tokens.css` byte a byte, e o script confere a igualdade.

## Como abrir

Sirva a lab (`python3 -m http.server 8090 -d design/lab`) e abra `11-screen-board/a.html` e `b.html`. Um seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros:

- `?scene=`: as treze da tabela abaixo; o padrão é `board`;
- `?theme=light` ou `?theme=dark`;
- `?home=none`, com `scene=home`: a Home sem nenhum item ativo;
- `?audit`: o relatório de geometria, corte, nomes e contraste;
- `?clean`: esconde o seletor.

Tudo é clicável e percorrível pelo teclado: abrir e fechar o card (`Enter`, `Esc`, clique), `S` e `D` na linha, `N` para uma discussão nova, `Space` para o modo de seleção, `/` para a busca, as setas na lista, os filtros e o menu `Filter`, o `⋯` do board, **Refresh** e **Try again** (simulam uma leitura), **Clone and continue** (simula o clone e abre o diálogo), `Ctrl+N`, e no diálogo os controles de modo, o `Show` do contexto, `Add to it`, `Models` e o nome, que valida enquanto se digita. **New discussion**, `N`, `D` e **Discuss** abrem o diálogo de discussão. Abrir uma task e o diálogo de `Add to board` dão um aviso, porque são de outras telas.

## O que é igual nas duas

**O lugar.** A visão do board é um lugar na área principal (`structure.md` §1). O nó do board na árvore fica marcado como o lugar aberto, com o véu e o anel da identidade. Nenhuma task fica selecionada.

**O cabeçalho** tem `←`, o título e, à direita, a idade da lista na tela (`Read 2m ago`), **Refresh**, **New discussion** `N` e `⋯`. **New discussion** é secundário e abre o diálogo com o board fixo e sem cards. É a ação diária sem card: 10 das 11 discussões começaram assim. O `⋯` tem **Select cards to discuss** `Space`, **Open on GitHub** e **Edit the board in Settings…**. Não há **Start task** no cabeçalho: começar uma task é do card.

**A barra de filtros** fica fixa acima da lista, dentro da coluna, e tem o mínimo:

- a busca, com `/`;
- **Assigned to me**, o único filtro de um clique;
- **Filter**, um menu com repositório, responsável e status;
- cada filtro ativo vira um chip com `×`, e **Clear filters** aparece só com algum ativo;
Os cinco filtros do produto continuam, com o mesmo comportamento. O modo de seleção não está na barra: quase nunca é usado, e fica no `⋯` e no `Space`.

**A linha do card** mostra só o que decide a escolha, numa altura de 32 px:

- o número;
- o título;
- a task do card, com o glifo da gravidade e a posição, como na árvore: `● Question · Step 3/7`, o spinner com `Step 2/5 · Reviewer pass 2`, `◆ Session error · Plan`. O glifo é o da árvore, então um erro não se disfarça de espera como hoje (`Waits for you` âmbar em qualquer gravidade);
- `In discussion`, com o glifo da discussão, quando o card é entrada de uma discussão ativa;
- a dependência não satisfeita, como `◇ #461`, com a dependência inteira no tooltip. É o losango contornado de "bloqueia sem ser situação" (princípio 5), em tinta neutra, nunca âmbar: o âmbar é "espera por você";
- as teclas, numa coluna própria à direita, visíveis só na linha com o foco do teclado. Cada tecla aparece quando age: `S start` num card sem task que pode começar uma, e `D discuss` em todo card que pode entrar numa discussão, também nos que têm task ou estão em discussão. Um `S` que não age diz por quê num aviso.

As colunas têm largura fixa, então o número, a dependência, a task e as teclas se alinham de linha em linha. Como as teclas têm a coluna delas, aparecer no foco nunca tira largura do título. Com a lista estreita (abaixo de 1040 px de lista: a metade do monitor, ou a lista ao lado do painel da A), a linha não perde nada que decide a escolha: o épico, a dependência e a task com o rótulo inteiro descem para uma segunda linha, sob o título, em tinta 3. Uma linha sem nada disso continua com uma linha só.

O resto do card espera o clique: o corpo, os campos (`Module`, `Estimate`, responsáveis, datas), o repositório, o épico e os irmãos, as dependências, as pull requests e a task arquivada.

**O card aberto** tem, nesta ordem:

1. o título e o status;
2. as ações. **Start task** `S` é o único primário da tela, e **Discuss** `D` é secundário. Cada caso do produto tem a sua forma, com a razão ao lado:
   - o repositório sem clone troca **Start task** por **Clone and continue**;
   - o clone inexistente deixa **Start task** tracejado e oferece **Change path…**;
   - o repositório de fora do board oferece **Start task**, que adiciona o repositório primeiro;
   - o repositório de outro board deixa **Start task** tracejado;
   - o card com task mostra a task com o que ela pede e **Open**;
   - a issue fechada fica só com **Discuss**;
3. a dependência não satisfeita, que nunca bloqueia;
4. a task, a arquivada ou a discussão;
5. os campos;
6. o corpo, no registro de leitura;
7. o épico com o progresso, os cards do épico com o status de cada um, as dependências e as pull requests. Um card do board abre com um clique.

**O modo de seleção** existe só quando pedido: **Select cards to discuss** no `⋯`, ou `Space` numa linha, que já marca aquela. A barra de filtros dá lugar à barra da seleção (`3 selected · #455 #461 #475`), com **Discuss 3 cards** `D` como primário e **Cancel** `Esc`. As linhas ganham a caixa. Um card que não pode entrar numa discussão tem a caixa tracejada, e `Space` nele diz por quê.

**Os estados**, iguais nas duas:

- **leitura em curso:** a lista guardada fica, e o cabeçalho diz `Reading…` com o spinner. **Refresh** fica tracejado. O nó da árvore diz `reading…`;
- **falha de leitura:** o cabeçalho continua dizendo a idade da lista na tela (`Read 2h ago`). Uma faixa afundada no alto da lista diz `◇ Couldn't read the board`, a razão do `gh` e a leitura que está na tela, com **Try again**. Nunca é vermelha, porque uma falha de leitura não é uma situação. O nó da árvore mostra `◇ Read failed`;
- **board vazio:** `This board has no issues.`, o que traz cards, e **New discussion**;
- **filtro sem resultado:** `No cards match the filters.`, o que foi pedido e **Clear filters**;
- **card fora da última leitura:** o card aberto não fecha em silêncio. Fica aberto, com a faixa `◇ This card isn't in the last reading of the board.`, o porquê, as ações tracejadas e **Close**. Some da lista ao fechar;
- **repositório sem clone:** **Clone and continue** no lugar de **Start task**. Enquanto clona, o botão diz `Cloning acme/billing…` e o diálogo abre sozinho no fim, como no produto;
- **nunca lido**, lendo e com falha: no espécime (`Reading of the board`), com o esqueleto e com a falha em lugar da lista.

## A · Por status

**A lista agrupada pelas seções de status do board**, na ordem do board, com as seções finais recolhidas: `Backlog 27`, `Ready 9`, `In progress 6`, `Code review 2`, `Changes requested 0`, `Approved 1`, `In dev`, `Ready for release` e `Done` recolhidas, `Paused 1`. Uma seção vazia continua, sem chevron, para a lista não pular quando o filtro muda. O cabeçalho da seção tem só o nome e a contagem.

**O épico é um rótulo na linha**, numa coluna própria, em tinta 3, ou na segunda linha quando a lista é estreita. O card de um épico é uma linha como as outras, com o glifo de épico e `Epic · 2 of 8 finished` na coluna.

**O card abre como o painel `Card`**, ao lado da lista, sem sair dela. A lista continua rolando e o teclado continua nela: `↓` e `Enter` trocam o card do painel. O painel é o componente da estrutura, afundado ao lado da lista. É mais largo que os outros painéis, porque o corpo é lido ali: `clamp(360px, 42%, 640px)`. A regra da largura é própria do board, porque a lista não é uma coluna de leitura: o painel fica ao lado enquanto a lista mantém 440 px. Na faixa de 1100 a 2600 px, ele nunca cobre a lista. Com o painel aberto até cerca de 2000 px de janela, a lista é estreita, e as linhas usam a segunda linha: a 1250 px, `#474 Usage alerts at 80% of the plan` tem embaixo `Usage-based billing ◇ #461`, e `#412` tem `API hardening ● Question · Step 3/7`.

## B · Por épico

**Os cards de um épico ficam juntos**, sob o épico como cabeçalho. O cabeçalho é o próprio card do épico, uma linha um pouco maior, com o nome, o número e o progresso: `2 of 8 finished`, com uma barra neutra (não é a identidade nem um estado). Ele tem um alvo só: o clique ou `Enter` abre o card do épico, como qualquer linha, e `S` e `D` agem nele. O grupo não recolhe. Depois dos épicos com cards abertos vem `No epic`, com 31 cards, sob um título que não é interativo. Por último vem `8 finished epics`, recolhido. Dentro de cada grupo, os cards seguem a ordem dos status do board, e os finalizados do grupo recolhem numa linha (`2 finished`, com a contagem por status no tooltip).

**O status é um sinal na linha**, na primeira coluna. Ele aparece só no primeiro card de cada sequência de mesmo status. Sem isso, `Backlog` se repetiria 20 vezes seguidas no grupo `No epic`. O nome acessível de cada linha diz o status.

**O card abre no lugar**: a linha cresce e vira o card. O título deixa de cortar e fica em negrito. Embaixo vêm as ações, as notas e o corpo à esquerda, e os campos e as relações numa coluna de 320 px à direita. Abaixo de 860 px de lista, tudo vira uma coluna. O corpo longo fica recortado em 14 linhas com **Show the whole card**, para o card não empurrar a lista para longe. O card de um épico abre sob o cabeçalho e mostra os cards do épico. O `×` fica no canto do card.

**A lista não é uma árvore.** Cada linha é um botão de abertura (`aria-expanded`, `aria-controls`), e o card que ela abre é uma região logo depois dela, fora de qualquer `tree`. É o padrão de disclosure. As setas continuam indo de linha em linha, e o modo de seleção usa `aria-pressed`. Na A, a lista continua uma árvore, porque o card abre fora dela, no painel.

## As treze cenas

| Cena | O que mostra | A · Por status | B · Por épico |
|---|---|---|---|
| `home` | A Home, com o foco em **Continue** | A mesma nas duas | A mesma nas duas |
| `board` | O board em repouso, uma linha com o foco e as teclas | Topo do `Backlog`, foco em #467 | Épicos no topo, foco em #474 |
| `card` | #474 aberto, com dependência não satisfeita | Painel ao lado | No lugar, sob a linha |
| `reading` | Leitura em curso sobre a última | `Reading…` no cabeçalho e na árvore | Igual |
| `failed` | Falha de leitura com **Try again** | Faixa sobre a lista guardada | Igual |
| `empty` | O board `Internal Tools`, sem issues | Vazio com **New discussion** | Igual |
| `filtered` | `refund` e `Assignee: tchen`, sem resultado | `No cards match the filters.` | Igual |
| `stale-card` | #466 saiu da leitura com o card aberto | O painel com a faixa. A linha já saiu | A linha riscada e o card com a faixa, até fechar |
| `no-clone` | #471, de `acme/billing` sem clone | **Clone and continue** no painel | **Clone and continue** no lugar |
| `create` | `Ctrl+N`: o diálogo livre, com erro no nome, One-Shot e os modelos abertos com um ajuste | Sobre o board | Sobre o board |
| `create-card` | **Start task** de #474: nome sugerido, contexto do card, dependência | Sobre o board com o painel | Sobre o board |
| `select` | O modo de seleção com três cards | Caixas nas linhas, a barra da seleção | Igual, com três cards do mesmo épico |
| `home-disc` | **New discussion** da Home: o diálogo com a lista dos boards aberta | A mesma nas duas | A mesma nas duas |

## A Home

A Home segue `structure.md` §1, mínima, numa coluna de leitura:

- **Continue**, com o último item aberto, o que ele pede com a posição (`Question · Reviewer · Step 3/7`), o chip do tempo e onde ele vive. O foco começa nele, então `Enter` o abre. Sem item ativo, o lugar diz `Nothing in progress` e o que começa um (`?home=none`);
- **Start**: **New task** `Ctrl N`, **Review a pull request** com `4 pending in 3 repositories`, e **New discussion**. **New discussion** abre o diálogo de discussão com o campo **Board**, porque há mais de um board: a lista mostra cada board com os repositórios e a idade da leitura, e vem no board da última discussão. Com um board só, o campo não aparece e o board é fixo, como a partir da visão do board;
- **Boards**: cada board com os cards abertos, os repositórios e a idade da leitura. A falha de leitura vem com **Try again**. O repositório sem clone vem com **Clone**, e **No board** mostra o clone inexistente com **Change path…**. Clicar num board abre a visão dele;
- os atalhos, numa linha.

A Home não lista o que espera: isso é da árvore. Sem item ativo (`?home=none`), a árvore ao lado também está vazia: cada board diz `No active items.` e Reviews diz `No review in progress.`, com `4 pending`.

**O diálogo de discussão**, nesta rodada, vai só até onde a Home e o board precisam: o board (fixo, ou escolhido na Home), **Title**, **What to discuss**, os cards quando vêm de uma seleção, o aviso do repositório sem clone e o modelo, com `Write what to discuss or select at least one card.` ao lado de **Start discussion** desabilitado. O resto dele (o contexto, a remoção de cards, os estados) é da rodada da discussão.

## A criação de task

O diálogo é o mesmo nas duas, um pouco mais largo que o do sistema para caber um nome de 64 caracteres em mono. Os campos:

- **o topo**: o card (número, título, repositório, status, épico) ou o seletor de repositório, com os que não podem receber task desabilitados e a razão;
- **Name**: mono, sugerido a partir do card. A validação acontece enquanto se digita, com os textos de `features.md` e o link `Use "<sugestão>"`;
- **Context**: no diálogo livre, o texto obrigatório, com a ajuda de `features.md`. No de card, uma linha diz o que foi montado (`From the card: #474, the epic Usage-based billing, 6 cards of the epic and 1 dependency · 5,690 characters`), com **Show** para ler o texto e **Add to it** para abrir `Additional context`. O campo só existe se for pedido, porque quase ninguém o usa;
- **a dependência não satisfeita**, neutra, dizendo que a task pode começar;
- **Mode** e **Review of each step** lado a lado, com o mesmo controle segmentado. Hoje são um toggle e um menu para escolhas do mesmo tipo. Cada um tem a linha do que faz, e o modo diz que é fixo depois de criada a task;
- **Models**, recolhido sob o resumo (`Defaults`, ou `One-Shot planning: Fable 5.1 · xhigh · the rest from Defaults`).

O rodapé tem **Cancel** e **Create** `Ctrl ↵`, o único primário. Quando **Create** está desabilitado, a razão fica ao lado. Os estados do rodapé estão no espécime: pronto, desabilitado, criando, o card que ganhou task, a sessão que não começou e o card que saiu da leitura.

O diálogo fica a uma altura fixa do topo e cresce para baixo, então abrir **Models** não move o título.

## Onde a proposta toca o que está registrado

Nenhuma decisão de `decisions.md` é reaberta. Estes pontos mudam `structure.md` ou o comportamento de `features.md`. Cada um é uma escolha para o usuário confirmar:

1. **`structure.md` §4, Board:** o cabeçalho perde **Start task** (`S`), porque começar uma task sem card não tem sentido ali (`board.md` §6 aponta a lacuna). `S` continua na linha e no card. **New discussion** fica no cabeçalho, com a tecla `N` em vez de `D`, porque `D` age no card com o foco. O modo de seleção passa ao `⋯`.
2. **Só na B: o board deixa de ser agrupado por status.** `brief.md` §3 dá ao board "seções por status" e ao épico o papel de agrupar as tasks na árvore. `structure.md` §4 diz "os filtros, as seções por status e os cards", e `features.md` (Visão do board) diz "Lista de cards agrupada por status". A B troca isso pelo agrupamento por épico, com o status como sinal na linha. É a maior mudança da rodada, e é do usuário.
3. **`structure.md` §4:** "o repositório sem clone com **Clone**" sai da linha e fica no card aberto (**Clone and continue**) e na Home. Clonar é um clique no momento de começar, e não muda a escolha do card.
4. **`structure.md` §3, Painéis** (só na A): o painel `Card` do board tem a própria largura e a própria regra (440 px de lista em vez de 760 px de leitura), e abre ao abrir um card, que é uma ação do usuário, não uma abertura sozinha.
5. **`features.md`, Visão do board:**
   - a caixa de seleção sai de toda linha e vive no modo de seleção, com `Space` como antes;
   - a task na linha mostra a gravidade real em vez de `Waits for you` âmbar para tudo;
   - `In discussion` entra na linha;
   - o card que sai da leitura fica aberto com o aviso em vez de fechar em silêncio;
   - a falha de leitura sai do cabeçalho e vira a faixa com **Try again**;
   - `N` abre uma discussão sem cards; `D` continua com os selecionados ou com o card do foco.
6. **`features.md`, Criação de uma task:** `Additional context` aparece só com **Add to it**; o modo e o modo de review usam o mesmo controle; `Unsatisfied dependencies` deixa o âmbar e fica neutra.
7. **Home** (`structure.md` §1) e **`features.md`, Criar uma discussão:** a discussão nasce também da Home, e o diálogo ganha o campo **Board** quando é aberto fora de um board e há mais de um. Hoje ela nasce só da visão do board, com o board fixo.

## O que ficou fora, e por quê

| Ficou fora | Por quê |
|---|---|
| Campos na linha (`Module`, `Estimate`, responsáveis, repositório, PRs) | Não decidem a escolha no volume real. Estão no card, a um clique, e o filtro tem repositório e responsável |
| Cor por status | O board não lê a cor das opções, e cor escolhida pelo usuário vira decoração (`references.md`, GitHub, Evitar) |
| Visão em colunas (kanban) | Com 10 status numa janela de 1100 px, cada coluna teria 80 px. A lista de uma linha escala até 2.000 issues |
| Ordenação e colunas configuráveis | Feature nova, fora da frente |
| Virtualização da lista | 46 linhas visíveis, 120 ao todo. A linha é leve. Fica para a implementação medir com 2.000 |
| O diálogo de discussão e o de `Add to board` | O primeiro é da rodada da discussão. O segundo não muda |
| Board que some do estado com a visão aberta | Segue a regra do item que sai (`structure.md` §1): uma página que diz o que houve, com a volta. Não desenhado aqui |

## Componentes novos

Todos estão em `components.html`, em todos os estados, claro e escuro lado a lado.

| Componente | Estados |
|---|---|
| **Linha do card** (a linha de lista de `components.md`) | padrão, hover, foco com as teclas, pressionada, aberta, desabilitada (não selecionável), carregando (clonando), erro (o clone falhou), e as variantes com task (espera, trabalhando, erro), em discussão, dependência, épico, sequência de status (B), com a caixa, fora da leitura |
| **Cabeçalho de grupo** (seção de status na A, épico com progresso na B, a linha dos finalizados) | padrão, hover, foco, pressionado, recolhido, vazio, desabilitado, carregando, erro, épico aberto |
| **Caixa de seleção** (o checkbox de `components.md`) | desmarcada, marcada, hover, foco, pressionada, desabilitada, carregando, erro |
| **Barra de filtros e barra da seleção** | padrão, hover, foco, pressionado, filtros ativos, desabilitado (sem viewer do `gh`), carregando, erro (filtro de um repositório que saiu), seleção vazia, com três, abrindo |
| **Leitura do board** (a idade no cabeçalho, **Refresh**, a faixa da falha, o esqueleto, o vazio de página) | lida, lendo, falha, tentando de novo, nunca lida lendo, nunca lida com falha, vazio |
| **Ações do card** | iniciar, hover, foco, pressionado, sem clone, clonando, clone com falha, clone inexistente, outro board, fora do board, com task, fechada, fora da leitura, dependência |
| **Continue e as linhas da Home** | padrão, hover, foco, pressionado, desabilitado (arquivado no meio tempo), carregando, erro; board lendo e com falha |
| **Campos do diálogo** (controle segmentado, nome, linha do contexto, modelos, menu de repositório) | padrão, hover, foco, desabilitado; nome com os três erros; contexto relendo e com falha; modelo próprio, indisponível e carregando |
| **Rodapé do diálogo** | pronto, hover e foco, desabilitado, criando, card com task, sessão que não começou, card fora da leitura |

**Tokens propostos**, declarados em `board.css` até entrarem em `system/tokens.css`:

- `--panel-card-width: clamp(22.5rem, 42%, 40rem)`, o painel `Card` da A;
- `--size-dialog-wide: calc(var(--size-dialog) + var(--space-16))`, o diálogo de criação;
- `--list-measure: calc(var(--measure) + var(--space-16) * 3)`, a largura da lista, 62rem.

As larguras das colunas da linha são `calc()` de tokens de espaço.

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| `In discussion` num card que é entrada de uma discussão ativa | A linha e o card | Nenhum: derivável de `discussions[].cards[]` |
| `In discussion` num card criado ou atualizado por uma discussão | A mesma marca, e o link no card | Pequeno: expor o que `discussion.Service.DocumentOfCard` já sabe |
| O progresso de um épico (`2 of 8 finished`) | O cabeçalho da B e a coluna da A | Nenhum: os filhos do board estão na leitura e os de fora estão em `siblings[]`. Épicos com mais de 50 sub-issues são cortados pela query |
| O card que saiu da leitura, mantido aberto | `stale-card` | Só frontend: guardar o último `BoardCard` aberto em vez de fechar |
| Quando a leitura falhou (`failedAt`) e a idade da leitura na tela | A faixa e o cabeçalho | Nenhum: `failedAt` e `readAt` chegam e não são mostrados |
| O último item aberto, entre execuções | **Continue** | Só frontend, já decidido em `structure.md` §8 |
| Cards abertos por board e PRs pendentes por repositório | As linhas da Home | Nenhum: deriváveis do `State` |
| O board de uma discussão aberta fora de um board, e o board da última discussão como padrão | **Board** no diálogo aberto da Home | Pequeno: o `CreateDiscussion` já recebe o board; o frontend passa a escolhê-lo. O padrão sai de `discussions[]` e do histórico |
| A razão de um card não poder entrar numa discussão | `Space` num card de fora do board | Nenhum: `action` e `repositoryId` já dizem |

## Três perguntas que só o usuário responde

1. **Na hora de escolher o próximo card, você pensa por épico (o que falta deste épico) ou por status (o que está pronto)?** Decide o agrupamento, e é a diferença entre A e B. *Resposta provisória: por épico, com o status como sinal. A árvore já agrupa por épico, e a discussão publica cards em épicos. No board real, só 13 dos 46 cards abertos têm épico, então os outros 31 ficam em `No epic` ordenados por status, o que é a lista da A para a maioria.*
2. **O que você precisa ver na linha sem abrir o card?** Hoje nenhum campo aparece. *Resposta provisória: número, título, a task e o que ela pede, a dependência não satisfeita, e o status (B) ou o épico (A). Módulo, estimativa, responsável e PRs ficam no card, e o responsável também está no filtro **Assigned to me**.*
3. **Você seleciona vários cards para discutir?** Das 11 discussões, uma começou com um card e nenhuma com vários. *Resposta provisória: raramente. A seleção fica como um modo explícito (**Select** ou `Space`) e sai de toda linha. Se a resposta for "nunca", o modo pode sair, e a discussão ganha cards no próprio diálogo.*

## Como foi testado

- Chromium headless, pelo `http.server` da lab, com a Fira do Google Fonts. As capturas foram olhadas cena a cena, nos dois modos, a 1100, 1250, 1600 e 2560 px, e o espécime inteiro a 2400 px.
- `?audit` nas treze cenas das duas variações, nos dois modos, a 1100, 1180, 1250, 1400, 1600, 1850, 2100 e 2560 px (416 combinações), e em `?home=none` a 1100, 1600 e 2560 px. A auditoria é a da rodada 10, com a geometria desta rodada e mais uma regra: o título de uma linha tem ao menos um terço da linha. Em todas:
  - toda caixa que o layout posiciona fica em pixel inteiro: as linhas, os cabeçalhos, a barra de filtros, o painel (arredondado para baixo), o card no lugar, o diálogo, as linhas da Home;
  - nenhum texto corta sem tooltip;
  - nenhum controle sem nome;
  - todo texto com 4,5:1 ou mais sobre o fundo real;
  - a página nunca rola na horizontal;
  - nenhum título de linha com menos de um terço da linha.
- `components.html?audit` nos dois modos: nenhum texto abaixo de 4,5:1 e nenhum controle sem nome. A grade do espécime não é medida.
- A renderização final é a do WebKitGTK, no app.

## Depois da crítica

`critique.md` pôs quatro condições antes da chamada, e o coordenador pediu mais duas correções. Todas estão nas duas variações, nesta pasta.

1. **New discussion volta ao cabeçalho do board**, visível e com `N`. **Select** sai da barra de filtros para o `⋯`, porque quase nunca é usado.
2. **O New discussion da Home tem comportamento:** abre o diálogo de discussão com o campo **Board**, que tem os três boards (cena `home-disc`).
3. **A troca do agrupamento na B** está listada em "Onde a proposta toca o que está registrado" (item 2), com `brief.md` §3, `structure.md` §4 e `features.md`.
4. **Na B, nenhuma região dentro de uma árvore:** a lista passou ao padrão de disclosure. O cabeçalho do épico é o card do épico, com um alvo só. O `×` do card foi para o canto.
5. **Na A, a linha com o painel aberto mantém o que decide a escolha:** o épico, `In discussion` e a task com o rótulo descem para uma segunda linha em vez de virarem glifo. As teclas ganharam uma coluna própria e aparecem em todo card em que agem: `D` sempre que o card pode entrar numa discussão, `S` só sem task. Um `S` que não age diz por quê.
6. **`?home=none`** mostra a árvore sem itens ativos.

As outras correções da crítica (o `+N` da dependência, a barra da seleção sem a identidade, o nome **Review mode**, a linha do contexto com a discussão e sem épico, a falha de leitura dita uma vez, os estados inventados do espécime e os demais itens do espécime) ficam para a rodada de ajuste depois da escolha, como a crítica propõe.

## Recomendação

**B · Por épico.**

- **É o mesmo modelo da árvore.** A lateral já é board › épico › item. Na B, o board se lê com a mesma forma, e o usuário não troca de modelo mental ao sair da árvore para o board. O progresso do épico responde "o que falta deste épico" sem abrir nada.
- **Não esconde o que está pronto.** Na A, os 27 cards de `Backlog` vêm antes dos 9 de `Ready`, porque essa é a ordem do board. Na B, cada épico começa pelo seu status mais cedo, mas é curto, e `No epic` fica em ordem de status como na A.
- **O card abre sem painel.** O usuário usa os painéis fechados (`brief.md` §2). Na metade do monitor, o painel da A deixa a lista com 450 a 550 px. As linhas não perdem mais nada, porque descem para duas linhas, mas a lista fica mais alta e mais estreita. Na B, o card toma a largura da lista, e o corpo é lido na medida de leitura.
- **Nada novo no cromo.** As duas têm o mesmo cabeçalho, a mesma barra e a mesma linha. A diferença está só no agrupamento e no lugar em que o card abre.

O risco da B, para o usuário julgar: ela se afasta das seções do GitHub Projects, que são o vocabulário do board e o que `brief.md`, `structure.md` e `features.md` registram. Ela também espalha os cards `Ready` por todos os grupos. E comparar dois cards pede fechar um e abrir o outro. A crítica recomenda a variação de comparação abaixo, e ela é a alternativa natural se o usuário escolhe por status.

## Variação de comparação: por status, com o card no lugar

Sem mock, descrita para a decisão. É a recomendação da crítica, e as peças já estão desenhadas.

1. **O agrupamento da A:** as seções de status do board, na ordem do board, as finais recolhidas, o épico como rótulo na linha. Segue `brief.md` §3, `structure.md` §4 e `features.md` sem mudança.
2. **O card da B:** a linha cresce e vira o card, com as ações, as notas e o corpo à esquerda e os campos e as relações à direita. O corpo fica recortado com **Show the whole card**.
3. **A lista deixa de ser árvore**, como na B: cada linha é um botão de abertura, e o card é a região depois dela. Os cabeçalhos das seções continuam recolhendo, e `←` e `→` agem neles.
4. **A linha nunca fica estreita por causa do card:** na metade do monitor ela tem a largura da lista, então o épico e a task ficam na mesma linha do título a partir de 1040 px de lista.
5. **O que se perde:** a lista à vista ao lado do card aberto, que só a A tem. A dependência aparece uma vez como aviso e uma vez em `Dependencies`, e a linha leva o `◇`.

## Decisão

**A · Por status**, decidida em 2026-09-24. Ver `design/decisions.md`. O documento da tela é `design/screens/board.md`.
