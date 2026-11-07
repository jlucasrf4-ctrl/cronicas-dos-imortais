/* ==== Fase 4 — código de carga do antigo src/js/modulos/v5.9.07_arte_nova.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarArteNova() na ordem do antigo manifesto. */
import { econ } from "../../core/state.ts";
import { GEMS, STONES } from "../../data/arte.ts";
import { CITIES } from "../../data/economia.ts";
import { COATS } from "../../data/genetica.ts";
import { Q_FRAME } from "../../data/icones.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { KG } from "../../data/sobrevivencia.ts";
import { allWeaponKeys, coatFix } from "../../econ/armaria.ts";
import { eqDurInit } from "../../items/durabilidade.ts";
import { mkItem, placeIn } from "../../items/equipamento.ts";
import { OPT_AN } from "../../ui/fichas_animais.ts";
import { GS_CODES } from "../../ui/gameshark.ts";

export function iniciarArteNova() {
  /* ==== v5.9.07 — arte nova: gemas com tipo/estágio/forma, materiais por estágio, carnes por animal,
     molduras em 5 estágios, fichas dos animais (retrato + variações) e botão "comprar todas as armas" ==== */
  /* pedras: cada pedra/minério tem um formato; minerando pedra às vezes sai uma Pedra Semipreciosa */
  ITEM_DEFS.pedra_rara = {
    key: "pedra_rara",
    name: "Pedra Semipreciosa",
    emoji: "🔶",
    color: "#b0703a",
    shape: [
      [1, 1],
      [1, 1],
    ],
    val: 9,
    w: 0,
    desc: "Achado raro ao quebrar pedra. Ourives de Pedra Branca e do Porto Sul pagam bem.",
  };
  try {
    KG.pedra_rara = 0.3;
  } catch (_) {}
  try {
    for (const c of CITIES) {
      if (c.id === "pedrabranca") c.pay.pedra_rara = 1.6;
      if (c.id === "porto") c.pay.pedra_rara = 1.4;
    }
  } catch (_) {}

  /* molduras: 5 estágios (Ruim · Comum · Boa · Excelente · Perfeito) — materiais A+ e SS também ganham moldura */
  Q_FRAME[0] = "frame_1";
  Q_FRAME[1] = "frame_2";
  Q_FRAME[2] = "frame_3";
  Q_FRAME[3] = "frame_4";
  Q_FRAME[4] = "frame_5";
  Q_FRAME[11] = "frame_3";
  Q_FRAME[12] = "frame_5";

  /* ==== animais: fichas com retrato e as variações (machos e fêmeas) ==== */
  if (COATS.boar && COATS.boar.v.length < 5)
    COATS.boar.v.push(
      ["Ruivo", "cerdas cor de ferrugem, comum nas matas quentes", 2],
      ["Cinzento", "cerdas grisalhas de javali velho", 1.5],
    );
  try {
    const v = localStorage.getItem("mv_antok");
    if (v === "0") OPT_AN.tok = false;
  } catch (_) {}

  /* ==== botão: comprar todas as armas (expedição) ==== */

  /* GameShark: códigos de teste novos */
  GS_CODES.ARMAS = () => {
    let n = 0;
    for (const k of allWeaponKeys()) {
      const it = mkItem(k);
      it.q = 1;
      eqDurInit(it);
      if (placeIn(econ.stash, it)) n++;
    }
    return "+" + n + " armas no baú";
  };
  GS_CODES.PEDRAS = () => {
    let n = 0;
    for (const k of Object.keys(STONES))
      for (let i = 0; i < 2; i++) {
        const it = mkItem("pedra_rara", i);
        it.st = k;
        it.pv = Math.floor(Math.random() * 997);
        if (placeIn(econ.stash, it)) n++;
      }
    return "+" + n + " pedras semipreciosas no baú";
  };
  GS_CODES.JOIAS = () => {
    let n = 0;
    for (const g of Object.keys(GEMS)) {
      const it = mkItem("gema", Math.floor(Math.random() * 3));
      it.gem = g;
      it.gv = Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * 997);
      it.stage = 1 + Math.floor(Math.random() * 5);
      if (placeIn(econ.stash, it)) n++;
    }
    return "+" + n + " gemas variadas no baú";
  };
  /* correção: a pelagem do tamanduá tinha o mesmo nome da função de pelagem dos bichos (todos nasciam iguais) */
  setTimeout(function _cf() {
    coatFix();
    setTimeout(_cf, 4000);
  }, 1500);
}
