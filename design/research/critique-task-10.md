# Crítica da task 10 · Settings, boas-vindas, início e migração (PR #88)

Leitura da branch `57-redesign-10-settings-welcome-startup-and-migration` em `fc83b01` (15 commits, 246 arquivos, CI verde), na worktree de revisão. A régua, nesta ordem:

- `design/tasks/10-settings.md` (o material; `10:N` é a linha N dele);
- `screens/rest.md` §2, §5–§7;
- `structure.md`, `principles.md`, `system/components.md` e `system/tokens.css`;
- `changes.md` (X1–X9, X17–X19), `backend.md` (P31, P32, P34, P34b, P35, P36) e `decisions.md`;
- o mock `lab/14-screen-rest/index.html` e as fontes que o material aponta.

Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa. A PR muda duas linhas em `design/`: o token `--col-placeholders` em `system/tokens.css:112` e o valor dele em `system/components.md:916` (bloqueio 6).

## Veredito

**Corrigir antes do merge.**

- **Comportamento:** o lugar, as quatro páginas, os diálogos, o início, as boas-vindas e a migração estão lá, e quase tudo segue o material ao pé da letra.
  - Das cerca de 230 strings entre crases das §4.2, todas existem no código ou são o modelo que ele monta.
  - O início abre a janela antes do banco, mostra os passos e o lento com a razão, e a falha de permissão com **Try again** volta ao app no mesmo processo. Isso foi visto no app real e num teste descartável sobre a tentativa de verdade ("No app real", "Mutações").
  - O modo de boas-vindas guarda Settings e History ao alcance, e o primeiro cadastro leva ao título da Home.
  - Nada do que saiu deixou referência.
- **Mutações:** rodei 388: 133 no Go e 255 no frontend (jsdom e pintado).
  - No Go, morrem 92. Das 41 que sobrevivem, sete são equivalentes. O buraco maior é `internal/app/attempt.go`, a tentativa real do início, que não tem teste nenhum (bloqueio 3).
  - No frontend, morrem 230 de 255. Das 25 que sobrevivem, nove são equivalentes.
- **O que falta fazer:** são seis bloqueios.
  - Faltam as capturas do pronto 1, e as fixtures mostram textos que o produto não diz.
  - A tabela de status está quebrada: no desenho, no teclado (↓ numa caixa troca o status de cards novos) e na semântica.
  - A tentativa real do início não tem prova, e o material a pede (prontos 3 e 4).
  - **Remove repository** abre com o foco atrás do diálogo.
  - `displayPaths` troca por `~` um `/home/x` no meio de qualquer caminho.
  - O system mudou sem decisão: `--col-placeholders` foi de 224 para 288 px.

O bloqueio 6 pede decisão do coordenador. Os outros não pedem decisão.

**Sobre as capturas.** Não existe `captures/57-…` no `origin` (há as das tasks 3 a 7 e 9). O corpo da PR não tem tabela de capturas. Trato isso como nas tasks anteriores: é um bloqueio, porque `10:19` pede as capturas anexadas à PR, lado a lado com o mock. Para olhar, gerei as 256 numa cópia e fotografei o mock (veja "Capturas").

**Sobre a máquina alvo.** Nenhum pronto desta task é do usuário: o 4 pede a prova na máquina alvo "pelo implementador" (`10:22`). Por isso o corpo não precisa da checklist `## Verification on the target machine`. O que falta dessa prova está no bloqueio 3.

## Como foi conferido

### Suítes

Pelos comandos do `Taskfile.yml`. `task check` rodou na worktree de revisão; as outras, em cópias no scratchpad. Todas verdes:

| Suíte | Resultado |
|---|---|
| `task check` (tidy, lint, typecheck, `test`, vuln, bindings) | verde em 132 s; `git status` limpo depois |
| `task test:go` (dentro do check) | 3.256 testes, 1 pulado (`dnd`, dependente da máquina) |
| `task test:web` (`--changed`, dentro do check) | 8.417 testes em 396 arquivos |
| `vitest --project unit`, inteiro, numa cópia | 6.700 testes em 338 arquivos, 69 s |
| `vitest --project painted`, inteiro, numa cópia | 1.977 testes em 87 arquivos, 114 s |
| `go test -race -count=5` em `internal/app`, `store`, `bindings`, `board`, `repository`, `prompts`, `models` e `gh`, numa cópia | 2.450 execuções de topo, nenhuma corrida. `internal/app` também com `-count=20`: verde. Não há teste instável |
| `task bindings:check` | sem diff |

- **A falha da race em `bindings`.** `TestRegisterEventsRegistersEveryEvent` (`internal/bindings/events_test.go:14`) entra em pânico na segunda repetição (`event 'state:changed' is already registered`), porque o registro de eventos do Wails é global. Na `main` (`64fd387`), `-count=2` falha do mesmo jeito. Não é desta PR, que só acrescentou `startup:changed` ao teste. Pulado esse teste, `bindings` deu 1.160 execuções sem falha.
- **O CI e a PR.** **Changes**, **Go** e **Frontend** estão verdes, e **Build** foi pulado. A PR está `MERGEABLE` e `CLEAN`, com a cabeça em `fc83b01`.
- **O pronto 8, commit a commit.** Os 15 commits foram extraídos com `git archive`.
  - `go build`, `go vet`, `go test ./internal/...`, `pnpm typecheck` e `biome check` passam em todos.
  - `vitest --project unit` passa inteiro em oito. Nos outros sete houve de 1 a 8 falhas, todas por `Test timed out`, com a máquina em carga 35 em 16 núcleos. Os testes que estouraram são de outras tasks, e a PR não os toca: `NewDiscussionDialog.test.tsx`, `TaskView.findings.keys.test.tsx`, `board/where-actions-went.test.tsx` e `DiscussionView.keys.test.tsx`. Com `--maxWorkers=1` ou menos carga, os mesmos arquivos passam nesses commits. Não é regressão (item 14 de "Podem esperar").
  - Todo teste apagado teve substituto no mesmo commit (`CloneFolderSection`, `PromptPage`/`PromptEditor`/`ResetPromptDialog`/`DiscardChangesDialog`, `Welcome`/`machine`/`lib/welcome`). `refused.go` saiu com `startup_test.go` no mesmo commit, e `RepositoryLinkRow.tsx` com `BoardRepositoryRow`.

### Mutações

Cada mutação rodou numa cópia desligada do git, só com os testes que ela alcança. O Go rodou com `-count=1`. O pintado precisou de `api: { port, strictPort: true }` no projeto `painted` da cópia, porque a flag de linha de comando não mudou a porta em todas as execuções. "Falha (n)" é o número de testes que falharam. A tabela traz as que importam; as outras morrem.

| Pronto | Mutação | Onde | Resultado |
|---|---|---|---|
| 3 P31 | `releaseOf` ignora o clone, as tasks e reviews, os ativos | `internal/board/service.go:943` | falha (2 a 6) cada |
| 3 P31 | `releaseOf` ignora os arquivados | `service.go:943` | **sobrevive** |
| 3 P31 | `PreviewEdit` sem `Release`; os destinos trocados; os nomes sem ordenar | `service.go:610`, `:755`, `:762`, `:763` | falha (1 a 2) cada |
| 3 P31 | A ordem sensível a maiúsculas | `service.go:761` | **sobrevive** |
| 3 P31/P32 | O DTO sem `release`, sem `goneStatuses`, sem `newStatusIds`, sem `newCardStatusGone` | `internal/bindings/convert.go:1324`, `:1291`, `:1292`, `:1293` | **sobrevivem** (4) |
| 3 P32 | `NewCardStatusGone` sem exigir o status; o retrato invertido; Gone pelo id; New pelo nome | `service.go:588`, `:589`, `:592`, `:597` | falha (3 a 8) cada |
| 3 P32 | Gone comparando pelo nome, não pelo id | `service.go:591` | **sobrevive** |
| 3 P32 | `Add` e `Update` sem gravar o retrato; `scanBoard` sem lê-lo | `service.go:669`, `:716`, `internal/store/boards.go:66`, `:102`, `:277` | falha (1 a 3) cada |
| 3 P32 | A 0025 sem `json_valid`, sem o `coalesce` externo, com `$.status`, com a leitura de outro board | `internal/store/migrations/0025_board_saved_statuses.sql:11`, `:12` | falha (1 a 140) cada |
| 3 | A frase do board inexistente sem `Check the number…` | `internal/board/failure.go:42` | falha (3) |
| 3 P34 | `lineCount` com a quebra final; `EditedAt` fora do mtime; `Lines` e `DefaultLines` trocados; `List` fora da ordem | `internal/prompts/prompts.go:124–481` | falha (1 a 9) cada |
| 3 P34 | `List` engole o erro do `stat` | `prompts.go:478` | **sobrevive** |
| 3 P34b | `State.modelFactory` igual aos padrões, não à fábrica | `internal/app/state.go:55` | **sobrevive** |
| 3 P36 | As cinco regras do `claude` e as três do `gh`; `gh auth status` no lugar de `token` | `settings_service.go:145–168`, `internal/gh/commands.go:64`, `:67` | falha (1 a 4) cada |
| 3 P36 | Um `gh` morto ou no prazo (`ExitCode -1`) dá sem login | `commands.go:66` | **sobrevive** |
| 3 | A frase do disco cheio sem o `~`; `SetReviewModeDefault` sem a frase | `settings_service.go:237`, `:119` | **sobrevivem** |
| 3/4 | `DiskFull` sem `SQLITE_FULL`, sem `ENOSPC`; `EPERM`/`EACCES` fora de permissão | `internal/store/errors.go:14–25` | falha (2 a 6) cada |
| 3 P35 | O executor: o primeiro passo, o fechamento, o `ready`, **Try again** fora da falha, a falha por tipo, `startedAt`, `DataDir`, `systemDark` | `internal/app/startup.go:117–264` | falha (1 a 8) cada |
| 3 P35 | O lento nomeia o último caminho; nomeia com o passo feito; o fim do teste não para o relógio; o lento a 30 s; publica depois de fechar | `startup.go:284`, `:289`, `:47`, `:161` | **sobrevivem** (5) |
| 3 P35 | **A tentativa real:** sem a sonda; a sonda com `%v`; a recusa não termina o passo; a recusa vira falha; a migração sem `systemDark`; o passo dos clones sem caminho; o primeiro passo nunca termina; a falha não fecha o que abriu; sem `resume`; sem `markReady` | `internal/app/attempt.go:56–300` | **sobrevivem** (11) |
| 3 P35 | O `shutdown` não para o início; o início antes da janela; o `shutdown` sem `ready`; a janela sempre clara; a publicação antes do `ready` | `internal/app/app.go:138`, `:255`, `:259`, `internal/app/theme.go:47`, `state.go:200` | **sobrevivem** (5) |
| 3 P35 | O placeholder responde nil; outra frase; `Bind` esquece Settings | `internal/bindings/late.go:10`, `:24`, `services.go:59` | falha (1 a 7) cada |
| 3 P35 | `Bind` esquece Attention | `services.go:74` | **sobrevive** |
| 3 P35 | `Sync` separado do teste dos clones: as sete regras | `internal/repository/service.go:144–216` | falha (1 a 3) cada |
| 4 | A sonda: a escrita negada, o arquivo que fica, o diretório vazio, o errno | `internal/store/probe.go:15–30` | falha (1 a 2) cada |
| 4 | A escrita da sonda que falha por `ENOSPC` passa | `probe.go:32` | **sobrevive** |
| 1 | Linha 2 do board, ligação do repositório, razão do rodapé, descrição do prompt sem tooltip | `features/boards/BoardRow.tsx:77`, `BoardRepositoryRow.tsx:57`, `components/system/Dialog.tsx:215`, `features/settings/PromptsPage.tsx:90` | falha (2 a 12) cada |
| 1 | O caminho de um repositório cortado sem tooltip | `features/repositories/RepositoryRow.tsx:80` | **sobrevive** (nenhum caminho longo nas cenas) |
| 1 | Altura fracionária na linha de Settings, no item da navegação, na linha de prompt, na linha do diálogo, no passo, no item de `This machine`, no bloco da migração | `SettingsList.tsx:63`, `SettingsNav.tsx:94`, `PromptsPage.tsx:83`, `BoardRepositoryRow.tsx:43`, `components/system/StartSteps.tsx:26`, `MachineChecks.tsx:22`, `features/migration/MigrationRefused.tsx:53` | falha (4 a 78) cada |
| 1 | A linha da tabela de status com 40,5 px | `features/boards/StatusTable.tsx:58` | **sobrevive** (`parts()` não mede `tr` nem a tabela no diálogo) |
| 1 | A página a 978 com 675 px; a grade em coluna a 978; lado a lado a 812; a coluna do início 1 px fora | `styles/globals.css:345–380` | falha (10 a 36) cada |
| 1 | A navegação em coluna a 812 | `SettingsNav.tsx:70` | **sobrevive** (o teste não prova que é uma linha) |
| 1 | **Add board**, **Back**, **Copy the list** primárias; **Try again** secundária | `BoardsPage.tsx:18`, `BoardDialog.tsx:430`, `components/system/CopyButton.tsx:48`, `features/startup/StartScreen.tsx:87` | falha (4 a 60) cada |
| 2 | As setas da navegação, `Ctrl+,`, `Esc`, os atalhos inertes nas boas-vindas, os focos de fechar e do primeiro cadastro | `SettingsNav.tsx:42–56`, `app/useGlobalShortcuts.ts:19–135`, `store/app-store.ts:917–1260` | falha (1 a 5) cada |
| 2 | `Enter` na URL e no `owner/name`, `Ctrl+Enter`, **Back**, a URL que não relê, os focos do diálogo de board e de Add repository | `BoardDialog.tsx:163–321`, `AddRepositoryDialog.tsx:91`, `:183` | falha (1 a 9) cada |
| 2 | `Esc` nas instruções; `Ctrl+S`; o foco da edição; `Enter` no início que falhou; os focos das boas-vindas, de remover e dos destrutivos | `ReviewInstructionsBlock.tsx:50`, `PromptEditor.tsx:80`, `:108`, `StartScreen.tsx:40`, `:47`, `Welcome.tsx:70`, `:76`, `BoardsPage.tsx:37`, `RepositoriesPage.tsx:65`, `Dialog.tsx:72` | falha (1 a 10) cada |
| 2 | A edição com o cursor no fim (sem `setSelectionRange(0, 0)`) | `PromptEditor.tsx:80` | **sobrevive** |
| 5 | As funções puras: `settings-nav`, `defaults`, `boards-page`, `board-dialog`, `repositories-page`, `add-repository`, `settings/prompts`, `machine`, `lib/welcome`, `lib/models`, `start`, `migration-text`, `lib/paths`, `ReadingAge` | 133 mutações | 121 morrem; das 12 que sobram, seis são equivalentes |
| 5 | A ordem Implementation/Step review trocada | `features/settings/defaults.ts:37` | **sobrevive** |
| 5 | `MAIN_DELAY_MS = 0` | `features/startup/start.ts:13` | **sobrevive** (o teste prova "visível em 400 ms", não "invisível antes") |
| 5 | O detalhe da migração sem `displayPaths` | `features/migration/migration-text.ts:68` | **sobrevive** |
| 5 | O `◇` da idade que falhou; o tooltip `Last read …` | `components/system/ReadingAge.tsx:39`, `:54` | **sobrevivem** |
| 6 | Renomear **Close**, **Add board**, **Edit…**, **Remove…**, **Add**, **Clone**, **Review instructions…**, **Remove…** do `⋯`, **Choose…**, **Browse…**, **Reset to default…**, **Edit**, **Add board** das boas-vindas; **Add repository** e **Back** primárias | vários | falha (1 a 14) cada |
| 6 | **Change path…** do `⋯` renomeado | `features/repositories/RepositoryMenu.tsx:55` | **sobrevive** em `where-actions-went` (acha o da linha de bloqueio); morre em `RepositoryMenu.test` |
| 6 | **Save** sem `Ctrl S`; **Save** da edição não primária; **Save** das instruções primária | `PromptEditor.tsx:160`, `:162`, `ReviewInstructionsBlock.tsx:90` | **sobrevivem** em toda a feature, jsdom e pintado |
| 7 | `--col-placeholders` a 280; apagado | `design/system/tokens.css:112` | falha (1) cada |
| 7 | 288 px solto no lugar do token | `PromptEditor.tsx:125` | **sobrevive** |
| — | `useApplyTheme` pinta antes do estado; não guarda a preferência; o modo de boas-vindas na lateral, nas pilhas e em `welcomeMode` | `features/theme/useApplyTheme.ts:22`, `:26`, `SidebarFooter.tsx:149`, `SidebarTop.tsx:25`, `app-store.ts:890–900`, `lib/welcome.ts` | falha (1 a 7) cada |
| — | O menu do chip, as formas, o pé e a marca `factory` | `features/models/ModelChip.tsx:87–189` | falha (2 a 5) cada |
| — | O menu do chip abre lendo o catálogo | `ModelChip.tsx:120` | **sobrevive** (§4.3 #6 sem prova) |
| — | O `×` de Remove repository habilitado durante a remoção | `RemoveRepositoryDialog.tsx:63` | **sobrevive** |

**Os equivalentes:**
- No Go, sete:
  - `nil` dá `"null"`, que o Go relê como `nil`;
  - os dois `coalesce` da 0025, um coberto pelo outro;
  - a coluna anulável, que o Go nunca grava NULL;
  - `Removal` com nil, porque `FromRemoval` aloca;
  - a ordem de `Wails()`;
  - a leitura negada da sonda, que `os.Open` já recusa;
  - duas tentativas ao mesmo tempo, porque `tryAgain` exige `failed`.
- No frontend, nove: três do `round` e do `max(0, …)` de `globals.css` nas larguras pares; três de `board-dialog.ts` (`:122`, `:128`, `:213`), que nenhum caminho alcança; `settings-nav.ts:68`; `boards-page.ts:39`; e o lookahead de `lib/paths.ts:10`.

As que importam estão no bloqueio 3 e no item 9 de "Podem esperar". A mais visível, se regredir: o DTO sem os quatro campos de P31 e P32. A fixture de `board_service_test.go:181` não preenche nenhum deles, e o Edit perderia a consequência e a nota do board que mudou sem nenhum teste falhar.

### Uma prova a mais, da tabela de status

Escrevi uma sonda numa cópia, no jsdom e no Chromium. Ela monta `StatusTable` com `Todo`, `QA` e `Done` e o status de cards novos em `Todo`, põe o foco na caixa `Todo ends the work` e aperta `↓`.
- O foco vai ao rádio `New cards start in QA`, e `onNewCard("qa")` é chamado.
- `→` na mesma caixa leva a `New cards start in Done` e chama `onNewCard("done")`.

É o bloqueio 2.

### A 0025 sobre dados anteriores

- **O teste** em `internal/store/migrate_test.go` prova a leitura válida, a vazia e a inválida. As mutações da `0025` morrem, menos as equivalentes.
- **Uma cópia de banco**, além do teste:
  - um banco aberto pelo `store.Open` de uma cópia sem a 0025, em `user_version` 24;
  - seis boards gravados com `sqlite3`: leitura válida com três status, finais, `new_card_status`, `failure` e `failed_at`; `reading=''`; `reading='{'`; leitura válida sem `statuses`; `statuses: []`; e um sem linha em `board_readings`;
  - reaberto pelo `store.Open` da branch: chegou a 25.
- **O resultado:**
  - `saved_statuses` é `TEXT NOT NULL DEFAULT ''`;
  - o primeiro recebe o JSON dos três status, com `Won''t do` intacto; o vazio, o inválido, o sem `statuses` e o sem leitura recebem `''`; o de `[]` recebe `'[]'`;
  - as nove colunas anteriores de `boards` e todas as outras tabelas estão idênticas, byte a byte, ao dump de antes;
  - `integrity_check` ok e `foreign_key_check` vazio;
  - `ListBoards` decodifica o primeiro com as opções, os finais e `new_card_status` intactos.

### Capturas

- **No `origin` e na PR:** não existe `captures/57-…`, e o corpo não tem tabela de capturas (bloqueio 1).
- **Numa cópia:** `MYSPEC_CAPTURES=1` nos quatro testes de cenas gravou 256 capturas: 128 claras e 128 escuras; 90 a 2180, 90 a 978 e 72 a 812.
  - Settings: 36 cenas × 3 larguras × 2 temas, só a área principal.
  - Início (`—`, `slow`, `failed`, `disk-full`) e boas-vindas (`—`, `no-login`, `no-gh`, `no-claude`, `history`), com a janela inteira e a lateral.
  - A migração com o nome da janela (`migration-1250-*`, `migration-2560-*`), não o da área: 1250 dá 950 de área, e as outras cenas de "978" usam janela de 1280.
- **O mock:** servi o lab de uma cópia na porta 8141, encerrada pelo PID, e fotografei `?scene=…&v=…&theme=…&clean` em janelas de 2560, 1280 e 1100. São 212 imagens, montadas lado a lado com as capturas (o mock à esquerda), fora do repositório.
- **O que as cenas cobrem:** todas as cenas e todos os `?v=` de `10:19` existem, inclusive as oito decididas só no material. O relógio e os textos batem: `Read 1d ago`, `◇ Read failed 18m ago`, `Read 2m ago`, `6 of 9 changed`, os 12 repositórios nos grupos, Haiku 4.5 sem esforço, `Edited Sep 20` e `92 lines … 87`. A página tem 800, 674 e 764 px, a navegação fica à esquerda a 978 e em linha a 812, e nenhuma cena tem primária a mais.
- **A prova do corte quase nunca morde.** Só 14 dos 256 casos têm texto cortado: a linha 2 do board a 978, `Clone found · 2 clones:` em `add-3` e a soma do rodapé em `edit-2`. Em Defaults, Repositories, Prompts, no início, nas boas-vindas e na migração, nada corta.
- **O que diverge do mock**, fora o que `10:418` já aceita:
  - **A tabela de status está desmontada** em `settings-boards add-2` e `edit-1`, nas três larguras e nos dois temas (bloqueio 2).
  - **Um tooltip aberto por acidente** em `settings-defaults saving`, nas três larguras e nos dois temas: `Factory default: Fable 5.1 · high` do chip que guarda o foco cobre o fim da falha e, a 2180, o **Try again** (bloqueio 1).
  - **As fixtures dizem o que o produto não diz** (bloqueio 1).
  - **Os títulos do Markdown do prompt** (`# PRD of`, `##`) saem maiores que o título `PRD` da página, em `settings-prompts view` (item 3 de "Podem esperar").
  - **A área das instruções** tem cerca de duas linhas em `settings-repos instructions` (item 4).
  - **O diálogo de board corta** `Clone found · 2 cl…` em `add-3` e a soma `acme/docs moves to No board, and acm…` em `edit-2` (item 5).
  - **A linha de modelo:** **Try again** como link azul, ` · unavailable` no peso e na tinta do chip, e a falha do catálogo no menu em vermelho (item 8).
  - **Miúdos:** a nota `The board changed since it was saved.` sem o 500 do mock (`edit-1`); o caminho recusado em `change-path` sem mono; o rótulo do `CopyBlock` em caixa alta `ERROR`, sem o ícone `<>` do mock; as linhas de **Start** das boas-vindas numa linha, sem chevron (a linha de início da task 5; o mock tem duas linhas).
  - **Sem cena:** a prévia de Remove board que falha (`10:220`), a varredura que falha (`10:267`), o clonando, a falha do clone e a pasta escolhida. **Copy the list** fica abaixo dos 800 px da captura da migração e não aparece em nenhuma.

## Bloqueiam o merge

1. **As capturas não estão na PR, e as cenas mostram o que o produto não mostra** (pronto 1).
   - **O que falta.** `10:19` pede as capturas gravadas e anexadas à pull request, lado a lado com o mock. Não há `captures/57-…`, e o corpo não tem as tabelas.
   - **O tooltip aberto.** Em `settings-defaults saving`, a captura (`features/settings/SettingsView.scenes.painted.test.tsx:158`) vem com o foco ainda no chip, e o tooltip cobre a falha e o **Try again**. É a cena que mostra a falha ao salvar.
   - **As fixtures** (`test/settings-scenes.ts`):
     - `:660`: a cena `add-1-error` diz a frase velha `…Check the number, or run gh auth refresh -s read:project.` O Go (`internal/board/failure.go:42`) e `10:189`, `:430` dizem `…Check the number and that this account can see the project.` A captura mostraria ao usuário a frase que a task tirou.
     - `:499`: `acme/billing` vem com `link: "uncloned"`, mas está registrado (`:231`), e o Go daria `LinkRegistered` com o caminho vazio (`internal/board/service.go:865`). Por isso `edit-2` mostra `Registered without a clone`, onde `10:200` e o mock dizem `Registered · Not cloned`.
     - `:435–470`: `newBoard` não traz `newCardStatus: "to-do"`, que a pré-marcação daria (`features.md` §Cadastrar um board). Por isso `add-2` mostra `No status` escolhido e `Done is marked for you, from its name.`, contra `Done and To do are marked for you, from their names.` de `10:191` e do mock.
     - A cena `instructions` abre o bloco vazio, sem `· Review instructions set`. O mock (`settings.js:147`, `:153`) traz o texto salvo.
   - **Mudar:**
     - capturar antes de `withoutTooltip`, com o foco fora do chip, ou tirar o foco antes da captura;
     - corrigir as quatro fixtures;
     - rodar `task captures` e `task captures:push`, e pôr no corpo as tabelas a 2180, 978 e 812 (Settings), nos dois temas, com a coluna do mock; a migração com o nome da área, não o da janela.
   - Não pede decisão.

2. **A tabela de status está quebrada no desenho, no teclado e na semântica.**
   - **Onde:** `StatusTable.tsx:51–55` passa `render={<tbody />}` ao `RadioGroup` do system. O grupo dá ao elemento `flex flex-col gap-1` (`components/system/Radio.tsx:55–56`) e o papel `radiogroup`, e envolve também as caixas de seleção.
   - **O desenho.** O `tbody` vira flex, e cada `tr` vira uma tabela anônima. Os cabeçalhos `ENDS THE WORK` e `NEW CARDS` ficam sobre colunas vazias; a caixa e o rádio ficam colados ao nome, numa posição que varia com o tamanho dele; os fios param na primeira coluna. Aparece nas capturas `add-2` e `edit-1` e no app real (`72`, `c74`, `c8283`, com o projeto `Pessoal`).
   - **O teclado.** O composite do grupo trata as caixas como itens dele (a PR teve de forçar `tabIndex={0}` no `Checkbox`, `components/system/Checkbox.tsx:69–71`). `↓` numa caixa leva o foco ao rádio da linha seguinte **e troca o status de cards novos**, e `→` faz o mesmo (veja "Uma prova a mais"). Quem anda pelas caixas com as setas muda, sem ver, onde os cards de uma discussão nascem.
   - **A semântica.** `10:383` pede "uma `table` com o cabeçalho de colunas". Um `tbody` com papel `radiogroup` tira as linhas do grupo de linhas da tabela, e o leitor de tela perde a navegação por célula.
   - **A prova não pega nada disso.** `StatusTable.painted.test.tsx` só mede cores, e as cenas não medem `tr` (a mutação da altura sobrevive).
   - **Mudar:**
     - o `tbody` fica `tbody`, e o grupo de rádios não envolve as caixas: os rádios podem ser um grupo pelo `name`, com o rótulo do grupo na coluna (`aria-labelledby` do cabeçalho `New cards`), ou um `RadioGroup` sem o `className` de layout e sem as caixas dentro;
     - um teste de teclado: `↓` numa caixa não troca o status de cards novos;
     - a prova pintada: as caixas e os rádios alinhados às colunas dos cabeçalhos, e cada `tr` em pixel inteiro.
   - Não pede decisão.

3. **A tentativa real do início não tem prova** (prontos 3 e 4).
   - **O que o material pede.** `10:21` pede no Go "os passos, o passo lento com o caminho, a sonda do diretório de dados e a falha por tipo, **Try again** que recomeça sem processo novo, a migração recusada como fim do primeiro passo, o fechamento da janela durante o início". `10:519` pede para isso "um executor de início testável com abridores falsos".
   - **O que há.** `internal/app/startup_test.go` só exercita o executor com uma tentativa falsa (`NewStartupForTest`). `internal/app/attempt.go` não tem nenhum teste: as onze mutações dele sobrevivem, entre elas a sonda que perde o errno, a recusa da migração que vira falha, o primeiro passo que nunca termina e a falha que não fecha o banco. Sobrevivem também as cinco de `app.go`, `theme.go` e `state.go`: o fechamento da janela durante o início, a janela antes do início, a janela sempre clara e a publicação antes do `ready`.
   - **O que funciona.** Num teste descartável no pacote `app`, com um `App` de verdade e `chmod 000` em `<XDG_DATA_HOME>/myspec`, `start()` chega a `failed` com `case=permission` e o diretório resolvido. Com `chmod 700` e `tryAgain()`, chega a `ready` no mesmo processo. No app real, o mesmo, com o mesmo PID ("No app real").
   - **A máquina alvo.** `docs/development/target-machine.md` (§Início) registra a janela antes do banco, a segunda instância, o `chmod 000` e o `tmpfs`. Mas diz que "o clique na janela real com a permissão devolvida não foi exercitado", e `10:22` pede essa prova uma vez.
   - **Uma ambiguidade da régua.** `10:22` diz "um `chmod 000` num `XDG_DATA_HOME` de teste". Com `chmod 000` no próprio `XDG_DATA_HOME`, e não em `myspec/` dentro dele, `dirs.Ensure()` falha e `Run` sai pelo terminal, sem janela (`app.go:103–105`), o que `10:315` aceita.
   - **Mudar:**
     - testes de `attempt.go` com abridores falsos: a sonda com `EACCES`, `EPERM` e `ENOSPC`; o `SQLITE_FULL` do banco; a recusa da migração terminando o primeiro passo com o `RefusedState` e o `systemDark`; o passo dos clones só com algum caminho; a falha que fecha o banco e os watchers; o contexto cancelado no meio;
     - um teste do `shutdown` durante o início;
     - os casos do executor: dois caminhos lentos (vale o primeiro), um rápido seguido de um lento, nada publicado depois de fechar;
     - **Try again** na janela real com a permissão devolvida, registrado em `target-machine.md`;
     - `target-machine.md` e `10:22` dizendo que o `chmod` vai em `<XDG_DATA_HOME>/myspec`.
   - Não pede decisão.

4. **Remove repository abre com o foco atrás do diálogo.**
   - **Onde:** aberto pelo `⋯`, o diálogo põe o foco em **Cancel**, e o menu, ao fechar, o devolve ao gatilho (`features/repositories/RepositoryMenu.tsx:46–52`). O `finalFocus` só abre mão do foco para **Review instructions…**.
   - **O efeito.** No app real (`c48ab`, `c48cd`, `c46ab`), o foco fica no `⋯`, atrás do modal. Tab passa pelo `⋯` da linha seguinte e por **Choose…** antes de chegar ao diálogo, e um `Enter` reabre o menu de trás.
   - **Contra a régua:** `10:367` (Remove repository começa em **Cancel**) e `components.md` Diálogo (o foco preso no diálogo).
   - **Os testes não pegam:** os de `RemoveRepositoryDialog` abrem o diálogo direto, sem o menu. Remove board, aberto por botão, está certo.
   - **Mudar:** o `finalFocus` também não devolve o foco quando o item abre um diálogo (**Remove…**); um teste que abre pelo `⋯` e confere o foco em **Cancel** e o Tab preso.
   - Não pede decisão.

5. **`displayPaths` troca por `~` um `/home/x` no meio de qualquer caminho.**
   - **Onde:** `lib/paths.ts:10`. `HOME_IN_TEXT` não tem âncora à esquerda e casa `/home/<x>` dentro de qualquer caminho.
   - **O efeito.** No app real, com o `HOME` de teste no scratchpad, a recusa de **Change path** saiu `…/scratchpad/app~/web is a clone of acme/web…` (`40`). Na máquina do usuário, `/mnt/backup/home/guilherme/x` viraria `/mnt/backup~/x`, e `/srv/home/code/api` viraria `/srv~/api`. A mensagem aponta para uma pasta que não existe.
   - **O alcance:** é a função de `10:431`, usada nas recusas e nos erros de Settings, do início, das boas-vindas e no detalhe da migração.
   - **Mudar:** casar o `/home/<usuário>` só no começo de um caminho (depois do começo do texto, de um espaço, de aspas ou de `(`), com casos em `lib/paths.test.ts` para o meio de um caminho.
   - Não pede decisão.

6. **O system mudou sem decisão: `--col-placeholders` de 224 para 288 px.**
   - **Onde:** `design/system/tokens.css:112` e `design/system/components.md:916`, além de `styles/globals.test.tsx:142`, `PromptEditor.painted.test.tsx:27–31` e `docs/product/features.md:938`.
   - **A régua.** `components.md` decidia 224 px (`calc(var(--space-16) * 3.5)`), e o mock pinta 224 (`lab/14-screen-rest/src/rest.css:136`). `decisions.md` não tem nada sobre a troca, e o commit `72b919c` não diz o porquê.
   - **O que não caberia em 224:** nada que se veja. O placeholder mais longo, `{{initial_context}}`, ocupa cerca de 137 px com o padding, e os textos quebram linha em qualquer largura.
   - **O custo.** A área de texto em mono perde 64 px, cerca de nove caracteres por linha: 496 px em vez de 560 a 2180, e 370 em vez de 434 a 978.
   - **Pede decisão do coordenador.** **Opinião:** volta a 224, com o teste de forma e `features.md` acompanhando. Se ficar 288, a decisão entra em `decisions.md`.

## Podem esperar

Em ordem de gravidade.

1. **Cancel muda de lugar enquanto se digita.**
   - **Onde:** na barra da edição de prompt (`PromptEditor.tsx:155–168`; no app, `18` contra `c19`, de x 1375 a 1508) e no bloco das instruções (`c42`).
   - **A causa:** a razão `Nothing changed yet.` do `Button` tracejado (`components/system/Button.tsx:144–152`) entra entre **Cancel** e **Save** e some na primeira tecla.
   - A primária não vai ao lugar de **Cancel**, como no bloqueio 5 da task 9, mas o controle anda sob o ponteiro.
   - **Mudar:** a razão vai à esquerda da barra, no lugar de `Unsaved changes`, como o `DialogFooter` faz desde a task 9; uma prova pintada da posição de **Cancel** com e sem a razão.

2. **A consequência de um repositório desmarcado junta todos os fechos.**
   - **O código:** `features/boards/board-dialog.ts:199–204` dá `Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working. Nothing on disk changes.`, e, com tasks e reviews, as duas frases.
   - **A régua dá um fecho só:** `10:211` ("`. Its tasks keep working.` com tasks, `. Its reviews keep working.` só com reviews, `. Nothing on disk changes.` só com o clone"), com o exemplo `… and 3 archived tasks. Its tasks keep working.`. `rest.md:161`, `components.md:850` e o mock (`comps.js:54`) dizem o mesmo.
   - Os testes (`board-dialog.test.ts:227`, `BoardDialog.test.tsx:431`) e `features.md:58` fixam o código, não a régua.
   - **Mudar:** a fórmula de `10:211`, com os testes e `features.md`.

3. **Os títulos do Markdown do prompt pesam mais que o título da página.**
   - Em `PromptPage.tsx`, o `Markdown` desenha `# PRD of` perto do tamanho display e `##` em cerca de 24 px, contra o `h2` `PRD` em `--text-title`. O mock usa `--text-ui` em negrito.
   - É o item 3 da task 9 de novo. A classe que a task 9 criou para o corpo dos rascunhos (`globals.css`) não chega ao prompt.
   - **Opinião:** os títulos dentro do bloco do prompt em `--text-ui` 600.

4. **A área das instruções de review tem duas linhas.**
   - `ReviewInstructionsBlock.tsx:70` passa `rows={5}`, e o `Textarea` do system o ignora (`min-h-(--size-composer-min)` e `field-sizing`, `components/system/Textarea.tsx:31`). `10:254` pede cinco linhas.
   - É o item 7 da task 9, consertado lá só nos campos dela.
   - **Mudar:** `min-h` em linhas de `--leading-code` no bloco; melhor, no `Textarea`, respeitando `rows`.

5. **O diálogo de board corta o que o material quer à vista.**
   - `Clone found · 2 cl…`: o texto divide a linha com um `Select` de `w-1/3 shrink-0` (`BoardRepositoryRow.tsx:57`, `:68`). `10:203` e §4.3 #16 pedem o texto e o seletor legíveis na mesma linha. O `Select` também é `sm`, e `10:203` pede `xs`.
   - A soma do rodapé (`acme/docs moves to No board, and acm…`): quem sai do MySpec, a consequência mais grave de `10:214`, só se lê pelo tooltip.
   - **Opinião:** a coluna da ligação encolhe antes do texto (`Clone found · 2 clones:` sem corte); a razão do rodapé pode ir a duas linhas dentro do espaço dela.

6. **O passo lento espreme o rótulo.** No app real (`c5558`), com um caminho longo, `Checking the clones of 3 repositories` quebra em quatro linhas, porque a coluna do tempo e da razão é `auto` sem corte (`components/system/StartSteps.tsx:24–43`). O caso real do passo lento é justamente um caminho de rede longo. **Mudar:** a razão cortada com tooltip, e o rótulo inteiro.

7. **O copiado mostra dois vistos.** `CopyButton.tsx:42`, `:50` troca o ícone pelo visto, e `:55–59` acrescenta outro `✓ Copied` (`c5152`: `✓ ✓ Copied`; `c96`: `✓ Copy the list ✓ Copied`). O **Copy** de ícone ainda escorrega para a esquerda. `components.md:887` pede "o visto e `Copied`", um só.

8. **A linha de modelo diverge do material em quatro pontos.**
   - **Try again** da falha é o link de ação (`ModelDefaultRow.tsx:60`, `SaveFailure`); `10:149` pede fantasma `xs`. O link é o do modo de review (`10:127`).
   - ` · unavailable` sai no peso e na tinta do chip (`components/system/Chip.tsx:129`); `10:150` pede `--ink-3` 400.
   - O chip de fábrica em Defaults é `text-ink-3` (`ModelChip.tsx:110`); `10:140` pede `--ink-2`.
   - A falha do catálogo no menu sai em `--state-error`; o mock usa `--ink-2`, e `10:152` diz "como hoje".

9. **As mutações que sobrevivem** (veja "Mutações"), fora as do bloqueio 3. Um caso cada:
   - **No Go:**
     - um repositório só com tasks arquivadas (`releaseOf`);
     - uma ordem em que maiúsculas mudam o resultado;
     - `FromBoardPreview` com `Release`, `GoneStatuses`, `NewStatusIDs` e `NewCardStatusGone` preenchidos (`board_service_test.go:181`);
     - uma opção renomeada (o mesmo id) que não conta como sumida;
     - o `stat` que falha em `List`;
     - `modelFactory` no `State` do app;
     - um `gh` morto ou no prazo (`ExitCode -1`);
     - a frase do disco cheio com o `~` (o teste usa `t.TempDir()`, fora do home) e em `SetReviewModeDefault`;
     - a escrita da sonda que falha por `ENOSPC`;
     - `Bind` do Attention;
     - a ordem de `Wails()`: `TestWailsListsEveryPlaceholderInOrder` (`late_test.go:140`) promete a ordem e só conta oito.
   - **No frontend:**
     - a navegação em linha a 812 provada como linha;
     - a altura de cada `tr` da tabela de status;
     - um caminho de repositório longo nas cenas;
     - a ordem Implementation/Step review;
     - a área do início invisível antes de 400 ms;
     - o detalhe da migração com `/home/`;
     - o `◇` e o tooltip de `ReadingAge`;
     - o cursor no começo da edição;
     - **Save** primária e com `Ctrl S`, e **Save** das instruções secundária (§4.3 #9);
     - o menu do chip que não abre lendo (§4.3 #6);
     - o `×` de Remove repository tracejado durante a remoção;
     - `PromptEditor` usando o token, não 288 solto.
   - **`where-actions-went.test.tsx`** não tem linha para o clonando, a falha do clone, a falha da varredura, a falha ao salvar o prompt, a recusa do **Add** `owner/name` e o **Change path…** do `⋯`, nem prova que uma página de Settings não tem primária (`10:373`).

10. **A idade da leitura não é uma só.** `10:168` pede o `ReadAge` `failed`, com o tooltip `Failed at 13:52 · last read at 11:30`, "em Settings e na linha de board da Home", "para o produto ter uma idade só". A Home continua com o texto próprio (`features/home/home.ts:210`, `◇ Read failed …` sem esse tooltip). **Mudar:** a linha de board da Home usa `ReadingAge`.

11. **A documentação.** Está no presente. Das 835 strings entre crases acrescentadas a `docs/`, todas as que não são nome de arquivo, comando ou modelo montado existem no código. Os problemas:
    - **`docs/architecture/overview.md:109`:** `State.ModelFactory` serve "para a interface dizer o que **Restore** devolve". Nenhum **Restore** usa a fábrica: ela serve à marca `factory`, ao `own` do chip e a `6 of 9 changed…`.
    - **`overview.md:175`:** "assina os quatro eventos antes de pedir o estado inicial" contradiz `:119` ("Cinco eventos") e repete `:167`. Escrever "os outros quatro, em `connect`".
    - **`features.md:58`:** a consequência com todos os fechos (item 2).
    - **`features.md:938`:** "(288 px)" (bloqueio 6).
    - **Omissões em `overview.md` §Features (`:179`)**, que `10:566` pede: `features/startup`; o que `settings` tem agora (`settings-nav.ts`, `defaults.ts`, `SettingsPage`, `PromptsPage`, `PromptPage`, `PromptEditor`, `usePrompt`); `ReviewModeOptions` em `review-mode`; o diálogo em passos, `StatusTable` e `BoardRepositoryRow` em `boards`.
    - **Omissões em `features.md`:** a regra dos 720 px (`SettingsList.tsx:64`, `:68`; `10:119`); as contagens de Repositories na linha 3 abaixo de 820 px; o tooltip do `⋯`; `Ctrl+S` e o `Ctrl+Enter` dos diálogos de Settings fora da tabela §Atalhos (`features.md:1004–1016`).
    - **`docs/development/troubleshooting.md`** (§Máquina): "um `gh auth token` que não respondeu nem que o `gh` falta nem que não há login" está mal construída. Melhor: "que falhou por outra causa que a falta do `gh` ou do login".
    - **`docs/guidelines/testing.md`:** o padrão `settings-<cena>-<momento>-…` não diz que a cena em repouso não leva momento.

12. **A régua.**
    - **`10:20` e `10:361`** dizem que `Ctrl+Enter` confirma cada diálogo de Settings. `decisions.md` 2026-10-02 ("Diálogos destrutivos: sem `Ctrl+Enter`"), `components.md:798` e `structure.md:372` dizem que os destrutivos não confirmam. O código segue a decisão; o material ficou para trás.
    - **`components.md:843`** (Linha de Settings) diz "sem board, a página tem o vazio sem ação", contra `10:172` e §4.3 #8, que o código segue.
    - **`components.md:857`** diz `Already registered · 9`, contra `Already registered 9` de `10:268`, que o código segue.
    - **`10:22`:** o diretório do `chmod 000` (bloqueio 3).

13. **Os valores soltos onde há token.** Os arquivos novos usam passos numéricos do Tailwind onde há `--space-*`: `BoardRepositoryRow.tsx:43` (`px-3 py-1.5`), `:44` (`gap-3`), `:79` (`pb-1`); `BoardDialog.tsx` (`gap-2` no estado lendo e no campo `owner/name`); `StatusTable.tsx` (`px-3 py-2`, `px-3 py-1`, `gap-2`). Os valores batem com a escala, e nenhuma cor nem duração está solta.

14. **Miúdos.**
    - A navegação não olha os modificadores (`SettingsNav.tsx:55–64`). Em linha (812 px), `Alt+←` troca de página e marca o evento, e o voltar global não age.
    - O item aberto da navegação fica com o texto em `--ink-2` (`SettingsNav.tsx:94–96`); o mock pinta `--ink-1` (`rest.css:39`). `components.md` não fixa.
    - O ícone `prompt` é `SquareTerminal` (`components/system/icons.ts:109`). `10:113` pede "a folha com o sinal de terminal", como o mock; o lucide tem `FileTerminal`.
    - A container query é `max-width: 820px` (`globals.css`), que inclui 820; `10:119` diz "abaixo de 820".
    - **Add** do `owner/name` fica tracejado com o campo vazio sem razão por `aria-describedby` (`10:383`).
    - Na falha do clone, **Try again** fica colado ao texto, não à direita como nas outras linhas de bloqueio (`c6465`).
    - No cadastro um a um, o spinner é mais estreito que a caixa, e o nome anda 6 px (`ScanCloneRow.tsx`; `c33`).
    - Com as linhas iguais, a frase diz `Your version has 87 lines; the default of this version has 87.`
    - Na falha de permissão, um usuário de tema escuro vê a tela clara quando o portal não responde: o `localStorage` do WebKit fica dentro do diretório sem permissão. É caso de borda de `10:296`.
    - Os testes de digitação longa de outras tasks estouram o tempo sob carga (veja "Suítes").
    - **Opinião, fora do material:** um banco com `user_version` à frente (99) abre sem aviso, e só o log registra. Uma versão velha do app abriria um banco de uma versão nova.

## Os itens de pronto

| # | Situação | Evidência |
|---|---|---|
| 1 | **Falha** | As cenas, as variações, as larguras, os temas e o relógio batem com `10:19`, e as provas de pixel, de página e de primária morrem. Falham: as capturas na PR, o tooltip aberto e as fixtures (bloqueio 1), e a tabela de status desmontada sem prova (bloqueio 2). A prova de corte morde em 14 de 256 casos |
| 2 | Ok, com ressalva | `SettingsView.keys.test.tsx` e os testes dos diálogos: as mutações de teclado e de foco morrem. Sobrevive o cursor no começo da edição. O foco de Remove repository aberto pelo `⋯` não é provado (bloqueio 4), e `↓` numa caixa da tabela troca um dado (bloqueio 2). `Ctrl+Enter` nos destrutivos segue a decisão posterior (item 12) |
| 3 | **Falha** | P31, P32, P34, P34b e P36 provados em tabela, com casos que faltam (item 9). P35: o executor provado com uma tentativa falsa; a tentativa real, o fechamento durante o início e a recusa da migração sem prova (bloqueio 3) |
| 4 | Parcial | A sonda e a classificação provadas no Go, e a falha de permissão e **Try again** vistas no app real, aqui. `target-machine.md` registra a janela, o `chmod 000` e o `tmpfs`, mas não o **Try again** na janela real (bloqueio 3) |
| 5 | Ok, com ressalva | 133 mutações nas funções puras, 121 morrem. Sobrevivem a ordem dos modelos, o atraso de 400 ms, o detalhe da migração e o `ReadingAge` (item 9). A consequência segue um texto diferente de `10:211` (item 2) |
| 6 | Ok, com ressalva | `where-actions-went.test.tsx` pega cada controle renomeado de `10:9`, menos **Change path…** do `⋯`. Não prova **Save** primária com `Ctrl S` nem a página sem primária, e faltam seis estados (item 9) |
| 7 | Ok, com ressalva | O token em `tokens.css` e o teste de forma em `globals.test.tsx`. O valor mudou de 224 para 288 sem decisão (bloqueio 6), e 288 solto no lugar do token sobrevive |
| 8 | Ok | `task check` verde na ponta. Cada commit compila, passa o lint, o typecheck e os testes Go; o jsdom de sete commits só falha por tempo sob carga, e passa com menos carga. Nenhum teste removido sem substituto |
| 9 | Ok, com ressalvas | `features.md` reescrito nas seções que `10:27` lista, e `storage.md`, `overview.md`, `design-system.md`, `target-machine.md`, `troubleshooting.md`, `go.md` e `testing.md` tocados, no presente. Ressalvas no item 11 |
| 10 | Esta crítica | — |

## O que saiu

- **Os arquivos:** `features/boards/RepositoryLinkRow.tsx`, `features/repositories/CloneFolderField.tsx` (com o teste), `features/settings/PromptPane.tsx`, `features/welcome/WelcomeScreen.tsx` (com o teste) e `internal/app/refused.go`.
- **O que mais saiu:** `runRefused`, `startupTimeout`, `AppMark` e o `<div>` vazio de `App.tsx`. `App.tsx:32–34` mostra `StartScreen`; `callTimeout` está em `internal/app/app.go:46` e `openTimeout` (1 min, para as migrations) em `internal/app/attempt.go:38`, como `storage.md` diz.
- **O que fica, como o material pede:** `ModelPicker` e `ReviewModePicker` continuam em `StepList`, `NewDiscussionDialog` e `StartReviewDialog` (task 12); o `CutCode` continua com a cópia dele (`features/chat/Markdown.tsx:140`); `restorePrompt` serve a **Reset to default…**.
- **`DiscardChangesDialog`** fica com o nome, no `Dialog` do system.

Nada importa o que saiu, e `docs/` e `design/` (fora de `tasks/` e `research/`) não citam nenhuma das peças.

**Comportamento fora de `changes.md`.** Todos são menores e consequência do material ou de decisão:
- o `Menu` do system deixa um item destrutivo desabilitado sem vermelho em todo menu do produto (`danger = destructive && !disabled`), e ganha `reason` numa linha própria, `trailing` e `MenuText micro`; segue "nunca vermelho" e está em `design-system.md`;
- o `Checkbox` tem sempre `tabIndex={0}` e aceita `describedBy`; o `Radio` ganha `render` e `label` (a origem do bloqueio 2);
- os oito services de binding começam cada método por `s.late.resolve(s)` (confere: nenhum método exportado fica sem), e antes do `ready` respondem `MySpec is starting.`, como P35 pede;
- uma segunda instância sai antes de abrir o banco (`10:427`, registrado em `target-machine.md`);
- os diálogos destrutivos não confirmam por `Ctrl+Enter`, pela decisão de 2026-10-02 (item 12).

## Tokens e contraste

**`tokens.css` ganha `--col-placeholders`**, com o valor do bloqueio 6. Nenhuma cor nem duração está solta no diff. Os passos numéricos de espaço estão no item 13.

**Texto, medido nos dois temas** sobre os OKLCH de `tokens.css` resolvidos no Chromium (claro / escuro). Todo texto passa 4,5:1:
- a navegação:
  - o item, `--ink-2` sobre `--surface-1`: 10,73 / 10,95;
  - o hover, `--ink-1` sobre o véu: 16,04 / 12,79;
  - o aberto, `--brand-ink` (o ícone) sobre `--brand-tint-plane`: 5,37 / 7,13;
  - o `◇ N`, `--ink-3`: 7,15 / 8,01; no aberto, `--ink-2`: 9,09 / 8,46;
- as frases e o meta, `--ink-3`: sobre `--surface-1` 7,15 / 8,01; sobre `--surface-2` 7,26 / 7,09;
- a idade e `Default`, `--ink-4`: sobre `--surface-1` 6,06 / 6,47; sobre `--surface-2` 6,15 / 5,72;
- a linha de bloqueio e a linha desmarcada, `--ink-2` sobre `--surface-0`: 9,75 / 11,63; em `--ink-1`: 16,21 / 15,88;
- `--state-error`: sobre `--surface-1` 6,01 / 6,73; sobre `--surface-2` 6,10 / 5,95; sobre `--surface-0` 5,46 / 7,14; num diálogo (`--surface-3`) 6,10 / 5,58;
- a opção de review escolhida, sobre `--brand-tint`: `--ink-1` 15,26 / 10,01; `--ink-3` 6,12 / 5,36;
- os diálogos, `--ink-3` sobre `--surface-3`: 7,26 / 6,65;
- o repositório de outro board, `--ink-4` sobre `--surface-3`: 6,15 / 5,37 (desabilitado, isento, mas passa);
- os blocos da migração e o bloco de código, sobre `--surface-0`: `--ink-3` 6,51 / 8,51; `--ink-2` 9,75 / 11,63;
- a barra de salvar e os passos que não começaram, `--ink-3` sobre `--surface-1`: 7,15 / 8,01;
- os links, `--brand-ink`: sobre `--surface-1` 6,34 / 9,23; sobre `--surface-2` 6,43 / 8,16;
- a primária, `--brand-on` sobre `--brand`: 5,65 / 7,77.

**Não texto:**
- o anel `--brand-ring` do item aberto: sobre `--surface-1` 4,30 / 4,50; sobre o tint-plane 3,64 / 3,47. Passa 3:1;
- a borda `--line-3` da etiqueta `Edited`: 3,51 / 3,27;
- a borda `--line-2` das opções de review: 1,51 / 1,58. Falha 3:1, mas a escolha se distingue pelo tint, pelo anel e pelo visto;
- o fio `--line-1` das listas, 1,28 / 1,27, e o esqueleto parado do início que falhou: decorativos.

**Estado sem cor como único portador:**
- a idade que falhou leva `◇` e `Read failed`; a linha de bloqueio, `◇` e o texto;
- a escolha mudada da fábrica é dita no nome acessível (`…, changed from the factory default …`) e no tooltip, não só pela tinta;
- o indisponível diz `· unavailable`;
- o passo do início diz o estado pelo ícone e pela tinta, e a lista é `aria-live`; o feito e o que roda se distinguem também pelo visto e pelo spinner;
- o repositório de outro board diz a razão por `aria-describedby` e tem a caixa tracejada.

## No app real

**Como rodou:**
- `task build` numa cópia em `fc83b01`;
- `bin/myspec` sob `env -i`, com `HOME` e os `XDG_*` em diretórios novos no scratchpad e `XDG_RUNTIME_DIR` em `/tmp/c88rt`;
- `dbus-run-session` com config própria, sem ativação, e `GTK_A11Y=none`;
- `GDK_BACKEND=broadway` (`gtk4-broadwayd :23`, porta 8103), dirigido por um Chromium headless do Playwright, em telas de 1920×1080 e 1100×800.

**Sem `claude` no `PATH`.** Rodou sem `gh`, com `gh` sem login e com `GH_TOKEN` passado por variável, só para ler o projeto `Pessoal` do usuário (`users/guilhermt/projects/2`). Nada foi escrito no GitHub. Para o passo lento, um FUSE próprio em que cada `lookup` dorme 7 s. O app, o barramento, o broadwayd e o FUSE foram encerrados pelo PID, e `/tmp/c88rt` foi apagado. O MySpec do usuário não foi tocado.

Como o `HOME` de teste não fica sob `/home/<usuário>`, todo caminho aparece inteiro, sem `~`. É o comportamento de `lib/paths.ts:3`. Foi esse `HOME` que revelou o bloqueio 5.

**O que o app mostrou** (capturas em `scratchpad/app/shots/`, fora do repositório):
- **As boas-vindas** (`01`, `c0203`, `c07`, `08`, `c69`, `70`):
  - a lateral nua: a marca, `MySpec`, **New** tracejado com `Register a board or a repository first`, **History** tracejado com `Nothing archived yet`, o tema e **Settings**;
  - **This machine** nas três formas: sem `gh` (`Claude Code was not found` e `The GitHub CLI isn't installed` com `gh auth login` e **Copy**), `gh` sem login (`The GitHub CLI isn't signed in`) e com o token (só o Claude Code);
  - **Start**, com **Add board** em foco;
  - `Ctrl+N`, `Ctrl+J` e `Ctrl+E` inertes; `Ctrl+,` abriu Settings com o foco em Defaults, e `Esc` voltou ao título;
  - o primeiro board, cadastrado pelas boas-vindas, levou à Home com `Nothing in progress` e o foco no título (`76`); o primeiro cadastro feito em Settings manteve Settings (`34`).
- **O início:**
  - `chmod 000` no diretório de dados: a lateral em esqueleto parado, `MySpec couldn't start`, o texto de permissão com o diretório resolvido, o bloco do erro com **Copy** (`Copy the error`) e **Try again** `Enter` em foco;
  - devolvida a permissão, `Enter` mostrou `Starting MySpec…` com `Opening your data`, e o app abriu **no mesmo PID** (`c5354`, `c5558`);
  - com o FUSE: `Opening your data` feito, depois `Checking the clones of 3 repositories`, que aos 5 s mostrou `5s · … doesn't answer` (item 6).
- **Settings, as quatro páginas, nos dois temas, a 1920 e a 1100:**
  - **a navegação:** ↑↓, `Home` e `End` sem dar a volta; em linha a 1100, com ←→; o `◇ 1` só do clone inexistente, com `The clone of acme/infra is missing`; a página com 800 e 764 px;
  - **Defaults:** a faixa `Claude Code was not found`, os quatro grupos, `None changed from the factory defaults`, o pé, o tooltip `The factory default` e o menu do chip com a mensagem do catálogo; Review mode em uma coluna a 1100;
  - **Boards:** o vazio com **Add board**; `Read 1d ago` e `◇ Read failed 19m ago` com a faixa e **Try again** `refresh`; `User · 1 repository: acme/docs`, com `dono/nome`;
  - **o diálogo de board**, com a leitura real do `Pessoal`: a ajuda, **Continue** tracejado com a razão, `Enter` lendo, a recusa sob o campo; `Done and Ready are marked for you, from their names.`; **Back** guardando as escolhas; o passo 3 com `Registered without a clone`. O Edit: `Reading the board…`, a falha sem `gh` com **Try again** primário, e o desmarcar com `→ Leaves MySpec: it has no clone, tasks or reviews.` e a soma. **A tabela de status desmontada** (bloqueio 2; `72`, `c74`, `c8283`);
  - **Remove board:** `1 repository moves to No board and 1 leaves MySpec. …`, as linhas por destino e o foco em **Cancel**;
  - **Repositories:** o vazio com as duas saídas; os grupos `Needs a clone 3`, o board e `No board`; as contagens na linha 3 abaixo de 820 px; as linhas de bloqueio com **Clone** e **Change path…**; o `⋯`; o seletor nativo; a recusa em vermelho (com o caminho estragado do bloqueio 5); a pasta de clones; a falha do `gh` com **Try again**; `Esc` nas instruções sem fechar Settings, com o foco no `⋯`; Remove repository que espera e devolve o foco ao título. **O foco atrás do diálogo** (bloqueio 4);
  - **Add repository:** a varredura com os quatro clones, **Add 2 repositories**, o cadastro um a um, `Registered`, e o diálogo que fecha no fim;
  - **Prompts:** a lista com `Default`; o prompt com os placeholders; a edição com a coluna de 288 px; `Unsaved changes`; `Esc` com `Discard your changes?` e o foco em **Keep editing**; `Ctrl+S` com `Edited today` e o foco em **Edit**; **Reset to default…**. **Cancel** andando (item 1).
- **A migração recusada**, com um banco em `user_version` 11 e quatro tasks legadas (`94`, `97`, `c96`): a janela inteira sem lateral, os três blocos na ordem, `Ctrl+,` e `Ctrl+N` inertes, o tema escuro e o claro guardados respeitados, e **Copy the list** chegando a `Copied` (com os dois vistos do item 7).
- **O log:** os `ERROR` são as recusas provocadas e as duas falhas de início provocadas; os `WARN` são só do ambiente (o portal do tema, o catálogo sem `claude`, os pull requests sem `gh`).

**O que o app não mostrou:**
- **O que pede o `claude`:** Defaults com o catálogo lido (`factory`, `Effort · <modelo>`, `6 of 9 changed`, o chip indisponível, o brilho da leitura), o `unsupported` e a escolha mudada da fábrica. As cenas e os testes cobrem a forma.
- **This machine sumindo ao voltar o foco:** pede um `gh` com login gravado em arquivo, o que não fiz. As três formas foram vistas em execuções separadas.
- **A área principal depois de 400 ms** numa abertura normal: rápida demais para o Broadway.
- **Estados não semeados:** o disco cheio, `Cloning into …`, a nota do board que mudou, `Clone found · 2 clones` com o `Select`, `Registered without a clone: this links the clone to it.` na varredura, **Browse…**, a falha da varredura, o salvar e a falha de Defaults, Reset e Save com erro, e `Esc` fechando Settings com uma edição não salva.
- **O conteúdo copiado para a área de transferência:** o Broadway não deixa ler.

## Segunda leitura (f4e9a16)

Leitura das correções `fc83b01..f4e9a16` (52 commits), com a ponta igual a `origin/57-…`. As mutações rodaram numa cópia desligada do git, só com os testes que cada uma alcança; o pintado, com `test.api.port` próprio no projeto `painted` da cópia.

### Veredito

**Corrigir antes do merge.** Sobra um bloqueio, pequeno e desta PR: o teste que é a única prova do bloqueio 4 é instável. Fora ele, os seis bloqueios estão fechados como o "Mudar" pedia, e os itens de "Podem esperar" também, menos os cinco que o coordenador deixou abertos. O que mais sobrou pode esperar.

### Suítes e CI

- **`task check`**, na worktree de revisão: verde em 101 s. Go com 3.288 testes e 1 pulado (o `dnd` da máquina); web com 8.521 testes em 402 arquivos. `git status` continua limpo.
- **`go test -race -count=3 ./internal/app/`**: `ok` em 11,2 s.
- **`gh pr checks 88`**: **Changes**, **Go** e **Frontend** verdes, **Build** pulado. A PR está `MERGEABLE`/`CLEAN`, com a cabeça em `f4e9a16`.

### Bloqueios e itens

| Bloqueio ou item | Situação | Evidência |
|---|---|---|
| B1 Capturas | Fechado | `captures/57-…` gravada às 19:53 (−03), depois da ponta (19:45). As 260 URLs do corpo existem na árvore do branch (`gh api …/git/trees`), sem faltar nenhuma. O corpo tem as tabelas a 2180, 978 e 812, nos dois temas e com a coluna do mock, e a checklist com dois roteiros e as capturas. As fixtures foram corrigidas: `settings-scenes.ts:668` tem a frase do Go, `:507` dá `registered`, `:456` traz `newCardStatus: "to-do"`, e `:847` traz as instruções. `settings-defaults-saving` sai sem tooltip. A migração continua com o nome da janela (`1250`/`2560`), mas o cabeçalho diz "the whole … window", e `testing.md` registra isso. Aceito |
| B2 Tabela de status | Fechado | `StatusTable.tsx`: o `tbody` voltou a ser `tbody`, e os rádios são `RadioInput` com o mesmo `name`. Nas capturas `add-2` 978 e `edit-1` 812, as colunas estão alinhadas aos cabeçalhos. Mutações: `tr` com 4,25 px morre (14); os rádios sem o mesmo `name` morrem (3). `StatusTable.test.tsx:98` prova que as setas numa caixa não mexem no status de cards novos |
| B3 A tentativa real | Fechado, com o clique na janela real deixado para a checklist do usuário | `attempt_test.go` (426 linhas) cobre a tentativa com abridores falsos. Das 36 mutações Go, morrem todas as 16 de `internal/app` da primeira leitura (A1–A10, U1–U5, S1), mais AP1, AP3, AP4, AP5 e A12 (o contexto cancelado nos clones). `target-machine.md` e `10:22` dizem `<XDG_DATA_HOME>/myspec` |
| B4 Foco de Remove repository | Fechado no código; **a prova é instável** (veja abaixo) | `RepositoryMenu.tsx:74–77` (`handsFocus`). A mutação que tira essa linha morre no pintado (2) e **sobrevive no jsdom**: a única prova é `RepositoryRow.painted.test.tsx:37` |
| B5 `displayPaths` | Fechado | Há lookbehind em `lib/paths.ts`. A mutação que o tira morre (4) |
| B6 `--col-placeholders` | Fechado, em 224 | `tokens.css`, `components.md`, `features.md` e `design-system.md` dizem 224. A mutação "224 solto" sobrevive, mas é equivalente pelo valor |
| 1 Cancel parado | Fechado | `settings-prompts-edit`: `Nothing changed yet.` à esquerda. A mutação sem `ml-auto` morre (2) |
| 2 Um fecho só | Fechado | `board-dialog.ts:202–205`. `features.md` acompanha |
| 3 Títulos do prompt | Fechado | `.ui-headings` (`globals.css:565`), também no `CardDraft`. Sem sobra de `draft-body`. `discussion-drafts-edit` sai idêntica byte a byte à de `captures/56-…` |
| 4 Cinco linhas | Fechado | O `Textarea` respeita `rows` (`Textarea.tsx`). `settings-repos-instructions` mostra 5 linhas. A mutação que volta ao mínimo do compositor morre (6) |
| 5 Corte no diálogo de board | Fechado | `add-3`: `Clone found · 2 clones:` inteiro, com o `Select xs`. `edit-2`: a soma em duas linhas (`BoardDialog.tsx:447`) |
| 6 Passo lento | Fechado | `start-slow-long`: o rótulo inteiro e o caminho cortado |
| 7 Um visto | Fechado | `CopyButton.tsx:58–89`, com prova pintada |
| 8 Linha de modelo | Fechado | **Try again** é fantasma `xs` (`ModelDefaultRow.tsx:65`); ` · unavailable` vai em `font-normal text-ink-3` (`Chip.tsx:129`); o catálogo sai como `MenuMessage tone="notice"` (`ModelChip.tsx:128`) |
| 9 Mutações | Fechado, menos três | No Go, das 36 mutações morrem 34 (B1–B3, D1–D8, P1, G1, R1 e as de `internal/app`). Sobrevivem AP2 (`app.go:140`, a janela antes do início, em `Run`, que pede o Wails) e uma nova, A11 (`attempt.go:91`, o banco fora dos `closers`). No frontend, das 23 morrem 20. Sobrevivem FE13, equivalente; FE16, a idade da Home em `micro` (`StartRow.tsx:237`; `b492fee` não tem prova); e FE18 no jsdom, como no B4 |
| 10 Idade da Home | Fechado | Na captura `home`, `◇ Read failed 18m ago` sai no tamanho de `read 1d ago` (`size="meta"`). Sem prova (FE16) |
| 11 Documentação | Fechado | `overview.md:109` e `:175`, as omissões, `troubleshooting.md` e `testing.md:82` |
| 12 Régua | Fechado | `10:20`, `10:361`, `components.md` (o vazio com **Add board**; `Already registered 9`) e `10:22` |
| 13 Espaços em token | Fechado | `4ececa3`. Em `BoardRepositoryRow`, `BoardDialog` e `StatusTable`, não sobra passo numérico |
| 14 Miúdos | Fechado, menos os cinco do coordenador | Os modificadores na navegação: a mutação morre (4). Também fechados: `--ink-1` no item aberto, `FileTerminal`, `(width < 820px)`, a razão de **Add** (a mutação morre), **Try again** à direita, o spinner no quadrado da caixa e a frase das linhas iguais |

### O bloqueio que sobra: o teste instável

**O que mostra:**
- Rodei a suíte pintada inteira com mais dez cópias do arquivo. O teste "opens Remove from the ⋯ with the focus on Cancel, held in the dialog" falhou em **12 de 22** execuções (11 arquivos × 2 temas), e o resto da suíte passou.
- Todas as falhas são em `RepositoryRow.painted.test.tsx:59`, nunca em `:56`: o foco chega a **Cancel**, mas parece sair do diálogo num Tab.

**A causa, com uma sonda:**
- No Tab depois de **Remove repository**, a sonda registrou o `activeElement`. Era o `span[data-type="inside"][data-base-ui-focus-guard]`, a guarda do `FloatingFocusManager` do diálogo, que fica fora do elemento `alertdialog`.
- A guarda devolve o foco ao primeiro controle por `enqueueFocus`, num `requestAnimationFrame` (`@base-ui/react/floating-ui-react/utils/enqueueFocus.mjs`).
- O teste confere logo depois de `userEvent.tab()`. Sozinho, o quadro já passou quando ele confere; sob carga, ainda não.
- **É o teste que falha, não o produto.** O foco fica preso no diálogo.

**Mudar:**
- Depois de cada `userEvent.tab()`, esperar a guarda: `await expect.poll(() => dialog.contains(document.activeElement)).toBe(true)`.
  - Com isso, as mesmas dez cópias e a suíte inteira deram **0 de 20** falhas.
- De quebra, trocar a espera fixa de `SETTLED_MS` (`:53`) por esperar o menu sair do DOM e mais um quadro. Sob carga, 400 ms não garantem que a animação de saída do menu acabou, e a prova contra a regressão do B4 ficaria fraca.
- Um teste jsdom em `RepositoryMenu.test.tsx` que abre **Remove…** pelo `⋯` e confere que `finalFocus` não devolve o foco daria uma segunda prova estável. Hoje a FE18 sobrevive no jsdom.

### As capturas olhadas

São 19, baixadas do branch.

- **`settings-boards-add-2` 978 e `edit-1` 812:** a tabela em colunas, a etiqueta `new` e a nota do board que mudou. A 812, o corpo rola com `No status` sob o pé, como deve.
- **`settings-defaults-saving`:** sem tooltip. **`7 of 9 changed` está certo.**
  - A cena troca o Step review para Opus 4.1 (`settings-scenes.ts:593`), que difere da fábrica Opus 5.5 (1M) · high (`10:140`). São as seis do mock mais uma.
  - O mock diz 6 porque conta `changed` pelos dados (`settings.js:41`) antes de sobrescrever o chip do Step review (`:49`). O erro é do mock.
- **`settings-prompts-edit`:** a razão à esquerda, e **Cancel** e **Save** à direita, parados.
- **`settings-repos-remove`:** o diálogo com o foco em **Cancel**, `~/code/docs` e a frase do board.
- **`start-slow-long`:** o rótulo `Checking the clones of 12 repositories` inteiro, e o caminho `/mnt/team-share/…/te…` cortado.
- **`home`:** `◇ Read failed 18m ago` no tamanho de `read 1d ago`.
- **`welcome-no-login`:** `The GitHub CLI isn't signed in`, `gh auth login` com **Copy**, e **Add board** em foco.
- **Também olhadas:** `add-3`, `edit-2` (`Registered · Not cloned`, a soma em duas linhas), `repos-instructions` (cinco linhas em mono) e `prompts-view` (títulos em `--text-ui` 600).

### O anel da primeira caixa da tabela

Ele ocupa a célula inteira. É o que `components.md` (Caixa de seleção) manda ao pé da letra: "o alvo é a linha inteira … foco (o anel da linha)", e a "linha" do `Checkbox` aqui é a célula.

**O que não fecha** é o rádio da mesma linha:
- `RadioInput` é `w-fit` (`Radio.tsx:116`): o alvo e o anel ficam só em volta do círculo.
- O comentário (`Radio.tsx:112`) e `design-system.md:116` dizem "com a célula como alvo".

**Opinião, fora do que a régua cobre:** os dois controles da linha com o mesmo alvo. O `label` do `RadioInput` ocuparia a célula, alinhado à esquerda, e o anel dos dois seria o da célula. Assim o código passa a dizer o que a documentação já diz. Pode esperar.

### Nada novo de peso; miúdos que podem esperar

- **O `Textarea` com `rows`** muda a altura mínima de campos das tasks 5 a 9:
  - os campos: `NewTaskDialog` 4, `CardContextLine` 3, `StartReviewDialog` 3, `ReviewAgainDialog` 3, `PublishDialog` 5, `PermissionCard` 2 e `DraftEditor` 6;
  - a regra nova é a mesma do mock (`base.css:446`, com `rows` no `textarea`), então aproxima o produto do decidido;
  - nenhuma captura mostra esses campos abertos: `review-again`, `reviews-start`, `create-card` e `review-publish` não mudam no campo, e `discussion-start`, `discussion-drafts-edit` e `scene-findings-edit` saem idênticas byte a byte às dos branches de captura delas.
- **`Select` `xs` e `MenuMessage` `notice` entraram no system sem linha em `components.md`** (Select, menu e listbox, `:214–219`). `design-system.md:155` ainda diz que a `MenuMessage` é "neutra (`status`) ou de erro (`alert`)".
- **Prova que falta:**
  - a idade da Home em `meta` (FE16);
  - o banco nos `closers` de uma tentativa que dá certo (A11, `attempt.go:91`). Sem ele, o banco nunca é fechado no `shutdown`.
- **`10:22`** ainda diz "na máquina alvo pelo implementador", e o clique em **Try again** na janela real foi para a checklist do usuário. É decisão do coordenador; a régua ficou para trás.
- **`overview.md:167` e `:175`** repetem que `connect` assina os eventos antes de pedir o estado. Não se contradizem.
- **Os documentos dos merges à mão** (`features.md`, `components.md`, `design-system.md` e `testing.md`) estão no presente, sem frase duplicada, contraditória ou em forma de histórico.
  - Conferi as linhas novas de `10-settings.md` contra o código: `both have 87 lines` (`prompts.ts:133`), o `Ctrl+Enter` dos destrutivos, os rádios pelo `name` e o `chmod`.
- **Sob carga extrema** (a suíte pintada com as mutações Go em paralelo), dois testes de cena estouraram o tempo em `pointerInTheCorner` (`test/painted.ts:441`):
  - `StartScreen.scenes` `slow-long` 2180, desta PR, e `BoardView.scenes`, de outra task;
  - sem a carga extra, passam;
  - é o item dos testes lentos sob carga, que o coordenador deixou aberto.

### O que sobrou aberto

- **Do coordenador**, pela decisão dele: o tema escuro na falha de permissão, os testes lentos sob carga, o `user_version` à frente (com o usuário), o cursor no começo (equivalente) e a sonda com `EFBIG`.
- **Desta leitura:** o teste instável (o bloqueio) e os miúdos acima.
- **Da checklist do usuário:** **Try again** na janela real e as boas-vindas com `claude` e `gh` logados.
