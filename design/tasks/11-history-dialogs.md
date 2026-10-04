# Task 11 · History, arquivados, diálogos da task, avisos, toasts e notificações

Material de entrada da décima primeira task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 11 de `design/implementation.md` (§2, linhas 163–173), com os princípios da §1 (9–22) e os riscos da §3 (203–214). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** O material está sobre a `main` em `c9ab0ea`, com as tasks 1 a 10 mergeadas: as quatro de que a task depende (4, 6, 9 e 10, `implementation.md:171`) estão nela. As linhas de código citadas são as de `c9ab0ea`, e o primeiro step confere o inventário contra a `main` em que a task começa (§8, step 1). As linhas de `design/` são as da `main` em `c9ab0ea`. A task não cria migration: todo dado que ela expõe já é gravado (§4.4).

Toda decisão de design está tomada neste documento, em `design/screens/rest.md` §3, §4, §8, §9, §10 e §11, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; o que a task abria de produto está na §9.

**Nenhum comportamento de hoje se perde.** Cada controle das telas que saem tem um lugar novo, dito na §4.2 e provado pelo pronto 6: do History, a busca com o foco, o filtro por repositório (agora o da lateral, com o chip), as três listas misturadas pela data, o nome, o repositório curto, o link `#N ↗` da PR, `One-Shot` ou `N steps`, o autor e o desfecho do review, o board e `N cards published` da discussão, as datas, os três vazios; da task arquivada, `Archived`, o link do card, o apagar, as datas, a contagem de steps, o link da PR, as abas **PRD**, **Tech spec** e **Steps**, o arquivo de cada step, os relatórios de cada step, **← Steps**, o documento One-Shot com os relatórios, `Nothing written yet.`, o esqueleto e o erro de leitura; do review arquivado, o desfecho, o link do card, **Open on GitHub**, o apagar, o autor, as datas, o veredito e a data de cada passada publicada, cada apontamento publicado com o lugar e onde foi, o relatório, `No report was written.`; da discussão arquivada, `Archived`, o apagar, as datas, `N cards published`, o documento ou `No document was written.`, os rascunhos com o que viraram e o link, os épicos com os cards, a conversa inteira somente leitura; de **Delete task**, a prévia (a sessão, a worktree com os arquivos não commitados e o caminho, a branch não mergeada, a PR que fica), o erro de leitura, **Cancel**, **Delete**; de **Discard step**, o texto com e sem revisor, **Also clean the worktree** marcada a cada abertura, **Discard**; de **Back to…** e **Discard and restart…**, o título, o que se perde por etapa, a PR que fica aberta, **Back** e **Discard**; de `Some files stayed on disk`, o caminho, a branch e o erro do git; do toast de arquivamento, o nome e **Open in History**; das notificações, os corpos de hoje. As mudanças de comportamento são as de `changes.md` X10–X16, X20 e S7 nos casos da task.

**Vocabulário.** "O arquivado" é o lugar de uma task, um review ou uma discussão do History; "a página que saiu" é a página do item que saiu (`components.md` Página do item que saiu); "a prévia" é a lista do que um apagamento destrói, lida do git ao abrir o diálogo; "o que ficou no disco" é o que o git não removeu num apagamento (`Leftover` hoje); "a janela" é o pedaço do History que o estado traz, os últimos 90 dias; "os antigos" são os arquivados fora dela; "a linha recém-arquivada" é a linha a que se chega por **Open in History**.

## 1. Objetivo e critério de pronto

History vira uma lista só, por dia, com o tipo, onde, o resultado e a hora, o filtro da lateral como chip e os antigos sob demanda; os arquivados mostram primeiro o resultado (o encerramento da task com a aba **Pull request**, cada passada do review, o que a discussão publicou); os três diálogos destrutivos da task dizem o que será perdido, com as contagens lidas do git, e ficam abertos até o fim; a task encerrada ou apagada com a tela aberta dá lugar à página dela, com o resultado do encerramento ou o que ficou no disco e o comando para remover; o toast passa a valer para review e discussão, com o resultado; o aviso do app fica só para as ações sem lugar próprio; e as notificações ganham os 61 textos de `rest.md` §11 e o título do review com o título da PR. Do Go, a task pede P27, P28, P29, P30, P33 e P37 (§4.4). Tamanho: G, catorze steps (§8; `implementation.md` §2).

**Pronto quando** (`implementation.md:173`), cada item provado como diz:

1. **As cenas.** As fixtures de `test/history-scenes.ts` reproduzem `lab/14-screen-rest/src/data.js` (os 44 itens de `HIST`, 104–150, em 12 dias; os encerramentos que pularam a base, `SKIPPED`, 151; os dias, 103) e `src/history.js` (a task, o review e a discussão arquivados, 53–98), com o relógio fixo em 2026-09-24 às 15:10 e os dados coerentes (o mock tem contradições que não entram, §4.3 #27). As cenas da task (`delete-task`, `discard-step`, `back-to-stage`, `pause`, `notice`) usam a task `t1` (`Rate limit per API key`) e o relógio de `test/task-scenes.ts`. Quatro testes pintados (Chromium, claro e escuro), os dois primeiros no step 12a e os dois últimos no 12b (§8), montam as cenas de `lab/14-screen-rest/index.html` com as variações de `?v=`: `features/history/HistoryView.scenes.painted.test.tsx` (`history` —, `fresh`, `filtered`, `no-match`, `empty`), `features/history/Archived.scenes.painted.test.tsx` (`archived-task` —, `steps`, `pr`, `oneshot`, `delete`; `archived-review` —; `archived-discussion` —), `features/task/TaskDialogs.scenes.painted.test.tsx` (`delete-task` —, `loading`, `failed`, `merged`, `deleting`; `discard-step` —, `keep`; `back-to-stage` —, `pr`, `discard`; `pause` —, `pausing`, `blocked`) e `features/navigation/GoneView.scenes.painted.test.tsx` (`gone` —, `deleted`, `review`, `discussion`, `nothing`; `notice` —, `toast`), cada cena a 2180 px de área principal (o monitor inteiro) e a 978 px (a metade), e as do History também a 812 px (a janela de 1100, onde a lista passa a duas linhas). As cenas decididas só neste material entram como `?v=` próprios, sem mock, comparadas com a cena vizinha: `history` `older-loading`, `older-failed`, `filtered-empty`; `archived-review` `apply`, `delete`; `archived-discussion` `delete`; `delete-task` `error`, `planning`; `discard-step` `reading`, `oneshot`; `back-to-stage` `oneshot`; `gone` `deleted-clean`, `review-deleted`; `notice` `toast-three`. Em cada uma o teste confere: toda linha, bloco, faixa, diálogo e coluna em pixel inteiro, e o diálogo a `round(8vh, 1px)` do topo; as colunas de duas linhas seguidas do History alinhadas; todo texto cortado com tooltip; no máximo uma primária na camada de cima. As provas são as das tasks 9 e 10 (`test/painted.ts`): `offWholePixels`, `cutTexts` com `withoutTooltip`, `visiblePrimaries` e, nos diálogos, `footerPlaces` (**Cancel** e a confirmação no mesmo lugar à direita, com e sem a falha). Grava as capturas, anexadas à pull request lado a lado com o mock (`task captures` e `task captures:push`, como nas tasks 5 a 10; o mock servido com `python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090, que é a do coordenador; `14-screen-rest/index.html?scene=…&v=…`), com `TZ=UTC` e o ponteiro no canto (`capture`, `test/painted.ts:401–419`), como as PRs #82 e #88, e os nomes no padrão `<área>-<cena>-<variação>-<largura>-<tema>` de `docs/guidelines/testing.md:82`. Nenhuma captura sai com um tooltip aberto: a página que saiu começa com o foco em **Next that needs you**, cujo tooltip `Next: …` cobriria a tela (`critique-task-09.md:158, 184`), então o foco sai antes, como em `features/settings/SettingsView.scenes.painted.test.tsx:182–189`; e a captura vem antes de `withoutTooltip`, que rola a área até os cortes (`critique-task-09.md:493–497`; `critique-task-10.md:187`), ou depois de devolver a rolagem.
2. **O teclado** (`features/history/HistoryView.keys.test.tsx`, os testes de cada diálogo e de `GoneView`, jsdom): `/` foca a busca e `↓` dela vai ao primeiro cabeçalho; `↑` `↓` `Home` `End` percorrem os cabeçalhos dos dias e as linhas, numa parada de Tab só; `←` numa linha leva ao cabeçalho do dia dela, e `→` num cabeçalho à primeira linha dele; `Enter` numa linha abre o arquivado; chegando por **Open in History**, o foco está na linha recém-arquivada; a linha que chega ao fim pede os antigos; `Esc` no diálogo fecha e devolve o foco ao gatilho; os diálogos destrutivos abrem em **Cancel**, também quando abertos pelo `⋯`, com o Tab preso neles (§4.3 #33), e não confirmam por `Ctrl+Enter`; confirmando, `Esc` fica inerte; o foco depois de cada desfecho é o da §4.2 (O teclado e o foco).
3. **O Go** (§4.4): os testes de tabela de P27 e P28 (o resultado do encerramento, a PR com a base e quem fez o merge, o SHA de cada step, se há rascunho da PR e a lista dos relatórios dela, e uma arquivada antes desses dados, sem eles), P29 (o que ficou no disco por parte, com o caminho do clone: worktree e branch removidas, só a worktree, só a branch, as duas; o do review), P30 (os commits fora da base: mergeada, não mergeada com N, sem base, a contagem que falha), P33 (a janela de 90 dias, o resumo com as contagens por tipo e por repositório e a data mais antiga, a página seguinte por data, a busca que alcança os antigos e devolve o total do que casa, um arquivado pedido pelo id) e P37 (`internal/attention/text_test.go`: uma linha por texto dos 61 da §4.2, mais as variantes e as razões da mesma seção; o título do review com o título da PR; `readyToContinueBody` sem artigo); os testes de `derive_test.go`, `derive_review_test.go` e `derive_discussion_test.go` que leem os corpos mudam no mesmo step; `task generate`, `lib/wails.ts` e `test/wails-mock.ts`.
4. **As funções puras** testadas em tabela (§4.4, Onde moram): o dia de uma data (`Today`, `Yesterday`, `Monday, Sep 22`, `Monday, Sep 22, 2025`), a contagem e o período da barra, a linha de cada tipo (onde, o resultado, a hora, o nome acessível), a busca (nome, título, `#N` da PR e do card), as linhas do encerramento com o que fazer, os fatos de cada arquivado com as datas, a frase das passadas de um review, as linhas da prévia, os itens que se perdem por etapa com as contagens, os textos do **Discard step**, a linha da sessão interrompida, os textos das páginas que saíram, as linhas e o comando do que ficou no disco, o texto e o detalhe de cada toast, a razão de uma notificação (§4.2, A razão).
5. **A página da task apagada** mostra o comando com **Copy** e o aviso do `--force`, num teste de componente com o que ficou no disco em cada combinação de P29.
6. **Onde foram as ações.** `features/history/where-actions-went.test.tsx` tem uma linha por controle do terceiro parágrafo e por estado em que ele aparece hoje; nenhum fica sem lugar. Em cada cena, no máximo uma primária.
7. **Os tokens.** Nenhum token novo: `--list-measure`, `--col-where`, `--col-result`, `--col-time`, `--measure`, `--measure-read`, `--size-dialog`, `--size-toast`, `--epic-indent` e `--notice-detail-min` já estão em `design/system/tokens.css` (56–57, 75, 87, 97, 108–110, 113).
8. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
9. **Documentação** da §7 escrita no step de cada área; `features.md` §Histórico (com §Histórico de um review e §Histórico de uma discussão), §Apagar uma task, §Voltar e descartar, §Descartar step, §Encerramento e arquivamento (com §A página do item que saiu), §Depende de mim e §Atalhos reescritos.
10. **Na máquina alvo, pelo usuário** (a checklist `## Verification on the target machine` no corpo da pull request, como nas PRs #82 e #88: uma caixa por item, com o preparo e o texto que confere, e uma caixa das capturas que o usuário manda, que entram na pull request): uma notificação real de uma task e uma de um review, com a janela fora de foco, mostram o título e o corpo novos (`acme/web#2291 · <título da PR>`); o toast de um review que é mergeado no GitHub sem estar aberto aparece com o resultado (escrita no GitHub: um merge feito pelo usuário); apagar uma task real mostra a prévia com as contagens da worktree e da branch. O implementador prova antes, no Go e nas cenas, tudo o que não depende do servidor de notificação nem do GitHub.
11. **Revisão do `design-critic`** na branch contra este material, `rest.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`); a pull request só é dada como pronta com o CI verde.

`changes.md`: X10–X16, X20, S7 nos casos da task. `backend.md`: P27, P28, P29, P30, P33, P37; F19 e F20.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 11 (163–173), riscos (203–214) | O escopo, o app sempre usável (15), os testes que migram (22), o tamanho de step (7) |
| 2 | `design/decisions.md`: Settings, History, boas-vindas, diálogos e avisos (2026-09-25, 153–155); as entradas das tasks 9 e 10 (2026-09-29, 105–111); as da task 11 (2026-10-02, 85–103, e 2026-10-03, 5–11) | O que o usuário aprovou na rodada 14 e o que as duas tasks anteriores decidiram |
| 3 | `design/screens/rest.md` §1 (18–26), §3 (282–319), §4 (320–367), §8 (434–451), §9 (453–474), §10 (475–523), §11 (524–620), §12 (621–633), §13 (634–659), §14 (Histórico, Encerramento, Apagar, Voltar e descartar, Depende de mim: 724–749), §15 (750–769), §16 (770–800) | As telas, os textos, os estados, os atalhos e o que muda |
| 4 | `design/structure.md` §1 (7–38, em especial 38), §2 O filtro e o rodapé (194–198), §4 History (341), §5 (355, 358), §6 (396), §7 (420, 424) | A página que saiu, o filtro da lateral, a lista do History, as larguras |
| 5 | `design/principles.md` 2 (13–33), 5 (51–57), 8 (75–87), 10 (97–103) | A primária única, o `◇`, o brilho contra o spinner, o pixel inteiro |
| 6 | `design/system/components.md`: estados comuns (18–28), Troca de lugar (152), Botão (162), Menu do item (229), Caixa de seleção (240), Cabeçalho do lugar (316), Rodapé da lateral (386), Página do item que saiu (408), Estado vazio de página (416), Esqueleto (434), Faixa de aviso (442), Linha afundada (453), Aviso do app e toast (462), Abas (489), Marco em linha (561), Bloco de código (614), Apontamento (675), Linha de lista (712), Cabeçalho de seção (726), Barra de filtros (737), Diálogo (790), Prévia de um apagamento (813), Resultado do encerramento (820), Marca e cópia (885), Tamanhos de layout (893) | Anatomia, estados, teclado e acessibilidade de cada peça |
| 7 | `design/system/tokens.css`: medidas (56–57), tamanhos (75), recuo do épico (87), listas e colunas do History (97, 108–110), aviso (113), camadas (127) | `--list-measure`, `--col-where`, `--col-result`, `--col-time`, `--size-toast`, `--notice-detail-min`, `--z-toast` |
| 8 | `design/changes.md` S7 (17), X10–X16 (137–143), X20 (147); `design/backend.md` P27–P30 (91–94), P33 (97), P37 (107), F19, F20 (130–131) | O que muda de comportamento e os dados |
| 9 | `design/research/rest.md` §2.7–§2.10 (177–216), §3 (230–275), §5 (290–358), §6 (360–377), §7 (378–400), §9 (426–443) | O produto de hoje campo a campo, os textos do encerramento e o volume real |
| 10 | Mocks, com `python3 -m http.server <porta> -d design/lab`: `14-screen-rest/index.html` (`?scene=` `history`, `archived-task`, `archived-review`, `archived-discussion`, `notice`, `gone`, `delete-task`, `discard-step`, `back-to-stage`, `pause`, `notifications`, com `?v=` e `?audit`) e as fontes `src/history.js` (a lista 8–41, o cabeçalho do arquivado 42–47, o encerramento 48–52, a task 53–77, o review 78–88, a discussão 89–98), `src/other.js` (o aviso e os toasts 47–57, a página que saiu 59–80, Delete 81–94, Discard step 95–101, Back 102–115, a pausa 116–124, as notificações 125–190), `src/data.js` (103–151), `src/rest.css` (History 223–248, o arquivado 249–323, as notificações 366–379, o resto 400–431); `14-screen-rest/components.html`; `14-screen-rest/critique.md` (History 103–126, avisos 155–183) | A referência visual. Onde o mock e este material divergem, vale o material (§4.3 #27, `implementation.md:18`) |
| 11 | `docs/product/features.md` §Voltar e descartar (495–505), §Descartar step (587–590), §Encerramento e arquivamento e §A página do item que saiu (643–677), §Histórico (835–846), §Apagar uma task (847–852), §Depende de mim (885–912), §Atalhos (1002) | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 12 | `docs/guidelines/README.md`, `frontend.md`, `go.md`, `testing.md`; `docs/architecture/overview.md` §O estado que o frontend vê (107–116), §Eventos (117–130), §Notificações e som (131–136), §Fronteira com o Go (163), §Store (169), §Features (177); `docs/architecture/storage.md` §Banco (20), §Artefatos (66); `docs/architecture/design-system.md` §Componentes | Como um step acontece |
| 13 | `design/research/critique-task-09.md` e `critique-task-10.md` (Podem esperar e a segunda leitura) | O que as duas tasks anteriores deixaram aberto e cabe nesta (§4.3 #33), e as práticas das cenas (pronto 1) |
| 14 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go**: P27 e P28 no `ArchivedTask`; P29, o que ficou no disco por parte e com o caminho do clone, na task e no review; P30, os commits fora da base na prévia; P33, o History por partes; P37, os textos das notificações em `internal/attention/text.go` e o título do review em `internal/app/state.go`; DTOs, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`.
2. **`features/history`** inteiro: o lugar, a barra, a lista por dia, a linha, os vazios, os antigos, a linha recém-arquivada; a task arquivada (fatos, encerramento, abas); o review e a discussão arquivados (os dois componentes saem de `features/reviews` e `features/discussion` para cá); **Delete…** dos três, com a volta ao History.
3. **`features/task`**: **Delete task** com a prévia, **Discard step** com a contagem, **Back to…** e **Discard and restart…** com o que se perde, no `Dialog` do system, abertos até o fim.
4. **`features/navigation/GoneView.tsx`**: o texto e o bloco da task encerrada e da apagada, o que ficou no disco do review apagado, e **Open in History** que leva à linha recém-arquivada nos três tipos.
5. **`features/notice`**: os toasts de task, review e discussão com o detalhe (F20); o aviso do app sem `LeftoversNotice`.
6. **`store/`**: os toasts por tipo, o que ficou no disco ligado ao item, o cache dos antigos, a linha recém-arquivada, as ações destrutivas com a falha no próprio diálogo.
7. **`components/system/`**: as peças da §5.3.
8. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| A pausa sem diálogo, o marco `Paused by you` e **Pause** desabilitado com a razão (X15) | — | Já entregues pelas tasks 3 e 4 (`task/task-session.ts:113–127`, `chat/markers.ts:624`, `task/stepper.ts:293`). Esta só as pinta na cena `pause` como regressão, sem mudar código |
| A página da discussão que saiu, o texto e o bloco das rodadas, e o diálogo de apagar uma discussão ativa | 9 | Os da task 9 (`navigation/GoneView.tsx:92–97, 142–153`, `navigation/gone-rounds.ts`, `discussion/DeleteDiscussionDialog.tsx`). Esta troca o destino de **Open in History**, os textos da variante do arquivado do diálogo, que a 9 já criou (§4.2, Apagar um arquivado), e a volta ao History |
| A página do review que saiu, o texto e as passadas, e o diálogo **Delete review** de um review ativo | 6 | Os da task 6 (`GoneView.tsx:52–77, 91–96, 141, 152`, `navigation/gone-passes.ts`, `reviews/DeleteReviewDialog.tsx`). Esta acrescenta o que ficou no disco ao review apagado, a variante do arquivado no diálogo e a espera do fim, que vale também para o review ativo |
| O clique de uma notificação (o lugar e o foco de cada situação) | 2, 4, 6, 7, 9 | O de hoje (`situation:open`, `openSituation`); a coluna "O clique abre" de `rest.md` §11 já é o que esse caminho faz, e esta task muda só os textos |
| A virtualização da lista do History | 12 | Sem virtualização: a janela de 90 dias tem, no ritmo medido (cerca de 4 por dia), umas 360 linhas, menos que o board medido na task 5 (§6) |
| Os componentes órfãos que outras tasks deixam | 12 | Ficam; esta tira só os que ela mesma deixa órfãos (§5.1). `task/ContextGauge.tsx` já saiu na task 9 |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| History é uma lista só, por data de arquivamento, com os dias como seção; o filtro da lateral vale nele, como chip removível; 90 dias carregados e os antigos sob demanda | `decisions.md` 2026-09-25; `rest.md` §3; `changes.md` X10; `structure.md:341, 424` |
| A task arquivada mostra os fatos, o resultado do encerramento e as abas com **Pull request**; o review, cada passada; a discussão, primeiro o que publicou; apagar um arquivado volta ao History | `rest.md` §4; `changes.md` X11 |
| O toast só para o item que saiu sem estar aberto, de task, review e discussão, com o resultado e **Open in History**, até três | `rest.md` §8; `changes.md` X12; `components.md` Aviso do app e toast |
| Os diálogos destrutivos dizem exatamente o que se perde, com a prévia lida do git, e abrem em **Cancel** | `decisions.md` 2026-09-25; `rest.md` §1, §10; `changes.md` X13, X14 |
| O que o git não removeu vai à página da task apagada, com o comando e o aviso do `--force`; `Some files stayed on disk` sai | `rest.md` §8, §9; `changes.md` X13; `structure.md:38` |
| O aviso do app só para a ação sem lugar próprio, com a ação que falhou como rótulo | `rest.md` §8; `changes.md` X16; `components.md` Aviso do app e toast |
| As notificações têm um texto por situação, os de `rest.md` §11, e o título do review tem o título da PR | `decisions.md` 2026-09-25; `rest.md` §11; `changes.md` X20 |
| A página do item que saiu, para a task encerrada e a apagada, com **Next that needs you** primária | `rest.md` §9; `changes.md` S7; `components.md` Página do item que saiu |

### 4.2 Decisões de design, detalhadas

#### History: o lugar e a barra

**O lugar** (`rest.md` §3). Abre por **History** no rodapé, que fica pressionado com History ou um arquivado na tela (task 2). O cabeçalho do lugar (`PlaceHeader`) tem `←` com o destino no tooltip e o título `History`, sem nada à direita. O corpo é uma área que rola, com a coluna da lista em `--list-measure` (1120 px), centrada em pixel inteiro, com `--space-6` dos lados, a mesma regra da lista do board (task 5).

**A barra**, fixa no alto da área que rola (`FilterBar` do system, task 5), `role="search"`:

- a busca (`SearchInput`), rótulo acessível `Search History`, placeholder `Search by name, title or #number`, com a tecla `/` à direita enquanto vazia e o `×` `Clear the search` com texto. Ela casa, sem maiúsculas, com o nome de uma task, o título de um review, o título de uma discussão e, com `#` seguido de algarismos (ou só algarismos), com o número da PR de uma task ou de um review e com o número do card de uma task (§4.3 #3);
- com o filtro da lateral ativo, o chip `Only acme/web` (`dono/nome`), pressionado, com o `×` como botão de verdade, `Show all repositories`, que limpa o filtro da lateral também; o tooltip do chip diz `The repository filter of the sidebar applies here too`;
- à direita, em `--text-micro` `--ink-4` tabular, `44 archived · Sep 12 – today`: o total do History inteiro (não da janela) e a data do arquivamento mais antigo (`Sep 12, 2025 – today` de outro ano; `today` quando é hoje). Com o filtro ou a busca, a contagem diz o que casa sobre o total: `12 of 44 · Sep 12 – today`; o período continua o do History inteiro, com ou sem filtro. Com o filtro, o que casa vem do resumo (P33), na hora. Com a busca, vem da resposta do Go, que conta o History inteiro: até ela chegar, a contagem diz a parte da janela, com o brilho (`Shimmer`) e `aria-busy`, e troca sem saltar quando chega. Um só, `1 archived`.

O foco começa na busca (`rest.md:293`), salvo quando se chega pela linha recém-arquivada. A busca e o que foi escrito nela duram enquanto o app roda (`historyQuery`, como hoje).

#### History: a lista e a linha

**A lista é o `tree` do system**, como a do board e a de Reviews (`components.md` Linha de lista e Cabeçalho de seção; `structure.md:355`), com o hook de lá (`features/board/useListTree.ts`): `role="tree"` com o nome `History`, uma parada de Tab, os cabeçalhos dos dias como `treeitem` de nível 1 e as linhas como `treeitem` de nível 2.

**Os dias.** Uma seção por dia de arquivamento, do mais recente ao mais antigo, `--space-4` entre as seções. O cabeçalho é o cabeçalho de seção da lista na variante do dia (`components.md` Cabeçalho de seção): `--size-node` de altura, sem chevron, o nome em `--text-meta` 600 `--ink-2` e a contagem em `--ink-4` tabular; não recolhe (`aria-expanded="true"` fixo, um pai sempre aberto; `components.md` Cabeçalho de seção, a variante do dia), mas é uma parada das setas, com o foco (o anel por fora) e o hover `--veil-hover` de todo cabeçalho; o tooltip e o nome acessível dizem `Archived on Monday, Sep 22: 5` (`Archived today: 4`). O nome: `Today`, `Yesterday`, `Monday, Sep 22` (o dia da semana e a data, no ano corrente), `Monday, Sep 22, 2025` (outro ano). O dia é o do fuso local.

**A linha** (`components.md` Linha de lista, variante History; `ListRow` da task 5): `--size-control` de altura, a grade `--icon | minmax(0, 1fr) | --col-where | --col-result | --col-time`, `--space-3` entre as colunas; o glifo do tipo em `--icon-sm` `--ink-3` (`task`, `oneShot`, `review`, `discussion`); o nome em `--text-ui` `--ink-1`, cortado com tooltip; onde em `--text-meta` `--ink-3`; o resultado em `--text-meta` `--ink-2`; a hora em `--text-meta` `--ink-4` tabular, alinhada à direita. Onde e o resultado cortam com tooltip. Todo texto que esta task corta, aqui e nas outras telas dela, é o `CutText` do system (`components/system/CutText.tsx`, task 9), que só abre o tooltip quando corta.

| Tipo | Onde | Resultado |
|---|---|---|
| Task Structured | `api#398` (o repositório curto e o número do card; sem card, `api`) | `PR #1279 · 6 steps` (`1 step`), e ` · dev not updated` quando o encerramento não atualizou a base (§4.3 #5) |
| Task One-Shot | `web#2279` | `PR #2290 · One-Shot`, e o mesmo ` · dev not updated` |
| Task sem PR (dado antigo) | o mesmo | `6 steps` ou `One-Shot` |
| Review | `web#2291` (o repositório curto e o número da PR) | `Merged · 2 passes` (`1 pass`, `no passes`); `Closed · 1 pass` |
| Discussão | o título do board; board removido, `No board` | `4 cards published` (`1 card published`; nada, `Nothing published`) |

` · dev not updated` (com o nome da base, `main not updated`) e `Closed` ficam em `--ink-1` 500: são o que pede atenção. O repositório curto segue a regra do board: `dono/nome` quando o dono não é o do board do item, para dois `api` não se confundirem.

Estados: hover `--veil-hover`; foco, o anel por fora (`focus-ring`, como `ListRow` hoje, `components/system/ListRow.tsx:103`); pressionada `--veil-press`; **recém-arquivada**, a linha aberta da lista (`--brand-tint-plane` com o anel `--brand-ring`, o glifo em `--brand-ink`, a hora em `--ink-3`, `aria-selected="true"`), até sair do History. A linha não tem a coluna das teclas: `Enter` é a única, e ela não pede lembrete.

**O nome acessível** diz tudo: `Task Idempotency keys for payment intents, api#398, PR #1279 · 6 steps · dev not updated, archived today at 15:02`; os tipos `Task`, `One-Shot task`, `Review`, `Discussion`; o dia `today`, `yesterday`, `on Monday, Sep 22`; a recém-arquivada termina em `, just archived`.

**Na lista estreita** (abaixo de 860 px do contêiner da lista, a container query `list`; a 812 px de área principal o contêiner tem 764): a grade fica `--icon | minmax(0, 1fr) | --col-time`, e onde e o resultado descem para uma segunda linha sob o nome, da coluna do nome à da hora, inteiros, `--space-4` entre os dois; `--space-1-5` em cima e embaixo, `--space-0-5` entre as linhas. Entre 860 e 1040 px, as colunas ficam (a regra do board que esconde a meta não vale aqui, `rest.md:307`).

**O teclado** (`components.md` Linha de lista, Cabeçalho de seção). A lista é uma parada de Tab (a última entrada com o foco, a linha recém-arquivada, ou o primeiro cabeçalho); `↑` `↓` vão à entrada anterior e à seguinte, cabeçalhos e linhas; `Home` e `End` às pontas da parte carregada; numa linha, `←` leva ao cabeçalho do dia dela; num cabeçalho, `→` leva à primeira linha dele, e `←` e `Enter` não fazem nada; `Enter` numa linha abre o arquivado; `/` volta à busca; da busca, `↓` vai ao primeiro cabeçalho.

**A linha recém-arquivada.** **Open in History** da página que saiu e do toast abre History com a linha do item destacada, rolada à vista (ao centro quando não está), e com o foco. A chegada limpa a busca; se o filtro da lateral a esconderia, ela aparece assim mesmo, no dia dela, sem entrar na contagem (§4.3 #4).

#### History: os estados

| Estado | Forma |
|---|---|
| Nada arquivado | O estado vazio de página, alinhado à esquerda na coluna: `Nothing archived yet` em `--text-ui` 600 e `A task comes here once it's closed, a review once its pull request is merged or closed, a discussion once it's archived.` em `--ink-3`. Sem ação: nada o resolve daqui |
| A busca sem resultado | `Nothing matches “refund”` e `Try another name, title or #number, or clear the search.`, com **Clear the search** secundário `sm` sob o texto, que limpa e devolve o foco à busca |
| O filtro sem nada | `Nothing archived in acme/web` e `Choose another repository, or all of them.`, com **Show all repositories** secundário `sm` (`components.md` Estado vazio de página: a ação do vazio é a saída dele) |
| A busca com o filtro, sem resultado | `Nothing matches “refund” in acme/web` e o texto da busca, com **Clear the search** |
| Carregando os antigos | Ao pé da lista, uma linha em `--text-meta`: `Loading older items…` com o brilho (`Shimmer`), `role="status"`; com a busca, `Searching older items…`. A lista na tela não se move |
| Os antigos falharam | Ao pé da lista, em `--state-error`, `role="alert"`: `Couldn't load older items: <mensagem>` e **Try again** fantasma `xs`, que pede de novo |
| Tudo carregado | Nada ao pé |

**Os antigos.** A lista mostra a janela; quando a última linha fica à vista (por rolagem ou por `↓`/`End`) e há antigos, ela pede a página seguinte, que entra no fim, no dia dela. Com a busca, os antigos que casam são pedidos na hora em que o texto para de mudar (300 ms), e a busca sem resultado só aparece depois da resposta: até lá, a linha `Searching older items…`. O filtro da lateral vale nos antigos também. O que já foi pedido fica em memória enquanto o app roda.

#### O arquivado: o cabeçalho e o corpo

**O cabeçalho** (`components.md` Cabeçalho do lugar, variante Arquivado): `←` e o breadcrumb `History /` (task 2); o glifo do tipo em `--icon` `--ink-3`; o título em `--text-body` 600 (o nome da task, o título da PR, o título da discussão), cortado com tooltip; as etiquetas (`Tag`): `Archived` na task e na discussão, `One-Shot` também numa One-Shot, `Merged` ou `Closed` no review; à direita, `--space-1-5` entre as peças: o link externo fantasma `sm` (task: `PR #1279 ↗`, tooltip `Open #1279 on GitHub`; review: `Open on GitHub ↗`, tooltip `Open web#2291 on GitHub`; discussão: o título do board, fantasma `sm`, tooltip `Open the board`, que abre o lugar do board; board removido, sem o botão) e o `⋯` (`More actions`, tooltip `Delete from History`), com um item só, **Delete…**, em `--state-error`.

**O corpo**, uma área que rola com a coluna em `--measure` (800 px), centrada em pixel inteiro, `--space-8` no alto, `--space-6` dos lados, `--space-16` no pé, `--space-6` entre as partes. Nada roda: sem compositor, sem barra do pedido, sem painéis.

**Os fatos** (todos os tipos): uma lista de termos (`dl`), a grade `max-content | minmax(0, 1fr)`, `--space-1` × `--space-5`, `--text-meta`, o termo em `--ink-3` e o valor em `--ink-1`. As referências são links externos (`components.md` Link), com o tooltip `Open api#398 on GitHub`. As datas seguem a regra do produto: `Sep 24 at 14:51`, `Sep 24, 2025 at 14:51` de outro ano; uma hora que o dado não tem some da frase.

**As seções** têm o título em `--text-caps` 700 `--ink-3` com `--tracking-caps` (`h2`), `--space-2` até o conteúdo.

#### A task arquivada

**Os fatos:**

| Termo | Valor |
|---|---|
| `Repository` | `acme/api · card api#398 · Done` (o status do card guardado na task; sem card, `acme/api`) |
| `Pull request` | `#1279 merged into dev by lnakamura · Sep 24 at 14:51`; sem quem, `#1279 merged into dev · Sep 24 at 14:51`; o merge não confirmado no encerramento, `#1279 into dev · the merge wasn't confirmed`; sem PR (dado antigo), a linha sai |
| `Started` | `Sep 17 at 10:03` (a criação da task) |
| `Archived` | `Sep 24 at 15:02`, só numa task sem o resultado do encerramento guardado, cujo bloco traria a hora; com o bloco, a linha não aparece |

**O resultado do encerramento** (`components.md` Resultado do encerramento; P27): o bloco afundado (`--surface-0`, raio `--radius-md`, `--space-2` em cima, `--space-4` dos lados, `--space-2-5` embaixo), `role="group"` `What the closing did`; a legenda `Closing` em caixa alta (`--text-caps` 700 `--ink-3`) com a hora em `--text-micro` `--ink-4` (`15:02`, ou `Sep 24 at 15:02` fora de hoje); uma linha por parte, na ordem worktree, branch, base, a grade `--icon | 1fr`, `--space-1-5` em cima e embaixo, o fio `--line-1` entre as linhas, `--text-meta`. Feita: o visto em `--ink-3` e o texto em `--ink-1`. Pulada: o traço `–` 700 `--ink-3` e o texto em `--ink-2`, com o que fazer embaixo em `--ink-3` quando há. Falhou: o glifo de erro e o texto em `--ink-1`, com o detalhe do git embaixo em mono `--text-micro` `--ink-3`. Os caminhos passam por `displayPath` (`lib/paths.ts:5–7`), e o que o git disse, aqui, na prévia e no que ficou no disco, por `displayPaths` (`lib/paths.ts:9–17`, task 10), que só troca o `/home/<usuário>` do começo de um caminho.

| Parte | Saída | Texto | O que fazer, embaixo |
|---|---|---|---|
| Worktree | feita | `Worktree removed` | — |
| | pulada | `Worktree was already gone` | — |
| | falhou | `Worktree couldn't be removed` | o detalhe do git |
| Branch | feita | `Branch idempotency-keys deleted` | — |
| | pulada, `not_merged` | `Branch idempotency-keys kept: git doesn't see it merged into dev` | `Delete it in ~/code/api with git branch -D idempotency-keys once you don't need it.` |
| | pulada, `missing` | `Branch idempotency-keys was already gone` | — |
| | falhou | `Branch idempotency-keys couldn't be deleted` | o detalhe do git |
| Base | feita | `dev updated by 3 commits` (`1 commit`) | — |
| | pulada, `up_to_date` | `dev was already up to date` | — |
| | pulada, `not_checked_out` | `dev not updated: another branch is checked out` | `Pull dev in ~/code/api when you check it out again.` |
| | pulada, `missing` | `dev not updated: the branch doesn't exist locally` | — |
| | pulada, `dirty` | `dev not updated: the repository has uncommitted changes` | `Pull dev in ~/code/api once its changes are committed or stashed.` |
| | pulada, `no_upstream` | `dev not updated: it tracks no remote branch` | `Set its upstream in ~/code/api, then pull.` |
| | pulada, `diverged` | `dev not updated: it has commits the remote doesn't` | `Reconcile dev with origin/dev in ~/code/api.` |
| | falhou | `dev not updated` | o detalhe do git |

O caminho do clone é o do repositório da task no estado; sem ele (o repositório saiu do MySpec), `in the clone` no lugar de `in ~/code/api`. Uma task arquivada antes de o encerramento ser guardado não tem o bloco.

**As abas** (`Tabs` do system, task 3), `tablist` `Documents of the task`, `←` `→` com a ativação automática, abre na primeira: **PRD**, **Tech spec**, **Steps · 6** e **Pull request**; numa One-Shot, **One-Shot document** e **Pull request**. Uma aba cujo documento a task não tem fica, com `Nothing was written.` em `--ink-3` no corpo. O conteúdo de cada aba, sob ela, `--space-5` acima:

- **PRD**, **Tech spec**, **One-Shot document**: o documento renderizado no registro de leitura (`features/chat/Markdown.tsx`), com o esqueleto de três linhas enquanto lê e, numa falha, a faixa de aviso local `Couldn't read PRD.md`, a mensagem e **Try again** (hoje um `Banner` dispensável, `ArchivedTaskView.tsx:231–238`).
- **Steps**: uma lista com uma entrada por step, `--space-2` em cima e embaixo, o fio `--line-1` entre elas. A linha do step é um marco em linha (`components.md` Marco em linha) que abre o arquivo do step no lugar (`steps/03-….md`, sem o front matter): o chevron no sulco, o número em mono `--text-micro` `--ink-3` tabular, alinhado à direita em `--key-size`, o título em `--text-ui` `--ink-1` e, à direita, o SHA curto do commit em mono `--text-micro` `--ink-3` (P27; um step sem commit guardado não o tem). Sob ela, recuados até o título, os relatórios do revisor como marcos que abrem no lugar: o ícone `file`, `Review 1` em `--ink-2` 500 e `· changes · 2 findings` (`· clean`) em `--ink-3`. O marco do step e o do relatório não têm hora (o arquivado não guarda quando cada um foi escrito).
- **Pull request**: o rascunho num bloco contornado por `--line-1`, raio `--radius-md`, `--space-4` × `--space-5`: a legenda `Pull request draft` em caixa alta, o título em `--text-title` 600 (o `title` do cabeçalho de `pr/draft.md`) e o corpo renderizado com os títulos em `--text-ui` 600 (`.ui-headings`, `styles/globals.css:562–569`, o Markdown sob um título próprio, como o rascunho da task 9 e o prompt da 10), lidos ao abrir a aba como um documento (o esqueleto de três linhas enquanto lê; a faixa `Couldn't read pr/draft.md` com **Try again** numa falha); sem rascunho guardado, `No pull request draft was kept.` em `--ink-3`. Depois, a seção `Review of the pull request`, com um marco por relatório que abre no lugar: `Review 1` e `· changes · 2 findings` (passada estruturada) ou `· changes` (em texto), `· clean`; sem relatório, `The pull request had no review pass.` (P28).
- Numa One-Shot, a aba **One-Shot document** termina com a seção `Implementation`: a linha do step único (sem número; o título do documento e o SHA) e os relatórios dele, como em **Steps**.

#### O review arquivado

**Os fatos:**

| Termo | Valor |
|---|---|
| `Pull request` | `web#2291 by tchen · merged into dev by rsouza · Sep 23 at 16:20`; fechada, `web#2291 by tchen · closed · Sep 23 at 16:20` |
| `Card` | `web#2238 · Settings form keeps the old validation`, só com card |
| `Started` | `Sep 22 at 09:14` (a criação do review) |
| `Reviewed` | As passadas com relatório e o que foi delas: `2 passes, both published`, `1 pass, published`, `3 passes, 2 published`, `2 passes, none published`; no modo Apply, `2 passes, both sent to the agent`, `1 pass, sent to the agent`; as duas coisas, `3 passes, 1 published and 1 sent to the agent` |

O arquivamento do review é a hora da linha `Pull request` (o merge ou o fechamento, que o arquivam); sem essa hora, a linha `Archived` `Sep 23 at 16:20` (o `archivedAt`) entra depois de `Reviewed`.

**Uma seção por passada** com relatório, `--space-4` entre elas, o fio `--line-1` acima de cada uma depois da primeira: a linha `Pass 1` (600) e o que foi dela em `--ink-1` (`Request changes`, `Approve`, `Comment`; Apply, `2 findings sent to the agent`; nada, `not published`), e à direita, em `--text-micro` `--ink-4` tabular, `published Sep 23 at 13:41` (Apply, `sent Sep 23 at 13:41`; sem a hora, nada). Depois, os apontamentos que saíram: o corpo do marco `You decided` da task 6 (os apontamentos sem decisão nem edição, cada um com o título, o lugar em mono e aonde foi, `Inline comment` ou `In the review body`, abrindo o texto que foi), num bloco afundado. Por último, o relatório como marco que abre no lugar: o ícone `file`, `Report` e `· review-1.md` (o arquivo da passada, `pass.file`). Sem passada com relatório: `No report was written.` em `--ink-3`. No pé, em `--text-meta` `--ink-3`: `The conversation of a review isn't kept in History.`

#### A discussão arquivada

**Os fatos:**

| Termo | Valor |
|---|---|
| `Board` | `Platform Roadmap · from api#447 and api#449` (os cards de entrada; sem eles, só o board) |
| `Started` | `Sep 24 at 10:02` (a criação da discussão) |
| `Archived` | `Sep 24 at 11:47 · 1 round` (`3 rounds`, P25 da task 9) |
| `Published` | `4 of 5 drafts: 3 created, 1 updated` (só as partes que existem); nada, `None of 5 drafts` |

**What it published**, primeiro: uma lista contornada (`--line-1`, raio `--radius-md`), uma linha por rascunho na ordem de posição, `--size-control` de altura mínima, `--space-1` × `--space-3`, o fio `--line-1` entre as linhas; o épico seguido dos cards dele recuados em `--epic-indent`. A linha: a etiqueta do tipo (`Epic`, `New card`, `Update`), o título em `--text-ui` cortado com tooltip, e à direita, em `--text-meta` `--ink-2`: `Created api#452 ↗` ou `Updated gateway#440 ↗` (o link abre a issue, tooltip `Open api#452 on GitHub`), ou `Not published · discarded`, `Not published · not decided`, `Not published · failed` em `--ink-3`, com o título em `--ink-2`. Um rascunho aprovado que nunca chegou ao GitHub, sem o erro da escrita (preso pelo épico, ou a discussão arquivada antes da publicação), diz `Not published · failed`: a decisão foi tomada, e a publicação não aconteceu.

**Document and conversation**: dois marcos que abrem no lugar: o ícone `file`, `discussion.md` e `· the understanding` (sem documento, o marco sem chevron `No document was written.`); o ícone `discussion`, `Conversation` e `· 31 messages, read only` (as falas e as mensagens; antes de a conversa ser lida, `· read only`), que abre a conversa inteira, somente leitura, como hoje (`ArchivedDiscussionView.tsx:184–192`), com as rodadas dobradas (o `discussion` que a task 9 passa ao contexto dos marcos, `:105–119`).

#### Apagar um arquivado

**Delete…** do `⋯` abre o `Dialog` mínimo destrutivo (`alertdialog`), com o foco em **Cancel**:

| Tipo | Título | Corpo | Linha apagada (`--ink-3`) | Confirmação |
|---|---|---|---|---|
| Task | `Delete “Idempotency keys for payment intents”?` | `This removes the archived task and its documents from History. It can't be undone.` | `Nothing changes on GitHub: PR #1279 and the card api#398 stay.` (sem card, `PR #1279 stays.`; sem PR, `Nothing changes on GitHub.`) | **Delete task** |
| Review | `Delete the review of web#2291?` | `This removes the archived review and its reports from History. It can't be undone.` | `Nothing changes on GitHub: what was published stays.` | **Delete review** |
| Discussão | `Delete “Webhook delivery guarantees”?` | `This removes the archived discussion, its document, its drafts and its conversation from History. It can't be undone.` | `Nothing changes on GitHub: the 4 issues it published stay. A task started from one of its cards loses the document in its context.` (uma, `the issue it published stays`; nada publicado, `Nothing changes on GitHub. A task started…`) | **Delete discussion** |

O da discussão é o `DeleteDiscussionDialog` da task 9, que já tem a variante do arquivado pela propriedade `archived` (`discussion/DeleteDiscussionDialog.tsx:11–12, 65–67`, hoje `The conversation, the document and the drafts go away.`, `tasks/09-discussion.md:320`) e passa a dizer os textos desta tabela; o do review é o `DeleteReviewDialog` da task 6, que ganha a mesma propriedade. Os três: o título com as aspas curvas, o foco em **Cancel**, `Esc` e o `×` fecham e devolvem o foco ao `⋯`, sem `Ctrl+Enter` (§4.3 #10). Sem prévia: um arquivado não tem worktree, branch nem sessão. Apagando, `Deleting…` com o spinner e **Cancel** tracejado; uma falha fica no rodapé, em vermelho (`Couldn't delete it: <mensagem>`), o diálogo aberto e a confirmação de volta. Apagado, a área volta ao History (`placeIn`, `store/app-store.ts:783–792`, como hoje), com o foco na linha que tomou o lugar da apagada (a seguinte, mais antiga; sem ela, a anterior; sem nenhuma, a busca), sem anúncio.

#### Os diálogos da task: o que vale para os três

O `Dialog` mínimo do system, destrutivo (`alertdialog`, `--size-dialog`, a `round(8vh, 1px)` do topo), com o foco em **Cancel**, aberto do `⋯`, que entrega o foco a ele (§4.3 #33), e da barra do pedido (`step_empty` e `pr_closed`, task 3). O corpo em `--text-body` `--ink-1`; a lista do que se perde em `--text-body`, um item por linha, sem ponto final; uma nota afundada quando há; a linha apagada em `--ink-3` por último. O rodapé é o `DialogFooter` (`components/system/Dialog.tsx:186–227`, tasks 9 e 10): `DialogCancel` fantasma e a confirmação perigosa (`Button` `danger`), sem a tecla `Ctrl ↵` (§4.3 #10), numa linha só, à direita, que nunca quebra nem anda.

**A sessão interrompida.** Com um turno rodando na task (uma conversa `working`, `workingSession` de `features/sidebar/sessions.ts`), o diálogo diz qual: `The reviewer's answer in progress is interrupted.` com o papel da conversa (`taskSessions`) em minúscula no começo, `implementer`, `reviewer`, `PRD agent`, `tech spec agent`, `plan agent`, `planning agent`, `PR agent`; com duas, uma frase por conversa. Uma sessão com o processo vivo e ociosa não entra: nada em curso se perde (§4.3 #11).

**Confirmando:** a confirmação diz o verbo no gerúndio com o spinner (`loading` e `loadingLabel`: `Deleting…`, `Discarding…`, `Going back…`), `aria-busy`, **Cancel** e o `×` tracejados (`DialogCancel disabled`, `closeDisabled`) e `Esc` inerte, até a chamada voltar, como o `DeleteDiscussionDialog` da task 9 (`:46–84`). **Falha:** a razão no rodapé, em `--state-error`, numa linha própria acima dos botões (a `refusal` do `DialogFooter`, `role="alert"`: `Couldn't delete the task: <mensagem>`, `Couldn't discard step 3: <mensagem>`, `Couldn't go back to the Tech spec: <mensagem>`), o diálogo aberto e a confirmação de volta, que é o repetir (`components.md` Diálogo). O aviso do app não recebe essas falhas. **Depois:** o diálogo fecha; o que acontece a seguir está em cada um.

#### Delete task

- Título `Delete “Rate limit per API key”?`.
- Corpo `This removes the documents, the steps and every record of the task. It can't be undone.`
- **A prévia** (`components.md` Prévia de um apagamento), lida ao abrir (`previewDelete`, P30): uma lista afundada (`--surface-0`, raio `--radius-md`, `--space-1` × `--space-3`), `aria-label` `What will be destroyed`, uma linha por coisa, a grade `--icon | 1fr`, `--space-2` em cima e embaixo, o fio `--line-1` entre as linhas, `--text-meta` `--ink-1`; o ícone `--icon-sm` em `--ink-3`; as etiquetas (`Tag`) com o número em `--ink-1` e o contorno `--line-3`; o detalhe em `--ink-3`, numa linha própria.

| Linha | Quando | Ícone | Texto | Etiqueta | Detalhe |
|---|---|---|---|---|---|
| A sessão | Um turno roda | o glifo `run` (o spinner do sistema) | `The reviewer's answer in progress is interrupted` | — | — |
| A worktree | Existe | `folder` | `The worktree is removed` | `3 uncommitted files` (`1 uncommitted file`; limpa, nenhuma) | o caminho em mono `--text-micro` |
| A worktree ilegível | O `git status` falhou | `◇` (`StateGlyph blocked`) | `Couldn't read the worktree` | — | `<o que o git disse>. Deleting still removes it.` |
| A branch | Existe | `branch` | `The branch rate-limit-per-api-key is deleted`, o nome em mono | `not merged · 9 commits` (`1 commit`; contagem desconhecida, `not merged`; mergeada, nenhuma) | sem saber se está mergeada: `Couldn't tell if it's merged: <o que o git disse>` |
| A PR aberta | A PR existe e está aberta | `pullRequest` | `PR #1284 stays open on GitHub` | — | `Close it there if you don't need it.` e o link `Open #1284 ↗` |
| A PR mergeada | Mergeada | `merge` | `PR #1284 is merged` | — | `Nothing changes on GitHub.` |

Sem nada a listar (uma task no planejamento, sem worktree, sem PR e sem turno), o bloco não aparece. **Lendo:** acima do bloco, `Reading the worktree and the branch…` em `--text-meta` com o brilho, `role="status"`, e no bloco o esqueleto de três linhas (`components.md` Esqueleto); **Delete task** fica habilitado. **A leitura inteira falhou:** o bloco com uma linha só, `◇ Couldn't read the worktree and the branch` e `<mensagem>. Deleting still removes them.` A prévia é informação, nunca condição: apagar continua possível em todo estado.

- **Cancel** e **Delete task**, perigoso. Apagado, o diálogo fecha com a task, e a área mostra a página da task apagada (sem anúncio: foi o usuário; a marca de `runRemoval`, `store/actions.ts:402–417`, que o `removalInPlace` da task 9 já junta à falha devolvida, `:997–1006`). Aberto da barra `pr_closed`, o mesmo diálogo.

#### Discard step

- Título `Discard step 3 and start over?`; numa One-Shot, `Discard the implementation and start over?`.
- Corpo, pelo que o step tem (`step.reviewer`, `step.reports`):

| O step tem | Corpo |
|---|---|
| Revisor e relatórios | `This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the 2 reports of the agent review. The step starts again from scratch right away.` (`with the report of the agent review` com um) |
| Revisor sem relatório | `This ends the sessions and deletes the conversations of step 3 and of its reviewer. The step starts again from scratch right away.` |
| Só o implementador | `This ends the session and deletes the conversation of step 3. The step starts again from scratch right away.` |

Numa One-Shot, `of the implementation` no lugar de `of step 3`, e `The implementation starts again…`.

- **Also clean the worktree**, a caixa de seleção num bloco contornado (`--line-2`, raio `--radius-md`, `--space-2-5` × `--space-3`), o rótulo em 500 e a descrição embaixo em `--text-meta` `--ink-3` (`aria-describedby`), marcada a cada abertura. A contagem vem da mesma leitura da prévia, feita ao abrir:

| A worktree | Marcada | Desmarcada |
|---|---|---|
| `3 uncommitted files` | `Discards the 3 uncommitted files in the worktree.` (`the uncommitted file`) | `The 3 uncommitted files stay, and the step starts blocked until the worktree is clean.` (`The uncommitted file stays…`) |
| Limpa | `The worktree has no uncommitted changes.` | O mesmo |
| Lendo, ou a leitura falhou | `Discards every uncommitted change in the worktree.` | `Uncommitted changes stay, and the step starts blocked until the worktree is clean.` |

Lendo, a descrição tem o brilho; falhou, sob o bloco, em `--ink-3`, `Couldn't count the uncommitted files: <mensagem>`.

- A linha apagada da sessão interrompida, quando um turno roda.
- **Cancel** e **Discard step** (numa One-Shot, **Discard the implementation**), perigoso, `Discarding…`. Depois, o step recomeça, e o foco vai ao compositor (`components.md` Troca de lugar: o que tinha o foco resolveu e sumiu).

#### Back to… e Discard and restart…

**O título e a confirmação:**

| Ação | Título | Confirmação |
|---|---|---|
| Back (Structured) | `Back to the PRD?`, `Back to the Tech spec?` | **Back to the PRD**, **Back to the Tech spec** |
| Discard and restart (Structured) | `Discard the PRD and start over?`, `Discard the Tech spec and start over?`, `Discard the Plan and start over?` | **Discard the PRD**, **Discard the Tech spec**, **Discard the Plan** |
| Back (One-Shot) | `Back to planning?` | **Back to planning** |
| Discard and restart (One-Shot) | `Discard the planning and start over?` | **Discard the planning** |

A etapa no título e na confirmação tem a maiúscula do stepper (`stageLabel`); os itens do `⋯` continuam os de hoje (`Back to Tech spec…`, `Discard and restart the plan…`, `task/task-menu.ts:75–88`).

**O corpo**, nesta ordem:

1. `This deletes:` e a lista, um item por etapa perdida, da primeira à etapa em que a task está, e por último a worktree:

| Etapa perdida | Item |
|---|---|
| PRD | `the PRD conversation and document` |
| Tech spec | `the tech spec conversation and document` |
| Plan | `the plan conversation and the 7 step files` (`the step file`; plano não escrito, `the plan conversation`) |
| Implementação (Structured) | `the conversations of steps 1 to 3 and their 4 review reports` (os steps que começaram, até o atual; um, `the conversation of step 1 and its 2 review reports`; sem relatório, `the conversations of steps 1 to 3`) |
| Planejamento (One-Shot) | `the planning conversation and the One-Shot document` |
| Implementação (One-Shot) | `the implementation conversations and their 2 review reports` (sem relatório, `the implementation conversations`) |
| Pull request | As partes que existem, de `the pull request draft`, `the PR conversation` e `the reports of its review`, ligadas por `, ` e ` and ` |
| A worktree e a branch, por último, quando existem | `the worktree and the branch rate-limit-per-api-key, with 3 uncommitted files` (`1 uncommitted file`; limpa, sem a parte `with`; lendo ou sem leitura, `, with any uncommitted work in them`) |

A etapa perdida vai da seguinte à alvo (Back) ou da própria alvo (Discard) até a atual, como `lostItems` hoje (`task/stage-actions.ts:54–58`), agora com a PR e a worktree como itens próprios.

2. Com a PR aberta, a nota afundada (`components.md` Linha afundada, Nota), com o ícone `pullRequest`: `PR #1284 stays open on GitHub. Close it there if you don't need it.` (a primeira frase em 500 `--ink-1`) e o link `Open #1284 ↗` à direita.
3. O que fica: Back, `The Tech spec stays, and the plan starts again from scratch when you continue.` (`The PRD stays, and the tech spec starts…`; One-Shot, `The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.`); Discard, `A new plan session starts right away, from the tech spec.` (`A new tech spec session starts right away, from the PRD.`; `A new PRD session starts right away, from the card api#398.` ou `…, from your description.`; One-Shot, `A new planning session starts right away, from the card api#398.` ou `…, from your description.`).
4. A linha apagada da sessão interrompida, quando um turno roda.

A worktree é lida ao abrir, pela mesma leitura da prévia, só quando a task tem worktree. **Cancel** e a confirmação perigosa, `Going back…` ou `Discarding…`. Depois, a task está na etapa reaberta, e o foco vai ao compositor dela.

#### A página da task que saiu

A forma é a `GonePage` (task 2, com o texto e o bloco da task 6): no lugar do item, na medida `--measure-read`, o ícone neutro, o título em `--text-title`, o texto em `--text-body` `--ink-2`, o bloco, as ações. O cabeçalho do lugar tem `←` e o nome da task.

**Encerrada.** Ícone `archive`. Título `Idempotency keys for payment intents was closed and archived`. Texto, pelo que se sabe da PR (P27):

| Caso | Texto |
|---|---|
| Merge confirmado, com a hora | `PR #1279 was merged into dev at 14:51. MySpec closed the task at 15:02; its documents, steps and reports are in History.` (outro dia, `on Sep 23 at 14:51`) |
| Merge confirmado, sem a hora | `PR #1279 was merged into dev. MySpec closed the task at 15:02; …` |
| Merge não confirmado | `MySpec couldn't confirm the merge of PR #1279 and closed the task at 15:02; its documents, steps and reports are in History.` |
| One-Shot | `…; its document and reports are in History.` |

O bloco é o resultado do encerramento da task arquivada, com a legenda `Closing` e a hora. Ações: **Next that needs you** `Ctrl J`, **Open in History**, **Back to Platform Roadmap** (sem board, **Back to Home**), as da task 2.

**Apagada.** Ícone `trash`. Título `Rate limit per API key was deleted`. Texto: `The documents, the steps and every record of the task are gone.` e, pelo estado da PR antes do apagamento (§4.4): ` PR #1284 stays open on GitHub.`, ` PR #1284 stays on GitHub, merged.`, ` PR #1284 stays on GitHub, closed.`; sem PR, nada. Ações: **Next that needs you**, **Back to Platform Roadmap**.

**O que ficou no disco** (P29), só quando o git não removeu tudo, entre o texto e as ações. Chega com a resposta do apagamento: a página pode aparecer antes, e o bloco entra quando ela chega, sem mover o foco.

- O bloco do resultado com a legenda `Git couldn't remove everything` em caixa alta, `role="group"` `What stayed on disk`, uma linha por parte: a worktree que ficou, o glifo de erro, `The worktree stayed at ~/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key` (o caminho em mono) e o que o git disse embaixo, em mono `--text-micro` `--ink-3`; a removida, o visto e `Worktree removed`; a branch que ficou, o glifo de erro, `The branch rate-limit-per-api-key stayed` e o que o git disse; a apagada, o visto e `Branch rate-limit-per-api-key deleted`.
- Com a worktree que ficou, a linha de aviso em `--text-meta` `--ink-2`, com o `◇` alinhado à primeira linha: `--force deletes the modified and untracked files in it too.` em 500 `--ink-1` e ` Copy out what you want to keep first.`
- O bloco copiável (`CopyBlock` da task 10; `components.md` Marca e cópia, Bloco copiável), com o cabeçalho `To remove it yourself, in ~/code/api` e **Copy** fantasma de ícone `xs` (`Copy the command`; `Copied` com o visto por 2 s; `Can't copy · select the text`), e os comandos, um por linha, na ordem: `git worktree remove --force <caminho da worktree>` e `git branch -D <branch>`, só os das partes que ficaram. O caminho do clone é o do repositório no estado (§4.3 #13).

**Review apagado** (o título e as ações da task 6, `web#2291 was deleted`): com o que ficou no disco, o mesmo bloco (só a worktree), o aviso e o comando `git worktree remove --force <caminho>`, no clone do repositório do review.

**Open in History**, na página da task encerrada, do review que terminou e da discussão arquivada, abre o History com a linha recém-arquivada (hoje abre o arquivado, `GoneView.tsx:41–50, 125–131`, a forma provisória da task 2 até esta).

#### Os toasts

Na região `.toasts` (task 2), o `Toast` do system com o detalhe sob o texto (`--text-meta` `--ink-3`, quebrando), **Open in History** sob o detalhe e o `×` (`Dismiss`); 10 s contados sem ponteiro nem foco; até três, o mais antigo sai. Só para o item que saiu sem estar aberto, quando o estado novo o traz no History e ele não estava lá (F20; hoje só tasks, `store/app-store.ts:906–927`). Uma task, um review ou uma discussão que saiu com a tela aberta tem a página, nunca o toast.

| Item | Ícone | Texto | Detalhe |
|---|---|---|---|
| Task | `archive` | `“Idempotency keys for payment intents” was archived` | `Closed at 15:02` e, quando o encerramento pulou ou falhou numa parte que pede atenção, ` · ` e a linha dela: `Closed at 15:02 · dev not updated: another branch is checked out`. As que não pedem: `Worktree was already gone`, `Branch … was already gone`, `dev was already up to date`. Sem o resultado guardado, sem detalhe |
| Review mergeado | `merge` | `web#2288 was merged, and its review ended` | A última passada: `Pass 2 was published at 13:10`; Apply, `The findings of pass 1 went to the agent at 13:41`; sem passada publicada nem enviada, `No pass was published`; sem a hora, a frase sem ` at …` |
| Review fechado | `merge` | `web#2288 was closed without a merge, and its review ended` | O mesmo |
| Discussão | `archive` | `“Usage alerts at 80% of the plan” was archived` | `3 cards published` (`1 card published`; nada, `Nothing published`) |

**Open in History** abre o History com a linha recém-arquivada e fecha o toast.

#### O aviso do app

A forma é a da task 2 (`components/system/AppNotice.tsx`). Esta task tira dele o que ganhou lugar próprio e mantém nele o resto:

| Ação | Hoje | Agora |
|---|---|---|
| Apagar uma task (`deleteTask`) | O aviso; o diálogo fecha antes | O rodapé do diálogo |
| O que ficou no disco de uma task ou de um review | `LeftoversNotice` no lugar do aviso (`notice/AppNotices.tsx:17`) | A página do item apagado |
| Descartar um step, voltar a uma etapa, descartar e recomeçar | O aviso; o diálogo fecha antes | O rodapé do diálogo |
| Apagar um review, ativo ou arquivado | O aviso (`deleteReview` fecha o diálogo no `finally`, `reviews/DeleteReviewDialog.tsx:21–29`) | O rodapé do diálogo, que fica aberto até o fim, com `Deleting…`: o `DeleteReviewDialog` é um só, e o review ativo (`ReviewMenu.tsx:89`) passa a esperar também. O de uma discussão, ativa ou arquivada, já é assim (task 9, `deleteDiscussionInPlace`, `store/actions.ts:1013–1016`) |
| Os antigos do History | — | O pé da lista |
| Toda outra chamada de `run()` em `store/actions.ts` (pausar, retomar, **Retry**, aprovar, continuar, abrir no editor, abrir um link, ler de novo…) | O aviso | O aviso, sem mudança: o step 1 lista cada uma com o destino no tech spec, e uma que já tem lugar numa tela decidida e ainda vai ao aviso é corrigida no step da área dela |

#### As notificações

**O título** é o item: o nome da task; `acme/web#2291 · Migrate settings page to react-hook-form` no review (`dono/nome#N · <título da PR>`, inteiro; o servidor de notificação corta); o título da discussão. Hoje o do review é só `acme/web#2291` (`internal/app/state.go:113`).

**O lugar no texto** de uma pergunta, uma permissão, uma resposta e um erro de sessão, exatamente como entra na frase depois de `in `: `the PRD`, `the tech spec`, `the plan`, `One-Shot planning` (sem artigo), `step 3`, `the pull request` (a sessão `pr` da etapa de PR), `the review` (a sessão `pr_review` da etapa de PR, e o review de uma PR), `the discussion`. Hoje as três etapas Structured vêm sem artigo (`placeName` cai em `stageName`, `internal/attention/text.go:13–25, 40–41`: `The agent has a question in tech spec.`, `derive_test.go:57, 62, 79, 94, 99`) e a sessão `pr_review` diz `the pull request` (`text.go:34–35`); as duas coisas mudam (§4.3 #15). `placeName` ganha o artigo por conta própria, e `stageName` continua sem ele, porque `readyToContinueBody` (`text.go:69–74`) já escreve `The ` antes: `The tech spec is revised and ready to continue.`

**Os 61 textos** (`rest.md` §11, a fonte única). As colunas: o tipo (`Kind` e a forma, `internal/attention/situation.go`), quando dispara (a condição de `derive.go`, `derive_review.go` e `derive_discussion.go`) e o que muda no código, onde "igual" é o texto de hoje, "feito" é um texto que as tasks 7 e 8 já puseram e "muda" é o que esta task escreve. Os exemplos usam `Rate limit per API key`, `acme/web#2291 · Migrate settings page…` e `Usage-based pricing tiers`.

| # | Situação | Corpo | Tipo · forma | Quando dispara | Código |
|---|---|---|---|---|---|
| 1 | Task · Question | `The agent has a question in the tech spec.` | `question` | A sessão da etapa de planejamento em `needs_answer` | muda (hoje `in tech spec.`, sem artigo) |
| 2 | Task · Question · PR | `The agent has a question in the pull request.` | `question` | A sessão `pr` em `needs_answer` | igual |
| 3 | Task · Permission | `Permission requested in step 3.` | `permission` | A sessão do step em `needs_permission` | igual |
| 4 | Task · Permission · PR review | `Permission requested in the review.` | `permission` | A sessão `pr_review` em `needs_permission` | muda (hoje `in the pull request`) |
| 5 | Task · Waiting for reply | `The agent is waiting for your reply in the PRD.` | `reply` | A sessão da etapa ociosa, o documento não escrito | muda (hoje `in PRD.`) |
| 6 | Task · Session error | `The session stopped with an error in step 3.` | `session_error` | A sessão do step em `error`, ou o turno falhou | igual |
| 7 | Task · Session error · PR | `The session stopped with an error in the pull request.` | `session_error` | A sessão `pr` em `error` | igual |
| 8 | Task · Reviewer asks | `The reviewer of step 3 has a question.` | `question` | A sessão `step_review:N` em `needs_answer` | igual |
| 9 | Task · Reviewer permission | `The reviewer of step 3 asks for a permission.` | `permission` | `step_review:N` em `needs_permission` | igual |
| 10 | Task · Reviewer without report | `The reviewer of step 3 stopped without writing its report.` | `reply` | A passada terminou sem relatório (`ReportMissing`) | igual |
| 11 | Task · Reviewer error | `The review of step 3 stopped with an error.` | `session_error` | `step_review:N` em `error` | igual |
| 12 | Task · Plan invalid | `The plan is still invalid after 3 automatic corrections.` | `plan_invalid` | O plano inválido depois de `MaxCorrections` correções, a sessão ociosa | muda (a contagem) |
| 13 | Task · Ready to continue | `The tech spec is revised and ready to continue.` | `ready_to_continue` | Etapa revisitada, documento escrito, sessão ociosa | igual |
| 14 | Task · Ready to continue · One-Shot | `The One-Shot document is revised and ready to continue.` | `ready_to_continue` | Idem, `one_shot` | igual |
| 15 | Task · Step blocked | `Step 5 can't start: the worktree has uncommitted changes.` | `step_blocked` | O step `blocked` (a razão por `stepBlockPhrase`) | igual |
| 16 | Task · Worktree unreadable | `Step 3: the worktree can't be read.` | `worktree_unreadable` | O step `review_failed` | igual |
| 17 | Task · Step to review | `Step 4 is ready for your review. 7 files changed.` | `step_review` · `review` | O step em `awaiting_review` (as formas `staged` e `approve` continuam a mesma, sem notificar de novo) | muda (`your` e a contagem) |
| 18 | Task · No commit after approval | `Step 4: the last approval didn't produce a commit.` | `step_review` · `approve` | Começa pronta para aprovar com `commitFailed`, ou fallback `no_commit` | igual |
| 19 | Task · Agent review gave up | `Step 3: the agent review didn't come clean after 3 rounds. It's yours now.` | `step_review` | Fallback `rounds_exhausted` | muda |
| 20 | Task · Step empty | `Step 6 finished without changes.` | `step_empty` | O step `nothing_to_commit` | igual |
| 21 | Task · PR blocked | `The pull request is blocked: the GitHub CLI isn't authenticated.` | `pr_blocked` | A etapa de PR `blocked` (a razão por `prBlockPhrase`) | igual |
| 22 | Task · Draft | `The pull request draft is ready for your OK.` | `draft` | `draft_ready` | igual |
| 23 | Task · Findings | `The review of the pull request found 4 changes for you to decide.` | `findings` · `decide` | Passada estruturada esperando a decisão | feito (task 7) |
| 24 | Task · Findings · ready to apply | `The approved findings of the pull request review are ready to apply.` | `findings` · `apply` | Tudo decidido com algum aprovado | feito (task 7) |
| 25 | Task · Changes to review | `The changes from the review of the pull request are ready for your review.` | `changes_review` · `review` | `in_review` | muda (hoje `ready for review`) |
| 26 | Task · No commit after approval · PR | `The last approval of the pull request didn't produce a commit.` | `changes_review` · `approve` | `ready_to_approve` com `commitFailed` | igual |
| 27 | Task · Check failed after review | `A check failed after the review: e2e (chromium).` | `pr_trouble` · `checks` | Um check falhou depois da passada | igual |
| 28 | Task · Checks failed after review | `Checks failed after the review: e2e (chromium), lint.` | `pr_trouble` · `checks` | Dois ou mais | igual |
| 29 | Task · Conflict after review | `The pull request has a conflict with dev.` | `pr_trouble` · `conflict` | Conflito com a base | igual |
| 30 | Task · Ready to merge | `PR #1284 is ready to merge.` | `merge` · `merge` | `done` com a PR aberta | muda (hoje `The pull request…`) |
| 31 | Task · Ready to merge · nothing approved | `PR #1284 is ready to merge: every finding of the review was discarded.` | `merge` · `merge` | Idem, a passada toda descartada | feito (task 7) |
| 32 | Task · Ready to close | `PR #1284 was merged. The task is ready to close.` | `merge` · `close` | `merged` | muda |
| 33 | Task · PR closed | `PR #1284 was closed without a merge.` | `pr_closed` | `pr_closed` | muda (hoje `The pull request was…`) |
| 34 | Review · Question | `The agent has a question in the review.` | `question` | A sessão do review em `needs_answer` | igual |
| 35 | Review · Permission | `Permission requested in the review.` | `permission` | `needs_permission` | igual |
| 36 | Review · Session error | `The session stopped with an error in the review.` | `session_error` | `error` | igual |
| 37 | Review · No readable report | `The reviewer stopped without a report the app can read.` | `reply` | `awaiting_reply` | igual |
| 38 | Review · Findings | `The review has 5 findings for you to decide.` | `review_report` · `decide` | `awaiting_decision` (a contagem: os por decidir quando começa) | muda |
| 39 | Review · Ready to publish | `The review is ready to publish.` | `review_report` · `publish` | `ready_to_publish` | igual |
| 40 | Review · Publish failed | `The review couldn't be published: GitHub's rate limit was reached.` | `publish_failed` | `PublishError` de pé | muda (a razão) |
| 41 | Review · Pass blocked | `The next pass of the review couldn't start: gh is not authenticated.` | `pass_blocked` | `PassBlocked` de pé | muda (a razão) |
| 42 | Review · New commits | `2 commits arrived since your review.` | `new_commits` | Commits depois do review publicado | muda |
| 43 | Review · Check failed after publishing | `A check failed after the review: e2e (chromium).` | `pr_trouble` · `checks` | Depois da publicação | igual |
| 44 | Review · Conflict after publishing | `The pull request has a conflict with dev.` | `pr_trouble` · `conflict` | Idem | igual |
| 45 | Review · Apply · ready to apply | `The approved findings are ready to apply.` | `review_report` · `apply` | `ready_to_apply` | igual |
| 46 | Review · Apply · changes to review | `The changes from the review are ready for your review.` | `changes_review` · `review` | `in_review` | muda (hoje o texto da task, `…of the pull request are ready for review.`) |
| 47 | Review · Apply · ready to merge | `The pull request is ready to merge.` | `merge` · `merge` | `ready_to_merge` | igual |
| 48 | Discussão · Question | `The agent has a question in the discussion.` | `question` | `needs_answer` | igual |
| 49 | Discussão · Permission | `Permission requested in the discussion.` | `permission` | `needs_permission` | igual |
| 50 | Discussão · Waiting for reply | `The agent is waiting for your reply in the discussion.` | `reply` | `discussing`, a sessão ociosa, os rascunhos não lidos | igual |
| 51 | Discussão · Session error | `The session stopped with an error in the discussion.` | `session_error` | `error` | igual |
| 52 | Discussão · Drafts can't be read | `The agent wrote drafts the app can't read in the discussion.` | `reply` | `awaiting_drafts` | igual |
| 53 | Discussão · Decide drafts | `There are 5 drafts to decide in the discussion.` | `drafts` | `deciding` (a contagem: os da rodada por decidir) | muda |
| 54 | Discussão · Epic can't publish, um aprovado | `The epic can't publish: approve one more of its cards, or discard it.` | `epic_cant_publish` | Dois cards ou mais, um aprovado | feito (task 8) |
| 55 | Discussão · Epic can't publish, nenhum aprovado | `The epic can't publish: approve two more of its cards, or discard it.` | `epic_cant_publish` | Dois ou mais, nenhum aprovado | feito |
| 56 | Discussão · Epic can't publish, um card | `The epic can't publish: it has one card. Move another into it, or discard it.` | `epic_cant_publish` | Um card | feito |
| 57 | Discussão · Epic can't publish, nenhum card | `The epic can't publish: it has no cards. Move two into it, or discard it.` | `epic_cant_publish` | Nenhum | feito |
| 58 | Discussão · Epic discarded, dois ou mais | `The epic is discarded, and 2 of its approved cards won't publish.` | `epic_discarded` | Dois ou mais aprovados | feito |
| 59 | Discussão · Epic discarded, um | `The epic is discarded, and its approved card won't publish.` | `epic_discarded` | Um aprovado | feito |
| 60 | Discussão · Publish failed | `Couldn't publish “Overage on the monthly invoice”: GitHub's rate limit was reached.` | `publish_failed` | Um rascunho com `PublishError` | muda (hoje `The drafts couldn't be published.`) |
| 61 | Discussão · Ready to archive | `Every draft is published or discarded. The discussion is ready to archive.` | `ready_to_archive` | Tudo publicado ou descartado, sem corrida | feito |

Resumo do código: 17 corpos mudam (1, 4, 5, 12, 17, 19, 25, 30, 32, 33, 38, 40, 41, 42, 46, 53, 60), 10 já estão escritos (23, 24, 31, 54–59, 61) e 34 ficam. `rest.md` §11 marca 1, 4, 5, 25, 33 e 46 como "muda" (§4.3 #15).

**As variantes**, além dos 61, que `text_test.go` também cobre, uma linha cada:

| Variante | Texto |
|---|---|
| Uma contagem de um | `Step 4 is ready for your review. 1 file changed.`; `…found 1 change for you to decide.`; `The review has 1 finding for you to decide.`; `There is 1 draft to decide in the discussion.`; `1 commit arrived since your review.` (a contagem das correções e a das rodadas nunca é um: a situação só nasce no máximo, `derive.go:90`) |
| O step sem a leitura dos arquivos | `Step 4 is ready for your review.` |
| Os apontamentos de uma passada em texto (anterior à task 7) | `The review of the pull request found changes for you to decide.` |
| Os checks e o conflito juntos | `A check failed after the review: e2e (chromium). The pull request has a conflict with dev.` (as duas frases, como hoje) |
| A base desconhecida no conflito | `The pull request has a conflict with its base.` |
| Pronta para encerrar sem o merge confirmado (`done` com `canClose`) | `PR #1284 is ready to close: MySpec couldn't confirm the merge.` (§4.3 #16) |
| Commits novos fora da lista recente (`-1`) | `New commits arrived since your review.` |
| Dois ou mais rascunhos que falharam | `Couldn't publish 2 drafts: <a razão do primeiro pela posição>.` |
| As razões de `step_blocked` (7) e de `pr_blocked` (5) | As frases de `stepBlockPhrase` e `prBlockPhrase` (`text.go:300–338`), sem mudança |
| Os oito lugares das quatro situações de sessão, depois de `in ` | `the PRD`, `the tech spec`, `the plan`, `One-Shot planning`, `step 3`, `the pull request`, `the review`, `the discussion` (`The agent has a question in One-Shot planning.`) |

**A razão** de 40, 41 e 60 é a mensagem que a barra mostra, composta assim (uma função só, `reasonOf`, em `text.go`): (1) tira um prefixo conhecido, `Couldn't publish to GitHub: ` (`internal/reviewflow/publish.go:200–202`), `Couldn't write to GitHub: ` (`internal/discussionflow/publish.go:757–760`), `Couldn't read from GitHub: ` (`internal/pulls/failure.go:48`) e `worktree: ` (os erros do pacote `worktree`, que `passBlocked` guarda crus, `internal/reviewflow/again.go:282`, `checks.go:62`); (2) uma mensagem sem prefixo que termina em `.`, `!` ou `?` é uma frase do produto, e vale a primeira frase dela, com a primeira letra em minúscula salvo quando a palavra começa com `GitHub`, é `gh` ou é `MySpec`; (3) o resto, e toda mensagem que tinha um prefixo (a saída do `gh` ou do `git` depois dele, mesmo terminando em ponto), é um erro cru, que entra inteiro, sem mudar a primeira letra, com os caminhos pelo `~` e um `.` no fim. O corpo é `<abertura>: <razão>`, e a razão vazia deixa só a abertura com `.`. Os exemplos exatos:

| Mensagem guardada | Corpo |
|---|---|
| `GitHub's rate limit was reached. It resets at 15:04.` (review) | `The review couldn't be published: GitHub's rate limit was reached.` |
| `This pull request is no longer on GitHub.` | `The review couldn't be published: this pull request is no longer on GitHub.` |
| `Couldn't publish to GitHub: <a saída do gh>` | `The review couldn't be published: <a saída do gh>.` |
| `gh is not authenticated. Run gh auth login.` (passada) | `The next pass of the review couldn't start: gh is not authenticated.` |
| `worktree: fetch failed: <o erro do git>` (passada, o erro cru) | `The next pass of the review couldn't start: fetch failed: <o erro do git>.` |
| `GitHub's rate limit was reached. It resets at 15:04.` (rascunho) | `Couldn't publish “Overage on the monthly invoice”: GitHub's rate limit was reached.` |
| `gh can't write to this repository. Run gh auth refresh -s repo.` | `Couldn't publish “Overage on the monthly invoice”: gh can't write to this repository.` |
| `Couldn't write to GitHub: <a saída do gh>` | `Couldn't publish “Overage on the monthly invoice”: <a saída do gh>.` |

Nada mais muda: uma notificação só com a janela fora de foco, uma vez por situação, o carrilhão, a retirada (`features.md` §Depende de mim).

#### O teclado e o foco

| Tecla | Onde | Ação |
|---|---|---|
| `/` | History | Foca a busca |
| `↓` | A busca do History | Vai ao primeiro cabeçalho |
| `↑` `↓` `Home` `End` | A lista do History | Percorrem os cabeçalhos dos dias e as linhas |
| `←` `→` | A lista do History | Numa linha, `←` vai ao cabeçalho do dia; num cabeçalho, `→` vai à primeira linha |
| `Enter` | Uma linha do History | Abre o arquivado |
| `←` `→` | As abas da task arquivada | Trocam de aba |
| `→` `←`, `Enter`, `Space` | Um marco que abre | Abre, fecha, alterna (`components.md` Marco em linha) |
| `Esc` | Um diálogo, o `⋯` | Fecha e devolve o foco a quem abriu; inerte confirmando |
| `Ctrl J` | A página que saiu | **Next that needs you** |

O foco inicial: History, a busca, ou a linha recém-arquivada quando se chega por **Open in History**; um arquivado, o título do lugar (`h1`, como toda ida da task 2); os diálogos destrutivos, **Cancel**; a página que saiu, **Next that needs you**, ou a primeira ação habilitada sem nada esperando (**Open in History**; na task apagada, a volta). Depois de cada desfecho: o arquivado apagado, a linha que tomou o lugar dele; a task apagada, **Next that needs you** da página; o step descartado e a etapa reaberta, o compositor; **Cancel** e `Esc`, o gatilho (o item do `⋯` fecha com o menu, então o foco vai ao `⋯`).

#### A primária por cena

| Cena | Primária |
|---|---|
| History, a lista e os vazios | Nenhuma |
| Um arquivado | Nenhuma |
| Delete task, Discard step, Back to…, Discard and restart…, Delete de um arquivado | Nenhuma: a confirmação é perigosa |
| A página que saiu | **Next that needs you**; sem nada esperando, **Open in History**; a task apagada sem nada esperando, **Back to Platform Roadmap**, a primeira ação habilitada, como a `GonePage` da task 2 já faz (`components/system/GonePage.tsx:34`) |
| Os toasts e o aviso do app | Nenhuma: sobre a tela, a primária é a de baixo |

#### Acessibilidade

A barra do History é `role="search"`; a lista é o `tree` `History`, com o cabeçalho de cada dia como `treeitem` de nível 1, com `aria-level` e `aria-expanded="true"` fixo, e cada linha como `treeitem` de nível 2 com o nome inteiro da §4.2 e `aria-selected` na recém-arquivada. A contagem da barra é texto, não região viva; a linha `Loading older items…` é `role="status"`, e a falha, `role="alert"`. Os fatos de um arquivado são uma `dl`; as seções têm `h2`; as abas são `tablist` com `aria-controls`. O resultado do encerramento e o que ficou no disco são `role="group"` com o nome. A prévia é uma lista com `aria-label` `What will be destroyed`, e a leitura dela é `role="status"`. Os diálogos destrutivos são `alertdialog` com `aria-labelledby` e `aria-describedby` no corpo; a confirmação carregando tem `aria-busy`. Todo botão tracejado tem a razão por `aria-describedby`. Os testes acham cada peça por `getByRole` com o nome inteiro desta seção.

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem pelo coordenador ao aceitar o material; ele pode vetar.

| # | Lacuna | Decisão | Onde vai |
|---|---|---|---|
| 1 | **Open in History** abria o arquivado na task 2 (`tasks/02-shell.md:174`) e, no mock, só a task chega à linha destacada (`other.js:59–80`) | A página que saiu e o toast, nos três tipos, abrem o History com a linha recém-arquivada, a regra geral de `rest.md:310` | `rest.md` §9; `components.md` Aviso do app e toast |
| 2 | A contagem e o período da barra com a janela de 90 dias | Sempre do History inteiro, pelo resumo de P33; com filtro ou busca, `N of 44` | `rest.md` §3; `backend.md` P33 |
| 3 | O `#number` da busca, que hoje casa só com o review | Casa também com a PR e o card de uma task, como o placeholder e o vazio dizem | `rest.md` §3 |
| 4 | A linha recém-arquivada escondida pela busca ou pelo filtro | A chegada limpa a busca; o filtro fica, e a linha aparece assim mesmo, fora da contagem | `rest.md` §3 |
| 5 | `dev not updated` "quando o encerramento pulou a base" | Base pulada por outra razão que não `up_to_date`, ou falhou; o nome da base, não `dev` fixo | `rest.md` §3 |
| 6 | O "o que fazer" das linhas puladas, só pelo exemplo, e o detalhe do mock que o produto não guarda (`critique.md:125`) | A tabela da §4.2, com o caminho do clone, sem o ramo em checkout | `rest.md` §4; `components.md` Resultado do encerramento |
| 7 | O arquivo de cada step, que a task arquivada abre hoje e o mock não mostra | A linha do step é o marco que abre o arquivo no lugar | `rest.md` §4 |
| 8 | Os relatórios do step de uma One-Shot, sem lugar nas duas abas | A seção `Implementation` no fim de **One-Shot document** | `rest.md` §4 |
| 9 | Os textos do apagar de um review arquivado (o de hoje fala de worktree e conversa, que ele não tem) | Os da §4.2; o da discussão é o da task 9 | `rest.md` §4 |
| 10 | `Ctrl+Enter` nos diálogos destrutivos | Não confirma: o gesto destrutivo nunca fica a um atalho, com o foco em **Cancel**; é o que o **Delete review** da task 6 e os diálogos destrutivos das tasks 9 e 10 já fazem (o `Dialog` sem `onConfirm`, que é quem liga o `Ctrl+Enter`, `components/system/Dialog.tsx:74–79`) e o que `rest.md:642` diz (`Ctrl ↵` confirma com o primário, que um destrutivo não tem) | `decisions.md` 2026-10-02; `components.md` Diálogo (Teclado) e `structure.md:372`, já registrados |
| 11 | `The reviewer's answer in progress is interrupted` "quando uma sessão roda": o Go diz `SessionRunning` com o processo vivo, ocioso ou não (`internal/flow/close.go:201–206`) | Só um turno rodando, nomeado pelo papel da conversa; nos três diálogos, como pedia a crítica do mock (`critique.md:177`) | `rest.md` §10 |
| 12 | Os diálogos fecham antes e mandam a falha ao aviso (`DeleteTaskDialog.tsx:173–176`, `DiscardStepDialog.tsx:68–71`, `StageActionDialog.tsx:60–63`) | Ficam abertos até o fim, com a falha no rodapé, como a task 9 fez com os da discussão e a 10 com os de Settings | `rest.md` §10; `changes.md` X13, X14 |
| 13 | O comando do que ficou no disco: o produto já remove com `--force` (`internal/git/commands.go:82–85`), e o erro do mock (`use --force to delete it`) não acontece | O comando depende do registro: o Go diz no `Leftover` se a pasta continua registrada como worktree (`registered`, lido de `git worktree list`, fora as que o git podaria). Registrada, como depois do prazo, o comando é `git worktree remove --force <caminho>`; fora do registro, como depois de uma permissão, em que o git tira a worktree do registro antes de falhar na pasta e o `remove` diria `is not a working tree`, é `rm -rf <caminho>`, com o mesmo aviso (`rm -rf deletes the modified and untracked files in it too.`). A fixture usa um erro que o produto pode receber; a branch tem o próprio comando | `rest.md` §9 |
| 14 | O que ficou no disco de um review apagado, que ia ao mesmo `LeftoversNotice` com `The task is gone` (`research/rest.md:428`) | Vai à página do review apagado, na mesma forma | `rest.md` §9 |
| 15 | `rest.md` §11 marcava como "igual" seis textos que diferem do código (1, 4, 5, 25, 33, 46) | Vale o texto da tabela, a fonte única: as etapas Structured com o artigo, e a sessão `pr_review` da task diz `the review` | `rest.md` §11 |
| 16 | `Ready to close` sem o merge confirmado, que `rest.md` não separa e diria `was merged` sem saber | `PR #1284 is ready to close: MySpec couldn't confirm the merge.` | `rest.md` §11 |
| 17 | As razões de `Publish failed` e `Pass blocked` sem regra | A da barra, sem mudar | `rest.md` §11 |
| 18 | Os textos com contagem no singular, o rascunho que falhou quando são vários, e os exemplos das linhas 21 e 41, que nenhuma razão do produto produz (`PRBlockReason`, `internal/task/pr.go:42–46`; `passBlocked` é a mensagem crua) | As variantes da §4.2; `the GitHub CLI isn't authenticated` e `gh is not authenticated` | `rest.md` §11 |
| 19 | O detalhe dos toasts de review fechado e de discussão, e o de uma task sem nada pulado | A tabela da §4.2 | `rest.md` §8 |
| 20 | O texto da página da task encerrada sem a hora do merge, com o merge não confirmado e numa One-Shot | A tabela da §4.2 | `rest.md` §9 |
| 21 | A PR da task apagada, que o estado já não tem quando a página aparece | O lugar `gone` guarda o número e o estado da PR da última leitura (§4.4) | `rest.md` §9 |
| 22 | A contagem de **Discard step** com a worktree limpa ou ilegível | Os textos da §4.2; a caixa fica marcada | `rest.md` §10 |
| 23 | A lista do que se perde só pelos exemplos | A fórmula da §4.2, com a PR e a worktree como itens próprios | `rest.md` §10 |
| 24 | O título e o texto de **Discard step** numa One-Shot, e o de onde parte a sessão nova do PRD | `Discard the implementation and start over?`; `from the card <ref>` ou `from your description` | `rest.md` §10 |
| 25 | O foco depois de apagar um arquivado, de descartar e de voltar | Os destinos da §4.2 | `rest.md` §13 |
| 26 | Os antigos do History: quando pedir, como dizer que carrega e que falhou | Ao chegar a última linha, e com a busca depois de 300 ms; as linhas do pé | `rest.md` §3 |
| 27 | Divergências do mock | Vale o material em tudo o que ele diz (`implementation.md:18`). As conhecidas: o filtro `acme/web` deixa entrar `Webhook delivery guarantees` (`history.js:21`, `critique.md:114`); o review ligado ao card de outra task (`critique.md:126`); as contagens de `data.js` contra o History (`critique.md:70–73`); o `·` solto dos marcos (`critique.md:124`); `Review of the pull request` com hora no marco, que o arquivado não guarda; o **Open in History** do review e da discussão para o arquivado (#1); o erro `use --force` (#13); `the conversations of the 7 steps…` (`other.js:107`), que pela fórmula da §4.2 é `the conversations of steps 1 to 7…`; `The PR reviewer's answer…`, que é `The PR agent's answer…` pelo papel da conversa; as aspas retas de `rest.md` §4 e §10, que são as curvas de todo o produto (`“…”`, como a task 9) | `implementation.md:18` |
| 28 | As datas dos arquivados: hoje cada um mostra o começo e o arquivamento (`formatDates`, `ArchivedTaskView.tsx:137`, `ArchivedReviewView.tsx:133`, `ArchivedDiscussionView.tsx:152`), e os fatos do mock perdiam o começo do review e da discussão e o arquivamento de uma task sem o encerramento | `Started` nos três; `Archived` na task sem o bloco do encerramento e no review sem a hora do merge ou do fechamento; a discussão já tem `Archived` | `rest.md` §4 |
| 29 | A forma da lista do History: `rest.md` §3 diz que `↑` e `↓` percorrem as linhas, e o system diz que a lista é um `tree` que visita também os cabeçalhos | O `tree` de `components.md` e `structure.md:355`: os dias navegáveis, o anel por fora, `useListTree` | `rest.md` §3 |
| 30 | O texto de apagar uma discussão arquivada: o da task 9 é o da ativa e diria que ela não vai ao History | A linha da tabela de Apagar um arquivado, por uma propriedade do componente da 9 | `rest.md` §4 |
| 31 | A contagem da barra enquanto a busca espera os antigos, e o período com o filtro | A parte da janela com o brilho até a resposta do Go, que conta o History inteiro; o período sempre o do History inteiro | `rest.md` §3 |
| 32 | O rascunho e os relatórios da PR de cada task arquivada no estado, a cada publicação | No estado só se há rascunho e a lista dos relatórios; os textos lidos ao abrir, como os documentos | `backend.md` P28 |
| 33 | O item do `⋯` que abre um diálogo: o `Menu` do system devolve o foco ao `⋯` ao fechar, atrás do diálogo, e Tab e `Enter` agem atrás dele. A task 10 corrigiu só o `⋯` de um repositório (`handsFocus`, `features/repositories/RepositoryMenu.tsx:29, 48–52, 74–77`; `critique-task-10.md:218–225`); o `⋯` da task e o do review abrem os diálogos desta sem isso (`task/TaskMenu.tsx:88–126`, `reviews/ReviewMenu.tsx:66–89`), e o do arquivado nasce aqui | Todo item do `⋯` que abre um diálogo desta task entrega o foco a ele, como o do repositório: o diálogo abre em **Cancel** com o Tab preso, e fechar sem confirmar devolve o foco ao `⋯`. O teste abre pelo `⋯`, e não direto, e espera a guarda do foco depois de cada `userEvent.tab()` (`expect.poll`), porque conferir logo depois falha sob carga (`critique-task-10.md:489–505`); um teste jsdom prova que o menu não devolve o foco | `components.md` Menu do item (`⋯`), Teclado |
| 34 | Os fatos de um arquivado como peça nova (`FactList`), quando a lista de termos já existe fora do system: `Fact` e `FACTS` (`components/Facts.tsx`, task 6), nos `Details` da task, do review e da discussão e no painel da PR, com a grade do painel (`--col-keys`, `--space-1-5` × `--space-3`) | Os fatos do arquivado usam `Fact`, com a grade da §4.2 (`max-content`, `--space-1` × `--space-5`, a do mock, `rest.css:255`) numa segunda constante ao lado de `FACTS`; não nasce outra peça | `docs/architecture/design-system.md` §Componentes |
| 35 | O cabeçalho do bloco copiável da página da task apagada: o `CopyBlock` da task 10 escreve o rótulo em caixa alta (`components/system/CopyBlock.tsx:15–17`), feito para `error`, e `To remove it yourself, in ~/code/api` sairia `~/CODE/API`, um caminho que não existe; o mock usa o cabeçalho do bloco de código, sem caixa alta (`other.js:70`, `.code .ch`) | O `CopyBlock` ganha o cabeçalho de frase, em `--text-micro` `--ink-3` sem caixa alta, para um rótulo que leva um caminho; o de `error` continua | `components.md` Marca e cópia (Bloco copiável) |

### 4.4 O que o tech spec toma

- **P27.** `ArchivedTask` (`internal/bindings/dto.go:583–602`) ganha `close` (o `CloseResult` que `FromArchived`, `convert.go:427–460`, já recebe em `prRun` e descarta; `nil` sem ele); `ArchivedPR` (576–581) ganha `base`, `mergedBy` e `mergedAt` (de `task.PRDetails`, `internal/task/pr.go:82–94`); `ArchivedStep` (568–574) ganha `commitSha`, lido das execuções dos steps, que o arquivamento não apaga (`task.StepRun.CommitSHA`, `internal/task/step.go:73`).
- **P28.** `ArchivedTask` ganha `hasPrDraft` e `prReports` (de cada relatório, só `pass`, `file`, `clean`, `structured` e a contagem de apontamentos), sem os textos: o rascunho e os relatórios são lidos ao abrir a aba e o marco, por `ReadArtifact` (`useArtifact` com `pr/draft.md` e `pr/review-<n>.md`), como o PRD, para o estado não carregar o corpo de cada rascunho a cada publicação (§4.3 #32). Os dados vêm de onde a etapa de PR de uma task ativa os lê: `pr/draft.md` e `pr/review-<n>.md` na pasta de artefatos (`internal/task/pr_artifacts.go:19`), que o arquivamento mantém, e `pr_passes`, que só `ClearPRRun` apaga (`internal/task/service.go:977–985`, chamado por voltar e descartar, nunca pelo arquivamento). Verificado: o custo é pequeno, como `backend.md` previa.
- **P29.** O `Leftover` (`dto.go:638–643`) passa a dizer cada parte: `repoPath` (o clone), `worktree` (`path`, `kept`, `error`) e `branch` (`name`, `kept`, `error`), para a página ter uma linha por parte e o comando; hoje um erro só, juntado (`internal/worktree/close.go:234–262`). O do review (`internal/reviewflow/delete.go:10–55`) ganha o erro e o clone. O frontend guarda o que ficou no disco pelo id do item, ao receber a resposta do apagamento, e a página do item apagado o lê; nada é gravado no banco: a página só existe enquanto o app roda. O lugar `gone` (`lib/locations.ts:23`) guarda também o número e o estado da PR da última leitura, para o texto da task apagada.
- **P30.** `BranchPreview` (`dto.go:613–618`) ganha `ahead` (os commits da branch fora da base, `git rev-list --count`, que `internal/git/commands.go:333` já roda; `-1` quando não se sabe; `0` mergeada), em `branchPreview` (`internal/flow/close.go:229–245`). A mesma leitura serve aos três diálogos: o tech spec decide entre o `PreviewDelete` de hoje e um nome que diga isso (`PreviewLoss`), com o mesmo retrato. `SessionRunning` deixa de ser lido pela interface, que usa o estado (§4.3 #11).
- **P33, o History por partes.** O estado traz os arquivados dos últimos 90 dias (`History`, `ReviewHistory`, `DiscussionHistory`, montados hoje inteiros a cada publicação, com a leitura dos artefatos de cada task arquivada, `internal/app/state.go:70–92`) e um resumo (`historySummary`): as contagens por tipo, a data do mais antigo e as contagens por repositório (tasks e reviews já estão em `Repository.archivedTasks` e `archivedReviews`, `dto.go:53, 62`; as discussões passam a ter a delas, por `repositoryIds`). Um `HistoryService` novo dá a página seguinte (`ListArchived` com a data de corte, a busca, o repositório e o tamanho, 50, nos mesmos DTOs) e um arquivado pelo id, para um lugar guardado de antes cujo item está fora da janela. O frontend guarda o que pediu num cache do store, e `useArchivedTask`, `useArchivedReview`, `useArchivedDiscussion` e `findArchived*` (`store/app-store.ts:438–472, 1597–1662`, `lib/locations.ts:97–107`) leem o estado e o cache. Os outros leitores dos arrays: o rodapé conta pelo resumo (`SidebarFooter.tsx:49–60`), também para o **History** tracejado das boas-vindas; `archivedAnything` (`lib/welcome.ts:17–24`, task 10), que deixa History e os arquivados ao alcance nas boas-vindas, lê o resumo, senão um History só com antigos diria `Nothing archived yet`; `takenNames` (`lib/repositories.ts:89–94`) fica com a janela, e um nome repetido de um arquivado antigo é recusado pelo Go (`task.ErrNameTaken`, `internal/task/task.go:110`) no rodapé do diálogo de criação; o nome da task arquivada de um card (`features/board/card-panel.ts:218`) passa a vir do `BoardCard` (`archivedTaskName`), porque ela pode estar fora da janela; `lastUsedBoard` (`features/discussion/new-discussion.ts:158–169`) fica com a janela; `placeIn` (`store/app-store.ts:783–792`) passa a achar um arquivado também no cache, senão um arquivado antigo aberto voltaria ao History a cada publicação do estado; `newlyArchived` (`:476–482`, `:906`) compara só a janela, onde um item recém-arquivado sempre está. `archivedTaskName` no `BoardCard` é um campo novo do DTO que o coordenador acrescenta a `backend.md` P33. A busca dos antigos é feita no Go, sem maiúsculas, pelas mesmas regras da §4.2, e a resposta traz o total do que casa no History inteiro, para a contagem da barra.
- **P37.** `text.go` com os 61 textos e as variantes da §4.2; `mergeBody` e `changesReviewBody` separam a task do review (30 e 47; 25 e 46); `placeName` recebe a sessão da etapa de PR; os dados que faltam aos corpos (a contagem de correções, os arquivos do step, as rodadas, o número da PR, os apontamentos por decidir do review, a razão da falha e do bloqueio, os commits novos, os rascunhos por decidir, o título e a razão do rascunho que falhou) já estão nas entradas de `Derive`, `DeriveReview` e `DeriveDiscussion`; o título do review é montado em `internal/app/state.go:112–114`. Um corpo que muda numa situação em curso não notifica de novo (a regra de hoje: a notificação sai quando a situação começa).
- **As ações destrutivas no lugar.** `deleteTask`, `deleteReview` e o apagar de um arquivado passam a devolver a falha ao diálogo pelo `removalInPlace` da task 9 (`store/actions.ts:997–1006`), que marca o item como `runRemoval` (`:402–417`) para o apagamento não ser anunciado; `discardStep`, `backToStage` e `discardStage`, que não tiram o item, pelo `inPlace` (`:66–73`); `deleteTask` e `deleteReview` guardam o que ficou no disco pelo id, em vez de `setLeftover`.
- **A linha recém-arquivada** é um campo do lugar `history` (`{ kind: "history", fresh?: { kind, id } }`), não persistido na pilha: voltar ao History pelo `←` não a destaca de novo.
- **O marco que abre um documento fora da conversa.** `MarkerLine` (`features/chat/entries/MarkerLine.tsx:218–284`) lê o documento pela `TaskSummary`, pela `ReviewSummary` ou pelo `discussion` da task 9, que já é só o id com `documents: false` para o arquivado, sem o rodapé **Open in Documents** (`ArchivedDiscussionView.tsx:105–119`); o arquivado da task e o do review leem pelo id do item (`useArtifact` e `useReviewArtifact` já aceitam o id). O tech spec escolhe entre a mesma forma da discussão para a task e o review e um componente irmão; o rodapé **Open in …** não aparece no arquivado, que não tem painel.
- **Onde moram as funções puras**: `features/history/history-list.ts` (a janela, a busca com o `#N`, o filtro, o dia, a contagem e o período; hoje 1–76), `features/history/history-rows.ts` (a linha de cada tipo e o nome acessível), `features/history/archived.ts` (os fatos dos três tipos, a frase das passadas, o que a discussão publicou), `features/history/close-result.ts` (as linhas do encerramento com o que fazer, e a parte que vai ao toast), `features/task/deletion.ts` (as linhas da prévia, a sessão interrompida, os textos de **Discard step**), `features/task/stage-actions.ts` (os itens que se perdem com as contagens, o título, o que fica; hoje 1–94), `features/navigation/gone-task.ts` (os textos das páginas da task, as linhas e os comandos do que ficou no disco), `features/notice/toasts.ts` (o texto e o detalhe de cada toast).

## 5. Inventário atual

### 5.1 As features

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `history/HistoryPanel.tsx` (1–206) | A lista misturada, sem dias (188–200); `RepositoryFilter` próprio (169); a busca com `autoFocus` (162); `HistoryPR` com `#N ↗` (20–38); três linhas em `Badge` (51–136); `Try another name, or clear the search.` (185) | Sai: `features/history/HistoryView.tsx` com a barra, os dias, a linha e os estados |
| `history/history-list.ts` (1–76) | `historyEntries`: o filtro, a busca, a ordem (41–76) | Fica e cresce (§4.4) |
| `history/history-format.ts` (1–18) | `formatDate`, `formatDates` (`Sep 12, 2026 → Sep 24, 2026`), `stepCount`; os leitores são os quatro arquivos do History desta task | Sai: as datas e as contagens passam às funções da §4.4 |
| `history/ArchivedTaskView.tsx` (1–255) | `Archived` e `CardLink` no cabeçalho (116–117), a lixeira (118–125), a faixa das datas (136–140), o `ToggleGroup` das abas (154–174), `← Steps` (177–195), os steps como lista que abre o arquivo (198–218), o `Banner` do erro (231–238) | Reescrita: §4.2 A task arquivada |
| `task/OneShotView.tsx` (1–99) | O documento One-Shot com os relatórios acima, usado só pelo arquivado | Sai |
| `task/StepList.tsx` (1–237) | `StepReportList`, `ProblemList`, `StepList`; o único leitor é o arquivado (`ArchivedTaskView.tsx:16`) | Sai com o arquivado |
| `task/StatusDot.tsx` (1–44) | `ToneDot` e `StatusDot`; o único leitor é `StepList` (`StepList.tsx:3`) | Sai com `StepList` |
| `components/CardLink.tsx` (1–25) | O link do card, usado só pelos arquivados (`ArchivedTaskView.tsx:3`, `ArchivedReviewView.tsx:3`) | Sai: o card vai aos fatos |
| `sidebar/RepositoryFilter.tsx` (1–59) | O seletor de repositório, cujo único leitor é o History (`HistoryPanel.tsx:9`); lê `--status-attention` (48) | Sai com `HistoryPanel`: o filtro do History é o da lateral, como chip |
| `reviews/DeleteReviewDialog.tsx` (1–57) | O diálogo da task 6, de um review ativo (`ReviewMenu.tsx:89`) e do arquivado; fecha no `finally` e manda a falha ao aviso (21–29) | Fica e muda: espera o fim, com a falha no rodapé, e ganha a variante do arquivado |
| `reviews/ArchivedReviewView.tsx` (1–149) | O desfecho, `CardLink`, **Open on GitHub** e a lixeira no cabeçalho (108–129); o autor e as datas (131–134); cada passada com `Published` e os apontamentos em cartões (31–85); o `Banner` (69–77) | Sai para `features/history/ArchivedReview.tsx`: §4.2 O review arquivado |
| `discussion/ArchivedDiscussionView.tsx` (1–197) | `Archived`, a lixeira e o `DeleteDiscussionDialog` com `archived` (132–149); as datas e `N cards published` (151–156); **Document**, **Drafts** e **Conversation** em sequência (158–193), a conversa com o `discussion` dos marcos, para as rodadas dobrarem (105–119, 186–191, task 9) | Sai para `features/history/ArchivedDiscussion.tsx`: §4.2 A discussão arquivada, que mantém o `discussion` dos marcos; a lista dos rascunhos (`DraftLine`, `Drafts`, 34–82) dá lugar a What it published |
| `discussion/DeleteDiscussionDialog.tsx` (1–87) | O diálogo da task 9 no `Dialog` do system, aberto até o fim, com a recusa no rodapé (`deleteDiscussionInPlace`); a propriedade `archived` (11–12) tira só a frase do History (65–67) | Fica; a variante do arquivado passa a dizer os textos da §4.2 (Apagar um arquivado) e volta ao History |
| `discussion/discussion-status.ts` | `epicGroups`, `looseDrafts`, `kindLabel`, `outcomeLabel`, os rótulos (task 9) | Fica; What it published usa os grupos e os rótulos |
| `task/DeleteTaskDialog.tsx` (1–184) | `AlertDialog` do shadcn; o título com aspas retas (100); a prévia em seções contornadas (128–166); `The conversation in progress will be interrupted.` (132); `N uncommitted` (141); `not merged` sem a contagem (157); o `Banner` da leitura que falhou (118–126); **Delete** fecha antes de apagar (171–177); o texto do arquivado (102–104) | Reescrito no `Dialog` do system: §4.2 Delete task; o caso do arquivado vai ao diálogo do arquivado |
| `task/DiscardStepDialog.tsx` (1–80) | `AlertDialog`; os dois textos (46–48); a caixa com o texto fixo (52–63); **Discard** fecha antes (67–74) | Reescrito: §4.2 Discard step |
| `task/StageActionDialog.tsx` (1–72) | `AlertDialog`; a frase única do que se perde; `OrphanPR`; **Back** ou **Discard** fecha antes (58–68) | Reescrito: §4.2 Back to… e Discard and restart… |
| `task/stage-actions.ts` (1–94) | `LOSSES` sem a PR e com a worktree dentro dos steps (9–20); `backDescription`, `discardDescription`, `stageActionTitle` | Fica e cresce: a lista, as contagens, o que fica |
| `task/OrphanPRs.tsx` (1–42) | `This pull request stays open on GitHub:` mesmo mergeada (30–39) | Sai: a linha da prévia e a nota do Back |
| `task/TaskMenu.tsx` (108–126), `task/TaskRequest.tsx` (188–205) | Abrem os três diálogos | Ficam; passam as props novas |
| `notice/LeftoversNotice.tsx` (1–31) | `Some files stayed on disk` · `The task is gone, but git couldn't remove everything:` | Sai: a página do item apagado |
| `notice/AppNotices.tsx` (1–20) | O aviso e `LeftoversNotice` (17) | Fica só com o aviso |
| `notice/Notice.tsx` (1–43) | `Banner`, um aviso dispensável dentro de um lugar; os leitores são todos desta task (`ArchivedTaskView`, `ArchivedReviewView`, `OneShotView`, `DeleteTaskDialog`, `LeftoversNotice`) | Sai com o último deles (§8, step 11) |
| `notice/ShellToasts.tsx` (1–62) | Só tasks: `“<nome>” was archived` (47) e **Open in History** que abre o arquivado (49) | Reescrito: os três tipos, o detalhe, a linha recém-arquivada |
| `navigation/GoneView.tsx` (1–180) | O texto e as passadas do review (91–96, 141, 152) e o texto e as rodadas da discussão (92–97, 142–153, task 9), no bloco `GonePasses` (52–77); a task só com o título; **Open in History** abre o arquivado (41–50, 125–131) | Cresce: a task encerrada e a apagada, o que ficou no disco, **Open in History** à linha |
| `navigation/gone-passes.ts` (1–95), `navigation/gone-rounds.ts` (1–37) | As linhas das passadas do review (task 6) e das rodadas da discussão (task 9) | Ficam; a frase das passadas do review arquivado reaproveita as regras |

Testes: 3 arquivos em `features/history`, 4 em `features/notice`, os de `StepList` (337 linhas), `StatusDot`, `CardLink` e `RepositoryFilter`, os de `DeleteTaskDialog`, `DiscardStepDialog`, `OrphanPRs` e `stage-actions` em `features/task`, `GoneView.test.tsx`, `ArchivedReviewView.test.tsx`, `ArchivedDiscussionView.test.tsx` e `DeleteDiscussionDialog.test.tsx`, e os de `components/system/Toast` e `GonePage`; cada um sai ou muda com o componente que testa, e os novos nascem no mesmo step.

### 5.2 Outros lugares que a task toca

| Arquivo | Hoje | Destino |
|---|---|---|
| `store/app-store.ts` (77–88, 434–482, 783–792, 885–969, 1207–1212, 1593–1666, 1707–1718) | `Toast` só de task; `newlyArchived` só olha `history`; os arquivados lidos só do estado; `leftover` único; o lugar `history` sem a linha recém-arquivada | Os toasts por tipo com o detalhe; o cache dos antigos; o que ficou no disco pelo id; `fresh` |
| `store/actions.ts` (51–73, 402–427, 552–593, 867–875, 997–1016) | `run()` com o aviso; `deleteTask` e `deleteReview` com `setLeftover`; `removalInPlace` e `deleteDiscussionInPlace` (task 9) | As destrutivas no lugar, pelo `removalInPlace`; o que ficou no disco pelo id; `listArchived`, `getArchived` |
| `lib/locations.ts` (10–23, 97–107, 260–302) | `history` sem campo; `gone` sem a PR; os arquivados só no estado | `fresh`; a PR no `gone`; os títulos da página da task |
| `lib/wails.ts` (1461–1462) e `test/wails-mock.ts` | `deleteTask`, `previewDelete` | Os DTOs novos e `HistoryService` |
| `features/sidebar/SidebarFooter.tsx` (30–60, 126–151) | A contagem pelo tamanho dos arrays, que também tracejava **History** nas boas-vindas sem nada arquivado (task 10) | Pelo resumo de P33 |
| `lib/welcome.ts` (17–24) | `archivedAnything` pelos arrays (task 10) | Pelo resumo de P33 |
| `features/board/card-panel.ts` (215–219) | O nome da task arquivada do card pelo `history` | Pelo `BoardCard` (P33) |
| `components/system/Toast.tsx` (1–100) | Sem detalhe | Com o detalhe (§5.3) |
| `internal/attention/text.go` (1–338) e os três `derive_*_test.go` | Os corpos de hoje | P37 e `text_test.go` |
| `internal/app/state.go` (70–92, 112–114) | O History inteiro a cada publicação; o título do review sem o título da PR | P33; P37 |
| `internal/bindings/dto.go` (568–650, 53–62, 1103), `convert.go` (427–520), `task_service.go`, `review_service.go` (304), um `history_service.go` novo | — | P27, P28, P29, P30, P33 |
| `internal/flow/close.go` (173–245), `internal/flow/step.go` (1010–1035), `internal/worktree/close.go` (234–262), `internal/reviewflow/delete.go` (10–55) | `SessionRunning` pelo processo; `Merged` sem a contagem; o erro juntado | P29, P30 |
| `internal/task/service.go`, `internal/store/tasks.go`, `reviews.go`, `discussions.go` | As listas arquivadas inteiras | A janela, a página seguinte, o resumo, a busca |

### 5.3 Os componentes do system

| Peça (`components.md`) | Hoje | Nesta task |
|---|---|---|
| Linha de lista, variante History, e o cabeçalho de seção estático (o dia) | `ListRow` e `ListSectionHeader` com as variantes do card e da PR (task 5, 6) | As variantes novas, com testes de componente e pintados nos dois modos |
| Resultado do encerramento (`CloseResult`) e o bloco do que ficou no disco (a mesma forma) | Não existem | Nascem em `components/system/` |
| Prévia de um apagamento (`DeletionPreview`) com o esqueleto e o erro | Não existe | Nasce em `components/system/` |
| Os fatos de um arquivado | `Fact` e `FACTS` (`components/Facts.tsx`, task 6), a lista de termos dos `Details` e do painel da PR | `Fact` com a grade do arquivado ao lado de `FACTS` (§4.3 #34) |
| `Toast` com o detalhe | Sem detalhe (task 2) | Ganha `detail` |
| `GonePage`, `AppNotice`, `ToastRegion`, `Checkbox`, `Tabs`, `Tag`, `SearchInput`, `FilterBar`, `Chip`, `EmptyState`, `Skeleton`, `Shimmer`, `Spinner`, `StateGlyph`, `Tooltip`, `Link`, `IconButton`, `Button`, `Kbd`, `PlaceHeader`, `SunkenLine`, `NoticeStrip` | Existem (tasks 1 a 6) | Usados como estão |
| `Dialog`, `DialogBody`, `DialogFooter` (com `refusal` acima e `reason` cortada à esquerda, os botões parados), `DialogCancel` (`components/system/Dialog.tsx`) | Com a forma das tasks 9 e 10 | Usados como estão, no mínimo destrutivo |
| `CutText` (`components/system/CutText.tsx`) | Da task 9: o tooltip só quando corta | Todo corte desta task |
| `Menu` com o item `destructive` | O item perigoso em `--state-error`, desabilitado sem vermelho (task 10) | **Delete…** do `⋯` do arquivado; o foco entregue ao diálogo (§4.3 #33) |
| `CopyBlock`, `CopyButton` (`components/system/`), os ícones `copy` e `folder` (`icons.ts:110–111`), `displayPath` e `displayPaths` (`lib/paths.ts`) | Da task 10 | Usados como estão, menos o cabeçalho de frase do `CopyBlock` (§4.3 #35) |
| O ícone `branch` (`GitFork` do lucide; o `GitBranch` já é o do subagente, `icons.ts:96`) | Não existe | Acrescentado em `icons.ts` e em `components.md` Ícones |
| O marco em linha (`MarkerLine`) e o corpo dos apontamentos de `You decided` | Da task 4 e da 6 | Usados num arquivado, pelo leitor do id (§4.4) |

### 5.4 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| O resultado do encerramento de uma task arquivada | `pr_runs.close_result`, lido em `prRun` e descartado (`convert.go:427–460`) | P27 |
| A base, quem fez o merge e quando, da PR de uma task arquivada | `task.PRDetails` (`pr.go:82–94`) | P27 |
| O SHA do commit de cada step arquivado | As execuções dos steps (`step.go:73`) | P27 |
| O rascunho e os relatórios da PR de uma task arquivada | `pr/draft.md`, `pr/review-<n>.md`, `pr_passes` | P28 |
| O que ficou no disco, por parte, com o clone | Um `Leftover` com o erro juntado; o do review só com o caminho | P29 |
| Os arquivos não commitados da worktree | `WorktreePreview.files` (`dto.go:604–611`) | — |
| Os commits da branch fora da base | `BranchPreview.merged` (613–618) | P30 |
| A conversa que trabalha na task | `workingSession` sobre o estado (P1, task 2) | — |
| Os arquivados dos últimos 90 dias, o resumo, os antigos e a busca | Tudo, inteiro, a cada publicação | P33 |
| O review e a discussão que saíram sem estar abertos | `reviewHistory`, `discussionHistory` no estado | F20, só frontend |
| A ação que falhou no aviso | `run()` com o rótulo (task 2) | — |
| Os corpos das notificações e o título do review | `text.go`; os dados nas entradas das derivações | P37 |
| As rodadas de uma discussão arquivada | `Draft.round` (`dto.go:1604`, task 9) | — |

## 6. Riscos, as outras tasks e o primeiro step

| Risco | Tratamento |
|---|---|
| **O History por partes muda a fonte de dados dos leitores dos arrays (§4.4)** | P33 é o step 3, sozinho e sem mudança visível: a lista de hoje passa a ler a janela mais os antigos pedidos ao montar, e os leitores da §4.4 trocam de fonte com testes de tabela; a lista nova entra no step 7 sobre os dados prontos, e os antigos sob demanda no 8 |
| **A página que saiu antes do que ficou no disco** | O bloco chega depois, sem mover o foco; o teste de componente cobre a ordem inversa (a resposta antes do estado) |
| **Os diálogos que esperam o fim** | O apagamento de uma task com uma worktree grande pode levar segundos (o `git worktree remove` tem o prazo do produto); `Deleting…` e `Esc` inerte dizem que corre. O teste prova que a página aparece quando o estado chega, com o diálogo ainda aberto, e que o diálogo some com a task |
| **Os textos das notificações** | Os 17 que mudam vão num step só de Go, com `text_test.go` e os testes das derivações que leem os corpos; nenhum corpo muda a regra de quando notificar |
| **A lista de 90 dias sem virtualização** | Umas 360 linhas no ritmo medido; o step 8 mede a primeira pintura e a tecla `↓` com 400 linhas no WebKitGTK da máquina alvo, como a task 5 mediu o board, e registra em `target-machine.md`; o teste pintado mede as duas com 400 e com 40 itens na mesma execução e aceita até 30 vezes a mediana quente de 40 (linear, a razão fica perto de 10), sem teto absoluto, que dependeria da carga da máquina; passando das metas da task 5, a virtualização vai à task 12 com a medida |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria |

**Onde a task 11 se toca com as outras.** As tasks 9 e 10 estão na `main` em `c9ab0ea`: o que fizeram nos arquivos que esta toca já está no inventário da §5 (`GoneView.tsx`, `DeleteDiscussionDialog.tsx`, `store/`, `SidebarFooter.tsx`, `lib/welcome.ts`, `state.go`, `icons.ts`, `features.md`), e não há conflito a resolver. `frontend/bindings/**` é refeito por `task generate`, nunca à mão. Com a 12:

| Arquivo | O que a 12 faz | O conflito |
|---|---|---|
| `design/system/components.md` | O passe de consistência | A 11 não muda `components.md`; o coordenador registra a §4.3 |
| `components/system/` e o que fica sem uso | Tira o componente sem uso depois da 11 (`decisions.md` 2026-10-02, System: um componente sem uso sai do código) | A 11 tira o que ela mesma deixa órfão (§5.1) |

**A ordem de merge**: a 11 começa depois do merge das tasks 9 e 10 (`implementation.md:171`), que já aconteceu, e não corre em paralelo com nenhuma; a 12 começa depois dela.

**Como o primeiro step é feito.** Antes de qualquer código, o implementador confere as linhas citadas na §5, que são as de `c9ab0ea`, contra a `main` do momento e registra no tech spec só o que mudou, com a lista das chamadas de `run()` que ainda vão ao aviso e o destino de cada uma; depois, P27, P28, P29 e P30, só no Go e na fronteira: os campos novos do `ArchivedTask` (sem os textos do rascunho e dos relatórios, §4.4), o `Leftover` por parte, o `ahead`; os testes de tabela; o DTO, `task generate`, `lib/wails.ts` e o mock. Nada na tela muda: a interface de hoje ignora os campos novos, e o `LeftoversNotice` passa a ler o `Leftover` novo pelos mesmos três textos.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/overview.md` §O estado que o frontend vê | Os arquivados com o encerramento, a PR e a lista dos relatórios; o que ficou no disco por parte; os commits fora da base | 1 |
| `docs/architecture/overview.md` §Notificações e som; `features.md` §Depende de mim | Os textos por situação, a razão, o título do review, os lugares | 2 |
| `docs/architecture/overview.md` §O estado que o frontend vê, §Fronteira com o Go; `storage.md` §Banco (as consultas do History) | A janela de 90 dias, o resumo, `HistoryService` | 3 |
| `docs/architecture/design-system.md` §Componentes | A linha do History e o cabeçalho do dia, o resultado do encerramento, os fatos, a prévia de um apagamento, o detalhe do toast | 4 |
| `features.md` §Histórico (a task arquivada) | Os fatos, o encerramento, as abas, apagar uma task arquivada | 5 |
| `features.md` §Histórico de um review, §O review como item (apagar) | Cada passada; apagar um review arquivado; o **Delete review** que espera | 6a |
| `features.md` §Histórico de uma discussão | O que publicou primeiro; apagar uma discussão arquivada | 6b |
| `features.md` §Histórico, §Atalhos | A lista por dia, a barra, o chip, o teclado | 7 |
| `features.md` §Histórico; `docs/development/target-machine.md` | Os antigos, a linha recém-arquivada; a medida da lista | 8 |
| `features.md` §Apagar uma task | A prévia com as contagens, o diálogo que espera o fim | 9 |
| `features.md` §Voltar e descartar, §Descartar step | O que se perde com as contagens, os diálogos que esperam o fim | 10 |
| `features.md` §Encerramento e arquivamento, §A página do item que saiu | Os toasts dos três tipos, a página da task encerrada e da apagada, o que ficou no disco, **Open in History** | 11 |
| Conferência de `docs/` contra o que a task fez | — | 12b |

## 8. Plano de steps sugerido

Catorze steps (do 1 ao 11, com os arquivados do review e da discussão em 6a e 6b, e as cenas em 12a e 12b), dentro de G (10–14 steps, `implementation.md` §2), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. **O tamanho** (`implementation.md:7`): um step muda até umas 1,5 mil linhas, contadas pelo `git diff --shortstat` do commit, as inseridas mais as apagadas, os testes incluídos; não contam os arquivos gerados (`frontend/bindings/**`) nem as capturas. Um arquivo apagado conta inteiro, por isso cada step diz o que apaga, com as linhas de `c9ab0ea`; a estimativa do que entra é do material, e o step que a passar se divide em dois antes do commit, nunca depois. As peças do system vão num step só, sem nada na tela (o 4), o review e a discussão arquivados em dois (6a e 6b, que juntos passariam de 1,5 mil linhas) e as cenas pintadas em dois (12a e 12b). Nenhum step deixa uma forma nova que um step seguinte troque, e nenhum deixa um controle de hoje sem lugar; um componente que fica órfão num step sai no step dito, com o teste dele.

| # | Step | Apaga (linhas) | Entra (estimativa) |
|---|---|---|---|
| 1 | **A conferência e os dados do arquivado.** O inventário de `c9ab0ea` contra a `main` do momento (§6); P27, P28, P29 e P30 no Go e na fronteira, com os testes de tabela. Nada na tela | — | ~900 |
| 2 | **As notificações (P37).** Os 61 textos, as variantes e `reasonOf` em `text.go`; `text_test.go`; os testes das derivações; os lugares; o título do review. Só Go | — | ~800 |
| 3 | **O History por partes (P33).** A janela, o resumo, `HistoryService` com a página, a busca e o total, o cache do store, os leitores da §4.4 com a fonte nova (`placeIn` e o cache incluídos); a lista de hoje pede os antigos ao montar. Nada na tela muda | — | ~1.200 |
| 4 | **O system.** A variante History de `ListRow` e o cabeçalho do dia; `CloseResult` com `close-result.ts`; a grade dos fatos ao lado de `FACTS` (§4.3 #34); `DeletionPreview`; o `detail` do `Toast`; o cabeçalho de frase do `CopyBlock` (§4.3 #35); o ícone `branch`; testes de componente e pintados nos dois modos. Nada na tela | — | ~1.300 |
| 5 | **A task arquivada.** O cabeçalho do arquivado, os fatos com as datas, o resultado do encerramento, as abas (**Steps** com o marco do arquivo, **Pull request** lida sob demanda, `Implementation` da One-Shot), o marco pelo id; **Delete…** com o diálogo do arquivado e a volta ao History | `ArchivedTaskView` e o teste (473), `OneShotView` (99): 572 | ~850 |
| 6a | **O review arquivado.** Os fatos com as datas, as passadas; **Delete…** do arquivado com a variante do arquivado do `DeleteReviewDialog`, que passa a esperar o fim (também no review ativo) | `ArchivedReviewView` e o teste (287), `CardLink` e o teste (48), que fica sem leitor: 335 | ~400 |
| 6b | **A discussão arquivada.** Os fatos com as datas, What it published, Document and conversation; **Delete…** do arquivado com os textos da variante do arquivado de `DeleteDiscussionDialog` | `ArchivedDiscussionView` e o teste (401) | ~400 |
| 7 | **A lista do History.** `HistoryView` com a barra, o chip, a contagem, o `tree` com os dias e as linhas nas duas larguras, os vazios, o teclado; `history-rows.ts` | `HistoryPanel` e o teste (441), `history-format.ts` (18), `RepositoryFilter` e o teste (124): 583 | ~850 |
| 8 | **Os antigos e a linha recém-arquivada.** As linhas do pé, a busca dos antigos e a contagem que espera o Go, o lugar com `fresh`, **Open in History** à linha na página que saiu e no toast de hoje; a medida da lista com 400 linhas na máquina alvo. Saem também os órfãos do step 5 | `StepList` e o teste (574), `StatusDot` e o teste (64): 638 | ~750 |
| 9 | **Delete task.** A prévia com as contagens, a sessão interrompida, o diálogo que espera o fim, a falha no rodapé, o foco; `deletion.ts` | `DeleteTaskDialog` e o teste (281) | ~800 |
| 10 | **Discard step, Back to… e Discard and restart….** Os textos com a contagem, a lista do que se perde, a nota da PR, o que fica, os diálogos que esperam o fim; `stage-actions.ts` cresce | `DiscardStepDialog` e o teste (144), `StageActionDialog` (72), `OrphanPRs` e o teste (94): 310 | ~900 |
| 11 | **As páginas que saíram, os toasts e o aviso.** A task encerrada e a apagada, o que ficou no disco com o aviso e o `CopyBlock`, o do review apagado; os toasts dos três tipos com o detalhe (F20); o aviso só sem lugar próprio | `LeftoversNotice` e o teste (75), `Notice.tsx` e o teste (66; os leitores são todos desta task, §5.1), o `leftover` único do store: 141 | ~900 |
| 12a | **As cenas do History e dos arquivados.** `test/history-scenes.ts`, `HistoryView.scenes.painted.test.tsx` e `Archived.scenes.painted.test.tsx`, com as capturas e as cenas próprias do pronto 1 | — | ~1.200 |
| 12b | **As cenas da task e das páginas, e o fim.** `TaskDialogs.scenes.painted.test.tsx` e `GoneView.scenes.painted.test.tsx` com as capturas, os testes de teclado que faltarem, `where-actions-went.test.tsx`, a checklist da máquina alvo no corpo da pull request, a conferência de `docs/` | — | ~1.200 |

Depois do step 12b, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch, e a pull request só é dada como pronta com o CI verde e a checklist da máquina alvo no corpo.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md` X10–X16, X20 e S7, dentro do que o usuário aprovou ao aprovar a rodada `lab/14-screen-rest` (`decisions.md`, 2026-09-25) e o plano (`implementation.md` §4, X10 entre as de menor risco). O que o material decidiu na §4.3 fecha casos que `rest.md` deixava sem regra ou com duas, sem mudar um fluxo inteiro nem apagar dado: as que tocam comportamento, decididas pelo coordenador por delegação, são os diálogos destrutivos da task e o **Delete review** que ficam abertos até o fim com a falha neles (#12, o que a task 10 já fez com os de Settings), a busca do History que casa com o número da PR e do card de uma task (#3), a linha recém-arquivada mostrada fora do filtro da lateral (#4), o fim do `Ctrl+Enter` nos diálogos destrutivos (#10) e o que ficou no disco de um review apagado na página dele (#14). As cinco estão registradas em `decisions.md` (2026-10-02). As #33 a #35 são do system e do teclado e não mudam fluxo: o foco entregue ao diálogo aberto pelo `⋯`, os fatos com o `Fact` que já existe e o cabeçalho de frase do `CopyBlock`. A maior é técnica (P33, o History por partes, num step próprio sem mudança visível), e o custo dela está em `backend.md`. O PRD não pergunta nada ao usuário.
