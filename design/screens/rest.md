# Settings, History, início, avisos, diálogos e notificações

Fase 4, decidido em 2026-09-25. Referência visual:

- `lab/14-screen-rest/index.html`: as 18 cenas, por `?scene=`, com as variações de cada uma por `?v=`;
- `lab/14-screen-rest/components.html`: cada componente novo em todos os estados, nos dois modos.

São as telas de apoio da jornada J8 (`brief.md` §4), raras no uso: cadastro, configuração, consulta do histórico. Entram também as que atravessam o produto: o início do app, as boas-vindas, a migração, o aviso do app, a página do item que saiu, os diálogos destrutivos da task, a pausa e as notificações do sistema.

Elas seguem `structure.md` (o shell, a árvore, a largura contínua), `principles.md` e `system/`, e reaproveitam as quatro telas decididas:

- de `screens/board.md`: a linha de lista, o cabeçalho de seção, a faixa de falha de leitura, as linhas de bloqueio da Home, o diálogo largo;
- de `screens/review.md`: a página do item que saiu, a nota afundada, o diálogo mínimo;
- de `screens/task.md`: o marco em linha, o menu `⋯`, o popover **Review mode** e o chip de modelo.

Onde este documento e `structure.md` §4 e §7 divergem, vale este documento. As mudanças estão na seção 14.

## 1. A régua

As telas são mínimas, como as outras quatro (`decisions.md`, 2026-09-24). Cada elemento justifica por que existe, ou sai.

- **Settings é raro, e o que muda é Defaults.** No uso real, 6 de 9 modelos foram mudados. Ninguém editou prompt nem instrução de review, e a pasta de clones nunca foi escolhida. Por isso Settings abre em Defaults, e o que é raro fica atrás de uma lista ou de um `⋯`.
- **History é quase nunca aberto** (`research/interview.md`). Ele é uma lista só, por data, sem trabalho além do necessário.
- **O que bloqueia vem primeiro.** Um repositório sem clone encabeça Repositories.
- **O que é destruído é dito antes.** Toda confirmação destrutiva diz exatamente o que se perde e o que fica, e abre com o foco em **Cancel**.
- **Todo texto de erro é uma falha que pode acontecer.** O produto roda uma instância só: nenhum texto fala de "outro MySpec".

## 2. Settings

### 2.1 O lugar e a navegação

Settings é um lugar da área principal (`structure.md` §1). Ele abre pelo botão **Settings** do rodapé da lateral e por `Ctrl+,`. O botão do rodapé fica pressionado enquanto Settings está aberto: véu `--brand-tint-plane`, anel `--brand-marker-ring` e `aria-current="page"`.

**O cabeçalho** é o de um lugar que não é item:

- `←`, com o destino no tooltip;
- o título `Settings`;
- à direita, **Close** com a tecla `Esc`.

Fechar (**Close**, `Esc`, `Ctrl+,` de novo) volta ao lugar anterior, nunca à Home.

**Settings abre em Defaults.** Um link de fora abre a página dele: **Edit the board in Settings…**, do `⋯` do board, abre Boards. Aberto por `Ctrl+,` ou por um link, o foco vai ao item da página na navegação; pelo clique no rodapé, fica no botão.

**A navegação** fica à esquerda, com a largura `--snav-w` (13rem), e tem quatro itens: **Defaults**, **Boards**, **Repositories** e **Prompts**. Cada item tem o ícone e o nome.

- O aberto é o lugar aberto: véu `--brand-tint-plane`, anel `--brand-ring`, ícone em `--brand-ink`, peso 500 e `aria-current="page"`.
- **Repositories** leva `◇ N` à direita quando algum clone está inexistente, com N o número deles (um repositório sem clone não conta) e o motivo no tooltip e na descrição acessível: `The clone of acme/infra is missing`, `The clones of 2 repositories are missing: acme/infra, acme/tools`.
- A navegação é uma parada de Tab. `↑` e `↓` trocam de página, `Home` e `End` vão às pontas; com a navegação em linha, `←` e `→` também.
- A navegação fica fixa ao rolar a página.

O par navegação e página fica centrado em pixel inteiro, com `--space-12` entre os dois e a página na medida `--measure` (800 px; a largura máxima da caixa inclui as folgas dos lados). Abaixo de 820 px de área principal (janela abaixo de cerca de 1100 px), a navegação vira uma linha acima da página. Na metade do monitor, ela fica à esquerda, e a página tem 674 px. Abaixo de 720 px de área principal, as ações da direita de uma linha de Settings descem para baixo do texto.

Não há página de aparência. O tema fica só no botão do rodapé da lateral (System, Light, Dark, em ciclo).

**A página** tem um cabeçalho com:

- o título em `--text-title` e peso 600;
- uma frase em `--ink-3` que diz para que ela serve;
- à direita, a ação da página quando há: **Add board** ou **Add repository**, secundárias. Settings não pede nada ao usuário, então não tem primária.

As seções da página têm o título em caixa alta de `--text-caps` e, ao lado, uma frase em `--text-meta`.

### 2.2 Defaults

Título `Defaults`, com a frase `What a new task, review or discussion starts with. A change applies to what you create after it; nothing that runs changes.` Tudo salva na hora, sem **Save**.

**Review mode** (`Who reviews the steps of a new task`). As duas opções do popover da task (`screens/task.md` §10) ficam lado a lado, num `radiogroup`, cada uma com o ícone, o nome e o que faz:

- `Agent`: `An agent reviews each step with the implementer; clean steps are committed.`
- `Manual`: `You review each step in VS Code, stage the files and approve.`

A escolhida tem véu `--brand-tint` e anel `--brand-ring`. Ao escolher, a opção mostra o spinner e `· saving…`. Uma falha ao salvar volta à escolha salva e aparece sob as opções, em vermelho, com **Try again**, como na linha do modelo: `Couldn't save Manual: <mensagem>`. Abaixo de 820 px de área principal, as duas opções ficam uma sobre a outra.

**Models.** Ao lado do título da seção vem `6 of 9 changed from the factory defaults`. As etapas ficam em grupos contornados por `--line-1`, uma linha por etapa:

| Grupo | Etapas |
|---|---|
| Planning | PRD, Tech spec, Plan, One-Shot planning |
| Steps | Implementation, Step review |
| Pull request | PR, PR review, com `Also where a review of someone's pull request starts` |
| (sem título: o grupo tem uma etapa só) | Discussion, com `Where a new discussion starts` |

Cada linha tem o nome da etapa à esquerda e o chip de modelo e esforço à direita (`Opus 5.5 (1M) · xhigh ▾`, `--size-control-sm`).

- **Escolha própria:** o chip mudado da fábrica fica em `--ink-1`, peso 500, borda `--line-3`, e diz o padrão de fábrica no tooltip (`Factory default: Fable 5.1 · high`).
- **Escolha de fábrica:** fica quieta, em `--ink-2`, com `The factory default` no tooltip.
- O nome acessível diz tudo: `PRD: Opus 5.5 (1M) · xhigh, changed from the factory default Fable 5.1 · high`; indisponível, `Step review: Opus 4.1 · high, unavailable, changed from the factory default Opus 5.5 (1M) · high`.

**O menu do chip** tem dois grupos de `menuitemradio`, uma escolha em cada:

- `Model`, os modelos do catálogo, na ordem do CLI;
- `Effort · <modelo>`, os esforços do modelo escolhido.

O modelo de fábrica tem a marca `factory` à direita, e o esforço de fábrica a tem só quando o modelo escolhido é o de fábrica. No pé do menu vem `From the Claude Code installed here, read when MySpec opened.` Um modelo sem esforço (`Haiku 4.5`) não tem o grupo de esforço, e o menu diz `Haiku 4.5 has no effort levels.` A marca `factory` e o pé são só de Defaults, onde a fábrica é a referência; o título `Effort · <modelo>`, a razão de indisponível e o menu que espera o catálogo valem em todo seletor de modelo do produto.

**Estados da linha:**

| Estado | O que aparece |
|---|---|
| Salvando | O chip com o spinner e `Saving…` |
| Falha ao salvar | O chip volta ao valor anterior. Sob a linha, em vermelho: `Couldn't save Opus 5.5 (1M) · high: ` e a mensagem, com **Try again**. Com o disco cheio, a mensagem é `no space left on the disk of ~/.local/share/myspec. Free some space, then try again.` |
| Indisponível | `◇ Opus 4.1 · high · unavailable`. O tooltip diz `The installed Claude Code no longer lists Opus 4.1. A session still starts with it, and the CLI decides.`, ou, com o modelo listado e o esforço não, `The installed Claude Code doesn't offer max for Haiku 4.5. A session still starts with it, and the CLI decides.` O produto nunca troca a escolha |
| Lendo o catálogo | A escolha salva continua à vista, no chip, com o **brilho** de leitura (`principles.md` §8) e sem spinner. Ao lado do título da seção vem `Reading the models of Claude Code…`, com brilho, no lugar da contagem. Só o menu espera a leitura: ele não abre, e o tooltip diz `Reading the models of Claude Code · the menu opens when it ends` |
| Nenhuma leitura deu certo | A faixa afundada, nunca vermelha, por causa: `◇ Claude Code was not found` · `Install it or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. The choices below stay as they are.`; `◇ The installed Claude Code doesn't list its models` · `Update it, then reopen MySpec. The choices below stay as they are.`; `◇ Couldn't read the models of Claude Code` · `Reopen MySpec to try again. The choices below stay as they are.` Os chips mostram as escolhas salvas, e o menu diz por quê, no lugar das opções, com os textos de `features.md` (Modelos e esforço) |

No pé da seção: `A commit runs in the session of its step or of its pull request review, with that session's model and effort.`

### 2.3 Boards

Título `Boards`, com a frase `The GitHub projects your tasks start from, each with the repositories it manages.` e **Add board**. Os boards ficam numa lista contornada, em ordem alfabética de título. Cada linha tem:

- o ícone do board;
- o título, peso 500, e o projeto no GitHub como link (`acme/projects/7 ↗`, com a URL no tooltip);
- `Organization · 6 repositories: api, billing, docs, gateway, sdk-js, web` (`No repositories` sem nenhum; `dono/nome` em todos quando algum não é do dono do board, para dois nomes curtos iguais não se confundirem);
- `Final: Done, Won't do, Duplicate · New cards: None` (`Final: None` sem final); num board sem campo `Status`, `No Status field: its cards end when their issues close`;
- à direita, a idade da leitura, a mesma do cabeçalho do board (`Read 2m ago`, `Read 1d ago`, `Not read yet`, `Reading…`, com a hora no tooltip), **Edit…** secundário e **Remove…** fantasma.

**Sem board**, a página diz `No boards yet` / `Add a board to start tasks from the cards of a GitHub project.`, com **Add board**, secundário, sob o texto: a ação do vazio é a saída dele, mesmo com o cabeçalho a tendo.

**A falha de leitura** segue `screens/board.md` §3.8: nunca é vermelha, nunca é situação. A idade vira `◇ Read failed 18m ago`. Sob a linha entra uma faixa afundada com `◇`, a mensagem de `features.md` (Falhas), `The last reading stays in use.` e **Try again**. Relendo, a idade diz `Reading…` com o spinner, e **Try again** dá lugar a `Reading…` com o spinner, como toda faixa de aviso tentando. A idade é o componente do cabeçalho do board, com as formas `Not read yet` e `◇ Read failed 18m ago`, que ele não mostra.

### 2.4 O diálogo de board

É o diálogo largo (`--size-dialog-wide`), a `8vh` do topo. O título é **Add board** ou **Edit board**, e o subtítulo diz o board e o passo: `Data Platform · acme · Step 2 of 3 · Statuses`; o primeiro passo do Add, sem board ainda, `Step 1 of 3 · The project`; um diálogo de um passo só não diz `Step 1 of 1`. No rodapé ficam, da esquerda para a direita:

- **Back**, fantasma com a seta, a partir do segundo passo, que volta ao passo anterior do mesmo diálogo;
- o que falta ou o que a confirmação faz, em `--text-meta`, ou a recusa em vermelho numa linha própria acima dos botões;
- **Cancel**;
- o primário, com `Ctrl ↵`.

O foco começa no primeiro campo do passo, também depois de **Back** e **Continue**. **Back** guarda o que foi escolhido nos passos seguintes; o passo 1 com a mesma URL não relê, e uma URL mudada relê e recomeça as escolhas. Cada abertura relê o board. Confirmando, o primário diz `Adding…` ou `Saving…`, e **Cancel** e **Back** ficam tracejados.

**Add board, em três passos:**

1. **The project** (`Step 1 of 3 · The project`).
   - O campo `URL of the GitHub project`, em mono, com a ajuda `github.com/orgs/<org>/projects/<n> or github.com/users/<user>/projects/<n>. Views and filters in the URL are fine.`
   - **Continue**, e `Enter` lê.
   - **Lendo:** o campo fica desabilitado, o rodapé diz `Reading the board…`, e **Continue** diz `Reading…` com o spinner.
   - **Recusa:** o campo fica com a borda e o trilho de erro, e a mensagem vai sob ele, em vermelho, com o que fazer. As mensagens são `This isn't the URL of a GitHub project.`, `<título> is already registered.` e as de `features.md` (Falhas). Um exemplo: `The board doesn't exist or this account can't read it. Check the number and that this account can see the project.` O usuário corrige e lê de novo.
2. **Statuses** (`Step 2 of 3`).
   - `Mark the statuses that end the work on a card, and the status a card published by a discussion starts in.`
   - Uma tabela só, com as opções na ordem do board e duas colunas: `Ends the work` (caixa de seleção) e `New cards` (rádio). A última linha é `No status`, só com o rádio.
   - A pré-marcação é a de `features.md` (Cadastrar um board), com a ajuda que nomeia o que foi marcado: `Done and To do are marked for you, from their names.` (`Done is marked for you, from its name.`; sem nenhum, sem ajuda).
   - **Continue**.
3. **Repositories** (`Step 3 of 3`).
   - `Check the repositories this board manages. They come from the issues on the board.`
   - Uma linha por repositório, marcada, com o nome em peso 500, `N cards` e, à direita, como ele fica ligado: `Registered · <caminho>`, `Registered · Not cloned`, `Registered · the clone at <caminho> is missing`, `Clone found · <caminho>`, `Clone found · 2 clones:` seguido do seletor com o clone escolhido, na mesma linha, ou `Registered without a clone`.
   - O repositório de outro board fica desabilitado, com a caixa tracejada e `acme/api belongs to the board Platform Roadmap.`
   - O campo `owner/name` com **Add** acrescenta um repositório, com as recusas de `features.md`.
   - **Add board**.

**Um board sem campo `Status`** pula o segundo passo e conta um a menos: `Release Train · acme · Step 2 of 2 · Repositories`. O passo dos repositórios abre com a nota afundada `◇ This board has no Status field, so there are no statuses to mark: its cards end when their issues close.`

**Edit board, em dois passos.** Ele abre relendo o board, com `Reading the board…` e só **Cancel**. Uma falha da releitura aparece no corpo, em vermelho, e o rodapé ganha **Try again**, primário, que relê.

1. **Statuses** (`Platform Roadmap · acme · Step 1 of 2 · Statuses`). Os finais vêm como guardados. Quando o board mudou desde o último cadastro ou edição, entra no alto a nota afundada `◇ The board changed since it was saved. Archived is gone from its statuses, and QA is new, not marked.`: as opções que sumiram (`Archived and Blocked are gone…`) e as novas (`QA and Staging are new…`), cada parte só quando existe, e ` New cards now start with no status.` quando o status de cards novos sumiu. A opção nova tem a etiqueta `new`, desmarcada. O status de cards novos volta a `No status` quando a opção sumiu.
2. **Repositories** (`Step 2 of 2`). Os do board vêm marcados, e os outros repositórios das issues, desmarcados. **Save**.

**Desmarcar um repositório do board diz a consequência na linha dele.** A linha fica afundada, e embaixo vem, com a seta:

- `Moves to No board: it has ` e o que ele tem, na ordem `a clone`, `N active tasks`, `N archived tasks`, `N reviews`, só as partes que existem, e depois `. Its tasks keep working.` com tasks, `. Its reviews keep working.` só com reviews, ou `. Nothing on disk changes.` só com o clone (`Moves to No board: it has a clone. Nothing on disk changes.`, `Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working.`);
- `Leaves MySpec: it has no clone, tasks or reviews.`

O rodapé soma, ao lado de **Save**: `acme/docs moves to No board, and acme/billing leaves MySpec.` (`acme/docs and acme/web move to No board.`; um destino só, sem o `, and`). Um erro ao salvar aparece no rodapé, em vermelho, e o diálogo fica aberto.

### 2.5 Remove board

É o diálogo mínimo de confirmação (`alertdialog`), com o foco em **Cancel**:

- título `Remove Platform Roadmap?`;
- corpo com o texto de `features.md`: `5 repositories move to No board and 1 leaves MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.`, sem a parte que dá zero (`1 repository moves to No board.`; num board sem repositório, `The board has no repositories.`);
- uma linha afundada com os nomes por destino, cada um só quando tem algum: `To No board: api, docs, gateway, sdk-js, web` e `Leaves MySpec: billing, with no clone, tasks or reviews`;
- **Cancel** e **Remove board**, perigoso.

Enquanto a prévia é lida, o corpo diz `The board leaves MySpec.`, sem a linha afundada, e **Remove board** fica habilitado; uma prévia que falha deixa esse corpo com a linha apagada `Couldn't tell what happens to its repositories: <mensagem>`, e remover continua possível. Removendo, `Removing…` e **Cancel** tracejado; um erro fica no rodapé, e o diálogo aberto.

### 2.6 Repositories

Título `Repositories`, com a frase `The repositories your tasks belong to, each tied to its local clone.` e **Add repository**.

**O que bloqueia vem primeiro.** A página abre com o grupo **Needs a clone** (`3 · Their cards can't start a task until they have one`). O grupo tem, nesta ordem, os repositórios sem clone e os de clone inexistente, e a segunda linha de cada um diz o board (`Platform Roadmap · Not cloned`, `No board · ~/code/infra`). Depois vêm os grupos dos boards, em ordem alfabética de título, e por último **No board**. Cada grupo tem o título em `--text-meta` e peso 600, a contagem em `--ink-4` e a lista contornada. Um grupo vazio não aparece.

**A linha** tem:

- o nome `dono/nome`, peso 500;
- o caminho em mono, ou `Not cloned`;
- à direita, as contagens em `--ink-3` (`4 active · 7 archived · 1 review`, ou `No tasks or reviews`);
- **`⋯`**.

Com as instruções de review definidas, a segunda linha diz `· Review instructions set`. Abaixo de 820 px de área principal, as contagens descem para a segunda linha.

**As linhas de bloqueio** ficam sob o dono, afundadas, com as mesmas palavras e ações da Home (`screens/board.md` §2.2):

| Caso | Linha | Ação |
|---|---|---|
| Sem clone | `◇ Its cards can't start a task until it's cloned.` | **Clone** |
| Clonando | O spinner e `Cloning into ~/code/android…` | — |
| O clone falhou | A mensagem do `gh`, em vermelho | **Try again** |
| Clone inexistente | `◇ The clone is missing. Its tasks can't start a step or close until it has one.` | **Change path…** |
| **Change path** recusado | Em vermelho, sob a linha: `~/code/infra-old is a clone of acme/terraform, not of acme/infra.` | — |

**O `⋯`** tem:

- **Change path…**, que abre direto o seletor de pastas nativo (`Change the path of <dono/nome>`);
- **Review instructions…**, com `None` ou `Set`;
- depois de um separador, **Remove…**.

**Remove…** fica desabilitado em `--ink-4`, nunca em vermelho, com o motivo abaixo dele no menu: as tasks ativas, as arquivadas e os reviews que ele tem, só os que existem, e `: delete them first.` (`8 archived tasks and 4 reviews: delete them first.`). Num repositório clonando, **Change path…** e **Remove…** ficam desabilitados, com `Cloning…` como razão.

**Review instructions** abre sob a linha um bloco afundado com:

- o rótulo `Review instructions`;
- a área de texto em mono, de 5 linhas;
- a ajuda `Added to every pull request review of acme/web, the reviews of task pull requests included. A change applies from the next pass.`;
- **Cancel** e **Save**, secundário, tracejado sem mudança. Settings não tem primária, e mais de um bloco pode ficar aberto. `Esc` no bloco cancela, sem fechar Settings, e o foco volta ao `⋯`.

**Clone folder** fica no pé da página: `Where Clone puts a repository that isn't on this machine`, com o valor (`Not chosen · you're asked the first time you clone`, ou o caminho em mono) e **Choose…**. Uma falha de **Choose…** fica sob a linha, em vermelho.

**Vazio.** Sem repositório, a página diz `No repositories yet` / `Add a clone from this machine, or add a board: the repositories of its issues come with it.`, com as duas saídas que o texto oferece: **Add repository**, secundário, e **Go to Boards**, fantasma. O `◇` da navegação some.

### 2.7 Add repository

É o diálogo largo, com o foco no filtro. O título é `Add repository`, e o subtítulo diz `Pick the clones to register. The scan looks through your home folder, up to 6 folders deep.` Cada abertura varre de novo.

| Momento | O que aparece |
|---|---|
| Varrendo | `Scanning your home folder…` com o spinner (`role="status"`). **Add repository** fica tracejado, com `Wait for the scan to end.` ao lado |
| Lista | O filtro `Filter by name or path`. Primeiro os clones disponíveis, em ordem alfabética, cada um com a caixa, `dono/nome` e o caminho em mono. O clone de um repositório registrado sem clone diz `Registered without a clone: this links the clone to it.` Os já registrados ficam dobrados no fim, em `Already registered 9`, desabilitados |
| A varredura falhou | `Couldn't scan your home folder: <mensagem>` em vermelho, com **Try again**, que varre de novo; **Browse…** continua valendo |
| Nada achado | `No GitHub clones were found in your home folder, up to 6 folders deep.` |
| Filtro sem resultado | `No repositories match.` |
| Confirmar | **Add 2 repositories** cadastra um por vez; **Cancel** e **Browse…** ficam tracejados até o último. Se todos passam, o diálogo fecha. Uma recusa fica sob a linha, em vermelho, com a linha ainda marcada; os que passaram viram registrados |
| **Browse…** | À esquerda do rodapé. Abre o seletor nativo. A recusa vai em vermelho, numa linha própria acima dos botões: `~/Downloads/site is not the root of a git repository.` |

### 2.8 Remove repository

É o diálogo mínimo, com o foco em **Cancel**:

- `Remove acme/docs?`;
- `The repository leaves MySpec and the board Platform Roadmap. Nothing is deleted on disk: the clone stays at ~/code/docs.`;
- a linha apagada `A reading of the board suggests it again while its issues are there.`;
- **Cancel** e **Remove repository**, perigoso.

Sem board, o corpo não cita o board, nem a linha apagada; sem clone, `Nothing is deleted on disk.` O diálogo fica aberto até o fim, com `Removing…`, e um erro fica no rodapé.

### 2.9 Prompts

**A lista.** Título `Prompts`, com a frase `The instructions each session starts with. A prompt you never edit follows the default of every new version of MySpec.` Os nove prompts ficam numa lista contornada, na ordem do workflow. Cada linha é um link com o ícone, o nome (peso 500), a descrição de `research/rest.md` §1.5 e, à direita, `Default` em `--ink-4` ou a etiqueta `Edited Sep 20` (`Edited today`, `Edited yesterday`, `Edited Sep 20, 2025` de outro ano, com a hora inteira no tooltip), com a seta. A linha tem hover, foco e pressionado. Uma falha ao ler quais estão editados deixa a coluna da direita vazia, com `Couldn't read which prompts are edited: <mensagem>` e **Try again** sob a lista; cada prompt continua abrindo.

**O prompt.** No alto fica **← Prompts**. O cabeçalho tem:

- o nome e a etiqueta `Edited Sep 20`;
- a descrição e `Your version has 92 lines; the default of this version has 87.`;
- **Edit** (secundário) e **Reset to default…** (fantasma), que só aparece num prompt editado.

O texto vem renderizado num bloco contornado, com os placeholders como etiqueta mono (`{{prd_path}}`, com `Filled when the session starts` no tooltip). No pé: `MySpec fills the placeholders when a session starts. A session that is running keeps the prompt it started with.`

- **Lendo:** o esqueleto de três linhas.
- **A leitura falhou:** a faixa local `Couldn't read the PRD prompt`, com a mensagem e **Try again**, porque a página não tem mais nada a mostrar.

Lendo ou com a falha, **Edit** e **Reset to default…** ficam tracejados, com a razão.

Um prompt nunca editado não tem etiqueta nem a frase das linhas.

**A edição.** No alto fica **← PRD**. Título `Editing the PRD prompt`, com `Markdown. The placeholders are filled when a session starts.` A área de texto em mono ocupa a coluna, e à direita fica a coluna **Placeholders** (`The ones the default uses. Move or remove any of them.`). Cada placeholder aparece como etiqueta, com o que ele vira e, nos três casos em que se aplica, o que acontece sem ele (`Without it, the initial context is added at the end.`). Abaixo de 820 px, a coluna desce para baixo do editor.

A barra fixa no pé tem `Unsaved changes`, **Cancel** e **Save** `Ctrl S`, a primária. Salvar um texto igual ao padrão apaga a edição.

**Reset to default…** abre o diálogo mínimo:

- `Reset the PRD prompt to the default?`;
- `Your edits are replaced by the default of this version, and the prompt follows the default of new versions again.`;
- a linha apagada `A session that is running keeps the prompt it started with.`;
- **Cancel** e **Reset prompt**, perigoso.

**Sair com edição não salva** (outra página, fechar Settings, abrir um item, uma notificação) pede confirmação:

- `Discard your changes?`;
- `The edits to the PRD prompt haven't been saved.`;
- **Keep editing** e **Discard**, perigoso.

## 3. History

**O lugar.** History abre pelo botão **History** do rodapé, com a contagem de tasks, reviews e discussões arquivados (`History 44`). O tooltip diz `44 archived: 22 tasks, 12 reviews, 10 discussions`. O botão fica pressionado enquanto History ou um arquivado está aberto. O cabeçalho é o de um lugar que não é item: `←` e o título `History`.

**Uma organização só.** A lista vem por data de arquivamento, da mais recente para a mais antiga, na coluna do board (`--list-measure`, centrada em pixel inteiro). Os dias são as seções: `Today`, `Yesterday`, `Monday, Sep 22`, com a contagem ao lado. O cabeçalho do dia é estático, sem chevron.

**A barra fixa no alto** tem:

- a busca `Search by name, title or #number`, com `/`; ela casa com o nome da task, com o título do review, com o título da discussão e, com `#N`, com o número da PR de uma task ou de um review e com o número do card de uma task;
- à direita, `44 archived · Sep 12 – today`.

O foco começa na busca.

**O filtro por repositório é o da lateral.** Ele vale no History, sem filtro próprio. Quando está ativo, a barra mostra o chip `Only acme/web`, com o `×` como botão (`Show all repositories`), que limpa o filtro da lateral também. A contagem passa a `12 of 44`. Uma discussão passa quando um card de entrada ou publicado dela é do repositório.

**A linha** segue a linha de lista do board, com as colunas de largura fixa:

| Coluna | Largura | Conteúdo |
|---|---|---|
| Tipo | `--icon` | O glifo: task, One-Shot, review, discussão |
| Nome | o resto | O nome da task, o título da PR ou o da discussão |
| Onde | `--col-where` | `api#398` (repositório e card), `web#2291` (a PR), `api` (task sem card), `Platform Roadmap` (o board da discussão) |
| Resultado | `--col-result` | Task: `PR #1279 · 6 steps` ou `PR #2290 · One-Shot`, e `· dev not updated` em peso 500 quando o encerramento pulou a base. Review: `Merged · 2 passes`, ou `Closed` em peso 500. Discussão: `4 cards published` |
| Hora | `--col-time` | `15:02`, em `--ink-4` |

- **Na lista estreita** (abaixo de 860 px de lista), onde e o resultado descem para uma segunda linha sob o nome, inteiros. Entre 860 e 1040 px, a linha continua com as colunas. A regra da linha do card do board, que esconde a meta, não vale aqui.
- **O nome acessível** diz tudo: `Task Idempotency keys for payment intents, api#398, PR #1279 · 6 steps · dev not updated, archived today at 15:02`.
- **O teclado:** a lista é o `tree` do system, como a do board: `↑` e `↓` percorrem os cabeçalhos dos dias e as linhas, `←` numa linha vai ao cabeçalho do dia, e `Enter` abre.
- **A linha recém-arquivada:** quando se chega pela página do item que saiu (**Open in History**), ela fica destacada como a linha aberta (véu, anel e glifo em identidade), com a hora em `--ink-3` e o foco. A chegada limpa a busca, e a linha aparece mesmo quando o filtro da lateral a esconderia.

**Os vazios:**

- `Nothing archived yet` / `A task comes here once it's closed, a review once its pull request is merged or closed, a discussion once it's archived.`;
- `Nothing matches "refund"` / `Try another name, title or #number, or clear the search.`, com **Clear the search**;
- com o filtro da lateral e nada dele: `Nothing archived in <repo>` / `Choose another repository, or all of them.`

**Muitos itens.** O History cresce cerca de 4 itens por dia. A lista carrega os últimos 90 dias e busca os mais antigos quando a busca pede ou quando a rolagem chega ao fim. O dado é local.

## 4. Os arquivados

Um arquivado abre como lugar, com `← History`. O cabeçalho tem:

- o glifo do tipo e o título;
- a etiqueta `Archived`, `Merged`, `Closed` ou `One-Shot`;
- à direita, o link do GitHub (`PR #1279 ↗`, `Open on GitHub ↗`) ou do board, e **`⋯`** com **Delete…**.

O corpo fica na medida `--measure`, centrado. Nada roda.

**A task.**

1. **Os fatos,** numa lista de termos:
   - `Repository`: `acme/api · card api#398 · Done`;
   - `Pull request`: `#1279 merged into dev by lnakamura · Sep 24 at 14:51`;
   - `Started`.
2. **O resultado do encerramento,** num bloco afundado, com o título `CLOSING` e a hora. Uma linha por parte:
   - feito com o visto (`Worktree removed`, `Branch <nome> deleted`, `dev updated by 3 commits`);
   - pulado com o traço, em `--ink-2`, e a razão com o que fazer (`dev not updated: another branch is checked out` · `Pull dev in ~/code/api when you check it out again.`);
   - falho com o losango e o detalhe do git em mono.

   Os textos são os de `research/rest.md` §3.3.
3. **As abas** (a aba mínima da task): **PRD**, **Tech spec**, **Steps · 6** e **Pull request**. Numa One-Shot, **One-Shot document** e **Pull request**.
   - **PRD** e **Tech spec** vêm renderizados no registro de leitura.
   - **Steps** tem uma linha por step: o número, o nome e o SHA do commit. Sob a linha vêm os relatórios do revisor como marcos em linha, que abrem no lugar: `Review 1 · changes`, `Review 2 · clean`.
   - **Pull request** tem o rascunho da PR (título e corpo) e os relatórios do review da PR, como marcos que abrem no lugar.

**O review.**

1. **Os fatos:** a PR com o autor e quem fez o merge, o card, `Started` com o começo do review, `2 passes, both published`.
2. **Uma seção por passada:** `Pass 1 · Request changes · published Sep 23 at 13:41`. Os apontamentos publicados ficam num bloco afundado, cada um com o texto, `arquivo:linha` em mono e `Inline comment` ou `In the review body`. Depois vem o relatório, como marco que abre no lugar.
3. **No pé:** `The conversation of a review isn't kept in History.`

**A discussão.**

1. **Os fatos:** o board e os cards de entrada, `Started` com o começo da discussão, `Archived Sep 24 at 11:47 · 1 round`, `Published: 4 of 5 drafts: 3 created, 1 updated`.
2. **What it published, primeiro.** Uma lista contornada, com o épico e os cards dele recuados em `--epic-indent`. Cada linha tem a etiqueta do tipo (`Epic`, `New card`, `Update`), o título e, à direita, `Created api#452 ↗`, `Updated gateway#440 ↗` ou `Not published · discarded`.
3. **Document and conversation:** `discussion.md · the understanding` e `Conversation · 31 messages, read only`, como marcos que abrem no lugar.

**Apagar um arquivado.** **Delete…**, no `⋯`, abre o diálogo mínimo, com o foco em **Cancel**:

- `Delete "Idempotency keys for payment intents"?`;
- `This removes the archived task and its documents from History. It can't be undone.`;
- a linha apagada `Nothing changes on GitHub: PR #1279 and the card api#398 stay.`;
- **Delete task**, perigoso.

Apagado, a área volta ao History, que já não tem a linha.

## 5. O início do app

Antes do primeiro estado, a janela nunca fica em branco: ela abre antes de o app abrir os dados.

- **A lateral:** em esqueleto, na hora, com o topo, os nós e as linhas em blocos com brilho, e o seletor de tema no rodapé; com a faixa recolhida guardada, o esqueleto é a faixa. O tema é o que a interface pintou por último, ou o do sistema, até o estado chegar; o seletor mostra a preferência guardada, e a escolha é salva quando o início termina.
- **A área principal**, só depois de 400 ms, para uma abertura normal não piscar: a marca e `Starting MySpec…`, com os passos que bloqueiam a primeira tela, nomeados enquanto rodam. Cada passo tem o visto quando feito, o spinner quando roda e o círculo quando ainda não começou:
  - `Opening your data`: o teste do diretório de dados, o banco com as migrações, as configurações, os prompts, as conversas e o que está guardado;
  - `Checking the clones of 12 repositories` (`the clone of 1 repository`), que aparece quando o primeiro termina e só com algum repositório com caminho; as tasks, os reviews e as discussões são retomados depois dele, porque precisam saber que clone falta.

  O que não bloqueia (a leitura do catálogo, que tem a última leitura guardada) não entra na lista.
- **Um passo lento** (acima de 3 s) mostra o tempo, a cada segundo (`12s`, `1m 15s`), e, no dos clones, a razão: `12s · ~/code/infra doesn't answer`, o primeiro caminho que passou de 3 s. O início não tem prazo total: um clone lento não o derruba, e o usuário vê por quê.

**A falha:**

- a lateral fica em esqueleto parado, sem brilho;
- a área diz, na hora, `MySpec couldn't start` com o losango de erro, e o texto do caso, com o diretório de dados e o log que o app usa (os exemplos são os padrão):
  - permissão negada nos dados: `MySpec can't open its data. Nothing was changed: your tasks, documents and worktrees are as they were. Give your user back the folder ~/.local/share/myspec, then try again.`;
  - disco cheio: `MySpec can't open its data: the disk of ~/.local/share/myspec is full. Free some space, then try again.`;
  - qualquer outro: `MySpec couldn't finish starting. If trying again fails the same way, the log at ~/.local/state/myspec/myspec.log says what happened before it.`;
- o erro fica num bloco de código copiável (`open ~/.local/share/myspec/myspec.db: permission denied`);
- **Try again** `Enter` é a primária, com o foco. Ela volta aos passos e recomeça o início, sem reabrir o app. Com o foco em **Copy** ou no tema, `Enter` é desse botão.

Uma falha antes de haver janela (criar os diretórios, abrir o log) sai com o erro no terminal. Uma migração recusada termina o primeiro passo e abre a seção 7.

## 6. As boas-vindas

As boas-vindas aparecem enquanto nenhum board e nenhum repositório estão cadastrados e nenhum item está ativo: na primeira execução e depois de remover o último. Uma discussão ativa de um board removido deixa o app no shell normal, com a árvore, porque ainda trabalha e notifica. Elas são a Home desse momento, dentro do shell. Os lugares que valem são a Home, Settings e, com algo arquivado, History e os arquivados; qualquer outro vira a Home. `Ctrl+,`, `Esc` e `Alt+←` `Alt+→` agem; `Ctrl+N`, `Ctrl+J` e `Ctrl+E` não. Depois do primeiro cadastro, o lugar na tela fica. `Welcome to MySpec` é o título do lugar: recebe o foco na volta de Settings, e **Add board** o recebe quando as boas-vindas aparecem.

**A lateral** tem só o topo e o rodapé, sem `«`, filtro nem árvore:

- **New** fica tracejado, com `Register a board or a repository first`;
- **History** fica tracejado, com `Nothing archived yet`, quando nada está arquivado, e funciona quando algo está (uma discussão arquivada de um board removido);
- o tema e **Settings** funcionam, e `Ctrl+,` abre Settings.

**A área principal** é uma coluna na medida `--measure-read`:

1. a marca, `Welcome to MySpec` em `--text-display` e `MySpec runs Claude Code through a task, from the card on your GitHub board to the merged pull request. Register where your work lives to start.`;
2. **This machine**, só quando falta algo (seção abaixo);
3. **Start**, com duas linhas de início, a primeira com o foco:
   - **Add board**: `A GitHub project. Its cards start tasks, and the repositories of its issues come with it.`;
   - **Add repository**: `A clone on this machine, for tasks without a board.`

   Cada linha abre o diálogo da seção 2.4 ou da 2.7.

**This machine** aparece só quando falta algo. Numa primeira execução que funciona, não há nada a checar. Cada item tem o losango contornado `◇`, o que falta em peso 500, o que fazer e, quando há, o comando em mono com **Copy**, nesta ordem:

| Falta | Texto | Comando |
|---|---|---|
| O Claude Code não encontrado nesta execução | `Claude Code was not found` · `Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. You can register boards and repositories meanwhile.` | — |
| O `gh` não instalado | `The GitHub CLI isn't installed` · `MySpec reads boards and pull requests through it. Install it and sign in, then add a board.` | `gh auth login` |
| O `gh` sem login | `The GitHub CLI isn't signed in` · `Sign in from a terminal, then add a board. Adding a repository works without it.` | `gh auth login` |

A checagem roda quando as boas-vindas aparecem, quando a leitura dos modelos do Claude Code termina (ela roda em segundo plano, e a primeira execução numa máquina sem Claude Code é o caso que o bloco cobre) e sempre que a janela volta ao foco, para o usuário resolver num terminal e voltar. O Claude Code conta como achado quando a leitura deu certo ou só não listou os modelos. O login é lido do `gh` local, sem rede. Um item que a checagem não sabe não aparece.

Depois do primeiro cadastro, a tela dá lugar à Home com `Nothing in progress` (`screens/board.md` §2.2), com o foco no título dela.

## 7. A migração recusada

**MySpec couldn't be updated** ocupa a janela inteira, sem a lateral e sem atalhos, numa coluna na medida `--measure-read`, no último tema que a interface usou, ou no do sistema. De cima para baixo:

1. a marca e o título em `--text-display`;
2. o texto de `features.md` (Dados de uma versão com áreas de trabalho);
3. **um bloco afundado por tipo de caso,** com os textos de `research/rest.md` §4. Cada bloco tem o título, o que fazer e, separados por fios, os lugares (repositório ou caminho em mono), o detalhe (`The origin remote is not on GitHub: git@gitlab.com:acme/legacy-portal.git`) e as tasks recuadas, em mono, com a área de trabalho ou o caminho (o que a migração sabe de cada task);
4. `Once they're resolved, open this version again and the update runs again.`;
5. **Copy the list**, secundário, que copia os casos como texto: o título, e por tipo o título, o que fazer, `- <lugar>` com o detalhe e `  - <task> · <área ou caminho>`. Copiado, diz `Copied` por 2 s; sem acesso à área de transferência, `Can't copy · select the text`.

## 8. O aviso do app e os toasts

**O aviso** é para uma ação que falhou sem lugar próprio. As falhas que têm lugar ficam no lugar: a linha do modelo, o rodapé de um diálogo, a linha do repositório.

- **O lugar:** uma faixa no topo da área principal, sobre o cabeçalho do item, com `--state-error-veil`, o trilho de erro, `role="alert"`, até ser dispensada.
- **O rótulo:** a ação que falhou, em vermelho e peso 700, e não `Something went wrong`.
- **O detalhe:** o que aconteceu e o que fazer, e **Dismiss**.
- **Uma por vez:** a próxima falha substitui a anterior.

Um exemplo: `Couldn't pause Rate limit per API key` · `The reviewer's session didn't stop in 10 seconds, so it keeps running. Try Pause again, or Stop its answer from the Reviewer tab.`

`Some files stayed on disk` sai da faixa. O que o git não removeu vai para a página da task apagada (seção 9).

**O toast** é para um item que saiu sem estar aberto: uma task, um review ou uma discussão. Ele fica na região `.toasts`, embaixo à esquerda da área principal, e some em 10 s. Tem o ícone do que aconteceu, a frase, o detalhe, **Open in History** sob o texto e `×`. No máximo três ficam empilhados, e o mais antigo sai.

- `"Idempotency keys for payment intents" was archived` · `Closed at 15:02 · dev not updated: another branch is checked out`;
- `web#2288 was merged, and its review ended` · `Pass 2 was published at 13:10`;
- `"Usage alerts at 80% of the plan" was archived` · `3 cards published`.

## 9. O item que saiu do estado

A página do item que saiu segue `screens/review.md` §15 e `screens/discussion.md` §11:

- um ícone neutro e o título em `--text-title`;
- o que aconteceu;
- o resultado num bloco afundado;
- as ações. **Next that needs you** `Ctrl J` é primária, com o destino no tooltip e o foco.

O cabeçalho tem `←` para o lugar anterior e o nome do item. A árvore já não tem o item.

| Caso | Título | Texto | Resultado | Ações |
|---|---|---|---|---|
| Task encerrada | `Idempotency keys for payment intents was closed and archived` | `PR #1279 was merged into dev at 14:51. MySpec closed the task at 15:02; its documents, steps and reports are in History.` | O resultado do encerramento (seção 4) | **Next that needs you**, **Open in History** (chega à linha destacada), **Back to Platform Roadmap** |
| Task apagada | `… was deleted` | `The documents, the steps and every record of the task are gone. PR #1279 stays open on GitHub.` | `Git couldn't remove everything`: uma linha por parte, o que ficou com o losango e o erro do git em mono. Em seguida, o aviso `◇ --force deletes the modified and untracked files in it too. Copy out what you want to keep first.` e o bloco de código `To remove it yourself, in ~/code/api` com o comando e **Copy** | **Next that needs you**, **Back to Platform Roadmap** |
| Review encerrado | `web#2291 was merged, and its review ended` | o de `screens/review.md` §15 | Uma linha por passada | **Next that needs you**, **Open in History**, **Back to Reviews** |
| Discussão arquivada | `Webhook delivery guarantees was archived` | o de `screens/discussion.md` §11 | Uma linha por rodada | **Next that needs you**, **Open in History**, **Open Platform Roadmap** |

**O review apagado** com algo que o git não removeu mostra o mesmo bloco da task apagada, só com a worktree, o aviso e o comando.

**O comando da worktree que ficou** depende de o git ainda a listar como worktree. Listada, como depois do prazo do produto, é `git worktree remove --force <caminho>`, com o aviso do `--force`. Listada e travada (`git worktree lock`), em que o git só a remove com o `--force` dobrado, é `git worktree remove --force --force <caminho>`, com o aviso que diz que ele também a destrava: `◇ --force --force unlocks the worktree and deletes the modified and untracked files in it too. Copy out what you want to keep first.` Fora do registro, como depois de uma permissão, em que o git tira a worktree do registro antes de falhar na pasta, é `rm -rf <caminho>`, com o mesmo aviso: `◇ rm -rf deletes the modified and untracked files in it too. Copy out what you want to keep first.` A branch que ficou tem `git branch -D <branch>`.

**Quando nada mais espera o usuário,** **Next that needs you** fica tracejado, com `Nothing else needs you now.` ao lado, e **Open in History** passa a ser a primária, com o foco. O board removido com a visão aberta segue `screens/board.md` §3.8.

## 10. Os diálogos da task

Os três diálogos são o diálogo mínimo de confirmação (`alertdialog`, `--size-dialog`, a `8vh` do topo), com o foco em **Cancel** e o perigoso como a confirmação final. Eles abrem do `⋯` e da barra do pedido (`screens/task.md` §7 e §10), ficam abertos até a ação terminar, com a falha no rodapé, e não confirmam por `Ctrl ↵`.

**Delete task.**

- Título `Delete “Rate limit per API key”?`.
- Corpo: `This removes the documents, the steps and every record of the task. It can't be undone.`
- **A prévia do que será destruído**, lida do git ao abrir. É um bloco afundado com uma linha por coisa, o ícone e o detalhe:
  - `The reviewer's answer in progress is interrupted`, com o spinner, quando uma sessão roda;
  - `The worktree is removed`, com o caminho em mono e a etiqueta `3 uncommitted files`;
  - `The branch rate-limit-per-api-key is deleted`, com a etiqueta `not merged · 9 commits`;
  - `PR #1284 stays open on GitHub` · `Close it there if you don't need it. Open #1284 ↗`, ou, com a PR mergeada, `PR #1284 is merged` · `Nothing changes on GitHub.`
- **Os estados da prévia:**
  - lendo: `Reading the worktree and the branch…` com brilho, e o esqueleto das linhas;
  - falhou: `◇ Couldn't read the worktree` · `git status failed: not a git repository. Deleting still removes it.`
- **Cancel** e **Delete task**. Apagando, o botão diz `Deleting…` com o spinner, e **Cancel** fica desabilitado. Depois, a área mostra a página da task apagada.

Uma task arquivada usa o texto da seção 4, sem prévia.

**Discard step.**

- Título `Discard step 3 and start over?`.
- Corpo: `This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the 2 reports of the agent review. The step starts again from scratch right away.` Sem revisor, o texto de `research/rest.md` §2.8.
- A caixa **Also clean the worktree**, marcada a cada abertura, num bloco contornado. O texto muda com ela:
  - marcada: `Discards the 3 uncommitted files in the worktree.`;
  - desmarcada: `The 3 uncommitted files stay, and the step starts blocked until the worktree is clean.`
- **Cancel** e **Discard step**.

**Back to a stage e Discard and restart.**

- **O título:** `Back to the Tech spec?`, `Back to the PRD?` ou `Discard the Plan and start over?` (e os da One-Shot, `research/rest.md` §2.9).
- **O corpo** tem, nesta ordem:
  - `This deletes:`, com a lista montada por etapa, incluindo o que a etapa de PR criou (`the pull request draft, the PR conversation and the reports of its review`) e a worktree e a branch com os arquivos não commitados;
  - com a PR aberta, a nota afundada `PR #1284 stays open on GitHub. Close it there if you don't need it.`;
  - o que fica (`The Tech spec stays, and the plan starts again from scratch when you continue.`, ou `A new plan session starts right away, from the tech spec.`);
  - com uma sessão rodando, a linha apagada `The reviewer's answer in progress is interrupted.`
- **O rodapé:** **Cancel** e o verbo da ação (**Back to the Tech spec**, **Back to the PRD**, **Discard the Plan**), perigoso.

**Pause, sem diálogo.** Pausar é reversível e age na hora. Não há confirmação.

- **O cabeçalho:** **Resume** no lugar de **Pause**, e a pílula neutra com `paused` e `Paused since 14:52` no tooltip. O medidor de contexto vira `—`.
- **A conversa:** o marco `Paused by you · the reviewer's pass 2 stopped; Resume or a message starts it again` diz desde quando no tooltip, nunca no texto.
- **As abas:** só a conversa que trabalhava fica pausada (a aba Reviewer). O implementador fica ocioso.
- **A barra e o compositor:** a barra do pedido existe só quando o estado do step, da PR ou da etapa pede uma ação, quieta e sem chip (`screens/task.md` §7); nesta cena nada é pedido, então não há barra. O compositor diz `Sending resumes the task…`.
- **A árvore:** o glifo de duas barras e `Paused · Step 3/7`.
- **Pausando:** **Pause** diz `Pausing…` com o spinner.
- **Nada a pausar:** com um erro de sessão, **Pause** fica tracejado, com o motivo no tooltip e na descrição (`Nothing is running to pause: the reviewer's session stopped with an error. Retry it, or discard the step.`).

## 11. As notificações do sistema

As regras são as de `features.md` (Depende de mim):

- uma notificação só com a janela fora de foco, uma vez por situação, quando ela começa;
- o carrilhão, a menos que outra tenha tocado há menos de 2 s;
- sai da tela quando a situação termina.

O clique traz a janela e abre o lugar como `Ctrl+J`. Com uma edição de prompt não salva, `Discard your changes?` vem antes.

**O título** é o item: o nome da task, `dono/nome#N · <título da PR>` no review, o título da discussão. O título do review muda: hoje é só `dono/nome#N`. **O corpo** é o que a situação pede, sempre com o lugar.

A pergunta, a permissão, a resposta e o erro de uma sessão usam um texto por tipo, com o lugar no texto, como ele entra depois de `in `: `the PRD`, `the tech spec`, `the plan`, `One-Shot planning`, `step N`, `the pull request` (a sessão da PR), `the review` (a sessão do review da PR, e o review de uma PR), `the discussion`. A razão de uma falha vem da mensagem que a barra mostra. Uma mensagem com um dos prefixos `Couldn't publish to GitHub: `, `Couldn't write to GitHub: `, `Couldn't read from GitHub: ` ou `worktree: ` perde o prefixo e entra crua, inteira, sem mudar a primeira letra. Uma sem prefixo que termina em `.`, `!` ou `?` é uma frase do produto: entra a primeira frase, com a primeira letra em minúscula, salvo quando a palavra começa com `GitHub`, é `gh` ou é `MySpec`. O resto é um erro cru, que entra inteiro. Num erro cru, os caminhos vão pelo `~`, e a frase termina em `.`. A tabela tem uma linha por lugar onde o clique cai em outro ponto. Os exemplos usam `Rate limit per API key`, `acme/web#2291 · Migrate settings page…` e `Usage-based pricing tiers`.

A última coluna compara com o texto de hoje:

- **muda**: o corpo de hoje deixa de fora a contagem, o nome ou a saída;
- **novo**: uma situação decidida na rodada da discussão, que ainda não tem texto;
- **igual**: o texto de hoje.

São 61 textos. Esta seção é a fonte única dos textos das notificações; as variantes de uma situação têm uma linha cada.

**Task**

| Situação | Corpo | O clique abre | Em relação a hoje |
|---|---|---|---|
| Question | `The agent has a question in the tech spec.` | O tech spec, o foco na primeira opção do cartão | muda |
| Question · PR | `The agent has a question in the pull request.` | A PR, o foco na primeira opção do cartão | igual |
| Permission | `Permission requested in step 3.` | O step 3, a aba Implementer, o foco em **Allow** | igual |
| Permission · PR review | `Permission requested in the review.` | O PR review, o foco em **Allow** | muda |
| Waiting for reply | `The agent is waiting for your reply in the PRD.` | O PRD, o foco no compositor | muda |
| Session error | `The session stopped with an error in step 3.` | O step 3, o foco em **Retry** | igual |
| Session error · PR | `The session stopped with an error in the pull request.` | A PR, o foco em **Retry** | igual |
| Reviewer asks | `The reviewer of step 3 has a question.` | O step 3, a aba Reviewer, a primeira opção | igual |
| Reviewer permission | `The reviewer of step 3 asks for a permission.` | O step 3, a aba Reviewer, o foco em **Allow** | igual |
| Reviewer without report | `The reviewer of step 3 stopped without writing its report.` | O step 3, a aba Reviewer, o foco em **Retry reviewer** | igual |
| Reviewer error | `The review of step 3 stopped with an error.` | O step 3, a aba Reviewer, o foco em **Retry reviewer** | igual |
| Plan invalid | `The plan is still invalid after 3 automatic corrections.` | O plano, na mensagem do produto com os problemas; a correção vai pelo compositor | muda |
| Ready to continue | `The tech spec is revised and ready to continue.` | O tech spec, o foco em **Continue** | igual |
| Ready to continue · One-Shot | `The One-Shot document is revised and ready to continue.` | Planning, o foco em **Continue** | igual |
| Step blocked | `Step 5 can't start: the worktree has uncommitted changes.` | O step 5, o foco em **Try again** | igual |
| Worktree unreadable | `Step 3: the worktree can't be read.` | O step 3, o erro na barra; resolve sozinho | igual |
| Step to review | `Step 4 is ready for your review. 7 files changed.` | O step 4, o foco em **Open in VS Code** | muda |
| No commit after approval | `Step 4: the last approval didn't produce a commit.` | O step 4, o foco em **Open in VS Code** | igual |
| Agent review gave up | `Step 3: the agent review didn't come clean after 3 rounds. It's yours now.` | O step 3, a aba Implementer, o último relatório | muda |
| Step empty | `Step 6 finished without changes.` | O step 6, o foco em **Discard step 6…** | igual |
| PR blocked | `The pull request is blocked: the GitHub CLI isn't authenticated.` | A PR, o foco em **Try again** | igual |
| Draft | `The pull request draft is ready for your OK.` | A PR, o rascunho na conversa, o foco em **Approve draft** | igual |
| Findings | `The review of the pull request found 4 changes for you to decide.` | O PR review, o primeiro apontamento a decidir | muda |
| Findings · ready to apply | `The approved findings of the pull request review are ready to apply.` (a decisão terminou enquanto o revisor trabalhava) | O PR review, o foco em **Apply approved** | novo |
| Changes to review | `The changes from the review of the pull request are ready for your review.` | O PR review, o foco em **Open in VS Code** | muda |
| No commit after approval · PR | `The last approval of the pull request didn't produce a commit.` | O PR review, o foco em **Open in VS Code** | igual |
| Check failed after review | `A check failed after the review: e2e (chromium).` | O PR review, o check pelo nome, o foco em **Review again** | igual |
| Checks failed after review | `Checks failed after the review: e2e (chromium), lint.` | O PR review, os checks pelo nome, o foco em **Review again** | igual |
| Conflict after review | `The pull request has a conflict with dev.` | O PR review, o foco em **Review again** | igual |
| Ready to merge | `PR #1284 is ready to merge.` | A PR, o foco em **Open PR** | muda |
| Ready to merge · nothing approved | `PR #1284 is ready to merge: every finding of the review was discarded.` | A PR, o foco em **Open PR** | novo |
| Ready to close | `PR #1284 was merged. The task is ready to close.` | A PR, o foco em **Close task** | muda |
| PR closed | `PR #1284 was closed without a merge.` | A PR, o foco em **Delete task…** | muda |

**Review de PR**

| Situação | Corpo | O clique abre | Em relação a hoje |
|---|---|---|---|
| Question | `The agent has a question in the review.` | O review, o foco na primeira opção | igual |
| Permission | `Permission requested in the review.` | O review, o foco em **Allow** | igual |
| Session error | `The session stopped with an error in the review.` | O review, o foco em **Retry** | igual |
| No readable report | `The reviewer stopped without a report the app can read.` | O review, o foco no compositor, para pedir de novo | igual |
| Findings | `The review has 5 findings for you to decide.` | O review, o primeiro apontamento a decidir | muda |
| Ready to publish | `The review is ready to publish.` | O review, o foco em **Publish review…** | igual |
| Publish failed | `The review couldn't be published: GitHub's rate limit was reached.` | O review, o foco em **Retry** | muda |
| Pass blocked | `The next pass of the review couldn't start: gh is not authenticated.` | O review, a saída na barra | muda |
| New commits | `2 commits arrived since your review.` | O review, o foco em **Review again** | muda |
| Check failed after publishing | `A check failed after the review: e2e (chromium).` | O review, o check pelo nome, o foco em **Review again** | igual |
| Conflict after publishing | `The pull request has a conflict with dev.` | O review, o foco em **Review again** | igual |
| Apply · ready to apply | `The approved findings are ready to apply.` | O review, o foco em **Apply approved** | igual |
| Apply · changes to review | `The changes from the review are ready for your review.` | O review, o foco em **Open in VS Code** | muda |
| Apply · ready to merge | `The pull request is ready to merge.` | O review, o foco em **Open PR** | igual |

**Discussão**

| Situação | Corpo | O clique abre | Em relação a hoje |
|---|---|---|---|
| Question | `The agent has a question in the discussion.` | A discussão, o foco na primeira opção | igual |
| Permission | `Permission requested in the discussion.` | A discussão, o foco em **Allow** | igual |
| Waiting for reply | `The agent is waiting for your reply in the discussion.` | A discussão, o foco no compositor | igual |
| Session error | `The session stopped with an error in the discussion.` | A discussão, o foco em **Retry** | igual |
| Drafts can't be read | `The agent wrote drafts the app can't read in the discussion.` | A discussão, o foco no compositor, com a pastilha **Ask to fix the drafts** | igual |
| Decide drafts | `There are 5 drafts to decide in the discussion.` | A discussão, o primeiro rascunho a decidir | muda |
| Epic can't publish, dois cards ou mais, um aprovado | `The epic can't publish: approve one more of its cards, or discard it.` | A discussão, o épico aberto | novo |
| Epic can't publish, dois cards ou mais, nenhum aprovado | `The epic can't publish: approve two more of its cards, or discard it.` | A discussão, o épico aberto | novo |
| Epic can't publish, um card | `The epic can't publish: it has one card. Move another into it, or discard it.` | A discussão, o épico aberto | novo |
| Epic can't publish, nenhum card | `The epic can't publish: it has no cards. Move two into it, or discard it.` | A discussão, o épico aberto | novo |
| Epic discarded, dois ou mais cards aprovados | `The epic is discarded, and 2 of its approved cards won't publish.` | A discussão, o épico aberto | novo |
| Epic discarded, um card aprovado | `The epic is discarded, and its approved card won't publish.` | A discussão, o épico aberto | novo |
| Publish failed | `Couldn't publish “Overage on the monthly invoice”: GitHub's rate limit was reached.` | A discussão, o rascunho, com **Retry** | muda |
| Ready to archive | `Every draft is published or discarded. The discussion is ready to archive.` | A discussão, o foco em **Archive…** | novo |
## 12. Os estados de toda tela (`brief.md` §7)

| Estado | Nestas telas |
|---|---|
| **Vazio** | History sem nada, History com a busca sem resultado, History com o filtro da lateral sem nada. Repositories sem repositório. Add repository sem clone achado ou com o filtro sem resultado. As boas-vindas, quando nada está cadastrado |
| **Carregando** | O início: a lateral em esqueleto com os passos nomeados. Defaults com o catálogo em leitura: as escolhas à vista, com brilho. O diálogo de board lendo o projeto, e o Edit relendo. A varredura de Add repository. A prévia do Delete. O prompt lendo, em esqueleto. Salvar um modelo ou o modo de review |
| **Erro** | O início que falhou. A recusa da URL do board. A falha de leitura de um board, afundada e nunca vermelha. O clone que falhou e **Change path** recusado, na linha. A recusa de um clone da varredura, sob a linha. **Browse…** recusado, no rodapé. A falha ao salvar um modelo, sob a linha. O aviso do app para a ação sem lugar próprio. A prévia do Delete que falhou |
| **Aguardando o usuário** | Nenhuma destas telas cria situação. As notificações (seção 11) levam às situações das outras telas |
| **Agente trabalhando** | Os diálogos da task dizem que a resposta em curso é interrompida. A pausa |
| **Pausado e ocioso** | A pausa: a pílula neutra, **Resume**, o marco e o compositor. O implementador ocioso na aba |
| **Muitos itens** | History carrega 90 dias e busca os mais antigos sob demanda, com os dias como seções. Repositories agrupa por board, com o que precisa de clone no topo. A lista da varredura rola, com os registrados dobrados. A tabela de status do board e a lista de repositórios do diálogo rolam dentro do diálogo |
| **Item que sumiu** | A página do item que saiu (seção 9). O arquivado apagado volta ao History. O board removido segue `screens/board.md` §3.8 |

## 13. Atalhos

| Atalho | Onde | Ação |
|---|---|---|
| `Ctrl+,` | Qualquer lugar, as boas-vindas incluídas | Abre ou fecha Settings |
| `Esc` | Settings | Fecha Settings e volta ao lugar anterior |
| `Esc` | Um diálogo, um menu | Fecha e devolve o foco ao gatilho |
| `↑` `↓` `Home` `End` | A navegação de Settings | Troca de página; com a navegação em linha, `←` `→` também |
| `Ctrl ↵` | Um diálogo | Confirma com o primário |
| `Enter` | O passo da URL do board | Lê o board |
| `Ctrl S` | A edição de um prompt | Salva |
| `/` | History | Foca a busca |
| `↑` `↓`, `Enter` | A lista do History | Percorrem os cabeçalhos dos dias e as linhas, e abrem o arquivado |
| `Ctrl J` | A página do item que saiu | **Next that needs you** |
| `Enter` | O início que falhou | **Try again** |

**O foco inicial** depende do diálogo ou da página:

- os diálogos de criação (Add board, Edit board, Add repository) começam no primeiro campo do passo;
- as confirmações destrutivas começam em **Cancel**;
- History começa na busca, ou na linha recém-arquivada quando se chega pela página do item que saiu;
- a página do item que saiu começa em **Next that needs you**;
- as boas-vindas começam em **Add board**;
- Settings aberto por `Ctrl+,` ou por um link começa no item da página na navegação;
- o início que falhou começa em **Try again**.

## 14. O que muda em `features.md` e em `structure.md`

**`structure.md` §4 e §1, Settings.**

- **A navegação:** quatro itens, Defaults, Boards, Repositories e Prompts. Os nove prompts saem da navegação e viram uma lista numa página. É uma revisão de §4, com esta razão: nenhum prompt foi editado (0 de 9), e nove itens raros ocupavam 9 de 12 linhas da navegação. A lista diz de um olhar quais estão editados.
- **Sem página de aparência:** o tema fica no rodapé da lateral.
- **A abertura:** Settings abre em Defaults, ou na página do link que o abriu.
- **A largura:** abaixo de 820 px de área principal, a navegação vira uma linha acima da página.

**`structure.md` §7.**

- **O aviso do app** tem como rótulo a ação que falhou e é só para uma ação sem lugar próprio.
- **`Some files stayed on disk`** sai da faixa e vai para a página da task apagada.
- **Muitos itens no History:** 90 dias carregados e os mais antigos sob demanda.
- **O início** lista só os passos que bloqueiam a primeira tela.

**`features.md`, Configurações e aparência.**

- Settings tem Defaults, Boards, Repositories e Prompts, e abre em Defaults.
- O tema fica só no botão da lateral.
- Nas boas-vindas, `Ctrl+,` abre Settings.

**`features.md`, Modelos e esforço.**

- Os modelos padrão ficam agrupados por parte do workflow.
- A escolha mudada da fábrica fica marcada, com a de fábrica no tooltip e a marca `factory` no menu.
- Durante a leitura do catálogo, as escolhas salvas continuam à vista, e só o menu espera.
- Uma falha ao salvar aparece na linha, com **Try again**.

**`features.md`, Página Boards, Cadastrar, Editar e remover um board.**

- A falha de leitura fica afundada, com `◇` e **Try again**, e nunca é vermelha.
- **O diálogo:**
  - o passo no subtítulo e **Back** entre os passos;
  - **Add** com três passos, **Edit** com dois, um a menos para um board sem campo `Status`;
  - os status numa tabela só, com `Ends the work` e `New cards`;
  - o Edit que diz, numa nota, as opções que sumiram e as novas.
- **O repositório desmarcado** diz na linha se vai para No board ou sai do MySpec, e o rodapé soma.
- **Remove** lista os repositórios por destino.

**`features.md`, Página Repositories, Repositório sem clone e Clone inexistente.**

- **A ordem:** a lista começa por **Needs a clone** e segue agrupada por board, em ordem alfabética, com No board por último.
- **As ações da linha** (**Change path…**, **Review instructions…** e **Remove…**) ficam no `⋯`. **Remove…** desabilitado diz o motivo abaixo dele, em tinta neutra. **Clone** e **Change path…** também ficam nas linhas de bloqueio.
- **As instruções de review:** a linha diz `Review instructions set` quando há; `None` fica no `⋯`.
- **A pasta de clones** fica no pé da página.
- **O vazio:** sem repositório, a página tem um estado vazio.
- **Add repository** põe os disponíveis primeiro e dobra os registrados. A recusa de **Browse…** fica numa linha própria.
- **Remove repository** diz que o repositório sai também do board.

**`features.md`, Prompts.**

- A página de Prompts é uma lista, com `Default` ou `Edited <data>`.
- Os placeholders aparecem como etiqueta.
- **Restore default** passa a se chamar **Reset to default…**, e a confirmação, **Reset prompt**.
- A página diz as linhas da versão editada e as do padrão, e que uma sessão em curso mantém o prompt com que começou.

**`features.md`, Histórico.**

- A lista é agrupada por dia, com o tipo, onde, o resultado e a hora.
- O resultado de uma task é a PR, os steps e o que o encerramento pulou.
- O filtro da lateral aparece como chip removível.
- A lista carrega 90 dias.
- A task arquivada mostra o resultado do encerramento e a aba **Pull request**, com o rascunho e os relatórios do review da PR. É o que `features.md` já promete.
- A discussão arquivada mostra primeiro o que publicou.
- Apagar um arquivado volta ao History.

**`features.md`, Encerramento e arquivamento.** O aviso momentâneo existe para task, review e discussão, só quando o item sai sem estar aberto, e tem no máximo três empilhados. Com o item aberto, a área mostra a página do item que saiu, com o resultado.

**`features.md`, Apagar uma task.**

- A prévia conta os arquivos não commitados e os commits fora da base, e diz a sessão que será interrompida.
- Com a PR mergeada, diz `is merged` em vez de `stays open`.
- O que ficou no disco vai para a página da task apagada, com o comando e o aviso do `--force`.

**`features.md`, Voltar e descartar, Descartar step, Sessões.**

- A lista do que se perde cita o que a etapa de PR criou.
- **Discard step** conta os arquivos não commitados.
- Os diálogos dizem a resposta interrompida.
- A pausa tem o marco `Paused by you` na conversa, que diz desde quando.

**`features.md`, Tela de boas-vindas, Dados de uma versão com áreas de trabalho, e o início.**

- As boas-vindas dizem o que falta na máquina (o Claude Code, o `gh`, o login), só quando falta, com o comando copiável.
- A migração recusada ganha **Copy the list**.
- O início mostra `Starting MySpec…` com os passos que bloqueiam. A falha mostra o erro, o que fazer e **Try again**.

**`features.md`, Depende de mim.** Os corpos marcados `muda` e `novo` na seção 11, e o título do review com o título da PR.

## 15. Dados que o backend precisa expor

| Dado | Para | Custo |
|---|---|---|
| `CloseResult` no `ArchivedTask`. Está em `pr_runs.close_result` e não é exposto | O resultado do encerramento na task arquivada, na página da task que saiu e no toast | Pequeno: um campo no DTO, lido do JSON que já é gravado |
| O rascunho da PR e os relatórios do review da PR no `ArchivedTask` | A aba **Pull request** da task arquivada | Pequeno, se os arquivos ficam na pasta de artefatos no arquivamento; a verificar |
| O que o apagamento deixou no disco, ligado ao item | A página da task apagada e o comando | Pequeno (`structure.md` §8): hoje só existe o `Leftover` avulso |
| A consequência por repositório desmarcado no Edit board | A linha do repositório e o rodapé | Pequeno: a regra de `previewRemoveBoard`, por repositório |
| As opções de status que sumiram e as novas, no Edit | A nota do passo dos status | Pequeno: a comparação entre o guardado e o relido |
| Os arquivos não commitados e os commits fora da base | A prévia do Delete e do Discard step | Pequeno: `previewDelete` já lê a worktree e a branch |
| Desde quando está pausado | O marco `Paused by you` e o tooltip da pílula | Pequeno (`structure.md` §8) |
| O progresso do início, passo a passo, com o tempo | `Starting MySpec…` | Médio, dentro da task 10: a janela antes dos dados (`backend.md` P35) |
| Se o Claude Code foi achado, se o `gh` existe e se tem login | `This machine` nas boas-vindas | Pequeno: o primeiro sai da leitura do catálogo desta execução, os outros do `gh` local, sem rede (`backend.md` P36) |
| As contagens e os nomes nos corpos das notificações, e os corpos das situações novas da discussão | A seção 11 | Pequeno: os dados estão nas situações |
| O título da PR no título da notificação de review | A seção 11 | Nenhum: já está no review |
| A ação que falhou, no aviso do app | O rótulo do aviso | Só frontend: cada chamada sabe qual ação fez |
| O aviso de arquivamento de review e de discussão | O toast | Só frontend: `reviewHistory` e `discussionHistory` já chegam |
| A lista do History por partes (90 dias e os mais antigos sob demanda) | Muitos itens no History | Pequeno: uma consulta com data de corte |
| A data da edição de um prompt e o número de linhas da versão editada e do padrão | `Edited Sep 20` na lista e no prompt; `Your version has 92 lines; the default of this version has 87.` | Pequeno: a data do arquivo do prompt editado e as linhas dos dois textos, contadas no Go (`backend.md` P34) |

## 16. Os componentes que entram em `system/components.md`

O coordenador consolida. Os estados de cada um estão em `lab/14-screen-rest/components.html`.

**Novos:**

- **Navegação de Settings:** padrão, hover, foco, pressionado, a página aberta, com o `◇` e a contagem.
- **Linha do modelo padrão:** de fábrica, mudada, com a dica do que mais parte dela, hover, foco, aberta, salvando, erro ao salvar, indisponível e lendo o catálogo com brilho.
- **Menu de modelo e esforço:** dois grupos de `menuitemradio`, com a marca `factory`. Estados: um modelo sem esforço e sem leitura do catálogo.
- **Rádio:** padrão, hover, foco, marcado, desabilitado e erro. É o que `components.md` deixou para a fase 4. A caixa de seleção é a do board.
- **Linha de Settings,** para o board e o repositório: nome, as linhas de fato, as ações à direita, e a linha de bloqueio sob o dono.
  - Board: lida, lendo, nunca lida, a leitura falhou, tentando de novo.
  - Repositório: com clone, sem clone, clonando, o clone falhou, clone inexistente, **Change path** recusado, o menu com **Remove** desabilitado.
- **Grupo de lista com o título:** o `Needs a clone` no topo, e os boards.
- **Repositório no diálogo do board:** registrado, clone achado, dois clones, sem clone, desmarcado com a consequência, de outro board desabilitado, hover e foco.
- **Tabela de status:** `Ends the work` e `New cards`, com a etiqueta `new`.
- **Clone da varredura:** disponível, marcado, ligando um clone, registrado desabilitado, cadastrando, recusado, varrendo e nada achado.
- **Rodapé do diálogo em passos:** **Back**, a razão ou a consequência, a recusa numa linha própria. Estados: lendo, desabilitado e erro. O passo vai no subtítulo do diálogo.
- **Linha do History e o cabeçalho do dia:** task, One-Shot, review mergeado e fechado, discussão, hover, foco, pressionado, recém-arquivada, e lista estreita em duas linhas.
- **Resultado do encerramento:** feito, pulado, falho.
- **Prévia de um apagamento:** lendo com o texto, lida e falhou.
- **Linha de prompt e etiqueta de placeholder,** o editor com a coluna de placeholders e a barra de salvar.
- **Aviso do app** com o rótulo da ação, e **toast do item que saiu** para task, review e discussão.
- **Passos do início e checagens da máquina.**

**Tokens novos para `system/tokens.css`,** todos `calc()` de tokens de espaço:

- `--snav-w: calc(var(--space-16) * 3 + var(--space-4))`;
- `--col-where: calc(var(--space-16) * 2 + var(--space-8))`;
- `--col-result: calc(var(--space-16) * 4)`;
- `--col-time: var(--space-12)`.
