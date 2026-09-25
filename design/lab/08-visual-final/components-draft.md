# Componentes

Rascunho de `design/system/components.md`, da rodada `lab/08-visual-final`. Uma seção por componente base: anatomia, variantes, estados, tokens, teclado e acessibilidade, e o que fazer e não fazer. Cada componente está desenhado em todos os estados, nos dois modos, em `specimen.html`. Os tokens estão em `tokens-draft.css`.

Estados comuns a todo componente interativo, salvo quando a seção diz outra coisa:

| Estado | Regra |
|---|---|
| Hover | Véu neutro (`--veil-hover`) ou o degrau `-hover` do sólido, em `--duration-fast` |
| Focus | Anel de `--focus-width` em `--focus`, por fora, com `--focus-offset` de folga. Campos usam borda `--focus` com halo `--focus-halo` |
| Active | Véu `--veil-press`, ou o degrau `-active`. Um controle pressionado (painel aberto, opção escolhida) usa `--brand-tint` e `aria-pressed` |
| Disabled | Borda tracejada em `--line-3`, tinta `--ink-4`, sem sombra, em toda variante, o fantasma incluído (`structure.md:238`). A razão fica ao lado ou no tooltip, ligada por `aria-describedby` |
| Loading | O spinner do sistema em `currentColor` e o verbo no gerúndio (`Approving…`), `aria-busy="true"`, cursor `progress` |
| Error | Tinta `--state-error` sobre `--state-error-veil`, o verbo de nova tentativa (`Try again`, `Retry`) |

## Primitivos

Cada componente embrulha um primitivo gerado em `frontend/src/components/ui` (nunca editado) ou é próprio do MySpec. A escolha final é da task de implementação; esta é a proposta.

| Componente | Base |
|---|---|
| Botão, botão de ícone | `button` (wrapper com as variantes daqui) |
| Chip | `toggle` quando alterna, `button` com `dropdown-menu` quando abre um menu |
| Input, textarea | `input`, `textarea`, com `label` |
| Select e menu | `dropdown-menu` (ações e escolhas curtas); `popover` com lista para escolhas longas |
| Aba da conversa, seletor de tema | `toggle-group` com semântica de `tablist` na aba |
| Opção de pergunta | `radio-group` |
| Grupo de ações | `collapsible` |
| Tooltip | `tooltip` |
| Diálogo de confirmação | `alert-dialog`; os de criação, `dialog` |
| Tecla | `kbd` |
| Separadores | `separator` |
| Área que rola (árvore, conversa) | `scroll-area` |
| Esqueleto | `skeleton` |
| Linha da árvore, cabeçalho de seção, etapa, cartão de pedido, barra do pedido, marcador, bloco de código, medidor, chip de tempo, glifo, toast, aviso | Próprios |

## Glifo de estado

| | |
|---|---|
| Anatomia | Forma de 10 px (8 px no losango e em abas), par, centrada na coluna de ícone |
| Variantes | Erro: losango cheio (raio `--radius-glyph`). Espera: disco cheio com contorno. Encerramento: anel de 2 px. Trabalhando: anel com arco, girando. GitHub: círculo tracejado. Pausado: duas barras. Ocioso: círculo de 1 px. Bloqueio sem situação: losango contornado `◇`. Não iniciado: círculo em `--line-deco` |
| Estados | Só o spinner se move (ver "Spinner e brilho") |
| Tokens | `--state-error`, `--state-wait-glyph`, `--state-wait-ring`, `--state-close`, `--state-work`, `--state-work-track`, `--state-github`, `--state-paused`, `--state-idle`, `--state-notice`, `--glyph`, `--glyph-sm`, `--glyph-diamond`, `--glyph-bar`, `--duration-spin` |
| Acessibilidade | `role="img"` com o nome do estado e o tempo, ou `aria-hidden` quando a linha já diz tudo no nome acessível |
| Faça | Use sempre com uma palavra ao lado ou no nome acessível |
| Não faça | Não use a identidade num glifo. Não anime um estado terminal |

## Botão

| | |
|---|---|
| Anatomia | Ícone opcional, rótulo, tecla opcional (`.k`). Alturas `--size-control` (32), `-sm` (28), `-xs` (22); raio `--radius-sm` |
| Variantes | **Primário**: `--brand` com `--brand-on`, um por tela. **Secundário**: `--surface-2` com borda `--line-2` e `--shadow-button`. **Fantasma**: sem corpo, para ferramentas e ações raras. **Perigoso**: `--state-error` com `--state-error-on`, só como confirmação final de um diálogo. **New**: elevado sobre a lateral, com o texto em `--brand-ink`. **Ícone**: quadrado, sempre com `aria-label` e tooltip |
| Estados | Todos os comuns. Primário e perigoso escurecem no hover (`--brand-hover`, `--state-error-hover`) e mais no pressionado. Secundário usa `--surface-2-hover` e `--surface-2-press`. O fantasma que alterna um painel fica pressionado com `--brand-tint-plane` e `aria-pressed` |
| Uma primária por tela | A primária é a ação que resolve o que a tela pede. **Send** fica primário com texto só quando nada mais na tela espera uma resposta: com um cartão de pergunta ou de permissão, fica secundário |
| Tokens | `--brand*`, `--state-error*`, `--surface-2`, `--surface-2-hover`, `--surface-2-press`, `--line-2`, `--line-3`, `--shadow-button`, `--shadow-primary`, `--shadow-xs`, `--brand-key-ring` |
| Teclado | `Enter` e `Space`. A tecla da ação aparece no botão (`Allow 1`) e no tooltip (`Alt+←`) |
| Acessibilidade | Desabilitado com `aria-describedby` para a razão; carregando com `aria-busy`; painel com `aria-pressed` |
| Faça | Deixe a ação primária de cada tela como o único azul cheio |
| Não faça | Não ponha o perigoso na tela principal. Não tire o tracejado de um fantasma desabilitado |

## Chip

| | |
|---|---|
| Anatomia | Pílula de `--size-chip` (28), rótulo em 13 px e peso 500, chevron quando abre um menu |
| Variantes | Seletor de modelo e esforço (`Opus · high ▾`), filtro de board ou de PRs |
| Estados | Todos os comuns. Aberto ou escolhido: `--brand-tint` com anel `--brand-ring`. Erro: uma escolha que o catálogo não tem mais, com `◇` e o motivo no tooltip |
| Tokens | `--surface-2`, `--line-2`, `--brand-tint`, `--brand-ring`, `--radius-pill` |
| Teclado | `Enter` e `Space` abrem o menu; `aria-expanded` |
| Faça | Use para uma escolha que muda o contexto do lugar |
| Não faça | Não use chip para status. Status é glifo e chip de tempo |

## Chip de tempo

| | |
|---|---|
| Anatomia | Pílula de 18 px com o tempo (`18m`, `now`) em 12 px, peso 600, algarismos tabulares |
| Variantes | Espera: redondo, cheio de `--state-wait-chip` (uma tinta âmbar, não o âmbar saturado), com tinta `--state-wait-chip-ink` e contorno `--state-wait-ring`. Erro: quadrado, cheio de `--state-error`, `!` antes do tempo em `--state-error-on`: a marca mais forte da árvore nos dois modos. Encerramento: redondo, contornado, `--state-close`. O relógio do agente não é chip: é texto `--ink-3` |
| Estados | Não é interativo. Na linha aberta, o chip de encerramento ganha o fundo `--surface-2` |
| Acessibilidade | O texto oculto diz `waiting for you` ou `error, waiting for you`; o tooltip diz o tempo por extenso |
| Faça | Mostre o tempo da situação mais grave e, entre iguais, da mais antiga |
| Não faça | Não use chip para o relógio do agente: as duas formas separam os dois relógios |

## Input e textarea

| | |
|---|---|
| Anatomia | Rótulo acima (`.field`), caixa de `--size-control` com borda `--line-3` sobre `--surface-input`, ajuda ou erro abaixo |
| Variantes | Input de uma linha; textarea de altura mínima `--size-composer-min`, redimensionável na vertical |
| Estados | Todos os comuns. Hover escurece a borda para `--ink-3`. Foco: borda `--focus` e halo. Erro: borda e trilho interno `--state-error`, com a mensagem abaixo |
| Tokens | `--surface-input`, `--line-3`, `--focus`, `--focus-halo`, `--state-error`, `--error-rail`, `--text-ui`, `--text-body` |
| Acessibilidade | `label for`; o erro ligado por `aria-describedby`; `aria-invalid` no erro |
| Faça | Diga o erro em texto, com o que corrigir |
| Não faça | Não use o placeholder como rótulo |

## Select e menu

| | |
|---|---|
| Anatomia | Gatilho com a anatomia do input e um chevron; menu flutuante (`--surface-3`, `--shadow-float`, raio `--radius-lg`) com itens de `--size-control` |
| Variantes | Lista de escolha (`listbox`: visto no escolhido), menu de ações (`menu`: o destrutivo por último, depois de um separador, em `--state-error`), com legenda em caixa alta e nota |
| Estados | Gatilho: os comuns. Item: realce em `--veil-hover` (hover e teclado), escolhido com visto em `--brand-ink`, desabilitado em `--ink-4` com o motivo, destrutivo em vermelho. Menu carregando e com erro, com a mensagem no lugar dos itens |
| Tokens | `--surface-3`, `--shadow-float`, `--veil-hover`, `--veil-press`, `--brand-ink`, `--state-error`, `--size-menu-min` |
| Teclado | ↑↓ realçam, `Enter` escolhe, `Esc` fecha e devolve o foco ao gatilho, letras saltam ao item |
| Acessibilidade | `aria-haspopup`, `aria-expanded`, `aria-selected` ou `aria-checked`, `aria-disabled` |
| Faça | Marque uma escolha que o catálogo não tem mais como indisponível, sem trocá-la |
| Não faça | Não misture ações e escolhas no mesmo menu |

## Linha da árvore

| | |
|---|---|
| Anatomia | Grade de três colunas: glifo (16 px), texto, borda direita. Linha 1: tipo e nome; meta ou `Ctrl J` à direita. Linha 2: glifo de estado, o que pede ou onde está (sempre com a posição), `+N`, e o relógio. Linha 3, só com o agente rodando: a ação em mono, verbo primeiro, e o medidor |
| Variantes | Os oito estados do glifo; task, One-Shot, review e discussão pelo glifo de tipo; o aviso de clone `◇`; itens de épico recuados em `--epic-indent`, ao longo da guia |
| Estados | Hover: `--veil-hover` e o meta aparece se couber. Foco: anel por fora. Pressionado: `--veil-press`. Aberta: `--brand-veil` com anel `--brand-ring` colado e o glifo de tipo em `--brand-ink`. Desabilitada: apagada, riscada. Carregando: `checking GitHub…` com brilho. Erro: trilho `--error-rail` na borda esquerda. Situação nova: pisca `--state-wait-veil` duas vezes |
| Largura | O nome ocupa as colunas 2 e 3. O meta aparece no hover, no foco e na linha aberta só quando cabe ao lado do nome inteiro, medido a cada mudança de estado da linha: o nome nunca perde largura sob o ponteiro nem sob o foco. Quando não cabe, o meta vai para o tooltip do nome (`Rotate API keys without downtime · api#441`) e continua no nome acessível. `Ctrl J` fica sempre visível. Abaixo de 330 px de lateral, rótulos curtos e o medidor só com a porcentagem. A linha 3 passa à forma curta sempre que a longa não cabe. Nome que corta tem tooltip |
| Tokens | `--surface-sidebar`, `--ink-1..4`, `--weight-name`, `--weight-name-waiting`, `--brand-veil`, `--brand-ring`, `--veil-hover`, `--veil-press`, `--row-pad-y`, `--row-gap`, `--line-gap`, `--tree-pad`, `--epic-indent`, `--sidebar-guide` |
| Teclado | A árvore é uma parada de Tab. ↑↓, `Home`, `End`, ← recolhe ou sobe, → expande, `Enter` abre |
| Acessibilidade | `treeitem` com `aria-level`, `aria-current="page"` na aberta; o nome acessível é a frase inteira (tipo, nome, cada situação com lugar e tempo, posição, quem trabalha, a ação e o contexto) |
| Faça | Deixe o nome inteiro sempre que houver espaço, também em hover e em foco |
| Não faça | Não reordene a árvore sozinha. Não esconda a posição para caber. Não pinte `--ink-4` sobre a linha aberta: o meta sobe para `--ink-3` |

## Cabeçalho de seção

| | |
|---|---|
| Anatomia | Nó de `--size-node` (28): chevron, título, e à direita `4 pending`, `reading…`, `◇ Read failed` ou o resumo do nó recolhido |
| Variantes | **Board**: 14 px, 500, `--ink-2`, abre a visão do board (seta ao passar). **Épico**: 13 px, 500, `--ink-3`, com a guia a 3:1 sob o chevron. **Reviews**: com a contagem de PRs pendentes. **No board** |
| Estados | Hover, foco, pressionado, recolhido com o resumo do mais grave ao menos grave (o mais grave nomeado), vazio (`No active items.`), lendo, falha de leitura (nunca uma situação) |
| Tokens | `--ink-2`, `--ink-3`, `--sidebar-guide`, `--veil-hover`, `--section-gap`, `--guide-x` |
| Acessibilidade | `aria-expanded`; o grupo apontado por `aria-owns`; o resumo recolhido tem nome acessível com todas as contagens |
| Faça | Deixe o board acima do épico em tamanho e tinta |
| Não faça | Não use caixa alta num nó que é um lugar |

## Aba

| | |
|---|---|
| Anatomia | Par segmentado sobre `--surface-0`: glifo da sessão (8 px), nome, `· o que pede` ou o tempo do turno |
| Variantes | Implementer e Reviewer de um step |
| Estados | Hover; foco; pressionada; escolhida (`--surface-2` com `--shadow-xs` e anel de `--line-3` a 3:1 do trilho); desabilitada antes da primeira passada; carregando (`starting`); erro de sessão sem situação (losango e `Session error`) |
| Tokens | `--surface-0`, `--surface-2`, `--shadow-xs`, `--ink-3`, `--size-tab` |
| Teclado | `tablist` com uma parada de Tab (a escolhida); ←→ trocam de aba e abrem a conversa; o produto nunca troca de aba sozinho |
| Acessibilidade | `role="tab"`, `aria-selected`, `aria-controls`; o tempo de espera no nome acessível do glifo e no tooltip |
| Faça | Mantenha o glifo da outra conversa visível: é ela que aponta onde mais se espera |
| Não faça | Não repita na aba o chip de tempo que a barra do pedido e a árvore já mostram |

## Etapa

| | |
|---|---|
| Anatomia | Chip de `--size-control-sm` na trilha, separado por `›` de largura fixa |
| Variantes | Feita (visto, botão com **Back to…**); atual (`--brand-tint-plane`, anel `--brand-marker-ring`, `3/7` e os segmentos: feitos em `--brand`, o atual com o dobro do comprimento, os demais em `--brand-seg-todo`); não iniciada (círculo `--line-deco`) |
| Largura | Abaixo de 1240 px de área principal, as feitas ficam só com o visto; abaixo de 1020 px, as futuras só com o círculo. O nome fica no tooltip e no nome acessível |
| Estados | Hover, foco, pressionado, desabilitada, carregando (`Back to Plan…`), erro (`Can't go back`) |
| Separador | `›` em `--line-deco`, com `aria-hidden`: o nível é o chip |
| Acessibilidade | `aria-current="step"` na atual; os segmentos com `role="img"` e `Step 3 of 7: 2 committed` |
| Faça | Traga a posição dentro da etapa no chip atual |
| Não faça | Não ponha o rótulo de uma situação na trilha |

## Cartão de pedido

| | |
|---|---|
| Anatomia | `--surface-2` com `--shadow-card` e anel `--state-wait-line`, raio `--radius-lg`. Faixa de cabeçalho em `--state-wait-veil`: glifo, tipo (`Question`, `Permission`) em 700 e `--state-wait`, lugar, hora. Corpo: a pergunta em 18/24 ou a descrição e o comando, a nota, as respostas |
| Variantes | **Pergunta**: opções numeradas (tecla, título, trade-off), `Other…`. **Permissão**: ferramenta como tag, o comando em mono, **Allow** `1`, **Allow for this session** `2`, **Deny…** `3`. **Respondido**: faixa neutra, a resposta com visto. **Erro**: bloco afundado com trilho, a razão e o detalhe (saída do git, código de saída), sem botão |
| Estados da opção | Hover, foco, escolhida (`--brand-tint`, `aria-checked`), desabilitada, enviando, erro (`Not sent · the session stopped`) |
| Tokens | `--surface-2`, `--shadow-card`, `--state-wait-veil`, `--state-wait-line`, `--state-wait`, `--brand-tint`, `--brand-ring`, `--text-title`, `--key-size` |
| Teclado | Ao chegar pela notificação ou `Ctrl+J`, o foco vai à primeira opção; 1 a 9 respondem com o foco no cartão |
| Acessibilidade | `fieldset` com `aria-labelledby`; opções em `radiogroup` |
| Faça | Escreva o comando uma vez, aqui |
| Não faça | Não ponha a ação de um erro no bloco: ela fica na barra do pedido |

## Barra do pedido

| | |
|---|---|
| Anatomia | Acima do compositor, na medida da conversa, `--size-ask` de altura mínima: à esquerda o glifo, o rótulo em 700, o lugar e o chip de tempo; no meio a razão ou o progresso; à direita a ação |
| Variantes | **Quieta** (o cartão está na tela): `--surface-0`, só **Show**. **Tingida** (sem cartão: rascunhos, apontamentos, stage): `--state-wait-veil`, com a ação e o que falta (`Stage 2 more files` ao lado de **Approve** tracejado). **Erro**: `--state-error-veil` com trilho e **Retry**. **A outra conversa espera**: quieta, com **Go to Reviewer** |
| Estados | A ação segue os estados do botão (`Retrying…`). A barra existe só enquanto o item pede algo; ao nascer no item aberto, pisca e é anunciada |
| Largura | Quebra em duas linhas antes de esconder uma ação |
| Tokens | `--surface-0`, `--state-wait-veil`, `--state-error-veil`, `--error-rail`, `--state-wait`, `--state-error`, `--size-ask` |
| Acessibilidade | `role="region"` com nome; o texto de estado em `role="status"` |
| Faça | Deixe a ação que resolve aqui e em nenhum outro lugar, fora as três exceções de `structure.md` §3 |
| Não faça | Não repita o comando nem a pergunta: a barra é a chamada, o cartão é o conteúdo |

## Marcador e entradas da conversa

| | |
|---|---|
| Anatomia | Marcador: ícone, texto em 13 px `--ink-3`, hora em `--ink-4`, entre dois fios de `--line-1`. Quem fala: avatar de 24 px, nome, hora |
| Variantes | Etapa ou step iniciado, review iniciado, documento escrito (link), `Review N written · clean/changes` (link), contexto compactado, resposta interrompida. Agente implementador (avatar cheio em `--brand-tint-plane`), revisor (avatar contornado em `--brand-ring`), você (neutro, à direita, em `--surface-user`), MySpec (bloco afundado, `MySpec · sent to the agent`), mensagem na fila (contornada, com **Remove**), atividade (`Working · 3m 20s · Running …`, `Thinking…`, `Retrying (attempt 2)…`), **New messages** flutuante |
| Estados | O marcador que abre algo segue os estados do link. Uma situação nova pisca no véu da sua gravidade: `--state-wait-veil`, ou `--state-error-veil` num erro |
| Tokens | `--line-1`, `--ink-3`, `--ink-4`, `--brand-tint-plane`, `--brand-marker-ring`, `--brand-ring`, `--surface-user`, `--surface-0`, `--shadow-float` |
| Acessibilidade | Marcador `role="separator"`; atividade em `role="status"` |
| Faça | Distinga os dois agentes pela forma do avatar, não só pelo nome |
| Não faça | Não pinte a fala do agente com cor de marca |

## Grupo de ações

| | |
|---|---|
| Anatomia | Bloco afundado; o resumo (chevron, ícone do resultado, `N actions`, as ações principais em mono); aberto, uma linha por ação: ícone, verbo, alvo em mono, status |
| Variantes | Recolhido com tudo feito; aberto com uma ação em curso (spinner, `running` em 500); com uma falha (resumo em `--state-error`, `exit 1` na linha); com uma ação em espera (ampulheta neutra, `waits for your permission`, alvo `the command in the card below`) |
| Estados | Resumo com hover, foco e pressionado |
| Tokens | `--surface-0`, `--veil-hover`, `--veil-press`, `--ink-2..4`, `--state-error`, `--action-verb-w` |
| Teclado | O resumo é `summary`: `Enter` e `Space` abrem e fecham |
| Faça | Deixe recolhido por padrão, com a ação em curso no resumo |
| Não faça | Não use âmbar numa ação em espera: o pedido já está no cartão |

## Bloco de código

| | |
|---|---|
| Anatomia | Afundado, raio `--radius-md`, fio interno; cabeçalho com a linguagem, o caminho em mono (quando existe) e **Copy**; o código em 13/20 |
| Estados de Copy | Hover, foco, copiado (visto e `Copied`), erro (`Can't copy · select the text`) |
| Tokens | `--surface-0`, `--line-1`, `--code-keyword`, `--code-string`, `--code-function`, `--code-number`, `--code-comment`, `--text-code` |
| Acessibilidade | Rola na horizontal dentro do bloco; o botão tem `aria-label` |
| Faça | Mantenha o realce em quatro matizes na luz da tinta |
| Não faça | Não quebre linhas de código para caber |

## Link

| | |
|---|---|
| Anatomia | Texto em `--brand-ink` com sublinhado permanente de 1 px a 45 % |
| Estados | Hover: sublinhado cheio. Foco: anel. Pressionado: `--brand-active`. Indisponível: texto `--ink-4`, sem link. Carregando: spinner e `Opening PR…`. Erro: `✕` e a razão em vermelho |
| Tokens | `--brand-ink`, `--brand-active`, `--mix-link-line`, `--link-offset` |
| Faça | Sublinhe sempre: a cor não é o único portador |
| Não faça | Não use link para uma ação que muda estado: isso é botão |

## Medidor de contexto

| | |
|---|---|
| Anatomia | Trilho de 40 × 4 px em `--brand-track`, preenchimento chapado em `--brand` arredondado para baixo ao pixel, porcentagem de largura fixa |
| Variantes | No cabeçalho do item; na linha 3 da árvore |
| Estados | Hover mostra o tooltip. Sem leitura ainda: trilho com brilho e `…`. Sem sessão: `—`. Estreito (lateral abaixo de 330 px, área principal abaixo de 900 px): só a porcentagem |
| Tokens | `--brand`, `--brand-track`, `--meter-w`, `--meter-h`, `--meter-label` |
| Acessibilidade | `role="meter"` com `aria-valuenow` |
| Faça | Deixe a porcentagem sempre legível |
| Não faça | Não ponha o medidor em âmbar ao encher: ele não é uma situação |

## Tooltip

| | |
|---|---|
| Anatomia | A única superfície invertida: `--tooltip-surface`, texto em 13 px `--tooltip-ink`, tecla em mono `--tooltip-ink-2`, raio `--radius-sm`, até `--size-tooltip-max` |
| Comportamento | Abre depois de `--delay-tooltip` no hover e na hora no foco pelo teclado (o foco numa linha da árvore mostra o tooltip do nome); `Esc`, rolar ou clicar fecham; fica abaixo do alvo, ou acima quando não cabe, sempre em pixel inteiro |
| Usos | O nome e a tecla de uma ação; o relógio por extenso; o texto inteiro de algo que corta; a razão de um controle desabilitado |
| Acessibilidade | `role="tooltip"`; nunca é o único portador de uma informação: o nome acessível já a tem |
| Faça | Escreva o atalho no tooltip de toda ação que tem um |
| Não faça | Não ponha controles dentro de um tooltip |

## Diálogo

| | |
|---|---|
| Anatomia | Sobre `--scrim`: folha `--surface-3` com `--shadow-overlay`, raio `--radius-xl`, até `--size-dialog`. Título em 18/24, fechar; corpo com o que será perdido; rodapé afundado com **Cancel** e a confirmação por último |
| Estados | Padrão; confirmando (`Deleting…`, **Cancel** desabilitado); falha (a razão no rodapé, **Try again**) |
| Tokens | `--scrim`, `--surface-3`, `--surface-0`, `--shadow-overlay`, `--radius-xl`, `--size-dialog` |
| Teclado | O foco começa em **Cancel** e fica preso; `Esc` e o × fecham e devolvem o foco |
| Acessibilidade | `role="dialog"`, `aria-modal`, `aria-labelledby` |
| Faça | Diga exatamente o que será perdido e o que fica |
| Não faça | Não abra um lugar em diálogo. Lugares são páginas |

## Toast e aviso

| | |
|---|---|
| Anatomia | **Toast**: flutuante, `--surface-3` com `--shadow-float`, até `--size-toast`: ícone, texto, detalhe, ação opcional, dispensar. **Aviso do app**: faixa no topo da área principal, `--state-error-veil` com trilho, rótulo em vermelho e 700, detalhe, **Dismiss**. **Faixa de bloqueio**: sob a barra do item, afundada, com `◇` e a ação (**Change path**) |
| Estados | O toast entra em `--duration-base` com `--ease-enter` e sai em `--duration-fast` com `--ease-exit`; mora na região `.toasts`, embaixo à esquerda da área principal (`--z-toast`), que é também a região `aria-live` do app. O aviso fica até ser dispensado |
| Tokens | `--surface-3`, `--shadow-float`, `--state-error-veil`, `--state-error`, `--error-rail`, `--size-toast` |
| Acessibilidade | Toast em `role="status"`; aviso de erro em `role="alert"` |
| Faça | Use o toast para um item que saiu sem estar aberto |
| Não faça | Não use toast para algo que depende do usuário: isso é uma situação |

## Compositor

| | |
|---|---|
| Anatomia | Caixa `--surface-input` com borda `--line-3`, raio `--radius-lg` e `--shadow-xs`, na medida da conversa: textarea em 15/22; rodapé com o chip de modelo e esforço, a dica e **Send** |
| Estados | Hover, foco (borda e halo), com texto (**Send** vira primário se nada mais na tela espera uma resposta; com um cartão na tela, fica secundário), desabilitado com a razão no placeholder, enviando, erro (`Not sent · the session stopped`, **Send again**), agente trabalhando (**Stop**, a mensagem entra na fila), pausado (`Sending resumes the task…`) |
| Tokens | `--surface-input`, `--line-3`, `--focus`, `--focus-halo`, `--shadow-xs`, `--state-error`, `--size-composer-min` |
| Teclado | `Enter` envia, `Shift+Enter` quebra a linha |
| Acessibilidade | Rótulo que diz a quem se responde (`Reply to the implementer`) |
| Faça | Diga no placeholder a quem se responde |
| Não faça | Não desabilite o compositor numa conversa em que o produto não age mais: ele continua aceitando mensagens |

## Spinner e brilho

| | |
|---|---|
| Anatomia | **Spinner**: um só no sistema, o meio arco do glifo "trabalhando": anel de `--glyph` com traço de `--border-2`, dois quartos em `--state-work` (ou `currentColor` num botão) sobre `--state-work-track`. **Brilho**: um gradiente que corre sobre o texto ou o trilho |
| Sentido | O spinner diz que alguém trabalha: o agente, ou o app numa ação sua. O brilho diz que uma leitura ainda não tem resultado: `checking GitHub…`, o medidor antes da primeira leitura |
| Movimento | `--duration-spin` e `--duration-shimmer`, lineares, em laço, só enquanto dura. Com movimento reduzido: o spinner para como anel de três quartos, o brilho vira tinta chapada |
| Faça | Use o spinner em botões carregando, na linha e na atividade da conversa |
| Não faça | Não desenhe outro spinner. Não use laço para um estado terminal |

## Cabeçalho de navegação e breadcrumb

| | |
|---|---|
| Anatomia | `←` `→` fantasmas de ícone, o breadcrumb (`board / épico /`, em 13 px `--ink-3`, separadores `/` em `--line-deco` com `aria-hidden`), o glifo de tipo em `--brand-ink`, o título em 18/24 e peso 600, a referência em mono |
| Estados | `←` com o destino no tooltip (`Back to Platform Roadmap · Alt+←`); `→` desabilitado, tracejado, `Nothing ahead`. Os níveis do breadcrumb são links |
| Largura | Forma provisória até a fase 4: abaixo de 1020 px de área principal o breadcrumb fica com o pai (`… /`), abaixo de 900 px só com o item; o breadcrumb encolhe antes do título |
| Teclado | `Alt+←` e `Alt+→`; `nav` com `aria-label="Breadcrumb"` |

## Seletor de tema

| | |
|---|---|
| Anatomia | Fantasma de ícone no rodapé da lateral |
| Estados | Três, em ciclo: System, Light, Dark. O estado está no `aria-label` e no tooltip (`Theme: System · click to change`) |
| Faça | Aplique na hora, sem recarregar |

## Indicador de rolagem da árvore

| | |
|---|---|
| Anatomia | Esmaecido do fundo da lateral sobre as últimas linhas e `↓ N more below` em 12 px `--ink-3` |
| Estados | Some quando nada está abaixo da vista; o clique rola ao fim. Não é uma parada de Tab: a árvore já se percorre pelo teclado |

## Tag e tecla

| | |
|---|---|
| Tag | Mono de 12 px sobre `--surface-0`, raio `--radius-xs`, `--size-time-chip` de altura: a ferramenta de uma permissão (`Bash`) |
| Tecla | Mono de 12 px sobre `--surface-2`, borda `--line-2` com a de baixo em `--border-2`, `--size-kbd`. Dentro de um botão, a tecla da ação (`.k`); num primário, contorno `--brand-key-ring`. `Ctrl J` usa `--brand-tint` e `--brand-ring` |
| Faça | Escreva a tecla com a mesma forma em todas as ações de um grupo |

## Avatar

| | |
|---|---|
| Anatomia | Círculo de `--size-avatar` com o ícone de quem fala |
| Variantes | Implementador: cheio em `--brand-tint-plane` com anel `--brand-marker-ring`. Revisor: só o anel `--brand-ring`. Você: neutro. MySpec: o ícone do produto, sem círculo |

## O que a fase 4 vai pedir

Sem desenho ainda, para não serem inventados tela a tela: checkbox, radio e switch (Settings › Defaults); controle segmentado; linha de lista e de tabela (board, History, Reviews); esqueleto de carregamento (a lateral no início do app, `structure.md` §7); estado vazio de página; a lateral recolhida (`--sidebar-collapsed`); o painel e a coluna de decisão (`--panel-width`, `--decision-width`); a transição entre lugares; a barra de rolagem; e uma regra de ícones (o conjunto, o traço de `--icon-stroke`, um ícone por significado).
