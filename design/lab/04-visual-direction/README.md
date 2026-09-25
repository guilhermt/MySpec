# 04 · Direção visual

Fase 3, fundação visual. Três direções de linguagem visual vestindo a mesma tela: a task em implementação no modo `Agent`, step 3 de 7, com o revisor perguntando e o implementador esperando permissão, e a árvore inteira da rodada 03. Mesmo conteúdo e mesma estrutura nas três; só a linguagem muda. A pergunta é uma: **qual é a linguagem visual do MySpec**.

## Como abrir

- `a.html`, `b.html`, `c.html`, direto no navegador ou servidos (`python3 -m http.server 8090 -d design/lab`). Para comparar: `compare.html?a=04-visual-direction/a.html&b=04-visual-direction/b.html`.
- `?theme=dark` ou `?theme=light` fixa o tema; sem o parâmetro, vale o do sistema.
- `?tab=reviewer` abre a conversa do revisor, com a pergunta. Sem ele, abre a do implementador, com a permissão. As abas funcionam no clique.
- `?specimen` mostra só o espécime. Ele também está no fim de cada página, abaixo da tela.
- O selo `04 · A ▴` no canto inferior direito é do mock, não da interface: abre os atalhos de tema e aba.

As páginas se adaptam de 1100 a 2600 px, com as regras de largura do `structure.md` (lateral contínua, medida de 800 px, formas curtas da linha abaixo de 330 e 370 px de lateral, breadcrumb só com o item abaixo de 1020 px de área principal).

## O que é igual nas três

Para a escolha ser só da linguagem:

- a estrutura aprovada (árvore, linha de três linhas, barra do pedido, compositor), os glifos de estado por forma (losango, disco, anel, spinner, círculo tracejado, duas barras, círculo fino) e os três portadores do erro;
- os ícones de tipo (task, task One-Shot com o raio, review de PR, discussão), desenhados agora para substituir as letras do wireframe; são provisórios e idênticos nas três;
- o espaçamento, numa grade de 4 px (`--sp-*`), a medida da conversa (`--measure: 50rem`), as durações (120 ms, 180 ms) e a curva;
- o topo do item aberto, descrito abaixo.

Os dados são os da rodada 03. O selo `Ctrl J` fica na `Widget for today's tasks`, o erro mais antigo fora do item aberto.

## As três direções

| | A · Instrumento | B · Leitura | C · Assinatura |
|---|---|---|---|
| **Intenção** | Precisão de instrumento: neutro frio, linhas finas que desenham cada região, um azul só onde você age | Calma para ler o dia todo: neutro quase sem cor, levemente quente, regiões por tom, nenhuma cor de marca | Um produto com rosto: cinza acromático, superfícies que sobem quando importam, e um violeta íris que é do MySpec |
| **Eixo 1 · neutro** | Frio (matiz 250, croma 0,002 a 0,02) | Quente, quase neutro (matiz 65 a 75, croma 0,003 a 0,012) | Acromático (croma 0) |
| **Eixo 2 · cor** | Um acento de interação: azul em foco, ação primária, conversa ativa, link. "Trabalhando" é neutro | Só semântica. Ação primária, foco e seleção em tinta. O azul é um estado: agente trabalhando | Cor de identidade presente: íris na marca, ação primária, foco, seleção, sua fala e o avatar dos agentes. "Trabalhando" é neutro |
| **Eixo 3 · separação** | Bordas: toda região e todo bloco tem linha de 1 px; marcadores com fio; abas sublinhadas | Superfícies: lateral mais escura, topo num tom intermediário, conversa clara, sem linhas entre regiões; os cartões que bloqueiam são as únicas coisas elevadas | Misto com elevação: lateral por tom, cartões e a barra do pedido flutuam com sombra, linhas só dentro deles |
| **Fala do agente** | Mesma sans da interface, 15 px, entrelinha 1,6 | Serif de leitura, 17 px, entrelinha 1,65. A pergunta do cartão também em serif | Mesma sans, 16 px, entrelinha 1,6. Título do item e pergunta em Display |
| **Famílias** | IBM Plex Sans, IBM Plex Mono | Source Sans 3, Source Serif 4, Source Code Pro | Red Hat Text, Red Hat Display, Red Hat Mono |
| **Mono** | Generoso: `repo#card` da linha, referência do item, linha 3, código | Só onde é técnico: código, caminhos, linha 3 | Como A |
| **Raio** | 2 a 6 px, quase reto | 3 a 12 px, pílula nos chips e no seletor | 4 a 14 px, pílula no seletor de conversa e nos marcadores |
| **Realce de código** | Contido, cinco matizes de croma baixo | Monocromático: palavra-chave em peso, comentário em itálico | Palavra-chave em íris, o resto como A |

### Tokens principais

Valores do tema claro / escuro. Todas as cores estão em OKLCH nos arquivos; aqui, arredondadas.

| Token | A · Instrumento | B · Leitura | C · Assinatura |
|---|---|---|---|
| `--bg-sidebar` | `0.975 0.004 250` / `0.17 0.008 255` | `0.945 0.007 75` / `0.16 0.005 65` | `0.965 0 0` / `0.16 0 0` |
| `--bg-conv` | `0.995 0.0015 250` / `0.195 0.009 255` | `0.988 0.003 75` / `0.2 0.006 65` | `0.982 0 0` / `0.18 0 0` |
| `--bg-selected` | `0.93 0.014 250` / `0.27 0.018 255` | `0.905 0.011 75` / `0.27 0.009 65` | `0.935 0.03 292` / `0.27 0.045 292` (íris) |
| `--ink` / `--ink-4` | `0.22` e `0.5` / `0.95` e `0.68` | `0.23` e `0.49` / `0.93` e `0.67` | `0.2` e `0.51` / `0.95` e `0.68` |
| `--primary` | azul `0.52 0.17 257` / `0.7 0.14 257` | a tinta, `--ink` | íris `0.5 0.2 292` / `0.71 0.15 292` |
| `--focus` | o azul | a tinta | a íris |
| `--work` (trabalhando) | `--ink-2`, neutro | azul `0.5 0.14 250` / `0.75 0.12 250` | `--ink-2`, neutro |
| `--err` · `--wait-glyph` · `--close` | vermelho 27 · âmbar 60 · verde 150, iguais nas três com ajuste de luminosidade ao fundo | idem | idem |
| `--fs-ui` · `--fs-read` · `--fs-title` | 13 · 15 · 16 px | 14 · 17 · 17 px | 13 · 16 · 18 px |
| `--r-md` · `--r-lg` | 4 · 6 px | 8 · 12 px | 10 · 14 px |
| `--shadow-card` | nenhuma (borda âmbar) | suave, com anel de 1 px | suave, com borda de 1 px e fio âmbar no topo |

O espécime de cada página tem a lista completa, com a escala de cinzas dos dois temas lado a lado, as cores de status e a medida de contraste de cada par texto/fundo feita na hora, no navegador, sobre as cores calculadas.

### Status e contraste

Os estados têm as mesmas formas nas três direções; a cor é o terceiro portador, nunca o único. Os pares medidos (66 por direção, nos dois temas) passam: todo texto acima de 4,5:1, e glifos, anéis e foco acima de 3:1. Os pares mais justos, nas três direções, são o disco âmbar de espera sobre a linha selecionada no tema claro (3,1 a 3,4:1) e o círculo fino do ocioso sobre a lateral (3,4 a 3,7:1). O âmbar do glifo foi escurecido até passar; o do chip continua claro, com texto escuro (8:1 ou mais). A prova que `references.md` pedia para o neutro quente, o âmbar de espera distinto do fundo, está na direção B: ele se separa nos dois temas, com as mesmas razões das outras direções.

## O topo do item aberto (prévia da fase 4, igual nas três)

Não está em decisão nesta rodada. `structure.md` §9 deixa o topo em aberto para a primeira tela da fase 4; ele aparece aqui igual nas três direções para não misturar as duas escolhas. É a minha proposta de partida para essa tela.

As quatro faixas de hoje (cabeçalho, trilha, barra do step, abas) viram uma hierarquia de três níveis, cada um no lugar da coisa que descreve:

1. **O que é** (linha 1, largura inteira): `←` `→`, o breadcrumb curto, o glifo de tipo e o **nome da task** como título, `acme/api#412`. À direita, só o que vale para o item todo: contexto, **Pause**, os painéis e `⋯`.
2. **Onde está** (linha 2, largura inteira): a trilha de etapas com a etapa atual expandida em chip, `Implementation 3/7`, e um medidor de sete segmentos (commitados, atual com a cor do estado, por fazer). Depois de um divisor, o step: `Step 3 · Token bucket middleware` e o estado do loop, `Agent review · pass 1`. Abaixo de 1240 px de área principal, as etapas feitas e as futuras ficam só com o glifo (`✓` e `○`), com o nome no tooltip e no nome acessível; a etapa atual nunca encolhe.
3. **Qual conversa** (no topo da coluna de leitura, fixo na rolagem): o seletor `Implementer · Permission 4m` / `Reviewer · Question 18m`, cada lado com o glifo, o que pede e o chip do tempo, e as ferramentas do step, **Review myself** e **Open in VS Code**. O seletor sai da faixa de largura inteira e vai para a medida da conversa porque é dela que ele fala.

A altura fica perto da de hoje (cerca de 130 px contra 156); o ganho é a hierarquia: título, posição, conversa, em vez de quatro faixas de mesmo peso.

Onde a proposta muda o ponto de partida do `structure.md` §3 (que o documento declara não decidido):

- **Review mode** e **Models** saem do cabeçalho e ficam no `⋯` e em `Details`, onde a estrutura já os coloca abaixo de 1020 px. São escolhas raras, feitas uma vez por task.
- **Discard step** sai da barra do step e fica só no `⋯` (**Discard step 3…**). Na situação `step_empty`, a barra do pedido continua a repeti-lo, como a regra do único lugar já prevê.
- A barra do step deixa de existir como faixa: o que ela dizia (posição, título, estado do loop) está na linha 2, e as ferramentas estão no seletor de conversa.

A regra da situação continua: a linha 2 mostra a posição e o progresso, e o rótulo, o tempo e a ação da situação ficam na barra do pedido.

## Recomendação

**B · Leitura**, com uma ressalva a validar no app real.

- É a que segue os princípios de `references.md` sem exceção: cor só com significado (princípio 3), estrutura sentida e não vista (2), dois registros de texto (7), a lateral recuando (1). Na tela, a cor está só onde algo depende do usuário, e a árvore fica mais legível como "depende de mim" do que em A e C, onde o azul e a íris disputam o olho com o âmbar.
- A conversa, que o brief chama de tela mais importante e hoje "amadora", é onde B mais se afasta das outras. A serif separa a fala do agente do cromo sem precisar de caixa nem de cor, e dá à leitura longa um registro próprio. A pergunta em serif lê como pergunta, não como rótulo.
- As regiões por tom aguentam as duas larguras sem virar grade de linhas, e o tom da barra do pedido (âmbar claro numa espera, vermelho claro num erro) faz dela o ponto que o olho procura acima do compositor.

A ressalva: a serif é o risco de B. Ela foi usada só em prosa (código, caminhos e listas de arquivos continuam em mono), mas precisa ser vista em WebKitGTK no Linux, onde o hinting difere do Chromium. Se não passar, trocar `--font-read` por Source Sans 3 a 16 px mantém o resto da direção intacto: é um token.

O que eu levaria das outras duas: de A, as linhas finas **dentro** das listas densas que ainda vêm (board, checks, History), onde bordas funcionam melhor que tom; de C, nada de cor, mas a barra do pedido flutuando levemente sobre a conversa, que ajuda a achá-la numa conversa longa.

Sobre a cor de identidade (`references.md` §7): B responde "nenhuma". Se o usuário quiser uma, C mostra o custo: ela ocupa seleção e ação primária e passa a competir com os estados. O lugar dela, se existir, seria o ícone do app e a tela de boas-vindas, não o cromo.

## Dados que faltam

- **Caminho do arquivo no cabeçalho do bloco de código** (`internal/ratelimit/bucket.go`). O markdown do agente só traz a linguagem da cerca (` ```go `). O cabeçalho pode mostrar só a linguagem, ou o caminho quando o agente o escreve na linha de informação da cerca; o produto não o deriva sozinho.
- **Código de saída de uma ação** (`exit 1` no grupo recolhido). `ActionEntry` tem rótulo, alvo e status (`running`, `done`, `error`, `interrupted`), sem o código nem a saída. Sem ele, a linha diz só `error`.
- **Duração de uma ação em curso** (`running · 3m 20s`, no espécime). Não existe por ação; o tempo do turno (`Working · 3m 20s`) é derivável do `createdAt` da entrada que abriu o turno.
- **Ação que espera permissão** (`waits for your permission` na linha da ação). A ação fica `running` enquanto a permissão está pendente; o vínculo entre a ação e o cartão é pelo `toolUseId`, que as duas entradas têm. Só frontend.

Os horários das mensagens, marcadores e cartões (`asked 14:31`) existem: toda entrada da conversa tem `createdAt`. O que a árvore pede do backend (ação em curso e `turnStartedAt` no resumo do item) já está em `structure.md` §8.

## Decisão

2026-09-24. Nenhuma direção aprovada; a B é a base da próxima rodada. O usuário achou a B a mais refinada, mas com o tom quente exagerado (um traço de calor é bem-vindo, um tom não) e a serif estranha, com cara de cópia do site da Anthropic. Pediu variações a partir da B, uma cor de identidade do MySpec decidida nesta fase (a rodada ficou orbitando o cinza), a barra lateral menos sobrecarregada e mais organizada, e inspiração em aplicações modernas com efeitos e cores interessantes, sem perder a sobriedade. Os problemas do `critique.md` entram na rodada 05.
