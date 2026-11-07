/* ==== Fase 4 — código de carga do antigo src/js/modulos/v7.3b_galho_percepcao.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarGalhoPercepcao() na ordem do antigo manifesto. */
import { LONG_W, WPN_OF } from "../../data/combate.ts";
import { EQ_BASE } from "../../data/equipamento.ts";
import { WX } from "../../data/icones.ts";
import { ITEM_DEFS } from "../../data/itens.ts";

export function iniciarGalhoPercepcao() {
  /* ==== v7.3 — observar o galho (Percepção): Nv.1 "um galho" · Nv.2 "material essencial" · Nv.3 + faca = deduz a Lança de Madeira (talhada com 2 galhos) ==== */
  ITEM_DEFS.eq_lanca_madeira = {
    key: "eq_lanca_madeira",
    name: "Lança de Madeira",
    emoji: "🔱",
    color: "#a07a48",
    slot: "maoD",
    dmg: 0.72,
    val: 6,
    w: 0.35,
    shape: ITEM_DEFS.eq_lanca.shape!.map((r) => r.slice()),
    desc: "Um galho reto com a ponta afiada na faca. Estocadas de longe e dá para arremessar, mas quebra rápido.",
  };
  EQ_BASE.eq_lanca_madeira = { dur: 45, mat: { galho: 2 }, kind: "madeira" };
  WPN_OF.eq_lanca_madeira = "lanca";
  LONG_W.push("eq_lanca_madeira");
  WX.eq_lanca_madeira = ["wx_lanca", "wx_lanca"];
}
