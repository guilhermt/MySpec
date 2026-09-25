# Crítica · 04 · Direção visual

Régua: `design/brief.md` (§1, §2, §5, §6, §9, §10), `design/structure.md`, `design/decisions.md`, `design/research/references.md` (§3, os princípios do §5 e os eixos do §6), `design/lab/README.md` e o `README.md` da rodada. Ainda não existem `principles.md` nem `system/`. Onde a régua não cobre, o texto diz que é opinião.

Como foi avaliado: a pasta foi servida pelo `http.server` e cada direção foi capturada com Chromium headless a 1250 e 2500 px de largura e 1040 de altura, em `?theme=light` e `?theme=dark`, com a aba do implementador e com `?tab=reviewer`. O `?specimen` de cada uma foi capturado inteiro. O contraste foi medido duas vezes. A primeira leitura foi a do próprio espécime, conferida por amostragem. A segunda foi uma conversão própria de OKLCH para sRGB, sobre os tokens dos arquivos, dos pares que o espécime não mede. As capturas são do Chromium no Linux, com FreeType, o que se aproxima mais do WebKitGTK do app do que um Mac, mas não o substitui.

As três direções compartilham o CSS de estrutura e só trocam os tokens e um bloco de direção. Por isso os defeitos do CSS compartilhado aparecem nas três e ficam numa seção própria, com a linha de `a.html`. Nos outros dois arquivos, a mesma regra está uma ou duas linhas abaixo.

## 0. O que é igual nas três e está errado

Em ordem de gravidade.

1. **O âmbar de "espera por você" marca uma ação que só está rodando.** `.acts li.cur .s { color: var(--wait) }` (`a.html:459`) pinta de âmbar tanto `waits for your permission` quanto `running · 3m 20s`, porque as duas linhas recebem a classe `cur`. O espécime mostra o `running` âmbar nas três direções. É o mesmo erro do app atual, em que a marca e o "trabalhando" eram uma cor só (`references.md` §1), só que agora com o âmbar. Fere o princípio 3 ("cor é função") e, em B, desmente a própria direção, em que "trabalhando" é azul.
2. **Os glifos de estado têm bordas em fração de pixel.** `.st-close` tem `glyph * .26` (2,34 px), `.st-gh` tem `* .16` (1,44 px), `.st-idle` tem `* .14` (1,26 px) e `.st-run` tem `* .2` (1,8 px) (`a.html:254-257`). `.tw-close` tem `bw * 1.5` (`a.html:277`). O próprio arquivo diz que hairlines ficam em px porque rem fracionário borra no WebKitGTK (`a.html:28`), e o brief §9 proíbe o meio pixel. São justamente os glifos que carregam o estado por forma, na árvore e em 9 ou 10 px.
3. **Pares que o espécime não mede ficam abaixo do mínimo.** O README diz que "glifos, anéis e foco [estão] acima de 3:1". Nos pares que ele não lista:
   - O `○` das etapas futuras e os `›` usam `--deco` (`a.html:373`, `375`), a 2,47–2,63:1 no claro, contra 3:1. Abaixo de 1240 px de área principal, que é sempre o caso a 1250 px de janela, esse círculo é tudo o que resta de `PR › PR review › Closing` (`a.html:384`).
   - O chip redondo de espera (`--wait-solid` sobre a lateral) está a 1,45–1,53:1 no claro. O texto dentro dele passa (8:1). Mas a forma do chip é um dos portadores de gravidade (`structure.md` §2, "chip redondo cheio" contra "contornado"), e ela quase some no tema claro.
   - A borda das caixas de texto e do compositor (`--line-strong` sobre `--bg-input`) está a 1,75–2,08:1. Isso é comum no gênero e o placeholder identifica a caixa. Fica como menor.
4. **Faltam no espécime os estados mais graves.** Não há a barra do pedido de erro, com o trilho, nem o bloco de erro da conversa, que `structure.md` §3 exige com o trilho. O erro só aparece na linha da árvore. Também faltam:
   - os estados da opção do cartão: foco, escolhida e respondida;
   - o seletor de conversa: foco e a outra aba com erro;
   - o cartão de permissão depois da resposta;
   - `New messages`, a mensagem na fila com **Remove**, `Thinking…` e `Retrying…`;
   - os marcadores de interrompido e de contexto compactado.

   O **loading** do chip e da linha reusa o visual do **disabled** (`is-disabled`), então os dois estados ficam iguais.
5. **Há dois primários cheios na tela.** Com um cartão esperando, **Allow** (ou nenhuma opção, na pergunta) e **Send** são os dois blocos mais pesados, um acima do outro (`PERMISSION` em `a.html:768`, `.btn primary sm` no compositor). A barra do pedido diz para onde o olho deve ir, e o **Send** cheio puxa para o lugar errado. Opinião: o **Send** deveria ficar neutro enquanto a caixa está vazia.
6. **Uma ação e um metadado têm o mesmo estilo.** **Change path**, que é o que `Enter` faz no aviso de clone, é um `.tag` igual ao `Bash` do cartão de permissão (`a.html:249` e o `nrow` da árvore). Uma ação parece um rótulo.
7. **Sobram valores soltos onde existe token.** São eles:
   - `.acts li .k { width: 3.25rem }` (`a.html:454`);
   - `.opt .kn`, com `1.25rem` e `margin-top: 0.0625rem` (`a.html:475`);
   - `.cbox textarea { min-height: 3.25rem }` (`a.html:496`);
   - `.prose ul { padding-left: 1.25em }` (`a.html:421`);
   - o padding do código em linha, `0.05em 0.3em` (`a.html:425`);
   - `scale(.82)`, `scale(.78)` e `translate(1px, -1px)` nos glifos (`a.html:252`, `259`, `260`);
   - o `style="margin:0;min-width:0"` inline dos cartões (`a.html:768`, `775`).

   São poucos, mas vão virar a "escala fora da escala" que o brief §10 condena se chegarem ao system assim.
8. **O `-webkit-font-smoothing: antialiased` não faz nada no Linux** (`a.html:164`). Ele não quebra nada, mas é um ajuste de Mac num produto que roda no WebKitGTK (`references.md` §3). Deve sair, para ninguém calibrar pesos achando que ele age.

## 1. A · Instrumento

Em ordem de gravidade.

1. **A barra do pedido não é impossível de perder.** Ela fica sobre `--bg-ask`, a 1,06:1 do fundo da conversa no claro e a 1,04:1 no escuro (`a.html:62`, `149`). Uma linha de 1 px a separa. O âmbar está só no glifo de 9 px e no chip `4m`. Nas capturas a 1250 px, na aba do revisor, ela lê como uma linha de status igual às do cromo, e o cartão logo acima pesa muito mais. É o requisito 3 do brief §6 e a razão de ser da barra (`structure.md` §3).
2. **A fala do agente fica longa demais para ler.** Com 15 px na medida de 800 px, a linha da fala chega a cerca de 109 caracteres ("Tests and lint pass, … the middleware checks" numa linha só, na captura do revisor a 1250 px). A medida é da estrutura, mas o tamanho é desta direção. É a direção que pior serve à "leitura longa" do brief §6.
3. **O texto de 11 px vive onde a atenção é pedida.** `--fs-micro` (11 px) está no chip de espera, na linha 3 em mono (`Running go test …`), no `kbd` de `Ctrl J`, nos alvos das ações e no meta da linha. Em Plex Mono, 11 px é o traço mais fino da rodada. É o que o brief §5 pede "de longe", e é o maior risco tipográfico de A no WebKitGTK.
4. **O agente trabalhando é o glifo mais fraco da árvore.** O spinner é um arco `--ink-2` sobre um anel `--line-strong`, de 9 px (`a.html:255`, `--work: var(--ink-2)`). Parado, ele é quase invisível ao lado dos discos âmbar. O movimento carrega o estado, mas `prefers-reduced-motion` tira o movimento e deixa um anel cinza. O brief pede "se o agente está trabalhando" de longe.
5. **A seleção tem três vocabulários.** A aba selecionada leva um sublinhado azul (`a.html:140`). A linha selecionada da árvore leva um anel cinza e negrito (`a.html` bloco A, `.it.sel .nm`). O chip ativo leva um fundo. "Um azul só onde você age" (README) vira um azul também em "qual conversa está aberta". Isso é seleção, não ação.
6. **A referência do item parece um botão.** `acme/api#412` tem borda e raio no título (`.ih-ref`, bloco A), e nada ali é clicável.
7. **A densidade de linhas chega ao limite.** O grupo de ações, o bloco de código, o cartão (com a faixa de cabeçalho e o `pre.cmd` bordados dentro) e o compositor são quatro caixas com hairline, uma sob a outra. Aguenta nas duas larguras. Mas é o eixo 3 no polo que `references.md` §6 avisa que "vira grade de linhas" com painéis abertos.

O que A faz melhor que as outras:
- o cartão bloqueante com a faixa âmbar no cabeçalho (`.card .hd`), o sinal mais claro de "isto espera por você" dentro da conversa;
- o anel de 1 px na linha selecionada, que a separa do hover sem cor.

## 2. B · Leitura

Em ordem de gravidade.

1. **A linha aberta na árvore se distingue por um tom a 1,13:1 e por um negrito que já significa outra coisa.** `--sel-mark: none` (`b.html:139`) tira o anel. Sobra o nome em negrito (`b.html:568`), mas o negrito é a marca de "espera por você" (`structure.md` §2, Destaque). Na linha aberta, que também espera, ele não acrescenta nada, e numa linha aberta sem situação ele diz a coisa errada. O fundo selecionado fica a 1,13:1 da lateral no claro e a 1,29:1 no escuro. O hover fica a 1,06:1 e 1,21:1, a um degrau de distância. No espécime (States, "active · selected" contra "hover"), as duas células são quase iguais. É um estado carregado por uma diferença de tom abaixo de 3:1 (WCAG 1.4.11). É também o "onde estou" da árvore, que `structure.md` §1 marca com `aria-current`. A tem o mesmo negrito, mas o anel de 1 px carrega a seleção.
2. **O chip desabilitado vira texto solto.** `--chip-border: transparent` (`b.html:136`) anula a borda tracejada de `.chip:disabled` (`b.html:247`), que só troca o estilo, não a cor. No espécime, `Assignee` desabilitado é uma palavra cinza sem contorno. Isso contraria "um botão desabilitado… tem borda tracejada" (`structure.md` §3).
3. **Os links são iguais ao texto.** `--link: var(--ink)` (`b.html:132`), e só o breadcrumb ganha sublinhado, e só no hover. Um link no markdown do agente, que o brief §6 lista, fica indistinguível do texto em volta, o que fere WCAG 1.4.1. A direção precisa fixar o sublinhado permanente como o portador do link.
4. **Os nós de board em versalete parecem rótulos de seção, não lugares.** `--node-case: uppercase`, 12 px, `--ink-3` (`b.html:46`, bloco B `.node:not(.epic)`) fazem de `PLATFORM ROADMAP` um cabeçalho estático. Pela estrutura, o título do nó abre a visão do board (`structure.md` §2). Opinião: a affordance se perde.
5. **O realce de código pede um peso que não foi carregado.** `--code-kw-w: 600` (`b.html:44`), mas a fonte carrega Source Code Pro só em 400 e 500 (`b.html:16`). As palavras-chave saem em negrito sintético, visível na captura do revisor (`if`, `return`, `nil`). O WebKitGTK também sintetiza, com outro desenho.
6. **O título do item não manda.** `--fs-title` é igual a `--fs-read` (17 px), então o nome da task no topo tem o mesmo corpo da fala do agente logo abaixo. Só o peso o separa. C (18 contra 16) e A (16 contra 15) mantêm a ordem.
7. **A árvore perde densidade.** `--node-gap` de 0,875 rem, controles de 30 px e UI de 14 px deixam a última linha (`Terraform 1.9 upgrade`) cortada a 1040 px de altura, onde A e C mostram a árvore inteira e o rodapé. É a árvore que "precisa ser excelente, não substituída" (brief §5). O custo é pequeno, mas é o único lugar em que B perde para as outras.
8. **O cartão bloqueante é identificado pela elevação, não pelo estado.** No claro, a sombra o separa bem. No escuro, `--bg-raised` fica a 1,10:1 da conversa, com um anel de 7 % de branco. O âmbar está só no rótulo `PERMISSION` e no disco. Opinião: a faixa âmbar de A no cabeçalho do cartão resolveria isso sem gastar outra cor.
9. **A serif é um risco, e é menor do que o README pinta.** Na captura do Linux, com FreeType, Source Serif 4 a 17 px, com eixo óptico, rende limpa nos dois temas. O risco real no WebKitGTK é menor que o dos 11 px de A e C. A linha da fala fica perto de 90 caracteres, ainda longa, mas a mais legível das três.

O que B faz melhor que as outras:
- a barra do pedido com o tom da situação (`--ask-bg: var(--wait-bg)`, `b.html:151`), a única das três que o olho acha sem procurar;
- a cor como sinal: o azul do "trabalhando" é o único spinner da rodada que se vê parado;
- os dois registros de texto (sans para o cromo, serif para a fala), que separam quem fala sem caixa nem cor;
- a pergunta em serif de 19 px, que lê como pergunta.

## 3. C · Assinatura

Em ordem de gravidade.

1. **A íris é decoração, e está em toda parte.** Ela está na marca, na linha selecionada da árvore (nome e fundo), no chip da etapa atual, nos avatares dos agentes, em `You`, no balão do usuário, em **Allow**, em **Send** e no foco (`c.html:132`, `140`, `142`, `557-559`). Na lateral, a linha selecionada é o bloco mais saturado fora dos estados. Ela compete com os chips âmbar que fazem o "depende de mim". Fere o princípio 3 de `references.md` e a recomendação do eixo 2.
2. **A mesma cor marca você e os agentes.** O avatar do implementador e do revisor é íris sobre íris (`--av-bg`, `c.html:142`), e o seu nome e o seu balão também são íris (`c.html:557`, `63`). O requisito 2 do brief §6, distinguir quem fala, perde o portador que C tinha para dar.
3. **A barra do pedido parece uma segunda caixa de texto.** Ela é branca, com borda de 1 px, raio de 14 px e sombra (`c.html:151`). É o mesmo tratamento do compositor logo abaixo, e as duas leem como um formulário de dois campos. O âmbar está só no glifo e no chip. O README do designer propõe levar essa barra flutuante para B. Discordo: ela esconde o pedido no lugar de destacá-lo.
4. **A mensagem do produto usa a borda tracejada.** `--app-border: var(--bw) dashed` (`c.html:143`). A estrutura reserva o tracejado para "desabilitado" (`structure.md` §3), e aqui ele diz "o MySpec mandou isto".
5. **O cartão tem o fio colorido no topo de um retângulo arredondado.** `border-top: 3px solid var(--wait-glyph)` com raio de 14 px (`c.html:564`) desenha um arco âmbar nos cantos. É o clichê de "accent bar em card arredondado" que a skill de design aponta como marca de design gerado. Opinião: a faixa de cabeçalho de A diz o mesmo sem o arco.
6. **O chip da etapa atual reivindica duas cores.** O fundo e o texto são íris (`c.html:140`, `559`), e o segmento atual do medidor é âmbar. É o único lugar do topo com duas cores de papéis diferentes.
7. **O código tem corpo fracionário.** `--fs-code: 0.78125rem` (12,5 px, `c.html:42`). A meia medida é um risco de hinting no WebKitGTK sem ganho visível. Do resto, Red Hat Text é a família da rodada mais bem desenhada para corpo pequeno no Linux, e o risco tipográfico de C é baixo.

O que C faz melhor que as outras:
- os marcadores de evento em pílula centrada, uma opção se os marcos (requisito 6 do brief §6) precisarem de mais peso que um fio.

## 4. O topo do item (prévia, igual nas três)

**O ganho de hierarquia é real.** O título vem como `h1`, a posição vem numa linha, e a escolha da conversa foi para a coluna de que ela fala. As três leem melhor que as quatro faixas de mesmo peso. Tirar **Review mode**, **Models** e **Discard step** da vista é coerente com "escolha rara" e com a regra do único lugar, que continua repetindo **Discard step** na barra do pedido em `step_empty`.

**O que ele esconde ou tensiona:**

- **Na metade do monitor, a trilha perde o futuro.** Abaixo de 1240 px de área principal (`a.html:384`), que é toda janela de 1250 px, as etapas feitas e as futuras viram `✓ ✓ ✓` e `○ ○ ○`, e os círculos ficam a 2,5:1. O que vem depois da implementação só aparece no tooltip. É um dos dois usos reais do app (brief §2), e é a "experiência de progresso entre etapas" que `structure.md` §9 deixou em aberto.
- **O segmento atual do medidor volta a pôr a situação na linha 2.** `.segs i.c { background: var(--wait-glyph) }` (`a.html:379`) está fixo em âmbar. A regra da situação diz que, com a barra do pedido presente, a barra do item mostra a posição sem o sinal da situação (`structure.md` §3). O âmbar na linha 2 é esse sinal por outro nome. Além disso, a cor está fixa no CSS e não segue o estado.
- **O mesmo pedido aparece quatro vezes numa tela de 1040 px.** A 1250 px, `Permission · 4m` está no seletor, no grupo de ações (`waits for your permission`), no cabeçalho do cartão e na barra do pedido, e o `4m` aparece duas vezes. A estrutura permite a aba e a barra. O resto é peso que dilui o ponto em que o olho deve parar.
- **A 2500 px, o topo tem três eixos.** O título fica colado à esquerda, as ferramentas a cerca de 1.500 px à direita, e o seletor e **Review myself** centrados na medida da conversa. O olho faz zigue-zague entre três alinhamentos. Opinião: a linha 1 poderia seguir a medida, ou ao menos o título poderia.
- **As ferramentas do step ficam presas ao seletor de conversa.** **Review myself** e **Open in VS Code** vivem no cabeçalho da coluna. Fica em aberto onde elas moram numa etapa sem as duas conversas (PR, planejamento).

## 5. Contraste medido

Pares de maior risco, medidos sobre os tokens, claro e escuro. Os que passam com folga ficam de fora.

| Par | A | B | C | Mínimo |
|---|---|---|---|---|
| `--ink-4` sobre a linha selecionada | 4,88 / 5,23 | 4,73 / 5,03 | 4,72 / 5,29 | 4,5 |
| `--ink-4` sobre o tom da espera (barra, cabeçalho do cartão) | 5,48 / 5,26 | 5,42 / 4,89 | 5,18 / 5,25 | 4,5 |
| `--close` (texto do chip de encerramento, 11–12 px) sobre a linha selecionada | 4,60 / 7,67 | 4,66 / 7,65 | 4,64 / 7,76 | 4,5 |
| Glifo de espera sobre a linha selecionada | 3,36 / 7,94 | 3,10 / 7,95 | 3,38 / 8,03 | 3 |
| Glifo do ocioso sobre a lateral | 3,67 / 4,11 | 3,37 / 4,17 | 3,57 / 4,17 | 3 |
| `--deco` (etapa futura, `›`) sobre o topo | **2,63** / 3,05 | **2,47** / 3,13 | **2,48** / 3,05 | 3 |
| Chip de espera (forma) sobre a lateral | **1,53** / 10,8 | **1,45** / 11,0 | **1,49** / 11,0 | 3 |
| Linha selecionada contra a lateral | **1,14** / **1,27** (com anel) | **1,13** / **1,29** (só o negrito, que também quer dizer "espera") | **1,10** / **1,27** (com texto íris e negrito) | 3 para o estado |
| Borda da caixa de texto | **1,87** / **2,08** | **1,87** / **1,89** | **1,75** / **2,01** | 3 |
| Barra do pedido contra a conversa | 1,06 / 1,04 | 1,12 / 1,24, com matiz âmbar | 1,05 / 1,10, com sombra | sem mínimo, é a medida de "impossível de perder" |

Os números do espécime conferem com os meus a menos de 0,05 nos pares que ele mede (`--ink-4` sobre a lateral em B: 5,36 contra 5,34). Todo texto da rodada passa AA. As falhas são não textuais e todas ficam fora do espécime.

## 6. Comparação

- **Hierarquia do pedido.** B acha a barra do pedido de longe. Em A ela some no cromo, e em C ela vira uma segunda caixa de texto.
- **Árvore como "depende de mim".** A e B deixam os chips âmbar e vermelhos sozinhos na cor. C gasta a íris na linha selecionada, o bloco mais forte da lateral.
- **Leitura.** B tem o melhor registro de leitura (serif de 17 px, cerca de 90 caracteres). C fica no meio. A tem 109 caracteres numa sans de 15 px.
- **Sistema contra coleção.** A é coerente mas tem três vocabulários de seleção. B é o mais coeso, com uma falha na seleção e uma nos links. C é uma coleção: íris, pílulas, tracejado e fio no topo.
- **Risco no WebKitGTK.** A tem 11 px em Plex Mono. B tem a serif, que rendeu bem no Linux, e o negrito sintético no código. C tem o menor risco de tipo e o corpo de 12,5 px no código.

## 7. Recomendação

**B · Leitura**, como o designer recomenda, mas com condições que a rodada ainda não cumpre. A razão é a mesma dele, e a medição a confirma: B é a única em que a cor está só onde algo depende de você ou onde o agente trabalha, e a única em que a barra do pedido cumpre o requisito 3 do brief §6. Discordo em dois pontos: a ressalva da serif pesa menos do que o README diz, e a barra flutuante de C não deve vir para B.

Antes de B virar `principles.md` e `system/`, estas correções entram no system:

1. Marcar a linha selecionada com mais que o tom, e com algo que não seja o negrito da espera: o anel de 1 px de A.
2. Dar à borda tracejada do chip desabilitado uma cor visível.
3. Sublinhar os links sempre, na fala do agente e no breadcrumb.
4. Carregar o peso 600 do Source Code Pro, ou baixar `--code-kw-w` para 500.
5. Fazer o título do item maior que a fala.
6. Corrigir o que é comum às três (seção 0): o âmbar do `running`, as bordas fracionárias dos glifos, o `--deco` das etapas futuras e a forma do chip de espera no claro. Completar o espécime com a barra do pedido de erro, o bloco de erro e os estados da opção e do seletor.

O que levar das descartadas:

- **De A:**
  - o cabeçalho do cartão bloqueante na cor da situação (`.card .hd`), que dá ao cartão de B o sinal que hoje só a sombra carrega;
  - o anel de 1 px na seleção;
  - as hairlines dentro das listas densas que ainda vêm (board, checks, History), como o designer propõe.
- **De C:**
  - os marcadores em pílula, só se os marcos precisarem de mais peso;
  - nada da cor e nada da barra flutuante.
- **A pergunta da identidade** (`references.md` §7): C mostra o custo de ter uma cor de identidade no cromo. Se o usuário quiser uma, ela fica no ícone e na tela de boas-vindas.
