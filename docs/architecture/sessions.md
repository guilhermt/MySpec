# Sessões e o processo do Claude Code

Uma sessão é uma conversa entre o usuário e o Claude Code conduzida pelo produto. Este documento descreve o processo por trás dela: como sobe, o que fala, como para e como volta.

## Um processo por sessão ativa

Uma task roda um processo `claude` por sessão ativa. Fora da etapa de PR, uma task tem uma sessão ativa por vez: a da etapa em que está, ou a do step que roda. Na etapa de PR, cada repositório tem a sua, e várias podem estar vivas ao mesmo tempo. Cada sessão é identificada pela chave `{task, stage}`, com a stage sendo `prd`, `tech_spec`, `plan`, `step:<n>`, `pr:<slug>` ou `pr_review:<slug>`.

Cada sessão guarda a sua conversa. Voltar a uma etapa retoma a sessão dela de onde ficou; avançar abre uma nova. A sessão de um step abre dentro da worktree do repositório, com o arquivo do step como primeira mensagem; as de PR e de review abrem na mesma worktree com o prompt correspondente.

## Onde o binário está

O app procura `claude` no `PATH` e depois em `~/.local/bin`. A variável `MYSPEC_CLAUDE_PATH` fixa o caminho. Antes da primeira sessão o app confere que o binário existe e que há um login; sem um dos dois a sessão fica em erro com a razão, e **Tentar de novo** repete a verificação.

## Flags

Todo processo sobe com as flags fixas:

```
-p --output-format stream-json --input-format stream-json --verbose
   --include-partial-messages --permission-mode auto --permission-prompt-tool stdio
```

mais `--session-id <id>` na primeira execução e `--resume <id>` nas seguintes, para que o app escolha o id, e sempre `--model` e `--effort`, com o que a sessão carrega: a escolha da etapa ou do step quando foi criada, ou a que o usuário fez na conversa desde então. O modelo vai pelo nome completo (`claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5`).

O modo `-p` sem `--bare` usa as credenciais do login interativo, ou seja, a assinatura do usuário. É o que permite não ter API key.

## Protocolo

O app escreve as mensagens do usuário no stdin como JSON, uma por linha, e lê o stream de eventos do stdout linha a linha. Do stream ele monta o transcript: mensagens do assistente com texto em streaming, chamadas de ferramenta com o resultado, e o `result` que fecha cada turno. O `system/init` traz o id da sessão, o modelo e as `capabilities`, que servem para detectar mudanças de protocolo sem comparar versões.

O mesmo canal carrega o controle:

- **Permissões**: com `--permission-prompt-tool stdio`, uma escalada que o modo auto não resolve chega como `control_request` de `can_use_tool`, com a ferramenta e a entrada exata. O app a mostra como um cartão e responde com um `control_response` de allow, allow pela sessão, ou deny com uma mensagem.
- **Perguntas**: as perguntas estruturadas do agente (`AskUserQuestion`) chegam pelo mesmo canal e são respondidas com as opções escolhidas. Os prompts de implementação, PR e review de PR exigem que o agente pergunte assim, nunca como texto ao fim de uma resposta, para que o produto saiba distinguir uma pergunta de um resumo.
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

O prompt de cada tipo de sessão é renderizado no início dela a partir do texto padrão embutido no binário ou do arquivo editado pelo usuário, com os placeholders preenchidos: `{{task_name}}`, `{{prd_path}}`, `{{tech_spec_path}}`, `{{steps_dir}}`, `{{artifacts_dir}}`, `{{repositories}}`, `{{initial_context}}`, `{{repository}}`, `{{branch}}`, `{{base_branch}}`, `{{draft_path}}`, `{{review_path}}`, `{{pr_number}}`, `{{pr_url}}` e `{{push}}`. O prompt de commit é enviado como mensagem do app dentro da sessão do step ou do review, para que quem commite seja o agente que escreveu o código.

## Correções automáticas

Quando o plano escrito não é válido, o app envia à sessão de plano uma mensagem descrevendo os problemas e pedindo a correção, até três vezes por task. Depois disso os problemas ficam expostos ao usuário. O contador de correções é da sessão e zera quando a etapa é descartada.

## Fakes para testes

Os pacotes que dirigem o CLI real testam contra `internal/claude/claudetest`, um CLI falso que fala o mesmo protocolo. Ele não é um script no disco: o próprio binário de teste se reexecuta como o CLI quando a variável de ambiente `claudetest.EnvFlag` está definida, declarado num `TestMain` de uma linha. Um roteiro descreve o que o falso responde a cada entrada, e os arquivos de `internal/claude/testdata` guardam streams reais gravados. Ver [testing.md](../guidelines/testing.md).
