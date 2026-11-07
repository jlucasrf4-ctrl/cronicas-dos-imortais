/* ==== v7.7 — dicas num quadradinho no canto de cima (estilo Red Dead) ====
   No lugar do texto grande de controles embaixo da tela (#dungeon-hint, que agora só abre pelo ❔): UMA dica por vez,
   curta, com a tecla. A dica some quando você faz a ação (marca ✓) e não volta mais (econ.dicas, vai no save). As de
   situação (pegar, atacar, defender) aparecem quando servem; as outras seguem a ordem da tabela DICAS. Respeita
   Opções → "Dicas na tela" (OPT.hints). No celular não aparece (os controles de toque são outros). */
import { dungeon, econ, OPT } from "../core/state.ts";
import { wpnKey } from "../field/armas.ts";
import { isLanca } from "../items/galho.ts";
import { heroEq } from "../items/equipamento.ts";
import { acoesAgora } from "./acoes.ts";
import { MOB } from "./celular.ts";
import { ISC } from "../intro/cena.ts";
import { CAMP } from "../survival/acampamento.ts";
import { MP } from "../creatures/tamandua.ts";

/** Tempos (ms): o ✓ fica na tela, pausa entre uma dica e outra, mínimo de uma dica de situação, a última (❔). */
const DICA_T = { ok: 900, pausa: 1400, minimo: 2500, ajuda: 9000 };

const k = (t: string) => `<kbd>${t}</kbd>`;

/** O que o jogador está usando: arco, lança ou arma de perto. */
function arma() {
  const d = dungeon;
  if (d.weapon === "bow") return "arco";
  return (d.hero && isLanca(wpnKey(d.hero))) || d.spearOut ? "lanca" : "perto";
}

/** Um bicho que ataca, perto do herói (a dica de luta só vale com ele por perto). */
function inimigoPerto() {
  const d = dungeon,
    R = d.tile * 6;
  return d.monsters.some((m) => m.alive && !m.neutral && !m.critter && Math.hypot(m.x - d.px, m.y - d.py) < R);
}

interface Dica {
  id: string;
  /** Teclas (KeyboardEvent.code, ou "mouse0"/"mouse2") que contam como "fez". */
  teclas: () => string[];
  texto: () => string;
  quando: () => boolean;
}

/** Em ordem de prioridade: as de situação primeiro. */
const DICAS: Dica[] = [
  {
    id: "pegar",
    teclas: () => ["KeyE"],
    texto: () => `Toque ${k("E")} para pegar · segure para guardar onde quiser na mochila`,
    quando: () => !!(acoesAgora()[0] || {}).loot,
  },
  {
    id: "atacar",
    teclas: () => [arma() === "arco" ? "mouse2" : "mouse0"],
    texto: () =>
      arma() === "arco"
        ? `Segure o ${k("botão direito")} para puxar a corda e solte para atirar`
        : arma() === "lanca"
          ? `${k("Clique")} para a estocada · segure o ${k("botão direito")} para arremessar`
          : `${k("Clique")} para atacar · três seguidos fazem um combo`,
    quando: inimigoPerto,
  },
  {
    id: "defender",
    teclas: () => ["Space"],
    texto: () =>
      arma() === "arco"
        ? `${k("Espaço")} rola para o lado · os golpes passam direto`
        : arma() === "lanca"
          ? `${k("Espaço")} no tempo do golpe empurra o bicho com a haste`
          : dungeon.hero && heroEq(dungeon.hero).maoE
            ? `Segure ${k("Espaço")} para erguer o escudo`
            : `${k("Espaço")} na hora do golpe: footwork para o lado · o golpe passa direto`,
    quando: () => feita("atacar") && inimigoPerto(),
  },
  {
    id: "andar",
    teclas: () => ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    texto: () => `${k("W")}${k("A")}${k("S")}${k("D")} para andar`,
    quando: () => true,
  },
  {
    id: "correr",
    teclas: () => ["ShiftLeft", "ShiftRight"],
    texto: () => `Segure ${k("Shift")} para correr · gasta fôlego`,
    quando: () => feita("andar"),
  },
  {
    id: "mochila",
    teclas: () => ["KeyI"],
    texto: () => `${k("I")} abre a mochila`,
    quando: () => feita("pegar"),
  },
  {
    id: "craft",
    teclas: () => ["KeyC"],
    texto: () => `${k("C")} abre o craft · segure ${k("C")} para fazer flechas andando`,
    quando: () => feita("mochila"),
  },
  {
    id: "ajuda",
    teclas: () => [],
    texto: () => `O ${k("❔")} lá em cima mostra todos os controles`,
    quando: () => feita("correr") && feita("mochila"),
  },
];

function feita(id: string) {
  return !!(econ.dicas && econ.dicas[id]);
}
function marcar(id: string) {
  (econ.dicas ||= {})[id] = 1;
}

const S = { atual: null as Dica | null, desde: 0, okEm: 0, pausaAte: 0 };

/** Tecla ou botão apertado no campo: conclui a dica que ele ensina. */
export function dicaTecla(code: string) {
  if (!dungeon.active) return;
  for (const d of DICAS) if (!feita(d.id) && d.teclas().includes(code)) marcar(d.id);
}
/** O ❔ foi aberto: a última dica já cumpriu o papel. */
export function dicaAjudaVista() {
  marcar("ajuda");
}

function caixa() {
  let el = document.getElementById("dica");
  if (!el) {
    el = document.createElement("div");
    el.id = "dica";
    document.getElementById("dungeon-view")!.appendChild(el);
  }
  return el;
}
function mostrar(el: HTMLElement, html: string, ok: boolean) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
  el.classList.add("on");
  el.classList.toggle("ok", ok);
  const hud = document.getElementById("dungeon-hud"),
    top = (hud ? hud.offsetHeight : 0) + 22 + "px";
  if (el.style.top !== top) el.style.top = top;
}

/** A cada quadro do campo e do acampamento (chamada por desenharAcoes). */
export function desenharDica() {
  const d = dungeon,
    el = caixa(),
    agora = performance.now(),
    livre =
      OPT.hints !== false &&
      !MOB.on &&
      d.active &&
      !d.dead &&
      !d.invOpen &&
      !d.craftOpen &&
      !d.modalOpen &&
      !ISC.dlg &&
      !CAMP.open &&
      !MP.open;
  if (!livre) {
    el.classList.remove("on");
    return;
  }
  const a = S.atual;
  if (a) {
    if (a.id === "ajuda" && agora - S.desde > DICA_T.ajuda) marcar("ajuda");
    if (feita(a.id)) {
      if (!S.okEm) S.okEm = agora;
      if (agora - S.okEm < DICA_T.ok) return mostrar(el, a.texto() + "<i>✓</i>", true);
      S.atual = null;
      S.pausaAte = agora + DICA_T.pausa;
    } else if (!a.quando() && agora - S.desde > DICA_T.minimo) {
      S.atual = null;
      S.pausaAte = agora + DICA_T.pausa / 3;
    } else return mostrar(el, a.texto(), false);
  }
  el.classList.remove("on", "ok");
  if (agora < S.pausaAte) return;
  const prox = DICAS.find((x) => !feita(x.id) && x.quando());
  if (!prox) return;
  S.atual = prox;
  S.desde = agora;
  S.okEm = 0;
  mostrar(el, prox.texto(), false);
}
