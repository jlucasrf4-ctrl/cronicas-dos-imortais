# Materiais de fabricação (proposta)

Hoje as receitas usam insumo cru demais (galho direto na Forja, calça de folha, armadura de pele crua). A ideia é
pôr **poucos** materiais intermediários, cada um ligado a um sistema que já existe, sem encher o jogo de etapas.
Decidido com o mantenedor em 2026-10-18 ("confio na sua decisão"). Mesmo jeito de trabalhar do
[ROADMAP.md](../ROADMAP.md): uma etapa por vez, cada uma aprovada.

**Status:** M0 feito em 2026-10-18 (junto com o cinto, parte 3 do inventário novo). M1–M3 em aberto.

## Materiais

| Material | De onde vem | Onde entra |
|---|---|---|
| **Cabo de madeira** (`cabo`) | Carpintaria: 1 galho esculpido | Facas (feito); depois espada, machado, ferramentas |
| **Couro curtido** (`couro`) | Carpintaria: 1 pele + 1 galho (a casca curte) | Cinto, bolsa (feito); depois armaduras de couro, botas, mochila, aljava |
| **Linho** (`linho`) | Só se compra: loja da Vila Musgo (4 de ouro) | Bolsa (feito); depois calça, forros, corda melhor |
| **Rebites** | Forja: 1 ferro → vários | Escudo, fivela, baú (M2) |
| **Haste** | Carpintaria: galhos | Lança (M2) |
| Tendão (opcional) | Caça (lobo, cervo) | Corda do arco (M3) |

## Etapas

- [x] **M0 — o que o cinto precisa:** cabo, couro e linho como itens; receitas na carpintaria (cabo, couro, faca
      simples, cinto, bolsa); linho na Vila Musgo; a Faca de Caça leva cabo em vez de galho; a Faca Velha (presente
      do tutorial) e o que sai da carpintaria deixam de aparecer na Forja (`EQ_BASE[...].forja = false`).
- [ ] **M1 — receitas da Forja sem insumo cru:** espada, espada longa e machado com cabo; armadura, botas e botas
      reforçadas com couro; calça com linho (hoje folhama); elmo com forro (linho ou couro).
- [ ] **M2 — rebites e haste:** rebites na Forja; escudo e escudo reforçado = tábuas + aro de ferro + rebites; lança
      com haste.
- [ ] **M3 — madeira e corda de arco:** arco e arco longo feitos na carpintaria com corda de arco (tendão ou linho);
      mochila e aljava com couro.
- [ ] **Curtir com tempo:** hoje curtir é instantâneo na carpintaria; o realista é deixar de molho no acampamento
      (como assar). Fica para quando o acampamento tiver tarefas que levam tempo.

## Receitas feitas (M0)

| Receita | Custo | Sai |
|---|---|---|
| Cabo de madeira | 1 galho | 1 cabo |
| Curtir couro | 1 pele + 1 galho | 1 couro |
| Faca simples | 1 cabo + 2 pedras | Faca Simples (dura 20, quebra no fim) |
| Cinto de couro | 2 couros + 1 ferro (fivela) | Cinto A, A+ ou SS (sorteio; Artesão alto ajuda) |
| Bolsa pequena | 1 couro + 1 linho | Bolsa 3 × 2 |
| Faca de Caça (Forja) | 1 ferro + 1 cabo | Faca de Caça (dura 80) |

## Em aberto

1. Preço do linho (4) e do couro na venda: ajustar depois de jogar.
2. Quando o ranque C–SS ([equipamento.md](equipamento.md)) entrar, o cinto troca A/A+/SS pela escala nova.
