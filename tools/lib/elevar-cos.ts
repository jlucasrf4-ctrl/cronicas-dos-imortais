/** Extensão de tecido no cós: acompanha a superfície e os pesos do corpo, sem esticar a calça existente. */
import type { Anim, DadosAnim } from "../../src/render/gl/esqueleto.ts";
import { assinaturaTriangulo } from "../../src/render/gl/cobertura-roupa.ts";

export interface ExtensaoCos {
  alturaBaixa: number;
  alturaAlta: number;
  folga: number;
  cor: [number, number, number];
  branco: [number, number];
  lateralMaxima?: number;
}
type V3 = [number, number, number];
type Ponto = { p: V3; pesos: Map<number, number> };
const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");

export function elevarCos(camada: DadosAnim, corpo: Anim, config: ExtensaoCos): DadosAnim {
  const { alturaBaixa, alturaAlta, folga, cor, branco } = config;
  const lateral = config.lateralMaxima ?? 6;
  if (!(alturaBaixa < alturaAlta && folga > 0 && lateral > 0)) throw new Error("Faixa do cós inválida");
  if (![...cor, ...branco].every((v) => Number.isFinite(v) && v >= 0 && v <= 1))
    throw new Error("Cor ou pixel branco do cós inválido");
  if (camada.juntas.join("|") !== corpo.juntas.join("|") || camada.pais.join("|") !== corpo.pais.join("|"))
    throw new Error("Calça e corpo precisam usar o mesmo esqueleto");
  const ibm = camada.ibm.flat();
  if (ibm.length !== corpo.ibm.length || ibm.some((v, i) => Math.abs(v - corpo.ibm[i]) > 1e-4))
    throw new Error("Calça e corpo precisam usar as mesmas inversas de bind");
  const P = Array.from(new Int16Array(bytes(camada.malha.p).buffer));
  const J = Array.from(bytes(camada.malha.j)),
    W = Array.from(bytes(camada.malha.w));
  const I = Array.from(new Uint16Array(bytes(camada.malha.i).buffer)),
    C = Array.from(bytes(camada.malha.c));
  const UV = camada.malha.uv
    ? Array.from(new Uint16Array(bytes(camada.malha.uv).buffer))
    : Array.from({ length: I.length * 2 }, (_, i) => Math.round(branco[i % 2] * 65535));
  if (C.length !== I.length || UV.length !== I.length * 2) throw new Error("Atributos da calça desalinhados");
  const cobertura = camada.coberturaCorpo ? Array.from(new Int16Array(bytes(camada.coberturaCorpo).buffer)) : [];
  if (cobertura.length % 9) throw new Error("Cobertura da calça inválida");
  const cobertos = new Set<string>();
  for (let o = 0; o < cobertura.length; o += 9)
    cobertos.add(assinaturaTriangulo(cobertura.slice(o, o + 9), [0, 1, 2], 0, 1));

  // Centros locais em altura: evita deslocar a faixa para o lado mais largo do busto ou dos quadris.
  const centros = new Map<number, [number, number]>();
  function centro(y: number): [number, number] {
    const chave = Math.round(y * 32);
    const salvo = centros.get(chave);
    if (salvo) return salvo;
    const pontos: V3[] = [];
    for (let t = 0; t < corpo.I.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = corpo.I[t + k] * 3,
          b = corpo.I[t + ((k + 1) % 3)] * 3;
        const ya = corpo.P[a + 1],
          yb = corpo.P[b + 1];
        if ((ya <= y && yb > y) || (yb <= y && ya > y)) {
          const f = (y - ya) / (yb - ya);
          const p = [0, 1, 2].map((e) => corpo.P[a + e] + (corpo.P[b + e] - corpo.P[a + e]) * f) as V3;
          if (Math.abs(p[2]) <= lateral) pontos.push(p);
        }
      }
    if (!pontos.length) throw new Error("Corpo sem seção na altura do cós: " + y);
    const c: [number, number] = [
      (Math.min(...pontos.map((p) => p[0])) + Math.max(...pontos.map((p) => p[0]))) / 2,
      (Math.min(...pontos.map((p) => p[2])) + Math.max(...pontos.map((p) => p[2]))) / 2,
    ];
    centros.set(chave, c);
    return c;
  }
  function ponto(v: number): Ponto {
    const pesos = new Map<number, number>();
    for (let k = 0; k < 4; k++)
      if (corpo.W[v * 4 + k]) pesos.set(corpo.J[v * 4 + k], (pesos.get(corpo.J[v * 4 + k]) ?? 0) + corpo.W[v * 4 + k]);
    return { p: Array.from(corpo.P.subarray(v * 3, v * 3 + 3)) as V3, pesos };
  }
  function interpolar(a: Ponto, b: Ponto, f: number): Ponto {
    const pesos = new Map<number, number>();
    for (const [j, w] of a.pesos) pesos.set(j, w * (1 - f));
    for (const [j, w] of b.pesos) pesos.set(j, (pesos.get(j) ?? 0) + w * f);
    return { p: a.p.map((v, e) => v + (b.p[e] - v) * f) as V3, pesos };
  }
  function cortar(pol: Ponto[], eixo: number, valor: number, sinal: number): Ponto[] {
    const saida: Ponto[] = [];
    for (let k = 0; k < pol.length; k++) {
      const a = pol[k],
        b = pol[(k + 1) % pol.length];
      const da = (a.p[eixo] - valor) * sinal >= -1e-8;
      const db = (b.p[eixo] - valor) * sinal >= -1e-8;
      if (da) saida.push(a);
      if (da !== db) {
        const p = interpolar(a, b, (valor - a.p[eixo]) / (b.p[eixo] - a.p[eixo]));
        p.p[eixo] = valor;
        saida.push(p);
      }
    }
    return saida;
  }
  const novos = new Map<string, number>();
  function adicionar(p: Ponto): number {
    const [cx, cz] = centro(p.p[1]);
    const dx = p.p[0] - cx,
      dz = p.p[2] - cz,
      raio = Math.hypot(dx, dz);
    if (raio < 1e-5) throw new Error("Superfície do cós atravessa o centro do corpo");
    const pos = [p.p[0] + (dx / raio) * folga, p.p[1], p.p[2] + (dz / raio) * folga].map((v) => Math.round(v * 64));
    const pesos = [...p.pesos]
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 4);
    const soma = pesos.reduce((s, [, w]) => s + w, 0);
    if (!(soma > 0)) throw new Error("Ponto do cós sem pesos");
    const j = [0, 0, 0, 0],
      w = [0, 0, 0, 0];
    pesos.forEach(([junta, peso], k) => {
      j[k] = junta;
      w[k] = Math.round((peso / soma) * 255);
    });
    w[0] += 255 - w.reduce((a, b) => a + b, 0);
    // As cartas UV do corpo podem duplicar os cantos; a faixa precisa compartilhar a mesma borda animada.
    const chave = pos.join(",");
    let v = novos.get(chave);
    if (v !== undefined) return v;
    v = P.length / 3;
    if (v >= 65535) throw new Error("Cós excedeu o limite Uint16 de vértices");
    novos.set(chave, v);
    P.push(...pos);
    J.push(...j);
    W.push(...w);
    return v;
  }
  let acrescentados = 0;
  for (let t = 0; t < corpo.I.length / 3; t++) {
    const ids = [0, 1, 2].map((k) => corpo.I[t * 3 + k]);
    let pol = ids.map(ponto);
    for (const [eixo, valor, sinal] of [
      [1, alturaBaixa, 1],
      [1, alturaAlta, -1],
      [2, -lateral, 1],
      [2, lateral, -1],
    ]) {
      pol = cortar(pol, eixo, valor, sinal);
      if (pol.length < 3) break;
    }
    if (pol.length < 3) continue;
    for (let k = 1; k + 1 < pol.length; k++) {
      const tri = [pol[0], pol[k], pol[k + 1]].map(adicionar);
      const a = tri[0] * 3,
        b = tri[1] * 3,
        c = tri[2] * 3;
      const u = [0, 1, 2].map((e) => P[b + e] - P[a + e]),
        v = [0, 1, 2].map((e) => P[c + e] - P[a + e]);
      const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
      if (new Set(tri).size < 3 || area < 1e-6) continue;
      I.push(...tri);
      C.push(...cor.map((v) => Math.round(v * 255)));
      for (let canto = 0; canto < 3; canto++) UV.push(...branco.map((v) => Math.round(v * 65535)));
      acrescentados++;
    }
    if (
      ids.every(
        (v) =>
          corpo.P[v * 3 + 1] >= alturaBaixa - 1e-7 &&
          corpo.P[v * 3 + 1] <= alturaAlta + 1e-7 &&
          Math.abs(corpo.P[v * 3 + 2]) <= lateral,
      )
    ) {
      const chave = assinaturaTriangulo(corpo.P, corpo.I, t);
      if (!cobertos.has(chave)) {
        cobertos.add(chave);
        for (const v of ids) for (let e = 0; e < 3; e++) cobertura.push(Math.round(corpo.P[v * 3 + e] * 64));
      }
    }
  }
  if (!acrescentados) throw new Error("A faixa do cós não encontra a superfície do corpo");
  return {
    ...camada,
    malha: {
      p: b64(Int16Array.from(P)),
      j: b64(Uint8Array.from(J)),
      w: b64(Uint8Array.from(W)),
      i: b64(Uint16Array.from(I)),
      c: b64(Uint8Array.from(C)),
      uv: b64(Uint16Array.from(UV)),
    },
    coberturaCorpo: b64(Int16Array.from(cobertura)),
  };
}
