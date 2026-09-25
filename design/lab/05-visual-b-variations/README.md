# 05 · Variações da B

Fase 3, fundação visual. Três variações a partir da direção B da rodada 04, vestindo a mesma cena: a task `Rate limit per API key` na implementação no modo `Agent`, step 3 de 7, com o revisor perguntando e o implementador esperando permissão, e a árvore inteira. A rodada decide duas coisas: **a linguagem visual do MySpec** e **a cor de identidade** (`decisions.md`, 2026-09-24).

O que é igual nas três vem da B: regiões separadas por tom e por superfície, sem linhas entre elas; cor só como sinal; dois registros de densidade, o compacto do cromo e o de leitura da fala do agente. O que muda de uma para outra são três eixos: a cor de identidade, a família tipográfica e o tratamento da barra lateral.

## Como abrir

- Sirva a pasta (`python3 -m http.server 8090 -d design/lab`) e abra `05-visual-b-variations/a.html`, `b.html` e `c.html`. Para comparar: `compare.html?a=05-visual-b-variations/a.html&b=05-visual-b-variations/b.html`.
- `?theme=dark` ou `?theme=light` fixa o tema. Sem o parâmetro, vale o do sistema.
- `?tab=reviewer` abre a conversa do revisor, com a pergunta. Sem ele, abre a do implementador, com a permissão. As abas funcionam no clique.
- `?specimen` mostra só o espécime, que também fica no fim de cada página.
- O selo `05 · A ▴` no canto inferior direito é do mock, não da interface.

O espécime de cada página traz a cor de identidade com a razão, a escala de tipo, os neutros, **o contraste medido na hora** de todos os pares de texto (28) e não textuais (31) nos dois temas, a grade de estados de cada componente, a árvore linha a linha, as peças da conversa que não aparecem na cena e uma **auditoria de pixel** que percorre a página e procura bordas, contornos, corpos e caixas de linha fracionários.

Testado no Chromium headless a 1250, 1333 e 2500 px, nos dois temas e nas duas abas. As três passam em todos os pares: texto a 4,5:1 ou mais, glifos, anéis e bordas a 3:1 ou mais. A auditoria acha zero valores fracionários nas três, também a 1333 px, onde o clamp da lateral daria 306,64 px.

## As três variações

| | A · Cobalto | B · Petróleo | C · Oliva |
|---|---|---|---|
| **Ideia** | A lateral recua por tom | Uma folha sobre o chão | Papel sobre a mesa |
| **Lateral** | Tom próprio, alguns degraus mais escuro que o trabalho, com um traço do matiz da identidade (uma ardósia). As regiões se encontram sem linha | Sem superfície própria: fica no chão da janela. O item aberto é uma folha elevada, com canto arredondado e sombra suave, a 8 px das bordas | A superfície mais clara, de papel, com um fio na borda. O topo do item fica num chão mais fundo, e a conversa é uma coluna de leitura elevada desse chão, arredondada em cima |
| **Cor de identidade** | Cobalto, `oklch(0.53 0.19 259)` | Petróleo, `oklch(0.50 0.085 205)` | Oliva, `oklch(0.51 0.09 122)` |
| **"Agente trabalhando"** | Aqua, matiz 200, porque o azul virou identidade | Azul, matiz 252, como na 04 | Azul, matiz 252. Encerramento vai para esmeralda (162) |
| **Família** | Schibsted Grotesk e JetBrains Mono | Fira Sans e Fira Code | Atkinson Hyperlegible Next e Mono |

### A · Cobalto

**Cor.** Um azul elétrico na linha das ferramentas em que o dia passa (Linear, Vercel). Lê como "aqui você age" sem explicação, fica longe do vermelho do erro, do âmbar da espera e do verde do encerramento, e é nítido sobre um neutro com traço quente. É azul puro (259), não o índigo do shadcn (277) nem o violeta da C da 04 (292). O custo é real: o azul deixa de poder dizer "agente trabalhando", que vira aqua. É a mais familiar das três e, por isso, a de menos caráter próprio.

**Tipo.** Schibsted Grotesk é uma grotesca desenhada para texto de jornal: aberta, firme a 12 e 13 px, com ritmo bom a 16 px de leitura. JetBrains Mono é a mono que o app já usa, alta e clara sem suavização.

**Lateral.** É o princípio do Linear levado adiante ("a lateral foi escurecida alguns degraus", `references.md`): recua por tom, com matiz próprio. No claro, a lateral fica em L 0,935 contra 0,993 da conversa, mais funda que na B da 04 (0,945). No escuro, 0,16 contra 0,205.

### B · Petróleo

**Cor.** Um azul-esverdeado profundo, a cor de tinta de caneta e de cobre oxidado: técnico e calmo, raro entre ferramentas de desenvolvimento (nem o azul de SaaS nem o violeta de IA), e complementar ao traço quente dos neutros. A croma é baixa de propósito (0,085), então lê como uma tinta escolhida, não como um sinal. Fica longe do vermelho e do âmbar. Do verde do encerramento fica a 50 graus, separado também pela croma: o verde é mais vivo e só aparece como glifo ou chip contornado. "Trabalhando" continua azul, o spinner que o `critique.md` da 04 elogiou.

**Tipo.** A Fira foi desenhada para telas pequenas sem suavização (Firefox OS): humanista, com x-height alta, clara a 12 px, quente na leitura longa a 16/26 numa medida de 42 rem. A Fira Code é a mono da mesma família, então rótulo e código dividem o esqueleto. As ligaduras de código ficam desligadas (`!=` não vira `≠`), porque a conversa mostra o que o agente escreveu.

**Lateral.** A superfície faz a separação. A lateral não tem fundo próprio: a marca, o filtro, a árvore e o rodapé ficam no chão da janela, e o item é o objeto sobre ele. É a "profundidade por camadas de superfície" de `references.md`, com uma camada só. Nas duas larguras, a folha dá à conversa uma borda clara sem nenhuma linha.

### C · Oliva

**Cor.** Um verde terroso que puxa para o quente: o traço amarronzado dos neutros levado um passo adiante, até virar cor. É sóbrio e incomum em software, e lê como ofício, não como sinal. O risco é o lugar: fica entre o âmbar da espera e o verde do encerramento. Por isso esta variação move o encerramento para esmeralda (162) e mantém a oliva de croma baixa, nunca num glifo. A terracota ficou de fora nas três: cai entre o vermelho do erro e o âmbar da espera, e acento quente sobre neutro creme é justamente o visual que a 04 foi pedida para deixar.

**Tipo.** A Atkinson Hyperlegible foi desenhada para legibilidade (Braille Institute): cada letra se distingue pela forma (`I l 1`, `O 0`), que é o que uma linha de status e um caminho pedem a 12 px sem suavização. Tem caráter sem ornamento e uma mono própria. O zero cortado e o `i` com cauda aparecem também no texto corrido, o que pode incomodar como fonte de interface.

**Lateral.** Papel e chão. A coluna de leitura é literalmente o objeto elevado, o que reforça que a conversa é a tela central (`brief.md` §6). Em 2500 px é a mais bonita das três. Em 1250 px sobram cerca de 60 px de chão de cada lado, e o topo do item (no chão, alinhado à esquerda) não se alinha com a coluna (centrada), o terceiro eixo que o `critique.md` da 04 já apontava no topo, agora mais visível.

## A barra lateral, igual nas três

A estrutura da linha (`structure.md` §2) não mudou. Mudou a hierarquia visual:

- **Grade de três colunas** em toda linha: glifo, texto, borda direita. O glifo de tipo (linha 1) e o de estado (linha 2) ficam na mesma coluna de 16 px, um sob o outro. Todo texto começa no mesmo x, e toda borda direita termina no mesmo x.
- **Nome dominante:** 14 px, peso 500, tinta cheia. Com o usuário esperado, peso 600. A seleção não põe negrito.
- **Segunda linha calma:** 13 px, `--ink-3`, ou `--ink-2` quando a linha espera por você. O `+N` saiu do eixo direito e fica colado ao rótulo.
- **Terceira linha mais quieta:** 12 px em mono, `--ink-4`, com o verbo em `--ink-3`. O medidor de contexto à direita, com gradiente suave.
- **Meta e chips secundários:** `api#412` em 12 px e `--ink-4`. O chip de espera deixou de ser âmbar sólido: é um tom âmbar claro com um anel de 1 px a 3,5:1, ainda "cheio" contra o "contornado" do encerramento. O de erro é um tom vermelho claro, quadrado, com `!`. O âmbar e o vermelho continuam sendo a única cor forte da árvore.
- **Um elemento por linha no eixo direito:** meta na linha 1, relógio na 2, contexto na 3.
- **Seções com respiro:** 20 px entre os boards. O cabeçalho de seção é discreto, em caixa normal (13 px, 600, `--ink-3`), e mostra a seta de "abrir o board" no hover, o que devolve ao nó a cara de lugar que a versalete da 04 tirava. Os itens de um épico pendem de uma linha-guia.
- **A linha aberta:** véu da identidade a 10 % (12 % no escuro) e anel de 1 px na identidade, a 3,6:1 ou mais sobre a lateral nas três. É a única cor de identidade na árvore.

**Desvio da estrutura, declarado.** `structure.md` §2 põe na borda direita da linha com o agente trabalhando "spinner pequeno e o tempo do turno". Tirei o spinner pequeno: a mesma linha já começa com o spinner de estado, e dois spinners na mesma linha são o tipo de competição no eixo direito que o usuário pediu para cortar. O relógio do agente continua com forma diferente do relógio do usuário (texto solto contra chip) e com o nome acessível `agent working`. Se a decisão for mantê-lo, é uma linha de CSS.

## Tokens principais

Claro / escuro, em OKLCH. A lista completa está no topo de cada arquivo e no espécime.

| Token | Comum às três | A · Cobalto | B · Petróleo | C · Oliva |
|---|---|---|---|---|
| `--bg-sidebar` | | `0.935 0.008 259` / `0.16 0.01 259` | `0.952 0.003 75` / `0.15 0.003 70` (é o chão) | `0.997 0.001 80` / `0.205 0.003 80` |
| `--bg-conv` | | `0.993 0.0015 75` / `0.205 0.003 70` | `0.995 0.001 75` / `0.205 0.003 70` (a folha) | `0.997 0.001 80` / `0.215 0.003 80` (a coluna) |
| `--bg-app` (chão) | | = lateral | = lateral | `0.962 0.003 80` / `0.165 0.003 80` |
| `--brand` | | `0.53 0.19 259` / `0.72 0.14 256` | `0.50 0.085 205` / `0.75 0.09 200` | `0.51 0.09 122` / `0.77 0.10 120` |
| `--brand-line` (anel da seleção) | | `0.58 0.16 259` / `0.58 0.13 257` | `0.57 0.08 205` / `0.58 0.08 202` | `0.59 0.085 122` / `0.60 0.09 121` |
| `--bg-selected` | `color-mix` da identidade sobre a lateral, 10 % / 12 % | | | |
| `--work` | | aqua `0.54 0.10 200` / `0.78 0.10 200` | azul `0.55 0.15 252` / `0.75 0.12 252` | azul, como B |
| `--ink` … `--ink-4` | `0.21 0.012 55` → `0.49 0.006 66` / `0.94` → `0.68` | | | |
| `--line-control` | `0.63` / `0.54`, a 3:1 ou mais sobre o fundo do campo | | | |
| `--err` · `--wait-glyph` · `--close` | vermelho 27 · âmbar 58 · verde 155 | | | encerramento esmeralda 162 |
| `--wait-chip` · anel | `0.935 0.06 85` com anel `--wait-glyph` / `0.33 0.07 78` | | | |
| Família UI e leitura · mono | | Schibsted Grotesk · JetBrains Mono | Fira Sans · Fira Code | Atkinson Hyperlegible Next · Mono |
| `--measure-read` | | 40 rem | 42 rem | 40 rem |
| Tipo | 12/16, 13/18, 14/20, 15/22, leitura 16/26, pergunta e título 18/24, display 22/28, código 13/20 | | | |
| Raio | 3, 6, 8, 12, 16 px | | | |
| Movimento | 120, 180, 280 ms, `cubic-bezier(0.2, 0, 0, 1)`; zerado por `prefers-reduced-motion` | | | |

Os neutros: matiz 75 com croma de 0,0015 a 0,004 nas superfícies, baixa demais para parecer bege. O calor é um traço na tinta (matiz 55 a 66, croma até 0,012), um preto amarronzado, não uma página amarelada.

## Resposta ao `critique.md` da 04

### Seção 0, o que era comum às três

1. **Âmbar numa ação rodando.** Na lista de ações, a cor fica só no glifo. `running` tem o spinner em `--work`, `waits for your permission` tem o disco âmbar, e as palavras são neutras nos dois casos. O espécime mostra o grupo com uma ação rodando.
2. **Bordas fracionárias nos glifos.** Os glifos têm 10 px, o losango 8 px, e as bordas 1 ou 2 px (`--bw`, `--bw-2`), sem `calc` de fração, `scale()` ou `translate`. As caixas de linha são inteiras (`--lh-*` em rem múltiplos de 1 px). A largura da lateral é arredondada para baixo com `round(down, clamp(...), 1px)`, e as colunas centradas, com `round()` na margem. A auditoria do espécime confirma zero valores fracionários.
3. **Pares não medidos abaixo do mínimo.** `--deco` a 3,5:1 ou mais no topo. O chip de espera ganhou anel a 3,5:1 ou mais. A borda do campo, do filtro e do compositor (`--line-control`) está a 3,1:1 ou mais. Todos estão agora no espécime, com o anel da linha aberta, os glifos sobre a linha aberta e a borda tracejada do desabilitado.
4. **Estados que faltavam no espécime.** Todos entram:
   - a barra do pedido de erro, com trilho e **Retry**, e a de decisão, com o progresso;
   - o bloco de erro da conversa, com trilho;
   - a opção do cartão em foco, escolhida, desabilitada, enviando e com erro;
   - a aba de conversa em foco, com erro, desabilitada e iniciando;
   - os cartões de pergunta e de permissão respondidos;
   - `New messages`, a mensagem na fila com **Remove**, `Thinking…` e `Retrying (attempt 2)…`;
   - os marcadores de interrompido e de contexto compactado;
   - o compositor preenchido, pausado e desabilitado com a razão.

   Carregando e desabilitado agora são visuais diferentes: carregando mantém a cor e ganha spinner ou brilho, e desabilitado é tracejado e apagado.
5. **Dois primários cheios.** **Send** fica neutro com a caixa vazia e vira primário quando há texto. Na cena, o único primário é **Allow**.
6. **Ação com cara de metadado.** **Change path** é um botão pequeno com borda. `Bash` é uma etiqueta em mono, sem borda.
7. **Valores soltos.** Viraram tokens: `--act-k`, `--key-w`, `--composer-min`, `--list-indent`, `--code-pad-*`, `--glyph-diamond`. A interface não tem mais `style` inline de apresentação. Os que restam passam um dado (a porcentagem do medidor de contexto, `--p`) ou montam o espécime.
8. **`-webkit-font-smoothing`.** Saiu.

### Seção 2, a B

1. **Linha aberta pouco marcada.** Anel de 1 px na identidade, a 3,6:1 ou mais (de A), com o véu da identidade, e sem negrito. O negrito volta a querer dizer só "espera por você".
2. **Chip desabilitado sem borda.** Borda tracejada em `--line-control`, a 3:1.
3. **Links iguais ao texto.** Links na cor de identidade com sublinhado permanente de 1 px. O breadcrumb também é sublinhado.
4. **Nós de board em versalete.** Caixa normal, com a seta de abrir no hover.
5. **Peso 600 do código não carregado.** As três carregam a mono em 400, 500 e 600.
6. **Título do item do tamanho da fala.** Título a 18 px e 600, fala a 16 px e 400.
7. **Árvore perdia a última linha.** A árvore inteira e o rodapé cabem em 1040 px de altura nas três, com o respiro novo entre as seções.
8. **Cartão bloqueante identificado pela elevação.** Faixa de cabeçalho no tom da situação (de A) e anel de 1 px em `--wait-line` no cartão inteiro, que o identifica também no escuro. Respondido, a faixa fica neutra.
9. **A serif.** Saiu. A fala do agente mantém o registro de leitura por corpo (16/26), medida (40 a 42 rem, cerca de 75 caracteres, contra 90 a 109 na 04) e entrelinha, na sans de cada variação.

### Seção 4, o topo (proposta da 04, mantida)

- **O futuro sumia na metade do monitor.** Abaixo de 1240 px de área principal, só as etapas feitas encolhem para o `✓`. As futuras (`PR › PR review › Closing`) mantêm o nome, e o círculo está a 3,5:1 ou mais.
- **O segmento atual repunha a situação na linha 2.** O segmento atual agora é tinta, não âmbar: é posição, não situação.
- **O pedido quatro vezes.** A linha da ação na lista ficou neutra e sem o tempo. Continuam a aba, o cartão e a barra do pedido. O resto do topo (três eixos a 2500 px, ferramentas do step presas ao seletor) é da primeira tela da fase 4 e não mudou aqui.

## Recomendação

**B · Petróleo.**

- **A cor é a que tem mais caráter com menos ruído.** O petróleo é sóbrio e próprio. A croma baixa o mantém longe de parecer um sinal, e ele deixa o azul livre para "trabalhando", que era a melhor ideia de status da 04. O cobalto é seguro mas genérico, e custa o azul do trabalho. A oliva é bonita mas mora entre os dois estados mais importantes e obriga a mexer no verde.
- **A folha é o efeito que mais ajuda a hierarquia.** A lateral no chão recua sem precisar de um tom próprio, e o item vira o objeto da tela nas duas larguras e nos dois temas. É o princípio "a estrutura se sente, não se vê" (`references.md` §5) com uma camada só. A lateral da A recua bem, mas é o que a B da 04 já fazia, mais forte. O papel da C brilha em 2500 px e desalinha o topo em 1250 px.
- **A Fira é a família com mais chão no WebKitGTK.** Foi feita para tela sem suavização, e a Fira Code fecha o par sem uma segunda voz.

Os três eixos são tokens independentes e podem ser recombinados. Se a escolha for "a folha da B com o cobalto" ou "a B com a Schibsted", a troca é de `--brand`, `--work` e `--font-*`, sem tocar no resto.

## Dados que faltam

Nada que esta rodada acrescenta pede dado novo. Continuam valendo os quatro da rodada 04, que aparecem na mesma cena:

- **Caminho do arquivo no cabeçalho do bloco de código** (`internal/ratelimit/bucket.go`). O markdown do agente só traz a linguagem da cerca.
- **Código de saída de uma ação** (`exit 1`). `ActionEntry` tem rótulo, alvo e status, sem o código.
- **Duração de uma ação em curso.** Não existe por ação. O tempo do turno é derivável.
- **Ação que espera permissão** (`waits for your permission`). O vínculo é pelo `toolUseId`, só frontend.

Os estados novos do espécime usam o que existe. O cartão respondido mostra `header: answer` e `Allowed for this session`, como `QuestionCard` e `PermissionCard` já fazem. A opção enviando e a opção com erro dependem só da promessa de `answerQuestion` no frontend. A fila e **Remove** são o `PendingMessage` de hoje.

## Decisão

2026-09-24. Não foi ao usuário. O coordenador adotou a base recomendada por designer e crítico, **B · Petróleo** com a Fira (Schibsted como reserva), mas julgou a rodada tímida: a cor de identidade quase não aparece, a barra lateral continua densa e o âmbar de espera virou a cor dominante da tela. A rodada `06-visual-petroleo` parte da B com as seis condições do `critique.md`, presença real da cor de identidade, a lateral reorganizada de fato e menos repetição do pedido na tela.
