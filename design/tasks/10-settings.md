# Task 10 · Settings, boas-vindas, início e migração

Material de entrada da décima task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 10 de `design/implementation.md` (§2, linhas 151–161), com os princípios da §1 (9–22) e os riscos da §3 (185–196). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** O material foi escrito sobre a `main` em `f055371` (tasks 1 a 4 mergeadas). A task depende só da task 2, mas **começa depois do merge das tasks 4 e 5**: a 4 reescreveu `store/app-store.ts`, `store/actions.ts` e `app/useGlobalShortcuts.ts`, que esta também muda, e a 5 cria a idade da leitura, a linha de início e os ícones que esta usa. Ela corre em paralelo com a 9 (e com a 6, a 7 ou a 8 que ainda estiver aberta). As linhas de código citadas são as de `f055371`; as de `design/` são as da `main` depois deste material. A task cria uma migration, `00NN_board_saved_statuses.sql`, com o número livre no momento do merge (a 4 leva a `0020`, a 6 a `0021`, a 7 a `0022`, a 8 a `0023`, a 9 a `0024`): o implementador renumera o arquivo no rebase. Onde ela se toca com cada outra task e a ordem de merge estão na §6.

Toda decisão de design está tomada neste documento, em `design/screens/rest.md` §2, §5, §6 e §7, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; o que a task abria de produto foi decidido pelo coordenador, por delegação, em `decisions.md` (2026-09-29, "Settings, boas-vindas, início e migração: o que a entrada da task 10 decidiu") e está na §9.

**Nenhum comportamento de hoje se perde.** Cada controle das telas que saem tem um lugar novo, dito na §4.2 e provado pelo pronto 6: de Settings, **Close**, a navegação e os nove prompts; de Defaults, o modo de review e os nove modelos; da página Boards, **Add board**, **Edit**, **Remove**, o link do GitHub, o dono, o tipo, os repositórios, os status e a leitura; do diálogo de board, a URL, os finais, o status de cards novos, os repositórios com o clone escolhido, **Add** do `owner/name`, as recusas e o erro ao salvar; de Remove board, a prévia; da página Repositories, **Add repository**, **Clone folder** com **Choose…**, **Clone**, **Change path**, **Remove** com o motivo, as instruções de review com **Save** e **Cancel**, as contagens, o board, o caminho, o clonando, a falha do clone, o clone inexistente e a recusa; de Add repository, o filtro, as caixas, **Browse…**, **Add N repositories**, a falha da varredura e as recusas por linha; de Remove repository, a confirmação; de Prompts, **Edit**, **Restore default** (agora **Reset to default…**), **Save** `Ctrl S`, **Cancel**, a coluna de placeholders, o texto renderizado, `Modified` (agora `Edited <data>`), a falha de leitura e a de salvar; das boas-vindas, **Add board** e **Add repository**; da migração, os casos por tipo com as tasks. As mudanças de comportamento são as de `changes.md` X1–X9 e X17–X19.

**Vocabulário.** "Página" é uma das quatro páginas de Settings (a de um prompt e a edição dele são estados da página Prompts); "linha" é a linha de Settings de `components.md` (um board, um repositório, um prompt); "linha de bloqueio" é a faixa afundada sob uma linha; "linha de modelo" é a de uma etapa em Defaults; "o início" é a tela antes do primeiro estado; "as boas-vindas" são a Home quando nada está cadastrado; "modo de boas-vindas" é o app sem board, sem repositório e sem item ativo.

## 1. Objetivo e critério de pronto

Settings vira o lugar com quatro páginas (Defaults, Boards, Repositories, Prompts), com a navegação que avisa um clone inexistente, os modelos agrupados com a marca da fábrica, o diálogo de board em passos com **Back** e a consequência de cada repositório desmarcado, os repositórios com o que bloqueia primeiro e as ações no `⋯`, e os prompts como lista. O início do app deixa de ser uma janela em branco (os passos, o passo lento, a falha com **Try again**), as boas-vindas passam a morar no shell com Settings ao alcance e dizem o que falta na máquina, e a migração recusada ganha **Copy the list**. Do Go, a task pede P31, P32, P34, P34b, P35 e P36 (§4.4).

**Pronto quando** (`implementation.md:161`), cada item provado como diz:

1. **As cenas.** As fixtures de `test/settings-scenes.ts` reproduzem `lab/14-screen-rest/src/data.js` com o relógio fixo às 14:10 de 2026-09-24: os boards `Internal Tools` (lido em 2026-09-23 às 12:00, `Read 1d ago`), `Mobile App` (lido às 11:30 — o mock diz 11:02, §4.3 #28 —, a falha `GitHub's rate limit was reached. It resets at 14:32.` às 13:52, `◇ Read failed 18m ago`) e `Platform Roadmap` (lido às 14:08, `Read 2m ago`), os 12 repositórios de `REPOS14` (dois sem clone, `acme/billing` e `acme/android`, e `acme/infra` sem board com o clone inexistente), as contagens derivadas do History da rodada, os 9 modelos com 6 mudados da fábrica e o catálogo de 4 modelos (Haiku 4.5 sem esforço), o modo `Agent`, os 9 prompts com o PRD editado em 2026-09-20 (92 linhas; o padrão, 87). Quatro testes pintados (Chromium, claro e escuro) montam as cenas de `rest.md` §2, §5, §6 e §7 com as variações de `?v=`: `features/settings/SettingsView.scenes.painted.test.tsx` (`settings-defaults` —, `list`, `saving`, `reading`, `failed`; `settings-boards` —, `add-1`, `add-1-reading`, `add-1-error`, `add-2`, `add-3`, `add-nostatus`, `edit-reading`, `edit-1`, `edit-2`, `remove`; `settings-repos` —, `add`, `add-scanning`, `add-refused`, `instructions`, `menu`, `change-path`, `remove`, `empty`; `settings-prompts` —, `view`, `edit`, `reset`, `discard`), `features/startup/StartScreen.scenes.painted.test.tsx` (`starting` —, `slow`, `failed`), `features/welcome/Welcome.scenes.painted.test.tsx` (`welcome` —, `no-login`, `no-gh`, `no-claude`) e `features/migration/MigrationRefused.scenes.painted.test.tsx` (`migration`), cada cena a 2180 px de área principal (o monitor inteiro) e a 978 px (a metade), e as de Settings também a 812 px (a janela de 1100). As cenas decididas só neste material entram como `?v=` próprios, sem mock, comparadas com a cena vizinha: `settings-boards` `empty`, `edit-failed` e `remove-failed`; `settings-repos` `add-failed`; `settings-prompts` `list-failed` e `view-failed`; `starting` `disk-full`; `welcome` `history`. Em cada uma o teste confere: toda linha, faixa, diálogo, navegação e coluna em pixel inteiro; todo texto cortado com tooltip; no máximo uma primária; a página de Settings com 800 px a 2180, 674 a 978 e 764 a 812; a 978 px a navegação à esquerda e a 812 px como uma linha acima da página. Grava as capturas, anexadas ao pull request lado a lado com o mock (`python3 -m http.server <porta> -d design/lab`, numa porta livre acima de 8090, que é a do coordenador; `14-screen-rest/index.html?scene=…&v=…`).
2. **O teclado** (`features/settings/SettingsView.keys.test.tsx` e os testes de cada diálogo, jsdom): `Ctrl+,` abre e fecha Settings, também nas boas-vindas; `Esc` fecha Settings para o lugar anterior, e as boas-vindas quando vieram delas; `↑` `↓` `Home` `End` na navegação trocam de página, e `←` `→` também com a navegação em linha; `Enter` no campo da URL lê; `Ctrl+Enter` confirma o diálogo de board e o de **Add repository**, e os destrutivos (Remove board, Remove repository, Reset to default, Discard your changes) não confirmam por ele (`decisions.md` 2026-10-02); **Back** volta um passo com o que foi escolhido; `Esc` no bloco das instruções cancela sem fechar Settings; `Ctrl+S` salva o prompt; `Esc` na edição cancela, com `Discard your changes?` quando há mudança; `Enter` no início que falhou tenta de novo; o foco inicial de cada diálogo e de cada página é o da §4.2, com os destinos de quando o dono do foco some (o primeiro cadastro pelas boas-vindas vai ao título da Home; a volta de Settings às boas-vindas, ao título delas).
3. **O Go** (§4.4): os testes de tabela de P31 (a consequência por repositório e os nomes por destino, pela mesma regra de `releases`), P32 (o retrato dos status gravado no cadastro e na edição, o que sumiu e o que é novo, a migration com a leitura válida, vazia e inválida), P34 (`editedAt`, as linhas, `ListPrompts`), P34b (os padrões de fábrica no `State`), P35 (os passos, o passo lento com o caminho, a sonda do diretório de dados e a falha por tipo, **Try again** que recomeça sem processo novo, a migração recusada como fim do primeiro passo, o fechamento da janela durante o início) e P36 (Claude Code desta execução, `gh` ausente, sem login, pronto); `task generate`, `lib/wails.ts` e `test/wails-mock.ts`.
4. **O início nunca em branco.** Com o diretório de dados sem permissão (um `chmod 000` num `XDG_DATA_HOME` de teste, o caso real, em que o SQLite devolve `unable to open database file` sem o `errno`), a sonda reconhece a permissão, e o app abre a janela com a falha, o texto do caso com o diretório resolvido e **Try again**; devolvida a permissão, **Try again** abre o app sem reiniciar o processo. O disco cheio é provado com um `tmpfs` pequeno ou com o abridor falso. Provado no Go e, uma vez, na máquina alvo pelo implementador, com o resultado em `docs/development/target-machine.md`.
5. **As funções puras** testadas em tabela (§4.4, Onde moram): o `◇ N` da navegação, a contagem `6 of 9 changed`, o nome acessível da linha de modelo, as linhas do board, a frase de remoção e as linhas por destino, a ajuda da pré-marcação, a nota do board que mudou, a consequência de um repositório desmarcado e a soma do rodapé, os grupos de Repositories na ordem, as contagens da linha, o motivo de **Remove…**, a partição da varredura e a linha de quem liga um clone, a data `Edited`, a frase das linhas do prompt, o texto dos passos do início, os itens de `This machine` e o texto de **Copy the list**.
6. **Onde foram as ações.** `features/settings/where-actions-went.test.tsx` tem uma linha por controle do terceiro parágrafo e por estado em que ele aparece hoje; nenhum fica sem lugar. Em cada cena, no máximo uma primária.
7. **Os tokens.** `--col-placeholders` em `design/system/tokens.css`, pela pull request desta task, no step 10, que o usa, com o teste de forma em `styles/globals.test.tsx`.
8. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
9. **Documentação** da §7 escrita no step de cada área; `features.md` §Configurações e aparência, §Modelos e esforço, §Boards (Página Boards, Cadastrar um board, Editar e remover um board, Falhas), §Repositórios (Página Repositories, Repositório sem clone, Clone inexistente), §Prompts, §Tela de boas-vindas e barra lateral, §Dados de uma versão com áreas de trabalho e §Atalhos reescritos.
10. **Revisão do `design-critic`** na branch contra este material, `rest.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).

`changes.md`: X1–X9, X17–X19. `backend.md`: P31, P32, P34, P34b, P35, P36.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 10 (151–161), task 11 (163–173), riscos (185–196) | O escopo, o app sempre usável (15), os testes que migram (22), o que é da task 11 |
| 2 | `design/decisions.md`: Settings, History, boas-vindas (2026-09-25); Settings, boas-vindas, início e migração (2026-09-29, o desta task); Papéis do azul (2026-09-24) | O que o usuário aprovou e o que o coordenador decidiu por delegação |
| 3 | `design/screens/rest.md` §1 (18–26), §2 (28–281), §5 (368–391), §6 (392–423), §7 (424–433), §12 (619–631), §13 (632–657), §14 (658–747), §15 (748–767), §16 (768–798) | As telas, os estados, os atalhos e o que muda |
| 4 | `design/structure.md` §1 (7–38), §2 O rodapé (196–198), §4 Settings (342), §5 (344–382), §6 (384–399), §7 Início, Migração, Nada cadastrado (405–407) | A regra geral do lugar, das larguras e dos estados |
| 5 | `design/principles.md` 2 (13–33), 5 (51–57), 8 (75–87), 9 (89–95), 10 (97–103) | A primária única, o `◇`, o brilho contra o spinner, a tecla escrita, o pixel inteiro |
| 6 | `design/system/components.md`: estados comuns (18–28), Glifo (55), Spinner e brilho (68), Ícones (78), Tooltip (99), Etiqueta e placeholder (120), Link (141), Troca de lugar (151), Botão (161), Chip (176), Input (200), Select e menu (213), Menu do item (227), Caixa de seleção (238), Rádio (248), Popover Review mode (273), Linha de modelo (282), Cabeçalho do lugar (302), Idade da leitura (313), Seletor de tema (364), Rodapé da lateral (372), Estado vazio de página (402), Esqueleto (420), Faixa de aviso (428), Linha afundada (439), Aviso do app (448), Bloco de código (600), Continue e linha de início (766), Diálogo (776), Settings e início (813–875, com Marca e cópia), Tamanhos de layout (877) | Anatomia, estados, teclado e acessibilidade de cada peça |
| 7 | `design/system/tokens.css`: medidas (53–57), tamanhos (70–75), listas, diálogos e Settings (95–111), movimento (118–123) | `--snav-w`, `--measure`, `--measure-read`, `--size-dialog`, `--size-dialog-wide` |
| 8 | `design/changes.md` X1–X9, X17–X19; `design/backend.md` P31, P32, P34, P34b, P35, P36 | O que muda de comportamento e os dados |
| 9 | `design/research/rest.md` §1 (9–109), §2.1–§2.6 e §2.11 (117–175, 217–222), §4 (276–286), §7 (378–398), §9 (426–440) | O produto de hoje campo a campo e o volume real |
| 10 | Mocks, com `python3 -m http.server <porta> -d design/lab`: `14-screen-rest/index.html` (`?scene=` `settings-defaults`, `settings-boards`, `settings-repos`, `settings-prompts`, `starting`, `welcome`, `migration`, com `?v=` e `?audit`) e as fontes `src/settings.js` (a navegação 8–21, Defaults 25–57, Boards 60–72, o diálogo 78–130, Remove board 131–135, Repositories 138–175, Add repository 176–186, Remove repository 187–189, Prompts 192–243), `src/other.js` (o início 8–18, as boas-vindas 21–33, a migração 36–44), `src/shell.js` (a lateral nua 83–87, em esqueleto 89–95), `src/data.js`, `src/rest.css` (Settings 28–147, início e boas-vindas 325–346, migração 349–364, larguras 380–391); `14-screen-rest/components.html` | A referência visual. Onde o mock e este material divergem, vale o material (§4.3 #28, `implementation.md:18`) |
| 11 | `docs/product/features.md` §Página Boards (13–15), §Cadastrar um board (17–38), §Editar e remover (40–44), §Falhas (63–72), §Repositórios (215–262), §Tela de boas-vindas e barra lateral (264–296), §Dados de uma versão com áreas de trabalho (298–302), §Modelos e esforço (711–718), §Prompts (720–734), §Configurações e aparência (736–740), §Atalhos (787–832) | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 12 | `docs/guidelines/README.md`, `frontend.md`, `go.md`, `testing.md`; `docs/architecture/overview.md` §Composição e injeção (94–96), §O estado que o frontend vê (98–106), §Eventos (108–119), §Store (151–157), §Features (159–163); `docs/architecture/storage.md` §Banco, §Prompts, §Migração dos dados; `docs/architecture/design-system.md` §Componentes | Como um step acontece |
| 13 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go**: P31 e P32 no board, com a migration do retrato dos status; P34 e P34b nos prompts e nos modelos; P35, o início com a janela antes dos dados; P36, as checagens da máquina; a frase do board inexistente com o que fazer (`internal/board/failure.go:42`); a mensagem de disco cheio nos setters de Settings; DTOs, eventos, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`.
2. **`features/settings`** inteiro: o lugar, a navegação com `◇ N`, a página e as seções, **Defaults**, a página **Prompts** com a lista, o prompt e a edição, os diálogos **Reset to default…** e `Discard your changes?`.
3. **`features/boards`** inteiro: a página, a linha com a leitura e a faixa da falha, o vazio, o diálogo de board em passos, **Remove board**; a linha de repositório do diálogo também em **Add to board** (a task 5 é dona do diálogo; esta troca só a linha).
4. **`features/repositories`** inteiro: a página com os grupos, a linha, o `⋯`, as linhas de bloqueio, as instruções de review, a pasta de clones, o vazio, **Add repository** com a varredura, **Remove repository**.
5. **O início** (`features/startup`, novo): a lateral em esqueleto, os passos, o passo lento, a falha com **Try again**; o tema antes do primeiro estado.
6. **`features/welcome`**: as boas-vindas no shell, com a lateral nua, `This machine` e **Start**; o modo de boas-vindas no store e nos atalhos.
7. **`features/migration`**: a tela na forma decidida e **Copy the list**.
8. **`features/models/ModelChip.tsx`**: o menu com `Effort · <modelo>`, a marca `factory` quando pedida, a razão de indisponível, o menu que espera o catálogo.
9. **`components/system/`**: as peças da §5.3; o token `--col-placeholders`, no step que o usa.
10. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| History, a lista e os arquivados (`rest.md` §3, §4) | 11 | Os de hoje. Nas boas-vindas, **History** do rodapé segue a regra da §4.2 (As boas-vindas) |
| Os diálogos da task (Delete, Discard step, Back, Discard and restart), a pausa, a página do item que saiu nos casos da task (`rest.md` §9, §10) | 11 | Os de hoje |
| O aviso do app, `LeftoversNotice`, os toasts e o texto das notificações (`rest.md` §8, §11) | 11 | Os de hoje (task 2). O aviso continua recebendo as falhas sem lugar próprio; as desta task que ganham lugar (§4.2) deixam de ir a ele |
| **Edit the board in Settings…** do `⋯` do board | 5 | É da task 5, que o faz abrir Settings na página Boards (`openSettings("boards")`); esta task só garante que a página abre com o foco na navegação |
| O diálogo **Add to board** (a casca, o título, o rodapé) | 5 | O da task 5; esta task troca só a linha do repositório (`RepositoryLinkRow` sai) |
| A Home com **Continue**, **Start** e `Nothing in progress` | 5 | A da task 5; esta task só põe as boas-vindas no lugar dela no modo de boas-vindas |
| `ModelPicker` e `ReviewModePicker` | 12 | Defaults deixa de usá-los; continuam em `StepList`, `StartReviewDialog` e no diálogo de discussão até as tasks deles; a remoção é da 12 |
| O `CutCode` da conversa com a própria cópia (`features/chat/Markdown.tsx`, task 4) | 12 | Continua com a cópia dele; o `CopyButton` do system nasce aqui, e a 12 decide se o `CutCode` o adota |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| Settings é um lugar com quatro páginas, abre em Defaults, fecha para o lugar anterior; sem página de aparência, o tema só no rodapé | `decisions.md` 2026-09-25; `rest.md` §2.1; `changes.md` X1, X2 |
| Defaults salva na hora; os modelos agrupados por parte do workflow, a escolha mudada da fábrica marcada; o catálogo lendo deixa as escolhas à vista com brilho | `rest.md` §2.2; `changes.md` X3 |
| O diálogo de board tem três passos no Add e dois no Edit, com **Back**; a tabela de status; a consequência de cada repositório desmarcado; **Remove** por destino | `decisions.md` 2026-09-25; `rest.md` §2.4, §2.5; `changes.md` X5, X6 |
| Repositories começa pelo que bloqueia, agrupa por board, com as ações no `⋯`; a varredura põe os disponíveis primeiro | `rest.md` §2.6–§2.8; `changes.md` X7, X8 |
| Os prompts como lista numa página, os placeholders como etiqueta, **Reset to default…** | `decisions.md` 2026-09-25; `rest.md` §2.9; `changes.md` X9 |
| O início com os passos que bloqueiam, o lento com o tempo e a razão, a falha com **Try again**; nunca uma janela em branco | `rest.md` §5; `structure.md` §7; `changes.md` X17 |
| As boas-vindas com `This machine` só quando falta algo, `Ctrl+,` abrindo Settings | `decisions.md` 2026-09-25; `rest.md` §6; `changes.md` X2, X18 |
| A migração na janela inteira, com **Copy the list** | `rest.md` §7; `changes.md` X19 |
| Settings não tem primária; a de um diálogo é a confirmação; as destrutivas abrem em **Cancel** | `rest.md` §2.1, §13; `principles.md` 2; `components.md` Diálogo |

### 4.2 Decisões de design, detalhadas

#### Settings: o lugar, a navegação e a página

**O lugar** (`rest.md` §2.1). O cabeçalho do lugar (`LocationHeader`, task 2) com `←` (o destino no tooltip), o título `Settings` e, à direita, **Close** fantasma `sm` com a tecla `Esc` (tooltip `Close Settings and go back to <lugar anterior> · Esc`; sem lugar anterior, `Close Settings · Esc`). Fechar (**Close**, `Esc`, `Ctrl+,`, o botão pressionado do rodapé) volta ao lugar anterior, como hoje (`store/app-store.ts:1093–1097`). O botão **Settings** do rodapé fica pressionado (task 2). Trocar de página não empilha um lugar (`lib/locations.ts:76`).

**As páginas** são `SettingsSection` (`lib/locations.ts:5`): `defaults`, `boards`, `repositories`, `prompts` (novo: a lista) e cada `PromptStage` (um prompt aberto, na página Prompts). Um lugar guardado na forma de hoje (`{ section: "prd" }`) continua válido e abre o prompt. `openSettings()` abre `defaults`; `openSettings("boards")` é o que o `⋯` do board chama (task 5).

**O foco ao abrir.** Pelo clique no rodapé, o foco fica no botão, como toda ida pelo clique (`components.md` Troca de lugar). Por `Ctrl+,` e por um link de fora, o foco vai ao item da navegação da página aberta, para `↑` `↓` já agirem. Fechando, o foco vai ao título do lugar anterior (o de hoje); de volta às boas-vindas, ao título delas.

**O corpo** é uma área que rola; dentro, o par navegação e página numa grade `--snav-w | minmax(0, --measure)` com `--space-12` entre as duas, com `--space-8` no alto, `--space-6` dos lados e `--space-16` no pé. A página tem `--measure` (800 px): a largura máxima da caixa inclui as duas folgas (`--snav-w + --space-12 + --measure + 2 × --space-6`), e a margem da esquerda desconta o mesmo, centrando em pixel inteiro (`max(0px, round(down, (100% − --snav-w − --space-12 − --measure − 2 × --space-6) / 2, 1px))`). O mock pinta 752 px (§4.3 #28). Trocar de página volta a rolagem ao alto.

**A navegação** (`components.md` Navegação de Settings), `nav` `Settings`, fixa ao rolar (`position: sticky`, `top: --space-8`), `--space-0-5` entre os itens. Quatro itens, links com o ícone e o nome em `--text-ui`, `--size-control` de altura, `--space-2-5` dos lados, raio `--radius-sm`:

| Item | Ícone | Aberto quando |
|---|---|---|
| **Defaults** | `defaults` (os controles deslizantes) | `defaults` |
| **Boards** | `board` | `boards` |
| **Repositories** | `repository` | `repositories` |
| **Prompts** | `prompt` (a folha com o sinal de terminal) | `prompts` e qualquer prompt |

Estados: padrão `--ink-2` com o ícone em `--ink-3`; hover `--veil-hover` e `--ink-1`; pressionado `--veil-press`; aberto `--brand-tint-plane`, anel colado `--brand-ring`, ícone `--brand-ink`, peso 500, `aria-current="page"`; foco, o anel por fora. **Repositories** leva à direita `◇ N` (o `StateGlyph blocked` e a contagem em `--text-micro` `--ink-3`, `--ink-2` no aberto, tabular) quando algum repositório tem o clone inexistente (`missing`); N conta só esses: um repositório sem clone não é falta, é o normal de um repositório do board. O tooltip e a descrição acessível (`aria-describedby`): `The clone of acme/infra is missing` ou `The clones of 2 repositories are missing: acme/infra, acme/tools`. Sem nenhum, nada.

O teclado: a navegação é uma parada de Tab (o item aberto); `↑` `↓` vão ao item anterior e ao seguinte e abrem a página (a ativação automática das abas), `Home` e `End` às pontas, sem dar a volta. Uma edição de prompt não salva pede `Discard your changes?` antes de trocar (o `leave` de hoje, `store/app-store.ts:732–740`).

**A largura** (`rest.md` §2.1). Abaixo de 820 px de área principal (a container query `main`; a janela de 1100 dá 812), a grade vira uma coluna na medida `--measure`, centrada em pixel inteiro, com `--space-6` entre a navegação e a página; a navegação vira uma linha (os itens lado a lado, `--space-1` entre eles, quebrando se faltar lugar) sem `sticky`, e `←` `→` também trocam de página. Na metade do monitor (978 px) ela fica à esquerda, e a página encolhe a 674 px; a 812 px, a coluna tem 764. Abaixo de 720 px de área principal (a janela mínima, de 800 px, dá 512), a linha de Settings põe as ações da direita sob o texto, como o mock.

**A página** tem o cabeçalho (`components.md` Navegação de Settings, Página): o título em `--text-title` 600 (`h2`), abaixo a frase em `--text-body` `--ink-3` na medida `--measure-read`, `--space-1` entre os dois, e à direita, alinhada ao topo, a ação da página, secundária `sm` com o ícone `plus` (**Add board**, **Add repository**). `--space-8` entre o cabeçalho e as seções e entre as seções. Cada seção tem o título em `--text-caps` 700 `--ink-3` com `--tracking-caps` (`h3`), e ao lado, na mesma linha de base, a frase em `--text-meta` `--ink-3`; `--space-3` até o conteúdo. Settings não tem primária: a única é **Save** da edição de um prompt.

#### Defaults

Título `Defaults`, frase `What a new task, review or discussion starts with. A change applies to what you create after it; nothing that runs changes.` Tudo salva na hora.

**Review mode**, com `Who reviews the steps of a new task`. As duas opções do popover da task (`features/task/ReviewModePopover.tsx:25–37`, extraídas para `features/review-mode/ReviewModeOptions.tsx`, que o popover passa a usar) lado a lado numa grade de duas colunas iguais com `--space-2`, num `radiogroup` `Review mode of a new task`: cada opção com o ícone (`agentMode`, `manualMode`), o nome em 500, o que faz em `--text-meta` `--ink-3` e o visto à direita no escolhido; contornada por `--line-2`, raio `--radius-md`; a escolhida em `--brand-tint` com o anel `--brand-ring`. Abaixo de 820 px, uma coluna. `←` `→` e `↑` `↓` trocam, e trocar salva. Salvando: a opção nova fica escolhida, com o spinner no lugar do visto e `· saving…` depois do nome (`Manual · saving…`); o grupo fica `aria-busy` e ignora as setas até a resposta. Falha: a escolha volta à salva, e sob as opções, em `--state-error`, `role="alert"`: `Couldn't save Manual: <mensagem>` e **Try again** (o link de ação de `features/task/SaveFailure.tsx`), que refaz a escolha.

**Models**, com a frase `6 of 9 changed from the factory defaults` (`1 of 9 changed…`; nenhuma, `None changed from the factory defaults`; comparando cada padrão com o de fábrica, P34b). Quatro grupos, `--space-4` entre eles, cada um contornado por `--line-1`, raio `--radius-md`, `--space-1` em cima e embaixo, `role="group"` com o nome do grupo:

| Grupo (título) | Linhas, e a nota sob o nome |
|---|---|
| `Planning` | PRD, Tech spec, Plan, One-Shot planning |
| `Steps` | Implementation, Step review |
| `Pull request` | PR, PR review com `Also where a review of someone's pull request starts` |
| sem título (`aria-label="Discussion"`) | Discussion com `Where a new discussion starts` |

O título do grupo em `--text-micro` 500 `--ink-3`, `--space-1-5` × `--space-3` em cima. A linha: uma grade `1fr | auto`, altura mínima `--size-control` + `--space-2`, `--space-3` à esquerda e `--space-2` à direita, fio `--line-1` entre as linhas; o nome da etapa em `--text-ui` `--ink-1` (`modelStageLabel`, `lib/models.ts:154`) com a nota em `--text-micro` `--ink-3` embaixo; à direita, o `ModelChip` `sm`.

**O chip** (`components.md` Chip, Linha de modelo): a escolha mudada da fábrica é própria (`own`: `--ink-1`, 500, `--line-3`), com o tooltip `Factory default: Fable 5.1 · high`; a de fábrica fica quieta (`--ink-2`), com `The factory default`. O nome acessível: `PRD: Opus 5.5 (1M) · xhigh, changed from the factory default Fable 5.1 · high`, `PR: Opus 5.5 (1M) · medium, the factory default` e, indisponível, `Step review: Opus 4.1 · high, unavailable, changed from the factory default Opus 5.5 (1M) · high` (o `ModelChip` ganha o nome inteiro como propriedade; hoje ele monta `<rótulo> model: <escolha>`, `ModelChip.tsx:88`).

**O menu do chip** (`components.md` Select e menu, Modelo e esforço), em todo `ModelChip` do produto: o grupo `Model` (os modelos do catálogo, na ordem do CLI) e, depois de um separador, `Effort · <modelo>` (os esforços do modelo escolhido; hoje o título é só `Effort`, `ModelChip.tsx:140`); um modelo sem esforço diz `Haiku 4.5 has no effort levels.` no lugar dos itens. **Só em Defaults**, o modelo de fábrica leva à direita `factory` em `--text-micro` `--ink-3`, e o esforço de fábrica leva a marca só quando o modelo escolhido é o de fábrica (como o mock), e o pé do menu diz, em `--text-micro` `--ink-3`, `From the Claude Code installed here, read when MySpec opened.` Nos outros lugares o chip segue **Defaults** ou a task, e a fábrica não é referência (§4.3 #5).

**Os estados da linha** (`rest.md` §2.2):

| Estado | Forma |
|---|---|
| Salvando | O chip com o spinner e `Saving…`, `aria-busy`; o menu não abre |
| Falha ao salvar | O chip volta ao valor salvo. Sob a linha, na coluna inteira, `--text-meta` `--state-error`, `role="alert"`: `Couldn't save Opus 5.5 (1M) · high: <mensagem>` e **Try again** fantasma `xs`, que salva a mesma escolha de novo. Com o disco cheio, a mensagem do Go é `no space left on the disk of ~/.local/share/myspec. Free some space, then try again.` (§4.4) |
| Indisponível | `◇ Opus 4.1 · high · unavailable` (o `· unavailable` em `--ink-3` 400); tooltip e descrição `The installed Claude Code no longer lists Opus 4.1. A session still starts with it, and the CLI decides.`, ou, com o modelo listado e o esforço não, `The installed Claude Code doesn't offer max for Haiku 4.5. A session still starts with it, and the CLI decides.`, em todo `ModelChip` (hoje `Not in the models of the installed Claude Code`, `ModelChip.tsx:48`). O produto nunca troca a escolha |
| Lendo o catálogo | A escolha salva no chip com o brilho (`Shimmer`), sem spinner, `aria-busy`, e o menu não abre: o tooltip diz `Reading the models of Claude Code · the menu opens when it ends`, em todo `ModelChip` (hoje o menu abre com a escolha salva sozinha). No lugar da contagem da seção, `Reading the models of Claude Code…` com o brilho |
| Nenhuma leitura deu certo | Entre o título da seção e os grupos, a faixa de aviso afundada (`NoticeStrip`, nunca vermelha) com `◇`, o título em 500 e o texto em `--ink-2`, por causa: `not_found` `Claude Code was not found` · `Install it or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. The choices below stay as they are.`; `unsupported` `The installed Claude Code doesn't list its models` · `Update it, then reopen MySpec. The choices below stay as they are.`; `failed` `Couldn't read the models of Claude Code` · `Reopen MySpec to try again. The choices below stay as they are.` Os chips mostram as escolhas salvas; o menu mostra `catalogFailureMessage` (`lib/models.ts:130–141`) no lugar dos itens, como hoje |

No pé da seção, em `--text-meta` `--ink-3`: `A commit runs in the session of its step or of its pull request review, with that session's model and effort.`

#### Boards

Título `Boards`, frase `The GitHub projects your tasks start from, each with the repositories it manages.`, **Add board**. Os boards numa lista contornada por `--line-1`, raio `--radius-md`, em ordem alfabética de título (a de `app.boards`), fios `--line-1` entre as linhas.

**A linha** (`components.md` Linha de Settings), uma grade `--icon | 1fr | auto`, `--space-3` de folga e entre as colunas, alinhada ao topo; `li` com o nome `Platform Roadmap, acme, 6 repositories, read 2m ago` (`, the last reading failed` quando falhou):

- o ícone `board` em `--ink-3`;
- linha 1: o título em `--text-ui` 500, e depois o projeto como link externo `acme/projects/7 ↗` em `--text-meta` (`<dono>/projects/<número>`), tooltip `Open the project on GitHub · <URL>`;
- linha 2, `--text-meta` `--ink-3`, cortada com tooltip: `Organization · 6 repositories: api, billing, docs, gateway, sdk-js, web` (o tipo; `1 repository: api`; `No repositories`; os nomes curtos em ordem alfabética, ou `dono/nome` em todos quando algum repositório não é do dono do board, para dois `api` não se confundirem);
- linha 3: `Final: Done, Won't do, Duplicate · New cards: None` (os finais na ordem do board; nenhum, `Final: None`; o status de cards novos pelo nome, ou `None`); num board sem campo `Status`, `No Status field: its cards end when their issues close`;
- à direita, `--space-1-5` entre as peças: a idade da leitura, **Edit…** secundário `sm` (`Edit Platform Roadmap`) e **Remove…** fantasma `sm` (`Remove Platform Roadmap`).

**A idade da leitura** é o componente da task 5 (`ReadAge`, `tasks/05-board.md` §4.2, o cabeçalho do board), que esta task completa com as formas que ele não tem, para o produto ter uma idade só: `age`, `Read 2m ago` (`age` sobre `readAt`) em `--text-micro` `--ink-4`, tooltip `Last read at 14:08`, `Last read yesterday at 17:40`, `Last read Sep 21 at 17:40`; `reading`, `Reading…` com o spinner, `--ink-3`, `role="status"`; `never`, `Not read yet` (só em Settings; o cabeçalho do board não mostra nada); `failed`, `◇ Read failed 18m ago` em `--ink-2` (`age` sobre `failure.failedAt`), com a hora da falha no tooltip (`Failed at 13:52 · last read at 11:30`), em Settings e na linha de board da Home.

**A falha** (`rest.md` §2.3, `board.md` §3.8): nunca vermelha, nunca situação. Sob a linha, da coluna do texto à direita, a linha de bloqueio: afundada (`--surface-0`, raio `--radius-sm`, `--space-2` acima, altura mínima `--size-control-sm`, `--space-1` × `--space-3`), `--text-meta` `--ink-2`: `◇`, a mensagem de `features.md` §Falhas, `The last reading stays in use.` e **Try again** fantasma `xs` com o ícone `refresh`, que relê o board. Relendo: a idade diz `Reading…` com o spinner, e **Try again** dá lugar a `Reading…` com o spinner (`aria-busy`), como a faixa de aviso tentando (`components.md` Faixa de aviso). A faixa é `role="alert"` quando chega.

**O vazio.** Sem board: o estado vazio de página, alinhado à esquerda, `No boards yet` em `--text-ui` 600, `Add a board to start tasks from the cards of a GitHub project.` em `--ink-3` e, sob o texto, **Add board** secundário `sm` com `plus`: a ação do vazio é a saída dele, mesmo com o cabeçalho a tendo (`components.md` Estado vazio de página).

#### O diálogo de board

O `Dialog` do system, largo (`--size-dialog-wide`), a `8vh` do topo, em passos (`components.md` Diálogo). Título **Add board** ou **Edit board**; o subtítulo diz o board e o passo:

| Momento | Subtítulo |
|---|---|
| Add, passo 1 | `Step 1 of 3 · The project` |
| Add, passos 2 e 3 | `Data Platform · acme · Step 2 of 3 · Statuses`, `… Step 3 of 3 · Repositories` |
| Add sem campo `Status` | `Release Train · acme · Step 2 of 2 · Repositories` |
| Edit, lendo ou falhou | `Platform Roadmap · acme` |
| Edit, passos | `Platform Roadmap · acme · Step 1 of 2 · Statuses`, `… Step 2 of 2 · Repositories` |
| Edit sem campo `Status` | `Release Train · acme · Repositories` (um passo só não diz `Step 1 of 1`) |

O rodapé (`DialogFooter`): **Back** fantasma com a seta, a partir do segundo passo; o que falta ou a consequência em `--text-meta` `--ink-3`; a recusa em vermelho numa linha própria acima dos botões; **Cancel**; o primário com `Ctrl ↵`. **Back** volta ao passo anterior guardando tudo o que foi escolhido nos seguintes; voltar ao passo 1 do Add e **Continue** com a mesma URL não relê; uma URL mudada relê e começa as escolhas de novo. O foco começa no primeiro campo do passo (a URL; a primeira caixa da tabela; a primeira caixa habilitada dos repositórios), também depois de **Back** e **Continue**. Cada abertura relê o board. Confirmando: o primário diz `Adding…` ou `Saving…` com o spinner, e **Cancel** e **Back** ficam tracejados; um erro fica no rodapé, em vermelho, o diálogo aberto e o primário de volta (ele é o repetir).

**Passo 1, o projeto** (só no Add). O campo `URL of the GitHub project`, em mono, com a ajuda `github.com/orgs/<org>/projects/<n> or github.com/users/<user>/projects/<n>. Views and filters in the URL are fine.` **Continue** primário; tracejado com o campo vazio, com `Paste the URL of a GitHub project.` ao lado. `Enter` no campo lê. Lendo: o campo desabilitado, o rodapé diz `Reading the board…`, e **Continue** diz `Reading…` com o spinner. Recusa: o campo com a borda e o trilho de erro, `aria-invalid`, e a mensagem sob ele em `--state-error`, ligada por `aria-describedby`, com o foco de volta no campo: `This isn't the URL of a GitHub project.`, `<título> is already registered.` e as de `features.md` §Falhas, das quais a do board inexistente passa a dizer o que fazer: `The board doesn't exist or this account can't read it. Check the number and that this account can see the project.` (§4.4; o `gh auth refresh -s read:project` é o conselho da falta de escopo, outro motivo). O usuário corrige e lê de novo.

**Passo 2, os status.** A frase `Mark the statuses that end the work on a card, and the status a card published by a discussion starts in.` e a tabela (`components.md` Tabela de status), que rola dentro do corpo: o cabeçalho `Status` · `Ends the work` · `New cards` em `--text-caps` `--ink-3`; uma linha por opção, na ordem do board, com o nome, a caixa de seleção (o nome acessível `<status> ends the work`) e o rádio (`New cards start in <status>`); a última linha, `No status`, só com o rádio (`New cards start without a status`). Os rádios formam um grupo pelo `name`, sob o cabeçalho `New cards`, sem um elemento que os envolva: o corpo continua o da tabela. A pré-marcação é a de `features.md` §Cadastrar um board, e no Add, sob a tabela, a ajuda diz o que foi marcado pelo nome: `Done and To do are marked for you, from their names.` (os finais na ordem do board e depois o de cards novos, sem repetir; um, `Done is marked for you, from its name.`; nenhum, nada). **Continue**.

**No Edit, o board que mudou** (P32): no alto do passo, a linha afundada com `◇` (`components.md` Linha afundada, Nota): `The board changed since it was saved.` e depois as partes: `Archived is gone from its statuses` (as opções guardadas que sumiram, pelos nomes, `Archived and Blocked are gone…`), `QA is new, not marked` (`QA and Staging are new…`), ligadas por `, and ` e com ponto final; quando o status de cards novos sumiu, a frase ` New cards now start with no status.` no fim. A opção nova leva a etiqueta `new` ao lado do nome, desmarcada. O status de cards novos volta a `No status` quando a opção sumiu.

**Passo 3 (2 no Edit), os repositórios.** A frase `Check the repositories this board manages. They come from the issues on the board.` e a lista contornada que rola dentro do corpo, com uma linha por repositório (`components.md` Repositório de um board, no diálogo; componente `features/boards/BoardRepositoryRow.tsx`, que substitui `RepositoryLinkRow` também em **Add to board**): a linha que marca, com a caixa, `dono/nome` em 500, `N cards` em `--text-meta` `--ink-3` (`1 card`) e, à direita, cortado com tooltip, como ele fica ligado:

| Caso | Texto |
|---|---|
| Registrado, com clone | `Registered · ~/code/api` |
| Registrado, sem clone | `Registered · Not cloned` |
| Registrado, clone inexistente | `Registered · the clone at ~/code/infra is missing` |
| Um clone achado | `Clone found · ~/code/data-pipelines` |
| Dois ou mais | `Clone found · 2 clones:` e o `Select` do system `xs` com o clone escolhido em mono (os achados em ordem de caminho; o nome `Clone of acme/warehouse: ~/code/warehouse`). O `Select` fica fora do rótulo da caixa, como irmão dela: a linha que marca é a caixa e o nome, e o clique no seletor não marca |
| Nenhum achado | `Registered without a clone` |
| De outro board | A caixa tracejada, a linha em `--ink-4`, e `acme/api belongs to the board Platform Roadmap.` como razão (`aria-describedby`) |

Os caminhos passam por `displayPath` (`lib/paths.ts`). Sob a lista, o campo `owner/name` (mono, `Add a repository`) com **Add** secundário `sm`, tracejado com o campo vazio; `Enter` no campo acrescenta; checando, **Add** diz `Checking…`; a recusa sob o campo em vermelho (`Type the repository as owner/name.`, `<dono/nome> doesn't exist or this account can't read it.`). O acrescentado entra marcado, na ordem alfabética. **Add board** ou **Save**. Um board sem campo `Status` pula o passo 2 e abre este com a nota afundada `◇ This board has no Status field, so there are no statuses to mark: its cards end when their issues close.`

**O repositório desmarcado diz a consequência** (P31), só no Edit e só para um repositório do próprio board: a linha fica afundada (`--surface-0`), e embaixo, recuado até o nome, em `--text-meta` `--ink-2`, `→ ` e o texto:

- vai a No board (tem clone, tasks ou reviews): `Moves to No board: it has ` e as partes do que ele tem, na ordem `a clone`, `N active task(s)`, `N archived task(s)`, `N review(s)` (ativos e arquivados), só as que existem, ligadas por `, ` e ` and ` antes da última; depois `. Its tasks keep working.` com tasks, `. Its reviews keep working.` só com reviews, `. Nothing on disk changes.` só com o clone. Exemplos: `Moves to No board: it has a clone. Nothing on disk changes.`; `Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working.`;
- sai do produto: `Leaves MySpec: it has no clone, tasks or reviews.`

O texto é a descrição acessível da caixa. O rodapé soma, ao lado de **Save**: `acme/docs moves to No board, and acme/billing leaves MySpec.` (os nomes inteiros por destino, `a and b move to No board`, `a leaves MySpec`; um destino só, sem o `, and`; nada desmarcado, nada).

**Edit, lendo e falhando.** Ele abre relendo o board: o corpo com `Reading the board…` e o spinner (`role="status"`), o rodapé só com **Cancel**. Uma falha da releitura fica no corpo, em `--state-error`, `role="alert"`, e o rodapé ganha **Try again** primário `Ctrl ↵`, que relê (é o único caminho adiante), com o foco nele.

#### Remove board

O diálogo mínimo de confirmação (`alertdialog`), com o foco em **Cancel**: o título `Remove Platform Roadmap?`; o corpo com a frase de `features.md` montada pelas contagens, sem a parte que dá zero: `5 repositories move to No board and 1 leaves MySpec.`, `1 repository moves to No board.`, `2 repositories leave MySpec.`, num board sem repositório `The board has no repositories.`, sempre seguida de ` Tasks keep their cards, and nothing changes on GitHub or on disk.`; depois, a linha afundada em duas linhas (P31), cada destino só quando tem algum: `To No board: api, docs, gateway, sdk-js, web` e `Leaves MySpec: billing, with no clone, tasks or reviews` (os nomes curtos, em ordem alfabética, ou `dono/nome` em todos quando algum não é do dono do board; o rótulo em 500). **Cancel** e **Remove board**, perigoso. Enquanto a prévia é lida, o corpo diz `The board leaves MySpec.`, sem a linha afundada, e **Remove board** fica habilitado; se a prévia falha, o corpo continua assim, com a linha apagada `Couldn't tell what happens to its repositories: <mensagem>` (remover continua possível). Removendo: `Removing…` com o spinner e **Cancel** tracejado; um erro fica no rodapé, e o diálogo aberto.

#### Repositories

Título `Repositories`, frase `The repositories your tasks belong to, each tied to its local clone.`, **Add repository**.

**Os grupos** (`rest.md` §2.6), `--space-6` entre eles (o mock pinta `--space-5`, §4.3 #28), cada um com o título em `--text-meta` 600 `--ink-2`, a contagem em `--text-micro` `--ink-4` e, no primeiro, a nota em `--text-meta` `--ink-3`; `--space-2` até a lista contornada. Um grupo vazio não aparece. Na ordem:

1. **Needs a clone**, `3`, `Their cards can't start a task until they have one`: primeiro os sem clone, depois os de clone inexistente, cada parte em ordem alfabética de `dono/nome`;
2. um grupo por board, em ordem alfabética de título, com os repositórios dele que não estão no primeiro;
3. **No board**, com os que não têm board e não estão no primeiro.

Dentro dos grupos 2 e 3, a ordem é a alfabética de `dono/nome`.

**A linha**, uma grade `--icon | 1fr | auto | auto`, `--space-3` de folga; o nome acessível `acme/web, ~/code/web, 4 active tasks, 7 archived tasks, 1 review`:

- o ícone `repository` em `--ink-3`;
- linha 1: `dono/nome` em `--text-ui` 500;
- linha 2, `--text-meta` `--ink-3`: o caminho em mono `--ink-2` (`displayPath`), ou `Not cloned`; no grupo **Needs a clone**, o board antes (`Platform Roadmap · Not cloned`, `No board · ~/code/infra`); com instruções de review definidas, ` · Review instructions set` no fim;
- as contagens em `--text-meta` `--ink-3` tabular: `4 active · 7 archived · 1 review` (as tasks ativas, as arquivadas e os reviews ativos e arquivados somados, cada parte só quando não é zero), ou `No tasks or reviews`; abaixo de 820 px de área principal, elas descem para a linha 3;
- **`⋯`** fantasma de ícone `sm`, `More for acme/web`, tooltip `Change path, review instructions, remove`.

**As linhas de bloqueio**, sob a linha, com a forma da faixa dos boards e as ações da Home (`board.md` §2.2); as palavras são outras, porque a linha já nomeia o repositório:

| Caso | Linha | Ação |
|---|---|---|
| Sem clone | `◇ Its cards can't start a task until it's cloned.` | **Clone** fantasma `xs` com o ícone `clone`; sem pasta de clones escolhida, o seletor nativo abre antes (o de hoje) |
| Clonando | O spinner e `Cloning into ~/code/android…` (a pasta de clones e o nome; antes de a pasta existir, `Cloning…`), `role="status"` | — |
| O clone falhou | A mensagem do `gh` em `--state-error`, sem fundo, `role="alert"` | **Try again** fantasma `xs` |
| Clone inexistente | `◇ The clone is missing. Its tasks can't start a step or close until it has one.` | **Change path…** fantasma `xs` |
| Uma ação recusada | Sob a linha, em `--state-error`, sem fundo, `role="alert"`: `~/code/infra-old is a clone of acme/terraform, not of acme/infra.` (**Change path**, **Clone**), com os caminhos pelo `~` (§4.4) | — |

**O `⋯`** (`components.md` Menu do item), cujos itens, num repositório clonando, ficam desabilitados com `Cloning…` como razão, salvo **Review instructions…**: **Change path…**, que abre direto o seletor nativo (`Change the path of <dono/nome>`, o de hoje); **Review instructions…** com `None` ou `Set` como subtítulo; um separador; **Remove…** em `--state-error`. Com tasks ou reviews, **Remove…** fica desabilitado em `--ink-4` (nunca vermelho), com o motivo embaixo no próprio menu, em `--text-meta` `--ink-3`, ligado por `aria-describedby`: as partes `N active task(s)`, `N archived task(s)`, `N review(s)`, só as que existem, ligadas por `, ` e ` and `, e `: delete them first.` (`8 archived tasks and 4 reviews: delete them first.`).

**Review instructions…** abre sob a linha um bloco afundado (`--surface-0`, raio `--radius-md`, `--space-3`), com o rótulo `Review instructions`, a área de texto em mono `--text-meta`, 5 linhas, com o texto salvo e o foco no fim dele; a ajuda `Added to every pull request review of acme/web, the reviews of task pull requests included. A change applies from the next pass.`; **Cancel** fantasma `sm` e **Save** secundário `sm`, tracejado sem mudança (`Nothing changed yet.`). Mais de um bloco pode estar aberto. Salvando, `Saving…`; salvo, o bloco fecha e o foco volta ao `⋯`; uma falha fica no bloco, em vermelho, com **Save** como o repetir. `Esc` no bloco cancela (o evento é marcado, e Settings não fecha); **Cancel** e `Esc` descartam o texto e fecham, com o foco no `⋯`.

**Clone folder**, a última seção da página: o título `CLONE FOLDER` e `Where Clone puts a repository that isn't on this machine`; uma linha contornada por `--line-1`, raio `--radius-md`, com o valor em `--text-meta` (`Not chosen · you're asked the first time you clone` em `--ink-3`, ou o caminho em mono `--ink-2`) e **Choose…** secundário `sm`. Uma falha de **Choose…** fica sob a linha, em vermelho (hoje vai ao aviso do app).

**O vazio.** Sem repositório: `No repositories yet` em `--text-ui` 600 (o mock usa `--text-title`, §4.3 #28), `Add a clone from this machine, or add a board: the repositories of its issues come with it.` e, sob o texto, as duas saídas que ele oferece: **Add repository** secundário `sm` e **Go to Boards** fantasma `sm`, que abre a página Boards com o foco no item dela. A navegação não tem `◇`.

#### Add repository

O `Dialog` largo, `Add repository`, com o subtítulo `Pick the clones to register. The scan looks through your home folder, up to 6 folders deep.` Cada abertura varre de novo.

| Momento | Forma |
|---|---|
| Varrendo | `Scanning your home folder…` com o spinner, `role="status"`; **Add repository** tracejado com `Wait for the scan to end.`; o foco no diálogo, e no filtro quando a varredura termina |
| A varredura falhou | `Couldn't scan your home folder: <mensagem>` em `--state-error` e **Try again** fantasma `xs`, que varre de novo; **Browse…** continua valendo |
| Lista | A busca `Filter by name or path` (o `SearchInput` do system, largura inteira), com o foco. Primeiro os clones disponíveis, em ordem alfabética: a linha que marca, com `dono/nome` em 500 e o caminho em mono `--ink-3` (`displayPath`), e, quando o repositório está cadastrado sem clone (o `dono/nome` em `State.repositories` com `cloned` falso, sem maiúsculas), a linha `Registered without a clone: this links the clone to it.` embaixo, em `--text-meta` `--ink-2`. Depois, dobrados, os já registrados: o `Collapsible` `Already registered 9`, fechado, com as linhas desabilitadas (caixa tracejada) e o caminho. O filtro vale nos dois grupos. A lista rola dentro do corpo |
| Nada achado | `No GitHub clones were found in your home folder, up to 6 folders deep.` |
| Filtro sem resultado | `No repositories match.` |
| Confirmar | **Add repository**, **Add 2 repositories**; tracejado sem marca, com `Check the clones to add.`. Cadastra um por vez, na ordem da lista: a caixa da linha dá lugar ao spinner, e **Cancel** e **Browse…** ficam tracejados até o último da fila. Todos passando, o diálogo fecha. Uma recusa fica sob a linha, em vermelho, e a linha continua marcada; as que passaram ficam no lugar, desabilitadas, com `Registered` |
| **Browse…** | À esquerda do rodapé, fantasma com o ícone `folder`, tooltip `Pick a folder the scan didn't reach`. Abre o seletor nativo; cancelado, nada; aceito, o diálogo fecha; a recusa vai em vermelho na linha própria acima dos botões (`~/Downloads/site is not the root of a git repository.`) |

#### Remove repository

O diálogo mínimo, com o foco em **Cancel**: `Remove acme/docs?`; o corpo `The repository leaves MySpec and the board Platform Roadmap. Nothing is deleted on disk: the clone stays at ~/code/docs.` (sem board, sem ` and the board …`; sem clone, `Nothing is deleted on disk.`); com board, a linha apagada `A reading of the board suggests it again while its issues are there.`; **Cancel** e **Remove repository**, perigoso. O diálogo fica aberto até o fim, com `Removing…` e **Cancel** tracejado, e um erro no rodapé (hoje ele fecha antes e a falha vai ao aviso do app).

#### Prompts

**A lista.** Título `Prompts`, frase `The instructions each session starts with. A prompt you never edit follows the default of every new version of MySpec.` Os nove prompts (`features/settings/prompts.ts:10–48`, na ordem do workflow) numa lista contornada; cada linha é um link, uma grade `--icon | 1fr | auto | --icon`, `--space-3` de folga: o ícone `prompt`, o nome em 500, a descrição em `--text-meta` `--ink-3` (sem cortar), à direita `Default` em `--text-meta` `--ink-4`, ou a etiqueta editada `Edited Sep 20` (`--ink-1` com `--line-3`), e a seta `go` em `--ink-3`. Hover `--veil-hover`, pressionado `--veil-press`, foco o anel por dentro (a lista é contornada). A data vem de `ListPrompts` (P34), lida ao abrir a lista: `Edited today`, `Edited yesterday`, `Edited Sep 20`, `Edited Sep 20, 2025` de outro ano; o tooltip diz a hora inteira (`fullTime`). Lendo, a coluna da direita fica vazia, com o brilho numa barra curta; uma falha deixa a coluna vazia e põe sob a lista, em `--state-error`, `Couldn't read which prompts are edited: <mensagem>` com **Try again**, e cada prompt continua abrindo, porque a página dele lê o texto. Enter e o clique abrem o prompt.

**O prompt.** No alto, **← Prompts** fantasma `xs`, que volta à lista com o foco na linha do prompt. O cabeçalho da página: o nome em `--text-title` 600 e, editado, a etiqueta `Edited Sep 20`; a frase com a descrição e, editado, `Your version has 92 lines; the default of this version has 87.` (`1 line`); à direita, **Edit** secundário `sm` e, editado, **Reset to default…** fantasma `sm`. O texto num bloco contornado por `--line-1`, raio `--radius-md`, `--space-5` × `--space-6`, em Markdown (`features/chat/Markdown.tsx`, sem editá-lo), com cada placeholder conhecido (`PLACEHOLDERS`, `prompts.ts:65–98`) como a etiqueta mono de `components.md` (Placeholder), com o tooltip `Filled when the session starts`. No pé, em `--text-meta` `--ink-3`: `MySpec fills the placeholders when a session starts. A session that is running keeps the prompt it started with.` Lendo: o esqueleto de três linhas no lugar do bloco. A leitura falhou: a faixa de aviso local com `Couldn't read the PRD prompt`, a mensagem e **Try again** (a página não tem mais nada a mostrar; §4.3 #11). Nos dois, **Edit** e **Reset to default…** ficam tracejados, com `Reading the prompt…` ou a falha como razão. O foco: pela lista, no título da página; de volta da edição, em **Edit**.

**A edição.** No alto, **← PRD**, que age como **Cancel**. O título `Editing the PRD prompt`, a frase `Markdown. The placeholders are filled when a session starts.` Uma grade `1fr | --col-placeholders` com `--space-4`: a área de texto em mono `--text-code`, sem ligaduras, altura mínima de 24 linhas, crescendo com a coluna, com o foco no começo do texto; à direita, fixa ao rolar, a coluna **Placeholders** (o título em caixa alta, `The ones the default uses. Move or remove any of them.`, e cada placeholder do padrão como etiqueta, com o que ele vira em `--ink-2` e, nos três que o produto acrescenta sozinho, o que acontece sem ele em `--text-micro` `--ink-3`: `Without it, the initial context is added at the end.` e os de `what_to_commit` e `push`, os de `prompts.ts`). Um padrão sem placeholder diz `The default uses none.` Abaixo de 820 px, a coluna desce para baixo do editor e deixa de ser fixa. A barra fixa no pé da área que rola (`--surface-1`, fio `--line-1` em cima, `--space-3`): à esquerda `Unsaved changes` em `--text-meta` `--ink-3` quando o texto mudou; **Cancel** fantasma `sm`; **Save** primário `sm` com `Ctrl S`, tracejado sem mudança (`Nothing changed yet.`). Salvando, `Saving…`; uma falha fica na barra, no lugar de `Unsaved changes`, em vermelho: `Couldn't save the prompt: <mensagem>`, e **Save** é o repetir. Salvar um texto igual ao padrão apaga a edição, como hoje. Salvo, a página volta ao prompt com o foco em **Edit**.

**Reset to default…** abre o diálogo mínimo, com o foco em **Cancel**: `Reset the PRD prompt to the default?`, `Your edits are replaced by the default of this version, and the prompt follows the default of new versions again.`, a linha apagada `A session that is running keeps the prompt it started with.`, **Cancel** e **Reset prompt**, perigoso (`Resetting…`; o erro no rodapé). Depois, o foco em **Edit**.

**Sair com edição não salva** (outra página, **← PRD**, **Cancel**, `Esc`, fechar Settings, abrir um item, uma notificação): o diálogo mínimo, com o foco em **Keep editing**: `Discard your changes?`, `The edits to the PRD prompt haven't been saved.`, **Keep editing** e **Discard**, perigoso. É o `leave` de hoje, no `Dialog` do system.

#### O início do app

Antes do primeiro estado, a janela nunca fica em branco (`rest.md` §5). A janela abre antes de o Go abrir os dados (P35), e o app mostra o início até o Go dizer que terminou.

**A lateral** em esqueleto, `aria-busy`, aparece na hora: o topo com a marca e `MySpec` (sem **New** e sem `«`); no lugar da árvore, três nós e duas linhas sob cada um em barras de `--surface-0` com o brilho, `role="status"` `Loading your work`; o rodapé só com o seletor de tema. Com a faixa recolhida guardada (`SIDEBAR_RAIL_KEY`), o esqueleto é a faixa de 60 px, com três blocos de brilho e o seletor de tema no pé, para nada saltar no `ready`.

**O tema antes do estado.** O script de `index.html:7–16` já pinta o último modo efetivo guardado (`myspec.theme`, gravado por `useApplyTheme.ts:12–25`), ou o `prefers-color-scheme`, antes da primeira pintura. O defeito é outro: sem estado, `useThemeState` (`store/app-store.ts:1377–1384`) devolve `system` com `systemDark` falso, e `useApplyTheme` pinta e grava claro, então um usuário no escuro veria o início claro. Antes do primeiro estado, `useApplyTheme` não pinta nem grava: vale o que `index.html` aplicou. A cada estado aplicado, a interface guarda também a preferência (`myspec.theme.preference`). `GetStartup()` traz `systemDark`, lido pelo portal antes da janela, o mesmo que pinta o fundo dela. O seletor mostra e alterna a preferência guardada, aplica o modo na hora, e `SetTheme` vai no `ready` quando a preferência mudou.

**A área principal** aparece só depois de 400 ms sem `ready`, para uma abertura normal, de algumas centenas de milissegundos, não piscar a marca, o título e os passos; a falha e a migração aparecem na hora. Na medida `--measure-read`, centrada em pixel inteiro, com `--space-16` + `--space-8` no alto e `--space-8` entre as partes, `role="status"` `aria-live="polite"`: a marca grande (`--space-8` de lado, raio `--radius-md`), `Starting MySpec…` em `--text-display` 600, e a lista dos passos, `--space-2` entre eles, cada um uma grade `--icon | 1fr | auto` em `--text-ui`:

| Passo | Quando aparece | O que cobre |
|---|---|---|
| `Opening your data` | Sempre, primeiro | A sonda do diretório de dados, o banco com as migrações, as configurações, os prompts, as conversas, a leitura do que está guardado (repositórios, boards, tasks, reviews, discussões) |
| `Checking the clones of 12 repositories` (`the clone of 1 repository`) | Quando o primeiro termina, com algum repositório com caminho (N conta os que têm caminho, os de clone inexistente incluídos) | O teste de cada caminho cadastrado; depois dele, em silêncio, antes do `ready`, `attention.Sync`, `worktrees.Sync` e as flows, que leem `Missing` e por isso vêm depois do teste |

Um passo feito tem o visto `--icon-sm` em `--ink-3` e o texto em `--ink-1`; o que roda, o spinner e o texto em 500; o que ainda não começou, o círculo e o texto em `--ink-3`. O que não bloqueia (a leitura do catálogo, que tem a última guardada) não entra. **Um passo lento** (acima de 3 s) mostra à direita, em `--text-meta` `--ink-3` tabular, o tempo, refeito a cada segundo (`12s`; acima de um minuto, `1m 15s`, o `duration` de `lib/when.ts`), e, no dos clones, a razão: ` · ~/code/infra doesn't answer`, o primeiro caminho cujo teste passou de 3 s. O início não tem prazo total: o `startupTimeout` de hoje (10 s para todo o trabalho antes da janela, `internal/app/app.go:52–53, 127`) sai, e cada chamada ao banco ganha o próprio `callTimeout`; um clone que demora 12 s não derruba o início.

**A falha.** A lateral fica em esqueleto parado, sem brilho e sem `role`. A área, `role="alert"`: o glifo de erro (`StateGlyph error` de `--space-4`), `MySpec couldn't start` em `--text-display`, o texto do caso em `--text-body` `--ink-2`, o erro num bloco de código copiável (afundado, raio `--radius-md`, o cabeçalho `error` com **Copy** fantasma de ícone `xs`, `Copy the error`, e o erro em mono com os caminhos pelo `~`), e **Try again** primário com `Enter`, com o foco. O caso vem da sonda que abre o primeiro passo (`os.Open` do diretório de dados e a criação e a remoção de um arquivo temporário nele), que devolve o `syscall.Errno`, porque o SQLite devolve `unable to open database file` sem o `errno` e `errors.Is(err, fs.ErrPermission)` não o reconhece. Os textos levam o diretório de dados e o log resolvidos (o XDG do usuário), pelo `displayPath`; os exemplos são os caminhos padrão. Os casos:

| Caso (a causa do erro) | Texto |
|---|---|
| Permissão negada nos dados (`EACCES` ou `EPERM` na sonda) | `MySpec can't open its data. Nothing was changed: your tasks, documents and worktrees are as they were. Give your user back the folder ~/.local/share/myspec, then try again.` |
| Disco cheio (`ENOSPC` na sonda, ou `SQLITE_FULL` depois) | `MySpec can't open its data: the disk of ~/.local/share/myspec is full. Free some space, then try again.` |
| Qualquer outra | `MySpec couldn't finish starting. If trying again fails the same way, the log at ~/.local/state/myspec/myspec.log says what happened before it.` |

**Try again** volta aos passos na hora e recomeça o início desde o primeiro, no mesmo processo. `Enter` aciona **Try again** com o foco nele ou no corpo; com o foco em **Copy** ou no seletor de tema, `Enter` é desse botão. Uma falha antes da janela (criar os diretórios, abrir o log) continua saindo com o erro no terminal, como hoje (`internal/app/app.go:102–115`): não há janela nem log onde mostrá-la. Uma migração recusada termina o primeiro passo e abre a tela da migração.

#### As boas-vindas

As boas-vindas são a Home enquanto nenhum board e nenhum repositório estão cadastrados e nenhum item está ativo (`rest.md` §6), dentro do shell, e não mais uma tela à parte (`App.tsx:41–45`).

**O modo de boas-vindas** (o store): sem board, sem repositório e sem item ativo, os lugares válidos são a Home (as boas-vindas), Settings e, com algo arquivado, History e os arquivados; qualquer outro lugar na tela vira a Home, e as pilhas de voltar e avançar guardam só lugares válidos (hoje o estado força a Home e limpa tudo, `store/app-store.ts:772–786`). Uma discussão ativa sobrevive à remoção do board dela e vai a **No board** (`features.md` §Discussão): com ela, o app é o shell normal, com a árvore e a Home normal, e nunca o modo de boas-vindas, que esconderia um trabalho vivo que ainda notifica. `Ctrl+,`, `Esc` (fechando Settings) e `Alt+←` `Alt+→` agem; `Ctrl+N`, `Ctrl+J` e `Ctrl+E` continuam inertes (`app/useGlobalShortcuts.ts:13–19`). Cadastrado o primeiro board ou repositório, o lugar na tela fica: a Home dá lugar à Home do app, com `Nothing in progress` (a da task 5), com o foco no título dela (`h1`, `tabindex="-1"`), porque a linha que abriu o diálogo sumiu; Settings continua Settings.

**A lateral** tem só o topo e o rodapé: o topo com a marca, `MySpec` e **New** tracejado (`Register a board or a repository first`, no tooltip e na descrição), sem `«` (a escolha da faixa recolhida fica guardada e volta depois do primeiro cadastro); nem filtro, nem árvore; o rodapé com **History**, o tema e **Settings**. **History** fica tracejado com `Nothing archived yet` quando nada está arquivado, e funciona como sempre quando algo está (as discussões arquivadas de um board removido).

**A área principal**, a coluna do início (a mesma medida, o mesmo alto), de cima para baixo:

1. a marca grande, `Welcome to MySpec` em `--text-display` 600 (o `h1` do lugar, com `tabindex="-1"`, que recebe o foco na volta de Settings; **Add board** só o recebe quando as boas-vindas aparecem) e `MySpec runs Claude Code through a task, from the card on your GitHub board to the merged pull request. Register where your work lives to start.` em `--text-body` `--ink-2`;
2. **This machine**, só quando falta algo;
3. **Start**, com as duas linhas de início (`components.md` Continue e linha de início), sem tecla, o subtítulo podendo ir a duas linhas: **Add board** (ícone `board`, `A GitHub project. Its cards start tasks, and the repositories of its issues come with it.`), com o foco, e **Add repository** (ícone `repository`, `A clone on this machine, for tasks without a board.`), que abrem os diálogos das seções acima.

As seções têm o título em caixa alta de `--text-caps` 700 `--ink-3`, como na Home. O aviso do app fica no topo da área principal, como em todo lugar.

**This machine** (P36), uma lista com `--space-2`, cada item uma grade `--icon | 1fr`: o `◇` alinhado à primeira linha, o que falta em `--text-ui` 500 `--ink-1`, o que fazer em `--text-meta` `--ink-3` e, quando há, o comando em mono como etiqueta com **Copy** fantasma de ícone `xs` (`Copy gh auth login`). Na ordem:

| Falta | Texto | Comando |
|---|---|---|
| O Claude Code não foi achado nesta execução | `Claude Code was not found` · `Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. You can register boards and repositories meanwhile.` | — |
| O `gh` não instalado | `The GitHub CLI isn't installed` · `MySpec reads boards and pull requests through it. Install it and sign in, then add a board.` | `gh auth login` |
| O `gh` sem login | `The GitHub CLI isn't signed in` · `Sign in from a terminal, then add a board. Adding a repository works without it.` | `gh auth login` |

As boas-vindas pedem a checagem ao montar, quando o `modelCatalog` do estado muda (a leitura do catálogo roda em segundo plano depois do `ready`, e o caso que o bloco existe para cobrir é a primeira execução numa máquina sem Claude Code) e sempre que a janela volta ao foco (o usuário resolve num terminal e volta). O Claude Code é `not_found` quando a leitura desta execução falhou com `not_found`; `found` quando ela deu certo ou deu `unsupported`, porque o executável existe; `unknown` quando ela ainda lê ou falhou por outra causa. O critério vale item a item: o bloco aparece se algum item falta, e um item `unknown` não aparece.

#### A migração recusada

**MySpec couldn't be updated** ocupa a janela inteira, sem a lateral e sem atalhos (`rest.md` §7), numa coluna na medida `--measure-read`, centrada em pixel inteiro, com `--space-16` no alto e `--space-5` entre as partes; pinta com o tema da interface guardado, ou o do sistema (hoje sempre claro, `internal/app/refused.go:42–44`). De cima para baixo:

1. a marca e `MySpec`; o título em `--text-display` 600;
2. o texto de hoje (`MigrationRefused.tsx:36–38`) em `--text-body` `--ink-2`;
3. um bloco afundado por tipo de caso (`--surface-0`, raio `--radius-md`, `--space-4`), na ordem de `migration-text.ts:10`: o título em `--text-ui` 600, o que fazer em `--text-meta` `--ink-2`, e cada caso separado por um fio `--line-1`: o lugar em mono (`~/work`, `~/work/legacy-portal`, `acme/api`), o detalhe em `--text-meta` `--ink-3` (`The origin remote is not on GitHub: git@gitlab.com:acme/legacy-portal.git`), e as tasks recuadas em `--space-4`, cada uma com o nome em mono e ` · ` e a área de trabalho ou o caminho em `--ink-3` (o que o DTO tem; o mock escreve a etapa, que o DTO não traz, §4.3 #13);
4. `Once they're resolved, open this version again and the update runs again.`;
5. **Copy the list**, secundário `sm` com o ícone `copy` (a ação da página, `components.md` Marca e cópia): copia o texto da §4.4 e passa a `Copied` com o visto por 2 s; sem acesso à área de transferência, `Can't copy · select the text` em `--state-error`, como o bloco de código.

#### O teclado e o foco

| Tecla | Onde | Ação |
|---|---|---|
| `Ctrl+,` | Qualquer lugar, as boas-vindas incluídas | Abre ou fecha Settings |
| `Esc` | Settings, fora de um campo que o use | Fecha Settings para o lugar anterior |
| `↑` `↓` `Home` `End` | A navegação | Trocam de página; `←` `→` também com a navegação em linha |
| `Enter` | O campo da URL; o de `owner/name` | Lê o board; acrescenta o repositório |
| `Ctrl+Enter` | Um diálogo de Settings | O primário; um diálogo destrutivo não confirma por ele (`decisions.md` 2026-10-02) |
| `Esc` | Um diálogo, um menu, o bloco das instruções | Fecha, cancela, e devolve o foco a quem abriu |
| `Ctrl+S` | A edição de um prompt | Salva |
| `Esc` | A edição de um prompt | **Cancel**, com `Discard your changes?` quando há mudança |
| `Enter` | O início que falhou, com o foco em **Try again** ou no corpo | **Try again** |

O foco inicial: a página aberta por `Ctrl+,` ou por um link, o item dela na navegação; Add board, o primeiro campo do passo; Edit board, **Cancel** enquanto lê e o primeiro campo depois; Add repository, o filtro; Remove board, Remove repository e **Reset to default…**, **Cancel**; `Discard your changes?`, **Keep editing**; a edição, o começo do texto; as boas-vindas, **Add board** quando aparecem, e o título delas na volta de Settings; o primeiro cadastro pelas boas-vindas, o título da Home; a falha do início, **Try again**. Um diálogo fechado devolve o foco ao botão que o abriu; um board ou um repositório removido leva o foco ao título da página.

#### A primária por cena

| Cena | Primária |
|---|---|
| Defaults, Boards, Repositories, a lista e o prompt | Nenhuma |
| A edição de um prompt | **Save** |
| O diálogo de board | **Continue**, **Add board**, **Save**; no Edit que falhou, **Try again** |
| Add repository | **Add repository** / **Add N repositories** |
| Remove board, Remove repository, **Reset to default…**, `Discard your changes?` | Nenhuma: a confirmação é perigosa |
| O início | Nenhuma; na falha, **Try again** |
| As boas-vindas, a migração | Nenhuma |

#### Acessibilidade

A navegação é `nav` `Settings` com links e `aria-current="page"`; o `◇ N` é a descrição de **Repositories**. Cada página tem o `h2`, e as seções o `h3`. Os grupos de modelos são `role="group"` com o nome; cada chip tem o nome inteiro da §4.2. A tabela de status é uma `table` com o cabeçalho de colunas, as caixas e os rádios com os nomes da §4.2. A linha de repositório do diálogo tem a razão ou a consequência por `aria-describedby`. As linhas de bloqueio que chegam são `role="alert"`; o clonando e a releitura, `role="status"`. O esqueleto do início é `role="status"`, e a lista dos passos `aria-live="polite"`. Todo botão tracejado tem a razão por `aria-describedby`. Os testes acham cada peça por `getByRole` com o nome inteiro desta seção.

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | "O aviso de clone abre Repositories" (`rest.md` §2.1, `structure.md` §1), sem aviso que o faça: o item da árvore muda o caminho direto (`structure.md` §2) | Sai. O único link de fora é **Edit the board in Settings…** | `rest.md` §2.1; `structure.md` §1 |
| 2 | A janela abre depois de o Go carregar tudo (`app.go:313–332`) e sai sem janela numa falha (`fail`, `app.go:557`): o início decidido não aparece | A janela abre antes dos dados (P35), com o início e a falha nela; **Try again** recomeça no mesmo processo | `backend.md` P35; `decisions.md` |
| 3 | Os passos do início sem lista fechada, e o prazo de 10 s de hoje, que derrubaria o exemplo aprovado de 12 s | `Opening your data` e `Checking the clones of N repositories`, o segundo com algum caminho; lento acima de 3 s; a razão só no dos clones; sem prazo total, cada chamada ao banco com o seu; o teste dos clones antes das flows; a área principal depois de 400 ms | `rest.md` §5; `backend.md` P35 |
| 4 | O texto da falha do início servia só à permissão, e `fs.ErrPermission` não reconhece a falha do SQLite | Uma sonda do diretório de dados antes do banco; um texto por caso, com os caminhos resolvidos; `Nothing was changed` só onde é verdade | `rest.md` §5 |
| 5 | A marca `factory` e `Effort · <modelo>` sem dizer onde valem | `Effort · <modelo>` e a razão de indisponível em todo `ModelChip`; `factory` e o pé do menu só em Defaults, o esforço marcado só com o modelo de fábrica escolhido | `components.md` Select e menu, Linha de modelo |
| 6 | O menu do chip durante a leitura do catálogo | Não abre em nenhum lugar; o tooltip diz por quê | `components.md` Chip; `changes.md` X3 |
| 7 | O `◇ N` sem dizer o que conta | Só os clones inexistentes | `components.md` Navegação de Settings; `rest.md` §2.1 |
| 8 | A página Boards vazia, sem forma | `No boards yet` com **Add board** sob o texto, e o vazio de Repositories com **Add repository** e **Go to Boards**, pela regra do vazio (`components.md` Estado vazio de página) | `rest.md` §2.3, §2.6 |
| 9 | **Save** das instruções primário no mock, contra "Settings não tem primária" | Secundário; vários blocos podem ficar abertos; `Esc` cancela | `rest.md` §2.6 |
| 10 | O Edit que falha ao reler só com **Cancel** (hoje) | **Try again** primário no rodapé | `rest.md` §2.4; `changes.md` X5 |
| 11 | A leitura de um prompt que falhou, "dispensável" | Com **Try again**, porque a página fica sem nada | `rest.md` §2.9 |
| 12 | O ligar de um repositório registrado com clone inexistente, ausente da tabela do passo 3 (o mock o escreve) | `Registered · the clone at <caminho> is missing` | `rest.md` §2.4 |
| 13 | A tarefa da migração com a etapa (mock), que `MigrationTask` não traz | A área de trabalho ou o caminho, como hoje; a migração é de uma versão antiga e nenhum banco atual a pede | `rest.md` §7 |
| 14 | `Its task can't start a step…` no singular | `Its tasks can't start a step or close until it has one.` | `rest.md` §2.6 |
| 15 | `Read yesterday` na linha do board (`rest.md`) contra `Read 1d ago` da task 5, e `Trying…` contra `Reading…` | A idade da task 5, completada com `never` e `failed`, uma só no produto; `Reading…` | `rest.md` §2.3 |
| 16 | `Clone found · 2 clones` sem dizer onde se escolhe | O texto e o `Select` com o escolhido na mesma linha | `rest.md` §2.4 |
| 17 | A ajuda da pré-marcação fixa (`Done and To do…`) | Montada com os nomes pré-marcados; some sem nenhum | `rest.md` §2.4 |
| 18 | A nota do board que mudou só pelo exemplo | A fórmula da §4.2, com o status de cards novos que sumiu | `rest.md` §2.4 |
| 19 | A frase de remoção com uma parte zero (`and 0 leave MySpec`, hoje) | Sem a parte zero; `The board has no repositories.` | `rest.md` §2.5 |
| 20 | A soma do rodapé e a consequência só pelos exemplos | As fórmulas da §4.2 | `rest.md` §2.4 |
| 21 | As boas-vindas sem dizer se History, Settings e os atalhos valem, e o que os lugares viram; e uma discussão ativa de um board removido, que o modo esconderia | O modo de boas-vindas da §4.2, só sem item ativo | `rest.md` §6; `structure.md` §7 |
| 22 | A ordem dos itens de `This machine` e quando a checagem roda (a leitura do catálogo ainda corre quando as boas-vindas montam) | O Claude Code primeiro; ao montar, quando o catálogo muda e ao voltar o foco; o login pelo `gh` local; `unsupported` conta como achado | `rest.md` §6; `backend.md` P36 |
| 23 | O tema antes do primeiro estado: `index.html` já aplica o guardado, mas `useApplyTheme` pinta claro sem estado | `useApplyTheme` espera o estado; a preferência guardada; `systemDark` no retrato do início; a escolha vai no `ready`; o esqueleto na faixa quando ela está guardada | `rest.md` §5 |
| 24 | Remove repository fecha antes e manda a falha ao aviso; a prévia de Remove board também | Os dois ficam abertos até o fim, com a falha no rodapé; a prévia que falha diz isso no corpo | `rest.md` §2.5, §2.8; `changes.md` X6, X8 |
| 25 | A mensagem do board inexistente sem o que fazer (`features.md` §Falhas) contra o exemplo de `rest.md`, que repetia o conselho da falta de escopo | O Go passa a dizer `… Check the number and that this account can see the project.`, em todo lugar | `rest.md` §2.4; `changes.md` X5; §4.4 |
| 26 | O retrato dos status "como guardados": o produto só guarda os ids dos finais, e a leitura de cada abertura do board já traz as opções novas | A migration grava as opções no cadastro e na edição; os boards de antes ganham o retrato da última leitura boa, com a guarda de `json_valid` | `backend.md` P32 |
| 27 | Os padrões de fábrica, que o `State` não traz | `State.modelFactory` (P34b) | `backend.md` P34b |
| 28 | Divergências do mock | Vale o material em tudo o que ele diz (`implementation.md:18`). As conhecidas: **Save** das instruções secundário; `Read 1d ago` de `Internal Tools`; o `prd_path` sem `Without it…` (só os três de `prompts.ts`); os textos dos placeholders os de `prompts.ts`; a etapa das tasks da migração; o texto do menu sem catálogo (o de `catalogFailureMessage`); a ajuda do passo 3 sobre os dois clones, que sai (a linha diz); o diálogo largo de 576 px da task 5 (o mock pinta 544); a página de 800 px (o mock pinta 752); `--space-6` entre os grupos de Repositories (o mock pinta `--space-5`); o título dos vazios em `--text-ui` 600 (o mock usa `--text-title`); a leitura de `Mobile App` às 11:30 (o mock diz 11:02) | `implementation.md:18` |
| 29 | A crítica da entrada (`research/critique-task-10-input.md` L1–L13 e os ajustes) | O modo de boas-vindas só sem item ativo; o início sem prazo total, o teste dos clones antes das flows, a sonda do diretório de dados, os caminhos resolvidos, a área principal depois de 400 ms, o esqueleto na faixa guardada, o tema que espera o estado; o plano sem meio-caminho (o system no step 3, o início em 4a e 4b, a lista de Prompts no 5, o token no 10); `This machine` que reage ao catálogo; os vazios com a ação; a página de 800 px e a regra de 720 px; `json_valid`; os destinos do foco; `Reading…` e `ReadAge` com `never` e `failed`; o esforço de fábrica, o nome do chip indisponível e mudado, o modo de review que espera, **Edit** tracejado lendo o prompt, **Cancel** e **Browse…** tracejados no cadastro, o `⋯` de um repositório clonando, **Remove board** habilitado lendo a prévia, `dono/nome` quando os nomes curtos se repetem, `1m 15s`, o N dos clones, o `Select` fora do rótulo; a frase do board inexistente sem o conselho do escopo; o acesso preguiçoso de P35 | §4.2, §4.4, §6, §8; `rest.md`; `components.md`; `structure.md`; `changes.md` X3, X5, X18, X19; `backend.md` P32, P35, P36 |

### 4.4 O que o tech spec toma

- **P31.** `BoardRepositoryOption` ganha `release` (`no_board`, `leave` ou `""`), preenchido em `PreviewEdit` (`internal/board/service.go:550–593`) para cada repositório do próprio board, pela mesma regra de `releases` (`service.go:882–893`: sai do produto sem clone e sem tasks nem reviews), extraída numa função por repositório que as duas usam. `BoardRemoval` (`dto.go:1058–1061`) ganha `toNoBoardNames` e `removedNames` (`dono/nome`, em ordem alfabética), que `RemovalPreview` (`service.go:707–720`) já percorre. O texto da consequência sai do frontend, com o `Repository` do `State` (clone e contagens).
- **P32.** Uma migration acrescenta `boards.saved_statuses` (JSON `[]Option`, o mesmo que `Reading.Statuses` serializa; `''` antes): `Add` e `Update` gravam as opções do campo `Status` salvas; a migration preenche os boards existentes com as opções da leitura guardada, com a guarda do JSON, porque `reading` é `''` antes da primeira leitura e `json_extract('', …)` daria erro, e uma migration que falha é o início que falha: `CASE WHEN json_valid(reading) THEN coalesce(json_extract(reading, '$.statuses'), '') ELSE '' END`. `migrate_test.go` prova a leitura válida, a vazia e a inválida. Os boards de antes ganham o retrato da última leitura boa, não o do cadastro: a nota pode deixar de dizer uma mudança feita entre o último **Save** e essa leitura, mas nunca inventa uma; os nunca lidos ficam sem retrato até o próximo **Save**. `PreviewEdit` compara o relido com o retrato e devolve `goneStatuses` (os nomes que sumiram) e `newStatusIds`; `newCardStatusGone` vem do id guardado (`new_card_status`) e vale também sem retrato, como os finais que sumiram, achados pelos ids de `final_statuses` (só os nomes deles e as opções novas precisam do retrato). O número do arquivo é o livre no merge.
- **P34.** O `Prompt` ganha `editedAt` (a hora do arquivo da edição em RFC 3339, `""` sem edição), `lines` e `defaultLines` (as linhas do texto e do padrão, sem contar a quebra final), para a regra das linhas ficar num lugar só; `SettingsService.ListPrompts()` devolve, para os nove, `stage`, `modified` e `editedAt`, lendo só o `stat` dos arquivos (`internal/prompts/prompts.go:354–377`).
- **P34b.** `State.modelFactory`, os padrões de fábrica de cada etapa (`models.Factory()`, `internal/models/models.go:92–105`) na ordem de `models.Stages`.
- **P35, o início.** Hoje `Run` abre o banco, monta os services e carrega tudo antes de criar a janela, e o Wails só aceita services antes de `Run` (`RegisterService` depois dele é descartado, `wails/v3@v3.0.0-beta.23/pkg/application/application.go:549–569`). `options()` também avalia métodos e passa services por valor (`a.discussions.DocumentOfCard`, `a.reviewFlow`, `a.prReviews`, `a.pulls`, `a.worktrees`, `a.attention`; `internal/app/app.go:365–382`), o que, registrado antes do início, prenderia receptores nulos. A forma, decidida: `Run` resolve os diretórios e o log, lê o esquema de cor do sistema pelo portal, cria o app do Wails com todos os services registrados, e abre a janela; cada binding recebe um acesso aos services do domínio que devolve `MySpec is starting` antes do `ready`, sincronizado, porque o Wails chama os métodos de outras goroutines; o trabalho que hoje vem antes da janela roda numa goroutine de início, sem prazo total (cada chamada ao banco com o seu `callTimeout`), na ordem: a sonda do diretório de dados, o banco, as configurações, os prompts, as conversas, as leituras do banco (`repositories`, `boards`, `tasks`, `pulls`, `prReviews`, `discussions`), o teste dos clones, e depois `attention.Sync`, `worktrees.Sync` e as flows, que leem `Missing` (`internal/flow/pr.go:121`, `internal/discussionflow/start.go:210`); só então diz `ready`. O formato de cada construtor em `options()` não muda, e o rebase das outras tasks continua textual. Um `StartupService` novo expõe `GetStartup()` (os passos com o nome, o estado, `startedAt` e `detail`, e a falha com o caso e o erro) e `TryAgain()`, e o evento `startup:changed` leva o mesmo retrato. O frontend assina o evento, pede o retrato, e ao `ready` segue o `bootstrap` de hoje (`app/bootstrap.ts:26–64`). `GetStartup()` traz também `systemDark`. A falha fecha o que a tentativa abriu (o banco, os watchers) antes de dizer `failed`, e **Try again** roda tudo de novo; nenhuma falha possível acontece depois de uma sessão começar (as leituras vêm antes das flows, `app.go:400–436`). `repository.Service.Sync` separa a leitura do banco do teste dos clones, com o progresso por caminho. A migração recusada vira o fim do primeiro passo: `runRefused` (`refused.go`) sai, e o `StateService` devolve o `RefusedState`. O tipo da falha vem da sonda do diretório de dados (`os.Open` e a criação e a remoção de um arquivo temporário, que devolvem o `syscall.Errno`: `EACCES` e `EPERM` são permissão, `ENOSPC` é disco cheio), depois do código `SQLITE_FULL`, e o resto. Fechar a janela durante o início cancela o contexto dele, e o `shutdown` (`app.go:508–540`) fecha só o que a tentativa abriu; os `defer` de hoje em `Run` (o log, o banco, o `pollPRs`) passam a dois tempos, antes e depois do `ready`. Com `application.New` antes do banco, uma segunda instância sai antes de abrir o banco e rodar as migrations (hoje sai depois delas), o que `target-machine.md` registra. O step 4a prova na máquina alvo que a janela abre antes do banco e que a primeira chamada depois do `ready` responde.
- **P36.** `SettingsService.CheckMachine()` devolve `claude` (pela leitura do catálogo desta execução, que `models.Service` passa a guardar ao lado da falha mascarada de `CatalogFailure`, `internal/models/service.go:114–122`: `not_found` quando ela falhou com `not_found`; `found` quando deu certo ou deu `unsupported`; `unknown` quando ainda lê ou falhou por outra causa) e `gh` (`ready`, `not_installed`, `signed_out`, `unknown`). A recomendação para o `gh` é local, sem rede: o executável achado pelo `resolve` do `gh.Runner` e `gh auth token`, que sai com erro sem login; `gh auth status` (`internal/gh/commands.go:42–56`) consulta a API e diria `signed_out` numa máquina sem rede.
- **A mensagem de disco cheio.** `SetModelDefault` e `SetReviewModeDefault` (`internal/bindings/settings_service.go:59–93`) devolvem, com o disco cheio, `no space left on the disk of <diretório de dados com ~>. Free some space, then try again.`; a mesma função de classificação serve ao início. As ações do frontend passam a `inPlace` (`store/actions.ts:60–67`), sem o aviso do app.
- **O board inexistente.** `internal/board/failure.go:42` passa a `The board doesn't exist or this account can't read it. Check the number and that this account can see the project.`
- **Os caminhos nas mensagens.** `lib/paths.ts` ganha `displayPaths(texto)`, no step do system, que troca todo `/home/<usuário>` por `~` numa mensagem do Go, usado nas recusas e nos erros que Settings, o início e as boas-vindas mostram.
- **Copy the list**, o texto: `MySpec couldn't be updated`, uma linha em branco, e para cada tipo o título, o que fazer e, para cada caso, `- <lugar>` (e `  <detalhe>` quando há) e `  - <task> · <área de trabalho ou caminho>`, uma linha em branco entre os tipos. A cópia usa `navigator.clipboard.writeText`, como a da conversa (task 4).
- **Onde moram as funções puras**: `features/settings/settings-nav.ts` (os itens, o `◇ N` e o texto dele), `features/settings/defaults.ts` (os grupos, a contagem, os nomes e as notas dos chips), `features/boards/boards-page.ts` (as linhas do board, a frase de remoção e as linhas por destino; hoje 1–43), `features/boards/board-dialog.ts` (os subtítulos, a ajuda da pré-marcação, a nota do board que mudou, o ligar de cada repositório, a consequência, a soma; hoje 1–68), `features/repositories/repositories-page.ts` (os grupos, a linha 2, as contagens, o motivo de **Remove…**, as linhas de bloqueio), `features/repositories/add-repository.ts` (a partição, a linha que liga, o rótulo; hoje 1–29), `features/settings/prompts.ts` (a data, a frase das linhas), `features/startup/start.ts` (os passos, o lento, o texto), `features/welcome/machine.ts` (os itens), `features/migration/migration-text.ts` (o texto copiado).
- **O modo de boas-vindas** é um seletor derivado do `State` (`welcomeMode`: sem board, sem repositório e sem item ativo, testado em tabela com a discussão ativa de um board removido), usado por `applyState`, `navigate`, `travel` e `productOnScreen`, que passa a dizer quais atalhos valem em cada modo.
- **O tema antes do estado**: `features/theme/useApplyTheme.ts` não pinta nem grava antes do primeiro estado, e depois grava o modo (`myspec.theme`, como hoje) e a preferência (`myspec.theme.preference`); o seletor do início lê a preferência guardada e o `systemDark` do retrato do início; a janela abre com a cor de fundo do esquema do sistema (`internal/app/window.go`, `theme.go`), porque a preferência só se lê com o banco aberto.

## 5. Inventário atual

### 5.1 As features

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `settings/SettingsView.tsx` (1–88) | Navegação de 12 itens com os nove prompts (49–72), `w-56`, sem `◇`; **Close** | Reescrito: o lugar, a navegação, o par centrado, a largura |
| `settings/Defaults.tsx` (1–88) | `ReviewModePicker` rotulado `New tasks` (41–45); os nove `ModelPicker` em lista (68–79); a falha do catálogo em âmbar (59–67); falhas ao aviso do app | Reescrito: §4.2 Defaults |
| `settings/PromptPane.tsx` (1–267) | Um prompt por página; `Modified` (153); **Restore default** (158–161); o `Banner` da falha (187–217); o editor com a coluna (227–240) | Sai: `PromptsPage`, `PromptPage`, `PromptEditor` |
| `settings/prompts.ts` (1–98) | Os nove com a descrição; os placeholders | Fica e cresce |
| `settings/DiscardChangesDialog.tsx` (1–46) | `AlertDialog` do shadcn | No `Dialog` do system |
| `boards/BoardsPage.tsx` (1–42), `BoardRow.tsx` (1–61) | **Add board** primário (`BoardsPage.tsx:20`); `No boards yet.`; a URL inteira como link (`BoardRow.tsx:40`); `checked <idade>` e a falha em vermelho (`BoardRow.tsx:49–56`) | Reescritos: §4.2 Boards |
| `boards/boards-page.ts` (1–43) | `ownerText`, `readingText`, `statusesText`, `removalText` (com `and 0 leave`) | Fica e cresce |
| `boards/BoardDialog.tsx` (1–393) | Sem passo nem **Back**; os finais em lista e `Status for new cards` em rádio (257–316); o Edit que falha só com **Cancel** (125–140); `sm:max-w-[40rem]` | Reescrito: §4.2 O diálogo de board |
| `boards/board-dialog.ts` (1–68) | `linkText`, `choicesOf`, `withOption` | Fica e cresce |
| `boards/RepositoryLinkRow.tsx` (1–80) | A linha do repositório com o menu do clone | Sai: `BoardRepositoryRow` |
| `boards/RemoveBoardDialog.tsx` (1–90) | A prévia em contagens; a falha da prévia engolida (36) | Reescrito: §4.2 Remove board |
| `repositories/RepositoriesPage.tsx` (1–40) | **Add repository** primário; **Clone folder** no alto; uma lista em ordem alfabética, sem vazio | Reescrito |
| `repositories/RepositoryRow.tsx` (1–176) | **Clone**, **Change path**, **Remove** na linha; `Board: …` como etiqueta; as instruções recolhíveis (26–78); o clone inexistente em âmbar (157–162) | Reescrito: a linha, o `⋯`, as linhas de bloqueio, o bloco das instruções |
| `repositories/CloneFolderField.tsx` (1–24) | O campo no alto da página | Sai: a seção no pé |
| `repositories/AddRepositoryDialog.tsx` (1–221) | A lista mista com `Registered` a 70% (154–190); **Browse…** e a recusa no rodapé | Reescrito: §4.2 Add repository |
| `repositories/add-repository.ts` (1–29) | O filtro, o rótulo, os textos | Fica e cresce |
| `repositories/RemoveRepositoryDialog.tsx` (1–50) | Fecha antes de remover (39–42); **Remove** | Reescrito |
| `welcome/WelcomeScreen.tsx` (1–66) | A tela à parte, sem lateral; **Add board** primário; `AppMark` (8–29) | Sai: `features/welcome/Welcome.tsx` no shell; a marca vai a `components/system/BrandMark.tsx` |
| `migration/MigrationRefused.tsx` (1–78), `migration-text.ts` (1–44) | A tela sem **Copy the list** | Reescritos na forma da §4.2 |
| `models/ModelChip.tsx` (1–177) | `Effort` sem o modelo (140); `Not in the models…` (48); o menu abre lendo; nome `<rótulo> model: …` (88) | O menu, a razão, a leitura, o nome e a marca `factory` (§4.2) |
| `review-mode/` e `task/ReviewModePopover.tsx` (25–37, 85–132) | As opções só no popover | As opções extraídas para `ReviewModeOptions`, usadas no popover e em Defaults |

Testes: 3 arquivos em `features/settings`, 5 em `features/boards`, 6 em `features/repositories`, 1 em `features/welcome`, 2 em `features/migration`, 3 em `features/models`; cada um sai com o componente que testa, e os novos nascem no mesmo step.

### 5.2 Outros lugares que a task toca

| Arquivo | Hoje | Destino |
|---|---|---|
| `app/App.tsx` (1–46) | `<div>` vazio sem estado (32–34); a tela das boas-vindas à parte (41–45) | O início sem estado; o shell com as boas-vindas dentro |
| `app/bootstrap.ts` (1–64) | Pede o estado de uma vez (57); uma falha deixa a janela vazia | Espera o `ready` do início (P35) |
| `app/AppShell.tsx` (1–82) | A Home no `home` | As boas-vindas no `home` em modo de boas-vindas |
| `app/useGlobalShortcuts.ts` (13–19, 98–125) | Nenhum atalho sem cadastro | Os atalhos do modo de boas-vindas |
| `store/app-store.ts` (732–740, 772–786, 1089–1118, 1377–1384, 1477–1493) | O estado sem cadastro força a Home; `SettingsSection` sem `prompts`; `useThemeState` claro sem estado | O modo de boas-vindas; `prompts`; o foco na navegação; o tema antes do estado |
| `store/actions.ts` (157–159, 208–218, 236–241, 260–272, 344–354) | Os setters, a prévia, **Choose…** e **Remove** ao aviso do app | `inPlace`; `listPrompts`, `checkMachine`, as do início |
| `lib/locations.ts` (4–51, 242–243) | As seções sem a lista | `prompts` |
| `lib/models.ts`, `lib/paths.ts`, `lib/ui-storage.ts` | — | A fábrica; `displayPaths`; o tema guardado |
| `features/sidebar/Sidebar.tsx`, `SidebarTop.tsx`, `NewMenu.tsx`, `SidebarFooter.tsx`, `ThemeButton.tsx` | Só a lateral cheia | A lateral em esqueleto e a nua; **New** e **History** tracejados; o tema local antes do estado |
| `features/board/AddToBoardDialog.tsx` (task 5) | `RepositoryLinkRow` | `BoardRepositoryRow` |
| `features/theme/useApplyTheme.ts` (1–26), `index.html` (7–16) | O script aplica o modo guardado antes da primeira pintura; sem estado, o hook pinta e grava claro | O hook espera o estado e guarda também a preferência |
| `internal/app/app.go` (101–343, 400–436, 557), `refused.go` (1–55), `window.go`, `theme.go`, `state.go` | O início antes da janela; a migração em outro `Run` | P35; `modelFactory` no estado |
| `internal/bindings/dto.go` (41–112, 852–861, 1010–1061), `convert.go`, `board_service.go`, `settings_service.go`, `state_service.go`, `events.go` | — | P31, P32, P34, P34b, P35, P36 |
| `internal/board/service.go`, `failure.go`, `internal/store/boards.go`, `internal/store/migrations/` | — | P31, P32, o texto |
| `internal/repository/service.go` (141–173) | `Sync` testa os clones junto | A leitura separada do teste, com o progresso |
| `internal/models/service.go`, `internal/prompts/prompts.go`, `internal/gh/` | — | A leitura desta execução; P34; o `gh` local |

### 5.3 Os componentes do system

| Peça (`components.md`) | Hoje | Nesta task |
|---|---|---|
| Navegação de Settings, Linha de Settings e o grupo com título, Repositório de um board no diálogo, Clone da varredura, Tabela de status, Editor de prompt e a barra de salvar, Passos do início e checagens da máquina | Não existem | Nascem (a navegação, as linhas e a tabela em `features/`, onde só Settings as usa; os passos e as checagens em `components/system/`), com testes de componente e pintados nos dois modos |
| O placeholder (`Placeholder.tsx`), as etiquetas `Edited Sep 20` (a variante `edited` de `Badge.tsx:20`) e `new` (a `default`) | Existem (task 1) | Usados como estão |
| `BrandMark` (a marca em `sm` e em `lg`), `CopyButton` (**Copy** com `Copied` e a falha), `CopyBlock` (o bloco de código copiável do erro) | A marca dentro de `SidebarTop.tsx:15–18` | Nascem em `components/system/`; `SidebarTop` passa a usar a marca; a task 11 usa o `CopyBlock` na página da task apagada |
| A idade da leitura (`ReadAge`), a linha de início, os ícones `settings`, `repository`, `plus`, `refresh`, `clone` | Da task 5, na `main` quando esta começa | Usados; `ReadAge` ganha as formas `never` e `failed` (§4.2 Boards) |
| Ícones `defaults`, `prompt`, `copy`, `folder`, `back` | Não existem | Acrescentados em `icons.ts` |
| `Dialog` (em passos, mínimo, largo), `Radio`, `Checkbox`, `Select`, `Menu`, `SearchInput`, `Textarea`, `Input`, `Field`, `Collapsible`, `NoticeStrip`, `SunkenLine`, `EmptyState`, `Skeleton`, `Shimmer`, `Spinner`, `StateGlyph`, `Tooltip`, `Link`, `IconButton`, `Button`, `Kbd`, `PlaceHeader` | Existem (tasks 1 a 3) | Usados como estão |

### 5.4 Os dados

| Dado | Existe | Falta, e onde nasce |
|---|---|---|
| Os boards: título, dono, tipo, URL, status com `final`, `newCardStatus`, repositórios, `readAt`, `reading`, `failure` com `failedAt` | `dto.go:886–922` | — |
| A consequência por repositório desmarcado; os nomes por destino | Só as contagens (`BoardRemoval`) | P31 |
| As opções que sumiram e as novas | — | P32, com a migration |
| Os repositórios: caminho, `missing`, `cloned`, `cloning`, `cloneError`, contagens, instruções, board | `dto.go:10–28` | — |
| O clone de um repositório registrado sem clone, na varredura | `RepositoryCandidate.registered` falso e `State.repositories` | Só frontend |
| A data da edição e as linhas de um prompt; a lista dos nove | `Prompt.modified` | P34 |
| Os padrões de fábrica | `internal/models/models.go:92–105`, fora do `State` | P34b |
| O catálogo e a falha dele | `State.modelCatalog` (a falha só sem catálogo guardado) | P36 guarda a desta execução |
| O progresso do início, a falha e **Try again** | — | P35 |
| O Claude Code e o `gh` da máquina | — | P36 |
| Os casos da migração | `Migration` (`dto.go:41–60`) | — |

## 6. Riscos, as outras tasks e o primeiro step

| Risco | Tratamento |
|---|---|
| **O início antes dos dados** | É a mudança de maior risco e o trabalho médio da task: toca `app.Run`, que compõe tudo. Por isso é dividido em dois steps sem meio-caminho (§8): o 4a, só Go, abre a janela antes do banco sobre o `<div>` de hoje, com a falha ainda no terminal, sem regressão; o 4b traz a tela, a falha com **Try again**, o tema e a migração no mesmo processo. O `internal/app` ganha um executor de início testável com abridores falsos (a sonda e a falha por tipo, **Try again**, o lento com o caminho, a recusa da migração, o fechamento durante o início). Uma falha antes da janela continua no terminal |
| **O modo de boas-vindas** | A regra dos lugares válidos é uma função pura testada em tabela, com a discussão ativa de um board removido fora do modo; `app-store.test.ts` prova que um lugar guardado de antes não sobrevive sem cadastro e que Settings sobrevive ao primeiro cadastro |
| **A migration numa frente paralela** | O arquivo é renumerado no rebase para o número livre; o conteúdo não depende do número. `migrate_test.go` prova o preenchimento com a leitura válida, vazia e inválida |
| **O `ModelChip` compartilhado** | Mudam o título do esforço, a razão de indisponível, a leitura e o nome; os testes de `ModelChip`, do popover **Models**, de `Details` e da criação de task (task 5, já na `main`) que leem esses textos mudam no step 5 |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria |

**Onde a task 10 se toca com as outras**, arquivo a arquivo:

| Arquivo | Outra task | O que a outra faz | O conflito |
|---|---|---|---|
| `store/app-store.ts`, `store/actions.ts`, `app/useGlobalShortcuts.ts` | 4 | O pedido de foco, `openSituation`, a ordem do `Esc` na conversa | Já na `main`; as linhas citadas são as de depois dela |
| `store/app-store.ts`, `app-store.test.ts`, `lib/locations.ts` | 5 | `NewDiscussionRef`, `openBoardCard`, `resolveHome` sem o primeiro board | Na `main` quando a 10 começa; o modo de boas-vindas não passa por `resolveHome` |
| `lib/locations.ts` | 6, 9 | Os títulos das páginas de item que saiu (`locations.ts:281–310`) | A 10 muda `SETTINGS_SECTIONS` e o tipo; textual |
| `features/sidebar/SidebarFooter.tsx` | 11 | O **History** do rodapé com o chip do filtro | A 10 o deixa tracejado nas boas-vindas; mesmo componente, textual |
| `store/app-store.ts`, `store/actions.ts` | 6, 9 | O review e a discussão | Regiões diferentes; textual |
| `internal/bindings/dto.go`, `convert.go`, `convert_test.go`, `frontend/bindings/**`, `lib/wails.ts`, `test/wails-mock.ts` | 4 a 9 | Os DTOs de cada tela | Textual; `frontend/bindings/**` refeito por `task generate` depois do rebase, nunca à mão |
| `components/system/icons.ts` | 4, 5, 6, 9 | Os ícones de cada tela | Acréscimos no mesmo objeto. O `retry` da 4 (`RotateCw`, o retry automático) e o `refresh` da 5 (duas setas, ler de novo) são dois desenhos para dois sentidos; o **Try again** da faixa de leitura usa `refresh` (`components.md` Ícones) |
| A idade da leitura, a linha de início | 5 | A 5 os cria | A 10 os usa e completa `ReadAge` com `never` e `failed` |
| `features/models/ModelChip.tsx` e os testes que leem o menu | 5, 6, 9 | A criação de task, o início de review e a discussão usam o chip | Os textos mudam para todos; quem entra depois atualiza os testes que leem `Effort` ou a razão |
| `lib/models.ts` | 5 | `adjustmentSummary` | Funções diferentes; textual |
| `features/sidebar/NewMenu.tsx` | 5 | O campo **Board** do **New discussion** | Regiões diferentes: a 10 só desabilita o gatilho no modo de boas-vindas |
| `features/board/AddToBoardDialog.tsx` | 5 | O diálogo no `Dialog` do system | A 10 troca a linha, uma importação e o uso; textual |
| `features/home/Home.tsx`, `app/AppShell.tsx` | 5 | A Home nova | A 10 não edita a Home; o `AppShell` escolhe as boas-vindas no modo delas |
| `internal/prompts/prompts.go` e `prompts_test.go` | 6, 7 | As seções acrescentadas ao review de PR (`Render`) | Funções diferentes (`Read`, `List`); textual |
| `internal/app/app.go` | 6, 7, 8, 9 | Um construtor de binding com dependência nova muda a linha dele em `options` | P35 reescreve `Run` e `options`; quem entra depois refaz a linha no lugar novo |
| `internal/store/migrations/` | 4, 6, 7, 8, 9 | `0020` a `0024` | A 10 renumera a sua no rebase |
| `design/system/tokens.css` | 4, 5 | `--size-composer-max`; `--col-keys`, `--col-dep`, `--size-dialog-wide` | Linhas diferentes; textual |
| `styles/globals.css` | 4, 5 | O fio da pergunta; o painel da lista | Blocos diferentes |
| `docs/product/features.md` §Tela de boas-vindas e barra lateral, §Atalhos, §Modelos e esforço | 5, 4 | A Home, as teclas do board e da conversa, o resumo dos modelos | Parágrafos diferentes |
| `design/screens/rest.md`, `CopyBlock` | 11 | History, os diálogos da task, a página da task apagada | A 11 depende da 10 e usa o `CopyBlock` |

**A ordem de merge**: a 10 começa depois do merge das tasks 4 e 5 (a 4 já está na `main`, em `f055371`; a 5 cria a idade da leitura, a linha de início e os ícones que a 10 usa, e lê o `ModelChip` que a 10 muda) e corre em paralelo com a 9, e com a 6, a 7 ou a 8 que ainda estiver aberta. Entre elas, a que ficar pronta primeiro entra, e a outra faz rebase, renumera a migration, roda `task generate` e `task check`, e só então o `design-critic` revisa a branch. Nenhuma espera a outra para começar.

**Como o primeiro step é feito.** É P31 e P32, só no Go e na fronteira: a regra de `releases` por repositório, `release` em cada opção do Edit, os nomes por destino em `BoardRemoval`; a migration de `saved_statuses` com o preenchimento, a gravação no `Add` e no `Update`, a comparação em `PreviewEdit`; a frase do board inexistente; os testes de tabela em `internal/board` e `internal/store`; o DTO, `task generate`, `lib/wails.ts` e as fixtures do mock. Nada na tela muda: a interface de hoje ignora os campos, e a frase nova aparece onde a de hoje aparecia.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/storage.md` §Banco; `features.md` §Falhas | `saved_statuses`, com o retrato da última leitura boa nos boards de antes; a frase do board inexistente | 1 |
| `docs/architecture/overview.md` §O estado que o frontend vê; `storage.md` §Prompts | `modelFactory`, `ListPrompts`, `editedAt`, as linhas; `CheckMachine` | 2 |
| `docs/architecture/design-system.md` §Componentes | Settings e início; `BrandMark`, `CopyButton`, `CopyBlock`, os passos e as checagens | 3 |
| `docs/architecture/overview.md` §Composição e injeção, §Eventos, §Fronteira com o Go; `storage.md` §Migração dos dados; `docs/development/target-machine.md` | O início antes dos dados, o acesso preguiçoso, `StartupService`, `startup:changed`, a sonda, **Try again**; a migração como fim do primeiro passo; a prova na máquina alvo e a segunda instância que sai antes do banco | 4a, 4b |
| `features.md` §Configurações e aparência, §Modelos e esforço, §Atalhos, §Prompts | O lugar, a navegação, Defaults, o menu do chip; a lista de Prompts | 5 |
| `features.md` §Página Boards, §Cadastrar um board, §Editar e remover um board | A página, o diálogo em passos, a consequência, **Remove** por destino | 6, 7 |
| `features.md` §Página Repositories, §Repositório sem clone, §Clone inexistente | A página, o `⋯`, as instruções, a pasta, o vazio, **Add repository**, **Remove** | 8, 9 |
| `features.md` §Prompts; `design-system.md` §Componentes | A página, a edição, **Reset to default…**; `--col-placeholders` | 10 |
| `features.md` §Tela de boas-vindas e barra lateral, §Dados de uma versão com áreas de trabalho; `overview.md` §Store, §Features | As boas-vindas no shell, `This machine`, o modo de boas-vindas; **Copy the list** | 11 |

## 8. Plano de steps sugerido

Treze commits (os steps 1 a 12, com o 4 dividido em 4a e 4b), dentro de G (9 a 14, `implementation.md:7`), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma nova que um step seguinte troque, e nenhum deixa um controle de hoje sem lugar.

1. **P31, P32 e o texto do board.** O Go e a fronteira (§6), a migration com `json_valid`. Nada na tela.
2. **P34, P34b, P36 e o disco cheio.** `ListPrompts`, `editedAt`, as linhas; `modelFactory`; `CheckMachine` com a leitura desta execução e o `gh` local; a mensagem de disco cheio; DTOs, `task generate`, `lib/wails.ts`, o mock. Nada na tela.
3. **O system.** `BrandMark`, `CopyButton`, `CopyBlock`, os passos do início e as checagens da máquina, `displayPaths`, os ícones `defaults`, `prompt`, `copy`, `folder`, `back`, e `ReadAge` com `never` e `failed`; testes de componente e pintados nos dois modos. Sem token. Nada na tela muda.
4. **O início (P35).**
   - **4a, o Go.** O executor com a sonda, sem prazo total, na ordem da §4.4; o acesso preguiçoso nos bindings; o `StartupService` e o evento; o fechamento durante o início; o `bootstrap` que espera o `ready`. A janela abre mais cedo, sobre o `<div>` de hoje; uma falha ainda sai no terminal, como hoje. A prova na máquina alvo.
   - **4b, a tela.** O início (a lateral em esqueleto, a faixa quando guardada, a área depois de 400 ms, os passos, o lento), a falha com o `CopyBlock` e **Try again** no mesmo processo, o tema antes do estado, a migração no mesmo `Run` e pintada no tema da interface. Saem `runRefused`, a saída sem janela depois do log e o `<div>` vazio.
5. **O lugar, Defaults e a lista de Prompts.** A navegação com o `◇ N`, a página de 800 px, a largura, o teclado e o foco; `prompts` em `SettingsSection`; Defaults com `ReviewModeOptions` e os grupos; o `ModelChip` com o menu, a razão, a leitura, o nome e `factory`; as falhas na linha; a lista de Prompts na forma final, com `ListPrompts`, em que cada linha abre o `PromptPane` de hoje. Saem a navegação de 12 itens, `Defaults` de hoje e o uso de `ModelPicker` e `ReviewModePicker` nele.
6. **A página Boards e Remove board.** A linha, a idade, a faixa da falha, o vazio com **Add board**; Remove board com as linhas por destino. Saem `BoardsPage`, `BoardRow` e `RemoveBoardDialog` de hoje.
7. **O diálogo de board.** Os passos com **Back**, a tabela de status, a nota do board que mudou, a linha de repositório com a consequência e a soma, o Edit que falha com **Try again**; a linha em **Add to board**. Saem `BoardDialog` de hoje e `RepositoryLinkRow`.
8. **A página Repositories e Remove repository.** Os grupos, a linha, o `⋯`, as linhas de bloqueio, as instruções, a pasta de clones, o vazio com as duas saídas; Remove repository que espera. Saem `RepositoriesPage`, `RepositoryRow`, `CloneFolderField` e `RemoveRepositoryDialog` de hoje.
9. **Add repository.** A varredura, a falha dela, a partição, a linha que liga, os registrados dobrados, o cadastro um a um, **Browse…**. Sai `AddRepositoryDialog` de hoje.
10. **A página do prompt, a edição e os diálogos.** O prompt com os placeholders, a edição com a coluna e a barra, **Reset to default…**, `Discard your changes?` no system; o token `--col-placeholders` em `design/system/tokens.css`, que este step usa. Saem `PromptPane` e `DiscardChangesDialog`.
11. **As boas-vindas e a migração.** O modo de boas-vindas no store e nos atalhos, a lateral nua, as boas-vindas com `This machine` e **Start**, a checagem ao montar, quando o catálogo muda e ao voltar o foco; a migração com **Copy the list**. Sai `WelcomeScreen`.
12. **As cenas.** `test/settings-scenes.ts`, os quatro testes pintados das cenas com as capturas e as cenas próprias do pronto 1, `SettingsView.keys.test.tsx`, `where-actions-went.test.tsx` e a conferência de `docs/` contra o que a task fez.

Depois do step 12 e do rebase da §6, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.

## 9. Para o usuário confirmar

Nada. As mudanças de produto desta task estão em `changes.md` X1–X9 e X17–X19, dentro do que o usuário aprovou ao aprovar a rodada `lab/14-screen-rest` (`decisions.md`, 2026-09-25) e o plano (`implementation.md` §4, X1 e X2 entre as de menor risco). O que sobrou de produto foi decidido pelo coordenador, por delegação, em `decisions.md` (2026-09-29, o desta task): a janela antes dos dados com **Try again** no mesmo processo, o modo de boas-vindas com Settings e History ao alcance e só sem item ativo, a marca `factory` só em Defaults e o menu de modelo que espera o catálogo em todo lugar, o retrato dos status gravado por uma migration, as confirmações que esperam o fim, a frase do board inexistente com o que fazer. Nenhuma delas muda um fluxo inteiro, apaga dado ou desdiz o que o usuário aprovou; a maior é técnica (o início, P35, de custo médio dentro da task, em dois steps), e o custo dela está em `backend.md`. O PRD não pergunta nada ao usuário.
