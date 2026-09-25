# Crítica · 10 · A tela da task, mínima

Revisão de 2026-09-24. A régua principal é a entrada "A tela da task é mínima" de `decisions.md`. Depois vêm `brief.md` §6, `structure.md` §3 e §5, `principles.md`, `system/components.md`, `system/tokens.css`, `docs/product/features.md` e a crítica da rodada 09. Onde a régua não cobre, o texto diz que é opinião.

**Como foi olhado.**
- As nove cenas de `a.html` e `b.html`, nos dois modos, a 1250 e a 2500 px: 72 capturas.
- `?panel=Details` e `?menu` nas cenas `ask`, `checks`, `manual` e `findings`, uma conversa anterior (`?past=s2i`) com e sem `Details`, a outra voz (`?voice=impl`) e a legenda da linha.
- As cenas `ask` e `findings` a 1100, 1400, 1500, 1600, 1700 e 1850 px.
- `components.html` inteiro, nos dois modos.
- Uma sonda própria, rodada numa cópia em `/tmp`, sem tocar nos mocks. Ela mede o contraste de todo texto sobre o fundo composto e acha textos cortados sem tooltip e controles sem nome. Rodou nas nove cenas × duas variações × dois modos, a 1250, 1600 e 2500 px.
- O contraste não textual foi calculado a partir de `tokens.css`.
- `build.py` foi rodado numa cópia: as três páginas batem com `src/`.

Os números de linha são de `src/`.

## 1. A régua do usuário

**A tela é limpa, enxuta, não overwhelming?** Sim, nas duas variações. É a maior melhora da frente até aqui. A 1250 px a tela tem três coisas: o topo numa faixa, uma conversa na medida, e a barra do pedido com o compositor. Os capítulos, a margem de marcos, o filtro de vozes, o trilho, a coluna de apontamentos e a barra do step saíram, e nenhum voltou disfarçado. Os grupos de ações dobrados em linha e os marcos de uma linha deixam a conversa respirar.

**Cada elemento justifica por que existe?** Quase todos. O excesso que sobrou é um só, e aparece nas duas variações: **o estado da situação é dito três vezes.** O topo diz (a frase na A, a pílula na B), a barra do pedido diz, e o cabeçalho do cartão diz. Na cena `ask`:
- no topo, `Reviewer asks you` (A) ou `asks you` (B);
- na barra, `Question · Reviewer 18m`;
- no cartão, `Question · Reviewer · pass 2 · asked 14:38`.

Isso contraria a "Regra da situação" de `structure.md` §3: enquanto a barra do pedido existe, o topo mostra a posição e o progresso, sem o rótulo da situação. Contraria também `components.md` (Etapa, "Não faça": "Não ponha o rótulo de uma situação na trilha"). O desvio não está entre os oito ajustes do README.

**O indicador diz de um olhar em que etapa a task está, o que foi concluído e o que está rodando? É bonito?**
- **A.** A linha é elegante e silenciosa, e o glifo que anda sobre ela é a melhor ideia da rodada. Mas quem responde às três perguntas é a frase, não a linha:
  - a linha tem 13 traços de comprimento parecido (sete etapas e os sete tiques da implementação), e nada neles diz qual é qual sem hover;
  - o que falta fica quase invisível: 1,51:1 no claro e 1,58:1 no escuro para as etapas futuras, 1,46:1 e 1,75:1 para os steps que faltam;
  - feito e por fazer ficam a 2,29:1 um do outro. No escuro a 2500, na cena `checks`, os dois se confundem.

  Na prática, de um olhar se vê "um ponto âmbar numa régua", e o resto se lê na frase.
- **B.** A pílula responde às três perguntas pela forma: `✓ ✓ ✓ [Implementation 3/7 | ● asks you] ○ ○ ○`. Três etapas feitas, a atual com a posição e o estado, três por vir. Isso funciona nos dois modos e em toda largura. É menos original: é a trilha de chips da 08, compactada.
- As duas perdem os nomes das etapas feitas e das futuras na metade do monitor. A A só os mostra no hover, e a B os dobra em vistos e círculos.

**Cena a cena, o que ainda pode sair sem perder o que importa.** O que vale para as duas está na coluna comum. O que é de uma variação só está marcado.

| Cena | Pode sair | Por quê |
|---|---|---|
| `plan` | A palavra da situação no topo (`The agent asks you`, e `asks you` na B) | A barra `Reply · PRD 2m` e as respostas rápidas já dizem |
| `run` | Nada essencial. Opinião: **Pause** pode ficar só com o ícone em toda largura | `Implementer working` no topo é o único "o que roda" do topo, então fica. O compositor tem `Working · 3m 40s` e **Stop**. **Pause** é uma ferramenta rara |
| `ask` | A palavra da situação no topo. **B:** a faixa de abas | O pedido já está três vezes (seção acima). Na B, a faixa é uma segunda faixa no topo para mostrar um glifo e uma palavra |
| `error` | A palavra no topo (`Reviewer stopped`, `error`) | O bloco de erro e a barra dizem, e a barra repete a razão do bloco |
| `manual` | A palavra no topo (`Your review`). A faixa âmbar do cartão de review | A barra tingida carrega o pedido. O cartão pode ser só a lista de arquivos, neutra (opinião, ver 2.8) |
| `blocked` | A palavra no topo (`Blocked`). Opinião: o título do bloco (`Step 5 blocked · worktree not clean`) | A barra diz exatamente o mesmo. O bloco fica com a explicação e o `git status` |
| `checks` | O medidor de contexto (`18%`). **Refresh** no bloco dos checks | Não há sessão (ver 2.4). **Refresh PR** já está no `⋯` e o produto lê a cada minuto |
| `findings` | A palavra no topo (`Findings to decide`). A faixa âmbar do cartão de apontamentos | A barra tingida diz `Decide findings · PR review · pass 1` e o progresso |
| `close` | A frase inteira depois da etapa (`#1284 merged · Ready to close`). Opinião: **Pause** | A barra diz `Ready to close · #1284 merged`. Na cena nada roda para pausar |

Com esses cortes, o topo diz só onde a task está, e a barra diz o que ela pede. É o que a estrutura já pedia.

## 0. O que voltou da 09

- **0.1, espécime quebrado:** resolvido. `components.html` abre nos dois modos.
- **0.2, topo que transbordava entre 1400 e 1850:** resolvido nas duas. Não há sobreposição nem título cortado a 1100, 1400, 1500, 1600, 1700 e 1850.
- **0.3 e B.2, botões de ícone sem nome:** resolvido. A sonda não acha controle sem nome.
- **0.4, texto cortado sem tooltip:** resolvido na tela. A sonda só acha textos `.sr`, que são falsos positivos. No espécime, o grupo de ações "waits on a card" ainda corta seco (`1 on hol`), o que o README admite.
- **0.6, teclado dos pedidos:** resolvido. `1`–`9`, `A`/`D` e `Alt+↓` estão ligados (`core.js:475-483`).
- **0.9, respostas rápidas que o produto não produz:** resolvido. As pastilhas usam o começo real das opções (`m.js:243`).
- **A.1, destinatário e A.2, filtro de vozes:** resolvidos pela forma. O compositor fala com a conversa na tela.
- **0.7, estados que nenhuma cena mostra: continua**, e agora pesa mais. Faltam:
  - a revisita (`Back to…`, `ready_to_continue`, **Continue**), que perdeu o lugar visível e cuja aparência no indicador ninguém desenhou;
  - o rascunho da PR com **Approve draft**;
  - `plan_invalid`;
  - a task pausada na tela (só no espécime);
  - `step_empty`, que o ajuste 2 cita como exceção;
  - `pr_closed`;
  - uma task One-Shot na tela (só no espécime);
  - o carregamento.
- **0.8, as perguntas de `conversation.md` §7: continua.** O grupo sem saída e a mensagem do produto recolhida seguem embutidos sem ter sido perguntados.

## 2. Comum às duas

Em ordem de gravidade.

1. **Review mode e Models não são alcançáveis como controles.**
   - Em `Details`, os dois são texto estático (`m.js:165`, `<dd>Agent · step 4 is Manual</dd>`). `structure.md` §3 (Painéis) pede **Review mode** e **Models** editáveis ali, e o README diz que eles "também" estão em `Details`.
   - No `⋯`, `Review mode ›` e `Models ›` têm `aria-haspopup` e não abrem nada (`m.js:127`, `:142`).
   - O espécime desenha só o erro do submenu (`components.js:93`), e não o painel de modelos por etapa. Esse painel é uma lista de sete etapas com seletores, que não cabe num submenu de menu. `structure.md` §3 pede "o mesmo popover".
   - Sem isso, o caminho mais curto para trocar um modelo, que hoje é um clique no cabeçalho, não existe no mock. É a pergunta direta do usuário, e a resposta hoje é "não se sabe".
2. **O seletor de modo e de modelo de cada step não iniciado sumiu.** `features.md` (Modo de review, "Lista de steps") descreve um seletor de modo ao lado do modelo em cada step não iniciado. Hoje ele está na lista de steps de `Artifacts` (`structure.md` §3). Na rodada:
   - `Artifacts` lista só os arquivos de step (`m.js:170`);
   - `Details` mostra `Manual` e `Sonnet · high` como texto (`m.js:157`).

   É uma feature que some da interface. A mudança da lista de steps de `Artifacts` para `Details` também não está entre os ajustes.
3. **O rótulo da situação no topo repete a barra do pedido.** Ver a seção 1. O rótulo está em `line.js:49` (A) e `stepper.js:13` (B). Com a barra na tela, o topo deveria levar só o glifo e a posição, como `structure.md` §3 (Trilha) já diz: "o chip atual traz o glifo de estado e a posição". Sem barra (`run`, `checks`, pausada), a palavra fica.
4. **O medidor de contexto mostra `18%` num lugar sem sessão.** Na cena `checks` (`content.js:231`, `m.js:101`), a conversa da PR review ainda não existe. `components.md` (Medidor) diz "Sem sessão: `—`". A cena `blocked` faz certo e esconde o medidor.
5. **`Back to…` oferece uma etapa só.** `m.js:143` monta `Back to Tech spec…` com a task na implementação. PRD e Plan, que `features.md` (Voltar e descartar) e `structure.md` §3 permitem, somem. Com a trilha clicável fora da tela, o `⋯` é o único caminho, e ele está incompleto.
6. **O estado do laço saiu da tela.** Os textos `Agent review · pass 2`, `Addressing review · round 2 of 3` e `Committing` (`features.md:423`) eram da barra do step, que saiu.
   - O topo diz `Implementer working` (A) ou `3/7 · working` (B).
   - A árvore, na mesma cena, diz `Step 3/7 · round 1` (`content.js:213`), então os dois não batem.
   - A rodada no laço de três só aparece nas mensagens do produto, que rolam para cima.
   - Isso importa porque a terceira rodada passa o step ao usuário. A posição do topo pode levar isso (`Step 3 of 7 · round 1 of 3`) sem cromo novo.
7. **O topo muda de forma com o conteúdo, na mesma largura.**
   - A 1250 px, na A, os painéis ficam com o rótulo em `ask` e só com o ícone em `run`, porque `Implementer working` é mais largo que `Reviewer asks you`. Na B, a mesma coisa acontece entre `plan` e `manual`.
   - `fitHeader` mede o conteúdo (`m.js:110-121`). Quando a situação muda com a tela aberta, de trabalhando para pergunta, o grupo da direita salta.
   - O princípio 10 amarra cada regra à largura do contêiner. A dobra deveria depender só da largura, com a pior frase reservada.
8. **O cartão âmbar com a barra tingida (ajuste 8).** Nas cenas `manual` e `findings`, o pedido tem duas chamadas âmbar: a faixa do cartão e a barra tingida. O ajuste é aceitável, mas contraria o princípio 7 e `components.md` (Barra do pedido, variante **Quieta** quando o cartão está na tela). Precisa ser escrito como regra, não herdado da cena. Opinião: com a barra tingida, o cartão pode perder a faixa âmbar e ficar neutro. É o corte da seção 1.
9. **A conversa anterior com `Details` sobre a conversa.** A 1250, o painel cobre **Back to step 3** na faixa do pé (`a-past-s2i` com `?panel=Details`). O primeiro `Esc` fecha o painel e o segundo volta, o que funciona, mas a única saída visível fica tapada.
10. **Atalhos novos fora de `structure.md` §5.**
    - `Alt+`\`` troca de agente (`m.js:305`). Fica fora da tabela e pode ser tecla morta num teclado ABNT2 (opinião, a confirmar com o usuário).
    - `Ctrl+E` está em `data-k` no **Open in VS Code** do `⋯` (`m.js:134`), mas a tecla não aparece no item. O princípio 9 pede o atalho escrito ao lado da ação.

## A · A linha

Em ordem de gravidade. Os itens 2.1 a 2.10 valem também.

1. **A linha não se lê sozinha.**
   - Os segmentos futuros (`--line-2`, `a.css:19`) ficam a 1,51:1 e 1,58:1 do chão. Os steps que faltam (`--brand-seg-todo`, `a.css:21`) ficam a 1,46:1 e 1,75:1. Os dois estão abaixo dos 3:1 de WCAG 1.4.11 para um gráfico que carrega informação.
   - Feito (`--line-3`) contra por fazer fica a 2,29:1 e 2,33:1.
   - Os tiques da implementação e as etapas têm quase o mesmo comprimento a 1250, e os nomes só aparecem no hover, no foco ou num clique.

   O "quanto falta" e o "o que foi feito" dependem da frase. A linha acrescenta o glifo e a proporção. É bonita a 2500 no claro, e some no escuro.
2. **A conversa passa colada por baixo da linha.** O esmaecido de `--space-4` começa na borda do cabeçalho (`m.css:21`), no mesmo pixel em que a linha fica (`a.css:7`). A primeira linha do texto aparece a meia tinta logo abaixo do fio de 2 px: `Review 1 written · changes · 2 findings` nas cenas `ask` e `findings`, nos dois modos, a 1250 e a 2500. O indicador principal divide a borda com texto que rola. O princípio 6 põe o fio justamente para marcar essa borda, e o ajuste 7 o tira sem dar ao conteúdo um chão abaixo da linha.
3. **A segunda linha da barra do pedido desvia de `structure.md` §3** ("A barra fala da conversa em tela. A outra está na aba dela"). O desvio é coerente com a A, que não tem abas, e resolve bem o requisito 3. Mas não está entre os ajustes do README e precisa ser registrado.
4. **A troca de agente é o único sinal constante do outro agente**, em 13 px `--ink-3` no rodapé do compositor, ao lado do chip de modelo (`m.js:251-254`). Na cena `run`, que o usuário mais vê, o revisor ocioso aparece só ali. É claro para quem sabe que está ali (opinião). O nome acessível não contém o rótulo visível como texto contínuo: o rótulo é `Reviewer ⇄ Implementer` e o nome é `Talking to the reviewer. Show the implementer's…`. WCAG 2.5.3, menor.
5. **A linha é uma parada de Tab com `role="img"`** (`line.js:28`). O clique fixa os nomes (`a.js:16`), mas `Enter` e `Space` não fazem nada. O foco já mostra os nomes, então o dano é pequeno. A semântica fica estranha: um elemento focável, sem ação, que o mouse alterna.
6. **A 2500, o glifo fica longe da coluna de leitura no planejamento e no encerramento.** No planejamento ele está a cerca de 1000 px da barra do pedido, na ponta esquerda, e no encerramento fica junto do `⋯`. Opinião, menor: a árvore também está à esquerda.

## B · O stepper

Em ordem de gravidade. Os itens 2.1 a 2.10 valem também.

1. **A faixa de abas é a segunda faixa do topo**, em `run`, `ask` e `error`, que são a maior parte do tempo de uma task em `Agent`. É um fio mais um esmaecido (`b.css:27-28`, `m.css:23`), e o texto passa por baixo dela como na A.2. Pela régua do usuário, ela existe para mostrar um glifo e uma palavra (`Implementer · waits`) que a barra do pedido poderia dizer, como a A faz.
2. **Na metade do monitor, o stepper é só marca em todas as cenas.** Com as etapas dobradas, os nomes ficam no `data-tip` de `li` que não recebem foco (`stepper.js:15`). O teclado não tem como vê-los. Na A, o foco da linha mostra os nomes.
3. **A aba de fora diz só `waits`.** O que o outro agente pede (`Permission, 4m`) fica no tooltip e no nome acessível (`m.js:259`). Isso segue `structure.md` §3, mas pede um clique para saber se é permissão ou pergunta. Opinião.
4. **É a trilha atual, compactada.** A pílula é o componente Etapa do system (`b.css:11`), e os vistos e círculos são os chips dobrados. É exatamente o que o usuário disse que "seguia o padrão atual" (`decisions.md`, estrutura aprovada). É claro e legível, com o risco de o usuário ver o mesmo de sempre. Opinião.

## Os oito requisitos (`brief.md` §6)

| # | A | B |
|---|---|---|
| 1. De quem é a vez | Atende: a frase, a barra, o compositor com **Stop** e `Working · 3m 40s` | Atende: a pílula, as abas, a barra |
| 2. Quem fala | Atende: um agente por tela, avatar cheio ou anel, MySpec em linha | Atende, igual |
| 3. Pergunta, permissão e decisão impossíveis de perder, pelo teclado | Atende, e melhor: a segunda linha da barra mostra o pedido do outro agente com **Go to…**. O teclado está ligado. Some ao ler o passado (a barra sai), fica no topo e na árvore | Atende: o outro pedido é uma palavra âmbar na aba, sem o tipo |
| 4. Atividade sem afogar | Atende: tudo dobrado, o grupo vivo com a ação no resumo | Atende, igual |
| 5. Documentos sem painel | Atende para o lugar atual: os marcos abrem no lugar. Os relatórios e conversas de outros steps pedem `Details`, como a decisão aceita | Igual |
| 6. Marcos legíveis | Atende: uma linha cada. O estado do laço sai do topo (2.6) | Igual |
| 7. A mesma conversa em task, review e discussão | Atende: a troca só existe com dois agentes, e review e discussão têm um | Atende: as abas só existem com dois agentes |
| 8. Legível de 1100 a 2600 | Atende: nada corta nem sobrepõe. O topo salta com o conteúdo (2.7), e a linha perde legibilidade no escuro (A.1) | Atende: nada corta. O stepper perde os nomes a 1250, e o teclado não os alcança (B.2) |

## Implementador e revisor

- **A, sem abas.** É clara: a tela mostra quem tem a vez, a barra aponta o outro quando ele também espera, e o compositor fala com quem está na tela. Não há destinatário a vigiar. O custo é que o outro agente vive num controle de 13 px no rodapé (A.4).
- **B, com abas mínimas.** Também é clara, e segue `structure.md` à risca. O custo é uma faixa a mais no topo, na maior parte do tempo (B.1).
- As duas resolvem o problema da 09. A regra da A (a barra aponta, o compositor segue a tela) é mais enxuta, e cabe em qualquer indicador.

## O que foi para `Details` e para o `⋯`

| Ferramenta | Onde | Sem fricção? |
|---|---|---|
| **Review myself** | `⋯`, sob o step | Sim: dois cliques, com rótulo e tooltip. Some corretamente num step `Manual` |
| **Open in VS Code** | `⋯`, e na barra do `Manual` | Sim. O atalho não está escrito (2.10) |
| **Discard step N…** | `⋯`, e na barra em `step_empty` | Sim no `⋯`. A cena `step_empty` não existe |
| **Review mode** | `⋯ ›` e `Details` | **Não**: o submenu não abre e `Details` é texto (2.1) |
| **Models** | `⋯ ›` e `Details` | **Não**: igual, e o popover por etapa não foi desenhado (2.1) |
| Modo e modelo de cada step | Nenhum lugar | **Não**: a feature sumiu (2.2) |
| **Back to <etapa>…** | `⋯` | **Parcial**: uma etapa só (2.5) |
| Conversas e relatórios anteriores | `Details` | Sim: um clique lê no lugar, `Esc` volta. O painel cobre a volta a 1250 (2.9) |
| **Refresh PR**, **Open PR**, **Review again** | `⋯` | Sim. **Review again** desabilitado com a razão durante os checks |

## Os oito ajustes do README

| # | Ajuste | Julgamento |
|---|---|---|
| 1 | **Review mode** e **Models** saem do cabeçalho | Aceitável **se** os dois forem editáveis em `Details` e o item do `⋯` abrir o mesmo popover. Hoje não são (2.1) |
| 2 | A barra do step sai, e as ferramentas vão ao `⋯` | Aceitável. O estado do laço precisa de um lugar (2.6). A exceção `step_empty` precisa de uma cena |
| 3 | Sem conversa, o compositor sai | Aceitável. O vazio de `checks` e o bloco de `blocked` dizem o porquê. `structure.md` §3 e `components.md` (Compositor, desabilitado) mudam |
| 4 | O grupo dobrado é uma linha sem fundo | Aceitável. Os estados estão no espécime |
| 5 | **→** só com destino; sem o glifo de tipo e a referência | Aceitável. O glifo e a referência ficam na árvore e no `Card` |
| 6 | O marcador é uma linha sem os dois fios | Aceitável |
| 7 | Na A, a linha é o fio do cabeçalho | Aceitável **se** o conteúdo ganhar um chão abaixo da linha (A.2). O princípio 6 muda |
| 8 | O cartão não repete o progresso; a barra continua tingida | Aceitável como regra escrita no princípio 7 e em `components.md`. Opinião: o cartão fica neutro (2.8) |

**Mudanças que tocam o registrado e não estão na lista:**
- o rótulo da situação no topo (2.3);
- a lista de steps, que passa de `Artifacts` para `Details` (2.2);
- a segunda linha da barra do pedido (A.3);
- os atalhos `Alt+`\`` e `Ctrl+E` (2.10).

## Fidelidade a `features.md`

- **Sumiu:** o seletor de modo e de modelo por step (2.2); **Back to** PRD e Plan (2.5); o texto do laço (2.6).
- **Inacessível no mock:** **Review mode** e **Models** (2.1).
- **Dado errado:** o medidor numa conversa que não existe (2.4).
- **Presentes:** **Pause**, a fila com **Remove**, **Stop**, **Retry reviewer**, os checks pelo nome, **Approve** com o que falta, `Merged by`, **Close task**, **Delete task…**, **Discard and restart the PRD…**, e **Review again** desabilitado durante os checks.

## Tokens, contraste, nomes

- `tokens.css` está embutido byte a byte, e as páginas batem com `src/`. Não há cor, duração ou tamanho soltos em `m.css`, `a.css`, `b.css` e `components.css`: só `1px` em arredondamento e em texto oculto.
- **Contraste de texto, medido pela sonda:**
  - nenhum texto do produto fica abaixo de 4,5:1, nas duas variações, nos dois modos, a 1250, 1600 e 2500;
  - os únicos casos são os separadores `/` e `·`, decorativos e com `aria-hidden`: 3,46 no claro e 3,69 no escuro;
  - por amostragem nos tokens: `--state-wait` sobre `--surface-1` dá 6,11 e 10,49; `--brand-ink` sobre a pílula dá 5,35 e 7,10; `--ink-4` sobre `--surface-0` dá 5,49 e 6,83.
- **Contraste não textual:** a linha da A, ver A.1. O glifo de espera dá 4,31 e 9,43. `--line-3` dá 3,45 e 3,69.
- **Nomes:** nenhum controle sem nome. A.4 (2.5.3) e B.2 (nomes das etapas dobradas fora do alcance do teclado) são menores.
- **Larguras de 1400 a 1850:** sem corte nem sobreposição nas duas. O topo salta por conteúdo (2.7).

## Comparação

- **Minimalismo:** a A tem uma faixa em toda cena. A B tem duas nos steps com os dois agentes.
- **O indicador de um olhar:** a B diz etapa, feito e estado pela forma, nos dois modos. A linha da A depende da frase, e o que falta fica abaixo de 3:1.
- **Os dois agentes:** a regra da A (a barra aponta, o compositor segue a tela) é mais enxuta que as abas da B e serve a qualquer indicador.
- **Beleza:** a linha da A é a peça mais bonita e mais nova. A pílula da B é correta e conhecida.
- **Defeitos comuns:** os dois repetem a situação no topo e perdem **Models**, **Review mode**, o modo por step e o `Back to` completo.

## Recomendação

Discordo em parte do designer. Recomendo **o stepper da B com a regra dos agentes da A**, sem abas. É a alternativa que o próprio README deixa aberta.
- O indicador é o objeto central da decisão do usuário, e a pílula é a única forma da rodada que responde às três perguntas de um olhar nos dois modos.
- A troca no compositor e a segunda linha da barra tiram a faixa de abas. O topo fica uma faixa só, como na A.
- A pílula leva o glifo e a posição, e a palavra da situação só quando não há barra do pedido. É o que `structure.md` §3 já diz da trilha.

Se o usuário preferir a linha pela beleza, a A serve, com três condições:
- os segmentos futuros e os steps que faltam chegam a 3:1;
- a conversa ganha um chão abaixo da linha;
- a frase perde a palavra da situação quando a barra existe.

## Veredito

**Não pronto.** A escolha do indicador e dos agentes pode ir ao usuário depois de cinco correções curtas:
1. **Review mode** e **Models** editáveis em `Details`, e o `⋯` abrindo o mesmo popover, desenhado. O modo e o modelo de cada step não iniciado voltam a ser editáveis em algum lugar (2.1, 2.2).
2. `Back to…` com todas as etapas anteriores (2.5).
3. O topo sem o rótulo da situação enquanto a barra do pedido existe, nas duas (2.3).
4. O medidor com `—`, ou escondido, em `checks` (2.4).
5. Na A, a linha legível: 3:1 para o que falta e um chão abaixo dela (A.1, A.2).

Recomendado junto, sem bloquear: o estado do laço na posição (2.6), a dobra do topo só pela largura (2.7), a cena da revisita (0.7) e as mudanças fora da lista registradas como escolhas do usuário.
