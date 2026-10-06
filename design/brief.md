# Brief

Fase 1, aprovado em 2026-09-23. É o que o designer e o crítico leem antes de qualquer proposta. Descreve o produto do ponto de vista de quem o usa; não propõe design.

Fontes e como são citadas: `entrevista` = `design/research/interview.md`; `features §X` = seção de `docs/product/features.md`; `overview` = `docs/product/overview.md`; `screens §N` e `journeys §N` = os levantamentos em `design/research/`, que têm o detalhe que este brief não repete.

## 1. O produto em uma frase

MySpec é a mesa de trabalho de um desenvolvedor que conduz o Claude Code por um workflow fixo, da definição de uma task até a pull request, e do review das pull requests de outros até a publicação de cards num board; o produto faz o mecânico sozinho e só chama o usuário quando algo depende dele (`overview`, Visão geral e Princípios).

O padrão da experiência:

- **Produto profissional de gerenciamento de agentes e workflows de IA**, com estrutura, navegação, hierarquia e linguagem visual pensadas com o todo em mente, não componentes encaixados um a um (`research/origin.md`, O problema).
- **Sóbrio, nada extravagante.** É a ferramenta em que o usuário passa o dia, não uma vitrine.
- **"A experiência é o produto"** e **"'Depende de mim' é um estado de primeira classe"** são princípios escritos do produto (`overview`, Princípios); o redesenho é o produto cumprindo-os.

## 2. Quem usa e como

Uma pessoa: o desenvolvedor dono da máquina, com a própria conta do `gh` e o Claude Code instalado, num desktop Linux (`features §Boards`; `docs/architecture/stack.md`). Uma instância do app por vez (`features §Repositórios`). O app é o centro do trabalho diário (`research/origin.md`).

| Aspecto | Fato | Fonte |
|---|---|---|
| Volume num dia cheio | 1 a 3 tasks, 1 a 2 reviews de PR, 1 discussão | entrevista |
| Enquanto o agente trabalha | Vai para outra coisa e volta pela notificação | entrevista |
| Modo de review dos steps | Mais `Agent`: a task corre sozinha até a pull request | entrevista; `features §Criação de uma task` |
| Ao voltar | Confere os itens que dependem dele; a cor de status na árvore basta | entrevista |
| Por onde o dia começa | Sem padrão: um card do board, o que há para revisar, ou uma discussão | entrevista |
| Itens na tela | Uma task por vez basta | entrevista |
| Painéis laterais (artefatos, card) | Usa mais fechados | entrevista |
| A tela de interação com o agente | "Ponto importantíssimo", a que mais precisa de refino; "no geral está amadora", sem dor específica | entrevista |
| O que importa ver | Tempo, porcentagem da janela de contexto, o que o agente está fazendo agora. Tokens e dólares não | entrevista |
| Janela | Monitor ultrawide, às vezes em tela cheia, às vezes ao lado de outra janela | entrevista |
| Settings e History | Raros | entrevista |
| Os modos de uso | Três, as três coisas para as quais o app é aberto: **discussão** (entender uma demanda e publicar cards), **implementação** (conduzir tasks até a pull request) e **revisão** (revisar pull requests de outros) | entrevista |

**Dois regimes de atenção**, que decorrem dos fatos acima:

| Regime | Quando | Como o usuário está |
|---|---|---|
| **Síncrono**: conversa de ida e volta | Planejamento (PRD, tech spec, plano, One-Shot: uma pergunta por vez), discussão, decisão de apontamentos e de rascunhos | Na conversa, respondendo; espera cada turno do agente (`features §Etapas de planejamento`, `§Discussão`) |
| **Assíncrono**: acompanhar e ser chamado | Implementação no modo `Agent`, espera de checks, review de PR em andamento | Fora do app; volta pela notificação só em erro, bloqueio, permissão, pergunta, passada sem relatório ou step que passou a ele (`features §Depende de mim`) |

## 3. Os objetos do modelo mental

```
Board (GitHub Projects) ── administra ──> Repositório (no máximo 1 board por repositório)
  └── Card (issue) ── 0..1 task ativa; pode ter épico, irmãos, dependências
  └── Discussão ── lê os clones do board ── produz Documento + Rascunhos ── publicam Cards

Repositório ── Task (modo Structured ou One-Shot, fixo; modo de review Manual ou Agent)
                 ├── Etapas: PRD › Tech spec › Plan › Implementation › PR (Structured)
                 │           Planning › Implementation › PR (One-Shot)
                 ├── Steps (na implementação), cada um = 1 commit
                 ├── 1 worktree, 1 branch, 1 pull request (+ o review dela)
                 └── Artefatos (documentos, arquivos de step, relatórios, rascunho da PR)

Repositório ── Pull request de qualquer autor ── 0..1 Review de PR (centro de review)

Cada etapa, step, revisor de step, PR, review e discussão ── Sessão (uma conversa)
Cada lugar (etapa, step, revisor, PR, review, discussão) ── 0..1 Situação ("depende de mim")
Task, review e discussão encerrados ── Histórico
```

Fontes: `overview`, Conceitos; `features §Boards`, `§Discussão`, `§Repositórios`, `§Centro de review`, `§Sessões e conversas`; `journeys §2` (lugares de situação).

| Objeto | De relance | Só ao abrir |
|---|---|---|
| **Repositório** | Nome curto; se o clone sumiu (bloqueia criar task, primeiro step e encerramento) | Caminho, contagens, instruções de review, clone, `Change path` (`features §Página Repositories`, `§Clone inexistente`) |
| **Board e card** | Que o board existe e se a última leitura falhou; num card: se tem task e se ela `Waits for you` | Filtros, seções por status, corpo, campos, épico, irmãos, dependências, PRs vinculadas (`features §Visão do board`) |
| **Épico** | Agrupa as tasks dos seus cards | Corpo e irmãos, no card (`features §Tela de boas-vindas e barra lateral`) |
| **Task** | Nome; tipo `One-Shot`; etapa atual; na implementação, `Step N of M` e o estado do step; se depende do usuário e de quê | Repositório e `#card`, que na árvore aparecem também em hover, no foco e na linha aberta; trilha de etapas, conversa, lista de steps com modelos e modos, artefatos, modelos por etapa, ações de voltar, descartar, apagar (`features §Criação de uma task`, `§Voltar e descartar`) |
| **Step** | Número e estado: implementando, `Agent review · pass N`, `Addressing review · round N of 3`, `Committing`, aguardando review com `% staged` | Conversas `Implementer` e `Reviewer`, arquivos mudados, relatórios, razão do bloqueio (`features §Implementação`) |
| **Sessão** | Trabalhando, ociosa, pausada, com erro; porcentagem de contexto; o que o agente faz agora (entrevista) | A conversa inteira, fila, modelo e esforço (`features §Sessões e conversas`) |
| **Situação** | Que existe, de que tipo (erro, espera, encerramento), há quanto tempo; quantas o item tem | O lugar exato e o que pede: o cartão, a barra, a aba (`features §Depende de mim`; catálogo em `journeys §2.1`) |
| **Artefato** | Que foi escrito (marcador na conversa) | O documento renderizado, com mermaid (`features §Etapas de planejamento`) |
| **Pull request da task** | Estado na etapa de PR: rascunho a aprovar, esperando checks, apontamentos, pronta, `Checks failed`, mergeada, pronta para encerrar | Número, link, rascunho, relatórios, checks que falharam pelo nome, resultado do encerramento (`features §Pull request`) |
| **Review de PR de terceiros** | Quantas PRs estão pendentes; cada review ativo com `repo#N`, título e estado | Apontamentos com decisão, relatórios, veredito, publicação (`features §Centro de review`) |
| **Discussão e rascunho** | Título, board, estado (`Discussing`, `Decide drafts`…) | Conversa, documento, rascunhos com decisão, épicos, publicação (`features §Discussão`) |
| **Histórico** | Que existe (contagem) | Tasks, reviews e discussões arquivados, com artefatos finais; conversas só das discussões (`features §Histórico`) |

## 4. As jornadas

Detalhe passo a passo em `journeys §1`; catálogo de situações em `journeys §2.1`. **[espera U]**: o produto ou o agente parado esperando o usuário. **[U espera]**: o usuário esperando o agente ou o GitHub. Frequência a partir da entrevista.

### J1. Voltar pela notificação (o laço do dia, transversal)

| Momento em que U age | O que precisa ver para agir |
|---|---|
| Recebe a notificação fora do app e clica | Qual item e o que ele pede; o clique abre o lugar certo (`features §Depende de mim`) |
| Volta ao app por conta própria | Quais itens dependem dele, pela cor na árvore (entrevista) |
| Age e sai de novo | Que o item voltou a andar |

Sozinho: notifica uma vez por situação, com som; pisca a situação que nasce com a janela em foco; mudanças de forma não notificam (`features §Depende de mim`).

### J2. Criar uma task (frequente)

| Momento em que U age | O que precisa ver para agir | Espera |
|---|---|---|
| Escolhe um card no board (`Start task`, `S`) ou cria livre (`Ctrl+N`) | Se o card já tem task, se o repositório tem clone, dependências não satisfeitas (aviso, nunca bloqueia) | [U espera] clone em segundo plano; releitura do card com mais de 5 min |
| Preenche nome, contexto, modo, modo de review, modelos | O que cada modo faz; que o modo nunca muda; o contexto montado do card | |
| Confirma | | [U espera] a primeira pergunta do agente |

Sozinho: monta o contexto do card, abre a primeira sessão no clone, desfaz a task se a sessão não começa (`features §Criação de uma task`, `§A partir de um card`).

### J3. Planejar (síncrono; Structured: PRD, tech spec, plano; One-Shot: planning)

| Momento em que U age | O que precisa ver para agir | Espera |
|---|---|---|
| Responde cada pergunta (cartão ou texto) | A pergunta, as opções, os trade-offs; o documento anterior, às vezes | [espera U] a cada pergunta; [U espera] cada turno, sem indicação de quanto falta (`journeys §4.8`) |
| Confirma o entendimento do agente | O resumo que ele lista | |
| Corrige um plano inválido | Os problemas, depois de 3 correções automáticas | [espera U] |
| Volta a uma etapa ou descarta | Exatamente o que será perdido | [espera U] em revisita até `Continue` |

Sozinho: detecta o documento escrito com a sessão ociosa e inicia a etapa seguinte; valida o plano e pede correção ao agente até 3 vezes (`features §Etapas de planejamento`, `§Voltar e descartar`).

### J4. Implementar e revisar steps (Agent é o caminho principal)

| Momento em que U age | O que precisa ver para agir | Espera |
|---|---|---|
| **Agent**: quase nunca. Só em erro, bloqueio, permissão, pergunta do implementador ou do revisor, passada sem relatório, ou step que passou a ele após 3 rodadas | Em que step, em qual conversa (`Implementer` ou `Reviewer`), o que pede; os relatórios | [U espera] o step inteiro; o produto não notifica um step commitado |
| **Agent**: toma o review para si (`Review myself`) | O progresso do loop (passada, rodada) | |
| **Manual**: revisa no VS Code, dá stage arquivo a arquivo | Lista de arquivos e progresso de stage ao vivo | [espera U] |
| **Manual**: aprova | O que falta para `Approve` habilitar | [U espera] o commit |
| Step bloqueado (worktree suja, fetch, clone) | A saída do git; `Try again` ou `Clean and start` | [espera U] |

Sozinho: cria a worktree, verifica que está limpa, abre cada step, chama o revisor, entrega relatórios, pede o commit, inicia o step seguinte (`features §Implementação`, `§Review pelo agente`).

### J5. Pull request da task, review dela e encerramento

| Momento em que U age | O que precisa ver para agir | Espera |
|---|---|---|
| Aprova ou edita o rascunho da PR | Título e corpo; `Closes owner/name#N` numa task de card | [espera U] |
| — | Que a PR está esperando os checks | [U espera] o GitHub; hoje sem dizer quais checks nem há quanto tempo (`journeys §1.6`) |
| Decide os apontamentos do review, item a item, na conversa | O relatório | [espera U] |
| Revisa e aprova as mudanças aplicadas (como step `Manual`) | Progresso de stage | [espera U] |
| Reage a check com falha ou conflito que surgiu depois de pronta | Os checks pelo nome, o conflito | [espera U] |
| Faz o merge no GitHub (fora do produto) e aciona `Close task` | Que a PR está pronta, depois mergeada | [espera U] |

Sozinho: abre a PR, lê checks e conflito a cada minuto, inicia cada passada de review, pede nova passada depois de cada commit, encerra (worktree, branch, base) e arquiva (`features §Pull request`, `§Encerramento e arquivamento`).

### J6. Revisar a PR de outra pessoa (1 a 2 por dia)

| Momento em que U age | O que precisa ver para agir | Espera |
|---|---|---|
| Escolhe uma PR na lista | Pendentes (nunca revisadas ou com commits novos), autor, labels, card | Uma pendente sem review não notifica (`features §Pendente de review`) |
| Inicia o review (instruções, modelo, `Publish`/`Apply`) | | [U espera] checks e a passada |
| Decide cada apontamento (`Approve`/`Discard`, edita o texto) | Localização no diff (abre no editor), texto, `N of M decided`, `New commits since this pass` | [espera U] |
| Publica (veredito) | O que vai inline e o que vai no corpo | [espera U] |
| Reage a commits novos, check com falha ou conflito (`Review again`) | O que mudou | [espera U] |

Sozinho: relê as PRs a cada 5 min e as com review ativo a cada minuto; espera os checks; encerra e arquiva o review quando a PR é mergeada ou fechada, sem notificar (`features §Centro de review`). No modo `Apply`, o ciclo é o de J5 (`features §Corrigir a própria pull request`).

### J7. Discutir uma demanda e publicar cards (1 por dia)

| Momento em que U age | O que precisa ver para agir | Espera |
|---|---|---|
| Inicia do board (`New discussion`, `Discuss`, `D`) | Cards selecionados, contexto | |
| Conversa até o entendimento fechar | Perguntas do agente | [espera U] cada turno sem pergunta antes dos rascunhos |
| Decide e edita rascunhos, agrupa em épico | Tipo (novo, atualização com diff contra o card, épico), repo, módulo, dependências, `Waits for <título>` | [espera U] |
| Publica e trata falhas (`Retry`) | Estado por cartão, `Created`/`Updated` com link | [espera U] em falha |
| Arquiva | O que impede (aprovados pendentes, falha) | |

Sozinho: publica cada rascunho solto aprovado na hora, respeita a ordem das dependências, relê o board depois (`features §Discussão`).

### J8. Raros: cadastrar, configurar, consultar o histórico

Cadastro de boards e repositórios (primeira execução e manutenção), `Defaults`, prompts, histórico. Nada aqui gera situação; falhas de leitura de board aparecem só onde a leitura foi pedida (`features §Falhas`; `journeys §1.1`, `§1.9`; entrevista: Settings e History raros).

Ações transversais sobre uma task, disponíveis a qualquer momento: `Pause`/`Resume`, `Models`, trocar o modo de review, voltar a uma etapa, descartar etapa ou step, apagar com prévia do que será destruído (`journeys §1.3`).

## 5. De longe e a um clique

**Decisão do usuário** (entrevista): a árvore da barra lateral, com o status por cor, é o mecanismo de "depende de mim". Não existe uma seção que repita os itens que esperam, como a atual `Waiting for you`. A notificação continua sendo o que traz o usuário de volta. O volume baixo não justifica uma visão agregada em tabela; a árvore precisa ser excelente, não substituída.

Consequência factual: hoje o tempo de espera de cada situação (`now`, `5m`, `2h`) e a ordem por urgência que `Ctrl+J` segue só aparecem em `Waiting for you` (`journeys §2.2`). As duas coisas são features e continuam existindo sem a seção.

**Visível de longe, sem abrir nada**

| O quê | Por quê | Fonte |
|---|---|---|
| Cada item ativo: task, review de PR, discussão, com o tipo reconhecível | São os três itens que conduzem trabalho | `features §Tela de boas-vindas e barra lateral` |
| Se o item depende do usuário, com a gravidade (erro, espera, encerramento) e o que pede | Mecanismo de "depende de mim" | entrevista; `journeys §2.1` |
| Mais de uma situação no mesmo item (implementador e revisor ao mesmo tempo) | Uma task pode esperar em dois lugares | `features §Depende de mim` |
| Há quanto tempo espera | Hoje só em `Waiting for you` | `journeys §2.2` |
| Onde a task está: etapa, `Step N of M`, estado do step ou da PR | Acompanhar o regime assíncrono | `features §Tela de boas-vindas e barra lateral` |
| Se o agente está trabalhando, e o que está fazendo agora | Pedido na entrevista | entrevista |
| Porcentagem da janela de contexto | Pedido na entrevista | entrevista |
| Há quanto tempo o agente trabalha no turno atual | Pedido na entrevista; ver seção 11 | entrevista |
| Contagem de PRs pendentes de review | O dia às vezes começa por aí | entrevista; `features §Pendente de review` |
| Falha de leitura de um board, clone inexistente | Bloqueiam trabalho sem gerar situação | `features §Falhas`, `§Clone inexistente` |

**Pode esperar um clique**

- A conversa e tudo nela; a lista de steps com modelos e modos; os artefatos e relatórios; a fila de mensagens (`journeys §3`).
- A razão detalhada de um bloqueio e os checks que falharam pelo nome (`journeys §3`).
- Os painéis auxiliares (artefatos, card, relatórios, documentos): fechados por padrão, com abertura fácil (entrevista).
- Detalhe de card, filtros do board e da lista de PRs.

**Pode ficar fora do caminho principal**: Settings, History, cadastro de boards e repositórios (entrevista; `journeys §1.1`).

**Fora**: custo em tokens e dólares (entrevista).

## 6. A conversa com o agente

**Por que é a tela central**

- Tudo o que o agente faz passa por uma conversa: cada etapa de planejamento, cada step (e o revisor dele), a PR e o review dela, cada review de PR, cada discussão (`features §Sessões e conversas`).
- É onde o regime síncrono acontece inteiro, e onde o assíncrono desemboca quando algo depende do usuário (seção 2).
- O usuário a nomeou a tela mais importante e a que mais precisa de refino; hoje "amadora" (entrevista).
- É um componente só, compartilhado por task, review e discussão (`screens §2.10`).

**O que acontece nela**

| Elemento | O que é | Fonte |
|---|---|---|
| Mensagem do usuário | Texto; enviada com o agente ocupado, entra numa fila visível e removível | `features §Sessões e conversas` |
| Mensagem do produto | O que o produto envia ao agente: prompt de commit, relatório entregue ao implementador, pedido de nova passada; rotulada `MySpec · sent to the agent` | `features §Review pelo agente`; `screens §2.10` |
| Resposta do agente | Markdown em streaming, com mermaid e realce de código; pode ser `Interrupted` | `features §Sessões e conversas` |
| Ações do agente | Chamadas de ferramenta agrupadas entre duas falas, cada uma com rótulo e alvo e status (running, done, error, interrupted); a ação em curso aparece no resumo do grupo. Não mostram diff nem saída da ferramenta | `chat/entries/ActionGroup.tsx` |
| Atividade | `Starting session…`, `Thinking…`, `Retrying (attempt N)…` | `screens §2.4` |
| Pergunta estruturada | Cartão com opções e `Other…`; a resposta volta pelo mesmo canal | `features §Sessões e conversas` |
| Escalada de permissão | Cartão com a ferramenta e a entrada exata; permitir uma vez, pela sessão, ou negar com mensagem | `features §Sessões e conversas` |
| Marcadores | Documento escrito ou atualizado, etapa ou step iniciado ou reiniciado, review iniciado, `Review N written · clean/changes`, contexto compactado, interrompido | `chat/entries/Marker.tsx` |
| Erro | Com `Retry` quando cabe (`Claude Code not found`, `isn't logged in`, `stopped unexpectedly`…) | `screens §2.4` |
| Controles | Enviar, interromper, pausar e retomar, trocar modelo e esforço a partir da próxima mensagem, medidor de contexto | `features §Sessões e conversas`, `§Modelos e esforço` |
| Rolagem | Nunca sobe sozinha; acompanha o fim; fora do fim, um botão volta e diz `New messages` | `features §Sessões e conversas` |

**O que vive colado à conversa, conforme o item** (`screens §2.4`, `§2.6`, `§2.7`)

- Task: trilha de etapas; problemas do plano acima do compositor; barra do step; faixa de review com progresso de stage; abas `Implementer` e `Reviewer`, cada uma com o estado e a cor da situação; barra da PR; rascunho editável da PR.
- Review de PR: barra do review; painel de apontamentos com `N of M decided`, cartões com `Approve`/`Discard` e texto editável.
- Discussão: barra da discussão; painel de rascunhos com `N of M decided`, cartões editáveis, grupos de épico.
- Os três: painel lateral de documentos (artefatos, relatórios, contexto).

**Diffs e decisões, como são hoje**

- O produto não mostra o diff de um step: no `Manual` o review é no VS Code, com a lista de arquivos e o stage no produto; no `Agent`, o usuário vê os relatórios do revisor (`features §Review`, `§Review pelo agente`; `journeys §4.8`). O único diff na interface é a aba `Changes` do rascunho de atualização de card (`features §Rascunhos de cards`).
- Os apontamentos do review da PR de uma task são decididos em texto, na conversa (`features §Review de pull request`); os do centro de review, em cartões com decisão (`features §O relatório e a decisão`).

**O que ela precisa fazer bem** (requisitos, não layout)

1. Deixar óbvio, de um olhar, de quem é a vez: do usuário (e o que ele precisa fazer) ou do agente (e o que está fazendo agora).
2. Distinguir quem fala: usuário, agente implementador, agente revisor, produto.
3. Tornar pergunta, permissão e decisão impossíveis de perder, e respondíveis pelo teclado.
4. Mostrar a atividade do agente sem afogar a leitura: sessões longas acumulam muitas ações.
5. Dar acesso a documentos e relatórios sem exigir painéis abertos (entrevista: painéis fechados).
6. Tratar os eventos do workflow (etapa começou, documento escrito, relatório) como marcos legíveis na linha do tempo.
7. Ser a mesma conversa em task, review e discussão, com o que é próprio de cada item em volta dela.
8. Ficar legível nas duas larguras de janela (seção 9).

## 7. Estados que toda tela trata

| Estado | Onde ocorre | Como é hoje | Fonte |
|---|---|---|---|
| **Vazio** | App sem board e sem repositório; sem tasks; board sem issues; filtros sem resultado; sem PRs abertas; histórico vazio; artefatos ainda não escritos | Textos próprios (`This board has no issues.`, `No open pull requests.`, `Nothing archived yet`, `No artifacts yet`…); a página Repositories não tem vazio | `screens §2.2`, `§2.3`, `§2.5`, `§2.8`, `§2.9` |
| **Carregando** | Início do app; primeira leitura de board e de PRs; conversa; documento; releitura de card; clone | Início do app é tela em branco, sem indicador; o resto usa esqueleto ou spinner; releituras mostram o guardado com um indicador | `screens §1.1`, `§2.3`, `§2.4` |
| **Erro** | Sessão; leitura do GitHub por board e por repositório; step bloqueado; PR bloqueada; passada bloqueada; publicação; migração; erro genérico no topo; arquivos que ficaram no disco | Cada um com a razão e a saída (`Retry`, `Try again`, `Clean and start`, `Change path`); falha de leitura nunca esconde o que estava guardado | `features §Falhas`, `§Leitura das pull requests`; `journeys §2.1`; `screens §1.1` |
| **Aguardando o usuário** | Os 22 kinds de situação em task, review e discussão | Cor de atenção só vem de situação; notificação, flash, rótulo | `journeys §2.1`, `§2.2` |
| **Agente trabalhando** | Qualquer sessão; também o GitHub "trabalhando" (`Waiting for checks`) | Ponto pulsando, `Thinking…`, ação em curso; espera de checks não é situação | `screens §2.4`, `§3.1`; `features §Review de pull request` |
| **Pausado e ocioso** | Sessão pausada; sessão parada sozinha após 10 min ociosa | Pausado e ocioso têm o mesmo cinza; erro de sessão sem situação também fica ocioso | `screens §3.1`, `§5`; `features §Sessões e conversas` |
| **Muitos itens** | Board (até 2.000 issues), lista de PRs, histórico, conversa longa, muitos steps | Listas roláveis, sem virtualização nem paginação | `screens §2.3`, `§5` |
| **Item que sumiu do estado** | Task encerrada, review encerrado por merge enquanto aberto, item apagado, card fora da última leitura | Área principal vazia sem mensagem; aviso momentâneo de arquivamento; `This card isn't in the last reading of the board.` | `screens §5`; `features §Encerramento e arquivamento`, `§O review como item`, `§A partir de um card` |

## 8. Dados que a experiência pede e o backend ainda não expõe

Filtrado pelo que o usuário disse que importa (entrevista): tempo, contexto, atividade atual. Base: `journeys §4.8`.

| Dado | Hoje | Custo para mostrar |
|---|---|---|
| Há quanto tempo uma situação espera | Exposto (`Situation.startedAt`) e mostrado só em `Waiting for you` | Só frontend |
| Porcentagem de contexto de cada item | Exposto por item (`contextPercent` no bloco de sessão de task, review e discussão), mostrado só no cabeçalho do item aberto | Só frontend |
| O que o agente faz agora, no item aberto | Na conversa (`ActionEntry` running com rótulo e alvo) | Só frontend |
| O que o agente faz agora, sem abrir o item | O `State` só tem `turnRunning` | Backend pequeno: a ação em curso no resumo do item |
| Há quanto tempo o agente está no turno atual | Derivável da conversa, só no item aberto | Frontend no item aberto; backend pequeno (`turnStartedAt`) para os outros |
| Quando a task começou, última atividade | `createdAt` e `updatedAt` chegam e não são usados na task ativa | Só frontend |
| Início da sessão ou etapa; início e fim de cada step | Não exposto (está em `sessions_of_item`, `steps`, git) | Backend pequeno |
| Duração de etapas, tempo total da task, tempo esperando o usuário contra o agente | Não existe: o fim de uma situação só vai ao log | Backend médio: persistir situações encerradas ou uma trilha de eventos |
| Progresso dentro do planejamento (quanto falta) | Não existe; o agente não declara | Exige mudar prompts; fora do alcance do redesenho |

Fora do filtro, registrados para não serem esquecidos: a lista completa de checks durante `Waiting for checks` já é lida e não chega ao frontend (backend pequeno); `checkedAt` da PR chega e não é mostrado (só frontend); contagem de linhas do diff não existe (backend, `git diff --numstat`). Custo em dólares e tokens chega do CLI e é descartado; o usuário não quer vê-lo (entrevista).

## 9. Restrições

| Restrição | Detalhe | Fonte |
|---|---|---|
| Duas larguras de janela | Ultrawide em tela cheia e a metade dele, ao lado de outra janela | entrevista |
| Plataforma | Desktop Linux, Wails v3 com WebKitGTK 6.0 sobre GTK4. Posicionamento em meio pixel borra texto e bordas: centralização arredondada para o pixel | `docs/architecture/stack.md`; `docs/guidelines/frontend.md` §Estilo |
| Notificações do sistema | Pelo D-Bus; o clique abre o lugar da situação; som do produto sem configuração | `features §Depende de mim`; `stack.md` §D-Bus |
| Teclado | `Ctrl+N`, `Ctrl+J`, `Ctrl+,` com o foco em qualquer lugar, inertes com os diálogos de criação abertos; setas na árvore; atalhos do board (`↑↓ ←→ Enter Esc / S Space D`) | `features §Atalhos`; `screens §1.5` |
| Acessibilidade | Cor nunca é o único portador de um estado: todo ponto tem rótulo em texto, também na árvore por cor; papel e nome acessível em toda superfície interativa; foco visível; `role="status"` no que muda sozinho; `prefers-reduced-motion` zera animações | `docs/guidelines/frontend.md` §Acessibilidade |
| Tema | Claro e escuro, seguindo o sistema, com a opção de fixar | `features §Configurações e aparência` |
| Features preservadas | Todas as de `features.md`, inclusive as que perdem o lugar atual (tempo de espera, `Ctrl+J`). Features novas ficam fora da frente | `research/origin.md`, Fora do escopo |
| Textos | Em inglês, curtos, `·` entre partes da mesma linha, o usuário é "you" e o agente "the agent". `features.md` nomeia alguns botões em português (`Tentar de novo`, `Limpar e iniciar`, `Aprovar`, `Descartar step`, `Abrir no VS Code`); na interface eles são `Try again`, `Clean and start`, `Approve`, `Discard step`, `Open in VS Code` | `docs/guidelines/frontend.md` §Componentes; `screens §2.4` |
| Implementação | Primitivos do shadcn gerados em `components/ui`, nunca editados; comportamento diferente é wrapper. Tamanhos em `rem`; cores e durações como tokens | `CLAUDE.md`; `docs/guidelines/frontend.md` |

## 10. Problemas conhecidos que não podem se repetir

- `Waiting for you` repete a árvore e confunde (entrevista); ainda lista a discussão aberta, contra o doc (`screens §5`).
- Task, review e discussão se distinguem só por texto na árvore (`screens §3.4`).
- Pausado, ocioso e erro de sessão sem situação têm o mesmo cinza (`screens §3.1`, `§5`).
- Início do app em branco; item aberto que some do estado deixa a área principal vazia, sem mensagem (`screens §5`).
- Sem caminho de volta: cada abertura zera a anterior, e fechar Settings leva a Home (`screens §1.2`).
- Home com tasks é só `No task open` (`screens §2.2`).
- Barra lateral de largura fixa (21.5rem), sem recolher, e conversa com mínimo de 40%: pensadas para uma largura só (`screens §1.2`, `§2.4`; entrevista).
- O painel de artefatos abre sozinho no primeiro artefato, e o usuário usa os painéis fechados (`screens §2.4`; entrevista).
- Tempo, atividade e contexto só dentro do item aberto; dados que chegam e não são usados (`updatedAt`, `checkedAt`) (`journeys §4.3`, `§4.8`).
- `Waiting for checks` não diz quais checks nem há quanto tempo (`journeys §1.6`).
- Dois fluxos parecidos decididos de formas diferentes: apontamentos da PR da task em texto na conversa, do centro de review em cartões (`features §Review de pull request`, `§O relatório e a decisão`).
- Vocabulário visual genérico e sem sistema: shadcn padrão, tamanhos fora da escala, tokens sem uso, ícones duplicados, abas feitas à mão, dois componentes `DraftCard` distintos (`screens §3.3`, `§3.4`, `§4.1`, `§4.2`).

## 11. Decisões que fecharam o brief

Respondidas pelo usuário em 2026-09-23; registradas em `design/decisions.md`.

- **Tempo.** Aparecem há quanto tempo um item espera pelo usuário e há quanto tempo o agente está trabalhando no turno atual. Duração total de task, etapa ou step fica fora desta frente.
- **Contexto e atividade de longe.** A porcentagem de contexto e a ação em curso do agente aparecem sem abrir o item, de forma compacta, só nos itens em que o agente está rodando. O resumo do item ganha a ação em curso no backend.
- **Larguras-alvo.** O monitor é 2560×1080. As duas larguras de referência são a tela cheia e a metade dela, mas o design não é ajustado a esses números: ele funciona num intervalo contínuo de largura, de cerca de 1100 px a 2600 px, sem depender de um valor.
