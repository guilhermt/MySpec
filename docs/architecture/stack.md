# Stack

A stack do produto e a razão de cada escolha.

## Resumo

| Camada | Escolha |
|---|---|
| Forma do app | Aplicação desktop para Linux e Windows 11 x64 |
| Base desktop | Wails v3 (`v3.0.0`), backend em Go 1.27, WebKitGTK 6.0 sobre GTK4 no Linux, WebView2 no Windows |
| Frontend | React 19 com TypeScript em modo strict, Vite |
| Estilo e componentes | Tailwind CSS 4, shadcn/ui sobre Base UI e o design system do MySpec, fontes Fira Sans e Fira Code, ícones Lucide |
| Markdown e diagramas | Streamdown, com `@streamdown/code` e `@streamdown/mermaid` |
| Listas longas | `@tanstack/react-virtual`, só como cálculo da janela |
| Diferenças de texto | jsdiff (`diff`) |
| Estado da interface | Zustand |
| Ponte Go e React | Bindings gerados e eventos tipados do Wails |
| Claude Code | CLI como subprocesso, um processo vivo por sessão, stream-json nos dois sentidos |
| Permissões e perguntas | Canal de controle do CLI por stdio (`--permission-prompt-tool stdio`) |
| Git | Binário `git`, com fsnotify observando as worktrees |
| GitHub | Binário `gh`: leituras, publicação de reviews, escrita de issues e cards e clones |
| Artefatos e prompts | Arquivos Markdown no diretório de dados do app (`~/.local/share/myspec/` no Linux, `%LOCALAPPDATA%\MySpec\data\` no Windows) |
| Estado do app | SQLite via `modernc.org/sqlite`, acessado só pelo Go |
| Notificações e tema do sistema (Linux) | D-Bus com godbus: `org.freedesktop.Notifications` e o portal de configurações |
| Notificações e tema do sistema (Windows) | Toasts do WinRT por COM (`golang.org/x/sys/windows`), o registro do usuário e o evento de tema do Wails |
| Som das notificações | WAV próprio embutido, tocado por `pw-play`, `paplay` ou `aplay` no Linux e por `PlaySoundW` no Windows |
| Logs | `slog` em JSON no diretório de estado do app (`~/.local/state/myspec/` no Linux, `%LOCALAPPDATA%\MySpec\state\` no Windows) |
| Ferramentas | mise, Task, pnpm, Biome, Vitest com jsdom, golangci-lint, gotestsum, govulncheck, go-test-coverage, lefthook, shellcheck, PowerShell e PSScriptAnalyzer |

## Desktop com Wails v3

O produto precisa ler clones locais, criar worktrees, iniciar processos e enviar notificações do sistema, e o nível de interface pretendido, com Markdown e mermaid, pede um motor web. Wails coloca uma interface web numa janela nativa com o webview do sistema, sem embutir um Chromium como o Electron. Tauri faria o mesmo com Rust; a escolha por Go, natural para gerenciar processos, ler um stream JSON, rodar git e observar arquivos, definiu o Wails.

O v3 é a arquitetura para onde o Wails vai: services com bindings gerados por análise estática, eventos tipados, runtime por métodos e build por Taskfile. Duas partes do seu backend Linux não servem ao produto: o service de notificações e a leitura do tema do sistema. Nos dois casos o app fala com o D-Bus diretamente; ver [D-Bus](#d-bus).

No Windows o Wails usa o WebView2, que o Windows 11 já traz, e o produto roda no Windows 11 x64. No Linux o Wails usa WebKitGTK. O padrão desde o v3 é GTK4 com WebKitGTK 6.0, que é o que o produto usa, exigindo `gtk4` e `webkitgtk-6.0` na máquina. A renderização foi verificada no Hyprland com GPU AMD sem nenhuma variável de ambiente; ver [target-machine.md](../development/target-machine.md).

## Frontend

**React com TypeScript** porque a interface é onde vive o refinamento e o ecossistema React tem o maior conjunto de componentes polidos, além de bibliotecas maduras de Markdown e mermaid.

**Tailwind e shadcn/ui** para estilo. shadcn entrega primitivos acessíveis como código-fonte copiado para `frontend/src/components/ui`, não como dependência com aparência própria, o que permite refinar cada componente. Os primitivos são os do Base UI, o padrão do shadcn para projetos novos. Os tokens do design system pintam os primitivos por uma ponte de variáveis, sem editá-los, e os componentes do produto são os wrappers de `components/system/`.

**Streamdown** porque o texto do agente chega em streaming e o renderizador precisa lidar com Markdown incompleto sem piscar. Ele já integra mermaid e realce de código. O mesmo renderizador serve o chat, os artefatos e os prompts.

**`@tanstack/react-virtual`** porque uma lista de milhares de linhas, como o board, só pode ter montadas as que aparecem. Ele não tem cabeça: o DOM e o elemento que rola continuam os do app, ele mede depois de montar, rola até um índice, aceita linhas fixadas (`rangeExtractor`) e corrige a rolagem quando uma linha acima da vista muda de altura. Só o hook `useWindowedRows`, de `components/system/`, o importa. Ficaram de fora `react-virtuoso`, que traz o próprio elemento que rola, e `react-window`, que não tem linhas fixadas.

**Zustand** porque os eventos do Go chegam continuamente de várias fontes e várias partes da tela mostram o mesmo dado. Um store único recebe os eventos num ponto só e cada componente assina a fatia que usa. Não há biblioteca de fetch, porque não há HTTP.

## Ponte entre React e Go

- **Bindings** para comandos com resposta: um método de um service Go vira, após `wails3 generate bindings`, uma função TypeScript tipada. A chamada atravessa a ponte do webview e executa no mesmo processo.
- **Eventos** para tudo que muda ao longo do tempo. O Go emite eventos tipados, registrados antes de o app subir para que o gerador produza os tipos, e o React os escuta e alimenta o store. O principal é `state:changed`, que carrega o estado inteiro a cada mudança; a interface nunca deriva estado, só renderiza o que recebe.

## Claude Code como subprocesso

O Agent SDK oficial exige API key e não permite o login de assinatura do claude.ai. O CLI em modo `-p` usa as mesmas credenciais da sessão interativa, ou seja, a assinatura. Por isso o app roda o CLI como subprocesso e implementa por conta própria o que o SDK daria pronto: ler o stream JSON de eventos e montar a conversa, guardar o id da sessão e retomar com `--resume`, interromper pelo canal de controle, responder escaladas de permissão e perguntas estruturadas.

Um processo vivo por sessão ativa, parado depois de dez minutos ocioso e retomado na próxima mensagem. Uma troca de modelo ou de esforço numa conversa não mexe no processo vivo: na mensagem seguinte o app o para, ocioso, e sobe outro com `--resume` e as flags novas. O canal de controle aceita `apply_flag_settings`, que faria a troca no processo vivo, mas ele não está documentado no `--help` e exigiria um pedido em voo com confirmação e timeout só para poupar a subida de um processo. O detalhe das flags e do protocolo está em [sessions.md](./sessions.md).

Ponto a acompanhar: a documentação do CLI diz que `--bare` vai virar o padrão do `-p`, e o modo bare não lê credenciais OAuth. Quando isso acontecer, o app precisa da flag de opt-out. O `system/init` do stream traz um array `capabilities` para detectar mudanças de protocolo; a versão mínima do CLI (`claude.MinVersion`) garante os recursos que o app usa.

## Git e GitHub

O app chama o binário `git`, com o mesmo comportamento do terminal do usuário; go-git foi descartado porque worktrees não são bem suportadas. Todo comando roda com `GIT_TERMINAL_PROMPT=0`, para que um fetch que peça senha falhe na hora em vez de pendurar. As operações de um mesmo repositório são serializadas pelo app.

Para o progresso do review em tempo real, o app observa a worktree com fsnotify e roda `git status` quando algo muda, em vez de consultar em intervalo.

A pull request é aberta pelo agente, com o `gh`, dentro da sessão dele. O app usa o mesmo binário, com o login que o `gh` já tem na máquina, para ler pull requests e boards, publicar reviews, escrever issues e cards e clonar.

## Armazenamento

Dois tipos de dado, cada um com uma única fonte de verdade:

- **Artefatos**: PRD, tech spec, arquivos de step, documentos One-Shot, rascunhos de PR, relatórios de review e prompts editados. Markdown no diretório de dados do app, uma pasta por task. As sessões os leem por caminho, e como arquivos ficam legíveis e diffáveis fora do app.
- **Estado**: tasks, etapa, status de cada step e da pull request, repositórios cadastrados, sessões, worktrees, situações, modelos e configurações. SQLite com `modernc.org/sqlite`, acessado só pelo Go com `database/sql`, tipado e com transações.

Nada de estado vive nos Markdown. Ver [storage.md](./storage.md).

## D-Bus

No Linux, o app fala direto com o barramento de sessão pelo godbus, que o Wails já traz no grafo de módulos, para três coisas:

- **Notificações**, pelo serviço `org.freedesktop.Notifications`. O service de notificações do Wails v3 entrega, no Linux, uma notificação dispensada pelo usuário como um clique, o que traria a janela para a frente sem o usuário pedir. No serviço direto um clique chega como `ActionInvoked` e dispensar só tira a notificação da lista.
- **Tema do sistema**, pelo portal `org.freedesktop.portal.Settings`, assinando `SettingChanged`. No backend GTK4 do Wails, `Env.IsDarkMode()` responde falso antes de o loop principal começar e o evento `ThemeChanged` nunca dispara. Ler o portal diretamente também põe a cor certa atrás do webview desde o primeiro frame, porque a leitura acontece antes de a janela ser criada.
- **Não perturbe**, lendo o estado que o KDE Plasma (propriedade `Inhibited`), o dunst (`org.dunstproject.cmd0.paused`) e o swaync (`GetDnd`) expõem. As leituras vão com `FlagNoAutoStart`, para que perguntar por um daemon instalado mas parado não o inicie ao lado do servidor que está rodando.

## Windows

No Windows o app fala com a plataforma do sistema por `golang.org/x/sys/windows`, que já é dependência direta, para três coisas:

- **Notificações**, por toasts do WinRT. O service de notificações do Wails grava `LocalServer32` no registro, o que faria um clique abrir o app fechado, e não retira um toast já entregue. O WinRT direto, chamado por COM pelo `x/sys/windows`, cobre a identidade, o `Tag` e o `Group`, o clique pelo activator, a retirada e a leitura do modo de notificação, sem dependência nova.
- **Tema do sistema**, pelo modo de app (`AppsUseLightTheme`) no registro, lido antes de a janela ser criada, e pelo evento `SystemThemeChanged` do Wails, que no Windows funciona: ele sai do broadcast `ImmersiveColorSet` na hora da troca. A barra de título é pintada por `w32.SetTheme`, para seguir o tema do app mesmo quando o usuário o fixa. A cor atrás do webview só é repintada depois do `WindowRuntimeReady` da janela (`backdrop`, em `internal/app/backdrop.go`): o Wails a pinta pelo controller do WebView2, que só existe quando o webview termina de iniciar, e uma repintura antes disso derruba o app. Uma troca de tema nesse intervalo espera o evento, e a janela abre com a cor das opções.
- **Não perturbe**, lendo o `NotificationMode` do Windows e as configurações de banner e de som do MySpec no registro. A lista de prioritários o Windows não expõe, e por isso não é seguida: todo modo diferente de Unrestricted silencia o carrilhão, e um Windows que não informa o modo o deixa tocar.

## Som das notificações

O som é do app e é o mesmo em toda distribuição: `internal/platform/chime/chime.wav`, gerado por `gen.go` a partir de senoides, sem licença de terceiros a acompanhar. É um WAV PCM de 16 bits, mono, 48 kHz, o formato que os três players leem.

Quando o servidor de notificações toca sons, anunciando a capacidade `sound`, como o GNOME Shell, quem toca é ele, com o arquivo do app na hint `sound-file`, e o não perturbe e as preferências de som são os dele. Quando não toca, o app roda um player de áudio do sistema: `pw-play` (PipeWire), `paplay` (PulseAudio, que o PipeWire também serve) e `aplay` (ALSA), nessa ordem, passando ao seguinte quando um falta ou falha. Rodar o player cobre as três pilhas de áudio do Linux sem cgo nem módulo novo, do mesmo jeito que o app já roda `git` e `gh`. Um cliente PulseAudio em Go puro cobriria só a primeira pilha, e o ALSA por cgo manteria um dispositivo de áudio aberto enquanto o app roda.

O não perturbe não tem padrão freedesktop. O app pergunta a quem o expõe: o shell do Omarchy, por `omarchy-shell notifications isDnd`, e o KDE Plasma, o dunst e o swaync, pelo D-Bus. Num sistema que não expõe o estado, o som toca sempre que a notificação é enviada.

No Windows o toast vai mudo, porque um app sem pacote não põe um som próprio num toast, e o app toca o mesmo `chime.wav` com `PlaySoundW` quando `Toaster.Quiet` deixa.

## Ferramentas de desenvolvimento

- **mise** pina, em `mise.toml`, as versões de Go, Node, pnpm, Task, golangci-lint, gotestsum, lefthook, shellcheck, PowerShell, Biome, govulncheck e go-test-coverage. O CI instala dele as ferramentas que usa. O CLI `wails3` é uma diretiva `tool` do `go.mod`, instalada por `go install tool` no setup. A versão dele é a mesma da biblioteca Wails que o app importa, então os bindings são gerados pelo CLI que corresponde ao runtime, e o Dependabot atualiza os dois juntos.
- **Task** orquestra tudo: dev, build, geração de bindings, formatação, lint, typecheck, testes, vulnerabilidades e a checagem completa.
- **Releases**: `task release` é um programa Go, `cmd/release`, testado contra repositórios git reais como o resto do código, e o workflow `release.yml` builda os dois pacotes, Linux e Windows, e publica a partir da tag no Ubuntu 24.04, o Windows por compilação cruzada, com o `gh` do runner e sem action de terceiros. O zip do pacote Windows sai de `cmd/zip`, um programa Go com a biblioteca padrão, porque o `zip` do sistema grava a data local de cada arquivo e não é instalado pelo setup. Ver [release.md](../development/release.md).
- **Frontend**: pnpm, Biome para lint e formatação no lugar de ESLint e Prettier, Vitest com Testing Library no jsdom, para o comportamento, a acessibilidade e a cobertura.
- **Go**: golangci-lint v2 com gofumpt e goimports, gotestsum, cobertura com limiares por arquivo, pacote e total.
- **Scripts de instalação**: `shellcheck` no `install.sh`, checado como POSIX `sh`, e PSScriptAnalyzer no `install.ps1`, com as regras de compatibilidade do Windows PowerShell 5.1 e do PowerShell 7.
- **knip** acha o arquivo e a dependência que nada usa. O código sem uso é o que um design antigo deixa para trás, e o knip o pega em todo `task check`, em cerca de 1 s.
- **lefthook** instala um hook de pre-commit que só formata os arquivos em stage.

Ver [setup.md](../development/setup.md) e [ci.md](../development/ci.md).
