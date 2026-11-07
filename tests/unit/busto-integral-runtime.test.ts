import { describe, expect, it, vi } from "vitest";
import { cabecaDaAparencia, peleDaAparencia, type AparenciasDados } from "../../src/render/gl/aparencias.ts";
import { roupaDaAparencia } from "../../src/render/gl/vestidos.ts";
import { decodificarAnim, type DadosAnim } from "../../src/render/gl/esqueleto.ts";

const b64 = (v: Uint8Array | Uint16Array | Int16Array) =>
  Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
const base = (): DadosAnim => ({
  versao: 1,
  juntas: ["Head"],
  pais: [-1],
  repouso: [[0, 0, 0]],
  raiz: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  ibm: [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]],
  malha: {
    p: b64(
      Int16Array.from(Array.from({ length: 6 }, (_, t) => [t * 128, 0, 0, t * 128 + 64, 0, 0, t * 128, 64, 0]).flat()),
    ),
    i: b64(Uint16Array.from({ length: 18 }, (_, i) => i)),
    j: b64(new Uint8Array(72)),
    w: b64(Uint8Array.from({ length: 72 }, (_, i) => (i % 4 === 0 ? 255 : 0))),
    c: b64(Uint8Array.from([200, 130, 100, 255, 255, 255, 255, 255, 255, 255, 255, 255, 200, 130, 100, 80, 40, 30])),
    uv: b64(new Uint16Array(36)),
  },
  clips: {},
  texDe: "busto",
});
function fonte() {
  const anim = base();
  const integral = {
    corpo: "corpo_f02",
    cabeca: "busto_02",
    anim,
    mascara: b64(Uint8Array.from([1, 1, 2, 0, 1, 0])),
    regiaoPele: b64(Uint8Array.from([0, 1, 1, 1, 2, 0])),
    refPele: [220, 140, 100],
    refPeleInferior: [200, 130, 100],
    refCabelo: [80, 40, 20],
  };
  const aparencias = { corpos: [{ nome: "corpo_f02", cabecaPadrao: "busto_02" }] } as AparenciasDados;
  return {
    anim,
    integral,
    fontes: { aparencias, bustos: { combinacoes: [integral], texturas: { busto: "data:image/webp;base64,dGVzdGU=" } } },
  };
}

describe("busto integral por combinação", () => {
  it("usa a malha e o rig preparados antes de buscar a cabeça própria ou montar outro recorte", () => {
    const { anim, fontes } = fonte(),
      propria = vi.fn(() => null);
    const pele = peleDaAparencia({ corpo: "corpo_f02", cabeca: "propria" }, propria, fontes);
    expect(pele).toMatchObject({ malha: anim.malha, ibm: anim.ibm, tex: fontes.bustos.texturas.busto });
    expect(propria).not.toHaveBeenCalled();
    expect(anim.tex).toBeUndefined();
    expect(cabecaDaAparencia({ corpo: "corpo_f02", cabeca: "propria" }, fontes.aparencias)).toBe("busto_02");
  });

  it("tinge pele inferior, busto e cabelo com referências próprias e preserva olhos e roupa", () => {
    const { anim, fontes } = fonte();
    const pele = peleDaAparencia(
      { corpo: "corpo_f02", cabeca: "busto_02", pele: "#5e3a26", cabelo: "#d8b06a" },
      () => null,
      fontes,
    );
    if (!pele || !("I" in pele)) throw Error("O candidato deveria estar decodificado para tingir");
    const rgb = (t: number) => Array.from(pele.C.slice(t * 3, t * 3 + 3));
    // a pele sem textura passa por CIELAB (ida e volta): 4 casas
    [94 / 255, 58 / 255, 38 / 255].forEach((c, e) => expect(rgb(0)[e]).toBeCloseTo(c, 4));
    [94 / 220, 58 / 140, 38 / 100].forEach((c, e) => expect(rgb(1)[e]).toBeCloseTo(c, 5));
    [216 / 80, 176 / 40, 106 / 20].forEach((c, e) => expect(rgb(2)[e]).toBeCloseTo(Math.min(4, c), 5));
    expect(rgb(3)).toEqual([1, 1, 1]); // olhos na textura preservados
    [94 / 255, 58 / 255, 38 / 255].forEach((c, e) => expect(rgb(4)[e]).toBeCloseTo(c, 4)); // união
    expect(rgb(5)).toEqual(Array.from(decodificarAnim(anim).C.slice(15, 18)));
    expect(pele.P).toEqual(decodificarAnim(anim).P);
    expect(pele.W).toEqual(decodificarAnim(anim).W);
    expect(pele.ibm).toEqual(decodificarAnim(anim).ibm);
    expect(decodificarAnim(anim).C[0]).toBeCloseTo(200 / 255, 6);
  });

  it("sem combinação publicada conserva a busca da aparência anterior", () => {
    const { fontes } = fonte(),
      propria = vi.fn(() => base());
    const outro = peleDaAparencia({ corpo: "lider", cabeca: "propria" }, propria, fontes);
    expect(outro).toBe(propria.mock.results[0].value);
    expect(propria).toHaveBeenCalledExactlyOnceWith("lider");
    expect(peleDaAparencia({ corpo: "heroina", cabeca: "propria" }, propria, fontes)).toBeNull();
  });

  it("peças por combinação têm prioridade e outro cabelo mantém o conjunto de referência", () => {
    const anim = base(),
      personalizada = {
        nome: "corpo_f02__busto_02__aventureira",
        rotulo: "ajustada",
        interno: true,
        partes: { peito: anim },
      },
      anterior = { nome: "corpo_f02__aventureira", rotulo: "referência", partes: { peito: anim } };
    const obter = (nome: string) => [personalizada, anterior].find((v) => v.nome === nome) ?? null;
    expect(roupaDaAparencia({ corpo: "corpo_f02", cabeca: "busto_02" }, "aventureira", obter)).toBe(personalizada);
    expect(roupaDaAparencia({ corpo: "corpo_f02", cabeca: "busto_07" }, "aventureira", obter)).toBe(anterior);
    expect(roupaDaAparencia({ corpo: "deusa_outono", cabeca: "propria" }, "aventureira", obter)).toBeNull();
  });
});
