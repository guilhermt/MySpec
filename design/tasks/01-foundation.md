# Task 1 · Fundação I: tokens, fontes, tema e componentes base

Material de entrada da primeira task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 1 de `design/implementation.md` (§2, linhas 42–52), com os princípios da §1 (linhas 9–21) e os riscos da §3 (linhas 184–195). Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa.

## 1. Objetivo e critério de pronto

O app inteiro passa a pintar com `design/system/tokens.css`, em Fira Sans e Fira Code, com o tema aplicado por `data-theme` no `documentElement`. Os primitivos do shadcn herdam o tema por uma ponte de variáveis, sem edição, e as telas atuais continuam iguais em estrutura, só retematizadas. Os componentes base do system (Fundamentos e Controles de `components.md`) passam a existir como wrappers em `src/components/system/`, testados, prontos para as tasks de tela, que são quem os adota.

**Pronto quando** (`implementation.md:52`):

- um `@import` só traz os tokens, e `styles/globals.test.tsx` prova a paridade com `design/system/tokens.css` e as regras de pixel inteiro;
- não há `oklch(` nem cor de estado fora de `tokens.css`;
- Fira nos dois registros, verificada na máquina alvo com capturas claro e escuro (o primeiro step);
- cada wrapper tem teste dos estados comuns: hover, foco, desabilitado tracejado com `aria-describedby`, carregando com `aria-busy`;
- `task check` verde;
- `docs/architecture/design-system.md` criado e indexado em `docs/README.md`, e `frontend.md` e `overview.md` atualizados.

`changes.md` e `backend.md`: nenhuma linha. A task é só forma.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (linhas 9–21), task 1 (42–52), riscos (184–195), §4 (212) | O escopo, o pronto, as três camadas de convivência com o shadcn (linha 19), a decisão dos tokens e as três colisões (linha 20), a prova das fontes e o meio pixel (188–189) |
| 2 | `design/decisions.md`, entradas de 2026-09-25 (linhas 5–7), de 2026-09-24 sobre a fundação visual (33–35), os papéis da cor (37–39) e o tema (49–51) | O que está confirmado pelo usuário: substituir os tokens, a ponte, `data-theme`. O azul nunca pinta estado |
| 3 | `design/principles.md` inteiro | A régua. Para esta task pesam o 1 (cor é sinal), o 2 (papéis do azul), o 5 (glifo, cor e rótulo), o 8 (três durações, dois laços), o 9 (foco por fora, seleção por dentro) e o 10 (pixel inteiro) |
| 4 | `design/system/tokens.css` inteiro | A fonte. Cabeçalho (1–28): rem sobre 16 px, pixel inteiro, e na implementação só o bloco `[data-theme="dark"]` age (26–27). Os nomes que colidem: `--border` (65), `--radius-*` (62), `--sidebar-width` (89) |
| 5 | `design/system/components.md`: estados comuns (17–26), Primitivos (28–49), Fundamentos (51–141), Controles (143–281, sem o Menu do item 210–219, os popovers 255–273 e o seletor do step 275–281, que são da task 3), Estado vazio, Esqueleto, Faixa de aviso e Linha afundada (381–417), Bloco de código e Medidor de contexto (543–562), Diálogo (712–725) | A anatomia, as variantes, os estados, os tokens, o teclado e a acessibilidade de cada wrapper |
| 6 | `design/lab/08-visual-final/specimen.html` e os `components.html` das rodadas 10 a 14, só nos componentes base, servidos com `python3 -m http.server 8090 -d design/lab` | A referência visual nos dois modos. Onde o espécime e `components.md` divergem, vale `components.md` (linha 5). O controle segmentado segue a regra (`--brand-tint`), não o mock (246) |
| 7 | `docs/guidelines/README.md`, `frontend.md`, `testing.md` | Como um step acontece, as convenções de componente e estilo, os limiares (80/80/70 no frontend) e o teste por `getByRole` |
| 8 | `docs/architecture/overview.md` §Frontend (137–159), `stack.md` (12, 40), `docs/development/target-machine.md` §Renderização (7–16) | O que a documentação diz hoje e vai reescrever |
| 9 | O código da §5 deste documento | O inventário do que muda |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Fontes.** `styles/fonts.css` importa `@fontsource/fira-sans` 400, 500, 600 e 700, mais o 400 itálico (o mock carrega `ital 1,400`, `specimen.html:10`, e a ênfase do Markdown precisa dele), e Fira Code. `@fontsource-variable/inter` e `@fontsource-variable/jetbrains-mono` saem do `package.json` (19–20).
2. **Tokens.** `design/system/tokens.css` é a única fonte dos valores. A paleta antiga de `globals.css` (55–122) e os valores de `styles/tokens.css` saem.
3. **Ponte do shadcn** em `globals.css`: as variáveis que os primitivos leem apontam para os tokens do system (tabela da §5.1).
4. **Ponte do Tailwind** (`@theme inline`): os namespaces `--color-*`, `--font-*`, `--radius-*`, `--shadow-*` e `--ease-*` resolvem para os tokens.
5. **Tema** por `data-theme`: o script de `index.html` (7–17), `features/theme/useApplyTheme.ts` (16), a variante `dark` do Tailwind (`globals.css:10`) e os testes de `ThemeToggle.test.tsx` (41, 51).
6. **Streamdown** (`features/chat/Markdown.tsx`): o registro de leitura (16/26 px em `--measure-read`, `--ink-1`) e o bloco de código com os quatro matizes `--code-*` no lugar de `github-light`/`github-dark` (19).
7. **Regras do WebKitGTK** sem camada em `globals.css`, com teste: a centralização em pixel inteiro e os tokens em pixel inteiro.
8. **`src/components/system/`** com os wrappers, um arquivo e um teste por componente: glifo de estado; spinner e brilho; ícones (um por significado); tooltip; etiqueta, tag, placeholder e tecla; avatar; link; botão (primário, secundário, fantasma, perigoso, **New**, ícone; a tecla `.k`; desabilitado tracejado com a razão; carregando); chip; chip de tempo; input, textarea e busca; select, menu e listbox; caixa de seleção; rádio; controle segmentado; collapsible; scroll area com a barra de rolagem; esqueleto; estado vazio de página; faixa de aviso; linha afundada; diálogo (mínimo, largo, em passos, destrutivo); bloco de código; medidor de contexto.
9. **Documentação** da §7.

**Fora:**

- qualquer tela, a árvore, a navegação, o cabeçalho do lugar, os painéis, a barra do pedido (task 2);
- os componentes do item aberto e das listas (tasks 3 a 6);
- o menu `⋯`, os popovers Review mode e Models, o seletor do step (task 3);
- o seletor de tema em ciclo: `ThemeToggle` continua sendo o `toggle-group` de três botões (`ThemeToggle.tsx:2`) até a task 2;
- trocar as importações das features para `components/system/`: as telas antigas continuam nos primitivos, pintados pela ponte, até a task delas. A regra "features importam só de `components/system/`" é fechada por verificação na task 12;
- a piscada `attention-flash` (`globals.css:154–205`): continua, pintada pelos aliases, até a task 2;
- os tons do mermaid (`Markdown.tsx:36`): o mermaid calcula cor a partir de valores concretos e não lê variável CSS, então fica com os temas `neutral`/`dark` dele; só a fonte passa a `--font-ui`;
- remover `react-resizable-panels` e `resizable.tsx` (task 12).

## 4. Decisões técnicas

### Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| **Substituir** os tokens de `globals.css` e `styles/tokens.css` pelos de `design/system/tokens.css`, de uma fonte só. Descartado: manter duas paletas e mapear | `decisions.md:7`; `implementation.md:20, 212` |
| **Ponte do shadcn** em `globals.css`: `--primary`, `--background`, `--card`, `--popover`, `--muted`, `--ring`, `--destructive`, `--sidebar*`… apontam para `--brand`, `--surface-*`, `--focus`, `--state-error`, `--surface-sidebar`… `components/ui` nunca é editado | `implementation.md:19` (1) |
| **`src/components/system/`** é a pasta dos wrappers, um por componente de `components.md`, ao lado de `ui/`. As features importam de lá, nunca de `components/ui/` (fechado na task 12) | `implementation.md:19` (2) |
| Um primitivo cujo estado não se sobrescreve por classe é substituído por um **componente próprio** no wrapper | `implementation.md:19` (3); `components.md:30` |
| **Tema por `data-theme`** no `documentElement`, no lugar da classe `.dark`. O bloco `@media (prefers-color-scheme)` do arquivo fica inerte, porque o app sempre grava `data-theme` | `implementation.md:20`; `tokens.css:25–27` |
| **Fira estática com hinting**: `@fontsource/fira-sans` 400/500/600/700 (o itálico 400 é detalhe da §3). No Linux quem age é o fontconfig e o hinting da fonte, não `-webkit-font-smoothing`. Testar `font-synthesis: none` e `text-rendering` | `implementation.md:45, 188` |
| `globals.css` fica com o Tailwind, os `@source`, a variante `dark` sobre `[data-theme="dark"]`, a ponte do shadcn, a ponte `@theme inline` e as regras sem camada do WebKitGTK | `implementation.md:20` |
| Os testes de cada wrapper nascem no mesmo step que ele. A cobertura nunca cai entre steps | `implementation.md:21` |

### O tech spec toma

**Import direto ou cópia sincronizada.** A recomendação é `@import "../../../design/system/tokens.css"`. A alternativa, se o dev server ou o build recusarem, é uma cópia gerada por `task generate` e um teste que falha quando as duas divergem (`implementation.md:20`). Fatos que pesam na escolha:

- `task check` não roda `vite build`, e o Vitest roda com `css: false` (`vitest.config.ts:10`). Um `@import` quebrado só aparece em `task build`, que o CI roda no job Build (`.github/workflows/ci.yml`, `task build`). Por isso o teste de paridade lê os arquivos como texto, como `globals.test.tsx:33` já faz.
- `build:frontend` só observa `frontend/**/*` (`build/Taskfile.yml:37–39`). Com o import direto, uma mudança só em `design/system/tokens.css` não reconstrói o frontend: o arquivo entra em `sources`.
- `server.fs.allow` (`vite.config.ts:16–20`) só restringe o que o dev server serve por HTTP. O `@import` é resolvido pelo compilador do Tailwind, que lê o disco. O step verifica com `task dev` e com `task build`.
- As regras globais que moram hoje em `styles/tokens.css` (html 30–36, body 38–41, `::selection` 43–45, movimento reduzido 47–54) vão para `globals.css`. `-webkit-font-smoothing` (35) e `font-feature-settings: "cv11", "ss01"` (34), que é do Inter, saem.

**Quais primitivos viram componente próprio.** A tabela da §5.2 lista os candidatos com o que não se sobrescreve por classe. O tech spec registra a escolha por componente, e `design-system.md` a publica.

**As três colisões de nome** (`implementation.md:20`), e as que o levantamento achou a mais:

| Nome | Conflito | Encaminhamento recomendado |
|---|---|---|
| `--border` | Cor no shadcn (`globals.css:30, 71, 106`, e `* { @apply border-border }` em 126); largura (1px) no system (`tokens.css:65`) | A ponte mapeia `--color-border` direto para `--line-2`, e `--border` fica sendo o 1px do system |
| `--radius-*` | A escala do shadcn (`globals.css:46–52`, múltiplos de `--radius: 0.625rem`), a padrão do Tailwind e a do system (`tokens.css:62`) têm os mesmos nomes `xs`…`xl` | Tirar `--radius-*` do `@theme inline`: a declaração sem camada do system vence a do tema do Tailwind, que fica em `@layer theme`, e `rounded-lg` passa a valer 12 px (hoje 10). `2xl`, `3xl` e `4xl` não têm par no system: são usados em `rounded-2xl` (2 vezes nas features) e `rounded-4xl` (1 vez em `ui/`) |
| `--sidebar-width` | 21.5rem fixo (`styles/tokens.css:12`), lido em `app/AppShell.tsx:75`; `clamp` arredondado no system (`tokens.css:89`) | A antiga sai. A lateral atual passa a 288–380 px conforme a janela, o que é aceitável como retematização |
| `--font-mono` | O mesmo nome no Tailwind, no arquivo antigo (JetBrains Mono, `styles/tokens.css:8`) e no system (Fira Code) | Nada a mapear. `@theme inline { --font-mono: var(--font-mono) }` seria autorreferência: não declarar |
| `--shadow-xs` | É utilitário padrão do Tailwind e também token do system, com o fio `--rim` (`tokens.css:217`) | Vence o do system. Nenhum primitivo usa `shadow-xs` hoje; o wrapper que o usar recebe o do system |
| `--duration-base` | 150 ms hoje (`styles/tokens.css:15`), 180 ms no system (`tokens.css:116`) | Vale o system. Quatro usos nas features mudam de ritmo sozinhos |

**Outras decisões do tech spec**, cada uma com o fato que a pede:

- **`--status-*`.** `implementation.md:20` diz que a paleta antiga sai na task 1, com `--status-*` incluído; `implementation.md:177` lista `--status-*` entre o que a task 12 remove. Hoje são 43 usos em 24 arquivos de produção (§5.3), e 8 testes consultam essas classes. Recomendado: na task 1, `--status-*` viram aliases sem valor próprio, na ponte, para `--state-*`. Assim nenhum `oklch(` fica fora de `tokens.css`, nenhuma tela muda, e a task 12 apaga os aliases.
- **Diálogo.** O system põe todo diálogo a `8vh` do topo, crescendo para baixo (`components.md:716`). A regra sem camada `globals.css:213–218` fixa `top: round(50%, 1px)` e `translate: … round(-50%, 1px)` por `data-slot`, e vence qualquer classe do wrapper. Duas saídas: reescrever a regra para todos os diálogos, os antigos inclusive, ou escopá-la ao wrapper do system. `globals.test.tsx:10–17` fixa o texto da regra e muda junto. O véu dos primitivos é `bg-black/10` com `backdrop-blur-xs` (`ui/dialog.tsx:34`, `ui/alert-dialog.tsx:31`); o system pede `--scrim`, sem desfoque.
- **Tons de `--muted-foreground` e `--accent`.** Juntos pintam 250 textos (`text-muted-foreground`) e 29 fundos (`bg-accent`) nas telas antigas. A recomendação é `--ink-3` e `--veil-hover`; a alternativa para o texto é `--ink-2`.
- **Texto padrão do `body`.** A raiz fica em 16 px, porque é a base do rem. Hoje o `html` tem 1rem sobre 1.45 (`styles/tokens.css:31–33`). O system não diz qual registro é o padrão do `body`.
- **Tema do código.** O `shikiTheme` do Streamdown aceita um objeto de tema, não só um nome (`ThemeInput = BundledTheme | ThemeRegistrationAny`, em `node_modules/@streamdown/code/dist/index.d.ts:3`). Um tema claro e um escuro com as cores `var(--code-*)` tiram o hexadecimal do shiki. O Streamdown troca o par pela variante `dark:` (`dark:text-[var(--shiki-dark…)]`), que passa a seguir `data-theme`. O cromo do bloco é estilizado pelos atributos `data-streamdown="code-block"`, `"code-block-header"`, `"code-block-copy-button"` e `"inline-code"`.
- **Fira Code estática ou variável.** `implementation.md:45` escolhe `@fontsource-variable/fira-code`, e o risco da linha 188 prefere as estáticas com hinting. A prova do step 1 compara as duas no mono de 12 e 13 px.
- **Traço dos ícones.** O Lucide desenha com traço 2, e o system pede `--icon-stroke: 1.5` (`tokens.css:76`). A escolha é entre uma regra global para o `svg.lucide`, que muda todas as telas de uma vez, e o traço só no wrapper de ícone.
- **`biome.json:48`.** `noLabelWithoutControl` conhece `Checkbox` e `RadioGroupItem`. Os nomes dos wrappers de caixa e rádio entram ali.

## 5. Inventário atual

### 5.1 Tokens: antigo para novo

As variáveis do shadcn (`globals.css:55–122`) ficam como ponte e perdem o valor próprio. As de `styles/tokens.css` somem, salvo quando o system tem o mesmo nome.

| Token antigo | Onde | Passa a | Nota |
|---|---|---|---|
| `--background` | `globals.css:56, 91` | `var(--surface-1)` | O chão |
| `--foreground` | 57, 92 | `var(--ink-1)` | |
| `--card`, `--card-foreground` | 58–59 | `--surface-2`, `--ink-1` | Elevado |
| `--popover`, `--popover-foreground` | 60–61 | `--surface-3`, `--ink-1` | Flutua |
| `--primary` | 62, 97 | `--brand` | O índigo 277 dá lugar ao azul 260 |
| `--primary-foreground` | 63 | `--brand-on` | |
| `--secondary`, `--secondary-foreground` | 64–65 | `--surface-2`, `--ink-1` | `ui/button.tsx:14` mistura `--secondary` com `--foreground` no hover |
| `--muted` | 66 | `--surface-0` | Afundado. Esqueleto, `bg-muted` |
| `--muted-foreground` | 67 | `--ink-3` (ou `--ink-2`, §4) | 250 usos nas features |
| `--accent`, `--accent-foreground` | 68–69 | `--veil-hover`, `--ink-1` | Realce de item e hover fantasma |
| `--destructive` | 70, 105 | `--state-error` | |
| `--border` | 71, 106 | `--color-border: var(--line-2)` | Colisão (§4) |
| `--input` | 72, 107 | `--line-3` | Borda de controle a 3:1 |
| `--ring` | 73, 108 | `--focus` | E `outline-ring/50` em 126 |
| `--chart-1`…`--chart-5` | 74–78, 109–113 | apagados | Nenhum uso |
| `--radius` | 79 | apagado | A escala vem do system |
| `--sidebar` | 80, 114 | `--surface-sidebar` | |
| `--sidebar-foreground` | 81 | `--ink-1` | |
| `--sidebar-primary`, `-primary-foreground` | 82–83 | `--brand`, `--brand-on` | |
| `--sidebar-accent`, `-accent-foreground` | 84–85 | `--veil-hover`, `--ink-1` | |
| `--sidebar-border` | 86 | `--sidebar-line` | |
| `--sidebar-ring` | 87 | `--focus` | |
| `--font-sans`, `--font-heading` (`@theme`) | `globals.css:13–14`; `styles/tokens.css:7` | `--font-ui` | `Markdown.tsx:36` lê `--font-sans` |
| `--font-mono` | `styles/tokens.css:8` | `--font-mono` do system | Mesmo nome |
| `--radius-sm`…`--radius-4xl` (`@theme`) | `globals.css:46–52` | `--radius-xs`…`--radius-pill` do system | sm 6 e md 8 px iguais; lg de 10 para 12; xl de 14 para 16 |
| `--text-base` | `styles/tokens.css:11` | apagado | A raiz de 16 px continua |
| `--leading-base` (1.45) | 13 | o par do registro escolhido para o `body` | §4 |
| `--sidebar-width` | 12 | o do system (`clamp`) | Colisão |
| `--duration-fast` | 14 | igual (120 ms) | |
| `--duration-base` | 15 | 180 ms | |
| `--ease-standard` | 16 | igual | |
| `--status-working` | 19 | alias de `--state-work` | Tinta neutra, não mais o azul |
| `--status-attention` | 20, 26 | alias de `--state-wait` (texto) | 30 usos. Nos preenchimentos (`bg-[var(--status-attention)]`, 3 usos) o tom certo é `--state-wait-glyph`, e o tech spec escolhe |
| `--status-success` | 21, 27 | alias de `--state-close` | |
| `--status-paused` | 22 | alias de `--state-paused` | |
| `::selection` (`--primary` a 30%) | 43–45 | `--brand` misturado | |
| classe `.dark` | `globals.css:90`; `styles/tokens.css:25`; `index.html:14`; `useApplyTheme.ts:16` | `[data-theme="dark"]` | |
| Cor atrás do webview | `internal/app/theme.go:134–141`, `NewRGB(10,10,10)` e `(255,255,255)`, "matching the shadcn neutral --background" | `--surface-1` em sRGB: cerca de `(25,23,21)` no escuro e `(254,253,253)` no claro | Uma linha de Go numa task de "backend: nenhum". Sem teste hoje; `internal/app` está fora da cobertura |

### 5.2 Primitivos de `components/ui` e o componente do system que os cobre

Os arquivos de produção que importam cada primitivo, contados por `grep` em `src/` fora de `ui/` e dos testes:

| Primitivo | Usos (features) | Componente do system | Candidato a próprio? (o que não se sobrescreve por classe) |
|---|---|---|---|
| `button` | 70 (task 13, reviews 13, board 7, discussion 7, chat 6…) | Botão, botão de ícone, **New** | Não. Foco (`ring-3` sem folga), desabilitado (`opacity-50`) e `active:translate-y-px` se sobrescrevem por classe. Alturas: 32 e 28 batem, `xs` é 24 e o system pede 22 |
| `badge` | 22 (task 6, reviews 4, discussion 3, history 3…) | Etiqueta, tag, placeholder | Sim. Não está na tabela de `components.md:32–49`; é um `span` |
| `tooltip` | 19 (task 8, reviews 4, sidebar 2…) | Tooltip | Não. A superfície invertida (`bg-foreground`), `max-w-xs` e o `zoom-in-95` se sobrescrevem; o `TooltipProvider` tem `delay = 0` (`ui/tooltip.tsx:7`) e recebe `--delay-tooltip` |
| `skeleton` | 12 | Esqueleto | Provável. O system pede o brilho, não o `animate-pulse` |
| `textarea` | 12 | Textarea | Não |
| `input` | 10 | Input, busca | Não. O halo de foco vira `--focus-halo`, e o hover leva a borda a `--ink-3` |
| `alert-dialog` | 10 (task 3, settings 2, discussion 2…) | Diálogo mínimo e destrutivo | Não, mas a posição a `8vh` depende da regra sem camada (§4) |
| `dropdown-menu` | 10 (task 2, `components/FilterMenu`, sidebar, models, review-mode…) | Select, menu e listbox | Parcial. O item de três estados e o `listbox` com busca pedem composição própria |
| `dialog` | 8 (reviews 3…) | Diálogo largo e em passos | Como `alert-dialog` |
| `toggle-group` | 8 (discussion 2, reviews 2, `theme`…) | Controle segmentado (e abas e grupo de painéis, tasks 2 e 3) | Sim. O system pede `radiogroup` com `radio` e `aria-checked` (`components.md:251`), e o Base UI entrega botões com `aria-pressed` |
| `collapsible` | 7 | Collapsible | Não |
| `label` | 7 | Rótulo do campo | Não |
| `checkbox` | 6 | Caixa de seleção | Provável. O alvo é a linha inteira, com `aria-checked` na linha (`components.md:225, 228`) |
| `kbd` | 4 | Tecla | Não |
| `resizable` | 4 (task, board, reviews, discussion) | nenhum | Sai com os painéis da task 2 e o pacote na 12 |
| `scroll-area` | 3 (sidebar 2, attention 1) | Scroll area e barra de rolagem | Não. Polegar em `--line-2` sem trilho |
| `popover` | 2 (task) | Base do `listbox` longo (e dos popovers da task 3) | Não |
| `radio-group` | 2 (boards, reviews) | Rádio | Não |
| `toggle` | 2 (board, reviews) | Chip que alterna | Não |
| `separator` | 0 | Separador | Sem uso hoje |

Sem primitivo, próprios: glifo de estado, spinner e brilho, ícone, avatar, link, chip de tempo, estado vazio, faixa de aviso, linha afundada, bloco de código (o do Streamdown, tematizado), medidor de contexto. O `features/task/ContextGauge.tsx` atual fica até a task 3, e fica âmbar ao encher (`ContextGauge.tsx:13`), o que `components.md:561` proíbe no novo.

Em `src/components/` ficam também `FilterMenu.tsx` e `useEditedText.ts`, que não mudam nesta task.

### 5.3 Cor solta e variáveis fora de `styles/`

`grep` por `oklch(`, `rgb(`, `hsl(` e `#rrggbb` em `src/` fora de `styles/`: **nenhum** em `features/`, `app/` e `components/`. O que existe:

| Lugar | O quê | Tratamento |
|---|---|---|
| `ui/dialog.tsx:34`, `ui/alert-dialog.tsx:31` | `bg-black/10` e `backdrop-blur-xs` no véu | O wrapper aplica `--scrim` |
| `ui/button.tsx:14` | `color-mix(in_oklch, var(--secondary), var(--foreground) 5%)` | Espaço de cor, não valor. Some quando o wrapper fixa `--surface-2-hover` |
| `features/chat/Markdown.tsx:19` | Temas `github-light`/`github-dark` do shiki, com hexadecimais dentro da biblioteca | Tema próprio com `var(--code-*)` (§4) |
| `features/chat/Markdown.tsx:36` | Mermaid `neutral`/`dark`, com `fontFamily: "var(--font-sans)"` | Fica, só a fonte muda (§3, Fora) |
| `features/welcome/WelcomeScreen.tsx:17, 21` | Logo em SVG com `fill="var(--primary)"` e `stroke="var(--primary-foreground)"` | A ponte resolve. A tela é da task 10 |
| `var(--status-attention)` | 30 usos: `DraftCard.tsx` (222, 256, 417, 428, 434), `ReviewBar.tsx` (60, 65, 81), `PullRequestRow.tsx` (66, 113), `StatusDot.tsx:8`, `ContextGauge.tsx:13`, `PRBar.tsx:180`, `SidebarTree.tsx:283`, `CardRow.tsx:83`, `CardDetail.tsx:155`, `QuestionCard.tsx:75`, `PermissionCard.tsx:97`, `NewTaskDialog.tsx:292`, `CardContextPreview.tsx:92`, `DiscussionContextPreview.tsx:124`, `DiscussionBar.tsx:32`, `ModelPicker.tsx:137`, `Defaults.tsx:62`, `RepositoryRow.tsx:158`, `RepositoryFilter.tsx:50`, `MissingClones.tsx:28` | Alias (§4) |
| `var(--status-success)` | 8: `StatusDot.tsx:11`, `StageTrack.tsx:34`, `ActionGroup.tsx:16`, `DraftDiff.tsx:12`… | Alias |
| `var(--status-working)`, `var(--status-paused)` | 5: `StatusDot.tsx:7, 9`… | Alias |
| Testes que consultam essas classes | `ContextGauge.test`, `StepTabs.test`, `StepBar.test`, `StepList.test`, `PRBar.test`, `ReviewHeader.test`, `DraftDiff.test`, `DiscussionHeader.test` | Com os aliases, não mudam |
| `var(--duration-fast)` 11, `var(--duration-base)` 4, `var(--ease-standard)` 4 | Features diversas | Mesmos nomes no system |
| Classes de cor do shadcn nas features | 106 arquivos. `text-muted-foreground` 250, `text-destructive` 39, `bg-background` 24, `bg-accent` 21, `text-foreground` 17, `bg-muted` 16, `ring-ring` 15… | A ponte. A task 12 as tira |
| Variante `dark:` | 0 nas features. Em `ui/` e no Streamdown, sim | Segue a variante redefinida sobre `data-theme` |

## 6. Riscos e o primeiro step

| Risco | Tratamento |
|---|---|
| **Fontes no WebKitGTK** (`implementation.md:188`) | O step 1 é a prova, antes de qualquer token ou wrapper. Se Fira não renderiza bem, a task **para**, e o usuário decide entre outra fonte e a do sistema. A decisão entra em `decisions.md` pela frente de design, e `design/system/tokens.css` muda antes do step 2 |
| **Meio pixel** (`implementation.md:189`) | Todo `rem` de `tokens.css` dá pixel inteiro a 16 px (conferido: nenhum resto) e os glifos são pares. `globals.test.tsx` passa a provar isso lendo o arquivo, junto com a regra de centralização. `--panel-width` e `--panel-card-width` (`tokens.css:91, 96`) são `clamp` com porcentagem, sem `round()`: é a task 2 que os arredonda. `--link-offset` e `--tracking-caps` são `em` e ficam fora da regra |
| **Import fora de `frontend/`** | `task check` não constrói o Vite, e `build:frontend` não observa `design/` (§4). O step de tokens roda `task build` e confere os `sources` |
| **Tema no primeiro frame** | O script de `index.html` e `backgroundFor` em Go mudam juntos. Sem isso, o app pisca o neutro antigo antes do React ou abre claro sem os tokens escuros |
| **Retematização visível nas telas antigas** | Esperada e aceita entre as tasks 1 e 12 (`implementation.md:15`). O step de tokens compara a 1250 e a 2560 px, nos dois modos, para confirmar que nada ficou ilegível (contraste de `--ink-3` onde era `muted-foreground`, `bg-accent` translúcido) |

**Como o step 1 é feito:**

1. Instalar `@fontsource/fira-sans` (400, 500, 600, 700 e 400 itálico) e Fira Code nas duas versões para comparar (`@fontsource/fira-code` estática e `@fontsource-variable/fira-code`). Trocar `styles/fonts.css`, e só as famílias em `styles/tokens.css:7–8`. Nenhuma cor muda. Tirar Inter e JetBrains Mono do `package.json`.
2. Conferir se os `.woff2` trazem hinting TrueType. Por exemplo, `fc-query <arquivo> | grep fonthashint`, ou as tabelas `fpgm` e `prep` com o fontTools (não instalado nesta máquina: `uvx --from fonttools ttx -l`). Se não trazem, registrar, e o usuário decide entre elas e os TTF com hinting da distribuição oficial da Fira, servidos do repositório.
3. `task build` e o binário na máquina alvo (Omarchy, Hyprland, `scale = 1`, `target-machine.md:5`). Capturas com `grim`, claro e escuro, de: a lateral (registro de cromo, 12–14 px), uma conversa com Markdown, código inline e um bloco de código (leitura em 16/26, mono em 13/20), e um diálogo. Ao lado, as mesmas regiões de `lab/08-visual-final/specimen.html` num navegador.
4. Variar `font-synthesis: none` e `text-rendering` (`optimizeLegibility` e `auto`) e registrar o que muda: peso 500 contra 600, itálico real contra sintetizado.
5. Registrar em `docs/development/target-machine.md` §Renderização: as fontes, o hinting, as propriedades escolhidas e o resultado. As capturas ficam fora do repositório. O step pede o olhar do usuário antes do commit.

## 7. Documentação que a task atualiza

| Arquivo | O que muda |
|---|---|
| `docs/architecture/design-system.md` (novo) | O design system como ele é: a fonte dos tokens (`design/system/tokens.css`, importado ou copiado), a ponte do shadcn e a `@theme inline` com as colisões resolvidas, `components/system/` com a escolha primitivo ou próprio de cada componente, o tema por `data-theme` (script, `useApplyTheme`, `backgroundFor`), as regras do WebKitGTK (pixel inteiro, `round()`, fontes com hinting) e o tema do Streamdown. Cada task seguinte acrescenta a sua família de componente |
| `docs/README.md` | A entrada de `design-system.md` em Arquitetura (linhas 10–15) |
| `docs/guidelines/frontend.md` | §Componentes (22): os componentes vêm de `components/system/`, que embrulha `components/ui/`, e um comportamento diferente é um wrapper ali, não em `features/`. §Estilo (37): a fonte dos tokens, cor só em `tokens.css`, `data-theme`. §Estilo (39): a regra do diálogo como ficar. §Acessibilidade (33): as três durações |
| `docs/guidelines/README.md:22` | "ganha um wrapper em `features/`" passa a `components/system/`. Não estava na lista, mas contradiz a regra nova |
| `docs/architecture/overview.md` | A árvore (39–40) ganha `src/components/system/`. §Features (153): `theme` aplica `data-theme`. §Estilo (157–159) reescrito, apontando `design-system.md` |
| `docs/architecture/stack.md` | O resumo (12), com o design system e as fontes Fira. O parágrafo de Tailwind e shadcn (40), com a ponte e os wrappers |
| `docs/development/target-machine.md` | §Renderização: a prova das fontes (step 1) e a troca de tema por `data-theme` repintando sem piscar |
| `docs/product/features.md` | Nada. O tema continua como descrito em §Configurações e aparência (678) |

## 8. Plano de steps sugerido

Oito steps, o teto de M. Cada um é um commit com `task check` verde, e os testes do que ele cria vão no mesmo commit.

1. **Prova e troca das fontes.** Como na §6: Fira Sans e Fira Code, Inter e JetBrains Mono fora, e o registro em `target-machine.md`. Ponto de parada: o usuário aprova as capturas.
2. **Tema por `data-theme`, com a paleta antiga.** Os seletores `.dark` de `globals.css:90` e `styles/tokens.css:25` passam a `[data-theme="dark"]`. A variante `dark` muda (`globals.css:10`), e também `index.html:14`, `useApplyTheme.ts:16` e `ThemeToggle.test.tsx:41, 51`. O modo escuro continua funcionando em todo commit.
3. **Tokens do design como fonte única, e as pontes.** O import (ou a cópia), a ponte do shadcn, a `@theme inline`, as colisões, os aliases `--status-*`, as regras globais movidas, a paleta antiga apagada, `backgroundFor` em Go e `sources` do `build:frontend`. `globals.test.tsx` ganha a paridade e o pixel inteiro dos tokens. Rodar `task build` e comparar as telas antigas nos dois modos.
4. **Streamdown.** O registro de leitura, o tema do shiki com `var(--code-*)`, o cromo do bloco de código pelos `data-streamdown` e a fonte do mermaid. Testes em `Markdown.test.tsx`.
5. **Fundamentos.** Glifo de estado, spinner e brilho (com o movimento reduzido), ícone com o mapa de significados, tooltip, etiqueta, tag, placeholder e tecla, avatar e link.
6. **Controles de escolha.** Botão nas seis variantes, com `.k`, o desabilitado com a razão e o carregando; chip e chip de tempo; controle segmentado, caixa de seleção e rádio, com a escolha primitivo ou próprio registrada; e `biome.json`.
7. **Campos, menus e diálogo.** Input, textarea e busca; select, menu e listbox; collapsible; scroll area; esqueleto; diálogo nas quatro variantes, com a regra de posição em pixel inteiro e o teste dela.
8. **Blocos e documentação.** Estado vazio, faixa de aviso, linha afundada, bloco de código e medidor de contexto; `design-system.md` e o resto da §7.

Se o plano passar de oito, o step 6 se divide entre o botão e o resto, antes de qualquer corte de escopo.
