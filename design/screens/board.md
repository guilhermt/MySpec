# Home, o board e a criação de task

Fase 4, decidido em 2026-09-24. Referência visual: `lab/11-screen-board/a.html` (as treze cenas, `?scene=`, e `?home=none`) e `lab/11-screen-board/components.html` (cada componente novo em todos os estados, nos dois modos).

São três peças da mesma jornada (`brief.md` §4, J2 e J7): a Home, o lugar sem item aberto; a visão de um board, onde o usuário escolhe o próximo card e começa uma task ou uma discussão; e o diálogo de criação de task. Elas seguem `structure.md` (o shell, a árvore, os painéis, a largura contínua), `principles.md` e `system/`. Onde este documento e `structure.md` §1 e §4 divergem, vale este documento. As mudanças estão listadas na seção 10.

**Onde o mock difere deste documento.** A crítica da rodada (`lab/11-screen-board/critique.md`) deixou ajustes para depois da escolha. Eles estão decididos aqui e ainda não estão no mock:

- a dependência na linha diz quantas faltam (`◇ #461 +1`);
- a barra do modo de seleção é neutra, sem a identidade (seção 3.6);
- o campo do modo de review do diálogo se chama **Review mode**, como na tela da task e em Settings;
- a linha do contexto do card é montada com o que o card tem, com o plural certo, e cita a discussão (seção 4.3);
- a falha de leitura diz a idade da lista uma vez, no cabeçalho, e a faixa diz quando falhou (seção 3.8);
- o card fora da leitura fecha só pelo `×` do painel, sem um segundo **Close**;
- no espécime, o chip de um filtro órfão usa `◇` em vez de vermelho, e saem os estados sem caso no produto: a caixa de seleção carregando e com erro, o cabeçalho de seção com erro e o **Continue** com erro. O **Continue** desabilitado não mostra `Enter`;
- o subtítulo de **New task** na Home diz o que o clique faz (seção 2.2);
- o controle segmentado declara só `aria-checked`.

## 1. A régua

As três peças são mínimas, como a tela da task (`decisions.md`, 2026-09-24). Cada elemento justifica por que existe, ou sai.

- **A Home** tem o que retoma o trabalho e o que o começa. O que espera o usuário é da árvore, e a Home não o repete.
- **A linha do card** mostra só o que decide a escolha: o número, o título, o épico, a dependência não satisfeita e a task ou a discussão do card. O resto espera o clique.
- **O card aberto** é o único lugar de **Start task** e **Discuss**, além das teclas da linha. O cabeçalho do board não tem **Start task**.
- **O diálogo** tem poucos campos com os padrões de Settings. O contexto do card e os modelos ficam a um clique.

## 2. A Home

### 2.1 Anatomia

A Home é o lugar sem item aberto (`structure.md` §1). O cabeçalho tem `←` e o título `Home`. O corpo é uma coluna na medida `--measure-read`, centrada em pixel inteiro, com `--space-16` mais `--space-8` no topo e `--space-8` entre as seções. As seções têm um título em caixa alta de `--text-caps`, em `--ink-3`. De cima para baixo:

1. **Continue**;
2. **Start**, as ações de início;
3. **Boards**, os boards e os repositórios, com o estado da leitura;
4. a linha dos atalhos.

### 2.2 As seções

**Continue.** É o último item ativo aberto, lembrado entre execuções. É um botão elevado (`--surface-2`, `--shadow-xs`, raio `--radius-lg`) com duas linhas:

- **linha 1:** o glifo de tipo em `--brand-ink` e o nome em `--text-body` e peso 600. À direita fica a tecla `Enter`;
- **linha 2:** o glifo da situação, o que ela pede com a posição (`Question · Reviewer · Step 3/7`), o chip do tempo e onde o item vive (`· Platform Roadmap / API hardening`, em `--ink-3`). Sem situação, a linha diz a posição e o estado, como a árvore.

O foco começa nele, então `Enter` abre o item no lugar da situação. O nome acessível é a frase inteira. Quando nenhum item está ativo, a seção dá lugar a `Nothing in progress` / `No task, review or discussion is active. Start one from a card, a pull request or a board.`

O item de **Continue** é o primeiro item ativo que ainda existe entre o lugar na tela e os lugares atrás dele, do mais recente ao mais antigo; sem nenhum, o último item ativo aberto guardado; sem ele, o item ativo criado por último. Então um item arquivado ou apagado nunca fica em **Continue**: o anterior toma o lugar dele, e **Continue** não tem estado desabilitado. Onde o item vive é o breadcrumb dele (`Platform Roadmap / API hardening`, `No board`, `Reviews`).

**Start.** São três linhas de lista, cada uma com o ícone, o rótulo em peso 500, o subtítulo em `--ink-3` e a tecla à direita, quando há:

- **New task** · `From scratch. A card starts its task on its board.` · `Ctrl N`. Abre o diálogo livre;
- **Review a pull request** · `4 pending in 3 repositories`. Vai a Reviews;
- **New discussion** · `About the demand of one board`. Abre o diálogo de discussão (seção 2.3).

**Boards.** Uma linha por board, em ordem alfabética. Cada linha tem o ícone, o título e, em `--ink-3`, os cards abertos fora dos status finais (o que ainda se escolhe; num board sem campo de status, todos os abertos) e os repositórios (`46 open cards · api, billing, docs, gateway, web`, os nomes curtos em ordem alfabética; `No open cards`; num board nunca lido, `Not read yet`). À direita fica a idade da leitura (`read 2m ago`) ou `◇ Read failed 18m ago`, e, num board nunca lido, `reading…` durante a primeira leitura; durante qualquer leitura, o texto da direita brilha. A linha abre a visão do board. Sob ela, recuadas, ficam as linhas do que bloqueia sem ser situação:

- a razão da falha, com **Try again** (`GitHub's rate limit was reached. It resets at 14:32.`);
- `◇ acme/billing isn't cloned. Its cards can't start a task yet.`, com **Clone**;
- `◇ The clone at ~/code/infra is missing.`, com **Change path…**.

A falha da leitura vem primeiro; depois, uma linha por repositório do board, em ordem alfabética, com o caso dele (sem clone ou clone inexistente), e não agrupadas por caso.

Os repositórios sem board ficam numa última linha, **No board**, com os avisos deles.

**Atalhos.** Uma linha com as teclas e o que fazem: `Ctrl J` Next that needs you, `Ctrl N` New task, `Alt ←` Back, `Ctrl ,` Settings.

### 2.3 O diálogo de discussão a partir da Home

**New discussion** abre o diálogo de discussão. Quando há mais de um board, o primeiro campo é **Board**, um seletor com a lista dos boards. Cada board da lista tem os repositórios e a idade da leitura, e um board com a leitura falha diz `◇ read failed 18m ago · uses the last reading`; um board nunca lido fica desabilitado, com `not read yet`, como o **New discussion** do cabeçalho dele. A lista vem no board da última discussão criada, ativa ou arquivada, marcado `last used`. O **New discussion** do menu **+ New** da lateral abre o mesmo diálogo com o campo **Board** quando o lugar na tela não tem board (a Home, Reviews, History, Settings, uma task sem board); num lugar com board, o board é fixo. Trocar o board mantém o título e o texto já escritos. A ajuda do campo diz `The discussion reads the clones of the board's repositories and publishes its cards there.` Com um board só, o campo não aparece, e o board é fixo, como a partir da visão do board.

O resto do diálogo é o de `features.md` (Criar uma discussão), e a forma dele é da tela da discussão. Aqui ficam o que a Home e o board usam:

- **Title**, obrigatório, até 120 caracteres, com o contador a partir de 100 e `Use at most 120 characters.`;
- **What to discuss**;
- os cards, quando vêm de uma seleção ou de **Discuss**;
- o aviso dos repositórios sem clone, com **Clone**;
- o modelo, partindo do padrão de discussão.

**Start discussion** fica desabilitado, com `Write what to discuss or select at least one card.` ao lado, até haver texto ou um card. `Ctrl+Enter` confirma.

### 2.4 A árvore com a Home

Nenhuma linha da árvore fica selecionada. Sem item ativo, cada board mostra `No active items.` e Reviews mostra `No review in progress.` com a contagem de pendentes.

## 3. A visão do board

### 3.1 O lugar e o layout

A visão do board é um lugar na área principal. O nó do board na árvore fica marcado como o lugar aberto, com o véu `--brand-veil`, o anel `--brand-ring` e `aria-current="page"`. Abrir a visão relê o board.

A área principal, de cima para baixo:

- **o cabeçalho**, uma faixa de `--size-head`, com um fio embaixo;
- **a coluna da lista**, que rola, com a largura `--list-measure` (70rem) centrada em pixel inteiro e `--space-6` dos lados. A barra de filtros fica fixa no alto dela, com um esmaecido de `--space-3` por baixo;
- **o painel do card**, à direita, quando um card está aberto (seção 3.5).

### 3.2 O cabeçalho

Da esquerda para a direita:

- **`←`**, com o destino no tooltip (`Back to Rate limit per API key · Alt+←`). **`→`** aparece só com destino;
- **o título** do board, em `--text-body` e peso 600;
- à direita, **a idade da lista na tela** (`Read 2m ago`, em `--text-micro` e `--ink-4`, com a hora exata no tooltip). Durante uma leitura ela diz `Reading…` com o spinner (`role="status"`);
- **Refresh**, fantasma de ícone, tracejado durante uma leitura;
- um divisor e **New discussion** `N`, secundário, que abre o diálogo de discussão com o board fixo e sem cards;
- **`⋯`**, com **Select cards to discuss** `Space`, **Open on GitHub** e, depois de um separador, **Edit the board in Settings…**.

Não há **Start task** no cabeçalho: uma task começa de um card.

### 3.3 A busca e os filtros

A barra fica fixa acima da lista e tem, da esquerda para a direita:

- **a busca**, um campo de `--size-control-sm` com a lupa, o placeholder `Search cards` e a tecla `/`. Casa com o título, sem diferenciar maiúsculas nem acentos, e com o número, com ou sem `#`. Com texto, a tecla dá lugar a `×`, que limpa;
- **Assigned to me**, um chip que alterna (`aria-pressed`). Filtra pelo usuário do `gh`. Sem `viewer`, fica tracejado, com `gh didn't say who you are`;
- **cada filtro ativo**, como um chip escolhido com `×`: `acme/api`, `Assignee: tchen`, `Status: Ready`;
- **Filter**, um chip que abre o menu com três grupos de escolha: **Repository** (os do board), **Assignee** (o usuário marcado `· you`) e **Status** (as opções do board e `No status`, só num board com campo de status);
- **Clear filters**, fantasma, só com algum filtro ativo.

Os filtros combinam entre si e são lembrados por board entre execuções. Um filtro de um repositório que saiu do board, ou de um status que saiu das opções, vira um chip com `◇` e a razão no tooltip, continua filtrando, e o `×` o remove. Abaixo de 620 px de lista, a busca encolhe para `--space-16` vezes 3.

### 3.4 As seções por status e a linha do card

**As seções.** Há uma seção por opção do campo de status, na ordem do board, **mesmo vazia**, para a lista não pular quando o filtro muda. Um board sem campo de status tem uma seção só, `Cards`. A seção `No status` aparece quando a leitura tem card sem status, com a contagem filtrada, e não some pelo filtro. O cabeçalho da seção tem `--size-node` de altura, o chevron, o nome em `--text-meta` e peso 600 e a contagem já filtrada em `--ink-4`. Uma seção vazia não tem chevron nem ação.

**A regra das finais.** As seções de status final começam recolhidas. O que o usuário recolhe ou expande é lembrado por board. Dentro de uma seção, as issues abertas vêm antes das fechadas, cada grupo na ordem do board. Uma issue fechada numa seção não final fica com o título em `--ink-4`, que sobe a `--ink-3` na linha aberta (o contraste de 4,5:1 com o hover e o pressionado nos dois temas), com `Closed` no nome acessível. Uma seção final tem o tooltip `A final status: folded when the board opens`.

**A linha do card.** É uma linha de `--size-control` (32 px), numa grade de colunas de largura fixa, para as colunas se alinharem de linha em linha. Os campos, da esquerda para a direita:

| Coluna | Largura | Conteúdo |
|---|---|---|
| Início | `--icon` | Vazia. No card de um épico, o glifo de épico. No modo de seleção, a caixa |
| Número | `--col-num` | `#474`, em `--text-meta` e `--ink-4`, com algarismos tabulares |
| Título | o resto | Em `--text-ui` e `--ink-1`, cortado com tooltip. O título de um épico fica em peso 500 |
| Épico | `--col-epic` | O título do épico em `--ink-3`, cortado com tooltip. No card de um épico: `Epic · 2 of 8 finished` |
| Dependência | `--col-dep` | Só com uma dependência não satisfeita: `◇ #461`, e `+N` quando há mais (`◇ #461 +1`). O losango contornado, em tinta neutra, nunca âmbar. O tooltip diz cada uma: `Depends on #461 Metering events from the gateway · open, Backlog. A warning: it never blocks.` A dependência de outro repositório fica só com o número na linha (`◇ #461`), e o tooltip põe o repositório antes dele (`Depends on acme/gateway#461 …`), como o painel |
| Task | `--col-task` | Com uma task ativa, o glifo e a forma curta da linha 2 da árvore (`structure.md` §2), com `+N` quando há mais situações: `● Question · Step 3/7`, `◌ Step 2/5 · pass 2`, `◆ Session error · Plan`, `‖ Paused · PRD`. Com espera ou erro, o rótulo fica em `--ink-1` e peso 500. Sem task e com o card numa discussão ativa, o glifo da discussão e `In discussion`, em `--ink-3`. O tooltip tem a task inteira |
| Teclas | `--col-keys` | `S start` e `D discuss`, visíveis só na linha com o foco do teclado, e só as que agem: `S` num card sem task que pode começar uma, `D` em todo card que pode entrar numa discussão |

O repositório, os responsáveis, os campos, as PRs e o status não estão na linha. O status é a seção, e o resto fica no card. O nome acessível da linha é a frase inteira: `#474 Usage alerts at 80% of the plan. acme/api. Ready. epic Usage-based billing. depends on #461, not satisfied`, com a task e o tempo de espera, a discussão e, no modo de seleção, se está marcado.

**Estados da linha.**
- Hover: `--veil-hover`.
- Foco: o anel por fora, e as teclas aparecem.
- Pressionada: `--veil-press`.
- **Aberta** (o card no painel): `--brand-tint-plane` com anel `--brand-ring`, o glifo de épico em `--brand-ink`, o número em `--ink-3` e o título de uma fechada em `--ink-3`.
- Desabilitada: no modo de seleção, um card que não pode entrar numa discussão, tracejado.
- Carregando: `Cloning acme/billing…` com o spinner na coluna da task, enquanto **Clone and continue** roda.
- Erro: `Clone failed` em vermelho na coluna da task, com o trilho.
- Um card novo de uma leitura pisca duas vezes no véu neutro.

**O que cede na largura.** A regra depende da largura da própria lista (container query), em limites fixos:

- **acima de 1040 px de lista**, uma linha só, com todas as colunas;
- **até 1040 px** (a metade do monitor, ou a lista ao lado do painel até cerca de 2050 px de janela), a grade fica com o início, o número, o título e as teclas. O épico, a dependência e a task descem para **uma segunda linha sob o título**, da coluna do título à das teclas, em `--text-meta`, com `--space-4` entre eles, sem quebrar: a dependência e a task ficam inteiras, e o épico corta com tooltip, e sai da segunda linha quando sobra a ele menos de `--space-12` (só quando a dependência e a task não cabem juntas a task também corta). Uma linha sem nenhum dos três continua com uma linha só;
- **nada que decide a escolha sai**. O título tem sempre ao menos um terço da linha, e as teclas têm a coluna delas, então aparecer no foco nunca tira largura do título.

A 1250 px com o painel aberto, `#474 Usage alerts at 80% of the plan` tem embaixo `Usage-based billing · ◇ #461`, e `#412 Rate limit per API key` tem `API hardening · ● Question · Step 3/7`.

### 3.5 O painel do card

**Abrir.** `Enter` ou o clique numa linha abrem o card no painel, ao lado da lista. Abrir outro card troca o conteúdo do painel. `Esc`, o `×` ou `Enter` na linha aberta fecham. O painel abre só por uma ação do usuário e nunca sozinho. O teclado continua na lista: `↓` e `Enter` trocam o card do painel.

**Forma e largura.** É o painel auxiliar de `structure.md` §3, afundado (`--surface-0`) ao lado da lista. É mais largo que os painéis da task, porque o corpo do card é lido ali:

- largura `--panel-card-width`, `clamp(22.5rem, 42%, 40rem)` da área principal, arredondada para baixo ao pixel;
- fica ao lado enquanto a lista mantém 440 px, o que vale exatamente a partir de 800 px de área principal; abaixo disso, cobre a lista com `--surface-3` e `--shadow-overlay`. De 1100 a 2600 px de janela, fica sempre ao lado (a 1100 px, a área tem 812 px e a lista 452).

**O que mostra**, de cima para baixo:

1. **A faixa do painel:** `#474 · acme/api` em `--text-meta` e `--ink-3`, **Open on GitHub** e `×` (`Close · Esc`).
2. **O título** em `--text-title` e peso 600, e embaixo **o status** em peso 500, `· Closed` numa issue fechada, e o épico (`Ready · Usage-based billing`).
3. **As ações** (seção 3.6), com a razão ao lado quando uma não age.
4. **A dependência não satisfeita**, uma por aviso, contornada por `--line-2` (o painel já é afundado): `◇ Depends on #461 Metering events from the gateway` e `acme/gateway · Open · Backlog · no pull request. A warning only: it never blocks.`
5. **A task do card**, quando há:
   - a ativa é um objeto elevado com o glifo de tipo, o nome, a situação com a posição e o chip do tempo (`● Question · Reviewer · Step 3/7 18m`) e **Open**, que abre a task;
   - sem ativa, a arquivada mais recente (`Archived task: 409-hash-api-keys-at-rest`, um link que abre no History);
   - a discussão, quando o card está numa, de entrada ou como autora ativa (`In the discussion Usage-based pricing tiers`, um link), ou a autora arquivada (`From the discussion Usage alerts`, que abre no History).
6. **Os campos**, numa lista de chave e valor em `--text-meta`: os campos preenchidos do board (`Module`, `Estimate`, datas), na ordem que o GitHub devolve, e `Assignees`.
7. **O corpo**, em Markdown, no registro de leitura (`--text-read`), com títulos em `--text-ui` e peso 600, código, tabelas, imagens e mermaid, depois de um fio. Um corpo vazio diz `No description.`
8. **As relações**, cada grupo com o título em caixa alta e uma linha por card (número, título, status), e cada card do board abre com um clique:
   - **Epic**, com `2 of 8 finished`;
   - **Cards of the epic · 6**, os irmãos com o status no board, ou o estado da issue fora dele (um irmão fora do board é um link externo);
   - num épico, **Cards · 8**;
   - **Dependencies**, todas, com `◇ Not satisfied` nas que faltam, o estado, o status e as PRs;
   - **Pull requests**, `#1291 · Open`, com o repositório antes do número só quando é outro (`acme/web#88 · Merged`).

O painel mantém o card quando uma leitura nova ainda o traz.

### 3.6 Start task, Discuss, New discussion e o modo de seleção

**As ações do card.** **Start task** `S` é a única ação primária da tela, e **Discuss** `D` é secundária. Cada caso de `features.md` (Start task) tem a sua forma:

| Caso | Ações | Ao lado |
|---|---|---|
| Aberto, repositório do board com clone | **Start task** `S` abre o diálogo de criação do card. **Discuss** `D` | — |
| Repositório sem clone | **Clone and continue** `S` (primário, com o ícone). **Discuss** | `acme/billing isn't cloned yet. A task needs a clone.` Clonando: `Cloning acme/billing…` com o spinner e `The dialog opens when the clone ends. You can leave the board meanwhile.` Com falha: **Try the clone again** e a mensagem do `gh` em vermelho |
| Clone inexistente | **Start task** tracejado, **Change path…**, **Discuss** | `The clone at ~/code/api is missing.` |
| Repositório sem board ou não cadastrado | **Start task** `S`, que abre **Add acme/status-page to the board** primeiro. **Discuss** tracejado | `acme/status-page isn't managed by this board. Start task adds it first.` |
| Repositório de outro board | **Start task** e **Discuss** tracejados | `acme/ios belongs to the board Mobile App.` |
| Card com task ativa | Só **Discuss** `D`. A task fica no bloco dela | — |
| Issue fechada | Só **Discuss** `D` | `The issue is closed.` |

**As teclas na linha.** `S` e `D` valem na linha em foco e, com o foco no painel, para o card dele.
- `S` age como **Start task**, ou como **Clone and continue**, que abre o card com o foco nele.
- Num card em que `S` não age, o aviso de tecla (`system/components.md`) diz por quê: `No task from #412 · #412 already has a task: 412-rate-limit-per-api-key.` (o nome da task), `No task from #409 · The issue is closed.`, `No task from #104 · acme/ios belongs to the board Mobile App.`, `No task from #488 · The clone at ~/code/api is missing.`, e no card fora da leitura, `No task from #466 · The card isn't in the last reading of the board.`; no modo de seleção, `S` não age e não avisa. O aviso do painel fica preso à linha das ações
- `D` abre o diálogo de discussão com a seleção, ou, sem seleção, com o card do foco, se ele pode entrar numa discussão; num card que não pode, o aviso diz `#104 can't go into a discussion · acme/ios isn't a repository of this board.`, no card fora da leitura, `#466 can't go into a discussion · The card isn't in the last reading of the board.`, e no modo de seleção sem nenhum marcado, `No card is selected · Select a card with Space.`

Quando uma leitura termina um clone, o diálogo de criação abre sozinho, mesmo com o usuário fora da visão, como em `features.md`.

**New discussion** fica no cabeçalho, com `N` de qualquer ponto da visão fora de um campo. Abre o diálogo de discussão com o board fixo e sem cards. É a ação diária sem card: 10 das 11 discussões guardadas começaram assim.

**O modo de seleção** existe só quando pedido: **Select cards to discuss** no `⋯`, ou `Space` numa linha, que entra no modo e já marca aquele card.
- A barra de filtros dá lugar à barra da seleção, neutra (`--surface-0` com anel `--line-2`), com `3 selected`, os números (`#455 #461 #475`, em `--ink-3`), **Discuss 3 cards** `D` (primário) e **Cancel** `Esc`; com algum filtro ou busca ativos, a barra diz também `· filtered`, com o filtro no tooltip, porque a lista continua filtrada. Sem nenhum marcado, **Discuss cards** fica tracejado, com `Select a card with Space`.
- As linhas ganham a caixa na coluna de início. O clique, `Space` e `Enter` alternam. Entrar no modo fecha o painel, e o card não abre durante ele, para a tela ter uma primária só (**Discuss N cards**); a busca e os filtros esperam o fim do modo, e `/` não age nele.
- Um card que não pode entrar numa discussão tem a caixa tracejada, e `Space` nele diz por quê: `#104 can't go into a discussion · acme/ios isn't a repository of this board.`
- A seleção é da visão: sai ao sair dela. Um card que sai da leitura sai da seleção.

### 3.7 A caixa de seleção

Aparece só no modo de seleção. É uma caixa de `--icon` com borda `--line-3` sobre `--surface-input`, raio `--radius-xs`. Marcada, fica em `--brand` com o visto em `--brand-on`. O alvo é a linha inteira, e a caixa é o sinal.

**Estados.**
- Desmarcada e marcada.
- Hover: a borda em `--ink-3`.
- Foco: o anel da linha.
- Pressionada: `--brand-tint-press`.
- Desabilitada: tracejada, sem fundo.

No `tree`, a linha tem `aria-checked` no lugar de `aria-selected` e a lista `aria-multiselectable`. **Select cards to discuss** fica tracejado com `· no card to select` quando nenhuma linha está visível.

### 3.8 Leitura e falhas

Uma leitura nunca apaga a lista: a visão mostra a leitura guardada enquanto lê.

| Estado | Cabeçalho | Lista | Árvore |
|---|---|---|---|
| Lida | `Read 2m ago` | A lista | — |
| Lendo sobre a última | `Reading…` com o spinner; **Refresh** tracejado | A lista guardada | `reading…` com brilho no nó |
| A última leitura falhou | `Read 2h ago`, a idade da lista na tela | Uma faixa afundada no alto da lista, nunca vermelha: `◇ Couldn't read the board · 4m ago`, a mensagem de `features.md` (Falhas) e **Try again**. Tentando: **Try again** vira `Reading…` com o spinner | `◇ Read failed`, com a razão no tooltip |
| Nunca lida, lendo | `Reading…` | O esqueleto de quatro linhas com brilho (`role="status"`) | `reading…` |
| Nunca lida, falhou | — | No lugar da lista: `Couldn't read the board`, a mensagem e **Try again** | `◇ Read failed` |
| Board que saiu do estado com a visão aberta | — | A página do lugar que saiu (`structure.md` §1): `This board was removed.`, com a volta ao lugar anterior | — |

A falha nunca é situação, nunca notifica e nunca é vermelha.

### 3.9 Card fora da leitura, sem clone, vazio e filtro sem resultado

- **Card fora da última leitura.** O card aberto não fecha em silêncio. O painel fica, e no alto dele entra a faixa `◇ This card isn't in the last reading of the board.` com `It left the board, or its issue closed more than 14 days ago. The reading of 14:08 doesn't have it, so a task or a discussion can't start from it.` As ações ficam tracejadas, com `aria-describedby` na faixa. A linha já saiu da lista. O painel fecha pelo `×` ou por `Esc`. Um card marcado sai da seleção em silêncio.
- **Repositório sem clone.** **Clone and continue** no lugar de **Start task** (seção 3.6). O aviso também aparece na Home e no filtro da lateral.
- **Board vazio.** No lugar da lista, sem a barra de filtros: `This board has no issues.` / `Cards appear after a reading finds open issues, or issues closed in the last 14 days. A discussion publishes new cards here.` e **New discussion**.
- **Filtro sem resultado.** A barra fica, e no lugar da lista: `No cards match the filters.`, o que foi pedido (`Nothing on the board has "refund" in the title or the number, assigned to tchen.`) e **Clear filters**.

## 4. A criação de task

### 4.1 O diálogo

É o diálogo de criação do sistema: sobre `--scrim`, `--surface-3`, `--shadow-overlay`, raio `--radius-xl`. A largura é `--size-dialog-wide` (576 px), para caber um nome de 64 caracteres em mono de 13 px. Fica a uma altura fixa do topo (8% da janela, em pixel inteiro) e cresce para baixo, então abrir **Models** não move o título. O corpo rola quando passa da janela.

- **Título:** `New task`, com o `×` (`Close · Esc`).
- **Rodapé** afundado: a razão quando **Create** está desabilitado, **Cancel** (fantasma) e **Create** `Ctrl ↵`, o único primário.
- O foco começa em **Name** e fica preso no diálogo. `Esc` fecha. `Ctrl+N`, `Ctrl+J` e `Ctrl+,` ficam inertes com ele aberto.

**Entradas:**
- livre: **New task** da Home, **+ New** da lateral e `Ctrl+N`;
- de card: **Start task** ou `S`, e o fim de um **Clone and continue**.

### 4.2 Os campos

| Campo | Livre | De card | Padrão |
|---|---|---|---|
| **O topo** | **Repository**, um seletor (seção 4.4) | O card num bloco afundado: `#474`, o título em peso 500, e `acme/api · Ready · Usage-based billing` em `--ink-3`. Sem seletor | Livre: o primeiro utilizável entre o repositório do filtro da lateral, o da task aberta, o último usado e o primeiro da lista |
| **Name** | Vazio | Sugerido, `<número>-<slug>` até 64 (`474-usage-alerts-at-80-of-the-plan`) | Em mono, `--text-meta`. A ajuda: `Lowercase letters, digits and hyphens. It names the branch and the worktree.` |
| **Context** | Obrigatório: uma área de texto de quatro linhas, com `What you want to build, in your own words. High level or detailed.` | A linha do contexto montado (seção 4.3) | — |
| **A dependência** | — | Um aviso por dependência não satisfeita, neutro: `◇ Depends on #461 Metering events from the gateway` e `acme/gateway · Open · Backlog · no pull request. A warning only: the task can start.` | Nunca bloqueia |
| **Mode** e **Review mode** | Lado a lado, com o mesmo controle segmentado (`radiogroup`, `←` `→`): `Structured` / `One-Shot` e `Agent` / `Manual`, nesta ordem | Igual | `Structured`; o modo de review de **Defaults** |
| **Models** | O resumo, que abre a lista (seção 4.5) | Igual | Os padrões de **Defaults** |

Cada modo tem a linha do que faz, de `features.md`:
- `A PRD, a tech spec and a plan of steps, each step its own commit. Fixed once the task exists.`
- `One planning conversation writes a single document, implemented in one commit. Fixed once the task exists.`
- **Review mode**: `An agent reviews each step, and the task runs to the pull request on its own.` ou `You review each step in VS Code before its commit.`, com o ícone do robô ou da pessoa em cada opção.

### 4.3 O contexto do card

Uma linha afundada diz o que o produto montou, com o que o card tem, no plural certo. Por exemplo: `From the card: #474, the epic Usage-based billing, 6 cards of the epic, 1 dependency and the discussion Usage-based pricing tiers · 5,690 characters`. Um card sem épico não cita o épico. Um card que não saiu de uma discussão não cita a discussão.

- **Show** abre o texto montado, somente leitura, em Markdown, numa caixa que rola com até nove linhas de altura. **Hide** fecha.
- **Add to it** abre `Additional context`, uma área de texto de três linhas com o placeholder `Anything the card doesn't say. It goes at the end of the context.` O campo só existe depois do clique: só uma task de card em 15 o usou.
- **A releitura:** quando a leitura do card tem mais de 5 minutos, a linha diz `Refreshing the card…` com brilho e **Show** fica tracejado. Se a releitura falha, a linha diz `◇ Couldn't refresh the card: <motivo>. The task will use the last reading.` em tinta neutra, e a criação segue.
- **O card que saiu da leitura** com o diálogo aberto: o corpo dá lugar a `◇ This card isn't in the last reading of the board.`, e o rodapé fica só com **Cancel**.

### 4.4 O seletor de repositório

É o seletor do sistema (`listbox`), com um item por repositório em ordem alfabética e o visto no escolhido. Os que não recebem task ficam desabilitados, com a razão:
- `Not cloned`, com **Clone** no próprio item;
- `Cloning…`;
- `The clone at ~/code/infra is missing.`

O erro de um clone aparece em vermelho no item e sob o seletor.

### 4.5 Os modelos

**O resumo.** **Models** é uma linha que abre e fecha no lugar, com o chevron. À direita, o resumo considera só as etapas do modo escolhido:
- `Defaults`;
- ou a primeira etapa ajustada, `+N` e `the rest from Defaults` (`One-Shot planning: Fable 5.1 · xhigh · the rest from Defaults`).

**A lista.** Aberta, é uma linha por etapa do modo:
- Structured: `PRD`, `Tech spec`, `Plan`, `Implementation`, `Step review`, `PR`, `PR review`;
- One-Shot: `One-Shot planning`, `Implementation`, `Step review`, `PR`, `PR review`.

Cada etapa tem um chip de modelo e esforço (`Opus 5.5 (1M) · high`) que abre o `listbox` do modelo, o mesmo das linhas do popover **Models** da tela da task.
- Uma escolha própria fica em `--ink-1` com a borda `--line-3`, e a que segue **Defaults** fica neutra.
- Uma escolha que o catálogo não tem mais aparece com `◇` e `unavailable`, com a razão no tooltip.
- Enquanto o catálogo é lido, o chip mostra a escolha salva com o brilho de leitura (`principles.md` §8), sem spinner; só o `listbox` espera a leitura, como em `screens/rest.md` §2.2.
- Sem nenhuma leitura do catálogo, o `listbox` diz por quê, como em `features.md` (Modelos e esforço).

O ajuste de uma etapa comum aos dois modos sobrevive à troca de modo. `Step review` aparece também com `Manual`.

### 4.6 Validações e erros

**Create** exige o repositório, o nome sem problema, o contexto (só no livre) e nada em curso. Desabilitado, ele diz ao lado o que falta: `Name the task to create it.`, `Fix the name to create the task.` ou `Say what you want to build.`

O nome é validado enquanto se digita, com a borda e o trilho de erro e a mensagem sob o campo (`aria-invalid`, `aria-describedby`):

| Problema | Mensagem |
|---|---|
| Caracteres | `Use lowercase letters, digits and single hyphens.` e o link `Use "rate-limit-v2"` |
| Comprimento | `Use at most 64 characters.` e o link com a sugestão cortada |
| Nome usado no repositório (ativas e arquivadas) | `A task named rate-limit-per-api-key already exists in acme/api.` |

Ao confirmar, **Create** vira `Creating…` com o spinner, **Cancel** fica tracejado, e a razão diz `Starting the first session…`. Os erros da confirmação aparecem em vermelho no rodapé, e o diálogo continua aberto:
- `A task named <nome> already exists in <dono/nome>.`
- `Card #<N> already has an active task: <nome>.`
- `This card isn't in the last reading of the board.`
- `<dono/nome> isn't managed by this board.`
- `The clone at <caminho> is missing.`
- o erro da sessão que não começou, que o Go devolve terminado em `The task was undone.` (`backend.md` P22b); **Create** volta a agir e é o repetir, sem um **Try again** ao lado.

Com a task criada, o diálogo fecha e a task abre, esperando a primeira pergunta do agente.

## 5. As cenas

| Cena | O que mostra |
|---|---|
| `home` | A Home com o foco em **Continue** |
| `home-disc` | **New discussion** da Home, com a lista dos boards aberta |
| `board` | O board em repouso, com o foco numa linha e as teclas |
| `card` | #474 aberto no painel, com a dependência não satisfeita |
| `reading` | A leitura em curso sobre a última |
| `failed` | A faixa da falha sobre a lista guardada |
| `empty` | O board `Internal Tools`, sem issues |
| `filtered` | `refund` e `Assignee: tchen`, sem resultado |
| `stale-card` | #466 fora da leitura, com o painel aberto |
| `no-clone` | #471, de `acme/billing` sem clone, com **Clone and continue** |
| `create` | O diálogo livre: erro no nome, One-Shot, os modelos abertos com um ajuste |
| `create-card` | O diálogo de #474: o nome sugerido, o contexto, a dependência |
| `select` | O modo de seleção com três cards |

`?home=none` mostra a Home e a árvore sem nenhum item ativo.

## 6. Os estados de toda tela (`brief.md` §7)

| Estado | Nesta tela |
|---|---|
| **Vazio** | Board sem issues (seção 3.9). Seção vazia com a contagem 0 e sem chevron. Filtro sem resultado. Home sem item ativo: `Nothing in progress`, e a árvore com `No active items.` em cada board |
| **Carregando** | Board nunca lido: o esqueleto. Releitura: a lista guardada, `Reading…` e `reading…` na árvore. Home: o texto da direita da linha do board brilha (`read 2m ago`, ou `reading…` num board nunca lido). Diálogo: `Refreshing the card…` e os chips de modelo com brilho |
| **Erro** | A faixa da falha de leitura com **Try again**, sempre neutra. O clone que falhou, em vermelho, no card e na linha. Os erros de criação no rodapé do diálogo |
| **Aguardando o usuário** | A task de um card que espera: o glifo âmbar e o rótulo em peso 500 na linha, o chip do tempo no painel e em **Continue** |
| **Agente trabalhando** | O spinner e a posição na coluna da task. Um clone em curso é o app trabalhando: o spinner no botão e na linha |
| **Pausado e ocioso** | A task pausada ou ociosa de um card aparece na linha com o glifo e a palavra da árvore (`Paused · PRD`) |
| **Muitos itens** | 120 cards e 46 visíveis com as finais recolhidas no board real. A lista rola, a barra de filtros fica fixa, e as seções recolhem. A leitura traz até 2.000 issues, e a lista é virtualizada (`structure.md` §7): monta as linhas à vista, a linha com a parada de Tab e a do card aberto no painel; o teclado anda por toda linha, e cada `treeitem` diz `aria-level`, `aria-setsize` e `aria-posinset` entre os seus irmãos |
| **Item que sumiu** | O card que sai da leitura fica aberto com a faixa. O board que sai do estado dá a página do lugar que saiu |

## 7. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `Ctrl+N` | Qualquer lugar | Nova task (o diálogo livre) |
| `Ctrl+J`, `Alt+←`, `Alt+→`, `Ctrl+,` | Qualquer lugar | Como em `structure.md` §5 |
| `Enter` | Home | Abre **Continue**, que tem o foco |
| `↑` `↓` `Home` `End` | Lista do board | Percorrem as linhas e os cabeçalhos visíveis, pulando as seções recolhidas |
| `←` `→` | Lista do board | Recolhem e expandem a seção. Numa linha, `←` recolhe a seção dela e foca o cabeçalho |
| `Enter` | Lista do board | Abre ou fecha o card. Num cabeçalho, recolhe ou expande |
| `Esc` | Visão do board | Fecha o menu, depois o card, depois sai do modo de seleção. Na busca, volta à lista |
| `/` | Visão do board | Foca a busca. `↓` na busca vai à lista |
| `S` | Linha | **Start task** ou **Clone and continue**. Onde não age, diz por quê |
| `D` | Lista | Discussão com a seleção, ou com o card do foco |
| `N` | Visão do board, fora de um campo | **New discussion**, sem cards |
| `Space` | Linha | Entra no modo de seleção e marca, ou alterna |
| `Ctrl+Enter` | Diálogos de criação | **Create**, **Start discussion** |
| `←` `→` | Controle segmentado | Trocam a escolha |
| `↑` `↓` `Enter` | Menus e `listbox` | Percorrem e escolhem |

`N` e `Space` como entrada do modo de seleção são novos e entram em `structure.md` §5. `S`, `D`, `/` e as setas já estão lá, pelo produto.

A ordem de Tab é: cabeçalho (navegação, **Refresh**, **New discussion**, `⋯`), a barra de filtros, a lista (uma parada), o painel.

## 8. Acessibilidade

- A lista é um `tree` com uma parada de Tab (roving tabindex): os cabeçalhos de seção são `treeitem` de nível 1 com `aria-expanded`, e os cards são `treeitem` de nível 2 com `aria-selected` no aberto. O card abre fora da árvore, no painel.
- O painel é `aside` com o nome `Card #474`. A barra de filtros é `role="search"`, e a barra da seleção é `role="toolbar"`, com a contagem em `role="status"`.
- A idade da leitura durante uma leitura, o esqueleto e o aviso de uma tecla que não age são `role="status"`. A faixa da falha é `role="alert"`.
- Todo botão desabilitado é tracejado, com a razão ligada por `aria-describedby`.

## 9. Os componentes que entram em `system/components.md`

O coordenador consolida. Os estados de cada um estão em `components.html`.

**Novos**
- **Linha do card**, a "linha de lista" que `components.md` deixou para a fase 4: colunas de largura fixa, a coluna das teclas visível no foco, a segunda linha na lista estreita, e os estados da seção 3.4.
- **Cabeçalho de seção**, a seção por status com a contagem, recolhível, vazia sem chevron.
- **Caixa de seleção** (seção 3.7).
- **Barra de filtros**: a busca com `/`, o chip que alterna, o chip de filtro ativo com `×` (e o `◇` do órfão), o menu **Filter** com grupos de escolha.
- **Barra da seleção**, neutra.
- **Faixa da falha de leitura**, afundada, com `◇` e **Try again**; e a **idade da leitura** no cabeçalho.
- **Esqueleto de lista** e **estado vazio de página**.
- **Painel do card**, com a largura e a regra próprias (seção 3.5).
- **Ações do card**, com a razão ao lado em cada caso.
- **Aviso de dependência**: afundado sobre o chão, e contornado por `--line-2` dentro de um painel já afundado.
- **Bloco da task** no card, elevado, com a situação e **Open**.
- **Lista de relações** (épico, irmãos, dependências, PRs).
- **Continue** e a **linha de lista da Home** (a ação de início e o board com o estado da leitura e as linhas de bloqueio).
- **Controle segmentado**, o `radiogroup` do diálogo. A forma da escolhida precisa ser decidida entre a superfície elevada da **Aba** e o `--brand-tint` dos estados comuns ("opção escolhida").
- **Linha do contexto do card** (montado, relendo, com falha) e o **resumo de modelos** com a lista das etapas.
- **Diálogo largo**, `--size-dialog-wide`, a uma altura fixa do topo.

**Tokens novos para `system/tokens.css`**
- `--panel-card-width: clamp(22.5rem, 42%, 40rem)`;
- `--size-dialog-wide: calc(var(--size-dialog) + var(--space-16) + var(--space-8))`, o valor decidido, que a task 5 leva a `tokens.css` com `--col-keys` e `--col-dep` (`tasks/05-board.md` §4.3);
- `--list-measure: calc(var(--measure) + var(--space-16) * 5)`;
- as larguras das colunas da linha, `calc()` de tokens de espaço: `--col-num`, `--col-epic`, `--col-dep`, `--col-task`, `--col-keys`, com os valores e a medida de cada um em `system/components.md` (Tamanhos de layout).

## 10. O que muda em `features.md` e em `structure.md`

**`structure.md` §4, Board**
- O cabeçalho tem **Refresh**, **New discussion** com `N` e `⋯`, e não tem **Start task**. `S` age no card do foco.
- O modo de seleção entra pelo `⋯` ou por `Space`, e não por uma caixa em toda linha.
- O repositório sem clone aparece no card aberto (**Clone and continue**) e na Home, e não na linha.

**`structure.md` §1 e §3**
- A Home abre o diálogo de discussão com a escolha do board.
- O painel `Card` do board tem a largura e a regra de lista da seção 3.5. O painel `Card` da task continua com a regra de `structure.md` §3.

**`structure.md` §5**
- `N` e `Space` na visão do board (seção 7).

**`features.md`, Boards e Visão do board**
- **Cabeçalho:** **New discussion** tem a tecla `N` e abre sem cards. Com cards, a discussão começa pela seleção (`D`, **Discuss N cards**).
- **Filtros:** **Repository**, **Status** e **Assignee** ficam num menu **Filter**, e cada filtro ativo vira um chip.
- **A seleção** é um modo, e não uma caixa em cada linha.
- **A linha do card:**
  - perde o repositório e os avatares;
  - ganha a dependência não satisfeita e `In discussion`;
  - mostra a task com a gravidade real, em vez de `Waits for you` para qualquer situação;
  - na lista estreita, desce o épico, a dependência e a task para uma segunda linha;
  - mostra as teclas `S` e `D` no foco.
- **O painel:** as ações vêm logo depois do título, e o resto segue a ordem da seção 3.5.
- **O card que sai da última leitura** fica aberto com o aviso, em vez de fechar em silêncio.
- **A falha de leitura** aparece como faixa no alto da lista, com **Try again**, mesmo com leitura guardada.
- **O `S`** que não age diz por quê.

**`features.md`, Criar uma discussão**
- A discussão nasce também da Home. O diálogo aberto fora de um board, com mais de um board, tem o campo **Board**, com o board da última discussão como padrão.

**`features.md`, Criação de uma task e A partir de um card**
- `Additional context` aparece só com **Add to it**.
- **Mode** e **Review mode** usam o mesmo controle.
- **Models** é um resumo que abre a lista das etapas.
- A linha do contexto diz o que foi montado, com a discussão.
- **Unsatisfied dependencies** e `Couldn't refresh the card` deixam o âmbar e ficam neutros.
- As ajudas novas: `It names the branch and the worktree.` e `Fixed once the task exists.`

**`features.md`, Tela de boas-vindas e barra lateral**
- Sem nenhuma task ativa, a área principal é a Home (`Nothing in progress` e as ações de início), e não a visão do primeiro board.

## 11. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| `In discussion` de um card que é entrada de uma discussão ativa | A linha e o card | Nenhum: derivável de `discussions[].cards[]` pela chave `dono/nome#N` |
| `In discussion` de um card criado ou atualizado por uma discussão, e a discussão | A linha, o card e a linha do contexto no diálogo | Pequeno: expor no `BoardCard` o que `discussion.Service.DocumentOfCard` já sabe |
| O progresso de um épico (`2 of 8 finished`) | A coluna do épico e as relações | Nenhum: os filhos do board estão na leitura e os de fora em `siblings[]`. Épicos com mais de 50 sub-issues são cortados pela query |
| As partes do contexto montado (épico, irmãos, dependências, discussão) e o tamanho | A linha do contexto | Pequeno: `CardContext` devolve só o texto. Ou o frontend deriva as partes do `BoardCard` e mede o texto |
| O card aberto que saiu da leitura | A faixa do card fora da leitura | Só frontend: guardar o último `BoardCard` aberto em vez de fechar |
| Quando a leitura falhou (`failedAt`) e a hora da leitura (`readAt`) | A faixa da falha e a idade no cabeçalho | Nenhum: chegam e não são mostrados |
| O último item ativo aberto, entre execuções | **Continue** | Só frontend, como em `structure.md` §8 |
| Cards abertos por board e PRs pendentes por repositório | As linhas da Home | Nenhum: deriváveis do `State` |
| O board da última discussão | O padrão do campo **Board** | Nenhum: `discussions[]` e o histórico |
| A discussão criada a partir da Home | O campo **Board** | Nenhum no backend: `CreateDiscussion` já recebe o board. O frontend passa a escolhê-lo |
| Por que `S` não age num card | O aviso | Nenhum: `action`, `otherBoard` e `activeTaskId` já dizem |
