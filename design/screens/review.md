# O centro de review e a tela de um review

Fase 4, decidido em 2026-09-24. Referência visual: `lab/12-screen-review/a.html` (as onze cenas, `?scene=`, e as flags `?own`, `?stale`, `?apply` e `?checkerr`) e `lab/12-screen-review/components.html` (cada componente novo em todos os estados, nos dois modos).

São duas peças da jornada J6 (`brief.md` §4): a lista de pull requests, o lugar **Reviews**, onde o usuário escolhe a próxima PR e inicia o review; e a tela de um review de PR de terceiros, onde ele acompanha a passada, decide os apontamentos e publica. Elas seguem `structure.md` (o shell, a árvore, os painéis, a largura contínua), `principles.md` e `system/`, e reaproveitam as duas telas decididas: a lista, a seção e o painel de `screens/board.md`; o cabeçalho, a conversa, a barra do pedido, o compositor e o cartão de apontamentos de `screens/task.md`. Onde este documento e `structure.md` §3 e §4 divergem, vale este documento. As mudanças estão na seção 18. Os textos de cada caso, o teclado inteiro e o que a implementação precisa decidir estão no material de entrada da task 6, `tasks/06-review.md` §4.

**Onde o mock difere deste documento.** O mock `a.html` mostra a combinação decidida. O `b.html` da rodada é a variação descartada (a coluna de apontamentos), e o diálogo de publicação dele é o mesmo daqui.

## 1. A régua

As duas peças são mínimas, como a tela da task e o board (`decisions.md`, 2026-09-24). Cada elemento justifica por que existe, ou sai.

- **A linha da PR** mostra só o que decide a escolha: a referência, o título, o autor e o estado que importa. O usuário escolhe uma PR por nada especial (`research/interview.md`), então tamanho, idade e checks não entram na linha.
- **O review** é a tela da task sem stepper: uma pílula com a passada, a conversa, a barra do pedido e o compositor. Todo o resto fica em `Details`, em `Reports` ou no `⋯`.
- **Todo review é publicado.** Não existe uma saída sem publicar: um review que não foi publicado espera o usuário até o merge (`research/interview.md`).
- **O código se lê no GitHub.** O apontamento não traz trecho do diff; a localização abre `Files changed` na linha, e o editor é a segunda ação.

## 2. A lista de pull requests

### 2.1 O lugar e o layout

**Reviews** é um lugar na área principal (`structure.md` §1). O nó **Reviews** da árvore fica marcado como o lugar aberto, com o véu `--brand-veil`, o anel `--brand-ring` e `aria-current="page"`. A contagem do nó (`4 pending`) sobe de `--ink-4` para `--ink-3` no nó aberto. Abrir o lugar relê as PRs.

A área principal, de cima para baixo:

- **o cabeçalho**, uma faixa de `--size-head`: `←` com o destino no tooltip, o título `Reviews`, e à direita a idade da lista (`Read 2m ago`, em `--text-micro` e `--ink-4`, com a hora no tooltip; `Reading…` com o spinner durante uma leitura) e **Refresh**, fantasma de ícone, tracejado durante uma leitura;
- **a coluna da lista**, a do board: `--list-measure` centrada em pixel inteiro, com a barra de filtros fixa no alto;
- **o painel da PR**, à direita, quando uma PR está aberta (seção 2.5).

### 2.2 As seções

A lista é agrupada em quatro seções, na ordem:

1. **`Pending`**: nunca revisadas por você, ou com commits depois do seu último review (a regra de `features.md`, Pendente de review). Draft conta como pendente, como no produto;
2. **`In review`**: as PRs com review ativo no MySpec, que a árvore também mostra;
3. **`Reviewed`**: revisadas, sem nada novo desde então;
4. **`Yours and your tasks`**: as suas e as das tasks do produto, que nunca são pendentes.

As duas últimas nunca esperam por você e começam recolhidas. O que você recolhe ou expande é lembrado entre execuções. Dentro de cada seção, a ordem é a do produto: a atualizada mais recentemente primeiro. Uma seção vazia continua, sem chevron, para a lista não pular. O cabeçalho da seção é o do board (`--size-node`, o nome em `--text-meta` e peso 600, a contagem em `--ink-4`), com o tooltip do que a seção reúne. A seção não tem estado de erro: a falha de leitura é a faixa (seção 2.7).

As seções substituem o interruptor **Pending only**. A contagem do nó **Reviews** é a da seção `Pending`: as pendentes que passam pelos filtros, sem as que têm review ativo, que estão em `In review` e na árvore.

### 2.3 A linha da PR

É a linha do card do board (`screens/board.md` §3.4), de `--size-control`, numa grade de colunas de largura fixa:

| Coluna | Largura | Conteúdo |
|---|---|---|
| Referência | `--col-ref` | `web#2291`, em `--text-meta` e `--ink-4`, algarismos tabulares; `--ink-3` na linha aberta |
| Título | o resto | Em `--text-ui` e `--ink-1`, cortado com tooltip. Depois dele, até duas etiquetas contornadas por `--line-2`, em `--text-micro`: `Draft` e a primeira label que não repete o autor (`dependabot` não aparece na PR do dependabot), com `+N` quando há mais labels, que o tooltip lista. As etiquetas não cortam e cedem antes do título: quando ele ficaria abaixo de um terço da linha, elas viram um só `+N`, com `Draft` e todas as labels no tooltip, e, quando nem ele cabe ao lado do terço (a 812 px, com o painel), saem da linha |
| Autor | `--col-author` | O login em `--ink-3`; `you` na sua |
| Estado | `--col-state` | O que importa: `Never reviewed` e `3 new commits` em `--ink-2`, peso 400, os dois com o mesmo peso porque nenhum é situação (`New commits` quando o commit do seu review não está entre os 100 últimos da PR); com review, o glifo e a linha 2 da árvore na forma longa (`● Decide findings · pass 1 · 1/3` em `--ink-1` e peso 500 quando espera por você; `○ Published · changes requested` quando não), e a forma curta quando a longa não cabe; `Task · Rate limit per API key` com o glifo da task; `Yours`; `Reviewed` em `--ink-3`, com o seu review no tooltip (`You approved it today at 10:02`); numa PR de fork, `From a fork · can't be reviewed yet` |
| Teclas | `--col-keys` | `R review`, `R open` ou `R open task`, visível só na linha com o foco |

Sem tamanho, idade, checks, card, labels na segunda linha e ícone **Open on GitHub**: o card, os checks e a descrição estão no painel, e `O` abre a PR no GitHub. O nome acessível é a frase inteira: `api#1302 Idempotency keys for payment retries. by lnakamura. pending: never reviewed`, com o draft e o review quando há.

**Estados da linha.** Hover `--veil-hover`, foco com o anel por fora e a tecla, pressionada `--veil-press`, aberta (`--brand-tint-plane` com anel `--brand-ring`), desabilitada numa PR de fork (tracejada, com a razão na coluna do estado; continua no percurso e abre o painel), carregando enquanto o repositório clona por **Clone and continue** (spinner e `Cloning acme/docs…`) e erro (`Clone failed` em vermelho, com o trilho, enquanto a falha do clone existir). O início do review tem os estados dele no diálogo, não na linha.

**O que cede na largura.** Abaixo de 1040 px de lista (a metade do monitor, ou a lista ao lado do painel), a grade fica com a referência, o título e as teclas, e o autor e o estado descem para uma segunda linha sob o título, como no board: o estado passa à forma curta quando a longa não cabe, e só então corta, com tooltip. O título tem sempre ao menos um terço da linha.

### 2.4 Os filtros

A barra de filtros é a do board, fixa acima da lista, com o mínimo:

- **Filter**, um chip que abre o menu com quatro grupos: **Board** (os boards e `No board`), **Repository**, **Author** e **Label**;
- em **Author** e **Label**, cada valor alterna, a cada clique, entre sem filtro, oculto (`−dependabot`) e só este (`+rsouza`), como em `features.md` (Filtros). O menu fica aberto enquanto se alterna. Cada item tem o nome acessível com o estado (`dependabot: hidden. Click to cycle.`);
- cada filtro ativo vira um chip escolhido com `×`: `Board: Mobile App`, `acme/web`, `Author −dependabot`;
- **Clear filters**, fantasma, só com algum filtro ativo.

Os filtros valem para a lista e para a contagem do nó **Reviews**, não escondem os reviews ativos da árvore e são lembrados entre execuções.

### 2.5 O painel da PR

**Abrir.** `Enter` ou o clique numa linha abrem a PR no painel, ao lado da lista. É o painel do card do board (`screens/board.md` §3.5), com a mesma largura (`--panel-card-width`) e a mesma regra: fica ao lado enquanto a lista mantém 440 px. Abrir outra PR troca o conteúdo; `Esc`, o `×` ou `Enter` na linha aberta fecham. O teclado continua na lista.

`R` na linha não passa pelo painel: começa o review direto (abre o diálogo de início), abre o review que já existe, ou abre a task dona da PR. O painel existe para o que a linha não diz e às vezes decide o momento: os checks, que seguram a primeira passada, o card e a descrição.

**O que mostra**, de cima para baixo:

1. **A faixa do painel:** `api#1302 · acme/api` em `--text-meta` e `--ink-3`, **Open on GitHub** (`O`) e `×` (`Close · Esc`).
2. **O título** em `--text-title` e peso 600, e embaixo o autor em peso 500, o estado (só numa PR sem review; com review, o estado fica no bloco dele), `Draft` e `updated 2 hours ago`.
3. **A ação**, com a razão ao lado quando não age:

| Caso | Ação | Ao lado |
|---|---|---|
| Pendente, revisada ou sua | **Start review** `R`, primária | Com checks rodando: `The first pass waits for the checks: 2 not finished.` Na sua: `Your own pull request: the review can publish a comment, or apply its findings.` |
| Com review ativo | Um bloco elevado com o glifo do review, `Review of web#2291`, a situação com o chip de tempo, e **Open review** `R` (primária quando o review espera por você) | — |
| De uma task | O bloco da task, como no card do board, com **Open task** | `The review of this pull request happens in its task.` |
| De um fork | **Start review** tracejado | `Pull requests from forks can't be reviewed yet.` |
| Clone inexistente | **Start review** tracejado, **Change path…** | `The clone at ~/code/web is missing.` |
| Repositório sem clone | **Clone and continue** `R`, primária, como no board (`R` na linha abre o painel com o foco nele). Clonando: `Cloning acme/docs…` com o spinner; com falha, **Try the clone again** e a mensagem do `gh` em vermelho | `acme/docs isn't cloned yet. A review needs a clone.`; clonando, `The dialog opens when the clone ends.` |

4. **Os checks pelo nome**, o bloco `.gh` da task (seção 6), com o resumo (`3 of 5 passed · 2 not finished`, `1 failed · 3 of 4 passed`) e a idade da leitura; numa PR de um repositório cuja leitura falhou, a idade dá lugar a `◇ acme/ios couldn't be read · 4m ago`, porque os checks são da leitura anterior.
5. **Os fatos**, em chave e valor: `Branch` (`idempotency-keys → dev`, em mono), `Card` (o número como link, o título e o status no board; um card da leitura do board abre o painel dele na visão do board, como o painel `Card` da task, e o resto abre no GitHub), `Labels`, e `Your review` numa PR revisada (`You approved it today at 10:02`).
6. **A descrição** da PR, em Markdown, no registro de leitura, depois de um fio.

### 2.6 O vazio

- **Nenhuma PR aberta:** no lugar da lista, `No open pull requests.` / `The list shows the open pull requests of your 12 repositories, from any author. MySpec reads them every 5 minutes and when you open Reviews.` e **Read now**. A árvore diz `No review in progress.` sob **Reviews**.
- **Sem repositórios:** `Register a repository to see its pull requests.`, o texto do produto.
- **Filtros sem resultado:** a barra fica, e no lugar da lista: `No pull requests match the filters.`, quantas estão abertas, e **Clear filters**.

### 2.7 Leitura e falhas

Uma leitura nunca apaga a lista: a visão mostra a leitura guardada enquanto lê.

| Estado | Cabeçalho | Lista | Árvore |
|---|---|---|---|
| Lida | `Read 2m ago` | A lista | `4 pending` |
| Lendo sobre a última | `Reading…` com o spinner; **Refresh** tracejado | A lista guardada | — |
| Um repositório falhou | A idade da lista | Uma faixa afundada no alto da lista, nunca vermelha, uma por repositório, na ordem alfabética: `◇ Couldn't read acme/ios · 4m ago` (a primeira falha da sequência, que fica enquanto o repositório falha e some na primeira leitura boa), a mensagem do `gh` (as seis de `features.md`, Leitura das pull requests) e **Try again**, que relê a lista inteira (`Reading…` em todas as faixas enquanto lê). As PRs desse repositório continuam como a última leitura as tinha, sem a faixa dizer isso | — |
| Nunca lida, lendo | `Reading…` | O esqueleto de quatro linhas | — |

A falha nunca é situação, nunca notifica e nunca é vermelha.

## 3. Iniciar um review

**R** na linha, ou **Start review** no painel, abre o diálogo de início. É o diálogo do sistema, largo (`--size-dialog-wide`), a `8vh` do topo, em pixel inteiro, e cresce para baixo.

- **Título:** `Review api#1302`, com o `×`.
- **A PR** num bloco afundado: a referência em `--col-ref`, o título em peso 500, e embaixo o autor, a branch e o card (`lnakamura · idempotency-keys → dev · card #452`).
- **A espera dos checks**, quando algum roda: `◌ The first pass starts when the checks finish: 3 of 5 passed. You can leave meanwhile.`
- **Model**, o chip do seletor de modelo e esforço, com o padrão de review de PR de **Defaults** (`Opus 5.5 (1M) · high`) e `From Defaults. It can change in the conversation.`
- **Atrás de um clique:**
  - **Add instructions** abre **Instructions** (`optional`), uma área de texto de três linhas com `What to look at in this pass.` e `They go to the agent with the pull request, and show as your first message.`;
  - numa PR sua, **Mode · Publish** abre o controle segmentado **Publish** / **Apply**, com a linha do que cada um faz de `features.md` e `Fixed once the review starts.` Para outro autor, o modo é Publish e não aparece.
- **Rodapé:** **Cancel** e **Start review** `Ctrl ↵`, o único primário. O foco começa em **Start review** (ou no campo de instruções, se aberto). `Esc` fecha.

**Estados.** Iniciando: `Starting…` com o spinner, **Cancel** tracejado e `Creating the worktree…` no rodapé. Desabilitado, quando a PR saiu da leitura com o diálogo aberto (`api#1298 isn't in the last reading. It was merged or closed.`). Erro, com a razão do git no rodapé, em vermelho (`git worktree add failed: … Nothing was created.`), e **Start review** volta a agir: ele é o repetir, sem um **Try again** ao lado. As recusas de `features.md` (Iniciar um review) aparecem assim no rodapé.

Com o review criado, o diálogo fecha, a PR ganha o estado na lista, o review entra na árvore, e o review abre esperando os checks ou já na passada.

## 4. O cabeçalho do review e a pílula

A tela do review é a tela da task (`screens/task.md` §2), sem abas e com uma pílula no lugar do stepper.

**O cabeçalho**, da esquerda para a direita:

- **`←`**, com o destino no tooltip; **`→`** só com destino;
- **o breadcrumb** `Reviews /`, que dobra em `…` pela mesma regra da task;
- **o título** da PR, em `--text-body` e peso 600. A referência e o autor ficam na árvore e em `Details`, como na task;
- **a pílula** (abaixo);
- à direita, o **medidor de contexto** (só com a sessão), **Pause** ou **Resume**, o grupo de painéis **Details** e **Reports**, e **`⋯`**.

O topo cede pela largura com os limites da task (§3).

**A pílula** é a etapa atual do stepper, sozinha: `--brand-tint-plane` com o anel `--brand-marker-ring`, o nome `Pass 1` em `--brand-ink` e peso 600, um divisor, e o glifo do estado. A palavra aparece só sem barra do pedido, pela regra da task (a situação é dita uma vez):

| Momento | Pílula | Glifo |
|---|---|---|
| Esperando os checks | `Pass 1` · `checks 4/6` | círculo tracejado do GitHub |
| Passada rodando | `Pass 1` · `working` | spinner |
| Apontamentos, pronto para publicar, commits novos | `Pass 1` (a barra diz o que é pedido) | disco âmbar |
| Publicado, ocioso | `Pass 1` · `published` | círculo fino |
| Check que falhou ou conflito depois da publicação | `Pass 1` | losango vermelho |
| Pausado | a pílula neutra · `paused` | duas barras |
| Aplicando ou commitando (modo Apply) | `Pass 1` · `applying`, `Pass 1` · `committing` | spinner |
| Pronto para merge (modo Apply) | `Pass 1` (a barra diz `Ready to merge`) | anel verde |
| Pergunta, permissão, relatório ilegível, mudanças a revisar | `Pass 1` | disco âmbar |
| Erro de sessão, publicação falha, passada bloqueada | `Pass 1` | losango vermelho |

`Pass N` é a passada em curso (esperando os checks, rodando, esperando o relatório) ou, sem nenhuma em curso, a última com relatório. Antes da primeira leitura dos checks, a palavra é `checking GitHub`, com o brilho. `checks a/b` conta os que passaram, `skipped` e `neutral` incluídos, de todos.

A pílula é uma parada de Tab com o estado inteiro no nome acessível (`Progress · Pass 1 · waiting for the checks, 4 of 6 passed`) e no tooltip. Não tem ação. Carregando: o nome com brilho. Abaixo de 1040 px de área principal, a palavra sai e fica no nome acessível.

**O `⋯`**, agrupado:

- **Pull request web#2291:** **Open PR**, **Refresh PR** (tooltip `checked 40s ago`), **Open in VS Code** `Ctrl+E` (desabilitado com `· the worktree doesn't exist yet` antes de ela existir);
- **Review:** **Review again…**, desabilitado com a razão quando o produto não aceita uma passada (`· a pass waits for the checks`, `· a pass is running`, `· the report of pass 1 isn't in yet`, `· the reviewer is working`, `· the agent is applying the findings`, `· the changes are being committed`);
- depois de um separador, **Delete review…**, em vermelho, com a confirmação do produto (`The worktree, the conversation and the reports go away. What was published on GitHub stays.`).

**Os painéis**, fechados por padrão:

- **`Details`:** **Pull request** (a PR com o link, o autor, a branch, o card, as labels); **Checks read before pass 1**, com os checks pelo nome e a hora; **Passes**, uma linha por passada com o estado (`Pass 1 · changes · 3 findings`, `published`), que abre o relatório; **Review** (o modo, fixo, o modelo, a worktree, o início).
- **`Reports`:** `Context` e o relatório de cada passada, renderizados. Um relatório publicado mostra o veredito, a data e o link do review no GitHub.

## 5. A conversa

É a conversa da task (`screens/task.md` §6), com o revisor como a voz do agente (a palavra `Reviewer` como autor, sem avatar). Entram, na ordem:

- o marco `Review started · Opus 5.5 (1M) · high · Publish`;
- as instruções da primeira passada, como a primeira mensagem do usuário;
- o marco `Checks read before pass 1 · 6 of 6 passed · merges clean into dev`, que abre os checks pelo nome;
- os grupos de ações e as falas do agente;
- o marco `Review 1 written · changes · 3 findings` (ou `· clean`), que abre o relatório no lugar, com **Open in Reports**;
- o cartão de apontamentos (seção 9);
- depois da publicação, os marcos `You decided · 2 approved, 1 discarded` (que abre onde cada apontamento foi) e `Published pass 1 · Request changes · 2 inline comments · the summary in the body` (a fórmula da seção 11), com **GitHub**. Uma passada publicada antes de esses marcos existirem mostra a linha `You decided · …`, derivada das decisões, logo depois do marco do relatório;
- com commits novos, o marco `3 new commits · by rsouza`, que abre a lista dos commits (hash e assunto);
- a mensagem de cada passada seguinte, como marco do produto (`MySpec → Reviewer · pass 2`).

Pergunta, permissão, erro de sessão e fila seguem a task.

## 6. A espera dos checks

Antes de cada passada, com algum check pendente ou a mergeabilidade não calculada:

- a conversa tem o início e as instruções; embaixo, o bloco dos checks pelo nome (`.gh`): `◌ Waiting for checks · 4 of 6 passed`, `checked 40s ago` e **Refresh**; uma linha por check, com o glifo, o nome em mono, o estado (`passed`, `running` em peso 500, `queued`, `failed` em vermelho) e a duração; e ao pé `The first pass starts when e2e / chromium and preview-deploy finish. MySpec reads web#2291 every minute; you can leave meanwhile.`;
- sem compositor e sem barra do pedido: é o GitHub trabalhando, não uma situação;
- a pílula diz `checks 4/6` com o círculo tracejado, e a linha da árvore `Pass 1 · checks 4/6` com `GitHub` à direita.

O que falta, ao pé do bloco, diz os checks que não terminaram pelo nome (até três, depois `and 2 more`), e, com a mergeabilidade ainda não calculada, `GitHub says whether web#2291 merges clean` no lugar ou depois deles. Uma passada seguinte que espera os checks mostra o mesmo bloco no fim da conversa, com `Pass 2 starts when…`; ela já tem a conversa aberta, então o compositor fica, como na task.

## 7. A passada

A passada é a conversa da task com o agente trabalhando: o grupo vivo dobrado com a ação em curso no resumo, `Working · 2m 10s` e **Stop** no compositor, e o placeholder `Queue a message for the reviewer…`. A pílula diz `working` com o spinner, e a árvore mostra a linha 3 com a ação (`Reading …/GeneralForm.tsx`) e o contexto.

## 8. O passe limpo

É o caso mais comum (8 de 17 passadas). O agente diz em uma linha que não há o que mudar, e o marco `Review 1 written · clean` abre o resumo. Não há cartão de apontamentos. A barra do pedido vai direto a `Ready to publish` · `A clean pass`, com **Publish review…**. O diálogo (seção 11) sugere `Approve` e diz `A clean pass · the summary and the verdict`. Sem o resumo, a passada publica só o veredito, e só `Approve` fica habilitado.

## 9. Os apontamentos

Os apontamentos de uma passada com `changes` são um cartão neutro na conversa, logo depois do marco do relatório. É o componente de `screens/task.md` §9, com as mudanças do fim da seção 20.

**O cartão.** `--surface-2` com `--shadow-xs` (`.card.plain`), sem anel de espera: a barra é que pede. O cabeçalho diz `Findings` e o número, sem o progresso (a barra o diz). Dentro, um apontamento por item, na ordem do relatório.

**O apontamento**, campo a campo:

| Campo | Forma |
|---|---|
| Número | `1`, em mono `--text-micro` e `--ink-3`, alinhado à direita |
| Título | Em `--text-ui` e peso 600, `--ink-1` |
| Localização | Ancorado: o caminho e a linha em mono (`web/src/settings/GeneralForm.tsx:84`), um link com o ícone externo que **abre a PR no GitHub, em `Files changed`, na linha** (`O`); ao lado, um botão fantasma pequeno com o glifo de código `<>` que abre o VS Code na linha, na worktree do review (`Ctrl+E`). Geral: `General · not on a line of the diff`, sem link |
| Texto | O Markdown do agente renderizado, em `--text-body`, com código inline em mono sobre `--surface-0`. Sem trecho do diff |
| Decisão | **Approve** `A` (com o visto) e **Discard** `D`. A decisão ativa fica pressionada (`aria-pressed`, `--brand-tint`), com `Approved · click again to undo` ao lado; um segundo clique desfaz |
| Edição | **Edit** (`E`), fantasma, à direita. Abre o texto numa área de texto de cinco linhas, com o texto como ele vai (Markdown cru), `Saved as you type. It goes to GitHub as you leave it.` e **Done**; `Esc` fecha |

**Estados.** Padrão (anel `--line-1`); hover (anel `--line-3`); com o foco, o atual (anel `--brand-ring`, e o anel de foco por fora); aprovado (sem fundo, a decisão pressionada); **descartado, com o texto legível** (o título desce para `--ink-2`, sem risco, e o texto fica, como pede `structure.md` §3); editando; desabilitado depois de publicado (sem decisão, com onde foi: `Inline comment · published 13:41`); salvando (`Saving…` com o spinner); erro (anel vermelho e `Couldn't save the decision · Try again`).

**O teclado.** O cartão é percorrido por apontamento (roving tabindex). `A` e `D` decidem o apontamento em foco **e levam o foco ao próximo por decidir**, que rola para o centro. `Alt+↓` e `Alt+↑` vão ao próximo e ao anterior por decidir de qualquer lugar da tela. `E` edita, `O` abre o GitHub na linha, `Ctrl+E` abre o VS Code na linha.

**Pedir ao agente** que acrescente, mude ou retire um apontamento vai pelo compositor (`Ask the reviewer to add, change or drop a finding…`). O agente reescreve o relatório; o produto grava o marco `Review 1 revised · changes · 4 findings`, e o cartão passa para logo depois dele, com a decisão e o texto dos apontamentos que não mudaram. O marco anterior do relatório fica como uma linha sem conteúdo.

**Depois da passada.** Publicada (ou enviada ao agente, no Apply), a passada sai do cartão: o marco `You decided · 2 approved, 1 discarded` abre no lugar os apontamentos como eram, desabilitados, cada um com onde foi. Uma passada não publicada que um **Review again** deixa para trás não tem cartão: fica o marco do relatório.

**Sem título.** Um apontamento de um relatório lido antes de o título existir, ou de um agente que não o escreveu, mostra a localização no lugar do título.

## 10. A barra de decisão

É a barra do pedido (`screens/task.md` §7), acima do compositor, na forma que cada situação pede:

| Situação | A barra diz | Ações | Variante |
|---|---|---|---|
| Decidindo (`review_report` · decide) | `● Decide findings · pass 1 34m` · `1 of 3 decided` (com commits depois da passada, `· 2 commits arrived after this pass`, também com tudo decidido) | **Next to decide** `Alt ↓` e **Approve the rest** (aprova de uma vez os que ainda não têm decisão; sem tecla; terminado o gesto, o foco vai à primária que a barra passa a ter, **Publish review…** ou, no Apply, **Apply approved**); `Decide 2 more` ao lado de **Publish review…** tracejado (no Apply, **Apply approved**) | decisão |
| Tudo decidido (`review_report` · publish) | `● Ready to publish · pass 1 41m` · `2 approved · 1 discarded` | **Publish review…** `Ctrl ↵`, primária, que abre o diálogo | decisão |
| Passe limpo | `● Ready to publish · pass 1` · `A clean pass` | **Publish review…** | decisão |
| A publicação falhou (`publish_failed`) | `◆ Publish failed · pass 1 !1m` e a razão, com o trilho | **Publish review…** `Ctrl ↵`, primária, que abre o diálogo com o veredito e a caixa do resumo da tentativa que falhou | erro |
| Modo Apply | seção 14 | **Apply approved** | decisão |
| Pergunta, permissão | `● Question · pass 1 18m`, `● Permission · pass 1 4m` | **Show**, que leva ao cartão | quieta |
| Erro de sessão | `◆ Session error · pass 1 !5m` | **Retry reviewer**, primária, com a sessão parada; um turno que falhou com o processo vivo não tem ação, e a resposta vai pelo compositor | erro |
| Relatório ilegível (`reply`) | `● Waiting for the report · pass 1 3m` e a razão, cortada com tooltip, no texto do produto (`The report can't be read: finding 2 does not open with its location.`) | nenhuma: o pedido de correção vai pelo compositor | tingida |
| Commits novos, check que falhou, conflito, passada bloqueada | seção 12 | **Review again…** | tingida ou erro |

O lugar de toda barra do review é a passada (`pass 1`), porque o review tem uma conversa só, salvo `Ready to merge`, que diz a PR, como na task. `Ctrl+Enter` age quando a primária da barra é **Publish review…** habilitada (`Ready to publish`, `Publish failed`), e é ela que escreve `Ctrl ↵`; com a decisão em curso, não age. Pausado, a barra fica com o que o estado pede e com as ações, na forma quieta, com as duas barras no lugar do glifo e sem chip de tempo, como na task; as situações da sessão (pergunta, permissão, erro) não aparecem enquanto ele está pausado.

Quebra em duas linhas antes de esconder uma ação. É `role="region"` com nome, e o texto de estado é `role="status"`. `Ctrl+Enter` abre o diálogo com o foco na barra ou no cartão, nunca no compositor.

## 11. A publicação

**Publish review…** abre o diálogo de publicação: o diálogo do sistema (`--size-dialog`), a `8vh` do topo.

- **Título:** `Publish the review of web#2291`, com o `×`.
- **Commits depois da passada** (`stalePass`), quando há: uma nota afundada no alto, `◇ 2 commits arrived after this pass. Findings on lines that left the diff go in the review body.`, com **Review again instead**, que fecha o diálogo e abre o **Review again**.
- **Verdict:** os três vereditos como opções de pergunta (`radiogroup`), cada um com a tecla, o nome e o que faz: `1 Request changes` · *The author addresses the findings before the merge.*, `2 Approve` · *It can be merged as it is.*, `3 Comment` · *Feedback without a verdict.* **Nenhum vem marcado.** O que as decisões sugerem ganha a etiqueta `Suggested` ao lado do nome, em `--brand-tint` com o anel `--brand-ring` e a tinta `--brand-ink` (o tooltip diz por quê: `Suggested by your decisions: 2 findings approved`). A regra: algum apontamento aprovado sugere `Request changes`; nenhum, ou um passe limpo, sugere `Approve`. A opção escolhida usa a forma escolhida da pergunta (`--brand-tint` com anel). `1`–`3` escolhem; `↑` e `↓` percorrem.
- **O que vai para o GitHub**, numa linha afundada que muda com as decisões e com a caixa do resumo: `2 inline comments · the summary in the body · 1 finding discarded, not published`; sem o resumo, `2 inline comments · nothing in the body`; com um geral aprovado, `2 inline comments · 1 finding and the summary in the body`; sem nada aprovado, `No finding approved · the summary and the verdict` ou `· the verdict only`; num passe limpo, `A clean pass · the summary and the verdict` ou `· the verdict only`. O ancorado aprovado vai inline na linha; o geral aprovado, e o ancorado cuja linha saiu do diff, vão no corpo, sob **Other findings** (`features.md`, Publicar).
- **O resumo**, opcional: **Include the summary**, uma caixa de seleção marcada, com o começo do resumo (até 150 caracteres, cortado numa palavra, com `…`) e **Edit**, que abre a área de texto, salva enquanto se digita. Desmarcado: `The review carries the verdict and the comments only.` (num passe limpo, `The review carries the verdict only.`). Desmarcar não apaga o resumo: a passada publica sem ele. Um resumo vazio conta como sem resumo, e com a caixa marcada o começo dá lugar a `The summary is empty.` em `--ink-3`, com **Edit**. Se o GitHub exigir um corpo para `Request changes` e `Comment`, uma passada sem resumo e sem apontamento no corpo envia o corpo mínimo `Review with 2 inline comments.` (`Review with 1 inline comment.`), e a linha do que vai diz `2 inline comments · "Review with 2 inline comments." in the body`; com `Approve`, nada vai no corpo. Reaberto na mesma passada depois de uma falha, o diálogo traz o veredito e a caixa da tentativa que falhou.
- **Rodapé:** `Choose a verdict` ao lado de **Publish** tracejado até a escolha; escolhido, **Publish · Request changes** `Ctrl ↵`. **Cancel**. O foco começa em **Cancel**, para nenhum veredito parecer escolhido.

**As regras do GitHub:**

- **PR própria:** só `Comment` fica habilitado, e por isso vem marcado, com `Your own pull request: GitHub takes only Comment.` A etiqueta `Suggested` não aparece;
- **sem resumo e sem apontamento aprovado:** só `Approve` fica habilitado e marcado, com `Without a summary and an approved finding, GitHub takes only Approve.`;
- **PR própria sem resumo e sem apontamento aprovado:** nenhum veredito é aceito; as três opções ficam tracejadas, e o rodapé diz `Nothing GitHub takes yet`, com `Your own pull request takes only Comment, and a comment needs the summary or an approved finding.`

**Estados.** Nada escolhido (**Publish** tracejado), escolhido, só um possível, editando o resumo, publicando (`Publishing…`, **Cancel** tracejado), falha (a razão em vermelho no rodapé, `Couldn't publish to GitHub: <o que o gh disse>`, e o diálogo fica aberto). A falha que acontece depois do diálogo fechado vira a barra `Publish failed` (seção 10).

**Depois.** A passada fica somente leitura: os marcos da decisão e da publicação entram na conversa, a pílula diz `published`, a árvore `Published · changes requested` com `idle`, e a PR vai para `In review` na lista com o estado publicado. O review fica parado até um commit novo, um check que falha, um conflito, **Review again** ou o fim da PR.

## 12. Review again

**Com commits novos** depois da publicação (`new_commits`), a barra tingida diz `● New commits · 3 since pass 1 12m` · `Checks 6 of 6 passed · merges clean`, com **Review again…** primário. O marco `3 new commits · by rsouza` na conversa abre o que mudou. **Com um check que falhou ou um conflito** depois da publicação (`pr_trouble`), a barra é a de erro da task, `◆ Checks failed · pass 1`, `Conflict with base` ou `Checks failed · conflict` (o rótulo de `troubleLabel`), com os checks que falharam pelo nome e `conflict with dev` no meio, e **Review again…**. **Com a passada bloqueada** (`pass_blocked`), `◆ Pass blocked · pass 2` e a razão, com **Review again…**. No review, **Review again…** abre sempre o diálogo, de onde vier.

**Review again…** (da barra ou do `⋯`) abre o diálogo curto do produto: `Review web#2291 again`; o que a passada faz, pelo caso (`Pass 2 reads the 3 new commits and the checks, and says which of the 2 published findings they fix.`; com um check que falhou ou um conflito, `Pass 2 reads the checks and the conflict again, and turns what failed into findings.`; bloqueada, `Pass 2 reads the pull request again, and starts when the checks finish.`; no resto, `Pass 2 reads the pull request and the checks again, and writes a new report.`); **Add instructions** atrás de um clique (4 de 5 passadas seguintes só dizem "reavalie"); **Cancel** e **Review again** `Ctrl ↵`. Com a passada não publicada e alguma decisão ou edição, uma nota afundada no alto diz `The decisions and edits of review 1 will be discarded.`, e o foco começa em **Cancel**; sem ela, em **Review again**. A passada nova espera os checks como a primeira (seção 6).

## 13. `Couldn't check GitHub`

A leitura de cada minuto que falha (`checkError`) não é situação: não notifica, não pisca e não espera ninguém (`features.md`, O review como item). Ela é a **faixa de aviso sob o cabeçalho** de `structure.md` §3, a mesma do clone inexistente na task: afundada, na medida da conversa, nunca vermelha, com `◇ Couldn't check GitHub · 3m ago`, a razão (`GitHub's rate limit was reached. It resets at 14:32. New commits, checks and the merge show after the next reading.`) e **Try again** (`Reading…` enquanto tenta). A conversa passa por baixo dela com o esmaecido. Some na primeira leitura que der certo. A hora é a da primeira falha da sequência: ela fica enquanto a leitura continua falhando, com a mesma razão ou outra, e some na primeira leitura boa. A razão é a mensagem do produto, sem o prefixo `pulls: ` do erro do Go. Com a passada bloqueada pela mesma falha (a barra `Pass blocked`), a faixa não aparece, para a razão não ser dita duas vezes; ela volta se a falha continuar depois de **Review again…**.

## 14. O modo Apply

Numa PR sua iniciada com **Apply** (`features.md`, Corrigir a própria pull request), a decisão é a mesma do Publish: o cartão, `A` e `D`, a barra. Muda o fim:

- a barra, com tudo decidido, é `● Ready to apply · pass 1` · `2 approved findings go to the agent`, com **Apply approved** primário; sem nada aprovado, ou com uma passada limpa, o review fica pronto para merge: `● Ready to merge · web#2288` · `Nothing approved in pass 1` (ou `A clean pass`), com **Open PR**, secundário, como na task;
- não há diálogo de publicação nem veredito;
- depois de **Apply approved**, o marco `You decided · 2 approved, 1 discarded` e a mensagem do produto `MySpec → Reviewer · apply 2 approved findings` entram na conversa (a mensagem diz os aprovados e os descartados, e o envio não tem marco próprio), e o ciclo é o `changes_review` da PR da task (`screens/task.md` §7: `Review changes`, o cartão de arquivos, **Approve** em 100%, o commit, a passada nova que espera os checks).

## 15. O encerramento pelo merge

**Com a tela aberta**, a área principal dá lugar à página do item que saiu (`structure.md` §1):

- um ícone neutro do merge, `web#2291 was merged, and its review ended` em `--text-title`;
- `rsouza merged it into dev at 16:20. MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.`;
- o resultado, num bloco afundado, uma linha por passada: `Pass 1 · Request changes · 2 inline comments · 13:41`, `Pass 2 · Approve · a clean pass · 15:48`; o que foi é `N inline comments`, com `, N in the body` quando há, ou `N findings in the body`, `the summary`, `the verdict only`, `a clean pass`; uma passada não publicada diz `Pass 2 · not published`, e uma do Apply, `Pass 1 · 2 findings sent to the agent · 13:41`;
- **Next that needs you** `Ctrl J` (primária, com o destino no tooltip), **Open in History** e **Back to Reviews**. O foco começa em **Next that needs you**.

Fechada sem merge: `web#2291 was closed without a merge`, com `It was closed at 16:20. MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.` A árvore já não tem o review, e a contagem de **History** sobe. **Sem a tela aberta**, o review sai da árvore sem aviso, como no produto.

## 16. Os estados de toda tela (`brief.md` §7)

| Estado | Nestas telas |
|---|---|
| **Vazio** | `No open pull requests.` com **Read now**; filtros sem resultado com **Clear filters**; seção vazia sem chevron; `No review in progress.` na árvore. No review, a espera dos checks antes da primeira passada |
| **Carregando** | A lista nunca lida em esqueleto; `Reading…` no cabeçalho numa releitura; a pílula com brilho na primeira leitura do review; `Starting…` no diálogo de início; `Publishing…` na barra e no diálogo |
| **Erro** | A faixa por repositório na lista e `Couldn't check GitHub` no review, nunca vermelhas; o erro de sessão, `pr_trouble` e `pass_blocked` como a barra de erro da task; `Publish failed` na barra; os erros dos diálogos no rodapé |
| **Aguardando o usuário** | A linha da árvore e a da lista com o glifo âmbar; a barra de decisão, de publicação ou de commits novos; o disco âmbar na pílula. A barra que nasce pisca e é anunciada |
| **Agente trabalhando** | A passada: spinner na pílula e na árvore, o grupo vivo, **Stop**. Os checks são o GitHub trabalhando: círculo tracejado, sem barra |
| **Pausado e ocioso** | Pausado: **Resume** no cabeçalho, a pílula neutra, `Sending resumes the review…` no compositor. Publicado: ocioso, sem barra |
| **Muitos itens** | A lista rola com a barra de filtros fixa e as seções recolhem (8 a 9 PRs no uso real; até 100 por repositório). Uma passada com 15 apontamentos: o cartão rola na conversa, e `Alt+↓` e o avanço de `A`/`D` levam ao próximo por decidir |
| **Item que sumiu** | O review encerrado com a tela aberta: a página da seção 15. A PR que sai da leitura com o painel aberto: o painel fecha, e a linha já saiu |

## 17. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `↑` `↓` `Home` `End` | Lista | Percorrem as linhas e os cabeçalhos visíveis |
| `←` `→` | Lista | Recolhem e expandem a seção; numa linha, `←` recolhe a seção dela |
| `Enter` | Lista | Abre ou fecha a PR no painel; num cabeçalho, recolhe ou expande |
| `R` | Linha, painel da PR | **Start review**, **Open review** ou **Open task**; num repositório sem clone, abre o painel com o foco em **Clone and continue**; num fork e num clone inexistente, o aviso de tecla (`No review of web#2296` · `Pull requests from forks can't be reviewed yet.`) |
| `O` | Linha, painel da PR, apontamento | Abre a PR no GitHub; no apontamento, em `Files changed`, na linha. No review, fora de um apontamento, não age (**Open PR** fica no `⋯`) |
| `Esc` | Qualquer lugar | Fecha o menu, o diálogo, a edição, o painel, nesta ordem |
| `Ctrl+Enter` | Diálogos; barra de decisão | **Start review**, **Review again**, **Publish**; na barra ou no cartão, abre o diálogo de publicação. No modo Apply, não age: **Apply approved** é só um botão |
| `A`, `D` | Apontamento em foco | Aprova ou descarta, e vai ao próximo por decidir |
| `E` | Apontamento em foco | Edita o texto |
| `Ctrl+E` | Apontamento em foco; review | Abre o VS Code na linha; fora de um apontamento, a worktree |
| `Alt+↓`, `Alt+↑` | Review com apontamentos | Próximo e anterior por decidir |
| `1`–`3` | Diálogo de publicação | Escolhem o veredito |
| `Alt+←`, `Alt+→`, `Ctrl+J` | Qualquer lugar | Como em `structure.md` §5 |

`R`, `O` e `E` são novos, e `A`/`D` avançando ao próximo é um comportamento novo. Entram em `structure.md` §5.

A ordem de Tab na lista: cabeçalho, barra de filtros, a lista (uma parada), o painel. No review: cabeçalho (navegação, breadcrumb, pílula, ferramentas), a faixa de aviso, a conversa (o cartão de apontamentos é uma parada), a barra, o compositor, o painel.

## 18. O que muda em `features.md` e em `structure.md`

**`features.md`, Centro de review · Visão Reviews e Filtros**

- A lista é agrupada em `Pending`, `In review`, `Reviewed` e `Yours and your tasks`, com as duas últimas recolhidas; o interruptor **Pending only** sai.
- A linha mostra a referência, o título com `Draft` ou uma label, o autor e o estado; perde as labels da segunda linha, o card, os selos `Reviewed` e `Task` e o ícone **Open on GitHub** (fica no painel e em `O`).
- **Board**, **Repository**, **Author** e **Label** ficam num menu **Filter**, e cada filtro ativo vira um chip.
- A PR abre num painel com a ação, os checks pelo nome, os fatos e a descrição; `R` inicia direto.
- A falha de leitura de um repositório é uma faixa no alto da lista, com quando falhou e **Try again**.

**`features.md`, Iniciar um review**

- Instructions e o modo ficam atrás de um clique; o diálogo diz quando a primeira passada espera os checks.

**`features.md`, O relatório e a decisão**

- O painel de apontamentos acima da conversa sai: os apontamentos são um cartão na conversa, com a barra de decisão.
- Cada apontamento tem título; o texto é mostrado renderizado e editado com **Edit**.
- A localização abre a PR no GitHub, em `Files changed`, na linha; o VS Code na linha é a segunda ação.
- `A` e `D` decidem e levam ao próximo por decidir.
- O relatório limpo não tem cartão: a barra vai direto a `Ready to publish`.

**`features.md`, Publicar**

- O veredito vem sem marcação: as decisões sugerem um, com a etiqueta `Suggested`, e o usuário escolhe. Hoje o diálogo marca `Approve` mesmo com apontamentos aprovados.
- O resumo é opcional por uma caixa de seleção, com o começo à vista e **Edit**.
- A nota de commits depois da passada fica no alto do diálogo, com **Review again instead**.
- As decisões e a publicação entram na conversa como marcos.

**`features.md`, O review como item**

- O cabeçalho do review tem a pílula da passada; **Review again**, **Open in VS Code** e **Delete review** vão para o `⋯`, como na task; **Review again** também fica na barra quando resolve a situação.
- `Couldn't check GitHub` é a faixa de aviso sob o cabeçalho.
- O review que termina com a tela aberta mostra a página do item que saiu.

**`structure.md`**

- §3, **Barra do review**: sai, como a barra do step saiu da task; a posição fica na pílula, e as ferramentas no `⋯`.
- §3, **A coluna de decisão**: os apontamentos do review moram na conversa, num cartão; a coluna de decisão fica para os rascunhos da discussão, se a tela dela a escolher. O resumo do relatório vai para o diálogo de publicação.
- §4, **Reviews**: as seções, a linha mínima, o painel e o menu **Filter**.
- §5: `R`, `O`, `E` e o avanço de `A`/`D`.

## 19. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| O título de cada apontamento | O apontamento | Pequeno: o prompt pede `### N · título`, e o parser (`prreview/report.go`) guarda o título em vez de descartá-lo |
| Os checks pelo nome durante `Waiting for checks` e os lidos antes de cada passada | A espera dos checks, `Details`, o marco `Checks read before pass 1` | Pequeno: o backend já os lê a cada minuto (`structure.md` §8) |
| Os checks pelo nome de uma PR sem review | O painel da PR e a linha do diálogo de início | Pequeno: um campo na query GraphQL da lista |
| A descrição da PR | O painel da PR | Pequeno: hoje só entra no `context.md`; expor o `body` da leitura |
| O seu último review de uma PR revisada, com o estado e a data | O painel (`Your review`) | Pequeno: a query já lê o último review da conta do `gh` |
| A lista dos commits novos desde a passada (hash, assunto e autor) | O marco `3 new commits` | Pequeno: os commits da PR na leitura de cada minuto, porque a worktree só anda no **Review again** (`backend.md` P18) |
| Marcos de decisão e de publicação | `You decided…`, `Published pass 1…` (o envio ao agente é a mensagem do produto) | Pequeno: tipos novos de marcador, como em `screens/task.md` §15 |
| Quem fez o merge e quando | A página do review que saiu | Pequeno: a leitura de cada minuto já vê o merge |
| `checkError` com quando falhou | A faixa `Couldn't check GitHub · 3m ago` | Pequeno: hoje chega só a razão |
| Quando a leitura de um repositório falhou (`failedAt`) | A faixa de falha da lista | Nenhum ou pequeno, como no board |
| O link para a linha em `Files changed` | A localização | Nenhum: `…/pull/N/files#diff-<sha256 do caminho>R<linha>`, montado no Go, no DTO do apontamento (`backend.md` F14) |
| O veredito sugerido e as regras do GitHub | O diálogo de publicação | Nenhum: derivados das decisões, do resumo e de `own` |

## 20. Os componentes que entram em `system/components.md`

O coordenador consolida. Os estados de cada um estão em `components.html`.

**Novos**

- **Linha de pull request**, a linha de lista do board com as colunas `--col-ref`, `--col-author` e `--col-state`.
- **Painel da PR**, o painel do card com a ação, o bloco do review, os checks e os fatos.
- **Diálogo de início de review**, com a espera dos checks e o resto atrás de um clique.
- **Pílula do review**, a etapa atual do stepper, sozinha.
- **Apontamento** com título e a **localização** de duas ações (GitHub e editor).
- **Barra de decisão**, a barra do pedido com **Next to decide**, **Approve the rest** e **Publish review…** ou **Apply approved**.
- **Diálogo de publicação**, com o veredito como pergunta sem marcação, a **etiqueta `Suggested`** e o resumo opcional com a caixa de seleção.
- **Faixa de aviso do review** (`Couldn't check GitHub`) e **nota afundada** (commits depois da passada, decisões que uma nova passada descarta).
- **Página do review que saiu**.

**Tokens novos para `system/tokens.css`**

- `--col-ref: calc(var(--space-16) + var(--space-8))`;
- `--col-author: calc(var(--space-16) + var(--space-8))`;
- `--col-state: calc(var(--space-16) * 3 + var(--space-4))`.

**O que muda em `screens/task.md` §9** (o apontamento é o mesmo componente):

1. **Título:** cada apontamento tem um título em `--text-ui` e peso 600, acima da localização. O relatório da PR da task já escreve um título em negrito; o parser passa a guardá-lo.
2. **Localização:** abre a PR no GitHub, em `Files changed`, na linha (`O`); o VS Code na linha é o botão pequeno ao lado (`Ctrl+E`). Hoje a §9 diz "um link que abre o editor na linha".
3. **Texto:** renderizado, editado com **Edit** ou `E` numa área de texto que salva enquanto se digita e fecha com **Done** ou `Esc`. Hoje a §9 diz "o texto editável".
4. **Resumo:** sai do cartão de apontamentos. Na PR da task não há publicação, então o resumo fica no relatório (o marco `Review 1 written`, que abre no lugar, e `Details`).
5. **Descartado:** o texto fica legível, com o título em `--ink-2`, sem risco.
6. **Teclado:** `A` e `D` decidem e levam ao próximo por decidir, também na task (§9 e §13).
7. **Nome da barra:** `Decide findings · <lugar> · pass N` nas duas telas; a task hoje diz `Findings to decide · PR review · pass 1` (§7).
8. **Reescrita:** o produto grava um marco por leitura do relatório (`Review 1 revised · changes · 4 findings`), e o cartão passa para logo depois do mais recente, com as decisões mantidas; o marco anterior fica sem conteúdo. Hoje a §9 diz que o cartão novo nasce no fim e o antigo vira o marco.
