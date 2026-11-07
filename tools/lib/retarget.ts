/* ==== v7.7 — retarget: animação do Mixamo (FBX) → esqueleto do Tripo (o do jogo), por nome de osso ====
   Os dois esqueletos têm os mesmos nomes, mas os ossos estão orientados de outro jeito no repouso. Para cada osso:
   giro no mundo = rotação global da animação × inversa da global na pose T do Mixamo; a global do Tripo = esse giro ×
   a global do Tripo na pose T; a local = inversa da global do pai (Tripo) × a global. O quadril anda o mesmo tanto que
   no Mixamo, na escala da altura do quadril. As duas poses T têm de ser a mesma pose (a do .glb exportado em pose T). */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { lerFbx, quatEuler, amostrarCurva, type Fbx, type OssoFbx } from "./fbx.ts";
import { poseGlobal, type Rig } from "./esqueleto.ts";

type Q = number[];
export const qmul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qinv = (a: Q): Q => [-a[0], -a[1], -a[2], a[3]];
export const qrot = (q: Q, v: number[]) => {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q));
  return [p[0], p[1], p[2]];
};
/** Quatérnio da parte de rotação de uma matriz 4×4 (coluna) com escala uniforme. */
export function quatMat(m: ArrayLike<number>): Q {
  const s = Math.hypot(m[0], m[1], m[2]) || 1;
  const a = [m[0] / s, m[1] / s, m[2] / s, m[4] / s, m[5] / s, m[6] / s, m[8] / s, m[9] / s, m[10] / s];
  const tr = a[0] + a[4] + a[8];
  let x, y, z, w;
  if (tr > 0) {
    const k = Math.sqrt(tr + 1) * 2;
    w = k / 4;
    x = (a[5] - a[7]) / k;
    y = (a[6] - a[2]) / k;
    z = (a[1] - a[3]) / k;
  } else if (a[0] > a[4] && a[0] > a[8]) {
    const k = Math.sqrt(1 + a[0] - a[4] - a[8]) * 2;
    w = (a[5] - a[7]) / k;
    x = k / 4;
    y = (a[3] + a[1]) / k;
    z = (a[6] + a[2]) / k;
  } else if (a[4] > a[8]) {
    const k = Math.sqrt(1 + a[4] - a[0] - a[8]) * 2;
    w = (a[6] - a[2]) / k;
    x = (a[3] + a[1]) / k;
    y = k / 4;
    z = (a[7] + a[5]) / k;
  } else {
    const k = Math.sqrt(1 + a[8] - a[0] - a[4]) * 2;
    w = (a[1] - a[3]) / k;
    x = (a[6] + a[2]) / k;
    y = (a[7] + a[5]) / k;
    z = k / 4;
  }
  return [x, y, z, w];
}

/** Lê "arquivo.fbx" ou "pacote.zip/entrada.fbx" (zip: método 0 ou 8). */
export function lerFbxDe(caminho: string): Fbx {
  return lerFbx(lerArquivoDe(caminho));
}
/** Os bytes de "arquivo" ou "pacote.zip/entrada" (zip: método 0 ou 8). */
export function lerArquivoDe(caminho: string): Buffer {
  const i = caminho.toLowerCase().indexOf(".zip/");
  if (i < 0) return readFileSync(caminho);
  const zip = readFileSync(caminho.slice(0, i + 4)),
    entrada = caminho.slice(i + 5);
  let fim = zip.length - 22;
  while (fim > 0 && zip.readUInt32LE(fim) !== 0x06054b50) fim--;
  let o = zip.readUInt32LE(fim + 16);
  const n = zip.readUInt16LE(fim + 10);
  for (let k = 0; k < n; k++) {
    const metodo = zip.readUInt16LE(o + 10),
      tam = zip.readUInt32LE(o + 20),
      ln = zip.readUInt16LE(o + 28),
      le = zip.readUInt16LE(o + 30),
      lc = zip.readUInt16LE(o + 32),
      local = zip.readUInt32LE(o + 42),
      nome = zip.toString("utf8", o + 46, o + 46 + ln);
    if (nome === entrada) {
      const ini = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28),
        dados = zip.subarray(ini, ini + tam);
      return metodo === 8 ? inflateRawSync(dados) : Buffer.from(dados);
    }
    o += 46 + ln + le + lc;
  }
  throw new Error(`não achei ${entrada} em ${caminho.slice(0, i + 4)}`);
}

/** Rotações globais (quatérnios) e posições globais dos ossos do FBX no tempo t (null = pose de repouso). */
export function globaisFbx(F: Fbx, t: number | null) {
  const loc = F.ossos.map((o: OssoFbx) => {
    const r = t != null && o.curvas.R ? amostrarCurva(o.curvas.R, t) : o.r,
      tr = t != null && o.curvas.T ? amostrarCurva(o.curvas.T, t) : o.t;
    return { q: qmul(qmul(quatEuler(o.pre, 0), quatEuler(r, o.ordem)), qinv(quatEuler(o.post, 0))), t: tr };
  });
  const gq: Q[] = [],
    gp: number[][] = [];
  const calc = (i: number) => {
    if (gq[i]) return;
    const p = F.ossos[i].pai;
    if (p < 0) {
      gq[i] = loc[i].q;
      gp[i] = loc[i].t;
      return;
    }
    calc(p);
    gq[i] = qmul(gq[p], loc[i].q);
    const d = qrot(gq[p], loc[i].t);
    gp[i] = [gp[p][0] + d[0], gp[p][1] + d[1], gp[p][2] + d[2]];
  };
  F.ossos.forEach((_, i) => calc(i));
  return { gq, gp };
}

/**
 * Pose do Tripo (rotação local de cada nó do rig, translação local da raiz) para a animação F no tempo t,
 * usando `bind` como a pose T do Mixamo. `nos`: índices de nó do rig das juntas mantidas (a 1ª é a raiz/quadril).
 */
export function retargetPose(rig: Rig, nos: number[], bind: Fbx, F: Fbx, t: number, quadril0?: number[]) {
  const idx = (Fx: Fbx, nome: string) => Fx.ossos.findIndex((o) => o.nome === nome);
  const nomeNo = (i: number) => (rig.nos[i].name ?? "").replace(/^mixamorig\d*:/, "");
  const B = globaisFbx(bind, null),
    A = globaisFbx(F, t);
  const tripoBind = poseGlobal(rig, null, 0).map(quatMat);
  const raizNo = nos[0],
    paiRaiz = rig.pais[raizNo];
  const globTripo = new Map<number, Q>();
  if (paiRaiz >= 0) globTripo.set(paiRaiz, tripoBind[paiRaiz]);
  const local: Q[] = [];
  for (const no of nos) {
    const ib = idx(bind, nomeNo(no)),
      ia = idx(F, nomeNo(no));
    let g: Q;
    if (ib < 0 || ia < 0) g = tripoBind[no];
    else g = qmul(qmul(A.gq[ia], qinv(B.gq[ib])), tripoBind[no]);
    globTripo.set(no, g);
    const p = rig.pais[no];
    const gp = globTripo.get(p) ?? (p >= 0 ? tripoBind[p] : [0, 0, 0, 1]);
    const l = qmul(qinv(gp), g);
    const n = Math.hypot(...l) || 1;
    local.push(l.map((v) => v / n));
  }
  // quadril: o deslocamento do Mixamo (no mundo), na escala da altura do quadril
  const ih = idx(F, "Hips"),
    ibh = idx(bind, "Hips");
  const hr = rig.nos[raizNo].translation ?? [0, 0, 0];
  let tq = hr;
  if (ih >= 0 && ibh >= 0) {
    // v8.1 — `quadril0`: o quadril medido contra o 1º quadro do próprio clip, não contra a pose T de referência (clip
    // baixado com outro personagem do Mixamo, de outra escala: o Walking.fbx do mantenedor, 2026-11-01, pulava)
    const ref = quadril0 ?? B.gp[ibh];
    const esc = (hr[1] || 1) / (ref[1] || 1),
      d = [0, 1, 2].map((k) => (A.gp[ih][k] - ref[k]) * esc);
    // o pai da raiz (Armature) é a identidade no rig do Tripo: o deslocamento do mundo é o da translação local
    tq = [hr[0] + d[0], hr[1] + d[1], hr[2] + d[2]];
  }
  return { r: local, t: tq };
}
