# Entrevista do brief

Respostas do usuário às perguntas que os docs e o código não respondem. 2026-09-23.

| Pergunta | Resposta |
| --- | --- |
| Volume em paralelo num dia cheio | 1 a 3 tasks, 1 a 2 reviews de PR, 1 discussão. |
| Foco enquanto o agente trabalha | Vai para outra coisa e volta pela notificação. Usa cada vez mais o modo de review `Agent`. |
| O que confere ao voltar | Os itens que dependem dele. A cor de status na árvore já basta para ver isso rápido; uma seção que repete esses itens (como "Waiting for you") não ajuda e confunde. |
| Por onde o dia começa | Não tem padrão: às vezes pega uma task do board, às vezes vê o que há para revisar, às vezes inicia uma discussão. |
| Modo de review dos steps | Mais `Agent`. |
| Mais de uma task na tela | Não precisa. Uma por vez basta. |
| Painéis laterais (artefatos, card) | Usa mais fechados. |
| A tela de interação com o agente | Ponto importantíssimo; é o que mais precisa de refino. Não há uma dor específica: no geral ela está amadora. |
| Informação que importa ver | Tempo, sim. Tokens e dólares, não. Preenchimento da janela de contexto em porcentagem, sim. O que o agente está fazendo agora, sim. |
| Janela | Varia: às vezes tela cheia, às vezes ao lado de outra janela. Monitor ultrawide. |
| Settings e History | Raro. |
| Os modos de uso | Três, e são as três coisas para as quais ele abre o app: discussão, implementação e revisão. |

## O que isso decide

- A árvore da barra lateral com status por cor é o mecanismo principal de "depende de mim"; a seção "Waiting for you" não deve existir como repetição. Notificação continua sendo o que traz o usuário de volta.
- O volume é baixo: uma visão agregada em tabela não se justifica; a árvore precisa ser excelente, não substituída.
- A conversa com o agente é a tela central do redesenho.
- Uma task por vez na área principal; painéis auxiliares fechados por padrão, com abertura fácil.
- Tempo, porcentagem de contexto e atividade atual do agente entram na estrutura; custo fica de fora.
- A interface precisa funcionar em duas larguras: tela cheia num ultrawide e metade dele.
- Settings e History ficam fora do caminho principal.
- O app tem três modos de uso, discussão, implementação e revisão, e a estrutura pode se organizar em torno deles.

## Respostas sobre o centro de review (2026-09-24)

| Pergunta | Resposta |
| --- | --- |
| Um review feito só como consulta deve poder deixar de esperar pelo usuário sem publicar? | Não. Idealmente todo review é publicado. |
| Onde olha o código ao decidir um apontamento? | Geralmente no GitHub (`Files changed`), às vezes só pelo texto do apontamento. |
| O que o faz escolher uma PR na lista? | Nada especial. |

O que isso decide: o review continua esperando pelo usuário até publicar; o cartão de apontamento não precisa de trecho do diff, e a localização abre no GitHub como primeira opção; a linha da PR fica mínima.

## Respostas sobre a discussão (2026-09-24)

| Pergunta | Resposta |
| --- | --- |
| Aprovar um card deve continuar publicando na hora? | Sim, como hoje: um card aprovado sem dependência é publicado direto. Um card que depende do épico ou de outro card espera o que ele depende ser criado primeiro. |
| O que lê antes de aprovar um rascunho? | Tudo: revisa o rascunho inteiro. |
| O documento da discussão | Não lê. Serve de contexto para o agente; ele revisa só o card. |
| Várias rodadas de cards na mesma discussão | Não é o caso mais comum (o normal é uma rodada), mas vai acontecer de novo; não é exceção única. |

O que isso decide: a publicação ao aprovar fica (variação b da rodada 13), com a ordem das dependências respeitada; o cartão do rascunho mostra o corpo inteiro legível, não um resumo; o documento fica atrás de um clique, sem destaque; várias rodadas são um caso normal, sem ser o principal.

## Respostas sobre History e o filtro (2026-09-24)

| Pergunta | Resposta |
| --- | --- |
| Para que abre o History? | Quase nunca abre. |
| Usa o filtro por repositório? | Sim, é útil. |

O que isso decide: o History é a lista mais simples possível, uma organização só, sem trabalho além do necessário; o filtro por repositório continua na árvore e vale também para o History.
