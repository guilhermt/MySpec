# Design system

Como o design system do MySpec, definido em `design/system/`, chega ao frontend: os tokens, o tema, a ponte com o shadcn, os utilitários, as fontes, as regras do WebKitGTK, o código e os componentes de `frontend/src/components/system/`.

## Fonte dos tokens

`design/system/tokens.css` é a fonte única dos valores: cores em oklch nos dois temas, fontes, tamanhos de texto e de controle, espaços, raios, sombras, durações e curvas. `frontend/src/styles/globals.css` o importa direto (`@import "../../../design/system/tokens.css"`), sem cópia. Como o arquivo está fora de `frontend/`, o `build:frontend` de `build/Taskfile.yml` o lista nos `sources`, e uma mudança só nele reconstrói o frontend.

O arquivo tem o tema escuro escrito duas vezes: num bloco `@media (prefers-color-scheme: dark)`, para os mocks de `design/`, e em `[data-theme="dark"]`. No app o bloco da media query é inerte, porque o `documentElement` sempre tem `data-theme` (a seção seguinte).

## Tema

O tema é o atributo `data-theme` do `documentElement`, `light` ou `dark`:

- um script em `frontend/index.html` o escreve antes do primeiro render, a partir da preferência salva e do esquema do sistema, para a interface nunca piscar no tema errado;
- `features/theme/useApplyTheme.ts` o mantém em dia quando a preferência ou o esquema do sistema mudam;
- a variante `dark:` do Tailwind é `&:is([data-theme="dark"] *)`;
- `backgroundFor`, em `internal/app/theme.go`, pinta atrás do webview o `--surface-1` de cada tema, em sRGB, e o primeiro frame da janela já tem a cor certa. `internal/app/theme_test.go` lê o `--surface-1` dos dois temas em `tokens.css`, o converte de OKLCH para sRGB e falha quando `backgroundFor` deixa de corresponder.

## Ponte do shadcn

Os primitivos de `components/ui/` leem as variáveis do shadcn (`--background`, `--primary`, `--muted-foreground`...). `globals.css` as declara em `:root, [data-theme]` como apontamentos para os tokens, sem valor próprio, e assim os primitivos se pintam com o system sem ser editados. Declaradas também em `[data-theme]`, elas se resolvem contra as cores de um subtree com tema próprio.

| Variável do shadcn | Token |
|---|---|
| `--background`, `--foreground` | `--surface-1`, `--ink-1` |
| `--card`, `--secondary` | `--surface-2` |
| `--popover` | `--surface-3` |
| `--muted`, `--muted-foreground` | `--surface-0`, `--ink-3` |
| `--primary`, `--primary-foreground` | `--brand`, `--brand-on` |
| `--accent` | `--veil-hover` |
| `--destructive` | `--state-error` |
| `--input` | `--line-3` |
| `--ring` | `--focus` |
| `--sidebar`, `--sidebar-border` | `--surface-sidebar`, `--sidebar-line` |
| `--*-foreground` restantes | `--ink-1` |

O `--border` do shadcn não é declarado: `--border` é a espessura de `1px` do system, e a cor das bordas é o utilitário `--color-border`, que aponta para `--line-2`.

As cores de status de sessão (`--status-working`, `--status-attention`, `--status-success`, `--status-paused`) são aliases de `--state-work`, `--state-wait`, `--state-close` e `--state-paused`, para as telas que ainda as leem. A espera tem dois: `--status-attention` é o texto, em `--state-wait`, e `--status-attention-fill` é o preenchimento (o ponto de status, o véu de uma linha pendente, o trilho dos cartões de pergunta e de permissão, a piscada), em `--state-wait-glyph`, a regra Cor da espera de `components.md`.

## Utilitários

O `@theme inline` de `globals.css` registra cada token como utilitário do Tailwind, com o mesmo nome: cores (`bg-surface-2`, `text-ink-3`, `border-line-2`, `bg-state-error-veil`), sombras (`shadow-float`) e curvas (`ease-standard`). As linhas são auto-referentes, `--color-x: var(--x)` e `--shadow-xs: var(--shadow-xs)`: só registram o nome, e o valor vem da declaração sem camada de `tokens.css`, que vence a da camada do tema. Os `--code-*` não viram utilitário, porque só o tema do código os lê.

Os nomes que o Tailwind e o system compartilham:

- `--border` é o `1px` do system, e `border-border` pinta `--line-2`;
- `--radius-*` não entra no `@theme`: `rounded-xs…xl` leem os raios do system (3, 6, 8, 12 e 16 px), e o pill é `rounded-(--radius-pill)`;
- `--font-mono` não é declarado no `@theme`, e `font-mono` lê a Fira Code do system;
- `--shadow-xs` é registrado por autorreferência, senão o Tailwind embutiria o valor padrão dele;
- `--duration-base` e `--sidebar-width` valem os do system.

As classes dos componentes seguem uma convenção, sem nenhum valor solto:

- cor, sombra e curva: o utilitário registrado;
- tamanho de texto: `text-(length:--text-meta) leading-(--leading-meta)`, sempre o par. O `length:` é necessário porque, sem ele, o Tailwind lê `text-(--x)` como cor;
- duração: `duration-(--duration-fast)`;
- tamanho de controle e de ícone: `h-(--size-control)`, `size-(--icon)`;
- raio: `rounded-xs…xl` ou `rounded-(--radius-pill)`;
- peso: `font-normal`, `font-medium`, `font-semibold` e `font-bold`;
- espaço: a escala numérica do Tailwind, que é a do system, só nos degraus que ele tem (0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 12 e 16);
- camada: `z-(--z-tooltip)`;
- distância de um popup do Base UI, que é um número em JS: uma constante com o nome do token que ela espelha, testada contra `tokens.css` como o `TOOLTIP_DELAY_MS` (`TOOLTIP_OFFSET_PX` é `--space-1-5`, `LIST_OFFSET_PX` é `--space-1`).

Os `@utility` de `globals.css` são as regras compostas que se repetem nos componentes:

- `focus-ring`: o anel de foco por fora, com folga;
- `field-focus`, `field-error` e `field-error-focus`: a borda e o halo de um campo em foco; a borda e o trilho interno de um campo com erro; e, num campo em erro com foco, a borda de erro e o trilho com o halo por fora, porque os dois portadores convivem;
- `dashed-disabled`: o desabilitado de toda variante, com a linha tracejada e a tinta apagada;
- `spin-glyph`: o giro do spinner, que sem movimento para como um anel de três quartos;
- `shimmer-text`, `shimmer-fill` e `shimmer-track`: o brilho de uma leitura sem resultado sobre texto, preenchimento ou trilho do medidor, chapado sem movimento.

## Fontes

A interface usa a Fira Sans (400, 400 itálico, 500, 600 e 700) e o mono, a Fira Code (400 e 500), ambas do `@fontsource`, importadas em `styles/fonts.css`. O mono é escrito sem ligaduras, e `html` declara `font-synthesis: none`: todo peso e o itálico usados são carregados, nunca sintetizados. Como elas renderizam no WebKitGTK está em [target-machine.md](../development/target-machine.md).

## Regras do WebKitGTK

O WebKitGTK compõe um elemento em meio pixel e o reamostra, o que borra texto e bordas. Por isso:

- todo tamanho dos tokens é um pixel inteiro, e `styles/globals.test.tsx` falha quando um deixa de ser; os glifos de estado têm tamanhos pares, para centralizar num pixel inteiro;
- toda largura que depende da janela é arredondada com `round()`, como a lateral e o preenchimento do medidor de contexto;
- os diálogos abrem a `8vh` do topo e crescem para baixo, com o `left` e o translate horizontal arredondados, por uma regra sem camada que os seleciona pelo `data-slot`; o teste falha quando os componentes gerados deixam de corresponder a ela;
- o véu atrás de um diálogo é o `--scrim`, sem desfoque;
- a busca é um campo `type="text"` com `role="searchbox"` e `enterKeyHint="search"`, porque num `type="search"` o WebKit desenha o botão de cancelar dele ao lado do `×` do system;
- todo ícone do Lucide (`svg.lucide`) desenha com o traço `--icon-stroke` do system.

## Código

O código da conversa é destacado pelo Streamdown com o shiki. `features/chat/code-theme.ts` define um par de temas, claro e escuro, cujas cores são `var(--code-*)`: o destaque segue o tema sem trocar de tema no shiki. Nenhum escopo do tema tem `fontStyle`: o código é todo em peso 400, sem itálico nem negrito, e só o matiz separa os tipos de token. O `Markdown` passa `lineNumbers={false}`, e o código não tem números de linha. O cromo do bloco de código (cabeçalho, botão de copiar, corpo) e do código inline é pintado em `globals.css` pelos atributos `data-streamdown`. O mermaid usa os temas dele, `neutral` no claro e `dark` no escuro, com a fonte da interface.

## Componentes

Os componentes do design system moram em `frontend/src/components/system/`, um por arquivo, importados pelo arquivo (`@/components/system/Button`), sem barril. Cada um tem o seu teste ao lado.

Um componente **embrulha** o primitivo de `components/ui/` quando os estados do system se alcançam pela `className` do elemento que os carrega; as classes do primitivo que contradizem o system são neutralizadas explicitamente, variante por variante, `dark:` incluída, e o `cn` as troca. Onde o `cn` não reconhece a troca, a classe do system vence pela cascata: a sombra sobre um primitivo que traz a sua é escrita `shadow-(--shadow-float)`, que o `cn` lê como sombra; o foco e o erro de um campo (`field-focus!`, `field-error!`) são importantes, porque todo anel do primitivo reescreve o `box-shadow` inteiro; e o desabilitado de um gatilho próprio vem de `aria-disabled:`, cuja variante pesa mais que as classes simples. Ele é **próprio sobre o Base UI** quando uma parte que o system estiliza não é exposta, ou quando o papel ARIA muda.

| Componente | Arquivo | Base | Razão |
|---|---|---|---|
| Botão, botão de ícone | `Button.tsx`, `IconButton.tsx` | `ui/button` | Foco, desabilitado, hover e o deslocamento ao pressionar se sobrescrevem no elemento |
| Chip | `Chip.tsx` | `ui/toggle` (alterna), `ui/button` (abre menu) | Idem |
| Tecla | `Kbd.tsx` | `ui/kbd` | Idem |
| Rótulo, input, textarea | `Field.tsx`, `Input.tsx`, `Textarea.tsx` | `ui/label`, `ui/input`, `ui/textarea` | Idem |
| Menu | `Menu.tsx` | `ui/dropdown-menu` | Idem, no conteúdo e nos itens |
| Select | `Select.tsx` | `ui/dropdown-menu` e itens próprios sobre `Menu.RadioItem` do Base UI | O item de rádio do ui põe o visto à direita, sem `className`; o system o quer à esquerda |
| Listbox | `Listbox.tsx` | Próprio sobre `@base-ui/react/combobox` | Não há primitivo de lista com busca |
| Diálogo | `Dialog.tsx` | `ui/dialog`, `ui/alert-dialog` | O conteúdo se sobrescreve por classe; posição e véu vêm das regras sem camada |
| Collapsible | `Collapsible.tsx` | `ui/collapsible` | Sem estilo próprio |
| Esqueleto | `Skeleton.tsx` | `ui/skeleton` | O fundo e a animação se sobrescrevem no elemento |
| Tooltip | `Tooltip.tsx` | Próprio sobre `@base-ui/react/tooltip` | A seta e a animação estão em partes sem `className`, e a pausa do provider do ui é zero |
| Scroll area | `ScrollArea.tsx` | Próprio sobre `@base-ui/react/scroll-area` | O polegar e o viewport do ui não expõem `className` |
| Caixa de seleção | `Checkbox.tsx` | Próprio sobre `@base-ui/react/checkbox` | O alvo é a linha inteira |
| Rádio | `Radio.tsx` | Próprio sobre `@base-ui/react/radio-group` | O ponto do ui não tem `className`, e o alvo é a linha |
| Controle segmentado | `SegmentedControl.tsx` | Próprio sobre `@base-ui/react/radio-group` | O system pede `radiogroup` e `radio` com `aria-checked`, não botões com `aria-pressed` |
| Etiqueta, tag, placeholder | `Badge.tsx`, `Tag.tsx`, `Placeholder.tsx` | Próprios | O `ui/badge` é uma pílula com variantes que o system não tem |
| Glifo, spinner, brilho, ícone, link, chip de tempo, busca | `StateGlyph.tsx`, `Spinner.tsx`, `Shimmer.tsx`, `Icon.tsx`, `Link.tsx`, `TimeChip.tsx`, `SearchInput.tsx` | Próprios | Não há primitivo |
| Estado vazio, faixa de aviso, linha afundada, medidor de contexto | `EmptyState.tsx`, `NoticeStrip.tsx`, `SunkenLine.tsx`, `ContextMeter.tsx` | Próprios | Não há primitivo |
| Cabeçalho do lugar | `PlaceHeader.tsx` | Próprio, sobre o botão de ícone, o menu e o tooltip | Não há primitivo |

As convenções de todo componente:

- exports por nome, `export interface XProps` acima do componente e um comentário `/** */` de uma linha em cada export;
- classes com `cn`, e variantes com `cva` quando há duas ou mais dimensões. Uma `className` do chamador serve só para layout e é mesclada por último;
- os estados comuns: hover em `hover:bg-veil-hover` ou no degrau `-hover`, foco em `focus-visible:focus-ring` (`field-focus` nos campos), pressionado em `active:bg-veil-press`, escolhido em `--brand-tint` com `aria-pressed` ou `aria-checked`, desabilitado em `dashed-disabled`, erro em `text-state-error` sobre `bg-state-error-veil`;
- o teste renderiza com `renderWithStore`, busca por papel e nome acessível completo, prova um comportamento por `it` e não usa snapshots;
- o que ele pinta é provado na suíte de estilo computado, em `X.painted.test.tsx` ao lado, no Chromium, com o CSS real e nos dois temas ([testing.md](../guidelines/testing.md)). Ela cobre os que embrulham um primitivo de `components/ui/`: botão e botão de ícone (`Button.painted`), chip, tecla, rótulo e linha de ajuda (`Field.painted`), input e textarea (`Input.painted`), menu, select, diálogo, esqueleto e collapsible; e os próprios com estado de cor que os controles usam: caixa de seleção, rádio, controle segmentado, listbox e busca. Os próprios sem estado interativo (etiqueta, tag, placeholder, glifo, chip de tempo, faixa de aviso, linha afundada, medidor de contexto, link) ainda não têm a sua; as tasks de tela os acrescentam quando os usam.

**Desabilitado com a razão.** Aceitam `disabled` e `disabledReason` o botão, o botão de ícone, o chip, o input, o textarea, a busca, o select, o listbox, a caixa de seleção, o grupo de rádios e o controle segmentado; o item de menu leva a razão no próprio texto, depois de `·`. Desabilitado, o controle continua focável, com `aria-disabled="true"`, ignora a ativação e aponta por `aria-describedby` para um `<span>` com a razão, logo depois dele. `reasonId` substitui o `<span>` quando a razão está noutro lugar, como o rodapé de um diálogo ou uma `SunkenLine`. No `IconButton` a razão vai no tooltip. Num campo de texto, desabilitado é somente leitura, e dentro de um `Field` a razão vai na linha de ajuda, depois da ajuda, somada à descrição dela. Não são controles com esse estado: o link (indisponível, ele é texto, não link), o collapsible e o resumo do grupo de ações (não se desabilitam), o tooltip e o `MenuCycleItem`.

**Carregando.** `loading` com `loadingLabel` (o gerúndio, `Approving…`): o controle mostra o `Spinner` e o gerúndio, tem `aria-busy="true"`, continua focável e ignora a ativação. No botão, o gerúndio toma o lugar do rótulo, e o tipo de `ButtonProps` exige `loadingLabel` sempre que `loading` pode ser verdadeiro; no botão de ícone, o spinner toma o lugar do ícone e o nome continua o rótulo. Carregam assim o botão, o botão de ícone, o chip (com o mesmo `ButtonLoading`, que exige o gerúndio), o link e a caixa de seleção (o spinner no lugar da caixa). No input, no textarea e na busca, o controle fica com `aria-busy` e o spinner com o gerúndio vão na linha de ajuda do `Field`, ou ao lado do controle fora de um. Uma leitura sem resultado brilha em vez de girar: o chip com `reading`, e o select e o listbox com `loading`, mostram a escolha salva com o `Shimmer` e ficam com `aria-busy`. O select, o listbox e o menu trocam os itens pela `MenuMessage`, neutra (`status`) ou de erro (`alert`), com **Try again** quando o chamador dá `onRetry`. O rádio e o controle segmentado não carregam.

**Diálogo.** Sem `initialFocus`, um diálogo `alert` abre com o foco no `DialogCancel`, o **Cancel** secundário do rodapé, que o fecha; os outros abrem no primeiro campo do `DialogBody` que recebe texto (um campo desabilitado, `:disabled` ou `aria-disabled`, fica de fora) e, sem campo, no próprio diálogo. O `×` nunca é o foco inicial. `initialFocus` fica para a exceção explícita.

**Tooltip.** Abre depois da pausa no hover e na hora num foco de teclado, o que casa com `:focus-visible`. Um foco que não é visível, como o que um diálogo aberto com o ponteiro põe no **Cancel**, não abre tooltip: o Base UI já o recusa no navegador, e o `Tooltip` o recusa também, para não depender disso.

**Gatilho da lateral.** O select tem duas variantes: `field`, com a anatomia do input, e `sidebar`, o gatilho no tom da barra lateral, de `--size-control-sm`, sobre `--sidebar-input` com a borda `--sidebar-control` e a escolha em `--text-meta` e `--ink-2`, que o filtro por repositório usa. O menu é o mesmo nas duas.

**Escolha indisponível.** Uma escolha que o catálogo não tem mais aparece no gatilho do select e do listbox como `◇ old · unavailable`, e o nome do gatilho diz o mesmo (`Base branch: old · unavailable`): o `◇` não é o único portador.

**Campo fora de um `Field`.** O controle fica sempre dentro do mesmo invólucro, `display: contents` sem linha, e a razão ou o gerúndio aparecem dentro dele: o `<input>` nunca é remontado, e o foco e o valor sobrevivem ao carregando que liga e desliga enquanto se digita.

**Chip.** Dois tamanhos: `md`, de `--size-chip`, e `sm`, de `--size-chip-sm` com o rótulo em `--text-micro`, para as linhas densas. Em erro (`errorReason`), o losango de erro antes do rótulo e a tinta `--state-error` sobre `--state-error-veil` com a borda `--state-error`, também sob o ponteiro; a razão vai no tooltip e na descrição acessível, e a cor nunca é o único portador.

**Scroll area.** O anel de foco é o único desenhado por dentro, no viewport, porque por fora ele seria cortado pelo que envolve a área. `viewportRef` entrega o viewport a quem mede ou rola o conteúdo.

**Peças de uma feature.** As peças da barra lateral (a árvore em `Tree`, `TreeRow`, `TreeNodeRow` e `CloneNotice`; o topo em `SidebarTop` e `NewMenu`; `SidebarFilter`, `MoreBelow`, `SidebarFooter` com `ThemeButton`, e a faixa recolhida em `SidebarRail`) moram em `features/sidebar/`, feitas só de componentes de `components/system/`, porque só a lateral as usa. A faixa desenha cada item como um bloco com os mesmos glifos de tipo e de estado da linha (`TYPE_ICONS` e `ROW_GLYPHS`, de `TreeRow`), e o anel de foco dos blocos é desenhado por dentro, como o do scroll area, porque a faixa rola. A piscada de uma situação nova é a classe `tree-flash` com `data-flash="error"` ou `"wait"`: duas vezes `--duration-slow` no véu da gravidade, e nada sem movimento.

**Ícones.** `icons.ts` é o mapa de significado para ícone (`ICONS`): cada significado tem um ícone só, o mesmo no produto inteiro. `Icon` o desenha num tamanho e num tom do system. Um ícone é um `IconGlyph`: um ícone do lucide ou um SVG próprio do system, e os dois recebem uma classe e se escondem do leitor. Os próprios, em `type-icons.tsx`, são os glifos de tipo de um item (`TaskIcon`, `OneShotIcon`, `ReviewIcon`, `DiscussionIcon`), a seta de ir a um lugar (`GoIcon`) e a marca (`MarkIcon`), na grade de 16 px, com a classe `lucide` para receberem o traço da mesma regra global. Um componente de `components/system/` nunca importa do `lucide-react` um ícone que o mapa tem (o visto é `ICONS.done`), e `Icon.test.tsx` falha quando um importa.

**Cabeçalho do lugar.** `PlaceHeader` é a faixa de `--size-head` no alto de um lugar, com o fio `--line-1` embaixo: `←` (desabilitado com `Nothing to go back to` sem destino), `→` só com destino, os dois com o destino e a tecla no tooltip; o breadcrumb, um `nav` `Breadcrumb` com os níveis em `--text-meta` e `--ink-3`, os que abrem um lugar como botões com a aparência de texto sublinhado no hover, e os `/` em `--line-deco`, `aria-hidden`; o título, um `h1` com `tabindex="-1"`, em `--text-body` e peso 600, que corta com o nome inteiro no tooltip; e à direita o que o lugar põe nele, na ordem. Ele é só apresentação: `features/navigation/LocationHeader` o liga ao store, com o título e o breadcrumb de `lib/locations.ts`, os destinos de `←` e `→` e o foco que a ida pediu (`pendingFocus`), dado ao título ou ao botão quando o cabeçalho do lugar novo aparece. Nada nele quebra linha: ele cede pela largura da área principal, o container `main` (a classe `.main-area` no `main` do shell), com as variantes `@max-[Npx]/main:` e `@min-[Npx]/main:` em limites fixos. O breadcrumb dobra num `…` com o menu dos níveis abaixo de 1660 px; à direita, **Pause** (`PauseButton`) fica só com o ícone abaixo de 1360 px, o anel do `ContextGauge` sai abaixo de 1300 px, e `Review: <modo>` e **Models** ficam só com o ícone abaixo de 1040 px, com o nome no tooltip e no nome acessível; o título corta por último. Todo lugar da área principal o tem, cada um com a sua direita. `PauseButton` e `CardLink`, o link do card no GitHub como botão de ícone `ICONS.external`, moram em `src/components/`, porque os cabeçalhos da task, do review, da discussão e dos arquivados os usam. A suíte de estilo computado confere a faixa a 812 px de área principal, a de uma janela de 1100 px com a lateral mais estreita, com o título mais longo: tudo numa linha, só o título cortado.

**Painel auxiliar e grupo de painéis.** `AuxPanel.tsx` reúne as três peças. `PanelGroup` são os botões dos painéis de um lugar, no cabeçalho: um botão fantasma `sm` por painel, com ícone e rótulo (abaixo de 1440 px de área principal só o ícone), `aria-pressed`, o que o painel mostra no tooltip e o id `panelTriggerId(id)`; o clique alterna, e só um painel fica aberto por vez. `PanelLayout` põe a coluna de leitura e, depois dela, o painel aberto. `AuxPanel` é um `aside` com o nome do título, a classe `.aux-panel`: largura `round(down, var(--panel-width), 1px)`, entrada animada em `--duration-base` e saída imediata; a partir de 1120 px de área principal (container query `main`) fica em coluna, ao lado da leitura, sobre `--surface-0` com o fio `--line-1`; abaixo disso cobre a coluna, sobre `--surface-3` com `--shadow-overlay`. O cabeçalho tem o título e `×` (`Close`, `Esc`); o corpo rola num `ScrollArea`. Não é modal: o foco circula livre, e `×` ou `Esc` (o atalho global, antes de qualquer outro dono do `Esc` do lugar) fecha e devolve o foco ao botão. O painel aberto é `panel` no store, e toda navegação o fecha.

**Região de toasts.** `ToastRegion` é a região ao vivo do app, a classe `.toasts`: posicionada no canto inferior esquerdo da área principal, a `--space-4` das bordas, em `--z-toast`, com os toasts em coluna separados por `--space-2`. O anúncio fica nela, visualmente oculto (`sr-only`), e um anúncio novo remonta o texto, que é dito de novo mesmo quando repete.

**Toast.** `Toast` é um aviso curto dentro da região de toasts, sem papel próprio: `--surface-3`, `--shadow-float`, até `--size-toast` de largura, o ícone em `--ink-3`, o texto, a ação como botão fantasma `sm` sob o texto e o `×` (`Dismiss`). Ele entra subindo em `--duration-base` com `--ease-enter` e sai ao ser removido. Sai sozinho depois de `TOAST_MS` (10 s), um tempo que só corre enquanto ele não tem o ponteiro nem o foco e retoma com o que faltava.

**Página do item que saiu.** `GonePage` é o corpo do lugar de um item que saiu: na medida `--measure-read`, alinhada à esquerda, o ícone `muted`, o título em `--text-title` e as ações numa linha. A primeira ação habilitada é a principal (`primary`) e recebe o foco ao aparecer; as outras são secundárias, e uma desabilitada fica tracejada com a razão ao lado. `features/navigation/GoneView` a monta pelo que o estado diz do item (`goneOutcome` e `goneTitle` de `lib/locations.ts`), sob o cabeçalho do lugar sem nada à direita.

**Chip de tempo.** O leitor de tela ouve o tempo por extenso, depois do estado (`waiting for you, 18 minutes`); o tempo curto é só visual, `aria-hidden`, e o tooltip dá o por extenso ao ponteiro.

**Medidor de contexto.** `ContextMeter` é um `meter` com `aria-valuenow` arredondado, que nunca muda de cor ao encher. Sem leitura, ele brilha e mostra `…`; pausado, mostra `—`; nos dois casos `aria-valuetext` diz o estado ao leitor de tela.
