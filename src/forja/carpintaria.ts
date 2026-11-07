/* ==== Fase 4 — carpintaria: tábuas, caixa, baú, mesa (v5.9.13) ==== */
import { econ, MEMO, world } from "../core/state.ts";
import { ALJAVA, ITEM_DEFS, MOCHILA } from "../data/itens.ts";
import { COOK } from "../data/sobrevivencia.ts";
import { anaOpen } from "./analise.ts";
import { resTotal, resTake } from "../render/sprites.ts";
import { profLv } from "../hero/proficiencias.ts";
import { icoTag } from "../ui/icones.ts";
import { sfx } from "../field/chao.ts";
import { pushEvent } from "../sim/eventos.ts";
import { updateEcon } from "../econ/economia.ts";
import { gainSkill } from "../hero/nivel.ts";
import { mkItem, placeIn } from "../items/equipamento.ts";
import { ensureInv, rollTier, TIERS, bauFolga } from "../items/inventario.ts";
import { novaBolsa, presilhas } from "../items/cinto.ts";
import type { Hero, InvGrid, Item, Ponto } from "../core/tipos.ts";

interface EstadoCARP {
  open: boolean;
  plane: {
    prog: number;
    t0: number;
    shav: { x: number; y: number; vx: number; vy: number; a: number; r: number }[];
    done: boolean;
  } | null; // a plaina (carpPlaneStart)
  // acrescentados depois
  h?: Hero;
}
export const CARP: EstadoCARP = { open: false, plane: null };
/** Receita da carpintaria: custa `tab` tábuas (e lingote/pele, se houver); v6.0 acrescenta a corda. */
interface ReceitaCarp {
  id: string;
  n: string;
  tab: number;
  lingote?: number;
  pele?: number;
  extra?: Record<string, number>; // v7.7: outros itens do custo (a mochila leva corda, a aljava galho)
  d: string;
  ok: () => boolean;
  done: () => string;
}
// v7.7: a 📦 Caixa e o 🧰 Baú reforçado (aumentavam o baú) saíram: o baú é infinito (items/bau_infinito.ts)
export const CARP_RECIPES: ReceitaCarp[] = [
  {
    id: "mesa",
    n: "🪑 Mesa de trabalho",
    tab: 6,
    d: "Fica no acampamento: assar e forjar ficam mais fáceis (faixa de acerto maior).",
    ok: () => !econ.mesa,
    done: () => {
      econ.mesa = true;
      mesaApply();
      return "Mesa montada no acampamento!";
    },
  },
  /* v7.7 — mochila extra (items/mochilas.ts): vazia, vai para o baú */
  {
    id: "mochila",
    n: "🎒 Mochila",
    tab: 0,
    pele: MOCHILA.receita.pele,
    extra: { corda: MOCHILA.receita.corda },
    d: "Uma mochila vazia (vai para o baú). Guarde a cheia no tamanduá e vista a vazia.",
    ok: () => true,
    done: () => {
      const it = mkItem("eq_mochila");
      it.conteudo = { cols: MOCHILA.cols, rows: MOCHILA.rows, items: [], mochila: true };
      if (!placeIn(econ.stash, it)) econ.stash.items.push(it);
      return "Mochila costurada — está no baú.";
    },
  },
  {
    id: "aljava",
    n: "🏹 Aljava",
    tab: 0,
    pele: ALJAVA.receita.pele,
    extra: { galho: ALJAVA.receita.galho },
    d: "Uma aljava vazia (vai para o baú). Vestida, o arco tira as flechas dela.",
    ok: () => true,
    done: () => {
      const it = mkItem("eq_aljava");
      if (!placeIn(econ.stash, it)) econ.stash.items.push(it);
      return "Aljava costurada — está no baú.";
    },
  },
  /* v7.7 — materiais intermediários e o cinto (docs/materiais.md, items/cinto.ts) */
  {
    id: "cabo",
    n: "🥢 Cabo de madeira",
    tab: 0,
    extra: { galho: 1 },
    d: "Esculpe um galho num cabo: base de facas (e, mais tarde, de outras ferramentas).",
    ok: () => true,
    done: () => guardar(mkItem("cabo"), "Cabo esculpido"),
  },
  {
    id: "couro",
    n: "🟤 Curtir couro",
    tab: 0,
    pele: 1,
    extra: { galho: 1 },
    d: "Curte uma pele com a casca de um galho: vira couro, que não apodrece. Para cintos e bolsas.",
    ok: () => true,
    done: () => guardar(mkItem("couro"), "Couro curtido"),
  },
  {
    id: "faca_simples",
    n: "🔪 Faca simples",
    tab: 0,
    extra: { cabo: 1, pedra: 2 },
    d: "Uma lasca de pedra amarrada num cabo. Barata e frágil: quebra depois de poucos usos. No cinto, finaliza (E).",
    ok: () => true,
    done: () => guardar(mkItem("eq_faca_simples"), "Faca simples pronta"),
  },
  {
    id: "cinto",
    n: "🪢 Cinto de couro",
    tab: 0,
    extra: { couro: 2, ferro: 1 },
    d: "Couro e uma fivela de ferro. Presilhas para faca e bolsa: o cinto A tem 1, o A+ 2 e o SS 3 (Artesão alto ajuda).",
    ok: () => true,
    done: () => {
      const lv = CARP.h ? profLv(CARP.h, "artesao") : 0,
        it = mkItem("eq_cinto", rollTier(false, lv * 0.01));
      return guardar(it, "Cinto " + TIERS[it.tier | 0].lab + " pronto (" + presilhas(it).length + " presilha(s))");
    },
  },
  {
    id: "bolsa",
    n: "👝 Bolsa pequena",
    tab: 0,
    extra: { couro: 1, linho: 1 },
    d: "Couro costurado com linho (compre na Vila Musgo). Vai numa presilha do cinto: uma grade 3 × 2 à mão.",
    ok: () => true,
    done: () => guardar(novaBolsa(), "Bolsa costurada"),
  },
];
/** v7.7 — guarda o que a carpintaria fez no baú (ou na mochila de quem fez) e devolve a mensagem. */
function guardar(it: Item, feito: string) {
  if (placeIn(econ.stash, it) || (CARP.h && placeIn(ensureInv(CARP.h), it))) return feito + " (no baú).";
  econ.stash.items.push(it);
  return feito + " (no baú, por cima: arrume o baú).";
}
/** Tem os itens extras da receita (corda, galho…)? */
const temExtra = (r: ReceitaCarp) => Object.entries(r.extra || {}).every(([k, n]) => itemCount(k) >= n);
/** Dá para fazer a receita com o que se tem (sem contar o modo teste)? */
const temCusto = (r: ReceitaCarp) =>
  r.ok() &&
  tabCount() >= r.tab &&
  itemCount("lingote") >= (r.lingote || 0) &&
  itemCount("pele") >= (r.pele || 0) &&
  temExtra(r);
/** v7.7 — receitas que dá para fazer agora (o balão do acampamento avisa). */
export function carpProntas() {
  return CARP_RECIPES.filter(temCusto);
}
/** v7.7 — o baú infinito: mantém a marca e a folga de fileiras (saves antigos chegam sem `infinito`). */
export function chestFit() {
  try {
    econ.stash.infinito = true;
    econ.stash.cols = Math.max(econ.stash.cols, 24);
    bauFolga(econ.stash);
  } catch (_) {}
}
export function mesaApply() {
  try {
    if (!MEMO._cookOk0) MEMO._cookOk0 = COOK.ok.slice();
    COOK.ok[0] = MEMO._cookOk0[0] - (econ.mesa ? 0.04 : 0);
    COOK.ok[1] = MEMO._cookOk0[1] + (econ.mesa ? 0.04 : 0);
  } catch (_) {}
}
export function tabCount() {
  let n = 0;
  for (const inv of [econ.stash, ...world.heroes.map((h) => h.inv)].filter(Boolean) as InvGrid[])
    for (const it of inv.items) if (it.def.key === "tabua") n += it.n || 1;
  return n;
}
function tabTake(n: number) {
  for (const inv of [econ.stash, ...world.heroes.map((h) => h.inv)].filter(Boolean) as InvGrid[])
    for (let i = inv.items.length - 1; i >= 0 && n > 0; i--)
      if (inv.items[i].def.key === "tabua") {
        inv.items.splice(i, 1);
        n--;
      }
  return n <= 0;
}
function itemCount(k: string) {
  let n = 0;
  for (const inv of [econ.stash, ...world.heroes.map((h) => h.inv)].filter(Boolean) as InvGrid[])
    for (const it of inv.items) if (it.def.key === k) n += it.n || 1;
  return n;
}
function itemTake(k: string, n: number) {
  for (const inv of [econ.stash, ...world.heroes.map((h) => h.inv)].filter(Boolean) as InvGrid[])
    for (let i = inv.items.length - 1; i >= 0 && n > 0; i--) {
      const it = inv.items[i];
      if (it.def.key !== k) continue;
      // v7.7: tira só o que precisa de uma pilha (pedras, ervas…), não a pilha inteira
      const t = Math.min(n, it.n || 1);
      if ((it.n || 1) > t) it.n! -= t;
      else inv.items.splice(i, 1);
      n -= t;
    }
  return n <= 0;
}
export function carpOpen(h: Hero) {
  CARP.h = h || world.heroes.find((x) => x.state === "idle") || world.heroes[0];
  let m = document.getElementById("carp-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "carp-modal";
    m.className = "v3-modal";
    document.body.appendChild(m);
    m.addEventListener("click", (e) => {
      if (performance.now() - (m!._t0 || 0) < 400) return;
      if (e.target === m) {
        carpClose();
        return;
      }
      const b = (e.target as HTMLElement).closest("[data-cp]") as HTMLButtonElement;
      if (!b || b.disabled) return;
      const a = b.dataset.cp!;
      if (a === "x") carpClose();
      else if (a === "plane") carpPlaneStart();
      else carpMake(a);
    });
  }
  CARP.open = true;
  m._t0 = performance.now();
  m.classList.add("open");
  carpRender();
}
function carpClose() {
  CARP.open = false;
  CARP.plane = null;
  const m = document.getElementById("carp-modal");
  if (m) m.classList.remove("open");
}
function carpRender(msg?: string) {
  carpRenderBase(msg);
  try {
    const card = document.querySelector("#carp-modal .cp-card");
    if (card && econ.mesa && !CARP.plane && !card.querySelector("[data-cp-ana]")) {
      const b = document.createElement("button");
      b.className = "btn pri";
      b.dataset.cpAna = "1";
      b.style.cssText = "width:100%;margin-top:8px";
      b.textContent = "🔍 Usar a mesa: analisar itens e deduzir receitas";
      b.onclick = (e) => {
        e.stopPropagation();
        document.getElementById("carp-modal")!.classList.remove("open");
        CARP.open = false;
        anaOpen(CARP.h);
      };
      card.appendChild(b);
    }
  } catch (_) {} // v5.9.14 — botão da mesa de análise
  try {
    const b = document.querySelector("#carp-modal [data-cp=corda]") as HTMLButtonElement;
    if (b) {
      const can = econ.test || itemCount("pele") >= 1;
      b.disabled = !can;
      const sm = b.parentNode!.querySelector(".cp-cost");
      if (sm) sm.textContent = "1 pele (você tem " + itemCount("pele") + ")";
    }
  } catch (_) {} // v6.0 — corda: custo em pele
}
function carpRenderBase(msg?: string) {
  const m = document.getElementById("carp-modal");
  if (!m) return;
  const wood = resTotal("wood"),
    tab = tabCount(),
    free = econ.test,
    lv = CARP.h ? profLv(CARP.h, "artesao") : 0;
  if (CARP.plane) {
    m.innerHTML =
      "<div class='v3-card cp-card'><div class='mt-head'><b>🪚 Aplainar a madeira</b><button class='btn' data-cp='x'>✕</button></div><canvas id='cp-cv' width='440' height='200'></canvas><p class='cp-tip' id='cp-tip'>Arraste a plaina de ponta a ponta na tábua até tirar toda a casca e as farpas.</p></div>";
    carpPlaneBind();
    return;
  }
  m.innerHTML =
    "<div class='v3-card cp-card'><div class='mt-head'><b>🪚 Carpintaria</b><button class='btn' data-cp='x'>✕</button></div>" +
    "<div class='cp-stock'><span>" +
    icoTag("ui_madeira", "🪵") +
    " Lenha: <b>" +
    wood +
    "</b></span><span>" +
    icoTag("mat_madeira_4", "🪵") +
    " Tábuas: <b>" +
    tab +
    "</b></span><span>" +
    icoTag("lingote", "🪙") +
    " Lingotes: <b>" +
    itemCount("lingote") +
    "</b></span>" +
    (lv ? "<span>Artesão Nv." + lv + "</span>" : "") +
    "</div>" +
    (msg ? "<div class='cp-msg'>" + msg + "</div>" : "") +
    "<div class='cp-row'><div><b>Tratar lenha</b><small>2 lenha → 1 a 3 tábuas (mais rápido e com Artesão alto = mais tábuas)</small></div><button class='btn pri' data-cp='plane'" +
    (wood >= 2 || free ? "" : " disabled") +
    ">🪚 Aplainar</button></div>" +
    CARP_RECIPES.map((r) => {
      const can = free ? r.ok() : temCusto(r);
      return (
        "<div class='cp-row'><div><b>" +
        r.n +
        "</b><small>" +
        r.d +
        "</small><small class='cp-cost'>" +
        [
          r.tab ? r.tab + " tábuas" : "",
          r.lingote ? r.lingote + " lingote" : "",
          r.pele ? r.pele + " peles" : "",
          ...Object.entries(r.extra || {}).map(([k, n]) => n + " " + (ITEM_DEFS[k] ? ITEM_DEFS[k].name : k)),
        ]
          .filter(Boolean)
          .join(" + ") +
        (r.ok() ? "" : " · já feito/máximo") +
        "</small></div><button class='btn' data-cp='" +
        r.id +
        "'" +
        (can ? "" : " disabled") +
        ">Fazer</button></div>"
      );
    }).join("") +
    "<p class='cp-note'>" +
    (econ.mesa ? "🪑 Mesa no acampamento: assar ficou mais fácil. " : "") +
    (econ.caixas! | 0 ? "📦 " + econ.caixas + " caixa(s) no baú." : "") +
    "</p></div>";
}
function carpMake(id: string) {
  {
    const r = CARP_RECIPES.find((x) => x.id === id);
    if (r && r.pele) {
      if (!econ.test) {
        if (itemCount("pele") < r.pele || !temExtra(r)) return;
        itemTake("pele", r.pele);
        for (const [k, n] of Object.entries(r.extra || {})) itemTake(k, n);
      }
      const msg = r.done();
      if (CARP.h) gainSkill(CARP.h, "artesao", 5);
      sfx("perfect");
      pushEvent("🪚 " + msg);
      carpRender("✨ " + msg);
      return;
    }
  } // v6.0 — receitas de pele (corda)
  const r = CARP_RECIPES.find((x) => x.id === id);
  if (!r || !r.ok()) return;
  if (!econ.test) {
    if (!temCusto(r)) return; // v7.7: confere também os itens extras (cabo, couro, linho…)
    tabTake(r.tab);
    if (r.lingote) itemTake("lingote", r.lingote);
    for (const [k, n] of Object.entries(r.extra || {})) itemTake(k, n);
  }
  const msg = r.done();
  if (CARP.h) gainSkill(CARP.h, "artesao", 6 + r.tab);
  sfx("perfect");
  pushEvent("🪚 " + msg);
  updateEcon();
  carpRender("✨ " + msg);
}
function carpPlaneStart() {
  if (!econ.test) {
    if (resTotal("wood") < 2) return;
    resTake("wood", 2);
  }
  CARP.plane = { prog: 0, t0: performance.now(), shav: [], done: false };
  updateEcon();
  carpRender();
}
function carpPlaneBind() {
  const cv = document.getElementById("cp-cv") as HTMLCanvasElement;
  if (!cv) return;
  const c = cv.getContext("2d")!,
    W = cv.width,
    H = cv.height,
    P = CARP.plane!,
    bx = 30,
    by = 60,
    bw = W - 60,
    bh = 80;
  const mask = document.createElement("canvas");
  mask.width = W;
  mask.height = H;
  const mc = mask.getContext("2d")!;
  mc.fillStyle = "#000";
  mc.fillRect(bx, by, bw, bh);
  const rough = document.createElement("canvas");
  rough.width = W;
  rough.height = H;
  const rc = rough.getContext("2d")!;
  rc.fillStyle = "#5a3a1e";
  rc.fillRect(bx, by, bw, bh);
  for (let i = 0; i < 260; i++) {
    rc.fillStyle = ["#3e2612", "#6b4422", "#4a2e16", "#7a5230"][i % 4];
    rc.fillRect(bx + Math.random() * bw, by + Math.random() * bh, 6 + Math.random() * 30, 1 + Math.random() * 3);
  }
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  const tc = tmp.getContext("2d")!;
  const pts: { x: number; y: number; f: number }[] = [];
  for (let y = by + 6; y < by + bh - 4; y += 10)
    for (let x = bx + 6; x < bx + bw - 4; x += 12) pts.push({ x, y, f: 0 });
  let last: Ponto | null = null,
    down = false;
  const pt = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const step = (p: Ponto) => {
    mc.globalCompositeOperation = "destination-out";
    mc.beginPath();
    mc.ellipse(p.x, p.y, 14, 16, 0, 0, 6.283);
    mc.fill();
    mc.globalCompositeOperation = "source-over";
    for (const q of pts) if (Math.hypot(q.x - p.x, (q.y - p.y) * 0.9) < 15) q.f = 1;
    P.prog = pts.filter((q) => q.f).length / pts.length;
    if (Math.random() < 0.5)
      P.shav.push({
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 2,
        a: 1,
        r: 2 + Math.random() * 3,
      });
  };
  const draw = () => {
    if (!CARP.plane || CARP.plane !== P || !document.getElementById("cp-cv")) return;
    const t = (performance.now() - P.t0) / 1000;
    c.fillStyle = "#1e1610";
    c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, "#e6c48a");
    g.addColorStop(1, "#c79a5a");
    c.fillStyle = g;
    c.fillRect(bx, by, bw, bh);
    c.strokeStyle = "rgba(140,96,50,.5)";
    c.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(bx, by + 12 + i * 12);
      c.bezierCurveTo(bx + bw * 0.3, by + 8 + i * 12, bx + bw * 0.6, by + 18 + i * 12, bx + bw, by + 12 + i * 12);
      c.stroke();
    }
    tc.clearRect(0, 0, W, H);
    tc.drawImage(rough, 0, 0);
    tc.globalCompositeOperation = "destination-in";
    tc.drawImage(mask, 0, 0);
    tc.globalCompositeOperation = "source-over";
    c.drawImage(tmp, 0, 0);
    for (const s of P.shav) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.15;
      s.a -= 0.02;
      c.fillStyle = "rgba(230,190,130," + Math.max(0, s.a) + ")";
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, 6.283);
      c.fill();
    }
    P.shav = P.shav.filter((s) => s.a > 0);
    if (last && down) {
      c.save();
      c.translate(last.x, last.y);
      c.fillStyle = "#6b4a2a";
      c.fillRect(-22, -12, 44, 18);
      c.fillStyle = "#9aa3ae";
      c.fillRect(-4, 4, 8, 6);
      c.fillStyle = "#8a5a2a";
      c.beginPath();
      c.arc(-16, -14, 6, 0, 6.283);
      c.fill();
      c.restore();
    }
    c.fillStyle = "#f3e2b8";
    c.font = "13px Lora, serif";
    c.textAlign = "left";
    c.fillText("Aplainado: " + Math.round(P.prog * 100) + "%  ·  " + t.toFixed(1) + "s", 12, 22);
    c.fillStyle = "#2b2113";
    c.fillRect(12, H - 22, W - 24, 8);
    c.fillStyle = "#e0b04a";
    c.fillRect(12, H - 22, (W - 24) * P.prog, 8);
    if (P.prog >= 0.92 && !P.done) carpPlaneEnd(t);
    requestAnimationFrame(draw);
  };
  cv.addEventListener("pointerdown", (e) => {
    down = true;
    last = pt(e);
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    step(last);
  });
  cv.addEventListener("pointermove", (e) => {
    const p = pt(e);
    if (down && last) {
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 6));
      for (let i = 1; i <= n; i++) step({ x: last.x + ((p.x - last.x) * i) / n, y: last.y + ((p.y - last.y) * i) / n });
      if (Math.random() < 0.15) sfx("hitlite");
    }
    last = p;
  });
  for (const ev of ["pointerup", "pointercancel"])
    cv.addEventListener(ev, () => {
      down = false;
    });
  requestAnimationFrame(draw);
}
function carpPlaneEnd(t: number) {
  const P = CARP.plane!;
  P.done = true;
  const lv = CARP.h ? profLv(CARP.h, "artesao") : 0,
    n = Math.min(3, 1 + (t < 9 + lv * 0.6 ? 1 : 0) + (lv >= 5 ? 1 : 0));
  let put = 0;
  for (let i = 0; i < n; i++) {
    const it = mkItem("tabua");
    if (placeIn(econ.stash, it) || (CARP.h && placeIn(ensureInv(CARP.h), it))) put++;
  }
  if (CARP.h) gainSkill(CARP.h, "artesao", 4 + n);
  sfx(n >= 2 ? "perfect" : "ping");
  pushEvent(
    "🪚 " +
      (CARP.h ? CARP.h.name + " aplainou" : "Aplainou") +
      " a madeira: +" +
      put +
      " tábua(s) (" +
      t.toFixed(1) +
      "s).",
  );
  updateEcon();
  setTimeout(() => {
    CARP.plane = null;
    carpRender("✨ +" + put + " tábua" + (put > 1 ? "s" : "") + " no baú" + (n < 3 ? " · mais rápido rende mais" : ""));
  }, 500);
}
