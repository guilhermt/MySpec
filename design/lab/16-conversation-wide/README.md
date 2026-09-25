# 16 · A conversa larga

Fase 4. Rodada aberta pela decisão de 2026-09-25 "Conversa: cartões leves como base, coluna mais larga, sem linha do tempo". Ela refina a variação C da rodada 15 e não reabre nada da tela da task. Esta é a versão depois da crítica (`critique.md`) e do feedback do usuário (a seção "Depois do feedback: largura única"): o stepper, as abas, a barra do pedido e o compositor são os da 10-b.

**A pergunta.** Como a conversa usa a largura da área principal sem virar uma linha de texto ilegível, e fica mais limpa que a C? O usuário pediu três coisas:

- a coluna do meio mais larga;
- nada de hora por mensagem nem linha do tempo;
- o que é pouco relevante fora de vista.

**A régua.** Cada elemento justifica por que existe. As duas variações têm o mesmo conteúdo (`src/conv-data.js` da rodada 15), o mesmo modelo de entradas e o mesmo teclado. Tudo na conversa tem uma largura só, com as mesmas bordas. As variações diferem só na largura da coluna e no tamanho do texto.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **a · 960 px, corpo 15/22**, nas sete cenas |
| `b.html` | **b · Fluida até 1120 px, corpo 16/26**, nas mesmas cenas |
| `components.html` | Cada peça das duas variações em todos os estados, claro e escuro lado a lado |
| `src/` | As fontes. `python3 design/lab/16-conversation-wide/src/build.py` gera as páginas e confere que cada uma traz `design/system/tokens.css` byte a byte |

As fontes em `src/`:

- `base.css`, `core.*`, `content.js`, `m.*`, `stepper.js` e `shell.*` são a tela da 10-b, e `conv.css`, `conv-data.js` e `conv-common.js` são as peças compartilhadas da 15. Todas foram copiadas da 15, com três ajustes feitos só aqui:
  - a auditoria mede as classes novas e ignora o conteúdo de um `details` fechado;
  - o cartão de apontamentos vira uma parada de Tab só;
  - `snapWidths` mede a mensagem nova.
- `proposed.css` tem os tokens que a rodada propõe ao system.
- `wide.css` e `wide.js` têm a conversa que as duas variações compartilham.
- `a.css`/`a.js` e `b.css`/`b.js` têm cada variação.

## Como abrir

Sirva a lab (`python3 -m http.server 8090 -d design/lab`) e abra `16-conversation-wide/a.html` e `b.html`. O seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros são os da 15:

- `?scene=`: `planning`, `running` (o padrão), `ask`, `long`, `error`, `retrying` ou `review`;
- `?theme=light|dark` e `?voice=impl|rev`;
- `?open=all` abre todos os grupos, os comandos e os marcos;
- `?focus=N`, `?audit`, `?kbtest` e `?clean`.

Para comparar com a C: `compare.html?a=15-conversation/c.html&b=16-conversation-wide/b.html`, e o mesmo com `a.html`.

## Princípios das referências

Pesquisados em 2026-09-25. Nada foi copiado: cada linha diz o princípio extraído e como ele entra aqui.

| Referência | O que ela faz | O princípio | Onde entra |
|---|---|---|---|
| Minimal para Obsidian ([minimal.guide](https://minimal.guide/features/line-width)); Notion em página larga ([super.so](https://super.so/blog/notion-full-width)); [Baymard](https://baymard.com/blog/line-length-readability) | A linha de texto tem uma medida (40em), e tabelas, imagens e código têm outra, mais larga (50em), com um teto em % do painel (88%). A página larga do Notion alarga os blocos, não a leitura | **A linha de texto tem medida; os blocos não.** O texto corrido fica curto; o que ganha com a largura é o que não se lê como prosa | Aplicado e depois descartado pelo usuário: a linha de leitura mais estreita que o código e os cartões pareceu estranha ("umas coisas menores que outras"). Vale aqui o contrário, uma borda só para tudo; o tamanho da coluna e do texto é quem controla a linha |
| Warp ([blocks](https://docs.warp.dev/terminal/blocks/block-basics), [modelo de blocos do agente](https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment)) | O comando e a saída são uma unidade. Um bloco com saída diferente de zero ganha uma faixa lateral vermelha. Os comandos que o agente roda aparecem como resumos compactos que se abrem sob demanda | **O comando é a unidade. A saída dobra atrás dele, e a falha tem um portador espacial** | O comando tem uma linha, com a descrição, o comando apagado e a duração ou o `exit`. A saída fica dobrada, e a de uma falha fica aberta com o trilho vermelho |
| Claude Code no terminal ([modo interativo](https://code.claude.com/docs/en/interactive-mode), [fullscreen](https://code.claude.com/docs/en/fullscreen), [issue 12589](https://github.com/anthropics/claude-code/issues/12589)) | Uma linha por ferramenta, com a saída cortada em `… +N lines`. Um clique no resultado dobrado abre a saída inteira. Quem fala é um glifo de uma célula, sem avatar e sem hora. O botão de volta ao fim diz `3 new messages`. `/focus` mostra só o prompt, um resumo das ferramentas e a resposta final | **Quem fala é uma marca mínima. O detalhe está a um gesto. O resto dobra** | O autor é uma palavra numa faixa sobre o texto, escrita só quando a voz muda. A saída mostra a cauda e `N more lines above`. `New messages 2` vem da 15 |
| iTerm2 ([destaques](https://iterm2.com/documentation-highlights.html)); Warp ([issue 178](https://github.com/warpdotdev/warp/issues/178), [issue 3010](https://github.com/warpdotdev/Warp/issues/3010)) | No iTerm2, a hora de cada linha é um modo que se liga (`View › Show Timestamps`) e fica desligada por padrão. No Warp, a hora do bloco é pedida pelos usuários, e ninguém a vê de passagem | **O tempo fica fora de vista por padrão e aparece quando se pergunta** | Nenhuma hora na tela. Ela aparece com hover ou foco ao lado do autor, no fim de um marco e no fim da linha de um grupo, e está sempre no nome acessível |
| Ghostty ([window-padding-balance](https://ghostty.org/docs/config/reference)) | A grade de texto ocupa a janela, e a sobra se reparte igual nas bordas | **Margens proporcionais e equilibradas; o conteúdo é quem ocupa** | Na b, as margens são 5% da largura, com mínimo de `--space-6`, e a coluna fica centrada em pixel inteiro. Dentro dela, tudo ocupa a coluna inteira, como a grade de um terminal |
| Cursor ([fórum](https://forum.cursor.com/t/new-version-hides-agent-tool-call-details-in-defiance-of-setting/165292)); Codex ([19891](https://github.com/openai/codex/issues/19891), [46794](https://github.com/openai/codex/issues/46794)) | `Explored N tools` e `Worked for Ns` escondem o que o agente fez, e os usuários reclamam que não veem o que deu errado. No Codex, pedem um resumo de uma linha por padrão, com a altura liberada ao dobrar, e os nomes do que mudou à vista | **Dobrar não é esconder. O resumo nomeia o que foi feito e mostra a falha, e dobrado ocupa uma linha** | O resumo diz os tipos (`Read 8 · Searched 4 · git 2`), a falha em vermelho e a ação em curso. Dobrado, o grupo tem uma linha de 28 px |
| Zed ([discussão 58314](https://github.com/zed-industries/zed/discussions/58314), [PR 64568](https://github.com/zed-industries/zed/pull/64568)) | Os cartões de ferramenta começam dobrados. Na proposta, o turno terminado se reduz a seções dobradas e à mensagem final, sempre visível | **A resposta fica à vista, e o trabalho do turno dobra em volta dela** | A fala nunca dobra, e os grupos dobram. O grupo vivo também dobra, com a ação em curso no resumo |
| Devin ([sessão](https://fast.io/resources/devin-session-tools-guide/)) | A hora e a duração de cada passo ficam numa linha do tempo à parte, a `Progress`, e não no chat | **Quem precisa do tempo vai a outro lugar** | É o papel de `Details`, que guarda as conversas anteriores (decisão da tela mínima). A conversa não carrega relógio |
| Conductor ([comparação](https://www.conductor.build/compare/claude-code)) | O chat é o do Claude Code, e o diff e o terminal ficam ao lado | **A conversa é conversa; a evidência vive ao lado ou atrás de um gesto** | Nenhum diff na conversa. A saída é uma cauda sob demanda, e o documento abre em `Artifacts` |

Considerado e não adotado: o cabeçalho fixo com o último prompt que subiu (Claude Code fullscreen) e o do comando em curso (Warp). Os dois acrescentam cromo à tela mínima. A volta ao fim já diz o que chegou.

## O que mudou em relação à C

| Na C (rodada 15) | Aqui | Por quê |
|---|---|---|
| Coluna de `--measure` (800 px), com 34% da área principal a 2560 | a: 960 px. b: a área menos 5% de cada lado, até 1120 px | O pedido do usuário |
| Fala num cartão, sua mensagem à direita numa caixa estreita, ações e marcos recuados | Tudo com a mesma borda esquerda e direita: fala, mensagem, ações, código, tabelas, pedidos, apontamentos, marcos, barra do pedido e compositor | O feedback do usuário: nada mais estreito ou mais largo que o resto |
| Avatar, nome e hora na cabeça de todo cartão | Uma palavra (`Implementer`, `You`) numa faixa sobre o texto. A do agente só aparece quando a voz muda; a hora, com hover e foco | Numa conversa fala um agente só, e a aba já diz qual é |
| Hora à direita de cada linha de ações e de cada marco, e dentro do texto (`answered 09:19`) | Nenhuma hora visível em lugar nenhum. A duração fica | O pedido do usuário |
| Cartão da fala em `--surface-2` com o aro de `--shadow-xs` | A fala é texto na página, sem cartão nem fundo. Sua mensagem tem fundo próprio (`--surface-user`), na mesma largura | O pedido é o único bloco com contorno e com elevação (princípio 6) |
| A pergunta respondida com fio | Um bloco chapado em `--surface-0`, sem fio, com a hora no tooltip | O contorno é só de quem espera |
| O grupo vivo aberto na `running` | Dobrado, com a ação em curso no resumo | Pedido da rodada e decisão da tela mínima |
| A ação sem saída | O comando, com a saída dobrada. A falha fica aberta, com a cauda e o trilho | Warp e Claude Code. É um dado novo (Dados que faltam) |
| Sessão longa como nove cartões de uma linha, com `⇕` | Uma linha por trecho, com o ícone do histórico e o tamanho primeiro | Crítica 15 (C5) e crítica 16 (comum 6) |
| Código de 46 linhas empurrando a conversa | Acima de 24 linhas, o bloco mostra 20, com `Show all 46 lines`, e continua rolando na horizontal | Crítica 15, comum 8 |
| As setas passavam só pelos cartões | As setas passam por toda entrada que se opera; `→` abre e `←` dobra; `1`–`9` respondem na pergunta, e `1`–`3` na permissão, com o foco na entrada | O modelo que a 15 corrigiu |
| O artigo dobrado com `aria-expanded`; filhos do `feed` de vários tipos | Todo filho do `feed` é um `article` com nome; o que abre é `summary` | Crítica 15 (C6) e crítica 16 (comum 9) |

## a · 960 px, corpo 15/22

A conversa é uma coluna centrada de `--measure-conversation` (60rem, 960 px). Na metade do monitor, a coluna ocupa a área inteira menos `--space-6` de cada lado (902 px a 1250); no monitor inteiro, ela para em 960. A fala e a sua mensagem ficam em `--text-body` e `--leading-body` (15/22), o tamanho da mensagem e dos cartões do produto.

## b · Fluida até 1120 px, corpo 16/26

A coluna segue a área principal, com margens de 5% da largura da conversa, nunca menos que `--space-6`, até `--measure-conversation-max` (70rem, 1120 px). Ela tem 730 px a 1100, 854 a 1250 e chega ao teto por volta de 1560 px de janela. A regra é uma só e contínua. A fala e a sua mensagem ficam em `--text-read` e `--leading-read` (16/26), o registro de leitura do princípio 3.

## O que as duas têm igual

- **Uma largura só.** Tudo tem a mesma borda esquerda e a mesma borda direita: a fala, sua mensagem, os grupos abertos, o código, as tabelas, o mermaid, os cartões de pergunta e de permissão, os apontamentos, o erro, o corpo de um marco, a barra do pedido, o compositor e as abas. As linhas de grupo, de marco e de dobra têm o texto na borda; o véu do hover passa `--space-2` para fora.
- **A fala é texto na página.** Sua mensagem tem fundo (`--surface-user`) e a palavra `You`, na mesma largura. Nem recuada, nem à direita.
- **Nenhuma hora visível em lugar nenhum.** Uma busca por `HH:MM` no texto visível das sete cenas, com tudo aberto e sem hover, não encontra nada. A hora está no nome acessível de toda entrada. Ela aparece com hover e foco ao lado do autor, no fim de um marco e no fim da linha de um grupo; a da pergunta respondida fica no tooltip.
- **O autor.**
  - Fica numa faixa sobre o texto, na borda.
  - A faixa existe em toda fala, então nada se move quando a palavra aparece.
  - Aparece quando a voz muda: depois de uma mensagem sua, de uma mensagem do produto, de uma dobra, ou no início.
  - Na escrita, a palavra ganha o spinner, e o texto termina no cursor parado.
- **Pergunta e permissão** são os únicos blocos com contorno: o anel âmbar do system, com `--shadow-card`.
- **O grupo** é uma linha dobrada com o chevron, `14 actions`, os tipos, a falha e a duração. Aberto, é o bloco afundado, com um comando por linha e a saída dobrada. O subagente fica aninhado sob um fio.
- **O marco** é a linha discreta. Ele só é parada de teclado quando abre. A mensagem do produto tem o ícone do produto. A dobra de trecho tem o ícone do histórico e o tamanho primeiro.
- **O teclado.**
  - A conversa é um `feed` de `article`s, com uma parada de Tab (a entrada atual e os controles dela).
  - ↑↓, Page Up/Down, Home e End andam por toda entrada que se opera, pelos comandos de um grupo aberto e pelos subagentes.
  - `→` abre e `←` dobra.
  - `1`–`9` respondem na pergunta, e `1`–`3` na permissão.
  - `Esc` volta ao compositor.
- **A volta ao fim**: `↓ New messages 2 | ◌ Implementer writing`, só fora do fim.
- **Pixel inteiro.** O texto que empurra um glifo (a contagem antes do spinner, o autor antes da hora, a hora antes da duração) toma uma largura inteira. Medido com as animações paradas.

## As cenas

A task é a das rodadas 09, 10 e 15: `Rate limit per API key`.

| Cena | O que mostra |
|---|---|
| `planning` | O agente do PRD: a pergunta em texto respondida, a pergunta estruturada respondida (bloco chapado), `yes` e `ok`, a fala longa com mermaid e tabela, e a pergunta em texto que espera |
| `running` | O implementador do step 3, na rodada 1: três grupos dobrados, o vivo com a ação em curso, a mensagem do produto como marco, 46 linhas de Go cortadas em 20 e a mensagem na fila. Com `?open=all`, os comandos, a saída e a falha com a cauda |
| `ask` | O revisor na passada 2 pergunta num cartão; o implementador espera uma permissão (`?voice=impl`), e `1` na entrada envia `Allow…` |
| `long` | O step 6 depois de duas rodadas: dois trechos dobrados, a mensagem do produto da rodada 2, `Context compacted`, a fala em streaming e `New messages 2` |
| `error` | O revisor: o retry que deu certo, a fala interrompida, a sua mensagem, o grupo com a ação interrompida e o erro com o trilho |
| `retrying` | A atividade `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8 s` |
| `review` | O review da PR, na passada 1: os checks lidos, 34 ações com o subagente de 44, a fala com código, o relatório e o cartão de apontamentos |

## Medidas

Medidas no Chromium, por CDP, no tema claro. As bordas são as das caixas das entradas, dos blocos, da barra do pedido e do compositor. Os caracteres por linha são contados com `Range`, caractere a caractere, sobre as linhas renderizadas e **completas** (a última linha de cada parágrafo fica de fora). As cenas medidas são `planning`, `running`, `ask`, `long`, `review` e `error`.

**Bordas.** Nas cenas `planning`, `running` e `review`, a 1250 e a 2560, nas duas variações, há uma borda esquerda e uma direita só, compartilhadas por fala, mensagem, grupo aberto, código, tabela, mermaid, cartões, corpo de marco, barra do pedido, compositor e abas:

| | 1250 | 2560 |
|---|---|---|
| a | 324 → 1226 (902 px) | 990 → 1950 (960 px) |
| b | 348 → 1202 (854 px) | 910 → 2030 (1120 px) |

**Caracteres por linha completa da fala**:

| | 1250 | 2560 |
|---|---|---|
| a · 15/22 | 114 a 137 | 126 a 147 |
| b · 16/26 | 106 a 127 | 141 a 157 |

- Os apontamentos, em 15 px nas duas, chegam a 124 (a) e 115 (b) a 1250, e a 133 (a) e 156 (b) a 2560.
- As estimativas do pedido (cerca de 100 na a e 105 na b) ficaram abaixo do medido. A Fira Sans desenha cerca de 7 px por caractere a 15 px, e não 9,6.
- Para ter cerca de 100 caracteres, a coluna teria perto de 44rem (700 px) a 15 px, ou 48rem (770 px) a 16 px.

## Tokens de layout propostos

Declarados em `src/proposed.css`, fora de `tokens.css`, no formato dele.

| Token | Valor | Variação | Para |
|---|---|---|---|
| `--measure-conversation` | `60rem` | a | A coluna da conversa, fixa e centrada: toda entrada, a barra do pedido, o compositor e as abas |
| `--measure-conversation-max` | `70rem` | b | O teto da coluna fluida |
| `--conversation-margin` | `5cqi` | b | A margem de cada lado, em fração da largura da coluna de conversa (um contêiner `inline-size`), com mínimo de `--space-6`. A coluna é `round(down, min(teto, 100cqi − 2 · max(--space-6, margem)), 2px)` |

Nenhuma cor nova. `--measure` (50rem) continua existindo, porque `--list-measure` é calculado a partir dele, e `--measure-read` continua valendo fora da conversa.

## Mudanças ao system

Em `system/components.md`, grupo **A conversa**, e em `screens/task.md`:

1. **Avatar e quem fala.** Na conversa não há avatar. O autor é uma palavra de `--text-micro`, peso 500, `--ink-3`, numa faixa sobre o texto, escrita quando a voz muda. Implementador e revisor se distinguem pela aba e pela palavra.
2. **Entradas da conversa.** Uma largura só para tudo, a da coluna.
   - A fala é texto na página, em 15/22 (a) ou 16/26 (b).
   - Sua mensagem fica em `--surface-user`, com `You`, na mesma largura.
   - Nenhuma hora visível.
3. **Marco em linha.** O chevron vai para o sulco da esquerda, como no grupo. A hora aparece com hover e foco. O que não abre não é parada de teclado.
4. **Grupo de ações.**
   - O grupo vivo também dobra.
   - A hora de início aparece com hover e foco.
   - Aberto, cada ação é um **comando** (componente novo): a linha e a saída dobrada, com a cauda, `N more lines above` e **Show all N lines**. A falha fica aberta, com o trilho.
   - Os estados do comando: padrão, hover, foco, pressionado, aberto, rodando, falha, interrompido, sem saída (o desabilitado), carregando e erro.
5. **Cartão de pedido.** Sem mudança no pedido que espera. A pergunta respondida fica chapada, sem fio, com a hora no tooltip. `1`–`3` respondem a permissão com o foco na entrada.
6. **Bloco de código.** Acima de 24 linhas, mostra 20 e **Show all N lines**, e continua rolando na horizontal.
7. **Dobra de trecho** (novo). Uma linha com o ícone do histórico, o tamanho primeiro e onde o trecho começou. Aberta, mostra as entradas como eram. Os estados são padrão, hover, foco, aberto, carregando e erro.
8. **`screens/task.md` §2, §7 e §8.** A conversa, a barra do pedido e o compositor passam de `--measure` para `--measure-conversation` (a) ou para a regra fluida (b), e tudo na conversa ocupa essa largura.

Onde isso toca o que está registrado, e é escolha do usuário:

- **Princípio 2.** "O marcador do agente" deixa de existir na conversa.
- **Princípio 3.** "A fala do agente usa 16 px em 26 px, numa medida de 42rem" deixa de valer. A medida da fala passa a ser a coluna, com 110 a 157 caracteres por linha, conforme a largura e a variação. Na a, a fala passa a 15/22.
- **Brief §6, requisito 6.** "Marcos legíveis na linha do tempo" perde "na linha do tempo".
- **Princípio 6.** Não é tocado: a fala não tem fundo, e o único objeto elevado e contornado é o pedido.

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| **A saída de cada comando** (`stdout`, `stderr`) e o número de linhas | A saída dobrada, a cauda de uma falha e `N more lines above` | Médio, e novo nesta rodada. O `tool_use_result` chega a cada ação e é descartado (`research/conversation.md` §1.3). A saída de um Bash tem mediana de 24 linhas, p90 de 251 e máximo de 1.202. O barato é guardar as últimas 40 linhas e a contagem, sem **Show all**. Mostrar tudo pede guardar a saída inteira, até 16 MiB por linha |
| O `description` do Bash, a duração e o código de saída, o `parent_tool_use_id`, o tipo da mensagem do produto | O rótulo, `exit 1 · 8.2 s`, o subagente, os marcos e as dobras | Pequeno; já em `backend.md` P5 a P8 |
| `attempt`, `max_retries`, `retry_delay_ms`, quem interrompeu, `answeredAt` da pergunta, a % na compactação | O retry, `Interrupted by you`, o tooltip da pergunta respondida, `at 81%` | Pequeno; listados na rodada 15 |
| A hora de cada entrada | O hover, o tooltip e o nome acessível | Nenhum no backend: toda entrada tem `createdAt` |
| A mudança de voz | Quando escrever o autor | Nenhum: o frontend deriva da sequência de entradas |

## Depois da crítica

`critique.md` pediu correções antes de a rodada ir ao usuário, e elas seguem valendo:

- nenhuma hora visível: `answered 09:19` foi para o tooltip, e `went through at 14:34` e `discarded with the restart at 10:02` perderam a hora;
- `1`–`3` respondem com o foco na entrada da permissão;
- a dobra de trecho se distingue do marco do produto;
- não há salto de layout, porque a faixa do autor existe sempre;
- tudo cai em pixel inteiro;
- todo filho do `feed` é `article`, o comando sem saída é um `li` com nome, e o marco que não abre não tem foco;
- a fala não é mais um cartão elevado.

Também foram corrigidos:

- a saída de `cat` e `sed -n` mostra a cauda;
- o código cortado rola na horizontal;
- o início de um grupo aparece com hover e foco;
- o comando pressionado está no espécime;
- o erro da dobra tem o véu.

A linha de leitura centrada, que a crítica pediu e que ficou nesta pasta por uma passada, saiu com o feedback abaixo.

## Depois do feedback: largura única

O usuário achou a versão com a linha de leitura "estranha demais, umas coisas menores que outras": texto numa coluna de 624 px, código e cartões mais largos, compositor mais largo ainda. Agora:

- **Uma largura só para tudo**, sem `--measure-lane` e sem texto centrado dentro de uma coluna mais larga. A fala, sua mensagem, os comandos, o código, as tabelas, os cartões de pergunta e de permissão, os apontamentos, os marcos, a barra do pedido e o compositor têm a mesma borda esquerda e a mesma borda direita. A tabela de bordas acima confirma isso nas duas variações, a 1250 e a 2560.
- **Sua mensagem** ocupa a mesma largura, com fundo próprio e `You`. Nem recuada, nem à direita.
- **A fala da b** perdeu o tom `--surface-speech`. As duas variações têm a fala como texto na página, e a b não toca mais o princípio 6.
- **As variações diferem só na largura e no tamanho do texto**: a, 960 px com 15/22; b, fluida até 1120 px com 16/26.
- **Continua**: sem hora, sem avatar, comandos como blocos com a saída dobrada, o teclado e o ARIA.

## Como foi testado

- Chromium headless, com a lab servida na porta 8161 e a Fira do Google Fonts.
- **Capturas olhadas** a 1250 e 2560 px:
  - `running` com `?open=all` e `ask` com `?voice=impl`, nas duas variações;
  - `planning` da a, `review` da b no escuro e `long` da b no escuro;
  - `components.html` no alto.

  Em nenhuma captura uma entrada, bloco ou barra tem largura diferente do resto.
- **`?audit`** nas 7 cenas × 2 variações × 2 modos × 5 larguras (1100, 1250, 1600, 1920 e 2560), 140 combinações. Em todas:
  - nenhuma caixa em meio pixel;
  - nenhum texto cortado sem tooltip, nenhum texto que vaza, nenhum `undefined`;
  - nenhuma rolagem lateral, nenhuma sobreposição no topo, nenhum controle sem nome;
  - todo texto com 4,5:1 ou mais;
  - paradas de Tab da conversa: 1 na `error` e na `retrying`, 2 na `planning`, na `running`, na `ask` e na `long`, e 5 na `review`.
- **`components.html` com `?audit`**, nos dois modos: limpo.
- **`?kbtest`** na `ask` e na `long` das duas passa: `↓` escolhe a opção 2, `1` volta à 1, `Enter` envia, `→` abre e `←` dobra um grupo. `1` com o foco na entrada da permissão envia `Allow…`.
- **Por CDP**, medidos à parte:
  - as bordas;
  - os caracteres por linha;
  - os glifos com as animações paradas;
  - a busca de `HH:MM` no texto visível.
- **A renderização final** é a do WebKitGTK, no app.

## Recomendação

**a · 960 px, corpo 15/22.**

- **As linhas são mais curtas no monitor inteiro.** Chegam a 147 caracteres, contra 157 na b, que é onde a leitura mais sofre. A 1250 as duas ficam parecidas (a até 137, b até 127).
- **A fala fica no mesmo corpo da sua mensagem e dos cartões (15 px).** Com uma largura só, um tamanho só reforça a unidade que o usuário pediu.
- **960 px fixos são previsíveis.** A barra do pedido e o compositor ficam sempre do mesmo tamanho a partir de cerca de 1300 px de janela.

A b lê melhor por linha (16/26), mas a regra fluida a leva a mais caracteres por linha justamente no monitor inteiro. Com cerca de 100 caracteres, o texto ficaria mais confortável; mas isso pede uma coluna de 44 a 48rem, a mesma largura que o usuário achou pequena na C, e é uma escolha dele.

## Decisão

**A · 960 px, largura única**, decidida em 2026-09-25. Ver `design/decisions.md`. O documento da tela da task (`design/screens/task.md` §6 a §8) é atualizado com esta rodada.
