import { describe, expect, it } from "vitest";
import {
  addHeroXp,
  aplicarTendenciaCorporal,
  buyNode,
  ensureHero,
  gainSkill,
  normalizarAparenciaHeroi,
  treePoints,
  xpNeed,
} from "../../src/hero/nivel.ts";
import { profLv, profLvOfXp, profMigrate } from "../../src/hero/proficiencias.ts";
import { bornFromSeed } from "../../src/hero/nascimento.ts";
import { sortearAparencia, type AparenciasDados } from "../../src/render/gl/aparencias.ts";
import { NODES, SYNERGIES } from "../../src/data/arvores.ts";
import { econ, world } from "../../src/core/state.ts";
import type { Hero } from "../../src/core/tipos.ts";
import { readFileSync } from "node:fs";

// Fase 4/6: progressão do herói (XP, nível, pontos de árvore, proficiências), importada direto dos módulos.
// Os heróis daqui são parciais de propósito (como os de saves antigos): ensureHero completa o que falta.
/* eslint-disable @typescript-eslint/no-explicit-any */
const parcial = (h: Record<string, any>) => h as Hero;
const heroi = (extra: Record<string, any> = {}): Hero => {
  const b = bornFromSeed(777);
  return ensureHero(
    parcial({ id: "h1", name: "Teste", attrs: { ...b.attrs }, seed: b.seed, aff: b.aff, gen: b.gen, ...extra }),
  );
};

describe("XP e nível", () => {
  it("xpNeed: 14 + 6 por nível", () => {
    expect([1, 2, 10].map(xpNeed)).toEqual([20, 26, 74]);
  });

  it("addHeroXp sobe vários níveis de uma vez e guarda o resto", () => {
    const h = heroi();
    addHeroXp(h, 20 + 26 + 5);
    expect([h.lvl, h.xp]).toEqual([3, 5]);
    // a soma do que foi gasto nos níveis + o resto é o total dado
    const h2 = heroi();
    addHeroXp(h2, 1000);
    let gasto = 0;
    for (let l = 1; l < h2.lvl; l++) gasto += xpNeed(l);
    expect(gasto + h2.xp).toBe(1000);
    expect(h2.xp).toBeLessThan(xpNeed(h2.lvl));
  });

  it("addHeroXp ignora quantidade não positiva e herói ausente; cada nível vira um evento", () => {
    const h = heroi(),
      n0 = world.events.length;
    addHeroXp(h, 0);
    addHeroXp(h, -5);
    addHeroXp(h, NaN);
    addHeroXp(null, 50);
    expect([h.lvl, h.xp]).toEqual([1, 0]);
    addHeroXp(h, 46);
    expect(world.events.slice(n0).map((e: any) => e.text)).toEqual([
      "Teste alcançou o nível 2.",
      "Teste alcançou o nível 3.",
    ]);
  });

  it("pontos de árvore: 1 a cada 10 níveis, mais o bônus, menos o gasto", () => {
    const h = heroi();
    expect(treePoints(h)).toBe(0);
    let xp = 0;
    for (let l = 1; l < 10; l++) xp += xpNeed(l);
    addHeroXp(h, xp);
    expect(h.lvl).toBe(10);
    expect(treePoints(h)).toBe(1);
    expect(world.events.at(-1)!.text).toBe("Teste alcançou o nível 10 e ganhou 1 ponto de desenvolvimento!");
    h.treeBonus = 2;
    h.spent = 1;
    expect(treePoints(h)).toBe(2);
  });
});

describe("tendências de aparência", () => {
  it("redistribui quatro pontos conforme o corpo sem alterar o total", () => {
    const base = { forca: 9, constituicao: 9, destreza: 9, velocidade: 9, mana: 9 },
      antes = Object.values(base).reduce((s, n) => s + n, 0);
    aplicarTendenciaCorporal(base, "corpo_f04");
    expect(base).toEqual({ forca: 8, constituicao: 8, destreza: 10, velocidade: 10, mana: 9 });
    expect(Object.values(base).reduce((s, n) => s + n, 0)).toBe(antes);
  });

  it("heroína e líder mantêm os atributos base do nascimento", () => {
    const base = { forca: 8, constituicao: 8, destreza: 8, velocidade: 8, mana: 8 };
    aplicarTendenciaCorporal(base, "lider");
    aplicarTendenciaCorporal(base, "heroina");
    expect(Object.values(base)).toEqual([8, 8, 8, 8, 8]);
  });
});

describe("migração de aparência de recrutáveis", () => {
  const dados = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
  const sortearPadrao = () => sortearAparencia(dados, () => 0);

  it("preserva escolhas do editor depois da migração, incluindo cabeça trocada e visual original", () => {
    const h = parcial({ id: "editor", name: "Editor", visual: { corpo: "deusa_verao", cabeca: "propria" } });
    normalizarAparenciaHeroi(h, sortearPadrao);
    for (const visual of [
      { corpo: "corpo_m06", cabeca: "homem_raspado" },
      { corpo: "corpo_f02", cabeca: "busto_01" },
      undefined,
    ]) {
      h.visual = visual;
      expect(
        normalizarAparenciaHeroi(h, () => {
          throw new Error("não deve desfazer a escolha do editor");
        }),
      ).toBe(false);
      expect(h.visual).toEqual(visual);
    }
  });

  it("sorteia aparência feminina válida ao migrar visual ausente nos dados de teste", () => {
    const h = parcial({ id: "antiga", name: "Antiga", visual: { corpo: "deusa_verao", cabeca: "propria" } });
    expect(normalizarAparenciaHeroi(h, sortearPadrao)).toBe(true);
    expect(h.visual).toEqual(sortearPadrao());
    expect(h.aparenciaVersao).toBe(1);
  });

  it("troca corpo masculino e preserva recrutável válido sem nova rolagem", () => {
    const antigo = parcial({ id: "antigo", name: "Antigo", visual: { corpo: "corpo_m06", cabeca: "propria" } });
    normalizarAparenciaHeroi(antigo, sortearPadrao);
    expect(antigo.visual).toEqual(sortearPadrao());

    const valido = parcial({
      id: "valido",
      name: "Valido",
      aparenciaVersao: 1,
      visual: { corpo: "corpo_f05", cabeca: "propria" },
    });
    expect(
      normalizarAparenciaHeroi(valido, () => {
        throw new Error("não deve sortear novamente");
      }),
    ).toBe(false);
    expect(valido.visual).toEqual({ corpo: "corpo_f05", cabeca: "propria" });
  });
});

describe("árvores", () => {
  const raiz = NODES.find((n: any) => !n.req && !n.only)!,
    filho = NODES.find((n: any) => n.req === raiz.id && !n.only)!;

  it("buyNode: precisa de ponto e de nó aberto; gasta um ponto", () => {
    const h = heroi();
    expect(buyNode(h, raiz.id)).toBe(false); // sem ponto
    h.treeBonus = 2;
    expect(buyNode(h, "nao_existe")).toBe(false);
    expect(buyNode(h, filho.id)).toBe(false); // trancado: falta o requisito
    expect(buyNode(h, raiz.id)).toEqual(expect.any(Array));
    expect([h.nodes[raiz.id], h.spent, treePoints(h)]).toEqual([true, 1, 1]);
    expect(buyNode(h, raiz.id)).toBe(false); // já tem
    expect(buyNode(h, filho.id)).toEqual(expect.any(Array));
    expect(treePoints(h)).toBe(0);
  });

  it("buyNode devolve a sinergia que o nó completa", () => {
    const s = SYNERGIES.find((x: any) => x.needs.every((id: string) => !NODES.find((n: any) => n.id === id)!.only))!;
    const h = heroi({ treeBonus: 99 }),
      compra = (id: string): unknown => {
        const n = NODES.find((x: any) => x.id === id)!;
        if (n.req && !h.nodes[n.req]) compra(n.req);
        return h.nodes[id] ? [] : buyNode(h, id);
      };
    const r = s.needs.map(compra);
    expect((r.at(-1) as any[]).map((x) => x.name)).toContain(s.name);
  });
});

describe("migração e proficiências", () => {
  it("ensureHero: herói antigo (Vida → Constituição) ganha os campos que faltam", () => {
    const h = ensureHero(parcial({ id: "velho", name: "Velho", attrs: { vida: 7 } }));
    expect(h.attrs.constituicao).toBe(7);
    expect("vida" in h.attrs).toBe(false);
    expect([h.lvl, h.xp, h.spent, h.treeBonus]).toEqual([1, 0, 0, 0]);
    expect(h.manaMax).toBe(20 + h.attrs.mana * 4);
    expect(h.aff && h.gen && h.seed).toBeTruthy();
    // a afinidade vem da semente do id: o mesmo herói antigo nasce igual
    expect(ensureHero(parcial({ id: "velho", name: "Velho", attrs: { vida: 7 } })).aff).toBe(h.aff);
  });

  it("profLvOfXp: começa em 1, nunca desce, para em 10 (20 · 140 · 540 de XP para os níveis 2 · 5 · 10)", () => {
    expect([0, 19, 20, 139, 140, 539, 540, 1e9].map(profLvOfXp)).toEqual([1, 1, 2, 4, 5, 9, 10, 10]);
    let ant = 1;
    for (let xp = 0; xp < 700; xp++) {
      const l = profLvOfXp(xp);
      expect(l).toBeGreaterThanOrEqual(ant);
      ant = l;
    }
  });

  it("profMigrate: metade da XP da espada vai para as outras armas; forja vira ferreiro/artesão", () => {
    const fx = econ.forgeXp;
    econ.forgeXp = 10;
    const h = parcial({ skills: { espada: { xp: 200, level: 1 }, clava: { xp: 5, level: 1 } } });
    profMigrate(h);
    econ.forgeXp = fx;
    expect(h.skills.espada.level).toBe(profLvOfXp(200));
    expect(h.skills.clava).toEqual({ xp: 5, level: 1 }); // já existia
    expect(h.skills.machado).toEqual({ xp: 100, level: profLvOfXp(100) });
    expect(h.skills.ferreiro).toEqual({ xp: 30, level: profLvOfXp(30) });
    expect(profLv(h, "machado")).toBe(profLvOfXp(100));
    expect(profLv(h, "arco")).toBe(0);
    profMigrate(h); // uma vez só
    expect(h.skills.machado.xp).toBe(100);
  });

  it("gainSkill: cria a proficiência, sobe de nível pela XP e dá 60% dela ao herói", () => {
    const h = heroi();
    gainSkill(h, "arco", 25);
    expect(h.skills.arco).toEqual({ level: 2, xp: 25 });
    expect(h.xp).toBeCloseTo(15);
    gainSkill(h, "arco", 0);
    expect(h.skills.arco.xp).toBe(25);
  });
});
