/* ==== v8.1 — as cores das estações no cenário (sem modelo novo: as árvores, o chão e o capim de sempre, repintados) ====
   Inverno: neve em tudo o que olha para cima, folhagem acinzentada; primavera: parte da copa vira flor (rosa ou branca)
   e o verde clareia; outono: a folhagem vira laranja, vermelho e amarelo, o chão e o capim secam; verão: verde mais
   vivo e chão mais quente. Usado pela prévia de estação do Modo Editor (ED.estacao, só com o editor aberto) e pelas
   peças "<item>@<estação>" da biblioteca (editor/modelos.ts). As cores seguem a arte das deusas (memória das estações). */
import { ED } from "../../editor/estado.ts";

/** neve: cor e quanto cobre (pelo quanto a face olha para cima); flor: chance por triângulo da copa e as cores;
 *  folhasOutono: as cores sorteadas da folhagem; chao/capim: [cor, quanto] por estação. */
const ESTACAO_COR = {
  neve: [0.93, 0.96, 1],
  neveDe: 0.25,
  flor: 0.4,
  flores: [
    [1, 0.66, 0.8],
    [0.98, 0.8, 0.88],
    [1, 0.97, 0.95],
  ],
  folhasOutono: [
    [0.92, 0.44, 0.12],
    [0.8, 0.2, 0.12],
    [0.93, 0.68, 0.18],
    [0.72, 0.32, 0.12],
  ],
  chao: {
    inverno: [[0.9, 0.93, 0.98], 0.78],
    outono: [[0.62, 0.5, 0.26], 0.35],
    verao: [[0.72, 0.68, 0.3], 0.15],
    primavera: [[0.42, 0.66, 0.3], 0.18],
  } as Record<string, [number[], number]>,
  capim: {
    inverno: [[0.88, 0.92, 0.97], 0.65],
    outono: [[0.82, 0.62, 0.28], 0.6],
    verao: [[0.62, 0.72, 0.25], 0.2],
    primavera: [[0.5, 0.82, 0.38], 0.25],
  } as Record<string, [number[], number]>,
};

/** A estação que o cenário mostra agora ("" = a de sempre): só a prévia do editor aberto. */
export function estacaoVista() {
  return ED.on ? ED.estacao : "";
}
const mix = (a: number[], b: number[], t: number) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
function hash(n: number) {
  const s = Math.sin(n * 91.345 + 47.853) * 43758.5453;
  return s - Math.floor(s);
}

/** A cor `c` (rgb 0..1) na estação `est`. tipo: "planta" (árvores, moitas, pedras: `ny` = o quanto a face olha para
 *  cima, `sem` = número fixo do triângulo), "chao" ou "capim". */
export function corEstacao(
  c: number[],
  tipo: "planta" | "chao" | "capim",
  ny: number,
  sem: number,
  est = estacaoVista(),
) {
  if (!est) return c;
  const E = ESTACAO_COR;
  if (tipo !== "planta") {
    const t = (tipo === "chao" ? E.chao : E.capim)[est];
    return t ? mix(c, t[0], t[1]) : c;
  }
  const [r, g, b] = c,
    verde = g > r * 1.04 && g > b * 1.05,
    laranja = r > 0.4 && r > g * 1.25 && r > b * 1.6,
    folha = verde || laranja;
  if (est === "inverno") {
    if (ny > E.neveDe) return mix(c, E.neve, Math.min(1, 0.45 + (ny - E.neveDe) * 0.9));
    if (folha) {
      const l = (r + g + b) / 3;
      return mix(c, [l * 0.9, l * 0.95, l], 0.5).map((v) => v * 0.85);
    }
    return c;
  }
  if (!folha) return c;
  if (est === "primavera") {
    if (hash(sem) < E.flor && ny > -0.2) return mix(c, E.flores[Math.floor(hash(sem + 7) * E.flores.length)], 0.88);
    return [r * 0.95, Math.min(1, g * 1.1), b * 0.95];
  }
  if (est === "outono") return mix(c, E.folhasOutono[Math.floor(hash(sem) * E.folhasOutono.length)], 0.78);
  if (est === "verao") return [r * 0.96, Math.min(1, g * 1.06), b * 0.9];
  return c;
}
