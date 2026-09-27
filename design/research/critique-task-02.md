# Crítica da task 2 · shell, árvore, navegação com histórico, painéis e barra do pedido

Revisão da implementação mergeada em `main` no commit `d04cb42` (PR #67), contra `design/tasks/02-shell.md`, `design/structure.md` §1, §2, §3, §5, §6 e §7, `design/system/components.md` (grupo Shell, barra do pedido, painéis, aviso e toast, página do item que saiu), `design/system/tokens.css`, `design/principles.md`, `design/changes.md` (S1–S9, X16) e `design/backend.md` (P1, P2, F1, F2, F19). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa; as linhas são as de `d04cb42`.

## Como foi verificado

- **Testes.** `task test:web`: suíte jsdom com cobertura, 207 arquivos e 2.591 testes, verde; suíte pintada (Chromium), 23 arquivos e 280 testes, verde. `task test:go`: 2.455 testes (1 pulado), cobertura total de 90,8%, limites satisfeitos.
- **O shell pintado.** Numa cópia de `frontend/` e `design/system/` fora do repositório (no scratchpad, com `node_modules` ligado por symlink), um teste `*.painted.test.tsx` montou a lateral real (`Sidebar`), o cabeçalho real da task (`TaskHeader`), o aviso do app, quatro formas da barra do pedido e um toast, com um `State` falso de seis tasks, um review, uma discussão, um épico e um clone ausente, a 1100, 1250 e 2560 px, lateral aberta e recolhida, claro e escuro. Os mocks `design/lab/10-screen-task-minimal/b.html` e `design/lab/08-visual-final/index.html` foram capturados a 1250 e 2560 px nos dois temas, pelo Playwright, em `file://`. Nenhum servidor foi aberto.
- **Contraste.** Medido, não estimado: os pares OKLCH de `tokens.css` convertidos para sRGB, com os véus compostos como o `color-mix` em srgb os compõe sobre a superfície de baixo (tabela no fim).

## Os 14 itens do critério de pronto

| # | Item | Estado | Evidência |
|---|---|---|---|
| 1 | Árvore: teste de componente por linha e por estado, pelo nome acessível inteiro | Cumprido no essencial, não na letra | `features/sidebar/TreeRow.test.tsx:75–189` renderiza dez estados (erro, espera, encerramento, agente, app, GitHub, pausado, ocioso, discussão quieta, discussão publicada) e acha cada um por `getByRole("treeitem", { name })` com a frase inteira; aberta, `Ctrl J`, trilho e aviso de clone em `TreeRow.test.tsx:289–322` e `Tree.test.tsx:121–167`. As linhas das duas tabelas de `structure.md` §2 estão testadas uma a uma, mas na lógica pura (`sidebar-tree.test.ts:97–630`), não como componente. Aceitável: a frase que o componente usa é a mesma |
| 2 | `sidebar-tree.ts` puro e testado em tabela | Cumprido, com um lugar diferente | Gravidade (`sidebar-tree.test.ts:781`), linha 2 longa e curta de toda `kind` (`:97–378`), sem situação (`:415–630`), linha 3 (`:631–705`), resumo dos nós (`:799–848`). A ordem do `Ctrl+J` mora em `lib/situations.ts:220` (`nextWaiting`), testada com o filtro em `lib/situations.test.ts:233–308`, não em `sidebar-tree.ts` como o item pede |
| 3 | P1 no Go e no DTO | Cumprido | `internal/session/service_test.go` (o turno começa, uma ação começa e termina, duas ações, turno sem ação, interrupção, o estado a cada ação); `internal/bindings/convert_test.go:2531–2576` nos cinco blocos; a linha 3 de um item fechado com a ação do DTO em `sidebar-tree.test.ts:688`. O `publish` coalescido em `internal/app/throttle.go`, com `throttle_test.go` |
| 4 | Navegação | Cumprido | Pilha em `store/app-store.test.ts`; atalhos inertes com modal e Settings por `Esc`, `Ctrl+,` e voltar em `app/useGlobalShortcuts.test.tsx:180–466`; a notificação com modal aberto em `app/bootstrap.test.ts:215`; `←`/`→` com destino no tooltip em `components/system/PlaceHeader.test.tsx` |
| 5 | Painéis | Cumprido, com duas lacunas de forma | `components/system/AuxPanel.test.tsx`; `styles/globals.test.tsx` prova o `round(down, …)` e a container query de 1120 px. Faltam a saída animada e o nome no tooltip do grupo só com ícone (divergências 9 e 10) |
| 6 | Barra do pedido nas sete formas | Cumprido | `components/system/RequestBar.test.tsx:11–173`, cinco formas e as duas da outra conversa, com a região `Request` e o `role="status"` |
| 7 | Página do item que saiu e toasts | Cumprido | Os sete casos, e o review apagado a mais, em `features/navigation/GoneView.test.tsx:54–158`; o toast parado com ponteiro e foco em `components/system/Toast.test.tsx:59–82` |
| 8 | X16 e F19 | Cumprido | `run(failure, operation)` exige o `Failure` pelo tipo (`store/actions.ts:46`); as 58 chamadas têm rótulo; aviso nas boas-vindas em `features/welcome/WelcomeScreen.tsx:40` e no teste dela |
| 9 | Situação nova | Cumprido, com um resto | A piscada de `--duration-slow` duas vezes e nenhuma com movimento reduzido em `styles/globals.test.tsx`; o anúncio numa região só em `ToastRegion.tsx:17`. O `flashing` ainda é limpo em 1.600 ms, não em 2 × 280 (divergência 6) |
| 10 | Faixa recolhida pelo teclado, com o nome da linha | Cumprido no teclado; falha na forma | `SidebarRail.test.tsx:57, 99`. Nas capturas, o glifo de estado sobrepõe o chip em todo bloco (divergência 1) |
| 11 | Larguras: sem rolagem lateral, sem corte sem tooltip, sem sobreposição, sem meio pixel | **Não cumprido** | Sem rolagem horizontal e sem meio pixel nas linhas, cabeçalho, seções e laterais a 1100, 1250 e 2560 px, nos dois temas. Mas há sobreposição na faixa recolhida em todos os blocos e o relógio do bloco cai em `y = …,63` (divergência 1). Não há no repositório as capturas que o item pede em task, review, board e Settings |
| 12 | `task check` verde | Cumprido nos testes | Web e Go verdes nesta revisão |
| 13 | Documentação da §7 | Cumprido | `docs/product/features.md` (lateral, faixa, teclado da árvore, página do item que saiu, toast, atalhos), `docs/architecture/overview.md:95, 101, 116` (P1 e o limitador), `docs/architecture/design-system.md`, `docs/guidelines/frontend.md:15–25`. Nenhuma referência sobrou a `WaitingSection`, `openTaskId`, `NO_ITEM_PLACE` ou `useOpenTask`. `sessions.md` não muda, como a recomendação previa |
| 14 | Revisão do crítico antes do merge | **Não cumprido** | A task foi mergeada antes desta revisão; as correções abaixo entram depois do merge |

## Divergências, da mais grave para a menos

### Antes da task 3

Nada aqui impede tecnicamente a task 3, que trabalha na tela abaixo do cabeçalho. Estes itens ficam antes dela porque são da lateral e do shell, que nenhuma task seguinte reabre: se não entrarem agora, ninguém os corrige.

1. **A faixa recolhida sobrepõe o glifo de estado ao chip, em todo bloco.** `features/sidebar/SidebarRail.tsx:155–159` põe o `StateGlyph` a `-bottom-(--space-1)` do ícone de tipo, fora da caixa dele, e `:140` separa o ícone do chip só por `--line-gap` (2 px). Medido a 1250 px nos dois temas: o fundo do glifo passa o topo do chip ou do relógio em 1 a 9 px em todos os oito blocos (o losango do erro sobre o `!2h`, o disco da espera sobre o `18m`, o anel sobre o `1h`). É o "nenhuma sobreposição" do pronto 11. O relógio do turno e a palavra do estado caem em meio pixel (`top` 112,63 e 236,63 a 1250 px) pela caixa de `:171`, `min-h-(--size-time-chip)` com texto de `--leading-micro` centrado. O que mudar: reservar no bloco a altura do canto do glifo (ou pôr o glifo dentro da caixa do ícone, como `components.md` desenha: "no canto inferior direito") e alinhar a linha do tempo em pixel inteiro.
2. **O nó da árvore esconde do leitor de tela o que diz à direita.** `features/sidebar/TreeNodeRow.tsx:147` dá ao `treeitem` o `aria-label` só com o título quando o nó está aberto, e o `aria-label` substitui o conteúdo: `4 pending`, `reading…` e `◇ Read failed` com a razão (`:62–106`) somem do nome. Um board com leitura falha é lido como "Platform Roadmap". A falha fica só na forma e no tooltip, o que `components.md` (Tooltip: "nunca é o único portador") proíbe. O que mudar: o nome do nó aberto diz também o estado (`Reviews, 4 pending`; `Platform Roadmap, read failed: <razão>`).
3. **A árvore não separa os nós de topo.** O mock desenha `--section-gap` (24 px) entre Reviews, cada board e No board (`08-visual-final/index.html:485`, `.sec + .sec`), e `components.md` lista `--section-gap` nos tokens do Nó. A implementação usa só `gap-(--row-gap)` (4 px) em `features/sidebar/Tree.tsx:126`, e o token não é usado em nenhum lugar do frontend. Nas capturas, o fim de Reviews cola no título do board, e a árvore perde o agrupamento que o mock tem.
4. **A linha de um épico não é recuada como caixa, e o véu cobre a guia.** O mock recua o grupo do épico (`margin-left: var(--epic-indent)`, `08/index.html:506–507`), então a linha aberta, o hover e o trilho de erro começam depois da guia. `features/sidebar/TreeRow.tsx:108` recua só o conteúdo (`pl-[calc(var(--tree-pad)+var(--epic-indent))]`), a caixa começa na borda, e o `bg-brand-veil` da linha aberta pinta por cima da guia desenhada em `Tree.tsx:145`: nas capturas a guia some na altura da linha aberta.
5. **A forma curta da ação quebra no padrão de pacote do Go.** `features/sidebar/sidebar-tree.ts:599–615` toma o último segmento do caminho, e em `go test ./internal/ratelimit/... -run TestBucket` ele é `...`: a linha 3 diz `Running go test …/...` nas capturas. A regra (`structure.md` §6, com o exemplo `Running go test …/ratelimit`) quer o último segmento que identifica. O que mudar: `lastSegment` pula `...` e segmentos vazios; um caso em `sidebar-tree.test.ts:768`.

### Junto da task 3

6. **O `flashing` ainda dura 1.600 ms.** `app/bootstrap.ts:44` limpa a situação depois de `FLASH_MS` (`lib/situations.ts:16`, 1.600 ms), e §4.4 da task decide 2 × 280 ms. A piscada da árvore termina em 560 ms pelo CSS, então o efeito visível está certo; o resto é uma janela de um segundo em que uma linha que aparece (um nó expandido, a faixa alternada) pisca atrasada. `StepTabs` ainda depende dos 1.600 ms (`features/task/StepTabs.tsx:83`) e sai na task 3, que é quando a troca cabe.
7. **O estado carregando da linha não existe.** `components.md` (Linha da árvore, Estados) e `structure.md` §2 pedem `PR review · checking GitHub` com o brilho antes da primeira leitura; `sidebar-tree.ts:525–530` diz sempre `PR review · waiting for checks`, e `PullRequest.checkedAt` já chega. A forma provisória da §4.2 cobre a contagem ausente (P13), não a leitura que ainda não veio; a task 3 traz P13 e é onde as duas formas se resolvem juntas.
8. **O apagar da task é o `Button` gerado, sem tooltip e fora do registro de ícones.** `features/task/TaskHeader.tsx:72–79` usa `@/components/ui/button` com `Trash2` direto, só com `aria-label`; `components.md` (Ícones) pede o tooltip num botão só de ícone, e `ICONS.trash` existe desde esta task. A task 3 leva o apagar para o `⋯`; basta não deixar este botão sobreviver a ela.
9. **O grupo de painéis só com ícone não diz o nome no tooltip.** `components/system/AuxPanel.tsx:26` põe no tooltip a descrição (`PRD, tech spec, steps and reports`) e `:36` esconde o nome abaixo de 1440 px; `components.md` (Grupo de painéis) quer "o nome no tooltip e no nome acessível". A 1250 px, o tooltip do ícone de documento não diz `Artifacts`. A task 3 acrescenta `Details` e `Card` a esse grupo.
10. **O painel e o toast saem sem animação.** `components.md` (Painel auxiliar; Aviso do app e toast) pede a saída em `--duration-fast` com `--ease-exit`; `styles/globals.css:312–329` e `:343–346` só animam a entrada (o comentário de `:343` diz "it leaves by being removed").
11. **Código morto deixado pela remoção da lateral e da atenção.** `lib/situations.ts:121` (`placeLabel`), `:140` (`namesPlace`) e `:173` (`situationDetail`) eram de `WaitingSection` e só os testes os usam; `store/app-store.ts:1192` (`useReviews`), `:1202` (`useOpenReviewId`) e `:1245` (`useOpenDiscussionId`) eram de `ReviewsNode` e `SidebarTree` e não têm leitor; `features/sidebar/sidebar-tree.ts:926` (`allRows`) não tem leitor fora do teste, porque `SidebarRail.tsx:56` usa `nodeRows` por grupo. O comentário de `FLASH_MS` (`lib/situations.ts:15`) ainda fala de "a row, a counter".
12. **`--ink-4` sobre a linha pressionada.** `features/sidebar/TreeRow.tsx:109` pressiona com `active:bg-veil-press`, e o meta, a palavra `idle` e a linha 3 continuam em `--ink-4` (`:146`, `:220`, `:232`): 4,36:1 no claro, abaixo de 4,5. O comentário de `tokens.css` sobre `--ink-4` exclui "a pressed veil on the sidebar". É um estado de um instante, mas a regra é explícita: pressionada, a linha sobe para `--ink-3`, como faz a aberta.
13. **Valor solto num componente do system.** `components/system/AppNotice.tsx:23` usa `basis-64` (16 rem), fora dos degraus que `docs/architecture/design-system.md:62` admite.
14. **Detalhes do mock que não passaram.** A linha 3 pinta o verbo em `--ink-3` e o alvo em `--ink-4` (`08/index.html:540–541`); `TreeRow.tsx:229–233` pinta tudo em `--ink-4`. O `Change path ↵` do aviso de clone é `--brand-ink` no mock (`08/index.html:549`); `CloneNotice.tsx:53` usa `--ink-3`. O texto do aviso é `--text-ui` no mock (`.nm`) e `--text-meta` em `CloneNotice.tsx:49`. O vazio da árvore começa na coluna do texto no mock (`.sb-empty`, `08/index.html:555`); `Tree.tsx:32–33` o alinha à borda do ícone.
15. **O épico no menu do breadcrumb dobrado é um item desabilitado sem razão.** `components/system/PlaceHeader.tsx:84` põe `disabled: true` no nível que não é lugar; `components.md` (Menu do item) pede a razão ao lado de todo item desabilitado. O épico podia ficar como texto no menu, fora dos itens.
16. **`lib/sessions.ts:1` importa de `features/task/step-status`.** Um módulo de `lib/` depende de uma feature, e o único leitor dele é `features/sidebar/sidebar-tree.ts:9`. Pela regra de `docs/guidelines/frontend.md:25`, isso é da feature da árvore, ou as três funções de passo descem para `lib/`. `workingSession` (`lib/sessions.ts:101`) ainda lê `Date.now()` dentro de uma função que o resto do módulo trata como pura; o `now` já chega a `buildRow`.
17. **`↓ N more below` não conta a linha cortada no fim.** `features/sidebar/MoreBelow.tsx:13–22` conta só as linhas cujo topo passou do fundo da vista. A 1100 px, a última discussão aparece cortada pela metade e o indicador não aparece. Isso é opinião: o texto de `components.md` ("some quando nada está abaixo da vista") admite as duas leituras.

## O que está conforme e merece registro

- A linha diz o que as duas tabelas de `structure.md` §2 e as formas provisórias da §4.2 mandam, em todas as `kind`, e o nome acessível segue a ordem do mock (`08/index.html:983–991`). O meta sai abaixo de 330 px, como a régua manda. O mock 10-b ainda mostra o meta a 300 px; vale a régua.
- O modelo de lugar é o da §4.4: `Location` como união, `go`, `back` e `forward`, o item que saiu substituindo o lugar, a pilha persistida sem as páginas que saíram (`store/app-store.ts:397–425`), o pulo do que sumiu (`:520–553`), o `Discard your changes?` antes de `←`/`→` (`:617–638`), a Home que se resolve no board sem empilhar.
- P1 está feito do jeito recomendado: um caminho de estado só, coalescido em 100 ms com a última mudança garantida (`internal/app/throttle.go`), e desligado antes do fim do app (`internal/app/app.go:515–517`).
- A região `.toasts` é a única região ao vivo nova; os papéis próprios que existiam ficam fora dela.
- O cabeçalho cede como a decisão 1 manda: a 812 px de área principal tudo cabe numa faixa de 48 px, com o breadcrumb em `…` e os controles só com ícone.

## Contraste medido

Todos os pares de texto e de forma do shell passam nos dois temas, com uma exceção (divergência 12). Os mais apertados:

| Par | Claro | Escuro | Exigido |
|---|---|---|---|
| `--ink-4` (meta, `idle`, `pending`, linha 3) sobre `--surface-sidebar` | 5,22 | 6,94 | 4,5 |
| `--ink-4` sobre a linha em hover (`--veil-hover` na lateral) | 4,69 | 6,06 | 4,5 |
| **`--ink-4` sobre a linha pressionada (`--veil-press` na lateral)** | **4,36** | 5,47 | 4,5 |
| `--ink-3` sobre a linha aberta (`--brand-veil`) | 5,28 | 6,57 | 4,5 |
| `--brand-ink` do ícone de tipo sobre a linha aberta | 4,66 | 7,56 | 3 |
| `--ink-3` durante a piscada (`--state-wait-veil` / `--state-error-veil`) | 6,59 / 6,48 | 6,79 / 6,89 | 4,5 |
| `--state-close` do chip sobre a linha aberta, sem `raised` | 4,11 | 7,71 | 4,5 (não ocorre: `TreeRow.tsx:209` levanta o chip) |
| `--ink-4` da contagem do History pressionado (`--brand-tint-plane`) | 5,11 | 4,95 | 4,5 |
| `--brand-ink` do `Ctrl J` sobre `--brand-tint` | 5,43 | 6,17 | 4,5 |
| Borda do filtro (`--sidebar-control`) sobre `--sidebar-input` | 3,75 | 3,08 | 3 |
| `--state-wait` do rótulo tingido sobre `--state-wait-veil` | 5,60 | 8,86 | 4,5 |
| `--state-error` do rótulo sobre `--state-error-veil` (barra e aviso) | 5,42 | 5,77 | 4,5 |
| `--state-close` do rótulo de encerramento sobre `--surface-0` | 5,08 | 10,00 | 4,5 |
| Anel de foco `--focus` sobre a linha aberta | 4,10 | 5,86 | 3 |
| Trilho de erro sobre a linha aberta | 4,43 | 5,50 | 3 |

## Veredito

**Corrigir.** A arquitetura da task está certa e testada: o lugar com histórico, P1 com o `publish` coalescido, a árvore pura e o nome acessível inteiro, a página do item que saiu, o aviso com rótulo. Mas dois itens do próprio critério de pronto não se cumprem: o 11, porque a faixa recolhida sobrepõe glifo e chip em todo bloco e põe o relógio em meio pixel, e o 14, porque o merge veio antes desta revisão. A árvore também perde duas formas do mock decidido (o espaço entre os nós e o recuo do épico como caixa) e esconde do leitor de tela o estado dos nós. As divergências de 1 a 5 são da lateral, que nenhuma task seguinte reabre: cabem num commit de correção antes da task 3. As de 6 a 17 tocam o que a task 3 reescreve, ou são limpeza, e podem entrar junto dela.
