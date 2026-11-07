/* ==== Fase 4 — código de carga do antigo src/js/modulos/v7.5_ilhas_vila_musgo.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarIlhasVilaMusgo() na ordem do antigo manifesto. */
import { camera, dungeon, world } from "../../core/state.ts";
import { DANO } from "../../data/combate.ts";
import { CITIES } from "../../data/economia.ts";
import { EQ_BASE } from "../../data/equipamento.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { ARQ, MUSGO } from "../../data/mapa.ts";
import { mapTip } from "../../intro/cena.ts";
import { mapOverview } from "../../map/camera.ts";
import { MAPCTL, mapHero, mapW } from "../../map/controle.ts";
import { boteViagem, docaCaca, heroNaVila, heroPerto } from "../../map/vila_musgo.ts";
import { vilaEntrar } from "../../map/vila_cena.ts";
import { anyGameModal } from "../../ui/titulo.ts";

export function iniciarIlhasVilaMusgo() {
  /* ==== v7.5 — Ilhas Golden Fish · Vila Musgo (cidade clicável com empório: compra e venda) · bote entre a vila e a área de caça · Calça de Pele ==== */
  CITIES.push({
    id: "musgo",
    name: "Vila Musgo",
    region: ARQ.nome,
    pop: 420,
    level: 1,
    x: 110,
    y: 600,
    res: "Peixe, corda, ervas",
    desc: "Vilarejo de pescadores nas Ilhas Golden Fish. Tem um empório pequeno e um bote que cruza o canal até a área de caça.",
    pay: { pele: 1.2, carne: 1.15, pena: 1.3, peixe: 1.2 },
  });
  /* ---------- Calça de Pele (antes: linho de folhama) ---------- */
  Object.assign(ITEM_DEFS.eq_calca, {
    name: "Calça de Pele",
    desc: "Costurada com pele de bicho (lobo, cervo…). Protege as pernas e esquenta um pouco.",
  });
  EQ_BASE.eq_calca.mat = { pele: 2 };
  DANO.ARMADURAS.eq_calca = { m: "couro", k: 0.8 };
  /* ---------- empório da vila ---------- */
  /* chegou: entra na vila (v8.0: a vila andável, map/vila_cena.ts; antes abria o empório); na doca oferece o bote */
  setInterval(() => {
    try {
      if (dungeon.active) return;
      for (const h of world.heroes) {
        if (h._toMusgo && heroNaVila() === h) {
          h._toMusgo = false;
          h.walkTo = null;
          h.state = "field";
          mapTip("🏘 Chegou à Vila Musgo");
          vilaEntrar(h);
        }
        const D = docaCaca();
        if (h._toDoca && D && Math.hypot(h.x - D.x, h.y - D.y) < MUSGO.docaRaio) {
          h._toDoca = false;
          boteViagem(h, "vila");
        }
      }
    } catch (_) {}
  }, 400);
  document.addEventListener(
    "pointerup",
    (e) => {
      try {
        const vp = document.getElementById("viewport");
        if (!vp || !vp.contains(e.target as Node) || dungeon.active || anyGameModal() || mapOverview()) return;
        const w = mapW(e),
          D = docaCaca();
        if (!D || Math.hypot(D.x - w.x, D.y - w.y) >= Math.max(12, 18 / camera.scale)) return;
        if (MUSGO._pd && Math.hypot(e.clientX - MUSGO._pd.x, e.clientY - MUSGO._pd.y) > 6) return;
        const h = heroPerto(D, MUSGO.docaRaio) || mapHero();
        if (!h) return;
        MAPCTL.clickT = performance.now();
        if (Math.hypot(h.x - D.x, h.y - D.y) < MUSGO.docaRaio) boteViagem(h, "vila");
        else {
          h.walkTo = { x: D.x, y: D.y };
          h._toDoca = true;
          h.task = null;
          h.state = "walking";
          MAPCTL.sel = h.id;
          mapTip("🚶 Indo até o bote ⛵");
        }
      } catch (err) {
        console.warn(err);
      }
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      MUSGO._pd = { x: e.clientX, y: e.clientY };
    },
    true,
  );
}
