import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
  aparenciaRecrutavel,
  comporPele,
  sortearAparencia,
  tingir,
  type AparenciasDados,
} from "../../src/render/gl/aparencias.ts";
import { decodificarAnim } from "../../src/render/gl/esqueleto.ts";
import { ED } from "../../src/editor/estado.ts";

// v8.0: personagens novos sorteiam corpos padrão e cabeças; os dados vêm de
// tools/gerar-aparencias.ts (src/assets/models/aparencias.json).
const DADOS = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;

describe("aparências sorteadas", () => {
  it("sem dados (testes em Node sem o JSON embutido) é a heroína de sempre", () => {
    expect(sortearAparencia({})).toEqual({ corpo: "heroina", cabeca: "propria" });
  });

  it("v8.1: tingir troca só o que a máscara marca: o couro da cor da pele e o olho da cor do cabelo ficam", () => {
    // 4 triângulos: pele, couro (quase a cor da pele), cabelo, delineado (a cor do cabelo)
    const P = new Float32Array(Array.from({ length: 4 }, () => [0, 0, 0, 1, 0, 0, 0, 0, 1]).flat()),
      I = new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
      C = new Float32Array([200, 130, 100, 170, 110, 80, 50, 35, 30, 50, 35, 30].map((v) => v / 255));
    const A = { P, I, C } as unknown as Parameters<typeof tingir>[0];
    const B = tingir(A, [1, 0, 2, 0], "#5e3a26", "#d8b06a");
    const rgb = (t: number) => [0, 1, 2].map((e) => Math.round(B.C[t * 3 + e] * 255));
    expect(rgb(0)).toEqual([0x5e, 0x3a, 0x26]); // pele na luz da mediana dela
    expect(rgb(1)).toEqual([170, 110, 80]); // couro
    expect(rgb(2)).toEqual([0xd8, 0xb0, 0x6a]); // cabelo
    expect(rgb(3)).toEqual([50, 35, 30]); // delineado
    expect(tingir(A, [1, 0, 2, 0])).toBe(A); // sem cor nova: a mesma pele
    expect(tingir(A, [1, 0, 2], "#5e3a26")).toBe(A); // máscara de outra malha: não tinge
  });

  it("2026-11-06: a cor nova mantém a profundidade (sombra mais escura, rosado mais vermelho, mecha clara)", () => {
    // pele: meio, sombra, rosado; cabelo: meio, mecha clara
    const cores = [
      [200, 140, 110],
      [140, 90, 70],
      [210, 125, 110],
      [120, 80, 50],
      [170, 125, 80],
    ];
    const P = new Float32Array(cores.length * 9),
      I = Uint16Array.from({ length: cores.length * 3 }, (_, i) => i),
      C = new Float32Array(cores.flat().map((v) => v / 255));
    const A = { P, I, C } as unknown as Parameters<typeof tingir>[0];
    const B = tingir(A, [1, 1, 1, 2, 2], "#5e3a26", "#1f1a18");
    const rgb = (t: number) => [0, 1, 2].map((e) => B.C[t * 3 + e] * 255);
    const luz = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    expect(luz(rgb(1))).toBeLessThan(luz(rgb(0)) - 8); // a sombra continua sombra
    expect(rgb(2)[0] - rgb(2)[1]).toBeGreaterThan(rgb(0)[0] - rgb(0)[1] + 4); // o rosado continua mais vermelho
    expect(luz(rgb(4))).toBeGreaterThan(luz(rgb(3)) + 6); // a mecha clara aparece no cabelo preto
    expect(new Set([0, 1, 2].map((t) => rgb(t).map(Math.round).join())).size).toBe(3); // nada de pele chapada
  });

  it("v8.1: aplica pele e cabelo sobre textura sem apagar a pintura", () => {
    const A = {
      I: new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
      C: new Float32Array(9).fill(1),
      tex: "textura",
    } as unknown as Parameters<typeof tingir>[0];
    const B = tingir(A, [1, 2, 3], "#5e3a26", "#d8b06a", {
      pele: [245, 148, 87],
      cabelo: [235, 153, 90],
    });
    const rgb = (t: number) => Array.from(B.C.slice(t * 3, t * 3 + 3));
    [94 / 245, 58 / 148, 38 / 87].forEach((v, e) => expect(rgb(0)[e]).toBeCloseTo(v, 6));
    [216 / 235, 176 / 153, 106 / 90].forEach((v, e) => expect(rgb(1)[e]).toBeCloseTo(v, 6));
    [94 / 245, 58 / 148, 38 / 87].forEach((v, e) => expect(rgb(2)[e]).toBeCloseTo(v, 6)); // detalhe acompanha a pele
    expect(B.tex).toBe("textura");
  });

  it("v8.1: toda aparência tem máscara do tamanho da malha, com pele e cabelo, e os olhos de fora", () => {
    const b = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
    for (const corpo of DADOS.corpos!) {
      const A = decodificarAnim({ ...corpo.semCabeca, clips: {} });
      expect(b(corpo.mascara!).length).toBe(A.I.length / 3);
      expect(b(corpo.mascaraPropria!)).toContain(1);
    }
    for (const cab of DADOS.cabecas!) {
      const m = b(cab.mascara!),
        p = new Int16Array(b(cab.p).buffer),
        I = new Uint16Array(b(cab.i).buffer);
      expect(m.length).toBe(I.length / 3);
      expect(m).toContain(1);
      if (cab.nome !== "deusa_verao") expect(m).toContain(2); // o cabelo da deusa do verão fica (a coroa)
      // a faixa dos olhos, na frente do rosto: nunca cabelo
      for (let t = 0; t < m.length; t++) {
        const c = [0, 1, 2].map(
          (e) => (p[I[t * 3] * 3 + e] + p[I[t * 3 + 1] * 3 + e] + p[I[t * 3 + 2] * 3 + e]) / 3000,
        );
        if (c[1] > 0.6 && c[1] < 1.25 && Math.abs(c[0]) < 0.75 && c[2] > -0.5) expect(m[t]).not.toBe(2);
      }
    }
  });

  it("dá chances iguais a cada corpo e cabeça feminina, mesmo com pesos antigos e notas ruins", () => {
    const dados = {
      ...DADOS,
      corpos: DADOS.corpos!.map((c, i) => ({ ...c, peso: i === 2 ? 1000 : 0 })),
    };
    const corpos = dados.corpos.filter((c) => (c.sexo ?? "f") === "f" && !c.nome.startsWith("deusa_")),
      cabecas = ["propria", ...dados.cabecas!.filter((c) => (c.sexo ?? "f") === "f").map((c) => c.nome)];
    const anteriores = ED.dados.aparencias;
    ED.dados.aparencias = { [corpos[0].nome + "|propria"]: "ruim" };
    try {
      const contagem = new Map<string, number>();
      for (let i = 0; i < corpos.length; i++) {
        for (let j = 0; j < cabecas.length; j++) {
          const valores = [(i + 0.5) / corpos.length, (j + 0.5) / cabecas.length];
          const a = sortearAparencia(dados, () => valores.shift()!);
          expect(a).toEqual({ corpo: corpos[i].nome, cabeca: cabecas[j] });
          expect(aparenciaRecrutavel(a, dados)).toBe(true);
          contagem.set(a.corpo, (contagem.get(a.corpo) ?? 0) + 1);
        }
      }
      expect(contagem.size).toBe(corpos.length);
      for (const corpo of corpos) expect(contagem.get(corpo.nome)).toBe(cabecas.length);
    } finally {
      ED.dados.aparencias = anteriores;
    }
  });

  it("sorteia cabeças e corpos femininos, incluindo heroína e líder e sem corpo de deusa, sem dominar uma cabeça", () => {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const corpos = new Map<string, number>(),
      cabecas = new Map<string, number>();
    for (let i = 0; i < 30000; i++) {
      const a = sortearAparencia(DADOS, rnd);
      corpos.set(a.corpo, (corpos.get(a.corpo) ?? 0) + 1);
      cabecas.set(a.cabeca, (cabecas.get(a.cabeca) ?? 0) + 1);
    }
    expect([...corpos.keys()].sort()).toEqual(
      DADOS.corpos!.filter((c) => (c.sexo ?? "f") === "f" && !c.nome.startsWith("deusa_"))
        .map((c) => c.nome)
        .sort(),
    );
    expect([...corpos.keys()]).toContain("heroina");
    expect([...corpos.keys()]).toContain("lider");
    expect([...corpos.keys()].some((n) => n.startsWith("corpo_m"))).toBe(false);
    expect([...corpos.keys()].some((n) => n.startsWith("deusa_"))).toBe(false);
    expect(aparenciaRecrutavel({ corpo: "deusa_verao", cabeca: "propria" }, DADOS)).toBe(false);
    // Personagens recrutadas usam cabeças femininas; cabeças masculinas não entram no sorteio.
    expect(
      [...cabecas.keys()].some((n) => {
        const sexo = DADOS.cabecas!.find((c) => c.nome === n)?.sexo?.toLowerCase();
        return sexo === "m";
      }),
    ).toBe(false);
    expect([...cabecas.keys()].sort()).toEqual(
      ["propria", ...DADOS.cabecas!.filter((c) => (c.sexo ?? "f") === "f").map((c) => c.nome)].sort(),
    );
    for (const quantidade of cabecas.values()) expect(quantidade / 30000).toBeLessThan(0.05);
    expect(aparenciaRecrutavel({ corpo: "corpo_m06", cabeca: "propria" }, DADOS)).toBe(false);
    expect(aparenciaRecrutavel({ corpo: "heroina", cabeca: "homem_coque" }, DADOS)).toBe(false);
  });

  it("cada corpo feminino sorteável tem roupa inicial completa", () => {
    const modelos = (
      JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as {
        modelos: {
          nome: string;
          anim?: { juntas: string[]; malha: { p: string; j: string; w: string } };
          partes?: Record<string, unknown>;
        }[];
      }
    ).modelos;
    for (const corpo of DADOS.corpos!.filter((c) => /^corpo_f0[1-6]$/.test(c.nome))) {
      const roupa = modelos.find((v) => v.nome === `${corpo.nome}__aventureira`);
      expect(roupa?.anim, `${corpo.nome} precisa usar a malha completa vestida`).toBeTruthy();
      expect(roupa?.partes, `${corpo.nome} precisa de uma roupa inicial`).toBeTruthy();
      expect(Object.keys(roupa!.partes!).sort()).toEqual(["peito", "pernas", "pes"]);

      const p = Buffer.from(roupa!.anim!.malha.p, "base64"),
        j = Buffer.from(roupa!.anim!.malha.j, "base64"),
        w = Buffer.from(roupa!.anim!.malha.w, "base64"),
        vista = new DataView(p.buffer, p.byteOffset, p.byteLength),
        nv = p.length / 6;
      let y0 = Infinity,
        y1 = -Infinity;
      for (let v = 0; v < nv; v++) {
        const y = vista.getInt16(v * 6 + 2, true) / 64;
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      let verticesDoBusto = 0;
      for (let v = 0; v < nv; v++) {
        const x = vista.getInt16(v * 6, true) / 64,
          y = vista.getInt16(v * 6 + 2, true) / 64,
          z = vista.getInt16(v * 6 + 4, true) / 64,
          t = (y - y0) / (y1 - y0);
        // O centro do peito fica estável; a clavícula e a transição lateral precisam acompanhar o ombro.
        if (x < (y1 - y0) * 0.045 || t < 0.64 || t > 0.73 || Math.abs(z) > (y1 - y0) * 0.065) continue;
        verticesDoBusto++;
        for (let k = 0; k < 4; k++) {
          const junta = roupa!.anim!.juntas[j[v * 4 + k]];
          if (/^(Left|Right)(Arm|ForeArm|Hand)$/.test(junta)) expect(w[v * 4 + k]).toBe(0);
        }
      }
      expect(verticesDoBusto).toBeGreaterThan(0);
    }
  });

  it("monta corpo sem cabeça + cabeça presa à junta Head, com a cabeça acima do pescoço", () => {
    for (const corpo of DADOS.corpos!) {
      const A = decodificarAnim({ ...corpo.semCabeca, clips: {} }),
        head = A.juntas.indexOf("Head");
      for (const cab of DADOS.cabecas!) {
        const M = comporPele(A, cab, corpo.encaixe),
          nv = M.P.length / 3;
        expect(M.I.length / 3).toBe(M.C.length / 3);
        expect(Math.max(...M.I)).toBeLessThan(nv);
        expect(M.ini[nv]).toBe(M.I.length);
        // os vértices novos vão com a cabeça; v8.1 — abaixo do queixo o pescoço divide o peso com a junta Neck (dobra
        // junto com o corpo). O rosto (do queixo para cima) fica acima do queixo do corpo, no tamanho padrão (uTroca)
        const nvC = A.P.length / 3,
          neck = A.juntas.indexOf("Neck");
        let topo = -Infinity;
        for (let v = nvC; v < nv; v++) {
          assert.equal(M.J[v * 4], head);
          assert.ok(Math.abs(M.W[v * 4] + M.W[v * 4 + 1] - 1) < 0.000005);
          if (M.W[v * 4] < 1) assert.equal(M.J[v * 4 + 1], neck);
          if (M.P[v * 3 + 1] > corpo.encaixe.queixo + 0.01) assert.equal(M.W[v * 4], 1);
          topo = Math.max(topo, M.P[v * 3 + 1]);
        }
        expect(topo).toBeGreaterThan(corpo.encaixe.queixo + 2 * (corpo.encaixe.uTroca ?? corpo.encaixe.u));
      }
    }
  });
});
