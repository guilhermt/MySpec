# Crítica das correções da task 2 · PR #68

Revisão da branch `shell-fixes` antes do merge, até o commit `549d7e1` (depois de `9035a5b` e `7392046`). A régua: as 17 divergências de `design/research/critique-task-02.md`, os oito restos (R1 a R8) da primeira versão desta crítica, `design/structure.md` §2, §3 e §6, `design/system/components.md` (grupo Shell), `design/system/tokens.css` e os mocks `design/lab/08-visual-final/index.html` e `design/lab/10-screen-task-minimal/b.html`. Os caminhos de código são relativos a `frontend/src/`, e as linhas são as de `549d7e1`.

## Como foi verificado

- **Testes em `549d7e1`.** `task test:web`: jsdom, 2.580 testes, verde; suíte pintada (Chromium), 304 testes, verde. `task test:go`: 2.455 testes (1 pulado), cobertura total de 90,8%, limites satisfeitos.
- **Mutação**, numa cópia de `frontend/` e `design/system/` no scratchpad. Cada correção foi revertida sozinha e o teste rodado nos dois temas:
  - **R1.** Com a versão de `7392046` de `whenExitEnds` (a subárvore do invólucro, sem filtro e sem teto), `lets a closed panel go even with a loop running inside it` falha. Uma sonda à parte, um `AuxPanel` numa área principal de 1400 px com o ponto de step pulsando, um `Skeleton`, um `Shimmer` e o glifo `work` dentro, agora sai do documento nos cinco casos. Na primeira revisão, quatro deles ficavam presos.
  - **R2.** Com `gap-(--row-gap)` de volta na seção (`Tree.tsx:136`), `sets the first line of a section one step under its node` falha (8 contra 4).
  - **R4.** Com o trilho da linha de volta à sombra, `draws the error rail on the left edge` falha.
  - **R8.** Com o pé e o separador centrados por flex, `centres the foot of every block and what a separator says on whole pixels` falha (o relógio `now` cai em meio pixel).
  - **R5.** Sem o `setPushedOut` (`ShellToasts.tsx:33`), `plays the exit of the oldest toast a fourth one pushes out` falha.
- **A tela montada.** A mesma página de teste da primeira revisão (a `Sidebar` e o `TaskHeader` reais, com dados falsos de todos os estados da lateral) foi capturada de novo a 1250 e 2560 px, aberta e recolhida, claro e escuro. Resultados:
  - nenhuma caixa da faixa fica fora do pixel inteiro, na horizontal ou na vertical;
  - o glifo fica acima do pé em todo bloco;
  - o trilho de erro é uma barra reta na linha e no bloco, como `08/index.html:542`;
  - o nó de topo fica a 4 px da primeira linha, como o `.grp` do mock.
- **O merge com `main`.** `git merge-tree --write-tree main shell-fixes` sai sem conflito. No resultado, o diff de `design/system/` contra `main` é exatamente o da PR contra a base (`64fd7cd`), e o diff contra `shell-fixes` é exatamente o de `main` contra a base. As edições de `9566b85` e `75c9953` em `components.md` e as da PR em `components.md` e `tokens.css` sobrevivem inteiras.

## Os oito restos da primeira versão

| # | Estado | Evidência |
|---|---|---|
| R1 | Corrigido | `whenExitEnds` espera só as animações finitas do próprio elemento (`Presence.tsx:15`), com a duração da saída como teto (`:32`), e o `Presence` o chama com o elemento que ele guarda (`:65`). Um painel cujo elemento não anima sai na hora. Com movimento reduzido, a saída tem 0 ms, e o teto é 0. Ver o resto M1 |
| R2 | Corrigido | `Tree.tsx:136`, com a prova pintada |
| R3 | Corrigido | A contagem de History sobe para `--ink-3` com o botão pressionado (`features/sidebar/SidebarFooter.tsx:97`), 5,18:1 no claro. O `className` chega ao `button` pelo `cn` de `Button.tsx`. Sem teste pintado, pela mesma razão aceita na divergência 12 |
| R4 | Corrigido | O `@utility error-rail-bar` (`styles/globals.css:197–209`) é o `::before` do mock, na linha (`TreeRow.tsx:112`) e no bloco (`SidebarRail.tsx:147`), documentado em `docs/architecture/design-system.md`. Ver o resto M2 |
| R5 | Corrigido | `ShellToasts` guarda o toast que o store tira e o passa com `leaving` (`features/notice/ShellToasts.tsx:26–33`). O toast que saía sozinho e é empurrado no meio da saída mantém a instância, pela mesma chave, e termina uma vez. Um toast que o store tira por outro caminho, como `openArchived`, também toca a saída |
| R6 | Corrigido na régua do system | `components.md:73` e `:316` passam a `checking GitHub`, como `structure.md:144` e o código. Ver o resto M3 |
| R7 | Corrigido | `MenuText` (`components/system/Menu.tsx:184`) e a variante **Linha de texto** em `components.md:208` |
| R8 | Corrigido | `CENTERED` (`SidebarRail.tsx:70`) centra o pé e o que o separador diz com `round()`, e o que o separador diz interrompe o fio sobre `--surface-sidebar`, como pede a regra de meio pixel |

`--notice-detail-min` foi para o bloco das colunas (`tokens.css:112`), ao lado dos outros `calc(var(--space-16) * N)`.

## O que resta, da mais grave para a menos

Nada impede o merge. Tudo abaixo é registro, e pode entrar junto da task 3 ou da varredura da task 12.

**M1. Duas partes da correção de R1 não têm prova.** Com o filtro dos laços removido (`Presence.tsx:15`), ou sem o teto (`:32`), ou com `getAnimations({ subtree: true })` no próprio elemento, a suíte continua verde. O teste do laço prova só que a espera saiu da subárvore do invólucro. Dois casos ficam sem prova: um laço no próprio elemento que sai, e uma saída que nunca avisa o fim. Opinião: o teto em `endTime`, contado a partir do efeito e não do início da animação, pode cortar o último quadro da saída (cerca de 16 ms, com a opacidade já perto de 0). Não se vê, mas `finished` sozinho já basta no caso comum.

**M2. O trilho de erro do bloco da faixa não tem prova.** Com o bloco de volta à sombra curva (`SidebarRail.tsx:147`), a suíte continua verde. Só a linha da árvore tem o teste pintado da barra.

**M3. Restam três `checking GitHub…` fora do system.** São `design/principles.md:83` (em `main`), o comentário de `components/system/Shimmer.tsx:9` e o texto de `Shimmer.test.tsx:8–9`. Os dois últimos são só exemplo. O primeiro é régua. Hoje `principles.md` tem edições em andamento na worktree principal, então o alinhamento é do coordenador.

**M4. A saída do toast empurrado repete a lógica do `Presence`.** `ShellToasts.tsx:21–60` guarda à mão o que sai (`pushedOut`, `shown`, `dismissed`), em vez de reusar o `Presence` do painel. Funciona e está provado. É opinião: são duas formas de "manter até a saída" no shell, e a segunda só serve a uma lista.

**M5. Durante a saída do toast empurrado, a região mostra quatro toasts por 120 ms.** `components.md:433` diz "até três empilhados, e o mais antigo sai". Ler a saída como parte do "sai" é razoável, e não vejo defeito. Fica anotado para a varredura.

## Veredito

**Mergear.** As 17 divergências e os oito restos estão corrigidos. Cada prova pintada nova derruba o teste certo quando a correção é revertida. A tela montada bate com os mocks nos dois temas e nas duas larguras, e o merge com `main` preserva as edições dos dois lados em `components.md` e `tokens.css`. M1 a M5 são lacunas de prova e registros, não defeitos visíveis.
