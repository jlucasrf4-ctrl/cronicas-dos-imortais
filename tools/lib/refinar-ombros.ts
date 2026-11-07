/** Reposiciona o pivô dentro do deltoide e suaviza somente os pesos da cintura escapular. */
import { readFileSync } from "node:fs";
import { Matrix4, Vector3 } from "three";
import type { DadosAnim } from "../../src/render/gl/esqueleto.ts";

interface AjusteOmbros {
  desnivelClavicula: number;
  suavizarPesos: number;
}
const AJUSTES = JSON.parse(readFileSync("tools/modelos/ombros.json", "utf8")) as Record<string, AjusteOmbros>;
const suave = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function refinarOmbrosModelo(nome: string, d: DadosAnim) {
  const ajuste = AJUSTES[nome.split("__")[0]];
  if (!ajuste) return { pivos: 0, vertices: 0 };
  const glob = d.ibm.map((m) => new Matrix4().fromArray(m).invert());
  const lados = ["Left", "Right"]
    .map((lado) => ({
      arm: d.juntas.indexOf(lado + "Arm"),
      clav: d.juntas.indexOf(lado + "Shoulder"),
    }))
    .filter(({ arm, clav }) => arm >= 0 && clav >= 0);
  const regioes = lados.map(({ arm, clav }) => ({
    x: glob[arm].elements[12],
    y: glob[clav].elements[13],
    z: Math.abs(glob[arm].elements[14]),
    sinal: Math.sign(glob[arm].elements[14]),
  }));
  let pivos = 0;
  for (const { arm, clav } of lados) {
    const alvo = glob[clav].elements[13] - ajuste.desnivelClavicula;
    if (glob[arm].elements[13] <= alvo + 1e-4) continue;
    glob[arm].elements[13] = alvo;
    d.ibm[arm] = glob[arm].clone().invert().toArray();
    // O cotovelo e as outras juntas conservam suas posições globais de bind.
    const filhos = d.pais.map((pai, j) => (pai === arm ? j : -1)).filter((j) => j >= 0);
    for (const j of [arm, ...filhos]) {
      const pai = d.pais[j];
      const inversa = pai < 0 ? new Matrix4().fromArray(d.raiz).invert() : glob[pai].clone().invert();
      d.repouso[j] = new Vector3().setFromMatrixPosition(glob[j]).applyMatrix4(inversa).toArray();
    }
    pivos++;
  }
  // Evita acumular suavização ao executar de novo sobre um pacote já refinado.
  if (!pivos || ajuste.suavizarPesos <= 0) return { pivos, vertices: 0 };
  const bytes = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
  const P = new Int16Array(bytes(d.malha.p).buffer),
    I = new Uint16Array(bytes(d.malha.i).buffer);
  const J = bytes(d.malha.j),
    W = bytes(d.malha.w),
    nv = P.length / 3,
    nj = d.juntas.length;
  const viz = Array.from({ length: nv }, () => new Set<number>());
  for (let t = 0; t < I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = I[t + k],
        b = I[t + ((k + 1) % 3)];
      viz[a].add(b);
      viz[b].add(a);
    }
  const mascara = Float64Array.from({ length: nv }, (_, v) => {
    const x = P[v * 3] / 64,
      y = P[v * 3 + 1] / 64,
      z = P[v * 3 + 2] / 64;
    const r = regioes.find((r) => Math.sign(z) === r.sinal);
    if (!r) return 0;
    let braco = 0;
    for (let k = 0; k < 4; k++) if (/Shoulder|Arm$/.test(d.juntas[J[v * 4 + k]])) braco += W[v * 4 + k] / 255;
    if (braco < 0.25) return 0;
    return (
      suave(r.y - 4, r.y - 2, y) *
      (1 - suave(r.y + 0.1, r.y + 1, y)) *
      suave(r.z - 2.45, r.z - 0.95, Math.abs(z)) *
      (1 - suave(r.z + 1.75, r.z + 3.35, Math.abs(z))) *
      (1 - suave(r.x + 3.1, r.x + 4.6, x))
    );
  });
  let pesos = new Float64Array(nv * nj);
  for (let v = 0; v < nv; v++) for (let k = 0; k < 4; k++) pesos[v * nj + J[v * 4 + k]] += W[v * 4 + k] / 255;
  for (let passo = 0; passo < ajuste.suavizarPesos; passo++) {
    const novo = pesos.slice();
    for (let v = 0; v < nv; v++)
      if (mascara[v] > 0 && viz[v].size)
        for (let j = 0; j < nj; j++) {
          let media = 0;
          for (const u of viz[v]) media += pesos[u * nj + j];
          media /= viz[v].size;
          novo[v * nj + j] += 0.6 * mascara[v] * (media - pesos[v * nj + j]);
        }
    pesos = novo;
  }
  let vertices = 0;
  for (let v = 0; v < nv; v++)
    if (mascara[v] > 0) {
      const top = Array.from({ length: nj }, (_, j) => [j, pesos[v * nj + j]])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      const soma = top.reduce((s, [, w]) => s + w, 0);
      const quant = top.map(([, w]) => Math.round((w / soma) * 255));
      quant[0] += 255 - quant.reduce((s, w) => s + w, 0);
      top.forEach(([j], k) => {
        J[v * 4 + k] = j;
        W[v * 4 + k] = quant[k];
      });
      vertices++;
    }
  d.malha.j = Buffer.from(J).toString("base64");
  d.malha.w = Buffer.from(W).toString("base64");
  return { pivos, vertices };
}
