/* ==== Fase 4 — atributos do herói, afixos dos itens e status derivados (v5.0) ==== */
import { AF_POOL, AF_DEFS, STAT } from "../data/atributos.ts";
import { ensureEquip, armorRed } from "../items/equipamento.ts";
import { EQ_SLOTS } from "../data/equipamento.ts";
import { profLv, profWeapon } from "./proficiencias.ts";
import { MARK_BONUS, DANO, COMBO, KNIFE_KEYS, WPN_OF } from "../data/combate.ts";
import { fatorBasico } from "../items/dano_medio.ts";
import { eqWeaponMult, eqBowMult, eqDurInit } from "../items/durabilidade.ts";
import { wpnProf, wpnKey } from "../field/armas.ts";
import { armorRes, mixTxt, mixOfKey, plateMult } from "../field/dano.ts";
import { icoAttr } from "../ui/icones.ts";
import { dungeon } from "../core/state.ts";
import { survDmgMult } from "../survival/sobrevivencia.ts";
import { ATTR_ICO } from "../data/icones.ts";
import type { Hero, Item } from "../core/tipos.ts";

/* ---------- atributos nos itens (afixos) ---------- */
export function afRoll(it: Item) {
  const q = it.q == null ? 1 : it.q,
    n = q >= 3 ? 2 : q === 2 ? 1 : q === 1 ? (Math.random() < 0.4 ? 1 : 0) : 0,
    af: Record<string, number> = {};
  const pool = (AF_POOL[it.def.slot!] || ["constituicao"]).slice();
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    for (let j = pool.length - 1; j >= 0; j--) if (pool[j] === k) pool.splice(j, 1);
    af[k] =
      k === "crit" ? (q >= 3 ? 0.05 : 0.03) : k === "vida" ? (q >= 3 ? 10 : 6) : q >= 3 && Math.random() < 0.5 ? 2 : 1;
  }
  return af;
}

export function afText(it: Item, sep?: string) {
  if (!it || !it.af) return "";
  return Object.entries(it.af)
    .map(([k, v]) => (AF_DEFS[k] ? AF_DEFS[k].ic + " " + AF_DEFS[k].fmt(v) + " " + AF_DEFS[k].n : ""))
    .filter(Boolean)
    .join(sep || " · ");
}

/* =====================================================================
   v5.0 — ATRIBUTOS NOS ITENS · EQUILÍBRIO DOS STATUS · SALA DE TREINO
   · Atributo efetivo = nascimento + itens equipados (+ ajuste de teste na Sala de Treino).
   · Fórmulas centralizadas em STAT (mude um número aqui e o jogo inteiro segue).
   · Sala de Treino: boneco que não morre, medidor de dano/DPS, troca de armas,
     ajuste temporário de atributos e lobo de treino (você não morre).
===================================================================== */
export function mastMult(lv: number) {
  return 1 + STAT.mastK * Math.pow(Math.max(0, lv || 0), STAT.mastP);
}
function eqAll(h: Hero) {
  const e = ensureEquip(h),
    o: Item[] = [];
  for (const s of EQ_SLOTS) if (e[s.id]) o.push(e[s.id]!);
  return o;
}
export function afSum(h: Hero, k: string) {
  let v = 0;
  for (const it of eqAll(h)) if (it.af && it.af[k]) v += it.af[k];
  return v;
}
export function attrBase(h: Hero, id: string) {
  return (h && h.attrs && h.attrs[id]) || 0;
}
export function attrOf(h: Hero, id: string) {
  if (!h) return 5;
  return attrBase(h, id) + afSum(h, id) + ((h._trAttr && h._trAttr[id]) || 0);
}
export function critChance(h: Hero) {
  return Math.min(STAT.critMax, STAT.desCritBase + attrOf(h, "destreza") * STAT.desCrit + afSum(h, "crit"));
}
export function forMult(h: Hero) {
  return 1 + STAT.forMelee * (attrOf(h, "forca") - 5);
}
function desBowMult(h: Hero) {
  return 1 + STAT.desBow * (attrOf(h, "destreza") - 5);
}
export function hpMaxOf(h: Hero) {
  const extra = (h.hpMax || 0) - (36 + attrBase(h, "constituicao") * STAT.conHp);
  return Math.round(36 + attrOf(h, "constituicao") * STAT.conHp + afSum(h, "vida") + Math.max(0, extra));
}

/* ---------- status derivados (ficha e Sala de Treino) ---------- */
export function heroStats(h: Hero) {
  const sw = profLv(h, profWeapon(h)),
    bw = (h.skills.arco && h.skills.arco.level) || 0,
    e = ensureEquip(h);
  const melee = eqWeaponMult(h) * 2.6 * forMult(h) * mastMult(sw),
    W = wpnProf(h),
    k = wpnKey(h),
    combo3 = !k || !(KNIFE_KEYS.includes(k) || WPN_OF[k] === "faca" || WPN_OF[k] === "clava"); // tem o 3º golpe do combo
  const bow = 7 * desBowMult(h) * mastMult(bw) * 1.5 * (e.costas ? eqBowMult(h) : 1),
    v = attrOf(h, "velocidade");
  return {
    melee: melee * fatorBasico(k), // v7.7: o golpe básico de verdade (o mesmo número da arma); era só × família
    finisher: combo3 ? melee * W.mult * COMBO[2].mult : null,
    bow,
    crit: critChance(h),
    atk: Math.max(0, v - 5) * STAT.velAtk,
    move: 26 + v * STAT.velMove,
    hp: hpMaxOf(h),
    def: attrOf(h, "constituicao") * STAT.conDef,
    armor: armorRed(h),
    mark: (typeof MARK_BONUS !== "undefined" ? MARK_BONUS : 1.5) + Math.max(0, attrOf(h, "destreza") - 5) * 0.03,
    regen: 0.12 + attrOf(h, "constituicao") * 0.025,
  };
}
export function statsHtml(h: Hero) {
  const s = statsHtmlBase(h);
  /* v6.2 */
  try {
    const r = armorRes(h),
      pm = plateMult(h);
    const row =
      '<div class="st-row" title="Soma das peças (peito ×1 · elmo ×0,5 · calça ×0,4 · botas ×0,25), teto de ' +
      DANO.TETO +
      '% por tipo"><span>🛡 Resistências</span><b>' +
      DANO.ICO.map((ic, i) => ic + " " + Math.round(r[i]) + "%").join(" · ") +
      "</b></div>" +
      (pm > 1.001
        ? '<div class="st-row" title="Peças de placa pesam: bloquear, correr e empurrar gastam mais stamina"><span>⚖ Placa</span><b>+' +
          Math.round((pm - 1) * 100) +
          "% stamina</b></div>"
        : "") +
      '<div class="st-row" title="Perfurante / cortante / impacto da arma da mão direita"><span>⚔ Tipo de dano</span><b>' +
      mixTxt(mixOfKey(wpnKey(h)!)) +
      "</b></div>";
    return s.replace(/<\/div>\s*$/, row + "</div>");
  } catch (_) {
    return s;
  }
}
function statsHtmlBase(h: Hero) {
  const S = heroStats(h),
    r = (a: string, b: string | number, c: string) =>
      '<div class="st-row" title="' + c + '"><span>' + a + "</span><b>" + b + "</b></div>";
  return (
    '<div class="st-box"><div class="st-h">📊 Status em combate</div>' +
    r(
      "⚔ Dano por golpe",
      S.melee.toFixed(1) + (S.finisher != null ? " · 3º: " + S.finisher.toFixed(1) : ""),
      "Média do golpe básico com a arma da mão direita (sem crítico). 💪 Força +6%/ponto · maestria da arma",
    ) +
    r(
      "🏹 Flecha (carga cheia)",
      S.bow.toFixed(1),
      "Média com a corda toda puxada. 🎯 Destreza +5%/ponto · maestria do arco",
    ) +
    r("💥 Crítico", Math.round(S.crit * 100) + "% · ×" + STAT.critMult, "2% + 1% por ponto de Destreza + itens") +
    r("⏱ Vel. de ataque", "+" + Math.round(S.atk * 100) + "%", "👟 Velocidade: +3% por ponto acima de 5") +
    r("👟 Movimento", Math.round(S.move) + " px/s", "26 + 3,2 por ponto de Velocidade") +
    r(icoAttr("vida", "❤") + " HP máximo", S.hp, "36 + 6 por ponto de Constituição + itens") +
    r(
      "🛡 Defesa",
      "−" + S.def.toFixed(1) + " por golpe · −" + Math.round(S.armor * 100) + "%",
      "🫀 Constituição tira um pouco de cada golpe; a armadura reduz em %",
    ) +
    r("🎯 Alvo marcado", "×" + S.mark.toFixed(2), "Bônus contra o lobo marcado: +3% por ponto de Destreza acima de 5") +
    "</div>"
  );
}

export function bowBaseDmg(h: Hero, lv: number) {
  /* v5.9 */
  return bowBaseDmgBase(h, lv) * (dungeon.active && dungeon.hero === h ? survDmgMult() : 1);
}
// etapa de bowBaseDmg: original
function bowBaseDmgBase(h: Hero, arcoLv: number) {
  return (5.8 + Math.random() * 2.4) * desBowMult(h) * mastMult(arcoLv);
}
export function afHtml(it: Item) {
  if (it && it.def && it.def.slot) eqDurInit(it);
  if (!it || !it.af || !Object.keys(it.af).length) return "";
  const t = Object.entries(it.af)
    .map(([k, v]) =>
      AF_DEFS[k]
        ? (ATTR_ICO[k] ? icoAttr(k, AF_DEFS[k].ic) : AF_DEFS[k].ic) + " " + AF_DEFS[k].fmt(v) + " " + AF_DEFS[k].n
        : "",
    )
    .join(" · ");
  return '<span style="font-size:.7rem;color:#9fe3a0">' + t + "</span>";
}
export function afBonusTag(h: Hero, id: string) {
  const b = afSum(h, id) + ((h._trAttr && h._trAttr[id]) || 0);
  return b
    ? ' <small style="color:' + (b > 0 ? "#3f8a2a" : "#b0402a") + '">' + (b > 0 ? "+" : "") + b + "</small>"
    : "";
}
