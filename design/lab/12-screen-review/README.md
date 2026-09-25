# 12 · O centro de review e a tela de um review

Fase 4, terceira tela. Levantamento em `design/research/review.md`; as respostas do usuário às três perguntas dele estão em `design/research/interview.md` e já estão aplicadas nesta rodada (seção "As três perguntas"). A régua é a das duas telas decididas (`decisions.md`, 2026-09-24): cada elemento justifica por que existe, ou sai.

**O que a rodada resolve.** Como o usuário escolhe uma pull request, inicia o review, espera os checks e a passada, decide os apontamentos e publica; e o que acontece com commits novos e com o merge. O volume é o real: 8 a 9 PRs abertas, 13 reviews em 7 dias, mediana de 2 apontamentos por passada (máximo 15), o texto quase nunca editado, o resumo às vezes apagado para aprovar só com o veredito, Apply e instruções fixas nunca usados.

**A pergunta das variações.** Como os apontamentos são decididos e publicados. A tela é a da task em tudo o mais: o shell, o cabeçalho, a conversa, a barra do pedido e o compositor. A lista de PRs é a do board. Nada de cromo novo além do que as duas telas decididas já têm; a coluna de decisão da B é a de `structure.md` §3.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **A · Cartões na conversa**, nas onze cenas |
| `b.html` | **B · Lista de apontamentos**, nas mesmas onze cenas |
| `components.html` | Os componentes novos ou mudados, em todos os estados, claro e escuro lado a lado. `?only=N` mostra um só |
| `src/` | As fontes. `review.js` e `review.css` são o que as duas têm em comum; `vaparts.js`/`va.*` e `vbparts.js`/`vb.*` são cada variação; `components.*` o espécime. `build.py` gera as páginas |

As páginas são geradas por `python3 design/lab/12-screen-review/src/build.py`. O script lê sem mudança `base.css`, `core.css` e `core.js` (rodadas 08 e 09), `m.css` e `b.css` da rodada 10 (a tela da task decidida, e a pílula do stepper) e `board.css` da rodada 11 (a linha, a seção, o painel e os campos do board decidido). Cada página traz `design/system/tokens.css` byte a byte, e o script confere.

## Como abrir

Sirva a lab (`python3 -m http.server 8090 -d design/lab`) e abra `12-screen-review/a.html` e `b.html`. O seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros:

- `?scene=`: as onze da tabela; o padrão é `findings`;
- `?theme=light` ou `?theme=dark`;
- `?open=<ref>` ou `?open=none` na cena `list` (o painel aberto; o padrão é `api#1302`);
- `?own` na cena `start`: o diálogo de uma PR sua, com o modo;
- `?panel=Details` ou `?panel=Reports` nas cenas do review; `?menu` abre o `⋯`;
- nas cenas `findings`, `publish` e `clean`: `?own` (a PR é sua: só `Comment`), `?stale` (commits depois da passada), `?apply` (o modo Apply) e `?checkerr` (a leitura de cada minuto falhou), combináveis;
- `?audit` e `?clean`.

Tudo age: na lista, as setas, `Enter` (painel), `R` (review), `O` (GitHub), `←` `→` nas seções, o menu **Filter** (autor e label alternam entre ocultar e manter só), **Refresh** e **Try again**; no diálogo, **Add instructions**, o modo e **Start review**; no review, **Approve**/**Discard** e `A`/`D`, `Alt+↓`, **Edit** e `E`, a localização (`O` abre o GitHub, `Ctrl+E` o VS Code), o veredito (`1`–`3`), o resumo, **Publish review** (simula a publicação e leva ao estado publicado), **Review again…**, os painéis e o `⋯`.

## O que é igual nas duas

**A lista (Reviews).** É um lugar, com o nó **Reviews** da árvore marcado como aberto. Segue o padrão da lista do board:

- **O cabeçalho**: `←`, `Reviews`, a idade da lista (`Read 2m ago`, `Reading…`) e **Refresh**.
- **As seções**, no lugar do interruptor **Pending only**: `Pending` (nunca revisadas, ou com commits depois do seu review), `In review` (as PRs com review no MySpec, que a árvore também mostra), `Reviewed` e `Yours and your tasks`. As duas últimas nunca esperam por você e começam recolhidas; o que você recolhe é lembrado. Dentro de cada seção, a ordem do produto (atualizadas primeiro).
- **A linha** tem só o que decide a escolha, como o usuário respondeu: a referência (`web#2291`), o título com `Draft` ou uma label quando há, o autor, e o estado que importa: `Never reviewed`, `3 new commits`, ou o estado do review com o glifo e a posição da árvore (`● Decide findings · pass 1 · 1/3`, `○ Published · changes requested`), `Task · Rate limit per API key`, `Yours`. Sem tamanho, idade nem checks. Na lista estreita (a metade do monitor, ou a lista ao lado do painel), o autor e o estado descem para uma segunda linha, inteiros. `R` aparece na linha com o foco.
- **Os filtros** ficam num menu **Filter** (Board, Repository, Author, Label), como no board; autor e label alternam entre ocultar (`−dependabot`) e manter só (`+rsouza`), e cada filtro ativo vira um chip com `×`. Valem para a lista e para a contagem do nó.
- **A PR abre num painel**, o painel do card do board, sem sair da lista; `R` na linha começa o review direto. Por quê: o painel é o padrão decidido do board e mostra o que a linha não mostra e às vezes decide o momento (os checks pelo nome, que seguram a primeira passada; o card; a descrição); e quem já sabe o que quer não passa por ele. Uma PR com review abre o review (**Open review**); a de uma task abre a task; a de um fork e a de um clone inexistente ficam com **Start review** tracejado e a razão ao lado.
- **A falha de leitura** é a faixa do board, por repositório, nunca vermelha: `◇ Couldn't read acme/ios · 4m ago` e a mensagem do `gh`, com **Try again**; a idade da lista fica uma vez, no cabeçalho. As PRs desse repositório continuam na lista, da leitura anterior.
- **Vazio**: `No open pull requests.` com o que traz PRs e **Read now**; com filtros, `No pull requests match the filters.` e **Clear filters**.

**Iniciar.** `R` ou **Start review** abre o diálogo de início, mínimo: a PR num bloco afundado, o modelo do padrão de review de PR (`Opus 5.5 (1M) · high`, *From Defaults*), e **Start review** `Ctrl ↵`. **Add instructions** abre o campo; numa PR sua, **Mode · Publish** abre a escolha entre Publish e Apply. Com checks rodando, uma linha diz que a primeira passada espera por eles e que você pode sair. Publish é implícito para outros autores.

**O review.** A tela da task, sem stepper:

- **O cabeçalho**: `←`, `Reviews /`, o título da PR e uma pílula só, a do stepper: `Pass 1` e o glifo do estado, com a palavra quando não há barra (`checks 4/6`, `working`, `published`). À direita, o medidor de contexto, **Pause**, os painéis **Details** e **Reports** e o `⋯` (**Open PR**, **Refresh PR**, **Open in VS Code** `Ctrl+E`, **Review again…**, **Delete review…**). A referência e o autor ficam na árvore e em `Details`, como na task.
- **A espera dos checks**: a conversa já tem `Review started` e as suas instruções; embaixo, o bloco dos checks pelo nome (`checked 40s ago`, **Refresh**) e o que falta para a primeira passada. Sem compositor e sem barra: é o GitHub trabalhando.
- **A passada**: a conversa da task, com o grupo vivo e **Stop**; a linha da árvore com a ação e o contexto.
- **O relatório** é um marco (`Review 1 written · changes · 3 findings`), que abre no lugar.
- **O apontamento** tem título (dado novo), a localização e o texto em Markdown renderizado. **A localização abre a PR no GitHub, em `Files changed`, na linha** (a resposta do usuário), e um botão pequeno ao lado abre o VS Code na linha, na worktree do review. Um apontamento geral diz `General · not on a line of the diff`. Sem trecho do diff. **Edit** (ou `E`) abre o texto para editar, porque quase ninguém edita.
- **O veredito sugerido**, contra o defeito de hoje (`Approve` marcado mesmo com apontamentos aprovados): com algum apontamento aprovado, `Request changes`; sem nenhum, `Approve`. Sem resumo e sem apontamento aprovado, só `Approve` fica habilitado, com a razão. Cada variação usa a regra do seu jeito.
- **Publicado**: as decisões e a publicação entram na conversa como marcos (`You decided · 2 approved, 1 discarded`, `Published pass 1 · Request changes · 2 inline comments` com o link), e a pílula diz `published`.
- **Commits novos**: a barra tingida `New commits · 3 since pass 1`, com os checks e o conflito, e **Review again…**, que abre o diálogo curto do produto (instruções atrás de **Add instructions**). O marco `3 new commits · by rsouza` abre a lista dos commits: é o que mudou.
- **O merge com a tela aberta**: a página do item que saiu (`structure.md` §1): `web#2291 was merged, and its review ended`, quem fez o merge e quando, o resultado de cada passada, e **Next that needs you** `Ctrl J`, **Open in History** e **Back to Reviews**. A árvore já não tem o review.

## A · Cartões na conversa

**O modelo é o da task (`screens/task.md` §9).** O relatório é um marco, e os apontamentos são um cartão neutro na conversa logo depois dele, com a barra do pedido como barra de decisão: `Decide findings · pass 1` · `1 of 3 decided` · **Next to decide** `Alt ↓` · **Publish review** tracejado com `Decide 2 more`. `A` e `D` decidem o apontamento em foco; um segundo clique desfaz.

**A publicação é um segundo cartão**, que nasce no fim da conversa quando tudo está decidido, e pisca duas vezes (princípio 8): o veredito marcado com a cor de uma escolha (`--brand-tint` com anel), sugerido pelas decisões e **recalculado a cada decisão até você tocar num veredito**, a partir daí seu (`1 Request changes`, `2 Approve`, `3 Comment`, com as teclas e a razão da sugestão), o que vai para o GitHub (apontamento por apontamento: `Inline comment`, `In the review body`, `Discarded · not published`) e o resumo num campo aberto, com **Leave it out** para publicar sem ele. A barra passa a `Ready to publish` · `Request changes · 2 inline comments` e tem **Publish review**, a única primária; `Ctrl+Enter` publica só com o foco no cartão ou na barra. `A` e `D` decidem e levam o foco ao próximo por decidir. Sem diálogo. O cartão tem o conteúdo, a barra tem a ação (princípio 7).

**O que ela tenta:** um fluxo só no produto. Os apontamentos da PR da task já são decididos assim; o review de terceiros vira o mesmo gesto, o mesmo componente e a mesma barra. Com 2 apontamentos, tudo cabe numa tela de conversa, e a publicação é um passo a mais no mesmo lugar, sem uma camada por cima.

## B · Lista de apontamentos

**O modelo é o da coluna de decisão.** A conversa fica quieta: a sessão do agente e os marcos de uma linha, sem cartões. Os apontamentos vivem na coluna de decisão à direita (`structure.md` §3, `--decision-width`), um por linha: o número, a marca da decisão (círculo, visto, ×), o título e a localização curta. O apontamento com o foco se abre no lugar: a localização, o texto, **Approve** `A`, **Discard** `D` e **Edit**. `A` e `D` decidem **e levam o foco ao próximo por decidir**; `↑` `↓` percorrem; `Alt+↓` vai ao próximo por decidir de qualquer lugar. A barra tem **Next to decide**, o botão que mostra e esconde a coluna, e **Publish review…**.

**A publicação é um diálogo mínimo**, com o veredito como escolha explícita: os três vereditos como opções de pergunta (`1`–`3`, cada um com o que faz), **nenhum marcado**, e **Publish** tracejado com `Choose a verdict` até a escolha; o botão diz o escolhido (`Publish · Request changes`). O resumo é opcional: **Include the summary**, marcado, com o começo do texto e **Edit**. O que vai para o GitHub fica numa linha afundada.

**O que ela tenta:** decidir pelo teclado, sem rolar a conversa, e ler a conversa inteira enquanto decide. Escala melhor quando a passada tem 15 apontamentos. O veredito nunca vem escolhido: o defeito de hoje some porque não há padrão nenhum.

## As cenas

| Cena | O que mostra | A · Cartões | B · Lista |
|---|---|---|---|
| `list` | A lista de 9 PRs, `api#1302` aberta no painel com os checks pelo nome | Igual nas duas | Igual |
| `list-empty` | Nenhuma PR aberta; a árvore com `No review in progress.` | Igual | Igual |
| `list-failed` | `acme/ios` não foi lido: a faixa e `ios#312` da leitura anterior | Igual | Igual |
| `start` | O diálogo de início de `api#1302`, com os checks rodando | Igual (`?own` com o modo) | Igual |
| `checks` | O review espera os checks: as instruções e os checks pelo nome | Igual | Igual |
| `pass` | A passada rodando, com **Stop** e a ação na árvore | Igual | Igual |
| `findings` | `1 of 3 decided`, o foco no apontamento 2 | O cartão na conversa | A coluna ao lado |
| `publish` | Tudo decidido, pronto para publicar | O cartão de publicação, com `Request changes` sugerido | O diálogo, sem veredito escolhido |
| `clean` | Uma passada limpa, o caso mais comum (8 de 17): pronta para publicar sem apontamentos | O relatório `clean` e só o cartão de publicação, com `Approve` sugerido e o resumo que se pode tirar | O diálogo, sem veredito escolhido, com `A clean pass · the summary and the verdict` |
| `again` | Publicado às 13:41, 3 commits novos às 15:02 | Os marcos e **Review again…** | Igual |
| `merged` | `web#2291` mergeada com a tela aberta | A página do item que saiu | Igual |

## As três perguntas do levantamento

Respondidas pelo usuário e registradas em `design/research/interview.md`. As respostas estão aplicadas nas duas variações.

1. **Review de consulta.** Todo review é publicado; um review de consulta não deixa de esperar pelo usuário. A proposta de uma saída sem publicar (**Skip publishing**) saiu da rodada, e nenhuma mudança de feature foi proposta nesse ponto.
2. **Onde ele olha o código.** No GitHub (`Files changed`), às vezes só pelo texto. O apontamento não traz trecho do diff; a localização abre o GitHub na linha certa como ação primária (`O`), e o VS Code fica como segunda (`Ctrl+E`).
3. **O que o faz escolher uma PR.** Nada especial. A linha fica mínima: referência, título, autor e o estado que importa, sem tamanho, idade ou checks. Os checks pelo nome ficam no painel e no diálogo, onde dizem se a primeira passada vai esperar.

## O que ficou fora, e por quê

| Ficou fora | Por quê |
|---|---|
| O ciclo Apply (aplicar, stage, commit) | Nunca usado. É o ciclo `changes_review` da PR da task, que `screens/task.md` já desenha; entra como está, pela barra `Review changes` |
| Trecho do diff no apontamento | Resposta 2: ele olha no GitHub |
| Tamanho, idade, checks e card na linha | Resposta 3. O card, os checks e a descrição estão no painel |
| Saída sem publicar | Resposta 1 |
| Gravidade do apontamento | Com mediana de 2 apontamentos, a ordem do relatório basta; o título já torna a lista varrível |
| As instruções fixas do repositório no diálogo | Nenhum dos 12 repositórios as usa |
| Um diálogo de confirmação para **Delete review…** | Não muda: é o do produto, no `⋯` |
| `pass_blocked` | É a barra de erro da task (`pr_blocked`), com **Review again**; não muda aqui |

## Componentes novos

Todos em `components.html`, em todos os estados, claro e escuro lado a lado.

| Componente | Estados |
|---|---|
| **Linha de pull request** (a linha de lista do board, com as colunas da PR) | padrão, hover, foco com a tecla, pressionada, aberta, desabilitada (fork), carregando (iniciando o review), erro (não iniciou); e as variantes: review esperando, review em repouso, commits novos, draft, PR de task, sua, estreita |
| **Seção da lista** (a do board) | padrão, hover, foco, pressionada, recolhida, vazia, desabilitada, carregando, erro |
| **Leitura da lista** (idade, **Refresh**, faixa de falha por repositório, primeira leitura, vazio, menu de autor e label com três estados) | lida, lendo, falha, tentando, esqueleto, vazia, filtros sem resultado |
| **Painel da PR** (o painel do card, com a ação, os checks e os fatos da PR) | iniciar, hover, foco, pressionado, esperando os checks, desabilitado (fork, clone inexistente), carregando (clonando), erro (clone falhou), com review, de uma task |
| **Diálogo de início** | padrão, com instruções, esperando os checks, sua PR com o modo, iniciando, desabilitado (PR fechada), erro (worktree) |
| **Pílula do review** (a pílula do stepper, sozinha) | checks, trabalhando, com barra, publicado, foco, pausado, carregando, erro |
| **A · Apontamento no cartão** (com título, localização para o GitHub e o VS Code) | padrão, hover, foco, aprovado, descartado, editando, desabilitado (publicado), salvando, erro |
| **A · Cartão de publicação** | sugerido, hover, foco, outro veredito, resumo de fora, só Approve |
| **A · Barra de decisão** (a barra do pedido) | decidindo, pronto, publicando, falha na publicação |
| **B · Apontamento na lista** (a linha da coluna de decisão) | padrão, hover, foco aberto, pressionado, aprovado, descartado, desabilitado (publicado), salvando, erro |
| **B · Diálogo de publicação** | nada escolhido, escolhido, hover e foco, só Approve, editando o resumo, publicando, falha |
| **Página do review que saiu** | mergeado, fechado sem merge |

**Tokens propostos**, declarados em `review.css` até entrarem em `system/tokens.css`: `--col-ref`, `--col-author` e `--col-state`, as colunas da linha, como `calc()` de tokens de espaço.

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| O título de cada apontamento | O apontamento nas duas variações e a lista da B | Pequeno: o formato do relatório descarta o título depois de `### N`; o prompt pede um título e o parser o guarda |
| Os checks pelo nome durante `Waiting for checks` e os lidos antes de cada passada | A espera dos checks, `Details` | Pequeno: o backend já os lê a cada minuto (`structure.md` §8) |
| Os checks pelo nome de uma PR sem review | O painel da PR e a linha do diálogo de início | Pequeno: um campo na query GraphQL da lista |
| A descrição da PR | O painel da PR | Pequeno: hoje só entra no `context.md`; expor o `body` da leitura |
| A lista dos commits novos desde a passada (hash e assunto) | O marco `3 new commits` | Pequeno: `git log` entre o commit da passada e o head, que o backend conhece |
| Marcos de decisão e de publicação na conversa | `You decided…`, `Published pass 1…` | Pequeno: tipos novos de marcador, como em `screens/task.md` §15 |
| O seu último review de uma PR revisada (estado e data) | O painel (`You approved it today at 10:02`) | Pequeno: a query já lê o último review da conta do `gh` |
| Quem fez o merge e quando | A página do review que saiu | Pequeno: a leitura de cada minuto já vê o merge |
| O link para a linha em `Files changed` | A localização do apontamento | Nenhum: `…/pull/N/files#diff-<sha256 do caminho>R<linha>`, montado no frontend |
| O veredito sugerido (A) | O cartão de publicação | Nenhum: derivado das decisões |

## Mudanças de feature propostas

Nenhuma decisão de `decisions.md` é reaberta. Estes pontos mudam `features.md` (Centro de review) ou `structure.md`, e cada um é uma escolha para o usuário confirmar:

1. **O veredito deixa de vir `Approve` marcado.** Na A, vem sugerido pelas decisões; na B, não vem nenhum. É a correção do defeito.
2. **A publicação:** na A, um cartão na conversa sem diálogo; na B, o diálogo mínimo com a escolha explícita e o resumo opcional.
3. **O painel de apontamentos acima da conversa sai.** Na A, os apontamentos vão para a conversa; na B, para a coluna de decisão.
4. **O apontamento ganha título**, o texto é mostrado renderizado, e a edição acontece só com **Edit** ou `E`.
5. **A localização abre o GitHub na linha**, e o VS Code passa a ser a segunda ação (`Ctrl+E`). Hoje ela abre o editor.
6. **A lista:** as seções `Pending`, `In review`, `Reviewed` e `Yours and your tasks` substituem o interruptor **Pending only**; os filtros ficam num menu **Filter** com chips; a linha perde as labels da segunda linha (uma label fica como etiqueta depois do título, menos quando repete o autor, como `dependabot`), o card, `Reviewed`/`Task` como selos e o ícone **Open on GitHub** (fica no painel e na tecla `O`); a PR abre num painel antes do review, e `R` começa direto.
7. **O diálogo de início** esconde as instruções e o modo atrás de um clique, e diz quando a primeira passada vai esperar os checks.
8. **As decisões e a publicação** passam a ser marcos na conversa.
9. **O cabeçalho do review** leva **Review again**, **Open in VS Code** e **Delete review** para o `⋯`, como a task; `Review again` também aparece na barra quando resolve a situação (commits novos, checks, conflito).
10. **O review que termina com a tela aberta** mostra a página do item que saiu, em vez da área vazia (já pedido em `structure.md` §1).
11. **Teclas novas:** `R` e `O` na lista; `E`, `O` e `Ctrl+E` no apontamento; `1`–`3` no veredito; `Ctrl+Enter` publica. Entram em `structure.md` §5.

## Como foi testado

- Chromium headless, pelo `http.server` da lab numa porta própria, com a Fira do Google Fonts. As capturas foram olhadas cena a cena nos dois modos, a 1250, 1600 e 2560 px, e o espécime seção a seção.
- `?audit` nas onze cenas das duas variações, nos dois modos, a 1100, 1250, 1600 e 2560 px, e as cenas de decisão com `?own&stale`, `?apply` e `?checkerr` a 1100 e 2560 px (224 combinações). A auditoria é a da rodada 10, mais a geometria desta rodada (linhas, seções, lista, painel, diálogo, coluna, apontamentos, cartão de publicação, página do item que saiu) e a regra do board de que o título tem ao menos um terço da linha. Em todas: nenhuma caixa posicionada pelo layout em meio pixel, nenhum texto cortado sem tooltip, nenhum controle sem nome, todo texto com 4,5:1 ou mais sobre o fundo real, nenhuma rolagem horizontal. A pílula do cabeçalho não entra na medida de pixel, como o stepper da rodada 10: ela fica onde o título termina.
- `components.html?audit` nos dois modos: nenhum texto abaixo de 4,5:1 e nenhum controle sem nome.

## Recomendação

**A · Cartões na conversa.**

- **É o mesmo fluxo que a task já decidiu.** `screens/task.md` §9 decide os apontamentos da PR da task num cartão na conversa, com a barra de decisão, e diz que o componente é o mesmo do centro de review. Com a A, o produto tem um gesto só para decidir apontamentos; com a B, dois.
- **O volume é pequeno.** Mediana de 2 apontamentos, 8 de 17 passadas limpas: o cartão cabe na tela, e a coluna da B tira 300 a 420 px da conversa para listar dois itens. Na metade do monitor, a conversa da B fica com cerca de 650 px.
- **A publicação sem diálogo casa com o uso.** O usuário quase não edita e aprova quase sempre; o cartão já vem com o veredito certo e o resumo à vista, e publicar é `Ctrl ↵` na barra. Apagar o resumo, que ele faz, é **Leave it out**, sem abrir nada.
- **Da B, a A já leva o gesto de teclado:** `A` e `D` decidem e levam o foco ao próximo por decidir. O mesmo gesto vai para a task (§9 e §13).

O risco da A, para o usuário julgar: o veredito sugerido pode ser aceito sem ser lido. Por isso ele tem a cor de uma escolha e segue as decisões até você tocá-lo. A B troca isso por um clique a mais em toda publicação. Numa passada com 15 apontamentos, o cartão da A fica longo, e a coluna da B se lê melhor.

## Depois da crítica

`critique.md` pediu quatro correções antes da chamada, e o coordenador pediu mais cinco pontos. Todos estão nas duas variações e no espécime.

1. **A cena `clean`**, nas duas: o relatório limpo, `Nothing to change` no resumo, e a publicação sem apontamentos. Na A, só o cartão de publicação, com `Approve` sugerido, `A clean pass: no finding` e o resumo com **Leave it out**; sem o resumo, a passada leva só o veredito. Na B, o diálogo com `A clean pass · the summary and the verdict`, sem veredito escolhido.
2. **O veredito da A** tem a cor de uma escolha (princípio 2): `--brand-tint` com o anel `--brand-ring` e a tinta `--brand-ink`, como a opção escolhida de uma pergunta e a da B, e não a forma elevada do controle segmentado. A sugestão é recalculada a cada decisão e segue as decisões até você tocar num veredito. A partir daí o veredito é seu, e a nota diz o que as decisões sugerem (`Your choice. Your decisions suggest Approve.`).
3. **O texto do apontamento descartado fica visível**, nas duas, como pede `structure.md` §3. O título desce para `--ink-2`, sem risco.
4. **No espécime**, saiu o cabeçalho de seção vermelho: a seção não tem estado de erro, e a falha de leitura é a faixa. O bloco "a review exists" está corrigido.
5. **O que não é situação, e as regras do GitHub**, nas duas:
   - **commits depois da passada** (`?stale`): uma nota afundada no cartão da A e no diálogo da B, `2 commits arrived after this pass. Findings on lines that left the diff go in the review body.`, com **Review again instead**;
   - **`Couldn't check GitHub`** (`?checkerr`): a faixa de aviso sob o cabeçalho, a de `structure.md` §3 (a do clone inexistente na task), afundada e nunca vermelha, com quando falhou, a razão e **Try again**. Não é situação: não notifica nem pisca, e some na leitura seguinte que der certo;
   - **a PR própria** (`?own`): só `Comment` fica habilitado, com a razão (`Your own pull request: GitHub takes only Comment.`), e a sugestão da A é `Comment`. No caso de borda, a PR própria sem resumo e sem apontamento aprovado, o GitHub não aceita nenhum veredito. **Publish review** fica tracejado, com `Write a summary or approve a finding` ao lado. O "só Approve" nunca vale numa PR própria;
   - **o modo Apply** (`?apply`): a decisão é a mesma, a barra vira `Ready to apply` · `2 approved findings go to the agent` com **Apply approved**, e não há cartão de publicação nem diálogo. Sem nada aprovado, a barra diz `Nothing approved · ready to merge`. Depois vem o ciclo `changes_review` da task;
   - **o aviso do Review again**: com a passada não publicada e alguma decisão, o diálogo diz `The decisions and edits of review 1 will be discarded.`
6. **Na A, `A` e `D` decidem e levam o foco ao próximo por decidir**, o gesto da B.

Também entraram estes pontos da crítica, pequenos:

- `Pending` vem antes de `In review`, porque `In review` repete a árvore;
- `3 new commits` e `Never reviewed` têm o mesmo peso, porque nenhum dos dois é situação;
- o painel diz `2 not finished` para os checks rodando e na fila, e numa PR com review o estado aparece só no bloco do review;
- a faixa de falha diz quando falhou;
- os diálogos do review ficam a `8vh` do topo, como o diálogo largo do board;
- o VS Code ao lado da localização usa o glifo de código `<>`;
- `Ctrl+Enter` publica só com o foco no cartão ou na barra;
- o primeiro foco do diálogo da B é **Cancel**, para nenhum veredito parecer escolhido;
- saíram os comentários das fontes que falavam em trecho de diff.

### O que a A muda no componente de apontamento, para `screens/task.md` §9

O apontamento é o mesmo da PR da task (`screens/task.md` §9). Se a A for escolhida, estas mudanças valem lá também:

1. **Título.** Cada apontamento tem um título em `--text-ui`, peso 600, acima da localização. É um dado novo nos dois relatórios: o do centro de review descarta o título hoje, e o da PR da task já o escreve em negrito.
2. **Localização.** Ela abre a PR no GitHub, em `Files changed`, na linha (`O`). O VS Code na linha, na worktree, é a segunda ação, um botão pequeno ao lado (`Ctrl+E`). Hoje a §9 diz "um link que abre o editor na linha".
3. **Texto.** O Markdown é renderizado, e editar acontece com **Edit** ou `E`, num campo que salva enquanto se digita e fecha com **Done** ou `Esc`. Hoje a §9 diz "o texto editável" no lugar.
4. **Resumo.** Ele sai do cartão de apontamentos. No centro de review, vai para o cartão de publicação. Na PR da task não há publicação: a proposta é o resumo não aparecer no cartão, e ficar no relatório (o marco `Review 1 written`, que abre no lugar, e `Details`), porque lá ele não vai a lugar nenhum.
5. **Decidido.** O texto de um apontamento descartado fica legível, em `--ink-2`, sem risco.
6. **Teclado.** `A` e `D` decidem e levam o foco ao próximo por decidir, também na task (§9 e §13).
7. **Nome da barra.** A barra de decisão se chama `Decide findings · <lugar> · pass N` nas duas telas. A task hoje usa `Findings to decide · PR review · pass 1` (§7); a proposta é unificar em `Decide findings`, o nome que o produto já usa no estado do review.

## Decisão

2026-09-24: a A para mostrar e decidir os apontamentos, e a publicação em diálogo da B. Ver `design/decisions.md`. O documento da tela é `design/screens/review.md`.

## Decisão

**Combinação A + B**, decidida em 2026-09-24. Ver `design/decisions.md`, "Review: cartões na conversa, publicação em diálogo". Os apontamentos vêm da A: cartões na conversa, `A` e `D` que avançam ao próximo, e a barra de decisão. A publicação vem da B: um diálogo mínimo, com o veredito como escolha explícita, sugerido pelas decisões com a etiqueta `Suggested` em `--brand-tint` e nunca pré-marcado, e o resumo opcional. `a.html` mostra a combinação: `Publish review…` na barra abre o diálogo, e as cenas `publish` e `clean` abrem com ele. O cartão de publicação da A e a coluna da B saíram do espécime. O documento da tela é `design/screens/review.md`.
