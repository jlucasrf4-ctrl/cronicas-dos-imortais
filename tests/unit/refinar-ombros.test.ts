import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { refinarOmbrosModelo } from "../../tools/lib/refinar-ombros.ts";
import {
  decodificarAnim,
  deformarMalha,
  matrizesPose,
  novaPose,
  type DadosAnim,
} from "../../src/render/gl/esqueleto.ts";

const original = JSON.parse(readFileSync("src/assets/models/heroina_anim.json", "utf8")) as DadosAnim;
const bindPose = (d: DadosAnim) => {
  const A = decodificarAnim(d),
    pose = novaPose(A);
  const glob = d.ibm.map((m) => new Matrix4().fromArray(m).invert());
  for (let j = 0; j < d.juntas.length; j++) {
    const pai = d.pais[j];
    const inv = pai < 0 ? new Matrix4().fromArray(d.raiz).invert() : glob[pai].clone().invert();
    const local = inv.multiply(glob[j]);
    const t = new Vector3(),
      q = new Quaternion(),
      s = new Vector3();
    local.decompose(t, q, s);
    pose.r.set(q.toArray(), j * 4);
    if (pai < 0) pose.q.set(t.toArray());
  }
  return { A, pose, glob };
};

describe("ombros da Atlética", () => {
  it("muda só o pivô dos braços, mantendo a posição de bind das outras juntas e a superfície", () => {
    const d = structuredClone(original),
      antes = bindPose(d);
    expect(refinarOmbrosModelo("corpo_f02", d).pivos).toBe(2);
    const depois = bindPose(d);
    for (let j = 0; j < d.juntas.length; j++) {
      if (/^(Left|Right)Arm$/.test(d.juntas[j])) continue;
      expect(depois.glob[j].elements).toEqual(antes.glob[j].elements);
    }
    const m = matrizesPose(depois.A, depois.pose);
    const malha = deformarMalha(depois.A, m);
    const malhaAntes = deformarMalha(antes.A, matrizesPose(antes.A, antes.pose));
    let desvio = 0;
    for (let k = 0; k < malha.p.length; k++) desvio = Math.max(desvio, Math.abs(malha.p[k] - malhaAntes.p[k]));
    // O rig original tem arredondamento de matrizes; conserva a superfície dentro de meio passo de quantização.
    expect(desvio).toBeLessThan(1 / 128);
    for (const campo of ["p", "i", "c", "uv"] as const) expect(d.malha[campo]).toBe(original.malha[campo]);
    expect(d.clips).toEqual(original.clips);
  });
  it("conserva pesos normalizados e não muda a parte inferior do corpo", () => {
    const d = structuredClone(original);
    refinarOmbrosModelo("corpo_f02", d);
    const P = new Int16Array(Uint8Array.from(Buffer.from(d.malha.p, "base64")).buffer);
    const J = Buffer.from(d.malha.j, "base64"),
      W = Buffer.from(d.malha.w, "base64");
    const J0 = Buffer.from(original.malha.j, "base64"),
      W0 = Buffer.from(original.malha.w, "base64");
    for (let v = 0; v < P.length / 3; v++) {
      expect([...W.subarray(v * 4, v * 4 + 4)].reduce((s, w) => s + w, 0)).toBe(255);
      for (let k = 0; k < 4; k++) expect(J[v * 4 + k]).toBeLessThan(d.juntas.length);
      if (P[v * 3 + 1] / 64 < 29) {
        expect(J.subarray(v * 4, v * 4 + 4)).toEqual(J0.subarray(v * 4, v * 4 + 4));
        expect(W.subarray(v * 4, v * 4 + 4)).toEqual(W0.subarray(v * 4, v * 4 + 4));
      }
    }
  });
  it("não acumula o ajuste e preserva corpos sem configuração", () => {
    const d = structuredClone(original);
    expect(refinarOmbrosModelo("corpo_f01", d)).toEqual({ pivos: 0, vertices: 0 });
    expect(d).toEqual(original);
    refinarOmbrosModelo("corpo_f02", d);
    const umaVez = structuredClone(d);
    expect(refinarOmbrosModelo("corpo_f02", d)).toEqual({ pivos: 0, vertices: 0 });
    expect(d).toEqual(umaVez);
  });
});
