import { afterEach, describe, expect, it, vi } from "vitest";
import { ITEM_DEFS } from "../../src/data/itens.ts";
import {
  TIERS,
  dilate,
  rotShape,
  ensureInv,
  canPlace,
  rollTier,
  itemValBase,
  stackTarget,
  cellsOf,
  shapeCells,
  packShapeFor,
  packCap,
  packMergeNew,
  meatCountIn,
  takeN,
} from "../../src/items/inventario.ts";
import type { Hero, InvGrid, Item as ItemJogo } from "../../src/core/tipos.ts";

// Fase 4/6: o inventário em grade (v3.10 + pacotes 9/9 da v6.6), importado direto de src/items/inventario.ts.
// Só com as tabelas dos módulos: o legado acrescenta carne/erva/folhama a PACK_KEYS na carga; aqui são pedra e penas.
type Item = ItemJogo;
const item = (key: string, x: number, y: number, extra: Partial<Item> = {}): Item =>
  ({
    def: ITEM_DEFS[key],
    x,
    y,
    shape: ITEM_DEFS[key].shape!.map((r: number[]) => r.slice()),
    tier: 0,
    ...extra,
  }) as Item;
// grade com itens parciais: só os campos que cada função lê
const grade = (cols: number, rows: number, items: object[] = []) => ({ cols, rows, items }) as InvGrid;

afterEach(() => vi.restoreAllMocks());

describe("formas", () => {
  it("rotShape gira 90° no sentido horário; 4 giros voltam ao começo", () => {
    const L = [
      [1, 0],
      [1, 1],
      [1, 0],
    ];
    expect(rotShape(L)).toEqual([
      [1, 1, 1],
      [0, 1, 0],
    ]);
    expect(rotShape(rotShape(rotShape(rotShape(L))))).toEqual(L);
  });

  it("dilate engorda 1 casinha no eixo pedido", () => {
    expect(dilate([[1]], "x")).toEqual([[1, 1, 1]]);
    expect(dilate([[1]], "xy")).toEqual([
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ]);
  });

  it("cellsOf e shapeCells contam as casinhas cheias", () => {
    const sh = [
      [1, 0, 1],
      [0, 1, 0],
    ];
    expect(cellsOf(sh)).toBe(3);
    expect(shapeCells(sh)).toBe(3);
  });

  it("ensureInv cria a mochila padrão uma vez só", () => {
    const h = {} as Hero; // herói sem mochila
    const inv = ensureInv(h);
    expect(inv).toEqual({ cols: 24, rows: 15, items: [], mochila: true }); // v7.7: marcada como grade de mochila
    expect(ensureInv(h)).toBe(inv);
  });
});

describe("canPlace", () => {
  it("dentro da grade e sem encostar em outro item (só as casinhas cheias contam)", () => {
    const inv = grade(6, 4, [
      {
        x: 0,
        y: 0,
        shape: [
          [1, 0],
          [1, 1],
        ],
        def: {},
      },
    ]);
    expect(canPlace(inv, [[1]], 1, 0)).toBe(true); // o buraco do L
    expect(canPlace(inv, [[1]], 1, 1)).toBe(false);
    expect(
      canPlace(
        inv,
        [
          [1, 1],
          [1, 1],
        ],
        4,
        2,
      ),
    ).toBe(true);
    expect(canPlace(inv, [[1, 1]], 5, 0)).toBe(false); // sai pela direita
    expect(canPlace(inv, [[1]], 0, 0, inv.items[0])).toBe(true); // ignorando o próprio item
  });

  it("aljava: só itens de até 3×3; feixe de flechas só dentro da aljava", () => {
    const qv = { ...grade(6, 6), qv: true };
    expect(canPlace(qv, [[1, 1, 1, 1]], 0, 0)).toBe(false);
    expect(canPlace(qv, [[1, 1, 1]], 0, 0)).toBe(true);
    const flecha = { def: { key: "flecha" } } as ItemJogo;
    expect(canPlace(grade(6, 6), [[1]], 0, 0, flecha)).toBe(false);
    expect(canPlace(qv, [[1]], 0, 0, flecha)).toBe(true);
  });
});

describe("empilhar e pacotes", () => {
  it("stackTarget: recurso igual na mesma casa; o pacote 9/9 passa do limite antigo", () => {
    const pilha = item("pedra", 0, 0, { n: 2 });
    const inv = grade(6, 6, [pilha]);
    expect(stackTarget(inv, item("pedra", 0, 0), 0, 0)).toBe(pilha);
    expect(stackTarget(inv, item("pedra", 0, 0), 1, 0)).toBeNull();
    pilha.n = ITEM_DEFS.pedra.stack; // cheia pelo limite antigo (4)…
    expect(packCap(pilha)).toBe(9); // …mas o pacote de 1 casinha aceita até 9
    expect(stackTarget(inv, item("pedra", 0, 0), 0, 0)).toBe(pilha);
    pilha.n = 9;
    expect(stackTarget(inv, item("pedra", 0, 0), 0, 0)).toBeNull();
    expect(stackTarget(inv, item("carne", 0, 0), 0, 0)).toBeNull(); // carne não é recurso nem pacote (aqui)
  });

  it("packShapeFor: a forma cresce casinha a casinha dentro do 3×3", () => {
    const p = item("pedra", 0, 0);
    expect(packShapeFor(p, 1)).toEqual([[1]]);
    expect(packShapeFor(p, 3)).toEqual([
      [1, 1, 1],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(cellsOf(packShapeFor(p, 20))).toBe(9);
  });

  it("packMergeNew: o item novo entra no pacote igual que tem casinha livre", () => {
    const velho = item("pedra", 0, 0),
      novo = item("pedra", 4, 4);
    const inv = grade(6, 6, [velho, novo]);
    expect(packMergeNew(inv, novo)).toBe(true);
    expect(inv.items).toEqual([velho]);
    expect(velho.n).toBe(2);
    expect(velho.shape).toEqual([
      [1, 1, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    // qualidade diferente não junta
    const outro = item("pedra", 4, 4, { tier: 1 });
    inv.items.push(outro as ItemJogo);
    expect(packMergeNew(inv, outro as ItemJogo)).toBe(false);
    expect(inv.items).toHaveLength(2);
  });

  it("takeN tira unidades dos pacotes, do fim para o começo", () => {
    const a = item("carne", 0, 0, { n: 2 }),
      b = item("carne", 2, 0, { n: 2 }),
      c = item("erva", 4, 0);
    const items = [a, c, b];
    expect(meatCountIn(items)).toBe(4);
    takeN(items, "carne", 3);
    expect(items).toEqual([a, c]);
    expect(a.n).toBe(1);
    expect(meatCountIn(items)).toBe(1);
  });
});

describe("qualidade e valor", () => {
  it("rollTier: 72% A · 23% A+ · 5% SS; Alfa: 15% · 60% · 25%", () => {
    const sorteio = (r: number, boss = false) => {
      vi.spyOn(Math, "random").mockReturnValue(r);
      const t = rollTier(boss);
      vi.restoreAllMocks();
      return t;
    };
    expect([sorteio(0.5), sorteio(0.8), sorteio(0.97)]).toEqual([0, 1, 2]);
    expect([sorteio(0.1, true), sorteio(0.5, true), sorteio(0.8, true)]).toEqual([0, 1, 2]);
  });

  it("itemValBase: valor × multiplicador da qualidade × quantidade", () => {
    expect(TIERS.map((t) => t.mult)).toEqual([1, 1.8, 3.5]);
    expect(itemValBase({ def: { val: 10 }, tier: 1, n: 2 } as ItemJogo)).toBe(36);
    expect(itemValBase({ def: { val: 10 } } as ItemJogo)).toBe(10);
  });
});
