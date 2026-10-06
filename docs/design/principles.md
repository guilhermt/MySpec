# Princípios

As regras que toda tela do MySpec segue, e a régua de toda revisão de design. Os tokens estão em `frontend/src/styles/tokens.css` e os componentes em [components.md](./components.md).

## 1. Cor é sinal

Toda cor saturada na tela diz um estado, uma ação ou onde você está; o resto é neutro quente.

A interface é feita de neutros com um traço de calor, e as cores de estado ficam para as situações: âmbar espera por você, vermelho é erro, verde é encerramento. O azul da identidade marca ação e lugar (princípio 2). A única outra cor saturada é o realce de código, dentro do bloco de código, em quatro matizes na luz da tinta. Uma cor gasta em decoração enfraquece a árvore, que é o "depende de mim".

*Exemplo:* na árvore, o âmbar aparece só nas linhas que esperam por você. Os marcadores de lista, os divisores e os ícones em repouso são neutros.

## 2. A identidade tem presença e parcimônia

O azul marca o que você aciona e onde você está, e nunca é um estado. A identidade precisa de presença para o produto ter caráter, e de papéis fixos para nunca competir com um sinal.

Ele tem estes papéis, e só estes:
- a marca;
- o texto e o ícone do **New**, que é elevado e não cheio;
- a ação primária;
- o foco e o halo de um campo em foco, o compositor incluído;
- a linha aberta: véu, anel e glifo de tipo;
- os links;
- a etapa atual e os seus segmentos;
- a marca `Ctrl J`;
- um controle pressionado ou escolhido: painel aberto, opção, chip;
- o medidor de contexto.

Quem fala na conversa não é marcado pelo azul: o agente é uma palavra em tinta neutra, e a aba diz qual dos dois agentes de um step está na tela. O agente trabalhando é tinta neutra em movimento.

Há uma ação primária por tela, e ela é a que resolve o que a tela pede. O **Send** do compositor fica primário com texto só quando nenhuma outra primária está desenhada na tela, habilitada ou tracejada: a de um cartão de pergunta ou de permissão pendente, ou a da barra do pedido, a da barra de um item pausado incluída. Com uma delas, o **Send** fica secundário mesmo com texto; sem nenhuma, quando a resposta vai pelo compositor, ele é a primária. A tela nunca tem duas primárias, nem um **Resume** no compositor e outro no cabeçalho.

*Exemplo:* com um cartão de permissão pendente, **Allow** é o único botão azul cheio, mesmo que você digite no compositor. O nome de um item com o agente trabalhando gira em tinta neutra, e não em azul.

## 3. Dois registros de densidade

O cromo é compacto e a conversa é leitura.

A lateral, as barras e os controles usam rótulos de uma linha, de 12 a 14 px, com entrelinha justa. A fala do agente usa 15 px em 22 px, sem cartão, na coluna da conversa de 60rem, a mesma largura de tudo o que está nela. O mesmo produto tem uma mesa de comando densa e um texto confortável para ler por horas.

*Exemplo:* a linha 2 de uma linha da árvore tem 13/18 px, em `--ink-3`. A fala do revisor tem 15/22 px, em `--ink-1`, com a borda esquerda e a direita do código, dos cartões e do compositor.

## 4. Hierarquia por peso e tom antes de cor

A ordem de leitura vem do peso da fonte e do degrau da tinta. A cor fica para o sinal.

Nome em 400 e nome que espera em 600. Board em 14 px, peso 500 e `--ink-2`, épico em 13 px, peso 500 e `--ink-3`. Linha 3 em `--ink-4`. O título do item em 18 px e peso 600.

*Exemplo:* o nome de uma linha que espera por você salta de longe na lateral pelo negrito, antes de o olho chegar ao disco âmbar.

## 5. Todo estado tem glifo, cor e rótulo

Nenhum estado depende só da cor, e só o que está em curso se move.

Erro é losango, chip quadrado com `!` e trilho na borda. Espera é disco cheio e chip redondo. Encerramento é anel e chip contornado. Trabalhando é o spinner, o relógio do turno e a linha 3. GitHub é círculo tracejado e a palavra. Pausado são duas barras. Ocioso é círculo fino e a palavra. O que bloqueia sem ser uma situação é o losango contornado `◇`, nunca vermelho. O nome acessível diz tudo em texto.

*Exemplo:* cada linha da árvore tem o glifo e a palavra do seu estado, e o nome acessível dela é a frase inteira.

## 6. Superfícies em camadas, fios só entre faixas

Regiões lado a lado se separam por tom, faixas empilhadas por um fio, e objetos por elevação.

A lateral fica um degrau abaixo da página, no mesmo tom, sem linha entre as duas. Dentro de uma região, faixas empilhadas se separam por um fio de `--line-1`: o cabeçalho do item, a faixa das abas da conversa e o rodapé da lateral. O fio diz onde o conteúdo rola por baixo de uma faixa fixa. Dentro do chão (`--surface-1`), o que é afundado (`--surface-0`) guarda código, grupos de ações, a barra quieta do pedido e o rodapé de um diálogo. O que é elevado (`--surface-2`) é o cartão, o botão e a aba escolhida. O que flutua (`--surface-3`) é menu, toast e diálogo. A sombra cresce com a altura, sempre no neutro quente e nunca em preto. No escuro, a superfície também sobe de tom. Dentro de um objeto, fios separam itens de uma lista ou partes de um cartão.

*Exemplo:* entre a lateral e a conversa não há linha. Um fio separa o cabeçalho do item da conversa, que rola por baixo dele. O cartão de permissão é a única superfície com sombra de cartão na tela da task.

## 7. Um pedido, um lugar

O que o item pede aparece uma vez e se resolve num lugar só.

O conteúdo de um pedido (o comando, a pergunta) fica no cartão. A ação que resolve fica na barra do pedido. Com o cartão na tela, a barra é a chamada quieta: afundada, com o glifo, o rótulo, o lugar, o relógio e **Show**. A barra tingida fica para os pedidos sem cartão. Uma ação em espera no grupo de ações aponta para o cartão e não repete o comando.

*Exemplo:* o comando de uma permissão aparece uma vez na tela da task, dentro do cartão.

## 8. Movimento discreto e com função

Três durações e uma curva padrão, só o que muda de estado se anima, e só o que está em curso se repete.

120 ms para hover, pressão, foco e tooltip. 180 ms para menus e toasts que entram. 280 ms para a piscada de uma situação nova, que acontece duas vezes, no véu da sua gravidade.

Há dois laços, e cada um diz uma coisa:
- o **spinner** diz que alguém trabalha: o agente, ou o app numa ação sua. Há um spinner só no sistema, o meio arco do glifo "trabalhando", que num botão toma a tinta do botão;
- o **brilho** diz que uma leitura ainda não tem resultado: `checking GitHub`, o medidor antes da primeira leitura.

Com `prefers-reduced-motion`, tudo vai a zero: o spinner para como um anel de três quartos, o brilho vira tinta chapada, e a piscada não acontece.

*Exemplo:* os spinners da árvore e o dos botões carregando têm a mesma forma.

## 9. O teclado é visível

O foco tem uma forma que a seleção não tem, e o atalho está escrito ao lado da ação.

O foco é um anel de 2 px por fora, com 2 px de folga. A seleção fica por dentro: véu e anel colado de 1 px. Os dois aparecem juntos sem se confundir. O atalho vai no botão (**Allow** `1`, **Next to decide** `Alt ↓`), no tooltip (`Alt+←`) e na marca `Ctrl J` da linha que ele abriria.

*Exemplo:* a linha aberta da árvore com o foco do teclado tem o véu e o anel colado por dentro e o anel de foco por fora. A linha que `Ctrl+J` abriria leva a marca `Ctrl J`.

## 10. Largura contínua, pixel inteiro

Cada regra depende da largura do próprio contêiner, e tudo o que o layout posiciona cai em pixel inteiro.

O monitor de referência é 2560×1080, usado inteiro ou pela metade, e o design não se ajusta a ele: funciona de cerca de 1100 a 2600 px, sem pontos fixos de janela. A lateral é um `clamp`. A linha encurta os rótulos abaixo de 330 px de lateral. A ação da linha 3 passa à forma curta sempre que a longa não cabe. O meta de uma linha aparece só quando cabe ao lado do nome inteiro, e o nome nunca perde largura no hover nem no foco. O topo do item cede em limites fixos da área principal, primeiro o que fica em volta do stepper e por último os nomes das etapas futuras; o nome da etapa atual nunca sai ([components.md](./components.md), Cabeçalho do lugar). A conversa é uma coluna de 960 px que, numa área principal mais estreita, ocupa a área menos `--space-6` de cada lado. Um texto que corta tem tooltip com o texto inteiro.

O WebKitGTK reamostra o que fica em meio pixel e borra texto e bordas. Tamanhos em rem sobre 16 px e colunas centradas com `round()` mantêm bordas e glifos nítidos.

*Exemplo:* na tela da task, nenhuma caixa posicionada pelo layout fica em meio pixel, a 1250 e a 2560 px. Em hover e em foco, nenhum nome da árvore passa a cortar.
