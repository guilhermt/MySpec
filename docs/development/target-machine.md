# Notas da máquina alvo

O que foi verificado na máquina em que o produto é usado, contra o build de produção instalado com `task install`. Vale repetir ao subir de versão do Wails, do GTK ou do WebKitGTK.

Máquina: Omarchy 4.0.2 (Arch), Hyprland 0.56.2 em Wayland, GPU AMD, um monitor 2560x1080 com `scale = 1`. Wails `v3.0.0-beta.16`, GTK 4.22.4, WebKitGTK 2.52.6.

## Renderização

Passou sem nenhuma variável de ambiente, por isso `applyWebKitEnvironment()` em `internal/app/webkit_linux.go` está vazia.

- O conteúdo renderiza na primeira pintura. Sem tela preta, sem glitches, sem falha de pintura ao trocar de foco.
- A janela ficou nítida em redimensionamentos repetidos, tanto os que o layout do Hyprland impõe quanto os manuais, de 820x520 a 2200x1000.
- O tema é o atributo `data-theme` do `documentElement`. Trocar o esquema de cores do sistema (`org.gnome.desktop.interface color-scheme` entre `prefer-light` e `prefer-dark`) com o app aberto repinta a interface inteira sem piscar, e o mesmo vale para escolher claro, escuro ou sistema no app. A cor atrás do webview é o `--surface-1` do tema salvo, em sRGB, e o primeiro frame que a janela pinta já a tem, antes de o frontend desenhar.
- O texto tem o tamanho certo em `scale = 1`. Escala fracionária não foi testada.

As fontes são a Fira Sans (`@fontsource/fira-sans`, pesos 400, 500, 600 e 700 e o itálico 400) e a Fira Code (`@fontsource/fira-code`, pesos 400 e 500), estáticas e servidas do próprio app. Os `.woff2` da Fira Sans trazem hinting TrueType e os da Fira Code não. A máquina usa `hintstyle: 1` (hintslight) com antialias ligado, e com hintslight o FreeType ajusta só a vertical e ignora as instruções da fonte: comparadas a 12 e 13 px no WebKitGTK, nos dois temas, a Fira Code com hinting da release oficial 6.2 não fica mais nítida que a do `@fontsource`, só um pouco mais larga e mais clara, e a variável (`@fontsource-variable/fira-code`) difere da estática em poucos pixels. `html` declara `font-synthesis: none`, que não muda nada na tela porque todos os pesos e o itálico usados são carregados: o itálico do Markdown é o real, e 500 e 600 na lateral são pesos distintos. `text-rendering` fica em `auto`, porque `optimizeLegibility` renderiza igual. `-webkit-font-smoothing` não age no Linux e não é declarado. O mono é escrito sem ligaduras (`font-variant-ligatures: none` em `code`, `kbd`, `pre`, `samp` e `.font-mono`).

A única saída no stderr é o aviso `Overriding existing handler for signal 10` do WebKit, inofensivo.

## `app_id`

```
$ hyprctl clients -j | jq -r '.[] | select(.title | endswith("MySpec")) | .class'
org.wails.myspec
```

`class` e `initialClass` são `org.wails.myspec`, igual ao `StartupWMClass` da entrada `.desktop`, então nada precisou ser renomeado.

## Launcher, barra e alternador de janelas

Depois de `task install`:

- A entrada está no banco de aplicações com o nome `MySpec`, a descrição do produto e o ícone `org.wails.myspec`, e `desktop-file-validate` passa.
- O nome do ícone resolve pelo tema de ícones do GTK: o SVG nos tamanhos pequenos e o PNG de 512 no maior.
- Buscar `myspec` no menu do Omarchy lista **MySpec** com o ícone certo.
- Lançar a entrada (`gtk-launch org.wails.myspec`) inicia `~/.local/bin/myspec` e a janela sobe como `org.wails.myspec` / `MySpec`, o que permite ao launcher casar a janela com a entrada.

A barra (`omarchy-shell`, com o widget de janela ativa desligado) e o Alt+Tab (que só move o foco, sem overlay) não mostram nome nem ícone de janela nesta máquina, então esse ponto não pôde ser verificado aqui. Ambos leriam o `app_id`, que está correto.

## Instância única

Com o app aberto e o desktop noutro workspace do Hyprland, rodar `myspec` num terminal troca para o workspace do app e foca a janela; um argumento é ignorado.

O foco é entregue por `gtk_window_present`, que o Hyprland honra porque `misc:focus_on_activate` está ligado. Um compositor que recuse pedidos de ativação deixaria a janela onde está; o workspace ainda trocaria.

## Diálogo nativo

**Browse…** no diálogo **Add repository** e **Change path** abrem o seletor do `xdg-desktop-portal-gtk` em modo de pasta, seguindo o esquema de cores do sistema. Cancelar com Escape fecha sem nenhuma mudança de estado nem linha de log.

## Tema do sistema

Lido do portal, não do Wails. Em `v3.0.0-beta.16` no backend GTK4, `Env.IsDarkMode()` responde falso antes de o loop principal começar e `events.Common.ThemeChanged` nunca dispara, porque o observador do portal é iniciado de um método que esse backend não chama. Verificado com `dbus-monitor`: o portal emite `SettingChanged` para `org.freedesktop.appearance` / `color-scheme` e o Wails o ignora. `internal/app/theme.go` lê `org.freedesktop.portal.Settings` por D-Bus e assina `SettingChanged`, o que também põe a cor certa atrás do webview desde o primeiro frame.

## Notificações

O daemon de notificações é o quickshell, com suporte a ações, markup no corpo e persistência. O app fala direto com `org.freedesktop.Notifications`, onde um clique chega como `ActionInvoked` e uma dispensa chega como `NotificationClosed` com motivo 2; o service de notificações do Wails trata os dois como um clique. Clique, dispensa, foco e retirada da notificação estão verificados com o build instalado.

O quickshell anuncia as capacidades `persistence`, `body`, `body-markup`, `body-hyperlinks`, `actions` e `icon-static`, sem `sound`, então aqui quem toca o carrilhão é o app. O áudio é PipeWire com o servidor Pulse, e `pw-play`, `paplay` e `aplay` estão instalados. O não perturbe é do shell do Omarchy: `omarchy-shell notifications isDnd` responde `on` ou `off` em cerca de 30 ms, e com ele ligado o shell aceita a notificação e a guarda só no histórico. O app instalado herda `OMARCHY_PATH` e um `PATH` com `/usr/share/omarchy/bin`, que é o que o `omarchy-shell` precisa. O servidor não expõe `Inhibited`, e nem `org.erikreider.swaync.cc` nem `org.dunstproject.cmd0` estão no barramento. Com o build instalado, uma situação com a janela fora de foco toca o carrilhão junto com a notificação, duas situações juntas tocam uma vez, e com o não perturbe ligado nada toca.

## Início

Verificado com o build de produção (`task build`) e `XDG_DATA_HOME` e `XDG_STATE_HOME` de teste. O app instalado segura o lock da instância única, que é o mesmo para qualquer diretório de dados; para rodar outro ao lado dele, o build de teste sobe sob um `dbus-run-session` próprio.

- A janela abre antes do banco: no log, `Platform Info` (o Wails já de pé) vem antes de `migration applied` e `database opened`, e `app ready` fecha o início cerca de 15 ms depois do banco aberto. Uma chamada antes do `ready` responde `MySpec is starting.`, coberto em `internal/bindings/late_test.go`; depois dele, o primeiro estado sai (`state published` em debug) e o frontend o pede.
- Uma segunda instância sai antes de abrir o banco e de rodar as migrations: com o app já aberto, `myspec` com um `XDG_DATA_HOME` novo termina sem criar nada nele e só o log registra `app starting`.
- Com `chmod 000` no diretório de dados, `<XDG_DATA_HOME>/myspec`, a janela abre e fica aberta com `MySpec couldn't start`, o texto da permissão com o diretório de dados resolvido, o erro `data directory: probe: open <caminho>: permission denied` no bloco copiável e **Try again** com o foco; o log tem `startup failed` com o mesmo erro, e o processo não sai. O `chmod` vai no diretório `myspec`, e não no próprio `XDG_DATA_HOME`: sem permissão nele, criar os diretórios do app falha antes da janela, e o app sai com o erro no terminal.
- Devolvida a permissão (`chmod 700`), **Try again** recomeça o início no mesmo processo: sob o Broadway (`GDK_BACKEND=broadway`), `Enter` em **Try again** mostra `Starting MySpec…` com `Opening your data`, e o app abre com o mesmo PID. A tentativa de verdade, da falha de permissão ao `ready` depois de **Try again**, é coberta em `internal/app/attempt_test.go`, e a tela em `StartScreen.test.tsx`. O clique em **Try again** na janela real, no Hyprland, fica na checklist de verificação do usuário na máquina alvo.
- Com o diretório de dados num `tmpfs` de 1 MiB quase cheio (`unshare -Urm`, `mount -t tmpfs -o size=1M tmpfs <dir>` e `fallocate` do espaço), o início falha com `open database: commit migration 0001_initial.sql: database or disk is full (13)`. O erro do SQLite (`SQLITE_FULL`) é o que `store.DiskFull` reconhece como `disk_full`, e a janela mostra `MySpec can't open its data: the disk of <diretório de dados> is full. Free some space, then try again.`

## A lista do History

O History mostra os arquivados dos últimos 90 dias numa lista em janela (`useWindowedRows`, a mesma do board): umas 360 linhas no ritmo medido, e 400 é o tamanho a que a lista é medida. Só as linhas que aparecem, a da parada de Tab e a recém-arquivada ficam montadas, entre espaçadores, com 20 de `overscan` além de cada ponta; `HistoryRow` e `DaySectionHeader` são `memo`, e o modelo de cada linha só é feito quando ela monta.

`frontend/src/dev/measure-history.tsx` mede a lista com 400 itens (240 tasks, 100 reviews e 60 discussões, em 90 dias, numa área de 1566 px por 900), em 37 linhas montadas, uma vez fria e cinco vezes quente: a primeira pintura, do render ao quadro seguinte ao commit com o layout feito, e `↓` a partir do primeiro dia, contado em quadros perdidos entre o `keydown` e o quadro que pinta o foco na linha seguinte. As metas são as do board, 300 ms e nenhum quadro perdido, e passam pela mesma regra, a da seção seguinte. Para medir na máquina alvo, abra `?measure=history` no servidor de desenvolvimento (porta 9245) ou no build de medida (porta 9246, `pnpm measure:build` e `pnpm measure:serve`), como o [setup](./setup.md) descreve; o como-medir do Broadway está na seção seguinte.

No WebKitGTK 2.52.6, pelo Broadway, em cinco rodadas no build de produção e quatro no de desenvolvimento:

| React de produção (`pnpm measure:build`) | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 119 a 147 ms | 50 a 61 ms | 65 a 83 ms | 300 ms |
| `↓` na lista, quadros perdidos | 0 | 0 | 1 nas cinco rodadas | 0 |

| React de desenvolvimento (`task dev`) | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 158 a 165 ms | 67 a 71 ms | 85 a 86 ms | 300 ms |
| `↓` na lista, quadros perdidos | 0 | 0 | 0 | 0 |

No Chromium 153 do Playwright, em três rodadas por build:

| | Fria | Quente, mediana | Quente, máximo |
|---|---|---|---|
| Primeira pintura, produção | 85 a 195 ms | 34 a 56 ms | 41 a 127 ms |
| `↓` na lista, produção, quadros perdidos | 0 | 0 | 0 |
| Primeira pintura, desenvolvimento | 113 a 174 ms | 67 a 117 ms | 80 a 125 ms |
| `↓` na lista, desenvolvimento, quadros perdidos | 0 | 0 | 0 |

A meta do `↓` não passa no WebKitGTK com o React de produção: em toda rodada, uma ou duas das cinco teclas quentes levam de 19 a 29 ms do começo do quadro ao fim da pintura e perdem a atualização seguinte da tela. O trabalho da tecla é o foco, que só refaz as linhas que mudaram (`memo`); no Chromium e com o React de desenvolvimento, nenhuma tecla perde um quadro.

O teste `frontend/src/features/history/HistoryView.measure.painted.test.tsx` continua no Chromium e compara, na mesma execução, 400 itens com 40: a razão das medianas quentes fica perto de 1, e o teste falha acima de 30, o que pega uma lista que deixou de ser janela.

## As listas virtualizadas

O board, o History e a conversa montam só o que aparece, entre espaçadores (`useWindowedRows`, o único lugar que importa `@tanstack/react-virtual`). Cada um se mede com uma ferramenta de `frontend/src/dev/`, no motor do app, uma vez fria e cinco vezes quente, com o React de produção (`pnpm measure:build`) e o de desenvolvimento (`task dev`). As metas passam quando o máximo das quentes em produção e a mediana das quentes em desenvolvimento ficam dentro delas.

A tecla na lista e a atualização do streaming têm como meta nenhum quadro perdido entre o evento e a pintura: a resposta aparece na atualização da tela seguinte ao evento. `frontend/src/dev/frames.ts` conta os quadros perdidos. Ele lê o intervalo entre dois quadros da tela, a média de sessenta quadros parados, dispara o evento no começo de um quadro, dentro do `requestAnimationFrame`, e espera o primeiro quadro em que a resposta está feita (o foco na linha seguinte, ou o texto novo no commit). O fim da pintura desse quadro é onde roda uma tarefa postada do seu `requestAnimationFrame`, e os quadros perdidos são as atualizações da tela que passam entre o evento e esse fim, menos a primeira: zero quando a resposta pinta a tempo da atualização seguinte ao evento. Um tempo do evento ao quadro seguinte nunca fica abaixo do que falta para a próxima atualização da tela, por menor que seja o trabalho, e por isso a medida conta quadros. A primeira pintura, a tecla na busca e `Home` no `feed` continuam medidas em milissegundos.

### A rolagem da janela no WebKitGTK

O WebKitGTK faz o layout da lista no meio do commit que troca as linhas da janela, com as que saem já fora e as que entram ainda não inseridas, e prende a rolagem ao fim dessa lista mais curta: sem nada que a segure, `End`, o fim da conversa e a barra arrastada até embaixo levam a rolagem ao topo. Por isso a lista nunca fica mais curta durante um commit: `useWindowedRows` dá a ela um `min-height` em pixel inteiro, a altura das linhas e dos espaçadores como o virtualizador as conta (uma linha ainda não medida pela estimativa) mais o que vem depois delas, como a cauda da conversa. Os espaçadores das pontas guardam a chave quando a janela anda, a medida de uma linha inclui as margens (o espaço sobre o dia do History) e o viewport não tem `overflow-anchor`, já que a janela corrige a rolagem ela mesma. Os testes pintados reproduzem o motor com `layoutInCommits` (`test/painted.ts`), que faz o layout depois de cada linha que sai.

No `MiniBrowser` do WebKitGTK 2.52.6, pelo Broadway, com o build de medida e as cenas do board, do History e da tela da task:

| Lista | Cena | O que o motor mostra |
|---|---|---|
| Board, 2.000 cards | 1134 px, sem painel | `End` foca o último card, inteiro na área que rola, 48 px acima do fundo; a barra arrastada até embaixo para no fim, com 31 linhas à vista |
| Board, 2.000 cards | 812 px, com o painel (estimativa de 52 px) | `End` foca o último card, inteiro na área; a barra até embaixo para no fim |
| History, 400 itens | 1134 e 812 px | `End` foca a última linha, inteira na área; a barra até embaixo para no fim, e a roda volta 120 px |
| Conversa de 1.500 entradas, 362 unidades | a tela da task, 1134 px | abre no fim; lida do topo, `↓` volta ao fim; `End` no `feed` foca a última entrada, inteira na área; a barra até embaixo para no fim |

### O board

`measure-board.tsx` mede 2.000 cards em dez status, todas as seções abertas, com 44 linhas montadas: a primeira pintura, do render ao quadro seguinte ao commit, uma tecla na busca, do `input` ao quadro com a lista nova, e `↓`, em quadros perdidos entre o `keydown` e o quadro que pinta o foco na linha seguinte. As metas são 300 ms, 50 ms e nenhum quadro perdido.

No WebKitGTK 2.52.6 (WebKit 6.0 sobre GTK4 4.22.4), pelo Broadway, em cinco rodadas no build de produção e quatro no de desenvolvimento:

| React de produção | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 146 a 189 ms | 60 a 81 ms | 69 a 100 ms | 300 ms |
| Uma tecla na busca | 13 a 27 ms | 16 ms | 16 a 22 ms | 50 ms |
| `↓` na lista, quadros perdidos | 0 a 2 | 0 | 0, e 3 numa das cinco rodadas | 0 |

| React de desenvolvimento | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 169 a 187 ms | 66 a 69 ms | 84 a 91 ms | 300 ms |
| Uma tecla na busca | 30 a 37 ms | 16 ms | 16 a 37 ms | 50 ms |
| `↓` na lista, quadros perdidos | 0 | 0 | 0 | 0 |

No Chromium 153 do Playwright, em três rodadas por build:

| | Fria | Quente, mediana | Quente, máximo |
|---|---|---|---|
| Primeira pintura, produção | 80 a 94 ms | 29 a 31 ms | 36 a 44 ms |
| Uma tecla na busca, produção | 9 a 11 ms | 16,6 a 16,7 ms | 16,7 a 17 ms |
| `↓` na lista, produção, quadros perdidos | 0 | 0 | 0 |
| Primeira pintura, desenvolvimento | 130 a 151 ms | 65 a 80 ms | 80 a 95 ms |
| Uma tecla na busca, desenvolvimento | 14 a 23 ms | 16,4 a 16,7 ms | 16,8 a 24 ms |
| `↓` na lista, desenvolvimento, quadros perdidos | 0 | 0 | 0 |

### A conversa

A conversa monta as unidades que aparecem, as fixadas (a última, a da parada de Tab do `feed`, a de cada cartão pendente, as que têm um nó `before` ou `after` e a do marco pedido) e 6 de `overscan`, e uma conversa de até 60 unidades monta todas. O modelo se refaz a partir do trecho da primeira entrada que mudou e `RowView` é um `memo`, de modo que uma atualização de texto renderiza uma linha só. `measure-conversation.tsx` mede 1.500 entradas em dois cenários: `?measure=conversation`, em quatro trechos, três dobrados (15 artigos montados), e `?measure=conversation&stretches=open`, em 36 trechos curtos demais para dobrar, 362 unidades de que a janela monta 16 artigos. Cada um mede a primeira pintura e uma atualização do texto em streaming no fim: o trabalho dela, do `text` ao commit com o layout, e os quadros que ela perde (a primeira atualização é a fria e as outras 29 são quentes). O aberto mede também `↓` no `feed`, em quadros perdidos entre o `keydown` e o quadro que pinta o foco na entrada seguinte, e `Home` no `feed`, até o quadro com uma entrada da primeira unidade focada, que a janela monta ao ser pedida. As metas são 300 ms a primeira pintura, nenhum quadro perdido na atualização e no `↓`, e 100 ms `Home`.

No WebKitGTK 2.52.6, pelo Broadway, em cinco rodadas no build de produção e quatro no de desenvolvimento:

| Cenário | Build | Primeira pintura (fria · quente, mediana) | Atualização, trabalho (fria · quente, mediana · máximo) | Atualização, quadros perdidos (fria · quente, mediana · máximo) | `↓`, quadros perdidos (fria · quente, mediana · máximo) | `Home` (fria · quente, mediana · máximo) |
|---|---|---|---|---|---|---|
| Dobrado | produção | 131 a 239 ms · 51 a 69 ms | 5 a 9 ms · 4 a 5 ms · 4 a 18 ms | 0 · 0 · 0, e 1 numa das cinco rodadas | | |
| Dobrado | desenvolvimento | 168 a 182 ms · 61 a 78 ms | 7 ms · 5 ms · 6 a 8 ms | 0 · 0 · 0 a 1 | | |
| Aberto | produção | 129 a 135 ms · 52 a 57 ms | 4 ms · 3 ms · 4 ms | 0 · 0 · 0, e 1 numa das cinco rodadas | 0 · 0 · 0, e 1 numa das cinco rodadas | 36 a 60 ms · 11 a 15 ms · 15 a 28 ms |
| Aberto | desenvolvimento | 162 a 176 ms · 62 a 63 ms | 5 a 7 ms · 4 a 5 ms · 5 a 6 ms | 0 · 0 · 0 a 1 | 0 · 0 · 0 | 43 a 51 ms · 12 a 16 ms · 15 a 16 ms |

No Chromium 153 do Playwright, em três rodadas por build:

| Cenário | Build | Primeira pintura (fria · quente, mediana) | Atualização, trabalho (fria · quente, mediana · máximo) | Atualização, quadros perdidos (fria · quente, mediana · máximo) | `↓`, quadros perdidos (fria · quente, mediana · máximo) | `Home` (fria · quente, mediana · máximo) |
|---|---|---|---|---|---|---|
| Dobrado | produção | 81 a 92 ms · 18 a 27 ms | 2,9 a 3,2 ms · 2 a 2,9 ms · 2,8 a 5,1 ms | 0 · 0 · 0 | | |
| Dobrado | desenvolvimento | 108 a 139 ms · 41 a 52 ms | 5,5 a 10,2 ms · 4,7 a 6,2 ms · 5,4 a 23,2 ms | 0 · 0 · 0 a 1 | | |
| Aberto | produção | 71 a 95 ms · 19 a 29 ms | 2,9 a 10,7 ms · 1,8 a 3,2 ms · 3,8 a 20,1 ms | 0 a 1 · 0 · 0, e 2 numa das três rodadas | 0 · 0 · 0 | 30 a 33 ms · 14,6 a 15,8 ms · 16,3 a 18,7 ms |
| Aberto | desenvolvimento | 103 a 143 ms · 35 a 44 ms | 5,4 a 5,5 ms · 4,2 a 4,6 ms · 5,1 a 5,6 ms | 0 · 0 · 0 | 0 · 0 · 0 | 40 a 43 ms · 15,3 a 15,4 ms · 15,7 a 15,8 ms |

### O que passa

As metas em milissegundos (a primeira pintura, a tecla na busca e `Home`) passam nos dois motores e nas duas builds, e as de quadros passam com o React de desenvolvimento nos dois motores, onde a regra é a mediana das quentes. Com o React de produção, onde a regra é o máximo das quentes, as de quadros não passam em todas as rodadas:

- no WebKitGTK, o `↓` do History perde um quadro em todas as cinco rodadas; o `↓` do board perdeu três numa delas; a atualização do streaming perdeu um numa rodada de cada cenário, e o `↓` da conversa, um numa rodada;
- no Chromium, a atualização do streaming do cenário aberto perdeu dois numa das três rodadas, num trabalho de 20 ms; o resto ficou em zero.

As medidas rodaram com a máquina em carga de 1,3 a 2,6, ao lado de outras suítes. Fora do History, o que se perde é uma atualização em 29 ou uma tecla em cinco, numa só rodada; o `↓` do History perde o quadro em toda rodada.

### Como medir

O app e o `MiniBrowser` rodam sem janela pelo backend Broadway do GTK, que desenha sem GPU: `gtk4-broadwayd :N`, com `N` numa porta acima de 8090 (nunca a 8090), e o programa com `GDK_BACKEND=broadway`, `BROADWAY_DISPLAY=:N` e `env -i` com `HOME` e `XDG_*` temporários (`XDG_RUNTIME_DIR` é o do usuário, onde o `broadwayd` põe o socket). O `MiniBrowser` abre a URL de medida com `--enable-write-console-messages-to-stdout=true`, e cada ferramenta escreve na saída dele uma linha `CONSOLE INFO measure-<lista> {…}`, com o JSON dos números, o intervalo do quadro (`frameMs`) e as metas; um script lê essa linha e encerra o `MiniBrowser`, uma rodada por processo. Um navegador qualquer aberto na porta `8080 + N` também mostra a janela, onde a página da medida cobre a tela com os mesmos números. No Broadway o quadro dura de 15,7 a 16,2 ms, e o relógio do WebKitGTK tem resolução de 1 ms. Os processos são encerrados pelo PID, e os diretórios temporários, apagados.

## A varredura e o movimento reduzido

A varredura de largura e o teste do movimento reduzido ([testing.md](../guidelines/testing.md)) rodam no Chromium do Playwright, com o CSS real, e provam o layout, o pixel inteiro, os tooltips, as primárias, os nomes e as regiões ao vivo em cada janela do app. O que só o motor do produto mostra fica na checklist de verificação da pull request, que se roda no app instalado: a barra de rolagem global das áreas que rolam nativamente, o anel de foco depois de um clique e de uma tecla, o meio pixel numa captura ampliada da conversa e do board a 2560 e a 1280 px, o movimento reduzido com `gsettings set org.gnome.desktop.interface enable-animations false`, a conversa longa de uma task real, o board pelo teclado de ponta a ponta e a tela de recusa de um banco de uma versão mais nova.

## Estado da janela

`StartState: WindowStateMaximised` chega a um compositor de tiling como "preencha o tile que recebeu", que é o que acontece aqui. Nada da geometria da janela é persistido. Num desktop de janelas flutuantes a mesma opção produz uma janela maximizada de verdade.

## Outras observações

- O WebKitGTK cria `~/.local/share/myspec/` (`mediakeys/`, `storage/`) no primeiro uso, derivado de `Linux.ProgramName`. É o mesmo diretório que o app usa como diretório de dados.
- O banco fica com modo 0644 em vez de 0600, porque o WebKitGTK cria o diretório antes do app.
- Capturas de tela da janela parecem semitransparentes. É o Omarchy, que marca toda janela com `opacity = "0.985 0.96"`; o fundo da janela é opaco.
