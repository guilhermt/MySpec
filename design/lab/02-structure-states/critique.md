# Crítica · 02 · Estrutura: estados e larguras do modelo A

Régua: `design/brief.md` (seções 3, 5, 6, 7, 9, 10, 11), `design/decisions.md`, `design/lab/README.md` e a crítica da rodada 01. Ainda não existem `structure.md`, `principles.md` nem `system/`. Onde a régua não cobre, o texto diz que é opinião.

Como foi avaliado: o navegador com a extensão não estava conectado. As duas páginas foram servidas pelo `http.server` e capturadas com Chromium headless a 1100×1000, 1250×1000 e 2500×1000, em `?open=t1|r1|t5|t2|t4|t6`, `?scene=home|loading|reading|archived|empty|welcome`, `?scene=archived&open=r2` e `?open=r1&sb=collapsed`. O teclado foi julgado pelo código dos handlers, sem ser exercitado. O código comum às duas páginas (dados, átomos, conversa, lugares) é o mesmo, 32 linhas mais abaixo na b. As linhas citadas sem arquivo são de `a.html`.

## A crítica 01: resolvido ou só respondido

| Item | Veredito | Onde |
|---|---|---|
| T1 · estados da seção 7 | **Resolvido em parte.** Erro, encerramento, pausado, ocioso e GitHub têm lugar e forma. O **erro de sessão** não aparece em nenhum item: a `t5` é um step bloqueado, que é outro kind. O README resolve o caso por afirmação ("erro de sessão sempre vira `session_error`"), mas `screens.md:310` registra que hoje existe erro de sessão sem situação, no tom `idle`. Ou é uma mudança de backend que falta em "Dados que faltam", ou o estado foi apagado por definição. | README, "Toda a rodada", 1 |
| T2 · várias situações | **Resolvido** nas duas. A a mostra a contagem (`+1`), e a seção 3 pede "quantas o item tem". A b mostra cada uma. | `1295`; `b.html:1338-1341` |
| T3 · clone inexistente | **Resolvido.** Aparece no nó `No board`, na Home, no filtro e na task. O caso `acme/android`, repositório sem clone, é um acréscimo bom. | `1328`, `1036-1041` |
| T4 · carregando e item que sumiu | **Resolvido em parte.** Início, primeira leitura e item arquivado têm cena. O item **apagado** existe só como frase no rodapé da página de arquivado (`1072`). O card fora da última leitura, que a seção 7 também lista, não tem cena. O erro de **migração** no início (seção 7, Erro) não tem lugar no `loadingApp` (`1074-1086`). | |
| T5 · ação em curso no estreito | **Resolvido na b, só respondido na a.** A forma curta da a perde o verbo (`plans.ts`, `436`) e inventa uma abreviação que nenhum algoritmo tira do rótulo e do alvo (`go test keys` a partir de `go test ./internal/keys/...`, `424`). A regra da b, que encurta o caminho pelo meio, é mecânica e mantém o verbo (`b.html:1348`). | |
| T6 · botão desabilitado | **Resolvido.** Borda tracejada, texto apagado e a razão ao lado (`72-73`). | |
| T7 · `Waiting for checks` | **Resolvido.** A `t2` está em PR review, com os textos de `features.md`. | `440-446` |
| T8 · rótulo da barra do step | **Resolvido.** | `603-614` |
| T9 · contraste | **Resolvido sobre `--bg`** (#6e6e6e sobre #f5f5f5 dá cerca de 4,7:1). Sobre a linha selecionada (`--selected` #dedede, `349`) o mesmo `--ink-4` cai para cerca de 3,8:1, e carrega `api#412`, o turno e o `%` do item aberto. Anotar para a fase 3. | |
| A1 · `Models` e modo a 1250 | **Resolvido.** A 1250 px a área principal tem 998 px, abaixo do limite de 1020 (`298`), e os dois entram no `⋯` pelo nome (`1344-1345`). | |
| A2 · gravidade no nó recolhido | **Resolvido** nas duas. | `1308-1316`; `b.html:1365-1372` |
| A3 · faixa só com forma | **Resolvido em parte.** Os blocos têm tempo ou palavra de estado. A contagem `4 pending` sumiu da faixa: o separador do grupo só leva o ◇ (`stripHtml`, `987-1001`), e a seção 5 pede essa contagem de longe. A segunda situação da `t1` fica só no texto para leitor de tela (`997`). | |
| A4 · voltar a uma etapa | **Resolvido.** Os chips de planejamento concluídos são botões (`561`). | |
| A5 · ordem dentro do nó | **Só respondido**, e a resposta é aceitável: a ordem de criação preserva a memória espacial, e a marca `Ctrl J` segue a gravidade. | |
| A6 · tempo de espera e de turno | **Resolvido.** Chip cheio contra spinner e texto, também no nome acessível (`536-537`). | |
| A7 · setas na árvore | **Resolvido** (`1200-1235`). Resta um problema de papel: o aviso de clone é `role="note"` com um botão, dentro de `role="tree"` (`1328`; `b.html:1383`). Um filho que não é `treeitem` fica fora da navegação por setas, e `Change path` vira uma parada de Tab no meio do roving tabindex. | |
| A8 · `Enter` em Home | **Resolvido.** | `1034` |
| A9 · nó `No board` | **Resolvido.** | `486` |
| A10 · largura vazia a 2500 | **Só respondido na a.** A 2500 px, a conversa do `r1` ocupa cerca de 750 px de 2160 (captura). A b responde com `Details`, e isso tem custo (ver b). | |

Nenhum item ficou sem resposta. Três foram respondidos sem estar resolvidos: erro de sessão (T1), item apagado e migração (T4) e o verbo da ação curta na a (T5).

## Toda a rodada

1. **Erro e espera têm o mesmo chip; o encerramento tem outro.** O chip de tempo é cheio para erro e para espera, e contornado só no encerramento (`103-107`, `536`). Com isso, o erro se distingue da espera, de longe, por um glifo de 9 px (◆ contra ●, `80-81`). A seção 5 pede a gravidade de longe, e a hierarquia do mock gasta a diferença de forma no grau menos grave. A cor vem na fase 3, mas a estrutura precisa reservar um portador que não seja só cor (seção 9).
2. **O `r1` mostra `Publish review` desabilitado duas vezes na tela**: na barra do review (`650`) e na coluna da a (`1358`), ou na decisão da b (`b.html:1466`), com duas razões escritas de formas diferentes (`4 left to decide`, `4 left`, `Decide 4 more to publish`). A cópia da coluna não tem `aria-describedby` (`1358`).
3. **Fidelidade: a conversa do `r1` faz o agente decidir.** O agente responde `Discarded 4 and 5` (`784`), e os cartões 4 e 5 aparecem como `Discarded`. Em `features.md` (§O relatório e a decisão), pedir ao agente reescreve o relatório: ele retira ou muda apontamentos. A decisão `Approve` ou `Discard` é só do usuário. O mock confunde as duas coisas no único exemplo do fluxo que a seção 10 manda unificar.
4. **Texto contraditório na `t6`.** A barra diz `nothing waits for you` (`638`), e a conversa diz `the agent's question above is still open` (`768`). No mesmo item, as duas frases desdizem o sinal de "depende de mim".
5. **O review da PR da própria task continua sem desenho.** Nenhuma task está em PR review com apontamentos. Sem ele, a outra metade do problema da seção 10 (apontamentos em texto contra cartões) não pode ser julgada. Isso pesa sobre a b (ver "As duas contrariedades").
6. **As notas do mock têm o estilo do produto.** "The same page appears when an open item is deleted…" (`1072`) e "If this takes more than a few seconds…" (`1084`) estão na área principal, com a tipografia da interface, e não com o tracejado das notas do mock. Quem decide olhando lê essas frases como texto da interface.

## a · Linha compacta

1. **A linha que espera pelo usuário perde a posição do item.** Com uma situação, a linha 2 mostra só o que ela pede (`1293-1296`), e o nome acessível também omite a posição (`ariaFor`, `517-523`). A `t1` diz `Question +1` a 1250 px e `Question · Reviewer +1` a 2500 px, sem `Step 3/7` em nenhuma largura. A `t4` diz `Ready to close`, sem a PR. A seção 5 pede de longe, na mesma linha, a gravidade e "onde a task está: etapa, `Step N of M`". Os itens que mais importam são justamente os que perdem essa informação.
2. **O nome some na largura estreita, e a largura estreita vai até 1870 px.** A lateral é `clamp(252px, 15.5vw, 340px)` (`333`) e só passa de 252 px acima de 1626 px. A forma curta (`≤290px`, `365`) vale até cerca de 1870 px. A 1100 e a 1250 px os nomes cabem em 15 a 18 caracteres (`Rate limit per API …`, `Migrate settings pag…`, `Widget for today's ta…`). Mostrar os dez itens sem rolar não adianta se não dá para saber qual é qual sem hover. A 1250 px a área principal tem 998 px; opinião: trinta ou quarenta pixels a mais na lateral custam pouco ali.
3. **A linha do agente rodando perde o estado do step no estreito.** `posMin` troca `Step 2/5 · pass 2` por `2/5` (`423`), sem dizer que é o revisor quem trabalha. Na `d1` o `posMin` é vazio (`436`), e a linha vira `plans.ts 17%`, sem verbo e sem `Discussing`.
4. **`One-Shot` sumiu da linha.** `meta()` mostra só `repo#card` (`511-515`). A seção 3 põe o tipo `One-Shot` "de relance" na task. A b o mantém (`b.html:1330`).
5. **A coluna de apontamentos custa 290 px na largura em que a conversa mais precisa de espaço.** A 1100 px a conversa fica com 558 px (`373`, `376`). E um cartão decidido não oferece desfazer: a etiqueta `Approved` não é botão (`698-701`), contra "clicar na decisão ativa a desfaz" (`features.md`, §O relatório e a decisão).
6. **A 2500 px continuam cerca de 1400 px vazios** em volta da conversa do `r1`, com a coluna já aberta. A régua não obriga a preencher esse espaço; fica como opinião.

## b · Linha rica

1. **Com o volume do mock, a árvore não mostra os itens mais graves, e isso acontece em qualquer largura.** A 1000 px de altura cabem seis itens inteiros a 1100 e a 1250 px, e sete a 2500 px. O que limita é a altura: a linha rica ocupa de 60 a 150 px e não encolhe com a largura. Ficam abaixo da dobra a `t5` (o erro, a mais grave, e o alvo do `Ctrl+J`, com a marca junto), a `t4` (encerramento), o clone inexistente e a task pausada. Nada indica que há algo abaixo. A Home diz "What needs you is marked in the tree" (`1032`), e na b isso deixa de ser verdade. Ao abrir a `t5`, a árvore rola, e `Reviews`, `4 pending` e o `r1` (34 min) saem da vista (captura `?open=t5`). Isso contraria a decisão central da seção 5: a árvore é o "depende de mim". O README admite o problema, mas o põe na conta do volume. O volume do mock (10 itens) é maior que o dia típico, e a lab exige mocks densos.
2. **A hierarquia da altura está invertida.** O `r2`, ocioso e publicado, ocupa três linhas (`b.html:1356` mais a posição). A `d1`, que não pede nada, ocupa cinco. A `t5`, o erro, fica abaixo deles. A linha gasta altura no que não depende do usuário.
3. **A barra de decisão não é um lugar: são dois casos especiais.** `decisionBar` só existe para o `r1` e para a `t1` (`b.html:1462-1473`). A `t3` (pergunta), a `t5` (erro), a `t4` (pronta para encerrar) e o rascunho de PR não têm barra. A seção 6.3 pede pergunta, permissão e decisão impossíveis de perder, e a rodada não mostra a barra como regra.
4. **A segunda situação da `t1` é dita três vezes.** A barra do step diz `Waiting for you in both conversations`, as abas trazem cada uma o seu chip, e a barra diz `Also waiting in Implementer` com `Open Implementer`, que faz o mesmo que clicar na aba. O argumento do README de que "a coluna da a não trata" a segunda situação não se sustenta: a a a trata nas abas e na barra do step (`stepTabs`, `615-626`, igual nas duas).
5. **`Details` repete o que está acima dele.** A trilha de etapas e a barra do step continuam no topo, e `Details` repete as etapas, o step atual e as situações (`detProgress`, `b.html:1411-1431`). No `r1`, o índice de apontamentos (`b.html:1456`) é a terceira navegação entre eles, depois da barra e dos cartões. `Back…` fica em três lugares: na trilha, no `⋯` e em `Details`.
6. **Abaixo de 1900 px, `Details` não é mais barato que o `⋯` da a.** Trocar `Models` a 1250 px exige abrir `Details` sobre a conversa (`b.html:1504-1507`) e depois o popover. São dois cliques, como na a, e a conversa fica tapada. "Em qualquer largura, sem menu de transbordo" troca o menu por um painel sobreposto.
7. **Perdeu-se uma feature: o resumo editável do relatório.** A a o tem na coluna (`1359`). Na b ele não aparece em lugar nenhum. `features.md` (§O relatório e a decisão) põe o resumo editável no painel de apontamentos, e ele entra no review publicado.
8. **Os cartões decididos mostram só o caminho** (`compactDecided`, `b.html:726-728`). Para reler o que foi aprovado, é preciso `Change`, e o nome sugere trocar a decisão, não ler.
9. **"Fechar é lembrado" não é lembrado.** `S.detailsClosed` volta a `false` a cada carga (`b.html:1317`). É detalhe de mock, mas o argumento contra a regra dos painéis fechados se apoia nessa memória.

O que a b compra: a linha com uma situação por linha, os checks pelo nome e a posição completa são a leitura mais fiel da seção 5, item por item. A ação curta pelo meio do caminho é a regra certa. A barra acima do compositor, onde existe, mantém a decisão à vista na largura estreita sem tirar largura da conversa.

## A barra de decisão e `Details` contra a seção 6

- **6.1, de quem é a vez:** as duas variações empatam. A barra do step e as abas já dizem isso nas duas.
- **6.3, decisão impossível de perder:** a barra é melhor que a coluna na largura estreita (não custa 290 px) e ao rolar a conversa. Mas só está demonstrada no `r1`. Na `t1` ela repete as abas. A coluna da a mantém todos os apontamentos à vista enquanto o usuário conversa com o agente sobre eles, e é assim que `features.md` descreve a decisão ("a conversa fica aberta durante a decisão"). Os cartões dentro da conversa sobem com ela.
- **6.5, documentos e relatórios sem painéis abertos:** `Details` vai contra. É um painel aberto sem pedido, justamente o problema da seção 10 ("o painel de artefatos abre sozinho").
- **6.7, a mesma conversa com o próprio em volta:** a barra só é "o próprio em volta" se for um lugar que todo item usa. Hoje não é.

**Custo:** a b perde o resumo editável e a leitura dos decididos, repete a posição em `Details` e diz a segunda situação três vezes. Abaixo de 1900 px, `Details` tapa a conversa para chegar a `Models`.

## As duas contrariedades

- **`Details` aberto por padrão a partir de 1900 px.** Não vale uma chamada ao usuário. A seção 5 e a entrevista dizem que os painéis ficam fechados, e a seção 10 lista o painel que abre sozinho como problema a não repetir. O argumento de que `Details` "não é nenhum dos quatro" não se sustenta: ele usa o mesmo lugar que `Artifacts`, `Card`, `Reports` e `Documents` (`b.html:1387-1390`). Se a preferência de estar aberto for de fato lembrada, fechado por padrão custa um clique, uma vez. Registre como fechado e siga.
- **Decidir apontamentos na conversa.** Levar agora não vale. `decisions.md` adia isso "para avaliar depois, na tela", e a crítica 01 pôs a condição: desenhar antes o review da PR da própria task ao lado do de terceiros. A rodada não desenha esse review (ver "Toda a rodada", 5), e o único exemplo mostra o agente decidindo (ver "Toda a rodada", 3). O usuário decidiria sem a evidência que o próprio registro exige.

## A combinação que o designer recomenda

**Coerente na estrutura, mas amarra quatro decisões numa só.** "A área principal da b" junta:

1. a barra acima do compositor;
2. os cartões na conversa;
3. `Details`;
4. `Details` aberto por padrão.

As quatro são independentes. A barra funciona com a coluna da a, e `Details` funciona sem a barra. Escolher "a área principal da b" decide, por tabela, o item 2, que está adiado para a fase 4.

**O que se perde na combinação:**

- A coluna de apontamentos sempre à vista enquanto se conversa sobre eles.
- O resumo editável.
- `Models` e `Review: Agent` a um clique no cabeçalho na janela larga, quando `Details` está fechado.
- O que a linha rica fazia de melhor: a ação curta com verbo e o `One-Shot`. A linha da a entra com os problemas 1 a 4 dela, e a combinação não corrige nenhum.

**O que se ganha:** a decisão à vista no estreito, sem custar largura, e um lugar para os fatos da task e os checks pelo nome, que a rodada 01 pediu trazer da B como painel.

## Comparação

- **De longe:** a a mostra os dez itens em qualquer largura, mas corta os nomes até 1870 px e tira a posição das linhas que esperam. A b mostra cada item por inteiro, mas só sete, e esconde o erro e o encerramento em qualquer largura.
- **Gravidade:** nas duas, o erro se distingue da espera só por um glifo de 9 px, e o chip diferente ficou com o encerramento.
- **Decisão (seção 6):** a barra da b é melhor no estreito, mas é um caso especial em dois itens. A coluna da a é melhor para conversar sobre os apontamentos, e custa 290 px no estreito.
- **Fidelidade:** a b perde o resumo editável e a leitura dos decididos. A a perde o `One-Shot`, o desfazer da decisão e o verbo da ação curta.
- **Contra o registrado:** a a não contraria nada. A b contraria os painéis fechados e antecipa uma decisão adiada.

## Recomendação

**A linha da a e a área principal da a, com a barra acima do compositor como acréscimo.** Isso diverge do designer na área principal. Não é para decidir já. Antes, uma revisão curta da a:

1. a posição na linha que espera (`Step 3/7`, a PR), pelo menos na forma curta;
2. uma lateral mínima que não corte os nomes a 1250 px;
3. o verbo na ação curta, pela regra mecânica da b;
4. o `One-Shot` de relance;
5. um portador de gravidade que separe erro de espera além do glifo;
6. um item com erro de sessão;
7. o desfazer nos cartões decididos.

**A barra de decisão** entra como um lugar que todo item usa quando pede algo (pergunta, permissão, erro, encerramento, apontamentos), e não em dois casos. **Onde os cartões moram** continua para a fase 4, como está registrado. **`Details`** entra como mais um painel auxiliar, fechado por padrão, com os fatos, os checks pelo nome e os modelos, sem repetir a trilha.

Ao usuário vai uma decisão só, a anatomia da linha, com a a revisada. Nenhuma das duas contrariedades da b precisa de chamada.
