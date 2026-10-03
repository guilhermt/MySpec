# Go

Go 1.27, módulo `github.com/guilhermt/myspec`. O que está aqui é o que o código já faz; `golangci-lint` aplica a parte mecânica com a configuração de `.golangci.yml`.

## Pacotes

- Um pacote é dono de um conceito e o nome diz qual: `task`, `session`, `worktree`, `review`. O comentário de pacote, no arquivo que dá nome ao conceito, diz em uma ou duas frases o que ele é dono e o que deixa para os outros.
- Pacotes de domínio não conhecem o Wails. Só `internal/app` e `internal/bindings` importam `wailsapp/wails`.
- Um pacote que roda um binário (`git`, `gh`) nada sabe do produto; a política fica num pacote acima (`worktree`, `flow`).
- Dependências entram por uma struct `Deps` no construtor `New`, com o `*slog.Logger` junto. Sem variáveis globais, sem logger global. Um logger ausente vira `slog.DiscardHandler`.
- O que um pacote descobre ele reporta por callback (`OnChange`, `OnDue`); decidir o que fazer com isso é de quem o compôs.

## Nomes e comentários

- Toda declaração exportada tem um comentário de documentação em frases completas, começando pelo nome. Constantes e variáveis agrupadas ganham um comentário no grupo.
- Comentários de linha dizem o porquê, não o quê. Um comentário que repete o código é apagado.
- Nenhuma variável ou parâmetro se chama `models`, `task`, `session`, `flow` ou o nome de outro pacote importado, para não sombrear.
- Enums são um tipo string com constantes (`type Stage string`), uma função `ParseX` que estreita uma string recebida e devolve `ErrUnknownX`, e a lista ordenada quando a ordem importa (`var Stages = []Stage{...}`).

## Erros

- Erros sentinela por pacote, com o prefixo do pacote na mensagem: `errors.New("task: not found")`.
- Todo erro que sobe é embrulhado com `%w` e o contexto do que falhou: `fmt.Errorf("open database %s: %w", path, err)`. Quem trata usa `errors.Is` e `errors.As`.
- A mensagem que o usuário vê nunca é o erro cru. `internal/bindings` traduz os erros conhecidos pela lista `userMessages`; o resto vira uma mensagem genérica e uma linha de log `binding failed` com o método e o erro.
- O que o git ou o gh disseram é mostrado como eles escreveram, porque é o que o usuário sabe ler.

## Concorrência

- Todo trabalho de banco recebe um `context.Context` com timeout: `callTimeout` em cada chamada ao banco, do início e da interface, `openTimeout` ao abrir o banco, que roda as migrations, e um maior quando há git envolvido. O início não tem prazo total.
- O trabalho do início roda numa goroutine que um contexto cancelável encerra: uma tentativa devolve o erro com `%w` (o caso da falha vem do `errors.Is`), fecha o que abriu quando falha e checa o contexto entre os itens de um laço longo.
- Um mutex protege o estado de um service; os callbacks são chamados fora do mutex. Um trabalho longo (parar um processo, rodar git) nunca roda com o mutex tomado.
- Callbacks que chegam de goroutines de outros services (sessão, watcher) não bloqueiam: `flow.Check` enfileira uma avaliação e volta na hora, coalescendo rajadas numa avaliação depois da que está em curso.
- Uma operação por task por vez em `flow`, e uma operação de git por repositório por vez.

## Logs

- `slog` com mensagem fixa e atributos chave-valor: `log.Info("step started", "task", id, "step", n)`. Nunca `Sprintf` na mensagem e nunca o logger global; `sloglint` recusa os dois.
- Os atributos usam os mesmos nomes em todo o código: `task`, `stage`, `step`, `repository`, `path`, `error`. Uma mensagem nova entra em [troubleshooting.md](../development/troubleshooting.md).

## Banco

- Uma tabela, um repositório em `internal/store` (`TasksRepo`, `SessionsRepo`...), com métodos que recebem `ctx` e devolvem tipos do domínio.
- Migrations em `internal/store/migrations/NNNN_nome.sql`, quatro dígitos, o próximo número livre. Um comentário no topo diz o que a migration guarda e por quê. Uma migration aplicada nunca muda.
- Enums e estruturas pequenas vão como texto ou JSON com o tipo Go nomeado no comentário da coluna. Estados deriváveis não vão ao banco.

## DTOs e bindings

- Um DTO em `internal/bindings/dto.go` para tudo que o frontend vê, com tags `json` em camelCase e um comentário por campo que não se explica sozinho. Slices nunca são `nil` (`// never nil`), porque o frontend os itera.
- Enums nos DTOs são `string`, com o comentário listando os valores possíveis e a frase "a string for the same reason as State.Theme". O frontend estreita com `asX` em `lib/wails.ts`.
- A conversão do domínio para DTO fica em `convert.go`, com um `FromX` por tipo, testado.
- Um método de service é uma operação do usuário, com timeout, tradução de erro e uma linha de log quando falha. Mudou um service, um DTO ou um evento: `task generate`.
- Todo service de binding tem o campo `late late[XService]` como primeiro campo, e todo método exportado começa resolvendo-o: `s, err := s.late.resolve(s)`, devolvendo o zero e `err` quando falha. O service que `NewX` constrói responde sempre; o placeholder que `bindings.NewWaitingServices` registra no Wails antes de o app estar pronto responde `MySpec is starting.` até `Services.Bind` entregar o service de verdade. Um método novo ganha as mesmas linhas, e nenhum método exportado entra numa struct de binding só para servir ao Go (o Wails o publicaria ao frontend). O `StartupService` é o único que nunca espera.

## Estilo

- gofumpt e goimports com `github.com/guilhermt/myspec` como prefixo local; `task fmt:go` aplica.
- Funções curtas com um propósito. Uma função que precisa de comentário explicando os passos é duas funções.
- `//nolint:<linter> // razão` só com o linter nomeado e a razão escrita; `nolintlint` recusa o resto. O único excluído de propósito é `gosec` G304, porque abrir caminhos do usuário é o que o app faz.
- Constantes nomeadas para todo número que não é 0 ou 1, com o comentário dizendo o que limita: timeouts, tamanhos de buffer, contagens.
