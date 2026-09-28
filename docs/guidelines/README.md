# Guidelines para trabalhar neste repositório

Este é o ponto de entrada para quem vai mudar o código, pessoa ou agente. Ele diz o que ler, como uma mudança acontece do começo ao fim, e o que nunca fazer. As convenções de cada linguagem estão em [go.md](./go.md) e [frontend.md](./frontend.md); os testes, em [testing.md](./testing.md).

## Antes de mudar qualquer coisa

1. Leia [product/features.md](../product/features.md) para saber o que o produto faz, e [architecture/overview.md](../architecture/overview.md) para saber onde cada coisa está e como as partes se falam.
2. Leia o código em volta do que vai mudar. O padrão do projeto é o que o código já faz; quando dois arquivos discordam, o mais recente e o mais testado é o padrão.
3. Se a mudança faz parte de uma task planejada, o tech spec dela é a fonte de verdade: cada decisão técnica já foi tomada lá. Uma dúvida que o spec não resolve é uma pergunta para o usuário, não uma decisão silenciosa.

## Como uma mudança acontece

1. **Uma coisa por vez.** Cada step de um plano é um commit, num único repositório, que deixa o código compilando e os testes verdes.
2. **Do domínio para fora.** Uma feature nova costuma atravessar as camadas na ordem: migration e `store`, pacote de domínio, `flow`, `bindings` e DTOs, `task generate`, `lib/wails.ts` e o mock, store e ações do frontend, componentes. Cada camada tem os seus testes.
3. **Estado derivado.** Antes de guardar um estado novo no banco, pergunte se ele não é derivável do que já existe: dos artefatos no disco, do git, das sessões. O produto deriva tudo que pode.
4. **Regenerar o que é gerado.** Mudou um service, um DTO ou um evento em `internal/bindings`: rode `task generate`. `task bindings:check` falha no CI quando `frontend/bindings` está desatualizado.
5. **Verificar.** `task check` roda tudo que o CI roda: tidy, lint, typecheck, testes Go e web com limiares de cobertura, vulnerabilidades e a checagem dos bindings. Uma mudança está pronta quando `task check` passa por inteiro. Durante o trabalho, `task check:fast` verifica em segundos (testes Go do cache, sem race; só os testes do frontend que a branch alcança; sem cobertura), e os comandos parciais (`task lint:go`, um teste só) são ainda mais estreitos; ver [setup.md](../development/setup.md).
6. **Documentar.** Todo trabalho atualiza a documentação em `docs/` quando o que ela descreve muda: uma feature nova ou um comportamento diferente entra em [features.md](../product/features.md), uma decisão de arquitetura, um pacote novo ou uma mudança na stack entra em `architecture/`, uma convenção nova entra nestas guidelines, um comando ou uma variável nova entra em `development/`. A documentação descreve o estado atual, de forma simples e clara, e nunca a alteração: ao mudar algo, reescreva o trecho para refletir o projeto como ele é agora, sem dizer o que era antes nem o que mudou. Uma mudança não está pronta enquanto a documentação a contradiz. A exceção é [roadmap/](../roadmap/README.md), que guarda as ideias de evolução do produto e é o único lugar que descreve o que ele ainda não é. Documentação em português; interface, código, identificadores e commits em inglês.

## O que nunca fazer

- **Editar à mão `frontend/src/components/ui/` ou `frontend/bindings/`.** O primeiro é código do shadcn, o segundo é gerado. Um componente que precisa de comportamento diferente ganha um wrapper em `components/system/`.
- **Editar uma migration já aplicada.** Toda mudança de schema é um arquivo novo em `internal/store/migrations/`, com o próximo número.
- **Derivar estado no frontend.** O `State` que chega do Go é a verdade; o frontend só o renderiza e guarda estado de interface.
- **Chamar `api` de um componente.** Componentes chamam `store/actions.ts`; o store importa só de `lib/`.
- **Usar um agente para o que um comando faz.** Criar worktrees, ler o git, medir progresso, decidir o próximo step: tudo isso é código determinístico no Go.
- **Commitar a pasta `planning/`.** Ela está no `.gitignore` e fica local.
- **Silenciar um linter sem explicar.** Um `//nolint` exige o linter específico e uma explicação; um `biome-ignore` também.

## Commits

- Assunto no imperativo, dizendo o que a mudança faz: "Add the review strip to the step bar", não "Added" nem "Adding".
- Sem prefixo, sem tag, sem emoji, sem ponto final. Corpo só quando diz algo que o assunto não diz, em uma ou duas frases.
- O assunto descreve a mudança, não o processo: nada de nome de task, número de step, PRD ou tech spec.
- Numa worktree revisada por stage, commite exatamente o que está em stage. Nunca `git add -A` nem `git commit -a` nela: o que está fora do índice foi deixado de fora de propósito. Um step revisado por um agente não tem stage, e o commit leva tudo o que mudou.

## Pull requests

Uma branch por task, pull request para `main`, CI verde. O título é uma linha no imperativo; o corpo diz, em poucas linhas, o que a pull request muda no projeto. Sem lista de commits, sem walkthrough arquivo a arquivo, sem seção de testes. O CI comenta a cobertura do Go e do frontend em cada pull request.

## Quando parar e perguntar

Pergunte quando a resposta muda materialmente o trabalho: uma decisão de produto que o spec não cobre, um trade-off técnico real, algo destrutivo fora do escopo. Não pergunte para confirmar o que o spec já decidiu, nem para escolher entre opções equivalentes: decida, diga o que decidiu e siga.
