/* ==== Fase 4 ====
   dano em 3 tipos (v6.2): a fórmula única (aplicarDano: perfurante/cortante/impacto contra as resistências, com
   penetração da ponta), o mix de cada arma, o perfil de cada bicho, a armadura de uma peça e o fôlego (máximo,
   teto, porcentagem). Saiu de v6.2_dano_tipos */
import { reservaInimigo } from "./folego.ts";
import { DANO, WPN_OF } from "../data/combate.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { eqQ, ensureEquip } from "../items/equipamento.ts";
import type { Hero, Item, Monster } from "../core/tipos.ts";

/** v8.0 — quanto da resistência perfurante a arma `key` (mix `mix`) ignora: a da tabela (lanças) ou, com ≥ 40% de
    perfurante, DANO.PEN_PADRAO (faca, flecha…). */
export function penDe(key: string, mix: number[]) {
  return DANO.PEN[key] ?? ((mix[0] || 0) >= 40 ? DANO.PEN_PADRAO : 0);
}
export function aplicarDano(base: number, mix: number[], res: number[], pen?: number) {
  const parts = [0, 0, 0];
  let tot = 0;
  for (let i = 0; i < 3; i++) {
    const r = Math.min(DANO.TETO, res[i] || 0) * (i === 0 ? 1 - (pen || 0) : 1);
    parts[i] = ((base * (mix[i] || 0)) / 100) * (1 - r / 100);
    tot += parts[i];
  }
  return { total: base >= 1 ? Math.max(1, tot) : tot, parts };
}
function famMix(f: string) {
  return (
    (
      {
        espada: DANO.ARMAS.eq_espada,
        clava: DANO.ARMAS.eq_clava,
        machado: DANO.ARMAS.eq_machado,
        lanca: DANO.ARMAS.eq_lanca,
        faca: DANO.ARMAS.eq_faca,
      } as Record<string, number[]>
    )[f] || DANO.ARMAS.eq_espada
  );
}
export function mixOfKey(k: string | null | undefined) {
  if (!k) return DANO.ARMAS.punho;
  const d = ITEM_DEFS[k];
  return (d && d.mix) || DANO.ARMAS[k] || famMix(WPN_OF[k]);
}
export function mixTxt(mix: string[] | number[]) {
  return DANO.ICO.map((ic, i) => ic + " " + mix[i] + "%").join(" · ");
}
export function monProf(m: Monster | null | undefined) {
  if (!m) return DANO.PERFIS.lobo;
  if (m.prof && DANO.PERFIS[m.prof]) return DANO.PERFIS[m.prof];
  if (m.dummy) return DANO.PERFIS.boneco;
  if (m.boss) return DANO.PERFIS.alfa;
  if (m.kind === "javalino") return DANO.PERFIS.javali;
  return DANO.PERFIS.lobo;
}
export function isMonstro(m: Monster) {
  return !!(m && (m.boss || m.runic));
} // monstros não ficam passivos com arma cravada
export function armorPiece(it: Item | null | undefined) {
  if (!it || !it.def) return [0, 0, 0];
  const A = DANO.ARMADURAS[it.def.key] || (it.def.armor ? { m: it.def.mat || "couro", k: it.def.armor / 0.12 } : null);
  if (!A) return [0, 0, 0];
  const M = DANO.MATERIAIS[A.m] || DANO.MATERIAIS.couro,
    w = DANO.PESO_SLOT[it.def.slot!] || 0,
    q = eqQ(it).stat * (A.k || 1);
  return M.r.map((v) => v * w * q);
}
export function ensureFol(m: Monster) {
  if (m.folMax == null) {
    m.folMax = monProf(m).fol;
    m.fol = m.folMax;
    m.folLost = 0;
    m.folT = 99;
  }
  return m;
}
export function folCap(m: Monster) {
  ensureFol(m);
  return m.folMax! * Math.max(DANO.FOLEGO.tetoMin, Math.min(1, m.folRes ?? 1));
}
/** Reserva de exaustão (0..1): perde um quarto por quebra externa; não regenera. O laço mantém sua reserva. */
export function folTeto(m: Monster) {
  return reservaInimigo(m);
}
export function folPct(m: Monster) {
  ensureFol(m);
  return m.folMax ? m.fol! / m.folMax : 1;
}

/* ---------- armadura: 3 resistências (a fórmula única de dano, os mixes e a armadura por peça: src/field/dano.ts) ---------- */
export function armorRes(h: Hero) {
  const e = ensureEquip(h),
    r = [0, 0, 0];
  for (const s of Object.keys(DANO.PESO_SLOT)) {
    const p = armorPiece(e[s]!);
    for (let i = 0; i < 3; i++) r[i] += p[i];
  }
  return r.map((v) => Math.min(DANO.TETO, v));
}
/** O último dano repartido por tipo (hurtMonsterTipos). */
interface UltimoDano {
  m: Monster;
  parts: number[];
  mix: number[];
  key: string;
  base: number;
  total: number;
}
interface EstadoDMG {
  src: string | null; // de onde veio o golpe (swing, stab, heavy, rip…), lido pelos efeitos
  key: string | null; // chave da arma (DANO.ARMAS)
  att: Monster | null; // o bicho que está atacando (armorRed usa o perfil dele)
  last: UltimoDano | null;
  // acrescentados depois
  _koTip?: number;
}
export const DMG: EstadoDMG = { src: null, key: null, att: null, last: null };

export function plateMult(h: Hero) {
  const e = ensureEquip(h);
  let k = 1;
  for (const s of Object.keys(DANO.PESO_SLOT)) {
    const it = e[s],
      A = it && DANO.ARMADURAS[it.def.key];
    if (A && DANO.MATERIAIS[A.m] && DANO.MATERIAIS[A.m].pesada) k += DANO.PLACA_STAMINA * DANO.PESO_SLOT[s];
  }
  return k;
}
