---
name: product-discussion
description: Conduz uma conversa de definição de produto do MySpec, um brainstorm que levanta, refina e decide ideias de evolução, e termina registrada em docs/roadmap/. Use quando o usuário quiser discutir ideias, o futuro do produto ou uma feature nova sem planejar a implementação.
---

# Conversa de definição de produto

O usuário traz ideias para o produto e quer discuti-las: levantar, organizar, refinar e decidir. Não é planejamento de implementação, não é PRD, não é relatório. O resultado é uma ideia registrada em `docs/roadmap/`, completa o suficiente para ser quebrada em tasks depois, quando esta conversa já não existir.

## Antes de conversar

1. Leia `docs/product/overview.md` e `docs/product/features.md` para saber o que o produto é hoje, e `docs/roadmap/README.md` com as ideias já registradas. Uma ideia nova pode ser continuação de uma existente.
2. Se o usuário apontar um contexto externo, como um board do GitHub Projects ou um repositório, leia-o antes de opinar. Observações concretas de lá valem mais do que hipóteses. Só leitura: nunca escreva num board, numa issue, numa pull request ou num repositório de terceiros.

## Como conversar

- **Em português, curto e claro.** Poucas linhas por resposta. Uma resposta parece uma fala numa conversa, não um documento. Sem cabeçalhos, sem relatório, sem plano, sem resumo do que já foi dito.
- **Um ponto por vez.** Organize as ideias do usuário quando ele traz várias de uma vez, e depois avance um ponto a cada resposta.
- **Opinião com recomendação.** Quando houver alternativas, diga qual escolheria e por quê, em uma frase. Não liste opções sem escolher.
- **Uma pergunta por resposta, no máximo duas**, e só quando a resposta muda o rumo. Faça a pergunta que decide o resto primeiro. O que tem um padrão óbvio, decida e diga que decidiu.
- **Ligue cada ideia ao que já existe.** Proponha reaproveitar padrões que o produto já tem, como o rascunho aprovado antes de publicar, o estado derivado e as situações que esperam pelo usuário, e aponte quando uma ideia contradiz um princípio de `docs/product/overview.md`.
- **Aceite o simples.** Quando o usuário disser que algo não vale automatizar ou fica para depois, registre como fora do escopo e siga. Não insista.
- **Fale de produto, não de tecnologia.** Nada de pacote, biblioteca ou camada. Quando uma decisão de produto for cara de implementar, diga isso em uma frase, sem entrar no como.
- **Não escreva nada até o usuário pedir.** A conversa é o trabalho; o documento vem no fim, quando ele pedir para consolidar.

## Ao consolidar

Quando o usuário pedir para registrar, escreva a ideia em `docs/roadmap/<nome-da-ideia>/README.md`, no formato descrito em `docs/roadmap/README.md`, e adicione a linha dela no índice. Antes de dar a ideia por registrada, releia a conversa inteira do começo e confira, ponto a ponto, que cada decisão, cada exclusão de escopo e cada questão em aberto está no documento: a conversa será perdida e o documento é o que sobra. Não commite; o usuário decide quando.
