/* ==== Fase 4 — ícones pintados e números de dano (v5.2, v5.3, v6.3) ==== */
import {
  Q_FRAME,
  ICO_DIAG,
  ATTR_ICO,
  TOAST_ICO,
  CR_ICO,
  WX,
  PX_N,
  MAT_ICO,
  WX_GASTA,
  WX_N,
  RUNA_ICO,
} from "../data/icones.ts";
import { dungeon } from "../core/state.ts";
import { MOB } from "./celular.ts";
import { spearMode } from "../field/armas.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { AN_INFO, AN_ART, GEM_VAR } from "../data/arte.ts";
import { anTokKey, anCard } from "./fichas_animais.ts";
import { gemDecor, gemStage, stoneDecor, meatDecor, matStage } from "../items/arte.ts";
import { eqPct } from "../items/durabilidade.ts";
import { LOOT_VIS } from "../data/campo.ts";
import { CPS, campNear } from "../survival/acampamento.ts";
import { nearestLoot } from "../field/masmorra.ts";
import type { AvisoCampo, Item, ItemDef, LootChao, Ponto, Repasse } from "../core/tipos.ts";
import type { ItemChao } from "../data/expedicao.ts";

/* =====================================================================
   v5.2 — ÍCONES PINTADOS (substituem os emojis onde já existe arte)
   As imagens ficam no <style id="ico-css"> como classes .ico-<chave>.
   icoTag(chave, emojiReserva) devolve o ícone pintado ou, se ainda não
   existir arte, o emoji antigo — assim dá para trocar aos poucos.
===================================================================== */
export const ICOS: Record<string, string> = {}; // chave -> data URI (lido do CSS)
const ICOS_IMG: Record<string, HTMLImageElement> = {};
export function icoHas(k: string | null | undefined) {
  return !!(k && ICOS[k]);
}
export function icoTag(k: string, fb: string, cls?: string) {
  return icoHas(k) ? '<i class="ic ico-' + k + (cls ? " " + cls : "") + '"></i>' : fb || "";
}
export function icoItem(def: ItemDef, cls?: string) {
  return def ? icoTag(icoRuna(def.key) || def.key, def.emoji, cls) : "";
}
/* v7.7 — a runa absorvida aparece como a gema do elemento, mais lapidada quanto melhor o grau (RUNA_ICO) */
export function icoRuna(k: string | null | undefined) {
  if (!k || !k.startsWith("runa_")) return null;
  const p = k.split("_"),
    n = RUNA_ICO[p[1]],
    key = n ? "rn_" + p[2] + "_" + n : null;
  return icoHas(key) ? key : null;
}
export function icoImg(k: string) {
  if (!icoHas(k)) return null;
  let im = ICOS_IMG[k];
  if (!im) {
    im = ICOS_IMG[k] = new Image();
    im.src = ICOS[k];
  }
  return im.complete && im.naturalWidth ? im : null;
}
// desenha no canvas: ícone pintado se houver, senão o emoji
export function icoDraw(
  c: CanvasRenderingContext2D,
  def: ItemChao & Partial<ItemDef>,
  x: number,
  y: number,
  s: number,
  fallbackFont: string,
) {
  const im = def && icoImg(icoRuna(def.key) || def.key!);
  if (im) {
    c.save();
    c.shadowColor = "rgba(0,0,0,.45)";
    c.shadowBlur = 2;
    c.drawImage(im, x - s / 2, y - s / 2, s, s);
    c.restore();
    return true;
  }
  c.font = fallbackFont || Math.round(s * 0.8) + "px serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(def ? def.emoji : "", x, y);
  c.textBaseline = "alphabetic";
  return false;
}
// itens compridos (espada, lança, arco…) ficam na diagonal na arte: na peça comprida do inventário, giramos para preencher
export function icoPiece(this: unknown, e: HTMLDivElement, key: string, bw: number, bh: number, _q?: number | null) {
  // q vai por `arguments` para icoPieceBase2
  /* v6.3 — peça do inventário: a arte é vertical; preenche a peça (gira 90° se a peça estiver deitada) */
  if (!/^wx_/.test(key)) return icoPieceBase2.apply(this, arguments as Repasse);
  const vert = bh >= bw,
    L = Math.max(bw, bh) * 0.94,
    S = Math.min(bw, bh) * 0.94;
  e.textContent = "";
  e.innerHTML =
    '<i class="ic wxi ico-' +
    key +
    '" style="flex:none;width:' +
    S +
    "px;height:" +
    L +
    "px;transform:rotate(" +
    (vert ? 0 : -90) +
    'deg)"></i>';
}
// etapa de icoPiece: v5.2
function icoPieceBase2(e: HTMLDivElement, key: string, bw: number, bh: number, q: number) {
  /* v5.2 */
  icoPieceBase(e, key, bw, bh);
  if (q == null) return;
  const fk = Q_FRAME[q];
  if (!icoHas(fk)) return;
  const f = document.createElement("i");
  f.className = "icf ico-" + fk + (q === 2 ? " boa" : "");
  e.insertBefore(f, e.firstChild);
}
// etapa de icoPiece: original
function icoPieceBase(e: HTMLDivElement, key: string, bw: number, bh: number) {
  const r = Math.max(bw, bh) / Math.min(bw, bh),
    base = ICO_DIAG[key];
  let s = Math.min(bw, bh) * 0.9,
    rot = 0;
  if (base != null && r >= 1.6) {
    s = Math.min(Math.max(bw, bh) * 0.72, Math.min(bw, bh) * 3.4);
    rot = bh > bw ? base : -base;
  } else if (r >= 1.3) s = Math.min(bw, bh) * 1.0;
  e.textContent = "";
  e.innerHTML =
    '<i class="ic ico-' + key + '" style="width:' + s + "px;height:" + s + "px;transform:rotate(" + rot + 'deg)"></i>';
}
// atributos
export function icoAttr(id: string, fb: string) {
  return icoTag(ATTR_ICO[id], fb, "at");
}
// botões de toque (celular)
export function mobIcons() {
  if (typeof MOB === "undefined" || !MOB.on) return;
  const d = dungeon,
    sm = spearMode(),
    bow = d.weapon === "bow";
  const want: Record<string, string[]> = {
    "tb-atk": [bow ? "eq_arco" : "btn_atacar", ""],
    "tb-def": [sm ? "btn_esquiva" : "btn_defender", sm ? "empurrão" : ""],
    "tb-parry": [bow ? "btn_rolar" : sm ? "btn_arremessar" : "btn_parry", bow ? "rolar" : sm ? "arremessar" : "parry"],
    "tb-swap": ["btn_trocar", "trocar"],
    "tb-e": ["btn_interagir", "E"],
    "tb-herb": ["btn_erva", "erva"],
    "tb-inv": ["btn_mochila", ""],
    "tb-sheet": ["btn_ficha", ""],
  };
  for (const id in want) {
    const b = document.getElementById(id);
    if (!b) continue;
    const [k, l] = want[id],
      sig = k + "|" + l;
    if (b.dataset.ik === sig && b.querySelector(".ic")) continue;
    if (!icoHas(k)) continue;
    b.dataset.ik = sig;
    b.innerHTML = icoTag(k, "", "tbi") + (l ? "<small>" + l + "</small>" : "");
  }
  const nav: Record<string, string> = { heroes: "tab_herois", pop: "tab_regiao" };
  document.querySelectorAll("#mob-nav button").forEach((b) => {
    const k = nav[(b as HTMLElement).dataset.t!],
      sp = b.querySelector("span");
    if (k && sp && !sp.querySelector(".ic") && icoHas(k)) sp.innerHTML = icoTag(k, "", "nav");
  });
}
export function icoLootDef(l: LootChao, def: ItemChao & Partial<ItemDef>) {
  if (!def) return def;
  if (def.key) return def;
  const k = def.item || ({ feather: "pena", stone: "pedra" } as Record<string, string>)[def.res!] || l.key;
  return ITEM_DEFS[k] ? Object.assign({}, def, { key: k }) : def;
}

/* ---- v5.3: efeitos, criaturas, árvore, interface e molduras ---- */
export const ICO_EMO: Record<string, string> = {};
export function icoToast(c: CanvasRenderingContext2D, txt: string, x: number, y: number, s: number) {
  let plus = false,
    t = String(txt).trim();
  if (t[0] === "+") {
    plus = true;
    t = t.slice(1).trim();
  }
  let m = TOAST_ICO[t];
  if (!m && ICO_EMO[t]) m = [ICO_EMO[t]];
  if (!m) return false;
  const im = icoImg(m[0]);
  if (!im) return false;
  c.save();
  c.shadowBlur = 0;
  c.shadowColor = "transparent";
  c.drawImage(im, x - s / 2, y - s * 0.8, s, s);
  if (m[1]) {
    const o = icoImg(m[1]);
    if (o) c.drawImage(o, x + s * 0.02, y - s * 0.32, s * 0.52, s * 0.52);
  }
  if (plus) {
    c.font = "900 " + Math.round(s * 0.5) + "px Cinzel, serif";
    c.fillStyle = "#ffe08a";
    c.strokeStyle = "#1c140b";
    c.lineWidth = 3;
    c.textAlign = "right";
    c.strokeText("+", x - s * 0.42, y - s * 0.12);
    c.fillText("+", x - s * 0.42, y - s * 0.12);
  }
  c.restore();
  return true;
}
export function icoCanvas(c: CanvasRenderingContext2D, k: string, x: number, y: number, s: number) {
  const im = icoImg(k);
  if (!im) return false;
  c.drawImage(im, x - s / 2, y - s / 2, s, s);
  return true;
}
// retrato da criatura no painel de detalhes
export function icoPortrait(this: unknown, sp: string | null, sex?: string, coat?: number) {
  /* v5.9.07 */
  icoPortraitBase.call(this, sp);
  const el = document.getElementById("insp-portrait");
  if (!el) return;
  el.classList.remove("an-por");
  el.onclick = null;
  el.title = "";
  const key = sp && sex ? anTokKey(sp, sex, coat!) : null;
  if (key && icoHas(key)) {
    el.className = "ic an-por ico-" + key;
    el.style.display = "";
  }
  if (sp && AN_INFO[sp] && icoHas("por_" + AN_ART[sp])) {
    el.classList.add("an-click");
    el.title = "Abrir a ficha do animal";
    el.onclick = () => anCard(sp, sex!, coat!);
  } else el.classList.remove("an-click");
}
// etapa de icoPortrait: original
function icoPortraitBase(sp: string | null) {
  const nm = document.getElementById("insp-name");
  if (!nm) return;
  let el = document.getElementById("insp-portrait");
  if (!el) {
    el = document.createElement("i");
    el.id = "insp-portrait";
    nm.parentNode!.insertBefore(el, nm);
  }
  const k = sp && CR_ICO[sp];
  el.className = k && icoHas(k) ? "ic ico-" + k : "";
  el.style.display = k && icoHas(k) ? "" : "none";
}
// rótulo da horda: troca os emojis do começo por ícones
export function icoLabel(v: string | number) {
  const map = [
    ["🐺", "cr_lobo"],
    ["👑", "cr_lobo_alfa"],
    ["🧪", "btn_teste"],
    ["🏆", "fx_zona_segura"],
  ];
  let h = String(v).replace(
    /[&<>]/g,
    (ch) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }) as Record<string, string>)[ch],
  );
  for (const [e, k] of map) if (h.startsWith(e) && icoHas(k)) h = icoTag(k, e, "lb") + h.slice(e.length);
  return h;
}

/* ---- v5.3: números de dano legíveis ----
   · golpes seguidos no mesmo alvo (em 0,3 s) somam num número só, que dá um "pulo";
   · sangramento soma num único número vermelho por alvo;
   · números novos abrem em leque (esquerda/direita) e sobem com suavidade;
   · no máximo 5 números por alvo; crítico é dourado, maior e com o ícone de crítico;
   · avisos repetidos (ex.: "Marcado") não empilham. */
export function dmgNumDraw(c: CanvasRenderingContext2D, t: AvisoCampo, dt: number) {
  t.age! += dt;
  t.life -= dt * 0.6;
  const a = t.age!,
    pop = a < 0.1 ? 1 + (1 - a / 0.1) * 0.55 : 1;
  if (t.bump! > 0) t.bump = Math.max(0, t.bump! - dt * 5);
  const sc = pop * (1 + (t.bump || 0) * 0.4),
    fs = Math.max(9, Math.round(t.base! * sc));
  const rise = (t.dot ? 26 : 44) * (1 - Math.pow(1 - Math.min(1, a / 0.85), 3)),
    x = t.x + t.vx! * Math.min(a, 0.7),
    y = t.y - rise;
  c.save();
  c.globalAlpha = Math.max(0, Math.min(1, t.life / 0.4));
  c.font = "900 " + fs + "px Cinzel, Lora, serif";
  c.textAlign = "center";
  c.lineJoin = "round";
  c.lineWidth = Math.max(2, fs * 0.18);
  c.strokeStyle = "rgba(24,12,4,.88)";
  c.strokeText(t.text, x, y);
  c.fillStyle = t.color;
  c.fillText(t.text, x, y);
  if (t.crit) {
    const w = c.measureText(t.text).width;
    icoCanvas(c, "fx_critico", x - w / 2 - fs * 0.5, y - fs * 0.38, fs * 1.05);
  }
  c.restore();
}
// v5.4: fundo das casas mais discreto quando o item tem ícone pintado; moldura também nos espaços de equipamento
export function icoBg(col: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(col || "");
  if (!m) return col;
  const n = parseInt(m[1], 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",.32)";
}
export function icoItemQ(it: Item) {
  const r = icoItemQBase(it);
  /* v6.3 */
  try {
    if (it && it.def && WX[it.def.key]) {
      const k = wxKey(it);
      if (k) return r.replace("ico-" + it.def.key + '"', "ico-" + k + ' wxi"');
    }
  } catch (_) {}
  return r;
}
/* v7.7 — itens que usam um ícone pintado de outro nome (a mochila usa o do botão da mochila) */
const ICO_APELIDO: Record<string, string> = { eq_mochila: "btn_mochila", eq_aljava: "flecha_pacote" };
function icoItemQBase(it: Item) {
  if (!it) return "";
  const k = ICO_APELIDO[it.def.key] || it.def.key;
  if (!icoHas(k)) return it.def.emoji;
  const q = it.def.slot ? (it.q ?? 1) : null, // v7.7: todo equipável tem moldura (a faca vinha sem qualidade)
    fk = q != null ? Q_FRAME[q] : null;
  return (
    '<span class="eqf">' +
    (fk && icoHas(fk) ? '<i class="icf ico-' + fk + (q === 2 ? " boa" : "") + '"></i>' : "") +
    '<i class="ic ico-' +
    k +
    '"></i></span>'
  );
}
export function icoKeyOf(it: Item) {
  if (it && it.def && ICO_APELIDO[it.def.key] && icoHas(ICO_APELIDO[it.def.key])) return ICO_APELIDO[it.def.key];
  /* v7.7 */
  const rn = it && it.def && icoRuna(it.def.key);
  if (rn) return rn;
  /* v6.6 */
  if (it && it.def && it.def.key === "feixe_flechas" && icoHas("flecha_pacote")) return "flecha_pacote";
  /* v6.3 */
  try {
    if (it && it.def && WX[it.def.key]) {
      const k = wxKey(it);
      if (k) return k;
    }
  } catch (_) {}
  /* v5.9.13 */
  if (it && it.def && it.def.key === "tabua" && icoHas("mat_madeira_4")) return "mat_madeira_4";
  /* v5.9.07 */
  try {
    if (it && it.def) {
      const k = it.def.key;
      if (k === "gema") {
        gemDecor(it);
        const s = gemStage(it),
          n = (GEM_VAR[it.gem!] || [])[s] || 0;
        let key = "gem_" + it.gem + "_" + s;
        if (it.gv && n) key = "gx_" + it.gem + "_" + s + "_" + (1 + ((it.gv - 1) % n));
        if (icoHas(key)) return key;
      } else if (k === "pedra_rara") {
        stoneDecor(it);
        const key = "px_" + it.st + "_" + (1 + (it.pv! % (PX_N[it.st!] || 1)));
        if (icoHas(key)) return key;
      } else if (PX_N[k] && !(it.tier | 0) && k !== "prata") {
        stoneDecor(it);
        const key = "px_" + k + "_" + (1 + (it.pv! % PX_N[k]));
        if (icoHas(key)) return key;
      } else if (k === "prata") {
        stoneDecor(it);
        const key = it.tier ? "mat_minerio_" + (it.tier > 1 ? 5 : 3) : "px_prata_" + (1 + (it.pv! % 2));
        if (icoHas(key)) return key;
      } else if (k === "lingote") {
        stoneDecor(it);
        const t = Math.min(2, it.tier | 0),
          key = "lg_" + (t === 2 ? 4 : t * 2 + (it.pv! % 2));
        if (icoHas(key)) return key;
      } else if (k === "pedra") {
        const key = "mat_pedra_" + (it.tier > 1 ? 5 : 4);
        if (icoHas(key)) return key;
      } else if (k === "quartzo" || k === "ametista") {
        const key = k === "quartzo" ? "gem_diamante_" + (it.tier > 1 ? 3 : 2) : "gem_ametista_" + (it.tier > 1 ? 3 : 2);
        if (icoHas(key)) return key;
      } else if (k === "carne") {
        meatDecor(it);
        const key = "meat_" + it.an + "_" + Math.min(5, 1 + (it.tier | 0) * 2);
        if (icoHas(key)) return key;
      } else if (k === "peixe") {
        const key = "meat_peixe_" + Math.min(5, 1 + (it.tier | 0) * 2);
        if (icoHas(key)) return key;
      } else if (k === "carne_assada") {
        meatDecor(it);
        const key = "cooked_" + it.an + (it.cv ? "_" + (it.cv + 1) : "");
        if (icoHas(key)) return key;
      } else if (k === "reliquia" && (it.tier | 0) > 0) {
        // v7.7: relíquia de bronze (comum), prata e turquesa (A+), ouro e rubi (SS)
        const key = "reliquia_" + (1 + Math.min(2, it.tier | 0));
        if (icoHas(key)) return key;
      } else if (k === "presa") {
        const key = "mat_osso_" + (3 + Math.min(2, it.tier | 0));
        if (icoHas(key)) return key;
      } else if (k === "ferro") {
        const key = "mat_minerio_" + [2, 3, 5][Math.min(2, it.tier | 0)];
        if (icoHas(key)) return key;
      } else if (MAT_ICO[k]) {
        const key = "mat_" + MAT_ICO[k] + "_" + matStage(it);
        if (icoHas(key)) return key;
      }
    }
  } catch (_) {}
  if (it && it.def && it.def.key === "flecha") return (it.n || 1) >= 2 ? "flecha_pacote" : "flecha";
  return it && it.def ? it.def.key : null;
}
export function icoSetHTML(el: HTMLElement, html: string) {
  if (el && el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}

/* ==== v6.3 — ícones das armas (variações + gastas/quebradas), chão só com folhama/pedra/erva, ícone do chão só de perto, menos texto em tela ==== */
export function wxKey(it: Item) {
  /* v7.3b */
  if (it && it.def && it.def.key === "eq_lanca_madeira") return icoHas("wx_lanca_1") ? "wx_lanca_1" : null;
  const W = WX[it.def.key];
  if (!W) return null;
  if (!it.wv) it.wv = 1 + Math.floor(Math.random() * 997);
  let worn = it.def.key === "eq_faca_velha";
  try {
    if (!worn && it.durMax) worn = eqPct(it) < WX_GASTA;
  } catch (_) {}
  const base = W[worn ? 1 : 0],
    n = WX_N[base] || 0;
  if (!n) return null;
  const k = base + "_" + (1 + ((it.wv - 1) % n));
  return icoHas(k) ? k : null;
}
/* ícone do item no chão: só aparece de perto */
export function lootVis(l: Ponto) {
  const d = dungeon,
    T = d.tile,
    k = Math.hypot(l.x - d.px, l.y - d.py) / T;
  return k <= LOOT_VIS.perto ? 1 : k >= LOOT_VIS.some ? 0 : 1 - (k - LOOT_VIS.perto) / (LOOT_VIS.some - LOOT_VIS.perto);
}
/* dica de controles: só na 1ª expedição, por 8 s (o ❔ mostra de novo) */
/* E: perto de duas coisas, vale a MAIS PERTO (ex.: pedra no chão x fogueira) */
function campStationDist(n: string) {
  const d = dungeon,
    P = (
      { fire: CPS.fire, anvil: CPS.anvil, tools: CPS.tools, mesa: CPS.mesa, hunter: CPS.hunter } as Record<
        string,
        Ponto | null
      >
    )[n];
  return P ? Math.hypot(d.px - P.x, d.py - P.y) : 1e9;
}
export function eLootFirst() {
  const d = dungeon;
  if (!d.active || !d.camp || d.dead || d.invOpen || d.modalOpen) return null;
  const n = campNear();
  if (!n) return null;
  const l = nearestLoot();
  if (!l) return null;
  return Math.hypot(l.x - d.px, l.y - d.py) < campStationDist(n) ? l : null;
}
