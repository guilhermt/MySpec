# Crítica da task 1 · Fundação I

Revisão da implementação mergeada em `main` (`9aa29b6`, PR #60) contra `design/tasks/01-foundation.md`, `design/implementation.md` (§1 e task 1), `design/system/tokens.css`, `design/system/components.md` (Fundamentos, Controles, Estado vazio, Esqueleto, Faixa de aviso, Linha afundada, Bloco de código, Medidor de contexto, Diálogo) e `design/principles.md`. Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa.

**Como foi verificado.** Os testes de `components/system/`, `styles/`, `features/chat` e `features/theme` rodam verdes (36 arquivos, 222 testes) numa cópia do commit, e o CI do PR passou (Build, Frontend, Go). O `vite build` gera todas as classes dos wrappers (conferido no CSS de saída, inclusive as variantes compostas e os `@utility`). O app não sobe fora do Wails: não há modo de navegador com mock (`vite.config.ts` não tem, e `test/wails-mock.ts` é do Vitest). Por isso as telas antigas retematizadas **não** foram capturadas. No lugar, uma página de bancada numa cópia do commit, fora do repositório, renderizou todos os wrappers e um `Markdown` com código, e foi capturada no Chromium headless, claro e escuro, a 1250 e a 2560 px, com um diálogo aberto e com os estilos computados despejados. O Chromium não é o WebKitGTK: as conclusões de cascata e de cor valem, as de nitidez não. O espécime `lab/08-visual-final/specimen.html` foi capturado nos dois esquemas para comparação. O contraste foi medido pelos valores OKLCH de `tokens.css` convertidos para sRGB, com os véus e misturas compostos como o CSS os compõe (`color-mix(in srgb)`).

## 1. Fonte única dos tokens e cor solta

Conforme.

- `styles/globals.css:4` importa `design/system/tokens.css` direto; `styles/tokens.css` não existe mais e `main.tsx` não o importa. `build/Taskfile.yml:39` põe o arquivo nos `sources`.
- `grep` por `oklch(`, `rgb(`, `rgba(`, `hsl(` e hexadecimal em `src/` fora de `components/ui/`: nenhum resultado. Classes da paleta do Tailwind (`text-red-*`, `bg-amber-*`…) fora de `ui/`: nenhuma. Em `ui/`, só `bg-black/10` dos véus (`ui/dialog.tsx:34`, `ui/alert-dialog.tsx:31`), vencido pela regra do `--scrim` (computado: `oklch(0.2 0.01 60 / 0.28)` no claro, `/ 0.6` no escuro, `backdrop-filter: none`).
- O guarda de `styles/globals.test.tsx:155–171` não pega uma classe da paleta do Tailwind (`text-red-500` lê o oklch do tema do Tailwind, fora de `tokens.css`). Hoje não há nenhuma; o teste não impede a primeira.
- Restos com literal, fora do escopo por decisão (`01-foundation.md:55`): a piscada em `globals.css:280–343` (`1600ms`, `22%`, `45%`, `3px`, `color-mix(in oklch, …)`). Aceito até a task 2.

## 2. A ponte do shadcn

Conforme à tabela §5.1, com uma escolha não registrada.

- `globals.css:134–160`: `--background`→`--surface-1`, `--foreground`→`--ink-1`, `--card`/`--secondary`→`--surface-2`, `--popover`→`--surface-3`, `--primary`→`--brand`, `--muted`→`--surface-0`, `--muted-foreground`→`--ink-3`, `--accent`→`--veil-hover`, `--destructive`→`--state-error`, `--input`→`--line-3`, `--ring`→`--focus`, `--sidebar*` como a tabela. Todos em `:root, [data-theme]`, sem valor próprio (provado por `globals.test.tsx:98–109`).
- `--status-*` (`globals.css:163–166`): `working`→`--state-work`, `attention`→`--state-wait`, `success`→`--state-close`, `paused`→`--state-paused`. São os quatro nomes que o código usa (31, 8, 3 e 2 usos); `--status-error`/`--status-closing` não existem no código, então não há alias a criar.
- Colisões: `--color-border: var(--line-2)` (`globals.css:33`) e `--border` fica o 1px; `--radius-*` fora do `@theme inline` (o `rounded-lg` computa 12 px, o do system vence o `@layer theme`, conferido no CSS de saída); `--font-mono` não declarado no `@theme`; `--shadow-xs` registrado por autorreferência (`globals.css:117`); `--sidebar-width` e `--duration-base` do system.
- **Não registrado:** §5.1 (`01-foundation.md:152`) pede ao tech spec a escolha do tom dos preenchimentos que leem `--status-attention` (`--state-wait-glyph` é o tom de glifo). A implementação deixou o alias de texto em todos, e o ponto de espera de `features/task/StatusDot.tsx:8` pinta em `--state-wait` (âmbar escuro de texto, 5.27:1 na lateral clara) em vez do tom de glifo. Transitório até a task 2, mas nem `design-system.md:40` nem outro lugar diz que foi escolhido.

## 3. Tema por `data-theme` e a cor atrás do webview

Conforme.

- `index.html:14`, `features/theme/useApplyTheme.ts:16`, variante `dark` em `globals.css:14`, `ThemeToggle.test.tsx:41, 51`.
- `internal/app/theme.go:136–141`: `(25,23,21)` e `(254,253,253)`. Medido: `--surface-1` escuro dá `(24.79, 22.71, 20.80)` e claro `(253.84, 253.21, 252.65)`, que arredondam exatamente para esses valores.
- Menor: a cor em Go é uma cópia literal de um token sem teste que a amarre a `tokens.css` (`theme.go:138, 140`; nenhum `backgroundFor` em `*_test.go`). Uma mudança de `--surface-1` deixa o primeiro frame piscando sem que nada falhe.

## 4. Fontes

Conforme, com um desvio justificado e registrado.

- `package.json:19–20`: `@fontsource/fira-code` e `@fontsource/fira-sans`; Inter e JetBrains Mono saíram. `styles/fonts.css:1–7`: Fira Sans 400, 400 itálico, 500, 600, 700; Fira Code 400 e 500.
- Hinting conferido com o fontTools: a Fira Sans do `@fontsource` tem `fpgm`, `prep` e `cvt` (hinting TrueType); a Fira Code não tem `fpgm` nem `cvt`. `docs/development/target-machine.md:16` registra isso, a comparação com a Fira Code hintada da release 6.2 e com a variável a 12 e 13 px, `font-synthesis: none`, `text-rendering: auto` e o mono sem ligaduras. O material (`01-foundation.md:103`) pedia a estática com hinting; a prova mostrou que com `hintslight` a diferença não existe, e o registro está no lugar certo.
- Computado: `body` em Fira Sans 14/20, `--ink-1` sobre `--surface-1`; bloco de código em Fira Code 13/20.

## 5. Os wrappers contra `components.md`

Nenhuma feature importa de `components/system/`, e o PR não adiciona nenhuma importação de `components/ui/` fora de `components/system/`. Os wrappers que importam o Base UI direto (Tooltip, Checkbox, Radio, SegmentedControl, ScrollArea, Listbox, o item do Select) estão todos em `components/system/` e na tabela de `docs/architecture/design-system.md:97–116`.

Conformes, sem ressalva material: StateGlyph (formas, tamanhos pares, `role="img"` ou `aria-hidden`), Spinner (arco em `currentColor` no botão, três quartos parado), Shimmer, Badge (`Suggested` em `--brand-tint`/`--brand-ring`), Kbd (`on-primary` com `--brand-key-ring`, `jump`), Placeholder, TimeChip (formas e tintas das três variantes), Button nas cinco variantes e três alturas com `.k`, desabilitado tracejado com a razão (computado: fundo transparente, borda `--line-3` tracejada, `--ink-4`, sem sombra) e carregando com `aria-busy`, IconButton, Radio, Checkbox (linha inteira, `aria-checked` na linha), NoticeStrip, SunkenLine, Skeleton, ContextMeter (`round(down…)` no preenchimento, nunca âmbar), Select (visto à esquerda, `◇ · unavailable`, mensagem no lugar dos itens), MenuCycleItem, Collapsible, ScrollArea.

Os problemas, por wrapper:

**Input e Textarea.** As classes do primitivo que o wrapper não neutraliza vencem a cascata. Confirmado nos estilos computados:
- Escuro: o fundo é `--line-3` a 30% (`ui/input.tsx:11`, `ui/textarea.tsx:9`, `dark:bg-input/30`), não `--surface-input`. Todo campo escuro fica cinza-claro, mais claro que o `Select` e a busca ao lado, que são próprios e pintam `--surface-input`. Sobre esse fundo a borda `--line-3` cai a 2.63:1 e o placeholder `--ink-4` a 4.61:1 (sobre `--surface-input` seriam 3.87 e 6.78).
- Desabilitado: fundo `--line-3` a 50% no claro e a 80% no escuro (`disabled:bg-input/50`, `dark:disabled:bg-input/80`). `components.md:25` pede sem fundo; `Input.tsx:14` (`disabled:dashed-disabled`) perde para eles.
- Erro: o trilho interno `--error-rail` não aparece em nenhum tema. O `box-shadow` computado é a pilha do anel do Tailwind com largura zero: `aria-invalid:ring-0` (`Input.tsx:14`) sai depois de `aria-invalid:field-error` no CSS e reescreve o `box-shadow` inteiro. No escuro a borda de erro é `--state-error` a 50% (`dark:aria-invalid:border-destructive/50`). `components.md:193` pede borda e trilho interno em `--state-error`.
- Carregando: `Input.tsx:28, 34` e `Textarea.tsx` só põem `aria-busy` e `--ink-3`; não há o spinner nem o gerúndio que o estado comum pede (`components.md:26`). Não há `disabledReason` (a razão só pode vir pela ajuda do `Field`).
- Os testes (`Input.test.tsx`, `Textarea.test.tsx`) passam porque verificam os nomes das classes com `css: false`; nenhum teste prova o que pinta.

**Diálogo.**
- Sem `initialFocus`, o foco cai no `×` do cabeçalho, o primeiro elemento focável (`Dialog.tsx:122`), e o tooltip `Close Esc` abre junto, por foco. Capturado nos dois temas. `components.md:752` pede o foco em **Cancel** num diálogo destrutivo ou de confirmação e no primeiro campo num de criação. O wrapper deixa isso inteiro ao chamador (`Dialog.tsx:66`) em vez de fazer do `alert` com Cancel o padrão.
- `Ctrl+N`, `Ctrl+J` e `Ctrl+,` inertes com um diálogo de criação aberto (`components.md:752`) não estão no wrapper. Os atalhos globais ainda não existem nesta forma; anotar para a task 2.
- `Dialog.tsx:28`, `w-[calc(100%-2rem)]`: `2rem` é `--space-8`, valor solto onde há token.
- Conforme: `8vh` do topo em pixel inteiro (computado `top` arredondado, `translate: round(-50%, 1px) 0`), `--surface-3`, `--shadow-overlay`, raio 16 px, `--size-dialog`/`-wide`, título 18/24, rodapé afundado com a razão, recusa em linha própria com `role="alert"`, `Ctrl+Enter`, `aria-modal`.

**Listbox.** `Listbox.tsx:14–22` não aceita `disabled`, `disabledReason`, `loading`, mensagem de carregando ou de erro, nem escolha indisponível. É o seletor de modelo e esforço e das dependências (`components.md:206, 210`, "Menu carregando e com erro"; "Marque uma escolha que o catálogo não tem mais como indisponível"). O `Select` tem esses estados; o Listbox, que é a escolha longa do mesmo componente, não. O critério de pronto (`01-foundation.md:14`) pede os estados comuns em cada wrapper.

**Chip.**
- `size="sm"` é igual ao `md`: `Chip.tsx:37` usa `--size-control-sm` (28 px), e `--size-chip` também é 28 px (computado: 28, 28, 22). `components.md:167` diz "`--size-chip` (28; `-sm` e `-xs` em linhas densas)", e `tokens.css:72` não tem `--size-chip-sm`. É lacuna da régua: a frente de design decide a altura do chip `sm` (ou tira a variante) antes de uma tela usá-la.
- Faltam o estado de erro (o espécime tem `.chip.is-error`, `specimen.html:422`; `components.md:27` o dá a todo interativo) e o "lendo o catálogo: a escolha salva com brilho" (`components.md:170`). `Chip.tsx:89–101` só conhece carregando e indisponível.

**Controle segmentado.** Desabilitado, só o trilho fica tracejado: os segmentos mantêm `--ink-2`/`--ink-1` e o escolhido mantém o `--brand-tint` (`SegmentedControl.tsx:52` põe `dashed-disabled` no grupo, e `SegmentedControl.tsx:60` fixa a tinta de cada segmento; computado `oklch(0.2 0.01 60)` sobre o tint). `components.md:25` pede `--ink-4` em todo desabilitado.

**Botão.** `loadingLabel` é opcional (`Button.tsx:19`) e o carregando troca o rótulo por ele (`Button.tsx:103–107`): um `<Button loading>` sem `loadingLabel` fica sem nome acessível (WCAG 4.1.2). O `IconButton` não sofre, porque mantém o `aria-label`.

**Link.** `href` não é obrigatório (`Link.tsx:7`), e o comentário diz que o chamador cuida do clique: um `<a>` sem `href` não recebe Tab nem papel de link. O `✕` do erro (`Link.tsx:48`) não é `aria-hidden` e é lido como "multiplicação".

**Menu.**
- `MenuGroupLabel` (`Menu.tsx:45`) é um `div` solto: o grupo não tem nome acessível (o Base UI tem `Menu.GroupLabel` para isso).
- O destrutivo em foco no escuro: `ui/dropdown-menu.tsx:88` traz `dark:data-[variant=destructive]:focus:bg-destructive/20`, pelo mesmo mecanismo que venceu no Input, sobre o `--state-error-veil` do wrapper (`Menu.tsx:85`). Não renderizado com o menu aberto; se vencer, `--state-error` sobre esse fundo dá 4.02:1, abaixo de 4.5.

**Tooltip e TimeChip.** O `TimeChip` embrulha um `span` não focável num Tooltip (`TimeChip.tsx:28`): o tempo por extenso não chega pelo teclado. `components.md:183` põe o tempo por extenso no tooltip; o texto oculto só diz `waiting for you 18m`. Menor. `Tooltip.tsx:31` (`sideOffset={6}`) e `Listbox.tsx:59` (`sideOffset={4}`) são literais comentados como `--space-1-5` e `--space-1`; `TOOLTIP_DELAY_MS` tem teste de paridade com `--delay-tooltip` (`Tooltip.test.tsx`), então esse não conta como solto.

**EmptyState.** `EmptyState.tsx:14` alinha à esquerda, como os mocks (`lab/12-screen-review/components.html:1260`); `components.md:388` diz "centrado na medida". A régua e os mocks divergem; a frente decide qual vale antes da primeira tela que o usa.

**Busca.** `SearchInput.tsx:44` usa `type="search"`, que no WebKit desenha o botão de cancelar nativo; o wrapper já tem o `×` próprio. Não verificado no WebKitGTK; conferir na task 2, que é a primeira a usar a busca.

**Ícones.** `icons.ts:14–23` tem os oito significados fixos, mas os wrappers importam o visto do Lucide direto (`Select.tsx:146`, `Checkbox.tsx:62`, `Listbox.tsx`) em vez de `ICONS.done`, e os glifos de tipo (task, One-Shot, review, discussão, épico, board), que `components.md:81` chama de ícones, não estão no mapa. O mapa só é a fonte se tudo passa por ele.

**Avatar.** Pedido em `01-foundation.md:45, 248` e `implementation.md:19, 45`, não existe, e está certo não existir: `components.md:122` diz "Uma palavra, sem avatar". Mas a ausência não está registrada em lugar nenhum. O material da task contradiz a régua; `implementation.md` precisa perder o Avatar.

**Scroll area.** O anel por dentro (`ScrollArea.tsx:22`) contraria o princípio 9 ("anel de 2 px por fora"), com a razão em `design-system.md:129`. É uma exceção razoável, mas é regra de design e mora só na documentação de arquitetura; `components.md` (Barra de rolagem, linha 87) precisa dizê-la. Só há barra vertical (`ScrollArea.tsx:28`); uma área que rola na horizontal não tem polegar do system.

## 6. Diálogo, ícones, body e código

- Diálogo a `8vh` com `--scrim` sem desfoque: conforme (`globals.css:366–378`, computado).
- Traço global dos ícones: `globals.css:439–441`, computado `stroke-width: 1.5px`.
- Body no registro de interface: `globals.css:249–255`, 14/20, `--ink-1`. O Markdown no registro de leitura 15/22, `--ink-1`, `max-width` 960 px (`Markdown.tsx:44`), conforme §4 do material.
- Tema do código: `features/chat/code-theme.ts` com `var(--code-*)` nos dois temas; o shiki aceita e pinta (computado: o comentário em `--code-comment`). O cromo do bloco segue o espécime (`globals.css:384–436`).
- Divergências do espécime no bloco de código (a régua escrita não cobre, então vale o espécime): a palavra-chave em 600 e o comentário em itálico (`specimen.html:647, 651`) não estão em `code-theme.ts:63–87`, que não dá `fontStyle`; e a Fira Code carregada é só 400/500 (`fonts.css:6–7`), então o 600 do espécime não teria face e, com `font-synthesis: none`, cairia no 500. O Streamdown numera as linhas, o que nem a anatomia (`components.md:576`) nem o espécime têm.
- `globals.css:266–271`: os títulos do Markdown levam `tracking-tight` e a tabela `text-sm`, valores do Tailwind onde há tokens (`--text-ui`/`--leading-ui`); os tamanhos dos `h1`–`h3` vêm do Streamdown, fora da escala de `tokens.css:37–45`. Menor, e é da task 4 ajustar a conversa, mas o Markdown também renderiza documentos hoje.

## 7. Os testes

- `globals.test.tsx` prova o import, a ponte sem valor próprio (`98–120`), o pixel inteiro dos tamanhos (`122–132`), as larguras arredondadas com a exceção declarada dos painéis (`134–144`), os glifos pares (`146–153`), nenhuma cor literal (`155–171`), o traço dos ícones, o diálogo e o scrim. Conforme ao critério.
- Um teste por wrapper, todos presentes. Mas eles verificam **classes**, não o que pinta: com `css: false` (`vitest.config.ts`), um teste como o de `Input.test.tsx` confirma `aria-invalid:field-error` na lista e não vê que a regra perde para `aria-invalid:ring-0` e para as variantes `dark:` do primitivo. É exatamente o buraco por onde passaram os defeitos do Input e do Textarea. O critério "teste dos estados comuns" está cumprido na letra e não prova o estado.
- Sem teste de estado desabilitado com razão: Input, Textarea, Listbox, SearchInput. Sem teste de carregando: Listbox, Select, Menu.

## 8. Documentação

- `docs/architecture/design-system.md` criado e indexado em `docs/README.md:14`; `frontend.md`, `overview.md`, `stack.md`, `guidelines/README.md:22` e `target-machine.md` no presente, sem histórico. Conforme na forma.
- `design-system.md:125`: "Todo controle interativo aceita `disabled` e `disabledReason`" é falso para Input, Textarea, SearchInput, Listbox e Link. `design-system.md:127` ("`loading` com `loadingLabel`… o controle mostra o `Spinner`") é falso para Input e Textarea. A documentação contradiz o código.
- `design-system.md:62` diz que o espaço usa só os degraus do system; confere nos wrappers. `design-system.md:54` diz "sem nenhum valor solto"; os literais de `Dialog.tsx:28`, `Tooltip.tsx:31` e `Listbox.tsx:59` o contradizem.
- `design-system.md:40` não diz a escolha do tom dos preenchimentos de `--status-attention` (seção 2).
- `frontend.md:22` diz onde mora um componente do system, mas não diz o que uma feature nova importa hoje. `implementation.md:19` pede que diga que as features importam de `components/system/`; enquanto a regra não é verificada (task 12), a frase certa é que código novo importa de `components/system/`, e que os usos de `components/ui/` nas features são os antigos.

## 9. Captura

O app inteiro não roda fora do Wails, então as telas antigas retematizadas não foram comparadas a 1250 e 2560 px; isso fica para uma captura na máquina alvo com `task build`. Os componentes, sim: na bancada, a 1250 e a 2560 px, claro e escuro, eles batem com o espécime em forma, tinta e medida (botões, `.k`, chips, glifos, chips de tempo, etiquetas, teclas, links, faixa, linha afundada, esqueleto, bloco de código), menos os campos (seção 5, Input e Textarea) e os itens das seções 5 e 6. Nada muda com a largura, como esperado de componentes base.

## Contraste medido

Todos os pares de texto usados pelos wrappers passam 4.5:1 nos dois temas; o mais apertado é **New** pressionado (`--brand-ink` sobre `--brand-tint-press`, 4.53 no claro). Os pares de interface passam 3:1: borda de campo 3.45/3.69 sobre o chão e 3.50/3.05 no diálogo, foco 4.81–7.73 em toda superfície, anel do escolhido 3.90–4.77, preenchimento do medidor sobre o trilho 4.20/5.47, glifo de espera 3.72 na lateral clara. Abaixo de 3:1, todos por decisão da régua e não da implementação: o polegar da barra de rolagem (`--line-2`, 1.51/1.58), a borda de um botão secundário (a mesma, mas o texto identifica o botão) e o glifo "não iniciado" (`--line-deco` na lateral clara, 2.98). Os dois pares que falham são os que a cascata deixou vazar do primitivo: a borda do campo escuro sobre o fundo errado (2.63) e, se vencer, o destrutivo em foco no escuro (4.02).

| Par | Claro | Escuro |
|---|---|---|
| `--ink-3` sobre `--surface-0` / `-3` / lateral | 6.53 / 7.29 / 6.20 | 8.52 / 6.66 / 8.66 |
| `--ink-4` sobre `--surface-input` (placeholder) | 6.14 | 6.78 |
| `--brand-on` sobre `--brand` | 5.66 | 7.79 |
| `--state-error-on` sobre `--state-error` | 6.11 | 7.33 |
| `--state-error` sobre `--state-error-veil` | 5.42 | 5.77 |
| `--brand-ink` sobre `--brand-tint` | 5.43 | 6.17 |
| `--brand-ink` sobre `--brand-tint-press` (**New**) | 4.53 | 4.86 |
| `--state-wait-chip-ink` sobre `--state-wait-chip` | 7.39 | 9.12 |
| `--state-close` na lateral | 4.82 | 10.16 |
| `--tooltip-ink-2` sobre `--tooltip-surface` | 8.32 | 6.73 |
| `--code-*` sobre `--surface-0` (o menor) | 5.49 | 6.83 |
| `--line-3` sobre `--surface-3` (campo no diálogo) | 3.50 | 3.05 |
| `--line-3` sobre o fundo real do campo escuro | n/a | **2.63** |

## Divergências, em ordem de gravidade

1. **Input e Textarea pintam fora do system nos dois temas.** `components/system/Input.tsx:14` e `Textarea.tsx:29` não neutralizam `dark:bg-input/30`, `disabled:bg-input/50`, `dark:disabled:bg-input/80` e `dark:aria-invalid:border-destructive/50` de `ui/input.tsx:11` e `ui/textarea.tsx:9`, e `aria-invalid:ring-0` apaga o trilho de `field-error`. Precisa: fundo `--surface-input` também sob `dark:`, fundo transparente no desabilitado também sob `dark:`, borda `--state-error` cheia sob `dark:aria-invalid:`, e o trilho de erro aplicado depois do anel (ou o anel neutralizado sem reescrever o `box-shadow`).
2. **Os testes dos wrappers não provam o que pinta.** `components/system/*.test.tsx` só comparam listas de classes com `css: false`, e por isso o item 1 passou verde. Precisa: um caminho de verificação que veja a cascata (por exemplo, afirmar que as classes do primitivo que conflitam com o system foram neutralizadas, ou um teste de estilo computado sobre o CSS construído) para os wrappers que embrulham `ui/`.
3. **O diálogo abre com o foco no `×` e o tooltip aberto.** `components/system/Dialog.tsx:66, 122`. Precisa: foco padrão em **Cancel** num `alert` e no primeiro campo nos outros, sem depender do chamador, e o `×` fora do primeiro foco.
4. **Listbox sem os estados comuns.** `components/system/Listbox.tsx:14–22`. Precisa: desabilitado com a razão, mensagem de carregando e de erro no lugar dos itens, e escolha indisponível, como o `Select`.
5. **A documentação promete o que o código não faz.** `docs/architecture/design-system.md:125, 127` (desabilitado com razão e carregando em todo controle) e `:54` (nenhum valor solto). Precisa: o código alcançar a frase (itens 1 e 4, `disabledReason` e carregando nos campos) ou a frase descrever o que existe.
6. **Botão carregando sem nome.** `components/system/Button.tsx:19, 103–107`. Precisa: `loadingLabel` obrigatório quando `loading`, ou o rótulo mantido como nome acessível.
7. **Chip sem erro nem brilho, e `sm` igual a `md`.** `components/system/Chip.tsx:37, 89–101`; `tokens.css:72`. Precisa: os estados de erro e de leitura do catálogo; e a frente de design decidir em `components.md:167` a altura do chip `sm`.
8. **Controle segmentado desabilitado com tinta normal.** `components/system/SegmentedControl.tsx:52, 60`. Precisa: `--ink-4` nos segmentos e no escolhido quando o grupo está desabilitado.
9. **Link e Menu com falhas de nome.** `components/system/Link.tsx:7` (`href` opcional deixa um `<a>` inalcançável), `Link.tsx:48` (`✕` lido), `Menu.tsx:45` (grupo sem nome), `ui/dropdown-menu.tsx:88` contra `Menu.tsx:85` (provável destrutivo a 4.02:1 no escuro). Precisa: `href` obrigatório ou um botão, `aria-hidden` no `✕`, `Menu.GroupLabel`, e neutralizar a variante `dark:` do destrutivo.
10. **Bloco de código sem o peso e o itálico do espécime, com números de linha.** `features/chat/code-theme.ts:63–87`, `styles/fonts.css:6–7`, `Markdown.tsx:51`. Precisa: decidir em `components.md` §Bloco de código se a palavra-chave é 600 e o comentário itálico (e então carregar a Fira Code 600) e se há números de linha.
11. **Decisões sem registro.** O tom dos preenchimentos de `--status-attention` (`globals.css:164`, `StatusDot.tsx:8`); o Avatar pedido em `implementation.md:19, 45` e `01-foundation.md:45` e negado por `components.md:122`; o anel por dentro da scroll area só em `design-system.md:129`; o `EmptyState` à esquerda (`EmptyState.tsx:14`) contra "centrado" em `components.md:388`. Precisa: cada um numa linha de `design/` (`decisions.md` ou a seção do componente) e em `design-system.md`.
12. **Menores.** `Dialog.tsx:28` (`2rem`); `TimeChip.tsx:28` (tempo por extenso fora do teclado); o visto importado direto em `Select.tsx:146` e `Checkbox.tsx:62`, e os glifos de tipo fora de `icons.ts`; `SearchInput.tsx:44` (cancelar nativo do WebKit a verificar); `theme.go:138, 140` sem teste de paridade com `--surface-1`; `globals.test.tsx:155–171` sem guarda contra a paleta do Tailwind; `frontend.md:22` sem dizer o que o código novo importa.

## Veredito

**Corrigir antes da task 2.** A fundação está certa no que é estrutural: fonte única, ponte, tema, fontes, regras do WebKitGTK e a maioria dos wrappers conferem com a régua, e o contraste medido passa. Mas o campo de texto, que a task 2 é a primeira a usar (o filtro e a barra do pedido compõem campos), pinta errado nos dois temas e perde o trilho de erro, e os testes que deveriam segurar isso verificam nomes de classe e não a cascata, então o mesmo defeito pode estar em outro wrapper sem aparecer. Some o foco padrão do diálogo e o Listbox sem estados, e a documentação de arquitetura já descreve um comportamento que não existe. Os itens 1 a 6 são pequenos e devem entrar num step de correção antes do primeiro step da task 2; os itens 7, 10 e 11 pedem primeiro uma linha da frente de design em `design/`.
