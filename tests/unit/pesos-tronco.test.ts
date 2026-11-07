import { describe, expect, it } from "vitest";
import { estabilizarBusto } from "../../tools/lib/pesos-tronco.ts";

const juntas = ["Hips", "Spine2", "LeftShoulder", "LeftArm"];
function malha(pontos: number[][]) {
  const p = Int16Array.from(pontos.flat(), (n) => Math.round(n * 64));
  const j = Uint8Array.from(pontos.flatMap(() => [1, 2, 3, 0]));
  const w = Uint8Array.from(pontos.flatMap(() => [85, 85, 85, 0]));
  return {
    juntas,
    malha: {
      p: Buffer.from(p.buffer).toString("base64"),
      j: Buffer.from(j).toString("base64"),
      w: Buffer.from(w).toString("base64"),
    },
  };
}
function pesos(d: ReturnType<typeof malha>, v: number) {
  const j = Buffer.from(d.malha.j, "base64"),
    w = Buffer.from(d.malha.w, "base64");
  const soma = new Map<number, number>();
  for (let k = 0; k < 4; k++) soma.set(j[v * 4 + k], (soma.get(j[v * 4 + k]) ?? 0) + w[v * 4 + k]);
  return soma;
}
describe("pesos do peito e ombros", () => {
  it("preserva a clavícula no peito e mantém o braço livre no ombro", () => {
    const d = malha([
      [6, 68, 0],
      [6, 78, 18],
      [-6, 68, 0],
    ]);
    estabilizarBusto(d, [0, 100]);
    expect(pesos(d, 0).get(2)).toBe(85);
    expect(pesos(d, 0).get(3) ?? 0).toBe(0);
    expect(pesos(d, 1).get(3)).toBe(85);
    expect(pesos(d, 2).get(3)).toBe(85);
  });
  it("faz uma transição gradual até o ombro e mantém os pesos normalizados", () => {
    const d = malha([
      [6, 68, 0],
      [6, 68, 10],
      [6, 68, 14],
    ]);
    estabilizarBusto(d, [0, 100]);
    const a = pesos(d, 0).get(3) ?? 0,
      b = pesos(d, 1).get(3) ?? 0,
      c = pesos(d, 2).get(3) ?? 0;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    for (let v = 0; v < 3; v++) expect([...pesos(d, v).values()].reduce((a, b) => a + b, 0)).toBe(255);
  });
});
