import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GL3 } from "../../src/core/state.ts";
import { animar, animarNoInstanteDe, novoAnimado, trocarPele, type SituacaoAnim } from "../../src/render/gl/animado.ts";
import type { AparenciasDados } from "../../src/render/gl/aparencias.ts";
import type { DadosAnim, MatrizesPose } from "../../src/render/gl/esqueleto.ts";

const dados = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
// Só a deformação CPU é avaliada. Os envios de buffers não precisam de uma GPU.
delete dados.tex;
const glOriginal = GL3.gl;
const vazio = () => {};
const gl = {
  createVertexArray: () => ({}),
  createBuffer: () => ({}),
  bindVertexArray: vazio,
  bindBuffer: vazio,
  bufferData: vazio,
  bufferSubData: vazio,
  enableVertexAttribArray: vazio,
  vertexAttribPointer: vazio,
} as unknown as WebGL2RenderingContext;
beforeEach(() => {
  GL3.gl = gl;
});
afterEach(() => {
  GL3.gl = glOriginal;
});

function personagem(relaxar: boolean) {
  return novoAnimado(
    dados,
    {
      passoAndar: 80,
      passoCorrer: 158,
      rolarDur: 0.6,
      coletarDur: 0.8,
      troca: 0.15,
      paradaRelaxada: relaxar,
    },
    () => ({}),
  );
}
function ponto(m: MatrizesPose, nome: string) {
  const i = dados.juntas.indexOf(nome) * 16;
  return [m.glob[i + 12], m.glob[i + 13], m.glob[i + 14]];
}
function distancia(a: number[], b: number[]) {
  return Math.hypot(...a.map((v, i) => v - b[i]));
}
function quadro(relaxar: boolean, situacao: SituacaoAnim) {
  const x = personagem(relaxar);
  const an = animar(x, situacao)!;
  expect(an).not.toBeNull();
  return { x, mat: an.mat };
}

describe("parada humana relaxada", () => {
  it("deixa folga lateral e flexiona o cotovelo para trás, preservando o comprimento dos braços", () => {
    for (const t of [0, 0.3, 0.9, 1.6, 2.2]) {
      const s = { dt: 1, andou: 0, fixo: { clip: "parada", t } };
      const antiga = quadro(false, s),
        atual = quadro(true, s);
      expect(Array.from(atual.mat.glob).every(Number.isFinite)).toBe(true);
      expect(Array.from(atual.x.V!).every(Number.isFinite)).toBe(true);
      for (const lado of ["Left", "Right"]) {
        const a0 = ponto(antiga.mat, lado + "Arm"),
          e0 = ponto(antiga.mat, lado + "ForeArm"),
          h0 = ponto(antiga.mat, lado + "Hand");
        const a = ponto(atual.mat, lado + "Arm"),
          e = ponto(atual.mat, lado + "ForeArm"),
          h = ponto(atual.mat, lado + "Hand");
        expect(Math.abs(h[2] - a[2])).toBeLessThan(Math.abs(h0[2] - a0[2]));
        expect(h[1]).toBeLessThan(e[1]);
        expect(e[1]).toBeLessThan(a[1]);
        // +x é a frente: a mão cai à frente do cotovelo, sem dobrar para fora.
        expect(h[0]).toBeGreaterThan(e[0]);
        expect(e[0]).toBeLessThan(a[0]);
        const comp = distancia(a, e) + distancia(e, h);
        expect(Math.abs(h[2] - a[2]) / comp).toBeCloseTo(0.2, 4);
        expect(Math.abs(e[2] - a[2]) / comp).toBeLessThan(0.15);
        expect(distancia(a, e)).toBeCloseTo(distancia(a0, e0), 4);
        expect(distancia(e, h)).toBeCloseTo(distancia(e0, h0), 4);
      }
    }
  });
  it("não altera caminhada, corrida, guarda ou mira do arco", () => {
    const situacoes: SituacaoAnim[] = [
      { dt: 1, andou: 20, movendo: 1 },
      { dt: 1, andou: 20, movendo: 1, correndo: 1 },
      { dt: 1, andou: 0, modo: "combate", guarda: true },
      { dt: 1, andou: 0, modo: "arco", mirando: true, carga: 1 },
    ];
    for (const s of situacoes) {
      const antiga = quadro(false, s),
        atual = quadro(true, s);
      expect(atual.x.estado).not.toBe("parada");
      expect(Array.from(atual.mat.glob)).toEqual(Array.from(antiga.mat.glob));
      expect(Array.from(atual.x.V!)).toEqual(Array.from(antiga.x.V!));
    }
  });
  it("conclui a transição de repouso para caminhada sem carregar a correção para o passo", () => {
    const a = personagem(false),
      b = personagem(true);
    for (const x of [a, b]) {
      animar(x, { dt: 1, andou: 0 });
      animar(x, { dt: 0.05, andou: 3, movendo: 1 });
      expect(Array.from(x.mat!.glob).every(Number.isFinite)).toBe(true);
      animar(x, { dt: 0.2, andou: 10, movendo: 1 });
    }
    expect(Array.from(b.mat!.glob)).toEqual(Array.from(a.mat!.glob));
  });
});

const aparenciasReais = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
const roupasReais = JSON.parse(readFileSync("src/assets/models/vestidos.json", "utf8")) as {
  modelos: { nome: string; partes?: Partial<Record<"peito" | "pernas" | "pes", DadosAnim>> }[];
};
function semTextura(d: DadosAnim): DadosAnim {
  return { ...d, tex: undefined, texDe: undefined, malha: { ...d.malha, uv: undefined } };
}
function corpoReal(nome: string) {
  const d = aparenciasReais.corpos!.find((c) => c.nome === nome)!.semCabeca;
  const x = personagem(true);
  trocarPele(x, semTextura(d));
  return x;
}

describe("braços e roupas nos corpos reais", () => {
  it("mantém a mão como continuação do antebraço nos corpos F01, F02 e F06", () => {
    for (const nome of ["corpo_f01", "corpo_f02", "corpo_f06"]) {
      const x = corpoReal(nome);
      for (const t of [0, 0.9, 2.2]) {
        const mat = animar(x, { dt: 1, andou: 0, fixo: { clip: "parada", t } })!.mat;
        const A = x.pele!;
        for (const lado of ["Left", "Right"]) {
          const jH = A.juntas.indexOf(lado + "Hand"),
            jF = A.juntas.indexOf(lado + "ForeArm");
          const pulso = Array.from(mat.glob.subarray(jH * 16 + 12, jH * 16 + 15)),
            cotovelo = Array.from(mat.glob.subarray(jF * 16 + 12, jF * 16 + 15));
          // Mede a mão já deformada. Vértices quase totalmente presos à Hand excluem o punho misturado.
          const centro = [0, 0, 0];
          let n = 0;
          for (let v = 0; v < A.P.length / 3; v++) {
            let peso = 0;
            for (let k = 0; k < 4; k++) if (A.J[v * 4 + k] === jH) peso += A.W[v * 4 + k];
            if (peso < 0.9) continue;
            for (let e = 0; e < 3; e++) centro[e] += x.V![v * 3 + e];
            n++;
          }
          expect(n).toBeGreaterThan(3);
          const mao = centro.map((v, e) => v / n - pulso[e]),
            antebraco = pulso.map((v, e) => v - cotovelo[e]),
            cos = mao.reduce((s, v, e) => s + v * antebraco[e], 0) / (Math.hypot(...mao) * Math.hypot(...antebraco));
          expect(cos, nome + " " + lado + " t=" + t).toBeGreaterThan(0.98);
        }
      }
    }
  });

  it("mantém os braços e punhos da roupa na mesma pose do corpo, inclusive ao trocar de estado", () => {
    const corpo = corpoReal("corpo_f02"),
      roupa = personagem(true),
      peito = roupasReais.modelos.find((m) => m.nome === "corpo_f02__aventureira")!.partes!.peito!;
    trocarPele(roupa, semTextura(peito));
    const situacoes: SituacaoAnim[] = [
      { dt: 1, andou: 0 },
      { dt: 0.05, andou: 2, movendo: 1 },
      { dt: 0.2, andou: 8, movendo: 1 },
      { dt: 0.2, andou: 0 },
      { dt: 0.1, andou: 0, modo: "arco", mirando: true, carga: 1 },
    ];
    for (const s of situacoes) {
      const mCorpo = animar(corpo, s)!.mat,
        mRoupa = animarNoInstanteDe(roupa, corpo, s)!.mat;
      expect(Array.from(roupa.pose!.r)).toEqual(Array.from(corpo.pose!.r));
      for (const nome of ["LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"]) {
        const iCorpo = corpo.pele!.juntas.indexOf(nome) * 16,
          iRoupa = roupa.pele!.juntas.indexOf(nome) * 16;
        for (let k = 0; k < 16; k++) expect(mRoupa.glob[iRoupa + k], nome).toBeCloseTo(mCorpo.glob[iCorpo + k], 5);
      }
    }
  });
});
