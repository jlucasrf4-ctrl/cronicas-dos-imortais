/* ==== Fase 4 — ilhas Golden Fish e Vila Musgo: bote, docas, empório (v7.5) ==== */
import { CITIES } from "../data/economia.ts";
import { SPAWN0 } from "../core/config.ts";
import { ARQ, MUSGO } from "../data/mapa.ts";
import { quadOf } from "./quadrantes.ts";
import { WORLD_K } from "./vetorial.ts";
import { campPos, camZoomTo } from "../survival/acampamento.ts";
import { isWaterCell } from "./agua.ts";
import { camera, world, econ, dungeon, JANELAS } from "../core/state.ts";
import { MAPCTL } from "./controle.ts";
import { updateHeroPanelUI } from "../ui/painel.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mapTip } from "../intro/cena.ts";
import { cityPrice, updateEcon } from "../econ/economia.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { icoTag, icoItem } from "../ui/icones.ts";
import { refillQuiver } from "../render/sprites.ts";
import { mkItem, placeIn } from "../items/equipamento.ts";
import { ROPE } from "../data/combate.ts";
import { eqDurInit, eqName } from "../items/durabilidade.ts";
import { ensureInv } from "../items/inventario.ts";
import { tryAddToInv, sfx } from "../field/chao.ts";
import { itemSell } from "../items/qualidade.ts";
import { esc } from "../core/util.ts";
import { campanha, campanhaEventoAtual } from "../campanha/campanha.ts";
import { VILA_ST, vilaAbas, vilaConteudo, vilaClique } from "./vila.ts";
import { VCS, vilaSair } from "./vila_cena.ts";
import type { Hero, Item, Ponto } from "../core/tipos.ts";

export function musgoCity() {
  return CITIES.find((c) => c.id === "musgo");
}
export function arqName(k: string) {
  try {
    return k && k === quadOf(SPAWN0.x * WORLD_K, SPAWN0.y * WORLD_K) ? ARQ.nome : null;
  } catch (_) {
    return null;
  }
}

/* ---------- bote: doca da vila e doca da área de caça ---------- */
export function docaCaca() {
  if (MUSGO._dc) return MUSGO._dc;
  const p = campPos(),
    c = musgoCity();
  if (!p || !c) return null;
  const ang = Math.atan2(c.y - p.y, c.x - p.x);
  let last = { x: p.x, y: p.y };
  for (let r = 6; r < 600; r += 4) {
    const x = p.x + Math.cos(ang) * r,
      y = p.y + Math.sin(ang) * r;
    if (isWaterCell(x, y)) break;
    last = { x, y };
  }
  return (MUSGO._dc = { x: last.x - Math.cos(ang) * 6, y: last.y - Math.sin(ang) * 6, ang });
}
export function docaVila() {
  const c = musgoCity();
  return c ? { x: c.x + 16, y: c.y + 10 } : null;
}
/* desenho: docas com bote, e o nome do arquipélago quando o mapa está afastado */
export function drawDoca(c: CanvasRenderingContext2D, P: Ponto, t: number) {
  const k = Math.max(0.55, Math.min(1.5, 1.1 / Math.sqrt(camera.scale)));
  c.save();
  c.translate(P.x, P.y);
  c.scale(k, k);
  c.fillStyle = "#7a5530";
  c.fillRect(-9, -2, 18, 4);
  c.fillStyle = "#5a3d20";
  for (const x of [-7, 0, 7]) c.fillRect(x - 1, -2, 2, 7);
  c.font = "14px serif";
  c.textAlign = "center";
  c.fillText("⛵", 4, -5 + Math.sin(t * 2) * 1.2);
  c.restore();
}

export function heroPerto(P: Ponto, r: number) {
  if (!P) return null;
  return (
    world.heroes.find(
      (h) =>
        (h.state === "field" || h.state === "walking" || h.state === "idle") && Math.hypot(h.x - P.x, h.y - P.y) < r,
    ) || null
  );
}
export function heroNaVila() {
  const c = musgoCity();
  return heroPerto(c!, MUSGO.raio);
}
export function boteViagem(h: Hero, para: string) {
  const D = para === "vila" ? docaVila() : docaCaca();
  if (!h || !D) return;
  // v8.0 — campanha (Ato 4): o Caçador avisou que o bote está furado; a doca da vila conserta (Ato 6)
  const F = campanha().flags;
  if (F.boteFurado && !F.boteConsertado) {
    mapTip("⛵ O bote está furado · até a doca da vila consertar, o caminho é a pé");
    return;
  }
  const ov = document.createElement("div");
  ov.id = "bote-fade";
  ov.innerHTML = "<div>⛵ Atravessando o canal…</div>";
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("on"));
  h.walkTo = null;
  h.task = null;
  h._toMusgo = false;
  h._toDoca = false;
  setTimeout(() => {
    h.x = D.x;
    h.y = D.y;
    h.state = "field";
    MAPCTL.sel = h.id;
    try {
      camZoomTo(D.x, D.y, Math.max(camera.scale, camera.minScale * 6), 10);
      updateHeroPanelUI();
    } catch (_) {}
    pushEvent(
      "⛵ " + h.name + " atravessou de bote até " + (para === "vila" ? "a Vila Musgo" : "a área de caça") + ".",
    );
    setTimeout(() => {
      ov.classList.remove("on");
      setTimeout(() => ov.remove(), 500);
      mapTip(
        para === "vila"
          ? "🏘 Vila Musgo — clique na vila para comprar e vender"
          : "🏕 De volta à área de caça · o acampamento fica perto",
      );
    }, 350);
  }, 1100);
}

/* ---------- empório da vila ---------- */
function empPreco(k: string, base: number) {
  if (k === "flechas10") return base;
  try {
    return Math.max(base, Math.ceil(cityPrice(musgoCity()!, k, 0) * 1.5));
  } catch (_) {
    return base;
  }
}
function empItemNome(k: string) {
  return k === "flechas10" ? "10 flechas" : ITEM_DEFS[k].name;
}
function empIco(k: string) {
  return k === "flechas10" ? icoTag("flecha", "🏹") : icoItem(ITEM_DEFS[k]);
}
function empComprar(h: Hero, k: string, preco: number) {
  const free = econ.test;
  if (!free && (econ.gold || 0) < preco) return "Ouro insuficiente.";
  if (k === "flechas10") {
    econ.arrowStock = (econ.arrowStock || 0) + 10;
    refillQuiver();
  } else if (ITEM_DEFS[k].slot || k === "corda") {
    const it = mkItem(k);
    if (k === "corda") it.uses = ROPE.uses;
    else eqDurInit(it);
    if (!placeIn(ensureInv(h), it)) return "Sem espaço na mochila.";
  } else if (!tryAddToInv(ensureInv(h), k, 0)) return "Sem espaço na mochila.";
  if (!free) econ.gold -= preco;
  try {
    updateEcon();
    sfx("ping");
  } catch (_) {}
  return "✅ Comprou " + empItemNome(k) + ".";
}
function empVender(h: Hero, it: Item) {
  const c = musgoCity(),
    inv = ensureInv(h),
    i = inv.items.indexOf(it);
  if (i < 0) return "";
  const v = itemSell(c!, it);
  inv.items.splice(i, 1);
  econ.gold = (econ.gold || 0) + v;
  try {
    updateEcon();
    sfx("ping");
  } catch (_) {}
  pushEvent(
    "🏘 " + h.name + " vendeu " + eqName(it) + ((it.n || 1) > 1 ? " ×" + it.n : "") + " na Vila Musgo por " + v + "💰.",
  );
  campanhaEventoAtual("vendeuVila"); // v8.0: a missão de vender (só se for a atual: vender antes não pula o Ato 3)
  return "💰 Vendeu " + eqName(it) + " por " + v + ".";
}
/** `aba` (v8.0, a vila andável, map/vila_cena.ts): abre só aquele lugar, com o `titulo` dele e sem a barra de abas;
    sem `aba`, a janela com as abas de antes (os testes e o GameShark ainda usam). */
export function empOpen(h: Hero, aba?: string, titulo?: string) {
  h = h || heroNaVila();
  if (!h) {
    mapTip("🏘 Leve um personagem até a Vila Musgo para comerciar");
    return;
  }
  MUSGO.h = h;
  VILA_ST.cena = aba ? titulo || "" : "";
  if (aba) {
    VILA_ST.aba = aba;
    VILA_ST.fala = null;
    VILA_ST.msg = "";
    JANELAS.EMP_TAB = "compra";
  }
  let m = document.getElementById("musgo-modal");
  if (!m) {
    m = document.createElement("div");
    m.id = "musgo-modal";
    m.className = "v3-modal";
    document.body.appendChild(m);
    m.addEventListener("click", (e) => {
      if (e.target === m) {
        empClose();
        return;
      }
      const b = (e.target as HTMLElement).closest("[data-mz],[data-vl]") as HTMLButtonElement;
      if (!b || b.disabled) return;
      const a = b.dataset.mz,
        H = MUSGO.h!;
      // v8.0: as abas da vila (map/vila.ts: taverna, quadro, doca, igreja)
      if (vilaClique(b, H, () => boteDaVila(H))) {
        empRender();
        return;
      }
      if (a === "x") empClose();
      else if (a === "tab") {
        JANELAS.EMP_TAB = b.dataset.t!;
        JANELAS.MSG_EMP = "";
        empRender();
      } else if (a === "buy") {
        JANELAS.MSG_EMP = empComprar(H, b.dataset.k!, +b.dataset.p!);
        empRender();
      } else if (a === "sell") {
        const it = ensureInv(H).items.find((x) => (x.uid as number | string) == b.dataset.u);
        if (it) JANELAS.MSG_EMP = empVender(H, it);
        empRender();
      } else if (a === "bote") boteDaVila(H);
    });
  }
  JANELAS.MSG_EMP = "";
  m.classList.add("open");
  empRender();
}
/** O bote para a área de caça: dentro da vila andável, sai dela primeiro e atravessa quando o mapa voltar. */
function boteDaVila(h: Hero) {
  empClose();
  if (dungeon.active && dungeon.vila) vilaSair(() => boteViagem(h, "caca"));
  else boteViagem(h, "caca");
}
export function empClose() {
  const m = document.getElementById("musgo-modal");
  if (m) m.classList.remove("open");
  // v8.0: a janela de um lugar da vila andável: a heroína volta a andar
  if (VCS.aberto) {
    VCS.aberto = null;
    if (dungeon.active) dungeon.modalOpen = false;
  }
}
function empRender() {
  const m = document.getElementById("musgo-modal");
  if (!m) return;
  const h = MUSGO.h!,
    c = musgoCity(),
    free = econ.test,
    g = econ.gold || 0;
  let rows: string;
  if (JANELAS.EMP_TAB === "compra")
    rows = MUSGO.loja
      .map(([k, p0]) => [k, empPreco(k, p0)] as const)
      .map(
        ([k, p]) =>
          "<div class='emp-row'>" +
          empIco(k) +
          "<span>" +
          empItemNome(k) +
          "</span><b>" +
          (free ? "grátis" : p + "💰") +
          "</b><button class='btn' data-mz='buy' data-k='" +
          k +
          "' data-p='" +
          p +
          "'" +
          (!free && g < p ? " disabled" : "") +
          ">Comprar</button></div>",
      )
      .join("");
  else {
    const L = ensureInv(h).items.filter((it) => (it.def && it.def.key !== "corda") || true);
    rows = L.length
      ? L.map(
          (it) =>
            "<div class='emp-row'>" +
            icoItem(it.def) +
            "<span>" +
            eqName(it) +
            ((it.n || 1) > 1 ? " ×" + it.n : "") +
            "</span><b>" +
            itemSell(c!, it) +
            "💰</b><button class='btn' data-mz='sell' data-u='" +
            it.uid +
            "'>Vender</button></div>",
        ).join("")
      : "<p class='emp-vazio'>A mochila de " + esc(h.name) + " está vazia.</p>";
  }
  // v8.0: a vila em janela (map/vila.ts): a barra de abas; fora do Empório, o conteúdo da aba. Na vila andável
  // (VILA_ST.cena), só o lugar da porta: o nome dele no título e sem as abas nem o bote do rodapé (o bote é a doca)
  const emporio = VILA_ST.aba === "emporio" && !VILA_ST.fala,
    cena = !!VILA_ST.cena;
  m.innerHTML =
    "<div class='v3-card emp-card'><div class='mt-head'><b>" +
    (cena ? esc(VILA_ST.cena) : "🏘 Vila Musgo") +
    "</b><button class='btn' data-mz='x'>✕</button></div>" +
    (cena ? "" : vilaAbas()) +
    "<div class='emp-top'><span>" +
    esc(h.name) +
    "</span><span>💰 " +
    g +
    " ouro</span></div>" +
    (emporio
      ? "<div class='emp-tabs'><button class='btn" +
        (JANELAS.EMP_TAB === "compra" ? " pri" : "") +
        "' data-mz='tab' data-t='compra'>Comprar</button><button class='btn" +
        (JANELAS.EMP_TAB === "venda" ? " pri" : "") +
        "' data-mz='tab' data-t='venda'>Vender (mochila)</button></div>" +
        "<div class='emp-list'>" +
        rows +
        "</div>" +
        (JANELAS.MSG_EMP ? "<p class='emp-msg'>" + JANELAS.MSG_EMP + "</p>" : "") +
        "<div class='emp-foot'><small>A vila paga melhor por: 🦊 pele, 🥩 carne, 🪶 pena e 🐟 peixe.</small>" +
        (cena ? "" : "<button class='btn' data-mz='bote'>⛵ Bote para a área de caça</button>") +
        "</div>"
      : "<div class='emp-list'>" + vilaConteudo(h) + "</div>") +
    "</div>";
}
