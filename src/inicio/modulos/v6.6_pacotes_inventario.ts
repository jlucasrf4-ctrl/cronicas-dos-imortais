/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.6_pacotes_inventario.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarPacotesInventario() na ordem do antigo manifesto. */
import { dungeon, world } from "../../core/state.ts";
import { PACK_KEYS, POP_K } from "../../data/campo.ts";
import { SPECIES } from "../../data/especies.ts";
import { ICO_DIAG } from "../../data/icones.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { KG } from "../../data/sobrevivencia.ts";
import { renderInv } from "../../field/chao.ts";
import { arrowsToBag, bundleReload, isArrowIt } from "../../items/aljava.ts";
import { INV, canPlace, ensureInv, stackTarget } from "../../items/inventario.ts";
import { popTrim } from "../../render/desempenho.ts";
import { gridCell, gridElOf, invHeroNow, itemAt } from "../../ui/inventario.ts";
import type { Item } from "../../core/tipos.ts";

export function iniciarPacotesInventario() {
  /* ---------- pacotes: cada casinha vazia do quadrado 3×3 aceita mais 1 unidade ---------- */
  for (const k of ["carne", "erva", "folhama"]) if (!PACK_KEYS.includes(k)) PACK_KEYS.push(k);
  ITEM_DEFS.erva.stack = 4;
  ITEM_DEFS.folhama.stack = 6;
  ITEM_DEFS.carne.stack = 3;
  /* ---------- Shift + arrastar = separa 1 unidade ---------- */
  window.addEventListener(
    "pointerdown",
    (e) => {
      try {
        if (!e.shiftKey || e.button !== 0 || INV.invDrag) return;
        const g = gridElOf(e.target as HTMLElement);
        const G = g && g._gr;
        if (!G || G.inv.ground) return;
        const [cx, cy] = gridCell(g, e),
          f = itemAt(G, cx, cy, false);
        if (!f || (f.it.n || 1) < 2 || isArrowIt(f.it)) return;
        const o = f.it;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!o._core) o._core = o.shape.map((r: number[]) => r.slice());
        o.n = (o.n || 1) - 1;
        const nu: Item = {
          uid: ++INV.invUid,
          def: o.def,
          x: o.x,
          y: o.y,
          shape: o._core.map((r: number[]) => r.slice()),
          tier: o.tier,
          n: 1,
          _core: o._core.map((r: number[]) => r.slice()),
          _pb: o._pb,
        };
        if (o.an) nu.an = o.an;
        G.inv.items.push(nu);
        INV.invDrag = {
          sx: e.clientX,
          sy: e.clientY,
          moved: false,
          it: nu,
          from: G,
          over: G,
          shape: nu.shape,
          ox: 0,
          oy: 0,
          gx: nu.x,
          gy: nu.y,
          split: o,
        };
        renderInv();
      } catch (err) {
        console.warn(err);
      }
    },
    true,
  );
  window.addEventListener(
    "pointerup",
    (e) => {
      try {
        const d = INV.invDrag;
        if (!d) return;
        /* separar: se não deu para soltar, volta para o pacote */
        if (d.split) {
          const to = d.over,
            ok =
              d.moved &&
              to &&
              !to.inv.ground &&
              (stackTarget(to.inv, d.it, d.gx, d.gy) || canPlace(to.inv, d.shape, d.gx, d.gy, d.it)) &&
              !(to.inv === d.from.inv && d.gx === d.split.x && d.gy === d.split.y);
          if (!ok) {
            e.stopImmediatePropagation();
            const i = d.from.inv.items.indexOf(d.it);
            if (i >= 0) d.from.inv.items.splice(i, 1);
            d.split.n = (d.split.n || 1) + 1;
            INV.invDrag = null;
            renderInv();
          }
          return;
        }
        /* feixe de flechas: aljava → mochila vira "Feixe de flechas" (não dá para atirar com ele) */
        const to = d.over;
        if (!d.moved || !to) return;
        if (isArrowIt(d.it) && !to.inv.qv && !to.inv.ground) {
          e.stopImmediatePropagation();
          arrowsToBag(d.it, d.from, to.inv, d.shape, d.gx, d.gy);
          INV.invDrag = null;
          renderInv();
          return;
        }
        if (d.it.def.key === "feixe_flechas" && to.inv.qv) {
          e.stopImmediatePropagation();
          bundleReload(d.it, d.from.inv);
          INV.invDrag = null;
          renderInv();
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    },
    true,
  );
  /* ---------- Ctrl + clique = manda para a outra mochila (antes era Shift) ---------- */
  window.addEventListener(
    "pointerdown",
    (e) => {
      try {
        if (!(e.ctrlKey || e.metaKey) || e.button !== 0 || INV.invDrag) return;
        const g = gridElOf(e.target as HTMLElement);
        const G = g && g._gr;
        if (!G) return;
        const [cx, cy] = gridCell(g, e),
          f = itemAt(G, cx, cy, false);
        if (!f) return;
        const it = f.it;
        if (isArrowIt(it)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const h = invHeroNow();
          if (h) arrowsToBag(it, G, ensureInv(h));
          renderInv();
          return;
        }
        if (it.def.key === "feixe_flechas") {
          e.preventDefault();
          e.stopImmediatePropagation();
          bundleReload(it, G.inv);
          renderInv();
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    },
    true,
  );
  /* ---------- flechas fora da aljava ---------- */
  ITEM_DEFS.feixe_flechas = {
    key: "feixe_flechas",
    name: "Feixe de flechas",
    emoji: "🏹",
    color: "#8a5a2b",
    val: 1,
    w: 0,
    shape: Array.from({ length: 9 }, () => [1, 1]),
    desc: "Flechas guardadas na mochila — não dá para atirar com elas. Arraste para a aljava (ou Ctrl+clique / clique → Recarregar) para usar.",
  };
  try {
    KG.feixe_flechas = 0.02;
  } catch (_) {}
  try {
    ICO_DIAG.feixe_flechas = ICO_DIAG.flecha_pacote;
  } catch (_) {}
  /* o 🔍 pendurado no item só aparece no tutorial; no jogo, clique no item → Analisar */
  /* ---------- menos bichos (desempenho) e retratos só perto do personagem ---------- */
  for (const k of ["rabbit", "deer", "wolf", "boar"])
    if (SPECIES[k] && !SPECIES[k]._capV66) {
      SPECIES[k].carryingCapacity = Math.max(6, Math.round(SPECIES[k].carryingCapacity * POP_K));
      SPECIES[k]._capV66 = 1;
    }
  setInterval(() => {
    try {
      if (!dungeon.active && world.animals && world.animals.length) popTrim();
    } catch (_) {}
  }, 5000);
}
