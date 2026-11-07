import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodificarAnim, type DadosAnim } from "../../src/render/gl/esqueleto.ts";
import { ocultarPeleCoberta } from "../../src/render/gl/cobertura-roupa.ts";
import { comporPele, type AparenciasDados } from "../../src/render/gl/aparencias.ts";
import { unirPescoco } from "../../src/render/gl/unir-pescoco.ts";
import { limparIlhasPescoco } from "../../tools/lib/limpar-pescoco.ts";
const dados = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
const corpo = dados.corpos!.find((c) => c.nome === "corpo_f02")!;
const origem = decodificarAnim(corpo.semCabeca);
const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
function camada(tris: number[]): DadosAnim {
  const p = Int16Array.from(
    tris.flatMap((t) =>
      [0, 1, 2].flatMap((k) => [0, 1, 2].map((e) => Math.round(origem.P[origem.I[t * 3 + k] * 3 + e] * 64))),
    ),
  );
  return { ...corpo.semCabeca, coberturaCorpo: Buffer.from(p.buffer).toString("base64") };
}
describe("cobertura por peças independentes", () => {
  it("retirar cada peça restaura a pele correspondente sem mudar posição, rig, cor ou UV das faces restantes", () => {
    const A = { ...origem, UV: Float32Array.from({ length: origem.I.length * 2 }, (_, i) => i / 100000) },
      peito = camada([7]),
      pernas = camada([19]);
    const completo = ocultarPeleCoberta(A, [peito, pernas])!;
    const semPeito = ocultarPeleCoberta(A, [null, pernas])!;
    if (!("I" in completo) || !("I" in semPeito)) throw new Error("Pele não foi decodificada");
    expect(completo.I.length).toBe(A.I.length - 6);
    expect(semPeito.I.length).toBe(A.I.length - 3);
    expect(completo.P).toBe(A.P);
    expect(completo.W).toBe(A.W);
    expect(completo.ibm).toBe(A.ibm);
    expect(Array.from(completo.C)).toEqual(Array.from(A.C).filter((_, i) => ![7, 19].includes(Math.floor(i / 3))));
    expect(Array.from(completo.UV!)).toEqual(Array.from(A.UV).filter((_, i) => ![7, 19].includes(Math.floor(i / 6))));
    expect(ocultarPeleCoberta(A, [])).toBe(A);
    expect(ocultarPeleCoberta(A, [pernas, peito])).toBe(completo);
    expect(A.I.length).toBe(origem.I.length);
  });
  it("a cobertura de outro corpo não remove triângulos de uma geometria diferente", () => {
    const A = { ...origem, P: Float32Array.from(origem.P, (v, i) => (i % 3 === 0 ? v + 100 : v)) };
    expect(ocultarPeleCoberta(A, [camada([7, 19])])).toBe(A);
  });
});
describe("união individual F02 e Busto F02", () => {
  const h = dados.cabecas!.find((c) => c.nome === "busto_02")!;
  const cab = { ...h, tex: h.tex ?? dados.texturas?.[h.texDe!] };
  const A = comporPele(origem, cab, corpo.encaixe);
  const r = unirPescoco(
    A,
    origem.I.length / 3,
    bytes(cab.mascara!),
    { corpoY: 35.6, cabecaY: 37 },
    cab.refPele!.map((c) => c / 255),
    cab.branco,
  );
  it("costura o contorno do corpo sem arestas abertas na nova emenda", () => {
    expect(r.motivo).toBeNull();
    expect(r.ponteTriangulos).toBeGreaterThan(0);
    const edges = new Map<string, { a: number; b: number; n: number }>();
    for (let i = 0; i < r.malha.I.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const a = r.malha.I[i + k],
          b = r.malha.I[i + ((k + 1) % 3)],
          key = a < b ? a + "," + b : b + "," + a;
        const e = edges.get(key) ?? { a, b, n: 0 };
        e.n++;
        edges.set(key, e);
      }
    let conferidas = 0;
    for (const e of edges.values())
      if ([e.a, e.b].every((v) => Math.abs(r.malha.P[v * 3 + 1] - 35.6) < 1e-4)) {
        conferidas++;
        expect(e.n).toBe(2);
      }
    expect(conferidas).toBeGreaterThan(20);
    expect(r.malha.UV!.length).toBe(r.malha.I.length * 2);
    expect(r.malha.I.length / 3).toBeLessThan(12000);
  });
  it("preserva o cabelo e mantém pesos válidos em todos os vértices da ponte", () => {
    const nv = origem.P.length / 3,
      mask = bytes(cab.mascara!),
      indices = new Uint16Array(bytes(cab.i).buffer);
    const cabelo = new Set<number>();
    for (let t = 0; t < mask.length; t++)
      if (mask[t] === 2) for (let k = 0; k < 3; k++) cabelo.add(nv + indices[t * 3 + k]);
    for (const v of cabelo)
      expect(Array.from(r.malha.P.subarray(v * 3, v * 3 + 3))).toEqual(Array.from(A.P.subarray(v * 3, v * 3 + 3)));
    for (let v = 0; v < r.malha.P.length / 3; v++)
      expect(r.malha.W.subarray(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(r.malha.P.every(Number.isFinite)).toBe(true);
  });
});
describe("limpeza local do recorte", () => {
  it("não altera uma malha já limpa nem remove regiões fora do pescoço", () => {
    const todos = Array.from({ length: origem.I.length / 3 }, (_, i) => i);
    const r = limparIlhasPescoco(origem, todos, corpo.encaixe, { abaixo: 1, acima: 0.7, raio: 1.8, trisMax: 64 });
    expect(r.removidos).toEqual([]);
    expect(r.tris).toEqual(todos);
  });
});
