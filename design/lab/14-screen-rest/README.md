# 14 · O resto: Settings, History, início, avisos, diálogos e notificações

Fase 4, quinta e última rodada de telas. O levantamento é `design/research/rest.md`, e as respostas do usuário às duas perguntas dele estão em `design/research/interview.md`. A régua é a das quatro telas decididas (`decisions.md`, 2026-09-24): cada elemento justifica por que existe, ou sai. Esta rodada traz **uma variação só**. São telas de apoio, raras no uso (entrevista), e o padrão já foi decidido nas quatro telas principais. A única escolha real era a organização do History, e ela foi respondida pelo usuário durante a rodada (seção "As duas perguntas").

## O que a rodada cobre

- **Settings.** Um lugar como os outros, com quatro páginas: **Defaults**, **Boards**, **Repositories** e **Prompts**.
- **History**, e a task, o review e a discussão arquivados.
- **O início do app**, as boas-vindas e a migração recusada.
- **O aviso do app** e os toasts.
- **A página do item que saiu** para a task (encerrada ou apagada), o review e a discussão.
- **Os diálogos da task**: apagar com a prévia, descartar step, voltar a uma etapa e descartar a etapa.
- **A pausa**.
- **As notificações do sistema**, numa tabela com o texto de cada situação e o que o clique abre.

Os dados são os do volume real (`rest.md` §7), no mundo acme das rodadas anteriores:

- 3 boards e 12 repositórios. Deles, 2 sem clone e 1 com o clone inexistente;
- 9 modelos padrão, 6 mudados da fábrica, e o modo de review `Agent`;
- 9 prompts;
- 44 itens no History em 12 dias: 22 tasks (8 One-Shot), 12 reviews e 10 discussões;
- os encerramentos com a base pulada em parte dos casos, como no banco.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | As 18 cenas, com as variações de cada uma |
| `components.html` | Os componentes novos em todos os estados, claro e escuro lado a lado. `?only=N` mostra um só |
| `src/` | As fontes, com `build.py` gerando as duas páginas |

`src/` tem estes arquivos:

- `data.js`: os dados;
- `shell.js`: a lateral, o cabeçalho, a task por trás dos diálogos e o diálogo;
- `settings.js`, `history.js` e `other.js`: as telas;
- `boot.js`: a troca de cena, as teclas e a auditoria;
- `rest.css`: o estilo da rodada;
- `comps.js` e `comps.css`: o espécime.

As páginas são geradas por `python3 design/lab/14-screen-rest/src/build.py`. O script lê sem mudar os arquivos das rodadas anteriores:

- `base.css`, `core.css`, `core.js`, `m.css`, `b.css` e `stepper.js`, das rodadas 08 a 10;
- `board.css`, da rodada 11;
- `review.css` e `vb.css`, da rodada 12.

Cada página traz `design/system/tokens.css` byte a byte, e o script confere isso. Nenhum token novo entra no system. Os quatro tamanhos que a rodada usa são `calc()` de tokens: a navegação de Settings e as três colunas do History.

## Como abrir

Sirva a pasta (`python3 -m http.server <porta> -d design/lab`) e abra `14-screen-rest/index.html`. O seletor no canto inferior direito, que não é do produto, tem dois campos: a cena e a variação da cena. Os parâmetros da URL são estes:

- `?scene=` e `?v=`;
- `?theme=light` ou `?theme=dark`;
- `?audit`, a auditoria de pixel inteiro, texto cortado, sobreposição, nome acessível e contraste;
- `?clean`, sem o seletor.

O que responde a clique ou tecla:

- a navegação de Settings;
- **Add board** e os três passos, com **Back**;
- **Edit…**, **Remove…**, **Add repository**, **Change path…**, **Edit**, **Reset to default…** e **Cancel** do prompt;
- as linhas do History, que abrem o arquivado;
- **Open in History** na página do item que saiu;
- `Esc`, que fecha os diálogos, e o foco preso dentro deles;
- `/` e `↑` `↓` no History.

## As cenas

| Cena | Variações (`?v=`) | O que mostra |
|---|---|---|
| `settings-defaults` | —, `list`, `saving`, `reading`, `failed` | Modo de review e modelos por etapa, agrupados por parte do workflow. `6 of 9 changed from the factory defaults`. A escolha própria em tinta 1 e peso 500, a de fábrica quieta. O `listbox` tem dois grupos, modelo e esforço, e marca `factory`. A variação `saving` tem salvando, a falha ao salvar com **Try again** e a escolha `◇ unavailable`. As outras duas mostram o catálogo lendo e a falta de leitura, com a faixa `◇` e a razão no `listbox` |
| `settings-boards` | —, `add-1`, `add-1-reading`, `add-1-error`, `add-2`, `add-3`, `add-nostatus`, `edit-reading`, `edit-1`, `edit-2`, `remove` | Os três boards. Um tem a leitura falha, afundada e com **Try again**, nunca vermelha. **Add** tem três passos: o projeto, os status numa tabela só (`Ends the work` e `New cards`) e os repositórios, com `Clone found`, dois clones, `Registered without a clone` e o de outro board. Um board sem campo `Status` pula os status e diz `Step 2 of 2`. **Edit** abre relendo o board e tem dois passos. Os status do Edit dizem o que mudou no board. No passo dos repositórios, o desmarcado diz na linha dele se vai para No board ou sai do MySpec, e o rodapé soma. **Back** volta ao passo anterior do mesmo diálogo. O **Remove** usa o texto de `features.md` e lista os repositórios por destino |
| `settings-repos` | —, `add`, `add-scanning`, `add-refused`, `instructions`, `menu`, `change-path`, `remove`, `empty` | O que bloqueia vem primeiro: **Needs a clone** tem os dois sem clone, com **Clone**, e o clone inexistente, com **Change path…**. O board de cada um fica na segunda linha. Depois vêm os boards, em ordem alfabética: nome, caminho, contagens e `⋯`. **Change path** recusado mostra a razão na linha. **Add repository** varre a pasta home, lista os 4 clones disponíveis e dobra `Already registered · 9`; o clone de um repositório sem clone diz que vai ligá-lo. **Browse…** recusado mostra a razão no rodapé, numa linha própria. As instruções de review abrem sob a linha e ficam como `Review instructions set` nela. O `⋯` tem **Remove…** desabilitado em tinta 4, com a razão abaixo. A pasta de clones fica no pé da página |
| `settings-prompts` | —, `view`, `edit`, `reset`, `discard` | A lista dos nove, com `Default` ou `Edited Sep 20`. O prompt lido tem os placeholders como etiqueta mono, **Edit** e **Reset to default…**. A edição tem a coluna `Placeholders` e **Save** `Ctrl S`. Os dois diálogos mínimos são reset e descartar a edição |
| `history` | —, `fresh`, `filtered`, `no-match`, `empty` | Uma lista só, por data, com os dias como seção. A linha tem o glifo do tipo, o nome, onde, o resultado e a hora; na lista estreita, onde e o resultado descem para uma segunda linha. `fresh` destaca a linha recém-arquivada, quando se chega da página do item que saiu. `filtered` mostra o filtro da lateral aplicado, como chip removível. Os outros dois são os vazios |
| `archived-task` | —, `steps`, `pr`, `oneshot`, `delete` | Os fatos, **o resultado do encerramento** e as abas PRD, Tech spec, Steps · 6 e Pull request. Steps tem os relatórios de cada step, que abrem no lugar. Pull request tem o rascunho e **os relatórios do review da PR** |
| `archived-review` | — | Cada passada: o veredito, o que foi publicado e onde (inline ou no corpo), e o relatório, que abre no lugar |
| `archived-discussion` | — | **O que ela publicou** primeiro: o épico com os cards recuados e o link de cada um, `Not published · discarded`. Depois o documento e a conversa, somente leitura, como marcos que abrem no lugar |
| `starting` | —, `slow`, `failed` | A lateral em esqueleto e `Starting MySpec…` com os passos que bloqueiam a primeira tela. O passo lento mostra o tempo e a razão. A falha mostra o erro copiável, o que fazer e **Try again**, com a lateral parada; nunca fica uma janela em branco |
| `welcome` | —, `no-login`, `no-gh`, `no-claude` | **Add board** e **Add repository** como linhas de início. `This machine` aparece só quando falta algo: o `gh` sem login, o `gh` não instalado ou o Claude Code não encontrado, cada um com o que fazer e o comando copiável. A lateral fica só com o topo e o rodapé |
| `migration` | — | **MySpec couldn't be updated** na janela inteira, com os três tipos de caso e **Copy the list** |
| `notice` | —, `toast` | O aviso no topo da área principal, para uma ação sem lugar próprio, dá nome ao que falhou (`Couldn't pause Rate limit per API key`) e ao que fazer. A variação mostra os toasts de uma task e de um review que saíram sem estar abertos |
| `gone` | —, `deleted`, `review`, `discussion`, `nothing` | A página do item que saiu. A task encerrada traz o resultado do encerramento. A task apagada traz o que o git não removeu, o aviso de que `--force` apaga os arquivos modificados, e o comando copiável. O review e a discussão seguem as rodadas 12 e 13. `nothing`: nada mais espera o usuário, então **Next that needs you** fica desabilitado com a razão, e **Open in History** é a primária |
| `delete-task` | —, `loading`, `failed`, `merged`, `deleting` | A prévia do que será destruído: a sessão interrompida, a worktree com `3 uncommitted files`, a branch `not merged · 9 commits`, a PR que fica aberta ou já mergeada. Também a leitura da prévia, a prévia que falhou (apagar continua possível) e o apagamento em curso |
| `discard-step` | —, `keep` | **Also clean the worktree** com a contagem de arquivos não commitados, e o que acontece sem ela |
| `back-to-stage` | —, `pr`, `discard` | A lista do que se perde e o que fica. Com a task no PR review (`pr`, e a task de fundo está nessa etapa), a lista inclui o que a etapa de PR criou e a PR que fica aberta no GitHub. Os três dizem que a resposta do revisor em curso é interrompida |
| `pause` | —, `pausing`, `blocked` | A task pausada: a conversa do revisor pausada e o implementador ocioso, **Resume** no cabeçalho, a pílula neutra com `paused` e o marco `Paused by you · 14:52`, que diz desde quando. O compositor diz `Sending resumes the task…`. As variações são pausando e **Pause** desabilitado com a razão durante um erro de sessão |
| `notifications` | — | A tabela de 55 textos do catálogo de `rest.md` §5.4, agrupada por task, review e discussão: título e corpo como no D-Bus, e o que o clique abre. Uma linha diz como o texto de uma sessão nomeia o lugar. Marca o que muda e o que é novo |

## Decisões desta rodada

**Settings abre em Defaults.** É a página que muda (6 de 9 modelos). Hoje Settings reabre na última página vista. Um link vindo de fora abre a página dele: **Edit the board in Settings…** abre Boards, e o aviso de clone abre Repositories. **Close** `Esc` e `←` voltam ao lugar anterior, como já decidido em `structure.md` §1.

**A navegação tem quatro itens, e os prompts viram uma página com a lista.** É uma revisão de `structure.md` §4, que pôs os nove prompts na navegação, e precisa entrar em `decisions.md` com esta razão: ninguém editou um prompt (0 de 9), e nove itens raros ocupavam 9 de 12 linhas da navegação. A lista de Prompts mostra de um olhar quais foram editados, o que a navegação de antes não mostrava. Abaixo de cerca de 820 px de área principal (janela abaixo de 1100 px), a navegação passa a ser uma linha acima da página. Na metade do monitor, ela fica à esquerda.

**Não há página Appearance.** O tema fica só no botão do rodapé da lateral, como está. Uma página inteira para uma escolha feita uma vez, que já está a um clique, não se justifica pela régua.

**O History é uma lista só, por data.** O History não ganha filtro próprio: o filtro da lateral vale nele, e aparece como chip removível quando está ativo. Em "O que muda em `features.md`" ele aparece como "a mesma organização de hoje, agrupada por dia", o que não muda o comportamento.

**Pausar não tem diálogo.** Esta rodada confirma o que `task.md` §4 e §12 decidiram. Pausar é reversível e age na hora, com o marco na conversa. Um diálogo de pausa seria cromo sem função. A cena `pause` mostra o estado, não uma confirmação.

**O aviso do app diz o que falhou.** O rótulo deixa de ser `Something went wrong` e passa a ser a ação (`Couldn't change the model of Plan`, `Couldn't pause Rate limit per API key`), e o detalhe diz o que fazer. Cada chamada do frontend sabe qual ação fez.

**`Some files stayed on disk` sai da faixa do topo.** O que o git não removeu vai para a página da task apagada, com o comando pronto para copiar. Apagar uma task ativa sempre acontece com ela aberta, e uma task arquivada não tem worktree.

## A recomendação

Recomendo adotar a rodada como está. Ela não inventa estrutura: aplica às telas de apoio os componentes das quatro telas decididas. São a linha de lista e a faixa de falha do board, o diálogo largo e o mínimo, a nota afundada e a página do item que saiu do review, e o marco em linha da task.

Dois pontos que pediam o olho do usuário já foram decididos pelo coordenador depois da crítica: os prompts numa página e Appearance fora. O terceiro, `This machine` só quando falta algo, está aplicado.

## O que ficou fora, e por quê

| Ficou fora | Por quê |
|---|---|
| O History por tipo e o filtro próprio do History | Resposta do usuário: ele quase nunca abre o History e usa o filtro da árvore |
| Uma volta aos padrões de fábrica, para todos os modelos de uma vez | O `listbox` marca a escolha de fábrica, e o tooltip do chip a diz; a volta é uma escolha por etapa. Nada no uso pede um reset em massa |
| O arquivado aberto num painel ao lado da lista | `structure.md` §1 decidiu o arquivado como lugar, e a leitura de um PRD pede a largura da página |
| Configuração de notificações e de som | `features.md` decide que não há níveis, silenciamento nem configuração; o volume e o não perturbe são os do sistema |
| Um diálogo de pausa | A pausa é reversível e já tem estado visível; ver "Decisões desta rodada" |
| A conversa de uma task ou de um review arquivado | O produto não a guarda (`features.md` §Histórico); a página diz isso |
| O mock das notificações do sistema | Pedido da rodada: a tabela é o que importa, e o visual é do servidor de notificação |
| Remove board com a visão aberta e card fora da leitura | Já decididos em `board.md` §3.8 e §3.9 |

## Componentes novos

Todos estão em `components.html`, em todos os estados, claro e escuro lado a lado.

| Componente | Estados |
|---|---|
| **Navegação de Settings** (quatro páginas) | padrão, hover, foco, pressionado, a página aberta, com o `◇` do clone, aberta com o `◇` |
| **Linha do modelo padrão** | de fábrica, mudada, com o que mais parte dela, hover, foco, aberta, salvando, erro ao salvar com **Try again**, indisponível, lendo o catálogo (a escolha salva com o brilho) |
| **Menu de modelo e esforço** (dois grupos de `menuitemradio`) | modelo e esforço com `factory`, a fábrica escolhida, um modelo sem esforço, erro sem leitura do catálogo |
| **Rádio** (novo; a caixa de seleção é da rodada 11) | padrão, hover, foco, marcado, desabilitado, erro |
| **Linha do board** | lida, lendo, nunca lida, a leitura falhou, tentando de novo; as ações em hover e foco |
| **Linha do repositório** | com clone, sem clone com **Clone**, clonando, o clone falhou, o clone inexistente, **Change path** recusado, o menu com **Remove** desabilitado |
| **Repositório de um board no diálogo** | registrado e marcado, clone achado, hover, foco, desmarcado indo para No board, desmarcado saindo do MySpec, desabilitado por ser de outro board |
| **Clone da varredura** | disponível, marcado, ligando um clone, hover, foco, desabilitado por já estar registrado, cadastrando, recusado, varrendo, nada achado |
| **Rodapé do diálogo em passos** | passo 1, passo 3 com a consequência, foco em **Back**, lendo o projeto, desabilitado, erro ao salvar |
| **Linha do History** e o **cabeçalho do dia** | task, One-Shot, review mergeado, review fechado, discussão, hover, foco, pressionado, recém-arquivada, lista estreita |
| **Resultado do encerramento** | tudo feito, uma parte pulada, uma parte que falhou |
| **Prévia de um apagamento** | lendo, lida, erro ao ler a worktree |
| **Linha de prompt** e **placeholder** | padrão, editado, hover, foco, pressionado |
| **Aviso do app** e **toast do item que saiu** | aviso, **Dismiss** em foco, toast de task, de review e de discussão |
| **Passos do início** e **checagens da máquina** | feito, rodando e lento, a fazer; o que funciona e o que falta |

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| `CloseResult` no `ArchivedTask`. Está em `pr_runs.close_result` e não é exposto | O resultado do encerramento na task arquivada, na página da task que saiu e no toast | Pequeno: um campo no DTO, lido do JSON que já é gravado. `features.md` já promete esse dado |
| Os relatórios do review da PR e o rascunho da PR no `ArchivedTask` | A aba **Pull request** da task arquivada | Pequeno, se os arquivos ficam na pasta de artefatos no arquivamento; não verificado |
| O que o apagamento deixou no disco, ligado ao item | A página da task apagada e o comando para remover | Pequeno: hoje só existe o `Leftover` avulso |
| A consequência por repositório desmarcado no Edit board: vai para No board ou sai do MySpec | A linha do repositório e o rodapé do diálogo | Pequeno: a mesma regra de `previewRemoveBoard`, por repositório |
| Os arquivos não commitados e os commits fora da base, na prévia de Delete task e de Discard step | `3 uncommitted files`, `not merged · 9 commits` | Pequeno: `previewDelete` já lê a worktree e a branch; falta a contagem |
| Desde quando está pausado | O marco `Paused by you · 14:52` e o tooltip da pílula | Pequeno (`structure.md` §8) |
| O progresso do início, passo a passo, com o tempo | `Starting MySpec…` | Pequeno (`structure.md` §8) |
| Se o Claude Code foi achado, se o `gh` existe e se tem login | `This machine` nas boas-vindas, só quando falta algo | Pequeno: a versão sai da leitura do catálogo; o login pede um `gh auth status` na abertura das boas-vindas |
| As contagens nos corpos das notificações (`4 changes`, `5 drafts`, `7 files changed`) e os corpos novos da discussão | A tabela `notifications` | Pequeno: os dados estão nas situações |
| O aviso de arquivamento de review e de discussão | O toast do item que saiu sem estar aberto | Só frontend: `reviewHistory` e `discussionHistory` já chegam |
| A ação que falhou, no aviso do app | O rótulo `Couldn't change the model of Plan` | Só frontend: cada chamada de `run()` recebe o nome da ação |

## O que muda em `features.md` e em `structure.md`

1. **Configurações e aparência.**
   - Settings abre em Defaults, ou na página do link que o abriu.
   - A navegação tem Defaults, Boards, Repositories e Prompts.
   - Os prompts são uma lista com `Default` ou `Edited`; `structure.md` §4 muda aqui.
   - O tema continua só no botão do rodapé.
   - Nas boas-vindas, Settings abre (`Ctrl+,` deixa de ser inerte).
2. **Página Boards.**
   - A falha de leitura fica afundada, com `◇` e **Try again**, e não vermelha.
   - O diálogo tem o passo no subtítulo e **Back**: três passos no Add, dois no Edit, um a menos sem campo `Status`.
   - Os status viram uma tabela com `Ends the work` e `New cards`.
   - O Edit diz, no repositório desmarcado, para onde ele vai.
   - O **Remove** lista os repositórios por destino.
3. **Página Repositories.**
   - A lista começa por **Needs a clone** e segue agrupada por board, em ordem alfabética.
   - As ações da linha vão para o `⋯`, e **Remove** fica desabilitado com a razão.
   - As instruções de review ficam no `⋯` e abrem sob a linha; a linha diz `Review instructions set` quando há.
   - O sem clone, o clonando e o clone inexistente ficam sob a linha, como na Home.
   - A pasta de clones fica no pé da página.
   - Sem repositório, a página mostra um estado vazio.
   - **Add repository** põe os disponíveis primeiro e dobra os registrados.
   - **Remove** diz que o repositório sai também do board.
4. **Prompts.**
   - **Restore default** passa a se chamar **Reset to default…**.
   - Os placeholders aparecem como etiqueta.
   - A página diz que uma sessão em curso mantém o prompt com que começou.
5. **Histórico.**
   - A lista é a de hoje, agrupada por dia, com uma linha por tipo e o resultado. O resultado de uma task é a PR, os steps e o que o encerramento pulou (`dev not updated`), não o merge, que é sempre o mesmo.
   - O filtro da lateral aparece como chip quando está ativo.
   - A task arquivada mostra o resultado do encerramento e a aba **Pull request**, com o rascunho e os relatórios do review da PR, como `features.md` já promete.
   - A discussão arquivada mostra primeiro o que publicou.
   - Apagar um arquivado volta ao History.
6. **Encerramento e arquivamento.**
   - O aviso momentâneo existe para task, review e discussão, e só quando o item sai sem estar aberto.
   - Com o item aberto, a área mostra a página do item que saiu, com o resultado.
7. **Apagar uma task.**
   - A prévia conta os arquivos não commitados e os commits fora da base.
   - Com a PR mergeada, a prévia diz `is merged` em vez de `stays open`.
   - O que ficou no disco vai para a página da task apagada, com o comando, e não para a faixa do topo.
8. **Voltar e descartar.** A lista do que se perde cita o que a etapa de PR criou.
9. **Pausar.** O marco `Paused by you` na conversa diz desde quando a task está pausada.
10. **O aviso do app.** O rótulo é a ação que falhou, e o detalhe diz o que fazer; `structure.md` §7 muda aqui.
11. **Início, boas-vindas e migração.**
    - `Starting MySpec…` mostra os passos que bloqueiam a primeira tela.
    - Uma falha no início mostra o erro, o que fazer e **Try again**.
    - As boas-vindas dizem o que falta na máquina (Claude Code, `gh`), só quando falta.
    - A migração recusada ganha **Copy the list**.
12. **Depende de mim.** Muda o corpo das notificações marcadas `changed`, e entram os corpos das situações novas da discussão (`Epic can't publish`, `Epic discarded`, `Ready to archive`).

## As duas perguntas do levantamento

As duas foram respondidas pelo usuário durante a rodada; as respostas estão registradas em `design/research/interview.md`.

1. **Para que ele abre o History?** Quase nunca abre.
   - O que isso decide: uma organização só, a mais simples possível, que é a lista por data com o tipo e o resultado.
   - A cena da organização por tipo foi retirada antes de entrar, e o arquivado abre direto no conteúdo.
   - A resposta provisória que a rodada tinha era a mesma: por data, com os dias como seção, porque 38 dos 44 itens são dos últimos 8 dias.
2. **Ele usa o filtro por repositório?** Sim, e ele é útil.
   - O que isso decide: o filtro continua na árvore e vale também no History, sem filtro próprio.
   - No History ele aparece como chip removível quando está ativo (`filtered`), para a lista nunca parecer incompleta sem motivo.

## Depois da crítica

A crítica está em `critique.md`. As decisões do coordenador aplicadas:

- os prompts ficam numa página, como revisão de `structure.md` §4;
- a página Appearance sai;
- `This machine` aparece só quando falta algo.

As nove condições:

1. **History na metade do monitor.** A linha mostra onde e o resultado em toda largura. A regra da linha do board escondia a meta entre 860 e 1040 px de lista, e agora a linha do History fica com as colunas até 860 px e passa à segunda linha abaixo disso. O `?audit` ganhou `historyMetaHidden`, que conta a meta escondida numa linha visível.
2. **O diálogo de board.**
   - **Add** tem três passos, com uma cena para cada: `add-1`, `add-2` e `add-3`. O passo 3 tem `Clone found`, dois clones, `Registered without a clone` e o de outro board.
   - `add-nostatus` é o board sem campo `Status`, em `Step 2 of 2`.
   - **Edit** tem dois passos (`edit-1` e `edit-2`) e `edit-reading`. Os status mostram uma opção que sumiu e uma nova. No passo 2, um repositório vai para No board e outro sai do MySpec.
   - **Back** e **Continue** andam dentro do mesmo diálogo. O salto para outro board acabou.
3. **O foco inicial.** O diálogo largo de criação começa no primeiro campo: a URL, a primeira caixa ou o filtro. As confirmações começam em **Cancel**.
4. **As notificações.** A tabela tem 55 textos, agrupados por task, review e discussão. Entraram:
   - o revisor, `worktree_unreadable`, as aprovações sem commit;
   - os checks e o conflito depois do review;
   - a pergunta, a permissão e o erro na PR, no review e na discussão;
   - o relatório ilegível e o modo Apply.

   `Publish failed` da discussão foi reescrito, e o título do review ficou marcado `changed`.
5. **Repositories.** **Needs a clone** vem primeiro, com o board de cada um. Os grupos seguem em ordem alfabética.
6. **Defaults lendo o catálogo.** As escolhas salvas ficam à vista, com o brilho de leitura, e o spinner saiu.
7. **Os exemplos de erro.** Todos são possíveis agora:
   - disco cheio ao salvar;
   - permissão negada ao abrir os dados;
   - a sessão que não parou, no aviso global, que passou a ser uma ação sem lugar próprio (**Pause**).
8. **`back-to-stage?v=pr`.** A task de fundo está no PR review, e a promessa sobre uma PR nova saiu.
9. **Os dados.**
   - As contagens de Repositories são derivadas do History: 22 tasks e 12 reviews arquivados.
   - A pasta de clones não escolhida já não convive com um clone em curso; o clonando ficou só no espécime.
   - O filtro de `acme/web` não deixa mais entrar a discussão de `api` e `gateway`.
   - O review aponta para um card que não é de outra task.

Os pontos médios e leves que também entraram:

- a navegação de Settings fica à esquerda na metade do monitor, e o limite desceu para 820 px;
- o vazio de Repositories sem o `◇` e sem a ação repetida;
- o grupo de uma linha sem cabeçalho, e o grupo `Steps` no lugar de `Implementation`;
- o modo de review salvando;
- **Remove…** desabilitado em tinta 4, com a razão abaixo;
- **Open the folder** fora do menu;
- a razão do botão desabilitado durante a varredura, e a contagem de pastas fora;
- o marco sem hora sem o `·` solto;
- o detalhe do encerramento pulado sem o ramo em checkout;
- o chip do filtro com um × que é botão;
- a lateral parada quando o início falha, e só os passos que bloqueiam;
- os três casos de `This machine`, com o comando copiável;
- o aviso de que `--force` apaga os arquivos;
- **Next that needs you** sem destino (`gone?v=nothing`);
- a prévia do apagamento que diz o que lê;
- `Deleting…` uma vez só;
- a interrupção do revisor também em Back e Discard;
- a pausa só na conversa do revisor.

Ficaram, anotados para a implementação:

- `←` e **Close** lado a lado, como decidido em `structure.md` §1;
- o History com muitos itens: a lista carrega os últimos 90 dias e busca os mais antigos quando a busca pede ou quando a rolagem chega ao fim; é uma proposta, e o dado já é local;
- no máximo três toasts empilhados, e o mais antigo sai.

A auditoria passou sem falhas nas 71 variações, a 1100, 1160, 1250, 1350, 1700 e 2560 px, nos dois temas: 852 verificações. O espécime não tem contraste abaixo de 4,5:1 nem controle sem nome.

## Decisão

Aprovada em 2026-09-25. Ver `design/decisions.md`. O documento é `design/screens/rest.md`.
