import { afterEach, describe, expect, it } from "vitest";
import { saveBlob, saveMeta, WORLD_SAVE_KEYS } from "../../src/save/salvar.ts";
import { camera, econ, world } from "../../src/core/state.ts";
import { QUAD } from "../../src/map/quadrantes.ts";
import { WORLD_K } from "../../src/map/vetorial.ts";
import { MV_VER } from "../../src/ui/opcoes.ts";
import { CONFIG } from "../../src/core/config.ts";

// Fase 4/6: o que vai para o save (saveBlob/saveMeta). Carregar (applySave) mexe no DOM: o roteiro "salvar e
// carregar" do teste diferencial cobre a ida e a volta, comparando com a v7.6.
/* eslint-disable @typescript-eslint/no-explicit-any */
const guardados = Object.fromEntries(
  (["animals", "veg", "heroes", "carcasses", "wild", "nodes", "tick", "qstore"] as const).map((k) => [k, world[k]]),
);
const quad0 = { store: QUAD.store, active: QUAD.active };
afterEach(() => {
  Object.assign(world, guardados);
  Object.assign(QUAD, quad0);
});

describe("saveBlob", () => {
  it("cabeçalho: versão do formato, escala do mundo, versão do jogo, câmera e econ inteiro", () => {
    Object.assign(world, { animals: [], veg: [], heroes: [], carcasses: [], wild: [], nodes: [] });
    const d = JSON.parse(saveBlob());
    expect([d.v, d.K, d.ver]).toEqual([1, WORLD_K, MV_VER]);
    expect(d.cam).toEqual({ scale: camera.scale, tx: camera.tx, ty: camera.ty });
    expect(d.econ).toEqual(JSON.parse(JSON.stringify(econ)));
    for (const k of Object.keys(d.world)) expect(WORLD_SAVE_KEYS.concat("activeQ")).toContain(k);
  });

  it("referência de um ser a outro vira null (a IA reencontra); os seres nas listas ficam inteiros", () => {
    const lobo: Record<string, any> = { id: 1, species: "wolf", x: 5, y: 6 },
      coelho: Record<string, any> = { id: 2, species: "rabbit", x: 7, y: 8 },
      heroi: Record<string, any> = { id: "h", name: "H", camp: { x: 1, y: 2 } };
    lobo.targetEntity = coelho;
    heroi.targetEntity = lobo;
    heroi.lista = [coelho]; // dentro de array não é cortado
    Object.assign(world, { animals: [lobo, coelho], veg: [], heroes: [heroi], carcasses: [], wild: [], nodes: [] });
    const w = JSON.parse(saveBlob()).world;
    expect(w.animals).toEqual([
      { id: 1, species: "wolf", x: 5, y: 6, targetEntity: null },
      { id: 2, species: "rabbit", x: 7, y: 8 },
    ]);
    expect(w.heroes[0].targetEntity).toBeNull();
    expect(w.heroes[0].camp).toEqual({ x: 1, y: 2 }); // objeto comum fica
    expect(w.heroes[0].lista).toEqual([{ id: 2, species: "rabbit", x: 7, y: 8 }]);
  });

  it("Set, Map e funções somem", () => {
    const a = { id: 1, visto: new Set([1]), mapa: new Map([[1, 2]]), f() {}, n: 3 };
    Object.assign(world, { animals: [a], veg: [], heroes: [], carcasses: [], wild: [], nodes: [] });
    expect(JSON.parse(saveBlob()).world.animals).toEqual([{ id: 1, n: 3 }]);
  });

  it("quadrantes: guarda os outros e o nome do ativo (o ativo está no próprio mundo)", () => {
    Object.assign(world, { animals: [], veg: [], heroes: [], carcasses: [], wild: [], nodes: [] });
    QUAD.store = { "0,0": { animals: [1] }, "1,0": { animals: [2] } } as unknown as typeof QUAD.store;
    QUAD.active = "0,0";
    const w = JSON.parse(saveBlob()).world;
    expect(w.qstore).toEqual({ "1,0": { animals: [2] } });
    expect(w.activeQ).toBe("0,0");
    expect(QUAD.store["0,0"]).toBeDefined(); // o original não muda
  });
});

describe("saveMeta", () => {
  it("dia, hora, heróis e ouro para a lista de espaços", () => {
    Object.assign(world, { heroes: [{ name: "Ana", lvl: 3 }, { name: "Bia" }], tick: CONFIG.DAY_MIN * 2 + 90 });
    const m = saveMeta();
    expect([m.day, m.time, m.gold, m.ver]).toEqual([3, "01:30", econ.gold, MV_VER]);
    expect(m.heroes).toEqual(["Ana Nv.3", "Bia Nv.1"]);
  });
});
