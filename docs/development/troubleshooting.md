# Diagnóstico

Quando algo parece errado, o log é o primeiro lugar: `~/.local/state/myspec/myspec.log`, em JSON, uma linha por registro. `MYSPEC_LOG_LEVEL=debug` aumenta o detalhe; o binário de desenvolvimento (`task dev`) escreve também no stderr.

Cada mensagem é uma frase fixa, e o que varia vai em atributos: `task`, `stage`, `step`, `repository`, `path`, `error`. Filtrar por `msg` com `jq` ou `grep` é a forma mais rápida de seguir uma task:

```sh
jq -c 'select(.task == "<id>")' ~/.local/state/myspec/myspec.log
```

## O que procurar

**Início e sessões.** `app starting` abre cada execução, com a versão, os argumentos e os diretórios. `claude session ready` marca um processo que subiu e respondeu, com a task a que pertence. `binding failed` marca uma chamada da interface que o Go recusou, com o método. `claude restarting` marca um processo trazido de volta com flags novas por uma troca de modelo na conversa.

**Etapas.** `stage advanced`, `stage revisited` e `stage discarded` marcam cada movimento entre etapas, com a task e as etapas envolvidas.

**Steps e worktrees.** `worktree created`, `worktree cleaned`, `worktree removed` e `worktree recreated`, com a task e o caminho. `step started`, `step retried`, `step cleaned and started`, `step discarded` e `steps torn down`, com a task e o número. `step blocked`, com a razão pela qual o step não pôde começar.

**Review e commit.** `step approved`, quando o usuário aprova e o prompt de commit é enviado. `step committed`, com o sha curto e o assunto. `commit did not happen`, quando o turno de commit terminou sem commit. `implementation complete`, quando o último step é commitado. `review read failed`, com o caminho da worktree e o que o git disse.

**Pull requests e encerramento.** `repository closing` e `repository closed`, com o resultado de cada parte do encerramento.

**Modelos e prompts.** `model default changed`, `task model set`, `task step model set`, `session model set` e `session model changed`, com a etapa ou o step e a escolha. `prompt saved`, `prompt restored` e `prompt copy of the default removed`, com o prompt.

**Notificações e som.** `send notification failed`, `withdraw notification failed` e `notification dropped` marcam uma notificação que o servidor recusou ou não respondeu. `install chime failed` diz por que o som não foi copiado para o diretório de dados; sem ele as notificações aparecem mudas. `read notification capabilities failed` marca um servidor que não disse se toca sons; o app toca o carrilhão ele mesmo. `play chime failed` traz cada player tentado e o que ele disse. `chime silenced` marca um carrilhão calado pelo não perturbe. Em `debug`: `chime played`, com o player; `chime dropped`, um carrilhão pedido enquanto outro tocava; `do not disturb on` e `do not disturb unknown`, com a fonte que respondeu ou falhou.

## Problemas conhecidos

- **Uma segunda instância trabalha à toa.** Ao abrir `myspec <pasta>` com o app já aberto, o segundo processo roda todo o seu início, log e banco inclusive, antes de o Wails encontrar o lock e entregar os argumentos. O log ganha um segundo `app starting` de um processo que então sai. Nada é corrompido; o trabalho é desperdiçado.
- **O banco fica com modo 0644.** O WebKitGTK cria `~/.local/share/myspec/` antes do app, então o `0700` que o app pediria para o diretório não se aplica.
- **`Overriding existing handler for signal 10` no stderr.** É o WebKit, e é inofensivo.
- **O teste global de eventos entra em pânico com `-count=2`.** `go test -count=2 ./internal/bindings/` registra os eventos do Wails duas vezes no mesmo processo. Rodar uma vez, como o `task test:go` faz, passa.
