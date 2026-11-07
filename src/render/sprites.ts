/* ==== Fase 4 — sprites do atlas (base/07) ==== */
import { world, econ, camera, TELAS, dungeon } from "../core/state.ts";
import { resCount, arrowCap, curHero, resSpend } from "../expedicao/preparo.ts";
import { RES, QUIVERS, RECIPES } from "../data/recursos.ts";
import { OPT_AN, anTokKey, anOnMap } from "../ui/fichas_animais.ts";
import { AN_ART, AN_ASP } from "../data/arte.ts";
import { icoImg } from "../ui/icones.ts";
import { d3Squashed, D3 } from "../field/projecao.ts";
import { pushEvent } from "../sim/eventos.ts";
import type { Receita, Repasse } from "../core/tipos.ts";

export function resTotal(k: string) {
  let n = 0;
  for (const h of world.heroes) n += resCount(h, k);
  return n;
}
export function refillQuiver() {
  const q = econ.quiver,
    cap = arrowCap(curHero()!),
    t = Math.min(cap - q.n, econ.arrowStock!);
  if (t > 0) {
    q.n += t;
    econ.arrowStock! -= t;
  }
}
export function chestRes() {
  document.getElementById("chest-res")!.innerHTML =
    Object.keys(RES)
      .map((k) => '<span class="chip">' + RES[k][0] + " " + RES[k][1] + " × " + resTotal(k) + "</span>")
      .join(" ") +
    '<span class="chip">🏹 Flechas × ' +
    (econ.quiver.n + econ.arrowStock!) +
    "</span>";
}

export function resTake(k: string, n: number) {
  for (const h of world.heroes) {
    const t = Math.min(resCount(h, k), n);
    if (t > 0) {
      resSpend(h, k, t);
      n -= t;
    }
  }
}

/* ======================= v3.4: FAUNA, RECURSOS E CRAFTING ======================= */
export const ATLAS = new Image();
export const SPR: Record<string, number[]> = {
  wolf: [0, 6],
  rabbit: [2, 6],
  deer: [4, 6],
  fox: [6, 8],
  duck: [8, 8],
  eagle: [10, 8],
}; // [linha do macho, nº de variações]
export function fitSz(sz: number) {
  return Math.max(sz * 1.3, 24 / camera.scale);
} // nunca menor que ~24px na tela
export function drawSprite(
  this: unknown,
  kind: string,
  sex: string,
  variant: number,
  x: number,
  y: number,
  size: number,
  alpha: number,
  rowOverride?: number | null,
  c?: CanvasRenderingContext2D,
): boolean {
  /* v5.9.07 */
  if (!OPT_AN.tok || !anOnMap(c) || !AN_ART[kind] || (kind === "eagle" && rowOverride === 10))
    return drawSpriteBase2.apply(this, arguments as Repasse);
  const key = anTokKey(kind, sex, variant),
    im = key && icoImg(key);
  if (!im) return drawSpriteBase2.apply(this, arguments as Repasse);
  const cc = c || TELAS.ctx,
    s = size * 0.98,
    asp = AN_ASP[AN_ART[kind]] || 0.85,
    rx = (s * asp) / 2 - 0.4,
    ry = s / 2 - 0.4;
  cc.save();
  cc.globalAlpha = alpha == null ? 1 : alpha;
  cc.imageSmoothingEnabled = true;
  cc.imageSmoothingQuality = "medium"; // v7.7: "high" aqui desfazia o "medium" que o mapa pede (renderFrame) e pesava
  cc.drawImage(im, x - s / 2, y - s / 2, s, s);
  cc.beginPath();
  cc.ellipse(x, y, rx, ry, 0, 0, 6.283);
  cc.lineWidth = Math.max(0.8, s * 0.075);
  cc.strokeStyle = sex === "F" ? "#d8b25a" : "#c9a24a";
  cc.stroke();
  cc.beginPath();
  cc.ellipse(x, y, rx + cc.lineWidth * 0.6, ry + cc.lineWidth * 0.6, 0, 0, 6.283);
  cc.lineWidth = Math.max(0.5, s * 0.03);
  cc.strokeStyle = "rgba(30,20,10,.85)";
  cc.stroke();
  cc.restore();
  return true;
}
// etapa de drawSprite: v5.8
function drawSpriteBase2(
  this: unknown,
  kind: string,
  sex: string,
  variant: number,
  x: number,
  y: number,
  size: number,
  alpha: number,
  rowOverride: number | null | undefined,
  c: CanvasRenderingContext2D,
): boolean {
  /* v5.8 */
  if (kind !== "boar") return drawSpriteBase.apply(this, arguments as Repasse);
  const im = icoImg("cr_javalino");
  if (!im) return false;
  c = c || TELAS.ctx;
  const r = size * 0.42,
    tint = ["#3a2616", "#1c1410", "#5a4632"][(variant | 0) % 3];
  c.save();
  c.globalAlpha = alpha == null ? 1 : alpha;
  c.beginPath();
  c.arc(x, y, r, 0, 6.283);
  c.fillStyle = tint;
  c.fill();
  c.clip();
  c.drawImage(im, x - r * 1.15, y - r * 1.1, r * 2.3, r * 2.3);
  c.restore();
  c.save();
  c.globalAlpha = alpha == null ? 1 : alpha;
  c.beginPath();
  c.arc(x, y, r, 0, 6.283);
  c.lineWidth = Math.max(1, size * 0.05);
  c.strokeStyle = "#2b1d10";
  c.stroke();
  c.restore();
  return true;
}
// etapa de drawSprite: original
function drawSpriteBase(
  kind: string,
  sex: string,
  variant: number,
  x: number,
  y: number,
  size: number,
  alpha: number,
  rowOverride: number | null | undefined,
  c: CanvasRenderingContext2D,
): boolean {
  if (!ATLAS.complete || !ATLAS.naturalWidth) return false;
  c = c || TELAS.ctx;
  {
    const m3 = d3Squashed(c);
    if (m3) {
      const k3 = dungeon.k * D3.BS;
      c.save();
      c.setTransform(
        k3,
        0,
        0,
        k3,
        m3.a * x + m3.c * y + m3.e - x * k3,
        m3.b * x + m3.d * y + m3.f - size * 0.38 * D3.BS * D3.s * D3.dpr - y * k3,
      );
      const r3 = drawSprite(kind, sex, variant, x, y, size, alpha, rowOverride, c);
      c.restore();
      return r3;
    }
  }
  const sp = SPR[kind],
    row = rowOverride != null ? rowOverride : sp[0] + (sex === "F" ? 1 : 0);
  const k = c === TELAS.ctx ? TELAS.canvasDpr * camera.scale : dungeon.k || 1;
  const s = Math.max(1, Math.round(size * k)) / k,
    dx = Math.round((x - s / 2) * k) / k,
    dy = Math.round((y - s / 2) * k) / k;
  c.save();
  c.globalAlpha = alpha == null ? 1 : alpha;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(ATLAS, (variant % sp[1]) * 64, row * 64, 64, 64, dx, dy, s, s);
  c.restore();
  return true;
}
export function huntLabel(k: string) {
  /* v5.9.11: pedra era "mineração"; v7.7: "pedras" (o verbo agora é quebrar: workVerb) */
  return huntLabelBase2(k);
}
// etapa de huntLabel: v5.8
function huntLabelBase2(k: string) {
  /* v5.8 */
  return k === "boar" ? "javalis" : huntLabelBase(k);
}
// etapa de huntLabel: original
function huntLabelBase(k: string) {
  return (
    (
      {
        rabbit: "coelhos",
        deer: "cervos",
        wolf: "lobos",
        fox: "raposas",
        duck: "patos",
        eagle: "águias",
        tree: "lenha e galhos",
        rock: "pedras",
        fish: "peixes",
        runa: "uma Runa Natural",
      } as Record<string, string>
    )[k] || k
  );
}
function canCraft(r: Receita) {
  if (econ.test) return 99;
  return Math.min(...Object.keys(r.mats).map((k) => Math.floor(resTotal(k) / r.mats[k])));
}
export function craft(r: Receita, times: number) {
  const n = Math.min(times, canCraft(r));
  if (n < 1) return 0;
  if (!econ.test) for (const k in r.mats) resTake(k, r.mats[k] * n);
  const made = n * r.qty,
    q = econ.quiver,
    room = Math.max(0, arrowCap(curHero()!) - q.n),
    toQ = Math.min(room, made);
  q.n += toQ;
  econ.arrowStock! += made - toQ;
  document.getElementById("craft-msg")!.textContent =
    made - toQ > 0 ? "Aljava cheia! " + (made - toQ) + " flecha(s) ficaram no inventário." : "";
  pushEvent("Fabricou " + made + " flecha(s). Aljava: " + q.n + "/" + QUIVERS[q.type] + ".");
  return made;
}
export function renderCraft() {
  const $ = (i: string) => document.getElementById(i);
  $("craft-res")!.innerHTML = Object.keys(RES)
    .filter((k) => k !== "wood")
    .map((k) => '<span class="chip">' + RES[k][0] + " " + RES[k][1] + " × " + resTotal(k) + "</span>")
    .join(" ");
  $("craft-list")!.innerHTML = RECIPES.map((r) => {
    const m = canCraft(r),
      ok = m >= 1;
    const mats = Object.keys(r.mats)
      .map(
        (k) =>
          '<span class="chip' +
          (!econ.test && resTotal(k) < r.mats[k] ? " bad" : "") +
          '">' +
          RES[k][0] +
          " " +
          r.mats[k] +
          " " +
          RES[k][1] +
          " (tem " +
          resTotal(k) +
          ")</span>",
      )
      .join(" ");
    return (
      '<div class="rcp ' +
      (ok ? "ok" : "no") +
      '"><span style="font-size:1.4rem">' +
      r.icon +
      "</span><div style='flex:1'><b>" +
      r.name +
      "</b> → " +
      r.qty +
      " Flecha<br>" +
      mats +
      "</div>" +
      (ok
        ? '<button class="btn" data-craft="' +
          r.id +
          '" data-n="1">Fabricar</button><button class="btn" data-craft="' +
          r.id +
          '" data-n="' +
          m +
          '">Máx (' +
          m +
          ")</button>"
        : "<span style='font-size:.75rem'>materiais insuficientes</span>") +
      "</div>"
    );
  }).join("");
  const q = econ.quiver;
  $("craft-quiver")!.textContent =
    "Aljava " +
    q.type +
    ": 🏹 " +
    q.n +
    "/" +
    QUIVERS[q.type] +
    (econ.arrowStock ? " · reserva no inventário: " + econ.arrowStock : "");
}
