# Crítica da task 5 · Home, board e criação de task (PR #73)

Primeira leitura da branch `52-redesign-5-home-board-and-task-creation` em `266ca3c` (17 commits, 156 arquivos, CI verde), na worktree de revisão. A régua é `design/tasks/05-board.md` (o material; `05:N` é a linha N dele), `screens/board.md`, `structure.md`, `principles.md`, `system/components.md`, `system/tokens.css`, `changes.md` B1–B13, `backend.md` P22, P22b, P23 e F7–F13, `decisions.md` e os mocks `lab/11-screen-board/a.html` e `components.html`. Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** a task entrega o que o material pede. A Home, a visão por status, o painel com as ações por caso, o modo de seleção, a faixa da falha, o diálogo de criação, o campo **Board**, B1, B13 e o P22 funcionam, nos testes e no app real.
- **Provas:** três das provas que o pronto exige não provam o que dizem. São a coluna das teclas, a segunda linha inteira e o P22b por `CreateTask`.
- **Capturas:** a PR não tem as capturas do pronto 1.
- **Defeitos à vista:** um contradiz a régua (a falha em vermelho na Home). O outro aparece em todo diálogo de criação: **Models** com dois chevrons.
- **Foco:** o foco é puxado para a linha errada ao fechar o painel.
- **Documentação:** um trecho de `docs/` contradiz o código.

Os oito bloqueios são pequenos; nenhum pede decisão do usuário.

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`, na worktree de revisão, todas verdes:

| Suíte | Resultado |
|---|---|
| `gotestsum ./...` | 2.682 testes, 1 pulado |
| `go mod tidy -diff`, `golangci-lint`, `govulncheck` | limpos |
| `biome ci .` | 626 arquivos, limpo |
| `pnpm typecheck` | verde |
| `vitest --project unit` | 4.294 testes em 259 arquivos |
| `pnpm test:painted` | 947 testes em 56 arquivos |
| `task bindings:check` | sem diff; `git status` limpo depois |

### Mutações

Cada mutação rodou numa cópia no scratchpad, só com os testes que ela alcança. O modo browser do vitest fixa a porta 63315, então as rodadas pintadas em paralelo precisaram de outra porta na cópia.

| Mutação | Onde | Teste | Resultado |
|---|---|---|---|
| `--col-keys` de volta a 112 | `design/system/tokens.css:104` | `DetailsPanel.painted` | 2 de 2 falham |
| `--col-keys` de volta a 112 | idem | `BoardView.scenes.painted`, `ListRow.painted` | **sobrevive** (78 de 78) |
| `--col-dep` de volta a 56 | `tokens.css:102` | idem | **sobrevive** |
| `--size-dialog-wide` de volta a 544 | `tokens.css:99` | `NewTaskDialog.scenes.painted`, `Dialog.painted` | **sobrevive** |
| A dependência da segunda linha cortada | `components/system/ListRow.tsx:245` | cenas e `ListRow.painted` | **sobrevive** (54 e 24) |
| `CreateTask` devolve `failed` sem `undoneFailure` | `internal/bindings/task_service.go:179` | `./internal/bindings` | **sobrevive** |
| `undoneFailure(failed, nil)` | idem | idem | **sobrevive** |
| Sem o aviso de `S` no card fora da leitura | `features/board/BoardView.tsx:380` | unit | **sobrevive** (413) |
| `nil` no lugar de `CardWriters()` | `internal/app/state.go:74` | `app`, `bindings` | **sobrevive** |
| A borda da linha em 1040 em vez de 1041 | `ListRow.tsx` (todos os `@max-[1041px]`) | cenas | 2 de 78 falham |
| A coluna com `-0.5px` | `BoardView.tsx:50` | cenas | 20 de 54 falham |
| `--col-task` × 9, o título abaixo de um terço | `tokens.css:103` | cenas | 16 de 78 falham |
| **Cancel** da barra da seleção primário | `components/system/SelectionBar.tsx:170` | unit, painted | 1 e 6 falham |
| **Discuss** primário no painel | `features/board/CardActions.tsx` | where-actions-went, BoardCardPanel | 10 de 78 falham |
| `Esc` fecha o painel antes do aviso | `BoardView.tsx:313` | unit | 1 falha |
| O foco perdido sem a linha seguinte | `features/board/CardTree.tsx:134` | unit | 2 falham |
| `aria-selected` no modo de seleção | `ListRow.tsx:175` | unit | 3 falham |
| O painel ao lado a partir de 900 px | `styles/globals.css:381` | ListPanel e cenas | 4 de 68 falham |
| O painel sem `round(down,…)` | `styles/globals.css:369` | idem | 8 de 68 falham |
| Sem o foco depois de **Add to board** | `features/board/BoardCardPanel.tsx:79` | unit | 1 falha |
| **Continue** ignora a pilha | `features/home/home.ts:80` | `home` | 5 falham |
| B1 reinjetado | `store/app-store.ts` (`navigate`) | app-store | 1 falha |
| O campo **Board** com um board só | `features/sidebar/new-discussion-board.ts:153` | sidebar, discussion | 2 falham |
| A ordem das razões do **Create** | `features/task-create/create-task.ts:64–69` | `task-create` | 1 falha |
| O plural e o `and` da linha do contexto | `create-task.ts:13, 34` | idem | 1 e 7 falham |
| P22: as arquivadas fora, o empate pela mais velha | `internal/discussion/service.go` | discussion | 5 e 4 falham |
| O `↵` sem a caixa de 1em | `components/system/Kbd.tsx:37` | Kbd | 3 falham |

### Capturas

A PR não tem nenhuma.
- O corpo não tem imagens.
- Não existe a branch `captures/52-redesign-5-home-board-and-task-creation` no `origin`. Só existem as das tasks 3 e 4.

Veja o bloqueio 1.

### O CI

**O estado final é o da `main`.** O diff de `origin/main..HEAD` é vazio em:
- `.github/workflows/*`, `docs/development/ci.md`;
- `Taskfile.yml`, `mise.toml`, `build/`, `lefthook.yml`, `biome.json`;
- `go.mod`, `go.sum`, `package.json`, o lock e os configs do vite e do vitest.

**A sequência:**
1. `a362e90` troca os `runs-on: ubuntu-latest` pelo runner self-hosted `laptop`, no mesmo commit de duas correções de produto: o foco depois de um **Change path…** cancelado e a falha da leitura do contexto do card.
2. `4fccecd` e `a14c362` condicionam o `apt-get`, o `--with-deps` do Playwright e o cache do mise a `runner.environment == 'github-hosted'`. O segundo traz também a correção do `↵` do `Kbd`.
3. `9b40b41` desfaz tudo.

Nenhum runner ficou registrado, e o último run é em runner do GitHub. As idas e voltas só ficam no histórico se a PR não for squashed; #71 e #72 foram.

**Os commits de CI trazem duas mudanças de produto:**
- `ChangeRepositoryPath` devolve `(changed, err)`: `internal/bindings/repository_service.go:85–111`, com `TestChangeRepositoryPathSaysWhenTheChooserWasCancelled` e `BoardCardPanel.test.tsx`, e `features.md:118` concorda.
- O `↵` numa caixa de 1em, com prova pintada.

As duas estão certas.

## Bloqueiam o merge

1. **As capturas não estão na PR** (pronto 1; item 8 da revisão).
   - `05:19` pede as capturas das cenas anexadas ao pull request, lado a lado com o mock.
   - Falta rodar `task captures` e `task captures:push`, e pôr as tabelas no corpo: as treze cenas e `?home=none`, a 2180 e a 978 px, `card` também a 950 e a 812, nos dois temas.
   - O bloqueio 5 (dois chevrons) e o item 8 de "Pode esperar" (a cena `board` sem foco) estariam à vista nelas.

2. **O P22b não tem o teste de `CreateTask` que o pronto 8 pede.**
   - `internal/bindings/undone_test.go` testa só o helper `undoneFailure`.
   - Nenhum teste chama `CreateTask` com `StartTask` falhando, e as duas mutações do uso (`task_service.go:173–180`) sobrevivem.
   - **Mudar:** um teste de `CreateTask` com o fluxo falso, em dois casos:
     - o apagamento dá certo, e a mensagem termina em ` The task was undone.`;
     - o apagamento falha, e ela não termina.

3. **A prova da coluna das teclas é tautológica** (pronto 1, "a coluna das teclas dentro da sua largura"; pronto 11 na linha do card).
   - **Onde:** `features/board/BoardView.scenes.painted.test.tsx:109` compara `keys.scrollWidth` com `keys.clientWidth`. A célula é `justify-end` (`ListRow.tsx:145`), então o que não cabe vaza para a esquerda, fora do `scrollWidth`.
   - **Evidência:** com `--col-keys` em 112, `S start D discuss` mede 117 e invade 5 px da coluna vizinha. As 78 provas passam.
   - `components/system/ListRow.painted.test.tsx:59` também calcula o limite a partir do próprio token.
   - **Mudar:** comparar o `left` do conteúdo com o `left` da célula, ou a largura do conteúdo com `var(--col-keys)`.

4. **A prova do pronto 2 pula o que não acha.**
   - **Onde:** `BoardView.scenes.painted.test.tsx:134–149` faz `if (cell === undefined) continue;`.
   - `"◇ #461"` nunca casa, porque o `◇` é o `StateGlyph` desenhado em CSS, sem texto. `"Question"` na linha de #474 não existe: #474 não tem task.
   - **Resultado:** a dependência inteira na segunda linha nunca é conferida, e cortá-la (`ListRow.tsx:245`) passa.
   - **Mudar:**
     - procurar `#461` e `Question · Step 3/7`;
     - falhar quando a parte falta;
     - tirar `"Question"` de #474.

5. **Models tem dois chevrons.**
   - **Onde:**
     - `features/task-create/NewTaskDialog.tsx:376–380` põe um `Icon` chevron dentro do `CollapsibleTrigger`;
     - o próprio trigger já desenha o seu (`components/system/Collapsible.tsx:28–32`).
   - **No app:** a linha fica `› › Models`, nos dois temas, nos dois diálogos, sempre.
   - **A régua** (`05:290`) pede um chevron `--icon-xs`. Nenhum teste olha isso.
   - **Mudar:** tirar o `Icon` do diálogo e dar ao trigger o tamanho `xs`, ou dar ao `CollapsibleTrigger` uma forma sem o chevron próprio.

6. **`◇ Read failed 18m ago` sai em `--state-error` na linha de board da Home.**
   - **Onde:** `components/system/StartRow.tsx:218`.
   - **A régua:** `05:120`, `components.md:318` e `components.md:772` pedem `--ink-2`, como o mock (`lab/11-screen-board/src/board.css:229`). "A falha é faixa neutra, nunca situação" (`05:90`).
   - **O teste fixa o erro:** `StartRow.painted.test.tsx:82–83` exige `--state-error`.
   - **Mudar:** o código e o teste para `--ink-2`.

7. **Fechar o painel sempre põe o foco na linha aberta.**
   - **Onde:** `features/board/BoardView.tsx:202–206`. `closePanel` chama `focusRow(openKey)` sem condição, e o `Esc` passa por ela (`:315–316`).
   - **A régua** (`05:203`): o foco volta à linha "quando estava no painel".
   - **O que acontece:** quem abre #12, desce com `↓` até outra linha e aperta `Esc` é puxado de volta a #12.
   - `BoardView.keys.test.tsx:539–554` fixa esse comportamento: o foco em `row(2)` espera `row(12)`.
   - **Mudar:** mover o foco só quando `document.activeElement` está no `.list-panel`, e corrigir o teste.

8. **`docs/` contradiz o código.**
   - `docs/architecture/design-system.md:170` diz `@max-[1040px]/list`, e o código usa `@max-[1041px]/list` (`ListRow.tsx:88–260`, com a borda provada).
   - Em `design/system/components.md:888, 891, 893` ficaram `(hoje o token dá 544)`, `(hoje 56)` e `(hoje 112)`, falsos depois do step 3. É texto de estado anterior, que a régua de documentação recusa.
   - São três linhas; entram antes do merge pela regra de `CLAUDE.md` ("uma mudança não está pronta enquanto a documentação a contradiz").

## Podem esperar

Em ordem de gravidade.

1. **`--col-dep` 72 e `--size-dialog-wide` 576 sem prova.**
   - `NewTaskDialog.scenes.painted.test.tsx:54–59` compara o diálogo com o próprio token.
   - Nenhum teste põe um nome de 64 caracteres no campo, nem `#1291 +1` na coluna.
   - O pronto 11 só exige a prova de `Details`, que existe e mata a mutação. Estas provas justificariam os valores de `05:304–305`.

2. **`S` e `D` no painel do card fora da leitura não têm teste na visão.**
   - A mutação em `BoardView.tsx:380` sobrevive; só a função pura prova (`board-view.test.ts:997, 1024`).
   - O pronto 3 pede os avisos de `05:244–245` nesse caso.

3. **O ícone de **New task** na Home.** `features/home/Home.tsx:143` usa `ICONS.task`; `05:114`, `components.md:83` ("mais (`plus`), começar algo novo") e o mock pedem `plus`. No app, o **New task** leva o glifo de task, igual ao da árvore.

4. **`Nothing in progress` usa `PlaceEmpty`, o vazio da conversa.**
   - **Onde:** `Home.tsx:122`. O componente põe o título em `--text-title` e o corpo em `--text-body` (`components/system/PlaceEmpty.tsx`).
   - **A régua:** `05:108` pede o estado vazio de página, título em `--text-ui` 600 (`components.md:407`).
   - No app, o título fica maior que os rótulos de **Start** logo abaixo.

5. **A razão das ações do painel sai em `--ink-3`** (`features/board/CardActions.tsx:169`). A régua pede `--ink-2` (`05:208`); no erro, `--state-error` está certo.

6. **`Cloning…` duas vezes na linha da Home.**
   - `features/home/home.ts:175` já escreve `Cloning acme/billing…`, e `StartRow.tsx:156` acrescenta `<Busy>Cloning…</Busy>`.
   - `05:121` pede só o spinner no lugar de **Clone**.

7. **O cabeçalho de seção escreve `final`** depois da contagem (`components/system/ListSectionHeader.tsx:74–78`, no app `Done 12 final`).
   - Nem `05:181`, nem `components.md:712–721`, nem o mock (`src/a.js:15`) têm a palavra: a seção final se diz no tooltip e no nome acessível.
   - **Mudar:** tirar, ou registrar em `components.md`.

8. **A cena `board` não tem foco** (`test/board-scenes.ts:1247–1248`). O mock foca #474 (`src/shell.js:39`), com `S start` e `D discuss`; as capturas nunca mostrarão a coluna das teclas.

9. **O contraste do item desabilitado com ação focado no escuro.**
   - **Onde:** `components/system/Menu.tsx:234`, `text-ink-4` sobre `--surface-3` com o véu de hover: 4,44:1.
   - O item age (`Enter` clona), então a isenção de componente inativo não vale.
   - **Mudar:** subir a `--ink-3` com o foco.

10. **A faixa da falha é sempre `role="alert"`** (`features/board/BoardReadingStates.tsx:48`). `05:156` e `components.md:434` pedem o alerta só quando a falha chega; hoje ela é anunciada de novo a cada vez que a visão monta.

11. **A medição do board rodou só com o React de desenvolvimento** (`design/implementation.md:188–196`).
    - A da task 4 mediu também o de produção.
    - A decisão (a virtualização na task 12) não depende disso, mas o registro fica sem o número que a task 12 vai usar como linha de base.
    - **Opinião:** `↓` a 482 ms com 2.000 linhas diz que cada tecla refaz todas as linhas. Uma memoização da linha pode resolver sem virtualizar.

12. **A tecla da primária tracejada desaparece.**
    - `components/system/Button.tsx:124–126` usa `Kbd variant="on-primary"` também quando a primária está tracejada.
    - No **Create** tracejado do diálogo livre, o `Ctrl ↵` fica invisível nos dois temas, e a borda tracejada guarda o espaço vazio dele.
    - O `Button` é da #71; o defeito aparece aqui pela primeira vez num diálogo.

13. **A linha 2 de **Continue** não corta** (`components/system/Continue.tsx:61`, `shrink-0 whitespace-nowrap`). `05:104` pede corte com tooltip; numa coluna estreita ela empurra para fora.

14. **A falha na linha de board sem tooltip** (`StartRow.tsx:214–222`). `components.md:318` pede o tooltip com a hora da falha e a da leitura.

15. **A ordem das linhas do que bloqueia.** `home.ts:165–192` agrupa os casos por tipo; `05:121` diz "por repositório do board, em ordem alfabética". Só difere com um repositório sem clone e um clone inexistente no mesmo board.

16. **`◇` como caractere solto** em vez do `StateGlyph blocked`:
    - `components/system/DependencyNotice.tsx:27`;
    - `NewTaskDialog.tsx:103`;
    - `features/task-create/CardContextLine.tsx:123`;
    - `home.ts:178, 189`;
    - a marca de `Not satisfied` em `components/system/RelationList.tsx`.

17. **O nome `Shortcuts`** é um `sr-only` dentro de um `<p>` (`Home.tsx:196`). Opinião: um `role="group"` com `aria-label="Shortcuts"`.

18. **Textos e detalhes sem registro:**
    - `The clone is running.` (`features/board/card-panel.ts:128`) não está em `05:221`;
    - o link `Archived task: <nome>` cobre a frase inteira (`BoardCardPanel.tsx:160`); no mock, só o nome;
    - `FLASH_MS = 2 * 280` (`BoardView.tsx:46`) repete `--duration-slow` como número;
    - a barra da seleção sem o esmaecido de `--space-3` que a de filtros tem (`BoardView.tsx:450`);
    - `_app` sem uso em `filterChips` (`board-view.ts:144`);
    - `· no card to select` segue "nenhum card marcável" e não "nenhuma linha visível" (`BoardView.tsx:410` contra `05:148`).

19. **Provas curtas:**
    - só os oito primeiros textos cortados são conferidos (`BoardView.scenes.painted.test.tsx:113`, `slice(0, 8)`), e o pronto 1 diz "todo texto cortado";
    - o aviso de dependência sem contorno do diálogo não tem teste (a mutação que o contorna em `NewTaskDialog.tsx:339` passa);
    - a fiação de `state.go:74` não é testada.

20. **A ordem de **Review mode**.** O controle diz `Manual` / `Agent`, pela ordem de `lib/review-modes.ts:4`; `05:285` e o mock dizem `Agent` / `Manual`. Registrar a ordem do produto em `board.md` §4, ou trocar.

21. **Opiniões de acessibilidade, fora da régua:**
    - o aviso de tecla nasce com o texto dentro da região `role="status"` (`components/system/KeyNotice.tsx:100`), que o Orca no WebKitGTK costuma não anunciar, e fica em `--z-overlay`, abaixo do `--z-tooltip` da superfície que ele usa;
    - o nome acessível da linha não leva `Clone failed` nem `Cloning acme/billing…` (`board-view.ts:538–558`);
    - a razão do chip órfão só está no tooltip.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | **Cobertura:** as cenas cobrem as treze e `?home=none`, nas larguras e nos dois temas, e as fixtures batem com `data.js`: 120 cards, 46 linhas, as horas por cena, #474 escrito pela arquivada. **Provas que funcionam:** pixel inteiro (20 falham na mutação), terço do título (16), uma primária (6). **Falham:** a coluna das teclas (bloqueio 3), as capturas na PR (bloqueio 1) e os textos cortados, só os oito primeiros |
| 2 | **Falha** | A borda 1040/1041, os 452 px a 812 e o painel sobre a lista a 790 estão provados; "inteiras" não (bloqueio 4) |
| 3 | Quase | O teclado da lista, das seções e do painel, os avisos, `Space`, `N`, `/`, a ordem do `Esc`, a parada de Tab, `Ctrl+Enter`, o segmentado e `Enter` na Home. Falta o card fora da leitura (item 2 de "Pode esperar"), e um teste fixa o foco errado (bloqueio 7) |
| 4 | Ok | `useBoardViewMemory.test.ts`: os nomes, a forma antiga, o órfão, o valor ilegível, as finais |
| 5 | Ok | `BoardView.test.tsx:75–112, 380–420`, uma linha da tabela por caso, e o card fora da leitura no painel |
| 6 | Ok | Tabelas em `board-view.test.ts`, `card-panel.test.ts`, `home.test.ts`, `create-task.test.ts`, `lib/models.test.ts`, `new-discussion.test.ts`; as mutações são pegas |
| 7 | Ok | `where-actions-went.test.tsx` com todos os controles do terceiro parágrafo; a primária única no painel, no modo e no diálogo |
| 8 | **Falha** | **P22** completo: `cardWriters` compartilhada e sob o lock, a tabela de seis casos contra as duas funções, o DTO, `convert_test.go`, os bindings, `lib/wails.ts` e `makeBoardCard`. **P22b** sem o teste por `CreateTask` (bloqueio 2) |
| 9 | Ok | `resolveHome` saiu; a mutação é pega; `Nothing in progress` está provado, com o componente errado (item 4 de "Pode esperar") |
| 10 | Ok, com ressalva | A tabela e a decisão estão em `implementation.md:188–196`, medidas só no React de desenvolvimento (item 11 de "Pode esperar") |
| 11 | Ok | Os três tokens em `calc` (o diff de `tokens.css` são essas três linhas); `DetailsPanel.painted.test.tsx` mata a mutação; `UNROUNDED_WIDTHS` com o comentário |
| 12 | Ok | Cada teste removido tem o substituto no mesmo commit (`2902a68`, `4e68c62`, `9c82a7d`) |
| 13 | **Falha** | As seções de `features.md` da §7 estão reescritas, e `overview.md`, `design-system.md` e `setup.md` também; mas há os desvios do bloqueio 8 |

## O que saiu

- Nada importa mais `CardDetail`, `CardList`, `CardRow`, o `SelectionBar` do board, `StartTaskAction`, `CardSummary`, `CardContextPreview` nem `RepositoryPicker`.
- `ModelPicker` e `ReviewModePicker` ficam só onde a tabela "Fora" diz, e o diálogo não usa mais `ToggleGroup`.
- `react-resizable-panels` fica só em `components/ui/resizable.tsx` e `test/setup.ts`, para a task 12.
- `dev/measure-board.tsx` só entra sob `import.meta.env.DEV` (`main.tsx:14–23`) e não aparece em `frontend/dist`.

## Tokens e contraste

**Nenhuma cor, duração ou tamanho solto** onde há token, fora o `FLASH_MS` do item 18 de "Pode esperar".

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css`, com os véus compostos sobre a superfície (claro / escuro). Todos passam 4,5:1, salvo o do item 9 de "Pode esperar":
- `ink-3` na linha aberta: 6,07 / 6,18, e 5,07 / 4,57 pressionada;
- `ink-4` sobre `s1`: 6,05 / 6,45, e 5,03 / 4,92 com press;
- `state-error` sobre a linha aberta: 5,08 / 5,17;
- `brand-ink` sobre `s1`: 6,34 / 9,26;
- o aviso de tecla: 14,26 / 10,47;
- `brand-on` sobre `brand`: 5,66 / 7,79;
- os números da barra da seleção: 6,53 / 8,52;
- a exceção: `ink-4` sobre `surface-3` com hover, 5,50 / **4,44**.

**Fora do caminho:** `ink-4` sobre `brand-tint-plane` pressionado daria 3,66 no escuro. A linha aberta sobe o título a `ink-3`, e a mutação prova isso.

**Não texto:**
- o anel da linha aberta: 3,62 / 3,46;
- o foco: 5,57 / 7,18;
- o tracejado: 3,45 / 3,69 (3,09 / 3,14 com hover);
- a borda do sinal da caixa na linha pressionada: 2,87 / 2,81, só durante o press.

## No app real

**Como rodou:** `task build` passou. O app rodou de `bin/myspec` com `XDG_DATA_HOME` e `XDG_STATE_HOME` temporários e `dbus-run-session`, e o board `Pessoal` (`guilhermt/projects/2`) foi cadastrado pela interface.

**Primeiro caminho, na sessão Hyprland:**
- A janela abriu, mas o monitor único estava em uso pelo usuário.
- Num workspace escondido o WebKitGTK não pinta (`grim -T` devolve quadros velhos), e mostrar o workspace tomava a tela e o ponteiro de quem trabalhava.
- A saída headless do Hyprland foi recusada pela permissão.

**O que valeu:** o app rodou pelo backend Broadway do GTK, fora da sessão.
- A janela, o WebKitGTK real e as fontes do app foram desenhados num canvas, dirigido por um Chromium headless: clique, teclado e captura.
- A janela, com a decoração do GTK, tem o tamanho da viewport. Foram usadas duas larguras:
  - 2560, o monitor inteiro, com área principal de 2180;
  - 1250, a janela de 1250, com área principal de 950.
- O tema foi trocado pelo botão da lateral: sem portal, `System` é o claro.
- O `gh` dentro do barramento privado travava no chaveiro (`context deadline exceeded` no log); com `GH_TOKEN` do `gh auth token`, a leitura funcionou.
- Nada foi escrito no GitHub, nenhuma task nem discussão foi criada, e nenhum fetch rodou no clone.
- O app, o Broadway e o servidor do lab foram encerrados pelo PID, e os diretórios temporários, apagados.

**Os dados reais** não são 120 cards: `Pessoal` tem 23, 11 abertos fora de `Done` e 12 em `Done`, num repositório com clone. O volume de 120 ficou para as cenas; o que só o app mostra:

- **Fontes.** Fira Sans e Fira Code chegam ao WebKitGTK: o **Name** em mono, `#38` tabular, os `Kbd` inteiros. Nenhuma queda de fonte à vista.
- **Home, sem item ativo.**
  - `Nothing in progress` aparece com o título maior que o resto (item 4 de "Pode esperar"), e o **New task** com o glifo de task (item 3).
  - `Review a pull request · 4 pending in 1 repository` e `Pessoal · 11 open cards · MySpec · read 5m ago` estão certos.
  - Os atalhos aparecem uma caixa por tecla, e o `Ctrl N` da linha de início, uma caixa só.
  - O foco começa em **New task**: o primeiro `Tab` vai a **Review a pull request**.
  - **Continue** não pôde ser visto sem criar uma task.
- **A visão, a 2180 de área.** Relê ao abrir: `Reading…` e **Refresh** tracejado, depois `Read just now`, refeito a cada minuto. As seções e as contagens estão certas. Na linha:
  - `Done 12 final` recolhida, com a palavra `final` (item 7 de "Pode esperar");
  - o épico #47 em 500 com `Epic · 4 of 12 finished`;
  - `◇ #55 +1`;
  - o épico cortado em `Redesign · the experie…` com tooltip.
- **A visão, a 950 de área.**
  - Duas linhas, com a segunda inteira; a lista com o painel ao lado.
  - Sem o painel, a linha continua em duas, a 900 de contêiner.
  - A busca passa de 256 a 192 px quando o painel abre, e volta.
- **Teclado.** `/`, a busca que filtra enquanto se digita, `↓` para a lista com `S start` e `D discuss` na linha em foco, `Enter` que abre e fecha, `←` e `→` nas seções, `Space` que entra no modo e marca, `Esc` que sai. `Esc` no diálogo de criação fecha só o diálogo; o painel fica, e o foco volta à linha.
  - **Opinião, a régua não decide:** chegando ao board por clique numa linha da Home, o foco fica no `body`. `/` e `N` não agem até um `Tab` ou clique na visão; com o teclado, o primeiro `Tab` vai ao `←`.
- **O painel.** `#57 · guilhermt/MySpec`, **Start task** `S` a única primária, **Discuss** `D`, os avisos de dependência antes dos campos, o corpo em Markdown, **Epic**, **Cards of the epic · 11** e **Dependencies**. No épico, **Cards · 12** com o status de cada um.
- **O modo de seleção.** `2 selected #58 #59 · filtered`, **Discuss 2 cards** `D` primário, **Cancel** `Esc`, `Space unselect` na linha.
- **Os menus.**
  - O `⋯` tem os três itens.
  - **Filter** tem os três grupos, com `guilhermt · you` e `No status` no fim, como `components.md:729` diz.
  - **Assigned to me** com a busca mostra `No cards match the filters.` e `Nothing on the board has "redesign 1" in the title or the number, assigned to you.`, na fórmula de `05:165`.
- **O diálogo de criação, nos dois temas.**
  - O bloco do card, **Name** com o `suggestedName` e o cursor no fim, `From the card: #38 · 259 characters`, **Show**, que abre o contexto numa caixa com rolagem, e **Add to it**.
  - **Mode** e **Review mode** com as linhas, **Create** `Ctrl ↵`.
  - `Rate_Limit` dá o erro com `Use "rate-limit"`.
  - O seletor de repositório tem o visto no escolhido.
  - Os defeitos à vista: **Models** com `› ›` (bloqueio 5), `Manual` antes de `Agent` (item 20 de "Pode esperar") e, no livre, o **Create** tracejado sem o `Ctrl ↵` visível (item 12).
- **Tempo.** O teclado e a digitação têm atraso no Broadway, que é do transporte, não do app. Não é medida; a medição de `implementation.md` também é do Broadway, com o React de desenvolvimento.
- **O que o app não mostrou:** meio pixel e a borda 1040/1041. Sem devtools no Broadway, isso fica com as provas pintadas, que fazem essa parte.
