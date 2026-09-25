# A tela da task

Fase 4, decidido em 2026-09-24. Referência visual: `lab/10-screen-task-minimal/b.html` (as nove cenas, `?scene=`) e `lab/10-screen-task-minimal/components.html` (cada componente novo em todos os estados, nos dois modos).

É a tela em que o usuário acompanha e conduz uma task, em todas as etapas: planejamento, implementação nos modos `Agent` e `Manual`, pull request, review da PR e encerramento. Ela segue `structure.md` (o shell, a árvore, os painéis, a largura contínua), `principles.md` e `system/`. Onde este documento e `structure.md` §3 divergem, vale este documento: ele é a forma decidida do topo do item, do progresso e dos agentes, que a estrutura deixou em aberto.

## 1. A régua

A tela é mínima. Cada elemento justifica por que existe, ou sai. Na área principal ficam três coisas:

1. **o progresso**, no cabeçalho: em que etapa a task está, o que foi concluído, o que roda;
2. **a conversa do lugar atual**, uma só: a etapa de planejamento, o step (a do implementador ou a do revisor), a PR ou o review da PR;
3. **o compositor**, com a **barra do pedido** acima dele enquanto algo espera o usuário.

Todo o resto fica fechado: nos painéis `Details`, `Artifacts` e `Card`, ou no menu `⋯`. O que o item pede aparece uma vez: a barra diz o que é pedido e tem a ação, e o cartão tem o conteúdo. Voltar a uma conversa anterior não acontece na tela: as conversas e os relatórios anteriores ficam em `Details`.

## 2. O layout

A área principal, de cima para baixo:

- **o cabeçalho**, uma faixa de `--size-head`, com um fio embaixo;
- **as abas `Implementer` e `Reviewer`**, só enquanto o step tem os dois agentes (seção 5);
- **a conversa**, que rola, na medida `--measure`, centrada, com esmaecidos de `--space-4` sob o cabeçalho e sob as abas;
- **a barra do pedido**, quando existe;
- **o compositor**, quando existe (seção 8).

Um painel aberto fica à direita, como coluna ou por cima da conversa, pela regra de largura de `structure.md` §3, com a largura arredondada para pixel inteiro (`round(down, var(--panel-width), 1px)`).

## 3. O cabeçalho

Da esquerda para a direita:

- **`←`** volta no histórico (`Alt+←`, tooltip com o destino). **`→`** aparece só quando há para onde avançar;
- **o breadcrumb** (`Platform Roadmap / API hardening /`), que dobra num `…` com os níveis escondidos no menu dele;
- **o título**, em `--text-body` e peso 600. O glifo de tipo e a referência (`acme/api#412`) não aparecem: estão na árvore, no `Card` e em `Details`;
- **o stepper** (seção 4);
- à direita, o **medidor de contexto** (só com uma sessão na tela), **Pause** ou **Resume**, o grupo de painéis **Details**, **Artifacts** e **Card**, e **`⋯`**.

**Regra de largura.** O topo cede pela largura da área principal (container query em `main`), em limites fixos, nunca pelo comprimento do que diz. A ordem é esta: primeiro o que fica em volta do stepper, depois as etapas feitas, depois o laço e a palavra da pílula, e por último os nomes da atual e das futuras. O título cede depois de tudo.

| Área principal abaixo de | O que muda |
|---|---|
| 1660 px | O breadcrumb dobra em `…` |
| 1440 px | Os painéis ficam só com o ícone (nome acessível e tooltip com o nome) |
| 1360 px | **Pause** fica só com o ícone |
| 1300 px | O medidor fica só com a porcentagem; os traços entre as etapas saem |
| 1200 px | As etapas feitas ficam só com o visto; o nome vai ao tooltip e continua no nome acessível |
| 1040 px | A pílula perde o laço (`3/7`, sem `· round 1`) e a palavra `working` (o spinner fica, e a palavra continua no nome acessível e no compositor) |
| 900 px | As etapas futuras ficam só com o círculo |

Na metade do monitor, com 1250 a 1300 px de janela (950 a 1000 px de área principal), o stepper ainda mostra a atual e as futuras pelo nome: `✓ ✓ ✓ [Implementation 3/7 ◌] ○ PR ○ PR review ○ Closing`.

## 4. O stepper

**Etapas.** Numa task Structured são `PRD`, `Tech spec`, `Plan`, `Implementation`, `PR`, `PR review` e `Closing`. Numa One-Shot são `Planning`, `Implementation`, `PR`, `PR review` e `Closing`. As três últimas são as partes da etapa de PR do produto.

**Anatomia.** É uma lista ordenada, sem trilha inteira e sem tempos, com três formas de etapa, ligadas por traços de `--space-3` em `--line-2`:

- **feita:** um visto de `--icon-xs` em `--ink-3` e o nome em `--ink-3`;
- **futura:** um círculo de `--glyph-sm` em `--line-deco` e o nome em `--ink-4`;
- **atual:** uma pílula de `--size-control-sm`, em `--brand-tint-plane` com anel `--brand-marker-ring` e raio `--radius-pill`. Dentro dela vêm:
  - o nome em `--brand-ink`, peso 600;
  - a posição em `--ink-2`, com algarismos tabulares;
  - um divisor fino;
  - o glifo de estado da situação ou do trabalho;
  - a palavra do estado, que aparece só quando não há barra do pedido.

**A situação é dita uma vez.** Enquanto a barra do pedido existe, a pílula mostra só o glifo e a posição, e a palavra fica no nome acessível. Sem barra, a pílula diz o que roda: `working`, `checks 3/5`, `paused`.

**O que a pílula mostra.**

| Etapa e momento | Pílula | Glifo |
|---|---|---|
| Planejamento, agente trabalhando | `PRD` · `working` | spinner |
| Planejamento, pergunta, resposta ou plano inválido | `PRD` | disco âmbar |
| Planejamento revisitado | `Tech spec · revisiting`, e **Continue** na barra quando está pronto | disco âmbar com a barra, sem glifo sem ela |
| Step, implementador trabalhando | `Implementation 3/7 · round 1` · `working` (`3/7` antes da primeira passada) | spinner |
| Step, passada do revisor | `Implementation 3/7 · pass 2` · `working` | spinner |
| Step, pergunta ou permissão | `Implementation 3/7 · pass 2` | disco âmbar |
| Step, erro de sessão | `Implementation 3/7 · pass 2` | losango vermelho |
| Step `Manual`, review | `Implementation 4/7 · Manual` | disco âmbar |
| Step bloqueado | `Implementation 5/7` | losango vermelho |
| Step, commit | `Implementation 3/7 · committing` · `working` | spinner |
| PR, rascunho | `PR` · `working`, depois `PR` com a barra do rascunho | spinner, depois disco âmbar |
| PR review, esperando os checks | `PR review` · `checks 3/5` | círculo tracejado do GitHub |
| PR review, passada | `PR review pass 1` · `working` | spinner |
| PR review, apontamentos | `PR review pass 1` | disco âmbar |
| PR com check falho ou conflito | `PR review pass 2` | losango vermelho |
| Pronta para merge ou para encerrar | `Closing` | anel verde |
| Pausada | a pílula neutra (`--surface-0`, anel `--line-2`, nome em `--ink-2`) · `paused` | duas barras |

**Estados do componente.**
- **Hover** num ponto dobrado mostra o tooltip com o nome.
- **Foco:** o stepper é uma parada de Tab. Tem o progresso inteiro como nome acessível (`Progress · Implementation 3/7 · Reviewer asks you`) e o tooltip com a lista completa (`✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation  ○ PR…`).
- **Pressionado:** nenhum. O stepper não tem ação. **Back to…** e **Discard and restart…** ficam no `⋯` (seção 10).
- **Desabilitado:** a task pausada, com a pílula neutra.
- **Carregando** (a primeira leitura da task): os nomes com brilho.
- **Erro:** o losango na pílula.

A etapa atual tem `aria-current="step"`.

## 5. As abas Implementer e Reviewer

**Quando existem.** Só num step no modo `Agent`, a partir da primeira passada do revisor, até o commit. Antes disso, num step `Manual`, no planejamento e na PR, a conversa é uma só e não há abas.

**Forma.** Duas abas de texto, alinhadas à esquerda na medida da conversa, sobre um fio `--line-1`, sem fundo. Cada uma tem o glifo da sua sessão (`--glyph-sm`) e o nome. A escolhida fica em `--ink-1`, peso 600, sublinhada por `--border-2` em `--brand`. A outra fica em `--ink-3`. A aba de fora diz a palavra só quando espera ou falhou: `Implementer · waits` em `--state-wait`, `Reviewer · error` em `--state-error`. O que ela pede (`Permission, 4 minutes`) fica no tooltip e no nome acessível.

**Qual abre.** A conversa de quem tem a vez. Com os dois esperando, abre a do pedido mais antigo, que é o mesmo que o chip da árvore mostra. O produto nunca troca de aba sozinho depois disso.

**Estados.**
- Padrão, hover (tinta `--ink-1`), foco (anel por dentro) e escolhida.
- **Desabilitada**, com a razão: `Reviewer · starts with pass 1`, só no instante entre o fim do turno do implementador e a abertura da sessão do revisor.
- **Carregando**: `starting`, com spinner.
- **Erro**: o losango e `error`.

**Teclado.** É um `tablist` com uma parada de Tab, a aba escolhida. `←` e `→` trocam de aba e abrem a conversa. `aria-selected` e `aria-controls` apontam para a conversa.

## 6. A conversa

Uma coluna de leitura na medida da conversa, com `--space-6` entre as entradas e `--space-6` a `--space-8` no topo. Abre no fim, acompanha o que chega enquanto o usuário está no fim e nunca sobe sozinha.

| Entrada | Como aparece |
|---|---|
| **Fala do agente** | Linha de quem fala: avatar de `--size-avatar` (implementador cheio, revisor em anel), o nome e a hora. Abaixo, o Markdown em `--text-read`, com código, tabelas e mermaid. Sem o rótulo de papel (`· pass 2`) |
| **Mensagem do usuário** | À direita, em `--surface-user`, com `You` e a hora. Sem o destinatário: ele é a conversa na tela |
| **Mensagem na fila** | À direita, contornada, com `Queued for the implementer · sends when the turn ends` e **Remove**. Sai da fila quando o turno acaba |
| **Grupo de ações** | Dobrado por padrão, como uma linha sem fundo: o ícone do resultado, `14 actions`, o resumo por tipo (`Read 8 · Searched 4 · git 2`, com `· 2 failed, then passed` em vermelho quando falhou), a duração à direita e o chevron. Aberto, ganha o bloco `--surface-0`, mostra as últimas seis ações e `Show N earlier actions` |
| **Ação** | Rotulada pela descrição que o agente escreveu (`Run the rate limit tests`), com o comando depois, em mono e apagado, e o status ou a duração à direita (`exit 1 · 8.2 s`) |
| **Grupo vivo** | Dobrado como os outros. O resumo é a ação em curso, com spinner: `11 actions · Run the refill and eviction tests go test ./internal/ratelimit/…` |
| **Subagente** | Uma linha do grupo, `Delegated · Find why e2e / rate-limit-burst failed`, que abre as ações do subagente recuadas sob um fio, com o próprio resumo (`44 actions · Read 21 · Searched 14 · GitHub 9`) |
| **Mensagem do produto** | Um marco de uma linha: `MySpec → Implementer · Review 1 · 2 findings · round 1 of 3 · 14:19`. O conteúdo em Markdown abre no lugar, com um clique no chevron |
| **Marcadores** | Uma linha discreta à esquerda, na coluna do texto: ícone de `--icon-sm` em `--ink-4`, o texto em `--ink-2` com o complemento em `--ink-3`, e a hora. São eles: `Started with steps/03-token-bucket.md`, `Written PRD.md`, `Review 1 written · changes · 2 findings`, `Committed c19f02e …`, `Opened #1284`, `Merged #1284 into dev · by lnakamura`, `Checks read before pass 1 · 4 of 5 passed…`, `Context compacted`, `Interrupted`, e as decisões do usuário (`You approved the draft`, `You decided · 3 approved, 1 discarded`, `You approved the changes · 3 files staged`). Os que têm conteúdo (documento, relatório, instrução inicial, card de entrada) abrem no lugar, e o conteúdo tem **Open in Artifacts** ao pé |
| **Pergunta estruturada** | Cartão `--surface-2` com `--shadow-card` e anel `--state-wait-line`, sem faixa de cabeçalho: a barra diz que é uma pergunta e de quem. Dentro vêm a pergunta em 18/24, as opções numeradas (tecla, título e trade-off) e `Other…`. Respondida, ganha uma faixa neutra com o visto, a pergunta e a resposta |
| **Pergunta em texto** | No planejamento, a pergunta no fim da fala do agente ganha um fio `--state-wait-ring` à esquerda do parágrafo. O compositor oferece a resposta rápida (seção 8) |
| **Permissão** | Cartão como o da pergunta: a descrição, o comando uma vez em mono, a nota, e **Allow** `1`, **Allow for this session** `2` e **Deny…** `3`. **Allow** é a única primária da tela |
| **Erro** | Bloco `--surface-0` com o trilho `--error-rail` vermelho. Tem a explicação e o detalhe em mono (`exit status 1 · claude --resume …`, o `git status`), sem título e sem botão: a barra diz o título e tem **Retry** da sessão |
| **Atividade** | `Starting session…`, `Thinking…`, `Retrying (attempt 2)…`, com spinner, no fim |
| **Cartão de review `Manual`** | Neutro (`--surface-2`, `--shadow-xs`), com o cabeçalho `Changed files · 7` e um arquivo por linha: o glifo, o tipo (`M`, `A`, `D`), o caminho (que abre no VS Code) e `staged`, `1 hunk left` ou `not staged`. O progresso fica na barra |
| **Cartão de apontamentos** | Seção 9 |
| **Estado vazio** | Um lugar sem conversa ainda. No PR review antes da primeira passada aparece `The review starts when the checks finish.`, com o que falta, e o bloco dos checks pelo nome (`build passed 1m 52s`, `e2e / rate-limit-burst running 4m 12s`, `preview-deploy queued`) com `checked 40s ago` |

**A volta ao fim.** Fora do fim, um botão flutuante acima da barra do pedido volta ao fim. Ele diz `New messages` quando algo chegou e leva a ação em curso: `↓ New messages · ◌ Implementer go test ./internal/ratelimit/... -race`. Some no fim.

**Um cartão ou uma barra que nasce** com a tela aberta pisca duas vezes no véu da sua gravidade e é anunciado (`role="status"`).

## 7. A barra do pedido

Fica acima do compositor, na medida da conversa, com `--size-ask` de altura mínima. Existe só enquanto o item pede algo. É o único lugar da ação que resolve, fora as exceções de `structure.md` §3.
- **À esquerda:** o glifo, o rótulo em 700, o lugar e o chip de tempo.
- **No meio:** o progresso, quando há. Não repete a razão que o bloco de erro já diz.
- **À direita:** as ações.
- Quebra em duas linhas antes de esconder uma ação.

**Variantes.**
- **Quieta** (`--surface-0`): o cartão na conversa tem o conteúdo e a resposta, e a barra leva a ele com **Show**.
- **Tingida** (`--state-wait-veil`): o pedido não tem cartão com ação própria, e a barra tem a ação.
- **Erro** (`--state-error-veil` com trilho).
- **Encerramento**: fundo quieto, rótulo em `--state-close`.

**A outra conversa.**
- A barra fala da conversa na tela.
- Quando só a outra conversa do step espera, a barra diz isso e leva até lá: `● The reviewer waits · Question 18m [Go to reviewer]`. Com erro: `◆ Session error · Reviewer · pass 2 [Go to reviewer]`.
- Quando as duas esperam, a barra fala da conversa na tela, e a aba de fora aponta a outra com o glifo e `waits`.

| Situação | A barra diz | Ação | Teclas | Variante |
|---|---|---|---|---|
| `question` | `Question · Reviewer 18m` | **Show** (leva ao cartão e foca a primeira opção) | `1`–`9` com o foco no cartão | quieta |
| `permission` | `Permission · Implementer 4m` | **Show** | `1`–`3` no cartão | quieta |
| `reply` | `Waiting for reply · PRD 2m` | nenhuma: a resposta vai pelo compositor, com a resposta rápida | `Enter` no compositor | tingida |
| `session_error` | `Session error · Reviewer · pass 2 5m` | **Retry reviewer** (primária; o nome é o da sessão que caiu) | — | erro |
| `step_blocked` | `Step 5 blocked · worktree not clean 6m` | **Clean and start…**, **Try again** (primária); **Change path** com o clone ausente | — | erro |
| `worktree_unreadable` | `Can't read worktree` e a razão | nenhuma: resolve sozinho | — | erro |
| `pr_blocked` | `PR blocked` e a razão do `gh` ou do git | **Try again** | — | erro |
| `plan_invalid` | `Plan still invalid` e o número de problemas; os problemas estão na mensagem do produto na conversa | nenhuma: a correção vai pelo compositor. **Discard and restart the plan…** no `⋯` | — | tingida |
| `ready_to_continue` | `Ready to continue · Tech spec` | **Continue** | — | tingida |
| `step_review` (`Manual`, ou depois de três rodadas ou de **Review myself**) | `Review step 4 9m` · `5 of 7 files staged · 71%`, depois `Approve step 4` | **Open in VS Code**, **Approve** (tracejado com `Stage 2 more files` até 100%) | — | tingida |
| `step_empty` | `Step 4 has no changes` | **Discard step 4…** (repetida do `⋯`); pedir uma mudança pelo compositor | — | tingida |
| `draft` | `Draft to approve` | **Approve draft** (primária), **Discard draft**. O rascunho, editável, fica na conversa | — | tingida |
| `findings` | `Findings to decide · PR review · pass 1 12m` · `1 of 4 decided` | **Next to decide** `Alt ↓`, **Apply approved** (tracejado com `Decide 3 more`) | `A` e `D` no apontamento em foco, `Alt+↓` e `Alt+↑` | tingida |
| `changes_review` | `Review changes` · `3 of 5 files staged`, depois `Approve changes` | **Open in VS Code**, **Approve** | — | tingida |
| `pr_trouble` | `Checks failed`, `Conflict with base` ou `Checks failed · conflict`, com os checks pelo nome | **Review again** | — | erro |
| `pr_closed` | `PR closed unmerged` | **Delete task…** (repetida do `⋯`) | — | erro |
| `merge` | `Ready to merge · #1284` | **Open PR** | — | tingida |
| `merge` (encerrar) | `Ready to close · #1284 merged 2h` · `Removes the worktree and the branch, then updates dev` | **Close task** (primária) | — | encerramento |

A barra é `role="region"` com nome, e o texto de estado é `role="status"`. Um botão desabilitado tem borda tracejada e a razão ao lado, ligada por `aria-describedby`.

## 8. O compositor

**Quando existe.** Sempre que a conversa na tela existe. Sem sessão ainda, ele sai, e o vazio ou o bloco de erro dizem por quê. É o caso do PR review antes da primeira passada e do step bloqueado antes de abrir. Numa conversa em que o produto não age mais (o revisor depois de **Review myself**), ele continua aceitando mensagens.

**Anatomia.** A caixa `--surface-input` com borda `--line-3`, na medida da conversa. O rodapé tem:
- à esquerda, o seletor de modelo e esforço da sessão (`Opus · high ▾`), que vale a partir da próxima mensagem. Um modelo sem esforço mostra só o nome, e uma escolha que o catálogo não tem mais aparece com `◇` e a razão;
- à direita, **Send**, ou, com o agente trabalhando, `◌ Working · 3m 40s` e **Stop**.

**O placeholder diz a quem se responde e como:**
- `Answer with 1–3, or reply to the reviewer…`;
- `Queue a message for the implementer…` com o agente trabalhando;
- `Sending restarts the reviewer's session…` com erro;
- `Ask the reviewer to add, change or drop a finding…` com apontamentos;
- `Sending resumes the task…` com a task pausada.

**Resposta rápida.** Quando o agente pergunta em texto com opções (`a)`, `1.`), o compositor mostra uma pastilha por opção dentro da caixa, acima do texto: a letra e as primeiras palavras da opção como o agente escreveu (`a · Yes. Read the limits from the plans table…`). A pastilha envia a letra. Escrever `a` e `Enter` continua valendo.

**Primária.** **Send** fica primário com texto só quando nada mais na tela espera uma resposta. Com um cartão ou uma barra com ação primária, fica secundário.

**Teclas.** `Enter` envia, e `Shift+Enter` quebra a linha. Com o agente ocupado, a mensagem entra na fila.

## 9. Os apontamentos da PR da task

Os apontamentos de uma passada do review da PR da task são decididos na conversa, num cartão de decisão, com a barra do pedido como barra de decisão. É a mesma forma da pergunta, e o mesmo componente de apontamento do centro de review.

- **O cartão** fica logo depois do marco `Review 1 written · changes · 4 findings`. É neutro, com o cabeçalho `Findings · 4`, o resumo editável (`Summary · editable`) e um apontamento por item.
- **Cada apontamento** tem o número, a localização em mono (um link que abre o editor na linha, ou `General`), o texto editável e o par **Approve** `A` / **Discard** `D`. A decisão ativa fica pressionada (`aria-pressed`), e um segundo clique a desfaz (`Approved · click again to undo`). O apontamento em foco tem o anel `--brand-ring`.
- **A barra** diz o progresso (`1 of 4 decided`) e tem **Next to decide** `Alt ↓` e **Apply approved**. **Apply approved** fica tracejado até tudo estar decidido, com `Decide 3 more` ao lado. Ele envia os aprovados ao agente, e o marco `You decided · 3 approved, 1 discarded` entra na conversa.
- **Pedir ao agente** que acrescente, mude ou retire um apontamento vai pelo compositor. O cartão novo nasce no fim com as decisões mantidas, e o antigo vira o marco `Review 1 revised`.

Isto é uma mudança de feature: hoje esses apontamentos são decididos em texto (`features.md`, Review de pull request). O custo está na seção 15.

## 10. Painéis, `⋯` e popovers

Os painéis ficam fechados por padrão e nunca abrem sozinhos. Abre um de cada vez, pelo grupo do cabeçalho, e `Esc` fecha.

**`Details`**
- **Steps** (`Steps · 2 of 7 committed`), uma linha por step:
  - **commitado:** o visto, `N · título` e o SHA. Abaixo vêm as conversas (`Implementer`, `Reviewer`) e os relatórios (`Review 1 · changes`, `Review 2 · clean`);
  - **atual:** o glifo da situação e `now · Agent`, em identidade;
  - **não iniciado:** dois seletores, o de modo (robô e `Agent`, ou pessoa e `Manual`) e o de modelo (`Sonnet · high`). Um step com escolha própria aparece em `--ink-1`, peso 500, e um que segue a task aparece em `--ink-3`. **Follow the task** desfaz o modo próprio.
- **Planning:** as conversas do PRD, do tech spec e do plano, com a hora de início.
- **Pull request**, a partir da PR:
  - a conversa do rascunho e da abertura;
  - o número e a base;
  - os checks pelo nome, com o estado e a duração;
  - a última leitura.
- **Task:**
  - repositório com o clone, card, épico, modo (fixo);
  - **Review mode** e **Models**, que são botões e abrem os popovers;
  - branch, base, worktree e início.

**Uma conversa anterior**, aberta de `Details`, toma o lugar da conversa atual, somente leitura:
- no lugar do compositor fica a faixa `Step 2 · Implementer · an earlier conversation. It takes no more messages.` com **Back to step 3**;
- a barra do pedido sai enquanto se lê o passado, e o stepper e a árvore continuam dizendo o que espera;
- `Esc` volta;
- com o painel cobrindo a conversa, abrir uma conversa anterior fecha o painel, para a volta ficar à vista.

**`Artifacts`:** o PRD e o tech spec, os arquivos de step e o rascunho da PR, cada um aberto renderizado.

**`Card`:** o card, o épico e os irmãos.

**`⋯`**, agrupado por assunto, com o destrutivo por último em vermelho:

- **o step** (com um step em curso): **Review myself** (só no `Agent`), **Open in VS Code** `Ctrl+E`, **Discard step N…**;
- **a PR** (a partir do PR review): **Open PR**, **Refresh PR** (tooltip `checked 40s ago`), **Review again…** (desabilitado com `a pass waits for the checks` durante os checks), **Open in VS Code** `Ctrl+E`;
- **o planejamento:** **Discard and restart the <etapa>…** na etapa atual de planejamento;
- **a task:**
  - **Review mode ›** e **Models ›**;
  - **Back to PRD…** (com a task depois do PRD);
  - **Back to Tech spec…** (depois do tech spec);
  - **Discard and restart the plan…** (na implementação);
  - numa One-Shot, **Back to planning…** e **Discard and restart planning…**;
- depois de um separador, **Delete task…**.

Cada item destrutivo abre o diálogo que diz o que será perdido.

**Popover Review mode.**
- Tem o título e duas opções em `radiogroup`, cada uma com o ícone, o nome e o que faz. `Agent`: *An agent reviews each step with the implementer; clean steps are committed.* `Manual`: *You review each step in VS Code, stage the files and approve.*
- Embaixo, a quem a troca vale: `Applies to the steps not started that follow the task: 5, 6, 7. Step 4 has its own mode.`, ou, antes do plano, `Applies to the steps the plan writes.`
- Fica desabilitado, com a razão, quando nenhum step resta para começar.
- Estados: padrão, hover, foco, pressionado, desabilitado, salvando e erro (`Couldn't save the mode · Try again`).

**Popover Models.**
- Uma linha por etapa do modo da task: PRD, Tech spec, Plan, Implementation, Step review, PR, PR review (numa One-Shot: Planning, Implementation, Step review, PR, PR review).
- Cada linha tem um chip de modelo e esforço, que abre um `listbox`.
- Uma etapa que já começou mostra o modelo sem edição (`Opus · medium · started`). O step review fica editável até o último step ser commitado.
- A nota: `A stage takes its model when it starts. Each step not started can have its own, in Details.`
- Estados de linha: editável, hover, foco, aberto, iniciada, salvando e indisponível (`◇`, com a razão).
- Quando nenhuma leitura do catálogo deu certo, o `listbox` diz por quê, como em `features.md` (Modelos e esforço).

`Esc` fecha o `listbox` e depois o popover, e o foco volta ao gatilho. `↑` e `↓` percorrem as opções.

## 11. As cenas

A task de referência é `Rate limit per API key`, Structured, modo `Agent`, com o step 4 em `Manual`.

| Cena | Stepper | Abas | Conversa | Barra | Compositor |
|---|---|---|---|---|---|
| `plan` · o PRD pergunta em texto | `[PRD ●]` e as seis futuras | — | PRD: o card de entrada como marco, as respostas curtas, uma pergunta respondida, a última pergunta com o fio âmbar | `Waiting for reply · PRD` | Resposta rápida `a`, `b` |
| `run` · implementador trabalhando | `✓✓✓ [Implementation 3/7 · round 1 ◌ working]` | `Implementer` escolhida, `Reviewer` ociosa | O step 3 do implementador: a mensagem do produto com o relatório 1, o grupo vivo dobrado, a mensagem na fila | — | **Stop**, `Working · 3m 40s` |
| `ask` · o revisor pergunta, o implementador pede permissão | `[Implementation 3/7 · pass 2 ●]` | `Implementer · waits`, `Reviewer` escolhida | O revisor, com o cartão da pergunta | `Question · Reviewer 18m` **Show** | `Answer with 1–3…` |
| `error` · a sessão do revisor cai | `[Implementation 3/7 · pass 2 ◆]` | `Reviewer · error` | O revisor, com o bloco de erro e o grupo interrompido | **Retry reviewer**. Na aba do implementador: `Session error · Reviewer` com **Go to reviewer** | `Sending restarts the reviewer's session…` |
| `manual` · arquivos e stage | `[Implementation 4/7 · Manual ●]` | — | O step 4 e o cartão `Changed files · 7` | `Review step 4` · `5 of 7 files staged · 71%` · **Open in VS Code**, **Approve** tracejado | `Ask the implementer for a change…` |
| `blocked` · worktree suja | `[Implementation 5/7 ◆]` | — | `Step 5 is next` e o bloco com o `git status` | `Step 5 blocked · worktree not clean` · **Clean and start…**, **Try again** | Nenhum |
| `checks` · a PR espera os checks | `✓✓✓✓✓ [PR review ◌ checks 3/5]` | — | O vazio e os checks pelo nome | — | Nenhum; sem medidor |
| `findings` · apontamentos a decidir | `[PR review pass 1 ●]` | — | O relatório e o cartão de decisão | `Findings to decide` · `1 of 4 decided` · **Next to decide**, **Apply approved** | `Ask the reviewer to add, change or drop a finding…` |
| `close` · pronta para encerrar | `[Closing ○]` | — | O ciclo do PR review até `Merged #1284 · by lnakamura` | `Ready to close` · **Close task** | `Reply to the PR reviewer…` |

## 12. Os estados de toda tela (`brief.md` §7)

| Estado | Nesta tela |
|---|---|
| **Vazio** | Um lugar sem conversa ainda mostra o que espera: `The review starts when the checks finish.` com os checks, ou `Starting session…` numa etapa que abre. Um painel sem conteúdo diz o que falta: `No artifacts yet`; `Steps come from the plan` em `Details` antes do plano |
| **Carregando** | A primeira leitura da task: o stepper com brilho nos nomes, a conversa com `Loading the conversation…` e o esqueleto de três entradas. Uma conversa anterior aberta de `Details` mostra `Opening the conversation…` na linha dela |
| **Erro** | O bloco de erro na conversa, a barra de erro com a ação da sessão, o losango no stepper e na aba. Uma leitura que falha nunca esconde o que estava na tela |
| **Aguardando o usuário** | A barra do pedido, o glifo âmbar na pílula e na aba de fora, o cartão com o anel âmbar. A barra e o cartão novos piscam no véu e são anunciados |
| **Agente trabalhando** | O spinner na pílula e na aba, `working` na pílula sem barra, o grupo vivo com a ação no resumo, **Stop** e `Working · 3m 40s` no compositor. Esperar os checks é o GitHub trabalhando: círculo tracejado e `checks 3/5`, sem barra |
| **Pausado e ocioso** | Pausada: **Resume** no cabeçalho, a pílula neutra com `paused`, nenhuma barra do pedido, e o compositor diz `Sending resumes the task…`. Ociosa (parada sozinha depois de 10 minutos): o glifo ocioso na aba, e a próxima mensagem retoma sem aviso |
| **Muitos itens** | Uma sessão longa fica legível pelos grupos dobrados, pelo `Show N earlier actions` e pelas mensagens do produto em uma linha. A conversa é virtualizada acima de algumas centenas de entradas. Uma task com muitos steps muda só a posição (`12/18`); `Details` rola |
| **Item que sumiu** | A task encerrada ou apagada com a tela aberta: a área principal diz `This task was closed and archived.` com **Open in History**, ou `This task was deleted.`, e a árvore já não a mostra |

## 13. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `Alt+←`, `Alt+→` | Qualquer lugar | Volta e avança no histórico |
| `Ctrl+J` | Qualquer lugar | Abre o próximo item que espera, com o foco no que ele pede |
| `←` `→` | Abas `Implementer` e `Reviewer` | Trocam de aba |
| `1`–`9` | Cartão de pergunta ou de permissão | Responde |
| `A`, `D` | Apontamento em foco | Aprova, descarta |
| `Alt+↓`, `Alt+↑` | Com apontamentos a decidir | Próximo e anterior por decidir |
| `Enter`, `Shift+Enter` | Compositor | Envia, quebra a linha |
| `Ctrl+E` | Item com worktree | **Open in VS Code**. Atalho novo, escrito no item do `⋯` |
| `↑` `↓` `Enter` | `⋯`, popovers, `listbox` | Percorrem e escolhem |
| `Esc` | Qualquer lugar | Fecha o `listbox`, o popover, o `⋯` e o painel, e sai de uma conversa anterior, nesta ordem |

`Ctrl+E`, `←` `→` nas abas e `Esc` para sair de uma conversa anterior são novos e entram em `structure.md` §5. Os demais já estão lá.

A ordem de Tab é: cabeçalho (navegação, breadcrumb, stepper, ferramentas), abas, conversa, barra do pedido, compositor, painel.

## 14. Os componentes que entram em `system/components.md`

O coordenador consolida. Os estados de cada um estão em `components.html`.

**Novos**
- **Stepper**, com a pílula da etapa atual. Substitui a **Etapa** e a trilha de chips.
- **Abas de agente**, a forma mínima da **Aba**: texto com o glifo, sublinhado na escolhida, palavra na aba de fora quando espera ou falhou.
- **Marco em linha**, a forma do **Marcador**: uma linha à esquerda, sem fios, que abre o conteúdo no lugar. Cobre o documento, o relatório, a instrução inicial, o card de entrada, o commit, a abertura e o merge da PR e as decisões do usuário.
- **Mensagem do produto** como marco, com o destinatário e o conteúdo em Markdown a um clique.
- **Grupo de ações**: dobrado é uma linha sem fundo, e aberto é o bloco afundado. Tem o rótulo pela descrição, o resumo por tipo, `Show N earlier actions` e o **subagente aninhado**.
- **Resposta rápida**, as pastilhas no compositor.
- **Cartão neutro**: um cartão sem ação própria (os arquivos de um step `Manual`, os apontamentos), cuja barra é tingida.
- **Apontamento** e **cartão de decisão**, compartilhados com o centro de review.
- **Arquivo mudado**, a linha do cartão de review.
- **Checks do GitHub**, o bloco com os checks pelo nome.
- **Estado vazio de um lugar**.
- **Popover Review mode**, **Popover Models** e o **seletor de modo e de modelo de um step** (o chip `xs`, com a escolha própria em tinta).
- **Linha de conversa anterior** em `Details` e a **faixa da conversa anterior** no lugar do compositor.
- **Menu do item** (`⋯`), com o conteúdo desta tela.
- **Barra do pedido**: a forma "a outra conversa espera", com **Go to…**, e a forma de encerramento.
- **Volta ao fim** com a ação em curso.
- **Painel auxiliar**, com a regra de coluna ou cobertura em pixel inteiro.

**Retirados:** a **Etapa** como chip da trilha, a barra do step, a faixa de review e o destinatário do compositor.

**Regras que mudam**
- Sem sessão, o compositor sai em vez de ficar desabilitado.
- **`→`** aparece só com destino.
- O glifo de tipo e a referência saem do cabeçalho.
- Enquanto a barra do pedido existe, o topo e o cartão não repetem a situação.
- **Review mode** e **Models** saem do cabeçalho, para o `⋯` e para `Details`.
- A lista de steps com os seletores sai de `Artifacts` e vai para `Details`.

## 15. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| O `description` de cada Bash como rótulo da ação | O rótulo de toda ação (86 a 94% são Bash) | Pequeno: já chega em `handleAssistant` e é descartado (`internal/session/labels.go`) |
| Duração e código de saída de uma ação | `exit 1 · 8.2 s` e a duração do grupo | Pequeno: o fim chega em `handleUser` |
| `parent_tool_use_id` e a descrição do subagente | O subagente aninhado | Pequeno: já é lido e descartado (`internal/claude/protocol.go`) |
| O tipo da mensagem do produto (relatório, passada, commit, correção do plano, abrir a PR, aplicar) e o Markdown dela | A mensagem do produto como marco com resumo | Pequeno no backend (um campo); o Markdown é do frontend |
| A instrução com que a sessão começou | `Started with steps/03-token-bucket.md` | Só frontend para step e One-Shot. Pequeno para tech spec, plano, PR e review da PR, cujo prompt vai vazio |
| O número de apontamentos de cada relatório de step | `Review 1 written · changes · 2 findings` e o marco da mensagem | Pequeno: `Step.reports[]` só tem a passada e `clean` |
| O `sessionStatus` de cada sessão do step | O glifo e a palavra de cada aba, e a barra que aponta a outra conversa | Pequeno |
| **Retry** da sessão certa | **Retry reviewer** | Pequeno: o frontend segue só o implementador (`app-store.ts`) |
| A passada e a rodada do laço na posição | `3/7 · pass 2`, `3/7 · round 1` | Nenhum no backend: o estado do step já tem `Agent review · pass N` e `Addressing review · round N of 3` |
| Ler a conversa de um lugar que não é o atual | As conversas anteriores em `Details` | Só frontend: `GetTranscript(item, stage)` já existe por lugar |
| Os checks pelo nome durante `Waiting for checks` | O vazio do PR review e `Details` | Pequeno |
| Marcos das decisões do usuário (rascunho aprovado, apontamentos decididos, mudanças aprovadas) | `You approved the draft`, `You decided…` | Pequeno: tipos novos de marcador |
| A hora do commit de cada step e quem fez o merge | `Committed c19f02e · 18:31`, `Merged by lnakamura` | Pequeno: o git e o `gh` já sabem |
| As opções de uma pergunta em texto | A resposta rápida | Nenhum: heurística do frontend sobre `a)` e `1.` no último parágrafo |
| **Apontamentos estruturados no review da PR da task, com a decisão guardada e Apply approved** | O cartão de decisão da seção 9 | **Médio, e muda uma feature.** O review da PR da task passa a usar o formato de relatório e a decisão do centro de review, e o prompt de review de PR muda. Hoje a decisão é em texto na conversa |
