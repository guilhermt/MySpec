# Crítica · 14 · O resto

Crítico de design, 2026-09-25. Rodada de uma variação, 19 cenas e 65 variações em `index.html`, e o espécime `components.html`.

A régua usada foi esta: `decisions.md`, `brief.md` (§3, §4 J8, §7), `structure.md` (§1, §4, §7), `principles.md`, `system/components.md`, os quatro `screens/*.md`, `research/rest.md`, `research/interview.md` e as seções de `docs/product/features.md` citadas em `rest.md`.

Como a rodada foi verificada:

- As páginas foram reconstruídas numa cópia a partir de `src/`, e são idênticas às publicadas.
- Todas as variações foram capturadas nos dois modos, a 1250 e a 2500 px. Também foram capturadas páginas altas de Repositories e das notificações, o History a 1100, 1400 e 1600 px, e o espécime inteiro.
- A auditoria da própria página (`?audit`) rodou em todas as variações, a 1100, 1250, 1600 e 2500 px, nos dois modos. Ela passa em tudo, e deixa passar o defeito mais grave, descrito em History.
- O contraste foi medido nos pares de tokens usados, com os valores reais nos dois temas. O único par abaixo de 4.5:1 é `--ink-4` sobre `--brand-veil` no claro, com 4.47. A rodada evita esse par: a hora da linha recém-arquivada sobe para `--ink-3` (`rest.css:261`).
- `rest.css` não tem cor, tamanho nem duração soltos: os valores são tokens ou `calc()` de tokens.

Gravidade: **G** grave (bloqueia a decisão ou quebra uma regra decidida), **M** média, **L** leve.

---

## Settings · navegação e lugar

1. **M. A navegação de Settings como uma linha no topo é a forma real na metade do monitor, não a exceção.** Abaixo de 960 px de área principal, a navegação sobe para uma linha acima da página (`rest.css:400`). A 1250 px de janela, a área principal tem cerca de 950 px, então é essa a forma que o usuário vê na metade do monitor. A rodada apresenta a coluna à esquerda como a forma principal. Ou a linha é aceita como a forma de trabalho, ou o limite desce.
2. **L. O cabeçalho tem duas saídas iguais.** `←` (voltar) e **Close** `Esc` levam ao mesmo lugar anterior (`settings.js:15`, `shell.js:99`). `structure.md` §1 decidiu **Close**, e o `←` é o do histórico, então não é um erro. Mesmo assim, são duas saídas lado a lado numa tela que se pretende mínima.
3. **L. O vazio contradiz a navegação.** Na variação `empty` de Repositories, a navegação continua dizendo `Repositories ◇ 1` (o clone de `acme/infra`), enquanto a página diz `No repositories yet` (`settings.js:10` e `124`).

## Settings · Defaults

1. **G. O catálogo lendo esconde as escolhas do usuário e usa o spinner onde a régua pede o brilho.**
   - Em `reading`, os nove chips viram `◌ Reading models…` tracejados (`settings.js:39`).
   - A escolha guardada não depende do catálogo: o produto guarda a última leitura bem-sucedida da máquina (`features.md`, Modelos e esforço). Então o valor deve continuar visível, e só o `listbox` espera a leitura.
   - Uma leitura sem resultado é o **brilho**, não o spinner (`principles.md` §8), e o `board.md` §4.5 já decidiu `Reading models…` como texto.
   - Nove spinners iguais são ruído.
2. **M. O exemplo de falha é impossível.** `Couldn't save … the database is locked by another MySpec` (`settings.js:41`) não pode acontecer: o produto roda uma instância só (`features.md`, Repositórios). O mesmo exemplo se repete no aviso do app (`other.js:46`), no início que falhou (`other.js:11`) e no rodapé do diálogo em passos, no espécime. Todo texto de erro desta rodada vai virar texto de implementação, então os exemplos precisam ser falhas reais: um erro de disco ou de permissão, ou o `claude` que saiu com um código.
3. **L. O grupo repete o nome da etapa.** `Implementation / Implementation` e `Discussion / Discussion` aparecem como o grupo e a linha (`data.js:64` e `70`). Para um grupo de uma linha só, o grupo pode sair.
4. **L. O modo de review não tem os estados de salvar.** Não há salvando nem falha para **Review mode**, que `task.md` §10 dá ao popover (`Couldn't save the mode · Try again`).
5. **L. O `listbox` tem duas escolhas marcadas.** É um `role="listbox"` com duas `option` `aria-selected="true"`, uma do modelo e uma do esforço, sem `aria-multiselectable` (`settings.js:25`). O leitor de tela anuncia uma lista com duas escolhas. O padrão veio de `task.md` §10, mas o ponto vale registrar para a implementação: são dois grupos de `menuitemradio`, ou dois `listbox`.

**Juízo:** Defaults como a página que abre Settings está certo. É a única página que muda (6 de 9), e o `6 of 9 changed from the factory defaults` com a escolha própria em tinta 1 e peso 500 é a forma mínima de dizer isso.

## Settings · Boards e o diálogo em passos

1. **G. O Edit diz `Step 3 of 3`, mas o Edit tem dois passos.**
   - O Edit não tem o passo da URL: ele abre lendo (`rest.md` §2.1). O subtítulo precisa dizer `Step 2 of 2`, e o **Back** do último passo leva aos status do Edit.
   - Hoje o **Back** leva ao passo 2 do **Add**, de outro board (`boot.js:78`: `m[2] === "3" ? "add-2"`).
   - Clicando pelo fluxo do Add, **Continue** no passo 2 salta para o `edit-3` de `Platform Roadmap` (`boot.js:83`). O título troca de `Add board` para `Edit board` e o board troca de `Data Platform` para outro.
   - O passo 3 do **Add** (com **Add board** e os casos `Clone found`, `Registered without a clone`) não tem cena. O diretor vai clicar pelo fluxo e ver um diálogo que troca de identidade no meio.
2. **G. O foco começa em Cancel também nos diálogos de criação.** `focusFirst` foca o primeiro `[data-act="dlg-close"]` que não é o ×, que é **Cancel**, em todo diálogo (`boot.js:55`). A regra decidida para o diálogo largo de criação é o foco no primeiro campo (`rest.md` §8; `board.md` §4.1). Em **Add board**, colar a URL pede um Tab antes. **Cancel** primeiro vale só para as confirmações destrutivas.
3. **M. O board sem campo de status não aparece.** Ele pula o passo 2, então o subtítulo deveria dizer `of 2`. Nenhuma cena mostra, e o passo que conta os passos precisa dizer o que acontece aqui.
4. **L. O Edit relendo e as opções que mudaram só aparecem no espécime.** O Edit que relê o board (`Reading the board…` só com **Cancel**) e o passo 2 com uma opção que sumiu e outra nova desmarcada não têm cena.

**Juízo:**
- As três etapas com o passo no subtítulo e **Back** estão claras, e resolvem o que `rest.md` §2.1 apontava.
- A tabela `Status | Ends the work | New cards` é a melhor forma possível do passo 2.
- A consequência de desmarcar está clara: a linha diz `Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working.` e o rodapé diz `acme/docs moves to No board.`
- O caso `Leaves MySpec` existe só no espécime (`components.html`, "Repository of a board"), e precisa de uma cena ao lado do `edit-3`.
- A falha de leitura afundada, com `◇` e **Try again**, segue `board.md` §3.8.

## Settings · Repositories

1. **G. O que bloqueia está no fim da página.**
   - O `◇ 1` da navegação aponta para `acme/infra`, que vem por último: no grupo **No board**, depois de 11 repositórios em três grupos.
   - A 1250 px, cada linha tem três andares, e o clone inexistente fica cerca de 1.400 px abaixo do topo. A 2500 px, também fica abaixo da dobra.
   - A variação `change-path` abre sem nada visível do que ela quer mostrar.
   - A régua da Home (`board.md` §2.2) põe as linhas de bloqueio sob o dono, mas a página inteira é uma lista, e o que pede ação precisa vir primeiro: um resumo no alto ou o grupo com o problema no topo.
2. **M. Os grupos vêm em ordem alfabética invertida.** `BOARDS.slice().reverse()` (`settings.js:127`) põe `Platform Roadmap`, `Mobile App` e `Internal Tools`. A árvore, a Home e a página Boards usam a ordem alfabética (`features.md`, Tela de boas-vindas e barra lateral), então não há razão para a exceção.
3. **M. O item de menu desabilitado e destrutivo continua vermelho.** No `⋯`, **Remove…** desabilitado aparece em `--state-error`, com a razão espremida numa coluna de três linhas (`settings.js:117`; captura `menu`). `components.md` (Select e menu) diz que o desabilitado fica em `--ink-4` com o motivo. Um vermelho lê como uma ação disponível.
4. **M. `Open the folder` é uma ação que o produto não tem.** Ela está no `⋯` (`settings.js:117`) e em "Repository row" no espécime. A rodada não a lista em "O que muda em `features.md`" nem em "Dados que faltam". Ou sai, ou entra como mudança declarada.
5. **M. O estado `Set` ou `None` das instruções de review sumiu da linha.** Ele só aparece dentro do `⋯` (`Review instructions… None`). `features.md` (Página Repositories) diz que o título mostra `Set` ou `None`. Com 0 de 12 usados, o custo é pequeno, mas a mudança não está declarada.
6. **M. Os dados se contradizem na mesma página.**
   - `acme/android` aparece `Cloning into ~/code/android…` (`settings.js:110`), e a pasta de clones logo abaixo diz `Not chosen` (`settings.js:129`). O clone só roda depois de a pasta ser escolhida (`features.md`, Repositório sem clone).
   - As contagens de `data.js` também não batem com o History:
     - `acme/billing` tem 0 arquivadas (`data.js:35`), e o History tem `Invoice PDF with line items · billing#470` (`data.js:126`). O diálogo de remover o board ainda diz `billing, with no clone, tasks or reviews`;
     - `sdk-js` tem 0 tasks, e o History tem uma One-Shot dele (`data.js:130`);
     - `tools`, `status-page` e `admin` têm 0 reviews, e o History tem reviews dos três (`data.js:121`, `135` e `104`).
   - A razão de **Remove** depende exatamente dessas contagens.
7. **L. O refuso de Browse fica espremido.** A razão é espremida numa coluna de três linhas entre **Browse…** e **Cancel**, a 1250 px (`settings.js:142`; captura `add-refused`).
8. **L. O botão desabilitado não diz por quê.** Em `add-scanning`, **Add repository** fica desabilitado com `aria-describedby="why-dlg"` apontando para um texto vazio (`settings.js:141`). `components.md` pede a razão ao lado.
9. **L. A varredura mostra um dado que não existe.** `3,214 folders` (`settings.js:135`) é uma contagem que o produto não expõe e que não está em "Dados que faltam".
10. **L. O vazio repete a ação.** **Add repository** aparece no cabeçalho e no corpo (`settings.js:124`).

**Juízo:**
- A varredura está boa. Os disponíveis vêm primeiro e os registrados ficam dobrados em `Already registered 9`. O `Registered without a clone: this links the clone to it.` explica o único caso que confunde.
- **Change path…** na linha de bloqueio, com a recusa sob a linha, é o padrão certo e o mesmo da Home.

## Settings · Prompts

1. **L. Salvar fica longe do texto a 1250 px.** Abaixo de 960 px, a coluna `Placeholders` desce para baixo do editor, e **Save** fica no pé da página, depois dela (`rest.css:404`). Com um prompt de 115 linhas, isso funciona porque o editor tem altura fixa. Ainda assim, a barra de salvar fica longe do texto.
2. **L. A leitura do prompt não tem estados.** Não há o esqueleto nem a falha de leitura (`rest.md` §1.5).

**Juízo:**
- A página com a lista de nove é uma boa simplificação, e eu a apoio contra `structure.md` §4: 0 de 9 prompts editados não justificam 9 de 12 linhas da navegação.
- `Default` ou `Edited Sep 20` à direita diz de um olhar o que a navegação atual não diz.
- A contradição precisa entrar em `decisions.md` como revisão de `structure.md` §4, com a razão.
- `Your version has 92 lines; the default of this version has 87.` é um bom detalhe.

## Settings · Appearance

1. **M. A página não se justifica pela régua da própria rodada: cada elemento justifica por que existe, ou sai.**
   - É uma página inteira e um quinto item de navegação para um controle que já está a um clique, no rodapé.
   - O usuário fixou o tema uma vez (`dark`, `rest.md` §7) e disse que Settings é raro.
   - Minha opinião, onde a régua não fala: sem uma segunda preferência que dependa de uma página, a página sai, e o tema fica só no rodapé. Se ficar, que seja pela razão da prévia do tema, dita ao usuário.
2. **L. A cena mostra a página clara com `Dark` escolhido.** No modo claro, a página aparece clara e o cartão escolhido é `Dark` (`settings.js:208`), e `System` diz `dark right now`. A cena contradiz a si mesma.

## History

1. **G. Na metade do monitor, a linha perde onde e o resultado.**
   - A 1250 px de janela, as linhas do History mostram só o glifo, o nome e a hora. O repositório ou o board e o resultado não aparecem.
   - A causa: `board.css:289` esconde `.cr .meta` em listas de até 1040 px. `rest.css:262` só volta a mostrá-los abaixo de 860 px.
   - Então, de cerca de 1160 a 1350 px de janela (a faixa de referência da metade do monitor), a linha fica sem o que a rodada diz que ela tem. A 1100 e a 1400 px, a linha está certa.
   - A auditoria de `?audit` não pega isso, porque um elemento `display:none` não corta nem sobrepõe.
2. **M. O History não decide os muitos itens.**
   - `structure.md` §7 deixou "History: decididos na fase 4, com a tela de cada um".
   - O History cresce cerca de 4 itens por dia (44 em 12 dias), o que dá mais de mil por ano.
   - A rodada não diz se a lista virtualiza, pagina ou carrega os mais antigos sob demanda. O `44 archived · Sep 12 – today` também não diz como fica com um ano de dados.
3. **M. O filtro por `acme/web` deixa entrar uma discussão de outros repositórios.** Em `filtered`, a lista inclui `Webhook delivery guarantees` (`history.js:21`). Os cards de entrada e publicados dela são de `api` e `gateway` (`history.js:90` e `93`). A regra do filtro está em `features.md` (Histórico de uma discussão).
4. **L. O resultado de uma task é sempre o mesmo.** `PR #1279 merged` aparece em toda linha de task (22 de 22, porque a task só arquiva pelo encerramento, com o merge). O que varia é `6 steps` ou `One-Shot`. Minha opinião: o `merged` pode sair da linha da task, e o resultado mostra a parte pulada ou falha do encerramento quando houver. O "resultado" hoje não informa nada.
5. **L. O chip do filtro tem um × que não é um controle.** O × dentro de `Only acme/web` é um `span` com `aria-label` dentro de um botão (`history.js:24`), e o leitor de tela não o anuncia.

**Juízo:**
- A lista por data, com o dia como seção, é a organização certa para "quase nunca abro" (entrevista).
- O filtro da lateral valendo, com o chip removível e `12 of 44`, responde exatamente ao que o usuário disse.

## Arquivados (task, review, discussão)

1. **M. Todo marcador de relatório termina num `·` solto.** `Review 1 · clean ·`, `Report · reviews/pass-1.md ·` (`history.js:65` e `83`): `EVX` é chamado com a hora vazia. Aparece em todas as linhas de relatório da task e do review.
2. **L. O resultado mostra um detalhe que o produto não guarda.** O pulado mostra `~/code/api is on fix-invoice-rounding. Pull dev there when you switch back.` (`history.js:51`). O `CloseResult` guarda a razão, não o ramo que estava em checkout, e esse detalhe não está em "Dados que faltam".
3. **L. O review liga ao card de outra task.** O review `web#2291 · Migrate settings page…` aparece ligado ao card `web#2244 · Plan picker with yearly prices` (`history.js:80`), que é o card de outra task do History (`data.js:123`).

**Juízo:**
- Na task, os fatos, depois o resultado do encerramento, depois as abas, está certo. O pulado com `–` neutro, e não âmbar nem vermelho, lê bem.
- A discussão abre com `What it published` e `Not published · discarded`, que é o que importa primeiro.
- O review abre com as passadas e o que foi publicado, com o lugar de cada apontamento.
- `The conversation of a review isn't kept in History.` diz o que falta, em vez de esconder.

## Início

1. **M. A falha deixa a lateral em esqueleto com brilho.** Na variação `failed`, a lateral continua em esqueleto e brilhando (`boot.js:21` usa `sidebarSkeleton()` em toda variação de `starting`). O brilho diz que uma leitura ainda vai ter resultado (`principles.md` §8), e o início falhou. Na falha, a lateral fica parada, ou some.
2. **M. O erro de exemplo é impossível** (ver Defaults, 2): `database is locked … another MySpec process holds it` (`other.js:11`).
3. **L. Os passos talvez não bloqueiem a abertura.** Ler o catálogo de modelos e reabrir as sessões podem não bloquear a abertura hoje: o catálogo tem a última leitura guardada (`features.md`, Modelos e esforço). Listá-los como passos do início pode ensinar o backend a esperar por eles. A lista deve ter só o que de fato bloqueia a primeira tela.

## Boas-vindas

1. **M. A falta do Claude Code não tem cena.** A variação se chama `Claude Code or gh missing`, mas mostra só o `gh` sem login (`other.js:29`). O Claude Code ausente é o caso que impede tudo e o que mais importa mostrar. Também não há o `gh` não instalado, que é diferente de "sem login".
2. **L. O comando não é copiável.** `gh auth login` aparece em texto corrido, sem mono (`other.js:29`). Os outros comandos da rodada são copiáveis.
3. **L. A mudança de comportamento não está declarada.** A lateral das boas-vindas tem **Settings** ativo (`shell.js:75`). Hoje, `Ctrl+,` fica inerte nas boas-vindas (`rest.md` §4), e a mudança não está em "O que muda".

**Juízo sobre `This machine`:**
- Vale, com uma condição: mostrar o bloco só quando algo falta.
- As duas marcas verdes, na primeira execução bem-sucedida, são cromo.
- O que falta (o Claude Code ausente, o `gh` sem login) evita uma falha confusa no primeiro **Add board**, e o custo é pequeno (`gh auth status` e a versão que a leitura do catálogo já traz).

## Migração

Nada grave. A cena segue `structure.md` §7 e `features.md`. **Copy the list** é uma ação nova e útil, que precisa entrar em "O que muda".

## O aviso do app e os toasts

1. **M. O exemplo do aviso contradiz a própria rodada.**
   - `Couldn't change the model of Plan` usa o aviso global (`other.js:46`).
   - Na mesma rodada, a falha ao salvar um modelo em Defaults fica no lugar, com **Try again** (`settings.js:41`), e `task.md` §10 dá ao popover o estado salvando e o erro no lugar.
   - O aviso global é para uma ação sem lugar próprio. O exemplo precisa ser uma dessas, e o espécime já tem uma: `Couldn't pause Rate limit per API key`.
   - O texto também diz para fechar o outro MySpec, o que é impossível.
2. **L. Dois toasts cobrem o compositor.** Eles cobrem cerca de 250 px do compositor da task, a 1250 px (captura `notice/toast`). A região `.toasts` é a decidida (`components.md`), mas não há um limite de quantos ficam empilhados.

**Juízo:** o rótulo pela ação que falhou, e não `Something went wrong`, é uma melhora clara.

## A página do item que saiu

1. **M. O comando de limpeza apaga o que o git protegeu, sem dizer.** Na task apagada, o comando oferecido é `git worktree remove --force …` (`other.js:66`), e o erro logo acima diz que a worktree "contains modified or untracked files". O `--force` apaga esses arquivos. A página precisa dizer isso em uma linha, ao lado do comando.
2. **L. `Next that needs you` não tem o estado sem destino.** Quando nada espera o usuário, a cena não mostra o botão desabilitado ou ausente.

**Juízo:** as quatro páginas seguem `review.md` §15 e `discussion.md` §11: o ícone neutro, o título com o nome, o resultado afundado, **Next that needs you** com o foco, **Open in History** (menos no apagado) e a volta. Estão coerentes entre si.

## Os diálogos da task

1. **M. `back-to-stage?v=pr` descreve uma task que não é a de trás.** O diálogo lista `the conversations of the 7 steps`, `the pull request draft` e `PR #1284 stays open`, mas por trás está a task no step 3/7 da implementação, sem PR (`other.js:100` e `105`; `shell.js:112`). Ou a task de fundo vai à etapa de PR, ou o diálogo se ajusta a ela.
2. **M. `a new one opens when the task gets there again` promete algo não verificado.** O texto (`other.js:105`) supõe o que acontece com a PR aberta quando a branch é recriada com o mesmo nome. Não há fonte em `features.md` para isso. Ou a frase sai, ou é verificada.
3. **L. A interrupção só aparece no Delete.** O Delete diz `The reviewer's answer in progress is interrupted` (`other.js:82`). O Back e o Discard, com o mesmo revisor rodando por trás, não dizem.
4. **L. O apagamento em curso diz `Deleting…` duas vezes.** No rodapé e no botão (`other.js:89`).
5. **L. A prévia lendo é uma caixa cinza vazia.** Não há texto visível: `Reading what will be destroyed` fica só no `aria-label` (`other.js:81`).

**Juízo:**
- O Delete com a prévia cumpre `features.md` (Apagar uma task) e resolve o `stays open` da PR mergeada.
- O Discard step com a contagem de arquivos nos dois textos da caixa está claro.
- O Back lista o que se perde, agora com o que a etapa de PR criou.

## A pausa

1. **L. As duas abas aparecem pausadas.** No `pause`, as abas `Implementer` e `Reviewer` mostram o glifo pausado (`shell.js:134`). Na implementação, **Pause** age só na conversa em que o step espera, a do revisor durante uma passada (`features.md`, Sessões e conversas). O implementador fica ocioso, não pausado.

**Juízo:** sem diálogo, com o marco `Paused by you · … · 14:52`, **Resume** e `Sending resumes the task…`, está certo e coerente com `task.md` §12.

## As notificações

1. **G. A tabela não está completa: tem 30 linhas, e o catálogo tem cerca de 47 textos.** Faltam, com a fonte em `rest.md` §5.4:
   - **task:**
     - a permissão do revisor, `The reviewer of step N asks for a permission.`;
     - o erro de sessão do revisor, `The review of step N stopped with an error.`;
     - `worktree_unreadable`;
     - o `step_review` `the last approval didn't produce a commit`;
     - o `changes_review` do mesmo tipo;
     - o conflito com a base de `pr_trouble`;
     - a pergunta, a permissão e o erro na etapa de PR e no PR review (`in the pull request`, `in the review`);
   - **review:** a pergunta, a permissão, o erro de sessão, `The reviewer stopped without a report the app can read.`, o `pr_trouble` depois da publicação, e todo o modo Apply (`The approved findings are ready to apply.`, as mudanças a revisar, pronta para merge);
   - **discussão:** a pergunta, a permissão, o erro de sessão, a espera de resposta e `The agent wrote drafts the app can't read in the discussion.`

   Se a ideia é que o texto genérico vale para todo lugar, a tabela precisa dizer isso numa linha e listar os lugares. Hoje ela se apresenta como "as 30 situações".
2. **M. A discussão `Publish failed` lê errado.** `A draft couldn't be published: Overage on the monthly invoice.` (`other.js:147`): o título do rascunho depois dos dois pontos lê como a razão da falha. Escreva `Couldn't publish "Overage on the monthly invoice".` e a razão, se houver.
3. **L. A mudança do título do review não está marcada.** O título passa a ser `acme/web#2291 · Migrate settings page…` (`other.js:152`), quando hoje é `dono/nome#N` (`rest.md` §5.4). A linha não tem a marca `changed`.

**Juízo:** os textos que existem são bons. Cada um tem o lugar, as contagens, o nome do check e a saída. A coluna "o clique abre" é a parte mais útil da tabela.

---

## Transversal

- **Coerência com as quatro telas.** A rodada não inventa estrutura. Ela usa:
  - a linha de lista e o cabeçalho de seção do board;
  - a faixa de falha afundada;
  - os dois diálogos, o largo e o mínimo;
  - a página do item que saiu;
  - o marco em linha que abre no lugar.

  Os glifos, a cor como sinal, uma primária por tela e o destrutivo só na confirmação estão respeitados.
- **Dados.** O mock tem contradições que o diretor vai ver: contagens contra o History, uma pasta de clones não escolhida com um clone em curso, um filtro que deixa entrar outro repositório, um review ligado ao card de outra task. Nenhuma é de design, mas todas enfraquecem a leitura das telas.
- **Dados novos não listados** em "Dados que faltam": a contagem de pastas da varredura, o ramo em checkout no resultado do encerramento e **Open the folder**.
- **Espécime.** `components.html` cobre os estados que o README lista. Dois deles contradizem as cenas: a linha do History estreita funciona no espécime e não na página, e **Remove…** desabilitado continua vermelho.

## Comparação com as telas decididas, em cinco linhas

1. A rodada é a mais disciplinada da fase: nenhum componente de estrutura novo, e os tokens estão limpos.
2. O que ela tem de pior não é de desenho. É de montagem: um limite de largura herdado que apaga a meta do History, um fluxo de diálogo que troca de board no meio e o foco no lugar errado.
3. As escolhas que pedem o olho do usuário estão bem colocadas: os prompts numa página, Appearance e `This machine`.
4. A tabela de notificações parece completa sem ser.
5. Repositories é a única página em que a hierarquia falha: o que bloqueia vem por último.

## Recomendação

- Adotar a rodada como direção, com as seguintes posições:
  - **Prompts:** a página com a lista fica, e a revisão de `structure.md` §4 é registrada;
  - **Appearance:** a página sai, e o tema fica só no rodapé;
  - **`This machine`:** fica, só quando algo falta.
- Discordo do designer em dois pontos:
  - Appearance não se justifica pela régua da própria rodada;
  - "adotar como está" não é possível, pelos três defeitos graves de montagem, que o diretor encontra ao clicar.

**Não pronto.** Fica pronto quando:

1. a linha do History mostra onde e o resultado em toda largura de 1100 a 2600 px, com uma captura a 1250 que prove;
2. o diálogo de board tem o Add completo nos três passos (com o passo 3 do Add, `Clone found` e `Leaves MySpec`), o Edit em `Step N of 2` com o **Back** dele, e o board sem status;
3. os diálogos de criação começam com o foco no primeiro campo, e as confirmações, em **Cancel**;
4. Repositories põe o que bloqueia à vista na abertura, e os grupos seguem a ordem alfabética;
5. Defaults lendo mantém as escolhas visíveis e usa o brilho, não nove spinners;
6. a tabela de notificações cobre todas as situações de `rest.md` §5.4, ou diz em uma linha como o texto genérico vale por lugar, e o `Publish failed` da discussão é reescrito;
7. os exemplos de erro impossíveis (`another MySpec`) são trocados por falhas reais, e o do aviso do app vira uma ação sem lugar próprio;
8. `back-to-stage?v=pr` tem a task de fundo na etapa de PR, e a promessa `a new one opens…` sai ou é verificada;
9. os dados de `data.js` se tornam coerentes: contagens contra o History, pasta de clones contra o clone em curso, e o filtro da discussão.

Os itens médios e leves restantes podem entrar na mesma revisão sem uma nova rodada de crítica.
