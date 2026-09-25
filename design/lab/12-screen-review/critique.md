# Crítica · 12 · O centro de review e a tela de um review

Rodada da fase 4, terceira tela. As réguas usadas foram estas:

- `decisions.md`: a tela é mínima; o board por status com o card em painel; o stepper e as abas mínimas;
- `brief.md` §3, §4 J6, §6, §7 e §10;
- `structure.md` §1, §2, §3 e §7;
- `principles.md`;
- `system/components.md`;
- `screens/task.md` §7, §8, §9 e §10, e `screens/board.md` §3, para a coerência entre telas;
- `research/review.md`, e `research/interview.md` nas respostas sobre o review;
- `docs/product/features.md`, Centro de review.

**Como foi olhado.** A lab foi servida na porta 8117. Foram capturadas as dez cenas de `a.html` e de `b.html`, nos dois modos, a 1250 e a 2500 px (80 capturas). Também foram capturados:

- `findings` a 1100 px nas duas variações;
- `publish` (A) e `findings` (B) a 1800 px com **Details** aberto;
- `list` a 1100 e a 1600 px;
- `start` com `?own`;
- `checks` com o `⋯` aberto;
- `list` com `web#2291` aberta no painel;
- `components.html` inteiro, nos dois modos.

O contraste foi medido, não estimado. Um script por CDP percorreu cada nó de texto visível, compôs a cor sobre o fundo real e calculou a razão WCAG. Ele rodou nas 40 combinações de cena, variação e modo a 1250 px e no espécime. Nenhum texto ficou abaixo de 4,5:1. O mínimo foi 4,81:1 (o `2h` do chip de encerramento no claro); no escuro, 5,36:1 (a tecla `A` num botão). No espécime, os dois `Pass 1` com 1:1 são o brilho do estado carregando, texto recortado pelo gradiente, e não uma falha. Nenhum valor solto de cor, tamanho ou duração nas fontes da rodada, fora `style="margin:0"` em `src/review.js:416`.

Onde a régua não cobre, está escrito **opinião**. As respostas do usuário estão aplicadas: não há review de consulta nem saída sem publicar; não há trecho de diff; a localização abre o GitHub primeiro; a linha é mínima.

## Comum às duas

1. **O passe limpo, o caso mais comum, não foi desenhado.** 8 de 17 passadas são limpas (`research/review.md` §3), e nenhuma cena mostra uma. Pela `features.md` (O relatório e a decisão), o relatório limpo mostra o resumo e `Nothing to change.`, e **Publish review** fica habilitado sem nada a decidir. Nesse caso, a A publicaria um cartão sem cartão de apontamentos antes, e a B um diálogo com `The summary and the verdict`. O caminho é justo o que o usuário faz em metade das vezes: aprovar só com o veredito, às vezes apagando o resumo. Sem essa cena, ele não consegue julgar a diferença mais importante entre as duas publicações.
2. **Os avisos que não são situação ficaram sem lugar.** A barra do item saiu (`screens/task.md` §1). Com ela saíram dois avisos do review que não são situação:
   - `New commits since this pass` (`stalePass`): commits que chegam antes de publicar. O aviso muda o destino dos apontamentos (os que saíram do diff vão para o corpo), e a `features.md` (Publicar) manda o diálogo avisar e oferecer **Review again instead**. Nem o cartão da A (`src/vaparts.js:9-24`) nem o diálogo da B (`src/vbparts.js:12-31`) o mostram;
   - `Couldn't check GitHub` (`checkError`), a falha da leitura de cada minuto. O README (O que ficou fora) diz que é a barra de erro da task (`pr_trouble`, `pr_blocked`). No review, porém, essa falha não é situação: não notifica e não espera ninguém (`features.md`, O review como item). Ela precisa de um lugar próprio, como a barra quieta de `screens/task.md` §7 ou uma linha no bloco dos checks.
3. **A PR do próprio usuário publica só `Comment`, e nenhuma variação trata isso.** A `features.md` (Publicar) diz que numa PR própria o único veredito é **Comment**. `VERDICTS` e `VERDICTS_B` são fixos (`src/vaparts.js:2`, `src/vbparts.js:2`), e a regra de sugestão da A (`src/review.js:94`) sugeriria `Request changes` ou `Approve`, que o GitHub recusa. Falta também um caso de borda: numa PR própria sem resumo e sem apontamento aprovado, a regra "só Approve" colide com a regra "só Comment". A rodada precisa dizer o que acontece.
4. **O modo Apply aparece só no diálogo de início.** O README diz que o ciclo "entra como está, pela barra `Review changes`". Antes dessa barra, porém, há a decisão, e nela a ação muda: **Apply approved** no lugar de **Publish review**, sem o cartão de publicação da A nem o diálogo da B. Uma frase e um estado no espécime da barra bastam, mesmo com o modo nunca usado: a `features.md` (Corrigir a própria pull request) o mantém. Falta também o aviso do **Review again…** quando a última passada não publicada tem decisões (`The decisions and edits of review N will be discarded.`). O `againDialog` (`src/review.js:412-419`) não o tem.
5. **A seção `In review` vem antes de `Pending`** (`src/review.js:52`). É **opinião**, apoiada em `brief.md` §5 e em `screens/board.md` §1. Os reviews ativos já estão na árvore, logo acima, sob **Reviews**. A lista é o lugar de escolher a próxima PR, e o que decide a escolha é `Pending`. Com `In review` primeiro, o topo da lista repete a árvore, e as PRs a escolher descem duas linhas. Se `In review` ficar, que fique depois de `Pending`, ou recolhida como as duas últimas.
6. **A seção com erro, vermelha, reintroduz um estado que o board tirou.** O estado "error · a repository unread" do espécime pinta `3 · 1 unread` de vermelho (`src/components.js:36`). `screens/board.md` (Onde o mock difere) retirou "o cabeçalho de seção com erro", e a regra da rodada diz que a falha de leitura é "nunca vermelha". O estado deve sair do espécime.
7. **A faixa da falha não diz quando a leitura falhou.** Ela diz `Its pull requests are from the reading of 12:10` (`src/review.js:279`). `screens/board.md` §3.8 decidiu outra forma: a idade da lista fica uma vez, no cabeçalho, e a faixa diz quando falhou (`◇ Couldn't read the board · 4m ago`). A faixa de `acme/ios` deveria seguir a do board.
8. **Na linha, `3 new commits` pesa mais que `Never reviewed`.** `.prr .rst.new .t` usa `--ink-1` e peso 500 (`src/review.css:25`). `Never reviewed` fica em `--ink-2`, peso 400. As duas são o mesmo estado, pendente, e nenhuma é situação. Pelo princípio 4, o peso fica para o que espera o usuário. Uma PR sem review no produto não espera, então as duas razões deveriam ter o mesmo peso.
9. **O painel da PR tem dois números que não batem.** Ele diz `3 of 5 passed · 2 running` e `2 still running` (`src/review.js:257`), mas a lista mostra um check `running` e um `queued`. O texto deveria ser `2 still pending`, ou contar só os que rodam.
10. **Numa PR com review, o painel diz o estado duas vezes.** O subtítulo e o bloco do review repetem `Decide findings · pass 1 · 1/3`. Pela régua mínima, basta o bloco.
11. **O espécime tem uma linha quebrada.** "a review exists" (`src/components.js:59`) sai sem a grade do painel: `Review of web#2291`, o botão e o estado ficam colados. Na página, com `?open=web%232291`, o bloco está certo. O defeito é só do espécime, mas o espécime é a referência da implementação.
12. **Dois detalhes menores:**
    - os diálogos de publicação e de **Review again** ficam a `12vh` do topo (`src/review.css:108`), e o diálogo largo do board fica a `8vh` (`screens/board.md` §4.1). Um diálogo do sistema deveria ter uma altura só;
    - o ícone do VS Code ao lado da localização é um triângulo irreconhecível, mesmo com o nome acessível certo. Os comentários das fontes ainda falam em "the lines of the diff" e em "(it opens the editor)" (`src/vb.js:6`, `src/review.css:67`). São restos da proposta anterior, que confundem quem implementa.

**Está bem resolvido, e deve ficar como está.**

- A linha mínima (referência, título, autor e o estado que importa), com `R` e `O`.
- O painel do board com os checks pelo nome, e o "a primeira passada espera" no painel e no diálogo.
- O diálogo de início com um campo visível e o resto a um clique.
- A espera dos checks sem compositor e sem barra, com os checks pelo nome e `checked 40s ago`.
- O marco `Checks read before pass 1`.
- O marco `3 new commits · by rsouza`, que abre os commits.
- A barra `New commits` com os checks e **Review again…**.
- A página do review que saiu.
- A pílula única no lugar do stepper.
- **Review again**, **Open in VS Code** e **Delete review** no `⋯`, como na task.

## A · Cartões na conversa

1. **O veredito pré-marcado é a coisa mais importante do cartão, e a mais apagada.** O controle segmentado usa a forma escolhida elevada (`--surface-2` com `--shadow-xs`, `10-screen-task-minimal/src/core.css:322`). É exatamente a forma que `screens/board.md` §9 deixou por decidir, contra o `--brand-tint` que o princípio 2 dá a "um controle pressionado ou escolhido: opção". No espécime, "hover · focus", `1 Request changes` escolhido e `2 Approve` em hover ficam quase iguais nos dois modos. O fundo escolhido fica perto de 1,1:1 contra o trilho, e só o peso do texto separa os dois. O risco que o README admite para a A é justo este: o veredito ser aceito sem ser lido. A forma atual o aumenta. A escolhida precisa do `--brand-tint` com anel, como a opção escolhida da B e como a da pergunta.
2. **A sugestão não acompanha as decisões depois que o cartão nasce.** `S.verdict = S.verdict || suggested()` (`src/review.js:504`) grava a sugestão na primeira vez em que tudo fica decidido. Depois, se o usuário desfaz e descarta os dois aprovados, o veredito continua `Request changes`, e a nota passa a dizer `Your decisions suggested Approve.` O defeito de hoje volta de outra forma: um veredito marcado que não corresponde às decisões. A regra precisa ser escrita: a sugestão segue as decisões até o usuário tocar no veredito, e para de seguir quando ele toca.
3. **O apontamento descartado esconde o texto.** `.fnd.no-go .ft { display: none; }` (`src/review.css:74`) e o título riscado vão contra `structure.md` §3 ("Um cartão decidido mantém o texto legível"). Vão também contra o componente decidido da rodada 10, que mantém o texto em `--ink-2` (`10-screen-task-minimal/src/core.css:193`). É o mesmo componente da PR da task (`screens/task.md` §9), então a mudança o afeta também.
4. **A coerência com `screens/task.md` §9 existe no gesto, mas o componente mudou sem que a mudança fosse registrada.** A §9 diz que o apontamento é "o mesmo componente de apontamento do centro de review". A A o muda em quatro pontos:
   - o título, que é novo;
   - a localização, que abre o GitHub e não o editor;
   - o texto, que passa a ser Markdown renderizado com **Edit**, em vez de editável no lugar;
   - o resumo, que sai do cartão de apontamentos e vai para o cartão de publicação.

   O item 4 e o item 5 de "Mudanças de feature propostas" falam só do centro de review. Se a A for escolhida, `screens/task.md` §9 muda junto, e isso precisa estar escrito. O item mais delicado é o resumo: na PR da task não há publicação, então é preciso decidir onde o resumo fica lá. Há também dois nomes para a mesma barra: `Decide findings · pass 1` aqui e `Findings to decide · PR review · pass 1` na task (§7). Um dos dois deve valer para as duas.
5. **`Ctrl+Enter` publica no GitHub de qualquer lugar da tela** (`src/va.js:24`), o compositor incluído, sem passo de revisão. A publicação continua explícita: a barra diz o veredito e o destino ao lado do botão (`Request changes · 2 inline comments · nothing in the body`), e o clique é deliberado. Isso vale para o clique. Para o atalho global, é **opinião**: `Ctrl+Enter` só deveria publicar com o foco na barra ou no cartão de publicação, porque o erro é irreversível.
6. **O cartão de publicação pisca duas vezes** (`src/va.css:19`), e o README diz "pisca uma vez". Duas vezes é o que o princípio 8 manda. O erro está no README.
7. **`A` e `D` não levam ao próximo apontamento** (`src/va.js:22`, `afterDecide`). O README já recomenda trazer isso da B. Se entrar, entra também na task (§9 e §13), para o gesto continuar um só.

## B · Lista de apontamentos

1. **A B recria um problema que o brief proíbe, ou reabre uma tela decidida.** `brief.md` §10 lista "Dois fluxos parecidos decididos de formas diferentes" entre os problemas que não podem se repetir. `screens/task.md` §9 decidiu que os apontamentos da PR da task são decididos na conversa, "o mesmo componente de apontamento do centro de review". Com a B, ou o produto fica com dois gestos para a mesma decisão, ou a tela da task, já decidida, muda de volta para a coluna. O README não diz qual dos dois.
2. **A coluna não sustenta o texto do apontamento na metade do monitor.** A 1250 px, a coluna tem cerca de 300 px, e o texto aberto fica com uns 25 caracteres por linha. Com a mediana de 650 caracteres, um apontamento vira 25 a 30 linhas de coluna, e **Edit** cai sozinho numa linha. A 1100 px, a conversa fica com cerca de 490 px, abaixo da medida de leitura. O ganho prometido, ler a conversa enquanto decide, some justamente onde o usuário trabalha metade do tempo.
3. **Os apontamentos decididos e os não focados não mostram o texto.** Só o apontamento com o foco abre (`src/vbparts.js:9`). Isso vai contra `structure.md` §3 ("Os cartões: cada um com o número, a localização, o texto editável e o par Approve/Discard"; "um cartão decidido mantém o texto legível"). Para reler o que aprovou antes de publicar, o usuário abre um por um.
4. **Com um painel aberto, os apontamentos somem.** A 1800 px, **Details** cobre a coluna de decisão e não a conversa. Pela regra de `structure.md` §3, o painel cobre a conversa quando não cabe. No mock, abrir **Details** entre cerca de 1450 e 1950 px de janela esconde o que falta decidir, enquanto a barra continua dizendo `1 of 3 decided`.
5. **A barra do pedido fica em duas linhas em toda largura, também a 2500 px.** Com o botão da coluna, **Next to decide**, a razão e **Publish review…**, ela quebra mesmo na medida de 800 px. `screens/task.md` §7 permite quebrar antes de esconder uma ação, mas uma quebra permanente é cromo a mais.
6. **O primeiro foco do diálogo parece uma escolha.** O foco começa no primeiro veredito, `Request changes`, com o anel `--focus` (`src/vbparts.js:15`). A opção escolhida também é azul, com o anel de identidade, então à primeira vista o diálogo parece ter `Request changes` marcado. É o contrário do que a B promete. O foco deveria começar no grupo sem destacar uma opção, ou no primeiro campo depois dele.
7. **Cromo a mais para a régua mínima.** A linha de teclas no pé da coluna (`A approve · D discard · ↑↓ move`, `src/vb.js:17`) repete o que os botões e o tooltip já dizem (princípio 9). O botão que mostra e esconde a coluna existe para esconder uma lista de 2 itens.
8. **O resumo sai da coluna sem que a mudança seja registrada.** `structure.md` §3 põe "o título do relatório e o resumo editável" no topo da coluna. Na B, o resumo só aparece no diálogo, cortado em 150 caracteres (`src/vbparts.js:17`). É uma escolha razoável, mas ela reescreve `structure.md` §3 e não está na lista de mudanças.

## Comparação

- **Coerência.** A A é o gesto da task (§9) e só pede que as mudanças do componente sejam registradas lá. A B reabre a task ou recria o problema de `brief.md` §10.
- **Volume real.** Com a mediana de 2 apontamentos e o texto quase nunca editado, a A cabe numa tela de conversa. A coluna da B gasta 300 a 420 px para listar dois itens e aperta os dois lados na metade do monitor.
- **Publicação.** A B corrige o defeito pela raiz, sem veredito marcado, e cobra um clique a mais em toda publicação. A A corrige pela regra e mantém a publicação explícita na barra, mas hoje marca o veredito com uma forma quase invisível e não o atualiza.
- **Teclado.** A B tem o melhor gesto, que decide e avança. A A pode herdar esse gesto sem herdar a coluna.
- **Escala.** Com 15 apontamentos a B se lê melhor, mas esse caso aconteceu 1 vez em 17 passadas.

## Recomendação

A **A · Cartões na conversa**, como o designer recomenda. As condições são as da seção A e as três primeiras da seção comum. Não é a publicação sem diálogo que decide a favor da A: é a coerência com a tela da task decidida e o volume real. A publicação sem diálogo só é aceitável se o veredito escolhido for impossível de não ver e se ele seguir as decisões até o usuário tocá-lo. Com essas duas correções, ela serve melhor ao usuário que aprova quase sempre e quase não edita. Da B, a A deve levar `A`/`D` avançando ao próximo, e o mesmo gesto deve ir para a task.

## Não pronto

A rodada vai ao usuário depois de quatro correções pequenas no mock. Sem elas, ele julga a A pelo caso raro e com o risco dela escondido:

1. uma cena `clean` nas duas variações, com o passe limpo pronto para publicar e o resumo que se pode tirar;
2. na A, o veredito escolhido com `--brand-tint` e anel, e a sugestão seguindo as decisões até o usuário tocar no veredito (`src/review.js:504`);
3. na A, o texto do apontamento descartado visível, como na rodada 10 (`src/review.css:74`);
4. no espécime, sem a seção com erro vermelha e com o bloco "a review exists" corrigido.

Os itens abaixo ficam para o documento da tela, depois da escolha, sem precisar de novo mock:

- os avisos sem situação (comum 2);
- a PR própria só com `Comment` (comum 3);
- a decisão no modo Apply e o aviso do **Review again…** (comum 4);
- a ordem das seções (comum 5);
- a faixa da falha com `failedAt` (comum 7);
- as mudanças que a A impõe a `screens/task.md` §9, §7 e §13 (A 4).
