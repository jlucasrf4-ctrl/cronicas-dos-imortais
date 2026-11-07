import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ITEM_DEFS } from "../../src/data/itens.ts";
import { QUIVERS, QV_STACK, QV_ROWS } from "../../src/data/recursos.ts";
import { arrowCap, qvInv, qvTrim, tryAddQuiver } from "../../src/expedicao/preparo.ts";
import { isArrowIt, qvSync } from "../../src/items/aljava.ts";
import { refillQuiver } from "../../src/render/sprites.ts";
import { econ } from "../../src/core/state.ts";
import { iniciarDanoNoLobo } from "../../src/inicio/base/16_v3.6.7_dano_no_lobo.ts";
import { iniciarAljava } from "../../src/inicio/modulos/v5.5_aljava.ts";
import type { Hero, Item } from "../../src/core/tipos.ts";

// Fase 6: a capacidade da aljava (v5.5). A aljava é uma grade de QV_ROWS linhas; cada pacote de flechas
// ocupa 2×9 casas e leva até QV_STACK flechas. A capacidade é a do tipo da aljava, menos os pacotes que não
// cabem porque outros itens ocupam o lugar.
// Do código de carga, só o que estende as tabelas: as formas dos itens (ART) e o item "flecha" (o pacote).
beforeAll(() => {
  iniciarDanoNoLobo();
  iniciarAljava();
});
beforeEach(() => {
  econ.quiver = { type: "comum", n: 0 };
  econ.arrowStock = 0;
  econ.stash = { cols: 24, rows: 18, items: [] };
});

const heroi = () => ({ id: "h1", name: "Teste" }) as unknown as Hero;
const pedra = (x: number, y: number): Item => ({ uid: 0, def: ITEM_DEFS.pedra, x, y, shape: [[1]], tier: 0, n: 1 });

describe("arrowCap", () => {
  it("sem herói: a capacidade do tipo da aljava", () => {
    for (const type of Object.keys(QUIVERS)) {
      econ.quiver.type = type;
      expect(arrowCap(null!)).toBe(QUIVERS[type]);
    }
  });

  it("aljava vazia: cabe tudo (30, 45, 60), e a grade fica com 2 colunas por pacote", () => {
    const cols: Record<string, number> = { comum: 6, reforcada: 10, grande: 12 };
    for (const type of Object.keys(QUIVERS)) {
      econ.quiver.type = type;
      const h = heroi();
      expect(arrowCap(h)).toBe(QUIVERS[type]);
      const inv = qvInv(h);
      expect([inv.cols, inv.rows]).toEqual([cols[type], QV_ROWS]);
      // os pacotes de teste não ficam na aljava
      expect(inv.items).toEqual([]);
    }
  });

  it("itens no meio das colunas tiram o lugar dos pacotes", () => {
    const h = heroi(),
      inv = qvInv(h);
    // um pacote em pé precisa de 9 linhas seguidas; uma pedra na linha 4 corta a coluna em 4 + 7
    inv.items.push(pedra(1, 4), pedra(4, 4));
    expect(arrowCap(h)).toBe(QV_STACK); // só as colunas 2–3 ficam livres
    inv.items.push(pedra(2, 4));
    expect(arrowCap(h)).toBe(0);
    expect(inv.items.filter(isArrowIt)).toEqual([]);
  });

  it("os pacotes que já estão na aljava contam 10 cada, mesmo incompletos", () => {
    const h = heroi();
    econ.quiver.n = 25;
    qvSync(h);
    const B = qvInv(h).items.filter(isArrowIt);
    expect(B.map((b) => b.n)).toEqual([10, 10, 5]);
    expect(arrowCap(h)).toBe(30);
    expect(qvInv(h).items.filter(isArrowIt)).toHaveLength(3);
  });
});

describe("encher e aparar", () => {
  it("qvTrim: o que passa da capacidade vai para a reserva", () => {
    const h = heroi();
    econ.quiver.n = 41;
    qvTrim(h);
    expect([econ.quiver.n, econ.arrowStock]).toEqual([30, 11]);
    qvTrim(h); // já cabe: nada muda
    expect([econ.quiver.n, econ.arrowStock]).toEqual([30, 11]);
  });

  it("qvSync: sem lugar para os pacotes, o resto vai para a reserva", () => {
    const h = heroi();
    qvInv(h).items.push(pedra(1, 4), pedra(4, 4));
    econ.quiver.n = 18;
    qvSync(h);
    expect([econ.quiver.n, econ.arrowStock]).toEqual([10, 8]);
  });

  it("refillQuiver: completa a aljava com a reserva, até a capacidade", () => {
    econ.quiver.n = 5;
    econ.arrowStock = 50;
    refillQuiver();
    expect([econ.quiver.n, econ.arrowStock]).toEqual([30, 25]);
    econ.quiver.n = 0;
    econ.arrowStock = 7;
    refillQuiver();
    expect([econ.quiver.n, econ.arrowStock]).toEqual([7, 0]);
  });

  it("tryAddQuiver: item pequeno cabe na aljava, chave desconhecida não", () => {
    const h = heroi();
    expect(tryAddQuiver(h, "pena")).toBe(true);
    expect(qvInv(h).items.map((it) => it.def.key)).toEqual(["pena"]);
    expect(tryAddQuiver(h, "nao_existe")).toBe(false);
  });
});
