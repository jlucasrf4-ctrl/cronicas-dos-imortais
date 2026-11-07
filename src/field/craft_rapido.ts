/* ==== v8.1 — craft rápido: segurar C (ou o 🔨 do HUD) faz a receita escolhida sem abrir janela ====
   Mantenedor 2026-10-31. Tocar C abre o craft como antes (agora no soltar). Segurando: o arco em meio círculo enche
   perto da heroína, um lote a cada volta, enquanto houver material; ela anda mais devagar (CRAFT_RAPIDO.andar).
   Correr, mirar, defender, rolar ou estar caída pausa; levar dano cancela (o lote em andamento se perde e é preciso
   apertar de novo). A receita é escolhida na janela do craft (seção ⚡) e fica salva em OPT.craftRapido. */
import { dungeon, econ, OPT } from "../core/state.ts";
import { CRAFT_RAPIDO, RECEITAS_RAPIDAS, type ReceitaRapida } from "../data/craft_rapido.ts";
import { ITEM_DEFS } from "../data/itens.ts";
import { RES } from "../data/recursos.ts";
import { openCraft } from "../econ/armaria.ts";
import { updateEcon } from "../econ/economia.ts";
import { arrowCap, resCount, resSpend } from "../expedicao/preparo.ts";
import { gainSkill } from "../hero/nivel.ts";
import { itemCnt, itemTakeH } from "../intro/cena.ts";
import { eqDurInit } from "../items/durabilidade.ts";
import { mkItem, placeIn } from "../items/equipamento.ts";
import { ensureInv } from "../items/inventario.ts";
import { optSave } from "../ui/opcoes.ts";
import { sfx, tryAddToInv } from "./chao.ts";
import { naTela } from "./estados.ts";
import { spawnDungeonToast } from "./masmorra.ts";
import type { Hero } from "../core/tipos.ts";

const QC = {
  apertou: 0, // performance.now() em que o C desceu (0 = solto)
  ativo: false, // segurando já virou craft rápido
  k: 0, // progresso do lote (0..1)
  bloq: "", // por que não dá para fazer (falta material, mochila cheia…); "" = dá
  ferida: 0, // d.sinceHurt do quadro anterior (se cair, levou dano)
  t: 0, // performance.now() do quadro anterior
};

/** A receita do segurar C. */
function receitaRapida(): ReceitaRapida {
  return RECEITAS_RAPIDAS.find((r) => r.id === OPT.craftRapido) || RECEITAS_RAPIDAS[0];
}
const ehRes = (k: string) => k in RES;
const conta = (h: Hero, k: string) => (ehRes(k) ? resCount(h, k) : itemCnt(h, k));
const nome = (k: string) => (ehRes(k) ? RES[k][1] : ITEM_DEFS[k]?.name || k).toLowerCase();

/** Por que não dá para fazer um lote agora ("" = dá). */
function falta(h: Hero, r: ReceitaRapida) {
  for (const [k, n] of Object.entries(r.custo)) if (conta(h, k) < n) return "Falta " + nome(k);
  if (r.flechas && arrowCap(h) - econ.quiver.n <= 0) return "Aljava cheia";
  return "";
}

/** Faz um lote: gasta o custo (e o opcional, se tiver) e põe o resultado na aljava ou na mochila. */
function fazerLote(h: Hero, r: ReceitaRapida) {
  if (r.item) {
    const ok = r.item.startsWith("eq_")
      ? (() => {
          const it = mkItem(r.item!);
          eqDurInit(it);
          return placeIn(ensureInv(h), it);
        })()
      : tryAddToInv(ensureInv(h), r.item, 0);
    if (!ok) return "Mochila cheia";
  }
  for (const [k, n] of Object.entries(r.custo)) ehRes(k) ? resSpend(h, k, n) : itemTakeH(h, k, n);
  const opc = !!r.opcional && Object.entries(r.opcional).every(([k, n]) => conta(h, k) >= n);
  if (opc) for (const [k, n] of Object.entries(r.opcional!)) ehRes(k) ? resSpend(h, k, n) : itemTakeH(h, k, n);
  let txt = "+1 " + (r.item ? ITEM_DEFS[r.item]?.name || r.nome : r.nome);
  if (r.flechas) {
    const n = r.flechas[opc ? 1 : 0],
      q = econ.quiver,
      cabe = Math.min(n, Math.max(0, arrowCap(h) - q.n));
    q.n += cabe;
    econ.arrowStock = (econ.arrowStock || 0) + n - cabe;
    txt = "+" + n + " flechas";
  }
  gainSkill(h, r.pericia[0], r.pericia[1]);
  sfx("perfect");
  spawnDungeonToast(r.ico + " " + txt, dungeon.px, dungeon.py - 40, "#ffb07a", 13);
  updateEcon();
  return "";
}

/** C apertado (teclado ou o 🔨 do HUD). */
export function cApertado() {
  if (!QC.apertou) QC.apertou = performance.now();
}
/** C solto: se não chegou a virar craft rápido, foi um toque e abre a janela (abrir = false: só larga). */
export function cSolto(abrir = true) {
  const tocou = QC.apertou && !QC.ativo;
  QC.apertou = 0;
  QC.ativo = false;
  QC.bloq = "";
  if (tocou && abrir) openCraft();
}
/** Multiplicador da velocidade de andar (field/chao.ts): mais devagar enquanto faz. */
export function craftRapidoAndar() {
  return QC.ativo && !QC.bloq ? CRAFT_RAPIDO.andar : 1;
}

/** Um quadro (field/chao.ts, depois do movimento): enche, pausa, cancela, faz o lote e desenha o arco. No relógio de
 *  verdade, como o segurar da janela do tutorial (o tempo do jogo anda mais devagar quando os quadros caem); parado
 *  quando o jogo está parado (rodando = false). */
export function craftRapidoTick(rodando: boolean) {
  const agora = performance.now(),
    dt = rodando && QC.t ? Math.min(0.25, (agora - QC.t) / 1000) : 0;
  QC.t = agora;
  const d = dungeon,
    h = d.hero,
    r = receitaRapida();
  const hud = document.getElementById("dungeon-craft");
  if (hud && hud.dataset.rap !== r.ico) hud.dataset.rap = r.ico;
  if (!h || !d.active || d.dead || d.modalOpen || d.invOpen || d.craftOpen) {
    if (QC.apertou) cSolto(false);
    QC.k = 0;
    desenhar(null, r);
    return;
  }
  // levou dano: cancela (precisa apertar de novo)
  const ferida = d.sinceHurt ?? 99;
  if (ferida < QC.ferida && (QC.ativo || QC.k > 0)) {
    if (QC.ativo) spawnDungeonToast("Interrompido", d.px, d.py - 40, "#ff8d80", 12);
    QC.apertou = 0;
    QC.ativo = false;
    QC.k = 0;
  }
  QC.ferida = ferida;
  if (QC.apertou && !QC.ativo && (performance.now() - QC.apertou) / 1000 >= CRAFT_RAPIDO.segurar) {
    QC.ativo = true;
    QC.bloq = falta(h, r);
    if (QC.bloq) spawnDungeonToast(QC.bloq, d.px, d.py - 40, "#c9b88a", 12);
  }
  const pausa =
    !!d.running || !!d.charging || !!d.hv || !!d.guard || !!d.dodge || (d.down || 0) > 0 || (d.dazed || 0) > 0;
  if (QC.ativo && !QC.bloq) {
    if (!pausa && dt > 0) {
      const k0 = QC.k;
      QC.k = Math.min(1, QC.k + dt / r.tempo);
      for (const c of [1 / 3, 2 / 3]) if (k0 < c && QC.k >= c) sfx(c < 0.5 ? "hitlite" : "swing");
      if (QC.k >= 1) {
        QC.k = 0;
        QC.bloq = fazerLote(h, r) || falta(h, r);
        if (QC.bloq) spawnDungeonToast(QC.bloq, d.px, d.py - 56, "#c9b88a", 12);
      }
    }
  } else QC.k = Math.max(0, QC.k - (dt * CRAFT_RAPIDO.esvazia) / r.tempo);
  desenhar(QC.ativo || QC.k > 0 ? naTela(d.px, d.py) : null, r, pausa);
}

/** O arco em meio círculo sobre a cabeça dela (HTML por cima do campo). */
function desenhar(p: { x: number; y: number } | null, r: ReceitaRapida, pausa = false) {
  let el = document.getElementById("cr-rap");
  if (!p) {
    if (el) el.classList.remove("on");
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "cr-rap";
    el.innerHTML =
      "<svg viewBox='0 0 120 66' aria-hidden='true'><path class='f' d='M10 60A50 50 0 0 1 110 60' pathLength='100'/>" +
      "<path class='p' d='M10 60A50 50 0 0 1 110 60' pathLength='100'/><line x1='35' y1='16.7' x2='32' y2='11.5'/>" +
      "<line x1='85' y1='16.7' x2='88' y2='11.5'/></svg><span class='ico'></span><span class='et'></span>";
    document.body.appendChild(el);
  }
  const et = r.etapas[Math.min(2, Math.floor(QC.k * 3))];
  el.querySelector(".ico")!.textContent = r.ico;
  el.querySelector(".et")!.textContent = QC.bloq || (pausa ? "Pausado" : et);
  el.classList.add("on");
  el.classList.toggle("bloq", !!QC.bloq);
  el.classList.toggle("pausa", pausa && !QC.bloq);
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
  el.style.setProperty("--p", QC.k.toFixed(3));
}

/** A seção ⚡ da janela do craft (econ/armaria.ts openCraft): escolher a receita do segurar C. */
export function craftRapidoSecao() {
  const lista = document.getElementById("craft-list");
  if (!lista) return;
  let el = document.getElementById("craft-rapido");
  if (!el) {
    el = document.createElement("div");
    el.id = "craft-rapido";
    lista.parentElement!.insertBefore(el, lista);
    el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-rapido]");
      if (!b) return;
      OPT.craftRapido = b.dataset.rapido!;
      optSave();
      craftRapidoSecao();
    });
  }
  const h = dungeon.hero,
    sel = receitaRapida();
  el.innerHTML =
    "<div class='crr-t'><b>⚡ Craft rápido</b><small>segure C (ou o 🔨) e continue andando</small></div><div class='crr-l'>" +
    RECEITAS_RAPIDAS.map((r) => {
      const custo = Object.entries(r.custo)
          .map(([k, n]) => n + " " + nome(k))
          .join(" + "),
        pode = !h || !falta(h, r);
      return (
        "<button type='button' class='crr-b" +
        (r === sel ? " on" : "") +
        (pode ? "" : " sem") +
        "' data-rapido='" +
        r.id +
        "'><span class='crr-i'>" +
        r.ico +
        "</span><span><b>" +
        r.nome +
        "</b><small>" +
        custo +
        "</small></span></button>"
      );
    }).join("") +
    "</div>";
}
