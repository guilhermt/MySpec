# Frontend

React 19, TypeScript em modo strict, Vite, Tailwind CSS 4, shadcn/ui sobre Base UI, Zustand. Biome aplica a parte mecânica com `biome.json`; `tsc` aplica os tipos com `tsconfig.json`, que liga `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e `verbatimModuleSyntax`.

## Fronteira com o Go

- `lib/wails.ts` é o único arquivo que importa `@bindings/*` e `@wailsio/runtime`. Ele reexporta os tipos, define as uniões de strings, as funções `asX` que estreitam os enums, o objeto `api` e as funções `onX` dos eventos.
- Um DTO novo ou um método novo no Go entra em `lib/wails.ts` (tipo, `asX` se for enum, função em `api`) e em `test/wails-mock.ts` (mock da função e fábrica `makeX`), sempre juntos.
- O `State` que chega é a verdade. O frontend não deriva estado de produto; deriva apresentação: rótulos, tons, o que mostrar onde.

## Store e ações

- `store/app-store.ts` guarda o `State`, os transcripts por chave de sessão e o estado de interface. Cada campo tem um comentário `/** ... */` dizendo o que é. O store importa só de `lib/` e de `store/`.
- Componentes leem o store por hooks seletores exportados (`useTask`, `useTasksOf`, `useOpenTask`...), com `useShallow` quando o seletor devolve um objeto ou array novo. Um componente nunca assina o store inteiro.
- Componentes agem por `store/actions.ts`. Cada ação chama `api` dentro de `run`, que transforma um erro na mensagem do aviso. Nenhuma ação toca o `State`: o estado novo chega por `state:changed`.
- Estado de interface que precisa sobreviver a uma navegação (edição de prompt, navegação pendente) vive no store; o que é local a um componente vive em `useState`.

## Componentes

- Um componente por arquivo, exportado por nome, com `export interface XProps` acima. Funções, nunca classes.
- A lógica de apresentação sem React vai para um arquivo `.ts` ao lado (`status.ts`, `step-status.ts`, `repo-status.ts`, `stage-actions.ts`): recebe DTOs, devolve rótulos, tons e booleanos, e é testada sem renderizar.
- Os primitivos vêm de `components/ui/`, gerados pelo shadcn e nunca editados. Um comportamento diferente é um wrapper em `features/`.
- Ícones do `lucide-react`. Classes com `cn` de `lib/utils`; variantes com `class-variance-authority`.
- Toda constante de apresentação com mais de um uso é nomeada e comentada (`REVIEW_STATES`, `MAX_CORRECTIONS`, que espelha `flow.MaxCorrections`).
- Textos da interface em inglês, curtos, com o separador `·` entre partes de uma mesma linha, como modelo e esforço. O usuário é "you"; o agente é "the agent".

## Acessibilidade

- Toda superfície interativa tem um papel e um nome acessível; os testes a encontram por `getByRole`.
- Uma cor nunca é o único portador de um estado: cada ponto de status é `aria-hidden` e vem acompanhado de um rótulo em texto. Estados vivos (`role="status"`) para o que muda sozinho.
- Foco visível, navegação por teclado na árvore e nos diálogos, atalhos que funcionam com o foco em qualquer lugar da janela.
- `prefers-reduced-motion` zera as durações; as animações usam os tokens `--duration-fast`, `--duration-base` e `--ease-standard`, nunca valores soltos.

## Estilo

- Tailwind com os tokens de `styles/globals.css` (cores em oklch, temas `:root` e `.dark`) e `styles/tokens.css` (fontes, tamanhos, durações, cores de status). Uma cor nova é um token, não um valor inline.
- Tamanhos em `rem`; o tamanho da fonte raiz escala a interface inteira.
- Biome formata: aspas duplas, ponto e vírgula, vírgula final, largura 100. `task fmt:web` aplica; o hook de pre-commit também.
- `import type` para tipos; imports ordenados pelo Biome; sem `any`, sem `!` de non-null, sem variáveis ou imports sem uso. `useEffect` com as dependências exaustivas.
- Um `biome-ignore` exige a regra e a razão.
