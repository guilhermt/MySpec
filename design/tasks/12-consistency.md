# Task 12 · Consistência e remoção do design antigo

Material de entrada da décima segunda e última task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**), junto com o relatório do passe do crítico, `design/research/critique-task-12-pass.md`. É a task 12 de `design/implementation.md` (§2 e a seção `### 12.`), com os princípios da §1 (9–22) e os riscos da §3. Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** O material foi escrito sobre a `main` em `ed5facf` (tasks 1 a 8 mergeadas; as tasks 9, 10 e 11 com o material pronto). A task depende de todas (`implementation.md`, task 12, Dependências), começa depois do merge da 11 e não corre em paralelo com nenhuma. As linhas de código citadas são as de `ed5facf`. As tasks 9, 10 e 11 apagam boa parte do que o inventário da §5 lista (§5.6), então o primeiro passo do tech spec é refazer o inventário na `main` em que a task começa, com os comandos da §4.2, que são a prova de cada verificação. Sem migration e sem Go (`implementation.md`, task 12, `backend.md`: nenhum).

**O PRD é o relatório.** O coordenador roda o passe do `design-critic` sobre o app inteiro depois do merge da task 11 e antes de o card ir para `Ready`, com a §4.2 (O passe do crítico) como instrução, e grava `design/research/critique-task-12-pass.md` (`implementation.md:178`; `design/README.md:31`, fase 5). As lacunas de design que o passe achar são decididas pelo coordenador em `design/` antes de `Ready` (`implementation.md:18`), e o que mudar de comportamento entra em `changes.md`. Quando a task é criada, o relatório já existe e não tem lacuna aberta: o PRD o toma como a lista do que falta, este material fixa o resto, e o plano já sabe o tamanho de cada área. O PRD não pergunta nada ao usuário (§9).

**Nenhum comportamento de hoje se perde.** O que sai tem um substituto que faz o mesmo: o `ModelPicker` dá lugar ao `ModelChip`, com as mesmas escolhas; o `ReviewModePicker` já não tem leitor depois das tasks 10 e 11, que o trocam por `ReviewModeOptions` e tiram a lista de steps do arquivado; a cópia própria do código dá lugar ao `CopyButton`, com os mesmos estados. A virtualização mantém o percurso do teclado, a parada de Tab, os alvos da barra do pedido, a âncora do fim, a dobra dos trechos, a piscada e a posição de cada entrada para o leitor de tela.

**Vocabulário.** "Verificação" é uma regra que faz `task check` falhar quando quebrada. "O passe" é a rodada do `design-critic` que o coordenador roda antes da task; "o relatório", o arquivo dele. "Área" é um grupo de telas do relatório e do plano (§4.2, O passe do crítico). "A janela" é o conjunto das linhas montadas de uma lista virtualizada; uma linha "fixada" fica montada fora da janela. "A cauda" é o que a conversa desenha depois das entradas (a linha derivada do fim, o cartão fixo, a fila, a atividade). "A varredura" é a prova pintada de todas as telas nas cinco larguras.

## 1. Objetivo e critério de pronto

O que o passe do crítico apontou é corrigido, área por área; o que restou do design antigo sai; verificações fecham a porta para ele voltar; a conversa e o board passam a ser listas virtualizadas que cumprem as metas medidas na máquina alvo; a largura, o movimento reduzido e os nomes acessíveis ganham uma prova que cobre todas as telas; a pauta de polimento da fase 3 e o que as críticas deixaram para depois são resolvidos ou fechados com a decisão; `docs/` descreve o produto como ele ficou.

**O tamanho** é M a G, de 5 a 14 steps, pelo relatório (`implementation.md` §2): a parte fixa (a remoção, as verificações, a virtualização e a varredura) ocupa cinco ou seis steps (os dois da conversa são um só quando juntos ficam abaixo de 1,5 mil linhas), e cada área com itens no relatório ou nas pautas ganha um step (§8). Passar de 14 seria mudança de escopo, e vai ao usuário pelo coordenador antes de `Ready`.

**Pronto quando** (`implementation.md`, task 12, Pronto), cada item provado como diz:

1. **O relatório fechado.** Cada item de `design/research/critique-task-12-pass.md` tem, escrito no próprio relatório, o commit que o resolveu ou a decisão que o fecha. Antes do merge, o `design-critic` revisa a branch (`implementation.md:21`) e acrescenta ao relatório a seção `Revisão da branch`, sem inconsistência aberta contra `principles.md` e `components.md`.
2. **As verificações.** As onze da §4.2 (As verificações que fecham a porta), cada uma rodando em todo `task check` e na CI, cada uma com um caso de teste que a viola e prova que ela morde. O comando de cada uma na tabela devolve vazio.
3. **A remoção.** O que a §4.2 (O que sai) lista não existe na branch: os comandos da tabela devolvem vazio, e `knip` não acha arquivo nem dependência sem uso.
4. **A virtualização.** As metas da §4.2 (As metas e a medição), medidas no WebKitGTK 6.0 da máquina alvo pelo backend Broadway do GTK, com o React de desenvolvimento e o de produção, registradas em `docs/development/target-machine.md` e no corpo da pull request; o comportamento da janela provado por testes pintados e de teclado (§4.2, A janela do board e A janela da conversa).
5. **A varredura.** Os testes pintados da §4.2 (A varredura de largura) passam em todas as cenas, nas cinco janelas e nos dois temas, e as capturas das telas de referência vão à pull request por `task captures:push`.
6. **O movimento reduzido** provado pela §4.2 (O movimento reduzido).
7. **Os nomes acessíveis** provados pela §4.2 (Os nomes acessíveis).
8. **As pautas.** Cada item da pauta de polimento e da pauta das críticas (§4.2) tem, na seção `Pautas` do relatório, o commit que o resolveu ou a decisão que o fecha.
9. **A verificação na máquina alvo.** O corpo da pull request tem a checklist `## Verification on the target machine`, que o usuário roda no app instalado (`task install`), no monitor dele, com o Hyprland e o GTK de verdade, o que o Broadway pode não mostrar: a barra de rolagem global nas áreas que rolam nativamente (um diálogo longo, o compositor, a lista de um `Select`); o anel de foco depois de um clique e depois de uma tecla numa linha da lista (`critique-task-06.md:169`); o meio pixel, ampliando uma captura da conversa e do board a 2560 e a 1280 px; o movimento reduzido com as animações do GNOME desligadas (`gsettings set org.gnome.desktop.interface enable-animations false`); a conversa longa de uma task real rolando, lendo acima enquanto o agente escreve, e voltando ao fim; o board com o teclado de ponta a ponta.
10. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
11. **Documentação** da §7, com `docs/` inteiro conferido contra o que a task fez no último step.
12. **A fase 5 registrada.** Depois do merge, o coordenador registra o fim da fase 5 em `design/README.md` (Estado da frente). Não é um step da task.

`changes.md`: o que o relatório apontou como não cumprido, escrito pelo coordenador antes de `Ready`. `backend.md`: nenhum.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/research/critique-task-12-pass.md` | O que falta, por área, com o arquivo e a linha; as lacunas fechadas e onde; a seção `Pautas` |
| 2 | `design/implementation.md` §1 (9–22), a seção `### 12.`, riscos (§3) | O escopo, as medidas da conversa e do board, a coexistência com o shadcn (19), os tokens (20), a revisão do crítico (21), os testes que migram (22), o meio pixel |
| 3 | `design/README.md` (Fases, 19–33); `design/decisions.md`: as entradas de 2026-10-02 da task 12, Fundação visual aprovada (2026-09-24), Largura contínua (2026-09-23), Conversa: largura única (2026-09-25) | A fase 5, a pauta da fase 3, as larguras, o que o coordenador decidiu nesta entrada |
| 4 | `design/principles.md` inteiro, em especial 1 (5–11), 2 (13–33), 5 (51–57), 8 (75–87), 9 (89–95), 10 (97–103) | A régua |
| 5 | `design/system/components.md` inteiro, em especial Barra de rolagem (89–99), Etiqueta e tecla (121–131), Botão (162–176), Chip de tempo (190–200), Linha da árvore (334–347), Faixa de aviso (441–451), Volta ao fim (529–535), Entradas da conversa (547–559), Dobra de trecho (572–581), Bloco de código (613–625), Linha de lista (711–724), Marca e cópia (882–889) | A régua; o `CopyButton`; a tecla; a barra de rolagem |
| 6 | `design/system/tokens.css`: movimento (118–123), a tecla (`--brand-key-ring`, 320) | As durações; o que a regra de movimento usa |
| 7 | `design/structure.md` §6 (384–399), §7 (401–424) | As larguras; "Muitos itens fora da árvore", com a virtualização |
| 8 | `design/screens/task.md` §6 (129–172), §11 (339–354), §12 (355–366), §13 (368–389); `design/screens/board.md` §2 (Boards, 56–64), §5 (343–362), §6 (363–375), §7 (376–399), §8 (400–406) | A conversa, o teclado do `feed`, a volta ao fim; o board, o teclado da lista, a ordem do que bloqueia na Home; as cenas |
| 9 | `design/tasks/04-task-conversation.md` §4.2 "A virtualização" (335), riscos (463); `design/tasks/05-board.md` §6 (414); `design/tasks/11-history-dialogs.md` (73, 666) | As metas, a forma plana que a virtualização usa, a condição do History |
| 10 | `design/lab/08-visual-final/critique.md` §7 (149–162) | A pauta de polimento |
| 11 | `design/research/critique-task-01.md` a `critique-task-11.md` | Os "Podem esperar" e os adiados; a pauta da §4.2 lista os das tasks 1 a 8, e o PRD acrescenta os das críticas das tasks 9 a 11 com o mesmo critério |
| 12 | `design/tasks/09-discussion.md` §3 (Fora, 66–76), `design/tasks/10-settings.md` §3 (Fora, 65–76), `design/tasks/11-history-dialogs.md` §5.1 (o que sai, 572–603) | O que cada uma deixou para esta |
| 13 | `docs/guidelines/README.md`, `frontend.md`, `testing.md`; `docs/architecture/design-system.md`, `overview.md` (Frontend), `stack.md`; `docs/development/setup.md` (68–75), `target-machine.md` | Como um step acontece; o que a documentação diz hoje |
| 14 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **O que o relatório aponta**, área por área (§8, steps 6 a 11).
2. **As verificações** da §4.2: as regras do Biome, o teste das regras do design rodado sempre, `knip`, e o que cada uma pede corrigir para passar.
3. **A remoção** da §4.2 (O que sai): os aliases `--status-*`, as classes de cor do shadcn fora da ponte, a escala de tipo do Tailwind, os laços soltos, os ícones importados direto, `react-resizable-panels` e os primitivos sem uso, `ModelPicker`, `ReviewModePicker` e o que as tasks 9 a 11 deixarem órfão.
4. **A virtualização** do board e da conversa, com o custo por quadro que a precede, as metas e a medição.
5. **A varredura de largura**, do movimento reduzido e dos nomes acessíveis, como testes pintados que cobrem todas as cenas.
6. **A pauta de polimento** de `lab/08-visual-final/critique.md` §7 que ainda vale, e **a pauta das críticas** (§4.2).
7. **A documentação**: `docs/` inteiro consistente (§7).

**Fora**:

| O que | Por quê |
|---|---|
| O passe do crítico | O coordenador o roda antes de a task ir para `Ready`; o relatório é a entrada (§4.2) |
| A virtualização do History | A task 11 o carrega por partes, 90 dias por vez, umas 360 linhas, e mede 400 linhas no WebKitGTK (`11-history-dialogs.md:73`, `:666`). Entra aqui só se a medida da 11 passar das metas da task 5; então o History ganha uma janela como a do board, com a medida dela, num step da área Settings e History |
| A virtualização da lista de Reviews | O volume real é de 8 PRs abertas em 12 repositórios (`research/review.md:13`); ela passa a usar o teclado por índice de `useListTree` (§4.2), sem janela |
| `.dark`, Inter e JetBrains Mono | Já não existem (§5.2): o tema é `data-theme` desde a task 1 (`styles/globals.css:14`), e `package.json` só tem a Fira. Os `dark:` de `components/system/Input.tsx:22` e `Menu.tsx:98` ficam: neutralizam o `dark:` do primitivo |
| A ponte do shadcn em `styles/globals.css` (134–160), `tw-animate-css` e `shadcn/tailwind.css` | Os primitivos de `components/ui/` os leem; a ponte continua sendo o único lugar dos nomes do shadcn |
| `components/ui/` | Gerado; só saem os arquivos sem uso (§4.2) |
| Uma mudança de comportamento fora do aprovado | Passa pelo coordenador e por `changes.md` antes de `Ready`; não entra na task sem estar lá |
| Go | Nenhum item da pauta pede, e `backend.md` não tem linha desta task. O `error_status` do retry fecha como nota (§4.2, A pauta das críticas) |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| O PRD é o relatório do passe do crítico sobre o app rodando, nas larguras de `structure.md` §6 e nos dois temas, rodado antes da task | `implementation.md:178`; `README.md:31`; `decisions.md` 2026-10-02 |
| A task é M a G, de 5 a 14 steps, pelo relatório; cada área com itens ganha um step | `implementation.md` §2 e a seção `### 12.`; `decisions.md` 2026-10-02 |
| Nenhuma feature importa de `components/ui/`; nenhum `oklch(` fora de `tokens.css`; nenhuma classe de cor do shadcn fora da ponte; fechado por verificação nesta task | `implementation.md:19`, `:178`; `tasks/01-foundation.md:54`, `:67` |
| Os `--status-*` saem nesta task, com `--status-attention-fill` | `implementation.md:20`; `tasks/01-foundation.md:98`; `tasks/01b-foundation-fixes.md:98` |
| `react-resizable-panels` e `components/ui/resizable.tsx` saem nesta task | `tasks/01-foundation.md:57`; `tasks/05-board.md:76` |
| `ModelPicker` e `ReviewModePicker` saem nesta task; o diálogo de início de review e o de nova discussão usam o chip de modelo e esforço | `tasks/10-settings.md:75`; `tasks/09-discussion.md:73`, `:109`; `screens/review.md:123`; `screens/discussion.md:41` |
| A conversa e o board são virtualizados nesta task, com as medidas registradas; as linhas no fluxo, com espaçadores, sem `transform` | `implementation.md:187`, `:196`; `structure.md` §7 |
| O design funciona de 1100 a 2600 px, contínuo; tudo o que o layout posiciona cai em pixel inteiro; o meio pixel é conferido com capturas ampliadas | `decisions.md` 2026-09-23; `principles.md` 10; `implementation.md` §3 (WebKitGTK: meio pixel) |
| Com `prefers-reduced-motion` tudo vai a zero: o spinner para em três quartos, o brilho fica chapado, a piscada não acontece | `principles.md` 8; `docs/guidelines/frontend.md:36` |
| Os componentes são achados por `getByRole` com o nome acessível inteiro | `implementation.md:22`; `frontend.md` (Acessibilidade) |
| A tecla em caixa em todo botão; a barra de rolagem em toda área que rola; um **Copy** só, o `CopyButton`, em todo bloco de código | `components.md` Etiqueta e tecla, Barra de rolagem, Bloco de código; `decisions.md` 2026-10-02 |
| A Home ordena o que bloqueia por repositório, em ordem alfabética | `screens/board.md` §2; `tasks/05-board.md:121` |

### 4.2 Decisões de design, detalhadas

#### O passe do crítico

É a instrução do passe que o coordenador roda antes de a task ir para `Ready`, registrada aqui porque o relatório é a entrada do PRD e porque a revisão da branch segue o mesmo formato.

**As duas fontes.** O passe junta o que cada fonte mostra melhor:

1. **As suítes pintadas** das tasks 3 a 11, com `MYSPEC_CAPTURES=1` (`task captures`): todas as cenas de todos os mocks, com os dados das fixtures, no Chromium com o CSS real, nas larguras que cada suíte já prova (2180, 978, 950 e 812 px de área principal). É onde o crítico vê cada estado decidido.
2. **O app real**, no motor do produto: `task build` numa cópia da `main`, `bin/myspec` pelo backend Broadway do GTK (`GDK_BACKEND=broadway`, `gtk4-broadwayd` numa porta livre acima de 8090), dirigido por um Chromium headless do Playwright, com a viewport nas cinco janelas: **1100, 1250, 1450, 2000 e 2560 px** (área principal de 812, 950, 1134, 1640 e 2180 px), e 1080 px de altura. O ambiente que funcionou nas críticas das tasks 7 e 8 (`critique-task-07.md:332–343`, `critique-task-08.md:305–312`): `env -i`, sem `DISPLAY` nem `WAYLAND_DISPLAY`; `HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CONFIG_HOME` e `XDG_CACHE_HOME` temporários; `dbus-run-session --config-file` com um barramento próprio, sem ativação de serviços, e `GTK_A11Y=none`; `XDG_RUNTIME_DIR` de caminho curto em `/tmp`, pelo limite de 108 bytes do socket. O GitHub só para leitura, com `GH_TOKEN` de `gh auth token` (`critique-task-05.md:295`): um board e o repositório `guilhermt/MySpec` cadastrados pelos diálogos, um clone novo num `HOME` falso. Os itens com conversa entram pelo banco temporário, gravados com `sqlite3` como na crítica da task 8 (`critique-task-08.md:313–319`): uma task na implementação com um step em review, uma na PR com apontamentos, um review com uma passada, uma discussão com rascunhos, um item arquivado de cada tipo. O tema escuro vem do botão do rodapé ou, se ele não trocar no Broadway (`critique-task-08.md:344`), da linha `theme` = `dark` na tabela de configurações, gravada antes de abrir. É onde o crítico vê o que só o motor mostra: as fontes, o meio pixel nas capturas ampliadas, a rolagem, o foco depois do clique, a barra de rolagem do GTK, a janela inteira em cada largura.

Nunca: o diretório de dados do usuário (`~/.local/share/myspec/`, e as worktrees dele), escrita no GitHub, `pkill` ou a porta 8090. O app, o barramento e o broadwayd são encerrados pelo PID, e os temporários, apagados.

**O que o crítico confere.** Por tela e por largura, nos dois temas: `principles.md` (os dez) e `components.md` (anatomia, estados, tokens, teclado, acessibilidade de cada componente usado), a consistência entre telas (um componente com a mesma forma em todo lugar; uma idade, uma hora e um ícone por significado), os estados de `structure.md` §7, o contraste medido nos dois temas, o foco visível, o nome acessível, a cor nunca como único portador, a primária única, o texto cortado com tooltip, nenhum valor solto onde há token. Confere também, uma a uma, as pautas desta seção, e acrescenta os "Podem esperar" das críticas das tasks 9 a 11.

**O relatório**, `design/research/critique-task-12-pass.md`, no formato das críticas das tasks (`.claude/agents/design-critic.md`), organizado pelas **seis áreas** do plano (§8):

| Área | Telas |
|---|---|
| O system, o shell e a árvore | Os componentes de `components/system/` usados em mais de uma área, a lateral, a árvore, a faixa recolhida, o cabeçalho do lugar, a página do item que saiu, o aviso do app e os toasts |
| A task | O cabeçalho, o stepper, as abas, a conversa, a barra do pedido, o compositor, os painéis, o `⋯` e os popovers |
| Home, board e criação | A Home, a visão do board, o painel do card, a seleção, o diálogo de criação |
| Reviews e o review | A lista, o painel da PR, o diálogo de início, a tela de um review, a publicação |
| A discussão | O diálogo de nova discussão, a tela, os rascunhos, os diálogos de arquivar, apagar e agrupar |
| Settings, History e diálogos | Settings, o início, as boas-vindas, a migração, History, os arquivados, os diálogos da task, as notificações |

Em cada área, uma linha por largura em que algo muda, e cada problema numerado com o arquivo e a linha, a regra que ele não cumpre (`principles.md` N, `components.md` <componente>, o documento da tela e a seção) e a gravidade (**Bloqueia**, **Deve**, **Pode esperar**, como nas críticas); uma área sem problema diz `Nada a apontar` com as larguras vistas. Depois das áreas: a seção `Lacunas`, com o que `design/` não decidia e a decisão que o coordenador tomou, onde está; a seção `Pautas`, com cada item da pauta de polimento e da pauta das críticas na área a que pertence; a seção `O que não foi visto`, e por quê.

**A regra.** Todo item do relatório é trabalho da task, com qualquer gravidade, porque esta é a última task e não há "depois". O step da área o implementa e escreve o commit no relatório; uma área sem item no relatório nem nas pautas não tem step.

#### As verificações que fecham a porta

Onde moram: as regras de importação no Biome, que `lint:web` (`biome ci .`, `Taskfile.yml:79–81`) roda em todo arquivo em todo `task check` e na CI (`.github/workflows/ci.yml:86`); as regras de texto num teste, `styles/design-rules.test.ts`, que `lint:web` passa a rodar sempre (`pnpm exec vitest run --project unit src/styles/design-rules.test.ts`), porque `test:web` roda só os testes que alcançam um arquivo mudado (`Taskfile.yml:97–101`) e um teste que varre arquivos não roda quando só uma feature muda. O teste que já varre as cores (`styles/globals.test.tsx:163–187`) muda para lá. Cada regra do teste tem um caso com um texto que a viola, para provar que ela morde. O escopo das regras de texto é `src` inteiro, `styles/globals.css` incluído, salvo `components/ui/`, `test/` e os arquivos de teste; os comandos da tabela seguem o mesmo escopo.

| # | Regra | Onde | Em `ed5facf` | O comando que prova |
|---|---|---|---|---|
| V1 | Nenhum arquivo fora de `components/system/` importa de `components/ui/` | Biome `style/noRestrictedImports` (`@/components/ui/*`), com um `overrides` que libera `components/system/**` e `styles/globals.test.tsx`, que testa o encaixe dos primitivos (6–7) | 85 importações em 35 arquivos | `rg -n '@/components/ui/' frontend/src -g '!**/components/ui/**' -g '!**/components/system/**' -g '!**/*.test.*'` |
| V2 | Nenhum ícone importado do `lucide-react` fora do system; dentro dele, um ícone de significado só por `icons.ts` | Biome, como V1, para `lucide-react` fora de `components/system/**`; a regra do system é a de `components/system/Icon.test.tsx:57–75` | 30 arquivos de `features/` | `rg -l 'from "lucide-react"' frontend/src/features frontend/src/app frontend/src/lib frontend/src/components/*.tsx` |
| V3 | Nenhum `oklch(` e nenhuma cor literal fora de `design/system/tokens.css` | `design-rules.test.ts` (a regra de hoje, com a paleta do Tailwind) | Zero em `src`; a cor do Go (`internal/app/theme.go:136–141`) amarrada a `--surface-1` por `theme_test.go` | `rg -n 'oklch\(' frontend internal -g '!**/node_modules/**' -g '!*_test.go'` |
| V4 | Nenhuma classe de cor do shadcn fora da ponte | `design-rules.test.ts`: os nomes que a ponte declara em `globals.css` (`--background`, `--foreground`, `--card*`, `--popover*`, `--primary*`, `--secondary*`, `--muted*`, `--accent*`, `--destructive`, `--input`, `--ring`, `--sidebar*`), tirados os tokens do system com o mesmo começo (`--sidebar-guide`, `--sidebar-input`, `--sidebar-control`, `--sidebar-line`, `--shadow-primary`), como utilitário do Tailwind (`bg-`, `text-`, `border-`, `ring-`, `outline-`, `fill-`, `stroke-`, `divide-`, `placeholder-`, com ou sem `/NN`). A camada base de `globals.css` (265, 274) passa a nomes do system | 164 linhas em 43 arquivos, `globals.css` incluído | `rg -nP '(?<![\w-])(bg\|text\|border\|ring\|outline\|fill\|stroke\|divide)-(background\|foreground\|card\|popover\|primary\|secondary\|muted\|accent\|destructive\|input\|ring)(-foreground)?(/\d+)?(?![\w-])' frontend/src -g '!**/components/ui/**' -g '!**/*.test.*'` |
| V5 | Nenhum `--status-*` | `design-rules.test.ts`: `globals.css` não declara, nenhum arquivo lê | 5 aliases (`globals.css:161–168`); 10 leitores de produção e 4 testes | `rg -n 'status-(working\|attention\|success\|paused)' frontend/src` |
| V6 | O tamanho de texto só pelos tokens (`text-(length:--text-…)` com `leading-(--leading-…)`, `design-system.md` Utilitários) | `design-rules.test.ts`: nenhum `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`… | 157 linhas em 34 arquivos, `globals.css:294` (`@apply text-sm`) incluído | `rg -nP '(?<![\w-])text-(xs\|sm\|base\|lg\|[2-9]?xl)(?![\w-])' frontend/src -g '!**/components/ui/**' -g '!**/*.test.*'` |
| V7 | O movimento só pelos tokens e pelos laços do system | `design-rules.test.ts`: nenhum `animate-spin`, `animate-pulse`, `animate-bounce`, `animate-ping`, `duration-<n>`, `delay-<n>` nem `ease-in`/`ease-out`/`ease-linear` do Tailwind; o giro é o `Spinner`, o brilho é o `Shimmer` | 7 linhas: `animate-spin` em 5 linhas de 4 arquivos, `animate-pulse` em `task/StatusDot.tsx:7` e no comentário de `components/system/Skeleton.tsx:26`, que muda junto, sem o nome da classe | `rg -nP 'animate-(spin\|pulse\|bounce\|ping)\|(?<![\w-])(duration\|delay)-\d\|ease-(in\|out\|linear)(?![\w-])' frontend/src -g '!**/components/ui/**' -g '!**/*.test.*'` |
| V8 | Nenhum arquivo e nenhuma dependência sem uso | `knip`, só arquivos e dependências (`--include files,dependencies`), em `lint:web`; `components/ui/`, `bindings/`, `src/dev/` e os testes como entradas ou ignorados, pela configuração | `react-resizable-panels`; `ui/resizable`, `ui/scroll-area`, `ui/separator`; `system/Listbox`, `Radio`, `Placeholder` (à espera das tasks 9 e 10) | `pnpm exec knip` em `frontend/` |
| V9 | Toda tela, em toda largura de 1100 a 2600 px: sem rolagem horizontal, pixel inteiro, texto cortado com tooltip, uma primária | A varredura (abaixo) | Por task, em partes (`TaskView.widths.painted.test.tsx` e as cenas) | `pnpm test:painted` |
| V10 | `prefers-reduced-motion` zera todo movimento | O teste do movimento (abaixo) | `globals.test.tsx:234`, `AgentTabs.test.tsx:205`, só da piscada | `pnpm test:painted` |
| V11 | Todo controle de toda cena tem nome acessível | A varredura (abaixo) | O `a11y` recomendado do Biome (`biome.json`) e o `getByRole` de cada task | `pnpm test:painted` |

Nas expressões da tabela, `\|` é o `|` da alternância, escapado para a tabela.

V9 a V11 rodam no `task check` quando um arquivo que alcançam muda, como toda suíte pintada, e inteiras na CI (`ci.yml:97`).

#### O que sai

| O que | Onde, em `ed5facf` | O que fica no lugar |
|---|---|---|
| Os aliases `--status-working`, `--status-attention`, `--status-attention-fill`, `--status-success`, `--status-paused` | `styles/globals.css:161–168`; os leitores: `task/ContextGauge.tsx:13`, `task/StatusDot.tsx:7–11`, `models/ModelPicker.tsx:137`, `settings/Defaults.tsx:62`, `discussion/DraftDiff.tsx:12`, `sidebar/RepositoryFilter.tsx:48`, `discussion/DraftCard.tsx:264, 425, 436, 442`, `repositories/RepositoryRow.tsx:158`, `discussion/DiscussionContextPreview.tsx:124`, `discussion/DiscussionBar.tsx:42` | Os `--state-*` e o `StateGlyph`. Depois das tasks 9 a 11 sobram `ModelPicker` e, se a 9 não o tirar, `ContextGauge`, que saem inteiros; `RepositoryFilter` sai na task 11 |
| As classes de cor do shadcn | 164 linhas, 43 arquivos; nas telas já redesenhadas, `task/TaskView.tsx:144, 173`, `reviews/ReviewView.tsx:99, 148`, `app/App.tsx:33` (`bg-background`) | Os utilitários do system (`bg-surface-1`, `text-ink-3`, `text-state-error`…) |
| A escala de tipo do Tailwind | 157 linhas, 34 arquivos | `text-(length:--text-…)` com `leading-(--leading-…)`, pelo registro do texto |
| Os laços soltos | `LoaderCircle animate-spin` em 5 linhas de 4 arquivos das tasks 9 e 10; `animate-pulse` em `task/StatusDot.tsx:7` | O `Spinner`; o `StateGlyph working` |
| Os ícones importados direto | 30 arquivos de `features/`, entre eles os da lateral, que nenhuma task seguinte reescreve: `sidebar/MoreBelow`, `NewMenu`, `SidebarFooter`, `SidebarRail`, `SidebarTop`, `TreeNodeRow` | `icons.ts`, com o ícone que faltar acrescentado por significado |
| `react-resizable-panels` 4.12.4 e `components/ui/resizable.tsx` | `package.json:31`; ninguém importa `ui/resizable` | Nada. O stub de `ResizeObserver` de `test/setup.ts:50–57` fica, porque `useAutoScroll` e a janela o usam, com o comentário que diz isso |
| Os primitivos sem uso `components/ui/scroll-area.tsx` e `separator.tsx` | Nenhum import | Nada; um `shadcn add` os traz de volta quando um wrapper pedir |
| `features/models/ModelPicker.tsx` | `discussion/NewDiscussionDialog.tsx:29`, `reviews/StartReviewDialog.tsx:10`; `settings/Defaults.tsx:3` e `task/StepList.tsx:1` saem nas tasks 10 e 11 | O `ModelChip` com o menu da task 10 (`Effort · <modelo>`, a razão de indisponível, o menu que espera o catálogo, o nome inteiro): no diálogo de review com `From Defaults. It can change in the conversation.` (`review.md:123`) e no de discussão com `From Defaults` (`discussion.md:41`) |
| `features/review-mode/ReviewModePicker.tsx` | `settings/Defaults.tsx:4` (a task 10 tira) e `task/StepList.tsx:2` (sai com o arquivado na task 11, `11-history-dialogs.md:581`) | Nada: fica sem leitor. `ReviewModeOptions` (task 10) e `StepModeChip` (task 3) já fazem o que ele fazia. O comentário de `REVIEW_MODES` (`lib/review-modes.ts:3`, "in the order the pickers list them") passa a dizer a ordem que vale |
| `task/ContextGauge.tsx` | `discussion/DiscussionHeader.tsx`, que a task 9 tira (`09-discussion.md:75`); a 9 já o removeu (`11-history-dialogs.md:74`) | O `ContextMeter` do system |
| O que a task 11 tira e esta confere | `history/HistoryPanel.tsx`, `history/history-format.ts`, `sidebar/RepositoryFilter.tsx`, `StepList.tsx`, `OneShotView.tsx`, `StatusDot.tsx`, `CardLink.tsx`, `OrphanPRs.tsx`, `LeftoversNotice.tsx`, `notice/Notice.tsx` (`11-history-dialogs.md:576–598`) | Nada; um que ainda exista na base da task sai aqui, por V1, V2, V4 e V8 |
| `features/reviews/useFindingText.ts` | Um invólucro de `useEditedText` que `06-review.md:451` mandava tirar (`critique-task-06.md:210`); lido por `PublishDialog.tsx` e `useConversationAnchors.tsx` | `useEditedText` direto |
| A cópia própria do código longo e a do Streamdown | `chat/Markdown.tsx:83–186` (`CutCode`, com `COPY_LABELS`) e `Markdown.tsx:15` (`code: { copy: true }`) | O `CopyButton` do system (task 10) no cabeçalho de todo bloco de código, curto ou cortado, com o nome `Copy the code` (`components.md` Bloco de código); a cópia do Streamdown desligada. Muda o que se vê: é do step da área do system (§8) |
| `FLASH_MS` repetido e uma feature importando a visão de outra | `board/BoardView.tsx:47` (`2 * 280`); `reviews/ReviewsView.tsx:7` importa `FLASH_MS` e `LIST_COLUMN` de `features/board/BoardView` | `FLASH_MS` de `lib/situations.ts:23`; `LIST_COLUMN` no system, ao lado de `ListPanel` |
| Componentes do system sem uso depois da task 11 | Hoje `components/system/Listbox.tsx`, `Radio.tsx`, `Placeholder.tsx`, só com os próprios testes | Saem, com os testes, se nenhuma tela os usar; `components.md` continua descrevendo o componente, e `docs/architecture/design-system.md` deixa de listá-lo |

#### A virtualização: a biblioteca

**`@tanstack/react-virtual`**, a versão estável corrente no step, pinada exata como as outras dependências (`frontend/package.json`) e registrada em `docs/architecture/stack.md`. É sem cabeça: o DOM continua o nosso (o `feed` de `article`s da conversa, o `tree` de `treeitem`s do board), o elemento que rola continua o viewport do `ScrollArea` do system (`getScrollElement`), mede cada linha depois de montada (`measureElement`), rola até um índice (`scrollToIndex`) e deixa a lista escolher o que fica montado além da janela (`rangeExtractor`), que é o que as linhas fixadas pedem. Descartadas: `react-virtuoso`, que traz o próprio elemento que rola e os próprios invólucros, contra o `ScrollArea` e os papéis do `feed` e do `tree`; `react-window`, sem a escolha das linhas fixadas; uma janela escrita à mão, mais código e mais risco no mesmo resultado.

**Um hook do system**, `components/system/useWindowedRows.ts`, que não conhece o produto: recebe o número de linhas, a chave e a altura estimada de cada uma, as linhas fixadas e o elemento que rola; devolve as linhas a montar, os espaçadores e `scrollToIndex`. O board e a conversa o usam.

**Linhas no fluxo, com espaçadores, sem `transform`** (`structure.md` §7). As linhas montadas ficam no fluxo normal da coluna, entre espaçadores cuja altura é a soma das linhas que não estão montadas, com o espaço entre as entradas (`--space-3` na conversa) incluído, em pixel inteiro. Uma linha fixada longe da janela fica entre dois espaçadores próprios. Assim nada é posicionado por `translateY` com a soma de alturas, que cairia em meio pixel no WebKitGTK (`principles.md` 10; `frontend.md` Estilo), e o `gap` da coluna continua valendo.

#### A janela do board

- **O que vira janela:** as linhas planas de `boardRows` (`features/board/board-view.ts`), cabeçalhos de seção e cards, na ordem em que a lista as desenha. A altura estimada é a da forma da linha: uma linha (`--size-control` com o respiro da linha) acima de 1040 px de contêiner, duas (52 px, `components.md:719`) até 1040; a medida depois de montada vale sobre a estimativa.
- **O que fica montado além da janela:** a linha que tem a parada de Tab (`tabStop` de `useListTree`) e a linha do card aberto no painel (`openKey`).
- **O teclado:** `useListTree` passa a andar por índice no modelo, não pelo DOM (`querySelectorAll` em `useListTree.ts`): `↑` `↓` `Home` `End` `←` `→` escolhem o índice, `scrollToIndex` o traz à vista (alinhamento `auto`, sem rolagem suave) e o foco vai a ele quando monta. O mesmo hook serve a `reviews/PullRequestTree.tsx`, que fica sem janela.
- **A acessibilidade:** cada `treeitem` diz `aria-level` (1 no cabeçalho, 2 no card), `aria-setsize` e `aria-posinset` entre os seus irmãos: um cabeçalho conta entre os cabeçalhos das seções, um card entre os cards da seção dele, porque nem todos estão no DOM; `design-system.md` (Listas, 173) passa a dizer isso.
- **O custo por quadro:** `CardRow` passa a `memo`, com props estáveis, e o modelo da linha (`CardRowModel`) é feito só para as linhas montadas, guardado por card, para que `↓` refaça só as duas linhas que mudam de foco e uma tecla na busca não monte o modelo de 2.000 cards.
- **O que não muda:** as seções, as finais recolhidas, a memória por board, o modo de seleção, a piscada de um card novo (que só pisca montado), o painel, as teclas de uma letra.

#### A janela da conversa

**Primeiro o custo por quadro**, que a medida da task 4 nomeou: cada evento `text` refaz `buildConversation` sobre todas as entradas e renderiza todas as entradas montadas (`implementation.md:187`; `critique-task-04.md:126`). As entradas do store já guardam a identidade das que não mudam (`store/transcript.ts`, `applyEvent`), então:

- **o modelo** é refeito só a partir do trecho da entrada que mudou: as linhas (`Row`) dos trechos anteriores e as linhas do trecho atual cujas entradas não mudaram mantêm a identidade (`conversation.ts`);
- **`RowView`** (`chat/Conversation.tsx`) passa a `memo` sobre a linha e as props que já são estáveis (`ctx`, `waitingToolUseId`, `onRequested`, `flash`), e um `text` renderiza uma linha só, a que cresce;
- **`useFeed`** deixa de refazer a parada de Tab a cada mudança do texto em streaming: ele reage a entradas que nascem, saem ou abrem, não ao texto que cresce.

**Depois a janela.**

- **O que vira janela:** as unidades da conversa na ordem da tela: cada linha de um trecho aberto, com o nó `after` dela; um trecho dobrado é uma unidade só (a linha `StretchFold`, que já não monta o conteúdo); um trecho que o usuário abre passa a contribuir a linha da dobra e as linhas dele. A altura estimada vem do tipo da linha (a fala pelo tamanho do texto, o grupo dobrado, o marco, o cartão) e é guardada pela chave da linha (`row.key`) depois de medida, para uma dobra reaberta não pular.
- **O que fica fora da janela, sempre montado no fim:** a cauda (`endLine`, os nós `after` cujo id não está na conversa, o cartão `fixed`, as mensagens na fila, a atividade).
- **O que fica montado além da janela:** a última unidade (a fala que cresce é medida de verdade, e a âncora do fim segue a altura real); a entrada que tem a parada de Tab do `feed`; os cartões de pergunta e de permissão pendentes (`data-pending-card`), que **Show** e as teclas `1`–`9` alcançam; a unidade que tem o cartão de decisão (apontamentos da PR, do review, rascunhos) enquanto ele tem algo a decidir, porque `A`, `D`, `Alt+↓` e **Next to decide** andam dentro dele (`lib/focus.ts`, `focusFindingToDecide`); o marco que a barra do pedido pediu para abrir (`markerRequest`), até ser atendido.
- **A âncora do fim:** a conversa abre no fim (`scrollToIndex` da última unidade, alinhada ao fim, depois da primeira medida); enquanto o usuário está no fim, cada medida nova o mantém lá (o `ResizeObserver` de `useAutoScroll` sobre o conteúdo, cuja altura passa a ser a total da lista); fora do fim, nada sobe sozinho: quando uma linha acima da vista muda de altura ao ser medida, a lista corrige a rolagem pela diferença, porque o WebKit não tem `overflow-anchor`. **New messages** conta pelas chaves das linhas, como hoje, e volta ao fim pela última unidade. Uma conversa anterior, somente leitura, abre no começo.
- **O teclado do `feed`** (`task.md` §6): `↑` `↓` Page Up Page Down Home End andam por índice no modelo; a entrada fora da janela é trazida por `scrollToIndex` e recebe o foco quando monta. Cada `article` diz `aria-posinset` e `aria-setsize` entre as unidades da conversa (o padrão `feed` da WAI, feito para listas que não estão inteiras no DOM), e o `feed` mantém `aria-busy` enquanto o agente escreve.
- **O que se perde, e se aceita:** uma seleção de texto que atravessa linhas desmontadas. O app não tem busca na página.

#### As metas e a medição

As ferramentas são as de hoje, `dev/measure-conversation.tsx` e `dev/measure-board.tsx` (`docs/development/setup.md:73–75`), rodadas no WebKitGTK 6.0 da máquina alvo (o `MiniBrowser` do pacote `webkitgtk-6.0`) sem janela, pelo backend Broadway, como nas tasks 4 e 5, uma vez fria e cinco quentes, e uma vez no Chromium do Playwright, para comparar. Cada uma roda com o React de desenvolvimento (o servidor de dev, a medida de partida da task 5) e com o de produção (a comparação da task 4, `implementation.md:184`); a via do React de produção, que `setup.md` não descreve, passa a estar escrita lá (§4.4). O step do board começa medindo a linha de base do React de produção do board, que falta (`critique-task-05.md:190`).

**Passa** quando o máximo das quentes com o React de produção e a mediana das quentes com o de desenvolvimento ficam dentro da meta:

| Lista | Medida | Meta |
|---|---|---|
| Board, 2.000 cards em dez status, todas as seções abertas | Primeira pintura, do render ao quadro seguinte ao commit | 300 ms |
| | Uma tecla na busca, até o quadro com a lista nova | 50 ms |
| | `↓` na lista, do `keydown` ao quadro seguinte | 16 ms |
| Conversa, 1.500 entradas, três trechos dobrados (a de hoje) | Primeira pintura | 300 ms |
| | Uma atualização de streaming no fim (commit e layout) | 16 ms |
| Conversa, as mesmas 1.500 entradas com todos os trechos abertos (nova no script) | Primeira pintura | 300 ms |
| | Uma atualização de streaming no fim | 16 ms |
| | `↓` no `feed`, do `keydown` ao quadro seguinte | 16 ms |
| | `Home` no `feed`, até o quadro com a primeira entrada focada | 100 ms |

Não é teste da suíte: um limiar de tempo no Chromium da CI seria instável e não mede o WebKitGTK (`tasks/04-task-conversation.md:335`). O resultado, com o motor, a versão e as duas builds, vai a `docs/development/target-machine.md` e ao corpo da pull request. Uma meta perdida não é aceita: o step volta ao custo por quadro (o modelo, a `memo`, a altura estimada, o `overscan`) até ela passar.

**As provas do comportamento**, que entram na suíte:

- `components/system/useWindowedRows.test.tsx` (jsdom, com o elemento que rola de tamanho fixo): a janela, as fixadas, os espaçadores em pixel inteiro, `scrollToIndex`;
- `features/board/BoardView.window.painted.test.tsx` (Chromium, CSS real): com 2.000 cards, montadas no máximo as linhas visíveis mais o `overscan` e as fixadas; `End` foca a última linha, que monta; o card aberto continua montado ao rolar para longe; nenhum `treeitem` sem `aria-posinset`;
- `features/chat/Conversation.window.painted.test.tsx`: com 1.500 entradas e os trechos abertos, abre no fim; uma atualização de streaming no fim mantém a rolagem no fim; lendo acima, uma linha acima da vista que muda de altura não move o que está na tela (o viewport com `overflow-anchor: none`, como o WebKit); o cartão de pergunta pendente, a parada de Tab e o marco pedido continuam montados longe da janela; **New messages** volta ao fim;
- os testes de teclado de hoje (`BoardView.keys.test.tsx`, `useFeed.test.tsx`, `Conversation.test.tsx`) continuam passando, com o que andar além da janela feito pelas teclas, como o usuário; `useFeed.test.tsx` ganha um `feed` de mais de dez entradas, para Page Up e Page Down andarem dez (`critique-task-04.md:104`);
- `conversation.test.ts`: depois de um `text`, toda linha que não é a da entrada que mudou é a mesma (`toBe`) de antes; um teste com o `Profiler` do React prova que um `text` renderiza uma `RowView` só.

#### A varredura de largura

**As cinco janelas:** 1100, 1250, 1450, 2000 e 2560 px de largura e 1080 de altura, que dão 812, 950, 1134, 1640 e 2180 px de área principal com a lateral em `clamp` (288, 300, 316, 360 e 380 px); com a lateral recolhida (60 px) a 1100 e a 2560. Nos dois temas.

**Os testes:** um por área, `features/<área>/<Vista>.widths.painted.test.tsx` (o de hoje, `features/task/TaskView.widths.painted.test.tsx`, é o primeiro deles e passa a usar o mesmo apoio), sobre um apoio novo em `test/widths.ts`, que desenha o shell inteiro (`AppShell`, com a lateral) com o estado da cena e a viewport do navegador do Vitest na janela. Assim o `--sidebar-width` em `vw` vale como no app, o que a área principal fixa de hoje (`test/painted.ts`, `mainArea`) não mostra.

**O que cada cena prova,** em cada janela e tema, com as funções de `test/painted.ts`: nenhuma rolagem horizontal na janela nem numa área que rola; toda caixa que o layout posiciona em pixel inteiro (`offWholePixels`): a lateral, o cabeçalho do lugar, a coluna da conversa, as barras, o compositor, as linhas de lista, os painéis, os diálogos; todo texto cortado com tooltip (`cutTexts`, `withoutTooltip`), com fixtures que cortam de fato (nomes longos em cada área, porque hoje nenhuma fixture da task corta, `critique-task-07.md:369`); no máximo uma primária visível na camada de cima (`visiblePrimaries`); nenhuma peça do cabeçalho sobre outra (`overlaps`); nas telas com conversa, as bordas da coluna iguais para entradas, barra e compositor (`conversationEdges`); todo controle com nome (V11, abaixo).

**As cenas provadas** são todas as das fixtures, com as variações: as nove da task (`task.md` §11, `test/task-scenes.ts`) e as sete da conversa (`lab/16-conversation-wide`: `planning`, `running`, `ask`, `long`, `error`, `retrying`, `review`; `test/conversation-scenes.ts`); as treze do board e `?home=none` (`board.md` §5; `test/board-scenes.ts`); as onze de Reviews e do review com `?own`, `?stale`, `?apply` e `?checkerr` (`lab/12-screen-review/README.md:76–90`; `test/review-scenes.ts`); as treze da discussão com as flags (`lab/13-screen-discussion/README.md:119–135`; as fixtures da task 9); as dezoito de `lab/14-screen-rest` com as variações (`README.md:68–90`; as fixtures das tasks 10 e 11).

**As capturas**, gravadas com `MYSPEC_CAPTURES=1` e publicadas por `task captures:push`, são uma por tela de referência (a cena, e a variação quando a linha a diz), nas cinco janelas e nos dois temas, 260 imagens, e as de `run` e `card` com a lateral recolhida, mais 8:

| Tela | Cena | Tela | Cena |
|---|---|---|---|
| Home | `home` | Discussão | `drafts` |
| Home sem item ativo | `home=none` | Nova discussão | `start` |
| Board com o painel | `card` | Settings › Defaults | `settings-defaults` |
| Board em seleção | `select` | O diálogo de board | `settings-boards`, `add-3` |
| Criação de task | `create-card` | Settings › Repositories | `settings-repos` |
| Task, implementador | `run` | Settings › Prompts, edição | `settings-prompts`, `edit` |
| Task, pergunta | `ask` | Início | `starting`, `slow` |
| Task, apontamentos da PR | `findings` | Boas-vindas | `welcome`, `no-login` |
| Conversa longa | `long` | Migração | `migration` |
| Reviews | `list` | History | `history` |
| Review | `findings` | Task arquivada | `archived-task` |
| Publicação | `publish` | Item que saiu | `gone`, `deleted` |
| Diálogo destrutivo | `delete-task` | Aviso e toasts | `notice`, `toast` |

**No motor do produto,** a revisão da branch fotografa o app real nas cinco janelas pelo Broadway, como o passe, e o crítico confere o meio pixel nas capturas ampliadas; o usuário confere no monitor dele (pronto 9).

#### O movimento reduzido

`app/motion.painted.test.tsx` (o nome é do tech spec), no Chromium com `prefers-reduced-motion: reduce` emulado (§4.4): o `Spinner` sem animação e como anel de três quartos; o `Shimmer` e as três formas do brilho chapados; a piscada de uma situação e a de um card novo sem animação; o painel auxiliar, o menu, o tooltip e o toast que entram e saem com duração zero; `Presence` sem laço (`critique-task-02-fixes.md:40`); `scrollToIndex` e toda rolagem programada sem `behavior: "smooth"`. E sem a emulação, as durações são as dos tokens (`--duration-fast`, `--duration-base`, `--duration-slow`). O comentário de `design/system/tokens.css:118` ("prefers-reduced-motion zeroes all of it") fica verdadeiro pela regra global de `globals.css:502–509`, que o teste lê.

#### Os nomes acessíveis

Na varredura, em cada cena: todo elemento que age (`button`, `a[href]`, `input`, `select`, `textarea` e os papéis `tab`, `menuitem*`, `option`, `radio`, `checkbox`, `switch`, `treeitem`, `link`) tem nome acessível não vazio, calculado por `computeAccessibleName` de `dom-accessibility-api` (dependência do Testing Library); todo `role="alert"` está numa região que nasceu depois da tela (`components.md:448`, Faixa de aviso: `role="alert"` para uma falha que chega; uma faixa presente ao montar não é alerta); nenhum `role="status"` nasce junto com o texto que anuncia (a região existe antes, vazia). Os nomes inteiros de cada tela continuam provados pelos testes de cada task, por `getByRole`.

#### A pauta de polimento (`lab/08-visual-final/critique.md` §7)

| # | Item | Estado em `ed5facf` | Nesta task |
|---|---|---|---|
| 1 | Três eixos de alinhamento no topo a 2500 px (149–154) | Não vale mais: o topo foi redesenhado numa faixa só (`task.md` §2, §3, aprovado em 2026-09-24) | O passe confere a distância entre o título e as ferramentas a 2560 px |
| 2 | A árvore marca a espera três vezes por linha: glifo, nome em 600, chip âmbar (155) | Como o system aprovou (`components.md` Linha da árvore, 334–347; Chip de tempo, 190–200) | Fica (`decisions.md` 2026-10-02) |
| 3 | A barra quieta com três marcas âmbar (156) | Feito na task 2: o rótulo em `--ink-1` (`components/system/RequestBar.tsx:107`) | — |
| 4 | A tecla sem a mesma forma num grupo: **Allow** `1` em caixa, `2` e `3` soltos (157) | Vale: `components/system/Button.tsx:123–131` tira a caixa da tecla fora da primária | Toda tecla de botão em caixa (`components.md` Etiqueta e tecla, e o mock decidido, `lab/16-conversation-wide/src/core.css:16–17`): contorno `--line-2` no secundário e no fantasma, `--brand-key-ring` na primária, `--line-1` e `--ink-4` no desabilitado. Área do system |
| 5 | `Enter to send · Shift+Enter…` sempre no compositor (158) | Feito na task 4 | — |
| 6 | Sem regra de transição entre lugares (159) | Feito: `components.md` Troca de lugar (152–161), o painel em `--duration-base` | — |
| 7 | A barra de rolagem não desenhada; o GTK pinta a dele (160) | Em parte: só o `ScrollArea` aplica a regra (8 lugares); 21 arquivos rolam nativamente (`Dialog.tsx`, `Listbox.tsx`, `Composer.tsx`, `PermissionCard.tsx`…) | Uma regra global `::-webkit-scrollbar` em `globals.css` com a anatomia de `components.md` Barra de rolagem. Área do system |
| 8 | Os botões de painel e **Pause** com o mesmo peso (161) | Feito nas tasks 2 e 3 (grupo que alterna, `components.md` Painel auxiliar) | — |
| 9 | O `…` do breadcrumb não diz o que esconde (162) | Feito na task 2 (`components/system/PlaceHeader.tsx:48–95`) | — |

#### A pauta das críticas

O que as críticas das tasks 1 a 8 deixaram para depois e nenhuma task levou, conferido contra o código em `ed5facf`, com a área do plano (§8). O PRD acrescenta os das críticas das tasks 9 a 11 com o mesmo critério. O que já está feito não entra: as segundas leituras fecharam T5 3–8, 12 e 20; T6 2 e 5–10; T7 1–10; T8 1–3, 7 e 8; a task 9 leva `critique-task-08.md:213`, `:221` e `:233`; também estão feitos `critique-task-04.md:97` (o `Review N written` com **Open in Reports**, `features/chat/markers.ts:366`; o `Discussion started` é da task 9, `09-discussion.md:147`), o `PR agent` de `07:517`, a condição `!pass.Sent()` de `flow/pr.go:764` e o `checked just now` de `features.md`.

| Origem | O que é | O que fazer | Área |
|---|---|---|---|
| `critique-task-01.md:150` (12) | Ícones fora de `icons.ts` (`components/system/Select.tsx:1`) | V2 | System |
| `critique-task-02-fixes.md:40`, `:42`, `:46`, `:48` (M1, M2, M4, M5) | `Presence` sem prova do laço e do teto; o trilho de erro do bloco da faixa sem prova (`SidebarRail.tsx:147`); a saída do toast empurrado repetindo `Presence` (`ShellToasts.tsx:21–60`); quatro toasts por 120 ms | As provas; a saída do toast pelo `Presence` | System |
| `critique-task-03.md:58` (3) | O nome acessível da pílula repete o lugar (`error: step 5 blocked in Step 5`, `features/task/stepper.ts:231–234`) | O nome sem a repetição | Task |
| `critique-task-03.md:64–70` (5, 6) | Os checks cortados em `Details` a 1250 (`ChecksList.tsx:93`); o status congelado de `request.ts`; o nome de **Resume** (`PauseButton.tsx:52`); `step_review` na aba do implementador (`agent-tabs.ts:108`); a escolha própria no popover Models (`ModelsPopover.tsx:129`) | O passe confere cada um contra `task.md`; o que divergir entra no relatório | Task |
| `critique-task-04.md:101` (2) | A opção do cartão de pergunta sem a forma pressionada nem a desabilitada (`QuestionCard.tsx:31`) | A forma pressionada (`--veil-press`) e a desabilitada visível, mantendo o `radio` ou o `checkbox` com `aria-checked` (`QuestionCard.tsx:305`, `:344`) | Task |
| `critique-task-04.md:102` (3) | A hora da resposta fora do nome da pergunta e da permissão respondidas (`QuestionCard.tsx:117`, `PermissionCard.tsx:135`) | A hora da resposta no nome da respondida | Task |
| `critique-task-04.md:103–111` (4) | Provas que faltam: Page Up e Page Down andando dez (o `feed` de teste tem três entradas, `useFeed.test.tsx:192–195`); `1`–`9` num cartão de várias perguntas; as setas com as entradas reais; as pastilhas só com `reply` no jsdom; `useFocusRescue` na tela (`TaskView.tsx`) e o foco no compositor depois de **Retry reviewer**; a chegada a uma permissão num teste de tela; o tooltip de **Go to …**; em `where-actions-went.test.tsx`, **Retry** do revisor, da PR e do review da PR, **Resume** fora do step e **Deny** com `defaultToNo` | As provas | Task |
| `critique-task-04.md:112` (5) | A razão do retry ignora `error_status` | Fecha como nota: `retryReasonOf` (`internal/session/events.go:409–425`) já reconhece `overloaded` e `529` no texto do erro, que o CLI manda junto (`internal/claude/testdata/api-retry.jsonl:3`); o número não muda a razão | — |
| `critique-task-04.md:113` (6) | `GetActionOutput` só no `TaskService` (`internal/bindings/task_service.go:285`) | Fecha como nota: a leitura é pela chave da sessão do item (`session.Key{TaskID}`), e serve à conversa de um review e de uma discussão pelo mesmo método; `docs/architecture/overview.md` diz isso | — |
| `critique-task-04.md:114` (7) | Sem teste de `Close` esperando `spawnPRWork` (`internal/flow/pr.go:322–340`) | O teste Go (é prova, não comportamento) | Task |
| `critique-task-04.md:115–118` (8) | Valores soltos: `max-h-48` (`PermissionCard.tsx:81`), `h-8` (`chat/Markdown.tsx:134`) | Os tokens que existem; um token novo só onde nenhum serve | Task |
| `critique-task-04.md:119–123` (9) | O `panZoom` do mermaid (`Markdown.tsx:17`); o cursor do streaming numa linha nova; o cabeçalho do código sem caminho nem intervalo; `BackToEnd` anulando o hover (`BackToEnd.tsx:32`) | Cada um contra `components.md` Bloco de código e Volta ao fim | Task |
| `critique-task-04.md:124` (10) | As fixtures da conversa: os `sed`/`cat` de `STEP_3_READS` sem saída (`test/conversation-scenes.ts:396`); o grupo vivo que começa antes de `turnStartedAt` (`4m 0s` contra `3m 40s`); o arquivo do step com outro nome que o do mock | As fixtures como o mock | Task |
| `critique-task-04.md:125` (11) | `blockHint` de `clone_missing` manda a Settings (`features/task/step-status.ts:229`) e a barra oferece **Change path…** | O texto diz o que a barra faz | Task |
| `critique-task-04.md:132` (nota 3) | O lugar vazio que muda com a tela aberta não é anunciado | O anúncio pela região do app (`store.announce`) | Task |
| `critique-task-05.md:155` (1) | `--col-dep` e `--size-dialog-wide` sem prova com conteúdo real (`NewTaskDialog.scenes.painted.test.tsx:54–59`) | Um nome de 64 caracteres e `#1291 +1` nas fixtures | Board |
| `critique-task-05.md:160` (2) | `S` e `D` no painel de um card fora da leitura sem teste na visão (`BoardView.tsx:378`) | O teste | Board |
| `critique-task-05.md:183` (9) | O item desabilitado com ação, focado no escuro, a 4,44:1 (`components/system/Menu.tsx:234`) | `--ink-3` com o foco | System |
| `critique-task-05.md:188` (10); `critique-task-06.md:173` (4) | As faixas sempre `role="alert"` (`BoardReadingStates.tsx:48`, `ReviewsReadingStates.tsx:46`, `CheckStrip.tsx:47`) | Alerta só quando a falha chega (`components.md:448`; V11) | Board; Reviews |
| `critique-task-05.md:200` (13) | A linha 2 de **Continue** não corta (`components/system/Continue.tsx:61`) | Corta com tooltip (`tasks/05-board.md:104`) | Board |
| `critique-task-05.md:202` (14) | A falha na linha de board da Home sem tooltip (`components/system/StartRow.tsx:214–222`); a task 10 não toca `BoardStartRow` | O tooltip com a hora da falha e a da leitura (`components.md:319`, `ReadAge` `failed`) | Board |
| `critique-task-05.md:204` (15) | A Home ordena o que bloqueia por tipo (`features/home/home.ts:166–192`) | Por repositório, em ordem alfabética (`screens/board.md` §2) | Board |
| `critique-task-05.md:206` (16) | `◇` como caractere solto (`DependencyNotice.tsx:27`, `RelationList.tsx:87`, `DetailsPanel.tsx:512`, `home.ts:178, 189`, `CardContextLine.tsx:123`, `NewTaskDialog.tsx:104`, `FilterBar.tsx:61`) | O `StateGlyph blocked` | System |
| `critique-task-05.md:213` (17) | `Shortcuts:` em `sr-only` dentro de um `<p>` (`features/home/Home.tsx:194`) | Um `role="group"` com o nome `Shortcuts` | Board |
| `critique-task-05.md:215–221` (18) | `The clone is running.` sem registro (`card-panel.ts:128`); o link `Archived task:` que cobre a frase inteira (`BoardCardPanel.tsx:160`); a barra da seleção sem o esmaecido (`BoardView.tsx:450`); `_app` sem uso (`board-view.ts:144`); `no card to select` (`BoardView.tsx:410`) | Cada um, contra `board.md` e `tasks/05-board.md` | Board |
| `critique-task-05.md:223–226` (19) | Provas curtas: `slice(0, 8)` dos cortes (`BoardView.scenes.painted.test.tsx:113`); o aviso de dependência sem contorno do diálogo (`NewTaskDialog.tsx:339`); a fiação de `internal/app/state.go:74` (`FromBoards` com `CardWriters` e `CardTasks`) não testada | As provas inteiras; um teste Go do estado com um card de task e um escrito por discussão | Board |
| `critique-task-05.md:230–233` (21) | A região `role="status"` do `KeyNotice` nasce com o texto, em `--z-overlay` (`components/system/KeyNotice.tsx:100`); o nome da linha sem `Clone failed` e `Cloning…` (`board-view.ts:538–558`); a razão do chip órfão só no tooltip | A região antes do texto, acima do tooltip; os nomes inteiros | System; Board |
| `critique-task-05.md:392` (segunda leitura) | O comentário de `REVIEW_MODES` meio verdadeiro (`lib/review-modes.ts:3`) | O comentário diz a ordem que vale, quando o `ReviewModePicker` sai | System |
| `critique-task-05.md:393` (segunda leitura) | `closePanel` acha o painel pela classe (`BoardView.tsx:198–199`, `.closest(".list-panel")`) | Um `ref` do `ListPanel` | Board |
| `critique-task-05.md:394` (segunda leitura) | O `role="status"` de `Cloning` nasce com o texto (`components/system/StartRow.tsx:143`) | A região antes do texto, como o item 21 | Board |
| `critique-task-06.md:155` (1) | A consulta do GitHub sem validação contra o schema (`internal/pulls/github_test.go:264`) | Um teste contra o schema público do GitHub, sem rede | Reviews |
| `critique-task-06.md:169` (3) | O anel de foco some no WebKitGTK depois de um clique (`components/system/ListRow.tsx:103, 117`, `:focus-visible`) | O passe confere no Broadway; a correção segue `components.md` (foco do teclado); o usuário confere (pronto 9) | System |
| `critique-task-06.md:212` (11) | O recuo do visto no menu **Filter**: **Board** e **Repository** com, **Author** e **Label** sem | Um recuo só | Reviews |
| `critique-task-06.md:343` (Novo) | `06-review.md:289` e `task.md:207` não escrevem `Ctrl E` no **Open in VS Code** da barra | A régua, pelo coordenador antes de `Ready`; o botão já a tem | — |
| `critique-task-06.md:344` (Novo) | O fio entre as linhas de **Models** no diálogo de criação sem prova | A prova | Board |
| `critique-task-07.md:369` (4) | A prova do texto cortado não morde: nenhuma fixture da task corta (`TaskView.scenes.painted.test.tsx:406–425`) | Fixtures com nomes longos; a varredura as herda | Task |

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas pelo coordenador, por delegação, em `decisions.md` (as entradas de 2026-10-02 que citam esta seção, uma por decisão) e nos documentos a que pertencem.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | O passe e o plano: o relatório precisa existir antes do PRD, e o tamanho só se sabe com ele | O coordenador roda o passe antes de `Ready`; o plano tem um step por área com itens; a task é M a G, de 5 a 14 steps | `implementation.md` §2 e `### 12.` |
| 2 | `implementation.md:178` citava `.dark`, Inter e JetBrains Mono, que já saíram | A lista do que sai como ela é hoje | `implementation.md` `### 12.` |
| 3 | "Fechar a porta" sem dizer como, e `test:web` só roda o que mudou | O Biome para importações; `styles/design-rules.test.ts` rodado sempre por `lint:web`; `knip` para órfãos | `decisions.md` |
| 4 | A escala de tipo e os laços soltos, que nenhuma verificação via | Entram como V6 e V7, pela regra de `design-system.md` (Utilitários) e de `principles.md` 8 | `decisions.md` |
| 5 | O `CutCode` e o `CopyButton` (`tasks/10-settings.md:76`), e a cópia do Streamdown nos blocos curtos | Um **Copy** só, o `CopyButton`, no cabeçalho de todo bloco de código, `Copy the code` | `components.md` Bloco de código, Marca e cópia |
| 6 | A pauta 2 (a árvore com três marcas da espera) contra o system aprovado depois dela | Fica: os três portadores têm formas diferentes e um matiz só, o chip é o tempo de espera que se vê de longe (`decisions.md` 2026-09-23), e a cor nunca é o único portador (`principles.md` 5) | `decisions.md` |
| 7 | A tecla do botão: caixa só na primária (o código) contra "a mesma forma num grupo" (`components.md:129`) e o mock decidido | Toda tecla em caixa | `components.md` Etiqueta e tecla |
| 8 | A barra de rolagem fora do `ScrollArea` | Uma regra global `::-webkit-scrollbar` com a mesma anatomia, sem trilho, para toda área que rola | `components.md` Barra de rolagem |
| 9 | Os primitivos de `components/ui/` sem uso | Saem; um `shadcn add` os traz de volta | `decisions.md` |
| 10 | Os componentes do system sem uso depois da task 11 | Saem do código; `components.md` fica | `decisions.md` |
| 11 | As metas da virtualização "abaixo de 16 ms" sem dizer de que build, e a conversa aberta, que ninguém mediu | A tabela da §4.2: produção pelo máximo, desenvolvimento pela mediana; o cenário com os trechos abertos, `↓` e `Home` | `decisions.md` |
| 12 | Onde fica o registro das medidas | `docs/development/target-machine.md`, porque o produto é virtualizado e a documentação descreve o estado atual | `decisions.md` |
| 13 | A lista de Reviews | Sem janela, com o teclado por índice de `useListTree` | `screens/review.md` §16 |
| 14 | A cauda da conversa | Fora da janela, sempre montada | `screens/task.md` §12 |
| 15 | A posição das linhas da janela | No fluxo, com espaçadores em pixel inteiro, sem `transform` | `structure.md` §7 |
| 16 | `role="alert"` nas faixas que já estão na tela | Só quando chegam (`components.md:448`) | `decisions.md` |
| 17 | A Home ordena o que bloqueia por tipo (`home.ts`) contra `tasks/05-board.md:121` | Por repositório, em ordem alfabética, como o material | `screens/board.md` §2 |
| 18 | `structure.md:424`, `task.md:365` e `board.md:373` dizem que a virtualização "entra só se a medição pedir" | A conversa e o board são virtualizados; o texto passa a dizer como | `structure.md` §7; `screens/task.md` §12; `screens/board.md` §6 |

### 4.4 O que o tech spec toma

- **As regras do Biome.** `style/noRestrictedImports` com `paths` para `lucide-react` e `patterns` para `@/components/ui/*`, e um bloco `overrides` para `frontend/src/components/system/**` e para `frontend/src/styles/globals.test.tsx`. A versão do Biome é a de `mise.toml`; o tech spec confere a forma da opção no schema 2.5 (`biome.json:2`).
- **`styles/design-rules.test.ts`.** As regras V3 a V7 como expressões sobre o texto de cada arquivo do escopo da §4.2, cada uma com o caso que a viola; os nomes do shadcn lidos de `globals.css` (a ponte, 134–160) e os tokens do system de `design/system/tokens.css`, para a lista nunca ficar à mão. `lint:web` ganha o comando que o roda, com `dir: frontend`.
- **`knip`.** Pinado exato em `devDependencies`, configurado em `frontend/knip.json` com as entradas (`src/main.tsx`, `src/dev/*.tsx`, os testes pelo plugin do Vitest), `components/ui/**` e `bindings/**` ignorados, e `--include files,dependencies`. O step que o acrescenta mede `task check` antes e depois e registra o tempo em `docs/development/`.
- **O hook da janela.** A forma de `useWindowedRows` (a estimativa por linha, o `overscan` de partida: 20 linhas no board, 6 unidades na conversa, ajustados pela medição; os espaçadores com o `gap`; a correção da rolagem acima da vista); o jsdom, que não tem layout: o elemento que rola recebe um tamanho fixo em `test/setup.ts`, e a janela monta o que esse tamanho mostra, para os testes acharem as linhas como o usuário as acha.
- **O teclado por índice.** `useListTree` e `useFeed` passam a receber o índice e `scrollToIndex`; o foco vai à linha no efeito seguinte à montagem. `lib/focus.ts` (`focusFindingToDecide`) continua achando o apontamento no DOM, porque o cartão de decisão está fixado.
- **O React de produção na medição.** `main.tsx` monta as medições com `import.meta.env.DEV` ou com uma variável de build própria, nunca no build de `task build`; o comando entra em `docs/development/setup.md` (73–75).
- **A viewport e o movimento no navegador do Vitest.** `page.viewport()` do modo navegador para as janelas; `prefers-reduced-motion` por um comando do navegador (`commands` em `vitest.config.ts`) que chama `emulateMedia` do Playwright.
- **`LIST_COLUMN` e `FLASH_MS`.** `LIST_COLUMN` vai para o system, ao lado de `ListPanel`; `FLASH_MS` é o de `lib/situations.ts`.

## 5. Inventário atual

Sobre a `main` em `ed5facf`. O PRD refaz cada contagem com o comando da §4.2, na `main` em que a task começa.

### 5.1 As verificações hoje

| Arquivo | O que é | Destino |
|---|---|---|
| `biome.json` (1–80) | `a11y` recomendado, `noLabelWithoutControl`; nenhuma regra de importação | V1, V2 |
| `styles/globals.test.tsx:163–187` | Varre `src` (salvo `components/ui/`, `test/` e testes) atrás de `oklch(`, `rgb(a)`, `hsl(a)`, hex e a paleta do Tailwind (`TAILWIND_PALETTE`, 52) | Muda para `design-rules.test.ts` (V3) |
| `styles/globals.test.tsx:101–128` | O `@import` único dos tokens; a ponte sem valor próprio | Fica |
| `styles/globals.test.tsx:234`, `features/task/AgentTabs.test.tsx:205` | A piscada sem movimento, lendo o CSS | Ficam; V10 cobre o resto |
| `components/system/Icon.test.tsx:57–75` | Um ícone de significado só por `icons.ts`, dentro do system | Fica; V2 cobre o resto |
| `Taskfile.yml:71–81` (`lint`, `lint:web`), `:97–101` (`test:web --changed`), `:191–194` (`check`) | O que `task check` roda | `lint:web` ganha `design-rules.test.ts` e `knip` |
| `.github/workflows/ci.yml:86`, `:97` | `task lint:web` e `pnpm test` inteiro | Sem mudança: as verificações novas entram por `lint:web` |

### 5.2 O que sai, hoje

| O que | Contagem | Onde mais pesa |
|---|---|---|
| Importações de `components/ui/` fora do system | 85 linhas, 35 arquivos | `boards/` 5, `discussion/` 10, `history/` 2, `repositories/` 5, `settings/` 2, `task/` 5 (`ContextGauge`, `DeleteTaskDialog`, `DiscardStepDialog`, `OneShotView`, `StageActionDialog`), e `models/ModelPicker`, `notice/Notice`, `review-mode/ReviewModePicker`, `reviews/ArchivedReviewView`, `sidebar/RepositoryFilter`, `welcome/WelcomeScreen` |
| Classes de cor do shadcn | 164 linhas, 43 arquivos (`text-muted-foreground` 103, `bg-background` 19, `text-destructive` 18, `text-foreground` 10, `bg-destructive/NN` 9, `ring-ring` 6, `bg-accent` 6…), `globals.css` incluído | `HistoryPanel` 13, `DraftCard` 12, `StepList` 10, `NewDiscussionDialog` 10, `RepositoryRow` 8, `AddRepositoryDialog` 8 |
| `--status-*` | 5 aliases; 10 leitores de produção, 4 testes (`StepList.test.tsx:293`, `ContextGauge.test.tsx:22`, `DraftDiff.test.tsx:13, 21`, `DiscussionHeader.test.tsx:95, 113`) | §4.2 O que sai |
| Escala de tipo do Tailwind | 157 linhas, 34 arquivos, `globals.css:294` incluído | `DraftCard` 21, `NewDiscussionDialog` 13, `RepositoryRow` 10, `HistoryPanel` 10; fora das tasks 9 a 11: `ReviewModePicker` 2, `ModelPicker` 1, `ContextGauge` 1, `globals.css` 1 |
| `lucide-react` direto | 30 arquivos de `features/`; no system, `Chip`, `Listbox`, `PlaceHeader`, `SearchInput`, `Select` (chevrons e setas, permitidos por `Icon.test.tsx`, salvo o que for significado) | A lateral (6 arquivos) |
| Laços soltos | 7 linhas, uma delas o comentário de `Skeleton.tsx:26` | `StatusDot` e as áreas das tasks 9 e 10 |
| `react-resizable-panels`, `ui/resizable`, `ui/scroll-area`, `ui/separator` | 1 pacote, 3 primitivos sem import | — |
| `.dark`, Inter, JetBrains Mono | Zero | — |
| Componentes antigos vivos | `ModelPicker` (4 leitores), `ReviewModePicker` (2), `StatusDot` (3), `ContextGauge` (1), `CardLink` (2), `StepList`/`OneShotView` (1), `notice/Notice` (7), `LeftoversNotice` (1), `RepositoryFilter` (1), `useFindingText` (2) | §4.2 O que sai |

### 5.3 A conversa e o board

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `chat/Conversation.tsx` (1–413) | `buildConversation` a cada render (`useMemo` sobre `entries`); `RowView` sem `memo`; todas as linhas dos trechos abertos montadas; a cauda depois (`endLine`, `after` órfãos, `fixed`, fila, atividade) | O custo por quadro e a janela (§4.2) |
| `chat/conversation.ts` (1–526) | `buildConversation` (427), `foldableStretches` (442), `lastMarkerOf` (458), `stretchFoldOf` (506) | O modelo que reaproveita as linhas |
| `chat/useAutoScroll.ts` (1–116) | Segue o fim pelo `scrollHeight` e por um `ResizeObserver` no conteúdo; `newCount` pelas chaves | Segue a altura total da lista; a volta ao fim por índice |
| `chat/useFeed.ts` (1–294) | Anda pelo DOM (`[data-feed-item]`), refaz a parada de Tab em cada mudança; `PAGE = 10` (22) | Por índice; ignora o texto que cresce |
| `chat/ConversationColumn.tsx`, `components/system/ScrollArea.tsx` | O viewport do Base UI que rola | O elemento que a janela observa |
| `store/transcript.ts` (`applyEvent`, 75–118) | Um `text` troca só a entrada que cresce | Sem mudança: é o que o modelo usa |
| `features/reviews/useConversationAnchors.tsx`, `task/usePRConversationAnchors.tsx` | Os nós `after` (o cartão de apontamentos, `You decided`) | A unidade do cartão fixada enquanto há o que decidir |
| `board/CardTree.tsx` (1–155) | Todas as linhas de `rows` montadas; `CardRow` sem `memo`; `models` para todos os cards | A janela do board |
| `board/useListTree.ts` (1–195) | O teclado pelo DOM (`querySelectorAll`, `scrollIntoView`), compartilhado com `reviews/PullRequestTree.tsx` | Por índice |
| `board/board-view.ts` (1–672) | `boardRows`, a lista plana | O que vira janela |
| `dev/measure-conversation.tsx` (1–283), `dev/measure-board.tsx` (1–392), `main.tsx:12–23` | As medições, só no servidor de dev | O cenário com os trechos abertos, `↓` e `Home`; a via do React de produção |

### 5.4 Movimento e nomes

| Onde | Hoje |
|---|---|
| `styles/globals.css:219–261` | O giro e as três formas do brilho, parados com movimento reduzido |
| `styles/globals.css:434–439` | A piscada de um card novo só com `no-preference` |
| `styles/globals.css:502–509` | Com movimento reduzido, toda transição e animação a 0 ms |
| `design/system/tokens.css:118` | O comentário que promete o zero, sem bloco de media (a regra está em `globals.css`) |
| `components/system/Skeleton.tsx:29` | `motion-reduce:animate-none` |
| `components/system/IconButton.tsx:11, 54` | `label` obrigatório, que vira o `aria-label` |
| Botões de ícone antigos (`size="icon*"`) | 7 arquivos, todos com `aria-label` (`Notice`, `ArchivedTaskView`, `NewDiscussionDialog`, `DependencyList`, `ArchivedDiscussionView`, `DiscussionHeader`, `ArchivedReviewView`) |
| `<button` cru em `features/` | 17 arquivos (`chat/entries/*` 7, `HistoryPanel` 3, `ChangedFilesCard` 2, `StepList` 2…), não auditados um a um: a varredura os cobre |

### 5.5 A documentação que contradiz o fim da task

| Arquivo | O que diz |
|---|---|
| `docs/guidelines/frontend.md:24` | "As importações de `components/ui/` que existem nas features são as das telas anteriores ao design system" |
| `docs/architecture/design-system.md:40` | Os aliases `--status-*` "para as telas que ainda as leem" |
| `docs/architecture/design-system.md:147` | Os próprios sem estado interativo "ainda não têm a sua" prova pintada |
| `docs/architecture/design-system.md:173` | A lista do board com os cabeçalhos e as linhas irmãos no DOM, sem janela |
| `docs/development/setup.md:73–75` | As medições só no servidor de dev |
| `docs/architecture/overview.md:172` | `useListTree` pelo DOM; `useFindingText`; `CardLink` dos cabeçalhos |

### 5.6 O que as tasks 9, 10 e 11 mudam antes desta

| Task | O que tira ou reescreve | O que deixa para esta |
|---|---|---|
| 9 | `DiscussionHeader`, `DiscussionBar`, `DraftsPanel`, `EpicGroup`, `DraftCard`, `DependencyList`, `DraftDiff`, `DiscussionContextPreview` saem; `NewDiscussionDialog` e `DocumentsPanel` reescritos no system (`09-discussion.md:468–485`, `:591–595`); a discussão deixa de usar `ToneDot` e `ContextGauge` (`:75`) | O `ModelPicker` no diálogo (`:73`, `:109`); `ContextGauge` órfão, se a 9 não o tirar |
| 10 | `features/settings`, `boards`, `repositories`, `welcome`, `migration` reescritos; `ModelChip` com o menu decidido; `ReviewModeOptions` extraído; `CopyButton`, `CopyBlock`, `BrandMark` nascem; `Defaults` deixa `ModelPicker` e `ReviewModePicker` (`10-settings.md` §5.1, `:75`) | A remoção dos dois pickers; o `CutCode` com o `CopyButton` (`:76`) |
| 11 | `features/history` (`HistoryPanel` e `history-format.ts` saem), os arquivados, os diálogos da task, o aviso do app, os toasts, os textos das notificações; saem `RepositoryFilter`, `OneShotView`, `StepList` (com `StepReportList`), `StatusDot`, `CardLink`, `OrphanPRs`, `LeftoversNotice` e `notice/Notice` (`11-history-dialogs.md:576–598`) | A virtualização do History, se a medida da 11 passar das metas (`11-history-dialogs.md:666`) |

Cada uma acrescenta as cenas dela às fixtures (`test/discussion-scenes.ts`, `test/settings-scenes.ts` e as da 11), que a varredura usa.

## 6. Riscos, as outras tasks e o primeiro step

| Risco | Tratamento |
|---|---|
| **A janela da conversa no WebKitGTK** | O WebKit não tem `overflow-anchor`: a correção da rolagem acima da vista é da lista, provada no Chromium com `overflow-anchor: none` e conferida no Broadway e pelo usuário (pronto 9). A janela vem depois do custo por quadro, num step próprio, para a medida dizer o que cada parte ganhou |
| **O teclado que andava pelo DOM** | `useFeed`, `useListTree` e `lib/focus.ts` achavam a linha no DOM. Por índice, com as linhas fixadas (a parada de Tab, os cartões pendentes, o de decisão), e os testes de teclado de hoje continuam passando |
| **O jsdom sem layout** | O elemento que rola com tamanho fixo em `test/setup.ts`; os testes que andam além da janela o fazem pelas teclas |
| **O meio pixel da janela** | Espaçadores em pixel inteiro, sem `transform`; a varredura e as capturas ampliadas conferem |
| **O tamanho dos steps de remoção** | V1 a V7 tocam dezenas de arquivos. O step 1 fica com a cor, o texto e o movimento, o 2 com as importações e os órfãos; cada um se divide por pasta se passar de 1,5 mil linhas |
| **Uma área grande no relatório** | O plano é feito com o relatório na mão: uma área que passa de 1,5 mil linhas se divide em dois steps, até o total de 14; passar de 14 vai ao usuário antes de `Ready` (§1) |
| **O tempo da varredura** | Cerca de 70 cenas, cinco janelas, dois temas. Um arquivo por área, para `test:web --changed` rodar só o que a mudança alcança; inteira na CI. As capturas só com `MYSPEC_CAPTURES=1` |
| **`task check` mais lento** | `design-rules.test.ts` e `knip` rodam sempre; os steps 1 e 2 medem o `task check` antes e depois e registram em `docs/development/` |

**As outras tasks.** A 12 começa depois do merge da 11 e do passe, e não corre em paralelo com nenhuma; nenhuma outra task toca a branch dela. As tasks 9 a 11 mudam o inventário (§5.6), por isso o tech spec o refaz.

**Como o primeiro step é feito.** É o step 1 da §8, a cor, o texto e o movimento: o teste `styles/design-rules.test.ts` com V3 a V7 e o caso que viola cada regra, a varredura de cor de hoje movida para ele, o comando em `lint:web`, e as trocas que ele pede para passar (os `--status-*` e os leitores, as classes do shadcn, a escala de tipo, os laços soltos, a camada base de `globals.css`), com `task check` medido antes e depois. As trocas usam o token que a ponte já pintava (`text-muted-foreground` é `--ink-3`, `text-destructive` é `--state-error`) e, no tamanho de texto, o registro de `design-system.md` que a peça tem no system; o que mudar à vista numa tela antiga é conferido nas capturas da área dela.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/guidelines/frontend.md` (Componentes, 24; Estilo, 40; Acessibilidade) | As features importam só do system e os ícones só de `icons.ts`, pelo Biome; as regras do design rodadas sempre; o tamanho de texto e o movimento só pelos tokens; um primitivo sem uso sai | 1, 2 |
| `docs/architecture/design-system.md` (Ponte do shadcn, 20–40; Componentes, 94–; Listas, 173; Regras do WebKitGTK, 79–89) | Sem `--status-*`; a ponte como único lugar dos nomes do shadcn; a janela, os espaçadores e `aria-posinset`; o `CopyButton` no bloco de código; a tecla em caixa; a barra de rolagem global; os componentes que saíram | 1, 2, 3, 5, 6 |
| `docs/architecture/stack.md` (Frontend, 96) | `@tanstack/react-virtual` e `knip`, com a razão de cada um | 2, 3 |
| `docs/guidelines/testing.md` | A varredura, o apoio `test/widths.ts`, o movimento emulado, as regras do design | 1, 12 |
| `docs/architecture/overview.md` (Features, 172; Estilo, 176) | `useWindowedRows`; `useListTree` e `useFeed` por índice; o que saiu (`useFindingText`, os pickers); `GetActionOutput` pela chave da sessão de qualquer item | 2, 3, 4, 5 |
| `docs/development/setup.md` (73–75) | O cenário novo da conversa e a via do React de produção | 3, 4 |
| `docs/development/target-machine.md` | As medidas da conversa e do board, as duas builds, o motor e a versão; a varredura e o meio pixel conferidos no WebKitGTK; como o app roda sem janela pelo Broadway | 3, 5, 12 |
| `docs/product/features.md` (Sessões e conversas, 769; Visão do board; Tela de boas-vindas; Atalhos) | O que os steps de área mudarem de visível; a conversa longa sem limite prático de entradas; a ordem do que bloqueia na Home | 5 a 11 |
| `docs/` inteiro | A conferência contra o que a task fez | 12 |

## 8. Plano de steps sugerido

De 5 a 14 commits, M a G, pelo relatório (`implementation.md` §2). Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga, e muda até umas 1,5 mil linhas; o que passa disso se divide em dois, por pasta ou por tela. Os steps 1 a 5 e o 12 são fixos (o 4 e o 5 viram um só quando juntos ficam abaixo de 1,5 mil linhas); os de 6 a 11 são as áreas do relatório (§4.2, O passe do crítico), e uma área sem item no relatório nem nas pautas não tem step. O plano numera os steps na ordem abaixo, sem buracos.

1. **A cor, o texto e o movimento.** V3 a V7 em `styles/design-rules.test.ts`, rodado sempre por `lint:web`, com a varredura de cor de hoje movida para lá; os `--status-*` e os leitores; as classes de cor do shadcn, a escala de tipo e os laços soltos trocados pelos do system; a camada base de `globals.css`. A medida do `task check` antes e depois.
2. **As importações e os órfãos.** V1 e V2 no Biome; V8 com `knip`; o `ModelChip` nos diálogos de review e de discussão; saem `ModelPicker`, `ReviewModePicker`, `ContextGauge` e `RepositoryFilter` se ainda existirem, `useFindingText`, `react-resizable-panels`, os primitivos sem uso e o que as tasks 9 a 11 deixaram órfão; `FLASH_MS` e `LIST_COLUMN`. Nada muda na tela além do chip nos dois diálogos, que é o decidido.
3. **A janela do board.** `@tanstack/react-virtual`, `useWindowedRows`, `useListTree` por índice, `CardRow` com `memo`, o modelo por linha montada, `aria-level`, `aria-setsize`, `aria-posinset`; a linha de base de produção e a medida depois; `BoardView.window.painted.test.tsx`.
4. **A conversa: o custo por quadro.** O modelo que reaproveita as linhas, `RowView` com `memo`, `useFeed` que ignora o texto que cresce; o cenário dos trechos abertos no script; a medida.
5. **A conversa: a janela.** As unidades, a cauda, as fixadas, a âncora do fim, a correção acima da vista, o `feed` por índice com `aria-posinset`; `Conversation.window.painted.test.tsx`; a medida final das duas listas em `target-machine.md`.
6. **O system, o shell e a árvore.** Os itens do relatório da área, a tecla em caixa em todo botão, a barra de rolagem global, o **Copy** em todo bloco de código e os itens "System" da pauta das críticas.
7. **A task.** Os itens do relatório da área e os itens "Task" da pauta das críticas.
8. **Home, board e criação.** Os itens do relatório da área, a ordem do que bloqueia na Home e os itens "Board" da pauta das críticas.
9. **Reviews e o review.** Os itens do relatório da área e os itens "Reviews" da pauta das críticas.
10. **A discussão.** Os itens do relatório da área e os das críticas da task 9.
11. **Settings, History e diálogos.** Os itens do relatório da área e os das críticas das tasks 10 e 11; a janela do History, se a medida da 11 a pedir (§3).
12. **A varredura, o movimento e os nomes.** `test/widths.ts` e um `*.widths.painted.test.tsx` por área com todas as cenas; V9 a V11 e o que elas pegarem; as capturas por `task captures:push`; a checklist `## Verification on the target machine` no corpo da pull request; a conferência de `docs/` inteiro.

Cada step de área escreve no relatório, ao lado de cada item, o commit que o fecha. Depois do último step, e antes do merge, o `design-critic` revisa a branch e acrescenta `Revisão da branch` ao relatório (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.

## 9. Para o usuário confirmar

Nada. O que a task muda é forma, verificação ou desempenho, dentro do que o usuário aprovou ao aprovar o plano (`implementation.md` §4). O passe roda antes de `Ready`, e o que ele achar de comportamento passa pelo coordenador e por `changes.md` antes de a task começar; uma mudança que altere um fluxo, apague dado ou desdiga o aprovado vai ao usuário pelo coordenador, com mock e recomendação. O tamanho, de 5 a 14 steps, é do plano e está registrado em `implementation.md`; passar de 14 seria mudança de escopo e vai ao usuário antes de `Ready`.
