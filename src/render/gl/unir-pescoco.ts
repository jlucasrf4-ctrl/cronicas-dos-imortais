/** Une duas aberturas recortadas na malha, com vértices e pesos compartilhados na emenda. */
import type { Anim } from "./esqueleto.ts";
export interface AjusteUniaoPescoco {
  corpoY: number;
  cabecaY: number;
}
type Canto = { v: number; uv: number[] };
export function unirPescoco(
  A: Anim,
  ntCorpo: number,
  mascaraCabeca: Uint8Array,
  ajuste: AjusteUniaoPescoco,
  corCabeca: number[],
  branco: number[] = [0, 0],
) {
  const P = Array.from(A.P),
    J = Array.from(A.J),
    W = Array.from(A.W),
    I: number[] = [],
    C: number[] = [],
    UV: number[] = [];
  const cortes = [new Map<string, number>(), new Map<string, number>()],
    bordas: [number, number][][] = [[], []];
  const coresBase: number[][] = [];
  function novoVertice(p: number[], pesos: Map<number, number>) {
    const v = P.length / 3;
    P.push(...p);
    const top = [...pesos]
        .filter(([, w]) => w > 1e-8)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
      soma = top.reduce((s, [, w]) => s + w, 0) || 1;
    for (let k = 0; k < 4; k++) {
      J.push(top[k]?.[0] ?? 0);
      W.push((top[k]?.[1] ?? 0) / soma);
    }
    return v;
  }
  function misturar(a: number, b: number, f: number, p?: number[]) {
    const pesos = new Map<number, number>();
    for (const [v, w] of [
      [a, 1 - f],
      [b, f],
    ])
      for (let k = 0; k < 4; k++) pesos.set(J[v * 4 + k], (pesos.get(J[v * 4 + k]) ?? 0) + W[v * 4 + k] * w);
    return novoVertice(p ?? [0, 1, 2].map((e) => P[a * 3 + e] + (P[b * 3 + e] - P[a * 3 + e]) * f), pesos);
  }
  function emitir(a: Canto, b: Canto, c: Canto, cor: number[]) {
    if (new Set([a.v, b.v, c.v]).size < 3) return;
    const u = [0, 1, 2].map((e) => P[b.v * 3 + e] - P[a.v * 3 + e]),
      v = [0, 1, 2].map((e) => P[c.v * 3 + e] - P[a.v * 3 + e]);
    if (Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) < 1e-7) return;
    I.push(a.v, b.v, c.v);
    C.push(...cor);
    if (A.UV) UV.push(...a.uv, ...b.uv, ...c.uv);
  }
  for (let t = 0; t < A.I.length / 3; t++) {
    const corpo = t < ntCorpo,
      lado = corpo ? 0 : 1,
      altura = corpo ? ajuste.corpoY : ajuste.cabecaY;
    const cor = Array.from(A.C.subarray(t * 3, t * 3 + 3));
    const original: Canto[] = [0, 1, 2].map((k) => ({
      v: A.I[t * 3 + k],
      uv: A.UV ? Array.from(A.UV.subarray(t * 6 + k * 2, t * 6 + k * 2 + 2)) : branco,
    }));
    if (!corpo && mascaraCabeca[t - ntCorpo] === 2) {
      emitir(original[0], original[1], original[2], cor);
      continue;
    }
    const dentro = (c: Canto) => (corpo ? P[c.v * 3 + 1] <= altura : P[c.v * 3 + 1] >= altura);
    const pol: Canto[] = [],
      cruza: Canto[] = [];
    for (let k = 0; k < 3; k++) {
      const a = original[k],
        b = original[(k + 1) % 3],
        da = dentro(a),
        db = dentro(b);
      if (da) pol.push(a);
      if (da !== db) {
        const f = (altura - P[a.v * 3 + 1]) / (P[b.v * 3 + 1] - P[a.v * 3 + 1]);
        const pos = [0, 1, 2].map((e) => P[a.v * 3 + e] + (P[b.v * 3 + e] - P[a.v * 3 + e]) * f);
        pos[1] = altura;
        const chave = pos.map((x) => Math.round(x * 1e5)).join(",");
        let v = cortes[lado].get(chave);
        if (v == null) {
          v = misturar(a.v, b.v, f, pos);
          cortes[lado].set(chave, v);
        }
        const c = { v, uv: [0, 1].map((e) => a.uv[e] + (b.uv[e] - a.uv[e]) * f) };
        pol.push(c);
        cruza.push(c);
      }
    }
    for (let k = 1; k + 1 < pol.length; k++) emitir(pol[0], pol[k], pol[k + 1], cor);
    if (cruza.length === 2 && cruza[0].v !== cruza[1].v) {
      bordas[lado].push([cruza[0].v, cruza[1].v]);
      if (corpo) coresBase.push(cor);
    }
  }
  function contorno(arestas: [number, number][]) {
    const viz = new Map<number, Set<number>>();
    for (const [a, b] of arestas) {
      for (const [x, y] of [
        [a, b],
        [b, a],
      ]) {
        const vs = viz.get(x) ?? new Set<number>();
        vs.add(y);
        viz.set(x, vs);
      }
    }
    const vistos = new Set<number>(),
      grupos: number[][] = [];
    for (const inicio of viz.keys()) {
      if (vistos.has(inicio)) continue;
      const grupo: number[] = [],
        fila = [inicio];
      while (fila.length) {
        const v = fila.pop()!;
        if (vistos.has(v)) continue;
        vistos.add(v);
        grupo.push(v);
        for (const n of viz.get(v)!) fila.push(n);
      }
      if (grupo.length >= 6 && grupo.every((v) => viz.get(v)!.size === 2)) grupos.push(grupo);
    }
    const grupo = grupos.sort((a, b) => b.length - a.length)[0];
    if (!grupo) return null;
    const inicio = grupo.reduce((a, b) => (P[a * 3] > P[b * 3] ? a : b)),
      ordem = [inicio];
    let ant = -1,
      atual = inicio;
    for (let k = 0; k < grupo.length - 1; k++) {
      const proximo = [...viz.get(atual)!].find((v) => v !== ant && v !== inicio);
      if (proximo == null) return null;
      ordem.push(proximo);
      ant = atual;
      atual = proximo;
    }
    let area = 0;
    for (let i = 0; i < ordem.length; i++) {
      const a = ordem[i],
        b = ordem[(i + 1) % ordem.length];
      area += P[a * 3] * P[b * 3 + 2] - P[b * 3] * P[a * 3 + 2];
    }
    if (area < 0) ordem.splice(1, ordem.length - 1, ...ordem.slice(1).reverse());
    return ordem;
  }
  const inferior = contorno(bordas[0]),
    superior = contorno(bordas[1]);
  if (!inferior || !superior) return { malha: A, motivo: "Abertura sem contorno fechado", ponteTriangulos: 0 };
  function amostrar(loop: number[], f: number) {
    const compr = loop.map((v, i) => {
      const b = loop[(i + 1) % loop.length];
      return Math.hypot(P[b * 3] - P[v * 3], P[b * 3 + 2] - P[v * 3 + 2]);
    });
    const total = compr.reduce((a, b) => a + b, 0);
    let alvo = f * total;
    for (let i = 0; i < loop.length; i++) {
      if (alvo <= compr[i] || i === loop.length - 1)
        return { a: loop[i], b: loop[(i + 1) % loop.length], f: alvo / (compr[i] || 1) };
      alvo -= compr[i];
    }
    return { a: loop[0], b: loop[0], f: 0 };
  }
  const aneis = [inferior],
    N = 40;
  for (const t of [0.3, 0.65]) {
    const anel: number[] = [],
      f = t * t * (3 - 2 * t);
    for (let i = 0; i < N; i++) {
      const a = amostrar(inferior, i / N),
        b = amostrar(superior, i / N);
      const p0 = [0, 1, 2].map((e) => P[a.a * 3 + e] + (P[a.b * 3 + e] - P[a.a * 3 + e]) * a.f),
        p1 = [0, 1, 2].map((e) => P[b.a * 3 + e] + (P[b.b * 3 + e] - P[b.a * 3 + e]) * b.f);
      const av = misturar(a.a, a.b, a.f, p0),
        bv = misturar(b.a, b.b, b.f, p1);
      const p = [0, 1, 2].map((e) => p0[e] + (p1[e] - p0[e]) * f);
      p[1] = ajuste.corpoY + (ajuste.cabecaY - ajuste.corpoY) * t;
      anel.push(misturar(av, bv, t, p));
    }
    aneis.push(anel);
  }
  aneis.push(superior);
  const corBase = [0, 1, 2].map((e) => coresBase.reduce((s, c) => s + c[e], 0) / Math.max(1, coresBase.length));
  const inicioPonte = I.length / 3;
  function costurar(a: number[], b: number[]) {
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length) {
      let tri: number[];
      if (j >= b.length || (i < a.length && (i + 1) / a.length <= (j + 1) / b.length)) {
        tri = [a[i % a.length], a[(i + 1) % a.length], b[j % b.length]];
        i++;
      } else {
        tri = [a[i % a.length], b[(j + 1) % b.length], b[j % b.length]];
        j++;
      }
      const [v0, v1, v2] = tri,
        u = [0, 1, 2].map((e) => P[v1 * 3 + e] - P[v0 * 3 + e]),
        v = [0, 1, 2].map((e) => P[v2 * 3 + e] - P[v0 * 3 + e]);
      const centro = [0, 2].map((e) => tri.reduce((s, k) => s + P[k * 3 + e], 0) / 3),
        meio = [0, 2].map((e) => [...a, ...b].reduce((s, k) => s + P[k * 3 + e], 0) / (a.length + b.length));
      if ((u[1] * v[2] - u[2] * v[1]) * (centro[0] - meio[0]) + (u[0] * v[1] - u[1] * v[0]) * (centro[1] - meio[1]) < 0)
        tri.reverse();
      const t = Math.max(
        0,
        Math.min(1, (tri.reduce((s, k) => s + P[k * 3 + 1], 0) / 3 - ajuste.corpoY) / (ajuste.cabecaY - ajuste.corpoY)),
      );
      const cor = corBase.map((c, e) => c + (corCabeca[e] - c) * t);
      emitir({ v: tri[0], uv: branco }, { v: tri[1], uv: branco }, { v: tri[2], uv: branco }, cor);
    }
  }
  for (let i = 0; i + 1 < aneis.length; i++) costurar(aneis[i], aneis[i + 1]);
  const nv = P.length / 3,
    indices = Uint16Array.from(I),
    ini = new Uint32Array(nv + 1);
  if (nv > 65535) throw Error("União do pescoço excedeu o limite de vértices");
  for (const v of indices) ini[v + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const cantos = new Uint32Array(I.length),
    pos = ini.slice(0, nv);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  const malha: Anim = {
    ...A,
    P: Float32Array.from(P),
    J: Uint8Array.from(J),
    W: Float32Array.from(W),
    I: indices,
    C: Float32Array.from(C),
    UV: A.UV ? Float32Array.from(UV) : undefined,
    ini,
    cantos,
  };
  return { malha, motivo: null, ponteTriangulos: I.length / 3 - inicioPonte };
}
