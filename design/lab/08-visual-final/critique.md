# Crítica · 08 · Visual final

A régua:
- `design/brief.md` (§5, §7, §9);
- `design/structure.md` (§2, §3, §6, §9);
- `design/decisions.md` (2026-09-24, "Tema: Grafite quente" e "A cor de identidade é decidida na fase 3");
- `design/research/references.md` (§5 e §6);
- o `critique.md` da 06, seção 8;
- desta rodada, `README.md`, `principles-draft.md`, `components-draft.md` e `tokens-draft.css`.

Ainda não existem `principles.md` nem `system/`: os rascunhos desta rodada são o candidato a régua, e por isso são julgados com o mesmo rigor da tela. Onde a régua não cobre, o texto diz que é opinião.

Como foi avaliado. A pasta foi servida pelo `http.server`. A cena foi capturada no Chromium headless a 1100, 1250, 2500 e 2600 px por 1040, nos dois modos, nas duas abas e com `?audit`. O espécime foi capturado inteiro a 1250 px, em cada modo. Por um driver CDP fora do repositório:
- varri todo texto visível da cena (4 combinações de modo e largura, 2 abas, e com todas as linhas em hover) e do espécime, compondo o fundo camada a camada;
- medi uma matriz de 16 tintas contra 20 fundos, com os véus compostos, nos dois modos;
- medi a truncagem dos nomes em repouso e em hover, a 1250, 1600 e 2500 px;
- conferi que o bloco de tokens das duas páginas é idêntico a `tokens-draft.css` e que o CSS de componentes da cena e do espécime é o mesmo (o espécime só acrescenta a moldura, `specimen.html:862-991`).

Rodada sem variações: uma seção de defeitos, depois as cinco perguntas, o polimento à parte, a comparação com a 06 e o veredito.

## 1. Defeitos, em ordem de gravidade

1. **O hover corta o nome que o usuário está apontando, e o corte fica sem tooltip.**
   - `.it:is(:hover, .is-hover, :focus-visible, …) .nm { grid-column: 2; }` (`index.html:528`) devolve a coluna 3 ao meta assim que o ponteiro ou o foco entra na linha.
   - Medido: a 1250 px, o hover passa de 1 nome cortado para 4 (`Crash on share sheet…`, `Rotate API keys…`, `Offline sync for drafts`). A 1600 px, de 0 para 2. A 2500 px, de 0 para 1: `Migrate settings page to react-hook-form` cabe em repouso e corta no hover.
   - `markTruncated()` só roda na pintura e no resize (`index.html:1244`, `:1246`). O nome que passa a cortar no hover não ganha `data-tip`: medi `tipHover: null`. É a regra do próprio README ("todo texto que corta ganha o tooltip") quebrada exatamente onde o tooltip abriria.
   - O mesmo vale para o foco de teclado na árvore, que é a navegação principal da lateral. O nome muda de largura sob o olho a cada ↑↓.
   - `components-draft.md:100` diz "Deixe o nome inteiro sempre que houver espaço". O hover tira o espaço.
2. **`principles-draft.md` contradiz a própria cena em três princípios.** Como régua da fase 4, cada contradição vira uma discussão futura.
   - **P6** (`principles-draft.md:49`, `:51`): "Linhas finas separam itens de uma lista ou de um cartão, nunca regiões." A cena separa regiões por linha em três lugares: o cabeçalho do item da conversa (`.ih`, `index.html:555`), a faixa das abas da conversa (`.cv-head`, `index.html:603`) e o rodapé da lateral da árvore (`.sb-foot`, `index.html:478`). O fio sob a trilha atravessa a área principal inteira nas capturas a 2500 px.
   - **P8** (`principles-draft.md:63`, `:65`) e o comentário de `tokens-draft.css:91`: "O spinner é o único laço." O brilho de carregamento também é um laço infinito: `checking GitHub…` (`index.html:540`) e o medidor sem leitura (`index.html:842`). O sistema ainda tem dois spinners de geometria diferente: `.spin` com um quarto de arco (`index.html:391`) e `.st-run` com meio arco (`index.html:430`). Com movimento reduzido, só o segundo vira "anel de três quartos" (`index.html:857`), e o `.spin` dos botões fica com um quarto.
   - **P2** (`principles-draft.md:17`): "a única ação primária de cada tela". O compositor vira primário assim que tem texto (`index.html:1259`; `components-draft.md:262`; espécime, Composer, "with text · Send is primary"). Na cena, digitar uma resposta com o cartão de permissão na tela põe **Allow** e **Send** em azul cheio lado a lado. A regra ou o compositor precisa ceder, e o rascunho não diz qual.
3. **O comentário de `tokens-draft.css:134` é falso, e ele é a instrução que o implementador vai seguir.** "All four pass 4.5:1 on every surface." `--ink-4` fica abaixo de 4,5 em:
   - no claro: `--brand-veil` 4,47, véu pressionado sobre a lateral 4,36, hover sobre a linha aberta 4,04;
   - no escuro: `--brand-tint` 4,33, `--state-wait-chip` 4,45, hover sobre a linha aberta 4,40.

   A cena não pinta `--ink-4` nesses fundos, porque a linha aberta sobe o meta para `--ink-3`, como pede `structure.md:96`. A varredura da cena passa inteira. O problema é o arquivo que vira régua: ele precisa listar onde `--ink-4` é proibido, e não afirmar que serve em tudo.
4. **Um botão fantasma desabilitado perde a borda tracejada.** `.btn.ghost:disabled { border-color: transparent; }` (`index.html:386`). No espécime, Button › Ghost › Disabled, `Discard step…` fica só com `--ink-4`, sem outra marca. `structure.md:238` é explícito: "Um botão desabilitado, na barra ou em qualquer lugar, tem borda tracejada". O fantasma é justamente a variante de **Discard step…** e **Deny…**.
5. **Os tokens têm aliases escritos como literais, e derivados declarados e não usados.**
   - Aliases literais em vez de `var()`: `--state-work` = `--ink-2` (`tokens-draft.css:178`, `:234`), `--state-github` e `--state-paused` = `--ink-3` (`:180-181`), `--state-idle` e `--code-comment` = `--ink-4` (`:182`, `:190`), `--state-notice` = `--ink-2` (`:183`), `--sidebar-guide` = `--sidebar-control` (`:125-126`), `--focus` = `--brand` (`:148`), `--state-wait-ring` = `--state-wait-glyph` (`:167-168`). No escuro, `--line-deco` e `--line-3` são o mesmo valor (`:222`), e no claro diferem por 0,01 de L (`:131-132`). A condição 1 da 06 depende de "trabalhando" ser `--ink-2`. Hoje isso é uma coincidência de números, e não uma referência, e deriva na primeira mudança de tinta.
   - Declarados e nunca usados: `--surface-2-hover` e `--surface-2-press` (`:287-288`). O botão, o chip e a opção recalculam a mesma mistura à mão (`index.html:363-364`, `:418`, `:698-699`). Também `--state-notice` (o `◇` pinta `--ink-2` direto, `index.html:434`, embora o espécime diga `--state-notice`), `--state-error-line`, `--shadow-sheet`, `--z-toast` e `--ease-exit`, que só aparece na curva do espécime.
   - Um uso fora do papel: `border-radius: var(--border)` no losango (`index.html:427`, `:434`) usa a espessura de traço como raio. `.btn.danger.is-loading` pinta `--brand-on` num botão vermelho (`index.html:754`). A marca usa `stroke-width: 2` solto (`index.html:468`).
   - Contradições de comentário: `tokens-draft.css:134` diz que `--ink-4` é o dos "clocks at rest", mas o relógio do agente é `--ink-3` (`index.html:452`; `components-draft.md:58`). `tokens-draft.css:19` diz "hue 65"; as tintas estão em 60 e a lateral em 68 e 62.
6. **A gravidade muda de ordem entre os dois modos.** Glifo contra a lateral: no claro, o erro fica a 5,19 e a espera a 3,73; no escuro, o erro fica a 7,24 e a espera a 10,11. No claro, o vermelho é o sinal mais forte da árvore. No escuro, o âmbar domina, e o chip de erro (véu escuro, contorno vermelho) pesa menos que o chip de espera (âmbar cheio, tinta clara). O erro continua com o losango, o trilho e o `!`, então não é falha de WCAG. Mas a pergunta "os dois modos têm a mesma hierarquia" tem resposta "não, na gravidade".
7. **A aba escolhida se distingue por pouco.** `.sw[aria-selected="true"]` (`index.html:610`): o fundo `--surface-2` fica a 1,12:1 do trilho `--surface-0` no claro e a 1,20:1 no escuro, com um aro de sombra. O rótulo passa de `--ink-3` a `--ink-1`, com o mesmo peso. WCAG 1.4.11 pede 3:1 para o indicador de estado de um componente. Aqui a conversa embaixo também diz qual aba está aberta, então é risco, não bloqueio.
8. **O tooltip no foco espera o mesmo atraso do hover.** `components-draft.md:228` diz "na hora no foco pelo teclado". O `focusin` chama o mesmo `show()` com `--delay-tooltip` (`index.html:1204`, `:1186-1190`).
9. **A piscada de uma situação nova é sempre âmbar.** `@keyframes flash` usa `--state-wait-veil` (`index.html:438`, `:541`; `components-draft.md:95`). Um erro novo pisca na cor da espera. Opinião: uma situação nova de erro deveria piscar no véu dela.
10. **Menores:**
    - As tabs são duas paradas de Tab (`tabIndex` 0 nas duas). `←→` não existe, e o README declara.
    - Os separadores do breadcrumb e da trilha (`/`, `›`) ficam a 3,60:1 (claro) e 3,69:1 (escuro), como texto de 12 e 13 px. São decorativos, e o nível é o link, mas então precisam de `aria-hidden`.
    - O espécime chama de "active" o `aria-pressed` do fantasma (`Details` com tinta) e o "com texto" do compositor. O pressionado momentâneo do fantasma não aparece.

## 2. As oito condições da 06

| # | Condição | Veredito | Como foi conferido |
|---|---|---|---|
| 1 | "Trabalhando" sai do petróleo | **Cumprida.** O spinner é tinta neutra nas capturas dos dois modos. Distância até a identidade: 0,244 e 0,185. A ressalva é o valor literal (1.5) | Capturas; `tokens-draft.css:178` |
| 2 | O nome ocupa as colunas 2 e 3 | **Cumprida em repouso, regredida no hover.** A 1250 px, só `Migrate settings…` corta (242 de 262 px, falta espaço de fato). A 2500 px, nada corta. Mas o hover e o foco devolvem a coluna ao meta e cortam até 4 nomes, sem tooltip (1.1) | Medição de `scrollWidth`, em repouso e com `.is-hover` |
| 3 | Board em caixa normal, acima do épico | **Cumprida.** 14/500/`--ink-2` contra 13/500/`--ink-3`: 9,27 contra 6,18 na lateral clara | Espécime, Section header; matriz |
| 4 | Hierarquia épico › item visível | **Cumprida.** Recuo de 16 px e guia a 3,42 (claro) e 3,25 (escuro). A guia é visível nas capturas | Matriz; capturas |
| 5 | Lateral clara menos azul; **New** com corpo | **Cumprida.** A primeira parte foi resolvida pela escolha do tema. O corpo do **New** fica a 1,18 e 1,22, e o par está no espécime | Espécime; matriz |
| 6 | Barra do pedido mais leve, sem repetir o comando | **Cumprida.** `make migrate-local DATABASE_URL=…` aparece uma vez, no cartão. A barra é afundada, com **Show**. O grupo diz `1 on hold`, e a linha diz `the command in the card below` | Capturas; espécime, Action group |
| 7 | O registro em `decisions.md` e a reescrita de `structure.md` | **Não cumprida.** Continua pendente com o coordenador. O texto proposto precisa de ajustes (seção 5) | `decisions.md` ainda sem a entrada |
| 8 | A limpeza | **Cumprida.** As porcentagens são `--mix-*`, o marcador de lista é `--ink-4` (`index.html:632`), a árvore mostra `↓ 1 more below` com esmaecido, e o segmento atual tem o dobro do comprimento. Surgiram outras sobras, fora do que a 06 listou (1.5) | CSS; capturas |

## 3. É um sistema?

**Os mesmos tokens.** Sim. O bloco de tokens é byte a byte `tokens-draft.css` nas duas páginas, e o CSS de componentes é o mesmo arquivo nas duas. A varredura de literais de cor no CSS de componentes volta vazia. O que sobra é o que está em 1.5.

**Os estados.** O espécime cobre os sete estados em botão, chip, input, textarea, gatilho de select e opção de pergunta. Com lacunas, sem gravidade:
- falta o pressionado em aba, etapa e cabeçalho de seção;
- falta o menu **New ▾** aberto, com as três ações;
- o fantasma desabilitado contradiz a estrutura (1.4).

**Os dois modos.** A hierarquia de superfície e de tinta é a mesma: `--ink-2`/`--ink-3` a 1,50 e 1,37, `--ink-3`/`--ink-4` a 1,18 e 1,24. A exceção é a gravidade (1.6). No escuro, a lateral se separa da conversa por 1,08:1, só por tom. A 06 aceitou isso, e a captura confirma que se lê.

**Pares medidos por amostragem**, os de maior risco, na ordem claro / escuro. Os de texto da cena estão todos acima do mínimo. A varredura completa só acha os separadores de 1.10.

| Par | Medido | Mínimo |
|---|---|---|
| Meta (`--ink-4`) sobre a linha em hover | 4,71 / 6,09 | 4,5 |
| Linha 2 (`--ink-3`) na linha aberta em hover | 4,77 / ≥ 5 | 4,5 |
| `--ink-4` sobre `--brand-veil` (não pintado na cena) | **4,47** / ≥ 5 | 4,5 |
| `--ink-4` sobre `--brand-tint` (não pintado na cena) | ≥ 5 / **4,33** | 4,5 |
| Glifo de espera na linha aberta | 3,18 / 7,67 | 3 |
| Glifo de espera na lateral contra o de erro | 3,73 contra 5,19 / 10,11 contra 7,24 | inversão (1.6) |
| Guia do épico na lateral | 3,42 / 3,25 | 3 |
| Anel `--brand-ring` sobre `--brand-tint` (chip aberto) | ≥ 3,3 / 3,01 | 3 |
| `--line-3` (tracejado desabilitado) na lateral | 2,99 / 3,98 | isento |
| Aba escolhida contra o trilho | 1,12 / 1,20 | 3 para indicador de estado (1.7) |
| Corpo do **New** contra a lateral | 1,18 / 1,22 | 1,1 (condição da 06) |
| Fundo do chip de espera contra a lateral | 1,00 / 1,56 | o anel carrega (3,73 / 10,11) |
| Separadores `/` e `›` | 3,60 / 3,69 | 4,5 se forem texto (1.10) |

## 4. Os rascunhos como régua

**`principles-draft.md`** descreve o mock na maior parte: P3, P4, P5, P7, P9 e P10 batem com a cena, e os exemplos existem. Três princípios não batem (1.2). Mais dois ajustes:
- P1 (`:7`) diz "estado ou ação", e P2 (`:15`) acrescenta "onde você está". O realce de código também é cor saturada fora das duas. P1 precisa listar essas duas exceções.
- A lista de papéis do azul em P2 (`:17`) não é a do README ("controle pressionado ou escolhido", "halo do compositor"). As duas listas vão virar a entrada de `decisions.md` e o princípio, e precisam ser idênticas.

**`components-draft.md`** cobre os componentes principais da cena, com teclado e acessibilidade por componente. O que a cena usa e o rascunho não especifica:
- o cabeçalho de navegação (`←` `→` com o destino no tooltip) e o breadcrumb com `…`;
- o seletor de tema do rodapé, com três estados;
- o indicador `↓ N more below`;
- a tag de ferramenta (`Bash`, `.tag`, `index.html:423`) e a tecla (`.k`);
- o spinner, como componente único (1.2);
- o avatar;
- a faixa das abas com as ferramentas do step (fase 4, mas usada aqui).

O que a fase 4 vai pedir logo, e que um system fechado já deveria ter: checkbox, radio e switch (Settings › Defaults), controle segmentado, linha de lista e de tabela (board, History, Reviews), esqueleto de carregamento (`structure.md:339` pede a lateral em esqueleto), estado vazio de página e uma regra de ícones. A regra de ícones seria o conjunto, o traço, e um ícone por significado, contra "ícones duplicados" de `brief.md` §10.

Faltam também, em cada seção, o mapeamento para o primitivo do shadcn que será embrulhado (`brief.md` §9, Implementação). Opinião: sem isso, o implementador decide sozinho o que é wrapper e o que é componente novo.

**`tokens-draft.css`** está completo para a cena e é semântico nos nomes. Não é "sem duplicação": tem os aliases literais e os derivados sem uso de 1.5. O bloco escuro está escrito duas vezes (`:216-247` e `:248-277`), cópia exata, porque o padrão de artifact exige isso. No app, o tema é sempre escolhido pelo JS: `features.md`, "seguindo o sistema, com a opção de fixar". Opinião: `design/system/tokens.css` pode ter uma fonte só, e não duas cópias que derivam. Mais três pontos:
- `--glyph` em px (`:71`) contraria o cabeçalho do arquivo (`:17`) e `brief.md` §9 ("Tamanhos em `rem`");
- `--text-code-read` não tem entrelinha pareada (`:40`);
- `--mix-key` é igual nos dois modos e mesmo assim é redeclarado nos blocos de modo (`:155`, `:228`, `:259`).

## 5. Os desvios e o texto proposto

| Desvio | Veredito | O que corrigir no texto |
|---|---|---|
| **Aba sem chip** | **Aceitável.** O tooltip da aba tem o tempo (`index.html:1130`), como a 06 pediu | O texto proposto perdeu o caso do agente trabalhando, que `structure.md:186` tem ("ou o tempo do turno") e o espécime mostra (`Reviewer · 3m`). Escrever: "Cada uma tem o glifo da sua sessão e o que pede, ou, com o agente trabalhando, o tempo do turno. O tempo de espera fica no nome acessível do glifo e no tooltip da aba." |
| **Meta no hover** | **Aceitável só depois de 1.1.** Como está, o desvio troca largura em repouso por um nome que encolhe sob o ponteiro e sob o foco | Muda `brief.md:71`, que foi aprovado pelo usuário: o repositório e o `#card` deixam de ser "de relance". É decisão do usuário, e não registro do coordenador, e deve ser perguntada nesses termos. O texto de `structure.md:69` precisa dizer também que o nome cede a coluna ao meta no hover e no foco, e que o corte ganha tooltip então |
| **Spinner fora da borda direita** | **Aceitável.** O texto está correto | Nenhum |
| **Os papéis da identidade** | **Aceitável** | A lista tem de ser a mesma de P2 (seção 4). Acrescentar o que a cena pinta e a lista omite: o glifo de tipo da linha aberta em `--brand-ink` e o anel do avatar do revisor |
| **O topo cede espaço** (nova) | **Aceitável como provisório** (seção 6) | Não entra em `structure.md` §6 como regra. O topo é o primeiro item de `structure.md` §9, a ser redesenhado. Registrar no README da rodada e na entrada de `decisions.md` como forma provisória, que a fase 4 revê |
| **Medidor na linha estreita** (nova) | **Aceitável.** A porcentagem, que é o que o brief pede de longe (`brief.md` §5), fica | Nenhum |
| **Forma curta pelo que cabe** (nova) | **Aceitável** | Nenhum |
| **Discard step na barra do step** | Não é desvio | Nenhum |

Desvios que a rodada faz e não declara:
- **Os chips de tempo não são "cheios".** `structure.md:85-86` diz "Chip quadrado cheio, com `!`" e "Chip redondo cheio". O mock pinta véu com contorno nos dois (`index.html:444`, `:448`), e o de erro pesa menos que o de espera (1.6). Registrar a forma real ou fazer o mock seguir o texto.
- **O fantasma desabilitado sem tracejado**, contra `structure.md:238` (1.4).
- **A barra do step partida em duas faixas.** O título e o estado estão na linha da trilha. **Review myself**, **Open in VS Code** e **Discard step…** estão na linha das abas. É topo, portanto fase 4, mas é outra forma que a de `structure.md` §3, e o README diz "sem mudar a estrutura do topo".

## 6. As etapas futuras só com o círculo

A escolha é boa na ordem de prioridade: o nome do step e o estado do loop (`Step 3 · Token bucket middleware`, `Agent review · pass 1`) valem mais que `PR › PR review › Closing`. A alternativa do README, cortar o título do step a 1250 px, seria pior.

Ela não esconde o que o brief quer de longe. `brief.md` §5 pede a etapa atual e `Step N of M`, e os dois ficam no chip atual, com o `3/7`. As etapas futuras são uma sequência fixa e conhecida, e o nome está no tooltip e no nome acessível (`PR, not started`).

O custo real é outro, e o README não o mede. O limite de 1020 px de área principal cai sobre a meia tela do monitor de referência. A 1280 px de janela, a lateral tem 302 px e a área principal 978. Com os feitos só com o visto (limite de 1240), a meia tela, que é um dos dois usos diários (`decisions.md`, 2026-09-23), mostra sempre `✓ ✓ ✓ [Implementation 3/7] ○ ○ ○`. Seis de sete nomes somem, e uma One-Shot só se distingue de uma Structured pela contagem de marcas. Opinião: é aceitável como forma provisória, e a fase 4 deve tratar a trilha como parte do topo a redesenhar, e não herdar essa regra. Por isso a recomendação de não escrevê-la em `structure.md` (seção 5).

## 7. Polimento

Separado dos defeitos: nada aqui contraria a régua. É o que um designer sênior de Linear ou Raycast ainda mudaria. Tudo é opinião.

1. **Três eixos de alinhamento no topo, a 2500 px.**
   - O cabeçalho e a trilha correm de borda a borda.
   - As abas e as ferramentas ficam na medida da conversa, centradas.
   - O título do item fica a cerca de 1.300 px das ferramentas do cabeçalho.

   Na fase 4, o topo pede um eixo só.
2. **A árvore ainda codifica a espera três vezes por linha:** o disco, o nome em 600 e o chip âmbar. A linha `Widget for today's tasks` tem quatro marcas coloridas: o trilho, o losango, o chip vermelho e o `Ctrl J` azul. As referências (`references.md` §2, Linear) ficam em um sinal de cor por linha, com o peso e a forma fazendo o resto.
3. **A barra quieta do pedido ainda tem três marcas âmbar** (glifo, rótulo em 700, chip), a 60 px de um cartão com faixa âmbar. O rótulo em tinta neutra, com o glifo e o chip, já seria a chamada.
4. **A dica de tecla não é uniforme num mesmo grupo.** **Allow** tem o `1` numa caixa com contorno. **Allow for this session** `2` e **Deny…** `3` têm o algarismo solto.
5. **`Enter to send · Shift+Enter for a new line` fica sempre no compositor.** Um produto maduro mostra isso no tooltip do **Send**, ou até o primeiro envio.
6. **Não há regra de transição entre lugares:** trocar de item, abrir um painel, a barra do pedido que nasce. P8 cobre hover e menus. A navegação é o movimento mais frequente do app e não tem curva nem duração.
7. **A barra de rolagem não é desenhada.** No WebKitGTK, ela aparece com o estilo do GTK sobre a lateral e a conversa. Nenhum token cobre largura, trilho ou polegar.
8. **Os botões de painel** (**Details**, **Artifacts**, **Card**) e **Pause** têm o mesmo peso, e só um separador os agrupa. Um grupo de alternância com o pressionado visível leria melhor como "painéis".
9. **O `…` do breadcrumb abaixo de 1020 px** não diz o que esconde fora do tooltip. Um menu com os níveis ocultos é o padrão do gênero.

## 8. Comparação com a 06 · B

- **Identidade:** o azul tem papéis e não pinta estado. O salto de caráter em relação à 06 é real, e o escuro continua a melhor tela da frente.
- **Lateral:** calma e com hierarquia board › épico › item visível. Paga o meta no hover com nomes que encolhem sob o ponteiro.
- **Pedido:** resolvido. Um comando, uma chamada quieta, um cartão.
- **Sistema:** tokens únicos e componentes compartilhados de fato. Os rascunhos ainda afirmam coisas que o CSS não faz (P6, P8, `--ink-4`).
- **Modos:** mesma hierarquia de superfície e tinta, gravidade invertida entre o claro e o escuro.

## 9. Recomendação

Aprovar a linguagem visual do Grafite quente como está na tela. Os defeitos que restam estão na interação do hover e nos rascunhos que viram régua, não na cor, no tipo ou na densidade que o usuário vai julgar. Concordo com o designer na consolidação. Discordo em três pontos:
- o meta no hover sai como está;
- o topo provisório entra em `structure.md`;
- os rascunhos viram `principles.md` e `system/` sem correção.

**Pronto para o usuário aprovar a fundação visual**, com as condições abaixo.

Antes de mostrar ao usuário:
1. O hover e o foco não cortam um nome que cabe em repouso, ou, se o meta continuar tomando a coluna, `markTruncated` roda no hover e no foco e o tooltip aparece (1.1). O usuário vai passar o mouse na árvore.
2. Perguntar ao usuário, nesses termos, se o repositório e o `#card` deixam de ser "de relance" (`brief.md:71`), porque isso muda o brief aprovado.

Antes de promover os rascunhos a `principles.md` e `system/`:

3. P2, P6 e P8 descrevem o que a cena faz, ou a cena passa a fazer o que eles dizem: a linha entre regiões, o brilho como segundo laço e os dois spinners, o **Send** primário ao lado do **Allow** (1.2).
4. `tokens-draft.css:134` lista os fundos em que `--ink-4` não serve (1.3). Os aliases viram `var()`. Os derivados sem uso saem, ou os componentes passam a usá-los. Os comentários contraditórios são corrigidos (1.5).
5. O fantasma desabilitado ganha o tracejado de `structure.md:238` (1.4).
6. `components-draft.md` ganha as peças da cena que faltam: navegação e breadcrumb, seletor de tema, `N more below`, tag, tecla, spinner único, avatar. Ganha também a lista do que a fase 4 vai precisar, mesmo que sem desenho ainda (seção 4).
7. A condição 7 da 06: a entrada em `decisions.md`, com a lista de papéis igual à de P2, e a reescrita de `structure.md:69`, `:88`, `:93`, `:186`, `:85-86` e `:238` com os textos da seção 5. O topo que cede espaço fica registrado como provisório, fora de `structure.md` §6.

Recomendado, sem bloquear:
- a ordem da gravidade no escuro (1.6);
- o indicador da aba escolhida (1.7);
- o foco que abre o tooltip na hora (1.8);
- a piscada do erro (1.9).
