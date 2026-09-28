# Task 4 · Tela da task II: a conversa, a barra do pedido e o compositor

Material de entrada da quarta task da frente de redesenho, colado como contexto ao criar a task no MySpec (modo **Structured**, review **Agent**). É a task 4 de `design/implementation.md` (§2, linhas 79–89), com os princípios da §1 (9–22) e os riscos da §3 (185–197). Os caminhos de código são relativos a `frontend/src/` quando não dizem outra coisa.

**Base.** A task parte da `main` depois do merge da PR #69 (a task 3, "Tela da task I"). As linhas de código citadas são as da PR #69 (worktree de revisão, `a84c005`); as de `design/` são as da `main` depois deste material. A última migration da base é `internal/store/migrations/0019_task_screen.sql`; a desta task é a `0020`.

Toda decisão de design está tomada neste documento, em `design/screens/task.md`, em `design/structure.md` e em `design/system/components.md` (`implementation.md:18`). O PRD só pergunta ao usuário o que é de produto e que nenhum documento decide; os dois pontos de produto que a task abria (M3 e T26) estão decididos em `decisions.md` (§9).

**Nenhum comportamento de hoje se perde.** Cada controle das entradas que saem (**Retry** do bloco de erro, **Try again** e **Clean and start** do step bloqueado, **Try again** da PR bloqueada, **Open PR** do rascunho, **Resume** e o seletor de modelo do compositor pausado, **Remove** da fila, **Answer**, o campo de **Other…**, **Allow**, **Allow for this session**, **Deny**, as linhas de arquivo de `ReviewStrip` que abrem no VS Code, o link da PR das notas de `PRPane`) tem um lugar novo, dito na §4.2 e provado pelo pronto 9. As mudanças de comportamento são as de `changes.md`.

**Vocabulário.** O do material da task 3 (`tasks/03-task-header.md:11`): "barra" é `RequestBar`, "situação" é o DTO `Situation`, "conversa na tela" é a da aba escolhida ou a do lugar, "conversa anterior" é a de `earlierConversation`. E ainda: "entrada" é um filho do `feed` da conversa (fala, mensagem, grupo, marco, cartão, bloco); "linha de início" é o marco que abre a sessão; "mensagem do produto" é o `UserEntry` com `app: true`; "trecho" é o pedaço da conversa entre duas mensagens do produto que abrem uma rodada; "cartão fixo" é o que a tela desenha no fim da conversa sem ser entrada do transcript (o rascunho da PR, os arquivos mudados, os checks ao vivo).

## 1. Objetivo e critério de pronto

A conversa do lugar atual ganha as entradas decididas na rodada 16, numa coluna de `--measure-conversation` em que tudo tem as mesmas bordas; a barra do pedido passa a dizer as dezessete situações da task, com o foco, a piscada e o anúncio; o compositor fica com os placeholders, as pastilhas, o seletor de modelo e a regra da primária. Os dados que isso pede nascem no Go do domínio para fora: a descrição, a duração, o código de saída e a saída de cada comando, o subagente, o tipo da mensagem do produto, os marcos novos, o retry, quem interrompeu.

**Pronto quando** (`implementation.md:89`), cada item provado como diz:

1. **Bordas.** Um teste pintado (`features/task/TaskView.conversation.painted.test.tsx`, Chromium) monta, com o relógio fixo na hora da cena e dados coerentes com ela (as horas, as esperas dos chips e a worktree das fixtures batem com o mock, a lição da crítica da task 3), as sete cenas de `lab/16-conversation-wide/a.html` (§4.2, As cenas) a 812, 950, 1566 e 2180 px de área principal, claro e escuro, com todos os grupos, comandos e marcos abertos, e confere que toda entrada, bloco, cartão, barra, compositor e aba tem a borda esquerda e a direita da coluna (`--measure-conversation`, ou a área menos `--space-6` de cada lado), em pixel inteiro; grava as capturas, anexadas ao pull request lado a lado com o mock.
2. **Nenhuma hora à vista.** O mesmo teste busca `\b\d{1,2}:\d{2}\b` no texto visível de cada cena, fora de `pre` e `code`, sem hover e sem foco, e não acha nada; com hover numa fala, num marco e num grupo, a hora aparece; todo `article` do `feed` tem a hora no nome acessível.
3. **As situações.** `features/task/request.test.ts` cobre em tabela as dezessete situações da §4.2 (a barra das oito da task 3 e das nove novas) e a barra da outra conversa: forma, glifo, rótulo, lugar, meio, ações, desabilitado com a razão, carregando, e o alvo do foco na chegada; com a task pausada, as da task 3. Um teste pintado das nove cenas de `lab/10-screen-task-minimal/b.html` (`?scene=plan … close`), claro e escuro, a 1566 px, com o relógio fixo, grava a barra e o compositor de cada uma.
4. **Foco, piscada e anúncio.** Testes de componente: `Ctrl+J` e `situation:open` numa task levam o foco ao alvo da tabela da §4.2 (a primeira opção do cartão, **Allow**, a primária da barra, o compositor); a barra e o cartão que nascem com a tela aberta ganham `.situation-flash` por `FLASH_MS` e nada com `prefers-reduced-motion`; o `role="status"` da barra anuncia ao nascer e não anuncia quando o usuário abriu a task.
5. **A conversa abre no fim e nunca sobe sozinha**; fora do fim, a volta ao fim conta o que chegou (`New messages 2`) e diz quem trabalha; teste de `useAutoScroll` e de componente.
6. **Rótulos.** `features/chat/actions.test.ts` rotula em tabela cada ferramenta e cada comando das cenas: com `description`, a descrição e o comando apagado; sem ela, o comando no lugar do rótulo. Numa sessão real, toda ação de Bash com `description` é rotulada por ela (a proporção é a do CLI: 66% a 72% dos Bash, §5.3), conferido pelo implementador numa task de verdade e registrado no pull request.
7. **Comandos e saída.** Testes Go da saída guardada (a cauda no payload, a inteira na tabela, o corte de 64 KiB, o ANSI tirado, o código de saída lido da falha) com respostas reais do CLI gravadas em `internal/claude/testdata`; teste de componente da dobra (cauda, `N more lines above`, **Show all N lines** lendo sob demanda com o brilho e o erro, a falha aberta com o trilho, o comando sem saída sem dobra).
8. **`group.ts`, `transcript.ts` e as funções puras** (`features/chat/conversation.ts`, `markers.ts`, `actions.ts`, `composer.ts`) testados em tabela com os campos novos e com transcripts antigos, sem eles (§4.2, Compatibilidade).
9. **Onde foram as ações e a primária.** `features/task/where-actions-went.test.tsx` (da task 3) ganha uma linha por controle das entradas que saem (a lista do terceiro parágrafo acima) e por estado em que ele aparece hoje; nenhuma linha fica sem lugar. Nas dezessete situações e na task pausada, a tela tem no máximo uma primária, e **Send** com texto é a primária onde a barra não tem uma (`reply`, `plan_invalid`, `findings` em texto, `worktree_unreadable`, `step_empty`, `session_error` de um turno que falhou).
10. **Teclado.** Teste de atalho do percurso da §4.2 (setas, Page Up/Down, Home, End, `→`/`←`, `Enter`, `1`–`9` na pergunta, `1`–`3` na permissão com o foco na entrada ou num botão, `Esc` ao compositor) e da uma parada de Tab da conversa.
11. **`Retry reviewer` reinicia o revisor**: teste de componente de que a barra `session_error` do revisor chama `retry(taskId, "step_review:N")`, e de que, com o revisor de volta sem relatório, a situação passa de `session_error` a `reply` e a barra a `Waiting for reply · Reviewer`, com o foco no compositor, como o fluxo faz hoje (`internal/flow/step_review.go:108, 152–157`). Um `session_error` de um turno que falhou (`turn_error`, processo vivo) não tem **Retry** (§4.2).
12. **Backend.** Testes Go de P5–P11, P38–P41, P12 (quem fez o merge), P46 e M3, e `convert_test.go` com os campos novos; `task generate`, `lib/wails.ts` e `test/wails-mock.ts` com as fixtures das cenas.
13. **Virtualização medida** (§4.2): o script de medição rodado pelo implementador no app, na máquina alvo, com o resultado registrado em `implementation.md` (task 12), com ou sem a virtualização como sobra; não é um teste da suíte.
14. **O que só as cenas não tocam.** Um teste de componente por linha da tabela O lugar sem conversa (§4.2), pelo diálogo de T24 (abre com o foco em **Cancel**, lista as linhas, chama `cleanAndStartStep`), por T25 (enviar pausado chama `resume` e depois `sendMessage`), por T26 (o texto responde a primeira pergunta sem escolha, e o cartão só envia com tudo escolhido), por cartão fixo (arquivos, rascunho, checks ao vivo) e pelo destino do foco quando o que o tinha some (§4.2, O foco depois de uma ação).
15. `task check` verde em todo step; nenhum teste removido sem o do componente que o substitui no mesmo step.
16. **Documentação** da §7 escrita no step de cada área; `sessions.md` diz o que o transcript guarda; `features.md` §Sessões e conversas, §Etapas de planejamento, §Review pelo agente e §Review de pull request reescritos.
17. **Revisão do `design-critic`** na branch contra este material, `screens/task.md`, `components.md` e os mocks, com as divergências corrigidas antes do merge (`implementation.md:21`).

`changes.md`: T2 (o cartão de arquivos e o progresso na barra), T7 (o resto: a barra que aponta a outra conversa), T8–T15, T18–T23, T24–T26, S8 e S9 na task. `backend.md`: P3 (task), P5–P11, P12 (quem fez o merge e quando), P38–P41, P46, **M3**; F5, F6, F21.

## 2. O que ler, na ordem

| # | Documento | O que tirar |
|---|---|---|
| 1 | `design/implementation.md` §1 (9–22), task 3 e 4 (67–89), riscos (185–197), §4 (198–216) | O escopo, o app sempre usável (15), os testes que migram (22), o corte para uma task 4b (191), M3 (209) |
| 2 | `design/decisions.md`: Saída inteira e resposta pelo compositor (5–7), Conversa em 960 px (9–11), Cartões leves (13–15), Stepper e abas (37–39), A tela da task é mínima (41–43), Papéis do azul (49–51) | O que o usuário aprovou: uma borda só, sem hora, sem avatar, comando como bloco de terminal, código cortado em 20 linhas |
| 3 | `design/screens/task.md` §2 (22–32), §6 (129–172), §7 (174–217), §8 (219–243), §10 a conversa anterior (279–287), §11 (325–339), §12 (341–352), §13 (354–374), §14 (376–413), §15 (415–440) | A coluna, as entradas, a barra, o compositor, as cenas, os estados, os atalhos, os dados |
| 4 | `design/structure.md` §3 a conversa, a barra e o compositor (235–301), §5 (343–381), §7 (400–423) | A regra geral e as exceções do único lugar da ação (281–285) |
| 5 | `design/principles.md` 2 (13–33), 6 (59–65), 7 (67–73), 8 (75–87), 9 (89–95), 10 (97–103) | A primária única e o **Send**; o pedido como único objeto contornado; um pedido, um lugar; 280 ms duas vezes; o atalho escrito; pixel inteiro |
| 6 | `design/system/components.md`: estados comuns (18–28), Ícones (78–87), Quem fala (121–129), Troca de lugar (141–147), Botão (151–164), Chip (166–177), Estado vazio de um lugar, Barra do pedido, Compositor, Volta ao fim, A conversa inteira (Entradas, Marco em linha, Dobra de trecho, Grupo de ações, Comando, Bloco de erro, Bloco de código), Cartão de pedido, Cartão neutro, Arquivo mudado, Checks do GitHub, Diálogo | Anatomia, estados, tokens, teclado e acessibilidade de cada peça |
| 7 | `design/system/tokens.css`: medidas (53–57), tamanhos (70–75), `--newmsg-w` e `--key-size` (115), movimento (118–123) | `--measure-conversation`, `--size-ask`, `--size-composer-min`, `--newmsg-w`; a task acrescenta `--size-composer-max` |
| 8 | `design/changes.md` S8, S9 (18–19), T2 (27), T7–T15 (32–40), T18–T26 (43–51); `backend.md` M3 (19), P3 (29), P5–P12 (36–43), P38–P41 (44–47), P46 (48), F5, F6, F21 | O que muda de comportamento e os dados |
| 9 | `design/research/conversation.md` §0 (7–17), §1 (19–86), §2 (88–109), §4 (137–179) | Os fatos do transcript e o volume real; a §5.3 deste material corrige dois números |
| 10 | Mocks, com `python3 -m http.server 8090 -d design/lab`: `16-conversation-wide/a.html` (`?scene=planning`, `running`, `ask`, `long`, `error`, `retrying`, `review`; `?open=all`, `?voice=impl`) e as fontes `src/wide.js` (o renderizador: `outputOf` e `outputHTML` 27–62, `wRow` 65–79, `wGroup` 85–94, `wSpeech`/`wUser`/`wMark`/`wFold` 96–127, `voiceChanged` 128–132, `CODE_KEEP` 148), `src/conv-common.js` (`actRoll` 37–41, `reqCard` 45–53, o teclado 80–160), `src/conv-data.js` (as cenas, 99–267), `src/wide.css`; `16-conversation-wide/components.html` (cada peça em todos os estados); `10-screen-task-minimal/b.html` — as cenas (`SCENES`, 2150–2185), a barra (`askM`, 2445–2462), o compositor (`composerM`, 2465–2488), o vazio dos checks (2426), os arquivos (1015–1024, 2091); `09-screen-task/components.html` (resposta rápida, arquivo mudado, checks) | A referência visual. Onde o mock e este material divergem, vale o material (§4.3) |
| 11 | `docs/product/features.md` (na base) §Etapas de planejamento (334–344), §Pré-condição: worktree limpa (379–381), §Sessão do step (383–387), §Review (402–406), §Aprovação e commit (408–414), §Review pelo agente (416–438), §Rascunho e abertura (448–456), §Review de pull request (458–476), §Encerramento (478–488), §Sessões e conversas (645–661), §Depende de mim (663–681), §Atalhos (759–776); `docs/architecture/sessions.md` §Protocolo (28–38), §Ciclo de vida (48–57) | O comportamento de hoje, que a task preserva salvo onde `changes.md` muda |
| 12 | `docs/guidelines/README.md`, `frontend.md`, `testing.md`; `docs/architecture/design-system.md` §Componentes | Como um step acontece e a suíte de estilo |
| 13 | O código da §5 | O inventário |

## 3. Escopo

**Dentro**, cada item verificável:

1. **Go, do domínio para fora**: P5, P6, P7 (os campos da ação e do subagente), M3 (a saída de cada comando), P38–P41 (o retry, quem interrompeu, a hora da resposta, a % da compactação), P8, P9, P11 (o tipo da mensagem do produto, o prompt que a sessão recebeu, os apontamentos por relatório), P10 (os marcos novos da task), P12 (quem fez o merge e quando), P46 (o stage parcial de um arquivo); DTOs, `task generate`, `lib/wails.ts`, `test/wails-mock.ts`.
2. **`features/chat` inteiro** (§5.1), com as funções puras `conversation.ts`, `actions.ts`, `markers.ts`, `composer.ts`.
3. **A barra do pedido** das nove situações que a task 3 não liga, a barra da outra conversa, o foco na chegada, a piscada e o anúncio em todas as dezessete (`features/task/request.ts`, `TaskRequest.tsx`).
4. **O lugar sem conversa** e os **cartões fixos**: o estado vazio de cada momento, o bloco de erro do step e da PR bloqueados, o vazio dos checks (T15), o cartão de arquivos mudados (T2), o rascunho da PR na conversa, a conversa do review da PR fechada nos estados finais.
5. **`components/system/`**: `PlaceEmpty` (Estado vazio de um lugar) e a variante ao vivo de `ChecksList`; os ícones novos no registro; `--size-composer-max` em `design/system/tokens.css`.
6. **Saem** `AppMessage`, `AssistantMessage`, `ErrorCard`, `Marker`, `PendingMessage`, `UserMessage`, `ActionGroup`, `ActivityIndicator`, `ScrollToBottomButton`, os cartões de hoje, `PlanProblemsNotice`, `StepBlocked`, `PRBlocked`, `ImplementationDone`, e de `PRPane` as notas e os `Waiting`; `ReviewStrip` sai da task (fica em `ReviewView` até a task 6).
7. **A medição da virtualização** e a decisão registrada.
8. **Documentação** da §7.

**Fora**, e a forma provisória de cada um até a task dele:

| O que | Até | Como fica nesta task |
|---|---|---|
| O cartão de apontamentos da PR da task, **Next to decide**, **Apply approved**, `You decided`, `Review 1 revised` (T16, M1) | 7 | Os apontamentos continuam em texto na conversa, como hoje: a barra `findings` é tingida, `Decide findings · PR review`, sem ação, e a resposta vai pelo compositor (§4.2) |
| A tela do review e a da discussão: cabeçalho, barra, painéis, cartões de apontamento e de rascunho, os marcos próprios (`review.md` §5, `discussion.md` §4) | 6, 9 | A conversa delas é a desta task, porque `features/chat` é um só: as entradas, os comandos, os cartões de pergunta e de permissão, a volta ao fim, o compositor. Os marcos `review_started` e `discussion_started` viram a linha de início com o corpo (as instruções da passada, o contexto inicial); `pr_review_written` do review é o marco do relatório com **Open in Reports**. A barra, o foco na chegada (o título, como hoje) e o **Retry** (que elas não têm hoje) ficam como estão |
| A lista dos checks lidos antes de cada passada, guardada (P14) | 6 | O marco `Checks read before pass K` diz a contagem e os que falharam, sem corpo |
| Os diálogos com a prévia nova (X13, X14) | 11 | Os de hoje; o diálogo novo **Clean and start…** (T24) nasce aqui na forma mínima de `components.md` (Diálogo) |
| A virtualização da conversa | 12, se a medição falhar | Sem virtualização; os trechos dobrados não montam o conteúdo (§4.2) |
| O carregando e o erro de **Show N earlier actions** e da dobra de trecho (`components.md`, Grupo de ações, Dobra de trecho) | Quando o transcript for lido por partes | O transcript inteiro está na memória: abrir é imediato, sem esses estados |
| Os textos das notificações (P37) | 11 | Os de hoje |

## 4. Decisões

### 4.1 Já tomadas: o tech spec só detalha

| Decisão | Fonte |
|---|---|
| Uma coluna de 960 px, centrada em pixel inteiro, e tudo nela com as mesmas bordas, a barra, o compositor e as abas incluídos; numa área mais estreita, a área menos `--space-6` de cada lado | `decisions.md:11`; `task.md:28, 131`; `components.md` (A conversa) |
| A fala é texto na página, 15/22, sem cartão, sem avatar; quem fala é uma palavra, escrita quando a voz muda; nenhuma hora à vista | `decisions.md:11`; `task.md:133–139`; `components.md` (Quem fala) |
| Grupos dobrados por padrão, o vivo também; resumo por tipo; últimas seis; subagente aninhado; comando rotulado pela descrição, com a saída dobrada e a falha aberta | `task.md:144–147`; `components.md` (Grupo, Comando) |
| A mensagem do produto e os eventos do workflow são marcos de uma linha que abrem o conteúdo no lugar | `task.md:148–149`; `decisions.md:39, 43` |
| Pergunta e permissão são os únicos blocos contornados; a barra é quieta com **Show** | `task.md:153–155, 197–198`; `principles.md` 6, 7 |
| O bloco de erro não tem botão: a ação é **Retry <quem>** na barra | `task.md:156, 200`; `changes.md` T13 |
| A barra tem uma forma por situação, fala da conversa na tela e aponta a outra (**Go to reviewer**); o único lugar da ação e as três exceções | `task.md:174–217`; `structure.md:246–291` |
| Sem sessão, o compositor sai; o placeholder diz a quem se responde; **Send** primário só com nada mais esperando | `task.md:219–243`; `principles.md:31` |
| A conversa abre no fim, acompanha e nunca sobe sozinha; a volta ao fim conta e diz quem trabalha | `task.md:131, 162` |
| O teclado: um `feed` de `article`s com uma parada de Tab, setas, `→`/`←`, `1`–`9`, `1`–`3`, `Esc` ao compositor | `task.md:166–172` e §13 |
| Os dados de cada peça, o custo de cada um, e M3 decidido (`decisions.md`, 2026-09-28) | `task.md:415–440`; `backend.md`; `implementation.md:85, 209` |

### 4.2 Decisões de design, detalhadas

**A coluna.** `Conversation` rola numa `ScrollArea` do system; dentro, a coluna de `min(--measure-conversation, 100% − 2 × --space-6)`, centrada com `round(down, …, 1px)`, a mesma regra de `COLUMN` (`features/task/TaskView.tsx:32–33`), que a barra (`RequestBar.tsx:39–40`), o compositor e as abas passam a usar também. O `max-w-[58.5rem]` sai destes cinco lugares (`Conversation.tsx:128`, `Composer.tsx:37, 90`, `StepPane.tsx:63`, `PRPane.tsx:53`); as outras ocorrências (painéis, History, Settings) são de outras tasks. `--space-6` acima da primeira entrada, `--space-3` entre as entradas, `--space-4` sob a última. Um esmaecido de `--fade` (máscara de gradiente na área que rola) sob o cabeçalho, sob as abas e acima da barra (ou do compositor, sem barra), como o mock (`b.html:723`). Entre a conversa e a barra, `--space-2`; entre a barra e o compositor, `--space-2`; sob o compositor, `--space-4`.

**O mapa das entradas.** Cada tipo do transcript (`internal/session/transcript.go:15–23`) vira um componente, com todos os estados. "Hover e foco" mostram a hora (`lib/when.ts` `clockTime`) no lugar dito; o nome acessível sempre a tem.

| Entrada (dado) | Componente | Forma e estados |
|---|---|---|
| `assistant` sem `parentToolUseId` | **Fala** | A faixa de quem fala (sempre presente, a palavra visível só quando a voz muda) e o Markdown em 15/22 `--ink-1`. Streaming (`complete` falso): o spinner antes da palavra, que fica visível, e o cursor parado no fim. Interrompida por você (`interruptedBy: user`): `Interrupted by you` numa linha sob o texto, com o ícone `ban`, `--text-meta` `--ink-3`. Interrompida por uma queda (`interruptedBy: crash`): o texto termina onde parou, sem linha; o bloco de erro vem depois. Antiga, `interrupted` sem `interruptedBy`: `Interrupted`. Nome: `Implementer, 14:19`, com `, writing` e `, interrupted by you` |
| `assistant` com `parentToolUseId` | nenhum | A fala de um subagente não é desenhada; ela não muda a voz e não quebra o grupo |
| `user` (`prompt` falso, `app` falso, `pending` falso) | **Mensagem do usuário** | Na coluna, `--surface-user`, raio `--radius-lg`, `You` e a hora (hover, foco) na cabeça, o texto em 15/22 com as quebras, sem Markdown. Nome: `You, 14:28` |
| `user` com `pending` | **Mensagem na fila** | A mesma forma em `--surface-0`, o texto em `--ink-2`, a cabeça `Queued · sends when the turn ends` (com a sessão em erro, `Queued · sends after the retry`; pausada, `Queued · sends when the task resumes`) e **Remove** (fantasma `xs`, tooltip `Remove the message from the queue`, `Removing…`). Nome: `You, queued, sends when the turn ends` |
| `user` com `prompt`, logo depois de `stage_started`, `step_started`, `review_started` ou `discussion_started` | **Linha de início** | Um marco só, com o marcador que a precede (tabela Linhas de início) |
| `user` com `prompt` e `app` (o revisor), logo depois de `step_review_started` | **Mensagem do produto** | `MySpec → Reviewer` e `pass 1 · the step, the PRD, the tech spec and the implementer's answer` (One-Shot: `pass 1 · the One-Shot document and the implementer's answer`); o corpo é a resposta do implementador. O `step_review_started` não é desenhado |
| `user` com `app` | **Mensagem do produto** | Tabela Mensagens do produto |
| `action` | **Comando** dentro de um **grupo** | Seções Grupos e Comandos |
| `question` | **Cartão de pergunta** | Seção Cartões |
| `permission` | **Cartão de permissão** | Seção Cartões |
| `marker` | **Marco em linha** | Tabela Marcos |
| `error` | **Bloco de erro** | `--surface-0`, trilho `--error-rail`, raio `--radius-md`, na coluna: a explicação em 15/22 `--ink-1` e o detalhe (`message`) em mono `--text-micro` `--ink-2`, que rola na horizontal; sem título, sem hora, sem botão. Explicações: `process_exit` `Claude Code stopped unexpectedly.`; `start_failed` `Claude Code couldn't start.`; `not_found` `Claude Code wasn't found on this machine. Install it, or check that claude is on the PATH.`; `not_logged_in` `Claude Code isn't logged in. Run claude in a terminal and log in.`; `turn_error` `The agent couldn't finish the turn.` Nome: `Session error, 14:41`. Um bloco de erro antigo, já resolvido, tem a mesma forma: é história |

A **voz muda** no início, depois de uma mensagem sua, de uma mensagem do produto, de uma linha de início e de uma dobra de trecho; ações, atividade e os outros marcos não a mudam (`src/wide.js:128–132`). As palavras: `Implementer`, `Reviewer`, `PRD agent`, `Tech spec agent`, `Plan agent`, `Planning agent`, `PR agent` (a conversa da PR e a do review dela, `tasks/03-task-header.md:305`), `Reviewer` no review, `Discussion agent` na discussão — os papéis de `features/sidebar/sessions.ts:52–95`.

**Linhas de início** (P9, F5). O marcador de início e a entrada do prompt que o segue viram uma linha só, com o ícone `start`:

| Sessão | Texto · complemento | Abre | Ao pé |
|---|---|---|---|
| PRD, planejamento One-Shot | `PRD started` / `Planning started` · `with the card acme/api#412`, ou `with your description` sem card | O contexto inicial (o `text` da entrada), em Markdown | — |
| Tech spec | `Tech spec started` · `from PRD.md` | O prompt que a sessão recebeu (`sent`, P9) | — |
| Plano | `Plan started` · `from PRD.md and tech-spec.md` | idem | — |
| Step | `Started with` · `steps/03-token-bucket.md` (o `file` do step, F5) | O arquivo do step, lido por `ReadArtifact` ao abrir | **Open in Artifacts** |
| Implementação One-Shot | `Started with` · `one-shot.md` | O documento | **Open in Artifacts** |
| PR | `PR started` · `writes the draft from the branch` | O prompt (`sent`) | — |
| PR review | `PR review started` · `pass 1 · #1284 into dev` | O prompt (`sent`) | — |
| Review (task 6), discussão (task 9) | `Review started` · `pass 1`; `Discussion started` · `with 2 cards` ou `with your description` | As instruções da passada; o contexto inicial | — |

Recomeçada (`restarted`): `PRD restarted`, `Restarted with steps/03-…`. Sem `sent` (sessões antigas de tech spec, plano, PR e PR review), a linha não abre. Um step antigo (`step_started` com `step`) acha o arquivo em `task.steps` pelo número.

**Mensagens do produto** (P8, P11). Um marco com o ícone `product`, `MySpec → <quem>` em 400 e o complemento em `--ink-3`; abre o Markdown enviado (o `text`) num bloco afundado, sem ao pé. O `appKind` e os números vêm do Go (§4.4):

| `appKind` · de onde | Complemento |
|---|---|
| `report` · o relatório entregue ao implementador (`flow/step_review.go:240`) | `Review 1 · 2 findings · round 1 of 3`; sem a contagem, `Review 1 · round 1 of 3` |
| `pass` · a passada seguinte ao revisor (`step_review.go:195`) | `pass 2 · the implementer is done with your last report` |
| `commit` · o prompt de commit (`flow/step.go:797`, `step_review.go:259`, `flow/pr.go:1257`, `reviewflow/apply.go:119`) | Step `Manual` e PR review: `Commit · the staged files`; depois de um relatório limpo: `Commit · every change of the step`; com push (PR review, review): `Commit and push · the staged files` |
| `correction` · a correção do plano (`flow/service.go:111`) | `The plan isn't valid yet · 3 problems · correction 1 of 3` |
| `open` · abrir a PR (`pr.go:1194`) | `Open the pull request · the approved draft` |
| `pr_pass` · a passada seguinte do PR review (`pr.go:825`, `reviewflow/again.go:320`) | `pass 2 · review the pull request again` |
| `apply` · os aprovados do review (`apply.go:44`) | `apply 3 approved findings` |
| sem `appKind` (transcript antigo) | `a message · 1,341 characters` |

`<quem>` é a palavra da conversa: `Implementer`, `Reviewer`, `Plan agent`, `PR agent`.

**Marcos.** A anatomia de `components.md` (Marco em linha): chevron no sulco quando abre, ícone `--icon-sm` `--ink-4`, texto `--ink-2` 500, complemento `--ink-3`, a hora no fim com hover e foco. O que abre é `summary` com `aria-expanded` e parada no percurso; o que não abre é lido, sem foco.

| Marcador (dado) | Ícone | Texto · complemento | Abre · ao pé |
|---|---|---|---|
| `prd_written`, `tech_spec_written`, `one_shot_written` (e `_updated`) | `file` | `Written PRD.md` / `Updated PRD.md`; `tech-spec.md`; `one-shot.md` | O documento, lido ao abrir · **Open in Artifacts** |
| `plan_written`, `plan_updated` | `file` | `Written the plan` · `7 step files` / `Updated the plan` | Não abre |
| `step_review_written` (`pass`, `clean`, `findings` P11) | `file` | `Review 1 written` · `changes · 2 findings`, `changes`, `clean` | O relatório, lido ao abrir · **Open in Details** (abre `Details` com o relatório aberto no lugar) |
| `pr_review_written` (`pass`, `clean` novo) | `file` | `Review 1 written` · `changes` ou `clean`; antigo, sem `clean`, só `Review 1 written` | O relatório · **Open in Details** (task) ou **Open in Reports** (review) |
| `committed` (P10: `sha`, `subject`, `pushed`) | `commit` | `Committed c19f02e` · o assunto; com push, `· pushed to #1284` | Não abre |
| `pr_opened` (`number`, `base`) | `pullRequest` | `Opened #1284` · `into dev` | Não abre |
| `checks_read` (`pass`, `passed`, `total`, `failed[]`, `conflict`) | `checks` | `Checks read before pass 1` · `4 of 5 passed · e2e / rate-limit-burst failed`, `· conflict with dev`; sem checks, `no checks` | Não abre (P14 é da task 6) |
| `compacted` (`percent` P41) | `compact` | `Context compacted` · `at 81%`; sem `percent`, só o texto | Não abre |
| `paused` (P10) | `pause` | `Paused by you` | Não abre |
| `retried` (P38: `attempts`, `reason`) | `retry` | `Retried on its own` · `the API was overloaded · 2 attempts`; sem hora, nem com hover | Não abre |
| `draft_approved` (P10: `title`) | `check` | `You approved the draft` · o título | O rascunho aprovado, lido ao abrir · **Open in Artifacts** |
| `changes_approved` (P10: `files`) | `check` | `You approved the changes` · `3 files staged` | Não abre |
| `plan_invalid` (P10: `problems[]`) | `problem` | `The plan is still invalid` · `3 problems` | A lista dos problemas (`arquivo` em mono · a mensagem) |
| `interrupted` (`interruptedBy`) | `ban` | `Interrupted by you`; antigo, `Interrupted`. Numa queda o Go não o grava | Não abre |
| `step_review_started`, `stage_started`, `step_started` sozinhos (sem a entrada do prompt depois) | `start` | Como a linha de início, sem corpo | Não abre |
| Derivado, sem entrada: o fim da conversa do review da PR com a PR mergeada | `merge` | `Merged #1284 into dev` · `by lnakamura` (P12), a hora do merge com hover | Não abre |
| Derivado: a PR fechada sem merge | `merge` | `Closed #1284 without a merge` | Não abre |

Um marco que abre lendo um artefato mostra, enquanto lê, o brilho na linha, e na falha `Couldn't read PRD.md · Try again` em `--state-error-veil` sob a linha. Um marco que pede algo e nasce com a tela aberta não existe nesta task: os pedidos são a barra e os cartões. **Open in Artifacts** e **Open in Details** abrem o painel com o documento ou o relatório já aberto no lugar da lista; o painel não abre sozinho (S9).

**Grupos.** Ações seguidas de um mesmo turno formam um grupo (`group.ts:25–44`); uma ação de subagente (`parentToolUseId`) entra no grupo do pai e não quebra o grupo; a fala de um subagente é ignorada; o marco `retried` que cai entre duas ações do mesmo grupo não o quebra e vira `↻ retried on its own · 2 attempts` no resumo, sem linha própria. Qualquer outra entrada quebra.

- **Dobrado**, sempre por padrão, o vivo também: uma linha de `--size-control-sm` sem fundo, com o texto na borda e o véu de hover passando `--space-2` para fora: o chevron, `14 actions` em 500, o resumo, a hora de início com hover e foco, e a duração à direita.
- **Resumo por tipo** (`actions.ts`, tabela Categorias): até cinco tipos, do mais frequente ao menos, e entre iguais na ordem da tabela, `Read 8 · Searched 4 · git 2`; os que não cabem contam só em `N actions`. Depois do resumo: `· 1 failed` em `--state-error` quando um comando falhou e nenhum comando seguinte do grupo com o mesmo `target` passou; `· 1 failed, then passed` em `--ink-3` quando todos os que falharam passaram depois; `· 1 stopped` em `--ink-3`; `· 1 waits for your permission` quando uma ação espera a permissão do cartão.
- **Vivo** (uma ação `running` no grupo): no lugar do resumo, o spinner, a descrição da ação em curso em `--ink-2` e o comando em mono `--ink-4` (`11 actions ◌ Run the refill and eviction tests go test ./internal/ratelimit/…`); com um subagente trabalhando, a ação em curso é a do subagente; a duração conta desde o início do grupo, a cada segundo.
- **Aberto**: o bloco `--surface-0`, raio `--radius-md`, na largura da coluna, um comando por linha separado por `--line-1`. Até oito comandos, todos; acima de oito, os seis últimos e, em cima, **Show N earlier actions** (`N` = total − 6), que mostra os outros no lugar. O estado aberto de cada grupo vive enquanto a conversa está montada; um grupo que cresce mantém o estado.
- **Duração**: do início do primeiro comando ao fim do último (`startedAt`, `finishedAt`); sem os dois (transcript antigo), sem duração.
- Nome do grupo: `14 actions, Read 8 · Searched 4 · git 2, 1 failed, started 13:48, 1m 50s`; o vivo, `11 actions, running: Run the refill and eviction tests`.

**Categorias** (o resumo; o executável é o primeiro comando da linha, depois de `cd … &&`, de atribuições `VAR=…`, de `sudo`, `time` e `timeout N`, e antes de um `|`):

| Tipo | Ferramentas | Bash |
|---|---|---|
| `Read` | Read | `cat`, `head`, `tail`, `sed -n`, `nl`, `less`, `wc`, `ls`, `tree`, `stat`, `jq` |
| `Searched` | Grep, Glob | `grep`, `rg`, `find`, `fd`, `ag` |
| `Wrote` | Write, Edit, MultiEdit, NotebookEdit | `cat >`, `cat >>`, `tee`, `sed -i`, `perl -pi`, `python3 -`, `python3 <<`, `mv`, `cp`, `rm`, `mkdir`, `touch`, `chmod`, `patch` |
| `Tests` | — | `go test`, `npm test`, `npm run test`, `pnpm test`, `yarn test`, `vitest`, `jest`, `pytest`, `cargo test`, `bun test`, `task test`, `make test` |
| `Lint` | — | `golangci-lint`, `eslint`, `biome`, `tsc`, `gofmt`, `go vet`, `prettier`, `ruff`, `mypy`, `npm run lint`, `task lint` |
| `Build` | — | `go build`, `npm run build`, `cargo build`, `make`, `task` (os outros alvos) |
| `git` | — | `git` |
| `GitHub` | — | `gh` |
| `Web` | WebFetch, WebSearch | `curl`, `wget` |
| `Delegated` | Agent e `Task` exato | — |
| `Ran` | — | qualquer outro executável |
| `Other` | Skill, `mcp__*`, TodoWrite, `Task` seguido de um sufixo (`TaskCreate`, `TaskUpdate`…), ferramentas desconhecidas | — |

**Comandos.** A linha de `--size-control` do bloco aberto, na grade `--icon-xs | --icon-sm | rótulo | comando | direita` (`src/wide.css:68`, `.wrs`):

- **Rótulo** (P5): com `description`, a descrição em `--ink-2` e depois o comando (o `target`: a primeira linha, agora cortada em 1.000 caracteres no Go) em mono `--text-micro` `--ink-4`, cortado por CSS, com o tooltip do comando inteiro da primeira linha e `· N lines` quando o comando tem mais de uma (`commandLines`). Sem `description` (28% a 34% dos Bash, §5.3), o comando ocupa o lugar do rótulo, em mono `--ink-2`, e nada vem depois. As outras ferramentas: Read `Read` + o caminho; Write `Write` + o caminho; Edit, MultiEdit, NotebookEdit `Edit` + o caminho; Grep `Search` + o padrão; Glob `Find files` + o padrão; WebFetch `Fetch` + a URL; WebSearch `Search the web` + a consulta; Skill `Use skill` + o nome; `mcp__s__t` `Call` + `s · t`; TodoWrite e `Task` com sufixo `Update the task list`; desconhecida, o nome cru.
- **Ícone de estado**: feito, o visto em `--ink-4`; falha, `✕` (`x`) com o rótulo e a direita em `--state-error`; rodando, o spinner, o rótulo em `--ink-1` 500; interrompido, `ban`; esperando a permissão, a ampulheta (`hold`), com o alvo `the command in the card below` no lugar do comando.
- **Direita** (P6), `--text-micro` `--ink-4` tabular: feito, a duração; falha, `exit 1 · 8.2s` (sem o código, `failed · 8.2s`); rodando, o tempo desde o início, a cada segundo, em `--ink-2`; interrompido por você, `stopped`; interrompido por uma queda, `stopped with the session`; esperando, `waits for your permission` em `--ink-2`; transcript antigo sem as horas, nada no feito e `failed` na falha.
- **Duração**: abaixo de 10 s, com um decimal (`0.1s`, `8.2s`); de 10 a 59 s, inteira (`12s`); a partir de um minuto, `duration` de `lib/when.ts` (`1m 52s`, `1h 3m`). A forma sem espaço vale para o grupo, o compositor e os checks.
- **Saída** (M3): têm saída o Bash que imprimiu algo, qualquer ferramenta cujo resultado veio com `is_error` (um Edit com `String not found`, um Read de um arquivo que não existe), e o subagente (o relatório final, abaixo); uma ferramenta que não é Bash e passou não tem dobra. O chevron existe quando `outputLines > 0`. Dobrada por padrão; aberta por padrão numa falha, com o trilho `--error-rail` à esquerda (`src/wide.css:95`, `.wout.bad`). Aberta, é o bloco `--surface-1` com fio `--line-1`, recuado sob o rótulo, e mostra `outputTail`, que é a saída inteira até 16 linhas e as 12 últimas acima disso; com a cauda cortada, em cima, `N more lines above` (`N` = `outputLines` menos as linhas da cauda: 36 linhas dão `24 more lines above` · **Show all 36 lines**) e **Show all M lines** (fantasma `xs`), que lê a saída inteira por `GetActionOutput`: lendo, `Reading the output…` com o brilho no lugar do botão; falha, `Couldn't read the output · Try again` em `--state-error`. Inteira, **Show less**. Mono `--text-micro` `--ink-2`, sem quebra de linha, rola na horizontal, sem ligaduras. Uma saída cortada pelo produto (`outputTruncated`) diz, em cima, `Only the last 64 KiB was kept`. Rodando, a saída não chega (o CLI só a manda no fim): o comando rodando não tem chevron.
- Com saída, a linha é `summary`, nome `Run the rate limit tests: go test ./internal/ratelimit/... -race, exit 1, 8.2s, output`; sem saída, é o `li` com o nome inteiro e parada no percurso.

**Subagente** (P7). A ação Agent ou `Task` é a linha `Delegated · <description>` (sem `description`, `Delegated · <subagent_type>`; sem os dois, `Delegated`) com o ícone `subagent`, o resumo do subagente em sans `--text-micro` `--ink-3` (`44 actions · Read 21 · Searched 14 · GitHub 9`, as mesmas categorias) e a duração; é `summary`, dobrada, e aberta mostra os comandos do subagente recuados sob um fio de `--border` em `--line-2` (`src/wide.css:85`, `.wsubrows`), com **Show N earlier actions** pela mesma regra. No fim da lista, o relatório final do subagente (o `tool_result` do Agent) no bloco de saída, com as mesmas regras de cauda e de **Show all**; a fala do subagente não é desenhada, e o relatório é o que ele concluiu. Um subagente dentro de um subagente entra no primeiro. Um subagente conta como uma ação do grupo, do tipo `Delegated`; as ações dele não contam em `N actions` do grupo. Transcript antigo, sem `parentToolUseId`: as ações do subagente ficam soltas no grupo, como hoje.

**A dobra de trecho.** Os trechos começam nas mensagens do produto de `appKind` `report`, `pass`, `pr_pass`, `apply` e `correction`; o primeiro vai do início à primeira. Um trecho dobra quando não é o último e tem ao menos 12 entradas depois do agrupamento (um grupo é uma entrada); menores ficam abertos. A linha: o ícone `history`, `5 speeches · 71 actions` em `--ink-2` 500 tabular (as falas, contadas por `messageId`, e as ações do trecho, sem as dos subagentes), e em `--ink-3` `from the start · steps/06-throttle-metrics.md` (o complemento da linha de início) ou `from Review 1 · 3 findings · round 1 of 3` (o da mensagem do produto que o abre), com o intervalo `16:12–16:48` só com hover e foco. Aberta, as entradas como eram, na mesma coluna, com `--space-3` acima. Um trecho dobrado não monta o conteúdo. Um trecho só dobra quando a conversa monta: o que deixa de ser o último com a conversa na tela (chegou uma mensagem do produto) fica como está até a próxima montagem, para nada fechar sob o usuário. Nome: `Earlier: 5 speeches and 71 actions, from the start, 16:12 to 16:48`.

**Código longo.** Na conversa (a fala, o corpo de um marco, o de uma mensagem do produto), um bloco de código de mais de 24 linhas mostra as 20 primeiras e um rodapé com fio `--line-1`: **Show all 46 lines** (fantasma `xs`, `aria-expanded`) e `26 more` em `--ink-3`; aberto, **Show less**. Continua rolando na horizontal. A regra vale também durante o streaming, a partir da linha 25, com o número crescendo, para o bloco não encolher quando a fala termina. Fora da conversa (`Artifacts`, `Details`, os prompts), não há corte: `Markdown` ganha `cutCode`, falso por padrão.

**Cartões.**

- **Pergunta** (`question` pendente): o cartão de pedido de `components.md`, sem faixa de cabeçalho. Para cada pergunta, o `header` como etiqueta, a pergunta em `--text-title`/`--leading-title` e as opções numeradas num `radiogroup` (a tecla em mono na coluna de `--key-size`, o título em 500, o trade-off em `--ink-3`), e por último `Other…` (`Write your own answer.`). Com `multiSelect`, as opções são caixas de seleção e as teclas alternam. Ao pé, **Answer** `↵`, primária, tracejada com `Choose an option` (com várias perguntas, `Answer 2 more questions`) até tudo estar escolhido; enviando, as opções desabilitadas e `Sending “Yes, by client IP…”…` com o spinner; falha, `Not sent · <razão>` em `--state-error` e **Answer** de novo. **Other…** leva o foco ao compositor, cujo placeholder passa a `Write your answer to “<header>” and press Enter…`; `Enter` no compositor responde a pergunta com o texto (T26). Escrever no compositor sem **Other…** faz o mesmo (T26): o texto responde a primeira pergunta ainda sem escolha, como o **Other…** dela; o cartão mostra a escolha `Other: <texto>`; numa `multiSelect`, o texto entra como mais uma escolha. Se ainda falta alguma pergunta, o foco volta ao cartão e **Answer** espera; com tudo escolhido, o `Enter` do compositor envia o cartão. Nome: `Question, answer with 1 to 3`.
- **Pergunta respondida** (`allowed`): bloco chapado `--surface-0`, sem anel, sem sombra: o visto, a pergunta em 500 e a resposta em `--ink-2`, uma linha por pergunta; o tooltip da pergunta diz `Answered at 09:19` (P40), ou `Answered` sem a hora. **Cancelada**: o mesmo bloco, sem visto, com `Cancelled before an answer` em `--ink-3`.
- **Permissão** (`permission` pendente): o cartão de pedido; a ferramenta como tag (`displayName` ou `tool`), a `description`, o comando uma vez em mono (Bash), o caminho (Write, Edit, Read) ou o JSON (as outras), a `decisionReason` e `Outside the working directory: <caminho>` em `--ink-3`; os botões **Allow** `1` (primária, a única da tela), **Allow for this session** `2` (só com sugestões e sem `suppressAlwaysAllow`) e **Deny…** com a última tecla (`3`, ou `2` sem a do meio), fantasma. **Deny…** abre no cartão a área de texto `Tell the agent what to do instead (optional)`, com **Deny** (perigoso) e **Cancel**. `defaultToNo`: o foco começa em **Deny…**. **Deny** perigoso fica dentro do cartão, como a confirmação final do gesto: é a exceção que `components.md` (Botão) registra. Enviando, o botão pressionado diz o gerúndio (`Allowing…`, `Allowing for this session…`, `Denying…`) e os outros ficam desabilitados; na falha, `Not sent · <razão>` em `--state-error` no pé do cartão, e os botões voltam. Respondida: chapada como a pergunta, com `Allowed`, `Allowed for this session`, `Denied · <mensagem>` e a hora da resposta no tooltip. **Cancelada** (a pausa ou a queda cancelam o pedido, `internal/session/events.go:396–404`): o bloco chapado, sem visto, com `Cancelled before an answer` em `--ink-3`, como a pergunta cancelada.
- **Pergunta em texto** (F6): com a situação `reply` na conversa na tela, o último bloco (parágrafo ou lista) da última fala completa ganha um fio de `--border-2` em `--state-wait-ring` à esquerda, recuado `--space-3`; sem `reply`, nenhum fio.

**Resposta rápida** (F6, `composer.ts`). Com `reply` na conversa na tela, o último bloco da última fala é lido: opções são rótulos seguidos, `a)`–`h)` (ou `A)`, `(a)`, `**a)**`), ou uma lista numerada `1.`–`8.`, de 2 a 6 itens. Cada opção vira uma pastilha dentro do compositor, acima do texto: a letra ou o número em mono e, depois de ` · `, as primeiras palavras da opção como o agente escreveu, até 48 caracteres cortados numa palavra com `…`, tooltip `Sends “a”`. O clique envia a letra ou o número como mensagem e deixa o rascunho da caixa onde está. Sem opções reconhecidas, nenhuma pastilha. Elas somem quando a situação `reply` some.

**A atividade** (`role="status"`, no fim, só com o turno rodando e a última entrada em silêncio, `ActivityIndicator.tsx:18–31, 41`): o spinner e `Starting session…` sem processo, `Thinking…`, ou, com o retry (P38), `Retrying · attempt 3 of 10 · the API is overloaded · next try in 8s`, a contagem a cada segundo e `retrying now` no zero. As razões do `api_retry`: sobrecarga, `the API is overloaded`; limite, `the rate limit was reached`; 5xx, `the API failed`; conexão ou tempo, `the connection failed`; outra, `the API refused the request`. As mesmas razões no pretérito vão ao marco `retried` (`the API was overloaded`).

**A volta ao fim.** Fora do fim (a regra de `useAutoScroll.ts:4`), o botão flutuante `--surface-3`, `--shadow-float`, largura mínima `--newmsg-w`, centrado em pixel inteiro, `--space-3` acima da barra (ou do compositor): `↓`, `New messages` e o número de entradas que nasceram desde que o usuário saiu do fim (um grupo que cresce conta uma vez), um fio, e com a sessão trabalhando o spinner e `Implementer writing` (texto em streaming) ou `Implementer working`. Sem nada novo e sem trabalho, só `↓` (`Go to the end`). Some no fim. Nome: `New messages: 2. Go to the end. The implementer is writing.`

**O lugar sem conversa** (os `Waiting`, as notas e os blocos de hoje). `PlaceEmpty` (`components.md`, Estado vazio de um lugar) no alto da coluna, ou a atividade:

| Momento | Na coluna | Compositor |
|---|---|---|
| Step `not_started` | A atividade `Starting step 5…` (One-Shot, `Starting the implementation…`), no lugar do `Starting…` de hoje (`StepPane.tsx:76`) | Não |
| Step `preparing` | A atividade da fase, por `stepPhaseLabel` (`step-status.ts:131–142`): `Fetching origin…`, `Creating the worktree…`, `Checking the worktree…`, e sem fase `Preparing the worktree…` (hoje `Preparing…`) | Não |
| Step `done`, antes do próximo | A atividade `Starting the next step…` | Não |
| Step `blocked` | O marco `Step 5 is next` · o título do step (One-Shot, `Implementation is next` · o nome da task; ícone `start`, não abre) e o bloco de erro com a explicação de `blockHint` e o detalhe (`step.block.detail`, as linhas do `git status`). Com `clone_missing`, a faixa de aviso do clone não aparece sob o cabeçalho enquanto a barra diz o bloqueio | Não |
| Todos os steps commitados, antes da PR | `PlaceEmpty`: `Every step is committed` e `7 steps in acme/api. The pull request stage starts next.`; One-Shot, `The implementation is committed` e `acme/api. The pull request stage starts next.` | Não |
| Implementação sem steps | `PlaceEmpty`: `No steps were found` e `The plan has no step files.` | Não |
| PR `preparing` | A atividade `Preparing the pull request…`, como a árvore diz `PR · preparing` (`structure.md:140`); `checking GitHub` fica só para a leitura sem resultado, no brilho | Não |
| PR `blocked` | `PlaceEmpty`: `The pull request stage stopped` e o bloco de erro com `prBlockHint` e o detalhe do `gh` ou do git | Não |
| PR `opening` | A conversa da PR e, no fim, a atividade `Opening the pull request…` | Sim |
| PR `waiting_checks` sem conversa (antes da primeira passada, T15) | `PlaceEmpty`: `The review starts when the checks finish.` e `MySpec reads #1284 every minute. The first pass begins once e2e / chromium and preview-deploy are done.` (os que faltam, pelo nome; sem leitura, `MySpec reads #1284 every minute.`), e os checks ao vivo | Não |
| PR `waiting_checks` com conversa (passada 2 em diante) | A conversa do review e, como cartão fixo, os checks ao vivo | Sim |
| PR `done`, `trouble`, `merged`, `pr_closed` | A conversa do review da PR (`pr_review`), fechada, lida do banco (P42), somente leitura, e no fim a linha derivada `Merged …` ou `Closed …` | Não: a sessão está fechada (`flow/pr.go:797`, `pr_checks.go:124`) |
| PR mergeada ou fechada antes da primeira passada (sem conversa `pr_review`, `pr_checks.go:116–128`) | `PlaceEmpty`: `The pull request was merged before the first review pass.` ou `The pull request was closed without a merge before the first review pass.`, e a linha derivada do merge ou do fechamento | Não |
| PR `closing` | A atividade `Closing the task…` | Não |

**Os checks ao vivo** (T15): a variante ao vivo de `ChecksList`: o cabeçalho `◌ Waiting for checks · 4 of 6 passed` (o círculo tracejado do GitHub; antes da primeira leitura, `checking GitHub` com o brilho) e `checked just now` (a idade de `lib/when.ts`, com a hora exata no tooltip), uma linha por check como na variante de painel da task 3, e nenhum rodapé (o que falta está no texto do `PlaceEmpty`). Sem checks, `No checks`.

**Os cartões fixos**, no fim da conversa, na ordem: as entradas, a linha derivada, o cartão fixo, as mensagens na fila, a atividade. Cada cartão fixo é uma entrada do percurso das setas.

- **Arquivos mudados** (T2): com o step em `awaiting_review`, `in_review`, `ready_to_approve`, `review_failed` (a worktree ilegível, `internal/flow/step.go:190–196`) ou `committing` (e o `commitFailed`), na conversa na tela, nas duas abas; e com a PR em `in_review`, `ready_to_approve` ou `committing`. Cartão neutro (`--surface-2`, `--shadow-xs`, `--radius-lg`), cabeçalho `Changed files · 7`; uma linha por arquivo de `review.files`, na grade de `b.html:1016` (`--icon | --key-size | caminho | estado`): o glifo (visto em `--ink-3` staged; círculo em `--line-deco` nos outros), a letra do git (`A`, `M`, `D`, `R`, `U`) em mono `--ink-3`, o caminho em mono `--text-micro` (`--ink-3` quando staged), que abre o arquivo no VS Code (`openFileInEditor`) com o tooltip `Open <caminho> in VS Code`, e à direita `staged`, `partly staged` (P46) ou `not staged`. Um arquivo apagado não abre, com o tooltip `The file was deleted, so there is nothing to open`. Até 12 linhas; acima, as 12 primeiras e `Show N more files`, como nos grupos. Antes da primeira leitura, três linhas de esqueleto; com o erro de leitura, `Couldn't read the worktree` e a mensagem inteira do git em mono, que hoje está em `ReviewStrip.tsx:92–105`. O progresso fica na barra. Uma parada no percurso: `↑`/`↓` andam pelas linhas e continuam para a entrada anterior ou seguinte nas pontas; `Enter` abre no VS Code.
- **Rascunho da PR**: com a PR em `draft_ready`, e em `awaiting_reply` com `draftAtHand` (`pr-status.ts:95`). Cartão neutro, cabeçalho `Pull request draft` e à direita `into dev` (`prBaseName`); **Title** (input) e **Description** (textarea em mono, de `--size-composer-min` a 18 linhas, redimensionável); a edição fica no store (`usePrDraft`), como hoje (`DraftCard.tsx:24–48`), e a versão nova do agente a substitui. Sem **Open PR**: a ação é **Approve draft** na barra (`draft` ou `reply`). Durante `drafting` e `opening`, o cartão não aparece.
- **Checks ao vivo**: acima.

**O percurso de teclado** (T22). A conversa é `role="feed"`, `aria-label` `Conversation with the implementer`, `aria-busy` durante o streaming; cada entrada é um `article` com nome. Uma parada de Tab: a entrada atual (roving tabindex); ao chegar pelo Tab, a atual é o cartão pendente, senão a última. As entradas do percurso: fala, mensagem, mensagem na fila, grupo, cada comando e **Show N earlier actions** de um grupo aberto, subagente e os comandos dele aberto, marco que abre, dobra, cartão (pergunta, permissão, arquivos, rascunho), bloco de erro. A atividade e o marco que não abre ficam fora.

- `↑`/`↓` vão à entrada anterior e à seguinte; Page Up e Page Down andam dez; Home e End, à primeira e à última; a entrada ganha o foco e entra na vista (`block: nearest`).
- `→` abre e `←` dobra um grupo, um comando com saída, um subagente, um marco que abre, uma dobra; `Enter` e `Space` alternam.
- Tab, dentro da entrada atual, passa pelos controles dela (**Copy**, links, **Show all**, os botões de um cartão); fora dela, sai da conversa.
- No cartão de pergunta, com o foco nele ou na entrada: `1`–`9` escolhem a opção (a última é `Other…`) da pergunta cujo `radiogroup` tem o foco, e com o foco na entrada do cartão, da primeira pergunta sem escolha; as setas andam dentro do `radiogroup` com volta ao início, sem sair do cartão; `Enter` envia quando tudo está escolhido. Na permissão: `1`, `2`, `3` como os botões.
- Num campo do rascunho da PR, as setas e as teclas ficam com o campo e não andam pela conversa.
- `Esc` com o foco na conversa: primeiro o que `useGlobalShortcuts` fecha (o `listbox`, o popover, o `⋯`, o painel, a conversa anterior); sem nada disso, o foco vai ao compositor; sem compositor, nada. No compositor, `Esc` interrompe o turno só com a caixa vazia, para dois `Esc` seguidos da conversa não pararem o agente (T22).

**A barra do pedido na task 4.** A barra das oito situações da task 3 fica como está (`tasks/03-task-header.md` §4.2, A barra na task 3); as nove novas, na mesma coluna e com a mesma anatomia. O lugar é a conversa: `PRD`, `Tech spec`, `Plan`, `Planning`, `Implementer`, `Reviewer`, `PR`, `PR review`; a posição e a passada estão na pílula e não se repetem.

| Situação | Forma | Rótulo · lugar · chip | Meio | Ações | Foco na chegada |
|---|---|---|---|---|---|
| `question` | quieta | `Question` · lugar · chip | com várias, `2 questions` | **Show** (secundário): rola ao cartão e foca a primeira opção | A primeira opção do cartão |
| `permission` | quieta | `Permission` · lugar · chip | — | **Show**: rola ao cartão e foca **Allow** (ou **Deny…** com `defaultToNo`) | **Allow** |
| `reply` | tingida | `Waiting for reply` · lugar · chip | — | Nenhuma; na PR em `awaiting_reply` com `draftAtHand`, **Approve draft** (primária, com as recusas e o `Approving…` de `draft`) | O compositor; com o rascunho à mão, **Approve draft** |
| `session_error` com a sessão parada (`lastError` preenchido: o processo morreu, não começou, sem `claude`, sem login) | erro | `Session error` · lugar · chip | — | **Retry <quem>** (primária, `Retrying…`): `Retry implementer`, `Retry reviewer`, `Retry PRD agent`, `Retry tech spec agent`, `Retry plan agent`, `Retry planning agent`, `Retry PR agent`; chama `retry(taskId, <stage da sessão da situação>)` (P3). Um revisor que volta sem o relatório da passada passa a `reply`, como hoje (`internal/flow/step_review.go:108, 152–157`) | **Retry …** |
| `session_error` de um turno que falhou (`turn_error`, o processo vivo, `lastError` vazio, `internal/attention/derive.go:51`) | erro | `Session error` · lugar · chip | — | Nenhuma: **Retry** não faria nada (`internal/session/service.go:639–664`); a resposta vai pelo compositor | O compositor |
| `step_blocked` | erro | `Step 5 blocked` (One-Shot, `Implementation blocked`) · a razão curta (`worktree not clean`, `fetch failed`, `no base branch`, `path exists`, `branch exists`, `git failed`, `clone missing`) · chip | — | **Clean and start…** (secundário, só em `dirty_worktree`; abre o diálogo de T24), **Change path…** (secundário, só em `clone_missing`; o seletor de pastas), **Try again** (primária, `Checking…`) | **Try again** |
| `worktree_unreadable` | erro | `Can't read worktree` · chip | — (a mensagem inteira está no cartão de arquivos) | Nenhuma: resolve sozinho | A barra (`tabindex="-1"`) |
| `pr_blocked` | erro | `PR blocked` · a razão curta (`gh not installed`, `gh not signed in`, `gh failed`, `git failed`, `no worktree`) · chip | — | **Try again** (primária, `Trying…`) | **Try again** |
| `plan_invalid` | tingida | `Plan still invalid` · chip | `3 problems` | **Show problems** (secundário): rola ao marco `The plan is still invalid` e o abre | O compositor |
| `findings` (PR da task, em texto até a task 7) | tingida | `Decide findings` · `PR review` · chip | — | Nenhuma: a resposta vai pelo compositor | O compositor |

**O diálogo de T24** (`Clean and start…`): mínimo, `alertdialog`, título `Clean the worktree and start step 5?`, o corpo `These changes are thrown away:` e a lista das linhas de `step.block.detail` num bloco afundado em mono (até 12 linhas e `and N more`), a linha apagada `Nothing else in the repository changes.`, e **Cancel** (com o foco) e **Clean and start** (perigoso, `Cleaning…`). Na falha, a razão no rodapé e **Try again**.

**A outra conversa.** A barra fala da conversa na tela. Num step com as duas abas, quando a conversa na tela não tem situação própria e a outra tem uma: a forma "a outra conversa espera", quieta, `● The reviewer waits · Question` (com a palavra curta de `structure.md:104`: `Permission`, `Question`, `Reply`) e o chip, com **Go to reviewer** (secundário, tooltip `Show the reviewer's conversation`), ou, com erro, "a outra conversa falhou", o trilho, `◆ Session error · Reviewer` em `--state-error` 700 e o chip, com **Go to reviewer** (`OtherConversationBar`, `RequestBar.tsx:102–132`). **Go to …** troca a aba e grava a escolha. Com as duas esperando, a barra é a da conversa na tela e a aba de fora diz `waits`. `step_review` e `step_empty` são do step e aparecem nas duas abas.

**Foco, piscada e anúncio**, em todas as dezessete. Numa chegada por `Ctrl+J` ou pela notificação (`openSituation`, `store/app-store.ts:963–985`), o foco vai ao alvo da última coluna (e nas oito da task 3, à primária da barra, ou à primeira ação habilitada), depois que a conversa e a barra estão na tela; sem nenhuma ação habilitada (o `merge` na forma close com **Close task** tracejado pelo clone), à barra (`tabindex="-1"`); a ida por `Alt+←/→` e pelo breadcrumb continua levando ao título. `structure.md:35` diz a mesma regra. Na review e na discussão, até as tasks 6 e 9, o foco na chegada continua no título. A barra e o cartão de pergunta ou de permissão que nascem com a tela aberta ganham `.situation-flash` (`styles/globals.css`, da task 3) por `FLASH_MS`, no véu da gravidade. O `role="status"` da barra diz o rótulo e o lugar com que a situação nasceu (`TaskRequest.tsx:79–87`), o rótulo da forma em que ela nasceu: um step que já nasce pronto anuncia `Approve step 4`, não o `Review step 4` que `request.ts:189` e `:344` fixam hoje.

**O foco depois de uma ação.** Quando o que tinha o foco some porque resolveu a situação (**Answer**, **Allow**, **Deny**, **Retry**, **Try again**, **Clean and start**, **Approve**, **Continue**, **Approve draft**), o foco vai ao compositor, se existe; sem compositor, à entrada atual da conversa, a última; sem conversa, ao título do lugar. Nunca fica no `body`.

**As barras da task 3, o que as notas levavam.** A razão de `checkError` (hoje nas notas de `PRPane.tsx:91–95, 123–127`) vai ao tooltip de `Couldn't confirm the merge`, no meio da barra `merge` e `pr_trouble`; `Review again reads GitHub and turns this into findings of a new pass.` vai ao tooltip de **Review again** na barra `pr_trouble`; o link da PR das notas é o **Open PR** do `⋯`.

**O nome do stepper com as situações novas.** O fragmento de `situationFragment` (`lib/situations.ts:234–238`) omite `in <lugar>` quando o rótulo já o nomeia (`step_blocked`, `worktree_unreadable`, `pr_blocked`, `plan_invalid`: `error: step 5 blocked`), e em `findings` usa o lugar da barra (`waiting for you: decide findings in PR review`).

**O compositor.** A caixa `--surface-input`, borda `--line-3`, raio `--radius-lg`, `--shadow-xs`, na coluna; foco com a borda `--focus` e o halo. As pastilhas no alto (quando há); a textarea em 15/22, de `--size-composer-min` a `--size-composer-max` (15rem, cerca de dez linhas), e depois rola; o rodapé: à esquerda o `ModelChip` da sessão (`features/models/ModelChip.tsx`, da task 3; tooltip `Model of this conversation · from your next message`; salvando, lendo o catálogo e indisponível como o chip); à direita, sem turno, **Send** `↵` (com a caixa vazia, tracejado, com `Write a message` no tooltip); com o turno, `◌ Working · 3m 40s` (`--text-micro` `--ink-3`, desde `turnStartedAt`, a cada segundo) e **Stop** (secundário, `Stopping…`, tooltip `Stop the answer · Esc`), e com texto, **Send** secundário antes dele (tooltip `Queues until the turn ends · Enter`). `Enter` envia, `Shift+Enter` quebra a linha, `Esc` com o turno rodando e a caixa vazia interrompe (hoje interrompe também com texto, `Composer.tsx:74–77`; T22). Enquanto o envio corre, **Send** diz `Sending…` e o texto fica; na falha, o texto fica, e no rodapé `Not sent · <razão>` em `--state-error`, com **Send again**. Rótulo acessível: `Reply to the implementer`.

**Send primário** com texto quando nenhuma outra primária está desenhada na tela, habilitada ou tracejada: **Answer** ou **Allow** de um cartão pendente, a primária da barra (a da barra pausada incluída), **Approve draft**. Com uma delas, **Send** é secundário mesmo com texto. A regra deriva do modelo da barra e dos cartões, não de `useOnScreenSituationId`, e vale para a task, o review e a discussão (`principles.md` 2, `components.md`, Botão). Na task pausada sem barra, **Send** com texto é a primária, e **Resume** fica só no cabeçalho, fantasma: o **Resume** do compositor de hoje sai (T25), e a tela nunca tem dois.

**Placeholders** (`composer.ts`, na primeira linha que vale, de cima para baixo; `<quem>` é `speaker` de `task-session.ts:103`):

| Momento | Placeholder |
|---|---|
| **Other…** escolhido num cartão | `Write your answer to “Limits” and press Enter…` |
| Sessão pausada | `Sending resumes the task…` (T25: `Enter` retoma a sessão e envia) |
| Sessão parada num erro (`lastError`) | `Sending restarts the <quem>'s session…` |
| Turno que falhou (`turn_error`, processo vivo) | `Reply to the <quem> to go on…` |
| Pergunta pendente | `Answer with 1–3, or reply to the <quem>…` (`1–N`, com `N` as opções mais `Other…`; várias perguntas, `Write your answer to “<header da primeira sem escolha>”, or choose above…`); o texto responde a pergunta (T26) |
| Permissão pendente | `Answer with 1–3 above, or queue a message for the <quem>…` |
| Turno rodando | `Queue a message for the <quem>…` |
| Pastilhas | `Answer a or b, or reply to the <quem>…` (`a, b or c`; `1 or 2`) |
| `findings` em texto (task 4) | `Tell the PR agent which findings to apply…` |
| Step em review `Manual` ou sem mudanças | `Ask the implementer for a change…` |
| O resto | `Reply to the <quem>…` |

**Pausada** (T25): o compositor fica (hoje ele dá lugar a `Paused. Resume to keep talking.`, **Resume** e o seletor de modelo, `Composer.tsx:35–48`); enviar chama `resume` e depois `sendMessage`; **Resume** fica no cabeçalho, e o seletor de modelo no rodapé do compositor, como sem pausa.

**As cenas** (o teste pintado do pronto 1), das fixtures de `test/wails-mock.ts` que reproduzem `src/conv-data.js:99–267`: `planning` (o PRD, a linha de início com o card, a pergunta em texto respondida, a estruturada respondida chapada, `yes`, `ok`, a fala com mermaid e tabela, a pergunta em texto com o fio e as pastilhas `a`, `b`); `running` (o implementador do step 3: três grupos dobrados, o vivo, a mensagem do produto `Review 1 · 2 findings · round 1 of 3`, 46 linhas de Go cortadas em 20, a mensagem na fila; com tudo aberto, os comandos, a saída e a falha com a cauda); `ask` (o revisor com a pergunta e a barra quieta; `?voice=impl`, a permissão e `1`); `long` (o step 6: dois trechos dobrados, a mensagem do produto da rodada 2, `Context compacted · at 81%`, a fala em streaming, `New messages 2`); `error` (o revisor: `Retried on its own`, a fala interrompida por você, sua mensagem, o grupo com o comando parado, o bloco de erro, a barra `Retry reviewer`, e na aba do implementador a barra da outra conversa); `retrying` (a atividade do retry); `review` (o PR review na passada 1: a linha de início, `Checks read before pass 1`, 34 ações com o subagente de 44, a fala com código, `Review 1 written · changes`, a barra `Decide findings` em texto — o cartão de apontamentos da cena é da task 7).

**Compatibilidade** com os transcripts guardados sem os campos novos (os payloads são JSON; o campo ausente chega com o valor zero, `transcript.go:287–320`):

| Falta | A tela |
|---|---|
| `description`, `commandLines` | O comando no lugar do rótulo; tooltip só com a primeira linha, cortada em 120 |
| `startedAt`, `finishedAt`, `exitCode` | Sem duração; a falha diz `failed` |
| `outputLines`, `outputTail`, a linha em `action_outputs` | Sem chevron nem dobra, também na falha |
| `parentToolUseId` | As ações do subagente soltas no grupo e a fala dele como fala, como hoje |
| `interruptedBy` | `Interrupted`; o marco antigo de uma queda continua desenhado |
| `appKind` | `MySpec → <quem>` · `a message · N characters` |
| `sent` | A linha de início não abre |
| `answeredAt` | `Answered` sem a hora |
| `percent`, `clean`, `findings` | O marco sem o número |
| Os marcos novos | Não existem: nada a desenhar |

**`ReviewStrip`** sai de `TaskView` (`StepTop`, `TaskView.tsx:39–53`) e de `PRPane` (`:281–289`): a lista vai ao cartão de arquivos e o progresso à barra. O componente e o seu teste ficam para `ReviewView` até a task 6.

**A virtualização.** Não entra: os trechos dobrados não montam o conteúdo, e o volume medido é pequeno (p90 de 102 entradas brutas numa sessão de tech spec, 89 num implementador, `research/conversation.md` §4). No último step, o implementador roda no app, na máquina alvo (WebKitGTK), um script de medição com uma conversa de 1.500 entradas (15 vezes o p90) e três trechos dobrados: a primeira pintura abaixo de 300 ms e uma atualização de streaming no fim abaixo de 16 ms. Não é um teste da suíte, porque um limiar de tempo no Chromium do CI seria instável e não mede o WebKitGTK. Passando, a decisão fica registrada em `implementation.md` (task 12, sem virtualização da conversa); falhando, a virtualização vai para a task 12 com a medida.

### 4.3 Decididas neste material, onde `design/` não decidia ou se contradizia

Registradas nos documentos a que pertencem; o coordenador pode vetar.

| # | Lacuna | Decisão | Onde está |
|---|---|---|---|
| 1 | M3: a forma, o custo, o limite, as ferramentas, o que a tela mostra | A saída inteira, numa tabela própria, lida sob demanda; no payload, a contagem e a cauda que a tela mostra (a saída inteira até 16 linhas, as 12 últimas acima); 64 KiB por comando; o Bash, toda falha de ferramenta e o relatório do subagente. Decidida em `decisions.md` (2026-09-28); as últimas 40 linhas, descartadas | §4.2, §4.4; `backend.md` M3; `implementation.md:85, 209` |
| 2 | O rótulo sem `description` | O comando ocupa o lugar do rótulo, sem repetir nada | §4.2 Comandos; `components.md` (Comando) |
| 3 | As categorias do resumo | A tabela Categorias, até cinco tipos | §4.2 |
| 4 | Quando mostrar `Show N earlier actions`; quando a saída é inteira | Até 8 comandos, todos; acima, os 6 últimos. Até 16 linhas, a saída toda; acima, as 12 últimas; a mesma regra no payload (`outputTail`), para a tela nunca precisar ler a tabela antes de **Show all** | §4.2, §4.4 |
| 5 | Quando um trecho dobra | Não é o último e tem ao menos 12 entradas; as fronteiras são os `appKind` de rodada | §4.2 |
| 6 | O formato da duração | `8.2s` abaixo de 10 s, `12s`, depois `lib/when.ts`; sem espaço, como a task 3, também no retry (`next try in 8s`) | `components.md` (Comando, Entradas); `task.md` §6, §15; `changes.md` T19; `backend.md` P6, P38 |
| 7 | O código cortado durante o streaming | Corta a partir da linha 25, também escrevendo | `components.md` (Bloco de código) |
| 8 | A pergunta sem botão de envio no mock; várias perguntas; `multiSelect` | **Answer** `↵` primária ao pé, tracejada com o que falta; uma seção por pergunta | `components.md` (Cartão de pedido) |
| 9 | **Deny…**, e o perigoso fora de um diálogo | Abre no cartão o texto opcional e **Deny** perigoso, como hoje; o perigoso dentro de um cartão pendente, como confirmação final do gesto, é a exceção registrada em Botão | `components.md` (Botão, Cartão de pedido) |
| 10 | `Not sent` na mensagem do usuário, que não existe quando o envio falha | Fica no compositor, com o texto e **Send again**; a mensagem não tem esse estado | `task.md` §6; `components.md` (Entradas) |
| 11 | "Vinda da fila" no nome acessível | Sai: o produto não guarda que a mensagem passou pela fila | `components.md` (Entradas) |
| 12 | `1 hunk left` sem dado de hunks | `partly staged`, pelo X e Y do `git status` (P46) | `components.md` (Arquivo mudado); `task.md` §6; `backend.md` P46 |
| 13 | O lugar na barra com ou sem a passada (`Question · Reviewer` e `Session error · Reviewer · pass 2`) | Só a conversa; a passada está na pílula | `task.md` §7; `structure.md` §3; `components.md` (Barra do pedido) |
| 14 | O rótulo de `findings` (`Findings to decide` em `task.md`, `Decide findings` em `structure.md:126`) | `Decide findings`, o nome único | `task.md` §7 |
| 15 | `findings` na task 4, sem o cartão da task 7 | A barra tingida sem ação, a resposta pelo compositor | `implementation.md` task 4 |
| 16 | `plan_invalid` com os problemas numa mensagem que fica velha depois da terceira correção | O marco `The plan is still invalid` com os problemas da validação, gravado a cada lista nova, e **Show problems** na barra | `task.md` §6, §7; `structure.md` §3; `backend.md` P10 |
| 17 | **Change path** sem reticências | **Change path…**: abre o seletor, como na faixa de aviso | `task.md` §7; `structure.md` §3 |
| 18 | A PR em `done` e seguintes: a cena `close` com compositor e a task 3 com a conversa do review como anterior | A conversa do review, fechada, na tela, somente leitura, sem compositor, com o marco derivado do merge; `Details` a marca com `now`; sem conversa de review (a PR saiu antes da passada 1), o `PlaceEmpty` | `task.md` §8, §11 |
| 19 | O marco do merge numa sessão fechada | Derivado do estado da PR, não gravado | §4.2 Marcos; `backend.md` P10 |
| 20 | O ícone de cada marco e do subagente (o robô é o modo `Agent`) | `start`, `product`, `commit`, `pullRequest`, `checks`, `compact`, `retry`, `problem`, `ban`, `subagent`, `hold` | `components.md` (Ícones) |
| 21 | O estado vazio de um lugar, listado em `task.md:395` sem anatomia | `PlaceEmpty` | `components.md` (Estado vazio de um lugar) |
| 22 | A linha de início junta ao marcador | Um marco só, tabela Linhas de início; o `step_review_started` some na mensagem do produto | §4.2 |
| 23 | Fechar a dobra e **Show N earlier** carregando | Imediatos: o transcript está na memória | §3, Fora |
| 24 | A fala de um subagente | Não é desenhada; o relatório final dele fica na saída da linha **Delegated**, e as ações dele contam no subagente, não no grupo | §4.2; `changes.md` T9 |
| 25 | O foco na chegada (`structure.md:35` dizia a primeira ação da barra, que em `step_blocked` é **Clean and start…**) | A tabela da barra: a primária, o compositor onde a resposta vai por ele, a barra sem ação habilitada; a review e a discussão ficam no título até as tasks 6 e 9 | `structure.md:35`; `components.md` (Troca de lugar); §4.2 |
| 26 | O critério "90% das ações rotuladas pela descrição" (`implementation.md:89`), impossível com 28% a 34% dos Bash sem ela | Toda ação com `description` é rotulada por ela | `implementation.md:89` |
| 27 | Onde vivem o rascunho e os arquivos | Cartões fixos no fim da conversa, fora do transcript | §4.2 |
| 28 | Divergências do mock | Vale o material em tudo o que ele diz, pela regra de `implementation.md:5`. As conhecidas: a pergunta com **Answer**; o lugar da barra sem a passada; `partly staged`; a duração sem espaço; `findings` em texto nesta task; os placeholders da cena `plan` (`Answer a or b, or reply to the PRD agent…`) e da `ask` na voz do implementador (`Answer with 1–3 above, or queue a message for the implementer…`); Page Up e Page Down andando dez; a cena `close` sem compositor; os checks ao vivo sem rodapé; `Not sent` no compositor, não na mensagem; `Preparing the pull request…` | `implementation.md:5` |
| 29 | Os estados que a crítica da primeira leitura achou sem decisão: o **Retry** de um turno que falhou, o foco depois de uma ação, a regra da primária, a permissão cancelada e enviando, o trecho que deixa de ser o último, a PR que sai antes da passada 1, as teclas com várias perguntas, `checking GitHub` no brilho, o nome do stepper, **Send** vazio, a pastilha com texto, o subagente sem descrição, a One-Shot sem conversa, muitos arquivos, o clone ausente duas vezes, o anúncio, o que as notas levavam | Decididos na §4.2, cada um no parágrafo dele | `research/critique-task-04-input.md` L1–L29 |
| 30 | `Esc` no compositor com o turno rodando (opinião da crítica, L30) | Interrompe só com a caixa vazia: dois `Esc` seguidos da conversa não param o agente | §4.2; `changes.md` T22 |
| 31 | O marco desabilitado de `components.md` (conteúdo descartado por um recomeço) | Não é desenhado nesta task: o recomeço apaga a conversa (`internal/flow/service.go:248`, `step.go:881`) | `components.md` (Marco em linha) |

### 4.4 O que o tech spec toma

- **P5–P7.** `ActionEntry` (`transcript.go:73–79`) ganha `description`, `commandLines`, `startedAt` (a hora em que a entrada ficou completa, em `handleAssistant`, `events.go:207–221`), `finishedAt` (em `handleUser`, `events.go:254–274`), `exitCode` (-1 desconhecido; lido da linha `Exit code N` que abre o `content` de um `tool_result` com `is_error` de um Bash, que é como o CLI o escreve: 103 das 115 falhas medidas) e `parentToolUseId`; `AssistantEntry` ganha `parentToolUseId`. `claude.StreamEvent` passa a ler `parent_tool_use_id` (`protocol.go:91–110`), que `AssistantEvent` e `UserEvent` já leem e o produto descarta (`:119`, `:134`); `commandLimit` passa de 120 a 1.000 (`labels.go:13`).
- **M3.** Migration `0020`: `action_outputs (entry_id TEXT PRIMARY KEY REFERENCES transcript_entries (id) ON DELETE CASCADE, text TEXT NOT NULL, lines INTEGER NOT NULL, truncated INTEGER NOT NULL) STRICT`. `foreign_keys` está ligado (`internal/store/store.go:19`), e a cascata `items` → `sessions` → `transcript_entries` → `action_outputs` fecha; como avisa `0015_items.sql:22–24`, uma migration futura que recrie `transcript_entries` tem de recriar a filha. `UserEvent` lê `tool_use_result`. O que se guarda: do Bash, `stdout` e depois `stderr` (numa falha, o `content` sem a linha `Exit code`); de qualquer outra ferramenta, só o texto de um resultado com `is_error`; do Agent, o texto do `tool_result`, o relatório do subagente. Sem ANSI; acima de 64 KiB, os últimos 64 KiB e `truncated` (o Bash já vem cortado em 30.000 caracteres pelo CLI; o corte importa numa falha de Read, que devolve até 385 mil). O payload ganha `outputLines`, `outputTail` (a saída inteira até 16 linhas, as 12 últimas acima; o corte de 4 KiB conta do fim e cai numa quebra de linha) e `outputTruncated`; `N more lines above` é `outputLines` menos as linhas da cauda. `GetActionOutput(itemId, stage, entryId)` no serviço de cada item, que lê do banco também numa sessão fechada (P42); nada da saída vai no evento `entry` além da cauda. A saída some com a sessão, pela cascata; a conversa de uma discussão fica para sempre no histórico (`research/conversation.md:31`), com mediana de 10 ações.
- **P38–P41.** O resumo da sessão ganha `retryMax`, `retryAt` e `retryReason` nos cinco blocos de sessão dos DTOs, como `pausedAt` na task 3; o marco `retried` é gravado na primeira `message_start` depois de um `api_retry`. `interruptedBy` (`user` quando `interruptReq` foi pedido: **Stop**, **Pause**, **Review myself**, descartar, fechar; `crash` em `processExited`, que deixa de gravar o marco `interrupted`) em `AssistantEntry`, `ActionEntry` e no marco. `QuestionEntry.answeredAt` em `answered` (`service.go:803`). `MarkerEntry.percent` = `preTokens × 100 / contextWindow` quando a janela é conhecida.
- **P8, P9, P11.** `SendFromApp` e `SendCorrection` recebem o tipo e os números (`appKind`, `appPass`, `appRound`, `appCount`), e cada chamador da tabela Mensagens do produto os passa. A entrada do prompt guarda `sent`, o texto que o CLI recebeu, nas sessões de tech spec, plano, PR e PR review (`run.go:325–376`). `StepReport` ganha `findings` (o número de itens da seção **Findings** do relatório, `prompts/defaults/step_review.md:55–62`; `None.` é zero; sem a seção, desconhecido), e o relatório da PR ganha `clean` no marco.
- **P10, P12, P46.** Os marcadores `committed` (gravado antes de fechar as sessões do step, e no commit do PR review), `pr_opened`, `checks_read` (no início de cada passada), `draft_approved`, `changes_approved`, `paused` (em `Pause`, `service.go:593`), `plan_invalid` (quando as correções acabam e a cada lista de problemas diferente da anterior). `PullRequest` ganha `mergedBy` e `mergedAt` (o `gh pr view --json mergedBy,mergedAt`). `ReviewFile` ganha `partial` (`X` e `Y` do `git status` preenchidos, `git/commands.go:122`).
- **Onde moram as funções puras**: `features/chat/conversation.ts` (o agrupamento com o subagente e o `retried`, a linha de início, a voz, os trechos), `actions.ts` (rótulos, categorias, duração, falha recuperada), `markers.ts` (o texto, o ícone e o corpo de cada marco e mensagem do produto), `composer.ts` (placeholder, rótulo, primária, pastilhas, a resposta à pergunta), `features/task/request.ts` (as dezessete situações, a outra conversa, o alvo do foco; as nove novas em funções próprias, que `taskRequestOf` só passa a chamar no step 8, para não aparecerem antes dos botões delas).
- **O foco na chegada** é um pedido no store (`pendingFocus` ganha `request`), consumido por `TaskView` quando a conversa e a barra montaram; o **Show** usa o mesmo caminho.
- **A leitura de um corpo** (documento, relatório, arquivo do step, rascunho) usa `useArtifact` (`features/task/useArtifact.ts`), como os painéis.

## 5. Inventário atual

### 5.1 `features/chat`

| Arquivo | O que é hoje | Destino |
|---|---|---|
| `Conversation.tsx` (1–169) | Coluna de 58.5rem (128), `EntryBlock` (41–78) que esconde o prompt vazio (45–47), grupos, fila, atividade, `readOnly` (da task 3), `ScrollToBottomButton` | Reescrito: a coluna, o `feed`, o percurso, os trechos, os cartões fixos, a volta ao fim |
| `group.ts` (1–45) | Junta ações seguidas do mesmo `turnId` | Reescrito em `conversation.ts` (o nome fica, se o tech spec preferir), com o subagente, o `retried`, a linha de início e os trechos |
| `session.ts` (1–27) | `SessionState`, `IDLE_SESSION` | Ganha `retryMax`, `retryAt`, `retryReason` e `turnStartedAt` |
| `Composer.tsx` (1–133) | Textarea, **Stop**, **Send** de ícone, `PausedNotice` com **Resume** (35–48), `Esc` interrompe (74–77), `ModelPicker` inline (21–33) | Reescrito (§4.2); `PausedNotice` sai (T25); `ModelChip` no lugar de `ModelPicker` |
| `ActivityIndicator.tsx` (1–64) | `Retrying (attempt N)…` (9), `Starting session…`, `Thinking…` com pontos | Sai: a atividade de `conversation.ts` com o spinner e o retry de P38 |
| `ScrollToBottomButton.tsx` (1–35) | `↓` ou `New messages` | Sai: a volta ao fim |
| `useAutoScroll.ts` (1–116) | Segue o fim, `hasNew` | Fica; passa a contar as entradas novas |
| `Markdown.tsx` (1–60) | Streamdown com os temas de código | Ganha `cutCode` e a classe do fio da pergunta em texto |
| `code-theme.ts`, `ExternalLink.tsx` | Tema do código, links | Ficam |
| `entries/AssistantMessage.tsx` (1–22) | Markdown e `Interrupted` | Sai: a fala |
| `entries/UserMessage.tsx` (1–14) | Balão à direita, 85% | Sai: a mensagem do usuário |
| `entries/PendingMessage.tsx` (1–37) | Balão esmaecido, `Queued`, `×` | Sai: a mensagem na fila, com **Remove** |
| `entries/AppMessage.tsx` (1–15) | `MySpec · sent to the agent` e o texto cru | Sai: o marco da mensagem do produto |
| `entries/ActionGroup.tsx` (1–87) | Linha `N actions`, a ação rodando no resumo, lista com rótulo e alvo | Sai: o grupo, o comando, o subagente |
| `entries/Marker.tsx` (1–106) | Linha com fios e a hora visível (92–106), 17 tipos (16–34) | Sai: o marco em linha e a linha de início |
| `entries/ErrorCard.tsx` (1–46) | Título por tipo e **Retry** que segue a sessão do implementador (28, 37–43) | Sai: o bloco de erro; **Retry** vai à barra |
| `entries/QuestionCard.tsx` (1–241) | `A question for you`, rádios, `Other…` em campo, **Answer**, respondida em `header: resposta` | Reescrito: o cartão de pergunta |
| `entries/PermissionCard.tsx` (1–177) | `Permission needed`, **Allow**, **Allow for this session**, **Deny** com texto (154) | Reescrito: o cartão de permissão |

São 15 arquivos de teste em `features/chat` (`PendingMessage` não tem teste); cada um sai com o componente que testa, e os novos nascem no mesmo step.

### 5.2 `features/task` e outros

| Arquivo | Hoje | Destino |
|---|---|---|
| `features/task/TaskView.tsx` (1–181) | `StepTop` com as abas e `ReviewStrip` (39–53); o planejamento com `PlanProblemsNotice`, `TaskRequest` e `Composer` (166–176) | Sem `ReviewStrip` e sem `PlanProblemsNotice`; o foco na chegada |
| `features/task/StepPane.tsx` (1–100) | `Waiting` (15–24), `ImplementationDone`, `StepBlocked`, a conversa da aba | O lugar sem conversa (§4.2) |
| `features/task/PRPane.tsx` (1–341) | `Waiting` (37), `Note` (50), `AwaitingMerge` (82), `Troubled` (109), `Merged` (134), `PRClosedUnmerged` (153), `ClosedSummary` (190), a faixa `Opening the pull request…` (269–280), `ReviewStrip` (281–289), `DraftCard` (262, 290–297) | O lugar sem conversa, a conversa fechada do review, os cartões fixos; `ClosedSummary` sai (a task encerrada vai à página do item que saiu) |
| `features/task/request.ts` (1–507), `TaskRequest.tsx` (1–156) | As oito situações e a pausada; `RequestKind` (85–95) | As dezessete, a outra conversa, o alvo do foco, a piscada |
| `features/task/DraftCard.tsx` (1–91) | O rascunho acima da conversa, com **Open PR** (80–87) | Reescrito como cartão fixo, sem **Open PR** |
| `features/task/StepBlocked.tsx`, `PRBlocked.tsx`, `ImplementationDone.tsx`, `PlanProblemsNotice.tsx` | Os blocos com botões, a nota, os problemas | Saem |
| `features/task/ReviewStrip.tsx` (1–172) | A faixa com a lista e o progresso | Sai da task; fica em `reviews/ReviewView.tsx` |
| `features/task/OrphanPRs.tsx` | O aviso de PR que fica aberta, nos diálogos | Fica |
| `features/task/details.ts`, `DetailsPanel.tsx` | A conversa do review numa PR em `done` como anterior | Com `now` nos estados finais |
| `components/system/RequestBar.tsx` (1–132) | As formas e `OtherConversationBar` | Fica; a piscada por prop |
| `components/system/ChecksList.tsx` | A variante de painel (task 3) | Ganha a variante ao vivo |
| `components/system/Shimmer.tsx:9`, `Shimmer.test.tsx:8–9` | O comentário e o teste com `checking GitHub….` | `checking GitHub`, sem a pontuação dobrada (step 6) |
| `features/task/step-status.ts:131–142` | `stepPhaseLabel` com `Preparing…` sem fase | `Preparing the worktree…` |
| `lib/situations.ts:234–238` | `situationFragment` sempre com `in <lugar>` | Sem o lugar quando o rótulo o nomeia; `PR review` em `findings` |
| `components/system/icons.ts` | O registro | Os ícones de §4.3 #20 |
| `store/app-store.ts` | `pendingFocus` (166–167), `openSituation` (963–985), `onScreenSituation` (1225–1254), `flashing` (216) | O pedido de foco; `onScreenSituation` com a outra conversa |
| `store/transcript.ts` (1–105) | `applyEvent` idempotente | Fica: os campos novos passam inteiros |
| `reviews/ReviewView.tsx`, `discussion/DiscussionView.tsx`, `discussion/ArchivedDiscussionView.tsx` | Leitores de `Conversation` e `Composer` | Recebem a conversa nova sem outra mudança (§3, Fora) |

### 5.3 O transcript: o que existe e o que falta

| Dado | Existe | Falta, e onde nasce no Go |
|---|---|---|
| Envelope: `id`, `seq`, `turnId`, `kind`, `createdAt` | `dto.go:666–681` | — |
| Fala: `messageId`, `text`, `complete`, `interrupted` | `dto.go:571–577` | `parentToolUseId` (P7), `interruptedBy` (P39): `events.go:193–227`, `368–406` |
| Ação: `toolUseId`, `tool`, `label`, `target`, `status` | `dto.go:580–587`; `parent_tool_use_id` já é lido do CLI em `AssistantEvent` e `UserEvent` e descartado | `description`, `commandLines` (P5), `startedAt`, `finishedAt`, `exitCode` (P6), `parentToolUseId` (P7), `interruptedBy`, `outputLines`, `outputTail`, `outputTruncated` (M3): `events.go:164–274`, `labels.go:56–91` |
| A saída inteira de um comando | — | `action_outputs` e `GetActionOutput` (M3). O CLI manda `tool_use_result` com `stdout`, `stderr`, `interrupted` e `noOutputExpected` num Bash que passa, e uma string `Error: Exit code N…` num que falha; o produto lê só `tool_use_id` e `is_error` (`protocol.go:122–156`) |
| Mensagem: `text`, `pending`, `prompt`, `app` | `dto.go:563–568` | `appKind` e os números (P8, P11), `sent` (P9) |
| Pergunta | `dto.go:625–632` | `answeredAt` (P40) |
| Permissão, com `answeredAt` | `dto.go:592–608` | — |
| Marco: `type`, `preTokens`, `stage`, `step`, `pass`, `clean`, `restarted` | `dto.go:635–653` | `percent` (P41), `interruptedBy`, `clean` no `pr_review_written`, os tipos e os campos de P10 e P38 |
| Erro: `kind`, `message`, `retryable` | `dto.go:656–662` | — |
| Retry: `retryAttempt` | Os cinco blocos de sessão (`dto.go:207, 318, 438`) | `retryMax`, `retryAt`, `retryReason` (P38): `events.go:94–96`, `protocol.go:61–67` |
| Relatório de step: `pass`, `file`, `clean` | `dto.go:190–194` | `findings` (P11) |
| Arquivo em review: `path`, `kind`, `staged` | `dto.go:129–135` | `partial` (P46) |
| Quem fez o merge e quando | — | `PullRequest.mergedBy`, `mergedAt` (P12) |

**Volume medido para M3**, em 300 transcripts do Claude Code de sessões em worktrees do produto (implementador, revisor e review de PR, de 15 a 28 de setembro; o script leu `~/.claude/projects`): 8.862 Bash, 66,5% com `description` (a pesquisa mediu 72% em 434 sessões, `research/conversation.md:12`); a saída tem mediana de 29 linhas e 1,5 KB, p90 de 286 linhas e 14 KB, p99 de 739 linhas e 30 KB, e o máximo é 30.151 bytes, porque o próprio CLI corta a saída de um Bash em 30.000 caracteres (o "até 16 MiB por linha" de `backend.md` era o limite do leitor de linhas, não da saída); guardada inteira, com as falhas das outras ferramentas e os relatórios dos subagentes, uma sessão ocupa mediana de 105 KB, p90 de 253 KB e máximo de 1,1 MB; guardar só as últimas 40 linhas daria 30% disso e perderia o começo de 42% das saídas. 42% das saídas de Bash passam de 40 linhas, e 60% passam de 16. 5% dos Bash não imprimem nada; 1,3% falham.

## 6. Riscos e o primeiro step

| Risco | Tratamento |
|---|---|
| **O tamanho da task** (14 steps, no teto de G, `implementation.md:7`) | Se o tech spec passar de 14, os cartões (pergunta e permissão, step 12; o cartão de arquivos do step 13) vão para uma task 4b, com a forma de hoje até ela (os cartões atuais, `ReviewStrip`), como `implementation.md:191` diz, e nada mais é cortado |
| **O protocolo do CLI muda** (`tool_use_result`, `parent_tool_use_id`, a linha `Exit code`) | Os parsers testados contra respostas reais gravadas em `internal/claude/testdata`, uma por forma (Bash que passa, que falha, sem saída, subagente com o relatório, falha de Edit, `api_retry`); o campo ausente cai na forma de compatibilidade, nunca num erro |
| **O percurso de teclado com Markdown livre dentro** | O roving vive nas entradas; os controles internos só entram no Tab com a entrada atual; um teste de atalho por tipo de entrada |
| **A conversa longa sem virtualização** | Os trechos dobrados não montam; a medição do último step decide |
| **A mudança na conversa do review e da discussão** | Os leitores de `Conversation` ganham um teste de fumaça por tela, com uma fixture de cada |
| **A transição entre os steps 7 e 13** | Do step 7 ao 13, o erro da worktree ilegível aparece no meio da barra e na faixa de `ReviewStrip` ao mesmo tempo, e os componentes antigos convivem dentro do `feed` novo; é aceitável dentro da branch, e o step 13 fecha a transição |
| **Os testes com limiar** | Cada step apaga os testes do que remove e escreve os do que cria |

**Como o primeiro step é feito.** É P5, P6 e P7, só em Go: as respostas reais do CLI gravadas em `internal/claude/testdata` (um Bash com `description` que passa, um que falha com `Exit code 1`, um subagente com duas ações), `StreamEvent` lendo `parent_tool_use_id`, `ActionEntry` e `AssistantEntry` com os campos novos, os testes de `internal/session` com os fakes do `claudetest`, os DTOs com `convert_test.go`, `task generate`, `lib/wails.ts` e `test/wails-mock.ts`. Nada na tela muda: a interface de hoje ignora os campos novos.

## 7. Documentação que a task atualiza

| Arquivo | O que muda | Step |
|---|---|---|
| `docs/architecture/sessions.md` §Protocolo, §Ciclo de vida, e uma seção nova "O que o transcript guarda" | `parent_tool_use_id`, `tool_use_result`, a linha `Exit code`, o corte de 30.000 caracteres do CLI; `api_retry`; quem interrompeu; os campos de cada entrada, a saída em `action_outputs` e o tipo da mensagem do produto | 1, 2, 3, 4, 5 |
| `docs/architecture/storage.md` §Banco | `action_outputs` e o aviso da recriação de `transcript_entries`; os payloads de `transcript_entries` | 2 |
| `docs/architecture/overview.md` §O estado que o frontend vê | Os campos novos da sessão e da PR | 3, 5 |
| `docs/architecture/design-system.md` §Componentes | `PlaceEmpty`, `ChecksList` ao vivo, os ícones, `--size-composer-max` | 6 |
| `docs/product/features.md` §Sessões e conversas (645–661) | A coluna, as entradas, os grupos, os comandos com a saída, o subagente e o relatório dele, as mensagens do produto e os marcos, os trechos, o código cortado, a volta ao fim, o compositor pausado e o que ele responde, o retry, a interrupção | 8–12 |
| §Etapas de planejamento (334–344) | A pergunta em texto e as pastilhas; os problemas do plano no marco e na barra | 10, 11 |
| §Pré-condição: worktree limpa (379–381), §Review (402–406), §Aprovação e commit (408–414) | A barra do step bloqueado e o diálogo; o cartão de arquivos no lugar da faixa | 7, 13 |
| §Review pelo agente (416–438), §Depende de mim (663–681) | **Retry reviewer**, que volta a `reply` sem o relatório; o turno que falhou sem **Retry**; a barra da outra conversa; o foco na chegada e depois de uma ação | 7 |
| §Rascunho e abertura (448–456), §Review de pull request (458–476), §Encerramento (478–488) | O rascunho na conversa, **Approve draft** na barra `reply`; o vazio dos checks; a conversa do review nos estados finais e o marco do merge; `findings` pelo compositor | 13 |
| §Atalhos (759–776) | O percurso da conversa; `Esc` no compositor só com a caixa vazia | 8, 11 |

## 8. Plano de steps sugerido

Catorze steps, no teto de G (9 a 14, `implementation.md:7`), do domínio para fora. Cada um é um commit com `task check` verde, com os testes e a documentação do que ele cria ou apaga. Nenhum deixa uma forma nova que um step seguinte troque: o que ainda não mudou fica com a forma de hoje.

1. **P5, P6, P7.** Os campos da ação e do subagente no Go, os DTOs e os mocks. Nada na tela.
2. **M3.** A migration `0020`, `action_outputs`, a saída gravada em `handleUser` (o Bash, as falhas, o relatório do subagente), `GetActionOutput`, o payload com a cauda. Nada na tela.
3. **P38–P41.** O retry no resumo e o marco `retried`, `interruptedBy`, `answeredAt`, a `%` da compactação. `Marker.tsx` de hoje passa a ignorar um tipo que não conhece.
4. **P8, P9, P11.** O tipo e os números da mensagem do produto em cada chamador, o `sent` do prompt, `findings` do relatório.
5. **P10, P12, P46.** Os marcos novos da task, `mergedBy` e `mergedAt`, `partial`.
6. **As funções puras e o system.** `conversation.ts`, `actions.ts`, `markers.ts`, `composer.ts`, e em `request.ts` as nove situações novas, a outra conversa e o alvo do foco em funções próprias, que `taskRequestOf` ainda não chama; `stepPhaseLabel`, `situationFragment`; testadas em tabela contra a §4.2 e contra transcripts antigos. `PlaceEmpty`, `ChecksList` ao vivo, os ícones, `--size-composer-max`, o comentário e o teste de `Shimmer`; testes de componente e de estilo computado nos dois temas. Nada na tela muda.
7. **A barra I.** `taskRequestOf` passa a chamar as funções novas: `session_error` com **Retry <quem>** (P3) e o do turno que falhou sem ação, `step_blocked` com **Clean and start…** e o diálogo (T24) e **Change path…**, `pr_blocked`, `worktree_unreadable`, `reply` com **Approve draft**, a barra da outra conversa, o foco na chegada e depois de uma ação, a piscada, o anúncio com o rótulo de nascimento, os tooltips que as notas levavam; `ErrorCard`, `StepBlocked`, `PRBlocked` e `DraftCard` perdem os botões que a barra passa a ter.
8. **A conversa: a coluna e a leitura.** `Conversation` reescrito na coluna de 960 px, o `feed`, o percurso de teclado, a fala com quem fala e a hora, a mensagem e a fila, a atividade com o retry, o bloco de erro, a volta ao fim, o código cortado; o compositor de hoje passa à coluna. Saem `AssistantMessage`, `UserMessage`, `PendingMessage`, `ErrorCard`, `ActivityIndicator`, `ScrollToBottomButton`.
9. **As ações.** O grupo, os comandos com a saída e **Show all**, o subagente com o relatório. Sai `ActionGroup`.
10. **Os marcos.** As linhas de início, as mensagens do produto, os marcos da tabela com os corpos e **Open in Artifacts** e **Open in Details**, os derivados, as dobras de trecho; `plan_invalid` na barra com **Show problems**. Saem `Marker`, `AppMessage`, `PlanProblemsNotice`.
11. **O compositor.** Os placeholders, as pastilhas, `ModelChip`, **Send** (vazio, enviando, `Not sent`), **Stop**, `Working`, `Esc` com a caixa vazia, a regra da primária, o envio que retoma (T25) e o que responde a pergunta (T26). Sai `PausedNotice`.
12. **Os cartões.** Pergunta (com várias perguntas e as teclas), permissão (enviando, falha, cancelada), respondidos, o fio da pergunta em texto; a barra `question` e `permission` com **Show**. Saem os cartões de hoje.
13. **O lugar sem conversa e os cartões fixos.** `PlaceEmpty` em cada linha da tabela, o vazio dos checks (T15) e os checks ao vivo, o cartão de arquivos (T2) no lugar de `ReviewStrip` na task, o rascunho na conversa, a conversa fechada do review nos estados finais com `now` em `Details`, a barra `findings` em texto, a faixa do clone escondida com a barra do bloqueio. Saem `StepBlocked`, `PRBlocked`, `ImplementationDone`, as notas e os `Waiting` de `PRPane`, `ClosedSummary`.
14. **As cenas e a medição.** Os testes pintados dos prontos 1 a 3 com as capturas, o script de medição da virtualização no app e o registro em `implementation.md`, a conferência de `docs/` contra o que a task fez.

Depois do step 14, e antes do merge, o `design-critic` revisa a branch (`implementation.md:21`); as divergências são corrigidas em commits da própria branch.

## 9. Para o usuário confirmar

Nada. As duas mudanças de produto que esta task abria foram decididas pelo coordenador, por delegação do usuário, em `decisions.md` (2026-09-28, "Conversa: saída dos comandos guardada inteira e resposta pelo compositor"): M3 guarda a saída inteira de cada comando, lida sob demanda por **Show all** (T20), e o texto do compositor responde a pergunta aberta (T26), com a regra das várias perguntas da §4.2. **Clean and start…** com confirmação (T24) decorre da regra dos diálogos destrutivos (`decisions.md`, 2026-09-25) e do mock aprovado, que escreve a ação com reticências. O PRD não pergunta nada ao usuário.
