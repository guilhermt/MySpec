# Crítica da task 1b · Foundation fixes

Revisão da PR #66 (branch `foundation-fixes`, em `e98ac75`) contra `design/tasks/01b-foundation-fixes.md`, a origem `design/research/critique-task-01.md` e a régua em `main` (`cba098f`): `design/system/components.md`, com a linha "Error com foco", e `design/system/tokens.css`. Os caminhos de código são relativos a `frontend/` quando não dizem outra coisa; as linhas são as de `e98ac75`.

## Como foi verificado

**Testes na worktree da PR:**

| Comando | Resultado |
|---|---|
| `pnpm test:coverage` | 189 arquivos, 2142 testes, verdes; linhas 97.72%, branches 92.69% |
| `pnpm test:painted` | 15 arquivos, 201 testes no Chromium, verdes |
| `pnpm typecheck` | Os dois `tsconfig`, verdes |
| `biome ci` | Verde |

O CI da PR está verde (Frontend, Go, Build), e a branch mergeia sem conflito com `main`.

**Mutações.** Cada correção nova foi revertida numa cópia no scratchpad, apagada depois. Cada reversão faz o seu teste falhar:

| Correção revertida | Teste que falha |
|---|---|
| `wrap` volta a devolver o controle sozinho fora de um `Field` | `Field.painted.test.tsx`, os dois casos "keeps the focus and what is typed…": o nó muda |
| A guarda de `:focus-visible` sai de `Tooltip.tsx` | `Tooltip.test.tsx`, "stays closed on a focus that is not visible…" |
| `FIELD` do diálogo volta a filtrar só `:disabled` | `Dialog.test.tsx`, "skips a disabled field…" |

## O que a primeira crítica pediu e está resolvido

| # | Divergência | Como está agora |
|---|---|---|
| 1 | Remontagem fora do `Field` | `Field.tsx:180–197`: o invólucro fica sempre presente, em `display: contents` quando não há linha. Provada no Chromium para a busca e para o input |
| 2 | Chip em erro só na cor | `errorReason` desenha o losango de erro antes do rótulo, põe a razão no tooltip e liga um `sr-only` por `aria-describedby` (`Chip.tsx:79, 98–104, 123, 148–160`). O teste confere a descrição e o tooltip |
| 3 | Guarda do tooltip sem prova | Provada no jsdom. `testing.md:71` e `design-system.md:134` dizem o papel do calço e da guarda no presente |
| 4 | Nome do gatilho indisponível | `choiceName` e `ChosenText` (`Select.tsx`) escrevem e nomeiam `old · unavailable` no Select e no Listbox, com testes nos dois |
| 5 | Chip carregando sem nome | `ChipProps = ChipBaseProps & ButtonLoading`, com `@ts-expect-error` no teste |
| 7 | Cobertura pintada | `Field.painted.test.tsx`. `design-system.md:126` lista o que a suíte cobre e o que ainda não cobre |
| 8 | Preenchimentos de espera | `QuestionCard.tsx:75`, `PermissionCard.tsx:97` e a piscada (`globals.css:284`) leem `--status-attention-fill`. `design-system.md:40` os nomeia |
| 9 | Foco inicial do diálogo | O seletor recusa também `aria-disabled` (`Dialog.tsx:144–145`), com teste |
| 10 | `task setup` e `stack.md` | `task playwright:install` entra no `task setup`. O cache do Chromium no CI fica pela versão do `playwright`. `stack.md:26, 96` e `setup.md` descrevem os dois projetos e a razão do Chromium |
| 11 | Select sem carregando | `loading` com brilho e `aria-busy`, com teste no jsdom e no Chromium |
| 13 | Ícones novos de `components.md` | Continua para a task 2, como combinado |

## O que restou, em ordem de gravidade

1. **O campo em erro com foco não segue a régua decidida.** A regra "Error com foco" (`components.md`, estados comuns, `cba098f`) pede que o campo em erro mantenha a borda `--state-error` e o trilho interno, e que o foco acrescente o halo `--focus-halo` por fora. `components/system/Input.tsx:21` continua com o comportamento antigo: o `aria-invalid:field-error!` substitui o `box-shadow` inteiro, e o halo some. `Input.painted.test.tsx:60–69` prova exatamente isso ("keeps the error border and the rail while focused" espera só `rail()`). Vale para o input e o textarea, nos dois temas. **Mudar:** o erro com foco compõe as duas sombras, `inset var(--error-rail) 0 0 var(--state-error), 0 0 0 var(--halo) var(--focus-halo)`, numa variante `aria-invalid:focus-visible:` depois das duas atuais, ou num `@utility field-error-focus` em `globals.css`. A borda continua `--state-error`. O teste passa a esperar as duas camadas, e `design-system.md` diz o estado na linha dos campos.
2. **Pendente do usuário: a captura na máquina alvo.** O critério de pronto (`design/tasks/01b-foundation-fixes.md:15`) pede a captura no WebKitGTK, claro e escuro, de um diálogo com um campo em erro e de um campo desabilitado, contra o espécime. O corpo da PR a declara pendente para o usuário. Com o item 1 corrigido, a captura mostra também o erro com foco. Falta anexá-la ou dispensá-la por escrito.
3. **Menor, documentação.** `docs/architecture/design-system.md:132` e `:140` são dois parágrafos sobre o mesmo foco inicial do diálogo ("Diálogo." e "Diálogo, foco inicial."). **Mudar:** fundi-los num só. O corpo da PR ainda pergunta à frente de design sobre o erro com foco, que já está decidido; a pergunta sai.

## Veredito

**Corrigir antes do merge.** Doze das treze divergências estão resolvidas, e as três provas novas falham quando a correção é revertida. Resta o erro com foco, que agora contraria uma linha decidida de `components.md`, e cujo teste pintado fixa o comportamento errado. É uma troca de uma classe e de uma expectativa no mesmo step. Com ela e com a captura anexada ou dispensada pelo usuário, a PR pode ser mergeada.
