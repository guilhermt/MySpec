# 01 · Estrutura: o shell e a navegação

Fase 2. Wireframes em escala de cinza.

## O que a rodada explora

Como o app se organiza como um todo. A rodada pergunta como o usuário vê de longe o que depende dele e o que o agente está fazendo, como abre um item por vez com a conversa no centro, como volta de onde veio, e como tudo isso funciona em qualquer largura entre cerca de 1100 px e 2600 px. As três variações diferem no modelo:

| | A · Árvore e caminho de volta | B · Fila por urgência | C · Três modos |
|---|---|---|---|
| O que organiza a lateral | Board › épico › item (árvore) | Quem precisa se mexer (lista plana) | O modo de uso: Discuss, Implement, Review |
| Como se navega | Um lugar por vez, com histórico ← → | O item é a base; os lugares abrem como camadas por cima | Cada modo lembra o que estava aberto |
| O item aberto | Barras no topo e conversa; coluna de decisão só quando há o que decidir | Duas colunas fixas: a conversa e a coluna do item | A conversa ocupa tudo; o resto abre sobreposto |

Todos os mocks têm o mesmo estado: três tasks (implementação `Agent` no step 3 de 7 com o agente rodando, PR esperando checks, tech spec com uma pergunta há 12 min), um review de PR com 4 de 9 apontamentos por decidir, uma discussão com o agente rodando, dois boards (um com a última leitura falhando) e três repositórios.

## Como abrir

Cada variação tem dois arquivos: o item aberto (`a.html`, `b.html`, `c.html`) e nada aberto (`a-empty.html`, `b-empty.html`, `c-empty.html`). Cada página se adapta de verdade quando a janela muda de largura. Um selo tracejado no rodapé mostra a largura atual; **Notes**, no canto, explica o modelo e a legenda dos glifos. Os mocks são navegáveis: as linhas abrem os itens, e os atalhos funcionam.

- Lado a lado, cada um com cerca de 1250 px num monitor de 2560 px: `compare.html?a=01-structure-shell/a.html&b=01-structure-shell/b.html&c=01-structure-shell/c.html`
- Para abrir outro item direto: `a.html?open=r1` (`t1`, `t2`, `t3`, `r1`, `d1`). Na B, uma camada: `b.html?layer=reviews`.

Convenções do wireframe: o status aparece como forma e rótulo. Losango é erro, disco cheio é "espera por você", anel é encerramento, disco girando é o agente trabalhando, círculo tracejado é espera pelo GitHub. Na fase 3, a forma ganha cor. As letras T, R e D ocupam o lugar do ícone de tipo. Nas linhas, o tempo à direita em negrito é há quanto tempo o item espera por você; em peso normal, é há quanto tempo o agente está no turno. A terceira linha, com a ação em curso e o contexto, aparece só com o agente rodando.

## A · Árvore e caminho de volta

**A ideia.** A árvore que o brief decidiu manter, levada a sério. A árvore é o painel de comando, e o resto do app é um lugar por vez, com um caminho de volta de verdade.

- **Lateral.** Primeiro `Reviews`, com `4 pending` e os reviews ativos; depois um nó por board, com os épicos dentro; por fim `No board`, quando há algo nele. Cada linha diz o tipo, o nome, o tempo, o status (etapa e step, ou o que pede) e, com o agente rodando, a ação em curso e o contexto. Um nó recolhido mostra o resumo do que tem dentro (quantos esperam por você, quantos rodam), então recolher nunca esconde o que depende de você. A falha de leitura do board fica no nó. O filtro por repositório fica no topo, e History, tema e Settings no rodapé.
- **`Ctrl+J`** fica na própria linha que ele abriria: a marca `Ctrl J` substitui o meta dessa linha. Ele percorre os itens que esperam por você, em ordem de urgência. Não existe seção que repita os itens.
- **Item aberto.** Cabeçalho com ← →, breadcrumb (board › épico › item, ou Reviews › review), contexto, Pause, modo de review, Models e os botões dos painéis. Abaixo, a trilha de etapas, a barra do step e as abas `Implementer`/`Reviewer` (ou a barra da PR, do review ou da discussão). A conversa fica numa coluna de leitura centrada, com o compositor embaixo. Apontamentos e rascunhos ficam numa coluna à direita da conversa enquanto há o que decidir.
- **Painéis auxiliares** (Artifacts, Card, Reports, Documents): fechados por padrão, um botão cada no cabeçalho, e `Esc` fecha. A partir de 1900 px viram coluna; abaixo disso, se sobrepõem à conversa.
- **Navegação.** Board, Reviews, History e Settings são lugares na área principal, como os itens. `Alt+←` e `Alt+→`, ou os botões, percorrem o histórico. Fechar Settings (`Esc` ou `Close`) volta ao lugar anterior, não a Home.
- **Nada aberto.** Home: `Continue` com o último item aberto (`Enter`), as três ações de início, os boards com o estado da leitura e os atalhos. Home não lista o que espera por você; isso fica na árvore.
- **Estreita.** A lateral vai de 360 px a 272 px. O meta das linhas e as ferramentas secundárias do cabeçalho saem primeiro. A lateral pode recolher (`«`) numa faixa de 48 px com um bloco por item (tipo e status), então o status continua visível.
- **Os três modos** aparecem implícitos: Review é o primeiro nó; implementação e discussão convivem sob o board, porque os dois partem dos cards dele.

**Contra.** Uma árvore por board mistura tasks e discussões e cresce com os boards. Com o volume do brief (5 a 6 itens) isso não pesa. A ordem dentro de cada nó é a de criação, não a de urgência, e é a marca `Ctrl J` que diz qual é o próximo.

## B · Fila por urgência

**A ideia.** A lateral é uma fila única, ordenada por quem precisa se mexer. O item aberto é sempre a base, e os lugares abrem por cima dele.

- **Lateral.** Uma lista plana de tasks, reviews e discussões ativos, nesta ordem: precisa de você (a espera mais antiga primeiro), agente trabalhando, esperando o GitHub, ocioso. Legendas finas marcam onde cada grupo começa, e cada item aparece uma vez só. Board, repositório, card e épico viram o meta da linha. Os três modos são filtros da fila (`All`, `Implement`, `Review`, `Discuss`), junto do filtro por repositório.
- **`Ctrl+J`** abre o topo da fila: a ordem que o usuário vê é a ordem que o atalho segue.
- **Barra superior** com os lugares: `Boards ▾`, `Reviews 4 pending`, `History`, `+ New`, tema e `Settings`.
- **Item aberto.** Duas colunas fixas. No centro, a conversa, com a barra do step e as abas acima. À direita, a coluna do item: o progresso (etapas com os steps aninhados e as ações do step), os checks da PR, os apontamentos ou rascunhos a decidir, e os dados da task (repositório, card, épico, modo de review, modelos). Os painéis auxiliares abrem como folha sobre a conversa.
- **Navegação.** Board, Reviews, History e Settings abrem como camada sobre a área principal, com `← <item>` e `Esc` para voltar exatamente onde o usuário estava. Abrir um item a partir de uma camada troca a base. Não há histórico além da base mais uma camada.
- **Nada aberto.** O último board é a base, com uma faixa dizendo que nenhum item está aberto e que `Ctrl+J` abre o topo da fila.
- **Estreita.** A coluna do item recolhe numa faixa de 44 px (`‹ Progress`, `‹ Findings 5/9`) que abre sobreposta, e a etapa vai para o cabeçalho como etiqueta.

**Contra, e a decisão que ela toca.** O brief diz que "a árvore precisa ser excelente, não substituída" (seção 5). A B substitui o agrupamento por board pela ordem de urgência. Ela respeita a outra metade da decisão (não há seção que repita itens), mas deixa de mostrar onde cada item vive. Ela está aqui porque é a leitura mais direta do "de longe" e do `Ctrl+J`. Há dois custos: a fila reordena sozinha quando um item muda de grupo, e isso desorienta quem está com o olho nela; e na largura estreita a coluna do item recolhe, o que esconde apontamentos e ações do step atrás de um clique justamente quando eles são o que importa.

## C · Três modos

**A ideia.** A estrutura segue as três coisas para as quais o app é aberto (brief seção 2): **Discuss**, **Implement** e **Review**. Um trilho com os modos, um painel com a lista do modo e a conversa ocupando o resto.

- **Trilho.** Os três modos (`Ctrl+1`, `Ctrl+2`, `Ctrl+3`), cada um com um selo: disco cheio e quantos itens esperam por você naquele modo, ou disco girando quando só o agente trabalha. History, Settings, tema e o botão do painel ficam embaixo.
- **Painel por modo.** Implement: as tasks na árvore por board e épico, e os boards para começar de um card. Review: os reviews em andamento, as PRs pendentes (a lista vive aqui) e as PRs do usuário. Discuss: as discussões ativas e os boards para escolher cards.
- **`Ctrl+J`** atravessa modos: abre o próximo item que espera por você e troca para o modo dele.
- **Item aberto.** A conversa ocupa a área principal. Etapa e step viram um chip no cabeçalho (`Implementation · Step 3 of 7 ▾`, `Tech spec · Question · 12m`) que abre `Stages and steps`. Steps, Artifacts, Card, Reports e Documents abrem como sobreposição pela direita. Numa janela larga, a sobreposição não cobre a coluna de leitura. **Os apontamentos são decididos dentro da conversa**, no marco do relatório, com uma barra de decisão acima do compositor (`4 findings to decide · Next N · Publish review`). Isso junta os dois fluxos que o brief aponta como decididos de formas diferentes (seção 10).
- **Navegação.** Cada modo lembra o que estava aberto: trocar de modo traz de volta o último item dele, e clicar de novo no modo ativo leva à home do modo. Settings e History tomam o painel e a área principal, e `Esc` volta ao modo de onde o usuário saiu.
- **Nada aberto.** A home do modo. Implement: nova task e os boards. Review: a lista de PRs. Discuss: os boards para escolher cards.
- **Estreita** (abaixo de 1500 px). O painel recolhe, e o trilho mostra cada item ativo como um bloco com o status, sob o seu modo. Assim, a 1250 px, a conversa tem quase toda a largura e o status de tudo continua à vista. Clicar no modo ativo, ou em `»`, abre o painel sobreposto.

**Contra, e a decisão que ela toca.** Numa janela larga, o painel mostra só o modo atual. Os itens dos outros modos aparecem como contagem no selo, não como linha. É menos que a árvore do brief (seção 5), que mostra todos os itens de uma vez. Os blocos do trilho resolvem isso na largura estreita, mas não na larga, onde o painel está aberto. O trilho também acrescenta um nível de navegação para um volume de 5 a 6 itens. E decidir apontamentos na conversa é uma aposta de tela (fase 4), não só de estrutura.

## Como cada variação lida com os três modos

- **A**: implícitos. Review é o primeiro nó da árvore; implementação e discussão ficam juntas sob o board, porque os dois começam nos cards dele. Home oferece as três ações de início.
- **B**: filtros da fila. Os modos não são lugares, só recortes da mesma lista, e a urgência atravessa os três.
- **C**: são a estrutura. Cada modo tem a sua lista, a sua home e a sua memória, e `Ctrl+J` e os selos ligam os três.

## Recomendação

**A.** É a que cumpre o brief sem nenhuma exceção: a árvore com status é o mecanismo de "depende de mim", sem repetição de itens; tudo o que está ativo fica visível de uma vez em qualquer largura; o caminho de volta é explícito e previsível (← →, breadcrumb, Settings voltando para onde o usuário estava); e ela não acrescenta nível de navegação para um volume pequeno. Os três modos existem nela sem virar lugares, o que combina com "o dia não tem padrão" (brief seção 2): o usuário não precisa escolher um modo para ver o resto.

Três ideias das outras variações cabem na A sem mudar o modelo, e valem a decisão do usuário depois de escolher o shell:

1. Da C, decidir apontamentos e rascunhos dentro da conversa, com a barra de decisão acima do compositor, em vez da coluna à direita. Isso resolve o problema dos dois fluxos diferentes e libera largura na janela estreita.
2. Da C, o chip de etapa e step no cabeçalho, no lugar da trilha fixa, para dar mais altura à conversa.
3. Da B, a camada: History e Settings sobre o item, com `Esc`, em vez de lugares no histórico.

Se o usuário pensa no app primeiro pelos três modos, a C é a alternativa. Nesse caso, a próxima rodada deveria testar o painel da C mostrando os três modos empilhados, com o atual expandido, para não perder a visão de tudo.

## Dados que faltam

- **Ação em curso do agente e início do turno de um item não aberto.** As três variações mostram, na linha, a ação em curso (`Editing internal/http/middleware/ratelimit.go`) e há quanto tempo o turno roda (`4m`). O `State` só tem `turnRunning`. O backend precisa levar ao resumo de cada item a última ação `running` (rótulo e alvo) e `turnStartedAt`. Isso já está decidido em `decisions.md` (Tempo, contexto e atividade de longe).
- **Os checks durante `Waiting for checks`.** `3 of 5 passed`, com os nomes (`build-ios running`, `ui-tests queued`), aparece na linha, na barra da PR e na coluna do item da B. O backend lê a lista completa a cada minuto, mas o DTO só leva os checks que falharam, e só depois do review. Custo: backend pequeno.
- **Há quanto tempo a PR espera os checks.** Os mocks mostram só `checked 40s ago` (`checkedAt` chega e hoje não é usado). O início da espera não é exposto, e esperar o GitHub não é uma situação, então não tem `startedAt`. Se o usuário quiser o tempo nessa linha: backend pequeno.
- **Último item aberto e histórico de navegação** (A: `Continue` e ← →; C: a memória de cada modo). Não existem. São estado do frontend, a persistir entre execuções como o filtro por repositório.

Derivável no frontend a partir do que já chega, sem backend: `N of M decided` dos apontamentos e dos rascunhos (`passes[].findings[].decision`, `drafts[].decision`), a contagem de cards abertos por board e a ordem por urgência fora de `Waiting for you` (`situations[]` com `startedAt`).

## Atalhos que as variações acrescentam

`Alt+←` e `Alt+→` (A), `Ctrl+1`, `Ctrl+2` e `Ctrl+3` (C) e `N` para o próximo apontamento (C). `Ctrl+N`, `Ctrl+J` e `Ctrl+,` continuam em todas, com o mesmo bloqueio nos diálogos de criação. As setas percorrem a árvore (A) e a fila (B).

## Decisão

**A**, decidida em 2026-09-23 como modelo, não como componentes nem visual. O usuário observou que o wireframe ainda se parece com o app atual; a rodada 02 refina o modelo e as fases 3 e 4 redesenham o visual e cada tela. Ver `design/decisions.md`.
