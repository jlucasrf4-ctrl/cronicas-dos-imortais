import { beforeAll, describe, expect, it } from "vitest";
import { world } from "../../src/core/state.ts";
import type { Andante, Animal } from "../../src/core/tipos.ts";
import {
  NAV,
  NAV_PENDING,
  navBuild,
  navIdx,
  navX,
  navY,
  compAt,
  losClear,
  findPath,
  getPath,
  isIgnored,
  abandonGoal,
  navShoreFor,
} from "../../src/map/navegacao.ts";

// Fase 4/6: a navegação (v6.2) importada direto do módulo, num mundo de mentira: uma parede de água em x = 400 com
// uma passagem em y 380–420, e uma ilha (anel de água em volta de 700,300). Região ativa: CONFIG.SIM_BOUNDS
// (150..820 × 150..650), passo da grade 4.
const PAREDE_X = 400;
const naPassagem = (y: number) => y >= 380 && y <= 420;

beforeAll(() => {
  const agua: { x: number; y: number }[] = [];
  for (let y = 152; y <= 648; y += 4) if (!naPassagem(y)) agua.push({ x: PAREDE_X, y });
  for (let x = 680; x <= 720; x += 4)
    for (let y = 280; y <= 320; y += 4) if (x === 680 || x === 720 || y === 280 || y === 320) agua.push({ x, y });
  world.waterPoints = agua;
  navBuild();
});

/** Todos os trechos da rota (do início a cada ponto) passam só por terra. */
const rotaPorTerra = (sx: number, sy: number, pts: { x: number; y: number }[]) => {
  let x = sx,
    y = sy;
  for (const p of pts) {
    if (!losClear(x, y, p.x, p.y)) return false;
    x = p.x;
    y = p.y;
  }
  return true;
};

describe("grade de navegação", () => {
  it("monta a grade, as massas de terra e as margens", () => {
    expect(NAV.ready).toBe(true);
    expect(NAV.step).toBe(4);
    expect(NAV.compSize.length).toBe(2); // continente + ilha
    expect(NAV.shore.length).toBeGreaterThan(0);
  });

  it("navIdx/navX/navY: ida e volta no centro da célula, e prende na borda", () => {
    const k = navIdx(300, 200);
    expect([navX(k), navY(k)]).toEqual([300, 200]);
    expect(navIdx(-1000, -1000)).toBe(0);
    expect(navIdx(1e6, 1e6)).toBe(NAV.w * NAV.h - 1);
  });

  it("compAt: a ilha é outra massa de terra; os dois lados da parede são a mesma (pela passagem)", () => {
    expect(compAt(300, 200)).toBe(compAt(500, 600));
    expect(compAt(700, 300)).not.toBe(compAt(300, 200));
  });

  it("losClear: a parede corta a linha reta; a passagem não", () => {
    expect(losClear(300, 200, 500, 200)).toBe(false);
    expect(losClear(300, 400, 500, 400)).toBe(true);
  });
});

describe("findPath (A* + suavização)", () => {
  it("contorna a parede pela passagem, só por terra", () => {
    const r = findPath(300, 200, 500, 200, Infinity)!;
    expect(r).not.toBeNull();
    expect(r.pts.at(-1)).toEqual({ x: 500, y: 200 });
    expect(rotaPorTerra(300, 200, r.pts)).toBe(true);
    expect(r.pts.some((p: { x: number; y: number }) => naPassagem(p.y) && Math.abs(p.x - PAREDE_X) <= 8)).toBe(true);
    expect(r.len).toBeGreaterThan(200); // mais que a linha reta
  });

  it("caminho livre vira um trecho só", () => {
    const r = findPath(200, 200, 300, 300, Infinity)!;
    expect(r.pts).toEqual([{ x: 300, y: 300 }]);
    expect(r.len).toBeCloseTo(Math.hypot(100, 100));
  });

  it("outra ilha: sem rota; rota maior que o limite: null", () => {
    expect(findPath(300, 200, 700, 300, Infinity)).toBeNull();
    expect(findPath(300, 200, 500, 200, 210)).toBeNull();
  });
});

describe("getPath (cache por bicho, orçamento por tick)", () => {
  it("guarda a rota e reaproveita para o mesmo alvo sem gastar orçamento", () => {
    world.tick = 100;
    world.navBudget = 2;
    const a = { x: 300, y: 200 } as Andante;
    const p1 = getPath(a, 500, 200, Infinity);
    expect(p1).toMatchObject({ ok: true, gx: 500, gy: 200 });
    expect(world.navBudget).toBe(1);
    expect(getPath(a, 505, 200, Infinity)).toBe(p1); // alvo a menos de 14 px: mesma rota
    expect(world.navBudget).toBe(1);
  });

  it("sem orçamento: devolve NAV_PENDING (tenta no próximo tick)", () => {
    world.navBudget = 0;
    expect(getPath({ x: 300, y: 200 } as Andante, 500, 600, Infinity)).toBe(NAV_PENDING);
  });
});

describe("margens e alvos ignorados", () => {
  it("navShoreFor: a margem mais perto, na mesma massa de terra", () => {
    const p = navShoreFor({ x: 380, y: 200 } as Animal, 100);
    expect(p).not.toBeNull();
    expect(Math.abs(p!.x - PAREDE_X)).toBeLessThanOrEqual(4); // a água é a parede
    expect(p!.comp).toBe(compAt(380, 200));
  });

  it("abandonGoal: larga o alvo, ignora por 180 min e volta a ficar parado", () => {
    world.tick = 1000;
    const alvo = { x: 1, y: 1 };
    const a = { targetEntity: alvo, target: { x: 1, y: 1 }, state: "seekFood", nav: {} } as unknown as Animal;
    abandonGoal(a);
    expect(a).toMatchObject({ target: null, targetEntity: null, nav: null, state: "idle" });
    expect(isIgnored(a, alvo)).toBe(true);
    world.tick = 1181;
    expect(isIgnored(a, alvo)).toBe(false);
  });
});
