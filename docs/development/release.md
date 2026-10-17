# Releases

O MySpec é publicado como uma release versionada no GitHub: dois pacotes, `myspec-linux-amd64.tar.gz` para Linux `amd64` e `myspec-windows-amd64.zip` para Windows 11 `x64`, montados pelo workflow de release a partir de uma tag.

## Versão

O arquivo `VERSION`, na raiz, guarda a versão da última release, em semver `MAJOR.MINOR.PATCH`, sem o `v`. É a única fonte do número. Antes da primeira release vale `0.0.0`. As tags são `vX.Y.Z`.

Em `0.x`, `minor` é para features e `patch` para correções.

O app compara a versão do binário com as releases publicadas no GitHub e avisa quando há uma mais nova; um build `dev` não procura.

Os builds locais (`task build`, `task dev`, `task install`) se identificam como `dev`. O binário Linux e o `.exe` da release levam a versão no log `app starting`, no atributo `version`, gravada por `-X main.version` em `task package`; no `.exe` ela também está nas propriedades do arquivo.

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

Passando, o comando faz o bump de `VERSION`, commita `Release vX.Y.Z` com só esse arquivo, cria a tag anotada, envia o commit e a tag num `git push --atomic` e imprime os links do workflow e da release. O git precisa alcançar a `origin` sem pedir senha, porque o comando roda com `GIT_TERMINAL_PROMPT=0`. O comando não usa o `gh`.

Esse commit é a única mudança que chega à `main` sem pull request ([guidelines](../guidelines/README.md#pull-requests)).

## O workflow

`.github/workflows/release.yml` roda em cada push de tag `v*`, num `ubuntu-24.04`. Os passos:

1. confere que o commit da tag está na `main` e que a tag é igual a `VERSION`;
2. instala a toolchain do `mise.toml`, sem cache, para que nada de outra execução chegue ao binário;
3. instala os pacotes `-dev` do GTK4 e do WebKitGTK pelo apt e, depois deles, o `wails3` por `go install tool`, que compila contra eles;
4. roda `pnpm install --frozen-lockfile` e `task package`, que monta os dois pacotes; o Windows por compilação cruzada, sem cgo, então sem GTK, WebKit nem runner Windows;
5. confere, depois dos dois builds, que o build não mudou nenhum arquivo rastreado e que os dois binários não carregam caminhos do runner;
6. publica com `gh release create`: título e tag `vX.Y.Z`, notas geradas pelo GitHub a partir das pull requests desde a tag anterior, marcada como `latest`, com os dois pacotes anexados. Com anexos, o comando cria a release como rascunho, sobe os arquivos e só então a publica. Uma falha em qualquer pacote para o workflow antes da publicação, e nenhuma release sai, nem com um pacote só.

O workflow usa só o `GITHUB_TOKEN`, com `contents: write`, e só uma release roda por vez. O Ubuntu 24.04 é fixo porque o binário Linux liga nas bibliotecas do sistema em que é construído, e as dele são as mais antigas entre os sistemas do time.

## Os pacotes

### Linux

`myspec-linux-amd64.tar.gz`, só para `amd64`. É plano, sem diretório interno, com quatro arquivos:

| Arquivo | O que é | Modo |
|---|---|---|
| `myspec` | o binário de produção, com a versão | 0755 |
| `org.wails.myspec.desktop` | a entrada de desktop, com `@EXEC@` intacto | 0644 |
| `org.wails.myspec.svg` | o ícone escalável, o PNG de 512x512 dentro de um SVG | 0644 |
| `org.wails.myspec.png` | o ícone de 512x512 | 0644 |

Os nomes são os de instalação. `@EXEC@` no `.desktop` é trocado pelo caminho do binário, como faz `task install`. A estrutura é estável, e o script de instalação depende dela ([Instalação pelo time](#instalação-pelo-time)).

### Windows

`myspec-windows-amd64.zip`, só para `amd64` (o `x64` do Windows). É um `.zip` porque o Windows o abre sem ferramenta extra; o `install.ps1` o extrai pelo `System.IO.Compression` do .NET. É plano, sem diretório interno, com dois arquivos:

| Arquivo | O que é |
|---|---|
| `myspec.exe` | o executável de produção, um app de janela sem console, com a versão, o ícone, o manifesto e as propriedades do arquivo |
| `myspec.ico` | o ícone avulso, que o atalho do menu Iniciar usa |

O `.exe` é montado assim: `wails3 generate icons` converte `build/appicon.png` em `.ico`; `wails3 generate syso` junta o ícone, `build/windows/myspec.exe.manifest` e `build/windows/info.json` (com a versão no lugar de `@VERSION@`) num `.syso`, que o `go build` liga ao executável. As propriedades do arquivo são: produto e descrição `MySpec` (o nome que o Gerenciador de Tarefas mostra), empresa e copyright de `build/config.yml`, a descrição longa nos comentários e a versão da release. Os textos de `info.json` acompanham os de `build/config.yml`: mudou um, muda o outro. A estrutura é estável, e o script de instalação do Windows depende dela ([Instalação pelo time](#instalação-pelo-time)).

### Comandos

`task package` monta os dois pacotes na máquina, em `bin/`, sem publicar; `task package:linux` e `task package:windows` montam um só.

## Build reprodutível

O mesmo commit, com a mesma toolchain do `mise.toml` e as mesmas bibliotecas do Ubuntu 24.04, gera o mesmo binário e o mesmo `.tar.gz`. O binário Linux sai de `-tags production -trimpath -buildvcs=false -ldflags="-w -s -X …"`, com o frontend de produção pelo lockfile congelado. No tar, a ordem dos nomes é fixa, o mtime é o do commit, o dono é 0 e o `gzip` roda com `--no-name`.

O `.exe` sai de `CGO_ENABLED=0` e `-tags production -trimpath -buildvcs=false -ldflags="-w -s -H windowsgui -X …"`, com o `.ico` e o `.syso` determinísticos. O zip é montado por `cmd/zip`, com as entradas na ordem fixa, todas com a data do commit em UTC, sem permissões nem dono. O Ubuntu 24.04 é condição só para o binário Linux; o `.exe` não liga em biblioteca do sistema de build.

## URL estável

`https://github.com/guilhermt/MySpec/releases/latest/download/myspec-linux-amd64.tar.gz` e `https://github.com/guilhermt/MySpec/releases/latest/download/myspec-windows-amd64.zip` entregam sempre o pacote da última release publicada. O repositório precisa ser público para o download sem autenticação. O `install.sh` parte da primeira URL, e o `install.ps1`, da segunda.

## O que cada binário precisa em tempo de execução

### Linux

O binário precisa de dois pacotes do sistema; o resto (GLib, libsoup, libX11, Cairo, Pango, Vulkan e as demais) vem como dependência deles.

| Biblioteca | Arch | Ubuntu 24.04 e Pop!_OS 24.04 |
|---|---|---|
| GTK 4 | `gtk4` | `libgtk-4-1` |
| WebKitGTK 6.0 | `webkitgtk-6.0` | `libwebkitgtk-6.0-4` |

Cada biblioteca ligada diretamente pelo binário (`readelf -d` de `task package`) pertence a um desses dois pacotes ou às dependências deles no Arch.

### Windows

Windows 11 `x64` e mais nada do sistema: o `.exe` é Go puro e usa o WebView2, que o Windows 11 já traz.

Em qualquer sistema, o app ainda confere na abertura o Claude Code e o `gh`, pré-requisitos externos.

## Instalação pelo time

`install.sh` e `install.ps1`, na raiz, são servidos pelo raw da `main`. Os comandos do time são os do README.

### Linux

```
curl -fsSL https://raw.githubusercontent.com/guilhermt/MySpec/main/install.sh | sh
```

O script, em `sh` POSIX:

- confere o usuário (recusa root), `curl` e `tar`, o Linux `amd64` e as duas bibliotecas por `ldconfig -p`, e mostra o comando de instalação da distro de `/etc/os-release`;
- lê a versão do redirect da URL estável e baixa o pacote da tag dessa versão, com limite de tempo no `curl` (30 segundos para conectar, 30 para achar a última release e 600 para baixar o pacote);
- instala nos caminhos do `task install` por rename atômico, o que deixa um app aberto na versão antiga, e troca o `.desktop`, o `.svg` e o `.png` antes do binário: o binário é o último arquivo, então uma falha num arquivo de apoio deixa o executável antigo intacto e a versão nunca fica mista;
- atualiza os caches do launcher e dos ícones;
- imprime a versão, o aviso de `PATH` e os pré-requisitos externos (`claude`, `gh` e `git`).

Nada muda no disco antes de tudo estar conferido, baixado e extraído. Ele nunca usa `sudo` e nunca toca nos dados do app.

### Windows

```powershell
irm https://raw.githubusercontent.com/guilhermt/MySpec/main/install.ps1 | iex
```

O script, em PowerShell, roda igual no Windows PowerShell 5.1, que vem com o Windows 11, e no PowerShell 7, só com .NET e cmdlets embutidos, sem depender da política de execução. Ele roda inteiro dentro de um bloco, que não deixa variáveis nem preferências na sessão, e nunca fecha a janela.

O script:

- confere o Windows 11 (build 22000 ou mais nova), a arquitetura `x64` da máquina (não a do processo), a sessão sem elevação e o WebView2, pelo registro;
- lê a versão do redirect da URL estável e baixa o pacote da tag dessa versão, seguindo só redirects HTTPS;
- extrai numa pasta temporária, confere os dois arquivos e tira a marca de arquivo baixado;
- instala `myspec.exe` e `myspec.ico` em `%LOCALAPPDATA%\Programs\MySpec\` e recria o atalho `MySpec` em `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`, com o ícone e a identidade `guilhermt.MySpec`, a mesma das notificações;
- imprime a versão, que o app está no menu Iniciar e os pré-requisitos externos (`claude`, `gh` e `git`).

Com o app aberto, o script renomeia o `myspec.exe` em uso para `myspec.exe.<sufixo>.old` e põe o novo no lugar: a janela aberta segue na versão antiga, e a próxima abertura já é a nova. Os `.old` que não estão mais em uso são apagados na execução seguinte. Quando um arquivo não pode ser substituído, o script devolve o executável anterior ao lugar e pede para fechar o MySpec e rodar de novo.

Nada muda no disco antes de tudo estar conferido, baixado, extraído e pronto para o atalho. Ele nunca pede administrador e nunca toca nos dados do app, em `%LOCALAPPDATA%\MySpec\`, nem no registro.

**Remoção manual:** para remover o MySpec do Windows, apague `%LOCALAPPDATA%\Programs\MySpec\` e o atalho `MySpec` do menu Iniciar, em `%APPDATA%\Microsoft\Windows\Start Menu\Programs\MySpec.lnk`. Os dados ficam em `%LOCALAPPDATA%\MySpec\`; apague a pasta só para perdê-los.

### Atualização de dentro do app

O app se atualiza rodando o mesmo script do terminal. Ele baixa o `install.sh` ou o `install.ps1` do raw da `main` e o roda sem terminal: `/bin/sh` no Linux; `powershell.exe -NoProfile -NonInteractive -Command "iex …"`, sem janela, no Windows. O script roda num grupo de processos próprio, que o fechamento do app não para, com 15 minutos de prazo; só o prazo o mata. O resultado vem de um arquivo, cujo caminho o app passa em `MYSPEC_INSTALL_RESULT`. Sem a variável, ou vazia, o script se comporta como no terminal e não escreve resultado.

**O contrato do resultado.** O script escreve o arquivo uma vez, no fim, em UTF-8 sem BOM, com uma linha `chave: valor` por campo.

Sucesso:

```
result: installed
version: 0.5.0
path: /home/u/.local/bin/myspec
```

`version` vem sem o `v`; `path` é o executável instalado, o que o app inicia no reinício.

Falha:

```
result: failed
kind: libraries
reason: MySpec needs system libraries that are missing: GTK 4
command: sudo pacman -S gtk4
```

`kind` é `offline`, `timeout`, `libraries`, `system`, `replace` ou `failed`. `reason` é a primeira linha da mensagem de erro que o script mostra no terminal, sem o `error: `. `command` aparece zero ou mais vezes, só em `libraries`.

O contrato é estável: a `main` nunca remove nem renomeia uma chave nem um `kind`, porque versões publicadas do app o leem. Uma chave nova pode entrar, e o app ignora as que não conhece.

**O reinício.** Com a instalação concluída, o app inicia o executável de `path` com `--after-exit=<pid>` e sai pelo fechamento normal. O processo novo espera o antigo terminar antes de pegar o lock da instância única. A flag é parte do contrato entre versões: toda release a mantém, porque a versão que reinicia é a anterior à que sobe.

**A regra do formato:** vale para os dois pacotes. Cada script de instalação depende da estrutura do pacote que instala, o `install.sh` a do pacote Linux e o `install.ps1` a do pacote Windows, e o script da `main` precisa sempre entender o pacote da última release publicada. Uma mudança na estrutura do pacote chega à `main` com um script que aceita as duas estruturas, e o suporte à antiga sai só depois da release com a nova. O contrato do resultado também é estável, pelo mesmo motivo. Uma correção no script chega ao time no merge, sem release.

**Verificação:** a verificação automática é o `shellcheck` no `install.sh` (`task lint:sh`) e o PSScriptAnalyzer no `install.ps1` (`task lint:ps`), com as regras de compatibilidade do Windows PowerShell 5.1 e do PowerShell 7 em `PSScriptAnalyzerSettings.psd1`; os dois rodam em `task lint` e no CI. O comportamento se confere à mão: o `install.sh` no Arch e no Pop!_OS 24.04, e o `install.ps1` no Windows 11 x64, no Windows PowerShell 5.1 e no PowerShell 7: a instalação numa máquina sem o app, a atualização com o app fechado e com ele aberto, a limpeza do `.old` na execução seguinte, a recusa num PowerShell elevado e o atalho no menu Iniciar com o nome e o ícone, agrupado com a janela na barra de tarefas.

A atualização de dentro do app também se confere à mão, no Arch, no Pop!_OS 24.04 e no Windows 11 com o Windows PowerShell 5.1, que é o que o app usa:

- atualizar sem agente trabalhando: o app reinicia sozinho;
- atualizar com um agente trabalhando: **Later**, o turno termina, **Restart now**;
- atualizar sem rede: `Couldn't update` e **Try again**;
- fechar o app durante `Updating…`: a próxima abertura é a nova;
- no Windows, a limpeza do `.old` na atualização seguinte.

## Quando uma release falha

- Uma recusa do comando não muda nada: corrija o que a mensagem diz e rode de novo.
- Um push que falha não envia nada, por ser atômico. O comando imprime `git tag -d vX.Y.Z` e `git reset --hard HEAD~1` para desfazer localmente. Depois disso, `git pull` e rode de novo.
- Uma falha transitória do workflow (rede, runner) se resolve com **Re-run jobs** no GitHub, que publica a mesma release. Se ficou um rascunho de um upload interrompido, ele é apagado na página de releases antes do re-run.
- Uma falha no build ou numa conferência de qualquer um dos pacotes não publica nada, e segue o mesmo caminho das outras falhas.
- Uma falha do código ou do build se resolve com a correção por pull request e `task release -- patch`. A tag que falhou fica sem release.
- Uma release publicada com bug se resolve da mesma forma, com uma versão nova.
- Nenhuma tag é movida, apagada nem recriada, e nenhuma release publicada é reescrita.
