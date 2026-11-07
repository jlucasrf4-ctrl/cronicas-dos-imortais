# Orientação para agentes

## Contexto rápido

- Projeto: **Mapa Vivo — Crônicas dos Imortais**, RPG/simulador de mundo em navegador, em pt-BR.
- Estado atual do jogo: **v8.1**. O nome da pasta ainda diz `v7.6`; não use isso para inferir a versão.
- Entrega: um HTML autocontido, gerado de `index.html` e módulos TypeScript em `src/`.
- Stack: TypeScript estrito, Vite, Canvas 2D, renderer WebGL2 próprio, CSS/HTML sem framework, saves em `localStorage`.
- Referência `reference/` é a versão congelada v7.6; não editar. `dist/` e `build/` são saídas; não editar.
- Interface, identificadores e comentários novos seguem português. Preserve o estilo e as decisões do jogo.

## Antes de trabalhar

1. Leia este arquivo e `ROADMAP.md` (somente a seção da tarefa se for longa).
2. Leia `CLAUDE.md` apenas para regras técnicas detalhadas da área tocada; ele contém o mapa completo de módulos, build, tipos e testes.
3. Inspecione os arquivos relacionados à tarefa antes de editar. Procure a implementação existente em `src/`; não acrescente wrappers em cadeia.
4. Faça uma alteração por tarefa. Não amplie o escopo nem reescreva sistemas vizinhos sem necessidade.

## Regras práticas

- Fonte de verdade: `index.html` + `src/`. Módulos de domínio em `src/<área>/`; tabelas ajustáveis em `src/data/`; inicialização e listeners em `src/inicio/`; CSS em `src/styles/` e registrado em `src/manifest.ts`.
- Estado compartilhado e tipos: `src/core/state.ts` e `src/core/tipos.ts`. Declare campos novos nos tipos correspondentes; mantenha `strict`, sem `any` ou `@ts-nocheck`.
- Não edite artefatos gerados em `dist/`/`build/`, nem a referência congelada.
- Ao concluir, resuma arquivos e comportamento alterados, verificações executadas e limitações. Não rode verificações por rotina; faça-as quando o usuário pedir ou quando forem necessárias para validar uma mudança.
- Se uma etapa do `ROADMAP.md` foi concluída, atualize sua caixa e a linha `Status`. Respeite pedidos de manter uma tarefa por vez.

## Mapa dos documentos

- `ROADMAP.md`: objetivo atual, sequência e próximo passo.
- `CLAUDE.md`: instruções técnicas completas, convenções e comandos.
- `README.md`: visão geral, stack, estrutura e início rápido.
- `docs/smoke-checklist.md`: roteiro de conferência manual.
- `docs/roadmap-historico.md`: histórico da reforma técnica; consulte só se precisar de contexto histórico.

## Modelo de pedido econômico

> **Objetivo:** [resultado observável].
> **Contexto:** [área/arquivo ou problema].
> **Limites:** [o que preservar ou evitar].
> **Pronto quando:** [critério verificável].
> Inspecione a implementação atual, faça uma tarefa por vez e reporte mudanças e verificações.

Se o pedido apontar para um arquivo ou comportamento, não peça ao usuário para repetir contexto que já esteja no repositório: localize-o e avance.
