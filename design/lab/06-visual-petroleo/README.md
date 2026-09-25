# 06 · Petróleo

Fase 3, fundação visual. É a rodada que vai ao usuário para aprovar a linguagem visual do MySpec. Parte da **B · Petróleo** da rodada 05, com as seis condições do `critique.md` dela, e dá o salto que a 05 não deu: a cor de identidade presente de verdade, a barra lateral organizada e menos repetição do pedido na tela. A cena é a mesma das rodadas 04 e 05: a task `Rate limit per API key` na implementação no modo `Agent`, step 3 de 7, com o revisor perguntando e o implementador esperando permissão, e a árvore inteira.

Duas variações, que diferem só na barra lateral e na profundidade:

| | A · Folha | B · Trilho |
|---|---|---|
| **Ideia** | A folha da 05, refinada: a lateral fica no chão da janela e o item é uma folha elevada | A lateral em tom próprio, uma ardósia de petróleo mais escura que o trabalho nos dois temas; o conteúdo é plano |
| **Lateral** | Mesmo tom neutro do chão (`0.956 0.003 75` / `0.15 0.003 70`), separada da folha pela superfície | Tom próprio tingido pela identidade (`0.935 0.016 218` / `0.165 0.022 222`), separada do conteúdo pelo tom, sem linha |
| **Conteúdo** | Folha com raio de 12 px, 8 px de chão em volta e sombra no matiz do petróleo | De borda a borda, sem folha e sem sombra |
| **De onde vem a profundidade** | Da folha e das superfícies dentro dela | Só das superfícies que pedem: o cartão, a aba selecionada, o compositor, `New messages` |
| **Onde a identidade se lê de longe** | Nos acentos: linha aberta, etapa atual, New, medidores, Allow | No cromo inteiro: a lateral já é do MySpec, e os acentos vêm por cima |

## Como abrir

- Sirva a pasta (`python3 -m http.server 8090 -d design/lab`) e abra `06-visual-petroleo/a.html` e `b.html`. Lado a lado: `compare.html?a=06-visual-petroleo/a.html&b=06-visual-petroleo/b.html`. Contra a base: `compare.html?a=05-visual-b-variations/b.html&b=06-visual-petroleo/b.html`.
- `?theme=dark` ou `?theme=light` fixa o tema. Sem o parâmetro, vale o do sistema.
- `?tab=reviewer` abre a conversa do revisor, com a pergunta. Sem ele, abre a do implementador, com a permissão.
- `?specimen` mostra só o espécime, que também fica no fim de cada página.
- O selo `06 · A ▴` no canto inferior direito é do mock, não da interface.

O espécime traz a identidade com a lista de onde ela vai, a escala de tipo, os neutros, **o contraste medido na hora** de 149 pares nos dois temas (texto a 4,5:1, glifos, anéis, bordas e medidores a 3:1), **a distância ΔE em OKLab** entre a identidade e os estados, a grade de estados de cada componente, a árvore linha a linha, as peças da conversa fora da cena e as duas auditorias de pixel.

## O que contraria uma decisão registrada

`decisions.md` (2026-09-24, a cor de identidade) diz que ela é aplicada "com parcimônia (marca, ação primária, foco, seleção) e nunca no lugar de uma cor de estado". Esta rodada contraria as duas partes, e diz por quê:

- **A presença vai além dos quatro lugares.** O petróleo aparece em 13 papéis (tabela abaixo). É o que o coordenador pediu depois de julgar a 05 tímida: nela a cor ficava no botão primário e no logo, e o usuário pediu uma cor característica em uso. A parcimônia continua de outro jeito: o petróleo nunca aparece onde algo depende do usuário, e nenhum lugar ganhou cor sem ter um papel.
- **"Agente trabalhando" é o petróleo em movimento.** O azul das rodadas 04 e 05 saiu. Com o petróleo presente, um segundo azul a ΔE 0,13 (claro) e 0,08 (escuro) dele se lia como a mesma família com outro significado. Para uma cor própria de "trabalhando" passar de 0,15 do petróleo, ela precisa ir ao violeta (matiz 275), e ainda fica a 0,13 no escuro, que é o território "de IA" que o usuário já recusou. A regra fica assim: **o petróleo é o MySpec (o que você aciona e o que o agente faz), e âmbar, vermelho e verde são o que depende de você.** O estado "trabalhando" continua com três portadores: a forma (o spinner, a única coisa que gira), o movimento, e o texto (`agent working` no nome acessível, a linha 3). Se a decisão for manter uma cor própria, é o token `--work`.

A revisão, se aprovada, entra em `decisions.md` como uma entrada nova que aponta a de 2026-09-24.

## O que mudou em relação à 05 · B

1. **A cor de identidade.** O petróleo ficou mais profundo e mais azul (`0.50 0.085 205` → `0.46 0.085 218`), perto da tinta de caneta que dá nome à cor, e o verde de encerramento foi para o lado amarelo (`155` → `138`). A distância entre os dois subiu de 0,094 para 0,155 (claro) e de 0,097 para 0,176 (escuro).
2. **Onde ela aparece.** Da marca e do primário para os 13 papéis da tabela abaixo.
3. **As sombras.** Todas no matiz do petróleo, nunca preto puro, e todas em tokens (`--shadow-btn`, `-primary`, `-xs`, `-card`, `-sheet`, `-float`, `-overlay`, `-mark`). No escuro, as superfícies elevadas levam um traço do petróleo (croma 0,006 a 0,01): o tom ambiente.
4. **O âmbar.** O pedido tem um lugar forte (o cartão, com a faixa de cor e a sombra de cartão) e um lugar de chamada (a barra do pedido, tingida, sem anel e sem cara de campo). Nas abas, ele é um disco de 8 px, sem chip e sem tempo. Na lista de ações, nenhum âmbar: a ação em espera tem uma ampulheta neutra e as palavras `waits for your permission`, e o resumo diz `on hold`. Na árvore, o chip de tempo continua, porque ali é o "de longe". Na coluna do implementador, a espera aparecia cinco vezes em âmbar e agora aparece três (aba mínima, cartão, barra).
5. **A barra lateral.** Tudo o que a linha carrega (`structure.md` §2) continua. Mudou a hierarquia:
   - o nome em 14 px e peso 400, e a espera em 600: dois degraus inteiros de peso;
   - a linha 2 em 13 px e `--ink-3`, a linha 3 em mono de 12 px e `--ink-4`, com o medidor de contexto numa barra de 4 px em gradiente de petróleo;
   - o meta (`api#412`) aparece só no hover, no foco e na linha aberta. `Ctrl J` nunca some;
   - um elemento por linha no eixo direito (meta ou `Ctrl J`, depois o relógio, depois o medidor);
   - 6 px de respiro em cima e embaixo de cada linha, 4 px entre linhas, 24 px entre seções;
   - cabeçalhos de seção em caixa alta de 11 px, peso 600, tracking de 0,07 em, `--ink-4`, com a contagem (`PLATFORM ROADMAP 5`) e a seta de abrir o board no hover. O épico é um subcabeçalho em caixa normal;
   - os glifos numa coluna só: os itens do épico não recuam mais, e uma guia de 1 px na margem os agrupa;
   - o glifo de task deixou de ser uma caixa com visto (que dizia "feito"): é uma caixa com duas linhas, de spec. Os glifos de tipo ficam em `--ink-4` e só o da linha aberta fica em petróleo.
6. **O topo do item.** O mesmo das rodadas 04 e 05 (é da fase 4), com a etapa atual em petróleo (véu, tinta e segmentos), as etapas feitas com o visto em petróleo e o ícone de tipo do título em petróleo. A trilha não encolhe mais sob o título do step: a 1100 px os dois se sobrepunham, e agora o título do step trunca.
7. **A conversa.** O marcador do agente é um disco de petróleo, cheio no implementador e contornado no revisor, para os dois agentes nunca parecerem iguais. Você fica neutro, e a mensagem do MySpec continua no bloco afundado. O cabeçalho fixo com as abas tem fundo sólido e um fio, sem o esmaecido que deixava uma linha fantasma embaixo.
8. **`Change path`** no aviso de clone é um texto em petróleo (`Change path ↵`), não um botão dentro do `treeitem`: `Enter` na linha muda o caminho, como a estrutura diz.

## Onde a cor de identidade aparece

| Lugar | Como | Token |
|---|---|---|
| Marca | Quadrado cheio, com um brilho de 1 px em cima | `--brand`, `--shadow-mark` |
| **New** na lateral | Botão tonal: texto petróleo sobre véu petróleo. Ação do app sem ser um segundo primário cheio | `--bg-wash`, `--brand-ink` |
| Ação primária | **Allow**, **Retry**, **Send** com texto. Uma por tela | `--primary` |
| Foco | Anel de 2 px por fora, com 2 px de folga na cor da superfície: duas cores e uma forma que a seleção não tem | `--focus`, `--focus-off` |
| Linha aberta | Véu de 13 % (16 % no escuro), anel colado de 1 px e o glifo de tipo em petróleo | `--bg-selected`, `--sel-ring` |
| Links | Texto petróleo com sublinhado permanente de 1 px | `--link` |
| Medidor de contexto | Barra de 4 px, gradiente do petróleo suave ao petróleo, trilho tingido | `--meter`, `--brand-track` |
| Marcador do agente | Disco de petróleo ao lado do nome, cheio (implementador) ou contornado (revisor) | `--bg-wash-conv`, `--brand-line` |
| Etapa atual | Véu, texto e segmentos em petróleo; etapas feitas com visto em petróleo | `--bg-wash-conv`, `--brand` |
| `Ctrl J` | Tecla em petróleo sobre véu | `kbd.jk` |
| Ícones ativos | Glifo da linha aberta, ícone do título, botão de painel pressionado, opção e chip escolhidos | `--brand-ink` |
| Compositor em foco | Borda petróleo e halo de 3 px | `--focus-halo` |
| Tom ambiente | O matiz de toda sombra; no escuro, as superfícies elevadas | `--shade`, `--bg-raised` |
| Agente trabalhando | O spinner, a única coisa em petróleo que se move | `--work` |

Onde ele **nunca** aparece: glifo, chip, faixa ou barra de uma situação. Âmbar é espera, vermelho é erro (com o trilho), verde é encerramento.

## Tokens principais

Claro / escuro, em OKLCH. A lista completa está no topo de cada arquivo e no espécime.

| Token | Valor | Nota |
|---|---|---|
| `--brand` | `0.46 0.085 218` / `0.72 0.085 214` | Branco sobre ele a 6,9:1; tinta escura sobre o do escuro a 8,0:1 |
| `--brand-ink` | `0.44 0.085 218` / `0.78 0.08 214` | Links, texto tonal, etapa atual |
| `--brand-line` | `0.56 0.08 218` / `0.58 0.08 214` | Anel da linha aberta, a 3,7 a 4,7:1 da lateral |
| `--brand-soft` → `--brand` | `0.56` → `0.46` / `0.60` → `0.72` | O gradiente do medidor; o início fica a 3,4:1 (claro) e 3,7:1 (escuro) do trilho |
| `--sel-mix` · `--wash-mix` · `--hover-mix` | 13 · 12 · 6 % / 16 · 16 · 7 % | Véus da linha aberta, do tonal e do hover. O hover leva um traço de petróleo (`--tint-ink`) |
| `--close` | `0.50 0.14 138` / `0.80 0.16 140` | Verde de encerramento, a 0,155 e 0,176 do petróleo |
| `--wait-glyph` | `0.57 0.145 58` / `0.80 0.15 78` | Disco de espera, a 3,2:1 ou mais sobre a linha aberta |
| `--shade` | `0.3 0.035 225` / `0.08 0.012 225` | A cor de toda sombra |
| Lateral · conteúdo, A | `0.956 0.003 75` · `0.997 0.0015 218` / `0.15 0.003 70` · `0.205 0.006 218` | |
| Lateral · conteúdo, B | `0.935 0.016 218` · `0.997 0.0015 218` / `0.165 0.022 222` · `0.2 0.005 218` | |
| `--ink` … `--ink-4` | `0.21 0.012 55` → `0.49 0.006 66` / `0.94` → `0.68` | O calor fica na tinta, como na 05 |
| Tipo | Fira Sans e Fira Code. Caps 11/16, micro 12/16, meta 13/18, UI 14/20, corpo 15/22, leitura 16/26, pergunta e título 18/24, display 22/28, código 13/20 | `--fw-name: 400`, `--fw-name-you: 600` |
| Movimento | `--duration-fast` 120 ms, `-base` 180, `-slow` 280, `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`; zerado por `prefers-reduced-motion` | |
| Raio | 3, 6, 8, 12, 16 px | |

## Resposta às seis condições do `critique.md` da 05

1. **Peso do nome separado do peso da espera.** Nome em 400, espera em 600, na Fira. Nas capturas a 1250 e 2500 px, `Rotate API keys without downtime` (agente trabalhando) e `Retry failed billing webhooks` (espera) se separam de longe. Não foi preciso trocar para a Schibsted.
2. **Foco com forma que a seleção não tem.** Seleção é por dentro: véu e anel colado de 1 px. Foco é por fora: anel de 2 px com 2 px de folga. Na linha aberta em foco, os dois aparecem juntos e não se confundem (espécime, "focus · on the open row"). O mesmo vale para chip, opção, aba e etapa. Campo e compositor, que não têm seleção, usam borda e halo.
3. **Atalho do primário a 4,5:1.** O `1` de **Allow** usa a tinta cheia do botão, com um contorno de 1 px: 6,88:1 no claro e 7,95:1 no escuro. O par está no espécime.
4. **Petróleo longe do verde de encerramento.** 0,155 (claro) e 0,176 (escuro), medidos no espécime a partir das cores pintadas. O anel da linha aberta fica a 0,160 e 0,271 do verde.
5. **Espécime correto e auditoria ampliada.**
   - O contraste compõe camadas dos dois lados do par. O hover contra a lateral agora mede 1,11 a 1,14, não o contraste do texto.
   - A auditoria de caixa (bordas, contornos, corpos, caixas de linha, glifos) acha zero fracionários em 4.290 elementos.
   - A auditoria nova, de geometria, mede posição e tamanho do que a regra de layout posiciona: regiões, colunas centradas, a barra do pedido, o compositor, o cartão, `New messages`, as linhas e os nós da árvore, os glifos na coluna, os medidores da árvore. Todos em pixel inteiro a 1250, 1333 e 2500 px, nas duas variações. Para isso, o trilho do medidor passou a 4 px (o de 3 px centrado caía em meio pixel), a porcentagem ganhou largura fixa, o preenchimento é arredondado para baixo com `round()`, e `New messages` tem largura par, centrada com `round()`.
   - O que segue a largura do texto (botões, chips, o seletor de conversa, a etapa atual, o medidor do topo, que vem depois dos botões de painel) fica com o arredondamento do motor, e o espécime diz isso.
6. **Disco repetido fora da lista de ações.** Saiu das duas linhas (o resumo e a ação). O desvio do spinner na borda direita da linha (`structure.md` §2, linhas 88 e 93), aceito pela crítica da 05, continua e precisa entrar em `decisions.md`.

Os outros pontos da seção 0 da crítica: o glifo de task sem visto (0.6), o gradiente do medidor começando visível (0.7, 3,4:1 do trilho), as sombras soltas em tokens (0.8), o cabeçalho fixo sem linha fantasma (0.9) e `Change path` sem botão aninhado (0.10).

## Desvios da estrutura, declarados

- **Aba sem chip.** `structure.md` §3 diz que a aba mantém o glifo e o chip. Aqui ela mantém só o glifo (8 px), sem o tempo: a barra do pedido e a árvore têm o relógio, e o disco basta para apontar a outra conversa. O tempo continua no nome acessível do glifo (`waiting for you, 18 minutes`).
- **Meta só no hover.** `structure.md` §2 põe `repo#card` na linha 1 com a lateral larga. Aqui ele aparece no hover, no foco e na linha aberta, e está sempre no nome acessível. `Ctrl J` continua sempre visível.
- **Árvore que rola.** Com o respiro novo, a árvore de 14 itens da cena passa da altura de 1040 px por uma linha (`Terraform 1.9 upgrade`), que a 05 ainda mostrava. A estrutura já prevê a árvore rolando (§7, "Muitos itens na árvore"), e o dia cheio do brief tem de 5 a 6 itens. Se a árvore inteira nessa altura for requisito, o respiro volta a 5 px por linha e 20 px entre seções (os tokens `--row-pad-y` e `--section-gap`).

## Como foi testado

Chromium headless no Linux, com FreeType, a 1100, 1250, 1333 e 2500 px de largura, nos dois temas e nas duas abas, olhando cada captura e comparando com a `05/b.html` lado a lado nas mesmas larguras. Os 149 pares do espécime passam nos dois temas das duas variações, e as duas auditorias ficam em zero nas três larguras. A renderização final é do WebKitGTK; a Fira foi escolhida por ter sido desenhada para tela sem suavização, mas precisa ser vista no app.

## Recomendação

**B · Trilho.**

- **É o salto que a 05 não deu.** Na A, a identidade está certa mas mora nos acentos, e de longe a tela ainda lê como a 05 com mais cuidado. Na B, a lateral já é do MySpec: nos dois temas, a primeira coisa que se vê é uma ardósia de petróleo com uma lista calma em cima. É o gesto do Linear (a lateral recua por tom) com a cor do produto, sem gradiente e sem efeito.
- **A hierarquia fica mais clara.** O tom próprio separa navegação e trabalho sem linha, e o conteúdo plano deixa a profundidade só para o que pede atenção: o cartão, a barra do pedido, o compositor. Na A, a folha é bonita a 1250 px, mas a 2500 px ela é quase só margem, como a crítica da 05 já apontou.
- **O custo é pequeno e medido.** A linha aberta sobre a ardósia fica um pouco mais justa que na A (anel a 3,73:1 contra 3,97:1; linha 2 a 4,93:1 contra 5,19:1), e o escuro separa a lateral do conteúdo por pouco (1,07:1, como toda lateral escura do gênero). Todos os pares passam.

O risco da B: é uma lateral fria ao lado de uma tinta quente, o ponto que a crítica levantou contra a ardósia da A da 05. Aqui o conteúdo também leva o matiz 218 (em croma quase nula), então a janela tem uma temperatura só e o calor fica na tinta. Se o usuário sentir a lateral fria demais, a A é a mesma rodada sem essa aposta, e a troca é de quatro tokens de região.

## Dados que faltam

Nada que esta rodada acrescenta pede dado novo. A contagem dos cabeçalhos de seção, o meta no hover e a ampulheta da ação em espera saem do que já chega. Continuam valendo os quatro da rodada 04, na mesma cena:

- **Caminho do arquivo no cabeçalho do bloco de código** (`internal/ratelimit/bucket.go`). O markdown do agente só traz a linguagem da cerca.
- **Código de saída de uma ação** (`exit 1`). `ActionEntry` tem rótulo, alvo e status, sem o código.
- **Duração de uma ação em curso.** Não existe por ação. O tempo do turno é derivável.
- **Ação que espera permissão** (`waits for your permission`, `on hold`). O vínculo é pelo `toolUseId`, só frontend.

## Decisão

2026-09-24. **B · Trilho** é a base da linguagem daqui em diante (o usuário vê pouca diferença entre A e B, mas concorda que B é o melhor até agora). A cor não foi aprovada: o usuário não gostou do tema de cores no geral e pediu uma iteração mais rápida e abrangente, com mais variedade, num seletor de tema. Ele valoriza cores interessantes e visual bonito, sem cara de IA, sem extravagância: tema sólido, consistente e bem pensado. A rodada `07-theme-explorer` faz isso sobre a B, corrigindo antes as condições do `critique.md` que não são de cor.
