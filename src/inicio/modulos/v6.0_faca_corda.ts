/* ==== Fase 4 — código de carga do antigo src/js/modulos/v6.0_faca_corda.js ====
   O que o arquivo legado rodava ao carregar (ouvintes, timers, leituras do localStorage, laços que estendem as
   tabelas), na ordem original; src/main.ts chama iniciarFacaCorda() na ordem do antigo manifesto. */
import { dungeon, econ } from "../../core/state.ts";
import { PROFS, PROF_BY } from "../../data/atributos.ts";
import { ROPE } from "../../data/combate.ts";
import { SKILL_LABELS } from "../../data/herois.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { KG } from "../../data/sobrevivencia.ts";
import { finishStart, finishTarget, knifeStab, ropeThrow } from "../../field/faca_corda.ts";
import { CARP, CARP_RECIPES } from "../../forja/carpintaria.ts";
import { mkItem, placeIn } from "../../items/equipamento.ts";
import { ensureInv } from "../../items/inventario.ts";
import { GS_CODES } from "../../ui/gameshark.ts";

export function iniciarFacaCorda() {
  /* ==== v6.0 — 🔪 faca (estocada curta + finalizar), 🪢 corda (laçar + cabo de guerra), 😵 desmaio ==== */
  PROFS.push({
    id: "faca",
    n: "Faca",
    i: "🔪",
    g: "Armas",
    d: "Estocada da faca mais forte; finalizar é mais rápido e tem chance de render ainda mais.",
  });
  PROF_BY.faca = PROFS[PROFS.length - 1];
  SKILL_LABELS.faca = "Faca";
  ITEM_DEFS.corda = {
    key: "corda",
    name: "Corda",
    emoji: "🪢",
    color: "#b89a62",
    shape: [
      [1, 1],
      [1, 1],
    ],
    val: 6,
    w: 0,
    desc: "Laço de couro trançado. G (ou 🪢 no celular) arremessa: só prende bicho ferido (menos de 40% de vida), atordoado ou desmaiado. Preso, segure G para não deixar escapar e finalize com a faca (E).",
  };
  try {
    KG.corda = 0.4;
  } catch (_) {}
  /* ---- 🪢 laço ---- */
  /* teclado: X faca · G corda (segure para puxar) */
  window.addEventListener("keydown", (e) => {
    const d = dungeon;
    if (
      !d.active ||
      (e.target && ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA"))
    )
      return;
    if (e.code === "KeyX" && !e.repeat) knifeStab();
    else if (e.code === "KeyG") {
      if (!e.repeat) ropeThrow();
      d.ropeHold = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyG") dungeon.ropeHold = false;
  });
  /* celular: botões 🔪 e 🪢; E pisca quando dá para finalizar */
  setInterval(() => {
    try {
      const cl = document.getElementById("tb-cluster");
      if (!cl) return;
      const d = dungeon;
      if (!document.getElementById("tb-knife")) {
        const b = document.createElement("button");
        b.id = "tb-knife";
        b.className = "tb";
        b.innerHTML = "🔪<small>faca</small>";
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const m = finishTarget();
          if (m) finishStart(m);
          else knifeStab();
        });
        cl.appendChild(b);
      }
      if (!document.getElementById("tb-rope")) {
        const b = document.createElement("button");
        b.id = "tb-rope";
        b.className = "tb";
        b.innerHTML = "🪢<small>laço</small>";
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          ropeThrow();
          dungeon.ropeHold = true;
        });
        for (const ev of ["pointerup", "pointercancel", "pointerleave"])
          b.addEventListener(ev, () => {
            dungeon.ropeHold = false;
          });
        cl.appendChild(b);
      }
      const eb = document.getElementById("tb-e");
      if (eb && d.active) {
        const ft = !!finishTarget();
        if (ft) {
          eb.classList.add("hot", "fin");
        } else if (eb.classList.contains("fin")) eb.classList.remove("hot", "fin");
      }
    } catch (_) {}
  }, 400);
  CARP_RECIPES.push({
    id: "corda",
    n: "🪢 Corda trançada",
    tab: 0,
    pele: 1,
    d: "Trança uma pele em corda de laço (5 usos).",
    ok: () => true,
    done: () => {
      const it = mkItem("corda");
      it.uses = ROPE.uses;
      if (!(placeIn(econ.stash, it) || (CARP.h && placeIn(ensureInv(CARP.h), it))))
        return "Sem espaço no baú para a corda.";
      return "Corda pronta (no baú).";
    },
  });
  GS_CODES.CORDA = () => {
    let n = 0;
    for (let i = 0; i < 3; i++) {
      const it = mkItem("corda");
      it.uses = ROPE.uses;
      if (placeIn(econ.stash, it)) n++;
    }
    return "+" + n + " cordas no baú";
  };
}
