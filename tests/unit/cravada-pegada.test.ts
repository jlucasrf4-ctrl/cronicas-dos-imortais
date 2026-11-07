import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it } from "vitest";
import { GL3 } from "../../src/core/state.ts";
import { animar, animarNoInstanteDe, novoAnimado, prenderMaosNaArma, trocarPele } from "../../src/render/gl/animado.ts";
import { M4 } from "../../src/render/gl/geometria.ts";
import type { DadosAnim, MatrizesPose } from "../../src/render/gl/esqueleto.ts";
import type { AparenciasDados } from "../../src/render/gl/aparencias.ts";

const dados = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
const aparencias = JSON.parse(readFileSync("src/assets/models/aparencias.json", "utf8")) as AparenciasDados;
delete dados.tex;
const original = GL3.gl,
  vazio = () => {};
beforeEach(() => {
  GL3.gl = {
    createVertexArray: () => ({}),
    createBuffer: () => ({}),
    bindVertexArray: vazio,
    bindBuffer: vazio,
    bufferData: vazio,
    bufferSubData: vazio,
    enableVertexAttribArray: vazio,
    vertexAttribPointer: vazio,
  } as unknown as WebGL2RenderingContext;
});
afterEach(() => {
  GL3.gl = original;
});

for (const nome of ["heroina", "corpo_f02", "corpo_f06"]) {
  it(`${nome}: avança a pegada sem alongar os ossos e mantém a roupa na mesma pose`, () => {
    const ajustes = { passoAndar: 80, passoCorrer: 158, rolarDur: 0.6, coletarDur: 0.8, troca: 0.15 };
    const presos = (G: (junta: string) => Float32Array) => ({
      palmaD: { junta: "RightHand", repouso: G("RightHand") },
      palmaE: { junta: "LeftHand", repouso: G("LeftHand") },
      arma: { junta: "RightHand", repouso: G("RightHand") },
    });
    const X = novoAnimado(dados, ajustes, presos),
      roupa = novoAnimado(dados, ajustes, presos);
    if (nome !== "heroina") {
      const pele = { ...aparencias.corpos!.find((c) => c.nome === nome)!.semCabeca };
      delete pele.tex;
      trocarPele(X, pele);
      trocarPele(roupa, pele);
    }
    const s = { dt: 1, andou: 0, golpe: 0.14 },
      inicial = animar(X, s)!;
    const ponto = (m: MatrizesPose, nomeJunta: string) => {
      const j = (X.pele ?? X.A)!.juntas.indexOf(nomeJunta) * 16;
      return Array.from(m.glob.slice(j + 12, j + 15));
    };
    const distancia = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
    const ossos = (m: MatrizesPose, lado: string) => [
      distancia(ponto(m, lado + "Arm"), ponto(m, lado + "ForeArm")),
      distancia(ponto(m, lado + "ForeArm"), ponto(m, lado + "Hand")),
    ];
    const eixo = [1, 0, 0],
      comprimentos = [ossos(inicial.mat, "Right"), ossos(inicial.mat, "Left")],
      ombros = [ponto(inicial.mat, "RightArm"), ponto(inicial.mat, "LeftArm")];
    let primeira: number[] | undefined;
    for (const profundidade of [0, 0.09, 0.18]) {
      animar(X, s);
      const ombro = ombros[0],
        pos = [ombro[0] + 3 + 48 * profundidade, ombro[1] - 7, ombro[2]],
        arma = M4.ch(
          M4.T(pos[0], pos[1], pos[2]),
          M4.RY(-Math.atan2(eixo[2], eixo[0])),
          M4.RZ(Math.atan2(eixo[1], Math.hypot(eixo[0], eixo[2]))),
        ),
        atual = prenderMaosNaArma(X, arma, true)!,
        vestida = animarNoInstanteDe(roupa, X, s)!;
      for (const [i, lado] of ["Right", "Left"].entries()) {
        ossos(atual.mat, lado).forEach((v, k) => expect(v).toBeCloseTo(comprimentos[i][k], 4));
        expect(distancia(ponto(atual.mat, lado + "Arm"), ombros[i])).toBeLessThan(0.001);
        expect(distancia(ponto(atual.mat, lado + "Hand"), ponto(vestida.mat, lado + "Hand"))).toBeLessThan(0.001);
        const maoNoCabo = ponto(atual.mat, lado + "Hand");
        expect(Math.hypot(maoNoCabo[1] - pos[1], maoNoCabo[2] - pos[2])).toBeLessThan(0.02);
      }
      const mao = ponto(atual.mat, "RightHand");
      if (!primeira) primeira = mao;
      if (profundidade === 0.18) expect(distancia(mao, primeira)).toBeGreaterThan(1);
    }
  });
}
