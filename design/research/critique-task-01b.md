# Crítica da task 1b · Foundation fixes

Revisão da PR #66 (branch `foundation-fixes`, `181a03b`, três commits sobre `fa456fa`) contra `design/tasks/01b-foundation-fixes.md`, a origem `design/research/critique-task-01.md` e a régua em `main` (`064588a`): `design/system/components.md` e `design/system/tokens.css`. Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa; as linhas são as de `181a03b`.

**Como foi verificado.**

- Na worktree da PR: `pnpm test:coverage` (189 arquivos, 2138 testes, verdes; linhas 97.71%, branches 92.65%, acima dos limiares), `pnpm test:painted` (14 arquivos, 191 testes no Chromium, verdes) e `pnpm typecheck` (os dois `tsconfig`, verdes). CI da PR verde (Frontend, Go, Build). A branch mergeia sem conflito com `main` em `064588a`.
- Por mutação, numa cópia da worktree no scratchpad, fora do repositório, apagada depois:
  - o `Input.tsx` e o `Textarea.tsx` de `9aa29b6` fazem 22 dos 24 testes de `Input.painted.test.tsx` falharem. Só o repouso claro passa, como o diagnóstico previa;
  - tirar `dark:data-[variant=destructive]:focus:bg-state-error-veil` de `Menu.tsx` faz o teste do destrutivo falhar no escuro;
  - tirar a guarda de `:focus-visible` de `Tooltip.tsx:36` não faz **nenhum** teste falhar, nem no jsdom nem no Chromium (item 3).
- Uma sonda no Chromium digitou num `SearchInput` e num `Input` fora de um `Field` com `loading` ligado pela digitação. O controle é remontado e perde o foco no primeiro caractere (item 1).
- O contraste foi medido no Chromium, a partir de `tokens.css` de `main`, nos dois temas, com as cores compostas por canvas (tabela no fim).
- Nenhum servidor ficou de pé; o Chromium das medições foi fechado pelo próprio script.

## Item a item do material

| # | Item | Estado | Como se verifica |
|---|---|---|---|
| 1 | Input e Textarea | Feito | `Input.tsx:21` neutraliza variante por variante, com `dark:` incluída; `Input.painted.test.tsx` mede fundo, borda, estilo e sombra em repouso, foco, erro, erro com foco e desabilitado, nos dois temas, e é vermelho contra `9aa29b6` |
| 2 | Suíte pintada | Feita, com lacuna | Projeto `painted` em `vitest.config.ts:36–50`, `test/painted.ts`, `test:web` roda as duas suítes, o CI instala o Chromium. `Field.tsx`, que embrulha `ui/label`, não tem teste pintado (divergência 7) |
| 3 | Diálogo e tooltip | Feito no comportamento; a guarda do tooltip não tem prova | Cancel com o foco num `alert` aberto por clique e o tooltip do `×` por `Tab` estão provados no Chromium (`Dialog.painted.test.tsx:102–120`); o primeiro campo e o próprio diálogo, no jsdom. A guarda não é provada (divergência 3) |
| 4 | Listbox | Feito, com falha de nome | `disabled` com a razão, `message` com **Try again**, `loading` com brilho e `unavailable` estão testados; o nome do gatilho não diz a indisponibilidade (divergência 4) |
| 5 | Desabilitado com a razão e carregando | Feito, com defeito fora do `Field` | `useControlState` em `Field.tsx:150–197`. Fora de um `Field` o controle remonta (divergência 1) |
| 6 | Botão carregando | Feito | `ButtonLoading` em `Button.tsx:27–29`; `@ts-expect-error` em `Button.test.tsx:68`. O Chip ficou com o mesmo buraco (divergência 5) |
| 7 | Chip | Tamanhos e brilho feitos; o erro só na cor | `sm` com `--size-chip-sm`, 22 px, `--text-micro`, sem `xs` (`Chip.tsx:38–41`, medido); brilho medido (`animation-name: shimmer`). O erro não tem portador além da cor (divergência 2) |
| 8 | Controle segmentado | Feito | `SegmentedControl.tsx:63`; `--ink-4` medido nos dois temas, com o anel no escolhido |
| 9 | Link e Menu | Feito | `href` obrigatório (`Link.tsx:9`, `@ts-expect-error` em `Link.test.tsx:52`); `✕` com `aria-hidden`; `getByRole("group", { name: "Task 2 open" })` no Chromium; destrutivo no escuro medido e provado por mutação |
| 10 | Bloco de código | Feito | `lineNumbers={false}` (`Markdown.tsx:52`, prop real do Streamdown 2.6.0); `code-theme.test.ts` recusa `fontStyle` |
| 11 | Cor da espera | Feito nos dois preenchimentos nomeados | `--status-attention-fill` em `globals.css:166`, lido por `StatusDot.tsx:8` e `PullRequestRow.tsx:66`. Sobram três preenchimentos (divergência 8) |
| 12 | O resto | Feito | `--space-8` medido numa janela de 400 px; `TimeChip` com o tempo por extenso; guarda de `ICONS` em `Icon.test.tsx`; busca `type="text"` com `role="searchbox"`; `theme_test.go` converte OKLCH em sRGB; guarda da paleta do Tailwind com o próprio teste; `frontend.md:23` diz o que o código novo importa |
| Critério | Captura na máquina alvo | **Sem evidência** | Nem a PR nem os commits têm a captura do diálogo com campo em erro e do campo desabilitado, claro e escuro, contra o espécime (divergência 6) |

## Os desvios declarados

- **Campo desabilitado como `aria-disabled` + `readOnly`, focável.** Aceito. É a convenção que `docs/architecture/design-system.md:128` já dá a todo controle (focável, `aria-disabled`, a razão por `aria-describedby`) e agora escreve para o campo. Sem o `disabled` nativo, as variantes `disabled:` do primitivo nunca disparam, o que resolve a cascata sem briga. O `dashed-disabled!` vence o `hover:border-ink-3`, e o foco sobre o desabilitado está medido (`Input.painted.test.tsx:84–96`). Dois efeitos colaterais não foram tratados: a remontagem fora do `Field` (divergência 1) e o seletor de foco inicial do diálogo, que ainda filtra por `:disabled` (divergência 9).
- **`data-error` no chip.** Aceito como gancho de estilo: `aria-invalid` não é suportado no papel `button`. O problema é outro: o estado não tem nenhum portador acessível nem de forma (divergência 2).
- **`@vitest/browser-playwright` e `playwright`.** Justificados. O material (§3, item 2, e §4) decidiu o modo navegador do Vitest no Chromium do Playwright, e o provider é o pacote que liga os dois. Estão documentados em `docs/development/setup.md:30–34` e `ci.md:9, 15, 26`. Faltam `docs/architecture/stack.md:26, 96`, que ainda dizem "Vitest com Testing Library e jsdom", e o `task setup` (divergência 10).
- **`tsconfig.painted.json`.** Justificado. Os matchers do modo navegador estreitariam os tipos do jest-dom da suíte do jsdom. Está documentado em `frontend.md:3`, `testing.md:61` e no comentário de `tsconfig.json:28–29`. `pnpm typecheck`, `task typecheck` e o CI checam os dois.

## Divergências, em ordem de gravidade

1. **Fora de um `Field`, o campo e a busca perdem o foco quando o carregando ou o desabilitado com a razão muda.** `components/system/Field.tsx:178–194`: `wrap` devolve o controle sozinho ou dentro de um `<span>` com a linha. Quando `own` muda (`Field.tsx:168`), a árvore muda de forma e o React remonta o `<input>`. Medido no Chromium: um `SearchInput` com `loading={value.length > 0}` fica com `value="a"` e sem foco depois de digitar `auth`, e o mesmo acontece com um `Input` solto. É o estado que esta PR introduz, que `design-system.md:130` promete à busca, e a busca quase sempre vive fora de um `Field`. **Mudar:** a estrutura fica estável, com o `<span>` de fora sempre presente quando não há `Field` e a linha renderizada ou vazia dentro dele. Um teste no Chromium digita com o carregando ligado pela digitação e confere o foco e o valor.
2. **O chip em erro só muda de cor.** `components/system/Chip.tsx:25, 47–48, 92`: `error` é um booleano que pinta `--state-error` sobre o véu, sem glifo, sem razão e sem nada no nome ou na descrição acessível. `tokens.css:183` diz que o erro é "never alone", e o espécime desenha o chip em erro com o glifo e a razão no tooltip (`lab/08-visual-final/specimen.html:1524`). Um leitor de tela e um daltônico não sabem que o chip falhou. **Mudar:** `error` passa a carregar a razão (`errorReason: string`), com o losango de erro (`StateGlyph`, `sm`) antes do rótulo, a razão no tooltip e ligada por `aria-describedby`, para o tooltip não ser o único portador (`components.md:105`). O teste pintado continua como está, e um teste no jsdom confere a descrição.
3. **A guarda de `:focus-visible` do tooltip não é provada e é redundante no navegador.** `components/system/Tooltip.tsx:36, 66–68`; `test/setup.ts:76–100`; `Dialog.painted.test.tsx:102–108`. Sem a guarda, nenhum teste falha. O teste do diálogo passa no vazio, porque o **Cancel** não tem tooltip. No navegador, o `useFocus` do Base UI já recusa um foco que não casa com `:focus-visible` (`node_modules/@base-ui/react/floating-ui-react/hooks/useFocus.js:109`). No jsdom, o Base UI abre sempre, e o calço de `setup.ts` só serve à guarda, que nenhum teste exercita. O comportamento pedido existe, mas a verificação do material ("nenhum `role="tooltip"`") não o prova. **Mudar:** uma de duas. Ou tirar a guarda e o calço, e `design-system.md:134` e `testing.md:71` dizem que o Base UI abre o tooltip só num foco visível. Ou manter os dois e acrescentar um teste que falha sem a guarda: no jsdom, um foco programático depois de um clique num gatilho com tooltip não abre tooltip.
4. **O gatilho do Listbox e do Select esconde a indisponibilidade do leitor de tela.** `components/system/Listbox.tsx:60` e `Select.tsx:82`: o `aria-label` é `Base branch: old`, enquanto a tela mostra `◇ old`. O `◇` é o único portador, e é visual. `Listbox.test.tsx` fixa esse nome ("keeps a saved choice that is no longer offered"). O gatilho também não escreve `· unavailable`, que o item da lista e o Chip escrevem (`Listbox.tsx:148–150`, `Chip.tsx:112–114`). **Mudar:** o nome do gatilho e o texto visível passam a dizer `Base branch: old · unavailable`, e o teste passa a exigir esse nome.
5. **O Chip carregando fica sem nome.** `components/system/Chip.tsx:22–23, 105–109`: `loadingLabel` é opcional e o carregando troca o rótulo pelo spinner e por ele. É o mesmo buraco que o item 6 fechou no botão (WCAG 4.1.2), e `design-system.md:130` põe o chip entre os que "carregam assim". **Mudar:** `ChipProps` usa a mesma união de `ButtonLoading`, e um `@ts-expect-error` no teste prova a recusa.
6. **O critério de pronto da captura não tem evidência.** `design/tasks/01b-foundation-fixes.md:15`: falta a captura na máquina alvo, claro e escuro, de um diálogo com um campo em erro e de um campo desabilitado, conferida com o espécime (seções Input e Dialog). A suíte pintada prova a cascata no Chromium; a nitidez do WebKitGTK continua sem prova. **Mudar:** anexar a captura à PR, ou o usuário dispensa o critério por escrito. Como nenhuma tela usa `components/system/` ainda, a captura exige uma bancada no WebKitGTK.
7. **A documentação promete uma cobertura pintada que não existe.** `docs/architecture/design-system.md:126`: "Todo componente que embrulha um primitivo de `components/ui/` tem a sua, e os próprios que têm estado de cor também", em `X.painted.test.tsx` ao lado. `Field.tsx` embrulha `ui/label` e não tem teste pintado. O `ui/label` traz `flex items-center gap-2`, que separa o rótulo do complemento por 8 px mais o espaço, e ninguém mede isso. Link, Badge, TimeChip, NoticeStrip, StateGlyph e ContextMeter têm estado de cor e não têm teste pintado. IconButton e Textarea moram em `Button.painted.test.tsx` e `Input.painted.test.tsx`. **Mudar:** acrescentar o `Field.painted.test.tsx` (rótulo, complemento, ajuda, erro e a linha do gerúndio, nos dois temas) e reescrever a frase com a lista do que a suíte cobre. `testing.md:71`, "passa a seguir a regra do navegador", descreve uma mudança; a frase deve dizer só o que o calço faz, ou sair junto com ele (divergência 3).
8. **Três preenchimentos de espera ainda leem o tom de texto.** `features/chat/entries/QuestionCard.tsx:75` e `PermissionCard.tsx:97` (trilho de 4 px, `border-l-[var(--status-attention)]`) e `styles/globals.css:284` (o véu da piscada, `--flash-color: var(--status-attention)`). `design-system.md:40` afirma que `--status-attention` é o texto e `--status-attention-fill` o preenchimento, e `components.md` (Glifo de estado, Cor da espera) diz "todo preenchimento". O material nomeava só dois. **Mudar:** os três passam a `--status-attention-fill`, ou `design-system.md:40` registra que a piscada espera a task 2, como `critique-task-01.md` já aceitou.
9. **O foco inicial do diálogo pode cair num campo desabilitado.** `components/system/Dialog.tsx:141–142`: `FIELD` filtra `:not(:disabled)`, mas o campo desabilitado agora é `aria-disabled` + `readOnly` e não casa com `:disabled`. Um diálogo de criação com o primeiro campo desabilitado abre nele. **Mudar:** `:not(:disabled):not([aria-disabled="true"])`, com um teste.
10. **O Chromium fica fora do `task setup`.** `Taskfile.yml:16–23` não instala o browser, e `setup.md:36` diz que o `task setup` é "o comando que mantém um clone atualizado". Depois de uma subida do `playwright`, `task check` quebra até alguém rodar o comando manual de `setup.md:33`. `stack.md:26, 96` não citam o modo navegador nem o Playwright. **Mudar:** `task setup` roda `pnpm exec playwright install --only-shell chromium`, que é idempotente, e `stack.md` ganha a linha. Opinião, fora da régua: guardar em cache o `~/.cache/ms-playwright` no CI (`.github/workflows/ci.yml:47–48`), com a chave na versão do `playwright`.
11. **O Select não tem carregando.** `components/system/Select.tsx:38–50`: o Listbox, que é a escolha longa do mesmo componente, tem `loading` com brilho, e o Select não tem. `components.md:210` dá ao gatilho "os comuns", e `design-system.md:130` não põe o Select nem entre os que carregam nem entre as exceções. **Mudar:** `loading` no Select como no Listbox, ou uma linha em `design-system.md:130` com a exceção e a razão.
12. **Lacuna da régua, não da PR: o campo em erro com foco não mostra o foco.** `Input.tsx:21` e `Input.painted.test.tsx:60–69`: em erro com foco, o trilho vence e o halo some, e o campo focado pinta igual ao desfocado; só o cursor de texto diz onde está o foco (WCAG 2.4.7). Isso segue o material ("trilho visível com e sem foco") e o espécime (`specimen.html:402, 406`, mesma especificidade, o erro por último). **Mudar:** a frente de design decide em `components.md` (Input, Estados) se erro com foco empilha o trilho e o halo (`box-shadow: inset … , 0 0 0 var(--halo) var(--focus-halo)`). Até lá, a implementação está conforme.
13. **Nota, fora do escopo.** `icons.ts` não tem `file`, `archive`, `merge` e `trash`, que `components.md` (Ícones) ganhou em `064588a`. É escopo da task 2, com os glifos de tipo.

## Contraste medido

Medido no Chromium a partir de `tokens.css` de `main`, com os véus compostos sobre `--surface-1`. Todos os pares novos ou tocados pela PR passam: texto a 4.5:1, interface a 3:1. O mais apertado é a borda do campo contra a folha do diálogo no escuro, 3.07.

| Par | Claro | Escuro |
|---|---|---|
| `--state-error` sobre `--state-error-veil` (chip em erro, destrutivo em foco) | 5.43 | 5.78 |
| `--ink-3` sobre `--surface-3` (ajuda, razão e gerúndio do `Field` num diálogo, `MenuMessage`) | 7.26 | 6.65 |
| `--state-error` sobre `--surface-3` (erro do `Field` num diálogo, `MenuMessage` de erro) | 6.10 | 5.58 |
| `--state-error` sobre `--surface-0` (recusa no rodapé) | 5.46 | 7.14 |
| `--ink-2` sobre `--surface-2` (chip `sm` em `--text-micro`) | 10.89 | 9.69 |
| `--ink-4` sobre `--surface-input` (placeholder) | 6.15 | 6.81 |
| `--brand-ink` sobre `--brand-tint` (chip escolhido) | 5.42 | 6.18 |
| `--line-3` sobre `--surface-input` / `--surface-3` (borda do campo) | 3.51 / 3.51 | 3.89 / **3.07** |
| `--state-error` sobre `--surface-input` (borda e trilho de erro) | 6.10 | 7.09 |
| `--focus` sobre `--surface-input` / `--surface-3` | 5.65 / 5.65 | 7.55 / 5.94 |
| `--state-wait-glyph` sobre `--surface-sidebar` (`--status-attention-fill`) | 3.73 | 10.11 |
| `--brand-ring` sobre `--surface-0` (anel do segmento escolhido) | 3.91 | 4.77 |

## Veredito

**Corrigir antes do merge.** A PR faz o que a crítica da task 1 pediu e faz bem na parte estrutural. A suíte pintada é real: fica vermelha contra o código antigo e contra a regressão do destrutivo. Campos, Listbox, segmentado, Link, Menu, bloco de código e a cor da espera conferem com a régua nos dois temas, e o contraste passa. Três defeitos são desta PR e são pequenos:

- a remontagem fora do `Field` (divergência 1) quebra a digitação na busca, que é o próximo uso real;
- o chip em erro só na cor (divergência 2) contraria "never alone";
- o chip carregando sem nome (divergência 5) repete o buraco que o item 6 fechou no botão.

Com eles, entram no mesmo step o teste que prova a guarda do tooltip, ou a remoção dela (divergência 3), o nome do gatilho indisponível (divergência 4) e o seletor de foco inicial (divergência 9). A captura na máquina alvo (divergência 6) é critério de pronto do material: anexar ou dispensar por decisão do usuário. As divergências 7, 8, 10 e 11 são de documentação e de acabamento e cabem no mesmo commit. A 12 vai para a frente de design.
