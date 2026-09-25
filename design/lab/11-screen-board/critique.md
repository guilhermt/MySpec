# Crítica · 11 · Home, o board e a criação de task

Rodada da fase 4, segunda tela. Réguas: `decisions.md` (a tela é mínima, 2026-09-24, vale para toda tela), `brief.md` §3, §4 J2 e J7, §5 e §7, `structure.md` §1, §3, §4, §5 e §7, `principles.md`, `system/components.md`, `screens/task.md` para a coerência, `research/board.md` e `docs/product/features.md` (Boards, Visão do board, Start task, Criação de uma task, A partir de um card).

Como foi olhado: a lab servida na porta 8093; as doze cenas de `a.html` e `b.html` nos dois modos a 1250 e a 2500 px (96 capturas), `?home=none` nos dois modos, `a` e `b` com o card aberto a 1100 e a 1600 px, e `components.html` inteiro a 2500 px. `?audit` rodado em `board`, `card`, `select`, `create-card` e `home`, nas duas variações e nos dois modos: nenhum achado (geometria, corte, nomes, contraste, rolagem lateral). O contraste foi medido a partir dos tokens em `system/tokens.css`, não estimado (tabela no fim). Onde a régua não cobre, está escrito **opinião**.

Quase tudo é comum às duas variações. Os problemas comuns vêm primeiro, depois os de cada variação, em ordem de gravidade.

## Comum às duas

1. **O caminho diário da discussão foi enterrado no `⋯`.** O J7 é "1 por dia" (`brief.md` §4), e 10 das 11 discussões começaram sem card (`research/board.md` §4, citado no próprio README). A proposta tira **New discussion** do cabeçalho e o põe no `⋯` do board (`src/shell.js:199-203`). O `D` só age num card com o foco (`src/shell.js:480`), então não existe caminho de teclado para uma discussão sem card. Ao mesmo tempo, **Select**, que abre um modo que nunca foi usado (0 de 11 discussões com vários cards), fica visível na barra de filtros (`src/shell.js:237`). A régua mínima pede que cada elemento se justifique. Aqui a justificativa está invertida: o botão visível serve o caso nunca usado, e o `⋯` esconde o caso diário. A mudança 1 do README, "`structure.md` §4: o cabeçalho perde **New discussion**", não é aceitável como está. Na melhor das hipóteses, é uma pergunta para o usuário.
2. **O **New discussion** da Home não tem comportamento.** O clique só dá um aviso (`src/shell.js:408`), e o README (item 6 de "Onde a proposta toca") empurra a escolha do board para a rodada da discussão, que é a quarta tela. A Home é implementada antes dela. Enquanto isso, a Home oferece uma ação que não funciona com três boards. `research/board.md` §3.3 já apontava a lacuna. A rodada precisa decidir agora: um menu com os boards, ou ir ao board.
3. **As teclas da linha somem justamente onde a escolha é menos óbvia.** `S start · D discuss` mora na coluna da task (`src/shell.js:104-110`). Num card com task ou `In discussion`, a coluna mostra a task e as teclas não aparecem. Um card `In discussion` sem task aceita `S`, mas o foco não o diz. Um card com task aceita `D`, e também não o diz. Isso fere o princípio 9 ("o atalho está escrito ao lado da ação"). Um card com task e em discussão ao mesmo tempo perde o `In discussion`.
4. **Um `S` que não faz nada fica mudo.** Com o foco num card `has_task`, `other_board`, `clone_missing` ou fechado, o `S` é ignorado sem nenhum retorno (`src/shell.js:374-379`, sem ramo para esses casos). O `Space` num card que não pode ser marcado diz por quê (`src/shell.js:478`), e o `S` deveria fazer o mesmo.
5. **A dependência na linha mostra só a primeira.** `COLS.dep` usa `u[0]` sem `+N` (`src/shell.js:103`). O real tem até 3 por card. Um `◇ #461` que esconde uma segunda dependência engana na hora de escolher.
6. **A barra da seleção é tingida de identidade.** `.selbar` usa `--brand-tint-plane` com `--brand-marker-ring` (`src/board.css:64`). O princípio 2 lista os papéis do azul "e só estes", e uma faixa de modo não está entre eles. O efeito é ruim: **Discuss 3 cards**, o único primário, fica azul sobre azul e perde a força que o princípio 2 lhe dá.
7. **"Review of each step" contra "Review mode".** O diálogo renomeia o campo (`src/shell.js:318`), mas a tela da task chama a mesma coisa de **Review mode** no `⋯` e no popover (`screens/task.md` §10), e Settings e `features.md` também. Um conceito com dois nomes em telas vizinhas é uma inconsistência, e o README não lista a mudança.
8. **O resumo do contexto do card não cobre o caso comum.** A linha é montada para um card com épico e uma dependência (`src/shell.js:310`): `CARD[c.epic].t` sem guarda, e `1 dependency` sem plural. O pior é que ela não menciona o documento da discussão, que entra no contexto em 8 das 15 tasks de card (`research/board.md` §4). É justamente o dado que diz ao usuário que o PRD vai partir do entendimento já discutido.
9. **O que o README não lista entre as mudanças de comportamento:**
   - `Couldn't refresh the card` deixa o âmbar e vira `◇` neutro (`components.html`, "context · refresh failed"). A mudança é correta pelo princípio 5, mas não está no item 5;
   - a Home deixa de mostrar o primeiro board quando não há task (`features.md`, "Tela de boas-vindas e barra lateral"). A mudança já foi decidida em `structure.md` §1 e §7, mas `features.md` muda e precisa constar;
   - os novos textos de ajuda (`It names the branch and the worktree.`, `Fixed once the task exists.`).
10. **A falha de leitura diz a mesma coisa duas vezes.** Com a falha, o cabeçalho diz `Read 2h ago` e a faixa, logo abaixo, diz `The list is the reading of 12:10` (`src/shell.js:247`). São dois formatos para o mesmo fato, a 40 px um do outro. O dado que falta é quando a leitura falhou: o README o lista em "Dados que faltam" (`failedAt`), e a faixa não o mostra.
11. **O card fora da leitura tem dois `Close`.** Um fica no aviso (`src/shell.js:150`) e o outro é o `×` do painel (A) ou do card (B). Basta um, e o `×` já existe.
12. **A cena `?home=none` contradiz a si mesma.** A área principal diz `No task, review or discussion is active.` (`src/shell.js:255`), e a árvore ao lado mostra onze itens ativos com situações. O usuário decide olhando, e essa cena mostra um estado impossível.
13. **O subtítulo de **New task** na Home promete o que o clique não faz.** O subtítulo diz `From a card or from scratch` (`src/shell.js:263`), mas o clique abre o diálogo livre (`src/shell.js:409`). Na Home, "from a card" não tem caminho.

Está bem resolvido, e deve ficar como está:
- a linha de uma altura;
- o glifo da gravidade real no lugar do `Waits for you` âmbar;
- a dependência neutra, com `◇`;
- a falha de leitura como faixa afundada e nunca vermelha;
- o card que sai da leitura e fica aberto com o porquê;
- **Clone and continue** com o gerúndio e o diálogo que abre sozinho;
- o diálogo com poucos campos e bons padrões: `Additional context` atrás de **Add to it** (1 de 15 usou), **Models** recolhido com o resumo, o modo e o review com o mesmo controle, a razão ao lado de **Create** desabilitado, e a altura fixa do topo;
- o cabeçalho, coerente com o da task (`←`, o título em `--text-body` 600, as ferramentas à direita);
- a Home, que cumpre `structure.md` §1 sem acrescentar nada e dá o foco ao **Continue**.

## A · Por status

1. **Na metade do monitor, com o card aberto, a linha perde o que decide a escolha.** A 1250 px, o painel deixa a lista com cerca de 500 px. A coluna da task vira só o glifo: `●` para `Question`, `◆` para `Session error`. `In discussion` vira só o ícone, e o épico sai (`a-card-*-1250`, `src/a.css:6`). Em 1600 px, a forma curta mantém a posição e perde o rótulo da situação (`● Step 3/7`, `◆ Plan`). O nome acessível e o tooltip cobrem o princípio 5 no papel. Mas o brief (§2) diz que a metade do monitor é uso real, e é justamente com um card aberto que o usuário compara. O README reconhece a perda. É o maior custo da A.
2. **A escolha começa pelo fim da fila.** A 1250 px, a primeira tela da cena `board` é inteira `Backlog` (27 cards), e `Ready`, onde está o próximo card, fica abaixo da dobra. É a ordem do board e do GitHub, e o recolhimento é lembrado por board (`features.md`), então o custo é de uma vez só. Mesmo assim, a cena de repouso não mostra o caso de quem escolhe. **Opinião:** a cena deveria abrir com `Backlog` recolhido, para o usuário julgar a A no estado em que ele a usaria.
3. **O painel `Card` do board e o painel `Card` da task têm o mesmo nome e regras diferentes.** O do board usa `clamp(22.5rem, 42%, 40rem)` e 440 px de lista (`src/board.css`, `--panel-card-width`). O da task segue `structure.md` §3: 28%, até 480 px, e 760 px de leitura. A diferença tem razão, porque o corpo é lido ali, e o README a lista como a mudança 3. O nome igual para dois comportamentos precisa estar escrito em `structure.md` §3, se a A for escolhida.
4. **O aviso de dependência muda de forma entre as variações.** No painel, `.cd-note` perde o fundo afundado e ganha um contorno `--line-2` (`src/a.css:16`), porque o painel já é afundado. Na B e no espécime, ele é afundado. A razão existe, mas um aviso não pode ter duas formas no mesmo system sem essa razão escrita em `components.md`.

## B · Por épico

1. **A B reabre, sem dizer, o que está registrado.** `brief.md` §3 dá ao board "seções por status" e ao épico o papel de agrupar as tasks, na árvore. `structure.md` §4 diz "Abaixo, os filtros, as seções por status e os cards", e `features.md` diz "Lista de cards agrupada por status". O README afirma que "nenhuma decisão de `decisions.md` é reaberta", o que é verdade. Mas a lista de "Onde a proposta toca o que está registrado" não inclui essa troca, que é a maior mudança da rodada. Ela precisa estar na lista, como escolha do usuário.
2. **Quem escolhe o próximo card procura um status, e a B o espalha.** Os cards `Ready` ficam repartidos entre todos os grupos: em `API hardening` depois de três `Backlog`, em `Usage-based billing` depois de quatro, e em `No epic` depois de 20 (`b-board-*`). Para ver o que está pronto, o usuário varre todos os grupos, ou usa o filtro de status, que custa três cliques no menu **Filter**. O status aparece só no primeiro card de cada sequência (`src/b.js:16-18`), então, rolando pelo meio de um grupo, o status não está à vista. No real, 31 dos 46 cards abertos não têm épico: a maior parte da lista fica sob `No epic`, que abaixo da dobra a 1250 px (`b-board-*-1250`, y ≈ 700).
3. **O card no lugar quebra a árvore acessível.** `inlineCard` insere um `role="region"` com botões dentro do `role="tree"` (`src/b.js:20-28`, montado em `rowOrCard`, linha 17). Um `tree` só pode possuir `treeitem` e `group`, e um leitor de tela em modo de navegação da árvore pode pular o card inteiro ou anunciá-lo fora de ordem (WCAG 4.1.2). O card precisa sair do `tree`, ou a lista precisa deixar de ser `tree`.
4. **O cabeçalho do épico faz duas coisas diferentes conforme o ponto do clique.** Clicar no nome abre o card do épico, e clicar em outro ponto do cabeçalho recolhe o grupo (`src/b.js:70-78`). Nada na forma separa os dois alvos, a não ser o sublinhado no hover. No teclado, `Enter` abre o card e deixa de recolher, ao contrário dos nós da árvore e das seções da A. O `S` não age no cabeçalho, porque ele não tem `data-card` (`src/shell.js:465`, `:479`), então um épico não começa uma task pelo teclado. Na A, o épico é uma linha, e o `S` age nele.
5. **Um card aberto ocupa quase uma tela.** A 1250 × 1000, com o corte de 14 linhas, o card de #474 vai de y ≈ 500 até além da dobra (`b-card-*-1250`), e a coluna da direita, com seis cards do épico e a dependência, é tão alta quanto o corpo. Comparar dois cards pede fechar um e abrir o outro. A lista de 46 linhas perde o contexto em volta do card aberto. O README reconhece o custo.
6. **A dependência aparece três vezes no card aberto:** `◇ #461` na linha, o aviso `Depends on #461…` e `DEPENDENCIES · #461 … ◇ Not satisfied` na coluna da direita (`b-card-*`). A A repete a mesma coisa duas vezes, no aviso e em `Dependencies` no fim do painel. A régua mínima pede uma vez para o aviso e uma para a relação. A linha já leva o `◇`.
7. **O `×` do card fica no meio do card.** Ele está na barra da coluna esquerda, depois de `acme/api GitHub` (`src/b.js:23-24`), e a 2500 px fica a cerca de 300 px da borda direita do card (`b-card-dark-2500`). O fechar de um objeto fica no canto dele, como no painel da A e nos diálogos.

## Espécime (`components.html`)

1. **Um chip tem dois erros diferentes na mesma rodada.** O filtro de um repositório que saiu é um chip vermelho cheio, sem glifo (`src/components.js:45`). O modelo indisponível é `◇` com a razão no tooltip (`src/components.js:87`), que é o que `components.md` manda ("Chip · Erro: uma escolha que o catálogo não tem mais, com `◇` e o motivo no tooltip"). Um filtro órfão bloqueia sem ser uma situação, e pelo princípio 5 isso é `◇`, nunca vermelho.
2. **Há estados inventados só para completar a matriz**, sem caso no produto:
   - a caixa de seleção "loading" e "error". O erro é só uma borda vermelha, sem glifo nem texto (`src/components.js:37`, `src/board.css:141`), então a cor é o único portador (princípio 5, WCAG 1.4.1);
   - o cabeçalho "error · count unreadable", com um `?` vermelho (`src/components.js:33`);
   - o **Continue** "error · can't open: the task was deleted" (`src/components.js:104`). `structure.md` §1 manda o item que sai para a página que diz o que aconteceu, e o **Continue** não pode apontar para um item apagado.

   Um estado sem caso vira código sem uso. Estes três precisam de um caso real, ou saem.
3. **O **Continue** desabilitado ainda mostra a tecla.** "Disabled · archived meanwhile" mostra `Enter` e o texto `Open in History` (`src/components.js:104`). Se o **Continue** abre o History, ele não está desabilitado. Se está, a tecla sai.
4. **O "card left the reading" do rodapé está desalinhado:** o `◇` fica acima da linha de base do texto, e o texto aparece num corpo maior que o resto do rodapé (`src/components.js:98`, `.stalebox`).
5. **O "escolhido" tem duas formas na mesma tela.** O controle segmentado herdado da rodada 10 marca a opção escolhida com a superfície elevada neutra (`10-screen-task-minimal/src/core.css:322`). Os chips da barra de filtros usam `--brand-tint` (`src/board.css:59`). `components.md`, em "Estados comuns · Active", manda `--brand-tint` num "controle pressionado (painel aberto, opção escolhida)". Os dois aparecem no mesmo diálogo, e o `components.md` precisa resolver qual vale para o segmentado antes de ele entrar no system.
6. O controle segmentado declara `role="radio"` com `aria-selected` além de `aria-checked` (`src/shell.js:316`). `aria-selected` não vale num radio. É uma ninharia, mas vai para o componente.

## Tokens, contraste e larguras

- **Tokens.** Nenhuma cor, duração ou tamanho solto em `board.css`, `a.css` e `b.css`. Os limites de container (920, 620 e 860 px) são literais, com a justificativa no comentário, como na rodada 10. Há três exceções pequenas: `margin-top: round(down, 8vh, 1px)` no diálogo (`src/board.css:236`), sem token; e `style="color:var(--state-error)"` em linha no espécime (`src/components.js:21` e `:104`).
- **Contraste, medido nos tokens (WCAG 2.1):**

| Par | Claro | Escuro |
|---|---|---|
| `--ink-4` sobre `--surface-1` (`#418`, `Read 2m ago`, contagens) | 6,05 | 6,45 |
| `--ink-3` sobre `--surface-1` (épico na linha, subtítulos) | 7,19 | 8,05 |
| `--ink-4` sobre a linha aberta (`--brand-tint-plane`) | 5,26 | 5,54 |
| `--ink-2` sobre `--surface-0` (faixa da falha) | 9,74 | 11,6 |
| `--brand-on` sobre `--brand` (**Start task**, **Create**) | 5,66 | 7,79 |
| `--brand-ink` sobre `--surface-1` (`GitHub`, links) | 6,34 | 9,26 |
| `--state-error` sobre `--surface-1` e `--surface-3` (erro do nome) | 6,02 e 6,11 | 6,74 e 5,94 |
| `--ink-4` sobre `--surface-sidebar` | 5,22 | 6,94 |
| Não texto: `--line-3` (tracejado desabilitado, caixa de seleção) | 3,45 | acima de 3 |
| Não texto: `--brand-ring` da linha aberta | 4,29 | 4,51 |

  Nenhum par abaixo do mínimo. A barra de progresso do épico, com o trilho em `--line-1`, quase some em `0 of 7 finished`. O texto ao lado já diz o número, então isso não é falha de 1.4.11.
- **Nomes acessíveis.** Nenhum controle sem nome (`?audit`). O nome da linha tem tudo o que os cortes tiram (`src/shell.js:114-121`). **Select** tem `aria-label="Select cards"`, que contém o rótulo visível. Os problemas estão no item 3 da B e no item 6 do espécime.
- **Larguras intermediárias.** A 1100 px, a A com o painel corta os títulos com reticências e tooltip, e a lista fica com cerca de 450 px, como o README diz. A B põe o card numa coluna. A 1600 px, a A mantém a lista inteira e a forma curta da task. Nenhuma rolagem horizontal, nada em meio pixel.

## Comparação

- **Escolher o próximo card:** a A junta o `Ready` numa seção. A B o espalha por todos os grupos, e a maioria dos cards cai em `No epic`, que é a lista da A.
- **Ler um card:** a B lê melhor na metade do monitor. A A lê melhor a 2500 px e permite comparar com a lista à vista.
- **Linha com o card aberto:** a A perde a task e o épico abaixo de 620 px de lista. A B mantém a linha inteira, mas empurra a lista para longe.
- **Registro:** a A segue `brief.md` §3, `structure.md` §4 e o vocabulário do GitHub Projects. A B reescreve os três sem listar a mudança.
- **Acessibilidade e teclado:** a A é uma árvore válida, em que o épico é uma linha como as outras. A B põe uma região dentro do `tree`, e o cabeçalho do épico tem dois alvos.

## Recomendação

Discordo da recomendação do designer. **O agrupamento da A, por status, com o card aberto no lugar da B** (o README já admite a combinação: "o card no lugar da B pode ir para ela sem mudar mais nada").

- A régua registrada (`brief.md` §3, `structure.md` §4, `features.md`) dá ao board as seções por status e ao épico o papel na árvore. O argumento da B, "o mesmo modelo da árvore", junta duas tarefas diferentes: a árvore acompanha o que está em curso, e o board escolhe o que começa. Com 31 dos 46 cards sem épico, o ganho do agrupamento por épico cabe no filtro, ou no rótulo do épico na linha que a A já tem.
- O card no lugar resolve o pior defeito da A, a linha reduzida a glifos na metade do monitor, que é uso real (`brief.md` §2). O custo de empurrar a lista é menor que o de perder a task e o épico em todas as linhas. Isso vale se o card sair do `tree` (item 3 da B) e se ele perder a terceira cópia da dependência.
- Se o usuário responder que escolhe por épico, a B fica, com os itens 1 a 4 da B corrigidos.

**Opinião:** o painel da A é melhor a partir de cerca de 1850 px de janela. Uma regra de largura que abrisse o card como painel na janela larga e no lugar na janela estreita seria a melhor das duas, mas duas formas para o mesmo gesto custam coerência. Eu não a proporia agora.

## Veredito

**Pronto para o usuário**, com estas condições antes da chamada:

1. O README lista, entre "Onde a proposta toca o que está registrado", a troca das seções por status pelo agrupamento por épico na B (`brief.md` §3, `structure.md` §4, `features.md`, Visão do board).
2. O lugar de **New discussion** no board vira uma pergunta explícita ao usuário, com o dado de 10 em 11 discussões sem card, ou o botão volta ao cabeçalho como secundário. O **Select** visível na barra entra na mesma pergunta.
3. O **New discussion** da Home ganha comportamento nesta rodada, em vez de ser adiado para a rodada da discussão.
4. A cena `?home=none` mostra a árvore sem itens ativos.

As outras correções (as teclas na linha, o `S` mudo, o `+N` da dependência, a barra da seleção sem identidade, o nome "Review mode", a linha do contexto com a discussão, o `role="region"` fora do `tree` e os estados inventados do espécime) entram na rodada de ajuste depois da escolha, antes de a tela ir para `screens/`.
