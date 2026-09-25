# 02 · Estrutura: estados e larguras do modelo A

Fase 2. Wireframes em escala de cinza.

## O que a rodada explora

O modelo do shell está decidido: é a variação A da rodada 01 (árvore e caminho de volta; ver `design/decisions.md`). Esta rodada não reabre o modelo. Ela faz duas coisas:

1. Leva o modelo a todos os estados que a crítica da rodada 01 cobrou, em qualquer largura entre 1100 e 2600 px.
2. Dentro do modelo, testa duas anatomias diferentes para a linha da árvore e duas organizações da área principal. O usuário observou que o wireframe da rodada 01 ainda se parecia com o app atual. Com duas propostas reais, a escolha seguinte deixa de ser só confirmar a anterior.

| | a · Linha compacta | b · Linha rica |
|---|---|---|
| Linha da árvore | Duas linhas no máximo. O que domina é a gravidade e o tempo; a ação em curso e o contexto ficam numa faixa discreta | Tudo o que a seção 5 do brief pede, por inteiro, em qualquer largura. A linha quebra em vez de truncar |
| Nó recolhido | Um glifo e uma contagem por tom, o mais grave primeiro e nomeado | As contagens por extenso, numa linha própria |
| O que o item pede | Coluna de decisão à direita da conversa, enquanto há o que decidir | Barra de decisão acima do compositor. Os apontamentos são decididos na conversa, no marco do relatório |
| Largura que sobra (≥1900 px) | Fica livre; os painéis auxiliares ancoram quando abertos | Painel `Details` ancorado e aberto: progresso com os steps aninhados, checks pelo nome, fatos da task. O usuário pode fechá-lo |
| `Models` e modo de review | Botões no cabeçalho; na largura estreita passam ao `⋯`, pelo nome | Dentro de `Details`, editáveis, em qualquer largura; também no `⋯` |

As duas páginas usam o mesmo conjunto de dados, denso de propósito, maior que um dia típico, para testar a árvore:

- **Reviews** (4 pendentes): `r1`, com apontamentos a decidir (5 de 9, espera há 34 min); `r2`, publicado e ocioso (a sessão parou depois de 10 min).
- **Platform Roadmap › API hardening**: `t1`, com **duas situações ao mesmo tempo** (pergunta no `Reviewer` há 18 min, permissão no `Implementer` há 4 min); `t7`, com o revisor rodando a passada 2 (`Agent review · pass 2`, turno de 3 min, `go test`, 57% de contexto).
- **Platform Roadmap**: `t3`, com uma pergunta no tech spec (12 min); `d1`, uma discussão com o agente rodando.
- **Mobile App** (última leitura falhou): `t2`, One-Shot em `PR review · waiting for checks` (3 de 5); `t4`, **em encerramento** (PR mergeada, `Ready to close` há 2 h); `t5`, **em erro** (`Step 2 blocked`, worktree suja, há 41 min).
- **No board**: o repositório `acme/infra` **com o clone inexistente** e `t6`, uma **task livre** (sem card) **pausada** no PRD.
- `acme/android` é um repositório **sem clone** (cadastrado pelo board, nunca clonado). Aparece onde bloqueia algo: no card do board (com **Clone**), na Home e no filtro.

## Como abrir

- `a.html` e `b.html`, direto no navegador. Cada página se adapta de verdade quando a janela muda de largura. O selo tracejado no rodapé mostra a largura da janela e a da área principal.
- **Scenes ▴** (canto inferior esquerdo, tracejado) troca os cenários que não cabem num quadro só. **Notes** (canto inferior direito) explica a variação e traz a legenda dos glifos.
- `?open=t1|t7|t3|d1|t2|t4|t5|t6|r1|r2` abre um item.
- `?scene=home`: nada aberto.
- `?scene=loading`: o início do app, antes de o estado chegar.
- `?scene=reading`: o estado local já chegou e o GitHub está sendo lido pela primeira vez.
- `?scene=archived`: o item aberto (`t4`) foi encerrado e arquivado; `?scene=archived&open=r2` mostra um review que terminou porque a PR foi mergeada. Na `t4`, **Close task** leva a esse cenário.
- `?scene=empty`: nenhum item ativo.
- `?scene=welcome`: nada cadastrado.
- `?sb=collapsed`: a lateral recolhida em faixa.
- Lado a lado, cada uma com cerca de 1250 px: `compare.html?a=02-structure-states/a.html&b=02-structure-states/b.html`.

Convenções do wireframe, iguais às da rodada 01, com duas novidades:

- O losango vazado (◇) marca um problema que não pertence a um item: a falha de leitura do board e o clone inexistente. Ele não é uma situação e nunca se confunde com o erro de um item (◆).
- O tempo de espera é um **chip cheio**: é o relógio do usuário. No encerramento, o chip é contornado. O tempo de turno é **texto simples depois de um spinner pequeno**: é o relógio do agente.

## a · Linha compacta

**A ideia.** A árvore como painel de comando que se lê de longe: cada item em duas linhas, com a gravidade e o tempo na frente. Uma lateral estreita a 1100 px ainda mostra os dez itens sem rolar.

- **Linha 1**: tipo, nome e, à direita, o tempo: o chip da situação mais antiga, ou o turno do agente. O `repo#card` aparece só quando a lateral tem largura.
- **Linha 2**: o glifo de gravidade e o que o item pede (`Question · Reviewer`). O selo `+1` aparece quando há mais de uma situação, com as outras no tooltip e no nome acessível. Com o agente rodando, a linha 2 vira a posição (`Step 2/5 · pass 2`), a ação em curso em fonte monoespaçada discreta e o contexto em %. Um traço de 2 px sob a linha mostra o contexto usado. A marca `Ctrl J` fica na linha que o atalho abre.
- **Lateral estreita** (abaixo de ~290 px de lateral): o `repo#card` sai, e os rótulos e a ação passam à forma curta (`Question`, `2/5`, `go test keys`, `plans.ts`).
- **Item aberto**: como na A da rodada 01. Trilha de etapas, barra do step, abas `Implementer` e `Reviewer` com a situação e o tempo de cada uma, a conversa e o compositor. Os apontamentos ficam numa coluna à direita enquanto há o que decidir, com `Next to decide ↓` e `Publish review` desabilitado com a razão.
- **Cabeçalho**: `Review: Agent ▾` e `Models ▾` são botões. Quando a área principal tem menos de ~1020 px, eles vão para o `⋯`, pelo nome e com a explicação, junto de `Back to <etapa>…`, `Discard step` e `Delete task`.

**Contra.** A linha compacta esconde a segunda situação atrás do `+1` e troca o caminho da ação em curso pelo nome do arquivo na largura estreita. A coluna de decisão tira 300 px da conversa justamente na largura estreita. A 2500 px, a área principal ainda tem largura vazia dos dois lados da coluna de leitura.

## b · Linha rica

**A ideia.** Nada que a seção 5 do brief pede fica atrás de um hover, em nenhuma largura. A área principal põe o que o item pede junto de onde o usuário escreve, e usa a largura sobrando com um painel de fatos, em vez de deixá-la vazia.

- **A linha**:
  - O nome, em até duas linhas, e o `repo#card`.
  - A linha de estado: gravidade, o que o item pede e o tempo.
  - Uma linha por situação quando há mais de uma (`Question · Reviewer 18m`, `Permission · Implementer 4m`). Ou, com o agente rodando, a ação em curso e o medidor de contexto. Ou os checks pelo nome, com a PR esperando o GitHub.
  - A posição: as etapas como marcas, a etapa, o step e a passada.
  - As linhas que esperam pelo usuário têm moldura; as outras são planas. Na lateral estreita, o caminho da ação encurta pelo meio (`Running go test …/...`), mas não some.
- **Nó recolhido**: `1 error · 1 to close · 1 on GitHub`, por extenso, numa linha própria.
- **Barra de decisão acima do compositor**, trazida da C:
  - No `r1`: `4 findings to decide`, o progresso, `↑` e `Next ↓` (`Alt+↓`/`Alt+↑`), e `Publish review` desabilitado com `Decide 4 more to publish`.
  - Os cartões ficam na conversa, no marco `Review 1 written`. Os decididos aparecem numa linha, com `Change`.
  - Na `t1`, a barra diz que a outra conversa também espera (`Also waiting in Implementer · Permission 4m · Open Implementer`).
- **`Details`**, trazido da B:
  - Progresso com os steps aninhados, cada um com modelo e modo quando ainda não começou. `Back…` fica em cada etapa de planejamento concluída.
  - Checks pelo nome, com estado e duração.
  - Fatos: repositório (com o aviso de clone), card, épico, branch, worktree, modo de review e `Models` editáveis, e as datas. No review: a PR, os checks da passada, as passadas e um índice dos apontamentos que leva a cada um.
  - A partir de 1900 px, o painel fica ancorado e aberto; fechá-lo é lembrado. Abaixo disso, ele abre sobre a conversa pelo botão `Details`.
  - `Artifacts`, `Card`, `Reports` e `Documents` usam o mesmo lugar, um de cada vez.

**Contra.** A linha rica custa altura. A 1100 px cabem cerca de sete itens, e o item aberto pode ficar abaixo da dobra: a árvore rola até ele ao abrir, mas o que está fora da vista deixa de ser visto de longe. Com o volume do brief (5 a 6 itens), isso passa. Com o volume do mock, já não passa. `Details` aberto por padrão numa janela larga contraria "painéis auxiliares fechados por padrão" (brief, seção 5; entrevista), como se discute abaixo.

### Decisões registradas que a b toca

- **Painéis fechados por padrão.** O usuário disse que usa os painéis de artefatos e de card fechados. `Details` não é nenhum dos dois: é o que hoje está espalhado no cabeçalho (modelos, modo), na trilha e na lista de steps do painel de artefatos. Mesmo assim, é um painel aberto sem pedido. A proposta o abre só a partir de 1900 px, onde ele ocupa largura que ficaria vazia, e lembra quando o usuário o fecha. Se a regra vale para qualquer painel, `Details` fecha por padrão também na janela larga, e o resto da b continua igual.
- **Decidir apontamentos na conversa.** `decisions.md` deixou isso "para avaliar depois, na tela". A b antecipa a barra e os cartões na conversa porque o pedido desta rodada os nomeia. A decisão continua sendo da fase 4, e só depois de desenhar o review da PR da própria task ao lado do review de terceiros (crítica da rodada 01, C6).

## Resposta à crítica da rodada 01

### Toda a rodada

1. **Estados da seção 7 sem lugar.** As duas páginas têm:
   - um item em erro (`t5`, ◆);
   - um em encerramento (`t4`, anel, chip contornado);
   - um pausado (`t6`, `‖ Paused`);
   - um ocioso (`r2`, círculo fino, `Published`, `idle` na b);
   - um esperando o GitHub (`t2`).
   
   Pausado, ocioso e erro têm glifos e rótulos diferentes. Erro de sessão sempre vira a situação `session_error` e aparece como erro, nunca no cinza do ocioso. A ordem por gravidade (erro > espera > encerramento) é a do `Ctrl+J` e a do nó recolhido.
2. **Mais de uma situação no mesmo item.** Na `t1`:
   - na a, a linha mostra a mais grave, depois a mais antiga, com `+1`, e o chip com o tempo da mais antiga;
   - na b, uma linha por situação, cada uma com o seu tempo;
   - nas duas, as abas `Implementer` e `Reviewer` carregam cada uma a sua situação e o seu tempo, e a barra do step diz `Waiting for you in both conversations`;
   - na b, a barra de decisão aponta a outra conversa.
3. **Clone inexistente.** `acme/infra` aparece:
   - no nó `No board`, onde vivem as tasks dele: uma linha na a, um bloco na b, com **Change path**;
   - na Home e na página Repositories das configurações;
   - numa faixa da task `t6`, que diz o que fica bloqueado;
   - no filtro, como `acme/infra · clone missing`.
   
   `acme/android` mostra o outro caso, o repositório sem clone: não bloqueia nada que exista, e aparece onde uma task seria criada (card do board com **Clone**, Home, filtro).
4. **Carregando e item que sumiu.**
   - `?scene=loading`: esqueleto na lateral e `Starting MySpec…`, nunca uma janela em branco.
   - `?scene=reading`: a árvore local completa, com `reading…` nos nós de board e em Reviews, e `PR review · checking GitHub` na `t2`.
   - `?scene=archived`: a área principal diz o que aconteceu (`Haptics on complete was closed and archived`), com o resultado do encerramento. Oferece **Open in History** (a linha nova fica destacada), **Back to Mobile App** e **Next that needs you**.
   - `?scene=archived&open=r2`: o review que terminou pelo merge, sem notificação.
5. **Ação em curso ilegível no estreito.** A a troca para a forma curta (`go test keys`, `plans.ts`). A b encurta o caminho pelo meio e deixa quebrar a linha.
6. **Botão desabilitado parece habilitado.** `.btn:disabled` tem borda tracejada, texto apagado e nenhum preenchimento. A razão fica ao lado (`4 left to decide`, `Decide 4 more to publish`, `No step is left to start`).
7. **`Waiting for checks` na etapa errada.** A `t2` está na etapa **PR review**, com o chip `PR review · waiting for checks`. A linha diz `PR review · checks 3/5` (a) ou `PR review · waiting for checks · 3 of 5` (b), como em `features.md`. A trilha segue `features.md §Voltar e descartar`: a etapa de PR ocupa os três últimos chips.
8. **Rótulo ambíguo na barra do step.** A barra do step mostra só o estado do step (`Agent review · pass 2`, `Blocked`), com os textos de `features.md`. O modo de review da task sai da barra: na a, é o botão `Review: Agent ▾` do cabeçalho; na b, fica em `Details`.
9. **Contraste.** `--ink-4` passou a `#6e6e6e` (cerca de 4,6:1 sobre `#f5f5f5`) e `--ink-3` a `#555555`. O cinza mais claro (`--deco`) só desenha linhas e marcas, nunca texto.

### A

1. **`Models` e modo de review somem a 1250 px.** Na a, ficam no `⋯`, pelo nome, com uma linha de explicação e o popover de cada um (etapas com modelo, as já começadas travadas; modo com o que a troca afeta). Na b, ficam em `Details` em qualquer largura, e também no `⋯`. Os dois foram exercitados na página a 1250 px.
2. **O nó recolhido perde a gravidade.** O resumo conta por tom, do mais grave ao menos grave: erro, espera, encerramento, agente, GitHub, pausado. O mais grave vem primeiro e nomeado na a (`◆1 error ●1 ◎1`), e por extenso na b. O nome acessível lista todos.
3. **A faixa recolhida só tem forma.** Cada bloco tem, abaixo do tipo e do glifo:
   - o chip do tempo de espera, ou o turno do agente;
   - na falta dos dois, a palavra do estado (`checks`, `paused`, `idle`).
   
   O nome acessível é o da linha inteira (`?sb=collapsed`). A falha de leitura do board e o clone inexistente aparecem como ◇ no separador do grupo. A faixa segue a ordem da árvore, não a de urgência: mantém a memória espacial, e a urgência já está no `Ctrl+J`.
4. **Voltar a uma etapa numa task em implementação.** Os chips concluídos de planejamento são botões com `Back to <etapa>…`, que diz o que se perde. O chip atual de planejamento tem `Discard and restart`. Em task One-Shot, `Planning` tem os dois, como em `features.md`. A ação também está no `⋯` (a) e em `Details` (b). Os chips da implementação e da PR não têm ação, como no produto.
5. **A ordem dentro do nó é a de criação.** Continua sendo a de criação, que é o que dá memória espacial. O `Ctrl+J` segue o produto: abre o primeiro item que espera, fora o que está aberto, por gravidade e depois pela espera mais antiga. A marca fica nessa linha. O segundo mais urgente se distingue pela forma (◆ antes de ● antes de ◎) e pelo chip de tempo. Não há numeração de urgência na árvore.
6. **Tempo de espera e tempo de turno separados só pelo peso.** São formas diferentes: chip cheio (ou contornado no encerramento) contra texto depois de um spinner. O nome acessível e o tooltip dizem `waiting for you` ou `agent working`. O mesmo vale na faixa recolhida.
7. **Setas na árvore: só ↑↓.** A árvore tem `role="tree"` e `treeitem` com `aria-level` e `aria-expanded`, e um só ponto de tabulação (roving tabindex):
   - ↑↓ percorrem os itens visíveis, e `Home`/`End` vão às pontas;
   - → expande um nó ou entra nele;
   - ← recolhe um nó ou sobe ao pai;
   - `Enter` abre.
   
   Exercitado numa cópia de teste.
8. **`Enter` em Home.** `Continue` recebe o foco ao abrir Home, então `Enter` funciona sem depender do foco no `body`.
9. **O nó `No board`.** Existe, com a task livre `t6` e o aviso do clone de `acme/infra`. Aparece só quando tem algo. O filtro por repositório o respeita: `acme/infra` mostra só ele, e `acme/android` mostra `No tasks in android.`.
10. **Largura vazia a 2500 px.** A a mantém a coluna de leitura centrada e deixa os lados livres, com os painéis ancorando quando abertos. A b ocupa a largura com `Details`. É uma das diferenças que a escolha decide.

## Largura

As duas funcionam de 1100 a 2600 px sem pontos fixos de layout. A lateral é contínua: a vai de 252 a 340 px, b de 300 a 400 px. A área principal usa container queries sobre a própria largura, não sobre a da janela:

- abaixo de ~1020 px, as ferramentas secundárias do cabeçalho vão para o `⋯` e os rótulos longos dos botões encurtam;
- abaixo de ~900 px, o breadcrumb fica só com o item.

A linha da árvore reage à largura da lateral. Os painéis ancoram a partir de 1900 px de janela e se sobrepõem abaixo disso.

## Recomendação

**A linha da a com a área principal da b.** As duas diferenças são independentes, e a melhor resposta está em lugares diferentes:

- **Linha compacta.** A árvore é o mecanismo de "depende de mim" (brief, seção 5). O que ela precisa, antes de tudo, é mostrar todos os itens com gravidade e tempo de uma vez, também na metade do monitor. A linha rica mostra mais de cada item, mas a 1100–1250 px empurra itens para fora da vista, e isso quebra a seção 5 com o volume do mock. O que a linha rica acrescenta (as situações uma a uma, os checks pelo nome, a posição completa) está a um clique, no item aberto e em `Details`, que é onde o brief põe "pode esperar um clique".
- **Barra de decisão e `Details`.** A barra acima do compositor mantém a decisão à vista na largura estreita, sem tirar 300 px da conversa. Ela também resolve a segunda situação da `t1`, que a coluna da a não trata. `Details` junta num lugar só o que hoje está espalhado (modelos, modo de review, trilha com steps, checks, fatos da task). Isso resolve o item 1 da crítica de A em qualquer largura, sem depender de um menu de transbordo, e usa a largura que a 2500 px ficava vazia. Com `Details` fechado por padrão, se o usuário preferir, a combinação não contraria nada registrado.

Se o usuário preferir decidir uma coisa por vez, a ordem é: primeiro a anatomia da linha (a ou b), depois a área principal (coluna ou barra com `Details`). `Details` aberto ou fechado por padrão na janela larga é um terceiro ponto, pequeno.

## Dados que faltam

- **Ação em curso, início do turno e qual conversa trabalha, num item não aberto.** A linha mostra a ação (`Running go test ./internal/keys/...`), o tempo do turno (`3m`) e, na b, quem trabalha (`Working · Reviewer`). O `State` só tem `turnRunning` na sessão que a tela mostra. O backend precisa levar ao resumo do item a última ação `running` (rótulo e alvo), `turnStartedAt` e a sessão (implementador ou revisor). Custo pequeno; já decidido em `decisions.md`.
- **Os checks durante `Waiting for checks`, com estado e duração.** A linha da b, `Details` e o bloco da conversa listam cada check (`build-ios running · 6m so far`). O backend lê a lista completa a cada minuto, mas o DTO só leva `failedChecks[]` depois do review. A duração depende do que o `gh` devolve. Custo pequeno.
- **Os checks lidos antes de uma passada de review** (`Checks at pass 1`, em `Details` do review). O produto os lê e os passa ao prompt, mas não ao DTO. Custo pequeno.
- **Desde quando uma sessão está pausada** (`since yesterday 18:02`). Não é exposto. Custo pequeno, ou sair do mock.
- **O que aconteceu com o item aberto que sumiu.** O estado simplesmente deixa de ter o item. O frontend deduz sem backend:
  - arquivado, quando o id aparece em `history[]`, `reviewHistory[]` ou `discussionHistory[]`, com o desfecho e, na task, o resultado do encerramento guardado;
  - apagado, quando o id não está em lugar nenhum.
  
  É preciso confirmar que `ArchivedTask` traz o resultado do encerramento. O levantamento (`journeys §4.7`) não achou esse campo no DTO.
- **Último item aberto e histórico de navegação.** Home com `Continue` e ← → não existem no produto. São estado do frontend, a persistir entre execuções. Já estava na rodada 01.
- **Recolhido na árvore e `Details` fechado.** O recolhido já é lembrado entre execuções. `Details` fechado seria mais uma preferência do frontend.

Deriváveis no frontend, sem backend:

- o número de situações e a mais grave (`situations[]`);
- a ordem do `Ctrl+J` (`startedAt`);
- as contagens do nó recolhido;
- ocioso contra pausado (`processRunning` e `sessionStatus`);
- as marcas de etapa e os steps com commit e relatórios (`steps[]`);
- `checkedAt`;
- a fase de leitura do GitHub (`boards[].reading`, `reviewCenter.reading`);
- `publishedAt` do review.

## Atalhos

Os mesmos da rodada 01 (`Ctrl+N`, `Ctrl+J`, `Ctrl+,`, `Alt+←`, `Alt+→`), mais:

- na árvore, ←→ para recolher, expandir e subir ao pai, `Home`/`End` e `Enter`;
- na b, `Alt+↓`/`Alt+↑` entre os apontamentos por decidir.

`Esc` fecha, nesta ordem: o popover, o painel sobreposto e as configurações.

## Decisão

Não foi ao usuário. O coordenador adotou a recomendação do crítico: a linha compacta e a área principal da a, com a barra acima do compositor para tudo o que pede o usuário e `Details` como painel fechado por padrão. A rodada `03-structure-final` consolida isso, com os sete pontos de revisão do crítico, para a aprovação da estrutura.
