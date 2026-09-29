# Crítica da entrada da task 8 (releitura)

Segunda leitura de `design/tasks/08-chained-publication.md` (505 linhas, 5 steps) e das edições não commitadas em `design/`: `backend.md`, `changes.md`, `decisions.md`, `implementation.md`, `screens/discussion.md` e `screens/rest.md`. A leitura confronta a primeira crítica (L1–L14, substituída por esta) e o código da `main` em `0c783b3`. `design/system/tokens.css` continua idêntico ao da `main`. Citações `08:N` são linhas do material.

**Veredito: Pronto para o card, depois de duas edições de uma linha, com a decisão escrita abaixo, sem nova leitura.** As 14 lacunas estão fechadas. D16 foi reescrita como a regra de hoje, fechada, e deixou de desdizer o usuário.

## As 14, item a item

| # | Situação |
|---|---|
| L1 A prova | Fechada. É um ponto de parada operado pelo usuário, com o MySpec instalado fechado e a task pausada, sobre `XDG_DATA_HOME` e `XDG_STATE_HOME` vazios, só com o board `Pessoal` (08:280–300). Os fatos conferem: `task build` gera `bin/myspec` (`Taskfile.yml:46`), o log fica em `state/myspec/myspec.log` (`xdg.go:43–46`) e o cadastro usa o clone encontrado (`features.md:34`). O material diz o que é criado, o que acontece numa falha no meio, como limpar e que o contexto `Discussion` se perde |
| L2 Agrupar | Fechada. `epicMembers` recusa um card de outro épico-rascunho, e a invariante do `due()` está no pronto 3, em `chain_edit_test.go` (08:36, 211, 214) |
| L3 A ordem dos estados | Fechada. `State.Waiting` é a ordem sem as linhas 2 e 9, então a situação fica de pé durante a corrida (08:155; `discussion.md` §8; casos 26 e 29; pronto 4) |
| L4 A fonte única | Fechada. `rest.md` §11 declara ser a fonte única, com uma linha por variante e 61 textos, e `implementation.md` task 11 passou a 61 |
| L5 As variantes | Fechada. A tabela por extenso, com quatro casos e quatro superfícies, está em 08:172–177 e em `discussion.md` §8 |
| L6 "Não vai publicar" | Fechada. A definição pelo fecho está em 08:13 e 117, e o caso transitivo é o 13 |
| L7 O começado só na memória | Fechada. `flow.Decide` recusa com `ErrPublished` (08:184), com o teste no pronto 2 |
| L8 `implementation.md` | Fechada. A linha 195 cita o `memGH` e o ponto de parada; a 196 cita a `0023` |
| L9 Os casos | Fechada. São 29 casos (08:349–377), com o conversa-fechada, as duas falhas antigas e a revisão do agente no pronto 2, e o cabeçalho sem o meio no pronto 7 |
| L10 A `0023` | Fechada. `publish_error = ''`, com o teste com e sem falha (08:38, 273) |
| L11 A revisão do agente | Fechada. O rascunho volta `fresh`, sem decisão, e nada é escrito (08:200) |
| L12 O plano | Fechada. `ErrUntitled` em `userMessages` já no step 1; o step 4 está declarado do tamanho de um G e é revisado sozinho (08:458, 478, 481) |
| L13 As frases | Fechada. O `Waits for` antigo saiu de §6 e a frase de §5.6 foi ajustada. A conta "8 de 10" deixou de importar, porque D16 é a regra de hoje |
| L14 O inventário | Fechada. As mudanças da task 4 foram corrigidas (08:5), o `canPublish` de `makeReview` fica (08:344), a troca de tom é local (§4.3 #17) e o F16 do lado Go entrou em `implementation.md` task 9 |

## D16 reescrita

Agora ela é a regra de `features.md` §Aprovar e publicar. A falha marca o rascunho; o que depende dele pelo fecho espera; os independentes seguem, na corrida seguinte ou quando aprovados depois; o **Retry** de qualquer rascunho limpa todas as falhas. Ela é coerente com `research/interview.md:45`, com `discussion.md` §6, com `changes.md` D16 e com a entrada de `decisions.md`, que registra o descarte da regra de parar tudo. Com isso, a pergunta ao usuário deixou de ser necessária.

Também está coerente com o código: `write` para na primeira falha (`publish.go:324–338`), e a avaliação ao fim da corrida (`publish.go:282`) pega os independentes que sobraram. Uma falha de conta se repete no máximo uma vez por independente, e cada corrida marca um rascunho, então nada entra em laço.

A regra de parar tudo não sobrou em lugar nenhum de `design/`: não há `stopped`, nem `HoldStopped`, nem `the run stopped before it`.

## O que resta

1. **08:451**, o risco "Um ciclo que trava", ainda aponta "o item 14 da tabela". A tabela foi renumerada, e os ciclos agora são os itens 20 a 22. *Edição:* "os itens 20 a 22 da tabela".
2. **08:153** diz que a linha 10 "é o resto". Em `State.Waiting`, que tira as linhas 2 e 9, tomar a linha 10 como padrão daria `ready_to_archive` durante a corrida e no instante antes dela, o contrário dos casos 26 e 29. *Edição, uma frase no fim da 08:155:* "Em `State.Waiting`, a linha 10 vale pela condição dela, todo rascunho no GitHub ou descartado, e nunca como o padrão; sem nenhuma linha, não há situação."

Depois dessas duas edições, a entrada está **pronta para o card**, sem nova leitura.
