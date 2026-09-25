# Crítica · 03 · Estrutura: consolidação

Régua: `design/brief.md` (seções 5, 6, 7, 9, 10, 11), `design/decisions.md`, a crítica da rodada 02 e `design/research/journeys.md` §2.1 (o catálogo de situações). Como foi avaliado: a página foi servida pelo `http.server` e capturada com Chromium headless a 1100, 1250 e 2500 px, em `?open=t1|t3|t4|t5|t6|t8|d1|d2|r1|t2`, `?open=t1&tab=Implementer`, `?open=t2&aux=Details`, `?open=r1&sb=collapsed` e `?scene=home|loading|deleted|migration`. O teclado foi julgado pelo código dos handlers, sem ser exercitado. As linhas sem nome de arquivo são de `a.html`. `draft` quer dizer `structure-draft.md`.

## 1. Os sete pontos e os três itens

| Ponto | Veredito |
|---|---|
| 1 · Posição na linha que espera | **Resolvido** na árvore, nas duas larguras. Um resto: o cartão **Continue** da Home mostra `Question · Reviewer + Permission · Implementer · api#412`, sem `Step 3/7` (`1308`). Isso fere a regra do README (linha 54): o rótulo de uma situação nunca aparece sem a posição. |
| 2 · Lateral que não corta nomes a 1250 | **Resolvido.** A lateral tem 300 px, e só o título longo da PR corta. |
| 3 · Verbo na ação curta | **Resolvido** (`Running go test …/keys/ …`, `Reading …/plans.ts`). |
| 4 · `One-Shot` de relance | **Resolvido.** A 1250 px o selo `1` é pequeno, mas o tamanho é da fase 3. |
| 5 · Gravidade além do glifo | **Resolvido.** O trilho, o chip quadrado com `!` e o losango aparecem na linha, na faixa recolhida, na barra do pedido e no bloco de erro. |
| 6 · Item com erro de sessão | **Resolvido** (`t8`). |
| 7 · Desfazer nos decididos | **Resolvido** (`aria-pressed`, `759`). O texto dos cartões decididos fica legível. |
| Erro de sessão | **Resolvido**, pela `t8`. A regra do cinza está no draft (linha 87). |
| Item apagado e migração | **Resolvidos.** As duas cenas existem e dizem o resultado e o que fazer. |
| Verbo da ação curta | **Resolvido.** |

Os outros acertos anunciados no README também estão na tela: a conversa do `r1` mostra o usuário decidindo, `Publish review` aparece uma vez só, o aviso de clone é `treeitem` (`1171`), e a faixa recolhida tem o `4` e o `+1`.

## 2. A barra do pedido

**Ela cobre quase todos os pedidos, mas repete as barras de cima em quatro das sete cenas.**

- **O rótulo da situação continua na barra do item.**
  - `t8`: a trilha diz `Plan · session error`. A barra do planejamento diz `◆ Session error` (`704`). A barra do pedido diz `◆ Session error · Plan`, e o texto dela (`806`) repete o do bloco de erro (`The conversation is kept`).
  - `t5`: `◆ Blocked` na barra do step (`674`) e `◆ Step 2 blocked` na barra do pedido.
  - `r1` e `d2`: `● Decide findings` e `● Decide drafts` nas barras do review e da discussão (`712`, `716`), e de novo na barra do pedido.
  - `t1`: a aba `Reviewer` tem `Question` e o chip `18m` (`685`), e a barra do pedido repete os dois.

  O draft diz que as barras de cima levam "estado e ferramentas" (linha 146), mas não diz o que elas mostram quando o estado *é* a situação. Falta essa regra. Uma proposta: com a barra do pedido presente, a barra do item mostra só a posição e o progresso (`pass 1`, `writing the step files · 3 of 6`, `Step 2 of 4 · Timeline provider`), e o glifo e o rótulo ficam na barra do pedido. A aba mantém o glifo e o chip, porque é ela que aponta a *outra* conversa.
- **Quatro kinds do catálogo ficam fora da tabela** (draft 171-183):
  - `pr_closed`, que só se resolve apagando a task (**Delete task…** fica no `⋯`);
  - `worktree_unreadable`, que se resolve sozinho;
  - `step_empty`, que se resolve com **Discard step**. Essa ação é uma ferramenta da barra do step (`677`), o que contradiz "único lugar dessa ação" (draft 169);
  - `findings` da PR da própria task. Esse é adiado para a fase 4, mas a tabela devia dizer que é.
- **"Único lugar" tem exceções que o draft não registra.** **Publish epic** fica no grupo da coluna (`788`), e o **Retry** de uma publicação que falhou fica no cartão em que ela parou (`features.md`, §Rascunhos, "a razão e **Retry** ficam no cartão"). As duas regras de `features.md` estão certas. O draft precisa dizer que a ação de uma parte da coluna fica na parte. Além disso, **Publish epic** desabilitado não tem `aria-describedby`, contra o draft (linha 185).
- **`Resume` aparece duas vezes na `t6`**: no cabeçalho e, como primário, na barra do planejamento (`701`). O draft põe **Pause/Resume** só no cabeçalho (linha 128) e diz só "desde quando" para a barra (linha 287). É o mesmo defeito que a crítica 02 apontou em `Publish review`.

## 3. O draft contra o mock e contra o que a fase precisa

**Contradições com o mock:**

- **Linha 46:** o aviso de clone fica "sob o nó do repositório", mas a árvore não tem nó de repositório. O mock o põe sob **No board** (`1171`), como a linha 44 diz.
- **Linha 23:** o **Continue** leva "o que ele pede ou onde está", e o mock mostra o pedido sem a posição (ver o ponto 1).
- As exceções a "único lugar" e o `Resume` duplicado, da seção 2.

**O que falta cobrir:**

- **Notificação.** Aonde leva o clique na notificação (brief §9, J1). É o laço principal do dia, e o draft não o menciona.
- **Flash.** O aviso momentâneo de uma situação nova com a janela em foco é uma feature (`journeys §2.2`). Sem ele, a seção 9 perde uma feature preservada.
- **Anúncio.** `role="status"` ou o equivalente quando a barra do pedido aparece ou muda sozinha, e quando uma linha da árvore muda de gravidade (brief §9, Acessibilidade). Hoje a barra do pedido é `region` (`796`).
- **Compositor.** Modelo e esforço da próxima mensagem (o mock tem `Opus · high ▾`), **Stop**, a fila, e o botão `New messages` quando a conversa não está no fim (brief §6, Rolagem). O draft lista só parte disso, espalhado pela seção 7.
- **Muitos itens** fora da árvore: a conversa longa, o board com até 2.000 issues, History (brief §7). A linha 291 fala só da árvore. Isso pode ser adiado para a fase 4, mas o draft deve dizer que é.
- **`Ctrl+J` numa pergunta.** O foco cai em `↑ Show`, não no cartão (`1449`), então responder pede `Ctrl+J`, `Enter` e o número. O draft (linhas 89 e 244) deveria dizer isso, ou mandar o foco direto para o cartão, como o comentário do código promete (`1448`).

A navegação, a barra lateral, a área principal, as larguras e os dados do backend estão completos e batem com o mock.

## 4. Impedimentos

Nada impede a aprovação da estrutura. Os problemas são de texto do draft, mais duas duplicações visuais no mock (a barra do item contra a barra do pedido, e `Resume`), e nenhum muda o modelo. A duplicação da seção 2 é a única que o usuário vai notar olhando. Vale corrigir no mock antes de mostrar, ou citá-la como a regra que falta.

Antes de o draft virar `design/structure.md`, entram:

- a regra da barra do item quando há uma situação;
- os quatro kinds que faltam;
- as exceções a "único lugar";
- a linha 46;
- notificação, flash e anúncio;
- o compositor.

Opinião, fora da régua: a 2500 px, a conversa do `r1` ainda tem cerca de 1000 px vazios. A medida de 800 px é defensável, e isso fica para a fase 4.

**Pronto para o usuário.** O modelo está consolidado e os dez pontos cobrados estão resolvidos no mock. O que falta é regra escrita no draft e duas repetições, e isso se corrige sem uma nova rodada.
