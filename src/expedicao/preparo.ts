/* ==== Fase 4 — preparo da expedição, nome aleatório e a aljava 5×3 (base/08) ==== */
import { ALJAVA, MOCHILA } from "../data/itens.ts";
import { placeIn } from "../items/equipamento.ts";
import { temAljava } from "../items/mochilas.ts";
import {
  QUIVERS,
  QV_STACK,
  QV_ROWS,
  RES_KEY,
  ARROW_STOCK_MAX,
  ARROW_PACKS,
  HERB_PACKS,
  FOLH_PACK,
} from "../data/recursos.ts";
import { econ, dungeon, world, OPT, TELAS, camera } from "../core/state.ts";
import { ensureInv, stoneToast, packFix, INV } from "../items/inventario.ts";
import { tryAddToInv, tryAddItem, renderInv } from "../field/chao.ts";
import { prep, bag, updateEcon } from "../econ/economia.ts";
import { isArrowIt, qvPlace, qvSync } from "../items/aljava.ts";
import { mkItem, ensureEquip, renderEqSlots, armorRed } from "../items/equipamento.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { stoneDecor } from "../items/arte.ts";
import { STONES } from "../data/arte.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mapFloat } from "../map/caca.ts";
import { FX_ICO } from "../data/icones.ts";
import { spawnDungeonToast, fitDungeonCanvas, playTransition, setupDungeon } from "../field/masmorra.ts";
import { allWeaponsPrice, allWeaponKeys, buyAllWeapons, closeCraft, pay } from "../econ/armaria.ts";
import { mnt, mountXp } from "../creatures/tamandua.ts";
import { esc } from "../core/util.ts";
import { ensureHero } from "../hero/nivel.ts";
import { EQ_SLOTS } from "../data/equipamento.ts";
import { eqPct } from "../items/durabilidade.ts";
import { icoTag } from "../ui/icones.ts";
import { prepBolsasMudaram, prepGradesBolsas, prepTela } from "../ui/preparo_tela.ts";
import { idLine, attrLine } from "../ui/ficha.ts";
import { ropeItem } from "../field/faca_corda.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { ISC, introObj, introToMap, iscSkip } from "../intro/cena.ts";
import { CT } from "../intro/tutorial.ts";
import { CPS, camZoomTo, campClose } from "../survival/acampamento.ts";
import { vilaFechar } from "../map/vila_cena.ts";
import { MAPCTL } from "../map/controle.ts";
import { cacadaRetomar } from "../map/cacada.ts";
import { mapZoomLimit, JOGO } from "../ui/modos.ts";
import { constrainCamera, applyCameraTransform, resizeCanvas } from "../map/camera.ts";
import { trainRestore, trainHud } from "../field/treino.ts";
import { saveTo } from "../save/salvar.ts";
import { NAME_A, NAME_B, NAME_C } from "../data/herois.ts";
import { closeBag } from "../ui/janelas.ts";
import { refillQuiver } from "../render/sprites.ts";
import { campanhaEvento } from "../campanha/campanha.ts";
import { loboNaSaida } from "../campanha/lobos.ts";
import { mundoSaida } from "../map/mundo.ts";
import type { Hero, InvGrid, Item, Repasse } from "../core/tipos.ts";

export function drawPrepPortrait(h: Hero, cvOpt?: HTMLCanvasElement, bare?: boolean) {
  const cv = cvOpt || (document.getElementById("prep-portrait") as HTMLCanvasElement),
    c = cv.getContext("2d")!,
    W = cv.width,
    H = cv.height,
    cx = W / 2,
    ol = "#1c140b";
  if (!bare) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3a2d1c");
    g.addColorStop(1, "#150f08");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(0,0,0,.4)";
    c.beginPath();
    c.ellipse(cx, H - 14, 38, 7, 0, 0, 6.283);
    c.fill();
  }
  c.lineWidth = 2;
  c.strokeStyle = ol;
  // arco nas costas
  c.strokeStyle = "#8a5a2b";
  c.lineWidth = 3;
  c.beginPath();
  c.arc(cx + 6, 96, 56, -1.0, 1.0);
  c.stroke();
  c.strokeStyle = ol;
  c.lineWidth = 2;
  // botas
  c.fillStyle = "#5a3a1c";
  c.fillRect(cx - 21, H - 34, 17, 20);
  c.strokeRect(cx - 21, H - 34, 17, 20);
  c.fillRect(cx + 4, H - 34, 17, 20);
  c.strokeRect(cx + 4, H - 34, 17, 20);
  // calça
  c.fillStyle = "#4a5a7a";
  c.fillRect(cx - 20, H - 78, 16, 46);
  c.strokeRect(cx - 20, H - 78, 16, 46);
  c.fillRect(cx + 4, H - 78, 16, 46);
  c.strokeRect(cx + 4, H - 78, 16, 46);
  // aljava nas costas
  c.save();
  c.translate(cx - 26, 88);
  c.rotate(-0.35);
  c.fillStyle = "#6b4a1f";
  c.fillRect(-5, -20, 10, 38);
  c.strokeRect(-5, -20, 10, 38);
  c.fillStyle = "#e8dcc0";
  for (let i = 0; i < 3; i++) c.fillRect(-4 + i * 3.5, -27, 2, 9);
  c.restore();
  // tronco / armadura
  c.fillStyle = h.color;
  c.beginPath();
  c.moveTo(cx - 27, H - 74);
  c.quadraticCurveTo(cx - 31, 84, cx - 17, 70);
  c.lineTo(cx + 17, 70);
  c.quadraticCurveTo(cx + 31, 84, cx + 27, H - 74);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(0,0,0,.25)";
  c.fillRect(cx - 27, H - 92, 54, 6);
  c.fillStyle = "#b8962f";
  c.fillRect(cx - 4, H - 94, 8, 10); // cinto
  // cabeça
  c.fillStyle = "#e3b98c";
  c.beginPath();
  c.arc(cx, 52, 19, 0, 6.283);
  c.fill();
  c.stroke();
  c.fillStyle = "#3b2a1a";
  c.beginPath();
  c.arc(cx, 48, 19, Math.PI, 0);
  c.fill();
  c.fillStyle = ol;
  c.fillRect(cx - 8, 52, 3, 3);
  c.fillRect(cx + 5, 52, 3, 3);
  // escudo (mão esquerda do personagem = lado direito da tela)
  c.fillStyle = "#6b6f7a";
  c.beginPath();
  c.moveTo(cx + 26, 84);
  c.lineTo(cx + 52, 84);
  c.lineTo(cx + 52, 108);
  c.quadraticCurveTo(cx + 52, 128, cx + 39, 134);
  c.quadraticCurveTo(cx + 26, 128, cx + 26, 108);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#b8962f";
  c.beginPath();
  c.arc(cx + 39, 106, 6, 0, 6.283);
  c.fill();
  c.stroke();
  // espada (mão direita do personagem = lado esquerdo da tela)
  c.save();
  c.translate(cx - 38, 118);
  c.rotate(0.12);
  c.fillStyle = "#cfd6df";
  c.beginPath();
  c.moveTo(-3, -62);
  c.lineTo(3, -62);
  c.lineTo(4, 0);
  c.lineTo(-4, 0);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#b8962f";
  c.fillRect(-11, 0, 22, 5);
  c.strokeRect(-11, 0, 22, 5);
  c.fillStyle = "#5a3a1c";
  c.fillRect(-2.5, 5, 5, 14);
  c.strokeRect(-2.5, 5, 5, 14);
  c.restore();
}

/* Mochila 02 = aljava unida: grade 3×5 (comum). Pilha de flechas ocupa a coluna inteira (5 casas, até 10 flechas).
   Pedra/Pena/Pena de Águia: 1 casa a cada 4. Itens de 1 casa (erva, gema…) também cabem. Layout automático. */
function qvCols() {
  return Math.ceil(QUIVERS[econ.quiver.type] / QV_STACK) * 2;
}
export function qvInv(h: Hero) {
  let inv = h.inv2;
  if (!inv) inv = h.inv2 = { items: [], qv: true, rows: QV_ROWS, cols: 9 };
  if (inv.auto) qvMigrate(h, inv);
  inv.qv = true;
  // v7.7: sem a aljava no corpo (items/mochilas.ts), a grade dela é 0×0
  const tem = temAljava(h);
  inv.rows = tem ? QV_ROWS : 0;
  inv.cols = tem ? qvCols() : 0;
  inv.hero = h;
  return inv;
}
function qvMigrate(h: Hero, inv: InvGrid) {
  // aljava antiga (layout automático) -> grade livre
  const old = inv.items.slice();
  inv.auto = false;
  inv.qv = true;
  inv.items = [];
  delete inv.fixed;
  delete inv.over;
  inv.cols = qvCols();
  inv.rows = QV_ROWS;
  inv.hero = h;
  for (const it of old) {
    const t = it.tier | 0;
    if (!tryAddToInv(inv, it.def.key, t) && !tryAddToInv(ensureInv(h), it.def.key, t))
      tryAddToInv(econ.stash, it.def.key, t);
  }
}

export function curHero() {
  return dungeon.active
    ? dungeon.hero
    : prep.open
      ? prepHero()
      : prep.launchId
        ? world.heroes.find((x) => x.id === prep.launchId) || null
        : null;
}
export function arrowCap(h: Hero) {
  // capacidade da aljava menos o que não cabe (itens ocupando o espaço dos feixes)
  const cap = QUIVERS[econ.quiver.type];
  if (!h) return cap;
  if (!temAljava(h)) return 0; // v7.7: sem aljava, sem flechas
  const inv = qvInv(h);
  let room = inv.items.filter(isArrowIt).length * QV_STACK;
  const tmp: Item[] = [];
  while (room < cap) {
    const b = mkItem("flecha");
    if (!qvPlace(inv, b)) break;
    tmp.push(b);
    room += QV_STACK;
  }
  if (tmp.length) inv.items = inv.items.filter((i) => tmp.indexOf(i) < 0);
  return Math.min(cap, room);
}
export function tryAddQuiver(h: Hero, key: string, tier?: number) {
  return !!ITEM_DEFS[key] && tryAddToInv(qvInv(h), key, tier);
}
export function qvRelayout(h: Hero) {
  // reescrita na v5.5
  const inv = qvInv(h);
  qvSync(h);
  inv.fixed = [];
  return inv;
}
/* recursos (pedra, pena, pena de águia) são itens empilháveis (até 4 por casa) e podem ir livremente entre mochila e aljava */
export function resCount(h: Hero, k: string) {
  if (!h) return 0;
  const L = h.loot || {};
  if (k === "wood") return L.wood || 0;
  const key = RES_KEY[k];
  let n = L[k] || 0;
  for (const inv of [h.inv, h.inv2]) if (inv) for (const it of inv.items) if (it.def.key === key) n += it.n || 1;
  return n;
}
function placeRes(h: Hero, key: string, n: number) {
  // v7.7: mochila primeiro; a aljava só quando a mochila não tiver lugar (pedras e penas iam direto para a aljava)
  for (const inv of [ensureInv(h), qvInv(h)])
    if (tryAddToInv(inv, key, 0)) {
      inv.items[inv.items.length - 1].n = n;
      return true;
    }
  return false;
}
export function resAdd(h: Hero, k: string, n: number, strict?: boolean) {
  const r = resAddBase(h, k, n, strict);
  /* v5.9.07 */
  try {
    if (
      !r &&
      k === "stone" &&
      h &&
      (n || 1) > 0 &&
      Math.random() < 0.06 * Math.min(3, n || 1) &&
      tryAddItem(h, "pedra_rara", Math.random() < 0.12 ? 1 : 0)
    ) {
      const it = stoneDecor(ensureInv(h).items[ensureInv(h).items.length - 1]);
      const msg = "🔶 " + h.name + " achou " + STONES[it.st!].n + " no meio das pedras!";
      if (dungeon.active && dungeon.hero === h && !stoneToast(it))
        spawnDungeonToast(STONES[it.st!].n + "!", dungeon.px, dungeon.py - 30, "#ffb36a");
      pushEvent(msg);
    }
  } catch (_) {}
  /* v5.9.13 */
  try {
    if (!r && n > 0 && k !== "wood") mapFloat(h, "+" + n, FX_ICO[k] || k);
  } catch (_) {}
  /* v6.5 */
  try {
    packFix(ensureInv(h));
    packFix(qvInv(h));
  } catch (_) {}
  return r;
}
function resAddBase(h: Hero, k: string, n: number, strict?: boolean) {
  h.loot = h.loot || {};
  if (k === "wood") {
    h.loot.wood = (h.loot.wood || 0) + n;
    return 0;
  }
  const key = RES_KEY[k],
    def = ITEM_DEFS[key];
  for (const inv of [ensureInv(h), qvInv(h)])
    // v7.7: completa primeiro as pilhas da mochila
    for (const it of inv.items) {
      if (n <= 0) break;
      if (it.def.key !== key) continue;
      const r = Math.min(def.stack! - (it.n || 1), n);
      if (r > 0) {
        it.n = (it.n || 1) + r;
        n -= r;
      }
    }
  while (n > 0) {
    const c = Math.min(def.stack!, n);
    if (!placeRes(h, key, c)) break;
    n -= c;
  }
  if (n > 0 && !strict) {
    h.loot[k] = (h.loot[k] || 0) + n;
    n = 0;
  } // sem espaço: fica à parte até liberar casas
  return n;
}
function settleRes(h: Hero) {
  if (!h || !h.loot) return;
  for (const k of ["stone", "feather", "eagle"]) {
    const c = h.loot[k] || 0;
    if (c > 0) {
      h.loot[k] = 0;
      resAdd(h, k, c);
    }
  }
}
export function renderQuiverPanels() {
  const h =
    dungeon.active && dungeon.invOpen
      ? dungeon.hero
      : prep.open
        ? prepHero()
        : bag.open
          ? world.heroes.find((x) => x.id === bag.heroId)
          : null;
  if (!h) return;
  settleRes(h);
  qvRelayout(h);
  const q = econ.quiver,
    L = h.loot || {},
    pre = dungeon.active && dungeon.invOpen ? "inv" : prep.open ? "prep" : "bag",
    set = (id: string, t: string) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = t;
    };
  const over = (L.stone || 0) + (L.feather || 0) + (L.eagle || 0);
  set(
    pre + "-qvhead",
    "<b>" +
      (pre === "inv" ? "🏹 Mochila 02 · " : "") +
      "Aljava " +
      q.type +
      "</b> · flechas " +
      q.n +
      "/" +
      arrowCap(h) +
      (econ.arrowStock ? ' <span class="qv-res">(+' + econ.arrowStock + " na reserva)</span>" : "") +
      ' <span class="qv-res">· Ctrl+clique move entre as mochilas · arraste os pacotes de flechas para organizar (R gira)</span>',
  );
  set(
    pre + "-qvmat",
    "⛺ No acampamento: 🔥 " +
      (L.wood || 0) +
      " lenha · 🥩 " +
      (L.meat || 0) +
      ' comida <span class="qv-res">(clique num galho ou carne para enviar)</span>' +
      (over ? " · ⚠ " + over + " pedra/pena sem espaço (libere casas)" : ""),
  );
}
/** v7.7 — onde o painel de preparo morava antes de abrir na tenda do acampamento (volta para lá ao fechar). */
const PREP_CASA: { pai: HTMLElement | null; depois: ChildNode | null } = { pai: null, depois: null };
export function prepHero() {
  return world.heroes.find((x) => x.id === prep.heroId);
}
export function closePrep() {
  prep.open = false;
  INV.invDrag = null;
  INV.invGrids = [];
  document.getElementById("prep-modal")!.classList.remove("open");
  if (dungeon.active && dungeon.camp) dungeon.modalOpen = false; // v7.7: fechou o preparo da tenda
  if (PREP_CASA.pai) {
    PREP_CASA.pai.insertBefore(document.getElementById("prep-modal")!, PREP_CASA.depois);
    PREP_CASA.pai = null;
  }
  updateEcon();
}
export function renderPrep(this: unknown) {
  const r = renderPrepBase2.apply(this, arguments as Repasse);
  /* v5.9.07 */
  try {
    const s = document.getElementById("prep-shop");
    if (s && !s.querySelector("[data-allw]")) {
      const free = econ.test,
        p = allWeaponsPrice(),
        b = document.createElement("button");
      b.className = "btn allw";
      b.dataset.allw = "1";
      b.textContent = "⚔ Todas as armas (" + allWeaponKeys().length + ") — " + (free ? "grátis" : p + "💰");
      b.title =
        "Uma de cada arma do jogo, qualidade Comum: " +
        allWeaponKeys()
          .map((k) => ITEM_DEFS[k].name)
          .join(", ");
      if (!free && (econ.gold || 0) < p) b.disabled = true;
      b.onclick = (e) => {
        e.stopPropagation();
        buyAllWeapons();
      };
      s.appendChild(b);
    }
  } catch (_) {}
  /* v7.7 — mochila e aljava extras (items/mochilas.ts): vazias, vão para o baú; com elas dá para trocar a cheia */
  try {
    const s = document.getElementById("prep-shop");
    if (s && !s.querySelector("[data-mochila]"))
      for (const [k, ico, nome, preco] of [
        ["eq_mochila", "🎒", "Mochila", MOCHILA.preco],
        ["eq_aljava", "🏹", "Aljava", ALJAVA.preco],
      ] as const) {
        const free = econ.test,
          b = document.createElement("button");
        b.className = "btn";
        b.dataset.mochila = k;
        b.textContent = ico + " " + nome + " extra — " + (free ? "grátis" : preco + "💰");
        b.title = "Uma " + nome.toLowerCase() + " vazia (vai para o baú). Guarde a cheia no tamanduá e vista a vazia.";
        if (!free && (econ.gold || 0) < preco) b.disabled = true;
        b.onclick = (e) => {
          e.stopPropagation();
          const msg = document.getElementById("prep-msg");
          if (!free && (econ.gold || 0) < preco) return;
          const it = mkItem(k);
          if (k === "eq_mochila") it.conteudo = { cols: MOCHILA.cols, rows: MOCHILA.rows, items: [], mochila: true };
          if (placeIn(econ.stash, it)) {
            if (!free) econ.gold -= preco;
            if (msg) msg.textContent = ico + " Comprou uma " + nome.toLowerCase() + " — está no baú.";
            updateEcon();
            renderPrep();
          } else if (msg) msg.textContent = "Sem espaço no baú para a " + nome.toLowerCase() + ".";
        };
        s.appendChild(b);
      }
  } catch (_) {} /* v6.0 — corda: preparação vende, carpintaria trança; presente de 1 corda na primeira expedição */
  try {
    const s = document.getElementById("prep-shop");
    if (s && !s.querySelector("[data-rope]")) {
      const free = econ.test,
        b = document.createElement("button");
      b.className = "btn";
      b.dataset.rope = "1";
      b.textContent = "🪢 Corda (5 usos) — " + (free ? "grátis" : "10💰");
      if (!free && (econ.gold || 0) < 10) b.disabled = true;
      b.onclick = (e) => {
        e.stopPropagation();
        const h = prepHero(),
          msg = document.getElementById("prep-msg");
        if (!h) return;
        if (!free && (econ.gold || 0) < 10) return;
        if (tryAddItem(h, "corda") || tryAddQuiver(h, "corda")) {
          if (!free) econ.gold -= 10;
          if (msg) msg.textContent = "🪢 Comprou uma corda (5 laçadas). G arremessa; segure G para puxar.";
          updateEcon();
          renderPrep();
        } else if (msg) msg.textContent = "Sem espaço na mochila para a corda.";
      };
      s.appendChild(b);
    }
  } catch (_) {}
  return r;
}
// etapa de renderPrep: v5.9.04
function renderPrepBase2(this: unknown) {
  const r = renderPrepBase.apply(this, arguments as Repasse);
  try {
    const m = mnt(),
      h = prepHero(),
      st = document.getElementById("prep-stats");
    let el = document.getElementById("prep-mount");
    if (!m || !h || !st) {
      if (el) el.remove();
      return r;
    }
    if (!el) {
      el = document.createElement("label");
      el.id = "prep-mount";
      st.after(el);
      el.addEventListener("change", (e) => {
        const mm = mnt(),
          hh = prepHero();
        if (mm && hh) mm.with = (e.target as HTMLInputElement).checked ? hh.id : mm.with === hh.id ? null : mm.with;
      });
    }
    el.innerHTML =
      "<input type='checkbox'" +
      (m.with === h.id ? " checked" : "") +
      "> 🐾 Levar <b>" +
      esc(m.name) +
      "</b> (montaria + alforjes · T monta/assobia)";
  } catch (e) {
    console.warn(e);
  }
  return r;
}
// etapa de renderPrep: original
function renderPrepBase() {
  const h = prepHero();
  if (!h) {
    closePrep();
    return;
  }
  renderEqSlots(h);
  prepTela(h); // v7.7: a silhueta no lugar do retrato 3D (ui/preparo_tela.ts)
  ensureHero(h);
  const pct = Math.max(0, Math.min(100, Math.round((h.hp / h.hpMax) * 100)));
  document.getElementById("prep-stats")!.innerHTML =
    "<b>" +
    esc(h.name) +
    "</b><div class='bar'><i style='width:" +
    pct +
    "%'></i></div>❤ " +
    Math.round(h.hp) +
    " / " +
    h.hpMax +
    "<br>" +
    idLine(h) +
    "<br>" +
    attrLine(h) +
    "<br>🛡 Proteção do equipamento: −" +
    Math.round(armorRed(h) * 100) +
    "% de dano" +
    (() => {
      const e = ensureEquip(h),
        low = (EQ_SLOTS.map((q) => e[q.id]).filter(Boolean) as Item[]).filter((it) => eqPct(it) < 0.35);
      return low.length
        ? "<br>⚠ Gastos: " +
            low.map((it) => it.def.emoji + " " + Math.round(eqPct(it) * 100) + "%").join(" · ") +
            " — conserte na ⚒ Forja"
        : "";
    })() +
    "<br>" +
    icoTag("ui_energia", "⚡") +
    " Energia " +
    Math.round(h.energy) +
    " · " +
    icoTag("ui_fome", "🍖") +
    " Fome " +
    Math.round(h.hunger);
  document.getElementById("prep-gold")!.textContent = econ.test ? "🧪 Teste: tudo grátis" : "💰 " + econ.gold;
  const q = econ.quiver,
    tot = q.n + econ.arrowStock!,
    room = QUIVERS[q.type] + ARROW_STOCK_MAX,
    free = econ.test;
  document.getElementById("prep-shop")!.innerHTML =
    ARROW_PACKS.map(
      (p, i) =>
        '<button class="btn" data-arrows="' +
        i +
        '"' +
        ((!free && econ.gold < p[1]) || tot + p[0] > room ? " disabled" : "") +
        ">🏹 +" +
        p[0] +
        " flechas — " +
        (free ? "grátis" : p[1] + "💰") +
        "</button>",
    ).join(" ") +
    " " +
    HERB_PACKS.map(
      (p, i) =>
        '<button class="btn" data-herbs="' +
        i +
        '"' +
        (!free && econ.gold < p[1] ? " disabled" : "") +
        ">🌿 +" +
        p[0] +
        " erva" +
        (p[0] > 1 ? "s" : "") +
        " — " +
        (free ? "grátis" : p[1] + "💰") +
        "</button>",
    ).join(" ") +
    ' <button class="btn" data-herbs="f"' +
    (!free && econ.gold < FOLH_PACK[1] ? " disabled" : "") +
    ">🍃 +" +
    FOLH_PACK[0] +
    " Folhama — " +
    (free ? "grátis" : FOLH_PACK[1] + "💰") +
    "</button>";
  if (prepBolsasMudaram(h)) INV.invGrids = prepGrids(h); // v7.7: prendeu ou soltou uma bolsa do cinto
  renderInv(); // redesenha a mochila e a aljava
}

export function resSpend(h: Hero, k: string, n: number) {
  h.loot = h.loot || {};
  if (k === "wood") {
    const t = Math.min(h.loot.wood || 0, n);
    h.loot.wood -= t;
    return n - t;
  }
  const key = RES_KEY[k],
    c0 = Math.min(h.loot[k] || 0, n);
  h.loot[k] = (h.loot[k] || 0) - c0;
  n -= c0;
  for (const inv of [ensureInv(h), qvInv(h)])
    for (let i = inv.items.length - 1; i >= 0 && n > 0; i--) {
      const it = inv.items[i];
      if (it.def.key !== key) continue;
      const t = Math.min(n, it.n || 1);
      it.n = (it.n || 1) - t;
      n -= t;
      if (it.n <= 0) inv.items.splice(i, 1);
    }
  return n;
}
/** `suave` (v7.7, map/transicao.ts): sem o portal, o campo abre na hora (quem chama já escureceu a tela). */
export function launchDungeon(heroId: string, suave = false) {
  /* v6.0 */
  try {
    const h = world.heroes.find((x) => x.id === heroId) || prepHero() || null;
    if (h && !econ._ropeGift && !ropeItem(h)) {
      econ._ropeGift = 1;
      if (tryAddItem(h, "corda"))
        pushEvent("🪢 " + h.name + " ganhou uma corda de laço (G arremessa, X faca, E finaliza).");
    }
    // v8.1 (mantenedor, 2026-10-31: "a personagem começar com machado e picareta na mochila"); nos saves antigos, na
    // próxima saída; se ela já leva uma delas (mochila ou mão), não ganha outra (a do baú não conta)
    if (h && !econ._ferramentas) {
      econ._ferramentas = 1;
      const tem = (k: string) =>
        ensureInv(h).items.some((i) => i.def.key === k) ||
        Object.values(ensureEquip(h)).some((i) => i && i.def && i.def.key === k);
      const ganhou = ["eq_machado", "eq_picareta"].filter((k) => !tem(k) && tryAddItem(h, k));
      if (ganhou.length)
        pushEvent(
          "🪓 " + h.name + " leva na mochila " + ganhou.map((k) => ITEM_DEFS[k].name.toLowerCase()).join(" e ") + ".",
        );
    }
  } catch (_) {}
  const h = world.heroes.find((x) => x.id === heroId);
  // v7.7: entrada recusada não deixa a marca do acampamento ligada (senão a próxima expedição virava o acampamento)
  if (!h || h.state !== "idle") CPS.pending = false;
  if (!h) return;
  ensureHero(h);
  if (h.state !== "idle") {
    pushEvent(h.name + " está ocupado e não pode entrar no mundo agora.");
    return;
  }
  h.state = "indungeon";
  updateHeroPanelUI();
  const abrir = () => {
    setupDungeon(h);
    document.getElementById("app")!.style.display = "none";
    document.getElementById("dungeon-view")!.style.display = "flex";
    fitDungeonCanvas();
  };
  if (suave) abrir();
  else playTransition(abrir, 700);
}
/**
 * `suave` (v7.7, map/transicao.ts): sem o portal; o mapa volta na hora e, saindo do campo, quem chama recebe onde a
 * heroína está e o zoom de destino (fx, fy, s) para levar a câmera até lá.
 */
export function exitDungeon(suave?: (fx: number, fy: number, s: number) => void) {
  const d = dungeon;
  /* v6.7 — fim da abertura: só vai para o Campo quando o jogador sai pela entrada */
  if (d.active && d.mode === "intro" && econ.introDone && d.flow === "introFree" && !ISC._toMap) {
    try {
      introObj("", "");
    } catch (_) {}
    introToMap();
    return;
  }
  loboNaSaida(); // v7.7 — campanha: o lobo na corda vai para o cercado
  /* v6.5 — saindo do Campo, o herói volta ao mapa onde estava (ver o fim da função) */
  const campo = d.active && d.mode === "campo",
    hCampo = d.hero,
    P = JOGO.pos;
  {
    const el = document.getElementById("perc-hud");
    if (el) el.style.display = "none";
  }
  /* v6.4 — acampamento: o Caçador acorda e o tutorial da fogueira termina */
  if (d.camp) {
    econ.hunterNap = false;
    if (CT.on) {
      CT.on = false;
      CT.unlit = false;
      CT.stage = "";
      if (econ.campTut === 2) {
        econ.campTut = 3;
        campanhaEvento("acampamentoFim"); // v7.7: sair no meio do tutorial também fecha a missão
      }
    }
  }
  /* v6.1 — sair durante a cena inicial conta como abertura vista */
  if (d.mode === "intro") {
    econ.introDone = true;
    if (ISC.on) iscSkip();
    ISC.on = false;
    ISC.npc = null;
    ISC.corpse = null;
  }
  /* v5.9.04 — tamanduá: suja no campo, guarda a vida e ganha xp por lutar junto */
  {
    const m = mnt();
    if (m && d.mount && !d.camp && !d.training) m.dirt = Math.min(100, (m.dirt || 0) + 14);
  }
  {
    const m = mnt();
    if (d.mount && m) {
      m.hp = Math.max(30, d.mount.hp);
      if (!d.camp && !d.training) mountXp(1, "lutou junto");
    }
    if (d.mount) d.mount.mounted = false;
  }
  /* v5.9 — acampamento fecha (a câmera volta depois); ferimento fica no herói */
  const eraCamp = d.camp,
    pc = CPS.prevCam,
    eraVila = vilaFechar(); // v8.0: a vila andável (map/vila_cena.ts): a câmera de antes e o que fazer depois
  campClose();
  if (d.hero && !d.training) d.hero.wound = d.wound || 0;
  /* v5.0 — sala de treino */
  if (d.training) trainRestore();
  trainHud(false);
  setTimeout(() => {
    if (OPT.autosave && !dungeon.active) saveTo("auto", true);
  }, 2500);
  document.getElementById("exp-modal")!.style.display = "none";
  dungeon.modalOpen = false;
  if (dungeon.craftOpen) closeCraft();
  document.getElementById("bow-hud")!.style.display = "none";
  document.getElementById("sword-hud")!.style.display = "none";
  document.getElementById("focus-hud")!.style.display = "none";
  const h = dungeon.hero;
  clearInterval(dungeon.combatInterval!);
  const fechar = () => {
    document.getElementById("dungeon-view")!.style.display = "none";
    document.getElementById("app")!.style.display = "block";
    resizeCanvas();
    dungeon.active = false;
    prep.launchId = null;
    if (h) {
      h.state = eraVila ? "field" : "idle"; // v8.0: saindo da vila, ela fica na vila, no mapa
      h.hp = dungeon.hp;
    }
    updateHeroPanelUI();
  };
  if (suave) fechar();
  else playTransition(fechar, 700);
  if (eraVila) {
    const vpc = eraVila.pc;
    setTimeout(() => {
      if (vpc && !dungeon.active)
        camZoomTo(
          (TELAS.viewport.clientWidth / 2 - vpc.x) / vpc.s,
          (TELAS.viewport.clientHeight / 2 - vpc.y) / vpc.s,
          vpc.s,
          650,
        );
      if (eraVila.depois) setTimeout(eraVila.depois, 400); // o bote da doca
    }, 420);
  }
  /* v5.9 — volta a câmera de antes do acampamento */
  if (eraCamp) {
    dungeon.camp = false;
    setTimeout(() => {
      if (pc && !dungeon.active)
        camZoomTo(
          (TELAS.viewport.clientWidth / 2 - pc.x) / pc.s,
          (TELAS.viewport.clientHeight / 2 - pc.y) / pc.s,
          pc.s,
          650,
        );
    }, 420);
  }
  /* v6.5 — herói reaparece no mapa onde estava no Campo */
  if (campo && hCampo && P) {
    const voltar = () => {
      try {
        const h = hCampo,
          Q = mundoSaida(P); // v8.0: onde ela está agora no pedaço do mapa (map/mundo.ts), fora da água
        h.state = "field";
        h.x = Q.x;
        h.y = Q.y;
        MAPCTL.sel = h.id;
        cacadaRetomar(h); // v7.7: veio de uma caçada do mapa: ela continua caçando
        updateHeroPanelUI();
        const vp = document.getElementById("viewport")!,
          s = Math.min(camera.maxScale * 0.8, Math.max(mapZoomLimit() * 2.2, camera.minScale * 12));
        const fx = econ.campTut === 1 && h.camp ? (h.x + h.camp.x) / 2 : h.x,
          fy = econ.campTut === 1 && h.camp ? (h.y + h.camp.y) / 2 : h.y;
        if (suave) {
          suave(fx, fy, s);
          return;
        }
        camera.zt = null;
        camera.scale = s;
        camera.tx = vp.clientWidth / 2 - fx * s;
        camera.ty = vp.clientHeight / 2 - fy * s;
        constrainCamera();
        applyCameraTransform();
      } catch (e) {
        console.warn(e);
      }
    };
    if (suave) voltar();
    else setTimeout(voltar, 760);
  }
}

/* ===== v3.7: criação aleatória, Mochila 02 (aljava 5×3) e preparação da expedição ===== */
export function randomHeroName() {
  const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const n = pick(NAME_A) + pick(NAME_B) + pick(NAME_C);
  return (n.charAt(0).toUpperCase() + n.slice(1)).slice(0, 18);
}
export function qvTrim(h: Hero) {
  const q = econ.quiver,
    cap = arrowCap(h);
  if (q.n > cap) {
    econ.arrowStock! += q.n - cap;
    q.n = cap;
  }
}
/* Preparação: HUD do personagem + mochilas + compra de flechas/ervas antes da masmorra */
function prepGrids(h: Hero) {
  return [
    { el: document.getElementById("prep-pack")!, inv: ensureInv(h) },
    { el: document.getElementById("prep-qv")!, inv: qvInv(h), discard: true },
    ...prepGradesBolsas(h), // v7.7: as bolsas do cinto (ui/preparo_tela.ts)
  ];
}
export function openPrep(heroId: string) {
  const h = world.heroes.find((x) => x.id === heroId);
  if (!h) return;
  if (bag.open) closeBag();
  // v7.7: na tenda do acampamento (documento mestre 5.2) a heroína está no acampamento, não parada no mapa
  const naTenda = dungeon.active && dungeon.camp && dungeon.hero === h;
  if (h.state !== "idle" && !naTenda) {
    pushEvent(h.name + " está ocupado e não pode entrar no mundo agora.");
    return;
  }
  if (naTenda) {
    dungeon.modalOpen = true;
    // o painel mora dentro de #app, que fica escondido no campo: vai para a vista do acampamento enquanto estiver aberto
    const m = document.getElementById("prep-modal")!;
    PREP_CASA.pai = m.parentElement;
    PREP_CASA.depois = m.nextSibling;
    document.getElementById("dungeon-view")!.appendChild(m);
  }
  prep.open = true;
  prep.heroId = heroId;
  ensureInv(h);
  qvTrim(h);
  INV.invGrids = prepGrids(h);
  document.getElementById("prep-msg")!.textContent = "";
  document.getElementById("prep-modal")!.classList.add("open");
  renderPrep();
}
export function prepShopClick(e: MouseEvent) {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-arrows],button[data-herbs]");
  if (!b || b.disabled) return;
  const h = prepHero(),
    msg = document.getElementById("prep-msg")!;
  if (!h) return;
  if (b.dataset.arrows != null) {
    const p = ARROW_PACKS[+b.dataset.arrows];
    if (!pay(p[1])) {
      msg.textContent = "Ouro insuficiente.";
      return;
    }
    econ.arrowStock! += p[0];
    refillQuiver();
    msg.textContent =
      "Comprou " +
      p[0] +
      " flechas" +
      (econ.arrowStock ? " (o que não coube na aljava ficou na reserva — cada 10 flechas ocupam uma coluna)." : ".");
  } else {
    const _fo = b.dataset.herbs === "f",
      p = _fo ? FOLH_PACK : HERB_PACKS[+b.dataset.herbs!],
      _ik = _fo ? "folhama" : "erva";
    if (!econ.test && econ.gold < p[1]) {
      msg.textContent = "Ouro insuficiente.";
      return;
    }
    const inv = ensureInv(h),
      added: Item[] = [];
    const q2 = qvInv(h),
      addedQ: Item[] = [];
    for (let i = 0; i < p[0]; i++) {
      if (tryAddItem(h, _ik)) added.push(inv.items[inv.items.length - 1]);
      else if (tryAddQuiver(h, _ik)) addedQ.push(q2.items[q2.items.length - 1]);
      else break;
    }
    if (added.length + addedQ.length < p[0]) {
      inv.items = inv.items.filter((it) => !added.includes(it));
      q2.items = q2.items.filter((it) => !addedQ.includes(it));
      INV.invGrids = prepGrids(h);
      msg.textContent = "Sem espaço nas mochilas — arrume os itens ou compre menos.";
      renderPrep();
      return;
    }
    pay(p[1]);
    msg.textContent =
      "Comprou " +
      p[0] +
      (_fo ? " folhas de Folhama" : " erva" + (p[0] > 1 ? "s" : "")) +
      " (foram para a mochila; se estava cheia, para a aljava).";
  }
  updateEcon();
  renderPrep();
}
export function prepGo() {
  const h = prepHero();
  if (!h) return;
  /* v7.7 — partindo da tenda: sai do acampamento e, de volta ao mapa, entra na expedição */
  if (dungeon.active && dungeon.camp && dungeon.hero === h) {
    const id = h.id;
    closePrep();
    exitDungeon();
    setTimeout(() => {
      if (dungeon.active || h.state !== "idle") return;
      CPS.pending = false;
      launchDungeon(id);
    }, 1300);
    return;
  }
  if (h.state !== "idle") {
    document.getElementById("prep-msg")!.textContent = h.name + " ficou ocupado.";
    return;
  }
  const id = prep.heroId!;
  prep.launchId = id;
  closePrep();
  CPS.pending = false; // v7.7: partir da preparação é sempre a expedição escolhida, nunca o acampamento
  launchDungeon(id);
}
export function enterDungeon(heroId: string) {
  openPrep(heroId);
}
