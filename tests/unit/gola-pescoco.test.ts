/* 2026-11-07 — o pescoço das cabeças trocadas (render/gl/gola.ts, render/gl/aparencias.ts): a cabeça centrada no
   pescoço e nos ombros, os buracos laterais do recorte fechados com pele, a gola cobrindo o vão, e o triângulo de cabelo
   com cor de pele na textura (tools/lib/uv-cabelo.ts). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ajustarBustoIntegral,
  bustoIntegral,
  comporPele,
  peleDaAparencia,
  cabeNoCorpo,
  cabecaNoJogo,
  type AparenciasDados,
} from "../../src/render/gl/aparencias.ts";
import {
  decodificarAnim,
  matrizesPose,
  novaPose,
  poseClip,
  type Anim,
  type DadosAnim,
} from "../../src/render/gl/esqueleto.ts";
import { extrasDoPescoco, juntaNoBind, restosDeCabeloNoPescoco } from "../../src/render/gl/gola.ts";
import { GOLA, INTEGRAIS_FORA } from "../../src/data/aparencias.ts";
import { roupaDaAparencia } from "../../src/render/gl/vestidos.ts";
import { corrigirUvCabelo } from "../../tools/lib/uv-cabelo.ts";

const dados = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
const bustos = JSON.parse(readFileSync("src/assets/models/bustos-integrais.json", "utf8"));
const fontes = { aparencias: dados, bustos };
const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
const corpoDe = (nome: string) => dados.corpos!.find((c) => c.nome === nome)!;
const cabecaDe = (nome: string) => dados.cabecas!.find((c) => c.nome === nome)!;
const montar = (corpo: string, cabeca: string) => {
  const p = peleDaAparencia({ corpo, cabeca }, () => null, fontes);
  if (!p) throw Error("sem pele");
  return "ini" in p ? p : decodificarAnim(p as DadosAnim);
};
const sorteaveis = dados.corpos!.filter((c) => (c.sexo ?? "f") === "f" && !c.nome.startsWith("deusa_"));

/** o nariz de verdade da cabeça trocada: a pele (máscara 1/3, sem tocar cabelo) mais à frente entre a boca e os olhos,
 *  sem janela de lado (a F16 tem o rosto longe do x = 0 dela) */
function narizDaPele(A: Anim, nvC: number, mascara: Uint8Array, q: number, u: number) {
  const ntC = A.I.length / 3 - mascara.length,
    parte = new Uint8Array(A.P.length / 3);
  for (let t = 0; t < mascara.length; t++)
    for (let k = 0; k < 3; k++)
      parte[A.I[(ntC + t) * 3 + k]] |= mascara[t] === 2 ? 2 : mascara[t] === 1 || mascara[t] === 3 ? 1 : 0;
  let x = -Infinity,
    z = 0;
  for (let v = nvC; v < A.P.length / 3; v++) {
    const y = A.P[v * 3 + 1];
    if (parte[v] !== 1 || y < q + 0.15 * u || y > q + 1.0 * u || A.P[v * 3] <= x) continue;
    x = A.P[v * 3];
    z = A.P[v * 3 + 2];
  }
  return z;
}

describe("cabeça trocada centrada no pescoço e nos ombros", () => {
  it("o nariz fica na linha do meio do esqueleto em todos os corpos sorteáveis", () => {
    for (const c of sorteaveis) {
      const corpo = decodificarAnim({ ...c.semCabeca, clips: {} }),
        meio = juntaNoBind(corpo, "Neck")![2],
        u = c.encaixe.uTroca ?? c.encaixe.u;
      for (const nome of ["busto_05", "busto_10", "busto_13", "busto_15", "busto_16", "loira_trancas"]) {
        const M = comporPele(corpo, cabecaDe(nome), c.encaixe),
          z = narizDaPele(M, corpo.P.length / 3, bytes(cabecaDe(nome).mascara!), c.encaixe.queixo, u);
        // antes ia no "meio" do rosto original do corpo: até 0,57 u para o lado (F03); a F16 ficava ~1 u ("manca")
        expect(Math.abs(z - meio) / u, `${c.nome}|${nome}`).toBeLessThan(0.08);
      }
    }
  });

  it("frente/trás anda pouco e o corpo não muda", () => {
    const c = corpoDe("corpo_f02"),
      corpo = decodificarAnim({ ...c.semCabeca, clips: {} });
    for (const nome of ["busto_05", "busto_16", "deusa_inverno"]) {
      const M = comporPele(corpo, cabecaDe(nome), c.encaixe);
      expect(Array.from(M.P.subarray(0, corpo.P.length))).toEqual(Array.from(corpo.P));
    }
  });

  it("o busto integral encolhe a cabeça em volta da linha do meio (o rosto não escorrega para o lado do cabelo)", () => {
    const c = corpoDe("corpo_f02"),
      integral = bustos.combinacoes.find(
        (b: { corpo: string; cabeca: string }) => b.corpo === "corpo_f02" && b.cabeca === "busto_16",
      ),
      A = decodificarAnim(integral.anim),
      meio = juntaNoBind(A, "Neck")![2],
      B = ajustarBustoIntegral(A, { baixar: 0.3, escala: 0.6 }, c.encaixe);
    // todo vértice da cabeça só se aproxima da linha do meio (antes encolhia em volta da média, puxada pelo cabelo)
    let mexidos = 0;
    for (let v = 0; v < A.P.length / 3; v++) {
      if (A.P[v * 3 + 1] < c.encaixe.queixo) continue;
      expect(Math.abs(B.P[v * 3 + 2] - meio)).toBeLessThanOrEqual(Math.abs(A.P[v * 3 + 2] - meio) + 1e-4);
      mexidos++;
    }
    expect(mexidos).toBeGreaterThan(100);
  });

  it("o rosto dos bustos integrais fica na linha do meio", () => {
    for (const b of (bustos.combinacoes as { corpo: string; cabeca: string; mascara: string }[]).filter(
      (v) => !INTEGRAIS_FORA.includes(v.corpo + "|" + v.cabeca),
    )) {
      const c = corpoDe(b.corpo),
        A = montar(b.corpo, b.cabeca),
        meio = juntaNoBind(A, "Neck")![2],
        u = c.encaixe.uTroca ?? c.encaixe.u,
        m = bytes(b.mascara),
        pele = new Uint8Array(A.P.length / 3);
      for (let t = 0; t < m.length; t++)
        if (m[t] === 1 || m[t] === 3) for (let k = 0; k < 3; k++) pele[A.I[t * 3 + k]] = 1;
      let x = -Infinity,
        z = 0;
      for (let v = 0; v < A.P.length / 3; v++) {
        const y = A.P[v * 3 + 1];
        if (!pele[v] || y < c.encaixe.queixo + 0.15 * u || y > c.encaixe.queixo + u) continue;
        if (Math.abs(A.P[v * 3 + 2] - meio) > 0.7 * u || A.P[v * 3] <= x) continue;
        x = A.P[v * 3];
        z = A.P[v * 3 + 2];
      }
      // a busto_16 vinha 0,65 u para o lado
      expect(Math.abs(z - meio) / u, `${b.corpo}|${b.cabeca}`).toBeLessThan(0.05);
    }
  });
});

describe("acabamento do pescoço (buracos, gola)", () => {
  it("mantém corpo e cabeça na mesma ordem e põe o novo no fim, com pesos válidos", () => {
    for (const [corpo, cabeca] of [
      ["corpo_f02", "busto_05"],
      ["corpo_f03", "busto_15"],
      ["corpo_f05", "busto_13"],
      ["heroina", "busto_10"],
      ["lider", "busto_15"],
    ]) {
      const c = corpoDe(corpo),
        semC = decodificarAnim({ ...c.semCabeca, clips: {} }),
        base = comporPele(semC, cabecaDe(cabeca), c.encaixe),
        A = montar(corpo, cabeca),
        e = extrasDoPescoco(A),
        nt = base.I.length / 3,
        nv = A.P.length / 3;
      expect(e.gola, `${corpo}|${cabeca}`).toBeGreaterThan(0);
      expect(A.I.length / 3).toBe(nt + e.pele + e.gola);
      expect(Array.from(A.I.subarray(0, base.I.length))).toEqual(Array.from(base.I));
      // as cores também, menos os restos do cabelo original limpos (só na F02)
      const restos = restosDeCabeloNoPescoco(semC, c.encaixe.queixo, c.encaixe.uTroca ?? c.encaixe.u, [220, 150, 110]);
      for (let k = 0; k < base.C.length; k++)
        if (!restos.has(Math.floor(k / 3))) expect(A.C[k], `${corpo}|${cabeca} C[${k}]`).toBe(base.C[k]);
      expect(A.C.length).toBe(A.I.length);
      if (A.UV) expect(A.UV.length).toBe(A.I.length * 2);
      expect(Math.max(...A.I)).toBeLessThan(nv);
      expect(A.ini[nv]).toBe(A.I.length);
      // a pele que fecha buracos usa só vértices do corpo (pesos dele); o pano tem pesos que somam 1
      const nvCorpo = semC.P.length / 3;
      for (let k = base.I.length; k < base.I.length + e.pele * 3; k++) expect(A.I[k]).toBeLessThan(nvCorpo);
      for (let v = base.P.length / 3; v < nv; v++) {
        const s = A.W[v * 4] + A.W[v * 4 + 1] + A.W[v * 4 + 2] + A.W[v * 4 + 3];
        expect(s).toBeCloseTo(1, 4);
        for (let k = 0; k < 3; k++) expect(Number.isFinite(A.P[v * 3 + k])).toBe(true);
      }
    }
  });

  it("a gola fica em volta do pescoço: entre o fundo e o teto, perto do eixo", () => {
    for (const c of sorteaveis)
      for (const h of dados.cabecas!.filter((h) => cabeNoCorpo(c, h) && cabecaNoJogo(h)).slice(0, 6)) {
        if (bustoIntegral({ corpo: c.nome, cabeca: h.nome }, bustos)) continue; // busto integral: pescoço inteiro, sem gola
        const A = montar(c.nome, h.nome),
          e = extrasDoPescoco(A),
          q = c.encaixe.queixo,
          u = c.encaixe.uTroca ?? c.encaixe.u,
          head = juntaNoBind(A, "Head")!,
          neck = juntaNoBind(A, "Neck")!;
        if (!e.gola) continue;
        const primeiro = A.I.length - e.gola * 3;
        for (let k = primeiro; k < A.I.length; k++) {
          const v = A.I[k],
            y = A.P[v * 3 + 1],
            r = Math.hypot(A.P[v * 3] - head[0], A.P[v * 3 + 2] - neck[2]);
          expect(y, `${c.nome}|${h.nome}`).toBeGreaterThan(q - (GOLA.fundo + 0.2) * u);
          expect(y, `${c.nome}|${h.nome}`).toBeLessThan(q + (GOLA.topoTras + 0.1) * u);
          expect(r, `${c.nome}|${h.nome}`).toBeLessThan((GOLA.alcance + GOLA.espessura + 0.3) * u);
        }
      }
  });

  it("fecha com pele a tira aberta no peito da F05 (não vira um pano até o peito)", () => {
    const A = montar("corpo_f05", "busto_13"),
      e = extrasDoPescoco(A),
      c = corpoDe("corpo_f05"),
      q = c.encaixe.queixo,
      u = c.encaixe.uTroca ?? c.encaixe.u;
    expect(e.pele).toBeGreaterThan(20);
    let fundo = Infinity;
    for (let k = A.I.length - e.gola * 3; k < A.I.length; k++) fundo = Math.min(fundo, A.P[A.I[k] * 3 + 1]);
    expect((q - fundo) / u).toBeLessThan(1.6);
  });

  it("a mesma combinação dá a mesma gola (cor e forma)", () => {
    const a = montar("corpo_f02", "busto_10"),
      b = peleDaAparencia({ corpo: "corpo_f02", cabeca: "busto_10" }, () => null, {
        aparencias: dados,
        bustos,
      }) as Anim;
    expect(Array.from(b.C)).toEqual(Array.from(a.C));
    expect(Array.from(b.P)).toEqual(Array.from(a.P));
  });

  it("com o peitoral vestido, a gola cobre só o que ele deixa à mostra (não vira poncho por cima da placa)", () => {
    const vestidos = JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as {
        modelos: { nome: string; partes?: { peito?: DadosAnim } }[];
      },
      placa = vestidos.modelos.find((m) => m.nome === "corpo_f03__placa")!.partes!.peito!,
      sem = montar("corpo_f03", "busto_10"),
      com = peleDaAparencia({ corpo: "corpo_f03", cabeca: "busto_10" }, () => null, fontes, placa) as Anim,
      q = corpoDe("corpo_f03").encaixe.queixo,
      u = corpoDe("corpo_f03").encaixe.uTroca!,
      fundo = (A: Anim) => {
        let m = Infinity;
        for (let k = A.I.length - extrasDoPescoco(A).gola * 3; k < A.I.length; k++)
          m = Math.min(m, A.P[A.I[k] * 3 + 1]);
        return (q - m) / u;
      };
    // sem roupa a gola desce pelas costas para tapar o buraco da nuca da F03; com a placa, ela fica no pescoço
    expect(extrasDoPescoco(com).gola).toBeGreaterThan(0);
    expect(fundo(com)).toBeLessThan(fundo(sem) - 0.3);
    // o corpo e a cabeça são os mesmos com ou sem peitoral (só o pano muda)
    const nt = sem.I.length - (extrasDoPescoco(sem).pele + extrasDoPescoco(sem).gola) * 3;
    expect(Array.from(com.I.subarray(0, nt))).toEqual(Array.from(sem.I.subarray(0, nt)));
  });
});

describe("F16 (busto_16) ajustada individualmente", () => {
  it("na F02 usa a cabeça trocada, como nos outros corpos (o busto integral tinha o cabelo deitado no braço da pose T)", () => {
    expect(INTEGRAIS_FORA).toContain("corpo_f02|busto_16");
    expect(bustoIntegral({ corpo: "corpo_f02", cabeca: "busto_16" }, bustos)).toBeUndefined();
    expect(bustoIntegral({ corpo: "corpo_f02", cabeca: "busto_04" }, bustos)).toBeDefined();
    const A = montar("corpo_f02", "busto_16");
    expect(extrasDoPescoco(A).gola).toBeGreaterThan(0);
  });
  it("e veste as roupas genéricas da F02, não as feitas para o busto integral", () => {
    const pecas = new Map<string, { nome: string; partes: object }>(
      ["corpo_f02__aventureira", "corpo_f02__busto_16__aventureira", "corpo_f02__busto_04__aventureira"].map((n) => [
        n,
        { nome: n, partes: {} },
      ]),
    );
    const obter = (n: string) => (pecas.get(n) ?? null) as never;
    expect(roupaDaAparencia({ corpo: "corpo_f02", cabeca: "busto_16" }, "aventureira", obter)).toMatchObject({
      nome: "corpo_f02__aventureira",
    });
    expect(roupaDaAparencia({ corpo: "corpo_f02", cabeca: "busto_04" }, "aventureira", obter)).toMatchObject({
      nome: "corpo_f02__busto_04__aventureira",
    });
  });
});

describe("cabelo apoiado no ombro acompanha o ombro (a mecha da busto_04 não corta a ombreira)", () => {
  const HER = decodificarAnim(JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim);
  /** posições de cada vértice na pose (idle), como o jogo: rotações do clipe da heroína no esqueleto da pele */
  const posado = (A: Anim) => {
    const p = poseClip(HER, "parada", 0.5, true),
      pp = novaPose(A);
    pp.r.set(p.r);
    const m = matrizesPose(A, pp),
      out = new Float32Array(A.P.length);
    for (let v = 0; v < A.P.length / 3; v++)
      for (let e = 0; e < 3; e++) {
        let s = 0;
        for (let k = 0; k < 4; k++) {
          const j = A.J[v * 4 + k],
            w = A.W[v * 4 + k],
            o = j * 16;
          if (w)
            s +=
              w *
              (m.skin[o + e] * A.P[v * 3] +
                m.skin[o + 4 + e] * A.P[v * 3 + 1] +
                m.skin[o + 8 + e] * A.P[v * 3 + 2] +
                m.skin[o + 12 + e]);
        }
        out[v * 3 + e] = s;
      }
    return out;
  };
  for (const [corpo, ehIntegral] of [
    ["corpo_f04", true],
    ["corpo_f03", false],
  ] as const)
    it(`${corpo}: a mecha que encosta no ombro segue com ele no idle (${ehIntegral ? "busto integral" : "cabeça trocada"})`, () => {
      const A = montar(corpo, "busto_04"),
        c = corpoDe(corpo),
        u = c.encaixe.uTroca ?? c.encaixe.u,
        braco = A.juntas.map((j) => /Shoulder|Arm|Hand/.test(j)),
        pesoBraco = (v: number) => [0, 1, 2, 3].reduce((s, k) => s + (braco[A.J[v * 4 + k]] ? A.W[v * 4 + k] : 0), 0),
        ehCabelo = ehIntegral
          ? (
              (m) => (t: number) =>
                m[t] === 2
            )(bytes(bustoIntegral({ corpo, cabeca: "busto_04" }, bustos)!.mascara))
          : (
              (n, m) => (t: number) =>
                t >= n && m[t - n] === 2
            )(bytes(c.semCabeca.malha.i).length / 6, bytes(cabecaDe("busto_04").mascara!));
      const cabelo = new Set<number>();
      for (let t = 0; t < A.I.length / 3; t++) if (ehCabelo(t)) for (let k = 0; k < 3; k++) cabelo.add(A.I[t * 3 + k]);
      const noOmbro = [...cabelo].filter((v) => pesoBraco(v) > 0.3);
      expect(noOmbro.length, "mechas presas ao ombro").toBeGreaterThan(10);
      for (const v of cabelo) expect(A.W[v * 4] + A.W[v * 4 + 1] + A.W[v * 4 + 2] + A.W[v * 4 + 3]).toBeCloseTo(1, 4);
      // no idle, cada uma continua perto da pele do ombro mais próxima no bind (antes ficava parada e o ombro descia)
      const corpoV: number[] = [];
      for (let v = 0; v < A.P.length / 3; v++) if (!cabelo.has(v) && pesoBraco(v) > 0.15) corpoV.push(v);
      const Q = posado(A),
        d = (P: ArrayLike<number>, a: number, b: number) =>
          Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
      let longe = 0;
      for (const v of noOmbro) {
        const b = corpoV.reduce((m, w) => (d(A.P, v, w) < d(A.P, v, m) ? w : m), corpoV[0]);
        if (d(Q, v, b) > d(A.P, v, b) + 0.25 * u) longe++;
      }
      expect(longe / noOmbro.length).toBeLessThan(0.1);
    });
});

describe("pescoço sem cor nova e sem os restos do cabelo ruivo da F02", () => {
  const hsv = (c: number[]) => {
    const mx = Math.max(...c),
      mn = Math.min(...c),
      d = mx - mn,
      h = !d
        ? 0
        : mx === c[0]
          ? (60 * ((c[1] - c[2]) / d) + 360) % 360
          : mx === c[1]
            ? 60 * ((c[2] - c[0]) / d) + 120
            : 60 * ((c[0] - c[1]) / d) + 240;
    return [h, mx ? d / mx : 0, mx];
  };
  it("os restos só existem na F02 (o lenço da Líder fica)", () => {
    for (const c of dados.corpos!) {
      const A = decodificarAnim({ ...c.semCabeca, clips: {} }),
        r = restosDeCabeloNoPescoco(A, c.encaixe.queixo, c.encaixe.uTroca ?? c.encaixe.u, [220, 150, 110]);
      if (c.nome === "corpo_f02") expect(r.size).toBeGreaterThanOrEqual(30);
      else expect(r.size, c.nome).toBe(0);
    }
  });
  it("na F02 com cabeça trocada não sobra vermelho saturado perto do pescoço, nem no pano do pescoço", () => {
    for (const nome of ["busto_05", "busto_13", "busto_15", "busto_16"]) {
      const A = montar("corpo_f02", nome),
        c = corpoDe("corpo_f02"),
        u = c.encaixe.uTroca!,
        q = c.encaixe.queixo,
        neck = juntaNoBind(A, "Neck")!,
        ntC = bytes(c.semCabeca.malha.i).length / 6,
        extras = extrasDoPescoco(A),
        nt = A.I.length / 3;
      let vermelhos = 0;
      for (let t = 0; t < nt; t++) {
        if (t >= ntC && t < nt - extras.pele - extras.gola) continue; // a cabeça
        const m = [0, 1, 2].map(
          (e) => (A.P[A.I[t * 3] * 3 + e] + A.P[A.I[t * 3 + 1] * 3 + e] + A.P[A.I[t * 3 + 2] * 3 + e]) / 3,
        );
        if (m[1] < q - 0.7 * u || m[1] > q + 0.3 * u || Math.hypot(m[0] - neck[0], m[2] - neck[2]) > 1.3 * u) continue;
        const [h, sat, v] = hsv([A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]]);
        if ((h <= 12 || h >= 348) && sat >= 0.6 && v >= 90 / 255) vermelhos++;
      }
      expect(vermelhos, nome).toBe(0);
    }
  });
  it("o pescoço de pele não traz cor nova: cada face tem a cor de um triângulo do corpo ou fica entre ela e a pele do rosto", () => {
    expect(GOLA.modo).toBe("pele");
    const A = montar("corpo_f02", "busto_05"),
      e = extrasDoPescoco(A),
      ntC = bytes(corpoDe("corpo_f02").semCabeca.malha.i).length / 6,
      rosto = cabecaDe("busto_05").refPele!.map((v) => v / 255),
      corpoC: number[][] = [];
    for (let t = 0; t < ntC; t++) corpoC.push([A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]]);
    expect(e.gola).toBeGreaterThan(0);
    for (let t = A.I.length / 3 - e.gola; t < A.I.length / 3; t++) {
      const c = [A.C[t * 3], A.C[t * 3 + 1], A.C[t * 3 + 2]];
      // a distância ao segmento (cor de algum triângulo do corpo → pele do rosto)
      const longe = Math.min(
        ...corpoC.map((b) => {
          const d = [0, 1, 2].map((k) => rosto[k] - b[k]),
            dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1,
            s = Math.max(0, Math.min(1, ((c[0] - b[0]) * d[0] + (c[1] - b[1]) * d[1] + (c[2] - b[2]) * d[2]) / dd));
          return Math.hypot(...[0, 1, 2].map((k) => c[k] - (b[k] + d[k] * s)));
        }),
      );
      expect(longe).toBeLessThan(0.02);
    }
  });
});

describe("triângulo de cabelo com cor de pele na textura", () => {
  // uma textura 2×1: pele à esquerda, cabelo escuro à direita
  const tex = { data: Uint8Array.from([230, 150, 110, 40, 20, 20]), w: 2, h: 1 },
    refs = { pele: [230, 150, 110], cabelo: [40, 20, 20] },
    q = (u: number) => Math.round(u * 65535),
    uvs = (us: number[]) => Uint16Array.from(us.flatMap((u) => [q(u), 0, q(u), 0, q(u), 0]));
  // o triângulo 0 no meio, os outros três encostados nele por uma aresta cada
  const I = Uint16Array.from([0, 1, 2, 1, 0, 3, 2, 1, 4, 0, 2, 5]);
  it("o ponto isolado passa a usar o UV de um vizinho de cabelo", () => {
    const uv = uvs([0.25, 0.75, 0.75, 0.75]),
      feitos = corrigirUvCabelo(I, uv, [2, 2, 2, 2], tex, refs);
    expect(feitos).toEqual([0]);
    expect(uv[0] / 65535).toBeCloseTo(0.75, 3);
  });
  it("cabelo cor de pele com vizinhos cor de pele (cabeça raspada) fica como está", () => {
    const uv = uvs([0.25, 0.25, 0.75, 0.75]);
    expect(corrigirUvCabelo(I, uv, [2, 2, 2, 2], tex, refs)).toEqual([]);
  });
  it("os dados não têm mais o ponto laranja da busto_15", () => {
    const cab = cabecaDe("busto_15"),
      uv = new Uint16Array(bytes(cab.uv!).buffer),
      I15 = new Uint16Array(bytes(cab.i).buffer);
    // já corrigido nos dados: o triângulo usa o mesmo UV nos três cantos (o do vizinho)
    expect(uv[5953 * 6]).toBe(uv[5953 * 6 + 2]);
    expect(uv[5953 * 6 + 1]).toBe(uv[5953 * 6 + 5]);
    expect(I15.length / 3).toBeGreaterThan(5953);
  });
});
