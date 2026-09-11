# Stack

Este documento registra a stack técnica escolhida para o produto descrito em [PRODUCT.md](./PRODUCT.md), com as razões de cada escolha e as alternativas descartadas. As decisões foram tomadas em 2026-09-05.

## Resumo

| Camada | Escolha |
|---|---|
| Forma do app | Aplicação desktop |
| Base desktop | Wails v3, backend em Go, webview do sistema |
| Frontend | React com TypeScript |
| Estilo e componentes | Tailwind CSS e shadcn/ui sobre Base UI |
| Markdown e diagramas | Streamdown, com mermaid |
| Estado da interface | Zustand |
| Ponte Go e React | Bindings e eventos do Wails |
| Claude Code | CLI como subprocesso, um processo vivo por sessão |
| Permissões das sessões | Canal de controle do CLI por stdio (`--permission-prompt-tool stdio`) |
| Git | Binário `git`, com fsnotify para observar as worktrees |
| GitHub | Binário `gh`, somente leitura |
| Artefatos | Arquivos Markdown no diretório de dados XDG |
| Estado do app | SQLite via `modernc.org/sqlite`, acessado só pelo Go |
| Notificações | Serviço de notificações do desktop (`org.freedesktop.Notifications`) pelo D-Bus, com godbus |
| Ferramentas | mise, pnpm, Biome, Vitest, golangci-lint, slog, Taskfile |

## Forma do app: desktop

Os requisitos exigem algo que roda na máquina do usuário: abrir uma pasta, escanear repositórios, criar worktrees, iniciar processos do Claude Code, enviar notificações do sistema. Isso deixou duas formas viáveis: um app desktop ou um processo local servindo a interface no navegador.

A escolha foi desktop. Abrir o app numa pasta como o VS Code faz, ter uma área de trabalho única e receber notificações nativas são experiências de desktop, e o nível de refinamento pretendido fica mais coeso numa janela própria do que numa aba de navegador.

## Base desktop: Wails v3

### Por que web na interface

Com o nível de interface pretendido e a necessidade de renderizar Markdown com mermaid, a interface é feita com tecnologia web dentro de uma janela nativa. Mermaid só renderiza bem num motor web, e o ecossistema de componentes refinados é web.

### Alternativas descartadas

- **Electron.** Descartado pelo consumo de recursos. Embute um Chromium inteiro, com custo de memória e binário muito acima do necessário para este app.
- **Tauri.** Mesma arquitetura do Wails, com backend em Rust em vez de Go. Ficou como alternativa equivalente; a decisão entre os dois foi pela linguagem do backend.
- **Flutter.** Renderizador próprio, leve e rápido, mas sem webview oficial para Linux, o que torna mermaid uma gambiarra.
- **GUI nativa em Rust** (GPUI, Iced, Slint). O máximo de desempenho, mas sem ecossistema de componentes prontos e sem caminho para mermaid.

Nas alternativas sem webview, os diagramas exigiriam trocar mermaid por Graphviz ou D2, que têm renderizadores nativos para SVG.

### Por que Go, e portanto Wails

O backend deste app é gerenciamento de processos, leitura de um stream JSON, comandos git, um pequeno servidor MCP e observação de arquivos. Go faz tudo isso de forma natural, com concorrência simples e um SDK oficial de MCP. Rust faz o mesmo com mais cerimônia. A escolha por Go define Wails.

### Por que v3 e não v2

Em 2026-08-29 o Wails v3 estava em `v3.0.0-beta.16`, com cinco betas em duas semanas. O projeto declara a API estável, mas ainda pré-release. Ainda assim, v3 é a arquitetura para onde o projeto vai, e começar em v2 significaria migrar depois. Para um produto que levará meses para ser construído, o custo de eventualmente esbarrar num bug de beta é menor que o custo de uma migração.

O que muda de v2 para v3 e importa aqui:

- Arquitetura procedural: criar o app, criar janelas, rodar. Múltiplas janelas, system tray e dock nativos.
- Bindings viram services: structs Go simples registradas como services, com injeção de dependência explícita. Bindings gerados por analisador estático com tipos TypeScript completos, agrupados por service.
- Runtime por métodos em objetos, sem contexto global.
- Eventos tipados, com eventos comuns entre plataformas e hooks síncronos.
- Services embutidos: notificações, SQLite, key-value store, log, file server.
- Build transparente baseado em Taskfile, CLI `wails3`.
- Inicialização mais rápida, menos memória, overhead de chamada abaixo de 1ms.

### O webview no Linux

O Wails usa WebKitGTK no Linux, igual ao Tauri. Desde o v3 alpha.93 o padrão é GTK4 com WebKitGTK 6.0; o caminho GTK3 com webkit2gtk-4.1 existe pela tag de build `gtk3` e é legado. O produto usa o padrão, GTK4, o que exige o pacote `webkitgtk-6.0` na máquina. Em Hyprland e Wayland ele funciona, mas há casos que exigem variáveis de ambiente para evitar tela preta ou glitches, principalmente com NVIDIA. Esse ponto é verificado no primeiro scaffold do projeto, na máquina alvo.

## Frontend

### React com TypeScript

A interface é onde vive o refinamento, então a profundidade do ecossistema pesa. React tem o maior conjunto de componentes polidos: shadcn/ui sobre Base UI ou Radix, painéis redimensionáveis, command palettes, listas virtualizadas, visualizadores de diff. As bibliotecas de Markdown e mermaid são maduras, e o Wails tem template React.

Svelte 5 foi considerado: mais enxuto e rápido em runtime, com shadcn-svelte e Bits UI cobrindo o básico. A diferença de runtime é irrelevante para este app, e o ecossistema de componentes é o que entrega o polimento sem construir tudo à mão.

### Tailwind CSS e shadcn/ui

Tailwind para estilo. shadcn/ui fornece primitivos acessíveis como código-fonte copiado para o projeto, não como dependência com aparência própria. Os primitivos são os do Base UI, padrão do shadcn para projetos novos desde julho de 2026; Radix segue suportado pelo shadcn e foi a primeira escolha deste documento, trocada em 2026-09-05 para não migrar depois. Isso permite refinar cada componente até onde for necessário e manter uma identidade visual própria.

Bibliotecas de design system completas, como Mantine ou Chakra, foram descartadas: mais rápidas para começar, mais difíceis de dobrar para um visual distinto.

### Streamdown para Markdown e mermaid

O texto do agente chega em streaming, e o renderizador precisa lidar com Markdown incompleto sem piscar. O Streamdown é feito para chat de IA com streaming, e já integra mermaid e realce de código. A base considerada antes dele foi react-markdown com remark-gfm, Shiki e mermaid; ela fica como plano B caso o Streamdown não atenda no protótipo.

O mesmo renderizador é usado no chat das sessões, na leitura dos artefatos e na área de prompts.

### Zustand para o estado da interface

Os eventos do Go chegam continuamente de várias fontes: trechos do chat, mudanças de stage no git, transições de etapa, escaladas de permissão. Várias partes da tela mostram o mesmo dado. Um store único recebe os eventos num ponto só, e cada componente assina apenas a fatia que usa, re-renderizando só quando ela muda.

Context com useReducer foi descartado porque re-renderiza todos os consumidores a cada mudança, o que pesa com streaming de texto. Não há biblioteca de fetch, porque não há requisições HTTP.

### Ponte entre React e Go

O Wails v3 dá dois canais:

- **Bindings** para comandos com resposta, como criar task ou aprovar step. Um método Go num service vira, após `wails3 generate bindings`, uma função TypeScript tipada. A chamada atravessa a ponte interna do webview e executa no mesmo processo, sem HTTP, porta ou rede.
- **Eventos** para tudo que muda ao longo do tempo. O Go emite com `app.Event.Emit`, o React escuta com `Events.On` e alimenta o store.

## Integração com o Claude Code

### CLI como subprocesso, não o Agent SDK

O Agent SDK existe oficialmente só em TypeScript e Python, e a documentação orienta autenticação por API key, com uma nota de que produtos construídos nele não podem oferecer login claude.ai. O requisito é usar a assinatura do usuário, pelo login local do Claude Code, sem pagar por API key.

O CLI em modo `-p`, sem `--bare`, usa as mesmas credenciais da sessão interativa, ou seja, a assinatura. A documentação é explícita: o modo bare "não usa seu login de assinatura", o que confirma que o modo normal usa. Por isso o app roda o CLI como subprocesso, e o SDK fica fora.

O que o SDK daria pronto e o app implementa por conta própria:

- ler o stream JSON de eventos do processo, linha a linha, e montar a conversa a partir dele;
- guardar o id da sessão e usar `--resume` para continuar;
- interromper com sinal;
- responder escaladas de permissão e perguntas estruturadas, pelo canal de controle no stdin e no stdout.

O custo real é de manutenção, porque o formato evolui com as versões do CLI. O `system/init` do stream traz um array `capabilities` para detectar comportamentos do protocolo sem comparar versões.

### Modelo de processos

Um processo `claude` vivo por sessão ativa, com `--output-format stream-json` e `--input-format stream-json`. O app escreve as mensagens do usuário na entrada e lê o stream de eventos para renderizar o chat em tempo real. Pausar mata o processo. Retomar sobe outro com `--resume` e o id da sessão. Interromper uma resposta é um `control_request` de `interrupt` escrito no stdin; o CLI encerra o turno com um `result` abortado e segue vivo. Um processo ocioso ocupa cerca de 260 MB, por isso o app o encerra depois de 10 minutos sem atividade e o retoma, com `--resume`, na próxima mensagem.

Um processo por mensagem foi descartado: paga a inicialização do CLI a cada mensagem e não permite interromper no meio de um turno.

### Flags relevantes

- `--permission-mode auto`, o mesmo modo que o usuário usa hoje.
- `--model` por etapa, conforme a configuração da task. Comandos como `/model` e `/effort` também funcionam dentro do prompt em modo `-p`.
- `--permission-prompt-tool stdio`, que faz as escaladas chegarem como `control_request` no stdout e aceita a resposta como `control_response` no stdin, o mesmo canal que o Agent SDK usa.
- `--session-id` na primeira execução e `--resume` nas seguintes, para o app escolher o id da sessão.
- `--include-partial-messages` com `--verbose` para receber tokens conforme são gerados.

Ponto a acompanhar: a documentação diz que `--bare` vai virar o padrão do `-p` numa versão futura, e bare não lê credenciais OAuth. Quando isso acontecer, o app precisa passar a flag de opt-out para continuar usando a assinatura.

### Permissões pelo canal de controle

Em `-p`, sem ninguém para responder, o CLI nega qualquer ação que pediria confirmação. Com `--permission-prompt-tool stdio`, ele escreve o pedido no stdout como `control_request` `can_use_tool`, com a ferramenta, a entrada exata, sugestões de regra e o motivo da escalada, e espera um `control_response` no stdin com `allow` ou `deny`. Perguntas estruturadas do agente (`AskUserQuestion`) chegam pelo mesmo canal e são respondidas com as opções escolhidas. Não há servidor MCP nem porta local. Verificado em 2026-09-05 com o Claude Code 2.1.261; o `system/init` traz `capabilities` para detectar mudanças de protocolo.

## Git e GitHub

### Binário git

O app precisa criar e apagar worktrees, ler o estado de stage, verificar worktree limpa e atualizar a dev local. Ele chama o binário `git`, com comandos como `git worktree add` e `git status --porcelain`. O comportamento é idêntico ao terminal do usuário.

go-git foi descartado: worktrees não são bem suportadas e o comportamento nem sempre bate com o git real.

Todo comando roda com `GIT_TERMINAL_PROMPT=0`. Sem um terminal para responder, um `git fetch` que peça usuário ou senha ficaria pendurado até o timeout; assim ele falha na hora, com a mensagem do próprio git, que é o que o app mostra ao usuário.

As operações de git de um mesmo repositório são serializadas pelo app, uma de cada vez. Duas tasks no mesmo repositório implementam em paralelo, cada uma na sua worktree, mas os comandos que tocam o repositório compartilhado não se atropelam.

### fsnotify

Para o progresso do review em tempo real, o app observa a worktree com fsnotify e roda `git status` quando algo muda, em vez de consultar em intervalo.

### Binário gh

A abertura da PR é do agente, pela skill, usando o `gh`. O app usa o mesmo binário só em leitura, com `gh pr view --json url,state` na branch da worktree, para mostrar o link e o estado da PR. Sem token próprio, sem API do GitHub no código, reaproveitando o login que o `gh` já tem na máquina.

## Armazenamento

Dois tipos de dado, cada um com uma única fonte de verdade:

- **Artefatos**: PRD, tech spec, arquivos de step e prompts. Todos Markdown. Vivem como arquivos no diretório de dados do app, seguindo XDG, uma pasta por task. As sessões do Claude Code precisam lê-los por caminho, e como arquivos eles ficam legíveis, diffáveis e inspecionáveis fora do app.
- **Estado**: tasks, etapa, status de step, ids de sessão, caminhos de worktree, modelo e esforço por etapa, configurações. Vive em SQLite, com o driver `modernc.org/sqlite`, o mesmo que o service de SQLite do Wails usa por dentro, acessado só pelo Go com `database/sql`. O service do Wails existe para expor SQL ao frontend; como o produto é o dono do estado, o SQL fica no Go, tipado e com transações. Consultas como "tudo que depende de mim" ficam baratas e confiáveis.

Nada de estado vive dentro dos Markdown. O status de um step, que nas skills originais era uma linha no topo do arquivo, é só uma coluna no banco.

## Notificações

Para avisar o usuário fora do app quando algo passa a depender dele, o produto fala direto com o serviço de notificações do desktop, `org.freedesktop.Notifications`, pelo D-Bus de sessão. O acesso ao barramento é feito com o godbus, o mesmo que o app já usa para ler o tema do sistema no portal do desktop.

O service de notificações do Wails v3 foi a primeira escolha deste documento, trocada em 2026-09-10. No Linux, em `v3.0.0-beta.16`, ele entrega a notificação dispensada pelo usuário (`NotificationClosed` com motivo 2) como um clique, e dispensar uma notificação traria a janela para a frente. Com o serviço direto, clicar chega como `ActionInvoked` e dispensar só tira a notificação da lista.

## Ferramentas de desenvolvimento

- **Layout**: um repositório só, no formato do Wails v3. Módulo Go na raiz, `frontend/` com Vite, React e TypeScript em modo strict.
- **Toolchain**: mise pina, num `mise.toml` na raiz, as versões de Go, Node, pnpm, Task, golangci-lint e das demais ferramentas de linha de comando. O CLI `wails3`, ainda em beta, é instalado por `go install` numa tarefa de setup.
- **Frontend**: pnpm como gerenciador de pacotes, Biome para lint e formatação no lugar de ESLint mais Prettier, Vitest com Testing Library para testes.
- **Go**: golangci-lint, `slog` para logs, `go test` padrão.
- **Automação**: o Taskfile que o Wails v3 gera, para dev, build e geração de bindings.

## Pontos a verificar no protótipo

1. WebKitGTK 6.0 sobre GTK4 renderizando corretamente no Hyprland da máquina alvo, com GPU AMD.
2. Streamdown atendendo ao streaming do chat e ao mermaid; caso contrário, cair para react-markdown, remark-gfm, Shiki e mermaid. Verificado na task 02.
3. Estabilidade do Wails v3 beta nas funcionalidades usadas: services, eventos, SQLite.
4. A flag de opt-out do `--bare` quando ele virar padrão do `-p`.
5. O canal de controle por stdio continuar disponível nas versões seguintes do CLI (feature-detect por `capabilities`).
