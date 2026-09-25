# Referências visuais

Insumo da fase 3, fundação visual (`design/README.md`, Fases). Estuda produtos do gênero para extrair princípios, não para copiar. Levantado em 2026-09-24.

Como ler:

- Cada observação traz a URL de onde veio. Onde a fonte é uma extração de terceiros (Dembrandt, DesignMD, VoltAgent), a tabela diz; esses tokens costumam vir do **site de marketing**, não do app, e são marcados `(site)`.
- "Aplica ao MySpec" é filtrado pelo brief: árvore com status por cor como "depende de mim" (`brief.md` §5), conversa com o agente como tela central (§6), muito texto técnico, dois temas, largura contínua de 1100 a 2600 px, cor nunca como único portador de estado, WebKitGTK no Linux (§9).
- Não é proposta de design. As recomendações ficam só na seção 6, como pedido.

## 1. Ponto de partida: o que o código tem hoje

| Token | Valor | Arquivo |
|---|---|---|
| Fontes | Inter Variable (`cv11`, `ss01`), JetBrains Mono Variable | `frontend/src/styles/tokens.css`, `fonts.css` |
| Base e entrelinha | `1rem`, `1.45` | `tokens.css` |
| Tamanhos em uso | `text-xs` 209 vezes, `text-sm` 159, mais 6 tamanhos avulsos (`text-[11px]`, `text-[0.8rem]`…) | `grep` em `features/` e `components/` |
| Raio | `--radius: 0.625rem` (10 px), escala derivada do shadcn | `globals.css` |
| Neutros | Croma 0: texto `oklch(0.145 0 0)`, fundo `oklch(1 0 0)`; escuro com fundo `oklch(0.145 0 0)` | `globals.css` |
| Acento | `--primary: oklch(0.457 0.24 277)`, um índigo saturado | `globals.css` |
| Status | `--status-working` **é o próprio `--primary`**; atenção `oklch(0.72 0.16 70)`; sucesso `oklch(0.6 0.15 150)`; pausado é o cinza de texto mudo | `tokens.css` |
| Movimento | `120ms`, `150ms`, `cubic-bezier(0.2, 0, 0, 1)`; `prefers-reduced-motion` zera tudo | `tokens.css` |

Fato relevante para a fase 3: hoje a cor de marca e o sinal "agente trabalhando" são a mesma cor.

## 2. Referências por produto

### Linear

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Hierarquia | "Not every element of the interface should carry equal visual weight": a navegação recua, a área de trabalho manda | https://linear.app/now/behind-the-latest-design-refresh |
| Sidebar | A barra lateral foi escurecida "a few notches" para não competir com o conteúdo | idem |
| Estrutura | "Structure should be felt not seen": menos divisórias explícitas; bordas com cantos arredondados e contraste suavizado | idem |
| Cor | Menos azul de cromo, para uma aparência "more neutral and timeless"; o cinza padrão foi de frio azulado para "a warmer gray that still feels crisp, but less saturated" | https://linear.app/now/how-we-redesigned-the-linear-ui ; https://linear.app/now/behind-the-latest-design-refresh |
| Temas | Tema gerado de três variáveis em LCH: base, acento, contraste (antes, 98 variáveis por tema); permite temas de alto contraste | https://linear.app/now/how-we-redesigned-the-linear-ui |
| Contraste | Texto e ícones mais contrastados nos dois temas | idem |
| Ícones | Menos ícones, menores, sem fundos coloridos decorativos; abas compactas | https://linear.app/now/behind-the-latest-design-refresh |
| Atalhos | O atalho aparece no tooltip de cada ação; `Cmd+K` mostra o atalho de cada comando; `?` abre a referência | https://knock.app/blog/how-to-design-great-keyboard-shortcuts |
| **Evitar** | O acento lavanda como cromo generalizado, que o próprio Linear reduziu; copiar a tipografia de display (Inter Display) da marca para um app de trabalho | links acima |

### Raycast

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Ações e atalhos | Barra de ações no rodapé: à esquerda o contexto de navegação, à direita as ações do contexto com o atalho; ensina o atalho por exposição | https://www.raycast.com/blog/a-fresh-look-and-feel |
| Ação primária | A primeira ação é sempre `↵`, a segunda `⌘ ↵`; ações destrutivas numa seção separada ("Danger zone") | https://developers.raycast.com/api-reference/user-interface/action-panel |
| Densidade | Modo compacto opcional que "blends all other elements for a minimal appearance" | https://www.raycast.com/blog/a-fresh-look-and-feel |
| Cor | Paleta semântica curta que se ajusta sozinha ao tema claro e escuro, usada para tingir ícones e tags, não fundos | https://developers.raycast.com/api-reference/user-interface/colors |
| Ícones | Conjunto próprio com regras fixas de traço e raio | https://www.raycast.com/blog/a-fresh-look-and-feel |
| **Evitar** | O vocabulário de lançador (campo de busca gigante, lista única): o MySpec é uma mesa de trabalho de horas, não um comando de segundos | idem |

### Vercel (dashboard e Geist)

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Escala de cor | 10 degraus por escala, cada um com papel: 100–300 fundos de componente (padrão, hover, ativo), 400–600 bordas (padrão, hover, ativo), 700–800 fundos de alto contraste, 900–1000 texto secundário e primário | https://vercel.com/geist/colors |
| Semântica | Vermelho, âmbar, verde e azul como acentos semânticos com a mesma estrutura de 10 degraus | idem |
| Tipografia | Dois tipos de estilo: `label` (uma linha, entrelinha pensada para casar com ícone) e `copy` (várias linhas, entrelinha maior); `label-14` e `copy-14` são os mais usados; Geist Mono para código e números tabulares | https://vercel.com/geist/typography |
| Elevação | "Materials": superfícies no plano (raio 6 px) e flutuantes (tooltip 6 px, menu e modal 12 px, tela cheia 16 px), sombra cresce com a elevação | https://vercel.com/geist/materials |
| Status | `StatusDot` anima só em estado não terminal (`QUEUED`, `BUILDING`) e fica estático no terminal; cada estado tem título e rótulo, "so colorblind users get the same information" | https://vercel.com/geist/status-dot |
| Navegação | Sidebar redimensionável e escondível; ordem pelos fluxos mais comuns | https://vercel.com/changelog/new-dashboard-navigation-available |
| Desempenho | Velocidade percebida tratada como design (First Meaningful Paint 1.2 s mais rápido) | https://vercel.com/blog/dashboard-redesign |
| **Evitar** | O preto e branco puro de alto contraste da marca como fundo de um app de leitura longa; o grid decorativo, "core part of the Vercel aesthetic" | https://vercel.com/geist/introduction |

### GitHub (Primer, PR e Projects)

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Cor funcional | Tokens de base nunca usados direto; só tokens funcionais (`fgColor`, `bgColor`, `borderColor`) que já respeitam o tema | https://primer.style/foundations/color/overview |
| Papéis | `accent` (links, seleção), `success`, `attention` (avisos **e processos ativos**), `danger`, `done`, `open/closed`; cada papel em três variantes: texto, fundo `muted`, fundo `emphasis` | idem |
| Temas | Nove temas, com alto contraste de no mínimo 7:1 | idem |
| Tipografia | Corpo `0.875rem` (14 px), entrelinha 1.5; unidades em `rem`, entrelinhas em grade de 4 px; pesos 400/500/600 | https://primer.style/product/primitives/typography/ |
| Estado de PR | `StateLabel`: ícone + cor + texto por estado (draft cinza, open verde, merged roxo, closed vermelho) | https://primer.style/product/components/state-label/ |
| Checks | Checks agrupados por status, os que falharam no topo, em ordem alfabética | https://github.blog/changelog/2024-12-03-improved-pull-request-merge-experience-now-in-public-preview/ |
| Projects | Cor por opção de campo `single select`, agrupamento por campo | https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-single-select-fields |
| **Evitar** | Cores de status escolhidas pelo usuário por opção (Projects): viram decoração e perdem o significado fixo; o roxo "done" competindo com um acento roxo | https://github.com/orgs/community/discussions/178711 |

### Notion

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Neutros | Cinzas quentes em vez de preto: `#37352F` → `#787774` → `#9B9A97`, fundo `#F7F6F3` (site) | https://designmd.cc/benchmarks/notion |
| Ritmo | Escala de espaçamento de 4 px, peso 500 para elementos de interface, 400 para leitura (site) | idem |
| **Evitar** | A leveza de documento em tudo: o MySpec precisa de sinais de status fortes, e um cinza marrom demais achata o âmbar de "espera" | inferência sobre o item acima |

Arc não foi estudado: Notion cobre o mesmo ponto (sidebar calma, neutro quente) com documentação pública.

### Cursor

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Sidebar de agentes | Agentes de todos os repositórios numa lateral, agrupável por status; o grupo `Needs Attention` junta aprovações, perguntas e planos pendentes | https://github.com/deathemperor/infinitus/issues/269 |
| Estado por agente | Cartão com descrição, estado (`Planning / Executing / Reviewing / Done`), arquivos tocados, prévia do diff | https://www.digitalapplied.com/blog/cursor-3-agents-window-design-mode-complete-guide |
| Conversa | Fila de mensagens (`⌥+Enter`) e interrupção que entrega na próxima chamada de ferramenta (`⌘+Enter`) | https://github.com/deathemperor/infinitus/issues/269 |
| Diff | Diffs em largura cheia, painel de review ao lado do chat | https://cursor.com/docs/agent/agents-window |
| **Evitar** | O balde `Needs Attention` separado, que é exatamente o `Waiting for you` que o brief eliminou (`brief.md` §5); layout em mosaico de vários agentes, fora do "uma task por vez basta" (`brief.md` §2) | links acima |

### Warp

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Blocos | Cada comando e sua saída viram uma unidade com metadados (horário, código de saída, duração), selecionável e copiável | https://docs.warp.dev/terminal/blocks/ |
| Erro | Bloco que falhou tem fundo e **faixa lateral** vermelhos: o erro tem um portador espacial, não só a cor do texto | https://docs.warp.dev/terminal/blocks/block-basics/ |
| Contexto na rolagem | Cabeçalho fixo com o comando enquanto a saída longa rola | idem |
| Agente | Comandos que o agente rodou aparecem "as compact summaries inside the conversation view, expandable on demand" | https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment |
| Gestão | Painel com o estado de todos os agentes e notificação quando um termina ou precisa de ajuda | https://sdtimes.com/ai/warp-2-0-evolves-its-terminal-experience-into-an-agentic-development-environment/ |
| **Evitar** | Fundo vermelho cheio no bloco de erro dentro de uma conversa longa: pesa demais quando há vários | inferência sobre o item "Erro" |

### Zed

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Fontes separadas | Fonte da interface, do código e do painel de agente configuradas separadamente; interface `.ZedSans` (IBM Plex) 16, código `.ZedMono` (Lilex) 15 com entrelinha "comfortable" 1.618 | https://zed.dev/docs/visual-customization |
| Conversa | Indicadores de qual ferramenta o agente usa durante o streaming; o resumo das edições diz quais arquivos, quantos e quantas linhas | https://zed.dev/docs/ai/agent-panel |
| Compactação | Um marcador `Context Compacted` expansível na linha do tempo | idem |
| Notificação | Notificação do sistema e som quando o agente espera ou termina | idem |
| **Evitar** | Contagem de tokens perto do seletor de perfil: o usuário não quer tokens (`brief.md` §2) | idem |

### Claude.ai e Claude Code

| Aspecto | O que se aplica ao MySpec | Fonte |
|---|---|---|
| Leitura | A resposta do Claude usa por padrão uma serif (Anthropic Serif), com opções Sans, sistema e dislexia: a fala do agente é tratada como texto de leitura, distinta do cromo | https://support.claude.com/en/articles/8887527-customizing-your-appearance-settings ; https://www.itworkslocally.co.uk/blog/claudes-default-font-is-a-problem-heres-how-to-change-it |
| Neutros | Todos os cinzas da marca têm tom amarelo-marrom (`#5e5d59`, `#87867f`); texto `#141413`, fundo `#faf9f5`, escuro `#181715` (site) | https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/claude/DESIGN.md |
| Escala | Corpo 16/1.55, secundário 14/1.55, código 14 JetBrains Mono 1.6, raio 8 px em botões e 12 px em cartões (site) | idem |
| Densidade de ações | Claude Code desktop tem três modos: Normal (ferramentas recolhidas em resumos, texto inteiro), Verbose (toda chamada), Summary (só respostas finais e mudanças), alternados com `Ctrl+O` | https://aicatchup.com/news/claude-code-desktop-redesign |
| Sidebar | Sessões ativas e recentes filtráveis por status e projeto, agrupáveis por projeto; botão de uso com a janela de contexto | idem |
| Terminal | `Ctrl+O` abre a transcrição completa; `Ctrl+T` mostra a lista de tarefas com pendente, em curso e feito | https://code.claude.com/docs/en/interactive-mode |
| **Evitar** | O creme e o coral da marca: são identidade da Anthropic, e o MySpec não é um produto Anthropic; a serif em texto técnico denso (caminhos, listas de arquivos) | https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/claude/DESIGN.md |

### Orquestradores de agentes

| Produto | O que se aplica ao MySpec | Evitar | Fonte |
|---|---|---|---|
| **Conductor** (o mais próximo do MySpec: vários Claude Code em paralelo, um worktree e uma branch por tarefa, diff, PR, merge e arquivamento) | O ciclo de vida inteiro no mesmo lugar, do workspace ao arquivamento | Não há documentação pública da interface além do modelo | https://www.conductor.build/docs |
| **OpenAI Codex (app)** | Estados de thread nomeados: `Working`, `Waiting for input`, `Waiting for approval`, `Idle`, `Completed`, `Failed / Error`, `Interrupted`, como selo com tooltip de detalhe; review ao lado da thread com stage por diff, arquivo e trecho | Pedido de usuários para subir os que pedem atenção ao topo da lista: reordenação sozinha, que o MySpec descartou (`decisions.md`, 2026-09-23) | https://github.com/openai/codex/issues/38883 ; https://github.com/openai/codex/issues/20817 ; https://learn.chatgpt.com/docs/code-review?surface=app |
| **Devin** | Linha do tempo `Progress` como "control room": clicar num passo mostra o shell, as edições e o navegador daquele passo; plano apresentado antes da execução | IDE completa em nuvem como interface principal | https://fast.io/resources/devin-ide-guide/ ; https://cognition.com/blog/devin-2 |
| **Factory** | Sessões na lateral com contexto, progresso e histórico próprios; comentário por linha no diff como numa PR | Página de produto com gradientes e imagem de marketing: nada de interface documentado | https://factory.com/product/desktop |
| **Replit Agent** | Checkpoints no histórico, cada um com o que mudou e `Rollback here` | Foco em quem não programa | https://docs.replit.com/learn/build-with-agent |

## 3. Tokens públicos

| Produto | Fontes | Base de texto | Raio | Neutros | Acento e semânticas | Fonte |
|---|---|---|---|---|---|---|
| Linear (site) | Inter Variable, Berkeley Mono; pesos 400/510 | Botão 14; navegação do app 13 px peso 510 | 6, 8, 12 | Fundo `#08090a`, texto `#f7f8f8`, cinzas `#62666d`, `#8a8f98`; bordas 1 px com opacidade 0.05 e 0.08 | `#5e6ad2`; erro `#eb5757`; durações 120, 180, 280, 420 ms | https://www.dembrandt.com/explorer/linear ; https://www.shadcn.io/design/linear |
| Vercel Geist | Geist Sans, Geist Mono | `label-14`, `copy-14` | 6 no plano, 12 flutuante, 16 tela cheia | 10 escalas, 10 degraus com papel fixo; gray e gray-alpha; dois fundos | Azul, vermelho, âmbar, verde semânticos; P3 quando disponível | https://vercel.com/geist/colors ; https://vercel.com/geist/typography ; https://vercel.com/geist/materials |
| GitHub Primer | Mona Sans VF; `ui-monospace` | 14 px, entrelinha 1.5 | não levantado | Claro: `#ffffff`, `#f6f8fa`, texto `#1f2328`, mudo `#59636e`, borda `#d1d9e0`; escala neutra 0–13 | accent `#0969da`, success `#1a7f37`, attention `#9a6700`, danger `#d1242f`, done `#8250df` | https://primer.style/product/primitives/typography/ ; https://primer.style/product/primitives/color/ |
| Claude (site) | Styrene B, Tiempos/Copernicus; JetBrains Mono | Corpo 16/1.55, 14/1.55 | 4, 6, 8, 12, 16 | Quentes: `#faf9f5`, `#6c6a64`, `#141413`; escuro `#181715` | Coral `#cc785c`; success `#5db872`, warning `#d4a017`, error `#c64545` | https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/claude/DESIGN.md |
| Notion (site) | NotionInter (Inter modificada) | não levantado | não levantado | `#37352F`, `#787774`, `#9B9A97`, `#F7F6F3` | não levantado | https://designmd.cc/benchmarks/notion |
| Zed | IBM Plex (UI), Lilex (código) | UI 16, código 15, entrelinha 1.618 | não levantado | Tema do usuário | Tema do usuário | https://zed.dev/docs/visual-customization |
| Radix Colors (ferramenta, não produto) | — | — | — | 12 degraus: 1–2 fundos, 3–5 componente (normal, hover, selecionado), 6–8 bordas e foco, 9–10 sólido, 11–12 texto; cada cinza tem um matiz que casa com um acento (Slate com azul e índigo, Mauve com roxo e vermelho, Sand com âmbar e laranja) | Erro: vermelho; sucesso: verde; aviso: âmbar; info: azul | https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale ; https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette |

Cuidado de plataforma: todas as referências foram afinadas no macOS. No MySpec, WebKitGTK sobre GTK4 no Linux, `-webkit-font-smoothing` não tem efeito (https://developer.mozilla.org/en-US/docs/Web/CSS/font-smooth) e posição em meio pixel borra texto (`brief.md` §9). Um tamanho de 13 px pesa e rende diferente do mesmo 13 px no Linear em Mac; a escala precisa ser provada no app real.

## 4. Padrões que se repetem

| Problema do MySpec | Como as referências resolvem | Quem |
|---|---|---|
| Status na árvore sem depender da cor | Forma + cor + rótulo; anima só o que não é terminal | Vercel `StatusDot`, Primer `StateLabel` |
| Erro separado de espera | Portador espacial (faixa lateral) além da cor | Warp |
| Ações do agente sem afogar a leitura | Resumo recolhido por padrão, expansível; um modo de densidade para auditoria | Claude Code desktop, Warp, Zed |
| Marcos na linha do tempo | Entrada própria e expansível (`Context Compacted`), passo clicável que mostra o que aconteceu | Zed, Devin |
| Atalhos visíveis | No tooltip, no menu de comandos e numa barra de ações com o atalho ao lado | Linear, Raycast |
| Checks de uma PR | Agrupados por status, falhas primeiro, nome em ordem alfabética | GitHub |
| Navegação que não compete | Lateral mais escura ou mais apagada que a área de trabalho | Linear |
| Estados de sessão | Vocabulário fechado e curto, com detalhe no tooltip | Codex |

## 5. Princípios extraídos

1. Nem todo elemento tem o mesmo peso: a lateral recua e a conversa manda (Linear, https://linear.app/now/behind-the-latest-design-refresh).
2. A estrutura se sente, não se vê: menos divisórias, mais agrupamento por espaço e tom (Linear, idem).
3. Cor é função, não decoração: só tokens funcionais com papel fixo chegam à tela (Primer, https://primer.style/foundations/color/overview).
4. Todo estado tem forma, cor e texto, e só o que está em curso se move (Vercel, https://vercel.com/geist/status-dot).
5. Cada degrau da escala tem um papel escrito (fundo, hover, borda, texto), e ninguém escolhe cinza a olho (Geist, https://vercel.com/geist/colors; Radix, https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).
6. Um tema é gerado de poucas variáveis num espaço perceptual, para os dois temas e o alto contraste saírem coerentes (Linear, https://linear.app/now/how-we-redesigned-the-linear-ui).
7. O texto de uma linha e o de leitura são estilos diferentes, com entrelinhas diferentes (Geist `label` e `copy`, https://vercel.com/geist/typography; Claude, a fala do agente em fonte de leitura, https://support.claude.com/en/articles/8887527-customizing-your-appearance-settings).
8. As ações do agente aparecem resumidas e se abrem sob demanda (Claude Code desktop, https://aicatchup.com/news/claude-code-desktop-redesign; Warp, https://www.warp.dev/blog/block-model-behind-warps-agentic-development-environment).
9. O atalho está escrito ao lado da ação, e a ação primária de um contexto é sempre `Enter` (Raycast, https://developers.raycast.com/api-reference/user-interface/action-panel; Linear, https://knock.app/blog/how-to-design-great-keyboard-shortcuts).
10. Falha vem primeiro e tem um portador que não é só cor (GitHub, https://github.blog/changelog/2024-12-03-improved-pull-request-merge-experience-now-in-public-preview/; Warp, https://docs.warp.dev/terminal/blocks/block-basics/).

## 6. Eixos de direção visual

Três eixos em que as direções da fase 3 podem diferir de verdade. Densidade **não** é um eixo: a estrutura já fixou a linha compacta da árvore (`structure.md`, §2), e o brief pede leitura longa na conversa (`brief.md` §6). Todas as referências resolvem isso com dois registros, um compacto para o cromo e outro de leitura para a conversa (Geist `label`/`copy`, Zed UI/código, Claude); as direções devem variar os valores, não a ideia.

### Eixo 1. Temperatura do neutro

| Polo | Quem | O que muda no MySpec |
|---|---|---|
| Frio ou acromático | Primer, Geist, Linear até 2025, o MySpec hoje (croma 0) | Técnico, preciso; o escuro tende a azulado e cansa em sessões longas |
| Quente | Linear 2026, Notion, Claude | Mais calmo para ler horas; risco: o âmbar de "espera" perde separação de um fundo amarelado |

**Recomendação**: neutro quase acromático com um leve matiz quente, croma baixo o bastante para não ser percebido como bege. É para onde o Linear foi ("warmer gray that still feels crisp, but less saturated"). A direção tem que provar que o âmbar de espera continua distinto do fundo nos dois temas; se não continuar, o neutro volta ao acromático.

### Eixo 2. Papel da cor: acento de marca ou só semântica

| Polo | Quem | O que muda no MySpec |
|---|---|---|
| Acento de marca forte + semânticas | Linear (lavanda), Claude (coral), o MySpec hoje (índigo) | Identidade; mas o acento compete com os sinais de status, e hoje é literalmente o sinal de "trabalhando" |
| Só semântica, cromo neutro | Primer, Geist, Raycast | Toda cor na tela significa um estado; seleção, foco e botão primário ficam em neutro de alto contraste ou num único tom reservado |

**Recomendação**: semântica primeiro. Um conjunto fechado de papéis de status (erro, espera, encerramento, trabalhando, neutro), cada um com texto, fundo sutil e fundo cheio, como no Primer. No máximo um acento de interação para foco, seleção e ação primária, com matiz que não se confunda com nenhum papel de status. O brief diz que a árvore por cor é o "depende de mim": cada cor gasta em decoração enfraquece esse sinal.

### Eixo 3. Separação: bordas ou superfícies

| Polo | Quem | O que muda no MySpec |
|---|---|---|
| Bordas finas sobre um plano | Geist, Primer | Preciso, bom para listas e tabelas (board, PRs, checks); com muitos painéis vira grade de linhas |
| Superfícies tonais, poucas bordas | Linear 2026 ("structure should be felt not seen"), Claude.ai | Lateral, conversa e painéis se separam por tom; mais calmo; exige uma escala de fundos bem calibrada nos dois temas |

**Recomendação**: superfícies para as regiões (lateral mais apagada que a conversa, painel auxiliar em outro degrau) e bordas só dentro delas, para separar linhas de listas e cartões de decisão. O modelo de materiais do Geist (plano contra flutuante, raio e sombra crescendo com a elevação) serve de regra para o que flutua: menus, diálogos, tooltips.

## 7. Pergunta para o usuário

- **O MySpec tem ou quer uma cor de identidade?** Hoje é o índigo padrão do shadcn. A resposta decide o eixo 2: sem identidade, a direção recomendada (cromo neutro, cor só como sinal) fica livre; com identidade, ela precisa de um lugar que não colida com os status, como o ícone e a tela de boas-vindas.
