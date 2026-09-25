# Lab

Os mocks da frente de redesenho. Cada mock é uma página HTML autocontida, sem build e sem dependência de rede além de fontes: abre direto no navegador, com dados falsos que parecem reais. Os mocks são versionados; a história das variações não se perde.

## Organização

- `NN-<fase>-<assunto>/`: uma pasta por rodada de propostas, numerada na ordem em que foi criada. Dentro, um arquivo por variação (`a.html`, `b.html`, `c.html`) e um `README.md` que diz o que a rodada explora, o que cada variação tenta e, depois da decisão, qual foi escolhida e por quê.
- `compare.html`: abre variações lado a lado. Recebe os arquivos pela query string: `compare.html?a=03-structure-home/a.html&b=03-structure-home/b.html`.

## Regras

- Um mock mostra a tela num estado realista e denso: várias tasks em andamento, uma situação esperando o usuário, uma sessão rodando. Um mock com dois itens e nenhum problema não permite julgar nada.
- Os estados importam tanto quanto o estado feliz: vazio, carregando, erro, aguardando o usuário, muitos itens. Uma rodada de tela cobre os estados principais dela.
- Cada variação tenta uma ideia diferente, nomeada no `README.md` da rodada. Duas variações que diferem só em detalhe são uma variação.
- Wireframes de estrutura são em escala de cinza, sem ícones decorativos, sem tipografia final. Mocks visuais usam os tokens de `../system/` quando eles existem.
- O texto da interface é em inglês, como no produto.

## Servir

Os mocks abrem por `file://`. Para comparar lado a lado e para as fontes carregarem sempre, sirva a pasta:

```sh
python3 -m http.server 8090 -d design/lab
```
