# 07 · Theme explorer

Fase 3, fundação visual. A rodada 06 decidiu a base da linguagem (**B · Trilho**) e deixou a cor em aberto: o usuário não gostou do tema de cores no geral nem do petróleo, e pediu uma iteração rápida e abrangente, com variedade, num seletor de tema. Esta rodada é uma página só, `index.html`: a cena da 06 · B, com a base corrigida, e treze temas completos para folhear ao vivo: os dez da primeira versão e três pedidos depois do primeiro olhar do usuário (seção Decisão).

Aqui as variações são os temas, e cada um tenta uma ideia de cor diferente e nomeada. A estrutura, a tipografia (Fira Sans e Fira Code), o espaçamento e os componentes são os mesmos em todos, para que só a cor mude entre um e outro.

## Como usar

- Sirva a pasta (`python3 -m http.server 8090 -d design/lab`) e abra `07-theme-explorer/index.html`.
- **O painel** fica no canto inferior direito. Ele traz:
  - a lista dos treze temas, cada um com uma amostra (a lateral, o chão, a identidade e os discos de espera, erro e encerramento) e a menor razão de contraste de texto medida no modo claro e no escuro;
  - o alternador System, Light e Dark;
  - a estrela de "gostei" em cada tema;
  - embaixo, a intenção do tema aberto, a referência, as menores razões de texto e de UI, a lista dos temas marcados e **Copy link**.
- **Teclado:**
  - `[` e `]` trocam de tema;
  - `D` alterna entre claro e escuro;
  - `L` marca ou desmarca o tema aberto;
  - `T` recolhe o painel.

  Os atalhos não disparam enquanto você digita no compositor. Na lista, as setas trocam de tema e `Home` e `End` vão às pontas. O painel recolhido vira uma pílula com o nome do tema, as setas e o botão para abrir.
- **A URL** carrega o estado: `?theme=cobre&mode=dark&liked=cobre,marinho`. Para me dizer o que achou, basta o nome, ou o link copiado. Os temas marcados, o último tema aberto e o painel aberto ou fechado também ficam no `localStorage`.
- `&tab=reviewer` abre a conversa do revisor, com a pergunta. Sem ele, abre a do implementador, com a permissão. O painel também troca a aba.
- `?specimen` mostra só o espécime do tema aberto. O espécime também fica no fim da página, embaixo da cena. Ele tem:
  - a tabela dos treze temas medidos;
  - a identidade, os neutros, os estados e as cores de código, nos dois modos;
  - os status na lateral;
  - os 37 pares de texto e os 26 de glifo, anel e borda, com o contraste calculado na hora;
  - o ΔE entre a identidade e os estados;
  - a grade de estados de cada componente;
  - a árvore linha a linha e as peças da conversa.
- `&panel=closed` abre com o painel recolhido, para capturas.

## Os temas

A menor razão é o pior par de texto (mínimo 4,5:1) e o pior par de glifo, anel ou borda (mínimo 3:1), medidos na página a partir das cores pintadas, nos modos claro · escuro. Nenhum dos treze tem par abaixo do mínimo, e em todos a identidade fica a um ΔE de pelo menos 0,15 da espera, do erro e do encerramento.

| Tema | Intenção | Referência (princípio, não cópia) | Neutros | Identidade | Lateral | Menor texto | Menor UI |
|---|---|---|---|---|---|---|---|
| **Grafite** | Grafite frio e um azul elétrico: preciso, técnico, o azul só onde você age | Linear: a lateral recua por tom, o cinza fica nítido | Frios | Azul elétrico `0.54 0.2 263` | No tom, cinza-azulado | 4,75 · 5,42 | 3,21 · 3,11 |
| **Marinho** | Um trilho marinho ao lado do papel branco. O cromo é escuro e assentado; o cobalto marca o que você aciona | GitHub: cromo global escuro sobre a área de trabalho clara, só tokens funcionais | Frios | Cobalto `0.47 0.16 257` | Escura, marinho `0.27 0.05 260` | 4,58 · 5,46 | 3,46 · 3,13 |
| **Sálvia** | Papel quente, lateral de sálvia e um verde-floresta. Calmo para ler horas; o encerramento vira violeta, como um merge no GitHub | Notion e o cinza quente do Linear; o violeta de "done" do Primer | Quentes | Verde-floresta `0.48 0.1 150` | No tom, sálvia | 4,70 · 5,45 | 3,18 · 3,11 |
| **Esmeralda** | Lateral verde-negra e um esmeralda. Distinto e ainda quieto; o encerramento vira violeta, para o verde ser só o MySpec | Cursor, a janela de agentes: a lista escura de agentes ao lado do trabalho; o violeta de "done" do Primer | Frios | Esmeralda `0.5 0.115 164` | Escura, verde-negra `0.255 0.035 170` | 4,68 · 5,43 | 3,46 · 3,12 |
| **Cobre** | Carvão e cobre, quente e de ofício. O cobre fica onde estava o âmbar, então "esperando por você" passa a azul | Raycast: identidade quente sobre cromo neutro, cor em ícones e marcas, nunca em superfícies | Acromáticos | Cobre `0.56 0.11 58` | Escura, carvão `0.25 0.006 55` | 4,82 · 5,08 | 3,44 · 3,05 |
| **Ameixa** | Cinzas malva e uma ameixa apagada. Violeta sem o brilho: croma baixa, um tom chapado, nenhum gradiente | Radix Colors: neutros Mauve compostos com um roxo; o lavanda do Linear, reduzido | Frios, malva | Ameixa `0.48 0.12 300` | No tom, malva | 4,63 · 5,43 | 3,13 · 3,12 |
| **Argila** | Cinzas de argila e um rosa-terra. Macio e humano; o rosa é apagado, para o vermelho do erro continuar sendo o quente mais alto | Notion: cinzas quentes no lugar do preto; os neutros tingidos do Claude, sem o coral | Quentes | Rosa-terra `0.46 0.075 342` | No tom, argila | 4,65 · 5,36 | 3,12 · 3,09 |
| **Nanquim** | Tinta sobre papel. Nenhum matiz de marca: o preto age, e toda cor na tela é um estado | Vercel Geist: cromo preto e branco, cor reservada ao status | Acromáticos | Tinta `0.18 0 0` / `0.94 0 0` | No tom, cinza | 4,73 · 5,43 | 3,26 · 3,02 |
| **Contraste** | Preto, branco e um azul firme, para ofuscamento, cansaço ou baixa visão. Texto a 7:1 ou mais, bordas que se veem | Temas de alto contraste do Primer: 7:1 no mínimo para texto | Acromáticos | Azul firme `0.44 0.2 262` | No tom, com fio no escuro | **7,12 · 7,87** | 3,45 · 3,24 |
| **Breu** | Preto verdadeiro para OLED, com latão como identidade: pixels apagados no escuro, um branco nítido no claro. A espera passa a azul | Warp e Zed em temas de preto verdadeiro: superfícies elevadas só onde precisam | Frios; escuro `0 0 0` | Latão `0.52 0.11 70` / `0.83 0.12 80` | No tom; no escuro, preta com fio | 4,73 · 5,60 | 3,40 · 3,34 |
| **Grafite quente** | O azul do Grafite sobre o calor do Cobre: papel e carvão com um traço de calor, e o azul puxado para o cobalto para assentar neles sem ofuscar | A troca do Linear de um cinza frio para um mais quente que continua nítido | Quentes, traço leve (`h 65 c 0.004`) | Azul elétrico assentado `0.52 0.175 260` | No tom, cinza morno | 4,71 · 5,46 | 3,18 · 3,07 |
| **Marinho quente** | O Marinho com o calor de volta: lateral de carvão-tinta morno no lugar do marinho gelado, papel morno, cobalto no que você aciona | O cromo escuro do GitHub sobre a área clara; o carvão do Cobre | Quentes, traço leve | Cobalto `0.47 0.16 258` | Escura, carvão morno `0.26 0.012 58` | 4,71 · 5,46 | 3,46 · 3,07 |
| **Cobre II** | O Cobre refinado: a espera é um amarelo de sinal com contorno escuro, como uma placa de trânsito ao lado do cobre; papel e carvão mais mornos | A identidade quente sobre cromo neutro do Raycast; o preto sobre amarelo de uma sinalização | Quentes, traço leve | Cobre `0.55 0.115 56` / `0.73 0.115 56` | Escura, carvão morno `0.25 0.01 55` | 4,78 · 4,60 | 3,46 · 3,05 |

Valores em OKLCH, no modo claro, com o escuro quando ele é outro. O conjunto completo de cada tema está no espécime e sai da função `modeTokens` no topo do arquivo.

### Os três temas da segunda leva

- **O calor.** Os três usam o mesmo neutro: matiz 65, croma 0,004 no chão e 0,01 na tinta. É o dobro do traço do Cobre original (que era quase acromático, `h 60 c 0.002`) e bem menos que a Sálvia (`h 85 c 0.006`, tinta a 0,013, lateral esverdeada a 0,013), que passou do ponto. O calor fica no papel, no carvão e na tinta, nunca num tom que se leia como bege.
- **O azul do Grafite quente.** Ele foi um pouco para o cobalto (matiz 263 → 260) e perdeu um pouco de croma (0,2 → 0,175) e de luz (0,54 → 0,52). Um azul elétrico puro sobre papel morno vibra, porque são quase complementares, e o que o usuário gostou no azul do Grafite foi a nitidez, não a saturação. Assentado, ele continua claramente elétrico ao lado do cobalto do Marinho quente (0,47 0,16), que é mais fundo e mais escuro.
- **A lateral do Marinho quente** é um carvão-tinta morno (`0.26 0.012 58`) no lugar do marinho gelado. Sem o azul, o que separa este tema do Grafite quente é só a lateral escura, e é exatamente essa a escolha entre os dois.
- **A espera do Cobre II: amarelo de sinal com contorno.**
  - Das saídas possíveis, é a única que mantém o sentido de sempre ("âmbar e amarelo são comigo") e é inconfundível com o cobre.
  - Fica a 0,34 de ΔE do cobre no claro e a 0,19 no escuro. O âmbar do Cobre original ficava a menos de 0,15.
  - O amarelo é claro demais para 3:1 sobre o branco, então no modo claro o disco e o chip ganham um contorno escuro (`--wait-ring`, `0.44 0.08 80`). O contorno leva o contraste, e o rótulo da espera fica em tinta escura sobre a faixa amarela.
  - No escuro, e sobre a lateral escura nos dois modos, o amarelo sozinho basta.
  - As alternativas que descartei:
    - azul, a do Cobre original: tira o sentido de "é comigo";
    - verde-pátina, o par natural do cobre: fica perto do verde de encerramento e perto do petróleo recusado;
    - violeta: não chama atenção e é o "done" do GitHub;
    - manter o âmbar e escurecer o cobre para um marrom: o cobre perde o caráter e encosta no vermelho do erro.
- **Os outros refinos do Cobre II:**
  - os neutros mornos acima;
  - o carvão da lateral um pouco mais quente (`0.25 0.01 55`);
  - o cobre do escuro um degrau mais fundo (`0.77 0.11 62` → `0.73 0.115 56`), para abrir distância do amarelo;
  - o erro do escuro puxado para o carmim-rosado (`0.7 0.18 358`), para ficar a 0,158 do cobre.

  O token `--wait-ring` entrou no sistema para isso. Em todos os outros temas ele é igual ao disco, e nada muda neles.

### Onde cada estado ganhou outra cor

A regra é que a espera e o erro nunca se confundem com a identidade. Quando a identidade ocupa o lugar de um estado, o estado muda, e não a identidade:

- **Cobre II**: a espera é o amarelo de sinal com contorno, descrito acima.
- **Cobre** e **Breu**: a espera sai do âmbar para o azul (`0.55 0.17 258`). No Cobre, o erro vai ao carmim (`0.5 0.2 10`), longe do cobre.
- **Sálvia** e **Esmeralda**: o encerramento sai do verde para o violeta (`0.5 0.15 302`), o "done" do GitHub.
- **Breu**: o encerramento vai ao verde-azulado (`0.5 0.12 162`), longe do latão.
- **Argila**: o rosa foi para o malva e ganhou um degrau de profundidade; no escuro, o erro vai para o laranja (`0.7 0.17 28`).
- **Em todos**: o âmbar da espera foi para o amarelo (matiz 75) e o vermelho do erro para o carmim (22), para os dois ficarem a 0,15 um do outro. Na 06, eles estavam a 0,11 e ninguém tinha medido.

Isso é uma escolha a fazer junto com o tema: nos quatro temas acima, o significado de uma cor de estado depende do tema. A forma e o texto continuam iguais em todos (disco, losango, anel, o chip e a palavra), então nada se perde para quem lê pela forma. Mas quem se acostumou com "âmbar é comigo" num tema tem que reaprender no outro. Se o tema escolhido for um desses, a troca vira parte da decisão.

## Tokens como sistema

Toda cor da página vem de um conjunto de tokens semânticos. Um tema é um conjunto completo deles, no claro e no escuro. O CSS de cada tema é escrito pelo script no `<head>`, antes do primeiro desenho:
- `:root`, `@media (prefers-color-scheme: dark)` e `:root[data-theme="dark"]` para a página;
- uma classe por tema e modo (`.th-cobre-l`), usada nas amostras do painel, no espécime e na medição.

Fora dos blocos de tema não há cor solta. A exceção é o painel do explorador, que é ferramenta e não produto: ele tem os próprios neutros (`--pn-*`), iguais em todos os temas, para não enviesar a comparação.

| Grupo | Tokens |
|---|---|
| Chão e superfícies | `--bg-ground` (o chão: conversa, cabeçalho), `--bg-sunken`, `--bg-raised`, `--bg-float`, `--bg-input`, `--bg-user` |
| Lateral | `--bg-sidebar`, `--sb-input`, `--sb-line`, `--sb-control`, `--guide` (a guia do épico, a 3:1), `--sb-edge` (o fio entre lateral e conteúdo, só no preto e no alto contraste) |
| Tinta e borda | `--ink`, `--ink-2`, `--ink-3`, `--ink-4`; `--line`, `--line-strong`, `--line-control`, `--deco` |
| Identidade | `--brand`, `-hover`, `-active`, `-on`, `--brand-ink` (link, New, etapa), `--brand-line` (anel da linha aberta), `--brand-track`, `--tint-ink` (o traço dos véus de hover) |
| Véus e anéis | `--hover-mix`, `--active-mix`, `--sel-mix`, `--wash-mix`, `--wash-hover-mix`, `--wash-active-mix`, `--halo-mix`, `--seg-mix`, `--marker-mix`, `--key-mix`, de onde saem `--bg-selected`, `--bg-wash`, `--seg-todo`, `--marker-ring`, `--key-ring` |
| Foco, seleção, link | `--focus`, `--focus-halo`, `--sel-ring`, `--link` |
| Estados | `--err`, `-bg`, `-line`, `-on`; `--wait`, `--wait-glyph`, `-bg`, `-line`, `-chip`, `-chip-ink`; `--close`; `--work`, `--work-track`; `--gh`; `--paused`; `--idle` |
| Código | `--code-kw`, `--code-str`, `--code-fn`, `--code-num`, `--code-com` |
| Sombras | `--shade` (o matiz de toda sombra), `--shadow-btn`, `-primary`, `-xs`, `-card`, `-sheet`, `-float`, `-overlay`, `-mark` |

Um tema é escrito a partir de poucas escolhas num espaço perceptual, o princípio 6 de `research/references.md`:
- o matiz e a croma do neutro;
- a cor da lateral e se ela é do tom ou escura;
- a identidade nos dois modos;
- a família de cada estado;
- os matizes do código.

Um tema pode sobrescrever qualquer token pelo nome, e o Contraste e o Nanquim fazem isso. Uma lateral escura no modo claro recebe o conjunto escuro do próprio tema, com o seu tom de ardósia: os glifos, o anel e o **New** ficam certos sobre ela sem nenhuma regra à parte.

## O que mudou na base (vale para todos os temas)

A partir de `06-visual-petroleo/b.html` e do `critique.md` da 06, o que não é cor:

1. **"Trabalhando" em tinta neutra** (`--work` = `--ink-2`), com a forma do spinner, o movimento e o texto, como GitHub, pausado e ocioso. A identidade não aparece em nenhum estado. Isso cumpre a decisão de 2026-09-24 ("nunca no lugar de uma cor de estado"), que a 06 contrariava.
2. **Nomes da árvore sem cortar.**
   - O meta escondido sai com `display: none` e não ocupa espaço.
   - Com ele escondido, o nome ocupa as colunas 2 e 3 da linha.
   - O meta aparece no hover, no foco, na linha aberta e na linha de `Ctrl J`. Aí o nome volta à coluna 2.
   - A 1250 px, trunca só `Migrate settings page to react-hook-form`, que precisa de 262 px numa linha de 242. A 2500 px, nada trunca.
3. **Cabeçalho de board com hierarquia acima do épico.** O board fica em caixa normal, 14 px, peso 500, `--ink-2`. O épico fica em 13 px, peso 500, `--ink-3`. Nenhum dos dois tem contagem: `REVIEWS 2 … 4 pending` virou `Reviews · 4 pending`.
4. **Guia do épico visível.** Os itens do épico recuam 16 px, e uma guia de 1 px (`--guide`) desce sob o chevron do épico, a 3:1 ou mais da lateral em todos os temas e modos (medido no espécime).
5. **`New` com corpo.** É um botão elevado (`--bg-raised` com `--shadow-xs`), com o texto e o ícone na identidade. O corpo fica a 1,14:1 ou mais da lateral em todos os temas e nos dois modos, também na lateral escura. O par está no espécime.
6. **O comando do pedido aparece uma vez na tela, no cartão.**
   - O grupo de ações da permissão vem recolhido, e o resumo diz `Read .env.local · a dry run · 1 on hold`.
   - A barra do pedido é a chamada quieta: faixa neutra (`--bg-sunken`), glifo, `Permission · Implementer · Step 3/7`, o relógio e **Show**. Não repete o comando e é mais leve que o cartão.
   - A forma tingida da barra fica para os pedidos sem cartão: rascunhos e erro, no espécime.
7. **O resto da limpeza do `critique.md`:**
   - as porcentagens soltas viraram tokens (`--seg-mix`, `--marker-mix`, `--key-mix`, `--wash-hover-mix`, `--wash-active-mix`);
   - o marcador de lista sai da identidade para `--ink-4`;
   - o segmento da etapa atual tem o dobro do comprimento dos feitos;
   - a árvore que rola mostra um esmaecido e `↓ N more below`, que leva ao fim;
   - o `role="group"` de cada nó é apontado por `aria-owns`;
   - a aba tem `title` com o tempo de espera.
8. **Sem gradiente de cor.** O medidor de contexto é chapado na identidade. Os únicos gradientes que sobram são esmaecimentos para a cor do próprio fundo, na barra do pedido e no fim da árvore.

Continua como na 06, e continua sendo desvio declarado de `structure.md` §2: o meta de uma linha só aparece no hover, no foco e na linha aberta. Ele está sempre no nome acessível.

## Como foi testado

Chromium headless no Linux, a 1250 e a 2500 px de largura por 1040 de altura. Foram capturados os treze temas nos dois modos, olhando cada captura, mais o painel aberto, a aba do revisor e o espécime inteiro do Marinho. Nenhum tema tem gradiente roxo, brilho ou neon. A Ameixa é o risco de "cara de IA", e por isso tem croma baixa e nenhum efeito.

A medição roda na própria página, sobre as cores pintadas: `?report` põe o resultado num `<pre>`. As três rodadas de ajuste foram guiadas por ela. Foram assim que apareceram erro e espera perto demais em todos os temas, cobre e erro no Cobre, latão e verde no Breu, e rosa e erro na Argila.

A renderização final é do WebKitGTK, e o petróleo mostrou que a cor precisa ser vista no app.

## Decisão

2026-09-24, primeiro olhar do usuário sobre o explorador:
- o **Cobre no escuro** ficou muito bom, com um visual interessante;
- ele gostou do **azul do Grafite**, mas achou o Grafite frio demais;
- gostou de o Cobre ser **um pouco mais quente**, mas não tanto quanto a **Sálvia**, que passa do ponto.

Ele pediu para tentar o Grafite ou o Marinho mais quentes. Entraram três temas no fim da lista, sem tirar nenhum: **Grafite quente**, **Marinho quente** e **Cobre II**, este último com a espera revista. Nenhuma cor foi aprovada ainda.

## Recomendação

Olhe primeiro estes três, nesta ordem:

1. **Cobre.** É o tema com mais caráter sem cara de IA. A lateral carvão com o cobre é quente e de ofício, e nada no gênero se parece com ele. O preço é a espera em azul, o que torna a tela mais calma: o âmbar some, e o azul da espera é frio e não compete com o cobre. É o que mais responde a "cores interessantes, bonito de ver".
2. **Marinho.** É o mais sólido e profissional dos dez primeiros. A lateral marinho separa a navegação do trabalho sem nenhuma linha, os estados ficam nas cores de sempre, e o cobalto é a identidade mais legível em todos os papéis. Se o Cobre parecer ousado demais, é este.
3. **Sálvia.** É a proposta quente: papel, lateral de sálvia e verde-floresta, para quem passa horas lendo a conversa. O encerramento violeta é a única troca, e segue o GitHub.

Grafite é o controle: bonito e correto, mas é o azul que qualquer ferramenta tem. Contraste e Breu não disputam a identidade. São modos que o tema escolhido pode ganhar depois: alto contraste e preto verdadeiro.

### Depois da segunda leva

Contra o Cobre original, recomendo o **Cobre II**:
- ele guarda o que o usuário gostou (o carvão e o cobre no escuro, quase iguais);
- a espera volta a ser inconfundível e a ter o sentido de sempre;
- o papel ganha o calor pedido sem chegar ao da Sálvia.

Se o usuário preferir o azul, o **Grafite quente** é o melhor dos três: ele é o azul que ele gostou, sem o frio. O **Marinho quente** fica como a versão dele com a lateral escura.

## Dados que faltam

Nada que esta rodada acrescenta pede dado novo. A contagem dos nós saiu, e o `N more below` é da própria árvore. Continuam valendo os quatro da rodada 04, na mesma cena:
- o caminho do arquivo no cabeçalho do bloco de código;
- o código de saída de uma ação;
- a duração de uma ação em curso;
- a ação que espera permissão (`1 on hold`), cujo vínculo pelo `toolUseId` é só frontend.

**Escolhido em 2026-09-24: Grafite quente.** Registrado em `design/decisions.md`. A rodada `08-visual-final` aplica o tema como linguagem única, com o refino e a crítica que fecham a fase 3.
