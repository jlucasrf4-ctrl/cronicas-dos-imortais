/* ==== v8.3 — mapa explorado: cada célula do mapa (EXPLORA.celula) que o herói chega perto (EXPLORA.raio) vira explorada
   e sai da névoa do minimapa (hud.ts explorarNevoa). Guardada em econ.explorado (vai no save). A perícia "cartografo"
   sobe com as células novas (hero/nivel.ts gainSkill). Chamada a cada quadro pelo laço do mapa (map/quadro.ts). ==== */
import { world, econ, dungeon } from "../core/state.ts";
import { gainSkill } from "../hero/nivel.ts";

export const EXPLORA = {
  celula: 40, // lado de uma célula, em unidades do mapa
  raio: 90, // o quanto o herói enxerga ao redor de si
  celulasPorPonto: 4, // células novas para ganhar 1 ponto de cartógrafo
};

/* as células de um herói ficam num Set (rápido de consultar) espelhando econ.explorado; ao carregar um save o array
   troca de referência e o Set é refeito */
const CACHE = { ref: null as number[] | null, set: new Set<number>(), sujo: true };
const ACUM = new Map<string, number>();

const chave = (cx: number, cy: number) => (cy + 5000) * 10000 + (cx + 5000);

export function vistos(): Set<number> {
  if (!econ.explorado) econ.explorado = [];
  if (CACHE.ref !== econ.explorado) {
    CACHE.ref = econ.explorado;
    CACHE.set = new Set(econ.explorado);
    CACHE.sujo = true;
  }
  return CACHE.set;
}

/** Marca as células em volta de (x, y). Devolve quantas são novas. */
function explorarEm(x: number, y: number): number {
  const s = vistos(),
    c = EXPLORA.celula,
    r = EXPLORA.raio;
  const x0 = Math.floor((x - r) / c),
    x1 = Math.floor((x + r) / c),
    y0 = Math.floor((y - r) / c),
    y1 = Math.floor((y + r) / c);
  let novas = 0;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const mx = (cx + 0.5) * c - x,
        my = (cy + 0.5) * c - y;
      if (mx * mx + my * my > r * r) continue;
      const k = chave(cx, cy);
      if (s.has(k)) continue;
      s.add(k);
      econ.explorado!.push(k);
      novas++;
    }
  if (novas) CACHE.sujo = true;
  return novas;
}

/** Quantas áreas (células) o mapa já tem explorado: o caderno mostra. */
export function celulasExploradas(): number {
  return vistos().size;
}

/** A névoa do minimapa: escurece o mapa e abre um buraco em cada célula explorada. `k` = pixels por unidade do mapa. */
export function explorarNevoa(c: CanvasRenderingContext2D, W: number, H: number, k: number) {
  if (!FOG.cv || FOG.cv.width !== W || FOG.cv.height !== H) {
    FOG.cv = document.createElement("canvas");
    FOG.cv.width = W;
    FOG.cv.height = H;
    CACHE.sujo = true;
  }
  if (CACHE.sujo) {
    const f = FOG.cv.getContext("2d")!,
      cs = EXPLORA.celula * k;
    f.globalCompositeOperation = "source-over";
    f.clearRect(0, 0, W, H);
    f.fillStyle = "rgba(12,8,4,.8)";
    f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = "destination-out";
    for (const key of vistos()) {
      const cx = (key % 10000) - 5000,
        cy = Math.floor(key / 10000) - 5000;
      f.fillRect(cx * EXPLORA.celula * k, cy * EXPLORA.celula * k, cs + 1, cs + 1);
    }
    f.globalCompositeOperation = "source-over";
    CACHE.sujo = false;
  }
  c.drawImage(FOG.cv, 0, 0);
}
const FOG = { cv: null as HTMLCanvasElement | null };

/** Chamada a cada quadro do mapa: marca em volta de cada herói no mapa e dá pontos de cartógrafo. */
export function explorarQuadro() {
  // no campo de arena (acampamento, treino) as posições não são do mapa; no campo aberto são
  if (dungeon.active && dungeon.mode !== "campo") return;
  for (const h of world.heroes) {
    if (!Number.isFinite(h.x) || !Number.isFinite(h.y)) continue;
    const n = explorarEm(h.x, h.y);
    if (!n) continue;
    const a = (ACUM.get(h.id) ?? 0) + n;
    const pontos = Math.floor(a / EXPLORA.celulasPorPonto);
    ACUM.set(h.id, a - pontos * EXPLORA.celulasPorPonto);
    if (pontos > 0) gainSkill(h, "cartografo", pontos);
  }
}
