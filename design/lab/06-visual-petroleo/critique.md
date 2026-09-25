# Crítica · 06 · Petróleo

A régua:
- `design/brief.md` (§3, §5, §9);
- `design/structure.md` (§2, a linha da árvore; §3, as abas e a barra do pedido);
- `design/decisions.md` (2026-09-24, a cor de identidade);
- `design/research/references.md` (§5 e §6);
- o `README.md` e o `critique.md` das rodadas 04 e 05;
- o `README.md` desta rodada.

Ainda não existem `principles.md` nem `system/`. Onde a régua não cobre, o texto diz que é opinião.

Como foi avaliado. A pasta foi servida pelo `http.server`. Cada variação foi capturada no Chromium headless (Linux, FreeType) a 1250 e 2500 px de largura por 1040 de altura, em `?theme=light` e `?theme=dark`, com as abas do implementador e do revisor. A `05/b.html` foi capturada ao lado, nas mesmas condições. O `?specimen` foi capturado inteiro, e os 160 valores que ele calcula foram lidos do DOM. Por conta própria, medi numa cópia instrumentada, fora do repositório:
- as cores computadas da cena, compostas camada a camada;
- a largura útil e a largura necessária do nome de cada linha da árvore;
- a altura da árvore;
- a geometria das caixas.

Os pares que conferem com o espécime batem a menos de 0,01. Os que o espécime não mede estão na seção 5.

As duas variações dividem o CSS e o script. `diff a.html b.html` dá só os tokens de região (`b.html:94`, `123-124`, `152-153`), a regra de variação (`a.html:680` e `b.html:680`) e o texto do espécime. Os defeitos comuns aparecem nas duas e ficam na seção 0, com a linha de `a.html`, que é a mesma em `b.html`.

## 0. O que é igual nas duas e está errado

Em ordem de gravidade.

1. **"Agente trabalhando" em petróleo põe a identidade num estado, e se confunde com a seleção justamente na linha aberta.** `--work: var(--brand)` (`a.html:158`).
   - Uma task aberta com o agente rodando mostra o spinner de petróleo dentro do véu de petróleo, com o anel de petróleo e o glifo de tipo em petróleo (`a.html:371-372`). O único sinal de estado da linha em que o usuário está fica da cor da seleção.
   - Com `prefers-reduced-motion`, o spinner vira um anel de petróleo parado, de três quartos (`a.html:671`). Sobra a forma, e o movimento, que o README chama de portador, some.
   - Na árvore da cena, o petróleo marca seis coisas diferentes: a marca, **New**, a linha aberta, os dois spinners com os seus medidores, `Ctrl J` e `Change path ↵`. A cor deixa de dizer uma coisa.
   - A decisão de 2026-09-24 diz "nunca no lugar de uma cor de estado", e `brief.md` §7 lista "Agente trabalhando" como estado.

   O README declara o desvio e argumenta bem que não há um segundo matiz livre. Não considerou a saída que a própria paleta sugere: GitHub, pausado e ocioso já são neutros, e "trabalhando" pode ser o quarto estado sem situação em tinta neutra (`--ink-2`), com a forma, o movimento e o texto. Assim a regra do README fica inteira: âmbar, vermelho e verde são o que depende de você, o neutro é o resto, e o petróleo é o MySpec. Opinião quanto à solução; o conflito com a decisão é fato.
2. **O nome perde largura para colunas que não mostram nada, e a 1250 px trunca mais que na 05.**
   - A 1250 px, 5 dos 13 nomes da árvore truncam: `Migrate settings…` (181 de 262 px), `Crash on share sheet…` (196/215), `Rotate API keys…` (139/217), `Retry failed billing webhooks` (181/186) e `Usage-based pricing…` (139/161). Na 05 · B, com a mesma medição, eram 3.
   - Há duas causas. O `column-gap` subiu de 8 para 10 px (`a.html:363`). E o nome ocupa só a coluna 2 (`a.html:811`), mesmo quando a borda direita da linha 1 está vazia. A coluna 3 é dimensionada pelo chip ou pelo medidor das linhas 2 e 3.
   - A 2500 px, o meta escondido por `opacity: 0` (`a.html:380`) continua ocupando a coluna: `Migrate settings page to react-hook-form` trunca em 241 de 262 px ao lado de 56 px invisíveis.
   - `structure.md:69` pede "a largura inteira da linha para o nome". O meta no hover custa largura e não devolve nada.
3. **O cabeçalho de board voltou à caixa alta, o defeito que a 04 apontou e a 05 corrigiu, e agora fica abaixo do épico.**
   - `.node` em 11 px, caixa alta, `--ink-4` e peso 600 (`a.html:339`): `PLATFORM ROADMAP` volta a ser um rótulo de seção, e não o lugar que abre o board (`structure.md:59`; `critique.md` da 04, §2.4).
   - O épico, filho do board, fica em 13 px, caixa normal e `--ink-3` (`a.html:351`). O filho fala mais alto que o pai: 6,29:1 contra 5,50:1 no claro de A.
   - A reversão não está declarada no README.
4. **A árvore perdeu a hierarquia visível entre board, épico e item.**
   - Os itens do épico não recuam mais (`a.html:359`). A guia que os agrupa é um `box-shadow` de 1 px em `--sb-line` (`a.html:358`), a 1,18:1 da lateral em A e a 1,22:1 em B. Não se vê em nenhuma captura.
   - A 1250 px, `Retry failed billing webhooks` (filho do board) e `Rotate API keys…` (filho do épico) estão no mesmo x, sem nada que os separe.
   - `structure.md` §2 descreve uma árvore board › épico › item. O `aria-level` a mantém para o leitor de tela, mas o olho a perde.
5. **O pedido continua repetido, agora em texto em vez de âmbar.**
   - O âmbar caiu de cinco para três lugares na coluna do implementador (aba, cartão, barra), como o README diz. Na mesma tela de 1040 px, porém, `make migrate-local` aparece quatro vezes: no resumo do grupo, `Now: Bash make migrate-local · on hold` (`a.html:930`); na linha da ação, com `waits for your permission`; no comando do cartão; e na barra do pedido, `Bash · make migrate-local · allow or deny in the card` (`a.html:956`).
   - A barra do pedido tem o mesmo peso do cartão: fundo `--wait-bg` a toda a medida, rótulo em 700 e chip (`a.html:574-576`). A 70 px abaixo dele, isso vale nos dois temas. No escuro, são dois blocos marrons iguais.
   - O "lugar de chamada" não é mais quieto que o "lugar forte". Opinião: com o cartão na tela, a barra poderia dizer só `Permission · Implementer · 4m` e **Show**.
6. **Valores soltos onde existe token.** Porcentagens de mistura fora dos `--*-mix`:
   - 22 % nos segmentos e no anel da etapa atual (`a.html:432`, `436`);
   - 28 % no marcador do agente (`a.html:476`);
   - 40 % no contorno do atalho do primário (`a.html:237`);
   - `+ 6%` e `+ 12%` no hover e no pressionado do tonal (`a.html:233-234`).

   E o marcador de lista em `--brand-soft` (`a.html:485`) é petróleo sem papel: não está na tabela dos 13 lugares do README. É decoração.
7. **O medidor de passos da etapa atual não se lê.**
   - Os segmentos futuros ficam a 1,18:1 (claro) e 1,13:1 (escuro) do véu da etapa.
   - O segmento atual fica a 1,52:1 e 1,60:1 dos feitos (`a.html:436-438`).
   - O `3/7` em texto carrega o valor, então não é falha de WCAG 1.4.11. Mas o desenho não distingue o atual do feito, que era o motivo de ter segmentos.
8. **A árvore rola sem dar sinal disso.**
   - A 1040 px, a árvore tem 982 px de conteúdo em 813 de altura. O aviso `infra · clone missing` fica cortado, e `Terraform 1.9 upgrade` some. O README fala de uma linha. São uma e meia.
   - `.sb-tree` (`a.html:330`) não tem sombra nem esmaecido no fim. A estrutura aceita a árvore rolando (§7), mas um item pausado escondido sem aviso é um item esquecido.
9. **`REVIEWS 2 … 4 pending` põe dois números lado a lado** (`a.html:755`, a contagem de `countOf` em `832`). Um conta os reviews ativos, o outro as PRs pendentes. A estrutura só prevê `N pending`. Opinião: a contagem nos nós expandidos é ruído, e aqui ainda ambígua.
10. **O espécime mede o **New** contra a superfície errada.** A linha "Tonal (New) on the sidebar" (`a.html:1076`) mede o texto sobre `--bg-wash`, que mistura o petróleo sobre `--bg-raised` (`a.html:164`), e não sobre a lateral. O véu contra a lateral, que diz se o botão tem corpo, não está no espécime. Ver 2.2.
11. **Menores:**
    - O `role="group"` de cada board é irmão do `treeitem` do nó, e não filho dele nem apontado por `aria-owns` (`a.html:832`). É herdado da 05.
    - A etapa atual, as abas e o **Allow** ficam em x fracionário (406,28, 587,08 e 82,02 px de largura). O README declara que o que segue o texto fica com o motor. O anel de 1 px da etapa atual é o que mais pode borrar no WebKitGTK.

## 1. A · Folha

Em ordem de gravidade.

1. **Não é o salto pedido.** Lado a lado com a `05/b.html` a 1250 px, A lê como a mesma tela:
   - a mesma folha, o mesmo chão e a mesma lateral;
   - o petróleo a mais está em peças de 4 a 16 px: o chip da etapa, os medidores, `Ctrl J` e o **New**.

   A decisão da 05 pedia a presença real da cor de identidade e a lateral reorganizada de fato. Em A, a lateral mudou por respiro e caixa alta (0.3), e a cor ficou nos acentos.
2. **A 2500 px, a folha é quase só margem**, como a crítica da 05 já apontou (§2.4). São cerca de 680 px de branco de cada lado da coluna. O efeito que dá hierarquia a 1250 px vira moldura a 2500.
3. **O **New** tonal quase não tem corpo no claro.** O véu fica a 1,06:1 do chão. No escuro, a 1,65:1, ele se lê como botão.

O que A faz bem:
- é a única das duas em que a lateral e o conteúdo têm a mesma temperatura sem esforço;
- os pares da lateral são os mais folgados da rodada: anel da linha aberta a 3,97:1, glifo de espera a 4,10:1, linha 2 na linha aberta a 5,19:1.

## 2. B · Trilho

Em ordem de gravidade.

1. **No claro, a lateral lê como azul-gelo, e ele empurra o âmbar para a frente.**
   - `oklch(0.935 0.016 218)` (`b.html:94`) é um céu pálido nas capturas, e não uma ardósia. Ao lado de uma conversa quase branca, a janela tem duas temperaturas, o ponto que a crítica da 05 levantou contra o cobalto (§1.2). O próprio README reconhece o risco.
   - Âmbar sobre azul-ciano é contraste de complementares. Os quatro chips âmbar e os quatro discos da árvore saltam mais em B que em A, contra o objetivo da rodada de o âmbar deixar de dominar.
   - No escuro, `0.165 0.022 222` contra `0.2 0.005 218` funciona: uma lateral azul-noite que recua, no gesto que o README atribui ao Linear.

   Opinião, apoiada no feedback da 04 ("um traço de calor é bem-vindo, um tom não"): no claro, B pede metade da croma.
2. **O **New** perde o corpo no claro.** `--bg-wash` é o petróleo a 12 % sobre o branco (`a.html:164`). Sobre a lateral de B, isso dá 1,00:1: o véu tem exatamente o tom da lateral. Na captura a 1250 px, **New** é texto petróleo solto, sem caixa, e parece um link. O texto passa a 6,19:1. O que se perde é a affordance de botão. No escuro, 1,62:1.
3. **Os pares da lateral ficam mais justos que em A.** Todos passam, mas perdem folga:
   - o anel da linha aberta a 3,73:1;
   - o glifo de espera a 3,86:1;
   - o glifo ocioso a 3,53:1;
   - a linha 2 na linha aberta a 4,93:1;
   - o cabeçalho de seção a 5,17:1.

   No escuro, a lateral se separa do conteúdo por 1,07:1 de luminância. É o matiz que faz a separação, e ele funciona.

O que B faz melhor:
- é a única que dá um passo visível em relação à 05: a lateral já é do MySpec antes de qualquer acento;
- no escuro, é a melhor tela que a frente produziu até aqui;
- o conteúdo plano de borda a borda resolve a folha vazia de A a 2500 px.

## 3. Os desvios declarados

| Desvio | Veredito | O que reescrever |
|---|---|---|
| **Aba sem chip** (`structure.md:186`) | **Aceitável.** A aba continua apontando a outra conversa pelo disco e pelo `· Question`, e o tempo fica no nome acessível do glifo (`a.html:946`). Custo: com a aba do revisor aberta, os `4m` da permissão não aparecem em lugar nenhum da tela (a árvore mostra os 18 m, da mais antiga). Condição: um `title` com o tempo na aba | `structure.md:186`: "Cada uma tem o glifo da sua sessão e o que pede; o tempo fica no nome acessível e no tooltip. A barra do pedido e a árvore mostram o relógio." |
| **Meta só no hover** (`structure.md:69`) | **Não aceitável como está.** Custa largura do nome (0.2). Contraria também `brief.md:71`, que põe o repositório e o `#card` "de relance" numa task. Com a lateral larga, há espaço para o meta em `--ink-4`, e ele não é o que pesa na lateral: o peso vem dos chips e da caixa alta | Se for mantido, `display: none` em vez de `opacity`. Nesse caso, a revisão reescreve `structure.md:69` e `brief.md:71` e entra em `decisions.md`. Recomendo manter o meta visível acima de 370 px de lateral |
| **Spinner da borda fora** (`structure.md:88`, `:93`) | **Aceitável**, como na 05. Mas a condição da 05 não foi cumprida: não há entrada em `decisions.md`, e as duas linhas continuam dizendo "spinner pequeno" | `structure.md:88`: borda direita "O tempo do turno, em texto". `structure.md:93`: "O texto na borda direita da linha em que o agente trabalha é o relógio do agente". Mais uma entrada em `decisions.md` |
| **Árvore que rola** | **Aceitável**, com o sinal de rolagem (0.8) | Nada: `structure.md` §7 já cobre |
| **Petróleo em 13 papéis e "trabalhando" em petróleo** | **Metade.** A presença nos papéis de ação (primário, foco, seleção, link, etapa atual, marcador do agente, medidor, sombra) é o que a decisão da 05 pediu, e cada um tem um papel. "Trabalhando" em petróleo não (0.1). O marcador de lista é decoração (0.6) | Uma entrada nova em `decisions.md`, que aponta a de 2026-09-24 e lista os papéis. "Trabalhando" fica fora da identidade |
| **Caixa alta no cabeçalho de board** (não declarado) | **Não aceitável** (0.3) | Voltar à caixa normal da 05, ou declarar e registrar a reversão do ponto 2.4 da 04 |

## 4. As seis condições da 05, conferidas

| Condição | Estado | Como foi conferido |
|---|---|---|
| 1. Peso do nome separado do da espera | **Cumprida.** 400 contra 600 (`a.html:54`). Nas capturas a 1250 e a 2500 px, `Rotate API keys…` e `Retry failed billing webhooks` se separam de longe, nos dois temas | Capturas |
| 2. Foco com forma que a seleção não tem | **Cumprida.** Foco por fora, a 2 px de folga (`a.html:183`); seleção por dentro, com anel colado. No espécime, "focus · on the open row" mostra os dois anéis sem ambiguidade. A cor do foco fica a 1,53:1 da cor do anel (claro): é a forma que separa, como pedido | Espécime, `b-spec` |
| 3. Atalho do primário a 4,5:1 | **Cumprida.** 6,88:1 no claro e 7,95:1 no escuro (`a.html:237`) | DOM da cena |
| 4. Petróleo a mais de 0,15 do verde | **Cumprida, no limite.** 0,155 no claro, 0,176 no escuro. O anel da linha aberta fica a 0,160 e 0,271. A folga no claro é de 0,005 | Medido das cores pintadas |
| 5. Espécime correto e auditoria ampliada | **Cumprida, com ressalvas.** O par do hover agora compõe as camadas (1,11 e 1,13). A auditoria de caixa acha zero fracionários em 4.281 elementos. A de geometria só mede a cena sem `?specimen`, e o README diz isso. Fica sem medir o véu do **New** contra a lateral (0.10) | DOM do espécime e cópia instrumentada |
| 6. Disco fora das linhas de ação e desvio do spinner registrado | **Metade.** O disco saiu: ampulheta neutra e `on hold` (`a.html:525-526`, `930`). O registro em `decisions.md` e a reescrita de `structure.md:88` e `:93` não foram feitos | `decisions.md`, `structure.md` |

## 5. Contraste e distância medidos

Valores na ordem claro / escuro, sobre as cores computadas na cena, a 1250 px.

| Par | A | B | Mínimo |
|---|---|---|---|
| Cabeçalho de seção (`--ink-4`, 11 px) na lateral | 5,50 / 6,85 | 5,17 / 6,71 | 4,5 |
| Linha 2 na linha aberta | 5,19 / 6,98 | 4,93 / 6,71 | 4,5 |
| Texto do **New** sobre o seu véu | 6,19 / 6,11 | 6,19 / 6,11 | 4,5 |
| Véu do **New** contra a lateral | 1,06 / 1,65 | **1,00** / 1,62 | só tom; aqui é o corpo do botão |
| Anel da linha aberta contra a lateral | 3,97 / 4,71 | 3,73 / 4,61 | 3 |
| Cor do foco contra a cor do anel da seleção | 1,53 / 1,74 | 1,53 / 1,74 | a forma carrega |
| Glifo de espera na lateral | 4,10 / 10,34 | 3,86 / 10,13 | 3 |
| Glifo ocioso na lateral | 3,75 / 4,60 | 3,53 / 4,51 | 3 |
| Guia do épico (`--sb-line`) contra a lateral | 1,18 / 1,19 | 1,22 / 1,25 | sem mínimo; não se vê |
| Trilho do spinner contra a lateral | 1,18 / 1,36 | 1,11 / 1,34 | o arco carrega |
| Segmento futuro contra o véu da etapa | 1,18 / 1,13 | igual | o `3/7` carrega |
| Segmento atual contra segmento feito | 1,52 / 1,60 | igual | o `3/7` carrega |
| Lateral contra conteúdo | 1,13 / 1,10 | 1,20 / 1,07 | só tom |
| Barra do pedido contra a conversa | 1,10 / 1,19 | igual | glifo e rótulo carregam |
| Atalho `1` no **Allow** | 6,88 / 7,95 | igual | 4,5 |

| Distância em OKLab | A | B |
|---|---|---|
| Petróleo e verde de encerramento | 0,155 / 0,176 | igual |
| Petróleo e glifo de espera | 0,246 / 0,233 | igual |
| "Trabalhando" e petróleo | **0** / **0** | igual |
| Véu da linha aberta e `--wait-bg` | 0,086 / 0,059 | 0,109 / 0,072 |
| Véu tonal e `--wait-bg` | 0,055 / 0,090 | igual |

Todos os pares de texto e os não textuais com mínimo passam nas duas variações e nos dois temas. Os problemas desta rodada são de hierarquia e de significado, não de WCAG.

## 6. Comparação

- **Salto:** A é a 05 · B com acentos de petróleo. B é o único passo visível, e ele vem de quatro tokens de região.
- **Identidade:** tem presença nas duas e papel em quase todo lugar. Nas duas, "trabalhando" em petróleo quebra a regra de a identidade nunca ser estado, e a lista em petróleo é decoração.
- **Lateral:** está mais calma de longe nas duas (respiro, um elemento por eixo, peso 400/600). Pagou por isso com nomes truncados, com a caixa alta de volta e com a hierarquia do épico invisível.
- **Pedido:** o âmbar recuou de fato (a aba e a lista de ações estão neutras), mas a barra do pedido pesa o mesmo que o cartão, e o comando aparece quatro vezes.
- **Temas:** A é igual nos dois. B é a melhor tela da frente no escuro, e no claro o azul-gelo realça o âmbar.

## 7. Recomendação

**B · Trilho, como o designer recomenda, mas não aprovável como está.** Concordo que é o único salto real e que o escuro de B já está à altura das referências na lateral. Discordo em três pontos:
- "trabalhando" em petróleo;
- o meta no hover;
- a lateral clara na croma proposta.

À altura de Linear, Raycast e Vercel? No escuro de B, na lateral e na conversa, quase. Opinião, pelo que ainda separa:
- a árvore tem cerca de 25 marcas coloridas a 1250 px, entre as de âmbar, vermelho, verde e petróleo;
- os nomes truncam onde há espaço;
- o topo do item, que é da fase 4, ainda são duas faixas densas.

Nas referências, a lateral tem uma cor de sinal por linha e o nome inteiro.

## 8. Condições para aprovar

1. **"Trabalhando" sai do petróleo.** O caminho que recomendo é a tinta neutra (`--ink-2`), com a forma, o movimento e o texto, como GitHub, pausado e ocioso. A alternativa é registrar em `decisions.md` que a identidade passa a ser um estado, com o caso da linha aberta resolvido.
2. **O nome ocupa as colunas 2 e 3 quando a linha 1 não tem meta.** O meta volta a ser visível com a lateral larga, ou sai com `display: none`, com a reescrita de `structure.md:69` e `brief.md:71`. Na cena, nenhum nome deve truncar a 1250 px sem precisar.
3. **O cabeçalho de board volta à caixa normal**, acima do épico em peso ou em tinta, como na 05.
4. **A hierarquia épico › item fica visível:** um recuo ou uma guia a 3:1 ou mais.
5. **A lateral clara de B com metade da croma**, julgada pelo usuário lado a lado com a atual. O **New** ganha corpo sobre a lateral nas duas variações (véu a 1,1:1 ou mais, ou borda), e o par entra no espécime.
6. **A barra do pedido fica mais leve que o cartão** quando o cartão está na tela, e para de repetir o comando.
7. **O registro:** uma entrada em `decisions.md` que revê a de 2026-09-24 (papéis da identidade, spinner da borda, aba sem chip), mais a reescrita de `structure.md:88`, `:93` e `:186`.
8. **A limpeza:**
   - as porcentagens soltas em tokens (0.6);
   - o marcador de lista fora do petróleo;
   - o sinal de rolagem na árvore;
   - o segmento atual distinto dos feitos.
