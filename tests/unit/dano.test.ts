import { describe, expect, it } from "vitest";
import { DANO } from "../../src/data/combate.ts";
import { ITEM_DEFS } from "../../src/data/itens.ts";
import { QUAL } from "../../src/data/equipamento.ts";
import {
  aplicarDano,
  mixOfKey,
  mixTxt,
  monProf,
  isMonstro,
  armorPiece,
  ensureFol,
  folCap,
  folPct,
} from "../../src/field/dano.ts";
import { folVel } from "../../src/field/tipos.ts";
import type { Item, Monster } from "../../src/core/tipos.ts";

// Fase 4/6: o dano em 3 tipos (v6.2), importado direto de src/field/dano.ts.
// peças e bichos parciais: só os campos que a função lê
const peca = (o: unknown) => o as Item;
const bicho = (o: unknown) => o as Monster;
const perto = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("aplicarDano", () => {
  it("sem resistência: o dano se divide pelo mix", () => {
    const r = aplicarDano(100, [15, 75, 10], [0, 0, 0]);
    expect(r.total).toBeCloseTo(100);
    perto(r.parts, [15, 75, 10]);
  });

  it("resistência por tipo, com teto", () => {
    perto(aplicarDano(100, [0, 100, 0], [0, 50, 0]).parts, [0, 50, 0]);
    // 100% de resistência vira o teto (70%): sobra 30%
    expect(DANO.TETO).toBe(70);
    expect(aplicarDano(100, [40, 40, 20], [100, 100, 100]).total).toBeCloseTo(30);
  });

  it("penetração da ponta: só na resistência perfurante", () => {
    expect(aplicarDano(100, [100, 0, 0], [50, 0, 0], 0.4).total).toBeCloseTo(70); // 50% × (1 − 0,4) = 30%
    expect(aplicarDano(100, [0, 100, 0], [0, 50, 0], 0.4).total).toBeCloseTo(50);
  });

  it("golpe de pelo menos 1 tira pelo menos 1; abaixo de 1 fica fracionário", () => {
    expect(aplicarDano(1, [0, 0, 100], [0, 0, 70]).total).toBe(1);
    expect(aplicarDano(0.5, [0, 0, 100], [0, 0, 70]).total).toBeCloseTo(0.15);
  });
});

describe("mix das armas e perfis dos bichos", () => {
  it("mixOfKey: tabela da arma, punho sem arma, espada quando não conhece", () => {
    expect(mixOfKey("eq_lanca")).toBe(DANO.ARMAS.eq_lanca);
    expect(mixOfKey(null)).toBe(DANO.ARMAS.punho);
    expect(mixOfKey("nao_existe")).toBe(DANO.ARMAS.eq_espada);
    for (const [k, mix] of Object.entries(DANO.ARMAS) as [string, number[]][])
      expect(
        mix.reduce((s, v) => s + v, 0),
        k,
      ).toBe(100);
  });

  it("mixTxt", () => {
    expect(mixTxt([15, 75, 10])).toBe("🗡 15% · ✂ 75% · 🔨 10%");
  });

  it("monProf: perfil pelo prof, boneco, alfa, javali; lobo por padrão", () => {
    expect(monProf(null)).toBe(DANO.PERFIS.lobo);
    expect(monProf(bicho({ prof: "cervo" }))).toBe(DANO.PERFIS.cervo);
    expect(monProf(bicho({ prof: "inexistente" }))).toBe(DANO.PERFIS.lobo);
    expect(monProf(bicho({ dummy: true }))).toBe(DANO.PERFIS.boneco);
    expect(monProf(bicho({ boss: true }))).toBe(DANO.PERFIS.alfa);
    expect(monProf(bicho({ kind: "javalino" }))).toBe(DANO.PERFIS.javali);
    expect(isMonstro(bicho({ runic: true }))).toBe(true);
    expect(isMonstro(bicho({ kind: "wolf" }))).toBe(false);
  });
});

describe("armadura por peça", () => {
  it("material × peso do espaço × qualidade", () => {
    perto(armorPiece(peca({ def: ITEM_DEFS.eq_armadura })), [8, 16, 12]); // couro no peito, qualidade comum
    perto(armorPiece(peca({ def: ITEM_DEFS.eq_elmo })), [11, 12, 8]); // placa na cabeça (peso 0,5)
    const q3 = QUAL[3].stat;
    perto(armorPiece(peca({ def: ITEM_DEFS.eq_armadura, q: 3 })), [8 * q3, 16 * q3, 12 * q3]);
  });

  it("peça sem tabela usa o armor antigo como couro; sem item, nada", () => {
    perto(armorPiece(peca({ def: { key: "x", slot: "peito", armor: 0.24 } })), [16, 32, 24]);
    expect(armorPiece(null)).toEqual([0, 0, 0]);
    expect(armorPiece(peca({ def: { key: "y", slot: "peito" } }))).toEqual([0, 0, 0]);
  });
});

describe("fôlego", () => {
  it("começa cheio pelo perfil; quebras não reduzem a recuperação externa", () => {
    const m = ensureFol(bicho({ prof: "javali" }));
    expect(m).toMatchObject({ folMax: 12, fol: 12, folLost: 0 });
    expect(folPct(m)).toBe(1);
    m.fol = 6;
    m.folLost = 2;
    expect(folPct(m)).toBe(0.5);
    expect(folCap(m)).toBe(12); // perder fôlego não baixa mais o teto (v7.7)
    m.quedas = 1;
    expect(folCap(m)).toBe(12);
    m.quedas = 3;
    expect(folCap(m)).toBe(12);
    m.quedas = 6;
    expect(folCap(m)).toBe(12); // a exaustão não limita a recuperação externa
    expect(folPct(ensureFol(bicho({ dummy: true })))).toBe(1); // boneco: fôlego 0, nunca divide por zero
  });
  it("velocidade em 4 faixas de fôlego: 100 · 85 · 70 · 55%", () => {
    const m = ensureFol(bicho({ prof: "javali", alive: true }));
    const vel = (f: number) => ((m.fol = f), folVel(m));
    expect([vel(12), vel(9), vel(8.9), vel(6), vel(3), vel(2.9), vel(0)]).toEqual([1, 1, 0.85, 0.85, 0.7, 0.55, 0.55]);
    expect(folVel(bicho({ dummy: true, alive: true }))).toBe(1); // sem fôlego: velocidade normal
  });
});
