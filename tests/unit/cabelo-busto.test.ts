import { describe, expect, it } from "vitest";
import { substituirCabeloBusto } from "../../tools/lib/cabelo-busto.ts";
import type { Anim } from "../../src/render/gl/esqueleto.ts";
import type { CabecaDados } from "../../src/render/gl/aparencias.ts";
const b64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
describe("cabelo completo do busto", () => {
  it("conserva o peito original e substitui só as mechas, inclusive abaixo da cintura, com pesos Head e UVs", () => {
    const A: Anim = {
      juntas: ["Spine2", "Head"],
      pais: [-1, 0],
      repouso: new Float32Array(6),
      raiz: new Float32Array(16),
      ibm: new Float32Array(32),
      clips: {},
      P: Float32Array.from([0, 1, 0, 1, 1, 0, 0, 2, 0, 0, 0, -1, 1, 0, -1, 0, -1, -1]),
      I: Uint16Array.from([0, 1, 2, 3, 4, 5]),
      J: new Uint8Array(24),
      W: Float32Array.from({ length: 24 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
      C: Float32Array.from([0.7, 0.4, 0.2, 1, 1, 1]),
      UV: new Float32Array(12).fill(0.25),
      tex: "atlas",
      ini: new Uint32Array(7),
      cantos: Uint32Array.from([0, 1, 2, 3, 4, 5]),
    };
    const cab: CabecaDados = {
      nome: "F16",
      rotulo: "F16",
      peso: 1,
      p: b64(Int16Array.from([0, 0, 0, 1000, 0, 0, 0, 1000, 0, 0, -4000, -1000, 1000, -4000, -1000, 0, -5000, -1000])),
      i: b64(Uint16Array.from([0, 1, 2, 3, 4, 5])),
      c: b64(new Uint8Array(6).fill(255)),
      mascara: b64(Uint8Array.from([1, 2])),
      uv: b64(new Uint16Array(12).fill(32768)),
    };
    const r = substituirCabeloBusto(
      A,
      Uint8Array.from([1, 2]),
      Uint8Array.from([1, 1]),
      cab,
      { x: 0, y: 0, z: 0, u: 1 },
      { escala: 2, TX: 0, TY: 5, eixoX: 0, eixoZ: 0, fatorV: 0.9 },
    );
    expect(r.malha.I.length).toBe(6);
    expect(r.malha.I.subarray(0, 3)).toEqual(A.I.subarray(0, 3));
    expect(r.malha.P.subarray(0, A.P.length)).toEqual(A.P);
    expect(r.malha.C.subarray(0, 3)).toEqual(A.C.subarray(0, 3));
    expect(r.malha.UV!.subarray(0, 6)).toEqual(A.UV!.subarray(0, 6));
    expect(r.malha.tex).toBe("atlas");
    expect(Array.from(r.mascara)).toEqual([1, 2]);
    for (const v of r.malha.I.subarray(3)) {
      expect(r.malha.P[v * 3 + 1]).toBeLessThan(0);
      expect(Array.from(r.malha.J.subarray(v * 4, v * 4 + 4))).toEqual([1, 0, 0, 0]);
      expect(Array.from(r.malha.W.subarray(v * 4, v * 4 + 4))).toEqual([1, 0, 0, 0]);
    }
    expect(r.malha.UV![7]).toBeCloseTo((32768 / 65535) * 0.9, 6);
    for (let v = 0; v < r.malha.ini.length - 1; v++)
      for (let k = r.malha.ini[v]; k < r.malha.ini[v + 1]; k++) expect(r.malha.I[r.malha.cantos[k]]).toBe(v);
    expect(A.I.length).toBe(6);
  });
});
