import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ITEM_DEFS } from "../../src/data/itens.ts";
import { RECIPES, RES, RES_KEY } from "../../src/data/recursos.ts";
import { EQ_BASE, MAT_NAME, RECIPES_START } from "../../src/data/equipamento.ts";
import { craft, resTotal } from "../../src/render/sprites.ts";
import { forgeBook, forgeHave, forgeKnows, forgeLearn } from "../../src/forja/forja.ts";
import { ensureInv } from "../../src/items/inventario.ts";
import { qvInv } from "../../src/expedicao/preparo.ts";
import { econ, world } from "../../src/core/state.ts";
import { iniciarDanoNoLobo } from "../../src/inicio/base/16_v3.6.7_dano_no_lobo.ts";
import { iniciarRunas } from "../../src/inicio/modulos/v4.4_runas.ts";
import { iniciarForja } from "../../src/inicio/modulos/v4.5_forja.ts";
import { iniciarAljava } from "../../src/inicio/modulos/v5.5_aljava.ts";
import { iniciarGalhoLenha } from "../../src/inicio/modulos/v7.1_galho_lenha.ts";
import type { Hero, Item, Receita } from "../../src/core/tipos.ts";

// Fase 6: receitas. As flechas (RECIPES, v3.4; galho no lugar da madeira desde a v7.1) e o livro de receitas
// da forja (v4.5: o acampamento começa sabendo RECIPES_START e aprende o resto analisando ou desmontando).
// Do código de carga, só o que estende as tabelas, na ordem de src/main.ts. As runas e a forja também agendam
// um setTimeout que monta botões no DOM: com o relógio falso, esses timers nunca rodam.
beforeAll(() => {
  vi.useFakeTimers();
  iniciarDanoNoLobo();
  iniciarRunas();
  iniciarForja();
  iniciarAljava();
  iniciarGalhoLenha();
  vi.useRealTimers();
});
// craft escreve a mensagem em #craft-msg
const msg = { textContent: "" };
beforeEach(() => {
  vi.stubGlobal("document", { getElementById: () => msg });
  econ.test = false;
  econ.quiver = { type: "comum", n: 0 };
  econ.arrowStock = 0;
  econ.stash = { cols: 24, rows: 18, items: [] };
  delete econ.recipes;
  world.heroes = [];
});
afterEach(() => vi.unstubAllGlobals());

const heroi = (loot: Record<string, number> = {}) => {
  const h = { id: "h" + world.heroes.length, name: "Teste", state: "idle", loot } as unknown as Hero;
  world.heroes.push(h);
  return h;
};
const peca = (key: string, n = 1): Item => ({ uid: 0, def: ITEM_DEFS[key], x: 0, y: 0, shape: [[1]], tier: 0, n });
const receita = (id: string) => RECIPES.find((r) => r.id === id) as Receita;

describe("receitas de flecha", () => {
  it("cada material é um recurso conhecido; a madeira virou galho na v7.1", () => {
    for (const r of RECIPES) {
      expect(r.mats.wood).toBeUndefined();
      expect(r.mats.galho).toBeGreaterThan(0);
      for (const k of Object.keys(r.mats)) {
        expect(RES[k]).toBeDefined();
        expect(ITEM_DEFS[RES_KEY[k]]).toBeDefined();
      }
      expect(r.out).toBe("arrow");
    }
    // o galho vem primeiro na receita (é o que o painel mostra antes)
    expect(Object.keys(receita("arrow_stone").mats)).toEqual(["galho", "stone", "feather"]);
  });

  it("craft: faz o que os materiais de todos os heróis permitem e gasta os materiais", () => {
    heroi({ galho: 3, stone: 1, feather: 1 });
    heroi({ galho: 2, stone: 2, feather: 4 });
    expect(resTotal("feather")).toBe(5);
    expect(craft(receita("arrow_stone"), 10)).toBe(3); // a pedra limita: 3
    expect(econ.quiver.n).toBe(3);
    expect(["galho", "stone", "feather"].map(resTotal)).toEqual([2, 0, 2]);
    expect(world.events.at(-1)!.text).toContain("Fabricou 3 flecha(s). Aljava: 3/30.");
  });

  it("craft: sem material não faz nada; pedido menor que o possível faz só o pedido", () => {
    heroi({ galho: 10, stone: 10 });
    expect(craft(receita("arrow_stone"), 1)).toBe(0); // falta pena
    expect(craft(receita("arrow_rustic"), 2)).toBe(2);
    expect(["galho", "stone"].map(resTotal)).toEqual([6, 8]);
  });

  it("craft: o que não cabe na aljava vai para a reserva", () => {
    heroi({ galho: 20, stone: 20, feather: 20 });
    econ.quiver.n = 28;
    expect(craft(receita("arrow_stone"), 5)).toBe(5);
    expect([econ.quiver.n, econ.arrowStock]).toEqual([30, 3]);
    expect(msg.textContent).toBe("Aljava cheia! 3 flecha(s) ficaram no inventário.");
  });

  it("craft no modo teste: grátis, até 99 de uma vez", () => {
    econ.test = true;
    const h = heroi({});
    expect(craft(receita("arrow_stone"), 200)).toBe(99);
    expect(h.loot).toEqual({});
    expect([econ.quiver.n, econ.arrowStock]).toEqual([30, 69]);
  });
});

describe("livro de receitas da forja", () => {
  it("cada receita de equipamento tem seu Projeto e usa materiais que existem", () => {
    for (const [k, B] of Object.entries(EQ_BASE)) {
      expect(ITEM_DEFS[k]).toBeDefined();
      expect(ITEM_DEFS["projeto_" + k].blueprint).toBe(k);
      for (const [m, n] of Object.entries(B.mat)) {
        expect(MAT_NAME[m]).toBeDefined();
        expect(ITEM_DEFS[m]).toBeDefined();
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it("começa com RECIPES_START; aprender uma receita nova conta uma vez só", () => {
    expect(Object.keys(forgeBook()).sort()).toEqual([...RECIPES_START].sort());
    expect(forgeKnows("eq_calca")).toBe(true);
    expect(forgeKnows("eq_espada_longa")).toBe(false);
    const n0 = world.events.length;
    expect(forgeLearn("eq_espada_longa")).toBe(true);
    expect(forgeKnows("eq_espada_longa")).toBe(true);
    expect(world.events.at(-1)!.text).toContain("aprendeu a forjar: " + ITEM_DEFS.eq_espada_longa.name);
    expect(forgeLearn("eq_espada_longa")).toBe(false);
    expect(world.events.length).toBe(n0 + 1);
    // o livro fica no econ (vai no save)
    expect(econ.recipes!.eq_espada_longa).toBe(1);
  });

  it("modo teste conhece todas as receitas sem gravar no livro", () => {
    econ.test = true;
    for (const k of Object.keys(EQ_BASE)) expect(forgeKnows(k)).toBe(true);
    expect(Object.keys(econ.recipes!).sort()).toEqual([...RECIPES_START].sort());
  });

  it("forgeHave: soma baú, mochila e aljava; lingote conta como ferro", () => {
    const h = heroi();
    econ.stash.items.push(peca("ferro", 2), peca("lingote"));
    ensureInv(h).items.push(peca("ferro"), peca("pele", 3));
    qvInv(h).items.push(peca("galho", 2));
    expect(["ferro", "pele", "galho", "prata", "lingote"].map((m) => forgeHave(h, m))).toEqual([4, 3, 2, 0, 1]);
    econ.test = true;
    expect(forgeHave(h, "prata")).toBe(999);
  });
});
