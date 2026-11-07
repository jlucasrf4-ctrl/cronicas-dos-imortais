import { describe, expect, it } from "vitest";
import { M4 } from "../../src/render/gl/geometria.ts";
import { ITEM_DEFS, ART } from "../../src/data/itens.ts";
import { EQ_SLOTS, EQ_DEFAULT, ORE_TABLE, QUAL, EQ_BASE, RECIPES_START } from "../../src/data/equipamento.ts";
import { RUNE_EL, RUNE_KEYS } from "../../src/data/runas.ts";
import { WALK_SPEED, CITIES } from "../../src/data/economia.ts";
import { HERO_SPEED } from "../../src/data/herois.ts";

// Fase 4/6: tabelas e geometria importadas direto dos módulos. Atenção: o script legado acrescenta entradas a
// várias tabelas na carga (itens, receitas…); aqui só se vê o que o módulo declara, então os testes conferem a
// coerência dessas entradas, não a lista completa do jogo.

const perto = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], 5);
};

describe("M4 (matrizes 4x4, coluna a coluna)", () => {
  const I = M4.id();

  it("identidade e multiplicação", () => {
    perto(M4.mul(I, M4.T(1, 2, 3)), M4.T(1, 2, 3));
    perto(M4.mul(M4.T(1, 2, 3), I), M4.T(1, 2, 3));
    const a = M4.ch(M4.T(1, 0, 0), M4.RY(0.7), M4.S(2));
    const b = M4.mul(M4.mul(M4.T(1, 0, 0), M4.RY(0.7)), M4.S(2));
    perto(a, b);
  });

  it("ap: translada, escala e gira pontos", () => {
    perto(M4.ap(M4.T(1, 2, 3), 1, 1, 1), [2, 3, 4]);
    perto(M4.ap(M4.S(2, 3, 4), 1, 1, 1), [2, 3, 4]);
    perto(M4.ap(M4.S(2), 1, 1, 1), [2, 2, 2]);
    perto(M4.ap(M4.RZ(Math.PI / 2), 1, 0, 0), [0, 1, 0]);
    perto(M4.ap(M4.RX(Math.PI / 2), 0, 1, 0), [0, 0, 1]);
    perto(M4.ap(M4.RY(Math.PI / 2), 0, 0, 1), [1, 0, 0]);
    // ch aplica da direita para a esquerda: primeiro escala, depois translada
    perto(M4.ap(M4.ch(M4.T(1, 0, 0), M4.S(2)), 1, 0, 0), [3, 0, 0]);
  });

  it("look: o olho vai para a origem e o alvo fica no -Z", () => {
    const V = M4.look([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    perto(M4.ap(V, 0, 0, 5), [0, 0, 0]);
    perto(M4.ap(V, 0, 0, 0), [0, 0, -5]);
  });

  it("ortho: a caixa vira o cubo [-1, 1]", () => {
    const P = M4.ortho(-10, 10, -5, 5, 1, 100);
    perto(M4.ap(P, 10, 5, -1), [1, 1, -1]);
    perto(M4.ap(P, -10, -5, -100), [-1, -1, 1]);
  });
});

describe("tabelas de itens e equipamento", () => {
  it("ITEM_DEFS: a chave de cada item é a própria chave da tabela", () => {
    for (const [k, d] of Object.entries(ITEM_DEFS)) expect(d.key, k).toBe(k);
  });

  it("ART: cada desenho é um retângulo de '#' e '.'", () => {
    for (const [k, linhas] of Object.entries(ART) as [string, string[]][]) {
      for (const l of linhas) {
        expect(l.length, k).toBe(linhas[0].length);
        expect(l, k).toMatch(/^[#.]+$/);
      }
    }
  });

  it("EQ_DEFAULT: cada espaço do boneco tem uma peça que existe e vai naquele espaço", () => {
    expect(Object.keys(EQ_DEFAULT).sort()).toEqual(EQ_SLOTS.map((s) => s.id).sort());
    for (const [slot, item] of Object.entries(EQ_DEFAULT)) expect(ITEM_DEFS[item]?.slot, item).toBe(slot);
  });

  it("minérios, qualidades e receitas iniciais apontam para o que existe", () => {
    for (const [ore, chance] of ORE_TABLE as [string, number][]) {
      expect(ITEM_DEFS[ore], ore).toBeDefined();
      expect(chance > 0 && chance < 1).toBe(true);
    }
    for (let i = 1; i < QUAL.length; i++) {
      expect(QUAL[i].stat).toBeGreaterThan(QUAL[i - 1].stat);
      expect(QUAL[i].dur).toBeGreaterThan(QUAL[i - 1].dur);
    }
    for (const r of RECIPES_START) expect(EQ_BASE[r], r).toBeDefined();
  });
});

describe("outras tabelas", () => {
  it("RUNE_KEYS são as chaves de RUNE_EL", () => {
    expect(RUNE_KEYS).toEqual(Object.keys(RUNE_EL));
  });

  it("WALK_SPEED deriva de HERO_SPEED; cidades com id único", () => {
    expect(WALK_SPEED).toBeCloseTo(HERO_SPEED * 0.6);
    const ids = CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
