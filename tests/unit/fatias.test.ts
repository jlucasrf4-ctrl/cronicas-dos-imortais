// Fatiador de folhas de sprites (tools/lib/fatias.ts, tools/lib/fatiar.ts): morfologia, rótulos, linhas, alfa e o
// fluxo inteiro com sharp numa folha sintética gravada numa pasta temporária.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import {
  abrir,
  alfaFundo,
  caixaAlfa,
  desfocar,
  dilatar,
  emLinhas,
  erodir,
  fechar,
  limiar,
  limparAlfa,
  minimo,
  pecas,
  preencherBuracos,
  quadrar,
  recortar,
  rotular,
  type Caixa,
  type Imagem,
  type Mascara,
} from "../../tools/lib/fatias.ts";
import { fatiarFolha, lerRGBA, planejarFolha, type Plano } from "../../tools/lib/fatiar.ts";

/** Máscara a partir de linhas de texto ("#" = ligado). */
function M(...linhas: string[]): Mascara {
  const w = linhas[0].length;
  const d = new Uint8Array(w * linhas.length);
  linhas.forEach((l, y) => [...l].forEach((c, x) => (d[y * w + x] = c === "#" ? 1 : 0)));
  return { w, h: linhas.length, d };
}
const texto = (m: Mascara) =>
  Array.from({ length: m.h }, (_, y) => [...m.d.subarray(y * m.w, (y + 1) * m.w)].map((v) => (v ? "#" : ".")).join(""));

/** Imagem RGBA preta com retângulos coloridos (ou escuros). */
function imagem(w: number, h: number, rets: [Caixa, [number, number, number]][]): Imagem {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) d[i * 4 + 3] = 255;
  for (const [[x0, y0, x1, y1], cor] of rets)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d.set(cor, (y * w + x) * 4);
  return { w, h, canais: 4, d };
}

describe("máscaras e morfologia", () => {
  it("limiar usa o máximo de R, G, B", () => {
    const img = imagem(3, 1, [
      [
        [0, 0, 1, 1],
        [70, 0, 0],
      ],
      [
        [1, 0, 2, 1],
        [0, 0, 50],
      ],
    ]);
    expect(texto(limiar(img, 60))).toEqual(["#.."]);
    expect(texto(limiar(img, 60, false))).toEqual([".##"]);
  });

  it("recortar limita a caixa à imagem", () => {
    const img = imagem(4, 4, [
      [
        [1, 1, 2, 2],
        [9, 9, 9],
      ],
    ]);
    const r = recortar(img, [-2, -2, 2, 2]);
    expect([r.w, r.h]).toEqual([2, 2]);
    expect(r.d[(1 * 2 + 1) * 4]).toBe(9);
  });

  it("dilata e erode com a cruz e com o retângulo", () => {
    const p = M(".....", ".....", "..#..", ".....", ".....");
    expect(texto(dilatar(p, { forma: "cruz", vezes: 1 }))).toEqual([".....", "..#..", ".###.", "..#..", "....."]);
    expect(texto(dilatar(p, { forma: "cruz", vezes: 2 }))).toEqual(["..#..", ".###.", "#####", ".###.", "..#.."]);
    expect(texto(dilatar(p, { forma: "ret", larg: 3, alt: 1 }))).toEqual([".....", ".....", ".###.", ".....", "....."]);
    const q = M("#####", "#####", "#####");
    expect(texto(erodir(q, { forma: "ret", larg: 3, alt: 3 }))).toEqual(texto(q)); // fora da imagem é ignorado
    expect(texto(erodir(M("###", "#.#", "###"), { forma: "cruz", vezes: 1 }))).toEqual(["#.#", "...", "#.#"]);
  });

  it("um retângulo par fecha e abre sem deslocar", () => {
    const m = M("##..##", "##..##");
    expect(texto(fechar(m, { forma: "ret", larg: 2, alt: 1 }))).toEqual(texto(m));
    expect(texto(fechar(m, { forma: "ret", larg: 4, alt: 1 }))).toEqual(["######", "######"]);
    expect(texto(abrir(m, { forma: "ret", larg: 2, alt: 2 }))).toEqual(texto(m));
  });

  it("fechar junta frestas e nunca apaga (é extensivo, mesmo na borda)", () => {
    const m = M("##.##", "##.##", "##.##");
    expect(texto(fechar(m, { forma: "cruz", vezes: 1 }))).toEqual(["#####", "#####", "#####"]);
    const borda = M("#....", "#....");
    expect(texto(fechar(borda, { forma: "cruz", vezes: 2 }))).toEqual(texto(borda));
  });

  it("abrir apaga pontos menores que o elemento (exceto encostados na borda)", () => {
    const m = M(".#....", "..###.", "..###.", "..###.", "......");
    expect(texto(abrir(m, { forma: "ret", larg: 2, alt: 2 }))).toEqual([
      "......",
      "..###.",
      "..###.",
      "..###.",
      "......",
    ]);
    expect(texto(abrir(M("#..", "...", "..."), { forma: "ret", larg: 2, alt: 2 }))).toEqual(["#..", "...", "..."]);
  });

  it("preencherBuracos liga o que não alcança a borda (vizinhança 4)", () => {
    expect(texto(preencherBuracos(M("#####", "#...#", "#.#.#", "#####")))).toEqual([
      "#####",
      "#####",
      "#####",
      "#####",
    ]);
    expect(texto(preencherBuracos(M("##.##", "#...#", "#####")))).toEqual(["##.##", "#...#", "#####"]);
    // uma diagonal não deixa o desligado escapar
    expect(texto(preencherBuracos(M(".#.", "#.#", ".#.")))).toEqual([".#.", "###", ".#."]);
  });
});

describe("componentes e linhas", () => {
  it("rotula na ordem de leitura, com caixas e áreas", () => {
    const R = rotular(M("##..#", "#...#", "...##"));
    expect(R.n).toBe(2);
    expect(R.caixas).toEqual([
      [0, 0, 2, 2],
      [3, 0, 5, 3],
    ]);
    expect(R.areas).toEqual([3, 4]);
    expect(R.rot[0]).toBe(1);
    expect(R.rot[4]).toBe(2);
  });

  it("vizinhança 4 separa diagonais; 8 junta", () => {
    const m = M("#.", ".#");
    expect(rotular(m).n).toBe(2);
    expect(rotular(m, true).n).toBe(1);
  });

  it("pecas filtra (exclusivo) e desloca", () => {
    const m = M("###.#", "###..", "###..");
    expect(pecas(m, { areaMin: 1 }, 10, 20)).toEqual([[10, 20, 13, 23]]);
    expect(pecas(m, { ladoMin: 2 })).toEqual([[0, 0, 3, 3]]);
    expect(pecas(m, { ladoMin: 3 })).toEqual([]);
    expect(pecas(m, { ladoMax: 3 })).toEqual([[4, 0, 5, 1]]);
    expect(pecas(m, { largMin: 2, altMin: 0 })).toEqual([[0, 0, 3, 3]]);
  });

  it("emLinhas agrupa pelo centro vertical e ordena por x", () => {
    const cs: Caixa[] = [
      [50, 100, 60, 120],
      [0, 0, 10, 20],
      [30, 5, 40, 25],
      [10, 98, 20, 118],
    ];
    expect(emLinhas(cs, 45)).toEqual([
      [
        [0, 0, 10, 20],
        [30, 5, 40, 25],
      ],
      [
        [10, 98, 20, 118],
        [50, 100, 60, 120],
      ],
    ]);
    expect(emLinhas(cs, 200)).toHaveLength(1);
    // compara com a média dos centros da linha, não com o último: 0, 40 juntos (média 20); 80 fica a 60 → nova linha
    const escada: Caixa[] = [0, 40, 80].map((c) => [c, c - 5, c + 5, c + 5]);
    expect(emLinhas(escada, 45).map((l) => l.length)).toEqual([2, 1]);
    expect(emLinhas([])).toEqual([]);
  });
});

describe("alfa", () => {
  it("minimo é o grey_erosion k×k", () => {
    const a = Uint8Array.from([255, 255, 255, 255, 0, 255, 255, 255, 255]);
    expect([...minimo(a, 3, 3, 3)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...minimo(a, 3, 3, 1)]).toEqual([...a]);
    expect([...minimo(a, 3, 3, 2)]).toEqual([255, 255, 255, 255, 0, 0, 255, 0, 0]);
  });

  it("desfocar conserva o constante e suaviza um degrau", () => {
    expect([...desfocar(new Uint8Array(9).fill(200), 3, 3, 0.8)]).toEqual(new Array(9).fill(200));
    const d = desfocar(Uint8Array.from([0, 0, 255, 255]), 4, 1, 0.8);
    expect(d[1]).toBeGreaterThan(0);
    expect(d[2]).toBeLessThan(255);
  });

  it("alfaFundo tira o escuro ligado à borda e mantém o buraco escuro cercado", () => {
    // 9×9: fundo preto, anel claro de 5×5 em (2,2), centro preto
    const img = imagem(9, 9, [
      [
        [2, 2, 7, 7],
        [200, 100, 50],
      ],
      [
        [4, 4, 5, 5],
        [0, 0, 0],
      ],
    ]);
    const a = alfaFundo(img, 48, { erosao: 1 });
    const em = (x: number, y: number) => a[y * 9 + x];
    expect(em(0, 0)).toBe(0);
    expect(em(2, 2)).toBe(255);
    expect(em(4, 4)).toBe(255);
    expect(alfaFundo(img, 48, { erosao: 1, centro: true })[4 * 9 + 4]).toBe(0);
    // a erosão padrão (2×2) come uma faixa de 1 px na borda da peça
    const e = alfaFundo(img, 48);
    expect(e[2 * 9 + 2]).toBe(0);
    expect(e[3 * 9 + 3]).toBe(255);
  });

  it("limparAlfa apaga grupos pequenos", () => {
    const img = imagem(10, 4, [
      [
        [0, 0, 4, 4],
        [1, 1, 1],
      ],
    ]);
    for (let i = 0; i < 40; i++) img.d[i * 4 + 3] = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) img.d[(y * 10 + x) * 4 + 3] = 255;
    img.d[(1 * 10 + 8) * 4 + 3] = 255; // um pixel solto longe
    expect(limparAlfa(img, 0.12)).toBe(1);
    expect(img.d[(1 * 10 + 8) * 4 + 3]).toBe(0);
    expect(img.d[3]).toBe(255);
    expect(limparAlfa(img, 0.12)).toBe(0);
    // 2 px ≥ 12% de 16 (1,92): fica
    img.d[(2 * 10 + 8) * 4 + 3] = img.d[(2 * 10 + 9) * 4 + 3] = 255;
    expect(limparAlfa(img, 0.12)).toBe(0);
    expect(img.d[(2 * 10 + 9) * 4 + 3]).toBe(255);
  });

  it("caixaAlfa e quadrar", () => {
    const img = imagem(4, 3, []);
    for (let i = 0; i < 12; i++) img.d[i * 4 + 3] = 0;
    expect(caixaAlfa(img)).toBeNull();
    img.d[(1 * 4 + 2) * 4 + 3] = 255;
    expect(caixaAlfa(img)).toEqual([2, 1, 3, 2]);
    const q = quadrar(recortar(img, [0, 0, 4, 2]), 1);
    expect([q.w, q.h]).toEqual([6, 6]);
    expect(q.d[(3 * 6 + 3) * 4 + 3]).toBe(255); // (2,1) → (2+1, 1+2)
  });
});

describe("fatiar uma folha (sharp)", () => {
  const pasta = mkdtempSync(join(tmpdir(), "fatias-"));
  afterAll(() => rmSync(pasta, { recursive: true, force: true }));

  // 200×140 preta: duas linhas de duas peças, uma com buraco escuro no meio, e um cisco que o filtro descarta
  const folha = imagem(200, 140, [
    [
      [10, 10, 50, 50],
      [220, 60, 60],
    ],
    [
      [110, 15, 160, 55],
      [60, 220, 60],
    ],
    [
      [25, 25, 35, 35],
      [0, 0, 0],
    ],
    [
      [20, 80, 60, 130],
      [60, 60, 220],
    ],
    [
      [120, 85, 180, 125],
      [220, 220, 60],
    ],
    [
      [90, 70, 93, 73],
      [255, 255, 255],
    ],
  ]);
  const gravar = async (nome: string, img: Imagem) =>
    writeFileSync(
      join(pasta, nome),
      await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
        .png()
        .toBuffer(),
    );

  it("componentes: nomes por linha, numerados, quadrados e com fundo transparente", async () => {
    await gravar("folha.png", folha);
    const plano: Plano = {
      origem: pasta,
      saida: join(pasta, "saida"),
      folhas: [
        { arquivo: "folha.png", modo: "componentes", areaMin: 100, ladoMin: 10, nomes: ["a", "b"], quadrado: 32 },
      ],
    };
    const r = await fatiarFolha(plano, plano.folhas[0]);
    expect(r.porLinha).toEqual([2, 2]);
    expect(r.fatias.map((f) => f.nome)).toEqual(["a_1", "a_2", "b_1", "b_2"]);
    expect(r.contagens).toEqual({ a: 2, b: 2 });
    expect(r.fatias[0].caixa).toEqual([10, 10, 50, 50]); // o buraco foi preenchido na máscara
    const a1 = await lerRGBA(join(plano.saida, "a_1.webp"));
    expect([a1.w, a1.h]).toEqual([32, 32]);
    expect(a1.d[3]).toBeLessThan(10); // canto: fundo
    expect(a1.d[(16 * 32 + 16) * 4 + 3]).toBeGreaterThan(245); // buraco cercado continua opaco
    expect(a1.d[(10 * 32 + 10) * 4]).toBeGreaterThan(150); // vermelho
    expect(existsSync(join(plano.saida, "previa_folha.png"))).toBe(true);
    const sim = await fatiarFolha({ ...plano, saida: join(pasta, "nada") }, plano.folhas[0], true);
    expect(sim.fatias).toHaveLength(4);
    expect(existsSync(join(pasta, "nada"))).toBe(false);
  });

  it("componentes: prefixo, caixa, xMin e altura", async () => {
    const img = await lerRGBA(join(pasta, "folha.png"));
    const p = planejarFolha(img, { arquivo: "f.png", modo: "componentes", areaMin: 100, ladoMin: 10, xMin: 100 });
    expect(p.fatias.map((f) => f.nome)).toEqual(["f_r1_1", "f_r2_1"]);
    const q = planejarFolha(img, {
      arquivo: "f.png",
      modo: "componentes",
      areaMin: 100,
      ladoMin: 10,
      caixa: [0, 60, 200, 140],
    });
    expect(q.fatias.map((f) => f.caixa)).toEqual([
      [20, 80, 60, 130],
      [120, 85, 180, 125],
    ]);
    const plano: Plano = {
      origem: pasta,
      saida: join(pasta, "alt"),
      folhas: [
        { arquivo: "folha.png", modo: "componentes", areaMin: 100, ladoMin: 10, prefixo: "x", altura: 20, margem: 0 },
      ],
    };
    await fatiarFolha(plano, plano.folhas[0]);
    const b = await lerRGBA(join(plano.saida, "x_r2_2.webp")); // 60×40 → 30×20
    expect([b.w, b.h]).toEqual([30, 20]);
  });

  it("grade: uma célula por nome, null pula, aparo pelo alfa", async () => {
    await gravar(
      "grade.png",
      imagem(100, 100, [
        [
          [10, 10, 30, 40],
          [200, 50, 50],
        ],
        [
          [60, 5, 95, 45],
          [50, 200, 50],
        ],
        [
          [60, 60, 90, 90],
          [50, 50, 200],
        ],
      ]),
    );
    const plano: Plano = {
      origem: pasta,
      saida: join(pasta, "grade"),
      folhas: [
        {
          arquivo: "grade.png",
          modo: "grade",
          colunas: 2,
          linhas: 2,
          nomes: ["um", "dois", null, "tres"],
          fundo: 22,
          aparar: 0,
          quadrado: 16,
        },
      ],
    };
    const r = await fatiarFolha(plano, plano.folhas[0]);
    expect(r.fatias.map((f) => [f.nome, ...f.caixa])).toEqual([
      ["um", 0, 0, 50, 50],
      ["dois", 50, 0, 100, 50],
      ["tres", 50, 50, 100, 100],
    ]);
    const um = await lerRGBA(join(plano.saida, "um.webp"));
    // 20×30 aparado e centralizado num quadrado 30×30: as colunas da beira ficam transparentes, o meio opaco
    expect(um.d[(8 * 16 + 0) * 4 + 3]).toBeLessThan(10);
    expect(um.d[(8 * 16 + 8) * 4 + 3]).toBeGreaterThan(245);
    expect(() => planejarFolha(um, { arquivo: "g", modo: "grade", colunas: 1, linhas: 1, nomes: ["a", "b"] })).toThrow(
      /fora da grade/,
    );
  });
});
