# 09 · A tela da task

Fase 4, primeira tela. É a tela em que o usuário acompanha e conduz uma task: o topo do item, o progresso entre as etapas, os agentes implementador e revisor e a conversa em si, em todas as etapas. A rodada também decide onde moram os apontamentos da PR da própria task (`decisions.md`, 2026-09-23: da C, "decidir apontamentos e rascunhos dentro da conversa"; `structure.md` §3 e §9).

**A pergunta.** Como é a tela em que o usuário sabe de um olhar de quem é a vez e o que fazer? Nela ele precisa entender onde a task está e o que falta, acompanhar dois agentes sem se perder, ler uma sessão longa sem se afogar e responder pelo teclado. A régua são os oito requisitos do `brief.md` §6.

Não é uma repaginada: as duas variações trocam o topo de quatro faixas (cabeçalho, trilha, barra do step e abas) por um modelo novo. A conversa também muda: marcos que abrem no lugar, mensagens do produto recolhidas, ações rotuladas pelo que o agente disse que faz e subagentes aninhados. Ela segue os achados de `research/conversation.md`.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **A · Conversa com marcos**, com nove cenas |
| `b.html` | **B · Workflow com conversas**, com as mesmas nove cenas |
| `components.html` | Os componentes novos em todos os estados, claro e escuro lado a lado |
| `src/` | As fontes: `core.js` e `core.css` (compartilhados), `content.js` (a task nos nove momentos), `a.*`, `b.*`, `components.*`, `base.css` (os componentes da 08, sem mudança) e `build.py` |

As páginas são geradas por `python3 design/lab/09-screen-task/src/build.py`. Cada uma é autocontida e traz `design/system/tokens.css` byte a byte, entre marcadores. O script confere a igualdade.

## Como abrir

Sirva a lab (`python3 -m http.server 8090 -d design/lab`) e abra `09-screen-task/a.html` e `b.html`. Um seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros:

- `?scene=`: `plan`, `run`, `ask` (o padrão, a cena da 08), `error`, `manual`, `blocked`, `checks`, `findings` ou `close`;
- `?theme=light` ou `?theme=dark`;
- `?panel=Details`, `Artifacts` ou `Card`, para abrir um painel;
- `?end`, para abrir no fim;
- `?audit`, que mostra o relatório de geometria, truncamento e contraste;
- `?clean`, que esconde o seletor;
- só na B, `?place=s3i` (e os outros lugares), que abre um lugar do trilho.

Tudo é clicável: os painéis, os marcos que abrem, os grupos de ações, os capítulos dobrados (A), o filtro de vozes (A), os lugares do trilho (B), **Show** e **Go to…** da barra do pedido, e o tema.

## A mesma task em nove momentos

A task é `Rate limit per API key` (`acme/api#412`), Structured, em modo `Agent`, com o step 4 em `Manual` por escolha própria. As nove cenas são a mesma task ao longo de um dia: das 09:14 às 20:44, da primeira pergunta do PRD até a PR mergeada. Os volumes seguem `research/conversation.md` §4:

- o tech spec tem um grupo de 52 ações;
- o step 3 tem 142 ações ao todo, em dois papéis, com grupos de 14 a 45;
- o revisor lê em silêncio por 45 ações;
- o relatório entregue ao implementador vira uma linha com o conteúdo a um clique;
- o review da PR delega a um subagente de 44 ações;
- quase toda ação é Bash, rotulada pela descrição.

A árvore da lateral é a da 08, com a linha da task no estado de cada cena.

## A · Conversa com marcos

**Modelo.** A task é uma linha do tempo só: do card até o merge, todas as sessões numa conversa contínua, na ordem em que aconteceram.

- **Capítulos.** Cada etapa e cada step é um capítulo. O passado se dobra numa linha com o que produziu: `Step 3 · c19f02e Token bucket middleware · 2 passes · 1 question · 142 actions · 13:48`, e abre no lugar. O capítulo atual tem um cabeçalho que gruda no alto enquanto é lido.
- **O topo.** É uma faixa só, de uma hierarquia: `←` `→`, o breadcrumb, o título, e a **posição**. A posição são sete pontos das etapas, o nome da etapa atual e a posição dentro dela (`Implementation · Step 3 of 7`). À direita ficam as ferramentas de sempre, com os painéis num grupo de alternância. A trilha de chips, a barra do step e as abas deixam de existir como faixas.
- **O cabeçalho do capítulo.** Carrega o que a barra do step e as abas carregavam:
  - a linha do step e as ferramentas dele (**Review myself**, **Open in VS Code**, **Discard step…**);
  - os **tempos do loop** (`Implement ✓ › Review 1 · 2 ✓ › Round 1 ✓ › Review 2 · asks you › Commit`), que dizem onde está o laço entre os dois agentes e quanto falta, com o teto de três rodadas à vista;
  - o **filtro de vozes**, `All · Implementer · Reviewer`, cada voz com o glifo da sua sessão.
- **Os marcos na margem.** Onde a margem direita cabe (a partir de cerca de 1.750 px de janela), uma lista dos marcos fica ao lado da coluna: etapas, steps, a PR, o encerramento, cada um com os seus fatos numa segunda linha (`a41c9e2 · 2 passes · round 1 of 3`, `Agent · Sonnet · high` no que falta). O atual está em identidade, e sob ele estão os pedidos do step (`Reviewer · Question 18m`, `Implementer · Permission 4m`). Uma barra marca o que está na tela, as etapas futuras ficam apagadas, e `[` e `]` saltam entre marcos. Numa janela mais estreita, a mesma lista abre num popover, pela posição do topo ou pelo ícone do cabeçalho do capítulo.
- **Os dois agentes.** São vozes na mesma linha do tempo. O implementador tem o avatar cheio e o revisor o avatar em anel, como no system, e as entradas do revisor correm ao longo de um fio vertical neutro, o fio da voz. A troca entre os dois aparece como é: `MySpec → Implementer · Review 1 · 2 findings · round 1 of 3`, uma linha que abre a mensagem inteira.
- **O compositor.** Não tem destinatário a escolher. Escreve para a voz que o filtro mostra, ou, com `All`, para quem pediu por último, e o placeholder diz para quem (`Reply to the implementer…`). Uma pergunta ou permissão se responde no cartão.

**Cenas.** Com a sessão de um step inteiro aberta, a A mostra a conversa entre os dois agentes como uma conversa. A cena `ask` tem as duas perguntas na tela, e a barra do pedido lista as duas, cada uma com **Show**.

## B · Workflow com conversas

**Modelo.** A tela é organizada pelo workflow. Um trilho à esquerda da área principal é a espinha e o topo do item. A conversa mostra um lugar por vez.

- **O trilho.** Lista as etapas de planejamento (PRD, Tech spec, Plan), a implementação com os sete steps, e a PR (rascunho e abertura, PR review, Closing). Cada nó tem o glifo de estado e o que produziu (`4 questions · PRD.md`, o SHA do commit, `pass 2 · clean · merged 18:44`), com a hora à direita. Um nó futuro mostra o modelo com que vai rodar.
- **Os lugares.** O step atual se abre em dois lugares, `Implementer` e `Reviewer`, cada um com o glifo e o que pede, e os relatórios logo abaixo. As abas viram lugares do trilho. Um step passado abre a conversa dele, somente leitura.
- **O topo.** É a mesma faixa única da A, sem a posição. A posição volta à faixa só quando o trilho se dobra.
- **A regra de largura.** O trilho tem `clamp(256px, 14%, 320px)`. Ele se dobra numa faixa de 48 px, só com os glifos e os números, quando a conversa ficaria abaixo de 680 px. Um painel vira coluna quando `área principal − trilho − coluna de decisão − painel ≥ 760 px` e, abaixo disso, cobre a conversa.
- **O cabeçalho do lugar.** No alto da conversa fica `Step 3 · Token bucket middleware / (avatar) Reviewer · pass 2 · asks you`, com as ferramentas do step.
- **A barra do pedido.** Fala do lugar em tela e aponta o outro: `Question · Reviewer 18m [Show]`, e na segunda linha `The implementer also waits · Permission 4m [Go to implementer]`.
- **O compositor.** Não tem destinatário: quem escuta é o lugar.

**Cenas.** A B mostra a task inteira de uma vez, de longe, e cada conversa limpa. A cena `checks` mostra o lugar `PR review` antes da primeira passada: os checks pelo nome e o vazio dizendo quando a conversa começa.

## O que as duas compartilham

A conversa é a mesma componente nas duas (requisito 7). Estas mudanças valem para as duas e vêm de `research/conversation.md`:

1. **O rótulo de uma ação é a descrição que o agente escreveu**, e o comando vem depois, apagado: `Run the rate limit tests · go test ./internal/ratelimit/... -race · exit 1 · 8.2 s`. O resumo do grupo conta por tipo (`Read 26 · Searched 9 · Tests 6 · Lint 2 · git 2`), com a falha e a duração. Não há diff por ação: as edições são Bash quase sempre, e a conversa não é desenhada em torno de diffs.
2. **Um subagente se aninha.** `Delegated · Find why e2e / rate-limit-burst failed` é uma linha do grupo, e abre o grupo do subagente (`44 actions · Read 21 · Searched 14 · GitHub 9`) recuado sob um fio.
3. **As mensagens do produto são marcos.** Cada uma é uma linha com o destinatário e o que é (`MySpec → Implementer · Review 1 · 2 findings · round 1 of 3`). O conteúdo fica a um clique, em Markdown.
4. **Um marco abre no lugar.** Documento escrito, relatório escrito, a instrução com que a sessão começou (`Started with steps/03-token-bucket.md`) e o card de entrada: cada um mostra o conteúdo renderizado ali mesmo, sem abrir um painel (requisito 5). **Open in Artifacts** continua ao pé dele.
5. **Todo erro tem a ação da sua sessão.** O bloco de erro não tem botão (`structure.md` §3), e a barra do pedido nomeia a sessão: **Retry reviewer** na cena `error`. Na B, a conversa do implementador diz que é a outra que espera e leva até lá.
6. **Resposta rápida a uma pergunta em texto.** No planejamento o agente pergunta quase sempre em texto, com opções `a`/`b` ou `1`/`2`, e o usuário responde `a`, `1` ou `ok`. A pergunta ganha um fio âmbar no parágrafo, a barra diz `Reply · PRD`, e o compositor mostra uma pastilha por opção (`a · Plans table, cached 60 s`), que envia a letra. Escrever `a` e `Enter` continua valendo.
7. **A volta ao fim carrega o que acontece lá.** `↓ New messages · (spinner) Implementer go test ./internal/ratelimit/... -race` fica acima da barra do pedido. Em qualquer rolagem se sabe que o agente trabalha e no quê (requisito 1).
8. **Marcos de decisão do usuário.** `You approved the draft · title edited`, `You decided · 3 approved, 1 discarded` e `You approved the changes · 3 files staged` ficam na linha do tempo como os eventos do agente.
9. **O polimento da 08**, seção 7 do `critique.md`:
   - um eixo no topo: uma faixa só, e tudo o que é do item fica na medida da conversa (item 1);
   - a barra quieta com o rótulo em tinta (3);
   - a tecla na mesma caixa em todo botão (4);
   - `Enter to send` no tooltip do **Send** (5);
   - o lugar que entra com um esmaecido de `--duration-base` e o pedido que nasce com a piscada no véu (6);
   - a barra de rolagem fina e neutra, sem trilho (7);
   - os painéis num grupo de alternância (8);
   - o `…` do breadcrumb como menu dos níveis escondidos (9).

   O item 2, uma marca de cor por linha da árvore, fica para a rodada da árvore: a lateral é a da 08.

## Cena a cena

| Cena | A · Conversa com marcos | B · Workflow com conversas |
|---|---|---|
| `plan` · PRD pergunta em texto | Capítulo PRD aberto, o card de entrada como marco, três respostas curtas (`a`, `1`, um cartão respondido), a pergunta final com o fio âmbar. Barra `Reply · PRD`. Pastilhas `a` e `b` no compositor. A posição diz `PRD` | O trilho mostra PRD atual e o resto futuro, com os modelos. A implementação diz `steps come from the plan`. A conversa é a mesma, no lugar PRD |
| `run` · implementador rodando | Seis capítulos dobrados, o step 3 aberto. `Round 1 of 3` gira nos tempos do loop. O grupo ao vivo abre nas últimas ações, com `Show 5 earlier actions`. Uma mensagem na fila. Aberta rolada acima do fim, com a volta ao fim mostrando a ação em curso. O compositor mostra **Stop** e `Implementer working · 3m 40s` | O lugar `Implementer` com o spinner no trilho e `round 1 · 4m`. A mesma volta ao fim. O `Reviewer` fica ao lado, `pass 1 done` |
| `ask` · revisor pergunta, implementador espera permissão | As duas vozes intercaladas, o fio do revisor, os dois cartões na tela. A barra fala do último pedido e aponta o outro: `Permission · Implementer [Show]` e `The reviewer also waits · Question [Go to reviewer]`. **Allow** é a única primária. O compositor escreve ao implementador, e **Go to reviewer** passa a barra e o compositor ao revisor | O lugar `Reviewer` com o cartão. A barra: `Question · Reviewer [Show]` e `The implementer also waits · Permission [Go to implementer]`. Os dois glifos âmbar no trilho |
| `error` · sessão do revisor cai | O bloco de erro na voz do revisor, com o grupo interrompido. A barra de erro com **Retry reviewer** | O lugar `Reviewer` com o trilho de erro no nó. No lugar `Implementer`, a barra quieta leva ao revisor |
| `manual` · arquivos e stage | O cartão de review com a barra de stage e os sete arquivos (staged, `1 hunk left`, not staged). A barra tingida com **Open in VS Code** e **Approve** tracejado, `Stage 2 more files` | O mesmo cartão no lugar `Implementer` do step 4, `Manual · your review · 71%` no trilho |
| `blocked` · worktree suja | `Step 5 is next` e o bloco de erro com o `git status`. **Try again** (primária) e **Clean and start…** na barra de erro. O compositor desabilitado: ainda não há sessão | O nó do step 5 com o trilho de erro. O mesmo conteúdo no lugar |
| `checks` · PR esperando | O capítulo da PR com o rascunho, a aprovação, `Opened #1284` e o bloco dos checks pelo nome (`3 of 5`, `e2e running 4m 12s`, `checked 40s ago`, **Refresh**). Sem barra: não é uma situação | O lugar `PR review` vazio, com os checks e a frase de quando a conversa começa |
| `findings` · apontamentos a decidir | O cartão de decisão na conversa, logo depois do relatório. **Next to decide** `Alt ↓` e **Apply approved** tracejado na barra (`Decide 3 more`) | A coluna de decisão à direita. **Hide findings**, **Next to decide** e **Apply approved** na barra |
| `close` · pronta para encerrar | O ciclo inteiro no capítulo PR review: você decidiu, 14 ações, você aprovou, o commit, `Review 2 · clean` e `Merged #1284 · by lnakamura`. A barra de encerramento em verde, com **Close task** | `PR review · pass 2 · clean · merged` no trilho, e `Closing · ready` atual |

## Os oito requisitos (`brief.md` §6)

| # | Requisito | A | B |
|---|---|---|---|
| 1 | De quem é a vez, de um olhar | A barra do pedido quando é sua. Os tempos do loop dizem quem está no laço. O compositor com **Stop** e quem trabalha, e a volta ao fim com a ação em curso em qualquer rolagem | Os mesmos três, mais o trilho, que mostra de longe cada lugar com o seu glifo. **Mais forte** quando a outra conversa espera |
| 2 | Quem fala | Avatar cheio e em anel, o fio da voz do revisor, o produto como marco de uma linha, você à direita com `→ Implementer`. **Mais forte**: as vozes aparecem juntas e se distinguem | Avatar e cabeçalho do lugar. A distinção é espacial, e a conversa entre os agentes some: cada um fica no seu lugar |
| 3 | Pergunta, permissão e decisão impossíveis de perder, pelo teclado | Cartões, barra com **Show**, `1–9`, `A`/`D`, `Alt+↓`. Duas perguntas ao mesmo tempo estão as duas na tela | Os mesmos. A segunda pergunta está a um clique (**Go to…**), com o glifo no trilho |
| 4 | Atividade sem afogar a leitura | Grupos com o resumo por tipo, subagente aninhado, as últimas ações e `Show N earlier`. Os capítulos passados dobrados numa linha. Os marcos na margem com `[` e `]`. **Mais forte** numa task longa: 142 ações do step 3 em cinco linhas | Os mesmos grupos. A sessão longa é menor, porque só um lugar é lido por vez. Não há dobra de capítulo, que é o trilho |
| 5 | Documentos e relatórios sem painel aberto | Os marcos abrem no lugar: PRD, tech spec, step, relatórios, rascunho | Os mesmos, e o trilho lista os relatórios de cada step |
| 6 | Eventos do workflow como marcos legíveis | Os capítulos, os marcos fortes com ícone, os marcos de decisão sua, a margem. **É o modelo** | Os nós do trilho. Dentro da conversa, os mesmos marcos |
| 7 | A mesma conversa em task, review e discussão | O stream e os marcos servem ao review e à discussão. O filtro de vozes só aparece onde há duas sessões. Os capítulos são próprios da task | O trilho é da task. Review e discussão têm uma conversa só, sem trilho, e a B fica igual à conversa da A sem capítulos |
| 8 | Legível de 1.100 a 2.600 px | Uma coluna. A margem de marcos aparece com espaço e vira popover sem ele. Nada muda de lugar abaixo de 1.250 | Três colunas na área principal. A 1.250 cabe o trilho inteiro, com a conversa em cerca de 700 px. A 1.100, e em qualquer largura com a coluna de decisão abaixo de cerca de 1.540, o trilho se dobra, e a conversa fica em 440 a 600 px |

## Onde os apontamentos moram

**Decisão proposta: na conversa, num cartão de decisão, com a barra do pedido como barra de decisão.** É o que a A mostra. A B mostra a coluna, para comparar lado a lado.

- **O relatório com apontamentos é um pedido, e o princípio 7 já diz onde mora um pedido.** O conteúdo fica num cartão na conversa (o resumo editável e os apontamentos), e a ação que resolve fica na barra (**Next to decide** `Alt ↓`, **Apply approved**, com o que falta). É a mesma forma da pergunta e da permissão, que o usuário já sabe usar, com o mesmo teclado: `A` e `D` decidem o apontamento em foco, e `Alt+↓` vai ao próximo.
- **Funciona em toda largura.** A coluna custa 300 px, e com o trilho da B, ou com um painel, empurra a conversa abaixo da medida a 1.250 px (a cena `findings` da B a 1.100 px mostra a conversa com 440 px). O cartão usa a medida da conversa, que já é a largura boa para ler um apontamento com código.
- **Pedir uma mudança ao agente continua natural.** O compositor fica logo abaixo (`Ask the reviewer to add, change or drop a finding…`). Quando o agente reescreve o relatório, o cartão novo nasce no fim com as decisões mantidas, e o antigo se dobra num marco (`Review 1 revised`).
- **Resolve o problema do brief §10**, dois fluxos parecidos decididos de formas diferentes: o apontamento é o mesmo componente na task e no centro de review. A rodada do centro de review confirma o lugar com nove apontamentos e a publicação. Os rascunhos da discussão, com épicos e ações por grupo, são avaliados na rodada da discussão, onde a coluna ainda pode ganhar.

Isto muda o comportamento: hoje os apontamentos da PR da task são decididos em texto, na conversa (`features §Review de pull request`). Com o cartão, a decisão é estruturada e **Apply approved** envia os aprovados, como no modo `Apply` do centro de review. O custo está em "Dados que faltam".

## A sessão longa

Os números de `research/conversation.md` §4 dimensionam as cenas. Um implementador tem mediana de 33 ações e p90 de 69, em 8 grupos. Um revisor tem grupos de até 61 ações, e o tech spec, de até 52. Como cada variação fica legível:

- **O grupo.** Vem dobrado, com o resumo por tipo e a duração. Aberto, mostra as últimas seis ações e `Show N earlier actions`. Com uma ação rodando, o resumo é a própria ação. A proposta é mostrar primeiro o fim de um grupo longo: é onde está o resultado e o erro que importa.
- **A troca entre sessões.** Uma linha em vez do texto de 5,6 mil caracteres.
- **O passado (A).** Uma linha por etapa e por step, com o commit e as contagens. A cena `checks` da A tem dez marcos dobrados em dez linhas.
- **A navegação (A).** A margem de marcos, `[` e `]`, e o popover da posição.
- **A navegação (B).** O trilho: cada lugar é uma conversa curta.

## Componentes novos

Todos estão em `components.html`, em todos os estados, claro e escuro lado a lado, só com tokens. Os estados usam as regras comuns de `components.md` (véu no hover, anel no foco, tracejado no desabilitado, spinner e gerúndio no carregando, vermelho com o verbo de nova tentativa no erro).

| Componente | Onde | Estados |
|---|---|---|
| **Marco que abre no lugar** (documento, relatório, instrução, card de entrada) | A e B | padrão, hover, foco, aberto, indisponível (descartado), abrindo, erro (`Try again`) |
| **Mensagem do produto** como marco | A e B | padrão, hover, foco, aberta, não entregue, enviando, erro |
| **Grupo de ações** com descrição, resumo por tipo, `Show N earlier` e subagente aninhado (evolução do grupo do system) | A e B | dobrado, hover, foco, aberto com subagente, em espera, rodando, com falha |
| **Tempo do loop** (beat) | A (a B mostra os mesmos fatos no trilho) | feito, hover, foco, atual, ainda não, rodando, erro |
| **Filtro de vozes** (o controle segmentado que `components.md` reservou para a fase 4) | A | padrão, hover, foco, escolhido, desabilitado (sem revisor ainda), `starting`, erro |
| ~~Destinatário do compositor~~ | Retirado depois da crítica; o espécime o guarda como registro | — |
| **Resposta rápida** | A e B | os sete (`Sending “a”…`, `Not sent · the session stopped`) |
| **Capítulo dobrado** | A | padrão, hover, foco, aberto, descartado, carregando a conversa, erro |
| **Marco na margem** e o popover | A | feito, hover, foco, atual e na tela, ainda não, pedido rodando, pedido com erro |
| **Nó do trilho** e lugar | B | feito, hover, foco, lugar escolhido, ainda não, trabalhando, erro. E o trilho dobrado |
| **Arquivo mudado** no cartão de review | A e B | not staged, hover, foco, staged, apagado, abrindo, erro de leitura |
| **Checks do GitHub** | A e B | ao vivo, lidos antes da passada, primeira leitura (brilho), leitura falhou |
| **Apontamento** (cartão de decisão na A, coluna na B) | A e B | padrão, hover, foco, aprovado, enviado, salvando, erro |
| **Volta ao fim** com a ação em curso | A e B | padrão, hover, foco, pressionado, sem novidade |
| **Grupo de painéis** | A e B | padrão, hover, foco, painel aberto, desabilitado |
| **Posição** (pontos das etapas, etapa, posição) | A (B com o trilho dobrado) | padrão, hover, foco, aberta |
| **Barra do pedido**, formas novas: dois pedidos, a outra conversa também espera, pronta para encerrar em verde | A e B | as do system |
| **Barra de rolagem** | A e B | repouso, hover (`--line-2`, `--line-3`, sem trilho) |
| **Painel auxiliar** e **coluna de decisão** (a forma que `components.md` reservou) | A e B | coluna e cobertura, com a regra de largura. A coluna tem 280 px abaixo de 900 px de área principal |

Nenhum token novo. Duas larguras são escritas em tokens existentes, e ficam propostas como tokens se a B vencer:

- o trilho: `clamp(calc(var(--space-16) * 4), 14%, calc(var(--space-16) * 5))`;
- a margem de marcos: `calc(var(--space-16) * 3.5)`.

## Onde a proposta toca o que está registrado

- **O topo, o progresso e os agentes** estavam em aberto (`structure.md` §9). As duas variações os substituem por inteiro: a trilha de chips, a barra do step e as abas deixam de ser faixas. O que continua valendo sem mudança:
  - a barra do pedido e o único lugar da ação;
  - a regra da situação;
  - o compositor;
  - os painéis fechados por padrão e a regra de largura;
  - o `⋯` com as ações destrutivas;
  - **Pause** só no cabeçalho.
- **A barra do pedido** fala da voz em foco e aponta a outra com **Go to…**, nas duas variações, como `structure.md` §3 diz.
- **Os apontamentos da PR da task passam de texto a cartão** (seção acima), o que muda `features §Review de pull request`.
- **Duração de etapa e de step** continua fora (`decisions.md`, 2026-09-23). A B mostra a hora de início e o commit, não a duração. A duração de um grupo de ações vem da conversa.
- **O botão de modo de review** mostra o robô e `Agent`, como `features §Modo de review` descreve, no lugar de `Review: Agent`.

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| O `description` do Bash como rótulo da ação | O rótulo de toda ação (86 a 94% são Bash) | Pequeno: já chega em `handleAssistant` e é descartado (`labels.go`) |
| Duração e código de saída de uma ação | `8.2 s`, `exit 1` na linha e a duração do grupo | Pequeno: o fim chega em `handleUser`. O código vem do resultado do Bash |
| `parent_tool_use_id` e a descrição do subagente | Aninhar as ações do subagente | Pequeno: já é lido e descartado (`protocol.go`) |
| O tipo da mensagem do produto (relatório, passada, commit, correção, abrir a PR) e o Markdown dela | A mensagem do produto como marco com resumo | Pequeno no backend (um campo). O Markdown é só frontend |
| A instrução com que a sessão começou | `Started with steps/03-token-bucket.md` | Só frontend para step e One-Shot (`Step.file` e `ReadArtifact`). Pequeno para tech spec, plano, PR e review da PR, cujo prompt vai vazio |
| Número de apontamentos de cada relatório de step | `Review 1 · 2 findings` | Pequeno: `Step.reports[]` só tem a passada e `clean` |
| Apontamentos estruturados no review da PR da task, com decisão guardada e **Apply approved** | O cartão de decisão | **Médio**: usar para a task o formato de relatório e a decisão do centro de review, e mudar o prompt de review de PR. Muda uma feature |
| Checks pelo nome durante `Waiting for checks` | O bloco dos checks | Pequeno, já em `structure.md` §8 |
| `sessionStatus` de cada sessão do item | O glifo de cada voz (A) e de cada lugar (B); o erro da outra conversa | Pequeno, já em `structure.md` §8 |
| **Retry** da sessão certa | **Retry reviewer** | Pequeno: o frontend acha só tasks e segue o implementador (`app-store.ts:250`). Falta repetir por sessão |
| Marcos de decisão do usuário: rascunho aprovado, apontamentos decididos, mudanças aprovadas | `You approved the draft`, `You decided` | Pequeno: tipos novos de marcador |
| Hora do commit de um step e quem fez o merge | O marco do commit, `Merged by lnakamura` | Pequeno: o git e o `gh` já sabem |
| Início de cada etapa e step | As horas dos capítulos (A) e do trilho (B) | Só frontend na A, pelos marcadores. Pequeno para a B, sem carregar as conversas |
| **Só na A:** todas as conversas da task de uma vez, ordenadas por `createdAt` | O stream contínuo | **Médio no frontend**: um `GetTranscript` por sessão, os eventos de todas as sessões do item, e virtualização (um step p90 tem 89 entradas, uma task de sete steps passa de mil). Pequeno no backend: a lista das sessões da task |
| Opções de uma pergunta em texto | As pastilhas de resposta rápida | Nenhum: heurística do frontend sobre `a)`, `1.` no último parágrafo |

## Como foi testado

- Chromium headless, pelo `http.server` da lab, com a Fira do Google Fonts.
- As nove cenas das duas variações foram capturadas nos dois modos a 1.250 e 2.500 px (72 capturas), e olhadas. Também foram capturadas a 1.100 px e com painel aberto.
- `?audit` rodou nas mesmas 72 combinações, e em três cenas por variação a 1.100, 2.500 e 2.600 px. Em todas:
  - nenhuma caixa que o layout posiciona fica em meio pixel;
  - nenhum texto corta sem tooltip;
  - a página nunca rola na horizontal;
  - nenhum texto fica abaixo de 4,5:1 sobre o fundo real, com os véus compostos. O único par abaixo, o `›` decorativo em `--line-deco` (3,45:1, `aria-hidden`), fica fora da conta.
- `components.html` abre, e o mesmo `?audit` roda nele com `?show=light` e `?show=dark`: nenhum texto abaixo de 4,5:1 e nenhum controle sem nome. O texto com brilho (`Checking GitHub…`) é medido na parada mais fraca do gradiente, `--ink-3`. A grade do espécime usa frações, e a geometria dele não é medida.
- A renderização final é a do WebKitGTK, no app.

## Depois da crítica

O `critique.md` desta rodada achou defeitos de execução. Todos os que o coordenador pediu foram corrigidos nesta pasta, nas duas variações, sem rodada nova.

1. **`components.html` abre.** Havia um `)` a mais em `src/components.js`, e o script parava antes de desenhar. O contraste do espécime foi medido de verdade, por modo: nenhum texto abaixo de 4,5:1 e nenhum controle sem nome. A frase anterior sobre esse contraste era falsa, porque a página não abria. O espécime também ganhou a forma "a outra conversa também espera" da barra, e o estado desabilitado da mensagem do produto passou a ser o de uma sessão pausada.
2. **O topo cede em ordem, e o título por último.** A única regra, de 1020 px de área principal, virou uma sequência medida no próprio cabeçalho, a cada mudança de largura e depois que as fontes carregam. Cada passo só entra se o anterior não bastou:
   1. o breadcrumb vira o menu `…`;
   2. `acme/api#412` vai para o tooltip do título;
   3. a posição fica com o nome da etapa;
   4. **Agent** e **Models** vão para o `⋯`;
   5. **Pause** fica com o ícone, com nome acessível;
   6. a posição perde os pontos.

   O nome da etapa nunca sai (princípio 5), e o título só corta se tudo isso não bastar. O `?audit` passou a medir a sobreposição de qualquer peça do topo e o corte do título.
3. **Todo botão de ícone tem nome e tooltip:** **Milestones**, **Open in VS Code**, **Open PR**, **Pause** na forma curta e cada nó do trilho dobrado da B. O `?audit` lista qualquer controle sem nome.
4. **O progresso da barra do pedido não corta.** O texto do meio vai para a linha de baixo antes de cortar (`1 of 4 decided`, o que o encerramento faz). O resumo do subagente corta com reticências e tooltip.
5. **A: sem destinatário no compositor.** É a alternativa que o README já registrava:
   - o compositor escreve para a voz que o filtro mostra, ou, com `All`, para quem pediu por último;
   - o placeholder diz para quem;
   - a pergunta e a permissão se respondem no cartão.

   O filtro de vozes esconde as falas e as ações da outra voz, nunca um cartão de pergunta, permissão ou decisão ainda aberto. **Show** sempre chega a um cartão visível.
6. **O fio da pergunta em texto** usa `--state-wait-ring`, o contorno do glifo de espera: 4,31:1 no claro e 9,43:1 no escuro sobre `--surface-1`, contra 1,52:1 e 2,09:1 antes.
7. **O que a A trouxe da B.**
   - A barra do pedido fala da voz em foco e aponta a outra com **Go to reviewer**, que passa a barra e o compositor ao revisor e leva ao cartão dele.
   - A margem de marcos tem uma segunda linha por item, com os fatos de longe: o commit e as passadas de cada step feito, o estado do atual, o modo e o modelo dos que faltam, e o que cada etapa produziu.
   - Na cena `checks`, a PR vira um capítulo dobrado, e o capítulo atual é o PR review: os checks pelo nome e `The review conversation starts when the checks finish.`

Também corrigido, da mesma crítica:
- `Review again` não aparece antes da primeira passada (as duas variações);
- as teclas dos pedidos estão ligadas: `1`–`9` num cartão, `A` e `D` num apontamento, `Alt+↓` e `Alt+↑` entre apontamentos;
- os tempos e os marcos futuros são texto, não botões desabilitados sem tracejado;
- o filtro de vozes é um `radiogroup` com `aria-checked`, e os tempos do loop são itens de lista;
- o tempo `Review 1 · 2 findings` diz o que é o número;
- a coluna de decisão e o trilho caem em pixel inteiro.

**Como foi testado depois da crítica.**
- `?audit` nas nove cenas das duas variações, nos dois modos, a 1100, 1250, 1400, 1600, 1700, 1850 e 2500 px, 252 combinações. O resultado cobre:
  - geometria em pixel inteiro;
  - nenhum corte sem tooltip;
  - nenhuma sobreposição no topo, e o título inteiro em todas;
  - nenhum controle sem nome;
  - contraste de 4,5:1 ou mais;
  - nenhuma rolagem horizontal.
- As capturas foram refeitas e olhadas nessas larguras.

**O que a crítica levanta e fica para o coordenador e o usuário:**
- os estados que nenhuma cena mostra, em especial o rascunho da PR e a revisita (0.7);
- as duas perguntas de `conversation.md` §7, que são do usuário (0.8);
- os rótulos da resposta rápida, que hoje são paráfrases (0.9);
- a mudança de feature dos apontamentos com **Apply approved**;
- a regra quieta ou tingida da barra com o cartão de review e o de apontamentos na tela (A.5);
- as quedas da B na metade do monitor (B.1, B.3, B.4).

## Recomendação

**A · Conversa com marcos**, com a decisão dos apontamentos no cartão.

- **É a resposta mais direta ao que o usuário disse.** A conversa é o ponto mais importante, e o topo, o progresso e os agentes seguiam o padrão atual. Na A, o topo encolhe para uma faixa, o progresso vira a própria conversa (capítulos, tempos do loop, margem de marcos), e os dois agentes aparecem conversando, com a troca entre eles legível.
- **Serve ao jeito de trabalhar do brief §2.** O usuário vai embora enquanto o step corre em `Agent` e volta pela notificação. Ao voltar, ele lê o que aconteceu de cima para baixo, sem trocar de aba para montar a história, e o pedido está no fim, com a barra.
- **Funciona em toda a faixa de largura, com uma coluna.** A B paga três colunas na área principal, e na metade do monitor, que o usuário usa, perde a espinha quando há coluna de decisão ou painel. A B também põe um segundo trilho ao lado da árvore, duas listas verticais lado a lado.

O que a A pegou da B depois da crítica: a barra que aponta a outra conversa com **Go to…**, os fatos de cada step de longe na margem de marcos (commit, passadas, modo e modelo do que falta) e o vazio do PR review durante os checks.

Os riscos da A, para o crítico e para o usuário julgarem:

- **O compositor sem destinatário à vista.** Ele segue o filtro ou quem pediu por último; o placeholder é o único aviso de para quem vai a mensagem.
- **O custo do stream contínuo** no frontend (tabela acima).

## Decisão

2026-09-24. As duas variações foram descartadas pelo usuário: ficaram piores que a tela atual, por poluição. Ele não precisa voltar às conversas anteriores; quer uma tela limpa e minimalista com um indicador de progresso simples e bonito. Ver `design/decisions.md`. A rodada `10-screen-task-minimal` recomeça com essa régua.
