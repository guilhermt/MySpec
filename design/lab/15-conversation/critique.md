# Crítica · rodada 15, as entradas da conversa

Crítico, 2026-09-25. Réguas: `decisions.md` (a régua mínima da tela da task e a entrada de 2026-09-25 que abre a rodada), `brief.md` §6, `principles.md`, `system/components.md` (grupo "A conversa"), `screens/task.md` §6 a §9, `research/conversation.md` e `research/references.md`. Quando digo "opinião", a régua não cobre.

Como foi visto: as sete cenas de `a`, `b` e `c` nos dois modos a 1250 e 2500 px (84 capturas), mais capturas altas a 1250 para ver cada conversa inteira, `?open=all` na `long`, `?voice=impl` na `ask`, 1100 e 1600 px por amostragem, e `components.html` inteiro nos dois modos. Por CDP, no Chromium: percurso de teclado real (setas, Tab, `Esc`, `1`), contagem de paradas de Tab, contraste medido no texto renderizado (cor e fundo efetivos, com opacidade) e nos pares de tokens, e a posição em pixel dos glifos. O `?audit` da rodada foi rodado de novo a 1100, 1440 e 1920 px, e passa limpo; os três primeiros problemas comuns abaixo ele não pega.

## Comum às três

Em ordem de gravidade. Valem para qualquer variação escolhida.

1. **As setas sequestram o cartão de pergunta.** Com o foco na opção 1 (depois de **Show**), `↓` tira o foco do `radiogroup` e o leva ao artigo da pergunta; `↓` de novo não sai dali, e `↑` vai à fala de cima. O handler do percurso (`src/conv-common.js:89-100`) só isenta `textarea` e `input`, não `[role=radio]` nem o cartão. Um `radiogroup` que não anda pelas setas quebra o requisito 3 ("respondível pelo teclado") nas três, e cada opção é uma parada de Tab à parte, sem roving.
2. **`1`–`9` não respondem.** Com o foco na opção ou em **Allow**, `1` não marca nada (`aria-checked` segue `false`, nenhum envio). O README promete ("1 a 9 respondem", tabela dos requisitos, linha 3); o mock não demonstra o que o requisito 3 pede.
3. **`undefined%` na cena `retrying`.** A linha da task na árvore mostra `Retrying retrying` e o medidor com `undefined%`, que vaza para fora da lateral (captura a 1250, canto da linha `Rate limit per API key`). Falta `ctx` em `src/conv-data.js:281`. É o tipo de defeito que o usuário chama de amador, na tela que ele vai olhar.
4. **O resumo do subagente sai em mono, como se fosse comando.** `12 actions · Read 7 · Searched 5` usa a classe do comando (`src/conv-common.js:28`, `<span class="ac">${sub.roll}</span>`), enquanto o resumo do grupo usa a sans. Mesmo dado, duas vozes tipográficas, nas três e no espécime.
5. **Glifos em meio pixel.** O spinner do grupo vivo fica em x 588,39 / y 670,45, o da ação em curso em y 828,45, e **Remove** da fila em x 1089,55 (A, `running`, 1250; B e C têm o mesmo). O princípio 10 diz que tudo o que o layout posiciona cai em pixel inteiro, e o README afirma o mesmo; a auditoria mede caixas e não mede o glifo que vem depois de um texto.
6. **"Show" com dois sentidos na mesma tela.** Na barra do pedido, **Show** leva ao cartão; na dobra de um trecho (A e B, `doc.js:47`, `timeline.js:57`), **Show** abre o trecho. Nas duas o chevron ao lado já diz "abre". A C usa **Open all**, uma terceira palavra.
7. **O mermaid tem o rótulo `empty` em cima da seta** (`src/conv-data.js:85`, `x="368"`), nas três e no espécime.
8. **Código longo sem regra.** O bloco de 55 linhas da `running` ocupa mais de uma tela a 1080 de altura e empurra a fala seguinte, a mensagem do produto e o grupo vivo para fora da vista. `components.md` (Bloco de código) só diz "não quebre linhas"; nenhuma das três trata altura. A régua não cobre; registro como lacuna do estado "muitos itens" (`brief.md` §7).
9. **Estados fora da rodada.** Nenhuma cena mostra `Loading the conversation…` com o esqueleto, `Paused by you`, a sessão ociosa nem uma conversa de discussão ou do centro de review. O requisito 7 ("a mesma conversa em task, review e discussão") fica afirmado ("Idem") e não demonstrado. O esqueleto importa: ele depende da forma de cada variação (margem, fio ou cartão).

O que está bom nas três e deve ficar: o rótulo pela descrição com o comando apagado e a duração à direita (a ação finalmente se lê); `· 1 failed, then passed` em tinta (mudança 1, bem justificada pelo princípio 1); `Interrupted by you` como linha sob a fala; `Retried on its own` como rastro de um retry que deu certo; `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8 s` com spinner e sem cor de alarme; o erro com trilho e a ação na barra; a mensagem do produto como marco; e o contraste do texto, medido acima de 5,4:1 em todo lugar (tabela no fim).

## A · Documento

É a única das três que separa os três pesos só por tipografia e espaço: a fala em 16/26 `--ink-1` (17,8:1 no claro), as ações em 13 px `--ink-3`/`--ink-4` (6 a 7:1), o tempo na régua. Lida na `running` e na `long`, é a que mais se parece com um documento técnico bem composto, e a que menos parece um chat. Os problemas:

1. **A régua viola o princípio 6 sem declarar.** "Fios só entre faixas": dentro da região, um fio separa faixas fixas, e dentro de um objeto separa itens. A régua de `--line-2` atravessando a coluna em cada marco (`doc.css:57`, `.dkr`) é um fio dentro da leitura. A seção "Onde a proposta toca o que está registrado" do README lista só `components.md` para a A; a mudança toca `principles.md` §6 e é escolha do usuário. O mesmo vale para o grupo aberto sem o bloco afundado, que o §6 cita como exemplo ("o que é afundado guarda código, grupos de ações").
2. **As réguas viram listras quando os marcos se juntam.** Na `error`, quatro réguas em 250 px (`MySpec → Reviewer pass 1`, `Review 1 written`, `MySpec → Reviewer pass 2`, `Retried on its own`) dominam a metade de cima da conversa, acima da fala do revisor. A régua funciona como cabeçalho de seção quando é rara; o revisor tem 1,45 passada por step e cada passada traz dois ou três marcos (`research/conversation.md` §4), então esse empilhamento é o caso comum do revisor, não um extremo.
3. **A hora aparece em toda entrada, e o tempo fica barulhento.** `dMargin(e)` entra em grupos, marcos, pedidos, erro e atividade (`doc.js:35-44`): na `running`, `14:19` três vezes seguidas (marco, fala, grupo); na `long`, `17:34` e `17:38` duas e três vezes. A margem vira uma coluna de números que compete com o nome de quem fala. O pedido era hora "discreta e suficiente"; a própria rodada já oferece a saída (a hora só quando muda, da B).
4. **O rótulo da dobra corta o número que importa, em qualquer largura.** `MySpec → Implementer Review 1 · 3 findings · round 1 o…` na `long`, a 1250 e a 2500 px. A coluna tem a medida fixa, e `.dfs` em `nowrap` (`doc.css:73`) vence `.dkn` com reticências (`doc.css:56`). É a peça de navegação da sessão longa, e perde o `round 1 of 3`. Isso também invalida, como está, a sugestão de pôr as primeiras palavras da última fala na régua: não há lugar.
5. **O grupo com a ação em espera termina num `·` solto.** `3 actions Read 1 · Make 1 · 1 waits for your permission ·` (`ask`, `?voice=impl`): `.dad::before { content: "· " }` (`doc.css:47`) é emitido mesmo sem duração (`conv-data.js:168`).
6. **Tab passa por cada grupo e cada marco.** "Tab opera" faz de toda linha de ações e toda régua com conteúdo uma parada: 25 paradas na `long` antes de chegar à barra do pedido, contra 13 na B. As setas, que leem, pulam justamente o que se ignora; o custo de chegar ao compositor por Tab fica com o usuário de teclado.
7. **O chevron do subagente fica fora da coluna.** Na `running` e no espécime (`subagent`), o `›` do `Delegated · …` cai à esquerda do fio-guia, na coluna dos vistos das outras linhas.
8. **Carregando e erro da dobra saem da coluna do texto.** No espécime, `Opening 11 entries…` e `Couldn't read this stretch of the conversation` começam na borda da margem, não na coluna (`components.js:18-19`, `.dfold-in` em `doc.css:76`).
9. **A mensagem do usuário fica longe da leitura.** `yes`, `ok` e `You · 09:17` ficam na borda direita, a ~650 px de onde o olho lê a fala, em 12 px `--ink-4`. Opinião: numa sessão de planejamento, em que o usuário responde curto e muito, o salto de olho é o preço da falta de superfície.

## B · Linha do tempo

A mais legível "de relance": descer pelo fio conta a sessão, e o vão tracejado com `16:12 / 16:48` é a melhor dobra de trecho das três (nada corta, o intervalo diz o tamanho). Tem o melhor modelo de teclado: grupos e marcos entram nas setas (`→` abre, `←` dobra) e não em Tab. Mas ela resolve a hierarquia com glifos, não com tipografia, que é o contrário do que o usuário pediu e do que a régua mínima mede. Os problemas:

1. **Um glifo por entrada é cromo novo em toda linha.** Robô em disco de identidade em cada fala (12 na `long`), anel em cada grupo, ícone em cada marco, disco em cada mensagem sua. É o "cada elemento justifica por que existe" (`decisions.md`, 2026-09-24, "A tela da task é mínima") aplicado ao contrário: o fio justifica o todo, mas cada glifo sozinho repete o que o texto ao lado já diz.
2. **Aberto, o grupo vira fileira de pontos.** Na `long` com `?open=all` e na `running`, cada ação ganha um ponto no fio; seis ações abertas são seis pontos de `--line-3` (3,5:1) que pesam mais que a própria linha em `--ink-3`. O que se ignora ganha marcação.
3. **Três spinners para a mesma ação.** Na `running`: o nó do fio, o resumo do grupo e a linha da ação em curso giram juntos, mais o compositor, a aba e a árvore. O princípio 8 fala de um laço por significado; aqui o mesmo "trabalhando" aparece três vezes a 40 px de distância. Na A e na C são dois.
4. **O azul de identidade em cada fala.** O princípio 2 dá ao marcador do agente o azul, mas a B o repete em todas as falas, mesmo seguidas do mesmo agente; a A o põe só quando a vez muda. Em sessão longa a coluna do fio vira uma fileira de discos azuis, e o azul perde a parcimônia que o princípio 2 pede.
5. **Você à esquerda, junto do agente.** A mensagem do usuário fica no mesmo lado, distinta só pelo bloco `--surface-user` (1,14:1 contra o chão no claro, 1,17:1 no escuro) e pelo glifo. O requisito 2 fica apoiado em glifo e numa superfície de contraste mínimo.
6. **A fala perde o nome, e o glifo o substitui mal no streaming.** No streaming o robô vira spinner (`timeline.js:18`): durante a fala em curso, a única marca de quem fala some. O nome só existe no tooltip.
7. **Compete com a árvore.** O âmbar no fio (pergunta, permissão, apontamentos) soma-se ao da barra, ao anel do cartão e ao da aba: quatro sinais âmbar para um pedido. O README reconhece a disputa com a árvore; eu a vejo também dentro da própria tela.

## C · Cartões leves

É a mais familiar e a que mais se parece com um chat genérico: avatar, nome, hora e caixa em cada fala, você à direita numa caixa. É exatamente a cara que o usuário disse não querer. Os problemas:

1. **O pedido deixa de ser impossível de perder.** A pergunta e a permissão são cartões iguais aos da fala, distinguidos só pelo anel `--state-wait-line`, medido a 1,54:1 contra o cartão no claro e 1,85:1 no escuro, e pela sombra. Na `ask` com `?voice=impl` no escuro, o cartão de permissão só se separa das falas acima pelos botões. O requisito 3 é o que a C mais perde, como o README admite.
2. **Contradiz o princípio 6 no uso comum.** O cartão como objeto vira a forma de toda fala, inclusive de `Now let me check X.` (mediana de 64 caracteres no implementador): uma caixa de ~60 px de altura para uma linha. A C está declarada como mudança de princípio; é a razão mais forte contra ela.
3. **Você e o agente têm quase a mesma superfície no escuro.** `--surface-user` contra `--surface-2`: 1,04:1 no escuro e 1,16:1 no claro. Quem fala se distingue pelo lado e pela cabeça, não pela superfície que a variação diz usar.
4. **Duração e hora lado a lado, sem rótulo.** `12 min   13:53`, `1 min 50 s   13:48`, `6 min   14:11` na borda direita de cada linha de ações (`cards.css:56-57`, `cards.js:27`): dois números vizinhos, e só um deles é um intervalo. A hora das linhas fica à direita e a das falas à esquerda, na cabeça.
5. **A sessão longa vira uma parede de caixas.** Na `long`, nove cartões de uma linha empilhados, cada um com avatar, nome, hora, as primeiras palavras e o ícone `⇕` (`cards.js:17`, `I("expand")`), um ícone que nenhum outro disclosure do produto usa. A ideia de ler o passado pelas primeiras palavras é boa; a forma mostra 9 molduras onde a A mostra uma régua.
6. **O cartão dobrado não é um controle.** `<article … aria-expanded="false">` clicável (`cards.js:17`): `aria-expanded` não é um estado de `article`, e o leitor de tela não anuncia que aquilo abre. Os artigos dobrados ficam dentro de uma seção, e não como filhos do `feed` (10 de 14 na `long`), o que tira o padrão de feed exatamente onde ele serve.
7. **A hora do erro entra no detalhe mono.** `exit status 1 · claude --resume 7d1e…c04b · 14:41` (`cards.js:42`): a hora vira parte do comando.
8. **Padding assimétrico no cartão.** `padding: var(--space-3) var(--c-pad) var(--c-pad)` (`cards.css:11`): 12 px em cima e 16 embaixo, mais a margem do último parágrafo; a primeira fala da `running` tem ~40 px de vazio sob a lista.

## Os oito requisitos (`brief.md` §6)

| Requisito | A | B | C |
|---|---|---|---|
| 1. De quem é a vez | Cumpre: a barra, e o marcador da margem em spinner (8 px, discreto) | Cumpre, a mais forte: o último glifo do fio | Cumpre pela barra; o avatar em spinner se perde entre avatares |
| 2. Quem fala | Cumpre: nome só quando a vez muda; você à direita com fio (3,5:1) | Parcial: só glifo; o nome some, e no streaming o glifo vira spinner; você do mesmo lado | Cumpre, pela cabeça; a superfície do usuário não distingue no escuro (1,04:1) |
| 3. Pedido impossível de perder e respondível pelo teclado | Destaque: cumpre, o único bloco com contorno. Teclado: falha nas três (setas no `radiogroup`, `1`–`9`) | Destaque: cumpre. Teclado: falha | Destaque: falha (anel 1,54 a 1,85:1 entre cartões iguais). Teclado: falha |
| 4. Atividade sem afogar a leitura | Cumpre, a maior distância de peso | Parcial: dobrado cumpre; aberto, a fileira de pontos pesa | Parcial: a moldura, não o peso, separa |
| 5. Documentos sem painel | Cumpre | Cumpre | Cumpre |
| 6. Marcos legíveis | Cumpre, forte demais quando se juntam (A2) | Cumpre | Fraco: mesmo peso da linha de ações |
| 7. A mesma conversa em task, review e discussão | Não demonstrado | Não demonstrado | Não demonstrado |
| 8. Legível nas duas larguras | Cumpre de 1100 a 2560; a dobra corta em todas (A4) | Cumpre | Cumpre |

## Acessibilidade, por amostragem

**Contraste do texto**, medido no texto renderizado da `running` com `?open=all` (menor valor por tipo de texto):

| | Claro | Escuro |
|---|---|---|
| Menor texto da A (comentário de código, 13 px) | 5,51:1 | 6,47:1 (hora da margem) |
| Menor texto da B (comentário de código) | 5,51:1 | 6,47:1 (hora do fio) |
| Menor texto da C (rótulo de ação no cartão afundado) | 5,46:1 | 5,72:1 (hora da cabeça) |
| `--ink-1` / `--ink-3` / `--ink-4` sobre `--surface-1` | 17,83 / 7,15 / 6,06 | 14,96 / 8,01 / 6,47 |
| `--state-error` sobre `--surface-0` | 5,46 | 7,14 |
| Fio da pergunta em texto (`--state-wait-ring`) | 4,32 | 9,40 |

**Contraste não textual** (1.4.11 e saliência): anel do cartão de pedido 1,54 (claro) e 1,85 (escuro) contra `--surface-2`, e 1,51 e 2,10 contra o chão; fio do usuário da A e pontos da B (`--line-3`) 3,46 e 3,69; régua da A (`--line-2`) 1,51 e 1,58, decorativa; fio da B (`--line-1`) 1,28 e 1,27, decorativo; cartão da C contra o chão 1,02 e 1,13. O anel abaixo de 3:1 é herdado do system, mas só na C ele é o que separa o pedido do resto.

**Nomes acessíveis.** Nenhum controle sem nome nas três (contagem por CDP). O artigo dos apontamentos (`aria-label="Findings to decide"`) não tem a hora, ao contrário dos outros. Na C, o cartão dobrado é operável sem papel de controle (C6).

**Teclado.** O percurso por setas funciona nas três (`↑`, `↓`, Home, End; `Esc` volta ao compositor), com o anel de foco de 2 px em `--focus` visível. Os problemas são o `radiogroup` e o `1`–`9` (comuns 1 e 2) e o custo de Tab da A (A6).

**Larguras intermediárias.** A 1100, 1440, 1600 e 1920 nada quebra, nada rola na horizontal e o `?audit` passa. A coluna tem a medida fixa, então o único defeito ligado à largura é o corte da dobra da A, que existe em todas.

## Comparação

1. **Hierarquia só por tipografia:** A sim; B por glifos; C por moldura.
2. **Cara de chat genérico:** A não; B não, mas com cromo de linha do tempo; C sim.
3. **Pedido impossível de perder:** A e B sim; C não. Pelo teclado, nenhuma das três como está.
4. **Sessão longa:** a dobra da B é a mais clara; a da A corta o rótulo; a da C vira uma parede de caixas.
5. **Custo ao system:** A muda `components.md` e o princípio 6 (não declarado); B cria um componente novo (o nó) e repete o azul; C muda o princípio 6 no uso comum.

## Recomendação

**A · Documento**, como o designer recomenda, mas combinada de outro jeito:

- **Da B, a hora só quando muda**, e também o **modelo de teclado**: grupos e marcos entram no percurso das setas e não em Tab, e `→`/`←` abrem e dobram. A A hoje lê pelas setas e opera por Tab; a B lê e opera pelas setas com uma parada de Tab só, e resolve A6 sem mexer na forma.
- **Da B, a forma da dobra do trecho**: o intervalo de horas na margem e o tamanho à direita, sem cortar o rótulo. A régua da A pode ficar como forma do trecho, desde que o rótulo inteiro caiba (A4).
- **Da C, nada.** Discordo de pôr as primeiras palavras da última fala na régua: a régua já corta o rótulo que tem.
- **Uma decisão do usuário, com a A escolhida:** a régua é um fio dentro da leitura, contra o princípio 6 como está escrito. Ou o princípio ganha a exceção do marco, ou o marco perde o fio e fica como a linha discreta de `components.md` (e a dobra carrega sozinha o papel de seção). Nos dois casos, o empilhamento de réguas do revisor (A2) é a cena que decide, e deve estar aberta ao lado.

## Veredito

**Não pronto.** As condições, todas pequenas:

1. corrigir o `undefined%` e o `Retrying retrying` da `retrying` (`src/conv-data.js:281`);
2. corrigir o `·` solto do grupo em espera na A (`doc.css:47`) e o corte do rótulo da dobra da A (`doc.css:56`, `:73`);
3. isentar o `radiogroup` e os cartões de pedido das setas do percurso (`src/conv-common.js:89-100`) e ligar `1`–`9` no cartão em foco, para que o requisito 3 possa ser demonstrado;
4. declarar no README, em "Onde a proposta toca o que está registrado", que a régua da A e o grupo aberto sem bloco afundado mudam `principles.md` §6;
5. levar ao usuário, junto das três, a `error` da A lado a lado com a da B, para a decisão sobre a régua.
