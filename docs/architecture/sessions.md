# Sessões e o processo do Claude Code

Uma sessão é uma conversa entre o usuário e o Claude Code conduzida pelo produto. Este documento descreve o processo por trás dela: como sobe, o que fala, como para e como volta.

## Um processo por sessão ativa

Um item, uma task, um review de pull request ou uma discussão, roda um processo `claude` por sessão ativa. Nas etapas de planejamento, uma task tem uma sessão ativa por vez: a da etapa em que está, nos dois modos. Na implementação, o step que roda tem a sua e, no modo `Agent`, a do seu revisor, e as duas podem estar vivas ao mesmo tempo. Na etapa de PR, a task tem a sessão da pull request e a do review dela. Um review de pull request do centro de review tem uma sessão só, na stage `review`, com todas as passadas, e uma discussão tem uma sessão só, na stage `discussion`. Cada sessão é identificada pela chave `{item, stage}`, com a stage sendo `prd`, `tech_spec`, `plan`, `one_shot`, `step:<n>`, `step_review:<n>`, `pr` ou `pr_review` numa task, `review` num review e `discussion` numa discussão; no código, o id do item é o campo `TaskID` da chave.

Cada sessão guarda a sua conversa. Voltar a uma etapa retoma a sessão dela de onde ficou; avançar abre uma nova. As sessões de planejamento abrem no clone do repositório da task. A sessão de um step abre dentro da worktree da task, com o arquivo do step como primeira mensagem, ou com o documento One-Shot no step único de uma task One-Shot; a do revisor de um step, a de PR e a de review de PR abrem na mesma worktree com o prompt correspondente. A sessão de um review abre na worktree do review, em detached HEAD no head da pull request, com o prompt de review de PR, e começa com o marcador `review_started`. A sessão de uma discussão abre na pasta de artefatos dela, com o prompt de discussão, e começa com o marcador `discussion_started`; ela não tem worktree, e cada clone dos repositórios do board entra como diretório adicional, ver [A conversa de uma discussão](#a-conversa-de-uma-discussão).

## Onde o binário está

O app procura `claude` no `PATH` e depois em `~/.local/bin`. A variável `MYSPEC_CLAUDE_PATH` fixa o caminho. Antes da primeira sessão o app confere que o binário existe e que há um login; sem um dos dois a sessão fica em erro com a razão, e **Tentar de novo** repete a verificação.

## Flags

Todo processo sobe com as flags fixas:

```
-p --output-format stream-json --input-format stream-json --verbose
   --include-partial-messages --permission-mode auto --permission-prompt-tool stdio
```

mais `--add-dir <caminho>` por clone que a sessão pode ler, o que só uma discussão usa, `--session-id <id>` na primeira execução e `--resume <id>` nas seguintes, para que o app escolha o id, e `--model`, com o que a sessão carrega: a escolha da etapa, do step ou, para o revisor de um step, a do review de step da task quando foi criada, ou a que o usuário fez na conversa desde então. O modelo vai pelo nome completo que o catálogo dá, com o sufixo `[1m]` quando ele existe, nunca por um alias. `--effort` só acompanha um modelo que o catálogo diz aceitar esforço: para um modelo sem esforço a flag não vai, e o esforço da escolha fica guardado, intacto. Um modelo que o catálogo não tem leva o esforço que a escolha guarda, e o CLI decide.

O modo `-p` sem `--bare` usa as credenciais do login interativo, ou seja, a assinatura do usuário. É o que permite não ter API key.

## Protocolo

O app escreve as mensagens do usuário no stdin como JSON, uma por linha, e lê o stream de eventos do stdout linha a linha. Do stream ele monta o transcript: mensagens do assistente com texto em streaming, chamadas de ferramenta com o resultado, e o `result` que fecha cada turno. O `system/init` traz o id da sessão, o modelo e as `capabilities`, que servem para detectar mudanças de protocolo sem comparar versões.

O mesmo canal carrega o controle:

- **Permissões**: com `--permission-prompt-tool stdio`, uma escalada que o modo auto não resolve chega como `control_request` de `can_use_tool`, com a ferramenta e a entrada exata. O app a mostra como um cartão e responde com um `control_response` de allow, allow pela sessão, ou deny com uma mensagem.
- **Perguntas**: as perguntas estruturadas do agente (`AskUserQuestion`) chegam pelo mesmo canal e são respondidas com as opções escolhidas. Os prompts de implementação, review de step, PR e review de PR exigem que o agente pergunte assim, nunca como texto ao fim de uma resposta, para que o produto saiba distinguir uma pergunta de um resumo.
- **Interrupção**: um `control_request` de `interrupt` escrito no stdin encerra o turno; o CLI responde com um `result` abortado e segue vivo.

Uma linha de saída pode chegar a 16 MiB, porque o resultado de uma ferramenta pode ser grande. Os últimos 4 KiB do stderr são guardados para explicar uma saída inesperada.

## Catálogo de modelos

O que os seletores oferecem vem do próprio Claude Code instalado. O app o pergunta num processo só dele, com as mesmas flags fixas e o diretório de dados como diretório de trabalho, para que o CLI nunca leia um projeto do usuário: escreve no stdin um `control_request` de `list_models`, lê do stdout o `control_response` daquele pedido, fecha o stdin, e o processo termina. A leitura acontece uma vez por execução do app, em segundo plano depois que os dados carregaram, com 20 segundos de limite; a janela nunca espera por ela.

De cada entrada da resposta o app guarda o nome completo resolvido do modelo e os níveis de esforço que ele aceita, nenhum para um modelo sem esforço. O alias, o nome de exibição e a descrição não são usados. A ordem é a do CLI, com uma opção por modelo resolvido: de duas entradas que resolvem para o mesmo modelo vale a primeira, a entrada de alias `default` é pulada, porque duplica outra, e as que o CLI marca como desabilitadas ficam de fora.

Uma leitura bem-sucedida substitui o catálogo em memória e é gravada como a última leitura daquela máquina. Uma leitura que falha não mexe em nenhum dos dois: guarda só a razão, que a interface mostra enquanto não houver catálogo nenhum. Falha o binário que não foi encontrado, o processo que errou ou estourou o tempo, a resposta que não se entende e a que não traz modelo nenhum; um CLI antigo demais responde um erro ao pedido, e é lido como `unsupported`.

## Ciclo de vida do processo

- **Início**: o processo sobe no diretório da sessão com as flags acima. A sessão fica em erro se o processo não sobe, se morre, ou se o primeiro turno falha, com o tipo do erro e o que o stderr disse.
- **Ocioso**: um processo sem turno, sem pedido pendente e sem mensagem na fila por dez minutos é parado. A conversa não muda; a próxima mensagem sobe outro processo com `--resume` e o agente segue lembrando de tudo.
- **Pausa**: pausar para o processo da mesma forma e marca a sessão como pausada, com a hora da pausa gravada em `sessions.paused_at`, o que a exclui das situações que esperam pelo usuário. Retomar sobe o processo de novo e limpa a hora. Aprovar um step retoma a sessão pausada sozinho.
- **Troca de modelo ou esforço**: a escolha nova é guardada na sessão. Na mensagem seguinte, se o processo vivo roda com outra escolha, o app o para, ocioso, e sobe outro com `--resume` e as flags novas. Uma resposta em andamento termina com a escolha anterior.
- **Fila**: mensagens enviadas com o agente ocupado esperam numa fila visível e são entregues uma a uma quando o turno termina. Podem ser removidas antes de sair.
- **Conversa fechada**: a conversa de uma sessão que não está aberta, de uma etapa que já passou ou de antes de um reinício, é lida do banco por `Transcript`, somente leitura: nenhum processo sobe, nenhum run é criado e nada é gravado. As mensagens que ficaram na fila de fora, porque uma sessão fechada não envia mais nada. Uma sessão descartada não tem mais conversa: a linha dela foi apagada.
- **Conversas da task**: `session.Service` mantém em memória a lista das sessões de cada item, abertas ou fechadas, com a etapa e a hora em que começaram, para o snapshot não ler o banco. `LoadConversations` a monta do banco ao iniciar o app, e ela muda só onde uma linha de `sessions` nasce (a sessão criada ao abrir) ou morre: por `Discard` e `DiscardTask`, que apagam a linha e avisam o índice, ou por `ForgetTask`, que só avisa o índice, para quando apagar a task já levou as linhas por cascata. `Conversations` a devolve pela hora de início.
- **Encerramento**: fechar o app dá alguns segundos para os processos pararem por bem antes de matá-los. Avançar de etapa, descartar, voltar ou apagar a task encerram as sessões envolvidas. O fim de um review, pelo merge ou pelo fechamento da pull request, e apagá-lo encerram e apagam a conversa dele. Arquivar uma discussão encerra a conversa dela, que fica guardada para o histórico; apagá-la a encerra e a apaga.

## Prompts

O prompt de cada tipo de sessão é renderizado no início dela a partir do texto padrão embutido no binário ou do arquivo editado pelo usuário, com os placeholders preenchidos: `{{task_name}}`, `{{prd_path}}`, `{{tech_spec_path}}`, `{{steps_dir}}`, `{{step_path}}`, `{{one_shot_path}}`, `{{artifacts_dir}}`, `{{initial_context}}`, `{{repository}}`, `{{branch}}`, `{{base_branch}}`, `{{draft_path}}`, `{{review_path}}`, `{{pr_number}}`, `{{pr_url}}`, `{{what_to_commit}}`, `{{push}}`, `{{document_path}}` e `{{drafts_path}}`. Os prompts padrão são os mesmos para tasks e reviews de pull request: o que um review precisa a mais entra por seções que `prompts.Render` acrescenta, descritas em [O review de uma pull request sem task](#o-review-de-uma-pull-request-sem-task). O prompt de commit é enviado como mensagem do app dentro da sessão do step ou do review, para que quem commite seja o agente que escreveu o código.

O contexto inicial entra nos prompts que abrem uma task, o de PRD e o de planejamento One-Shot, e no de discussão, e aparece na conversa como a primeira mensagem do usuário; um prompt editado que perdeu `{{initial_context}}` o recebe ao fim. `{{repository}}` é o `dono/nome` do repositório da task, preenchido em todas as sessões de uma task e de um review; uma discussão pertence a um board, não a um repositório, e não o carrega. O contexto inicial de uma task criada de um card é montado pelo app na criação, por `board.Context`, a partir da leitura guardada do board, e gravado como o contexto inicial da task; as sessões de PRD e de planejamento One-Shot o recebem como qualquer outro.

`{{what_to_commit}}` vira a instrução de commitar exatamente o que está em stage ou, depois de um relatório limpo do revisor, a de commitar tudo o que mudou na worktree com `git add -A`. Como a de `{{push}}`, ela é acrescentada ao fim de um prompt de commit editado que perdeu o placeholder, porque commitar do jeito errado é o erro mais caro do fluxo. O prompt de commit padrão reconhece um merge em andamento, `git rev-parse -q --verify MERGE_HEAD`, e o conclui com `git commit --no-edit`, que mantém a mensagem que o git preparou; é assim que o merge da base que resolve um conflito aprovado vira o commit da rodada. O prompt de review de step termina sempre com a última resposta do implementador, que nunca é placeholder: o texto da última mensagem que o implementador escreveu depois da última que recebeu, ou uma frase que diz que ele não escreveu nada. Na conversa do revisor, essa resposta aparece como mensagem do app.

Os prompts de review de step, PR e review de PR servem aos dois modos sem um texto por modo. Numa task One-Shot, `prompts.Vars.OneShotPath` carrega o caminho do documento: `{{prd_path}}`, `{{tech_spec_path}}` e `{{step_path}}` renderizam esse caminho, e `prompts.Render` acrescenta a esses três prompts uma seção `## One-Shot task`, um texto fixo por tipo que diz o que o documento faz no lugar do PRD, do tech spec e do arquivo do step. No review de step ela vem antes da resposta do implementador, que continua sendo o fim do prompt. Numa task Structured, `OneShotPath` é vazio e nada disso acontece. Como a troca e a seção não dependem de o texto ter algum placeholder, um prompt editado funciona nos dois modos.

O prompt de PR de uma task criada de um card recebe o card por `prompts.Vars.Card`, em Markdown, e `prompts.Vars.CardReference`, o `dono/nome#número`. `prompts.Render` acrescenta ao prompt uma seção `## Card`, com a instrução de começar o corpo do rascunho com `Closes <dono/nome>#<número>` e o card, depois da seção `## One-Shot task` quando as duas existem. Como ela, a seção não depende de placeholder e vale para um prompt editado. `flow.OpenPR` garante a referência: se a descrição aprovada não fecha o card, `task.EnsureClosingReference` acrescenta `Closes <dono/nome>#<número>` ao fim antes de a pull request ser aberta.

As instruções fixas de review do repositório, `prompts.Vars.Instructions`, entram em todo prompt de review de PR, o de uma task incluído, numa seção `## Review instructions` ao fim. `flow` as lê do repositório a cada passada, e o review do centro de review também.

Todo prompt de review de PR recebe também duas seções sobre o GitHub, antes de `## Review instructions`. `## GitHub checks and conflicts` é um texto fixo: um check que falhou e um conflito com a base são apontamentos do relatório, que é `changes` sempre que há um deles; o agente investiga cada falha com o `gh` da sessão (`gh pr checks`, `gh run view --log-failed`) e escreve um apontamento por check ou por causa, ancorado quando a causa está numa linha do diff e geral quando não está; o conflito é um apontamento geral único, com os arquivos listados por `git merge-tree --write-tree`, nunca por `git merge`; o resumo registra o que o app leu; e um conflito aprovado é resolvido fazendo merge de `origin/<base>` na branch, nunca rebase, antes dos outros aprovados da rodada, deixando o merge em andamento, sem `git add` e sem commit. `## GitHub status` é o que o app leu antes da passada, montado por `prompts.PRChecksSection` a partir de `prompts.Vars.Checks`, um `gh.PRChecks`: se a pull request não tem checks, se todos passaram ou quais falharam, com a conclusão e o link, e se a branch merge limpa na base ou tem conflito. `prompts.Vars.MergeBase`, o `origin/<base>`, nomeia a ref do merge nas duas seções. Sem leitura, `Checks` é nil e a seção pede ao agente que leia o GitHub ele mesmo com `gh pr view --json statusCheckRollup,mergeable`. A seção não cita checks pendentes: uma passada só começa sem eles. As duas seções entram sempre, num prompt editado inclusive, porque revisar sem saber o que o GitHub disse deixaria passar um check vermelho ou um conflito.

## O review de uma pull request sem task

O review do centro de review usa o prompt de review de PR, com `prompts.Vars.External` ligado. No lugar do PRD e do tech spec, a sessão lê o documento de contexto, `context.md`, que `reviewflow` escreve na pasta do review ao iniciar e antes de cada passada seguinte, a partir da pull request relida do GitHub: o título, a referência, o link, o autor e as branches da pull request, a descrição e, quando a pull request está vinculada a um card, o card e o épico, montados por `board.ReviewContext` a partir da leitura guardada do board. `prompts.Vars.ContextPath` carrega o caminho, e `{{prd_path}}` e `{{tech_spec_path}}` o renderizam, pela mesma mecânica de `OneShotPath`; os dois nunca vêm juntos. O diff não entra no prompt: o agente o lê na worktree contra `origin/<base>`, como no review da pull request de uma task.

`prompts.Render` acrescenta ao prompt, depois da seção `## One-Shot task`, nesta ordem e cada uma, fora as do GitHub, só quando se aplica:

1. `## Pull request without a task`: que não há PRD nem tech spec, que toda referência a eles é o documento de contexto, que o card e a descrição são o critério e que a worktree está em detached HEAD, com a base.
2. `## Findings format`: o formato do corpo do relatório que o app lê, que substitui o que o prompt diz sobre o corpo. Depois do cabeçalho `---`, o resumo; depois, uma linha `## Findings` e um bloco por apontamento, `### <n>` seguido de `Location: <arquivo>:<linha>` ou `Location: general` e do texto.
3. `## Publishing`, no modo publicar: que o usuário decide cada apontamento no app e o app publica os aprovados, que o agente escreve cada apontamento como um comentário que o autor lê, que ele nunca edita, commita nem faz push, e que um pedido de mudança nos apontamentos é feito reescrevendo o relatório da passada no lugar. `## Applying`, no modo aplicar: que o agente implementa só o que o app enviar como aprovado.
4. `## GitHub checks and conflicts` e `## GitHub status`, sempre, descritas em [Prompts](#prompts).
5. `## Review instructions`, com as instruções fixas do repositório.
6. `## Instructions for this pass`, com o que o usuário escreveu no diálogo de início.

Como a seção One-Shot, nenhuma depende de placeholder, e todas valem para um prompt editado. As instruções da primeira passada aparecem na conversa como a primeira mensagem do usuário, como o contexto inicial de uma task.

Cada passada seguinte é uma mensagem fixa do app na mesma conversa, montada por `reviewflow`: o pedido de revisar a pull request como ela está, com a worktree já atualizada para o head; o arquivo do novo relatório e o número da passada; o commit que a passada anterior cobriu, para `git diff <commit>..HEAD`, quando o app o conhece, e a base, para o diff inteiro; a regra de que só o que é novo ou continua valendo é apontamento e de que o resumo diz o que foi resolvido; a seção `## Findings already published`, com os apontamentos que o autor já recebeu, ou `## Findings already applied` no modo aplicar, com os aprovados das passadas marcadas como aplicadas, as que tiveram as correções num commit que o app pediu e viu subir; a seção `## GitHub status`, com o que o app leu dos checks e do conflito antes da passada, o mesmo corpo que `prompts.PRChecksSection` dá ao prompt da primeira; e as seções `## Review instructions` e `## Instructions for this pass`, quando têm texto. As instruções fixas são relidas do repositório a cada passada. Cada relatório que o app grava entra na conversa como o marcador `pr_review_written`, com a passada, como no review da pull request de uma task.

No modo aplicar, os apontamentos aprovados vão ao agente numa mensagem fixa do app, que pede a correção de só eles, sem commit, sem `git add` e sem push. O commit usa o prompt de commit, com `prompts.Vars.PushRef` carregando a branch da pull request: como a worktree está em detached HEAD, `{{push}}` vira a instrução de subir com `git push origin HEAD:refs/heads/<branch>`, nunca com force-push.

## A conversa de uma discussão

A sessão de uma discussão roda na pasta de artefatos dela, onde o agente escreve `discussion.md` e `drafts.md` sem pedir permissão, e recebe por `--add-dir` o caminho de cada repositório do board que tem clone: é assim que ela lê o código sem worktree e sem nada em que escrever. Os clones são lidos do board a cada abertura da conversa, então um repositório clonado depois entra na próxima. `prompts.Vars.DocumentPath` e `prompts.Vars.DraftsPath` preenchem `{{document_path}}` e `{{drafts_path}}`, os dois arquivos que o agente escreve, e o contexto inicial montado por `board.DiscussionContext` aparece como a primeira mensagem do usuário.

`prompts.Render` acrescenta ao prompt de discussão, nesta ordem:

1. `## Board`, quando o board ainda está cadastrado: o título, os repositórios administrados, o campo de módulo com as opções, ou a frase que diz que os rascunhos não têm módulo, e o status com que um card novo entra no board.
2. `## Drafts format`, sempre: o formato exato de `drafts.md`, o cabeçalho `---` com `status`, `drafts` ou `none`, um bloco `## Draft: <id>` por rascunho, com `Kind`, `Repository` ou `Card`, `Module`, `Epic` e `Depends on`, e as seções `### Title` e `### Body`, com a regra de que o id é estável entre reescritas e que qualquer desvio torna o arquivo ilegível.

Como as seções do review, nenhuma depende de placeholder, então um prompt editado as recebe também.

## Correções automáticas

Quando o plano escrito não é válido, o app envia à sessão de plano uma mensagem descrevendo os problemas e pedindo a correção, até três vezes por task. Depois disso os problemas ficam expostos ao usuário. O contador de correções é da sessão e zera quando a etapa é descartada.

## O loop do review de step

Num step no modo `Agent`, `flow` conduz a conversa entre o implementador e o revisor; os dois agentes nunca se falam diretamente. A avaliação do step só age com o implementador ocioso e sem turno com falha, a worktree lida sem erro, a branch onde o step começou e o revisor, quando aberto, também ocioso e sem falha. Uma conversa que trabalha, pergunta, está pausada ou com erro é onde o step espera, o que cobre a task pausada, os erros de sessão e as mensagens do usuário a qualquer das conversas sem regra própria. Um step com o turno de commit em andamento também fica fora do loop: o relatório que levou a ele já foi tratado.

A cada avaliação o loop faz uma de quatro coisas:

- **Pedir uma passada**, quando nenhuma está em curso e a worktree tem mudanças. A primeira abre a sessão `step_review:<n>` com o prompt de review de step; as seguintes são uma mensagem fixa do app na mesma conversa, com a resposta do implementador e o caminho do novo relatório.
- **Entregar um relatório com mudanças**, numa mensagem fixa do app na conversa do implementador, com o conteúdo inteiro do relatório e o pedido de responder item a item, corrigido ou contestado, sem commitar. Assim a última resposta do implementador basta para o revisor julgar as contestações.
- **Pedir o commit** de um relatório limpo, com o prompt de commit e a instrução de commitar tudo o que mudou.
- **Passar o step ao usuário**, quando a passada que confere a última rodada ainda pede mudanças.

A tabela `steps` guarda três colunas do loop: `review_pass`, a última passada que o app pediu; `reported_pass`, a última cujo relatório o app tratou; e `review_fallback`, por que o step passou ao usuário, `taken_over`, `rounds_exhausted` ou `commit_failed`. Uma passada está em curso enquanto a primeira é maior que a segunda. Todo o resto, os estados `agent_review` e `addressing_review`, a passada, a rodada e a passada sem relatório, é derivado dessas colunas, das duas sessões, da worktree e dos relatórios no disco. Com `review_fallback` gravado, o step é derivado exatamente como no modo `Manual`, o revisor fica como está e o loop não age mais sobre ele. `ApproveStep` recusa um step que o agente revisa, para que nenhum commit aconteça sem relatório limpo.

Cada ação acontece antes de o app registrar o relatório como tratado: a mensagem é enviada, ou a queda é gravada, e só então `reported_pass` avança e o marcador `step_review_written`, com a passada e o veredito, entra na conversa do revisor. Uma falha no meio é repetida pela avaliação seguinte e nunca faz o loop pular uma etapa. A exceção é a passada pedida, gravada antes do pedido, para que duas avaliações nunca a peçam duas vezes, e desfeita quando o pedido falha. Pelo mesmo motivo, quando o turno de commit depois de um relatório limpo termina sem commit, a queda é gravada antes de o step voltar a `started`: uma falha nunca o deixa sob um review que pediria uma nova passada.

O teto é `flow.MaxReviewRounds`, três rodadas: o relatório com mudanças de uma passada além da terceira não vai ao implementador. Um relatório só conta com o status `clean` ou `changes` e com um cabeçalho que concorda com o nome do arquivo; qualquer outra coisa é uma passada sem relatório, que espera pelo usuário, e um veredito que o app não entende nunca vira commit.

**Review myself** grava a queda e, com uma passada em curso, interrompe o turno do revisor. Um revisor ocioso não tem o que interromper, e um implementador trabalhando termina o turno. Reabrir o app reabre a conversa do revisor do step que roda, quando ele já teve uma passada, ao lado da do implementador, e o loop segue do que as colunas e os relatórios dizem. Com o step concluído, as duas sessões são fechadas. Descartar o step apaga as duas conversas e os relatórios do step e zera as três colunas; o modo com que o step começou fica.

## Fakes para testes

Os pacotes que dirigem o CLI real testam contra `internal/claude/claudetest`, um CLI falso que fala o mesmo protocolo. Ele não é um script no disco: o próprio binário de teste se reexecuta como o CLI quando a variável de ambiente `claudetest.EnvFlag` está definida, declarado num `TestMain` de uma linha. Um roteiro descreve o que o falso responde a cada entrada, e os arquivos de `internal/claude/testdata` guardam streams reais gravados. Ver [testing.md](../guidelines/testing.md).
