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
- Com `chmod 000` no diretório de dados, a janela abre e fica aberta com `MySpec couldn't start`, o texto da permissão com o diretório de dados resolvido, o erro `data directory: probe: open <caminho>: permission denied` no bloco copiável e **Try again** com o foco; o log tem `startup failed` com o mesmo erro, e o processo não sai. **Try again** recomeça o início no mesmo processo, coberto em `internal/app/startup_test.go` e em `StartScreen.test.tsx`; o clique na janela real com a permissão devolvida não foi exercitado.
- Com o diretório de dados num `tmpfs` de 1 MiB quase cheio (`unshare -Urm`, `mount -t tmpfs -o size=1M tmpfs <dir>` e `fallocate` do espaço), o início falha com `open database: commit migration 0001_initial.sql: database or disk is full (13)`. O erro do SQLite (`SQLITE_FULL`) é o que `store.DiskFull` reconhece como `disk_full`, e a janela mostra `MySpec can't open its data: the disk of <diretório de dados> is full. Free some space, then try again.`

## Estado da janela

`StartState: WindowStateMaximised` chega a um compositor de tiling como "preencha o tile que recebeu", que é o que acontece aqui. Nada da geometria da janela é persistido. Num desktop de janelas flutuantes a mesma opção produz uma janela maximizada de verdade.

## Outras observações

- O WebKitGTK cria `~/.local/share/myspec/` (`mediakeys/`, `storage/`) no primeiro uso, derivado de `Linux.ProgramName`. É o mesmo diretório que o app usa como diretório de dados.
- O banco fica com modo 0644 em vez de 0600, porque o WebKitGTK cria o diretório antes do app.
- Capturas de tela da janela parecem semitransparentes. É o Omarchy, que marca toda janela com `opacity = "0.985 0.96"`; o fundo da janela é opaco.
