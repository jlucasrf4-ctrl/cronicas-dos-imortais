/* ==== Fase 4 — fichas dos animais com retrato e variações (v5.9.07) ==== */
import { AN_ART, AN_TOK, AN_INFO } from "../data/arte.ts";
import { COATS } from "../data/genetica.ts";
import { esc } from "../core/util.ts";
import { TELAS, dungeon } from "../core/state.ts";

export function anTokKey(sp: string, sex: string, coat: number) {
  const a = AN_ART[sp];
  if (!a) return null;
  const C = COATS[sp] || COATS.wolf,
    n = C ? C.v.length : 6,
    ci = (((coat | 0) % n) + n) % n;
  let i = ci + 1;
  if (AN_TOK[sp]) i = AN_TOK[sp][ci % AN_TOK[sp].length][sex === "F" ? 1 : 0];
  return "an_" + a + "_" + (sex === "F" ? "f" : "m") + "_" + i;
}
export const OPT_AN = { tok: true };
export function anCard(sp: string, sex: string, coat: number) {
  const I = AN_INFO[sp],
    C = COATS[sp] || { label: "Coelho Demoníaco", v: [] },
    a = AN_ART[sp];
  let m = document.getElementById("an-card");
  if (!m) {
    m = document.createElement("div");
    m.id = "an-card";
    m.className = "v3-modal";
    document.body.appendChild(m);
    m.addEventListener("click", (e) => {
      if (e.target === m || (e.target as HTMLElement).closest("[data-anx]")) m!.classList.remove("open");
    });
  }
  const lab = sp === "demon" ? "Coelho Demoníaco" : C.label,
    n = C.v.length || 6,
    cur = coat == null ? -1 : (((coat | 0) % n) + n) % n;
  const tok = (s: string) => {
    let h = "";
    for (let i = 0; i < n; i++) {
      const k = sp === "demon" ? "an_demonio_" + s + "_" + (i + 1) : anTokKey(sp, s === "f" ? "F" : "M", i),
        nm = C.v[i] ? C.v[i][0] : "";
      h +=
        "<div class='anc-t" +
        (i === cur && (sex === "F") === (s === "f") ? " on" : "") +
        "' title='" +
        esc(nm) +
        "'><i class='ic ico-" +
        k +
        "'></i><small>" +
        esc(nm) +
        "</small></div>";
    }
    return h;
  };
  m.innerHTML =
    "<div class='v3-card anc'><div class='anc-top'><i class='ic anc-por ico-por_" +
    a +
    "'></i><div class='anc-txt'><div class='anc-h'><b>" +
    esc(lab) +
    "</b><span>♂♀</span><button class='btn' data-anx='1'>✕</button></div><p>" +
    I.d +
    "</p>" +
    "<div class='anc-f'><span>🌲 <b>Habitat</b> " +
    I.hab +
    "</span><span>🥩 <b>Dieta</b> " +
    I.diet +
    "</span><span>🐾 <b>Comportamento</b> " +
    I.beh +
    "</span><span>📏 <b>Altura</b> " +
    I.alt +
    " · <b>Comprimento</b> " +
    I.comp +
    "</span></div></div></div>" +
    "<div class='anc-sec'>VARIAÇÕES</div><div class='anc-row'><span class='anc-sx'>♂<small>Macho</small></span>" +
    tok("m") +
    "</div><div class='anc-row'><span class='anc-sx'>♀<small>Fêmea</small></span>" +
    tok("f") +
    "</div>" +
    "<label class='anc-opt'><input type='checkbox' id='anc-tok'" +
    (OPT_AN.tok ? " checked" : "") +
    "> Mostrar os animais no mapa com os retratos pintados</label></div>";
  (m.querySelector("#anc-tok") as HTMLElement).onchange = (e) => {
    OPT_AN.tok = (e.target as HTMLInputElement).checked;
    try {
      localStorage.setItem("mv_antok", OPT_AN.tok ? "1" : "0");
    } catch (_) {}
  };
  m.classList.add("open");
}

export function anOnMap(c: CanvasRenderingContext2D | null | undefined) {
  return (
    (!c || (typeof TELAS.ctx !== "undefined" && c === TELAS.ctx)) && !(typeof dungeon !== "undefined" && dungeon.active)
  );
}
