# Organização do código

Um repositório só, no layout do Wails v3: o módulo Go na raiz, o frontend em `frontend/`. Este documento diz onde cada coisa está e como as partes se falam. As convenções de escrita estão em [guidelines](../guidelines/README.md).

```
main.go                  ponto de entrada; embute frontend/dist e o ícone
internal/                todo o código Go
  app/                   compõe o app Wails a partir dos services; sabe de Wails
  bindings/              services expostos ao frontend, DTOs e eventos; sabe de Wails
  flow/                  conduz uma task pelas etapas
  session/               a conversa de cada sessão e o processo por trás dela
  claude/                o CLI do Claude Code como subprocesso e o seu protocolo
  task/                  tasks, artefatos, plano, steps e pull requests
  worktree/              as worktrees que o app cria
  review/                observação das worktrees em review
  attention/             as situações que esperam pelo usuário
  prompts/               prompts padrão embutidos e os editados
  models/                modelos, esforços e padrões
  workspace/             a área de trabalho aberta e as recentes
  scan/                  encontra os repositórios de uma pasta
  git/, gh/              rodam os binários; nada sabem de tasks
  editor/                abre o VS Code
  theme/                 preferência de tema
  store/                 SQLite e migrations
  platform/              logging, notify (D-Bus), chime, dnd, xdg
frontend/
  src/app/               App, shell, bootstrap e atalhos globais
  src/store/             o store Zustand, as ações e o transcript
  src/lib/               a fronteira com o Go (wails.ts) e helpers puros
  src/features/          um diretório por área da interface
  src/components/ui/     componentes shadcn; gerados, nunca editados à mão
  src/styles/            Tailwind, tokens e fontes
  src/test/              setup do Vitest, render com store e mock do Go
  bindings/              gerados por `task generate`; nunca editados à mão
build/                   config do Wails, ícones e entrada .desktop
.github/                 CI e Dependabot
```

## Backend em Go

### Camadas

Só dois pacotes conhecem o Wails: `internal/app`, que compõe tudo e abre a janela, e `internal/bindings`, que expõe os services e define os DTOs e os eventos. Todo o resto é Go puro, testável sem Wails.

Os pacotes de domínio se organizam em camadas, de baixo para cima:

1. **Plataforma e binários**: `platform/*`, `git`, `gh`, `scan`, `editor`. Cada um sabe rodar uma coisa e nada sobre o produto.
2. **Estado**: `store`, com um repositório por tabela, e `models`, `theme`, `prompts`.
3. **Domínio**: `task`, `session`, `worktree`, `review`, `workspace`, `attention`. Cada um é dono de um conceito, guarda o seu estado pelo `store` e reporta o que mudou por callbacks. Nenhum deles decide o que fazer com a mudança.
4. **Orquestração**: `flow`. Ouve as mudanças de tasks e sessões, decide o que a etapa atual precisa e age: inicia a etapa seguinte, corrige um plano, inicia um step, cria uma worktree, aprova, abre a etapa de PR, encerra um repositório.
5. **Exposição**: `bindings` converte o domínio em DTOs e recebe as chamadas do frontend; `app` liga tudo e publica o estado.

Dois pares merecem nota. `git` roda o binário e não sabe o que é uma task; `worktree` carrega a política do produto: onde as worktrees ficam, como nascem, quando estão limpas, como vão embora. `gh` espelha `git` e só lê; quem abre pull requests é o agente.

### Composição e injeção

`app.Run` monta os services na ordem das dependências, cada um recebendo as suas por uma struct `Deps` e um `*slog.Logger`. Não há variável global: quem precisa de algo recebe no construtor. Os callbacks `OnChange` de cada service convergem para `app.publish`, que monta um snapshot e emite `state:changed`.

### O estado que o frontend vê

`bindings.State` é tudo que a interface renderiza, produzido no Go e nunca derivado no frontend. `app.snapshot` lê as tasks, os resumos das sessões, os artefatos, os steps e os repositórios de cada task, deriva as situações a partir das mesmas leituras, para que todas as superfícies concordem, e converte tudo em DTOs. Cada mudança em qualquer service publica um snapshot inteiro; o frontend substitui o que tem.

Os enums dos DTOs viajam como `string`, com um comentário listando os valores, para que os bindings gerados não emitam enums TypeScript; o frontend estreita com funções `asX` em `lib/wails.ts`.

### Eventos

Quatro eventos tipados, registrados em `bindings.RegisterEvents` antes de `application.New`:

| Evento | Carrega | Quando |
|---|---|---|
| `state:changed` | `State` inteiro | Qualquer mudança em qualquer service |
| `transcript:changed` | um `TranscriptEvent`: entrada nova, texto em streaming, remoção ou reset | A cada mudança numa conversa |
| `situation:started` | a situação e se a janela estava em foco | Uma situação nova começa; dirige o piscar |
| `situation:open` | task e lugar | Um clique numa notificação pede a abertura |

### Notificações e som

`attention.Service` decide quando uma situação notifica e chama `notify.Notifier`, que fala com o serviço `org.freedesktop.Notifications` numa goroutine própria, na ordem dos pedidos, sem nunca segurar quem chamou. É também o notifier que decide o som: uma notificação faz som quando nenhuma outra fez nos últimos dois segundos, e só se o envio deu certo. Antes dela o notifier lê as capacidades do servidor. Um servidor que anuncia `sound` recebe o caminho do carrilhão na hint `sound-file` e aplica o próprio não perturbe. Para os outros a notificação vai com `suppress-sound`, e o notifier toca o carrilhão por `chime.Player`.

`chime` é dono do som: o WAV embutido no binário, a cópia em `sounds/chime.wav` que `Install` escreve ao iniciar, e o `Player`, que toca um carrilhão por vez numa goroutine própria. O player pergunta a `dnd.Detector`, em até meio segundo, se o desktop está em não perturbe, e depois roda o primeiro player de áudio que funcionar, com cinco segundos de limite. `dnd` pergunta ao shell do Omarchy, ao KDE Plasma, ao dunst e ao swaync; o que não responde não diz nada, e o carrilhão toca. Ao fechar, o app fecha o notifier e depois o player, que mata um som ainda tocando.

### Fluxo de uma sessão

`session.Service` é dono da conversa de cada chave `{task, stage}`, onde a stage é `prd`, `tech_spec`, `plan`, `step:<n>`, `pr:<slug>` ou `pr_review:<slug>`. Ele inicia o processo por `claude`, consome o stream de eventos, monta o transcript, persiste as entradas no `store`, deriva o estado (trabalhando, esperando, precisa de permissão, precisa de resposta, pausada, erro) e avisa `flow` e `app` a cada mudança. O detalhe está em [sessions.md](./sessions.md).

### Fluxo de uma etapa

`task.Service` observa o diretório de artefatos de cada task com fsnotify e reporta quando um documento aparece. `flow.Service.Check` recebe esse aviso, e o de cada mudança de sessão, e enfileira uma avaliação por task, coalescendo rajadas. A avaliação lê a task e decide: uma etapa cujo documento existe e cuja sessão está ociosa avança; um plano inválido recebe uma correção; um step concluído dá lugar ao próximo; o último step commitado abre a etapa de PR. Na implementação e na PR a avaliação desce ao step que roda e ao repositório em questão.

### Banco e migrations

`store.Open` abre o SQLite com uma conexão só, WAL e foreign keys, e aplica as migrations embutidas em `store/migrations/NNNN_nome.sql`, uma transação por arquivo, guardando a versão em `PRAGMA user_version`. Os testes usam `store.OpenMemory`. Ver [storage.md](./storage.md).

## Frontend

### Fronteira com o Go

`lib/wails.ts` é o único arquivo que importa os bindings gerados e o runtime do Wails. Ele reexporta os tipos dos DTOs, define as uniões de strings e as funções `asX` que estreitam os enums, expõe o objeto `api` com uma função por método dos services e as funções `onX` que assinam os eventos. Tudo que está fora de `lib/wails.ts` fala com o Go por essas funções, e os testes substituem só elas.

### Store

`store/app-store.ts` é o store Zustand: o `State` recebido do Go, os transcripts por chave de sessão, os rascunhos, e o estado de interface que só o frontend conhece (nó selecionado, task aberta, aba de repositório, histórico e configurações abertos, edição de prompt, navegação pendente). Ele exporta hooks seletores (`useTask`, `useTasksOf`, `useTranscript`, `useOpenTask`...) para que cada componente assine só a fatia que usa. O store importa só de `lib/`.

`store/actions.ts` é o que os componentes chamam para agir: cada ação chama `api`, e um erro vira a mensagem do aviso de erro. Nenhuma ação toca o `State`: o estado novo sempre chega por `state:changed`. Os componentes nunca chamam `api` diretamente.

`app/bootstrap.ts` assina os quatro eventos antes de pedir o estado inicial, para que um evento emitido no intervalo seja aplicado e não perdido.

### Features

Cada diretório de `features/` cobre uma área: `workspace` e `tree` para a barra lateral, `welcome` para a tela sem área de trabalho, `task` e `task-create` para a task, `chat` para as conversas, `attention` para a seção de espera, `history`, `settings`, `models`, `notice` e `theme`. A lógica de apresentação que não depende de React fica em arquivos `.ts` ao lado dos componentes (`status.ts`, `step-status.ts`, `repo-status.ts`, `stage-actions.ts`), testável sem renderizar.

`lib/` guarda o que o store e as features compartilham: repositórios, situações, etapas, modelos, nomes de task, front matter.

### Estilo

`styles/globals.css` importa o Tailwind, o tw-animate-css e o CSS do shadcn, define as variáveis de cor em oklch para os temas claro e escuro e, fora de qualquer camada, arredonda para o pixel a centralização dos dialogs do shadcn, que o WebKitGTK borraria quando ela cai em meio pixel. `styles/tokens.css` define fontes, tamanhos, durações, curvas e as cores de status de sessão. Os componentes usam classes do Tailwind e os tokens; uma cor nunca é o único portador de um estado, todo ponto colorido tem um rótulo.

## Build

`main.go` embute `frontend/dist`. Como esse diretório é saída de build e `//go:embed` recusa um diretório vazio, as tarefas Go criam um placeholder quando não há build, para que lint, testes e vulnerabilidades rodem num clone limpo. A tag de build `production` diferencia o binário instalado do de desenvolvimento: só o de desenvolvimento escreve o log também no stderr.
