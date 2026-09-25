# Crítica · rodada 16, a conversa larga

Crítico, 2026-09-25. As réguas são estas: `decisions.md` (a entrada "Conversa: cartões leves como base, coluna mais larga, sem linha do tempo" e a régua mínima da tela da task), `brief.md` §6, `principles.md`, `system/components.md` (grupo "A conversa" e "Tamanhos de layout"), `screens/task.md` §2, §6 a §8, e o `critique.md` da rodada 15. Onde a régua não cobre, escrevo "opinião".

**Como foi visto.** No Chromium headless, com a lab servida numa porta própria:

- as sete cenas de `a` e `b` nos dois modos, a 1250 e a 2560 px (56 capturas);
- `?open=all` na `running` e na `long` a 1250, nos dois modos;
- `?voice=impl` na `ask`, a 1250 e a 2560;
- `components.html` inteiro, em 19 recortes a 1600 px;
- a C da 15 em `running` e `long`, a 1250 e a 2560, para comparar.

Por CDP:

- a largura da coluna e as margens em 13 larguras, de 1100 a 2560;
- os caracteres por linha renderizada, contados caractere a caractere por `Range`;
- o contraste dos pares de tokens resolvidos para sRGB, nos dois modos;
- o percurso de teclado real (Shift+Tab a partir do compositor, setas, `→`/`←`, `1`, `2`, Home, End, `Esc`);
- a árvore de acessibilidade;
- a posição em pixel de glifos e caixas.

## O que a 16 corrigiu da 15

As condições da crítica 15 foram cumpridas: o `radiogroup` anda pelas setas e volta ao início; `1`–`9` respondem na pergunta; o `undefined%` sumiu; o rótulo `empty` do mermaid saiu de cima da seta; o resumo do subagente voltou à sans; a pergunta respondida perdeu o fio. A dobra de trecho não corta mais o número. A hora saiu da cabeça de cada entrada, o grupo vivo dobra, o código longo tem regra (20 de 46 linhas), e a sessão longa virou três linhas no lugar de nove caixas. Na `running`, a conversa dobrada tem 1.259 px, contra 2.017 na C. A comparação lado a lado com a C (`c15-long` e `c15-running`) mostra que as duas são bem mais limpas e fáceis de ler. O pedido central do usuário foi atendido, e o que segue é acabamento e duas escolhas de fundo.

## Comum às duas

Em ordem de gravidade.

1. **O texto de um apontamento passa de 120 caracteres por linha.** O cartão de apontamentos não aplica `--measure-read`: `wide.css:11` limita `p`, `ul` e `h3` dentro de `.prose`, e `wide.css:122` limita só `.card.cv-req .bd`. Medido na `review`:
   - a 1250, 114 caracteres (b) e 115 (a);
   - a 2560, **156 caracteres numa linha** na b (1.192 px) e 115 na a.

   É a única coisa que o usuário proibiu com todas as letras ("sem o texto virar linhas de 120 caracteres"), na cena em que ele decide. O resumo editável tem o mesmo problema.
2. **A hora continua na tela em três lugares.** O README diz "nenhuma hora na tela", mas:
   - `answered 09:19` aparece na pergunta respondida da `planning` (`src/conv-common.js:47`, `<span class="t">answered ${e.answeredAt}</span>`);
   - `went through at 14:34` aparece no marco `Retried on its own` da `error` (`src/conv-data.js:175`);
   - `discarded with the restart at 10:02` aparece no marco desabilitado do espécime (`src/components.js:65`).

   São os três lugares em que a hora voltou como texto corrido, contra o pedido do usuário de não dar importância ao horário.
3. **O texto corrido fica fora do centro no monitor inteiro.** A medida de leitura (42rem) fica presa à esquerda de uma coluna larga e centrada. Medido na `running`, a 2560, o centro do texto fica deslocado para a esquerda do centro da área principal em **184 px na a** e **284 px na b**. Nas falas curtas (`Two findings. I'll sweep idle buckets…`), o que se vê é uma faixa de 1.040 a 1.240 px com uma linha à esquerda e a palavra `Implementer` na outra ponta.

   O usuário descartou a A e a B da 15 por "conteúdo principal descentralizado". Aqui a coluna está centrada, mas o que se lê não está. A 1250 o desvio é pequeno (71 px na b), e isso só aparece no monitor inteiro. Quanto mais larga a coluna, maior o desvio, então a b paga mais.
4. **A largura extra enche pouco.** A 2560:
   - o bloco de Go da `running` tem 1.040 px (a) e 1.240 px (b), e a linha mais longa ocupa cerca de 620 px. Mais da metade do bloco afundado fica vazia (`b-running-light-2560`);
   - o mermaid não cresce (o SVG tem `viewBox` de 640) e fica no meio de uma caixa cinza de 1.240 px (`b-planning-light-2560`);
   - a tabela fica em `fit-content`.

   O que de fato ganha com a largura é a saída de um comando longo e a linha de código acima de 100 colunas, e as duas são raras. Opinião: o argumento do README ("o código ganha a largura") vale até cerca de 1.000 px; acima disso, a largura vira superfície vazia.
5. **`1`–`3` não respondem com o foco na entrada da permissão.** As setas levam o foco ao artigo `Permission, 14:52`. Ali, `1` não faz nada nas duas variações (medido: nenhum `Sending`/`Allow…`). O handler de `src/conv-common.js:148` só procura `[role=radio]`, e a permissão não tem opções. Com o foco dentro do cartão (num botão), o `1` funciona. `screens/task.md` §13 diz "`1`–`9` · Cartão de pergunta ou de permissão · Responde". Na pergunta, o `2` na entrada funciona.
6. **O marco da mensagem do produto e a dobra de trecho têm a mesma cara e abrem coisas diferentes.** Na `long` há três linhas seguidas:
   - `MySpec → Implementer Review 1 · 3 findings · round 1 of 3 · 4 speeches · 44 actions` é a dobra, que abre as entradas;
   - `MySpec → Implementer Review 2 · 1 finding · round 2 of 3` é o marco, que abre o Markdown enviado.

   As duas usam o mesmo ícone do produto, o mesmo chevron e o mesmo peso (`src/wide.js:111` e `:117`). Só o sufixo `· N speeches` distingue as duas, e ele fica fora de vista se cortar. É a peça de navegação da sessão longa.
7. **Um salto de layout perto da metade do monitor.** A palavra do autor vai para cima do texto quando o cartão tem menos de 50rem por dentro (`wide.css:27`). Medido na `running`: a b troca entre 1230 e 1240 px de janela, e a a entre 1100 e 1200. A conversa ganha 44 px de uma vez. Na b, o salto fica a 15 px do 1250 de trabalho do usuário: quem arrasta a janela vê o texto de toda fala com nome pular. A decisão "Largura contínua, não dois pontos" pede uma regra sem degraus visíveis.
8. **O glifo do grupo vivo continua em meio pixel** (crítica 15, comum 5, não corrigido). O spinner do resumo do grupo vivo mede 428,92 × 832,98 (a, 1250), 691,39 × 832,46 (a, 1900) e 497,39 × 832,45 (b, 1600). A palavra do autor também começa em x n,91 em toda largura (`wwho`, alinhada à direita, com a largura do texto). O README afirma "nenhuma caixa em meio pixel", e a auditoria não mede o glifo depois de um texto. Princípio 10.
9. **Papéis ARIA que o leitor de tela não sustenta.**
   - A linha de comando sem saída é um `div` com `aria-label`, focável pelas setas (`src/wide.js:73`). A árvore de acessibilidade dá a ela o papel `generic`, e um `aria-label` num genérico é proibido no ARIA 1.2 e costuma ser ignorado. Na `running` aberta, 7 linhas de comando são anunciadas sem nome.
   - O marco que não abre é `role="separator"` focável (`src/wide.js:110`). Um separador focável é um *splitter* e pede `aria-valuenow`. `components.md` manda `separator` só para o marco que não abre, e ali ele não era parada de foco.
   - Dos 9 filhos do `feed` na `running`, 5 são `details` (papel `group`, sem nome) e só 4 são `article`. O padrão de feed espera artigos.
10. **O carregando e o erro da dobra saem da coluna do texto** (crítica 15, A8, repetido). `Opening 11 entries…` e `Couldn't read this stretch of the conversation` começam na borda da conversa, e não sob o texto da dobra, porque `wide.css:111` não recua `.wfold-in`. O erro da dobra também é o único sem `--state-error-veil`. Os outros quatro erros da rodada têm quatro formas: o marco com véu, a saída com caixa, as ações anteriores em texto e a dobra em texto.
11. **A saída de `cat` e `sed -n` mostra a cabeça do arquivo com `N more lines above`.** Por exemplo, `# Step 3: Token bucket per key` sob `46 more lines above` na `running` aberta (`src/wide.js:49`). O modelo é "a cauda", e o dado do mock ensina o contrário. Pequeno, mas é o que o usuário vai ler para entender a peça nova.
12. **O compositor e a barra do pedido seguem a coluna inteira.** Na b a 2560, a textarea tem 1.278 px, cerca de 160 caracteres por linha em 15 px; na a, 1.078 px. Opinião: escrever uma mensagem longa numa linha dessas tem o mesmo problema de leitura que a fala evitou.
13. **O código cortado perde a rolagem horizontal.** `wide.css:125` põe `overflow: hidden` no `pre` cortado. `components.md` (Bloco de código) diz "rola na horizontal dentro do bloco". Nenhuma linha do mock passa da largura, então hoje não se vê; na b a 1100, com 690 px de bloco, uma linha de 90 colunas sumiria sem aviso.
14. **O início de um grupo fica só no tooltip de um `span`** (`data-tip` em `src/wide.js:86`). Com o foco no resumo, nada aparece; o início existe só no nome acessível. O marco e a fala mostram a hora no foco, e o grupo não.

**A medida de leitura.** O README diz "73 caracteres por linha na fala longa". O que medi foi outra coisa: a linha mais longa tem 96 caracteres na `planning` (`Each API key gets the limit of its plan, checked in the gateway right after the key is resolved:`), 97 na `long` e 95 na `review`, nas duas variações e nas duas larguras. É a medida do system (42rem, princípio 3), a mesma da C, e não é regressão. Mas fica acima dos 50 a 75 que a própria rodada cita (Baymard), e o README não pode dar esse número como medido.

## a · Coluna larga fixa

Em ordem de gravidade.

1. **Toda fala é um objeto elevado.** `--surface-2` com `--shadow-speech` (`a.css:11`) contraria o princípio 6 ("objetos por elevação", "o cartão de permissão é a única superfície com sombra de cartão"). Na `ask` (`?voice=impl`), a 2560 no escuro, cinco cartões elevados cercam o de permissão. Ele se distingue pelo anel âmbar (1,85:1 contra o cartão) e pela sombra maior. O README declara a exceção. Para mim ela não se sustenta: é exatamente a crítica que tirou força da C.
2. **No escuro, sua mensagem e a fala têm o mesmo tom.** `--surface-user` contra `--surface-2`: **1,04:1** no escuro e 1,16:1 no claro. O lado é o único portador de quem fala (crítica 15, C3, que continua valendo aqui).
3. **A sua resposta fica longe da leitura.** A 2560, `ok` fica a cerca de 1.030 px de onde a fala começa (`a-planning-light-2560`), e a hora dela aparece do lado esquerdo do balão, no hover. O README admite.
4. **A palavra do autor fica no canto oposto.** A 2560, `Implementer` fica a 370 px do fim da linha de texto, em `--text-micro` `--ink-3`. Requisito 2 do brief: quem fala é distinguido, mas pela marca mais fraca da tela, no lugar mais distante do olho. Na b é pior em pixels (1.280 de coluna), mas o canto é o mesmo.
5. **O fio entre comandos** (`a.css:18`) é um fio dentro de um objeto, permitido pelo princípio 6. Aberto, com a saída em caixa com fio (`wide.css:90`), o grupo aberto fica com três níveis de contorno: o bloco afundado, o fio entre linhas e a caixa da saída. Opinião: é o trecho mais carregado das duas variações.

O que a a tem de melhor: a coluna para em 1.080, e o texto fica mais perto do centro no monitor inteiro (comum 3). O bloco de comando, com um fio por linha, lê melhor quando aberto.

## b · Fluida com limites

Em ordem de gravidade.

1. **A b também toca o princípio 6, e o README diz que não.** `--surface-speech` fica entre `--surface-1` e `--surface-0` no claro (RGB 249 contra a página 254), ou seja, um passo para o afundado. No escuro fica entre `--surface-1` e `--surface-2` (32 contra 25), um passo para o elevado. O mesmo token muda de direção conforme o modo: no claro a fala lê como recesso, no escuro como objeto. O princípio 6 tem quatro camadas com um sentido cada, e esta é uma quinta, com dois sentidos. A seção "Onde isso toca o que está registrado" precisa dizer isso, e a escolha é do usuário.
2. **O texto fica mais descentrado no monitor inteiro** (comum 3): 284 px a 2560, contra 184 na a. A coluna de 1.280 px tem 60% de área sem prosa nas falas de texto.
3. **Você e o agente do mesmo lado, separados por pouco.** `--surface-user` contra `--surface-speech`: 1,08:1 no claro e 1,09:1 no escuro. A distinção fica com o recuo de 64 px e a palavra `You`, e as duas funcionam (`b-ask-impl-light-1250`). A crítica 15 condenou a B por isso (B5); a diferença aqui é a palavra `You` sempre visível. Aceitável, mas a superfície do usuário não serve de nada no escuro.
4. **O salto do autor está a 15 px do 1250** (comum 7). Entre 1230 e 1240 px de janela, toda fala com nome ganha ou perde uma linha.
5. **O tom da fala mal aparece no claro** (1,05:1). Nas capturas a 1250 no claro, as falas quase se fundem com a página. A separação vem do espaço, o que é a intenção, mas a borda do cartão de fala fica difícil de ver. Opinião: funciona, desde que o ritmo `--space-3` não diminua.

O que a b tem de melhor: a regra contínua, sem número de monitor; a fala sem sombra, com o pedido como único objeto elevado e contornado; `ok` junto da leitura; e as linhas compactas de comando quando dobradas.

## As duas propostas que tocam o registrado

- **O azul deixa de marcar o agente (princípio 2).** Aceitável. É um papel a menos, não um uso errado da cor. Numa conversa só um agente fala, e a aba diz qual. O requisito 2 do brief continua cumprido pela palavra, pela aba e pelo lado. Pede reescrever o princípio 2 (tirar "o marcador do agente") e `components.md` "Avatar e quem fala", cujo "Faça" (distinguir os dois agentes pela forma do avatar) deixa de valer.
- **O cartão elevado da a (princípio 6).** Não aceitável como está. Ele repete na fala a elevação que o princípio reserva ao que pede algo, e é o argumento que a própria rodada usa contra a C. A b também toca o princípio 6, pelo item b1 acima, de forma menor, mas precisa estar declarada.
- **Brief §6, requisito 6** ("marcos legíveis na linha do tempo"). Os marcos continuam legíveis, então está cumprido. O texto do requisito precisa perder "na linha do tempo", pelo pedido do usuário.

## A largura fluida da b, medida

| Janela | Área principal | Coluna b | Margem b | Coluna a | Margem a |
|---|---|---|---|---|---|
| 1100 | 812 | 730 | 41 | 764 | 24 |
| 1250 | 950 | 854 | 48 | 902 | 24 |
| 1600 | 1272 | 1144 | 64 | 1080 | 96 |
| 1900 | 1548 | 1280 | 134 | 1080 | 234 |
| 2560 | 2180 | 1280 | 450 | 1080 | 550 |

A coluna é contínua, sem degrau, e cai em pixel par de 1100 a 2560 (13 larguras medidas). A b chega ao teto em cerca de 1.760 px de janela. O único descontínuo é o salto do autor (comum 7). A 1600 e a 1900 nada quebra nas capturas de medida.

## Componentes novos e estados

- **Comando.** Padrão, hover, foco, aberto, rodando, falha, interrompido, sem saída, carregando e erro estão todos no espécime. O rodando mostra a saída chegando com o cursor. Falta o **pressionado** (`wide.css:68` define `:active` só no `summary`, e o espécime não mostra).
- **Dobra de trecho.** Padrão, hover (com o intervalo), foco, aberto, carregando e erro. O carregando e o erro têm os defeitos de comum 10.
- **Código longo.** Padrão, hover, foco e aberto (`Show less`).
- **Mensagem do usuário.** Padrão, hover, foco, na fila, enviando e não enviada: completa.
- **Pedido respondido.** Chapado, com a hora à vista (comum 2).

Nenhum valor solto onde há token em `wide.css`, `a.css`, `b.css` e `proposed.css`. As durações e as curvas são as do system, e o `prefers-reduced-motion` zera as transições novas (`wide.css:132`).

## Contraste medido (pares de tokens, claro / escuro)

| Par | Claro | Escuro |
|---|---|---|
| `--ink-1` sobre a fala (b / a) | 16,95 / 18,10 | 13,90 / 13,23 |
| Autor `--ink-3` sobre a fala (b / a) | 6,80 / 7,26 | 7,45 / 7,09 |
| Hora `--ink-4` sobre a fala (b / a) | 5,76 / 6,15 | 6,01 / 5,72 |
| `--ink-4` sobre `--surface-0` (comando apagado) | 5,51 | 6,87 |
| `--ink-2` sobre `--surface-1` (saída) | 10,73 | 10,95 |
| `--state-error` sobre `--surface-0` | 5,46 | 7,14 |
| `--focus` sobre a fala (b) | 5,29 | 6,66 |
| Fio da pergunta em texto `--state-wait-ring` sobre a fala (b) | 4,10 | 8,73 |
| Anel do pedido `--state-wait-line` contra a página | 1,51 | 2,10 |
| Fala contra a página (b / a) | 1,05 / 1,02 | 1,08 / 1,13 |
| Sua mensagem contra a fala (b / a) | 1,08 / 1,16 | 1,09 / **1,04** |
| Fio da saída `--line-1` sobre `--surface-1` | 1,28 | 1,27 |

Todo texto passa de 4,5:1. O anel do pedido fica abaixo de 3:1. Ele é herdado do system e agora é o único contorno da conversa, mas nas capturas se destaca pela sombra `--shadow-card` e pelo âmbar. Continua sendo uma decisão do system: `--state-wait-ring` no anel passaria de 3:1.

## Teclado, medido

- **Paradas de Tab na conversa:** 2 na `running` (a entrada da fila e **Remove**), 2 na `ask`, 2 na `long` e 5 na `review`, nas duas variações. Batem com o README.
- **Percurso:** do compositor, Shift+Tab leva à entrada atual. `↑` passa pelo grupo e pela fala; `→` abre o grupo; `↓` entra nos comandos (`Show 5 earlier actions`, o comando, o subagente); Home vai ao primeiro marco, End ao último, e `Esc` volta ao compositor. O anel de foco de 2 px está sempre visível.
- **Pergunta:** `↓` escolhe a 2 e volta ao início depois da 3; `1` escolhe a 1; `Enter` envia (`Sending "Yes, by client IP…"…`); `2` na entrada escolhe a 2.
- **Permissão:** `1` na entrada não responde (comum 5).

## Comparação

1. **Espaço aproveitado:** as duas usam bem a metade do monitor (95% e 90%); no monitor inteiro, as duas alargam mais a caixa do que o conteúdo, e a b mais.
2. **Limpeza:** as duas são muito mais limpas que a C. A b é a mais calma, com a fala sem sombra; a a é um chat de cartões elevados.
3. **Centralização:** a a desloca a prosa 184 px a 2560, a b 284 px, e as duas ficam centradas a 1250.
4. **Registro:** a a quebra o princípio 6 no uso comum; a b o toca com um token de direção dupla, não declarado; as duas tiram o azul do agente, o que é aceitável.
5. **Acabamento:** comum às duas: apontamentos a 114–156 caracteres, a hora em três lugares, `1` na permissão, glifo em meio pixel, papéis ARIA e a dobra carregando fora da coluna.

## Recomendação

**b**, como o designer recomenda, com duas diferenças:

- **O teto da coluna.** O pedido era "mais larga sem descentralizar". A regra da b resolve bem até cerca de 1.600 px de janela. Acima disso, o que cresce é a caixa vazia à direita da prosa (comuns 3 e 4). Proponho levar ao usuário a b com o teto em discussão: `--measure-conversation-max` de 80rem, como está, ou perto de 67,5rem (o da a). A captura a 2560 das duas, lado a lado, na `planning`, é a que decide. Minha opinião: o teto da a com a forma da b.
- **O princípio 6.** A b deve declarar que `--surface-speech` é uma camada nova, com direção oposta nos dois modos (b1). A alternativa sem mudar o princípio é a fala sem tom nenhum, só com espaço, e ela não foi mostrada.

Da a, nada além do teto. O fio entre comandos pesa no grupo aberto (a5), e a sua mensagem à direita, a mil pixels da leitura, é o custo que a b resolve.

## Veredito

**Não pronto.** As condições, todas pequenas e sem redesenho:

1. aplicar `--measure-read` ao texto e ao resumo do cartão de apontamentos (comum 1);
2. tirar a hora do texto visível: `answered 09:19` (`src/conv-common.js:47`), `went through at 14:34` (`src/conv-data.js:175`) e `discarded with the restart at 10:02` (`src/components.js:65`) (comum 2);
3. fazer `1`–`3` responderem com o foco na entrada da permissão (`src/conv-common.js:148`) (comum 5);
4. distinguir a dobra de trecho do marco da mensagem do produto na `long` (comum 6);
5. corrigir o README:
   - o "73 caracteres" (medido: 95 a 97);
   - o "nenhuma hora na tela";
   - o "nenhuma caixa em meio pixel";
   - declarar que a b toca o princípio 6 (b1).

Depois disso, levar ao usuário a `planning` e a `running` das duas a 2560 lado a lado, com a pergunta do teto da coluna. Os comuns 7 a 14 podem ir para a implementação como pauta, sem segurar a rodada.
