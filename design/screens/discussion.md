# A discussão e os rascunhos

Fase 4, decidido em 2026-09-24. Referência visual: `lab/13-screen-discussion/b.html` (as treze cenas, `?scene=`, e as flags `?home`, `?error`, `?after`, `?edit`, `?group`, `?archive` e `?delete`) e `lab/13-screen-discussion/components.html` (cada componente novo em todos os estados, nos dois modos).

É a jornada J7 (`brief.md` §4): o usuário começa uma discussão a partir de um board, conversa com o agente até o entendimento fechar, lê e decide os rascunhos de cards, publica, pede mudanças, abre rodadas novas e arquiva. A tela segue `structure.md` (o shell, a árvore, os painéis, a largura contínua), `principles.md` e `system/`. Ela reaproveita as três telas decididas:

- de `screens/task.md`: a conversa, os marcos, a barra do pedido e o compositor;
- de `screens/review.md`: o cabeçalho com uma pílula só, o cartão na conversa com a barra de decisão, e `A` e `D` avançando;
- de `screens/board.md`: o início pelo board e pela Home.

Onde este documento e `structure.md` §3 divergem, vale este documento. As mudanças estão na seção 15.

**Onde o mock difere deste documento.** O mock `b.html` mostra a variação decidida. O `a.html` da rodada é a variação descartada, com todos os rascunhos abertos; o modelo de publicação dele é o mesmo daqui.

## 1. A régua

A tela é mínima, como as outras três (`decisions.md`, 2026-09-24). Cada elemento justifica por que existe, ou sai.

- **Os rascunhos são o que o usuário lê.** Ele revisa o rascunho inteiro antes de aprovar (`research/interview.md`). Por isso o rascunho aberto mostra o corpo completo renderizado, nunca um resumo. Os outros rascunhos ficam dobrados numa lista, com o estado de cada um à vista.
- **Aprovar publica.** Não há diálogo de publicação nem **Publish epic**. O que depende de outra coisa espera por ela. Antes de cada gesto, o rascunho diz exatamente o que o gesto publica, e depois dele diz como desfazer no GitHub.
- **Cada acontecimento é dito uma vez.** A publicação é um marco por rodada. A revisão do agente é um marco e uma etiqueta. O documento é um marco de uma linha. Não há toast com o item aberto.
- **Mudar vai pela conversa.** 5 de 11 discussões pediram mudanças ao agente, e só 5 campos em 28 rascunhos foram editados à mão. Por isso a edição fica atrás de **Edit**.

## 2. O início

**Do board.** Três caminhos, decididos em `screens/board.md` §3.6:
- **New discussion** `N`, sem cards;
- **Discuss** `D` num card;
- o modo de seleção com **Discuss N cards** `D`.

**Da Home.** **New discussion** abre o diálogo com o campo **Board**, que vem no board da última discussão, marcado `last used` (`screens/board.md` §2.3). Com um board só, o campo não aparece.

**O diálogo** é o diálogo largo do sistema (`--size-dialog-wide`), a `8vh` do topo, e cresce para baixo. De cima para baixo:

1. **O board.** Na Home é o seletor. A partir do board é um bloco afundado, com o ícone do board, o título e `acme · project 7 · api, billing, docs, gateway, web`.
2. **Title**, obrigatório, até 120 caracteres contados por ponto de código, com o contador a partir de 100 (`104 of 120`); acima, `Use at most 120 characters.`, sem cortar o que foi escrito. Vem sugerido com o título do card quando há um card só.
3. **What to discuss**, uma área de texto. O rótulo complementar diz `optional with cards`, ou `or pick cards on the board` sem cards.
4. **Cards**, uma linha por card: o número, o título, o repositório e `×`, que tira o card da discussão.
5. **A linha do contexto**, afundada: `From the cards: #455, #461, the epic Usage-based billing, 4 cards of the epic and 1 dependency · 5,690 characters`, com **Show**, que abre o contexto montado. Durante a releitura dos cards, a linha diz `Refreshing the cards…` com brilho, e **Show** fica tracejado. Se a releitura falha, a linha diz `◇ Couldn't refresh the cards: <motivo>. The discussion will use the last reading.`
6. **O aviso de repositório sem clone:** `◇ acme/billing isn't cloned. The conversation reads the code of the cloned repositories only.`, com **Clone** (`Cloning acme/billing…`, e a falha do `gh` com **Try the clone again**); com o clone inexistente, `◇ The clone of acme/api at ~/code/api is missing. The conversation reads the code of the cloned repositories only.`, com **Change path…**.
7. **Model**, o chip de modelo e esforço, com `From Defaults`.

O rodapé tem **Cancel** e **Start discussion** `Ctrl ↵`, o único primário. Enquanto falta algo, **Start discussion** fica tracejado, com a razão ao lado: `Write what to discuss or select at least one card.` ou `Name the discussion to start it.`. Iniciando, o botão diz `Starting…` com o spinner. Se a sessão não começa, a razão aparece em vermelho no rodapé (`Claude Code isn't logged in. The discussion was undone.`). Com a discussão criada, o diálogo fecha e a discussão abre na área principal.

## 3. O cabeçalho e a pílula

A tela da discussão é a tela do review (`screens/review.md` §4). Da esquerda para a direita:
- **`←`**, com o destino no tooltip;
- **o breadcrumb** `Platform Roadmap /`, que dobra em `…` pela regra da task;
- **o título**, em `--text-body` e peso 600;
- **a pílula**;
- à direita, o **medidor de contexto**, **Pause** ou **Resume**, os painéis **Details** e **Documents**, e **`⋯`**.

O topo cede pela largura com os limites da task (`screens/task.md` §3).

**A pílula** é a etapa atual do stepper, sozinha, com o anel de identidade. A discussão não tem etapas, então o nome dela é `Discussing` antes dos primeiros rascunhos e `Round N` depois. Ao lado do nome vem o glifo do estado. A palavra do estado só aparece quando não há barra do pedido, pela regra "a situação é dita uma vez".

| Momento | Pílula | Glifo |
|---|---|---|
| Agente trabalhando | `Discussing` · `working` | spinner |
| Pergunta, resposta, rascunhos ilegíveis | `Discussing` | disco âmbar |
| Erro de sessão | `Discussing` ou `Round N` | losango vermelho |
| Decidindo, épico que não publica, épico descartado | `Round 1` | disco âmbar |
| Publicando (a cadeia corre, nada espera o usuário) | `Round 1` · `publishing` | spinner |
| Publicação que falhou | `Round 1` | losango vermelho |
| Pronta para arquivar | `Round 3` | anel verde |
| Pausada | a pílula neutra · `paused` | duas barras |

A pílula é uma parada de Tab. O nome acessível e o tooltip dizem o estado inteiro (`Progress · Round 1 · waiting for you: decide drafts`). A pílula não tem ação.

**O `⋯`**, agrupado:
- **Discussion:** **Open Platform Roadmap**;
- **Group drafts into an epic…**, habilitado com dois ou mais rascunhos soltos da rodada atual, não publicados e não descartados. Sem eles, fica desabilitado com `· needs two loose drafts not published`; com uma corrida em curso, `· a publication is running`;
- **Archive…**, ou desabilitado com o que impede ao lado (seção 11);
- depois de um separador, **Delete discussion…**, em vermelho; com uma corrida em curso, desabilitado com `· a publication is running`.

**Archive** e **Delete discussion** saem do cabeçalho, como **Delete review** saiu do review.

## 4. A conversa e os marcos

É a conversa da task (`screens/task.md` §6), com o agente como a voz. Pergunta em cartão, pergunta em texto com a resposta rápida, permissão, erro, fila e grupos de ações seguem a task. Os marcos são linhas de uma linha, à esquerda, que abrem o conteúdo no lugar:

| Marco | Quando entra | O que abre |
|---|---|---|
| `Discussion started · Opus 5.5 (1M) · high · Platform Roadmap` | Ao criar | — |
| `Context · #455, #461 and their epic · 5,690 characters` (sem cards, `Context · the board and your text`) | Ao criar, antes da primeira mensagem: é a mensagem que abre a sessão, desenhada como marco | O contexto montado, com **Open in Documents**. O que o usuário escreveu em **What to discuss** fica como a mensagem dele, derivada do texto da discussão |
| `Written discussion.md · the understanding`; numa reescrita, `Updated discussion.md · the understanding` | Quando o produto vê o documento pela primeira vez, ou com outro carimbo (data e tamanho) | O documento, com **Open in Documents** e o tamanho. Sem destaque: o usuário não o lê na hora. Só o mais recente abre |
| `Drafts written · round 1 · 5 drafts` | Quando o produto lê os rascunhos | — (o cartão dos rascunhos vem logo depois) |
| `drafts.md can't be read · Draft invoice-overage: it has no ### Title.` (a razão do produto; o leitor não conta linhas) | Quando o artefato é ilegível, com uma razão diferente da última | — |
| `Drafts revised · round 1 · 3 changed` (as partes `changed`, `added`, `dropped`) | Quando o agente reescreve os rascunhos da rodada atual | A lista de antes da revisão, com o que mudou em cada um por campo, a diferença entre o guardado e o reconciliado, com `cards` num épico e também quando a leitura só tirou o épico ou uma dependência de um rascunho (`title · your approval was cleared`, `title, dependencies`, `not changed · approved`, `dropped by the agent`) e os acrescentados no fim (`added · <título>`) |
| `Published · round 1 · 2 so far`, depois `Published · round 1 · 4 created, 1 updated` | Na primeira publicação (ou falha) da rodada. O texto e a lista vêm dos rascunhos da rodada, então ele se atualiza a cada publicação; a hora, em hover, vira o intervalo (`14:29 – 15:12`) | A lista da rodada na ordem do cartão, com o estado de cada rascunho: o link, `Publishing…`, `Next`, `Waits for …` (e as outras formas curtas do que o segura), `Discarded · not published`, `Not decided` |
| `Publication stopped · round 1 · 3 published · Overage on the monthly invoice failed` (sem publicação, sem a parte `3 published`; com mais falhas, `and 1 more failed`) | Enquanto uma falha está de pé. É o mesmo marco da rodada, com o losango e o trilho de erro | A lista, com a razão em vermelho no rascunho que parou |
| `Round 1 · 5 drafts, revised once · 4 created, 1 updated` (o intervalo na hora, em hover) | Quando os rascunhos da rodada seguinte chegam | A lista da rodada, com os links e os descartados |

**Uma rodada dobra num marco** quando a seguinte chega. Enquanto é a atual, a rodada tem o marco `Drafts written`, os `Drafts revised`, o cartão e o marco de publicação. Quando os rascunhos da rodada seguinte chegam, tudo isso vira o marco `Round N · …`, no lugar do marco de publicação da rodada (sem publicação, no do `Drafts written`; sem nenhum dos dois, numa rodada de uma discussão anterior a esses marcos, logo antes do `Drafts written` da rodada seguinte), e os outros saem. A dobra é derivada dos rascunhos da rodada, que ficam guardados (seção 7), sem marco próprio. Nenhum marco leva a hora no texto: ela fica em hover (`decisions.md`, 2026-09-25).

**Estado vazio.** Antes da primeira fala do agente, a atividade `Starting session…`.

## 5. Os rascunhos: a lista dobrada e o rascunho aberto

Os rascunhos de uma rodada são um cartão neutro na conversa (`.card.plain`, `--shadow-xs`), logo depois do marco mais recente da rodada (`Drafts written` ou `Drafts revised`). O cabeçalho do cartão diz `Round 1 · drafts` e o número de rascunhos. A barra do pedido é a barra de decisão (seção 8).

A ordem é a do agente. O épico é um grupo: o rascunho do épico, e embaixo dele os seus cards, recuados sob uma guia de `--line-2`, como o épico na árvore. Os rascunhos soltos vêm depois.

**O rascunho atual** abre no lugar. Os outros ficam dobrados. Quando nada resta a decidir, nenhum rascunho fica aberto, e o cartão inteiro fica dobrado.

### 5.1 O rascunho dobrado

Duas linhas, com o número à esquerda, numa coluna de `--key-size` em mono:

- **linha 1:** a etiqueta do tipo, a etiqueta `Revised` quando é o caso, o título em `--text-ui` e peso 500, cortado com tooltip, e à direita o estado (seção 5.3);
- **linha 2:** em `--text-meta` e `--ink-3`, o repositório, o módulo, o número de cards (num épico), `Now: <título no GitHub>` (numa atualização), o épico existente (`In billing#478 …`), `Depends on <títulos>` e `1 warning`. Tudo numa linha só, cortada com tooltip.

**Estados:**
- hover: `--veil-hover`;
- foco: o anel por fora;
- pressionado: `--veil-press`;
- atual: anel `--brand-ring`;
- descartado: o título em `--ink-3`;
- falhou: o trilho de erro.

O dobrado não tem os botões de decisão, e `A` e `D` não agem nele. Um clique, `Enter`, `↑` e `↓` o abrem.

### 5.2 O rascunho aberto, campo a campo

Numa superfície elevada (`--surface-2`), com anel `--line-2`, e `--brand-ring` no atual.

| Campo | Forma |
|---|---|
| Número | `1`, em mono `--text-micro` e `--ink-3`, alinhado à direita |
| Tipo | Etiqueta neutra contornada por `--line-2`: `New card`, `Epic`, ou `Update` seguida da referência do card (`gateway#461`, link para o GitHub). `Revised`, com o ícone de lápis, quando a última revisão do agente o mudou; o tooltip diz que a versão anterior está no marco `Drafts revised` |
| Título | `--text-ui`, peso 600; o do épico em `--text-body`. Descartado, `--ink-2` |
| Campos | Uma linha em `--text-meta` e `--ink-3`, separada por `·`: o repositório, o módulo, o número de cards do épico, `In <épico existente>`, e numa atualização o que ela muda além do corpo, cada um só quando difere: `Now: <título atual>`, `Module now: <valor>`, `Epic now: <referência e título>` (`none`) |
| Dependências | Uma linha: `Depends on` e os títulos dos rascunhos ou cards como links em `--brand-ink`. O link leva ao rascunho da rodada atual, que abre; um rascunho de uma rodada fechada e um card abrem a issue no GitHub; uma dependência registrada no GitHub tem o tooltip `Linked on GitHub`, e uma que saiu fica só no aviso. Numa atualização, `· On GitHub: #455` com as que o card já tem e o rascunho não diz. **Nunca o id** |
| Avisos | Neutros, com o `◇`, um por linha em `--ink-2`: `acme/status-page is no longer managed by the board.`; `The dependency on <x> is no longer among the drafts.`; `The dependency on <x> was discarded and dropped.`; `The module <x> is no longer an option of the board.`; e, numa atualização, `This card isn't in the last reading of the board.`, `Refreshing the card…` com brilho, `Couldn't refresh the card: <motivo>. The draft shows the last reading.` |
| Corpo | O corpo inteiro em Markdown renderizado, em `--text-body`, depois de um fio `--line-1`: títulos em `--text-ui` e peso 600, listas e código inline sobre `--surface-0` |
| Atualização | Um controle segmentado **Body** / **Changes `+4 −1`** acima do corpo. **Changes** mostra o diff linha a linha contra o card do GitHub, em mono, sobre `--surface-0`. É neutro, porque cor é sinal: a linha acrescentada fica sobre `--veil-hover`, em `--ink-1`, com `+`; a retirada fica riscada, em `--ink-3`, com `−`; e o texto oculto `Added:` / `Removed:` vai para o leitor de tela |
| O que o gesto faz | Numa linha afundada (`--surface-0`), antes da decisão, com o ícone da cadeia ou da ampulheta, a seção 5.4 |
| Decisão | **Approve** `A` (com o visto) e **Discard** `D`. A decisão ativa fica pressionada (`aria-pressed`, `--brand-tint`). Ao lado vêm o estado (seção 5.3) e `click again to undo` enquanto a decisão se desfaz. **Edit** `E`, fantasma, fica à direita |

### 5.3 O estado do rascunho

Ele é dito numa linha: à direita, no dobrado, e ao lado da decisão, no aberto.

| Estado | Texto |
|---|---|
| Sem decisão | `Not decided` (só no dobrado) |
| Aprovado esperando | `⧗ Approved · waits for the epic`, `… waits for Tier limits and overage prices`, `… waits for 1 more card of the epic to be decided` |
| Épico sem dois cards | `⧗ Approved · the epic needs two approved cards · 1 of 3`, em `--ink-1` e peso 500 |
| Card de épico descartado | `⧗ The epic is discarded · this card won't publish`, em `--ink-1` e peso 500 |
| Bloqueado por aviso | `◇ Can't publish · choose a repository` |
| Na corrida, no instante antes dela | `Approved · publishing next` |
| Publicando | spinner e `Publishing…` (`role="status"`) |
| Publicado | `✓ Created billing#479 · 15:10`, com o link. No aberto, ao lado: `To take it back, close billing#479 on GitHub.` (`edit gateway#461` numa atualização) |
| Falhou | `◆` e a razão da publicação (as dez de `features.md`, que já são frases, sem prefixo) em vermelho, e **Retry** primário ao lado (a exceção de `structure.md` §3; tracejado com `A publication is running` durante uma corrida); começado antes da falha, o `✓ Created …` fica acima. No dobrado, `Couldn't write to GitHub · open it to Retry` |
| Descartado | `Discarded` |
| Revisado com a aprovação limpa | `Revised · your approval was cleared` |

### 5.4 O que o gesto publica

Antes da decisão, o rascunho aberto diz exatamente o que o gesto faz. A linha é a descrição acessível de **Approve** (`aria-describedby`).

- **O gesto publica:** `Approve publishes this card to GitHub now.`, ou, numa cadeia, `Approve publishes the epic, Tier limits and overage prices, Overage on the monthly invoice and this card to GitHub now.` O épico se chama `the epic`, e o próprio rascunho, `this card`.
- **Descartar também solta a cadeia:** a linha acrescenta `Discard publishes the epic, Tier limits and overage prices and Overage on the monthly invoice now.` Isso acontece quando o rascunho é o último card do épico por decidir.
- **Nada publica ainda:** `Approve publishes nothing yet: this card waits for the epic.`, `… the epic waits for 2 more cards of the epic to be decided.`
- **Bloqueado:** `Can't publish: choose a repository of the board in Edit.` e **Approve** tracejado.

A cadeia é derivada da regra da seção 6: com a decisão aplicada, tudo o que passa a não esperar nada. Ela vem do Go (`backend.md` F16), na ordem da corrida. Os nomes: o próprio rascunho é `this card` (card ou atualização) ou `the epic` (épico); o épico do rascunho é `the epic`; outro épico, `the epic <título>`; o resto pelo título. Sem publicar nada, a frase diz o que o rascunho esperaria aprovado: `this card waits for the epic.`, `this card waits for <título>.`, `the epic waits for 2 more cards of the epic to be decided.`, `the epic needs two approved cards · 1 of 3.`; com o épico descartado, `Approve publishes nothing: the epic is discarded, so this card won't publish.`; numa atualização de repositório fora do board, `Can't publish: acme/gateway is no longer managed by the board.`

### 5.5 A decisão e a tecla repetida

Aprovar é uma escrita no GitHub e não tem confirmação. Por isso:

- **Um gesto que publica algo mantém o foco no próprio rascunho.** O usuário vê o `Publishing…` e o `Created`. Um segundo `A` cai num rascunho que já não decide.
- **Um gesto que não publica nada** (esperar, descartar sem soltar cadeia) avança ao próximo por decidir, que abre no lugar. Ali, `A` e `D` só agem depois de 900 ms.
- **`A` segurado** (a repetição do teclado) é ignorado. A trava de 900 ms vale depois de qualquer decisão, para as teclas e os cliques de decisão de todos os rascunhos: um duplo clique em **Approve** é uma decisão só.
- **Uma decisão se desfaz** com um segundo clique, enquanto o rascunho espera. Publicado, o rascunho não tem decisão: tem o estado e a saída pelo GitHub.
- **Desabilitada com a razão:** enquanto uma publicação corre, a decisão dos outros rascunhos fica tracejada com `A publication is running · the decision waits for it`. Durante a edição, com `Finish editing to decide`. Hoje o produto recusa com erro.

### 5.6 Editar

**Edit** ou `E` abre, no lugar do corpo, os campos de hoje:

- **Title**;
- **Body**, em Markdown cru, numa área de texto em mono;
- **Repository**, **Module** e **Epic**, como seletores lado a lado. O valor corta com reticências e tooltip. Numa atualização, o repositório é o do card, fixo. **Epic** tem, depois de um separador, **Existing issue…**, que abre o campo `owner/name#N`;
- **Depends on**, com as dependências como chips com `×` (uma já registrada no GitHub não sai), e **Add a dependency**. Esse botão abre um `listbox` com os rascunhos da rodada pelo título, e com os cards do board por número ou título, com busca; uma busca que é um `dono/nome#N` fora deles oferece `Depend on <dono/nome#N>`.

O título não se repete acima dos campos. Embaixo, `Saved as you type. The agent's next revision of this draft replaces your edits.` e **Done**; num aprovado, antes dela, `Changing the repository, the epic or a dependency clears the approval.` `Esc` fecha. O título e o corpo nunca ficam vazios, salvo o corpo de um épico do usuário.

**Só a decisão publica.** Mudar **Repository**, **Epic** ou **Depends on** de um rascunho aprovado e não publicado retira a aprovação dele, e a do épico que ganha ou perde o card; o estado volta a `Not decided`, e o próximo **Approve** mostra a linha do que publica. O título, o corpo e o módulo mantêm a aprovação. Um rascunho sem título, que só existe num épico agrupado antes do diálogo da seção 12, tem **Approve** tracejado com `Name the draft to approve it.`

## 6. A publicação

As regras de `features.md` (Aprovar e publicar), sem **Publish epic**:

| Rascunho | Quando publica |
|---|---|
| **Card solto** sem dependência pendente | Na hora em que é aprovado |
| **Card com dependência** num rascunho não publicado | Aprovado, espera: `Approved · waits for <título>`. É publicado assim que a dependência é criada. Uma dependência num rascunho descartado sai, com o aviso |
| **Card de um épico** | Aprovado, espera o épico: `Approved · waits for the epic` |
| **Épico** | Quando está aprovado **e** todos os cards dele estão decididos, com ao menos dois aprovados. O último gesto que completa essa condição (aprovar ou descartar o último card, ou aprovar o épico) publica a cadeia: o épico, depois os cards aprovados como sub-issues, depois o que dependia deles |
| **Épico aprovado com menos de dois cards aprovados** | Não publica: `Approved · the epic needs two approved cards · 1 of 3`, e a barra `Epic can't publish` |
| **Card de um épico descartado** | Não publica: `The epic is discarded · this card won't publish`, e a barra `Epic discarded`. Não segura o arquivamento: arquiva como `Not published` |
| **Rascunho de um repositório que saiu do board** | Não publica: **Approve** tracejado, com a razão |
| **Card com épico existente** (**Existing issue…**) | Como um card solto, e vira sub-issue daquele épico |

**A regra exata** (`tasks/08-chained-publication.md` §4.2), a mesma no Go e na linha do que o gesto publica:
- um rascunho aprovado publica quando tudo de que ele precisa antes já está no GitHub ou vai na mesma corrida: o épico dele, as dependências dele e, num épico, as dependências de fora dos cards aprovados;
- o épico precisa, além disso, estar aprovado, com todos os cards decididos e ao menos dois aprovados, até a primeira escrita dele; um épico que já começou no GitHub termina;
- uma dependência num rascunho descartado sai, com o aviso, e o dependente segue;
- uma dependência cujo fecho alcança um card não descartado de um épico descartado segura o dependente, que diz `Approved · waits for <título>`; isso passa pelo épico: um épico cujo card depende de um desses fica segurado, com os cards dele. Nenhum deles segura o arquivamento, e todos arquivam como `Not published`;
- um ciclo entre rascunhos aprovados publica junto, quebrado pela posição, com o aviso da dependência que não pôde ser registrada.

**A corrida** publica um rascunho de cada vez, na ordem das dependências (épico antes dos cards, dependência antes do dependente, empate pela posição). Depois de uma corrida, o produto relê o board, como hoje.

**A falha** para a corrida e não perde nada. O rascunho em que ela parou fica com o trilho de erro, a razão e **Retry**. O que depende dele espera e diz `Approved · waits for <título>` (o card de um épico que falhou, `Approved · waits for the epic`). Os independentes continuam: a avaliação seguinte faz outra corrida com eles, e um aprovado depois também publica. **Retry**, de qualquer rascunho que falhou, limpa as falhas e continua a cadeia de onde parou, sem criar nada duas vezes. Descartar ou desfazer a decisão de um rascunho cuja publicação falhou antes de escrever no GitHub limpa a falha dele, e o agente reescrever esse rascunho também: ele volta sem decisão. As razões são as dez de `features.md`. O marco da rodada vira `Publication stopped`, e a barra, `Publish failed`.

**Não há toast.** O item está aberto, e `components.md` (Toast e aviso) deixa o toast para o item que saiu sem estar aberto. A publicação é dita no rascunho, no marco da rodada e, quando pede algo, na barra.

## 7. Pedir mudanças e a rodada nova

**Pedir mudanças** é o caminho principal. Com rascunhos a decidir, o compositor tem a pastilha **Ask for changes**, que começa a mensagem, e o placeholder `Ask for changes: add, change or drop a draft…`.

**A revisão.** O agente reescreve os rascunhos, e o produto os reconcilia como hoje:
- o que não mudou mantém a decisão e as edições;
- o que mudou perde as duas;
- o publicado nunca muda.

A revisão é dita uma vez, no vocabulário do review (`Review 1 revised`):
- na conversa, o marco `Drafts revised · round 1 · 3 changed`, que abre a lista de antes com o que mudou em cada rascunho;
- no cartão, que é substituído pelo novo depois do marco, a etiqueta `Revised` nos rascunhos que mudaram, e `Revised · your approval was cleared` no que tinha aprovação.

**A rodada nova.** Depois de uma rodada publicada, o usuário pode pedir mais cards na mesma conversa. Isso é um caso normal, não o principal (`research/interview.md`). Os rascunhos novos abrem a rodada seguinte: a rodada anterior dobra num marco (seção 4), vêm o marco `Drafts written · round 2 · 1 draft` e o cartão novo, e a pílula diz `Round 2`. A regra: uma leitura que muda os rascunhos abre a rodada seguinte quando todo rascunho da rodada atual está no GitHub ou descartado; senão, é uma revisão da rodada atual. A rodada fechada não muda nem perde rascunhos numa leitura seguinte (`decisions.md`, 2026-09-29, task 9).

## 8. A barra do pedido

A barra do pedido de `screens/task.md` §7, acima do compositor. Ela diz o que falta de verdade e a saída. O lugar é `Discussing` antes dos rascunhos e `round N` depois (a árvore e a pílula dizem `Round N`, como `pass 1` e `Pass 1` no review).

| Momento | A barra diz | Ação | Variante |
|---|---|---|---|
| O agente espera uma resposta | `Waiting for reply · Discussing 2m` | Nenhuma: vai pelo compositor, com a resposta rápida | tingida |
| Pergunta ou permissão em cartão | A da task | **Show** | quieta |
| Erro de sessão | `Session error · Discussing 3m` | **Retry** (primária) | erro |
| Rascunhos ilegíveis | `Waiting for the drafts · Discussing 1m` · `ask the agent to fix drafts.md below` | Nenhuma: vai pelo compositor, com a pastilha **Ask to fix the drafts** | tingida |
| Algum rascunho sem decisão | `Decide drafts · round 1 6m` · `2 of 5 decided` | **Next to decide** `Alt ↓` | de decisão (tingida) |
| Épico aprovado sem dois cards aprovados, tudo decidido | `Epic can't publish · round 1` · `1 of 3 cards approved · approve one more, or discard the epic` | **Show** (leva ao épico) | tingida |
| Épico descartado com cards aprovados | `Epic discarded · round 1` · `2 approved cards of it won't publish · approve the epic again, or discard them` | **Show** | tingida |
| A cadeia corre, nada espera o usuário | Nenhuma barra | — | — |
| Uma publicação falhou | `Publish failed · round 1 !1m` · `Stopped at <título>` | **Show** (leva ao rascunho, onde fica **Retry**) | erro |
| Tudo publicado ou descartado | `Ready to archive · round 1 1m` · `5 published · or ask the agent for more cards below` | **Archive…** (primária) | encerramento |

**Prioridade:** falha, épico descartado, decidir, épico que não publica, publicando, pronta para arquivar.

**Pausada**, a discussão não tem situação, e a barra mostra o que os rascunhos pedem (decidir, o épico, a falha, pronta para arquivar) com a ação, quieta, com as duas barras no lugar do glifo e sem o tempo, como na task e no review; as situações da sessão não aparecem. O cartão continua decidindo e publicando, porque a publicação não depende da conversa.

**A situação durante uma corrida.** A situação que espera o usuário (falha, épico descartado, decidir, épico que não publica) fica de pé enquanto uma corrida escreve outros rascunhos; a pílula e a árvore dizem `publishing` pelo spinner. Só `Ready to archive` espera a corrida acabar.

**A saída do épico que não publica** depende de quantos cards ele tem. Os textos da barra, do rascunho e da razão de **Archive…** estão aqui; os da notificação, em `screens/rest.md` §11. `a` é o número de cards aprovados; `b`, o de cards do épico.

| Caso | O rascunho (épico e card aprovado) | O meio da barra | A razão de **Archive…** |
|---|---|---|---|
| Dois cards ou mais, um aprovado | `Approved · the epic needs two approved cards · 1 of 3` | `1 of 3 cards approved · approve one more, or discard the epic` | `The epic can't publish: approve one more card, or discard the epic.` |
| Dois cards ou mais, nenhum aprovado | `Approved · the epic needs two approved cards · 0 of 3` | `0 of 3 cards approved · approve two more, or discard the epic` | `The epic can't publish: approve two more cards, or discard the epic.` |
| Um card | `Approved · the epic needs two approved cards · a of 1` | `a of 1 card approved · move another card into it, or discard the epic` | `The epic can't publish: move another card into it, or discard the epic.` |
| Nenhum card | `Approved · the epic has no cards` | `No cards · move two cards into it, or discard the epic` | `The epic can't publish: move two cards into it, or discard the epic.` |

`Epic discarded`: `2 approved cards of it won't publish · approve the epic again, or discard them`; com um, `1 approved card of it won't publish · approve the epic again, or discard it`. Com mais de um épico nesses estados, a barra fala do primeiro pela posição.

A barra é `role="region"` com nome, e o texto de estado é `role="status"`: o rótulo e o meio juntos, porque o meio é a saída e é anunciado com o rótulo. Uma barra que nasce com a tela aberta pisca e é anunciada.

## 9. O compositor

É o da task (`screens/task.md` §8). O placeholder diz a quem se responde e como:
- `Answer a or b, or reply to the agent…`, com a resposta rápida, quando o agente pergunta em texto;
- `Ask for changes: add, change or drop a draft…`, com a pastilha **Ask for changes**, com rascunhos a decidir;
- `Ask the agent to fix drafts.md…`, com a pastilha **Ask to fix the drafts**, com os rascunhos ilegíveis;
- `Ask for more cards, or reply to the agent…`, pronta para arquivar;
- `Sending restarts the session…`, com erro de sessão;
- `Sending resumes the discussion…`, pausada;
- `Queue a message for the agent…`, com o agente trabalhando.

**Send** fica secundário enquanto a barra ou um cartão têm a ação primária.

## 10. `Details` e `Documents`

Os painéis ficam fechados por padrão e nunca abrem sozinhos. Abre um de cada vez, e `Esc` fecha.

**`Details`:**
- **Discussion:** o board (link), os cards de entrada, os repositórios lidos, os sem clone com **Clone**, o modelo, o início;
- **Rounds:** uma linha por rodada, com os rascunhos, o que foi publicado e a hora da última publicação à direita (`Round 1 · 5 drafts · 4 created, 1 updated` · `15:12`); a rodada atual por decidir diz também `2 of 3 decided`; sem publicação, `nothing published` e sem hora. Antes dos rascunhos, `No drafts yet`. As linhas não agem;
- **Documents:** `Context` e `Document · discussion.md`, que abrem o painel **Documents** naquele documento. Antes do documento, `Document · written with the drafts`, desabilitado.

**`Documents`:** a lista (`Context`, `Document`), com o escolhido em `--brand-tint-plane`, e embaixo o documento escolhido, renderizado no registro de leitura. O painel não troca de documento sozinho.

## 11. O arquivamento e o apagamento

**Archive…** fica na barra de encerramento e no `⋯`. No `⋯`, desabilitado, ele diz o que impede e a saída:
- `· a publication failed: Retry it, or discard the draft`;
- `· a publication is running`;
- `· the epic can't publish: approve one more card, or discard the epic` (as variantes da seção 8);
- `· approved drafts wait to be published`.

Um card de épico descartado, um bloqueado por aviso e um rascunho sem decisão não impedem: eles arquivam como `Not published`.

**O diálogo de arquivar:**
- título: `Archive "Usage-based pricing tiers"?`;
- corpo: `The conversation ends. The document, the drafts and what was published stay in History.`;
- uma linha afundada com `Published: 7 issues in 3 rounds: 6 created, 1 updated`, e, quando há, `Not published: <títulos>`;
- a nota `A task started from one of these cards gets the document in its context, also after the archive.`;
- rodapé: **Cancel** e **Archive** `Ctrl ↵`.

Arquivando, o botão diz `Archiving…` com o spinner e **Cancel** fica tracejado; uma recusa fica no rodapé em vermelho, com o diálogo aberto. O foco começa em **Cancel**.

**O diálogo de apagar** (**Delete discussion…**):
- título: `Delete "Usage-based pricing tiers"?`;
- corpo: `The conversation, the document and the drafts go away, and the discussion doesn't go to History. What was published on GitHub stays: 5 issues.` (sem publicação, a última frase sai); com uma corrida em curso, **Delete discussion…** fica desabilitado, e uma recusa que ainda chega vai ao rodapé em vermelho;
- a nota `A task started from one of its cards loses the document in its context.`;
- rodapé: **Cancel** e **Delete discussion** (perigoso). O foco começa em **Cancel**.

**Com a tela aberta**, arquivar ou apagar dá a página do item que saiu (`structure.md` §1):
- um ícone neutro e `Usage-based pricing tiers was archived` (ou `was deleted`);
- o que aconteceu: `The conversation ended at 15:15. The document, the drafts and what was published are in History; a task started from one of these cards gets the document in its context.`; apagada, `The conversation, the document and the drafts are gone. What was published on GitHub stays.`;
- o que foi publicado, uma linha por rodada (`Round 1 · 4 created, 1 updated` e a hora); na apagada, sem o bloco, porque o estado já não tem os rascunhos;
- **Next that needs you** `Ctrl J` (primária, com o foco), **Open Platform Roadmap** e **Open in History** (menos no apagado).

## 12. Agrupar em épico

**Group drafts into an epic…**, no `⋯`, abre um diálogo:
- **Title of the epic**, obrigatório, para o épico nunca ser nomeado pelo id;
- os rascunhos soltos não publicados, com caixas, dois marcados;
- **Repository of the epic**, que vem no repositório mais comum entre os marcados e segue a marcação até ser escolhido.

**Group 2 drafts** fica tracejado com `Name the epic to group the drafts.` até o título existir. Mover um rascunho para dentro ou para fora de um épico continua pelo seletor **Epic** de **Edit**.

## 13. Os estados de toda tela (`brief.md` §7)

| Estado | Nesta tela |
|---|---|
| **Vazio** | Antes da primeira fala, `Starting session…`. Sem rascunhos, a discussão fica `Discussing`, sem cartão. `Details` diz `No drafts yet` |
| **Carregando** | A primeira leitura: a pílula com brilho, `Loading the conversation…` e o esqueleto. `Refreshing the cards…` no diálogo e `Refreshing the card…` numa atualização. `Publishing…` no rascunho, `publishing` na pílula e o spinner na árvore, sem a linha 3, que é do agente |
| **Erro** | Erro de sessão: o bloco de erro e a barra com **Retry**. Publicação: o trilho no rascunho, **Retry**, `Publication stopped` no marco, a barra `Publish failed`. Rascunhos ilegíveis: o marco e `Waiting for the drafts`. Erros dos diálogos no rodapé |
| **Aguardando o usuário** | A barra do pedido, o disco âmbar na pílula e na árvore. A barra que nasce pisca e é anunciada |
| **Agente trabalhando** | O grupo vivo, **Stop** e `Working · 1m 20s` no compositor, a linha 3 da árvore com a ação e o contexto |
| **Pausado e ocioso** | Pausada: **Resume** no cabeçalho, a pílula neutra com `paused`, a barra quieta com o que os rascunhos pedem (seção 8), `Sending resumes the discussion…`. Ociosa (parada sozinha depois de 10 min): a próxima mensagem retoma |
| **Muitos itens** | 10 rascunhos numa rodada (o máximo real): a lista dobrada tem duas linhas por rascunho e o aberto. Uma conversa longa fica legível pelos grupos dobrados e pelas rodadas passadas dobradas em marcos |
| **Item que sumiu** | Arquivada ou apagada com a tela aberta: a página do item que saiu (seção 11). Sem a tela aberta, a discussão sai da árvore |
| **Todos descartados** | `Ready to archive` com `nothing published` |

## 14. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `A`, `D` | Rascunho aberto com o foco | Aprova ou descarta. Avança ao próximo só quando o gesto não publica nada; ignorado por 900 ms depois de avançar e na repetição do teclado |
| `E` | Rascunho aberto com o foco | Abre **Edit** |
| `Enter` | Rascunho dobrado | Abre o rascunho |
| `↑` `↓` | Lista dos rascunhos | Vão ao anterior e ao próximo, e o abrem |
| `Alt+↓`, `Alt+↑` | Com rascunhos a decidir | Próximo e anterior por decidir |
| `Ctrl+Enter` | Diálogos | **Start discussion**, **Archive**, **Group 2 drafts** |
| `Esc` | Qualquer lugar | Fecha o `listbox`, o campo de **Existing issue…**, o menu, o diálogo, a edição e o painel, nesta ordem |
| `N`, `D` | Visão do board | **New discussion**, **Discuss** (`screens/board.md` §7) |
| `Alt+←`, `Alt+→`, `Ctrl+J` | Qualquer lugar | Como em `structure.md` §5 |

`E`, `Enter` e `↑` `↓` na lista dos rascunhos, e a proteção de `A`/`D`, são novos e entram em `structure.md` §5.

A ordem de Tab é: cabeçalho (navegação, breadcrumb, pílula, ferramentas), a conversa (o cartão dos rascunhos é uma parada, com roving tabindex entre os rascunhos), a barra, o compositor, o painel.

## 15. O que muda em `features.md` e em `structure.md`

**`features.md`, Discussão · Rascunhos de cards**
- O painel **Drafts** acima da conversa sai. Os rascunhos são um cartão na conversa: uma lista dobrada, com o atual aberto com o corpo inteiro renderizado.
- Os campos ficam atrás de **Edit**.
- As dependências são escolhidas e mostradas pelo título, nunca pelo id do rascunho.
- A reescrita pelo agente é o marco `Drafts revised` mais a etiqueta `Revised`.

**`features.md`, Épico**
- **Group into an epic** vai para o `⋯`, num diálogo que pede o título.

**`features.md`, Aprovar e publicar**
- **Publish epic** sai. O épico publica sozinho quando está aprovado e todos os cards dele estão decididos, com ao menos dois aprovados. Um card do épico espera o épico, e a corrida publica a cadeia.
- O rascunho diz, antes do gesto, o que o gesto publica. O foco não avança quando o gesto publica.
- O rascunho publicado diz como desfazer: fechar ou editar a issue no GitHub.
- Um card de épico descartado não publica e diz por quê. Ele não impede o arquivamento.
- Durante uma publicação e durante a edição, a decisão fica desabilitada com a razão, em vez de recusada com erro.
- A publicação é um marco por rodada na conversa, sem toast.

**`features.md`, O documento**
- O documento é um marco de uma linha. O painel **Documents** começa fechado e não troca de aba sozinho.

**`features.md`, A conversa**
- O contexto inicial é o marco `Context`, e **What to discuss** é a mensagem do usuário.
- Os marcos são `Discussion started`, `Context`, `Written discussion.md`, `Drafts written`, `drafts.md can't be read`, `Drafts revised`, `Published · round N`, `Publication stopped` e `Round N`.
- O erro de sessão tem **Retry** na barra.

**`features.md`, A discussão como item**
- O cabeçalho tem a pílula `Discussing` ou `Round N`. **Archive** e **Delete discussion** vão para o `⋯`.
- Os estados ganham `Epic can't publish`, `Epic discarded` e `Ready to archive`, que é uma situação de encerramento: entra no `Ctrl+J`, notifica uma vez com a janela fora de foco e pisca com ela em foco. O `Decide drafts` que fica de pé com tudo decidido some.
- A discussão arquivada ou apagada com a tela aberta mostra a página do item que saiu.

**`structure.md`**
- §3, **Barra da discussão**: sai. A posição fica na pílula, e as ferramentas no `⋯`.
- §3, **A coluna de decisão**: os rascunhos moram na conversa, num cartão. A coluna de decisão deixa de ter uso nas três telas.
- §3, **Único lugar da ação**: a exceção de **Publish epic** sai, e a de **Retry** fica.
- §3, a tabela da barra do pedido: `drafts`, `publish_failed` e as linhas novas da seção 8.
- §5: os atalhos da seção 14.

## 16. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| **A publicação em cadeia**: o épico publicado quando está aprovado e todos os cards dele estão decididos, com ao menos dois aprovados; o card depois do épico e das dependências; sem **Publish epic** | O modelo da tela | **Médio.** `discussionflow/publish.go` e `decide.go` passam a tratar o épico como dependência na corrida de cada decisão, e `PublishEpic` sai |
| O que um gesto publica (a cadeia) | A linha antes da decisão | Pequeno: o DTO do rascunho traz o que **Approve** e **Discard** publicariam agora, calculado pela função da cadeia que a task 8 cria (`discussionflow/chain.go`), para a regra existir num lugar só (`backend.md` F16) |
| Marcos de discussão: contexto, documento escrito, rascunhos escritos, revisados (com quantos mudaram) e ilegíveis, e o marco da rodada de publicação, que se atualiza | A conversa | Pequeno: tipos novos de marcador. O backend já sabe `documentRevision`, `draftsRevision`, `revision`, `publishedAt` e `unreadableDrafts` |
| A versão anterior dos rascunhos revisados (título, dependências, decisão) | O marco `Drafts revised` | Pequeno: o reconcile guarda o anterior antes de substituir |
| O número da rodada de cada rascunho | A pílula, o cartão, os marcos, a regra de dobrar | Pequeno: `discussion_drafts.round`; uma leitura que muda os rascunhos abre a rodada seguinte quando todo rascunho da rodada atual está no GitHub ou descartado, e senão é uma revisão dela (`backend.md` P25) |
| As situações `Epic can't publish`, `Epic discarded` e `Ready to archive`, com a notificação da última | A árvore, a pílula e a barra | Pequeno: `attention/derive_discussion.go` |
| **Retry** da sessão numa discussão | O erro de sessão | Pequeno: o frontend acha só tasks (`research/conversation.md` §1.2) |
| As partes do contexto montado e o tamanho | A linha do diálogo e o marco `Context` | Pequeno, como no board (`screens/board.md` §11) |
| A contagem `+4 −1` do diff | **Changes** | Nenhum: derivada no frontend do corpo e do `current` |
| O título de cada dependência | `Depends on` | Nenhum: `DraftRef` já tem `title` |

## 17. Os componentes que entram em `system/components.md`

O coordenador consolida. Os estados de cada um estão em `components.html`.

**Novos**
- **Rascunho**, o cartão de um rascunho, com o corpo inteiro, a linha do que o gesto publica e o estado. Estados:
  - padrão, hover, foco;
  - a cadeia;
  - aprovado esperando, publicando, publicado com a saída;
  - descartado;
  - desabilitado durante uma publicação e em edição;
  - erro com **Retry**;
  - revisado;
  - épico sem dois cards, card de épico descartado.
- **Rascunho dobrado**, de duas linhas, com o estado à direita.
- **Linha do que o gesto publica**, afundada.
- **Avisos do rascunho**, neutros, com `◇`.
- **Body / Changes** e o **diff neutro** da atualização.
- **Edição do rascunho**, com as dependências por título no `listbox`.
- **Marcos da rodada:**
  - `Drafts revised`;
  - `Published · round N`, que se atualiza;
  - `Publication stopped`;
  - `Round N`, dobrada;
  - `drafts.md can't be read`.
- **Barra do pedido da discussão**, com as linhas da seção 8.
- **Pílula da discussão**: `Discussing` ou `Round N`.
- **Diálogo de nova discussão**, com a releitura dos cards.
- **Diálogos de arquivar, apagar e agrupar**.
- **Página da discussão que saiu**: arquivada, apagada.

**Tokens novos:** nenhum.
