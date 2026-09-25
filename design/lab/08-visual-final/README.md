# 08 · Visual final

Fase 3, fundação visual. É a rodada que fecha a linguagem visual do MySpec para o crítico e depois para o usuário aprovarem. Ela aplica o tema escolhido, **Grafite quente** (`decisions.md`, 2026-09-24), como linguagem única sobre a base **B · Trilho** corrigida na 07. Também resolve o que ficou pendente da crítica da 06 e escreve os rascunhos dos documentos da fase.

Esta rodada não tem variações. Ela não explora: consolida uma escolha já feita. Onde houve uma escolha de fato nova, ela está na seção "Desvios e escolhas novas", com a alternativa.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A tela da task `Rate limit per API key` na linguagem final: step 3 de 7, o revisor pergunta, o implementador espera uma permissão, e a árvore inteira em volta |
| `specimen.html` | O espécime do design system: tipo, neutros e superfícies, identidade, estados, espaço, raio, elevação, movimento, os 19 componentes em todos os estados, o contraste medido de 98 pares mais 8 distâncias, e a auditoria de pixel. Cada seção aparece nos dois modos, lado a lado quando cabem |
| `tokens-draft.css` | Rascunho de `design/system/tokens.css`: todos os tokens, com nomes semânticos e um comentário por grupo. É a fonte. As duas páginas o trazem inteiro, entre marcadores, e o teste confere que o bloco é idêntico ao arquivo |
| `principles-draft.md` | Rascunho de `design/principles.md`: dez princípios, cada um com um exemplo das páginas |
| `components-draft.md` | Rascunho de `design/system/components.md`: uma seção por componente, com anatomia, variantes, estados, tokens, teclado e acessibilidade, faça e não faça |

## Como abrir

- Sirva a pasta (`python3 -m http.server 8090 -d design/lab`) e abra `08-visual-final/index.html` e `08-visual-final/specimen.html`.
- `?theme=light` ou `?theme=dark` fixa o modo. Sem o parâmetro, vale o do sistema. Na cena, o botão de tema do rodapé da lateral alterna System, Light e Dark, como no produto.
- Na cena, `?tab=reviewer` abre a conversa do revisor, com a pergunta. `?audit` mostra o relatório de geometria e de truncamento.
- No espécime, `?show=light` ou `?show=dark` mostra um modo só. O seletor Both, Light e Dark no topo faz o mesmo.
- Tudo o que tem tooltip mostra o tooltip do sistema: passe o mouse ou chegue pelo teclado.

## Resposta à seção 8 do `critique.md` da 06

Cada condição foi conferida de novo na 08, também as que a 07 já tinha tratado.

| # | Condição | Como está | Onde conferir |
|---|---|---|---|
| 1 | "Trabalhando" sai do petróleo | **Cumprida.** `--state-work` é `--ink-2`: o spinner é tinta neutra, com a forma, o movimento e o texto (o relógio do turno, a linha 3, `agent working` no nome acessível). A identidade não pinta estado nenhum. A distância entre o azul e o "trabalhando" é medida no espécime (ΔE ≥ 0,15 nos dois modos) | Espécime, States e a tabela de distâncias |
| 2 | O nome ocupa as colunas 2 e 3 quando a linha 1 não tem meta | **Cumprida, também em hover e em foco.** O nome ocupa as duas colunas. O meta aparece no hover, no foco e na linha aberta só quando cabe ao lado do nome inteiro; quando não cabe, vai para o tooltip do nome. A 1250 px, o único nome que corta é `Migrate settings page to react-hook-form`, que precisa de 262 px numa linha de 242. Para ele vale a regra de truncamento: todo texto que corta ganha o tooltip do sistema com o texto inteiro. A 2500 e a 2600 px, nada corta. O meta continua só no hover (desvio abaixo) | `index.html?audit` |
| 3 | O cabeçalho de board volta à caixa normal, acima do épico | **Cumprida.** Board em 14 px, peso 500, `--ink-2`; épico em 13 px, peso 500, `--ink-3`. Sem caixa alta e sem contagem | Espécime, Section header |
| 4 | A hierarquia épico › item fica visível | **Cumprida.** Os itens do épico recuam 16 px, e a guia `--sidebar-guide` fica a 3:1 ou mais da lateral nos dois modos | Espécime, contraste "Epic guide · sidebar" |
| 5 | A lateral clara com metade da croma, e o **New** com corpo | **Cumprida pela escolha do tema.** A lateral do Grafite quente é `0.945 0.007 68`, um cinza morno no tom da página, sem o azul-gelo. O **New** é elevado (`--surface-2` com `--shadow-xs`), com o corpo a 1,1:1 ou mais da lateral nos dois modos. O par está no espécime | Espécime, "New's body · sidebar" |
| 6 | A barra do pedido mais leve que o cartão, sem repetir o comando | **Cumprida.** Com o cartão na tela, a barra é a chamada quieta: afundada, com o glifo, o rótulo, o lugar, o relógio e **Show**. O comando aparece uma vez na tela, no cartão. O grupo de ações da permissão vem recolhido (`1 on hold`). Aberto, a linha em espera diz `the command in the card below` e não repete o comando | Cena, aba do implementador; espécime, Action group |
| 7 | O registro em `decisions.md` e a reescrita de `structure.md` | **Fica com o coordenador.** A rodada não edita fora da pasta. O texto proposto está em "Desvios e escolhas novas" | Abaixo |
| 8 | A limpeza | **Cumprida.** As porcentagens são tokens (`--mix-*`). O marcador de lista é `--ink-4`. A árvore que rola mostra um esmaecido e `↓ N more below`. O segmento atual tem o dobro do comprimento dos feitos. A auditoria estática do espécime não acha nenhuma cor fora dos tokens | Espécime, Pixel audit |

## O que mais o pedido pedia

- **Espera, erro, encerramento, trabalhando, GitHub, pausado e ocioso** têm, cada um, cor, glifo e rótulo, e todos aparecem na árvore da cena. O que bloqueia sem ser uma situação (o clone ausente) tem o losango contornado `◇`. A tabela está no espécime, em States.
- **O comando do pedido aparece uma vez.** Ver o item 6.
- **Nomes a 1250 px.** Ver o item 2. A regra de truncamento com tooltip vale para todo texto que corta, também para o título do step a 1100 px.
- **A forma final** da lateral, da barra do pedido, do cartão, do compositor e do topo do item, sem mudar a estrutura do topo, que é da fase 4:
  - o topo ganhou **Review: Agent ▾** e **Models ▾**, que a 07 não mostrava, e **Discard step…** ao lado de **Review myself** e **Open in VS Code**;
  - o breadcrumb, o título e a trilha cedem espaço em ordem (ver "Desvios e escolhas novas").
- **De 1100 a 2600 px.** Testado a 1100, 1250, 2500 e 2600 px. A 1100 px cortam, com tooltip, `Rotate API keys without downtime` (3 px), o nome da review e o título do step.

## O que a 08 muda em relação à 07

1. **Um tema só.** Os valores são os do Grafite quente que as funções da 07 geravam, agora escritos como tokens estáticos em `tokens-draft.css`, com nomes semânticos (`--surface-0..3`, `--ink-1..4`, `--line-1..3`, `--brand-*`, `--state-*`, `--code-*`, `--shadow-*`, `--space-*`, `--radius-*`, `--text-*` e `--leading-*`, `--duration-*` e `--ease-*`).
2. **Os tokens derivados** (véus, tintas e halos) ficam num bloco `:root, [data-theme]`. Assim, uma subárvore com o próprio `data-theme` mistura as próprias cores. É isso que deixa o espécime mostrar os dois modos lado a lado.
3. **Componentes novos**, que faltavam na 07: o botão perigoso, a textarea, o menu (listbox e ações), o tooltip do sistema, o diálogo, o toast, o aviso do app e a faixa de bloqueio. Também o botão de copiar do bloco de código e os estados do medidor.
4. **A regra de truncamento.** Todo texto que corta ganha um tooltip com o texto inteiro, aberto no hover depois de `--delay-tooltip` e na hora no foco pelo teclado.
5. **A linha 3 escolhe a forma pelo que cabe.** A ação passa à forma curta (verbo, `…`, último segmento) sempre que a longa não cabe, e não só abaixo de 370 px de lateral. A 2500 px, `go test ./internal/keys/...` cortava na linha do épico.
6. **A colisão `.notice`.** O aviso do app e o aviso de clone da árvore tinham o mesmo nome de classe, o que pintava o aviso de clone de vermelho. O aviso do app é `.appnotice`.

## Depois da crítica

O `critique.md` desta rodada achou defeitos na interação e nos rascunhos. Tudo foi corrigido nesta pasta, sem rodada nova.

1. **O hover e o foco não cortam o nome.** O meta passou a aparecer só quando cabe ao lado do nome inteiro, medido por linha. Quando não cabe, ele vai para o tooltip do nome (`Rotate API keys without downtime · api#441`). `markTruncated` roda de novo a cada mudança de estado da linha (hover, foco, pressão), e o foco pelo teclado abre o tooltip do nome na hora. `?audit` agora mede todas as linhas em hover e em foco. A 1100, 1250, 1600 e 2500 px, nos dois modos, nenhum nome passa a cortar e nenhum corte fica sem tooltip. A 1250 px o meta aparece em 8 das 12 linhas; a 2500 px, em 11.
2. **Os princípios descrevem a cena.** Para cada contradição, decidi se mudava o princípio ou o mock:
   - **P6: mudou o princípio.** Os fios entre faixas empilhadas (cabeçalho, abas, rodapé) marcam onde o conteúdo rola por baixo, e tirá-los faria a conversa se perder sob o cabeçalho. O princípio passou a dizer: regiões lado a lado por tom, faixas empilhadas por um fio, objetos por elevação.
   - **P8: mudaram os dois.** No mock, o spinner é um só (o meio arco, também nos botões, e os dois param como três quartos com movimento reduzido). No princípio, há dois laços com sentidos diferentes: o spinner (alguém trabalha) e o brilho (uma leitura sem resultado).
   - **P2: mudou o mock.** A regra de uma primária por tela é a certa, porque é ela que mantém "cor é sinal". O **Send** fica primário com texto só quando nada mais na tela espera uma resposta; com o cartão na tela, **Allow** é o único azul cheio. P2 também lista agora os papéis da identidade, os mesmos da entrada proposta abaixo.
   - **P1** ganhou as duas exceções que a crítica apontou: o lugar onde você está e o realce de código.
3. **Os tokens.**
   - O comentário de `--ink-4` lista os fundos em que ele não é usado, e o espécime mede esses pares numa linha "ink 4 not used".
   - Os aliases são `var()` num bloco só: `--state-work` é `var(--ink-2)`, e o mesmo vale para GitHub, pausado, ocioso, o `◇`, o comentário de código, o foco, o contorno da espera, a guia do épico e `--line-deco`.
   - `--surface-2-hover` e `--surface-2-press` são o que o botão, o chip e a opção usam.
   - Saíram `--state-error-line` e `--shadow-sheet`, que ninguém usava. `--z-toast` e `--ease-exit` passaram a ser usados na região de toasts e na saída do toast. Os três tokens de largura da fase 4 ficam marcados como reservados.
   - Outros ajustes: os glifos passaram a rem; o losango usa `--radius-glyph`; o perigoso carregando tem a tinta dele; `--mix-key` é declarado uma vez; os comentários de matiz e de relógio estão certos.
4. **O fantasma desabilitado é tracejado**, como todo botão desabilitado (`structure.md:238`). Na cena, é o `→` sem destino.
5. **Os outros defeitos da crítica:**
   - O chip de erro é quadrado e cheio de vermelho. É a marca mais forte da árvore nos dois modos, e a gravidade não se inverte mais no escuro.
   - A aba escolhida tem um anel de `--line-3` a 3,15:1 (claro) e 3,92:1 (escuro) do trilho.
   - As abas são uma parada de Tab, com `←→`.
   - Uma situação de erro nova pisca no véu do erro.
   - Os separadores `/` e `›` têm `aria-hidden`.
   - No espécime, "active" é o pressionado momentâneo, e ganharam estado pressionado a aba, a etapa e o cabeçalho de seção. O menu **New ▾** aberto e o compositor com texto e um cartão na tela também entraram.
   - `components-draft.md` ganhou:
     - o mapeamento para os primitivos gerados;
     - o spinner e o brilho, o cabeçalho de navegação e o breadcrumb, o seletor de tema, o indicador de rolagem, a tag, a tecla e o avatar;
     - a lista do que a fase 4 vai pedir.

Não foi tratado o que a crítica marca como polimento (a seção 7 dela).

## Desvios e escolhas novas

Para o coordenador registrar em `decisions.md` e reescrever em `structure.md`, com os textos ajustados pela crítica. As três primeiras continuam desde a 06.

| Desvio | Onde | Texto proposto |
|---|---|---|
| **Aba sem chip** | `structure.md:186` | "Cada uma tem o glifo da sua sessão e o que pede, ou, com o agente trabalhando, o tempo do turno. O tempo de espera fica no nome acessível do glifo e no tooltip da aba." |
| **Meta no hover** | `structure.md:69`, `brief.md:71` | **É uma pergunta ao usuário, não um registro**, porque muda o brief aprovado: "o repositório e o `#card` deixam de estar visíveis de relance e passam a aparecer ao passar o mouse, no foco e na linha aberta, quando cabem ao lado do nome?" Se sim, `structure.md:69` passa a dizer: "Glifo de tipo e nome, com a largura inteira da linha para o nome. `repo#card`, `repo#PR` ou `#cards` e `One-Shot` aparecem no hover, no foco e na linha aberta quando cabem ao lado do nome inteiro; quando não cabem, ficam no tooltip do nome. O nome nunca perde largura. Estão sempre no nome acessível. Na linha que `Ctrl+J` abriria, a marca `Ctrl J` fica sempre visível." |
| **Spinner fora da borda direita** | `structure.md:88`, `:93` | Tabela, linha "Agente trabalhando", borda direita: "O tempo do turno, em texto". Linha 93: "O texto na borda direita da linha em que o agente trabalha é o relógio do agente." O spinner é o glifo de estado da linha 2 |
| **Os papéis da identidade** | `decisions.md`, 2026-09-24 ("marca, ação primária, foco, seleção") | Uma entrada nova, que aponta a de 2026-09-24 e copia a lista de P2 em `principles-draft.md`: a marca; o texto e o ícone do **New**; a ação primária, uma por tela; o foco e o halo de um campo; a linha aberta (véu, anel e glifo de tipo); os links; a etapa atual e os segmentos; o marcador do agente (cheio no implementador, anel no revisor); `Ctrl J`; um controle pressionado ou escolhido; o medidor de contexto. E nunca um estado, nem o de "trabalhando" |
| **O topo cede espaço em ordem** (nova, provisória) | Só `decisions.md`, como forma provisória que a fase 4 revê; não entra em `structure.md` §6, porque o topo é o primeiro item de §9 | Abaixo de 1020 px de área principal, o breadcrumb fica com o pai imediato (`… / API hardening /`); abaixo de 900 px, só com o item. O breadcrumb encolhe antes do título. Na trilha, abaixo de 1240 px as etapas feitas ficam só com o visto, e abaixo de 1020 px as futuras ficam só com o círculo. O nome fica no tooltip e no nome acessível. Abaixo de 900 px, o medidor do topo fica só com a porcentagem. Alternativa: manter os nomes das etapas futuras e deixar o título do step cortar a 1250 px |
| **O medidor na linha estreita** (nova) | `structure.md` §6, "Linha da árvore" | "Abaixo de 330 px de lateral, o medidor da linha 3 fica só com a porcentagem." Sem isso, a ação na linha do épico não cabe nem na forma curta a 1250 px |
| **A forma curta pelo que cabe** (nova) | `structure.md` §6, "Linha da árvore" | "A ação passa à forma curta sempre que a longa não cabe", no lugar de "abaixo de 370 px" |
| **Chips de tempo** | `structure.md:85-86` | O de erro é "quadrado cheio, com `!`", como o texto diz. O de espera é "redondo, cheio de uma tinta âmbar (`--state-wait-chip`), com contorno", e não âmbar saturado: registrar essa forma |
| **A barra do step em duas faixas** (provisória) | `structure.md` §3 | O título e o estado do step ficam na linha da trilha; **Review myself**, **Open in VS Code** e **Discard step…** ficam na linha das abas. É topo, fase 4: registrar como provisória |
| **O fantasma desabilitado** | `structure.md:238` | Nenhum: o mock segue o texto |

Os limites das consultas de contêiner (330, 370, 900, 1020 e 1240 px) ficam como números no CSS, porque uma consulta não lê um token. São os de `structure.md` §6, e a auditoria estática os lista.

## Como foi testado

- Chromium headless no Linux, com as fontes do Google Fonts, pelo `http.server` da lab.
- A cena foi capturada a 1100, 1250, 2500 e 2600 px, nos dois modos e nas duas abas, olhando cada captura. `?audit` mede 81 a 85 caixas que o layout posiciona (regiões, linhas, colunas de glifo, medidores, o cartão, a barra do pedido, o compositor, a coluna da conversa). Nenhuma fica em meio pixel, a 1250 e a 2500 px, nos dois modos.
- O que segue a largura do texto (botões, chips, abas, sua mensagem, os segmentos depois de `Implementation`) fica com o arredondamento do motor e é contado à parte. O losango rodado e o spinner girando também ficam fora da conta.
- `?audit` também põe cada linha da árvore em hover e em foco. A 1100, 1250, 1600 e 2500 px, nos dois modos, nenhum nome passa a cortar e nenhum corte fica sem tooltip.
- O espécime foi capturado inteiro a 1250 px em cada modo e a 2500 px com os dois lado a lado. Ele mede, na própria página, 98 pares de contraste e 8 distâncias em OKLab, sobre as cores pintadas de uma cena escondida por modo:
  - nenhum par abaixo do mínimo;
  - o menor texto fica a 4,71:1 no claro e a 5,37:1 no escuro;
  - o menor glifo, anel ou borda fica a 3,15:1 e 3,07:1.

  Os cinco pares "ink 4 not used" ficam fora da conta, medidos para o comentário dos tokens continuar verdadeiro.
- A auditoria de pixel do espécime confere 802 alturas e larguras fixas (controles, linhas, chips, teclas, abas, itens de menu, glifos, trilhos e segmentos): todas em pixel inteiro.
- A auditoria estática do CSS de componentes e da página não acha nenhuma cor fora dos tokens. Os 17 comprimentos soltos são geometria (0, 50 %, 100 %, `100vh`, o 1 px do recorte para leitor de tela, as paradas do brilho e do esmaecido, os 80 % da sua mensagem) e os limites das consultas de contêiner.
- Um par que a 07 media e que não é pintado saiu: o verde de encerramento sobre o véu da linha aberta mede 4,10:1 no claro, mas nessa linha o chip ganha o fundo elevado, e é esse o par medido.
- A renderização final é a do WebKitGTK. A Fira foi escolhida por ter sido desenhada para tela sem suavização, mas tem de ser vista no app.

## O que ficou de fora

- **O topo do item, o progresso entre etapas e a experiência dos agentes**, que são da fase 4 (`structure.md` §9). Aqui o topo tem a forma visual final sobre a estrutura provisória.
- **A lateral recolhida** (a faixa de 60 px), a coluna de decisão e os painéis. Os tokens de largura deles existem (`--sidebar-collapsed`, `--panel-width`, `--decision-width`), mas as telas são da fase 4.
- **Um tema de alto contraste e um de preto verdadeiro**, que a 07 mostrou como Contraste e Breu. O sistema de tokens os comporta como sobrescritas, mas não estão desenhados para o Grafite quente.
- **O polimento da seção 7 da crítica:**
  - o eixo único do topo a 2500 px;
  - uma marca de cor por linha;
  - a barra quieta com menos âmbar;
  - a dica de tecla uniforme;
  - a dica do compositor;
  - a transição entre lugares;
  - a barra de rolagem;
  - o grupo de painéis;
  - o menu do `…`.

## Dados que faltam

Nada que esta rodada acrescenta pede dado novo. A forma curta pelo que cabe, o tooltip de truncamento e os estados do medidor saem do que já chega. Continuam valendo os quatro da rodada 04, na mesma cena:

- **Caminho do arquivo no cabeçalho do bloco de código** (`internal/ratelimit/bucket.go`). O markdown do agente só traz a linguagem da cerca.
- **Código de saída de uma ação** (`exit 1`). `ActionEntry` tem rótulo, alvo e status, sem o código.
- **Duração de uma ação em curso.** Não existe por ação. O tempo do turno é derivável.
- **A ação que espera permissão** (`1 on hold`, `the command in the card below`). O vínculo é pelo `toolUseId`, só frontend.

O espécime mostra também um estado que depende de algo que o backend já faz, mas que a interface ainda não diz: o modelo salvo que o catálogo não tem mais (`Opus 4 · unavailable`), de `features.md` §Modelos e esforço. É só frontend.

## Decisão

Aprovada em 2026-09-24 como fundação visual: os rascunhos viraram `design/principles.md`, `design/system/tokens.css` e `design/system/components.md`. A tela é referência visual, não tela aprovada; o polimento da seção 7 do `critique.md` é pauta da fase 4. Ver `design/decisions.md`.
