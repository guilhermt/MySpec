# 15 · As entradas da conversa

Fase 4, rodada dedicada, aberta pela decisão de 2026-09-25 ("Plano de implementação e mudanças sensíveis confirmados"). As rodadas 09 e 10 decidiram a conversa como parte da tela da task. Esta rodada a trata como objeto próprio. Ela refina as entradas e não reabre o que `screens/task.md` fixou: a estrutura da tela, o stepper, as abas, a barra do pedido e o compositor ficam como na 10-b, em volta de cada variação.

**A pergunta.** Como cada tipo de entrada se apresenta para que uma sessão real seja lida sem esforço? Uma sessão real tem dezenas de falas, centenas de ações e várias perguntas. A resposta precisa separar três pesos:

- o que o usuário precisa ler: a fala do agente, a pergunta, a permissão e o erro;
- o que ele pode ignorar: as ações;
- o que marca o tempo: os marcos.

A cor entra só como sinal.

**A régua.** É a mesma da tela mínima: cada elemento justifica por que existe. Nas três variações ficam iguais o conteúdo (as mesmas entradas, de `src/conv-data.js`), os componentes de pedido (o cartão de pergunta e o de permissão, o bloco de erro, o cartão de apontamentos) e a volta ao fim. Muda o tratamento das entradas, que é a ideia de cada variação.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **A · Documento**, nas sete cenas |
| `b.html` | **B · Linha do tempo**, nas mesmas cenas |
| `c.html` | **C · Cartões leves**, nas mesmas cenas |
| `components.html` | Cada entrada das três variações em todos os estados, claro e escuro lado a lado, e as peças compartilhadas (linha de ação, volta ao fim, mermaid) |
| `src/` | As fontes, descritas abaixo. `python3 design/lab/15-conversation/src/build.py` gera as páginas e confere que cada uma traz `design/system/tokens.css` byte a byte |

As fontes em `src/`:

- `base.css`, `core.css`, `core.js`, `content.js`, `m.css`, `m.js`, `stepper.js`, `shell.css` e `shell.js` são a tela da 10-b, copiadas. Três mudanças, todas nesta pasta: a troca de cena (`content.js`), o gancho `V.conv` na conversa (`m.js`) e os seletores da auditoria (`core.js`).
- `conv-data.js` tem as entradas como dados, e `conv-common.js` e `conv.css` têm o que as três compartilham.
- `doc.*` é a variação A, `timeline.*` a B e `cards.*` a C.

## Como abrir

Sirva a lab (`python3 -m http.server 8090 -d design/lab`) e abra `15-conversation/a.html`, `b.html` e `c.html`. O seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros:

- `?scene=`: `planning`, `running` (o padrão), `ask`, `long`, `error`, `retrying` ou `review`;
- `?theme=light` ou `?theme=dark`;
- `?voice=impl` ou `?voice=rev`, para abrir a outra conversa do step;
- `?focus=N`, para pôr o foco de teclado na entrada N do percurso (`-1` é a última);
- `?open=all`, para abrir todos os grupos e marcos;
- `?audit`, para o relatório de geometria, corte, nomes, contraste, texto `undefined`/`NaN`, texto que vaza da região e paradas de Tab da conversa;
- `?kbtest`, para um percurso de teclado roteirizado (Show, setas e `1`–`9` no cartão, `Enter`, setas no percurso, `→` e `←` num grupo), escrito no relatório;
- `?clean`, para esconder o seletor.

Tudo o que a conversa mostra é clicável: os grupos, os subagentes, os marcos, as dobras, **Show earlier actions** e a volta ao fim. Com o foco na conversa (clique numa entrada ou `Tab` até ela), as setas percorrem as entradas.

## As três ideias

### A · Documento

A conversa se lê como texto corrido. É a ideia de um documento anotado. Esta é a versão depois da crítica (ver "Depois da crítica").

- **Margem e coluna.** Uma margem de 88 px à esquerda diz quem e quando. A coluna de texto diz o quê.
- **A fala do agente** não tem cartão nem fundo, e é o único texto em 16/26 e `--ink-1`.
  - Na margem vem o marcador de quem fala: cheio no implementador, anel no revisor, na identidade, como o princípio 2 manda.
  - O nome aparece só quando a vez muda, e a hora só quando muda. Uma fala logo depois de outra entrada do mesmo minuto mostra só o marcador e o nome; duas falas seguidas do mesmo agente, só a hora. A hora exata fica no tooltip e no nome acessível.
- **As ações** são uma linha fina, dobrada, entre as falas, em 13 px e `--ink-3`/`--ink-4`: `› 21 actions Read 8 · Searched 4 · 1 failed, then passed · 12 min`. Abertas, ganham o bloco afundado do system.
- **A mensagem do usuário** fica à direita, sobre um fio vertical, sem balão: `You · 14:28` em cima e o texto em 15/22. Na fila, o fio fica tracejado.
- **O marco** é a linha discreta de `components.md`: o ícone, o texto em `--ink-2`, o complemento em `--ink-3` e o chevron quando abre. Não há régua nem fio dentro da leitura, e a hora vai na margem.
- **Um retry que deu certo** entra na linha do grupo de ações que vem depois dele (`· ↻ retried on its own · 2 attempts`), e não numa linha própria. Assim os marcos do revisor não se empilham: na cena `error`, no máximo duas linhas seguidas.
- **Pergunta e permissão** são os únicos blocos com contorno. O erro tem o trilho vermelho.
- **Sessão longa.** O que já passou se dobra atrás dessa mesma linha. O intervalo de horas vai na margem (`16:12` / `16:48`), e o rótulo inteiro vem com o tamanho: `MySpec → Implementer Review 1 · 3 findings · round 1 of 3 · 4 speeches · 44 actions ›`. O rótulo quebra a linha em vez de cortar.
- **Teclado.** O modelo é o da B:
  - as setas andam por todas as entradas (falas, grupos, marcos, dobras, pedidos);
  - `→` abre um grupo, um marco ou uma dobra, e `←` dobra;
  - a conversa é uma parada de Tab só, mais os controles da entrada atual.

### B · Linha do tempo

Uma coluna estreita à esquerda tem um fio vertical com um glifo por entrada. A hora fica no fio e o conteúdo, à direita.

- **O glifo diz quem é e em que estado está:**
  - o agente é um disco com o robô (cheio no implementador, anel no revisor);
  - você é um disco neutro com a pessoa;
  - o produto é o seu ícone;
  - um marco é o ícone dele;
  - um grupo de ações é um anel pequeno;
  - a ação em curso é o spinner;
  - uma pergunta ou uma permissão é o disco âmbar;
  - um erro é o losango.
  
  Descer os olhos pelo fio conta a sessão sem ler o texto.
- **Sem nomes sobre as falas**: o glifo já diz quem fala.
- **A hora** aparece no fio só quando muda. A hora exata fica no tooltip e no nome acessível.
- **Um grupo de ações é um nó.** Dobrado, é uma linha. Aberto, cada ação vira um ponto pequeno no mesmo fio, e a falha ou a ação em curso ganham o próprio glifo no ponto.
- **A mensagem do usuário** fica à esquerda, no fluxo, num bloco claro de `--surface-user` ao lado do glifo.
- **Sessão longa.** Um trecho do passado vira um vão tracejado do fio, com o intervalo de horas na coluna do tempo (`16:12 / 16:48`) e o tamanho (`5 speeches · 71 actions`). Um clique abre o trecho.
- **Teclado.** As setas andam de nó em nó, `→` abre um nó e `←` o dobra.

### C · Cartões leves

Cada fala do agente e cada mensagem do usuário ficam num cartão de superfície sutil.

- **O cartão da fala** usa `--surface-2` com o aro de `--shadow-xs` e tem na cabeça o avatar, o nome e a hora.
- **O cartão do usuário** usa `--surface-user`, à direita.
- **Ações e marcos** ficam fora dos cartões, como linhas compactas alinhadas ao texto de dentro deles. A hora vai à direita da linha.
- **Pergunta e permissão** são cartões com o anel âmbar e `--shadow-card`. Ganham uma cabeça (quem e quando, sem faixa) quando a fala logo acima não diz isso.
- **A densidade é maior**: `--space-3` entre as entradas, contra `--space-6` na A e `--space-5` na B.
- **Sessão longa.** Cada fala de um trecho passado vira um cartão de uma linha, lido pelas primeiras palavras (`Implementer 16:15 The metrics package already registers a requests_total counter…`). As ações desse trecho somem na cabeça dele (`5 speeches · 71 actions · 16:12–16:48`), com **Open all**.
- **Teclado.** As setas vão de cartão em cartão, e `Enter` abre um cartão dobrado.

## As cenas

A task é a das rodadas 09 e 10: `Rate limit per API key`. Os volumes seguem `research/conversation.md` §4.

| Cena | O que mostra | Números |
|---|---|---|
| `planning` | O agente do PRD. Uma pergunta em texto já respondida (`yes`), uma pergunta estruturada respondida, um `ok`. Uma fala longa com cabeçalhos, lista, tabela e mermaid, que termina na pergunta em texto que espera, com a resposta rápida no compositor | 8 ações em 2 grupos; respostas de 2 e 3 caracteres (a mediana do planejamento é de 2 a 8) |
| `running` | O implementador do step 3, na rodada 1. Grupos dobrados. O grupo vivo aberto, com a ação em curso e um subagente aninhado. A mensagem do produto como marco. Código longo com o caminho. Uma mensagem na fila | 46 ações em 3 grupos, mais 12 do subagente; 3 falas; 1 falha que depois passou |
| `ask` | A cena da 10-b: o revisor, na passada 2, pergunta num cartão, e o implementador espera uma permissão (`?voice=impl`) | 31 ações na passada 2 |
| `long` | O step 6 depois de duas rodadas de review. Dois trechos dobrados, o trecho atual aberto, `Context compacted`, a fala final em streaming e a volta ao fim com `New messages 2` | 12 falas, 146 ações em 11 grupos, 2 relatórios (acima do p90 de 69 ações; o máximo visto num implementador é 114) |
| `error` | O revisor, na passada 2: um retry automático que deu certo (marco), uma fala que você interrompeu, a sua mensagem, um grupo com a ação interrompida e o bloco de erro, com **Retry reviewer** na barra | — |
| `retrying` | O mesmo revisor antes de cair: a atividade `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8 s`, ao vivo | — |
| `review` | O review da PR da task, na passada 1: `PR review started` (o prompt a um clique), os checks lidos, 34 ações com o subagente de 44, a fala do revisor com código, o marco `Review 1 written · changes · 4 findings` e o cartão de apontamentos (`task.md` §9) | 78 ações; a mediana do review da PR é 15,5 (p90 58) |

O que as três tratam em todas as cenas:

- **Streaming.** A fala cresce e termina num cursor parado. O spinner fica em quem fala: no marcador da margem na A, no glifo do fio na B, no avatar do cartão na C. Assim o produto continua com um só laço, o spinner (princípio 8).
- **Markdown.** Os cabeçalhos (`h3` em 18/24, `h4` em 15/22), as listas, a tabela, o mermaid e o código com o caminho no cabeçalho.
- **A ação.** Rotulada pela descrição que o agente escreveu, com o comando depois, em mono `--ink-4`. À direita vêm a duração (`7.9 s`) ou o código de saída (`exit 1 · 8.2 s`). O grupo tem a duração total.
- **A hora de cada entrada.** Na margem na A, no fio na B (quando muda), na cabeça ou na linha na C, e sempre no nome acessível.
- **O foco por teclado entre as entradas.** A conversa é um `feed`:
  - ↑ e ↓, ou Page Up e Page Down, andam no percurso; Home e End vão ao primeiro e ao último;
  - `Esc` devolve o foco ao compositor;
  - o percurso é o que cada variação diz acima.

## Os oito requisitos (`brief.md` §6)

| Requisito | A · Documento | B · Linha do tempo | C · Cartões leves |
|---|---|---|---|
| 1. De quem é a vez | A barra do pedido (fixa) e, no fim da conversa, o marcador da margem em spinner ou o cartão com o anel âmbar | A mesma barra e o último glifo do fio: spinner, disco âmbar ou losango. É a mais forte das três: a vez está no fio | A mesma barra e o avatar em spinner ou o cartão de pedido |
| 2. Quem fala | Marcador e nome na margem, com o nome só quando a vez muda; você à direita, sem marcador; o produto como a linha `MySpec →` | Só o glifo, sem nome; você com o seu glifo; o produto com o dele | Cabeça do cartão (avatar, nome, hora); você em outra superfície, à direita |
| 3. Pedido impossível de perder e respondível pelo teclado | Único bloco com contorno numa página sem cartões: é a que mais destaca o pedido. **Show** da barra leva à primeira opção, e 1 a 9 respondem | Contorno e disco âmbar no fio | O anel âmbar e `--shadow-card` contra o aro dos outros cartões: é a que menos destaca, porque tudo é cartão |
| 4. Atividade sem afogar a leitura | Linha de 13 px em `--ink-3`/`--ink-4` entre falas de 16 px em `--ink-1`: a maior distância de peso | Linha e nó; aberto, um ponto por ação no fio | Linha entre cartões; o contraste vem da moldura, não do peso |
| 5. Documentos e relatórios sem painel | A linha do marco abre no lugar, com **Open in Artifacts** ao pé | O nó do marco abre no lugar | A linha do marco abre no lugar |
| 6. Marcos legíveis | A linha discreta, com a hora na margem; o retry entra na linha do grupo, e no máximo duas linhas se empilham | Nó com o ícone, na mesma linha do fio | Linha com ícone entre cartões; fica com o mesmo peso da linha de ações |
| 7. A mesma conversa em task, review e discussão | Nada da forma depende da task; o que é do item fica em volta (barra, compositor) | Idem | Idem |
| 8. Legível nas duas larguras | A margem de 88 px sai da medida `--measure`; a coluna de texto fica em 40,5rem, logo abaixo de `--measure-read` (42rem) | O fio e a hora gastam 88 px, como a margem da A | Os cartões gastam a medida inteira, sem coluna extra |

## Princípios extraídos das referências

`research/references.md` §2 e `research/conversation.md` §5 trazem as fontes. Somam-se a elas o que o próprio Claude Code mostra no terminal (o agente do MySpec é ele) e o comportamento público do Codex, do Cursor, do Devin e do Conductor. Nada foi copiado; cada linha diz o que se extraiu.

| Referência | O que ela faz | O princípio para o MySpec |
|---|---|---|
| Claude Code, terminal | Uma linha por ferramenta, com o alvo; a saída do Bash cortada em poucas linhas, com `+N lines`; subagente como um item com o total de ferramentas e o tempo; permissão com respostas numeradas; `Interrupted by user` numa linha própria; `Retrying in Ns (attempt n/10)` enquanto a API recusa | **Uma ação é uma linha, e o detalhe está a um número de distância.** A interrupção diz quem interrompeu. O retry diz a tentativa e a próxima, e some quando passa |
| Codex (app) | O trabalho de um turno se resume a uma linha do tipo "trabalhou por 3 min"; a resposta final fica à vista; usuários pedem os comandos e os caminhos visíveis sem clique | **O que se lê é a resposta; o trabalho é o resumo do turno.** O resumo nomeia o que foi feito (`Read 8 · Searched 4`), não só a contagem |
| Cursor | O texto do agente sem balão; a mensagem do usuário com superfície; as ferramentas em linhas compactas que abrem a saída | **Só um dos lados precisa de superfície para distinguir quem fala** (A e B dão superfície só ao usuário, ou nem a ele) |
| Devin | Uma linha do tempo de progresso em que clicar num passo mostra o que ele fez | **O eixo do tempo pode ser a navegação** (B) |
| Conductor | A conversa do Claude Code no centro; diff e terminal ao lado, não dentro | **A conversa é para a conversa; a evidência abre sob demanda** (os marcos abrem no lugar; nenhuma saída de ferramenta entra na leitura) |
| Warp | Cada comando é um bloco com a duração e o código de saída | **Duração e saída acompanham a ação**, à direita, em `--ink-4`; o vermelho só quando falhou |
| Zed | `Context Compacted` como um marco expansível na linha do tempo | **A compactação é um marco**, com a porcentagem em que aconteceu |

## Componentes que mudam

Mudanças propostas a `system/components.md`, grupo **A conversa**. Cada uma está desenhada em todos os estados, nos dois modos, em `components.html`.

**Nas três variações:**

1. **Grupo de ações, "falhou e depois passou"** deixa de ser vermelho. `· 1 failed, then passed` vai em `--ink-3`, e o vermelho fica para o grupo que terminou falhando (`· 1 failed`). Uma falha recuperada não é uma situação, e o princípio 1 guarda o vermelho para o que pede atenção.
2. **Mostrar as ações anteriores** ganha carregando (brilho, `Loading 15 earlier actions…`, porque é uma leitura) e erro (`Couldn't load the earlier actions` e **Try again**). O grupo não tem estado desabilitado: sempre abre.
3. **Marco em linha**:
   - ganha a variante **Retried on its own** (`the API was overloaded · 2 attempts · went through at 14:34`), que é o rastro de um retry automático que deu certo;
   - `Interrupted` passa a ser uma linha sob a fala, `Interrupted by you`, quando foi você. Uma queda de sessão continua sendo o bloco de erro;
   - o desabilitado é o documento descartado por um recomeço, sem o chevron;
   - carregando é o brilho da leitura, e erro é `Couldn't read … · Try again`.
4. **Fala em streaming**: um cursor parado no fim do texto, e o spinner em quem fala.
5. **Mensagem do usuário** ganha enviando (`Sending…` com o spinner) e o erro do compositor na própria mensagem (`Not sent · the session stopped` e **Send again**).
6. **Volta ao fim**: `↓ New messages 2 | ◌ Implementer writing`. O número conta o que chegou desde que você saiu do fim. A peça só existe fora do fim.
7. **Percurso por teclado** (novo): a conversa é um `feed`, com ↑↓, Page Up/Down, Home, End e `Esc`, como descrito acima.
8. **Dobra de um trecho** (novo): o passado de uma sessão longa se dobra por trecho. Um trecho vai de uma mensagem do produto que abre uma rodada à próxima, ou do início à primeira. A forma depende da variação. Tem os estados padrão, hover, foco, aberto, carregando e erro.

**Só na variação escolhida:**

| | A · Documento | B · Linha do tempo | C · Cartões leves |
|---|---|---|---|
| Fala do agente | A margem de 88 px (marcador, nome quando a vez muda, hora quando muda) substitui a linha de quem fala | O glifo no fio substitui a linha de quem fala; sem nome | A linha de quem fala vai para dentro de um cartão `--surface-2` com `--shadow-xs` (novo: **cartão da fala**) |
| Mensagem do usuário | Sem balão: à direita, sobre um fio de `--border-2` em `--line-3` | À esquerda, no bloco de `--surface-user`, ao lado do glifo | Cartão `--surface-user` à direita, com `You` e a hora na cabeça |
| Grupo de ações | Sem mudança: dobrado é uma linha, aberto é o bloco afundado. A linha pode levar o retry que deu certo | Um nó do fio; aberto, um ponto por ação no fio (novo: **nó**) | Sem mudança, alinhado ao texto dos cartões, com a hora à direita |
| Marco em linha | Sem mudança: a linha discreta, com a hora na margem | Vira **nó** do fio | Sem mudança, com a hora à direita |
| Cartão de pedido | Sem mudança | Sem mudança; o disco âmbar no fio | Ganha a cabeça (avatar, nome, hora, sem faixa) quando a fala acima não diz |
| Sessão longa | A linha do marco dobra o trecho, com o intervalo de horas na margem e o rótulo inteiro (novo: **dobra**) | O vão tracejado do fio (novo) | O **cartão dobrado** de uma linha (novo), com **Open all** na cabeça do trecho |

Nenhum token novo. A margem da A é `--space-16 + --space-6`, e a coluna do tempo da B é `--space-12`.

## Onde a proposta toca o que está registrado

Nenhuma decisão de `decisions.md` é reaberta: a estrutura da tela, o stepper, as abas, a barra do pedido e o compositor são os da 10-b. Três pontos mudam `components.md` ou `principles.md` e são escolhas do usuário:

Depois da crítica, a A não toca mais o princípio 6: o marco voltou a ser a linha de `components.md`, sem régua, e o grupo aberto voltou ao bloco afundado.

1. **A e B tiram a linha de quem fala de cima da fala.** Ela vai para a margem na A e para o glifo na B. `components.md` (Avatar e quem fala, Entradas da conversa) descreve essa linha acima do Markdown.
2. **A tira o balão da mensagem do usuário**, que `components.md` descreve em `--surface-user`.
3. **C põe a fala num cartão.** O princípio 6 reserva o elevado (`--surface-2`) para o cartão como objeto. Na C, toda fala vira objeto, e o cartão de pedido perde a exclusividade da moldura. É a razão principal para não recomendá-la.

## Recomendação

Revista depois da crítica: **A · Documento, com dois empréstimos da B.**

- **Da B, a hora só quando muda.** A margem deixa de ser uma coluna de números: na `running`, `14:19` aparece uma vez, e não três.
- **Da B, o modelo de teclado.** As setas andam por todas as entradas, `→` e `←` abrem e dobram, e a conversa é uma parada de Tab. Na `long`, a conversa tinha 25 paradas de Tab antes da barra do pedido. Agora tem duas: a entrada atual e o **Copy** do código dentro dela. Foi medido com `?audit` (`tabStopsConvo`) nas sete cenas.
- **Da C, nada.** A primeira palavra da última fala na linha de uma dobra fica de fora: a linha já carrega o rótulo inteiro e o tamanho.

Por que a A continua sendo a recomendada:

- **É a que mais separa os três pesos só com tipografia**: 16/26 em `--ink-1` para ler, 13 px em `--ink-3`/`--ink-4` para ignorar, e a linha discreta do marco para o tempo. Ela não acrescenta objeto nenhum à tela.
- **Segue o princípio 6 sem exceção.** Não há fio dentro da leitura, e o grupo aberto é o bloco afundado.
- **O pedido é o único bloco com contorno.** Numa página sem cartões, ele salta sem precisar de mais cor (requisito 3). Agora ele também responde pelo teclado.
- **A margem cumpre três papéis num lugar só**: quem, quando (quando muda) e em que estado (o spinner em quem escreve). Ela custa pouco: a medida da conversa já tinha 5rem além da linha de leitura, e a coluna de texto perde só 1,5rem (40,5rem contra 42rem).

**B** é a que diz melhor, de relance, o que aconteceu e de quem é a vez, mas gasta um glifo em cada entrada, inclusive nas que se ignoram, e repete o azul e o âmbar. **C** multiplica molduras, tira do pedido a exclusividade do contorno e contraria o princípio 6 no uso comum.

## Depois da crítica

`critique.md` e o coordenador pediram cinco correções antes de a rodada ir ao usuário. Estão feitas nesta pasta.

1. **O cartão de pergunta responde ao teclado de verdade**, nas três variações:
   - `1`–`9` escolhem a opção, com o foco no cartão ou na entrada dele;
   - `↑` e `↓` (e `←` e `→`) andam dentro do `radiogroup` e escolhem, com volta ao início no fim;
   - `Enter` envia a escolha (`Sending "Yes, by client IP with the anonymous plan"…`), e **Other…** leva ao compositor;
   - o `radiogroup` é uma parada de Tab, com roving;
   - o percurso da conversa não rouba mais as setas: dentro de um cartão de pedido ou de apontamentos, as teclas são do cartão;
   - a permissão responde a `1`–`3`, e o botão mostra o envio.
   
   `?kbtest` roda esse percurso e escreve o resultado. Nas duas conversas testadas (`ask` na A e na B): Show leva à opção 1, `↓` escolhe a 2, `1` volta à 1 e `Enter` envia.
2. **A cena `retrying`** não mostra mais `undefined%` nem `Retrying retrying` na árvore. A linha diz `Step 3/7 · pass 2` e `Retrying attempt 3/10`, com `41%`. O `?audit` passou a acusar texto com `undefined` ou `NaN` e texto que vaza da sua região (lateral, área principal, painel). Os dois checks passam nas 126 combinações.
3. **Na A, o marco não é mais uma régua.**
   - Ele voltou a ser a linha discreta de `components.md`, e a dobra de trecho usa essa mesma linha.
   - O rótulo da dobra nunca corta: `round 1 of 3` aparece inteiro, porque o rótulo quebra a linha antes de cortar.
   - O grupo aberto usa o bloco afundado.
   - Na cena `error`, as quatro réguas empilhadas viraram duas linhas. `Review 1 written` e `MySpec → Reviewer · pass 2` ficam como linhas, e o retry entrou na linha do grupo seguinte.
   - O `·` solto do grupo sem duração saiu.
4. **Da B para a A**: a hora só quando muda e o modelo de teclado. Na `long`, eram 25 paradas de Tab na conversa; agora são 2: a entrada atual e o seu **Copy**. A B e a C têm o mesmo percurso.
5. **Da C, nada.**

De passagem, também corrigido: o resumo do subagente em sans (não em mono, como um comando), o rótulo `empty` do mermaid fora da seta, e a palavra **Show** das dobras na A e na B, que saiu para não disputar com o **Show** da barra do pedido (o chevron já diz que abre).

Ficam como pauta, sem correção nesta passada: os glifos que vêm depois de um texto e caem em meio pixel (crítica, comum 5), a altura do código longo (comum 8), e as cenas de esqueleto, pausa e conversa de review ou de discussão (comum 9).

## Dados que faltam

Os quatro primeiros já estão em `backend.md` (P5 a P8). Os outros são novos nesta rodada.

| Dado | Para | Custo |
|---|---|---|
| O `description` do Bash como rótulo | O rótulo de toda ação | Pequeno; `backend.md` P5 |
| Duração e código de saída de cada ação | `exit 1 · 8.2 s`, a duração do grupo | Pequeno; P6 |
| `parent_tool_use_id` | O subagente aninhado | Pequeno; P7 |
| O tipo da mensagem do produto | O marco `MySpec → Implementer · Review 1 · …` e as fronteiras dos trechos de uma sessão longa (cada relatório entregue abre uma rodada) | Pequeno; P8 |
| `attempt`, `max_retries`, `retry_delay_ms` e o erro do `api_retry` | `Retrying · attempt 3 of 10 · next try in 8 s`, e o marco `Retried on its own · 2 attempts` depois que passa | Pequeno: o evento chega e é ignorado (`protocol.go:61-67`); o marco é um tipo novo de marcador |
| Quem interrompeu | `Interrupted by you`, distinto de uma queda | Pequeno: o produto sabe quando o usuário chamou **Stop**; é um campo no marcador `interrupted` |
| A hora da resposta de uma pergunta estruturada | `answered 09:19` | Pequeno: a permissão tem `answeredAt`, e a pergunta não |
| A porcentagem de contexto na compactação | `Context compacted · at 81%` | Pequeno: `preTokens` já chega no marcador; falta a janela de contexto no momento |
| A hora das falas, das mensagens e das ações | A hora de cada entrada | Nenhum no backend: toda entrada tem `createdAt`; o frontend mostra só a do marcador |
| O número de entradas novas desde que o usuário saiu do fim | `New messages 2` | Nenhum: frontend |

Um fato de `research/conversation.md` §4 que a cena `running` contraria: **subagentes nunca aparecem num step** nos 112 implementadores levantados. O pedido da rodada pôs o subagente aninhado no implementador para desenhar o componente ali. A cena `review`, com o subagente no review da PR, é o caso real: 56 das 73 delegações acontecem em review de PR.

## Como foi testado

- Chromium headless, pelo `http.server` da lab na porta 8123, com a Fira do Google Fonts. As capturas foram olhadas cena a cena nas três variações, nos dois modos, a 1100, 1600 e 2560 px, e o espécime inteiro nos dois modos.
- `?audit` nas sete cenas das três variações, nos dois modos, a 1100, 1600 e 2560 px (126 combinações), depois da crítica. Em todas:
  - toda caixa posicionada pelo layout fica em pixel inteiro. As peças que encolhem ao texto (a mensagem do usuário, a volta ao fim) são arredondadas por script, e a centrada toma a paridade do contêiner. O mermaid tem altura fixa;
  - nenhum texto corta sem tooltip;
  - nenhuma sobreposição no topo, e o título inteiro;
  - nenhum controle sem nome;
  - todo texto com 4,5:1 ou mais sobre o fundo real;
  - a página nunca rola na horizontal;
  - nenhum texto diz `undefined` ou `NaN`, e nenhum texto vaza da sua região;
  - a conversa tem uma parada de Tab, mais os controles da entrada atual (2 na `long` e na `ask`).
- `?kbtest` na `ask` e na `long` da A e da B: o cartão anda pelas setas, `1` escolhe, `Enter` envia, e `→` e `←` abrem e dobram um grupo.
- `components.html` com `?audit`, com os dois modos na mesma página: nenhum texto abaixo de 4,5:1, nenhum controle sem nome, nenhuma rolagem lateral. A geometria do espécime não é medida.
- A renderização final é a do WebKitGTK, no app.

## Decisão

2026-09-25: a **C · Cartões leves** é a base. A e B foram descartadas pelo usuário: poluídas, com o conteúdo principal descentralizado. A rodada `16-conversation-wide` refina a C com a coluna mais larga, sem horário por mensagem nem linha do tempo, com referências de terminais e de ferramentas de agente. Ver `design/decisions.md`.
