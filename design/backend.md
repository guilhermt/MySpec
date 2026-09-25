# Dados do backend

Os dados que as telas decididas pedem e o backend ainda não expõe, ou expõe sem que o frontend os use. Uma linha por dado, deduplicada entre as telas, agrupada por custo:

- **Só frontend**: o dado já chega ao frontend, ou é derivável do que chega; nenhuma mudança em Go.
- **Backend pequeno**: um campo num DTO, um dado que o Go já lê e descarta, um tipo novo de marco, um texto, uma consulta simples.
- **Backend médio**: muda uma regra do workflow ou um prompt, com efeito em mais de um pacote.

A coluna **Telas** diz quem pede: Shell (`structure.md`), Task, Board (Home, board e criação), Review, Discussão, Rest (`screens/rest.md`). A referência aponta a seção do documento de tela e, quando o documento diz, onde o dado está no código. As mudanças de comportamento que esses dados servem estão em `changes.md`.

Fica fora: custo em tokens e dólares, e duração de task, etapa e step (`decisions.md`, 2026-09-23).

## Backend médio

| # | Dado ou regra | Para | Telas | Referência |
|---|---|---|---|---|
| M1 | **Apontamentos estruturados no review da PR da task**: o relatório no formato do centro de review (título, localização, texto), a decisão guardada por apontamento e **Apply approved** enviando só os aprovados. O prompt de review de PR muda para a task | O cartão de decisão da PR da task (`changes.md` T16) | Task | `screens/task.md` §9, §15; `screens/review.md` §20 |
| M2 | **Publicação em cadeia**: o épico publica quando está aprovado e todos os cards dele estão decididos, com ao menos dois aprovados; o card espera o épico e as dependências; a corrida publica a cadeia a cada decisão; `PublishEpic` sai | O modelo de publicação da discussão (`changes.md` D3) | Discussão | `screens/discussion.md` §6, §16; `discussionflow/publish.go`, `decide.go` |
| M3 | **A saída de cada comando**: `stdout` e `stderr` (a cauda) e o número de linhas, guardados no payload da ação. A alternativa barata guarda as últimas 40 linhas e a contagem, sem **Show all**; mostrar tudo pede guardar a saída inteira, até 16 MiB por linha (a saída de um Bash tem mediana de 24 linhas, p90 de 251, máximo de 1.202) | A saída dobrada do comando e a cauda aberta de uma falha (`changes.md` T20) | Task, Review, Discussão | `screens/task.md` §6, §15; o `tool_use_result` chega a cada ação e é descartado (`internal/session/transcript.go`, `events.go`; `research/conversation.md` §1.3) |

## Backend pequeno

**Árvore e sessões**

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| P1 | A ação em curso (rótulo e alvo), `turnStartedAt` e a conversa que trabalha, no resumo de cada item | As linhas 2 e 3 da árvore de um item não aberto; o relógio do agente | Shell | `decisions.md` 2026-09-23; `structure.md` §2 |
| P2 | O `sessionStatus` de cada sessão do item, não só da exibida | O glifo e a palavra de cada aba; a barra que aponta a outra conversa; o erro sem situação na aba | Task, Shell | `screens/task.md` §15 |
| P3 | **Retry** da sessão certa: o revisor de um step e a sessão de uma discussão | **Retry reviewer**; **Retry** na discussão | Task, Discussão | `screens/task.md` §15 (`app-store.ts` segue só o implementador); `screens/discussion.md` §16 |
| P4 | Desde quando uma sessão está pausada | A hora do marco `Paused by you` (no hover), o tooltip da pílula | Rest, Task | `screens/rest.md` §10, §15 |

**A conversa**

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| P5 | O `description` de cada Bash como rótulo da ação | O rótulo de toda ação (86 a 94% são Bash) | Task, Review, Discussão | `screens/task.md` §15; chega em `handleAssistant` e é descartado (`internal/session/labels.go`) |
| P6 | A duração e o código de saída de cada ação | `exit 1 · 8.2 s`, a duração do grupo | Task, Review, Discussão | `screens/task.md` §15; o fim chega em `handleUser` |
| P7 | O `parent_tool_use_id` e a descrição do subagente | O subagente aninhado | Task, Review, Discussão | `screens/task.md` §15; lido e descartado em `internal/claude/protocol.go` |
| P8 | O tipo da mensagem do produto (relatório, passada, commit, correção do plano, abrir a PR, aplicar) | A mensagem do produto como marco com resumo | Task, Review | `screens/task.md` §15 |
| P9 | A instrução com que a sessão começou, no tech spec, no plano, na PR e no review da PR (o prompt vai vazio) | `Started with …` | Task | `screens/task.md` §15 |
| P10 | **Tipos novos de marco**. Task: rascunho aprovado, apontamentos decididos, mudanças aprovadas, commit, PR aberta, merge, checks lidos antes da passada. Review: decisões, publicação (`Published pass 1 · …`), envio ao agente, commits novos. Discussão: contexto, documento escrito, rascunhos escritos, revisados (com quantos mudaram) e ilegíveis, a rodada de publicação que se atualiza e `Publication stopped`. Todos: `Paused by you` | Os marcos da conversa | Task, Review, Discussão, Rest | `screens/task.md` §15; `screens/review.md` §19; `screens/discussion.md` §16; o backend já sabe `documentRevision`, `draftsRevision`, `revision`, `publishedAt`, `unreadableDrafts` |
| P11 | O número de apontamentos de cada relatório de step | `Review 1 written · changes · 2 findings` | Task | `screens/task.md` §15; `Step.reports[]` só tem a passada e `clean` |
| P12 | A hora do commit de cada step, e quem fez o merge e quando | A hora de `Committed c19f02e` (no hover e em `Details`), `Merged by lnakamura`, a página do review que saiu | Task, Review | `screens/task.md` §15; `screens/review.md` §19; o git e o `gh` já sabem |
| P38 | `attempt`, `max_retries`, `retry_delay_ms` e o erro do evento `api_retry` | A atividade `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8 s` e o marco `Retried on its own` depois que passa | Task, Review, Discussão | `screens/task.md` §6, §15; o evento chega e é ignorado (`internal/claude/protocol.go`); o marco é um tipo novo |
| P39 | Quem interrompeu uma fala | `Interrupted by you`, distinto de uma queda da sessão | Task, Review, Discussão | `screens/task.md` §6, §15; o produto sabe quando o usuário chamou **Stop**; um campo no marcador `interrupted` |
| P40 | A hora da resposta de uma pergunta estruturada | O tooltip e o nome acessível da pergunta respondida | Task, Review, Discussão | `screens/task.md` §6, §15; a permissão tem `answeredAt`, e a pergunta não |
| P41 | A porcentagem de contexto no momento da compactação | `Context compacted · at 81%` | Task, Review, Discussão | `screens/task.md` §6, §15; `preTokens` já chega no marcador; falta a janela de contexto no momento |

**Pull requests e GitHub**

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| P13 | Os checks pelo nome, com estado e duração, durante `Waiting for checks` | O vazio do PR review e do review, `Details`, a pílula | Task, Review, Shell | `screens/task.md` §15; `screens/review.md` §19; o backend já os lê a cada minuto |
| P14 | Os checks e o conflito lidos antes de cada passada | `Details` do review, o marco `Checks read before pass 1` | Review, Task | `screens/review.md` §19 |
| P15 | Os checks pelo nome de uma PR sem review | O painel da PR, a espera no diálogo de início | Review | `screens/review.md` §19; um campo na query GraphQL da lista |
| P16 | A descrição (`body`) da PR | O painel da PR | Review | `screens/review.md` §19; hoje só entra no `context.md` |
| P17 | O seu último review de uma PR revisada, com o estado e a data | `Your review` no painel | Review | `screens/review.md` §19; a query já lê o último review da conta |
| P18 | A lista dos commits novos desde a passada (hash e assunto) | O marco `3 new commits` | Review | `screens/review.md` §19; `git log` entre o commit da passada e o head |
| P19 | O título de cada apontamento | O apontamento, no review e na PR da task | Review, Task | `screens/review.md` §19, §20; o prompt pede `### N · título`, e `prreview/report.go` guarda o título |
| P20 | `checkError` com quando falhou | `Couldn't check GitHub · 3m ago` | Review | `screens/review.md` §19; hoje chega só a razão |
| P21 | Quando a leitura de um repositório de PRs falhou (`failedAt`) | A faixa de falha da lista de Reviews | Review | `screens/review.md` §19; nenhum custo se já chega, como no board |

**Board e discussão**

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| P22 | `In discussion` de um card criado ou atualizado por uma discussão, e qual discussão | A linha do card, o painel, a linha do contexto na criação | Board | `screens/board.md` §11; expor no `BoardCard` o que `discussion.Service.DocumentOfCard` sabe |
| P23 | As partes do contexto montado (épico, irmãos, dependências, discussão) e o tamanho | A linha do contexto na criação de task e na nova discussão, o marco `Context` | Board, Discussão | `screens/board.md` §11; `screens/discussion.md` §16; `CardContext` devolve só o texto. Alternativa só frontend: derivar do `BoardCard` e medir o texto |
| P24 | A versão anterior dos rascunhos revisados (título, dependências, decisão) | O marco `Drafts revised` | Discussão | `screens/discussion.md` §16; o reconcile guarda o anterior antes de substituir |
| P25 | O número da rodada de cada rascunho | A pílula, o cartão, os marcos, a rodada dobrada | Discussão | `screens/discussion.md` §16; um contador que sobe quando uma leitura traz rascunhos novos depois de uma publicação |
| P26 | As situações `Epic can't publish`, `Epic discarded` e `Ready to archive`, com a notificação da última | A árvore, a pílula, a barra | Discussão | `screens/discussion.md` §16; `attention/derive_discussion.go` |

**Arquivamento, apagamento e Settings**

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| P27 | O resultado do encerramento (`CloseResult`) no `ArchivedTask` | A task arquivada, a página da task que saiu, o toast | Rest, Shell | `screens/rest.md` §15; está em `pr_runs.close_result` e não é exposto |
| P28 | O rascunho da PR e os relatórios do review da PR no `ArchivedTask` | A aba **Pull request** da task arquivada | Rest | `screens/rest.md` §15; pequeno se os arquivos ficam na pasta de artefatos no arquivamento, a verificar |
| P29 | O que o apagamento deixou no disco, ligado ao item | A página da task apagada e o comando | Rest, Shell | `screens/rest.md` §15; hoje só existe o `Leftover` avulso |
| P30 | Os arquivos não commitados e os commits fora da base | A prévia de **Delete task** e de **Discard step** | Rest | `screens/rest.md` §15; `previewDelete` já lê a worktree e a branch |
| P31 | A consequência por repositório desmarcado no Edit board (No board ou sai do MySpec) | A linha do repositório e o rodapé do diálogo | Rest | `screens/rest.md` §15; a regra de `previewRemoveBoard`, por repositório |
| P32 | As opções de status que sumiram e as novas, no Edit board | A nota do passo dos status | Rest | `screens/rest.md` §15; a comparação entre o guardado e o relido |
| P33 | A lista do History por partes (90 dias, os mais antigos sob demanda) | Muitos itens no History | Rest | `screens/rest.md` §15; uma consulta com data de corte |
| P34 | A data da edição de um prompt e o número de linhas da versão editada e do padrão | `Edited Sep 20`, `Your version has 92 lines; the default of this version has 87.` | Rest | `screens/rest.md` §2.9, §15; a data do arquivo do prompt editado; o número de linhas é só frontend se o texto dos dois chega |

**Início, boas-vindas e notificações**

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| P35 | O progresso do início, passo a passo, com o tempo | `Starting MySpec…` | Rest, Shell | `screens/rest.md` §5, §15 |
| P36 | Se o Claude Code foi achado, se o `gh` existe e se tem login | `This machine` nas boas-vindas | Rest | `screens/rest.md` §6, §15; o primeiro sai da leitura do catálogo, os outros de um `gh auth status` ao abrir as boas-vindas |
| P37 | Os textos das notificações: as contagens e os nomes nos corpos, os corpos das situações novas da discussão, o título da PR no título da notificação de um review | A tabela de notificações | Rest | `screens/rest.md` §11, §15; os textos estão em `internal/attention/text.go`, e os dados, nas situações |

## Só frontend

| # | Dado | Para | Telas | Referência |
|---|---|---|---|---|
| F1 | A pilha de navegação e o último item ativo aberto, persistidos entre execuções | `←` `→`, **Continue** | Shell, Board | `structure.md` §1; `screens/board.md` §11 |
| F2 | Derivados do `State`: a posição curta de cada linha, a gravidade e a ordem do `Ctrl+J`, as contagens dos nós, a marca One-Shot, `checkedAt`, a fase de leitura do GitHub, o progresso de decisão, o tempo de espera (`startedAt`), a situação nova (`situation:started`), se um item que sumiu foi arquivado ou apagado | A árvore, a pílula, a piscada, a página do item que saiu | Shell | `structure.md` §2 |
| F3 | A passada e a rodada na posição (`3/7 · pass 2`, `round 1`) | A pílula | Task | `screens/task.md` §15; o estado do step já as tem |
| F4 | A conversa de um lugar que não é o atual | As conversas anteriores em `Details` | Task | `screens/task.md` §15; `GetTranscript(item, stage)` já existe por lugar |
| F5 | A instrução com que um step e uma One-Shot começaram | `Started with steps/03-token-bucket.md` | Task | `screens/task.md` §15 |
| F6 | As opções de uma pergunta em texto | A resposta rápida | Task, Discussão | `screens/task.md` §15; heurística sobre `a)` e `1.` no último parágrafo |
| F7 | `In discussion` de um card que é entrada de uma discussão ativa | A linha e o painel do card | Board | `screens/board.md` §11; `discussions[].cards[]` pela chave `dono/nome#N` |
| F8 | O progresso de um épico (`2 of 8 finished`) | A coluna do épico, as relações | Board | `screens/board.md` §11; épicos com mais de 50 sub-issues são cortados pela query |
| F9 | O card aberto que saiu da leitura | A faixa do card fora da leitura | Board | `screens/board.md` §11; guardar o último `BoardCard` aberto |
| F10 | Quando a leitura do board falhou (`failedAt`) e a hora da leitura (`readAt`) | A faixa da falha, a idade no cabeçalho | Board | `screens/board.md` §11; chegam e não são mostrados |
| F11 | Os cards abertos por board e as PRs pendentes por repositório | As linhas da Home | Board | `screens/board.md` §11 |
| F12 | O board da última discussão, e a escolha do board ao criar da Home | O campo **Board** | Board, Discussão | `screens/board.md` §11; `CreateDiscussion` já recebe o board |
| F13 | Por que `S` não age num card | O aviso da tecla | Board | `screens/board.md` §11; `action`, `otherBoard` e `activeTaskId` já dizem |
| F14 | O link para a linha em `Files changed` | A localização do apontamento | Review | `screens/review.md` §19; `…/pull/N/files#diff-<sha256 do caminho>R<linha>` |
| F15 | O veredito sugerido e as regras do GitHub | O diálogo de publicação | Review | `screens/review.md` §19; derivados das decisões, do resumo e de `own` |
| F16 | O que um gesto publica (a cadeia) | A linha antes da decisão do rascunho | Discussão | `screens/discussion.md` §16; a mesma regra de M2, aplicada às decisões e ao que já foi publicado |
| F17 | A contagem `+4 −1` do diff | **Changes** | Discussão | `screens/discussion.md` §16; do corpo e do `current` |
| F18 | O título de cada dependência | `Depends on` | Discussão | `screens/discussion.md` §16; `DraftRef` já tem `title` |
| F19 | A ação que falhou | O rótulo do aviso do app | Rest | `screens/rest.md` §15; cada chamada de `run()` recebe o nome da ação |
| F20 | O arquivamento de um review e de uma discussão sem a tela aberta | O toast | Rest | `screens/rest.md` §15; `reviewHistory` e `discussionHistory` já chegam |
| F21 | A hora de cada entrada da conversa e o número de entradas novas desde que o usuário saiu do fim | A hora no hover e no nome acessível; `New messages 2` | Task, Review, Discussão | `screens/task.md` §6, §15; toda entrada tem `createdAt` |

## Contagem

| Custo | Linhas |
|---|---|
| Backend médio | 2 |
| Backend pequeno | 37 |
| Só frontend | 20 |
