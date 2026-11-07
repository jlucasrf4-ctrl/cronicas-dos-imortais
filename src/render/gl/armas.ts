/* ==== Fase 4 — modelos 3D das armas e a pose da lança (v4.8) ==== */
import { armaModelo, armaPontos } from "./armas3d.ts";
import { contatoPeleBicho } from "./bichos.ts";
import { wolfBody } from "../../field/acertos.ts";
import { wpnKey } from "../../field/armas.ts";
import { GL3, dungeon } from "../../core/state.ts";
import type { EstadoGL3 } from "../../core/state.ts";
import { MALHA, M4, type Vec3 } from "./geometria.ts";
import { MB, mbCyl, mbBox, glMesh, mbIco } from "./malhas.ts";
import { WPN_OF, KNIFE_KEYS, CRAV2 } from "../../data/combate.ts";
import { ITEM_DEFS } from "../../data/itens.ts";
import { knifeActive } from "../../field/faca_corda.ts";
import { isLanca } from "../../items/galho.ts";
import type { GLMesh, Hero, Repasse } from "../../core/tipos.ts";

/** v7.7 — tamanho do modelo da faca na mão (1 = o de antes; 0,4 = 60% menor: parecia uma espada). Só a aparência:
 *  o alcance do golpe da faca é outra tabela (FACA2 em data/combate.ts). */
const FACA_TAM = 0.4;

const PONTAS_CRAVADAS = new Map<string, { ponta: number; comprimento: number }>();
/** A arma acompanha a ferida no corpo; só a fração da lâmina enterrada avança. */
export function armaCravadaMatriz(escala: number, mao?: Vec3) {
  const C = dungeon.crav;
  if (!C) return null;
  const m = C.m;
  let medida = PONTAS_CRAVADAS.get(C.key);
  if (!medida) {
    const pontos = armaPontos(C.key),
      ponta = pontos ? Math.max(...pontos.map((p) => p[0])) : C.f === "lanca" ? 36.5 : C.f === "faca" ? 6.8 : 32,
      inicio = C.f === "lanca" ? (pontos ? Math.min(...pontos.map((p) => p[0])) : -17) : C.f === "faca" ? 2 : 5;
    medida = { ponta, comprimento: Math.max(1, ponta - inicio) };
    PONTAS_CRAVADAS.set(C.key, medida);
  }
  const a = Math.atan2(dungeon.py - m.y, dungeon.px - m.x),
    r = wolfBody(m).r,
    profundidade = medida.comprimento * Math.min(CRAV2.fundo, C.dep ?? 0.02) * escala,
    altura = m.humano
      ? 25
      : m.sp === "deer"
        ? 24
        : m.sp === "rabbit"
          ? 5
          : m.sp === "fox"
            ? 10
            : 12 * (m.boss ? 1.65 : m.big || 0.95),
    alvo: Vec3 = [m.x, altura, m.y],
    palma = mao ?? [dungeon.px - Math.cos(a) * 10, 30, dungeon.py - Math.sin(a) * 10],
    dx = alvo[0] - palma[0],
    dy = alvo[1] - palma[1],
    dz = alvo[2] - palma[2],
    distancia = Math.hypot(dx, dy, dz) || 1,
    direcao: Vec3 = [dx / distancia, dy / distancia, dz / distancia],
    origem: Vec3 = [alvo[0] - direcao[0] * 200, alvo[1] - direcao[1] * 200, alvo[2] - direcao[2] * 200],
    entrada = contatoPeleBicho(m, origem, direcao) ?? [m.x + Math.cos(a) * r, altura, m.y + Math.sin(a) * r],
    fora = medida.ponta * escala - profundidade;
  return M4.ch(
    M4.T(
      entrada[0] - (dx / distancia) * fora,
      entrada[1] - (dy / distancia) * fora,
      entrada[2] - (dz / distancia) * fora,
    ),
    M4.RY(-Math.atan2(dz, dx)),
    M4.RZ(Math.atan2(dy, Math.hypot(dx, dz))),
    M4.S(escala),
  );
}

/* ---- modelos 3D (mesmo eixo da espada: o cabo na mão, a arma ao longo de +x) ---- */
export function wpnMesh(this: unknown, h: Hero, _P: Record<string, GLMesh>) {
  /* v6.1.3 — ==== v6.1.3 — faca: modelo próprio (não mais a lança) e golpe próprio (estocadas curtas e rápidas, não o combo da espada) ==== */
  const k = wpnKey(h);
  // v8.0: as armas desenhadas (armas3d.ts) no lugar das feitas por código; sem arma na mão = a espada
  const desenhada = GL3.gl ? armaModelo(k ?? "eq_espada") : null;
  if (desenhada) return desenhada;
  if (!(k && KNIFE_KEYS.includes(k)) || !GL3.gl) return wpnMeshBase.apply(this, arguments as Repasse);
  const id = "w_" + k;
  if (GL3.mesh[id]) return GL3.mesh[id];
  const prev = MALHA._icoBoost;
  MALHA._icoBoost = 1;
  MALHA._gs = 78;
  const b = MB(),
    old = k !== "eq_faca"; // a Velha e a Simples: cabo escuro e lâmina sem brilho
  const wood = old ? "#5e3c1e" : "#6a4524",
    strap = "#8a6a3a",
    steel = old ? "#a7a49c" : "#d8dee6",
    S = M4.S(FACA_TAM); // v7.7: só a aparência encolhe, a partir do cabo na mão
  mbCyl(b, M4.ch(S, M4.T(-4, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.6, 8, 1.6)), wood, 7, 1, 0.04); // cabo
  for (let i = 0; i < 3; i++)
    mbCyl(b, M4.ch(S, M4.T(-3 + i * 2.3, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.8, 0.9, 1.8)), strap, 7, 1); // tiras de couro
  mbBox(b, M4.ch(S, M4.T(4.4, 0, 0), M4.S(1, 1.2, 4)), old ? "#6e6a62" : "#9aa3ae"); // guarda
  mbCyl(b, M4.ch(S, M4.T(5, 0, 0), M4.RZ(-Math.PI / 2), M4.S(2.6, 12, 0.7)), steel, 4, 0.15, 0.02); // lâmina afinando
  MALHA._icoBoost = prev;
  const m = glMesh(b);
  m.ol = true;
  GL3.mesh[id] = m;
  return m;
}
// etapa de wpnMesh: original
function wpnMeshBase(h: Hero, P: Record<string, GLMesh>) {
  const k = wpnKey(h);
  if (!k || WPN_OF[k] === "espada" || !GL3.gl) return P.sword;
  const id = "w_" + k;
  if (GL3.mesh[id]) return GL3.mesh[id];
  const prev = MALHA._icoBoost;
  MALHA._icoBoost = 1;
  MALHA._gs = 77;
  const b = MB(),
    wood = "#7a4e28",
    dark = "#4a2e16",
    iron = "#9aa3ae",
    steel = "#d8dee6";
  if (k === "eq_clava") {
    mbCyl(b, M4.ch(M4.T(-5, 0, 0), M4.RZ(-Math.PI / 2), M4.S(2.2, 9, 2.2)), dark, 7, 1.1);
    mbCyl(b, M4.ch(M4.T(3.5, 0, 0), M4.RZ(-Math.PI / 2), M4.S(3.2, 14, 3.2)), wood, 8, 1.9, 0.05);
    mbIco(b, M4.ch(M4.T(17.5, 0, 0), M4.S(6.4, 6.2, 6.2)), wood, 1, 0.1, 0.05);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.283;
      mbCyl(
        b,
        M4.ch(M4.T(12 + (i % 2) * 4, Math.cos(a) * 3.4, Math.sin(a) * 3.4), M4.RX(a), M4.S(1.1, 2.2, 1.1)),
        iron,
        4,
        0,
      );
    }
  } else if (k === "eq_machado") {
    mbCyl(b, M4.ch(M4.T(-6, 0, 0), M4.RZ(-Math.PI / 2), M4.S(2, 26, 2)), wood, 7, 1, 0.04);
    mbBox(b, M4.ch(M4.RX(Math.PI), M4.T(16.5, 2.2, 0), M4.S(5, 7, 1.4)), iron, 1);
    mbCyl(b, M4.ch(M4.RX(Math.PI), M4.T(16.5, 5, 0), M4.S(9, 4.5, 1.1)), steel, 10, 1);
    mbBox(b, M4.ch(M4.RX(Math.PI), M4.T(16.5, -1.5, 0), M4.S(3.6, 2.6, 2.6)), iron, 1);
  } else if (k === "eq_picareta") {
    // v8.1: cabo como o do machado e a cabeça em arco, com as duas pontas; cada braço sai do bloco do meio e a ponta
    // continua do fim do braço (mantenedor: "juntinha, as partes flutuando; uns 35% mais fina")
    mbCyl(b, M4.ch(M4.T(-6, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.3, 25, 1.3)), wood, 7, 1, 0.04);
    mbBox(b, M4.ch(M4.T(17.5, 0, 0), M4.S(2.6, 3, 2.1)), iron, 1);
    const braco = 8,
      ponta = 3;
    for (const s of [1, -1]) {
      // o cilindro cresce em +y; girar (π − a) aponta para baixo, inclinado para trás como o de cima
      const a1 = s > 0 ? 0.25 : Math.PI - 0.25,
        a2 = s > 0 ? 0.6 : Math.PI - 0.6,
        x0 = 17.5,
        y0 = s * 1.2,
        x1 = x0 - Math.sin(a1) * braco,
        y1 = y0 + Math.cos(a1) * braco;
      mbCyl(b, M4.ch(M4.T(x0, y0, 0), M4.RZ(a1), M4.S(1.2, braco, 1.2)), steel, 6, 0.6);
      mbCyl(b, M4.ch(M4.T(x1, y1, 0), M4.RZ(a2), M4.S(0.72, ponta, 0.72)), steel, 5, 0);
    }
  } else {
    // lança (v8.0: cabo mais fino, 1,7 → 1,05, e as ponteiras de ferro junto)
    mbCyl(b, M4.ch(M4.T(-16, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.05, 42, 1.05)), wood, 7, 1, 0.03);
    mbCyl(b, M4.ch(M4.T(-17, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.45, 2, 1.45)), iron, 7, 1);
    mbCyl(b, M4.ch(M4.T(25.5, 0, 0), M4.RZ(-Math.PI / 2), M4.S(1.8, 2.5, 1.8)), iron, 7, 1);
    mbCyl(b, M4.ch(M4.T(27.5, 0, 0), M4.RZ(-Math.PI / 2), M4.S(4.2, 9, 1.4)), steel, 4, 0);
    mbBox(b, M4.ch(M4.T(25, 0, 0), M4.S(1.2, 0.9, 4)), "#c03a2a");
  }
  MALHA._icoBoost = prev;
  const m = glMesh(b);
  m.ol = true;
  GL3.mesh[id] = m;
  return m;
}
export function spearMesh() {
  const fake = { equip: { maoD: { def: ITEM_DEFS.eq_lanca } } } as unknown as Hero;
  /* herói falso: só a lança na mão */ return wpnMesh(fake, {});
}
export function spearPoseOv(this: unknown, _A: EstadoGL3["atk"], _sw: number) {
  // O corpo mantém a pose; a arma desliza até a profundidade dentro da pele.
  const d = dungeon,
    C = d.crav;
  if (!C || d.down! > 0) return spearPoseOvBase.apply(this, arguments as Repasse);
  GL3.noTrail = true;
  const ext = 0.8;
  if (C.f === "lanca") {
    const armZ = 0.6 + 0.95 * ext;
    return {
      tw: -0.18,
      lean: 0.1 * ext,
      lift: 0,
      armY: -0.12,
      armZ,
      fwd: 4 * ext - 1.5 * Math.max(0, ext - 0.6),
      wr: -armZ + 0.04,
    };
  }
  const armZ = 0.55 + 1.0 * ext;
  return {
    tw: -0.25,
    lean: 0.12 * ext,
    lift: 0,
    armY: -0.05,
    armZ,
    fwd: 3 * ext,
    wr: -armZ + 0.1,
  };
}
// etapa de spearPoseOv: original + v5.9.02 + v6.1.3
function spearPoseOvBase(A: EstadoGL3["atk"], _sw: number) {
  // pose da lança: segurada na horizontal, estocada para a frente
  /* v6.1.3 — pose 3D: braço vai reto para a frente e volta (como a lança, mas curto e de uma mão) */
  {
    const d = dungeon,
      h = d.hero;
    if (
      h &&
      d.weapon === "melee" &&
      !d.spearOut &&
      !(d.down! > 0) &&
      knifeActive(h) &&
      (wpnKey(h) === null || KNIFE_KEYS.includes(wpnKey(h)!))
    ) {
      GL3.noTrail = true;
      let ext = 0;
      if (A) {
        const t = A.t,
          p = Math.min(1, t / 0.05),
          e = 1 - Math.pow(1 - p, 2),
          r = Math.max(0, Math.min(1, (t - 0.07) / 0.1));
        ext = e * (1 - r * r * (3 - 2 * r));
      }
      const armZ = 0.55 + 1.0 * ext;
      return {
        tw: -0.25 + (A && A.step === 1 ? 0.25 : 0) * ext,
        lean: 0.12 * ext,
        lift: 0,
        armY: -0.05,
        armZ,
        fwd: 3 * ext,
        wr: -armZ + 0.1,
      };
    }
  }
  /* v5.9.02 — pose: arma erguida enquanto carrega */
  {
    const d = dungeon,
      v = d.hv;
    if (v && d.weapon === "melee") {
      const c = v.ch;
      GL3.noTrail = true;
      return {
        tw: -0.35 * c,
        lean: -0.16 * c,
        lift: 0,
        armY: 0.25 * c,
        armZ: 0.35 + 2.5 * c,
        fwd: -2 * c,
        wr: -1.3 * c,
      };
    }
  }
  const d = dungeon;
  if (d.down! > 0) {
    GL3.noTrail = true;
    const k = Math.max(0, Math.min(1, ((d.derrubada || 1.1) - d.down!) / 0.15)) * Math.min(1, d.down! / 0.3);
    return { tw: 0, lean: -1.25 * k, lift: -6 * k, armY: 0.4, armZ: 1.2 * k, fwd: -4 * k, wr: 0 };
  } // derrubado
  if (d.weapon === "bow" && d.dodge && d.dodge.roll) {
    GL3.noTrail = true;
    const p = 1 - Math.max(0, d.dodge.t / d.dodge.dur);
    return { tw: 0, lean: 0.7 * Math.sin(Math.PI * p), lift: 0, armY: 0.3, armZ: 0.9, fwd: 0, wr: -0.6 };
  }
  if (d.weapon === "bow" || !isLanca(wpnKey(d.hero!)!)) {
    GL3.noTrail = false;
    return null;
  }
  GL3.noTrail = true;
  if (d.spCh) {
    const c = d.spCh.ch;
    return {
      tw: -0.25 - 0.45 * c,
      lean: -0.12 * c,
      lift: 0,
      armY: 0.35 * c,
      armZ: 0.6 + 0.35 * c,
      fwd: -5 * c,
      wr: -0.6 - 0.35 * c,
    };
  }
  let ext = 0;
  if (A) {
    const t = A.t,
      p = Math.min(1, t / 0.07),
      e = 1 - Math.pow(1 - p, 2),
      r = Math.max(0, Math.min(1, (t - 0.09) / 0.14));
    ext = e * (1 - r * r * (3 - 2 * r));
  }
  const sv = d.shove! > 0 ? Math.sin(Math.PI * Math.min(1, (0.3 - d.shove!) / 0.3)) : 0,
    armZ = 0.6 + 0.95 * ext;
  return {
    tw: -0.18,
    lean: 0.1 * ext + 0.2 * sv,
    lift: 0,
    armY: -0.12,
    armZ,
    fwd: 4 * ext - 1.5 * Math.max(0, ext - 0.6) + 5 * sv,
    wr: -armZ + 0.04,
  };
}
