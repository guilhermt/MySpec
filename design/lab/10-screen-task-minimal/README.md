# 10 · A tela da task, mínima

Fase 4, primeira tela, segunda rodada. A rodada 09 foi descartada por poluição (`decisions.md`, 2026-09-24, "A tela da task é mínima"). Esta rodada refaz a tela com a régua invertida.

**A régua.** Cada elemento na tela justifica por que existe, ou sai. A tela tem três coisas:

1. o indicador de progresso, que diz de um olhar em que etapa a task está, o que já foi concluído e o que está rodando;
2. a conversa do lugar atual, uma só;
3. o compositor, com a barra do pedido acima dele quando algo espera o usuário.

O resto vive fechado: no painel `Details` (os fatos da task, os steps, as conversas anteriores e os relatórios), no `Artifacts` (os documentos), no `Card` (o card) ou no menu `⋯` (as ferramentas do step, da PR e da task).

As duas variações são mínimas e iguais em tudo, menos em duas coisas: o indicador de progresso e o jeito como implementador e revisor aparecem.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `a.html` | **A · A linha**, nas nove cenas |
| `b.html` | **B · O stepper**, nas mesmas nove cenas |
| `components.html` | Os componentes novos ou mudados, em todos os estados, claro e escuro lado a lado |
| `src/` | As fontes. `base.css`, `core.css`, `core.js` e `content.js` são cópias sem mudança da 09 (a conversa, os cartões, a barra do pedido, o compositor, a árvore e a auditoria). `m.css` e `m.js` são a tela mínima compartilhada. `line.js` e `a.*` são a variação A, `stepper.js` e `b.*` a B, e `components.*` o espécime. `build.py` gera as páginas |

As páginas são geradas por `python3 design/lab/10-screen-task-minimal/src/build.py`. Cada uma é autocontida e traz `design/system/tokens.css` byte a byte, entre marcadores. O script confere a igualdade.

## Como abrir

Sirva a lab (`python3 -m http.server 8090 -d design/lab`) e abra `10-screen-task-minimal/a.html` e `b.html`. Um seletor no canto inferior direito, que não é do produto, troca a cena. Os parâmetros:

- `?scene=`: `plan`, `run`, `ask` (o padrão), `error`, `manual`, `blocked`, `checks`, `findings` ou `close`;
- `?theme=light` ou `?theme=dark`;
- `?panel=Details`, `Artifacts` ou `Card`, para abrir um painel;
- `?menu`, para abrir o `⋯`;
- `?past=s2i` (ou `s2r`, `prd`, `spec`, `plan`, `pr`), para ler uma conversa anterior;
- `?voice=impl` ou `?voice=rev`, para abrir a conversa do outro agente;
- só na A, `?legend`, que mostra os nomes das etapas sob a linha;
- `?audit`, que mostra o relatório de geometria, corte, nomes e contraste;
- `?clean`, que esconde o seletor.

Tudo o que a tela mostra é clicável: os painéis, o `⋯`, as conversas anteriores em `Details`, **Back to step 3**, a troca de agente (o controle na A, as abas na B, e `Alt+`\`` nas duas), **Show** e **Go to…** da barra, os marcos, os grupos de ações e o tema. Na A, passar o mouse na linha, focá-la ou clicar nela mostra os nomes das etapas.

## O que saiu em relação à 09, e por quê

| Saiu | Por quê | Onde ficou |
|---|---|---|
| Os capítulos do passado no alto da conversa (A da 09) | Voltar a uma etapa ou a um step anterior não é uma necessidade | `Details`: cada step feito lista as suas conversas e os seus relatórios, e **Planning** lista PRD, Tech spec e Plan. Um clique lê a conversa no lugar, somente leitura |
| A margem de marcos e o popover dela (A da 09) | Uma terceira representação do progresso, a mesma coisa três vezes (crítica A.8) | O indicador de progresso |
| O cabeçalho do capítulo, com os tempos do loop (A da 09) | Uma segunda faixa de cromo acima da conversa. O laço entre os agentes aparece na própria conversa, pelas mensagens do produto (`MySpec → Implementer · Review 1 · 2 findings · round 1 of 3`) | A conversa |
| O filtro de vozes (A da 09) | Um controle que escondia pedidos (crítica A.2). Com uma conversa por vez, não há o que filtrar | — |
| O trilho de workflow à esquerda (B da 09) | Uma segunda lateral, que empurrava a conversa na metade do monitor (crítica B.1, B.3) | O indicador de progresso e `Details` |
| A coluna de apontamentos (B da 09) | 300 px a menos para ler | O cartão de decisão na conversa, com a barra de decisão, como na A da 09 |
| A referência `acme/api#412` e o glifo de tipo no cabeçalho | A árvore e o `Card` já dizem | Tooltip da linha da árvore, `Card`, `Details` |
| **Review mode**, **Models**, **Review myself**, **Open in VS Code**, **Discard step**, **Refresh PR**, **Open PR**, **Review again** | Ferramentas que servem ao item, não ao momento. Nenhuma resolve uma situação (as que resolvem, como **Open in VS Code** num step `Manual`, continuam na barra do pedido) | `⋯`, agrupadas por step, PR e task. **Review mode** e **Models** também em `Details` |
| **→** desabilitado | Um controle que não faz nada ocupa o cabeçalho o tempo todo | Aparece quando há para onde avançar |
| O subtítulo dos marcos (`6 sections · 1,240 words`) e o ladrilho de ícone | Ruído em cada marco | O conteúdo abre no lugar |
| O corpo dos grupos de ações em repouso | Oito blocos cinza por step. Dobrado, o grupo é uma linha como um marco. Aberto, ganha o bloco afundado | — |
| O rodapé dos cartões que repete o teclado ou a barra (`Press 1–3…`, `A approves and D discards…`, `Stage each file…`) e o progresso repetido no cartão (`5 of 7 files staged`, `1 of 4 decided`) | O placeholder, as teclas nos botões e a barra do pedido já dizem (crítica A.5) | A barra do pedido e os botões |
| A frase da barra `Reply` no planejamento (`answer a or b, or in your own words`) | As respostas rápidas já dizem como responder | O compositor |
| O nome do agente em `Implementer working · 3m 40s` no compositor | O cabeçalho e o controle de agente já dizem quem trabalha | `Working · 3m 40s` |
| O compositor desabilitado numa conversa que ainda não existe (`checks`, `blocked`) | Uma caixa que não aceita nada, com a razão repetida acima dela | O estado vazio (`The review starts when the checks finish.`) ou o bloco de erro dizem o porquê |
| O stream contínuo de todas as sessões | Não há mais passado na tela | — |

O que ficou da 09, sem cromo novo: o rótulo da ação pela descrição, o subagente aninhado, a mensagem do produto como marco de uma linha, **Retry reviewer** por sessão, a resposta rápida, a volta ao fim, os cartões de pergunta, de permissão, de review `Manual` e de apontamentos, e o vazio do PR review durante os checks, com os checks pelo nome.

## A · A linha

**O progresso é uma linha fina, a borda do cabeçalho.** O cabeçalho não tem fio: a linha é o fio.

- As etapas são segmentos. As feitas ficam em grafite (`--line-3`), a atual na identidade e as futuras num traço claro (`--line-2`).
- A implementação é mais longa e tem um tique por step: os commitados e o atual na identidade, os que faltam em `--brand-seg-todo`.
- **O glifo de estado anda sobre a linha**, no meio do lugar em que a task está, sobre um disco do chão: o spinner quando um agente trabalha, o disco âmbar quando algo espera você, o losango vermelho num erro, o círculo tracejado do GitHub, o anel verde do encerramento e as barras de pausa. É o único ponto de cor da linha, e diz de uma vez onde a task está e em que estado.
- Os nomes das etapas aparecem sob os segmentos no hover e no foco. Um clique os fixa. A linha não tem ação: **Back to…** fica no `⋯`.
- **A frase**, ao lado do título, diz em palavras onde a task está: `Implementation · Step 3 of 7 · review pass 2`. Sem barra do pedido, ela diz também o estado, na tinta da situação: `Implementer working`. Com a barra, o estado é dito só nela (ver "Depois da crítica").

**Os dois agentes.** A tela mostra a conversa de quem tem a vez. Com os dois esperando, é a do pedido mais antigo, como no chip da árvore. Um controle discreto no rodapé do compositor diz com quem você fala e quem é o outro, com o glifo da sessão dele: `(◯) Reviewer ⇄ ● Implementer`. Um clique, ou `Alt+`\``, mostra a outra conversa. O compositor fala sempre com a conversa na tela, então não há destinatário a vigiar (crítica A.1 da 09). Quando o outro agente também espera, a barra do pedido ganha uma segunda linha: `The implementer also waits · Permission 4m [Go to implementer]`.

**O topo cede pela largura**, em limites fixos: o breadcrumb vira `…`, os painéis ficam só com o ícone, **Pause** fica só com o ícone, a frase fica com as palavras curtas (`3/7 · pass 2`), o medidor de contexto fica só com a porcentagem. O nome da etapa nunca sai, e o título cede por último. A linha nunca cede: ela sempre tem a largura do cabeçalho.

## B · O stepper

**O progresso é um stepper compacto no cabeçalho**, depois do título. As etapas são pontos com nome: um visto nas feitas e um círculo nas futuras. A atual abre numa pílula com o nome, a posição e o glifo do estado: `Implementation 3/7 · pass 2 | ●`. A palavra do estado aparece só sem barra do pedido (`working`). Não há trilha inteira nem tempos. O stepper é uma parada de Tab, com o progresso inteiro como nome acessível. Não tem ação: **Back to…** fica no `⋯`.

**Os dois agentes** aparecem em duas abas mínimas acima da conversa, só enquanto o step tem os dois: o glifo da sessão e o nome, sublinhado na escolhida. A aba de fora diz a palavra quando espera ou falhou (`Implementer · waits`). A barra do pedido fala só da conversa na tela, porque a aba já aponta a outra. Quando só a outra espera, a barra diz isso e leva até lá, como em `structure.md` §3.

**O topo cede pela largura**, em limites fixos: o breadcrumb, os nomes das etapas feitas (que ficam só com o visto), os das futuras (só com o círculo), os painéis, **Pause**, o medidor e o laço da pílula e, por último, a palavra `working`, que fica no spinner. O título cede depois de tudo isso.

## As nove cenas

A task é a da 09: `Rate limit per API key` (`acme/api#412`), Structured, modo `Agent`, com o step 4 em `Manual`, das 09:14 às 20:44.

A tabela descreve a primeira versão. Com a barra do pedido na tela, a palavra da situação saiu do topo, e os cartões e o bloco de erro deixaram de repetir a barra (ver "Depois da crítica").

| Cena | A conversa na tela | A · A linha | B · O stepper | Barra do pedido |
|---|---|---|---|---|
| `plan` · PRD pergunta em texto | PRD, com a pergunta final marcada pelo fio âmbar | Disco âmbar no segmento PRD · `PRD · The agent asks you` | Pílula `PRD · asks you` | `Reply · PRD 2m`. As respostas rápidas no compositor |
| `run` · implementador rodando | Implementador do step 3, o grupo vivo dobrado com a ação em curso, a mensagem na fila | Spinner no tique 3 · `Implementer working` | `Implementation 3/7 · working`, abas com o spinner no implementador | Nenhuma. O compositor com **Stop** e `Working · 3m 40s` |
| `ask` · revisor pergunta, implementador espera | Revisor, com o cartão da pergunta | Disco âmbar no tique 3 · `Reviewer asks you`. Controle `Reviewer ⇄ ● Implementer` | `3/7 · asks you`, aba `Implementer · waits` | A: a pergunta com **Show**, e `The implementer also waits` com **Go to implementer**. B: só a pergunta |
| `error` · sessão do revisor cai | Revisor, com o bloco de erro | Losango vermelho · `Reviewer stopped` | `3/7 · error`, aba do revisor com o losango | Erro, **Retry reviewer**. Na conversa do implementador: `Session error · Reviewer` com **Go to reviewer** |
| `manual` · arquivos e stage | Implementador do step 4 e o cartão com os sete arquivos | Disco âmbar no tique 4 · `Your review` | `4/7 · your review`, sem abas (step `Manual`) | Tingida: `5 of 7 files staged · 71%`, **Open in VS Code**, **Approve** tracejado com `Stage 2 more files` |
| `blocked` · worktree suja | `Step 5 is next` e o bloco com o `git status` | Losango no tique 5 · `Blocked` | `5/7 · blocked` | Erro: **Clean and start…**, **Try again**. Sem compositor: não há sessão |
| `checks` · PR esperando | Vazio: `The review starts when the checks finish.` e os checks pelo nome | Círculo tracejado no segmento PR review · `Waiting for checks · 3 of 5` | `PR review · checks 3/5` | Nenhuma: não é uma situação. Sem compositor |
| `findings` · apontamentos a decidir | PR review, com o relatório e o cartão de decisão | Disco âmbar em PR review · `Pass 1 · Findings to decide` | `PR review pass 1 · decide` | Tingida: `1 of 4 decided`, **Next to decide** `Alt ↓`, **Apply approved** tracejado com `Decide 3 more` |
| `close` · pronta para encerrar | PR review, do `You decided` ao `Merged #1284` | Tudo em grafite, anel verde em Closing · `Ready to close` | `Closing · ready` | Verde: **Close task** |

## O que fica nos painéis e no `⋯`

- **`Details`**: os steps (glifo, número e título; o SHA dos commitados; `now` e o modo no atual; os seletores de modo e de modelo nos que faltam). Sob cada step commitado ficam as conversas do implementador e do revisor e os relatórios. Depois vêm **Planning** (PRD, Tech spec, Plan), **Pull request** (a conversa do rascunho e da abertura, o número, os checks, a última leitura) e **Task** (repositório, card, épico, modo, **Review mode** e **Models**, que abrem os popovers, branch, base, worktree, início). Uma conversa lida fica marcada.
- **Uma conversa anterior** abre no lugar da atual, somente leitura. O compositor dá lugar a uma faixa: `Step 2 · Implementer · an earlier conversation. It takes no more messages. [Back to step 3]`. `Esc` também volta. A barra do pedido some enquanto se lê o passado. O glifo na linha e na árvore continua dizendo que algo espera.
- **`Artifacts`**: PRD, Tech spec, os sete arquivos de step e o rascunho da PR.
- **`Card`**: o card, o épico e os irmãos.
- **`⋯`**:
  - o step: **Review myself**, **Open in VS Code**, **Discard step N…**;
  - a PR: **Open PR**, **Refresh PR**, **Review again…** (desabilitado com a razão antes da primeira passada), **Open in VS Code**;
  - o PRD: **Discard and restart the PRD…**;
  - a task: **Review mode ›** e **Models ›**, que abrem os popovers, **Back to PRD…**, **Back to Tech spec…**, **Discard and restart the plan…** com os steps rodando e, por último e em vermelho, **Delete task…**.

## Componentes

Todos estão em `components.html`, em todos os estados, claro e escuro lado a lado, só com tokens.

| Componente | Variação | Estados |
|---|---|---|
| **Linha de progresso** (novo) | A | padrão, hover (nomes), foco (nomes e anel), ativo (nomes fixados pelo clique), desabilitado (task pausada), carregando (primeira leitura, com brilho), erro. Também planejamento, PR review, encerramento e One-Shot (cinco etapas, quatro steps) |
| **Frase de progresso** (novo) | A | espera, trabalhando, erro, GitHub, encerramento, pausada, palavras curtas. Não é interativa |
| **Troca de agente** (novo) | A | padrão, hover, foco, ativo, desabilitado (o outro começa com a passada 1), carregando (`Opening…`), erro |
| **Stepper** (novo) | B | padrão, hover (tooltip de um ponto dobrado), foco, ativo (sem ação), desabilitado (pausada), carregando, erro, dobrado, PR review, encerramento, One-Shot |
| **Abas de agente** (a aba do system, mínima) | B | padrão, hover, foco, escolhida, desabilitada (antes da passada 1), carregando (`starting`), erro |
| **Marco em linha** (substitui o marco da 09) | A e B | padrão, hover, foco, aberto, desabilitado (descartado), carregando, erro |
| **Grupo de ações em repouso** (muda o do system) | A e B | padrão, hover, foco, aberto, rodando, com falha, em espera |
| **Menu `⋯`** (o menu do system, com o conteúdo novo) | A e B | itens em padrão, hover, foco, ativo, desabilitado com a razão, carregando e destrutivo. Submenu que não carrega |
| **Conversa anterior em `Details`** (novo) | A e B | padrão, hover, foco, ativo (em leitura), desabilitado (arquivada), carregando, erro |
| **Faixa da conversa anterior** (novo) | A e B | padrão, hover, foco, ativo |

**Retirados da 09:** capítulo dobrado, tempo do loop, filtro de vozes, marco na margem e o popover dele, nó do trilho, a posição em pontos, a coluna de apontamentos e o destinatário do compositor.

Nenhum token novo. A linha usa `--border-2`, `--seg-gap`, `--line-2`, `--line-3`, `--brand` e `--brand-seg-todo`. O disco do glifo tem `--glyph` mais `--space-1` de cada lado.

## Onde a proposta toca o que está registrado

Nenhuma decisão de `decisions.md` é reaberta. Estes pontos mudam `structure.md` ou `components.md`, e cada um é uma escolha para o usuário confirmar:

1. **`structure.md` §3, Cabeçalho**: **Review mode** e **Models** saem do cabeçalho em qualquer largura, para o `⋯` e para `Details`. A estrutura já os mandava ao `⋯` abaixo de 1020 px. A mínima faz isso sempre, porque é configuração do item, não do momento.
2. **`structure.md` §3, Barra do item e abas**: a barra do step some. As ferramentas dela (**Review myself**, **Open in VS Code**, **Discard step**) vão ao `⋯`. A exceção "ferramenta do item que também resolve uma situação" continua: **Discard step** é repetido na barra do pedido em `step_empty`.
3. **`structure.md` §3, O compositor**: sem conversa ainda (a PR antes da primeira passada, o step bloqueado), o compositor sai em vez de ficar desabilitado com a razão. A razão já está na tela, no vazio ou no bloco de erro. Numa conversa em que o produto não age mais, ele continua, como a estrutura pede.
4. **`components.md`, Grupo de ações**: dobrado, o grupo é uma linha sem fundo. O bloco afundado fica só para o grupo aberto.
5. **`components.md`, Cabeçalho de navegação**: **→** aparece só quando há para onde avançar, em vez de ficar tracejado. O glifo de tipo e a referência saem do cabeçalho.
6. **`components.md`, Marcador**: o marcador é uma linha à esquerda, na coluna do texto, sem os dois fios. O conteúdo abre no lugar.
7. **Na A**, o cabeçalho perde o fio (princípio 6): a linha de progresso é o fio, e um esmaecido curto de `--surface-1` separa a conversa que rola por baixo.
8. **O cartão de review `Manual` e o de apontamentos** não repetem o progresso. Ele fica só na barra tingida, que continua tingida porque é ela que carrega a ação (crítica A.5 da 09).

A mudança de feature dos apontamentos com **Apply approved** continua pendente de decisão do usuário, como a crítica da 09 pediu. A cena `findings` a mostra, e a tela mínima não depende dela: sem essa mudança, a decisão volta a ser texto na conversa.

## Dados que faltam

| Dado | Para | Custo |
|---|---|---|
| Ler a conversa de um lugar que não é o atual (step commitado, etapa de planejamento, a PR) | As conversas anteriores em `Details` | Só frontend: `GetTranscript(item, stage)` já existe por lugar, e o frontend hoje carrega só a do lugar atual. As conversas somem no arquivamento |
| `sessionStatus` da outra sessão do step | O glifo do outro agente no controle (A) e na aba (B) | Pequeno, já em `structure.md` §8 |
| **Retry** da sessão certa | **Retry reviewer** | Pequeno: o frontend segue o implementador (`app-store.ts:250`) |
| O `description` do Bash como rótulo | O rótulo de toda ação | Pequeno: chega e é descartado (`labels.go`) |
| Duração e código de saída de uma ação | `8.2 s`, `exit 1`, a duração do grupo | Pequeno: o fim chega em `handleUser` |
| `parent_tool_use_id` | O subagente aninhado | Pequeno: lido e descartado (`protocol.go`) |
| O tipo da mensagem do produto | `MySpec → Implementer · Review 1 · 2 findings · round 1 of 3` | Pequeno no backend (um campo) |
| Número de apontamentos de cada relatório de step | `Review 1 written · changes · 2 findings` | Pequeno: `Step.reports[]` só tem a passada e `clean` |
| Checks pelo nome durante `Waiting for checks` | O vazio do PR review | Pequeno, já em `structure.md` §8 |
| Opções de uma pergunta em texto | As respostas rápidas, com as primeiras palavras da opção | Nenhum: heurística do frontend sobre `a)` e `1.` |
| Marcos de decisão do usuário (rascunho aprovado, apontamentos decididos, mudanças aprovadas) | `You decided · 3 approved, 1 discarded` | Pequeno: tipos novos de marcador |
| Hora do commit e quem fez o merge | `Committed 4b7e0aa`, `Merged by lnakamura` | Pequeno: o git e o `gh` já sabem |
| Apontamentos estruturados com **Apply approved** na PR da task | O cartão de decisão da cena `findings` | Médio, e muda uma feature: é do usuário |

O custo mais alto da 09, carregar todas as conversas da task num stream contínuo, deixou de existir.

## Como foi testado

- Chromium headless, pelo `http.server` da lab, com a Fira do Google Fonts. As capturas foram olhadas cena a cena, nos dois modos, de 1100 a 2500 px, com painéis, com o `⋯`, com uma conversa anterior e com a legenda da linha.
- `?audit` nas nove cenas das duas variações, nos dois modos, a 1100, 1250, 1400, 1600, 1700, 1850 e 2500 px (252 combinações). Rodou também com `Details`, `Artifacts` e `Card` abertos, com o `⋯`, com uma conversa anterior, com a outra voz na tela e com a legenda, a 1100, 1250, 1850 e 2500 px nos dois modos (176 combinações). Em todas:
  - toda caixa que o layout posiciona fica em pixel inteiro. A linha distribui larguras inteiras entre os segmentos e os tiques, e o painel é arredondado para baixo;
  - nenhum texto do produto corta sem tooltip. A única exceção é uma linha da árvore da 08 numa medição, uma vez (`b`, `Artifacts`, 1850, escuro), que não se repetiu;
  - nenhuma sobreposição no topo, e o título inteiro em todas;
  - nenhum controle sem nome;
  - todo texto com 4,5:1 ou mais sobre o fundo real;
  - a página nunca rola na horizontal.
- `components.html` com `?audit` nos dois modos: nenhum texto abaixo de 4,5:1 e nenhum controle sem nome. A grade do espécime usa frações, e a geometria dele não é medida. Os comandos nas linhas de ação cortam nas células estreitas do espécime.
- A renderização final é a do WebKitGTK, no app.

**Cena a cena, o que ainda podia sair.** Depois da primeira passada saíram: o grupo vivo aberto (fica dobrado, com a ação em curso no resumo), o rodapé dos cartões de pergunta, de review e de apontamentos, o progresso repetido nos cartões, a frase da barra `Reply`, o nome do agente no compositor, o compositor sem sessão e a seta de avançar sem destino. Ficou o que responde a uma das três perguntas da tela: onde a task está, o que o agente diz ou faz, o que você precisa fazer.

## Depois da crítica

`critique.md` pediu cinco correções antes de a rodada ir ao usuário. As cinco estão nas duas variações, nesta pasta.

1. **Review mode e Models mudam de verdade.**
   - `Review mode ›` e `Models ›` no `⋯` abrem popovers. Os mesmos popovers abrem de `Review mode` e `Models` em `Details`, que agora são botões.
   - **Review mode** tem as duas opções com o que cada uma faz. Ele diz a quais steps a troca vale (`5, 6, 7`) e quais têm modo próprio. Fica desabilitado, com a razão, quando nenhum step resta para começar.
   - **Models** tem uma linha por etapa do modo da task. Uma etapa que já começou mostra o modelo sem edição (`· started`). O review de step fica editável até o último step ser commitado.
   - Em `Details`, cada step não iniciado tem de volta o seletor de modo e o de modelo (`features.md`, Modo de review e Modelos e esforço). Uma escolha própria aparece em tinta, e a que segue a task aparece discreta. **Follow the task** desfaz o modo próprio. O step atual mostra `now · Agent`, sem edição. A lista de steps com os seletores sai de `Artifacts` e passa para `Details`, onde já estão os steps.
   - `Back to…` oferece tudo o que o produto permite: **Back to PRD…** e **Back to Tech spec…**, e, com os steps rodando, **Discard and restart the plan…**. O plano não tem "voltar" no produto, só descartar e recomeçar (`StageTrack.tsx`).
   - `?pop=models`, `?pop=review` e `?pop=step` (este com `?panel=Details`) abrem cada um.
2. **A situação é dita uma vez.**
   - Enquanto a barra do pedido existe, o topo mostra só a posição e o progresso: a frase da A perde a palavra da situação, e a pílula da B fica com o glifo e a posição. A palavra continua no nome acessível. Sem barra (`run`, `checks`), a palavra fica, porque é o único "o que roda" do topo.
   - A posição passou a carregar o laço, que era da barra do step: `Step 3 of 7 · round 1 of 3` e `Step 3 of 7 · review pass 2` (crítica 2.6).
   - Cena a cena:
     - os cartões de pergunta e de permissão perdem o cabeçalho, porque o anel âmbar e a barra dizem que é um pedido;
     - os cartões de review `Manual` e de apontamentos ficam neutros (`Changed files · 7`, `Findings · 4`), porque a barra tingida carrega o pedido. Isso vira a regra: com o cartão sem ação, o cartão é conteúdo neutro e a barra é tingida; com o cartão que responde, o cartão tem o anel âmbar e a barra é quieta;
     - o bloco de erro perde o título, que a barra diz. A barra de erro e a de bloqueio perdem a razão, que o bloco diz;
     - `close` fica só com `Closing` no topo;
     - **Refresh** sai do bloco dos checks, porque fica no `⋯` e o produto lê a cada minuto.
3. **Na A, a linha se lê sozinha.**
   - O que falta é pontilhado: as etapas em `--line-3` (3,45:1 no claro e 3,69:1 no escuro) e os steps que faltam na identidade (acima de 4,5:1 nos dois).
   - O feito é uma linha cheia em `--ink-3`. Cheio contra pontilhado separa o feito do que falta nos dois modos, antes de qualquer cor.
   - O cabeçalho ganhou um chão de `--space-3` sob a linha, antes do esmaecido: a conversa não rola mais colada nela.
   - `Enter` e `Space` fixam os nomes sob a linha, como o clique.
4. **O medidor de contexto não aparece sem sessão** (`checks`, `blocked`).
5. **O topo cede só pela largura.**
   - As ferramentas trocam o rótulo pelo ícone em limites fixos da área principal (container queries), reservados para a frase ou a pílula mais longa. Nada mede mais o conteúdo.
   - Na A, abaixo de 1320 px o breadcrumb dobra, abaixo de 1120 os painéis ficam com o ícone, abaixo de 1000 **Pause** fica com o ícone e a frase fica curta, e abaixo de 880 o medidor fica só com a porcentagem.
   - Na B, os limites são:
     - 1660 px, o breadcrumb;
     - 1440, as etapas feitas;
     - 1250, as futuras;
     - 1080, os painéis;
     - 960, **Pause**;
     - 940, o medidor e o laço da pílula (`3/7`);
     - 880, a palavra `working`, que fica no spinner, no nome acessível e no compositor.

Também corrigido, da mesma crítica:
- com `Details` cobrindo a conversa, abrir uma conversa anterior fecha o painel, e **Back to step 3** fica à vista (2.9);
- **Open in VS Code** mostra `Ctrl+E` no item do `⋯` (2.10);
- o stepper da B tem o progresso inteiro no tooltip, que o foco pelo teclado mostra (B.2).

O espécime ganhou:
- a frase e a pílula com a barra do pedido;
- o popover de **Review mode** e o de **Models**, em todos os estados;
- o seletor de modo e de modelo de um step, também em todos os estados.

**Como foi testado depois da crítica.** `?audit` rodou em 1.186 combinações:
- as nove cenas das duas variações, nos dois modos, a 1100, 1250, 1400, 1600, 1700, 1850 e 2500 px;
- os painéis, o `⋯`, os três popovers, as conversas anteriores, a outra voz e a legenda, nas mesmas larguras e nos dois modos;
- as nove cenas a cada 50 px, de 1150 a 2600;
- o espécime.

O resultado:
- nenhum título cortado e nenhuma sobreposição no topo;
- a página nunca rola na horizontal;
- nenhum controle sem nome e nenhum texto abaixo de 4,5:1;
- tudo cai em pixel inteiro, fora a grade do espécime, que não é medida;
- a linha da árvore da 08 cortou sem tooltip uma vez, de novo numa medição isolada (`b`, `findings`, 1850).

As capturas foram olhadas de novo nos dois modos. `?meas` mostra a largura de cada peça do topo, e foi com ela que os limites foram fixados.

**O que fica para o usuário.** A crítica recomenda o stepper da B com a regra de agentes da A, sem abas. Com a linha agora legível sozinha, pelo pontilhado e pelo chão, a recomendação abaixo continua a A. A combinação da crítica é a alternativa natural se o usuário quiser os nomes das etapas sempre visíveis. Ficam também com o usuário:
- `Alt+`\`` para trocar de agente, que pode ser tecla morta num teclado ABNT2;
- a revisita (`Back to…`, **Continue**) e o rascunho da PR, que nenhuma cena mostra (crítica 0.7);
- as duas perguntas de `conversation.md` §7.

## Depois da decisão

O usuário escolheu a **B · O stepper** (`decisions.md`, 2026-09-24, "Tela da task: stepper e abas mínimas"). A forma decidida está em `design/screens/task.md`.

Na `b.html`, o stepper mantém os nomes das etapas na metade do monitor. O topo cede em ordem, e o título cede depois de tudo:
1. o que fica em volta do stepper: o breadcrumb abaixo de 1660 px de área principal, o rótulo dos painéis abaixo de 1440, o de **Pause** abaixo de 1360, a trilha do medidor e os traços entre as etapas abaixo de 1300;
2. as etapas feitas viram a marca, com o nome no tooltip, abaixo de 1200;
3. o laço e a palavra `working` da pílula saem abaixo de 1040;
4. os nomes das futuras saem só abaixo de 900.

De 1250 a 1300 px de janela, o topo mostra `✓ ✓ ✓ [Implementation 3/7 ◌] ○ PR ○ PR review ○ Closing`.

Foi auditada em 495 combinações:
- as nove cenas a 1100, 1250, 1275, 1300, 1400, 1600, 1850 e 2500 px, nos dois modos;
- `Details`, `⋯`, os popovers, a conversa anterior e a outra voz, a 1100, 1250, 1400, 1600, 1850 e 2500 px;
- as nove cenas a cada 50 px, de 1100 a 2600.

Nenhum título corta, nada se sobrepõe, nenhum controle fica sem nome, nenhum contraste fica abaixo de 4,5:1 e nada fica em meio pixel. Só a linha da árvore da 08 cortou sem tooltip uma vez, numa medição isolada.

## Recomendação

**A · A linha.**

- **É a mais mínima de verdade.** O cabeçalho continua uma faixa só, e o progresso é a borda dele: não há uma faixa a mais em nenhuma cena. A B acrescenta a faixa das abas sempre que o step tem os dois agentes, que é a maior parte do tempo de uma task em `Agent`.
- **O indicador faz as três perguntas numa forma só.** A proporção da linha diz quanto foi feito, a cor diz onde a task está, e o glifo sobre ela diz o estado, com as mesmas formas da árvore (o spinner, o disco âmbar, o losango). De longe se vê o ponto âmbar na linha, e a frase ao lado do título diz o resto em palavras.
- **Ela não cede com a largura.** A linha tem sempre a largura do cabeçalho. A 1100 e a 2500 px ela diz o mesmo, e o que encolhe é a frase. O stepper da B perde os nomes na metade do monitor, que é a largura que o usuário usa, e vira vistos e círculos.
- **O compositor fala com a conversa na tela.** Com um controle só, que mostra os dois agentes com o glifo de cada um, não há destinatário a vigiar nem uma barra de abas.

O risco da A, para o usuário julgar: os nomes das etapas feitas e futuras só aparecem no hover, no foco ou num clique. A frase diz a etapa atual, e a linha mostra quanto falta, mas quem quer ler `Tech spec ✓` precisa passar o mouse. A B mostra esses nomes sempre que há espaço. Se o usuário sentir falta deles, a B é a alternativa, e a regra dos dois agentes pode vir da A (controle no compositor, sem abas).

## Decisão

**B · Stepper**, decidida em 2026-09-24. Ver `design/decisions.md`. O documento da tela é `design/screens/task.md`.
