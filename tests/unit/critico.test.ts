import { afterEach, describe, expect, it, vi } from "vitest";
import { STAT, AF_POOL } from "../../src/data/atributos.ts";
import { afRoll, attrOf, critChance } from "../../src/hero/atributos.ts";
import { ensureHero } from "../../src/hero/nivel.ts";
import { bornFromSeed } from "../../src/hero/nascimento.ts";
import { ITEM_DEFS } from "../../src/data/itens.ts";
import { hurtMonster } from "../../src/field/acertos.ts";
import { TR } from "../../src/field/treino.ts";
import { dungeon } from "../../src/core/state.ts";
import type { Hero, Item, Monster } from "../../src/core/tipos.ts";

// Fase 6: o crítico (v5.0). Chance = 2% + 1% por ponto de Destreza + afixos, com teto; o golpe crítico vale ×1,6.
/* eslint-disable @typescript-eslint/no-explicit-any */
const parcial = (h: Record<string, any>) => h as Hero;
// as formas dos itens vêm do código de carga (iniciar…), que não roda aqui: a peça leva uma forma qualquer
const peca = (key: string): Item => ({ uid: 0, def: ITEM_DEFS[key], x: 0, y: 0, shape: [[1]], tier: 0 });
const heroi = (destreza = 5): Hero => {
  const b = bornFromSeed(777);
  const equip = { maoD: peca("eq_espada"), costas: peca("eq_arco") };
  return ensureHero(
    parcial({ id: "h1", name: "Teste", attrs: { ...b.attrs, destreza }, seed: b.seed, aff: b.aff, gen: b.gen, equip }),
  );
};

afterEach(() => vi.restoreAllMocks());

describe("critChance", () => {
  it("2% de base + 1% por ponto de Destreza", () => {
    expect(critChance(heroi(5))).toBeCloseTo(0.07);
    expect(critChance(heroi(12))).toBeCloseTo(0.14);
    expect(critChance(heroi(0))).toBeCloseTo(STAT.desCritBase);
  });

  it("soma o afixo de crítico das peças equipadas e a Destreza dos itens", () => {
    const h = heroi(5);
    h.equip!.maoD!.af = { crit: 0.05 };
    h.equip!.costas!.af = { crit: 0.03, destreza: 2 };
    expect(attrOf(h, "destreza")).toBe(7);
    expect(critChance(h)).toBeCloseTo(0.02 + 7 * 0.01 + 0.08);
  });

  it("nunca passa do teto", () => {
    const h = heroi(40);
    h.equip!.maoD!.af = { crit: 0.5 };
    expect(critChance(h)).toBe(STAT.critMax);
  });
});

describe("afRoll: o afixo de crítico", () => {
  it("só sai na mão direita ou nas costas, e vale 3% (5% na qualidade 3+)", () => {
    const slots = Object.keys(AF_POOL).filter((s) => AF_POOL[s].includes("crit"));
    expect(slots.sort()).toEqual(["costas", "maoD"]);
    let vistos = 0;
    for (const q of [1, 2, 3]) {
      for (let i = 0; i < 300; i++) {
        const it = peca("eq_espada");
        it.q = q;
        const af = afRoll(it);
        if ("crit" in af) {
          vistos++;
          expect(af.crit).toBe(q >= 3 ? 0.05 : 0.03);
        }
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });
});

describe("golpe crítico (hurtMonster)", () => {
  // o boneco da Sala de Treino: não morre, não sofre efeitos de tipo, e trainRecord guarda o dano e o crítico
  const boneco = () =>
    ({
      kind: "dummy",
      dummy: true,
      x: 100,
      y: 100,
      hp: 1000,
      hpMax: 1000,
      alive: true,
      st: "idle",
    }) as unknown as Monster;
  const golpe = (sorteio: number, skill = "espada", dot = false) => {
    dungeon.hero = heroi(5);
    dungeon.training = true;
    dungeon.px = 0;
    dungeon.py = 0;
    TR.hits = [];
    vi.spyOn(Math, "random").mockReturnValue(sorteio);
    hurtMonster(boneco(), 10, skill, 1, dot);
    return TR.hits.at(-1)!;
  };

  it("sorteio abaixo da chance: dano ×1,6 e marcado como crítico", () => {
    const normal = golpe(0.99),
      crit = golpe(0.0);
    expect(normal.crit).toBe(false);
    expect(crit.crit).toBe(true);
    expect(crit.dmg / normal.dmg).toBeCloseTo(STAT.critMult);
    expect(STAT.critMult).toBe(1.6);
  });

  it("o limite é a própria chance do herói", () => {
    const c = critChance(heroi(5));
    expect(golpe(c - 0.001).crit).toBe(true);
    expect(golpe(c).crit).toBe(false);
  });

  it("só espada e arco critam, e dano contínuo nunca", () => {
    expect(golpe(0, "arco").crit).toBe(true);
    expect(golpe(0, "clava").crit).toBe(false);
    expect(golpe(0, "espada", true).crit).toBe(false);
  });
});
