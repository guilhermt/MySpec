# Stack

A stack do produto e a razão de cada escolha.

## Resumo

| Camada | Escolha |
|---|---|
| Forma do app | Aplicação desktop para Linux |
| Base desktop | Wails v3 (`v3.0.0-beta.16`), backend em Go 1.27, WebKitGTK 6.0 sobre GTK4 |
| Frontend | React 19 com TypeScript em modo strict, Vite |
| Estilo e componentes | Tailwind CSS 4 e shadcn/ui sobre Base UI, ícones Lucide |
| Markdown e diagramas | Streamdown, com `@streamdown/code` e `@streamdown/mermaid` |
| Estado da interface | Zustand |
| Ponte Go e React | Bindings gerados e eventos tipados do Wails |
| Claude Code | CLI como subprocesso, um processo vivo por sessão, stream-json nos dois sentidos |
| Permissões e perguntas | Canal de controle do CLI por stdio (`--permission-prompt-tool stdio`) |
| Git | Binário `git`, com fsnotify observando as worktrees |
| GitHub | Binário `gh`, somente leitura |
| Artefatos e prompts | Arquivos Markdown no diretório de dados XDG |
| Estado do app | SQLite via `modernc.org/sqlite`, acessado só pelo Go |
| Notificações e tema do sistema | D-Bus com godbus: `org.freedesktop.Notifications` e o portal de configurações |
| Som das notificações | WAV próprio embutido, tocado por `pw-play`, `paplay` ou `aplay` |
| Logs | `slog` em JSON no diretório de estado XDG |
| Ferramentas | mise, Task, pnpm, Biome, Vitest, golangci-lint, gotestsum, govulncheck, go-test-coverage, lefthook |

## Desktop com Wails v3

O produto precisa abrir uma pasta, escanear repositórios, criar worktrees, iniciar processos e enviar notificações do sistema, e o nível de interface pretendido, com Markdown e mermaid, pede um motor web. Wails coloca uma interface web numa janela nativa com o webview do sistema, sem embutir um Chromium como o Electron. Tauri faria o mesmo com Rust; a escolha por Go, natural para gerenciar processos, ler um stream JSON, rodar git e observar arquivos, definiu o Wails.

O v3 é a arquitetura para onde o Wails vai: services com bindings gerados por análise estática, eventos tipados, runtime por métodos e build por Taskfile. Ele ainda é pré-release, e duas partes do seu backend Linux não servem ao produto: o service de notificações e a leitura do tema do sistema. Nos dois casos o app fala com o D-Bus diretamente; ver [D-Bus](#d-bus).

No Linux o Wails usa WebKitGTK. O padrão desde o v3 é GTK4 com WebKitGTK 6.0, que é o que o produto usa, exigindo `gtk4` e `webkitgtk-6.0` na máquina. A renderização foi verificada no Hyprland com GPU AMD sem nenhuma variável de ambiente; ver [target-machine.md](../development/target-machine.md).

## Frontend

**React com TypeScript** porque a interface é onde vive o refinamento e o ecossistema React tem o maior conjunto de componentes polidos, além de bibliotecas maduras de Markdown e mermaid.

**Tailwind e shadcn/ui** para estilo. shadcn entrega primitivos acessíveis como código-fonte copiado para `frontend/src/components/ui`, não como dependência com aparência própria, o que permite refinar cada componente. Os primitivos são os do Base UI, o padrão do shadcn para projetos novos.

**Streamdown** porque o texto do agente chega em streaming e o renderizador precisa lidar com Markdown incompleto sem piscar. Ele já integra mermaid e realce de código. O mesmo renderizador serve o chat, os artefatos e os prompts.

**Zustand** porque os eventos do Go chegam continuamente de várias fontes e várias partes da tela mostram o mesmo dado. Um store único recebe os eventos num ponto só e cada componente assina a fatia que usa. Não há biblioteca de fetch, porque não há HTTP.

## Ponte entre React e Go

- **Bindings** para comandos com resposta: um método de um service Go vira, após `wails3 generate bindings`, uma função TypeScript tipada. A chamada atravessa a ponte do webview e executa no mesmo processo.
- **Eventos** para tudo que muda ao longo do tempo. O Go emite eventos tipados, registrados antes de o app subir para que o gerador produza os tipos, e o React os escuta e alimenta o store. O principal é `state:changed`, que carrega o estado inteiro a cada mudança; a interface nunca deriva estado, só renderiza o que recebe.

## Claude Code como subprocesso

O Agent SDK oficial exige API key e não permite o login de assinatura do claude.ai. O CLI em modo `-p` usa as mesmas credenciais da sessão interativa, ou seja, a assinatura. Por isso o app roda o CLI como subprocesso e implementa por conta própria o que o SDK daria pronto: ler o stream JSON de eventos e montar a conversa, guardar o id da sessão e retomar com `--resume`, interromper pelo canal de controle, responder escaladas de permissão e perguntas estruturadas.

Um processo vivo por sessão ativa, parado depois de dez minutos ocioso e retomado na próxima mensagem. Uma troca de modelo ou de esforço numa conversa não mexe no processo vivo: na mensagem seguinte o app o para, ocioso, e sobe outro com `--resume` e as flags novas. O canal de controle aceita `apply_flag_settings`, que faria a troca no processo vivo, mas ele não está documentado no `--help` e exigiria um pedido em voo com confirmação e timeout só para poupar a subida de um processo. O detalhe das flags e do protocolo está em [sessions.md](./sessions.md).

Ponto a acompanhar: a documentação do CLI diz que `--bare` vai virar o padrão do `-p`, e o modo bare não lê credenciais OAuth. Quando isso acontecer, o app precisa da flag de opt-out. O `system/init` do stream traz um array `capabilities` para detectar mudanças de protocolo sem comparar versões.

## Git e GitHub

O app chama o binário `git`, com o mesmo comportamento do terminal do usuário; go-git foi descartado porque worktrees não são bem suportadas. Todo comando roda com `GIT_TERMINAL_PROMPT=0`, para que um fetch que peça senha falhe na hora em vez de pendurar. As operações de um mesmo repositório são serializadas pelo app.

Para o progresso do review em tempo real, o app observa a worktree com fsnotify e roda `git status` quando algo muda, em vez de consultar em intervalo.

A pull request é aberta pelo agente, com o `gh`, dentro da sessão dele. O app usa o mesmo binário só em leitura, reaproveitando o login que o `gh` já tem na máquina.

## Armazenamento

Dois tipos de dado, cada um com uma única fonte de verdade:

- **Artefatos**: PRD, tech spec, arquivos de step, rascunhos de PR, relatórios de review e prompts editados. Markdown no diretório de dados XDG, uma pasta por task. As sessões os leem por caminho, e como arquivos ficam legíveis e diffáveis fora do app.
- **Estado**: tasks, etapa, status de cada step e de cada repositório, sessões, worktrees, situações, modelos e configurações. SQLite com `modernc.org/sqlite`, acessado só pelo Go com `database/sql`, tipado e com transações.

Nada de estado vive nos Markdown. Ver [storage.md](./storage.md).

## D-Bus

O app fala direto com o barramento de sessão pelo godbus, que o Wails já traz no grafo de módulos, para três coisas:

- **Notificações**, pelo serviço `org.freedesktop.Notifications`. O service de notificações do Wails v3 entrega, no Linux, uma notificação dispensada pelo usuário como um clique, o que traria a janela para a frente sem o usuário pedir. No serviço direto um clique chega como `ActionInvoked` e dispensar só tira a notificação da lista.
- **Tema do sistema**, pelo portal `org.freedesktop.portal.Settings`, assinando `SettingChanged`. No backend GTK4 do Wails, `Env.IsDarkMode()` responde falso antes de o loop principal começar e o evento `ThemeChanged` nunca dispara. Ler o portal diretamente também põe a cor certa atrás do webview desde o primeiro frame, porque a leitura acontece antes de a janela ser criada.
- **Não perturbe**, lendo o estado que o KDE Plasma (propriedade `Inhibited`), o dunst (`org.dunstproject.cmd0.paused`) e o swaync (`GetDnd`) expõem. As leituras vão com `FlagNoAutoStart`, para que perguntar por um daemon instalado mas parado não o inicie ao lado do servidor que está rodando.

## Som das notificações

O som é do app e é o mesmo em todo sistema: `internal/platform/chime/chime.wav`, gerado por `gen.go` a partir de senoides, sem licença de terceiros a acompanhar. É um WAV PCM de 16 bits, mono, 48 kHz, o formato que os três players leem.

Quando o servidor de notificações toca sons, anunciando a capacidade `sound`, como o GNOME Shell, quem toca é ele, com o arquivo do app na hint `sound-file`, e o não perturbe e as preferências de som são os dele. Quando não toca, o app roda um player de áudio do sistema: `pw-play` (PipeWire), `paplay` (PulseAudio, que o PipeWire também serve) e `aplay` (ALSA), nessa ordem, passando ao seguinte quando um falta ou falha. Rodar o player cobre as três pilhas de áudio do Linux sem cgo nem módulo novo, do mesmo jeito que o app já roda `git` e `gh`. Um cliente PulseAudio em Go puro cobriria só a primeira pilha, e o ALSA por cgo manteria um dispositivo de áudio aberto enquanto o app roda.

O não perturbe não tem padrão freedesktop. O app pergunta a quem o expõe: o shell do Omarchy, por `omarchy-shell notifications isDnd`, e o KDE Plasma, o dunst e o swaync, pelo D-Bus. Num sistema que não expõe o estado, o som toca sempre que a notificação é enviada.

## Ferramentas de desenvolvimento

- **mise** pina, em `mise.toml`, as versões de Go, Node, pnpm, Task, golangci-lint, gotestsum, lefthook, Biome, govulncheck e go-test-coverage. O CI instala o mesmo arquivo. O CLI `wails3` é instalado por `go install` numa tarefa de setup.
- **Task** orquestra tudo: dev, build, geração de bindings, formatação, lint, typecheck, testes, vulnerabilidades e a checagem completa.
- **Frontend**: pnpm, Biome para lint e formatação no lugar de ESLint e Prettier, Vitest com Testing Library e jsdom.
- **Go**: golangci-lint v2 com gofumpt e goimports, gotestsum, cobertura com limiares por arquivo, pacote e total.
- **lefthook** instala um hook de pre-commit que só formata os arquivos em stage.

Ver [setup.md](../development/setup.md) e [ci.md](../development/ci.md).
