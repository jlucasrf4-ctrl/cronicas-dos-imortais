import { describe, expect, it } from "vitest";
import { hashStr, rng32 } from "../../src/core/rng.ts";
import { ATTR_DEFS, BIRTH, AFFINITIES, GENETICS } from "../../src/data/nascimento.ts";
import { NODES, NODE_BY_ID, SYNERGIES } from "../../src/data/arvores.ts";
import { bornFromSeed } from "../../src/hero/nascimento.ts";
import { nodeRank, nodeState, nv, synOn } from "../../src/hero/arvores.ts";
import type { Hero } from "../../src/core/tipos.ts";

// Fase 4/6: lógica pura que já virou módulo ES, testada direto no Node (sem montar o jogo).

describe("rng com semente", () => {
  it("hashStr é o FNV-1a de 32 bits", () => {
    expect(hashStr("")).toBe(2166136261);
    expect(hashStr("a")).toBe(0xe40c292c);
    expect(hashStr("foobar")).toBe(0xbf9cf968);
  });

  it("rng32: mesma semente, mesma sequência, sempre em [0, 1)", () => {
    const a = rng32(42),
      b = rng32(42),
      c = rng32(43);
    const sa = Array.from({ length: 1000 }, a);
    expect(Array.from({ length: 1000 }, b)).toEqual(sa);
    expect(Array.from({ length: 1000 }, c)).not.toEqual(sa);
    for (const x of sa) expect(x >= 0 && x < 1).toBe(true);
  });
});

describe("bornFromSeed", () => {
  const sementes = Array.from({ length: 3000 }, (_, i) => hashStr("heroi-" + i));
  const nascidos = sementes.map(bornFromSeed);
  const total = ATTR_DEFS.length * BIRTH.base + BIRTH.pool;

  it("é determinístico", () => {
    expect(sementes.slice(0, 50).map(bornFromSeed)).toEqual(nascidos.slice(0, 50));
  });

  it(`todo herói nasce com o mesmo total (${total}), cada atributo entre base e máximo`, () => {
    expect(total).toBe(45);
    for (const n of nascidos) {
      const v = ATTR_DEFS.map((a) => n.attrs[a.id]!);
      expect(v.reduce((s, x) => s + x, 0)).toBe(total);
      for (const x of v) expect(x >= BIRTH.base && x <= BIRTH.max).toBe(true);
    }
  });

  it("a genética pertence à afinidade sorteada", () => {
    for (const n of nascidos) {
      expect(AFFINITIES[n.aff]).toBeDefined();
      expect(GENETICS[n.gen].aff).toBe(n.aff);
    }
  });

  it("as afinidades saem com frequência parecida", () => {
    const conta: Record<string, number> = {};
    for (const n of nascidos) conta[n.aff] = (conta[n.aff] ?? 0) + 1;
    const ids = Object.keys(AFFINITIES);
    expect(Object.keys(conta).sort()).toEqual([...ids].sort());
    const esperado = nascidos.length / ids.length;
    for (const id of ids) expect(Math.abs(conta[id] - esperado) / esperado).toBeLessThan(0.15);
  });

  it("o viés da genética puxa os atributos favorecidos", () => {
    // média de cada atributo entre os nascidos de uma genética, comparada com a média geral
    const media = (lista: typeof nascidos, id: string) => lista.reduce((s, n) => s + n.attrs[id]!, 0) / lista.length;
    for (const [gen, G] of Object.entries(GENETICS) as [string, { bias: Record<string, number> }][]) {
      const deles = nascidos.filter((n) => n.gen === gen);
      if (deles.length < 60) continue;
      const [maisForte] = Object.entries(G.bias).sort((a, b) => b[1] - a[1]);
      expect(media(deles, maisForte[0]), `${gen}.${maisForte[0]}`).toBeGreaterThan(media(nascidos, maisForte[0]));
    }
  });
});

describe("árvores", () => {
  it("NODE_BY_ID indexa todos os NODES, e requisitos e sinergias apontam para nós que existem", () => {
    expect(Object.keys(NODE_BY_ID)).toHaveLength(NODES.length);
    for (const n of NODES) if (n.req) expect(NODE_BY_ID[n.req], n.id).toBeDefined();
    for (const s of SYNERGIES) for (const id of s.needs) expect(NODE_BY_ID[id], s.id).toBeDefined();
    for (const G of Object.values(GENETICS) as { fav: string[] }[])
      for (const id of G.fav) expect(NODE_BY_ID[id], id).toBeDefined();
  });

  const gen = "sangue_incandescente"; // fogo; ressoa com corte_sangrento e contra_golpe
  const heroi = (nodes: Record<string, boolean>) => ({ aff: "fogo", gen, nodes }) as Hero;

  it("nodeRank/nv: rank 2 quando a genética ressoa com o nó", () => {
    const h = heroi({ corte_sangrento: true, guarda_firme: true });
    expect(nodeRank(h, "corte_sangrento")).toBe(2);
    expect(nodeRank(h, "guarda_firme")).toBe(1);
    expect(nodeRank(h, "rastreador")).toBe(0);
    expect(nv(h, "corte_sangrento", 0)).toBe(NODE_BY_ID.corte_sangrento.v[1]);
    expect(nv(h, "guarda_firme", 0)).toBe(NODE_BY_ID.guarda_firme.v[0]);
    expect(nv(h, "rastreador", -1)).toBe(-1);
    expect(nodeRank(null, "guarda_firme")).toBe(0);
  });

  it("synOn: sinergia ligada só com todos os nós", () => {
    expect(synOn(heroi({ corte_sangrento: true }), "sangue_marcado")).toBe(false);
    expect(synOn(heroi({ corte_sangrento: true, rastreador: true }), "sangue_marcado")).toBe(true);
    expect(synOn(heroi({}), "nao_existe")).toBe(false);
  });

  it("nodeState: owned, blocked (outra afinidade), locked (falta o requisito), open", () => {
    const h = heroi({ guarda_firme: true });
    expect(nodeState(h, NODE_BY_ID.guarda_firme)).toBe("owned");
    expect(nodeState(h, NODE_BY_ID.est_raio)).toBe("blocked");
    expect(nodeState(h, NODE_BY_ID.contra_golpe)).toBe("locked");
    expect(nodeState(h, NODE_BY_ID.impulso_escudo)).toBe("open");
  });
});
