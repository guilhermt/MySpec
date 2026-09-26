# Crítica do material de entrada da task 2 · Shell (segunda leitura)

Segunda revisão de `design/tasks/02-shell.md`, depois da correção que levou as decisões a `design/structure.md` §2 e §6 e a `design/system/components.md`. A régua é a mesma da primeira leitura: `implementation.md:18` diz que toda decisão de design vem tomada, e o PRD só pergunta ao usuário o que é de produto. Conferido contra o diff de `structure.md` e `components.md` na árvore de trabalho sobre `a45e08b` e contra o código citado. `02-shell.md:N` é a linha do material corrigido.

## Veredito

**Corrigir antes.** Das 24 lacunas da primeira leitura, 23 estão resolvidas no material ou nos documentos de `design/`, com a decisão escrita e apontada. Restam quatro pontos curtos que o tech spec teria de decidir, ou que o levariam a um erro: uma frase de `components.md` que contradiz sete componentes (R1), o rótulo que o nome acessível e o anúncio usam depois da decisão dos rótulos curtos (R2), a notificação clicada com um diálogo aberto (R3) e a perda do link do card no cabeçalho (R4). Cada um se corrige com uma ou duas frases. Os outros (R5 a R8) podem ir junto ou ficar para o tech spec.

## 1. A lista da primeira leitura, item a item

| Item | Situação | Onde está resolvido |
|---|---|---|
| G1 Estados sem situação | Resolvido | `structure.md:128–157`; as formas provisórias de P13, M1, P25 e P26 em `02-shell.md:117–122` |
| G2 Fórmula da linha 2 | Resolvido | `structure.md:96–126`, uma linha por `kind`, com a razão do bloqueio vinda do step e da PR |
| G3 Faixa recolhida | Resolvido | `components.md:343–350`, a anatomia inteira; `02-shell.md:47` diz que a faixa não tem mock e vale o documento |
| G4 Decisão 1 | Resolvido, com uma perda (R4) | `02-shell.md:184`: o que sai, o que fica, a cedência até 812 px; a Home sem task é o lugar do board (`02-shell.md:142`) |
| M1 Base e dependência | Resolvido | `02-shell.md:5` |
| M2 Foco depois de uma ida | Resolvido | `components.md:145`; `02-shell.md:148` |
| M3 `Ctrl+J` e o filtro | Resolvido | `structure.md:164` |
| M4 X16 e as boas-vindas | Resolvido | `components.md:431`; `02-shell.md:176` |
| M5 Região ao vivo, marca `Ctrl J` no nome, toast parado | Resolvido, com uma contradição nova (R1) | `components.md:432–435`; `structure.md:93` |
| M6 Forma curta e `<Quem>` | Resolvido | `structure.md:93, 390`; `components.md:316`; a medida em `02-shell.md:203` |
| M7 Gatilho do filtro e nomes da árvore | Resolvido | `components.md:208, 320` |
| M8 A outra conversa falhou | Resolvido | `components.md:471` |
| M9 Textos e destinos da página | Resolvido | `02-shell.md:164–174`; `components.md:386` |
| L1 Atalhos com modal | Resolvido pela decisão nova, com uma lacuna (R3) | `02-shell.md:144` |
| L2 Reviews com falha de leitura | Resolvido | `components.md:328`; `02-shell.md:127` |
| L3 A seta de ir e os dois alvos | Resolvido | `components.md:327` |
| L4 Ícones, tooltips e animação do painel | Resolvido; o ícone tem um nome ambíguo (R6) | `components.md:374, 376`; `02-shell.md:158` |
| L5 Relógio por extenso e o nome que muda a cada minuto | Resolvido | `02-shell.md:124, 286` |
| L6 Texto do anúncio | Resolvido, mas falta dizer qual rótulo (R2) | `02-shell.md:156` |
| L7 Mocks da página, do aviso e do toast | Resolvido | `02-shell.md:47` |
| L8 Ícone do tema | Resolvido | `components.md:354` |
| `Place` duplicado | Resolvido | `02-shell.md:9`, `Location` |
| Plano: o step 3 regredia review e discussão | Resolvido | `02-shell.md:197, 316, 326` |
| Plano: marca e atalho divergentes; piscada; região em dois steps; steps grandes | Resolvido | Steps 6, 7, 9, 10 e 11 (`02-shell.md:319–324`) |
| Pronto vago e incompleto | Resolvido; um item não é executável como escrito (R8) | `02-shell.md:15–30` |
| Inventário | Conforme; linhas refeitas na base nova | `02-shell.md:205–278` |

## 2. O que resta

**R1. "A única região ao vivo do app" contradiz sete componentes.** `components.md:435` e `02-shell.md:13, 156` dizem que `.toasts` é a única região ao vivo. Mas `components.md` mantém `role="status"` ou `role="alert"` na Idade da leitura (306), no Esqueleto (404), na Faixa de aviso (414), na barra do pedido (477), na Atividade (521), na linha do que o gesto publica (662) e na contagem da barra de seleção (717), e `role="alert"` no próprio aviso do app (435). Lida ao pé da letra, a frase leva o implementador a tirar esses papéis. *Correção:* "a única região ao vivo dos anúncios do app (situação nova, `Ctrl+J` sem destino, página do item que saiu); os componentes com papel próprio o mantêm, fora dela e nunca dentro dela". O pronto 9 (`02-shell.md:25`, "sem regiões aninhadas") já diz o que importa.

**R2. Depois dos rótulos curtos, não se sabe qual rótulo o nome acessível e o anúncio usam.** `structure.md:124` diz que a árvore usa a palavra curta e que a barra e as notificações usam o rótulo inteiro. O nome acessível da linha (`02-shell.md:125`, `<tom>: <rótulo> · <lugar>`) e o anúncio (`02-shell.md:156`, `<rótulo com a primeira letra minúscula>`) dizem "rótulo" sem dizer qual. O exemplo `question` não desempata: `Reply` e `Waiting for reply` dão `reply in PRD` ou `waiting for reply in PRD`. *Correção:* o nome acessível da linha usa o texto que a linha mostra, na forma longa, porque descreve a linha; o anúncio usa o rótulo inteiro de `situationLabel`, como a notificação, porque é a mesma mensagem com a janela em foco.

**R3. A decisão dos modais deixa de fora a notificação e o `Ctrl+N`.** `02-shell.md:144` torna `Alt+←`, `Alt+→`, `Ctrl+J` e `Ctrl+,` inertes com qualquer diálogo modal. Faltam dois casos:
- **A notificação clicada** (`situation:open`) é uma ida pelo mesmo caminho do `Ctrl+J` (`02-shell.md:152`). Nada diz o que ela faz com um modal aberto. Hoje ela navega por baixo: um diálogo de criação continua aberto sobre o lugar novo, e uma confirmação do lugar antigo some com ele.
- **O `Ctrl+N` continua agindo com uma confirmação aberta**, o que abre o diálogo de criação sobre outro modal.

*Correção:* a notificação traz a janela à frente e, com um modal aberto, não navega, como o `Ctrl+J`; o `Ctrl+N` fica inerte com qualquer modal, como os outros.

**R4. A decisão 1 tira do topo o link do card, e o app perde uma ação até a task 3.** A decisão (`02-shell.md:184`) tira o badge do card do `TaskHeader` e o do `ReviewHeader`. Eles não são só referência: `TaskCardBadge.tsx:23` abre o card no GitHub e mostra o status dele no board (`:29`), e `PullCardBadge` faz o mesmo no review. Na tela da task, nenhum outro controle abre o card até o painel `Card` (task 3), contra `implementation.md:15`. *Correção:* o texto `#N` sai; à direita fica um botão fantasma de ícone com a seta externa, `Open card on GitHub`, com o status do card no tooltip, até o painel `Card` na task da task e até o painel da PR na do review (task 6).

**R5. A mesma decisão tem dois nomes na árvore.** `structure.md:115` escreve a decisão dos apontamentos da PR da task como `Findings · PR review · pass K · a of b`, e `structure.md:120` escreve a do review como `Decide findings · pass K · a of b`. É o mesmo gesto do usuário, que a task 7 (M1) põe no mesmo componente. A razão dada, que o `review_report` tem três formas, explica o verbo do review, não o nome diferente na task. *Correção:* `Decide findings` nos dois, com a curta `Decide findings · a/b`.

**R6. O ícone "de arquivo" tem dois sentidos, e o do board não existe.** O painel usa "o ícone de arquivo" para documento (`components.md:374`; `file` nos mocks). A página e o toast usam "arquivo" para arquivamento (`02-shell.md:166, 170, 178`), um significado diferente que `components.md:82` manda ter ícone próprio. "O ícone do board" (`02-shell.md:172`) não está no registro de `Icon`: a decisão 9 (`02-shell.md:192`) registra só `task`, `oneShot`, `review` e `discussion`. *Correção:* nomear os dois no registro, `file` e `archive`, com `merge`, `trash` e `board`, e dizer de onde vem o do board (o lucide `Kanban`, ou um SVG próprio como os de tipo).

**R7. O foco no título antes de o título existir.** O step 9 (`02-shell.md:322`) implementa "o foco de cada tipo de ida", que leva o foco ao `h1` do cabeçalho de lugar, e o cabeçalho nasce no step 10. *Correção:* o foco no título vai para o step 10, e o step 9 fica com o foco na linha e na página.

**R8. O pronto 11 cita uma ferramenta que o app não tem.** `02-shell.md:27` pede "a auditoria de geometria dos mocks, `?audit`". A auditoria é um script dos mocks (`08-visual-final/index.html:1313`), e o app só roda no Wails. *Correção:* o step 12 traz o mesmo script como utilitário de desenvolvimento, rodado pelo inspetor do webview, ou o pronto diz que a checagem de meio pixel é feita nas capturas ampliadas, como a task 12 prevê (`implementation.md:190`).

## 3. As duas decisões novas do researcher

**Rótulos curtos na árvore, rótulo inteiro na barra e nas notificações** (`structure.md:124`). Coerente. `principles.md` §3 separa o cromo compacto da leitura, e cada palavra curta mantém o substantivo do rótulo inteiro (`Reply` e `Waiting for reply`, `Review · Step 4/7` e `Review step 4`), então o usuário reconhece na barra o que leu na linha. Aprovada com R2 (qual rótulo o nome acessível e o anúncio usam) e R5 (um nome só para decidir apontamentos).

**Atalhos de navegação inertes com qualquer modal** (`02-shell.md:144`). Correta: uma ida por baixo de um modal deixa o modal órfão ou sobre o lugar errado. Aprovada com R3: a notificação clicada segue a mesma regra, e o `Ctrl+N` também, porque a exceção dele vem de uma regra antiga que a decisão nova já superou.
