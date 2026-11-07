import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { comporPele, type AparenciasDados, type CabecaDados } from "../../src/render/gl/aparencias.ts";
import { decodificarAnim } from "../../src/render/gl/esqueleto.ts";

const dados = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
const corpo = dados.corpos!.find((c) => c.nome === "corpo_f02")!;
const anim = decodificarAnim({ ...corpo.semCabeca, clips: {} });
const b64 = (v: ArrayBufferView) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64");
const bytes = (v: string) => Uint8Array.from(Buffer.from(v, "base64"));

function cabeca(cabeloParaTras: number): CabecaDados {
  return {
    nome: "teste",
    rotulo: "Teste do pescoço",
    peso: 1,
    p: b64(
      new Int16Array([
        -300,
        -400,
        -500,
        300,
        -400,
        -500,
        0,
        -900,
        -700,
        -200,
        -600,
        cabeloParaTras,
        200,
        -600,
        cabeloParaTras,
        0,
        -1100,
        cabeloParaTras - 300,
      ]),
    ),
    i: b64(new Uint16Array([0, 1, 2, 3, 4, 5])),
    c: b64(new Uint8Array([200, 150, 120, 60, 30, 20])),
    mascara: b64(new Uint8Array([1, 2])),
  };
}

describe("encaixe do pescoço separado do cabelo", () => {
  it("ajusta a proporção individual sem reduzir o rosto ou alterar o corpo e os pesos", () => {
    for (const nome of ["busto_13", "busto_14", "busto_15"]) {
      const cab = dados.cabecas!.find((c) => c.nome === nome)!;
      expect(cab.escala).toBeLessThan(1);
      const antes = comporPele(anim, { ...cab, escala: 1 }, corpo.encaixe);
      const depois = comporPele(anim, cab, corpo.encaixe);
      expect(depois.I).toEqual(antes.I);
      expect(depois.J).toEqual(antes.J);
      expect(depois.W).toEqual(antes.W);
      expect(depois.P.subarray(0, anim.P.length)).toEqual(anim.P);
      expect(depois.C).toEqual(antes.C);
      for (let k = anim.P.length + 1; k < depois.P.length; k += 3)
        expect(depois.P[k] - corpo.encaixe.queixo).toBeCloseTo((antes.P[k] - corpo.encaixe.queixo) * cab.escala!, 4);
    }
  });
  it("mudar o comprimento e o volume traseiro do cabelo não desloca a pele do pescoço", () => {
    const a = comporPele(anim, cabeca(-1500), corpo.encaixe);
    const b = comporPele(anim, cabeca(-7000), corpo.encaixe);
    const inicio = anim.P.length;
    expect(corpo.encaixe.uTroca).not.toBe(corpo.encaixe.u);
    expect(Array.from(a.P.subarray(inicio, inicio + 9))).toEqual(Array.from(b.P.subarray(inicio, inicio + 9)));
    expect(Array.from(a.P.subarray(0, inicio))).toEqual(Array.from(anim.P));
  });

  it("cabelo abaixo do queixo fica preso à cabeça e não é alargado como o pescoço", () => {
    const m = comporPele(anim, cabeca(-1500), corpo.encaixe);
    const nv = anim.P.length / 3,
      head = anim.juntas.indexOf("Head"),
      neck = anim.juntas.indexOf("Neck");
    for (let v = nv + 3; v < nv + 6; v++) {
      expect(m.J[v * 4]).toBe(head);
      expect(m.W[v * 4]).toBe(1);
      expect(m.W[v * 4 + 1]).toBe(0);
    }
    // Dois vértices de cabelo separados por 0,4 unidade mantêm a escala da cabeça.
    expect(Math.abs(m.P[(nv + 3) * 3 + 2] - m.P[(nv + 4) * 3 + 2])).toBeCloseTo(0.4 * corpo.encaixe.uTroca!, 5);
    // A pele abaixo do queixo continua acompanhando Neck.
    expect(m.J[nv * 4 + 1]).toBe(neck);
    expect(m.W[nv * 4 + 1]).toBeGreaterThan(0);
  });

  it("todas as cabeças reais preservam os fios sem pele fora da influência Neck", () => {
    const head = anim.juntas.indexOf("Head"),
      nv = anim.P.length / 3;
    let cabeloAbaixoDoQueixo = 0;
    for (const cab of dados.cabecas!) {
      const hp = new Int16Array(bytes(cab.p).buffer),
        hi = new Uint16Array(bytes(cab.i).buffer);
      const mask = bytes(cab.mascara!);
      const partes = new Uint8Array(hp.length / 3);
      for (let t = 0; t < hi.length / 3; t++) {
        for (let k = 0; k < 3; k++) {
          if (mask[t] === 1) partes[hi[t * 3 + k]] |= 1;
          if (mask[t] === 2) partes[hi[t * 3 + k]] |= 2;
        }
      }
      const m = comporPele(anim, cab, corpo.encaixe);
      for (let v = 0; v < partes.length; v++) {
        if (partes[v] !== 2 || hp[v * 3 + 1] >= 0) continue;
        cabeloAbaixoDoQueixo++;
        expect(m.J[(nv + v) * 4], cab.nome).toBe(head);
        expect(m.W[(nv + v) * 4], cab.nome).toBe(1);
        expect(m.W[(nv + v) * 4 + 1], cab.nome).toBe(0);
      }
    }
    expect(cabeloAbaixoDoQueixo).toBeGreaterThan(100);
  });
});
