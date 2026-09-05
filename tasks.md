# Tasks do MySpec

Este arquivo é o fatiamento do produto descrito em [PRODUCT.md](./PRODUCT.md) em tasks implementáveis com o workflow de [WORKFLOW.md](./WORKFLOW.md). Cada task abaixo passa pelo ciclo completo: `/gm-prd {nome}`, depois `/gm-tech-spec {nome}`, depois `/gm-plan-tasks {nome}`, e então a implementação step a step.

A descrição de cada task é o **contexto inicial da sessão de PRD**: o texto a ser enviado logo depois de invocar `/gm-prd {nome}`. Ela diz o que a task entrega, onde ela termina, o que fica de fora e como validar o resultado. O que não está decidido fica listado em "Em aberto", para a sessão de PRD resolver por perguntas.

Critérios usados no fatiamento:

- cada task entrega algo que dá para usar e validar de ponta a ponta, mesmo que o produto ainda não esteja completo;
- cada task depende apenas das anteriores;
- o tamanho é o que cabe num ciclo de PRD, spec, plano e alguns steps, sem virar nem um retoque nem um projeto inteiro;
- as primeiras tasks atacam os riscos da stack listados em [STACK.md](./STACK.md), para que uma decisão errada apareça cedo.

Vocabulário: as tasks deste arquivo são Tasks no sentido do produto, a unidade de trabalho. Dentro de cada uma, a skill de plano gera os steps, que ela chama de "tasks" na pasta `planning/{nome}/tasks/`.

A ordem abaixo é a ordem de implementação. O fatiamento pode ser revisto conforme as tasks forem sendo entregues.

---

## 1. Fundação e área de trabalho

**Nome:** `01-workspace`

**Objetivo.** Ter o MySpec rodando como aplicação desktop na máquina alvo, abrindo uma pasta como área de trabalho e mostrando os repositórios que existem nela. É a task que valida a base da stack: Wails v3 com Go, React com Tailwind e shadcn/ui, o webview no Hyprland, o diretório de dados e o SQLite.

**Escopo.**

- Projeto criado no layout do Wails v3, com o frontend em React e TypeScript, Tailwind e shadcn/ui, e as ferramentas de desenvolvimento definidas em STACK.md funcionando: pnpm, Biome, Vitest, golangci-lint, Taskfile.
- Abrir o app a partir de uma pasta, como o VS Code faz: por argumento na linha de comando e por seletor de pasta dentro do app. O app lembra a última área de trabalho aberta e permite trocar.
- Escanear a área de trabalho e identificar os repositórios git abaixo dela.
- A visão principal: a árvore com a raiz e os repositórios, cada nó preparado para listar suas tasks, com estados vazios bem desenhados, já que ainda não existem tasks.
- Diretório de dados do app seguindo XDG e o banco SQLite criado com a estrutura inicial.
- A base visual do produto: layout, tipografia, cores, tema claro e escuro, densidade. É aqui que o padrão de refinamento da interface é estabelecido.

**Fora do escopo.** Criar tasks, sessões com o Claude Code, qualquer etapa do ciclo de vida.

**Validação.** Abrir o app numa pasta com vários repositórios e ver a árvore correta. Fechar e reabrir e cair na mesma área de trabalho. Trocar de área de trabalho. Renderização sem defeitos no Hyprland da máquina alvo.

**Em aberto.** Profundidade do scan de repositórios. O que acontece ao abrir uma pasta que é ela própria um repositório. Como o app é lançado no dia a dia: comando, atalho do sistema, ícone.

**Referências.** PRODUCT.md, seções "Área de trabalho" e "Experiência". STACK.md, seções "Base desktop", "Frontend", "Armazenamento" e "Pontos a verificar no protótipo".

---

## 2. Motor de sessões, criação de task e etapa de PRD

**Nome:** `02-session-prd`

**Objetivo.** Criar uma task e conduzir a primeira etapa dela, o PRD, inteiramente dentro do app, conversando com o Claude Code numa interface própria. É a task que constrói o motor de sessões, o componente central do produto, e o valida com o caso de uso mais simples do ciclo.

**Escopo.**

- Criação de task a partir da raiz ou de um repositório, com nome e contexto inicial. A task passa a aparecer no nó em que nasceu.
- O motor de sessões: iniciar o CLI do Claude Code como subprocesso, um processo vivo por sessão, com entrada e saída em stream JSON, no diretório certo, com o prompt da etapa. Suporte a várias sessões ao mesmo tempo, uma por task.
- O chat da sessão: renderização em streaming com Markdown e mermaid, envio de mensagens, interrupção de uma resposta em andamento, e o estado "depende de mim" quando o agente para esperando resposta.
- Pausar uma sessão e retomá-la depois, inclusive após fechar e reabrir o app.
- Escaladas de permissão do modo auto chegando ao app pelo servidor MCP local e sendo respondidas pelo usuário na interface.
- A etapa de PRD: a sessão nasce com o prompt de PRD e o contexto inicial, o usuário responde às perguntas, e a etapa termina quando o PRD aparece no diretório de artefatos da task. O PRD fica visível no app, renderizado.
- Os prompts existem como arquivos no diretório de dados, semeados a partir dos textos padrão embutidos no app. Ainda sem interface de edição.

**Fora do escopo.** As demais etapas, auto-avanço para o tech spec, edição de prompts, modelo e esforço por etapa, descartar etapa.

**Validação.** Criar uma task com um contexto real, conversar até o agente escrever o PRD, ler o PRD no app. Pausar no meio do Q&A, fechar o app, reabrir e retomar a mesma conversa. Provocar uma escalada de permissão e respondê-la. Duas tasks conversando em paralelo sem interferência.

**Em aberto.** Como o app apresenta uma pergunta do agente em relação a uma resposta comum. O que o usuário vê enquanto o agente executa ferramentas. Como uma escalada de permissão é apresentada e quais respostas ela aceita. O que acontece se o processo do CLI morrer sozinho.

**Referências.** PRODUCT.md, seções "Criação", "Etapa PRD", "Sessões" e "Depende de mim". STACK.md, seções "Integração com o Claude Code" e "Ponte entre React e Go".

---

## 3. Etapas de tech spec e plano, com auto-avanço

**Nome:** `03-spec-plan`

**Objetivo.** Completar o planejamento de uma task dentro do app: do PRD escrito até a lista de steps pronta, sem que o usuário inicie nada à mão. Ao final, a task chega ao estado "em implementação" com seus steps listados, mesmo que a implementação em si ainda não exista.

**Escopo.**

- Etapa de tech spec: sessão com o prompt de tech spec, no diretório da task, lendo o PRD do diretório de artefatos e explorando os repositórios. Termina quando o tech spec aparece.
- Etapa de plano: sessão com o prompt de plano, que gera um arquivo por step, cada um carregando o repositório em que será implementado. O app lê os arquivos e monta a lista de steps da task: ordem, título, repositório, estado inicial.
- Auto-avanço: PRD escrito inicia o tech spec, tech spec escrito inicia o plano, plano escrito coloca a task em implementação.
- Visualização dos artefatos da task no app: PRD, tech spec e cada step, renderizados.
- Descartar uma etapa em andamento, recomeçando-a do zero.
- Indicador de progresso da task pelas etapas.

**Fora do escopo.** Executar steps, worktrees, prompts editáveis, modelo e esforço por etapa.

**Validação.** Numa task com PRD pronto, ver o tech spec começar sozinho, responder ao Q&A técnico, ver o plano começar sozinho, chegar à lista de steps com os repositórios corretos. Descartar uma etapa e vê-la recomeçar. Fazer isso numa task de raiz que toca dois repositórios.

**Em aberto.** Como o app extrai o repositório de cada step do arquivo gerado. O que acontece se o plano gerar um step sem repositório ou com repositório fora da área de trabalho. Se o usuário pode reordenar ou editar steps depois do plano.

**Referências.** PRODUCT.md, seções "Etapa Tech spec", "Etapa Plano de steps", "Auto-avanço" e "Artefatos e histórico".

---

## 4. Worktrees e sessões de implementação de steps

**Nome:** `04-worktrees-steps`

**Objetivo.** Executar o primeiro step de uma task dentro de uma worktree criada pelo app, com o agente implementando e apresentando o resumo para review. É a metade "implementar" do ciclo de steps; a metade "aprovar e commitar" vem na task seguinte.

**Escopo.**

- Criação da worktree de um repositório, com o nome da task, gerenciada pelo app, antes do primeiro step daquele repositório.
- Pré-condição de worktree limpa: antes de iniciar um step, o app verifica que não há alterações não commitadas. Se houver, não inicia, alerta o usuário e oferece limpar por conta própria ou autorizar o app a limpar.
- Sessão de implementação do step, dentro da worktree, com o arquivo do step como prompt, apontando para o PRD e o tech spec no diretório de artefatos. Sem linha de status nem passos de commit no prompt.
- O step entra em "aguardando review" quando o agente apresenta o resumo. Pedidos de ajuste acontecem na conversa, e o step volta a aguardar review a cada novo resumo.
- Atalho para abrir a worktree no VS Code.
- Steps sempre em sequência: só o step atual pode estar em andamento.
- Estados do step visíveis na task e na árvore: não iniciado, bloqueado por worktree suja, implementando, aguardando review.

**Fora do escopo.** Progresso do review por arquivos em stage, aprovação, commit, avanço para o próximo step.

**Validação.** Numa task com steps planejados, iniciar a implementação e ver a worktree criada no repositório certo. Ver o agente implementar e apresentar o resumo. Pedir um ajuste e receber novo resumo. Sujar a worktree à mão e ver o app recusar iniciar um step até limpar.

**Em aberto.** Onde as worktrees ficam no disco e como são nomeadas. A branch criada com a worktree: nome e base. Como o app abre o VS Code e se isso é configurável.

**Referências.** PRODUCT.md, seções "Worktrees" e "Etapa Implementação" até "Ajustes". STACK.md, seção "Git e GitHub".

---

## 5. Review, aprovação e commit

**Nome:** `05-review-commit`

**Objetivo.** Fechar o ciclo de um step: o usuário revisa no VS Code dando stage arquivo a arquivo, o app mostra o progresso em tempo real, a aprovação só libera com tudo em stage, o commit é feito por uma sessão própria, e o próximo step começa sozinho. Ao final desta task, o ciclo de implementação está completo e uma task pode ser implementada inteira dentro do app.

**Escopo.**

- Observação da worktree durante o review: o app detecta mudanças no disco e lê o estado do git para calcular arquivos alterados e arquivos em stage.
- Progresso do review como percentual, atualizado em tempo real, visível no step, na task e na árvore.
- Aprovação como ação no app, habilitada apenas com todos os arquivos alterados em stage.
- Ao aprovar, sessão de commit na worktree com o prompt de commit. O step é marcado como concluído quando o commit existe. O status é do banco, não do arquivo.
- Auto-avanço para o próximo step, com a verificação de worktree limpa, e a criação da worktree do repositório seguinte quando o step muda de repositório.
- Estados do step completos: em review com percentual, pronto para aprovar, commitando, concluído.

**Fora do escopo.** PR, review de PR, encerramento.

**Validação.** Revisar um step no VS Code e ver o percentual subir a cada stage. Ver o botão de aprovar habilitar só em 100%. Aprovar e ver o commit na worktree com mensagem legível. Ver o próximo step começar sozinho. Implementar uma task inteira, de dois repositórios, do primeiro ao último step.

**Em aberto.** Como o app trata arquivos novos não rastreados no cálculo do progresso. O que acontece se o usuário fizer o commit por fora. Se o resumo do agente e o diff aparecem lado a lado no app ou só o percentual.

**Referências.** PRODUCT.md, seção "Etapa Implementação" de "Review" até "Próximo step". STACK.md, seções "Binário git" e "fsnotify".

---

## 6. PR e review de PR

**Nome:** `06-pr-review`

**Objetivo.** Levar uma task implementada até PRs prontas para merge, uma por repositório, com rascunho aprovado pelo usuário e um ciclo de review conduzido pelo agente até fechar limpo.

**Escopo.**

- Com o último step commitado, a etapa de PR começa sozinha para cada repositório da task.
- Sessão de PR com o prompt de PR: o agente prepara título e descrição, o app apresenta o rascunho, o usuário dá o OK, o agente sobe a branch e abre a PR. Branch base dev por padrão, editável, e pergunta quando o repositório não tem dev.
- Etapa de review de PR, automática, com o prompt de review de PR: o agente revisa, apresenta as alterações que considera necessárias, o usuário decide na conversa o que aplicar, o agente aplica, commita e sobe com o prompt de commit, e revisa de novo, até a revisão fechar sem apontamentos.
- O prompt de commit passa a subir o commit para a PR quando ela existe.
- Leitura da PR com o `gh`: link e estado, aberta ou mergeada, mostrados junto do repositório na task.
- Estados da task por repositório: em PR, em review de PR, aguardando encerramento.

**Fora do escopo.** Encerramento, arquivamento, histórico.

**Validação.** Numa task implementada em repositórios de teste no GitHub, ver as PRs serem rascunhadas, aprovar os rascunhos e ver as PRs abertas com o link no app. Ver o review encontrar algo, decidir aplicar, ver o commit chegar na PR e a revisão seguinte fechar limpa. Repositório sem branch dev sendo perguntado.

**Em aberto.** Como o rascunho da PR é apresentado e se o usuário pode editá-lo antes do OK. Se o review de PR roda uma vez ou fica escutando novos commits. O que o app mostra quando o `gh` não está autenticado.

**Referências.** PRODUCT.md, seções "Etapa PR" e "Etapa Review de PR". STACK.md, seção "Binário gh".

---

## 7. Encerramento, arquivamento, histórico e exclusão

**Nome:** `07-closing-history`

**Objetivo.** Completar o ciclo de vida da task: encerrar cada repositório depois do merge, arquivar a task quando o último fechar, consultar o histórico, e apagar uma task em definitivo quando o trabalho não vai continuar.

**Escopo.**

- Encerramento por repositório, acionado pelo usuário depois da PR mergeada: o app apaga a worktree e atualiza a branch dev local se ela estiver atrás e o pull for possível.
- Arquivamento automático quando o último repositório da task é encerrado. A task sai da área de trabalho.
- Histórico: lista das tasks arquivadas, com seus artefatos finais renderizados.
- Apagar task: para o que estiver rodando, apaga as worktrees existentes e remove a task em definitivo, com confirmação.
- Distinção clara entre pausar para continuar depois, arquivar uma task finalizada e apagar.

**Fora do escopo.** Notificações, prompts editáveis, configurações.

**Validação.** Mergear a PR de um repositório, encerrar e ver a worktree sumir e a dev local atualizada. Encerrar o último repositório e ver a task ir para o histórico com os artefatos. Apagar uma task no meio da implementação e ver worktrees e registros desaparecerem.

**Em aberto.** O que o app faz se a dev local tiver alterações ou divergir da remota. Se o encerramento pode ser oferecido automaticamente quando o `gh` reporta a PR mergeada. O que o histórico mostra além dos artefatos, como datas e repositórios tocados.

**Referências.** PRODUCT.md, seções "Encerramento", "Arquivamento", "Artefatos e histórico" e "Controles sobre tasks e etapas".

---

## 8. Atenção e notificações

**Nome:** `08-attention`

**Objetivo.** Tornar "depende de mim" um estado de primeira classe em todo o produto: derivado de todas as situações que aguardam o usuário, visível de longe na área de trabalho, e anunciado por notificação do sistema quando o usuário não está olhando para o app.

**Escopo.**

- Modelo unificado de "depende de mim", cobrindo todas as situações listadas em PRODUCT.md: pergunta do agente, resumo aguardando review, step pronto para aprovar, rascunho de PR, decisão no review de PR, escalada de permissão, worktree suja, repositório aguardando encerramento.
- Indicadores na árvore e na task, dizendo que a task espera o usuário e para quê, sem precisar abrir a task.
- Uma visão do que espera o usuário em toda a área de trabalho, para escolher onde entrar.
- Notificação do sistema quando uma task passa a depender do usuário e o app não está em foco. Clicar na notificação leva à task.

**Fora do escopo.** Prompts editáveis, configurações.

**Validação.** Com duas ou três tasks em andamento, ver na árvore quais esperam e por quê. Sair do app, esperar um agente parar numa pergunta e receber a notificação. Clicar nela e cair na task certa.

**Em aberto.** Se notificações têm níveis ou se todas as situações são iguais. Se o usuário pode silenciar por task. Como o estado é apresentado quando várias situações coexistem na mesma task, por exemplo uma PR aguardando OK e outra em review.

**Referências.** PRODUCT.md, seções "Controle e visibilidade", "Depende de mim", "Notificações" e "Paralelismo". STACK.md, seção "Notificações".

---

## 9. Prompts e configurações

**Nome:** `09-prompts-settings`

**Objetivo.** Dar ao usuário o controle sobre o que o produto envia ao Claude Code e como: a área de prompts, editável, e as configurações de modelo e esforço por etapa, com padrão global e ajuste por task na criação.

**Escopo.**

- Área de prompts: lista dos sete prompts, PRD, tech spec, plano, implementação, commit, PR e review de PR, cada um visualizado renderizado e editável, salvo como arquivo no diretório de dados, com opção de restaurar o padrão.
- Configurações: modelo e esforço padrão por etapa, branch base padrão das PRs, e o que mais tiver sido deixado como configurável nas tasks anteriores.
- Na criação da task, os padrões de modelo e esforço por etapa aparecem e podem ser ajustados para aquela task.
- As sessões passam a receber modelo e esforço conforme a configuração.

**Fora do escopo.** Nada novo no ciclo de vida.

**Validação.** Editar o prompt de PRD, criar uma task e ver a mudança de comportamento. Restaurar o padrão. Definir um modelo diferente para a implementação e confirmar nas sessões. Ajustar o esforço de uma etapa só numa task específica.

**Em aberto.** Se um prompt editado vale para tasks já em andamento ou só para novas. Como o app mostra a diferença entre o prompt atual e o padrão. Se há validação do prompt, por exemplo placeholders obrigatórios.

**Referências.** PRODUCT.md, seções "Prompts", "Modelo e esforço" e "Criação".
