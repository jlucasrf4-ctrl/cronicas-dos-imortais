/* ==== Fase 4 — botões de toque reposicionáveis (v5.9.09) ==== */
import { mvToast } from "./avisos.ts";
import { dungeon } from "../core/state.ts";

/* ==== v5.9.09 — botões de toque reposicionáveis: ✥ ajustar → arrasta cada botão, muda o tamanho, 🔒 trava.
   Layout salvo no aparelho, separado para celular deitado e em pé. ==== */
/** O arranjo dos botões de toque guardado no localStorage: por orientação (L deitado, P em pé), a posição e a escala de cada botão. */
type LayoutToque = Record<string, Record<string, { x: number; y: number; s?: number }>>;
interface EstadoTBL {
  edit: boolean;
  sel: string | null; // id do botão selecionado na edição
  key: string;
  data: LayoutToque | null;
  drag: { b: HTMLElement; id: number; ox: number; oy: number } | null;
  // acrescentados depois
  wasModal?: boolean | number;
}
export const TBL: EstadoTBL = { edit: false, sel: null, key: "mv_tblayout_v1", data: null, drag: null };
export function tblLoad() {
  if (TBL.data) return TBL.data;
  try {
    TBL.data = JSON.parse(localStorage.getItem(TBL.key) || "{}") || {};
  } catch (_) {
    TBL.data = {};
  }
  if (!TBL.data!.L) TBL.data!.L = {};
  if (!TBL.data!.P) TBL.data!.P = {};
  return TBL.data;
}
function tblSave() {
  try {
    localStorage.setItem(TBL.key, JSON.stringify(TBL.data));
  } catch (_) {}
}
function tblOri() {
  return innerWidth >= innerHeight ? "L" : "P";
}
export function tblRoot() {
  return document.getElementById("touch-ui");
}
function tblBtns() {
  const r = tblRoot();
  return r ? [...r.querySelectorAll<HTMLElement>(".tb")].filter((b) => b.id && b.id !== "tb-layout") : [];
}
function tblBase(b: HTMLElement) {
  if (!b.dataset.bw) {
    const cs = getComputedStyle(b);
    b.dataset.bw = String(parseFloat(cs.width) || 54);
    b.dataset.bh = String(parseFloat(cs.height) || 54);
    b.dataset.bf = String(parseFloat(cs.fontSize) || 20);
  }
  return { w: +b.dataset.bw, h: +b.dataset.bh!, f: +b.dataset.bf! };
}
function tblFree(b: HTMLElement) {
  const r = tblRoot();
  if (!r || b.classList.contains("tb-free")) return;
  tblBase(b);
  b._home = { p: b.parentNode!, n: b.nextSibling };
  r.appendChild(b);
  b.classList.add("tb-free");
}
function tblPlace(b: HTMLElement, p: { s?: number; x: number; y: number }) {
  const r = tblRoot();
  if (!r || !p) return;
  tblFree(b);
  const B = tblBase(b),
    s = p.s || 1,
    w = B.w * s,
    h = B.h * s;
  b.style.width = w + "px";
  b.style.height = h + "px";
  b.style.fontSize = B.f * s + "px";
  b.style.left = "calc(" + p.x + "% - " + w / 2 + "px)";
  b.style.top = "calc(" + p.y + "% - " + h / 2 + "px)";
  b.style.right = "auto";
  b.style.bottom = "auto";
}
function tblHome(b: HTMLElement) {
  if (!b.classList.contains("tb-free")) return;
  const H = b._home;
  b.classList.remove("tb-free");
  for (const k of ["width", "height", "fontSize", "left", "top", "right", "bottom"] as const) b.style[k] = "";
  if (H && H.p) {
    try {
      H.p.insertBefore(b, H.n && H.n.parentNode === H.p ? H.n : null);
    } catch (_) {
      H.p.appendChild(b);
    }
  }
}
export function tblApply() {
  const L = tblLoad()![tblOri()];
  for (const b of tblBtns()) {
    const p = L[b.id];
    if (p) tblPlace(b, p);
    else tblHome(b);
  }
}
function tblCenter(b: HTMLElement) {
  const r = tblRoot()!.getBoundingClientRect(),
    q = b.getBoundingClientRect();
  return { x: ((q.left + q.width / 2 - r.left) / r.width) * 100, y: ((q.top + q.height / 2 - r.top) / r.height) * 100 };
}
function tblBar() {
  let bar = document.getElementById("tbl-bar");
  const r = tblRoot();
  if (!r) return null;
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "tbl-bar";
    r.appendChild(bar);
    bar.innerHTML =
      "<b>✥ Ajustar botões</b><span id='tbl-tip'>Arraste os botões para onde quiser</span><div class='tbl-row'><button data-tl='m'>− menor</button><button data-tl='p'>+ maior</button><button data-tl='r'>↺ padrão</button><button data-tl='k' class='pri'>🔒 travar</button></div>";
    bar.addEventListener("pointerdown", (e) => e.stopPropagation());
    bar.addEventListener("click", (e) => {
      const t = (e.target as HTMLElement).closest("[data-tl]") as HTMLElement;
      if (!t) return;
      e.stopPropagation();
      tblCmd(t.dataset.tl!);
    });
  }
  return bar;
}
export function tblTip() {
  const t = document.getElementById("tbl-tip");
  if (!t) return;
  const b = TBL.sel && document.getElementById(TBL.sel),
    p = b && tblLoad()![tblOri()][TBL.sel!];
  t.textContent = b
    ? "Selecionado: " +
      (b.title || b.textContent || b.id).trim().slice(0, 18) +
      " · tamanho " +
      Math.round(((p && p.s) || 1) * 100) +
      "%"
    : "Arraste os botões para onde quiser (" + (tblOri() === "L" ? "celular deitado" : "celular em pé") + ")";
}
function tblCmd(c: string) {
  const L = tblLoad()![tblOri()];
  if (c === "k") {
    tblEdit(false);
    return;
  }
  if (c === "r") {
    if (TBL.sel && L[TBL.sel]) {
      delete L[TBL.sel];
    } else {
      tblLoad()![tblOri()] = {};
    }
    TBL.sel = null;
    tblSave();
    tblApply();
    tblMark();
    tblTip();
    return;
  }
  if (c === "m" || c === "p") {
    const b = TBL.sel && document.getElementById(TBL.sel);
    if (!b) {
      mvToast("Toque num botão primeiro");
      return;
    }
    const p = L[b.id] || (L[b.id] = tblCenter(b));
    p.s = Math.max(0.6, Math.min(1.8, Math.round(((p.s || 1) + (c === "p" ? 0.1 : -0.1)) * 10) / 10));
    tblPlace(b, p);
    tblSave();
    tblTip();
  }
}
function tblMark() {
  for (const b of tblBtns()) b.classList.toggle("tb-sel", TBL.edit && b.id === TBL.sel);
}
export function tblEdit(on: boolean) {
  const r = tblRoot();
  if (!r) return;
  TBL.edit = on;
  r.classList.toggle("tb-editing", on);
  const bar = tblBar();
  if (bar) bar.style.display = on ? "" : "none";
  if (typeof dungeon !== "undefined") {
    if (on) {
      TBL.wasModal = dungeon.modalOpen;
      dungeon.modalOpen = true;
      dungeon.joy = null;
      dungeon.guard = false;
      dungeon.charging = false;
    } else dungeon.modalOpen = !!TBL.wasModal;
  }
  if (!on) TBL.sel = null;
  tblMark();
  tblTip();
  if (!on) mvToast("🔒 Botões travados");
}
/* arrastar: captura antes dos botões, para não atacar/defender enquanto edita */
function tblBind() {
  const r = tblRoot();
  if (!r || r._tbl) return;
  r._tbl = 1;
  r.addEventListener(
    "pointerdown",
    (e) => {
      if (!TBL.edit) return;
      const b = (e.target as HTMLElement).closest<HTMLElement>(".tb");
      if (!b || b.id === "tb-layout" || (e.target as HTMLElement).closest("#tbl-bar")) return;
      e.preventDefault();
      e.stopPropagation();
      const c = tblCenter(b),
        rr = r.getBoundingClientRect();
      TBL.sel = b.id;
      TBL.drag = {
        b,
        id: e.pointerId,
        ox: e.clientX - (rr.left + (c.x / 100) * rr.width),
        oy: e.clientY - (rr.top + (c.y / 100) * rr.height),
      };
      try {
        b.setPointerCapture(e.pointerId);
      } catch (_) {}
      tblMark();
      tblTip();
    },
    true,
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      const D = TBL.drag;
      if (!TBL.edit || !D || D.id !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const rr = r.getBoundingClientRect(),
        L = tblLoad()![tblOri()],
        old = L[D.b.id] || {};
      const x = Math.max(3, Math.min(97, ((e.clientX - D.ox - rr.left) / rr.width) * 100)),
        y = Math.max(4, Math.min(96, ((e.clientY - D.oy - rr.top) / rr.height) * 100));
      L[D.b.id] = { x, y, s: old.s || 1 };
      tblPlace(D.b, L[D.b.id]);
    },
    true,
  );
  const up = (e: PointerEvent) => {
    if (!TBL.drag || TBL.drag.id !== e.pointerId) return;
    e.stopPropagation();
    TBL.drag = null;
    tblSave();
  };
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
  for (const ev of ["click", "pointerup", "touchstart", "touchend"])
    r.addEventListener(
      ev,
      (e) => {
        if (
          TBL.edit &&
          (e.target as HTMLElement).closest(".tb") &&
          !(e.target as HTMLElement).closest("#tbl-bar") &&
          (e.target as HTMLElement).closest(".tb")!.id !== "tb-layout"
        ) {
          e.stopPropagation();
          if (ev !== "touchstart") e.preventDefault();
        }
      },
      true,
    );
}
export function tblInit() {
  const r = tblRoot();
  if (!r) return;
  tblBind();
  const top = document.getElementById("tb-top");
  if (top && !document.getElementById("tb-layout")) {
    const b = document.createElement("button");
    b.id = "tb-layout";
    b.className = "tb sm";
    b.title = "Ajustar a posição dos botões";
    b.textContent = "✥";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      tblEdit(!TBL.edit);
    });
    top.appendChild(b);
  }
  if (!TBL.edit) tblApply();
}
// v7.7: tierTint (o fundo da peça tingido pela qualidade) saiu com a grade A2 (fundo uniforme; field/chao.ts)
