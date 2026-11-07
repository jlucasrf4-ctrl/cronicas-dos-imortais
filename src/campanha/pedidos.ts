/* ==== v7.7 — campanha C2, passo 3 (docs/campanha.md): os pedidos de carne do Caçador para os lobos dele ====
   Depois que o jogador alimenta o lobo pela primeira vez (missão a3_alimentar feita), a cada PEDIDO.cadaDias dias o
   Caçador pede carne: um bicho, quantas, a qualidade mínima e às vezes assada (MODELOS; o primeiro é sempre o mais
   fácil). Ele chama com o ❗ (chamadoAtual em campanha.ts pergunta pedidoNovo); falar com ele anuncia o pedido, que
   aparece no objetivo (missões com `pedido`). Com a carne certa na mochila, E nele entrega: cada lobo dele ganha
   pontos de vínculo (PEDIDO.pontos, mais se assada ou de qualidade alta). O pedido fica em econ.pedido (vai no save). */
import { dungeon, econ, world } from "../core/state.ts";
import { CONFIG } from "../core/config.ts";
import { FALANTES } from "../data/campanha.ts";
import { TIERS, ensureInv } from "../items/inventario.ts";
import { qvInv } from "../expedicao/preparo.ts";
import { say } from "../intro/cena.ts";
import { spawnDungeonToast } from "../field/masmorra.ts";
import { sfx } from "../field/chao.ts";
import { nivelVinculo } from "./cercado.ts";
import type { InvGrid, Item, PedidoCarne } from "../core/tipos.ts";

/** De quantos em quantos dias vem um pedido; pontos de vínculo por entrega (+ assada, + por nível de qualidade);
    v7.7 (mantenedor): o primeiro só vem com um lobo dele no vínculo `primeiroVinculo` (o que já não foge pela
    porteira aberta, PORTA.fogeAbaixo em cercado.ts). */
const PEDIDO = { cadaDias: 2, pontos: 3, assada: 1, porQualidade: 1, primeiroVinculo: 2 };
/** Os pedidos possíveis (o primeiro é o primeiro pedido da campanha). q = índice em TIERS (A, A+, SS). */
const MODELOS: Omit<PedidoCarne, "anunciado">[] = [
  { an: "coelho", n: 2, q: 0, assada: false },
  { an: "cervo", n: 1, q: 0, assada: false },
  { an: "coelho", n: 1, q: 0, assada: true },
  { an: "cervo", n: 2, q: 0, assada: false },
  { an: "cervo", n: 1, q: 1, assada: false },
  { an: "coelho", n: 2, q: 1, assada: false },
  { an: "cervo", n: 1, q: 0, assada: true },
];

function dia() {
  return Math.floor(world.tick / CONFIG.DAY_MIN);
}
function lobosDoCacador() {
  return (econ.lobos || []).filter((L) => L.dono === "cacador");
}

/** O pedido em palavras ("2 carnes de coelho · qualidade A ou melhor"). */
function textoPedido(P: PedidoCarne) {
  const pl = P.n > 1;
  return (
    P.n +
    " carne" +
    (pl ? "s" : "") +
    (P.assada ? " assada" + (pl ? "s" : "") : "") +
    " de " +
    P.an +
    " · qualidade " +
    TIERS[P.q].lab +
    " ou melhor"
  );
}

/** As carnes da mochila que servem para o pedido (até P.n). */
function carnesQueServem(P: PedidoCarne) {
  const h = dungeon.active ? dungeon.hero : null,
    achou: { it: Item; inv: InvGrid }[] = [];
  if (!h) return achou;
  const key = P.assada ? "carne_assada" : "carne";
  for (const inv of [ensureInv(h), qvInv(h)])
    for (const it of inv.items)
      if (it.def.key === key && it.an === P.an && (P.assada ? it.qc || 0 : it.tier || 0) >= P.q)
        achou.push({ it, inv });
  return achou;
}
function quantas(L: { it: Item }[]) {
  return L.reduce((s, x) => s + (x.it.n || 1), 0);
}

/** Cria o pedido quando é hora (iniciarCampanha chama de tempos em tempos). Devolve se criou. */
export function pedidoConferir(primeiro: boolean) {
  if (econ.pedido || !lobosDoCacador().length) return false;
  if (primeiro && !lobosDoCacador().some((L) => nivelVinculo(L) >= PEDIDO.primeiroVinculo)) return false;
  const hoje = dia();
  if (econ.pedidoProx == null) econ.pedidoProx = hoje + 1; // o primeiro vem no dia seguinte
  if (hoje < econ.pedidoProx) return false;
  const M = primeiro ? MODELOS[0] : MODELOS[1 + Math.floor(Math.random() * (MODELOS.length - 1))];
  econ.pedido = { ...M, anunciado: false };
  return true;
}
/** v7.7 — GameShark PEDIDO: o Caçador pede carne já (sem esperar o dia nem o vínculo). */
export function gsPedido() {
  if (econ.pedido) return "Já há um pedido: " + textoPedido(econ.pedido);
  const M = MODELOS[Math.floor(Math.random() * MODELOS.length)];
  econ.pedido = { ...M, anunciado: false };
  return "O Caçador quer " + textoPedido(econ.pedido) + " (fale com ele no acampamento)";
}
/** Há um pedido que o Caçador ainda não disse (ele chama com o ❗). */
export function pedidoNovo() {
  return !!(econ.pedido && !econ.pedido.anunciado);
}
/** O texto do pedido em aberto e já dito (para o objetivo), ou null. */
export function pedidoAtual() {
  return econ.pedido && econ.pedido.anunciado ? textoPedido(econ.pedido) : null;
}
/** Dá para entregar agora (no acampamento, com a carne certa na mochila). */
export function pedidoEntregavel() {
  const P = econ.pedido;
  return !!(P && P.anunciado && dungeon.active && dungeon.camp && quantas(carnesQueServem(P)) >= P.n);
}

/** O Caçador diz o pedido novo. `done` roda depois da fala. */
export function anunciarPedido(done: () => void) {
  const P = econ.pedido;
  if (!P) return false;
  P.anunciado = true;
  say(
    [
      { 0: "Os lobos comem que é uma beleza.", 1: "Preciso de carne pra eles." },
      { 0: "Me traz " + textoPedido(P) + "?" },
    ],
    done,
    FALANTES.cacador,
  );
  return true;
}

/** Entrega o pedido: tira a carne da mochila, dá vínculo aos lobos dele e marca o próximo. */
export function entregarPedido(done: () => void) {
  const P = econ.pedido;
  if (!P || !pedidoEntregavel()) return false;
  let falta = P.n;
  for (const { it, inv } of carnesQueServem(P)) {
    if (falta <= 0) break;
    const c = it.n || 1,
      tira = Math.min(c, falta);
    if (c > tira) it.n = c - tira;
    else inv.items.splice(inv.items.indexOf(it), 1);
    falta -= tira;
  }
  const pts = PEDIDO.pontos + (P.assada ? PEDIDO.assada : 0) + P.q * PEDIDO.porQualidade;
  for (const L of lobosDoCacador()) L.pontos = (L.pontos || 0) + pts;
  econ.pedido = null;
  econ.pedidoProx = dia() + PEDIDO.cadaDias;
  const d = dungeon;
  spawnDungeonToast("🐺 Vínculo +" + pts + " para os lobos do Caçador", d.px, d.py - 50, "#ffe08a", 13);
  sfx("perfect");
  say([{ 0: "Isso aí! Eles vão gostar.", 1: "Daqui a uns dias eu peço mais." }], done, FALANTES.cacador);
  return true;
}
