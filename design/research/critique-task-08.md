# Crítica da task 8 · Publicação em cadeia (PR #79)

Primeira leitura da branch `55-redesign-8-chained-publication-of-drafts` em `7f68639` (6 commits, 60 arquivos, CI verde), na worktree de revisão. A régua é:

- `design/tasks/08-chained-publication.md` (o material; `08:N` é a linha N dele);
- `screens/discussion.md` §5.3, §6, §8 e §11;
- `structure.md` (as linhas 123–124 da árvore), `principles.md`, `system/components.md` e `system/tokens.css`;
- `changes.md` D3, D5, D13, D15 e D16, e `backend.md` M2 e P26;
- `decisions.md` (2026-09-29, "Discussão: o que a entrada da task 8 decidiu").

O material não aponta mock: a tela da discussão é da task 9, e aqui o painel e a barra de hoje recebem só o mínimo (`08:9`, `08:240–253`). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** a regra está certa e é uma só. `chainOf` (`internal/discussionflow/chain.go`) dá a corrida, a ordem, o `hold`, o conjunto "não vai publicar", e `settle` (`state.go:149`) deriva dela o status, `Waiting`, `CanArchive` e a razão. Estão lá:
  - **Publish epic** fora do Go, dos bindings, de `lib/wails.ts`, do mock e de `store/actions.ts`, com `ErrNotReady` e `epicsRequested`;
  - a publicação antes do teste da conversa (`evaluate.go:35–39`);
  - a falha que segura só o que a alcança, e o **Retry** que limpa todas;
  - a aprovação que sai nas cinco edições e na revisão do agente, a recusa de agrupar um card de épico-rascunho e `ErrUntitled`;
  - a `0023`, as três situações com os corpos de `rest.md` §11 e o painel mínimo.
  - No app real, aprovar o último card de um épico disparou a cadeia no gesto, e a falha caiu no épico com `Approved · waits for the epic` nos cards. Descartar o épico que falhou limpou a falha e levou a `Epic discarded` ("No app real").
- **Mutações:** rodei 95; 86 morrem. Das nove que sobrevivem, três são equivalentes. As outras seis mostram provas que faltam, nenhuma de um pronto inteiro:
  - a ordem `publishing` antes de `publish_failed` no status;
  - "o primeiro pela posição" com dois épicos, nos dois métodos;
  - a falha só na memória limpa pela decisão;
  - o **Retry** que grava a memória de todos;
  - a contagem de `standingDetail` em `Ready to archive`.
  - À parte, a invariante do pronto 3 só morde em dois dos seus seis casos (item 2 de "Podem esperar").
- **O que falta fazer:**
  - a prova no GitHub do pronto 8, que o material põe nas mãos do usuário, não foi feita nem registrada, e o corpo da PR não tem a checklist;
  - `features.md:215` diz o contrário do código num caso (bloqueio 2).

São dois bloqueios. O 1 precisa do usuário. O 2 não pede decisão.

**Sobre as capturas.** Não existe `captures/55-…` no `origin`, e o corpo da PR não tem tabela de capturas. Não trato isso como um bloqueio à parte, como foi nas tasks 3 a 7. O material não tem mock nem prova pintada: o painel fica na forma antiga até a task 9 (`08:242`). As únicas capturas que ele pede são as do usuário nos passos 2, 3 e 5 da prova (`08:294`), e estão dentro do bloqueio 1. Para olhar a tela, fotografei o app real (veja "No app real").

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`, na worktree de revisão, todas verdes:

| Suíte | Resultado |
|---|---|
| `task check` (tidy, lint, typecheck, `test`, vuln, bindings) | verde em 91 s |
| `task test:go` (`gotestsum ./...`) | 3.053 testes, 1 pulado (`dnd`, dependente da máquina) |
| `task lint:go`, `task lint:web` (`biome ci .`, 695 arquivos), `task typecheck`, `task vuln`, `task tidy:check` | limpos |
| `task test:web` (`--changed`) | 5.942 testes em 277 arquivos |
| `vitest --project unit`, inteiro, numa cópia | 5.361 testes em 289 arquivos |
| `vitest --project painted`, inteiro, numa cópia com o browser na porta 63431 | 1.413 testes em 64 arquivos |
| `task bindings:check` | sem diff; `git status` limpo depois |

O CI da PR (run `37023540228`) tem **Changes**, **Go** e **Frontend** verdes, e **Build** pulado. A PR está `MERGEABLE` e `CLEAN`, com a cabeça em `7f68639`. O diff não toca:
- `.github/`, `Taskfile.yml`, `mise.toml`, `build/` nem `lefthook.yml`;
- `go.mod`, `go.sum`, `package.json` nem o lock;
- os configs do vite e do vitest, nem `design/system/tokens.css`.

`task check` não foi conferido commit a commit, só na ponta (pronto 9).

### Mutações

Cada mutação rodou numa cópia da worktree no scratchpad, desligada do git dela, só com os testes que ela alcança. Os do Go rodaram com `-count=1`, e os do frontend com `vitest --project unit` sobre `features/discussion`, `features/sidebar`, `lib/situations.test.ts` e `app`. "Falha (n)" é o número de testes que falharam.

| Pronto | Mutação | Onde | Resultado |
|---|---|---|---|
| 1 | O épico sem **precisa antes** | `internal/discussionflow/chain.go:165` | falha (3) |
| 1 | `inside` ignora a aprovação | `chain.go:173` | sobrevive (equivalente: um card sem decisão fecha o portão, e um descartado já sai em `dependencies`) |
| 1 | O épico com um card aprovado basta | `chain.go:210` | falha (7) |
| 1 | O portão ignora card sem decisão | `chain.go:203` | falha (3) |
| 1 | O épico começado não passa o portão | `chain.go:195` | falha (2) |
| 1 | `ok` ignora a falha | `chain.go:220` | falha (5) |
| 1 | `goes` ignora o fecho | `chain.go:227` | falha (15) |
| 1 | `goes` ignora a própria falha | `chain.go:226` | falha (13) |
| 1 | "Não vai publicar" só com a raiz, sem o fecho | `chain.go:82` | falha (3) |
| 1 | `epic_discarded` só no aprovado | `chain.go:247` | falha (2) |
| 1 | `left` com um a mais | `chain.go:269` | falha (2) |
| 1 | `cards` sem os descartados | `chain.go:272` | falha (5) |
| 1 | Sem o `hold` `epic` | `chain.go:275` | falha (5) |
| 1 | O `hold` `draft` com o id | `chain.go:281` | falha (9) |
| 1 | Dependência num descartado mantida | `chain.go:146` | falha (4) |
| 1 | Dependência `Dropped` mantida | `chain.go:142` | sobrevive (equivalente: uma dependência de rascunho só cai quando o alvo foi descartado ou o dependente já foi escrito) |
| 1 | O card ignora o épico descartado no portão | `chain.go:193` | sobrevive (equivalente: `open` do épico descartado já é falso) |
| 4 | `Waiting` conta a corrida | `state.go:189` | falha (4) |
| 4 | `deciding` antes de `epic_discarded` | `state.go:197` | falha (4) |
| 4 | `epic_cant_publish` antes de `deciding` | `state.go:199` | falha (2) |
| 4 | O instante antes da corrida em `Waiting` | `state.go:203` | falha (13) |
| 4 | `ready_to_archive` como padrão | `state.go:205` | falha (13) |
| 4 | `publish_failed` antes de `publishing` no status | `state.go:189–192` | **sobrevive** |
| 1 | **Archive** ignora "não vai publicar" | `state.go:241` | falha (6) |
| 1 | **Archive** sem a razão do épico | `state.go:237` | falha (6) |
| 1 | **Archive** durante a corrida | `state.go:234` | falha (3) |
| 1 | A razão `approve one more` trocada | `state.go:43` | falha (3) |
| 4 | `DiscardedEpic` conta os sem decisão | `state.go:135` | falha (2) |
| 4 | `DiscardedEpic` pelo último épico | `state.go:139` | **sobrevive** |
| 4 | `ShortEpic` pelo último épico | `state.go:119` | **sobrevive** |
| 7 | `Publishing` por rascunho sempre falso | `state.go:223` | falha (1) |
| 2 | A publicação só com a conversa aberta | `evaluate.go:39` | falha (1) |
| 2 | `Decide` sem a recusa do começado na memória | `decide.go:14` | falha (1) |
| 2 | `Decide` mantém a falha que só a memória guarda | `decide.go:20` | **sobrevive** |
| 2 | **Retry** limpa só a falha clicada | `decide.go:149` | falha (1) |
| 2 | **Retry** grava só a memória do clicado | `decide.go:146` | **sobrevive** |
| 2 | `Decide` sem `Check` | `decide.go:26` | falha (29) |
| 2 | O fim da corrida sem `Check` | `publish.go:203` | falha (2) |
| 3 | Sem `ErrUntitled` | `internal/discussion/service.go:460` | falha (1) |
| 3 | A decisão mantém a falha | `service.go:464` | falha (3) |
| 3 | O repositório sem retirar | `service.go:315` | falha (3) |
| 3 | O repositório igual também retira | `service.go:315` | falha (2) |
| 3 | `SetDraftEpic` sem os dois épicos | `service.go:365` | falha (5) |
| 3 | `SetDraftEpic` sem o card | `service.go:370` | falha (4) |
| 3 | Acrescentar dependência sem retirar | `service.go:423` | falha (2) |
| 3 | Tirar dependência sem retirar | `service.go:446` | falha (4) |
| 3 | Agrupar sem retirar | `service.go:497` | falha (1) |
| 3 | Agrupar aceita card de épico-rascunho | `service.go:527` | falha (1) |
| 3 | `unapprove` mantém a falha | `service.go:813` | falha (3) |
| 3 | `unapprove` num começado | `service.go:809` | falha (1) |
| 3 | `SetDraftEpic` aceita um card começado | `service.go:348` | falha (1) |
| 3 | O texto retira a aprovação | `service.go`, `SetDraftText` | falha (2) |
| 3 | Sem `unapproveMoved` | `internal/discussion/reconcile.go:35` | falha (6) |
| 3 | O épico ignora os cards mudados | `reconcile.go:218` | falha (4) |
| 3 | O card ignora as dependências mudadas | `reconcile.go:216` | falha (2) |
| 3 | O card ignora o épico mudado | `reconcile.go:216` | falha (3) |
| 4 | `ready_to_archive` fora de `closing` | `internal/attention/situation.go:66` | falha (1) |
| 4 | `epic_cant_publish` em `closing` | `situation.go:66` | falha (1) |
| 4 | A situação pelo `Status` | `attention/derive_discussion.go:33` | falha (2) |
| 4 | O corpo de um card vira o de nenhum | `attention/text.go:225` | falha (2) |
| 4 | `two more` vira `one more` | `text.go:229` | falha (2) |
| 4 | `Epic discarded` no singular errado | `text.go:236` | falha (2) |
| 4 | `Ready to archive` sem a segunda frase | `text.go:245` | falha (2) |
| 6 | `DraftHold` sem `title`, sem `left`, sem `cards` | `internal/bindings/convert.go:2079` | falha (3), falha (3), falha (2) |
| 6 | Sem a frase de `ErrUntitled` | `bindings/task_service.go:952` | falha (1) |
| 5 | A `0023` também nas arquivadas | `internal/store/migrations/0023_discussion_chain.sql:8` | falha (1) |
| 5 | A `0023` mantém a falha | `0023:6` | falha (1) |
| 5 | A `0023` também nos começados | `0023:7` | falha (1) |
| 5 | A `0023` também nos cards | `0023:7` | falha (1) |
| 5 | A `0023` também nos descartados | `0023:7` | falha (1) |
| 7 | `1 more cards` | `features/discussion/discussion-status.ts:108` | 1 falha |
| 7 | `epic_short` sem `a of b` | `discussion-status.ts:112` | 2 falham |
| 7 | Sem `the epic has no cards` | `discussion-status.ts:111` | 1 falha |
| 7 | O texto de `epic` trocado | `discussion-status.ts:114` | 2 falham |
| 7 | `epic_discarded` sem a tinta forte | `discussion-status.ts:125` | 2 falham |
| 7 | `1 of 1 cards` | `discussion-status.ts:134` | 2 falham |
| 7 | `approve one more` sempre | `discussion-status.ts:136` | 1 falha |
| 7 | `Epic discarded` com um card no plural | `discussion-status.ts:143` | 2 falham |
| 7 | `0 published` no lugar de `nothing` | `discussion-status.ts:149` | 1 falha |
| 7 | O ponto de encerramento no tom de espera | `discussion-status.ts:98` | 2 falham |
| 7 | A barra sem `Publish failed` durante a corrida | `discussion-status.ts:53` | 1 falha |
| 7 | `Ready to archive` no tom `idle` | `discussion-status.ts:68–69` | 2 falham |
| 7 | O rótulo `Epic can't publish` trocado | `discussion-status.ts:39` | 2 falham |
| 7 | `standingDetail` conta todos os rascunhos como publicados | `discussion-status.ts:181` | **sobrevive** |
| 7 | A barra sem o meio, e sem o `title` | `DiscussionBar.tsx:29`, `:30` | 3 falham, 3 falham |
| 7 | O cartão sem o `hold`, e sem a tinta forte | `DraftCard.tsx:224`, `:228` | 5 falham, 2 falham |
| 7 | A árvore sem `nothing`, a curta trocada, `Epic` sozinho | `features/sidebar/sidebar-tree.ts:466`, `:467`, `:459` | 2, 3 e 1 falham |
| 7 | `situationLabel` de `ready_to_archive` e de `epic_discarded` | `lib/situations.ts:120`, `:118` | 2 falham, 2 falham |

As seis que importam:
- **`publish_failed` antes de `publishing` no status.** Com a troca, a pílula, o cartão e a árvore diriam `Publish failed` durante a corrida dos independentes, e não `Publishing`, contra a ordem de `08:140–151` (linhas 2 e 3). Nenhum teste põe uma corrida em curso com uma falha de pé. `discussionBarLabel` (`discussion-status.ts:51`) existe justamente por causa dessa ordem.
- **O primeiro épico pela posição** (`08:155`, `discussion.md` §8). Nenhum caso tem dois épicos em `epic_short` ou dois descartados com cards aprovados, e `ShortEpic` e `DiscardedEpic` pelo último passam.
- **A falha que só a memória guarda, limpa pela decisão** (`08:184`, `08:199`). Tirar `s.dropUnrecorded(id, draftID)` (`decide.go:20`) não quebra nada. Com isso, o rascunho decidido continuaria com a falha da memória por cima da escrita limpa.
- **O Retry grava a memória de todos** (`08:198`). Com só o clicado, a outra falha guardada na memória fica de pé depois do **Retry**, e o teste de duas falhas (`publish_test.go:416`) só usa falhas gravadas no banco.
- **`standingDetail` em `Ready to archive`.** O teste (`discussion-status.test.ts:343`) só tem rascunhos publicados, então contar todos dá o mesmo número. Um descartado na fixture pegaria.

À parte, rodei as mutações do pronto 3 só contra a invariante (`TestNoEditPutsADraftInTheRun`, `internal/discussionflow/chain_edit_test.go:95`). Sobrevivem:
- sem `unapproveMoved` (a revisão do agente);
- agrupar sem retirar;
- o repositório sem retirar;
- `SetDraftEpic` sem o card.

Morrem só a do épico que o card deixa e a da dependência retirada. Cada retirada está provada em `service_test.go` e `reconcile_test.go` (a tabela acima). Mas a invariante, que `08:214` chama de "a garantia", não morde no caso do agente (item 2 de "Podem esperar").

### Capturas

Nenhuma na PR, e nenhuma pedida fora do pronto 8 (veja o veredito). As que tirei do app real estão em "No app real".

## Bloqueiam o merge

1. **A prova no GitHub do pronto 8 não foi feita nem registrada.**
   - `08:41` e `08:278–300` pedem um ponto de parada depois do step 4. O usuário roda o binário da branch sobre diretórios vazios, só com o board `Pessoal`, e publica um épico com dois cards pelo roteiro exato. O implementador registra na PR os três links, as capturas dos passos 2, 3 e 5 e as linhas `discussion draft published` do log.
   - A PR tem os 6 commits dos steps 1 a 4 e uma correção, e o corpo não fala da prova.
   - O corpo diz `The chain's state is persisted, so a pending publication survives a restart.` Isso não é o que o código faz. Nada novo é gravado: a cadeia é recalculada das decisões gravadas, e o `Sync` a publica (`sync.go:32`, `08:189`).
   - **Pede o usuário.** O roteiro pausa a task 8 no MySpec instalado, fecha o app e escreve três issues no board dele (`08:280`). Daqui nada disso pode ser feito.
   - **Mudar:**
     - pôr no corpo uma checklist `## Verification on the target machine` com o roteiro de `08:282–300`: preparar, os passos 1 a 6, o que é criado e a limpeza;
     - acertar a frase sobre o estado gravado;
     - o usuário roda o roteiro, e o implementador registra o resultado na PR.

2. **`features.md:215` diz o contrário do código.**
   - O texto: `Um rascunho que falhou antes de o GitHub receber qualquer coisa pode ser descartado ou ter a decisão desfeita, e o que dependia dele segue sem a dependência, com o aviso`.
   - Isso vale só para o descarte. Desfeita a decisão, o rascunho fica sem decisão e ainda é uma dependência: `dependencies` (`chain.go:139`) só deixa de lado o descartado. O dependente fica `Approved · waits for <título>`, como `08:199` diz ("quando ele foi descartado").
   - `CLAUDE.md` não dá uma mudança por pronta enquanto a documentação a contradiz.
   - **Mudar:** "pode ser descartado, e o que dependia dele segue sem a dependência, com o aviso, ou ter a decisão desfeita, e o que dependia dele espera por ele".
   - Não pede decisão.

## Podem esperar

Em ordem de gravidade.

1. **O meio da barra fica fora da região viva.**
   - `role="status"` com `aria-live` envolve só o ponto e o rótulo (`DiscussionBar.tsx:21–28`). O meio, que é a saída (`1 of 3 cards approved · approve one more, or discard the epic`), é um irmão sem papel (`:29–33`).
   - Um leitor de tela ouve `Epic can't publish` e não ouve o que fazer. Quando a contagem muda e o rótulo não, nada é anunciado.
   - Cortado, o texto inteiro só existe no `title` de um `span` que não recebe foco.
   - `08:249` manda manter o `role="status"`, mas não diz onde fica o meio. `discussion.md` §8 diz que "o texto de estado é `role="status"`".
   - **Mudar:** pôr o meio dentro do `span` de status, ou ligar o meio ao status por `aria-describedby`.

2. **A invariante do pronto 3 não morde onde mais importa.**
   - Os seis casos de `chain_edit_test.go:104–166` partem de nada na corrida (`:179`). Em quatro, nada entraria na corrida mesmo sem a regra (veja "Mutações").
   - O caso do agente (`:155`) tira o épico de `in-two`, que volta `fresh` e sem decisão. Com isso o épico continua com um card sem decisão (`in-three`), e `unapproveMoved` não faz diferença.
   - O caso que morde é outro: o agente apaga do artefato o card sem decisão de um épico com os outros dois aprovados. Sem `unapproveMoved`, o épico iria para a corrida sem gesto.
   - **Mudar:** trocar o caso do agente por esse. Para agrupar e para o repositório, dizer no teste que estão lá pela tabela, porque não podem mudar a corrida.

3. **As seis mutações que sobrevivem** (veja "Mutações"). Um caso cada:
   - uma corrida em curso com uma falha de pé, com `Status` `publishing` e `Waiting` `publish_failed`, em `chain_test.go` ou `status_test.go`;
   - dois épicos em `epic_short`, e dois descartados com cards aprovados, com o corpo da notificação do primeiro;
   - a decisão sobre uma falha só na memória (`decide_test.go`);
   - um **Retry** com duas entradas na memória;
   - um descartado na fixture de `standingDetail` em `Ready to archive`.

4. **A árvore não diz `Publishing` durante uma corrida com uma situação de pé.**
   - `08:155` diz que "o status é o que a pílula, o rascunho e o spinner da árvore dizem". `discussion.md` §8 diz que "a pílula e a árvore dizem publishing pelo spinner".
   - `buildRow` (`features/sidebar/sidebar-tree.ts:716–726`) troca o tom e a linha pelos da situação. Assim, durante a corrida dos independentes, a linha diz só `Publish failed`, ou `Decide drafts · 2/4`, sem sinal de que algo está sendo escrito.
   - A pílula diz `Publishing` (`DiscussionHeader.tsx`, pelo status).
   - Pode ficar para a task 9, que reescreve a linha com a rodada. Se ficar, que `09` registre.

5. **Os cards aprovados de um épico descartado ficam a 60%.**
   - `EpicGroup.tsx:23` põe `opacity-60` no grupo inteiro. São exatamente os cards de que a situação `Epic discarded` pede uma saída.
   - Medido sobre `--surface-1`:
     - a razão em `--ink-1` 500 fica com 4,72:1 (claro) e 6,07:1 (escuro) e passa;
     - os rótulos, os campos e a decisão em `--ink-3` ficam com 2,80:1 e 3,69:1 e falham 4,5:1;
     - no cartão do próprio épico, a 36% somando as duas opacidades, ficam com 1,77:1 e 2,13:1.
   - `08:247` manda manter "a opacidade do descartado", e ela já existia. Por isso não bloqueia.
   - **Opinião:** a opacidade cabe ao cartão do épico, não aos cards aprovados que ele deixa de pé. A task 9 apaga o `EpicGroup`, e vale levar isso a ela.

6. **O épico descartado perdeu o `Discarded` em texto.**
   - O rodapé saiu inteiro (`EpicGroup.tsx`, `08:247`). O material diz que o `Discarded` "já está no cartão do épico (a decisão pressionada e o canto de estado)".
   - O canto de estado (`DraftCard.tsx:193–233`) não diz `Discarded`: sobram o **Discard** pressionado (`aria-pressed`) e a opacidade. No app, o cartão do épico descartado não tem texto de estado (captura `03-d2.png`).
   - É igual aos cards, que nunca tiveram o texto, e `discussion.md` §5.3 traz `Discarded` para a task 9. A régua (`08:247`) está imprecisa.

7. **A régua se contradiz sobre o rótulo da barra.**
   - `08:249` diz "O rótulo segue o status (`Publishing` durante uma corrida)". `08:197` e D16 dizem que a barra diz `Publish failed` "inclusive durante as corridas dos independentes".
   - O código seguiu `08:197` só para a falha (`discussionBarLabel`, `discussion-status.ts:51`, commit `9b72d6a`), e com as outras situações a barra diz `Publishing` com o meio da situação. Está certo.
   - **Mudar:** em `08:249`, "o rótulo segue o status, menos a falha de pé, que a barra diz durante a corrida". `features.md` §A discussão como item não diz isso da barra, e pode dizer.

8. **`features.md:197` fala do que saiu.** `Não há botão: a decisão que completa a condição…` só faz sentido para quem conheceu o **Publish epic**. Basta "A decisão que completa a condição … publica".

9. **`standsAlone` saiu, contra `08:338`** ("`standsAlone` e `orderTargets` ficam"). `epicOf` (`chain.go:128`) faz o papel dele, e nada mais o usava. Não muda comportamento. Fica registrado para a task 9, que lê o material.

10. **O `design-critic` do step 4 sozinho** (`08:481`) não deixou registro. Esta leitura cobre a branch inteira.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | Ok | `chain_test.go:80` tem os 29 casos de `08:349–377`, com 2b, 19b, 29a e 29b, por `ChainOf` (`export_test.go`), que passa por `settle`, a mesma função do estado. O caso 26 do material é a linha 1 do teste. 32 mutações da regra e do estado morrem; das três de `chain.go` que sobrevivem, as três são equivalentes |
| 2 | Ok, com ressalva | Os treze cenários estão em `publish_test.go:371–468` e `decide_test.go`, contra o `memGH`, com as chamadas de `createIssue` contadas no **Retry** (`publish_test.go:409`). Morrem a conversa fechada, a recusa do começado na memória, o **Retry** de uma falha só e o `Check` do fim da corrida. O "reinício" é um `Sync` no mesmo serviço, não um serviço novo sobre o mesmo banco. Sobrevivem a falha só na memória e o **Retry** da memória de todos (item 3) |
| 3 | Ok, com ressalva | `service_test.go:693` (a tabela, com "e nenhuma outra": texto, módulo, o mesmo repositório e o mesmo épico mantêm), `:787`, `:809` e os de título, falha e agrupar, e `reconcile_test.go`. As 19 mutações morrem. A invariante existe, mas só morde em dois casos (item 2) |
| 4 | Ok, com ressalva | `derive_discussion_test.go:89` e `status_test.go`. Morrem a situação pelo `Status`, os grupos e os corpos. Sobrevivem a ordem do status com a falha e "o primeiro pela posição" (item 3) |
| 5 | Ok | `migrate_test.go`, `TestTheChainMigrationTakesBackTheApprovalOfAnEpicNeverStarted`; as cinco mutações da `0023` morrem |
| 6 | Ok | `convert_test.go` cobre as cinco razões; `TestApprovingADraftWithoutATitleGetsItsSentence`; o teste de **Publish epic** saiu. Uma busca por `PublishEpic` e `publishEpic` em `internal/`, `frontend/bindings` e `frontend/src` não acha nada |
| 7 | Ok, com ressalva | `discussion-status.test.ts`, `DraftCard.test.tsx`, `EpicGroup.test.tsx`, `DiscussionBar.test.tsx`, `DiscussionHeader.test.tsx`, `situations.test.ts` e `sidebar-tree.test.ts` (com o `Ctrl+J` de `Ready to archive` por `nextWaiting`). 26 de 27 mutações morrem; sobra a contagem de `standingDetail` (item 3) |
| 8 | **Falha** | Não feito nem registrado (bloqueio 1) |
| 9 | Ok na ponta | `task check` verde em `7f68639`; não conferido step a step. Os testes de `decide_test.go` que saíram no step 4 (`9257fb4`) falam da regra antiga e foram substituídos pelas linhas de `chain_test.go` e pelos cenários de `publish_test.go` no mesmo commit |
| 10 | Ok, com uma contradição | `overview.md` §A discussão, `features.md` §Rascunhos de cards, §Épico, §Aprovar e publicar, §A discussão como item, §Depende de mim e `troubleshooting.md` estão no presente e batem com o código, menos `features.md:215` (bloqueio 2) e o resto de história em `:197` (item 8) |
| 11 | Esta crítica | O registro do step 4 sozinho não existe (item 10) |
| 12 | Ok | `gh pr checks 79` verde; `MERGEABLE` e `CLEAN` |

## O que saiu

- **`PublishEpic`**, `ErrNotReady`, `epicsRequested`, `forgetEpicOf`, `requestEpic`, `epicRunOf` e `epicRun` (`decide.go`, `discussionflow.go`), com `DiscussionService.PublishEpic`, o binding gerado, `api.publishEpic`, a ação e o mock.
- **De `publish.go`:** `dueTargets`, `looseDue`, `epicDue` e `standsAlone` (item 9).
- **De `state.go`:** `waits`, `epicReady`, `epicSettled`, `epicWaits` e as `hint…` do épico.
- **No DTO e no mock:** `Draft.waits`, `canPublish` e `hint`.
- **`waitsLabel`**, o texto âmbar `Waits for` e a `hint` dos cards.
- **O rodapé do `EpicGroup`**, com **Publish epic**, a `hint`, o erro, o `Discarded` e o link do resultado; o link continua no canto de estado do cartão do épico.
- **O status `published`** e, na árvore, o tom `archive`.

Nada importa o que saiu, e o `typecheck`, o lint e os bindings passam.

**Comportamento fora de `changes.md`**, todos ditos no material ou consequência direta dele:
- **A publicação não espera a conversa** (`08:186`, §4.3 #14). Uma discussão sem sessão, ou com a sessão fechada, publica na avaliação do `Sync`.
- **Tudo descartado é `Ready to archive`**, e não `Discussing` (§4.3 #10).
- **Durante a corrida, a barra diz `Publish failed` com uma falha de pé**, e `Publishing` com as outras situações (item 7).
- **`SetDraftEpic` grava até três rascunhos numa escrita** (`service.go:338–380`) e recusa o card começado antes de olhar o valor.

## Tokens e contraste

**Nenhuma cor, duração ou tamanho solto** no diff onde há token, e `tokens.css` não muda. As classes novas são `text-xs`, `text-muted-foreground` (`--ink-3`), `text-foreground` (`--ink-1`) e `font-medium`. O cartão não tem fundo próprio: o texto fica sobre `--surface-1` (`DiscussionView.tsx:38`, `bg-background`).

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css` (claro / escuro):
- o meio da barra e o rótulo (`--ink-3` sobre `--surface-1`): 7,19 / 8,05;
- o `hold` esmaecido (`Approved · waits for the epic`, `… 2 more cards …`), também `--ink-3` sobre `--surface-1`: 7,19 / 8,05;
- o `hold` forte (`epic_short` e `epic_discarded`, `--ink-1` 500): 17,86 / 15,02;
- dentro do grupo de um épico descartado (`opacity-60`):
  - `--ink-1`: 4,72 / 6,07;
  - `--ink-3`: 2,80 / 3,69 (falha; item 5);
  - no cartão do épico, a 36%: 1,77 / 2,13.

**Não texto:** o ponto `done` de `Ready to archive` (`--state-close` sobre `--surface-1`) tem 5,59 / 9,45; o de espera, 6,11 / 10,49.

**Estado sem cor como único portador:** o ponto sempre vem com o rótulo (`Epic can't publish`, `Ready to archive`), o `hold` é texto, e a falha é texto com **Retry**. A exceção é o épico descartado, que não diz `Discarded` em texto (item 6).

## No app real

**Como rodou:**
- `task build` numa cópia em `7f68639`;
- `bin/myspec` com `HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CONFIG_HOME` e `XDG_CACHE_HOME` no scratchpad, sob `env -i`, sem `DISPLAY` nem `WAYLAND_DISPLAY`;
- `dbus-run-session --config-file` com um barramento próprio, sem ativação de serviços, e `GTK_A11Y=none`;
- `XDG_RUNTIME_DIR` em `/tmp/c79rt`, pelo limite de 108 bytes do socket;
- `GDK_BACKEND=broadway` (`gtk4-broadwayd :21`, porta 8101), dirigido por um Chromium headless do Playwright.

**Sem `GH_TOKEN`, de propósito.** O app não achou `gh` nem `claude` no `PATH` desse ambiente (`pull requests reading failed: gh isn't on the PATH`, `claude: executable not found`), e preferi deixar assim. Uma cadeia disparada não teria como escrever no GitHub. Nada foi escrito. O app, o barramento e o broadwayd foram encerrados pelo PID, e `/tmp/c79rt` foi apagado.

**Os dados:** com o banco criado pela primeira abertura (`schema_version: 23`, `0023_discussion_chain.sql` aplicada), gravei com `sqlite3` um board e cinco discussões ativas, cada uma num estado:
- `Invoice export`: épico aprovado, um card aprovado, outro descartado;
- `Audit trail`: épico descartado, dois cards aprovados e um solto que depende de um deles;
- `Billing fixes`: um publicado e um descartado;
- `Onboarding`: épico e um card aprovados, dois sem decisão;
- `Search`: um solto com falha e um dependente aprovado.

Nenhuma ia na corrida, e o app abriu sem publicar nada.

**O que o app mostrou** (capturas em `scratchpad/shots/`, fora do repositório):
- **A árvore:**
  - `Epic can't publish` e `Epic discarded` em âmbar com o chip;
  - `Ready to archive` com o anel e o chip verdes (a forma curta, na largura padrão);
  - `Decide drafts · 2/4`;
  - `Publish failed` em vermelho com `Ctrl J` (`00-home.png`).
- **`Epic can't publish`:**
  - a pílula e a barra com `1 of 2 cards approved · approve one more, or discard the epic`;
  - o épico e o card com `Approved · the epic needs two approved cards · 1 of 2` em tinta forte;
  - o tooltip do **Archive** com `The epic can't publish: approve one more card, or discard the epic.` (`01-d1.png`, `02-d1-archive.png`).
- **`Epic discarded`:** `2 approved cards of it won't publish · approve the epic again, or discard them` e `The epic is discarded · this card won't publish`, com o grupo a 60% (`03-d2.png`, `04-d2-scroll.png`).
- **`Ready to archive`:** o ponto verde e `1 published · or ask the agent for more cards below` (`05-d3.png`).
- **`Approved · waits for 2 more cards of the epic to be decided`**, esmaecido, no épico e no card (`06-d4.png`).
- **A falha:** a razão em vermelho com **Retry** no cartão (`07-d5.png`).
- **A cadeia no gesto:** aprovar o card descartado de `Invoice export` disparou a corrida na hora (`publish discussion draft failed`, `draft: inv-epic`). A falha da consulta caiu no primeiro alvo, o épico. Os dois cards passaram a `Approved · waits for the epic`, e a barra, a pílula e a árvore a `Publish failed` (`12-d1-approve.png`, `13-d1-after.png`). No log, `epic_cant_publish` terminou e `publish_failed` começou com `notified: false`, o gesto com a janela em foco.
- **Descartar o épico que falhou antes de escrever** limpou a falha e levou a discussão a `Epic discarded` com `2 approved cards of it won't publish …` (`15-d1-discard-epic.png`).
- Nenhum `ERROR` no log além da publicação recusada de propósito. Os `WARN` são do ambiente: o portal do tema, o `gh` e o `claude`.

**O que o app não mostrou:**
- **Uma publicação que escreve de verdade:** a ordem épico, card 1, card 2 com as sub-issues, a notificação `Every draft is published or discarded. The discussion is ready to archive.` que chega com a janela fora de foco, `3 published`, o `Ctrl+J` e **Archive**. É o pronto 8, que escreve no GitHub e é do usuário (bloqueio 1).
- **A discussão com o agente:** a revisão do agente que retira a aprovação e o rascunho que falhou e volta `fresh`. Pedem as credenciais do `claude`. Cobrem `reconcile_test.go` e `decide_test.go`.
- **A `0023` sobre um banco anterior a ela:** o banco nasceu na versão 23. Cobre `migrate_test.go`, e o banco do usuário não tem discussão ativa (`08:423`).
- **O tema escuro:** o botão do rodapé não trocou o tema no Broadway. Os contrastes do escuro acima são calculados dos tokens, não medidos na tela.

## Segunda leitura (109b763)

Só as correções `7f68639..109b763` (10 commits, 11 arquivos), na mesma worktree; o app não rodou. As mutações rodaram numa cópia da ponta no scratchpad, com `-count=1`; a barra foi medida no Chromium do projeto `painted`, numa cópia, com o browser na porta 63447.

### Veredito

**Corrigir antes do merge.** As correções fecham o que prometem, e as sete mutações morrem. Mas a leitura achou um teste instável da própria PR, que deixa o CI vermelho em cerca de uma corrida a cada oito. Corrigido ele, o que sobra é **mergear depois do roteiro do usuário** (bloqueio 1).

| Bloqueio / item | Situação | Evidência |
|---|---|---|
| Bloqueio 1, a frase do estado | Fechado | O corpo da PR diz `Nothing new is stored for the chain: it is worked out again from the recorded decisions, so a publication left pending is sent by Sync when the app opens again`, o que bate com `sync.go:31–33` |
| Bloqueio 1, a checklist | Pronta, falta o usuário | `## Verification on the target machine` tem os quatro passos de preparar, os passos 1 a 5 com os textos exatos de `08:288–292`, o que é criado, os três links, as capturas dos passos 2, 3 e 5, as linhas `discussion draft published` do `myspec.log`, a falha no meio e a limpeza. Faltam só duas frases sem efeito no roteiro: "o Claude Code e o `gh` são os do usuário, já com login" (`08:284`) e "o que já foi criado fica" (`08:298`). Tudo desmarcado |
| Bloqueio 2, `features.md:215` | Fechado | "pode ser descartado, e o que dependia dele segue sem a dependência, com o aviso, ou ter a decisão desfeita, e o que dependia dele espera por ele", como `dependencies` (`chain.go:139`) |
| Mutação: `publish_failed` antes de `publishing` no status | Morre (2) | `chain_test.go:308` (29c) |
| Mutação: `ShortEpic` pelo último épico | Morre (2) | `attention/derive_discussion_test.go:186` |
| Mutação: `DiscardedEpic` pelo último épico | Morre (2) | `derive_discussion_test.go:192` |
| Mutação: a decisão mantém a falha que só a memória guarda (`decide.go:20`) | Morre (1) | `decide_test.go:292` |
| Mutação: o **Retry** grava só a memória do clicado (`decide.go:146`) | Morre (1) | `publish_test.go:439`, que conta um `createIssue` por card |
| Mutação: `standingDetail` conta todos os rascunhos (`discussion-status.ts:181`) | Morre (1) | `discussion-status.test.ts:343`, com um descartado na fixture |
| Mutação: sem `unapproveMoved`, só contra a invariante | Morre (2) | `chain_edit_test.go:159`; contra os quatro pacotes, morre (8) |
| Podem esperar 1: o meio dentro do `role="status"` | Fechado | `DiscussionBar.tsx:22–39`. Pôr o meio de volta como irmão faz falhar os três casos de `DiscussionBar.test.tsx:74`. O texto do status é `Ready to archive 2 published · …` |
| Podem esperar 2: o caso do agente | Fechado | Veja a mutação acima. O repositório e agrupar dizem em comentário (`chain_edit_test.go:125`, `:147`) que estão lá pela tabela |
| Podem esperar 7: o rótulo da barra | Fechado | `08:249` e `features.md:242` batem com `discussionBarLabel` (`discussion-status.ts:51–57`) |
| Podem esperar 8: `features.md:197` | Fechado | Sem "Não há botão" |
| `task check` na ponta | Verde | 72 s, 3.058 testes Go e 5.942 web, bindings sem diff |
| `gh pr checks 79` | Verde | Run `37028231008`: **Changes**, **Go** e **Frontend** passam, **Build** pulado; a PR está `MERGEABLE` e `CLEAN` em `109b763` |

**A barra não muda de desenho.** Nos dois temas, a 1000, 420 e 260 px, a versão nova e a de `7f68639` dão:
- 40 px e uma linha;
- o rótulo inteiro, de x 12 a 118, e o meio a partir de x 126, com a mesma largura;
- o mesmo corte com `ellipsis` e `title`;
- a mesma cor (`--ink-3`).

Só muda quando há também o aviso do artefato ilegível: o meio encolhe mais (84 px contra 117 a 420 px). Isso não acontece no app, porque `standing` (`state.go:191`) põe `Waiting for the drafts` antes das três situações que têm meio.

**`evaluate_test.go:207` é estável:** passa com `-count=10` sozinho, e com `-race -count=20` junto dos quatro testes novos.

### Bloqueia o merge

**3. `TestACardThatLeavesAnEpicTakesBackTheApprovalOfTheEpicAndOfItself` (`decide_test.go:105`) é instável sob `-race`.**
- **O que acontece:** com `go test -race -count=10 ./internal/discussionflow/`, falhou em 5 de 40 repetições, sempre em `decide_test.go:119`, com `set the epic of a card: … wait for the publication to finish`. Sem `-race`, 0 de 60. O CI roda `task test:go -- -race` uma vez (`ci.yml:132`).
- **A causa:** a premissa do comentário em `:111–112` ("a conversa fechada, para que nada publique") é falsa desde `08:186` e `evaluate.go:38`. Aprovar o quarto rascunho fecha o épico, e o `Check` (`discussionflow.go:170`) dispara a corrida numa goroutine. Quando ela pega o lock antes do `SetDraftEpic`, ele recebe `ErrPublishing` (`decide.go:99`).
- **Prova:** na cópia, com `f.approveQuietly` nas quatro aprovações, o pacote passou 40 de 40 sob `-race`, e o teste continua provando o que diz.
- **Origem:** o teste nasceu no step 4 (`75d2a44`), e as correções não o tocaram. A primeira leitura não o pegou.
- **Mudar:** aprovar sem a avaliação (`approveQuietly`) e tirar o comentário. Não pede decisão.

### Sobra aberto

- **Bloqueio 1:** o roteiro do usuário, e o registro na PR dos links, das capturas e das linhas do log.
- **Para a task 9, por decisão:** os itens 4, 5, 6, 9 e 10 de "Podem esperar". `09` já cobre o 6, com o `Discarded` do cartão (`09:207`), o 5, ao tirar o `EpicGroup` (`09:472`, `:587`), e o 4, que decide a situação de pé durante a corrida (`09:126`). O 9 e o 10 são só registro.

### Docs

Os trechos tocados estão no presente, sem história, e batem com o código: `features.md:197`, `:215` e `:242`, `08:249` e `discussion.md:270`.
