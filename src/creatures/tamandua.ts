/* ==== Fase 4 — tamanduá-bandeira: montaria, domar, painel, companheiro (v5.9.04) ==== */
import { bichoAnimado, marcaBicho } from "../render/gl/bichos.ts";
import { econ, GL3, dungeon, world, camera, TELAS } from "../core/state.ts";
import { TCOATS, MOUNT } from "../data/sobrevivencia.ts";
import { MALHA, M4 } from "../render/gl/geometria.ts";
import { MB, mbIco, mbBox, mbCyl, gmix, glMesh, gcol } from "../render/gl/malhas.ts";
import { glPush } from "../render/gl/renderer.ts";
import { ITEM_DEFS, SUB } from "../data/itens.ts";
import { esc } from "../core/util.ts";
import { INV } from "../items/inventario.ts";
import { renderInvGrid, sfx, renderInv } from "../field/chao.ts";
import { mountHero, bestHero } from "../hero/proficiencias.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mvToast } from "../ui/avisos.ts";
import { gainSkill } from "../hero/nivel.ts";
import { CONFIG } from "../core/config.ts";
import { termiteList, termiteAt } from "../sim/cupinzeiros.ts";
import { campPos, camZoomTo, campMeatStock, campTake, CPS } from "../survival/acampamento.ts";
import { tameCheatBtn } from "../ui/gameshark.ts";
import { icoImg } from "../ui/icones.ts";
import { prep } from "../econ/economia.ts";
import { renderPrep } from "../expedicao/preparo.ts";
import { spawnDungeonToast } from "../field/masmorra.ts";
import { D3 } from "../field/projecao.ts";
import type { GradeTela, Hero, Montaria, Ponto, Tamandua } from "../core/tipos.ts";

export function mnt() {
  const m = econ.mount || null;
  if (m && !m.coat) m.coat = "selvagem";
  return m;
}

export function coatOf(x: { coat?: string } | null | undefined) {
  const k = (x && x.coat) || "selvagem";
  return TCOATS[k] ? k : "selvagem";
}
/* modelo 3D */
function tamMesh(co: string) {
  co = co || "selvagem";
  if (GL3.mesh["tamBody_" + co]) return;
  const C = TCOATS[co] || TCOATS.selvagem,
    prev = MALHA._icoBoost;
  MALHA._icoBoost = 1;
  MALHA._gs = 4242;
  const b = MB(),
    fur = C.fur,
    dark = C.dark,
    light = C.light;
  mbIco(b, M4.ch(M4.T(-2, 23, 0), M4.S(48, 22, 21)), fur, 1, 0.1, 0.06);
  mbIco(b, M4.ch(M4.T(12, 26, 0), M4.S(24, 20, 20)), fur, 1, 0.1, 0.05);
  mbBox(b, M4.ch(M4.T(9, 26, 0), M4.RZ(0.55), M4.S(6.5, 24, 21.6)), dark, 1);
  mbBox(b, M4.ch(M4.T(13.6, 28.5, 0), M4.RZ(0.55), M4.S(2.6, 20, 21.2)), light, 1);
  mbIco(b, M4.ch(M4.T(27, 24, 0), M4.S(15, 12, 11)), fur, 1, 0.08);
  mbCyl(b, M4.ch(M4.T(32, 23.5, 0), M4.RZ(-Math.PI / 2 + 0.16), M4.S(7, 27, 7)), C.snout, 8, 0.22, 0.04);
  if (C.spots)
    for (const [sx, sy, sz, sr] of [
      [-14, 30, 8, 7],
      [-4, 22, -10, 6],
      [4, 31, -6, 5],
      [-20, 20, -7, 6],
      [16, 21, 9, 4.5],
    ])
      mbIco(b, M4.ch(M4.T(sx, sy, sz), M4.S(sr * 1.6, sr, sr * 1.2)), C.spots, 0, 0.2);
  for (const s of [-1, 1]) {
    mbBox(b, M4.ch(M4.T(25, 30, s * 4), M4.S(2.5, 3.5, 2)), "#4a4239");
    mbIco(b, M4.ch(M4.T(31, 26, s * 4.6), M4.S(1.6, 1.6, 1.6)), "#111");
  }
  mbIco(b, M4.ch(M4.T(-31, 24, 0), M4.RZ(0.4), M4.S(30, 19, 9)), C.tail, 1, 0.28, 0.08);
  mbIco(b, M4.ch(M4.T(-40, 19, 0), M4.RZ(0.2), M4.S(16, 12, 6)), gmix(C.tail, "#000000", 0.15), 1, 0.3);
  mbBox(b, M4.ch(M4.T(0, 34.5, 0), M4.S(17, 3, 19)), "#6b3f1e", 1, 0.04);
  mbBox(b, M4.ch(M4.T(0, 36.5, 0), M4.S(11, 2.5, 13)), "#8a5528", 0.8);
  mbBox(b, M4.ch(M4.T(6, 38, 0), M4.S(2.5, 4, 2.5)), "#5a3418");
  for (const s of [-1, 1]) {
    mbBox(b, M4.ch(M4.T(-8, 25, s * 12), M4.S(11, 10, 3.5)), "#7a4a24", 1, 0.05);
    mbBox(b, M4.ch(M4.T(-8, 29.5, s * 12.2), M4.S(11.4, 1.6, 3.8)), "#5a3418");
  }
  const tb = glMesh(b);
  tb.ol = true;
  GL3.mesh["tamBody_" + co] = tb;
  const l = MB();
  mbCyl(l, M4.ch(M4.T(0, -15, 0), M4.S(6, 15, 6)), fur, 7, 0.9, 0.04);
  mbIco(l, M4.ch(M4.T(1.5, -15, 0), M4.S(7, 3, 6)), dark, 0, 0.1);
  const lm = glMesh(l);
  lm.ol = true;
  GL3.mesh["tamLeg_" + co] = lm;
  MALHA._icoBoost = prev;
}
/* v7.7 — sela e alforjes do modelo novo, centrados no alto das costas (y=0 = as costas) */
const TAM_SELA = { escala: 1, atras: 4, alturaHeroi: 22, quadril: 13, cintura: 21 }; // a heroína montada fica a alturaHeroi abaixo do topo da sela
function tamSela(co: string) {
  const k = "tamSela_" + co;
  if (GL3.mesh[k]) return GL3.mesh[k];
  MALHA._gs = 4243;
  const b = MB();
  mbBox(b, M4.ch(M4.T(0, 1, 0), M4.S(17, 3, 19)), "#6b3f1e", 1, 0.04);
  mbBox(b, M4.ch(M4.T(0, 3, 0), M4.S(11, 2.5, 13)), "#8a5528", 0.8);
  mbBox(b, M4.ch(M4.T(6, 4.5, 0), M4.S(2.5, 4, 2.5)), "#5a3418");
  for (const s of [-1, 1]) {
    mbBox(b, M4.ch(M4.T(-8, -8.5, s * 12), M4.S(11, 10, 3.5)), "#7a4a24", 1, 0.05);
    mbBox(b, M4.ch(M4.T(-8, -4, s * 12.2), M4.S(11.4, 1.6, 3.8)), "#5a3418");
  }
  const m = glMesh(b);
  m.ol = true;
  return (GL3.mesh[k] = m);
}
/** Altura dos pés da heroína montada (o topo da sela − TAM_SELA.alturaHeroi); 27 no tamanduá de peças. */
export function alturaMontada() {
  const s = marcaBicho("tamandua", "sela");
  if (!s) return 27;
  // modelo com as mochilas (marca "carga"): ela senta em cima da carga, o quadril (15 acima dos pés) no topo
  if (marcaBicho("tamandua", "carga")) return s[1] - TAM_SELA.quadril;
  return s[1] + 4.5 * TAM_SELA.escala - TAM_SELA.alturaHeroi;
}
/** v7.7 — pés da heroína animada montada: a cintura (TAM_SELA.cintura acima dos pés) no alto da carga/sela; as pernas
    ficam dentro do tamanduá (provisório, até o esqueleto sentado). */
export function alturaMontadaAnim() {
  const s = marcaBicho("tamandua", "sela");
  return s ? s[1] - TAM_SELA.cintura : 20;
}
const TONS_TAM: Record<string, number[]> = {};
/** O tom de uma pelagem (TCOATS) sobre o modelo, que é a selvagem: a cor do pelo ÷ a da selvagem. */
function tomTamandua(co: string) {
  if (co === "selvagem") return null;
  if (!TONS_TAM[co]) {
    const base = gcol(TCOATS.selvagem.fur),
      c = gcol((TCOATS[co] || TCOATS.selvagem).fur);
    TONS_TAM[co] = [0, 1, 2].map((i) => c[i] / base[i]);
  }
  return TONS_TAM[co];
}
export function mountGL() {
  const d = dungeon,
    M = d.mount;
  if (!M || !GL3.gl) return;
  const co = coatOf(mnt()),
    dirt = (mnt() || {}).dirt || 0,
    tint = dirt > 30 ? [0.32, 0.22, 0.12, Math.min(0.35, (dirt - 30) / 200)] : null;
  /* v7.7 — o modelo novo (tools/gerar-tamandua.ts → render/gl/bichos.ts), animado como os outros bichos (parado, andar,
     correr, pastar ao fuçar). O modelo é deslocado para a sela ("sela") cair na posição do tamanduá: é ali que o herói
     montado senta. A sela e os alforjes vão por cima. Sem os dados (testes em Node), o tamanduá de peças de antes. */
  {
    const sela = marcaBicho("tamandua", "sela");
    const ma = sela
      ? bichoAnimado(M, "tamandua", M.x, M.y, { pastar: !!M.forage && !M.mounted, tom: tomTamandua(co) })
      : null;
    if (ma && sela) {
      const atras = marcaBicho("tamandua", "carga") ? 0 : TAM_SELA.atras,
        A = M4.ch(M4.T(M.x, 0, M.y), M4.RY(-M.ang), M4.T(-sela[0] + atras, 0, 0));
      glPush(ma, A, tint);
      if (!marcaBicho("tamandua", "carga"))
        glPush(tamSela(co), M4.ch(A, M4.T(sela[0] - TAM_SELA.atras, sela[1], 0), M4.S(TAM_SELA.escala)), tint);
      return;
    }
  }
  tamMesh(co);
  const sw = Math.sin(M.ph) * Math.min(0.55, M.mv * 0.25 + (M.mv > 0 ? 0.25 : 0)),
    bob = Math.abs(Math.cos(M.ph)) * (M.mv > 0 ? 1.2 : 0),
    graze = M.forage ? 0.2 + Math.sin(performance.now() / 160) * 0.06 : 0;
  const A = M4.ch(M4.T(M.x, bob, M.y), M4.RY(-M.ang), M4.S(1.3));
  glPush(GL3.mesh["tamBody_" + co], M4.ch(A, M4.T(20, 0, 0), M4.RZ(-graze), M4.T(-20, 0, 0)), tint);
  for (const [lx, lz, s] of [
    [15, 6.5, 1],
    [15, -6.5, -1],
    [-17, 6.5, -1],
    [-17, -6.5, 1],
  ])
    glPush(GL3.mesh["tamLeg_" + co], M4.ch(A, M4.T(lx, 15, lz), M4.RZ(sw * s)), tint);
}

export function mountLv(m?: Montaria | null) {
  m = m || mnt();
  if (!m) return 0;
  let l = 1;
  for (let i = 1; i < MOUNT.lvXp.length; i++) if ((m.xp || 0) >= MOUNT.lvXp[i]) l = i + 1;
  return l;
}
export function mountBag() {
  const m = mnt();
  if (!m) return null;
  const [c, r] = MOUNT.bag[mountLv(m) - 1];
  if (!m.bag) m.bag = { cols: c, rows: r, items: [] };
  m.bag.cols = Math.max(m.bag.cols, c);
  m.bag.rows = Math.max(m.bag.rows, r);
  m.bag.saddle = true;
  for (const it of m.bag.items)
    if (it.def && ITEM_DEFS[it.def.key] && it.def !== ITEM_DEFS[it.def.key]) it.def = ITEM_DEFS[it.def.key];
  return m.bag;
}

/* ---------- MASMORRA / ACAMPAMENTO: companheiro e montaria ---------- */
/* v7.7 — perto do tamanduá = perto do CORPO (do quadril ao focinho, ao longo de onde ele olha), não do meio das costas:
   o modelo novo é comprido e, medido do centro, o alcance de 2,1 tiles pegava longe demais */
const MONTAR = { frente: 40, tras: 30, alcance: 28 }; // unidades do jogo (tile = 42)
export function mountNear(r?: number) {
  const d = dungeon,
    M = d.mount;
  if (!M) return false;
  const fx = Math.cos(M.ang || 0),
    fy = Math.sin(M.ang || 0),
    t = Math.max(-MONTAR.tras, Math.min(MONTAR.frente, (d.px - M.x) * fx + (d.py - M.y) * fy));
  return Math.hypot(d.px - (M.x + fx * t), d.py - (M.y + fy * t)) < (r ?? MONTAR.alcance);
}
/* alforjes dentro da mochila da masmorra (quando ele está perto) */
/* alforjes do tamanduá na mochila da masmorra (renderInv chama) */
export function alforjeRender() {
  const d = dungeon;
  if (d.active && d.invOpen) {
    const bags = document.getElementById("inv-bags");
    if (!bags) return;
    let col = document.getElementById("ib-saddle");
    if (!col) {
      col = document.createElement("div");
      col.id = "ib-saddle";
      col.className = "ib-e";
      col.innerHTML = "<div id='inv-saddle' class='gridbox'></div>";
      bags.appendChild(col);
    }
    const show = !!(d.mount && (d.mount.mounted || mountNear(d.tile * 2)));
    col.style.display = show ? "" : "none";
    bags.classList.toggle("with-saddle", show);
    let lab = document.getElementById("inv-saddle-lab");
    const foot = document.getElementById("inv-labels");
    if (foot && !lab) {
      lab = document.createElement("span");
      lab.id = "inv-saddle-lab";
      foot.appendChild(lab);
    }
    if (lab)
      lab.innerHTML = d.mount
        ? show
          ? "🐾 <b>Alforjes de " + esc(mnt()!.name) + "</b> (à direita)"
          : "🐾 Alforjes: chegue perto de " + esc(mnt()!.name) + " (T assobia)"
        : "";
    if (show) {
      const gr = { el: document.getElementById("inv-saddle")!, inv: mountBag()!, discard: false };
      INV.invGrids.push(gr);
      renderInvGrid(gr);
    }
  }
}

/* =====================================================================
   v5.9.04 — TAMANDUÁ-BANDEIRA GIGANTE (montaria, inspirado no cavalo do RDR2)
   · Selvagens perto dos cupinzeiros do mapa: clique para DOMAR (minigame de equilíbrio).
   · Leal e obediente: segue você, vem quando você ASSOBIA (T), nunca foge de vez.
   · Montaria (T perto dele): bem mais rápido, anda em todos os terrenos (atravessa rio).
   · Aguenta muito peso: ALFORJES (baú que anda) — na masmorra aparecem na mochila
     quando ele está perto; nas viagens leva carga extra do baú.
   · VÍNCULO (nível 1–4): sobe escovando, alimentando (cupins), viajando e lutando junto.
     Quanto maior o vínculo, mais rápido, mais espaço nos alforjes e mais difícil te derrubar.
===================================================================== */
export function tamRollCoat() {
  const K = Object.keys(TCOATS);
  let r = Math.random() * K.reduce((a, k) => a + TCOATS[k].w, 0);
  for (const k of K) {
    r -= TCOATS[k].w;
    if (r <= 0) return k;
  }
  return "selvagem";
}
export function mountXp(n: number, why: string) {
  /* v5.9.05 */
  {
    const h = mountHero();
    if (h) gainSkill(h, "domador", n * 3);
  }
  const m = mnt();
  if (!m) return;
  const l0 = mountLv(m);
  m.xp = (m.xp || 0) + n;
  const l1 = mountLv(m);
  if (l1 > l0) {
    pushEvent("🐾 O vínculo com " + m.name + " subiu para o nível " + l1 + "! (" + why + ")");
    try {
      mvToast("🐾 Vínculo nível " + l1 + " com " + m.name);
    } catch (_) {}
  }
}
export function mountDay() {
  return Math.floor((world.tick || 0) / CONFIG.DAY_MIN);
}

/* ---------- desenho 2D (mapa) ---------- */
export function drawAnteater2D(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  face: number,
  saddle: boolean,
  t: number,
  coat: string | null | undefined,
) {
  const C = TCOATS[coat!] || TCOATS.selvagem,
    fl = face < 0 ? -1 : 1,
    step = Math.sin((t || 0) * 6) * 0.8;
  c.save();
  c.translate(x, y);
  c.scale(fl * s, s);
  c.fillStyle = "rgba(30,20,10,.25)";
  c.beginPath();
  c.ellipse(0, 4.2, 10, 2.2, 0, 0, 6.283);
  c.fill();
  c.fillStyle = C.tail;
  c.beginPath();
  c.moveTo(-6, -2);
  c.quadraticCurveTo(-15, -9, -14, 1);
  c.quadraticCurveTo(-11, 3, -6, 1);
  c.closePath();
  c.fill(); // cauda peluda
  c.strokeStyle = C.dark;
  c.lineWidth = 1.5;
  for (const [lx, o] of [
    [-4, step],
    [-2, -step],
    [4, -step],
    [6, step],
  ]) {
    c.beginPath();
    c.moveTo(lx, 0);
    c.lineTo(lx + o, 4);
    c.stroke();
  }
  c.fillStyle = C.fur;
  c.beginPath();
  c.ellipse(0, -2, 8, 4.2, 0, 0, 6.283);
  c.fill();
  if (C.spots) {
    c.fillStyle = C.spots;
    for (const [sx, sy, sr] of [
      [-4, -3, 1.8],
      [-1, -1, 1.3],
      [2, -4, 1.1],
      [-6, -1, 1.2],
    ]) {
      c.beginPath();
      c.arc(sx, sy, sr, 0, 6.283);
      c.fill();
    }
  }
  c.fillStyle = C.dark;
  c.beginPath();
  c.moveTo(1, -6);
  c.lineTo(4, -6);
  c.lineTo(7, 1);
  c.lineTo(4, 1);
  c.closePath();
  c.fill();
  c.fillStyle = C.light;
  c.beginPath();
  c.moveTo(4, -6);
  c.lineTo(5, -6);
  c.lineTo(8, 0.5);
  c.lineTo(7, 1);
  c.closePath();
  c.fill();
  c.fillStyle = C.snout;
  c.beginPath();
  c.moveTo(6.5, -4);
  c.quadraticCurveTo(10, -4.5, 16, -1);
  c.lineTo(16, 0);
  c.quadraticCurveTo(10, -1, 6.5, -1);
  c.closePath();
  c.fill(); // focinho comprido
  c.fillStyle = "#1a1612";
  c.beginPath();
  c.arc(9, -3.1, 0.6, 0, 6.283);
  c.fill();
  if (saddle) {
    c.fillStyle = "#7a4520";
    c.fillRect(-3.5, -6.5, 6, 2.4);
    c.fillStyle = "#5a3418";
    c.fillRect(-4.5, -4.5, 3, 4);
  }
  c.restore();
}
export function wildAnteaters() {
  if (!world.anteaters || !world.anteaters.length) {
    const L = termiteList();
    world.anteaters = [];
    if (!L.length) return world.anteaters;
    const pick = L.slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(5, Math.round(L.length * 0.22)));
    for (const t of pick)
      world.anteaters.push({
        id: "ta" + Math.floor(Math.random() * 1e7),
        hx: t.x,
        hy: t.y,
        seed: Math.random() * 6.28,
        r: 8 + Math.random() * 6,
        coat: tamRollCoat(),
      });
  }
  for (const a of world.anteaters) if (!a.coat) a.coat = tamRollCoat();
  return world.anteaters;
}
export function wildPos(a: Tamandua) {
  const k = (world.tick || 0) * 0.0035 + a.seed;
  return { x: a.hx + Math.cos(k) * a.r, y: a.hy + 6 + Math.sin(k) * a.r * 0.55, face: -Math.sin(k) };
}
export function mountMapPos() {
  const m = mnt();
  if (!m) return null;
  const h = m.with && world.heroes.find((x) => x.id === m.with);
  if (h && h.state !== "idle" && h.state !== "indungeon")
    return { x: h.x - 4, y: h.y + 6, face: h.trip ? h.trip.to!.x - h.x : 1, ridden: true, h };
  const p = campPos();
  return p ? { x: p.x + 20, y: p.y - 6, face: -1 } : null;
}
export function anteaterClick(wx: number, wy: number) {
  const r = Math.max(9, 14 / camera.scale),
    mp = mountMapPos();
  if (mp && !mp.ridden && Math.hypot(mp.x - wx, mp.y - wy) < r) {
    mountPanel();
    return true;
  }
  for (const a of wildAnteaters()) {
    const p = wildPos(a);
    if (Math.hypot(p.x - wx, p.y - wy) < r) {
      tameStart(a);
      return true;
    }
  }
  const tm = termiteAt(wx, wy);
  if (tm && mnt()) {
    const d = mountDay();
    if (tm.cupDay === d) mvToast("🐜 Esse cupinzeiro já foi raspado hoje.");
    else {
      tm.cupDay = d;
      econ.cupim = (econ.cupim || 0) + 2;
      mvToast("🐜 +2 cupins para " + mnt()!.name + " (agora " + econ.cupim + ")");
    }
    return true;
  }
  return false;
}

/* ---------- DOMAR (minigame de equilíbrio, como amansar cavalo) ---------- */
interface EstadoTAME {
  open: boolean;
  g: DomaJogo | null;
  a: Tamandua | null; // o tamanduá selvagem sendo domado
  raf: number;
  keys: Record<string, boolean>; // teclas apertadas (L, R)
  // acrescentados depois
  h?: Hero | null;
  res?: string | null;
}
/** O equilíbrio em cima do tamanduá (tameGo): posição, velocidade, calma e o próximo coice. */
interface DomaJogo {
  pos: number;
  vel: number;
  calm: number;
  kick: number;
  last: number;
  t: number;
  txt: { t: string; k: number } | null;
  anim?: { t: number; a: number | string; b: number | string } | null; // quadros da animação do coice
}
export const TAME: EstadoTAME = { open: false, g: null, a: null, raf: 0, keys: {} };
export function tameStart(a: Tamandua) {
  /* v5.9.05 */
  TAME.h = bestHero(
    "domador",
    world.heroes.filter((h) => h.state === "idle"),
  );
  if (mnt()) {
    mvToast("🐾 Você já tem um tamanduá: " + mnt()!.name + " (clique nele no acampamento).");
    return;
  }
  if (!world.heroes.some((h) => h.state === "idle")) {
    mvToast("Precisa de alguém livre no acampamento para ir domar.");
    return;
  }
  const p = wildPos(a);
  TAME.a = a;
  camZoomTo(p.x, p.y, Math.max(camera.scale * 2.5, camera.minScale * 9), 650, () => tameOpen());
}
function tameEnsure() {
  if (document.getElementById("tame-modal")) return;
  const m = document.createElement("div");
  m.id = "tame-modal";
  m.className = "v3-modal";
  m.innerHTML =
    '<div class="v3-card" id="tame-card"><div class="mt-head"><b>🐾 Domar o tamanduá-bandeira</b><button class="btn" id="tame-x">✕</button></div><canvas id="tame-cv" width="460" height="320"></canvas><p id="tame-tip"></p><div id="tame-btns"></div></div>';
  document.body.appendChild(m);
  (m.querySelector("#tame-x") as HTMLElement).onclick = tameClose;
  m.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest("[data-tk]") as HTMLElement;
    if (b) {
      e.preventDefault();
      TAME.keys[b.dataset.tk!] = true;
    }
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"])
    m.addEventListener(ev, (e) => {
      const b = ((e.target as HTMLElement).closest && (e.target as HTMLElement).closest("[data-tk]")) as HTMLElement;
      if (b) TAME.keys[b.dataset.tk!] = false;
      else if (ev !== "pointerleave") TAME.keys = {};
    });
  m.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-ta]") as HTMLElement;
    if (!b) return;
    if (b.dataset.ta === "go") tameGo();
    else if (b.dataset.ta === "name") tameName();
    else if (b.dataset.ta === "win") tameWin();
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!TAME.open || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "Escape") {
        tameClose();
        return;
      }
      const k =
        e.code === "KeyA" || e.code === "ArrowLeft" ? "L" : e.code === "KeyD" || e.code === "ArrowRight" ? "R" : null;
      if (k) {
        e.preventDefault();
        e.stopPropagation();
        TAME.keys[k] = true;
      }
    },
    true,
  );
  window.addEventListener("keyup", (e) => {
    const k =
      e.code === "KeyA" || e.code === "ArrowLeft" ? "L" : e.code === "KeyD" || e.code === "ArrowRight" ? "R" : null;
    if (k) TAME.keys[k] = false;
  });
}
function tameOpen() {
  tameEnsure();
  TAME.open = true;
  TAME.g = null;
  TAME.res = null;
  document.getElementById("tame-modal")!.classList.add("open");
  document.getElementById("tame-tip")!.innerHTML =
    "Ele vai pinotear para os lados. Segure <b>A</b> / <b>D</b> (ou ← → ou os botões) para jogar o peso contra o pinote e manter o ponteiro na <b>faixa verde</b>. Lá dentro ele vai se acalmando; se o ponteiro bater na ponta, você cai.";
  document.getElementById("tame-btns")!.innerHTML =
    "<button class='btn pri' data-ta='go'>🐾 Montar e acalmar</button>" + tameCheatBtn();
  tameDraw(0);
}
function tameClose() {
  TAME.open = false;
  TAME.g = null;
  TAME.keys = {};
  cancelAnimationFrame(TAME.raf);
  const m = document.getElementById("tame-modal");
  if (m) m.classList.remove("open");
}
export function tameGo() {
  TAME.res = null;
  TAME.g = { pos: 0, vel: 0, calm: 0, kick: 0.8, last: performance.now(), t: 0, txt: null };
  document.getElementById("tame-btns")!.innerHTML =
    "<button class='btn' data-tk='L'>⬅ A</button><button class='btn' data-tk='R'>D ➡</button>";
  cancelAnimationFrame(TAME.raf);
  TAME.raf = requestAnimationFrame(tameLoop);
}
function tameLoop(now: number) {
  const g = TAME.g;
  if (!g || !TAME.open) return;
  TAME.raf = requestAnimationFrame(tameLoop);
  const dt = Math.min(0.05, (now - g.last) / 1000);
  g.last = now;
  g.t += dt;
  const ph = g.calm < 34 ? 1 : g.calm < 67 ? 2 : 3;
  g.kick -= dt;
  if (g.kick <= 0) {
    g.kick = 0.55 + Math.random() * (1.1 - ph * 0.15);
    const dir = Math.random() < 0.5 ? -1 : 1;
    g.vel += dir * (0.55 + 0.28 * ph) * (0.7 + Math.random() * 0.6);
    const sq =
      dir < 0
        ? Math.random() < 0.55
          ? [8, 9, "Giro para a esquerda!"]
          : [2, 3, "Abaixou a cabeça — coice!"]
        : Math.random() < 0.55
          ? [10, 11, "Giro para a direita!"]
          : [5, 6, "Ergueu a frente!"];
    g.anim = { a: sq[0], b: sq[1], t: 0 };
    g.txt = { t: ph === 3 ? "Coice forte! " : (sq[2] as string), k: 1 };
  }
  if (TAME.keys.L) g.vel -= 4.4 * dt;
  if (TAME.keys.R) g.vel += 4.4 * dt;
  g.vel += Math.sin(g.t * 2.3) * 0.15 * ph * dt;
  g.vel *= Math.exp(-1.5 * dt);
  g.pos += g.vel * dt;
  const zone = 0.4;
  if (Math.abs(g.pos) < zone) g.calm = Math.min(100, g.calm + 19 * dt);
  else g.calm = Math.max(0, g.calm - 4 * dt);
  if (g.anim) {
    g.anim.t += dt;
    if (g.anim.t > 0.7) g.anim = null;
  }
  if (g.txt) g.txt.k -= dt;
  if (Math.abs(g.pos) >= 1) {
    tameFail();
    return;
  }
  if (g.calm >= 100) {
    tameWin();
    return;
  }
  tameDraw(g.t);
}
function tameDraw(t: number) {
  const cv = document.getElementById("tame-cv") as HTMLCanvasElement;
  if (!cv) return;
  const c = cv.getContext("2d")!,
    W = cv.width,
    H = cv.height,
    g = TAME.g || ({ pos: 0, calm: TAME.res === "win" ? 100 : 0 } as DomaJogo);
  c.fillStyle = "#17110b";
  c.fillRect(0, 0, W, H);
  let fk = "01";
  if (TAME.res === "fail") fk = "fail";
  else if (TAME.res === "win") fk = "ok";
  else if (TAME.g) {
    if (g.anim) fk = String(g.anim.t < 0.28 ? g.anim.a : g.anim.b).padStart(2, "0");
    else {
      const ap = Math.abs(g.pos);
      fk =
        ap >= 0.72 ? "06" : ap >= 0.25 ? (g.pos < 0 ? "09" : "11") : Math.floor((t || 0) * 1.5) % 4 === 3 ? "07" : "01";
    }
  }
  const im = icoImg("tam_rodeo_" + fk);
  if (im) {
    const fh = 236,
      fw = Math.min(W - 20, (fh * im.naturalWidth) / im.naturalHeight);
    c.save();
    c.translate(W / 2, 4 + fh / 2);
    c.rotate((TAME.g ? g.pos : 0) * 0.07);
    c.drawImage(im, -fw / 2, -fh / 2, fw, fh);
    c.strokeStyle = TAME.res === "win" ? "#6fd36a" : TAME.res === "fail" ? "#d04a3a" : "#5a4528";
    c.lineWidth = 3;
    c.strokeRect(-fw / 2, -fh / 2, fw, fh);
    c.restore();
  } else {
    c.save();
    c.translate(W / 2, 200);
    drawAnteater2D(c, 0, 0, 7, 1, true, (t || 0) * 0.5, TAME.a && TAME.a.coat);
    c.restore();
  }
  if (TAME.g && !g.anim && Math.abs(g.pos) > 0.2) {
    const k = g.pos > 0 ? "A" : "D",
      ar = g.pos > 0 ? "⬅" : "➡",
      x = W / 2 - 34,
      y = 196;
    c.fillStyle = "rgba(20,16,12,.85)";
    c.strokeStyle = "#c9b88a";
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect ? c.roundRect(x, y, 68, 34, 6) : c.rect(x, y, 68, 34);
    c.fill();
    c.stroke();
    c.fillStyle = "#f3e6c8";
    c.font = "bold 20px Lora,serif";
    c.textAlign = "center";
    c.fillText(g.pos > 0 ? k + " " + ar : ar + " " + k, W / 2, y + 24);
  }
  if (TAME.g && g.txt && g.txt.k > 0) {
    c.save();
    c.globalAlpha = Math.min(1, g.txt.k * 2);
    c.fillStyle = "#ffd27a";
    c.font = "bold 15px Cinzel,serif";
    c.textAlign = "center";
    c.shadowColor = "#000";
    c.shadowBlur = 6;
    c.fillText(g.txt.t, W / 2, 30);
    c.restore();
  }
  // barra de equilíbrio (estilo do conceito): risco de queda | estável | risco de queda
  const by = 256,
    bx = 62,
    bw = W - 124,
    bh = 16,
    sl = icoImg("tam_rodeo_sl"),
    sr = icoImg("tam_rodeo_sr");
  if (sl) c.drawImage(sl, 8, by - 18, 46, 48);
  if (sr) c.drawImage(sr, W - 54, by - 18, 46, 48);
  const gr = c.createLinearGradient(bx, 0, bx + bw, 0);
  gr.addColorStop(0, "#c8281e");
  gr.addColorStop(0.18, "#5a2a1a");
  gr.addColorStop(0.3, "#2e4a24");
  gr.addColorStop(0.5, "#46b04a");
  gr.addColorStop(0.7, "#2e4a24");
  gr.addColorStop(0.82, "#5a2a1a");
  gr.addColorStop(1, "#c8281e");
  c.fillStyle = gr;
  c.beginPath();
  c.moveTo(bx - 8, by + bh / 2);
  c.lineTo(bx, by);
  c.lineTo(bx + bw, by);
  c.lineTo(bx + bw + 8, by + bh / 2);
  c.lineTo(bx + bw, by + bh);
  c.lineTo(bx, by + bh);
  c.closePath();
  c.fill();
  c.strokeStyle = "#8a7a5a";
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = "rgba(120,255,140,.25)";
  c.fillRect(bx + bw * 0.3, by + 2, bw * 0.4, bh - 4);
  const nx = bx + bw * (0.5 + Math.max(-1, Math.min(1, g.pos)) * 0.5);
  c.fillStyle = "#fffbe8";
  c.shadowColor = "#fff";
  c.shadowBlur = 6;
  c.fillRect(nx - 2.5, by - 6, 5, bh + 12);
  c.shadowBlur = 0;
  c.font = "9px Lora,serif";
  c.textAlign = "center";
  c.fillStyle = "#e05a4a";
  c.fillText("RISCO DE QUEDA", bx + bw * 0.1, by + bh + 12);
  c.fillText("RISCO DE QUEDA", bx + bw * 0.9, by + bh + 12);
  c.fillStyle = "#7ad36e";
  c.fillText("ESTÁVEL", bx + bw / 2, by + bh + 12);
  c.fillStyle = "#c9b88a";
  c.fillText("A ⬅", 31, by + 40);
  c.fillText("➡ D", W - 31, by + 40);
  c.fillStyle = "rgba(0,0,0,.5)";
  c.fillRect(bx, by + 32, bw, 8);
  c.fillStyle = "#9fe08a";
  c.fillRect(bx, by + 32, (bw * g.calm) / 100, 8);
  c.fillStyle = "#e9dcc0";
  c.font = "11px Lora,serif";
  c.fillText("calma " + Math.round(g.calm) + "%", W / 2, by + 54);
}
function tameFail() {
  cancelAnimationFrame(TAME.raf);
  TAME.g = null;
  TAME.res = "fail";
  TAME.keys = {};
  sfx("fail");
  document.getElementById("tame-tip")!.innerHTML =
    "💥 <b>Ele te derrubou!</b> Tamanduá-bandeira é teimoso — tente de novo, jogando o peso contra o pinote.";
  document.getElementById("tame-btns")!.innerHTML =
    "<button class='btn pri' data-ta='go'>🐾 Tentar de novo</button>" + tameCheatBtn();
  tameDraw(0);
  /* v5.9.05 */
  if (TAME.h) gainSkill(TAME.h, "domador", 2);
}
export function tameWin() {
  cancelAnimationFrame(TAME.raf);
  TAME.g = null;
  TAME.res = "win";
  TAME.keys = {};
  sfx("perfect");
  const nm = MOUNT.names[Math.floor(Math.random() * MOUNT.names.length)];
  const cz = TCOATS[(TAME.a && TAME.a.coat) || "selvagem"];
  document.getElementById("tame-tip")!.innerHTML =
    "🐾 <b>Ele se acalmou e deixou você montar!</b> Pelagem <b>" +
    cz.n +
    "</b> <small>(" +
    cz.r +
    ")</small>. Dê um nome:";
  document.getElementById("tame-btns")!.innerHTML =
    "<input id='tame-name' maxlength='18' value='" + nm + "'><button class='btn pri' data-ta='name'>Pronto</button>";
  tameDraw(0);
  /* v5.9.05 */
  if (TAME.h) gainSkill(TAME.h, "domador", 15);
}
export function tameName() {
  const v = ((document.getElementById("tame-name") as HTMLInputElement).value || "").trim().slice(0, 18) || "Bandeira",
    a = TAME.a;
  econ.mount = {
    name: v,
    xp: 0,
    hp: 100,
    sta: 100,
    with: null,
    since: world.tick || 0,
    brushDay: -1,
    feedDay: -1,
    bag: null,
    coat: (a && a.coat) || tamRollCoat(),
    dirt: 55,
  };
  mountBag();
  if (a) world.anteaters = world.anteaters!.filter((x) => x !== a);
  pushEvent("🐾 Vocês domaram um tamanduá-bandeira gigante: " + v + "! Ele foi para o acampamento.");
  tameClose();
  mvToast("🐾 " + v + " agora é de vocês!");
}

/* ---------- PAINEL do tamanduá (acampamento / mapa) ---------- */
interface EstadoMP {
  open: boolean;
  tab: string;
  brush: Escovacao | null;
  raf: number;
  // acrescentados depois
  _ls?: string;
}
/** O minijogo de escovar e lavar o tamanduá (mpAct "brush"). */
interface Escovacao {
  ph: string; // "brush" | "soap" | "rinse"…
  prog: number;
  foam: number;
  wash?: number;
  down?: boolean;
  last?: Ponto;
}
export const MP: EstadoMP = { open: false, tab: "info", brush: null, raf: 0 };
export function mountPanel(tab?: string) {
  const m = mnt();
  if (!m) return;
  mpEnsure();
  MP.open = true;
  MP.tab = tab || "info";
  if (dungeon.active) dungeon.modalOpen = true;
  document.getElementById("mount-modal")!.classList.add("open");
  mpRender();
}
export function mpClose() {
  MP.open = false;
  MP.brush = null;
  cancelAnimationFrame(MP.raf);
  if (dungeon.active) dungeon.modalOpen = false;
  const m = document.getElementById("mount-modal");
  if (m) m.classList.remove("open");
  INV.invGrids = INV.invGrids.filter((g: GradeTela) => !(g.el && g.el.closest && g.el.closest("#mount-modal")));
  try {
    if (dungeon.active && dungeon.invOpen) renderInv();
  } catch (_) {}
}
function mpEnsure() {
  if (document.getElementById("mount-modal")) return;
  const m = document.createElement("div");
  m.id = "mount-modal";
  m.className = "v3-modal";
  m.innerHTML =
    '<div class="v3-card" id="mount-card"><div class="mt-head"><b id="mp-title"></b><div id="mp-tabs"></div><button class="btn" id="mp-x">✕</button></div><div id="mp-body"></div></div>';
  document.body.appendChild(m);
  (m.querySelector("#mp-x") as HTMLElement).onclick = mpClose;
  m.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("[data-mt]") as HTMLElement;
    if (t) {
      MP.tab = t.dataset.mt!;
      MP.brush = null;
      mpRender();
      return;
    }
    const a = (e.target as HTMLElement).closest("[data-ma]") as HTMLButtonElement;
    if (a && !a.disabled) mpAct(a.dataset.ma!);
  });
  m.addEventListener("change", (e) => {
    if ((e.target as HTMLElement).id === "mp-with") {
      mnt()!.with = (e.target as HTMLInputElement).value || null;
      mpRender();
      try {
        if (prep.open) renderPrep();
      } catch (_) {}
    }
  });
}
export function mpRender() {
  const m = mnt()!,
    lv = mountLv(m),
    nx = MOUNT.lvXp[lv] || null,
    B = document.getElementById("mp-body")!,
    day = mountDay();
  document.getElementById("mp-title")!.innerHTML = "🐾 " + esc(m.name) + " <small>vínculo " + lv + "/4</small>";
  document.getElementById("mp-tabs")!.innerHTML = [
    ["info", "Tamanduá"],
    ["bag", "🎒 Alforjes"],
  ]
    .map(([k, l]) => '<button class="btn' + (MP.tab === k ? " on" : "") + '" data-mt="' + k + '">' + l + "</button>")
    .join("");
  if (MP.tab === "bag") {
    const bag = mountBag()!;
    B.innerHTML =
      '<div class="mp-bags"><div><b>🐾 Alforjes de ' +
      esc(m.name) +
      "</b><div id='mp-saddle' class='gridbox'></div></div><div><b>📦 Baú do acampamento</b><div id='mp-stash' class='gridbox'></div></div></div><p class='mp-tip'>Arraste entre os alforjes e o baú. Na masmorra os alforjes aparecem na mochila quando " +
      esc(m.name) +
      " está perto.</p>";
    INV.invGrids = [
      { el: document.getElementById("mp-saddle")!, inv: bag, discard: false },
      { el: document.getElementById("mp-stash")!, inv: econ.stash, discard: false },
    ];
    renderInv();
    return;
  }
  if (MP.brush) {
    B.innerHTML =
      '<div class="br-steps"><span data-st="brush">1 · Escovar</span><span data-st="soap">2 · Ensaboar</span><span data-st="rinse">3 · Enxaguar</span><span data-st="done">4 · Limpo</span></div><canvas id="mp-cv" width="440" height="300"></canvas><p class="mp-tip" id="br-tip"></p><div class="mp-acts" id="br-btns"></div>';
    brushBind();
    return;
  }
  const pct = nx ? Math.round((((m.xp || 0) - MOUNT.lvXp[lv - 1]) / (nx - MOUNT.lvXp[lv - 1])) * 100) : 100,
    bag = mountBag()!;
  const cz = TCOATS[coatOf(m)],
    dirt = Math.round(m.dirt || 0);
  B.innerHTML =
    '<div class="mp-info"><div class="mp-pic2"><canvas id="mp-pic" width="182" height="198"></canvas><small>Pelagem <b>' +
    cz.n +
    "</b> · " +
    cz.r +
    "</small><div class='mp-dirt'><i style='width:" +
    dirt +
    "%'></i></div><small>" +
    (dirt > 60 ? "🟤 bem sujo" : dirt > 25 ? "🟤 um pouco sujo" : "✨ limpo") +
    '</small></div><div><div class="mp-bar"><i style="width:' +
    pct +
    '%"></i></div><small>' +
    (nx ? "Vínculo: " + (m.xp || 0) + "/" + nx + " para o nível " + (lv + 1) : "Vínculo máximo — inseparáveis") +
    "</small>" +
    "<ul class='mp-st'><li>🏃 Velocidade montado <b>×" +
    MOUNT.spd[lv - 1].toFixed(2) +
    "</b></li><li>🌊 Todo terreno: atravessa rio e mato</li><li>🎒 Alforjes <b>" +
    bag.cols / SUB +
    "×" +
    bag.rows / SUB +
    "</b> casas · viagens levam +8 itens do baú</li><li>❤ Vida " +
    Math.round(m.hp || 100) +
    " · ⚡ Fôlego " +
    Math.round(m.sta || 100) +
    "</li><li>🐜 Cupins guardados: <b>" +
    (econ.cupim || 0) +
    "</b> <small>(clique num cupinzeiro do mapa)</small></li></ul>" +
    "<label class='mp-with'>Acompanha: <select id='mp-with'><option value=''>fica no acampamento</option>" +
    world.heroes
      .map(
        (h) => "<option value='" + h.id + "'" + (m.with === h.id ? " selected" : "") + ">" + esc(h.name) + "</option>",
      )
      .join("") +
    "</select></label></div></div>" +
    "<div class='mp-acts'><button class='btn' data-ma='brush'>🪮 Escovar e lavar" +
    (m.brushDay === day ? " (já hoje)" : " +2 vínculo") +
    "</button><button class='btn' data-ma='feed'" +
    ((econ.cupim || 0) > 0 || campMeatStock() > 0 || econ.test ? "" : " disabled") +
    ">🐜 Alimentar" +
    (m.feedDay === day ? " (já hoje)" : " +1 vínculo") +
    "</button><button class='btn' data-ma='rename'>✏ Renomear</button></div>" +
    "<p class='mp-tip'>Na masmorra: <b>T</b> perto dele monta/desmonta · <b>T</b> longe assobia (ele vem correndo) · montado você é bem mais rápido, ele aguenta parte dos golpes, mas um golpe forte pode te derrubar da sela.</p>";
  const pc = document.getElementById("mp-pic") as HTMLCanvasElement;
  if (pc) {
    const c = pc.getContext("2d")!,
      im = icoImg("tam_clean_" + coatOf(m)),
      di = icoImg("tam_dirty_" + coatOf(m));
    if (im) {
      c.drawImage(im, 0, 0, 182, 198);
      if (di && (m.dirt || 0) > 25) {
        c.globalAlpha = Math.min(1, (m.dirt - 20) / 60);
        c.drawImage(di, 0, 0, 182, 198);
        c.globalAlpha = 1;
      }
    } else {
      c.fillStyle = "#cfdca6";
      c.fillRect(0, 0, 182, 198);
      drawAnteater2D(c, 91, 150, 5, 1, true, 0, coatOf(m));
    }
  }
}
function mpAct(a: string) {
  const m = mnt()!,
    day = mountDay();
  if (a === "rename") {
    const v = prompt("Novo nome para o tamanduá:", m.name);
    if (v && v.trim()) m.name = v.trim().slice(0, 18);
    mpRender();
    return;
  }
  if (a === "feed") {
    if ((econ.cupim || 0) > 0) econ.cupim!--;
    else if (!econ.test && !campTake("meat", 1)) return;
    m.hp = 100;
    m.sta = 100;
    if (m.feedDay !== day) {
      m.feedDay = day;
      mountXp(1, "alimentou");
    }
    sfx("ping");
    mvToast("🐜 " + m.name + " comeu e está cheio de energia.");
    mpRender();
    return;
  }
  if (a === "brush") {
    MP.brush = { ph: "brush", prog: 0, foam: 0 };
    mpRender();
  }
}
/* minigame: escovar (raspa a lama e revela o pelo limpo) → ensaboar (espuma) → enxaguar → limpo */
export function brushBind() {
  const cv = document.getElementById("mp-cv") as HTMLCanvasElement,
    c = cv.getContext("2d")!,
    m = mnt(),
    co = coatOf(m),
    W = cv.width,
    H = cv.height,
    B = MP.brush!;
  const clean = icoImg("tam_clean_" + co),
    dirty = icoImg("tam_dirty_" + co),
    iw = 182 * 1.45,
    ih = 198 * 1.45,
    ix = (W - iw) / 2,
    iy = H - ih - 2;
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const mc = mask.getContext("2d")!;
  mc.fillStyle = "#000";
  mc.fillRect(ix, iy, iw, ih);
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  const tc = tmp.getContext("2d")!;
  const foam: { x: number; y: number; r: number; a: number }[] = [];
  let pts: { x: number; y: number; f: number }[] | null = null;
  const bodyPts = () => {
    if (pts) return pts;
    pts = [];
    try {
      const k = document.createElement("canvas");
      k.width = W;
      k.height = H;
      const kc = k.getContext("2d")!;
      if (clean) kc.drawImage(clean, ix, iy, iw, ih);
      const D = kc.getImageData(0, 0, W, H).data,
        i0 = (Math.floor(iy + 4) * W + Math.floor(ix + 4)) * 4,
        bg = [D[i0], D[i0 + 1], D[i0 + 2]];
      for (let y = iy + 8; y < iy + ih - 10; y += 12)
        for (let x = ix + 6; x < ix + iw - 6; x += 12) {
          const i = (Math.floor(y) * W + Math.floor(x)) * 4;
          if (Math.abs(D[i] - bg[0]) + Math.abs(D[i + 1] - bg[1]) + Math.abs(D[i + 2] - bg[2]) > 70)
            pts.push({ x, y, f: 0 });
        }
    } catch (_) {}
    if (pts.length < 20) {
      pts = [];
      for (let y = iy + 30; y < iy + ih - 30; y += 14)
        for (let x = ix + 20; x < ix + iw - 20; x += 14) pts.push({ x, y, f: 0 });
    }
    return pts;
  };
  const ui = () => {
    const t = document.getElementById("br-tip"),
      bb = document.getElementById("br-btns")!;
    if (!t) return;
    document
      .querySelectorAll(".br-steps [data-st]")
      .forEach((e) => e.classList.toggle("on", (e as HTMLElement).dataset.st === B.ph));
    t.innerHTML =
      B.ph === "brush"
        ? "Segure e arraste a <b>escova</b> sobre a lama, as folhas e os gravetos (" + Math.round(B.prog * 100) + "%)."
        : B.ph === "soap"
          ? "Agora passe o <b>sabão</b> pelo corpo todo até cobrir de espuma (" + Math.round(B.foam * 100) + "%)."
          : B.ph === "rinse"
            ? "Jogue <b>água</b> para tirar a espuma (arraste por cima, ou use o balde)."
            : "✨ <b>" + esc(m!.name) + " está limpo e brilhando!</b>";
    bb.innerHTML =
      B.ph === "rinse"
        ? "<button class='btn pri' id='br-bucket'>🪣 Jogar o balde</button>"
        : B.ph === "done"
          ? "<button class='btn pri' id='br-ok'>Pronto</button>"
          : "";
    const bk = document.getElementById("br-bucket");
    if (bk)
      bk.onclick = () => {
        B.wash = 1;
        sfx("swing");
      };
    const ok = document.getElementById("br-ok");
    if (ok)
      ok.onclick = () => {
        MP.brush = null;
        mpRender();
      };
  };
  const draw = () => {
    const t = performance.now() / 1000;
    c.fillStyle = "#1e1812";
    c.fillRect(0, 0, W, H);
    if (clean) c.drawImage(clean, ix, iy, iw, ih);
    else drawAnteater2D(c, W / 2, H - 40, 9, 1, true, 0, co);
    if (B.ph === "brush") {
      tc.clearRect(0, 0, W, H);
      if (dirty) tc.drawImage(dirty, ix, iy, iw, ih);
      else {
        tc.fillStyle = "rgba(92,62,32,.85)";
        tc.fillRect(ix, iy, iw, ih);
      }
      tc.globalCompositeOperation = "destination-in";
      tc.drawImage(mask, 0, 0);
      tc.globalCompositeOperation = "source-over";
      c.drawImage(tmp, 0, 0);
    }
    for (const f of foam) {
      c.fillStyle = "rgba(255,255,255," + 0.75 * f.a + ")";
      c.beginPath();
      c.arc(f.x, f.y, f.r, 0, 6.283);
      c.fill();
      c.strokeStyle = "rgba(200,225,255," + 0.6 * f.a + ")";
      c.lineWidth = 1;
      c.stroke();
    }
    if (B.wash && B.ph === "rinse") {
      c.fillStyle = "rgba(120,180,255,.35)";
      for (let i = 0; i < 40; i++) {
        c.beginPath();
        c.arc(ix + Math.random() * iw, iy + Math.random() * ih, 2 + Math.random() * 3, 0, 6.283);
        c.fill();
      }
    }
    if (B.ph === "done") {
      for (let i = 0; i < 7; i++) {
        const a = t * 2 + i * 0.9,
          x = W / 2 + Math.cos(a) * 120,
          y = H / 2 - 10 + Math.sin(a * 1.3) * 80;
        c.fillStyle = "rgba(255,240,170," + (0.5 + 0.5 * Math.sin(t * 6 + i)) + ")";
        c.font = "16px serif";
        c.fillText("✦", x, y);
      }
    }
    if (B.last && B.down && B.ph !== "done") {
      const p = B.last;
      if (B.ph === "brush") {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(-0.5 + Math.sin(t * 20) * 0.15);
        c.fillStyle = "#8a5a2a";
        c.fillRect(-16, -6, 32, 11);
        c.fillRect(10, -3, 18, 5);
        c.fillStyle = "#3a2a1c";
        for (let i = 0; i < 8; i++) c.fillRect(-15 + i * 4, 5, 2, 6);
        c.restore();
      } else if (B.ph === "soap") {
        c.fillStyle = "#f0e6ff";
        c.fillRect(p.x - 10, p.y - 6, 20, 12);
      } else {
        c.fillStyle = "rgba(120,180,255,.6)";
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.arc(p.x + (Math.random() - 0.5) * 30, p.y + Math.random() * 30, 3, 0, 6.283);
          c.fill();
        }
      }
    }
  };
  const pt = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const step = (p: Ponto, mv: number) => {
    const P = bodyPts();
    if (B.ph === "brush") {
      mc.globalCompositeOperation = "destination-out";
      mc.beginPath();
      mc.arc(p.x, p.y, 20, 0, 6.283);
      mc.fill();
      mc.globalCompositeOperation = "source-over";
      for (const q of P) if (Math.hypot(q.x - p.x, q.y - p.y) < 18) q.f = 1;
      B.prog = P.filter((q) => q.f === 1).length / P.length;
      if (Math.random() < 0.3) sfx("hitlite");
      if (B.prog >= 0.9) {
        B.ph = "soap";
        for (const q of P) q.f = 0;
        sfx("ping");
        ui();
      }
    } else if (B.ph === "soap") {
      if (mv > 2 && Math.random() < 0.8)
        foam.push({
          x: p.x + (Math.random() - 0.5) * 18,
          y: p.y + (Math.random() - 0.5) * 18,
          r: 4 + Math.random() * 7,
          a: 1,
        });
      for (const q of P) if (Math.hypot(q.x - p.x, q.y - p.y) < 20) q.f = 1;
      B.foam = P.filter((q) => q.f === 1).length / P.length;
      if (B.foam >= 0.85) {
        B.ph = "rinse";
        sfx("ping");
        ui();
      }
    } else if (B.ph === "rinse") {
      for (const f of foam) if (Math.hypot(f.x - p.x, f.y - p.y) < 34) f.a -= 0.25;
    }
  };
  const loop = () => {
    if (MP.brush !== B || !document.getElementById("mp-cv")) return;
    if (B.ph === "rinse") {
      if (B.wash) {
        for (const f of foam) f.a -= 0.035;
      }
      for (let i = foam.length - 1; i >= 0; i--) if (foam[i].a <= 0) foam.splice(i, 1);
      if (!foam.length) {
        B.ph = "done";
        brushDone();
        ui();
      }
    }
    draw();
    requestAnimationFrame(loop);
  };
  cv.addEventListener("pointerdown", (e) => {
    B.down = true;
    B.last = pt(e);
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    step(B.last, 0);
  });
  cv.addEventListener("pointermove", (e) => {
    const p = pt(e),
      mv = B.last ? Math.hypot(p.x - B.last.x, p.y - B.last.y) : 0;
    if (B.down) {
      const n = Math.max(1, Math.ceil(mv / 8));
      for (let i = 1; i <= n; i++)
        step({ x: B.last!.x + ((p.x - B.last!.x) * i) / n, y: B.last!.y + ((p.y - B.last!.y) * i) / n }, mv);
      if (B.ph === "brush" || B.ph === "soap") ui();
    }
    B.last = p;
  });
  for (const ev of ["pointerup", "pointercancel"])
    cv.addEventListener(ev, () => {
      B.down = false;
    });
  ui();
  requestAnimationFrame(loop);
}
function brushDone() {
  const m = mnt()!,
    day = mountDay();
  m.dirt = 0;
  m.sta = 100;
  if (m.brushDay !== day) {
    m.brushDay = day;
    mountXp(2, "escovou e lavou");
  }
  sfx("perfect");
  mvToast("✨ " + m.name + " está limpo e brilhando!");
}
export function mountToggle() {
  const d = dungeon,
    M = d.mount,
    m = mnt()!;
  if (!d.active || !M || d.dead || d.modalOpen || d.invOpen) return;
  if (M.mounted) {
    M.mounted = false;
    M.st = "attend";
    M.att = 7;
    const a = (GL3.hyaw || 0) + Math.PI / 2;
    d.px += Math.cos(a) * d.tile * 0.7;
    d.py += Math.sin(a) * d.tile * 0.7;
    spawnDungeonToast("Desmontou", d.px, d.py - 30, "#e8d6a8", 11);
    sfx("swing");
    return;
  }
  if (mountNear() && M.flee <= 0) {
    M.mounted = true;
    d.px = M.x;
    d.py = M.y;
    d.moveTarget = null;
    spawnDungeonToast("🐾 Montou em " + m.name, d.px, d.py - 44, "#ffe08a", 12);
    sfx("ping");
    return;
  }
  M.st = "come";
  M.goal = null;
  M.sniff = 0;
  M.flee = 0;
  spawnDungeonToast("🎵 Assobiou — " + m.name + " está vindo!", d.px, d.py - 36, "#bfe8ff", 11);
  sfx("near");
}
export function mountTick(dt: number) {
  const d = dungeon,
    M = d.mount;
  if (!d.active || !M) return;
  const T = d.tile,
    lv = mountLv();
  if (M.mounted) {
    const mv = Math.hypot(d.px - M.x, d.py - M.y);
    if (mv > 0.05) M.ang = Math.atan2(d.py - M.y, d.px - M.x);
    M.mv = mv;
    M.x = d.px;
    M.y = d.py;
    if (d.down! > 0) {
      M.mounted = false;
      spawnDungeonToast("Caiu da sela!", d.px, d.py - 40, "#ff9a6a", 12);
    }
  } else {
    if (M.flee > 0) M.flee -= dt;
    const dist = Math.hypot(d.px - M.x, d.py - M.y),
      W = d.cols * T,
      H = d.rows * T;
    const toward = (x: number, y: number, v: number, stopAt: number) => {
      const dx = x - M.x,
        dy = y - M.y,
        l = Math.hypot(dx, dy);
      if (l <= (stopAt || 2)) return true;
      const s = Math.min(l - (stopAt || 0), v * dt);
      M.x = Math.max(T, Math.min(W - T, M.x + (dx / l) * s));
      M.y = Math.max(T, Math.min(H - T, M.y + (dy / l) * s));
      M.ang = Math.atan2(dy, dx);
      M.mv = s;
      return false;
    };
    M.mv = 0;
    M.forage = 0;
    if (M.flee > 0) {
      const w = d.monsters
        .filter((o) => o.alive)
        .sort((a, b) => Math.hypot(a.x - M.x, a.y - M.y) - Math.hypot(b.x - M.x, b.y - M.y))[0];
      if (w) toward(M.x + (M.x - w.x), M.y + (M.y - w.y), 150, 0);
    } else if (M.st === "come") {
      // chamado: vem correndo e para PERTO (não colado)
      if (toward(d.px, d.py, 175, T * 1.7)) {
        M.st = "attend";
        M.att = 7 + lv;
        M.ang = Math.atan2(d.py - M.y, d.px - M.x);
      }
    } else if (M.st === "attend") {
      // atento a você: acompanha a uma distância curta; se você não chegar perto, a atenção se dispersa
      if (dist < T * 1.6) M.att = 7 + lv;
      else M.att! -= dt;
      if (dist > T * 2.6) toward(d.px, d.py, dist > T * 5 ? 160 : 80, T * 1.9);
      else M.ang += (Math.atan2(d.py - M.y, d.px - M.x) - M.ang) * Math.min(1, dt * 3);
      if (M.att! <= 0) {
        M.st = "roam";
        M.goal = null;
        spawnDungeonToast("🐾 " + mnt()!.name + " voltou a fuçar o chão", M.x, M.y - 34, "#c9b88a", 10);
      }
    } else {
      // por conta própria: anda pela área, fareja o chão atrás de insetos, sem sair da tela
      const home = d.camp && CPS.fire ? { x: CPS.fire.x - T * 2.8, y: CPS.fire.y - T * 1.4 } : { x: d.px, y: d.py },
        leash = d.camp ? T * 2.6 : T * 6.5;
      if (!d.camp && dist > leash) {
        M.goal = null;
        M.sniff = 0;
        toward(d.px, d.py, dist > T * 9 ? 140 : 70, leash * 0.7);
      } else if (M.sniff! > 0) {
        M.sniff! -= dt;
        M.forage = 1;
        if (Math.random() < dt * 4)
          d.fx!.push({ x: M.x + Math.cos(M.ang) * 34, y: M.y + Math.sin(M.ang) * 34, life: 0.25 });
        if (M.sniff! <= 0) {
          M.goal = null;
          if (Math.random() < 0.18) {
            econ.cupim = (econ.cupim || 0) + 1;
            spawnDungeonToast("🐜 achou cupins (+1)", M.x, M.y - 34, "#e0c08a", 10);
          }
        }
      } else {
        if (!M.goal) {
          const a = Math.random() * 6.283,
            r = T * (2.2 + Math.random() * (leash / T - 2.2));
          M.goal = {
            x: Math.max(T * 1.5, Math.min(W - T * 1.5, home.x + Math.cos(a) * r)),
            y: Math.max(T * 1.5, Math.min(H - T * 1.5, home.y + Math.sin(a) * r * 0.7)),
          };
        }
        if (toward(M.goal.x, M.goal.y, 38, 4)) {
          M.sniff = 2 + Math.random() * 3.5;
        }
      }
    }
  }
  M.ph += M.mv * 0.16;
  if (d.sinceHurt! > 5) M.hp = Math.min(100, M.hp + dt * (0.6 + lv * 0.3));
}
/* tamanduá no 2D e anel de interação (armasDraw2D chama) */
export function mountDraw2D() {
  const d = dungeon,
    M = d.mount;
  if (!M || M.mounted) return;
  const c = TELAS.dCtx,
    near = mountNear();
  if (near || M.st === "come") {
    c.save();
    c.strokeStyle = near ? "rgba(255,224,138,.8)" : "rgba(191,232,255,.6)";
    c.lineWidth = 2;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.ellipse(M.x, M.y + 2, 30, 14, 0, 0, 6.283);
    c.stroke();
    c.restore();
  }
  if (!(D3.on && D3.gl)) drawAnteater2D(c, M.x, M.y, 2.2, Math.cos(M.ang), true, M.ph, coatOf(mnt()));
}
