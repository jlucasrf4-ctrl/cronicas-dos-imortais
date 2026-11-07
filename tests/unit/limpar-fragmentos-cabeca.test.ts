import { describe, expect, it } from "vitest";
import { limparFragmentosCabeca } from "../../tools/lib/limpar-fragmentos-cabeca.ts";

describe("fragmentos inferiores das cabeças", () => {
  it("remove somente uma ilha pequena inteira abaixo do queixo, preservando cabelo ligado à cabeça", () => {
    // Primeiro grupo: rosto e cabelo comprido; último vértice duplica uma costura UV da face.
    const P = Int16Array.from([
      0, 1000, 0, 1000, 1000, 0, 0, 0, 0, 0, -3000, 0, 1000, -3000, 0, 0, 0, 0, 5000, -3000, 0, 6000, -3000, 0, 5000,
      -2000, 0, 9000, -2000, 0, 10000, -2000, 0, 9000, 100, 0,
    ]);
    const I = Uint16Array.from([0, 1, 2, 5, 3, 4, 6, 7, 8, 9, 10, 11]),
      antes = P.slice();
    const R = limparFragmentosCabeca(P, I, { topoMax: -1.5, trisMax: 80 });
    expect(R.removidos).toEqual([2]);
    expect(R.tris).toEqual([0, 1, 3]);
    expect(P).toEqual(antes);
    // Repetir no resultado não retira cabelo preservado, nem a peça que toca a região acima do queixo.
    const restante = Uint16Array.from(R.tris.flatMap((t) => Array.from(I.slice(t * 3, t * 3 + 3))));
    expect(limparFragmentosCabeca(P, restante, { topoMax: -1.5, trisMax: 80 }).removidos).toEqual([]);
  });
  it("conserva componentes que excedam a calibração de tamanho", () => {
    const P = Int16Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 10, -3000, 0, 11, -3000, 0, 10, -2000, 0]);
    const I = Uint16Array.from([0, 1, 2, 1, 2, 3, 4, 5, 6]);
    expect(limparFragmentosCabeca(P, I, { topoMax: -1.5, trisMax: 0 }).removidos).toEqual([]);
  });
});
