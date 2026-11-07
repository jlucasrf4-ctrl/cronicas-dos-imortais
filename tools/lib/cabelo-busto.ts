/** Reaproveita as mechas completas da cabeça trocável, sem recortá-las com cintura e braços. */
import type { Anim } from "../../src/render/gl/esqueleto.ts";
import type { CabecaDados } from "../../src/render/gl/aparencias.ts";
export interface OrigemCabelo {
  x: number;
  y: number;
  z: number;
  u: number;
}
/** Identifica fragmentos da versão anterior junto à superfície das mechas substitutas. */
export function fragmentosCabelo(cab: CabecaDados, origem: OrigemCabelo, P: ArrayLike<number>, I: ArrayLike<number>) {
  const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
  const hp = new Int16Array(bytes(cab.p).buffer),
    hi = new Uint16Array(bytes(cab.i).buffer),
    hm = bytes(cab.mascara!);
  const cel = origem.u * 0.15,
    grade = new Map<string, number[][]>();
  const adicionar = (p: number[]) => {
    const key = p.map((v) => Math.floor(v / cel)).join(",");
    const l = grade.get(key) ?? [];
    l.push(p);
    grade.set(key, l);
  };
  for (let t = 0; t < hi.length / 3; t++)
    if (hm[t] === 2) {
      const ps = [0, 1, 2].map((k) => {
        const v = hi[t * 3 + k];
        return [
          origem.x + (hp[v * 3] / 1000) * origem.u,
          origem.y + (hp[v * 3 + 1] / 1000) * origem.u,
          origem.z + (hp[v * 3 + 2] / 1000) * origem.u,
        ];
      });
      for (const p of ps) adicionar(p);
      adicionar([0, 1, 2].map((e) => ps.reduce((s, p) => s + p[e], 0) / 3));
    }
  const fora = new Uint8Array(I.length / 3);
  for (let t = 0; t < fora.length; t++) {
    const p = [0, 1, 2].map((e) => [0, 1, 2].reduce((s, k) => s + P[I[t * 3 + k] * 3 + e], 0) / 3);
    if (p[1] < origem.y - origem.u * 2.1 && Math.abs(p[0] - origem.x) < origem.u * 2.3 && p[2] < -0.03) {
      fora[t] = 1;
      continue;
    }
    if (p[2] > -0.015 || p[1] > origem.y) continue;
    const g = p.map((v) => Math.floor(v / cel));
    let distancia = Infinity;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const q of grade.get([g[0] + x, g[1] + y, g[2] + z].join(",")) ?? [])
            distancia = Math.min(distancia, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2);
    if (distancia < cel * cel) fora[t] = 1;
  }
  return fora;
}
export function substituirCabeloBusto(
  A: Anim,
  mascara: Uint8Array,
  regioes: Uint8Array,
  cab: CabecaDados,
  origem: OrigemCabelo,
  ajuste: { escala: number; TX: number; TY: number; eixoX: number; eixoZ: number; fatorV: number },
) {
  const ler = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
  const hp = new Int16Array(ler(cab.p).buffer),
    hi = new Uint16Array(ler(cab.i).buffer),
    hm = ler(cab.mascara!);
  const huv = new Uint16Array(ler(cab.uv!).buffer),
    hc = ler(cab.c);
  const P = Array.from(A.P),
    J = Array.from(A.J),
    W = Array.from(A.W),
    I: number[] = [],
    C: number[] = [],
    UV: number[] = [],
    mask: number[] = [],
    reg: number[] = [];
  for (let t = 0; t < A.I.length / 3; t++)
    if (mascara[t] !== 2) {
      I.push(...A.I.subarray(t * 3, t * 3 + 3));
      C.push(...A.C.subarray(t * 3, t * 3 + 3));
      UV.push(...A.UV!.subarray(t * 6, t * 6 + 6));
      mask.push(mascara[t]);
      reg.push(regioes[t]);
    }
  const mapa = new Map<number, number>(),
    head = A.juntas.indexOf("Head");
  if (head < 0) throw Error("Cabelo sem junta Head");
  for (let t = 0; t < hi.length / 3; t++)
    if (hm[t] === 2) {
      for (let k = 0; k < 3; k++) {
        const v = hi[t * 3 + k];
        let n = mapa.get(v);
        if (n == null) {
          n = P.length / 3;
          mapa.set(v, n);
          const raw = [
            origem.x + (hp[v * 3] / 1000) * origem.u,
            origem.y + (hp[v * 3 + 1] / 1000) * origem.u,
            origem.z + (hp[v * 3 + 2] / 1000) * origem.u,
          ];
          P.push(
            ajuste.TX + raw[2] * ajuste.escala,
            ajuste.TY + raw[1] * ajuste.escala,
            ajuste.eixoZ - (raw[0] - ajuste.eixoX) * ajuste.escala,
          );
          J.push(head, 0, 0, 0);
          W.push(1, 0, 0, 0);
        }
        I.push(n);
        UV.push(huv[t * 6 + k * 2] / 65535, (huv[t * 6 + k * 2 + 1] / 65535) * ajuste.fatorV);
      }
      C.push(hc[t * 3] / 255, hc[t * 3 + 1] / 255, hc[t * 3 + 2] / 255);
      mask.push(2);
      reg.push(1);
    }
  if (P.length / 3 > 65535) throw Error("Cabelo excede índices Uint16");
  const ini = new Uint32Array(P.length / 3 + 1);
  for (const v of I) ini[v + 1]++;
  for (let v = 0; v < ini.length - 1; v++) ini[v + 1] += ini[v];
  const pos = ini.slice(0, -1),
    cantos = new Uint32Array(I.length);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  return {
    malha: {
      ...A,
      P: Float32Array.from(P),
      J: Uint8Array.from(J),
      W: Float32Array.from(W),
      I: Uint16Array.from(I),
      C: Float32Array.from(C),
      UV: Float32Array.from(UV),
      ini,
      cantos,
    },
    mascara: Uint8Array.from(mask),
    regioes: Uint8Array.from(reg),
  };
}
