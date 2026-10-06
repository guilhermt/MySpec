# Componentes

Aprovado em 2026-09-25. Uma seção por componente: anatomia, variantes, estados, tokens, teclado e acessibilidade, e o que fazer e não fazer. Os tokens estão em `tokens.css`, as regras que valem para todos em `../principles.md`, e o uso de cada componente em cada lugar nos documentos de `../screens/`, que este documento não repete.

Cada componente está desenhado em todos os estados, nos dois modos, num espécime. Onde o espécime e este documento divergem, vale este documento.

| Espécime | Componentes |
|---|---|
| `lab/08-visual-final/specimen.html` | Fundamentos, botão, chip, campos, menu, árvore, cartão de pedido, bloco de código, diálogo, tooltip |
| `lab/09-screen-task/components.html` | Resposta rápida, arquivo mudado, checks do GitHub, volta ao fim |
| `lab/10-screen-task-minimal/components.html` | Stepper, abas de agente, marco em linha, grupo de ações, menu do item, conversa anterior, popovers Review mode e Models, seletor do step |
| `lab/11-screen-board/components.html` | Linha de lista (card), cabeçalho de seção, caixa de seleção, barra de filtros, leitura, ações do card, Home, campos do diálogo de criação |
| `lab/12-screen-review/components.html` | Linha de lista (PR), painel da PR, pílula, apontamento, barra de decisão, diálogo de publicação, notas, página do item que saiu |
| `lab/13-screen-discussion/components.html` | Rascunho, rascunho dobrado, avisos, diff, edição, marcos da rodada, barra da discussão, diálogos da discussão |
| `lab/14-screen-rest/components.html` | Navegação de Settings, linha de modelo, rádio, linhas de Settings, linha do History, resultado do encerramento, prévia de apagamento, aviso do app, passos do início |
| `lab/16-conversation-wide/components.html` (a variação a) | As entradas da conversa: fala, mensagem do usuário, grupo de ações, comando, marco em linha, dobra de trecho, pergunta e permissão, código cortado, volta ao fim, atividade |

Estados comuns a todo componente interativo, salvo quando a seção diz outra coisa:

| Estado | Regra |
|---|---|
| Hover | Véu neutro (`--veil-hover`) ou o degrau `-hover` do sólido, em `--duration-fast` |
| Focus | Anel de `--focus-width` em `--focus`, por fora, com `--focus-offset` de folga. Campos usam borda `--focus` com halo `--focus-halo` |
| Active | Véu `--veil-press`, ou o degrau `-active`. Um controle pressionado ou escolhido (painel aberto, opção, segmento, chip, decisão) usa `--brand-tint` e `aria-pressed` ou `aria-checked` |
| Disabled | Borda tracejada em `--line-3`, tinta `--ink-4`, sem sombra, em toda variante, o fantasma incluído. A razão fica ao lado ou no tooltip, ligada por `aria-describedby` |
| Loading | O spinner do sistema em `currentColor` e o verbo no gerúndio (`Approving…`), `aria-busy="true"`, cursor `progress`. Uma leitura sem resultado usa o brilho, nunca o spinner |
| Error | Tinta `--state-error` sobre `--state-error-veil`, o verbo de nova tentativa (`Try again`, `Retry`). O que bloqueia sem ser erro é `◇` em tinta neutra, nunca vermelho |
| Error com foco | Os dois portadores convivem: o campo em erro mantém a borda `--state-error` e o trilho interno, e o foco acrescenta só o halo `--focus-halo` por fora; o anel `--focus` não substitui a borda de erro |

## Primitivos

Cada componente embrulha um primitivo gerado em `frontend/src/components/ui` (nunca editado), é próprio sobre um primitivo do Base UI (`@base-ui/react`) quando o gerado não alcança o estado do system pela classe, ou é próprio do MySpec. A tabela de cada arquivo, com a razão, está em `docs/architecture/design-system.md` (Componentes).

| Componente | Base |
|---|---|
| Botão, botão de ícone, grupo de painéis, seletor de tema | `button` (wrapper com as variantes daqui); o botão de painel é um botão com `aria-pressed` |
| Chip | `toggle` quando alterna, `button` com `dropdown-menu` ou `popover` quando abre |
| Input, textarea, busca | `input`, `textarea`, com `label` |
| Select, menu, menu do item | `dropdown-menu`, com os itens de rádio e de caixa próprios sobre o menu do Base UI |
| Listbox (escolhas longas com busca) | Próprio, sobre o `combobox` do Base UI |
| Popovers Review mode e Models | `popover` |
| Caixa de seleção | Próprio, sobre o `checkbox` do Base UI |
| Rádio, popover Review mode | Próprio, sobre o `radio-group` do Base UI |
| Opção de pergunta, veredito | O grupo de opções, próprio (`radiogroup`) |
| Controle segmentado | Próprio, sobre o `radio-group` do Base UI (`radiogroup`) |
| Abas de agente | Próprias (`tablist`) |
| Collapsible dos arquivados e dos diálogos | `collapsible` |
| Grupo de ações, marco em linha, dobra de trecho | Próprios: um botão com `aria-expanded` |
| Tooltip | Próprio, sobre o `tooltip` do Base UI |
| Diálogo de confirmação | `alert-dialog`; os de criação, em passos e a tela cheia, `dialog` |
| Tecla | `kbd` |
| Separadores | O fio do próprio componente; no menu, o separador do `dropdown-menu` |
| Área que rola (árvore, conversa, listas, painéis) | Própria, sobre o `scroll-area` do Base UI |
| Esqueleto | `skeleton` |
| Os demais | Próprios |

## Fundamentos

### Glifo de estado

| | |
|---|---|
| Anatomia | Forma de `--glyph` (10 px; `--glyph-sm` em abas, pílula e listas), par, centrada na coluna de ícone |
| Variantes | Erro: losango cheio (raio `--radius-glyph`). Espera: disco cheio com contorno. Encerramento: anel de 2 px. Trabalhando: anel com arco, girando. GitHub: círculo tracejado. Pausado: duas barras. Ocioso: círculo de 1 px. Bloqueio sem situação: losango contornado `◇`. Não iniciado: círculo em `--line-deco` |
| Estados | Só o spinner se move |
| Cor da espera | Todo preenchimento que diz espera (o disco, um ponto, um véu tingido) usa `--state-wait-glyph`; todo texto que diz espera usa `--state-wait` |
| Tokens | `--state-error`, `--state-wait`, `--state-wait-glyph`, `--state-wait-ring`, `--state-close`, `--state-work`, `--state-work-track`, `--state-github`, `--state-paused`, `--state-idle`, `--state-notice`, `--glyph`, `--glyph-sm`, `--glyph-diamond`, `--glyph-bar`, `--duration-spin` |
| Acessibilidade | `role="img"` com o nome do estado e o tempo, ou `aria-hidden` quando o texto ao lado já diz tudo |
| Faça | Use sempre com uma palavra ao lado ou no nome acessível |
| Não faça | Não use a identidade num glifo. Não anime um estado terminal |

### Spinner e brilho

| | |
|---|---|
| Anatomia | **Spinner**: um só no sistema, o meio arco do glifo "trabalhando": anel de `--glyph` com traço de `--border-2`, dois quartos em `--state-work` (ou `currentColor` num botão) sobre `--state-work-track`. **Brilho**: um gradiente que corre sobre o texto, o trilho ou o esqueleto |
| Sentido | O spinner diz que alguém trabalha: o agente, o app numa ação sua (`Cloning…`, `Publishing…`, `Saving…`). O brilho diz que uma leitura ainda não tem resultado: `checking GitHub`, `reading…` num nó, o medidor antes da primeira leitura, a escolha salva enquanto o catálogo de modelos é lido, `Refreshing the card…` |
| Movimento | `--duration-spin` e `--duration-shimmer`, lineares, em laço, só enquanto dura. Com movimento reduzido: o spinner para como anel de três quartos, o brilho vira tinta chapada |
| Faça | Use o spinner em botões carregando, na linha, na pílula e na atividade da conversa |
| Não faça | Não desenhe outro spinner. Não use laço para um estado terminal. Não use spinner para uma leitura |

### Ícones

| | |
|---|---|
| Anatomia | Um conjunto só, de traço, em `--icon` (16 px), `--icon-sm` e `--icon-xs`, traço `--icon-stroke`, pontas e junções arredondadas, `currentColor` |
| Significados fixos | Robô: modo `Agent`. Pessoa: modo `Manual`. `<>`: abrir no editor. Seta externa, a diagonal (`external`): abre fora do app (GitHub); é a única seta diagonal. Ir (`go`), o chevron para a direita: leva a um lugar do app (o nó de board e de Reviews, a linha de um prompt). Lápis: `Revised`. Cadeia: o gesto publica uma cadeia. Ampulheta: espera (neutra). Visto: feito, aprovado, escolhido. Documento (`file`): um artefato, um relatório, um painel de documentos. Arquivamento (`archive`): o item foi para o History. Merge (`merge`): a PR foi mergeada ou fechada. Lixeira (`trash`): apagado. Informação (`details`): o painel `Details`. Card (`card`): o painel `Card`. Balão (`conversation`): uma conversa em `Details`. Histórico (`history`): uma conversa anterior. Reticências (`more`): o menu do item. Pausa (`pause`) e play (`resume`): pausar e retomar. Na conversa: bandeira (`start`), o início de uma sessão; a marca do produto (`product`), a mensagem do produto; commit (`commit`); pull request (`pullRequest`), a PR aberta; lista com vistos (`checks`), os checks lidos; recolher (`compact`), a compactação do contexto; seta circular (`retry`), o retry automático; alerta neutro (`problem`), um problema que o produto achou; bloqueio (`ban`), uma interrupção; ramificação (`subagent`), o subagente; o garfo (`branch`), uma branch do git, na prévia de um apagamento; ampulheta (`hold`), a ação que espera a permissão. Nas listas e na Home: duas setas em ciclo (`refresh`), ler de novo (o board, as PRs, e o **Try again** de uma leitura que falhou), distinta da seta circular única do retry automático; três traços decrescentes (`filter`), o menu **Filter**; seta para baixo sobre a bandeja (`clone`), clonar; caixa com o visto (`select`), o modo de seleção; engrenagem (`settings`), Settings; mais (`plus`), começar algo novo; a pasta do git (`repository`), os repositórios, e **No board** na Home; a pilha de barras (`epic`), o épico. Os glifos de tipo (task, One-Shot, review, discussão, épico, board) são ícones, não glifos de estado |
| Tokens | `--icon`, `--icon-sm`, `--icon-xs`, `--icon-stroke`, `--ink-3` em repouso, `--brand-ink` ativo |
| Acessibilidade | `aria-hidden` ao lado de um rótulo; num botão só de ícone, o `aria-label` e o tooltip |
| Faça | Use um ícone por significado, o mesmo em todo o produto |
| Não faça | Não use dois ícones para a mesma coisa nem o mesmo ícone para duas. Não pinte um ícone com cor de estado fora de um glifo |

### Barra de rolagem

| | |
|---|---|
| Anatomia | Fina, sem trilho: o polegar em `--line-2`, raio `--radius-pill`, com `--border-2` de folga transparente; `--space-2-5` de largura |
| Estados | Hover no polegar: `--line-3` |
| Foco | A área que rola com o foco do teclado tem o anel de foco por dentro (`inset`), para não ser cortado pelo `overflow`; as entradas dentro dela têm o anel comum |
| Toda área que rola | A mesma barra em toda área que rola: a do `scroll-area` e, numa área que rola nativamente (o corpo de um diálogo, um `listbox`, o compositor, a saída de um comando), a regra global `::-webkit-scrollbar`, com a mesma anatomia e sem trilho. O WebKitGTK nunca pinta a barra do GTK |
| Faça | Deixe a rolagem nativa: a área que rola é `scroll-area` |
| Não faça | Não esconda a barra de uma área que rola |

### Tooltip

| | |
|---|---|
| Anatomia | A única superfície invertida: `--tooltip-surface`, texto em 13 px `--tooltip-ink`, tecla em mono `--tooltip-ink-2`, raio `--radius-sm`, até `--size-tooltip-max` |
| Comportamento | Abre depois de `--delay-tooltip` no hover e na hora no foco pelo teclado (o foco numa linha da árvore mostra o tooltip do nome); `Esc`, rolar ou clicar fecham; fica abaixo do alvo, ou acima quando não cabe, sempre em pixel inteiro |
| Usos | O nome e a tecla de uma ação; o relógio por extenso; o texto inteiro do que corta; a razão de um controle desabilitado; a lista das etapas do stepper; a hora exata da idade de uma leitura |
| Acessibilidade | `role="tooltip"`; nunca é o único portador de uma informação: o nome acessível já a tem |
| Faça | Escreva o atalho no tooltip de toda ação que tem um |
| Não faça | Não ponha controles dentro de um tooltip |

### Aviso de tecla

| | |
|---|---|
| Anatomia | A superfície do tooltip (`--tooltip-surface`, raio `--radius-sm`, até `--size-tooltip-max`), presa à linha em foco, abaixo dela, ou acima quando não cabe, em pixel inteiro: o que não aconteceu em `--tooltip-ink` e peso 600 (`No task from #412`) e, depois de ` · `, a razão em `--tooltip-ink-2` (`#412 already has a task: 412-rate-limit-per-api-key.`) |
| Quando | Uma tecla de uma letra que não age: `S`, `D` e `Space` na linha em foco da lista do board (ou no painel, preso à linha das ações), `N` num board nunca lido, preso a **New discussion**, e `R` na linha de uma PR de fork ou de clone inexistente, em Reviews. Os textos estão em `screens/board.md` §3.6 e em `tasks/05-board.md` §4.2 |
| Comportamento | Aparece na hora, sem atraso; some depois de 4 segundos, ou antes, na próxima tecla, quando o foco sai da linha, ao rolar ou ao clicar. Um aviso novo toma o lugar do anterior. Com movimento reduzido, entra e sai sem transição |
| Acessibilidade | `role="status"`, com o texto inteiro; não é `tooltip`, porque não descreve um alvo, e não fica na região `.toasts`, porque tem papel próprio |
| Não faça | Não use para uma ação que falhou (isso é o aviso do app) nem para uma tecla que age |

### Etiqueta, tag, placeholder e tecla

| | |
|---|---|
| Etiqueta | Contornada por `--line-2`, `--text-micro`, `--ink-2`, raio `--radius-xs`: `Draft` e a label de uma PR, o tipo do rascunho (`New card`, `Epic`, `Update gateway#461`), `Revised` com o lápis, `Default`/`Edited Sep 20` de um prompt e a etiqueta da prévia de **Delete task** (`3 uncommitted files`), as duas em `--ink-1` com `--line-3`. **`Suggested`**: `--brand-tint`, anel `--brand-ring`, tinta `--brand-ink`, só ao lado do veredito que as decisões sugerem |
| Tag | Mono de 12 px sobre `--surface-0`, raio `--radius-xs`, altura `--size-time-chip`: a ferramenta de uma permissão (`Bash`) |
| Placeholder | Mono de 12 px (`--text-micro`) sobre `--surface-0`, contorno `--line-2`, `--ink-2`, altura `--size-kbd`, sem ligaduras: `{{prd_path}}`, no prompt e na coluna do editor |
| Tecla | Mono de 12 px sobre `--surface-2`, borda `--line-2` com a de baixo em `--border-2`, `--size-kbd`. Dentro de um botão, a tecla da ação (`.k`), sempre em caixa, sem corpo: contorno `--line-2` no secundário e no fantasma, `--brand-key-ring` no primário, `--line-1` com a tinta `--ink-4` no desabilitado; nunca solta num botão e em caixa no vizinho. A tecla do primário tracejado tem o mesmo padding da do primário habilitado, para o botão ter a mesma largura nos dois estados. `Ctrl J` usa `--brand-tint` e `--brand-ring` |
| Faça | Escreva a tecla com a mesma forma em todas as ações de um grupo |
| Não faça | Não use etiqueta para status: status é glifo |

### Quem fala

| | |
|---|---|
| Anatomia | Uma palavra, sem avatar: `--text-micro`, peso 500, `--ink-3`, numa faixa de `--leading-micro` sobre o texto, na borda esquerda da conversa. A hora vem depois dela, em `--ink-4`, só com hover e foco na entrada |
| Variantes | **O agente**: o nome da conversa na tela (`Implementer`, `Reviewer`, `PRD agent`), escrito quando a voz muda (no início, depois de uma mensagem sua, de uma mensagem do produto ou de uma dobra de trecho). As ações e os eventos da sessão não mudam a voz. Numa fala seguida, a palavra aparece só com hover e foco. Na escrita, o spinner vem antes da palavra. **Você**: `You`, na cabeça da sua mensagem. O produto não fala: a mensagem dele é um marco |
| Regra | A faixa existe em toda fala, com a palavra visível ou não, para o texto nunca se mover. A palavra é neutra: o azul não marca quem fala |
| Faça | Deixe a aba dizer qual dos dois agentes de um step está na tela |
| Não faça | Não mostre a hora sem hover ou foco. Não use avatar: o produto não tem componente de avatar |

### Link

| | |
|---|---|
| Anatomia | Texto em `--brand-ink` com sublinhado permanente de 1 px a `--mix-link-line` |
| Estados | Hover: sublinhado cheio. Foco: anel. Pressionado: `--brand-active`. Indisponível: texto `--ink-4`, sem link. Carregando: spinner e `Opening PR…`. Erro: `✕` e a razão em vermelho |
| Tokens | `--brand-ink`, `--brand-active`, `--mix-link-line`, `--link-offset` |
| Faça | Sublinhe sempre: a cor não é o único portador. Um link que sai do app leva a seta externa |
| Não faça | Não use link para uma ação que muda estado: isso é botão |

### Troca de lugar

| | |
|---|---|
| Regra | Ir a um lugar é imediato: o lugar novo aparece inteiro, sem deslizar nem esmaecer. Só o que muda de estado dentro de um lugar se anima (painel que entra, menu, toast, piscada) |
| Foco | Numa ida por `Ctrl+J` ou pela notificação, o foco vai ao que o lugar pede (a primeira opção do cartão, **Allow**, a primária da barra do pedido, **Continue**, o compositor quando a resposta vai por ele, a barra sem ação habilitada, a lista). Quando o que tinha o foco resolve a situação e some, o foco vai ao compositor, à última entrada da conversa sem ele, ao título sem conversa. `Enter` e o clique numa linha da árvore deixam o foco na linha, para a árvore continuar sendo o painel de comando. `Alt+←`, `Alt+→` e os níveis do breadcrumb levam o foco ao título do lugar (o `h1`, com `tabindex="-1"`). O clique em `←` ou `→` deixa o foco no botão. A página do item que saiu recebe o foco em **Next that needs you** quando aparece |
| Faça | Traga a linha do lugar à vista na árvore na mesma troca |

## Controles

### Botão

| | |
|---|---|
| Anatomia | Ícone opcional, rótulo, tecla opcional (`.k`). Alturas `--size-control` (32), `-sm` (28), `-xs` (22); raio `--radius-sm` |
| Variantes | **Primário**: `--brand` com `--brand-on`, um por tela. **Secundário**: `--surface-2` com borda `--line-2` e `--shadow-button`. **Fantasma**: sem corpo, para ferramentas e ações raras. **Perigoso**: `--state-error` com `--state-error-on`, só como confirmação final de um diálogo. **New**: elevado sobre a lateral, com o texto em `--brand-ink`. **Ícone**: quadrado, sempre com `aria-label` e tooltip |
| Estados | Todos os comuns. Primário e perigoso escurecem no hover (`--brand-hover`, `--state-error-hover`) e mais no pressionado. Secundário usa `--surface-2-hover` e `--surface-2-press`. O fantasma que alterna um painel fica pressionado com `--brand-tint-plane` e `aria-pressed` |
| Uma primária por tela | A primária é a ação que resolve o que a tela pede. **Send** fica primário com texto só quando nenhuma outra primária está desenhada na tela, habilitada ou tracejada (a de um cartão pendente, a da barra do pedido, a da barra pausada); sem nenhuma, **Send** com texto é a primária |
| Desabilitado com o que falta | O botão que espera uma condição fica tracejado com o que falta ao lado, antes dele (`Decide 2 more`, `Stage 2 more files`, `Choose a verdict`, `Name the task to create it.`). Um botão não muda de largura com o estado: tracejado, o primário e o perigoso mantêm a tecla com o mesmo padding da tecla sobre o corpo cheio, e o que está ao lado, como **Cancel**, não anda |
| Tokens | `--brand*`, `--state-error*`, `--surface-2`, `--surface-2-hover`, `--surface-2-press`, `--line-2`, `--line-3`, `--shadow-button`, `--shadow-primary`, `--shadow-xs`, `--brand-key-ring` |
| Teclado | `Enter` e `Space`. A tecla da ação aparece no botão (`Allow 1`, `Publish review… Ctrl ↵`) e no tooltip (`Alt+←`) |
| Acessibilidade | Desabilitado com `aria-describedby` para a razão; carregando com `aria-busy`; painel com `aria-pressed` |
| Faça | Deixe a ação primária de cada tela como o único azul cheio |
| Não faça | Não ponha o perigoso na tela principal, fora de uma exceção: a confirmação final de um gesto dentro de um cartão pendente (**Deny**, depois de **Deny…**, no cartão de permissão). Não tire o tracejado de um fantasma desabilitado |

### Chip

| | |
|---|---|
| Anatomia | Pílula de `--size-chip` (28 px), rótulo em 13 px e peso 500, chevron quando abre. Em linhas densas, o chip `sm`: `--size-chip-sm` (22 px) com o rótulo em `--text-micro` |
| Variantes | **Seletor de modelo e esforço** (`Opus · high ▾`), no compositor e nas linhas de modelo. **Filter**, que abre o menu de filtros. **Chip que alterna** (`Assigned to me`, `aria-pressed`). **Filtro ativo**: escolhido, com `×` que é botão; um filtro órfão leva `◇` e a razão no tooltip |
| Escolha própria e padrão | Num seletor que segue um padrão (a task, **Defaults**, a fábrica), a escolha própria fica em `--ink-1`, peso 500, borda `--line-3`, com o padrão no tooltip (`Factory default: Fable 5.1 · high`); a que segue fica quieta (`--ink-2` numa linha de modelo, `--ink-3` no seletor de um step) |
| Estados | Todos os comuns. Aberto ou escolhido: `--brand-tint` com anel `--brand-ring`. Salvando: spinner e `Saving…`. Lendo o catálogo: a escolha salva com brilho, e o menu não abre (`Reading the models of Claude Code · the menu opens when it ends`). Indisponível: `◇`, `· unavailable` em `--ink-3` 400 e a razão no tooltip (`The installed Claude Code no longer lists Opus 4.1. A session still starts with it, and the CLI decides.`), sem trocar a escolha |
| Tokens | `--surface-2`, `--line-2`, `--line-3`, `--brand-tint`, `--brand-ring`, `--radius-pill`, `--size-chip`, `--size-chip-sm`, `--text-meta`, `--text-micro` |
| Teclado | `Enter` e `Space` abrem o menu; `aria-expanded`. O `×` de um filtro é uma parada própria |
| Faça | Use para uma escolha que muda o contexto do lugar |
| Não faça | Não use chip para status. Status é glifo e chip de tempo |

### Chip de tempo

| | |
|---|---|
| Anatomia | Pílula de `--size-time-chip` com o tempo (`18m`, `now`) em 12 px, peso 600, algarismos tabulares |
| Variantes | Espera: redondo, cheio de `--state-wait-chip`, tinta `--state-wait-chip-ink`, contorno `--state-wait-ring`. Erro: quadrado, cheio de `--state-error`, `!` antes do tempo em `--state-error-on`. Encerramento: redondo, contornado, `--state-close`. O relógio do agente não é chip: é texto `--ink-3` |
| Estados | Não é interativo. Na linha aberta, o chip de encerramento ganha o fundo `--surface-2` |
| Acessibilidade | O texto oculto diz `waiting for you` ou `error, waiting for you`; o tooltip diz o tempo por extenso |
| Faça | Mostre o tempo da situação mais grave e, entre iguais, da mais antiga |
| Não faça | Não use chip para o relógio do agente |

### Input, textarea e busca

| | |
|---|---|
| Anatomia | Rótulo acima (`.field`), com o complemento em `--ink-3` (`optional`, `optional with cards`); caixa de `--size-control` com borda `--line-3` sobre `--surface-input`; ajuda ou erro abaixo |
| Variantes | Input de uma linha; input em mono (nome da task, caminho); textarea de altura mínima `--size-composer-min`, ou das linhas que `rows` pede, na entrelinha do texto dele (`--leading-body`, `--leading-code` num código), redimensionável na vertical; textarea em mono (corpo de um rascunho, prompt); **busca** de `--size-control-sm`, com a lupa, o placeholder (`Search cards`) e a tecla `/`, que dá lugar a `×` com texto; contador a partir de 100 de 120 caracteres |
| Estados | Todos os comuns. Hover escurece a borda para `--ink-3`. Foco: borda `--focus` e halo. Erro: borda e trilho interno `--state-error`, a mensagem abaixo, validado enquanto se digita. Salvo enquanto se digita: a ajuda diz `Saved as you type.` |
| Tokens | `--surface-input`, `--line-3`, `--focus`, `--focus-halo`, `--state-error`, `--error-rail`, `--text-ui`, `--text-body`, `--text-meta` |
| Teclado | Na busca, `↓` vai à lista e `Esc` volta a ela |
| Acessibilidade | `label for`; o erro ligado por `aria-describedby`; `aria-invalid` no erro; a busca num `role="search"` |
| Faça | Diga o erro em texto, com o que corrigir, e ofereça a correção quando existe (`Use "rate-limit-v2"`) |
| Não faça | Não use o placeholder como rótulo |

### Select, menu e listbox

| | |
|---|---|
| Anatomia | Gatilho com a anatomia do input e um chevron; menu flutuante (`--surface-3`, `--shadow-float`, raio `--radius-lg`) com itens de `--size-control` |
| Variantes | **Lista de escolha** (`listbox`: visto no escolhido). **Menu de ações** (`menu`: o destrutivo por último, depois de um separador, em `--state-error`). **Grupos**: legenda em caixa alta de `--text-caps` e nota. **Modelo e esforço**: dois grupos de `menuitemradio`, `Model` e `Effort · <modelo>`; um modelo sem esforço diz `<modelo> has no effort levels.` Só em Settings › Defaults, a escolha de fábrica leva a marca `factory` e o pé diz `From the Claude Code installed here, read when MySpec opened.` **Item que alterna em três estados** (sem filtro, oculto `−dependabot`, só este `+rsouza`), com o menu aberto enquanto se alterna. **Com busca**: um campo no alto, para os cards de um board. **Item desabilitado com ação**: `Not cloned` com **Clone** no próprio item; o item fica no percurso das setas com `aria-disabled`, não é escolhível, `Enter` nele aciona a ação, o nome acessível diz os dois (`acme/billing, not cloned. Enter clones it.`), e o menu fica aberto enquanto o item passa a `Cloning…` e depois a utilizável, sem ser escolhido sozinho. **Opção desabilitada com razão**: não escolhível, com a razão como subtítulo (`not read yet`). **Linha de texto**: uma linha entre os itens que não é item, na altura dele, em `--text-ui` e `--ink-3`, sem realce e fora do teclado; é o nível do breadcrumb dobrado que não é lugar, como o épico |
| Largura do menu | O menu de um `Select` tem largura máxima `--size-menu-max`, ou a do gatilho quando ela é maior, e nunca passa da janela; nunca é mais estreito que o gatilho. O subtítulo de um item (a razão de um item desabilitado, o erro de um clone) fica numa linha e corta com reticências; o ponteiro sobre o corte abre o subtítulo inteiro num tooltip |
| Select compacto | `xs`, dentro de uma linha: gatilho de `--size-control-xs`, com `--space-2` de folga, a escolha em `--text-meta` e o chevron; o menu é o mesmo. É o seletor do clone em `Clone found · 2 clones:`, na linha do repositório do diálogo de board |
| Gatilho da lateral | O filtro por repositório usa o gatilho no tom da lateral: `--size-control-sm`, fundo `--sidebar-input`, borda `--sidebar-control`, rótulo em `--text-meta` e `--ink-2`. O menu é o mesmo |
| Estados | Gatilho: os comuns. Item: realce em `--veil-hover` (hover e teclado), escolhido com visto em `--brand-ink`, desabilitado em `--ink-4` com o motivo, destrutivo em vermelho. Menu com uma mensagem no lugar dos itens (`MenuMessage`), em `--text-meta`: carregando, neutra em `--ink-3`; com erro, em `--state-error` e `alert`, com **Try again** quando há; com aviso (`notice`), em `--ink-2` e `status`, para o que deixa o menu sem itens sem ser uma falha dele, como o catálogo de modelos que nunca foi lido (`features.md`, Modelos e esforço) |
| Tokens | `--surface-3`, `--shadow-float`, `--veil-hover`, `--veil-press`, `--brand-ink`, `--state-error`, `--size-menu-min`, `--size-menu-max`, `--size-control-xs`, `--text-caps` |
| Teclado | ↑↓ realçam, `Enter` escolhe, `Esc` fecha e devolve o foco ao gatilho, letras saltam ao item |
| Acessibilidade | `aria-haspopup`, `aria-expanded`, `aria-selected` ou `aria-checked`, `aria-disabled`; o item de três estados tem o estado no nome (`dependabot: hidden. Click to cycle.`) |
| Faça | Marque uma escolha que o catálogo não tem mais como indisponível, sem trocá-la |
| Não faça | Não misture ações e escolhas no mesmo menu |

### Menu do item (`⋯`)

| | |
|---|---|
| Anatomia | Botão fantasma de ícone no fim do cabeçalho; o menu de ações, agrupado por assunto, cada grupo com a legenda (`Pull request web#2291`, `Discussion`), o destrutivo por último, depois de um separador, em vermelho |
| Conteúdo | O da task, do review e da discussão está em `screens/task.md` §10, `review.md` §4 e `discussion.md` §3. **Review mode ›** e **Models ›** abrem os popovers |
| Estados | Item: os do menu. Desabilitado com a razão ao lado, depois de `·` (`Review again… · a pass waits for the checks`, `Archive… · a publication is running`). Submenu que não carrega: a mensagem no lugar dos itens |
| Ícones | Os itens só com texto. Só dois levam ícone, o do significado: `<>` em **Open in VS Code** e a seta externa no que abre o GitHub (**Open PR**). Igual nos menus da task, do review e da discussão |
| Teclado | A tecla da ação escrita no item (`Open in VS Code Ctrl+E`) |
| Faça | Deixe aqui as ferramentas do item e as ações raras e destrutivas. Cada destrutiva abre o diálogo que diz o que será perdido |
| Não faça | Não ponha aqui a ação que resolve uma situação sem repeti-la na barra do pedido |

### Caixa de seleção

| | |
|---|---|
| Anatomia | Caixa de `--icon` com borda `--line-3` sobre `--surface-input`, raio `--radius-xs`. Marcada: `--brand` com o visto em `--brand-on`. O alvo é a linha inteira, e a caixa é o sinal |
| Estados | Desmarcada, marcada, hover (borda `--ink-3`), foco (o anel da linha), pressionada (`--brand-tint-press`), desabilitada (tracejada, sem fundo, com a razão), cadastrando (spinner no lugar da caixa) |
| Usos | O modo de seleção do board, **Include the summary** na publicação, os repositórios de um board, os clones da varredura, os rascunhos de **Group drafts** |
| Variantes | **Linha que marca**: a linha inteira é o controle, com a caixa no início e o rótulo (`Include the summary`, um repositório). **Sinal**: só a caixa, `aria-hidden`, dentro de uma linha que já tem papel próprio (o `treeitem` do card no modo de seleção), que leva o `aria-checked`; sem hover próprio, porque o hover é o da linha |
| Acessibilidade | `aria-checked` na linha; a lista com `aria-multiselectable` |

### Rádio

| | |
|---|---|
| Anatomia | Anel de `--icon` com borda `--line-3` sobre `--surface-input`; escolhido, a borda em `--brand` e o ponto de `--space-2` em `--brand` |
| Estados | Padrão, hover (borda `--ink-3`), foco (anel por fora), escolhido, desabilitado (tracejado, sem fundo), erro (borda `--state-error` sobre `--state-error-veil`) |
| Usos | Uma escolha entre poucas opções numa tabela ou lista: os status de um board (`Ends the work`, `New cards`) |
| Acessibilidade | `radiogroup` com nome; ←→ ou ↑↓ trocam. Numa tabela, os rádios são `input` nativos de um mesmo `name`, cada um com o nome inteiro, e o grupo é o deles, sem um elemento que os envolva: o corpo continua o da tabela, e as setas numa caixa da mesma linha não trocam a escolha |
| Faça | Use o rádio numa lista de opções curtas; use a opção de pergunta quando cada opção tem uma linha do que faz |

### Grupo de opções

| | |
|---|---|
| Anatomia | Uma coluna de opções de pergunta, `--space-1-5` entre elas. Cada opção é uma caixa de raio `--radius-md` em `--surface-2` com anel `--line-2`, `--space-3` dos lados e `--space-2` em cima e embaixo, com a tecla (`1`, em `--key-size`, com o anel `--line-2` e `--border-2` embaixo, mono `--text-micro` `--ink-2`), o título em 500 `--ink-1`, uma etiqueta opcional depois dele (`Suggested`) e, embaixo, a nota do que a opção faz em `--text-meta` `--ink-3` |
| Estados | Padrão; hover (anel `--line-3`, fundo `--surface-2-hover`); foco (anel por fora); escolhida (fundo `--brand-tint`, anel `--brand-ring`, a tecla com a borda `--brand-ring` e a tinta `--brand-ink`); nenhuma escolhida, que o grupo aceita; desabilitada (tracejada, o título em `--ink-4`, sem hover, a razão embaixo em `--text-meta` `--ink-3`) |
| Tokens | `--surface-2`, `--surface-2-hover`, `--line-2`, `--line-3`, `--border-2`, `--brand-tint`, `--brand-ring`, `--brand-ink`, `--ink-1`, `--ink-2`, `--ink-3`, `--ink-4`, `--text-micro`, `--text-meta`, `--radius-md`, `--key-size`, `--space-1-5`, `--space-2`, `--space-3` |
| Usos | **Verdict** no diálogo de publicação; as opções do cartão de pergunta da conversa são desenhadas igual |
| Teclado | Uma parada de Tab: a opção escolhida, senão a primeira habilitada. ↑↓ andam entre as habilitadas, com volta; `Space` e `Enter` escolhem. As teclas numéricas ficam com quem usa o grupo |
| Acessibilidade | `radiogroup` com nome; cada opção é um `radio` com `aria-checked`; a desabilitada tem `aria-disabled` e a razão por `aria-describedby` |
| Faça | Use quando cada opção tem uma linha do que faz, ou quando nenhuma pode vir marcada; para opções curtas, o rádio |

### Controle segmentado

| | |
|---|---|
| Anatomia | Trilho `--surface-0`, raio `--radius-sm`, `--space-0-5` de folga, com dois ou três segmentos de `--size-control-xs` (ou `-sm` num diálogo), rótulo em `--text-meta`, ícone opcional (robô, pessoa), complemento em `--ink-3` (`Changes +4 −1`) |
| Escolhido | `--brand-tint` com anel `--brand-ring`, tinta `--ink-1`, peso 500. A forma é a de todo controle escolhido (princípio 2), não a da superfície elevada |
| Nota para a implementação | Os mocks (`lab/11-screen-board`, `lab/13-screen-discussion`) ainda desenham o segmento escolhido na superfície elevada (`--surface-2` com `--shadow-xs`). A regra é `--brand-tint`: a implementação segue a regra, não o mock |
| Variantes | **Mode** (`Structured` / `One-Shot`) e **Review mode** (`Agent` / `Manual`) na criação de task, com a linha do que o escolhido faz abaixo; **Mode** (`Publish` / `Apply`) no início de um review da sua PR; **Body** / **Changes** num rascunho de atualização |
| Estados | Segmento: hover (`--veil-hover`, tinta `--ink-1`), foco (anel por fora), escolhido, desabilitado (o grupo tracejado com a razão) |
| Tokens | `--surface-0`, `--brand-tint`, `--brand-ring`, `--ink-1`, `--ink-2`, `--size-control-xs`, `--radius-sm`, `--radius-xs` |
| Teclado | Uma parada de Tab, o escolhido; ←→ trocam a escolha |
| Acessibilidade | `role="radiogroup"` com nome, segmentos `role="radio"` com `aria-checked` (só ele) |
| Faça | Diga abaixo o que a escolha faz, e `Fixed once the task exists.` quando ela não muda depois |
| Não faça | Não use para mais de três opções: isso é select |

### Popover Review mode

| | |
|---|---|
| Anatomia | Popover (`--surface-3`, `--shadow-float`, largura `--size-popover`) com o título e duas opções em `radiogroup`, cada uma com o ícone, o nome e o que faz (`Agent`: *An agent reviews each step with the implementer; clean steps are committed.* `Manual`: *You review each step in VS Code, stage the files and approve.*); embaixo, a quem a troca vale (`Applies to the steps not started that follow the task: 5, 6, 7. Step 4 has its own mode.`) |
| Variantes | O popover da task. Em **Settings › Defaults**, as mesmas duas opções lado a lado, na página, com `Who reviews the steps of a new task` |
| Estados | Padrão, hover, foco, escolhida (`--brand-tint`), desabilitado com a razão quando nenhum step resta, salvando (spinner no lugar do visto e `Saving…` na nota), erro (`Couldn't save the mode · Try again` na nota) |
| Teclado | ↑↓ trocam; `Esc` fecha e devolve o foco ao gatilho |

### Linha de modelo por etapa e popover Models

| | |
|---|---|
| Anatomia | Uma linha por etapa: o nome da etapa (com a nota `Also where a review of someone's pull request starts` quando mais algo parte dela) e o chip de modelo e esforço à direita, que abre o `listbox` de modelo e esforço. Linhas separadas por `--line-1`, num grupo contornado |
| Variantes | **Popover Models** da task e do review: as etapas do modo do item, e a nota `A stage takes its model when it starts. Each step not started can have its own, in Details.` **Lista do diálogo de criação**: dobrada sob o **resumo de modelos** (seção abaixo). **Settings › Defaults**: as nove etapas agrupadas por parte do workflow, com `6 of 9 changed from the factory defaults` |
| Estados | Editável; própria ou mudada da fábrica (`--ink-1`, 500) e padrão (quieta); hover; foco; aberta; iniciada, sem edição (`Opus · medium · started`); salvando; erro ao salvar, com a razão e **Try again** fantasma `xs` sob a linha (`role="alert"`); indisponível (`◇`); lendo o catálogo (a escolha salva com brilho); catálogo nunca lido (o menu diz por quê no lugar dos itens, em `--ink-2`, nunca vermelho) |
| Resumo de modelos | Uma linha que abre e fecha a lista no lugar, com o chevron. À direita: `Defaults`, ou a primeira etapa ajustada, `+N` e `the rest from Defaults` |
| Teclado | `Esc` fecha o `listbox`, depois o popover, e o foco volta ao gatilho |
| Faça | Salve cada escolha na hora |

### Seletor de modo e de modelo de um step

| | |
|---|---|
| Anatomia | Na linha de um step não iniciado em `Details`: dois chips `sm`, o de modo (robô e `Agent`, ou pessoa e `Manual`) e o de modelo (`Sonnet · high`), e **Follow the task** quando o step tem escolha própria |
| Estados | Segue a task (`--ink-3`), própria (`--ink-1`, 500), hover, foco, aberto, iniciado (sem edição, o modo com que é revisado; `Manual` com o tooltip que diz por quê quando passou ao usuário), salvando, indisponível (`◇`) |

## Shell

### Cabeçalho do lugar

| | |
|---|---|
| Anatomia | Faixa de `--size-head` com um fio `--line-1` embaixo. **`←`** fantasma de ícone, com o destino no tooltip (`Back to Platform Roadmap · Alt+←`); **`→`** só quando há para onde avançar; o breadcrumb (`Platform Roadmap / API hardening /`, 13 px `--ink-3`, separadores `/` em `--line-deco` com `aria-hidden`), que dobra num `…` com os níveis escondidos no menu dele; o título em `--text-body` e peso 600; à direita, o que o lugar tem |
| Variantes | **Item**: o stepper ou a pílula, e à direita o medidor (só com a sessão na tela), **Pause** ou **Resume**, o grupo de painéis e `⋯`. **Lista** (board, Reviews): a idade da leitura, **Refresh**, e as ações do lugar. **Home**, **History**, **Settings**: o título; Settings tem **Close** `Esc`. **Arquivado**: `← History`, o glifo do tipo, o título, a etiqueta (`Archived`, `Merged`, `Closed`, `One-Shot`), e à direita o link do GitHub ou do board e `⋯` com **Delete…**. **Página que saiu**: `←` e o nome do item |
| Largura | Cede pela largura da área principal, em limites fixos, nunca pelo comprimento do que diz: primeiro o que fica em volta do stepper, depois as etapas feitas, depois o laço e a palavra da pílula, por último os nomes das futuras; o nome da etapa atual nunca sai. O título cede depois de tudo. A tabela está em `screens/task.md` §3 |
| Estados | `←` com o destino; os níveis do breadcrumb são links |
| Teclado | `Alt+←` e `Alt+→`; `nav` com `aria-label="Breadcrumb"` |
| Não faça | Não repita no título o glifo de tipo nem a referência: estão na árvore e em `Details` |

### Idade da leitura

| | |
|---|---|
| Anatomia | No cabeçalho de uma lista: `Read 2m ago` em `--text-micro` e `--ink-4`, com a hora exata no tooltip, e **Refresh**, fantasma de ícone |
| Estados | Lida; lendo (`Reading…` com o spinner, `role="status"`, **Refresh** tracejado); a última falhou (a idade da lista na tela, e a faixa de aviso no alto da lista). Fora do cabeçalho de uma lista, duas formas a mais: nunca lida (`Not read yet`, em Settings › Boards) e a falha (`◇ Read failed 18m ago` em `--ink-2`, com a hora da falha e a da leitura no tooltip, em Settings › Boards e na linha de board da Home) |
| Faça | Diga a idade do que está na tela, não da última tentativa |

### Linha da árvore

| | |
|---|---|
| Anatomia | Grade de três colunas: glifo (16 px), texto, borda direita. Linha 1: tipo e nome; meta ou `Ctrl J` à direita. Linha 2: glifo de estado, o que pede ou onde está (sempre com a posição), `+N`, e o relógio. Linha 3, só com o agente rodando: a ação em mono, verbo primeiro, e o medidor |
| Variantes | Os estados do glifo; task, One-Shot, review e discussão pelo glifo de tipo; o aviso de clone `◇`; itens de épico recuados em `--epic-indent`, ao longo da guia |
| Estados | Hover: `--veil-hover` e o meta aparece se couber. Foco: anel por fora. Pressionado: `--veil-press`. Aberta: `--brand-veil` com anel `--brand-ring` colado e o glifo de tipo em `--brand-ink`. Carregando: `checking GitHub` com brilho. Erro: trilho `--error-rail` na borda esquerda. Situação nova: pisca `--state-wait-veil` duas vezes |
| Largura | O nome ocupa as colunas 2 e 3. O meta aparece no hover, no foco e na linha aberta só quando cabe ao lado do nome inteiro; quando não cabe, vai para o tooltip do nome (`Rotate API keys without downtime · api#441`) e continua no nome acessível. `Ctrl J` fica sempre visível. Abaixo de 330 px de lateral, rótulos curtos e o medidor só com a porcentagem. A linha 3 passa à forma curta sempre que a longa não cabe |
| Tokens | `--surface-sidebar`, `--ink-1..4`, `--weight-name`, `--weight-name-waiting`, `--brand-veil`, `--brand-ring`, `--veil-hover`, `--veil-press`, `--row-pad-y`, `--row-gap`, `--line-gap`, `--tree-pad`, `--epic-indent`, `--sidebar-guide` |
| Teclado | A árvore é uma parada de Tab. ↑↓, `Home`, `End`, ← recolhe ou sobe, → expande, `Enter` abre |
| Acessibilidade | `treeitem` com `aria-level`, `aria-current="page"` na aberta; o nome acessível é a frase inteira (tipo, nome, cada situação com lugar e tempo, posição, quem trabalha, a ação e o contexto, o meta, e `Ctrl+J opens this next.` na linha da marca). A árvore é `Active items`, dentro da lateral `aside` `Work`. O texto e a gravidade de cada estado estão em `structure.md` §2 |
| Faça | Deixe o nome inteiro sempre que houver espaço, também em hover e em foco |
| Não faça | Não reordene a árvore sozinha. Não esconda a posição para caber. Não pinte `--ink-4` sobre a linha aberta: o meta sobe para `--ink-3` |

### Nó da árvore

| | |
|---|---|
| Anatomia | Nó de `--size-node`: chevron, título, e à direita `4 pending`, `reading…`, `◇ Read failed` ou o resumo do nó recolhido. No board e em Reviews, a seta de ir (`go`, `--icon-xs`) aparece depois do título em hover e em foco. O chevron recolhe e expande; o título abre o lugar (no épico e em No board, que não são lugares, o título também recolhe) |
| Variantes | **Board**: 14 px, 500, `--ink-2`, abre a visão do board. **Épico**: 13 px, 500, `--ink-3`, com a guia a 3:1 sob o chevron. **Reviews**: com a contagem de PRs pendentes, abre o lugar Reviews; com a leitura de um repositório falha, `◇ Read failed` com os repositórios no tooltip, como o board. **No board** |
| Estados | Hover, foco, pressionado; lugar aberto (a visão do board ou Reviews): `--brand-veil`, anel `--brand-ring`, `aria-current="page"`, a contagem sobe de `--ink-4` para `--ink-3`; recolhido com o resumo do mais grave ao menos grave (o mais grave nomeado); vazio (`No active items.`); lendo; falha de leitura (nunca uma situação) |
| Tokens | `--ink-2`, `--ink-3`, `--sidebar-guide`, `--veil-hover`, `--section-gap`, `--guide-x`, `--brand-veil`, `--brand-ring` |
| Resumo recolhido | Um glifo e uma contagem por estado, do mais grave ao menos (erro, espera, encerramento, trabalhando, GitHub, pausado; o ocioso não conta), só o primeiro com a palavra (`error` ou `errors`, `waiting`, `to close`, `working`, `checks`, `paused`). O nó de board conta também os itens dos épicos dele |
| Acessibilidade | `aria-expanded`; o grupo apontado por `aria-owns`; o resumo recolhido tem nome acessível com todas as contagens (`1 error, 2 waiting, 1 ready to close, 1 on GitHub`) |
| Faça | Deixe o board acima do épico em tamanho e tinta |
| Não faça | Não use caixa alta num nó que é um lugar |

### Indicador de rolagem da árvore

| | |
|---|---|
| Anatomia | Esmaecido do fundo da lateral sobre as últimas linhas e `↓ N more below` em 12 px `--ink-3`, altura `--size-more-below` |
| Estados | Some quando nada está abaixo da vista; o clique rola ao fim. Não é uma parada de Tab: a árvore já se percorre pelo teclado |

### Faixa recolhida da lateral

| | |
|---|---|
| Anatomia | A lateral em `--sidebar-collapsed` (60 px), no tom dela, em três faixas como a aberta. **Topo**: `»`, fantasma de ícone, e abaixo **New** como botão de ícone (o `+` em `--brand-ink`), com o mesmo menu. **Blocos**: um por item, na ordem da árvore, todos os itens, também os de um nó recolhido; bloco de 60 px de largura com `--tree-pad` de folga, o ícone de tipo em `--icon`, centrado, com o `StateGlyph` pequeno (`--glyph-sm`) no canto inferior direito, contornado por `--border-2` de `--surface-sidebar`; `+N` no canto superior direito, em `--text-micro` `--ink-3`; embaixo, centrado, o chip de tempo do system, ou o relógio do turno em `--text-micro` `--ink-3`, ou a palavra do estado (`checks`, `paused`, `idle`, `working`) em `--text-micro` `--ink-4`; o trilho de erro na borda esquerda. **Separadores**: entre os grupos, um fio de `--line-1` com, centrados, o `◇` da falha de leitura ou do clone, e em Reviews a contagem de pendentes em `--text-micro`; não são paradas de Tab. **Rodapé**: em coluna, três botões de ícone: **History** (a contagem no nome acessível e no tooltip, não visível), o tema e **Settings** |
| Estados | Hover `--veil-hover`; foco pelo anel por dentro, porque a faixa rola; pressionado `--veil-press`; aberto `--brand-veil` com `--brand-ring` colado e o ícone de tipo em `--brand-ink`; situação nova pisca como a linha. Sem a marca `Ctrl J`: o bloco que o atalho abriria diz `Ctrl+J opens this next.` no nome acessível |
| Teclado | A faixa é `role="tree"`, uma parada de Tab; ↑↓, `Home`, `End`, `Enter` abre |
| Acessibilidade | O nome acessível de cada bloco é o da linha inteira; o tooltip tem o nome do item e o que ele pede |

### Seletor de tema

| | |
|---|---|
| Anatomia | Fantasma de ícone no rodapé da lateral, com um ícone fixo (o meio disco); o estado está no nome e no tooltip. É o único lugar do tema |
| Estados | Três, em ciclo: System, Light, Dark. O estado está no `aria-label` e no tooltip (`Theme: System · click to change`) |
| Faça | Aplique na hora, sem recarregar |

### Rodapé da lateral

| | |
|---|---|
| Anatomia | Três fantasmas: **History** com a contagem de arquivados (`History 44`, e no tooltip `44 archived: 22 tasks, 12 reviews, 10 discussions`), o seletor de tema e **Settings** |
| Estados | **History** e **Settings** ficam pressionados enquanto o lugar deles (ou um arquivado) está aberto: `--brand-tint-plane`, anel `--brand-marker-ring`, `aria-current="page"`. Nas boas-vindas, **History** fica tracejado (`Nothing archived yet`); o tema e **Settings** funcionam |

### Painel auxiliar

| | |
|---|---|
| Anatomia | Coluna à direita da área principal, afundada (`--surface-0`), largura `round(down, var(--panel-width), 1px)`. Cabeçalho de `--size-head` com o título em `--text-ui` 600, e o `×` (`Close · Esc`); corpo que rola, em `--text-meta` |
| Variantes | **Do item**: `Details`, `Artifacts` e `Card` (task), `Details` e `Reports` (review), `Details` e `Documents` (discussão). **Da lista**: o card no board e a PR em Reviews, largura `round(down, var(--panel-card-width), 1px)`, com a faixa de `--size-head` no lugar do título (`#474 · acme/api` em `--text-meta` `--ink-3`, **Open on GitHub** fantasma de ícone com a seta externa, e `×`), o título em `--text-title`, as ações, os avisos, o bloco do item, os fatos em chave e valor, o corpo em Markdown no registro de leitura e as relações |
| Coluna ou cobertura | O painel do item fica ao lado enquanto a conversa cabe inteira (área principal − painel ≥ 760 px); o painel da lista, enquanto a lista mantém 440 px. Fora disso, cobre com `--surface-3` e `--shadow-overlay` |
| Grupo de painéis | No cabeçalho, os botões dos painéis do lugar como um grupo que alterna: o aberto pressionado (`--brand-tint-plane`, `aria-pressed`); abaixo de 1440 px de área principal, só o ícone, com o nome no tooltip e no nome acessível. `Artifacts`, `Reports` e `Documents` usam o ícone de documento (`file`) |
| Regra em pixel | A largura do painel e a condição da coluna ficam em pixel inteiro: com `--panel-width`, a regra `área principal − painel ≥ 760 px` vale exatamente a partir de 1120 px de área principal, e é uma container query nesse limite. Com `--panel-card-width`, a regra `área principal − painel ≥ 440 px` vale exatamente a partir de 800 px de área principal (abaixo de 857 px o painel tem o mínimo de 360 px, e 800 − 360 = 440; acima, a lista fica com 58% da área, sempre mais de 440), e é a container query do painel da lista |
| Estados | Entra em `--duration-base` com `--ease-enter`, por opacidade e um deslocamento de `--space-4` da direita; sai em `--duration-fast` com `--ease-exit`. Não é modal: o foco fica no botão que o abriu, e `Esc` fecha e devolve o foco a ele; vazio com o que falta (`No artifacts yet`, `Steps come from the plan`); carregando; o item da lista que saiu da leitura: a faixa de aviso no alto e as ações tracejadas |
| Teclado | Um de cada vez; `Esc` fecha; o teclado continua na lista enquanto o painel da lista está aberto. O painel da lista não tem botão que o abriu: `Esc` e o `×` devolvem o foco à linha do card, quando ele estava no painel |
| Acessibilidade | `aside` com o nome (`Card #474`) |
| Faça | Deixe fechado por padrão e abra só por uma ação do usuário |
| Não faça | Não abra um painel sozinho. Não troque de documento sozinho |

### Página do item que saiu

| | |
|---|---|
| Anatomia | No lugar do item, na medida `--measure-read`: um ícone neutro (arquivo, merge, lixeira), o título em `--text-title` (`web#2291 was merged, and its review ended`, `Usage-based pricing tiers was archived`, `This task was deleted.`), o que aconteceu, o resultado num bloco afundado (o resultado do encerramento, uma linha por passada, uma linha por rodada publicada; no apagado, o que ficou no disco com o comando copiável), e as ações |
| Ações | **Next that needs you** `Ctrl J` (primária, com o foco, o destino no tooltip: `Next: <nome do item> · Ctrl+J`), **Open in History** (menos no apagado) e a volta (**Back to Reviews**, **Open Platform Roadmap**). Sem nada esperando: **Next that needs you** tracejado com `Nothing else needs you now.`, e **Open in History** primária, com o foco. Os casos estão em `screens/rest.md` §9 |
| Faça | Diga o que aconteceu e o resultado. Nunca deixe a área vazia |

### Estado vazio de página

| | |
|---|---|
| Anatomia | No lugar da lista ou do conteúdo, alinhado à esquerda na medida da lista, como nos mocks: o título em `--text-ui` 600, o texto em `--ink-3` (o que aparece ali e quando), e a ação que o resolve (**New discussion**, **Read now**, **Clear filters**) |
| Variantes | Vazio de verdade (`This board has no issues.`, `No open pull requests.`); filtro sem resultado (`No cards match the filters.`, o que foi pedido, **Clear filters**, com a barra de filtros à vista); nunca lido e falhou (`Couldn't read the board`, a mensagem, **Try again**); Home sem item (`Nothing in progress`) |
| Faça | Diga o que faria algo aparecer. A ação do vazio é a saída dele, ao lado do texto que a explica, mesmo quando o cabeçalho ou a barra já a têm (**New discussion** num board sem issues, **Clear filters** num filtro sem resultado) |
| Não faça | Não ponha no vazio uma ação que não o resolve |

### Estado vazio de um lugar

| | |
|---|---|
| Anatomia | No alto da coluna da conversa, com `--space-16` × 2 acima: o título em `--text-title` 600 `--ink-1`, o texto em `--text-body` `--ink-3` na medida `--measure-read`, `--space-2` entre os dois, e, com `--space-3` acima, o bloco do que espera (os checks ao vivo, o bloco de erro) na largura da coluna |
| Usos | `The review starts when the checks finish.` com os checks; `The pull request stage stopped` com o bloco de erro; `Every step is committed`; `No steps were found`. O app trabalhando sem nada a dizer além disso é a atividade, não este estado |
| Acessibilidade | O título é um parágrafo, não um cabeçalho; o bloco mantém o papel dele |
| Não faça | Não ponha ação aqui: a ação é da barra do pedido |

### Esqueleto

| | |
|---|---|
| Anatomia | Barras de `--space-4` em `--surface-0` com o brilho, na forma do que virá: quatro linhas de lista, três entradas da conversa, a lateral no início do app, a prévia de um apagamento |
| Acessibilidade | um grupo ocupado (`role="group"`, `aria-busy`) com o que se lê no nome (`Reading the board…`) |
| Não faça | Não use esqueleto numa releitura: a lista guardada fica, e a idade diz `Reading…` |

### Faixa de aviso

| | |
|---|---|
| Anatomia | Afundada (`--surface-0`, contornada por `--line-2` quando o fundo já é afundado), raio `--radius-sm`, `--text-meta`: `◇`, o que bloqueia e quando (`Couldn't read the board · 4m ago`), a razão em `--ink-2`, e a ação (**Try again**, **Change path…**, **Clone**) |
| Variantes | **Sob o cabeçalho de um item**, na medida da conversa: o clone inexistente, `Couldn't check GitHub`; a conversa passa por baixo com o esmaecido. **No alto de uma lista**: a falha de leitura do board, uma por repositório em Reviews. **No alto de um painel**: o card fora da última leitura. **Sob uma linha**: na Home e em Settings, o que bloqueia um board ou um repositório (sem clone, clonando, clone inexistente, leitura falha) |
| Faixa estreita | O título e a razão são um texto só, que quebra em linhas inteiras, nunca uma palavra por linha. Abaixo de 32rem de largura da faixa, o texto toma a linha inteira ao lado do glifo, e a ação (**Try again**) desce para uma linha própria, à direita |
| Estados | Padrão; tentando (a ação vira `Reading…` com o spinner); erro de uma ação (o clone que falhou: a mensagem do `gh` em vermelho, sem fundo, com **Try again**) |
| Acessibilidade | `role="alert"` para uma falha que chega; `role="status"` para a tentativa |
| Faça | Deixe à vista o que estava na tela: a faixa fica sobre a leitura guardada |
| Não faça | Não pinte de vermelho o que não é erro de uma ação sua. Nunca é situação e nunca notifica |

### Linha afundada

| | |
|---|---|
| Anatomia | Uma linha em `--surface-0`, raio `--radius-sm`, `--text-meta` em `--ink-2`, com ícone opcional e ação opcional à direita |
| Variantes | **Contexto montado**: `From the card: #474, the epic Usage-based billing, 6 cards of the epic, 1 dependency and the discussion Usage-based pricing tiers · 5,690 characters`, com **Show**/**Hide** (o texto somente leitura, até nove linhas) e **Add to it**; relendo, com brilho e **Show** tracejado; falha, com `◇` e a razão. **O que vai para o GitHub** (`2 inline comments · the summary in the body · 1 finding discarded, not published`; a fórmula está em `screens/review.md` §11). **O que o gesto publica**, com o ícone da cadeia ou da ampulheta, antes da decisão de um rascunho. **Nota** no alto de um diálogo, com `◇` e uma ação (`2 commits arrived after this pass…` **Review again instead**; `The decisions and edits of review 1 will be discarded.`). **Card de entrada** num diálogo (`#474`, o título em 500, `acme/api · Ready · Usage-based billing`) |
| Acessibilidade | A linha do que o gesto publica é a descrição acessível de **Approve** (`aria-describedby`) |
| Faça | Diga numa linha o que o produto montou ou o que vai acontecer |

### Aviso do app e toast

| | |
|---|---|
| Aviso do app | Faixa no topo da área principal, sobre o cabeçalho, `--state-error-veil` com trilho, o rótulo em vermelho e 700, que é a ação que falhou (`Couldn't pause Rate limit per API key`), o detalhe com o que aconteceu e o que fazer (`<mensagem do erro>. <o que fazer>`, e só a mensagem quando a ação não tem saída conhecida), e **Dismiss**. Fica até ser dispensado; a próxima falha substitui a anterior. Só para uma ação sem lugar próprio: a falha que tem lugar (a linha do modelo, o rodapé do diálogo, a linha do repositório) fica nele |
| Toast | Flutuante, `--surface-3` com `--shadow-float`, até `--size-toast`: ícone, texto (`“Idempotency keys for payment intents” was archived`), detalhe (o resultado curto), **Open in History** sob o texto, e `×`. Só para uma task, um review ou uma discussão que saiu sem estar aberta. Fica 10 segundos, contados só enquanto ele não tem o ponteiro nem o foco; até três empilhados. O quarto que chega não espera: o mais antigo sai no mesmo instante, com a saída de `--duration-fast` |
| Estados | O toast entra em `--duration-base` com `--ease-enter` e sai em `--duration-fast` com `--ease-exit`; mora na região `.toasts`, embaixo à esquerda da área principal (`--z-toast`), que é também a região `aria-live` do app |
| Tokens | `--surface-3`, `--shadow-float`, `--state-error-veil`, `--state-error`, `--error-rail`, `--notice-detail-min`, `--size-toast`, `--z-toast` |
| Acessibilidade | A região `.toasts` (`role="status"`, `aria-live="polite"`) é a única região ao vivo dos toasts e dos anúncios do app (situação nova, `Ctrl+J` sem destino, página do item que saiu): os toasts dentro dela não têm papel próprio, e o anúncio é um texto visualmente oculto no mesmo contêiner. Os componentes com papel próprio (a idade da leitura, o esqueleto, a faixa de aviso, a barra do pedido, a atividade, a linha do que o gesto publica, a barra da seleção) o mantêm, fora dela e nunca dentro dela. Aviso em `role="alert"` |
| Não faça | Não use toast para o item aberto nem para algo que depende do usuário: isso é uma situação |

## O item aberto

### Stepper e pílula

| | |
|---|---|
| Anatomia | No cabeçalho, depois do título. Uma lista ordenada, sem trilha inteira e sem tempos, com três formas de etapa ligadas por traços de `--space-3` em `--line-2`. **Feita**: visto de `--icon-xs` e o nome em `--ink-3`. **Futura**: círculo de `--glyph-sm` em `--line-deco` e o nome em `--ink-4`. **Atual**: a pílula |
| Pílula | `--size-control-sm`, `--brand-tint-plane` com anel `--brand-marker-ring`, raio `--radius-pill`: o nome em `--brand-ink` e peso 600, a posição em `--ink-2` com algarismos tabulares (`3/7 · pass 2`), um divisor fino, o glifo do estado e a palavra do estado (`working`, `checks 3/5`, `published` com o círculo fino do ocioso, `paused`) |
| Variantes | **Stepper da task**: as etapas do modo (Structured: `PRD`, `Tech spec`, `Plan`, `Implementation`, `PR`, `PR review`, `Closing`; One-Shot: `Planning`, `Implementation`, `PR`, `PR review`, `Closing`). **Pílula sozinha** no review (`Pass 1`) e na discussão (`Discussing`, `Round N`). O que cada uma diz em cada momento está em `screens/task.md` §4, `review.md` §4 e `discussion.md` §3 |
| A situação é dita uma vez | Com uma situação no item, a pílula mostra só o glifo e a posição; a palavra fica no nome acessível |
| Estados | Hover num ponto dobrado mostra o nome; foco (uma parada de Tab, com o progresso inteiro no nome acessível e a lista das etapas no tooltip); sem ação no clique; pausada (pílula neutra: `--surface-0`, anel `--line-2`, nome `--ink-2`, `paused`); carregando (os nomes com brilho); erro (o losango) |
| Largura | Abaixo de 1300 px de área principal, os traços saem; de 1200, as feitas ficam só com o visto; de 1040, a pílula perde o qualificador (o que vem depois de `N/M`) e a palavra; de 900, as futuras ficam só com o círculo. Os nomes vão ao tooltip e ficam no nome acessível. "Abaixo de" é `width < N` |
| Acessibilidade | `aria-current="step"` na atual; o nome acessível `Progress · <etapa>[ <posição>][ · <qualificador>] · <estado>`, com o estado de uma situação como o anúncio o diz (`waiting for you: question in Reviewer`) ou o que roda (`Implementer working`, `waiting for the checks, 3 of 5 passed`, `paused since 14:52`); as etapas dobradas com `· done` ou `· to come` num texto oculto (`screens/task.md` §4) |
| Faça | Traga a posição dentro da etapa na pílula |
| Não faça | Não ponha ação no stepper: **Back to…** e **Discard and restart…** ficam no `⋯` |

### Abas de agente

| | |
|---|---|
| Anatomia | Duas abas de texto, `Implementer` e `Reviewer`, alinhadas à esquerda na coluna da conversa (`--measure-conversation`), sobre um fio `--line-1`, sem fundo, altura `--size-tab`. Cada uma: o glifo da sessão (`--glyph-sm`) e o nome |
| Quando existem | Num step `Agent`, da primeira passada do revisor até o commit. A mesma forma serve às abas de uma task arquivada (**PRD**, **Tech spec**, **Steps · 6**, **Pull request**; **One-Shot document** numa One-Shot), sem glifo |
| Estados | Escolhida: `--ink-1`, peso 600, sublinhada por `--border-2` em `--brand`. A outra: `--ink-3`; hover em `--ink-1`. A de fora diz a palavra só quando espera ou falhou: `Implementer · waits` em `--state-wait`, `Reviewer · error` em `--state-error`, com o que pede no tooltip. Foco: anel por dentro. Desabilitada com a razão (`Reviewer · starts with pass 1`). Carregando (`starting`, spinner) |
| Teclado | `tablist` com uma parada de Tab, a escolhida; ←→ trocam de aba e abrem a conversa; o produto nunca troca de aba sozinho |
| Acessibilidade | `role="tab"`, `aria-selected`, `aria-controls` para a conversa; o nome acessível e o tooltip `<Nome>: <estado>` (`Implementer: waits for you: permission, for 4 minutes`, `Reviewer: working`) |
| Faça | Mantenha o glifo da outra conversa visível: é ele que aponta onde mais se espera |
| Não faça | Não ponha chip de tempo na aba |

### Barra do pedido

| | |
|---|---|
| Anatomia | Acima do compositor, na coluna da conversa (`--measure-conversation`), com as mesmas bordas das entradas, `--size-ask` de altura mínima: à esquerda o glifo, o rótulo em 700, o lugar e o chip de tempo; no meio o progresso (`1 of 4 decided`, `5 of 7 files staged · 71%`), nunca a razão que o bloco de erro já diz; à direita as ações |
| Variantes | **Quieta** (`--surface-0`): o cartão na conversa tem o conteúdo e a resposta, a barra tem **Show**. **Tingida** (`--state-wait-veil`): o pedido sem cartão com ação própria; a barra tem a ação. **De decisão**: tingida. Com algo por decidir, o progresso, **Next to decide** `Alt ↓`, **Approve the rest** (secundário, sem tecla, tooltip `Approve the 3 findings not decided yet`, `Approving…` enquanto grava) e a primária tracejada com o que falta (**Apply approved**, **Publish review…**); com tudo decidido, só a primária, habilitada. **Erro** (`--state-error-veil` com trilho). **Encerramento**: fundo quieto, rótulo em `--state-close` (`Ready to close`, `Ready to archive`). **A outra conversa espera**: quieta, `● The reviewer waits · Question 18m` com **Go to reviewer**. **A outra conversa falhou**: fundo quieto com o trilho de erro, o losango e o rótulo em `--state-error` 700, `◆ Session error · Reviewer` com **Go to reviewer**. O lugar de toda forma é a conversa (`Reviewer`, `PRD`, `PR review`), sem a passada, que está na pílula; no review de uma PR, que tem uma conversa só, o lugar é a passada (`pass 1`); na barra dos apontamentos da PR da task, a conversa e a passada (`PR review · pass 1`), porque é a passada que se decide. **Pausada**: o item pausado não tem situação, e a barra mostra o que o estado pede com a ação, quieta, com as duas barras no lugar do glifo, o rótulo em `--ink-1` 700 e sem chip de tempo |
| Conteúdo | O que cada situação diz e a ação estão em `screens/task.md` §7, `review.md` §10 e `discussion.md` §8 |
| Estados | A ação segue os estados do botão (`Retrying…`, `Publishing…`). Existe só enquanto o item pede algo; ao nascer com a tela aberta, pisca duas vezes no véu da gravidade e é anunciada |
| Largura | Quebra em duas linhas antes de esconder uma ação |
| Tokens | `--surface-0`, `--state-wait-veil`, `--state-error-veil`, `--error-rail`, `--state-wait`, `--state-error`, `--state-close`, `--size-ask` |
| Teclado | `Ctrl+Enter` abre a publicação com o foco na barra ou no cartão, nunca no compositor |
| Acessibilidade | `role="region"` com o nome `Request`; o texto de estado em `role="status"` |
| Faça | Deixe a ação que resolve aqui e em nenhum outro lugar, fora as exceções de `structure.md` §3 |
| Não faça | Não repita o comando nem a pergunta: a barra é a chamada, o cartão é o conteúdo |

### Compositor

| | |
|---|---|
| Anatomia | Caixa `--surface-input` com borda `--line-3`, raio `--radius-lg` e `--shadow-xs`, na coluna da conversa (`--measure-conversation`), com as mesmas bordas das entradas: as pastilhas (quando há), a textarea em 15/22, e o rodapé com o seletor de modelo e esforço da sessão à esquerda e, à direita, **Send**, ou `◌ Working · 3m 40s` e **Stop** |
| Quando existe | Sempre que a conversa na tela tem uma sessão aberta. Sem ela (ainda não aberta, ou fechada pelo produto, como o review da PR depois de um review limpo), sai, e o vazio ou o bloco de erro dizem por quê |
| Placeholder | Diz a quem se responde e como: `Answer with 1–3, or reply to the reviewer…`, `Queue a message for the implementer…`, `Sending restarts the reviewer's session…`, `Reply to the reviewer to go on…` (um turno que falhou), `Ask the PR agent to add, change or drop a finding…` (no review, `the reviewer`), `Ask for changes: add, change or drop a draft…`, `Sending resumes the task…` |
| Pastilhas | **Resposta rápida**: uma pastilha por opção de uma pergunta em texto (`a · Yes. Read the limits from the plans table…`), que envia a letra. **Começo de mensagem**: **Ask for changes**, **Ask to fix the drafts**, que põem no começo da caixa `Change the drafts: ` ou `drafts.md can't be read: <razão> Rewrite it in the format MySpec reads. `, a menos que ela já comece por ele, com o foco no fim do texto. Contornadas por `--line-2`, `--text-meta`, raio `--radius-pill`; hover, foco, pressionada |
| Estados | Hover, foco (borda e halo), com texto (**Send** primário só se nada mais na tela espera uma resposta), enviando (**Send** diz `Sending…` e o texto fica), erro (o texto fica, `Not sent · <razão>` no rodapé e **Send again**), agente trabalhando (`◌ Working · 3m 40s` e **Stop**; com texto, **Send** secundário antes dele, e a mensagem entra na fila), pausado (enviar retoma a sessão). A caixa cresce até `--size-composer-max` e depois rola |
| Tokens | `--surface-input`, `--line-3`, `--focus`, `--focus-halo`, `--shadow-xs`, `--state-error`, `--size-composer-min` |
| Teclado | `Enter` envia, `Shift+Enter` quebra a linha |
| Acessibilidade | Rótulo que diz a quem se responde (`Reply to the implementer`) |
| Não faça | Não desabilite o compositor numa conversa em que o produto não age mais: ele continua aceitando mensagens |

### Volta ao fim

| | |
|---|---|
| Anatomia | Botão flutuante (`--surface-3`, `--shadow-float`, largura mínima `--newmsg-w`) acima da barra do pedido, fora do fim da conversa: `↓`, `New messages` e o número do que chegou desde que você saiu do fim, um fio, e quem trabalha (`◌ Implementer writing`) |
| Estados | Padrão, hover, foco, pressionado, nada novo (só `↓`). Some no fim |

### Conversa anterior

| | |
|---|---|
| Linha em `Details` | Sob cada step commitado e em **Planning** e **Pull request**: `Implementer`, `Reviewer`, `PRD`… com a hora de início; abre a conversa, e um segundo clique volta à atual. A conversa na tela aparece com `now`, sem abrir. Estados: padrão, hover, foco, sendo lida (`aria-pressed`, `--brand-tint-plane` com anel `--brand-marker-ring` e tinta `--brand-ink`), carregando (`Opening the conversation…` com o spinner), erro (`Couldn't open it · Try again`, com o losango, na linha) |
| Faixa | No lugar do compositor enquanto se lê, `--size-ask`, `--surface-0`, raio `--radius-md`, `--text-meta` `--ink-3`: o ícone `history`, o lugar em `--ink-1` 600, `Step 2 · Implementer · an earlier conversation. It takes no more messages.`, e **Back to step 3** (secundário, tooltip `Back to where the task is · Esc`), com a conversa do lugar atual no rótulo. A conversa anterior abre no começo. A barra do pedido, as abas e o medidor saem enquanto se lê; `Esc` volta; com o painel cobrindo a conversa, abrir uma conversa anterior fecha o painel |

## A conversa

A conversa é uma coluna centrada de `--measure-conversation` (60rem, 960 px), e tudo o que está nela tem a mesma borda esquerda e a mesma borda direita: a fala, a sua mensagem, os grupos de ações, o código, as tabelas, o mermaid, os cartões, os apontamentos, o erro e o corpo de um marco. A barra do pedido, o compositor e as abas seguem a mesma coluna. Nenhum texto fica numa medida mais estreita que os blocos ao lado. As linhas (grupo, marco, dobra) têm o texto na borda, e o véu de hover passa `--space-2` para fora. Nenhuma hora fica à vista: ela aparece com hover e foco e está no nome acessível de toda entrada.

### Entradas da conversa

| | |
|---|---|
| Fala do agente | Texto na página, sem cartão e sem fundo: a faixa de quem fala e o Markdown em `--text-body`/`--leading-body` (15/22) e `--ink-1`, com cabeçalhos, listas, tabelas, mermaid e código na largura da coluna. `Interrupted by you` é uma linha sob a fala interrompida por **Stop**; uma queda da sessão é o bloco de erro |
| Streaming | A fala cresce e termina num cursor parado, em `--ink-3`. O spinner fica antes da palavra de quem fala; ele é o único laço da fala |
| Mensagem do usuário | Na largura da coluna, em `--surface-user`, raio `--radius-lg`: `You`, a hora com hover e foco, e o texto em 15/22, sem Markdown. Sem destinatário. Enviando e não enviada são estados do compositor: a mensagem só existe depois que o envio deu certo |
| Mensagem na fila | A mesma forma em `--surface-0`, com `Queued · sends when the turn ends` (com a sessão em erro, `sends after the retry`; pausada, `sends when the task resumes`) e **Remove** na cabeça. Sai da fila quando o turno acaba. Só a mensagem do usuário entra na fila: uma entrada do produto pendente (o prompt de uma etapa ou de um step, a instrução de uma passada) é o marco da mensagem do produto, sem **Remove**, e o produto não aceita apagá-la |
| Atividade | Uma linha no fim, em `role="status"`, com o spinner: `Starting session…`, `Thinking…`, `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8s` |
| Ritmo | `--space-3` entre as entradas |
| Acessibilidade | A conversa é um `feed`, e cada filho é um `article` com nome (`Implementer, 14:19`, `You, 14:28`, `14 actions, Read 8 · Searched 4 · git 2, started 13:48`) |
| Não faça | Não ponha a fala num cartão nem pinte quem fala com cor de marca. Não estreite o texto dentro da coluna |

### Marco em linha

| | |
|---|---|
| Anatomia | Uma linha de `--size-control-sm`, sem fios: o chevron no sulco da esquerda quando abre (vazio quando não abre), o ícone de `--icon-sm` em `--ink-4`, o texto em `--ink-2` peso 500 e o complemento em `--ink-3`. A hora fica no fim, só com hover e foco. O que tem conteúdo abre no lugar, num bloco afundado na largura da coluna, com **Open in Artifacts** (ou **Open in Details** num relatório da task, **Open in Reports**, **Open in Documents**) ao pé |
| Variantes | **Evento**: etapa ou step iniciado (`Started with steps/03-token-bucket.md`), documento escrito, relatório escrito (`Review 1 written · changes · 2 findings`), commit, PR aberta, merge, checks lidos antes da passada, commits novos, `Context compacted · at 81%`, `Paused by you`. **Retried on its own**: o rastro de um retry automático que deu certo (`the API was overloaded · 2 attempts`), sem hora. **Decisão do usuário**: `You approved the draft`, `You decided · 3 approved, 1 discarded`. **Mensagem do produto**: o ícone do produto, `MySpec → Implementer` em peso 400 e `Review 1 · 2 findings · round 1 of 3`, com o Markdown enviado a um clique. **Que se atualiza**: `Published · round 1 · 2 so far`, depois o total. **Com erro**: o losango e o trilho (`Publication stopped · round 1 · …`) |
| Estados | Padrão, hover (a hora aparece), foco, aberto, desabilitado (conteúdo descartado por um recomeço: sem chevron, texto em `--ink-3`; não acontece na conversa da task, em que o recomeço apaga a conversa), carregando (o brilho da leitura), erro (`Couldn't read … · Try again`, em `--state-error-veil`). Um marco novo que pede algo pisca no véu da gravidade |
| Teclado | Só o que abre é parada no percurso das setas: `→` abre, `←` fecha, `Enter` e `Space` alternam |
| Acessibilidade | O que abre é `summary` com `aria-expanded`; o que não abre é lido, sem foco |
| Faça | Diga o acontecimento numa linha, com o número que importa |
| Não faça | Não escreva a hora no texto do marco. Não mostre o conteúdo aberto por padrão |

### Dobra de trecho

| | |
|---|---|
| Anatomia | Numa sessão longa, cada trecho anterior à rodada atual dobra numa linha na forma do marco, com o ícone do histórico e o tamanho primeiro: `5 speeches · 71 actions` em `--ink-2` peso 500, e onde o trecho começou em `--ink-3` (`from the start · steps/06-throttle-metrics.md`, `from Review 1 · 3 findings · round 1 of 3`). O intervalo de horas aparece só com hover e foco. Um trecho vai de uma mensagem do produto que abre uma rodada à próxima, ou do início à primeira |
| Aberto | As entradas do trecho, como eram, na mesma coluna |
| Quando dobra | Um trecho que não é o último e tem ao menos 12 entradas, contando um grupo como uma; os menores ficam abertos. Um trecho dobrado não monta o conteúdo |
| Estados | Padrão, hover, foco, aberto; lido por partes, carregando (`Opening 11 entries…` num bloco afundado com o brilho) e erro (`Couldn't read this stretch of the conversation` e **Try again**, em `--state-error-veil`). Com o transcript inteiro na memória, abrir é imediato |
| Não faça | Não use o ícone do produto: a dobra não é a mensagem do produto |

### Grupo de ações

| | |
|---|---|
| Anatomia | Dobrado, é uma linha sem fundo: o chevron, `14 actions` em peso 500, o resumo por tipo (`Read 8 · Searched 4 · git 2`), a hora de início com hover e foco, e a duração à direita. Aberto, ganha o bloco `--surface-0` na largura da coluna, com um **comando** por linha: até oito, todos; acima de oito, as últimas seis e `Show N earlier actions` |
| Variantes | **Vivo**: dobrado como os outros; o resumo é a ação em curso, com spinner (`11 actions ◌ Run the refill and eviction tests go test ./internal/ratelimit/…`). **Com falha**: `· 1 failed` em `--state-error`. **Falhou e depois passou**: `· 1 failed, then passed` em `--ink-3`, porque não pede atenção. **Em espera**: `· 1 waits for your permission`, a ação com a ampulheta neutra e o alvo `the command in the card below`. **Com retry**: `↻ retried on its own · 2 attempts` depois do resumo |
| Subagente | Uma linha do grupo, `Delegated · Find why e2e / rate-limit-burst failed`, com o próprio resumo em sans (`44 actions · Read 21 · Searched 14 · GitHub 9`) e a duração, que abre os comandos dele recuados sob um fio `--line-2` |
| Ações anteriores | `Show 15 earlier actions` mostra as outras no lugar. Enquanto o transcript inteiro está na memória, é imediato; lido por partes, carregando é o brilho (`Loading 15 earlier actions…`), erro é `Couldn't load the earlier actions` e **Try again** |
| Estados | O resumo tem hover, foco e pressionado. O grupo não tem desabilitado: sempre abre |
| Teclado | O resumo é `summary` e parada no percurso das setas: `→` abre, `←` dobra; aberto, as setas passam pelos comandos e pelo subagente |
| Faça | Deixe dobrado por padrão, o vivo também, com a ação em curso no resumo |
| Não faça | Não use âmbar numa ação em espera: o pedido já está no cartão |

### Comando

| | |
|---|---|
| Anatomia | A unidade das ações, uma linha de `--size-control` no bloco do grupo, separada da próxima por um fio `--line-1`: o chevron quando há saída, o ícone do estado, a descrição que o agente escreveu (`Run the rate limit tests`) em `--ink-2`, o comando em mono `--text-micro` e `--ink-4`, cortado com tooltip, e à direita a duração ou o código de saída (`exit 1 · 8.2s`). Sem a descrição, o comando ocupa o lugar dela, em `--ink-2`, e nada vem depois |
| Saída | Dobrada. Aberta, até 16 linhas, é a saída inteira; acima, é a cauda (as 12 últimas linhas) do que o comando imprimiu, em mono `--text-micro` e `--ink-2`, sobre `--surface-1` com fio `--line-1`, recuada sob a descrição: `24 more lines above` e **Show all 36 lines** em cima, as últimas linhas embaixo (`N` é o total menos as linhas da cauda). Têm saída o Bash que imprimiu algo, toda ferramenta que falhou (a razão) e o subagente (o relatório final); uma ferramenta que não é Bash e passou não tem dobra. Rola na horizontal |
| Variantes | **Feito**: o visto. **Falha**: o `✕`, a descrição e o código em `--state-error`, e a saída aberta por padrão, com o trilho `--error-rail` à esquerda: a cauda é o que se precisa ver. **Rodando**: o spinner, a descrição em `--ink-1` peso 500 e o tempo correndo; sem saída até o fim, porque o CLI a manda quando o comando termina. **Interrompido**: o ícone de bloqueio, `stopped`, ou `stopped with the session` quando a sessão caiu. **Em espera**: a ampulheta, sem saída. **Sem saída** (o desabilitado): um comando que não imprimiu nada, ou cuja saída não foi guardada, não tem chevron nem dobra |
| Estados | Padrão, hover, foco, pressionado, aberto, carregando (`Reading the output…` com o brilho), erro (`Couldn't read the output` e **Try again**) |
| Acessibilidade | Com saída, é `summary`; sem saída, é o item da lista, com o nome inteiro (`Run the rate limit tests: go test ./internal/ratelimit/... -race, 7.9s`) |
| Não faça | Não mostre a saída de um comando que passou sem que se peça |

### Bloco de erro

| | |
|---|---|
| Anatomia | `--surface-0` com o trilho `--error-rail` vermelho, na largura da coluna: a explicação e o detalhe em mono (`exit status 1 · claude --resume …`, o `git status`), sem título, sem hora e sem botão |
| Faça | Deixe a ação na barra do pedido |

### Markdown

| | |
|---|---|
| Anatomia | O Markdown de leitura (a fala do agente, um documento, um relatório, o corpo de um card ou de uma PR, um prompt) com o bloco de código, a tabela e o diagrama do system |
| Títulos | Sob um título próprio, os títulos do Markdown ficam em `--text-ui` e peso 600, abaixo do título que se lê primeiro: em todo painel (`Artifacts`, `Details`, `Documents`, o painel do card e o da PR), no corpo de um marco aberto, no prompt, no rascunho e no arquivado. A fala do agente, que não tem título acima, mantém os seus. É a classe `.ui-headings`, fora de camada, para vencer as classes que o Streamdown põe nos títulos |
| Não faça | Não deixe um título do Markdown maior que o título do lugar ou do painel em que ele está |

### Bloco de código

| | |
|---|---|
| Anatomia | Afundado, raio `--radius-md`, fio interno, na largura da coluna; cabeçalho com a linguagem, o caminho em mono e o intervalo de linhas (cada um quando existe) e **Copy**; o código em 13/20, sem números de linha. O **Copy** é o da Marca e cópia, o mesmo em todo bloco, curto ou cortado, com o nome `Copy the code`; o bloco não tem outra cópia |
| Tinta | O código é todo em peso 400, sem itálico nem negrito: os quatro matizes `--code-*` e o comentário em `--code-comment` separam os tipos de token só pela cor |
| Código longo | Na conversa, acima de 24 linhas, o bloco mostra as 20 primeiras e um rodapé de fio com **Show all 46 lines** e `26 more`; aberto, **Show less**. Vale também durante o streaming, a partir da linha 25, para o bloco não encolher quando a fala termina. Continua rolando na horizontal. Fora da conversa (painéis, prompts), não corta |
| Diagrama | O mermaid é um bloco de código: o cabeçalho com `<> mermaid`, **Full screen** e **Copy**, e o diagrama no tamanho natural no corpo, encolhido só até a largura da coluna. Enquanto desenha, `Drawing the diagram…` com o spinner e o código como texto; uma falha diz `Couldn't draw the diagram: <razão>` em `--state-error`, sobre o código. O zoom é só na tela cheia: o diálogo **Diagram** na variante tela cheia, com **Zoom out**, **Zoom in** e **Reset zoom**, de 0,5 a 3 vezes a largura natural, rolando quando passa do diálogo |
| Estados de Copy | Hover, foco, copiado (visto e `Copied`), erro (`Can't copy · select the text`) |
| Estados de Show all | Padrão, hover, foco, aberto |
| Tokens | `--surface-0`, `--line-1`, `--code-keyword`, `--code-string`, `--code-function`, `--code-number`, `--code-comment`, `--text-code` |
| Acessibilidade | Rola na horizontal dentro do bloco; os botões têm nome; **Show all** tem `aria-expanded` |
| Não faça | Não quebre linhas de código para caber. Não numere as linhas. Não use peso nem itálico para destacar um token |

### Medidor de contexto

| | |
|---|---|
| Anatomia | Trilho de `--meter-w` × `--meter-h` em `--brand-track`, preenchimento chapado em `--brand` arredondado para baixo ao pixel, porcentagem de largura fixa |
| Variantes | No cabeçalho do item, só com uma sessão na tela; na linha 3 da árvore |
| Estados | Hover mostra o tooltip. Sem leitura ainda: trilho com brilho e `…`. Sessão pausada: `—`. Estreito (lateral abaixo de 330 px, área principal abaixo de 1300 px): só a porcentagem |
| Acessibilidade | `role="meter"` com `aria-valuenow` |
| Não faça | Não ponha o medidor em âmbar ao encher: ele não é uma situação |

### Cartão de pedido

| | |
|---|---|
| Anatomia | Na largura da coluna, `--surface-2` com `--shadow-card` e anel `--state-wait-line`, raio `--radius-lg`, sem faixa de cabeçalho: a barra do pedido diz o que é e de quem. É o único bloco da conversa com contorno e com elevação. Corpo: a pergunta em 18/24 ou a descrição e o comando, a nota, as respostas |
| Variantes | **Pergunta**: para cada pergunta, o `header` como etiqueta e as opções numeradas (tecla, título, trade-off), caixas de seleção quando a pergunta aceita várias; `Other…`, que leva ao compositor; ao pé, **Answer** `↵`, a primária, tracejada com o que falta (`Choose an option`, `Answer 2 more questions`). **Permissão**: a ferramenta como tag, o comando uma vez em mono, **Allow** `1` (a única primária da tela), **Allow for this session** `2` (só quando o CLI oferece uma regra), **Deny…** com a última tecla, que abre no cartão o texto opcional para o agente e **Deny**, perigoso. **Respondido**: um bloco chapado em `--surface-0`, sem anel e sem fio, com o visto, a pergunta e a resposta; a hora da resposta fica no tooltip. **Pergunta em texto**: não é cartão; o parágrafo da pergunta, no fim da fala do agente, ganha um fio `--state-wait-ring` à esquerda, e o compositor oferece a resposta rápida |
| Estados da opção | Hover, foco, escolhida (`--brand-tint`, `aria-checked`), desabilitada, enviando, erro (`Not sent · the session stopped`) |
| Tokens | `--surface-2`, `--shadow-card`, `--state-wait-line`, `--state-wait-ring`, `--brand-tint`, `--brand-ring`, `--text-title`, `--key-size` |
| Teclado | Ao chegar pela notificação, por `Ctrl+J` ou por **Show**, o foco vai à primeira opção. `1`–`9` respondem com o foco no cartão ou na entrada dele, e na permissão `1` a `3` são **Allow**, **Allow for this session** e **Deny…**. As setas andam dentro do `radiogroup`, com volta ao início, sem sair do cartão; `Enter` envia a escolha, e **Other…** leva ao compositor |
| Acessibilidade | `fieldset` com `aria-labelledby`; opções em `radiogroup` |
| Faça | Escreva o comando uma vez, aqui |

### Cartão neutro

| | |
|---|---|
| Anatomia | Na largura da coluna, `--surface-2` com `--shadow-xs`, raio `--radius-lg`, sem anel de espera; cabeçalho com o título e o número (`Changed files · 7`, `Findings · 3`, `Round 1 · drafts · 5`) |
| Regra | Um cartão sem ação de resposta própria é conteúdo neutro, e a barra do pedido é tingida e carrega o pedido. Um cartão que responde (pergunta, permissão) tem o anel âmbar, e a barra é quieta |
| Conteúdo | Arquivos mudados, apontamentos, rascunhos (seções abaixo) |
| Acessibilidade | Uma parada de Tab, com roving tabindex entre os itens |

### Arquivo mudado

| | |
|---|---|
| Anatomia | Uma linha do cartão de review de um step `Manual` ou das mudanças aplicadas: o glifo, o tipo (`M`, `A`, `D`), o caminho em mono (link que abre no VS Code) e `staged`, `partly staged` ou `not staged` |
| Estados | Não staged, staged, hover, foco, apagado (desabilitado), carregando, erro. O progresso fica na barra do pedido |

### Checks do GitHub

| | |
|---|---|
| Anatomia | Bloco afundado: o cabeçalho (`◌ Waiting for checks · 4 of 6 passed`, `checked just now`), uma linha por check (glifo, nome em mono, estado: `passed`, `running` em 500, `queued`, `failed` em vermelho, e a duração). Na variante ao vivo, o que falta fica no texto do estado vazio de um lugar acima dela (no vazio do PR review) ou ao pé do bloco (no fim da conversa do review), nunca nos dois |
| Variantes | Ao vivo (a espera, no vazio do PR review; no review de uma PR, no fim da conversa, com o que falta ao pé: `The first pass starts when e2e / chromium and preview-deploy finish. MySpec reads web#2291 every minute; you can leave meanwhile.`); lidos antes de uma passada (atrás do marco `Checks read before pass 1`); no painel da PR e em `Details` da task, com o resumo (`3 of 5 passed · 2 not finished`, `· 1 failed`, `· merges clean` ou `· conflict with dev`), `Not read yet` sem leitura e `No checks` sem checks |
| Linha | O glifo (visto em `passed`, losango em `failed`, spinner em `running`, círculo em `queued`, visto em `--ink-4` em `skipped`), o nome em mono, o estado e a duração (`1m 52s`; rodando, desde o início, a cada segundo; na fila, `—`). `passed` conta `skipped` e `neutral`, como o GitHub |
| Estados | Carregando (a primeira leitura, com brilho), erro de leitura |
| Não faça | Não use âmbar: a espera é do GitHub, não do usuário |

### Apontamento

| | |
|---|---|
| Anatomia | Um item do cartão de apontamentos: o número em mono `--text-micro` `--ink-3`; o título em `--text-ui` e peso 600, com o código em linha entre crases desenhado como código (mono em `--text-code-read` sobre `--surface-0`, como o texto do apontamento, sem as crases), e o nome acessível do apontamento diz o título sem as crases (sem título, num relatório lido antes de o título existir ou de um agente que não o escreveu, a localização toma o lugar dele); a localização; o texto do agente renderizado em `--text-body`, sem trecho do diff; a decisão; **Edit** `E`, fantasma, à direita |
| Localização | Ancorada: o caminho e a linha em mono (`web/src/settings/GeneralForm.tsx:84`), link com a seta externa que abre a PR no GitHub, em `Files changed`, na linha (`O`), e ao lado o botão fantasma `<>` que abre o VS Code na linha (`Ctrl+E`). Geral: `General · not on a line of the diff`, sem link |
| Decisão | **Approve** `A` (com o visto) e **Discard** `D`. A ativa fica pressionada (`--brand-tint`, `aria-pressed`), com `Approved · click again to undo`; um segundo clique desfaz |
| Edição | Uma área de texto de cinco linhas com o Markdown cru, `Saved as you type. It goes to GitHub as you leave it.` (no modo Apply e na PR da task, `It goes to the agent as you leave it.`) e **Done**; `Esc` fecha. Vazia, o campo diz `Write the finding, or discard it.` em erro, e o último texto salvo fica |
| Estados | Padrão (anel `--line-1`); hover (anel `--line-3`); atual com o foco (anel `--brand-ring`, e o de foco por fora); aprovado; descartado (título em `--ink-2`, texto legível, sem risco); editando; desabilitado depois de publicado ou enviado (`Inline comment · published 13:41`, `In the review body · published 13:41`, `Not published`, `Sent to the agent · 13:41`, `Not sent`); salvando; erro (anel vermelho, `Couldn't save the decision · Try again`) |
| Teclado | `A` e `D` decidem o apontamento em foco e levam o foco ao próximo por decidir depois dele (com volta ao começo), que rola ao centro. A tecla que desfaz a decisão ativa (`A` num aprovado) não avança; sem nada por decidir, o foco fica. A repetição da tecla segurada é ignorada. `Alt+↓` e `Alt+↑` vão ao próximo e ao anterior por decidir de qualquer lugar. `↑` e `↓` andam entre os apontamentos do cartão; vindo de fora, `↓` cai no primeiro e `↑` no último; no primeiro e no último, continuam o percurso da conversa, para a entrada antes ou depois do cartão; `Home`, `End`, `Page Up` e `Page Down` continuam o percurso da conversa. `E` edita, `O` abre o GitHub na linha, `Ctrl+E` o VS Code. Num apontamento desabilitado, só `O` e `Ctrl+E` agem |
| Usos | O review de uma PR e o review da PR da task, com a barra de decisão |

### Rascunho

| | |
|---|---|
| Anatomia | O rascunho aberto no cartão dos rascunhos, `--surface-2` com anel `--line-2` (`--brand-ring` no atual): o número; a etiqueta do tipo e `Revised`; o título em `--text-ui` 600 (o do épico em `--text-body`); os campos numa linha em `--text-meta` `--ink-3` (repositório, módulo, cards do épico, `In <épico existente>` e, numa atualização, `Now: <título>`, `Module now:`, `Epic now:`); `Depends on` com os títulos como links, nunca o id; os avisos; o corpo inteiro renderizado depois de um fio, com os títulos dele em `--text-ui` 600, menores que o título do rascunho; a linha do que o gesto publica; a decisão com o estado ao lado e **Edit** `E` |
| Épico | O rascunho do épico e embaixo os seus cards, recuados sob uma guia de `--line-2` |
| Avisos | Neutros, com `◇`, um por linha em `--ink-2`: repositório fora do board, dependência fora dos rascunhos ou descartada, módulo fora do board; numa atualização, o card fora da leitura, relendo, releitura falha |
| Atualização | O controle segmentado **Body** / **Changes `+4 −1`**. **Changes** é o diff neutro em mono sobre `--surface-0`: a linha acrescentada sobre `--veil-hover` em `--ink-1` com `+`, a retirada riscada em `--ink-3` com `−`, e `Added:` / `Removed:` no texto oculto |
| Estado | Uma linha: `⧗ Approved · waits for the epic`, `Publishing…`, `✓ Created billing#479 · 15:10` com `To take it back, close billing#479 on GitHub.`, `◆` e a razão da publicação (sem prefixo) com **Retry** primário ao lado (tracejado durante uma corrida), `Discarded`, `Revised · your approval was cleared`, `⧗ Approved · the epic needs two approved cards · 1 of 3`, `⧗ The epic is discarded · this card won't publish`, `◇ Can't publish · choose a repository` |
| Estados | Padrão, hover, foco (atual), aprovado esperando, publicando, publicado com a saída, descartado (título em `--ink-2`, texto legível), desabilitado durante uma publicação (`A publication is running · the decision waits for it`) e em edição (`Finish editing to decide`), erro com **Retry**, revisado |
| Edição | **Edit** abre no lugar do corpo: **Title**; **Body** em Markdown cru, mono; **Repository**, **Module** e **Epic** lado a lado; **Epic** com **Existing issue…** e o campo `owner/name#N`; **Depends on** com chips `×` e **Add a dependency** (o `listbox` com busca, os rascunhos pelo título, os cards do board pelo número ou título, e `Depend on <dono/nome#N>` quando a busca é uma issue fora deles; ele abre sobre a edição, embaixo da linha quando cabe ali e em cima quando há mais espaço acima, limitado à borda da conversa, e o que não cabe rola dentro dele); `Saved as you type. The agent's next revision of this draft replaces your edits.` e **Done**, e num aprovado `Changing the repository, the epic or a dependency clears the approval.`; o corpo de um épico do usuário pode ficar vazio |
| Teclado | `A` e `D` decidem. Um gesto que publica mantém o foco no rascunho; um que não publica avança ao próximo por decidir. Depois de qualquer decisão, as teclas e os cliques de decisão de todos os rascunhos ficam inertes por 900 ms, e a repetição da tecla nunca decide: um duplo clique é uma decisão só. A tecla da decisão ativa desfaz e não avança. `E` edita. É o `DecisionCard` da task 6 com a política do avanço (`tasks/09-discussion.md` §4.4) |
| Acessibilidade | A linha do que o gesto publica descreve **Approve**; o estado em `role="status"` enquanto publica |
| Não faça | Não use cor no diff: cor é sinal |

### Rascunho dobrado

| | |
|---|---|
| Anatomia | Duas linhas, o número numa coluna de `--key-size` em mono. Linha 1: a etiqueta do tipo, `Revised`, o título em `--text-ui` 500, cortado com tooltip, e o estado à direita. Linha 2: em `--text-meta` `--ink-3`, o repositório, o módulo, os cards, `Now:`, o épico existente, `Depends on`, `1 warning` |
| Estados | Sem decisão (`Not decided`), hover, foco, pressionado, atual (anel `--brand-ring`), esperando, publicando, publicado, descartado (título em `--ink-3`), card de épico descartado, bloqueado por aviso, falhou (trilho de erro e `Couldn't write to GitHub · open it to Retry`) |
| Teclado | Clique, `Enter`, ↑↓ o abrem. `A` e `D` não agem nele |

## Listas

### Linha de lista

| | |
|---|---|
| Anatomia | Uma linha de `--size-control` numa grade de colunas de largura fixa, para as colunas se alinharem de linha em linha. O título tem sempre ao menos um terço da linha, cortado com tooltip. A coluna das teclas aparece só na linha com o foco do teclado, com as teclas que agem |
| Variantes | **Card** (board): início (glifo de épico, ou o sinal da caixa no modo de seleção), `--col-num`, título, `--col-epic`, `--col-dep` (`◇ #461 +1`), `--col-task` (o glifo e a forma curta da linha 2 da árvore, `structure.md` §2, com `+N`, ou `In discussion`), `--col-keys` (`S start`, `D discuss`; no modo de seleção, só `Space select` ou `Space unselect`). **Pull request** (Reviews): `--col-ref`, título com até duas etiquetas, que cedem antes dele (um só `+N` com todas no tooltip, depois nenhuma), `--col-author`, `--col-state`, `--col-keys` (`R review`, `R open`, `R open task`). **History**: glifo do tipo, nome, `--col-where`, `--col-result`, `--col-time`, sem teclas |
| Estados | Hover `--veil-hover`; foco (anel por fora e as teclas); pressionada `--veil-press`; aberta no painel (`--brand-tint-plane` com anel `--brand-ring`, o glifo de tipo em `--brand-ink`, o número sobe a `--ink-3`); desabilitada (tracejada, com a razão); carregando (`Cloning acme/billing…`, com o spinner; o início de um review tem o estado no diálogo); erro (em vermelho, com o trilho); fechada numa seção não final (o título em `--ink-4`, e `--ink-3` na linha aberta, que com `--ink-4` cairia abaixo de 4,5:1 no escuro com o hover e o pressionado); nova numa leitura (pisca duas vezes no véu neutro); recém-arquivada no History (destacada ao chegar da página do item que saiu) |
| Situação na linha | Com espera ou erro, o rótulo da task ou do review em `--ink-1` e peso 500; sem situação, em `--ink-2` ou `--ink-3` |
| Largura | Pela largura do contêiner da lista, a área que rola, com as margens de `--space-6` (container query). Abaixo de 1040 px (860 px no History), a grade fica com o início, o número, o título e as teclas, e o resto desce para uma segunda linha sob o título, que vai da coluna do título à das teclas, em `--text-meta`, com `--space-4` entre as partes, sem quebrar: a dependência e a task ficam inteiras, e o épico corta com tooltip; quando sobra ao épico menos de `--space-12`, ele sai da segunda linha; só quando a dependência e a task não cabem juntas a task também corta, com tooltip. A linha de duas linhas tem `--space-1-5` em cima e embaixo e `--space-0-5` entre as duas (52 px). Uma linha sem nada a descer fica com uma linha só. No card, com as colunas decididas para a task 5 (a tabela de Tamanhos de layout), o título tem 337 px a 1041 px de contêiner (um terço é 331) e 180 px na lista mais estreita ao lado do painel (452 px de contêiner, janela de 1100 px) |
| Teclado | A lista é um `tree` com uma parada de Tab; ↑↓ `Home` `End` percorrem as linhas e os cabeçalhos visíveis; `Enter` abre ou fecha o painel |
| Acessibilidade | Cards e PRs são `treeitem` de nível 2, com `aria-selected` no aberto; o nome acessível é a frase inteira |
| Faça | Mostre só o que decide a escolha; o resto fica no painel |
| Não faça | Não tire largura do título para mostrar as teclas |

### Cabeçalho de seção da lista

| | |
|---|---|
| Anatomia | `--size-node` de altura: chevron, o nome em `--text-meta` e peso 600, a contagem já filtrada em `--ink-4`, e o tooltip do que a seção reúne; uma seção final se diz no tooltip e no nome acessível, nunca no texto do cabeçalho |
| Variantes | As seções de status do board, na ordem dele; as seções de Reviews (`Pending`, `In review`, `Reviewed`, `Yours and your tasks`); o dia no History (`Monday, Sep 22 5`), sem chevron |
| Estados | Hover, foco, pressionado, recolhida (as finais começam recolhidas; o que o usuário recolhe é lembrado), vazia (contagem 0, sem chevron nem ação), todas escondidas pelo filtro, carregando |
| Teclado | `←` recolhe, `→` expande; `Enter` alterna; numa linha, `←` recolhe a seção dela e foca o cabeçalho. O dia no History não recolhe: `→` vai à primeira linha dele, `←` e `Enter` não agem, e numa linha `←` só foca o cabeçalho do dia |
| Acessibilidade | `treeitem` de nível 1 com `aria-expanded`; o dia no History, sempre aberto, com `aria-expanded="true"` fixo e o nome `Archived on Monday, Sep 22: 5` |
| Não faça | Não esconda uma seção vazia: a lista não pula quando o filtro muda |

### Barra de filtros

| | |
|---|---|
| Anatomia | Fixa no alto da lista, com um esmaecido de `--space-3` por baixo: a busca (quando o lugar busca), os chips que alternam, os filtros ativos como chips com `×`, **Filter** (o menu com grupos) e **Clear filters**, fantasma, só com algum filtro ativo |
| Variantes | Board: a busca, **Assigned to me**, **Filter**. Reviews: só **Filter**. History: a busca (`Search by name, title or #number`, onde o foco começa), o chip do filtro da lateral quando ativo (`Only acme/web`, cujo `×` limpa o filtro da lateral também), e à direita a contagem (`44 archived · Sep 12 – today`, `12 of 44`) |
| Menu Filter | Um grupo por filtro, com a legenda em caixa alta, e itens `menuitemcheckbox`: no máximo um marcado por grupo; escolher outro troca, escolher o marcado o desmarca, e o menu fecha a cada escolha. No board, **Repository** (os repositórios do board, `dono/nome`), **Assignee** (os responsáveis da leitura, em ordem alfabética, o do `gh` com `· you`) e **Status** (as opções na ordem do board e `No status`, só num board com campo de status) |
| Chip do filtro ativo | `acme/api`; `Assignee: tchen`; `Status: Ready` ou `Status: No status`, cada um com o `×` (`Remove the filter acme/api`). Um filtro de um repositório que saiu do board ou de um status que saiu das opções é órfão: o chip leva `◇` antes do nome, com `acme/old isn't a repository of this board anymore.` ou `Ready isn't a status of this board anymore.` no tooltip, e continua filtrando até o `×` |
| Estados | Padrão, filtros ativos, chip tracejado com a razão (`gh didn't say who you are`), menu carregando (Reviews), filtro órfão (`◇`) |
| Largura | Abaixo de 620 px de lista, a busca encolhe de `--space-16` × 4 para `--space-16` × 3 |
| Acessibilidade | `role="search"` |
| Faça | Lembre os filtros entre execuções |

### Barra da seleção

| | |
|---|---|
| Anatomia | No lugar da barra de filtros durante o modo de seleção, neutra (`--surface-0` com anel `--line-2`): `3 selected`, os números em `--ink-3`, a ação primária (**Discuss 3 cards** `D`) e **Cancel** `Esc` |
| Estados | Nenhum marcado (`0 selected`, sem números, e **Discuss cards** tracejado com `Select a card with Space`), um (**Discuss 1 card**), vários (**Discuss 3 cards**); os números cortam com tooltip; com a lista filtrada, `· filtered` em `--ink-3` depois dos números, com o filtro no tooltip |
| Acessibilidade | `role="toolbar"`, a contagem em `role="status"` |
| Não faça | Não use a identidade na barra: ela não é uma escolha |

### Bloco do item

| | |
|---|---|
| Anatomia | No painel da lista, elevado (`--surface-2`, `--shadow-xs`): o glifo de tipo em `--brand-ink`, o nome em 500, a situação com a posição e o chip de tempo (`● Question · Reviewer · Step 3/7 18m`; sem situação, o glifo e a linha 2 da árvore na forma longa), e **Open** (**Open review** `R`, **Open task**), primário quando o item espera o usuário e nenhuma outra primária está na tela |
| Variantes | A task ativa de um card, com **Open** secundário, porque **Start task** é a única primária da visão do board (`screens/board.md` §3.6); o review ativo de uma PR; a task dona de uma PR (`The review of this pull request happens in its task.`). Sem ativo: a task arquivada mais recente (`Archived task: <nome>`) e a discussão do card (`In the discussion <título>`, ou `From the discussion <título>` quando ela está arquivada), como links |

### Aviso de dependência

| | |
|---|---|
| Anatomia | Um por dependência não satisfeita, neutro: `◇ Depends on #461 Metering events from the gateway` e, embaixo, `acme/gateway · Open · Backlog · no pull request. A warning only: it never blocks.` Afundado sobre o chão; contornado por `--line-2` dentro de um painel afundado |
| Não faça | Nunca use âmbar: a dependência nunca bloqueia |

### Lista de relações

| | |
|---|---|
| Anatomia | Grupos com o título em caixa alta (`Epic`, `Cards of the epic · 6`, `Cards · 8`, `Dependencies`, `Pull requests`), uma linha por item (número, título, e à direita o status, o estado ou o progresso do épico, `2 of 8 finished`); `◇ Not satisfied` na dependência que falta |
| Variantes | **Link externo**: o que não é card do board, com a seta externa, abre no GitHub. **Card do board**: o link sem a seta, que abre o card no painel da lista (no board) ou a visão do board com o card no painel (no painel `Card` da task) |

### Continue e linha de início

| | |
|---|---|
| Continue | Botão elevado (`--surface-2`, `--shadow-xs`, raio `--radius-lg`) com duas linhas: o glifo de tipo em `--brand-ink`, o nome em `--text-body` 600 e `Enter` à direita; o glifo da situação, o que ela pede com a posição, o chip do tempo e onde o item vive em `--ink-3`. Recebe o foco na Home. Estados: padrão, hover, foco, pressionado. Não tem desabilitado nem carregando: o item dele é sempre um item ativo que existe (`screens/board.md` §2.2), e abrir um lugar é imediato |
| Linha de início | O ícone, o rótulo em 500, o subtítulo em `--ink-3` e a tecla à direita (**New task** `Ctrl N`, **Review a pull request** `4 pending in 3 repositories`, **New discussion**, **Add board**, **Add repository**). Estados: padrão, hover, foco, pressionado, desabilitada |
| Linha de board | A linha de início com o ícone de board, o título, os cards abertos e os repositórios em `--ink-3`, e à direita a idade da leitura ou `◇ Read failed 18m ago`, que brilha durante uma leitura; sob ela, recuadas até o texto, as linhas do que bloqueia, cada uma com a ação fantasma `xs`. A linha **No board** tem a mesma forma, sem ser botão (`role="group"`), porque não abre um lugar |

## Diálogos

### Diálogo

| | |
|---|---|
| Anatomia | Sobre `--scrim`: folha `--surface-3` com `--shadow-overlay`, raio `--radius-xl`. Título em 18/24 com o `×` (`Close · Esc`) e, num diálogo em passos, o passo no subtítulo; corpo que rola quando passa da janela; rodapé afundado com a razão ao lado quando a primária está desabilitada, **Cancel** fantasma e a confirmação por último, numa linha só: a razão ocupa o espaço que sobra, cortada com o texto inteiro no tooltip, e os botões nunca quebram nem mudam de lugar |
| Posição | Todo diálogo centra na janela inteira, que o `--scrim` cobre, e não na área principal |
| Variantes | Todos, menos a tela cheia, ficam a `8vh` do topo, em pixel inteiro, e crescem para baixo, para abrir uma seção sem mover o título. **Mínimo** (`--size-dialog`, `alertdialog` numa confirmação): a confirmação, com o que acontece, uma linha apagada com a consequência secundária, e o que é opcional atrás de um clique (**Add instructions**). **Largo** (`--size-dialog-wide`): os de criação, de cadastro e de início. **Em passos**: o passo no subtítulo (`Data Platform · acme · Step 2 of 3 · Statuses`); no rodapé, **Back** fantasma à esquerda a partir do segundo passo, o que falta ou a consequência (`acme/docs moves to No board, and acme/billing leaves MySpec.`), **Cancel** e **Continue** ou, no último, a confirmação; uma recusa em vermelho numa linha própria acima dos botões. **Destrutivo**: a prévia do que será destruído, a confirmação perigosa. **Tela cheia** (`size="full"`): a janela menos `--space-8` de cada lado, na largura e na altura, em pixel inteiro, com o título e o ×, sem rodapé; é a do diagrama (Bloco de código) |
| Instâncias | Criação de task (`screens/board.md` §4), início de review, **Review again** e publicação (`review.md` §3, §11, §12), nova discussão, arquivar, apagar e agrupar (`discussion.md` §2, §11, §12), os de Settings, apagar task, descartar step e voltar a uma etapa (`screens/rest.md`) |
| Estados | Padrão; confirmando (`Deleting…`, **Cancel** tracejado); falha (a razão em vermelho no rodapé, o diálogo fica aberto, e a confirmação volta a agir: ela é o repetir, sem um **Try again** ao lado) |
| Tokens | `--scrim`, `--surface-3`, `--surface-0`, `--shadow-overlay`, `--radius-xl`, `--size-dialog`, `--size-dialog-wide`, `--space-8` |
| Teclado | Um diálogo destrutivo ou de confirmação abre com o foco em **Cancel**; um de criação, no primeiro campo. O foco fica preso; `Ctrl+Enter` confirma com o primário, e um diálogo cuja confirmação é perigosa não confirma por ele (`decisions.md`, 2026-10-02); `Esc` e o × fecham e devolvem o foco. `Ctrl+N`, `Ctrl+J` e `Ctrl+,` ficam inertes com um diálogo de criação aberto |
| Acessibilidade | `role="dialog"` ou `alertdialog`, `aria-modal`, `aria-labelledby` |
| Faça | Diga exatamente o que será perdido e o que fica |
| Não faça | Não abra um lugar em diálogo. Lugares são páginas |

### Diálogo de publicação

| | |
|---|---|
| Anatomia | Diálogo mínimo: `Publish the review of web#2291`; a nota de commits depois da passada, quando há; **Verdict**, os três vereditos num grupo de opções (`OptionGroup`: `1 Request changes`, `2 Approve`, `3 Comment`, cada um com o que faz), **nenhum marcado**, o sugerido pelas decisões com a etiqueta `Suggested` e o porquê no tooltip; a linha do que vai para o GitHub; **Include the summary**, caixa marcada com o começo do resumo e **Edit**; rodapé com `Choose a verdict` ao lado de **Publish** tracejado, depois **Publish · Request changes** `Ctrl ↵` |
| Regras | As do GitHub (PR própria só `Comment`; sem resumo e sem apontamento aprovado só `Approve`; nenhum aceito), em `screens/review.md` §11 |
| Estados | Nada escolhido, escolhido, só um possível (marcado, com a razão), editando o resumo, publicando, falha |
| Teclado | Foco inicial em **Cancel**; `1`–`3` escolhem; ↑↓ percorrem |

### Prévia de um apagamento

| | |
|---|---|
| Anatomia | Lista afundada (`--surface-0`, raio `--radius-md`), uma linha por coisa destruída, lida do git ao abrir: o ícone, o que é (a sessão interrompida, a worktree com `3 uncommitted files`, a branch `not merged · 9 commits`, a PR que `stays open` ou `is merged`), com etiquetas nos números e o detalhe em `--ink-3` |
| Estados | Lendo (esqueleto), lida, erro ao ler (`◇ Couldn't read the worktree` e a razão; apagar continua possível) |

### Resultado do encerramento

| | |
|---|---|
| Anatomia | Bloco afundado com a legenda em caixa alta e a hora: uma linha por parte do encerramento. Feita: visto. Pulada: um traço e a razão em `--ink-2` (`dev not updated: another branch is checked out`). Falhou: o losango e o detalhe do git em mono `--text-micro` |
| Usos | A task arquivada no History, a página da task que saiu, o detalhe do toast |

## Settings e início

### Navegação de Settings

| | |
|---|---|
| Anatomia | À esquerda da página, fixa ao rolar, com largura `--snav-w`: **Defaults**, **Boards**, **Repositories**, **Prompts**, cada item com o ícone e o nome em `--text-ui`, `--size-control` de altura. **Repositories** leva `◇ N` com o número de clones inexistentes (um repositório sem clone não conta), com os repositórios no tooltip e na descrição |
| Estados | Padrão (`--ink-2`), hover, foco, pressionado, página aberta (`--brand-tint-plane`, anel `--brand-ring`, ícone `--brand-ink`, o nome em `--ink-1` e peso 500, `aria-current="page"`) |
| Largura | Abaixo de 820 px de área principal, vira uma linha acima da página, sem ficar fixa |
| Teclado | Uma parada de Tab. ↑↓ trocam de página, `Home` e `End` vão às pontas; em linha, ←→ também. Uma seta com modificador (`Alt+←`) não é da navegação. Aberto por `Ctrl+,` ou por um link, o foco começa no item da página |
| Página | O par navegação e página centrado em pixel inteiro, com `--space-12` entre os dois e a página em `--measure`. O cabeçalho da página: o título em `--text-title` 600, uma frase em `--ink-3` que diz para que ela serve, e à direita a ação da página, secundária (**Add board**, **Add repository**): Settings não tem primária. As seções têm o título em caixa alta de `--text-caps` e uma frase em `--text-meta` |

### Linha de Settings

| | |
|---|---|
| Anatomia | Numa lista contornada por `--line-1`, linhas separadas por fios: o ícone, o nome em `--text-ui` e peso 500, uma ou duas linhas de detalhe em `--text-meta` `--ink-3` (caminhos em mono), e à direita o estado e as ações. O que bloqueia fica sob a linha, como faixa de aviso. As listas vêm em grupos com o título em `--text-meta` 600 e a contagem em `--ink-4` (`Needs a clone 3`, um por board, `No board`); um grupo vazio não aparece |
| Variantes | **Board**: o título, o projeto no GitHub (link), os repositórios, os status finais e de cards novos, a idade da leitura (a do cabeçalho do board), **Edit…** e **Remove…**; sem board, a página tem o vazio com **Add board** sob o texto, pela regra do Estado vazio de página. **Repositório**: o nome, o caminho (ou `Not cloned`), as contagens, `Review instructions set` quando há, e `⋯` (**Change path…**, **Review instructions…**, **Remove…**, desabilitado com a razão abaixo). **Prompt**: o nome, o que o prompt abre, a etiqueta `Default` ou `Edited Sep 20`, e o chevron; abre o prompt |
| Estados | Hover, foco, pressionado; lida, lendo, nunca lida, leitura falha (nunca vermelha), tentando; sem clone com **Clone**, clonando, clone falhou, clone inexistente com **Change path…**, **Change path** recusado |

### Repositório de um board, no diálogo

| | |
|---|---|
| Anatomia | Uma linha com a caixa, o repositório, os cards e, à direita, como ele se liga (`Registered · ~/code/api`, `Registered · Not cloned`, `Registered · the clone at ~/code/infra is missing`, `Clone found · ~/code/marketing-site`, `Clone found · 2 clones:` com o seletor do clone, `Registered without a clone`). Desmarcado, um repositório que o board tinha diz na própria linha, sobre `--surface-0`, para onde vai (`Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working.` ou `Leaves MySpec: it has no clone, tasks or reviews.`) |
| Estados | Registrado e marcado, clone achado, hover, foco, desmarcado indo para No board, desmarcado saindo do MySpec, desabilitado por ser de outro board (`acme/ios belongs to the board Mobile App.`) |

### Clone da varredura

| | |
|---|---|
| Anatomia | Em **Add repository**, uma linha por clone achado na pasta home: a caixa, o repositório e o caminho em mono; os já registrados dobrados no fim (`Already registered 9`) |
| Estados | Disponível, marcado, liga um clone (`Registered without a clone: this links the clone to it.`), hover, foco, desabilitado (registrado), cadastrando, recusado (a razão em vermelho), varrendo (`Scanning your home folder…`), a varredura falhou (com **Try again**), nada achado |

### Tabela de status

| | |
|---|---|
| Anatomia | No passo dos status do diálogo de board: uma linha por opção de status, na ordem do board, e duas colunas, `Ends the work` (caixa de seleção) e `New cards` (rádio); a última linha é `No status`, só com o rádio. Uma opção nova tem a etiqueta `new` |
| Estados | Os da caixa e do rádio; a nota afundada no alto quando o board mudou desde o cadastro |
| Acessibilidade | Uma `table` com o cabeçalho de colunas; a caixa e o rádio de cada linha sob o texto do cabeçalho da coluna deles. A caixa é `<status> ends the work`; os rádios, `New cards start in <status>` e `New cards start without a status`, um grupo pelo `name`, sob o cabeçalho `New cards` |

### Editor de prompt

| | |
|---|---|
| Anatomia | **← <prompt>** no alto, o título (`Editing the PRD prompt`) e a frase; a área de texto em mono ocupando a coluna; à direita, em `--col-placeholders` e fixa ao rolar, a coluna **Placeholders**, cada um como etiqueta com o que ele vira e, quando se aplica, o que acontece sem ele; a barra fixa no pé com, à esquerda, a razão de **Save** tracejado (`Nothing changed yet.`), `Unsaved changes` ou a falha ao salvar, e à direita **Cancel** e **Save** `Ctrl S`, a primária, que não mudam de lugar enquanto se digita |
| Prompt aberto | Na página do prompt, antes da edição, o texto renderizado em Markdown num bloco contornado por `--line-1`, com os títulos dele em `--text-ui` 600, menores que o título da página em `--text-title`, e cada placeholder conhecido como etiqueta |
| Largura | Abaixo de 820 px de área principal, a coluna desce para baixo do editor |
| Estados | Sem mudança (**Save** tracejado), com mudança, salvando, erro ao salvar. Sair com edição não salva pede `Discard your changes?` |

### Passos do início e checagens da máquina

| | |
|---|---|
| Passos | Lista dos passos que bloqueiam a primeira tela, sob `Starting MySpec…`: feito (visto, `--ink-1`), rodando (spinner, peso 500, e, acima de 3 s, o tempo e a razão de um passo lento em `--ink-3`: `12s · ~/code/infra doesn't answer`), a fazer (círculo, `--ink-3`). A falha: `MySpec couldn't start` com o losango, o que aconteceu e o que fazer, o erro num bloco de código copiável, e **Try again** `Enter`, primária, com o foco; a lateral em esqueleto parado, sem brilho. A lateral em esqueleto aparece na hora (a faixa, quando ela está guardada), e a área principal só depois de 400 ms sem o fim do início; a falha aparece na hora |
| Checagens | Nas boas-vindas, o bloco `This machine` só quando falta algo: cada item com `◇`, o que falta em peso 500 (`The GitHub CLI isn't signed in`), o que fazer, e o comando em mono com **Copy** (`gh auth login`) |

### Marca e cópia

| | |
|---|---|
| Marca | O quadrado da marca em `--brand` com o monograma em `--brand-on`: `sm` (`--size-mark`, raio `--radius-sm`) no topo da lateral; `lg` (`--space-8`, raio `--radius-md`, o monograma em `--space-5`) no início, nas boas-vindas e na migração |
| **Copy** | Fantasma, só de ícone, num cabeçalho de bloco (`Copy the error`; num bloco de código, `Copy the code`) e ao lado de um comando (`Copy gh auth login`); secundário, com o rótulo e o ícone, quando é a ação de uma página (**Copy the list**). Estados: padrão, hover, foco, copiado (o visto no lugar do ícone e `Copied` ao lado, por 2 s, sem mover o botão), erro (`Can't copy · select the text`, em `--state-error`) |
| Bloco copiável | O bloco de código sem realce, para um erro ou um comando: afundado, raio `--radius-md`, o cabeçalho com o rótulo e **Copy**, o texto em mono com os caminhos pelo `~`. O rótulo de uma palavra fica em caixa alta (`error`, no início que falhou); o rótulo que é uma frase com um caminho fica como é escrito, em `--text-micro` `--ink-3`, porque a caixa alta trocaria a caixa do caminho (`To remove it yourself, in ~/code/api`, na página da task apagada) |

## Tamanhos de layout

Os tokens de medida e de layout da conversa, das listas, do painel da lista, do diálogo largo e de Settings, declarados em `tokens.css`, e onde cada um é usado:

| Token | Valor | Onde |
|---|---|---|
| `--measure-conversation` | `60rem` | A coluna da conversa, centrada em pixel inteiro, e tudo o que está nela, com a barra do pedido, o compositor e as abas `Implementer` e `Reviewer`. Numa área principal mais estreita, a coluna ocupa a área menos `--space-6` de cada lado |
| `--measure` | `50rem` | A página de Settings e a página centrada de um aviso; a base de `--list-measure` |
| `--measure-read` | `42rem` | Um bloco curto de texto: a Home, a página do item que saiu, o início |
| `--list-measure` | `calc(var(--measure) + var(--space-16) * 5)` | A coluna da lista do board e de Reviews |
| `--panel-card-width` | `clamp(22.5rem, 42%, 40rem)` | O painel da lista |
| `--size-dialog-wide` | `calc(var(--size-dialog) + var(--space-16) + var(--space-8))` | O diálogo largo, 576 px: um nome de 64 caracteres em Fira Code de 13 px (512 px) cabe no campo, com o corpo do diálogo (`--space-5` de cada lado) e o campo (10 px de folga e a borda de cada lado) |
| `--col-num` | `var(--space-12)` | Linha do card |
| `--col-epic` | `calc(var(--space-16) * 2.25)` | Linha do card |
| `--col-dep` | `calc(var(--space-16) + var(--space-2))` | Linha do card, 72 px: o glifo de 8 px, `--space-1-5` e `#1291 +1` medem 60 px, e `#12345 +9`, 69 |
| `--col-task` | `calc(var(--space-16) * 3)` | Linha do card |
| `--col-keys` | `calc(var(--space-16) + var(--space-12) + var(--space-2))` | Linha do card e da PR, 120 px: `S start` e `D discuss` com `--space-2` entre as duas (117 px); o rótulo das chaves de `Details` usa a mesma largura |
| `--col-ref` | `calc(var(--space-16) + var(--space-8))` | Linha da PR |
| `--col-author` | `calc(var(--space-16) + var(--space-8))` | Linha da PR |
| `--col-state` | `calc(var(--space-16) * 3 + var(--space-4))` | Linha da PR |
| `--col-where` | `calc(var(--space-16) * 2 + var(--space-8))` | Linha do History |
| `--col-result` | `calc(var(--space-16) * 4)` | Linha do History |
| `--col-time` | `var(--space-12)` | Linha do History |
| `--snav-w` | `calc(var(--space-16) * 3 + var(--space-4))` | Navegação de Settings |
| `--size-popover` | `22rem` | Os popovers Review mode e Models |
| `--size-composer-max` | `15rem` | A altura máxima da caixa do compositor, cerca de dez linhas |
| `--col-placeholders` | `calc(var(--space-16) * 3.5)` | A coluna **Placeholders** do editor de prompt, 224 px |
