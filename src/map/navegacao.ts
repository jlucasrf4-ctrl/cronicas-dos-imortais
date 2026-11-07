/* ==== Fase 4 ====
   navegação (v6.2, portado da v3.0): grade de terra/água do quadrante ativo (NAV), massas de terra (componentes),
   margens para beber, A* com rota suavizada por linha de visão, cache por bicho (getPath, com orçamento por tick) e
   a lista de alvos ignorados. Saiu de v6.2_pathfinding */
import { CONFIG } from "../core/config.ts";
import { world } from "../core/state.ts";
import { NAV_DIRS } from "../data/mapa.ts";
import { isWaterCell } from "./agua.ts";
import { montanhaEm } from "./terreno.ts";
import { clampX, clampY } from "../sim/animais.ts";
import { findNearestFood } from "../sim/vegetacao.ts";
import type { Andante, Animal, CaminhoNav, Hero, Planta, Ponto } from "../core/tipos.ts";

/** Uma margem para beber: (x, y) a água, (sx, sy) a terra vizinha, comp o pedaço de terra. */
type Margem = { x: number; y: number; sx: number; sy: number; comp: number };
export const NAV = {
  step: 4,
  ox: 0,
  oy: 0,
  w: 0,
  h: 0,
  blocked: null as Uint8Array | null,
  comp: null as Int32Array | null,
  compSize: [] as number[],
  mainComp: -1,
  ready: false,
  shore: [] as Margem[],
  shoreIdx: new Map() as Map<number, number[]>, // v7.7: as margens por célula (indexarPontos)
};
export const NAV_PENDING = { pending: true } as unknown as CaminhoNav; // sentinela de getPath ("sem orçamento de A* neste tique"): só é comparada por identidade, então leva o tipo de um caminho
export function navBuild() {
  const b = CONFIG.SIM_BOUNDS,
    step = world.waterGridStep;
  const ox = Math.ceil(b.x / step) * step,
    oy = Math.ceil(b.y / step) * step,
    w = Math.floor((b.x + b.w - ox) / step) + 1,
    h = Math.floor((b.y + b.h - oy) / step) + 1;
  NAV.step = step;
  NAV.ox = ox;
  NAV.oy = oy;
  NAV.w = w;
  NAV.h = h;
  NAV.blocked = new Uint8Array(w * h);
  NAV.comp = new Int32Array(w * h).fill(-1);
  _as.g = null;
  for (const p of world.waterPoints) {
    const i = Math.round((p.x - ox) / step),
      j = Math.round((p.y - oy) / step);
    if (i >= 0 && j >= 0 && i < w && j < h) NAV.blocked[j * w + i] = 1;
  }
  // v8.1 — o paredão da montanha (map/terreno.ts) também barra: 2 (isWaterCell só vê o 1, a água de pescar e beber)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (!NAV.blocked[j * w + i] && montanhaEm(ox + i * step, oy + j * step)) NAV.blocked[j * w + i] = 2;
  const q = new Int32Array(w * h);
  NAV.compSize = [];
  for (let s = 0; s < w * h; s++) {
    if (NAV.blocked[s] || NAV.comp[s] >= 0) continue;
    const id = NAV.compSize.length;
    let qh = 0,
      qt = 0,
      n = 0;
    q[qt++] = s;
    NAV.comp[s] = id;
    while (qh < qt) {
      const c = q[qh++];
      n++;
      const cx = c % w,
        cy = (c / w) | 0;
      for (const [dx, dy] of NAV_DIRS) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (NAV.blocked[ni] || NAV.comp[ni] >= 0) continue;
        if (dx && dy && (NAV.blocked[cy * w + nx] || NAV.blocked[ny * w + cx])) continue;
        NAV.comp[ni] = id;
        q[qt++] = ni;
      }
    }
    NAV.compSize.push(n);
  }
  NAV.mainComp = NAV.compSize.length ? NAV.compSize.indexOf(Math.max(...NAV.compSize)) : -1;
  const spots = []; // margens: par (água, terra vizinha) para beber sem entrar na água
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (NAV.blocked[j * w + i] !== 1) continue; // v8.1: só água (o paredão da montanha não dá de beber)
      let got = -2;
      for (const [dx, dy] of NAV_DIRS) {
        const nx = i + dx,
          ny = j + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (NAV.blocked[ni] || NAV.comp[ni] === got) continue;
        got = NAV.comp[ni];
        spots.push({ x: ox + i * step, y: oy + j * step, sx: ox + nx * step, sy: oy + ny * step, comp: got });
      }
    }
  NAV.shore = spots;
  NAV.shoreIdx = indexarPontos(
    spots,
    (p) => p.sx,
    (p) => p.sy,
  );
  NAV.ready = true;
}
/* v7.7 — índice espacial simples (célula de IDX_CEL unidades → índices em ordem crescente): a busca da margem para
   beber e da planta para comer olhava a lista inteira (2.700 margens, 1.300 plantas) para cada bicho a cada passo. */
const IDX_CEL = 48;
const chaveIdx = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
type Indice = Map<number, number[]>;
function indexarPontos<T>(L: T[], fx: (p: T) => number, fy: (p: T) => number): Indice {
  const I: Indice = new Map();
  L.forEach((p, i) => {
    const k = chaveIdx(Math.floor(fx(p) / IDX_CEL), Math.floor(fy(p) / IDX_CEL));
    const b = I.get(k);
    if (b) b.push(i);
    else I.set(k, [i]);
  });
  return I;
}
/** Chama f(i) para cada índice do índice I perto de (x, y) (quadrado de lado 2·r). */
function perto(I: Indice, x: number, y: number, r: number, f: (i: number) => void) {
  const c0 = Math.floor((x - r) / IDX_CEL),
    c1 = Math.floor((x + r) / IDX_CEL),
    l0 = Math.floor((y - r) / IDX_CEL),
    l1 = Math.floor((y + r) / IDX_CEL);
  for (let cx = c0; cx <= c1; cx++)
    for (let cy = l0; cy <= l1; cy++) {
      const b = I.get(chaveIdx(cx, cy));
      if (b) for (const i of b) f(i);
    }
}
/** O índice das plantas (refeito quando world.veg é trocado: seedVegetation). */
const VEG_IDX = { lista: null as Planta[] | null, idx: null as Indice | null };
function indiceVeg() {
  if (VEG_IDX.lista !== world.veg) {
    VEG_IDX.lista = world.veg;
    VEG_IDX.idx = indexarPontos(
      world.veg,
      (p) => p.x,
      (p) => p.y,
    );
  }
  return VEG_IDX.idx!;
}
export function navIdx(x: number, y: number) {
  let i = Math.round((x - NAV.ox) / NAV.step),
    j = Math.round((y - NAV.oy) / NAV.step);
  i = i < 0 ? 0 : i >= NAV.w ? NAV.w - 1 : i;
  j = j < 0 ? 0 : j >= NAV.h ? NAV.h - 1 : j;
  return j * NAV.w + i;
}
export function navX(k: number) {
  return NAV.ox + (k % NAV.w) * NAV.step;
}
export function navY(k: number) {
  return NAV.oy + ((k / NAV.w) | 0) * NAV.step;
}
export function nearestLand(idx: number, maxR: number, compWanted: number) {
  const W = NAV.w,
    H = NAV.h,
    ci = idx % W,
    cj = (idx / W) | 0;
  for (let r = 0; r <= maxR; r++) {
    let best = -1,
      bd = 1e9;
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di,
          j = cj + dj;
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        const k = j * W + i;
        if (NAV.blocked![k] || (compWanted >= 0 && NAV.comp![k] !== compWanted)) continue;
        const d = di * di + dj * dj;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
    if (best >= 0) return best;
  }
  return -1;
}
export function compAt(x: number, y: number) {
  if (!NAV.ready) return 0;
  let idx = navIdx(x, y);
  if (NAV.blocked![idx]) {
    idx = nearestLand(idx, NAV.blocked![idx] === 2 ? 60 : 3, -1); // v8.1: o paredão é largo
    if (idx < 0) return -1;
  }
  return NAV.comp![idx];
}
export function losClear(x0: number, y0: number, x1: number, y1: number) {
  if (!NAV.ready) return true;
  const dx = x1 - x0,
    dy = y1 - y0,
    n = Math.ceil(Math.hypot(dx, dy) / 2);
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (NAV.blocked![navIdx(x0 + dx * t, y0 + dy * t)]) return false;
  }
  return true;
}
const _as = {
  g: null as Float32Array | null,
  par: null as Int32Array | null,
  seen: null as Uint32Array | null,
  closed: null as Uint32Array | null,
  cur: 0,
};
function astarCells(si: number, gi: number, maxCost: number) {
  const W = NAV.w,
    H = NAV.h,
    N = W * H,
    bl = NAV.blocked!;
  if (!_as.g || _as.g.length !== N) {
    _as.g = new Float32Array(N);
    _as.par = new Int32Array(N);
    _as.seen = new Uint32Array(N);
    _as.closed = new Uint32Array(N);
    _as.cur = 0;
  }
  const stamp = ++_as.cur,
    g = _as.g,
    par = _as.par!,
    seen = _as.seen!,
    closed = _as.closed!,
    gx = gi % W,
    gy = (gi / W) | 0;
  const hf = (i: number) => {
    const dx = Math.abs((i % W) - gx),
      dy = Math.abs(((i / W) | 0) - gy);
    return dx + dy - 0.58578644 * Math.min(dx, dy);
  };
  const hi: number[] = [],
    hv: number[] = [];
  const push = (i: number, f: number) => {
    let k = hi.length;
    hi.push(i);
    hv.push(f);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hv[p] <= f) break;
      hi[k] = hi[p];
      hv[k] = hv[p];
      k = p;
    }
    hi[k] = i;
    hv[k] = f;
  };
  const pop = () => {
    const top = hi[0],
      li = hi.pop()!,
      lf = hv.pop()!,
      n = hi.length;
    if (n > 0) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && hv[c + 1] < hv[c]) c++;
        if (hv[c] >= lf) break;
        hi[k] = hi[c];
        hv[k] = hv[c];
        k = c;
      }
      hi[k] = li;
      hv[k] = lf;
    }
    return top;
  };
  g[si] = 0;
  seen[si] = stamp;
  par[si] = -1;
  push(si, hf(si));
  while (hi.length) {
    const c = pop();
    if (closed[c] === stamp) continue;
    closed[c] = stamp;
    if (c === gi) {
      const out = [];
      for (let k = c; k !== -1; k = par[k]) out.push(k);
      return out.reverse();
    }
    const cx = c % W,
      cy = (c / W) | 0,
      gc = g[c];
    for (let d = 0; d < 8; d++) {
      const nx = cx + NAV_DIRS[d][0],
        ny = cy + NAV_DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (bl[ni] || closed[ni] === stamp) continue;
      if (d >= 4 && (bl[cy * W + nx] || bl[ny * W + cx])) continue;
      const ng = gc + NAV_DIRS[d][2];
      if (seen[ni] === stamp && g[ni] <= ng) continue;
      const f = ng + hf(ni);
      if (f > maxCost) continue;
      g[ni] = ng;
      par[ni] = c;
      seen[ni] = stamp;
      push(ni, f);
    }
  }
  return null;
}
export function findPath(sx: number, sy: number, tx: number, ty: number, maxLen: number) {
  if (!NAV.ready) return null;
  let si = navIdx(sx, sy),
    gi = navIdx(tx, ty);
  // v8.1: dentro do paredão da montanha (2) a terra livre pode estar bem mais longe que na beira d'água
  if (NAV.blocked![si]) {
    si = nearestLand(si, NAV.blocked![si] === 2 ? 60 : 4, -1);
    if (si < 0) return null;
  }
  const c = NAV.comp![si];
  if (NAV.blocked![gi]) {
    gi = nearestLand(gi, NAV.blocked![gi] === 2 ? 60 : 6, c);
    if (gi < 0) return null;
  } else if (NAV.comp![gi] !== c) return null; // outra ilha: sem rota por terra
  const maxCost = isFinite(maxLen) ? (maxLen / NAV.step) * 1.35 + 2 : Infinity;
  const cells = astarCells(si, gi, maxCost);
  if (!cells) return null;
  const L = cells.slice(1).map((k) => ({ x: navX(k), y: navY(k) })),
    pts = [];
  let ax = sx,
    ay = sy,
    i = 0;
  while (i < L.length) {
    let k = L.length - 1;
    while (k > i && !losClear(ax, ay, L[k].x, L[k].y)) k--;
    pts.push({ x: L[k].x, y: L[k].y });
    ax = L[k].x;
    ay = L[k].y;
    i = k + 1;
  }
  if (!NAV.blocked![navIdx(tx, ty)]) {
    const prev = pts.length > 1 ? pts[pts.length - 2] : { x: sx, y: sy };
    if (pts.length && losClear(prev.x, prev.y, tx, ty)) pts[pts.length - 1] = { x: tx, y: ty };
    else pts.push({ x: tx, y: ty });
  }
  let len = 0,
    px = sx,
    py = sy;
  for (const p of pts) {
    len += Math.hypot(p.x - px, p.y - py);
    px = p.x;
    py = p.y;
  }
  if (len > maxLen) return null;
  return { pts, len };
}
export function getPath(a: Andante, tx: number, ty: number, maxLen: number) {
  const n = a.nav;
  if (n && Math.hypot(n.gx - tx, n.gy - ty) < 14 && world.tick - n.t < (n.ok ? 45 : 60)) {
    if (n.ok) return n.len <= maxLen ? n : null;
    if (n.lim >= maxLen) return null;
  }
  if (world.navBudget! <= 0) return n && n.ok ? n : NAV_PENDING;
  world.navBudget!--;
  const p = findPath(a.x, a.y, tx, ty, maxLen);
  a.nav = p
    ? { gx: tx, gy: ty, pts: p.pts, i: 0, t: world.tick, ok: true, len: p.len, lim: maxLen }
    : { gx: tx, gy: ty, pts: [], i: 0, t: world.tick, ok: false, len: 0, lim: maxLen };
  return p ? a.nav : null;
}
export function isIgnored(a: Animal, e: Ponto) {
  if (!a || !a.ign || !e) return false;
  const t = a.ign.get(e);
  if (t === undefined) return false;
  if (t < world.tick) {
    a.ign.delete(e);
    return false;
  }
  return true;
}
function ignoreEntity(a: Animal, e: Ponto, min: number) {
  if (!e || !a) return;
  if (!a.ign) a.ign = new Map();
  if (a.ign.size > 40) a.ign.clear();
  a.ign.set(e, world.tick + (min || 180));
}
/* bicho sem rota: larga o objetivo; a IA escolhe outro no próximo tick */
export function abandonGoal(a: Animal) {
  if (a.targetEntity) ignoreEntity(a, a.targetEntity, 180);
  if (a._thirstSpot) ignoreEntity(a, a._thirstSpot, 180);
  a.target = null;
  a.targetEntity = null;
  a.nav = null;
  a.navActive = false;
  if (/^(seekFood|hunting|seekWater|eating|fleeing|wander)$/.test(a.state)) a.state = "idle";
}
/* filtro usado pela IA ao escolher alvos: outra ilha ou já ignorado → pula */
export function navSkip(a: Animal, e: Ponto) {
  if (!NAV.ready || !a || !e) return false;
  if (isIgnored(a, e)) return true;
  const ca =
    a._navC != null && a._navT === world.tick ? a._navC : ((a._navT = world.tick), (a._navC = compAt(a.x, a.y)));
  return compAt(e.x, e.y) !== ca;
}
export function navIsHero(a: Andante) {
  return !!(a && a.camp && world.heroes.indexOf(a as Hero) >= 0);
}
/* água para beber: a margem do mesmo pedaço de terra, sem entrar na água */
export function navShoreFor(a: Animal, maxDist: number) {
  if (!NAV.ready) return null;
  const comp = compAt(a.x, a.y);
  let best: Margem | null = null,
    bi = -1,
    bd = maxDist * maxDist;
  // v7.7: só as margens perto (índice); no empate fica a de menor índice, como na varredura em ordem de antes
  perto(NAV.shoreIdx, a.x, a.y, maxDist, (i) => {
    const p = NAV.shore[i];
    if (p.comp !== comp) return;
    const dx = p.sx - a.x,
      dy = p.sy - a.y,
      d2 = dx * dx + dy * dy;
    if ((d2 < bd || (best && d2 === bd && i < bi)) && !isIgnored(a, p)) {
      bd = d2;
      best = p;
      bi = i;
    }
  });
  return best as Margem | null; // (atribuída dentro do callback: o TypeScript não vê)
}

/* fuga: direção oposta à ameaça, mas só por onde dá para correr em linha reta */
export function fleeTarget(a: Animal, threat: Ponto) {
  const base = Math.atan2(a.y - threat.y, a.x - threat.x) + (a.fleeJitter || 0);
  const offs = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.9, -1.9, 2.5, -2.5];
  for (const o of offs)
    for (const len of [120, 70, 36]) {
      const tx = clampX(a.x + Math.cos(base + o) * len),
        ty = clampY(a.y + Math.sin(base + o) * len);
      if (!isWaterCell(tx, ty) && losClear(a.x, a.y, tx, ty)) return { x: tx, y: ty };
    }
  return null;
}
export function navFood(a: Animal, range: number) {
  if (!NAV.ready) return findNearestFood(a.x, a.y, range);
  const ca = compAt(a.x, a.y),
    veg = world.veg;
  let best: Planta | null = null,
    bi = -1,
    bd = range * range;
  // v7.7: só as plantas perto (índice); no empate fica a de menor índice, como na varredura em ordem de antes
  perto(indiceVeg(), a.x, a.y, range, (i) => {
    const p = veg[i];
    if (p.growth < 0.2) return;
    const dx = p.x - a.x,
      dy = p.y - a.y,
      d2 = dx * dx + dy * dy;
    if (d2 > bd || (d2 === bd && (!best || i > bi))) return;
    if (compAt(p.x, p.y) !== ca || isIgnored(a, p)) return;
    bd = d2;
    best = p;
    bi = i;
  });
  return best as Planta | null; // (atribuída dentro do callback: o TypeScript não vê)
}
