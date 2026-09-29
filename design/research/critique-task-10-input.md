# Crítica da entrada da task 10 (releitura)

Segunda leitura de `design/tasks/10-settings.md` (591 linhas, 12 steps em 13 commits) e das edições da task 10 em `design/`, na worktree `design-inputs`. Os documentos lidos são `backend.md`, `changes.md`, `decisions.md`, `implementation.md`, `screens/rest.md`, `structure.md` e `system/components.md`. Esta leitura confronta a primeira crítica (L1 a L13, os ajustes, §3 a §10), que ela substitui, e o código da `main` em `f055371`, a base nova do material.

O `design/system/tokens.css` continua sem edição da task. `--col-placeholders` segue só em `components.md` e entra pelo step 10. As citações `10:N` são linhas do material.

**Veredito: Pronto para o card, depois de duas edições de uma linha, com a decisão escrita abaixo, sem nova leitura.** As treze lacunas, os ajustes e os pontos das §3 a §10 estão fechados. Conferi as citações novas em `f055371`:

- `app-store.ts`: 732, 772 e 1093;
- `dto.go`: 10, 58, 852, 1010 e 1058;
- `app.go`: 365–382;
- `flow/pr.go:121`;
- `gh/commands.go:42`;
- `lib/when.ts` `duration`, em `:98`.

## As treze, item a item

| # | Situação |
|---|---|
| L1 O modo de boas-vindas | Fechada. O modo exige nenhum item ativo, e uma discussão ativa de board removido mantém o shell normal (`10:321`, vocabulário em `10:11`) |
| L2 O prazo e a ordem | Fechada. O início não tem prazo total: cada chamada tem o seu `callTimeout`. A ordem é: sonda, banco, leituras, teste dos clones, `attention`, `worktrees` e flows, e só então `ready` (`10:427`, `backend.md` P35) |
| L3 A permissão | Fechada. A sonda do diretório devolve o `errno`, os textos usam os caminhos resolvidos, e o pronto 4 prova o caso real do SQLite e o disco cheio (`10:22`, `10:311–312`) |
| L4 O plano | Fechada. O system é o step 3, com `displayPaths` e `ReadAge`. O início ficou em 4a e 4b. A lista de Prompts entra no 5, abrindo o `PromptPane` de hoje. O token entra no 10, e o pronto 7 acompanha |
| L5 O tema | Fechada. `useApplyTheme` espera o estado. A preferência fica guardada, e `systemDark` vem no retrato do início (`10:296`, `10:435`) |
| L6 `This machine` | Fechada. A checagem roda de novo quando `modelCatalog` muda, e o mapa de `found`, `not_found` e `unknown` está em `10:428` |
| L7 O vazio | Fechada. **Add board** fica sob o texto, e Repositories ganha **Add repository** e **Go to Boards**, pela regra de `components.md` |
| L8 A largura | Fechada. As medidas são 800, 674 e 764 px, com a fórmula que desconta as folgas, os 752 do mock anotados em #28, e a regra de 720 px mantida (`10:104`, `10:119`) |
| L9 `json_valid` | Fechada, com os três casos no pronto 3 (`10:424`) |
| L10 O foco | Fechada. O primeiro cadastro leva o foco ao título da Home; a volta, ao título das boas-vindas; e o alcance do `Enter` no início está dito (`10:102`, `10:315`) |
| L11 `Reading…` e `ReadAge` | Fechada. A forma é `Reading…` em toda parte, e `ReadAge` ganhou `never` e `failed`, criada no step 3 |
| L12 A piscada | Fechada. A área principal só aparece depois de 400 ms (`10:298`) |
| L13 A faixa | Fechada. O esqueleto respeita a faixa guardada (`10:577`) |

Os ajustes estão todos no texto:

- `factory` no esforço só com o modelo de fábrica;
- o nome do chip indisponível e mudado;
- o grupo `aria-busy`;
- **Edit** tracejado lendo;
- **Cancel** e **Browse…** durante o cadastro;
- o `⋯` clonando;
- **Remove board** durante a prévia;
- os nomes curtos;
- `1m 15s`;
- o N do passo dos clones;
- o `Select` fora do rótulo;
- as palavras da Home;
- as oito cenas sem mock;
- o inventário;
- a base.

A frase do board inexistente adotada (`Check the number and that this account can see the project.`) está igual em `rest.md`, `changes.md`, `decisions.md` e `failure.go` (§4.4). As outras pendências das §3 a §10 também fecharam:

- X3, X18 e X19 ganharam o que faltava.
- A §6 ganhou `locations.ts`, `SidebarFooter.tsx` e o par `retry`/`refresh`, que `components.md` Ícones já distingue.
- Em `components.md`, **Copy** é secundário na página, e o `Reading…` da faixa e a regra do vazio batem com o material.
- `rest.md` §15 não cita mais `gh auth status` nem as linhas no frontend.
- `structure.md` §5 tem `Home` e `End`, `←` e `→` e o `Enter` de `owner/name`.
- `implementation.md:18` diz "uma porta livre".
- A ordem nova (a 10 depois da 4 e da 5, em paralelo com a 9) está coerente em `10:5`, em `implementation.md:13` e `:159` e em `decisions.md`.

## O que resta

1. **`implementation.md:160`** diz "G, 9–12 steps (o material propõe 12, com o do início dividido em dois commits)", e a linha 37 da tabela diz `9–12`. Como `implementation.md` define um step como um commit, a task tem 13 (`10:570`). *Edição:* em `:160`, "G, 9–14 steps (o material propõe 13 commits: os 12 steps, com o do início em 4a e 4b)"; na linha 37, `9–14`.
2. **`backend.md:105`** chama P35 de "Médio", mas a linha continua na tabela de backend pequeno, e a contagem (`:138–139`, médio 3, pequeno 50) a soma lá. A definição de `:7` reserva "médio" para uma regra do workflow ou um prompt, o que P35 não é. *Edição:* em `:105`, "Médio, dentro da task 10" passa a "Pequeno no dado e médio no trabalho, dentro da task 10".

Depois dessas duas edições, a entrada está **pronta para o card**, sem nova leitura.
