# Crítica · 05 · Variações da B

Régua: `design/brief.md` (§1, §5, §6, §9, §10), `design/structure.md` (§2, a linha da árvore), `design/decisions.md` (2026-09-24, a cor de identidade), `design/research/references.md` (§3, os princípios do §5, os eixos do §6), o `README.md` e o `critique.md` da rodada 04, com o feedback do usuário na seção Decisão, e o `README.md` desta rodada. Ainda não existem `principles.md` nem `system/`. Onde a régua não cobre, o texto diz que é opinião.

Como foi avaliado: a pasta foi servida pelo `http.server`, e cada variação foi capturada com Chromium headless no Linux, com FreeType, a 1250 e 2500 px de largura e 1040 de altura, em `?theme=light` e `?theme=dark`, com a aba do implementador e, a 1250 px, com `?tab=reviewer`. O `?specimen` de cada uma foi capturado inteiro, e os 57 pares que ele mede foram lidos do DOM. O contraste foi medido também por conta própria, com uma conversão de OKLCH para sRGB sobre os tokens dos arquivos: os pares do espécime conferem com os meus a menos de 0,02 (por exemplo, `--ink-4` sobre a lateral de A: 5,17 contra 5,18). Os pares que o espécime não mede estão na seção 5, junto com a distância de cor (ΔE em OKLab) entre a identidade e os estados.

As três variações compartilham o CSS inteiro e só trocam os tokens e três linhas de bloco de variação (`a.html:637-640`, `b.html:637-640`, `c.html:640-645`). Os defeitos do CSS compartilhado aparecem nas três e ficam na seção 0, com a linha de `a.html`. Nos outros arquivos, a mesma regra está na mesma linha ou até três abaixo.

## 0. O que é igual nas três e está errado

Em ordem de gravidade.

1. **O negrito de "espera por você" ficou diluído.** O nome de toda linha tem peso 500 (`a.html:346`), e a linha que espera tem 600 (`a.html:347`). O destaque da estrutura é "uma linha que espera pelo usuário tem o nome em negrito" (`structure.md:94`). Com 500 como base, o sinal é um degrau de peso. Em B, a Fira a 500 já lê como negrito: na captura a 2500 px, `Rotate API keys without downtime` (agente trabalhando) e `Retry failed billing webhooks` (espera) têm o mesmo peso aparente. Em A e C, a diferença existe, mas é pequena. O "nome dominante" que o usuário pediu foi obtido às custas de um dos portadores do "depende de mim".
2. **Foco e seleção usam o mesmo vocabulário.** O foco da árvore é um contorno de 2 px em `--brand` (`a.html:341`). A linha aberta é um anel de 1 px em `--brand-line` com o véu da identidade (`a.html:343`), no mesmo matiz. O primeiro Tab na árvore cai justamente na linha aberta (`tabindex="0"`, `a.html:768`), e ali o foco só engrossa o anel. No espécime, as células "focus" e "active · the open row" da linha da árvore são duas caixas com borda azul. O mesmo acontece no chip (`a.html:249-250`) e na opção do cartão (`a.html:519-520`). Passa no WCAG 2.4.7 porque algo muda, mas o indicador é mais fraco justamente onde aparece primeiro.
3. **O atalho dentro do botão primário não passa no contraste.** `.btn.primary .k` usa `--primary-on` a 75 % (`a.html:211`). O `1` de **Allow**, em mono de 12 px, fica a 3,77:1 em A, 3,98:1 em B e 3,97:1 em C no tema claro, contra 4,5:1 (WCAG 1.4.3). O espécime não mede esse par. No escuro passa (4,85 a 5,29).
4. **A mesma espera aparece cinco vezes na coluna do implementador.** A 1250 px, a permissão está:
   - na aba, com disco e chip `4m` (`a.html:900`);
   - no resumo do grupo de ações, com disco (`a.html:884`);
   - na linha da ação, com disco;
   - na faixa do cartão (`a.html:858`);
   - na barra do pedido, com disco e chip (`a.html:912`).

   O README diz que a linha da ação ficou neutra e perdeu o tempo, mas ela ainda tem o disco, e o resumo também. Somados aos seis chips âmbar da árvore, o âmbar virou a cor dominante da tela. O calor saiu dos neutros e voltou como massa de âmbar semântico. A 04 já apontava o pedido repetido quatro vezes (§4).
5. **O espécime mede errado um par, e a auditoria de pixel vê menos do que o README diz.**
   - A linha "Hover wash vs sidebar" (`a.html:1019`) passa `--bg-hover@--bg-sidebar` como cor de frente, mas `ratioIn` só compõe camadas no fundo (`a.html:979-980`). `var(--bg-hover@--bg-sidebar)` é inválido, o `span` herda `--ink`, e a linha mostra 14,68, 15,43 e 17,57, exatamente o valor de "Name on the sidebar". O valor real é 1,11 a 1,19:1. Não muda veredito (é "tone only"), mas o espécime é a prova da rodada e tem um número falso.
   - A auditoria (`a.html:1112-1121`) confere bordas, contorno, corpo, entrelinha e o tamanho de `.st`. Ela não vê `.newmsg`, centrado com `left: 50%` e `translateX(-50%)` (`a.html:535`), que cai em meio pixel sempre que a pílula ou a coluna tem largura ímpar (brief §9). Também não vê o preenchimento do medidor em porcentagem de 28 px (`a.html:290`, `733`): 44 % dá 12,32 px. O "zero fracionário" do README vale só para o que ela mede.
6. **O glifo de task é uma caixa com um visto.** `i-task` (`a.html:645`) tem o mesmo visto de `i-check`, que marca etapa feita (`a.html:660`, `804`) e cartão respondido (`a.html:1093`). É a marca mais repetida da lateral: 7 das 14 linhas da árvore começam com ela, e a One-Shot usa a mesma caixa. Os ícones são provisórios desde a 04, mas a lateral está sendo julgada com eles. Opinião: é o que mais pesa na coluna esquerda vista de longe, e diz "feito" num item em curso.
7. **O gradiente do medidor é decoração que apaga os valores pequenos.** Ele começa em `--ink-3` a 45 % (`a.html:61`), a 1,83:1 (claro) e 2,27:1 (escuro) do trilho. A 17 % (`Usage-based pricing tiers`), o preenchimento tem cerca de 5 px, quase todos no tom de partida. A porcentagem em texto carrega o valor, então não é falha de acessibilidade. É um efeito que não ajuda a hierarquia.
8. **Sobram valores soltos onde existe escala de sombra ou token:**
   - `0 1px 1px oklch(0 0 0 / 0.04)` no botão (`a.html:194`);
   - a sombra do primário a 30 % (`a.html:207`);
   - `oklch(1 0 0 / 0.12)` na marca (`a.html:300`);
   - a sombra da barra do pedido a 18 % (`a.html:541`);
   - `0.2em` e 45 % no sublinhado do link (`a.html:168`).

   São quatro sombras fora de `--shadow-*`.
9. **O esmaecido do cabeçalho fixo deixa uma linha fantasma.** O gradiente de `.cv-head::after` (`a.html:423`) deixa a última linha do bloco de código acima meio visível. A 1250 px, em B e C, `return true` aparece esmaecido logo abaixo das abas, e lê como defeito de renderização.
10. **`Change path` é um botão dentro de um `treeitem`** (`a.html:777-778`). Com `tabindex="-1"` ele não atrapalha o teclado (o `Enter` da linha muda o caminho, como a estrutura diz), mas o leitor de tela expõe um controle aninhado que não se alcança.

## 1. A · Cobalto

Em ordem de gravidade.

1. **O aqua de "trabalhando" encosta no verde de encerramento.** No escuro, `--work` é `0.78 0.10 200` e `--close` é `0.78 0.13 155`: mesma luminosidade, ΔE de 0,092 (0,116 no claro). Na lateral escura a 2500 px, o spinner de `Rotate API keys` e o anel de `Haptics on complete` são dois anéis ciano-esverdeados de 10 px. Com `prefers-reduced-motion`, o spinner vira um anel aqua de três quartos (`a.html:630`) ao lado de um anel verde inteiro. A forma ainda separa os dois, mas a cor, o terceiro portador, fica ambígua. O README admite o custo de tirar o azul do "trabalhando". O custo é maior do que ele descreve.
2. **Uma lateral fria contra uma página quente.** A lateral tem matiz 259 e croma 0,008 (`a.html:84`, `110`), e os neutros da página têm matiz 75. Nas capturas, a lateral lê como ardósia azulada (no escuro, azul-marinho) ao lado de uma conversa em branco quente. O usuário pediu um traço de calor, e A põe um tom frio ao lado dele: duas temperaturas na mesma janela. Opinião, apoiada no feedback.
3. **O cobalto chama a atenção pela linha aberta.** A `0.53 0.19`, o cobalto é a coisa mais saturada da tela depois do âmbar. O anel da linha aberta (`0.58 0.16`) é o contorno mais forte da lateral e puxa o olho tanto quanto os chips de erro. Não há confusão de significado (ΔE de 0,33 para o âmbar), mas há disputa de atenção: o ponto 1 da C da 04, com menos intensidade. É também, como o README reconhece, a cor de menos caráter das três.
4. **O par mais justo da rodada.** O disco âmbar sobre a linha aberta fica a 3,10:1 no claro. Passa, mas é o glifo com menos folga.
5. **A Schibsted a 12 e 13 px.** Rende firme no FreeType e é a família que melhor separa 500 de 600 (ver 0.1). Nesses corpos, porém, ela se parece com qualquer grotesca do gênero, e o caráter só aparece de 18 px para cima. Opinião.

## 2. B · Petróleo

Em ordem de gravidade.

1. **A Fira achata o destaque de espera.** O problema 0.1 é o pior aqui. A Fira a 500 já é pesada, e a linha aberta, as linhas que esperam e as linhas em que o agente trabalha têm o mesmo peso aparente. Como está, o destaque de `structure.md:94` não se lê na lateral de B.
2. **O petróleo é vizinho do verde de encerramento.** A distância é de 0,094 no claro e 0,097 no escuro, a menor entre a identidade e um estado em B. Os dois aparecem como contorno de 1 px na árvore: o anel da linha aberta e o chip `2h`. A forma e a área os separam. Mas "50 graus e croma" (README) é menos distância do que parece no claro, onde `--close` (`0.46 0.11 155`) e `--brand` (`0.50 0.085 205`) são dois verde-azulados escuros.
3. **No escuro, o primário e o "trabalhando" têm a mesma luminosidade.** `--brand` (`0.75 0.09 200`, `b.html:112`) e `--work` (`0.75 0.12 252`, `b.html:114`) ficam a 0,096. O **Allow** cheio e o spinner são dois cianos claros. Os papéis e as formas são diferentes, então é menor.
4. **A 2500 px, a folha é quase só margem.** São cerca de 2.200 px de branco com a conversa de 800 px no centro, e o efeito fica só nas bordas (8 px de chão e raio de 12 px, `b.html:639`). Não atrapalha, mas "o item é o objeto" se lê melhor a 1250 px do que a 2500. O topo continua com os três eixos da 04 (título à esquerda, conversa ao centro, ferramentas à direita), que é da fase 4.

O que B faz melhor que as outras:
- a folha, o único efeito da rodada que ajuda a hierarquia nas duas larguras e nos dois temas: a lateral recua sem tom próprio nem linha;
- a cor com mais caráter e menos ruído: croma baixa, longe do âmbar (0,22 a 0,24) e do vermelho;
- a Fira Code com as ligaduras desligadas em todo lugar técnico (`a.html:175`).

## 3. C · Oliva

Em ordem de gravidade.

1. **A oliva compete com o âmbar no escuro.** `--brand` é `0.77 0.10 120` e o glifo de espera é `0.80 0.15 78`, a 0,105, o par identidade-estado mais próximo da rodada. Nas capturas:
   - **Allow** é um cáqui ao lado da faixa âmbar;
   - o anel de foco da aba (espécime) é um contorno amarelo-oliva em volta de chips âmbar;
   - a linha aberta, no escuro, lê como uma linha tingida de espera.

   O véu da linha aberta fica a 0,031 (claro) e 0,035 (escuro) de `--wait-bg`: a seleção tem praticamente o tom da espera. Isso fere o critério da decisão ("nunca no lugar de uma cor de estado", `decisions.md`, 2026-09-24) e a árvore por cor como "depende de mim" (brief §5).
2. **A hierarquia de superfícies está invertida.** A lateral é papel (`0.997`, `c.html:84`), tão clara quanto a coluna de leitura. O topo do item fica no chão (`--bg-head` igual a `--bg-app`, `0.962`). A navegação vem para a frente, e o título do item fica na superfície mais funda da janela. No escuro, a mesma coisa: lateral `0.205` sobre chão `0.165` (`c.html:111`). Contraria o princípio 1 de `references.md` §5, "a lateral recua e a conversa manda".
3. **A Atkinson falha a 12 px no FreeType.** O pingo do `i` quase some: `ios#312` lê `los#312`, e o mesmo acontece em `infra`, `Read failed` e `idle` (meta e borda direita da árvore). O zero cortado entra no texto corrido: `5Ø concurrent requests`, `Reject with 4Ø1`. O argumento da família (cada letra pela forma) falha justamente no corpo e no lugar para que ela foi escolhida.
4. **Mover o encerramento para esmeralda não comprou distância.** A oliva e o encerramento ficam a 0,083 no claro e 0,082 no escuro (`c.html:88`, `115`), a menor distância identidade-estado da rodada. E fazer a paleta de status depender da identidade é um acoplamento frágil para o system (ver seção 8).
5. **A 1250 px, o topo e a coluna não se alinham.** O topo fica no chão, alinhado à esquerda (x ≈ 316), e a coluna, centrada, com cerca de 60 px de chão de cada lado (x ≈ 360). O README admite.
6. **Uma linha entre regiões** (`c.html:642`), contra a premissa comum da rodada: "regiões separadas por tom e por superfície, sem linhas entre elas".

O que C faz melhor que as outras:
- a coluna de leitura elevada a 2500 px, a leitura mais bonita da rodada em tela cheia.

## 4. O que a 04 pediu e a 05 entregou

Conferido por amostragem nas capturas e nos números da seção 5.

| Item da 04 | Estado |
|---|---|
| 0.1 Âmbar numa ação rodando | Resolvido. `running` usa `--work`, e as palavras são neutras (`a.html:490-494`) |
| 0.2 Bordas fracionárias nos glifos | Resolvido nos glifos. Restam `.newmsg` e o medidor (0.5) |
| 0.3 Pares abaixo do mínimo | Resolvido: `--deco` de 3,51 a 3,87 (claro) e de 3,53 a 3,81 (escuro); anel do chip de espera de 3,55 a 4,25; borda de controle de 3,16 a 3,49 |
| 0.4 Estados que faltavam | Resolvido: carregando e desabilitado são visuais diferentes. Na linha da árvore, "active" é a linha aberta: o pressionado (`.it:active`, `a.html:340`) não aparece na grade |
| 0.5 Dois primários | Resolvido: **Send** neutro com a caixa vazia (`a.html:941-944`) |
| 0.6 Ação com cara de metadado | Resolvido |
| 0.7 Valores soltos | Parcial (0.8) |
| 0.8 `-webkit-font-smoothing` | Resolvido: zero ocorrências nos três arquivos |
| B.1 Linha aberta pouco marcada | Resolvido, com anel de 3,59 a 3,99:1 (claro) e de 4,53 a 4,74:1 (escuro). Mas o anel e o foco agora se confundem (0.2) |
| B.2 a B.9 | Resolvidos. A seta do nó de board só aparece no hover e no foco (`a.html:320-321`). A árvore inteira e o rodapé cabem em 1040 px nas três |
| Topo: futuro que sumia, segmento âmbar | Resolvido. As futuras mantêm o nome a 1250 px, e o segmento atual é tinta (`a.html:400`) |
| Topo: o pedido repetido | Não resolvido: cinco vezes, contra quatro na 04 (0.4) |

## 5. Contraste e distância medidos

Pares que o espécime não mede, calculados sobre os tokens. Os valores vêm na ordem A / B / C, claro e depois escuro.

| Par | Claro | Escuro | Mínimo |
|---|---|---|---|
| Atalho `1` sobre o primário (`.btn.primary .k`, 12 px) | **3,77** / **3,98** / **3,97** | 4,85 / 5,29 / 5,25 | 4,5 |
| `--ink-4` sobre a faixa de espera (`asked 14:31`) | 5,70 nas três | 5,25 nas três | 4,5 |
| Foco sobre a barra do pedido | 4,94 / 5,25 / 5,10 | 6,08 / 7,05 / 7,46 | 3 |
| Anel da linha aberta contra o próprio véu | 3,15 / 3,27 / 3,49 | 3,82 / 4,01 / 3,72 | 3 |
| Hover contra a lateral (o espécime mostra o contraste do texto, 14,68 a 17,57) | 1,11 / 1,11 / 1,12 | 1,15 / 1,14 / 1,19 | só tom |
| Linha aberta contra linha em hover | 1,03 / 1,03 / 1,02 | 1,03 / 1,04 / 1,05 | o anel carrega |
| Início do gradiente do medidor contra o trilho | 1,83 | 2,27 | sem mínimo, o número carrega |
| Trilho do spinner contra a lateral | 1,25 / 1,28 / 1,46 | 1,82 / 1,82 / 1,65 | o arco carrega (3,97 a 4,83 no espécime) |
| Halo de foco contra o campo | 1,43 / 1,43 / 1,39 | 1,81 / 1,93 / 1,99 | a borda de 1 px carrega |

Pares do espécime conferidos, os mais justos:
- disco âmbar sobre a linha aberta: 3,10 / 3,24 / 3,73 (claro);
- glifo ocioso sobre a lateral: 3,53 / 3,71 / 4,23;
- borda do filtro: 3,16 / 3,25 / 3,49;
- `--ink-4` sobre linha em hover: 4,66 / 4,87 / 5,57.

Todos passam.

A distância entre a identidade e os estados é o ΔE em OKLab. Opinião sobre a leitura: abaixo de cerca de 0,10, duas cores leem como da mesma família num olhar rápido.

| Par | A (claro / escuro) | B | C |
|---|---|---|---|
| Identidade e glifo de espera | 0,332 / 0,301 | 0,238 / 0,218 | 0,155 / **0,105** |
| Identidade e encerramento | 0,251 / 0,217 | **0,094** / **0,097** | **0,083** / **0,082** |
| Identidade e "trabalhando" | 0,163 / 0,132 | 0,122 / **0,096** | 0,223 / 0,202 |
| "Trabalhando" e encerramento | 0,116 / **0,092** | 0,216 / 0,190 | 0,201 / 0,172 |
| Véu da linha aberta e `--wait-bg` | 0,095 / 0,081 | 0,072 / 0,063 | **0,031** / **0,035** |

## 6. O desvio declarado: o spinner da borda direita

`structure.md:88` pede "spinner pequeno e o tempo do turno, em texto" na borda direita, e `structure.md:93` descreve o relógio do agente como "o texto depois do spinner". O designer tirou o spinner pequeno.

**É aceitável.** As razões:
- dois spinners na mesma linha são o ruído que o usuário pediu para cortar;
- a linha já diz "rodando" pela forma: a linha 3 (verbo e medidor) só existe com o agente rodando;
- as formas continuam diferentes: chip para o relógio do usuário, texto solto para o do agente;
- o nome acessível mantém `agent working` (`a.html:732`).

**Com duas condições:**
- a revisão entra em `decisions.md` e reescreve `structure.md:88` e `:93`, porque uma decisão tomada no mock e não registrada não existe (`design/README.md`);
- a revisão reconhece o custo. O `3m` agora é texto de 12 px em `--ink-3` (`a.html:285`), no mesmo registro do `idle` e do `GitHub` que ocupam a mesma coluna (`a.html:354`). Longe do spinner da linha 2, ele pode ser lido como "atualizado há 3 minutos". Opinião.

## 7. Comparação

- **Calor:** os neutros deixaram de ser bege nas três. A acrescenta uma lateral fria, e nas três o âmbar semântico, repetido, virou a cor dominante da tela.
- **Identidade:** o cobalto é genérico e disputa atenção. O petróleo tem caráter e parcimônia, e o risco dele é o verde do encerramento. A oliva se confunde com o âmbar no escuro e falha o critério da decisão.
- **Tipo:** a Schibsted separa bem 500 de 600, mas é genérica nos corpos pequenos. A Fira tem caráter e rende limpa, mas achata o negrito da espera. A Atkinson falha a 12 px (o `i`, o `Ø`).
- **Lateral:** a organização é a mesma nas três e é melhor que a da 04 (respiro, um elemento por linha no eixo direito, cabeçalho calmo). O peso que resta vem da coluna de glifos de caixa com visto e dos chips âmbar. A recua por tom, B por superfície, e C inverte a ordem.
- **Efeitos:** a folha de B ajuda a hierarquia. A coluna de C ajuda a 2500 px e atrapalha a 1250 px. O gradiente do medidor e o halo são decoração.

## 8. Recomendação

**B · Petróleo**, como o designer recomenda, com condições que a rodada ainda não cumpre. A razão é a mesma dele: a folha é o único efeito que organiza a tela nas duas larguras, e o petróleo é a única identidade com caráter que não compete com o âmbar nem com o vermelho. Discordo em um ponto: a Fira não está pronta como está, porque apaga o negrito que a estrutura usa para "espera por você".

Antes de B virar `principles.md` e `system/`:

1. **Separar o peso do nome do peso da espera.** Nome comum em 400 e espera em 600 na Fira. Se no WebKitGTK a Fira 400 contra 600 ainda não separar as linhas de longe, a troca é pela Schibsted (A), que já separa 500 de 600. É a única recombinação que eu recomendo testar.
2. **Dar ao foco uma forma que a seleção não tem.** Hoje os dois são contornos da identidade (0.2).
3. **Levar o atalho do primário a 4,5:1** no claro (0.3).
4. **Afastar o petróleo do verde do encerramento.** Hoje estão a 0,094. A régua é medir de novo e passar de 0,15, como a identidade já fica do âmbar.
5. **Corrigir o par do hover no espécime** e estender a auditoria a posições e larguras (0.5).
6. **Tirar o disco das duas linhas de ação** que repetem a permissão (0.4), e registrar o desvio do spinner (seção 6).

Os três eixos não são tão independentes quanto o README diz. A identidade decide `--work` (em A ele vira aqua e encosta no encerramento) e `--close` (em C ele vira esmeralda). Por isso não recomendo "a folha de B com o cobalto": ela traz o aqua de A e o problema 1.1 junto.

## 9. O que levar das descartadas

- **De A:**
  - a Schibsted, como reserva tipográfica, caso a Fira não separe os pesos (condição 1);
  - nada do cobalto nem da ardósia.
- **De C:**
  - a coluna de leitura elevada, para avaliar na fase 4 só em telas largas e alinhada ao topo do item: é a melhor leitura a 2500 px;
  - nada da oliva, da Atkinson nem da paleta de status que muda com a identidade.
