# 13 · A discussão e os rascunhos

Fase 4, quarta tela. Levantamento em `design/research/discussion.md`. As respostas do usuário às quatro perguntas dele (`design/research/interview.md`) chegaram durante a rodada e estão aplicadas nas duas variações (seção "As quatro perguntas"). A régua é a das três telas decididas (`decisions.md`, 2026-09-24): cada elemento justifica por que existe, ou sai.

**O que a rodada resolve.** Como o usuário começa uma discussão, conversa até o entendimento fechar, lê e decide os rascunhos, publica, trata uma falha, pede mudanças ao agente, abre uma rodada nova e arquiva. O volume é o real: mediana de 1 rascunho por discussão (máximo 10), 28 de 28 aprovados, corpo com mediana de 2,35 mil caracteres, mudanças pedidas pela conversa em 5 de 11 discussões, quase nada editado à mão, uma discussão com 5 rodadas.

**O modelo, igual nas duas.** O usuário respondeu que aprovar publica na hora, como hoje, quando o rascunho não depende de nada; o que depende do épico ou de outro rascunho espera o que ele depende ser criado primeiro. Isso decidiu a pergunta da rodada a favor da antiga variação B. A antiga variação A (publicar a rodada inteira num diálogo) saiu, e os arquivos dela foram substituídos. As duas variações de agora são do mesmo modelo e diferem em outra coisa que também é resposta do usuário: ele lê o rascunho inteiro antes de aprovar, então a pergunta passou a ser **como o corpo inteiro é lido**.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **A · Todos abertos**, nas treze cenas |
| `b.html` | **B · Um por vez**, nas mesmas treze cenas |
| `components.html` | Os componentes novos ou mudados, em todos os estados, claro e escuro lado a lado. `?only=N` mostra um só |
| `src/` | As fontes. `disc.js` e `disc.css` são a tela; `pub.js` é o modelo de publicação das duas; `open.js` é a A; `focus.js` e `focus.css` são a B; `components.*` o espécime. `build.py` gera as páginas |

As páginas são geradas por `python3 design/lab/13-screen-discussion/src/build.py`. O script lê sem mudança `base.css`, `core.css` e `core.js` (rodadas 08 e 09), `m.css` e `b.css` (rodada 10, a tela da task e a pílula), `board.css` (rodada 11) e `review.css` e `vb.css` (rodada 12). Cada página traz `design/system/tokens.css` byte a byte, e o script confere.

## Como abrir

Sirva a lab (`python3 -m http.server <porta> -d design/lab`) e abra `13-screen-discussion/a.html` e `b.html`. O seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros:

- `?scene=`: as treze da tabela; o padrão é `drafts`;
- `?theme=light` ou `?theme=dark`;
- `?home` na cena `start`: o diálogo aberto da Home, com a escolha do board;
- `?error` na cena `talk`: o erro de sessão com **Retry**;
- `?after` na cena `publish`: o momento depois do gesto, com a cadeia no meio;
- `?edit` na cena `drafts`: o rascunho 3 aberto em edição;
- `?panel=Details` ou `?panel=Documents`; `?menu` abre o `⋯`; `?archive` abre o diálogo de arquivamento nas cenas `published` e `done`; `?group` abre o diálogo de agrupar em épico na cena `many`; `?delete` abre a confirmação de apagar;
- `?freeze` para a publicação em cadeia; `?audit` e `?clean`.

Tudo age: **Approve** e **Discard**, `A` e `D` (decidem e vão ao próximo por decidir), `Alt+↓`, `↑` `↓` e `Enter` entre os rascunhos, **Edit** e `E`, **Body** e **Changes** numa atualização, os links das dependências (levam ao rascunho), **Retry**, **Show** da barra, **Archive…** até a página do item que saiu, os painéis e o `⋯`. Aprovar publica de verdade no mock: o rascunho passa a `Publishing…`, depois a `Created` com o link, o marco da rodada se atualiza, e o que esperava por ele segue sozinho.

## O que é igual nas duas

**O shell e o cabeçalho** são os do review: `←`, o breadcrumb `Platform Roadmap /`, o título e uma pílula só. A discussão não tem etapas, então a pílula diz `Discussing` antes dos rascunhos e `Round N` depois, com o glifo do estado e a palavra só sem barra do pedido. À direita, o medidor, **Pause**, os painéis **Details** e **Documents** e o `⋯` (**Open Platform Roadmap**, **Group drafts into an epic…**, **Archive…** com o que o impede, **Delete discussion…**). **Archive** e **Delete** saem do cabeçalho, como **Delete review** saiu do review.

**O início** (`start`). Do board, com dois cards selecionados, ou da Home, com o campo **Board** (decidido em `screens/board.md` §2.3). O diálogo tem o board, **Title**, **What to discuss**, os cards removíveis um a um, o contexto dos cards numa linha com **Show** (a mesma linha do diálogo de task, `screens/board.md` §4.3), o aviso do repositório sem clone e o modelo. **Start discussion** fica tracejado com a razão até haver texto ou card, e com título.

**A conversa** (`talk`). O início é um marco, `Discussion started · Opus 5.5 (1M) · high · Platform Roadmap`. O contexto montado deixa de ser a primeira mensagem do usuário em Markdown cru (461 a 6 mil caracteres): vira o marco `Context · #455, #461 and their epic · 5,690 characters`, que abre no lugar. O que o usuário escreveu em **What to discuss** fica como a mensagem dele. Pergunta em cartão, pergunta em texto com a resposta rápida, grupos de ações e a barra `Waiting for reply · Discussing` seguem a task.

**O erro de sessão** (`talk` com `?error`) é o da task: o bloco de erro na conversa, sem botão, e a barra de erro `Session error · Discussing` com **Retry** (hoje o bloco de erro de uma discussão nunca tem **Retry**). O compositor diz `Sending restarts the session…`.

**Os rascunhos ilegíveis** (`unreadable`) são um marco, `drafts.md can't be read · line 41: Draft invoice-overage has no ### Title`, e a barra tingida `Waiting for the drafts · Discussing`, sem ação: a correção vai pelo compositor, com a pastilha **Ask to fix the drafts**.

**O documento** é um marco de uma linha, `Written discussion.md · the understanding`, que abre no lugar, sem destaque. O painel **Documents** fica fechado e nunca abre sozinho (hoje ele começa aberto e troca de aba sozinho).

**Os rascunhos** são um cartão neutro na conversa, logo depois do marco `Drafts written · round 1 · 5 drafts`, com a barra do pedido como barra de decisão: o mesmo desenho dos apontamentos do review (`screens/review.md` §9 e §10). O épico é um grupo, com os cards dele recuados sob uma guia, como o épico na árvore.

**O rascunho**, campo a campo:

| Campo | Forma |
|---|---|
| Número | Em mono `--text-micro` e `--ink-3`, como o apontamento |
| Tipo | Etiqueta neutra: `New card`, `Epic`, ou `Update` com a referência do card (`gateway#461`, link para o GitHub). `Revised` quando a última revisão do agente o mudou |
| Título | `--text-ui`, peso 600; o do épico em `--text-body` |
| Campos | Uma linha em `--ink-3`: repositório, módulo, número de cards (épico), `Now: <título no GitHub>` (atualização) |
| Dependências | Uma linha: `Depends on` e os títulos como links que levam ao rascunho. Nunca o id |
| Avisos | Neutros, com `◇`: `acme/status-page is no longer managed by the board.` (para o rascunho antes do GitHub: **Approve** tracejado e `Can't publish: choose a repository of the board in Edit`), a dependência que saiu dos rascunhos, o módulo que saiu do board, `This card isn't in the last reading of the board.`, `Refreshing the card…` e a releitura que falhou numa atualização |
| Corpo | O corpo inteiro, em Markdown renderizado, no registro de leitura, depois de um fio. Numa atualização, **Body** e **Changes** (`+4 −1`), o diff linha a linha neutro: a linha acrescentada sobre o véu, a retirada riscada em `--ink-3`, porque cor é sinal |
| O que o gesto faz | Antes da decisão, uma linha afundada diz exatamente o que o gesto publica agora: `Approve publishes the epic, Tier limits and overage prices, Overage on the monthly invoice and this card to GitHub now. Discard publishes the epic, Tier limits and overage prices and Overage on the monthly invoice now.`, ou `Approve publishes nothing yet: this card waits for the epic.` **Approve** a tem como descrição acessível (`aria-describedby`) |
| Decisão | **Approve** `A` e **Discard** `D`, pressionados quando ativos, e ao lado o estado: `Approved · waits for the epic`, `Publishing…`, `Created billing#479 · 15:10` com `To take it back, close billing#479 on GitHub.`, o erro com **Retry**. **Edit** `E` à direita |


**A publicação.** Aprovar publica na hora, sem confirmação, como hoje, quando o rascunho não espera nada. O que depende espera, e segue sozinho quando o que faltava é criado, um de cada vez, na ordem das dependências:

- **um card** espera o rascunho de que depende; uma dependência descartada sai, como hoje;
- **um card do épico** espera o épico;
- **o épico** segue a regra de `features.md`: é publicado quando está aprovado e **todos** os cards dele estão decididos, com ao menos dois aprovados. Por isso o último card do épico a ser decidido é o gesto que publica a cadeia (o épico, os cards aprovados, os que dependem deles), e é essa cadeia que a linha antes do gesto diz, com os nomes. Descartar esse card também pode soltar a cadeia, e a linha diz isso;
- **um card de épico descartado** não publica: diz `The epic is discarded · this card won't publish`. A barra diz `Epic discarded` e a saída (`approve the epic again, or discard them`). Esses cards não seguram o arquivamento: arquivam como `Not published`;
- **um rascunho de um repositório que saiu do board** não publica: **Approve** fica tracejado com a razão.

**Publish epic** deixa de existir. Uma decisão se desfaz com um segundo clique enquanto o rascunho espera; publicado, não, e o rascunho diz como desfazer no GitHub (`To take it back, close billing#479 on GitHub.`; numa atualização, `edit`). Enquanto uma publicação corre, e enquanto o rascunho está em edição, a decisão fica tracejada com a razão, em vez do erro de hoje.

**O `A` repetido.** Um gesto que publica algo deixa o foco no próprio rascunho: o usuário vê o `Publishing…` e o `Created`, e um segundo `A` cai num rascunho que já não decide. Um gesto que não publica nada avança ao próximo por decidir, e as teclas `A` e `D` só agem ali depois de 0,9 s; `A` segurado (repetição do teclado) é ignorado. Um duplo clique em **Approve** segue a mesma regra.

**Um marco por rodada.** A publicação entra na conversa como um marco só, `Published · round 1 · 2 so far`, na hora da primeira publicação da rodada, e ele se atualiza: `Published · round 1 · 4 created, 1 updated · 14:29 – 15:12`, ou `Publication stopped · round 1 · 3 published · Overage on the monthly invoice failed`. Ele abre a lista da rodada com o estado de cada rascunho e os links. Sem toast: o item está aberto, e `components.md` deixa o toast para o item que saiu sem estar aberto.

**A barra diz o que falta de verdade, e a saída:**

| Momento | A barra | Ação |
|---|---|---|
| Algum rascunho sem decisão | `Decide drafts · round 1` · `2 of 5 decided` | **Next to decide** `Alt ↓` |
| Tudo decidido e publicando | Nenhuma: nada espera o usuário. A pílula diz `publishing` e a árvore mostra o spinner, sem a linha 3, que é do agente | — |
| O épico aprovado sem dois cards aprovados | `Epic can't publish · round 1` · `1 of 3 cards approved · approve one more, or discard the epic` | **Show** leva ao épico |
| O épico descartado com cards aprovados | `Epic discarded · round 1` · `2 approved cards of it won't publish · approve the epic again, or discard them` | **Show** |
| Uma publicação falhou | Barra de erro `Publish failed · round 1` · `Stopped at <título>` | **Show** leva ao rascunho, onde fica **Retry** (a exceção de `structure.md` §3) |
| Os rascunhos ilegíveis | `Waiting for the drafts · Discussing` · `ask the agent to fix drafts.md below` | Nenhuma: vai pelo compositor |
| Erro de sessão | Barra de erro `Session error · Discussing` | **Retry** |
| Tudo publicado ou descartado | Encerramento `Ready to archive · round 1` · `5 published · or ask the agent for more cards below` | **Archive…** |

`Ready to archive` é uma situação de encerramento, como o `Ready to close` da task: entra no `Ctrl+J` e na gravidade da árvore, notifica uma vez com a janela fora de foco (a cadeia termina com o usuário longe) e pisca com a janela em foco, pela regra de `structure.md` §2.

**Pedir mudanças** é o caminho principal. O compositor tem a pastilha **Ask for changes** e o placeholder `Ask for changes: add, change or drop a draft…` enquanto há rascunhos a decidir.

**A revisão** (`rewrite`), dita uma vez. Na conversa, o marco `Drafts revised · round 1 · 3 changed`, no vocabulário do review (`Review 1 revised`), que abre a lista de antes com o que mudou em cada rascunho. No cartão, a etiqueta `Revised` nos rascunhos que mudaram, e `Revised · your approval was cleared` no que tinha aprovação. O que já estava publicado não muda.

**Várias rodadas** (`done`) são um caso normal, não o principal. A regra: uma rodada fica como cartão e marco de publicação enquanto é a atual; quando os rascunhos da rodada seguinte chegam, ela dobra num marco só, `Round 1 · 5 drafts, revised once · 4 created, 1 updated · 14:29 – 15:12`, na hora da sua última publicação, que abre a lista com os links. A pílula diz `Round 3`.

**Muitos rascunhos** (`many`): a maior rodada real, 10 rascunhos, com um épico de cinco cards, duas atualizações, dois publicados, dois esperando o épico, um aviso de repositório e um de dependência.

**O arquivamento e o apagamento.** **Archive…** fica na barra de encerramento e no `⋯`, com o que o impede e a saída (`· the epic can't publish: approve one more card, or discard the epic`, `· a publication failed: Retry it, or discard the draft`, `· a publication is running`, `· approved drafts wait to be published`). O diálogo diz o que termina, o que foi publicado e o que não foi. **Delete discussion…** abre a confirmação do produto: o que vai embora, o que fica no GitHub. Arquivar ou apagar com a tela aberta dá a página do item que saiu (`structure.md` §1).

**Agrupar em épico** fica no `⋯`, habilitado com dois rascunhos soltos não publicados (cena `many`), num diálogo que pede o título.

## A · Todos abertos

O cartão da rodada se lê como um documento: cada rascunho aberto, com o corpo inteiro renderizado e a decisão embaixo.

**O que ela tenta:** ler tudo sem um clique, rolando, como o usuário lê um PR. Com um rascunho só, o caso mais comum, não há nada a abrir. O custo aparece com muitos: 5 rascunhos de 2,35 mil caracteres são uns 170 linhas de cartão, 10 são o dobro, o descartado continua aberto, e o estado dos outros (o épico criado, o card publicando) fica uma a duas telas acima enquanto se lê um.

## B · Um por vez

O cartão da rodada é uma lista: cada rascunho dobra em duas linhas, o tipo, o título e o estado à direita, depois os campos e as dependências. O atual abre no lugar, com o corpo inteiro e a decisão. Um clique, `Enter`, `↑` e `↓` abrem outro; `A` e `D` agem só no aberto.

**O que ela tenta:** a revisão que o usuário faz, um rascunho inteiro por vez, sem perder a rodada de vista: enquanto lê o 4, ele vê que o épico espera, que o 2 e o 3 esperam o épico e que o update de #461 já está no GitHub. Com 10 rascunhos, a lista dobrada tem uns 60 px por rascunho mais o corpo aberto. Quando nada resta a decidir, nenhum fica aberto.

## As cenas

| Cena | O que mostra | A · Todos abertos | B · Um por vez |
|---|---|---|---|
| `start` | O diálogo de início sobre o board, com #455 e #461 selecionados; `?home` da Home com o campo **Board** | Igual | Igual |
| `talk` | O contexto como marco, uma pergunta respondida, uma pergunta em texto com a resposta rápida; `Waiting for reply`. `?error`: o erro de sessão com **Retry** | Igual | Igual |
| `unreadable` | O documento escrito e `drafts.md can't be read`; `Waiting for the drafts` | Igual | Igual |
| `drafts` | A rodada 1: o épico e o 2 aprovados esperam, o 3 diz que aprovar não publica nada ainda | Os cinco abertos | O 3 aberto, os outros em duas linhas |
| `rewrite` | O pedido de títulos curtos e uma dependência; `Drafts revised`; 3 rascunhos `Revised` | Abertos | O 2 aberto |
| `publish` | O 4 é o último card do épico: a linha diz que aprová-lo publica o épico, o 2, o 3 e ele; aprovar roda a cadeia. `?after`: a cadeia no meio | Abertos | O 4 aberto, a cadeia nas linhas dobradas |
| `published` | A rodada inteira no GitHub, cada rascunho com o link e a saída, o marco da rodada, `Ready to archive` | Abertos, sem nenhum atual | Todos dobrados |
| `partial-fail` | A publicação parou no 3; o 4 não foi; **Retry** no 3 | O 3 com o erro | O 3 aberto com o erro |
| `epic` | 3 e 4 descartados: o épico não tem dois cards; `Epic can't publish` com a saída | Abertos | O épico aberto |
| `epic-off` | O épico descartado com 2 e 3 aprovados; `Epic discarded` | Abertos | O épico aberto |
| `many` | 10 rascunhos, com avisos; `?group` abre o diálogo de agrupar | Os dez abertos | O 3 aberto, nove dobrados |
| `done` | Três rodadas: 1 e 2 dobradas em marcos, a 3 com cartão e marco; `Ready to archive · round 3` | Igual | Igual |
| `archive-blocked` | O `⋯` aberto com **Archive…** tracejado e a saída | Igual | Igual |

## As quatro perguntas do levantamento

Respondidas pelo usuário durante a rodada; registradas em `design/research/interview.md`.

1. **Aprovar publica na hora?** Sim, quando o rascunho não depende de nada; o que depende espera ser criado depois do que ele depende. Aplicado nas duas: sem diálogo de publicação, sem **Publish epic**; o épico segue a regra de `features.md` (aprovado, todos os cards decididos, ao menos dois aprovados), e a linha antes do gesto diz a cadeia que ele dispara.
2. **O que ele lê antes de aprovar?** O rascunho inteiro. Aplicado: o cartão mostra o corpo completo renderizado, nunca um resumo, e a edição fica atrás de **Edit**. É o eixo entre A e B.
3. **Ele lê o documento na hora?** Não. Aplicado: o documento é um marco de uma linha que abre no lugar, sem destaque, e o painel **Documents** fica fechado.
4. **Várias rodadas na mesma discussão?** Um caso normal, não o principal. Aplicado: a rodada publicada vira um marco; a reescrita substitui a lista com os marcos e o `Was …`; a pílula conta a rodada. Nada disso muda a estrutura da tela com uma rodada só.


## O que ficou fora, e por quê

| Ficou fora | Por quê |
|---|---|
| O diálogo de publicação da rodada e o intervalo de desfazer | Resposta 1: aprovar publica na hora, como hoje. A proteção é a linha antes do gesto, o foco que não avança quando o gesto publica e a saída pelo GitHub |
| Resumo do corpo no cartão | Resposta 2: ele lê o rascunho inteiro |
| A coluna de decisão ao lado da conversa | A decisão do review pôs os cartões na conversa; o volume (mediana de 1 rascunho) não pede uma coluna |
| **Group into an epic** com caixas em cada rascunho | Nenhum épico do usuário em 28 rascunhos. Fica no `⋯`, num diálogo que pede o título |
| Edição aberta dos cinco a sete campos | 5 campos editados à mão em 28 rascunhos, todos títulos encurtados: fica atrás de **Edit** |
| O que mudou no corpo de um rascunho revisado | O marco `Drafts revised` diz o que mudou por rascunho (título, dependência); um diff do corpo revisado, como o **Changes** da atualização, seria o próximo passo, e pede guardar a versão anterior |
| A discussão pausada, a que termina sem rascunho e a com todos descartados | Seguem a task e o review: a pílula neutra com `paused` e **Resume** no cabeçalho; sem rascunho, a discussão fica `Discussing`; todos descartados, `Ready to archive` com `nothing published` |
| O histórico da discussão arquivada | É do History, na quinta tela da fase 4 |

## Componentes novos

Todos em `components.html`, em todos os estados, claro e escuro lado a lado; o rascunho dobrado aparece no escopo da B, como na tela.

| Componente | Estados |
|---|---|
| **Rascunho** (o corpo inteiro e o que o gesto faz) | padrão (não publica ainda), hover, foco, o gesto que publica uma cadeia, aprovado esperando, publicando, publicado com a saída pelo GitHub, descartado legível, desabilitado durante uma publicação, desabilitado em edição, erro com **Retry**, revisado com a aprovação limpa, épico sem dois cards, card de épico descartado |
| **Avisos do rascunho** | repositório fora do board, dependência que saiu, módulo que saiu, card fora da leitura, relendo o card, releitura que falhou |
| **Rascunho de atualização** (**Body** e **Changes**) | corpo, mudanças, publicado |
| **Rascunho dobrado** (B, duas linhas) | não decidido, hover, foco, pressionado, esperando, publicando, publicado, descartado, card de épico descartado, bloqueado por aviso, falhou |
| **Edição do rascunho** | editando, escolhendo uma dependência |
| **Marcos da rodada** | revisados, publicado até agora, publicado, parado, rodada dobrada, rascunhos ilegíveis |
| **Barra do pedido da discussão** | decidir, épico sem cards, épico descartado, falha, rascunhos ilegíveis, erro de sessão, tentando de novo, pronto para arquivar; hover, foco e desabilitado das ações |
| **Diálogo de nova discussão** | do board, da Home com a lista dos boards, relendo os cards, releitura que falhou, desabilitado, iniciando, erro |
| **Diálogos de arquivar, apagar e agrupar** | arquivar com o que não foi publicado, arquivando, apagar, agrupar sem título |
| **Página da discussão que saiu** | arquivada, apagada |

Nenhum token novo. O controle **Body** / **Changes** é o controle segmentado que o board propôs.

## Mudanças de feature

Nenhuma decisão de `decisions.md` é reaberta. Estes pontos mudam `features.md` (Discussão) ou `structure.md`:

1. **Publish epic sai.** O épico publica sozinho quando está aprovado e todos os cards dele estão decididos, com ao menos dois aprovados (a condição de hoje para habilitar **Publish epic**); um card do épico espera o épico; um card espera o rascunho de que depende. `structure.md` §3 perde a exceção de **Publish epic**; a de **Retry** fica.
2. **O rascunho diz o que o gesto publica** antes da decisão, e o foco não avança quando o gesto publica.
3. **O painel de rascunhos acima da conversa sai**: os rascunhos são um cartão na conversa, com o corpo inteiro, e a barra do pedido é a barra de decisão. Os campos ficam atrás de **Edit**.
4. **Dependências por título**: o campo pede um rascunho ou um card pelo título ou pelo número, nunca o id do rascunho.
5. **Situações novas**: `Epic can't publish` e `Epic discarded` no lugar do `Decide drafts` que fica de pé; `Ready to archive` (encerramento) quando tudo está publicado ou descartado, com **Archive…** na barra. Um card de épico descartado não segura o arquivamento.
6. **Marcos na conversa**: o contexto, o documento escrito, os rascunhos escritos e revisados, os rascunhos ilegíveis e um marco por rodada de publicação. Hoje a discussão só tem `Discussion started`.
7. **O contexto inicial** vira um marco que abre no lugar, e **What to discuss** fica como a mensagem do usuário.
8. **Documents** começa fechado e não troca de aba sozinho.
9. **Archive** e **Delete discussion** vão para o `⋯`; **Archive…** também fica na barra de encerramento.
10. **Durante uma publicação e durante a edição**, a decisão fica desabilitada com a razão, em vez de recusada com erro.
11. **A discussão arquivada ou apagada com a tela aberta** mostra a página do item que saiu.
12. **Group into an epic** vai para o `⋯`, num diálogo que pede o título.
13. **O erro de sessão da discussão** ganha **Retry** na barra.

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| Publicação em cadeia: o épico quando todos os cards estão decididos e dois aprovados, o card depois do épico e das dependências, sem **Publish epic** | O modelo das duas | Médio: `discussionflow/publish.go` e `decide.go` passam a tratar o épico como dependência na corrida de cada decisão; `PublishEpic` sai |
| O que um gesto publica (a cadeia) | A linha antes da decisão | Nenhum: derivado no frontend das decisões, das dependências e do que já foi publicado, com a mesma regra do backend |
| Marcos de discussão: contexto, documento escrito, rascunhos escritos, revisados (com quantos mudaram) e ilegíveis, e o marco da rodada de publicação | A conversa | Pequeno: tipos novos de marcador; o backend já sabe `documentRevision`, `draftsRevision`, `revision`, `publishedAt` e `unreadableDrafts` |
| A versão anterior dos rascunhos revisados (título, dependências) | O marco `Drafts revised` | Pequeno: o reconcile guarda o anterior antes de substituir |
| O número da rodada de cada rascunho | A pílula, o cartão, os marcos, a regra de dobrar | Pequeno: um contador que sobe quando uma leitura traz rascunhos novos depois de uma publicação |
| Situações `Epic can't publish`, `Epic discarded` e `Ready to archive`, com a notificação da última | A árvore, a pílula e a barra | Pequeno: `attention/derive_discussion.go` |
| **Retry** da sessão numa discussão | O erro de sessão | Pequeno: o frontend acha só tasks (`conversation.md` §1.2) |
| As partes do contexto montado e o tamanho | A linha do diálogo e o marco `Context` | Pequeno, como no board (`screens/board.md` §11) |
| A contagem `+4 −1` do diff | **Changes** | Nenhum: derivada no frontend do corpo e do `current` |
| O título de cada dependência | `Depends on` | Nenhum: `DraftRef` já tem `title` |

## Como foi testado

- Chromium headless, pelo `http.server` da lab numa porta própria (8117), com a Fira do Google Fonts. As capturas foram olhadas cena a cena, nos dois modos, a 1100, 1250, 1600 e 2560 px, e o espécime seção a seção.
- `?audit` nas treze cenas das duas variações, nos dois modos, a 1100, 1250, 1600 e 2560 px (208 combinações), e as combinações `talk&error`, `publish&after`, `drafts&edit`, `many&group`, `published&delete`, `start&home` e `done&archive` a 1100 e 2560 px: nenhuma caixa posicionada pelo layout em meio pixel, nenhum texto cortado sem tooltip, nenhum controle sem nome, todo texto com 4,5:1 ou mais sobre o fundo real, nenhuma rolagem horizontal.
- `components.html?audit` nos dois modos: nenhum texto abaixo de 4,5:1 e nenhum controle sem nome.

## Recomendação

**B · Um por vez.**

- **É a revisão que o usuário descreveu**: um rascunho inteiro por vez. Com um rascunho só (a mediana), B e A são a mesma tela.
- **O modelo de publicar ao aprovar faz a consequência de cada gesto ser o que mais importa ver**, e só a B a mantém à vista: a linha antes do gesto diz a cadeia, e as linhas dobradas mostram o épico criado, o card publicando e o que espera. Na A, isso fica uma a duas telas acima.
- **O cartão cresce duas linhas por rascunho**, não um corpo: com 10 rascunhos (`many`), a lista dobrada cabe numa tela com o aberto.

O custo da B, para o usuário julgar: o corpo de um dobrado espera um clique ou `Enter`, e `A` e `D` só agem no aberto, então quem quer ler tudo de uma vez rola menos na A.

## Depois da crítica

`critique.md` pediu oito condições; o coordenador as resumiu em sete pontos. Todos estão nas duas variações e no espécime.

1. **A regra do épico é a de `features.md`**: publica quando aprovado e com todos os cards decididos, ao menos dois aprovados. A linha antes do gesto (`.dcons`) diz exatamente o que **Approve** e **Discard** publicam agora, com os nomes da cadeia, ou o que o rascunho vai esperar; **Approve** a tem como descrição acessível. A frase "a regra de hoje" saiu.
2. **O `A` repetido**: o gesto que publica não avança o foco; o que não publica avança, e as teclas esperam 0,9 s no rascunho seguinte, com a repetição do teclado ignorada. A saída de um erro é dita no rascunho publicado: `To take it back, close billing#479 on GitHub.`
3. **O épico descartado** tem estado (`The epic is discarded · this card won't publish`), barra (`Epic discarded`, com a saída) e cena (`epic-off`), e não segura o arquivamento. O arquivamento bloqueado diz a causa e a saída.
4. **Publicação e revisão ditas uma vez**: sem toast; um marco por rodada, que se atualiza, com o estado de cada rascunho dentro; a revisão é o marco `Drafts revised` e a etiqueta `Revised`, no vocabulário do review. Saíram o marco `replaced`, o cabeçalho do cartão e a linha `Was`. A regra de quando uma rodada dobra está escrita, e a cena `done` segue a ordem do tempo.
5. **Estados que faltavam**: os rascunhos ilegíveis (cena `unreadable`), o erro de sessão com **Retry** (`talk&error`), os avisos do rascunho (cena `many` e o espécime), a confirmação de apagar (`?delete`), a releitura dos cards no diálogo de início, a página do item apagado.
6. **A cena `many`**, com 10 rascunhos, avisos e o diálogo de agrupar alcançável.
7. **Na B, a linha dobrada tem duas linhas** (o tipo, o título e o estado; os campos e as dependências cortados com tooltip), e o espécime mostra o rascunho dobrado no escopo da B, como na tela, com o pressionado distinto.

Também entraram: a pastilha **Ask for changes** em toda cena com rascunhos a decidir; **Approve** desabilitado durante a edição e o título sem repetição; o seletor **Epic** com reticências e tooltip; o `+`/`−` do diff com texto oculto; o ícone do board no diálogo de início; a linha da árvore publicando sem a linha 3 do agente; nenhum rascunho atual quando nada resta a decidir; `SIT.ready` removido.

## Decisão

**B · Um por vez**, decidida em 2026-09-24. Ver `design/decisions.md`. O documento da tela é `design/screens/discussion.md`.
