/* ==== v7.7 — recipientes em janelas (documento mestre 4.2 e 4.3) ====
   Na mochila do campo, a aljava e os alforjes do tamanduá saem do quadro e viram janelas próprias: cada uma diz o
   que é e quanto espaço está ocupado, pode ser arrastada pela barra e ficar aberta junto com as outras. Os botões
   no painel do personagem abrem e fecham. As grades em si não mudam (as mesmas de INV.invGrids, só mudam de lugar),
   então arrastar e soltar continua igual: vale o recipiente sob o cursor.
   Clique direito = transferência rápida, com destino previsível: da mochila vai para a janela de recipiente aberta
   marcada com ⇄ (a última que você abriu ou tocou); de um recipiente ou do chão vai para a mochila. Sem janela aberta,
   o clique direito na mochila larga no chão, como antes. Sem espaço: o item fica onde estava e o jogo diz por quê. */
import { dungeon, econ } from "../core/state.ts";
import { CPS } from "../survival/acampamento.ts";
import { INV, ensureInv, shapeCells } from "../items/inventario.ts";
import { moveItem } from "../econ/economia.ts";
import { groundTake, renderInv, renderInvGrid, toggleInv } from "../field/chao.ts";
import { itemMsg } from "../field/masmorra.ts";
import { mnt } from "../creatures/tamandua.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { isArrowIt } from "../items/aljava.ts";
import { esc } from "../core/util.ts";
import type { GradeTela, InvGrid, Item } from "../core/tipos.ts";

interface DefRecip {
  id: string;
  /** o pedaço do quadro que vira o corpo da janela */
  area: () => HTMLElement | null;
  /** existe agora (a aljava sempre; os alforjes só com o tamanduá) */
  existe: () => boolean;
  titulo: () => string;
  grade: () => HTMLElement | null;
}
const DEFS: DefRecip[] = [
  {
    id: "aljava",
    area: () => document.querySelector<HTMLElement>("#inv-bags .ib-b, .inv-win#iw-aljava .ib-b"),
    existe: () => !!dungeon.hero,
    titulo: () => "🏹 Aljava",
    grade: () => document.getElementById("inv-qv"),
  },
  {
    id: "alforjes",
    area: () => document.getElementById("ib-saddle"),
    existe: () => !!dungeon.mount && !!mnt(),
    titulo: () => "🐾 Alforjes de " + esc(mnt()?.name || "tamanduá"),
    grade: () => document.getElementById("inv-saddle"),
  },
  /* v7.7 — baú do acampamento (documento mestre 5.1): perto dele, E abre a mochila com o baú numa janela ao lado */
  {
    id: "bau",
    area: areaBau,
    existe: pertoDoBau,
    titulo: () => "📦 Baú do acampamento",
    grade: () => document.getElementById("inv-bau"),
  },
];
function pertoDoBau() {
  const d = dungeon;
  return !!d.camp && !!CPS.bau && Math.hypot(d.px - CPS.bau.x, d.py - CPS.bau.y) < d.tile * 1.6;
}
/** O corpo da janela do baú (as outras janelas usam pedaços do quadro da mochila; esta é criada aqui). */
function areaBau() {
  let a = document.getElementById("ib-bau");
  if (!a) {
    a = document.createElement("div");
    a.id = "ib-bau";
    a.innerHTML = '<div id="inv-bau" class="gridbox"></div>';
    document.getElementById("inv-modal")?.appendChild(a);
  }
  return a;
}
/** E perto do baú: abre a mochila com a janela do baú (destino do clique direito). */
export function abrirBauCampo() {
  RECIP.aberto.bau = true;
  RECIP.destino = "bau";
  toggleInv(true);
}
interface EstadoRecip {
  aberto: Record<string, boolean>;
  pos: Record<string, { x: number; y: number }>;
  destino: string; // a janela que recebe o clique direito vindo da mochila
}
const RECIP: EstadoRecip = { aberto: { aljava: true, alforjes: true, bau: true }, pos: {}, destino: "aljava" };

function janela(def: DefRecip) {
  let w = document.getElementById("iw-" + def.id);
  if (w) return w;
  const modal = document.getElementById("inv-modal");
  if (!modal) return null;
  w = document.createElement("div");
  w.id = "iw-" + def.id;
  w.className = "inv-win";
  w.innerHTML =
    '<div class="iw-bar"><b></b><small></small><i class="iw-dest" title="Destino do clique direito na mochila">⇄</i>' +
    '<button class="iw-x" title="Fechar">✕</button></div><div class="iw-body"></div><p class="iw-msg"></p>';
  modal.appendChild(w);
  const bar = w.querySelector<HTMLElement>(".iw-bar")!;
  w.querySelector(".iw-x")!.addEventListener("click", (e) => {
    e.stopPropagation();
    RECIP.aberto[def.id] = false;
    recipMontar();
  });
  // tocar na janela a torna o destino do clique direito
  w.addEventListener("pointerdown", () => {
    if (RECIP.destino !== def.id) {
      RECIP.destino = def.id;
      recipMontar();
    }
  });
  let off: { dx: number; dy: number } | null = null;
  bar.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = w!.getBoundingClientRect();
    off = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    try {
      bar.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
  });
  bar.addEventListener("pointermove", (e) => {
    if (!off) return;
    colocar(w!, e.clientX - off.dx, e.clientY - off.dy);
    RECIP.pos[def.id] = { x: parseFloat(w!.style.left), y: parseFloat(w!.style.top) };
  });
  const fim = () => (off = null);
  bar.addEventListener("pointerup", fim);
  bar.addEventListener("pointercancel", fim);
  return w;
}
function colocar(w: HTMLElement, x: number, y: number) {
  const r = w.getBoundingClientRect();
  w.style.left = Math.max(0, Math.min(innerWidth - Math.max(80, r.width * 0.4), x)) + "px";
  w.style.top = Math.max(0, Math.min(innerHeight - 40, y)) + "px";
}
/** Lugar inicial: à direita do quadro da mochila, uma embaixo da outra. */
function lugarInicial(w: HTMLElement, i: number) {
  const card = document.getElementById("inv-card");
  const r = card ? card.getBoundingClientRect() : null;
  // v8.0: com a mochila ao lado (zoom máximo, encostada na direita) as janelas vão para a esquerda dela
  const lado = !!document.getElementById("inv-modal")?.classList.contains("lateral");
  // (a largura ainda é a da janela vazia: a grade enche depois; 190 cabe a aljava)
  const x = r ? (lado ? r.left - Math.max(190, w.offsetWidth) - 10 : r.right + 10) : innerWidth - 260,
    y = (r ? r.top : 80) + i * 210;
  colocar(w, x + w.offsetWidth > innerWidth ? innerWidth - w.offsetWidth - 10 : x, y);
}
/** v7.7 — depois de preenchida (a grade dá a largura), a janela não pode passar da borda direita da tela. */
function caber(w: HTMLElement) {
  const r = w.getBoundingClientRect();
  if (r.right > innerWidth - 4) colocar(w, Math.max(0, innerWidth - r.width - 10), r.top);
}
function ocupado(inv: InvGrid) {
  let n = 0;
  for (const it of inv.items) n += shapeCells(it.shape);
  return n + " / " + inv.cols * inv.rows;
}
function invDe(def: DefRecip): InvGrid | null {
  const g = def.grade();
  const gr = g ? INV.invGrids.find((o) => o.el === g) : null;
  return gr ? gr.inv : def.id === "aljava" && dungeon.hero ? qvInv(dungeon.hero) : null;
}
function visivel(def: DefRecip) {
  const w = document.getElementById("iw-" + def.id);
  return !!w && w.style.display !== "none";
}

/** Monta e atualiza as janelas e os botões (renderInv chama, com a mochila do campo aberta). */
export function recipMontar() {
  const d = dungeon;
  if (!d.active || !d.invOpen) return;
  // v7.7: a grade do baú entra no arrastar e soltar quando ele está perto
  {
    const g = document.getElementById("inv-bau") || areaBau().querySelector<HTMLElement>("#inv-bau")!;
    INV.invGrids = INV.invGrids.filter((o) => o.el !== g);
    if (pertoDoBau() && RECIP.aberto.bau) {
      const gr: GradeTela = { el: g, inv: econ.stash, discard: false };
      INV.invGrids.push(gr);
      renderInvGrid(gr);
    }
  }
  // botões no painel do personagem
  const painel = document.querySelector<HTMLElement>("#inv-bags .ib-d");
  if (painel) {
    let barra = painel.querySelector<HTMLElement>(".recip-bar");
    if (!barra) {
      barra = document.createElement("div");
      barra.className = "recip-bar";
      painel.appendChild(barra);
      barra.addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>("[data-recip]");
        if (!b) return;
        const id = b.dataset.recip!;
        RECIP.aberto[id] = !RECIP.aberto[id];
        if (RECIP.aberto[id]) RECIP.destino = id;
        recipMontar();
      });
    }
    barra.innerHTML = DEFS.filter((f) => f.existe())
      .map(
        (f) =>
          '<button class="btn' +
          (RECIP.aberto[f.id] ? " active" : "") +
          '" data-recip="' +
          f.id +
          '" title="Abrir/fechar a janela">' +
          f.titulo() +
          "</button>",
      )
      .join("");
  }
  DEFS.forEach((def, i) => {
    const area = def.area();
    if (!area) return;
    const w = janela(def);
    if (!w) return;
    const corpo = w.querySelector<HTMLElement>(".iw-body")!;
    if (area.parentElement !== corpo) {
      corpo.appendChild(area);
      area.querySelector(".ib-tit")?.remove(); // o nome vai na barra da janela
    }
    const on = def.existe() && !!RECIP.aberto[def.id];
    const antes = w.style.display;
    w.style.display = on ? "" : "none";
    if (!on) return;
    if (antes === "none" || !w.style.left) {
      const p = RECIP.pos[def.id];
      if (p) colocar(w, p.x, p.y);
      else lugarInicial(w, i);
    }
    const inv = invDe(def),
      longe = area.style.display === "none"; // alforjes: o tamanduá longe
    w.querySelector(".iw-bar b")!.innerHTML = def.titulo();
    w.querySelector(".iw-bar small")!.textContent = inv && !longe ? ocupado(inv) : "";
    w.querySelector(".iw-msg")!.textContent = longe
      ? "Chegue perto de " + (mnt()?.name || "dele") + " (T assobia)"
      : "";
    w.classList.toggle("dest", destinoAtual() === def.id);
    caber(w);
  });
  montarMochilasAbertas();
}

function destinoAtual() {
  const ok = (id: string) => {
    const def = DEFS.find((f) => f.id === id)!;
    const g = def.grade();
    return visivel(def) && !!g && g.offsetParent != null && INV.invGrids.some((o) => o.el === g);
  };
  if (RECIP.destino && ok(RECIP.destino)) return RECIP.destino;
  return DEFS.map((f) => f.id).find(ok) || "";
}
function gradeTela(id: string): GradeTela | null {
  const g = DEFS.find((f) => f.id === id)?.grade();
  return (g && INV.invGrids.find((o) => o.el === g)) || null;
}
/** Move `it` de `de` para `para`: junta nas pilhas iguais, depois procura lugar (girando se preciso). */
function moverPara(it: Item, de: GradeTela, para: GradeTela) {
  if (it.def.res) {
    for (const t of para.inv.items) {
      if (t !== it && t.def.key === it.def.key && (t.n || 1) < t.def.stack! && (it.n || 1) > 0) {
        const q = Math.min(t.def.stack! - (t.n || 1), it.n || 1);
        t.n = (t.n || 1) + q;
        it.n = (it.n || 1) - q;
      }
    }
    if ((it.n || 1) <= 0) {
      de.inv.items.splice(de.inv.items.indexOf(it), 1);
      if (de.inv.ground) groundTake(it);
      return true;
    }
  }
  if (!moveItem(it, de.inv, para.inv)) return false;
  if (de.inv.ground) groundTake(it);
  return true;
}
const NOMES: Record<string, string> = { aljava: "na aljava", alforjes: "nos alforjes", bau: "no baú" };
/**
 * Clique direito num item com a mochila do campo aberta. true = tratado aqui (moveu, ou disse por que não);
 * false = segue o jeito antigo (da mochila, sem janela de recipiente aberta: larga no chão).
 */
export function recipCliqueDireito(it: Item, gr: GradeTela) {
  const d = dungeon;
  if (!d.active || !d.invOpen || !d.hero) return false;
  const mochila = ensureInv(d.hero),
    grMochila = INV.invGrids.find((o) => o.inv === mochila);
  if (!grMochila) return false;
  let alvo: GradeTela | null, onde: string;
  if (gr.inv === mochila) {
    const id = destinoAtual();
    if (!id) return false;
    alvo = gradeTela(id);
    onde = NOMES[id] || "";
  } else {
    alvo = grMochila;
    onde = "na mochila";
  }
  if (!alvo || alvo === gr) return false;
  if (isArrowIt(it) && !alvo.inv.qv) {
    itemMsg("Flechas só vão na aljava.");
    return true;
  }
  if (!moverPara(it, gr, alvo)) itemMsg("Não cabe " + onde + " — o item ficou onde estava.");
  return true;
}

/* ---- v7.7 — mochilas guardadas abertas (menu do item: "🎒 Abrir"): cada uma numa janela com a grade dela, que entra no
   arrastar e soltar e no clique direito (dela para a mochila do corpo) como as outras ---- */
const ABERTAS: Item[] = [];
export function abrirMochilaGuardada(it: Item) {
  if (!it.conteudo) return;
  if (!ABERTAS.includes(it)) ABERTAS.push(it);
  renderInv();
}
function janelaMochila(it: Item, i: number) {
  const id = "iw-m" + it.uid;
  let w = document.getElementById(id);
  if (w) return w;
  const modal = document.getElementById("inv-modal");
  if (!modal) return null;
  w = document.createElement("div");
  w.id = id;
  w.className = "inv-win";
  w.innerHTML =
    '<div class="iw-bar"><b></b><small></small><button class="iw-x" title="Fechar">✕</button></div>' +
    '<div class="iw-body"><div class="gridbox"></div></div>';
  modal.appendChild(w);
  w.querySelector(".iw-x")!.addEventListener("click", (e) => {
    e.stopPropagation();
    const k = ABERTAS.indexOf(it);
    if (k >= 0) ABERTAS.splice(k, 1);
    w!.remove();
    renderInv();
  });
  const bar = w.querySelector<HTMLElement>(".iw-bar")!;
  let off: { dx: number; dy: number } | null = null;
  bar.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = w!.getBoundingClientRect();
    off = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    try {
      bar.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
  });
  bar.addEventListener("pointermove", (e) => {
    if (off) colocar(w!, e.clientX - off.dx, e.clientY - off.dy);
  });
  const fim = () => (off = null);
  bar.addEventListener("pointerup", fim);
  bar.addEventListener("pointercancel", fim);
  lugarInicial(w, 2 + i);
  return w;
}
function montarMochilasAbertas() {
  // a que foi vestida (ou sumiu) fecha
  for (let k = ABERTAS.length - 1; k >= 0; k--)
    if (!ABERTAS[k].conteudo) {
      document.getElementById("iw-m" + ABERTAS[k].uid)?.remove();
      ABERTAS.splice(k, 1);
    }
  ABERTAS.forEach((it, i) => {
    const w = janelaMochila(it, i);
    if (!w) return;
    const gr: GradeTela = { el: w.querySelector<HTMLElement>(".gridbox")!, inv: it.conteudo!, discard: false };
    INV.invGrids.push(gr);
    renderInvGrid(gr);
    w.querySelector(".iw-bar b")!.textContent = "🎒 Mochila guardada";
    w.querySelector(".iw-bar small")!.textContent = ocupado(it.conteudo!);
    caber(w);
  });
}
