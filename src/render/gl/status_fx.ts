/* ==== v8.0 — efeitos de estado em 3D (no lugar das estrelinhas de texto do overlay 2D) ====
   Peças low-poly desenhadas pelo próprio renderer, com a luz, a noite e o contorno da cena:
   - atordoado (m.stun): três estrelas facetadas giram sobre a cabeça; entram com um pulo e somem uma a cada terço do
     tempo (a contagem que a barrinha amarela fazia);
   - caído (m.ko): as mesmas estrelas, alaranjadas, mais lentas e numa órbita que balança torta.
   Tabela STATUS_FX: cores, órbita, tamanho, velocidades e a altura da cabeça de cada bicho. */
import { GL3 } from "../../core/state.ts";
import { M4 } from "./geometria.ts";
import { MB, mbTri, mbIco, mbCyl, gcol, glMesh } from "./malhas.ts";
import { glPush } from "./renderer.ts";
import type { GLMesh, Monster } from "../../core/tipos.ts";

const STATUS_FX = {
  ouro: "#f0c050",
  laranja: "#e8923a",
  /** raio da órbita, tamanho da estrela, voltas por segundo (rad/s), giro próprio (rad/s), inclinação para a câmera */
  stun: { raio: 12, tam: 5, vel: 3.1, giro: 4.2, inclina: -0.5, entra: 0.3, sai: 0.18 },
  ko: { raio: 11, tam: 4.2, vel: 1.7, giro: 2.4, inclina: -0.5, torto: 0.35 },
  /** altura da cabeça por espécie do campo (CRIT_SP) e a dos lobos/javalino da masmorra (× a escala do bicho); a
      órbita fica um pouco acima, abaixo da barrinha de vida do overlay */
  altura: { rabbit: 11, fox: 14, deer: 30, deerM: 34, lobo: 20, javali: 18, outro: 20 } as Record<string, number>,
  /** quanto a cabeça fica à frente do centro do bicho, na direção em que ele olha (mesma escala) */
  frente: { rabbit: 4, fox: 8, deer: 14, deerM: 14, lobo: 13, javali: 12, outro: 10 } as Record<string, number>,
  acima: 4,
  /** o bicho caído fica deitado: a cabeça desce para esta fração */
  caido: 0.5,
};

/** estrela de 5 pontas com volume (um "bicone" achatado): raio 1 no plano XY, espessura ±0,35 no centro */
function malhaEstrela(cor: string): GLMesh {
  const b = MB(),
    c = gcol(cor),
    fr = [0, 0, 0.35],
    tr = [0, 0, -0.35],
    ctr = [0, 0, 0];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5,
      p = [Math.cos(a), -Math.sin(a), 0],
      e = [Math.cos(a - Math.PI / 5) * 0.45, -Math.sin(a - Math.PI / 5) * 0.45, 0],
      d = [Math.cos(a + Math.PI / 5) * 0.45, -Math.sin(a + Math.PI / 5) * 0.45, 0];
    mbTri(b, fr, e, p, c, ctr, 1.06);
    mbTri(b, fr, p, d, c, ctr, 0.94);
    mbTri(b, tr, p, e, c, ctr, 0.94);
    mbTri(b, tr, d, p, c, ctr, 1.06);
  }
  const m = glMesh(b);
  m.ol = true;
  return m;
}
function estrelas(cor: "ouro" | "laranja") {
  const k = "fx_estrela_" + cor;
  return GL3.mesh[k] || (GL3.mesh[k] = malhaEstrela(STATUS_FX[cor]));
}
/** Onde fica a cabeça do bicho: [x, altura, z] no mundo. */
function cabeca(m: Monster, ko: boolean) {
  const F = STATUS_FX,
    k = m.critter ? (m.sp === "deer" && m.sex === "M" ? "deerM" : m.sp!) : m.kind === "javalino" ? "javali" : "lobo",
    sc = m.critter ? 1 : m.boss ? 1.65 : m.big || 0.95,
    yaw = (m.critter ? m._yy : m._yaw) ?? m.ang ?? 0,
    fr = (F.frente[k] ?? F.frente.outro) * sc,
    h = (F.altura[k] ?? F.altura.outro) * sc * (ko ? F.caido : 1) + F.acima;
  return [m.x + Math.cos(yaw) * fr, h, m.y + Math.sin(yaw) * fr];
}
const voltaDe = (x: number) => {
  const k = 1.9;
  return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
};

function meshCache(key: string, make: () => GLMesh) {
  return GL3.mesh[key] || (GL3.mesh[key] = make());
}
function malhaGema(cor: string) {
  const b = MB(),
    c = gcol(cor),
    top = [0, 1, 0],
    bottom = [0, -1, 0],
    ring = [
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, 0, -1],
    ];
  for (let i = 0; i < 4; i++) {
    mbTri(b, top, ring[i], ring[(i + 1) % 4], c, [0, 0, 0], i % 2 ? 1.08 : 0.9);
    mbTri(b, bottom, ring[(i + 1) % 4], ring[i], c, [0, 0, 0], i % 2 ? 0.86 : 1.05);
  }
  return glMesh(b);
}
function malhaAmpulheta() {
  const b = MB(),
    wood = gcol("#b78242"),
    sand = gcol("#f0d289"),
    p = [
      [-1, 1, 0],
      [1, 1, 0],
      [-0.18, 0.05, 0],
      [0.18, 0.05, 0],
      [-1, -1, 0],
      [1, -1, 0],
    ];
  mbTri(b, p[0], p[1], p[3], wood, [0, 0, 0], 1);
  mbTri(b, p[0], p[3], p[2], wood, [0, 0, 0], 0.9);
  mbTri(b, p[4], p[2], p[3], wood, [0, 0, 0], 0.85);
  mbTri(b, p[4], p[3], p[5], wood, [0, 0, 0], 1.05);
  mbTri(b, p[2], p[3], [0, -0.55, 0], sand, [0, 0, 0], 1.15);
  // travessas de madeira na parte superior e inferior
  for (const y of [-1, 1])
    mbCyl(b, M4.ch(M4.T(0, y, 0), M4.RZ(Math.PI / 2), M4.S(0.12, 1.18, 0.12)), "#60422a", 5, 0, 0);
  return glMesh(b);
}
function malhaChama() {
  const b = MB(),
    outer = gcol("#f0782c"),
    inner = gcol("#ffd25b"),
    center = [0, 0, 0];
  const a = [-0.5, 0, 0],
    d = [0.5, 0, 0],
    l = [-0.33, 0.55, 0],
    r = [0.33, 0.62, 0],
    tip = [0.05, 1.65, 0],
    front = [0, 0, 0.18],
    back = [0, 0, -0.18];
  mbTri(b, a, l, tip, outer, center, 1.08);
  mbTri(b, l, r, tip, outer, center, 0.92);
  mbTri(b, r, d, tip, outer, center, 1.04);
  mbTri(b, a, front, l, inner, center, 1.12);
  mbTri(b, front, r, l, inner, center, 1);
  mbTri(b, front, d, r, inner, center, 1.08);
  mbTri(b, back, tip, l, outer, center, 0.9);
  mbTri(b, back, r, tip, outer, center, 1.05);
  return glMesh(b);
}
function malhaSopro(cor: string) {
  const b = MB();
  mbIco(b, M4.S(1, 0.78, 0.72), cor, 0, 0, 0.06);
  return glMesh(b);
}

/** Poeira facetada da esquiva do jogador; o desenho segue a posição onde o rolamento começou. */
export function esquivaFxGL(x: number, z: number, dx: number, dz: number, progresso: number) {
  if (!GL3.gl) return;
  const t = performance.now() / 1000,
    poeira = meshCache("fx_poeira", () => malhaSopro("#c9a980")),
    n = Math.max(0, Math.min(1, progresso));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t * 1.4,
      r = 8 + n * 8 + (i % 2) * 3,
      sobe = 1.5 + Math.sin(t * 11 + i) * 1.2;
    glPush(
      poeira,
      M4.ch(
        M4.T(x - dx * 8 + Math.cos(a) * r, sobe, z - dz * 8 + Math.sin(a) * r),
        M4.RY(a),
        M4.S(2.2 + (i % 3) * 0.55, 1.5 + n, 1.8),
      ),
      null,
      false,
    );
  }
}

/** Empurra para a lista de desenho as estrelas do bicho atordoado ou caído (nada se ele não estiver). */
export function statusFxGL(m: Monster) {
  if (m.dummy) return;
  const ko = m.ko! > 0,
    stun = !ko && m.stun! > 0,
    slow = !ko && m.slow! > 0;
  const t = performance.now() / 1000,
    [cx, h, cz] = cabeca(m, ko);
  if (stun) {
    const S = STATUS_FX.stun,
      tot = m.stunMax || m.stun!,
      passou = tot - m.stun!,
      malha = estrelas("ouro");
    for (let k = 0; k < 3; k++) {
      // a estrela k vive enquanto resta mais que k/3 do atordoamento: a última some no fim
      const resta = m.stun! - (tot * k) / 3;
      if (resta <= 0) continue;
      const esc = voltaDe(Math.min(1, Math.max(0, (passou - k * 0.08) / S.entra))) * Math.min(1, resta / S.sai);
      if (esc <= 0.02) continue;
      const a = t * S.vel + (k * 2 * Math.PI) / 3;
      glPush(
        malha,
        M4.ch(
          M4.T(cx + Math.cos(a) * S.raio, h, cz + Math.sin(a) * S.raio),
          M4.RX(S.inclina),
          M4.RY(t * S.giro + k * 2),
          M4.S(S.tam * esc),
        ),
        null,
        false,
      );
    }
  } else if (ko) {
    const S = STATUS_FX.ko,
      malha = estrelas("laranja"),
      torto = Math.sin(t * 0.9) * S.torto;
    for (let k = 0; k < 3; k++) {
      const a = t * S.vel + (k * 2 * Math.PI) / 3,
        ox = Math.cos(a) * S.raio;
      glPush(
        malha,
        M4.ch(
          M4.T(cx + ox, h + ox * torto, cz + Math.sin(a) * S.raio),
          M4.RX(S.inclina),
          M4.RY(t * S.giro + k * 2),
          M4.S(S.tam),
        ),
        null,
        false,
      );
    }
  }

  const sc = m.critter ? 1 : m.boss ? 1.65 : m.big || 0.95,
    yaw = (m.critter ? m._yy : m._yaw) ?? m.ang ?? 0;

  // Lento: duas silhuetas frias ficam para trás; a ampulheta roda e a areia desce.
  if (slow) {
    const amp = meshCache("fx_ampulheta", () => malhaAmpulheta()),
      u = (t * 1.25) % 1;
    glPush(amp, M4.ch(M4.T(cx, h + 8, cz), M4.RY(t * 0.65), M4.S(3.4)), null, false);
    if (!m.critter) {
      const all = GL3.mesh as unknown as { wolf?: { body: GLMesh }[]; boar?: { body: GLMesh } },
        corpo = m.kind === "javalino" ? all.boar?.body : all.wolf?.[Math.max(0, Math.min(6, m.coat || 0))]?.body,
        base = M4.ch(M4.T(m.x, 0, m.y), M4.RY(-yaw), M4.S(sc));
      if (corpo)
        for (let i = 0; i < 2; i++) {
          const dist = 7 + i * 7 + u * 4;
          glPush(
            corpo,
            M4.ch(base, M4.T(-Math.cos(yaw) * dist, 0, -Math.sin(yaw) * dist)),
            [0.68, 0.79, 0.9, 0.28 - i * 0.08],
            false,
          );
        }
    }
  }

  // Cansado: o focinho solta bafo no compasso do fôlego; exausto também sua.
  if (m.folMax && m.folMax > 0 && m.fol != null && m.fol / m.folMax < 0.42 && !ko) {
    const fase = t * (m.fol / m.folMax < 0.18 ? 7.5 : 4.4),
      sopro = meshCache("fx_bafo", () => malhaSopro("#e4e2d3"));
    for (let i = 0; i < 2; i++) {
      const p = (fase + i * Math.PI) % (Math.PI * 2),
        abre = Math.max(0, Math.sin(p)),
        tam = abre * (1.1 + i * 0.35);
      if (tam > 0.12)
        glPush(
          sopro,
          M4.ch(M4.T(cx + 3 + abre * 7, h - 2 + i * 1.2, cz + Math.sin(t * 3 + i) * 2), M4.S(tam * 2.4)),
          null,
          false,
        );
    }
    if (m.fol / m.folMax < 0.2) {
      const gota = meshCache("fx_suor", () => malhaGema("#8bdcf2"));
      for (let i = 0; i < 2; i++) {
        const faseGota = (t * 3 + i * Math.PI) % (Math.PI * 2),
          x = cx - 2 + i * 4;
        glPush(
          gota,
          M4.ch(
            M4.T(x, h + 2 + Math.max(0, Math.sin(faseGota)) * 4, cz + Math.cos(faseGota) * 3),
            M4.S(1.15, 1.8, 0.8),
          ),
          null,
          false,
        );
      }
    }
  }

  // Sangramento: corte visível no dorso e gotas que saltam perto das patas.
  if ((m.bleed && m.bleed.t > 0) || (m.stk && m.stk.length > 0)) {
    const gota = meshCache("fx_sangue", () => malhaGema("#a92028")),
      pulso = Math.sin(t * 8) * 0.5 + 0.5,
      base = M4.ch(M4.T(m.x, 0, m.y), M4.RY(-yaw), M4.S(sc));
    glPush(gota, M4.ch(base, M4.T(-4, 21, 0), M4.RZ(0.9), M4.S(2.2, 3, 1.2)), null, false);
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i * Math.PI * 2) / 3,
        jump = 1 + Math.max(0, Math.sin(t * 7 + i)) * (2 + pulso * 2);
      glPush(
        gota,
        M4.ch(M4.T(m.x + Math.cos(a) * (5 + i * 2), jump, m.y + Math.sin(a) * (4 + i * 2)), M4.S(0.9, 1.35, 0.8)),
        null,
        false,
      );
    }
  }

  // Afinidade de fogo: chamas facetadas sobre o dorso, com altura e balanço animados.
  if (m.runic === "fogo") {
    const fogo = meshCache("fx_chama", () => malhaChama()),
      base = M4.ch(M4.T(m.x, 0, m.y), M4.RY(-yaw), M4.S(sc));
    for (let i = 0; i < 4; i++) {
      const fase = t * 7 + i * 1.9,
        altura = 5 + Math.sin(fase) * 1.7;
      glPush(
        fogo,
        M4.ch(
          base,
          M4.T(-10 + i * 6.5, 24 + Math.sin(fase * 0.7), (i % 2 ? 1 : -1) * 4),
          M4.RZ(Math.sin(fase) * 0.16),
          M4.S(2.4, altura, 1.8),
        ),
        null,
        false,
      );
    }
  }

  // Um animal aquático só ganha cristais quando também está lento (efeito de congelamento).
  if (m.runic === "agua" && slow) {
    const gelo = meshCache("fx_gelo", () => malhaGema("#9ce8f4")),
      base = M4.ch(M4.T(m.x, 0, m.y), M4.RY(-yaw), M4.S(sc));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + t * 0.22,
        r = 15 + (i % 2) * 2,
        h = 2 + (i % 3) * 3;
      glPush(
        gelo,
        M4.ch(base, M4.T(Math.cos(a) * r, h, Math.sin(a) * r * 0.62), M4.RY(-a), M4.S(2.2, 5 + (i % 3), 2.2)),
        null,
        false,
      );
    }
  }
}
