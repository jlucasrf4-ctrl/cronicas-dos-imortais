/* ==== Fase 4 — mesa de análise: deduzir receitas estudando itens (v5.9.14) ==== */
import { econ, world } from "../core/state.ts";
import { EQ_BASE, MAT_NAME } from "../data/equipamento.ts";
import { ensureInv } from "../items/inventario.ts";
import { ensureEquip } from "../items/equipamento.ts";
import { forgeKnows, forgeLearn } from "./forja.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { KIND_N } from "../data/mapa.ts";
import { profLv } from "../hero/proficiencias.ts";
import { esc } from "../core/util.ts";
import { icoItem } from "../ui/icones.ts";
import { sfx } from "../field/chao.ts";
import { pushEvent } from "../sim/eventos.ts";
import { gainSkill } from "../hero/nivel.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { ehArma, seloDano } from "../items/dano_medio.ts";
import { itemTipHtml } from "../ui/inventario.ts";
import type { Hero, Item } from "../core/tipos.ts";

function clueOf(k: string) {
  if (!econ.clues) econ.clues = {};
  let c = econ.clues[k];
  if (!c) {
    c = econ.clues[k] = { mats: {}, qty: {}, kind: false, dur: false, n: 0 };
  }
  return c;
}
function clueFacts(k: string) {
  const B = EQ_BASE[k],
    c = clueOf(k),
    F: string[][] = [];
  if (!B) return F;
  for (const m of Object.keys(B.mat)) {
    if (!c.mats[m]) F.push(["mats", m]);
    else if (!c.qty[m]) F.push(["qty", m]);
  }
  if (!c.kind) F.push(["kind"]);
  if (!c.dur) F.push(["dur"]);
  return F;
}
export function clueReady(k: string) {
  const B = EQ_BASE[k],
    c = clueOf(k);
  return !!B && Object.keys(B.mat).every((m) => c.mats[m] && c.qty[m]) && c.kind;
}
function clueTotal(k: string) {
  const B = EQ_BASE[k];
  return B ? Object.keys(B.mat).length * 2 + 2 : 1;
}
function clueKnown(k: string) {
  const B = EQ_BASE[k],
    c = clueOf(k);
  if (!B) return 0;
  let n = (c.kind ? 1 : 0) + (c.dur ? 1 : 0);
  for (const m of Object.keys(B.mat)) n += (c.mats[m] ? 1 : 0) + (c.qty[m] ? 1 : 0);
  return n;
}
/** v7.7 — tem receita de Forja para deduzir (a Faca Velha e o que sai da carpintaria não têm). */
function forjavel(k: string) {
  return !!EQ_BASE[k] && EQ_BASE[k].forja !== false;
}
function anaCandidates(_h: Hero) {
  const seen = new Map();
  const add = (it: Item, where: string) => {
    if (!it || !it.def || !forjavel(it.def.key) || forgeKnows(it.def.key) || seen.has(it.def.key)) return;
    seen.set(it.def.key, { it, where });
  };
  for (const it of econ.stash.items) add(it, "baú");
  for (const H of world.heroes.filter((x) => x.state === "idle")) {
    for (const it of ensureInv(H).items) add(it, "mochila de " + H.name);
    const e = ensureEquip(H);
    for (const s in e) if (e[s] && e[s].def) add(e[s], "equipado em " + H.name);
  }
  const L = [...seen.entries()];
  /* v5.9.15 — quem está no acampamento também analisa o que carrega */
  const H = ANA.h;
  if (H && H.state !== "idle") {
    const seen = new Set(L.map((x) => x[0]));
    const add = (it: Item, where: string) => {
      if (it && it.def && forjavel(it.def.key) && !forgeKnows(it.def.key) && !seen.has(it.def.key)) {
        seen.add(it.def.key);
        L.push([it.def.key, { it, where }]);
      }
    };
    for (const it of ensureInv(H).items) add(it, "sua mochila");
    const e = ensureEquip(H);
    for (const s in e) if (e[s] && e[s].def) add(e[s], "equipado");
  }
  return L;
}
export function anaOpen(h: Hero | null | undefined) {
  ANA.h = h || world.heroes.find((x) => x.state === "idle") || world.heroes[0];
  let m = document.getElementById("ana-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "ana-modal";
    m.className = "v3-modal";
    document.body.appendChild(m);
    m.addEventListener("click", (e) => {
      if (performance.now() - (m!._t0 || 0) < 400) return;
      if (e.target === m) {
        m!.classList.remove("open");
        return;
      }
      const b = (e.target as HTMLElement).closest("[data-an]") as HTMLButtonElement;
      if (!b || b.disabled) return;
      if (b.dataset.an === "x") m!.classList.remove("open");
      else if (b.dataset.an === "go") anaDo(b.dataset.k!);
      else if (b.dataset.an === "ded") anaDeduce(b.dataset.k!);
    });
  }
  m._t0 = performance.now();
  m.classList.add("open");
  anaRender();
}
const ANA = { h: null as Hero | null, msg: "" };
function anaLine(k: string) {
  const B = EQ_BASE[k],
    c = clueOf(k);
  const mats = Object.keys(B.mat)
    .map((m) =>
      c.mats[m]
        ? "<span class='an-m ok'>" + (MAT_NAME[m] || ITEM_DEFS[m].name) + " ×" + (c.qty[m] ? B.mat[m] : "?") + "</span>"
        : "<span class='an-m'>❓ ×?</span>",
    )
    .join("");
  return (
    "<div class='an-mats'>" +
    mats +
    "<span class='an-m" +
    (c.kind ? " ok" : "") +
    "'>" +
    (c.kind ? KIND_N[B.kind] : "❓ tipo de trabalho") +
    "</span>" +
    (c.dur ? "<span class='an-m ok'>⏳ durabilidade ~" + B.dur + "</span>" : "") +
    "</div>"
  );
}
function anaRender() {
  const m = document.getElementById("ana-modal");
  if (!m) return;
  const h = ANA.h!,
    lv = profLv(h, "percepcao"),
    per = anaPer(h),
    L = anaCandidates(h),
    en = Math.round(h.energy == null ? 100 : h.energy);
  m.innerHTML =
    "<div class='v3-card an-card'><div class='mt-head'><b>🔍 Mesa de análise</b><button class='btn' data-an='x'>✕</button></div>" +
    "<p class='an-sub'>" +
    esc(h.name) +
    " · Percepção Nv." +
    (lv || 0) +
    " (revela " +
    per[0] +
    (per[1] ? "–" + (per[0] + 1) : "") +
    " detalhe(s) por análise) · ⚡ " +
    en +
    "</p>" +
    (ANA.msg ? "<div class='cp-msg'>" + ANA.msg + "</div>" : "") +
    (L.length
      ? L.map(([k, o]) => {
          const ready = clueReady(k),
            kn = clueKnown(k),
            tot = clueTotal(k);
          return (
            "<div class='an-row'><div class='an-it'>" +
            icoItem(ITEM_DEFS[k]) +
            "<div><b>" +
            ITEM_DEFS[k].name +
            "</b><small>" +
            o.where +
            " · " +
            kn +
            "/" +
            tot +
            " detalhes</small><div class='an-bar'><i style='width:" +
            Math.round((kn / tot) * 100) +
            "%'></i></div>" +
            anaLine(k) +
            "</div></div>" +
            "<div class='an-btns'><button class='btn' data-an='go' data-k='" +
            k +
            "'" +
            ((en < 8 && !econ.test) || !clueFacts(k).length ? " disabled" : "") +
            ">🔍 Analisar</button>" +
            (ready ? "<button class='btn pri' data-an='ded' data-k='" + k + "'>📖 Deduzir receita</button>" : "") +
            "</div></div>"
          );
        }).join("")
      : "<p class='an-none'>Nenhum item com receita desconhecida no baú ou com quem está na base. Traga armas e armaduras da masmorra (ou de outros caçadores) para estudar.</p>") +
    anaFichas(h) +
    "<p class='cp-note'>Analisar não estraga o item. Cada análise gasta um pouco de energia. Quando os materiais, as quantidades e o tipo de trabalho estiverem claros, dá para deduzir a receita e forjar na bigorna.</p></div>";
}
/* v7.7 — fichas das armas: a dica da mochila é curta; aqui fica tudo (conta do dano, tipos, cravar, durabilidade,
   preço, descrição). Armas do baú, de quem está na base e de quem usa a mesa. */
function anaFichas(h: Hero) {
  const vistos = new Set<number>(),
    L: [Item, string][] = [];
  const add = (it: Item | null | undefined, where: string) => {
    if (!ehArma(it) || vistos.has(it!.uid)) return;
    vistos.add(it!.uid);
    L.push([it!, where]);
  };
  const de = (H: Hero, where: string) => {
    const e = ensureEquip(H);
    for (const s in e) add(e[s], "equipado em " + where);
    for (const it of ensureInv(H).items) add(it, "mochila de " + where);
  };
  if (h) de(h, h.name);
  for (const H of world.heroes) if (H !== h && H.state === "idle") de(H, H.name);
  for (const it of econ.stash.items) add(it, "baú");
  if (!L.length) return "";
  return (
    "<div class='an-fichas'><b>📋 Fichas das armas</b>" +
    L.map(
      ([it, where]) =>
        "<details class='an-ficha'><summary>" +
        icoItem(it.def) +
        "<span>" +
        esc(it.def.name) +
        "</span>" +
        seloDano(it, "inv-dano solto") +
        "<small>" +
        esc(where) +
        "</small></summary><div class='an-ficha-c'>" +
        itemTipHtml(it, true) +
        "</div></details>",
    ).join("") +
    "</div>"
  );
}
function anaPer(h: Hero) {
  const lv = profLv(h, "percepcao");
  return [1 + Math.floor(lv / 3), lv % 3 === 2 ? 1 : 0];
} // nível 0–2: 1 · 3–5: 2 · 6–8: 3 · 9–10: 4 (+ chance de 1 a mais)
export function anaDo(k: string) {
  const h = ANA.h;
  if (!h || !EQ_BASE[k]) return;
  if (!econ.test) {
    if ((h.energy || 0) < 8) {
      ANA.msg = h.name + " está cansado demais para analisar. Descanse um pouco.";
      anaRender();
      return;
    }
    h.energy -= 8;
  }
  const per = anaPer(h);
  const n = per[0] + (per[1] && Math.random() < 0.5 ? 1 : 0);
  const c = clueOf(k),
    B = EQ_BASE[k],
    got = [];
  for (let i = 0; i < n; i++) {
    const F = clueFacts(k);
    if (!F.length) break;
    F.sort((a, b) => (a[0] === "mats" ? 0 : a[0] === "qty" ? 1 : 2) - (b[0] === "mats" ? 0 : b[0] === "qty" ? 1 : 2));
    const f = Math.random() < 0.6 ? F[0] : F[Math.floor(Math.random() * F.length)];
    if (f[0] === "mats") {
      c.mats[f[1]] = 1;
      got.push("é feito com " + (MAT_NAME[f[1]] || ITEM_DEFS[f[1]].name));
    } else if (f[0] === "qty") {
      c.qty[f[1]] = 1;
      got.push("leva " + B.mat[f[1]] + "× " + (MAT_NAME[f[1]] || ITEM_DEFS[f[1]].name));
    } else if (f[0] === "kind") {
      c.kind = true;
      got.push("trabalho de " + KIND_N[B.kind].replace(/^\S+ /, ""));
    } else if (f[0] === "dur") {
      c.dur = true;
      got.push("aguenta ~" + B.dur + " de durabilidade");
    }
  }
  c.n++;
  gainSkill(h, "percepcao", 4 + got.length * 2);
  sfx(got.length > 1 ? "perfect" : "ping");
  ANA.msg =
    "🔍 " +
    h.name +
    " analisou " +
    ITEM_DEFS[k].name +
    ": " +
    (got.length ? got.join(" · ") : "nada novo") +
    "." +
    (clueReady(k) ? " ✨ Já dá para deduzir a receita!" : "");
  pushEvent(ANA.msg);
  updateHeroPanelUI();
  anaRender();
}
function anaDeduce(k: string) {
  const h = ANA.h!;
  if (!clueReady(k)) return;
  if (forgeLearn(k)) {
    gainSkill(h, "percepcao", 12);
    gainSkill(h, "pesquisador", 6);
    sfx("perfect");
    ANA.msg = "📖 " + h.name + " deduziu a receita de " + ITEM_DEFS[k].name + "! Já dá para forjar na bigorna.";
  }
  anaRender();
}
