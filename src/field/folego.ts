import type { Dungeon, Monster } from "../core/tipos.ts";
import { FOL_HEROI, EXAUSTAO } from "../data/combate.ts";

/** Uma quebra exige a transição positivo → zero; chamadas com a barra vazia não repetem a perda. */
export function consumirFolegoExterno(d: Pick<Dungeon, "gstam" | "gint" | "gregen">, custo: number, espera = 0) {
  const antes = d.gstam ?? 100;
  if (!(custo > 0)) return false;
  d.gstam = Math.max(0, antes - custo);
  d.gregen = Math.max(d.gregen || 0, espera);
  const quebrou = antes > 0 && d.gstam === 0;
  if (quebrou) d.gint = Math.max(0, (d.gint ?? 100) - FOL_HEROI.perdaInterna * 100);
  return quebrou;
}

/** Curva contínua por quartos da reserva, em ordem 0%, 25%, 50%, 75%, 100%. */
export function fatorCorrida(interno: number) {
  const p = Math.max(0, Math.min(1, interno / 100)) * 4,
    i = Math.min(3, Math.floor(p)),
    v = FOL_HEROI.corrida;
  return v[i] + (v[i + 1] - v[i]) * (p - i);
}

export function reservaInimigo(m: Monster) {
  return Math.max(0, Math.min(1, 1 - (m.quebrasFolego ?? m.quedas ?? 0) * EXAUSTAO.perdaInterna, m.folRes ?? 1));
}

/** Reduz a eficácia das reações defensivas existentes, sem mexer nas resistências ao dano. */
export function defesaFolego(m: Monster) {
  const r = reservaInimigo(m);
  return EXAUSTAO.defesa[r > 0.5 ? 0 : r > 0.25 ? 1 : r > 0 ? 2 : 3];
}
