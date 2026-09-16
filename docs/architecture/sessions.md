# Sessões e o processo do Claude Code

Uma sessão é uma conversa entre o usuário e o Claude Code conduzida pelo produto. Este documento descreve o processo por trás dela: como sobe, o que fala, como para e como volta.

## Um processo por sessão ativa

Uma task roda um processo `claude` por sessão ativa. Nas etapas de planejamento, uma task tem uma sessão ativa por vez: a da etapa em que está, nos dois modos. Na implementação, o step que roda tem a sua e, no modo `Agent`, a do seu revisor, e as duas podem estar vivas ao mesmo tempo. Na etapa de PR, a task tem a sessão da pull request e a do review dela. Cada sessão é identificada pela chave `{task, stage}`, com a stage sendo `prd`, `tech_spec`, `plan`, `one_shot`, `step:<n>`, `step_review:<n>`, `pr` ou `pr_review`.

Cada sessão guarda a sua conversa. Voltar a uma etapa retoma a sessão dela de onde ficou; avançar abre uma nova. As sessões de planejamento abrem no clone do repositório da task. A sessão de um step abre dentro da worktree da task, com o arquivo do step como primeira mensagem, ou com o documento One-Shot no step único de uma task One-Shot; a do revisor de um step, a de PR e a de review de PR abrem na mesma worktree com o prompt correspondente.

## Onde o binário está

O app procura `claude` no `PATH` e depois em `~/.local/bin`. A variável `MYSPEC_CLAUDE_PATH` fixa o caminho. Antes da primeira sessão o app confere que o binário existe e que há um login; sem um dos dois a sessão fica em erro com a razão, e **Tentar de novo** repete a verificação.

## Flags

Todo processo sobe com as flags fixas:

```
-p --output-format stream-json --input-format stream-json --verbose
   --include-partial-messages --permission-mode auto --permission-prompt-tool stdio
```

mais `--session-id <id>` na primeira execução e `--resume <id>` nas seguintes, para que o app escolha o id, e sempre `--model` e `--effort`, com o que a sessão carrega: a escolha da etapa, do step ou, para o revisor de um step, a do review de step da task quando foi criada, ou a que o usuário fez na conversa desde então. O modelo vai pelo nome completo (`claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5`).

O modo `-p` sem `--bare` usa as credenciais do login interativo, ou seja, a assinatura do usuário. É o que permite não ter API key.

## Protocolo

O app escreve as mensagens do usuário no stdin como JSON, uma por linha, e lê o stream de eventos do stdout linha a linha. Do stream ele monta o transcript: mensagens do assistente com texto em streaming, chamadas de ferramenta com o resultado, e o `result` que fecha cada turno. O `system/init` traz o id da sessão, o modelo e as `capabilities`, que servem para detectar mudanças de protocolo sem comparar versões.

O mesmo canal carrega o controle:

- **Permissões**: com `--permission-prompt-tool stdio`, uma escalada que o modo auto não resolve chega como `control_request` de `can_use_tool`, com a ferramenta e a entrada exata. O app a mostra como um cartão e responde com um `control_response` de allow, allow pela sessão, ou deny com uma mensagem.
- **Perguntas**: as perguntas estruturadas do agente (`AskUserQuestion`) chegam pelo mesmo canal e são respondidas com as opções escolhidas. Os prompts de implementação, review de step, PR e review de PR exigem que o agente pergunte assim, nunca como texto ao fim de uma resposta, para que o produto saiba distinguir uma pergunta de um resumo.
- **Interrupção**: um `control_request` de `interrupt` escrito no stdin encerra o turno; o CLI responde com um `result` abortado e segue vivo.

Uma linha de saída pode chegar a 16 MiB, porque o resultado de uma ferramenta pode ser grande. Os últimos 4 KiB do stderr são guardados para explicar uma saída inesperada.

## Ciclo de vida do processo

- **Início**: o processo sobe no diretório da sessão com as flags acima. A sessão fica em erro se o processo não sobe, se morre, ou se o primeiro turno falha, com o tipo do erro e o que o stderr disse.
- **Ocioso**: um processo sem turno, sem pedido pendente e sem mensagem na fila por dez minutos é parado. A conversa não muda; a próxima mensagem sobe outro processo com `--resume` e o agente segue lembrando de tudo.
- **Pausa**: pausar para o processo da mesma forma e marca a sessão como pausada, o que a exclui das situações que esperam pelo usuário. Retomar sobe o processo de novo. Aprovar um step retoma a sessão pausada sozinho.
- **Troca de modelo ou esforço**: a escolha nova é guardada na sessão. Na mensagem seguinte, se o processo vivo roda com outra escolha, o app o para, ocioso, e sobe outro com `--resume` e as flags novas. Uma resposta em andamento termina com a escolha anterior.
- **Fila**: mensagens enviadas com o agente ocupado esperam numa fila visível e são entregues uma a uma quando o turno termina. Podem ser removidas antes de sair.
- **Encerramento**: fechar o app dá alguns segundos para os processos pararem por bem antes de matá-los. Avançar de etapa, descartar, voltar ou apagar a task encerram as sessões envolvidas.

## Prompts

O prompt de cada tipo de sessão é renderizado no início dela a partir do texto padrão embutido no binário ou do arquivo editado pelo usuário, com os placeholders preenchidos: `{{task_name}}`, `{{prd_path}}`, `{{tech_spec_path}}`, `{{steps_dir}}`, `{{step_path}}`, `{{one_shot_path}}`, `{{artifacts_dir}}`, `{{initial_context}}`, `{{repository}}`, `{{branch}}`, `{{base_branch}}`, `{{draft_path}}`, `{{review_path}}`, `{{pr_number}}`, `{{pr_url}}`, `{{what_to_commit}}` e `{{push}}`. O prompt de commit é enviado como mensagem do app dentro da sessão do step ou do review, para que quem commite seja o agente que escreveu o código.

O contexto inicial entra só nos prompts que abrem uma task, o de PRD e o de planejamento One-Shot, e aparece na conversa como a primeira mensagem do usuário; um prompt editado que perdeu `{{initial_context}}` o recebe ao fim. `{{repository}}` é o `dono/nome` do repositório da task, preenchido em todas as sessões.

`{{what_to_commit}}` vira a instrução de commitar exatamente o que está em stage ou, depois de um relatório limpo do revisor, a de commitar tudo o que mudou na worktree com `git add -A`. Como a de `{{push}}`, ela é acrescentada ao fim de um prompt de commit editado que perdeu o placeholder, porque commitar do jeito errado é o erro mais caro do fluxo. O prompt de review de step termina sempre com a última resposta do implementador, que nunca é placeholder: o texto da última mensagem que o implementador escreveu depois da última que recebeu, ou uma frase que diz que ele não escreveu nada. Na conversa do revisor, essa resposta aparece como mensagem do app.

Os prompts de review de step, PR e review de PR servem aos dois modos sem um texto por modo. Numa task One-Shot, `prompts.Vars.OneShotPath` carrega o caminho do documento: `{{prd_path}}`, `{{tech_spec_path}}` e `{{step_path}}` renderizam esse caminho, e `prompts.Render` acrescenta a esses três prompts uma seção `## One-Shot task`, um texto fixo por tipo que diz o que o documento faz no lugar do PRD, do tech spec e do arquivo do step. No review de step ela vem antes da resposta do implementador, que continua sendo o fim do prompt. Numa task Structured, `OneShotPath` é vazio e nada disso acontece. Como a troca e a seção não dependem de o texto ter algum placeholder, um prompt editado funciona nos dois modos.

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
