/* ==== Fase 4 — ficha do personagem (base/02) ==== */
import { ensureHero, treePoints, xpNeed, addHeroXp, buyNode } from "../hero/nivel.ts";
import { ATTR_DEFS, AFFINITIES, GENETICS, BIRTH } from "../data/nascimento.ts";
import { icoAttr, icoTag } from "./icones.ts";
import { esc } from "../core/util.ts";
import { statsHtml, afBonusTag } from "../hero/atributos.ts";
import { world, dungeon, econ } from "../core/state.ts";
import { updateHeroPanelUI } from "./painel.ts";
import { TREES, NODES, NODE_BY_ID, SYNERGIES } from "../data/arvores.ts";
import { nodeState, synOn } from "../hero/arvores.ts";
import { SYN_ICO } from "../data/icones.ts";
import { profSheetHtml } from "../hero/proficiencias.ts";
import { sfx } from "../field/chao.ts";
import { spawnDungeonToast } from "../field/masmorra.ts";
import type { Hero } from "../core/tipos.ts";

/* ===== v3.8: interface do nascimento e da ficha ===== */
export const sheet = { open: false, heroId: null as string | null, tab: "combate", pausedDungeon: false };

export function attrLine(h: Hero) {
  ensureHero(h);
  const a = h.attrs;
  return ATTR_DEFS.map((d) => icoAttr(d.id, d.icon) + " " + a[d.id]).join(" · ");
}
export function idLine(h: Hero) {
  ensureHero(h);
  const A = AFFINITIES[h.aff],
    G = GENETICS[h.gen];
  return A.icon + " " + A.name + " · " + G.name + " · Nv." + h.lvl;
}

export function attrBarsHtml(h: Hero) {
  ensureHero(h);
  return (
    ATTR_DEFS.map(
      (d) =>
        '<div class="sh-attr" title="' +
        esc(d.desc) +
        '"><span>' +
        icoAttr(d.id, d.icon) +
        " " +
        d.name +
        '</span><div class="sh-bar"><i style="width:' +
        Math.round((h.attrs[d["id"]]! / BIRTH.max) * 100) +
        '%"></i></div><b>' +
        h.attrs[d.id] +
        afBonusTag(h, d.id) +
        "</b></div>",
    ).join("") + (sheet.open ? statsHtml(h) : "")
  );
}

/* ---------- ficha do personagem ---------- */
export function openSheet(heroId: string) {
  const h = world.heroes.find((x) => x.id === heroId);
  if (!h) return;
  ensureHero(h);
  sheet.open = true;
  sheet.heroId = heroId;
  if (dungeon.active) {
    dungeon.modalOpen = true;
    sheet.pausedDungeon = true;
    dungeon.charging = false;
    dungeon.charge = 0;
    dungeon.guard = false;
  }
  document.getElementById("sheet-modal")!.classList.add("open");
  renderSheet();
}
export function closeSheet() {
  sheet.open = false;
  document.getElementById("sheet-modal")!.classList.remove("open");
  if (sheet.pausedDungeon) {
    dungeon.modalOpen = false;
    sheet.pausedDungeon = false;
  }
  updateHeroPanelUI();
}
export function renderSheet() {
  const h = world.heroes.find((x) => x.id === sheet.heroId);
  if (!h) {
    closeSheet();
    return;
  }
  ensureHero(h);
  const A = AFFINITIES[h.aff],
    G = GENETICS[h.gen],
    pts = treePoints(h),
    body = document.getElementById("sheet-body");
  const tabs = Object.keys(TREES)
    .map(
      (k) =>
        '<button class="sh-tab' +
        (sheet.tab === k ? " on" : "") +
        (TREES[k].dormant ? " dorm" : "") +
        '" data-tab="' +
        k +
        '">' +
        icoTag("arvore_" + k, TREES[k].icon, "tr") +
        " " +
        TREES[k].name +
        "</button>",
    )
    .join("");
  let nodes;
  if (TREES[sheet.tab].dormant)
    nodes =
      '<p class="sh-dorm">✨ A Magia ainda dorme em ' +
      esc(h.name) +
      ". Sua afinidade (" +
      A.icon +
      " " +
      A.name +
      ") e sua genética (" +
      G.name +
      ") definirão o que poderá despertar aqui.</p>";
  else
    nodes =
      '<div class="sh-nodes">' +
      NODES.filter((n) => n.tree === sheet.tab && (!n.only || n.only === h.aff))
        .map((n) => {
          const st = nodeState(h, n),
            fav = G.fav.indexOf(n.id) >= 0,
            r = fav ? 2 : 1,
            txt = n.desc.replace("{v}", String(n.v[r - 1]).replace(".", ","));
          const req = n.req && !h.nodes[n.req] ? "<small>Requer: " + NODE_BY_ID[n.req].name + "</small>" : "";
          const syn = SYNERGIES.filter((s) => s.needs.indexOf(n.id) >= 0)
            .map((s) => {
              const other = s.needs.find((x) => x !== n.id),
                have = h.nodes[other!];
              return have || h.nodes[n.id]
                ? '<small class="sy' +
                    (synOn(h, s.id) ? " on" : "") +
                    '">' +
                    icoTag(SYN_ICO[s.id], "✨", "sy") +
                    " " +
                    (have ? s.name + ": " + s.desc : "Combina com outro caminho…") +
                    "</small>"
                : "";
            })
            .join("");
          return (
            '<div class="sh-node ' +
            st +
            '"><div class="sh-nh"><b>' +
            icoTag("no_" + n.id, n.icon, "nd") +
            " " +
            n.name +
            "</b>" +
            (n.only
              ? '<span class="tag" style="background:' + A.color + '">' + A.icon + " " + A.name + "</span>"
              : "") +
            (fav ? '<span class="tag fav" title="Sua genética ressoa com este caminho">★ ressoa</span>' : "") +
            "</div><p>" +
            txt +
            "</p>" +
            req +
            syn +
            (st === "owned"
              ? '<span class="own">✔ desenvolvido</span>'
              : st === "open"
                ? '<button class="btn" data-buy="' +
                  n.id +
                  '"' +
                  (pts < 1 ? " disabled" : "") +
                  ">Desenvolver (1 ponto)</button>"
                : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  const syns = SYNERGIES.filter((s) => synOn(h, s.id));
  body!.innerHTML =
    '<div class="sh-head" style="--aff:' +
    A.color +
    '"><div class="sh-badge">' +
    A.icon +
    '</div><div style="flex:1"><h2 style="margin:0">' +
    esc(h.name) +
    '</h2><div class="sh-sub">' +
    A.name +
    " · <b>" +
    G.name +
    "</b> · <em>" +
    G.desc +
    "</em></div>" +
    '<div class="sh-lv">Nv. ' +
    h.lvl +
    '<div class="sh-bar wide"><i style="width:' +
    Math.round((h.xp / xpNeed(h.lvl)) * 100) +
    '%"></i></div><small>' +
    Math.floor(h.xp) +
    " / " +
    xpNeed(h.lvl) +
    " XP · próximo ponto de árvore no nível " +
    (Math.floor(h.lvl / 10) + 1) * 10 +
    "</small></div></div>" +
    '<div class="sh-pts' +
    (pts > 0 ? " has" : "") +
    '">' +
    pts +
    "<small>ponto" +
    (pts === 1 ? "" : "s") +
    "</small></div></div>" +
    '<div class="sh-cols"><div><h3>Atributos</h3><div class="sh-attrs">' +
    attrBarsHtml(h) +
    "</div></div><div><h3>Proficiências</h3>" +
    profSheetHtml(h) +
    '<div class="sh-prof"><span>✨ Magia</span><em>dormente</em></div>' +
    "<h3>Sinergias ativas</h3>" +
    (syns.length
      ? syns.map((s) => '<div class="sh-syn"><b>✨ ' + s.name + "</b><br><small>" + s.desc + "</small></div>").join("")
      : "<em>nenhuma ainda — combine caminhos de árvores diferentes</em>") +
    "</div></div>" +
    '<div class="sh-tabs">' +
    tabs +
    "</div>" +
    nodes +
    '<div class="v3-row" style="margin-top:10px">' +
    (econ.test
      ? '<button class="btn" data-testpt="1">🧪 +1 ponto</button><button class="btn" data-testlv="1">🧪 +1 nível</button>'
      : "") +
    '<button class="btn" data-sheetclose="1" style="margin-left:auto">Fechar</button></div>';
}
export function onSheetClick(e: MouseEvent) {
  const t = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-tab],[data-buy],[data-sheetclose],[data-testpt],[data-testlv]",
  );
  if (!t) return;
  const h = world.heroes.find((x) => x.id === sheet.heroId);
  if (t.dataset.tab) {
    sheet.tab = t.dataset.tab;
    renderSheet();
  } else if (t.dataset.buy && h) {
    const r = buyNode(h, t.dataset.buy);
    if (r) {
      sfx(r.length ? "perfect" : "ping");
      if (dungeon.active)
        spawnDungeonToast(
          r.length ? "✨ Sinergia: " + r[0].name : "Desenvolvido!",
          dungeon.px,
          dungeon.py - 40,
          "#9fe3ff",
          14,
        );
    }
    renderSheet();
  } else if (t.dataset.testpt && h) {
    h.treeBonus++;
    renderSheet();
  } else if (t.dataset.testlv && h) {
    addHeroXp(h, xpNeed(h.lvl) - h.xp);
    renderSheet();
  } else if (t.dataset.sheetclose) closeSheet();
}
