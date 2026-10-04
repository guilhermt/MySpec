# Armazenamento

Tudo que o app guarda fica em dois lugares, seguindo a especificação XDG: o diretório de dados para o estado, os artefatos e as worktrees, e o diretório de estado para o log.

## Diretório de dados

`~/.local/share/myspec/`:

```
myspec.db                              o banco SQLite
prompts/<nome>.md                      só os prompts editados pelo usuário
sounds/chime.wav                       o som das notificações
tasks/<dono>/<nome>/<task>/            os artefatos de cada task
reviews/<dono>/<nome>/pr-<n>-<id>/     os artefatos de cada review de pull request
discussions/<dono do board>/<n>/<id>/  os artefatos de cada discussão
worktrees/<dono>/<nome>/<task>/        a worktree de cada task
worktrees/<dono>/<nome>/pr_<n>/        a worktree de cada review de pull request ativo
```

### Banco

`myspec.db` guarda as configurações (tema, padrões de modelo e de modo de review, filtro por repositório, pasta de clones em `clone_folder`, filtros da visão Reviews em `review_filters`, o último catálogo de modelos lido do Claude Code em `model_catalog`, em JSON), os boards cadastrados, com os status finais, o status com que os cards novos de uma discussão entram no board em `new_card_status`, as opções do campo Status como o usuário as salvou pela última vez em `saved_statuses`, em JSON (a edição do board as compara com a leitura nova para dizer o que sumiu e o que é novo), a última leitura bem-sucedida de cada um, em JSON, e a falha da última leitura, os repositórios cadastrados, com o board de cada um, um caminho vazio enquanto não têm clone e as instruções fixas de review, as tasks, com o modo, os modos de review e o card do board de que foram criadas, sem chave estrangeira para o board, para que a task guarde o card quando o board vai embora, os steps, com o ponto do review pelo agente, as pull requests das tasks, os reviews de pull request, com as passadas e os apontamentos, as discussões, com os cards de entrada, os rascunhos e as dependências deles, os itens, as sessões e as entradas das conversas, com a saída inteira de cada chamada de ferramenta, as worktrees e as situações. É aberto com uma única conexão, WAL, `busy_timeout` de cinco segundos e foreign keys, e só o Go o acessa.

O schema é versionado por `PRAGMA user_version` e evolui por migrations em `internal/store/migrations/`, nomeadas `NNNN_nome.sql` com quatro dígitos, aplicadas em ordem, uma transação por arquivo, ao abrir o banco. Uma migration já aplicada nunca é editada: uma mudança de schema é sempre um arquivo novo. Os estados que a interface mostra são derivados; o banco guarda só o que não pode ser derivado, como ids de sessão, o modo de cada task, escolhas de modelo e de modo de review, a passada que o review pelo agente pediu e a que ele tratou, a espera de uma passada pelos checks da pull request, `waiting_checks` em `pr_runs.status` no review da pull request de uma task e em `reviews.phase` no centro de review, o que o GitHub mostrou de errado na leitura que liberou a última passada e o que apareceu de novo desde então, em JSON em `trouble_baseline` e `trouble` de `pr_runs` e de `reviews`, para essa situação sobreviver ao reinício sem notificar de novo, os checks da última leitura da pull request de uma task, pelo nome, com o estado e as horas de cada um, em JSON em `pr_runs.checks`, vazio antes da primeira leitura, e se a branch faz merge limpo na base nessa leitura, em `pr_runs.mergeable` (`mergeable`, `conflicting` ou `unknown`, vazio antes da primeira leitura), para o painel da pull request não ficar vazio depois de reiniciar, quem fez o merge e quando, em `pr_runs.merged_by` e `pr_runs.merged_at`, vazios antes do merge e para um merge lido antes dessas colunas, resultados de encerramento, quando cada situação começou, quando cada sessão foi pausada, em `sessions.paused_at`, nulo enquanto ela não está pausada ou quando a hora da pausa é desconhecida, e a data de committer do commit de cada step, lida do git, em `steps.committed_at`, vazia enquanto o step não tem commit ou quando a data é desconhecida. A leitura das pull requests abertas não é guardada: ela é refeita em segundos ao abrir o app.

As entradas das conversas ficam em `transcript_entries`, uma linha por entrada, com o payload do tipo dela em JSON (os campos de cada tipo estão em [sessions.md](./sessions.md#o-que-o-transcript-guarda)). A saída inteira de uma chamada de ferramenta fica à parte, em `action_outputs`, uma linha por entrada com o texto, o número de linhas e se foi cortada, porque ela pode ter dezenas de KiB e só é lida quando o usuário a abre; o payload da ação leva só a cauda. `action_outputs` aponta para `transcript_entries` com `ON DELETE CASCADE`, então apagar uma entrada, uma sessão ou um item leva a saída junto. Uma migration que recria `transcript_entries` precisa recriar `action_outputs` também, ou a chave estrangeira aponta para a tabela antiga.

O review da pull request de uma task guarda as passadas **estruturadas** em `pr_passes`, uma linha por passada pedida com o formato estruturado: quando foi pedida, se um relatório legível foi gravado, se veio limpo, o resumo original, a revisão, que avança a cada releitura diferente, quando o relatório foi gravado pela primeira vez e quando os apontamentos aprovados foram ao agente (vazio antes). `pr_findings` guarda os apontamentos de cada uma, pelo número do relatório: o título (vazio sem um), o arquivo e a linha, vazios num apontamento geral, o texto original e o editado e a decisão, vazia, `approved` ou `discarded`. A existência da linha em `pr_passes` é o que torna uma passada estruturada: a passada sem linha é em texto: o relatório vale só pelo status e a decisão é uma resposta na conversa. A passada corrente é a de número mais alto. `pr_passes` aponta para `tasks` com `ON DELETE CASCADE`, `pr_findings` aponta para `pr_passes` do mesmo modo, e apagar o `pr_runs` de uma task apaga as passadas dela na mesma transação.

O History não tem consulta própria: os arquivados ficam em memória nos services de domínio, que os carregam na leitura do início, e a janela de 90 dias do estado, o resumo e as páginas do `HistoryService` são cortados dessas listas, já ordenadas do mais novo ao mais antigo. Não há índice nem tabela de apoio para isso. Cada página converte o History inteiro antes de cortar, e o custo é baixo: com 2.000 tasks arquivadas, uma página leva uns 3,5 ms e 2 MB.

### Itens

Uma task, um review de pull request e uma discussão são itens. A tabela `items` guarda o id e o tipo, `task`, `review` ou `discussion`, de cada um, e é o pai de `sessions`, `worktrees` e `situations`, pela coluna `item_id` com `ON DELETE CASCADE`. Triggers em `tasks`, em `reviews` e em `discussions` inserem e apagam a linha de `items` junto com a do item, então apagar um deles leva as sessões, as entradas das conversas, a worktree e as situações dele sem código próprio.

### Reviews de pull request

`reviews` guarda um review por linha: o repositório, o número, o título, o autor, o link e as branches da pull request, se ela é do próprio usuário, o modo, `publish` ou `apply`, a fase do ciclo de uma passada, que vale nos dois modos: `waiting_checks` enquanto a passada pedida espera os checks do head, e, só no modo aplicar, `applying` e `committing`, o card em JSON, a pasta de artefatos, a última passada pedida e a última gravada, o commit que ela cobriu, a última publicada e o head com que foi publicada, o último head e o estado que o GitHub informou, a falha da última publicação, o que os checks e o conflito mostravam de errado na leitura que liberou a última passada e o que apareceu de novo desde então, `trouble_baseline` e `trouble`, e, num review arquivado, quando foi, quem fez o merge da pull request e quando, e quando ela foi fechada, como o `gh` os lê quando o review termina (vazios num review arquivado antes de serem guardados). Um índice único parcial garante no máximo um review ativo por pull request. `review_passes` guarda cada passada: as instruções, se o relatório foi gravado, se veio limpo, o commit, o resumo original e o editado, a revisão, que avança a cada releitura diferente, no modo aplicar se as correções dos apontamentos aprovados subiram num commit do app, e, depois de publicada, o veredito, a data e o link, e se o resumo foi junto (`summary_published`; uma passada publicada antes dessa coluna a tem ligada quando tinha resumo com texto). Cada passada guarda também as horas em que o relatório foi gravado pela primeira vez e, no modo aplicar, em que os apontamentos aprovados foram ao agente, e o que a leitura que a liberou mostrava: os checks em JSON, se a branch fundia na base e quando a leitura foi feita, vazios numa passada ainda não enviada e numa enviada antes dessas colunas. Que as correções subiram é gravado quando o app vê o commit, e não deduzido depois do head da pull request, que também anda com commits que o app não fez. `review_findings` guarda os apontamentos de cada passada: o número do relatório, o título que o relatório escreve na linha do número (vazio sem um), o arquivo e a linha, vazios num apontamento geral, o texto original e o editado, a decisão, `approved` ou `discarded`, e onde foi publicado, `inline` ou `body`.

O relatório no disco é do agente e o produto nunca o reescreve; tudo o que é do usuário ou do produto sobre ele fica nessas tabelas. A passada pedida é gravada, porque uma passada pode esperar dias e reabrir o app não pode perdê-la.

### Discussões

`discussions` guarda uma discussão por linha: o board, sem chave estrangeira, e o título dele como estava na criação, para que a discussão sobreviva ao board e continue no histórico, o título, o texto que o usuário escreveu, o contexto inicial, a pasta de artefatos, se um artefato de rascunhos legível já foi gravado, a revisão da leitura dele, que avança a cada leitura que abre ou revisa uma rodada, e, numa discussão arquivada, quando foi. `discussion_cards` guarda os cards de entrada, em ordem, com repositório, número, título e link.

`discussion_drafts` guarda um rascunho por linha, pelo id que o artefato lhe dá, ou `user-epic-<n>` num épico criado pelo usuário: a posição, o tipo, `new`, `update` ou `epic`, a origem, `agent` ou `user`, o repositório da issue, o card que uma atualização reescreve, e, em pares, o que o artefato diz e o que o usuário deixou, para o título, o corpo, o módulo e o épico. Guarda ainda a decisão, `approved` ou `discarded`, a revisão, que avança a cada vez que o artefato muda aquele rascunho, a rodada, `round`, a leitura do artefato que o mudou por último dentro da rodada, `revised_reading`, e se uma leitura tirou a aprovação dele, `approval_cleared`, os avisos em JSON, a razão da última publicação que falhou, e o que foi publicado: o desfecho, `created` ou `updated`, o número, o link e o node id da issue, o item dela no board, se o status, o módulo e a issue pai já foram definidos, e quando a publicação terminou. `discussion_dependencies` guarda as dependências de cada rascunho, em ordem, cada uma um id de rascunho ou `dono/nome#número`, com se o artefato a nomeia ou o usuário a acrescentou, se o GitHub já tem a relação de bloqueio e por que ela foi deixada de lado, `discarded` ou `unavailable`, com o que o `gh` disse.

A rodada reúne os rascunhos de uma leitura do artefato e as revisões deles, e começa em 1. Quando todo rascunho da rodada atual está no GitHub ou descartado, a leitura seguinte que muda os rascunhos abre a rodada seguinte. Uma rodada fechada não muda nem perde rascunhos: os publicados e os descartados ficam mesmo que o artefato deixe de trazê-los, e só um id que o agente reusa com outro conteúdo, o que o usuário vê, é substituído, já na rodada nova. `revised_reading` guarda o número da leitura, e não um booleano, então o rascunho está revisado quando ele é igual à revisão atual da discussão; uma leitura que só reescreve rascunhos como o usuário já os vê, sem mudar nada para ele, não avança a revisão.

O artefato no disco é do agente e o produto nunca o reescreve; tudo o que é do usuário ou do produto sobre ele fica nessas tabelas. Os passos de uma publicação são gravados um a um, porque é assim que **Retry** continua de onde parou sem criar nada duas vezes.

### Prompts

Os prompts padrão vivem no binário, em `internal/prompts/defaults/`. O diretório `prompts/` guarda apenas os que o usuário editou: `prd.md`, `tech_spec.md`, `plan.md`, `one_shot.md`, `step_review.md`, `commit.md`, `pr.md`, `pr_review.md` e `discussion.md`. Um prompt sem arquivo segue o padrão da versão que roda, e um arquivo idêntico ao padrão é removido quando o app inicia, para que um prompt restaurado volte a acompanhar as versões novas. O prompt é lido quando uma sessão começa. A hora de uma edição é a do arquivo (`EditedAt`), e a lista de prompts das configurações sai só dessas horas, sem ler nenhum texto (`prompts.List`). Cada prompt informa quantas linhas tem o texto e quantas tem o padrão, sem contar a quebra de linha final.

### Som

`sounds/chime.wav` é uma cópia do som embutido no binário, escrita ao iniciar quando falta ou difere, para que um servidor de notificações que toca sons a leia por caminho. Apagá-la é inofensivo: o app a escreve de novo na próxima vez que abrir.

### Migração dos dados

A migration 0012 é a que cadastra os repositórios, e é na transação dela que roda o `store.Upgrade` que o app injeta, o pacote `internal/upgrade`. Ele lê cada task de um banco que ainda guarda áreas de trabalho, identifica o clone dela pelo remote `origin`, cadastra um repositório por identidade, liga a task a ele, move os artefatos para a pasta nova e renomeia os arquivos da etapa de PR, que já não carregam o slug de um repositório. Uma task arquivada da raiz de uma área de trabalho é descartada, artefatos incluídos.

O upgrade roda dentro do início do app (ver [overview.md](./overview.md#composição-e-injeção)), com o prazo de um minuto para abrir o banco, porque ele move arquivos. Antes dele, uma sonda do diretório de dados (listar, criar, escrever e apagar um arquivo) separa a falta de permissão e o disco cheio, que o SQLite não distingue ao abrir uma pasta, de qualquer outra falha.

O upgrade é tudo ou nada. Ele recusa, sem escrever nada, quando encontra uma task ativa na raiz de uma área de trabalho, um clone que ele não consegue identificar no GitHub ou duas tasks com o mesmo nome num repositório. Uma recusa desfaz o que já tinha sido movido no disco, a transação não commita, o banco fica na versão anterior — que a versão anterior do app abre inteira — e o app abre a janela e termina o início `ready` só com o estado da migração recusada, que mostra os casos a resolver no lugar do produto. Com o commit feito, as pastas descartadas e a pasta `workspaces/` são apagadas.

Um banco de uma versão mais nova é recusado antes de qualquer escrita: quando o `user_version` passa da última migration embutida, `migrate` devolve um `*store.NewerError` com as duas versões, `open` fecha o banco, e o início do app liga só o estado `bindings.NewerState` (`Migration.Newer` com `dataVersion` e `appVersion`, sem casos), que mostra a tela da migração recusada com o título da versão mais nova. O app nunca lê nem escreve num banco que uma versão que ele não conhece mudou.

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

A etapa de PR escreve em `pr/` o rascunho da pull request da task, `draft.md`, e os relatórios de review dela, um por passada, nomeados `review-<n>.md`. Os artefatos são o que as sessões leem por caminho e o que os painéis **Details** e **Artifacts** da task e o histórico mostram. Apagar uma task apaga a pasta.

### Artefatos de um review

Os artefatos de um review de pull request ficam em `reviews/<dono>/<nome>/pr-<número>-<id>/`, com os oito primeiros caracteres do id do review, para que um review novo da mesma pull request, depois de um apagado ou arquivado, tenha a sua pasta. A pasta é criada com `0700` e guarda:

```
context.md          o documento de contexto, reescrito pelo app a cada leitura da pull request que abre uma passada
review-<n>.md       o relatório de cada passada, escrito pelo agente
```

O relatório abre com um cabeçalho `---` com `status`, `clean` ou `changes`, e `pass`, que, quando presente, tem de ser o do nome do arquivo. O corpo é o resumo até uma linha `## Findings`; depois dela, cada apontamento começa numa linha `### <n> · <título>`, em que o título é o resto da linha depois do número, com ou sem um separador (`·`, `.`, `:`, `-`, `–`, `—`) e sem o par de `**` que o envolva, e pode faltar, com números únicos e positivos, seguida de uma linha `Location: <caminho>:<linha>`, com o caminho relativo à raiz do repositório e a linha maior que zero, ou `Location: general`, e do texto, que não pode ser vazio. Um relatório `clean` não tem apontamentos, e um `changes` tem ao menos um. Qualquer desvio torna o relatório ilegível, e a passada fica sem relatório; o review mostra então a regra quebrada, sem o caminho do arquivo. Uma releitura que muda só os títulos grava os títulos, sem contar como revisão. O arquivo é lido a cada avaliação do review, sem watcher. A pasta sobrevive ao arquivamento, para o histórico, e vai embora quando o review é apagado.

### Artefatos de uma discussão

Os artefatos de uma discussão ficam em `discussions/<dono do board>/<número do board>/<id>/`, com os oito primeiros caracteres do id da discussão, para que duas discussões do mesmo board tenham cada uma a sua pasta. A pasta é criada com `0700` e guarda:

```
context.md          o contexto inicial, escrito pelo app quando a discussão nasce
discussion.md       o documento do entendimento, escrito pelo agente
drafts.md           os rascunhos de card, escritos pelo agente
```

A sessão da discussão roda nessa pasta, e é por isso que o agente escreve os dois documentos sem pedir permissão. O documento não tem formato exigido: o app só percebe, pela data e pelo tamanho do arquivo, que ele existe e que mudou, e o painel o mostra renderizado. `drafts.md` abre com um cabeçalho `---` com `status`, `drafts` ou `none`, e tem um bloco por rascunho, aberto por `## Draft: <id>`, com as linhas `Kind`, `Repository` ou `Card`, `Module`, `Epic` e `Depends on`, e as seções `### Title` e `### Body`, que vai até o próximo bloco. Qualquer desvio torna o arquivo ilegível, e a discussão diz a razão ao usuário. O arquivo é lido a cada vez que a conversa fica ociosa, sem watcher. A pasta sobrevive ao arquivamento, para o histórico, e vai embora quando a discussão é apagada.

## Clones

Os clones que o app faz ficam na pasta de clones que o usuário escolheu, em `<pasta de clones>/<nome>`, nunca no diretório de dados. A partir daí são clones como os outros: o app não os apaga nem os move.

## Worktrees

As worktrees vivem no diretório de dados, em `~/.local/share/myspec/worktrees/<dono>/<nome>/<task>/`, uma por task, longe dos clones que o usuário mantém. A de um review de pull request fica em `worktrees/<dono>/<nome>/pr_<número>/`, em detached HEAD em `origin/<branch da pull request>`, sem branch local: uma branch local com o nome da branch da pull request falharia quando o usuário a tem em checkout no clone. Cada nova passada busca o remote e move a worktree para o head atual; ela é removida quando o review termina ou é apagado. O banco registra cada worktree antes de o `git worktree add` rodar, e o app só remove o que registrou.

O registro guarda o caminho da worktree e o clone em que o git roda para ela, que é o clone atual do repositório: trocar o caminho do repositório leva junto o das worktrees das suas tasks e dos seus reviews, porque é lá que a branch vive. Uma worktree registrada em outro caminho continua sendo usada onde está e é removida de lá; o app nunca move uma worktree.

## Log

`~/.local/state/myspec/myspec.log`, em JSON, uma linha por registro, com nível `info` por padrão. `MYSPEC_LOG_LEVEL` aceita `debug`, `warn` e `error`. O binário de desenvolvimento escreve também no stderr. O que cada linha significa está em [troubleshooting.md](../development/troubleshooting.md).

## O que o WebKitGTK cria

O webview cria `~/.local/share/myspec/mediakeys/` e `storage/` no primeiro uso, derivados do nome do programa, no mesmo diretório que o app usa. Por isso a pasta pode existir com permissões mais abertas do que o app pediria antes de o app a criar.
