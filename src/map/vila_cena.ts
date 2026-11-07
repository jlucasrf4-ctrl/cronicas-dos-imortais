/* ==== v8.0 — a Vila Musgo andável (mantenedor, 2026-10-24: "eu esperava a cidade igual é o acampamento: eu clico
   nela e já entro em um mapa de cidade mesmo, não as janelinhas"; e, na mesma conversa: na porta, E abre o painel do
   lugar; os interiores andáveis ficam para depois) ====
   Um mapa separado como o acampamento (setupDungeon com VCS.pending → vilaSetup; dungeon.vila, mode "vila"): a rua de
   oeste a leste, o Empório, a Taverna e a Igreja do lado de cima, o quadro de pedidos e a feira do lado de baixo, a
   doca com o bote na água, embaixo à direita (layout em data/vila.ts VILA_CENA). Os moradores são o modelo do Caçador
   tingido (glPush tint), parados ao lado das portas. Perto de uma porta, o E abre a janela daquele lugar só (empOpen
   com a aba, sem a barra de abas). Casas, poço, torre, banca e a água barram (vilaMover, chamado por mundoMover). Sai
   pelo círculo verde; a heroína volta ao mapa na vila ("field"). O bote da doca sai da vila e atravessa (vilaSair). */
import { GL3, TELAS, camera, dungeon, econ } from "../core/state.ts";
import { M4, MALHA } from "../render/gl/geometria.ts";
import { MB, mbBox, mbCyl, mbIco, glMesh, gmix, grnd, glFree } from "../render/gl/malhas.ts";
import { glPush } from "../render/gl/renderer.ts";
import { mbTree } from "../render/gl/modelos.ts";
import { mbCenario } from "../render/gl/cenario.ts";
import { vtPor, vtMalha } from "../render/gl/vila_tex.ts";
import { cacadorAnimado } from "../render/gl/cacador_anim.ts";
import { VILA_CENA, type LugarVila, type PredioVila } from "../data/vila.ts";
import { camZoomTo } from "../survival/acampamento.ts";
import { closePrep, launchDungeon, exitDungeon } from "../expedicao/preparo.ts";
import { prep, bag } from "../econ/economia.ts";
import { closeBag } from "../ui/janelas.ts";
import { setBanner } from "../field/masmorra.ts";
import { mapTip } from "../intro/cena.ts";
import { MAPCTL } from "./controle.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { campanha } from "../campanha/campanha.ts";
import { empOpen, empClose, musgoCity, heroNaVila, docaCaca } from "./vila_musgo.ts";
import type { Hero, MalhaCrua, Ponto } from "../core/tipos.ts";

/** pending: a próxima setupDungeon monta a vila · prevCam: a câmera do mapa antes de entrar · depois: o que fazer
    quando a vila fechar (o bote da doca) · aberto: o lugar com a janela aberta. */
export const VCS = {
  pending: false,
  prevCam: null as { s: number; x: number; y: number } | null,
  depois: null as (() => void) | null,
  aberto: null as LugarVila | null,
};

const C = VILA_CENA;
const casas = (k: number) => k * dungeon.tile;

/* ---------- entrar e sair ---------- */
/** Do mapa para dentro da vila: a câmera aproxima na vila e abre o mapa dela (como enterCamp). */
export function vilaEntrar(h: Hero) {
  const c = musgoCity();
  if (!h || !c || dungeon.active) return;
  if (prep.open) closePrep();
  if (bag.open) closeBag();
  for (const id of ["hero-inspector", "inspector"]) document.getElementById(id)?.classList.remove("open");
  empClose();
  VCS.prevCam = { s: camera.scale, x: camera.tx, y: camera.ty };
  h.walkTo = null;
  h.task = null;
  h._toMusgo = false;
  h._toDoca = false;
  h.state = "idle"; // launchDungeon só leva quem está parado
  camZoomTo(c.x, c.y, Math.max(camera.scale * 4, camera.minScale * 10), 800, () => {
    VCS.pending = true;
    launchDungeon(h.id);
  });
}

/** Ir para a vila pelo mapa: já está nela, entra; senão anda até lá (ou até o bote, se for mais perto e ele não
    estiver furado) e, chegando, entra (o laço de v7.5_ilhas_vila_musgo.ts). */
export function vilaIr(h: Hero) {
  const c = musgoCity();
  if (!h || !c) return;
  if (heroNaVila() === h) {
    vilaEntrar(h);
    return;
  }
  const d = docaCaca(),
    F = campanha().flags,
    bote = !F.boteFurado || F.boteConsertado;
  if (bote && d && Math.hypot(h.x - d.x, h.y - d.y) < Math.hypot(h.x - c.x, h.y - c.y)) {
    h.walkTo = { x: d.x, y: d.y };
    h._toDoca = true;
    mapTip("🚶 Indo até o bote ⛵ na beira do canal");
  } else {
    h.walkTo = { x: c.x, y: c.y + 6 };
    h._toMusgo = true;
    mapTip("🚶 Indo para a Vila Musgo");
  }
  h.task = null;
  h.targetEntity = null;
  h.state = "walking";
  h._enterCamp = false;
  MAPCTL.sel = h.id;
  updateHeroPanelUI();
}

/** Sai da vila (pelo círculo verde é o exitDungeon de sempre); `depois` roda quando o mapa voltar. */
export function vilaSair(depois?: () => void) {
  VCS.depois = depois || null;
  exitDungeon();
}

/** exitDungeon chama ao sair: fecha a janela e devolve o que a volta ao mapa precisa (null se não era a vila). */
export function vilaFechar() {
  const d = dungeon;
  if (!d.vila) return null;
  d.vila = false;
  vilaFecharLugar();
  const r = { pc: VCS.prevCam, depois: VCS.depois };
  VCS.prevCam = null;
  VCS.depois = null;
  return r;
}

/** Monta a vila (setupDungeon, depois de startExpedition): sem bichos, itens, runas nem moitas. */
export function vilaSetup() {
  const d = dungeon,
    T = d.tile;
  d.vila = true;
  d.mode = "vila";
  d.flow = "vila";
  d.banner = null;
  d.birds = [];
  d.birdQ = [];
  d.loot = [];
  d.monsters = [];
  d.bushes = [];
  for (const r of d.runes || [])
    if (r._m) {
      try {
        glFree(r._m.patch);
        glFree(r._m.glyph);
      } catch (_) {}
    }
  d.runes = [];
  d.px = d.entrance.x + T * 1.2;
  d.py = d.entrance.y;
  VCS.aberto = null;
  econ.musgoVisto = 1;
  GL3.sceneKey = "";
  setBanner("🏘 VILA MUSGO", "Chegue perto de uma porta e aperte E · saia pelo círculo verde", 5, "#ffd08a");
}

/* ---------- as portas: o E abre o lugar ---------- */
/** O lugar mais perto da heroína, se ela está na porta dele. */
export function vilaPerto(): LugarVila | null {
  const d = dungeon;
  if (!d.active || !d.vila) return null;
  let m: LugarVila | null = null,
    md = casas(C.raioPorta);
  for (const l of C.lugares) {
    const k = Math.hypot(d.px - casas(l.x), d.py - casas(l.z));
    if (k < md) {
      md = k;
      m = l;
    }
  }
  return m;
}
/** Abre a janela do lugar (só ele, sem as abas). */
export function vilaAbrir(l: LugarVila) {
  const d = dungeon;
  if (!d.hero) return;
  if (!ESC_OUVINDO) {
    // Esc fecha a janela do lugar (o ouvinte entra na primeira porta: o módulo também carrega nos testes em Node)
    ESC_OUVINDO = true;
    window.addEventListener(
      "keydown",
      (e) => {
        if (!VCS.aberto || e.code !== "Escape") return;
        e.stopPropagation();
        vilaFecharLugar();
      },
      true,
    );
  }
  VCS.aberto = l;
  d.keys = {};
  d.moveTarget = null;
  d.modalOpen = true;
  empOpen(d.hero, l.aba, l.placa);
}
let ESC_OUVINDO = false;
/** Fecha a janela do lugar (empClose solta a heroína para andar de novo). */
function vilaFecharLugar() {
  if (VCS.aberto) empClose();
}

/* ---------- o que barra: casas, torre, poço, banca, quadro e a água (fora do píer) ---------- */
function retangulos(): [number, number, number, number][] {
  const L: [number, number, number, number][] = Object.values(C.predios).map((p) => [
    p.x - p.w / 2 - 0.1,
    p.z - p.d / 2 - 0.1,
    p.x + p.w / 2 + 0.1,
    p.z + p.d / 2 + 0.1,
  ]);
  const t = C.torre;
  L.push([t.x - t.w / 2, t.z - t.w / 2, t.x + t.w / 2, t.z + t.w / 2]);
  L.push([C.banca.x - 1, C.banca.z - 0.5, C.banca.x + 1, C.banca.z + 0.5]);
  L.push([C.quadro.x - 0.75, C.quadro.z - 0.18, C.quadro.x + 0.75, C.quadro.z + 0.18]);
  return L;
}
function naAgua(x: number, z: number) {
  const A = C.agua,
    P = C.pier;
  if (x < A.x0 || z < A.z0) return false;
  return !(x > P.x0 && x < P.x1 && z < P.z1);
}
function barra(x: number, y: number, r: number) {
  const T = dungeon.tile,
    cx = x / T,
    cz = y / T,
    rr = r / T;
  for (const [x0, z0, x1, z1] of retangulos())
    if (cx > x0 - rr && cx < x1 + rr && cz > z0 - rr && cz < z1 + rr) return true;
  if (Math.hypot(cx - C.poco.x, cz - C.poco.z) < C.poco.r + rr) return true;
  return naAgua(cx + rr * 0.5, cz + rr * 0.5);
}
/** Como mundoMover: escorrega ao longo do que barra (tenta cada eixo). */
export function vilaMover(x0: number, y0: number, x1: number, y1: number, r: number): [number, number] {
  if (!barra(x1, y1, r)) return [x1, y1];
  if (!barra(x1, y0, r)) return [x1, y0];
  if (!barra(x0, y1, r)) return [x0, y1];
  return barra(x0, y0, r) ? [x1, y1] : [x0, y0]; // já presa: deixa sair
}

/* ---------- a cena 3D ---------- */
function vilaCol(x: number, z: number, T: number) {
  const n = (Math.sin(x * 0.013 + z * 0.007) + Math.sin(x * 0.005 - z * 0.009 + 1.3)) / 2,
    cx = x / T,
    cz = z / T;
  let c = gmix("#7fa04a", "#9cb456", 0.5 + n * 0.5);
  const terra = gmix("#9a7a52", "#b0906a", 0.5 + n * 0.5);
  // a rua (ondula um pouco) e os caminhos das portas até ela
  const rz = C.rua.z + Math.sin(cx * 0.45) * 0.18,
    dr = Math.abs(cz - rz) - C.rua.meia;
  if (dr < 0.25) c = gmix(c, terra, Math.min(1, (0.25 - dr) / 0.35));
  for (const l of C.lugares)
    if (l.z < C.rua.z && Math.abs(cx - l.x) < 0.6 && cz > l.z - 0.5 && cz < rz) c = gmix(c, terra, 0.85);
  // a praça de pedra (laje a laje: a cor muda por quadradinho de 1/3 de casa)
  const dp = Math.hypot(cx - C.praca.x, (cz - C.praca.z) * 1.15);
  if (dp < C.praca.r) {
    const q = Math.floor(cx * 3) * 7 + Math.floor(cz * 3) * 13,
      pedra = gmix("#b3a996", "#8a8273", ((q * 37) % 10) / 10);
    c = gmix(c, pedra, Math.min(1, (C.praca.r - dp) / 0.2));
  }
  // areia na beira e a água
  const A = C.agua,
    bx = cx - (A.x0 + Math.sin(cz * 0.8) * 0.2),
    bz = cz - (A.z0 + Math.sin(cx * 0.7) * 0.2),
    db = Math.min(bx, bz);
  if (bx > -0.7 && bz > -0.7) {
    if (db < 0) c = gmix(c, "#cdb88a", Math.min(1, (db + 0.7) / 0.4));
    else c = gmix("#cdb88a", gmix("#3f6f8f", "#2f5f80", Math.min(1, db / 3)), Math.min(1, db / 0.35));
  }
  const k = 0.95 + Math.sin(x * 0.11) * Math.sin(z * 0.13) * 0.04;
  return [c[0] * k, c[1] * k, c[2] * k];
}

const MAD = "#6a4524",
  ESC = "#3e2814",
  PEDRA = "#8d8a82";

/** Casa de enxaimel: alicerce de pedra, paredes, vigas nos cantos, porta e janelas na frente (z+), telhado de duas
    águas (um losango ao longo de x achatado em `th`), chaminé. */
function predio(o: MalhaCrua, p: PredioVila, op: { porta?: number; chamine?: boolean; janelas?: number } = {}) {
  const T = dungeon.tile,
    x = p.x * T,
    z = p.z * T,
    w = p.w * T,
    dd = p.d * T,
    h = p.h * T,
    base = 5,
    topo = base + h,
    fz = z + dd / 2;
  mbBox(o, M4.ch(M4.T(x, base / 2, z), M4.S(w + 6, base, dd + 6)), PEDRA, 1, 0.06);
  mbBox(o, M4.ch(M4.T(x, base + h / 2, z), M4.S(w, h, dd)), p.parede, 1, 0.02);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      mbBox(o, M4.ch(M4.T(x + sx * (w / 2), base + h / 2, z + sz * (dd / 2)), M4.S(4.5, h, 4.5)), ESC);
  mbBox(o, M4.ch(M4.T(x, topo - 2, fz + 0.8), M4.S(w + 3, 3.4, 1.6)), ESC);
  if (h > T * 1.3) mbBox(o, M4.ch(M4.T(x, base + h * 0.52, fz + 0.7), M4.S(w, 2.6, 1.4)), ESC); // o andar de cima
  // telhado, a cumeeira e as fileiras de telha na água da frente (a que aparece de cima)
  const hd = dd / 2 + 8,
    alto = hd * p.th;
  mbBox(
    o,
    M4.ch(M4.T(x, topo, z), M4.S(1, p.th, 1), M4.RX(Math.PI / 4), M4.S(w + 14, hd * Math.SQRT2, hd * Math.SQRT2)),
    p.telhado,
    1,
    0.05,
  );
  mbBox(o, M4.ch(M4.T(x, topo + alto, z), M4.S(w + 16, 3.4, 5)), gmix(p.telhado, "#1a1008", 0.45));
  const telha = gmix(p.telhado, "#1a1008", 0.25);
  for (let t = 0.12; t < 0.95; t += 0.16)
    mbBox(o, M4.ch(M4.T(x, topo + alto * t + 1.2, z + hd * (1 - t)), M4.S(w + 14.5, 1.4, 2.4)), telha);
  if (op.chamine !== false)
    mbBox(
      o,
      M4.ch(M4.T(x - w * 0.28, topo + hd * p.th * 0.75, z - dd * 0.12), M4.S(9, hd * p.th * 0.9, 9)),
      "#7a6a5e",
      1,
      0.06,
    );
  // porta e janelas
  const px = x + (op.porta || 0) * T;
  mbBox(o, M4.ch(M4.T(px, base + 12, fz + 1), M4.S(17, 25, 1.6)), ESC);
  mbBox(o, M4.ch(M4.T(px, base + 11.5, fz + 1.6), M4.S(13, 23, 1.2)), "#5a3a20", 1, 0.04);
  mbBox(o, M4.ch(M4.T(px + 4, base + 11, fz + 2.4), M4.S(1.6, 1.6, 1.2)), "#c9a24a");
  const nj = op.janelas ?? 2;
  for (let i = 0; i < nj; i++) {
    const jx = x + (i % 2 ? 1 : -1) * w * (nj > 2 && i > 1 ? 0.12 : 0.32),
      jy = base + (h > T * 1.3 && i > 1 ? h * 0.78 : Math.min(h * 0.55, 30));
    if (Math.abs(jx - px) < 16) continue;
    mbBox(o, M4.ch(M4.T(jx, jy, fz + 0.9), M4.S(13, 12, 1.4)), ESC);
    mbBox(o, M4.ch(M4.T(jx, jy, fz + 1.3), M4.S(10, 9, 1)), "#f0cf7a");
    for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(jx + s * 9, jy, fz + 1.2), M4.S(4, 12, 1)), p.telhado, 1, 0.05);
  }
}
function barril(o: MalhaCrua, x: number, z: number) {
  if (vtPor("barril", x, z, 13, 13)) return;
  mbCyl(o, M4.ch(M4.T(x, 0, z), M4.S(11, 15, 11)), "#7a4e28", 10, 1, 0.06);
  for (const y of [3, 12]) mbCyl(o, M4.ch(M4.T(x, y, z), M4.S(11.6, 1.4, 11.6)), "#4a4a4a", 10, 1);
}
function caixote(o: MalhaCrua, x: number, z: number, a: number, s = 1) {
  if (vtPor("caixote", x, z, 13 * s, 13 * s, a)) return;
  mbBox(o, M4.ch(M4.T(x, 6 * s, z), M4.RY(a), M4.S(12 * s, 12 * s, 12 * s)), "#9a6a3a", 1, 0.08);
  mbBox(o, M4.ch(M4.T(x, 6 * s, z), M4.RY(a), M4.S(12.4 * s, 2, 12.4 * s)), "#5e3d1e");
}

/** A cena da vila (glBuildScene chama quando dungeon.vila): chão e enfeites fixos. */
export function glBuildVila() {
  const d = dungeon,
    T = d.tile,
    W = d.cols * T,
    H = d.rows * T,
    e = d.entrance,
    b = MB(),
    o = MB();
  MALHA._gs = 1717;
  // chão: casas inteiras fora, em nove dentro (a rua, a praça e a areia ficam com a borda menos dentada)
  for (let gy = -7; gy < d.rows + 7; gy++)
    for (let gx = -9; gx < d.cols + 9; gx++) {
      const x = gx * T,
        z = gy * T,
        S = gx >= -1 && gx <= d.cols && gy >= -1 && gy <= d.rows ? 3 : 1,
        s = T / S;
      for (let i = 0; i < S; i++)
        for (let j = 0; j < S; j++) {
          const ax = x + i * s,
            az = z + j * s,
            P = [
              [ax, az],
              [ax + s, az],
              [ax + s, az + s],
              [ax, az + s],
            ],
            Cc = P.map((p) => vilaCol(p[0], p[1], T));
          for (const t of [
            [0, 2, 1],
            [0, 3, 2],
          ])
            for (const q of t) {
              b.p.push(P[q][0], 0, P[q][1]);
              b.n.push(0, 1, 0);
              b.c.push(Cc[q][0], Cc[q][1], Cc[q][2]);
            }
        }
    }
  const Pd = C.predios;
  // v8.0: os prédios do Tripo com textura (render/gl/vila_tex.ts), cada um na caixa do prédio de VILA_CENA (a mesma
  // que barra a heroína); sem os dados, as malhas feitas por código abaixo
  const tripo = (nome: string, p: PredioVila) => vtPor(nome, p.x * T, p.z * T, p.w * T, p.d * T);
  // Empório: toldo listrado, barris e caixotes
  if (!tripo("emporio", Pd.emporio)) {
    predio(o, Pd.emporio, { porta: 0 });
    const p = Pd.emporio,
      x = p.x * T,
      fz = (p.z + p.d / 2) * T;
    for (let i = 0; i < 6; i++)
      mbBox(
        o,
        M4.ch(M4.T(x - T * 1.3 + i * T * 0.52, 5 + T * 1.05, fz + 10), M4.RX(0.45), M4.S(T * 0.52, 1.4, 24)),
        i % 2 ? "#e8dcc0" : "#3f7a58",
        1,
        0.03,
      );
    for (const s of [-1, 1]) mbCyl(o, M4.ch(M4.T(x + s * T * 1.5, 0, fz + 19), M4.S(2, 44, 2)), MAD, 6, 1);
    barril(o, x + T * 1.9, fz + 8);
    barril(o, x + T * 2.4, fz + 2);
    caixote(o, x - T * 1.9, fz + 8, 0.2);
    caixote(o, x - T * 1.9, fz + 8 + 0.1, 0.5, 0.75);
  }
  // Taverna: dois andares, placa com a caneca
  if (!tripo("taverna", Pd.taverna)) {
    predio(o, Pd.taverna, { porta: 0, janelas: 4 });
    const p = Pd.taverna,
      x = p.x * T + T * 0.75,
      fz = (p.z + p.d / 2) * T;
    mbBox(o, M4.ch(M4.T(x + 9, 5 + T * 1.1, fz + 9), M4.S(2, 2, 18)), ESC);
    mbBox(o, M4.ch(M4.T(x + 9, 5 + T * 0.85, fz + 14), M4.S(16, 12, 1.4)), "#8a5a2b", 1, 0.05);
    mbCyl(o, M4.ch(M4.T(x + 9, 5 + T * 0.72, fz + 15.4), M4.S(6, 8, 2)), "#d9a640", 8, 1);
    barril(o, p.x * T - T * 2.3, fz + 6);
    mbBox(o, M4.ch(M4.T(p.x * T - T * 1.6, 9, fz + 12), M4.S(26, 2, 9)), "#7a4e28", 1, 0.05); // banco
    for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(p.x * T - T * 1.6 + s * 10, 4, fz + 12), M4.S(2, 8, 7)), ESC);
  }
  // Igreja: paredes claras, torre com o sino, janela redonda (a do Tripo já tem a torre: ocupa a igreja e a torre)
  const ig = Pd.igreja,
    tr = C.torre,
    igX0 = ig.x - ig.w / 2,
    igX1 = Math.max(ig.x + ig.w / 2, tr.x + tr.w / 2);
  if (!vtPor("igreja", ((igX0 + igX1) / 2) * T, ig.z * T, (igX1 - igX0) * T, ig.d * T)) {
    predio(o, Pd.igreja, { porta: 0, chamine: false, janelas: 2 });
    const p = Pd.igreja,
      x = p.x * T,
      fz = (p.z + p.d / 2) * T,
      t = C.torre,
      tx = t.x * T,
      tz = t.z * T,
      tw = t.w * T,
      th = t.h * T;
    mbBox(o, M4.ch(M4.T(tx, 2.5, tz), M4.S(tw + 6, 5, tw + 6)), PEDRA, 1, 0.06);
    mbBox(o, M4.ch(M4.T(tx, 5 + th / 2, tz), M4.S(tw, th, tw)), p.parede, 1, 0.02);
    mbBox(o, M4.ch(M4.T(tx, 5 + th - 16, tz + tw / 2 + 0.5), M4.S(14, 20, 1.2)), "#2a2620"); // a janela do sino
    mbCyl(o, M4.ch(M4.T(tx, 5 + th - 24, tz + tw / 2 - 4), M4.S(10, 11, 10)), "#c9a24a", 10, 0.55);
    mbCyl(o, M4.ch(M4.T(tx, 5 + th, tz), M4.RY(Math.PI / 4), M4.S(tw * 1.5, T * 1.4, tw * 1.5)), p.telhado, 4, 0, 0.04);
    mbBox(o, M4.ch(M4.T(tx, 5 + th + T * 1.55, tz), M4.S(2, 14, 2)), "#c9a24a");
    mbBox(o, M4.ch(M4.T(tx, 5 + th + T * 1.6, tz), M4.S(9, 2, 2)), "#c9a24a");
    mbCyl(o, M4.ch(M4.T(x, 5 + p.h * T * 0.78, fz + 0.6), M4.RX(Math.PI / 2), M4.S(13, 1.6, 13)), ESC, 12, 1);
    mbCyl(o, M4.ch(M4.T(x, 5 + p.h * T * 0.78, fz + 1.2), M4.RX(Math.PI / 2), M4.S(10, 1.2, 10)), "#7a9ad8", 12, 1);
    for (let i = 0; i < 2; i++)
      mbBox(o, M4.ch(M4.T(x, 1 + i * 2, fz + 5 + (1 - i) * 4), M4.S(30, 2, 7)), PEDRA, 1, 0.04); // degraus
  }
  // casas sem porta que abra (enfeite)
  for (const [k, nome] of [
    ["casa1", "casa_lenha"],
    ["casa2", "casa_dois"],
    ["casa3", "casa_lenha"],
    ["casa4", "casa_dois"],
  ])
    if (!tripo(nome, Pd[k])) predio(o, Pd[k], { porta: 0.25 });
  // o poço na praça: anel de pedra, água, dois postes, o telhadinho e o balde
  if (!vtPor("poco", C.poco.x * T, C.poco.z * T, T * 1.6, T * 1.6)) {
    const P = C.poco,
      x = P.x * T,
      z = P.z * T;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      mbIco(
        o,
        M4.ch(M4.T(x + Math.cos(a) * 12, 6, z + Math.sin(a) * 12), M4.RY(a), M4.S(9, 12, 8)),
        gmix("#8d8d88", "#b0afa8", grnd()),
        0,
        0.2,
        0.06,
      );
    }
    mbCyl(o, M4.ch(M4.T(x, 0, z), M4.S(22, 11, 22)), "#7a776f", 12, 1);
    mbCyl(o, M4.ch(M4.T(x, 11.2, z), M4.S(17, 0.4, 17)), "#2f5f80", 12, 1);
    for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(x + s * 13, 20, z), M4.S(2.6, 28, 2.6)), MAD);
    mbBox(o, M4.ch(M4.T(x, 31, z), M4.S(28, 1.6, 1.6)), MAD);
    mbBox(o, M4.ch(M4.T(x, 36, z), M4.S(1, 0.55, 1), M4.RX(Math.PI / 4), M4.S(34, 14, 14)), "#8a4a2e", 1, 0.04);
    mbCyl(o, M4.ch(M4.T(x + 3, 20, z), M4.S(5, 6, 5)), "#7a4e28", 8, 0.85);
  }
  // o quadro de pedidos: dois postes, a tábua e os papéis (o do Tripo vem de lado: o giro vira os papéis para a
  // câmera, que olha do sul, como o antigo)
  if (!vtPor("quadro", C.quadro.x * T, C.quadro.z * T, T * 1.5, T * 1.5, -Math.PI / 2)) {
    const x = C.quadro.x * T,
      z = C.quadro.z * T;
    for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(x + s * 26, 18, z), M4.S(3.4, 36, 3.4)), MAD);
    mbBox(o, M4.ch(M4.T(x, 25, z), M4.S(50, 22, 2.4)), "#8a5a2b", 1, 0.04);
    mbBox(o, M4.ch(M4.T(x, 37.5, z), M4.RX(Math.PI / 4), M4.S(58, 4, 4)), "#5e4a3a");
    for (let i = 0; i < 4; i++)
      mbBox(
        o,
        M4.ch(M4.T(x - 17 + i * 11.5, 25 + (i % 2 ? 2 : -2), z + 1.4), M4.RZ((i - 1.5) * 0.08), M4.S(8, 10, 0.6)),
        "#efe6cc",
      );
  }
  // a banca de feira (de frente para a câmera)
  if (!vtPor("banca", C.banca.x * T, C.banca.z * T, T * 2.1, T * 1.4)) {
    const x = C.banca.x * T,
      z = C.banca.z * T;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) mbCyl(o, M4.ch(M4.T(x + sx * 38, 0, z + sz * 16), M4.S(2.2, 40, 2.2)), MAD, 6, 1);
    for (let i = 0; i < 5; i++)
      mbBox(
        o,
        M4.ch(M4.T(x - 34 + i * 17, 41, z), M4.RX(-0.25), M4.S(17, 1.4, 40)),
        i % 2 ? "#e8dcc0" : "#b8483a",
        1,
        0.03,
      );
    mbBox(o, M4.ch(M4.T(x, 13, z), M4.S(76, 3, 26)), "#8a5a2b", 1, 0.04);
    for (let i = 0; i < 7; i++)
      mbIco(
        o,
        M4.ch(M4.T(x - 30 + i * 10, 17, z + (i % 2 ? 4 : -4)), M4.S(7, 5, 7)),
        ["#c8462a", "#e0b040", "#7a9a3a"][i % 3],
        0,
        0.2,
        0.08,
      );
  }
  // as lanternas da rua
  for (const L of C.lanternas) {
    const x = L.x * T,
      z = L.z * T;
    mbCyl(o, M4.ch(M4.T(x, 0, z), M4.S(3, 46, 3)), ESC, 6, 1);
    mbBox(o, M4.ch(M4.T(x + 5, 45, z), M4.S(12, 2, 2)), ESC);
    mbBox(o, M4.ch(M4.T(x + 10, 38, z), M4.S(6, 8, 6)), "#f5d27a");
  }
  // a doca: o píer de tábuas sobre a água e o bote amarrado
  {
    const P = C.pier,
      x0 = P.x0 * T,
      x1 = P.x1 * T,
      z0 = (C.agua.z0 - 0.4) * T,
      z1 = P.z1 * T;
    for (let z = z0; z < z1; z += T * 0.3)
      mbBox(
        o,
        M4.ch(M4.T((x0 + x1) / 2, 4, z + T * 0.15), M4.S(x1 - x0 + 4, 2, T * 0.27)),
        gmix("#9a7048", "#7a5530", grnd()),
        1,
        0.05,
      );
    for (let z = z0 + T * 0.5; z < z1; z += T * 1.1)
      for (const x of [x0, x1]) mbCyl(o, M4.ch(M4.T(x, -6, z), M4.S(4, 16, 4)), ESC, 6, 1);
    const bx = x1 + T * 0.95,
      bz = (C.agua.z0 + 2.2) * T;
    if (!vtPor("bote", bx, bz, 26, 52)) {
      mbBox(o, M4.ch(M4.T(bx, 3, bz), M4.S(20, 9, 46)), "#6a4524", 1.35, 0.05);
      mbBox(o, M4.ch(M4.T(bx, 6.8, bz), M4.S(18, 2, 40)), "#3a2414");
      for (const s of [-1, 1]) mbBox(o, M4.ch(M4.T(bx, 7.5, bz + s * 10), M4.S(22, 1.6, 4)), "#8a5a2b");
      mbBox(o, M4.ch(M4.T(bx + 6, 9, bz), M4.RY(0.25), M4.RZ(0.15), M4.S(2, 2, 44)), "#a0784a"); // o remo
      mbCyl(o, M4.ch(M4.T(bx - 12, 4.5, bz - 14), M4.RZ(Math.PI / 2), M4.S(1, 14, 1)), "#c8b080", 5, 1); // a corda
    }
    // v8.0: a rede, a vara e o balde de peixes na beira, perto do píer
    vtPor("rede", x0 - T * 1.6, z0 - T * 0.7, T * 1.1, T * 0.8);
    vtPor("balde_peixes", x0 - T * 0.6, z0 - T * 0.9, T * 0.5, T * 0.5);
    caixote(o, x0 - T * 0.6, z0 - T * 0.2, 0.3);
    barril(o, x0 - T * 1.2, z0 + T * 0.1);
    for (let i = 0; i < 9; i++)
      mbBox(
        o,
        M4.ch(
          M4.T(C.agua.x0 * T + T * (0.8 + grnd() * 7), 0.4, C.agua.z0 * T + T * (1 + grnd() * 4)),
          M4.S(10 + grnd() * 14, 0.4, 2),
        ),
        "#6f9fbf",
      );
  }
  // cercas baixas, caixotes e o mato
  {
    const cerca = (xa: number, za: number, xb: number, zb: number) => {
      const L = Math.hypot(xb - xa, zb - za),
        n = Math.max(1, Math.round(L / (T * 0.8))),
        a = Math.atan2(zb - za, xb - xa);
      for (let i = 0; i <= n; i++)
        mbBox(
          o,
          M4.ch(M4.T(xa + ((xb - xa) * i) / n, 8, za + ((zb - za) * i) / n), M4.S(3, 16, 3)),
          gmix(MAD, ESC, grnd() * 0.5),
        );
      for (const y of [6, 12])
        mbBox(o, M4.ch(M4.T((xa + xb) / 2, y, (za + zb) / 2), M4.RY(-a), M4.S(L, 2, 1.6)), "#8a5a2b", 1, 0.04);
    };
    const c4 = Pd.casa4;
    cerca(
      (c4.x - c4.w / 2 - 0.6) * T,
      (c4.z - c4.d / 2 - 0.5) * T,
      (c4.x + c4.w / 2 + 1.4) * T,
      (c4.z - c4.d / 2 - 0.5) * T,
    );
    cerca(
      (c4.x + c4.w / 2 + 1.4) * T,
      (c4.z - c4.d / 2 - 0.5) * T,
      (c4.x + c4.w / 2 + 1.4) * T,
      (c4.z + c4.d / 2 + 0.6) * T,
    );
    cerca(T * 12.5, T * 12.6, T * 18.6, T * 12.6);
    // v8.0: a horta no cercado da casa 4 e o feno ao lado
    vtPor("horta", (c4.x + c4.w / 2 + 0.7) * T, c4.z * T, T * 1.2, T * 1.6, Math.PI / 2);
    vtPor("feno", (c4.x + c4.w / 2 + 2.2) * T, (c4.z + 0.4) * T, T * 0.6, T * 1.1);
    caixote(o, T * 26.6, T * 6.1, 0.4);
    barril(o, T * 25.8, T * 6.3);
    caixote(o, T * 18.6, T * 5.6, 1.1, 0.8);
  }
  // árvores atrás das casas e nas pontas; moitas na frente
  for (let x = -6 * T; x < W + 6 * T; x += T * (0.9 + grnd() * 0.6))
    mbTree(o, x, -T * (0.2 + grnd() * 2.4), grnd() < 0.3 ? 1 : 0, 0.85 + grnd() * 0.4);
  for (const lado of [0, 1])
    for (let z = T; z < H + 2 * T; z += T * (1 + grnd() * 0.7)) {
      const x = lado ? W + T * (0.6 + grnd() * 3) : -T * (0.8 + grnd() * 3);
      if (lado && z > C.agua.z0 * T - T) continue; // a leste, embaixo, é água
      if (Math.hypot(x - e.x, z - e.y) < T * 2.5) continue;
      if (grnd() < 0.7) mbTree(o, x, z, grnd() < 0.3 ? 1 : 0, 0.8 + grnd() * 0.4);
      else mbIco(o, M4.ch(M4.T(x, 4, z), M4.RY(grnd() * 3), M4.S(12, 9, 11)), "#868a90", 0, 0.35, 0.12);
    }
  for (let x = -T * 2; x < C.agua.x0 * T - T; x += T * (1.6 + grnd()))
    if (!mbCenario(o, "moita", x, H + T * (0.5 + grnd() * 1.2), 0.8))
      mbIco(o, M4.ch(M4.T(x, 5, H + T), M4.S(16, 10, 14)), "#5f8a3a", 0, 0.3, 0.1);
  for (let i = 0; i < 70; i++) {
    const x = -2 * T + grnd() * (W + 4 * T),
      z = -T + grnd() * (H + 2 * T),
      cx = x / T,
      cz = z / T;
    if (Math.abs(cz - C.rua.z) < 1.2 || Math.hypot(cx - C.praca.x, cz - C.praca.z) < C.praca.r + 0.3) continue;
    if (naAgua(cx, cz) || cz > C.agua.z0 - 0.8) continue;
    if (Object.values(Pd).some((p) => Math.abs(cx - p.x) < p.w / 2 + 0.6 && Math.abs(cz - p.z) < p.d / 2 + 0.6))
      continue;
    for (let j = 0; j < 3; j++) {
      const a = grnd() * 6.28;
      mbCyl(
        o,
        M4.ch(
          M4.T(x + Math.cos(a) * 1.5, 0, z + Math.sin(a) * 1.5),
          M4.RX((grnd() - 0.5) * 0.9),
          M4.RZ((grnd() - 0.5) * 0.9),
          M4.S(0.5, 5 + grnd() * 3, 0.5),
        ),
        "#6d8f38",
        3,
        0,
      );
    }
  }
  const deco = glMesh(o);
  deco.stat = true; // sombra em cache, como o resto do cenário fixo
  deco.uid = ++MALHA._statUid;
  const tex = vtMalha();
  if (tex) {
    tex.stat = true;
    tex.uid = ++MALHA._statUid;
  }
  return { floor: glMesh(b), deco, tex };
}

/** Os moradores e a luz das lanternas (armasGLPush chama, a cada quadro). */
export function vilaGL() {
  const d = dungeon;
  if (!d.active || !d.vila) return;
  const T = d.tile;
  for (const L of C.lanternas.slice(0, 3)) GL3.fogos.push([L.x * T + 10, L.z * T, 0.45]);
  const an = cacadorAnimado(0, 0, {});
  if (!an) return;
  const pos: { x: number; z: number; tom: number[] }[] = [];
  for (const l of C.lugares)
    if (l.morador) pos.push({ x: l.x + l.morador.dx, z: l.z + l.morador.dz, tom: l.morador.tom });
  for (const c of C.cavaleiros) pos.push({ x: c.x, z: c.z, tom: C.tomCavaleiro });
  for (const p of pos) {
    const x = p.x * T,
      z = p.z * T,
      perto = Math.hypot(d.px - x, d.py - z) < T * 3.5,
      yaw = perto ? Math.atan2(d.py - z, d.px - x) : Math.PI / 2; // de frente para a rua; olha para ela se chegar perto
    glPush(an.mesh, M4.ch(M4.T(x, 0, z), M4.RY(-yaw), M4.S(1.3)), p.tom);
  }
}

/** As placas sobre as portas (armasDraw2D chama): o nome do lugar; o da porta em que ela está fica dourado. */
export function vilaDraw2D() {
  const d = dungeon;
  if (!d.active || !d.vila) return;
  const c = TELAS.dCtx,
    T = d.tile,
    perto = vilaPerto();
  c.save();
  c.textAlign = "center";
  c.lineJoin = "round";
  for (const l of C.lugares) {
    const x = l.x * T,
      y = l.z * T - T * 1.15,
      on = l === perto;
    c.font = (on ? "700 15px" : "600 12px") + " Cinzel, serif";
    c.lineWidth = 4;
    c.strokeStyle = "rgba(20,12,4,.8)";
    c.fillStyle = on ? "#ffd24a" : "#f4ead2";
    c.strokeText(l.placa, x, y);
    c.fillText(l.placa, x, y);
  }
  c.restore();
}

/** Para testes e o GameShark: onde fica a porta de um lugar (em px do campo). */
export function vilaPorta(id: string): Ponto | null {
  const l = C.lugares.find((x) => x.id === id);
  return l ? { x: casas(l.x), y: casas(l.z) } : null;
}
