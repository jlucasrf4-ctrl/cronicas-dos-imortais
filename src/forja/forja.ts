/* ==== Fase 4 — forja: receitas, materiais, a tela e o minigame (v4.5) ==== */
import { eqDurInit, eqPct, eqDurCol, eqName } from "../items/durabilidade.ts";
import { campanhaEventoAtual } from "../campanha/campanha.ts";
import { INV_CELL, ITEM_DEFS } from "../data/itens.ts";
import { econ, dungeon, world } from "../core/state.ts";
import { EQ_BASE, RECIPES_START, MAT_NAME, EQ_SLOTS, QUAL } from "../data/equipamento.ts";
import { ISC } from "../intro/cena.ts";
import { profLv, fgProf } from "../hero/proficiencias.ts";
import { spawnDungeonToast, itemMsg } from "../field/masmorra.ts";
import { gainSkill } from "../hero/nivel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { groundTake, tryAddToInv, sfx } from "../field/chao.ts";
import { prep, updateEcon } from "../econ/economia.ts";
import { prepHero, qvInv, renderPrep } from "../expedicao/preparo.ts";
import { ensureInv } from "../items/inventario.ts";
import { fg2Bind, fgCraft, cutPath, sewInit, sewStitch, leatherDraw, ringsDraw } from "./oficios.ts";
import { CAMP, enterCamp } from "../survival/acampamento.ts";
import { icoItem, icoTag } from "../ui/icones.ts";
import { ensureEquip, mkItem, placeIn } from "../items/equipamento.ts";
import type { GradeTela, Hero, Item, Repasse } from "../core/tipos.ts";

/* ---- tela da Forja ---- */
/** O minijogo da bigorna/bancada (forgeStart): esquentar e martelar (metal), ou cortar e costurar (couro, pano). */
export interface MinijogoForja {
  mode: string; // "make" | "fix"
  key: string;
  it: Item | null; // o item sendo consertado
  metal: boolean;
  kind: string;
  ph: string; // fase: heat, hit, quench, cut, sew…
  T: number;
  hits: number[];
  n: number;
  pos: number;
  dir: number;
  spd: number;
  zc: number;
  zw: number;
  burn: number;
  cold: number;
  q: number;
  fx: { x: number; y: number; vx: number; vy: number; t: number; L: number }[];
  last: number;
  anim: number;
  quench: null;
  craft?: string;
  pf?: string; // proficiência usada (fgProf)
  plv?: number;
  txt?: { t: string; c: string; k: number } | null;
  ring?: { a: number; spd: number; flash?: number } | null;
  sew?: { r: number; t: number; dur: number; flash: number };
  cut?: ReturnType<typeof cutPath>;
  cutI?: number;
  cutN?: number;
  cutErr?: number;
  cutScore?: number;
  knife?: { x: number; y: number; off: boolean } | null;
  sc?: number;
  qb?: number;
  flash?: number;
  _slip?: number;
  _bw?: number;
}
interface EstadoFG {
  open: boolean;
  tab: string;
  sel: null; // sobra: ninguém mais usa
  mg: MinijogoForja | null;
  // acrescentados depois
  cutting?: boolean;
  bel?: boolean;
  raf?: number;
  fixList?: { it: Item | null; where: string; lab: string }[]; // o que dá para consertar (aba Consertar)
}
export const FG: EstadoFG = { open: false, tab: "forjar", sel: null, mg: null };

/* ---- visual de durabilidade: espaços de equipamento e mochila ---- */
export function eqDurBar(w: HTMLDivElement, it: Item, shape: number[][]) {
  if (!it.def.slot) return;
  eqDurInit(it);
  const p = eqPct(it);
  let c1 = -1,
    r1 = -1,
    c0 = 99;
  shape.forEach((row: number[], r: number) => {
    if (row.some((v) => v)) r1 = r;
  });
  // v7.7: a barra acompanha só a fileira de baixo (no machado em L ela não entra no vão)
  (shape[r1] || []).forEach((v: number, c: number) => {
    if (v) {
      c0 = Math.min(c0, c);
      c1 = Math.max(c1, c);
    }
  });
  const b = document.createElement("b");
  b.className = "inv-dur";
  b.style.left = c0 * INV_CELL + 2 + "px";
  b.style.top = (r1 + 1) * INV_CELL - 5 + "px";
  b.style.width = (c1 - c0 + 1) * INV_CELL - 4 + "px";
  b.innerHTML = "<i style='width:" + Math.round(p * 100) + "%;background:" + eqDurCol(p) + "'></i>";
  w.appendChild(b);
}

/* ---- conhecimento (receitas do acampamento) ---- */
export function forgeBook() {
  const b = forgeBookBase();
  /* v5.8 */
  {
    if (!econ.test) return b;
    const o = Object.assign({}, b);
    for (const k in EQ_BASE) o[k] = 1;
    return o;
  }
}
function forgeBookBase() {
  if (!econ.recipes) {
    econ.recipes = {};
    for (const k of RECIPES_START) econ.recipes[k] = 1;
  }
  return econ.recipes;
}
export function forgeKnows(k: string) {
  return !!forgeBook()[k];
}
export function forgeLearn(k: string) {
  const r = forgeLearnBase(k);
  /* v6.5 — análise feita → Percepção Nv.2 e o indicador no canto (junto de ⚔ e 🏹) */
  try {
    if (k === "eq_faca" && ISC.on) {
      const h = dungeon.hero!;
      let n = 0;
      while (profLv(h, "percepcao") < 2 && n++ < 80) gainSkill(h, "percepcao", 5);
      dungeon.pcFlash = 1.2;
      spawnDungeonToast("🔍 Percepção Nv.2!", dungeon.px, dungeon.py - 58, "#9fe3ff", 14);
    }
  } catch (_) {}
  return r;
}
function forgeLearnBase(k: string) {
  const b = forgeBook();
  if (b[k]) return false;
  b[k] = 1;
  pushEvent("📖 O acampamento aprendeu a forjar: " + ITEM_DEFS[k].name + ".");
  return true;
}
export function forgeStudy(it: Item, gr: GradeTela) {
  /* v5.9.05 — ---- pesquisador ---- */
  const msg = forgeStudyBase(it, gr),
    h = forgeHero();
  if (h && msg) gainSkill(h, "pesquisador", msg.indexOf("aprendida") >= 0 ? 10 : 3);
  return msg;
}
// etapa de forgeStudy: original
function forgeStudyBase(it: Item, gr: GradeTela) {
  const k = it.def.blueprint;
  if (!k) return "";
  const i = gr.inv.items.indexOf(it);
  if (i >= 0) gr.inv.items.splice(i, 1);
  if (gr.inv.ground) groundTake(it);
  return forgeLearn(k)
    ? "📖 Receita aprendida: " + ITEM_DEFS[k].name + "!"
    : "Vocês já conheciam essa receita — o projeto virou papel de rascunho.";
}
export function forgeDismantle(it: Item, gr: GradeTela) {
  /* v5.9.05 */
  const msg = forgeDismantleBase(it, gr),
    h = forgeHero();
  if (h && msg && msg.indexOf("Desmontou") >= 0) gainSkill(h, "pesquisador", msg.indexOf("aprendeu") >= 0 ? 10 : 5);
  return msg;
}
// etapa de forgeDismantle: original
function forgeDismantleBase(it: Item, gr: GradeTela) {
  const B = EQ_BASE[it.def.key];
  if (!B) return "Não dá para desmontar isso.";
  const i = gr.inv.items.indexOf(it);
  if (i < 0) return "";
  gr.inv.items.splice(i, 1);
  if (gr.inv.ground) groundTake(it);
  const back = [];
  for (const [m, n] of Object.entries(B.mat)) {
    const q = Math.floor(n * 0.4 * eqPct(it) + (Math.random() < 0.5 ? 1 : 0));
    for (let j = 0; j < q; j++) if (tryAddToInv(gr.inv, m) || tryAddToInv(econ.stash, m)) back.push(m);
  }
  const learned = forgeLearn(it.def.key);
  return (
    "🔧 Desmontou " +
    eqName(it) +
    (learned ? " e aprendeu a receita!" : ".") +
    (back.length ? " Recuperou: " + back.map((m) => ITEM_DEFS[m].emoji).join(" ") : "")
  );
}

/* ---- materiais: baú do acampamento + mochila do herói (+ madeira do acampamento para galho) ---- */
function forgeHero() {
  return (prep.open && prepHero()) || world.heroes.find((h) => h.state === "idle") || world.heroes[0] || null;
}
function forgeInvs(h: Hero) {
  const L = [econ.stash];
  if (h) L.push(ensureInv(h), qvInv(h));
  return L;
}
export function forgeHave(h: Hero, m: string) {
  /* v5.8 — ---- modo teste sem custo ---- */
  return econ.test ? 999 : forgeHaveBase(h, m);
}
// etapa de forgeHave: original
function forgeHaveBase(h: Hero, m: string) {
  let n = 0;
  for (const inv of forgeInvs(h))
    for (const it of inv.items) {
      const k = it.def.key;
      if (k === m || (m === "ferro" && k === "lingote")) n += it.n || 1;
    }
  return n;
}
function forgeTake(h: Hero, m: string, n: number) {
  /* v5.8 */
  return econ.test ? 0 : forgeTakeBase(h, m, n);
}
// etapa de forgeTake: original
function forgeTakeBase(h: Hero, m: string, n: number) {
  for (const inv of forgeInvs(h))
    for (const it of inv.items.slice()) {
      if (n <= 0) return 0;
      const k = it.def.key;
      if (!(k === m || (m === "ferro" && k === "lingote"))) continue;
      const t = Math.min(n, it.n || 1);
      n -= t;
      if ((it.n || 1) > t) it.n! -= t;
      else inv.items.splice(inv.items.indexOf(it), 1);
    }
  return n;
}
function forgeCan(h: Hero, mat: Record<string, number>) {
  return Object.entries(mat).every(([m, n]) => forgeHave(h, m) >= n);
}
function repairCost(it: Item) {
  const B = EQ_BASE[it.def.key];
  if (!B) return null;
  eqDurInit(it);
  const lack = 1 - it.dur! / it.durMax!,
    o: Record<string, number> = {};
  for (const [m, n] of Object.entries(B.mat)) {
    const q = Math.ceil(n * lack * 0.6);
    if (q > 0) o[m] = q;
  }
  if (!Object.keys(o).length) o[Object.keys(B.mat)[0]] = 1;
  return o;
}
function matTxt(mat: Record<string, number>, h: Hero) {
  return Object.entries(mat)
    .map(([m, n]) => {
      const have = forgeHave(h, m);
      return "<span class='" + (have >= n ? "ok" : "no") + "'>" + (MAT_NAME[m] || m) + " " + have + "/" + n + "</span>";
    })
    .join(" ");
}
function forgeEnsureDom() {
  if (document.getElementById("fg-modal")) return;
  const m = document.createElement("div");
  m.id = "fg-modal";
  m.innerHTML =
    '<div id="fg-card"><div id="fg-head"><b>⚒ Forja do Acampamento</b><span id="fg-lv"></span><button class="btn" id="fg-x">✕</button></div>' +
    '<div id="fg-tabs"><button class="btn" data-tab="forjar"><i class="ic ico-ui_forja"></i> Forjar</button><button class="btn" data-tab="reparar"><i class="ic ico-ui_reparar"></i> Reparar</button></div><div id="fg-body"></div><div id="fg-mg" style="display:none"><canvas id="fg-cv"></canvas><div id="fg-mgtxt"></div><div id="fg-mgbtn"></div></div><p id="fg-msg"></p></div>';
  document.body.appendChild(m);
  (m.querySelector("#fg-x") as HTMLElement).onclick = () => forgeClose();
  (m.querySelector("#fg-tabs") as HTMLElement).onclick = (e) => {
    const b = (e.target as HTMLElement).closest("[data-tab]") as HTMLElement;
    if (b && !FG.mg) {
      FG.tab = b.dataset.tab!;
      forgeRender();
    }
  };
  (m.querySelector("#fg-body") as HTMLElement).onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button[data-f]") as HTMLButtonElement;
    if (!b || b.disabled) return;
    if (b.dataset.f === "make") forgeStart("make", b.dataset.k!);
    else forgeStart("fix", b.dataset.k!, b.dataset.w);
  };
  const mb = m.querySelector("#fg-mgbtn")!;
  mb.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest("[data-mg]") as HTMLElement;
    if (!b) return;
    e.preventDefault();
    if (b.dataset.mg === "fole") FG.bel = true;
    else if (b.dataset.mg === "hit") mgStrike();
    else if (b.dataset.mg === "quench") mgQuench();
    else if (b.dataset.mg === "done") forgeFinish();
  });
  window.addEventListener("pointerup", () => {
    FG.bel = false;
  });
  m.querySelector("#fg-cv")!.addEventListener("pointerdown", (e) => {
    if (FG.mg && FG.mg.ph === "hit") {
      e.preventDefault();
      mgStrike();
    }
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (!FG.open) return;
      if (e.code === "Escape") {
        e.stopPropagation();
        if (!FG.mg) forgeClose();
      } else if (FG.mg && e.code === "Space") {
        e.preventDefault();
        if (FG.mg.ph === "hit") mgStrike();
        else if (FG.mg.ph === "quench") mgQuench();
      } else if (FG.mg && e.code === "KeyF") FG.bel = true;
    },
    true,
  );
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyF") FG.bel = false;
  });
}
export function openForge(this: unknown) {
  const r = openForgeBase2.apply(this, arguments as Repasse);
  /* v5.9.01 */
  try {
    fg2Bind();
  } catch (_) {}
  if (FG.open && dungeon.active) dungeon.modalOpen = true;
  return r;
}
// etapa de openForge: v5.9
function openForgeBase2(this: unknown) {
  if (!CAMP.allowForge) {
    if (dungeon.active && dungeon.camp) {
      itemMsg("Use a bigorna (ao lado da fogueira).");
      return;
    }
    enterCamp();
    return;
  }
  return openForgeBase.apply(this, arguments as Repasse);
}
// etapa de openForge: original
function openForgeBase() {
  forgeEnsureDom();
  forgeBook();
  FG.open = true;
  FG.mg = null;
  document.getElementById("fg-modal")!.classList.add("open");
  document.getElementById("fg-msg")!.textContent = "";
  forgeRender();
}
export function forgeClose() {
  FG.open = false;
  FG.mg = null;
  cancelAnimationFrame(FG.raf!);
  document.getElementById("fg-modal")!.classList.remove("open");
  if (prep.open) renderPrep();
  updateEcon();
  /* v5.9.01 */
  if (dungeon.active) dungeon.modalOpen = false;
}
function forgeLv() {
  // reescrita na v5.9.05
  const h = forgeHero();
  return Math.max(1, profLv(h, "ferreiro"));
}
function forgeRender() {
  forgeRenderBase2();
  /* v5.9.05 */
  {
    const h = forgeHero(),
      t = document.getElementById("fg-lv");
    if (t && h)
      t.textContent =
        "⚒ Ferreiro Nv." +
        Math.max(1, profLv(h, "ferreiro")) +
        " · 🧵 Artesão Nv." +
        Math.max(1, profLv(h, "artesao")) +
        " · " +
        h.name;
  }
}
// etapa de forgeRender: v5.9.01
function forgeRenderBase2() {
  forgeRenderBase();
  if (FG.tab !== "forjar") return;
  document.querySelectorAll("#fg-body button[data-f='make']").forEach((b) => {
    const c = fgCraft((b as HTMLElement).dataset.k!);
    if (c === "couro") b.textContent = "✂ Costurar";
    else if (c === "malha") b.textContent = "⛓ Forjar malha";
  });
}
// etapa de forgeRender: original
function forgeRenderBase() {
  const h = forgeHero(),
    body = document.getElementById("fg-body")!,
    B = forgeBook();
  document.getElementById("fg-mg")!.style.display = "none";
  body.style.display = "";
  document.getElementById("fg-lv")!.textContent =
    "Ferreiro Nv." + forgeLv() + " · receitas " + forjaveis().filter((k) => B[k]).length + "/" + forjaveis().length;
  document
    .querySelectorAll("#fg-tabs [data-tab]")
    .forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.tab === FG.tab));
  if (FG.tab === "forjar") {
    body.innerHTML = forjaveis()
      .map((k) => {
        const d = ITEM_DEFS[k],
          R = EQ_BASE[k],
          kn = B[k];
        if (!kn)
          return (
            "<div class='fg-row unk'><span class='fg-ico'>❔</span><div><b>" +
            d.name +
            "</b><small>Receita desconhecida — encontre um 📜 Projeto ou desmonte um " +
            d.name +
            ".</small></div></div>"
          );
        const can = forgeCan(h, R.mat);
        return (
          "<div class='fg-row'><span class='fg-ico'>" +
          icoItem(d) +
          "</span><div><b>" +
          d.name +
          "</b><small>" +
          (d.desc || "") +
          " Durabilidade base " +
          R.dur +
          ".</small><div class='fg-mat'>" +
          matTxt(R.mat, h) +
          "</div></div><button class='btn' data-f='make' data-k='" +
          k +
          "'" +
          (can ? "" : " disabled") +
          ">Forjar</button></div>"
        );
      })
      .join("");
  } else {
    const list = [];
    if (h) {
      const e = ensureEquip(h);
      for (const s of EQ_SLOTS)
        if (e[s.id]) list.push({ it: e[s.id], where: "eq:" + s.id, lab: "vestido por " + h.name });
    }
    for (const inv of forgeInvs(h))
      for (const it of inv.items)
        if (it.def.slot) list.push({ it, where: "inv", lab: inv === econ.stash ? "no baú" : "na mochila" });
    body.innerHTML = list.length
      ? list
          .map((o, i) => {
            const it = eqDurInit(o.it!),
              p = eqPct(it),
              kn = B[it.def.key],
              c = repairCost(it)!,
              full = it.dur! >= it.durMax!;
            return (
              "<div class='fg-row'><span class='fg-ico'>" +
              icoItem(it.def) +
              "</span><div><b>" +
              eqName(it) +
              "</b> <small>" +
              o.lab +
              "</small><div class='fg-dur'><i style='width:" +
              Math.round(p * 100) +
              "%;background:" +
              eqDurCol(p) +
              "'></i></div><small>" +
              it.dur +
              "/" +
              it.durMax +
              (kn ? "" : " · não sabem consertar (falta a receita)") +
              "</small>" +
              (kn && !full ? "<div class='fg-mat'>" + matTxt(c, h) + "</div>" : "") +
              "</div>" +
              "<button class='btn' data-f='fix' data-k='" +
              i +
              "' data-w='" +
              o.where +
              "'" +
              (kn && !full && forgeCan(h, c) ? "" : " disabled") +
              ">" +
              (full ? "Inteiro" : "Consertar") +
              "</button></div>"
            );
          })
          .join("")
      : "<p>Nenhum equipamento para consertar.</p>";
    FG.fixList = list;
  }
}

/* ---- minigame ---- */
export function forgeStart(mode: string, k: string, where?: string) {
  forgeStartBase2(mode, k, where);
  /* v5.9.05 */
  {
    const g = FG.mg;
    if (!g) return;
    const h = forgeHero();
    g.pf = fgProf(g);
    g.plv = profLv(h, g.pf);
    if (g.craft === "metal") g.zw = 0.12 + Math.min(0.12, g.plv * 0.012);
    if (FG.mg) {
      const t = document.getElementById("fg-lv");
      if (t)
        t.textContent =
          (g.pf === "ferreiro" ? "⚒ Ferreiro" : "🧵 Artesão") + " Nv." + Math.max(1, g.plv) + " · " + (h ? h.name : "");
    }
  }
}
// etapa de forgeStart: v5.9.01
function forgeStartBase2(mode: string, k: string, where?: string) {
  FG.mg = null;
  forgeStartBase(mode, k, where);
  const g = FG.mg as MinijogoForja | null;
  if (!g) return;
  g.craft = fgCraft(g.key); // o `as`: forgeStartBase acabou de pôr FG.mg (o tsc acha que ainda é o null de cima)
  if (g.craft === "couro") {
    g.cut = cutPath(g.key);
    g.cutI = 0;
    g.cutErr = 0;
    g.cutN = 0;
    g.n = g.mode === "fix" ? 3 : 6;
    if (g.mode === "fix") sewInit(g);
    else g.ph = "cut";
    mgUi();
  } else if (g.craft === "malha") {
    g.n = g.mode === "fix" ? 3 : 6;
    g.ring = { a: Math.random() * 6.283, spd: 2.4 };
  }
}
// etapa de forgeStart: original
function forgeStartBase(mode: string, k: string, _where?: string) {
  const h = forgeHero();
  let it = null,
    key = k,
    mat: Record<string, number>;
  if (mode === "fix") {
    const o = FG.fixList![+k];
    if (!o) return;
    it = o.it;
    key = it!.def.key;
    mat = repairCost(it!)!;
  } else mat = EQ_BASE[key].mat;
  if (!forgeCan(h, mat)) return;
  for (const [m, n] of Object.entries(mat)) forgeTake(h, m, n);
  const R = EQ_BASE[key],
    metal = R.kind === "metal",
    lv = forgeLv();
  FG.mg = {
    mode,
    key,
    it,
    metal,
    kind: R.kind,
    ph: metal ? "heat" : "hit",
    T: metal ? 0.25 : 0.7,
    hits: [],
    n: mode === "fix" ? 3 : metal ? 6 : 5,
    pos: 0,
    dir: 1,
    spd: 0.85 + Math.random() * 0.2,
    zc: 0.5,
    zw: 0.13 + Math.min(0.08, (lv - 1) * 0.015),
    burn: 0,
    cold: 0,
    q: 0,
    fx: [],
    last: performance.now(),
    anim: 0,
    quench: null,
  };
  FG.mg.zc = 0.25 + Math.random() * 0.5;
  document.getElementById("fg-body")!.style.display = "none";
  document.getElementById("fg-mg")!.style.display = "";
  mgUi();
  cancelAnimationFrame(FG.raf!);
  FG.raf = requestAnimationFrame(fgMgLoop);
}
export function mgUi() {
  /* v5.9.01 */
  const g = FG.mg;
  if (!g) return;
  if (g.craft === "malha" && g.ph === "hit") g.ph = "rings";
  mgUiBase();
  /* v5.9.01 */
  {
    const t = document.getElementById("fg-mgtxt")!,
      b = document.getElementById("fg-mgbtn")!,
      nm = ITEM_DEFS[g.key].name,
      head = (g.mode === "fix" ? "🧵 Remendando " : g.craft === "couro" ? "✂ Fazendo " : "⛓ Forjando ") + nm + " — ";
    if (g.ph === "cut") {
      t.innerHTML =
        head +
        "<b>corte o molde</b>: segure e arraste a faca por cima do risco, do ponto ● até o fim. Quanto mais certinho, melhor a peça.";
      b.innerHTML = "";
    } else if (g.ph === "sew") {
      const done = g.hits.length - (g.cutScore != null ? 2 : 0);
      t.innerHTML = head + "<b>costure</b>: aperte quando o anel encostar no furo (" + done + "/" + g.n + ").";
      b.innerHTML = "<button class='btn pri' data-mg='sew'>🪡 Dar o ponto (espaço)</button>";
    } else if (g.ph === "rings") {
      t.innerHTML =
        head +
        "<b>feche os anéis</b>: aperte quando a abertura do anel passar pela marca de cima (" +
        g.hits.length +
        "/" +
        g.n +
        "). O arame esfria a cada anel — use o fole.";
      b.innerHTML =
        "<button class='btn' data-mg='fole'>🔥 Fole</button><button class='btn pri' data-mg='ring'>⛓ Fechar anel (espaço)</button>";
    } else if (g.ph === "heat" && g.craft === "malha")
      t.innerHTML =
        head + "<b>aqueça o arame</b> no fole até ficar laranja-amarelo (faixa marcada). Não deixe chegar no branco!";
  }
}
function mgUiBase() {
  const g = FG.mg!,
    t = document.getElementById("fg-mgtxt")!,
    b = document.getElementById("fg-mgbtn")!,
    nm = ITEM_DEFS[g.key].name;
  const head = (g.mode === "fix" ? "🔧 Consertando " : "🔨 Forjando ") + nm + " — ";
  if (g.ph === "heat") {
    t.innerHTML =
      head + "<b>aqueça</b> no fole até a peça ficar laranja-amarela (faixa marcada). Não deixe chegar no branco!";
    b.innerHTML = "<button class='btn' data-mg='fole'>🔥 Fole (segure · F)</button>";
  } else if (g.ph === "hit") {
    t.innerHTML =
      head +
      "<b>martele</b> quando o marcador passar na faixa dourada (" +
      g.hits.length +
      "/" +
      g.n +
      ")." +
      (g.metal
        ? " O metal esfria a cada golpe — use o fole entre as marteladas."
        : " Cada ponto precisa entrar certinho.");
    b.innerHTML =
      (g.metal ? "<button class='btn' data-mg='fole'>🔥 Fole</button>" : "") +
      "<button class='btn pri' data-mg='hit'>🔨 Martelar (espaço)</button>";
  } else if (g.ph === "quench") {
    t.innerHTML = head + "<b>temperar:</b> mergulhe na água quando a cor passar pelo laranja (faixa verde).";
    b.innerHTML = "<button class='btn pri' data-mg='quench'>💧 Temperar (espaço)</button>";
  } else if (g.ph === "done") {
    const Q = QUAL[g.q];
    t.innerHTML =
      g.mode === "fix"
        ? "✅ <b>" + nm + "</b> consertado: durabilidade " + g.it!.dur + "/" + g.it!.durMax + "."
        : "✅ Pronto: <b style='color:" +
          Q.col +
          "'>" +
          nm +
          " (" +
          Q.n +
          ")</b> — durabilidade ×" +
          Q.dur +
          ", eficácia ×" +
          Q.stat +
          ".";
    b.innerHTML = "<button class='btn pri' data-mg='done'>📦 Guardar</button>";
  }
}
export function mgStrike() {
  const g = FG.mg;
  if (!g || g.ph !== "hit" || g.anim > 0) return;
  let s;
  const off = Math.abs(g.pos - g.zc);
  s = off < g.zw * 0.25 ? 1 : off < g.zw * 0.5 ? 0.75 : off < g.zw ? 0.45 : 0.05;
  if (g.metal && g.T < 0.45) {
    s *= 0.25;
    g.cold++;
    mgFx("FRIO! rachou um pouco", "#9fd3ff");
  } else
    mgFx(
      s >= 1 ? "PERFEITO" : s >= 0.75 ? "Bom" : s >= 0.45 ? "Ok" : "Errou",
      s >= 0.75 ? "#ffd24a" : s >= 0.45 ? "#fff2cf" : "#ff8a6a",
    );
  g.hits.push(s);
  g.anim = 0.22;
  if (g.metal) g.T = Math.max(0, g.T - 0.11);
  sfx(s >= 0.75 ? "hit" : "hitlite");
  for (let i = 0; i < (s >= 0.75 ? 16 : 7); i++)
    g.fx.push({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 260,
      vy: -60 - Math.random() * 200,
      t: 0,
      L: 0.4 + Math.random() * 0.4,
    });
  g.zc = 0.18 + Math.random() * 0.64;
  g.spd *= 1.05;
  if (g.hits.length >= g.n) {
    if (g.metal && g.mode === "make") {
      g.ph = "quench";
      g.quench = null;
    } else mgEnd();
  }
  mgUi();
}
export function mgQuench() {
  const g = FG.mg;
  if (!g || g.ph !== "quench") return;
  const ok = g.T > 0.55 && g.T < 0.78;
  g.qb = ok ? 0.08 : g.T >= 0.78 ? -0.05 : -0.1;
  mgFx(ok ? "Têmpera perfeita!" : g.T >= 0.78 ? "Quente demais" : "Frio demais", ok ? "#7dff9a" : "#ff8a6a");
  sfx(ok ? "perfect" : "fail");
  mgEnd();
}
export function mgEnd(this: unknown) {
  /* v5.9.05 */
  const g = FG.mg!,
    r = mgEndBase.apply(this, arguments as Repasse);
  try {
    const h = forgeHero();
    if (g && h) gainSkill(h, fgProf(g), g.mode === "fix" ? 3 : 5 + (g.q | 0) * 3);
  } catch (_) {}
  return r;
}
// etapa de mgEnd: original
function mgEndBase() {
  const g = FG.mg!,
    avg = g.hits.reduce((a: number, b: number) => a + b, 0) / Math.max(1, g.hits.length),
    sc = Math.max(0, Math.min(1, avg + (g.qb || 0) - g.burn * 0.12 - g.cold * 0.04));
  econ.forgeXp = (econ.forgeXp || 0) + (g.mode === "fix" ? 1 : 3);
  if (g.mode === "fix") {
    const it = g.it!;
    it.durMax = Math.max(10, Math.round(it.durMax! * 0.97));
    it.dur = Math.min(it.durMax, Math.round(it.dur! + it.durMax * (0.45 + 0.55 * sc)));
    it._w25 = 0;
    g.sc = sc;
  } else {
    g.q = sc < 0.38 ? 0 : sc < 0.66 ? 1 : sc < 0.86 ? 2 : 3;
    g.sc = sc;
  }
  g.ph = "done";
  mgUi();
}
export function forgeFinish() {
  const g = FG.mg,
    h = forgeHero(),
    msg = document.getElementById("fg-msg")!;
  if (!g) return;
  if (g.mode === "make") {
    const it = mkItem(g.key);
    it.q = g.q;
    eqDurInit(it);
    const where =
      h && placeIn(ensureInv(h), it) ? "na mochila de " + h.name : placeIn(econ.stash, it) ? "no baú" : null;
    if (!where) {
      econ.stash.items.push(it);
    }
    msg.textContent = "📦 " + eqName(it) + " guardado " + (where || "no baú (amontoado)") + ".";
    pushEvent("⚒ Forjado: " + eqName(it) + ".");
    campanhaEventoAtual("forjou_" + g.key); // v7.7 — campanha (a armadura de couro da missão da costura)
  } else msg.textContent = "🔧 " + eqName(g.it!) + " consertado.";
  FG.mg = null;
  cancelAnimationFrame(FG.raf!);
  forgeRender();
}
export function mgFx(t: string, c: string) {
  const g = FG.mg!;
  g.txt = { t, c, k: 1 };
}
function fgMgLoop(now: number) {
  /* v5.9.01 */
  {
    const g = FG.mg!;
    if (g && FG.open) {
      const dt = Math.min(0.05, (now - g.last) / 1000);
      if (g.ph === "sew") {
        const k = g.sew!;
        k.t += dt;
        k.r = 34 * (1 - k.t / k.dur);
        if (k.flash > 0) k.flash -= dt;
        if (k.r <= 0) sewStitch(0.05);
      }
      if (g.ring) {
        g.ring.a += g.ring.spd * dt;
        if (g.ring.flash! > 0) g.ring.flash! -= dt;
      }
    }
  }
  fgMgLoopBase(now);
  /* v5.9.01 */
  {
    const g2 = FG.mg;
    if (g2 && g2.craft === "malha" && g2.ph === "hit") mgUi();
  }
}
function fgMgLoopBase(now: number) {
  const g = FG.mg;
  if (!g || !FG.open) return;
  FG.raf = requestAnimationFrame(fgMgLoop);
  const dt = Math.min(0.05, (now - g.last) / 1000);
  g.last = now;
  if (g.metal && g.ph !== "done") {
    if (FG.bel) g.T = Math.min(1, g.T + dt * 0.55);
    else g.T = Math.max(0, g.T - dt * (g.ph === "quench" ? 0.16 : 0.06));
    if (g.T > 0.95) {
      g.burn += dt;
      if (!g._bw) {
        g._bw = 1;
        mgFx("Superaquecido!", "#ffffff");
      }
    } else g._bw = 0;
  }
  if (g.ph === "heat" && g.T >= 0.62 && g.T <= 0.9) {
    g.ph = "hit";
    mgUi();
  }
  if (g.ph === "hit") {
    g.pos += g.dir * g.spd * dt;
    if (g.pos > 1) {
      g.pos = 1;
      g.dir = -1;
    }
    if (g.pos < 0) {
      g.pos = 0;
      g.dir = 1;
    }
  }
  if (g.anim > 0) g.anim -= dt;
  if (g.txt) g.txt.k -= dt * 0.9;
  for (const f of g.fx) {
    f.t += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 520 * dt;
  }
  g.fx = g.fx.filter((f) => f.t < f.L);
  mgDraw(now / 1000);
}
export function heatCol(T: number) {
  // preto → vermelho → laranja → amarelo → branco
  const st: [number, number[]][] = [
    [0, [60, 60, 66]],
    [0.35, [150, 40, 20]],
    [0.6, [235, 100, 20]],
    [0.8, [255, 190, 60]],
    [1, [255, 250, 235]],
  ];
  for (let i = 1; i < st.length; i++)
    if (T <= st[i][0]) {
      const a = st[i - 1],
        b = st[i],
        k = (T - a[0]) / (b[0] - a[0]);
      return "rgb(" + a[1].map((v, j) => Math.round(v + (b[1][j] - v) * k)).join(",") + ")";
    }
  return "rgb(255,250,235)";
}
function mgDraw(t: number) {
  /* v5.9.01 */
  const g = FG.mg!;
  if (g && g.craft === "couro") return leatherDraw(t);
  mgDrawBase(t);
  /* v5.9.01 */
  if (g && g.craft === "malha" && (g.ph === "rings" || g.ph === "heat")) ringsDraw(t);
}
function mgDrawBase(t: number) {
  const g = FG.mg!,
    cv = document.getElementById("fg-cv") as HTMLCanvasElement,
    L = Math.round(cv.getBoundingClientRect().width) || 360,
    H = Math.round(L * 0.62),
    dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(L * dpr)) {
    cv.width = Math.round(L * dpr);
    cv.height = Math.round(H * dpr);
  }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a110a");
  bg.addColorStop(1, "#2c1d10");
  c.fillStyle = bg;
  c.fillRect(0, 0, L, H);
  // brasas da fornalha
  const fl = 0.7 + 0.3 * Math.sin(t * 7) * Math.sin(t * 3.1),
    fx = L * 0.14,
    fy = H * 0.72;
  const gr = c.createRadialGradient(fx, fy, 0, fx, fy, L * 0.25);
  gr.addColorStop(0, "rgba(255,140,40," + (0.55 * fl + (FG.bel ? 0.3 : 0)) + ")");
  gr.addColorStop(1, "rgba(255,80,20,0)");
  c.fillStyle = gr;
  c.fillRect(0, 0, L, H);
  c.fillStyle = "#3a2a1c";
  c.fillRect(fx - L * 0.1, fy, L * 0.2, H * 0.3);
  for (let i = 0; i < 9; i++) {
    c.fillStyle = "rgba(255," + (90 + i * 12) + ",30," + (0.5 + 0.5 * Math.sin(t * 5 + i)) + ")";
    c.beginPath();
    c.arc(fx - L * 0.08 + i * L * 0.02, fy + 4 + (i % 2) * 4, 3, 0, 6.283);
    c.fill();
  }
  // bigorna
  const ax = L * 0.56,
    ay = H * 0.58;
  c.fillStyle = "#3d4048";
  c.beginPath();
  c.moveTo(ax - L * 0.2, ay);
  c.lineTo(ax + L * 0.16, ay);
  c.quadraticCurveTo(ax + L * 0.26, ay + 2, ax + L * 0.3, ay - 6);
  c.lineTo(ax + L * 0.16, ay + 14);
  c.lineTo(ax + L * 0.08, ay + 14);
  c.lineTo(ax + L * 0.1, ay + H * 0.22);
  c.lineTo(ax - L * 0.12, ay + H * 0.22);
  c.lineTo(ax - L * 0.1, ay + 14);
  c.lineTo(ax - L * 0.2, ay + 14);
  c.closePath();
  c.fill();
  c.fillStyle = "#5a5e68";
  c.fillRect(ax - L * 0.2, ay - 3, L * 0.36, 4);
  // a peça
  const pc = g.metal ? heatCol(g.T) : g.kind === "couro" ? "#8a5a30" : "#9a6a3a",
    pw = L * 0.22;
  c.save();
  if (g.metal && g.T > 0.35) {
    c.shadowColor = pc;
    c.shadowBlur = 18 * g.T;
  }
  c.fillStyle = pc;
  c.beginPath();
  c.moveTo(ax - pw * 0.6, ay - 4);
  c.lineTo(ax + pw * 0.5, ay - 4);
  c.lineTo(ax + pw * 0.62, ay - 9);
  c.lineTo(ax - pw * 0.6, ay - 11);
  c.closePath();
  c.fill();
  c.restore();
  if (!g.metal) {
    c.fillStyle = "#e9dcc0";
    g.hits.forEach((s: number, i: number) => {
      c.globalAlpha = 0.4 + s * 0.6;
      c.fillRect(ax - pw * 0.5 + (i * pw) / g.n, ay - 9, 3, 3);
    });
    c.globalAlpha = 1;
  }
  // martelo
  const hk = g.anim > 0 ? Math.sin((g.anim / 0.22) * Math.PI) : 0,
    hx = ax + 6,
    hy = ay - 26 - (1 - hk) * 26;
  c.save();
  c.translate(hx, hy);
  c.rotate(-0.5 + hk * 0.5);
  c.fillStyle = "#6b4a22";
  c.fillRect(-2, -2, 36, 5);
  c.fillStyle = "#7a7f88";
  c.fillRect(-10, -9, 13, 19);
  c.restore();
  // faíscas
  c.save();
  c.globalCompositeOperation = "lighter";
  for (const f of g.fx) {
    c.fillStyle = "rgba(255,200,90," + (1 - f.t / f.L) + ")";
    c.fillRect(ax + f.x, ay - 10 + f.y, 2.2, 2.2);
  }
  c.restore();
  // termômetro
  if (g.metal) {
    const tx = L - 26,
      ty = 12,
      th = H - 40;
    c.fillStyle = "rgba(0,0,0,.45)";
    c.fillRect(tx, ty, 12, th);
    const band = (a: number, b: number, col: string | CanvasGradient | CanvasPattern) => {
      c.fillStyle = col;
      c.fillRect(tx - 3, ty + th * (1 - b), 18, th * (b - a));
    };
    if (g.ph === "quench") band(0.55, 0.78, "rgba(125,255,154,.35)");
    else band(0.62, 0.9, "rgba(255,210,74,.3)");
    band(0.95, 1, "rgba(255,255,255,.25)");
    band(0, 0.45, "rgba(120,180,255,.15)");
    const gT = c.createLinearGradient(0, ty + th, 0, ty);
    gT.addColorStop(0, heatCol(0.1));
    gT.addColorStop(0.6, heatCol(0.6));
    gT.addColorStop(1, heatCol(1));
    c.fillStyle = gT;
    c.fillRect(tx + 2, ty + th * (1 - g.T), 8, th * g.T);
    c.fillStyle = "#e9dcc0";
    c.font = "10px Lora,serif";
    c.textAlign = "center";
    c.fillText("🌡", tx + 6, ty + th + 14);
  }
  // barra do martelo
  if (g.ph === "hit") {
    const bx = 16,
      bw = L - 70,
      by = H - 22,
      bh = 12;
    c.fillStyle = "rgba(0,0,0,.5)";
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = "rgba(255,210,74,.35)";
    c.fillRect(bx + bw * (g.zc - g.zw), by, bw * g.zw * 2, bh);
    c.fillStyle = "rgba(255,235,150,.75)";
    c.fillRect(bx + bw * (g.zc - g.zw * 0.25), by, bw * g.zw * 0.5, bh);
    c.fillStyle = "#fff";
    c.fillRect(bx + bw * g.pos - 2, by - 4, 4, bh + 8);
    for (let i = 0; i < g.n; i++) {
      c.fillStyle =
        i < g.hits.length
          ? g.hits[i] >= 0.75
            ? "#ffd24a"
            : g.hits[i] >= 0.45
              ? "#e9dcc0"
              : "#ff6a4a"
          : "rgba(255,255,255,.2)";
      c.beginPath();
      c.arc(bx + 6 + i * 14, by - 12, 4, 0, 6.283);
      c.fill();
    }
  }
  if (g.txt && g.txt.k > 0) {
    c.save();
    c.globalAlpha = Math.min(1, g.txt.k * 1.5);
    c.fillStyle = g.txt.c;
    c.font = "bold 16px Cinzel,serif";
    c.textAlign = "center";
    c.shadowColor = "#000";
    c.shadowBlur = 6;
    c.fillText(g.txt.t, ax, ay - 64 - (1 - g.txt.k) * 16);
    c.restore();
  }
}

/* ---- botões de entrada ---- */
export function forgeInit() {
  forgeEnsureDom();
  const cr = document.getElementById("btn-craft");
  if (cr && !document.getElementById("btn-forge")) {
    const b = document.createElement("button");
    b.className = "btn";
    b.id = "btn-forge";
    b.innerHTML = icoTag("ui_forja", "⚒") + " Forja";
    cr.after(b);
    b.onclick = openForge;
  }
  // v7.7: o botão da Forja saiu da preparação (lá ficou o Baú, ui/preparo_tela.ts)
}
/** v7.7 — o que a Forja faz: EQ_BASE menos o que não se forja (a Faca Velha do tutorial, o que sai da carpintaria). */
function forjaveis() {
  return Object.keys(EQ_BASE).filter((k) => EQ_BASE[k].forja !== false);
}
export function forgeBossDrop() {
  // o Lobo Alfa sempre deixa um Projeto (de preferência um que vocês não conhecem)
  const d = dungeon,
    B = forgeBook(),
    todas = forjaveis(),
    unk = todas.filter((k) => !B[k]),
    k = (unk.length ? unk : todas)[Math.floor(Math.random() * (unk.length || todas.length))];
  const b = d.monsters.find((m) => m.boss) || { x: d.px, y: d.py };
  d.loot!.push({ key: "projeto_" + k, x: b.x + 20, y: b.y + 10, ground: false, tier: 0, t: 0, ttl: 0 });
  spawnDungeonToast("📜 O Alfa deixou um Projeto!", b.x, b.y - 30, "#cbb58a", 13);
}
