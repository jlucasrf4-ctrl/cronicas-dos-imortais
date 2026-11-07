import { describe, expect, it } from "vitest";
import { decodificarAnim, type DadosAnim } from "../../src/render/gl/esqueleto.ts";
import { ocultarPeleCoberta } from "../../src/render/gl/cobertura-roupa.ts";
import { elevarCos } from "../../tools/lib/elevar-cos.ts";
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function dados(p: number[], i: number[]): DadosAnim {
  const nv = p.length / 3;
  const j = new Uint8Array(nv * 4),
    w = new Uint8Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    j[v * 4 + 1] = 1;
    w[v * 4] = Math.round(((30 - p[v * 3 + 1]) / 7) * 255);
    w[v * 4 + 1] = 255 - w[v * 4];
  }
  return {
    versao: 1,
    juntas: ["Hips", "Spine"],
    pais: [-1, 0],
    repouso: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    raiz: id,
    ibm: [id, id],
    clips: {},
    malha: {
      p: b64(Int16Array.from(p, (v) => Math.round(v * 64))),
      j: b64(j),
      w: b64(w),
      i: b64(Uint16Array.from(i)),
      c: b64(new Uint8Array(i.length).fill(255)),
      uv: b64(new Uint16Array(i.length * 2).fill(30000)),
    },
    tex: "atlas",
  };
}
function cilindro(): DadosAnim {
  const p: number[] = [],
    i: number[] = [];
  for (const y of [23, 26, 30])
    for (const [x, z] of [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ])
      p.push(x, y, z);
  for (let a = 0; a < 2; a++)
    for (let k = 0; k < 4; k++) {
      const a0 = a * 4 + k,
        b = a * 4 + ((k + 1) % 4),
        c = b + 4,
        d = a0 + 4;
      i.push(a0, b, c, a0, c, d);
    }
  return dados(p, i);
}
const config = {
  alturaBaixa: 24,
  alturaAlta: 28.4,
  folga: 0.14,
  cor: [0.27, 0.17, 0.115] as [number, number, number],
  branco: [0.5, 1032 / 1040] as [number, number],
};
describe("extensão anatômica do cós", () => {
  it("preserva a calça e fecha a faixa entre as duas alturas sem fissuras intermediárias", () => {
    const corpo = decodificarAnim(cilindro()),
      original = dados([-1, 23, 0, 1, 23, 0, 0, 24, 0], [0, 1, 2]);
    const antes = JSON.stringify(original),
      saida = elevarCos(original, corpo, config),
      A = decodificarAnim(saida);
    expect(JSON.stringify(original)).toBe(antes);
    expect(A.P.subarray(0, 9)).toEqual(decodificarAnim(original).P);
    expect(Array.from(A.I.subarray(0, 3))).toEqual([0, 1, 2]);
    const edges = new Map<string, { a: number; b: number; n: number }>();
    for (let t = 3; t < A.I.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = A.I[t + k],
          b = A.I[t + ((k + 1) % 3)],
          key = [a, b].sort((a, b) => a - b).join(","),
          e = edges.get(key) ?? { a, b, n: 0 };
        e.n++;
        edges.set(key, e);
      }
    let abertas = 0;
    for (const e of edges.values()) {
      if (e.n === 1) {
        abertas++;
        const y0 = A.P[e.a * 3 + 1],
          y1 = A.P[e.b * 3 + 1];
        expect(y0).toBe(y1);
        expect([24, Math.round(28.4 * 64) / 64]).toContain(y0);
      } else expect(e.n).toBe(2);
    }
    expect(abertas).toBeGreaterThanOrEqual(8);
    expect(A.UV!.length).toBe(A.I.length * 2);
    expect(A.C.length).toBe(A.I.length);
    expect(A.ini.length).toBe(A.P.length / 3 + 1);
    for (let v = 3; v < A.P.length / 3; v++)
      expect(A.W.subarray(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(A.P.every(Number.isFinite)).toBe(true);
  });
  it("registra somente faces inteiramente cobertas e retirar a calça restaura a pele", () => {
    const fonte = cilindro(),
      corpo = decodificarAnim(fonte),
      calca = dados([-1, 23, 0, 1, 23, 0, 0, 24, 0], [0, 1, 2]);
    const cobertura = Int16Array.from(
      [0, 1, 2].flatMap((k) => [0, 1, 2].map((e) => Math.round(corpo.P[corpo.I[k] * 3 + e] * 64))),
    );
    calca.coberturaCorpo = b64(cobertura);
    // Uma face curta inteiramente dentro da faixa deve ser removida; as faces que cruzam suas bordas ficam.
    const extra = dados([...Array.from(corpo.P), 0, 25, 2, 1, 25, 2, 0, 27, 2], [...corpo.I, 12, 13, 14]);
    const testCorpo = decodificarAnim(extra),
      saida = elevarCos({ ...calca, ibm: extra.ibm }, testCorpo, config);
    const vestido = ocultarPeleCoberta(testCorpo, [saida]);
    expect(vestido && "I" in vestido && vestido.I.length).toBe(testCorpo.I.length - 6);
    expect(ocultarPeleCoberta(testCorpo, [])).toBe(testCorpo);
    expect(Buffer.from(saida.coberturaCorpo!, "base64").length).toBeGreaterThan(18);
  });
  it("recusa faixas e esqueletos incompatíveis", () => {
    const d = cilindro(),
      A = decodificarAnim(d);
    expect(() => elevarCos(d, A, { ...config, alturaAlta: 23 })).toThrow("Faixa");
    expect(() => elevarCos({ ...d, juntas: ["outro"] }, A, config)).toThrow("esqueleto");
  });
});
