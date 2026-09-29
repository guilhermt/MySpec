# Crítica do material de entrada da task 6 · Centro de review e tela de um review (releitura)

Releitura de `design/tasks/06-review.md` (579 linhas, 14 steps) e das edições não commitadas em `design/`, depois das correções da primeira crítica: L1 a L15, os ajustes pequenos e a §10. A régua é `implementation.md:18`, e o código é o da task 4 em `3fb42e1` (`myspec-review-71`). `design/system/tokens.css` continua idêntico ao da `main`.

## Veredito

**Pronto para o card.** As quinze lacunas e os ajustes da primeira leitura estão resolvidos no material, com a decisão escrita, e foram levados aos documentos de `design/` a que pertencem. Nenhuma edição de uma linha ficou pendente.

## O que foi conferido, item a item

| # | Lacuna | Onde está resolvida |
|---|---|---|
| L1 | As três horas | A `0021` ganha `recorded_at`, `checks_read_at` e `sent_at` (06:413, step 1); `Details` e a página que saiu usam essas colunas; uma passada anterior à task fica sem hora |
| L2 | A hora das falhas e o prefixo | A primeira falha da sequência para `failedAt` e `checkErrorAt` (06:104, 06:238, 06:418–419); a mensagem sem `pulls: `; as cenas ficam coerentes |
| L3 | O corpo exigido pelo GitHub | A prova numa PR real no step 3, com o corpo mínimo decidido (06:329, 06:422), registrado em `decisions.md:7` e em `backend.md` P47; o pronto 11 publica só com inline |
| L4 | `GonePage`, `Pill` e a idade da leitura | `GonePage` ganha `description` e `children`, e `Pill` ganha `idle`, no step 6 (06:489); a idade da leitura entra no escopo da task 5 (`implementation.md:94`), com o step 6 da 6 movendo-a se a 5 a deixar no board (06:488, 06:524) |
| L5 | A query GraphQL | Os campos só da lista em `listRepository`, os aliases, cerca de 75 pontos (06:389, 06:416–417, 06:534) |
| L6 | `Ctrl+Enter` | `Ctrl ↵` em `ready_to_publish` e em `publish_failed`; nada em `awaiting_decision` (06:286–287) |
| L7 | O step que usava o que ainda não existia | **Next to decide**, `Alt+↓`/`Alt+↑` e o alvo `finding` nascem no step 13; do 11 ao 13, a chegada vai à barra (06:535, 06:570–572) |
| L8 | As razões de **Review again…** | As razões de `canReviewAgain`; `being published` sai (06:224, 06:286) |
| L9 | As palavras da barra e da árvore | `Waiting for the report` em todo lugar; `Conflict with base` pelo `troubleLabel`; `Ready to merge` como exceção ao lugar da barra (06:276, 06:284, 06:292, 06:379) |
| L10 | Os dados guardados antes da task | A linha `You decided` derivada nas passadas antigas; a releitura que só acha títulos não sobe a revisão (06:249, 06:536) |
| L11 | Os commits novos | Um marco por head novo; a barra sem número quando o commit de referência saiu dos 50 lidos (06:291, 06:417) |
| L12 | A razão dita duas vezes | A faixa não aparece enquanto a barra diz `Pass blocked` pela mesma falha (06:238) |
| L13 | A idade dos checks de um repositório que falhou | No painel, a falha do repositório no lugar da idade (06:172) |
| L14 | `Review changes` sem cena | Provado em `ReviewView.test.tsx`, sem mock (06:28) |
| L15 | O diálogo reaberto depois de uma falha | Traz o veredito e a caixa do resumo da tentativa que falhou (06:332) |

Os ajustes pequenos (o texto da recusa de **Pause**, `Refresh PR` sem leitura, `The summary is empty.`, as recusas do início, o `trim` de `summary_published`, R4, R13 e R15 em `changes.md`, o condicional de `PanelSection`, `Pendente ou revisada`) estão no material. O step 7 foi dividido em dois, e o plano ficou com 14 steps; `implementation.md` registra "o material propõe 14".

A §10 também foi aplicada:
- `review.md` §2.2, §4, §5 e §19;
- `components.md`: Checks do GitHub, Aviso de tecla e Diálogo;
- `structure.md` §5, com `R` e `O`;
- `task.md` §9, com a nota para a task 7;
- `backend.md` P13 e P14.

## Uma opinião, não bloqueante

O corpo mínimo de L3 (`Review with 2 inline comments.`) publica no GitHub, com a conta do usuário, um texto que ele não escreveu. A decisão está registrada como delegação e só vale se o step 3 provar que o GitHub exige o corpo. Quando a prova for feita, vale uma linha ao usuário no relatório do step, porque é o único ponto da task em que o produto escreve no lugar dele.
