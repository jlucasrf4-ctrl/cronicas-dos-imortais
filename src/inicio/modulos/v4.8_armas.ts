/* ==== Fase 4 — código de carga do antigo src/js/modulos/v4.8_armas.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarArmas() na ordem do antigo manifesto. */
import { dungeon } from "../../core/state.ts";
import { EQ_BASE, RECIPES_START } from "../../data/equipamento.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { armasKit, spearChargeRelease } from "../../field/armas.ts";

export function iniciarArmas() {
  /* =====================================================================
     v4.8 — NOVAS ARMAS: CLAVA, MACHADO e LANÇA
     · Clava: lenta e pesada; empurra longe e pode atordoar.
     · Machado: arco largo (pega vários) e pode abrir sangramento.
     · Lança: só estocadas (longo alcance, faixa estreita).
         Botão direito = ARREMESSA a lança (alcance bem menor que o arco).
         Ela fica no chão: é preciso passar por cima para pegar de volta.
         Espaço = ESQUIVA: um passo rápido; se um golpe chega nesse instante,
         você apara com a haste de madeira — sem dano, e você e o lobo são
         empurrados para trás.
  ===================================================================== */
  Object.assign(ITEM_DEFS, {
    eq_clava: {
      key: "eq_clava",
      name: "Clava de Madeira",
      emoji: "🏏",
      color: "#8a5a2b",
      slot: "maoD",
      dmg: 1,
      val: 8,
      w: 0.6,
      desc: "Lenta e pesada: empurra longe e pode atordoar.",
    },
    eq_machado: {
      key: "eq_machado",
      name: "Machado",
      emoji: "🪓",
      color: "#9aa3ae",
      slot: "maoD",
      dmg: 1,
      val: 22,
      w: 0.5,
      desc: "Golpe em arco largo: acerta vários e pode abrir sangramento.",
    },
    eq_lanca: {
      key: "eq_lanca",
      name: "Lança",
      emoji: "🔱",
      color: "#b8a070",
      slot: "maoD",
      dmg: 1,
      val: 18,
      w: 0.5,
      desc: "Estocadas retas, de longe. Botão direito: segure para mirar e solte para arremessar (alcance menor que o arco). No crítico ela pode cravar no bicho (60%) e faz sangrar; chegue perto e clique (ou E) para arrancar com dano extra. Espaço = EMPURRÃO com a haste, no tempo do golpe: perfeito derruba.",
    },
    // v8.1 (mantenedor, 2026-10-31): quebra pedra como o machado corta árvore; pedra e minério caem no chão
    eq_picareta: {
      key: "eq_picareta",
      name: "Picareta",
      emoji: "⛏️",
      color: "#9aa3ae",
      slot: "maoD",
      dmg: 1,
      val: 20,
      w: 0.5,
      desc: "Quebra pedra: botão direito na pedra, segure e solte no verde. A cada golpe pode cair pedra ou minério no chão.",
    },
  });
  ITEM_DEFS.eq_picareta.shape = ["####", ".#..", ".#..", ".#..", ".#..", ".#..", ".#.."].map((r) =>
    Array.from(r, (ch) => (ch === "#" ? 1 : 0)),
  );
  ITEM_DEFS.eq_clava.shape = [".##.", "####", "####", ".##.", ".##.", "..#.", "..#.", "..#.", "..#."].map((r) =>
    Array.from(r, (ch) => (ch === "#" ? 1 : 0)),
  );
  ITEM_DEFS.eq_machado.shape = ["###.", "####", "###.", ".#..", ".#..", ".#..", ".#..", ".#.."].map((r) =>
    Array.from(r, (ch) => (ch === "#" ? 1 : 0)),
  );
  ITEM_DEFS.eq_lanca.shape = [
    ".#.",
    "###",
    "###",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    ".#.",
    "###",
  ].map((r) => Array.from(r, (ch) => (ch === "#" ? 1 : 0)));
  Object.assign(EQ_BASE, {
    eq_clava: { dur: 90, mat: { galho: 4 }, kind: "madeira" },
    eq_machado: { dur: 120, mat: { ferro: 2, galho: 2 }, kind: "metal" },
    eq_lanca: { dur: 100, mat: { galho: 3, ferro: 1 }, kind: "metal" },
    eq_picareta: { dur: 120, mat: { ferro: 2, galho: 2 }, kind: "metal" },
  });
  for (const k of ["eq_machado", "eq_lanca", "eq_picareta"])
    ITEM_DEFS["projeto_" + k] = {
      key: "projeto_" + k,
      name: "Projeto: " + ITEM_DEFS[k].name,
      emoji: "📜",
      color: "#cbb58a",
      val: 15,
      w: 0.55,
      blueprint: k,
      shape: [
        [1, 1, 1],
        [1, 1, 1],
      ],
      desc: "Desenhos e medidas para forjar " + ITEM_DEFS[k].name + ".",
    };
  if (!RECIPES_START.includes("eq_clava")) RECIPES_START.push("eq_clava");

  /* ---- desenho da lança voando / no chão ---- */
  setTimeout(() => {
    try {
      armasKit();
    } catch (e) {}
  }, 50);

  /* ---- v5.4: arremesso da lança igual ao arco (segura para mirar, solta para arremessar), com alcance menor ---- */
  for (const _ev of ["mouseup", "pointerup"] as const)
    window.addEventListener(_ev, (e) => {
      if (e.button === 2) spearChargeRelease();
    });
  window.addEventListener("blur", () => {
    if (dungeon.spCh) dungeon.spCh = null;
  });
  setTimeout(function hookTb() {
    const b = document.getElementById("tb-parry");
    if (!b) {
      setTimeout(hookTb, 500);
      return;
    }
    for (const ev of ["pointerup", "pointercancel"]) b.addEventListener(ev, () => spearChargeRelease());
  }, 300);
}
