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

`frontend/src/dev/measure-history.tsx` mede a lista com 400 itens (240 tasks, 100 reviews e 60 discussões, em 90 dias, numa área de 1566 px por 900): a primeira pintura, do render ao quadro seguinte ao commit com o layout feito, e `↓` a partir do primeiro dia, do `keydown` ao quadro seguinte, uma vez fria e cinco vezes quente, em 37 linhas montadas. As metas são as do board, 300 ms e 16 ms, e passam pela mesma regra: o máximo das quentes em produção e a mediana das quentes em desenvolvimento dentro delas, com o piso de 16,7 ms de um quadro a 60 Hz. Para medir na máquina alvo, abra `?measure=history` no servidor de desenvolvimento (porta 9245) ou no build de medida (porta 9246, `pnpm measure:build` e `pnpm measure:serve`), como o [setup](./setup.md) descreve, e leia os números que a página escreve; o como-medir do Broadway está na seção seguinte.

No WebKitGTK 2.52.6, pelo Broadway, em cinco rodadas no build de produção e quatro no de desenvolvimento:

| React de produção (`pnpm measure:build`) | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 42 a 49 ms | 33 a 43 ms | 56 a 78 ms | 300 ms |
| `↓` na lista | 34 a 37 ms | 16 a 17 ms | 16 a 18 ms (16 em três das cinco) | 16 ms |

| React de desenvolvimento (`task dev`) | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 53 a 59 ms | 45 a 50 ms | 81 a 84 ms | 300 ms |
| `↓` na lista | 29 a 31 ms | 16 ms (18 em uma) | 16 a 22 ms (16 em duas das quatro) | 16 ms |

No Chromium 153 do Playwright, em três rodadas por build:

| | Fria | Quente, mediana | Quente, máximo |
|---|---|---|---|
| Primeira pintura, produção | 27 a 34 ms | 24 a 25 ms | 46 ms |
| `↓` na lista, produção | 14 ms | 16,2 a 16,4 ms | 16,9 a 17,1 ms |
| Primeira pintura, desenvolvimento | 35 a 36 ms | 69 a 74 ms | 96 a 98 ms |
| `↓` na lista, desenvolvimento | 19 a 21 ms | 16,2 a 16,4 ms | 16,9 a 17,2 ms |

O `↓` fica no piso de um quadro, 16,7 ms: o trabalho da tecla é o foco, que só refaz as linhas que mudaram (`memo`), e um perfil no Chromium mostra o tempo do `↓` quase todo ocioso, à espera do quadro. O que passa de 16 ms numa rodada é a variação do Broadway, que desenha sem GPU: o board, medido na mesma sessão, deu máximo de `↓` de 16, 16 e 31 ms em três rodadas.

O teste `frontend/src/features/history/HistoryView.measure.painted.test.tsx` continua no Chromium e compara, na mesma execução, 400 itens com 40: a razão das medianas quentes fica perto de 1, e o teste falha acima de 30, o que pega uma lista que deixou de ser janela.

## As listas virtualizadas

O board monta só as linhas que aparecem, a da parada de Tab e a do card aberto, entre espaçadores (`useWindowedRows`, que o History também usa, medido na seção anterior). `frontend/src/dev/measure-board.tsx` o mede com 2.000 cards em dez status, todas as seções abertas: a primeira pintura, do render ao quadro seguinte ao commit, uma tecla na busca, do `input` ao quadro com a lista nova, e `↓`, do `keydown` ao quadro seguinte, uma vez fria e cinco vezes quente, em 44 linhas montadas. As metas são 300 ms, 50 ms e 16 ms, e passam quando o máximo das quentes em produção e a mediana das quentes em desenvolvimento ficam dentro delas. Um quadro a 60 Hz dura 16,7 ms, que é o piso de uma medida que termina no quadro seguinte; o `↓` mede esse piso.

No WebKitGTK 2.52.6 (WebKit 6.0 sobre GTK4 4.22.4), pelo Broadway:

| React de produção (`pnpm measure:build`) | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 65 ms | 36 ms | 60 ms | 300 ms |
| Uma tecla na busca | 15 ms | 16 ms | 16 ms | 50 ms |
| `↓` na lista | 15 ms | 16 ms | 16 ms | 16 ms |

| React de desenvolvimento (`task dev`) | Fria | Quente, mediana | Quente, máximo | Meta |
|---|---|---|---|---|
| Primeira pintura | 83 ms | 51 ms | 79 ms | 300 ms |
| Uma tecla na busca | 21 ms | 16 ms | 18 ms | 50 ms |
| `↓` na lista | 14 ms | 16 ms | 16 ms | 16 ms |

No Chromium 153 do Playwright, para comparar:

| | Fria | Quente, mediana | Quente, máximo |
|---|---|---|---|
| Primeira pintura, produção | 46 ms | 23 ms | 41 ms |
| Uma tecla na busca, produção | 12 ms | 17 ms | 17 ms |
| `↓` na lista, produção | 16 ms | 17 ms | 17 ms |
| Primeira pintura, desenvolvimento | 61 ms | 67 ms | 91 ms |
| Uma tecla na busca, desenvolvimento | 18 ms | 17 ms | 17 ms |
| `↓` na lista, desenvolvimento | 16 ms | 17 ms | 17 ms |

O app e o `MiniBrowser` rodam sem janela pelo backend Broadway do GTK, que desenha sem GPU: `gtk4-broadwayd :N`, com `N` numa porta acima de 8090 (nunca a 8090), e o programa com `GDK_BACKEND=broadway`, `BROADWAY_DISPLAY=:N` e `env -i` com `HOME` e `XDG_*` temporários (`XDG_RUNTIME_DIR` é o do usuário, onde o `broadwayd` põe o socket). O `MiniBrowser` abre a URL de medida, e um navegador qualquer aberto na porta `8080 + N` mostra a janela, onde a página da medida cobre a tela com os números. Os processos são encerrados pelo PID, e os diretórios temporários, apagados.

## Estado da janela

`StartState: WindowStateMaximised` chega a um compositor de tiling como "preencha o tile que recebeu", que é o que acontece aqui. Nada da geometria da janela é persistido. Num desktop de janelas flutuantes a mesma opção produz uma janela maximizada de verdade.

## Outras observações

- O WebKitGTK cria `~/.local/share/myspec/` (`mediakeys/`, `storage/`) no primeiro uso, derivado de `Linux.ProgramName`. É o mesmo diretório que o app usa como diretório de dados.
- O banco fica com modo 0644 em vez de 0600, porque o WebKitGTK cria o diretório antes do app.
- Capturas de tela da janela parecem semitransparentes. É o Omarchy, que marca toda janela com `opacity = "0.985 0.96"`; o fundo da janela é opaco.
