# Crítica · 01 · Estrutura: o shell e a navegação

Régua: `design/brief.md` (seções 2, 3, 5, 6, 7, 9, 10, 11), `design/decisions.md`, `design/lab/README.md`. Ainda não existem `structure.md`, `principles.md` nem `system/`, então consistência com o system não se aplica. Onde a régua não cobre, está marcado como opinião.

Como foi avaliado: o navegador com a extensão não estava conectado. Os seis HTMLs foram servidos pelo `http.server` e capturados com Chromium headless a 1250×1040 e 2500×1040, incluindo `?open=r1` e `?open=t3`. O teclado (`Ctrl+J`, `Alt+←`, `Ctrl+1..3`, setas, `Esc`) foi julgado pelo código dos handlers, sem ser exercitado. As linhas citadas são de `a.html`. O trecho comum (dados, átomos, conversa, lugares) é o mesmo em `b.html` e `c.html`, 12 linhas acima. Os arquivos `-empty` diferem só no `data-initial` (linha 281 da A, 269 da B e da C).

## Toda a rodada

Estes problemas valem para as três variações e pesam mais que qualquer diferença entre elas, porque a rodada decide a anatomia da linha e do shell.

1. **Os estados da seção 7 não têm lugar.** Nenhum item está em erro (losango), em encerramento (anel), pausado, ocioso ou com erro de sessão sem situação. Os dados (`a.html:300-331`) só têm espera, agente rodando e GitHub, e esses glifos existem só na legenda (`a.html:608-615`). O terceiro problema da seção 10 (pausado, ocioso e erro de sessão com o mesmo cinza) não foi nem testado, e a gravidade no "de longe" (erro > espera > encerramento, seção 5) não pode ser julgada.
2. **Mais de uma situação no mesmo item não aparece em lugar nenhum.** A seção 5 pede isso de longe, e a seção 3 pede "quantas o item tem". A linha tem um único glifo e um único tempo (`a.html:650-652`). Falta decidir o que a linha mostra quando `Implementer` e `Reviewer` esperam ao mesmo tempo, e isso é decisão de estrutura, não de tela.
3. **O clone inexistente não aparece.** Ele está na seção 5 como "visível de longe" e bloqueia a criação de task, o primeiro step e o encerramento. Nenhum mock tem um repositório sem clone, e não se sabe onde ele apareceria (nó do board? linha da task? filtro de repositório?).
4. **Carregando e item que sumiu, os dois do mesmo problema da seção 10, ficaram de fora.** Não há início do app nem primeira leitura de board em curso, e não há item aberto que é arquivado ou apagado. Os dois estão na seção 10 como "não podem se repetir", e a rodada que define o shell é onde eles ganham lugar.
5. **A ação em curso fica ilegível na largura estreita.** A linha usa `i.activity` com o caminho inteiro (`a.html:652`; B `b.html:644`; C `c.html:662`). A 1250 px sobra `Editing internal/ht…`, sem o arquivo, que é a parte útil. O `activityShort` (`Editing ratelimit.go`) existe nos dados (`a.html:305`) e não é usado.
6. **Um botão desabilitado parece habilitado.** Não há regra `.btn:disabled` (`a.html:56-67`). `Publish review` com 4 apontamentos pendentes (`a.html:427`; `c.html:706`, em preto de primário) parece acionável, o que contraria "o que falta para habilitar" (J4, J6).
7. **Fidelidade: o review da PR da task esperando checks mostra a etapa errada.** `t2` tem `stage: 2` (`a.html:310`), e a trilha acende `PR`, mas `features.md` diz que `Waiting for checks` é mostrado como `PR review · waiting for checks`, com o chip em **PR review**. O rótulo da linha (`PR #1284 · Waiting for checks`) também diverge do produto.
8. **Rótulo ambíguo na barra do step.** `Implementing · Agent review` (`a.html:411`) lê como se o step estivesse na passada do revisor, que é um estado real (`Agent review · pass N`). No mock, "Agent review" é o modo de review da task.
9. **Contraste (menor, é wireframe).** `--ink-4` (#9b9b9b) sobre `--bg` (#f5f5f5) dá cerca de 2,6:1 e carrega meta útil (`repo#card`, `checked 40s ago`, `starts after the turn`). Anotar para a fase 3, não bloqueia aqui.

## A · Árvore e caminho de volta

1. **Na largura estreita, o cabeçalho perde `Models` e o modo de review sem outro caminho.** `.hdr .tools .opt` some abaixo de 1500 px (`a.html:260`, botões em `a.html:708`), e o `…` só oferece "delete, archive" (`a.html:709`). São ações transversais da seção 4 e features preservadas pela seção 9, e a 1250 px (a metade do monitor, largura de referência) elas deixam de existir.
2. **O nó recolhido perde a gravidade.** `summary()` conta tudo o que é "you" com o glifo de espera e ignora erro, encerramento e GitHub (`a.html:655-658`). "Recolher nunca esconde o que depende de você" vale para a contagem, mas não para a gravidade que a seção 5 pede.
3. **A faixa recolhida (`«`) carrega status só por forma.** Os blocos têm tipo e glifo, sem texto, sem tempo e sem ação em curso (`a.html:679-682`), e o nome acessível vem só do `title`. Isso contraria a seção 9: "todo ponto tem rótulo em texto, também na árvore por cor". Pesa menos que na C porque é opcional, mas a regra é a mesma.
4. **Voltar a uma etapa numa task em implementação não tem lugar visível.** Só a barra de planejamento tem `Back to PRD…` (`a.html:436`). Na `t1`, a trilha (`a.html:713`) não é clicável e o `…` não menciona a ação. Voltar e descartar etapa são ações transversais (seção 4).
5. **A ordem dentro do nó é a de criação, e só a marca `Ctrl J` diz o que é mais urgente** (`a.html:651`). É aceitável com 5 itens, mas a marca aponta um item só. Com duas esperas no mesmo board, a segunda mais urgente não se distingue da terceira, a não ser pelo tempo em negrito.
6. **O mesmo espaço do tempo carrega dois significados, separados só pelo peso** (negrito = espera por você, normal = turno do agente; `a.html:371-375`). O glifo da linha 2 desfaz a ambiguidade na linha completa, mas não no `title` da faixa. Opinião: um prefixo ou uma forma resolveria melhor que o peso.
7. **Setas na árvore: só ↑↓.** Não há ←→ para recolher e expandir (`a.html:785-791`), e o nó e o item não expõem papel de árvore. A seção 9 preserva "setas na árvore".
8. **`Enter` em Home só funciona com o foco no `body`** (`a.html:783`). Depois de qualquer clique ele não faz nada. É detalhe de mock, mas a Home promete `Enter` (`a.html:729`).
9. **O nó `No board` está descrito no README e não existe no mock** (`tree()`, `a.html:665-678`). Não dá para julgar onde fica uma task livre.
10. **Opinião:** a 2500 px, a área principal tem cerca de 900 px vazios de cada lado da coluna de leitura quando nenhum painel está aberto. A régua não pede preencher, mas vale olhar se a coluna de decisão ou os painéis deveriam ancorar por padrão acima de 1900 px.

O que ela resolve da seção 10: não há `Waiting for you`; o tipo tem forma (`.ty.review` redondo, `.ty.discussion` tracejado); há um caminho de volta de verdade (← →, breadcrumb, Settings voltando para onde estava); Home tem conteúdo; a lateral tem largura contínua (`clamp(272px, 15vw, 360px)`, `a.html:202`) e recolhe; os painéis ficam fechados por padrão; tempo, contexto e ação em curso aparecem de longe; a contagem `4 pending` e a falha de leitura do board ficam na árvore nas duas larguras.

## B · Fila por urgência

1. **Contraria a decisão do usuário registrada na seção 5 e em `decisions.md`** ("a árvore precisa ser excelente, não substituída"). O agrupamento por board e épico vira meta da linha (`b.html:640`, `b.html:645`), e esse meta some na largura estreita (`.qi .l4 { display: none }`, `b.html:263`). A 1250 px não se sabe onde nenhum item vive.
2. **A falha de leitura do board sai da visão de longe.** Ela só aparece dentro do menu `Boards ▾` (`b.html:623`). Nem a linha da `t2` (board `Mobile App`) nem a fila mostram a falha. A seção 5 lista a falha como "visível de longe, sem abrir nada".
3. **Na largura estreita, o que o item pede fica atrás de um clique.** A coluna do item vira uma faixa de 44 px (`b.html:253-265`). No `r1`, os apontamentos e `Publish review` (`b.html:674`) somem, e a conversa diz "Four findings are still open" sem nada à vista para decidir. Na `t1`, `Review myself`, `Open in VS Code` e `Discard step` só existem na coluna (`b.html:665`), porque a barra do step não tem ações (`b.html:689`). É o oposto de "tornar decisão impossível de perder" (seção 6, item 3).
4. **O caminho de volta repete o problema da seção 10 entre itens.** `openItem` troca a base sem histórico (`b.html:615`), então item → item continua zerando o anterior. Só lugar → item tem volta.
5. **A fila reordena sozinha.** Responder o `r1` o move de grupo sob o olho do usuário (`queue()`, `b.html:647-651`). O próprio README admite. Isso quebra a memória espacial, que é o que a árvore dá.
6. **Painéis auxiliares sempre sobrepostos, mesmo a 2500 px.** A `.sheet` (`b.html:247`) cobre parte da coluna de leitura quando sobra largura. As duas colunas fixas gastam a largura no conteúdo da coluna do item, e não no painel que o usuário pediu.
7. **Camadas como `role="dialog"` sem gestão de foco** (`b.html:709`). `Esc` fecha, mas o foco não vai para a camada nem volta para a origem.
8. **Opinião:** a legenda "Needs you" (`b.html:651`) não repete itens, mas funciona como a antiga seção `Waiting for you` com outro nome. O usuário disse que essa seção confunde.

O que ela compra: a ordem por urgência é visível e `Ctrl+J` é literalmente o topo (`b.html:618`, `b.html:654`); os checks pelo nome ficam num lugar estável (`b.html:668-670`); a coluna do item junta, na janela larga, progresso, steps aninhados, modelos e modo de review num lugar só.

## C · Três modos

1. **Na janela larga, o painel mostra só o modo atual, e os outros itens deixam de ser visíveis de longe.** No modo Implement, a discussão rodando (ação em curso, contexto, tempo) e o review que espera há 34 min aparecem só como selo no trilho (`badge()`, `c.html:639-645`). A seção 5 pede "cada item ativo" com o que pede, o tempo, a ação e o contexto, e a decisão do brief é que a árvore mostra tudo. O README admite.
2. **Na largura estreita, que é uma das duas de referência, a árvore vira blocos de duas letras sem texto.** Abaixo de 1500 px o painel some sozinho (`c.html:622`, `c.html:739`). Os blocos usam siglas inventadas (`RL`, `RW`, `OS`, `UP`, `2291`; `c.html:621`, `c.html:651`), com glifo e sem rótulo, tempo, ação em curso ou contexto. Isso contraria a seção 9 (cor ou forma nunca sozinha) e a seção 11 (tempo, contexto e atividade de longe). Na captura a 1250 px nada disso aparece.
3. **A contagem de PRs pendentes some.** `4 pending` só está no `title` do botão Review (`c.html:649`) e no painel do modo Review (`c.html:682`). O selo conta só os reviews que esperam (`1`). A seção 5 pede a contagem de longe, e o dia às vezes começa por ela.
4. **A falha de leitura do board só aparece nos modos Implement e Discuss com o painel aberto** (`c.html:677`, `c.html:665`). No modo Review e em qualquer modo abaixo de 1500 px, ela some.
5. **A 1250 px, o `Card` some do cabeçalho sem outro caminho.** O botão tem a classe `opt` (`c.html:695`), e `.chdr .opt` fica oculto abaixo de 1500 px (`c.html:264`). É uma feature que desaparece na largura estreita.
6. **"Decidir na conversa junta os dois fluxos" não está demonstrado.** O mock mostra só o review de PR de terceiros (`c.html:705-706`). O review da PR da própria task, que hoje é decidido em texto e é a outra metade do problema da seção 10, não aparece. O argumento não pode ser julgado.
7. **O atalho `N` para o próximo apontamento é uma letra solta, sem handler e sem regra de foco** (`c.html:706`; o `keydown` em `c.html:759-770` não o trata). Com o foco no compositor, logo abaixo, ele conflita com a digitação.
8. **O caminho de volta é por modo, não entre itens.** `openItem` e `openPlace` substituem `S.place[mode]` (`c.html:630-631`): board → item → outro item perde o board. A seção 10 fica resolvida pela metade.
9. **O mesmo objeto aparece em dois painéis.** A `t2` está na árvore de Implement e em "Yours" no painel de Review (`c.html:684`). É pequeno, mas é o padrão de repetição que o brief retirou.
10. **A trilha de etapas vira um chip.** A seção 6 lista a "trilha de etapas" entre o que vive colado à conversa. O chip mostra a etapa atual (o que a seção 5 exige), mas esconde o que falta e o que já passou atrás de um clique (`c.html:697`, sobreposição em `c.html:711`). Opinião: a trilha ocupa 36 px e é barata para manter.
11. **O `Ctrl+J` entre modos troca o painel inteiro a cada salto** (`c.html:630`). A lista que o usuário via some e dá lugar à de outro modo. Opinião: isso desorienta mais que a troca de base da B.

O que ela compra: a barra de decisão acima do compositor (`4 findings to decide · 5 of 9 · Next · Publish review`, `c.html:706`) mantém a decisão à vista enquanto a conversa rola. É a melhor resposta da rodada ao item 3 da seção 6. A C também leva a sério os três modos da seção 2, e a Home de cada modo tem conteúdo próprio.

## Comparação

- **Brief:** a A cumpre a decisão da seção 5 sem exceção. A B substitui a árvore. A C a fragmenta por modo e a apaga na largura estreita.
- **De longe a 1250 px:** a A mantém nome, status, tempo, falha do board e `4 pending`. A B perde o board e a falha. A C perde quase tudo (siglas e glifos).
- **Caminho de volta:** só a A resolve item → item (← → e breadcrumb). A B e a C voltam de lugares, mas não entre itens.
- **Decisão (apontamentos e ações do step):** a C é a mais forte (barra acima do compositor). A A é boa na janela larga (coluna), mas perde `Models` e o modo de review na estreita. A B esconde tudo na estreita.
- **Buracos comuns:** estados da seção 7, várias situações no mesmo item, clone inexistente, carregando e item que sumiu. Nenhuma variação os trata.

## Recomendação

**A**, como o designer recomenda, mas não para decidir já. Antes de levar ao usuário, a A precisa de uma revisão que feche os buracos da rodada, porque eles mudam a anatomia da linha que está sendo decidida:

1. uma árvore com um item em erro, um em encerramento, um pausado, um ocioso e uma task com duas situações, com a gravidade também no nó recolhido e na faixa;
2. um repositório sem clone, o início do app carregando e um item aberto que é arquivado;
3. `Models`, o modo de review e o voltar a uma etapa alcançáveis a 1250 px;
4. a ação em curso curta na linha estreita;
5. texto (ou pelo menos o tempo) nos blocos da faixa recolhida.

Discordo de duas das três importações que o designer sugere. **O chip da C no lugar da trilha** troca uma linha de 36 px pela perda do "onde está e o que falta", que a seção 6 põe colado à conversa. **A camada da B para Settings e History** acrescenta um segundo modelo de navegação a uma variação cujo mérito é ter um só, e a A já faz Settings voltar para onde o usuário estava.

**O que vale levar das descartadas:**

- **Da C:** a barra de decisão fixa acima do compositor (`N of M`, próximo, publicar), que cabe na A com os cartões na coluna ou na conversa. Onde os cartões vivem fica para a fase 4, e só depois de desenhar o review da PR da própria task ao lado do review de terceiros. Também da C: a Home própria de cada início (task, review, discussão), que a Home da A já quase tem.
- **Da B:** os checks pelo nome num lugar estável do item e a coluna de fatos da task (repositório, card, épico, modo de review, modelos) como conteúdo de um painel da A, e não como coluna fixa. A ordem por urgência pode servir de ordem da faixa recolhida da A, onde não há board para agrupar.
- **Nada a levar:** a fila plana como lateral e o trilho de modos. Os dois contrariam a decisão da seção 5 sem comprar algo que a A não entregue com a marca `Ctrl J` e o nó `Reviews`.
