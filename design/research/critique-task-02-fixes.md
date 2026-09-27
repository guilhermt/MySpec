# Crítica das correções da task 2 · PR #68

Revisão da branch `shell-fixes` (commits `9035a5b` e `7392046`) antes do merge, contra as 17 divergências de `design/research/critique-task-02.md`, `design/structure.md` §2, §3 e §6, `design/system/components.md` (grupo Shell), `design/system/tokens.css` e os mocks `design/lab/08-visual-final/index.html` e `design/lab/10-screen-task-minimal/b.html`. Os caminhos de código são relativos a `frontend/src/` e as linhas são as de `7392046`.

## Como foi verificado

- **Testes.** `task test:web`: jsdom com cobertura, 208 arquivos e 2.579 testes, verde (97,75% de linhas); suíte pintada (Chromium), 26 arquivos e 296 testes, verde. `task test:go`: 2.455 testes (1 pulado), cobertura total de 90,7%, limites satisfeitos.
- **Mutação das provas pintadas novas**, numa cópia de `frontend/` e `design/system/` no scratchpad. Cada correção foi revertida sozinha e o teste rodado:
  - glifo de volta a `-bottom-(--space-1)` e vão de volta a `--line-gap` (`SidebarRail.tsx:161` e `:142`): `keeps the state glyph of every block clear of its clock` falha nos dois temas (alcance 126,49 contra o pé em 124). A caixa do ícone sem `size-(--icon)` não muda nada, porque o ícone já tem 16 px.
  - `min-h-(--size-time-chip)` no lugar de `h-` (`SidebarRail.tsx:174`): `sets the foot of every block on whole pixels` **passa** (ver desvio declarado 1).
  - `gap-(--row-gap)` no lugar de `--section-gap` (`Tree.tsx:128`): falha (4 contra 24).
  - o grupo do épico sem `ml-(--epic-indent)`: falha (0 contra 16); a guia de volta a `left: --guide-x`: falha (a guia passa por baixo da linha, 40 contra 24).
  - sem a regra `[data-leaving] > .aux-panel` ou sem `.toast[data-leaving]` em `globals.css`, `PanelLayout` sem o `Presence`, e o `×` do toast chamando `onDismiss` direto: cada um faz falhar o teste correspondente de `Presence.painted.test.tsx`.
- **A tela montada.** Uma página de teste pintada na cópia montou a `Sidebar` real e o `TaskHeader` real com dados falsos (Reviews com 4 pendentes e um review trabalhando, o board `Platform Roadmap` com um clone ausente, o épico `API hardening` com uma task em erro, uma em espera com `+1` e a aberta rodando `go test ./internal/ratelimit/... -run TestBucket`, uma PR antes da primeira leitura, uma discussão, o board `Billing` com leitura falha e vazio, e No board com uma task pausada e uma ociosa), a 1250 e 2560 px, aberta e recolhida, claro e escuro, medindo cada caixa. A mesma página rodou contra `64fd7cd` (antes da PR). Os mocks foram capturados a 1250 e 2560 px nos dois temas, pelo Playwright, em `file://`. Nenhum servidor foi aberto.
- **Contraste**, calculado dos OKLCH de `tokens.css` com o véu composto em srgb: `--ink-4` sobre `--veil-press` na lateral, 4,36 (claro) e 5,47 (escuro); `--ink-3` sobre o mesmo véu, 5,18 e 6,82.

## As 17 divergências

| # | Estado | Evidência |
|---|---|---|
| 1 | Corrigida | Nas capturas da faixa a 1250 e 2560 px, o fundo do glifo fica de 1,5 a 3,2 px acima do pé em todo bloco (antes, de 4,8 a 6,5 px dentro dele). Todo `top` do pé é inteiro. Sobre o meio pixel, ver o desvio declarado 1 |
| 2 | Corrigida | `nodeStatus` (`sidebar-tree.ts:1041`) segue a mesma ordem que `NodeStatus` desenha (falha, leitura, pendentes), e os testes pedem `Reviews, 4 pending` e `… read failed: <razão>` pelo nome |
| 3 | Corrigida, com um resto | `Tree.tsx:128`, com a prova pintada. Ver R2 |
| 4 | Corrigida | `Tree.tsx:150`: a caixa começa depois da guia e a guia fica à vista ao lado da linha aberta e do trilho de erro, como no mock (captura comparada com `08/index.html:506–507`) |
| 5 | Corrigida | `cutPath` (`sidebar-tree.ts:625`); a linha 3 diz `Running go test …/ratelimit`, e `go vet ./...` fica inteiro |
| 6 | Corrigida | `FLASH_MS = 2 × DURATION_SLOW_MS` (`lib/situations.ts:16–22`), com um teste que lê `--duration-slow` de `tokens.css`; a aba usa as mesmas duas vezes (`globals.css:290`) |
| 7 | Corrigida | `PR review · checking GitHub` com `Shimmer` antes do primeiro `checkedAt` (`sidebar-tree.ts:532–545`, `TreeRow.tsx:180`). Ver R6 |
| 8 | Corrigida | `IconButton` com `ICONS.trash` e o tooltip (`TaskHeader.tsx:71–76`) |
| 9 | Corrigida | O tooltip diz o nome e depois a descrição (`AuxPanel.tsx:28`) |
| 10 | **Corrigida com uma regressão grave** | O painel e o toast saem com a animação e a curva certas. Mas o `Presence` espera toda animação da subárvore, e um laço nunca termina: ver R1 |
| 11 | Corrigida | Os sete símbolos saíram, com os testes deles; nenhum código morto novo (`openIdOf`, `reviewsOf`, `stageName`, `asPlaceKind` e os exports de `features/sidebar/sessions.ts` têm leitores) |
| 12 | Corrigida na árvore e na faixa, com um resto | `FAINT` (`TreeRow.tsx:52`), a palavra do bloco (`SidebarRail.tsx:194`) e a contagem do nó (`TreeNodeRow.tsx:77`). Ver R3 |
| 13 | Corrigida | `basis-(--notice-detail-min)`, com o token em `tokens.css` e em `components.md`. Ver o desvio declarado 2 |
| 14 | Corrigida | Verbo em `--ink-3` e alvo em `--ink-4` na linha 3; `Change path ↵` em `--brand-ink`; o aviso em `--text-ui`; o vazio na coluna do texto, com o padding exato de `.sb-empty` |
| 15 | Corrigida | O épico é texto no menu, e o nome do `…` (`Show the hidden levels: …`) o diz ao leitor. Ver R7 |
| 16 | Corrigida | `sessions.ts` mora em `features/sidebar/`, e `workingSession` recebe o `now` |
| 17 | Corrigida | `MoreBelow.tsx:16–25` conta a linha cortada; na captura a 1250 px, a task pausada cortada aparece como `↓ 1 more below` |

## Os desvios declarados

1. **O meio pixel da divergência 1.** A crítica anterior mediu no Chromium, não no WebKitGTK; atribuir o defeito ao WebKitGTK não tem base. A página desta revisão não reproduziu o meio pixel nem no código antigo (`64fd7cd`): com as fontes carregadas ou bloqueadas, a 800 e 900 px de altura, todo `top` da faixa é inteiro nas duas versões, e a fração relatada vinha provavelmente da página daquela revisão. Então o teste de pixel inteiro não prova a correção, e nem precisa: `h-` no lugar de `min-h-` fixa a altura do pé em 18 px, com o texto de 16 px centrado a 1 px, o que é certo por construção, e o teste guarda isso contra uma regressão. **Basta.** Nenhuma prova extra no WebKitGTK é necessária para este item. A varredura da task 12 na máquina alvo cobre o resto.
2. **`--notice-detail-min`.** Aceito. O valor é o `basis-64` de antes (16 rem), escrito em múltiplos de `--space-16` como os tokens de coluna. Está documentado na linha de tokens do aviso (`components.md:435`), e `design/system/tokens.css` já recebeu tokens fora de uma rodada antes (`fa456fa`). Um detalhe: ele está no bloco "Small fixed pieces of content" (`tokens.css:115`), enquanto os outros `calc(var(--space-16) * N)` ficam no bloco de colunas logo acima (`tokens.css:97–111`).
3. **`pending` do nó Reviews em `--ink-3`.** Conforme. `components.md:330` manda a contagem subir de `--ink-4` para `--ink-3` no lugar aberto. O comentário de `--ink-4` (`tokens.css:159–162`) exclui "a pressed veil on the sidebar", e isso cobre o nó pressionado. O mock (`08/index.html:500`, `.node .x`) só desenha o repouso.
4. **A piscada das abas sem tinta estática com movimento reduzido.** Conforme, e é o que a régua pede: "Com `prefers-reduced-motion`, não há piscada. O chip `now` e o anúncio bastam" (`structure.md` §2, Situação nova). A tinta que ficava parada por 1,6 s contrariava a régua.
5. **Nenhum teste pintado da tinta pressionada.** Aceitável. `:active` não se força num teste pintado sem um clique real segurado, e as classes são de uma regra só (`FAINT`, `group-active/block`, `group-active/node`). O teste de jsdom não prova a tinta, mas o par medido acima mostra que `--ink-3` sobre o véu pressionado passa (5,18 e 6,82).

## Divergências que restam, da mais grave para a menos

### Antes do merge

**R1. Um painel fechado com um laço dentro nunca sai: some da vista, mas fica ocupando a coluna.** `whenExitEnds` (`components/system/Presence.tsx:10–11`) espera `getAnimations({ subtree: true })`, e isso inclui qualquer animação em laço dentro do painel. O `finished` de uma animação infinita nunca resolve. O painel toca a saída até `opacity: 0` (`forwards`) e fica montado, `inert`, com a largura dele, até o painel ser reaberto ou o usuário navegar. Provado na cópia, com um `AuxPanel` numa área principal de 1400 px: com o ponto de step trabalhando (`ToneDot tone="working"`, `animate-pulse`, `features/task/StatusDot.tsx:7`), com um `Skeleton` (`animate-pulse`), com `Shimmer` e com o glifo `work`, o painel continua no documento 1,5 s depois de fechar, e a coluna de leitura fica em 1008 px. Só o corpo sem laço sai. O caso é o comum: a lista de steps de **Artifacts** durante a implementação desenha o ponto pulsando (`StepList.tsx:102`, montada em `ArtifactPanel.tsx:268`), e **Artifacts**, **Reports** e **Documents** mostram o esqueleto enquanto leem (`ArtifactPanel.tsx:288`, `ReportsPanel.tsx:111`, `DocumentsPanel.tsx:70`). A partir de 1120 px de área principal, fechar o painel deixa um vão vazio de 360 a 480 px à direita, e o botão já diz `aria-pressed="false"`. Com movimento reduzido não acontece, porque as durações vão a 0. `Presence.painted.test.tsx` não pega o caso porque o painel dele só tem um `<p>`. O toast usa a mesma espera (`Toast.tsx:53`) e hoje não tem laço, mas quebra do mesmo jeito no dia em que tiver. O que mudar: esperar só a animação de saída, a do elemento que a regra de `data-leaving` anima, e não a subárvore, com um teste pintado de um painel com um laço dentro.

### Pode entrar junto da task 3

**R2. O nó de topo tem 4 px a mais sobre o primeiro filho.** O invólucro de seção que a PR criou (`Tree.tsx:135`) é `flex flex-col gap-(--row-gap)`, e o grupo ainda tem `pt-(--space-1)` (`Tree.tsx:160`): são 8 px entre o nó e a primeira linha. O mock tem 4 px, porque `.sec` é um bloco sem gap e só `.grp` tem `padding-top: var(--space-1)` (`08/index.html:485`, `:504`). Medido nas capturas: de Reviews à primeira linha, 36 px na implementação contra 32 no mock. O mesmo excesso aparece sobre `No active items.`. A diferença já existia antes da PR, mas o invólucro novo é o lugar de fechá-la.

**R3. A contagem de History em `--ink-4` sobre o véu pressionado.** `features/sidebar/SidebarFooter.tsx:95` pinta a contagem em `--ink-4` dentro de um botão fantasma que pressiona com `--veil-press` (`components/system/Button.tsx:49`): 4,36:1 no claro, o mesmo par da divergência 12, que o comentário de `tokens.css:159–162` exclui. A PR subiu a tinta na árvore, na faixa e no nó, mas não aqui.

**R4. O trilho de erro da linha e do bloco é um colchete curvo, e o mock desenha uma barra reta.** O mock pinta o trilho como `::before` reto, com `top` e `bottom` recuados em `--space-1-5` e a ponta direita arredondada (`08/index.html:542`; `08` e `10-b` mostram o trilho reto em `Deprecate v1 webhooks`). A implementação usa `inset` box-shadow numa caixa `rounded-md` (`TreeRow.tsx:112–116`, `SidebarRail.tsx:144–147`), e a sombra segue o raio: nas capturas, o trilho de `rate-limit-per-api-key` e o do bloco em erro da faixa são um "(" vermelho. A primeira crítica não apontou isso, então não é regressão desta PR, mas é da lateral, que nenhuma task seguinte reabre.

**R5. O quarto toast tira o mais antigo sem a saída.** `components.md:434` pede a saída em `--duration-fast`. `store/app-store.ts:685–691` corta a lista, e o toast mais antigo some sem tocar a saída. É o único caminho de saída do toast que não passa pela animação.

### Menores

**R6. `checking GitHub` sem as reticências do system.** `components.md:73` e `:316` escrevem `checking GitHub…`; a linha diz `PR review · checking GitHub` (`sidebar-tree.ts:537`), como `structure.md:144`. Pela precedência de `implementation.md:5`, vale `components.md`. Uma das duas réguas precisa se alinhar à outra, e a decisão é do coordenador.

**R7. O nível que não é lugar no menu do breadcrumb é uma forma nova sem registro.** `PlaceHeader.tsx:88–94` monta à mão um `div` de texto em `--text-ui` e `--ink-3` dentro de `MenuContent`. A seção de menu de `components.md` (Select, menu e listbox; Menu do item) não tem essa variante. Ela deveria entrar lá, ou virar uma peça de `Menu.tsx` ao lado de `MenuGroupLabel` e `MenuMessage`.

**R8. O pé dos blocos e os separadores da faixa caem em meio pixel na horizontal.** Com texto de largura ímpar centrado nos 60 px da faixa, `idle` fica em `left` 19,5, `paused` em 9,5, o chip `!2h` em 14,5, a contagem `4` do separador em 26,5 e o fio da direita em 37,5 (medido a 1250 e 2560 px, nas duas versões). O pronto 11 da task 2 diz "sem meio pixel", e a primeira crítica só mediu na vertical. Isto é opinião quanto ao peso: no Chromium não se vê. Fica para a varredura da task 12 na máquina alvo, onde o WebKitGTK pode borrar o texto.

## O que está conforme e merece registro

- As provas pintadas novas pegam o defeito que dizem pegar: toda mutação da correção, fora a do meio pixel, derruba o teste certo nos dois temas.
- A faixa, a árvore e o cabeçalho a 1250 e 2560 px, claro e escuro, batem com o mock no que a PR tocou: seções separadas, a caixa do épico depois da guia, o verbo e o alvo da linha 3, o aviso de clone, o vazio na coluna do texto, `↓ 1 more below` com a linha cortada, sem rolagem lateral.
- `docs/product/features.md`, `docs/architecture/design-system.md` e `overview.md` descrevem o estado novo, sem histórico.

## Veredito

**Corrigir antes do merge.** As 17 divergências estão corrigidas de fato, e as provas pintadas foram conferidas por mutação. Mas a divergência 10 trouxe uma regressão que a task 2 não tinha: fechar **Artifacts** com um step trabalhando, ou qualquer painel enquanto ele lê, deixa um vão invisível do tamanho do painel ao lado da conversa até a próxima navegação (R1). É um caso comum e está no shell, então entra nesta PR, com um teste pintado de um painel com um laço dentro. R2 a R5 podem entrar agora, com pouco custo, ou junto da task 3. R6 a R8 são registro.
