# Modo de review

## O problema

O review step a step, arquivo por arquivo, com stage no editor e aprovação explícita, é o coração do produto: mudanças pequenas são fáceis de revisar, um desvio aparece cedo, e o usuário garante a qualidade do que entra no repositório. Ele continua sendo o padrão. Mas ele é um gargalo em tasks que não tocam nada crítico: a cada step o agente para, o usuário abre o editor, revisa, dá stage e aprova, para só então o commit acontecer e o próximo step começar. Nessas tasks não faz diferença revisar um bloco pequeno agora ou a task inteira no fim, e a parada a cada step só atrasa.

A ideia é uma escolha de quem revisa cada step: o usuário, como hoje, ou um agente revisor, que fecha o step com o implementador e deixa a task correr até a pull request sem parar. A alternativa mais simples, nenhum review por step e tudo revisado só na pull request, foi considerada e descartada: num plano longo um desvio no segundo step vira base de todos os seguintes, e corrigir no fim custa mais do que o gargalo que se quer tirar.

## Decisões

- **Dois modos: Manual e Agent.** Manual é o fluxo de hoje, sem nenhuma mudança. Agent troca o usuário por um agente revisor no review do step. A diferença é quem revisa, não a existência do review.
- **A escolha é por step, com padrão por task.** Um padrão nas configurações, Manual de fábrica; a task copia o padrão na criação; cada step herda o da task e pode ser trocado na lista de steps enquanto não começou. É o mesmo padrão de modelo e esforço, porque "partes críticas" costumam ser dois ou três steps de uma task, não a task inteira.
- **O revisor é uma conversa própria, uma por step.** Todas as rodadas de um mesmo step acontecem na mesma conversa, como a sessão de review de pull request faz as suas passadas. Um step novo ganha um revisor novo.
- **O produto conduz o loop.** O revisor escreve um relatório; o produto entrega o relatório ao implementador; o implementador ajusta; o produto chama o revisor de novo. Os agentes não se falam diretamente.
- **O revisor roda as verificações do repositório ele mesmo.** "Passou nos testes" é a afirmação do implementador que mais vale conferir.
- **Teto de três rodadas.** Ao estourar, o step cai no modo Manual, e o review passa a ser do usuário, com os relatórios na mão.
- **Divergências do plano são esperadas.** É comum o implementador desviar do planejado por algo que encontrou no código. O revisor julga se a divergência é válida e registra no relatório as que aceitou. Quando não consegue decidir com confiança, pergunta ao usuário.
- **O commit leva tudo o que mudou na worktree.** No modo Manual o stage é o review; no Agent ninguém dá stage, e o prompt de commit diz isso ao agente.
- **A etapa de PR não muda.** O rascunho continua esperando o OK do usuário, e o review de pull request segue com o usuário decidindo item a item.

## O modelo

- **Modo de review**: quem revisa um step. Manual, o usuário; Agent, o agente revisor. Escolhido por step, com padrão na task e nas configurações.
- **Revisor de step**: a conversa que revisa um step no modo Agent, com prompt próprio, aberta na worktree do step.
- **Relatório de review de step**: o artefato de cada passada do revisor. Numerado, com status limpo ou com mudanças, e com as divergências do plano que o revisor aceitou. Fica visível na task, como os relatórios de review de pull request.
- **Rodada**: um relatório com mudanças seguido do ajuste do implementador. Uma pergunta do revisor ao usuário não conta como rodada.

## Escolha do modo

Nas configurações, o padrão do modo de review mora ao lado dos padrões de modelo e esforço, com Manual de fábrica. Na criação da task, ao lado do nome, do contexto inicial e dos modelos por etapa, o usuário escolhe o modo da task. No cabeçalho da task, a escolha vale para os steps ainda não iniciados, como o popover **Models** faz hoje. Na lista de steps, cada step ainda não iniciado mostra o seu modo e pode ser trocado. A escolha congela quando a sessão do step começa.

O modo aparece com os rótulos **Manual** e **Agent**, este com um ícone de robô, na criação, na lista de steps e na barra do step. Numa task One-Shot a implementação é um step só, e a escolha vale para ele do mesmo jeito.

## Um step no modo Agent

O step começa como hoje: worktree limpa, arquivo do step como primeira mensagem, o implementador trabalha e só pergunta quando está genuinamente bloqueado. Quando ele encerra um turno sem nada pendente, o step passa a **em review pelo agente**, e a barra do step mostra a rodada atual. A conversa do revisor fica acessível ao lado da do implementador, como as abas por repositório na etapa de PR.

O revisor abre com o prompt de review de step e recebe o PRD, o tech spec, o arquivo do step, o resumo final do implementador e o diff. Ele confere se o step cumpre o que devia, se atingiu os objetivos, se as divergências do plano são válidas, roda as verificações do repositório e escreve o relatório.

- **Relatório com mudanças**: o produto o envia como mensagem na conversa do implementador, o step volta a **implementando**, e quando o implementador encerra o turno o revisor passa de novo, na mesma conversa.
- **Relatório limpo**: o produto envia o prompt de commit ao implementador, como a aprovação faz hoje, e o step fica **concluído** quando o commit aparece na branch. O próximo step começa sozinho.
- **Três rodadas sem relatório limpo**: o step cai no modo Manual, **aguardando review**, com a worktree como está e os relatórios visíveis. Dali em diante é o fluxo de hoje: stage arquivo a arquivo, **Aprovar** a 100%, commit pelo agente.

Quando o revisor não consegue decidir com confiança sobre uma divergência, ele pergunta pela ferramenta de perguntas estruturadas, na sua conversa. É uma situação que espera pelo usuário, com a mesma visibilidade e notificação das outras; a resposta volta ao revisor, que termina a passada.

Um step em que o implementador não mudou nada não vai ao revisor: vira uma situação que espera pelo usuário, como hoje.

Com o último step commitado, a task entra na etapa de PR, exatamente como é hoje.

## O que atravessa o produto

- **Depende de mim**: as situações novas são a pergunta do revisor, o step que caiu no modo Manual ao estourar o teto e o step sem mudanças. Uma task com todos os steps no modo Agent não espera por ninguém entre o primeiro step e o rascunho da pull request.
- **Prompts**: as configurações passam a listar o prompt de review de step, editável e restaurável como os outros. O prompt de commit passa a dizer, no modo Agent, que o commit leva tudo o que mudou.
- **Modelos e esforço**: o review de step é um tipo de sessão novo, com padrão nas configurações e ajuste por task, congelado quando a sessão do revisor começa.
- **Histórico**: a task arquivada mostra os relatórios de review de step junto dos steps.

## Em aberto

- O conteúdo do prompt de review de step e a estrutura do relatório. O decidido é o que ele recebe, que roda as verificações, o status limpo ou com mudanças e o registro das divergências aceitas.
- O nome e o lugar dos relatórios no diretório de artefatos.
- Se o teto de três rodadas é fixo ou configurável.
- Se o modelo e o esforço do revisor podem ser ajustados por step, como os do implementador, ou só por task.

## Ordem sugerida

Uma única frente. A ideia reaproveita a sessão com prompt, o relatório numerado com status do review de pull request, o envio de mensagens do produto na conversa, o prompt de commit e as situações que esperam pelo usuário. O trabalho está na escolha do modo em três lugares, no loop conduzido pelo produto, no teto com queda para o modo Manual e na conversa do revisor ao lado da do implementador.
