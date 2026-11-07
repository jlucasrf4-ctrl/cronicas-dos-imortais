/* ==== Fase 4 — chão do campo: itens perto do herói, pegar, guardar, interagir (base/17) ==== */
import { recipMontar, recipCliqueDireito } from "../ui/recipientes.ts";
import { bolsasNaTela } from "../ui/cinto_tela.ts";
import { canvasMochilaViva } from "../render/retrato.ts";
import { rastreioTick, rastreioMarcas } from "./rastreio.ts";
import { ITEM_DEFS, INV_CELL } from "../data/itens.ts";
import { selTem, selCaixaInicio, barra, selGrupoN } from "../items/selecao_inv.ts";
import { renderBauLista } from "../items/bau_infinito.ts";
import {
  canPlace,
  INV,
  rotShape,
  packMergeNew,
  ensureInv,
  packFix,
  TIERS,
  stackTarget,
  rollTier,
  bauFolga,
} from "../items/inventario.ts";
import { CACA, dungeon, econ, GL3, SOM, OPT, TELAS, world } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { PACK_KEYS } from "../data/campo.ts";
import { tierShape, itemVal, quickMove } from "../items/qualidade.ts";
import { gemDecor, stoneDecor, itName } from "../items/arte.ts";
import { INTERACT_R, GROUND_DEFS, EXP_WAVES } from "../data/expedicao.ts";
import { RES_KEY, QUIVERS } from "../data/recursos.ts";
import { nv, nodeRank } from "../hero/arvores.ts";
import {
  HERO,
  runCostMult,
  herbTick,
  applyStun,
  parryPerfectT,
  onPerfectParry,
  drawStatus,
  drawHurtFx,
  tickCombateHumano,
  adrenalinaCusto,
  adrenalinaRecuperacao,
  atkSpeedMult,
} from "./combate.ts";
import { isArrowIt } from "../items/aljava.ts";
import { mapFloat, meatShrinkAll } from "../map/caca.ts";
import { icoKeyOf, icoPiece, icoHas, icoBg, icoSetHTML, icoTag, dmgNumDraw, icoToast, icoRuna } from "../ui/icones.ts";
import {
  invLayout,
  INVF,
  invLayout3,
  dollHtml,
  invDecor,
  orgButton,
  gridCell,
  itemAt,
  heroOf,
  equipTo,
  updatePercHud,
} from "../ui/inventario.ts";
import { qvInv, renderQuiverPanels, qvRelayout, renderPrep, exitDungeon, resCount } from "../expedicao/preparo.ts";
import { chestRes } from "../render/sprites.ts";
import {
  dEqRender,
  spawnDungeonToast,
  updateWeaponUI,
  dSafe,
  drawSafeZone,
  drawDungeonLoot,
  drawCone,
  fitDungeonCanvas,
  updateDungeonFlow,
  drawBirds,
  drawDungeonMonster,
  drawBanner,
  livingMonsters,
} from "./masmorra.ts";
import { alforjeRender, mountLv } from "../creatures/tamandua.ts";
import { eqDurInit, eqName } from "../items/durabilidade.ts";
import { afText, attrOf } from "../hero/atributos.ts";
import { eqDurBar } from "../forja/forja.ts";
import { updateEcon } from "../econ/economia.ts";
import { _out } from "../audio/som.ts";
import { CRIT, critLoot } from "./campo_vida.ts";
import { progressoHudTick } from "./progresso_hud.ts";
import { ISC } from "../intro/cena.ts";
import { FIN, knifeIn, knifeMode, knifeStab, withBagKnife } from "./faca_corda.ts";
import {
  rollItemKey,
  aimAngle,
  hitSparks,
  wolfBody,
  bodyDist,
  wolfStrike,
  hurtMonster,
  meleeDmg,
  monR,
  drawHitFx,
  updateFocusHud,
  updateCharge,
  drawAim,
  drawMeleeBar,
  drawArrows,
  updateDungeonMonster,
  parryTouches,
  swingBasic,
  puxarBasico,
  bowRange,
} from "./acertos.ts";
import { pushEvent } from "../sim/eventos.ts";
import { angDiff, clamp } from "../core/util.ts";
import { survStamMult, hpCap, survTick, survMoveMult } from "../survival/sobrevivencia.ts";
import { heroEq, ensureEquip } from "../items/equipamento.ts";
import { stamRing, cravRip, folCansar } from "./tipos.ts";
import { estadosDraw } from "./estados.ts";
import { craftRapidoAndar, craftRapidoTick } from "./craft_rapido.ts";
import { barrasRecursos } from "./recursos_campo.ts";
import { bandidosDraw2D } from "./bandidos.ts";
import { hvKind, hvStart, wpnProf, armasDraw2D, spearAimDraw, armasTick } from "./armas.ts";
import { runeDraw2D, runeDungeonTick } from "../runas/runas.ts";
import { boarDraw2D, boarTick } from "../creatures/javali.ts";
import {
  D3,
  d3Shift,
  d3Install,
  d3Follow,
  dPoint,
  d3Ground,
  d3Scene,
  d3Bill,
  d3Hero,
  d3Flush,
  d3Near,
} from "./projecao.ts";
import { fatorCorrida } from "./folego.ts";
import { WEAPONS, FOL_HEROI, ARCO_FOL, PARRY, COMBO, FACA2, ATAQUE_AUTO, ARCO_BASICO } from "../data/combate.ts";
import { STAT } from "../data/atributos.ts";
import { MOUNT } from "../data/sobrevivencia.ts";
import { glFrame } from "../render/gl/renderer.ts";
import { ED } from "../editor/estado.ts";
import { editorQuadro } from "../editor/editor.ts";
import { ensureHero, treePoints, xpNeed } from "../hero/nivel.ts";
import { AFFINITIES } from "../data/nascimento.ts";
import { trainTick } from "./treino.ts";
import { mobDungeonTick } from "../ui/celular.ts";
import { mundoMover } from "../map/mundo.ts";
import type { Aparo, GradeTela, Hero, InvGrid, Item, LootChao, Monster, Repasse } from "../core/tipos.ts";

export function tryAddToInv(inv: InvGrid, key: string, tier?: number) {
  const def = ITEM_DEFS[key];
  tier = tier! | 0;
  bauFolga(inv); // v7.7: o baú infinito sempre tem lugar
  let sh = tierShape(key, tier),
    ok = false;
  busca: for (let rot = 0; rot < 4; rot++) {
    for (let y = 0; y < inv.rows; y++)
      for (let x = 0; x < inv.cols; x++)
        if (canPlace(inv, sh, x, y)) {
          inv.items.push({ uid: ++INV.invUid, def, x, y, shape: sh, tier });
          ok = true;
          break busca;
        }
    sh = rotShape(sh);
  }
  /* v5.9.07 — carne lembra de que bicho veio; gemas e pedras ganham enfeite */
  if (ok) {
    const it = inv.items[inv.items.length - 1];
    if (it && it.def.key === "carne" && CACA.MEAT_SRC) it.an = CACA.MEAT_SRC;
    if (it && it.def.key === "gema") gemDecor(it);
    if (it) stoneDecor(it);
  }
  /* v6.6 — pacote novo junta com o pacote igual */
  try {
    if (ok && PACK_KEYS.includes(key)) packMergeNew(inv, inv.items[inv.items.length - 1]);
  } catch (_) {}
  return ok;
}

export function addRing(x: number, y: number, col: string, max: number, life: number, w: number) {
  dungeon.rings!.push({ x, y, col, max, life, t: 0, w });
}

/* ---- chão da masmorra: itens perto do herói aparecem como uma grade ao abrir a mochila ---- */
const GROUND_R = INTERACT_R;
function groundKey(l: LootChao) {
  if (!l.ground) return ITEM_DEFS[l.key] ? l.key : null;
  const g = GROUND_DEFS[l.key];
  return g ? g.item || RES_KEY[g.res!] || null : null;
}
export function buildGroundInv() {
  const d = dungeon,
    keep = new Map();
  if (d.gInv) for (const it of d.gInv.items) if (it._loot) keep.set(it._loot, it);
  const inv: InvGrid = { cols: 24, rows: 9, items: [], ground: true },
    near = d.loot!.filter(
      (l) => Math.hypot(l.x - d.px, l.y - d.py) < GROUND_R * nv(HERO()!, "olhar_atento", 1) && groundKey(l),
    );
  for (const l of near) {
    const k = keep.get(l);
    if (k && canPlace(inv, k.shape, k.x, k.y)) {
      inv.items.push(k);
      continue;
    }
    if (tryAddToInv(inv, groundKey(l)!, l.tier! | 0)) {
      const it = inv.items[inv.items.length - 1];
      it._loot = l;
      if ((l.n || 1) > 1) it.n = l.n;
    }
  }
  d.gInv = inv;
  /* v5.8 — item com identidade (equipamento solto) aparece como ele mesmo */
  for (let i = 0; i < inv.items.length; i++) {
    const a = inv.items[i],
      l = a._loot;
    if (l && l.it && l.it !== a) {
      const o = l.it;
      o.x = a.x;
      o.y = a.y;
      o.shape = a.shape;
      o._loot = l;
      inv.items[i] = o;
    }
  }
  return inv;
}
export function groundTake(it: Item) {
  const l = it._loot;
  if (l) {
    const i = dungeon.loot!.indexOf(l);
    if (i >= 0) dungeon.loot!.splice(i, 1);
  }
  delete it._loot;
}
export function groundPut(it: Item) {
  // vira item no chão, ao lado do herói
  const d = dungeon,
    T = d.tile,
    a = Math.random() * 6.283,
    r = 10 + Math.random() * 12;
  const l = {
    key: it.def.key,
    tier: it.tier | 0,
    n: it.n || 1,
    t: 0,
    ttl: it.def.key === "carne" ? 40 : 0,
    x: Math.max(T, Math.min(d.cols * T - T, d.px + Math.cos(a) * r)),
    y: Math.max(T, Math.min(d.rows * T - T, d.py + Math.sin(a) * r)),
  };
  d.loot!.push(l);
  it._loot = l;
  /* v5.8 — ---- item no chão mantém a identidade (qualidade, durabilidade, atributos) ---- */
  if (it && it._loot && it.def && (it.def.slot || it.q != null || it.af)) it._loot.it = it;
}
export function dropToGround(it: Item, inv: InvGrid) {
  // clique direito na masmorra: larga 1 unidade no chão (não perde mais)
  const d = dungeon;
  if (!d.gInv) buildGroundInv();
  if ((it.n || 1) > 1) {
    it.n!--;
    if (tryAddToInv(d.gInv!, it.def.key, it.tier | 0)) {
      const g = d.gInv!.items[d.gInv!.items.length - 1];
      groundPut(g);
    } else groundPut({ def: it.def, tier: it.tier, n: 1 } as Item);
    return;
  }
  largarNoChao(it, inv);
}
/** v7.7 — larga o item inteiro (a pilha toda) no chão, ao lado do herói; a área do chão o encaixa no primeiro lugar
    livre (girando se preciso), sem depender de onde foi solto. Arrastar para a área do chão usa isto. */
export function largarNoChao(it: Item, inv: InvGrid) {
  const d = dungeon;
  if (!d.gInv) buildGroundInv();
  inv.items.splice(inv.items.indexOf(it), 1);
  let sh = it.shape,
    ok = false;
  for (let r = 0; r < 4 && !ok; r++) {
    for (let y = 0; y < d.gInv!.rows && !ok; y++)
      for (let x = 0; x < d.gInv!.cols && !ok; x++)
        if (canPlace(d.gInv!, sh, x, y)) {
          it.x = x;
          it.y = y;
          it.shape = sh;
          d.gInv!.items.push(it);
          ok = true;
        }
    sh = rotShape(sh);
  }
  groundPut(it);
}
export function invValue(h: Hero) {
  return (
    ensureInv(h).items.reduce((a, it) => a + itemVal(it), 0) +
    (h.inv2 ? h.inv2.items.reduce((a: number, it) => a + (isArrowIt(it) ? 0 : itemVal(it)), 0) : 0)
  );
}
export function tryAddItem(h: Hero, key: string, tier?: number) {
  const r = tryAddItemBase(h, key, tier);
  /* v5.9.13 */
  try {
    if (r && key !== "carne" && !(typeof dungeon !== "undefined" && dungeon.active)) {
      const it = ensureInv(h).items[ensureInv(h).items.length - 1];
      mapFloat(h, "+1 " + (it ? itName(it) : ITEM_DEFS[key].name), it ? icoKeyOf(it)! : key);
    }
  } catch (_) {}
  return r;
}
function tryAddItemBase(h: Hero, key: string, tier?: number) {
  return tryAddToInv(ensureInv(h), key, tier);
}
export function toggleInv(force?: boolean) {
  invLayout(); // v5.9.02 — arruma o layout antes de abrir
  if (dungeon.active) {
    dungeon.invOpen = force === undefined ? !dungeon.invOpen : force;
    document.getElementById("inv-modal")!.classList.toggle("open", dungeon.invOpen);
    if (dungeon.invOpen) {
      dungeon.charging = false;
      dungeon.charge = 0;
      dungeon.guard = false;
      dungeon.gInv = null;
      buildGroundInv();
      renderInv();
    } else {
      INV.invDrag = null;
      dungeon.gInv = null;
    }
  }
  if (!dungeon.invOpen) INVF.full = false; // v5.9.02 — fechou: some o aviso de mochila cheia
}
export function renderInv() {
  /* v6.5 — pacotes (9/9) arrumados antes de desenhar */
  try {
    for (const g of typeof INV.invGrids !== "undefined" ? INV.invGrids : []) packFix(g.inv);
  } catch (_) {}
  /* v5.9.11 — carne encolhe com o tempo (não mexe enquanto arrasta) */
  if (!INV.invDrag) meatShrinkAll();
  renderQuiverPanels();
  if (dungeon.active && dungeon.invOpen) {
    INV.invGrids = [
      { el: document.getElementById("inv-grid")!, inv: ensureInv(dungeon.hero!), discard: true },
      { el: document.getElementById("inv-qv")!, inv: qvInv(dungeon.hero!), discard: true },
      { el: document.getElementById("inv-ground")!, inv: dungeon.gInv || buildGroundInv() },
    ];
    // v7.7: as bolsas presas no cinto, no painel do personagem (ui/cinto_tela.ts)
    if (invLayout3()) INV.invGrids.push(...bolsasNaTela(dungeon.hero!, document.getElementById("inv-bolsas")));
    const n = dungeon.gInv!.items.length;
    document.getElementById("inv-ground-hint")!.textContent = n
      ? n + " item(ns) no chão perto de você — arraste para a mochila (Ctrl+clique pega direto)"
      : "Nada encostado em você. Arraste itens para cá para largar no chão.";
  }
  for (const gr of INV.invGrids) renderInvGrid(gr);
  if (dungeon.active && dungeon.invOpen)
    document.getElementById("inv-val")!.textContent = "Valor carregado: " + invValue(dungeon.hero!);
  if (INV.chestOpen) chestRes();
  if (INV.chestOpen) document.getElementById("chest-info")!.textContent = "(" + econ.stash.items.length + " itens)";
  /* v5.8 — equipamento dentro da mochila da masmorra */
  try {
    if (dungeon.active && dungeon.invOpen) dEqRender();
  } catch (_) {}
  /* v5.9.02 — aviso de mochila cheia; largura da coluna da esquerda */
  {
    const h = document.getElementById("inv-ground-hint");
    if (h && dungeon.active && dungeon.invOpen && INVF.full) {
      h.innerHTML =
        "<b class='invf'>🎒 Mochila cheia!</b> Compare o que está no chão com o que você carrega: arraste para trocar, botão direito larga um item da mochila.";
    }
  }
  {
    const L = document.getElementById("inv-left"),
      g = document.getElementById("inv-grid"),
      gg = document.getElementById("inv-ground"),
      eq = document.getElementById("inv-eq");
    if (L && g && dungeon.active && dungeon.invOpen)
      L.style.maxWidth =
        Math.max(
          g.offsetWidth,
          gg ? gg.offsetWidth : 0,
          eq
            ? Math.max(
                0,
                ...[...eq.querySelectorAll("[data-eqs]")].map(
                  (x) => x.getBoundingClientRect().right - eq.getBoundingClientRect().left,
                ),
              ) + 4
            : 0,
          300,
        ) + "px";
  }
  /* v5.9.03 — layout da mochila e boneco */
  try {
    if (dungeon.active && dungeon.invOpen) {
      invLayout3();
      const dl = document.getElementById("inv-doll");
      if (dl) {
        dl.innerHTML = dollHtml(dungeon.hero!); // v7.7: com a silhueta (o retrato 3D saiu)
        // v8.0: o personagem em 3D por cima da silhueta (render/retrato.ts mochilaVivaQuadro; sem WebGL, a silhueta)
        dl.querySelector(".dfoto")?.appendChild(canvasMochilaViva());
      }
    }
  } catch (e) {
    console.warn(e);
  }
  /* v5.9.04 — alforjes do tamanduá */
  try {
    alforjeRender();
  } catch (e) {
    console.warn(e);
  }
  /* v7.7 — aljava e alforjes em janelas próprias (ui/recipientes.ts) */
  try {
    recipMontar();
  } catch (e) {
    console.warn(e);
  }
  barra(); // v7.7: barra da seleção de vários itens
}
function rotateInPlace(it: Item, inv: InvGrid) {
  const ns = rotShape(it.shape);
  let best = null,
    bd = 1e9;
  for (let y = 0; y < inv.rows; y++)
    for (let x = 0; x < inv.cols; x++)
      if (canPlace(inv, ns, x, y, it)) {
        const d = Math.abs(x - it.x) + Math.abs(y - it.y);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
  if (best) {
    it.shape = ns;
    it.x = best.x;
    it.y = best.y;
    renderInv();
  }
}
/* v7.7 — grade A2: o fundo das peças com arte e as classes de moldura de uma casinha (lados abertos e quinas de
   fora; o desenho está no CSS 46_v7.7_grade_a2.css) */
const COR_PECA_A2 = "#3b2c19";
function bordasA2(tem: (r: number, c: number) => boolean, r: number, c: number) {
  const t = !tem(r - 1, c),
    b = !tem(r + 1, c),
    l = !tem(r, c - 1),
    d = !tem(r, c + 1);
  return (
    (t ? " a2-t" : "") +
    (b ? " a2-b" : "") +
    (l ? " a2-l" : "") +
    (d ? " a2-r" : "") +
    (t && l ? " a2-tl" : "") +
    (t && d ? " a2-tr" : "") +
    (b && l ? " a2-bl" : "") +
    (b && d ? " a2-br" : "")
  );
}
/** Arte pintada de uma peça da grade (renderInvGrid → icoPiece): o ícone e a qualidade que pinta a moldura. */
interface IconePeca {
  ico: string | null;
  q: number | null | undefined;
}
export function renderInvGrid(gr: GradeTela) {
  if (gr.inv.infinito) {
    renderBauLista(gr); // v7.7: o baú infinito é uma lista de quadradinhos (items/bau_infinito.ts)
    return;
  }
  if (gr.inv.qv) qvRelayout(gr.inv.hero!);
  const inv = gr.inv,
    g = gr.el;
  g.classList.remove("bau-lista", "alvo");
  g.style.width = inv.cols * INV_CELL + "px";
  g.style.height = inv.rows * INV_CELL + "px";
  g.innerHTML = "";
  g.classList.toggle("sem-mochila", !!inv.mochila && inv.cols === 0); // v7.7: heroína sem mochila (items/mochilas.ts)
  g.classList.toggle("sem-aljava", !!inv.qv && inv.cols === 0);
  g.oncontextmenu = (ev: Event) => {
    ev.preventDefault();
    if (INV.invDrag) rotateDrag();
  };
  /* v7.7 — grade A2: só pontinhos discretos nos cantos das casinhas (CSS 46_v7.7_grade_a2.css) */
  g.classList.add("grade-a2");
  g.style.backgroundImage = "";
  g.style.backgroundSize = INV_CELL + "px " + INV_CELL + "px";
  g.style.backgroundPosition = -INV_CELL / 2 + "px " + -INV_CELL / 2 + "px";
  const overlay = (
    w: HTMLDivElement,
    shape: number[][],
    emoji: string | IconePeca /* texto ou { ico, q } */,
    tierLab: string,
    tierCol: string,
    count: number,
  ) => {
    // emoji no centro da peça, etiqueta de qualidade e contagem nos cantos
    let r0 = 99,
      r1 = -1,
      c0 = 99,
      c1 = -1;
    shape.forEach((row: number[], r: number) =>
      row.forEach((v: number, c: number) => {
        if (v) {
          r0 = Math.min(r0, r);
          r1 = Math.max(r1, r);
          c0 = Math.min(c0, c);
          c1 = Math.max(c1, c);
        }
      }),
    );
    const bw = (c1 - c0 + 1) * INV_CELL,
      bh = (r1 - r0 + 1) * INV_CELL,
      e = document.createElement("div");
    e.className = "inv-emo";
    if (emoji && (emoji as IconePeca).ico) icoPiece(e, (emoji as IconePeca).ico!, bw, bh, (emoji as IconePeca).q);
    else e.textContent = emoji as string;
    e.style.left = c0 * INV_CELL + "px";
    e.style.top = r0 * INV_CELL + "px";
    e.style.width = bw + "px";
    e.style.height = bh + "px";
    e.style.fontSize = Math.max(11, Math.min(bw, bh) * 0.62) + "px";
    w.appendChild(e);
    if (tierLab) {
      const b = document.createElement("i");
      b.className = "tier-b";
      b.style.left = c0 * INV_CELL + 1 + "px";
      b.style.top = r0 * INV_CELL + "px";
      b.style.color = tierCol;
      b.textContent = tierLab;
      w.appendChild(b);
    }
    if (count > 1) {
      const m = document.createElement("small");
      m.className = "inv-cnt";
      m.style.left = (c1 + 1) * INV_CELL - 2 + "px";
      m.style.top = (r1 + 1) * INV_CELL - 2 + "px";
      m.textContent = String(count);
      w.appendChild(m);
    }
  };
  const mk = (it: Item, x: number, y: number, shape: number[][], cls: string) => {
    eqDurInit(it);
    const w = document.createElement("div");
    w.className = "inv-item " + cls;
    w.style.left = x * INV_CELL + "px";
    w.style.top = y * INV_CELL + "px";
    const _t = TIERS[it.tier | 0],
      ttl =
        eqName(it) +
        (it.def.slot && afText(eqDurInit(it)) ? " [" + afText(it) + "]" : "") +
        (it.durMax ? " · " + it.dur + "/" + it.durMax : "") +
        (it.tier ? " [" + _t.lab + "]" : "") +
        (it.n! > 1 ? " ×" + it.n : "") +
        " · valor " +
        itemVal(it);
    const comIco = icoHas(it.def.key) || !!icoRuna(it.def.key); // v7.7: a runa usa a gema do elemento
    const tem = (r: number, c: number) => !!(shape[r] && shape[r][c]);
    shape.forEach((row: number[], r: number) =>
      row.forEach((v: number, c: number) => {
        if (!v) return;
        const d = document.createElement("div");
        d.className = "inv-cell " + bordasA2(tem, r, c); // v7.7: moldura que segue o contorno da peça
        d.style.width = d.style.height = INV_CELL + "px";
        d.style.left = c * INV_CELL + "px";
        d.style.top = r * INV_CELL + "px";
        d.style.background = comIco ? icoBg(it.def.color) : it.def.color;
        if (comIco) w.classList.add("hasico");
        d.dataset.r = String(r);
        d.dataset.c = String(c);
        d.title = ttl;
        // v7.7 — grade A2: fundo uniforme nas peças com arte (a qualidade fica na moldura do ícone e no brilho)
        d.style.setProperty("background", comIco ? COR_PECA_A2 : it.def.color, "important");
        if (it.tier) w.classList.add("tier" + Math.min(2, it.tier));
        w.appendChild(d);
      }),
    );
    overlay(
      w,
      shape,
      icoHas(icoKeyOf(it))
        ? { ico: icoKeyOf(it), q: it.def.slot ? (it.q ?? 1) : it.tier ? 10 + Math.min(2, it.tier) : null } // v7.7: equipável sem qualidade (a faca) = moldura comum
        : it.def.emoji,
      it.tier ? _t.lab : "",
      it.tier ? _t.col : "",
      it.n || 1,
    );
    eqDurBar(w, it, shape);
    invDecor(w, it);
    if (selTem(it) && !cls) w.classList.add("inv-sel"); // v7.7: seleção de vários itens
    g.appendChild(w);
    return w;
  };
  for (const it of inv.items) {
    if (it.def.key === "pedra" && it.shape.length > 2) it.shape = it.def.shape!.map((r: number[]) => r.slice());
    if (INV.invDrag && INV.invDrag.it === it) continue;
    const w = mk(it, it.x, it.y, it.shape, "");
    w.addEventListener("pointerdown", (ev) => {
      if (
        ev.button !== 0 ||
        INV.invDrag ||
        !(ev.target as HTMLElement).dataset ||
        (ev.target as HTMLElement).dataset.r === undefined
      )
        return;
      ev.preventDefault();
      if ((ev.ctrlKey || ev.metaKey) && INV.invGrids.length > 1) {
        quickMove(it, gr);
        renderInv();
        updateEcon();
        return;
      }
      INV.invDrag = {
        sx: ev.clientX,
        sy: ev.clientY,
        moved: false,
        it,
        from: gr,
        over: gr,
        shape: it.shape,
        ox: +(ev.target as HTMLElement).dataset.c!,
        oy: +(ev.target as HTMLElement).dataset.r!,
        gx: it.x,
        gy: it.y,
      };
      renderInv();
    });
    w.addEventListener("dblclick", () => {
      if (!gr.discard) rotateInPlace(it, inv);
    });
    w.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (INV.invDrag) {
        rotateDrag();
        return;
      }
      // v7.7: transferência rápida entre a mochila e as janelas de recipiente (ui/recipientes.ts)
      if (recipCliqueDireito(it, gr)) {
        renderInv();
        return;
      }
      if (gr.discard && !isArrowIt(it)) {
        if (dungeon.active && dungeon.invOpen) dropToGround(it, inv);
        else if ((it.n || 1) > 1) it.n!--;
        else inv.items.splice(inv.items.indexOf(it), 1);
        renderInv();
      }
    });
  }
  if (inv.fixed)
    for (const f of inv.fixed) {
      const w = document.createElement("div");
      w.className = "inv-item fix";
      w.style.left = f.x * INV_CELL + "px";
      w.style.top = f.y * INV_CELL + "px";
      f.shape.forEach((row: number[], r: number) =>
        row.forEach((v: number, c: number) => {
          if (!v) return;
          const d = document.createElement("div");
          d.className = "inv-cell";
          d.style.width = d.style.height = INV_CELL + "px";
          d.style.left = c * INV_CELL + "px";
          d.style.top = r * INV_CELL + "px";
          d.style.background = f.color;
          d.title = f.title;
          w.appendChild(d);
        }),
      );
      overlay(w, f.shape, f.emoji, "", "", f.count!);
      g.appendChild(w);
    }
  if (INV.invDrag && INV.invDrag.over && INV.invDrag.over.el === gr.el) {
    const fant = mk(
      INV.invDrag.it,
      INV.invDrag.gx,
      INV.invDrag.gy,
      INV.invDrag.shape,
      "ghost " +
        (canPlace(inv, INV.invDrag.shape, INV.invDrag.gx, INV.invDrag.gy, INV.invDrag.it) ||
        stackTarget(inv, INV.invDrag.it, INV.invDrag.gx, INV.invDrag.gy)
          ? "ok"
          : "bad"),
    );
    // v7.7: arrastando uma seleção: quantos vão juntos (items/selecao_inv.ts)
    const n = INV.invDrag.over.inv !== INV.invDrag.from.inv ? selGrupoN(INV.invDrag.it) : 0;
    if (n > 1) {
      const b = document.createElement("b");
      b.className = "inv-grupo";
      b.textContent = "×" + n;
      fant.appendChild(b);
    }
  }
  /* v5.9.02 — sem dica nas células; botão de organizar */
  gr.el._gr = gr;
  gr.el.querySelectorAll<HTMLElement>(".inv-cell").forEach((c: HTMLElement) => c.removeAttribute("title"));
  orgButton(gr);
  /* v5.9.03 — duplo clique equipa; Shift move entre grades */
  {
    const g = gr.el;
    g._gr = gr;
    if (!g._v3) {
      g._v3 = 1;
      g.addEventListener(
        "dblclick",
        (e: MouseEvent) => {
          const G = g._gr;
          if (!G) return;
          const [cx, cy] = gridCell(g, e),
            f = itemAt(G, cx, cy, true);
          if (!f || !f.it.def.slot || isArrowIt(f.it)) return;
          const h = heroOf();
          if (!h) return;
          e.stopPropagation();
          e.preventDefault();
          const mm = document.getElementById("inv-menu");
          if (mm) mm.remove();
          const msg = equipTo(h, f.it, G, f.it.def.slot);
          if (dungeon.active) {
            spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
            GL3.heroKey = "";
            updateWeaponUI();
            renderInv();
          } else {
            const m = document.getElementById("prep-msg");
            if (m) m.textContent = msg;
            renderPrep();
          }
        },
        true,
      );
      g.addEventListener(
        "pointerdown",
        (e: PointerEvent) => {
          const G = g._gr;
          if (!G || e.button !== 0 || INV.invDrag) return;
          const [cx, cy] = gridCell(g, e),
            f = itemAt(G, cx, cy, true),
            now = performance.now();
          if (
            f &&
            g._last &&
            g._last.it === f.it &&
            now - g._last.t < 400 &&
            f.it.def.slot &&
            !isArrowIt(f.it) &&
            heroOf() &&
            !e.shiftKey
          ) {
            // duplo clique = equipar
            g._last = null;
            e.preventDefault();
            e.stopPropagation();
            const mm = document.getElementById("inv-menu");
            if (mm) mm.remove();
            const h = heroOf()!,
              msg = equipTo(h, f.it, G, f.it.def.slot);
            if (dungeon.active) {
              spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
              GL3.heroKey = "";
              updateWeaponUI();
              renderInv();
            } else {
              const m = document.getElementById("prep-msg");
              if (m) m.textContent = msg;
              renderPrep();
            }
            return;
          }
          g._last = f ? { it: f.it, t: now } : null;
          if ((e.target as HTMLElement).dataset && (e.target as HTMLElement).dataset.r !== undefined) return;
          if (!f) {
            selCaixaInicio(G, e); // v7.7: casa vazia: retângulo de seleção (items/selecao_inv.ts)
            return;
          }
          if (G.inv.fixed && !G.inv.items.includes(f.it)) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey && INV.invGrids.length > 1) {
            quickMove(f.it, G);
            renderInv();
            updateEcon();
            return;
          }
          INV.invDrag = {
            sx: e.clientX,
            sy: e.clientY,
            moved: false,
            it: f.it,
            from: G,
            over: G,
            shape: f.it.shape,
            ox: f.c,
            oy: f.r,
            gx: f.it.x,
            gy: f.it.y,
          };
          renderInv();
        },
        true,
      );
    }
  }
}
export function rotateDrag() {
  if (!INV.invDrag) return;
  const d = INV.invDrag,
    px = d.gx + d.ox,
    py = d.gy + d.oy,
    h = d.shape.length;
  const nox = h - 1 - d.oy,
    noy = d.ox;
  d.shape = rotShape(d.shape);
  d.ox = nox;
  d.oy = noy;
  d.gx = px - nox;
  d.gy = py - noy;
  renderInv();
}
export function sfx(kind: string) {
  try {
    SOM._ac = SOM._ac || new (window.AudioContext || window.webkitAudioContext)();
    const _n = (dur: number, ftype: BiquadFilterType, f0: number, f1: number, vol: number, delay?: number) => {
      // rajada de ruído filtrada
      const t0 = SOM._ac!.currentTime + (delay || 0),
        n = Math.max(1, Math.floor(SOM._ac!.sampleRate * dur)),
        buf = SOM._ac!.createBuffer(1, n, SOM._ac!.sampleRate),
        dd = buf.getChannelData(0);
      for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
      const src = SOM._ac!.createBufferSource(),
        f = SOM._ac!.createBiquadFilter(),
        g = SOM._ac!.createGain();
      f.type = ftype;
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(f);
      f.connect(g);
      g.connect(_out());
      src.start(t0);
    };
    const _t = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay?: number) => {
      // tom com queda de frequência
      const t = SOM._ac!.currentTime + (delay || 0),
        o = SOM._ac!.createOscillator(),
        g = SOM._ac!.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(_out());
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    if (kind === "swing") {
      _n(0.11, "bandpass", 700, 2600, 0.13);
      return;
    }
    // v8.1 — combate contra humanos sem avisos na tela: o escudo que segura, o aço do parry e o fôlego antes do pesado
    if (kind === "escudo") {
      _n(0.09, "lowpass", 900, 300, 0.22);
      _t("triangle", 180, 90, 0.12, 0.12);
      return;
    }
    if (kind === "hurt") {
      _n(0.14, "lowpass", 600, 120, 0.3);
      _t("sine", 110, 55, 0.18, 0.22);
      return;
    }
    if (kind === "aco") {
      _t("square", 1900, 1600, 0.08, 0.06);
      _t("triangle", 2600, 2300, 0.22, 0.09, 0.01);
      _n(0.07, "highpass", 4000, 6500, 0.14);
      return;
    }
    if (kind === "folego") {
      _n(0.32, "bandpass", 260, 520, 0.09);
      _t("sawtooth", 140, 105, 0.28, 0.025);
      return;
    } // vento da espada
    if (kind === "exausto") {
      _n(0.24, "bandpass", 1100, 360, 0.14);
      _n(0.2, "bandpass", 850, 280, 0.1, 0.22);
      _t("sine", 190, 95, 0.3, 0.08, 0.08);
      return;
    }
    if (kind === "hitlite") {
      _t("sine", 260, 90, 0.09, 0.14);
      _n(0.05, "lowpass", 2400, 600, 0.18);
      _t("triangle", 820, 470, 0.1, 0.06, 0.02);
      return;
    }
    if (kind === "hit") {
      _t("sine", 190, 55, 0.13, 0.22);
      _n(0.07, "lowpass", 2200, 400, 0.28);
      _t("triangle", 760 + Math.random() * 140, 420, 0.12, 0.08, 0.02);
      return;
    } // pancada + ganido
    if (kind === "hit3") {
      _t("sine", 140, 38, 0.22, 0.32);
      _n(0.14, "lowpass", 3000, 300, 0.4);
      _n(0.05, "highpass", 3000, 6000, 0.18);
      _t("sawtooth", 900, 300, 0.16, 0.09, 0.015);
      return;
    } // finalizador
    if (kind === "woodhit") {
      // Estalo seco e grave de madeira, sem o componente que lembra impacto/ganido de inimigo.
      _n(0.055, "bandpass", 850, 260, 0.2);
      _t("triangle", 180, 75, 0.11, 0.12, 0.012);
      return;
    }
    if (kind === "woodbreak") {
      // Madeira cedendo: duas estaladas curtas, com mais corpo que o golpe comum.
      _n(0.09, "bandpass", 1100, 180, 0.24);
      _n(0.065, "bandpass", 700, 130, 0.19, 0.075);
      _t("triangle", 125, 48, 0.19, 0.17, 0.02);
      return;
    }
    if (kind === "branchwork") {
      // Fibras se abrindo e um estalo leve, distinto dos impactos de combate.
      _n(0.075, "bandpass", 1500, 520, 0.14);
      _t("triangle", 360, 150, 0.16, 0.1, 0.035);
      _n(0.045, "highpass", 2400, 1200, 0.08, 0.09);
      return;
    }
    if (kind === "wolfdie") {
      _t("sawtooth", 520, 90, 0.45, 0.11);
      _t("sine", 120, 40, 0.3, 0.26, 0.03);
      _n(0.2, "lowpass", 1800, 200, 0.3);
      return;
    }
    if (kind === "shoot") {
      // estalo da corda: ruído curto + tom grave
      const t0 = SOM._ac.currentTime,
        n = Math.floor(SOM._ac.sampleRate * 0.09),
        buf = SOM._ac.createBuffer(1, n, SOM._ac.sampleRate),
        dd = buf.getChannelData(0);
      for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const src = SOM._ac.createBufferSource(),
        f = SOM._ac.createBiquadFilter(),
        g0 = SOM._ac.createGain();
      f.type = "bandpass";
      f.frequency.value = 1800;
      g0.gain.value = 0.22;
      src.buffer = buf;
      src.connect(f);
      f.connect(g0);
      g0.connect(_out());
      src.start(t0);
      sfx("twang");
      return;
    }
    const P = (<Record<string, [number, number, number, OscillatorType, number]>>{
      draw: [130, 300, 0.28, "sine", 0.07],
      ping: [1250, 1250, 0.1, "sine", 0.07],
      arrowhit: [320, 70, 0.12, "square", 0.13],
      miss: [420, 160, 0.14, "sine", 0.05],
      twang: [220, 90, 0.16, "triangle", 0.12],
      perfect: [880, 1500, 0.35, "triangle", 0.16],
      near: [520, 700, 0.2, "square", 0.08],
      block: [200, 100, 0.18, "sawtooth", 0.1],
      fail: [150, 90, 0.15, "sine", 0.1],
      guardbreak: [240, 50, 0.45, "sawtooth", 0.12],
    })[kind];
    const t = SOM._ac.currentTime,
      o = SOM._ac.createOscillator(),
      g = SOM._ac.createGain();
    o.type = P[3];
    o.frequency.setValueAtTime(P[0], t);
    o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
    g.gain.setValueAtTime(P[4], t);
    g.gain.exponentialRampToValueAtTime(0.001, t + P[2]);
    o.connect(g);
    g.connect(_out());
    o.start(t);
    o.stop(t + P[2] + 0.02);
    if (kind === "perfect") setTimeout(() => sfx("near"), 70);
  } catch (e) {}
}
/** v8.1 — a corda sendo puxada no básico do arco, por `dur` s: um chiado de couro no começo, a madeira rangendo
    (ruído em banda subindo de tom, picotado cada vez mais rápido) e a tensão da corda (tom baixo subindo). Devolve
    a função que corta o som quando a puxada acaba antes (alvo morreu, cancelou). */
export function somPuxarCorda(dur: number): () => void {
  try {
    const ac = (SOM._ac = SOM._ac || new (window.AudioContext || window.webkitAudioContext)()),
      t0 = ac.currentTime,
      fim = t0 + dur,
      saida = ac.createGain();
    saida.connect(_out());
    const ruido = (seg: number) => {
      const n = Math.max(1, Math.floor(ac.sampleRate * seg)),
        b = ac.createBuffer(1, n, ac.sampleRate),
        dd = b.getChannelData(0);
      for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
      const s = ac.createBufferSource();
      s.buffer = b;
      return s;
    };
    // couro e penas: a flecha encaixando
    const chiado = ruido(0.08),
      hp = ac.createBiquadFilter(),
      cg = ac.createGain();
    hp.type = "highpass";
    hp.frequency.value = 2800;
    cg.gain.setValueAtTime(0.12, t0);
    cg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    chiado.connect(hp);
    hp.connect(cg);
    cg.connect(saida);
    // a madeira rangendo
    const range = ruido(dur),
      bp = ac.createBiquadFilter(),
      pico = ac.createGain(),
      env = ac.createGain(),
      lfo = ac.createOscillator(),
      lfoG = ac.createGain();
    bp.type = "bandpass";
    bp.Q.value = 7;
    bp.frequency.setValueAtTime(240, t0);
    bp.frequency.exponentialRampToValueAtTime(820, fim);
    pico.gain.value = 0.55;
    lfo.type = "square";
    lfo.frequency.setValueAtTime(20, t0);
    lfo.frequency.linearRampToValueAtTime(46, fim);
    lfoG.gain.value = 0.45;
    lfo.connect(lfoG);
    lfoG.connect(pico.gain);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.16, t0 + 0.12);
    env.gain.linearRampToValueAtTime(0.07, t0 + dur * 0.5);
    env.gain.linearRampToValueAtTime(0.12, t0 + dur * 0.95);
    env.gain.linearRampToValueAtTime(0.0001, fim);
    range.connect(bp);
    bp.connect(pico);
    pico.connect(env);
    env.connect(saida);
    // a tensão da corda
    const o = ac.createOscillator(),
      lp = ac.createBiquadFilter(),
      og = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(310, fim);
    lp.type = "lowpass";
    lp.frequency.value = 900;
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.025, t0 + 0.3);
    og.gain.linearRampToValueAtTime(0.04, t0 + dur * 0.95);
    og.gain.linearRampToValueAtTime(0.0001, fim);
    o.connect(lp);
    lp.connect(og);
    og.connect(saida);
    const fontes = [chiado, range, lfo, o];
    for (const f of fontes) f.start(t0);
    for (const f of fontes) f.stop(fim + 0.05);
    return () => {
      try {
        const t = ac.currentTime;
        saida.gain.cancelScheduledValues(t);
        saida.gain.setValueAtTime(saida.gain.value, t);
        saida.gain.linearRampToValueAtTime(0, t + 0.08);
        for (const f of fontes) f.stop(t + 0.1);
      } catch (_) {}
    };
  } catch (e) {
    return () => {};
  }
}

export function spawnLoot(x: number, y: number, drop: boolean, boss?: boolean) {
  /* v6.8 — criatura do Campo: o saque vem da tabela dela */
  {
    const m = CRIT.cur;
    if (m && drop) {
      critLoot(m, typeof FIN !== "undefined" && FIN.on);
      return;
    }
  }
  const L = dungeon.loot,
    n0 = L ? L.length : 0;
  if (!(ISC.on && dungeon.mode === "intro")) {
    // v6.1 — nada cai durante a cena inicial
    if (!dungeon.training) {
      // v5.0 — nem na sala de treino
      const T = dungeon.tile,
        add = (k: string, px: number, py: number, tr?: number) =>
          dungeon.loot!.push({
            key: k,
            tier: tr! | 0,
            t: 0,
            ttl: k === "carne" ? 24 : 0,
            x: Math.max(T, Math.min(dungeon.cols * T - T, px)),
            y: Math.max(T, Math.min(dungeon.rows * T - T, py)),
          });
      const j = (r: number) => (Math.random() - 0.5) * r;
      if (drop) {
        // tudo que uma criatura solta nasce com qualidade A, A+ ou SS (o Alfa solta melhor)
        add("carne", x + j(24), y + j(24), rollTier(boss));
        if (Math.random() < 0.5) add(rollItemKey(), x + j(30), y + j(30), rollTier(boss));
        if (boss) {
          add("carne", x + j(50), y + j(50), rollTier(true));
          add("carne", x + j(50), y + j(50), rollTier(true));
          add("presa", x + j(50), y + j(50), rollTier(true));
          add("pele", x + j(50), y + j(50), rollTier(true));
          add("reliquia", x + j(40), y + j(40), rollTier(true));
          add(rollItemKey(), x + j(50), y + j(50), rollTier(true));
        }
      } else
        add(
          rollItemKey(),
          3 * T + Math.random() * (dungeon.cols * T - 4.5 * T),
          1.5 * T + Math.random() * (dungeon.rows * T - 3 * T),
        );
    }
    /* v5.9.07 — a carne lembra de que bicho veio (lobo ou javali) */
    if (drop && L) {
      let an = "lobo";
      try {
        const ms = dungeon.monsters || [];
        let best = 1e9;
        for (const m of ms) {
          const dd = Math.hypot(m.x - x, m.y - y);
          if (dd < best && dd < 6) {
            best = dd;
            an = m.kind === "javalino" || m.model === "boar" || m.kind === "boar" ? "javali" : "lobo";
          }
        }
      } catch (_) {}
      for (let i = n0; i < L.length; i++) if (L[i].key === "carne") L[i].an = an;
    }
    /* v6.0 — finalizar com a faca: qualidade +1 (+2) e pele inteira */
    if (FIN.on && drop && L) {
      for (let i = n0; i < L.length; i++)
        if (L[i].tier != null && !L[i].ground) {
          L[i].tier = Math.min(2, (L[i].tier! | 0) + 1 + (FIN.extra ? 1 : 0));
          L[i].fin = true;
        }
      if (Math.random() < 0.65 && !L.slice(n0).some((l) => l.key === "pele"))
        L.push({
          key: "pele",
          tier: Math.min(2, 1 + (FIN.extra ? 1 : 0)),
          t: 0,
          ttl: 0,
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          fin: true,
        });
      spawnDungeonToast("Pele inteira · qualidade +" + (FIN.extra ? 2 : 1), x, y - 56, "#9fe3ff", 12);
    }
  }
  /* v6.1.2 — joias (gemas) só vêm de criaturas de runas selvagens — bicho comum da masmorra não solta gema */
  if (drop && L)
    for (let i = n0; i < L.length; i++)
      if (L[i].key === "gema" && !L[i].runic) {
        let k = "gema";
        while (k === "gema") k = rollItemKey();
        L[i].key = k;
      }
}
export function xpBurst(x: number, y: number, col: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283,
      sp = 40 + Math.random() * 80;
    dungeon.parts!.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      t: 0,
      life: 1.1 + Math.random() * 0.3,
      col,
      r: 1.4 + Math.random() * 1.6,
    });
  }
}
export function shakeScreen(t: number, amp: number) {
  if (!OPT.shake) return;
  dungeon.shake = Math.max(dungeon.shake || 0, t);
  dungeon.shakeAmp = amp;
}
export function knockApart(m: Monster, wolfPx: number, playerPx: number) {
  // lobo e jogador são empurrados em sentidos opostos
  const dx = m.x - dungeon.px,
    dy = m.y - dungeon.py,
    n = Math.hypot(dx, dy) || 1;
  const _bf = m.boss ? 0.4 : 1;
  m.kx = (dx / n) * wolfPx * 9 * _bf;
  m.ky = (dy / n) * wolfPx * 9 * _bf;
  dungeon.pkx = -(dx / n) * playerPx * 9;
  dungeon.pky = -(dy / n) * playerPx * 9;
}

export function groundSync(it: Item) {
  if ((it.n || 1) <= 0) groundTake(it);
  else if (it._loot) it._loot.n = it.n;
}
export function bankLoot() {
  /* v6.7 — fim da abertura não leva nada ao baú · v5.9 — sair do acampamento também não */
  {
    const d = dungeon;
    if (d.active && d.mode === "intro" && econ.introDone) return;
  }
  if (dungeon.camp) return;
  const h = dungeon.hero!,
    inv = ensureInv(h);
  /* v7.7 — não guarda mais sozinho no baú (o mantenedor não gostou: voltava para a dungeon com a mochila vazia). O que
     está na mochila fica com o personagem; o baú do acampamento só guarda o que você põe nele. */
  let v = 0,
    n = 0;
  for (const src of [inv, h.inv2].filter(Boolean) as InvGrid[])
    for (const it of src.items) {
      if (isArrowIt(it)) continue;
      v += itemVal(it);
      n++;
    }
  pushEvent(h.name + " voltou da expedição com " + n + " item(ns) na mochila (valor " + v + ").");
}
/** v7.7 — a passagem do tempo no acampamento (#dh-hora, criado em iniciarHudCampo; o mantenedor quis sem número):
    o sol ou a lua e barrinhas do que falta do período, uma a cada TEMPO_CAMP.passo min (dia 5h30–19h30, noite o
    resto, como o sol/lua do mapa); nas duas últimas do dia elas ficam alaranjadas (entardecer). Só no acampamento. */
const TEMPO_CAMP = { amanhece: 5.5 * 60, anoitece: 19.5 * 60, passo: 120 };
function tempoAcampamento() {
  const el = document.getElementById("dh-hora");
  if (!el) return;
  const on = !!dungeon.camp;
  if (el.classList.contains("on") !== on) el.classList.toggle("on", on);
  if (!on) return;
  const T = TEMPO_CAMP,
    tod = world.tick % CONFIG.DAY_MIN,
    dia = tod >= T.amanhece && tod < T.anoitece,
    falta = dia ? T.anoitece - tod : (T.amanhece - tod + CONFIG.DAY_MIN) % CONFIG.DAY_MIN,
    total = Math.ceil((dia ? T.anoitece - T.amanhece : CONFIG.DAY_MIN - T.anoitece + T.amanhece) / T.passo),
    cheias = Math.min(total, Math.ceil(falta / T.passo)),
    k = (dia ? "d" : "n") + cheias + "/" + total;
  if (el.dataset.k === k) return;
  el.dataset.k = k;
  el.className = "on " + (dia ? (cheias <= 2 ? "tarde" : "dia") : "noite");
  el.title = dia ? "Dia · as barrinhas acabam ao anoitecer" : "Noite · as barrinhas acabam ao amanhecer";
  let b = "";
  for (let i = 0; i < total; i++) b += i < cheias ? "<b class='ch'></b>" : "<b></b>";
  el.innerHTML = icoTag(dia ? "ui_dia" : "ui_noite", dia ? "☀️" : "🌙") + "<span class='barras'>" + b + "</span>";
}
export function tryExit() {
  if (!dungeon.active || dungeon.dead) return;
  if (Math.hypot(dungeon.px - dungeon.entrance.x, dungeon.py - dungeon.entrance.y) > dungeon.tile * 1.5) {
    spawnDungeonToast("Vá até a SAÍDA verde para extrair", dungeon.px, dungeon.py - 28, "#7dff9a");
    return;
  }
  bankLoot();
  exitDungeon();
}
export function dungeonDeath() {
  /* v5.0 */
  const d = dungeon;
  if (!d.training) return dungeonDeathBase();
  d.hp = d.hpMax;
  d.dead = false;
  spawnDungeonToast("☠ Aqui você teria caído", d.px, d.py - 44, "#ff9a9a", 13);
  addRing(d.px, d.py, "#ff6a6a", 40, 0.4, 3);
}
// etapa de dungeonDeath: original
function dungeonDeathBase() {
  if (dungeon.dead) return;
  dungeon.dead = true;
  const h = dungeon.hero!,
    lost = ensureInv(h).items.length + (h.inv2 ? h.inv2.items.filter((i) => !isArrowIt(i)).length : 0);
  h.inv!.items = [];
  if (h.inv2) h.inv2.items = h.inv2.items.filter(isArrowIt);
  dungeon.hp = Math.floor(dungeon.hpMax * 0.5);
  spawnDungeonToast("Você caiu! Perdeu a mochila (" + lost + " itens)", dungeon.px, dungeon.py - 20, "#ff9a9a");
  pushEvent(h.name + " caiu na masmorra e perdeu " + lost + " item(ns).");
  setTimeout(() => {
    if (dungeon.active) exitDungeon();
  }, 1400);
}
function drawParticles(dt: number) {
  const c = TELAS.dCtx;
  for (let i = dungeon.parts!.length - 1; i >= 0; i--) {
    const p = dungeon.parts![i];
    p.t += dt;
    if (p.t > p.life) {
      dungeon.parts!.splice(i, 1);
      continue;
    }
    if (p.t < 0.35) {
      const k = Math.pow(0.04, dt);
      p.vx *= k;
      p.vy *= k;
    } else {
      // depois do estouro, as partículas de XP são "absorvidas" pelo personagem
      const dx = dungeon.px - p.x,
        dy = dungeon.py - 14 - p.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < 9) {
        dungeon.parts!.splice(i, 1);
        continue;
      }
      p.vx += (dx / d) * 700 * dt;
      p.vy += (dy / d) * 700 * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 260) {
        p.vx *= 260 / sp;
        p.vy *= 260 / sp;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    c.globalAlpha = Math.min(1, (p.life - p.t) * 2 + 0.2);
    c.fillStyle = p.col;
    c.shadowColor = p.col;
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  c.shadowBlur = 0;
}
export const PARRY_PERFECT = 0.2,
  PARRY_NEAR = 0.45; // segundos antes do golpe acertar
export function shieldWall() {
  // escudo erguido: lobo à frente não atravessa, para na borda do escudo
  const d = dungeon;
  if (!d.guard || d.weapon !== "melee" || d.guardBroken! > 0 || d.dead) return;
  const f = aimAngle(),
    T = d.tile;
  for (const m of d.monsters) {
    if (!m.alive) continue;
    const B = wolfBody(m),
      q = bodyDist(B, d.px, d.py),
      qx = q.x - d.px,
      qy = q.y - d.py;
    if (angDiff(Math.atan2(qy, qx), f) > 1.3) continue;
    const need = B.r + T * 0.42;
    if (q.d >= need) continue;
    if (m.st === "leap" && !m.hit && !dSafe()) {
      m.hit = true;
      m.recO = wolfStrike(m, m.lpr, 3 + Math.random() * 4, m.boss ? 1.3 : 1.2);
    }
    const ql = q.d || 0.01,
      ux = qx / ql,
      uy = qy / ql,
      push = need - q.d;
    m.x += ux * push;
    m.y += uy * push;
    const dot = (m.kx || 0) * ux + (m.ky || 0) * uy;
    if (dot < 0) {
      m.kx! -= ux * dot;
      m.ky! -= uy * dot;
    }
  }
}
function updateGuard(dt: number) {
  /* v5.9 */
  const d = dungeon,
    g0 = d.gstam!;
  /* v8.0 — a janela de parry (PARRY): conta o tempo desde o clique e a fatia acompanha ela e a mira */
  if (d.parryT != null) {
    d.parryT += dt;
    if (d.parryArc) d.parryArc = { ang: aimAngle(), x: d.px, y: d.py };
    if (d.parryT > PARRY_NEAR) d.parryT = null;
  }
  updateGuardBase(dt);
  tickCombateHumano(dt);
  /* v5.9 */
  if (d.gstam! > g0) d.gstam = g0 + (d.gstam! - g0) * survStamMult() * adrenalinaRecuperacao();
  /* v7.7 — fôlego interno (FOL_HEROI): teto do fôlego; zerar o fôlego tira 25%; só volta com o fôlego cheio */
  const H = FOL_HEROI;
  if (d.gint == null) d.gint = 100;
  // As duas barras são independentes: a interna é reserva de corrida, sem penalidade sobre a externa ao zerar.
  if (d.gstam! <= 0 && d.gint <= 0.01) d.runLock = true; // a reserva interna mantém a corrida depois que a externa zera
  if (!(d.gregen! > 0) && d.gstam! >= 99.99 && d.gint < 100) {
    // v8.0: o interno gasto segurando o arco cheio volta ARCO_FOL.volta × mais rápido
    const gi0 = d.gint;
    const faixa = d.gint > 50 ? 1 : d.gint > 25 ? 1 : d.gint > 12.5 ? 0.5 : 0.18;
    d.gint = Math.min(
      100,
      d.gint + H.volta * faixa * dt * (d.folArco! > 0 ? ARCO_FOL.volta : 1) * adrenalinaRecuperacao(),
    );
    if (d.folArco! > 0) d.folArco = Math.max(0, d.folArco! - (d.gint - gi0));
  }
}
function updateGuardBase(dt: number) {
  const d = dungeon;
  if (d.gstam == null) d.gstam = 100;
  if (d.gint == null) d.gint = 100;
  if (d.guard && d.hero && !heroEq(d.hero).maoE) {
    d.guard = false;
    if (!(d._noShT! > performance.now())) {
      d._noShT = performance.now() + 3000;
      spawnDungeonToast("Sem escudo equipado", d.px, d.py - 30, "#ff9a9a", 11);
    }
  }
  if (d.invuln! > 0) d.invuln! -= dt;
  if (d.guardBroken! > 0) {
    d.guardBroken! -= dt;
    d.guard = false;
    d.running = false;
    if (d.guardBroken! <= 0) d.gstam = 35;
    return;
  }
  if (d.guard && d.weapon === "melee") {
    d.gstam -= 7 * dt * nv(HERO()!, "est_terra", 1) * adrenalinaCusto();
    d.gregen = 0.8; // segurar o escudo cansa devagar; cada golpe bloqueado custa mais
    if (d.gstam <= 0) {
      d.gstam = 0;
      d.guard = false;
      d.guardBroken = 1.8;
      spawnDungeonToast("Fôlego acabou!", d.px, d.py - 40, "#ff9a9a");
      sfx("guardbreak");
    }
  } else if (d.running) {
    const custo = 20 * dt * runCostMult();
    if (d.gstam! > 0) {
      d.gstam = Math.max(0, d.gstam! - custo);
      if (d.gstam <= 0) {
        if (d.gint! > 0) {
          d.gint = Math.max(0, d.gint! - 25);
          d.gstam = 100;
        } else {
          d.runLock = true;
          d.running = false;
          spawnDungeonToast("Sem fôlego pra correr", d.px, d.py - 40, "#ffb347");
        }
      }
    }
    d.gregen = 0; // v7.7: parou de correr, o fôlego já volta
    if (d.gstam <= 0 && d.gint! <= 0) {
      d.gstam = 0;
      d.runLock = true;
      d.running = false;
      spawnDungeonToast("Sem fôlego pra correr", d.px, d.py - 40, "#ffb347");
    }
  } else {
    d.gregen = Math.max(0, (d.gregen || 0) - dt);
    if (d.gregen <= 0) {
      const v = 25 * dt * FOL_HEROI.voltaFora * adrenalinaRecuperacao(); // adrenalina recupera o fôlego mais rápido
      d.gstam = Math.min(100, d.gstam + v);
    }
  }
  if (d.gint! <= 25 && !d._cansadoAvisado) {
    d._cansadoAvisado = true;
    sfx("exausto");
  } else if (d.gint! > 25) d._cansadoAvisado = false;
  if (d.runLock && (d.gstam >= 25 || d.gint! >= 25)) d.runLock = false;
}
/** Alcance do básico da arma na mão, em tiles (do corpo do alvo): o golpe `step` do combo, faca, clava ou arco. */
function alcanceBasico(step = 0) {
  const d = dungeon;
  if (d.weapon === "bow") return ARCO_BASICO.alcance;
  return knifeMode() ? FACA2.reach : hvKind("L") === "clubL" ? 0.85 : COMBO[step].reach * wpnProf(d.hero!).reach;
}
/** Segurar Alt: o alcance do básico num anel fino no chão (e, no arco, o do tiro carregado mais apagado). Só o 2D aqui;
 *  no 3D o renderer desenha os anéis no chão (render/gl/renderer.ts). */
export function anelAlcance(): { basico: number; carregado: number } | null {
  const d = dungeon;
  if (!d.active || d.dead || !d.hero || !(d.keys?.AltLeft || d.keys?.AltRight)) return null;
  if (d.weapon !== "melee" && d.weapon !== "bow") return null;
  const T = d.tile;
  return { basico: T * alcanceBasico(0), carregado: d.weapon === "bow" ? bowRange(1) : 0 };
}
function drawAlcance() {
  const A = anelAlcance();
  if (!A || D3.gl) return;
  const c = TELAS.dCtx,
    d = dungeon;
  c.save();
  c.lineWidth = 1;
  c.strokeStyle = "rgba(239,233,221,.45)";
  c.beginPath();
  c.arc(d.px, d.py, A.basico, 0, 6.283);
  c.stroke();
  if (A.carregado) {
    c.setLineDash([3, 5]);
    c.strokeStyle = "rgba(239,233,221,.22)";
    c.beginPath();
    c.arc(d.px, d.py, A.carregado, 0, 6.283);
    c.stroke();
  }
  c.restore();
}
function autoAttack(dt: number) {
  const d = dungeon,
    m = d.alvoAutomatico;
  if (d.autoCd! > 0) d.autoCd = Math.max(0, d.autoCd! - dt);
  if (!m) return;
  if (!OPT.ataqueAutomatico || !d.active || d.dead || !m.alive || !d.monsters.includes(m)) {
    d.alvoAutomatico = null;
    if (d.hv?.kind === "clubL") d.hv = null;
    return;
  }
  if (
    d.invOpen ||
    d.craftOpen ||
    d.modalOpen ||
    ED.on ||
    !d.hero ||
    (d.weapon !== "melee" && d.weapon !== "bow") ||
    d.especialPressionado ||
    d.charging ||
    d.spCh ||
    d.hv ||
    d.crav ||
    d.noAtk! > 0 ||
    d.down! > 0 ||
    d.guard ||
    d.cd! > 0 ||
    d.autoCd! > 0 ||
    d.parryVis! > 0 ||
    m.kind === "bird"
  )
    return;
  const q = bodyDist(wolfBody(m), d.px, d.py),
    step = d.comboT! > 0 ? (d.combo || 0) % 3 : 0;
  if (q.d - wolfBody(m).r > d.tile * alcanceBasico(step)) return;
  if (d.weapon === "bow") {
    puxarBasico(m); // v8.1: puxa a corda (ARCO_BASICO.puxada s) e solta sozinha em updateCharge
    return;
  }
  // Reutiliza o golpe completo: combo, recarga, dano, avanço e efeitos da arma.
  const mouse = d.mouse;
  d.mouse = { x: q.x, y: q.y };
  try {
    swingBasic();
  } finally {
    d.mouse = mouse;
  }
  d.autoCd = atkSpeedMult() / ATAQUE_AUTO.porSeg;
}
function combatFx(dt: number) {
  const d = dungeon,
    c = TELAS.dCtx;
  {
    const el = document.getElementById("dungeon-arrows");
    if (el)
      icoSetHTML(
        el,
        icoTag("flecha", "🏹", "hud") +
          " " +
          econ.quiver.n +
          "/" +
          QUIVERS[econ.quiver.type] +
          (d.hotLeft! > 0 ? " · " + icoTag("btn_erva", "🌿", "hud") + " +" + Math.ceil(d.hotLeft!) : ""),
      );
  }
  if (d.herbCd! > 0) d.herbCd! -= dt;
  if (d.hotLeft! > 0 && !d.dead) {
    d.hotT = (d.hotT || 0) + dt;
    while (d.hotT >= 1 && d.hotLeft! > 0) {
      d.hotT -= 1;
      if (d.hp >= hpCap()) {
        d.hotLeft = 0;
        break;
      }
      const t = Math.min(herbTick(), d.hotLeft!, Math.max(1, Math.round(hpCap() - d.hp)));
      d.hotLeft! -= t;
      d.hp += t;
      spawnDungeonToast("+" + t, d.px, d.py - 22, "#9fe08a");
    }
  }
  updateGuard(dt);
  if (dt > 0) autoAttack(dt);
  if (Math.abs(d.pkx!) + Math.abs(d.pky!) > 4) {
    // deslocamento do jogador
    const T0 = d.tile;
    d.px = Math.max(T0, Math.min(d.cols * T0 - T0, d.px + d.pkx! * dt));
    d.py = Math.max(T0, Math.min(d.rows * T0 - T0, d.py + d.pky! * dt));
    const f = Math.exp(-9 * dt);
    d.pkx! *= f;
    d.pky! *= f;
  } else {
    d.pkx = 0;
    d.pky = 0;
  }
  if (d.shake! > 0) {
    d.shake! -= dt;
    const a = d.shakeAmp || 3;
    TELAS.dCanvas.style.transform =
      "translate(" +
      ((Math.random() - 0.5) * a * 2).toFixed(1) +
      "px," +
      ((Math.random() - 0.5) * a * 2).toFixed(1) +
      "px)";
  } else if (TELAS.dCanvas.style.transform) TELAS.dCanvas.style.transform = "";
  for (let i = d.rings!.length - 1; i >= 0; i--) {
    const r = d.rings![i];
    r.t += dt > 0 ? dt : d._realDt || 0;
    if (r.t >= r.life) {
      d.rings!.splice(i, 1);
      continue;
    }
    const p = r.t / r.life;
    c.beginPath();
    c.strokeStyle = r.col;
    c.globalAlpha = 1 - p;
    c.lineWidth = r.w * (1 - p * 0.5);
    c.arc(r.x, r.y, 8 + r.max * p, 0, 7);
    c.stroke();
    c.globalAlpha = 1;
  }
  if (d.invuln! > 0) {
    c.beginPath();
    c.strokeStyle = "rgba(255,224,138," + (0.5 + 0.4 * Math.sin(performance.now() / 80)) + ")";
    c.lineWidth = 3;
    c.arc(d.px, d.py, 17, 0, 7);
    c.stroke();
  }
  stamRing(c, d); // v6.9: stamina em círculo
  estadosDraw(c, d); // v8.1: fome, frio, tonta… no anel, nos selos e na fita (field/estados.ts)
  barrasRecursos(c); // v8.1: a vida da árvore ou da pedra golpeada (field/recursos_campo.ts)
  bandidosDraw2D(c, dungeon._realDt || 0); // v8.1: a mira e a flecha do bandido arqueiro (field/bandidos.ts)
}
export function doParry(this: unknown) {
  /* v7.3 — direito: faca não tem parry — vira a estocada que pode cravar */
  {
    const d = dungeon;
    if (d.active && !d.crav && knifeMode()) {
      knifeStab();
      return;
    }
  }
  /* v6.9 */
  if (dungeon.active && dungeon.crav) {
    cravRip();
    return;
  }
  /* v6.1.2 */
  const d = dungeon,
    h = d.hero;
  if (d.active && d.weapon === "melee" && h && !ensureEquip(h).maoD && !d.spearOut && !knifeIn(h)) return;
  const a = arguments as Repasse;
  return d.active && d.weapon === "melee" && h && !ensureEquip(h).maoD
    ? withBagKnife(() => doParryBase.apply(this, a))
    : doParryBase.apply(this, a);
}
// etapa de doParry: original + v5.8 + v5.9.02
function doParryBase() {
  /* v5.9.02 — botão direito do machado/clava = golpe pesado (sem parry) */
  {
    const k = hvKind("R");
    if (dungeon.weapon === "melee" && k) {
      hvStart(k);
      return;
    }
  }
  /* v5.8 */
  if (dungeon.down! > 0) return;
  if (!dungeon.active || dungeon.dead || dungeon.invOpen || dungeon.weapon !== "melee" || dungeon.parryCd! > 0) return;
  /* v8.0 — o clique abre a janela (PARRY); cada golpe que chega nela é avaliado em wolfStrike (parryNaChegada) */
  const d = dungeon;
  d.parryCd = PARRY.cd;
  d.parryMax = PARRY.cd;
  d.parryVis = PARRY_NEAR;
  d.parryT = 0;
  d.parryN = 0;
  d.parryArc = { ang: aimAngle(), x: d.px, y: d.py };
  sfx("swing");
}
/** v8.0 — um golpe de `m` chegou com a janela de parry aberta e de frente: perfeito (nenhum dano; devolve a recarga
    do bicho, atordoado) ou parcial (devolve o aparo parcial, que wolfStrike aplica). null = não aparou. */
export function parryNaChegada(m: Monster): { perfeito: number } | Aparo | null {
  const d = dungeon;
  if (d.parryT == null || d.weapon !== "melee" || !parryTouches(m)) return null;
  if (d.parryT > parryPerfectT()) return { kind: "near" };
  const h = d.hero!;
  d.parryN = (d.parryN || 0) + 1;
  addSwordPts(3);
  applyStun(m, nv(HERO()!, "parry_atordoante", 1.6));
  m.flash = 0.35;
  m.lx = m.x; // o bote para no aparo
  m.ly = m.y;
  onPerfectParry(m);
  knockApart(m, nodeRank(HERO()!, "est_fogo") ? 50 : 26, 6);
  const humano = !!m.humano; // v8.1: contra humanos, sem anéis nem texto: aço, faíscas e a pausa
  if (!humano) addRing(m.x, m.y, "#ffffff", 48, 0.4, 4);
  else hitSparks((m.x + d.px) / 2, (m.y + d.py) / 2, Math.atan2(m.y - d.py, m.x - d.px), 22, true);
  d.fx!.push({ x: m.x, y: m.y, life: 0.35 });
  hurtMonster(m, meleeDmg(h) * 2.2, "espada", 5);
  if (m.alive) folCansar(m, PARRY.cansaBicho); // aparar bem cansa o bicho (derrubar vem de jogar bem, não só de bater)
  // feedback: tela parada, câmera lenta curta, anel dourado nela, tremor, som e o texto grande
  d.cd = 0;
  d.parryVis = 0; // a fatia some: o contra-ataque sai na hora (a janela segue aberta para outro lobo)
  d.parryCd = PARRY.cdOk;
  d.parryMax = PARRY.cdOk;
  d.invuln = Math.max(d.invuln || 0, PARRY.invul);
  d.hitStop = Math.max(d.hitStop || 0, PARRY.congela * (humano ? 1.5 : 1));
  d.lenta = { k: PARRY.lenta, ate: performance.now() + PARRY.lentaMs };
  d._parryEm = performance.now();
  shakeScreen(0.18, 5);
  if (humano) sfx("aco");
  else {
    addRing(d.px, d.py, "#ffe08a", 34, 0.35, 3);
    spawnDungeonToast("PARRY!" + (d.parryN > 1 ? " x" + d.parryN : ""), d.px, d.py - 44, "#fff1c2", 20);
  }
  sfx("perfect");
  return { perfeito: m.t };
}
function drawWorldExtras(dt: number) {
  const c = TELAS.dCtx,
    T = dungeon.tile;
  dungeon.parryCd = Math.max(0, (dungeon.parryCd || 0) - dt);
  drawSafeZone();
  runeDraw2D();
  armasDraw2D();
  boarDraw2D();
  drawDungeonLoot(dt);
  // escudo erguido, janela de parry e lobos lentos
  const f = aimAngle();
  if (dungeon.weapon === "melee" && dungeon.guard) {
    const R0 = T * 0.42 + 10;
    c.save();
    c.beginPath();
    c.arc(dungeon.px, dungeon.py, R0, f - 1.15, f + 1.15);
    c.arc(dungeon.px, dungeon.py, R0 - 7, f + 1.15, f - 1.15, true);
    c.closePath();
    c.fillStyle = "rgba(159,227,255,0.22)";
    c.fill();
    c.strokeStyle = "rgba(159,227,255,0.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(dungeon.px, dungeon.py, R0, f - 1.15, f + 1.15);
    c.stroke();
    c.restore();
  }
  if (dungeon.parryVis! > 0) {
    // parry: a fatia desenhada É a área de contato
    dungeon.parryVis! -= dt;
    const pr = dungeon.parryArc || { ang: f, x: dungeon.px, y: dungeon.py },
      al = Math.min(1, Math.max(0, dungeon.parryVis! * 4));
    c.beginPath();
    c.moveTo(pr.x, pr.y);
    c.arc(pr.x, pr.y, T * 0.9, pr.ang - 1.3, pr.ang + 1.3);
    c.closePath();
    c.fillStyle = "rgba(255,255,255," + 0.025 * al + ")";
    c.fill();
    c.beginPath();
    c.strokeStyle = "rgba(255,255,255," + al + ")";
    c.lineWidth = 1.25;
    c.arc(pr.x, pr.y, T * 0.9, pr.ang - 1.3, pr.ang + 1.3);
    c.stroke();
  }
  for (const m of dungeon.monsters) {
    if (!m.alive) continue;
    if ((m.st === "windup" && m.t <= PARRY_NEAR) || m.st === "leap") {
      // círculo do golpe em volta do lobo: se tocar o parry, o parry vale
      const pf = m.st === "leap" || m.t <= parryPerfectT();
      c.beginPath();
      c.strokeStyle = pf ? "#ffffff" : "#ffb347";
      c.lineWidth = pf ? 1.5 : 1;
      c.arc(m.x, m.y, m.st === "leap" ? T * 0.85 : T * (m.boss ? 1.25 : 0.95), 0, 7);
      c.stroke();
    }
    if (m.st === "windup" && m.t <= PARRY.anel && dungeon.weapon === "melee") {
      // v8.0: o anel que fecha: encolhe até o círculo do golpe no instante em que ele chega (aperte quando encostar)
      const base = T * (m.boss ? 1.25 : 0.95),
        r = base + (m.t / PARRY.anel) * T * 1.3;
      c.beginPath();
      c.strokeStyle = "rgba(255,255,255," + (0.35 + 0.5 * (1 - m.t / PARRY.anel)) + ")";
      c.lineWidth = 2;
      c.arc(m.x, m.y, r, 0, 7);
      c.stroke();
    }
    if (m.low === "frenzy") {
      c.beginPath();
      c.strokeStyle = "rgba(255,70,40," + (0.35 + 0.25 * Math.sin(performance.now() / 110)) + ")";
      c.lineWidth = 2;
      c.arc(m.x, m.y, monR(m) + 5, 0, 7);
      c.stroke();
    }
    if (m.fleeT! > 0) {
      c.font = "14px serif";
      c.textAlign = "center";
      c.fillText("💨", m.x, m.y - monR(m) - 14);
    }
    drawStatus(c, m);
  }
  drawParticles(dt);
}
function bowNeed(l: number) {
  return 8 + 4 * (l - 1);
}
export function addBowPts(n: number) {
  if (dungeon.training) return; // v5.0: na Sala de Treino a maestria não sobe (é só teste)
  const h = dungeon.hero!,
    b = h.bowMastery || (h.bowMastery = { lvl: 1, pts: 0 }); // só visual: não altera dano
  b.pts += n;
  dungeon.bowFlash = 0.5;
  spawnDungeonToast("+" + n + " Arco", dungeon.px, dungeon.py - 40, "#9fe3ff");
  while (b.pts >= bowNeed(b.lvl)) {
    b.pts -= bowNeed(b.lvl);
    b.lvl++;
    spawnDungeonToast("Maestria do Arco Nv." + b.lvl + "!", dungeon.px, dungeon.py - 56, "#ffe08a");
    xpBurst(dungeon.px, dungeon.py - 10, "#ffe08a", 22);
  }
}
function updateBowHud(dt: number) {
  const el = document.getElementById("bow-hud");
  if (el) el.style.display = "none";
  dungeon.bowFlash = Math.max(0, (dungeon.bowFlash || 0) - dt);
}
export function addSwordPts(n: number) {
  // maestria da espada: sobe a cada golpe que acerta (finalizador e parry valem mais) — só visual, como a do arco
  if (dungeon.training) return; // v5.0: na Sala de Treino a maestria não sobe (é só teste)
  const h = dungeon.hero;
  if (!h) return;
  // Os chamadores antigos compartilham parry/golpes entre armas; não atribui esses pontos à espada se outra arma está equipada.
  const armaEquipada = ensureEquip(h).maoD?.def.key;
  if (armaEquipada && armaEquipada !== "eq_espada") return;
  const b = h.swordMastery || (h.swordMastery = { lvl: 1, pts: 0 });
  b.pts += n;
  dungeon.swFlash = 0.5;
  while (b.pts >= bowNeed(b.lvl)) {
    b.pts -= bowNeed(b.lvl);
    b.lvl++;
    spawnDungeonToast("Maestria da Espada Nv." + b.lvl + "!", dungeon.px, dungeon.py - 58, "#ffe08a", 14);
    sfx("ping");
  }
}
function updateSwordHud(dt: number) {
  updateSwordHudBase(dt);
  /* v6.5 */
  try {
    updatePercHud(dt);
  } catch (_) {}
}
function updateSwordHudBase(dt: number) {
  const el = document.getElementById("sword-hud");
  if (!el) return;
  el.style.display = "none";
  dungeon.swFlash = Math.max(0, (dungeon.swFlash || 0) - dt);
}
function drawDungeonExtras(dt: number) {
  drawHitFx(dt);
  combatFx(dt);
  updateBowHud(dt);
  updateSwordHud(dt);
  progressoHudTick();
  updateFocusHud();
  rastreioTick(); // v7.7
  updateCharge(dt);
  drawAlcance();
  drawAim();
  spearAimDraw();
  drawMeleeBar();
  drawHurtFx(dt);
  drawWorldExtras(dt);
  const T = dungeon.tile,
    c = TELAS.dCtx;
  dungeon.cd = Math.max(0, dungeon.cd! - dt);
  if (dungeon.slash && dungeon.slash.life > 0) {
    // arco do golpe de espada
    const sl = dungeon.slash;
    sl.life -= dt;
    const al = Math.max(0, sl.life / 0.2),
      ox = sl.ox != null ? sl.ox : dungeon.px,
      oy = sl.oy != null ? sl.oy : dungeon.py,
      R = T * (sl.reach || 0.62),
      hf = sl.half || 0.85;
    c.save();
    c.lineCap = "round";
    if (sl.thrust) {
      c.translate(ox, oy);
      c.rotate(sl.ang);
      const k = 1 - al,
        x0 = R * (0.25 + 0.35 * k);
      c.fillStyle = "rgba(255,248,227," + 0.5 * al * (D3.gl ? 0.6 : 1) + ")";
      c.beginPath();
      c.moveTo(x0, -3 * al);
      c.lineTo(R + 6, 0);
      c.lineTo(x0, 3 * al);
      c.closePath();
      c.fill();
      c.restore();
    } else {
      c.beginPath();
      c.moveTo(ox, oy);
      c.arc(ox, oy, R, sl.ang - hf, sl.ang + hf);
      c.closePath();
      c.fillStyle = "rgba(255,248,227," + 0.26 * al * (D3.gl ? 0.5 : 1) + ")";
      c.fill();
      c.strokeStyle = "rgba(255,248,227," + al * (D3.gl ? 0.35 : 1) + ")";
      c.lineWidth = sl.step === 2 ? 6 : 3;
      c.beginPath();
      c.arc(ox, oy, R, sl.ang - hf, sl.ang + hf);
      c.stroke();
      c.restore();
    }
  }
  dungeon.comboT = Math.max(0, (dungeon.comboT || 0) - dt);
  if (dungeon.comboT > 0 && dungeon.combo! > 0)
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.fillStyle = i < dungeon.combo! ? "#ffe08a" : "rgba(255,255,255,0.25)";
      c.arc(dungeon.px - 10 + i * 10, dungeon.py + (D3.gl ? 16 : -24), 3, 0, 7);
      c.fill();
    }
  for (const m of dungeon.monsters) {
    if (!m.alive) continue;
    if (m.bleed) {
      c.fillStyle = "#c1272d";
      c.beginPath();
      c.arc(m.x + 9, m.y - 19 + Math.sin(performance.now() / 120) * 2, 2.6, 0, 7);
      c.fill();
    }
    // v8.1 (mantenedor): contra humanos, sem aviso no chão: o golpe se lê no corpo dele (bandidos_gl.ts)
    if (m.humano) continue;
    if (m.st === "windup") {
      drawCone(c, m, clamp(1 - m.t / (m.wuTot || 0.75), 0, 1));
    } else if (m.st === "recover" && !D3.gl) {
      c.beginPath();
      c.strokeStyle = "#9fe3ff";
      c.lineWidth = 2;
      c.arc(m.x, m.y, 15, 0, 7);
      c.stroke();
    }
  }
  /* v7.7 — alvo prioritário em laranja e foco em branco; quando coincidem, usam um único anel com marcas. */
  const t = dungeon.target,
    fo = dungeon.foco && dungeon.foco.alive ? dungeon.foco : null,
    // No modo 2D usa os pés; no WebGL o anel é desenhado no chão pelo renderer.
    tc = t,
    fc = fo;
  if (!D3.gl && t && tc && t.alive && fo !== t) {
    c.beginPath();
    c.strokeStyle = "#ff9a3c";
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    c.lineDashOffset = -performance.now() / 60;
    c.arc(tc.x, tc.y, 15, 0, 7);
    c.stroke();
    c.setLineDash([]);
  }
  if (!D3.gl && fo && fc) {
    const R = fo === t ? 17 : 15;
    c.save();
    c.strokeStyle = fo === t ? "rgba(255,154,60,0.9)" : "rgba(255,255,255,0.55)";
    c.lineWidth = 1.25;
    c.beginPath();
    c.arc(fc.x, fc.y, R, 0, 7);
    c.stroke();
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      c.moveTo(fc.x + Math.cos(a) * (R - 4), fc.y + Math.sin(a) * (R - 4));
      c.lineTo(fc.x + Math.cos(a) * (R + 3), fc.y + Math.sin(a) * (R + 3));
    }
    c.stroke();
    c.restore();
  }
  rastreioMarcas(c); // v7.7
  if (D3.on) {
    c.save();
    d3Shift(c, 14);
    drawArrows(dt);
    c.restore();
  } else drawArrows(dt);
  for (let i = dungeon.fx!.length - 1; i >= 0; i--) {
    const f = dungeon.fx![i];
    f.life -= dt;
    if (f.life <= 0) {
      dungeon.fx!.splice(i, 1);
      continue;
    }
    c.beginPath();
    c.strokeStyle = "rgba(255,240,200," + f.life * 4 + ")";
    c.lineWidth = 3;
    c.arc(f.x, f.y, 16, -0.9, 0.9);
    c.stroke();
  }
  if (!D3.gl) {
    c.font = "13px serif";
    c.textAlign = "center";
    c.fillText(dungeon.weapon === "bow" ? "🏹" : "⚔", dungeon.px + 17, dungeon.py - 4);
  }
  if (dungeon.cd > 0) {
    const w = 24 * (dungeon.cd / WEAPONS[dungeon.weapon!].cd);
    c.fillStyle = "rgba(0,0,0,.5)";
    c.fillRect(dungeon.px - 12, dungeon.py + 16, 24, 3);
    c.fillStyle = "#ffd27a";
    c.fillRect(dungeon.px - 12, dungeon.py + 16, w, 3);
  }
}
export function renderDungeonFrame(deltaSec: number) {
  const realDt = deltaSec;
  dungeon._realDt = realDt;
  if (dungeon.invOpen || dungeon.craftOpen || dungeon.modalOpen) deltaSec = 0; // mochila / craft / mensagem aberta = jogo pausado
  if (ED.on) deltaSec = 0; // v8.1: o Modo Editor pausa o campo (editor/editor.ts)
  if (dungeon.camLenta != null) deltaSec *= dungeon.camLenta; // v8.0: câmera lenta (a lição do rolamento na cena inicial)
  if (dungeon.lenta) {
    // v8.0: câmera lenta curta do parry perfeito e da esquiva no último instante (até `ate`, em tempo real)
    if (performance.now() > dungeon.lenta.ate) dungeon.lenta = null;
    else deltaSec *= dungeon.lenta.k;
  }
  if (dungeon.hitStop! > 0) {
    dungeon.hitStop! -= deltaSec;
    deltaSec = 0;
  }
  runeDungeonTick(deltaSec);
  armasTick(deltaSec);
  trainTick(deltaSec);
  boarTick(deltaSec);
  survTick(deltaSec);
  mobDungeonTick(); // congelada no impacto (hit-stop)
  TELAS.dCtx.setTransform(1, 0, 0, 1, 0, 0);
  TELAS.dCtx.clearRect(0, 0, TELAS.dCanvas.width, TELAS.dCanvas.height);
  const _dk = dungeon.k || 1;
  TELAS.dCtx.setTransform(_dk, 0, 0, _dk, 0, 0);
  TELAS.dCtx.imageSmoothingEnabled = true;
  TELAS.dCtx.imageSmoothingQuality = "high";
  if (D3.on) {
    d3Install();
    D3.inFrame = true;
    if (!D3.cw) fitDungeonCanvas();
    if (D3.gl) {
      if (!ED.on) d3Follow(0.12); // v8.1: no editor a câmera é solta
      if (dungeon.mouseC) dungeon.mouse = dPoint(dungeon.mouseC);
    }
    d3Ground();
  }
  updateDungeonFlow(deltaSec);
  if (!deltaSec && dungeon.banner) {
    dungeon.banner.t -= realDt;
    if (dungeon.banner.t <= 0) dungeon.banner = null;
  }

  // piso em xadrez simples + parede de borda
  if (D3.on) d3Scene(performance.now());
  else
    for (let gy = 0; gy < dungeon.rows; gy++) {
      for (let gx = 0; gx < dungeon.cols; gx++) {
        const isWall = gx === 0 || gy === 0 || gx === dungeon.cols - 1 || gy === dungeon.rows - 1;
        TELAS.dCtx.fillStyle = isWall ? "#2e2416" : (gx + gy) % 2 === 0 ? "#4a3d28" : "#443823";
        TELAS.dCtx.fillRect(gx * dungeon.tile, gy * dungeon.tile, dungeon.tile, dungeon.tile);
      }
    }

  // movimento do jogador (WASD + clique; lento enquanto puxa o arco)
  const _kk = dungeon.keys || {},
    _wantRun =
      ((_kk.ShiftLeft || _kk.ShiftRight) && (_kk.KeyW || _kk.KeyA || _kk.KeyS || _kk.KeyD || dungeon.moveTarget)) ||
      !!(dungeon.joy && dungeon.joy.run);
  dungeon.running = !!(
    _wantRun &&
    !dungeon.guard &&
    !dungeon.charging &&
    !dungeon.runLock &&
    !(dungeon.guardBroken! > 0) &&
    (dungeon.gstam! > 0 || dungeon.gint! > 0) &&
    deltaSec > 0
  );
  const alvoCorrida = fatorCorrida(dungeon.gint ?? 100);
  dungeon.fatorCorrida =
    (dungeon.fatorCorrida ?? alvoCorrida) +
    (alvoCorrida - (dungeon.fatorCorrida ?? alvoCorrida)) * (1 - Math.exp(-FOL_HEROI.suavizarCorrida * deltaSec));
  const _spd =
    (26 + attrOf(dungeon.hero!, "velocidade") * STAT.velMove) *
    deltaSec *
    (dungeon.down! > 0 ? 0 : dungeon.dazed! > 0 ? 0.65 : 1) *
    ((dungeon.debilitadoT || 0) > 0 ? 0.85 : 1) *
    survMoveMult() *
    (dungeon.mount && dungeon.mount.mounted ? ((dungeon.running ? 1.35 : 1.8) * MOUNT.spd[mountLv() - 1]) / 1.55 : 1) *
    // v8.1: mirando a lança anda e corre normal (a mira balança: LANCA_BALANCO, field/armas.ts)
    (dungeon.charging || dungeon.hv
      ? 0.45
      : dungeon.guard
        ? 0.55
        : dungeon.running
          ? 1.7
          : dungeon.joy && (dungeon.joy.jog || dungeon.joy.run)
            ? 1.35
            : 1) *
    (dungeon.boost! > 0 ? 1.4 : 1) *
    craftRapidoAndar() * // v8.1: fazendo algo segurando C, anda mais devagar (field/craft_rapido.ts)
    (dungeon.running ? dungeon.fatorCorrida : 1);
  {
    const k = dungeon.keys || {},
      J = dungeon.joy && (dungeon.joy.x || dungeon.joy.y) ? dungeon.joy : null;
    let ax = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      ay = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    if (J) {
      ax = J.x;
      ay = J.y;
    }
    if (ax || ay) {
      dungeon.moveTarget = null;
      const n = J ? 1 : Math.hypot(ax, ay),
        lim = dungeon.tile;
      // v8.0: no campo aberto, a água do mapa e os troncos barram (map/mundo.ts)
      [dungeon.px, dungeon.py] = mundoMover(
        dungeon.px,
        dungeon.py,
        Math.max(lim, Math.min(dungeon.cols * dungeon.tile - lim, dungeon.px + (ax / n) * _spd)),
        Math.max(lim, Math.min(dungeon.rows * dungeon.tile - lim, dungeon.py + (ay / n) * _spd)),
      );
    }
  }
  if (dungeon.moveTarget) {
    const spd = _spd;
    const dx = dungeon.moveTarget.x - dungeon.px,
      dy = dungeon.moveTarget.y - dungeon.py;
    const dist = Math.hypot(dx, dy);
    if (dist < spd) {
      dungeon.px = dungeon.moveTarget.x;
      dungeon.py = dungeon.moveTarget.y;
      dungeon.moveTarget = null;
    } else {
      const x0 = dungeon.px,
        y0 = dungeon.py;
      [dungeon.px, dungeon.py] = mundoMover(x0, y0, x0 + (dx / dist) * spd, y0 + (dy / dist) * spd);
      if (dungeon.px === x0 && dungeon.py === y0) dungeon.moveTarget = null; // barrado: para
    }
  }
  craftRapidoTick(deltaSec > 0); // v8.1: segurar C faz a receita escolhida (field/craft_rapido.ts)

  // monstros
  drawBirds(deltaSec);
  for (const m of dungeon.monsters) {
    if (!m.alive) continue;
    updateDungeonMonster(m, deltaSec);
    if (deltaSec > 0) shieldWall();
    if (D3.on) {
      const _sz = m.boss ? 58 : 32;
      D3.q.push({ y: m.y, f: () => d3Bill(m.x, m.y, D3.gl ? 0 : _sz * 0.38, () => drawDungeonMonster(m)) });
    } else drawDungeonMonster(m);
  }

  // jogador
  const h = dungeon.hero!;
  if (D3.on) {
    if (D3.gl) glFrame();
    editorQuadro(realDt); // v8.1: o Modo Editor (câmera, ícones, alfinetes), quando aberto
    D3.q.push({ y: dungeon.py, f: () => d3Bill(dungeon.px, dungeon.py, D3.gl ? 0 : 25, () => d3Hero(h)) });
    d3Flush();
    d3Near();
  } else {
    TELAS.dCtx.beginPath();
    TELAS.dCtx.fillStyle = h.color;
    TELAS.dCtx.arc(dungeon.px, dungeon.py, 12, 0, Math.PI * 2);
    TELAS.dCtx.fill();
    TELAS.dCtx.strokeStyle = "#1c140b";
    TELAS.dCtx.lineWidth = 1.6;
    TELAS.dCtx.stroke();
    TELAS.dCtx.font = "11px Lora, serif";
    TELAS.dCtx.textAlign = "center";
    TELAS.dCtx.fillStyle = "#1c140b";
    TELAS.dCtx.fillText(h.name, dungeon.px + 0.5, dungeon.py - 17.5);
    TELAS.dCtx.fillStyle = "#fff8e3";
    TELAS.dCtx.fillText(h.name, dungeon.px, dungeon.py - 18);
  }

  drawDungeonExtras(deltaSec);
  drawBanner();
  // toasts de combate
  for (let i = dungeon.toasts.length - 1; i >= 0; i--) {
    const t = dungeon.toasts[i];
    t.life -= realDt * 0.55; // avisos (dano, item, fogueira) seguem mesmo com o jogo pausado
    if (t.life <= 0) {
      dungeon.toasts.splice(i, 1);
      continue;
    }
    const desenharToast = () => {
      if (t.dmg) {
        TELAS.dCtx.globalAlpha = Math.max(0, t.life);
        dmgNumDraw(TELAS.dCtx, t, realDt);
        TELAS.dCtx.globalAlpha = 1;
        return;
      }
      // Os números de dano e ícones continuam; rótulos não ganham símbolos substitutos.
      if (!t.icon) return;
      TELAS.dCtx.globalAlpha = Math.max(0, t.life);
      if (t.icon) {
        const k = 1 + Math.max(0, t.life - 0.82) * 3.2,
          fs = Math.round((t.size || 20) * k);
        TELAS.dCtx.font = fs + "px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
        TELAS.dCtx.textAlign = "center";
        TELAS.dCtx.shadowColor = t.color;
        TELAS.dCtx.shadowBlur = 10;
        TELAS.dCtx.fillStyle = t.color;
        if (!icoToast(TELAS.dCtx, t.text, t.x, t.y - (1 - t.life) * 22, fs * 1.1))
          TELAS.dCtx.fillText(t.text, t.x, t.y - (1 - t.life) * 22);
        TELAS.dCtx.shadowBlur = 0;
        TELAS.dCtx.globalAlpha = 1;
        return;
      }
      TELAS.dCtx.globalAlpha = 1;
    };
    if (D3.on) d3Bill(t.x, t.y, 0, desenharToast);
    else desenharToast();
  }

  D3.inFrame = false;
  // HUD de vida
  {
    const d = dungeon,
      hh = ensureHero(d.hero!);
    if (d.hpTrail == null || d.hpTrail < d.hp) d.hpTrail = d.hp;
    else if (d.sinceHurt! > 0.45) d.hpTrail = Math.max(d.hp, d.hpTrail - d.hpMax * 0.3 * deltaSec);
    const $e = (i: string) => document.getElementById(i)!,
      pts = treePoints(hh);
    $e("dungeon-hp-trail").style.width = Math.max(0, (d.hpTrail / d.hpMax) * 100) + "%";
    $e("dungeon-hp-wrap").classList.toggle("shake", d.hpBarShake! > 0);
    $e("dungeon-hp-fill").style.background = d.hp < d.hpMax * 0.3 ? "linear-gradient(90deg,#b01818,#ff4a4a)" : "";
    $e("dh-name").textContent = hh.name;
    $e("dh-lvl").textContent = "Nv." + hh.lvl;
    $e("dh-aff").textContent = AFFINITIES[hh.aff].icon;
    $e("dh-xpfill").style.width = Math.round((hh.xp / xpNeed(hh.lvl)) * 100) + "%";
    const st = $e("dh-st");
    st.style.width = Math.max(0, d.gstam == null ? 100 : d.gstam) + "%";
    st.style.background = d.guardBroken! > 0 ? "#ff6b6b" : d.runLock ? "#ffb347" : d.running ? "#b8f08a" : "#9fe3ff";
    $e("dh-pts").textContent = pts > 0 ? " ●" + pts : "";
  }
  document.getElementById("dungeon-hp-fill")!.style.width = Math.max(0, (dungeon.hp / dungeon.hpMax) * 100) + "%";
  document.getElementById("dungeon-hp-label")!.textContent = Math.round(dungeon.hp) + " / " + dungeon.hpMax;
  const _L = h.loot || {};
  /* v7.7 — HUD compacta: na barra só o valor da mochila; o resto (guardado, lenha, pedra, penas) no title */
  {
    const el = document.getElementById("dungeon-loot-label")!,
      tit =
        "Na mochila: " +
        invValue(h) +
        " · guardado " +
        (h.banked || 0) +
        " · lenha " +
        (_L.wood || 0) +
        " · pedra " +
        resCount(h, "stone") +
        " · penas " +
        (resCount(h, "feather") + resCount(h, "eagle"));
    el.textContent = "🎒 " + invValue(h);
    if (el.title !== tit) el.title = tit;
  }
  document.getElementById("dungeon-wave-label")!.textContent = dungeon.camp
    ? "⛺ Acampamento"
    : dungeon.training
      ? "🧪 Dungeon Teste"
      : dungeon.mode === "survival"
        ? "☠ Sobrevivência"
        : dungeon.flow === "boss"
          ? "👑 Chefe: Lobo Alfa"
          : dungeon.flow === "complete"
            ? "🏆 Coleta: " +
              ((s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"))(
                Math.ceil(Math.max(0, dungeon.flowT!)),
              ) +
              " até a Sobrevivência"
            : dungeon.wave
              ? "🐺 Horda " + dungeon.wave + "/" + EXP_WAVES.length + " · lobos: " + livingMonsters()
              : "Prepare-se…";
  tempoAcampamento();
  /* v7.7 — Teste e 3D: só o ícone; ligado = botão selecionado (36_v7.7_botoes.css), o estado vai no title */
  {
    const bt = document.getElementById("dungeon-test")!,
      b3 = document.getElementById("dungeon-3d")!;
    bt.textContent = "🧪";
    bt.classList.toggle("active", !!econ.test);
    bt.title = "Modo teste: " + (econ.test ? "ligado" : "desligado");
    b3.textContent = "🧊 3D";
    b3.classList.toggle("active", D3.on);
    b3.title = "Visão 3D inclinada: " + (D3.on ? "ligada" : "desligada (2D clássica)");
  }
  const espadaLv = (h.skills.espada && h.skills.espada.level) || 0;
  document.getElementById("dungeon-skill-label")!.textContent = h.skills.espada
    ? "Espada Nv." + espadaLv
    : "Espada: ainda não treinada";
}
