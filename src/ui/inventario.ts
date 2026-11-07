/* ==== Fase 4 ====
   a mochila na tela: dica de item, organizar, boneco, layout, menu do item (v5.9.02, v5.9.03, v6.5, v6.6) */
import { eqSlotClick } from "../items/equipamento.ts";
import { equiparBolsa, desequiparBolsa } from "../items/mochilas.ts";
import { econ, dungeon, GL3, world } from "../core/state.ts";
import { ORG_COST, WARM, FOOD } from "../data/sobrevivencia.ts";
import { canPlace, rotShape, shapeCells, INV, ensureInv, TIERS } from "../items/inventario.ts";
import { sfx, renderInv, groundTake, groundPut, buildGroundInv, dropToGround, toggleInv } from "../field/chao.ts";
import { prep, bag, updateEcon, moveItem } from "../econ/economia.ts";
import { renderPrep, prepHero, closePrep } from "../expedicao/preparo.ts";
import { renderBag, closeBag } from "./janelas.ts";
import { renderChest } from "../econ/bau.ts";
import { mvToast } from "./avisos.ts";
import { spawnDungeonToast, dEqTake, updateWeaponUI, itemMsg } from "../field/masmorra.ts";
import { ensureEquip, equipItem, placeIn, unequip, eqQ } from "../items/equipamento.ts";
import { ALT_K, DOLL_ARMOR } from "../data/mapa.ts";
import { EQ_SLOTS, EQ_BASE } from "../data/equipamento.ts";
import { eqName, eqPct, eqDurInit, eqDurCol } from "../items/durabilidade.ts";
import { icoItemQ, icoTag, icoKeyOf, icoItem } from "./icones.ts";
import { INV_CELL } from "../data/itens.ts";
import { ISC, introObj, knifeAnalyzeOpen } from "../intro/cena.ts";
import { gemDecor, gemStage, stoneDecor, itName } from "../items/arte.ts";
import { GEMS, GEM_STN, STONES } from "../data/arte.ts";
import { MAT_ICO } from "../data/icones.ts";
import { mixTxt, mixOfKey, armorPiece, penDe } from "../field/dano.ts";
import { danoMedio, danoTxt, dpsArma, ehArma, mixDaArma, seloDano } from "../items/dano_medio.ts";
import { DANO, WPN_OF, WPN_TXT } from "../data/combate.ts";
import { cravFam } from "../field/tipos.ts";
import { afText } from "../hero/atributos.ts";
import { itemKg, valorComida } from "../survival/sobrevivencia.ts";
import { itemVal } from "../items/qualidade.ts";
import { forgeKnows } from "../forja/forja.ts";
import { anaOpen } from "../forja/analise.ts";
import { isArrowIt, bundleReload, arrowsToBag } from "../items/aljava.ts";
import { PACK_KEYS } from "../data/campo.ts";
import { encaixeVazio, silhuetaDe } from "./contornos.ts";
import { faixaCintoHtml } from "./cinto_tela.ts";
import { soltarDoCinto } from "../items/cinto.ts";
import type { GradeTela, Hero, InvGrid, Item } from "../core/tipos.ts";

export const INVF = { t: 0, full: false };

/* ---------------- 🧹 Organizar (10 de ouro) ---------------- */
export function orgButton(gr: GradeTela) {
  /* v5.9.03 — mochila da masmorra: o botão fica no rodapé */
  if (gr.el && gr.el.id === "inv-grid") {
    const f = document.getElementById("inv-foot");
    if (!f) return;
    let b = document.getElementById("inv-org-d");
    if (!b) {
      b = document.createElement("button");
      b.className = "btn inv-org";
      b.id = "inv-org-d";
      f.prepend(b);
    }
    b.innerHTML = "🧹 Organizar mochila <small>" + (econ.test ? "grátis" : ORG_COST + "💰") + "</small>";
    b.onclick = (e) => {
      e.stopPropagation();
      orgRun(gr.inv);
    };
    return;
  }
  const inv = gr.inv,
    g = gr.el;
  if (!g || !g.parentNode || inv.qv || inv.ground || inv.fixed) return;
  let b = g.previousElementSibling as HTMLElement;
  if (!b || !b.classList || !b.classList.contains("inv-org")) {
    b = document.createElement("button");
    b.className = "btn inv-org";
    g.parentNode.insertBefore(b, g);
  }
  b.innerHTML = "🧹 Organizar <small>" + (econ.test ? "grátis" : ORG_COST + "💰") + "</small>";
  b.title = "Arruma os itens para sobrar o máximo de espaço livre (custa " + ORG_COST + " de ouro)";
  b.onclick = (e: Event) => {
    e.stopPropagation();
    orgRun(inv);
  };
}
function orgScan(inv: InvGrid, sh: number[][], colMajor: boolean) {
  const W = inv.cols - sh[0].length,
    H = inv.rows - sh.length;
  if (colMajor) {
    for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++) if (canPlace(inv, sh, x, y)) return { x, y };
  } else {
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) if (canPlace(inv, sh, x, y)) return { x, y };
  }
  return null;
}
function orgRots(sh: number[][]) {
  const out = [],
    seen = new Set();
  let s = sh;
  for (let i = 0; i < 4; i++) {
    const k = JSON.stringify(s);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
    s = rotShape(s);
  }
  return out;
}
export function organizeInv(inv: InvGrid) {
  const items = inv.items.slice(),
    save = items.map((it) => ({ it, x: it.x, y: it.y, shape: it.shape })),
    cells = (it: Item) => shapeCells(it.shape),
    big = (it: Item) => Math.max(it.shape.length, it.shape[0].length);
  const orders = [
    (a: Item, b: Item) => cells(b) - cells(a) || big(b) - big(a),
    (a: Item, b: Item) => big(b) - big(a) || cells(b) - cells(a),
    (a: Item, b: Item) => b.shape.length * b.shape[0].length - a.shape.length * a.shape[0].length,
  ];
  let best = null;
  for (const ord of orders)
    for (const cm of [false, true]) {
      inv.items = [];
      let ok = true;
      for (const it of items.slice().sort(ord)) {
        let pick = null;
        for (const sh of orgRots(it.shape)) {
          const p = orgScan(inv, sh, cm);
          if (p && (!pick || (cm ? p.x * 999 + p.y < pick.x * 999 + pick.y : p.y * 999 + p.x < pick.y * 999 + pick.x)))
            pick = { ...p, sh };
        }
        if (!pick) {
          ok = false;
          break;
        }
        it.x = pick.x;
        it.y = pick.y;
        it.shape = pick.sh;
        inv.items.push(it);
      }
      if (!ok) continue;
      let mb = 0,
        mr = 0;
      for (const it of inv.items) {
        mb = Math.max(mb, it.y + it.shape.length);
        mr = Math.max(mr, it.x + it.shape[0].length);
      }
      const sc = cm ? mr * 1000 + mb : mb * 1000 + mr,
        norm = cm ? mr / inv.cols : mb / inv.rows;
      const key = norm * 1e6 + sc;
      if (!best || key < best.key) best = { key, pos: inv.items.map((i) => ({ i, x: i.x, y: i.y, shape: i.shape })) };
    }
  inv.items = items;
  if (!best) {
    for (const s of save) {
      s.it.x = s.x;
      s.it.y = s.y;
      s.it.shape = s.shape;
    }
    return false;
  }
  for (const p of best.pos) {
    p.i.x = p.x;
    p.i.y = p.y;
    p.i.shape = p.shape;
  }
  return true;
}
export function orgRun(inv: InvGrid) {
  if (!econ.test && (econ.gold || 0) < ORG_COST) {
    orgMsg("Precisa de " + ORG_COST + " 💰 para organizar.");
    return;
  }
  if (!inv.items.length) {
    orgMsg("Nada para organizar.");
    return;
  }
  if (!organizeInv(inv)) {
    orgMsg("Não deu para reorganizar melhor.");
    return;
  }
  if (!econ.test) econ.gold -= ORG_COST;
  sfx("ping");
  orgMsg("🧹 Organizado!" + (econ.test ? "" : " (−" + ORG_COST + " 💰)"));
  try {
    renderInv();
  } catch (_) {}
  if (prep.open)
    try {
      renderPrep();
    } catch (_) {}
  if (typeof bag !== "undefined" && bag.open)
    try {
      renderBag();
    } catch (_) {}
  if (typeof INV.chestOpen !== "undefined" && INV.chestOpen)
    try {
      renderChest();
    } catch (_) {}
  updateEcon();
}
function orgMsg(t: string) {
  if (dungeon.active) spawnDungeonToast(t, dungeon.px, dungeon.py - 40, "#ffe08a", 12);
  else if (prep.open && document.getElementById("prep-msg")) document.getElementById("prep-msg")!.textContent = t;
  else mvToast(t);
}

/* ---------------- layout da mochila na masmorra: aljava à direita, chão logo abaixo da mochila ---------------- */
export function invLayout() {
  // reescrita na v5.9.03
  return invLayout3();
}

/* =====================================================================
   v5.9.03 — INVENTÁRIO
   · Mochila da masmorra contínua: mochila e aljava lado a lado (pequena separação),
     o chão colado embaixo da mochila e o boneco de equipamento ao lado do chão.
     Os títulos e dicas ficam embaixo de tudo.
   · Boneco com os espaços do corpo + dois conjuntos de ARMA (1 e 2): Q alterna entre
     corpo a corpo e arco de cada conjunto (ex.: espada+escudo / machado / clava / arco).
   · Equipar/desequipar mais simples: duplo clique no item equipa; clique no espaço tira;
     botão direito no espaço larga no chão; arrastar para o espaço também equipa.
   · Pegar o item pela imagem: clicar em qualquer parte do desenho segura o item
     (o encaixe continua pelos quadradinhos).
===================================================================== */
export function setNo(h: Hero) {
  return h && h._set === 2 ? 2 : 1;
}
export function swapSet(h: Hero) {
  const e = ensureEquip(h);
  for (const k of ALT_K) {
    const a = e[k] || null,
      b = e[k + "2"] || null;
    e[k] = b;
    e[k + "2"] = a;
  }
  h._set = setNo(h) === 2 ? 1 : 2;
}
export function heroOf() {
  return dungeon.active ? dungeon.hero : prep.open ? prepHero() : null;
}

/* ---- equipar num espaço (inclusive no conjunto 2) ---- */
export function equipTo(h: Hero, it: Item, gr: GradeTela, key: string) {
  const base = key.replace(/2$/, ""),
    alt = key !== base;
  if (it.def.slot !== base)
    return it.def.slot
      ? "Vai em outro lugar (" + ((EQ_SLOTS.find((q) => q.id === it.def.slot) || {}).label || it.def.name) + ")"
      : "Isso não é equipamento.";
  if (base === "mochila" || base === "aljava") return equiparBolsa(h, it, gr.inv); // v7.7: troca a grade junto (items/mochilas.ts)
  if (!alt) {
    if (gr.inv.ground) {
      groundTake(it);
      const i = gr.inv.items.indexOf(it);
      if (i >= 0) gr.inv.items.splice(i, 1);
      const inv = ensureInv(h);
      inv.items.push(it);
      return equipItem(h, it, inv);
    }
    return equipItem(h, it, gr.inv);
  }
  const e = ensureEquip(h),
    old = e[key] || null,
    src = gr.inv,
    i = src.items.indexOf(it);
  if (i < 0) return "";
  src.items.splice(i, 1);
  if (src.ground) groundTake(it);
  e[key] = it;
  if (old && !placeIn(ensureInv(h), old)) {
    e[key] = old;
    src.items.splice(i, 0, it);
    if (src.ground) groundPut(it);
    return "Mochila cheia — sem espaço para trocar.";
  }
  return "Arma 2: " + eqName(it);
}
function takeFrom(key: string, toGround: boolean) {
  // tira um item do boneco (qualquer espaço)
  const h = heroOf();
  if (!h) return;
  const e = ensureEquip(h),
    it = e[key];
  if (!it) return;
  /* v7.7 — mochila/aljava: clique guarda (alforjes perto, senão o chão; fora do campo, o baú); botão direito larga no chão */
  if (key === "mochila" || key === "aljava") {
    const msg = desequiparBolsa(h, key, dungeon.active && toGround ? "chao" : undefined);
    if (dungeon.active) {
      if (msg) spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
      renderInv();
    } else {
      const pm = document.getElementById("prep-msg");
      if (pm) pm.textContent = msg;
      renderPrep();
    }
    return;
  }
  if (!dungeon.active || !toGround) {
    const msg = unequip(h, key, ensureInv(h));
    if (dungeon.active) {
      if (msg) spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
    } else if (document.getElementById("prep-msg")) document.getElementById("prep-msg")!.textContent = msg;
  } else if (!/2$/.test(key)) {
    dEqTake(key, true);
    return;
  } else {
    const d = dungeon;
    e[key] = null;
    if (!d.gInv) buildGroundInv();
    if (!placeIn(d.gInv!, it)) d.gInv!.items.push(it);
    groundPut(it);
  }
  if (dungeon.active) {
    if (key === "costas" && dungeon.weapon === "bow" && !e.costas) dungeon.weapon = "melee";
    GL3.heroKey = "";
    updateWeaponUI();
    renderInv();
  } else renderPrep();
}

/* ---- boneco ---- */
function dslot(it: Item | null | undefined, key: string, icon: string | undefined, lab: string) {
  const p = it ? eqPct(eqDurInit(it)) : 0,
    q = it && it.q != null ? eqQ(it) : null;
  return (
    '<div class="dslot' +
    (it ? "" : " empty") +
    '" data-eqs="' +
    key +
    '" style="' +
    (q && it!.q !== 1 ? "border-color:" + q.col : "") +
    '" title="' +
    (it
      ? eqName(it) + " · clique: guardar · botão direito: largar"
      : lab + ": vazio — arraste ou dê duplo clique num item") +
    '">' +
    (it ? icoItemQ(it) : encaixeVazio(key.replace(/2$/, ""), icon || "")) + // v7.7: contorno dourado
    (it && it.durMax
      ? "<b class='eq-dur'><i style='width:" + Math.round(p * 100) + "%;background:" + eqDurCol(p) + "'></i></b>"
      : "") +
    "<small>" +
    lab +
    "</small></div>"
  );
}
export function dollHtml(h: Hero) {
  const e = ensureEquip(h),
    cur = setNo(h),
    ic = (id: string) => (EQ_SLOTS.find((s) => s.id === id) || {}).icon;
  const setCol = (n: number) => {
    const act = n === cur,
      sfx = act ? "" : "2";
    return (
      '<div class="dset' +
      (act ? " on" : "") +
      '"><b>Arma ' +
      n +
      (act ? " ●" : "") +
      "</b>" +
      dslot(e["maoD" + sfx], "maoD" + sfx, ic("maoD"), "Mão D.") +
      dslot(e["maoE" + sfx], "maoE" + sfx, ic("maoE"), "Mão E.") +
      dslot(e["costas" + sfx], "costas" + sfx, ic("costas"), "Arco") +
      "</div>"
    );
  };
  /* v7.7 — igual à preparação (ui/preparo_tela.ts): armaduras à esquerda, a silhueta do herói no meio, o jogo de armas
     em uso e, ao lado, a mochila e a aljava; o jogo reserva embaixo e a faixa do cinto (ui/cinto_tela.ts) */
  return (
    '<div class="darm">' +
    DOLL_ARMOR.map(([k, l]) => dslot(e[k], k, ic(k), l)).join("") +
    '</div><div class="dfoto"><img class="dsil" src="' +
    silhuetaDe(h) +
    '" alt="" draggable="false"></div><div class="dativo">' +
    setCol(cur) +
    '</div><div class="dlado">' +
    dslot(e.mochila, "mochila", "🎒", "Mochila") + // v7.7: mochila e aljava são equipamentos (items/mochilas.ts)
    dslot(e.aljava, "aljava", "🏹", "Aljava") +
    '</div><div class="dreserva">' +
    setCol(cur === 1 ? 2 : 1) +
    '</div><div class="dcinto">' +
    faixaCintoHtml(h, "dslot") +
    "</div>"
  );
}
function dollBind(el: HTMLDivElement) {
  if (el._b) return;
  el._b = 1;
  el.addEventListener("click", (ev) => {
    /* v7.7 — presilha do cinto: o clique devolve a faca/bolsa para a mochila (items/cinto.ts) */
    const pr = (ev.target as HTMLElement).closest<HTMLElement>("[data-presilha]"),
      h = dungeon.hero;
    if (pr && h) {
      const msg = soltarDoCinto(h, +pr.dataset.presilha!, ensureInv(h));
      if (msg) spawnDungeonToast(msg, dungeon.px, dungeon.py - 50, "#ffe08a", 12);
      renderInv();
      return;
    }
    const s = (ev.target as HTMLElement).closest<HTMLElement>("[data-eqs]");
    if (s) takeFrom(s.dataset.eqs!, false);
  });
  el.addEventListener("contextmenu", (ev) => {
    const s = (ev.target as HTMLElement).closest<HTMLElement>("[data-eqs]");
    if (!s) return;
    ev.preventDefault();
    takeFrom(s.dataset.eqs!, true);
  });
}

/* ---- layout contínuo da mochila na masmorra ---- */
export function invLayout3() {
  const card = document.getElementById("inv-card"),
    grid = document.getElementById("inv-grid"),
    qv = document.getElementById("inv-qv"),
    gnd = document.getElementById("inv-ground");
  if (!card || !grid || !qv || !gnd) return false;
  if (document.getElementById("inv-bags")) return true;
  const old = document.getElementById("inv-main");
  const bags = document.createElement("div");
  bags.id = "inv-bags";
  const doll = document.createElement("div");
  doll.id = "inv-doll";
  dollBind(doll);
  const head = document.getElementById("inv-head")!;
  head.after(bags);
  // v7.7: cada área diz o que é (o recipiente, o chão, o personagem)
  const tit = (txt: string) => {
    const el = document.createElement("div");
    el.className = "ib-tit";
    el.textContent = txt;
    return el;
  };
  const a = document.createElement("div");
  a.className = "ib-a";
  a.append(tit("🎒 Mochila"), grid);
  const b = document.createElement("div");
  b.className = "ib-b";
  b.append(tit("🏹 Aljava"), qv);
  const c = document.createElement("div");
  c.className = "ib-c";
  c.append(tit("🟫 Chão · perto de você"), gnd);
  const dd = document.createElement("div");
  dd.className = "ib-d";
  const bolsas = document.createElement("div"); // v7.7: as grades das bolsas do cinto (field/chao.ts: renderInv)
  bolsas.id = "inv-bolsas";
  dd.append(tit("🧍 Personagem"), doll, bolsas);
  bags.append(a, b, c, dd);
  const foot = document.createElement("div");
  foot.id = "inv-foot";
  bags.after(foot);
  const lab = document.createElement("div");
  lab.id = "inv-labels";
  lab.innerHTML =
    "<span>🎒 <b>Mochila</b> (em cima)</span><span>🏹 <b>Aljava</b> (ao lado)</span><span>🟫 <b>Chão</b> (embaixo)</span><span>🧍 <b>Equipamento</b>: duplo clique equipa · clique tira · Q troca Arma 1/2</span>";
  /* v7.7 — sem faixa fixa de texto: as explicações ficam em "❓ Dicas" (fechado); o aviso de mochila cheia continua à vista */
  const dicas = document.createElement("details");
  dicas.id = "inv-dicas";
  dicas.innerHTML = "<summary>❓ Dicas</summary>";
  dicas.appendChild(lab);
  for (const id of ["inv-qvhead", "inv-qvmat", "inv-help", "inv-eq"]) {
    const x = document.getElementById(id);
    if (x) dicas.appendChild(x);
  }
  const aviso = document.getElementById("inv-ground-hint");
  if (aviso) foot.appendChild(aviso);
  foot.appendChild(dicas);
  for (const id of ["inv-quiver", "inv-ground-wrap"]) {
    const x = document.getElementById(id);
    if (x) x.style.display = "none";
  }
  if (old) old.remove();
  return true;
}
// soltar um item arrastado em cima do boneco (masmorra) ou da coluna Arma 2 (preparo)
/* ---- preparo: coluna Arma 2 ao lado das armas ---- */
export function prepAltRender(h: Hero) {
  const wrap = document.querySelector("#prep-modal .eq-wrap");
  if (!wrap) return;
  /* v7.7 — encaixe da mochila no preparo (items/mochilas.ts): clique guarda no baú; arraste uma mochila para vestir */
  {
    let ms = document.getElementById("prep-mochila");
    if (!ms) {
      ms = document.createElement("div");
      ms.id = "prep-mochila";
      ms.addEventListener("click", eqSlotClick);
      const lado = document.getElementById("prep-lado"); // v7.7: ao lado das armas (ui/preparo_tela.ts)
      if (lado) lado.appendChild(ms);
      else wrap.after(ms);
    }
    const eq = ensureEquip(h);
    ms.innerHTML = (
      [
        ["mochila", "Mochila", "🎒"],
        ["aljava", "Aljava", "🏹"],
      ] as const
    )
      .map(
        ([k, nome, ico]) =>
          '<div class="eq-slot' +
          (eq[k] ? "" : " empty") +
          '" data-slot="' +
          k +
          '" title="' +
          (eq[k]
            ? nome + " · clique para guardar no baú"
            : "Sem " + nome.toLowerCase() + ": arraste uma " + nome.toLowerCase() + " para cá") +
          '">' +
          (eq[k] ? icoItemQ(eq[k]!) : encaixeVazio(k, ico)) +
          "<small>" +
          nome +
          "</small></div>",
      )
      .join("");
  }
  let row = document.getElementById("prep-alt");
  if (!row) {
    row = document.createElement("div");
    row.id = "prep-alt";
    (wrap.closest(".p77-corpo") || wrap).after(row); // v7.7: abaixo do corpo da tela nova (ui/preparo_tela.ts)
    row.addEventListener("click", (ev) => {
      const s = (ev.target as HTMLElement).closest("[data-alt]") as HTMLElement;
      if (s) takeFrom(s.dataset.alt + "2", false);
    });
  }
  const e = ensureEquip(h),
    other = setNo(h) === 1 ? 2 : 1;
  row.innerHTML =
    '<b class="set-lab">Arma ' +
    other +
    "<small>reserva · Q troca no jogo</small></b>" +
    ALT_K.map((k) => {
      const it = e[k + "2"],
        p = it ? eqPct(eqDurInit(it)) : 0,
        s = EQ_SLOTS.find((q) => q.id === k)!;
      return (
        '<div class="eq-slot' +
        (it ? "" : " empty") +
        '" data-alt="' +
        k +
        '" title="' +
        (it ? eqName(it) + " · clique para tirar" : s.label + " (Arma " + other + "): arraste um item para cá") +
        '" style="' +
        (it && it.q != null && it.q !== 1 ? "border-color:" + eqQ(it).col : "") +
        '">' +
        (it ? icoItemQ(it) : encaixeVazio(k, s.icon)) +
        "<small>" +
        s.label +
        "</small>" +
        (it
          ? "<b class='eq-dur'><i style='width:" + Math.round(p * 100) + "%;background:" + eqDurCol(p) + "'></i></b>"
          : "") +
        "</div>"
      );
    }).join("");
}

/* ---- duplo clique equipa · pegar o item pela imagem ---- */
export function itemAt(gr: GradeTela, cx: number, cy: number, loose: boolean) {
  const inv = gr.inv;
  const it = inv.items.find((o: Item) => {
    const sy = cy - o.y,
      sx = cx - o.x;
    return sy >= 0 && sx >= 0 && o.shape[sy] && o.shape[sy][sx];
  });
  if (it || !loose) return it ? { it, r: cy - it.y, c: cx - it.x } : null;
  let best = null,
    bd = 1e9;
  for (const o of inv.items) {
    const H = o.shape.length,
      W = o.shape[0].length;
    if (cx < o.x || cy < o.y || cx >= o.x + W || cy >= o.y + H) continue;
    for (let r = 0; r < H; r++)
      for (let c = 0; c < W; c++)
        if (o.shape[r][c]) {
          const dd = Math.hypot(o.x + c - cx, o.y + r - cy);
          if (dd < bd) {
            bd = dd;
            best = { it: o, r, c };
          }
        }
  }
  return best;
}
export function gridCell(g: HTMLElement, e: MouseEvent) {
  const rc = g.getBoundingClientRect();
  return [Math.floor((e.clientX - rc.left) / INV_CELL), Math.floor((e.clientY - rc.top) / INV_CELL)];
}
export function qvItemTo(it: Item, gr: GradeTela, where: string) {
  const h = gr.inv.hero || heroOf();
  if (!h) return;
  if (where === "bag") {
    if (moveItem(it, gr.inv, ensureInv(h))) itemMsg("Foi para a mochila.");
    else itemMsg("Mochila cheia — libere espaço.");
  } else if (dungeon.active && dungeon.invOpen) dropToGround(it, gr.inv);
  renderInv();
  if (prep.open) renderPrep();
}
export function invDecor(w: HTMLDivElement, it: Item) {
  /* v7.7 — arma: o dano médio num círculo na cor da qualidade, no canto da 1ª célula de cima */
  try {
    if (ehArma(it) && it.shape && it.shape[0]) {
      const c = Math.max(
          0,
          it.shape[0].findIndex((v) => !!v),
        ),
        s = document.createElement("span");
      s.innerHTML = seloDano(it, "inv-dano");
      const b = s.firstElementChild as HTMLElement | null;
      if (b) {
        b.style.left = c * INV_CELL + 1 + "px";
        b.style.top = "1px";
        b.removeAttribute("title");
        w.appendChild(b);
      }
    }
  } catch (_) {}
  /* v6.6 — só o botão Analisar da faca velha na cena inicial (a análise de verdade é na mesa do acampamento) */
  try {
    if (ISC.on && ISC.anaInv && it.def.key === "eq_faca_velha") {
      const b = document.createElement("button");
      b.className = "inv-ana hot";
      b.type = "button";
      b.title = "Analisar";
      b.innerHTML = "🔍<span>Analisar</span>";
      b._it = it;
      w.appendChild(b);
    }
  } catch (_) {}
  // v7.7: o preenchimento dos vãos (v6.7, inv-fill) saiu com a grade A2: as peças são retângulos e o vão do machado
  // em L fica à mostra (items/grade_a2.ts)
}

/* ---------------- dica de item (tooltip) ---------------- */
function tipHero() {
  if (dungeon.active && dungeon.hero) return dungeon.hero;
  if (prep.open) return prepHero();
  if (typeof bag !== "undefined" && bag.open) return world.heroes.find((x) => x.id === bag.heroId);
  return world.heroes[0] || null;
}
export function itemStatLines(it: Item) {
  const L = itemStatLinesBase(it);
  /* v5.9.07 */
  if (it && it.def && it.def.key === "gema") {
    gemDecor(it);
    const s = gemStage(it);
    L.push(["💎 Pedra", GEMS[it.gem!].n]);
    L.push(["✦ Estágio", s + "/5 · " + GEM_STN[s]]);
    if (s < 5) L.push(["", "Um lapidário pode levar a gema aos estágios seguintes (campanha)."]);
  } else if (it && it.def && it.def.key === "pedra_rara") {
    stoneDecor(it);
    L.push(["🔶 Pedra", STONES[it.st!].n]);
    L.push(["", "Semipreciosa — vale ×" + STONES[it.st!].v.toFixed(1) + " do preço base."]);
  } else if (it && it.def && MAT_ICO[it.def.key] && !it.def.slot)
    L.push(["✦ Estágio", ["Comum", "Melhorada", "Rara"][Math.min(2, it.tier | 0)]]);
  /* v6.2 — ---------- textos: dica do item e ficha ---------- */
  try {
    const d = it.def;
    if (!d.slot) return L;
    if (d.slot === "maoD") {
      L.splice(1, 0, ["Tipo de dano", mixTxt(mixOfKey(d.key))]);
      {
        const pen = penDe(d.key, mixOfKey(d.key)); // v8.0: toda arma perfurante (DANO.PEN_PADRAO), a lança mais
        if (pen) L.splice(2, 0, ["", "A ponta ignora " + Math.round(pen * 100) + "% da resistência perfurante"]);
      }
      const f = cravFam(d.key);
      if (f)
        L.push([
          "🗡 Crava",
          "até a stamina de um acabar · guarda " + DANO.CRAVAR[f].inicial + "→" + DANO.CRAVAR[f].teto,
        ]);
    } else if (d.slot === "costas") L.splice(1, 0, ["Tipo de dano", mixTxt(DANO.ARMAS.flecha)]); // v7.7: o da flecha
    const A = DANO.ARMADURAS[d.key];
    if (A) {
      const i = L.findIndex((x) => x[0] === "🛡 Proteção");
      const p = armorPiece(it),
        M = DANO.MATERIAIS[A.m];
      const row = ["🛡 Resiste", DANO.ICO.map((ic, j) => ic + " " + p[j].toFixed(1) + "%").join(" · ")];
      if (i >= 0) L.splice(i, 1, row);
      else L.push(row);
      L.push([
        "",
        M.n +
          (M.pesada
            ? " · pesada: +" + Math.round(DANO.PLACA_STAMINA * DANO.PESO_SLOT[d.slot] * 100) + "% de gasto de stamina"
            : ""),
      ]);
    }
  } catch (_) {}
  return L;
}
function itemStatLinesBase(it: Item) {
  const d = it.def,
    L: string[][] = [];
  if (!d.slot) return L;
  eqDurInit(it);
  const Q = eqQ(it);
  /* v7.7 — o número do círculo (DPS) e o dano médio de um golpe (a ficha da mesa mostra) */
  const dm = danoMedio(it);
  if (dm != null) {
    L.push(["⚔ DPS", dpsArma(it) + " por segundo (atacando sem parar)"]);
    L.push(["⚔ Dano médio", danoTxt(dm) + (d.slot === "costas" ? " (flecha, carga cheia)" : " (golpe básico)")]);
  }
  if (d.slot === "maoD") {
    const w = WPN_OF[d.key] || "espada";
    L.push(["⚔ Dano", "×" + ((d.dmg || 1) * Q.stat).toFixed(2)]);
    L.push(["", WPN_TXT[w] || ""]);
  } else if (d.slot === "costas") L.push(["🏹 Força do arco", "×" + ((d.dmg || 1) * Q.stat).toFixed(2)]);
  else if (d.slot === "maoE") L.push(["🛡 Bloqueio", "gasta ×" + ((d.block || 1) / Q.stat).toFixed(2) + " fôlego"]);
  if (d.armor) L.push(["🛡 Proteção", "−" + Math.round(d.armor * Q.stat * 100) + "% de dano"]);
  if (typeof WARM !== "undefined" && WARM[d.key]) L.push(["🌡 Aquece", "+" + WARM[d.key] + " °C"]);
  return L;
}
/* v7.7 — arma: dica curta (número do dano médio no círculo, tipos de dano, afixos, durabilidade, peso); o resto
   (multiplicador, texto da família, cravar, números da durabilidade, preço, descrição) fica na ficha da mesa de
   análise, que chama com completo = true */
function armaTipHtml(it: Item) {
  const d = it.def,
    Q = eqQ(eqDurInit(it));
  let h =
    "<div class='tip-n' style='color:" +
    Q.col +
    "'>" +
    icoTag(icoKeyOf(it)!, d.emoji) +
    " <span class='tip-nome'>" +
    d.name +
    "</span><span class='tip-dps'>" +
    seloDano(it, "tip-dano") +
    "<small>DPS</small></span></div>" +
    "<div class='tip-s'>" +
    ((EQ_SLOTS.find((s) => s.id === d.slot) || {}).label || "") +
    " · <b style='color:" +
    Q.col +
    "'>" +
    Q.n +
    "</b></div>" +
    "<div class='tip-mix'>" +
    mixTxt(mixDaArma(it) || mixOfKey(d.key)) +
    "</div>";
  if (afText(it)) h += "<div class='tip-af'>✨ " + afText(it) + "</div>";
  if (it.durMax) {
    const p = Math.max(0, it.dur! / it.durMax);
    h += "<div class='tip-dur'><i style='width:" + Math.round(p * 100) + "%;background:" + eqDurCol(p) + "'></i></div>";
  }
  h += "<div class='tip-m'><span>⚖ " + Math.round(itemKg(it) * 100) / 100 + " kg</span></div>";
  const hero = tipHero();
  if (hero) {
    const cur = ensureEquip(hero)[d.slot!];
    if (cur && cur !== it)
      h +=
        "<div class='tip-cmp'>Equipado: <b style='color:" +
        eqQ(cur).col +
        "'>" +
        eqName(cur) +
        "</b> " +
        seloDano(cur, "tip-dano mini") +
        " DPS</div>";
    else if (cur === it) h += "<div class='tip-cmp'>✔ Equipado</div>";
  }
  return h;
}
export function itemTipHtml(it: Item, completo?: boolean) {
  if (!completo && ehArma(it)) return armaTipHtml(it);
  const d = it.def,
    Q = d.slot ? eqQ(eqDurInit(it)) : null,
    T = TIERS[it.tier | 0],
    col = Q ? Q.col : it.tier ? T.col : "#f3e6c8";
  let h =
    "<div class='tip-n' style='color:" +
    col +
    "'>" +
    icoTag(icoKeyOf(it)!, d.emoji) +
    " " +
    (d.slot ? eqName(it) : itName(it) + (it.tier ? " " + T.lab : "")) +
    (it.n! > 1 ? " <small>×" + it.n + "</small>" : "") +
    "</div>";
  const sub = d.slot
    ? (EQ_SLOTS.find((s) => s.id === d.slot) || {}).label
    : typeof FOOD !== "undefined" && FOOD[d.key]
      ? "Comida"
      : d.res
        ? "Recurso"
        : d.blueprint
          ? "Projeto de forja"
          : "Material";
  h +=
    "<div class='tip-s'>" +
    (sub || "") +
    (Q ? " · qualidade <b style='color:" + Q.col + "'>" + Q.n + "</b>" : "") +
    "</div>";
  const st = itemStatLines(it);
  if (st.length)
    h +=
      "<div class='tip-st'>" +
      st
        .map(([a, b]) =>
          a ? "<div><span>" + a + "</span><b>" + b + "</b></div>" : "<div class='tip-tr'>" + b + "</div>",
        )
        .join("") +
      "</div>";
  if (d.slot && afText(it)) h += "<div class='tip-af'>✨ " + afText(it) + "</div>";
  if (it.durMax) {
    const p = Math.max(0, it.dur! / it.durMax);
    h +=
      "<div class='tip-dur'><i style='width:" +
      Math.round(p * 100) +
      "%;background:" +
      eqDurCol(p) +
      "'></i></div><div class='tip-s'>Durabilidade " +
      it.dur +
      "/" +
      it.durMax +
      "</div>";
  }
  const F = valorComida(it); // v7.7: com o bicho e as qualidades (antes mostrava o valor base de toda carne)
  if (F) {
    h +=
      "<div class='tip-st'><div><span>🍖 Fome</span><b>−" +
      F.hunger +
      "</b></div>" +
      (F.wound ? "<div><span>🩹 Ferimento</span><b>−" + F.wound + "</b></div>" : "") +
      (F.hp ? "<div><span>❤ Vida</span><b>+" + F.hp + "</b></div>" : "") +
      (F.raw ? "<div class='tip-tr'>Crua: pode dar enjoo</div>" : "") +
      "</div>";
  }
  const kg = itemKg(it);
  h +=
    "<div class='tip-m'><span>⚖ " + Math.round(kg * 100) / 100 + " kg</span><span>💰 " + itemVal(it) + "</span></div>";
  if (d.desc) h += "<div class='tip-d'>" + d.desc + "</div>";
  const hero = tipHero();
  if (d.slot && hero) {
    const cur = ensureEquip(hero)[d.slot];
    if (cur && cur !== it) {
      const a = itemStatLines(cur)[0];
      h +=
        "<div class='tip-cmp'>Equipado: <b style='color:" +
        eqQ(cur).col +
        "'>" +
        eqName(cur) +
        "</b>" +
        (a && a[0] ? " · " + a[1] : "") +
        (cur.durMax ? " · " + cur.dur + "/" + cur.durMax : "") +
        "</div>";
    } else if (cur === it) h += "<div class='tip-cmp'>✔ Equipado</div>";
  }
  return h;
}
export function tipEl() {
  let t = document.getElementById("item-tip");
  if (!t) {
    t = document.createElement("div");
    t.id = "item-tip";
    document.body.appendChild(t);
  }
  return t;
}
export function tipHide() {
  const t = document.getElementById("item-tip");
  if (t) t.style.display = "none";
  TIP.it = null;
}
export const TIP = { it: null as Item | null };

/* ---------- Faca Velha: abre a mochila e você analisa pelo item (🔍) ---------- */
function itemAnalyzable(it: Item) {
  return !!(
    it &&
    it.def &&
    it.def.slot &&
    typeof EQ_BASE !== "undefined" &&
    EQ_BASE[it.def.key] &&
    EQ_BASE[it.def.key].forja !== false && // v7.7: a Faca Velha (o tutorial tem o caminho dele) e o que sai da carpintaria
    !forgeKnows(it.def.key)
  );
}
export function itemAnalyze(it: Item) {
  const d = dungeon;
  if (ISC.on && ISC.anaInv && it.def.key === "eq_faca_velha") {
    ISC.anaInv = false;
    try {
      toggleInv(false);
    } catch (_) {}
    introObj("", "");
    setTimeout(() => knifeAnalyzeOpen(), 150);
    return;
  }
  const h = d.active ? d.hero : tipHero();
  try {
    if (d.active && d.invOpen) toggleInv(false);
    if (typeof bag !== "undefined" && bag.open) closeBag();
    if (prep.open) closePrep();
  } catch (_) {}
  if (econ.mesa) {
    anaOpen(h);
    return;
  }
  const msg = "🔍 Para estudar " + it.def.name + " você precisa da Mesa de análise (carpintaria do acampamento).";
  if (d.active) spawnDungeonToast(msg, d.px, d.py - 44, "#ffe08a", 11);
  else mvToast(msg);
}
export function updatePercHud(dt: number) {
  let el = document.getElementById("perc-hud");
  const h = dungeon.hero;
  if (!h) return;
  const s = h.skills && h.skills.percepcao,
    lv = s ? s.level : 0;
  if (!el) {
    el = document.createElement("div");
    el.id = "perc-hud";
    el.innerHTML = "<b title='Percepção'>🔍 <span id='pc-lvl'>0</span></b><div class='bb'><i id='pc-fill'></i></div>";
    document.body.appendChild(el);
  }
  if (!dungeon.active || lv < 1) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  dungeon.pcFlash = Math.max(0, (dungeon.pcFlash || 0) - dt);
  el.classList.toggle("flash", dungeon.pcFlash > 0);
  document.getElementById("pc-lvl")!.textContent = String(lv);
  document.getElementById("pc-fill")!.style.width = (s.xp % 10) * 10 + "%";
}

/* ==== v6.6 — pacotes 9/9 para carne, erva e folhama; Shift+arrastar separa 1; Ctrl+clique troca de mochila; flechas na mochila (recarregar à mão); Analisar no menu do item ==== */
export function gridElOf(t: HTMLElement | null) {
  while (t && !t._gr) t = t.parentElement;
  return t || null;
}
export function invHeroNow() {
  if (dungeon.active && dungeon.hero) return dungeon.hero;
  if (prep.open && prepHero()) return prepHero();
  if (typeof bag !== "undefined" && bag.open) return world.heroes.find((x) => x.id === bag.heroId) || null;
  return null;
}

/* ---------- menu do item (clique): Analisar, Recarregar, Guardar flechas ---------- */
/* menu do item: analisar, recarregar a aljava, guardar flechas, separar pacote (invItemMenu chama) */
export function invMenuPacotes(it: Item, gr: GradeTela, x: number, y: number) {
  let m = document.getElementById("inv-menu");
  const extra = [];
  if (itemAnalyzable(it)) extra.push(["ana", "🔍 Analisar (deduzir como é feito)"]);
  if (it.def.key === "feixe_flechas") extra.push(["rel", "🏹 Recarregar a aljava"]);
  if (isArrowIt(it)) extra.push(["tobag", "🎒 Guardar flechas na mochila"]);
  if ((it.n || 1) > 1 && PACK_KEYS.includes(it.def.key)) extra.push(["split", "✂ Separar 1 (ou Shift + arrastar)"]);
  if (!extra.length) return;
  if (!m) {
    m = document.createElement("div");
    m.id = "inv-menu";
    m.style.cssText =
      "position:fixed;z-index:300;left:" +
      Math.min(innerWidth - 300, x + 8) +
      "px;top:" +
      Math.min(innerHeight - 160, y + 8) +
      "px;background:#2b2113;border:1px solid #e0b35f;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;max-width:290px";
    m.innerHTML = "<b style='font-size:.74rem;color:#f0d9a2'>" + icoItem(it.def) + " " + eqName(it) + "</b>";
    document.body.appendChild(m);
    setTimeout(
      () =>
        window.addEventListener(
          "pointerdown",
          function f(ev) {
            if (!m!.contains(ev.target as Node)) {
              m!.remove();
              window.removeEventListener("pointerdown", f, true);
            }
          },
          true,
        ),
      0,
    );
  }
  for (const [a, t] of extra) {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.cssText = "font-size:.72rem;text-align:left";
    b.textContent = t;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      m.remove();
      if (a === "ana") itemAnalyze(it);
      else if (a === "rel") {
        bundleReload(it, gr.inv);
        renderInv();
      } else if (a === "tobag") {
        const h = invHeroNow();
        if (h) arrowsToBag(it, gr, ensureInv(h));
        renderInv();
      } else if (a === "split") {
        const o = it;
        if (!o._core) o._core = o.shape.map((r) => r.slice());
        const nu: Item = {
          uid: ++INV.invUid,
          def: o.def,
          x: 0,
          y: 0,
          shape: o._core.map((r) => r.slice()),
          tier: o.tier,
          n: 1,
          _core: o._core.map((r) => r.slice()),
          _pb: o._pb,
        };
        if (o.an) nu.an = o.an;
        o.n!--;
        if (!placeIn(gr.inv, nu)) {
          o.n!++;
          itemMsg("Sem espaço para separar.");
        }
        renderInv();
      }
    });
    m.insertBefore(b, m.children[1] || null);
  }
}
