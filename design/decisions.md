# Decisões

Uma entrada por decisão, da mais recente para a mais antiga. Cada uma diz a data, o que foi decidido, o que foi descartado e a razão em uma ou duas frases. Uma decisão revista ganha uma entrada nova que aponta a antiga; a antiga não é apagada.

## 2026-10-04 · Ícones: ir é um chevron, e só sair do app é diagonal

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L1). A seta de ir (`go`), que leva a um lugar do app (o nó de board e de Reviews, a linha de um prompt), é um chevron para a direita; a seta diagonal fica só para o que abre fora do app (`external`). Descartado: a seta diagonal de `go` que vinha dos mocks (`lab/05-visual-b-variations/a.html:652`). Razão: o mesmo desenho servia a dois significados, e as linhas de Prompts se liam como links para o GitHub.

## 2026-10-04 · Cabeçalho: sem stepper, o breadcrumb dobra só quando o título não cabe

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L2). Os níveis do breadcrumb dobram no `…` abaixo de 1660 px de área principal só num lugar com o stepper; num lugar sem stepper, como um arquivado, dobram só quando o título não cabe ao lado deles (`structure.md` §1). Descartado: o mesmo limite em todo lugar. Razão: o limite existe para dar espaço ao stepper; sem ele, o arquivado a 1134 px mostrava `← …` com a faixa vazia no meio.

## 2026-10-04 · Diálogo: centrado na janela inteira

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L3). Os diálogos centram sobre a janela inteira, que o `--scrim` cobre, e não sobre a área principal (`components.md` Diálogo). Razão: é o que o app e as cenas da task 11 já fazem, e `components.md` fixava só os `8vh` do topo.

## 2026-10-04 · Arquivados: a hora de hoje nos fatos

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L4). Os fatos de um arquivado usam `clockOrDateAt`: `15:02` hoje, `Sep 24 at 15:02` em outro dia, como a linha do History e o toast (`screens/rest.md` §4). Razão: uma hora por significado, e a régua não dizia se um fato de hoje leva o dia.

## 2026-10-04 · Task: a PR bloqueada depois de o review começar mantém a conversa

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L5). A PR bloqueada depois de o review começar mantém a conversa do review, com o cartão de decisão desabilitado e a barra de erro; antes da primeira passada, o vazio com título continua (`screens/task.md` §7, §11, §12). Descartado: o vazio e o bloco de erro no lugar da conversa em todo caso. Razão: uma leitura que falha nunca esconde o que estava na tela, e os apontamentos a decidir sumiam.

## 2026-10-04 · Abas: nenhuma marca a situação do step

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L6). `step_review` e `step_empty` não marcam nenhuma das abas Implementer e Reviewer; a pílula e a barra do pedido bastam (`screens/task.md` §5, §7). Descartado: a aba do implementador com `waits`. Razão: as duas situações são do step, não de uma conversa, e a aba de fora apontava uma conversa que não esperava nada.

## 2026-10-04 · Compositor: o número do placeholder segue o cartão

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L7). Com um cartão aberto, o placeholder diz as teclas que ele tem: numa permissão, `1–2` sem **Allow for this session** e `1–3` com ela; numa pergunta, as opções e **Other…** (`screens/task.md` §8). Descartado: o `1–3` fixo. Razão: o cartão já mostra só as respostas que oferece, e o placeholder não pede uma tecla que não existe.

## 2026-10-04 · Markdown: os títulos sob um título próprio

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L8). Os títulos de um Markdown aberto sob um título próprio ficam em `--text-ui` e peso 600 em todo painel (`Artifacts`, `Details`, `Documents`, o painel do card e o da PR), no corpo de um marco aberto, no prompt, no rascunho e no arquivado; a fala do agente mantém os seus. A classe `.ui-headings`, fora de camada, vale para todos, e a regra de `.card-body` em `@layer components` não é a dos títulos (`components.md` Markdown). Razão: o título do lugar se lê primeiro, e a regra em camada perdia para as classes que o Streamdown põe nos títulos; era a quarta vez do mesmo desvio.

## 2026-10-04 · Bloco de código: o mermaid no tamanho natural

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L9). O mermaid fica no tamanho natural dentro do bloco de código afundado, com `<> mermaid` e **Full screen** no cabeçalho, e o zoom só na tela cheia (`components.md` Bloco de código). O erro do diagrama não ganha forma própria: vale a régua, sem o vermelho, o spinner próprio e a duração do componente do Streamdown. Descartado: o `panZoom` do Streamdown. Razão: o diagrama saía encolhido a uns 6 px de texto, numa segunda caixa, contra o mock decidido (`lab/16-conversation-wide`).

## 2026-10-04 · Menu do item: os itens só com texto

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L10). Os itens do `⋯` são só texto; o ícone fica em `<>` (**Open in VS Code**) e na seta externa (**Open PR**), igual nos menus da task, do review e da discussão (`components.md` Menu do item). Descartado: um ícone em todo item, como o menu da discussão tinha. Razão: um componente com a mesma forma em todo lugar, e os dois ícones que ficam dizem para onde o item leva.

## 2026-10-04 · Discussão: a chegada mostra o controle que a barra pede

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L11). A chegada numa discussão (**Show** e `Ctrl+J`) rola até o controle que a barra pede ficar inteiro à vista, e a pílula `↓` não se desenha sobre o rascunho atual (`screens/discussion.md` §5.5, §8). Razão: a barra levava a um controle no pé de um rascunho alto (**Retry**, **Approve** do épico descartado), que ficava abaixo da dobra, sob o esmaecido e a pílula.

## 2026-10-04 · Nova discussão: o repositório no card

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L12). O card no diálogo de nova discussão diz `dono/nome` só quando dois repositórios do board têm o mesmo nome curto, como a Home e o History; senão, o nome curto (`screens/discussion.md` §2). Descartado: sempre o curto, como `tasks/09-discussion.md:106` dizia. Razão: um nome de repositório com a mesma regra em todo o produto.

## 2026-10-04 · Criação: o repositório padrão é o primeiro utilizável

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L13). O repositório padrão do diálogo livre de criação é o primeiro utilizável entre o do filtro da lateral, o da task aberta, o último usado e o primeiro utilizável da lista (`screens/board.md` §4.2). Descartado: o primeiro da lista ao pé da letra. Razão: um clone inexistente primeiro na ordem alfabética abria o campo vazio, com um repositório utilizável logo abaixo.

## 2026-10-04 · Board: a barra de filtros numa linha

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L14). Numa lista estreita (452 px, a janela de 1100 com o painel), a barra de filtros fica numa linha: os chips dobram em `Filter · N`, e a busca mantém a largura mínima (`screens/board.md` §3.3). Descartado: encolher a busca até caber, ou a barra em duas linhas fixas. Razão: duas linhas fixas comem a lista estreita, e uma busca abaixo da largura mínima não serve.

## 2026-10-04 · Select: a largura do menu e a razão longa

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L15). O menu de um `Select` tem largura máxima `--size-menu-max` (320 px, `calc(var(--space-16) * 5)`), ou a do gatilho quando ela é maior, e o subtítulo de um item corta com tooltip (`components.md` Select, menu e listbox; `tokens.css`). Razão: `components.md` não fixava a largura máxima do menu nem o corte do subtítulo.

## 2026-10-04 · Board: a faixa da falha é alerta só na chegada

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L16). `screens/board.md` §8 diz o que `components.md` (Faixa de aviso) e a entrada de 2026-10-02 (Faixa de aviso: alerta só quando chega) dizem: a faixa da falha é `role="alert"` só quando chega com a tela aberta. Razão: a régua se contradizia.

## 2026-10-04 · Home: o caminho longo numa linha de bloqueio corta

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L17). Um caminho longo numa linha de bloqueio da Home corta com tooltip, nunca quebra (`screens/board.md` §2.2). Razão: a linha quebrava em três, e a régua não decidia.

## 2026-10-04 · Apontamento: o código no título

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L18). Um título de apontamento com código em linha desenha o código como código (mono sobre `--surface-0`, como o texto do apontamento), e o nome acessível fica sem as crases (`components.md` Apontamento). Razão: as crases dos relatórios apareciam cruas na tela e no nome acessível.

## 2026-10-04 · Tempo: um relógio só para os chips de espera

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L19). Os chips de espera contam de um relógio só por intervalo, compartilhado no store (`useNow`), e a árvore, a barra do pedido, a aba e **Continue** nunca discordam (`structure.md` §7). Razão: cada chip contava o minuto desde a própria montagem, e a árvore e a barra da mesma task discordavam por um minuto.

## 2026-10-04 · Faixa de aviso: numa lista estreita, linhas inteiras

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L20). Numa lista estreita, a faixa de aviso quebra o título e a razão em linhas inteiras, ao lado do glifo, e põe **Try again** à direita, numa linha própria; nunca uma palavra por linha (`components.md` Faixa de aviso). Razão: a régua não dizia como a faixa cede, e numa lista de 452 px a razão de cada faixa por repositório de Reviews caía uma palavra por linha.

## 2026-10-04 · Conversa: o que o produto manda nunca está na fila

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, L21). O prompt do produto ao começar uma etapa ou um step nunca aparece como mensagem do usuário com **Remove**: enquanto pendente, é o marco do início, sem ação, e o Go não aceita apagá-lo (`RemovePending`). A regra vale para toda entrada do produto pendente, a instrução de uma passada ao revisor incluída (`screens/task.md` §6; `components.md` Entradas da conversa). Razão: a fila é da mensagem do usuário, e remover a entrada do produto abriria a sessão sem a instrução.

## 2026-10-04 · Toast: o quarto não espera

Decidido pelo coordenador da frente, por delegação do usuário, no passe de consistência da task 12 (`research/critique-task-12-pass.md`, S27). Com três toasts à vista, o quarto que chega não espera: o mais antigo sai no mesmo instante, com a saída de `--duration-fast` (`components.md` Aviso do app e toast). Descartado: segurar o quarto até o mais antigo sair. Razão: o app já faz assim, sem defeito, e a régua não dizia quando o mais antigo sai.

## 2026-10-03 · Bloco copiável: o rótulo que é uma frase fica sem caixa alta

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #35). O `CopyBlock` mantém em caixa alta o rótulo de uma palavra (`error`) e escreve como é o rótulo que é uma frase com um caminho, em `--text-micro` `--ink-3`, como o cabeçalho do bloco de código do mock (`lab/14-screen-rest/src/other.js:70`): `To remove it yourself, in ~/code/api`, na página da task apagada. Descartado: a caixa alta em todo rótulo, como a task 10 fez. Razão: a caixa alta trocaria a caixa do caminho (`~/CODE/API`), e o bloco apontaria para uma pasta que não existe.

## 2026-10-03 · Os fatos de um arquivado usam o `Fact` que já existe

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #34). A lista de termos da task, do review e da discussão arquivados é o `Fact` de `components/Facts.tsx`, o mesmo dos `Details` e do painel da PR, com a grade do mock (`max-content`, `--space-1` × `--space-5`, `lab/14-screen-rest/src/rest.css:255`) numa segunda constante ao lado de `FACTS`. Descartado: um `FactList` novo em `components/system/`. Razão: um componente por significado; muda só a grade.

## 2026-10-02 · Consistência: o passe do crítico antes da task, e a task 12 de M a G

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #1). O coordenador roda o passe do `design-critic` sobre o app inteiro depois do merge da task 11 e antes de o card da task 12 ir para `Ready`; o relatório (`research/critique-task-12-pass.md`) é o PRD, e as lacunas que ele achar são fechadas em `design/` antes. O plano tem um step por área de tela com itens no relatório, e a task é M a G, de 5 a 14 steps; passar de 14 vai ao usuário. Descartado: o passe como primeiro step da task, que deixaria lacunas de design para depois do PRD e um step de tamanho desconhecido no plano. Razão: `implementation.md:178` e a fase 5 já punham o passe antes, e o tamanho de uma task é estimativa do plano.

## 2026-10-02 · Consistência: o que sai do design antigo é o que existe hoje

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #2). A lista do que a task 12 remove deixa de citar `.dark`, Inter e JetBrains Mono, que saíram na task 1 (o tema é `data-theme`, a Fira é a única fonte). Razão: a lista é do código de hoje.

## 2026-10-02 · Consistência: as verificações que fecham a porta

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #3). As importações (nenhuma feature de `components/ui/`, nenhum `lucide-react` fora do system) são regras do Biome; as regras de texto (cor literal, classe de cor do shadcn, `--status-*`, tamanho de texto, movimento) são um teste, `styles/design-rules.test.ts`, que `lint:web` roda sempre; arquivos e dependências sem uso são do `knip`. Descartado: só um teste de varredura, que `test:web --changed` não roda quando só uma feature muda. Razão: uma verificação que não roda em todo `task check` não fecha a porta.

## 2026-10-02 · Consistência: o tamanho de texto e o movimento também são verificados

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #4). Nenhum `text-xs`, `text-sm`, `text-base`, `text-lg`… fora de `components/ui/`, e nenhum `animate-spin`, `animate-pulse`, `duration-<n>` ou curva do Tailwind: o texto é o registro dos tokens, o giro é o `Spinner`, o brilho é o `Shimmer`. Razão: são as regras de `design-system.md` e de `principles.md` 8, e o legado delas é do mesmo tamanho do das cores.

## 2026-10-02 · Bloco de código: um Copy só, `Copy the code`

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #5). Todo bloco de código, curto ou cortado, tem no cabeçalho o **Copy** do system (`CopyButton`), com o nome `Copy the code`, `Copied` e `Can't copy · select the text`; a cópia própria do `CutCode` e a do Streamdown saem. Descartado: manter as duas cópias. Razão: um controle por significado, com os mesmos estados em todo lugar.

## 2026-10-02 · Árvore: as três marcas da espera ficam

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #6). A linha da árvore que espera pelo usuário mantém o glifo, o nome em 600 e o chip de tempo âmbar, como `components.md` aprovou; o item 2 da pauta de polimento da rodada 08 fecha sem mudança. Descartado: o chip neutro na árvore. Razão: as três marcas têm formas diferentes e um matiz só, o chip é o tempo de espera que se vê de longe (2026-09-23), e a cor nunca é o único portador.

## 2026-10-02 · Botão: a tecla sempre em caixa

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #7). A tecla da ação num botão fica sempre em caixa, sem corpo: contorno `--line-2` no secundário e no fantasma, `--brand-key-ring` no primário, `--line-1` com `--ink-4` no desabilitado. Descartado: a tecla solta fora do primário, como o código pinta hoje. Razão: "a mesma forma em todas as ações de um grupo" (`components.md`) e o mock decidido da conversa (`lab/16-conversation-wide/src/core.css:16–17`).

## 2026-10-02 · Barra de rolagem: a mesma em toda área que rola

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #8). Uma regra global `::-webkit-scrollbar` dá à área que rola nativamente (o corpo de um diálogo, um `listbox`, o compositor) a anatomia da barra do `scroll-area`, sem trilho. Descartado: levar toda área ao `scroll-area`. Razão: o item 7 da pauta de polimento; o GTK não pinta mais a dele em lugar nenhum, com menos código.

## 2026-10-02 · Shadcn: um primitivo sem uso sai

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #9). Um arquivo de `components/ui/` que nenhum componente importa sai (`resizable`, `scroll-area`, `separator`); um `shadcn add` o traz de volta quando um wrapper pedir. Razão: o gerado não é editado, mas o que não é usado não precisa ficar.

## 2026-10-02 · System: um componente sem uso sai do código

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #10). Um componente de `components/system/` sem uso depois da task 11 sai do código com os testes; `components.md` continua descrevendo o componente, e `docs/architecture/design-system.md` deixa de listá-lo. Razão: o código descreve o que o produto usa, e o design system descreve o que ele pode usar.

## 2026-10-02 · Virtualização: as metas e as builds

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #11). A meta de cada medida vale para o máximo das execuções quentes com o React de produção e para a mediana com o de desenvolvimento; a conversa também é medida com todos os trechos abertos, com `↓` (16 ms) e `Home` (100 ms) no `feed`. Razão: "abaixo de 16 ms" não dizia de que build, e o caso que a virtualização serve, a conversa aberta, não tinha medida.

## 2026-10-02 · Virtualização: o registro das medidas

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #12). As medidas finais da conversa e do board ficam em `docs/development/target-machine.md` e no corpo da pull request da task 12. Razão: a documentação descreve o produto como ele é, e ele passa a ser virtualizado.

## 2026-10-02 · Reviews: a lista sem janela

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #13). A lista de Reviews não é virtualizada e passa a andar pelo teclado por índice, como o board. Razão: 8 PRs abertas no uso real (`research/review.md:13`).

## 2026-10-02 · Conversa: a cauda fora da janela

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #14). A linha do fim, o cartão fixo, as mensagens na fila e a atividade ficam fora da janela da conversa, sempre montados. Razão: são o fim da conversa, onde o usuário está quase sempre, e a âncora do fim depende deles.

## 2026-10-02 · Virtualização: linhas no fluxo, sem transform

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #15). As linhas montadas de uma lista virtualizada ficam no fluxo da coluna, entre espaçadores em pixel inteiro, nunca posicionadas por `transform` com a soma das alturas. Descartado: o posicionamento absoluto com `translateY` das bibliotecas. Razão: a soma das alturas cai em meio pixel, e o WebKitGTK borra o que fica em meio pixel (`principles.md` 10).

## 2026-10-02 · Faixa de aviso: alerta só quando chega

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #16). Uma faixa de falha que já está na tela quando o lugar abre não é `role="alert"`; só a que chega com a tela aberta é. Razão: é a regra de `components.md` (Faixa de aviso), que o código não seguia, e montar a tela anunciava a faixa de novo.

## 2026-10-02 · Home: o que bloqueia, por repositório

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #17). Na linha de um board na Home, depois da falha da leitura, as linhas do que bloqueia vêm uma por repositório, em ordem alfabética, com o caso de cada um, e não agrupadas por caso. Razão: é o que `tasks/05-board.md:121` dizia, e `screens/board.md` §2 passa a dizer.

## 2026-10-02 · Conversa e board virtualizados

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 12 (`tasks/12-consistency.md` §4.3 #18). A conversa e o board passam a ser listas virtualizadas, e `structure.md` §7, `screens/task.md` §12 e `screens/board.md` §6 dizem como, em vez de "entra só se a medição pedir". Razão: as medidas das tasks 4 e 5 perderam as metas (`implementation.md`, task 12).

## 2026-10-02 · Diálogos destrutivos: abertos até a ação terminar

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #12). **Delete task**, **Discard step**, **Back to…**, **Discard and restart…**, o apagar de um arquivado e **Delete review**, ativo ou arquivado, ficam abertos com o verbo no gerúndio até a chamada voltar, e uma falha fica no rodapé, com a confirmação como o repetir; o aviso do app não as recebe. Descartado: fechar antes e mandar a falha ao aviso, como hoje. Razão: é a regra de `components.md` (Diálogo; Aviso do app), que a task 10 já aplicou aos de Settings.

## 2026-10-02 · History: a busca casa com o número da PR e do card de uma task

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #3). Com `#N`, a busca do History acha também a task pela PR que ela abriu e pelo card de onde veio, além do review pelo número. Descartado: só o review, como hoje. Razão: o placeholder e o vazio aprovados (`Search by name, title or #number`) já prometem o número para todos.

## 2026-10-02 · History: a linha recém-arquivada aparece mesmo fora do filtro

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #4). Chegar por **Open in History** limpa a busca do History; se o filtro da lateral esconderia a linha, ela aparece assim mesmo, no dia dela, fora da contagem. Descartado: limpar o filtro da lateral, que mudaria a árvore sem o usuário pedir. Razão: a linha a que se chega nunca falta.

## 2026-10-02 · Diálogos destrutivos: sem `Ctrl+Enter`

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #10). Um diálogo cuja confirmação é perigosa não confirma por `Ctrl+Enter`: abre em **Cancel**, e só `Enter` ou o clique na confirmação a disparam. Vale a exceção em `components.md` (Diálogo, Teclado) e em `structure.md` (§5, `Ctrl+Enter`), que dizem que `Ctrl+Enter` confirma o diálogo. Descartado: o atalho em todo diálogo. Razão: o gesto destrutivo nunca fica a um atalho; o **Delete review** da task 6 já é assim, e `screens/rest.md` §13 liga `Ctrl ↵` ao primário, que um destrutivo não tem.

## 2026-10-02 · O que o git não removeu de um review apagado vai à página dele

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 11 (`tasks/11-history-dialogs.md` §4.3 #14). A worktree de um review que o git não removeu aparece na página do review apagado, com o aviso do `--force` e o comando, como na task apagada. Descartado: a faixa `Some files stayed on disk`, que sai e dizia `The task is gone` também de um review. Razão: o que sobrou tem saída no lugar do item (`structure.md` §1).

## 2026-09-29 · Settings, boas-vindas, início e migração: o que a entrada da task 10 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 10 (`tasks/10-settings.md` §4.3). **A janela abre antes dos dados** (P35): o início e a falha aprovados em `screens/rest.md` §5 só aparecem assim, porque hoje o app carrega tudo antes da janela e sai sem ela numa falha; **Try again** recomeça o início no mesmo processo, uma falha antes de haver janela (os diretórios, o log) continua no terminal, e a migração recusada vira o fim do primeiro passo. Cada binding chega ao domínio por um acesso que devolve `MySpec is starting` antes do `ready`. Os passos são `Opening your data` e `Checking the clones of N repositories`; um passo passa a lento em 3 s; o início não tem prazo total (sai o de 10 s), e o teste dos clones vem antes das flows, que precisam saber que clone falta. O caso de uma falha vem de uma sonda do diretório de dados antes do banco, porque o SQLite não diz o `errno`, e os textos levam os caminhos resolvidos. A área principal do início só aparece depois de 400 ms, para uma abertura normal não piscar. Antes do estado, o tema é o que `index.html` pintou, e a interface guarda também a preferência. **As boas-vindas moram no shell**, no lugar da Home, só sem board, sem repositório e sem item ativo (uma discussão ativa de um board removido deixa o shell normal, que não esconde trabalho vivo): valem a Home, Settings e, com algo arquivado, History; `Ctrl+,`, `Esc` e `Alt+←` `Alt+→` agem, os outros atalhos não; a checagem da máquina roda ao aparecer, quando a leitura do catálogo termina e quando a janela volta ao foco, com o login lido do `gh` local, sem rede. **O seletor de modelo** espera o catálogo sem abrir e diz `Effort · <modelo>` em todo lugar; a marca `factory` e os padrões de fábrica (P34b) ficam só em Defaults, onde a fábrica é a referência. **O retrato dos status** é gravado por uma migration no cadastro e na edição de um board (P32), e os boards de antes ganham o da última leitura, porque o produto só guardava os ids dos finais. **As confirmações de remover** um board e um repositório ficam abertas até o fim, com a falha nelas. **O board inexistente** passa a dizer o que fazer (`Check the number and that this account can see the project.`), em todo lugar; `gh auth refresh -s read:project` fica com a falta de escopo, que é outro motivo. **Os vazios** de Boards e de Repositories têm a ação que os resolve, pela regra do system. **Save** das instruções de review é secundário, porque Settings não tem primária. `o aviso de clone abre Repositories` sai de `structure.md` §1 e `screens/rest.md` §2.1: nenhum aviso o faz, e o item da árvore muda o caminho direto. A task 10 começa depois do merge das tasks 4 e 5 e corre em paralelo com as tasks 6 a 9, o que revê em parte, só para ela, o princípio "uma task por vez, na ordem" (`implementation.md` §1), como a entrada de 2026-09-28 fez para a 5. Descartados: registrar os services vazios e preenchê-los depois, que prenderia receptores nulos em `options()` e pediria sincronização; abrir a janela depois do banco, que deixaria sem tela a falha mais provável (os dados sem permissão); reabrir o processo no **Try again**, que esbarraria na instância única; `gh auth status`, que consulta a API e diria "sem login" numa máquina sem rede; a marca `factory` na task e na criação, onde a escolha segue **Defaults**. Razão: nenhuma muda um fluxo inteiro, apaga dado ou desdiz o aprovado; cada uma fecha um caso que `screens/rest.md` deixava sem regra, ou que o código atual não permitia.

## 2026-09-29 · Discussão: o que a entrada da task 9 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 9 (`tasks/09-discussion.md` §4.3). **A rodada** (P25): uma leitura que muda os rascunhos abre a rodada seguinte quando todo rascunho da rodada atual está no GitHub ou descartado, e senão é uma revisão dela; a rodada fechada não muda nem perde rascunhos numa leitura seguinte (hoje um descartado que sai do artefato some), salvo um id que o agente reusa, que vai para a rodada nova. **A dobra** é derivada no frontend: o marco de publicação da rodada (ou o `Drafts written`, sem publicação) vira o `Round N` no lugar dele, e os outros marcos e o cartão dela saem, em vez de um marco gravado na hora da última publicação. **Sem hora no texto de um marco**: o intervalo `14:29 – 15:12` vai para a hora do marco, em hover, pela decisão da conversa de 2026-09-25. **A discussão pausada** mantém a barra quieta com o que os rascunhos pedem, sem as situações da sessão, como a task e o review, e o cartão continua decidindo e publicando, porque a publicação não depende da conversa (task 8); `discussion.md` §13 dizia "sem barra". **O épico do usuário** nasce com o título do diálogo de agrupar e aceita o corpo vazio. **Os avisos** nomeiam os rascunhos pelo título, e a razão de um artefato ilegível é o texto do produto, sem a linha que o leitor não conhece. **A trava de 900 ms** vale para as teclas e os cliques de decisão de todos os rascunhos, depois de qualquer decisão. **A página da discussão apagada** não tem o bloco do que foi publicado, que o estado já não tem; o diálogo de apagar já disse quantos. **Retry** da sessão é só frontend, porque o Go já aceita a chave da discussão. Depois da crítica da entrada (`research/critique-task-09-input.md`): o que a leitura muda é a diferença campo a campo, e a aprovação que ela tira sem substituir o rascunho (o épico ou uma dependência que saiu, os cards de um épico) também é dita em `Drafts revised` e com `Revised`; o formato dos rascunhos pede que o agente mantenha o id de um rascunho que muda; as recusas do agrupamento têm sentinels e frases próprios, e a criação desfeita diz ` The discussion was undone.`; **Delete discussion…** e o **Retry** do rascunho ficam desabilitados durante uma corrida, que o Go recusa; uma rodada sem marco de uma discussão anterior à task dobra num `Round N` derivado antes do `Drafts written` da seguinte; a 9 corre em paralelo com a 10. Descartados: um marco de dobra gravado pelo Go, que pediria reordenar a conversa ou um retrato dos rascunhos no transcript; a linha do arquivo no marco do artefato ilegível, que o leitor não conta; a barra escondida na discussão pausada, que tiraria **Next to decide** e **Archive…** de uma tela em que decidir continua valendo; uma rodada nova a cada leitura depois de uma publicação parcial, que partiria uma revisão pedida no meio da decisão. Razão: nenhuma muda um fluxo inteiro, apaga dado que não se refaça com um gesto ou desdiz o aprovado; cada uma fecha um caso que `screens/discussion.md` deixava sem regra ou com duas.

## 2026-09-29 · Discussão: o que a entrada da task 8 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 8 (`tasks/08-chained-publication.md` §4.3), depois da crítica dela (`research/critique-task-08-input.md`). A regra da cadeia é uma função só, em Go, sobre os rascunhos: um rascunho aprovado publica quando tudo de que ele precisa antes (o épico dele, as dependências dele e, num épico, as dependências de fora dos cards aprovados) já está no GitHub ou vai na mesma corrida; o épico precisa ainda estar aprovado, com os cards todos decididos e ao menos dois aprovados, até a primeira escrita dele. Uma dependência num rascunho descartado sai com o aviso, como hoje; uma dependência que alcança o card de um épico descartado segura o dependente, que não segura o arquivamento. Um ciclo entre rascunhos aprovados publica junto, quebrado pela posição, como dentro de um épico hoje. **Uma falha é a de hoje, fechada:** ela marca o rascunho em que a corrida parou com `Publish failed` e **Retry**; o que depende dele espera; os independentes continuam publicando; a barra diz `Publish failed` com **Show** até o **Retry**, que limpa as falhas e continua a cadeia de onde parou; decidir de novo, ou a revisão do agente, de um rascunho que falhou antes de o GitHub receber qualquer coisa limpa a falha dele. Só uma decisão publica: mudar o repositório, o épico ou as dependências de um rascunho aprovado e não publicado retira a aprovação dele e a do épico cujos cards mudam, e a revisão do agente que tira o épico ou uma dependência de um aprovado também; agrupar em épico recusa um card que já é de outro épico-rascunho; um rascunho sem título não é aprovado. A situação que espera o usuário fica de pé durante uma corrida; só `Ready to archive` espera a corrida acabar. Na atualização, um épico aprovado que ainda não começou a publicar, numa discussão ativa, volta a `Not decided` e sem falha, para nada ir ao GitHub sem um gesto feito sob a regra nova. Tudo descartado também é `Ready to archive`, com `nothing published`. O que **Approve** e **Discard** publicariam (F16) passa a vir do Go, pela mesma função, na task 9. A prova no GitHub é um ponto de parada operado pelo usuário, sobre diretórios de dados e de estado vazios. Descartados: parar a discussão inteira depois de uma falha, que desdiria a resposta do usuário ("um card aprovado sem dependência é publicado direto", `research/interview.md:45`); soltar o dependente de um card que não vai publicar, que perderia a relação se o épico fosse aprovado de novo; deixar uma edição soltar a cadeia, que publicaria sem a linha que diz o que o gesto publica; publicar na atualização os épicos prontos, que escreveria no GitHub sem gesto; a prova sobre uma cópia do diretório de dados, que retomaria as tasks ativas do usuário. Razão: nenhuma muda um fluxo inteiro, apaga dado que não se refaz com um gesto ou desdiz o aprovado; cada uma fecha um caso que `screens/discussion.md` §6 deixava sem regra. Na medição de 2026-09-29, nenhuma discussão está ativa.

## 2026-09-29 · PR da task: o que a entrada da task 7 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 7 (`tasks/07-task-findings.md` §4.3), depois da crítica dela (`research/critique-task-07-input.md`). O relatório da PR da task tem o formato do centro de review, com um parser só (`prreport`), e o prompt padrão de review de PR não muda: as seções `Findings format` e `Applying` passam a entrar também no da task. Uma passada é decidida no cartão quando o produto a pediu com esse formato (a linha em `pr_passes`, criada no envio do prompt); a pedida antes continua em texto até acabar. A decisão é a do modo Apply do centro de review: com tudo decidido e algum aprovado, `Ready to apply` com **Apply approved**; com tudo descartado, a PR fica `Ready to merge` sozinha, sem gesto, com a conversa aberta e o cartão reversível até o merge. Isso muda o laço da PR da task, que hoje só termina num relatório limpo: ele ganha uma saída pela palavra do usuário, a passada toda descartada, que segue o precedente aprovado do modo Apply. A mensagem de **Apply approved** leva os aprovados no formato do relatório e uma seção `Discarded findings`, para o revisor não apontar de novo o que o usuário descartou, nas duas telas. As mudanças que o revisor fizer antes do envio vão ao review com as dos aprovados. Uma passada enviada sem mudanças fica em `Review changes` com `No file changed`, e o compositor desse estado diz `Ask the reviewer for a change…`. Sem situação nem barra enquanto o revisor reescreve o relatório; a situação começa na forma que a passada tem, com um texto de notificação por forma. Um relatório ilegível deixa a task em `Waiting for reply` com a razão no texto do produto, como no review. O envio não tem marco próprio, na task nem no review: `You decided` e a mensagem do produto o dizem. O lugar da barra dos apontamentos é `PR review · pass N`.

Também por delegação: **Approve the rest** entra na barra de decisão, na PR da task e no centro de review (é um componente só), como secundário, sem tecla, só com algum apontamento por decidir, e o marco `You decided` lista o que foi aprovado assim. A razão são os dados: toda resposta real às decisões em texto aprovou tudo (`fix all needed`, `do fixes`, `fix`), e um quarto dos relatórios tem de 15 a 29 apontamentos.

Descartados: **Finish review** como gesto para a passada toda descartada, porque o modo Apply aprovado leva sozinho a `Ready to merge`, e o `done` derivado mantém a volta que um encerramento fecharia; reler pelo parser os relatórios em texto, que nenhum seguiria; um prompt padrão reescrito, que deixaria um prompt editado sem o formato; uma tecla para **Approve the rest**, fácil demais de apertar ao lado de `A`; e **Discard the rest**, que os dados não pedem. Razão: nenhuma apaga dado ou desdiz o aprovado; a única que muda um fluxo, a saída do laço com tudo descartado, é o fluxo que o usuário já aprovou no modo Apply.

## 2026-09-29 · Review: o que a entrada da task 6 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 6 (`tasks/06-review.md` §4.3). A contagem do nó **Reviews** é a da seção `Pending`: uma PR pendente com review ativo fica em `In review` e na árvore, e deixa de contar (`changes.md` R1). O card no painel da PR abre o painel dele na visão do board quando está na leitura, como o painel `Card` da task (R4). Chegar a um review por `Ctrl+J` ou pela notificação leva o foco ao que a situação pede, como na task (R18). **Review again…** abre sempre o diálogo no review, também num check que falhou e numa passada bloqueada; **Publish failed** age abrindo o diálogo de publicação. Desmarcar **Include the summary** publica sem o resumo e não o apaga (`backend.md` P47). Uma passada publicada sai do cartão para o marco `You decided`, que abre os apontamentos desabilitados; uma passada não publicada que um **Review again** deixa para trás fica só com o marco do relatório. O título do apontamento é opcional no relatório: sem ele, a localização toma o lugar. O lugar da barra do review é a passada (`pass 1`), salvo `Ready to merge`. Depois da crítica da entrada: a hora de uma falha de leitura é a da primeira falha da sequência; se o GitHub exigir um corpo para `Request changes` e `Comment`, uma passada sem resumo e sem apontamento no corpo envia o corpo mínimo `Review with N inline comments.`, em vez de recusar o veredito; o diálogo reaberto depois de uma falha traz o veredito e a caixa da tentativa. Descartados: a contagem com as PRs em review, **Review again** direto sem diálogo num check que falhou, e o cartão de uma passada antiga ainda aberto na conversa. Razão: nenhuma muda um fluxo, apaga dado ou desdiz o aprovado; cada uma fecha um caso que o documento da tela deixava sem texto ou com duas respostas.

## 2026-09-28 · Implementação: a task 5 corre em paralelo com a 4

Decidido pelo coordenador da frente, por delegação do usuário. A task 5 (Home, board e criação de task) não depende da 4 (a conversa), só da 2, e corre em paralelo com ela; a que terminar antes entra antes, e a outra faz rebase, `task generate` e `task check` antes da revisão do crítico (`tasks/05-board.md` §6). Revê em parte o princípio "uma task por vez, na ordem" de `implementation.md` §1, confirmado em 2026-09-25, só para esse par. Descartado: esperar o merge da 4. Razão: as duas tocam arquivos diferentes, salvo conflitos textuais listados, e a 4 é a maior da frente.

## 2026-09-28 · Board: o que a entrada da task 5 decidiu

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 5 (`tasks/05-board.md` §4.3). Um card escrito por uma discussão ainda ativa também está `In discussion`, e o painel do card leva à discussão que o escreveu mesmo arquivada (`From the discussion <título>`), porque é dela que vem a seção `Discussion` do contexto. O **New discussion** do menu **+ New** pergunta o board, como o da Home, quando o lugar na tela não tem board. **Continue** fica com o item ativo aberto mais recente que ainda existe, pela pilha de lugares, e nunca mostra um item que saiu. No painel `Card` da task, um card do board abre o painel dele na visão do board (`changes.md` B13, já no escopo confirmado da task 5). **Add to board** continua sem abrir o diálogo de criação sozinho: o card passa a **Start task** ou a **Clone and continue**, com o foco nele. Descartados: o **Continue** desabilitado com o item que saiu, e o `In discussion` só para os cards de entrada. Razão: menos becos sem saída e o mesmo caminho para a mesma pergunta, sem mudar um fluxo.

## 2026-09-28 · Conversa: saída dos comandos guardada inteira e resposta pelo compositor

Decidido pelo coordenador da frente, por delegação do usuário, na entrada da task 4. A saída de cada comando é guardada inteira (do Bash, o que ele imprimiu; de qualquer ferramenta que falhou, a razão; do subagente, o relatório final), até 64 KiB por ação, numa tabela própria lida sob demanda por **Show all**; o transcript leva a contagem e a cauda que a tela mostra. Com uma pergunta estruturada aberta, o texto do compositor responde a pergunta, como o **Other…** da primeira pergunta ainda sem escolha, em vez de esperar na fila; com mais perguntas sem escolha, o foco volta ao cartão. Descartadas: guardar só as últimas 40 linhas, e a mensagem livre na fila enquanto o cartão espera. Razão: o CLI já corta cada saída em 30.000 caracteres (mediana de 105 KB por sessão), e 42% das saídas passam de 40 linhas; a mensagem na fila nunca chegava enquanto o cartão esperava, e o placeholder aprovado já prometia a resposta.

## 2026-09-25 · Conversa: largura única de 960 px

Escolhida a variação A da rodada `lab/16-conversation-wide`: a conversa é uma coluna centrada de 960 px em que tudo tem a mesma borda esquerda e direita: a fala do agente (texto na página, sem cartão), a mensagem do usuário (fundo próprio, mesma largura), os blocos de comando, o código, as tabelas, os cartões de pergunta e permissão, os apontamentos, os marcos, a barra do pedido e o compositor. Corpo em 15 px. Sem hora visível (só em hover), sem avatar, sem linha do tempo; o autor é uma palavra pequena; ações como bloco de comando no estilo dos terminais (rótulo pela descrição, comando apagado, saída dobrada, falha com a cauda aberta); código longo cortado em 20 linhas com `Show all`; pergunta e permissão são os únicos blocos com contorno; o azul deixa de marcar o agente na conversa. Descartadas: B (fluida até 1120 px com 16 px) e a linha de leitura mais estreita que os blocos (rejeitada pelo usuário: "umas coisas menores que outras"). A rodada 15 fica como a origem (a C era a base).

## 2026-09-25 · Conversa: cartões leves como base, coluna mais larga, sem linha do tempo

Da rodada `lab/15-conversation`, a variação C (cartões leves) é a base: cada fala num cartão de superfície sutil, ações e marcos em linhas entre os cartões. Descartadas A (documento com margem de autor e hora) e B (linha do tempo com fio), que o usuário achou poluídas e com o conteúdo principal descentralizado. Pedidos para a rodada seguinte: aproveitar melhor o espaço com uma coluna de leitura mais larga; algo limpo e fácil de usar; sem dar importância a coisas pouco relevantes, como o horário de cada mensagem ou uma linha do tempo própria; referências pesquisadas, inclusive de terminais.

## 2026-09-25 · Plano de implementação e mudanças sensíveis confirmados

O usuário confirmou `implementation.md`: a sequência de doze tasks, as duas divisões (fundação em 1 e 2; tela da task em 3 e 4), os dois backends médios como tasks próprias (7 e 8), a substituição dos tokens do frontend pelos de `design/system/tokens.css` com a ponte para o shadcn e o tema por `data-theme`, e as seis mudanças de comportamento mais sensíveis de `changes.md` (S1; T1, T4, T6; B3; R11, R12; T16; D3, D4). Antes da task 4, uma rodada dedicada às entradas da conversa (`lab/15-conversation`) refina o que a tela da task decidiu, sem reabrir a estrutura da tela.

## 2026-09-25 · Settings, History, boas-vindas, diálogos e avisos

Aprovada a rodada `lab/14-screen-rest` como está: Settings abre em Defaults (modelos por etapa e modo de review como centro) com quatro páginas, Defaults, Boards, Repositories e Prompts, os nove prompts como uma lista numa página; sem página de aparência, o tema fica no rodapé da lateral. History é uma lista só, por data, com tipo, onde e resultado, e o filtro por repositório da lateral vale nele; a task arquivada mostra o resultado do encerramento e os relatórios. O cadastro de board tem três etapas com `Back`, e a linha do repositório diz o que acontece ao desmarcá-lo. As boas-vindas têm o bloco `This machine` só quando falta algo. Os diálogos destrutivos abrem com o foco em Cancel e mostram a prévia do que será destruído; os de criação abrem no primeiro campo. As notificações têm um texto por situação, listados em `screens/rest.md`.

## 2026-09-24 · Discussão: um rascunho por vez, aprovar publica

Escolhida a variação B da rodada `lab/13-screen-discussion`: os rascunhos de uma rodada como lista dobrada com o estado de cada um à direita, o atual aberto com o corpo inteiro renderizado, `A` e `D` decidindo e abrindo o próximo (com proteção contra a tecla repetida: um gesto que publica mantém o foco). Aprovar publica na hora um card sem dependência; um card que depende do épico ou de outro card espera e segue sozinho; o épico publica quando todos os cards dele estão decididos e ao menos dois aprovados; antes do gesto o cartão diz o que `Approve` publica agora ou se vai esperar; o desfazer de uma publicação é fechar a issue no GitHub, dito no cartão. Pedir mudanças pela conversa é o caminho principal, e uma rodada nova de rascunhos substitui a anterior com um marco. O documento da discussão é um marco de uma linha, painel fechado. Sem `Publish epic` nem toast; um marco por rodada de publicação com o estado por rascunho. Depois de tudo publicado, a barra de pedido diz `Ready to archive`. Descartada a A, todos os rascunhos abertos.

## 2026-09-24 · Review: cartões na conversa, publicação em diálogo

Escolhida a combinação da rodada `lab/12-screen-review`: os apontamentos como cartões na conversa, decididos com `A` e `D` que avançam ao próximo, com a barra de decisão acima do compositor (variação A); a publicação num diálogo mínimo, com o veredito como escolha explícita (sugerido pelas decisões, nunca pré-marcado) e o resumo opcional (variação B). Descartados: o cartão de publicação dentro da conversa (A) e a coluna de apontamentos (B). Junto: a lista de PRs no padrão do board com linha mínima, a PR aberta em painel, `R` inicia o review, início com bons defaults, espera dos checks pelo nome, `Review again` com commits novos, review encerrado no merge; sem review de consulta, sem trecho de diff no cartão, GitHub como primeira ação na localização.

## 2026-09-24 · Board: por status, card em painel

Escolhida a variação A da rodada `lab/11-screen-board`: a lista do board agrupada pelas seções de status do board, na ordem dele, com as finais recolhidas e o épico como rótulo na linha; o card abre num painel à direita, sem sair da lista. Descartadas: B, agrupada por épico com o card no lugar, e a combinação por status com o card no lugar. Junto: a linha do card mostra só o que decide a escolha (número, título, task com o estado, `In discussion`, dependência não satisfeita), `Start task` e `Discuss` no card e pelas teclas `S` e `D`, `New discussion` no cabeçalho com `N`, seleção múltipla só num modo pelo `⋯`, Home mínima com `Continue`, criação de task com os modelos recolhidos sob um resumo e o contexto do card sob `Show`.

## 2026-09-24 · Tela da task: stepper e abas mínimas

Escolhida a variação B da rodada `lab/10-screen-task-minimal`: um stepper compacto no cabeçalho, com as etapas nomeadas (feitas com marca, atual expandida com a posição e a passada de review, futuras como círculo), sem trilha inteira nem tempos; implementador e revisor como duas abas mínimas acima da conversa, só enquanto o step tem os dois; a conversa do lugar atual; o compositor com a barra de pedido. Descartada a A, com a linha fina e uma conversa só. Condição herdada da crítica: o stepper mantém os nomes das etapas na metade do monitor. Consequências das decisões anteriores, agora fixas: grupos de ações recolhidos por padrão, rotulados pela descrição do agente; mensagens do produto como marco de uma linha com o conteúdo a um clique; conversas anteriores e relatórios em `Details`; ferramentas do step, da PR e da task no menu `⋯`; Review mode e Models mudam por popover no `⋯` e em `Details`.

## 2026-09-24 · A tela da task é mínima

A tela da task mostra a conversa do lugar atual e um indicador de progresso bonito e simples, que diz de um olhar em que etapa a task está, o que já foi concluído e o que está rodando. Nada mais compete pela atenção. Descartadas as duas variações da rodada `lab/09-screen-task`: a conversa contínua com margem de marcos, cabeçalho do laço e filtro de vozes (A), e o trilho de workflow com uma conversa por lugar e coluna de apontamentos (B). As duas ficaram piores que a tela atual por poluição. Razão, nas palavras do usuário: voltar à conversa de uma etapa ou de um step anterior não é uma necessidade; ele não quer checkpoints nem barras cheias de informação tirando o foco; quer uma tela limpa, enxuta, minimalista, feita por quem faz o que importa. Consequências: o histórico das conversas anteriores fica acessível fora da tela (por exemplo no painel `Details`), não na tela; a barra de pedido continua, porque é o que importa; o que ficou bom na rodada 09 (rótulo da ação pela descrição, subagente aninhado, mensagem do produto como marco de uma linha, `Retry` por sessão, resposta rápida) entra na tela mínima sem acrescentar cromo.

## 2026-09-24 · Fundação visual aprovada

A linguagem visual e o design system estão aprovados como consolidados em `lab/08-visual-final`: `principles.md` (dez princípios), `system/tokens.css` (a fonte única dos tokens, nos dois modos) e `system/components.md` (anatomia, variantes, estados, teclado e acessibilidade de cada componente base). Tema Grafite quente; Fira Sans e Fira Code; dois registros de densidade; superfícies em camadas; cor como sinal. A tela da task na rodada 08 é a referência visual, não uma tela aprovada: o topo do item e a conversa são redesenhados na fase 4, e os nove itens de polimento do `critique.md` da rodada 08 (seção 7) são pauta da fase 4.

## 2026-09-24 · Os papéis da cor de identidade

O azul de identidade tem papéis fixos: marca, ação primária (uma por tela; o `Send` do compositor só vira primário quando nada mais na tela espera pelo usuário), foco, linha aberta (véu, anel e glifo), etapa atual na trilha, `Ctrl J`, medidor de contexto, links, marcador da fala do agente, ícones ativos. As superfícies e as sombras são neutras, sem o azul. Nunca pinta um estado: espera é âmbar, erro é vermelho, encerramento é verde, trabalhando é tinta neutra em movimento, GitHub, pausado e ocioso são tinta secundária. Razão: a identidade precisa de presença para o produto ter caráter, e de papéis fixos para nunca competir com um sinal.

## 2026-09-24 · O meta da linha aparece em hover, foco e na linha aberta

O repositório e o `#card` de uma linha da árvore aparecem só em hover, foco de teclado ou na linha aberta, e só quando cabem ao lado do nome inteiro; quando não cabem, vão para o tooltip do nome. Muda o brief (seção 3, "de relance" do repositório na task) e `structure.md` §2. Descartado: meta sempre visível. Razão: o agrupamento por board já diz onde a task vive, e a árvore fica muito mais calma sem o meta em cada linha; um nome nunca é cortado por causa do meta.

## 2026-09-24 · Desvios da estrutura absorvidos pela linguagem

Três escolhas da fase 3 reescrevem `structure.md`: a aba Implementer/Reviewer mostra o glifo da situação e o rótulo, sem o chip de tempo (o tempo fica na barra de pedido e na árvore); a linha da árvore com o agente rodando tem um único spinner, no início da segunda linha, sem o da borda direita; e o topo do item cede espaço em ordem numa área principal estreita (abaixo de cerca de 1020 px as etapas futuras ficam só com o círculo). O topo é provisório: a fase 4 o redesenha, e a regra de largura não entra em `structure.md` §6.

## 2026-09-24 · Tema: Grafite quente

A cor do MySpec é o tema **Grafite quente** do explorador `lab/07-theme-explorer`: neutros levemente quentes (o traço de calor do carvão e do papel do Cobre, bem abaixo do Sálvia) com um azul elétrico de identidade, levemente puxado para o cobalto e com menos saturação para conviver com o papel morno; lateral no tom da página; estados com as cores de sempre (âmbar de espera, vermelho de erro, verde de encerramento, "trabalhando" em tinta neutra). Descartados: Cobre e Cobre II (identidade quente, o usuário preferiu o azul), Grafite frio (o usuário achou frio demais), Sálvia (passa do ponto no calor), Marinho quente, e os demais temas do explorador. Razão: o usuário gostou do azul do Grafite e do calor do Cobre; neutros levemente quentes com acento azul é uma combinação sólida do gênero.

## 2026-09-24 · A cor de identidade é decidida na fase 3

O MySpec ganha uma cor de identidade, escolhida pelo usuário entre variações da rodada `lab/05-visual-b-variations`, aplicada com parcimônia (marca, ação primária, foco, seleção) e nunca no lugar de uma cor de estado. Descartado: ficar só em cinza com cor semântica, como nas direções da rodada 04. Razão: o usuário quer um produto com caráter, não uma ferramenta acromática; a rodada 04 orbitou o cinza e deixou a decisão implícita.

## 2026-09-24 · Estrutura aprovada, com o topo do item em aberto

A estrutura consolidada em `lab/03-structure-final` está aprovada e registrada em `structure.md`: a árvore com a anatomia de linha compacta, a navegação com histórico, a barra de pedido acima do compositor com a única cópia da ação, os painéis fechados por padrão, `Details` como painel, os estados de toda tela, a largura contínua. Ficam explicitamente em aberto para a fase 4, na primeira tela (a task com a conversa): o topo do item aberto, hoje quatro faixas empilhadas (cabeçalho, trilha de etapas, barra do step, abas Implementer/Reviewer) herdadas do app atual; a experiência de progresso entre as etapas; e a experiência dos agentes que implementam e revisam. Razão: são estruturais, mas não se resolvem em wireframe cinza; a tela da task é onde a direção visual e a hierarquia do item são provadas juntas. O usuário registrou a ressalva de que muita coisa ali ainda segue o padrão atual e precisa ser refinada a fundo.

## 2026-09-23 · Modelo do shell: árvore e caminho de volta

Escolhida a variação A da rodada `lab/01-structure-shell`: a árvore da barra lateral (Reviews, depois board › épico › item) é o painel de comando, com status, tempo de espera, ação em curso e contexto em cada linha; um lugar por vez na área principal, com histórico de navegação, breadcrumb e Settings voltando para onde o usuário estava; conversa no centro e painéis auxiliares fechados por padrão. Descartadas: B, fila plana por urgência, que troca a árvore e reordena sozinha; C, trilho de três modos, que esconde os itens dos outros modos numa janela larga. A decisão é sobre o modelo, não sobre os componentes nem sobre o visual do wireframe. Ficam para avaliar depois, na tela: da C, decidir apontamentos e rascunhos dentro da conversa; da B, os checks pelo nome e o bloco de fatos da task como painel.

## 2026-09-23 · Brief aprovado

`design/brief.md` é a base de toda proposta. Nele: a árvore com status por cor é o "depende de mim" e a seção `Waiting for you` deixa de existir; a conversa com o agente é a tela central; custo em tokens e dólares fica fora.

## 2026-09-23 · Tempo, contexto e atividade de longe

Aparecem sem abrir o item: há quanto tempo ele espera pelo usuário, há quanto tempo o agente está no turno atual, a porcentagem de contexto e a ação em curso, os dois últimos de forma compacta e só com o agente rodando. Descartado por enquanto: duração total de task, etapa e step, que pede persistir situações encerradas no backend. Razão: é o que o usuário disse que importa, e o custo de backend é pequeno (um campo com a ação em curso no resumo do item).

## 2026-09-23 · Largura contínua, não dois pontos

O monitor de referência é 2560×1080, usado em tela cheia ou pela metade, mas o design funciona num intervalo contínuo de cerca de 1100 px a 2600 px, sem ser ajustado a esses valores. Razão: pedido explícito do usuário de não superajustar ao monitor atual.

## 2026-09-23 · A frente é conduzida fora do MySpec

A trilha de design roda em sessões de Claude Code com os agents de `.claude/agents/`, coordenadas pela skill `design-front`; a implementação de cada tela decidida é uma task no MySpec. Descartado: um modo de design dentro do próprio MySpec. Razão: design é trabalho divergente, com variações e descarte, e o MySpec é feito para trabalho convergente, spec e steps; construir a ferramenta antes de fazer o trabalho uma vez seria adivinhar o que ela precisa.

## 2026-09-23 · A estrutura é decidida antes do visual

As fases seguem a ordem brief, estrutura, fundação visual, telas. Descartado: começar pela tela mais importante e extrair a fundação dela. Razão: o objetivo é repensar o produto com o todo em mente, não repaginar as telas atuais; sem estrutura decidida cada tela sai com uma lógica.
