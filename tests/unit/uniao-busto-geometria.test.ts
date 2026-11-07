import assert from "node:assert/strict";
import { unirBustoIntegral, ErroUniaoBusto } from "../../tools/lib/uniao-busto.ts";
import { it } from "vitest";
import type { Anim } from "../../src/render/gl/esqueleto.ts";
it("fecha transições longas sem confundir a altura da cintura com o corte dos braços", () => {
  const corpo = caixas([
    [-1, 1, 0, 8, -2, 2],
    [-0.5, 0.5, 6, 7, 2, 6],
    [-0.5, 0.5, 6, 7, -6, -2],
  ]);
  const busto = caixas([
    [-1.1, 1.1, 2, 10, -2, 2],
    [-0.55, 0.55, 6.1, 7.1, 2, 5],
    [-0.55, 0.55, 6.1, 7.1, -5, -2],
  ]);
  const r = unirBustoIntegral(corpo, busto, {
    cinturaCorpo: 3,
    cinturaBusto: 5,
    bracoCorpo: 4,
    bracoBusto: 3.8,
    alturaMinBracos: 5.9,
    branco: [0.5, 0.5],
  });
  const arestas = new Map<string, number>();
  for (let t = 0; t < r.malha.I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = r.malha.I[t + k],
        b = r.malha.I[t + ((k + 1) % 3)],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      arestas.set(key, (arestas.get(key) ?? 0) + 1);
    }
  assert.ok([...arestas.values()].every((n) => n === 2));
  assert.ok(r.relatorio.contornos.every((c) => c.componentes === 1 && !c.verticesAbertos));
});

it("preserva cabelo que cruza planos de cintura e braço sem usá-lo como encaixe", () => {
  const corpo = caixas([
    [-1, 1, 0, 8, -2, 2],
    [-0.5, 0.5, 6, 7, 2, 6],
    [-0.5, 0.5, 6, 7, -6, -2],
  ]);
  const busto = caixas([
    [-1.1, 1.1, 2, 10, -2, 2],
    [-0.55, 0.55, 6.1, 7.1, 2, 5],
    [-0.55, 0.55, 6.1, 7.1, -5, -2],
    [2, 2.2, 2, 9, 3.5, 4.5],
  ]);
  const preservar = Uint8Array.from({ length: busto.I.length / 3 }, (_, t) => (t >= 36 ? 1 : 0));
  const r = unirBustoIntegral(corpo, busto, {
    cinturaCorpo: 3,
    cinturaBusto: 3.3,
    bracoCorpo: 4,
    bracoBusto: 3.8,
    branco: [0.5, 0.5],
    preservarTriangulosBusto: preservar,
  });
  assert.equal(r.relatorio.contornos.length, 6);
  assert.ok(r.relatorio.contornos.every((c) => c.componentes === 1 && c.verticesAbertos === 0));
  for (let v = 24; v < 32; v++) {
    const p = busto.P.subarray(v * 3, v * 3 + 3);
    assert.ok(
      Array.from({ length: r.malha.P.length / 3 }, (_, i) => i).some(
        (i) => Math.hypot(...[0, 1, 2].map((e) => r.malha.P[i * 3 + e] - p[e])) < 1e-6,
      ),
      "Cabelo deve manter os vértices, inclusive abaixo da cintura e fora do braço",
    );
  }
  assert.throws(
    () =>
      unirBustoIntegral(corpo, busto, {
        cinturaCorpo: 3,
        cinturaBusto: 3.3,
        bracoCorpo: 4,
        bracoBusto: 3.8,
        branco: [0.5, 0.5],
        preservarTriangulosBusto: new Uint8Array(1),
      }),
    /Máscara/,
  );
});
function caixas(boxes: number[][]): Anim {
  const P: number[] = [],
    I: number[] = [];
  for (const [x0, x1, y0, y1, z0, z1] of boxes) {
    const n = P.length / 3;
    P.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
    I.push(
      ...[
        0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
      ].map((i) => i + n),
    );
  }
  const nv = P.length / 3,
    ini = new Uint32Array(nv + 1),
    ids = Uint16Array.from(I);
  for (const v of ids) ini[v + 1]++;
  for (let v = 0; v < nv; v++) ini[v + 1] += ini[v];
  const pos = ini.slice(0, nv),
    cantos = new Uint32Array(I.length);
  for (let k = 0; k < I.length; k++) cantos[pos[I[k]]++] = k;
  const identidade = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return {
    P: Float32Array.from(P),
    I: ids,
    J: new Uint8Array(nv * 4),
    W: Float32Array.from({ length: nv * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
    C: Float32Array.from({ length: I.length }, (_, i) => [0.7, 0.4, 0.2][i % 3]),
    UV: new Float32Array(I.length * 2).fill(0.5),
    tex: "atlas",
    juntas: ["Root"],
    pais: [-1],
    repouso: new Float32Array(3),
    raiz: identidade,
    ibm: identidade,
    clips: {},
    ini,
    cantos,
  };
}
it("fecha cintura e braços sem furos, faces invertidas ou pesos inválidos e rejeita cortes sem braço", () => {
  const body = caixas([
    [-1, 1, 0, 8, -2, 2],
    [-0.5, 0.5, 6, 7, 2, 6],
    [-0.5, 0.5, 6, 7, -6, -2],
  ]);
  const bust = caixas([
    [-1.1, 1.1, 2, 10, -2, 2],
    [-0.55, 0.55, 6.1, 7.1, 2, 5],
    [-0.55, 0.55, 6.1, 7.1, -5, -2],
  ]);
  const before = Array.from(body.P),
    result = unirBustoIntegral(body, bust, {
      cinturaCorpo: 3,
      cinturaBusto: 3.3,
      bracoCorpo: 4,
      bracoBusto: 3.8,
      branco: [0.5, 0.5],
      corBusto: [0.8, 0.5, 0.3],
    });
  assert.deepEqual(Array.from(body.P), before);
  assert.equal(result.relatorio.contornos.length, 6);
  assert.ok(result.relatorio.contornos.every((c) => c.componentes === 1 && c.verticesAbertos === 0));
  assert.ok(result.relatorio.triangulosPonte > 0);
  assert.equal(result.malha.UV!.length, result.malha.I.length * 2);
  assert.equal(result.origemTriangulos.length, result.malha.I.length / 3);
  for (let v = 0; v < result.malha.P.length / 3; v++)
    assert.ok(Math.abs(result.malha.W.slice(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0) - 1) < 1e-6);
  const edges = new Map<string, number>();
  const sentidos = new Map<string, number>();
  for (let t = 0; t < result.malha.I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = result.malha.I[t + k],
        b = result.malha.I[t + ((k + 1) % 3)],
        key = a < b ? a + "," + b : b + "," + a;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  for (let t = 0; t < result.malha.I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = result.malha.I[t + k],
        b = result.malha.I[t + ((k + 1) % 3)],
        key = a < b ? a + "," + b : b + "," + a;
      sentidos.set(key, (sentidos.get(key) || 0) + (a < b ? 1 : -1));
    }
  assert.ok(
    [...edges.values()].every((n) => n === 2),
    "A malha de teste deve continuar fechada depois das três costuras.",
  );
  assert.ok(
    [...sentidos.values()].every((n) => n === 0),
    "Faces vizinhas devem percorrer a mesma aresta em sentidos opostos.",
  );
  let falhou = false;
  try {
    unirBustoIntegral(body, bust, {
      cinturaCorpo: 3,
      cinturaBusto: 3.3,
      bracoCorpo: 12,
      bracoBusto: 10,
      branco: [0.5, 0.5],
    });
  } catch (e) {
    assert.ok(e instanceof ErroUniaoBusto);
    assert.ok(e.relatorio.problemas.length);
    falhou = true;
  }
  assert.ok(falhou);
});
