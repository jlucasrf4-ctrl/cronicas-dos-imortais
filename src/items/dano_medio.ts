/* ==== v7.7 — DPS da arma: o número inteiro no círculo (mochila e dica) ====
   Só mostra; não muda a conta do dano. É o dano por segundo da arma sozinha, atacando sem parar, com uma heroína
   padrão (atributos 5, maestria 0, sem fome), sem crítico e sem a resistência do alvo: espada/machado/lança = o
   combo de 3 inteiro, clava = carregar + o combo de 2, faca = os 2 cortes alternados, arco = carga cheia parado +
   a recarga. O dano médio do golpe básico fica na ficha (mesa de análise) e na ficha da heroína (statsHtml). */
import { COMBO, CLAVA_COMBO, CLAVA_CD, DANO, FACA2, HV, KNIFE_KEYS, WPN, WPN_OF } from "../data/combate.ts";
import { eqQ } from "./equipamento.ts";
import type { Item } from "../core/tipos.ts";

/* médias dos sorteios: meleeDmgBase = 2 + 0..1,2 · bowBaseDmgBase = 5,8 + 0..2,4 · carga cheia = 0,45 + 1,05;
   arco: a corda enche em 1,1 s parado (updateCharge) e o tiro deixa 0,5 s de recarga (releaseShot) */
const MEDIA = { golpe: 2.6, flecha: 7, carga: 1.5, arcoCarga: 1.1, arcoCd: 0.5 };
const soma = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** Quanto o golpe básico da arma `k` multiplica o dano corpo a corpo (meleeDmg). Sem arma = soco, que usa o combo. */
export function fatorBasico(k: string | null | undefined) {
  if (k && (KNIFE_KEYS.includes(k) || WPN_OF[k] === "faca")) return FACA2.mult;
  const fam = (k && WPN_OF[k]) || "espada",
    W = WPN[fam] || WPN.espada;
  return W.mult * (fam === "clava" ? CLAVA_COMBO[0] : COMBO[0].mult);
}
function ehArco(it: Item) {
  return it.def.slot === "costas";
}
export function ehArma(it: Item | null | undefined) {
  return !!(it && it.def && (it.def.slot === "maoD" || it.def.slot === "costas"));
}
/** Dano médio do golpe básico (ou da flecha com carga cheia); null se não for arma. */
export function danoMedio(it: Item | null | undefined) {
  if (!it || !ehArma(it)) return null;
  const q = (it.def.dmg || 1) * eqQ(it).stat;
  if (ehArco(it)) return MEDIA.flecha * MEDIA.carga * q;
  return MEDIA.golpe * q * fatorBasico(it.def.key);
}
/** Dano por segundo atacando sem parar (o número do círculo, inteiro); null se não for arma. */
export function dpsArma(it: Item | null | undefined) {
  if (!it || !ehArma(it)) return null;
  const q = (it.def.dmg || 1) * eqQ(it).stat,
    k = it.def.key;
  let v;
  if (ehArco(it)) v = (MEDIA.flecha * MEDIA.carga * q) / (MEDIA.arcoCarga + MEDIA.arcoCd);
  else if (KNIFE_KEYS.includes(k) || WPN_OF[k] === "faca")
    v = (MEDIA.golpe * q * FACA2.mult * (1 + FACA2.segundo)) / (2 * FACA2.cd);
  else {
    const fam = WPN_OF[k] || "espada",
      W = WPN[fam] || WPN.espada;
    v =
      fam === "clava"
        ? (MEDIA.golpe * q * W.mult * soma(CLAVA_COMBO)) / (HV.clubL.dur + CLAVA_CD)
        : (MEDIA.golpe * q * W.mult * soma(COMBO.map((c) => c.mult))) / (W.cd * soma(COMBO.map((c) => c.cd)));
  }
  return Math.max(1, Math.round(v));
}
export function danoTxt(v: number) {
  return v.toFixed(1).replace(".", ",");
}
/** O mix de tipos que a arma causa (o arco causa o da flecha). */
export function mixDaArma(it: Item) {
  return ehArco(it) ? DANO.ARMAS.flecha : null;
}
/** O círculo com o DPS, na cor da qualidade. */
export function seloDano(it: Item, cls: string) {
  const v = dpsArma(it);
  if (v == null) return "";
  const c = eqQ(it).col;
  return (
    "<span class='" + cls + "' style='border-color:" + c + ";color:" + c + "' title='Dano por segundo'>" + v + "</span>"
  );
}
