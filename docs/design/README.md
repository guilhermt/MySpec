# Design do MySpec

O MySpec é uma mesa de comando para agentes: uma árvore à esquerda diz o que depende de você, e uma conversa no centro é o lugar onde o trabalho acontece. O design serve a essas duas coisas, com a sobriedade de uma ferramenta usada o dia inteiro.

**A identidade.** O tema é o Grafite quente: neutros com um traço de calor, nos dois modos, e um azul elétrico puxado para o cobalto como cor de identidade. A interface é escrita em Fira Sans, e o código, os caminhos e as teclas em Fira Code, sem ligaduras. A densidade tem dois registros: o cromo (a lateral, as barras, os controles) é compacto, em rótulos de uma linha de 12 a 14 px, e a conversa é leitura, em 15 px sobre 22 numa coluna de 960 px.

**A cor é sinal.** Toda cor saturada diz um estado, uma ação ou onde você está: âmbar espera por você, vermelho é erro, verde é encerramento, e o azul marca o que você aciona e onde você está, nunca um estado. Todo estado tem glifo, cor e rótulo, e o nome acessível o diz em texto. Há uma ação primária por tela, a que resolve o que a tela pede. O teclado é visível: o foco tem uma forma que a seleção não tem, e o atalho está escrito ao lado da ação.

**O pixel inteiro.** O app roda no WebKitGTK, que borra o que fica em meio pixel. Todo tamanho é um pixel inteiro, toda largura que depende da janela é arredondada, e cada regra de layout depende da largura do próprio contêiner, de 1100 a 2600 px, sem pontos fixos de janela.

## Os arquivos

- [principles.md](./principles.md): os dez princípios, a régua de toda tela.
- [structure.md](./structure.md): os lugares, a barra lateral, o item aberto, os atalhos, as larguras, os estados de toda tela e os dados.
- [components.md](./components.md): o catálogo, uma entrada por componente, com anatomia, estados, tokens, teclado e acessibilidade.

Os valores estão em `frontend/src/styles/tokens.css`, a fonte única. Como os tokens, o tema e os componentes chegam ao código está em [design-system.md](../architecture/design-system.md).

## Antes de criar ou mudar uma tela

1. **Ache a entrada.** Cada componente que a mudança toca tem uma entrada em [components.md](./components.md), com o arquivo dele no título. Siga a anatomia, os estados, os tokens, o teclado e a acessibilidade dela. Um componente que não está no catálogo entra nele no mesmo trabalho, com as mesmas partes, e só existe se nenhum outro já diz a mesma coisa.
2. **Use só o system.** Uma tela monta componentes de `frontend/src/components/system/` e ícones de `ICONS`, nunca de `components/ui/` nem do `lucide-react`. Um comportamento que o system não tem é um wrapper novo no system, não uma exceção na feature.
3. **Tokens pelo nome.** Cor, tamanho de texto, espaço, raio, sombra, duração e curva vêm dos tokens, pelo nome (`bg-surface-2`, `text-(length:--text-meta) leading-(--leading-meta)`, `duration-(--duration-fast)`). Um valor que não existe é um token novo em `tokens.css`, nunca um número solto.
4. **Todo estado com glifo, cor e rótulo.** Nenhum estado depende só da cor, e só o que está em curso se move. O que bloqueia sem ser uma situação é `◇`, nunca vermelho.
5. **Os estados de tela.** Um estado novo de tela (início, vazio, primeira leitura, falha de leitura, muitos itens, item que saiu) segue [structure.md](./structure.md) §7, Estados de toda tela.
6. **Prova e nome.** O que é novo tem prova pintada (`*.painted.test.tsx`: os estados, os tokens resolvidos, o pixel inteiro, a primária única) e nome acessível encontrado por `getByRole`; uma tela nova entra na varredura de largura com a sua cena ([testing.md](../guidelines/testing.md)).

## O que fecha a porta

Em todo `task check`, o Biome recusa uma tela que importa de `components/ui/` ou um ícone fora de `ICONS` (`noRestrictedImports`), e `frontend/src/styles/design-rules.test.ts` recusa uma cor literal ou da paleta do Tailwind, uma classe de cor do shadcn fora da ponte, um tamanho de texto do Tailwind e uma classe de movimento do Tailwind. `styles/globals.test.tsx` falha quando um token deixa de ser um pixel inteiro. O `knip` recusa o componente que nada usa. A varredura de largura, na CI, desenha cada tela nas janelas do app e nos dois temas e confere o pixel inteiro, os tooltips do que corta, a primária única e os nomes.

Uma revisão de design, quando pedida, é do agente `design-critic`, que confere uma mudança contra esta pasta.
