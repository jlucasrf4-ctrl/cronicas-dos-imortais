/* ==== Fase 4 — 3D da masmorra em Canvas 2D: projeção ortográfica inclinada (base/10) ==== */
import { dungeon, TELAS, OPT } from "../core/state.ts";
import { drawPrepPortrait } from "../expedicao/preparo.ts";
import type { Hero } from "../core/tipos.ts";

/* ===== 3D da dungeon: projeção ortográfica inclinada (câmera de cima, ~58°) com sprites em pé ===== */
interface EstadoD3 {
  on: boolean;
  gl: boolean;
  ZM: number;
  TH: number;
  WALL: number;
  NEAR: number;
  BS: number;
  cw: number;
  ch: number;
  s: number;
  vy: number;
  dpr: number;
  cx: number;
  cz: number;
  q: { y: number; f: () => void }[]; // o que desenhar neste quadro, ordenado por y (d3Flush)
  inFrame: boolean;
  inst: boolean;
  floorCv: HTMLCanvasElement | null;
  heroCv: HTMLCanvasElement | null;
  heroRed: HTMLCanvasElement | null;
  heroKey: string;
  lpx: number;
  lpy: number;
  PICK: number;
  // acrescentados depois
  SIN?: number;
  COS?: number;
}
export const D3: EstadoD3 = {
  on: true,
  gl: false,
  ZM: 1.4 / 1.2, // v7.7: câmera 20% mais afastada (era 1,4); a roda do mouse aproxima até 1,4 (CZ.jog em field/tipos.ts)
  TH: (47 * Math.PI) / 180,
  WALL: 58,
  NEAR: 12,
  BS: 1.25,
  cw: 0,
  ch: 0,
  s: 1,
  vy: 0,
  dpr: 1,
  cx: 0,
  cz: 0,
  q: [],
  inFrame: false,
  inst: false,
  floorCv: null,
  heroCv: null,
  heroRed: null,
  heroKey: "",
  lpx: 0,
  lpy: 0,
  PICK: 14,
};
function d3P(X: number, Z: number, h: number) {
  return [
    D3.dpr * (D3.cw / 2 + (X - D3.cx) * D3.s),
    D3.dpr * (D3.ch / 2 + D3.vy + (Z - D3.cz) * D3.SIN! * D3.s - (h || 0) * D3.COS! * D3.s),
  ];
}
export function d3Ground() {
  const k = dungeon.k,
    c = TELAS.dCtx;
  c.setTransform(
    k,
    0,
    0,
    k * D3.SIN!,
    D3.dpr * (D3.cw / 2 - D3.cx * D3.s),
    D3.dpr * (D3.ch / 2 + D3.vy - D3.cz * D3.SIN! * D3.s),
  );
}
export function d3Shift(c: CanvasRenderingContext2D, lift: number) {
  const m = c.getTransform();
  c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f - lift * D3.s * D3.dpr);
}
export function d3Squashed(c: CanvasRenderingContext2D) {
  if (!(D3.on && D3.inFrame && c === TELAS.dCtx)) return null;
  const m = c.getTransform();
  return Math.abs(m.d - m.a) > 1e-6 ? m : null;
}
export function d3Bill(x: number, y: number, lift: number, fn: () => void) {
  const c = TELAS.dCtx,
    k = dungeon.k * D3.BS,
    PX = D3.dpr * (D3.cw / 2 + (x - D3.cx) * D3.s),
    PY = D3.dpr * (D3.ch / 2 + D3.vy + (y - D3.cz) * D3.SIN! * D3.s - lift * D3.BS * D3.s);
  c.save();
  c.setTransform(k, 0, 0, k, PX - x * k, PY - y * k);
  fn();
  c.restore();
}
export function dPoint(e: { clientX: number; clientY: number }) {
  const r = TELAS.dCanvas.getBoundingClientRect();
  if (!D3.on)
    return {
      x: ((e.clientX - r.left) * (dungeon.cols * dungeon.tile)) / r.width,
      y: ((e.clientY - r.top) * (dungeon.rows * dungeon.tile)) / r.height,
    };
  const sx = ((e.clientX - r.left) * D3.cw) / r.width,
    sy = ((e.clientY - r.top) * D3.ch) / r.height;
  return {
    x: D3.cx + (sx - D3.cw / 2) / D3.s,
    y: D3.cz + (sy - D3.ch / 2 - D3.vy + D3.PICK * D3.COS! * D3.s) / (D3.SIN! * D3.s),
  };
}
export function d3Install() {
  // texto e sprites desenhados "no chão" ficam em pé (sem achatar) no ponto projetado
  if (D3.inst) return;
  D3.inst = true;
  const c = TELAS.dCtx,
    ft = c.fillText.bind(c),
    st = c.strokeText.bind(c);
  const wrap = (orig: (t: string, x: number, y: number, mw?: number) => void) =>
    function (t: string, x: number, y: number, _mw: number) {
      const m = d3Squashed(c);
      if (!m) return orig(t, x, y);
      c.save();
      c.setTransform(m.a, 0, 0, m.a, m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f - 10 * D3.s * D3.dpr);
      orig(t, 0, 0);
      c.restore();
    };
  c.fillText = wrap(ft);
  c.strokeText = wrap(st);
}
function d3MakeFloor() {
  const T = dungeon.tile,
    W = dungeon.cols * T,
    H = dungeon.rows * T,
    S = 2,
    cv = document.createElement("canvas");
  cv.width = W * S;
  cv.height = H * S;
  const c = cv.getContext("2d")!;
  c.scale(S, S);
  let sd = 1234567;
  const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  c.fillStyle = "#2a2014";
  c.fillRect(0, 0, W, H);
  for (let gy = 1; gy < dungeon.rows - 1; gy++)
    for (let gx = 1; gx < dungeon.cols - 1; gx++) {
      const x = gx * T,
        y = gy * T;
      c.fillStyle = (gx + gy) % 2 === 0 ? "#4b3e29" : "#43371f";
      c.fillRect(x, y, T, T);
      c.fillStyle =
        rnd() < 0.5 ? "rgba(255,235,190," + (0.02 + rnd() * 0.05) + ")" : "rgba(0,0,0," + (0.03 + rnd() * 0.06) + ")";
      c.fillRect(x, y, T, T);
      c.fillStyle = "rgba(255,235,190,.10)";
      c.fillRect(x, y, T, 1.2);
      c.fillRect(x, y, 1.2, T);
      c.fillStyle = "rgba(0,0,0,.30)";
      c.fillRect(x, y + T - 1.2, T, 1.2);
      c.fillRect(x + T - 1.2, y, 1.2, T);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,.22)" : "rgba(255,235,190,.14)";
        c.fillRect(x + 3 + rnd() * (T - 6), y + 3 + rnd() * (T - 6), 1 + rnd() * 1.5, 1 + rnd() * 1.2);
      }
      if (rnd() < 0.13) {
        c.strokeStyle = "rgba(0,0,0,.4)";
        c.lineWidth = 0.9;
        c.beginPath();
        let px = x + 5 + rnd() * (T - 10),
          py = y + 5 + rnd() * (T - 10);
        c.moveTo(px, py);
        for (let i = 0; i < 4; i++) {
          px += (rnd() - 0.5) * 14;
          py += (rnd() - 0.2) * 10;
          c.lineTo(Math.max(x + 2, Math.min(x + T - 2, px)), Math.max(y + 2, Math.min(y + T - 2, py)));
        }
        c.stroke();
      }
      if (rnd() < 0.07) {
        const g = c.createRadialGradient(x + T / 2, y + T / 2, 0, x + T / 2, y + T / 2, T * 0.7);
        g.addColorStop(0, "rgba(20,30,10,.35)");
        g.addColorStop(1, "rgba(20,30,10,0)");
        c.fillStyle = g;
        c.fillRect(x - 6, y - 6, T + 12, T + 12);
      }
    }
  const ao = (x0: number, y0: number, x1: number, y1: number, gx: number, gy: number, w: number, h: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,0,0,.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(gx, gy, w, h);
  };
  ao(0, T, 0, T + 34, T, T, W - 2 * T, 34);
  ao(T, 0, T + 24, 0, T, T, 24, H - 2 * T);
  ao(W - T, 0, W - T - 24, 0, W - T - 24, T, 24, H - 2 * T);
  ao(0, H - T, 0, H - T - 14, T, H - T - 14, W - 2 * T, 14);
  return cv;
}
function d3Torches() {
  const W = dungeon.cols * dungeon.tile;
  return [W * 0.16, W * 0.38, W * 0.62, W * 0.84];
}
export function d3Scene(now: number) {
  if (D3.gl) {
    d3Ground();
    return;
  }
  const c = TELAS.dCtx,
    T = dungeon.tile,
    W = dungeon.cols * T,
    H = dungeon.rows * T,
    s = D3.s,
    dpr = D3.dpr,
    WH = D3.WALL,
    NH = D3.NEAR,
    P = d3P;
  c.setTransform(1, 0, 0, 1, 0, 0);
  const bw = D3.cw * dpr,
    bh = D3.ch * dpr,
    bg = c.createRadialGradient(bw / 2, bh / 2, 40, bw / 2, bh / 2, Math.max(bw, bh) * 0.7);
  bg.addColorStop(0, "#1c150c");
  bg.addColorStop(1, "#060402");
  c.fillStyle = bg;
  c.fillRect(0, 0, bw, bh);
  d3Ground();
  if (!D3.floorCv) D3.floorCv = d3MakeFloor();
  c.imageSmoothingEnabled = true;
  c.drawImage(D3.floorCv, 0, 0, W, H);
  const tx = d3Torches(),
    fl = tx.map((_, i) => 0.82 + 0.12 * Math.sin(now / 105 + i * 2.1) + 0.06 * Math.sin(now / 47 + i * 5));
  c.save();
  c.beginPath();
  c.rect(T, T, W - 2 * T, H - 2 * T);
  c.clip();
  c.globalCompositeOperation = "lighter";
  tx.forEach((X, i) => {
    const g = c.createRadialGradient(X, T + 6, 0, X, T + 6, 190);
    g.addColorStop(0, "rgba(255,150,60," + 0.22 * fl[i] + ")");
    g.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = g;
    c.fillRect(X - 190, T, 380, 260);
  });
  c.restore();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.lineWidth = dpr;
  c.lineJoin = "round";
  // parede do fundo: face frontal
  {
    const a = P(0, T, WH),
      b = P(W, T, WH),
      d0 = P(0, T, 0),
      e = P(W, T, 0),
      g = c.createLinearGradient(0, a[1], 0, d0[1]);
    g.addColorStop(0, "#5d4b33");
    g.addColorStop(1, "#2c2217");
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.lineTo(e[0], e[1]);
    c.lineTo(d0[0], d0[1]);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(0,0,0,.38)";
    c.beginPath();
    let row = 0;
    for (let h = 0; h <= WH; h += 10, row++) {
      const l = P(0, T, h),
        r = P(W, T, h);
      if (h > 0 && h < WH) {
        c.moveTo(l[0], l[1]);
        c.lineTo(r[0], r[1]);
      }
      for (let x = (row % 2) * 14; x < W; x += 28) {
        if (h + 10 > WH) break;
        const u = P(x, T, h),
          v = P(x, T, h + 10);
        c.moveTo(u[0], u[1]);
        c.lineTo(v[0], v[1]);
      }
    }
    c.stroke();
    const ao = c.createLinearGradient(0, d0[1], 0, d0[1] - 14 * dpr * s);
    ao.addColorStop(0, "rgba(0,0,0,.45)");
    ao.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = ao;
    c.fillRect(a[0], d0[1] - 14 * dpr * s, e[0] - a[0], 14 * dpr * s);
  }
  // topos: parede do fundo + laterais (inclinadas até a parede da frente)
  const top = (pts: number[][], col: string) => {
    c.beginPath();
    pts.forEach((p: number[], i: number) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fillStyle = col;
    c.fill();
    c.strokeStyle = "rgba(255,235,190,.16)";
    c.stroke();
  };
  top([P(0, 0, WH), P(W, 0, WH), P(W, T, WH), P(0, T, WH)], "#7b6545");
  top([P(0, T, WH), P(T, T, WH), P(T, H, NH), P(0, H, NH)], "#6c5a3d");
  top([P(W - T, T, WH), P(W, T, WH), P(W, H, NH), P(W - T, H, NH)], "#6c5a3d");
  // tochas
  tx.forEach((X, i) => {
    const p = P(X, T, WH * 0.5),
      u = s * dpr,
      f = fl[i];
    c.fillStyle = "#1c140b";
    c.fillRect(p[0] - 2.5 * u, p[1] - 1 * u, 5 * u, 11 * u);
    c.fillStyle = "#3a2a16";
    c.fillRect(p[0] - 4 * u, p[1] - 3 * u, 8 * u, 3 * u);
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(p[0], p[1] - 8 * u, 0, p[0], p[1] - 8 * u, 70 * u);
    g.addColorStop(0, "rgba(255,170,70," + 0.45 * f + ")");
    g.addColorStop(1, "rgba(255,120,30,0)");
    c.fillStyle = g;
    c.fillRect(p[0] - 70 * u, p[1] - 80 * u, 140 * u, 140 * u);
    c.restore();
    c.fillStyle = "#ff8a1f";
    c.beginPath();
    c.ellipse(p[0], p[1] - 7 * u, 3.4 * u * f, 7 * u * f, 0, 0, 7);
    c.fill();
    c.fillStyle = "#ffe38a";
    c.beginPath();
    c.ellipse(p[0], p[1] - 5 * u, 1.8 * u, 4 * u * f, 0, 0, 7);
    c.fill();
  });
  d3Ground();
}
export function d3Near(_now?: number) {
  // parapeito baixo da frente + pontas das laterais + vinheta (depois dos personagens)
  const c = TELAS.dCtx,
    T = dungeon.tile,
    W = dungeon.cols * T,
    H = dungeon.rows * T,
    NH = D3.NEAR,
    P = d3P,
    dpr = D3.dpr;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.lineWidth = dpr;
  c.lineJoin = "round";
  if (D3.gl) {
    const bw = D3.cw * dpr,
      bh = D3.ch * dpr,
      v = c.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.45, bw / 2, bh / 2, Math.max(bw, bh) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(40,20,0,.28)");
    c.fillStyle = v;
    c.fillRect(0, 0, bw, bh);
    d3Ground();
    return;
  }
  const quad = (pts: number[][], col: string) => {
    c.beginPath();
    pts.forEach((p: number[], i: number) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    c.fillStyle = col;
    c.fill();
    c.strokeStyle = "rgba(255,235,190,.14)";
    c.stroke();
  };
  quad([P(0, H, NH), P(W, H, NH), P(W, H, 0), P(0, H, 0)], "#3a2d1c");
  quad([P(0, H - T, NH), P(W, H - T, NH), P(W, H, NH), P(0, H, NH)], "#6a573b");
  const bw = D3.cw * dpr,
    bh = D3.ch * dpr,
    v = c.createRadialGradient(bw / 2, bh / 2, Math.min(bw, bh) * 0.35, bw / 2, bh / 2, Math.max(bw, bh) * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.55)");
  c.fillStyle = v;
  c.fillRect(0, 0, bw, bh);
  d3Ground();
}
/** v8.1 (2026-11-08) — quanto a câmera se adianta para a mira (field/chao.ts olharMira), suavizado em d3Follow. */
const ADIANTE = { x: 0, z: 0 };
/** Câmera acompanha o herói (com zoom), sem mostrar muito além da arena. `ox`/`oz` = o ponto que precisa caber na
 *  tela (a ponta do alcance do arco mirado), relativo ao herói: a câmera anda até ele caber com uma folga, sem perder
 *  o herói de vista; sem ponto, volta devagar para o centro. */
export function d3Follow(k: number, ox = 0, oz = 0) {
  const d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    vw = D3.cw / D3.s,
    vh = D3.ch / (D3.SIN! * D3.s),
    mx = T * 1.2,
    mz = T * 1.2;
  // o quanto o ponto passa da borda (folga de 0,8 tile), limitado para o herói ficar a 1,5 tile da borda oposta
  const passa = (o: number, meia: number) => {
    const folga = meia - T * 0.8,
      lim = Math.max(0, meia - T * 1.5),
      s = Math.abs(o) > folga ? Math.sign(o) * (Math.abs(o) - folga) : 0;
    return Math.max(-lim, Math.min(lim, s));
  };
  const qx = passa(ox, vw / 2),
    qz = passa(oz, vh / 2),
    ka = Math.min(1, k * (qx || qz ? 0.7 : 0.45));
  ADIANTE.x += (qx - ADIANTE.x) * ka;
  ADIANTE.z += (qz - ADIANTE.z) * ka;
  const fx = d.px + ADIANTE.x,
    fz = d.py + ADIANTE.z;
  const tx = vw >= W + 2 * mx ? W / 2 : Math.max(vw / 2 - mx, Math.min(W - vw / 2 + mx, fx)),
    tz = vh >= H + 2 * mz ? H / 2 : Math.max(vh / 2 - mz - T * 0.6, Math.min(H - vh / 2 + mz, fz));
  D3.cx += (tx - D3.cx) * k;
  D3.cz += (tz - D3.cz) * k;
}
export function d3Flush() {
  const q = D3.q;
  q.sort((a: { y: number }, b: { y: number }) => a.y - b.y);
  for (const e of q) e.f();
  q.length = 0;
}
function d3HeroCv(h: Hero) {
  if (D3.heroKey !== h.color) {
    const pc = document.getElementById("prep-portrait") as HTMLCanvasElement,
      cv = document.createElement("canvas");
    cv.width = pc.width;
    cv.height = pc.height;
    drawPrepPortrait(h, cv, true);
    const rd = document.createElement("canvas");
    rd.width = cv.width;
    rd.height = cv.height;
    const r = rd.getContext("2d")!;
    r.drawImage(cv, 0, 0);
    r.globalCompositeOperation = "source-atop";
    r.fillStyle = "#ff3030";
    r.fillRect(0, 0, rd.width, rd.height);
    D3.heroCv = cv;
    D3.heroRed = rd;
    D3.heroKey = h.color;
  }
  return D3.heroCv!;
}
export function d3Hero(h: Hero) {
  // figura em pé (a mesma do preparo), com sombra, nome e flash de dano
  if (D3.gl) {
    if (!OPT.textos) return;
    const c = TELAS.dCtx,
      x = dungeon.px,
      y = dungeon.py - 40;
    c.font = "11px Lora, serif";
    c.textAlign = "center";
    c.fillStyle = "#1c140b";
    c.fillText(h.name, x + 0.5, y + 0.5);
    c.fillStyle = "#fff8e3";
    c.fillText(h.name, x, y);
    return;
  }
  const c = TELAS.dCtx,
    d = dungeon,
    hh = 50,
    ww = (hh * 104) / 150,
    x = d.px,
    mv = Math.hypot(d.px - D3.lpx, d.py - D3.lpy) > 0.05;
  D3.lpx = d.px;
  D3.lpy = d.py;
  const bob = mv ? Math.abs(Math.sin(performance.now() / 95)) * 2.6 : 0,
    y = d.py - bob,
    cv = d3HeroCv(h);
  c.save();
  c.globalAlpha = 0.32;
  c.fillStyle = "#000";
  c.beginPath();
  c.ellipse(x, d.py + hh * 0.5, 13, 4.5, 0, 0, 7);
  c.fill();
  c.restore();
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(cv, 13, 28, 104, 150, x - ww / 2, y - hh / 2, ww, hh);
  if (d.hurtFlash! > 0) {
    c.globalAlpha = Math.min(0.75, (d.hurtFlash! / 0.45) * 0.8);
    c.drawImage(D3.heroRed!, 13, 28, 104, 150, x - ww / 2, y - hh / 2, ww, hh);
  }
  c.restore();
  c.font = "11px Lora, serif";
  c.textAlign = "center";
  c.fillStyle = "#1c140b";
  c.fillText(h.name, x + 0.5, y - hh / 2 - 3.5);
  c.fillStyle = "#fff8e3";
  c.fillText(h.name, x, y - hh / 2 - 4);
}
