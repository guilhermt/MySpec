# Task 8 · Publicação em cadeia

Material de entrada da oitava task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 8 de `design/implementation.md` (§2, linhas 127–137), com os princípios da §1 (9–22) e os riscos da §3 (185–196). Os caminhos de código Go são relativos à raiz; os do frontend, a `frontend/src/`.

**Base.** A task parte da `main` depois do merge das tasks 4 a 7 e não corre em paralelo com nenhuma (§6). Nenhuma das quatro toca `internal/discussion`, `internal/discussionflow` nem `attention/derive_discussion.go`: as linhas de Go citadas são as da `main` em `0c783b3`. No frontend da discussão, a task 4 (`c55a417`, `origin/51-redesign-4-task-screen-ii-the-conversation-the-ask-bar-and`) troca o compositor de `DiscussionView.tsx`, mexe em `ArchivedDiscussionView.tsx` e no teste dele, em `lib/situations.ts`, `store/actions.ts`, `lib/wails.ts` e `test/wails-mock.ts`, e, no Go, em `bindings/dto.go`, `convert.go` e `task_service.go`: as linhas de `Draft`, de `fromDraft`, de `userMessages` e do mock vão andar. As tasks 6 e 7 mexem em `lib/situations.ts`, `sidebar-tree.ts`, `attention/situation.go`, `text.go` e nos DTOs. O primeiro passo do tech spec é conferir cada linha citada na `main` em que a task começa. A migration da task é a `0023` (a da task 4 é a `0020`, a da 6 a `0021`, a da 7 a `0022`).

Toda decisão de design está tomada neste documento, em `design/screens/discussion.md` §5.3, §5.6, §6, §8 e §11, em `design/structure.md` e em `design/changes.md` (`implementation.md:18`). O PRD não pergunta nada ao usuário: D3 e D4 foram confirmadas por ele (`decisions.md`, 2026-09-25), e o que a task abria de produto foi decidido pelo coordenador, por delegação, em `decisions.md` (2026-09-29, "Discussão: o que a entrada da task 8 decidiu"), e está na §4.3.

**É sobretudo backend.** A tela da discussão é da task 9. Aqui o painel de rascunhos de hoje (`DraftsPanel`, `DraftCard`, `EpicGroup`) e a `DiscussionBar` recebem só o mínimo para o app ficar usável e dizer a verdade até lá (§4.2, O painel mínimo), na forma antiga, retematizada pelos tokens.

**Nenhum comportamento de hoje se perde.** Hoje um card solto aprovado publica na hora, um card que depende de outro espera, e o épico publica pelo botão **Publish epic** quando está pronto (`features.md` §Aprovar e publicar). Depois da task, o card solto e a dependência continuam iguais; o épico publica sozinho no gesto que fecha a condição dele, sem o botão; **Retry**, os passos gravados um a um, as dez razões de falha, os avisos de dependência e de módulo, a releitura do board depois de uma corrida e o arquivamento com `Not published` ficam. As mudanças de comportamento são as de `changes.md` D3, D5, D13, D15 e D16.

**Vocabulário.** "Rascunho" é um `discussion.Draft`; "card" é um rascunho `new` ou `update`; "épico" é um rascunho `epic`. "No GitHub" é `Published.Done()`; "começado" é `Published.Started()` (a issue existe, algum passo pode faltar). "Card de épico" é o card cujo épico é um rascunho da discussão ainda não publicado; o card de um épico já publicado ou de uma issue existente é "solto". "A corrida" é uma execução de `publishRun`. "Vai na corrida" é o rascunho que a próxima corrida escreve (`due`). "O que o segura" é o `hold` de um rascunho aprovado que não vai. "Falha de pé" é um rascunho com `PublishError`. "Não vai publicar" é o conjunto dos aprovados cujo fecho de **precisa antes** alcança um card não descartado de um épico descartado (§4.2).

## 1. Objetivo e critério de pronto

Aprovar publica. O épico e os dependentes publicam sozinhos no gesto que fecha a condição deles; **Publish epic** sai do produto. A regra é uma função pura em Go, que diz, para cada rascunho, se ele vai na próxima corrida e o que o segura; os estados da discussão dizem o que falta de verdade, com três situações novas; só uma decisão publica; uma falha marca o rascunho em que a corrida parou, o que depende dele espera, os independentes seguem, e o **Retry** continua a cadeia. Do Go, a task pede M2 e P26 (`backend.md`).

**Pronto quando** (`implementation.md:137`), cada item provado como diz:

1. **A regra, em tabela.** `internal/discussionflow/chain_test.go` cobre a função da cadeia sem serviço nem GitHub, uma linha por caso, com o que vai na corrida, na ordem, o `hold` de cada rascunho, o status e a razão de **Archive**: os 29 casos da §4.4 (A tabela da cadeia).
2. **A cadeia no fluxo**, contra o `memGH` de `discussionflow/helpers_test.go` (274–436), que grava cada chamada ao GitHub em ordem, em `publish_test.go` e `decide_test.go`:
   - um épico com dois cards: aprovar o épico, depois o card 1, não escreve nada; aprovar o card 2 escreve o épico, o card 1 e o card 2, nessa ordem, com os dois `addSubIssue`;
   - aprovar os dois cards e por último o épico publica a cadeia no gesto do épico;
   - com um card aprovado e o outro descartado, nada é escrito e o status é `epic_cant_publish`; aprovar o descartado publica;
   - descartar o último card por decidir de um épico com dois aprovados publica a cadeia;
   - um card solto fora do épico que depende de um card do épico vai na mesma corrida, depois dele;
   - um épico descartado com cards aprovados não escreve nada, o status é `epic_discarded`, e **Archive** arquiva com os cards como `Not published`;
   - uma falha no meio (o épico e o card 1 criados, o card 2 recusado) para a corrida; um card solto que depende do card 2 não é escrito e diz `waits for` o card 2; um card solto independente, aprovado depois, é escrito; **Retry** escreve o card 2 e o dependente, e o épico e o card 1 não são criados de novo (as chamadas de `createIssue` contadas);
   - duas falhas de pé, deixadas pela regra antiga em dois soltos, são limpas por um **Retry** só, de qualquer um dos dois;
   - descartar um rascunho que falhou antes de escrever limpa a falha dele; o que dependia dele segue sem a dependência, com o aviso;
   - decidir um rascunho cuja issue só a memória guarda (`unrecorded`) é recusado com `ErrPublished`, ao lado de `TestAPublicationNoWriteHeldIsRetriedIntoTheStoreBeforeItGoesOn` (`publish_test.go:349`);
   - o agente reescrever um rascunho que falhou antes de escrever o traz sem decisão e sem falha, e nada é escrito por isso;
   - uma discussão com a conversa fechada publica o que vai na corrida (a avaliação não espera a conversa);
   - o app reiniciado (`Sync`) com uma cadeia que vai na corrida e não foi escrita a publica na primeira avaliação.
3. **Só a decisão publica**, em `internal/discussion/service_test.go` e `reconcile_test.go`: cada edição da tabela da §4.2 (Só a decisão publica) retira a aprovação que diz, e nenhuma outra; a revisão do agente que tira o épico ou uma dependência de um aprovado, ou muda os cards de um épico aprovado, retira a aprovação; `GroupIntoEpic` recusa com `ErrInvalidRef` um card que pertence a um épico-rascunho; aprovar um rascunho sem título é recusado com `ErrUntitled`; decidir de novo um rascunho que falhou sem começar limpa a falha. E a invariante, em `internal/discussionflow/chain_edit_test.go`, pelo serviço real da fixture: para cada edição da tabela e para a revisão do agente, sobre as mesmas decisões, o `due()` depois está contido no `due()` antes.
4. **As situações**, em `internal/attention/derive_discussion_test.go`: cada estado dá a situação da §4.2 (As situações), com a prioridade, o grupo e o corpo de cada variante de `rest.md` §11; durante uma corrida, `drafts`, `epic_discarded`, `epic_cant_publish` e `publish_failed` ficam de pé e `ready_to_archive` só nasce depois dela; pausada, nenhuma; tudo descartado dá `ready_to_archive`.
5. **A compatibilidade**, em `internal/store/migrate_test.go`: a `0023` devolve a `''` a decisão e a falha de um épico aprovado, não começado, de uma discussão ativa (com e sem `publish_error`), e não toca num épico começado, num card, num descartado nem numa discussão arquivada.
6. **A fronteira**: `internal/bindings/convert_test.go` (ou o teste de `fromDraft`) cobre o `hold` de cada razão; `discussion_service_test.go` perde o teste de **Publish epic** (151–170) e ganha o de `ErrUntitled` na frase do usuário; `PublishEpic` não existe em `DiscussionService`, nos bindings gerados, em `lib/wails.ts`, em `test/wails-mock.ts` nem em `store/actions.ts`.
7. **O painel mínimo**, em jsdom: `features/discussion/discussion-status.test.ts` cobre `holdLabel` de cada razão, os rótulos e os tons dos estados novos e `standingDetail` de cada variante; `DraftCard.test.tsx` mostra a linha do que segura; `EpicGroup.test.tsx` prova que não há botão `Publish epic`; `DiscussionBar.test.tsx` mostra as três situações com o meio, nas variantes de `discussion.md` §8; `DiscussionHeader.test.tsx` mostra o rótulo e o tom `done` de `Ready to archive`; `lib/situations.test.ts` e `features/sidebar/sidebar-tree.test.ts` cobrem os rótulos, as linhas da árvore e `Ready to archive` no `Ctrl+J`.
8. **A discussão real**, um ponto de parada operado pelo usuário depois do step 4 (§4.2, A prova no GitHub): o binário da branch sobre diretórios de dados e de estado vazios, só com o board `Pessoal`, publica um épico com dois cards pelo roteiro exato; o implementador registra na pull request o que o usuário entregar (os links, as capturas, o trecho do log).
9. `task check` verde em todo step; nenhum teste removido sem o do código que o substitui no mesmo step.
10. **Documentação** da §7.
11. **Revisão do `design-critic`** na branch contra este material, `discussion.md` §5.3, §6, §8 e §11 e `changes.md` D3, D5, D13, D15 e D16, com as divergências corrigidas antes do merge (`implementation.md:21`).
12. **O CI verde** na pull request (`gh pr checks`) antes de ela ser dada como pronta.

`changes.md`: D3, D5, D13, D15, D16. `backend.md`: **M2**, P26.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 8 (127–137), task 9 (139–149), riscos (185–196, a linha da compatibilidade) | O escopo, o app sempre usável, o que a task 9 fará depois |
| 2 | `design/decisions.md`: Discussão, o que a entrada da task 8 decidiu (5–7); Plano confirmado, com D3 e D4 entre as sensíveis (41–43); Discussão, um rascunho por vez, aprovar publica (49–51) | O que o usuário aprovou e o que foi decidido por delegação |
| 3 | `design/screens/discussion.md` §1 (15–22), §5.3 (141–157), §5.4 (158–168), §5.6 (179–191), §6 (192–219), §8 (235–268, com a tabela da saída do épico), §11 (293–323), §12 (324–332), §13 (333–346), §16 (404–418) | As regras da publicação, os estados do rascunho, a barra, o arquivamento |
| 4 | `design/changes.md` D3, D5, D13, D15, D16 (103–116); `design/backend.md` M2 (18), P26 (84), F16 (125) | O que muda e os dados |
| 5 | `design/structure.md`, a linha 2 da árvore (100–124, as linhas `drafts`, épico e `Ready to archive`), a barra do pedido (246–292) | Os rótulos da árvore e as formas da barra que a task 9 fará |
| 6 | `design/screens/rest.md` §11 (506–602; as linhas da discussão, 585–602, com as variantes de `Epic can't publish` e `Epic discarded`) | Os textos das notificações, fonte única |
| 7 | `design/research/discussion.md` §0 (7–16), §1.6 (83–105), §1.9 (130–143); `design/research/interview.md`, respostas sobre a discussão (41–50) | Os fatos de hoje e as respostas do usuário |
| 8 | `docs/product/features.md` (na base) §Discussão (106–214), com §Rascunhos de cards (144–154), §Épico (156–160), §Aprovar e publicar (162–196), §A discussão como item (202–209); §Depende de mim (663–681) | O comportamento de hoje |
| 9 | `docs/architecture/overview.md` §A discussão (85–91); `storage.md` (40, `discussion_drafts`); `docs/development/troubleshooting.md` (33, as mensagens da discussão) | O desenho de `discussionflow` e as tabelas |
| 10 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **A regra da cadeia** (M2): `internal/discussionflow/chain.go`, uma função pura sobre os rascunhos, que dá o que vai na corrida, na ordem, o que segura cada rascunho, o que não vai publicar, o status e a razão de **Archive**; `state.go`, `publish.go`, `decide.go`, `evaluate.go` e `delete.go` passam a usá-la.
2. **`PublishEpic` sai** de `discussionflow`, de `DiscussionService`, dos bindings, de `lib/wails.ts`, de `test/wails-mock.ts` e de `store/actions.ts`, com `ErrNotReady` e a memória `epicsRequested`.
3. **A falha e o Retry** (D16): a falha marca o rascunho em que a corrida parou; o que depende dele espera; os independentes seguem; **Retry** limpa as falhas e continua a cadeia; decidir de novo, ou o agente reescrever, um rascunho que falhou sem começar limpa a falha dele.
4. **Só a decisão publica** (D15), em `internal/discussion`: as edições da cadeia e a revisão do agente retiram a aprovação; agrupar recusa um card de outro épico-rascunho; um rascunho sem título não é aprovado.
5. **Os estados e as situações** (D13, P26): `epic_cant_publish`, `epic_discarded` e `ready_to_archive` no lugar de `published`; as situações novas em `attention`, com os textos e as variantes de `rest.md` §11; o `Decide drafts` com tudo decidido some; tudo descartado é `Ready to archive`.
6. **A compatibilidade**: a migration `0023`.
7. **O painel mínimo**: `DraftCard`, `EpicGroup`, `DiscussionBar`, `DiscussionHeader`, `discussion-status.ts`, `lib/situations.ts`, `sidebar-tree.ts`.
8. **Documentação** da §7.

**Fora**, e como fica:

| O que | Até | Como fica nesta task |
|---|---|---|
| A tela da discussão inteira: o cartão dos rascunhos na conversa, a linha do que o gesto publica (D4), o foco que fica, a proteção de 900 ms e da tecla repetida, a decisão desabilitada com a razão (D6), os marcos (D7, D10), a pílula, o `⋯`, a barra do pedido com **Show**, **Next to decide** e **Archive…** | 9 | O painel e a barra de hoje, com o mínimo da §4.2. Uma decisão durante uma corrida continua recusada com `Wait for the publication to finish.` no aviso do app |
| A rodada nos rótulos (`Round R`, P25) | 9 | Os rótulos sem a rodada: `Epic can't publish`, `Decide drafts · 2 of 5` |
| O que **Approve** e **Discard** publicariam (F16) | 9 | Não aparece. A task 9 o pede ao Go pela função desta task (§4.3 #12) |
| **Approve** tracejado num rascunho de repositório que saiu do board (`discussion.md` §6) | 9 | Como hoje: a corrida falha com `<dono/nome> is no longer managed by the board.` |
| O título do épico no diálogo de agrupar (D8) | 9 | **Group into an epic** de hoje, que cria o épico sem título; aprovar esse épico é recusado até ele ter um (§4.2) |
| Os outros textos de notificação da discussão (`Decide drafts` com a contagem, `Publish failed` com o nome; P37, X20) | 11 | Os de hoje |
| Qualquer mudança em `internal/gh` | — | Nenhuma: `CreateIssue`, `AddProjectItem`, `SetProjectSingleSelect`, `AddSubIssue` e `AddBlockedBy` (`internal/gh/issues.go:150–264`) servem como estão |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| **Publish epic** sai; aprovar publica na hora e a cadeia publica sozinha quando a condição fecha; sem diálogo de confirmação; o desfazer é fechar a issue no GitHub | `changes.md` D3, D4, confirmadas pelo usuário (`decisions.md`, 2026-09-25; `implementation.md` §4) |
| O épico publica quando está aprovado e todos os cards dele estão decididos, com ao menos dois aprovados; o card do épico espera o épico; a corrida escreve o épico, depois os cards como sub-issues, depois o que dependia deles | `discussion.md` §6; `decisions.md`, 2026-09-24 (Discussão) |
| O card de um épico descartado não publica, diz por quê e não segura o arquivamento | `changes.md` D5; `discussion.md` §6, §11 |
| `Epic can't publish` e `Epic discarded` esperam o usuário; `Ready to archive` é de encerramento, entra no `Ctrl+J`, notifica uma vez e pisca; o `Decide drafts` com tudo decidido some; a prioridade da barra | `changes.md` D13; `discussion.md` §8, §13 |
| A ordem da corrida: o épico antes dos cards, a dependência antes do dependente, empate pela posição; a releitura do board depois; os passos gravados um a um; as dez razões | `discussion.md` §6; `features.md` §Aprovar e publicar |
| Um card que depende do épico ou de outro card espera ele ser criado | `research/interview.md` (41–50) |

### 4.2 Decisões detalhadas

#### A regra da cadeia

Uma função só, `chainOf(drafts)`, em `internal/discussionflow/chain.go`, sobre os rascunhos como o app os conhece (`effectiveDrafts`, `state.go:111–129`, com o que só a memória guarda). Para cada rascunho não publicado:

| Termo | Card solto | Card de épico | Épico |
|---|---|---|---|
| **Precisa antes** | As dependências dele em rascunhos, não `Dropped`, fora do GitHub e não descartadas | O épico dele e as dependências dele, como no solto | As dependências dos cards aprovados dele que não são cards aprovados do próprio épico |
| **Portão** | Aberto | Fechado se o épico está descartado; senão, o do épico | Começado no GitHub; ou aprovado, com todos os cards decididos e ao menos dois aprovados |

Um rascunho **vai na corrida** quando: está aprovado, fora do GitHub, sem falha; o portão dele está aberto; e cada rascunho do fecho de **precisa antes** que não está no GitHub está aprovado, com o portão aberto e sem falha. Uma falha segura só o que a alcança pelo fecho: os independentes vão. O fecho põe a cadeia inteira numa corrida só (o épico, os cards, o solto que depende de um card), e deixa passar um ciclo entre aprovados, que `orderTargets` (`publish.go:199–247`) quebra pela posição, com o aviso de hoje na dependência que não pôde ser registrada.

Consequências, cada uma um caso da tabela da §4.4:
- **Dependência num descartado:** sai de **precisa antes**; a corrida a deixa de lado com `The dependency on <título> was discarded and dropped.` (`publish.go:604–612`), como hoje.
- **O conjunto "não vai publicar"**: os aprovados cujo fecho de **precisa antes** alcança um card não descartado de um épico descartado, o próprio card incluído. O fecho passa pelo épico: se o card c1 de um épico E aprovado depende do card de um épico descartado E2, E fica `draft` e os cards de E ficam `epic`, e todos estão no conjunto. O dependente diz `Approved · waits for <título>`; o conjunto não segura **Archive** e arquiva como `Not published`. Soltar o dependente perderia a relação se o usuário aprovasse o épico de novo.
- **Um épico já começado no GitHub** termina, qualquer que seja a contagem: o portão vale antes da primeira escrita.
- **O card de um épico publicado** é solto e vai sozinho, como sub-issue (`standsAlone`, `publish.go:163–175`), como hoje.

#### O que segura um rascunho

O `hold` de cada rascunho, avaliado nesta ordem; o primeiro que vale é o dele. O texto é o de `discussion.md` §5.3, que o painel mínimo mostra e a task 9 reusa.

| Razão | Quando | Campos | Texto (`holdLabel`) |
|---|---|---|---|
| `epic_discarded` | Card não descartado de um épico descartado, com ou sem decisão | — | `The epic is discarded · this card won't publish` |
| `cards` | Épico aprovado, ou card aprovado dele, com cards do épico sem decisão | `left` | `Approved · waits for 1 more card of the epic to be decided`; `… 2 more cards …` |
| `epic_short` | Épico aprovado, ou card aprovado dele, com todos os cards decididos e menos de dois aprovados | `approved`, `cards` | As variantes de `discussion.md` §8: `Approved · the epic needs two approved cards · 1 of 3`; sem cards, `Approved · the epic has no cards` |
| `epic` | Card aprovado cujo épico não vai na corrida por outra razão: sem decisão, segurado por uma dependência de fora, ou com a própria falha | — | `Approved · waits for the epic` |
| `draft` | Aprovado com um rascunho de **precisa antes** que não vai na corrida, com falha incluída (o primeiro, na ordem das dependências) | `title` | `Approved · waits for <título>` |
| `""` | Vai na corrida, está na corrida (`publishing`), está no GitHub, sem decisão, descartado, ou com a própria falha | — | nada (o painel mostra `Publishing…`, o resultado ou a falha, como hoje) |

`<título>` é `titleOf` (`state.go:314–321`): o título, ou o id enquanto não há título.

#### Os estados da discussão

`status()` (`state.go:131–156`) passa a esta ordem; o primeiro que vale é o estado. `published` sai.

| # | Quando | Status | Rótulo (`discussionStatusLabel`) | Situação |
|---|---|---|---|---|
| 1 | A conversa trabalha | `discussing` | `Discussing` | a da sessão, como hoje |
| 2 | Uma corrida está em curso | `publishing` | `Publishing` | nenhuma |
| 3 | Uma falha está de pé | `publish_failed` | `Publish failed` | `publish_failed` |
| 4 | O artefato não pôde ser lido | `awaiting_drafts` | `Waiting for the drafts` | `reply`, como hoje |
| 5 | Sem artefato legível, ou sem rascunhos | `discussing` | `Discussing` | `reply` só antes dos rascunhos, como hoje |
| 6 | Um épico descartado tem um card aprovado fora do GitHub | `epic_discarded` | `Epic discarded` | `epic_discarded` |
| 7 | Um rascunho está sem decisão | `deciding` | `Decide drafts` | `drafts` |
| 8 | Um épico tem o `hold` `epic_short` | `epic_cant_publish` | `Epic can't publish` | `epic_cant_publish` |
| 9 | Algo vai na corrida e ela ainda não começou (o instante entre a decisão e a corrida) | `publishing` | `Publishing` | nenhuma |
| 10 | Todo rascunho está no GitHub ou descartado, publicado algum ou nenhum | `ready_to_archive` | `Ready to archive` | `ready_to_archive` |

Com as linhas 3 e 6 a 9 fora, todo aprovado está no GitHub ou vai na corrida (o `hold` `cards`, `epic` e `draft` sempre chega a um sem decisão, a um `epic_short`, a um card de épico descartado ou a uma falha); por isso a linha 10 é o resto. Em `State.Waiting`, a linha 10 vale só pela condição dela, nunca como padrão.

**A situação e a corrida.** O status acima é o que a pílula, o rascunho e o spinner da árvore dizem. A situação sai de outro campo, `State.Waiting`, que é a mesma ordem sem as linhas 2 e 9: durante uma corrida, ou no instante antes dela, a situação que espera o usuário (`publish_failed`, `epic_discarded`, `drafts`, `epic_cant_publish`) fica de pé, sem terminar e recomeçar (`Grace` é 1 s, `attention/service.go:24`, e a corrida leva de 7 a 14 s); só `ready_to_archive` espera a corrida acabar, e então nasce. É a prioridade de `discussion.md` §8. A linha 10 sem nada publicado é o caso "Todos descartados" de `discussion.md` §13, que hoje volta a `Discussing` (`decide_test.go:219`, reescrito). Com mais de um épico nas linhas 6 ou 8, vale o primeiro pela posição.

#### Arquivar

`canArchive` (`state.go:268–282`) passa a receber a cadeia e se uma corrida está em curso. As razões, na ordem, com o texto que o cabeçalho de hoje mostra no tooltip e que a task 9 põe no `⋯` depois de `·`:

| Quando | `ArchiveHint` |
|---|---|
| Uma falha de pé | `A publication failed: Retry it, or discard the draft.` |
| Uma corrida em curso | `A publication is running.` |
| Um épico com o `hold` `epic_short` | A variante de `discussion.md` §8 (`The epic can't publish: approve one more card, or discard the epic.`) |
| Um aprovado fora do GitHub que não está no conjunto "não vai publicar" | `Approved drafts wait to be published.` |

O card de um épico descartado, quem depende só dele e um rascunho sem decisão não seguram: arquivam como `Not published`. `Archive` (`delete.go:19–49`) continua recusando com `ErrPublishing` durante uma corrida.

**A saída do épico que não publica**, por extenso. As colunas do rascunho, da barra e de **Archive** são as de `discussion.md` §8; a da notificação, a de `rest.md` §11, a fonte única dos textos de notificação. Os testes de `discussion-status.test.ts` (TS) e de `text` e `state` (Go) usam esta tabela.

| Caso | O rascunho (`holdLabel`) | O meio da barra (`standingDetail`) | A razão de **Archive** | A notificação |
|---|---|---|---|---|
| Dois cards ou mais, um aprovado | `Approved · the epic needs two approved cards · 1 of 3` | `1 of 3 cards approved · approve one more, or discard the epic` | `The epic can't publish: approve one more card, or discard the epic.` | `The epic can't publish: approve one more of its cards, or discard it.` |
| Dois cards ou mais, nenhum aprovado | `Approved · the epic needs two approved cards · 0 of 3` | `0 of 3 cards approved · approve two more, or discard the epic` | `The epic can't publish: approve two more cards, or discard the epic.` | `The epic can't publish: approve two more of its cards, or discard it.` |
| Um card | `Approved · the epic needs two approved cards · 1 of 1` (`0 of 1` com ele descartado) | `1 of 1 card approved · move another card into it, or discard the epic` | `The epic can't publish: move another card into it, or discard the epic.` | `The epic can't publish: it has one card. Move another into it, or discard it.` |
| Nenhum card | `Approved · the epic has no cards` | `No cards · move two cards into it, or discard the epic` | `The epic can't publish: move two cards into it, or discard the epic.` | `The epic can't publish: it has no cards. Move two into it, or discard it.` |

`Epic discarded`: no meio da barra, `2 approved cards of it won't publish · approve the epic again, or discard them`, com um, `1 approved card of it won't publish · approve the epic again, or discard it`; na notificação, as duas linhas de `rest.md` §11.

#### A corrida de cada decisão

1. `DiscussionService.DecideDraft` chama `flow.Decide` (`decide.go:11–19`), que toma o lock da discussão pelo `edit` (`decide.go:80–99`): recusa uma arquivada e, durante uma corrida, recusa com `ErrPublishing`.
2. `flow.Decide` recusa com `ErrPublished` um rascunho que a memória guarda como começado (`unrecorded`, `publish.go:681–695`): o banco não sabe da issue, e limpar a falha dele deixaria uma issue que a cadeia nunca termina. Depois, `discussion.Service.Decide` (`service.go:404–413`) grava a decisão: recusa um rascunho começado no banco (`ErrPublished`), recusa aprovar um sem título (`ErrUntitled`, novo) e, num rascunho que falhou sem começar, limpa `PublishError` na mesma escrita.
3. Solto o lock, `Check` pede uma avaliação, que coalesce com outras (`discussionflow.go:161–175`).
4. A avaliação (sob o lock) percebe o documento, lê os rascunhos se a conversa está ociosa, sem corrida e sem publicação só na memória (`evaluate.go:15–41`, como hoje), e chama `publishDue`, agora **antes** do teste da conversa aberta: a publicação não depende da conversa. `publishDue` calcula a cadeia; sem nada que vá, volta; com algo, marca `publishing` (a partir daqui toda edição é recusada) e dispara `publishRun`.
5. `publishRun` (`publish.go:249–283`) recalcula a cadeia com o que está gravado, ordena, marca `running`, escreve passo a passo, gravando cada passo, e para na primeira falha. Ao fim, desmarca, relê o board se escreveu, avisa e pede outra avaliação. Sem falha, ela não acha nada: a cadeia inteira foi na mesma corrida. Com uma falha, ela acha os independentes que a corrida não chegou a escrever e faz outra corrida com eles, como hoje.

**O que dispara uma corrida**: uma decisão (`Decide`), o **Retry**, o fim de uma corrida, a avaliação depois de um turno do agente e o `Sync` na abertura do app. Nenhuma edição dispara, porque nenhuma põe um aprovado na corrida (a seção seguinte).

**Idempotência.** Uma corrida por vez (`publishing`); as edições recusadas durante ela; a cadeia recalculada dentro da corrida, do que está gravado; cada passo pulado quando já gravado (`Started`, `ItemID`, `StatusSet`, `ModuleSet`, `ParentSet`, `Linked`); um rascunho no GitHub nunca volta à cadeia. Um segundo clique em **Approve** antes da corrida desfaz a decisão (o toggle de hoje), e depois dela é recusado. O único caminho para criar duas vezes é o de hoje: um passo que o GitHub aceitou, que o banco não gravou e que só a memória guarda, perdido num reinício antes do **Retry** (`publish.go:681–695`; `troubleshooting.md`).

#### A falha e o Retry

É a regra de hoje, fechada (D16).
- **A falha marca o rascunho.** A corrida para no rascunho que falhou (`write`, `publish.go:321–338`), que guarda a razão e mostra `Publish failed` e **Retry**. O que o alcança pelo fecho espera: o dependente diz `Approved · waits for <título>`, e o card de um épico que falhou, `Approved · waits for the epic`. Os independentes seguem: a avaliação depois da corrida faz outra com eles, e um aprovado depois também publica. Uma falha de conta ou de GitHub (`gh`, login, escopo, taxa) tende a se repetir em cada independente, que fica com a sua; o **Retry** as limpa juntas.
- **A barra** diz `Publish failed` enquanto houver uma falha de pé (na task 9, com **Show**, que leva ao primeiro rascunho que falhou pela posição), inclusive durante as corridas dos independentes.
- **Retry** (`decide.go:156–189`), de qualquer rascunho que falhou: grava o que só a memória guarda de **todos** os rascunhos (`writeUnrecorded`), limpa **todas** as falhas da discussão numa escrita (`ClearPublishErrors`) e pede a avaliação. A corrida seguinte escreve tudo o que vai, na ordem: o que falhou continua do passo em que parou. `epicRunOf`, `epicRun` e `requestEpic` saem.
- **Descartar o que falhou.** Um rascunho que falhou antes de o GitHub receber qualquer coisa (a falha de `lookup` ou de `resolved`, `publish.go:328–330`, 415–446) pode ser descartado ou ter a decisão desfeita, e a decisão limpa a falha dele (a corrida, passo 2); o que dependia dele segue sem a dependência, com o aviso, quando ele foi descartado. Um que falhou depois de começar, no banco ou só na memória, só tem **Retry**, como hoje.
- **A revisão do agente** de um rascunho que falhou sem começar o traz `fresh` (`reconcile.go:59–61`), sem decisão e sem falha, como uma decisão desfeita: nada é escrito por isso, porque ele está sem decisão.

#### Só a decisão publica

A linha antes do gesto (D4, task 9) diz o que **Approve** publica; uma edição não tem essa linha. Por isso, em `internal/discussion`, uma mudança da cadeia num rascunho aprovado e fora do GitHub (nem começado) retira a aprovação, e o estado volta a `Not decided`:

| Mudança | Retira a aprovação de |
|---|---|
| `SetDraftRepository` (`service.go:308–317`) | O rascunho |
| `SetDraftEpic` (`service.go:331–356`) | O card; o épico que ele deixa e o épico em que ele entra, quando são rascunhos aprovados não começados; numa escrita só (`WriteDrafts`, como `GroupIntoEpic`) |
| `AddDraftDependency`, `RemoveDraftDependency` (`service.go:358–402`) | O rascunho |
| `GroupIntoEpic` (`service.go:416–460`) | Os cards agrupados (o épico novo nasce sem decisão). `epicMembers` (`service.go:463–479`) passa a recusar, com `ErrInvalidRef`, um card que pertence a um épico-rascunho, que é o que a interface de hoje e a da task 9 já oferecem: tirar um card de um épico aprovado por agrupamento poria o épico na corrida sem gesto |
| A revisão do agente (`RecordDrafts`, `service.go:258–293`) | Um rascunho mantido a que `normalize` (`reconcile.go:166–195`) tirou o épico ou uma dependência; um épico mantido cujo conjunto de cards mudou |

O título, o corpo e o módulo mantêm a aprovação: não mudam o que publica nem quando. A garantia é uma invariante testada (pronto 3): nenhuma edição e nenhuma revisão do agente põe na corrida um rascunho que não ia antes dela. `forgetEpicOf` (`decide.go:111–127`) sai, porque a aprovação que ele protegia agora sai com a edição.

**Rascunho sem título.** O épico de **Group into an epic** de hoje nasce sem título e sem corpo (`service.go:416–460`); na task 9, o diálogo de agrupar pede o título (`discussion.md` §12), e o caso fica para os épicos agrupados antes dela. Aprovar um rascunho sem título é recusado com `discussion.ErrUntitled`, que o usuário lê como `Name the draft to approve it.`; o corpo vazio passa, porque o GitHub aceita uma issue sem corpo.

#### As situações e as notificações

Em `internal/attention` (`situation.go:18–68`, `derive_discussion.go:14–51`, `text.go`):

| Estado (`State.Waiting`) | Kind | Grupo | Corpo da notificação |
|---|---|---|---|
| `epic_cant_publish` | `epic_cant_publish` | `waiting` | As quatro linhas `Epic can't publish` de `rest.md` §11, pela variante (a tabela da saída, acima) |
| `epic_discarded` | `epic_discarded` | `waiting` | As duas linhas `Epic discarded` de `rest.md` §11: `The epic is discarded, and 2 of its approved cards won't publish.`; `The epic is discarded, and its approved card won't publish.` |
| `ready_to_archive` | `ready_to_archive` | `closing` | `Every draft is published or discarded. The discussion is ready to archive.` |

`deciding` continua `drafts`, e `publish_failed` continua `publish_failed`, com os textos de hoje (`text.go:185–200`) até a task 11. Cada situação notifica ao começar, pela regra de toda situação (`attention/service.go:214–307`); as duas do épico só começam por um gesto no app, com a janela em foco, e então piscam sem notificar; `Ready to archive` começa ao fim de uma corrida, que leva de 7 a 14 s (§5.4), e é a que chega de fato como notificação. Trocar de uma para outra é uma situação nova no mesmo lugar (`discussion`), como hoje de `drafts` para `publish_failed`. As contagens do corpo vêm de dois métodos novos de `discussionflow.State`: `ShortEpic() (approved, cards int, ok bool)` e `DiscardedEpic() (approvedCards int, ok bool)`, do primeiro épico pela posição.

No frontend, sem a rodada até a task 9:

| Kind | `situationLabel` | Linha da árvore, longa | Curta | Fragmento do anúncio |
|---|---|---|---|---|
| `epic_cant_publish` | `Epic can't publish` | `Epic can't publish` | igual | `epic can't publish` |
| `epic_discarded` | `Epic discarded` | `Epic discarded` | igual | `epic discarded` |
| `ready_to_archive` | `Ready to archive` | `Ready to archive · 5 published`; sem nada publicado, `Ready to archive · nothing published` | `Ready to archive` | `ready to archive` |

`5` conta os rascunhos no GitHub, criados e atualizados. O anel e o chip de encerramento vêm do grupo `closing`, como o `Ready to close` da task; o nó recolhido o conta como `ready to close`, a palavra do grupo (`sidebar-tree.ts`, `GROUP_WORDS`). O caso `published` de `discussionStanding` (`sidebar-tree.ts:600–609`) sai, e com ele o tom `archive` da linha (`sidebar-tree.ts:45`, 150, 1017) se nada mais o usar; uma discussão pausada em qualquer estado fica com `sessionStanding`, `Paused · Discussing`.

#### O painel mínimo

A forma antiga, retematizada, até a task 9. Nenhum componente novo, nenhum componente do system trocado.

| Peça | Muda | Fica |
|---|---|---|
| `DraftCard.tsx` (o canto de estado, 179–227) | O texto âmbar `Waits for <título>` (222) e a `hint` (225) dão lugar a `holdLabel(draft)`, em `text-xs text-muted-foreground`; `epic_short` e `epic_discarded` em `text-foreground font-medium` (o `--ink-1` 500 de `discussion.md` §5.3), sem o `⧗`. Vale também no cartão do épico, que hoje não mostrava o que o segurava | O resultado com o link, a falha com **Retry**, `Publishing…`, a decisão em toggle, as edições |
| `EpicGroup.tsx` (o rodapé, 52–83) | Sai inteiro: **Publish epic**, a `hint`, o erro e `publishEpic`; o `Discarded` e o link do resultado já estão no cartão do épico (a decisão pressionada e o canto de estado, `DraftCard.tsx:193–202`) | O grupo com borda, o cartão do épico, os cards recuados, a opacidade do descartado |
| `DraftsPanel.tsx` | Nada | `N of M decided`, **Group into an epic** |
| `DiscussionBar.tsx` (1–43) | Ao lado do rótulo, o meio de `standingDetail(discussion)` nas três situações novas, em `text-xs text-muted-foreground`, cortado com o texto inteiro no `title`: as variantes da tabela da saída e de `Epic discarded`, e `5 published · or ask the agent for more cards below` (`nothing published · …`). O rótulo segue o status (`Publishing` durante uma corrida), e o meio segue a situação. O ponto de uma situação de encerramento usa o tom `done`, e não o de espera: a troca é local à barra e ao cabeçalho; `situationTone` (`lib/situations.ts:34–36`), que a task usa em `Ready to close`, não muda | O `role="status"` com `aria-live`, a razão do artefato ilegível, `Publishing…` |
| `DiscussionHeader.tsx` (40, 61) | O mesmo tom `done` para `Ready to archive`, local; o tooltip de **Archive** mostra as razões novas. Sem o meio, que fica só na barra | O resto |
| `discussion-status.ts` | Os rótulos e os tons dos três estados (`Ready to archive` no lugar de `Drafts published`, `done`; os do épico, `idle`); `holdLabel`, `standingDetail` e `epicWayOut(approved, cards)`; `waitsLabel` (153–157) sai | `epicGroups`, `looseDrafts`, `decidedCount` |

Não entram: **Show**, **Archive…** ou qualquer ação na barra; a linha do que o gesto publica; o foco que fica. Aprovar o último card que fecha a condição de um épico publica a cadeia inteira, como a decisão D3 confirmada, e o painel mostra `Publishing…` em cada rascunho da corrida.

#### Compatibilidade

- **O que está no GitHub** nunca volta à cadeia: nada é republicado.
- **Um épico aprovado que ainda não começou**, numa discussão ativa, volta a `Not decided`, e sem falha, pela `0023`. A regra antiga põe a falha de `lookup` no primeiro alvo, o épico (`publish.go:328–330`); sem limpar, ficaria um estado que a regra nova não produz, sem decisão e com falha. Aprovado antes da regra, ele esperava o segundo gesto (**Publish epic**); sem a migration, a primeira avaliação depois da atualização o publicaria sem gesto. Os cards dele ficam como estão; aprovar o épico de novo publica a cadeia quando o resto está decidido.
- **Um épico começado e não terminado** (a corrida cortada pelo fechamento do app, ou uma falha) continua: com a falha, pelo **Retry**; sem ela, na primeira avaliação do `Sync`, que é seguir o que o usuário já pediu. Hoje ele esperava um novo **Publish epic**, porque o pedido vivia só na memória (`epicsRequested`).
- **Os cards soltos aprovados** que esperavam uma dependência seguem a mesma regra de hoje.
- **Os cards aprovados de um épico descartado** ficam aprovados e passam a `Epic discarded`.
- **Várias falhas de pé**, que a regra antiga também deixava, seguram cada uma o que depende dela; um **Retry** limpa todas.
- **As situações guardadas** (`situations`, a linha da discussão) trocam de tipo na primeira atualização depois da carga, na janela de base do `attention` (`Baseline`), sem notificar.
- **As arquivadas** não mudam: a `0023` filtra `archived_at IS NULL`, e `ArchivedDiscussion` não tem status.
- **Na medição** (§5.4), nenhuma discussão está ativa; a migration existe para as que o usuário criar até o merge.

```sql
-- 0023_discussion_chain.sql
-- An epic of a discussion goes to GitHub on its own once the drafts it needs
-- are decided. An epic approved before that, and never started, waited for a
-- gesture that no longer exists: it goes back to be decided, so that nothing
-- is written on GitHub without a gesture made under the rule.
UPDATE discussion_drafts SET decision = '', publish_error = ''
WHERE kind = 'epic' AND decision = 'approved' AND outcome = ''
  AND discussion_id IN (SELECT id FROM discussions WHERE archived_at IS NULL);
```

#### A prova no GitHub

**Um ponto de parada operado pelo usuário, depois do step 4.** O app é de instância única pelo nome `myspec` no D-Bus de sessão (`internal/app/app.go:66`, 384–387), e é o MySpec instalado que roda a própria task 8: o binário da branch, aberto com ele de pé, entrega o controle a ele e sai. Um D-Bus separado não serve, porque a notificação passa pelo D-Bus de sessão (`internal/app/notifications.go:19`). E uma cópia do diretório de dados retomaria as tasks ativas do usuário pelos caminhos reais das worktrees (`internal/flow/service.go:301–327`). Por isso a prova roda sobre diretórios vazios, com o MySpec instalado fechado. O implementador para depois do step 4 e pede ao usuário:

**Preparar**
1. No MySpec instalado, **Pause** na task 8, e fechar o app.
2. Na worktree da task, `task build` (o binário fica em `bin/myspec`).
3. `mkdir -p /tmp/myspec-proof/data /tmp/myspec-proof/state` e `XDG_DATA_HOME=/tmp/myspec-proof/data XDG_STATE_HOME=/tmp/myspec-proof/state ./bin/myspec`.
4. No app vazio, cadastrar só o board `Pessoal` (`guilhermt`, projeto 2) e os repositórios dele, pelos clones que já existem (**Add repository** com o caminho do clone, sem clonar de novo). Nenhuma task, nenhum review. O Claude Code e o `gh` são os do usuário, já com login.

**O roteiro**, com uma demanda real que o usuário escolhe e que renda um épico com dois cards:
1. **New discussion** no board, a conversa até os rascunhos: um épico e dois cards.
2. Aprovar o épico: ele diz `Approved · waits for 2 more cards of the epic to be decided`; nada no GitHub.
3. Aprovar o card 1 e descartar o card 2: o épico e o card 1 dizem `Approved · the epic needs two approved cards · 1 of 2`; a barra `Epic can't publish` com `1 of 2 cards approved · approve one more, or discard the epic`; a linha da árvore âmbar; **Archive** desabilitado com `The epic can't publish: approve one more card, or discard the epic.`; nada no GitHub.
4. Aprovar o card 2 (a decisão troca de **Discard** para **Approve**) e trocar de janela logo em seguida: a corrida escreve o épico, o card 1 e o card 2, nessa ordem; a notificação `Every draft is published or discarded. The discussion is ready to archive.` chega.
5. Voltar ao app: a barra diz `Ready to archive` com `3 published`; `Ctrl+J` abre a discussão; **Archive** arquiva.
6. Entregar ao implementador: os três links, capturas dos passos 2, 3 e 5, e as linhas `discussion draft published` de `/tmp/myspec-proof/state/myspec/myspec.log` (`xdg.go:46`).

**O que é criado no GitHub:** três issues nos repositórios que os rascunhos nomeiam (o épico e dois cards); os dois cards como sub-issues do épico; três itens no board `Pessoal`, no status de cards novos, com o módulo, se o board tiver; e as relações de bloqueio, se os rascunhos tiverem dependências. Nada mais.

**Uma falha no meio** é registrada na pull request e corrigida na branch; o usuário refaz `task build` e abre o app com os mesmos diretórios, e o **Retry** da mesma discussão continua de onde parou. O que já foi criado fica.

**Limpar depois:** fechar o app da branch, `rm -rf /tmp/myspec-proof`, reabrir o MySpec instalado e **Resume** na task 8. As issues são trabalho real do usuário e ficam no board; o MySpec instalado não conhece essa discussão, então uma task criada desses cards não recebe a seção `Discussion` no contexto (`DocumentOfCard`, `internal/discussion/service.go:637`). Se a demanda foi só para a prova, o usuário fecha as três issues (`gh issue close <número> -R <dono/nome>`) e tira os itens do board no GitHub; o produto nunca apaga. A `0023` sobre dados reais fica provada pelo `migrate_test.go` (pronto 5); o banco do usuário não tem discussão ativa (§5.4).

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | Uma dependência num card que não vai publicar (card de épico descartado), direta ou pelo épico | O conjunto "não vai publicar" pelo fecho: segura o dependente, que não segura o arquivamento | `discussion.md` §6; `changes.md` D16; `decisions.md` |
| 2 | Um ciclo entre rascunhos aprovados fora de um épico, que hoje trava os dois | Vão juntos na corrida, quebrado pela posição, como dentro de um épico | `discussion.md` §6 |
| 3 | Uma falha e os rascunhos independentes | A regra de hoje, fechada: a falha marca o rascunho, o que depende dele espera, os independentes seguem, a barra diz `Publish failed` até o **Retry**, que limpa as falhas e continua a cadeia | `discussion.md` §6; `changes.md` D16; `decisions.md` |
| 4 | "Descartar" como saída de uma falha (`discussion.md` §11) sem regra | Decidir de novo, ou o agente reescrever, um rascunho que falhou sem começar limpa a falha; o começado só na memória é recusado | `discussion.md` §6; `changes.md` D16 |
| 5 | Uma edição que pusesse um aprovado na corrida publicaria sem a linha do gesto, agrupar incluído | Retira a aprovação (a tabela de Só a decisão publica); agrupar recusa um card de outro épico-rascunho; a invariante testada | `discussion.md` §5.6; `changes.md` D15; `decisions.md` |
| 6 | O épico do usuário nasce sem título e publicaria vazio | Aprovar sem título é recusado (`Name the draft to approve it.`) | `discussion.md` §5.6; `changes.md` D15 |
| 7 | O épico com menos de dois cards: "approve one more" não tem saída | As variantes por extenso, em quatro superfícies; as da notificação em `rest.md` §11, a fonte única | `discussion.md` §8, §11; `rest.md` §11 |
| 8 | Um épico começado cujos cards mudam | O portão vale antes da primeira escrita; o começado termina | §4.2 |
| 9 | O épico aprovado antes da regra | A `0023` o devolve a `Not decided`, sem falha | `backend.md` M2; `implementation.md` §3; `decisions.md` |
| 10 | Tudo descartado: `discussion.md` §13 diz `Ready to archive`, o código diz `Discussing` | `Ready to archive` com `nothing published` | §4.2 |
| 11 | `implementation.md` dizia que os testes da cadeia são contra o `ghtest` | Os testes de `discussionflow` usam o `memGH`, a falsificação da interface `GH` que já grava a ordem das chamadas; o `ghtest` cobre os comandos do `gh` em `internal/gh/issues_test.go`, que não mudam | `implementation.md` §3; §1, pronto 2 |
| 12 | F16 derivado no frontend "com a mesma regra do backend" seria a regra escrita duas vezes | A task 9 pede ao Go o que **Approve** e **Discard** publicariam, pela função desta task | `backend.md` F16; `discussion.md` §16; `decisions.md` |
| 13 | A notificação de `Epic can't publish` e `Epic discarded` | O texto de `rest.md` §11 e a regra de toda situação; na prática piscam, porque começam com o app em foco | `backend.md` P26 |
| 14 | A publicação esperava a conversa aberta (`evaluate.go:29–31` antes de `publishDue`) | A publicação não depende da conversa | §4.2 |
| 15 | A ordem dos estados tirava a situação durante uma corrida, que voltava como nova e notificava de novo | `State.Waiting`: a situação fica de pé durante a corrida; só `Ready to archive` espera ela acabar | `discussion.md` §8; `backend.md` M2; `decisions.md` |
| 16 | A prova sobre uma cópia do diretório de dados retomaria as tasks do usuário, e o app da branch não abre com o instalado de pé | Um ponto de parada operado pelo usuário, sobre diretórios vazios, só com o board `Pessoal` | §4.2; `implementation.md` §3; `decisions.md` |
| 17 | O tom de encerramento do ponto da barra | Local à barra e ao cabeçalho da discussão; `situationTone` não muda | §4.2 |

### 4.4 O que o tech spec toma

- **`internal/discussion`**:
  - `ErrUntitled = errors.New("discussion: a draft needs a title to be approved")`; `Decide` recusa aprovar um rascunho de título vazio; num rascunho não começado, `Decide` limpa `PublishError`.
  - `epicMembers` (`service.go:463–479`) recusa com `ErrInvalidRef` um card cujo épico é um rascunho da discussão.
  - As edições da §4.2 (Só a decisão publica) retiram a aprovação de um rascunho aprovado não começado. `SetDraftEpic` passa a escrever até três rascunhos numa escrita (`store.WriteDrafts`, `store/discussions.go:264`), como `GroupIntoEpic`.
  - `reconcile` (`reconcile.go:21–39`) ganha, depois de `normalize`, a retirada das aprovações da §4.2, comparando com o guardado (o épico e as dependências de cada mantido; os cards de cada épico mantido).
- **`internal/discussionflow/chain.go`**, novo, puro:
  - `type HoldReason string` com `HoldNone`, `HoldEpicDiscarded`, `HoldCards`, `HoldEpicShort`, `HoldEpic` e `HoldDraft`; `type Hold struct { Reason HoldReason; Title string; Left, Approved, Cards int }`.
  - `chainOf(drafts []discussion.Draft) chain`, com `due() []discussion.Draft` (ordenado por `orderTargets`), `hold(id) Hold`, `wontPublish(id) bool`, `shortEpic()` e `discardedEpic()`; o fecho de **precisa antes** calculado uma vez por rascunho, sem recursão sem fim num ciclo.
  - O desenho deixa a task 9 simular um gesto: `chainOf(comADecisão(drafts, id, d)).due()` menos o `due()` de agora.
- **`state.go`**: `DraftState{Draft, Hold, Publishing}` (saem `Waits`, `CanPublish` e `Hint`); os status `StatusEpicCantPublish`, `StatusEpicDiscarded` e `StatusReadyToArchive` no lugar de `StatusPublished`; `status()` pela tabela e `State.Waiting` sem as linhas 2 e 9; `canArchive(chain, publishing)` com as razões novas; `State.ShortEpic()` e `State.DiscardedEpic()`. Saem `pending`, `waits`, `epicReady`, `epicSettled`, `epicWaits`, `minEpicCards` (vai para `chain.go`) e as constantes `hint…`.
- **`publish.go`**: `dueTargets` passa a `chainOf(effectiveDrafts).due()`; saem `looseDue` e `epicDue`; `standsAlone` e `orderTargets` ficam, usados pela cadeia.
- **`decide.go`**: saem `PublishEpic`, `forgetEpicOf`, `requestEpic`, `forgetEpic`, `epicRequested`, `epicRunOf` e `epicRun`; `SetDraftEpic` só chama `discussions`; `Decide` recusa o rascunho que `unrecorded` guarda como começado; `Retry` pela §4.2. **`discussionflow.go`**: saem `ErrNotReady` e `epicsRequested`. **`evaluate.go`**: `publishDue` antes do `if !open`.
- **A migration `0023_discussion_chain.sql`** da §4.2, com o teste em `migrate_test.go`.
- **`internal/attention`**: `KindEpicCantPublish`, `KindEpicDiscarded` e `KindReadyToArchive`, com `ready_to_archive` em `GroupClosing` (`Kind.Group`, `situation.go:58–68`); `DeriveDiscussion` por `State.Waiting`, pela tabela da §4.2; `epicCantPublishBody(approved, cards)`, `epicDiscardedBody(approvedCards)` e `readyToArchiveBody()` em `text.go`.
- **Bindings**: `Draft` (`dto.go:1229–1273`) ganha `Hold DraftHold` (`json:"hold"`), com `DraftHold{Reason, Title, Left, Approved, Cards}` (`reason`, `title`, `left`, `approved`, `cards`), e perde `Waits`, `CanPublish` e `Hint` (1260–1267); o comentário de `DiscussionSummary.Status` (1287–1289) com os status novos; `fromDraft` (`convert.go:1829–1869`); `DiscussionService.PublishEpic` (`discussion_service.go:190–200`) sai; `userMessages` (`task_service.go:810–830`) perde `discussionflow.ErrNotReady` e ganha `discussion.ErrUntitled` → `Name the draft to approve it.`, e `discussionflow.ErrCannotArchive` continua. Depois, `task generate`.
- **Frontend**:
  - `lib/wails.ts`: `DiscussionStatus` (471–478) e `asDiscussionStatus` (1095) com os três estados, sem `published`; `SituationKind` (346–367) e `asSituationKind` (829) com os três tipos; `DraftHold` exportado com os tipos gerados (38–41, 139–142); `publishEpic` (1319–1320) sai. `test/wails-mock.ts`: `makeDraft` com `hold` no lugar de `waits`, `canPublish` e `hint` (1054–1056); o `canPublish` de `makeReview` (904) fica; `publishEpic` (261) sai.
  - `store/actions.ts`: `publishEpic` (787–793) sai.
  - `lib/situations.ts` (`situationLabel`, 101–104), `features/sidebar/sidebar-tree.ts` (a linha, 444–448; `discussionStanding`, 600–609), `features/discussion/*` pela §4.2.
  - Os testes que citam o que sai: `EpicGroup.test.tsx` (47–72), `ArchivedDiscussionView.test.tsx:84`, `app/App.test.tsx:284`, `store/actions.test.ts:50`, 955–960, `lib/wails.test.ts:523`, `sidebar-tree.test.ts:684`, 838, `TreeRow.test.tsx:200`, `discussion-status.test.ts:31`, 38.
- **A tabela da cadeia** (`chain_test.go`), uma linha por caso, com o que vai na corrida na ordem, o `hold` de cada rascunho, o status e a razão de **Archive**:
  1. card solto aprovado, sem dependência: vai;
  2. solto aprovado que depende de um sem decisão: `draft`; aprovada a dependência, vão os dois, ela antes;
  3. solto que depende de um descartado: vai;
  4. épico sem decisão, card aprovado: `epic`;
  5. épico aprovado, um de três cards decidido: `cards` com `left` 2 no épico e no card aprovado;
  6. épico aprovado, tudo decidido, dois aprovados e um descartado: o épico e os dois, nessa ordem;
  7. épico aprovado, tudo decidido, um de três aprovado: `epic_short` `1 of 3`, `epic_cant_publish`, **Archive** recusado com a primeira variante;
  8. épico aprovado, os três cards descartados: `epic_short` `0 of 3`, a segunda variante;
  9. épico aprovado com um card só, aprovado: `epic_short` com `cards` 1, a terceira variante;
  10. épico aprovado sem cards: `epic_short` com `cards` 0, `Approved · the epic has no cards`, a quarta variante;
  11. épico descartado, card aprovado: `epic_discarded`, status `epic_discarded`, **Archive** permitido;
  12. solto aprovado que depende do card do item 11: `draft`, "não vai publicar", **Archive** permitido;
  13. o caso transitivo: um épico E aprovado, com os cards decididos e dois aprovados, cujo card c1 depende do card do item 11: E `draft`, os cards de E `epic`, todos em "não vai publicar", status `epic_discarded`, **Archive** permitido, todos `Not published`;
  14. épico descartado, cards sem decisão: `deciding`, os cards com `epic_discarded`;
  15. uma falha num solto A e um solto B aprovado e independente: B vai; `publish_failed`; **Archive** recusado;
  16. uma falha num solto A e um solto C que depende de A: C `draft` com o título de A;
  17. um épico que falhou depois de começar, com cards aprovados: o épico sem `hold` (a própria falha), os cards `epic`;
  18. um épico começado sem falha, com um card aprovado e dois descartados: o épico e o card vão (o portão já não vale);
  19. épico aprovado cujo card depende de um solto sem decisão: o épico `draft`; aprovado o solto, vão o solto, o épico e os cards;
  20. dois soltos aprovados que dependem um do outro: vão os dois, pela posição;
  21. um ciclo entre um solto aprovado e um card de um épico com a condição fechada: vão o épico, o card e o solto, quebrado pela posição;
  22. um ciclo entre cards de dois épicos com a condição fechada: vão os dois épicos e os cards, quebrado pela posição;
  23. épico no GitHub e um card dele aprovado depois: vai sozinho;
  24. todos descartados: `ready_to_archive`, **Archive** permitido;
  25. todos no GitHub: `ready_to_archive`;
  26. um aprovado que vai e a corrida ainda não começou: `publishing`, `Waiting` sem situação, **Archive** recusado;
  27. um épico descartado com card aprovado e outro rascunho sem decisão: `epic_discarded`;
  28. um épico `epic_short` e outro rascunho sem decisão: `deciding`;
  29. uma corrida em curso e um rascunho sem decisão: status `publishing`, `Waiting` `deciding`; a corrida em curso com tudo o mais no GitHub: `Waiting` sem situação, e `ready_to_archive` só depois dela.

## 5. Inventário atual

### 5.1 O backend

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `internal/discussionflow/decide.go` (270) | `Decide` (11–19); `SetDraftEpic` com `forgetEpicOf` (38–53, 111–127); `edit` (80–99); `PublishEpic` (134–154); `Retry` pela corrida do épico (156–189); `writeUnrecorded` (191–212); `epicRunOf`, `epicRun` (214–237); o pedido do épico na memória (239–270) | `PublishEpic` e a memória saem; `Retry` limpa tudo |
| `internal/discussionflow/state.go` (321) | Os seis status (11–22); as `hint…` (27–40); `DraftState` com `Waits`, `CanPublish`, `Hint` (42–55); `State` (80–109); `status` com `pending`, que deixa `deciding` com tudo decidido (131–162); `waits`, `epicReady`, `epicSettled`, `epicWaits` (183–266); `canArchive` sem o épico (268–282) | Pela cadeia |
| `internal/discussionflow/publish.go` (847) | `publishDue` (32–58); `dueTargets` com o pedido do épico (60–97); `looseDue`, `standsAlone`, `epicDue` (152–197); `orderTargets` (199–247); `publishRun` (249–283); os passos (399–649); a falha (681–748) | `dueTargets` pela cadeia; o resto fica |
| `internal/discussionflow/discussionflow.go` (240), `evaluate.go` (153), `delete.go` (81), `sync.go` (34) | `ErrNotReady` (77); `epicsRequested` (120–122, 216); `publishDue` depois do teste da conversa (`evaluate.go:29–41`); `Archive` pela `State` (`delete.go:19–49`); `Sync` que avalia cada discussão (`sync.go:14–34`) | Saem os dois; `publishDue` antes; o resto fica |
| `internal/discussionflow/*_test.go` | `decide_test.go` (154–447), `publish_test.go` (40–570), `status_test.go`, `delete_test.go`; `helpers_test.go` com o `memGH` (274–436) | Reescritos pela regra; `chain_test.go` novo |
| `internal/discussion/service.go` (842), `reconcile.go` (201), `discussion.go` (333) | As edições (295–402); `Decide` (404–413); `GroupIntoEpic` (416–460), com `epicMembers` que aceita um card de outro épico (463–479); `ClearPublishErrors` (533–560); `writeDraft` (697–724); `reconcile`, `normalize`; os erros (316–333) | A aprovação que sai; `ErrUntitled` |
| `internal/store/migrations/` (até `0019`; `0020`–`0022` das tasks 4, 6, 7), `discussions.go` | `discussion_drafts` (`0017`), `WriteDrafts` (264), `UpdateDraft` (343) | `0023` |
| `internal/attention/derive_discussion.go` (51), `situation.go`, `text.go` (292) | O status decide a situação (33–49): `deciding` → `drafts`, `publish_failed` → `publish_failed`, o resto sem situação; os corpos (185–200) | Os três tipos e textos |
| `internal/gh/issues.go` (367) | As escritas de uma publicação (150–264) | Nada muda |
| `internal/app/app.go`, `notifications.go`; `internal/platform/xdg/xdg.go` | A instância única pelo D-Bus (66, 384–387); a notificação pelo D-Bus de sessão (19); os diretórios pelo XDG (20–21, o log em 46) | Nada muda: é o que a prova do step 5 respeita |
| `internal/bindings/dto.go`, `convert.go`, `discussion_service.go`, `task_service.go` | `Draft` com `waits`, `canPublish`, `hint` (1229–1273); `fromDraft` (1829); `PublishEpic` (190–200); `ErrNotReady` na frase (821) | §4.4 |

### 5.2 O frontend

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `features/discussion/EpicGroup.tsx` (86) | O rodapé com **Publish epic**, a `hint` e o erro (52–83) | O rodapé sai |
| `features/discussion/DraftCard.tsx` (465) | O canto de estado: resultado, falha com **Retry**, `Publishing…`, `Waits for` âmbar, a `hint` só nos cards (179–227) | `holdLabel` |
| `features/discussion/DraftsPanel.tsx` (127) | O painel acima da conversa | Fica |
| `features/discussion/DiscussionBar.tsx` (43), `DiscussionHeader.tsx` (112) | O rótulo, o tom, a razão do artefato, `Publishing…` | O meio dos estados novos, o tom `done` |
| `features/discussion/discussion-status.ts` (174) | `discussionStatusLabel` (19–34), `discussionStatusTone` (41–53), `waitsLabel` (155–157) | §4.2 |
| `features/sidebar/sidebar-tree.ts` | `Decide drafts · a of b` (444–448); `published` como `Ready to archive` sem relógio e fora do `Ctrl+J` (600–609) | As linhas da §4.2 pela situação |
| `lib/situations.ts`, `lib/wails.ts`, `store/actions.ts`, `test/wails-mock.ts` | Os tipos e as ações de hoje, com `publishEpic` | §4.4 |

### 5.3 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| O que vai na corrida e o que segura cada rascunho | `waits` e a `hint` do épico, parciais | `hold` (M2), de `chain.go` |
| O estado da discussão com tudo decidido | `deciding` de pé | Os três estados (M2) |
| As situações e os textos | — | P26 |
| O pedido de publicar o épico | Na memória, perdido ao reiniciar | Não existe mais |
| As contagens da barra e da árvore | Os rascunhos com a decisão e o resultado | Só frontend |

### 5.4 Medido nos dados reais

Do banco (`~/.local/share/myspec/myspec.db`, só leitura), em 2026-09-29:

- **21 discussões**, de 21 a 29 de setembro, todas arquivadas; **nenhuma ativa**.
- **41 rascunhos**, todos do agente, todos aprovados e publicados (40 criados, 1 atualizado); nenhum descartado, nenhuma falha guardada.
- **Toda discussão com mais de um rascunho foi um épico com os cards dele**: 13 discussões de um card solto, 4 de um épico com dois cards, 4 de um épico com três. São 8 épicos, 20 cards de épico e 13 soltos. **Publish epic** foi o segundo gesto em 8 das 21 discussões, e em todas elas todo card foi aprovado: a cadeia teria publicado no último gesto, com o mesmo resultado.
- **12 dependências**, todas entre cards do mesmo épico, todas registradas no GitHub; nenhuma para issue existente, nenhuma deixada de lado.
- **A corrida de um épico** levou de 7 a 14 s do épico ao último card (de 3 a 4 rascunhos), o tempo em que as decisões ficam recusadas e o painel diz `Publishing…`.
- `research/discussion.md` §2 mediu 11 discussões em 2026-09-24, com uma de 10 rascunhos em 5 rodadas; ela não está mais no banco.

## 6. As tasks 4, 7, 8 e 9, os riscos e o primeiro step

**A ordem.** A 8 começa da `main` com as tasks 4 a 7 mergeadas e não corre em paralelo com nenhuma (`implementation.md` §1). A 9 depende da 8: ela apaga `DraftsPanel`, `DraftCard`, `EpicGroup` e `DiscussionBar`, e reusa o `hold`, `holdLabel`, os status e as situações que a 8 deixa, acrescentando a rodada (P25) aos rótulos.

| Arquivo | Task 4 | Tasks 6 e 7 | Task 8 | Task 9 |
|---|---|---|---|---|
| `internal/discussion`, `internal/discussionflow` | — | — | A cadeia, a aprovação que sai, `PublishEpic` sai | O que um gesto publicaria (F16), as rodadas (P25), os marcos (P10), a versão anterior (P24) |
| `internal/attention/situation.go`, `text.go`, `derive_discussion.go` | — | As formas de `review_report` e `findings`, os textos | Os três tipos e textos da discussão | — |
| `internal/store/migrations/` | `0020` | `0021`, `0022` | `0023` | a dela, se precisar |
| `internal/bindings/dto.go`, `convert.go`, `task_service.go` | Os DTOs da conversa | Os do review e da PR | `Draft.hold`; `ErrUntitled`; `PublishEpic` sai | Os campos da tela |
| `lib/wails.ts`, `test/wails-mock.ts`, `store/actions.ts` | As variantes `InPlace`, `readActionOutput` | As ações do review e da PR | `DraftHold`, os status, os tipos; `publishEpic` sai | As ações da tela |
| `lib/situations.ts`, `features/sidebar/sidebar-tree.ts` | `lowerFirst`, o fragmento de `findings` | Os rótulos do review e da PR | Os três tipos da discussão | A rodada nas linhas |
| `features/discussion/DiscussionView.tsx` | O compositor | — | — | Reescrita |
| `DraftCard`, `EpicGroup`, `DraftsPanel`, `DiscussionBar`, `DiscussionHeader`, `discussion-status.ts` | — | — | O mínimo | Saem ou são reescritos |
| `docs/product/features.md` | §Sessões e conversas | §Centro de review, §Review de pull request | §Rascunhos de cards, §Épico, §Aprovar e publicar, §A discussão como item, §Depende de mim | §Discussão inteiro |

| Risco | Tratamento |
|---|---|
| **Publicar sem gesto** | Só uma decisão, o **Retry**, o fim de uma corrida e o `Sync` disparam; as edições retiram a aprovação; a `0023` cobre o épico aprovado antes da regra; a tabela da cadeia e o pronto 3 provam |
| **Criar duas vezes** | Os passos gravados; a cadeia recalculada dentro da corrida; uma corrida por vez; o teste de **Retry** conta as chamadas de `createIssue` (pronto 2) |
| **Uma falha escrita fora de ordem** | A falha segura o que a alcança pelo fecho; os independentes seguem, como hoje; o **Retry** limpa todas; descartar um que falhou sem começar também solta o dependente, sem a dependência |
| **Um ciclo que trava** | O fecho aceita um ciclo entre aprovados; os itens 20 a 22 da tabela |
| **A regra duas vezes** | Uma função só em Go; a task 9 pede a ela o que o gesto publicaria (§4.3 #12) |
| **A tela antiga dizendo menos que a regra** | O mínimo da §4.2: o que segura cada rascunho e o meio da barra; a linha do gesto é da task 9 |
| **O banco e as tasks do usuário** | A prova roda sobre diretórios vazios, com o MySpec instalado fechado e a task 8 pausada (§4.2) |
| **As issues da prova** | Uma demanda real do usuário, no board dele; o que é criado e como se limpa estão na §4.2 |
| **Uma situação que pisca de novo** | `State.Waiting`: a situação fica de pé durante a corrida (caso 29, pronto 4) |

**Como o primeiro step é feito.** Em `internal/discussion`: `ErrUntitled`, a falha limpa por uma nova decisão, a recusa de agrupar um card de outro épico, e a aprovação que sai nas edições e na revisão do agente, com os testes do pronto 3; e, na fronteira, a frase `Name the draft to approve it.` em `userMessages`, com o teste em `discussion_service_test.go`, para a recusa nunca chegar crua ao usuário. Com **Publish epic** ainda no produto, nada publica sozinho por isso; o comportamento visível é a aprovação que sai numa edição da cadeia, que o step diz em `features.md` §Rascunhos de cards.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/product/features.md` §Rascunhos de cards, §Épico | Uma edição do repositório, do épico ou das dependências de um aprovado, e a revisão do agente que tira o épico ou uma dependência dele, retiram a aprovação; agrupar só aceita cards soltos; um rascunho sem título não é aprovado | 1 |
| `docs/architecture/overview.md` §A discussão (85–91) | A cadeia como função pura, o que dispara uma corrida, a falha que segura o que depende dela, o **Retry** que continua a cadeia, a situação que fica de pé durante a corrida | 4 |
| `docs/product/features.md` §Épico | O grupo sem as ações do épico: ele publica pela cadeia | 4 |
| §Aprovar e publicar | Reescrita: a regra da cadeia, o que segura cada rascunho com os textos, a dependência num descartado e num card que não vai publicar, a falha que segura os dependentes e deixa os independentes seguirem, o **Retry**, descartar o que falhou, **Publish epic** fora | 4 |
| §A discussão como item | Os estados (`Epic can't publish`, `Epic discarded`, `Ready to archive` no lugar de `Drafts published`); a linha da árvore com a situação; `Ready to archive` no `Ctrl+J`, com a notificação; as razões de **Archive** | 4 |
| §Depende de mim | A discussão espera também com um épico que não publica e com um épico descartado de cards aprovados, e fica pronta para arquivar | 4 |
| `docs/development/troubleshooting.md` (33) | Sem o pedido de **Publish epic**; as mensagens novas que a cadeia registrar, se houver | 4 |

`storage.md` não muda: a `0023` só muda dados, e as tabelas ficam como estão. `sessions.md` não muda: o prompt da discussão não fala da publicação.

## 8. Plano de steps sugerido

Cinco steps, do domínio para fora; o step 4 tem sozinho o tamanho de um G. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria. O app fica usável em todos: até o step 4, **Publish epic** existe e a regra antiga vale; no step 4 a regra, os dados, o painel e a documentação mudam juntos.

1. **Só a decisão publica.** `internal/discussion`: `ErrUntitled`, a falha limpa por uma nova decisão, a recusa de `epicMembers`, a aprovação que sai nas edições e na revisão do agente, com a escrita única de `SetDraftEpic`; `ErrUntitled` em `userMessages`, com o teste em `discussion_service_test.go`; testes de `service_test.go` e `reconcile_test.go`; `features.md` §Rascunhos de cards e §Épico. É o primeiro step da §6.
2. **A cadeia e as situações, sem uso.** `discussionflow/chain.go` com a tabela da §4.4 em `chain_test.go`; em `attention`, os três tipos, o grupo e os corpos com as variantes de `rest.md` §11, com os testes de `text`. Nada chama ainda.
3. **O frontend aprende os estados, sem uso.** `lib/wails.ts` com os três estados (ainda com `published`) e os três tipos; `situations.ts` com os rótulos e os fragmentos; `sidebar-tree.ts` com as linhas; `discussion-status.ts` com os rótulos, os tons, `standingDetail` e `epicWayOut`; `DiscussionBar` com o meio e o tom, `DiscussionHeader` com o tom; os testes, com fixtures. O Go ainda não os emite.
4. **A virada.** O maior step: cerca de 20 arquivos, porque os bindings gerados acoplam o Go e o frontend. `state.go` (com `State.Waiting`), `publish.go`, `decide.go` (com a recusa do começado na memória), `evaluate.go` e `discussionflow.go` pela cadeia; `DeriveDiscussion` por `State.Waiting`; `PublishEpic` sai do Go, dos bindings e do frontend; a `0023`; `Draft.hold` na fronteira; `task generate`; `lib/wails.ts` sem `published` e com `DraftHold`; `test/wails-mock.ts`; `holdLabel` e o `DraftCard`; o rodapé do `EpicGroup`; `discussionStanding`; os testes do fluxo do pronto 2 contra o `memGH`, a invariante do pronto 3, o da `0023` e o da fronteira; a documentação do step 4 da §7. Depois do commit, o `design-critic` revisa este step sozinho, antes do step 5.
5. **A prova e o fim.** O ponto de parada da §4.2 (A prova no GitHub): o implementador para, o usuário opera a prova sobre diretórios vazios e entrega o resultado, que o implementador registra na pull request; a conferência de `docs/` contra o que a task fez; o que a prova achar, corrigido no mesmo step.

Depois do step 5, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch, e a pull request só é dada como pronta com o CI verde.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md`:

- D3 e D4 (a D4 é da task 9), confirmadas pelo usuário (`decisions.md`, 2026-09-25, Plano confirmado);
- D5 e D13, decididas na tela da discussão (`decisions.md`, 2026-09-24);
- D15 e D16, decididas pelo coordenador por delegação em `decisions.md` (2026-09-29, "Discussão: o que a entrada da task 8 decidiu").

O resto também foi decidido por delegação, na mesma entrada:

- a dependência que alcança um card que não vai publicar segura o dependente sem segurar o arquivamento;
- um ciclo entre aprovados publica junto;
- a `0023` devolve a `Not decided`, sem falha, o épico aprovado antes da regra;
- tudo descartado é `Ready to archive`;
- a situação fica de pé durante a corrida;
- F16 vem do Go na task 9.

D16 é a regra de hoje, fechada: um card aprovado sem dependência publica direto também depois de uma falha, como o usuário respondeu (`research/interview.md:45`). Nenhuma decisão apaga dado que não se refaça com um gesto, e nenhuma desdiz o aprovado.

No step 5, o usuário opera a prova (§4.2): pausa a task, fecha o MySpec, escolhe a demanda da discussão e limpa os diretórios depois.
