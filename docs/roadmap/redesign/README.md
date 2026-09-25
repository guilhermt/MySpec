# Redesenho da experiência

## O problema

O produto cresceu feature a feature até centralizar o trabalho diário do usuário, e as features funcionam bem. A experiência não acompanhou: a interface é genérica, feita de componentes simples encaixados um a um, sem uma linguagem visual própria nem uma estrutura pensada com o todo em mente. O princípio "a experiência é o produto" está escrito, mas o produto não o cumpre.

A ideia é repensar a experiência inteira, com o padrão de um produto profissional de gerenciamento de agentes e workflows de IA: estrutura, navegação, hierarquia da informação, linguagem visual e design system consistentes, sobre as features que já existem. Não é uma repaginada dos componentes; é o produto redesenhado a partir de um entendimento profundo de tudo que ele faz e de como é usá-lo todo dia.

## Decisões

- A frente é conduzida fora do MySpec, em sessões de Claude Code com papéis de pesquisador, designer e crítico, e o usuário como diretor de design que decide olhando mocks. Design é trabalho divergente, e o MySpec é feito para trabalho convergente.
- A estrutura é decidida antes do visual: brief, arquitetura de informação, fundação visual e só então as telas. Sem isso o resultado seria uma repaginada.
- Tudo vive em arquivo, na pasta `design/` do repositório, porque a frente atravessa muitas sessões sem memória.
- A implementação de cada tela decidida é uma task normal do MySpec. Mudanças de backend que a experiência pedir, como um dado ou um status que a tela precisa mostrar, entram na task da tela.

## O modelo

- **Brief**: quem usa, as jornadas, o modelo mental, o que precisa estar visível de longe.
- **Estrutura**: a arquitetura de informação e o modelo de navegação.
- **Design system**: princípios, tokens, componentes e regras de uso, a régua de consistência de todo o produto.
- **Rodada**: um conjunto de variações de mock sobre uma mesma pergunta, criticado e decidido.

## Fora do escopo por enquanto

- Um modo de design dentro do próprio MySpec. Se o processo se provar, ele pode virar um modo depois.
- Features novas. A frente melhora a experiência das features atuais; ideias de feature que surgirem no caminho viram ideias próprias do roadmap.

## Em aberto

- O brief, a estrutura e a linguagem visual: tudo o que a frente vai decidir, registrado em `design/`.

## Ordem sugerida

Brief primeiro, com o levantamento do produto e uma entrevista curta com o usuário. O processo, os papéis e o estado atual estão em [design/README.md](../../../design/README.md).
