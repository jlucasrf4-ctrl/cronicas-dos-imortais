/* ==== Fase 4 — avisos: toast e ícones de combate (base/18, v4.7) ==== */
import { JANELAS, OPT, econ, dungeon } from "../core/state.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { GROUND_DEFS } from "../data/expedicao.ts";
import { TOAST_ICONS, HUD_ICONS, HUD_ICO_K } from "../data/icones.ts";
import { wpnKey, spearMode } from "../field/armas.ts";
import { icoTag, icoHas } from "./icones.ts";

/* ---------- toast ---------- */
export function mvToast(t: string) {
  let el = document.getElementById("mv-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "mv-toast";
    document.body.appendChild(el);
  }
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(JANELAS._toastT!);
  JANELAS._toastT = setTimeout(() => el.classList.remove("show"), 2600);
}

/* =====================================================================
   v4.7 — MENOS TEXTO NA TELA: avisos de combate viram ícones com efeito,
   faixas (banners) com subtítulos curtos em ícones, prompt "E" compacto,
   maestrias em pílulas e o texto de controles só nas primeiras partidas.
   Opções → "🔤 Avisos em texto" volta ao jeito antigo.
===================================================================== */
function emojiOfName(nm: string) {
  nm = String(nm)
    .replace(/\s*\[.*\]$/, "")
    .replace(/\s*×\d+$/, "")
    .trim();
  for (const k in ITEM_DEFS) if (ITEM_DEFS[k].name === nm) return ITEM_DEFS[k].emoji;
  for (const k in GROUND_DEFS) if (GROUND_DEFS[k].name === nm) return GROUND_DEFS[k].emoji;
  return null;
}
export function toastIcon(text: string) {
  const r = toastIconBase(text);
  /* v6.5 — ao pegar: só o ícone (sem "+1", que parecia "+10"); pedra rara mostra o ícone dela */
  if (r && typeof r.ic === "string") {
    const m = r.ic.match(/^\+\d*(.+)$/);
    if (m) r.ic = m[1];
  }
  return r;
}
function toastIconBase(text: string) {
  if (OPT.textos) return null;
  const s = String(text);
  for (const [re, ic, col] of TOAST_ICONS) if (re.test(s)) return { ic, col };
  const m = s.match(/^\+\s?(\d+)?\s?(.+)$/);
  if (m && !/^\d/.test(m[2] || "")) {
    const e = emojiOfName(m[2]);
    if (e) return { ic: "+" + (m[1] || "") + e };
  }
  return null;
}
/* v7.7 — o "[E] Pegar …" acima do herói (promptLabel) virou o painel de ações no canto (ui/acoes.ts) */
export function hintShowOnce() {
  const el = document.getElementById("dungeon-hint");
  if (!el) return;
  econ.hintRuns = (econ.hintRuns || 0) + 1;
  /* v7.7 — o texto de controles não abre mais sozinho (era muita informação): as dicas vêm uma por vez no
     quadradinho (ui/dicas.ts) e a lista inteira fica no ❔. No celular o texto já era escondido. */
  el.classList.remove("show");
}
export function iconInit() {
  const hud = document.getElementById("dungeon-hud"),
    ex = document.getElementById("dungeon-exit");
  if (hud && !document.getElementById("dungeon-help")) {
    const b = document.createElement("button");
    b.className = "btn";
    b.id = "dungeon-help";
    b.textContent = "❔";
    b.title = "Mostrar/esconder os controles";
    ex!.before(b);
    b.onclick = () => document.getElementById("dungeon-hint")!.classList.toggle("show");
  }
}
/* barra de botões da masmorra: ícone + tecla (o texto completo fica no "title") */
export function hudCompact() {
  // reescrita na v5.2
  if (OPT.textos) return;
  for (const id in HUD_ICONS) {
    const b = document.getElementById(id);
    if (!b) continue;
    const [ic, k0] = HUD_ICONS[id];
    const k = k0;
    let ik = HUD_ICO_K[id];
    if (id === "dungeon-weapon") ik = dungeon.weapon === "bow" ? "eq_arco" : wpnKey(dungeon.hero!) || "eq_espada";
    if (id === "dungeon-parry" && dungeon.weapon === "bow") ik = "btn_rolar";
    if (id === "dungeon-guard" && dungeon.weapon === "bow") ik = "btn_rolar";
    if (id === "dungeon-parry" && spearMode()) ik = "btn_arremessar";
    if (id === "dungeon-guard" && spearMode()) ik = "btn_esquiva";
    const pts = b.querySelector("#dh-pts"),
      sig = ik + "|" + k + "|" + (pts ? pts.textContent : "");
    if (b._sig2 === sig) continue;
    if (!b.title || !b._sig2) b.title = b.textContent.trim();
    b.innerHTML = icoTag(ik, ic, "hud") + (k ? "<kbd>" + k + "</kbd>" : "") + (pts ? pts.outerHTML : "");
    b._sig = b._sig2 = sig;
  }
  const hb = document.getElementById("dungeon-help");
  if (hb && !hb._ic && icoHas("btn_ajuda")) {
    hb._ic = 1;
    hb.innerHTML = icoTag("btn_ajuda", "❔", "hud");
  }
}
