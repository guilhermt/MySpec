# 03 · Estrutura: consolidação

Fase 2. Wireframe em escala de cinza. Uma variação só: é a proposta de estrutura para aprovação, não uma escolha entre ideias.

## O que a rodada faz

Consolida a recomendação do crítico da rodada 02, que o coordenador adotou:

- a linha compacta da a e a área principal da a;
- a barra acima do compositor como o lugar em que todo item diz o que pede;
- `Details` como mais um painel auxiliar, fechado por padrão;
- os sete pontos de revisão do crítico;
- os três itens que a rodada 02 só respondeu.

Onde moram os cartões de apontamento e de rascunho (coluna ou conversa) continua adiado para a fase 4. O mock mantém a coluna da a e não decide isso.

O rascunho do documento da fase está em `structure-draft.md`. Ele vira `design/structure.md` quando o usuário aprovar.

## Como abrir

- `a.html`, direto no navegador. A página se adapta de verdade de 1100 a 2600 px. O selo tracejado no rodapé mostra a largura da janela e a da área principal.
- **Scenes ▴** troca os cenários. **Notes** traz a anatomia e a legenda.
- `?open=t1|t7|t3|t8|d1|t2|t4|t5|d2|t6|r1|r2` abre um item. `?open=t1&tab=Implementer` abre a outra conversa da `t1`.
- `?scene=home|loading|reading|archived|deleted|empty|welcome|migration`. Além delas, `?scene=archived&open=r2`.
- `?sb=collapsed` recolhe a lateral. `?notice=1` mostra o aviso genérico do app. `?aux=Details` abre um painel.

O conjunto de dados é o da rodada 02, com dois itens a mais para dar cena ao que faltava:

- `t8`, uma task com **erro de sessão** no plano;
- `d2`, uma discussão com **rascunhos a decidir**. Um rascunho já está publicado, um é atualização de um card fora da última leitura, dois estão num épico e um foi descartado.

São 12 itens ativos, o dobro de um dia cheio.

## A estrutura em uma tela

- **Linha da árvore**:
  - Linha 1: o tipo e o nome, com a largura inteira para o nome. À direita ficam o `repo#card` e `One-Shot` quando a lateral é larga, ou a marca `Ctrl J` na linha que o atalho abre.
  - Linha 2: a gravidade, o que o item pede ou onde está, **sempre com a posição**, o `+1` e o tempo na borda direita.
  - Linha 3, só com o agente rodando: a ação em curso, com o verbo primeiro, e o contexto.
- **Barras do topo** (trilha, step, PR, review, discussão): estado e ferramentas. Nunca a ação que resolve uma situação.
- **Barra do pedido**, acima do compositor. Existe só enquanto o item pede algo. Diz o que pede, onde, há quanto tempo, e tem a ação que resolve. É o único lugar dessa ação na tela.
- **Coluna de decisão** (apontamentos, rascunhos): como na a, com o desfazer e a leitura dos decididos.
- **Painéis** (`Details`, `Artifacts`, `Card`, `Reports`, `Documents`): fechados por padrão, um de cada vez. Viram coluna quando a coluna de leitura ainda cabe inteira ao lado deles. Senão, cobrem a conversa.

## Os sete pontos do crítico

1. **A posição na linha que espera.** A linha 2 sempre leva a posição, também na forma curta:
   - `t1`: `Question · Step 3/7`, e `Question · Reviewer · Step 3/7` na forma longa;
   - `t4`: `Ready to close · #1279`, e `Ready to close · PR #1279 merged` na longa;
   - `t5`: `Step 2/4 blocked`;
   - `r1`: `Decide findings · 5/9`;
   - `d2`: `Decide drafts · 3/6`.

   O nome acessível também leva a posição. A regra, para o `structure.md`: o rótulo de uma situação nunca aparece sem a posição do item.
2. **Lateral mínima que não corte nomes a 1250 px.** Duas mudanças:
   - a lateral passa a `clamp(288px, 8vw + 200px, 380px)`: 288 px a 1100, 300 a 1250, 328 a 1600, 380 a partir de cerca de 2250;
   - o tempo saiu da linha 1 para a borda direita da linha 2, e o nome ganhou a largura inteira.

   A 1250 px o nome tem cerca de 220 px, contra os 130 da rodada 02. Todos os nomes de task e de discussão do mock cabem inteiros. O único que ainda corta é o título longo de uma PR (`Migrate settings page to react-hook…`, 40 caracteres), que continua inteiro no tooltip e no nome acessível. Contra: a área principal perde de 36 a 48 px abaixo de 1600 px.
3. **O verbo na ação curta.** A regra da b, feita mecânica: o verbo vem sempre primeiro. O alvo encurta pelo meio e mantém o último segmento do caminho (`Running go test …/keys/...`, `Reading …/plans.ts`). O que ainda não cabe corta no fim, então o verbo nunca sai. A forma longa só aparece com a lateral acima de 370 px. A posição do item rodando foi para a linha 2, então o estado do step (`Step 2/5 · Reviewer pass 2`) e o da discussão (`Discussing`) não somem mais no estreito.
4. **`One-Shot` de relance.** A task One-Shot tem uma marca própria no glifo de tipo, visível em qualquer largura: o `T` com o selo `1`, que a fase 3 troca por um ícone. `One-Shot` aparece por extenso no meta da linha larga, no cabeçalho e no nome acessível (`One-Shot task …`).
5. **Um portador de gravidade que separe erro de espera além do glifo.** O erro tem três portadores, e nenhum é cor:
   - um trilho de 3 px na borda esquerda da linha;
   - o chip de tempo quadrado, com `!`;
   - o losango.

   A espera tem chip redondo cheio, e o encerramento chip redondo contornado. O trilho também está na faixa recolhida, na barra do pedido e no bloco de erro da conversa. A fase 3 dá a cor ao trilho e ao chip.
6. **Um item com erro de sessão.** A `t8` (`Deprecate v1 webhooks`) está com `Session error · Plan` há 7 min. A linha e a faixa têm os três portadores do erro. A trilha diz `Plan · session error`. A conversa mostra o bloco de erro com a razão (`exited with code 137`), sem botão. A barra do pedido tem **Retry**.
7. **O desfazer nos cartões decididos.** A decisão é um par de botões alternáveis (`aria-pressed`). A ativa aparece pressionada (`✓ Approved`), e clicar nela de novo a desfaz, como em `features.md`. O cartão decidido mantém o texto inteiro e legível. Um rascunho publicado não tem mais o que desfazer: ele mostra `Created acme/android#104` com o link. O mock é interativo: decidir atualiza o progresso, `Next to decide` e **Publish review**, que habilita com o último.

## Os três itens só respondidos na rodada 02

- **Erro de sessão.** Tem cena: a `t8`, como no ponto 6. O backend já levanta `session_error` em todo lugar de situação (`internal/attention/derive.go`). O cinza de "erro de sessão sem situação" que `screens.md` registra vem do mapeamento de tons do frontend, e a estrutura o elimina: uma sessão com erro aparece como erro na aba e na conversa dela, mesmo quando nenhuma situação a segura. A cor de atenção da linha continua vindo só das situações.
- **Item apagado.** Tem cena: `?scene=deleted`. **Delete task…** no `⋯` da `t5` leva a ela. A área principal diz que a task foi apagada e o que a remoção fez. A worktree que o git não removeu fica listada com o caminho e o que fazer (o `LeftoversNotice` de hoje ganha lugar). A página não oferece **Open in History**, porque uma task apagada não vai para lá. Ela oferece **Back to Mobile App** e **Next that needs you**. A mesma página, com o seu texto, serve para o item arquivado e para o review encerrado pelo merge.
- **Migração.** Tem cena: `?scene=migration`. **MySpec couldn't be updated** ocupa a janela inteira, sem a lateral, com os casos agrupados por tipo e o que fazer em cada um, como no produto.

Também tratados, da crítica:

- **O início do app** (`?scene=loading`) nomeia cada passo enquanto ele roda, com o tempo do lento. As notas do mock usam o estilo tracejado e nunca a tipografia da interface.
- **O aviso genérico do app** (`Something went wrong`, `?notice=1`) é uma faixa no topo da área principal, até ser dispensada.
- **O card fora da última leitura** tem cena no rascunho 2 da `d2`.
- **A conversa do `r1`** não mostra mais o agente decidindo. O usuário pede ao agente para reescrever um apontamento, o agente reescreve o relatório, e as decisões continuam sendo só do usuário.
- **A contradição da `t6`** foi removida: a pausa veio no meio de um turno, e nada espera pelo usuário.
- **`Publish review` aparece uma vez só**, na barra do pedido, com a razão ligada por `aria-describedby`.
- **A segunda situação da `t1`** aparece uma vez em cada lugar que lhe cabe: o `+1` na linha e o chip na aba. A barra do pedido fala só da conversa em tela, e a barra do step fala só do step.
- **O aviso de clone na árvore** é um `treeitem` (Enter muda o caminho), sem parada de Tab no meio do roving tabindex.
- **Na linha selecionada**, meta e ação usam `--ink-3`, e não `--ink-4`, pelo contraste.
- **A faixa recolhida** leva a contagem de PRs pendentes (`4`) no separador de Reviews e o `+1` do item com duas situações.

## A barra do pedido como regra

| O item pede | A barra diz | A ação que resolve |
|---|---|---|
| Pergunta | `Question · <lugar> · <tempo>`, e como responder | Fica no cartão (as opções são a resposta). A barra tem `↑ Show` |
| Permissão | `Permission · <lugar> · <tempo>`, a ferramenta e a entrada | Fica no cartão. A barra tem `↑ Show` |
| Erro de sessão, step, PR, passada, publicação | O erro e a razão curta | **Retry**, **Try again**, **Clean and start**, **Publish review** (de novo) |
| Encerramento | `Ready to close`, o que o encerramento faz | **Close task** |
| Apontamentos, rascunhos | O progresso `N of M decided` | **Next to decide** (`Alt+↓`), mostrar ou esconder a coluna, **Publish review** |
| Rascunho da PR, step a revisar ou aprovar, etapa pronta para continuar, commits novos, checks falhando | O que pede e o progresso, quando há | **Approve**, **Continue**, **Review again** |

Com mais de uma situação, a barra fala da conversa em tela. Quando só a outra conversa espera, ela diz isso e leva até lá. Quando nada espera (agente rodando, esperando o GitHub, pausado, ocioso), a barra não existe.

## Largura

- **Lateral**: contínua, de 288 a 380 px. Abaixo de 330 px de lateral, o meta sai e os rótulos passam à forma curta. Abaixo de 370 px, a ação em curso passa à forma curta.
- **Área principal**, por container query sobre a própria largura:
  - abaixo de 1020 px, `Review mode` e `Models` vão para o `⋯` (e continuam em `Details`);
  - abaixo de 900 px, o breadcrumb fica só com o item.
- **Painéis** viram coluna quando `área principal − coluna de decisão − painel ≥ 760 px`, ou seja, quando a coluna de leitura de 800 px ainda cabe. Sem a coluna de decisão, isso acontece a partir de cerca de 1450 px de janela. Com ela, a partir de cerca de 1950 px. Abaixo disso, o painel cobre a conversa. A regra não depende de um ponto fixo da janela.

## Atalhos

- Os da rodada 02: `Ctrl+N`, `Ctrl+J`, `Ctrl+,`, `Alt+←`, `Alt+→`; na árvore, ↑↓, ←→, `Home`, `End` e `Enter`; `Alt+↓`/`Alt+↑` entre o que falta decidir.
- `Ctrl+J` deixa o foco na primeira ação da barra do pedido.
- As teclas 1 a 9 respondem com o foco no cartão de pergunta ou de permissão.
- `Esc` fecha, nesta ordem: o popover, o painel e as configurações.

## O que ficou de fora e por quê

- **Onde moram os cartões de apontamento e de rascunho.** A decisão é da fase 4, como está registrado. A coluna só se mantém porque o mock precisa de um lugar.
- **O review da PR da própria task com apontamentos** (decididos em texto hoje). O crítico o pede para julgar a unificação com o centro de review, e isso é a mesma decisão da fase 4. A barra do pedido já tem a linha dele na tabela acima.
- **A faixa de review do step `Manual`** (lista de arquivos e stage) e o **rascunho editável da PR** não têm cena. A estrutura os põe no lugar de hoje: a faixa sob a barra do step, o rascunho na coluna de decisão. **Approve** e **Approve draft** ficam na barra do pedido. São telas da fase 4.
- **Um atalho para recolher a lateral.** Não entrou: seria um atalho novo sem pedido. O botão `«` basta.
- **O painel `Details` aberto por padrão numa janela larga.** Não entrou: é fechado por padrão, como os outros painéis (brief, seção 5).

## Recomendação

Aprovar esta estrutura e registrar `structure-draft.md` como `design/structure.md`. O ponto que mais vale o olho do usuário é a linha da árvore a 1250 px e a 2500 px, com os três portadores do erro. É ela que carrega o "depende de mim".

## Dados que faltam

- **A ação em curso, o início do turno e quem trabalha, num item não aberto** (linhas 2 e 3). Hoje o `State` só tem `turnRunning`. O resumo do item precisa da última ação `running` (rótulo e alvo), de `turnStartedAt` e da conversa (implementador, revisor). Custo pequeno. Já decidido.
- **Os checks pelo nome durante `Waiting for checks`**, com estado e duração (`Details`, conversa). O backend lê a lista a cada minuto e o DTO só leva `failedChecks[]`. Custo pequeno.
- **Os checks lidos antes de uma passada** (`Details` do review). Não chegam ao DTO. Custo pequeno.
- **O estado de erro de cada sessão de um item**, para a aba e a conversa. O bloco de sessão hoje descreve a sessão que a tela mostra. A aba da outra conversa precisa do `sessionStatus` dela. Custo pequeno.
- **O resultado do apagamento** (o que foi removido e o que ficou no disco), para a página do item apagado. Hoje ele vira o `LeftoversNotice`. Precisa chegar como resultado da chamada de apagar. Custo pequeno.
- **O resultado do encerramento no `ArchivedTask`**, para a página do item arquivado. Não foi confirmado no DTO (`journeys §4.7`). Custo pequeno, se faltar.
- **Os passos do início do app**, para nomear o lento. Hoje o frontend só sabe que o estado ainda não chegou. Custo pequeno (um evento de progresso), ou mostrar só `Starting MySpec…`.
- **Desde quando uma sessão está pausada** (`since yesterday 18:02`). Não é exposto. Custo pequeno, ou sai da barra.

Deriváveis no frontend: a posição curta de cada linha, a ordem do `Ctrl+J`, as contagens por tom, a marca One-Shot (`mode`), `checkedAt`, a fase de leitura do GitHub, o progresso de decisão, e se um item que sumiu foi arquivado (está no histórico) ou apagado (não está em lugar nenhum).

## Decisão

Aprovada em 2026-09-24 como estrutura, registrada em `design/structure.md`, com o topo do item aberto, a experiência de progresso entre etapas e a experiência dos agentes implementador e revisor deixados em aberto para a primeira tela da fase 4. Ver `design/decisions.md`.
