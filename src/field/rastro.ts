/* ==== v8.0 — rastrear a presa da caçada (RASTRO em data/mapa.ts; mantenedor, 2026-10-24: "com o mapa maior estou
   sentindo dificuldade de rastrear o cervo… um sistema de pegadas ou algo pra trackear o bicho") ====
   A presa da caçada (map/cacada.ts, m.cacada) deixa pegadas no chão (dungeon.pegadas, alternando o pé esquerdo e o
   direito) que somem com o tempo; ao entrar no campo um rastro já sai de perto da heroína e vai até ela. As pegadas
   estão em coordenadas do campo, então a janela do campo aberto as leva junto ao deslizar (map/mundo.ts, deslocar).
   Fora da tela, uma seta na borda aponta para a presa, com a distância em passos.
   Às vezes (mantenedor: "às vezes não ter pegada e ter fezes; as fezes liberam a pegada") o começo não tem pegada nem
   seta: há fezes (dungeon.fezes) entre ela e a presa; chegar perto de uma revela o rastro dali até a presa. A perícia
   Rastreio (data/atributos.ts) diminui a chance sem rastro, alonga as pegadas e aumenta o raio de achar fezes; sobe ao
   pisar nas pegadas, achar fezes e abater a presa. */
import { dungeon, TELAS } from "../core/state.ts";
import { RASTRO } from "../data/mapa.ts";
import { D3 } from "./projecao.ts";
import { MB, mbCyl, glMesh } from "../render/gl/malhas.ts";
import { M4 } from "../render/gl/geometria.ts";
import { glPush } from "../render/gl/renderer.ts";
import { gainSkill } from "../hero/nivel.ts";
import { profLv } from "../hero/proficiencias.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import type { GLMesh, Monster } from "../core/tipos.ts";

/** visivel: as pegadas e a seta aparecem (falso até achar as fezes); malhas: pegada e fezes, refeitas se o GL mudar. */
const R = {
  pe: 0,
  visivel: true,
  mesh: null as GLMesh | null,
  fezMesh: null as GLMesh | null,
  sgMesh: null as GLMesh | null,
  gl: null as unknown,
};

/** A presa da caçada viva no campo, ou null. */
function presa(): Monster | null {
  const m = dungeon.foco;
  return m && m.cacada && m.alive ? m : null;
}

/** Nível de Rastreio da heroína do campo. */
const nivel = () => profLv(dungeon.hero, "rastreio");
/** Quanto uma pegada dura (s), com a perícia. */
const vida = () => RASTRO.vida * (1 + RASTRO.vidaNivel * nivel());

function pegada(x: number, y: number, a: number, t: number) {
  const d = dungeon,
    L = (d.pegadas = d.pegadas || []),
    lado = (R.pe++ % 2 ? 1 : -1) * d.tile * 0.09;
  L.push({ x: x - Math.sin(a) * lado, y: y + Math.cos(a) * lado, a, t });
  if (L.length > RASTRO.max) L.shift();
}

/** Um rastro de (x0, y0) até a presa, com uma curva (as pegadas mais longe dela, mais velhas). */
function trilha(x0: number, y0: number, m: Monster) {
  const T = dungeon.tile,
    dx = m.x - x0,
    dy = m.y - y0,
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L,
    passo = RASTRO.passo * T,
    n = Math.max(0, Math.floor(L / passo)),
    V = vida();
  for (let i = 0; i <= n; i++) {
    const s = i * passo,
      curva = Math.sin(i * 0.45) * T * 0.35; // o bicho não anda em linha reta
    pegada(x0 + ux * s - uy * curva, y0 + uy * s + ux * curva, Math.atan2(uy, ux), (1 - i / (n || 1)) * V * 0.5);
  }
}

/** cacadaNoCampo: a presa entrou. Com rastro, ele já leva de perto da heroína até ela; sem, há fezes pelo caminho.
    true = o rastro está visível. */
export function rastroIni(m: Monster) {
  const d = dungeon,
    T = d.tile;
  d.pegadas = [];
  d.fezes = [];
  R.pe = 0;
  const sem = Math.max(RASTRO.semRastroMin, RASTRO.semRastro - RASTRO.porNivel * nivel());
  R.visivel = Math.random() >= sem;
  const a0 = Math.atan2(m.y - d.py, m.x - d.px);
  if (R.visivel) {
    trilha(d.px + Math.cos(a0) * RASTRO.inicio * T, d.py + Math.sin(a0) * RASTRO.inicio * T, m);
    return true;
  }
  for (let i = 0; i < RASTRO.fezes; i++) {
    const [d0, d1] = RASTRO.fezesDist,
      r = (d0 + ((d1 - d0) * (i + Math.random())) / RASTRO.fezes) * T,
      a = a0 + (Math.random() * 2 - 1) * RASTRO.fezesAng;
    d.fezes.push({ x: d.px + Math.cos(a) * r, y: d.py + Math.sin(a) * r });
  }
  return false;
}

/** cacadaAbatida: abater a presa treina Rastreio. */
export function rastroAbate() {
  if (dungeon.hero) gainSkill(dungeon.hero, "rastreio", RASTRO.xpAbate);
}

/** Tique do campo: a presa deixa pegadas por onde anda; as velhas somem; fezes perto revelam o rastro; pisar nas
    pegadas treina Rastreio. */
export function rastroTick(dt: number) {
  const d = dungeon,
    T = d.tile,
    V = vida(),
    L = d.pegadas;
  if (L && L.length) {
    for (const p of L) p.t += dt;
    if (L[0].t > V) d.pegadas = L.filter((p) => p.t <= V);
  }
  sangueTick(dt);
  const m = presa();
  if (!m) return;
  // as fezes: perto de uma, o rastro aparece dali até a presa
  if (!R.visivel && d.fezes)
    for (const f of d.fezes)
      if (Math.hypot(f.x - d.px, f.y - d.py) < (RASTRO.fezesR + RASTRO.fezesNivel * nivel()) * T) {
        R.visivel = true;
        trilha(f.x, f.y, m);
        spawnDungeonToast("💩 Fezes frescas de " + m.name.toLowerCase() + ": o rastro!", f.x, f.y - 26, "#ffd27a", 13);
        if (d.hero) gainSkill(d.hero, "rastreio", RASTRO.xpFezes);
        break;
      }
  // a presa anda: pegada nova (a janela deslizou junto, então mede a partir da última)
  const ref = d.pegadas && d.pegadas.length ? d.pegadas[d.pegadas.length - 1] : null;
  if (!ref || Math.hypot(m.x - ref.x, m.y - ref.y) >= RASTRO.passo * T * 1.15)
    pegada(m.x, m.y, ref ? Math.atan2(m.y - ref.y, m.x - ref.x) : m.ang || 0, 0);
  // seguindo o rastro: cada pegada pisada conta
  if (R.visivel && d.hero && d.pegadas)
    for (const p of d.pegadas)
      if (!p.lida && Math.abs(p.x - d.px) < T * 0.7 && Math.hypot(p.x - d.px, p.y - d.py) < T * 0.7) {
        p.lida = true;
        gainSkill(d.hero, "rastreio", RASTRO.xpLer);
      }
}

/** v8.0 — bicho ferido (flecha, `ferido`) ou sangrando deixa gotas de sangue pelo caminho (dungeon.sangue), que somem
    em RASTRO.sangue.vida s: dá para seguir o bicho que fugiu ferido. */
function sangueTick(dt: number) {
  const d = dungeon,
    S = RASTRO.sangue,
    T = d.tile,
    L = (d.sangue = d.sangue || []);
  for (const g of L) g.t += dt;
  if (L.length && L[0].t > S.vida) d.sangue = L.filter((g) => g.t <= S.vida);
  for (const m of d.monsters) {
    if (!m.alive || !(m.ferido! > 0 || m.bleed || (m.stk && m.stk.length))) continue;
    const u = m._sangue;
    if (u && Math.hypot(m.x - u.x, m.y - u.y) < S.passo * T) continue;
    m._sangue = { x: m.x, y: m.y };
    d.sangue!.push({
      x: m.x + (Math.random() - 0.5) * T * 0.3,
      y: m.y + (Math.random() - 0.5) * T * 0.3,
      a: Math.random() * 6.28,
      t: 0,
    });
    if (d.sangue!.length > S.max) d.sangue!.shift();
  }
}

/** As malhas em 3D (feitas uma vez por contexto GL): a pegada (duas manchas de casco), as fezes (bolinhas) e a gota
    de sangue. */
function malhas() {
  if (R.mesh && R.fezMesh && R.sgMesh && R.gl === D3.gl) return { pe: R.mesh, fez: R.fezMesh, sg: R.sgMesh };
  const sg = MB();
  mbCyl(sg, M4.S(3.6, 0.25, 2.6), "#7a1414", 7, 1);
  mbCyl(sg, M4.ch(M4.T(3.5, 0, 1.4), M4.S(1.6, 0.25, 1.4)), "#7a1414", 6, 1);
  R.sgMesh = glMesh(sg);
  const b = MB(),
    cor = "#3b2c1c";
  mbCyl(b, M4.ch(M4.T(2.8, 0, -2.1), M4.S(4.2, 0.3, 2.9)), cor, 7, 1);
  mbCyl(b, M4.ch(M4.T(2.8, 0, 2.1), M4.S(4.2, 0.3, 2.9)), cor, 7, 1);
  const f = MB();
  for (const [x, z, s] of [
    [0, 0, 3.2],
    [3.4, 1.2, 2.6],
    [-2.6, 2.2, 2.4],
    [1.2, -3, 2.8],
    [-1.4, -1.6, 2.2],
  ])
    mbCyl(f, M4.ch(M4.T(x, 0, z), M4.S(s, s * 0.7, s)), "#4a321c", 6, 0.45);
  R.mesh = glMesh(b);
  R.fezMesh = glMesh(f);
  R.gl = D3.gl;
  return { pe: R.mesh, fez: R.fezMesh, sg: R.sgMesh };
}

/** glFrame: o sangue, as fezes e, com o rastro visível, as pegadas (encolhem no último terço da vida). */
export function rastroGL(naVista: (x: number, z: number) => boolean) {
  const d = dungeon,
    L = d.pegadas,
    F = d.fezes,
    G = d.sangue;
  if ((!L || !L.length || !R.visivel) && (!F || !F.length) && (!G || !G.length)) return;
  const ms = malhas(),
    V = vida(),
    VS = RASTRO.sangue.vida;
  if (G)
    for (const g of G) {
      if (!naVista(g.x, g.y)) continue;
      const s = Math.min(1, ((VS - g.t) / VS) * 3);
      if (s > 0.05) glPush(ms.sg, M4.ch(M4.T(g.x, 0.12, g.y), M4.RY(g.a), M4.S(s, 1, s)), null, false);
    }
  if (F) for (const f of F) if (naVista(f.x, f.y)) glPush(ms.fez, M4.T(f.x, 0, f.y), null, false);
  if (!R.visivel || !L) return;
  for (const p of L) {
    if (!naVista(p.x, p.y)) continue;
    const s = Math.min(1, ((V - p.t) / V) * 3);
    if (s <= 0.05) continue;
    glPush(ms.pe, M4.ch(M4.T(p.x, 0.15, p.y), M4.RY(-p.a), M4.S(s, 1, s)), null, false);
  }
}

/** Desenho 2D por cima: a seta na borda da tela quando a presa está fora da vista. */
export function rastroDraw2D() {
  const m = presa(),
    c = TELAS.dCtx;
  if (!m || !R.visivel || !D3.on || !D3.cw || !c) return; // sem rastro ainda: nada de seta
  const W = D3.cw,
    H = D3.ch,
    sx = W / 2 + (m.x - D3.cx) * D3.s,
    sy = H / 2 + D3.vy + (m.y - D3.cz) * D3.SIN! * D3.s,
    mg = 34;
  if (sx > mg && sy > mg && sx < W - mg && sy < H - mg) return;
  const cx = W / 2,
    cy = H / 2,
    a = Math.atan2(sy - cy, sx - cx),
    k = Math.min((W / 2 - mg) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - mg) / Math.abs(Math.sin(a) || 1e-6)),
    x = cx + Math.cos(a) * k,
    y = cy + Math.sin(a) * k,
    passos = Math.round(Math.hypot(m.x - dungeon.px, m.y - dungeon.py) / dungeon.tile),
    pulso = 0.75 + 0.25 * Math.sin(performance.now() / 260);
  c.save();
  c.setTransform(D3.dpr, 0, 0, D3.dpr, 0, 0);
  c.translate(x, y);
  c.globalAlpha = pulso;
  c.save();
  c.rotate(a);
  c.fillStyle = RASTRO.seta;
  c.strokeStyle = "rgba(30,20,8,.85)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(16, 0);
  c.lineTo(-8, -11);
  c.lineTo(-3, 0);
  c.lineTo(-8, 11);
  c.closePath();
  c.stroke();
  c.fill();
  c.restore();
  c.globalAlpha = 1;
  c.font = "600 11px Lora,serif";
  c.textAlign = "center";
  c.lineJoin = "round";
  c.lineWidth = 3;
  const tx = -Math.cos(a) * 24,
    ty = -Math.sin(a) * 24 + 4,
    txt = "🐾 " + passos;
  c.strokeText(txt, tx, ty);
  c.fillStyle = "#ffe8b0";
  c.fillText(txt, tx, ty);
  c.restore();
}
