import { afterEach, describe, expect, it, vi } from "vitest";
import { consumirFolegoExterno, fatorCorrida, reservaInimigo, defesaFolego } from "../../src/field/folego.ts";
import { folDrain, folTick, folWake, folVel } from "../../src/field/tipos.ts";
import { folCap } from "../../src/field/dano.ts";
import { dungeon } from "../../src/core/state.ts";
import type { Monster } from "../../src/core/tipos.ts";

vi.mock("../../src/field/masmorra.ts", async (original) => ({
  ...(await original<object>()),
  spawnDungeonToast: vi.fn(),
}));
vi.mock("../../src/field/chao.ts", async (original) => ({
  ...(await original<object>()),
  sfx: vi.fn(),
  addRing: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());
const inimigo = () =>
  ({
    alive: true,
    fol: 100,
    folMax: 100,
    folLost: 0,
    folT: 0,
    hp: 100,
    hpMax: 100,
    x: 100,
    y: 100,
    st: "chase",
    t: 0,
  }) as Monster;

describe("esgotamento externo compartilhado", () => {
  it("cobra uma vez entre atividades simultâneas e rearma após recuperar", () => {
    const d = { gstam: 10, gint: 100, gregen: 0 };
    expect(consumirFolegoExterno(d, 10, 0.8)).toBe(true);
    for (let i = 0; i < 300; i++) consumirFolegoExterno(d, 3, 0.4);
    expect(d).toEqual({ gstam: 0, gint: 80, gregen: 0.8 });
    d.gstam = 20;
    consumirFolegoExterno(d, 20);
    expect(d.gint).toBe(60);
  });
  it("consome só a externa antes de zerar e limita a interna a zero", () => {
    const d = { gstam: 23, gint: 5 };
    consumirFolegoExterno(d, 20);
    expect(d).toMatchObject({ gstam: 3, gint: 5 });
    consumirFolegoExterno(d, 3);
    expect(d).toMatchObject({ gstam: 0, gint: 0 });
    consumirFolegoExterno(d, -10);
    expect(d.gstam).toBe(0);
  });
  it("curva contínua de corrida preserva os cinco valores e interpola", () => {
    expect([0, 25, 50, 75, 100].map(fatorCorrida)).toEqual([0.65, 0.8, 0.9, 0.95, 1]);
    expect(fatorCorrida(37.5)).toBeCloseTo(0.85);
    expect(fatorCorrida(25.001) - fatorCorrida(24.999)).toBeLessThan(0.001);
  });
});

describe("exaustão progressiva dos inimigos", () => {
  it("resiste às três primeiras quebras com a próxima barra cheia e foge na quarta", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const m = inimigo();
    for (const [i, reserva, vel, defesa] of [
      [1, 0.75, 1, 1],
      [2, 0.5, 0.85, 0.8],
      [3, 0.25, 0.65, 0.55],
    ]) {
      m.fol = 100;
      folDrain(m, 100);
      expect(m.quebrasFolego).toBe(i);
      expect(reservaInimigo(m)).toBe(reserva);
      expect(folVel(m)).toBe(vel);
      expect(defesaFolego(m)).toBe(defesa);
      expect(m.ko || 0).toBe(0);
      // a próxima barra vem cheia: cada quebra custa o mesmo esforço
      expect(m.fol).toBe(folCap(m));
      folDrain(m, 40);
      expect(m.quebrasFolego).toBe(i);
    }
    m.fol = 100;
    folDrain(m, 100);
    expect(reservaInimigo(m)).toBe(0);
    expect(m.fugaFolego).toBeGreaterThan(0);
    expect(folVel(m)).toBeGreaterThan(1);
    folTick(m, 3);
    expect(m.ko).toBe(8);
    expect(m.fugaFolego).toBe(0);
    expect(folVel(m)).toBe(0.25);
  });
  it.each([
    [0, 0.199, true],
    [0, 0.2, false],
    [1, 0.249, true],
    [1, 0.25, false],
    [2, 0.499, true],
    [2, 0.5, false],
    [3, 0.799, true],
    [3, 0.8, false],
  ])("limiar de chance na etapa %i, sorteio %f", (quebras, sorteio, cai) => {
    vi.spyOn(Math, "random").mockReturnValue(sorteio);
    const m = inimigo();
    m.quebrasFolego = quebras;
    folDrain(m, 100);
    expect((m.ko || 0) > 0).toBe(cai);
  });
  it("levanta com externa preservada e proteção contra quedas consecutivas", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const m = inimigo();
    m.quebrasFolego = 3;
    folDrain(m, 100);
    m.ko = 0;
    folWake(m);
    expect(m.fol).toBe(40);
    expect(folCap(m)).toBe(100);
    expect(m.desespero || 0).toBe(0);
    folDrain(m, 100);
    expect(m.ko).toBe(0);
    expect(m.fol).toBe(100);
    expect(reservaInimigo(m)).toBe(0);
    expect(m.fugaFolego || 0).toBe(0);
  });
  it("sem dano novo, a externa volta pela espera e taxa existentes", () => {
    const m = inimigo();
    m.fol = 0;
    m.quebrasFolego = 2;
    folTick(m, 2);
    expect(m.fol).toBe(0);
    folTick(m, 1);
    expect(m.fol).toBe(0.5);
    expect(reservaInimigo(m)).toBe(0.5);
    expect(dungeon.crav).toBeFalsy();
  });
});
