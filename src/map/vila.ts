/* ==== v8.0 — a vila em janela (ROADMAP Etapa 2; decisão do mantenedor 2026-10-23: janela com abas agora, a cena 3D
   andável depois) ====
   A janela do Empório da Vila Musgo (map/vila_musgo.ts) ganha abas: Empório (o de antes), Taverna, Quadro, Doca e
   Igreja. As conversas (FALAS de data/campanha.ts) aparecem dentro da própria janela, página por página.
   - Taverna: dormir pagando (VILA.dormir) até de manhã; a conversa do taverneiro (o boato da Runa Selvagem).
   - Quadro: três pedidos por dia (QUADRO, sorteados pelo dia), entregar da mochila por ouro.
   - Doca: o bote furado (campanha.flags.boteFurado, Ato 4) conserta com galhos e ouro (VILA.conserto) e fica pronto
     em dias (flags.boteConsertoAte → boteConsertado, conferido em vilaTick); pronto, a doca atravessa.
   - Igreja: o Imortal lê a afinidade (IMORTAL_AFINIDADE) e fala da Lebre Rúnica.
   A campanha anda por campanhaEventoAtual: ouviuBoato, boteEntregue, falouImortal (fora de hora não pula nada). */
import { dungeon, econ, world } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { VILA, QUADRO, IMORTAL_AFINIDADE } from "../data/vila.ts";
import { FALAS, FALANTES } from "../data/campanha.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { campanha, campanhaEventoAtual } from "../campanha/campanha.ts";
import { ensureInv } from "../items/inventario.ts";
import { updateEcon } from "../econ/economia.ts";
import { pushEvent } from "../sim/eventos.ts";
import { mvToast } from "../ui/avisos.ts";
import { esc } from "../core/util.ts";
import type { Hero } from "../core/tipos.ts";

/** aba: a aba aberta; fala: a conversa em andamento (id em FALAS, página, o que fazer no fim); msg: a linha de aviso. */
export const VILA_ST = {
  aba: "emporio",
  fala: null as { id: string; i: number; fim: (() => void) | null } | null,
  msg: "",
  afi: "", // o que o Imortal diz da afinidade dela
  cena: "", // v8.0: aberta pela porta na vila andável (map/vila_cena.ts): o nome do lugar; "" = a janela com as abas
};
const ABAS: [string, string][] = [
  ["emporio", "🏪 Empório"],
  ["taverna", "🍺 Taverna"],
  ["quadro", "📜 Quadro"],
  ["doca", "⛵ Doca"],
  ["igreja", "⛪ Igreja"],
];

const dia = () => Math.floor(world.tick / CONFIG.DAY_MIN);
const ouro = () => econ.gold || 0;

/** Quantos `key` ela tem na mochila (contando as pilhas). */
function tem(h: Hero, key: string) {
  let n = 0;
  for (const it of ensureInv(h).items) if (it.def && it.def.key === key) n += it.n || 1;
  return n;
}
/** Tira `n` de `key` da mochila (das pilhas). */
function tirar(h: Hero, key: string, n: number) {
  const inv = ensureInv(h);
  for (let i = inv.items.length - 1; i >= 0 && n > 0; i--) {
    const it = inv.items[i];
    if (!it.def || it.def.key !== key) continue;
    const q = it.n || 1;
    if (q <= n) {
      inv.items.splice(i, 1);
      n -= q;
    } else {
      it.n = q - n;
      n = 0;
    }
  }
}

/** A barra de abas da janela da vila. */
export function vilaAbas() {
  return (
    "<div class='vila-abas'>" +
    ABAS.map(
      ([k, t]) =>
        "<button class='btn" +
        (VILA_ST.aba === k ? " pri" : "") +
        "' data-vl='aba' data-a='" +
        k +
        "'>" +
        t +
        "</button>",
    ).join("") +
    "</div>"
  );
}

/** O conteúdo da aba aberta (menos o Empório, que é o de vila_musgo.ts), ou a conversa em andamento. */
export function vilaConteudo(h: Hero) {
  if (VILA_ST.fala) return falaHtml();
  const msg = VILA_ST.msg ? "<p class='emp-msg'>" + VILA_ST.msg + "</p>" : "";
  if (VILA_ST.aba === "taverna") return tavernaHtml() + msg;
  if (VILA_ST.aba === "quadro") return quadroHtml(h) + msg;
  if (VILA_ST.aba === "doca") return docaHtml(h) + msg;
  if (VILA_ST.aba === "igreja") return igrejaHtml() + msg;
  return msg;
}

/* ---------- a conversa dentro da janela ---------- */
function falar(id: string, fim: (() => void) | null) {
  VILA_ST.fala = { id, i: 0, fim };
}
function falaHtml() {
  const F = VILA_ST.fala!,
    D = FALAS[F.id],
    q = FALANTES[D.quem] || { nome: "", ava: "" },
    pag = D.paginas[F.i] || [],
    ult = F.i >= D.paginas.length - 1;
  return (
    "<div class='vila-fala'><div class='vila-quem'><span>" +
    q.ava +
    "</span><b>" +
    esc(q.nome) +
    "</b></div>" +
    pag.map((l) => "<p>" + esc(l.replace("{afinidade}", VILA_ST.afi)) + "</p>").join("") +
    "<button class='btn pri' data-vl='fala'>" +
    (ult ? "Fechar" : "Continuar ▸") +
    "</button></div>"
  );
}
/** O Imortal lê a afinidade: a fala tem "{afinidade}" no lugar do texto (trocado ao mostrar, em falaHtml). */
function afinidadeNaFala(h: Hero) {
  VILA_ST.afi = IMORTAL_AFINIDADE[h.aff] || "Não consigo ler você. Isso é raro.";
}

/* ---------- taverna ---------- */
function tavernaHtml() {
  return (
    "<div class='vila-sec'><p>Lareira acesa, cheiro de cerveja e carne. O taverneiro limpa as canecas.</p>" +
    "<button class='btn' data-vl='boato'>🍺 Conversar com o taverneiro</button>" +
    "<button class='btn' data-vl='dormir'" +
    (ouro() < VILA.dormir && !econ.test ? " disabled" : "") +
    ">🛏 Dormir até de manhã (" +
    VILA.dormir +
    "💰)</button></div>"
  );
}
function dormirTaverna(h: Hero) {
  if (!econ.test && ouro() < VILA.dormir) return "Ouro insuficiente.";
  const min = world.tick % CONFIG.DAY_MIN,
    alvo = VILA.acorda * 60;
  let falta = (alvo - min + CONFIG.DAY_MIN) % CONFIG.DAY_MIN;
  if (falta < 60) falta += CONFIG.DAY_MIN; // já é de manhã: dorme até a manhã seguinte
  if (!econ.test) econ.gold = ouro() - VILA.dormir;
  world.fastForwardTarget += falta;
  h.hp = h.hpMax;
  h.wound = 0;
  if (dungeon.active && dungeon.hero === h) {
    // v8.0: dentro da vila andável a vida é a do campo (a saída copia de volta para ela)
    dungeon.hp = dungeon.hpMax;
    dungeon.wound = 0;
  }
  updateEcon();
  pushEvent("🛏 " + h.name + " dormiu na taverna da Vila Musgo.");
  campanhaEventoAtual("dormiu");
  campanhaEventoAtual("noiteCria");
  return "🛏 Dormiu na taverna. Vida cheia; amanhece às " + VILA.acorda + "h.";
}

/* ---------- quadro de missões ---------- */
/** Os três pedidos de hoje (índices de QUADRO, sorteados pelo dia). */
function pedidosDoDia() {
  const d = dia(),
    L: number[] = [];
  for (let i = 0; L.length < Math.min(3, QUADRO.length) && i < 20; i++) {
    const k = (d * 7 + i * 5 + ((d * 13) % 11)) % QUADRO.length;
    if (!L.includes(k)) L.push(k);
  }
  return L;
}
function feitosHoje(): number[] {
  const F = campanha().flags;
  if (F.quadroDia !== dia()) return [];
  return String(F.quadroFeitos || "")
    .split(",")
    .filter(Boolean)
    .map(Number);
}
function quadroHtml(h: Hero) {
  const feitos = feitosHoje();
  return (
    "<div class='vila-sec'><p>Papéis presos com prego. Trocam todo dia.</p>" +
    pedidosDoDia()
      .map((k) => {
        const P = QUADRO[k],
          ok = tem(h, P.item) >= P.n,
          feito = feitos.includes(k),
          nome = ITEM_DEFS[P.item] ? ITEM_DEFS[P.item].name : P.item;
        return (
          "<div class='emp-row vila-row'><span>" +
          esc(P.txt) +
          " · " +
          P.n +
          "× " +
          esc(nome) +
          " (" +
          Math.min(tem(h, P.item), P.n) +
          "/" +
          P.n +
          ")</span><b>" +
          P.ouro +
          "💰</b>" +
          (feito
            ? "<button class='btn' disabled>✔ Entregue</button>"
            : "<button class='btn' data-vl='entregar' data-k='" +
              k +
              "'" +
              (ok ? "" : " disabled") +
              ">Entregar</button>") +
          "</div>"
        );
      })
      .join("") +
    "</div>"
  );
}
function entregar(h: Hero, k: number) {
  const P = QUADRO[k];
  if (!P || feitosHoje().includes(k) || !pedidosDoDia().includes(k)) return "";
  if (tem(h, P.item) < P.n) return "Faltam itens na mochila.";
  tirar(h, P.item, P.n);
  econ.gold = ouro() + P.ouro;
  const F = campanha().flags;
  F.quadroDia = dia();
  F.quadroFeitos = feitosHoje().concat(k).join(",");
  updateEcon();
  pushEvent("📜 " + h.name + " cumpriu um pedido do quadro: +" + P.ouro + "💰.");
  return "📜 Pedido entregue: +" + P.ouro + "💰.";
}

/* ---------- doca ---------- */
function docaHtml(h: Hero) {
  const F = campanha().flags,
    C = VILA.conserto;
  if (!F.boteFurado || F.boteConsertado)
    return "<div class='vila-sec'><p>O bote do Caçador balança amarrado no píer.</p><button class='btn pri' data-vl='bote'>⛵ Bote para a área de caça</button></div>";
  if (F.boteConsertoAte) {
    const h_ = Math.max(1, Math.ceil(((F.boteConsertoAte as number) - world.tick) / 60));
    return "<div class='vila-sec'><p>O barqueiro está remendando o casco. Fica pronto em ~" + h_ + " h.</p></div>";
  }
  const pode = tem(h, "galho") >= C.galhos && (econ.test || ouro() >= C.ouro);
  return (
    "<div class='vila-sec'><p>O barqueiro olha o bote furado e balança a cabeça.</p>" +
    "<button class='btn' data-vl='barqueiro'>⛵ Falar com o barqueiro</button>" +
    "<button class='btn' data-vl='conserto'" +
    (pode ? "" : " disabled") +
    ">🪵 Entregar " +
    C.galhos +
    " galhos e " +
    C.ouro +
    "💰 (" +
    Math.min(tem(h, "galho"), C.galhos) +
    "/" +
    C.galhos +
    " galhos)</button></div>"
  );
}
function consertar(h: Hero) {
  const F = campanha().flags,
    C = VILA.conserto;
  if (!F.boteFurado || F.boteConsertado || F.boteConsertoAte) return "";
  if (tem(h, "galho") < C.galhos || (!econ.test && ouro() < C.ouro)) return "Faltam galhos ou ouro.";
  tirar(h, "galho", C.galhos);
  if (!econ.test) econ.gold = ouro() - C.ouro;
  F.boteConsertoAte = world.tick + C.dias * CONFIG.DAY_MIN;
  updateEcon();
  pushEvent("⛵ O barqueiro da Vila Musgo começou a consertar o bote (" + C.dias + " dias).");
  falar("doca_conserto", () => campanhaEventoAtual("boteEntregue"));
  return "";
}
/** Conferido de tempos em tempos (pedidosTick): o conserto do bote terminou. */
export function vilaTick() {
  const F = campanha().flags;
  if (F.boteFurado && !F.boteConsertado && F.boteConsertoAte && world.tick >= (F.boteConsertoAte as number)) {
    F.boteConsertado = true;
    mvToast("⛵ O bote está consertado · a doca da vila leva de volta à área de caça");
    pushEvent("⛵ O barqueiro terminou o conserto do bote.");
  }
}

/* ---------- igreja ---------- */
function igrejaHtml() {
  return (
    "<div class='vila-sec'><p>Bancos de madeira, velas e silêncio. Dois cavaleiros de armadura escura esperam ao lado do altar.</p>" +
    "<button class='btn' data-vl='imortal'>✨ Falar com o Imortal</button></div>"
  );
}

/** Clique num botão da vila (data-vl). true = tratou (quem chamou desenha de novo). */
export function vilaClique(b: HTMLElement, h: Hero, bote: () => void) {
  const a = b.dataset.vl;
  if (!a) return false;
  VILA_ST.msg = "";
  if (a === "aba") {
    VILA_ST.aba = b.dataset.a!;
    VILA_ST.fala = null;
  } else if (a === "fala") {
    const F = VILA_ST.fala!;
    if (F.i < FALAS[F.id].paginas.length - 1) F.i++;
    else {
      VILA_ST.fala = null;
      if (F.fim) F.fim();
    }
  } else if (a === "boato") falar("taverna_boato", () => campanhaEventoAtual("ouviuBoato"));
  else if (a === "dormir") VILA_ST.msg = dormirTaverna(h);
  else if (a === "entregar") VILA_ST.msg = entregar(h, +b.dataset.k!);
  else if (a === "barqueiro") falar("doca_pedido", null);
  else if (a === "conserto") VILA_ST.msg = consertar(h);
  else if (a === "imortal") {
    afinidadeNaFala(h);
    falar("igreja_imortal", () => campanhaEventoAtual("falouImortal"));
  } else if (a === "bote") bote();
  return true;
}
