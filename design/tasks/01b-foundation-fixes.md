# Redesign 1b · Foundation fixes

Material de entrada de uma task pequena de correção, entre a task 1 e a task 2 de `design/implementation.md`, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). Ela corrige o que a crítica da task 1 (`design/research/critique-task-01.md`) apontou nos componentes de `frontend/src/components/system/` e na documentação, antes de a task 2 ser a primeira a usá-los. Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa; as linhas são as de `main` em `9aa29b6`.

## 1. Objetivo e critério de pronto

Os wrappers de `components/system/` pintam o que `design/system/components.md` diz em todos os estados e nos dois temas, e há um teste que prova o que pinta, não só as classes. Todo controle interativo tem os estados comuns que `docs/architecture/design-system.md` promete. As quatro decisões registradas em `components.md` e `tokens.css` depois da task 1 (chip `sm`, cor da espera, bloco de código, sem avatar) chegam ao código.

**Pronto quando:**

- a suíte de estilo computado (§4, item 2) roda em `task check` e passa nos dois temas para todo wrapper que embrulha um primitivo de `components/ui/`;
- cada item da §3 tem o seu teste, no mesmo step que o corrige;
- `task check` verde e a cobertura do frontend não cai;
- `docs/architecture/design-system.md` e `docs/guidelines/frontend.md` descrevem o que o código faz, sem exceção não dita;
- uma captura na máquina alvo, claro e escuro, de um diálogo com um campo em erro e de um campo desabilitado, confere com o espécime (`design/lab/08-visual-final/specimen.html`, seções Input e Dialog).

`changes.md` e `backend.md`: nenhuma linha. Uma linha de Go só no teste de `backgroundFor` (item 12).

## 2. O que ler

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/research/critique-task-01.md` | O diagnóstico de cada item, com a medição |
| 2 | `design/system/components.md`: estados comuns (17–27), Chip (163–175), Input (187–199), Select, menu e listbox (200–212), Controle segmentado (243–257), Glifo de estado (a linha Cor da espera), Quem fala, Bloco de código, Diálogo | A régua de cada correção |
| 3 | `design/system/tokens.css:72` | `--size-chip-sm` |
| 4 | `docs/architecture/design-system.md` | O que a documentação promete hoje (54, 125, 127, 40) |
| 5 | `docs/guidelines/testing.md`, `frontend.md` | Como um teste é escrito e os limiares |

## 3. Os itens

Cada item diz onde, o que muda e como se verifica. A ordem é a de gravidade.

### 1. Input e Textarea pintam fora do system

- **Onde.** `components/system/Input.tsx:14` (`FIELD`) e `:32–35`; `components/system/Textarea.tsx:29`. As classes que vencem vêm de `components/ui/input.tsx:11` e `components/ui/textarea.tsx:9`: `dark:bg-input/30`, `disabled:bg-input/50`, `dark:disabled:bg-input/80`, `dark:aria-invalid:border-destructive/50`, `dark:aria-invalid:ring-destructive/40`, e `aria-invalid:ring-3`, que o wrapper neutraliza com `aria-invalid:ring-0`, que por sua vez reescreve o `box-shadow` do trilho de `field-error` (`styles/globals.css:181–184`).
- **O que muda.** Em repouso, o fundo é `--surface-input` também sob `dark:`. Desabilitado, sem fundo também sob `dark:`, borda `--line-3` tracejada, tinta `--ink-4`. Em erro, borda `--state-error` cheia nos dois temas e o trilho interno `--error-rail` visível, com e sem foco; o anel do primitivo não participa do `box-shadow`. Em foco, borda `--focus` e halo `--focus-halo`. `components/ui/` não é editado: as classes do primitivo são neutralizadas no wrapper, variante por variante, `dark:` incluída.
- **Como se verifica.** Na suíte de estilo computado: `background-color`, `border-color`, `border-style` e `box-shadow` de um input e de um textarea em repouso, foco, erro, erro com foco e desabilitado, claro e escuro, iguais aos tokens resolvidos no mesmo documento.

### 2. Os testes dos wrappers provam o que pinta

- **Onde.** `components/system/*.test.tsx` comparam listas de classes com `css: false` (`vitest.config.ts:10`); é por isso que o item 1 passou.
- **O que muda.** Uma segunda suíte, de estilo computado, ao lado da de jsdom: arquivos `*.painted.test.tsx` em `components/system/`, rodando no modo navegador do Vitest com o Chromium do Playwright e com o CSS real (`styles/fonts.css` e `styles/globals.css`). Cada teste monta o wrapper sob `data-theme="light"` e `data-theme="dark"`, põe o estado (hover e foco pelo `userEvent` do modo navegador, desabilitado, erro, carregando, escolhido por props) e compara `getComputedStyle` com o valor do token resolvido por um elemento de sonda no mesmo tema. Cobre todo wrapper que embrulha um primitivo de `components/ui/` (Button, IconButton, Chip, Kbd, Input, Textarea, Select, Menu, Dialog, Skeleton, Collapsible) e os próprios que têm estado de cor (Checkbox, Radio, SegmentedControl, Listbox, SearchInput). Os testes de jsdom continuam sendo os de comportamento e acessibilidade; as asserções de classe de cor que a suíte nova cobre saem deles.
- **Decisão.** Chromium, não WebKit: o que falhou é a cascata (ordem de camadas e de variantes), que é do CSS e não do motor, e o Chromium roda na máquina alvo (Arch) e no CI; a nitidez continua sendo conferida por captura na máquina alvo. Descartado: um teste estático que confere se cada classe do primitivo foi neutralizada, porque ele prova o conhecimento da cascata de quem o escreveu, não a cascata.
- **Execução.** `test:web` roda as duas suítes; a cobertura e os limiares continuam vindo só da de jsdom. O job Frontend do CI instala o Chromium do Playwright antes de `task check`. `docs/development/` ganha o comando e a dependência.
- **Como se verifica.** A suíte nova falha contra o `Input.tsx` de `9aa29b6` (fundo escuro, desabilitado e trilho) e passa depois do item 1, no mesmo step.

### 3. O diálogo abre no lugar certo e sem tooltip

- **Onde.** `components/system/Dialog.tsx:66` (o foco inicial só por `initialFocus`) e `:122` (o `×` é o primeiro focável); `components/system/Tooltip.tsx:28` (o tooltip abre em qualquer foco).
- **O que muda.** Sem `initialFocus`, um diálogo `alert` foca **Cancel**, e os outros focam o primeiro campo do corpo; sem campo, o próprio diálogo. Nunca o `×`. `DialogFooter` ganha o `DialogCancel`, o **Cancel** secundário que fecha o diálogo e que o foco inicial encontra; `initialFocus` continua como exceção explícita. O Tooltip abre na hora só por foco visível de teclado (`:focus-visible`); um foco programático, como o inicial de um diálogo aberto com o mouse, não abre tooltip.
- **Como se verifica.** Um diálogo `alert` aberto por clique: **Cancel** com o foco e nenhum `role="tooltip"` no documento. Um de criação: o primeiro campo com o foco. `Tab` até o `×`: o tooltip `Close Esc` abre.

### 4. Listbox com os estados comuns

- **Onde.** `components/system/Listbox.tsx:14–22`.
- **O que muda.** Como o `Select`: `disabled` com `disabledReason` (gatilho focável, `aria-disabled`, tracejado, a razão ligada por `aria-describedby`, não abre); `message` com tom neutro ou de erro no lugar dos itens (o `MenuMessage` de `Menu.tsx:144`, com **Try again** quando o chamador a dá); `loading` como a escolha salva com o brilho no gatilho, enquanto o catálogo é lido (`components.md`, Chip e Select); item `unavailable` com `◇` e `· unavailable`, não escolhível, sem trocar a escolha atual.
- **Como se verifica.** Um teste por estado no jsdom (papel, nome, `aria-disabled`, descrição, `role="status"`/`"alert"`), e o gatilho desabilitado e o brilho na suíte de estilo computado.

### 5. Desabilitado com a razão e carregando em todo controle

- **Onde.** `docs/architecture/design-system.md:125, 127` prometem os dois estados a todo controle interativo; `Input.tsx`, `Textarea.tsx` e `SearchInput.tsx` não têm `disabledReason`, e o carregando de `Input.tsx:28, 34` não tem spinner nem gerúndio.
- **O que muda.** Input, Textarea e SearchInput aceitam `disabledReason` (somada à descrição do `Field`, nunca no lugar dela) e `loading` com `loadingLabel`: o controle fica com `aria-busy` e a linha de ajuda do `Field` mostra o spinner e o gerúndio (`Checking the name…`). As exceções, que não são controles com esses estados, ficam escritas em `design-system.md`: Link (indisponível é texto, não controle), Collapsible e o resumo do grupo de ações (não têm desabilitado), Tooltip, MenuCycleItem.
- **Como se verifica.** Testes de `toHaveAccessibleDescription` e `aria-busy` em cada um; a frase de `design-system.md` lista os que têm e os que não têm.

### 6. Botão carregando sem nome

- **Onde.** `components/system/Button.tsx:19` (`loadingLabel` opcional) e `:103–107` (o rótulo some).
- **O que muda.** `ButtonProps` passa a exigir `loadingLabel` quando `loading` é verdadeiro, pelo tipo. O `IconButton` mantém o `aria-label` e dispensa o rótulo.
- **Como se verifica.** O `typecheck` recusa `<Button loading>` sem `loadingLabel`; o teste acha o botão carregando por `getByRole("button", { name: "Approving…" })`.

### 7. Chip: tamanho `sm`, erro e leitura do catálogo

- **Onde.** `components/system/Chip.tsx:35–39` (`sm` com `--size-control-sm`, 28 px, igual ao `md`; `xs` com `--size-control-xs`); `:89–101` (sem erro e sem leitura).
- **O que muda.** Os tamanhos são `md` (`--size-chip`) e `sm` (`--size-chip-sm`, 22 px, `--text-micro`, `tokens.css:72`); `xs` sai, porque `components.md` não tem mais chip `xs`. Estado de erro: tinta `--state-error` sobre `--state-error-veil`, borda `--state-error` (`specimen.html:422`). Estado lendo o catálogo: a escolha salva com o brilho (`Shimmer`), sem spinner.
- **Como se verifica.** Alturas 28 e 22 px e as cores do erro na suíte de estilo computado; o brilho por papel e texto no jsdom.

### 8. Controle segmentado desabilitado

- **Onde.** `components/system/SegmentedControl.tsx:52` (tracejado só no grupo) e `:60` (tinta fixa em cada segmento).
- **O que muda.** Com o grupo desabilitado, todo segmento, o escolhido incluído, fica em `--ink-4`, sem hover; o escolhido mantém o anel para dizer qual é.
- **Como se verifica.** Suíte de estilo computado: `color` dos segmentos desabilitados igual a `--ink-4` nos dois temas.

### 9. Nomes e papéis: Link e Menu

- **Onde.** `components/system/Link.tsx:7` (`href` opcional) e `:48` (o `✕` é lido); `components/system/Menu.tsx:45` (legenda de grupo sem ligação) e `:85` contra `components/ui/dropdown-menu.tsx:88` (`dark:data-[variant=destructive]:focus:bg-destructive/20`).
- **O que muda.** `href` obrigatório no `Link`; uma ação sem destino é um botão. O `✕` do erro é `aria-hidden`, e a razão é o texto. `MenuGroupLabel` é o `Menu.GroupLabel` do Base UI dentro do `MenuGroup`, e o grupo tem nome. O item destrutivo em foco pinta `--state-error-veil` também no escuro.
- **Como se verifica.** `getByRole("group", { name })` no menu; o link sem `href` não compila; o fundo do destrutivo em foco no escuro na suíte de estilo computado (hoje 4.02:1, o alvo é `--state-error` sobre `--state-error-veil`, 5.77:1).

### 10. Bloco de código

- **Onde.** `features/chat/Markdown.tsx:51`; `features/chat/code-theme.ts:63–87`.
- **O que muda.** `lineNumbers={false}` no `Streamdown`. O tema de código não dá `fontStyle` a nenhum escopo: tudo em peso 400, sem itálico nem negrito (`components.md`, Bloco de código, linha Tinta).
- **Como se verifica.** `code-theme.test.ts` prova que nenhum `tokenColors` tem `fontStyle`; o mock do Streamdown em `test/setup.ts` expõe `lineNumbers`, e `Markdown.test.tsx` o confere.

### 11. A cor da espera nos preenchimentos das telas antigas

- **Onde.** `styles/globals.css:164` (`--status-attention: var(--state-wait)`), lido como preenchimento em `features/task/StatusDot.tsx:8` e `features/reviews/PullRequestRow.tsx:66`.
- **O que muda.** A ponte ganha `--status-attention-fill: var(--state-wait-glyph)`, e os dois preenchimentos passam a lê-lo; `--status-attention` continua sendo o texto. É a regra Cor da espera de `components.md` (Glifo de estado). A task 12 apaga os dois aliases.
- **Como se verifica.** `globals.test.tsx` continua provando que a ponte só aponta para tokens; os testes das duas features que consultam a classe mudam junto.

### 12. O resto

| Onde | O que muda | Como se verifica |
|---|---|---|
| `components/system/Dialog.tsx:28` | `2rem` passa a `--space-8` | Leitura; a suíte de estilo computado mede a largura numa janela estreita |
| `components/system/TimeChip.tsx:28, 37` | O texto oculto diz o tempo por extenso (`waiting for you, 18 minutes`); o curto visível fica `aria-hidden`. O tooltip continua para o mouse | `getByText` do texto oculto |
| `components/system/Select.tsx:146`, `Checkbox.tsx:62`, `Listbox.tsx:88` | O visto vem de `ICONS.done`, pelo `Icon` | Um teste em `Icon.test.tsx` que nenhum arquivo de `components/system/` importa do `lucide-react` um ícone que `ICONS` mapeia |
| `components/system/SearchInput.tsx:44` | `type="text"` com `enterKeyHint="search"`: o WebKit não desenha o cancelar nativo ao lado do `×` próprio | Teste do atributo; captura na máquina alvo com texto na busca |
| `internal/app/theme.go:136–141` | Um teste lê `--surface-1` dos dois temas em `design/system/tokens.css`, converte de OKLCH para sRGB e compara com `backgroundFor` | `go test ./internal/app` |
| `styles/globals.test.tsx:155–171` | O guarda de cor solta recusa também as classes da paleta do Tailwind (`text-red-500`, `bg-amber-100`…) fora de `components/ui/` | O próprio teste |
| `docs/architecture/design-system.md:40, 54, 125, 127` | O alias de preenchimento da espera; "sem valor solto" verdadeiro; os estados comuns com as exceções do item 5; a suíte de estilo computado na seção de testes dos componentes | Leitura contra o código |
| `docs/guidelines/frontend.md:22` | Código novo de uma feature importa componentes de `components/system/`; os usos de `components/ui/` nas features são os que as tasks de tela substituem | Leitura |
| `docs/guidelines/testing.md` | A suíte de estilo computado: quando um teste vai para ela, como compara com o token | Leitura |

## 4. Decisões

Tomadas, o tech spec só detalha:

| Decisão | Fonte |
|---|---|
| `components/ui/` nunca é editado: toda correção de cascata é no wrapper | `implementation.md:19` |
| Suíte de estilo computado no modo navegador do Vitest, Chromium, `*.painted.test.tsx`, cobertura só do jsdom | §3, item 2 |
| Diálogo: foco inicial em **Cancel** (`DialogCancel`) num `alert`, no primeiro campo nos outros; tooltip só por foco visível de teclado | `components.md`, Diálogo (Teclado) e Tooltip |
| Chip em dois tamanhos, `md` e `sm`; sem `xs` | `components.md`, Chip; `tokens.css:72` |
| Bloco de código em peso 400, sem itálico, sem números de linha | `components.md`, Bloco de código |
| Preenchimento de espera em `--state-wait-glyph`, texto em `--state-wait` | `components.md`, Glifo de estado |
| Nenhum componente de avatar | `components.md`, Quem fala |

## 5. Fora

- O cabeçalho do bloco de código com o caminho e o intervalo de linhas, e o código longo cortado em 20 linhas: task 4, com a conversa.
- Os glifos de tipo (task, One-Shot, review, discussão, épico, board) no mapa de ícones: task 2, com a árvore.
- `Ctrl+N`, `Ctrl+J` e `Ctrl+,` inertes com um diálogo de criação aberto: task 2, que cria os atalhos globais.
- O alinhamento do `EmptyState` (`components.md` diz "centrado na medida", os mocks alinham à esquerda) e o anel de foco por dentro da scroll area em `components.md`: esperam uma decisão da frente de design.
- Qualquer tela e a troca das importações das features.

## 6. Plano de steps sugerido

Três steps, P. Cada um é um commit com `task check` verde e os testes do que ele corrige.

1. **A suíte de estilo computado e os campos.** O modo navegador do Vitest, o Chromium no CI, os `*.painted.test.tsx` dos wrappers que embrulham `components/ui/`, vermelhos para Input e Textarea; a correção de Input e Textarea (item 1) e do destrutivo do menu (item 9, a parte de cor). `docs/development/` e `testing.md`.
2. **Estados e foco.** Diálogo e tooltip (item 3), Listbox (item 4), desabilitado e carregando nos campos e na busca (item 5), `loadingLabel` do botão (item 6), Chip (item 7), controle segmentado (item 8), Link e Menu (item 9, o resto).
3. **O restante e a documentação.** Bloco de código (item 10), a cor da espera (item 11), a tabela do item 12, `design-system.md` e `frontend.md`. A captura na máquina alvo do critério de pronto.

Se o step 2 passar do tamanho de um commit revisável, ele se divide entre o diálogo com o Listbox e o resto, antes de qualquer corte de escopo.
