# Crítica · 09 · A tela da task

Revisão de 2026-09-24. A régua é `brief.md` §3, §4, §6 e §7, `structure.md` §3 e §9, `principles.md`, `system/tokens.css`, `system/components.md`, `decisions.md`, os fatos de `research/conversation.md` e a pauta de polimento da 08 (`lab/08-visual-final/critique.md` §7). Onde a régua não cobre, o texto diz que é opinião.

**Como foi olhado.**
- As nove cenas de `a.html` e `b.html`, nos dois modos, a 1250 e a 2500 px, num total de 72 capturas.
- Algumas cenas a 1100, 1400, 1500, 1600, 1700, 1800, 1900 e 2100 px, e altas (1250 × 2600), para ler a sessão inteira.
- `?panel=Details` e `?panel=Artifacts` a 1250 e a 2500.
- Uma sonda própria, rodada numa cópia em `/tmp`, sem tocar nos mocks. Ela mede o contraste de todo texto sobre o fundo composto, com a opacidade herdada. Também acha textos cortados sem tooltip em nenhum ancestral e controles sem nome acessível visível. Rodou nas nove cenas × duas variações a 1100, 1250, 1700 e 2500 no claro, e a 1250 no escuro.
- O contraste não textual foi calculado a partir de `tokens.css`.
- Os arquivos de `src/` foram lidos para achar a linha de cada defeito.

Os números de linha abaixo são de `src/` (`core.js`, `core.css`, `a.js`, `a.css`, `b.js`, `b.css`, `content.js`, `components.js`) ou dos HTML gerados.

## 0. Comum às duas

Os defeitos estão no núcleo compartilhado, então valem para A e para B.

1. **`components.html` não renderiza.** Há um `)` a mais em `components.html:2167`, que vem de `src/components.js:95`: o `cell("loading · first read", …)))`. O script para em `SyntaxError`, e a página fica escura e vazia nos dois modos. O entregável "componentes novos em todos os estados" não existe como página. O README afirma que ele "passa no mesmo contraste" (`README.md:224`), e a afirmação é falsa. Os estados abaixo foram julgados numa cópia corrigida em `/tmp` e pelo código.
2. **O topo quebra no meio da faixa de largura.** Ele tem uma única regra de encolhimento, a 1020 px de área principal (`core.css:39`). Acima dela, com **Agent** e **Models** de volta ao cabeçalho, o topo da A transborda entre cerca de 1400 e 1850 px de janela:
   - a 1500, o título vira `Rate limit per …` e a posição vira `Implementation S…`;
   - a 1600, o breadcrumb fica em `Pl`;
   - a 1700 e a 1800, `Platform Roadmap` e `API hardening` se sobrepõem, com letras encavaladas.

   A B tem o mesmo defeito quando o trilho se dobra e a posição volta ao topo: o título corta a 1500, na cena `findings`. Isso contraria `components.md` (Cabeçalho de navegação: "o breadcrumb encolhe antes do título") e o princípio 10. A faixa que o usuário usa, com o monitor pela metade e margem, fica exatamente aí. A auditoria do designer rodou a 1100, 1250, 2500 e 2600 (`README.md:219`) e não passou por essa faixa.
3. **Botões de ícone sem nome acessível a 1250.** A `@container convo (max-width: 1000px)` esconde `.lbl-long` com `display:none` (`a.css:43`, `b.css:66`). Com isso, **Open in VS Code**, **Milestones** e **Open PR** do cabeçalho do capítulo ou do lugar ficam só com o SVG `aria-hidden`, sem `aria-label`. Os lugares são `a.js:87-97` e `b.js:97,100`. Esses botões falham WCAG 4.1.2 na largura de referência. `Open PR` (`a.js:97`, `b.js:100`) e o **Open in VS Code** do step bloqueado (`a.js:91`) também não têm `data-tip`: são ícones mudos.
4. **Um texto que corta sem tooltip.** A sonda achou, além do que o README declara:
   - o progresso da barra do pedido, `1 of 4…`, na cena `findings` da A, em toda largura (`core.js:291`, `.adet`). A barra do pedido deveria "quebrar em duas linhas antes de esconder" (`components.md`, Barra do pedido), e o progresso é o que ela diz;
   - o resumo do subagente, `44 actions · Read 21 · Searched 14 · GitHub 9`, cortado seco, sem reticências (`core.js:246`; `core.css:283-286` não trata `.roll`), na B a 1100 e a 1250 e no espécime (`Rea(`);
   - `Removes the worktree and the branch, then updates …` na barra de encerramento da B a 1250.
5. **O fio âmbar da pergunta em texto é quase invisível.** O fio (`core.css:293`) usa `--state-wait-line`, que dá 1,52:1 sobre `--surface-1` no claro e 2,09:1 no escuro. É o único sinal, dentro da conversa, de qual parágrafo é a pergunta, e fica abaixo dos 3:1 de WCAG 1.4.11. A barra `Reply · PRD` carrega o rótulo, então a cor não é o único portador do estado, mas o fio não cumpre a função que o README dá a ele (`README.md:86`).
6. **O teclado dos pedidos não está no mock.** Nenhum dos atalhos que o README usa para o requisito 3 está ligado:
   - `1`–`9` no cartão;
   - `A` e `D` num apontamento;
   - `Alt+↓`.

   Os únicos atalhos são `[` e `]` na A (`a.js:209-216`) e ↑↓ no trilho da B (`b.js:193-196`). O requisito 3 fica demonstrado só pelas teclas desenhadas nos botões.
7. **Estados de `features.md` e `brief.md` §7 que nenhuma cena mostra.** Nenhuma cena mostra:
   - o rascunho da PR esperando o OK, editável, com **Approve draft** e **Discard draft**. É um lugar de decisão, e a rodada decide onde a decisão mora sem mostrá-lo;
   - `plan_invalid`, com os problemas acima do compositor;
   - a revisita, com **Back to <etapa>…**, `ready_to_continue` e **Continue**. Na A os capítulos dobrados só abrem, e na B os nós do trilho só navegam, então a ação de voltar sumiu da representação do progresso sem que se mostre onde ela foi;
   - a sessão pausada, e o compositor dizendo que enviar retoma;
   - `Context compacted` e a resposta `Interrupted`;
   - o step que passou ao usuário depois de três rodadas;
   - `step_empty`, `worktree_unreadable`, `pr_closed` e `pr_trouble`;
   - uma task One-Shot, com cinco etapas, cinco pontos na posição e um trilho mais curto;
   - a conversa carregando.

   A amostra é de nove cenas e não precisa cobrir tudo. Mas o rascunho da PR e a revisita tocam diretamente as duas perguntas da rodada: onde se decide e como é o progresso.
8. **As duas perguntas de `research/conversation.md` §7 são do usuário e foram respondidas pelo designer.** Uma é o que o usuário procura num grupo de ações. A outra é se lê inteiras as mensagens longas do produto. As duas variações assumem uma resposta: o grupo sem saída, e a mensagem do produto recolhida num marco. Pode ser a resposta certa, mas é uma decisão do usuário, e está embutida sem ser perguntada.
9. **Alguns rótulos da resposta rápida não existem no produto.** `a · Plans table, cached 60 s` e `b · Config, with a release` (`content.js:211`) são paráfrases, e o README diz que as pastilhas vêm de uma "heurística do frontend sobre `a)`, `1.`" (`README.md:213`). Com o texto real da opção, a pastilha seria `a · Yes. Read the limits from the plans table and cache them f…`. O mock mostra um dado que o produto não consegue produzir.
10. **Semântica.**
    - Os tempos do loop são `role="list"` com `<button>` filhos, sem `listitem` (`a.js:68`, `a.js:76`).
    - O filtro de vozes usa `role="radio"` com `aria-selected`, que não vale num radio (`a.js:83-85`). O espécime nem tem `aria-checked` (`components.js:52`).
    - Os tempos futuros e os marcos futuros são `<button disabled>` sem a borda tracejada que `components.md` exige de todo desabilitado (`core.css:246`; `a.js:120`). Como `disabled`, eles também saem da ordem de Tab.

## A · Conversa com marcos

Em ordem de gravidade.

1. **O destinatário não segue a regra que o próprio README escreve, nem a tela.**
   - O README diz que o padrão é "quem pediu por último" (`README.md:59`). Na cena `ask`, o implementador pediu às 14:52 e o revisor às 14:38, e o compositor mostra `To reviewer` (`content.js:218`).
   - O filtro de vozes em `Implementer` esconde o revisor da tela (`a.js:175`) e deixa o chip em `To reviewer`: o usuário lê um agente e escreve ao outro.
   - Na etapa de PR, o chip oferece "the PR reviewer, or the PR conversation" (`content.js:237`). A conversa da PR já acabou quando a PR abriu (`conversation.md` §3, PR), então o menu oferece uma sessão encerrada.

   Mandar ao implementador o que era para o revisor faz o agente mudar código. É a armadilha que o README reconhece como risco (`README.md:190`), e o mock a produz nas próprias cenas.
2. **O filtro de vozes esconde os pedidos.** Com o filtro em `Implementer`, a raia do revisor fica `hidden`, e com ela o cartão da pergunta. A barra do pedido continua com **Show** para esse cartão, e o `scrollIntoView` (`core.js:464`) não chega a um elemento escondido. Isso quebra o requisito 3 ("impossível de perder") por um controle da própria tela.
3. **O topo transborda entre cerca de 1400 e 1850 px de janela**, com o título cortado e o breadcrumb sobreposto. Ver 0.2. Na A é permanente nessa faixa, porque a posição está sempre no topo.
4. **"Uma faixa só" é, a 1250, três faixas.** O cabeçalho de 48 px leva o título e a posição. O cabeçalho do capítulo, que gruda no alto, tem duas linhas: `Step 3 of 7 · título · ferramentas`, e depois tempos do loop e filtro de vozes. Somam cerca de 123 px antes da conversa, contra as quatro faixas da 08 (`README.md:52`). É melhor que a 08, mas é uma reorganização, não uma faixa. A 2500 continuam três eixos, a pauta 1 da 08 §7:
   - título e posição na borda esquerda, a cerca de 500 px da coluna;
   - capítulo e conversa na medida;
   - ferramentas na borda direita e a margem de marcos à direita da coluna.
5. **O cartão de revisão Manual e o cartão de apontamentos contrariam a regra da barra quieta.** `components.md` (Barra do pedido) e o princípio 7 dizem: com o cartão na tela, a barra é quieta; a barra tingida é para os pedidos sem cartão, e o stage e os apontamentos estão na lista dos tingidos. As cenas `manual` e `findings` mostram as duas coisas ao mesmo tempo: um cartão com a faixa âmbar e a barra tingida com a ação. O progresso aparece duas vezes: `5 of 7 files staged · 71%` no cartão e na barra, `1 of 4 decided` no cabeçalho do cartão e na barra (`content.js:225`, `:236`). Se o modelo for aceito, a regra do system muda, e a mudança tem de ser escrita, não herdada da cena.
6. **O âmbar se multiplica na cena `ask`.** Numa tela de 2500 há cerca de onze marcas âmbar:
   - dois cartões, cada um com anel e faixa;
   - dois glifos no filtro de vozes;
   - o tempo `Review 2 · asks you`;
   - dois pedidos na margem;
   - dois glifos e dois chips na barra;
   - a linha da árvore.

   Cada marca é sinal e nenhuma é decoração, então o princípio 1 não é violado ao pé da letra. Mas é a mesma redundância que a 08 §7 (itens 2 e 3) pediu para cortar. É opinião, apoiada nessa pauta.
7. **Na cena `ask` a 1250 × 1000, a pergunta do revisor não está na vista.** Ela abre no fim, e o cabeçalho que gruda cobre o topo do cartão: vê-se só as opções `2`, `3` e `Other…`, sem o enunciado. O **Show** da barra resolve, mas "duas perguntas ao mesmo tempo estão as duas na tela" (`README.md:121`) vale só a 2500.
8. **Três representações do progresso a 2500.** São os pontos da posição, a lista `Earlier in this task` no alto da conversa e a margem de marcos. Na margem, os steps feitos aparecem pelo SHA (`Step 1 · a41c9e2`, `a.js:130`) e os futuros pelo nome, cortados sem tooltip (`a.js:120`, sem `data-tip`; a sonda acusa a 1700 e a 2500). Um SHA não é o que o usuário reconhece. É opinião.
9. **O tempo `Review 1 · 2` é ambíguo.** O `· 2` quer dizer "2 findings" (`a.js:62`), e abaixo de 1000 px de conversa o complemento some (`a.css:43`). O estado futuro também presume o caminho limpo (`Review 2 › Commit`) quando o laço pode ir até `Round 3`.
10. **A posição fica só com os pontos abaixo de 900 px de área principal.** Na janela de 1100 px, `.pos .stn` some (`core.css:300`), e a posição vira `●●●▬○○○`, sem palavra. O princípio 5 pede glifo e rótulo, e o rótulo fica só no tooltip e no nome acessível.
11. **O mesmo controle duas vezes na PR.** **Refresh PR** fica no cabeçalho do capítulo (`a.js:97`) e **Refresh** no bloco dos checks. O ícone de abrir a PR fica no cabeçalho, e **Open PR** no marco `Opened #1284`. São ferramentas, não ações de situação, então o princípio 7 não se aplica ao pé da letra. É ruído.
12. **O custo do stream contínuo** é real e o README o declara (`README.md:212`). Todas as conversas da task são carregadas, com os eventos de todas as sessões e virtualização acima de mil entradas. Não há cena de carregamento de capítulo nem de erro ao carregar, fora do espécime.

## B · Workflow com conversas

Em ordem de gravidade.

1. **A metade do monitor é a largura em que a B perde a espinha.**
   - A 1250 sem coluna, a conversa tem cerca de 650 px, e os rótulos que dizem de quem é a vez cortam: `Reviewer · pass 2 · Session e…`, `Implementer · waits for the …`, `4 Retry-After and rate li…`. O cabeçalho do lugar corta em `Step 3 · Token buc…` e perde o tooltip (a sonda acusa `.place-h` em toda largura, até a 2500).
   - Com a coluna de decisão, a 1250 e a 1100, o trilho se dobra em glifos e números. PRD, Tech spec e Plan viram três vistos sem palavra, e a conversa cai para 440 a 555 px.
   - A coluna de 268 a 300 px quebra caminhos mono no meio (`bucket.g / o:31`, `ratel / imit.go:58`).
   - A barra do pedido vai a três linhas.

   É o requisito 8 falhando justamente na largura de referência do usuário.
2. **O trilho dobrado não tem nome acessível.** `b.css:47` esconde `.lb`, `.r` e `.l2` com `display:none`, e o nó fica só com o glifo e o número, com o nome em `data-tip` (`b.js:38`). `data-tip` não é nome acessível. A sonda acusa nove nós sem nome na cena `findings` a 1250. Isso falha WCAG 4.1.2 e o princípio 5.
3. **O trilho é uma segunda lateral.** O `--surface-0` do trilho (`b.css:6`) fica a 1,05:1 do `--surface-sidebar` no claro e a 1,02:1 no escuro. As duas listas verticais se leem como uma lateral larga, e o princípio 6 ("regiões lado a lado se separam por tom") não se sustenta. A 2500, o trilho fica colado à árvore e a conversa fica centrada no que sobra, com cerca de 430 px vazios entre o trilho e a coluna: o trilho fica longe do que ele comanda, e voltam os três eixos da 08 §7.
4. **O trilho repete o painel `Artifacts`.** Com `?panel=Artifacts`, a lista `Steps · 7`, com modelo e modo de cada step e os relatórios sob cada um, aparece duas vezes lado a lado. O trilho é essa lista com estado. É a forma atual reorganizada, e não um modelo novo: a trilha de chips virou vertical, e as abas viraram lugares. O usuário disse que o topo e o progresso "seguiam o padrão atual" (`decisions.md`, 2026-09-24), e a B responde mudando o eixo da mesma coisa.
5. **A conversa entre os agentes some.** O relatório entregue ao implementador e a resposta dele ao revisor ficam em lugares diferentes, e a sequência implementa › revisa › rodada só se monta trocando de lugar. O requisito 2 fica atendido, com cada voz no seu lugar. A leitura de "o que aconteceu enquanto eu estava fora" (brief §2) fica mais difícil. Isso fica declarado no próprio README (`README.md:120`).
6. **O topo corta quando o trilho se dobra.** Ver 0.2: a 1500, na cena `findings`, o título vira `Rate limit per…`.
7. **`Review again` no cabeçalho da PR antes da primeira passada.** Na cena `checks`, `b.js:100` põe **Review again** sempre que o lugar é `prr`. Numa passada que espera os checks, pedir outra não faz sentido (`features.md:569`, `:571`). A A não mostra o botão nessa cena.
8. **A coluna de decisão na B é a coluna de `structure.md` §3, e a regra de largura dela quebra a medida.** Com a coluna, a conversa fica abaixo dos 680 px que a própria B usa para dobrar o trilho. `README.md:126` admite o caso.

## Os oito requisitos (`brief.md` §6)

| # | A | B |
|---|---|---|
| 1. De quem é a vez, de um olhar | Atende: a barra, o compositor com **Stop** e o tempo do turno, a volta ao fim com a ação em curso e os tempos do loop. O filtro de vozes pode esconder um pedido (A.2) | Atende melhor de longe: cada lugar do trilho tem o seu glifo, e a barra aponta a outra conversa, como `structure.md` pede. A 1250 os rótulos do trilho cortam (B.1) |
| 2. Quem fala | Atende melhor: avatar cheio e anel, o fio da voz do revisor, `You → Implementer` e a troca como marco. A diferença entre os dois avatares de 24 px é sutil de longe (opinião) | Atende pelo lugar. A conversa entre os dois some (B.5) |
| 3. Pergunta, permissão e decisão impossíveis de perder, pelo teclado | Parcial: os dois pedidos ficam na barra. O filtro esconde cartões (A.2), a 1250 o enunciado sai da vista (A.7), e o teclado não está ligado (0.6) | Parcial: a segunda pergunta fica a um clique, com o glifo no trilho. O teclado não está ligado (0.6) |
| 4. Atividade sem afogar | Atende: rótulo pela descrição, resumo por tipo, `Show N earlier`, capítulos dobrados. O resumo do subagente corta (0.4) | Atende: os mesmos grupos, e cada lugar é curto |
| 5. Documentos sem painel | Atende: os marcos abrem no lugar | Atende, e o trilho lista os relatórios |
| 6. Marcos legíveis | Atende, e é o modelo. Os marcos de decisão sua são um ganho | Atende pelos nós do trilho. Dentro da conversa, os mesmos marcos |
| 7. A mesma conversa em task, review e discussão | Atende, com a condição de que o destinatário e o filtro não vazem para o review e a discussão, onde há uma sessão só | Atende: sem trilho, fica igual à A sem capítulos |
| 8. Legível de 1100 a 2600 | Parcial: uma coluna em toda largura, mas o topo quebra entre 1400 e 1850 (0.2) | Falha a 1100 e a 1250 com decisão, e corta rótulos a 1250 sem decisão (B.1). Também quebra o topo com o trilho dobrado |

## As perguntas da rodada

**O topo e o progresso.** Nenhuma das duas repete a trilha de chips da 08.
- A A é a mais nova. Os tempos do loop dizem onde está o laço entre os dois agentes, com o teto de três rodadas, o que nem a trilha atual nem a B dizem numa linha. A posição em pontos é compacta e não é amadora. O defeito é de execução: o topo transborda entre 1400 e 1850 e soma três faixas a 1250.
- A B é a mais legível de longe e a mais próxima do padrão atual (B.4).

**Os dois agentes.** Na A, a experiência é compreensível: vozes numa linha do tempo, a troca como marco com o que foi entregue (`Review 1 · 2 findings · round 1 of 3`) e o revisor recuado sob um fio. O que a atrapalha são os dois controles que a acompanham: o filtro de vozes (A.2) e o destinatário (A.1). Na B, cada agente é um lugar. É claro, mas é o modelo das abas de hoje.

**Os apontamentos na conversa, com a barra de decisão.** Funcionam melhor que a coluna na faixa de 1100 a 1250:
- não há coluna de 300 px;
- os caminhos não quebram;
- é o mesmo componente da pergunta e da permissão.

O custo:
- a regra quieta/tingida da barra muda (A.5), e o progresso fica duplicado;
- o cartão com quatro apontamentos ocupa a vista inteira a 1250, e o centro de review tem nove;
- a decisão rola para cima assim que a conversa continua;
- `structure.md` §3 (a coluna abre sozinha a cada passada, mostrar e esconder) precisa ser reescrita;
- é uma mudança de feature: apontamentos estruturados e **Apply approved** na PR da task, com custo médio de backend (`README.md:205`).

Pelo brief §10, a mudança é defensável. Pelo brief §9 ("features novas ficam fora da frente"), ela é do usuário, e precisa entrar em `decisions.md` como decisão dele, não como efeito colateral da variação escolhida. A B também faz a mesma mudança, só que na coluna.

**O destinatário `To reviewer`.** Como está desenhado, é uma armadilha (A.1). O padrão contradiz a regra escrita, é independente do filtro e oferece uma sessão encerrada. O conceito só se sustenta se o destinatário for derivado, e nunca uma terceira coisa a vigiar. A alternativa que o próprio README registra (`README.md:239`) é mais segura: responder pelo cartão, e o compositor sem chip.

**Os achados de `conversation.md`.**
- Rótulo pelo `description`: aplicado nas duas, com duração e código de saída, que pedem backend pequeno.
- Subagente aninhado: aplicado. O resumo corta (0.4).
- Mensagem do produto como marco: aplicado, com o destinatário e o conteúdo em Markdown a um clique. A pergunta 2 de §7 não foi feita ao usuário (0.8).
- Retry por sessão: aplicado (`Retry reviewer`). A B leva do implementador ao revisor.
- Resposta rápida: aplicada, com rótulos que a heurística não produz (0.9).
- A instrução inicial (`Started with steps/03-token-bucket.md`): aplicada.

**Fidelidade.** Nada de `features.md` foi removido de forma explícita. **Pause**, **Models**, **Review mode**, os painéis, **Review myself**, **Discard step**, a fila com **Remove**, os checks pelo nome, **Approve** com o que falta, `Merged by` e **Close task** estão presentes. Faltam na amostra os estados listados em 0.7, e o rascunho da PR e a revisita pesam na decisão.

**Tokens, componentes e contraste.**
- `tokens.css` está embutido byte a byte nas três páginas.
- Não há cor, duração ou tamanho soltos. Os únicos `px` estão em `@container`, onde token não entra.
- Contraste de texto: 4,5:1 ou mais em todas as combinações medidas, nos dois modos, com a opacidade herdada.
- Contraste não textual:
  - `--line-3` sobre `--surface-1` dá 3,45 e 3,69, e sobre `--surface-0` dá 3,14 e 3,90;
  - o fio âmbar da pergunta dá 1,52 e 2,09 (0.5);
  - o trilho contra a lateral dá 1,05 e 1,02 de tom (B.3).
- Os componentes novos têm os sete estados no código do espécime, com estas ressalvas:
  - o espécime não abre (0.1);
  - a forma "a outra conversa também espera" da barra do pedido, listada em `README.md:171`, não está no espécime (`components.js:120-123`);
  - "disabled · not delivered" da mensagem do produto é um erro rotulado como desabilitado (`components.js:26`);
  - os estados futuros desabilitados não têm o tracejado (0.10).

## Comparação

- **Topo e progresso:** a A inventa, com os tempos do loop, a posição e os capítulos, e quebra na execução do topo. A B é clara e herda o padrão atual na vertical.
- **Os dois agentes:** a A mostra o diálogo entre eles. A B separa os dois em lugares e perde a sequência.
- **Largura:** a A é uma coluna que serve de 1100 a 2600, com o topo a consertar. A B falha na metade do monitor sempre que há decisão ou painel.
- **Risco novo:** a A traz dois controles que podem esconder um pedido ou errar o destinatário. A B não traz controle novo nenhum.
- **Custo:** a A pede o stream contínuo, médio no frontend. A B pede o início de cada etapa e é barata.

## Recomendação

**A**, com condições, em acordo com o designer no modelo e em desacordo em dois pontos.
- **Sem o destinatário no compositor.** O compositor escreve para quem o cartão ou a voz em foco determina, ou para quem pediu por último, sem chip, como o README já prevê. É a condição que decide a recomendação.
- **O filtro de vozes nunca esconde um pedido.** Um cartão de pergunta, de permissão ou de decisão fica visível em qualquer filtro, ou o filtro sai.

Antes de mostrar ao usuário:
1. `components.html` abre (0.1).
2. O topo não transborda de 1100 a 2600, com o título cedendo por último. Isso inclui a sobreposição do breadcrumb a 1700 (0.2), verificada a cada 100 px.
3. Os botões de ícone têm nome acessível e tooltip (0.3, B.2).
4. O progresso da barra não corta sem tooltip (0.4).
5. O padrão do destinatário, se o chip ficar, obedece à regra escrita (A.1).

Para o usuário decidir junto com o modelo, uma pergunta de cada vez:
- os apontamentos da PR da task viram cartões com **Apply approved**, uma mudança de feature;
- as duas perguntas de `conversation.md` §7 (0.8).

**O que levar da B:**
- a barra do pedido que fala da conversa em foco e aponta a outra com **Go to…**, que é o que `structure.md` §3 diz e é mais simples que a lista de dois pedidos;
- os fatos de cada step de longe: o commit, as passadas, o modelo do que falta;
- o modelo do que vem, que a margem de marcos da A ainda não mostra;
- o lugar `PR review` vazio antes da primeira passada, com os checks e a frase de quando a conversa começa. É o melhor vazio da rodada.

**Não está pronto** para o usuário decidir o modelo: o espécime não abre, e o topo da variação recomendada quebra no meio da faixa de largura. Com os cinco itens acima corrigidos, está.
