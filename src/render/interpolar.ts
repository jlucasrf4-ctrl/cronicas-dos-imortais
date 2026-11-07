/* ==== v7.7 — movimento fluido no mapa: interpolação entre os passos da simulação (documento mestre 7.3) ====
   A simulação anda em passos (CONFIG.TICKS_PER_SEC_BASE = 4 por segundo em 1x): heróis andando até um clique, bichos e
   aves mudavam de lugar 4 vezes por segundo, aos pulinhos, e a câmera que segue a heroína perseguia um alvo que
   saltava. Agora, antes de cada passo guarda-se onde cada um estava e, ao desenhar, cada um aparece no ponto entre o
   passo anterior e o atual, na fração de tempo que já passou (alfa). A simulação não muda: só o desenho fica até um
   passo atrás. Quem foi movido fora dos passos (WASD, teletransporte, entrar no acampamento) aparece onde está.
   As posições ficam num WeakMap, fora dos objetos do mundo (não entram no save). */
import { world } from "../core/state.ts";

interface Rastro {
  px: number; // antes do último passo
  py: number;
  tx: number; // depois do último passo
  ty: number;
  rx?: number; // a posição real, guardada enquanto o desenho usa a visual
  ry?: number;
  vx: number; // a última posição visual desenhada
  vy: number;
}
type Movel = { x: number; y: number };
const R = new WeakMap<Movel, Rastro>();
/** Pulo maior que isso num passo (teletransporte) não é interpolado. */
const PULO = 60;

function moveis(f: (e: Movel) => void) {
  for (const h of world.heroes) if (h.state !== "indungeon") f(h);
  for (const a of world.animals) if (a.alive) f(a);
  for (const w of world.wild || []) if (w.alive) f(w);
}
/** Antes de cada passo da simulação: onde cada um estava. */
export function antesDoPasso() {
  moveis((e) => {
    const r = R.get(e);
    if (r) {
      r.px = e.x;
      r.py = e.y;
    } else R.set(e, { px: e.x, py: e.y, tx: e.x, ty: e.y, vx: e.x, vy: e.y });
  });
}
/** Depois dos passos do quadro: onde cada um ficou. */
export function depoisDosPassos() {
  moveis((e) => {
    const r = R.get(e);
    if (r) {
      r.tx = e.x;
      r.ty = e.y;
    }
  });
}
/** Põe cada um na posição visual (alfa = fração do passo atual, 0..1) para desenhar; voltarReal() desfaz. */
export function usarVisual(alfa: number) {
  const k = Math.max(0, Math.min(1, alfa));
  moveis((e) => {
    const r = R.get(e);
    if (!r) return;
    r.rx = undefined;
    // mexido fora dos passos (WASD, teletransporte): aparece onde está
    if (e.x !== r.tx || e.y !== r.ty || Math.abs(r.tx - r.px) + Math.abs(r.ty - r.py) > PULO) {
      r.vx = e.x;
      r.vy = e.y;
      return;
    }
    r.rx = e.x;
    r.ry = e.y;
    e.x = r.vx = r.px + (r.tx - r.px) * k;
    e.y = r.vy = r.py + (r.ty - r.py) * k;
  });
}
export function voltarReal() {
  moveis((e) => {
    const r = R.get(e);
    if (!r || r.rx === undefined) return;
    e.x = r.rx;
    e.y = r.ry!;
    r.rx = undefined;
  });
}
/** Onde `e` apareceu no último desenho (para a câmera seguir sem tremer); sem registro, a posição real. */
export function posVisual(e: Movel) {
  const r = R.get(e);
  return r ? { x: r.vx, y: r.vy } : { x: e.x, y: e.y };
}
