# Releases

O MySpec é publicado como uma release versionada no GitHub: um pacote `.tar.gz` para Linux `amd64`, montado pelo workflow de release a partir de uma tag.

## Versão

O arquivo `VERSION`, na raiz, guarda a versão da última release, em semver `MAJOR.MINOR.PATCH`, sem o `v`. É a única fonte do número. Antes da primeira release vale `0.0.0`. As tags são `vX.Y.Z`.

Em `0.x`, `minor` é para features e `patch` para correções.

Os builds locais (`task build`, `task dev`, `task install`) se identificam como `dev`. O binário da release leva a versão no log `app starting`, no atributo `version`, gravada por `-X main.version` em `task package`.

## Publicar

Pré-condição: tudo o que entra na release já foi mergeado por pull request. Na `main` atualizada e limpa:

```
task release -- <patch|minor|major>
```

O comando confere, nesta ordem, e recusa sem mudar nada quando algo está errado. Cada mensagem diz o que fazer:

| Conferência | Recusa | O que fazer |
|---|---|---|
| O argumento | `release: the bump must be patch, minor or major` | Passar um dos três. |
| A branch | `release: not on main (on <branch>)` | `git switch main`. |
| O working tree | `release: the working tree has changes`, com a lista dos arquivos | Commitar ou descartar. Os arquivos ignorados não contam. |
| A sincronia | `release: main is not the same as origin/main (<N> behind, <M> ahead)` | `git pull`, e mover para uma branch qualquer commit que só a `main` local tem. A conferência vem depois de um fetch. |
| A tag | `release: the tag already exists: vX.Y.Z, in this clone` ou `on origin` | Conferir `VERSION` e as tags; a tag existente não é tocada. |

Passando, o comando faz o bump de `VERSION`, commita `Release vX.Y.Z` com só esse arquivo, cria a tag anotada, envia o commit e a tag num `git push --atomic` e imprime os links da tag e da release. O git precisa alcançar a `origin` sem pedir senha, porque o comando roda com `GIT_TERMINAL_PROMPT=0`. O comando não usa o `gh`.

Esse commit é a única mudança que chega à `main` sem pull request ([guidelines](../guidelines/README.md#pull-requests)).

## O workflow

`.github/workflows/release.yml` roda em cada push de tag `v*`, num `ubuntu-24.04`. Os passos:

1. confere que o commit da tag está na `main` e que a tag é igual a `VERSION`;
2. instala a toolchain do `mise.toml`, sem cache, para que nada de outra execução chegue ao binário;
3. instala o `wails3` por `go install tool` e os pacotes `-dev` do GTK4 e do WebKitGTK pelo apt;
4. roda `pnpm install --frozen-lockfile` e `task package`;
5. confere que o build não mudou nenhum arquivo rastreado e que o binário não carrega caminhos do runner;
6. publica com `gh release create`: título e tag `vX.Y.Z`, notas geradas pelo GitHub a partir das pull requests desde a tag anterior, marcada como `latest`, com o pacote anexado.

O workflow usa só o `GITHUB_TOKEN`, com `contents: write`, e só uma release roda por vez. O Ubuntu 24.04 é fixo porque o binário liga nas bibliotecas do sistema em que é construído, e as dele são as mais antigas entre os sistemas do time.

## O pacote

`myspec-linux-amd64.tar.gz`, só para `amd64`. É plano, sem diretório interno, com quatro arquivos:

| Arquivo | O que é | Modo |
|---|---|---|
| `myspec` | o binário de produção, com a versão | 0755 |
| `org.wails.myspec.desktop` | a entrada de desktop, com `@EXEC@` intacto | 0644 |
| `org.wails.myspec.svg` | o ícone vetorial | 0644 |
| `org.wails.myspec.png` | o ícone de 512x512 | 0644 |

Os nomes são os de instalação. `@EXEC@` no `.desktop` é trocado pelo caminho do binário, como faz `task install`. A estrutura é estável: mudá-la exige mudar o script de instalação junto.

`task package` monta o pacote na máquina, em `bin/`, sem publicar.

## Build reprodutível

O mesmo commit, com a mesma toolchain do `mise.toml` e as mesmas bibliotecas do Ubuntu 24.04, gera o mesmo binário e o mesmo `.tar.gz`. O binário sai de `-tags production -trimpath -buildvcs=false -ldflags="-w -s -X …"`, com o frontend de produção pelo lockfile congelado. No tar, a ordem dos nomes é fixa, o mtime é o do commit, o dono é 0 e o `gzip` roda com `--no-name`.

## URL estável

`https://github.com/guilhermt/MySpec/releases/latest/download/myspec-linux-amd64.tar.gz` entrega sempre o pacote da última release publicada. O repositório precisa ser público para o download sem autenticação.

## Bibliotecas em tempo de execução

O binário precisa de dois pacotes do sistema; o resto (GLib, libsoup, libX11, Cairo, Pango, Vulkan e as demais) vem como dependência deles.

| Biblioteca | Arch | Ubuntu 24.04 e Pop!_OS 24.04 |
|---|---|---|
| GTK 4 | `gtk4` | `libgtk-4-1` |
| WebKitGTK 6.0 | `webkitgtk-6.0` | `libwebkitgtk-6.0-4` |

Cada biblioteca ligada diretamente pelo binário (`readelf -d` de `task package`) pertence a um desses dois pacotes ou às dependências deles no Arch.

## Quando uma release falha

- Uma recusa do comando não muda nada: corrija o que a mensagem diz e rode de novo.
- Um push que falha não envia nada, por ser atômico. O comando imprime `git tag -d vX.Y.Z` e `git reset --hard HEAD~1` para desfazer localmente. Depois disso, `git pull` e rode de novo.
- Uma falha transitória do workflow (rede, runner) se resolve com **Re-run jobs** no GitHub, que publica a mesma release. Se ficou um rascunho de um upload interrompido, ele é apagado na página de releases antes do re-run.
- Uma falha do código ou do build se resolve com a correção por pull request e `task release -- patch`. A tag que falhou fica sem release.
- Uma release publicada com bug se resolve da mesma forma, com uma versão nova.
- Nenhuma tag é movida, apagada nem recriada, e nenhuma release publicada é reescrita.
