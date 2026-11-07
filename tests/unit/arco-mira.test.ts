import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { GL3 } from "../../src/core/state.ts";
import {
  animar,
  novoAnimado,
  preso,
  aoLongo,
  comPos,
  trocarPele,
  type SituacaoAnim,
} from "../../src/render/gl/animado.ts";
import { M4 } from "../../src/render/gl/geometria.ts";
import type { DadosAnim, MatrizesPose } from "../../src/render/gl/esqueleto.ts";
const dados = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
delete dados.tex;
const modelos = (
  JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as {
    modelos: { nome: string; anim?: DadosAnim }[];
  }
).modelos;
const corpos = [dados, ...["corpo_f02", "corpo_f06"].map((n) => modelos.find((v) => v.nome === n)!.anim!)];
const vazio = () => {};
const original = GL3.gl;
beforeEach(() => {
  GL3.gl = {
    createVertexArray: () => ({}),
    createBuffer: () => ({}),
    bindVertexArray: vazio,
    bindBuffer: vazio,
    bufferData: vazio,
    bufferSubData: vazio,
    enableVertexAttribArray: vazio,
    vertexAttribPointer: vazio,
    deleteBuffer: vazio,
    deleteVertexArray: vazio,
  } as unknown as WebGL2RenderingContext;
});
afterEach(() => {
  GL3.gl = original;
});
function novo(corpo: DadosAnim, corrigir = true) {
  const x = novoAnimado(
    dados,
    { passoAndar: 80, passoCorrer: 158, rolarDur: 0.6, coletarDur: 0.8, troca: 0.15 },
    (G) => ({
      [corrigir ? "arco" : "referencia"]: {
        junta: "LeftHand",
        repouso: comPos(M4.RZ(-0.3), aoLongo(G("LeftHand"), 3)),
      },
      palmaD: { junta: "RightHand", repouso: comPos(M4.id(), aoLongo(G("RightHand"), 3)) },
    }),
  );
  if (corpo !== dados) trocarPele(x, { ...corpo, tex: undefined, texDe: undefined });
  return x;
}
function amostrar(corpo: DadosAnim, s: Partial<SituacaoAnim>, corrigir = true, n = 8) {
  const x = novo(corpo, corrigir);
  let a: ReturnType<typeof animar> = null;
  for (let i = 0; i < n; i++) a = animar(x, { dt: 0.1, andou: 0, modo: "arco", mirando: true, carga: 1, ...s });
  if (!a) throw Error("Faltou deformar a pose do arco");
  return { x, mat: a.mat, b: preso(x, a.mat, corrigir ? "arco" : "referencia"), d: preso(x, a.mat, "palmaD") };
}
function ponto(m: MatrizesPose, n: string) {
  const j = dados.juntas.indexOf(n) * 16;
  return [m.glob[j + 12], m.glob[j + 13], m.glob[j + 14]];
}
function dist(a: number[], b: number[]) {
  return Math.hypot(...a.map((v, i) => v - b[i]));
}

describe("arco alinhado à mira", () => {
  it("mantém arco em pé e empunhadura na linha da flecha em três corpos e ao longo da mira", () => {
    for (const corpo of corpos)
      for (const n of [4, 8, 13, 20]) {
        const q = amostrar(corpo, {}, true, n),
          r = amostrar(corpo, {}, false, n);
        expect(q.b[0] / Math.hypot(q.b[0], q.b[1], q.b[2])).toBeCloseTo(1, 5);
        expect(q.b[1] / Math.hypot(q.b[0], q.b[1], q.b[2])).toBeCloseTo(0, 5);
        expect(q.b[2] / Math.hypot(q.b[0], q.b[1], q.b[2])).toBeCloseTo(0, 5);
        expect(q.b[4] / Math.hypot(q.b[4], q.b[5], q.b[6])).toBeCloseTo(0, 5);
        expect(q.b[5] / Math.hypot(q.b[4], q.b[5], q.b[6])).toBeCloseTo(1, 5);
        expect(q.b[6] / Math.hypot(q.b[4], q.b[5], q.b[6])).toBeCloseTo(0, 5);
        expect(q.b[13]).toBeCloseTo(q.d[13], 4);
        expect(q.b[14]).toBeCloseTo(q.d[14], 4);
        expect(q.b[12]).toBeGreaterThan(q.d[12]);
        for (const lado of ["Left", "Right"])
          for (const [a, b] of [
            ["Arm", "ForeArm"],
            ["ForeArm", "Hand"],
          ])
            expect(dist(ponto(q.mat, lado + a), ponto(q.mat, lado + b))).toBeCloseTo(
              dist(ponto(r.mat, lado + a), ponto(r.mat, lado + b)),
              4,
            );
        expect(Array.from(q.x.V!).every(Number.isFinite)).toBe(true);
      }
  });
  it("preserva a relação arco e flecha ao virar para qualquer direção, inclusive esquerda", () => {
    for (const corpo of corpos)
      for (const dirMov of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const q = amostrar(corpo, { andou: 2, movendo: 1, dirMov });
        for (let i = 0; i < 8; i++) {
          const yaw = (i * Math.PI) / 4,
            M = M4.ch(M4.T(400, 0, 270), M4.RY(-yaw), M4.S(1.3)),
            B = M4.mul(M, q.b),
            D = M4.mul(M, q.d),
            eixo = [Math.cos(yaw), 0, Math.sin(yaw)],
            v = [B[12] - D[12], B[13] - D[13], B[14] - D[14]],
            l = Math.hypot(...v);
          expect(v.reduce((a, b, k) => a + b * eixo[k], 0) / l).toBeCloseTo(1, 5);
          expect(B[5] / Math.hypot(B[4], B[5], B[6])).toBeCloseTo(1, 5);
        }
      }
  });
  it("não altera o começo da puxada nem poses de repouso, guarda e lançamento", () => {
    for (const s of [
      { carga: 0.25 },
      { modo: "", mirando: false, carga: 0 },
      { modo: "combate", mirando: false, carga: 0, guarda: true },
      { mirando: false, carga: 0, soltando: true },
    ] satisfies Partial<SituacaoAnim>[]) {
      const q = amostrar(dados, s),
        r = amostrar(dados, s, false);
      expect(Array.from(q.mat.glob)).toEqual(Array.from(r.mat.glob));
    }
  });
});
