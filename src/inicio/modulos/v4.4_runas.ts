/* ==== Fase 4 — código de carga do antigo src/js/modulos/v4.4_runas.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarRunas() na ordem do antigo manifesto. */
import { ORE_TABLE } from "../../data/equipamento.ts";
import { GROUND_DEFS } from "../../data/expedicao.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { runeInit } from "../../runas/runas.ts";

export function iniciarRunas() {
  /* ---- itens: Folhama, Ametista e as runas capturadas ---- */
  Object.assign(ITEM_DEFS, {
    folhama: {
      key: "folhama",
      name: "Folha de Folhama",
      emoji: "🍃",
      color: "#5c8a45",
      val: 3,
      w: 0,
      desc: "Folha reguladora de runas. Duas camadas (aquecidas e esticadas) fazem a transferência de uma Runa Natural.",
    },
    ametista: {
      key: "ametista",
      name: "Ametista",
      emoji: "🟣",
      color: "#9b6bd6",
      val: 26,
      w: 0,
      desc: "Pedra semipreciosa — colorida, mas sem grande lapidação. Ótimo substrato para estabilizar runas.",
    },
  });
  Object.assign(ITEM_DEFS.runa_bruta, {
    name: "Ametista",
    emoji: "🟣",
    color: "#9b6bd6",
    val: 26,
    desc: ITEM_DEFS.ametista.desc,
  }); // saves antigos: a "Pedra Rúnica Bruta" vira Ametista (runa não é minério)
  Object.assign(ITEM_DEFS.quartzo, { desc: "Pedra semipreciosa clara. Bom substrato para estabilizar runas." });
  Object.assign(ITEM_DEFS.gema, {
    desc: "Pedra preciosa. O melhor substrato: a runa estabilizada nela dura muito tempo.",
  });
  Object.assign(ITEM_DEFS.prata, { desc: "Metal que conduz bem a energia das runas (substrato)." });
  Object.assign(ITEM_DEFS.ferro, {
    desc: "Base para forjar ferramentas e armas. Também serve de substrato para runas.",
  });
  for (const [k, art] of [
    ["folhama", ["##", "##"]],
    ["ametista", [".#.", "###", "#.#"]],
  ] as [string, string[]][])
    ITEM_DEFS[k].shape = art.map((r) => Array.from(r, (ch) => (ch === "#" ? 1 : 0)));
  ITEM_DEFS.runa_bruta.shape = ITEM_DEFS.ametista.shape!.map((r) => r.slice());
  ORE_TABLE.length = 0;
  ORE_TABLE.push(["gema", 0.012], ["ametista", 0.035], ["quartzo", 0.05], ["prata", 0.07], ["ferro", 0.18]);
  GROUND_DEFS.folhama = { name: "Folha de Folhama", emoji: "🍃", item: "folhama" };

  /* ---- inicialização: ligações de interface ---- */
  setTimeout(runeInit, 0);
}
