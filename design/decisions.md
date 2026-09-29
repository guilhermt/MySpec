# Decisões

Uma entrada por decisão, da mais recente para a mais antiga. Cada uma diz a data, o que foi decidido, o que foi descartado e a razão em uma ou duas frases. Uma decisão revista ganha uma entrada nova que aponta a antiga; a antiga não é apagada.

## 2026-09-29 · Review: o que a entrada da task 6 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 6 (`tasks/06-review.md` §4.3). A contagem do nó **Reviews** é a da seção `Pending`: uma PR pendente com review ativo fica em `In review` e na árvore, e deixa de contar (`changes.md` R1). O card no painel da PR abre o painel dele na visão do board quando está na leitura, como o painel `Card` da task (R4). Chegar a um review por `Ctrl+J` ou pela notificação leva o foco ao que a situação pede, como na task (R18). **Review again…** abre sempre o diálogo no review, também num check que falhou e numa passada bloqueada; **Publish failed** age abrindo o diálogo de publicação. Desmarcar **Include the summary** publica sem o resumo e não o apaga (`backend.md` P47). Uma passada publicada sai do cartão para o marco `You decided`, que abre os apontamentos desabilitados; uma passada não publicada que um **Review again** deixa para trás fica só com o marco do relatório. O título do apontamento é opcional no relatório: sem ele, a localização toma o lugar. O lugar da barra do review é a passada (`pass 1`), salvo `Ready to merge`. Depois da crítica da entrada: a hora de uma falha de leitura é a da primeira falha da sequência; se o GitHub exigir um corpo para `Request changes` e `Comment`, uma passada sem resumo e sem apontamento no corpo envia o corpo mínimo `Review with N inline comments.`, em vez de recusar o veredito; o diálogo reaberto depois de uma falha traz o veredito e a caixa da tentativa. Descartados: a contagem com as PRs em review, **Review again** direto sem diálogo num check que falhou, e o cartão de uma passada antiga ainda aberto na conversa. Razão: nenhuma muda um fluxo, apaga dado ou desdiz o aprovado; cada uma fecha um caso que o documento da tela deixava sem texto ou com duas respostas.

## 2026-09-28 · Implementação: a task 5 corre em paralelo com a 4

Decidido pelo coordenador da frente, por delegação do usuário. A task 5 (Home, board e criação de task) não depende da 4 (a conversa), só da 2, e corre em paralelo com ela; a que terminar antes entra antes, e a outra faz rebase, `task generate` e `task check` antes da revisão do crítico (`tasks/05-board.md` §6). Revê em parte o princípio "uma task por vez, na ordem" de `implementation.md` §1, confirmado em 2026-09-25, só para esse par. Descartado: esperar o merge da 4. Razão: as duas tocam arquivos diferentes, salvo conflitos textuais listados, e a 4 é a maior da frente.

## 2026-09-28 · Board: o que a entrada da task 5 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 5 (`tasks/05-board.md` §4.3). Um card escrito por uma discussão ainda ativa também está `In discussion`, e o painel do card leva à discussão que o escreveu mesmo arquivada (`From the discussion <título>`), porque é dela que vem a seção `Discussion` do contexto. O **New discussion** do menu **+ New** pergunta o board, como o da Home, quando o lugar na tela não tem board. **Continue** fica com o item ativo aberto mais recente que ainda existe, pela pilha de lugares, e nunca mostra um item que saiu. No painel `Card` da task, um card do board abre o painel dele na visão do board (`changes.md` B13, já no escopo confirmado da task 5). **Add to board** continua sem abrir o diálogo de criação sozinho: o card passa a **Start task** ou a **Clone and continue**, com o foco nele. Descartados: o **Continue** desabilitado com o item que saiu, e o `In discussion` só para os cards de entrada. Razão: menos becos sem saída e o mesmo caminho para a mesma pergunta, sem mudar um fluxo.

## 2026-09-28 · Conversa: saída dos comandos guardada inteira e resposta pelo compositor

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 4. A saída de cada comando é guardada inteira (do Bash, o que ele imprimiu; de qualquer ferramenta que falhou, a razão; do subagente, o relatório final), até 64 KiB por ação, numa tabela própria lida sob demanda por **Show all**; o transcript leva a contagem e a cauda que a tela mostra. Com uma pergunta estruturada aberta, o texto do compositor responde a pergunta, como o **Other…** da primeira pergunta ainda sem escolha, em vez de esperar na fila; com mais perguntas sem escolha, o foco volta ao cartão. Descartadas: guardar só as últimas 40 linhas, e a mensagem livre na fila enquanto o cartão espera. Razão: o CLI já corta cada saída em 30.000 caracteres (mediana de 105 KB por sessão), e 42% das saídas passam de 40 linhas; a mensagem na fila nunca chegava enquanto o cartão esperava, e o placeholder aprovado já prometia a resposta.

## 2026-09-25 · Conversa: largura única de 960 px

Escolhida a variação A da rodada `lab/16-conversation-wide`: a conversa é uma coluna centrada de 960 px em que tudo tem a mesma borda esquerda e direita: a fala do agente (texto na página, sem cartão), a mensagem do usuário (fundo próprio, mesma largura), os blocos de comando, o código, as tabelas, os cartões de pergunta e permissão, os apontamentos, os marcos, a barra do pedido e o compositor. Corpo em 15 px. Sem hora visível (só em hover), sem avatar, sem linha do tempo; o autor é uma palavra pequena; ações como bloco de comando no estilo dos terminais (rótulo pela descrição, comando apagado, saída dobrada, falha com a cauda aberta); código longo cortado em 20 linhas com `Show all`; pergunta e permissão são os únicos blocos com contorno; o azul deixa de marcar o agente na conversa. Descartadas: B (fluida até 1120 px com 16 px) e a linha de leitura mais estreita que os blocos (rejeitada pelo usuário: "umas coisas menores que outras"). A rodada 15 fica como a origem (a C era a base).

## 2026-09-25 · Conversa: cartões leves como base, coluna mais larga, sem linha do tempo

Da rodada `lab/15-conversation`, a variação C (cartões leves) é a base: cada fala num cartão de superfície sutil, ações e marcos em linhas entre os cartões. Descartadas A (documento com margem de autor e hora) e B (linha do tempo com fio), que o usuário achou poluídas e com o conteúdo principal descentralizado. Pedidos para a rodada seguinte: aproveitar melhor o espaço com uma coluna de leitura mais larga; algo limpo e fácil de usar; sem dar importância a coisas pouco relevantes, como o horário de cada mensagem ou uma linha do tempo própria; referências pesquisadas, inclusive de terminais.

## 2026-09-25 · Plano de implementação e mudanças sensíveis confirmados

O usuário confirmou `implementation.md`: a sequência de doze tasks, as duas divisões (fundação em 1 e 2; tela da task em 3 e 4), os dois backends médios como tasks próprias (7 e 8), a substituição dos tokens do frontend pelos de `design/system/tokens.css` com a ponte para o shadcn e o tema por `data-theme`, e as seis mudanças de comportamento mais sensíveis de `changes.md` (S1; T1, T4, T6; B3; R11, R12; T16; D3, D4). Antes da task 4, uma rodada dedicada às entradas da conversa (`lab/15-conversation`) refina o que a tela da task decidiu, sem reabrir a estrutura da tela.

## 2026-09-25 · Settings, History, boas-vindas, diálogos e avisos

Aprovada a rodada `lab/14-screen-rest` como está: Settings abre em Defaults (modelos por etapa e modo de review como centro) com quatro páginas, Defaults, Boards, Repositories e Prompts, os nove prompts como uma lista numa página; sem página de aparência, o tema fica no rodapé da lateral. History é uma lista só, por data, com tipo, onde e resultado, e o filtro por repositório da lateral vale nele; a task arquivada mostra o resultado do encerramento e os relatórios. O cadastro de board tem três etapas com `Back`, e a linha do repositório diz o que acontece ao desmarcá-lo. As boas-vindas têm o bloco `This machine` só quando falta algo. Os diálogos destrutivos abrem com o foco em Cancel e mostram a prévia do que será destruído; os de criação abrem no primeiro campo. As notificações têm um texto por situação, listados em `screens/rest.md`.

## 2026-09-24 · Discussão: um rascunho por vez, aprovar publica

Escolhida a variação B da rodada `lab/13-screen-discussion`: os rascunhos de uma rodada como lista dobrada com o estado de cada um à direita, o atual aberto com o corpo inteiro renderizado, `A` e `D` decidindo e abrindo o próximo (com proteção contra a tecla repetida: um gesto que publica mantém o foco). Aprovar publica na hora um card sem dependência; um card que depende do épico ou de outro card espera e segue sozinho; o épico publica quando todos os cards dele estão decididos e ao menos dois aprovados; antes do gesto o cartão diz o que `Approve` publica agora ou se vai esperar; o desfazer de uma publicação é fechar a issue no GitHub, dito no cartão. Pedir mudanças pela conversa é o caminho principal, e uma rodada nova de rascunhos substitui a anterior com um marco. O documento da discussão é um marco de uma linha, painel fechado. Sem `Publish epic` nem toast; um marco por rodada de publicação com o estado por rascunho. Depois de tudo publicado, a barra de pedido diz `Ready to archive`. Descartada a A, todos os rascunhos abertos.

## 2026-09-24 · Review: cartões na conversa, publicação em diálogo

Escolhida a combinação da rodada `lab/12-screen-review`: os apontamentos como cartões na conversa, decididos com `A` e `D` que avançam ao próximo, com a barra de decisão acima do compositor (variação A); a publicação num diálogo mínimo, com o veredito como escolha explícita (sugerido pelas decisões, nunca pré-marcado) e o resumo opcional (variação B). Descartados: o cartão de publicação dentro da conversa (A) e a coluna de apontamentos (B). Junto: a lista de PRs no padrão do board com linha mínima, a PR aberta em painel, `R` inicia o review, início com bons defaults, espera dos checks pelo nome, `Review again` com commits novos, review encerrado no merge; sem review de consulta, sem trecho de diff no cartão, GitHub como primeira ação na localização.

## 2026-09-24 · Board: por status, card em painel

Escolhida a variação A da rodada `lab/11-screen-board`: a lista do board agrupada pelas seções de status do board, na ordem dele, com as finais recolhidas e o épico como rótulo na linha; o card abre num painel à direita, sem sair da lista. Descartadas: B, agrupada por épico com o card no lugar, e a combinação por status com o card no lugar. Junto: a linha do card mostra só o que decide a escolha (número, título, task com o estado, `In discussion`, dependência não satisfeita), `Start task` e `Discuss` no card e pelas teclas `S` e `D`, `New discussion` no cabeçalho com `N`, seleção múltipla só num modo pelo `⋯`, Home mínima com `Continue`, criação de task com os modelos recolhidos sob um resumo e o contexto do card sob `Show`.

## 2026-09-24 · Tela da task: stepper e abas mínimas

Escolhida a variação B da rodada `lab/10-screen-task-minimal`: um stepper compacto no cabeçalho, com as etapas nomeadas (feitas com marca, atual expandida com a posição e a passada de review, futuras como círculo), sem trilha inteira nem tempos; implementador e revisor como duas abas mínimas acima da conversa, só enquanto o step tem os dois; a conversa do lugar atual; o compositor com a barra de pedido. Descartada a A, com a linha fina e uma conversa só. Condição herdada da crítica: o stepper mantém os nomes das etapas na metade do monitor. Consequências das decisões anteriores, agora fixas: grupos de ações recolhidos por padrão, rotulados pela descrição do agente; mensagens do produto como marco de uma linha com o conteúdo a um clique; conversas anteriores e relatórios em `Details`; ferramentas do step, da PR e da task no menu `⋯`; Review mode e Models mudam por popover no `⋯` e em `Details`.

## 2026-09-24 · A tela da task é mínima

A tela da task mostra a conversa do lugar atual e um indicador de progresso bonito e simples, que diz de um olhar em que etapa a task está, o que já foi concluído e o que está rodando. Nada mais compete pela atenção. Descartadas as duas variações da rodada `lab/09-screen-task`: a conversa contínua com margem de marcos, cabeçalho do laço e filtro de vozes (A), e o trilho de workflow com uma conversa por lugar e coluna de apontamentos (B). As duas ficaram piores que a tela atual por poluição. Razão, nas palavras do usuário: voltar à conversa de uma etapa ou de um step anterior não é uma necessidade; ele não quer checkpoints nem barras cheias de informação tirando o foco; quer uma tela limpa, enxuta, minimalista, feita por quem faz o que importa. Consequências: o histórico das conversas anteriores fica acessível fora da tela (por exemplo no painel `Details`), não na tela; a barra de pedido continua, porque é o que importa; o que ficou bom na rodada 09 (rótulo da ação pela descrição, subagente aninhado, mensagem do produto como marco de uma linha, `Retry` por sessão, resposta rápida) entra na tela mínima sem acrescentar cromo.

## 2026-09-24 · Fundação visual aprovada

A linguagem visual e o design system estão aprovados como consolidados em `lab/08-visual-final`: `principles.md` (dez princípios), `system/tokens.css` (a fonte única dos tokens, nos dois modos) e `system/components.md` (anatomia, variantes, estados, teclado e acessibilidade de cada componente base). Tema Grafite quente; Fira Sans e Fira Code; dois registros de densidade; superfícies em camadas; cor como sinal. A tela da task na rodada 08 é a referência visual, não uma tela aprovada: o topo do item e a conversa são redesenhados na fase 4, e os nove itens de polimento do `critique.md` da rodada 08 (seção 7) são pauta da fase 4.

## 2026-09-24 · Os papéis da cor de identidade

O azul de identidade tem papéis fixos: marca, ação primária (uma por tela; o `Send` do compositor só vira primário quando nada mais na tela espera pelo usuário), foco, linha aberta (véu, anel e glifo), etapa atual na trilha, `Ctrl J`, medidor de contexto, links, marcador da fala do agente, ícones ativos. As superfícies e as sombras são neutras, sem o azul. Nunca pinta um estado: espera é âmbar, erro é vermelho, encerramento é verde, trabalhando é tinta neutra em movimento, GitHub, pausado e ocioso são tinta secundária. Razão: a identidade precisa de presença para o produto ter caráter, e de papéis fixos para nunca competir com um sinal.

## 2026-09-24 · O meta da linha aparece em hover, foco e na linha aberta

O repositório e o `#card` de uma linha da árvore aparecem só em hover, foco de teclado ou na linha aberta, e só quando cabem ao lado do nome inteiro; quando não cabem, vão para o tooltip do nome. Muda o brief (seção 3, "de relance" do repositório na task) e `structure.md` §2. Descartado: meta sempre visível. Razão: o agrupamento por board já diz onde a task vive, e a árvore fica muito mais calma sem o meta em cada linha; um nome nunca é cortado por causa do meta.

## 2026-09-24 · Desvios da estrutura absorvidos pela linguagem

Três escolhas da fase 3 reescrevem `structure.md`: a aba Implementer/Reviewer mostra o glifo da situação e o rótulo, sem o chip de tempo (o tempo fica na barra de pedido e na árvore); a linha da árvore com o agente rodando tem um único spinner, no início da segunda linha, sem o da borda direita; e o topo do item cede espaço em ordem numa área principal estreita (abaixo de cerca de 1020 px as etapas futuras ficam só com o círculo). O topo é provisório: a fase 4 o redesenha, e a regra de largura não entra em `structure.md` §6.

## 2026-09-24 · Tema: Grafite quente

A cor do MySpec é o tema **Grafite quente** do explorador `lab/07-theme-explorer`: neutros levemente quentes (o traço de calor do carvão e do papel do Cobre, bem abaixo do Sálvia) com um azul elétrico de identidade, levemente puxado para o cobalto e com menos saturação para conviver com o papel morno; lateral no tom da página; estados com as cores de sempre (âmbar de espera, vermelho de erro, verde de encerramento, "trabalhando" em tinta neutra). Descartados: Cobre e Cobre II (identidade quente, o usuário preferiu o azul), Grafite frio (o usuário achou frio demais), Sálvia (passa do ponto no calor), Marinho quente, e os demais temas do explorador. Razão: o usuário gostou do azul do Grafite e do calor do Cobre; neutros levemente quentes com acento azul é uma combinação sólida do gênero.

## 2026-09-24 · A cor de identidade é decidida na fase 3

O MySpec ganha uma cor de identidade, escolhida pelo usuário entre variações da rodada `lab/05-visual-b-variations`, aplicada com parcimônia (marca, ação primária, foco, seleção) e nunca no lugar de uma cor de estado. Descartado: ficar só em cinza com cor semântica, como nas direções da rodada 04. Razão: o usuário quer um produto com caráter, não uma ferramenta acromática; a rodada 04 orbitou o cinza e deixou a decisão implícita.

## 2026-09-24 · Estrutura aprovada, com o topo do item em aberto

A estrutura consolidada em `lab/03-structure-final` está aprovada e registrada em `structure.md`: a árvore com a anatomia de linha compacta, a navegação com histórico, a barra de pedido acima do compositor com a única cópia da ação, os painéis fechados por padrão, `Details` como painel, os estados de toda tela, a largura contínua. Ficam explicitamente em aberto para a fase 4, na primeira tela (a task com a conversa): o topo do item aberto, hoje quatro faixas empilhadas (cabeçalho, trilha de etapas, barra do step, abas Implementer/Reviewer) herdadas do app atual; a experiência de progresso entre as etapas; e a experiência dos agentes que implementam e revisam. Razão: são estruturais, mas não se resolvem em wireframe cinza; a tela da task é onde a direção visual e a hierarquia do item são provadas juntas. O usuário registrou a ressalva de que muita coisa ali ainda segue o padrão atual e precisa ser refinada a fundo.

## 2026-09-23 · Modelo do shell: árvore e caminho de volta

Escolhida a variação A da rodada `lab/01-structure-shell`: a árvore da barra lateral (Reviews, depois board › épico › item) é o painel de comando, com status, tempo de espera, ação em curso e contexto em cada linha; um lugar por vez na área principal, com histórico de navegação, breadcrumb e Settings voltando para onde o usuário estava; conversa no centro e painéis auxiliares fechados por padrão. Descartadas: B, fila plana por urgência, que troca a árvore e reordena sozinha; C, trilho de três modos, que esconde os itens dos outros modos numa janela larga. A decisão é sobre o modelo, não sobre os componentes nem sobre o visual do wireframe. Ficam para avaliar depois, na tela: da C, decidir apontamentos e rascunhos dentro da conversa; da B, os checks pelo nome e o bloco de fatos da task como painel.

## 2026-09-23 · Brief aprovado

`design/brief.md` é a base de toda proposta. Nele: a árvore com status por cor é o "depende de mim" e a seção `Waiting for you` deixa de existir; a conversa com o agente é a tela central; custo em tokens e dólares fica fora.

## 2026-09-23 · Tempo, contexto e atividade de longe

Aparecem sem abrir o item: há quanto tempo ele espera pelo usuário, há quanto tempo o agente está no turno atual, a porcentagem de contexto e a ação em curso, os dois últimos de forma compacta e só com o agente rodando. Descartado por enquanto: duração total de task, etapa e step, que pede persistir situações encerradas no backend. Razão: é o que o usuário disse que importa, e o custo de backend é pequeno (um campo com a ação em curso no resumo do item).

## 2026-09-23 · Largura contínua, não dois pontos

O monitor de referência é 2560×1080, usado em tela cheia ou pela metade, mas o design funciona num intervalo contínuo de cerca de 1100 px a 2600 px, sem ser ajustado a esses valores. Razão: pedido explícito do usuário de não superajustar ao monitor atual.

## 2026-09-23 · A frente é conduzida fora do MySpec

A trilha de design roda em sessões de Claude Code com os agents de `.claude/agents/`, coordenadas pela skill `design-front`; a implementação de cada tela decidida é uma task no MySpec. Descartado: um modo de design dentro do próprio MySpec. Razão: design é trabalho divergente, com variações e descarte, e o MySpec é feito para trabalho convergente, spec e steps; construir a ferramenta antes de fazer o trabalho uma vez seria adivinhar o que ela precisa.

## 2026-09-23 · A estrutura é decidida antes do visual

As fases seguem a ordem brief, estrutura, fundação visual, telas. Descartado: começar pela tela mais importante e extrair a fundação dela. Razão: o objetivo é repensar o produto com o todo em mente, não repaginar as telas atuais; sem estrutura decidida cada tela sai com uma lógica.
