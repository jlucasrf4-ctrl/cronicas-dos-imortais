/* ==== Fase 4 — código de carga do antigo src/js/modulos/v4.5_forja.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarForja() na ordem do antigo manifesto. */
import { EQ_BASE } from "../../data/equipamento.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { forgeInit } from "../../forja/forja.ts";

export function iniciarForja() {
  /* =====================================================================
     v4.5 — DESGASTE, RECEITAS E FORJA
     · Armas e armaduras se desgastam: espada a cada golpe que acerta, arco
       a cada flecha, escudo a cada bloqueio, armaduras a cada dano sofrido.
       Chegou a 0 → QUEBRA e some do corpo (sobra um pouco de material).
     · Só dá para forjar ou consertar o que o acampamento SABE fazer.
       Aprende-se lendo um Projeto (achado na masmorra; o Lobo Alfa sempre
       deixa um) ou desmontando um item (ele vira material + receita).
     · Minigame: aquecer no fole, martelar no tempo certo, temperar.
       O resultado define a QUALIDADE: Ruim, Comum, Boa ou Excelente.
  ===================================================================== */
  Object.assign(ITEM_DEFS.eq_espada, { dmg: 1 });
  Object.assign(ITEM_DEFS.eq_arco, { dmg: 1 });
  Object.assign(ITEM_DEFS.eq_escudo, { block: 1 });
  Object.assign(ITEM_DEFS, {
    eq_espada_longa: {
      key: "eq_espada_longa",
      name: "Espada Longa",
      emoji: "⚔️",
      color: "#c3ccd8",
      slot: "maoD",
      dmg: 1.3,
      val: 40,
      w: 0.5,
    },
    eq_cota: {
      key: "eq_cota",
      name: "Cota de Malha",
      emoji: "⛓️",
      color: "#8d96a3",
      slot: "peito",
      armor: 0.18,
      val: 45,
      w: 0.5,
    },
    eq_elmo_prata: {
      key: "eq_elmo_prata",
      name: "Elmo de Prata",
      emoji: "🪖",
      color: "#c9d1dc",
      slot: "cabeca",
      armor: 0.09,
      val: 38,
      w: 0.4,
    },
    eq_escudo_ref: {
      key: "eq_escudo_ref",
      name: "Escudo Reforçado",
      emoji: "🛡️",
      color: "#7d8590",
      slot: "maoE",
      block: 0.7,
      val: 34,
      w: 0.5,
    },
    eq_arco_longo: {
      key: "eq_arco_longo",
      name: "Arco Longo",
      emoji: "🏹",
      color: "#a0703a",
      slot: "costas",
      dmg: 1.3,
      val: 40,
      w: 0.4,
    },
    eq_botas_ref: {
      key: "eq_botas_ref",
      name: "Botas Reforçadas",
      emoji: "👢",
      color: "#6a4a2a",
      slot: "pes",
      armor: 0.05,
      val: 22,
      w: 0.5,
    },
  });
  for (const [k, base] of [
    ["eq_espada_longa", "eq_espada"],
    ["eq_cota", "eq_armadura"],
    ["eq_elmo_prata", "eq_elmo"],
    ["eq_escudo_ref", "eq_escudo"],
    ["eq_arco_longo", "eq_arco"],
    ["eq_botas_ref", "eq_botas"],
  ])
    ITEM_DEFS[k].shape = ITEM_DEFS[base].shape!.map((r) => r.slice());
  for (const k in EQ_BASE) {
    // um Projeto para cada receita
    const d = ITEM_DEFS[k];
    ITEM_DEFS["projeto_" + k] = {
      key: "projeto_" + k,
      name: "Projeto: " + d.name,
      emoji: "📜",
      color: "#cbb58a",
      val: 15,
      w: 0.55,
      blueprint: k,
      shape: [
        [1, 1, 1],
        [1, 1, 1],
      ],
      desc: "Desenhos e medidas para forjar " + d.name + ". Estude para o acampamento aprender a receita.",
    };
  }
  for (const k in EQ_BASE)
    if (!ITEM_DEFS[k].desc)
      ITEM_DEFS[k].desc =
        (ITEM_DEFS[k].armor ? "Proteção −" + Math.round(ITEM_DEFS[k].armor * 100) + "% de dano. " : "") +
        (ITEM_DEFS[k].dmg && ITEM_DEFS[k].dmg !== 1 ? "Dano ×" + ITEM_DEFS[k].dmg + ". " : "") +
        (ITEM_DEFS[k].block && ITEM_DEFS[k].block !== 1
          ? "Bloquear gasta " + Math.round(ITEM_DEFS[k].block * 100) + "% do fôlego. "
          : "") +
        "Desgasta com o uso.";

  /* ---- botões de entrada ---- */
  setTimeout(forgeInit, 0);
}
