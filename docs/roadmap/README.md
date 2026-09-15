# Roadmap

Esta pasta guarda as ideias de evolução do produto: features futuras, mudanças de conceito e direções que ainda não foram planejadas nem implementadas. É a única parte da documentação que descreve o que o produto ainda não é; todo o resto de `docs/` descreve o produto como ele é hoje.

Cada ideia tem a sua pasta, com um `README.md` que a descreve como visão de produto: o problema, as decisões tomadas na discussão, o que fica de fora e o que ainda está em aberto. Uma ideia não é um plano de implementação; ela é a entrada para quebrar o trabalho em tasks e conduzir cada uma por PRD, tech spec e plano. Quando uma ideia é implementada, o que ela descreve passa para `product/` e `architecture/`, e a pasta dela é removida.

## Como uma ideia nasce

Uma ideia é discutida antes de ser escrita, numa conversa de definição de produto conduzida com a skill `product-discussion` do repositório: curta, um ponto por vez, com opinião e recomendação, sem planejamento de implementação. O documento só é escrito quando a conversa chegou a decisões, e é escrito para sobreviver à perda da conversa: tudo o que foi decidido, excluído ou deixado em aberto está nele.

## O documento de uma ideia

O `README.md` de uma ideia é escrito como visão de produto, em português, sem mencionar tecnologia, com estas seções, na ordem, pulando as que não se aplicam:

- **O problema**: o que falta ou incomoda hoje, e o que a ideia passa a cobrir.
- **Contexto externo**: o que a ideia assume de fora do produto, como um board, um processo do time ou uma convenção, com link.
- **Decisões**: cada decisão de produto tomada na conversa, com a razão em uma frase.
- **O modelo**: os conceitos que a ideia introduz ou muda, um por linha, no vocabulário do produto.
- **Uma seção por frente**: o comportamento de cada parte da ideia, do ponto de vista do usuário.
- **Fora do escopo por enquanto**: o que foi discutido e deixado para depois, com a proposta que ficou, para não ser rediscutido do zero.
- **Em aberto**: o que a conversa não decidiu e o PRD de cada frente vai ter que decidir.
- **Ordem sugerida**: por onde começar e por quê.

## Ideias

- [command-center/](./command-center/README.md): o produto como centro de comando do trabalho de um tech lead: boards do GitHub Projects no lugar do workspace, discussões que geram cards e épicos, cards como entrada das tasks e um centro de review de todas as pull requests dos repositórios.
- [one-shot/](./one-shot/README.md): um segundo modo de conduzir uma task, com uma única sessão de planejamento que escreve um único documento e uma implementação em um step só, para tasks que não pedem a estrutura do fluxo padrão.
