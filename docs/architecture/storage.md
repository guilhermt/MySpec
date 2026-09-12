# Armazenamento

Tudo que o app guarda fica em dois lugares, seguindo a especificação XDG: o diretório de dados para o estado e os artefatos, e o diretório de estado para o log. As worktrees são a exceção, porque vivem ao lado dos repositórios a que pertencem.

## Diretório de dados

`~/.local/share/myspec/`:

```
myspec.db                              o banco SQLite
prompts/<nome>.md                      só os prompts editados pelo usuário
sounds/chime.wav                       o som das notificações
workspaces/<nome>-<hash>/tasks/<task>/ os artefatos de cada task
```

### Banco

`myspec.db` guarda as configurações, as áreas de trabalho recentes, as tasks, as sessões e as entradas das conversas, as worktrees, as pull requests e as situações. É aberto com uma única conexão, WAL, `busy_timeout` de cinco segundos e foreign keys, e só o Go o acessa.

O schema é versionado por `PRAGMA user_version` e evolui por migrations em `internal/store/migrations/`, nomeadas `NNNN_nome.sql` com quatro dígitos, aplicadas em ordem, uma transação por arquivo, ao abrir o banco. Uma migration já aplicada nunca é editada: uma mudança de schema é sempre um arquivo novo. Os estados que a interface mostra são derivados; o banco guarda só o que não pode ser derivado, como ids de sessão, escolhas de modelo, resultados de encerramento e quando cada situação começou.

### Prompts

Os prompts padrão vivem no binário, em `internal/prompts/defaults/`. O diretório `prompts/` guarda apenas os que o usuário editou: `prd.md`, `tech_spec.md`, `plan.md`, `commit.md`, `pr.md` e `pr_review.md`. Um prompt sem arquivo segue o padrão da versão que roda, e um arquivo idêntico ao padrão é removido quando o app inicia, para que um prompt restaurado volte a acompanhar as versões novas. O prompt é lido quando uma sessão começa.

### Som

`sounds/chime.wav` é uma cópia do som embutido no binário, escrita ao iniciar quando falta ou difere, para que um servidor de notificações que toca sons a leia por caminho. Apagá-la é inofensivo: o app a escreve de novo na próxima vez que abrir.

### Artefatos

Cada área de trabalho tem uma pasta `<nome>-<hash>`, com o nome da pasta e oito caracteres hex do SHA-256 do caminho, para que duas áreas com o mesmo nome não se misturem. Dentro dela, uma pasta por task com:

```
PRD.md
tech-spec.md
steps/<número>-<descrição-curta>.md   um arquivo por step
pr/                                   a etapa de PR, por repositório
```

A etapa de PR escreve em `pr/` o rascunho da pull request de cada repositório e os relatórios de review, um por passada, nomeados `<slug>-review-<n>.md`. O slug é o caminho relativo do repositório com `__` no lugar das barras, ou `_root` para a própria área de trabalho. Os artefatos são o que as sessões leem por caminho e o que o painel de artefatos e o histórico mostram. Apagar uma task apaga a pasta.

## Worktrees

As worktrees vivem na própria área de trabalho, em `<área de trabalho>/.myspec/worktrees/<repositório>/<task>/`, com `_root` como nome do repositório quando ele é a própria área de trabalho, para que o código que o agente escreve fique ao lado do repositório de origem. A pasta `.myspec` é ignorada pelo scan de repositórios. O banco registra cada worktree antes de o `git worktree add` rodar, e o app só remove o que registrou.

## Log

`~/.local/state/myspec/myspec.log`, em JSON, uma linha por registro, com nível `info` por padrão. `MYSPEC_LOG_LEVEL` aceita `debug`, `warn` e `error`. O binário de desenvolvimento escreve também no stderr. O que cada linha significa está em [troubleshooting.md](../development/troubleshooting.md).

## O que o WebKitGTK cria

O webview cria `~/.local/share/myspec/mediakeys/` e `storage/` no primeiro uso, derivados do nome do programa, no mesmo diretório que o app usa. Por isso a pasta pode existir com permissões mais abertas do que o app pediria antes de o app a criar.
