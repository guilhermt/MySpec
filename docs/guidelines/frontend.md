# Frontend

React 19, TypeScript em modo strict, Vite, Tailwind CSS 4, shadcn/ui sobre Base UI, Zustand. Biome aplica a parte mecânica com `biome.json`; `tsc` aplica os tipos com `tsconfig.json`, que liga `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e `verbatimModuleSyntax`, e com `tsconfig.painted.json`, que o estende para a suíte de estilo computado ([testing.md](./testing.md)).

## Fronteira com o Go

- `lib/wails.ts` é o único arquivo que importa `@bindings/*` e `@wailsio/runtime`. Ele reexporta os tipos, define as uniões de strings, as funções `asX` que estreitam os enums, o objeto `api` e as funções `onX` dos eventos.
- Um DTO novo ou um método novo no Go entra em `lib/wails.ts` (tipo, `asX` se for enum, função em `api`) e em `test/wails-mock.ts` (mock da função e fábrica `makeX`), sempre juntos.
- O `State` que chega é a verdade. O frontend não deriva estado de produto; deriva apresentação: rótulos, tons, o que mostrar onde.

## Store e ações

- `store/app-store.ts` guarda o `State`, os transcripts por chave de sessão e o estado de interface. Cada campo tem um comentário `/** ... */` dizendo o que é. O store importa só de `lib/` e de `store/`.
- Componentes leem o store por hooks seletores exportados (`useTask`, `useOpenTaskId`, `useOpenBoardId`...), com `useShallow` quando o seletor devolve um objeto ou array novo. Um componente nunca assina o store inteiro.
- Componentes agem por `store/actions.ts`. Cada ação chama `api` dentro de `run`, que transforma um erro na mensagem do aviso. Nenhuma ação toca o `State`: o estado novo chega por `state:changed`.
- A navegação é um `Location` (`lib/locations.ts`) no store, aberto por `go`. Uma tela nova é uma variante do `Location`, nunca um campo de "aberto" ao lado dele; o que uma tela precisa saber do lugar vem de um seletor derivado dele.
- Estado de interface que precisa sobreviver a uma navegação (edição de prompt, navegação pendente) vive no store; o que é local a um componente vive em `useState`.

## Componentes

- Um componente por arquivo, exportado por nome, com `export interface XProps` acima. Funções, nunca classes.
- A lógica de apresentação sem React vai para um arquivo `.ts` ao lado (`status.ts`, `step-status.ts`, `pr-status.ts`, `stage-actions.ts`): recebe DTOs, devolve rótulos, tons e booleanos, e é testada sem renderizar.
- Os componentes do design system moram em `components/system/`: embrulham os primitivos de `components/ui/`, gerados pelo shadcn e nunca editados, ou são próprios sobre o Base UI. Um comportamento diferente de um primitivo é um wrapper em `components/system/`, nunca em `features/`.
- Código novo de uma feature importa os componentes de `components/system/`. As importações de `components/ui/` que existem nas features são as das telas anteriores ao design system, e o redesenho de cada tela as troca pelas de `components/system/`.
- Um componente próprio usado por mais de uma feature, como o `FilterMenu` das visões de board e de reviews, fica em `src/components/`, ao lado de `ui/`, com o teste ao lado. Um componente de uma feature só fica na feature; ele sobe para `src/components/` quando uma segunda feature precisa dele.
- Ícones do `lucide-react`. Classes com `cn` de `lib/utils`; variantes com `class-variance-authority`.
- Toda constante de apresentação com mais de um uso é nomeada e comentada (`REVIEW_STATES`, `MAX_CORRECTIONS`, que espelha `flow.MaxCorrections`).
- Textos da interface em inglês, curtos, com o separador `·` entre partes de uma mesma linha, como modelo e esforço. O usuário é "you"; o agente é "the agent".

## Acessibilidade

- Toda superfície interativa tem um papel e um nome acessível; os testes a encontram por `getByRole`.
- Uma cor nunca é o único portador de um estado: cada ponto de status é `aria-hidden` e vem acompanhado de um rótulo em texto. Estados vivos (`role="status"`) para o que muda sozinho.
- Foco visível, navegação por teclado na lista de tasks e nos diálogos, atalhos que funcionam com o foco em qualquer lugar da janela.
- `prefers-reduced-motion` zera as durações; as animações usam as três durações (`--duration-fast`, `--duration-base`, `--duration-slow`) e as curvas `--ease-standard`, `--ease-enter` e `--ease-exit`, nunca valores soltos. Os dois laços, o giro do spinner e o brilho de uma leitura sem resultado, param sem movimento: o spinner fica como um anel de três quartos e o brilho, chapado.

## Estilo

- Os tokens vêm de `design/system/tokens.css`, a fonte única dos valores, que `styles/globals.css` importa e liga às variáveis do shadcn e aos utilitários do Tailwind. Cor só existe lá: uma cor nova é um token, nunca um valor inline nem uma cor da paleta do Tailwind (`text-red-500`), e `styles/globals.test.tsx` falha com uma ou outra fora de `components/ui/`. O tema é o atributo `data-theme` do `documentElement`. As classes seguem [design-system.md](../architecture/design-system.md): utilitários registrados (`bg-surface-2`, `text-ink-3`, `shadow-float`) e `text-(length:--text-…)` com `leading-(--leading-…)` para o tamanho de texto.
- Tamanhos em `rem`; o tamanho da fonte raiz escala a interface inteira.
- Um elemento posicionado com texto não é centralizado com translate percentual puro (`left-1/2 -translate-x-1/2`): quando a largura ou a altura dá ímpar, o deslocamento cai em meio pixel, e o WebKitGTK compõe o elemento nessa posição e o reamostra, o que borra texto e bordas. Cada valor da centralização é arredondado para o pixel com `round()`, como no `ScrollToBottomButton`: `left-[round(50%,1px)] translate-x-[round(-50%,1px)]`. Os dialogs do shadcn (`DialogContent`, `AlertDialogContent`) abrem a 8vh do topo e crescem para baixo, com o `left` e o translate horizontal arredondados, e o véu atrás deles é o `--scrim`, sem desfoque, por regras sem camada no fim de `styles/globals.css`, que os selecionam pelo `data-slot`; `styles/globals.test.tsx` falha se os componentes gerados deixarem de corresponder a ela.
- Um container de scroll (`overflow-y-auto`) com descendentes posicionados, `sr-only` inclusive, que é `position: absolute`, é ele mesmo `relative`: assim esses descendentes têm o container como bloco de contenção, rolam com o conteúdo, são recortados por ele e nunca inflam o scroll de um container em volta. A referência é o scroller da conversa em `Conversation.tsx`. Os painéis da conversa das telas de task e de review recebem `style={{ overflow: "clip" }}`, porque o `Panel` do `react-resizable-panels` é `overflow: auto` inline, o que uma classe não sobrescreve, e ali só a conversa rola.
- Biome formata: aspas duplas, ponto e vírgula, vírgula final, largura 100. `task fmt:web` aplica; o hook de pre-commit também.
- `import type` para tipos; imports ordenados pelo Biome; sem `any`, sem `!` de non-null, sem variáveis ou imports sem uso. `useEffect` com as dependências exaustivas.
- Um `biome-ignore` exige a regra e a razão.
