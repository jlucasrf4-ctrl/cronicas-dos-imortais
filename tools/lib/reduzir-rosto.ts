/** Reserva geometria facial antes de simplificar cabelo, pescoço e tronco. */
import { subMalha, type MalhaTex } from "./glb.ts";
import { reduzirPecaUV } from "./peca.ts";
export async function reduzirComPrioridadeRosto(
  m: MalhaTex,
  alvo: number,
  marcos: { queixo: number; olhos: number; eixoX?: number; narizZ?: number },
) {
  const u = marcos.olhos - marcos.queixo;
  if (!(u > 0) || alvo < 10) throw new Error("Marcos ou orçamento facial inválidos");
  let minX = Infinity,
    maxX = -Infinity;
  for (let k = 0; k < m.P.length; k += 3) {
    minX = Math.min(minX, m.P[k]);
    maxX = Math.max(maxX, m.P[k]);
  }
  const eixoX = marcos.eixoX ?? (minX + maxX) / 2;
  let narizZ = marcos.narizZ ?? -Infinity;
  if (marcos.narizZ == null)
    for (let k = 0; k < m.P.length; k += 3)
      if (
        Math.abs(m.P[k] - eixoX) < u * 0.8 &&
        m.P[k + 1] > marcos.queixo &&
        m.P[k + 1] < marcos.olhos &&
        m.P[k + 2] > narizZ
      )
        narizZ = m.P[k + 2];
  const rosto: number[] = [],
    restante: number[] = [];
  for (let t = 0; t < m.I.length / 3; t++) {
    const centro = [0, 1, 2].map(
      (e) => (m.P[m.I[t * 3] * 3 + e] + m.P[m.I[t * 3 + 1] * 3 + e] + m.P[m.I[t * 3 + 2] * 3 + e]) / 3,
    );
    const facial =
      Math.abs(centro[0] - eixoX) < u * 1.1 &&
      centro[1] > marcos.queixo - u * 0.18 &&
      centro[1] < marcos.olhos + u * 1.3 &&
      centro[2] > narizZ - u * 1.25;
    (facial ? rosto : restante).push(t);
  }
  if (!rosto.length || !restante.length) return reduzirPecaUV(m, alvo, true);
  const alvoRosto = Math.min(rosto.length, Math.round(alvo * 0.65));
  const face = await reduzirPecaUV(subMalha(m, rosto), alvoRosto, true);
  const fora = await reduzirPecaUV(subMalha(m, restante), Math.max(1, alvo - face.p.length / 9), true);
  console.log(`  prioridade facial: ${face.p.length / 9} triângulos de rosto; ${fora.p.length / 9} restantes`);
  return { p: [...face.p, ...fora.p], c: [...face.c, ...fora.c], uv: [...face.uv, ...fora.uv] };
}
