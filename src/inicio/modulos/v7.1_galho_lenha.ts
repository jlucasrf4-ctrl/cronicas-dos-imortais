/* ==== Fase 4 — código de carga do antigo src/js/modulos/v7.1_galho_lenha.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarGalhoLenha() na ordem do antigo manifesto. */
import { RECIPES, RES, RES_KEY } from "../../data/recursos.ts";

export function iniciarGalhoLenha() {
  /* ==== v7.1 — Galho x Lenha: galho é o material (mochila) de tudo que se fabrica; lenha é o estoque do acampamento (fogo, cozinhar, carpintaria) ==== */
  {
    const ord = {
      galho: ["🪵", "Galho"],
      stone: RES.stone,
      feather: RES.feather,
      eagle: RES.eagle,
      wood: ["🔥", "Lenha"],
    };
    for (const k of Object.keys(RES)) delete RES[k];
    Object.assign(RES, ord);
  }
  RES_KEY.galho = "galho";
  for (const r of RECIPES)
    if (r.mats.wood) {
      r.mats = Object.assign({ galho: r.mats.wood }, r.mats);
      delete r.mats.wood;
    }
}
