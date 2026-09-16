# Armazenamento

Tudo que o app guarda fica em dois lugares, seguindo a especificação XDG: o diretório de dados para o estado, os artefatos e as worktrees, e o diretório de estado para o log.

## Diretório de dados

`~/.local/share/myspec/`:

```
myspec.db                              o banco SQLite
prompts/<nome>.md                      só os prompts editados pelo usuário
sounds/chime.wav                       o som das notificações
tasks/<dono>/<nome>/<task>/            os artefatos de cada task
worktrees/<dono>/<nome>/<task>/        a worktree de cada task
```

### Banco

`myspec.db` guarda as configurações (tema, padrões de modelo e de modo de review, filtro por repositório), os repositórios cadastrados, as tasks, com o modo, os modos de review e o card do board de que foram criadas, os steps, com o ponto do review pelo agente, as sessões e as entradas das conversas, as worktrees, as pull requests e as situações. É aberto com uma única conexão, WAL, `busy_timeout` de cinco segundos e foreign keys, e só o Go o acessa.

O schema é versionado por `PRAGMA user_version` e evolui por migrations em `internal/store/migrations/`, nomeadas `NNNN_nome.sql` com quatro dígitos, aplicadas em ordem, uma transação por arquivo, ao abrir o banco. Uma migration já aplicada nunca é editada: uma mudança de schema é sempre um arquivo novo. Os estados que a interface mostra são derivados; o banco guarda só o que não pode ser derivado, como ids de sessão, o modo de cada task, escolhas de modelo e de modo de review, a passada que o review pelo agente pediu e a que ele tratou, resultados de encerramento e quando cada situação começou.

### Prompts

Os prompts padrão vivem no binário, em `internal/prompts/defaults/`. O diretório `prompts/` guarda apenas os que o usuário editou: `prd.md`, `tech_spec.md`, `plan.md`, `one_shot.md`, `step_review.md`, `commit.md`, `pr.md` e `pr_review.md`. Um prompt sem arquivo segue o padrão da versão que roda, e um arquivo idêntico ao padrão é removido quando o app inicia, para que um prompt restaurado volte a acompanhar as versões novas. O prompt é lido quando uma sessão começa.

### Som

`sounds/chime.wav` é uma cópia do som embutido no binário, escrita ao iniciar quando falta ou difere, para que um servidor de notificações que toca sons a leia por caminho. Apagá-la é inofensivo: o app a escreve de novo na próxima vez que abrir.

### Migração dos dados

A migration 0012 é a que cadastra os repositórios, e é na transação dela que roda o `store.Upgrade` que o app injeta, o pacote `internal/upgrade`. Ele lê cada task de um banco que ainda guarda áreas de trabalho, identifica o clone dela pelo remote `origin`, cadastra um repositório por identidade, liga a task a ele, move os artefatos para a pasta nova e renomeia os arquivos da etapa de PR, que já não carregam o slug de um repositório. Uma task arquivada da raiz de uma área de trabalho é descartada, artefatos incluídos.

O upgrade é tudo ou nada. Ele recusa, sem escrever nada, quando encontra uma task ativa na raiz de uma área de trabalho, um clone que ele não consegue identificar no GitHub ou duas tasks com o mesmo nome num repositório. Uma recusa desfaz o que já tinha sido movido no disco, a transação não commita, o banco fica na versão anterior — que a versão anterior do app abre inteira — e o app mostra a tela de migração recusada com os casos a resolver, no lugar do produto. Com o commit feito, as pastas descartadas e a pasta `workspaces/` são apagadas.

### Artefatos

Os artefatos de uma task ficam em `tasks/<dono>/<nome>/<task>/`, com `dono` e `nome` como o GitHub nomeia o repositório, para que duas tasks de repositórios diferentes com o mesmo nome não colidam. Dentro da pasta da task:

```
PRD.md
tech-spec.md
steps/<número>-<descrição-curta>.md   um arquivo por step
one-shot.md                           o documento de uma task One-Shot
step-reviews/<step>-review-<n>.md     o review pelo agente, um relatório por passada
pr/draft.md                           o rascunho da pull request
pr/review-<n>.md                      o review da pull request, um relatório por passada
```

Uma task Structured tem `PRD.md`, `tech-spec.md` e `steps/`; uma task One-Shot tem `one-shot.md` no lugar dos três, e o plano de um step que o app lê dele não é escrito no disco.

O review pelo agente escreve em `step-reviews/` um relatório por passada de cada step, com o número do step e o da passada no nome. O step único de uma task One-Shot é o número 1. O relatório abre com um cabeçalho `---` que carrega `step`, `pass` e `status`, `clean` ou `changes`; um relatório com outro status, ou com um cabeçalho que discorda do nome, não conta como passada. Os relatórios ficam fora de `steps/`, que é validada como plano. O app relê a pasta a cada inspeção da task, e é dela que o loop deriva o que fazer. Os relatórios pertencem ao step: vão embora ao descartar o step, ao voltar a uma etapa anterior à implementação e ao descartar o plano ou o planejamento One-Shot.

A etapa de PR escreve em `pr/` o rascunho da pull request da task, `draft.md`, e os relatórios de review dela, um por passada, nomeados `review-<n>.md`. Os artefatos são o que as sessões leem por caminho e o que o painel de artefatos e o histórico mostram. Apagar uma task apaga a pasta.

## Worktrees

As worktrees vivem no diretório de dados, em `~/.local/share/myspec/worktrees/<dono>/<nome>/<task>/`, uma por task, longe dos clones que o usuário mantém. O banco registra cada worktree antes de o `git worktree add` rodar, e o app só remove o que registrou.

O registro guarda o caminho da worktree e o clone em que o git roda para ela, que é o clone atual do repositório: trocar o caminho do repositório leva junto o das worktrees das suas tasks, porque é lá que a branch vive. Uma worktree registrada em outro caminho continua sendo usada onde está e é removida de lá; o app nunca move uma worktree.

## Log

`~/.local/state/myspec/myspec.log`, em JSON, uma linha por registro, com nível `info` por padrão. `MYSPEC_LOG_LEVEL` aceita `debug`, `warn` e `error`. O binário de desenvolvimento escreve também no stderr. O que cada linha significa está em [troubleshooting.md](../development/troubleshooting.md).

## O que o WebKitGTK cria

O webview cria `~/.local/share/myspec/mediakeys/` e `storage/` no primeiro uso, derivados do nome do programa, no mesmo diretório que o app usa. Por isso a pasta pode existir com permissões mais abertas do que o app pediria antes de o app a criar.
