/* ==== Fase 4 — ofícios da forja: cutelaria, costura e anéis da cota (v5.9.01) ==== */
import { PATTERNS } from "../data/sobrevivencia.ts";
import { EQ_BASE } from "../data/equipamento.ts";
import { FG, mgFx, mgUi, mgEnd, heatCol } from "./forja.ts";
import type { MinijogoForja } from "./forja.ts";
import { sfx } from "../field/chao.ts";
import { angDiff } from "../core/util.ts";

/* ---------- FORJA: cutelaria + costura (couro/tecido) e anéis da cota de malha ---------- */
export function cutPath(key: string) {
  const P = PATTERNS[key] || PATTERNS.eq_armadura,
    out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i],
      b = P[i + 1],
      n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.008));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push(P[P.length - 1].slice());
  return out;
}
export function fgCraft(key: string) {
  const R = EQ_BASE[key];
  return !R ? "metal" : R.kind === "couro" ? "couro" : key === "eq_cota" ? "malha" : R.kind;
}
export function sewInit(g: MinijogoForja) {
  g.ph = "sew";
  g.sew = { r: 34, t: 0, dur: 1.05, flash: 0 };
}
function fgArea(L: number, H: number) {
  return { x: L * 0.14, y: H * 0.07, w: L * 0.72, h: H * 0.82 };
}
function fgCanvasPt(e: PointerEvent) {
  const cv = document.getElementById("fg-cv")!,
    r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, L: r.width, H: r.width * 0.62 };
}
function cutMove(e: PointerEvent, start: boolean) {
  const g = FG.mg;
  if (!g || g.ph !== "cut") return;
  const p = fgCanvasPt(e),
    A = fgArea(p.L, p.H),
    P = g.cut!,
    pt = (q: number[]) => [A.x + q[0] * A.w, A.y + q[1] * A.h];
  const cur = pt(P[g.cutI!]);
  if (start && Math.hypot(p.x - cur[0], p.y - cur[1]) > p.L * 0.07) {
    mgFx("Comece no ponto ●", "#ffd24a");
    FG.cutting = false;
    return;
  }
  let bj = -1,
    bd = 1e9;
  for (let j = g.cutI!; j < Math.min(P.length, g.cutI! + 14); j++) {
    const q = pt(P[j]),
      dd = Math.hypot(p.x - q[0], p.y - q[1]);
    if (dd < bd) {
      bd = dd;
      bj = j;
    }
  }
  const tol = p.L * (0.075 + 0.004 * (g.plv || 0));
  g.knife = { x: p.x, y: p.y, off: bd > tol };
  if (bd > tol) {
    const now = performance.now();
    if (!g._slip || now - g._slip > 350) {
      g._slip = now;
      g.cutErr! += 0.06 * 4;
      g.cutN! += 4;
      mgFx("Saiu do risco!", "#ff8a6a");
    }
    return;
  }
  if (bj > g.cutI!) {
    g.cutErr! += (bd / p.L) * (bj - g.cutI!);
    g.cutN! += bj - g.cutI!;
    g.cutI = bj;
    if (Math.random() < 0.3) sfx("hitlite");
  }
  if (g.cutI! >= P.length - 2) cutDone();
}
export function cutDone() {
  const g = FG.mg!,
    avg = g.cutErr! / Math.max(1, g.cutN!),
    s = Math.max(0.05, Math.min(1, 1.15 - avg / (0.045 + 0.003 * (g.plv || 0))));
  FG.cutting = false;
  g.knife = null;
  g.hits.push(s, s);
  mgFx(
    s >= 0.85 ? "Corte PERFEITO" : s >= 0.6 ? "Corte bom" : s >= 0.35 ? "Corte torto" : "Corte ruim",
    s >= 0.6 ? "#ffd24a" : "#ff8a6a",
  );
  sfx(s >= 0.85 ? "perfect" : "ping");
  g.cutScore = s;
  sewInit(g!);
  mgUi();
}
export function sewHit() {
  const g = FG.mg;
  if (!g || g.ph !== "sew") return;
  const k = g.sew!,
    off = Math.abs(k.r - 9);
  const kk = 1 + 0.06 * (g.plv || 0),
    s = off < 3.5 * kk ? 1 : off < 7 * kk ? 0.75 : off < 12 * kk ? 0.45 : 0.08;
  sewStitch(s);
}
export function sewStitch(s: number) {
  const g = FG.mg!;
  g.hits.push(s);
  mgFx(
    s >= 1 ? "PONTO PERFEITO" : s >= 0.75 ? "Bom ponto" : s >= 0.45 ? "Ok" : "Ponto torto",
    s >= 0.75 ? "#ffd24a" : s >= 0.45 ? "#fff2cf" : "#ff8a6a",
  );
  sfx(s >= 0.75 ? "hit" : "hitlite");
  const done = g.hits.length - (g.cutScore != null ? 2 : 0);
  g.sew = { r: 34, t: 0, dur: Math.max(0.55, 1.05 - done * 0.07), flash: 0.25 };
  if (done >= g.n) mgEnd();
  else mgUi();
}
export function ringHit() {
  const g = FG.mg;
  if (!g || g.ph !== "rings") return;
  const a = Math.atan2(Math.sin(g.ring!.a), Math.cos(g.ring!.a)),
    off = angDiff(a, -Math.PI / 2);
  const kk = 1 + 0.05 * (g.plv || 0);
  let s = off < 0.18 * kk ? 1 : off < 0.4 * kk ? 0.75 : off < 0.7 * kk ? 0.45 : 0.05;
  if (g.T < 0.45) {
    s *= 0.25;
    g.cold++;
    mgFx("Arame FRIO! o anel trincou", "#9fd3ff");
  } else
    mgFx(
      s >= 1 ? "Anel PERFEITO" : s >= 0.75 ? "Bom" : s >= 0.45 ? "Ok" : "Anel torto",
      s >= 0.75 ? "#ffd24a" : s >= 0.45 ? "#fff2cf" : "#ff8a6a",
    );
  g.hits.push(s);
  g.T = Math.max(0, g.T - 0.09);
  g.ring!.a = Math.random() * 6.283;
  g.ring!.spd *= 1.08;
  g.ring!.flash = 0.2;
  sfx(s >= 0.75 ? "hit" : "hitlite");
  if (g.hits.length >= g.n) {
    if (g.mode === "make") {
      g.ph = "quench";
      g.quench = null;
    } else mgEnd();
  }
  mgUi();
}
export function ringsDraw(_t: number) {
  const g = FG.mg!,
    cv = document.getElementById("fg-cv") as HTMLCanvasElement,
    dpr = Math.min(2, devicePixelRatio || 1),
    L = cv.width / dpr,
    H = cv.height / dpr,
    c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = L * 0.44,
    cy = H * 0.3,
    R = Math.min(L, H) * 0.12,
    col = heatCol(g.T),
    gap = 0.75;
  if (g.ph === "rings") {
    c.fillStyle = "rgba(20,12,6,.55)";
    c.beginPath();
    c.arc(cx, cy, R + 16, 0, 6.283);
    c.fill();
    c.save();
    c.shadowColor = col;
    c.shadowBlur = 12 * g.T;
    c.strokeStyle = col;
    c.lineWidth = 6;
    c.lineCap = "round";
    c.beginPath();
    c.arc(cx, cy, R, g.ring!.a + gap / 2, g.ring!.a + 6.283 - gap / 2);
    c.stroke();
    c.restore();
    c.fillStyle = "#ffd24a";
    c.beginPath();
    c.moveTo(cx, cy - R - 6);
    c.lineTo(cx - 7, cy - R - 17);
    c.lineTo(cx + 7, cy - R - 17);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,210,74,.35)";
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, R, -Math.PI / 2 - 0.18, -Math.PI / 2 + 0.18);
    c.stroke();
    if (g.ring!.flash! > 0) {
      c.strokeStyle = "rgba(255,255,255," + g.ring!.flash! * 4 + ")";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(cx, cy, R + 8, 0, 6.283);
      c.stroke();
    }
  }
  for (let i = 0; i < g.n; i++) {
    const x = 18 + i * 15,
      y = H - 14,
      s = g.hits[i];
    c.strokeStyle = s == null ? "rgba(255,255,255,.2)" : s >= 0.75 ? "#ffd24a" : s >= 0.45 ? "#c9ccd2" : "#ff6a4a";
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(x, y, 7, 0, 6.283);
    c.stroke();
  }
}
export function leatherDraw(t: number) {
  const g = FG.mg!,
    cv = document.getElementById("fg-cv") as HTMLCanvasElement,
    L = Math.round(cv.getBoundingClientRect().width) || 360,
    H = Math.round(L * 0.62),
    dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(L * dpr)) {
    cv.width = Math.round(L * dpr);
    cv.height = Math.round(H * dpr);
  }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // bancada de madeira
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#6a4526");
  bg.addColorStop(1, "#4e3119");
  c.fillStyle = bg;
  c.fillRect(0, 0, L, H);
  c.strokeStyle = "rgba(30,16,6,.25)";
  c.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    const y = (H * (i + 0.5)) / 9;
    c.moveTo(0, y);
    c.bezierCurveTo(L * 0.3, y + 4, L * 0.6, y - 4, L, y + 2);
    c.stroke();
  }
  const A = fgArea(L, H),
    linho = g.key === "eq_calca",
    pt = (q: number[]) => [A.x + q[0] * A.w, A.y + q[1] * A.h],
    P = g.cut!;
  // peça de couro (ou pano de linho)
  c.fillStyle = linho ? "#8f9bb0" : "#a06c3c";
  c.beginPath();
  c.moveTo(A.x - 8, A.y + 6);
  c.quadraticCurveTo(A.x + A.w / 2, A.y - 10, A.x + A.w + 8, A.y + 4);
  c.lineTo(A.x + A.w + 4, A.y + A.h + 6);
  c.quadraticCurveTo(A.x + A.w / 2, A.y + A.h + 14, A.x - 6, A.y + A.h + 4);
  c.closePath();
  c.fill();
  c.fillStyle = linho ? "rgba(255,255,255,.06)" : "rgba(60,30,10,.18)";
  for (let i = 0; i < 26; i++) {
    const x = A.x + (((i * 97) % 100) / 100) * A.w,
      y = A.y + (((i * 61) % 100) / 100) * A.h;
    c.beginPath();
    c.arc(x, y, 3 + (i % 4), 0, 6.283);
    c.fill();
  }
  const path = (n: number) => {
    c.beginPath();
    const a = pt(P[0]);
    c.moveTo(a[0], a[1]);
    for (let i = 1; i <= n; i++) {
      const q = pt(P[i]);
      c.lineTo(q[0], q[1]);
    }
  };
  if (g.ph === "cut") {
    c.setLineDash([6, 5]);
    c.strokeStyle = "rgba(255,244,214,.85)";
    c.lineWidth = 2;
    path(P.length - 1);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = "#2a160a";
    c.lineWidth = 3;
    path(g.cutI!);
    c.stroke();
    const s0 = pt(P[0]);
    if (!g.cutI) {
      c.fillStyle = "#ffd24a";
      c.beginPath();
      c.arc(s0[0], s0[1], 6 + Math.sin(t * 6) * 1.5, 0, 6.283);
      c.fill();
    }
    const kp = g.knife || { x: pt(P[g.cutI!])[0], y: pt(P[g.cutI!])[1] };
    c.save();
    c.translate(kp.x, kp.y);
    c.rotate(-0.7);
    c.fillStyle = g.knife && g.knife.off ? "#ff8a6a" : "#d8dee6";
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(5, -26);
    c.lineTo(-3, -24);
    c.closePath();
    c.fill();
    c.fillStyle = "#5a3a1e";
    c.fillRect(-3, -40, 7, 15);
    c.restore();
    c.fillStyle = "rgba(0,0,0,.45)";
    c.fillRect(16, H - 18, L - 32, 6);
    c.fillStyle = "#ffd24a";
    c.fillRect(16, H - 18, ((L - 32) * g.cutI!) / (P.length - 1), 6);
  } else {
    // a peça cortada, com os furos da costura na borda
    c.fillStyle = linho ? "#a8b4c8" : "#b98048";
    path(P.length - 1);
    c.closePath();
    c.fill();
    c.strokeStyle = "#2a160a";
    c.lineWidth = 2;
    c.stroke();
    const n = g.n,
      hole = (k: number) => pt(P[Math.floor(((k + 0.5) / n) * (P.length - 1))]),
      done = g.hits.length - (g.cutScore != null ? 2 : 0);
    for (let k = 0; k < n; k++) {
      const q = hole(k);
      c.fillStyle = "#1a0e06";
      c.beginPath();
      c.arc(q[0], q[1], 3, 0, 6.283);
      c.fill();
    }
    c.strokeStyle = "#f3e6c8";
    c.lineWidth = 2;
    for (let k = 0; k < done; k++) {
      const q = hole(k),
        s = g.hits[k + (g.cutScore != null ? 2 : 0)],
        w = s >= 0.75 ? 5 : 7;
      c.strokeStyle = s >= 0.45 ? "#f3e6c8" : "#ff8a6a";
      c.beginPath();
      c.moveTo(q[0] - w, q[1] - w);
      c.lineTo(q[0] + w, q[1] + w);
      c.moveTo(q[0] + w, q[1] - w);
      c.lineTo(q[0] - w, q[1] + w);
      c.stroke();
    }
    if (g.ph === "sew" && done < n) {
      const q = hole(done),
        k = g.sew;
      c.setLineDash([3, 3]);
      c.strokeStyle = "rgba(255,210,74,.8)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(q[0], q[1], 9, 0, 6.283);
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = "#fff";
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(q[0], q[1], Math.max(0.5, k!.r), 0, 6.283);
      c.stroke();
      c.save();
      c.translate(q[0] + 14, q[1] - 16);
      c.rotate(0.8);
      c.fillStyle = "#d8dee6";
      c.fillRect(-1, -14, 2, 22);
      c.restore();
    }
    for (let k = 0; k < n; k++) {
      const s = g.hits[k + (g.cutScore != null ? 2 : 0)];
      c.fillStyle = s == null ? "rgba(255,255,255,.2)" : s >= 0.75 ? "#ffd24a" : s >= 0.45 ? "#e9dcc0" : "#ff6a4a";
      c.beginPath();
      c.arc(22 + k * 14, H - 14, 4, 0, 6.283);
      c.fill();
    }
  }
  if (g.txt && g.txt.k > 0) {
    c.save();
    c.globalAlpha = Math.min(1, g.txt.k * 1.5);
    c.fillStyle = g.txt.c;
    c.font = "bold 16px Cinzel,serif";
    c.textAlign = "center";
    c.shadowColor = "#000";
    c.shadowBlur = 6;
    c.fillText(g.txt.t, L / 2, 26 + (1 - g.txt.k) * -10);
    c.restore();
  }
}
export function fg2Bind() {
  const cv = document.getElementById("fg-cv"),
    mb = document.getElementById("fg-mgbtn")!;
  if (!cv || cv._fg2) return;
  cv._fg2 = 1;
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", (e) => {
    const g = FG.mg;
    if (!g) return;
    if (g.ph === "cut") {
      e.preventDefault();
      FG.cutting = true;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (_) {}
      cutMove(e, true);
    } else if (g.ph === "sew") {
      e.preventDefault();
      sewHit();
    } else if (g.ph === "rings") {
      e.preventDefault();
      ringHit();
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (FG.cutting) cutMove(e, false);
  });
  for (const ev of ["pointerup", "pointercancel"])
    cv.addEventListener(ev, () => {
      FG.cutting = false;
      if (FG.mg) FG.mg.knife = null;
    });
  mb.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest("[data-mg]") as HTMLElement;
    if (!b) return;
    if (b.dataset.mg === "sew") {
      e.preventDefault();
      sewHit();
    } else if (b.dataset.mg === "ring") {
      e.preventDefault();
      ringHit();
    }
  });
  window.addEventListener(
    "keydown",
    (e) => {
      const g = FG.mg!;
      if (!FG.open || !g || e.code !== "Space") return;
      if (g.ph === "sew" || g.ph === "rings" || g.ph === "cut") {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (g.ph === "sew") sewHit();
        else if (g.ph === "rings") ringHit();
      }
    },
    true,
  );
}
