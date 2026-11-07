/* v8.1 — estabiliza o peito sem imobilizar as clavículas ou criar um corte nos pesos dos ombros. */
interface MalhaPesos {
  juntas?: string[];
  malha?: { p: string; j: string; w: string };
}
const suave = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function estabilizarBusto(d: MalhaPesos, faixa?: [number, number]) {
  if (!d.malha || !d.juntas) return { faixa: faixa ?? ([0, 0] as [number, number]), alterados: 0 };
  const { malha, juntas } = d;
  const p = Buffer.from(malha.p, "base64"),
    j = Buffer.from(malha.j, "base64"),
    w = Buffer.from(malha.w, "base64");
  const nv = p.length / 6;
  let y0 = faixa?.[0] ?? Infinity,
    y1 = faixa?.[1] ?? -Infinity;
  if (!faixa)
    for (let v = 0; v < nv; v++) {
      const y = p.readInt16LE(v * 6 + 2) / 64;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  const h = y1 - y0;
  const reserva = juntas.indexOf("Spine2");
  if (h <= 0 || reserva < 0) return { faixa: [y0, y1] as [number, number], alterados: 0 };
  let alterados = 0;
  for (let v = 0; v < nv; v++) {
    const frente = p.readInt16LE(v * 6) / 64 / h;
    const altura = (p.readInt16LE(v * 6 + 2) / 64 - y0) / h;
    const lado = Math.abs(p.readInt16LE(v * 6 + 4) / 64) / h;
    const mistura =
      suave(0, 0.045, frente) *
      suave(0.58, 0.64, altura) *
      (1 - suave(0.73, 0.81, altura)) *
      (1 - suave(0.065, 0.135, lado));
    if (mistura <= 0) continue;
    const pesos = new Map<number, number>();
    let removido = 0;
    for (let k = 0; k < 4; k++) {
      const id = j[v * 4 + k],
        peso = w[v * 4 + k];
      // Clavículas continuam livres: apenas a influência do braço sobre o centro do peito é atenuada.
      const tira = /^(Left|Right)(Arm|ForeArm|Hand)$/.test(juntas[id]) ? peso * mistura : 0;
      removido += tira;
      pesos.set(id, (pesos.get(id) ?? 0) + peso - tira);
    }
    if (removido < 0.5) continue;
    pesos.set(reserva, (pesos.get(reserva) ?? 0) + removido);
    const maiores = [...pesos]
      .filter(([, peso]) => peso > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const soma = maiores.reduce((s, [, peso]) => s + peso, 0);
    let atribuido = 0;
    for (let k = 0; k < 4; k++) {
      j[v * 4 + k] = maiores[k]?.[0] ?? 0;
      const peso = maiores[k]
        ? k === maiores.length - 1
          ? 255 - atribuido
          : Math.floor((maiores[k][1] / soma) * 255)
        : 0;
      w[v * 4 + k] = peso;
      atribuido += peso;
    }
    alterados++;
  }
  malha.j = j.toString("base64");
  malha.w = w.toString("base64");
  return { faixa: [y0, y1] as [number, number], alterados };
}
