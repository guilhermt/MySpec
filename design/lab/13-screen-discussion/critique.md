# Crítica · rodada 13, a discussão e os rascunhos

Revisão de 2026-09-24 contra `decisions.md`, `brief.md` (§3, §4 J7, §6, §7), `structure.md`, `principles.md`, `system/components.md` e `tokens.css`, `screens/task.md`, `screens/board.md` e `screens/review.md`, `research/discussion.md`, as respostas sobre a discussão em `research/interview.md`, `docs/product/features.md` (Discussão) e o `README.md` da rodada.

Como foi olhado: `a.html` e `b.html` nas dez cenas, claro e escuro, a 1250 e a 2500 px (80 capturas), mais `publish` com `?freeze`, `start` com `?home`, `drafts` com `?edit`, `done` com `?archive` e `?group`, e `components.html` inteiro. O `?audit` rodou a 1100, 1450 e 1900 px com o painel `Details` aberto, sem nenhum achado. Contraste medido a partir dos tokens (tabela na seção 4). Servidor próprio na porta 8127, encerrado pelo PID ao fim.

A rodada tem muito acerto: o modelo de publicação ao aprovar segue a resposta do usuário, o corpo inteiro está sempre legível, o documento é um marco sem destaque, `Documents` começa fechado, `Epic can't publish` e `Ready to archive` tapam dois buracos reais do produto de hoje, e os tokens estão limpos. Os problemas graves estão todos no mesmo lugar: **o que acontece ao aprovar** e o que a tela diz antes do gesto.

## 1. Comum às duas variações

O modelo é o mesmo em A e B (`src/pub.js`). Estes problemas valem para as duas e estão em ordem de gravidade.

1. **A nota do rascunho mente sobre o gesto que dispara a cadeia.** Na cena `drafts`, o 3 é o segundo card aprovável do épico: aprovar o 3 cria o épico e publica o 2 na hora. A nota ao lado dos botões diz `Waits for the epic once approved`, e o tooltip de **Approve** diz `it publishes when the epic is created` (`pub.js:85` e `:88`). O usuário lê que nada acontece agora e dispara três escritas irreversíveis no GitHub. O texto que precede o gesto é justamente o que a tela deve acertar, porque não há confirmação.
2. **A regra do épico não é a de `features.md` e publica antes da leitura.** `features.md` (Aprovar e publicar): o épico publica quando foi aprovado **e cada rascunho dele foi aprovado ou descartado**, com ao menos dois aprovados. O mock publica no segundo card aprovado, com irmãos ainda sem decisão (`pub.js:15`). O README chama isso de "a regra de hoje" (seção "A publicação"), o que não é: a condição "todos decididos" sumiu. A consequência na cena `drafts` é concreta. O épico, cujo corpo descreve os três cards ("The plan picker showing the tiers…"), vai ao GitHub antes de o usuário ter lido o 4. Se ele descartar o 4 depois, o épico publicado descreve uma entrega que não existe. Isso contradiz a resposta 2 do usuário, que lê tudo antes de aprovar.
3. **`A` avança sozinho, e aprovar é irreversível: dois toques publicam um rascunho não lido.** `A` e `D` decidem e levam o foco ao próximo por decidir (`disc.js:499`, `goNext`). No review isso é seguro, porque a publicação passa por um diálogo com veredito (`screens/review.md` §11). Aqui cada `A` é uma escrita no GitHub. Um `A` repetido, ou um duplo clique em **Approve**, aprova e publica o rascunho seguinte, aberto há zero segundos. O produto de hoje não tem atalho de teclado para aprovar, então o risco é novo e não vem da resposta do usuário. O README não trata disso: o "risco da B" que ele cita é outro, o do rascunho dobrado.
4. **Não existe desfazer depois da publicação, e a tela não diz o que fazer.** "Uma decisão se desfaz com um segundo clique enquanto o rascunho espera". Numa cadeia, porém, o rascunho quase nunca fica esperando: enquanto o anterior publica, os botões ficam tracejados (`pub.js:82`), e o seguinte já entra em seguida. Na prática, aprovar é irreversível também para quem espera. A resposta do usuário aceita publicar na hora e não pede um intervalo de desfazer. Mesmo assim, para aprovar por engano não há nem uma linha no rascunho publicado, nem no marco, dizendo que ele se desfaz fechando a issue no GitHub. A saída do erro não está em lugar nenhum.
5. **Épico descartado com cards aprovados vira um estado morto.** Pelo código, descartar o épico depois de aprovar um card dele deixa o card em `Approved · waits for the epic` para sempre (`pub.js:16`). A situação cai em `publishing` (`pub.js:58` em diante), sem barra e com a pílula `publishing` e o spinner, sem nada rodando. O `⋯` bloqueia o arquivamento com `approved drafts wait to be published` (`pub.js:118`). `features.md` tem a mensagem `The epic is discarded.` para esse card, e ela sumiu. Nenhuma cena mostra o caso.
6. **Estados do produto que não aparecem.** Nenhuma cena ou componente cobre:
   - o artefato de rascunhos ilegível (`Waiting for the drafts`, com a razão na barra);
   - o erro de sessão da discussão com **Retry**, que o README lista em "Dados que faltam" mas não desenha;
   - a discussão que termina sem rascunho;
   - todos descartados;
   - a discussão pausada;
   - os avisos do rascunho: `<repo> is no longer managed by the board.`, a dependência descartada e removida (o `depLinks` continua listando a dependência, `disc.js:197`), o módulo que saiu do board, `This card isn't in the last reading of the board.` e `Refreshing the card…` numa atualização;
   - `Refreshing the cards…` e `Couldn't refresh the cards…` no diálogo de início;
   - a confirmação de **Delete discussion…**, que existe só como tooltip (`disc.js:186`);
   - **muitos itens**: o máximo real é 10 rascunhos, e nenhuma cena passa de 5. É justamente o caso que decide entre A e B.

   `brief.md` §7 pede todos esses estados.
7. **A publicação é dita três vezes, e o toast viola o system.** Cada rascunho publicado gera três coisas:
   - o estado no cartão (`Created billing#479 · 15:10`);
   - um marco por rascunho (`Published Tier limits… · Created billing#479`, com **GitHub**);
   - um toast (`pub.js:30`).

   `components.md` (Toast e aviso) diz para usar o toast para um item que saiu sem estar aberto. Aqui o item está aberto, e o toast também dobra o anúncio do `role="status"` do `Publishing…`. Com cinco rascunhos, a conversa ganha quatro marcos seguidos, logo abaixo do cartão que já diz a mesma coisa (cena `published`). Com dez, seriam dez. O review resolveu isso com **um** marco por publicação (`Published pass 1 · …`). A régua "cada elemento justifica por que existe" não passa aqui.
8. **A reescrita é dita cinco vezes.** São cinco portadores:
   - o marco `Drafts written · … · replaced at 14:32`;
   - o marco `Drafts rewritten · round 1 · 3 changed · your decisions kept on the other 2`;
   - o cabeçalho do cartão, `rewritten at 14:32, replaces the list of 14:27` (`disc.js:267`);
   - a etiqueta `Rewritten` em cada rascunho;
   - a linha `Was "…"`.

   A tarefa e o review decidiram um só portador, o marco `Review 1 revised` (`screens/task.md` §9, `screens/review.md` §9). O vocabulário também diverge: *revised* lá, *rewritten* e *replaced* aqui. A informação útil, isto é, qual rascunho mudou e o que era antes, está na etiqueta e no `Was`. Os dois marcos e o cabeçalho repetem.
9. **As rodadas passadas se contradizem na cena `done`.** A rodada 1 vira o marco `Round 1 · 5 drafts · 4 created, 1 updated · 15:12`, com rótulo diferente de `Drafts written · round 2 · 1 draft` (`pub.js:96`). Esse marco das 15:12 vem **antes** dos marcos de publicação das 15:10 e 15:11: a ordem do tempo quebra. Somando o `Drafts written … replaced` da rodada 1, são dois marcos de lista para a mesma rodada. Além disso, o README não diz **quando** uma rodada publicada vira marco. Na cena `published` ela continua como cartão inteiro, e na `done` já é marco. Falta a regra.
10. **`Epic can't publish` e o bloqueio do arquivamento não dizem a saída.** A saída ("approve a discarded card again, or discard the epic") está só no tooltip de **Show** (`pub.js:110`). O tooltip nunca é o único portador (`components.md`, Tooltip), e a nota do épico diz só `needs two approved cards · 1 of 3`. No `⋯` da cena `archive-blocked`, a razão dada é `approved drafts wait to be published` (`pub.js:118`), quando a causa é o épico. Quem quer arquivar deixando o épico de fora não sabe que precisa desfazer as aprovações do épico e do 2.
11. **O diálogo de agrupar é inalcançável e mostra o impossível.** O item do `⋯` fica desabilitado em toda cena (`needs two loose drafts`, `disc.js:184`, porque só o rascunho 5 é solto). Com `?group`, o diálogo lista `Overage report per workspace for admins` e `Keep current customers…` (`disc.js:408`), que já estão publicados como web#2305 e billing#483, e um rascunho publicado não entra num épico. O componente precisa de um caso que exista.
12. **`Ready to archive` é uma situação nova sem a regra dela.** Ela é encerramento, entra no `Ctrl+J` e na gravidade da árvore, como o `Ready to close` da task. O README não diz se ela notifica e pisca como as outras situações (`structure.md` §2, Situação nova), num caso comum: a cadeia termina com o usuário fora do app. Pelo mesmo critério, a linha da árvore durante `publishing` mostra um medidor de contexto de 24% na linha 3, enquanto o cabeçalho diz 31% (`disc.js:108` e `:173`). E a linha 3 é a ação do agente com o contexto dele (`structure.md` §2), não o trabalho do app.
13. **A edição.**
    - O seletor **Epic** corta `Pricing tiers with metered ove`, sem reticências nem tooltip, e esconde o chevron, a 1250 px (`disc.js:237`, cena `drafts&edit`). Isso viola `principles.md` §10: um texto que corta tem tooltip.
    - **Approve** continua ativo durante a edição, então aprovar publica o que está no meio de ser digitado.
    - O título aparece duas vezes, como cabeçalho e no campo.
14. **Menores.**
    - Diálogo de início: o ícone do board fica a uns 100 px do título, porque `.cardsum .num` foi dimensionado para `#474` (`disc.js:383`).
    - O `−`/`+` do diff tem `aria-label` num `span` sem papel (`disc.js:223`), que os leitores de tela não anunciam de forma confiável. Use texto oculto.
    - O compositor perde a pastilha **Ask for changes** na cena `publish`, com rascunhos ainda por decidir.
    - `SIT.ready` e `Ready to publish` sobraram da variação que saiu (`disc.js`, `SIT`).
    - `round 1` aparece em cinco lugares no caso comum de uma rodada só (pílula, barra, árvore, cabeçalho do cartão, marcos). É consistente com o `Pass 1` do review, mas contraria "nada disso muda a tela com uma rodada só". Isto é opinião.
    - A reescrita mostra `Was` só para o título e a dependência. Quando o agente muda o corpo (um dos 5 pedidos reais foi "junte em um único card"), o usuário relê tudo sem saber o que mudou. Isto é opinião, e o `Changes` da atualização já existe como forma.

## 2. A · Todos abertos

Os problemas da seção 1 valem aqui. Os próprios da A, em ordem de gravidade:

1. **O estado da rodada some enquanto se lê, justamente num modelo em que um gesto muda vários rascunhos.** Na cena `publish`, aprovar o 3 cria o épico e publica o 2, mas o épico e o 2 estão uma a duas telas acima (cena `drafts` a 1250 px: só o 3 e o começo do 4 cabem). O usuário vê a cadeia pelos marcos lá embaixo e pelo toast, não pelos rascunhos. Com o problema 1 da seção 1, a A esconde a consequência do gesto duas vezes.
2. **O descartado continua aberto com o corpo inteiro.** Na cena `epic`, o 3 e o 4 descartados ocupam o mesmo espaço dos aprovados. Com 5 rascunhos de 2,35 mil caracteres, o cartão tem umas 170 linhas (a conta é do README), e o descartado não pede mais leitura.
3. **`A` com o foco no próximo rola para o centro de um corpo novo.** O salto é grande, porque cada rascunho tem de 25 a 40 linhas. O anel `--brand-ring` e o anel de foco são a única pista de onde o usuário está. O risco 3 da seção 1 é igual ao da B.
4. **A tecla `A` aparece nos cinco botões de **Approve**, mas só age no rascunho em foco.** Com todos abertos, isso fica ambíguo; `components.md` (Tag e tecla) quer a tecla na mesma forma em um grupo, não em cinco grupos iguais. Isto é opinião.

O que a A faz bem: com um rascunho só (a mediana), ela é a leitura mais direta possível, sem nenhum clique.

## 3. B · Um por vez

Os problemas da seção 1 valem aqui. Os próprios da B, em ordem de gravidade:

1. **O README promete "um corpo mais uma linha por rascunho", e a linha dobrada tem de três a quatro linhas.** São a etiqueta, o título, o repositório e o módulo, e as dependências (`focus.css:8`, a grade de `.is-folded .db`). Na cena `drafts` a 1250 px, os quatro dobrados somam uns 360 px. Com 10 rascunhos, a lista passa de 800 px mais o corpo aberto, e o argumento central da recomendação ("o cartão tem tamanho previsível") fica mais fraco do que o dito. Nenhuma cena mostra 10.
2. **O espécime do rascunho dobrado não é o da tela.** Em `components.html`, o estado (`Not decided`, `Publishing…`) fica embaixo do título, e não à direita, porque a página não tem o escopo `.b` de que `focus.css` depende (`build.py:77`, `focus.css:8-13`). O documento da tela vai herdar um espécime errado. Nele, `active · pressed` também sai igual ao padrão.
3. **Depois de `A`, o rascunho aprovado dobra e o seguinte abre no lugar: a vista pula.** O usuário não vê, no rascunho que acabou de decidir, o estado que o gesto produziu (`Publishing…`, `Created`), a não ser na linha dobrada de cima. É o mesmo avanço do review, mas aqui o gesto tem efeito externo (seção 1, item 3).
4. **Na cena `published`, o épico fica aberto com o anel de atual, sem nada a decidir.** O "atual" deveria sumir quando não sobra decisão, ou o cartão inteiro deveria dobrar. Hoje há um anel azul sem função.

O que a B faz bem: na cena `publish` (congelada), a cadeia se lê inteira nas linhas dobradas: o épico `Created`, o 2 `Publishing…`, o 3 `waits for Tier limits…`, com o 4 aberto e tracejado com a razão. É exatamente o que o modelo de publicar ao aprovar pede.

## 4. Acessibilidade e system

**Contraste**, calculado dos tokens (oklch para sRGB, WCAG 2.1). Todos os pares passam de 4,5:1.

| Par | Claro | Escuro |
|---|---|---|
| `--ink-3` sobre `--surface-2` (campos, notas, `Not decided`) | 7,29 | 7,09 |
| `--ink-4` sobre `--surface-2` (separadores `·`) | 6,14 | 5,68 |
| `--ink-4` sobre `--surface-1` (hora dos marcos) | 6,05 | 6,45 |
| `--ink-3` sobre `--surface-0` (linha retirada do diff) | 6,53 | 8,52 |
| `--ink-1` sobre véu de hover em `--surface-0` (linha acrescentada) | 14,56 | 13,78 |
| `--brand-ink` sobre `--surface-2` (dependências, `billing#478`) | 6,43 | 8,15 |
| `--brand-ink` sobre `--brand-tint` (**Approve** pressionado) | 5,43 | 6,17 |
| `--state-error` sobre `--surface-2` (razão da falha) | 6,11 | 5,94 |
| `--state-error` sobre `--state-error-veil` (barra `Publish failed`) | 5,42 | 5,77 |
| `--state-wait` sobre `--state-wait-veil` (barra `Decide drafts`) | 5,60 | 8,86 |
| `--state-close` sobre `--surface-0` (barra `Ready to archive`) | 5,08 | 10,00 |

**Cor nunca sozinha:**
- a linha acrescentada do diff tem véu, peso e `+`, e a retirada tem risco e `−`;
- a falha tem losango, trilho e texto;
- o aprovado tem `aria-pressed` e a palavra;
- a espera tem ampulheta e a palavra.

**Tokens:** nenhum valor solto em `disc.css` e `focus.css`, só o `1040px` de uma container query, onde `var()` não entra. O `style="padding:0;background:transparent"` de `components.js:13` é do espécime.

**Larguras:** o `?audit` a 1100, 1450 e 1900 px, com `Details` aberto, sai limpo. A 1100 px o painel cobre a conversa com sombra, pela regra de `structure.md` §3.

**Nome acessível:**
- o rascunho é `role="group"` com a frase inteira (`Draft 3 of 5: New card. … not decided`);
- os botões desabilitados apontam a razão por `aria-describedby`;
- o `Publishing…` é `role="status"`.

Faltam o texto oculto do diff (seção 1, item 14) e o anúncio duplicado pelo toast (item 7).

## 5. As perguntas do coordenador

- **É mínima?** Não ainda. Os rascunhos são mínimos, mas a conversa em volta deles não é: a publicação é dita três vezes (item 7), a reescrita cinco (item 8), e as rodadas passadas deixam dois marcos por rodada (item 9).
- **As respostas do usuário estão aplicadas?**
  - Aprovar publica: sim.
  - Dependências esperam: sim, com o furo do épico descartado (item 5).
  - Corpo inteiro: sim.
  - Documento a um clique: sim.
  - Várias rodadas como caso normal: sim na pílula e nos marcos, mas sem a regra de quando a rodada dobra (item 9).
- **A regra do épico é fiel e clara?** Não é fiel: perdeu "cada card decidido" (item 2). E não é clara: a nota que precede o gesto diz o contrário do que acontece (item 1).
- **A cadeia sem `Publish epic` e sem confirmação é segura?** Não como está. O gesto que dispara três escritas diz que nada acontece, `A` avança e publica o seguinte num toque repetido, e depois de publicado não há caminho de volta dito (itens 1, 3 e 4). Remover `Publish epic` só é seguro com a regra fiel (o último card do épico decidido publica tudo), com a nota dizendo exatamente o que aquele gesto publica, e sem que um segundo `A` publique um rascunho que acabou de abrir.
- **A ou B?** B, pelos motivos da seção 6.
- **A rodada nova substituindo a anterior está clara?** Clara demais: está dita cinco vezes (item 8).
- **Marcos, barra e `Ready to archive` seguem as outras telas?**
  - A barra sim: tingida, erro e encerramento, `Show` para as exceções, `Next to decide` `Alt ↓`.
  - Os marcos não: um por rascunho, contra um por publicação no review.
  - `Ready to archive` segue o `Ready to close`, mas falta a regra da notificação (item 12).
- **Falhas, arquivamento bloqueado, início do board e da Home?**
  - A falha com **Retry** está bem: primário único, trilho, `Show` na barra, a exceção de `structure.md` §3 mantida.
  - O arquivamento bloqueado dá a razão errada no caso do épico (item 10).
  - O início do board e da Home segue `screens/board.md` §2.3 e §4.3, sem os estados de releitura (item 6).
- **Fidelidade a `features.md`.** Perdidos ou alterados sem registro: a regra do épico (item 2), `The epic is discarded.` (item 5), o aviso da dependência removida, o artefato ilegível, a confirmação de apagar e os avisos de repositório e de módulo (item 6). As mudanças da lista "Mudanças de feature" do README estão coerentes, menos a 1, que precisa da regra fiel.

## 6. Comparação e recomendação

**A e B, lado a lado:**
- **Com um rascunho** (a mediana), A e B são a mesma tela. A diferença só existe com 3 a 10 rascunhos, que nenhuma cena passa de 5.
- **Lendo tudo**, a A é um documento contínuo. A B dá um clique ou um `A`/`D` por rascunho, que o fluxo de decisão já faz.
- **Vendo a cadeia**, a B mostra o que um gesto publicou nas linhas dobradas. Na A, isso fica fora da vista, uma a duas telas acima.
- **Em tamanho**, a B cresce três a quatro linhas por rascunho, não uma. A A cresce um corpo inteiro por rascunho, descartados inclusive.
- **Em risco**, as duas têm os mesmos três problemas graves, porque eles são do modelo comum, não da variação.

**Recomendação: B · Um por vez**, como o designer. O modelo de publicar ao aprovar faz a consequência de cada gesto ser o que mais importa ver, e só a B a mantém à vista. Discordo do argumento do tamanho previsível, que o README superestima (seção 3, item 1). E a escolha entre A e B é secundária diante dos problemas do modelo, que precisam ser resolvidos antes de o usuário decidir olhando.

**Não pronto.** Fica pronto para o usuário com estas condições:

1. A regra do épico volta a ser a de `features.md`: publica quando aprovado e com todos os cards decididos, ao menos dois aprovados. O README deixa de chamar a regra atual de "a regra de hoje".
2. A nota e o tooltip de **Approve** dizem exatamente o que aquele gesto publica agora, inclusive na cadeia (`Approving publishes the epic, this card and Tier limits… now`), nas duas variações e em `components.html`.
3. `A` não publica um rascunho que acabou de abrir por um toque repetido. O designer decide como (sem avanço quando o gesto publica, ou outra forma), e o README registra o risco e a escolha.
4. O épico descartado com cards aprovados tem estado, texto e saída (`The epic is discarded.`), com uma cena ou um estado em `components.html`.
5. Uma cena com 10 rascunhos na B, que é o argumento da recomendação.
6. A publicação dita uma vez na conversa, sem o toast com o item aberto. A reescrita com um marco só, no vocabulário do review (*revised*).
7. A regra de quando uma rodada publicada vira marco, com a cena `done` coerente no rótulo e na ordem do tempo.
8. Os estados do item 6 da seção 1 entram em `components.html`, ao menos o artefato ilegível, o erro de sessão com **Retry**, a confirmação de apagar e os avisos do rascunho.

Os itens 10 a 14 da seção 1 e os próprios da B podem ir junto, mas não seguram a decisão.
