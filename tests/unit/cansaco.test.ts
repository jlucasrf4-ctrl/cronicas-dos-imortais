/* 2026-11-08 — o cansaço dos bichos na corrida e a saída que o cansado escolhe (src/field/cansaco.ts) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { folCorrida, cansadoAI } from "../../src/field/cansaco.ts";
import { CANSACO } from "../../src/data/combate.ts";
import { dungeon } from "../../src/core/state.ts";
import type { Monster } from "../../src/core/tipos.ts";

vi.mock("../../src/field/masmorra.ts", async (original) => ({
  ...(await original<object>()),
  spawnDungeonToast: vi.fn(),
}));

const T = dungeon.tile;
const bicho = (fol = 100) =>
  ({ alive: true, fol, folMax: 100, folLost: 0, folT: 0, hp: 10, hpMax: 10, x: 0, y: 0, st: "flee", t: 0 }) as Monster;

beforeEach(() => {
  dungeon.bushes = [];
});
afterEach(() => vi.restoreAllMocks());

describe("gasto da corrida", () => {
  it("correndo gasta e não recupera; sozinha a corrida não derruba", () => {
    const m = bicho();
    folCorrida(m, T * 3, 1);
    expect(m.fol).toBeCloseTo(100 - CANSACO.gasto * 100);
    expect(m.folT).toBe(0);
    for (let i = 0; i < 100; i++) folCorrida(m, T * 3, 1);
    expect(m.fol).toBeCloseTo(CANSACO.piso * 100);
    expect(m.ko || 0).toBe(0);
  });
  it("parado não gasta; a fuga do susto e os humanos ficam com as regras deles", () => {
    const m = bicho();
    folCorrida(m, 0, 1);
    expect(m.fol).toBe(100);
    const susto = { ...bicho(), desespero: 3 } as Monster,
      humano = { ...bicho(), humano: true } as Monster;
    folCorrida(susto, T * 3, 1);
    folCorrida(humano, T * 3, 1);
    expect([susto.fol, humano.fol]).toEqual([100, 100]);
  });
});

describe("o bicho cansado escolhe a saída", () => {
  it("descansado não faz nada de diferente", () => {
    expect(cansadoAI(bicho(80), { x: T, y: 0 }, 0.1)).toBeNull();
  });
  it("predador com ela perto vira e luta", () => {
    expect(cansadoAI(bicho(10), { x: T, y: 0 }, 0.1, true)).toBe("luta");
  });
  it("com ela longe para e descansa, recuperando até voltar", () => {
    const m = bicho(10);
    expect(cansadoAI(m, { x: T * (CANSACO.longe + 2), y: 0 }, 0.1)).toBe("parado");
    expect(m.cansado?.modo).toBe("descansa");
    expect(m.fol).toBeGreaterThan(10);
    m.fol = 70;
    expect(cansadoAI(m, { x: T * (CANSACO.longe + 2), y: 0 }, 0.1)).toBeNull();
    expect(m.cansado).toBeUndefined();
  });
  it("vai para a moita do lado de lá e descansa dentro dela até ela chegar perto", () => {
    const m = bicho(10),
      ela = { x: -T * 4, y: 0 };
    dungeon.bushes = [
      { x: -T * 3, y: 0, r: T, seed: 0 }, // do lado dela: não serve
      { x: T * 3, y: 0, r: T, seed: 0 },
    ];
    expect(cansadoAI(m, ela, 0.1)).toEqual({ x: T * 3, y: 0 });
    m.x = T * 3;
    expect(cansadoAI(m, ela, 0.1)).toBe("parado");
    expect(cansadoAI(m, { x: T * 4, y: 0 }, 0.1)).toBeNull(); // achado: foge devagar
    expect(m.cansado?.modo).toBe("devagar");
  });
  it("sem moita e com ela no meio do caminho, segue fugindo devagar", () => {
    const m = bicho(10);
    expect(cansadoAI(m, { x: T * 4, y: 0 }, 0.1)).toBeNull();
    expect(m.cansado?.modo).toBe("devagar");
  });
});
