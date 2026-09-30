# Métricas dos implementadores · tasks 3, 4 e 5

Este arquivo compara as tasks 3 (PR #69), 4 (PR #71) e 5 (PR #73) da frente de redesenho para responder duas perguntas:

1. A task 5, implementada com Sonnet 5.5, foi mais rápida que as tasks 3 e 4, implementadas com Opus 5.5? A qualidade se manteve?
2. Qual foi o efeito no tempo do `task check` curto, somado à instrução de rodar só os testes que a mudança toca?

Medição de 2026-09-30. A PR #73 segue aberta, e a crítica pré-merge da task 5 (`critique-task-05.md`) ainda não existe.

## Resumo

Na fase de steps, "agente" é o tempo em que ao menos uma sessão do step trabalhava: implementador, revisor ou subagente. O método vem logo abaixo.

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Implementador (padrão da task) | Opus 5.5 · low | Opus 5.5 · low | Sonnet 5.5 · medium |
| `task check` na worktree | antigo, com race e cobertura | antigo, com race e cobertura | curto, com `--changed` |
| Steps · linhas mudadas nos steps | 13 · 20.749 | 14 · 25.308 | 11 · 18.850 |
| Itens de pronto do material | 17 | 17 | 14 |
| Agente na fase de steps | 289 min | 387 min | 144 min |
| · por step | 22,2 min | 27,6 min | 13,1 min |
| · por 1.000 linhas | 13,9 min | 15,3 min | 7,6 min |
| · por item de pronto | 17,0 min | 22,7 min | 10,3 min |
| Espera em testes e checks, primeiro plano | 120 min (42%) | 196 min (51%) | 64 min (44%) |
| Agente sem essa espera, por 1.000 linhas | 8,1 min | 7,6 min | 4,3 min |
| Parede da fase de steps | 13,5 h | 8,3 h | 2,4 h |
| Espera sem nenhum agente nos steps | 521 min | 114 min | 0 min |
| Duração mediana de um `task check` inteiro | 89 s | 97 s | 54 s |
| `task check` por step | 6,3 | 7,3 | 4,4 |
| Achados na 1ª passada do revisor, por 1.000 linhas | 0,14 | 0,51 | 0,53 |
| Achados de código na 1ª passada do review da PR | 20 | 26 | 22 |
| Bloqueios na 1ª crítica pré-merge | 6 | 10 | pendente |

## Método

**Fontes**

- Commits por PR, pela API do GitHub, com as linhas por commit de `git show --shortstat`.
- O banco do MySpec, copiado para o scratchpad:
  - `tasks`, com os modelos por etapa e por step;
  - `steps`, com o início, o commit e `review_pass`;
  - `pr_runs`;
  - `sessions`, só da task 5: o banco apaga as sessões de uma task encerrada.
- Os transcripts do Claude Code:
  - as pastas das worktrees `…MySpec-50-…`, `-51-` e `-52-`, com os subagentes em `<sessão>/subagents/`;
  - o PRD, o tech spec e o plano, em `-home-guilherme-pessoal-myspec`.
- Os relatórios de review em `~/.local/share/myspec/tasks/guilhermt/MySpec/<task>/step-reviews/` e `pr/`.
- As críticas `critique-task-03.md` e `critique-task-04.md`, com a primeira leitura de cada uma tirada do git (`2eef3fb`, `aea0b2d`).
- Os runs do CI, pela API: jobs, runner e logs.

**Definições**

- **Sessão de step.**
  - O implementador é a sessão cujo primeiro prompt é `# Step N`.
  - O revisor é o `# Step Review` que começa na janela do step, de `steps.created_at` a `steps.updated_at`.
  - Os subagentes contam no step da sessão que os chamou.
- **Tempo de agente.**
  - Um turno de uma sessão vai de um prompt, do usuário ou do app, até o último evento antes do prompt seguinte.
  - Um subagente conta do primeiro ao último evento.
  - O tempo de agente de um step é a união desses intervalos, recortada na janela do step.
- **Espera sem agente.** A parede do step menos o tempo de agente: nenhuma sessão estava trabalhando.
- **Espera em verificação.** A união dos intervalos, da chamada ao resultado, dos comandos Bash de teste rodados em primeiro plano:
  - `task check`, `task check:full` e `task test*`;
  - `go test`, com ou sem `-run`;
  - `pnpm test`, `vitest run`, com ou sem arquivo;
  - `test:painted`;
  - a cobertura.

  Lint, typecheck e `task fmt` sozinhos não entram. Um comando em segundo plano conta do disparo à notificação `<task-notification>` e aparece à parte.
- **`task check` inteiro.** Uma execução de 30 s ou mais, sem laço de espera (`while pgrep`, `until grep`). As mais curtas pararam no lint.
- **Commits.**
  - Os commits de step são os que aparecem em `steps.commit_sha`.
  - As correções do review interno são os commits feitos na sessão `# Pull Request Review` da própria task.
  - As correções do coordenador: `f11f22b`, `980949a` e `50f0b4b` na task 3; `e56655d` e `c55a417` na task 4; nenhuma na task 5.

## Configuração de cada task

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| PRD · tech spec · plano | Opus medium · medium · medium | Opus medium · medium · medium | Opus medium · medium · low |
| Implementador | Opus low | Opus low | Sonnet medium |
| Steps que o implementador passou a um subagente `step-implementer` | 5 de 13 (6, 8, 11, 12, 13), Opus · high | 4 de 14 (6 com dois `-xhigh`, 10, 13, 14), Opus · high/xhigh | nenhum (o step 11 chamou um subagente Sonnet para auditar a documentação) |
| Revisor de step | Opus low | Opus low | Opus low |
| Agente de PR · review da PR | Opus medium · Opus high | Opus medium · Opus high | Sonnet low · Opus medium |
| Quem corrigiu os achados da PR | subagentes Sonnet 5 | subagentes Opus e, no fim, Sonnet 5.5 | subagentes Sonnet 5.5 |
| Base da worktree | `be10ea9`, com o `Taskfile.yml` antigo | `1894f3e`, antes da #70, com o `Taskfile.yml` antigo | `785741a`, com o check curto (#70) e a instrução do `CLAUDE.md` (`9ac06a8`) |
| O que os arquivos de step pedem | `task check` passes in full | `task check` passes in full | `run only the tests the change touches while iterating` e `task fmt then task check pass` |
| Outras sessões do Claude Code na máquina durante os steps | duas curtas (14:42–15:29) | seis, do repositório ICSF (20:25–01:46) | uma |

O `task check` antigo (`git show 1894f3e:Taskfile.yml`) rodava:

- o Go com `-race -shuffle -count=1` e cobertura, mais o limite de `go-test-coverage`;
- `pnpm test:coverage` e `pnpm test:painted` inteiros.

O curto (`Taskfile.yml` atual) roda:

- o Go com o cache de teste;
- `vitest run --changed <base>`, as duas suítes;
- sem cobertura.

## Tamanho do que foi pedido e do que foi entregue

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Material `design/tasks/0N-*.md` | 442 linhas, 13,2 mil palavras | 508 linhas, 15,4 mil palavras | 475 linhas, 14,8 mil palavras |
| Itens de pronto (§1) · decisões da §4.3 | 17 · 27 | 17 · 31 | 14 · 25 |
| PRD · tech spec · arquivos de step (linhas) | 311 · 750 · 622 | 221 · 749 · 579 | 394 · **1.530** · 479 |
| Commits de step: inserções / remoções | 17.009 / 3.740 | 21.006 / 4.302 | 15.500 / 3.350 |
| Linhas por step | 1.596 | 1.808 | 1.714 |
| Correções do review interno (commits · linhas) | 1 · 1.543 | 4 · 3.655 | 6 · 835, parte delas no CI |
| Correções do coordenador (commits · linhas) | 3 · 596 | 2 · 861 | 0, crítica pendente |
| Testes criados, frontend (jsdom + pintados) | +794 (2.890 → 3.684) | +899 (3.684 → 4.583) | +658 (4.583 → 5.241) |
| Testes criados, Go | +56 (2.455 → 2.511) | +150 (2.511 → 2.661) | +21 (2.661 → 2.682) |
| Testes por 1.000 linhas | 41 | 41 | 36 |

## Tempo por fase

| Fase | | Task 3 | Task 4 | Task 5 |
|---|---|---|---|---|
| PRD, tech spec e plano | agente | 41 min | 23 min | 40 min |
| Steps | parede | 13,5 h (01:54–15:24) | 8,3 h (20:10–04:31) | 2,4 h (21:56–00:21) |
| | agente | 289 min | 387 min | 144 min |
| | espera sem agente | 521 min | 114 min | 0 min |
| PR (rascunho e review) | parede até o review limpo | 2,3 h | 12,6 h | 12,2 h |
| | agente | 35 min | 80 min | 36 min |
| | passadas de review | 2 | 5 | 7 |
| Total | agente | 6,1 h | 8,2 h | 3,7 h |
| | da criação da task ao review limpo | 16,7 h | 21,3 h | 15,5 h |

Na fase de PR, quase toda a parede é espera pelo usuário: noite, pedidos de correção e o CI. Nas tasks 4 e 5 a PR atravessou a noite. Na task 5 somou-se o CI sem cobranças e o runner self-hosted. As paredes da PR não se comparam; o tempo de agente sim.

## Os steps, um a um

A coluna "agente" é a união; "impl" e "rev" podem se sobrepor. A coluna "verif." é a espera em testes e checks em primeiro plano. "1ª" são os achados da primeira passada do revisor.

**Task 3** (Opus low; ◆ = passou a um subagente Opus high)

| Step | Linhas | Parede | Agente | Impl | Rev | Sem agente | Verif. | `task check` | Testes de arquivo | Passadas | 1ª |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 516 | 11,1 | 11,1 | 7,7 | 3,3 | 0 | 6,2 | 4 | 8 | 2 | 1 |
| 2 | 652 | 10,2 | 10,2 | 8,2 | 2,0 | 0 | 5,2 | 8 | 10 | 1 | 0 |
| 3 | 872 | 18,6 | 18,6 | 13,7 | 4,9 | 0 | 11,3 | 7 | 10 | 1 | 0 |
| 4 | 1.628 | 33,5 | 18,1 | 15,4 | 2,7 | **15,4** | 8,7 | 5 | 14 | 1 | 0 |
| 5 | 4.553 | 535,8 | 30,3 | 25,5 | 4,8 | **505,5** | 11,2 | 9 | 7 | 2 | 1 |
| 6 ◆ | 1.767 | 56,0 | 56,0 | 36,0 | 26,5 | 0 | 31,8 | 14 | 23 | 3 | 1 |
| 7 | 1.831 | 15,2 | 15,2 | 10,3 | 4,9 | 0 | 6,6 | 5 | 6 | 1 | 0 |
| 8 ◆ | 2.335 | 30,8 | 30,8 | 28,1 | 2,7 | 0 | 7,2 | 4 | 24 | 1 | 0 |
| 9 | 1.359 | 15,1 | 15,0 | 11,8 | 3,3 | 0 | 6,4 | 7 | 9 | 1 | 0 |
| 10 | 786 | 13,7 | 13,6 | 11,3 | 2,4 | 0 | 6,1 | 5 | 6 | 1 | 0 |
| 11 ◆ | 2.284 | 21,5 | 21,4 | 18,6 | 2,9 | 0 | 5,8 | 3 | 9 | 1 | 0 |
| 12 ◆ | 1.637 | 27,9 | 27,8 | 26,0 | 1,8 | 0 | 7,4 | 5 | 14 | 1 | 0 |
| 13 ◆ | 529 | 20,7 | 20,7 | 18,4 | 2,2 | 0 | 6,4 | 6 | 8 | 1 | 0 |

**Task 4** (Opus low; ◆ = subagente Opus high, ◆◆ = dois subagentes Opus xhigh)

| Step | Linhas | Parede | Agente | Impl | Rev | Sem agente | Verif. | `task check` | Testes de arquivo | Passadas | 1ª |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 938 | 20,6 | 20,6 | 16,5 | 4,1 | 0 | 13,6 | 6 | 7 | 1 | 0 |
| 2 | 793 | 16,5 | 16,5 | 13,9 | 2,6 | 0 | 10,2 | 5 | 7 | 1 | 0 |
| 3 | 900 | 18,1 | 18,1 | 12,9 | 5,2 | 0 | 9,5 | 5 | 4 | 2 | 1 |
| 4 | 1.006 | 22,7 | 22,7 | 20,3 | 2,3 | 0 | 13,3 | 10 | 13 | 1 | 0 |
| 5 | 802 | 25,6 | 25,6 | 22,4 | 3,2 | 0 | 14,5 | 3 | 18 | 1 | 0 |
| 6 ◆◆ | 5.771 | 152,3 | 39,1 | 35,6 | 4,3 | **113,2** | 8,2 | 10 | 23 | 4 | 6 |
| 7 | 2.010 | 23,5 | 23,5 | 21,4 | 2,1 | 0 | 8,4 | 6 | 15 | 1 | 0 |
| 8 | 2.508 | 39,4 | 39,4 | 36,1 | 4,0 | 0 | 26,7 | 13 | 9 | 2 | 4 |
| 9 | 1.287 | 17,4 | 17,3 | 11,5 | 5,9 | 0 | 10,0 | 5 | 4 | 1 | 0 |
| 10 ◆ | 1.778 | 26,6 | 26,6 | 22,7 | 3,9 | 0 | 9,4 | 3 | 12 | 1 | 0 |
| 11 | 1.042 | 55,3 | 55,2 | 49,9 | 11,8 | 0 | 47,4 | 21 | 24 | 3 | 2 |
| 12 | 1.828 | 17,4 | 17,4 | 13,5 | 3,9 | 0 | 7,2 | 7 | 7 | 1 | 0 |
| 13 ◆ | 2.742 | 28,6 | 28,6 | 24,4 | 4,2 | 0 | 8,3 | 4 | 14 | 1 | 0 |
| 14 ◆ | 1.903 | 36,2 | 36,2 | 36,1 | 2,8 | 0 | 8,7 | 4 | 11 | 1 | 0 |

**Task 5** (Sonnet medium, sem delegar a implementação)

| Step | Linhas | Parede | Agente | Impl | Rev | Sem agente | Verif. | `task check` | Testes de arquivo | Passadas | 1ª |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 350 | 7,8 | 7,7 | 6,5 | 1,3 | 0 | 4,7 | 6 | 2 | 1 | 0 |
| 2 | 3.915 | 18,3 | 18,3 | 15,7 | 2,6 | 0 | 6,1 | 6 | 15 | 2 | 1 |
| 3 | 1.900 | 14,3 | 14,3 | 10,5 | 3,8 | 0 | 4,9 | 6 | 9 | 2 | 2 |
| 4 | 1.649 | 8,7 | 8,7 | 7,4 | 1,3 | 0 | 2,7 | 3 | 7 | 1 | 0 |
| 5 | 962 | 10,7 | 10,6 | 9,2 | 1,5 | 0 | 4,7 | 4 | 3 | 1 | 0 |
| 6 | 1.223 | 9,5 | 9,5 | 7,2 | 2,3 | 0 | 4,0 | 4 | 5 | 1 | 0 |
| 7 | 2.278 | 11,4 | 11,3 | 9,8 | 1,6 | 0 | 3,5 | 3 | 6 | 1 | 0 |
| 8 | 2.069 | 10,7 | 10,6 | 9,2 | 1,4 | 0 | 3,3 | 3 | 8 | 1 | 0 |
| 9 | 1.632 | 11,2 | 11,2 | 8,7 | 2,4 | 0 | 5,2 | 6 | 6 | 2 | 1 |
| 10 | 230 | 4,1 | 4,0 | 2,8 | 1,2 | 0 | 2,2 | 3 | 2 | 1 | 0 |
| 11 | 2.642 | 37,5 | 37,4 | 36,1 | 1,9 | 0 | 22,1 | 4 | 23 | 4 | 6 |

As medianas de agente por step são 18,6, 24,5 e 10,6 min. Os steps que se parecem mostram onde o ganho da task 5 some.

| Step | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| O de cenas e medição (painted) | step 13: 20,7 min | step 14: 36,2 min | step 11: 37,4 min |
| O de funções puras | step 5: 30,3 min, 4.553 linhas | step 6: 39,1 min, 5.771 linhas | step 2: 18,3 min, 3.915 linhas |

No step de cenas, a task 5 foi tão lenta quanto a task 4: 22 dos 37 min foram de testes pintados, com uma execução de 591 s.

## Onde vai o tempo do agente

Fase de steps, por papel. O tempo é por sessão, sem união entre sessões. "s/msg" é o tempo de agente sem a verificação dividido pelo número de mensagens do modelo.

| Task | Papel | Sessões | Agente | Mensagens do modelo | Chamadas de ferramenta | Verificação | s/msg |
|---|---|---|---|---|---|---|---|
| 3 | implementador sem delegar | 8 | 104 min | 877 | 506 | 45 min (43%) | 4,1 |
| 3 | subagente implementador (Opus high) | 5 | 122 min | 919 | 540 | 38 min (31%) | 5,5 |
| 3 | revisor (Opus low) | 13 | 64 min | 290 | 168 | 39 min (60%) | 5,3 |
| 4 | implementador sem delegar | 10 | 218 min | 1.530 | 866 | 132 min (60%) | 3,4 |
| 4 | subagente implementador (Opus high/xhigh) | 6 | 127 min | 1.107 | 643 | 21 min (17%) | 5,8 |
| 4 | revisor (Opus low) | 14 | 67 min | 317 | 173 | 49 min (73%) | 3,5 |
| 5 | implementador sem delegar (Sonnet medium) | 10 | 87 min | 759 | 429 | 29 min (34%) | 4,6 |
| 5 | revisor (Opus low) | 11 | 21 min | 169 | 99 | 13 min (61%) | 2,9 |

Na fase de steps inteira:

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Mensagens do modelo por 1.000 linhas | 104 | 122 | 67 |
| Chamadas de ferramenta por 1.000 linhas | 60 | 70 | 38 |

Nos steps sem delegação, o implementador mandou 72 mensagens por 1.000 linhas na task 3, 117 na task 4 e 47 na task 5.

**Tokens e contexto**

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Tokens de saída do implementador, com os subagentes | 796 mil | 1,13 milhão | 1,03 milhão |
| Pico de contexto do implementador, mediana | 121 mil | 175 mil | 185 mil |
| Pico de contexto do implementador, máximo | 288 mil | 264 mil | 338 mil |

O Sonnet escreveu tanto quanto o Opus, em menos tempo.

## Verificação

**Comandos na fase de steps.** Primeiro plano; entre parênteses, os de segundo plano.

| Comando | Task 3 · n · soma | Task 4 · n · soma | Task 5 · n · soma |
|---|---|---|---|
| `task check` | 73 (+9) · 87,3 min | 96 (+6) · 126,2 min | 46 (+2) · 35,7 min |
| `task test`, `task test:go`, `task test:web` (antigos, com cobertura) | 11 (+1) · 10,9 min | 35 · 38,7 min | 0 |
| cobertura chamada à parte | 4 · 3,9 min | 9 · 8,1 min | 0 |
| `vitest run` sem arquivo, suíte inteira | 5 · 2,9 min | 13 · 13,1 min | 1 · 0,9 min |
| `vitest run <arquivo>` | 92 · 12,9 min | 93 · 13,7 min | 57 · 7,0 min |
| pintados `<arquivo>` | 22 · 3,5 min | 9 · 2,5 min | 24 (+3) · 20,3 min |
| pintados inteiros | 7 · 3,6 min | 4 · 1,8 min | 0 |
| `go test -run` | 14 · 1,4 min | 12 · 2,2 min | 2 · 0,1 min |
| `go test ./...` ou de pacote | 23 · 14,9 min | 62 · 18,9 min | 1 · 0,1 min |
| `task check:full`, `task test:full` | 0 | 0 | 0 |

**Soma, sem contar a sobreposição**

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Espera em verificação | 120 min | 196 min | 64 min |
| · por step | 9,3 min | 14,0 min | 5,8 min |
| · por 1.000 linhas | 5,8 min | 7,7 min | 3,4 min |
| · fatia do tempo de agente | 42% | 51% | 44% |

**O `task check` em si**

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Execuções inteiras (≥ 30 s) | 51 | 59 | 38 |
| Mediana | 89 s | 97 s | 54 s |
| Soma | 76,6 min | 99,0 min | 35,4 min |
| Execuções por step, contando as que pararam no lint | 6,3 | 7,3 | 4,4 |
| Testes de arquivo por step | 11,4 | 12,0 | 7,8 |

O `task check` curto levou 37 a 60 s na task 5, não os uns 20 s do `CLAUDE.md`.

- O Go vem do cache: `DONE 2677 tests … in 0.6s`.
- O `vitest --changed main` rodou de 238 a 296 arquivos, de 4.044 a 5.088 testes, em 37 a 50 s (`Duration` no fim de cada `task check` da task 5). Os steps tocam `store`, `lib` e o system, de que quase todo teste depende, então o `--changed` escolhe quase a suíte toda.

**O revisor como controle.** O revisor foi o mesmo nas três tasks, Opus low com o mesmo prompt. Só mudou o check que ele roda.

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Passadas | 17 | 21 | 17 |
| Agente por passada | 3,8 min | 3,2 min | 1,25 min |
| Verificação por passada | 2,3 min | 2,3 min | 0,8 min |

**Estimativa do efeito do check curto na task 5**

- Com a mediana antiga, uns 93 s, as 38 execuções inteiras da task 5 teriam levado uns 25 min a mais.
- Seriam 169 min de agente em vez de 144, uns 17% a mais.
- A instrução também tirou a cobertura, a suíte inteira e os pintados inteiros avulsos. Nas tasks 3 e 4, esses comandos somaram 10 e 23 min.

## Espera pelo usuário

Nas três tasks, um step começa uns 2 s depois do commit do anterior (`steps.created_at` contra o `updated_at` anterior). No modo `Agent`, o step commitado pelo revisor segue sozinho, e nenhum step esperou o usuário entre um e outro. As esperas estão dentro dos steps:

| Task · step | Espera | O que o transcript mostra |
|---|---|---|
| 3 · 4 | 15 min | O implementador encerrou o turno às 02:49; o revisor só começou às 03:04. A causa não está registrada |
| 3 · 5 | 8 h 25 min | O turno encerrou às 03:31; o revisor começou às 11:56 do dia seguinte. A noite |
| 4 · 6 | 1 h 53 min | Três passadas sem relatório limpo passaram o step ao usuário. O último relatório, limpo, saiu às 22:33; o usuário aprovou o commit às 00:26 |
| 5 | nenhuma | Os onze steps correram de 21:56 a 00:21 sem pausa |

Na fase de PR, o usuário mandou 7 mensagens na task 3, 10 na task 4 e 7 na task 5 (`status?`, `fix all needed`, a troca de runner). Descontada a noite, a espera domina a parede.

## CI

| PR · commit | Runner | Frontend | Go | Build | Resultado |
|---|---|---|---|---|---|
| #69 · `6a7479a` (fim dos steps) | GitHub | 9m24 | 5m13 | pulado | falhou: pintado de largura (`184 ≤ 177`) |
| #69 · `a84c005`, `980949a`, `50f0b4b` | GitHub | 9m12–9m49 | 5m25–5m36 | 4m15–4m36 | verde; o run leva uns 14 min |
| #71 · `89d5713` (fim dos steps) | GitHub | 4m14 | 5m43 | pulado | verde |
| #71 · `6b5b5e0` | GitHub | 3m37 | 5m59 | pulado | falhou: corrida no teardown de um teste Go que a PR não toca |
| #71 · `0200e5c`, `c55a417` | GitHub | 4m34–4m37 | 5m34–5m53 | pulado | verde; o run leva uns 6 min |
| #73 · `724c189`, `79a1e97`, `9b40b41` | GitHub | — | — | — | não rodou: "recent account payments have failed or your spending limit needs to be increased" |
| #73 · `a362e90` | laptop | 1m19 | 0m55 | 1m00 | falhou: runner self-hosted |
| #73 · `4fccecd` | laptop | 5m04 | 1m09 | 8m46 | falhou: `spawn ETXTBSY` no mise |
| #73 · `a14c362` | laptop | 2m49 | 7m26 | 3m37 | falhou: 14 testes estouram 5 s em `where-actions-went.test.tsx` |
| #73 · `266ca3c` | GitHub | 5m16 | 6m19 | pulado | verde |

O CI da #69 é o antigo, com cobertura. As #71 e #73 usam o CI da #70, sem cobertura e com o filtro `Changes`.

A cobertura só foi medida:

- na #69, pelo CI: frontend com 97,68% das linhas e 92,75% dos ramos, contra 97,55% e 92,36% na base; Go com 90,9%, contra 90,8%;
- na task 4, localmente: 97,90% das linhas e 92,38% dos ramos no fim dos steps; Go com 91,1% no review da PR.

A task 5 não tem medida de cobertura em lugar nenhum.

## Qualidade

**Review de step** (Opus low nas três)

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Passadas · por step | 17 · 1,31 | 21 · 1,50 | 17 · 1,55 |
| Steps limpos na 1ª passada | 10 de 13 | 10 de 14 | 7 de 11 |
| Achados na 1ª passada | 3 | 13 | 10 |
| · por 1.000 linhas | 0,14 | 0,51 | 0,53 |
| · por item de pronto | 0,18 | 0,76 | 0,71 |

**Review da PR** (interno, Opus: high nas tasks 3 e 4, medium na 5). Achados de código em cada passada; entre parênteses, os do CI ou do runner.

| Passada | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| 1 | 20 (+1) | 26 | 22 (+1) |
| 2 | limpa | 7 | 4 (+1) |
| 3 | | 6 | 0 (+1) |
| 4 | | 0 (+1) | 1 (+2) |
| 5 | | limpa | 1 |
| 6 | | | 1 (+1) |
| 7 | | | limpa |
| 1ª passada por 1.000 linhas | 0,96 | 1,03 | 1,17 |
| 1ª passada por item de pronto | 1,2 | 1,5 | 1,6 |

Nas tasks 4 e 5, a segunda passada achou sobretudo correções da primeira que ficaram incompletas.

- **Task 4.** `pr_opened` gravado ainda duas vezes, `countFindings` e a falha que perde o texto do compositor.
- **Task 5.** `focusAfterPath` no mesmo card, `CardContextLine` depois de uma leitura que falhou, e o `withoutTooltip` que engole o próprio tempo limite.
- **Task 5, passadas 3 a 6.** Tratam quase só o runner self-hosted. Dois achados de código vieram dele: o `↵` fora do pixel inteiro e a cena `create`, que digita tecla a tecla e estoura 5 s num runner lento. Os dois estão corrigidos (`a14c362`, `266ca3c`).

**Crítica pré-merge** (design-critic)

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| 1ª leitura: bloqueios · podem esperar · notas | 6 · 3 · 8 | 10 · 14 · 6 | pendente |
| Bloqueios por item de pronto | 0,35 | 0,59 | — |
| 2ª leitura | 1 bloqueio: a correção do `⋯` estreitou o menu da lateral (regressão, corrigida em `50f0b4b`) | 0 bloqueios, nenhuma regressão, "Mergear" | — |

Os bloqueios da 1ª leitura das tasks 3 e 4 foram quase todos de prova e de fidelidade ao mock:

- capturas ausentes;
- prova das bordas;
- cenas incoerentes;
- regiões vivas;
- pastilhas fora do system.

Nenhum foi de comportamento quebrado no uso comum.

## Ressalvas: o que não se compara

- **Modelo e esforço mudaram juntos.** O Opus rodou em low e o Sonnet em medium. Nas tasks 3 e 4, o Opus low ainda passou 9 dos 27 steps a subagentes Opus high ou xhigh. O "Opus" das tasks 3 e 4 é uma mistura. Sem os steps delegados, os números são estes:

  | | Task 3 | Task 4 | Task 5 |
  |---|---|---|---|
  | Agente por 1.000 linhas | 10,8 min | 19,5 min | 6,6 min |
  | · sem a verificação | 5,8 min | 7,3 min | 4,0 min |

- **O check e o modelo mudaram na mesma task.** A task 5 é a primeira com o check curto e a primeira com Sonnet. O revisor, que não mudou de modelo, é a única medida limpa do efeito do check.
- **O material e o tech spec.** Os materiais têm tamanho parecido (442, 508 e 475 linhas). O da task 5 tem menos itens de pronto (14 contra 17). O tech spec da task 5 tem 1.530 linhas, o dobro dos outros dois (750 e 749), com as tabelas e os textos já escritos. Isso reduz o que o implementador decide, e o efeito não se separa do modelo.
- **A natureza do trabalho.**
  - Task 3: backend e muitos componentes novos.
  - Task 4: backend do transcript, a conversa, cartões e acessibilidade densa. Foi a mais pesada: tem o maior número de achados e de passadas.
  - Task 5: sobretudo frontend, com pouco Go (+21 testes).
  - Linhas mudadas são uma régua fraca. Os steps de funções puras têm milhares de linhas de tabela de teste e são rápidos por linha.
- **A carga da máquina.**
  - A task 4 dividiu a máquina com sessões do repositório ICSF durante metade dos steps.
  - A task 3 teve `task check` morto por `SIGKILL` no step 5, com três execuções perdidas.
  - A task 5 correu quase sozinha.
- **O CI da task 5.** A conta ficou sem cobranças, o runner self-hosted foi tentado das 02:24 às 12:20 e depois revertido. A parede da PR da task 5 e as passadas 3 a 6 do review não medem o implementador.
- **A qualidade da task 5 está incompleta.** A crítica pré-merge ainda não foi feita, e a cobertura não foi medida.
- **O que não se recupera das tasks 3 e 4.** As sessões delas foram apagadas do banco ao encerrar (`sessions`, `transcript_entries`). O tempo delas vem só dos transcripts do Claude Code.

## Lacunas e perguntas

- **A cobertura das tasks 4 e 5 no CI.** O `full.yml` semanal não rodou até hoje. Medir a cobertura da task 5 pede rodar `task test:full` na worktree, que este levantamento não fez por ser só leitura.
- **A crítica da task 5.** Quando `critique-task-05.md` existir, a linha "Crítica pré-merge" desta tabela se completa.
- **Pergunta.** Quer separar o efeito do modelo do efeito do check numa próxima task, rodando um implementador com Opus nas mesmas condições da task 5 (check curto, tech spec detalhado)? Opus low proibido de delegar, ou Opus medium. Sem isso, os 50% de ganho da task 5 ficam atribuídos em conjunto ao Sonnet, ao check e ao tech spec.

## Conclusões

**A task 5 foi mais rápida, e a maior parte do ganho não vem da velocidade do modelo.** A fase de steps levou 144 min de agente, contra 289 e 387 min: 13,1 min por step contra 22,2 e 27,6, e 7,6 min por 1.000 linhas contra 13,9 e 15,3. Sem nenhuma espera do usuário, os onze steps fecharam em 2,4 h de parede. O Sonnet medium não é mais rápido por mensagem: gastou 4,6 s por mensagem fora da verificação, contra 4,1 e 3,4 s do Opus low. Ele chegou ao fim com menos mensagens e ferramentas: 47 mensagens por 1.000 linhas, contra 72 e 117. Rodou menos `task check` por step (4,4 contra 6,3 e 7,3), e cada um custou menos. O tech spec com o dobro do tamanho também pesa, e não se separa do modelo. Onde o trabalho é dominado por testes pintados, o step de cenas, o Sonnet empatou com a task 4 (37 contra 36 min).

**O check curto cortou uns 40% de cada execução, não os 75% esperados, e economizou uns 17% do tempo de agente da task 5.** O `task check` inteiro caiu de 89–97 s para 54 s de mediana. Não chegou aos 20 s porque, numa branch que toca `store`, `lib` e o system, o `vitest --changed` escolhe quase toda a suíte. O Go vem do cache e custa menos de 1 s. No revisor, o mesmo Opus low com o mesmo prompt, a verificação por passada caiu de 2,3 para 0,8 min, e o tempo por passada de 3,2–3,8 para 1,25 min. Sem o check curto, as 38 execuções inteiras da task 5 teriam custado uns 25 min a mais: 169 min em vez de 144. A instrução de rodar só os testes tocados não aumentou os testes por arquivo (7,8 por step, contra 11,4 e 12,0). Ela eliminou a cobertura, a suíte inteira e o `go test ./...` avulsos, que tinham custado 10 e 23 min nas tasks 3 e 4. A verificação continua perto de metade do tempo de agente (44%, contra 42% e 51%), porque o resto encolheu na mesma proporção.

**Pelo que já se mede, a qualidade da task 5 ficou no nível da task 4, abaixo da task 3.**

| | Task 3 | Task 4 | Task 5 |
|---|---|---|---|
| Achados do revisor de step, 1ª passada, por 1.000 linhas | 0,14 | 0,51 | 0,53 |
| Achados de código na 1ª passada do review da PR, por 1.000 linhas | 0,96 | 1,03 | 1,17 |
| Testes por 1.000 linhas | 41 | 41 | 36 |

Na task 5, a 2ª passada da PR achou correções incompletas da 1ª, como na task 4. O que falta para fechar a comparação:

- a crítica pré-merge, que nas tasks 3 e 4 achou 6 e 10 bloqueios depois do review interno;
- a cobertura, que nas tasks 3 e 4 subiu ou se manteve.
