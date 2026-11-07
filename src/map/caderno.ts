/* ==== v8.3 — caderno do cartógrafo: N abre a janela #caderno com duas abas: "Anotações" (texto livre) e "Desenho"
   (canvas com caneta, cores e borracha). O que está escrito e desenhado fica em econ.caderno (vai no save). Como o
   diário (campanha/diario.ts), no campo o jogo pausa enquanto ela está aberta, e só se não estava pausado antes.
   A perícia "Cartógrafo" aparece no topo com o nível do herói e as células exploradas (map/explorar.ts). ==== */
import { dungeon, econ, world } from "../core/state.ts";
import { celulasExploradas } from "./explorar.ts";

const CORES = ["#2a1a08", "#8a1f12", "#1d4f8a", "#2f6b2f"];
const CADERNO = {
  aberta: false,
  pausou: false,
  aba: "notas" as "notas" | "desenho",
  cor: 0,
  desenhando: false,
  ultimo: null as { x: number; y: number } | null,
};

/** O que está no caderno, criado na primeira vez. */
function dados() {
  return (econ.caderno ||= { notas: "", desenho: "" });
}

function janela() {
  let el = document.getElementById("caderno");
  if (el) return el;
  el = document.createElement("div");
  el.id = "caderno";
  el.innerHTML =
    "<div class='cad-folha'>" +
    "<header><b>📓 Caderno do cartógrafo</b><span id='cad-pericia'></span><button class='btn' id='cad-x' title='Fechar (N ou Esc)'>✕</button></header>" +
    "<nav><button data-aba='notas' class='on'>✎ Anotações</button><button data-aba='desenho'>🖌 Desenho</button></nav>" +
    "<section id='cad-notas'><textarea id='cad-texto' placeholder='Anote o que você vê: onde ficam as armadilhas, as minas, as plantas...'></textarea></section>" +
    "<section id='cad-desenho' hidden><div class='cad-barra'>" +
    CORES.map(
      (c, i) =>
        "<button class='cad-cor' data-cor='" +
        i +
        "' style='background:" +
        c +
        "' title='Cor " +
        (i + 1) +
        "'></button>",
    ).join("") +
    "<button id='cad-borracha' title='Borracha'>⌫</button><button id='cad-limpar' title='Apagar tudo'>🗑</button></div>" +
    "<canvas id='cad-tela' width='560' height='360'></canvas></section>" +
    "<footer><kbd>N</kbd> abre e fecha · <kbd>Esc</kbd> fecha</footer></div>";
  document.body.appendChild(el);
  // o Esc é tratado aqui: com o foco no texto, o atalho global ignora as teclas
  el.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    e.stopPropagation();
    fecharCaderno();
  });
  el.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "cad-x") return fecharCaderno();
    const aba = t.closest("nav button")?.getAttribute("data-aba") as "notas" | "desenho" | null | undefined;
    if (aba) return trocarAba(aba);
    const cor = t.closest(".cad-cor")?.getAttribute("data-cor");
    if (cor != null) {
      CADERNO.cor = +cor;
      borracha = false;
      return;
    }
    if (t.id === "cad-borracha") return (borracha = true);
    if (t.id === "cad-limpar") {
      const c = document.getElementById("cad-tela") as HTMLCanvasElement;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      salvarDesenho();
    }
  });
  document.getElementById("cad-texto")!.addEventListener("input", (e) => {
    dados().notas = (e.target as HTMLTextAreaElement).value;
  });
  const tela = el.querySelector("#cad-tela") as HTMLCanvasElement;
  tela.addEventListener("pointerdown", (e) => {
    CADERNO.desenhando = true;
    tela.setPointerCapture(e.pointerId);
    CADERNO.ultimo = pontoNaTela(tela, e);
    traco(tela, CADERNO.ultimo, CADERNO.ultimo);
  });
  tela.addEventListener("pointermove", (e) => {
    if (!CADERNO.desenhando || !CADERNO.ultimo) return;
    const p = pontoNaTela(tela, e);
    traco(tela, CADERNO.ultimo, p);
    CADERNO.ultimo = p;
  });
  const fim = () => {
    if (!CADERNO.desenhando) return;
    CADERNO.desenhando = false;
    CADERNO.ultimo = null;
    salvarDesenho();
  };
  tela.addEventListener("pointerup", fim);
  tela.addEventListener("pointercancel", fim);
  return el;
}

let borracha = false;

function pontoNaTela(tela: HTMLCanvasElement, e: PointerEvent) {
  const r = tela.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * tela.width, y: ((e.clientY - r.top) / r.height) * tela.height };
}

function traco(tela: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }) {
  const c = tela.getContext("2d")!;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = borracha ? 18 : 2.4;
  if (borracha) c.globalCompositeOperation = "destination-out";
  else c.strokeStyle = CORES[CADERNO.cor];
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
  c.restore();
}

function salvarDesenho() {
  const tela = document.getElementById("cad-tela") as HTMLCanvasElement | null;
  if (tela) dados().desenho = tela.toDataURL("image/png");
}

/** A perícia do caderno: o maior nível de cartógrafo entre os heróis. */
function periciaTexto() {
  let nivel = 0;
  for (const h of world.heroes) {
    const s = h.skills?.cartografo;
    if (s && typeof s.level === "number") nivel = Math.max(nivel, s.level);
  }
  return "Cartógrafo nível " + nivel + " · " + celulasExploradas() + " áreas exploradas";
}

function trocarAba(aba: "notas" | "desenho") {
  CADERNO.aba = aba;
  const el = janela();
  el.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-aba") === aba));
  (document.getElementById("cad-notas") as HTMLElement).hidden = aba !== "notas";
  (document.getElementById("cad-desenho") as HTMLElement).hidden = aba !== "desenho";
}

function abrirCaderno() {
  if (CADERNO.aberta) return;
  const tit = document.getElementById("title-screen");
  if (tit && tit.classList.contains("open")) return;
  if (dungeon.active && dungeon.mode === "intro") return; // a cena inicial guia sozinha
  CADERNO.aberta = true;
  CADERNO.pausou = false;
  if (dungeon.active && !dungeon.modalOpen) {
    dungeon.modalOpen = true;
    CADERNO.pausou = true;
  }
  const el = janela();
  const d = dados();
  (document.getElementById("cad-texto") as HTMLTextAreaElement).value = d.notas;
  const tela = document.getElementById("cad-tela") as HTMLCanvasElement;
  const c = tela.getContext("2d")!;
  c.clearRect(0, 0, tela.width, tela.height);
  if (d.desenho) {
    const img = new Image();
    img.onload = () => c.drawImage(img, 0, 0, tela.width, tela.height);
    img.src = d.desenho;
  }
  (el.querySelector("#cad-pericia") as HTMLElement).textContent = periciaTexto();
  trocarAba(CADERNO.aba);
  el.classList.add("on");
}

function fecharCaderno() {
  if (!CADERNO.aberta) return;
  CADERNO.aberta = false;
  if (CADERNO.pausou) dungeon.modalOpen = false;
  CADERNO.pausou = false;
  salvarDesenho();
  janela().classList.remove("on");
}

function alternarCaderno() {
  if (CADERNO.aberta) fecharCaderno();
  else abrirCaderno();
}

/** Tecla (iniciarCampanha chama): N abre/fecha; Esc fecha. Devolve se usou a tecla. */
export function teclaCaderno(code: string) {
  if (code === "KeyN") {
    alternarCaderno();
    return true;
  }
  if (code === "Escape" && CADERNO.aberta) {
    fecharCaderno();
    return true;
  }
  return false;
}
